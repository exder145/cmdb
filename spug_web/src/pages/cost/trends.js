/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { Card, Row, Col, Select, Radio, Divider } from 'antd';
import { Breadcrumb } from 'components';
import styles from './index.module.less';
import store from './store';

const { Option } = Select;

export default observer(function () {
  useEffect(() => {
    store.setTimeRange('6months');
    store.fetchCostData();
  }, []);

  const handleTimeRangeChange = (value) => {
    store.setTimeRange(value);
    store.fetchCostData();
  };

  const handleResourceTypeChange = (value) => {
    store.setAssetType(value);
    store.fetchCostData(value);
  };

  const handleBillingTypeChange = (value) => {
    store.setBillingType(value);
    store.fetchCostData();
  };
  
  return (
    <div>
      <Breadcrumb>
        <Breadcrumb.Item>首页</Breadcrumb.Item>
        <Breadcrumb.Item>费用管理</Breadcrumb.Item>
        <Breadcrumb.Item>费用趋势分析</Breadcrumb.Item>
      </Breadcrumb>
      
      <div className={styles.container}>
        <div className={styles.filterBar}>
          <div className={styles.filterItem}>
            <span style={{ marginRight: 8 }}>时间范围:</span>
            <Select 
              value={store.timeRange} 
              onChange={handleTimeRangeChange} 
              style={{ width: 120 }}
            >
              <Option value="3months">近3个月</Option>
              <Option value="6months">近6个月</Option>
              <Option value="12months">近1年</Option>
              <Option value="custom">自定义</Option>
            </Select>
          </div>
          
          <div className={styles.filterItem}>
            <span style={{ marginRight: 8 }}>资源类型:</span>
            <Select 
              value={store.currentAssetType} 
              onChange={handleResourceTypeChange} 
              style={{ width: 120 }}
            >
              <Option value="all">全部</Option>
              <Option value="ecs">ECS实例</Option>
              <Option value="disk">云盘</Option>
              <Option value="ip">弹性IP</Option>
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
        </div>
        
        {/* 总费用趋势图 */}
        <Card title="总费用趋势" className={styles.card}>
          <div className={styles.chartContainer}>
            <div style={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center' 
            }}>
              <div style={{ fontSize: 16, marginBottom: 20 }}>这里将显示总费用趋势图表</div>
              <div style={{ width: '80%', height: 300, backgroundColor: '#f5f5f5', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>模拟费用趋势图</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: 600 }}>
                    <div>1月</div>
                    <div>2月</div>
                    <div>3月</div>
                    <div>4月</div>
                    <div>5月</div>
                    <div>6月</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 20 }}>
                <Radio.Group defaultValue="total">
                  <Radio.Button value="total">总费用</Radio.Button>
                  <Radio.Button value="ecs">ECS实例</Radio.Button>
                  <Radio.Button value="disk">云盘</Radio.Button>
                  <Radio.Button value="ip">弹性IP</Radio.Button>
                </Radio.Group>
              </div>
            </div>
          </div>
        </Card>
        
        {/* 资源类型费用趋势 */}
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card title="ECS实例费用趋势" className={styles.card}>
              <div className={styles.chartContainer} style={{ height: 250 }}>
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5'
                }}>
                  <div>模拟ECS实例费用趋势图</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="云盘费用趋势" className={styles.card}>
              <div className={styles.chartContainer} style={{ height: 250 }}>
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5'
                }}>
                  <div>模拟云盘费用趋势图</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
        
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card title="弹性IP费用趋势" className={styles.card}>
              <div className={styles.chartContainer} style={{ height: 250 }}>
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5'
                }}>
                  <div>模拟弹性IP费用趋势图</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="费用预测(未来3个月)" className={styles.card}>
              <div className={styles.chartContainer} style={{ height: 250 }}>
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5'
                }}>
                  <div>模拟费用预测图</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
        
        {/* 费用增长分析 */}
        <Card style={{ marginTop: 16 }}>
          <Divider orientation="left">费用增长分析</Divider>
          <ul>
            <li>云盘费用在3月份增长显著，主要由于新增了高性能存储v-4zdR4Z1G</li>
            <li>弹性IP费用在5月份增长，主要由于ip-d321353e国际带宽使用增加</li>
            <li>预计下季度总费用将增长约5%，主要由于ECS实例使用量增加</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}) 