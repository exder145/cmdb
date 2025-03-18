/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { observer } from 'mobx-react';
import { Empty } from 'antd';
import { AuthDiv, Breadcrumb } from 'components';
import store from './store';

export default observer(function () {
  return (
    <AuthDiv auth="config.src.view">
      <Breadcrumb>
        <Breadcrumb.Item>首页</Breadcrumb.Item>
        <Breadcrumb.Item>服务配置</Breadcrumb.Item>
      </Breadcrumb>
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Empty description="服务配置功能正在开发中，敬请期待..." />
      </div>
      {store.formVisible && <div style={{ display: 'none' }}></div>}
    </AuthDiv>
  );
})
