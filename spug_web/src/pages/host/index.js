/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { Row, Col, Tabs } from 'antd';
import { CodeOutlined, CloudServerOutlined, HddOutlined, CloudOutlined, GlobalOutlined, LinkOutlined } from '@ant-design/icons';
import { AuthDiv, Breadcrumb, AuthButton } from 'components';
import Group from './Group';
import ComTable from './Table';
import ComForm from './Form';
import ComImport from './Import';
import CloudImport from './CloudImport';
import BatchSync from './BatchSync';
import Detail from './Detail';
import Selector from './Selector';
import Export from './Export';
import store from './store';

const { TabPane } = Tabs;

// 定义资产类型
const assetTypes = [
  { key: 'server', tab: '服务器', icon: <CloudServerOutlined /> },
  { key: 'disk', tab: '磁盘', icon: <HddOutlined /> },
  { key: 'storage', tab: '对象存储', icon: <CloudOutlined /> },
  { key: 'cdn', tab: 'CDN', icon: <GlobalOutlined /> },
  { key: 'ip', tab: 'IP地址', icon: <LinkOutlined /> }
];

export default observer(function () {
  const [activeTab, setActiveTab] = useState('server');
  // 添加一个状态来强制重新渲染
  const [, forceUpdate] = useState({});

  useEffect(() => {
    store.initial()
  }, [])

  // 处理标签页切换
  const handleTabChange = (key) => {
    console.log('切换到资产类型:', key);
    setActiveTab(key);
    
    // 设置当前资产类型
    store.setAssetType(key);
    
    // 强制重新渲染
    setTimeout(() => {
      // 获取数据
      if (key !== 'server') {
        store.getAssetDataSource(key)
          .then(result => {
            console.log(`获取${key}数据结果:`, result);
            forceUpdate({});
          })
          .catch(error => {
            console.error(`获取${key}数据出错:`, error);
            forceUpdate({});
          });
      } else {
        forceUpdate({});
      }
    }, 100);
  };

  function openTerminal() {
    window.open('/ssh')
  }

  // 处理新建按钮点击事件
  function handleCreate() {
    store.showForm({ asset_type: activeTab });
  }

  return (
    <AuthDiv auth="host.host.view">
      <Breadcrumb extra={<AuthButton auth="host.console.view|host.console.list" type="primary" icon={<CodeOutlined/>}
                                     onClick={openTerminal}>Web 终端</AuthButton>}>
        <Breadcrumb.Item>首页</Breadcrumb.Item>
        <Breadcrumb.Item>资产管理</Breadcrumb.Item>
      </Breadcrumb>

      <Tabs 
        activeKey={activeTab} 
        onChange={handleTabChange}
        style={{ marginBottom: 16 }}>
        {assetTypes.map(type => (
          <TabPane 
            key={type.key}
            tab={
              <span>
                {type.icon}
                <span style={{ marginLeft: 8 }}>{type.tab}</span>
              </span>
            }
          />
        ))}
      </Tabs>

      <Row gutter={12}>
        <Col span={6}>
          <Group assetType={activeTab} />
        </Col>
        <Col span={18}>
          <ComTable assetType={activeTab} />
        </Col>
      </Row>

      <Detail/>
      {store.formVisible && <ComForm/>}
      {store.importVisible && <ComImport/>}
      {store.cloudImport && <CloudImport/>}
      {store.syncVisible && <BatchSync/>}
      {store.exportVisible && <Export/>}
      {store.selectorVisible &&
        <Selector
          mode="group"
          onlySelf={!store.addByCopy}
          onCancel={() => store.selectorVisible = false}
          onChange={store.updateGroup}
        />}
    </AuthDiv>
  );
})
