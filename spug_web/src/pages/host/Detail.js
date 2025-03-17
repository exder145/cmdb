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
        const processedRecord = lds.cloneDeep(store.record);
        
        if (typeof processedRecord.instance_charge_type_alias === 'object') {
          processedRecord.instance_charge_type_alias = JSON.stringify(processedRecord.instance_charge_type_alias);
        }
        
        if (typeof processedRecord.internet_charge_type_alias === 'object') {
          processedRecord.internet_charge_type_alias = JSON.stringify(processedRecord.internet_charge_type_alias);
        }
        
        if (typeof processedRecord.updated_at === 'object') {
          processedRecord.updated_at = JSON.stringify(processedRecord.updated_at);
        }
        
        ['disk'].forEach(field => {
          if (processedRecord[field] && Array.isArray(processedRecord[field])) {
            processedRecord[field] = processedRecord[field].map(item => 
              typeof item === 'object' ? JSON.stringify(item) : item
            );
          }
        });
        
        setHost(processedRecord);
      } catch (error) {
        console.error('克隆主机数据时出错:', error);
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

  function handleSubmit() {
    setLoading(true)
    if (host.created_time) host.created_time = moment(host.created_time).format('YYYY-MM-DD')
    if (host.expired_time) host.expired_time = moment(host.expired_time).format('YYYY-MM-DD')
    http.post('/api/host/extend/', {host_id: host.id, ...host})
      .then(res => {
        Object.assign(host, res);
        setEdit(false);
        setHost(lds.cloneDeep(host));
        store.fetchRecords()
      })
      .finally(() => setLoading(false))
  }

  function handleFetch() {
    setFetching(true);
    http.get('/api/host/extend/', {params: {host_id: host.id}})
      .then(res => {
        Object.assign(host, res);
        setHost(lds.cloneDeep(host));
        message.success('同步成功')
      })
      .finally(() => setFetching(false))
  }

  function handleChange(e, key) {
    host[key] = e && e.target ? e.target.value : e;
    if (['created_time', 'expired_time'].includes(key) && e) {
      host[key] = e.format('YYYY-MM-DD')
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
        <Descriptions.Item label="独立密钥">{data.pkey ? '是' : '否'}</Descriptions.Item>
        <Descriptions.Item label="描述信息">{data.desc}</Descriptions.Item>
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
          ) : data.instance_id}
        </Descriptions.Item>
        <Descriptions.Item label="操作系统">
          {edit ? (
            <Input value={data.os_name} onChange={e => onChange(e, 'os_name')}
                   placeholder="例如：Ubuntu Server 16.04.1 LTS"/>
          ) : data.os_name}
        </Descriptions.Item>
        <Descriptions.Item label="CPU">
          {edit ? (
            <Input suffix="核" style={{width: 100}} value={data.cpu} onChange={e => onChange(e, 'cpu')}
                   placeholder="数字"/>
          ) : data.cpu ? `${data.cpu}核` : null}
        </Descriptions.Item>
        <Descriptions.Item label="内存">
          {edit ? (
            <Input suffix="GB" style={{width: 100}} value={data.memory} onChange={e => onChange(e, 'memory')}
                   placeholder="数字"/>
          ) : data.memory ? `${data.memory}GB` : null}
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
        <Descriptions.Item label="实例计费方式">
          {edit ? (
            <Select
              style={{width: 150}}
              value={data.instance_charge_type}
              placeholder="请选择"
              onChange={v => onChange(v, 'instance_charge_type')}>
              <Select.Option value="PrePaid">包年包月</Select.Option>
              <Select.Option value="PostPaid">按量计费</Select.Option>
              <Select.Option value="Other">其他</Select.Option>
            </Select>
          ) : typeof data.instance_charge_type_alias === 'object' ? 
              JSON.stringify(data.instance_charge_type_alias) : 
              data.instance_charge_type_alias}
        </Descriptions.Item>
        <Descriptions.Item label="网络计费方式">
          {edit ? (
            <Select
              style={{width: 150}}
              value={data.internet_charge_type}
              placeholder="请选择"
              onChange={v => onChange(v, 'internet_charge_type')}>
              <Select.Option value="PayByBandwidth">按带宽计费</Select.Option>
              <Select.Option value="PayByTraffic">按流量计费</Select.Option>
              <Select.Option value="Other">其他</Select.Option>
            </Select>
          ) : typeof data.internet_charge_type_alias === 'object' ? 
              JSON.stringify(data.internet_charge_type_alias) : 
              data.internet_charge_type_alias}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {edit ? (
            <DatePicker
              value={data.created_time ? moment(data.created_time) : undefined}
              onChange={v => onChange(v, 'created_time')}/>
          ) : typeof data.created_time === 'object' ? 
              JSON.stringify(data.created_time) : 
              data.created_time}
        </Descriptions.Item>
        <Descriptions.Item label="到期时间">
          {edit ? (
            <DatePicker
              value={data.expired_time ? moment(data.expired_time) : undefined}
              onChange={v => onChange(v, 'expired_time')}/>
          ) : typeof data.expired_time === 'object' ? 
              JSON.stringify(data.expired_time) : 
              data.expired_time}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {typeof data.updated_at === 'object' ? 
            JSON.stringify(data.updated_at) : 
            data.updated_at}
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