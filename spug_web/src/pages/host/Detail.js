/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect, useRef, createContext } from 'react';
import { observer } from 'mobx-react';
import { Drawer, Descriptions, List, Button, Input, Select, DatePicker, Tag, message, Empty, Modal } from 'antd';
import { EditOutlined, SaveOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { AuthButton } from 'components';
import { http } from 'libs';
import store from './store';
import lds from 'lodash';
import moment from 'moment';
import styles from './index.module.less';

// 创建上下文
const DetailContext = createContext({});

// 定义不同资产类型的详情组件
const assetDetails = {
  server: ServerDetail,
  disk: DiskDetail,
  storage: StorageDetail,
  cdn: CDNDetail,
  ip: IPDetail
};

export const Detail = observer(function () {
  const [edit, setEdit] = useState(false);
  const [host, setHost] = useState(store.record || {});
  const diskInput = useRef();
  const [tag, setTag] = useState();
  const [inputVisible, setInputVisible] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (store.detailVisible && store.record) {
      try {
        // 克隆原始数据
        const processedRecord = {...store.record};
        
        // 先设置基础数据
        setHost(processedRecord);
        
        // 从实例API获取完整数据
        if (processedRecord.id) {
          http.get('/host/instance/', {params: {id: processedRecord.id}})
            .then(res => {
              // 处理API返回的数据
              let data = res;
              if (Array.isArray(res)) {
                data = res.find(item => item.id === processedRecord.id) || res[0];
              }
              
              // 合并数据并更新
              setHost({...processedRecord, ...data});
            })
            .catch(error => {
              console.error('获取实例数据失败:', error);
            });
        }
      } catch (error) {
        console.error('处理主机数据时出错:', error);
        setHost({});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.detailVisible])

  useEffect(() => {
    if (inputVisible === 'disk') {
      diskInput.current.focus()
    }
  }, [inputVisible])

  function handleFetch() {
    setFetching(true);
    http.get('/host/instance/', {params: {id: host.id}})
      .then(res => {
        // 处理返回的数据
        let data = res;
        if (Array.isArray(res)) {
          data = res.find(item => item.id === host.id) || res[0];
        }
        
        // 更新状态
        setHost({...host, ...data});
        message.success('同步成功')
      })
      .finally(() => setFetching(false))
  }

  function handleSubmit() {
    setLoading(true)
    
    http.post('/host/instance/', host)
      .then(res => {
        // 更新状态
        setHost({...host, ...res});
        setEdit(false);
        store.fetchRecords()
      })
      .finally(() => setLoading(false))
  }

  function handleChange(e, key) {
    if (['create_time', 'expire_time'].includes(key) && e) {
      host[key] = e.format('YYYY-MM-DD')
    } else {
      host[key] = e && e.target ? e.target.value : e
    }
    
    setHost({...host})
  }

  function handleClose() {
    store.detailVisible = false;
    setEdit(false)
  }

  function handleTagConfirm(key) {
    if (tag) {
      if (key === 'disk') {
        const value = Number(tag);
        if (lds.isNaN(value)) return message.error('请输入数字');
        host.disk ? host.disk.push(value) : host.disk = [value]
      }
      setHost(lds.cloneDeep(host))
    }
    setTag(undefined);
    setInputVisible(false)
  }

  function handleTagRemove(key, index) {
    if (key === 'disk') {
      host.disk.splice(index, 1)
    }
    setHost(lds.cloneDeep(host))
  }

  // 根据资产类型渲染对应的详情组件
  const renderDetailContent = () => {
    const assetType = store.record?.asset_type || 'server';
    const DetailComponent = assetDetails[assetType];
    
    if (DetailComponent) {
      return <DetailComponent 
        data={host} 
        edit={edit} 
        onChange={handleChange} 
        diskInput={diskInput}
        inputVisible={inputVisible}
        setInputVisible={setInputVisible}
        tag={tag}
        setTag={setTag}
        handleTagConfirm={handleTagConfirm}
        handleTagRemove={handleTagRemove}
      />;
    }
    
    return <Empty description="暂无详情信息" />;
  };

  return (
    <Modal
      visible={store.detailVisible}
      width={800}
      title={store.record.name || store.record.address}
      footer={null}
      onCancel={handleClose}>
      <DetailContext.Provider value={{ handleSubmit, handleFetch, setEdit, loading, fetching }}>
        <div className={styles.detail}>
          {renderDetailContent()}
        </div>
      </DetailContext.Provider>
    </Modal>
  )
})

export default Detail;

// 服务器详情组件
function ServerDetail({ data, edit, onChange, diskInput, inputVisible, setInputVisible, tag, setTag, handleTagConfirm, handleTagRemove }) {
  // 从父组件获取这些函数和状态
  const { handleSubmit, handleFetch, setEdit, loading, fetching } = React.useContext(DetailContext);
  
  // 简单函数用于获取字段值，支持回退选项
  const getField = (primary, fallback) => data[primary] !== undefined ? data[primary] : data[fallback];
  
  // 格式化状态显示
  const formatStatus = () => {
    const status = data.status || data.state;
    return <Tag color={status === 'Running' ? 'green' : 'orange'}>{status || '未知'}</Tag>;
  };
  
  // 格式化付费方式显示
  const formatPayment = () => {
    const payment = data.payment_timing || data.payment_method || data.charge_type;
    if (payment === 'PrePaid' || payment === 'Prepaid') return '包年包月';
    if (payment === 'PostPaid' || payment === 'Postpaid') return '按量计费';
    return payment || '其他';
  };
  
  return (
    <>
      <Descriptions
        bordered
        size="small"
        labelStyle={{width: 150}}
        title={<span style={{fontWeight: 500}}>基本信息</span>}
        column={1}>
        <Descriptions.Item label="主机名称">{data.name}</Descriptions.Item>
        <Descriptions.Item label="连接地址">{data.username}@{data.hostname}</Descriptions.Item>
        <Descriptions.Item label="连接端口">{data.port}</Descriptions.Item>
        <Descriptions.Item label="所属分组">
          <List>
            {lds.get(data, 'group_ids', []).map(g_id => (
              <List.Item key={g_id} style={{padding: '6px 0'}}>{store.groups[g_id]}</List.Item>
            ))}
          </List>
        </Descriptions.Item>
      </Descriptions>
      <Descriptions
        bordered
        size="small"
        column={1}
        className={edit ? styles.hostExtendEdit : null}
        labelStyle={{width: 150}}
        style={{marginTop: 24}}
        extra={edit ? ([
          <Button key="1" type="link" loading={fetching} icon={<SyncOutlined/>} onClick={handleFetch}>同步</Button>,
          <Button key="2" type="link" loading={loading} icon={<SaveOutlined/>} onClick={handleSubmit}>保存</Button>
        ]) : (
          <AuthButton auth="host.host.edit" type="link" icon={<EditOutlined/>} onClick={() => setEdit(true)}>编辑</AuthButton>
        )}
        title={<span style={{fontWeight: 500}}>扩展信息</span>}>
        <Descriptions.Item label="实例ID">
          {edit ? (
            <Input value={data.instance_id} onChange={e => onChange(e, 'instance_id')} placeholder="选填"/>
          ) : getField('instance_id', 'id')}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          {edit ? (
            <Select
              style={{width: 150}}
              value={data.status}
              placeholder="请选择"
              onChange={v => onChange(v, 'status')}>
              <Select.Option value="Running">Running</Select.Option>
              <Select.Option value="Stopped">Stopped</Select.Option>
            </Select>
          ) : formatStatus()}
        </Descriptions.Item>
        <Descriptions.Item label="可用区">
          {edit ? (
            <Input value={data.zone_name} onChange={e => onChange(e, 'zone_name')} placeholder="可用区"/>
          ) : getField('zone_name', 'region')}
        </Descriptions.Item>
        <Descriptions.Item label="操作系统">
          {edit ? (
            <Input value={data.os_name} onChange={e => onChange(e, 'os_name')} 
                   placeholder="例如：Ubuntu Server 16.04.1 LTS"/>
          ) : getField('os_name', 'os')}
        </Descriptions.Item>
        <Descriptions.Item label="系统版本">
          {edit ? (
            <Input value={data.os_version} onChange={e => onChange(e, 'os_version')} placeholder="例如：20.04 LTS"/>
          ) : getField('os_version', 'version')}
        </Descriptions.Item>
        <Descriptions.Item label="系统架构">
          {edit ? (
            <Input value={data.os_arch} onChange={e => onChange(e, 'os_arch')} placeholder="例如：amd64"/>
          ) : getField('os_arch', 'arch')}
        </Descriptions.Item>
        <Descriptions.Item label="CPU">
          {edit ? (
            <Input suffix="核" style={{width: 100}} value={data.cpu_count} onChange={e => onChange(e, 'cpu_count')}
                   placeholder="数字"/>
          ) : (data.cpu_count || data.cpu) ? `${data.cpu_count || data.cpu}核` : null}
        </Descriptions.Item>
        <Descriptions.Item label="内存">
          {edit ? (
            <Input suffix="GB" style={{width: 100}} value={data.memory_capacity_in_gb} onChange={e => onChange(e, 'memory_capacity_in_gb')}
                   placeholder="数字"/>
          ) : (data.memory_capacity_in_gb || data.memory) ? `${data.memory_capacity_in_gb || data.memory}GB` : null}
        </Descriptions.Item>
        <Descriptions.Item label="磁盘">
          {lds.get(data, 'disk', []).map((item, index) => (
            <Tag closable={edit} key={index} onClose={() => handleTagRemove('disk', index)}>{item}GB</Tag>
          ))}
          {edit && (inputVisible === 'disk' ? (
            <Input
              ref={diskInput}
              type="text"
              size="small"
              value={tag}
              className={styles.tagNumberInput}
              onChange={e => setTag(e.target.value)}
              onBlur={() => handleTagConfirm('disk')}
              onPressEnter={() => handleTagConfirm('disk')}
            />
          ) : (
            <Tag className={styles.tagAdd} onClick={() => setInputVisible('disk')}><PlusOutlined/> 新建</Tag>
          ))}
        </Descriptions.Item>
        <Descriptions.Item label="付费方式">
          {edit ? (
            <Select
              style={{width: 150}}
              value={data.payment_timing}
              placeholder="请选择"
              onChange={v => onChange(v, 'payment_timing')}>
              <Select.Option value="PrePaid">包年包月</Select.Option>
              <Select.Option value="PostPaid">按量计费</Select.Option>
              <Select.Option value="Other">其他</Select.Option>
            </Select>
          ) : formatPayment()}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {edit ? (
            <DatePicker
              value={data.create_time ? moment(data.create_time) : 
                   data.created_time ? moment(data.created_time) : 
                   data.created_at ? moment(data.created_at) : undefined}
              onChange={v => onChange(v, 'create_time')}/>
          ) : data.create_time || data.created_time || data.created_at}
        </Descriptions.Item>
        <Descriptions.Item label="到期时间">
          {edit ? (
            <DatePicker
              value={data.expire_time ? moment(data.expire_time) : 
                   data.expired_time ? moment(data.expired_time) : 
                   data.expired_at ? moment(data.expired_at) : undefined}
              onChange={v => onChange(v, 'expire_time')}/>
          ) : data.expire_time || data.expired_time || data.expired_at}
        </Descriptions.Item>
        <Descriptions.Item label="镜像名称">
          {edit ? (
            <Input value={data.image_name} onChange={e => onChange(e, 'image_name')} placeholder="镜像名称"/>
          ) : data.image_name}
        </Descriptions.Item>
      </Descriptions>
    </>
  );
}

// 磁盘详情组件
function DiskDetail({ data }) {
  return (
    <Descriptions column={1} bordered>
      <Descriptions.Item label="磁盘名称">{data.name}</Descriptions.Item>
      <Descriptions.Item label="容量">{data.size}GB</Descriptions.Item>
      <Descriptions.Item label="类型">{data.type}</Descriptions.Item>
      <Descriptions.Item label="挂载点">{data.mount_point || '-'}</Descriptions.Item>
      <Descriptions.Item label="状态">
        <Tag color={data.status === 'online' ? 'green' : 'red'}>{data.status}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="备注信息">{data.desc || '-'}</Descriptions.Item>
    </Descriptions>
  );
}

// 存储详情组件
function StorageDetail({ data }) {
  return (
    <Descriptions column={1} bordered>
      <Descriptions.Item label="存储名称">{data.name}</Descriptions.Item>
      <Descriptions.Item label="类型">{data.type}</Descriptions.Item>
      <Descriptions.Item label="容量">{data.capacity}GB</Descriptions.Item>
      <Descriptions.Item label="使用率">{data.usage}%</Descriptions.Item>
      <Descriptions.Item label="状态">
        <Tag color={data.status === 'online' ? 'green' : 'red'}>{data.status}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="备注信息">{data.desc || '-'}</Descriptions.Item>
    </Descriptions>
  );
}

// CDN详情组件
function CDNDetail({ data }) {
  return (
    <Descriptions column={1} bordered>
      <Descriptions.Item label="CDN名称">{data.name}</Descriptions.Item>
      <Descriptions.Item label="域名">{data.domain}</Descriptions.Item>
      <Descriptions.Item label="加速类型">{data.type}</Descriptions.Item>
      <Descriptions.Item label="带宽">{data.bandwidth}Mbps</Descriptions.Item>
      <Descriptions.Item label="状态">
        <Tag color={data.status === 'online' ? 'green' : 'red'}>{data.status}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="备注信息">{data.desc || '-'}</Descriptions.Item>
    </Descriptions>
  );
}

// IP地址详情组件
function IPDetail({ data }) {
  return (
    <Descriptions column={1} bordered>
      <Descriptions.Item label="IP地址">{data.address}</Descriptions.Item>
      <Descriptions.Item label="类型">{data.type === 'public' ? '公网IP' : '内网IP'}</Descriptions.Item>
      <Descriptions.Item label="所属区域">{data.region || '-'}</Descriptions.Item>
      <Descriptions.Item label="带宽">{data.bandwidth ? `${data.bandwidth}Mbps` : '-'}</Descriptions.Item>
      <Descriptions.Item label="状态">
        <Tag color={data.status === 'used' ? 'green' : 'orange'}>
          {data.status === 'used' ? '已使用' : '未使用'}
        </Tag>
      </Descriptions.Item>
      <Descriptions.Item label="备注信息">{data.desc || '-'}</Descriptions.Item>
    </Descriptions>
  );
}