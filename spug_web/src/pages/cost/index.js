/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { observer } from 'mobx-react';
import { Breadcrumb } from 'components';
import { useLocation } from 'react-router-dom';
import styles from './index.module.less';

export default observer(function () {
  const location = useLocation();
  
  return (
    <div>
      <Breadcrumb>
        <Breadcrumb.Item>首页</Breadcrumb.Item>
        <Breadcrumb.Item>费用管理</Breadcrumb.Item>
      </Breadcrumb>
      <div className={styles.container}>
        {location.pathname === '/cost' ? (
          <div className={styles.welcome}>
            <h1>欢迎使用费用管理</h1>
            <p>请从左侧菜单选择要查看的内容</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}) 