/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import { ExclamationCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { Modal, Form, Input, TreeSelect, Button, Upload, Alert, message, Select, InputNumber, Radio } from 'antd';
import { http, X_TOKEN } from 'libs';
import store from './store';
import styles from './index.module.less';

// 声明表单组件，实际定义在文件末尾
let ServerForm, DiskForm, StorageForm, CDNForm, IPForm;

// 定义不同资产类型的表单组件映射
const assetForms = {
  server: props => ServerForm ? <ServerForm {...props} /> : null,
  disk: props => DiskForm ? <DiskForm {...props} /> : null,
  storage: props => StorageForm ? <StorageForm {...props} /> : null,
  cdn: props => CDNForm ? <CDNForm {...props} /> : null,
  ip: props => IPForm ? <IPForm {...props} /> : null
};

export const ComForm = observer(function () {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const isMounted = useRef(true);
  
  // 获取当前资产类型
  const assetType = store.currentAssetType || 'server';

  useEffect(() => {
    if (store.record.pkey) {
      setFileList([{uid: '0', name: '独立密钥', data: store.record.pkey}])
    }
    
    // 设置表单初始值
    form.setFieldsValue(store.record);
    
    // 组件卸载时清理
    return () => {
      isMounted.current = false;
    };
  }, [form])

  function handleSubmit() {
    setLoading(true);
    const formData = form.getFieldsValue();
    
    // 添加ID（如果存在）
    if (store.record.id) {
      formData['id'] = store.record.id;
    }
    
    console.log('提交表单数据:', formData, '资产类型:', assetType);
    
    // 服务器类型特殊处理
    if (assetType === 'server') {
      const file = fileList[0];
      if (file && file.data) formData['pkey'] = file.data;
      
      // 使用 saveAsset 方法保存数据
      store.saveAsset(assetType, formData)
        .then(res => {
          if (!isMounted.current) return;
          
          if (res === 'auth fail') {
            setLoading(false)
            if (formData.pkey) {
              message.error('独立密钥认证失败')
            } else {
              const onChange = v => formData.password = v;
              Modal.confirm({
                icon: <ExclamationCircleOutlined/>,
                title: '首次验证请输入密码',
                content: <ConfirmForm username={formData.username} onChange={onChange}/>,
                onOk: () => handleConfirm(formData),
              })
            }
          } else {
            message.success('保存成功');
            store.formVisible = false;
            store.fetchRecords();
            if (res.id) {
              store.fetchExtend(res.id);
            }
          }
        })
        .catch(() => {
          if (!isMounted.current) return;
          message.error('保存失败');
        })
        .finally(() => {
          if (!isMounted.current) return;
          setLoading(false);
        });
    } else {
      // 其他资产类型直接保存
      store.saveAsset(assetType, formData)
        .then(() => {
          if (!isMounted.current) return;
          message.success('保存成功，请点击刷新按钮查看最新数据');
          store.formVisible = false;
        })
        .catch(error => {
          if (!isMounted.current) return;
          message.error(`保存失败: ${error.message || '未知错误'}`);
        })
        .finally(() => {
          if (!isMounted.current) return;
          setLoading(false);
        });
    }
  }

  function handleConfirm(formData) {
    if (formData.password) {
      return http.post('/api/host/', formData)
        .then(res => {
          message.success('验证成功');
          store.formVisible = false;
          store.fetchRecords();
          store.fetchExtend(res.id)
        })
    }
    message.error('请输入授权密码')
  }

  const ConfirmForm = (props) => (
    <Form layout="vertical" style={{marginTop: 24}}>
      <Form.Item required label="授权密码" extra={`用户 ${props.username} 的密码， 该密码仅做首次验证使用，不会存储该密码。`}>
        <Input.Password onChange={e => props.onChange(e.target.value)}/>
      </Form.Item>
    </Form>
  )

  function handleUploadChange(v) {
    if (v.fileList.length === 0) {
      setFileList([])
    }
  }

  function handleUpload(file, fileList) {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    http.post('/api/host/parse/', formData)
      .then(res => {
        file.data = res;
        setFileList([file])
      })
      .finally(() => setUploading(false))
    return false
  }

  // 根据资产类型获取表单标题
  const getFormTitle = () => {
    const titles = {
      server: '主机',
      disk: '磁盘',
      storage: '存储',
      cdn: 'CDN',
      ip: 'IP地址'
    };
    const action = store.record.id ? '编辑' : '新建';
    return `${action}${titles[assetType] || '资产'}`;
  };

  // 根据资产类型渲染对应的表单组件
  const renderFormContent = () => {
    console.log('渲染表单组件，资产类型:', assetType);
    
    // 根据资产类型选择对应的表单组件
    switch (assetType) {
      case 'server':
        return <ServerForm 
          form={form} 
          info={store.record} 
          fileList={fileList} 
          uploading={uploading}
          handleUpload={handleUpload}
          handleUploadChange={handleUploadChange}
        />;
      case 'disk':
        return <DiskForm form={form} info={store.record} />;
      case 'storage':
        return <StorageForm form={form} info={store.record} />;
      case 'cdn':
        return <CDNForm form={form} info={store.record} />;
      case 'ip':
        return <IPForm form={form} info={store.record} />;
      default:
        // 默认返回服务器表单
        return <ServerForm 
          form={form} 
          info={store.record} 
          fileList={fileList} 
          uploading={uploading}
          handleUpload={handleUpload}
          handleUploadChange={handleUploadChange}
        />;
    }
  };

  return (
    <Modal
      visible
      width={700}
      maskClosable={false}
      title={getFormTitle()}
      okText="保存"
      onCancel={() => store.formVisible = false}
      confirmLoading={loading}
      onOk={handleSubmit}
      destroyOnClose={true}
      getContainer={false}>
      {renderFormContent()}
    </Modal>
  )
})

export default ComForm;

// 服务器表单组件
ServerForm = function({ form, info, fileList, uploading, handleUpload, handleUploadChange }) {
  return (
    <Form form={form} labelCol={{span: 5}} wrapperCol={{span: 17}} initialValues={info}>
      <Form.Item required name="group_ids" label="主机分组">
        <TreeSelect
          multiple
          treeNodeLabelProp="name"
          treeData={store.treeData}
          showCheckedStrategy={TreeSelect.SHOW_CHILD}
          placeholder="请选择分组"/>
      </Form.Item>
      <Form.Item required name="name" label="主机名称">
        <Input placeholder="请输入主机名称"/>
      </Form.Item>
      <Form.Item required label="连接地址" style={{marginBottom: 0}}>
        <Form.Item name="username" className={styles.formAddress1} style={{width: 'calc(30%)'}}>
          <Input addonBefore="ssh" placeholder="用户名"/>
        </Form.Item>
        <Form.Item name="hostname" className={styles.formAddress2} style={{width: 'calc(40%)'}}>
          <Input addonBefore="@" placeholder="主机名/IP"/>
        </Form.Item>
        <Form.Item name="port" className={styles.formAddress3} style={{width: 'calc(30%)'}}>
          <Input addonBefore="-p" placeholder="端口"/>
        </Form.Item>
      </Form.Item>
      <Form.Item label="独立密钥" extra="默认使用全局密钥，如果上传了独立密钥（私钥）则优先使用该密钥。">
        <Upload name="file" fileList={fileList} headers={{'X-Token': X_TOKEN}} beforeUpload={handleUpload}
                onChange={handleUploadChange}>
          {fileList.length === 0 ? <Button loading={uploading} icon={<UploadOutlined/>}>点击上传</Button> : null}
        </Upload>
      </Form.Item>
      <Form.Item name="desc" label="备注信息">
        <Input.TextArea placeholder="请输入主机备注信息"/>
      </Form.Item>
      <Form.Item wrapperCol={{span: 17, offset: 5}}>
        <Alert showIcon type="info" message="首次验证时需要输入登录用户名对应的密码，该密码会用于配置SSH密钥认证，不会存储该密码。"/>
      </Form.Item>
    </Form>
  );
};

// 磁盘表单组件
DiskForm = function({ form, info }) {
  return (
    <Form form={form} labelCol={{span: 6}} wrapperCol={{span: 16}} initialValues={info}>
      <Form.Item required name="name" label="磁盘名称">
        <Input placeholder="请输入磁盘名称"/>
      </Form.Item>
      <Form.Item required name="size" label="容量(GB)">
        <InputNumber min={1} placeholder="请输入磁盘容量"/>
      </Form.Item>
      <Form.Item required name="type" label="磁盘类型">
        <Select placeholder="请选择磁盘类型">
          <Select.Option value="SSD">SSD</Select.Option>
          <Select.Option value="HDD">HDD</Select.Option>
          <Select.Option value="NVMe">NVMe</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item name="mount_point" label="挂载点">
        <Input placeholder="请输入挂载点"/>
      </Form.Item>
      <Form.Item required name="status" label="状态">
        <Select placeholder="请选择状态">
          <Select.Option value="online">在线</Select.Option>
          <Select.Option value="offline">离线</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item name="desc" label="备注信息">
        <Input.TextArea placeholder="请输入备注信息"/>
      </Form.Item>
    </Form>
  );
};

// 存储表单组件
StorageForm = function({ form, info }) {
  return (
    <Form form={form} labelCol={{span: 6}} wrapperCol={{span: 16}} initialValues={info}>
      <Form.Item required name="name" label="存储名称">
        <Input placeholder="请输入存储名称"/>
      </Form.Item>
      <Form.Item required name="type" label="存储类型">
        <Select placeholder="请选择存储类型">
          <Select.Option value="S3">S3</Select.Option>
          <Select.Option value="OSS">OSS</Select.Option>
          <Select.Option value="NAS">NAS</Select.Option>
          <Select.Option value="Block">Block</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item required name="capacity" label="容量(GB)">
        <InputNumber min={1} placeholder="请输入存储容量"/>
      </Form.Item>
      <Form.Item name="usage" label="使用率(%)">
        <InputNumber min={0} max={100} placeholder="请输入使用率"/>
      </Form.Item>
      <Form.Item required name="status" label="状态">
        <Select placeholder="请选择状态">
          <Select.Option value="online">在线</Select.Option>
          <Select.Option value="offline">离线</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item name="desc" label="备注信息">
        <Input.TextArea placeholder="请输入备注信息"/>
      </Form.Item>
    </Form>
  );
};

// CDN表单组件
CDNForm = function({ form, info }) {
  return (
    <Form form={form} labelCol={{span: 6}} wrapperCol={{span: 16}} initialValues={info}>
      <Form.Item required name="name" label="CDN名称">
        <Input placeholder="请输入CDN名称"/>
      </Form.Item>
      <Form.Item required name="domain" label="域名">
        <Input placeholder="请输入域名"/>
      </Form.Item>
      <Form.Item required name="type" label="加速类型">
        <Select placeholder="请选择加速类型">
          <Select.Option value="网页加速">网页加速</Select.Option>
          <Select.Option value="下载加速">下载加速</Select.Option>
          <Select.Option value="视频加速">视频加速</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item name="bandwidth" label="带宽(Mbps)">
        <InputNumber min={1} placeholder="请输入带宽"/>
      </Form.Item>
      <Form.Item required name="status" label="状态">
        <Select placeholder="请选择状态">
          <Select.Option value="online">在线</Select.Option>
          <Select.Option value="offline">离线</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item name="desc" label="备注信息">
        <Input.TextArea placeholder="请输入备注信息"/>
      </Form.Item>
    </Form>
  );
};

// IP地址表单组件
IPForm = function({ form, info }) {
  return (
    <Form form={form} labelCol={{span: 6}} wrapperCol={{span: 16}} initialValues={info}>
      <Form.Item required name="address" label="IP地址">
        <Input placeholder="请输入IP地址"/>
      </Form.Item>
      <Form.Item required name="type" label="IP类型">
        <Select placeholder="请选择IP类型">
          <Select.Option value="public">公网IP</Select.Option>
          <Select.Option value="private">内网IP</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item name="region" label="所属区域">
        <Input placeholder="请输入所属区域"/>
      </Form.Item>
      <Form.Item name="bandwidth" label="带宽(Mbps)">
        <InputNumber min={1} placeholder="请输入带宽"/>
      </Form.Item>
      <Form.Item required name="status" label="状态">
        <Select placeholder="请选择状态">
          <Select.Option value="used">已使用</Select.Option>
          <Select.Option value="unused">未使用</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item name="desc" label="备注信息">
        <Input.TextArea placeholder="请输入备注信息"/>
      </Form.Item>
    </Form>
  );
};
