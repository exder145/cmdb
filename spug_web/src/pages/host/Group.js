/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { Input, Card, Tree, Dropdown, Menu, Switch, Tooltip, Spin, Modal, Form, message } from 'antd';
import {
  FolderOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  CloseOutlined,
  ScissorOutlined,
  LoadingOutlined,
  QuestionCircleOutlined,
  PlusOutlined,
  MoreOutlined,
  DownOutlined
} from '@ant-design/icons';
import { AuthFragment, AuthButton, Action } from 'components';
import { hasPermission, http } from 'libs';
import styles from './index.module.less';
import store from './store';
import lds from 'lodash';

// 定义不同资产类型的分组
const assetGroups = {
  server: {
    title: '主机分组',
    fetchGroups: () => store.fetchGroups(),
    treeData: () => store.treeData
  },
  instance: {
    title: '实例分组',
    fetchGroups: () => Promise.resolve(),
    treeData: () => [
      {
        title: '全部实例',
        key: 'all_instances',
        children: [
          { title: '运行中实例', key: 'running_instances' },
          { title: '已停止实例', key: 'stopped_instances' },
          { title: '包年包月实例', key: 'prepaid_instances' },
          { title: '按量计费实例', key: 'postpaid_instances' }
        ]
      }
    ]
  },
  disk: {
    title: '磁盘分组',
    fetchGroups: () => Promise.resolve(),
    treeData: () => [
      {
        title: '全部磁盘',
        key: 'all_disks',
        children: [
          { title: '系统盘', key: 'system_disks' },
          { title: '数据盘', key: 'data_disks' },
          { title: '备份盘', key: 'backup_disks' }
        ]
      }
    ]
  },
  storage: {
    title: '存储分组',
    fetchGroups: () => Promise.resolve(),
    treeData: () => [
      {
        title: '全部存储',
        key: 'all_storage',
        children: [
          { title: '对象存储', key: 'object_storage' },
          { title: '文件存储', key: 'file_storage' },
          { title: '块存储', key: 'block_storage' }
        ]
      }
    ]
  },
  cdn: {
    title: 'CDN分组',
    fetchGroups: () => Promise.resolve(),
    treeData: () => [
      {
        title: '全部CDN',
        key: 'all_cdn',
        children: [
          { title: '网页加速', key: 'web_cdn' },
          { title: '下载加速', key: 'download_cdn' },
          { title: '视频加速', key: 'video_cdn' }
        ]
      }
    ]
  },
  ip: {
    title: 'IP分组',
    fetchGroups: () => Promise.resolve(),
    treeData: () => [
      {
        title: '全部IP',
        key: 'all_ip',
        children: [
          { title: '公网IP', key: 'public_ip' },
          { title: '内网IP', key: 'private_ip' }
        ]
      }
    ]
  }
};

export const Group = observer(function ({ assetType = 'server' }) {
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState();
  const [visible, setVisible] = useState(false);
  const [draggable, setDraggable] = useState(false);
  const [action, setAction] = useState('');
  const [expands, setExpands] = useState([]);
  const [bakTreeData, setBakTreeData] = useState();
  const [form] = Form.useForm();
  const [editVisible, setEditVisible] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('新建分组');
  const [manageTitle, setManageTitle] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [treeKey, setTreeKey] = useState(1);

  useEffect(() => {
    if (assetType === 'server') {
      store.fetchGroups()
    } else {
      // 对于非服务器资产类型，设置默认分组
      const groupConfig = assetGroups[assetType] || assetGroups.server;
      const defaultTreeData = groupConfig.treeData();
      console.log('非服务器资产类型树形数据:', defaultTreeData);
      
      if (defaultTreeData && defaultTreeData.length > 0) {
        // 确保 group 对象具有正确的结构
        const defaultGroup = defaultTreeData[0];
        console.log('设置默认分组:', defaultGroup);
        
        if (defaultGroup && typeof defaultGroup === 'object') {
          // 设置当前分组
          store.group = defaultGroup;
          
          // 强制更新当前资产类型，触发数据重新渲染
          setTimeout(() => {
            // 获取数据
            store.getAssetDataSource(assetType)
              .then(result => {
                console.log(`获取${assetType}数据结果:`, result);
              })
              .catch(error => {
                console.error(`获取${assetType}数据出错:`, error);
              });
          }, 0);
        }
      }
    }
  }, [assetType])

  useEffect(() => {
    if (!isReady) {
      const length = store.treeData.length
      if (length > 0 && length < 5) {
        const tmp = store.treeData.filter(x => x.children.length)
        setExpands(tmp.map(x => x.key))
        setIsReady(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.treeData])

  function handleSubmit() {
    form.validateFields()
      .then(values => {
        let data = {
          title: values.title,
          parent_id: values.parent_id,
          is_parent: values.is_parent === '1'
        };
        if (drawerTitle === '新建分组') {
          http.post('/api/host/group/', data)
            .then(res => {
              message.success('添加成功');
              store.fetchGroups()
              setVisible(false)
            })
        } else {
          data['id'] = store.group.key;
          http.put('/api/host/group/', data)
            .then(res => {
              message.success('更新成功');
              store.fetchGroups()
              setVisible(false)
            })
        }
      })
  }

  function handleDelete() {
    Modal.confirm({
      title: '删除确认',
      content: `确定要删除【${store.group.title}】？`,
      onOk: () => {
        return http.delete('/api/host/group/', {params: {id: store.group.key}})
          .then(() => {
            message.success('删除成功');
            store.fetchGroups();
            if (store.treeData.length) {
              store.group = store.treeData[0]
            } else {
              store.group = {}
            }
          })
      }
    })
  }

  function handleEdit() {
    setDrawerTitle('编辑分组');
    setVisible(true);
    form.setFieldsValue({
      title: store.group.title,
      parent_id: store.group.parent_id,
      is_parent: store.group.is_parent ? '1' : '0'
    })
  }

  function handleManage() {
    setManageTitle(store.group.title);
    setManageVisible(true)
  }

  function handleClick(e, action) {
    if (action === '1') {
      setDrawerTitle('新建分组');
      setVisible(true);
      form.setFieldsValue({
        title: '',
        parent_id: undefined,
        is_parent: '0'
      })
    } else if (action === '2') {
      handleEdit()
    } else if (action === '3') {
      handleDelete()
    } else if (action === '4') {
      handleManage()
    } else if (action === '5') {
      store.showSelector(true)
    } else if (action === '6') {
      store.showSelector(false)
    }
  }

  function handleFilter(e) {
    setSearchValue(e.target.value);
    setTreeKey(treeKey + 1)
  }

  function handleSelect(_, info) {
    console.log('选择分组:', info.node);
    store.group = info.node;
    // 强制更新当前资产类型，触发数据重新渲染
    store.setAssetType(assetType);
  }

  // 获取当前资产类型的分组配置
  const groupConfig = assetGroups[assetType] || assetGroups.server;

  const menus = (
    <Menu onClick={() => setVisible(false)}>
      <Menu.Item key="0" icon={<FolderOutlined/>} onClick={handleAddRoot}>新建根分组</Menu.Item>
      <Menu.Item key="1" icon={<FolderAddOutlined/>} onClick={handleAdd}>新建子分组</Menu.Item>
      <Menu.Item key="2" icon={<EditOutlined/>} onClick={() => setAction('edit')}>重命名</Menu.Item>
      <Menu.Divider/>
      <Menu.Item key="3" icon={<CopyOutlined/>} onClick={() => store.showSelector(true)}>添加主机</Menu.Item>
      <Menu.Item key="4" icon={<ScissorOutlined/>} onClick={() => store.showSelector(false)}>移动主机</Menu.Item>
      <Menu.Item key="5" icon={<CloseOutlined/>} danger onClick={handleRemoveHosts}>删除主机</Menu.Item>
      <Menu.Divider/>
      <Menu.Item key="6" icon={<DeleteOutlined/>} danger onClick={handleRemove}>删除此分组</Menu.Item>
    </Menu>
  )

  function handleRemoveHosts() {
    const group = store.group;
    Modal.confirm({
      title: '操作确认',
      content: `批量删除【${group.title}】分组内的 ${store.counter[group.key].size} 个主机？`,
      onOk: () => http.delete('/api/host/', {params: {group_id: group.key}})
        .then(store.fetchRecords)
    })
  }

  function handleRemove() {
    setAction('del');
    setLoading(true);
    http.delete('/api/host/group/', {params: {id: store.group.key}})
      .finally(() => {
        setAction('');
        setLoading(false)
      })
  }

  function handleAddRoot() {
    setBakTreeData(lds.cloneDeep(store.rawTreeData));
    const current = {key: 0, parent_id: 0, title: '', children: []};
    store.rawTreeData.unshift(current);
    store.rawTreeData = lds.cloneDeep(store.rawTreeData);
    store.group = current;
    setAction('edit')
  }

  function handleAdd() {
    setBakTreeData(lds.cloneDeep(store.rawTreeData));
    const current = {key: 0, parent_id: store.group.key, title: '', children: []};
    const node = _find_node(store.rawTreeData, store.group.key)
    node.children.unshift(current)
    store.rawTreeData = lds.cloneDeep(store.rawTreeData);
    if (!expands.includes(store.group.key)) setExpands([store.group.key, ...expands]);
    store.group = current;
    setAction('edit')
  }

  function _find_node(list, key) {
    let node = lds.find(list, {key})
    if (node) return node
    for (let item of list) {
      node = _find_node(item.children, key)
      if (node) return node
    }
  }

  function handleDrag(v) {
    setLoading(true);
    const pos = v.node.pos.split('-');
    const dropPosition = v.dropPosition - Number(pos[pos.length - 1]);
    http.patch('/api/host/group/', {s_id: v.dragNode.key, d_id: v.node.key, action: dropPosition})
      .then(() => setLoading(false))
  }

  function handleRightClick(v) {
    if (hasPermission('admin')) {
      store.group = v.node;
      setVisible(true)
    }
  }

  function handleExpand(keys, {_, node}) {
    if (node.children.length > 0) {
      setExpands(keys)
    }
  }

  function treeRender(nodeData) {
    if (action === 'edit' && nodeData.key === store.group.key) {
      return <Input
        autoFocus
        size="small"
        style={{width: 'calc(100% - 24px)'}}
        defaultValue={nodeData.title}
        placeholder="请输入"
        suffix={loading ? <LoadingOutlined/> : <span/>}
        onClick={e => e.stopPropagation()}
        onBlur={handleSubmit}
        onChange={e => store.group.title = e.target.value}
        onPressEnter={handleSubmit}/>
    } else if (action === 'del' && nodeData.key === store.group.key) {
      return <LoadingOutlined style={{marginLeft: '4px'}}/>
    } else {
      const length = store.counter[nodeData.key]?.size
      return (
        <div className={styles.treeNode}>
          {expands.includes(nodeData.key) ? <FolderOpenOutlined/> : <FolderOutlined/>}
          <div className={styles.title}>{nodeData.title}</div>
          {length ? <div className={styles.number}>{length}</div> : null}
        </div>
      )
    }
  }

  const treeData = groupConfig.treeData();
  return (
    <Card
      title={groupConfig.title}
      className={styles.group}>
      {assetType === 'server' ? (
        <Spin spinning={store.grpFetching}>
          <Tree.DirectoryTree
            showIcon={false}
            autoExpandParent
            expandAction="doubleClick"
            treeData={treeData}
            titleRender={treeRender}
            expandedKeys={expands}
            selectedKeys={[store.group.key]}
            onSelect={(_, {node}) => store.group = node}
            onExpand={handleExpand}
          />
        </Spin>
      ) : (
        <Tree.DirectoryTree
          defaultExpandAll
          selectedKeys={[store.group.key]}
          expandAction="doubleClick"
          treeData={treeData}
          onSelect={handleSelect}
        />
      )}
      {treeData.length === 1 && treeData[0].children.length === 0 && (
        <div style={{color: '#999', marginTop: 20, textAlign: 'center'}}>右键点击分组进行分组管理哦~</div>
      )}
      {store.records && treeData.length === 0 && (
        <div style={{color: '#999'}}>你还没有可访问的主机分组，请联系管理员分配主机权限。</div>
      )}
      <Modal
        visible={visible}
        width={400}
        title={drawerTitle}
        onCancel={() => setVisible(false)}
        onOk={handleSubmit}>
        <Form form={form} labelCol={{span: 6}} wrapperCol={{span: 16}}>
          <Form.Item required name="title" label="分组名称">
            <Input placeholder="请输入分组名称"/>
          </Form.Item>
          <Form.Item name="parent_id" label="上级分组">
            <Input placeholder="请输入上级分组"/>
          </Form.Item>
          <Form.Item name="is_parent" label="分组类型">
            <Input placeholder="请输入分组类型"/>
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        visible={manageVisible}
        width={800}
        title={`${manageTitle} - 分组管理`}
        footer={null}
        onCancel={() => setManageVisible(false)}>
        <div>分组管理功能开发中...</div>
      </Modal>
    </Card>
  )
})

export default Group;
