/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect } from 'react';
import { Avatar, Card, Col, Row, Modal, message } from 'antd';
import { LeftSquareOutlined, RightSquareOutlined, EditOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import { AuthButton } from 'components';
import NavForm from './NavForm';
import { http } from 'libs';
import styles from './index.module.less';

function NavIndex(props) {
  const [isEdit, setIsEdit] = useState(false);
  const [records, setRecords] = useState([]);
  const [record, setRecord] = useState();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function fetchData() {
    http.get('/home/navigation/')
      .then(data => setRecords(data))
  }

  function handleSubmit() {
    fetchData();
    setRecord(null)
  }

  function handleSort(info, sort) {
    setLoading(true);
    http.patch('/home/navigation/', {id: info.id, sort})
      .then(fetchData)
      .finally(() => setLoading(false))
  }

  function handleDelete(item) {
    Modal.confirm({
      title: '删除确认',
      content: `确定要删除【${item.name}】?`,
      onOk: () => http.delete('/home/navigation/', {params: {id: item.id}})
        .then(() => {
          message.success('删除成功');
          fetchData()
        })
    })
  }

  return (
    <Card
      title="便捷导航"
      className={`${styles.nav} home-nav`}
      bodyStyle={{paddingBottom: 0, minHeight: 166}}
      extra={<AuthButton auth="admin" type="link"
                         onClick={() => setIsEdit(!isEdit)}>{isEdit ? '完成' : '编辑'}</AuthButton>}>
      {isEdit ? (
        <Row gutter={24}>
          <Col span={6} style={{marginBottom: 24}}>
            <div
              className={styles.add}
              onClick={() => setRecord({links: [{}]})}>
              <PlusOutlined/>
              <span>新建</span>
            </div>
          </Col>
          {records.map(item => (
            <Col key={item.id} span={6} style={{marginBottom: 24}}>
              <Card hoverable actions={[
                <LeftSquareOutlined onClick={() => handleSort(item, 'up')}/>,
                <RightSquareOutlined onClick={() => handleSort(item, 'down')}/>,
                <EditOutlined onClick={() => setRecord(item)}/>
              ]}>
                <Card.Meta
                  avatar={<Avatar src={item.logo}/>}
                  title={item.title}
                  description={item.desc}/>
                <CloseOutlined className={styles.icon} onClick={() => handleDelete(item)}/>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Row gutter={24}>
          {records.map(item => (
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
      )}
      {record ? <NavForm record={record} onCancel={() => setRecord(null)} onOk={handleSubmit}/> : null}
    </Card>
  )
}

export default NavIndex