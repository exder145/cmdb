/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import { observable, computed, action } from 'mobx';
import http from 'libs/http';
import moment from 'moment';

// 从localStorage加载持久化状态的函数
const loadFromLocalStorage = (key, defaultValue) => {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      return JSON.parse(storedValue);
    }
  } catch (e) {
    console.warn(`从localStorage加载${key}失败:`, e);
  }
  return defaultValue;
};

// 保存状态到localStorage的函数
const saveToLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`保存${key}到localStorage失败:`, e);
  }
};

class Store {
  // 初始化状态，从localStorage加载
  @observable loading = false;
  @observable records = loadFromLocalStorage('cost_records', []);
  @observable total = loadFromLocalStorage('cost_total', 0);
  @observable currentPage = loadFromLocalStorage('cost_currentPage', 1);
  @observable pageSize = loadFromLocalStorage('cost_pageSize', 10);
  @observable record = {};
  @observable formVisible = false;
  @observable detailVisible = false;
  @observable currentAssetType = loadFromLocalStorage('cost_currentAssetType', 'all');
  @observable timeRange = loadFromLocalStorage('cost_timeRange', 'current');
  @observable billingType = loadFromLocalStorage('cost_billingType', 'all');
  @observable sortOrder = loadFromLocalStorage('cost_sortOrder', 'desc');
  @observable searchKey = loadFromLocalStorage('cost_searchKey', '');
  @observable customDateRange = loadFromLocalStorage('cost_customDateRange', {startDate: '', endDate: ''});
  @observable costStats = loadFromLocalStorage('cost_stats', { statsForType: [], statsForMonth: [] });
  
  // 缓存上次获取数据的时间戳
  lastFetchTimestamp = loadFromLocalStorage('cost_lastFetchTimestamp', 0);
  // 缓存过期时间（毫秒）- 设置为5分钟
  cacheExpiryTime = 5 * 60 * 1000;
  
  // 取消API请求的控制器
  abortController = null;
  
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
      case 'all': // 将future改为all，代表全部数据
        startDate = moment('2000-01-01'); // 设置一个非常早的日期作为开始
        endDate = moment('2100-12-31'); // 设置一个非常晚的日期作为结束
        break;
      case 'custom': // 处理自定义日期范围
        startDate = this.customDateRange.startDate ? moment(this.customDateRange.startDate) : now.clone().startOf('month');
        endDate = this.customDateRange.endDate ? moment(this.customDateRange.endDate) : now.clone().endOf('month');
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
  
  // 从API获取费用数据
  fetchCostData = (assetType = this.currentAssetType, pagination = {}) => {
    // 检查是否可以使用缓存数据
    const now = Date.now();
    const cacheStillValid = now - this.lastFetchTimestamp < this.cacheExpiryTime;
    
    // 如果有缓存且缓存有效，且查询参数未变化，则使用缓存数据
    if (cacheStillValid && 
        this.records.length > 0 && 
        assetType === this.currentAssetType &&
        pagination.page === this.currentPage &&
        pagination.pageSize === this.pageSize) {
      console.log('使用缓存的费用数据');
      return Promise.resolve(this.records);
    }
    
    this.loading = true;
    
    // 取消先前的请求
    if (this.abortController) {
      this.abortController.abort();
    }
    
    // 创建新的控制器
    this.abortController = new AbortController();
    
    // 准备API查询参数
    const params = {
      limit: pagination.pageSize || this.pageSize,
      offset: ((pagination.page || this.currentPage) - 1) * (pagination.pageSize || this.pageSize),
      resource_type: assetType === 'all' ? '' : this.getResourceType(assetType),
      product_type: this.billingType === 'all' ? '' : this.billingType,
      sort_by: this.sortOrder === 'desc' ? '-finance_price' : 'finance_price'
    };
    
    // 如果用户点击了时间列进行排序，则更改排序字段为month
    if (pagination.sortField === 'month') {
      params.sort_by = pagination.sortOrder === 'descend' ? '-month' : 'month';
    }
    // 如果用户点击了费用金额列进行排序，则更改排序字段为finance_price
    else if (pagination.sortField === 'cost') {
      params.sort_by = pagination.sortOrder === 'descend' ? '-finance_price' : 'finance_price';
      // 同步更新下拉框选择
      this.sortOrder = pagination.sortOrder === 'descend' ? 'desc' : 'asc';
    }
    
    // 如果有时间范围
    if (this.timeRange !== 'all') {
      const { startDate, endDate } = this.timeRangeObj;
      
      // 处理自定义日期范围
      if (this.timeRange === 'custom') {
        params.start_date = startDate;
        params.end_date = endDate;
      } else {
        // 对于其他时间范围，如果起始月和结束月相同，则使用month参数
        const startMonth = moment(startDate).format('YYYY-MM');
        if (startMonth === moment(endDate).format('YYYY-MM')) {
          params.month = startMonth;
        }
      }
    }
    
    // 如果有搜索关键词
    if (this.searchKey) {
      params.search = this.searchKey;
    }
    
    console.log('发送API请求参数:', params);
    
    // 修复 process is not defined 错误
    const signal = this.abortController ? this.abortController.signal : undefined;
    
    // 从API获取数据
    return http.get('/api/host/cost/', { params, signal })
      .then(response => {
        if (!response || !response.data) {
          throw new Error('API返回数据格式错误');
        }
        
        const { total, data } = response;
        console.log(`API返回数据: 总数=${total}, 当前页数据数量=${data.length}`);
        
        // 处理API返回的数据
        const processedData = data.map(item => ({
          id: item.instance_id,
          name: item.instance_name || item.instance_id,
          type: item.resource_type,
          month: item.month,
          billingType: item.product_type,
          billingTypeName: item.product_type === 'prepay' ? '包年包月' : '按量付费',
          cost: parseFloat(item.finance_price).toFixed(2),
          change: item.change || 0  // 使用API返回的环比变化值
        }));
        
        // 添加数据去重逻辑，以避免重复显示相同的记录
        const uniqueMap = new Map();
        const uniqueData = [];
        
        processedData.forEach(record => {
          // 使用实例ID+月份+资源类型作为唯一键
          const uniqueKey = `${record.id}-${record.month}-${record.type}`;
          if (!uniqueMap.has(uniqueKey)) {
            uniqueMap.set(uniqueKey, true);
            uniqueData.push(record);
          } else {
            console.log(`发现重复数据，已去除: ${record.name}, ${record.month}`);
          }
        });
        
        console.log(`去重后数据: 总数=${uniqueData.length}, 移除了${processedData.length - uniqueData.length}条重复记录`);
        
        // 更新状态
        this.records = uniqueData;
        this.total = total - (processedData.length - uniqueData.length); // 调整总数以反映实际可用记录数
        this.currentPage = pagination.page || this.currentPage;
        this.pageSize = pagination.pageSize || this.pageSize;
        this.loading = false;
        
        // 更新缓存时间戳
        this.lastFetchTimestamp = Date.now();
        
        // 保存状态到localStorage
        saveToLocalStorage('cost_records', uniqueData);
        saveToLocalStorage('cost_total', this.total);
        saveToLocalStorage('cost_currentPage', this.currentPage);
        saveToLocalStorage('cost_pageSize', this.pageSize);
        saveToLocalStorage('cost_lastFetchTimestamp', this.lastFetchTimestamp);
        
        return uniqueData;
      })
      .catch(error => {
        // 忽略取消请求的错误
        if (error.name === 'AbortError') {
          console.log('请求被取消');
          return [];
        }
        
        console.error('获取费用数据失败:', error);
        this.loading = false;
        
        // 简化为直接返回空数据
        this.records = [];
        this.total = 0;
        return [];
      });
  }
  
  // 获取资源类型
  getResourceType = (assetType) => {
    const resourceTypeMap = {
      'ecs': 'ECS实例',
      'disk': '云盘',
      'ip': '弹性IP'
    };
    return resourceTypeMap[assetType] || '';
  }
  
  // 获取费用统计数据
  fetchCostStats = (month = '') => {
    // 检查是否可以使用缓存数据
    const now = Date.now();
    const cacheStillValid = now - this.lastFetchTimestamp < this.cacheExpiryTime;
    
    if (cacheStillValid && this.costStats.statsForType.length > 0) {
      console.log('使用缓存的统计数据');
      return Promise.resolve(this.costStats);
    }
    
    const params = {};
    if (month) {
      params.month = month;
    }
    
    return http.get('/api/host/cost/stats/', {params})
      .then(({stats_by_type, stats_by_month}) => {
        // 处理统计数据
        const statsForType = stats_by_type.map(item => ({
          type: item.type,
          count: item.count,
          cost: item.total_cost
        }));
        
        const statsForMonth = stats_by_month.map(item => ({
          month: item.month,
          cost: item.total_cost
        }));
        
        // 更新状态
        this.costStats = {
          statsForType,
          statsForMonth
        };
        
        // 保存到localStorage
        saveToLocalStorage('cost_stats', this.costStats);
        
        return this.costStats;
      })
      .catch(error => {
        console.error('获取费用统计数据失败:', error);
        return { statsForType: [], statsForMonth: [] };
      });
  }
  
  // 获取最新一年的高费用资源（Top 5）
  fetchTopResources = () => {
    // 获取最近一年的时间范围
    const endDate = moment();
    const startDate = moment().subtract(1, 'year');
    
    const params = {
      limit: 200, // 获取足够多的数据，以便在前端筛选出Top资源和计算环比
      start_date: startDate.format('YYYY-MM-DD'),
      end_date: endDate.format('YYYY-MM-DD'),
      sort_by: '-finance_price' // 按费用降序排序
    };
    
    return http.get('/api/host/cost/', { params })
      .then(response => {
        if (!response || !response.data) {
          throw new Error('API返回数据格式错误');
        }
        
        const { data } = response;
        
        // 按实例ID分组，并按月份整理数据
        const resourceMap = {};
        data.forEach(item => {
          const key = item.instance_id;
          if (!resourceMap[key]) {
            resourceMap[key] = {
              id: item.instance_id,
              name: item.instance_name || item.instance_id,
              type: item.resource_type,
              billingType: item.product_type,
              billingTypeName: item.product_type === 'prepay' ? '包年包月' : '按量付费',
              cost: 0,
              monthlyData: {} // 存储每月数据，用于计算环比
            };
          }
          
          // 累加总费用
          resourceMap[key].cost += parseFloat(item.finance_price);
          
          // 记录月度数据
          if (item.month) {
            if (!resourceMap[key].monthlyData[item.month]) {
              resourceMap[key].monthlyData[item.month] = 0;
            }
            resourceMap[key].monthlyData[item.month] += parseFloat(item.finance_price);
          }
        });
        
        // 计算环比变化
        const currentMonth = moment().format('YYYY-MM');
        const lastMonth = moment().subtract(1, 'month').format('YYYY-MM');
        
        Object.values(resourceMap).forEach(resource => {
          const currentMonthCost = resource.monthlyData[currentMonth] || 0;
          const lastMonthCost = resource.monthlyData[lastMonth] || 0;
          
          if (lastMonthCost > 0) {
            resource.change = Number(((currentMonthCost - lastMonthCost) / lastMonthCost * 100).toFixed(2));
          } else {
            resource.change = currentMonthCost > 0 ? 100 : 0;
          }
        });
        
        // 转换为数组并排序
        const resourceList = Object.values(resourceMap);
        const sortedList = resourceList.sort((a, b) => b.cost - a.cost);
        
        // 格式化费用并返回Top 5
        return sortedList.slice(0, 5).map(item => ({
          id: item.id,
          name: item.name,
          type: item.type,
          billingType: item.billingType,
          billingTypeName: item.billingTypeName,
          cost: item.cost.toFixed(2),
          change: item.change
        }));
      })
      .catch(error => {
        console.error('获取高费用资源数据失败:', error);
        return [];
      });
  }
  
  // todo 费用概览 获取预算数据  

  fetchBudgetData = () => {
    // 使用模拟数据，因为后端没有预算API
    // 返回预算数据的Promise
    return Promise.resolve([
      { 
        category: 'ECS实例',
        budget: 200000,
        spent: 196901.54,
        percentage: 98.45
      },
      { 
        category: '云盘',
        budget: 70000,
        spent: 65633.18,
        percentage: 93.76
      },
      { 
        category: '弹性IP',
        budget: 30000,
        spent: 28123.29,
        percentage: 93.74
      }
    ]);
  }
  
  // 显示详细信息
  showDetail = (record) => {
    this.record = record;
    this.detailVisible = true;
  }
  
  // 设置资源类型
  @action
  setAssetType = (type) => {
    this.currentAssetType = type;
    saveToLocalStorage('cost_currentAssetType', type);
  }
  
  // 设置时间范围
  @action
  setTimeRange = (range) => {
    this.timeRange = range;
    saveToLocalStorage('cost_timeRange', range);
  }
  
  // 设置计费方式
  @action
  setBillingType = (type) => {
    this.billingType = type;
    saveToLocalStorage('cost_billingType', type);
  }
  
  // 设置排序方式
  @action
  setSortOrder = (order) => {
    this.sortOrder = order;
    saveToLocalStorage('cost_sortOrder', order);
  }
  
  // 设置搜索关键词
  @action
  setSearchKey = (key) => {
    this.searchKey = key;
    saveToLocalStorage('cost_searchKey', key);
    this.fetchCostData();
  }
  
  // 设置当前页码
  @action
  setCurrentPage = (page) => {
    this.currentPage = page;
    saveToLocalStorage('cost_currentPage', page);
  }
  
  // 设置每页显示的记录数
  @action
  setPageSize = (size) => {
    this.pageSize = size;
    saveToLocalStorage('cost_pageSize', size);
  }
  
  // 设置自定义日期范围
  @action
  setCustomDateRange = (startDate, endDate) => {
    this.timeRange = 'custom';
    this.customDateRange = { startDate, endDate };
    saveToLocalStorage('cost_timeRange', 'custom');
    saveToLocalStorage('cost_customDateRange', this.customDateRange);
  }
  
  // 清理方法，在组件卸载时调用
  dispose = () => {
    // 取消API请求
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

export default new Store(); 