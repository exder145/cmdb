/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import { observable, computed } from 'mobx';
import http from 'libs/http';
import moment from 'moment';

// 添加错误处理的导入JSON函数
const safeImport = (path) => {
  try {
    // 直接使用require动态导入
    return require(`./data/${path}`);
  } catch (error) {
    console.error(`导入${path}失败:`, error);
    return []; // 返回空数组防止后续代码报错
  }
};

// 导入真实费用数据
const bccCostData = safeImport('bcccost_monthly.json');
const cdsCostData = safeImport('cdscost_monthly.json');
const eipCostData = safeImport('eipcost_monthly.json');

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
  
  // 取消API请求的控制器
  abortController = null;
  
  // 真实数据映射
  realData = {
    ecs: bccCostData || [],
    disk: cdsCostData || [],
    ip: eipCostData || [],
    all: [...(bccCostData || []), ...(cdsCostData || []), ...(eipCostData || [])]
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
      case 'all': // 将future改为all，代表全部数据
        startDate = moment('2000-01-01'); // 设置一个非常早的日期作为开始
        endDate = moment('2100-12-31'); // 设置一个非常晚的日期作为结束
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
  
  
  // 计算环比变化
  calculateMonthlyChange = (currentItem) => {
    if (!currentItem || !currentItem.month) return 0;
    
    const currentMonth = moment(currentItem.month);
    const lastMonth = currentMonth.clone().subtract(1, 'month').format('YYYY-MM');
    
    // 在相同数据源中查找上月同一实例的费用
    const dataSource = this.currentAssetType === 'all' ? 'all' : this.currentAssetType;
    if (!this.realData[dataSource]) {
      return 0;
    }
    
    const lastMonthData = this.realData[dataSource]
      .find(item => item.instanceid === currentItem.instanceid && item.month === lastMonth);
    
    if (!lastMonthData) return 0;
    
    const currentCost = parseFloat(currentItem.financePrice || 0);
    const lastCost = parseFloat(lastMonthData.financePrice || 0);
    
    if (lastCost === 0) return 0;
    return Number(((currentCost - lastCost) / lastCost * 100).toFixed(2));
  }
  
  fetchCostData = (assetType = this.currentAssetType) => {
    this.loading = true;
    
    // 取消先前的请求
    if (this.abortController) {
      this.abortController.abort();
    }
    
    // 创建新的控制器
    this.abortController = new AbortController();
    
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        // 只有当控制器没有被中止时才执行
        if (!this.abortController.signal.aborted) {
          this.loading = false;
          
          // 使用真实数据
          let rawData;
          let resourceType = '';
          
          try {
            switch(assetType) {
              case 'ecs':
                rawData = bccCostData || [];
                resourceType = 'ECS实例';
                break;
              case 'disk':
                rawData = cdsCostData || [];
                resourceType = '云盘';
                break;
              case 'ip':
                rawData = eipCostData || [];
                resourceType = '弹性IP';
                break;
              default:
                // 为all类型，需要合并多个数据源并为每个数据源中的项目设置对应的资源类型
                const ecsData = (bccCostData || []).map(item => ({...item, _resourceType: 'ECS实例'}));
                const diskData = (cdsCostData || []).map(item => ({...item, _resourceType: '云盘'}));
                const ipData = (eipCostData || []).map(item => ({...item, _resourceType: '弹性IP'}));
                rawData = [...ecsData, ...diskData, ...ipData];
                break;
            }
            
            console.log(`获取${assetType}数据，数据长度:`, rawData.length);
            
            // 处理数据
            const processedData = assetType !== 'all' 
              ? this.processDataWithType(rawData, resourceType)
              : rawData.map(item => {
                  // 使用真实的费用数据，确保数据存在
                  const cost = item.financePrice ? parseFloat(item.financePrice).toFixed(2) : "0.00";
                  
                  // 计算环比变化
                  const change = this.calculateMonthlyChange(item);
                  
                  // 构建标准化的数据结构，使用_resourceType字段
                  return {
                    id: item.instanceid || '',
                    name: item.instance_name || item.instanceid || '',
                    type: item._resourceType || '未知类型',
                    month: item.month || moment().format('YYYY-MM'),
                    billingType: item.productType || '',
                    billingTypeName: item.productType === 'prepay' ? '包年包月' : '按量付费',
                    cost: cost,
                    change: change
                  };
                });
            
            // 根据计费方式筛选
            let filteredData = processedData;
            if (this.billingType !== 'all') {
              filteredData = processedData.filter(item => item.billingType === this.billingType);
            }
            
            // 根据时间范围筛选
            let { startDate, endDate } = this.timeRangeObj;
            
            // 根据时间范围筛选
            filteredData = filteredData.filter(item => {
              if (!item.month) return true;
              const itemDate = moment(item.month);
              return itemDate.isBetween(startDate, endDate, 'month', '[]');
            });
            
            // 根据搜索关键词筛选
            if (this.searchKey) {
              const key = this.searchKey.toLowerCase();
              filteredData = filteredData.filter(item => 
                (item.id && item.id.toLowerCase().includes(key)) || 
                (item.name && item.name.toLowerCase().includes(key))
              );
            }
            
            // 排序
            filteredData.sort((a, b) => {
              if (a.month !== b.month) {
                return this.sortOrder === 'desc' ? 
                  moment(b.month).valueOf() - moment(a.month).valueOf() :
                  moment(a.month).valueOf() - moment(b.month).valueOf();
              }
              const costA = parseFloat(a.cost);
              const costB = parseFloat(b.cost);
              return this.sortOrder === 'desc' ? costB - costA : costA - costB;
            });
            
            this.records = filteredData;
            console.log(`最终筛选后数据长度:`, filteredData.length);
          } catch (error) {
            console.error('处理数据时出错:', error);
            this.records = [];
          }
          
          resolve(this.records);
        }
      }, 100);
      
      // 当请求取消时清除定时器
      this.abortController.signal.addEventListener('abort', () => {
        clearTimeout(timer);
      });
    });
  }
  
  // 根据指定类型处理数据的方法
  processDataWithType = (data, resourceType) => {
    if (!data || !Array.isArray(data)) {
      console.error('处理的数据不是数组:', data);
      return [];
    }
    
    return data.map(item => {
      // 使用真实的费用数据，确保数据存在
      const cost = item.financePrice ? parseFloat(item.financePrice).toFixed(2) : "0.00";
      
      // 计算环比变化
      const change = this.calculateMonthlyChange(item);
      
      // 构建标准化的数据结构，直接使用指定的资源类型
      return {
        id: item.instanceid || '',
        name: item.instance_name || item.instanceid || '',
        type: resourceType,
        month: item.month || moment().format('YYYY-MM'),
        billingType: item.productType || '',
        billingTypeName: item.productType === 'prepay' ? '包年包月' : '按量付费',
        cost: cost,
        change: change
      };
    });
  }
  
  // 清理方法，在组件卸载时调用
  dispose = () => {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
  
  fetchBudgetData = () => {
    this.loading = true;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        this.loading = false;
        
        // 计算真实数据的总费用
        const totalEcsCost = this.realData.ecs.reduce((sum, item) => sum + parseFloat(item.financePrice || 0), 0);
        const totalDiskCost = this.realData.disk.reduce((sum, item) => sum + parseFloat(item.financePrice || 0), 0);
        const totalIpCost = this.realData.ip.reduce((sum, item) => sum + parseFloat(item.financePrice || 0), 0);
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
  
  hideDetail = () => {
    this.detailVisible = false;
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