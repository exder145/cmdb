/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { Card, Row, Col, Table, Progress, Button, Statistic, Divider, Tag, Space } from 'antd';
import { EditOutlined, PlusOutlined, BellOutlined } from '@ant-design/icons';
import { Breadcrumb } from 'components';
import styles from './index.module.less';
import store from './store';

export default observer(function () {
  const [currentPeriod, setCurrentPeriod] = useState('2023年7月');
  const [budgetData, setBudgetData] = useState([]);
  
  useEffect(() => {
    store.fetchBudgetData().then(data => {
      setBudgetData(data);
    });
  }, []);
  
  // 模拟告警设置数据
  const alertData = [
    { 
      type: '总预算使用率', 
      threshold: '80%, 90%', 
      notifyMethod: '邮件,短信', 
      receivers: '财务组,管理员' 
    },
    { 
      type: '云盘预算使用率', 
      threshold: '85%, 95%', 
      notifyMethod: '邮件', 
      receivers: '存储管理员' 
    },
    { 
      type: '单资源费用异常', 
      threshold: '增长>20%', 
      notifyMethod: '系统通知', 
      receivers: '资源负责人' 
    },
    { 
      type: '预计超支', 
      threshold: '高风险', 
      notifyMethod: '邮件,短信', 
      receivers: '财务总监' 
    },
  ];
  
  // 模拟历史预算数据
  const historyData = [
    { 
      period: '2023年6月', 
      budget: 58000.00, 
      actual: 56789.12, 
      usageRate: 97.9, 
      status: '正常' 
    },
    { 
      period: '2023年5月', 
      budget: 55000.00, 
      actual: 57123.45, 
      usageRate: 103.9, 
      status: '超支' 
    },
    { 
      period: '2023年4月', 
      budget: 52000.00, 
      actual: 51234.56, 
      usageRate: 98.5, 
      status: '正常' 
    },
    { 
      period: '2023年3月', 
      budget: 50000.00, 
      actual: 48765.32, 
      usageRate: 97.5, 
      status: '正常' 
    },
  ];
  
  const budgetColumns = [
    { title: '类别', dataIndex: 'category', key: 'category' },
    { 
      title: '预算金额(元)', 
      dataIndex: 'budget', 
      key: 'budget',
      render: value => <span style={{ fontWeight: 'bold' }}>¥{value}</span>
    },
    { 
      title: '已使用(元)', 
      dataIndex: 'used', 
      key: 'used',
      render: value => <span>¥{value}</span>
    },
    { 
      title: '剩余(元)', 
      dataIndex: 'remaining', 
      key: 'remaining',
      render: value => <span>¥{value}</span>
    },
    { 
      title: '使用率', 
      dataIndex: 'usageRate', 
      key: 'usageRate',
      render: value => {
        let status = 'normal';
        if (value > 90) {
          status = 'exception';
        } else if (value > 70) {
          status = 'active';
        }
        return (
          <div>
            <span style={{ marginRight: 8 }}>{value}%</span>
            <Progress 
              percent={value} 
              status={status} 
              size="small" 
              style={{ width: 120 }}
            />
          </div>
        );
      }
    },
  ];
  
  const alertColumns = [
    { title: '告警类型', dataIndex: 'type', key: 'type' },
    { title: '阈值', dataIndex: 'threshold', key: 'threshold' },
    { 
      title: '通知方式', 
      dataIndex: 'notifyMethod', 
      key: 'notifyMethod',
      render: value => {
        const methods = value.split(',');
        return (
          <>
            {methods.map(method => (
              <Tag key={method} color="blue">{method}</Tag>
            ))}
          </>
        );
      }
    },
    { title: '接收人', dataIndex: 'receivers', key: 'receivers' },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space size="middle">
          <a>编辑</a>
        </Space>
      ),
    },
  ];
  
  const historyColumns = [
    { title: '周期', dataIndex: 'period', key: 'period' },
    { 
      title: '预算金额(元)', 
      dataIndex: 'budget', 
      key: 'budget',
      render: value => <span>¥{value.toFixed(2)}</span>
    },
    { 
      title: '实际费用(元)', 
      dataIndex: 'actual', 
      key: 'actual',
      render: value => <span>¥{value.toFixed(2)}</span>
    },
    { 
      title: '使用率', 
      dataIndex: 'usageRate', 
      key: 'usageRate',
      render: value => `${value}%`
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: value => {
        const color = value === '正常' ? 'green' : 'red';
        return <Tag color={color}>{value}</Tag>;
      }
    },
  ];
  
  return (
    <div>
      <Breadcrumb>
        <Breadcrumb.Item>首页</Breadcrumb.Item>
        <Breadcrumb.Item>费用管理</Breadcrumb.Item>
        <Breadcrumb.Item>预算管理</Breadcrumb.Item>
      </Breadcrumb>
      
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 16, marginRight: 16 }}>当前周期: {currentPeriod}</span>
            <Button type="primary" icon={<EditOutlined />} style={{ marginRight: 8 }}>
              预算设置
            </Button>
            <Button type="primary" icon={<BellOutlined />}>
              告警设置
            </Button>
          </div>
          <div>
            <Button type="primary" icon={<PlusOutlined />}>
              新增预算
            </Button>
          </div>
        </div>
        
        {/* 预算执行情况 */}
        <Card title="预算执行情况" className={styles.card}>
          <Table 
            columns={budgetColumns} 
            dataSource={budgetData} 
            rowKey="category" 
            pagination={false} 
            loading={store.loading}
          />
        </Card>
        
        {/* 预算使用趋势和预测 */}
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card title="预算使用趋势" className={styles.card}>
              <div className={styles.chartContainer} style={{ height: 250 }}>
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5'
                }}>
                  <div>模拟预算使用趋势图</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 16 }}>
                <Statistic title="日均消耗" value="¥1,522.63" />
                <Statistic title="剩余天数" value="9天" />
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="预算使用预测" className={styles.card}>
              <div className={styles.chartContainer} style={{ height: 250 }}>
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5'
                }}>
                  <div>模拟预算使用预测图</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 16 }}>
                <Statistic title="预计月底使用率" value="98.5%" />
                <Statistic title="预计超支风险" value="中" valueStyle={{ color: '#faad14' }} />
              </div>
            </Card>
          </Col>
        </Row>
        
        {/* 预算告警设置 */}
        <Card title="预算告警设置" className={styles.card} style={{ marginTop: 16 }}>
          <Table 
            columns={alertColumns} 
            dataSource={alertData} 
            rowKey="type" 
            pagination={false} 
          />
        </Card>
        
        {/* 历史预算执行 */}
        <Card title="历史预算执行" className={styles.card} style={{ marginTop: 16 }}>
          <Table 
            columns={historyColumns} 
            dataSource={historyData} 
            rowKey="period" 
            pagination={{ pageSize: 5 }} 
          />
        </Card>
      </div>
    </div>
  );
}) 