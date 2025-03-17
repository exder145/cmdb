/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { Card, Row, Col, Statistic, Progress, Table, Alert, Divider } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Breadcrumb } from 'components';
import styles from './index.module.less';
import store from './store';

export default observer(function () {
  const [budgetData, setBudgetData] = useState([]);
  const [topResources, setTopResources] = useState([]);
  
  useEffect(() => {
    // 获取预算数据
    store.fetchBudgetData().then(data => {
      setBudgetData(data);
    });
    
    // 获取资源数据并排序，取前5个
    store.fetchCostData().then(data => {
      const sorted = [...data].sort((a, b) => parseFloat(b.cost) - parseFloat(a.cost));
      setTopResources(sorted.slice(0, 5));
    });
  }, []);
  
  // 获取总预算数据
  const getTotalBudget = () => {
    const total = budgetData.find(item => item.category === '总预算');
    return total || { budget: '0.00', used: '0.00', remaining: '0.00', usageRate: 0 };
  };
  
  const totalBudget = getTotalBudget();
  
  const columns = [
    { title: '资源ID', dataIndex: 'id', key: 'id' },
    { title: '资源名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { 
      title: '费用金额(元)', 
      dataIndex: 'cost', 
      key: 'cost',
      render: text => <span style={{ fontWeight: 'bold' }}>¥{text}</span>
    },
    { 
      title: '环比变化', 
      dataIndex: 'change', 
      key: 'change',
      render: value => {
        if (value > 0) {
          return <span style={{ color: '#f5222d' }}>+{value}% <ArrowUpOutlined /></span>;
        } else if (value < 0) {
          return <span style={{ color: '#52c41a' }}>{value}% <ArrowDownOutlined /></span>;
        } else {
          return <span style={{ color: '#faad14' }}>{value}% —</span>;
        }
      }
    },
  ];
  
  return (
    <div>
      <Breadcrumb>
        <Breadcrumb.Item>首页</Breadcrumb.Item>
        <Breadcrumb.Item>费用管理</Breadcrumb.Item>
        <Breadcrumb.Item>费用概览</Breadcrumb.Item>
      </Breadcrumb>
      
      <div className={styles.container}>
        {/* 费用总览卡片 */}
        <Row gutter={16}>
          <Col span={6}>
            <Card className={styles.card}>
              <Statistic 
                title="本月总费用" 
                value={totalBudget.used} 
                prefix="¥" 
              />
              <div style={{ fontSize: 14, color: '#f5222d', marginTop: 8 }}>
                较上月 +¥5,678
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.card}>
              <Statistic 
                title="环比上月" 
                value={12.5} 
                precision={1}
                valueStyle={{ color: '#f5222d' }}
                prefix="+"
                suffix="%" 
              />
              <div style={{ fontSize: 14, marginTop: 8 }}>
                <ArrowUpOutlined style={{ color: '#f5222d' }} /> 上升趋势
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.card}>
              <Statistic 
                title="年度累计费用" 
                value={parseFloat(totalBudget.used) * 7} 
                prefix="¥" 
                precision={2} 
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.card}>
              <Statistic 
                title="预算使用" 
                value={totalBudget.usageRate} 
                suffix="%" 
              />
              <Progress percent={totalBudget.usageRate} status={totalBudget.usageRate > 90 ? "exception" : "active"} />
            </Card>
          </Col>
        </Row>
        
        {/* 费用分布 */}
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card title="费用分布(按资源类型)" className={styles.card}>
              <div style={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#1890ff', marginRight: 8 }}></span>
                    ECS实例: 60%
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#52c41a', marginRight: 8 }}></span>
                    云盘: 30%
                  </div>
                  <div>
                    <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#faad14', marginRight: 8 }}></span>
                    弹性IP: 10%
                  </div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="费用分布(按计费方式)" className={styles.card}>
              <div style={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#1890ff', marginRight: 8 }}></span>
                    包年包月: 75%
                  </div>
                  <div>
                    <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#52c41a', marginRight: 8 }}></span>
                    按量付费: 25%
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
        
        {/* Top 5高费用资源 */}
        <Card title="Top 5 高费用资源" className={styles.tableCard}>
          <Table 
            columns={columns} 
            dataSource={topResources} 
            rowKey="id" 
            pagination={false} 
            loading={store.loading}
          />
        </Card>
        
        {/* 费用异常提醒 */}
        <div style={{ marginTop: 16 }}>
          <Divider orientation="left">费用异常提醒</Divider>
          <Alert
            message="ip-d321353e (国际带宽) 费用较上月增长15.3%，请关注使用情况"
            type="warning"
            showIcon
            style={{ marginBottom: 8 }}
          />
          <Alert
            message="云盘总费用接近预算上限，已使用预算的92%"
            type="warning"
            showIcon
            style={{ marginBottom: 8 }}
          />
          <Alert
            message="3个按量付费ECS实例可转包年包月，预计每月节省¥1,245"
            type="info"
            icon={<InfoCircleOutlined />}
          />
        </div>
      </div>
    </div>
  );
}) 