/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { Card, Row, Col, Statistic, Progress, Table, Alert, Divider, Select, Tooltip } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Breadcrumb } from 'components';
import styles from './index.module.less';
import store from './store';

export default observer(function () {
  const [budgetData, setBudgetData] = useState([]);
  const [topResources, setTopResources] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('current');
  const [hoveredSegment, setHoveredSegment] = useState(null);
  
  // 模拟数据 - 按资源类型的月度数据
  const resourceMonthlyData = {
    'current': [
      { type: 'ECS实例', value: 22502.98, percentage: 60 },
      { type: '云盘', value: 11251.49, percentage: 30 },
      { type: '弹性IP', value: 3750.49, percentage: 10 },
    ],
    'last': [
      { type: 'ECS实例', value: 19502.98, percentage: 55 },
      { type: '云盘', value: 10651.49, percentage: 30 },
      { type: '弹性IP', value: 5350.49, percentage: 15 },
    ],
    'before_last': [
      { type: 'ECS实例', value: 20502.98, percentage: 58 },
      { type: '云盘', value: 9851.49, percentage: 28 },
      { type: '弹性IP', value: 4950.49, percentage: 14 },
    ]
  };
  
  // 模拟数据 - 按资源类型的年度数据
  const resourceYearlyData = [
    { type: 'ECS实例', value: 157520.83, percentage: 60 },
    { type: '云盘', value: 78760.42, percentage: 30 },
    { type: '弹性IP', value: 26253.47, percentage: 10 },
  ];
  
  // 模拟数据 - 按计费方式的月度数据
  const billingMonthlyData = {
    'current': [
      { type: '包年包月', value: 28128.72, percentage: 75 },
      { type: '按量付费', value: 9376.24, percentage: 25 },
    ],
    'last': [
      { type: '包年包月', value: 24855.77, percentage: 70 },
      { type: '按量付费', value: 10651.49, percentage: 30 },
    ],
    'before_last': [
      { type: '包年包月', value: 22590.07, percentage: 64 },
      { type: '按量付费', value: 12714.89, percentage: 36 },
    ]
  };
  
  // 模拟数据 - 按计费方式的年度数据
  const billingYearlyData = [
    { type: '包年包月', value: 196901.54, percentage: 75 },
    { type: '按量付费', value: 65633.18, percentage: 25 },
  ];
  
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
  
  // 定义饼图使用的冷色调颜色
  const resourceColors = ['#0052cc', '#2684ff', '#00b8d9', '#00c7e6'];
  const billingColors = ['#0052cc', '#00b8d9'];
  
  // 饼图组件
  const PieChart = ({data, colors, chartId}) => {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          width: '200px', 
          height: '200px', 
          position: 'relative',
          margin: '0 auto 20px',
        }}>
          <div style={{ 
            width: '200px', 
            height: '200px', 
            borderRadius: '50%', 
            background: generatePieBackground(data, colors),
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }} />
          
          {/* 悬浮交互区域 */}
          {data.map((item, index) => {
            const startAngle = index === 0 ? 0 : 
              data.slice(0, index).reduce((sum, d) => sum + d.percentage, 0) * 3.6;
            const angle = item.percentage * 3.6;
            
            return (
              <Tooltip 
                key={`${chartId}-segment-${index}`}
                title={
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{item.type}</div>
                    <div>金额: ¥{item.value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
                    <div>占比: {item.percentage}%</div>
                  </div>
                }
                placement="top"
              >
                <div 
                  style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: '200px',
                    height: '200px',
                    borderRadius: '50%',
                    clipPath: startAngle === 0 && angle >= 180 ? undefined : 
                      `polygon(50% 50%, 
                      ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, 
                      ${50 + 55 * Math.cos((startAngle + angle/2 - 90) * Math.PI / 180)}% ${50 + 55 * Math.sin((startAngle + angle/2 - 90) * Math.PI / 180)}%,
                      ${50 + 50 * Math.cos((startAngle + angle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle + angle - 90) * Math.PI / 180)}%
                      )`,
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    zIndex: 10
                  }}
                />
              </Tooltip>
            );
          })}
          
          {/* 中心白色圆圈 */}
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)', 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            backgroundColor: '#fff',
            boxShadow: 'inset 0 0 8px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            color: '#0052cc',
            fontSize: '16px'
          }}>
            {data.reduce((sum, item) => sum + item.value, 0).toLocaleString('zh-CN', {
              style: 'currency',
              currency: 'CNY',
              maximumFractionDigits: 0
            })}
          </div>
        </div>
        
        {/* 图例部分 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {data.map((item, index) => (
            <div 
              key={`legend-${index}`} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                margin: '4px 0',
                width: '100%',
                justifyContent: 'center'
              }}
            >
              <div style={{ 
                width: '12px', 
                height: '12px', 
                backgroundColor: colors[index % colors.length], 
                marginRight: '8px',
                borderRadius: '2px'
              }} />
              <span style={{ fontSize: '14px' }}>{item.type}: {item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // 生成饼图的CSS渐变背景
  const generatePieBackground = (data, colors) => {
    let conic = 'conic-gradient(';
    let startAngle = 0;
    
    data.forEach((item, index) => {
      const endAngle = startAngle + item.percentage * 3.6; // 转换为角度 (100% = 360度)
      conic += `${colors[index % colors.length]} ${startAngle}deg ${endAngle}deg`;
      startAngle = endAngle;
      
      if (index < data.length - 1) {
        conic += ', ';
      }
    });
    
    conic += ')';
    return conic;
  };
  
  // 处理月份选择变更
  const handleMonthChange = (value) => {
    setSelectedMonth(value);
  };
  
  // 获取总预算数据
  const getTotalBudget = () => {
    const total = budgetData.find(item => item.category === '总预算');
    return total || { budget: '0.00', used: '0.00', remaining: '0.00', usageRate: 0 };
  };
  
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
                value={37504.96} 
                prefix="¥" 
                precision={2}
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
                value={262534.72} 
                prefix="¥" 
                precision={2} 
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.card}>
              <Statistic 
                title="预算使用" 
                value={76.9} 
                suffix="%" 
              />
              <Progress percent={76.9} status={76.9 > 90 ? "exception" : "active"} />
            </Card>
          </Col>
        </Row>
        
        {/* 月份选择器 */}
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <span style={{ marginRight: 8, fontWeight: 'bold' }}>选择月份:</span>
          <Select 
            value={selectedMonth} 
            onChange={handleMonthChange}
            style={{ width: 120 }}
          >
            <Select.Option value="current">本月</Select.Option>
            <Select.Option value="last">上月</Select.Option>
            <Select.Option value="before_last">前2月</Select.Option>
          </Select>
        </div>
        
        {/* 费用分布 */}
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <Card title="费用分布(按资源类型)" bordered={false} bodyStyle={{ background: '#f9f9f9' }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ textAlign: 'center', color: '#0052cc', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>按年统计</div>
                    <PieChart data={resourceYearlyData} colors={resourceColors} chartId="resource-yearly" />
                  </Col>
                  <Col span={12}>
                    <div style={{ textAlign: 'center', color: '#0052cc', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>按月统计</div>
                    <PieChart data={resourceMonthlyData[selectedMonth]} colors={resourceColors} chartId="resource-monthly" />
                  </Col>
                </Row>
              </Card>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <Card title="费用分布(按计费方式)" bordered={false} bodyStyle={{ background: '#f9f9f9' }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ textAlign: 'center', color: '#0052cc', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>按年统计</div>
                    <PieChart data={billingYearlyData} colors={billingColors} chartId="billing-yearly" />
                  </Col>
                  <Col span={12}>
                    <div style={{ textAlign: 'center', color: '#0052cc', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>按月统计</div>
                    <PieChart data={billingMonthlyData[selectedMonth]} colors={billingColors} chartId="billing-monthly" />
                  </Col>
                </Row>
              </Card>
            </div>
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