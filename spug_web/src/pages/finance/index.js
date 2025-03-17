/**
 * 云资源费用管理
 */
import React from 'react';
import { Menu } from 'antd';
import { DollarOutlined, BarChartOutlined, LineChartOutlined, WalletOutlined } from '@ant-design/icons';
import { AuthDiv } from 'components';
import Overview from './Overview';
import ResourceDetail from './ResourceDetail';
import TrendAnalysis from './TrendAnalysis';
import BudgetManagement from './BudgetManagement';
import styles from './index.module.less';

class Finance extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedKeys: ['overview']
    }
  }

  componentDidMount() {
    const { location: { state } } = this.props;
    if (state && state.type) {
      this.setState({ selectedKeys: [state.type] })
    }
  }

  handleSelect = ({ selectedKeys }) => {
    this.setState({ selectedKeys })
  };

  render() {
    const { selectedKeys } = this.state;
    return (
      <AuthDiv auth="finance.finance.view">
        <div className={styles.container}>
          <div className={styles.sider}>
            <div className={styles.title}>云资源费用管理</div>
            <Menu
              mode="inline"
              selectedKeys={selectedKeys}
              onSelect={this.handleSelect}>
              <Menu.Item key="overview" icon={<DollarOutlined />}>费用概览</Menu.Item>
              <Menu.Item key="resource" icon={<BarChartOutlined />}>资源费用明细</Menu.Item>
              <Menu.Item key="trend" icon={<LineChartOutlined />}>费用趋势分析</Menu.Item>
              <Menu.Item key="budget" icon={<WalletOutlined />}>预算管理</Menu.Item>
            </Menu>
          </div>
          <div className={styles.content}>
            {selectedKeys[0] === 'overview' && <Overview />}
            {selectedKeys[0] === 'resource' && <ResourceDetail />}
            {selectedKeys[0] === 'trend' && <TrendAnalysis />}
            {selectedKeys[0] === 'budget' && <BudgetManagement />}
          </div>
        </div>
      </AuthDiv>
    )
  }
}

export default Finance; 