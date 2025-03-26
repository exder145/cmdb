/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { Avatar, Card, Col, Row } from 'antd';
import styles from './index.module.less';

// 硬编码导航数据
const navigationData = [
  {
    id: 1,
    title: '监控平台',
    desc: '用于服务器监控',
    logo: '/resource/prometheus.png',
    links: [
      { name: '导航链接', url: 'http://192.168.0.29:3000/dashboard/snapshot/Aeooj7CaeE0uw0WIqRWTlihOhjiE2fAl?orgId=0' } 
    ]
  },
  {
    id: 2,
    title: '拓扑图',
    desc: '拓扑图',
    logo: '/resource/grafana.png',
    links: [
      { name: '导航链接', url: 'http://192.168.64.4/SystemArchitecture.png' } 
    ]
  }
];

function NavIndex() {
  return (
    <Card
      title="便捷导航"
      className={`${styles.nav} home-nav`}
      bodyStyle={{paddingBottom: 0, minHeight: 166}}>
      <Row gutter={24}>
        {navigationData.map(item => (
          <Col key={item.id} span={6} style={{marginBottom: 24}}>
            <Card
              hoverable
              actions={item.links.map(x => <a href={x.url} rel="noopener noreferrer" target="_blank">{x.name}</a>)}>
              <Card.Meta
                avatar={<Avatar size="large" src={item.logo}/>}
                title={item.title}
                description={item.desc}/>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  )
}

export default NavIndex;