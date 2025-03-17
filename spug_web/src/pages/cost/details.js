/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { Card, Tabs, Table, Input, Select, Button, Tag, Space } from 'antd';
import { SearchOutlined, DownloadOutlined, SyncOutlined } from '@ant-design/icons';
import { Breadcrumb } from 'components';
import styles from './index.module.less';
import store from './store';

const { TabPane } = Tabs;
const { Option } = Select;

export default observer(function () {
  useEffect(() => {
    store.fetchCostData();
  }, []);

  const handleTabChange = (key) => {
    store.setAssetType(key);
    store.fetchCostData(key);
  };

  const handleTimeRangeChange = (value) => {
    store.setTimeRange(value);
    store.fetchCostData();
  };

  const handleBillingTypeChange = (value) => {
    store.setBillingType(value);
    store.fetchCostData();
  };

  const handleSortOrderChange = (value) => {
    store.setSortOrder(value);
    store.fetchCostData();
  };

  const handleSearch = (e) => {
    store.setSearchKey(e.target.value);
    store.fetchCostData();
  };

  const handleRefresh = () => {
    store.fetchCostData();
  };
  
  const columns = [
    { title: '资源ID', dataIndex: 'id', key: 'id' },
    { title: '资源名称', dataIndex: 'name', key: 'name' },
    { title: '资源类型', dataIndex: 'type', key: 'type' },
    { 
      title: '计费方式', 
      dataIndex: 'billingTypeName', 
      key: 'billingTypeName',
      render: text => {
        const color = text === '包年包月' ? 'blue' : 'green';
        return <Tag color={color}>{text}</Tag>;
      }
    },
    { 
      title: '费用金额(元)', 
      dataIndex: 'cost', 
      key: 'cost',
      sorter: (a, b) => parseFloat(a.cost) - parseFloat(b.cost),
      render: text => <span style={{ fontWeight: 'bold' }}>¥{text}</span>
    },
    { 
      title: '环比变化', 
      dataIndex: 'change', 
      key: 'change',
      render: value => {
        if (value > 0) {
          return <span style={{ color: '#f5222d' }}>+{value}%</span>;
        } else if (value < 0) {
          return <span style={{ color: '#52c41a' }}>{value}%</span>;
        } else {
          return <span style={{ color: '#faad14' }}>{value}%</span>;
        }
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <a onClick={() => store.showDetail(record)}>详情</a>
          <a>标签</a>
        </Space>
      ),
    },
  ];
  
  return (
    <div>
      <Breadcrumb>
        <Breadcrumb.Item>首页</Breadcrumb.Item>
        <Breadcrumb.Item>费用管理</Breadcrumb.Item>
        <Breadcrumb.Item>资源费用明细</Breadcrumb.Item>
      </Breadcrumb>
      
      <div className={styles.container}>
        <Tabs activeKey={store.currentAssetType} onChange={handleTabChange}>
          <TabPane tab="全部资源" key="all" />
          <TabPane tab="ECS实例" key="ecs" />
          <TabPane tab="云盘" key="disk" />
          <TabPane tab="弹性IP" key="ip" />
        </Tabs>
        
        <div className={styles.filterBar}>
          <div className={styles.filterItem}>
            <span style={{ marginRight: 8 }}>时间范围:</span>
            <Select 
              value={store.timeRange} 
              onChange={handleTimeRangeChange} 
              style={{ width: 120 }}
            >
              <Option value="current">本月</Option>
              <Option value="last">上月</Option>
              <Option value="quarter">本季度</Option>
              <Option value="custom">自定义</Option>
            </Select>
          </div>
          
          <div className={styles.filterItem}>
            <span style={{ marginRight: 8 }}>计费方式:</span>
            <Select 
              value={store.billingType} 
              onChange={handleBillingTypeChange} 
              style={{ width: 120 }}
            >
              <Option value="all">全部</Option>
              <Option value="prepay">包年包月</Option>
              <Option value="postpay">按量付费</Option>
            </Select>
          </div>
          
          <div className={styles.filterItem}>
            <span style={{ marginRight: 8 }}>费用排序:</span>
            <Select 
              value={store.sortOrder} 
              onChange={handleSortOrderChange} 
              style={{ width: 120 }}
            >
              <Option value="desc">从高到低</Option>
              <Option value="asc">从低到高</Option>
            </Select>
          </div>
          
          <div className={styles.filterItem} style={{ flex: 1 }}>
            <Input 
              placeholder="搜索资源ID或名称" 
              prefix={<SearchOutlined />} 
              style={{ width: 200, marginLeft: 16 }}
              onChange={handleSearch}
              value={store.searchKey}
            />
          </div>
          
          <div>
            <Button 
              type="primary" 
              icon={<SyncOutlined />} 
              style={{ marginRight: 8 }}
              onClick={handleRefresh}
              loading={store.loading}
            >
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
            >
              导出
            </Button>
          </div>
        </div>
        
        <Card className={styles.tableCard}>
          <Table 
            columns={columns} 
            dataSource={store.records} 
            rowKey={record => `${record.id}-${record.billingType}`}
            pagination={{ 
              showSizeChanger: true, 
              showTotal: total => `共 ${total} 条记录`,
              defaultPageSize: 10,
              pageSizeOptions: ['10', '20', '50', '100']
            }}
            loading={store.loading}
          />
        </Card>
      </div>
    </div>
  );
}) 