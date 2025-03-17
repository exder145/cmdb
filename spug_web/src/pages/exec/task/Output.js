/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import { PageHeader } from 'antd';
import {
  LoadingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CodeOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { FitAddon } from 'xterm-addon-fit';
import { Terminal } from 'xterm';
import style from './index.module.less';
import { http, X_TOKEN } from 'libs';
import store from './store';
import gStore from 'gStore';

let gCurrent;

function OutView(props) {
  const el = useRef()
  const [term] = useState(new Terminal());
  const [fitPlugin] = useState(new FitAddon());
  const [current, setCurrent] = useState(Object.keys(store.outputs)[0])

  useEffect(() => {
    store.tag = ''
    gCurrent = current
    term.setOption('disableStdin', true)
    term.setOption('fontSize', gStore.terminal.fontSize)
    term.setOption('fontFamily', gStore.terminal.fontFamily)
    term.setOption('theme', {background: '#2b2b2b', foreground: '#A9B7C6', cursor: '#2b2b2b'})
    term.attachCustomKeyEventHandler((arg) => {
      if (arg.ctrlKey && arg.code === 'KeyC' && arg.type === 'keydown') {
        document.execCommand('copy')
        return false
      }
      return true
    })
    term.loadAddon(fitPlugin)
    term.open(el.current)
    fitPlugin.fit()
    term.write('\x1b[36m### Ansible Playbook 执行准备中...\x1b[0m')
    const resize = () => fitPlugin.fit();
    window.addEventListener('resize', resize)

    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws/subscribe/${store.token}/?x-token=${X_TOKEN}`);
    socket.onopen = () => {
      const message = '\r\x1b[K\x1b[36m### 等待Ansible Playbook执行调度...\x1b[0m'
      for (let key of Object.keys(store.outputs)) {
        store.outputs[key].data = message
      }
      term.write(message)
      socket.send('ok');
      fitPlugin.fit()
      const formData = fitPlugin.proposeDimensions()
      formData.token = store.token
      http.patch('/api/exec/do/', formData)
    }
    socket.onmessage = e => {
      if (e.data === 'pong') {
        socket.send('ping')
      } else {
        _handleData(e.data)
      }
    }
    socket.onclose = () => {
      for (let key of Object.keys(store.outputs)) {
        if (store.outputs[key].status === -2) {
          store.outputs[key].status = -1
        }
        store.outputs[key].data += '\r\n\x1b[31mWebsocket连接失败!\x1b[0m'
        term.write('\r\n\x1b[31mWebsocket连接失败!\x1b[0m')
      }
    }
    return () => socket && socket.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function _handleData(message) {
    const {key, data, status} = JSON.parse(message);
    if (status !== undefined) {
      store.outputs[key].status = status;
    }
    if (data) {
      // 处理Ansible输出的特殊格式
      let formattedData = data;
      if (data.includes('TASK [')) {
        formattedData = `\r\n\x1b[1;33m${data}\x1b[0m`;  // 黄色加粗显示任务名
      } else if (data.includes('PLAY [')) {
        formattedData = `\r\n\x1b[1;34m${data}\x1b[0m`;  // 蓝色加粗显示Play名
      } else if (data.includes('ok:') || data.includes('changed:')) {
        formattedData = `\x1b[32m${data}\x1b[0m`;  // 绿色显示成功状态
      } else if (data.includes('failed:') || data.includes('fatal:')) {
        formattedData = `\x1b[31m${data}\x1b[0m`;  // 红色显示失败状态
      } else if (data.includes('skipping:')) {
        formattedData = `\x1b[36m${data}\x1b[0m`;  // 青色显示跳过状态
      }
      
      store.outputs[key].data += formattedData
      if (String(key) === gCurrent) term.write(formattedData)
    }
  }

  function handleSwitch(key) {
    setCurrent(key)
    gCurrent = key
    term.clear()
    term.write(store.outputs[key].data)
  }

  function openTerminal(key) {
    window.open(`/ssh?id=${key}`)
  }

  const {tag, items, counter} = store
  return (
    <div className={style.output}>
      <div className={style.side}>
        <PageHeader onBack={props.onBack} title="Ansible执行详情"/>
        <div className={style.tags}>
          <div
            className={`${style.item} ${tag === '0' ? style.pendingOn : style.pending}`}
            onClick={() => store.updateTag('0')}>
            <ClockCircleOutlined/>
            <div>{counter['0']}</div>
          </div>
          <div
            className={`${style.item} ${tag === '1' ? style.successOn : style.success}`}
            onClick={() => store.updateTag('1')}>
            <CheckCircleOutlined/>
            <div>{counter['1']}</div>
          </div>
          <div
            className={`${style.item} ${tag === '2' ? style.failOn : style.fail}`}
            onClick={() => store.updateTag('2')}>
            <ExclamationCircleOutlined/>
            <div>{counter['2']}</div>
          </div>
        </div>

        <div className={style.list}>
          {items.map(([key, item]) => (
            <div key={key} className={[style.item, key === current ? style.active : ''].join(' ')}
                 onClick={() => handleSwitch(key)}>
              {item.status === -2 ? (
                <LoadingOutlined style={{color: '#1890ff'}}/>
              ) : item.status === 0 ? (
                <CheckCircleOutlined style={{color: '#52c41a'}}/>
              ) : (
                <ExclamationCircleOutlined style={{color: 'red'}}/>
              )}
              <div className={style.text}>{item.title}</div>
            </div>
          ))}
        </div>
      </div>
      <div className={style.body}>
        <div className={style.header}>
          <div className={style.title}>{store.outputs[current].title}</div>
          <CodeOutlined className={style.icon} onClick={() => openTerminal(current)}/>
        </div>
        <div className={style.termContainer}>
          <div ref={el} className={style.term}/>
        </div>
      </div>
    </div>
  )
}

export default observer(OutView)