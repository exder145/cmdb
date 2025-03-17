// 确保 process 对象在全局范围内可用
if (typeof window !== 'undefined' && !window.process) {
  window.process = {
    env: {
      NODE_ENV: 'development',
      PUBLIC_URL: '',
      REACT_APP_ENV: 'development'
    },
    browser: true
  };
}

export default {}; 