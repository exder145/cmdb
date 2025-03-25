/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
const proxy = require('http-proxy-middleware');

module.exports = function (app) {
  // 直接使用虚拟机IP作为目标
  const target = 'http://192.168.75.140:8000';
  
  // 定义所有需要代理的API路径
  const paths = [
    '/account',
    '/host',
    '/exec',
    '/schedule',
    '/monitor',
    '/setting',
    '/config',
    '/app',
    '/deploy',
    '/repository',
    '/home',
    '/notify',
    '/file',
    '/apis'
  ];
  
  // 为每个路径创建代理
  paths.forEach(path => {
    app.use(
      path,
      proxy({
        target: target,
        changeOrigin: true,
        headers: {
          'X-Real-IP': '127.0.0.1',
          'X-Forwarded-For': '127.0.0.1'
        }
      })
    );
  });
  
  // 单独处理websocket连接
  app.use(
    '/ws',
    proxy({
      target: target,
      changeOrigin: true,
      ws: true,
      headers: {
        'X-Real-IP': '127.0.0.1',
        'X-Forwarded-For': '127.0.0.1'
      }
    })
  );
};
