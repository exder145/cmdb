/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { PlusOutlined, ThunderboltOutlined, BulbOutlined, QuestionCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { Form, Button, Tooltip, Upload, message, Divider, Input, Space } from 'antd';
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
    if (store.host_ids.length === 0) {
      return message.error('请选择目标主机')
    }
    
    setLoading(true)
    const formData = {
      template_id, 
      params, 
      host_ids: store.host_ids, 
      playbook: playbook,
      extra_vars: extraVars
    }
    http.post('/api/exec/do/', formData)
      .then(store.switchConsole)
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
            <HostSelector type="button" value={store.host_ids} onChange={ids => store.host_ids = ids}/>
          </Form.Item>

          <Form.Item required label={<span style={{color: '#ff4d4f'}}>Ansible Playbook</span>} style={{position: 'relative'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 12}}>
              <a href="https://docs.ansible.com/ansible/latest/user_guide/playbooks.html" target="_blank" rel="noopener noreferrer"
                className={style.tips}><BulbOutlined/> Ansible Playbook文档</a>
              <Space>
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
            <div style={{border: '1px solid #d9d9d9', borderRadius: '2px', marginBottom: '10px'}}>
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
              style={{ marginBottom: 10 }}
            />
          </Form.Item>

          <Form.Item>
            <Button loading={loading} icon={<ThunderboltOutlined/>} type="primary"
                    onClick={() => handleSubmit()}>开始执行</Button>
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
      {store.showTemplate && <TemplateSelector onCancel={store.switchTemplate} onOk={handleTemplate}/>}
      {store.showConsole && <Output onBack={store.switchConsole}/>}
      {visible && <Parameter parameters={parameters} onCancel={() => setVisible(false)} onOk={v => handleSubmit(v)}/>}
    </AuthDiv>
  )
}

export default observer(TaskIndex)
