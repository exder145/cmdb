/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import { observable, computed, toJS } from 'mobx';
import { message } from 'antd';
import { http, includes } from 'libs';

// 添加模拟数据
const mockData = {
  disk: [
    { id: 1, name: '系统盘-01', size: 100, type: 'SSD', mount_point: '/', status: 'online' },
    { id: 2, name: '数据盘-01', size: 500, type: 'HDD', mount_point: '/data', status: 'online' },
    { id: 3, name: '备份盘-01', size: 1000, type: 'HDD', mount_point: '/backup', status: 'online' },
    { id: 4, name: '系统盘-02', size: 200, type: 'SSD', mount_point: '/', status: 'online' },
    { id: 5, name: '数据盘-02', size: 800, type: 'HDD', mount_point: '/data', status: 'online' },
    { id: 6, name: '备份盘-02', size: 2000, type: 'HDD', mount_point: '/backup', status: 'online' }
  ],
  storage: [
    { id: 1, name: '对象存储-01', type: 'S3', capacity: 1000, usage: 45, status: 'online' },
    { id: 2, name: '对象存储-02', type: 'OSS', capacity: 2000, usage: 30, status: 'online' },
    { id: 3, name: '文件存储-01', type: 'NAS', capacity: 500, usage: 60, status: 'online' },
    { id: 4, name: '对象存储-03', type: 'S3', capacity: 3000, usage: 25, status: 'online' },
    { id: 5, name: '块存储-01', type: 'Block', capacity: 1500, usage: 50, status: 'online' },
    { id: 6, name: '文件存储-02', type: 'NAS', capacity: 800, usage: 40, status: 'online' }
  ],
  cdn: [
    { id: 1, name: 'CDN-01', domain: 'cdn1.example.com', type: '网页加速', bandwidth: 100, status: 'online' },
    { id: 2, name: 'CDN-02', domain: 'cdn2.example.com', type: '下载加速', bandwidth: 200, status: 'online' },
    { id: 3, name: 'CDN-03', domain: 'cdn3.example.com', type: '视频加速', bandwidth: 500, status: 'offline' },
    { id: 4, name: 'CDN-04', domain: 'cdn4.example.com', type: '网页加速', bandwidth: 150, status: 'online' },
    { id: 5, name: 'CDN-05', domain: 'cdn5.example.com', type: '下载加速', bandwidth: 300, status: 'online' },
    { id: 6, name: 'CDN-06', domain: 'cdn6.example.com', type: '视频加速', bandwidth: 800, status: 'online' }
  ],
  ip: [
    { id: 1, address: '192.168.1.1', type: 'private', region: '内网', bandwidth: null, status: 'used' },
    { id: 2, address: '10.0.0.1', type: 'private', region: '内网', bandwidth: null, status: 'used' },
    { id: 3, address: '203.0.113.1', type: 'public', region: '华北', bandwidth: 100, status: 'used' },
    { id: 4, address: '192.168.1.2', type: 'private', region: '内网', bandwidth: null, status: 'used' },
    { id: 5, address: '10.0.0.2', type: 'private', region: '内网', bandwidth: null, status: 'unused' },
    { id: 6, address: '203.0.113.2', type: 'public', region: '华东', bandwidth: 200, status: 'used' }
  ]
};

class Store {
  @observable rawTreeData = [];
  @observable rawRecords = [];
  @observable groups = {};
  @observable group = {};
  @observable record = {};
  @observable idMap = {};
  @observable addByCopy = true;
  @observable grpFetching = true;
  @observable isFetching = false;
  @observable formVisible = false;
  @observable importVisible = false;
  @observable syncVisible = false;
  @observable cloudImport = null;
  @observable detailVisible = false;
  @observable selectorVisible = false;
  @observable exportVisible = false;
  @observable currentAssetType = 'server';

  @observable f_word = '';
  @observable f_status = '';

  constructor() {
    // 确保所有可观察属性都有初始值
    this.initialize();
  }

  // 初始化方法，确保所有属性都有合法值
  initialize() {
    // 确保 group 有默认值
    if (!this.group || !this.group.key) {
      this.group = { key: 'default', title: '默认分组' };
    }
    
    // 确保 record 有默认值
    if (!this.record) {
      this.record = {};
    }
    
    // 确保 idMap 有默认值
    if (!this.idMap) {
      this.idMap = {};
    }
  }

  // 获取模拟数据
  getMockData(assetType) {
    console.log('获取模拟数据:', assetType);
    return mockData[assetType] || [];
  }

  // 更新模拟数据并触发UI更新
  updateMockData(assetType, newData) {
    mockData[assetType] = [...newData];
    // 触发UI更新
    const tmpType = this.currentAssetType;
    this.currentAssetType = '';
    setTimeout(() => {
      this.currentAssetType = tmpType;
    }, 0);
  }

  @computed get records() {
    let records = this.rawRecords;
    if (this.f_word) {
      records = records.filter(x => {
        if (includes(x.name, this.f_word)) return true
        if (x.public_ip_address && includes(x.public_ip_address[0], this.f_word)) return true
        return !!(x.private_ip_address && includes(x.private_ip_address[0], this.f_word));
      });
    }
    return records
  }

  @computed get dataSource() {
    if (this.currentAssetType === 'server') {
      return this._getServerDataSource();
    }
    return this._getAssetDataSource(this.currentAssetType);
  }

  _getServerDataSource() {
    let records = this.records;
    const host_ids = this.counter[this.group.key];
    if (host_ids) {
      records = records.filter(x => host_ids.has(x.id));
    }
    if (this.f_status) {
      records = records.filter(x => x.is_verified === (this.f_status === '1'));
    }
    return records;
  }

  _getAssetDataSource(assetType) {
    return http.get(`/api/${assetType}/`)
      .then(data => {
        if (this.f_word) {
          return data.filter(x => includes(x.name, this.f_word));
        }
        return data;
      });
  }

  @computed get counter() {
    const counter = {}
    for (let host of this.records) {
      for (let id of host.group_ids) {
        if (counter[id]) {
          counter[id].add(host.id)
        } else {
          counter[id] = new Set([host.id])
        }
      }
    }
    for (let item of this.rawTreeData) {
      this._handler_counter(item, counter)
    }
    return counter
  }

  @computed get treeData() {
    let treeData = toJS(this.rawTreeData)
    if (this.f_word) {
      treeData = this._handle_filter_group(treeData)
    }
    return treeData
  }

  // 设置当前资产类型
  setAssetType(assetType) {
    console.log('设置当前资产类型:', assetType);
    // 如果资产类型没有变化，直接返回
    if (this.currentAssetType === assetType) {
      return;
    }
    
    // 保存旧的资产类型
    const oldAssetType = this.currentAssetType;
    
    // 设置新的资产类型
    this.currentAssetType = assetType;
    
    // 重置筛选条件
    this.f_word = '';
    this.f_status = '';
    
    // 只有在资产类型变化时才设置默认分组
    if (oldAssetType !== assetType) {
      // 根据资产类型设置默认分组
      const defaultGroups = {
        server: { key: 'default', title: '默认分组' },
        disk: { key: 'all_disk', title: '全部磁盘' },
        storage: { key: 'all_storage', title: '全部存储' },
        cdn: { key: 'all_cdn', title: '全部CDN' },
        ip: { key: 'all_ip', title: '全部IP' }
      };
      
      // 设置默认分组
      this.group = defaultGroups[assetType] || { key: `all_${assetType}`, title: '全部' };
      console.log('设置默认分组:', this.group);
    }
    
    // 重置记录
    this.record = {};
  }

  fetchRecords = () => {
    this.isFetching = true;
    return http.get('/api/host/')
      .then(res => {
        const tmp = {};
        this.rawRecords = res;
        this.rawRecords.map(item => tmp[item.id] = item);
        this.idMap = tmp;
      })
      .finally(() => this.isFetching = false)
  };

  fetchExtend = (id) => {
    http.put('/api/host/', {id})
      .then(() => this.fetchRecords())
  }

  fetchGroups = () => {
    this.grpFetching = true;
    return http.get('/api/host/group/')
      .then(res => {
        this.groups = res.groups;
        this.rawTreeData = res.treeData
      })
      .finally(() => this.grpFetching = false)
  }

  initial = () => {
    if (this.rawRecords.length > 0) return Promise.resolve()
    this.isFetching = true;
    this.grpFetching = true;
    return http.all([http.get('/api/host/'), http.get('/api/host/group/')])
      .then(http.spread((res1, res2) => {
        this.rawRecords = res1;
        this.rawRecords.map(item => this.idMap[item.id] = item);
        this.groups = res2.groups;
        this.rawTreeData = res2.treeData;
        if (this.treeData && this.treeData.length > 0) {
          this.group = this.treeData[0] || {};
        } else {
          this.group = {};
        }
      }))
      .finally(() => {
        this.isFetching = false;
        this.grpFetching = false
      })
  }

  updateGroup = (group, host_ids) => {
    const form = {host_ids, s_group_id: group.key, t_group_id: this.group.key, is_copy: this.addByCopy};
    return http.patch('/api/host/', form)
      .then(() => {
        message.success('操作成功');
        this.fetchRecords()
      })
  }

  // 显示表单
  showForm = (record = {}) => {
    this.formVisible = true;
    this.record = record;
  }

  showSync = () => {
    this.syncVisible = !this.syncVisible
  }

  // 显示详情
  showDetail = (record) => {
    this.detailVisible = true;
    this.record = record;
  }

  showSelector = (addByCopy) => {
    this.addByCopy = addByCopy;
    this.selectorVisible = true;
  }

  _handler_counter = (item, counter) => {
    if (!counter[item.key]) counter[item.key] = new Set()
    for (let child of item.children) {
      this._handler_counter(child, counter)
      counter[child.key].forEach(x => counter[item.key].add(x))
    }
  }

  _handle_filter_group = (treeData) => {
    const data = []
    for (let item of treeData) {
      const host_ids = this.counter[item.key]
      if (host_ids.size > 0 || item.key === this.group.key) {
        item.children = this._handle_filter_group(item.children)
        data.push(item)
      }
    }
    return data
  }

  // 保存资产数据
  saveAsset = (assetType, values) => {
    console.log('保存资产数据:', assetType, values);
    return http.post(`/api/host/${assetType}/`, values)
      .then(res => {
        message.success('保存成功');
        this.formVisible = false;
        
        // 不再自动刷新数据，由用户手动刷新
        
        return res;
      })
      .catch(error => {
        message.error(`保存失败: ${error.message}`);
        throw error;
      });
  };

  // 删除资产数据
  deleteAsset = (assetType, id) => {
    console.log('删除资产数据:', assetType, id);
    return http.delete(`/api/host/${assetType}/?id=${id}`)
      .then(res => {
        message.success('删除成功');
        
        // 不再自动刷新数据，由用户手动刷新
        
        return res;
      })
      .catch(error => {
        message.error(`删除失败: ${error.message}`);
        throw error;
      });
  };

  // 获取非服务器资产类型的数据源
  getAssetDataSource(assetType) {
    console.log('获取非服务器资产类型数据源:', assetType, this.group);
    if (!assetType || assetType === 'server') {
      return this.dataSource;
    }
    
    // 添加时间戳参数，防止浏览器缓存
    const timestamp = new Date().getTime();
    
    // 使用API获取数据 - 修正API路径
    return http.get(`/api/host/${assetType}/`, { params: { _t: timestamp } })
      .then(data => {
        console.log(`从API获取${assetType}数据:`, data);
        
        // 确保返回的是数组
        if (!Array.isArray(data)) {
          console.error(`API返回的${assetType}数据不是数组:`, data);
          return [];
        }
        
        // 根据分组过滤数据
        if (this.group && this.group.key) {
          console.log('根据分组过滤:', this.group.key);
          
          // 根据分组 key 过滤数据
          if (this.group.key.startsWith('all_')) {
            // 全部数据，不进行过滤
            return data;
          } else if (assetType === 'disk' && this.group.key === 'system_disks') {
            return data.filter(item => item.type === 'SSD');
          } else if (assetType === 'disk' && this.group.key === 'data_disks') {
            return data.filter(item => item.type === 'HDD' && item.mount_point === '/data');
          } else if (assetType === 'disk' && this.group.key === 'backup_disks') {
            return data.filter(item => item.type === 'HDD' && item.mount_point === '/backup');
          } else if (assetType === 'storage' && this.group.key === 'object_storage') {
            return data.filter(item => item.type === 'S3' || item.type === 'OSS');
          } else if (assetType === 'storage' && this.group.key === 'file_storage') {
            return data.filter(item => item.type === 'NAS');
          } else if (assetType === 'storage' && this.group.key === 'block_storage') {
            return data.filter(item => item.type === 'Block');
          } else if (assetType === 'cdn' && this.group.key === 'web_cdn') {
            return data.filter(item => item.type === '网页加速');
          } else if (assetType === 'cdn' && this.group.key === 'download_cdn') {
            return data.filter(item => item.type === '下载加速');
          } else if (assetType === 'cdn' && this.group.key === 'video_cdn') {
            return data.filter(item => item.type === '视频加速');
          } else if (assetType === 'ip' && this.group.key === 'public_ip') {
            return data.filter(item => item.type === 'public');
          } else if (assetType === 'ip' && this.group.key === 'private_ip') {
            return data.filter(item => item.type === 'private');
          }
        }
        
        // 如果没有匹配的分组或分组为空，返回所有数据
        return data;
      })
      .catch(error => {
        console.error(`获取${assetType}数据失败:`, error);
        // 返回空数组而不是undefined
        return [];
      });
  }
}

export default new Store()