/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import { Button, Tag, message, PageHeader } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import store from './store';
import styles from './index.module.less';

const OutView = observer(({ onBack }) => {
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const termInstanceRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // WebSocket连接处理
  useEffect(() => {
    if (!store.showConsole || !store.token) return;

    // 初始化终端
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#2b2b2b',
        foreground: '#A9B7C6',
        cursor: '#A9B7C6'
      }
    });
    
    termInstanceRef.current = term;

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    // 打开终端
    if (termRef.current) {
      term.open(termRef.current);
      
      try {
        fitAddon.fit();
      } catch (e) {
        // 忽略错误
      }
      
      term.writeln('\r\n\x1b[36m### 正在连接Ansible执行服务器...\x1b[0m\r\n');
    }

    // 创建WebSocket连接
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/subscribe/${store.token}/`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        term.writeln('\r\n\x1b[32m### WebSocket连接已建立，等待执行结果...\x1b[0m\r\n');
        ws.send('ok');
      };

      ws.onmessage = (e) => {
        if (e.data === 'pong') {
          ws.send('ping');
          return;
        }
        
        try {
          const data = JSON.parse(e.data);
          if (data.key === 'all') {
            // 处理数据
            if (data.data) {
              term.write(data.data);
            }
            
            // 处理状态更新
            if (data.status !== undefined && store.outputs['all']) {
              store.outputs['all'].status = data.status;
            }
          }
        } catch (error) {
          term.writeln(`\r\n\x1b[31m### 数据解析错误 ###\x1b[0m\r\n`);
        }
      };

      ws.onerror = () => {
        term.writeln('\r\n\x1b[31m### WebSocket连接错误 ###\x1b[0m\r\n');
        setConnected(false);
      };

      ws.onclose = () => {
        term.writeln('\r\n\x1b[33m### WebSocket连接已关闭 ###\x1b[0m\r\n');
        setConnected(false);
      };
    } catch (error) {
      term.writeln(`\r\n\x1b[31m### 创建WebSocket连接失败: ${error.message} ###\x1b[0m\r\n`);
    }

    // 监听窗口大小变化
    const resizeHandler = () => {
      if (termInstanceRef.current) {
        try {
          const fitAddon = new FitAddon();
          termInstanceRef.current.loadAddon(fitAddon);
          fitAddon.fit();
        } catch (e) {
          // 忽略错误
        }
      }
    };
    
    window.addEventListener('resize', resizeHandler);

    // 清理函数
    return () => {
      window.removeEventListener('resize', resizeHandler);
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      if (termInstanceRef.current) {
        termInstanceRef.current.dispose();
        termInstanceRef.current = null;
      }
    };
  }, [store.showConsole, store.token]);

  // 获取状态标签
  const getStatusTag = (status) => {
    if (status === -2) return <Tag color="processing">执行中</Tag>;
    if (status === 0) return <Tag color="success">成功</Tag>;
    return <Tag color="error">失败</Tag>;
  };

  return (
    <div className={styles.output}>
      <PageHeader 
        title="Ansible执行控制台" 
        subTitle={
          <div>
            {store.outputs['all'] && getStatusTag(store.outputs['all'].status)}
            <Tag color={connected ? "success" : "warning"}>
              {connected ? "已连接" : "未连接"}
            </Tag>
          </div>
        }
        onBack={onBack}
        extra={[
          <Button key="refresh" icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            刷新页面
          </Button>
        ]}
      />
      <div className={styles.body} style={{width: '100%', padding: '0 16px 16px'}}>
        <div className={styles.termContainer} style={{height: 'calc(100vh - 280px)'}}>
          <div ref={termRef} className={styles.term} style={{height: '100%'}} />
        </div>
      </div>
    </div>
  );
});

export default OutView;