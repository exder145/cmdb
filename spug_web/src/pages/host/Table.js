/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { observer } from 'mobx-react';
import { Table, Modal, Dropdown, Button, Menu, Avatar, Tooltip, Space, Tag, Radio, Input, message, Card } from 'antd';
import { PlusOutlined, DownOutlined, SyncOutlined, FormOutlined, DownloadOutlined } from '@ant-design/icons';
import { Action, TableCard, AuthButton, AuthFragment } from 'components';
import { http, hasPermission } from 'libs';
import store from './store';
import icons from './icons';
import moment from 'moment';

// 定义不同资产类型的表格列
const assetColumns = {
  server: [
    {
      title: "主机名称",
      render: info => <Action.Button onClick={() => store.showDetail(info)}>{info.name}</Action.Button>,
      sorter: (a, b) => a.name.localeCompare(b.name)
    },
    {
      title: "配置信息",
      render: info => (
        <Space>
          <Tooltip title={info.os_name}>
            <Avatar shape="square" size={16} src={icons[info.os_type || 'unknown']}/>
          </Tooltip>
          <span>{info.cpu}核 {info.memory}GB</span>
        </Space>
      )
    },
    {
      title: "到期信息",
      dataIndex: "expired_time",
      render: v => <ExpireTime value={v}/>,
    },
    {
      title: "状态",
      dataIndex: "status",
      render: status => <Tag color={status === 'Running' ? 'green' : 'orange'}>{status || '未知'}</Tag>
    }
  ],
  disk: [
    {
      title: "磁盘名称",
      dataIndex: "name",
      render: (name, record) => <Action.Button onClick={() => store.showDetail(record)}>{name}</Action.Button>
    },
    {
      title: "磁盘ID",
      dataIndex: "disk_id"
    },
    {
      title: "服务器ID",
      dataIndex: "server_id"
    },
    {
      title: "容量",
      dataIndex: "size_in_gb",
      render: size => size ? `${size}GB` : '-'
    },
    {
      title: "存储类型",
      dataIndex: "storage_type"
    },
    {
      title: "创建时间",
      dataIndex: "create_time"
    },
    {
      title: "过期时间",
      dataIndex: "expire_time"
    },
    {
      title: "状态",
      dataIndex: "status",
      render: status => <Tag color={status === 'online' ? 'green' : 'red'}>{status}</Tag>
    }
  ],
  storage: [
    {
      title: "存储名称",
      dataIndex: "name",
      render: (name, record) => <Action.Button onClick={() => store.showDetail(record)}>{name}</Action.Button>
    },
    {
      title: "类型",
      dataIndex: "type"
    },
    {
      title: "容量",
      dataIndex: "capacity",
      render: capacity => `${capacity}GB`
    },
    {
      title: "使用率",
      dataIndex: "usage",
      render: usage => `${usage}%`
    },
    {
      title: "状态",
      dataIndex: "status",
      render: status => <Tag color={status === 'online' ? 'green' : 'red'}>{status}</Tag>
    }
  ],
  cdn: [
    {
      title: "CDN名称",
      dataIndex: "name",
      render: (name, record) => <Action.Button onClick={() => store.showDetail(record)}>{name}</Action.Button>
    },
    {
      title: "域名",
      dataIndex: "domain"
    },
    {
      title: "类型",
      dataIndex: "type"
    },
    {
      title: "带宽",
      dataIndex: "bandwidth",
      render: bandwidth => `${bandwidth}Mbps`
    },
    {
      title: "状态",
      dataIndex: "status",
      render: status => <Tag color={status === 'online' ? 'green' : 'red'}>{status}</Tag>
    }
  ],
  ip: [
    {
      title: "IP地址",
      dataIndex: "eip",
      render: (eip, record) => <Action.Button onClick={() => store.showDetail(record)}>{eip}</Action.Button>
    },
    {
      title: "名称",
      dataIndex: "name"
    },
    {
      title: "实例",
      dataIndex: "instance"
    },
    {
      title: "付费类型",
      dataIndex: "paymentTiming"
    },
    {
      title: "计费方式",
      dataIndex: "billingMethod"
    },
    {
      title: "创建时间",
      dataIndex: "createTime"
    },
    {
      title: "过期时间",
      dataIndex: "expireTime"
    },
    {
      title: "状态",
      dataIndex: "status",
      render: status => <Tag color={status === 'Available' ? 'green' : 'orange'}>{status}</Tag>
    }
  ],
  instance: [
    {
      title: "实例ID",
      dataIndex: "instance_id",
      render: (instance_id, record) => <Action.Button onClick={() => store.showDetail(record)}>{instance_id}</Action.Button>
    },
    {
      title: "名称",
      dataIndex: "name"
    },
    {
      title: "内网IP",
      dataIndex: "internal_ip"
    },
    {
      title: "公网IP",
      dataIndex: "public_ip"
    },
    {
      title: "可用区",
      dataIndex: "zone_name"
    },
    {
      title: "配置",
      render: record => `${record.cpu_count || '-'}核 ${record.memory_capacity_in_gb || '-'}GB`
    },
    {
      title: "操作系统",
      render: record => `${record.os_name || '-'} ${record.os_version || '-'}`
    },
    {
      title: "付费类型",
      dataIndex: "payment_timing"
    },
    {
      title: "创建时间",
      dataIndex: "create_time"
    },
    {
      title: "过期时间",
      dataIndex: "expire_time"
    },
    {
      title: "状态",
      dataIndex: "status",
      render: status => <Tag color={status === 'Running' ? 'green' : 'orange'}>{status}</Tag>
    }
  ]
};

// 到期时间组件
function ExpireTime(props) {
    if (!props.value) return null
    let value = moment(props.value)
    const days = value.diff(moment(), 'days')
    const formattedDate = value.format('YYYY-MM-DD')
    
    let daysText
    if (days >= 0) {
      daysText = <span>还有 <b style={{color: '#52c41a'}}>{days}</b> 天</span>
    } else {
      daysText = <span>过期 <b style={{color: '#d9363e'}}>{Math.abs(days)}</b> 天</span>
    }
    
    return (
      <div>
        <div>{formattedDate}</div>
        <div>{daysText}</div>
      </div>
    )
  }

export const ComTable = observer(function ({ assetType = 'server' }) {
  // 添加状态来存储数据
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  
  // 获取表格数据
  const getTableData = React.useCallback((forceRefresh = false) => {
    // 如果已经在加载中，则不重复请求
    if (loading) return;
    
    setLoading(true);
    console.log(`正在获取${assetType}数据...`, forceRefresh ? '(强制刷新)' : '');
    
    try {
      if (assetType === 'server') {
        // 对于服务器类型，使用 store.dataSource
        setData(store.dataSource || []);
        setLoading(false);
      } else {
        // 添加时间戳参数，防止浏览器缓存
        const timestamp = new Date().getTime();
        const forceCacheParam = forceRefresh ? '&force=1' : '';
        
        // 对于非服务器类型，使用API获取数据
        http.get(`/host/${assetType}/?_t=${timestamp}${forceCacheParam}`)
          .then(result => {
            console.log(`获取${assetType}数据结果:`, result);
            setData(Array.isArray(result) ? result : []);
            if (forceRefresh) {
              message.success('已完成强制刷新，显示最新数据');
            }
          })
          .catch(error => {
            console.error(`获取${assetType}数据出错:`, error);
            message.error(`获取${assetType}数据失败: ${error.message || '未知错误'}`);
            setData([]);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    } catch (error) {
      console.error('获取数据时出错:', error);
      setData([]);
      setLoading(false);
    }
  }, [loading, assetType]);
  
  // 组件初始化时设置一次资产类型
  React.useEffect(() => {
    try {
      // 只有当资产类型变化时才设置
      store.setAssetType(assetType);
    } catch (error) {
      console.error('设置资产类型出错:', error);
    }
    // 获取数据
    getTableData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetType]);
  
  // 当分组变化时，重新获取数据
  React.useEffect(() => {
    if (store.group && store.group.key) {
      console.log('分组变化，重新获取数据:', store.group);
      getTableData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.group?.key]);

  function handleDelete(info, assetType) {
    Modal.confirm({
      title: '确认删除?',
      content: '该操作不可恢复',
      onOk: () => {
        return store.deleteAsset(assetType, info.id)
          .then(() => {
            // 删除成功后提示用户手动刷新
            console.log('删除成功');
            message.success('删除成功，请点击刷新按钮查看最新数据');
          });
      }
    })
  }

  function handleImport(menu) {
    if (menu.key === 'excel') {
      store.importVisible = true
    } else if (menu.key === 'form') {
      // 设置资产类型并显示表单
      const record = { asset_type: assetType };
      if (store.group && store.group.value) {
        record.group_ids = [store.group.value];
      }
      store.showForm(record);
    } else {
      store.cloudImport = menu.key
    }
  }

  // 获取当前资产类型的列定义
  const columns = assetColumns[assetType] || [];
  
  // 定义不同资产类型的操作按钮
  const assetActions = {
    server: [
      <AuthFragment auth="host.host.add" key="add">
          <Dropdown overlay={(
            <Menu onClick={handleImport}>
              <Menu.Item key="form">
                <Space>
                  <FormOutlined style={{fontSize: 16, marginRight: 4, color: '#1890ff'}}/>
                  <span>新建主机</span>
                </Space>
              </Menu.Item>
              <Menu.Item key="excel">
                <Space>
                  <Avatar shape="square" size={20} src={icons.excel}/>
                  <span>Excel</span>
                </Space>
              </Menu.Item>
              <Menu.Item key="ali">
                <Space>
                  <Avatar shape="square" size={20} src={icons.alibaba}/>
                  <span>阿里云</span>
                </Space>
              </Menu.Item>
              <Menu.Item key="tencent">
                <Space>
                  <Avatar shape="square" size={20} src={icons.tencent}/>
                  <span>腾讯云</span>
                </Space>
              </Menu.Item>
            </Menu>
          )}>
            <Button type="primary" icon={<PlusOutlined/>}>新建 <DownOutlined/></Button>
          </Dropdown>
        </AuthFragment>,
        <AuthButton
        key="sync"
          auth="host.host.add"
          type="primary"
          icon={<SyncOutlined/>}
          onClick={() => store.showSync()}>验证</AuthButton>,
      <Button
        key="export"
        type="primary"
        icon={<DownloadOutlined/>}
        onClick={() => store.exportVisible = true}>导出</Button>,
      <Dropdown key="refresh" overlay={(
          <Menu onClick={e => getTableData(e.key === 'force')}>
            <Menu.Item key="normal">
              <Space>
                <SyncOutlined style={{fontSize: 14}}/>
                <span>普通刷新</span>
              </Space>
            </Menu.Item>
            <Menu.Item key="force">
              <Space>
                <SyncOutlined style={{fontSize: 14, color: '#1890ff'}}/>
                <span>强制刷新</span>
              </Space>
            </Menu.Item>
          </Menu>
        )}>
        <Button type="primary" icon={<SyncOutlined/>}>
          刷新 <DownOutlined/>
        </Button>
      </Dropdown>,
      <Radio.Group key="filter" value={store.f_status} onChange={e => store.f_status = e.target.value}>
          <Radio.Button value="">全部</Radio.Button>
          <Radio.Button value={false}>未验证</Radio.Button>
        </Radio.Group>
    ],
    disk: [
      <Button key="add" type="primary" icon={<PlusOutlined/>} onClick={() => handleImport({key: 'form'})}>新建磁盘</Button>,
      <Button key="export" type="primary" icon={<DownloadOutlined/>} onClick={() => handleExport('disk')}>导出</Button>,
      <Dropdown key="refresh" overlay={(
          <Menu onClick={e => getTableData(e.key === 'force')}>
            <Menu.Item key="normal">
              <Space>
                <SyncOutlined style={{fontSize: 14}}/>
                <span>普通刷新</span>
              </Space>
            </Menu.Item>
            <Menu.Item key="force">
              <Space>
                <SyncOutlined style={{fontSize: 14, color: '#1890ff'}}/>
                <span>强制刷新</span>
              </Space>
            </Menu.Item>
          </Menu>
        )}>
        <Button type="primary" icon={<SyncOutlined/>}>
          刷新 <DownOutlined/>
        </Button>
      </Dropdown>
    ],
    storage: [
      <Button key="add" type="primary" icon={<PlusOutlined/>} onClick={() => handleImport({key: 'form'})}>新建存储</Button>,
      <Button key="export" type="primary" icon={<DownloadOutlined/>} onClick={() => handleExport('storage')}>导出</Button>,
      <Dropdown key="refresh" overlay={(
          <Menu onClick={e => getTableData(e.key === 'force')}>
            <Menu.Item key="normal">
              <Space>
                <SyncOutlined style={{fontSize: 14}}/>
                <span>普通刷新</span>
              </Space>
            </Menu.Item>
            <Menu.Item key="force">
              <Space>
                <SyncOutlined style={{fontSize: 14, color: '#1890ff'}}/>
                <span>强制刷新</span>
              </Space>
            </Menu.Item>
          </Menu>
        )}>
        <Button type="primary" icon={<SyncOutlined/>}>
          刷新 <DownOutlined/>
        </Button>
      </Dropdown>
    ],
    cdn: [
      <Button key="add" type="primary" icon={<PlusOutlined/>} onClick={() => handleImport({key: 'form'})}>新建CDN</Button>,
      <Button key="export" type="primary" icon={<DownloadOutlined/>} onClick={() => handleExport('cdn')}>导出</Button>,
      <Dropdown key="refresh" overlay={(
          <Menu onClick={e => getTableData(e.key === 'force')}>
            <Menu.Item key="normal">
              <Space>
                <SyncOutlined style={{fontSize: 14}}/>
                <span>普通刷新</span>
              </Space>
            </Menu.Item>
            <Menu.Item key="force">
              <Space>
                <SyncOutlined style={{fontSize: 14, color: '#1890ff'}}/>
                <span>强制刷新</span>
              </Space>
            </Menu.Item>
          </Menu>
        )}>
        <Button type="primary" icon={<SyncOutlined/>}>
          刷新 <DownOutlined/>
        </Button>
      </Dropdown>
    ],
    ip: [
      <Button key="add" type="primary" icon={<PlusOutlined/>} onClick={() => handleImport({key: 'form'})}>新建IP</Button>,
      <Button key="export" type="primary" icon={<DownloadOutlined/>} onClick={() => handleExport('ip')}>导出</Button>,
      <Dropdown key="refresh" overlay={(
          <Menu onClick={e => getTableData(e.key === 'force')}>
            <Menu.Item key="normal">
              <Space>
                <SyncOutlined style={{fontSize: 14}}/>
                <span>普通刷新</span>
              </Space>
            </Menu.Item>
            <Menu.Item key="force">
              <Space>
                <SyncOutlined style={{fontSize: 14, color: '#1890ff'}}/>
                <span>强制刷新</span>
              </Space>
            </Menu.Item>
          </Menu>
        )}>
        <Button type="primary" icon={<SyncOutlined/>}>
          刷新 <DownOutlined/>
        </Button>
      </Dropdown>
    ]
  };
  
  // 获取当前资产类型的操作按钮
  const actions = assetActions[assetType] || [];

  // 获取数据源
  const dataSource = data;
  console.log('最终渲染的数据源:', dataSource);
  console.log('最终渲染的列定义:', columns);

  // 处理导出功能
  function handleExport(type) {
    try {
      // 获取数据源
      if (dataSource.length === 0) {
        message.warning('没有可导出的数据');
        return;
      }
      
      // 获取列定义
      const cols = assetColumns[type] || [];
      
      // 生成CSV数据
      let csv = '';
      
      // 添加表头
      const headers = cols.map(col => col.title);
      csv += headers.join(',') + '\n';
      
      // 添加数据行
      dataSource.forEach(item => {
        const row = cols.map(col => {
          let value = '';
          
          // 获取字段值
          if (col.dataIndex) {
            value = item[col.dataIndex];
          } else if (col.render) {
            // 对于没有 dataIndex 但有 render 的列，尝试获取第一个参数
            const firstKey = Object.keys(item)[0];
            value = item[firstKey];
          }
          
          // 处理特殊类型
          if (type === 'disk') {
            if (col.dataIndex === 'size') {
              value = `${value}GB`;
            } else if (col.dataIndex === 'status') {
              value = value === 'online' ? '在线' : '离线';
            } else if (col.dataIndex === 'type') {
              value = value || '未知';
            }
          } else if (type === 'storage') {
            if (col.dataIndex === 'capacity') {
              value = `${value}GB`;
            } else if (col.dataIndex === 'usage') {
              value = `${value || 0}%`;
            } else if (col.dataIndex === 'status') {
              value = value === 'online' ? '在线' : '离线';
            } else if (col.dataIndex === 'type') {
              value = value || '未知';
            }
          } else if (type === 'cdn') {
            if (col.dataIndex === 'bandwidth') {
              value = `${value || 0}Mbps`;
            } else if (col.dataIndex === 'status') {
              value = value === 'online' ? '在线' : '离线';
            } else if (col.dataIndex === 'type') {
              value = value || '未知';
            }
          } else if (type === 'ip') {
            if (col.dataIndex === 'bandwidth') {
              value = value ? `${value}Mbps` : '-';
            } else if (col.dataIndex === 'status') {
              value = value === 'used' ? '已使用' : '未使用';
            } else if (col.dataIndex === 'type') {
              value = value === 'public' ? '公网' : '内网';
            }
          }
          
          // 处理CSV中的特殊字符
          if (value === null || value === undefined) {
            return '';
          } else if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          } else {
            return String(value);
          }
        });
        
        csv += row.join(',') + '\n';
      });
      
      // 添加BOM头，解决中文乱码问题
      const BOM = '\uFEFF';
      const csvContent = BOM + csv;
      
      // 创建Blob对象
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // 创建下载链接
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      // 设置下载属性
      const typeNames = {
        disk: '磁盘',
        storage: '存储',
        cdn: 'CDN',
        ip: 'IP地址'
      };
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${typeNames[type] || type}信息_${new Date().toLocaleDateString()}.csv`);
      link.style.visibility = 'hidden';
      
      // 添加到文档并触发点击
      document.body.appendChild(link);
      link.click();
      
      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      message.success('导出成功');
    } catch (error) {
      console.error('导出CSV时出错:', error);
      message.error('导出失败，请查看控制台获取更多信息');
    }
  }

  // 处理编辑功能
  function handleEdit(info, assetType) {
    store.currentAssetType = assetType;
    store.record = info;
    store.formVisible = true;
  }

  // 处理详情按钮点击
  function handleDetail(info, assetType) {
    store.currentAssetType = assetType;
    store.record = info;
    store.detailVisible = true;
  }

  // 获取操作列定义
  const getActionColumn = () => {
    return {
      title: '操作',
      key: 'action',
      render: info => {
        if (assetType === 'server') {
          return (
            <Action>
              <Action.Button onClick={() => handleDetail(info, assetType)}>详情</Action.Button>
              <Action.Button auth="host.host.edit" onClick={() => handleEdit(info, assetType)}>编辑</Action.Button>
              <Action.Button danger auth="host.host.del" onClick={() => handleDelete(info, assetType)}>删除</Action.Button>
            </Action>
          );
        } else {
          return (
            <Action>
              <Action.Button auth="host.host.edit" onClick={() => handleEdit(info, assetType)}>编辑</Action.Button>
              <Action.Button danger auth="host.host.del" onClick={() => handleDelete(info, assetType)}>删除</Action.Button>
            </Action>
          );
        }
      }
    };
  };

  // 直接使用 antd 的 Table 组件
  return (
    <Card
      title={<Input allowClear value={store.f_word} placeholder="输入名称检索" style={{maxWidth: 250}}
                    onChange={e => store.f_word = e.target.value}/>}
      extra={actions}
      style={{marginBottom: 16}}>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={dataSource}
      pagination={{
        showSizeChanger: true,
        showLessItems: true,
        hideOnSinglePage: true,
        showTotal: total => `共 ${total} 条`,
        pageSizeOptions: ['10', '20', '50', '100']
        }}
        columns={[
          ...columns.map(col => ({
            ...col,
            ellipsis: true
          })),
          getActionColumn()
        ].filter(Boolean)}
      />
    </Card>
  )
})

export default ComTable;
