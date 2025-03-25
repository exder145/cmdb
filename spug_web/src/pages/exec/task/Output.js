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
import { http } from 'libs';
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
      // 使用轮询方式获取结果
      term.writeln('\r\n\x1b[36m### 使用轮询方式获取Ansible执行结果... ###\x1b[0m\r\n');
      
      // 设置连接状态
      setConnected(true);
      
      // 缓存上一次输出长度
      let lastOutputLength = 0;
      let retryCount = 0;
      
      // 使用简单轮询获取结果
      const pollInterval = setInterval(() => {
        // 直接使用完整URL，避免路由问题
        fetch(`http://192.168.75.140:8000/exec/ansible/result/${store.token}/`, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        })
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            retryCount = 0; // 重置重试计数
            
            if (data.output && data.output.length > lastOutputLength) {
              // 只显示新增的输出
              let newOutput = data.output.substring(lastOutputLength);
              
              // 美化输出，增强可读性
              newOutput = newOutput
                .replace(/PLAY \[(.*?)\]/g, '\r\n\x1b[32m====== PLAY [$1] ======\x1b[0m\r\n')
                .replace(/TASK \[(.*?)\]/g, '\r\n\x1b[36m------ TASK [$1] ------\x1b[0m\r\n')
                .replace(/PLAY RECAP/g, '\r\n\x1b[33m====== PLAY RECAP ======\x1b[0m\r\n');
                
              term.write(newOutput);
              lastOutputLength = data.output.length;
            }
            
            // 处理状态更新
            if (data.status !== undefined && store.outputs['all']) {
              store.outputs['all'].status = data.status;
              
              // 如果执行完成，停止轮询
              if (data.status !== -2) {
                clearInterval(pollInterval);
              }
            }
          })
          .catch(error => {
            retryCount++;
            console.error(`轮询获取结果失败(${retryCount}/5): ${error.message}`);
            
            // 如果连续失败5次，显示错误并停止轮询
            if (retryCount >= 5) {
              term.writeln(`\r\n\x1b[31m### 无法获取执行结果，请检查后端服务 ###\x1b[0m\r\n`);
              clearInterval(pollInterval);
              setConnected(false);
            }
          });
      }, 1000);
      
      // 清理定时器
      return () => {
        clearInterval(pollInterval);
      };
    } catch (error) {
      term.writeln(`\r\n\x1b[31m### 创建轮询连接失败: ${error.message} ###\x1b[0m\r\n`);
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
          <Button key="refresh" icon={<ReloadOutlined />} onClick={() => {
            // 使用React状态刷新而不是重载页面
            setConnected(false);
            if (termInstanceRef.current) {
              termInstanceRef.current.clear();
            }
            
            // 延迟100ms后重建连接
            setTimeout(() => {
              if (termInstanceRef.current) {
                termInstanceRef.current.write('\r\n\x1b[36m### 正在重新连接... ###\x1b[0m\r\n');
              }
              
              // 重置状态
              let lastOutputLength = 0;
              let retryCount = 0;
              setConnected(true);
              
              // 重新获取执行结果
              const pollInterval = setInterval(() => {
                fetch(`http://192.168.75.140:8000/exec/ansible/result/${store.token}/`, {
                  method: 'GET',
                  mode: 'cors',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                  },
                })
                  .then(response => {
                    if (!response.ok) {
                      throw new Error(`HTTP error ${response.status}`);
                    }
                    return response.json();
                  })
                  .then(data => {
                    retryCount = 0;
                    
                    if (data.output && data.output.length > lastOutputLength) {
                      // 只显示新增的输出
                      let newOutput = data.output.substring(lastOutputLength);
                      
                      // 美化输出，增强可读性
                      newOutput = newOutput
                        .replace(/PLAY \[(.*?)\]/g, '\r\n\x1b[32m====== PLAY [$1] ======\x1b[0m\r\n')
                        .replace(/TASK \[(.*?)\]/g, '\r\n\x1b[36m------ TASK [$1] ------\x1b[0m\r\n')
                        .replace(/PLAY RECAP/g, '\r\n\x1b[33m====== PLAY RECAP ======\x1b[0m\r\n');
                        
                      termInstanceRef.current.write(newOutput);
                      lastOutputLength = data.output.length;
                    }
                    
                    // 处理状态更新
                    if (data.status !== undefined && store.outputs['all']) {
                      store.outputs['all'].status = data.status;
                      
                      // 如果执行完成，停止轮询
                      if (data.status !== -2) {
                        clearInterval(pollInterval);
                      }
                    }
                  })
                  .catch(error => {
                    retryCount++;
                    console.error(`轮询获取结果失败(${retryCount}/5): ${error.message}`);
                    
                    // 如果连续失败5次，显示错误并停止轮询
                    if (retryCount >= 5) {
                      termInstanceRef.current.writeln(`\r\n\x1b[31m### 无法获取执行结果，请检查后端服务 ###\x1b[0m\r\n`);
                      clearInterval(pollInterval);
                      setConnected(false);
                    }
                  });
              }, 1000);
            }, 100);
          }}>
            刷新内容
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