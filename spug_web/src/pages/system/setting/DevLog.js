/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { Timeline, Card, Badge, Spin, Row, Col, Tag, Empty } from 'antd';
import { ClockCircleOutlined, CheckCircleFilled, SyncOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import styles from './index.module.css';
import { observer } from 'mobx-react';

@observer
class DevLog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      logs: [
        {
          id: 0,
          date: '2024-03-26',
          title: 'Ansible执行功能测试完成',
          content: '完成了Ansible执行功能的全面测试和优化。主要改进包括：1) 新增一键测试按钮，支持快速填充预设的测试主机信息和playbook内容；2) 优化了执行结果的显示格式，添加了颜色标识和分隔符，提高了日志可读性；3) 改进了页面刷新机制，避免了会话失效问题。测试验证显示所有功能正常运行，执行结果清晰可读。',
          status: 'success',
          author: '实习生',
          version: 'v1.3.1'
        },
        {
          id: 1,
          date: '2024-03-25',
          title: '前后端分离部署实现',
          content: '完成了前后端分离部署功能，实现后端服务部署在CentOS 7虚拟机上，前端在Windows环境下独立运行。解决了SQLite数据库权限问题，配置了跨域请求支持，优化了前端API请求配置。提高了系统维护和扩展的灵活性，为后续功能迭代奠定了基础。',
          status: 'success',
          author: '实习生',
          version: 'v1.3.0'
        },
        {
          id: 2,
          date: '2024-03-21',
          title: 'Ansible执行功能增强',
          content: '对Ansible执行模块进行了优化，增加了表单添加目标主机功能，支持三种方式添加：直接添加、批量添加和从CSV导入。后端功能实现已完成，目前处于验证阶段。优化了任务执行界面和执行记录展示，提升了用户操作体验。',
          status: 'processing',
          author: '实习生',
          version: 'v1.2.5'
        },
        {
          id: 3,
          date: '2024-03-19',
          title: '资产管理数据功能完善',
          content: 'json文件内数据已通过自动脚本上传到数据库，实现了数据自动更新。新增了时间维度数据筛选功能，支持查看本月、上月、全部数据以及自定义时间段的数据。成功实现了数据导出功能，可将数据导出为CSV表格。完成了环比变化的计算逻辑，为数据分析提供了更好的支持。',
          status: 'success',
          author: '实习生',
          version: 'v1.2.3'
        },
        {
          id: 4,
          date: '2024-03-17',
          title: '费用概览界面增强',
          content: '对费用概览界面进行了增强，新增费用分布饼状图，可灵活切换展示月度和年度费用分布情况。增加了Top 5高费用资源展示功能，对最近一年的高额费用进行排序展示，帮助用户直观了解主要成本支出。目前样式已确定，部分数据内容待进一步完善。',
          status: 'success',
          author: '实习生',
          version: 'v1.2.1'
        },
        {
          id: 6,
          date: '2024-03-13',
          title: '资产管理界面完善',
          content: '添加了切换选择功能，支持查看不同资产对象，包含服务器、磁盘、对象存储、CDN和IP地址。已与后端数据库实现联通，数据展示正常。同时对主机扩展信息进行了优化，去除了IP地址显示，使界面更加简洁清晰。',
          status: 'success',
          author: '实习生',
          version: 'v1.1.8'
        },
        {
          id: 7,
          date: '2024-03-12',
          title: '费用管理模块前端实现',
          content: '新增费用管理模块，包含费用概览和资源费用明细两个子页面。费用概览页面展示了总体费用情况、各类资源费用占比，以及按月度、季度的费用统计图表，方便管理员直观了解系统资源使用成本。',
          status: 'success',
          author: '实习生',
          version: 'v1.1.5'
        },
        {
          id: 8,
          date: '2024-03-11',
          title: '批量执行模块优化',
          content: '实现了ansible执行模块的前端界面，包括任务创建、模板管理和执行记录查询等功能。后端对接尚未完成，计划下周完成API开发。配置中心进行了精简，删除了环境管理和应用配置，将服务配置与外联服务注册界面进行整合，提高了系统操作效率。',
          status: 'processing',
          author: '实习生',
          version: 'v1.1.3'
        },
        {
          id: 9,
          date: '2024-03-05',
          title: '项目启动',
          content: '正式启动CMDB系统开发项目，完成需求分析和技术选型，确定使用React+Django技术栈，采用前后端分离架构。初步规划了系统功能模块和数据结构，建立了开发环境。',
          status: 'success',
          author: '项目经理',
          version: 'v1.0.0'
        }
      ]
    }
  }

  getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircleFilled style={{ color: '#52c41a' }} />;
      case 'processing':
        return <SyncOutlined spin style={{ color: '#1890ff' }} />;
      case 'warning':
        return <ExclamationCircleFilled style={{ color: '#faad14' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  }

  getTagColor = (status) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'processing':
        return 'processing';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  }

  render() {
    const { logs, loading } = this.state;
    return (
      <Spin spinning={loading}>
        <div className={styles.title}>开发日志</div>
        <Card className={styles.card}>
          {logs.length > 0 ? (
            <Timeline mode="left">
              {logs.map(log => (
                <Timeline.Item 
                  key={log.id}
                  dot={this.getStatusIcon(log.status)}
                  color={log.status === 'success' ? 'green' : log.status === 'processing' ? 'blue' : 'orange'}>
                  <Row>
                    <Col span={24}>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                        {log.title}
                        <Tag color={this.getTagColor(log.status)} style={{ marginLeft: '10px' }}>
                          {log.status === 'success' ? '已完成' : log.status === 'processing' ? '进行中' : '待优化'}
                        </Tag>
                        <Tag color="blue" style={{ marginLeft: '5px' }}>{log.version}</Tag>
                      </div>
                    </Col>
                    <Col span={24}>
                      <div style={{ color: '#666', marginBottom: '5px' }}>{log.content}</div>
                    </Col>
                    <Col span={24}>
                      <div style={{ color: '#999', fontSize: '12px' }}>
                        <span>开发者: {log.author}</span>
                        <span style={{ marginLeft: '15px' }}>日期: {log.date}</span>
                      </div>
                    </Col>
                  </Row>
                </Timeline.Item>
              ))}
            </Timeline>
          ) : (
            <Empty description="暂无开发日志" />
          )}
        </Card>
      </Spin>
    )
  }
}

export default DevLog 