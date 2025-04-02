/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { Modal, Button, Checkbox, Table, message, Spin, Space, Divider, Alert, Avatar, Tooltip } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import store from './store';
import { http } from 'libs';
import lds from 'lodash';
import icons from './icons';
import moment from 'moment';

// 定义可导出的字段
const exportFields = [
  // 基本信息
  { key: 'name', title: '主机名称', checked: true },
  { key: 'hostname', title: '连接地址', checked: true },
  { key: 'port', title: '连接端口', checked: true },
  { key: 'username', title: '用户名', checked: true },
  
  // 扩展信息
  { key: 'instance_id', title: '实例ID', checked: false },
  { key: 'status', title: '状态', checked: true },
  { key: 'zone_name', title: '可用区', checked: false, alias: 'region' },
  { key: 'os_name', title: '操作系统', checked: true },
  { key: 'os_version', title: '系统版本', checked: false, alias: 'version' },
  { key: 'os_arch', title: '系统架构', checked: false, alias: 'arch' },
  { key: 'cpu_count', title: 'CPU', checked: true, alias: 'cpu' },
  { key: 'memory_capacity_in_gb', title: '内存', checked: true, alias: 'memory' },
  { key: 'payment_timing', title: '付费方式', checked: false, alias: 'payment_method' },
  { key: 'create_time', title: '创建时间', checked: false, alias: 'created_time' },
  { key: 'expire_time', title: '到期时间', checked: false, alias: 'expired_time' },
  { key: 'image_name', title: '镜像名称', checked: false },
];

export default observer(function Export() {
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [fields, setFields] = useState(exportFields);
  const [previewData, setPreviewData] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    if (store.exportVisible) {
      // 默认选择当前显示的所有主机
      setSelectedRowKeys(store.dataSource.map(item => item.id));
    }
  }, [store.exportVisible]);

  // 处理字段选择变化
  const handleFieldChange = (key, checked) => {
    const newFields = fields.map(field => {
      if (field.key === key) {
        return { ...field, checked };
      }
      return field;
    });
    setFields(newFields);
  };

  // 全选/取消全选字段
  const handleSelectAllFields = (checked) => {
    const newFields = fields.map(field => ({ ...field, checked }));
    setFields(newFields);
  };

  // 生成CSV数据
  const generateCSV = (data, selectedFields) => {
    // 表头
    let csv = selectedFields.map(field => field.title).join(',') + '\n';
    
    // 数据行
    data.forEach(item => {
      const row = selectedFields.map(field => {
        // 处理字段别名
        let value;
        if (field.alias && item[field.key] === undefined) {
          value = item[field.alias];
        } else {
          value = item[field.key];
        }
        
        // 处理特殊字段
        if (field.key === 'pkey') {
          value = value ? '是' : '否';
        } else if (field.key === 'cpu_count' || field.key === 'cpu') {
          value = value ? `${value}核` : '';
        } else if (field.key === 'memory_capacity_in_gb' || field.key === 'memory') {
          value = value ? `${value}GB` : '';
        } else if (field.key === 'payment_timing') {
          if (value === 'PrePaid' || value === 'Prepaid') {
            value = '包年包月';
          } else if (value === 'PostPaid' || value === 'Postpaid') {
            value = '按量计费';
          }
        } else if (field.key === 'create_time' || field.key === 'expire_time' || 
                   field.key === 'created_time' || field.key === 'expired_time') {
          // 处理日期字段
          if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const hours = String(date.getHours()).padStart(2, '0');
              const minutes = String(date.getMinutes()).padStart(2, '0');
              const seconds = String(date.getSeconds()).padStart(2, '0');
              
              // 根据时间是否为00:00:00决定是否显示时分秒
              if (hours === '00' && minutes === '00' && seconds === '00') {
                value = `${year}/${month}/${day}`;
              } else {
                value = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
              }
            } else {
              value = String(value).replace(/-/g, '/');
            }
          } else {
            value = '';
          }
        } else if (typeof value === 'object' && value !== null) {
          // 处理其他可能是对象的字段
          try {
            value = JSON.stringify(value);
          } catch (e) {
            value = '';
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
      }).join(',');
      
      csv += row + '\n';
    });
    
    return csv;
  };

  // 导出CSV文件
  const exportCSV = () => {
    setLoading(true);
    
    // 从实例API获取更完整的数据
    const hostIds = selectedRowKeys.join(',');
    http.get('/host/instance/', {params: {ids: hostIds}})
      .then(res => {
        try {
          // 处理API返回的数据
          let instances = res;
          if (!Array.isArray(instances)) {
            instances = [instances];
          }
          
          // 将实例数据与原始数据合并
          const mergedData = [];
          for (const instance of instances) {
            // 找到对应的原始记录
            const originalRecord = store.rawRecords.find(item => item.id === instance.id);
            if (originalRecord) {
              // 合并数据，实例数据优先
              mergedData.push({...originalRecord, ...instance});
            }
          }
          
          // 获取选中的字段
          const selectedFields = fields.filter(field => field.checked);
          
          if (selectedFields.length === 0) {
            message.error('请至少选择一个导出字段');
            setLoading(false);
            return;
          }
          
          // 生成CSV数据
          const csv = generateCSV(mergedData, selectedFields);
          
          // 添加BOM头，解决中文乱码问题
          const BOM = '\uFEFF';
          const csvContent = BOM + csv;
          
          // 创建Blob对象
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          
          // 创建下载链接
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          
          // 设置下载属性
          link.setAttribute('href', url);
          link.setAttribute('download', `主机信息_${new Date().toLocaleDateString()}.csv`);
          link.style.visibility = 'hidden';
          
          // 添加到文档并触发点击
          document.body.appendChild(link);
          link.click();
          
          // 清理
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          message.success('导出成功');
          store.exportVisible = false;
        } catch (error) {
          console.error('处理导出数据时出错:', error);
          message.error('导出失败，请查看控制台获取更多信息');
        }
      })
      .catch(error => {
        console.error('获取实例数据失败:', error);
        message.error('获取数据失败，请稍后重试');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // 预览数据
  const handlePreview = () => {
    const selectedFields = fields.filter(field => field.checked);
    
    if (selectedFields.length === 0) {
      message.error('请至少选择一个导出字段');
      return;
    }
    
    setLoading(true);
    // 从实例API获取更完整的数据
    const hostIds = selectedRowKeys.join(',');
    http.get('/host/instance/', {params: {ids: hostIds}})
      .then(res => {
        try {
          // 处理API返回的数据
          let instances = res;
          if (!Array.isArray(instances)) {
            instances = [instances];
          }
          
          // 将实例数据与原始数据合并
          const mergedData = [];
          for (const instance of instances) {
            // 找到对应的原始记录
            const originalRecord = store.rawRecords.find(item => item.id === instance.id);
            if (originalRecord) {
              // 合并数据，实例数据优先
              mergedData.push({...originalRecord, ...instance});
            }
          }
          
          // 生成预览数据
          const previewData = mergedData.map(host => {
            const item = {};
            selectedFields.forEach(field => {
              // 处理字段别名
              let value;
              if (field.alias && host[field.key] === undefined) {
                value = host[field.alias];
              } else {
                value = host[field.key];
              }
              
              // 处理特殊字段
              if (field.key === 'pkey') {
                value = value ? '是' : '否';
              } else if (field.key === 'cpu_count' || field.key === 'cpu') {
                value = value ? `${value}核` : '';
              } else if (field.key === 'memory_capacity_in_gb' || field.key === 'memory') {
                value = value ? `${value}GB` : '';
              } else if (field.key === 'payment_timing') {
                if (value === 'PrePaid' || value === 'Prepaid') {
                  value = '包年包月';
                } else if (value === 'PostPaid' || value === 'Postpaid') {
                  value = '按量计费';
                }
              } else if (field.key === 'os_name') {
                // 保存原始值，以便在渲染时使用
                item.os_type = host.os_type || 'unknown';
                value = value || '';
              } else if (field.key === 'create_time' || field.key === 'expire_time' || 
                         field.key === 'created_time' || field.key === 'expired_time') {
                // 处理日期字段
                if (value) {
                  const date = new Date(value);
                  if (!isNaN(date.getTime())) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const seconds = String(date.getSeconds()).padStart(2, '0');
                    
                    // 根据时间是否为00:00:00决定是否显示时分秒
                    if (hours === '00' && minutes === '00' && seconds === '00') {
                      value = `${year}/${month}/${day}`;
                    } else {
                      value = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
                    }
                  } else {
                    value = String(value).replace(/-/g, '/');
                  }
                } else {
                  value = '';
                }
              } else if (typeof value === 'object' && value !== null) {
                // 处理其他可能是对象的字段
                try {
                  value = JSON.stringify(value);
                } catch (e) {
                  value = '';
                }
              }
              
              item[field.key] = value;
            });
            return item;
          });
          
          setPreviewData(previewData);
          setPreviewVisible(true);
        } catch (error) {
          console.error('处理预览数据时出错:', error);
          message.error('预览失败，请查看控制台获取更多信息');
        }
      })
      .catch(error => {
        console.error('获取实例数据失败:', error);
        message.error('获取数据失败，请稍后重试');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // 关闭预览
  const handleClosePreview = () => {
    setPreviewVisible(false);
  };

  // 渲染预览模态框
  const renderPreviewModal = () => {
    const selectedFields = fields.filter(field => field.checked);
    
    const columns = selectedFields.map(field => {
      const column = {
        title: field.title,
        dataIndex: field.key,
        key: field.key,
        ellipsis: true,
        width: 150,
      };
      
      // 为特定字段添加自定义渲染函数
      if (field.key === 'os_name') {
        column.render = (text, record) => (
          <Space>
            {record.os_type && <Avatar shape="square" size={16} src={icons[record.os_type || 'unknown']} />}
            <span>{text}</span>
          </Space>
        );
      } else if (field.key === 'pkey') {
        column.render = v => v ? '是' : '否';
      } else if (field.key === 'cpu_count' || field.key === 'cpu') {
        column.render = value => value ? `${value}核` : '-';
      } else if (field.key === 'memory_capacity_in_gb' || field.key === 'memory') {
        column.render = value => value ? `${value}GB` : '-';
      } else if (field.key === 'payment_timing') {
        column.render = value => {
          if (value === 'PrePaid' || value === 'Prepaid') {
            return '包年包月';
          } else if (value === 'PostPaid' || value === 'Postpaid') {
            return '按量计费';
          }
          return value || '-';
        };
      } else {
        column.render = (text) => {
          if (text === null || text === undefined) {
            return '-';
          }
          return text;
        };
      }
      
      return column;
    });
    
    return (
      <Modal
        title="数据预览"
        visible={previewVisible}
        width={800}
        onCancel={handleClosePreview}
        footer={[
          <Button key="back" onClick={handleClosePreview}>关闭</Button>,
          <Button key="export" type="primary" icon={<DownloadOutlined />} onClick={exportCSV}>
            确认导出
          </Button>,
        ]}
      >
        <Alert
          message="预览说明"
          description="以下是导出数据的预览，您可以检查数据是否符合预期。如果满意，请点击确认导出按钮。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Table
          rowKey={(record, index) => index}
          columns={columns}
          dataSource={previewData}
          size="small"
          scroll={{ x: 'max-content', y: 400 }}
          pagination={false}
          bordered
        />
      </Modal>
    );
  };

  return (
    <Modal
      visible={store.exportVisible}
      width={800}
      title="导出主机信息"
      onCancel={() => store.exportVisible = false}
      footer={[
        <Button key="cancel" onClick={() => store.exportVisible = false}>取消</Button>,
        <Button key="preview" type="primary" onClick={handlePreview}>
          预览
        </Button>,
        <Button key="export" type="primary" icon={<DownloadOutlined />} loading={loading} onClick={exportCSV}>
          导出
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        <Alert
          message="导出说明"
          description="您可以选择要导出的主机和要显示的字段，字段内容与服务器详情页面一致。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Divider orientation="left">选择主机</Divider>
        <div style={{ marginBottom: 16 }}>
          <Table
            rowKey="id"
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              selections: [
                Table.SELECTION_ALL,
                Table.SELECTION_INVERT,
                Table.SELECTION_NONE,
              ],
            }}
            columns={[
              { title: '主机名称', dataIndex: 'name' },
              { title: 'IP地址', dataIndex: 'hostname' },
              { title: '状态', dataIndex: 'is_verified', render: v => v ? '已验证' : '未验证' },
            ]}
            dataSource={store.dataSource}
            size="small"
            pagination={false}
            scroll={{ y: 200 }}
          />
        </div>
        
        <Divider orientation="left">选择导出字段</Divider>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <Checkbox
              indeterminate={fields.some(field => field.checked) && !fields.every(field => field.checked)}
              checked={fields.every(field => field.checked)}
              onChange={e => handleSelectAllFields(e.target.checked)}
            >
              全选
            </Checkbox>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {fields.map(field => (
              <div key={field.key} style={{ width: '25%', marginBottom: 8 }}>
                <Checkbox
                  checked={field.checked}
                  onChange={e => handleFieldChange(field.key, e.target.checked)}
                >
                  {field.title}
                </Checkbox>
              </div>
            ))}
          </div>
        </div>
      </Spin>
      
      {renderPreviewModal()}
    </Modal>
  );
}); 