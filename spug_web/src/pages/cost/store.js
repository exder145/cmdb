/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import { observable, computed, action } from 'mobx';
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
  @observable total = 0;
  @observable currentPage = 1;
  @observable pageSize = 10;
  @observable record = {};
  @observable formVisible = false;
  @observable detailVisible = false;
  @observable currentAssetType = 'all';
  @observable timeRange = 'current';
  @observable billingType = 'all';
  @observable sortOrder = 'desc';
  @observable searchKey = '';
  @observable customDateRange = {startDate: '', endDate: ''};
  @observable costStats = { statsForType: [], statsForMonth: [] };
  
  // 取消API请求的控制器
  abortController = null;
  
  // 真实数据映射（作为备用）
  backupData = {
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
        
        // 更新状态
        this.records = processedData;
        this.total = total;
        this.currentPage = pagination.page || this.currentPage;
        this.pageSize = pagination.pageSize || this.pageSize;
        this.loading = false;
        
        return processedData;
      })
      .catch(error => {
        // 忽略取消请求的错误
        if (error.name === 'AbortError') {
          console.log('请求被取消');
          return [];
        }
        
        console.error('获取费用数据失败:', error);
        this.loading = false;
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
    const params = {};
    if (month) {
      params.month = month;
    }
    
    return http.get('/api/host/cost/stats/', params)
      .then(({ stats_by_type, stats_by_month }) => {
        this.costStats = {
          statsForType: stats_by_type,
          statsForMonth: stats_by_month
        };
        return this.costStats;
      })
      .catch(error => {
        console.error('获取费用统计数据失败:', error);
        return { statsForType: [], statsForMonth: [] };
      });
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
  }
  
  // 设置时间范围
  @action
  setTimeRange = (range) => {
    this.timeRange = range;
  }
  
  // 设置计费方式
  @action
  setBillingType = (type) => {
    this.billingType = type;
  }
  
  // 设置排序方式
  @action
  setSortOrder = (order) => {
    this.sortOrder = order;
  }
  
  // 设置搜索关键词
  @action
  setSearchKey = (key) => {
    this.searchKey = key;
    this.fetchCostData();
  }
  
  // 设置当前页码
  @action
  setCurrentPage = (page) => {
    this.currentPage = page;
  }
  
  // 设置每页显示的记录数
  @action
  setPageSize = (size) => {
    this.pageSize = size;
  }
  
  // 设置自定义日期范围
  @action
  setCustomDateRange = (startDate, endDate) => {
    this.timeRange = 'custom';
    this.customDateRange = { startDate, endDate };
  }
  
  // 清理方法，在组件卸载时调用
  dispose = () => {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
  
  // 处理真实数据 - 此方法已弃用，请使用processDataWithType方法
  processRealData = (data) => {
    console.warn('processRealData方法已弃用，请使用processDataWithType方法');
    return [];
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
  
  // 计算环比变化 (仅用于本地数据)
  calculateMonthlyChange = (currentItem) => {
    if (!currentItem || !currentItem.month) return 0;
    
    const currentMonth = moment(currentItem.month);
    const lastMonth = currentMonth.clone().subtract(1, 'month').format('YYYY-MM');
    
    // 在相同数据源中查找上月同一实例的费用
    const dataSource = this.currentAssetType === 'all' ? 'all' : this.currentAssetType;
    if (!this.backupData[dataSource]) {
      return 0;
    }
    
    const lastMonthData = this.backupData[dataSource]
      .find(item => item.instanceid === currentItem.instanceid && item.month === lastMonth);
    
    if (!lastMonthData) return 0;
    
    const currentCost = parseFloat(currentItem.financePrice || 0);
    const lastCost = parseFloat(lastMonthData.financePrice || 0);
    
    if (lastCost === 0) return 0;
    return Number(((currentCost - lastCost) / lastCost * 100).toFixed(2));
  }
}

export default new Store(); 