/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import { Card, Tabs, Table, Input, Select, Button, Tag, Space, message, DatePicker } from 'antd';
import { SearchOutlined, DownloadOutlined, SyncOutlined } from '@ant-design/icons';
import { Breadcrumb } from 'components';
import styles from './index.module.less';
import store from './store';
import moment from 'moment';
import 'moment/locale/zh-cn';

const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default observer(function () {
  // 添加分页状态管理
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // 使用ref跟踪组件是否已卸载
  const isMounted = useRef(true);
  // 导出功能的loading状态
  const [exporting, setExporting] = useState(false);
  // 日期选择器的显示状态
  const [showDatePicker, setShowDatePicker] = useState(false);
  // 日期范围
  const [dateRange, setDateRange] = useState([]);

  useEffect(() => {
    // 加载初始数据
    store.fetchCostData();
    // 加载统计数据
    store.fetchCostStats();
    
    // 清理函数
    return () => {
      isMounted.current = false;
      // 调用store的清理方法
      store.dispose && store.dispose();
    };
  }, []);

  const handleTabChange = (key) => {
    store.setAssetType(key);
    // 在切换标签页时重置其他筛选条件
    if (key !== store.currentAssetType) {
      store.setTimeRange('current');
      store.setBillingType('all');
      store.setSortOrder('desc');
      store.setSearchKey('');
    }
    
    // 添加更详细的日志记录
    console.log('切换标签页:', key, '当前时间范围:', store.timeRange, '计费方式:', store.billingType);
    
    // 明确传递key参数，确保API请求使用正确的资源类型
    store.fetchCostData(key).then(data => {
      console.log(`标签${key}获取到的数据:`, {
        总数: data.length,
        第一条: data[0],
        最后一条: data[data.length - 1]
      });
    });
    
    // 切换标签页时重置分页
    if (isMounted.current) {
      setCurrentPage(1);
    }
  };

  const handleTimeRangeChange = (value) => {
    if (value === 'custom') {
      setShowDatePicker(true);
      // 不立即更新时间范围，等待日期选择后更新
    } else {
      setShowDatePicker(false);
      store.setTimeRange(value);
      store.fetchCostData();
      // 筛选条件变化时重置分页
      if (isMounted.current) {
        setCurrentPage(1);
      }
    }
  };

  const handleBillingTypeChange = (value) => {
    store.setBillingType(value);
    store.fetchCostData();
    // 筛选条件变化时重置分页
    if (isMounted.current) {
      setCurrentPage(1);
    }
  };

  const handleSortOrderChange = (value) => {
    if (isMounted.current) {
      store.sortOrder = value;
      store.fetchCostData();
    }
  };

  const handleSearch = (e) => {
    if (isMounted.current) {
      store.setSearchKey(e.target.value);
    }
  };

  const handleRefresh = () => {
    store.fetchCostData();
  };
  
  // 处理分页变化
  const handleTableChange = (pagination, filters, sorter) => {
    if (isMounted.current) {
      setCurrentPage(pagination.current);
      setPageSize(pagination.pageSize);
      // 调用store中的方法来获取新页的数据
      store.fetchCostData(store.currentAssetType, {
        page: pagination.current,
        pageSize: pagination.pageSize
      });
    }
  };
  
  // 处理导出
  const handleExport = () => {
    if (store.records.length === 0) {
      message.warning('没有数据可以导出');
      return;
    }

    setExporting(true);

    // 获取所有数据用于导出
    store.fetchCostData(store.currentAssetType, {
      page: 1,
      pageSize: 999999  // 使用一个足够大的数字来获取所有数据
    }).then(allData => {
      try {
        // 准备CSV数据
        const headers = ['月份', '资源名称', '资源类型', '计费方式', '费用金额(元)', '环比变化'];
        const rows = allData.map(item => [
          item.month,
          item.name,
          item.type,
          item.billingTypeName,
          item.cost,
          `${item.change}%`
        ]);

        // 创建CSV内容
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.join(','))
        ].join('\n');

        // 创建并下载文件
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `资源费用明细_${moment().format('YYYY-MM-DD')}.csv`;
        link.click();
        message.success('导出成功');
      } catch (error) {
        console.error('导出失败:', error);
        message.error('导出失败');
      } finally {
        setExporting(false);
      }
    }).catch(error => {
      console.error('获取导出数据失败:', error);
      message.error('获取导出数据失败');
      setExporting(false);
    });
  };
  
  // 处理日期范围变化
  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setDateRange(dates);
      const startDate = dates[0].format('YYYY-MM-DD');
      const endDate = dates[1].format('YYYY-MM-DD');
      store.setCustomDateRange(startDate, endDate);
      store.fetchCostData();
      // 筛选条件变化时重置分页
      if (isMounted.current) {
        setCurrentPage(1);
      }
    }
  };

  const columns = [
    { 
      title: '月份', 
      dataIndex: 'month', 
      key: 'month',
      sorter: (a, b) => a.month.localeCompare(b.month)
    },
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
  
  // 实现真正的数据分页
  const getPaginatedData = () => {
    // 首先去重处理
    const uniqueKeys = new Set();
    const uniqueData = store.records.filter(record => {
      const key = `${record.name}-${record.month}-${record.billingType}`;
      if (uniqueKeys.has(key)) {
        return false;
      }
      uniqueKeys.add(key);
      return true;
    });
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return uniqueData.slice(startIndex, endIndex);
  };
  
  // 获取去重后的数据总数
  const getUniqueDataCount = () => {
    const uniqueKeys = new Set();
    store.records.forEach(record => {
      const key = `${record.name}-${record.month}-${record.billingType}`;
      uniqueKeys.add(key);
    });
    return uniqueKeys.size;
  };
  
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
              <Option value="all">全部数据</Option>
              <Option value="custom">自定义</Option>
            </Select>
            {showDatePicker && (
              <RangePicker 
                style={{ marginLeft: 8 }}
                value={dateRange}
                onChange={handleDateRangeChange}
                format="YYYY-MM-DD"
              />
            )}
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
              onClick={handleExport}
              loading={exporting}
            >
              导出
            </Button>
          </div>
        </div>
        
        <Card className={styles.tableCard}>
          <Table 
            columns={columns} 
            dataSource={store.records} 
            rowKey={record => `${record.name}-${record.month}-${record.billingType}`}
            pagination={{ 
              current: currentPage,
              pageSize: pageSize,
              total: store.total,
              showSizeChanger: true, 
              showQuickJumper: true, 
              showTotal: total => `共 ${total} 条记录`,
              pageSizeOptions: ['10', '20', '50', '100']
            }}
            onChange={handleTableChange}
            loading={store.loading}
          />
        </Card>
      </div>
    </div>
  );
}) 