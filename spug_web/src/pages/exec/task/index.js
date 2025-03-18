/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { PlusOutlined, ThunderboltOutlined, BulbOutlined, QuestionCircleOutlined, UploadOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { Form, Button, Tooltip, Upload, message, Divider, Input, Space, Modal, Table, Tag } from 'antd';
import { ACEditor, AuthDiv, Breadcrumb } from 'components';
import HostSelector from 'pages/host/Selector';
import TemplateSelector from './TemplateSelector';
import Parameter from './Parameter';
import Output from './Output';
import { http, cleanCommand } from 'libs';
import moment from 'moment';
import store from './store';
import gStore from 'gStore';
import style from './index.module.less';

function TaskIndex() {
  const [loading, setLoading] = useState(false)
  const [playbook, setPlaybook] = useState('')
  const [template_id, setTemplateId] = useState()
  const [histories, setHistories] = useState([])
  const [parameters, setParameters] = useState([])
  const [visible, setVisible] = useState(false)
  const [extraVars, setExtraVars] = useState('')
  const [hostList, setHostList] = useState([{ id: Date.now(), ip: '', port: '22', username: '', password: '' }])
  const [hostModalVisible, setHostModalVisible] = useState(false)
  const [editingHost, setEditingHost] = useState(null)

  useEffect(() => {
    if (!loading) {
      http.get('/api/exec/do/')
        .then(res => setHistories(res))
    }
  }, [loading])

  useEffect(() => {
    if (!playbook) {
      setParameters([])
    }
  }, [playbook])

  useEffect(() => {
    gStore.fetchUserSettings()
    return () => {
      store.host_ids = []
      if (store.showConsole) {
        store.switchConsole()
      }
    }
  }, [])

  function handleSubmit(params) {
    if (!params && parameters.length > 0) {
      return setVisible(true)
    }
    if (!playbook) {
      return message.error('请输入Ansible Playbook内容')
    }
    
    const validHosts = hostList.filter(host => host.ip && host.port && host.username);
    if (validHosts.length === 0) {
      return message.error('请添加至少一个有效的目标主机')
    }
    
    setLoading(true)
    const formData = {
      template_id, 
      params, 
      host_list: validHosts,
      playbook: playbook,
      extra_vars: extraVars
    }
    http.post('/api/exec/ansible/', formData)
      .then(token => {
        store.host_ids = []; // 对于Ansible执行，我们不使用host_ids
        store.switchConsole(token);
      })
      .catch(error => {
        message.error(`执行请求失败: ${error.message || '未知错误'}`);
      })
      .finally(() => setLoading(false))
  }

  function handleTemplate(tpl) {
    if (tpl.host_ids.length > 0) store.host_ids = tpl.host_ids
    setTemplateId(tpl.id)
    setPlaybook(tpl.body)
    setParameters(tpl.parameters)
  }

  function handleClick(item) {
    setTemplateId(item.template_id)
    setPlaybook(item.playbook || '')
    setParameters(item.parameters || [])
    store.host_ids = item.host_ids
  }

  function handleUpload(info) {
    if (info.file.status === 'done') {
      const reader = new FileReader();
      reader.onload = e => {
        setPlaybook(e.target.result);
      };
      reader.readAsText(info.file.originFileObj);
      message.success(`${info.file.name} 上传成功`);
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} 上传失败`);
    }
  }

  function handleCSVImport(info) {
    if (info.file.status === 'done') {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const content = e.target.result;
          const lines = content.split('\n').filter(line => line.trim());
          
          const dataLines = lines[0].toLowerCase().includes('ip') ? lines.slice(1) : lines;
          
          const newHosts = dataLines.map(line => {
            const fields = line.split(',');
            if (fields.length < 3) return null;
            
            return {
              id: Date.now() + Math.random(),
              ip: fields[0]?.trim() || '',
              port: fields[1]?.trim() || '22',
              username: fields[2]?.trim() || '',
              password: fields[3]?.trim() || ''
            };
          }).filter(host => host && host.ip && host.username);
          
          if (newHosts.length === 0) {
            message.error('CSV文件中没有有效的主机信息');
            return;
          }
          
          setHostList([...hostList, ...newHosts]);
          message.success(`成功从CSV导入 ${newHosts.length} 台主机`);
        } catch (error) {
          message.error(`解析CSV文件失败: ${error.message}`);
        }
      };
      reader.readAsText(info.file.originFileObj);
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} 上传失败`);
    }
  }

  function openHostModal(host = null) {
    if (host) {
      setEditingHost({ ...host });
    } else {
      setEditingHost({ id: Date.now(), ip: '', port: '22', username: '', password: '' });
    }
    setHostModalVisible(true);
  }

  function saveHost() {
    if (!editingHost.ip || !editingHost.port || !editingHost.username) {
      return message.error('请填写完整的主机信息');
    }
    
    if (hostList.find(h => h.id === editingHost.id)) {
      setHostList(hostList.map(h => h.id === editingHost.id ? editingHost : h));
    } else {
      setHostList([...hostList, editingHost]);
    }
    
    setHostModalVisible(false);
    setEditingHost(null);
  }

  function removeHost(id) {
    if (hostList.length === 1) {
      return message.warning('至少保留一个目标主机');
    }
    setHostList(hostList.filter(host => host.id !== id));
  }

  function addHostBatch() {
    Modal.confirm({
      title: '批量添加主机',
      width: 600,
      icon: <PlusOutlined />,
      maskClosable: false,
      content: (
        <div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>请按照以下格式输入主机信息，每行一个主机：</div>
            <div style={{ color: '#666', marginBottom: '8px' }}>IP地址,端口,用户名,密码</div>
          </div>
          <Input.TextArea
            rows={8}
            placeholder="例如：
192.168.1.100,22,root,password
192.168.1.101,22,admin,password
10.0.0.1,2222,deploy,"
            id="batchHostsInput"
            style={{ 
              marginBottom: '12px',
              fontFamily: 'monospace',
              border: '1px solid #d9d9d9',
              borderRadius: '4px'
            }}
          />
          <div style={{ background: '#f6f6f6', padding: '10px', borderRadius: '4px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
              格式说明：
            </div>
            <ul style={{ fontSize: '12px', color: '#666', paddingLeft: '20px', margin: 0 }}>
              <li>每行只能包含一个主机信息</li>
              <li>字段顺序必须是：IP地址,端口,用户名,密码</li>
              <li>端口默认为22，如使用默认端口可填写空值</li>
              <li>密码字段如为空，表示使用密钥认证</li>
              <li>可直接从Excel复制粘贴（请确保格式正确）</li>
            </ul>
          </div>
        </div>
      ),
      onOk() {
        const textarea = document.getElementById('batchHostsInput');
        if (!textarea || !textarea.value) return;
        
        const lines = textarea.value.split('\n').filter(line => line.trim());
        const newHosts = lines.map(line => {
          const [ip, port, username, password] = line.split(',');
          return {
            id: Date.now() + Math.random(),
            ip: ip?.trim() || '',
            port: port?.trim() || '22',
            username: username?.trim() || '',
            password: password?.trim() || ''
          };
        }).filter(host => host.ip && host.username);
        
        if (newHosts.length === 0) {
          message.error('没有有效的主机信息');
          return;
        }
        
        setHostList([...hostList, ...newHosts]);
        message.success(`成功添加 ${newHosts.length} 台主机`);
      }
    });
  }

  const hostColumns = [
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '密码',
      dataIndex: 'password',
      key: 'password',
      width: 150,
      render: () => <Tag color="blue">已设置</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openHostModal(record)}>编辑</Button>
          <Button type="link" danger onClick={() => removeHost(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <AuthDiv auth="exec.task.do">
      <Breadcrumb>
        <Breadcrumb.Item>首页</Breadcrumb.Item>
        <Breadcrumb.Item>批量执行</Breadcrumb.Item>
        <Breadcrumb.Item>Ansible执行</Breadcrumb.Item>
      </Breadcrumb>
      <div className={style.index} hidden={store.showConsole}>
        <Form layout="vertical" className={style.left}>
          <Form.Item required label={<span style={{color: '#ff4d4f'}}>目标主机</span>}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
              <Space size="middle">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openHostModal()}>
                  添加目标主机
                </Button>
                <Button icon={<PlusOutlined />} onClick={addHostBatch}>批量添加</Button>
                <Upload
                  name="file"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    const isCSV = file.type === 'text/csv' || 
                                 file.name.endsWith('.csv') || 
                                 file.name.endsWith('.txt');
                    if (!isCSV) {
                      message.error('只能上传CSV文件!');
                    }
                    return isCSV;
                  }}
                  customRequest={({file, onSuccess}) => {
                    setTimeout(() => {
                      onSuccess("ok");
                    }, 0);
                  }}
                  onChange={handleCSVImport}
                >
                  <Button icon={<UploadOutlined />}>从CSV导入</Button>
                </Upload>
              </Space>
              
              <div style={{ 
                background: '#f6f6f6', 
                padding: '8px 16px', 
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <span>已添加 <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{hostList.length}</span> 台主机</span>
              </div>
            </div>
            
            <div style={{ borderRadius: '4px', overflow: 'hidden', border: '1px solid #f0f0f0' }}>
              <Table 
                columns={hostColumns}
                dataSource={hostList}
                rowKey="id"
                size="small"
                pagination={false}
                locale={{ emptyText: <div style={{ padding: '20px 0' }}>请添加目标主机</div> }}
                footer={() => (
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    <div>CSV格式：IP地址,端口,用户名,密码 (每行一个主机)</div>
                    <div style={{ marginTop: '4px' }}>提示：确保所有主机已开启SSH服务并允许远程连接</div>
                  </div>
                )}
              />
            </div>
          </Form.Item>

          <Form.Item required label={<span style={{color: '#ff4d4f'}}>Ansible Playbook</span>} style={{position: 'relative'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 12}}>
              <a href="https://docs.ansible.com/ansible/latest/user_guide/playbooks.html" target="_blank" rel="noopener noreferrer"
                className={style.tips}><BulbOutlined/> Ansible Playbook文档</a>
              <Space size="middle">
                <Upload
                  name="file"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    const isYaml = file.type === 'application/x-yaml' || 
                                  file.name.endsWith('.yml') || 
                                  file.name.endsWith('.yaml');
                    if (!isYaml) {
                      message.error('只能上传YAML文件!');
                    }
                    return isYaml;
                  }}
                  customRequest={({file, onSuccess}) => {
                    setTimeout(() => {
                      onSuccess("ok");
                    }, 0);
                  }}
                  onChange={handleUpload}
                >
                  <Button icon={<UploadOutlined />}>上传Playbook</Button>
                </Upload>
                <Button icon={<PlusOutlined/>} onClick={store.switchTemplate}>从模版中选择</Button>
              </Space>
            </div>
            <div style={{border: '1px solid #f0f0f0', borderRadius: '4px', marginBottom: '10px'}}>
              <ACEditor 
                className={style.editor} 
                mode="yaml" 
                value={playbook} 
                width="100%" 
                onChange={setPlaybook}
                placeholder="请输入Ansible Playbook内容，例如：
---
- name: My Playbook
  hosts: all
  tasks:
    - name: Print message
      debug:
        msg: Hello World"
              />
            </div>
          </Form.Item>

          <Form.Item label="额外变量 (Extra Vars)">
            <Input.TextArea
              value={extraVars}
              onChange={e => setExtraVars(e.target.value)}
              placeholder="key=value 格式，每行一个变量"
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ marginBottom: 10, borderRadius: '4px' }}
            />
          </Form.Item>

          <Form.Item>
            <Button loading={loading} icon={<ThunderboltOutlined/>} type="primary"
                    onClick={() => handleSubmit()} size="large">开始执行</Button>
          </Form.Item>
        </Form>

        <div className={style.right}>
          <div className={style.title}>
            执行记录
            <Tooltip title="多次相同的执行记录将会合并展示，每天自动清理，保留最近30条记录。">
              <QuestionCircleOutlined style={{color: '#999', marginLeft: 8}}/>
            </Tooltip>
          </div>
          <div className={style.inner}>
            {histories.map((item, index) => (
              <div key={index} className={style.item} onClick={() => handleClick(item)}>
                <div className={style.ansible}>An</div>
                <div className={style.number}>{item.host_ids.length}</div>
                {item.template_name ? (
                  <div className={style.tpl}>{item.template_name}</div>
                ) : (
                  <div className={style.command}>{item.playbook ? '自定义Playbook' : item.command}</div>
                )}
                <div className={style.desc}>{moment(item.updated_at).format('MM.DD HH:mm')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Modal
        title={editingHost && editingHost.id ? "编辑目标主机" : "添加目标主机"}
        visible={hostModalVisible}
        onOk={saveHost}
        onCancel={() => setHostModalVisible(false)}
        maskClosable={false}
        width={520}
        destroyOnClose
      >
        <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
          <Form.Item 
            label="IP地址" 
            required 
            tooltip="目标主机的IP地址，必须可以通过网络访问"
          >
            <Input 
              value={editingHost?.ip} 
              onChange={e => setEditingHost({...editingHost, ip: e.target.value})}
              placeholder="例如: 192.168.1.100" 
              allowClear
            />
          </Form.Item>
          <Form.Item 
            label="SSH端口" 
            required
            tooltip="SSH服务的端口号，默认为22"
          >
            <Input 
              value={editingHost?.port} 
              onChange={e => setEditingHost({...editingHost, port: e.target.value})}
              placeholder="默认: 22" 
              allowClear
            />
          </Form.Item>
          <Form.Item 
            label="用户名" 
            required
            tooltip="有执行权限的SSH用户名，建议使用root用户"
          >
            <Input 
              value={editingHost?.username} 
              onChange={e => setEditingHost({...editingHost, username: e.target.value})}
              placeholder="例如: root" 
              allowClear
            />
          </Form.Item>
          <Form.Item 
            label="密码"
            tooltip="SSH用户的密码，如使用密钥认证可不填"
          >
            <Input.Password 
              value={editingHost?.password} 
              onChange={e => setEditingHost({...editingHost, password: e.target.value})}
              placeholder="请输入密码" 
              allowClear
            />
          </Form.Item>
          
          <div style={{ background: '#f9f9f9', padding: '8px 12px', borderRadius: '4px', marginTop: '8px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
              <strong>提示：</strong>
            </div>
            <ul style={{ fontSize: '12px', color: '#666', margin: 0, paddingLeft: '20px' }}>
              <li>请确保目标主机已开启SSH服务并允许远程连接</li>
              <li>建议使用拥有sudo权限的用户执行Ansible命令</li>
              <li>如遇连接问题，请检查防火墙和SSH配置</li>
            </ul>
          </div>
        </Form>
      </Modal>
      {store.showTemplate && <TemplateSelector onCancel={store.switchTemplate} onOk={handleTemplate}/>}
      {store.showConsole && <Output onBack={store.switchConsole}/>}
      {visible && <Parameter parameters={parameters} onCancel={() => setVisible(false)} onOk={v => handleSubmit(v)}/>}
    </AuthDiv>
  )
}

export default observer(TaskIndex)
