/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import { observable, computed } from 'mobx';
import http from 'libs/http';
import moment from 'moment';

// 导入真实费用数据
import bccCostData from '../../data/bcccost_monthly.json';
import cdsCostData from '../../data/cdscost_monthly.json';
import eipCostData from '../../data/eipcost_monthly.json';

class Store {
  @observable loading = false;
  @observable records = [];
  @observable record = {};
  @observable formVisible = false;
  @observable detailVisible = false;
  @observable currentAssetType = 'all';
  @observable timeRange = 'current';
  @observable billingType = 'all';
  @observable sortOrder = 'desc';
  @observable searchKey = '';
  
  // 真实数据映射
  realData = {
    ecs: bccCostData,
    disk: cdsCostData,
    ip: eipCostData,
    all: [...bccCostData, ...cdsCostData, ...eipCostData]
  };
  
  @computed get timeRangeObj() {
    let startDate, endDate;
    const now = moment();
    
    switch (this.timeRange) {
      case 'current':
        startDate = now.clone().startOf('month');
        endDate = now.clone().endOf('month');
        break;
      case 'last':
        startDate = now.clone().subtract(1, 'months').startOf('month');
        endDate = now.clone().subtract(1, 'months').endOf('month');
        break;
      case 'quarter':
        startDate = now.clone().startOf('quarter');
        endDate = now.clone().endOf('quarter');
        break;
      case '3months':
        startDate = now.clone().subtract(3, 'months').startOf('day');
        endDate = now.clone().endOf('day');
        break;
      case '6months':
        startDate = now.clone().subtract(6, 'months').startOf('day');
        endDate = now.clone().endOf('day');
        break;
      case '12months':
        startDate = now.clone().subtract(12, 'months').startOf('day');
        endDate = now.clone().endOf('day');
        break;
      default:
        startDate = now.clone().startOf('month');
        endDate = now.clone().endOf('month');
    }
    
    return {
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD')
    };
  }
  
  // 处理真实数据
  processRealData = (data) => {
    return data.map(item => {
      // 根据资源ID判断资源类型
      let type = 'ECS实例';
      if (item.instanceid.startsWith('v-') || item.instanceid.startsWith('sl-')) {
        type = '云盘';
      } else if (item.instanceid.startsWith('ip-')) {
        type = '弹性IP';
      }
      
      // 使用真实的费用数据
      const cost = parseFloat(item.financePrice).toFixed(2);
      
      // 构建标准化的数据结构
      return {
        id: item.instanceid,
        name: item.instance_name || item.instanceid,
        type: type,
        billingType: item.productType,
        billingTypeName: item.productType === 'prepay' ? '包年包月' : '按量付费',
        cost: cost,
        change: 0  // 暂时将环比变化设为0，后续可以通过对比上月数据计算
      };
    });
  }
  
  fetchCostData = (assetType = this.currentAssetType) => {
    this.loading = true;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        this.loading = false;
        
        // 使用真实数据
        let rawData;
        switch(assetType) {
          case 'ecs':
            rawData = bccCostData;
            break;
          case 'disk':
            rawData = cdsCostData;
            break;
          case 'ip':
            rawData = eipCostData;
            break;
          default:
            rawData = [...bccCostData, ...cdsCostData, ...eipCostData];
        }
        
        const processedData = this.processRealData(rawData);
        
        // 根据计费方式筛选
        let filteredData = processedData;
        if (this.billingType !== 'all') {
          filteredData = processedData.filter(item => item.billingType === this.billingType);
        }
        
        // 根据搜索关键词筛选
        if (this.searchKey) {
          const key = this.searchKey.toLowerCase();
          filteredData = filteredData.filter(item => 
            item.id.toLowerCase().includes(key) || 
            (item.name && item.name.toLowerCase().includes(key))
          );
        }
        
        // 排序
        filteredData.sort((a, b) => {
          const costA = parseFloat(a.cost);
          const costB = parseFloat(b.cost);
          return this.sortOrder === 'desc' ? costB - costA : costA - costB;
        });
        
        this.records = filteredData;
        resolve(this.records);
      }, 100);  // 减少延迟时间以提高响应速度
    });
  }
  
  fetchBudgetData = () => {
    this.loading = true;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        this.loading = false;
        
        // 计算真实数据的总费用
        const totalEcsCost = this.realData.ecs.reduce((sum, item) => sum + parseFloat(item.financePrice), 0);
        const totalDiskCost = this.realData.disk.reduce((sum, item) => sum + parseFloat(item.financePrice), 0);
        const totalIpCost = this.realData.ip.reduce((sum, item) => sum + parseFloat(item.financePrice), 0);
        const totalCost = totalEcsCost + totalDiskCost + totalIpCost;
        
        // 设置预算上限（模拟数据，实际应从后端获取）
        const totalBudget = totalCost * 1.3;
        const ecsBudget = totalEcsCost * 1.3;
        const diskBudget = totalDiskCost * 1.3;
        const ipBudget = totalIpCost * 1.3;
        
        // 计算使用率
        const totalUsageRate = (totalCost / totalBudget * 100).toFixed(1);
        const ecsUsageRate = (totalEcsCost / ecsBudget * 100).toFixed(1);
        const diskUsageRate = (totalDiskCost / diskBudget * 100).toFixed(1);
        const ipUsageRate = (totalIpCost / ipBudget * 100).toFixed(1);
        
        // 构建预算数据
        const budgetData = [
          { 
            category: '总预算', 
            budget: totalBudget.toFixed(2), 
            used: totalCost.toFixed(2), 
            remaining: (totalBudget - totalCost).toFixed(2), 
            usageRate: parseFloat(totalUsageRate)
          },
          { 
            category: 'ECS实例', 
            budget: ecsBudget.toFixed(2), 
            used: totalEcsCost.toFixed(2), 
            remaining: (ecsBudget - totalEcsCost).toFixed(2), 
            usageRate: parseFloat(ecsUsageRate)
          },
          { 
            category: '云盘', 
            budget: diskBudget.toFixed(2), 
            used: totalDiskCost.toFixed(2), 
            remaining: (diskBudget - totalDiskCost).toFixed(2), 
            usageRate: parseFloat(diskUsageRate)
          },
          { 
            category: '弹性IP', 
            budget: ipBudget.toFixed(2), 
            used: totalIpCost.toFixed(2), 
            remaining: (ipBudget - totalIpCost).toFixed(2), 
            usageRate: parseFloat(ipUsageRate)
          },
        ];
        
        resolve(budgetData);
      }, 500);
    });
  }
  
  showForm = (record = {}) => {
    this.formVisible = true;
    this.record = record;
  }
  
  showDetail = (record) => {
    this.detailVisible = true;
    this.record = record;
  }
  
  setAssetType = (type) => {
    this.currentAssetType = type;
  }
  
  setTimeRange = (range) => {
    this.timeRange = range;
  }
  
  setBillingType = (type) => {
    this.billingType = type;
  }
  
  setSortOrder = (order) => {
    this.sortOrder = order;
  }
  
  setSearchKey = (key) => {
    this.searchKey = key;
  }
}

export default new Store(); 