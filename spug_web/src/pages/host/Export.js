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
import lds from 'lodash';
import icons from './icons';
import moment from 'moment';

// 定义可导出的字段
const exportFields = [
  { key: 'name', title: '主机名称', checked: true },
  { key: 'hostname', title: '连接地址', checked: true },
  { key: 'port', title: '连接端口', checked: true },
  { key: 'username', title: '用户名', checked: true },
  { key: 'desc', title: '描述信息', checked: true },
  { key: 'os_name', title: '操作系统', checked: true, hasIcon: true },
  { key: 'os_type', title: '系统类型', checked: false },
  { key: 'cpu', title: 'CPU', checked: true },
  { key: 'memory', title: '内存', checked: true },
  { key: 'disk', title: '磁盘', checked: false },
  { key: 'private_ip_address', title: '内网IP', checked: false },
  { key: 'public_ip_address', title: '公网IP', checked: false },
  { key: 'instance_id', title: '实例ID', checked: false },
  { key: 'instance_charge_type_alias', title: '实例计费方式', checked: false },
  { key: 'internet_charge_type_alias', title: '网络计费方式', checked: false },
  { key: 'created_time', title: '创建时间', checked: false },
  { key: 'expired_time', title: '到期时间', checked: false },
  { key: 'is_verified', title: '验证状态', checked: false },
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
        let value = item[field.key];
        
        // 处理特殊字段
        if (field.key === 'disk') {
          value = Array.isArray(value) ? value.map(v => `${v}GB`).join('; ') : value;
        } else if (field.key === 'private_ip_address') {
          // 处理内网IP
          if (Array.isArray(value)) {
            value = value.map(ip => {
              if (typeof ip === 'object' && ip !== null) {
                return ip.name || JSON.stringify(ip);
              }
              return ip;
            }).join('; ');
          } else if (typeof value === 'object' && value !== null) {
            value = value.name || JSON.stringify(value);
          }
        } else if (field.key === 'public_ip_address') {
          // 处理公网IP
          if (Array.isArray(value)) {
            value = value.map(ip => {
              if (typeof ip === 'object' && ip !== null) {
                return ip.name || JSON.stringify(ip);
              }
              return ip;
            }).join('; ');
          } else if (typeof value === 'object' && value !== null) {
            value = value.name || JSON.stringify(value);
          }
        } else if (field.key === 'is_verified') {
          value = value ? '已验证' : '未验证';
        } else if (field.key === 'cpu') {
          value = value ? `${value}核` : '';
        } else if (field.key === 'memory') {
          value = value ? `${value}GB` : '';
        } else if (field.key === 'os_name') {
          // 操作系统名称，如果为空则使用类型
          value = value || (item.os_type ? item.os_type.toUpperCase() : '未知');
        } else if (field.key === 'created_time' || field.key === 'expired_time') {
          // 处理日期字段 - 使用最简单的方法确保Excel正确显示
          if (value) {
            // 保留完整的日期时间格式
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
    
    try {
      // 获取选中的主机数据
      const selectedHosts = store.rawRecords.filter(item => selectedRowKeys.includes(item.id));
      
      // 获取选中的字段
      const selectedFields = fields.filter(field => field.checked);
      
      if (selectedFields.length === 0) {
        message.error('请至少选择一个导出字段');
        setLoading(false);
        return;
      }
      
      // 生成CSV数据
      const csv = generateCSV(selectedHosts, selectedFields);
      
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
      console.error('导出CSV时出错:', error);
      message.error('导出失败，请查看控制台获取更多信息');
    } finally {
      setLoading(false);
    }
  };

  // 预览数据
  const handlePreview = () => {
    const selectedHosts = store.rawRecords.filter(item => selectedRowKeys.includes(item.id));
    const selectedFields = fields.filter(field => field.checked);
    
    if (selectedFields.length === 0) {
      message.error('请至少选择一个导出字段');
      return;
    }
    
    // 生成预览数据
    const previewData = selectedHosts.map(host => {
      const item = {};
      selectedFields.forEach(field => {
        let value = host[field.key];
        
        // 处理特殊字段
        if (field.key === 'disk') {
          value = Array.isArray(value) ? value.map(v => `${v}GB`).join('; ') : value;
        } else if (field.key === 'private_ip_address') {
          // 处理内网IP
          if (Array.isArray(value)) {
            value = value.map(ip => {
              if (typeof ip === 'object' && ip !== null) {
                return ip.name || JSON.stringify(ip);
              }
              return ip;
            }).join('; ');
          } else if (typeof value === 'object' && value !== null) {
            value = value.name || JSON.stringify(value);
          }
        } else if (field.key === 'public_ip_address') {
          // 处理公网IP
          if (Array.isArray(value)) {
            value = value.map(ip => {
              if (typeof ip === 'object' && ip !== null) {
                return ip.name || JSON.stringify(ip);
              }
              return ip;
            }).join('; ');
          } else if (typeof value === 'object' && value !== null) {
            value = value.name || JSON.stringify(value);
          }
        } else if (field.key === 'is_verified') {
          value = value ? '已验证' : '未验证';
        } else if (field.key === 'cpu') {
          value = value ? `${value}核` : '';
        } else if (field.key === 'memory') {
          value = value ? `${value}GB` : '';
        } else if (field.key === 'os_name') {
          // 保存原始值，以便在渲染时使用
          item.os_type = host.os_type || 'unknown';
          value = value || '';
        } else if (field.key === 'created_time' || field.key === 'expired_time') {
          // 处理日期字段 - 保留完整的日期时间信息
          if (value) {
            // 保留完整的日期时间格式
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
            <Tooltip title={text}>
              <Avatar shape="square" size={16} src={icons[record.os_type || 'unknown']} />
            </Tooltip>
            <span>{text}</span>
          </Space>
        );
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
          description="您可以选择要导出的主机和字段，然后点击导出按钮将数据导出为CSV格式。"
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