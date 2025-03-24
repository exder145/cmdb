/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import {
  DashboardOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  SettingOutlined,
  DatabaseOutlined,
  MoneyCollectOutlined
} from '@ant-design/icons';

import DashboardIndex from './pages/dashboard';
import HostIndex from './pages/host';
import ExecTask from './pages/exec/task';
import ExecTemplate from './pages/exec/template';
import ExecTransfer from './pages/exec/transfer';
// import ExecAnsible from './pages/exec/ansible';
// import ConfigEnvironment from './pages/config/environment';
import ConfigService from './pages/config/service';
// import ConfigApp from './pages/config/app';
import ConfigSetting from './pages/config/setting';
import SystemAccount from './pages/system/account';
import SystemRole from './pages/system/role';
import SystemSetting from './pages/system/setting';
import SystemLogin from './pages/system/login';
import WelcomeIndex from './pages/welcome/index';
import WelcomeInfo from './pages/welcome/info';
import CostIndex from './pages/cost/index';
import CostOverview from './pages/cost/overview';
import CostDetails from './pages/cost/details';
import CostTrends from './pages/cost/trends';
import CostBudget from './pages/cost/budget';

export default [
  {
    icon: <DashboardOutlined/>,
    title: 'Dashboard',
    auth: 'dashboard.dashboard.view',
    path: '/dashboard',
    component: DashboardIndex
  },
  {icon: <DatabaseOutlined/>, title: '资产管理', auth: 'host.host.view', path: '/host', component: HostIndex},
  {
    icon: <MoneyCollectOutlined/>, title: '费用管理', auth: 'host.host.view', path: '/cost', component: CostIndex,
    child: [
      {title: '费用概览', auth: 'host.host.view', path: '/cost/overview', component: CostOverview},
      {title: '资源费用明细', auth: 'host.host.view', path: '/cost/details', component: CostDetails},
      {title: '费用趋势分析', auth: 'host.host.view', path: '/cost/trends', component: CostTrends},
      {title: '预算管理', auth: 'host.host.view', path: '/cost/budget', component: CostBudget},
    ]
  },
  {
    icon: <CodeOutlined/>, title: '批量执行', auth: 'exec.task.do', path: '/exec/task', component: ExecTask
  },
  {
    icon: <DeploymentUnitOutlined/>, title: '服务配置', auth: 'config.src.view', path: '/config/service', component: ConfigService
  },
  {
    icon: <SettingOutlined/>, title: '系统管理', auth: "system.account.view|system.role.view|system.setting.view", child: [
      {title: '登录日志', auth: 'system.login.view', path: '/system/login', component: SystemLogin},
      {title: '账户管理', auth: 'system.account.view', path: '/system/account', component: SystemAccount},
      {title: '角色管理', auth: 'system.role.view', path: '/system/role', component: SystemRole},
      {title: '开发日志', auth: 'system.setting.view', path: '/system/setting?key=devlog', component: SystemSetting},
      {title: '系统设置', auth: 'system.setting.view', path: '/system/setting', component: SystemSetting},
    ]
  },
  {path: '/welcome/index', component: WelcomeIndex},
  {path: '/welcome/info', component: WelcomeInfo},
]
