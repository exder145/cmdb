/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect, useRef } from 'react';
import { AuthDiv, Breadcrumb } from 'components';
import { Card, Row, Col } from 'antd';
import { http } from 'libs';
import styles from './index.module.css';
import StatisticsCard from './StatisticCard';
import NavIndex from '../home/Nav';
import { CloudServerOutlined, DesktopOutlined, DollarOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

function Dashboard() {
  const [statistics, setStatistics] = useState({
    hostCount: 0,
    onlineCount: 0,
    expiringCount: 0,
    monthlyExpense: 0,
    yearlyCompute: 0,    // 添加年度计算资源费用
    yearlyStorage: 0,    // 添加年度存储资源费用
    yearlyNetwork: 0     // 添加年度网络资源费用
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const osChartRef = useRef(null);
  const configChartRef = useRef(null);
  const trendChartRef = useRef(null);
  const [trendViewMode, setTrendViewMode] = useState('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearOptions, setYearOptions] = useState([2022, 2023, 2024]);
  const [instanceStats, setInstanceStats] = useState({
    os_distribution: [],
    config_distribution: []
  });

  useEffect(() => {
    fetchStatistics().catch(err => {
      console.error('获取统计数据失败:', err);
    });

    // 动态加载Chart.js
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.async = true;
    script.onload = () => {
      setTimeout(() => {
        // 获取图表数据并渲染图表
        fetchInstanceStats();
        renderTrendChart();
      }, 300);
    };
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // 获取实例统计数据的函数
  const fetchInstanceStats = async () => {
    try {
      const res = await http.get('/api/host/stats/');
      if (res && res.os_distribution && res.config_distribution) {
        setInstanceStats(res);
        if (window.Chart) {
          renderOSChart(res.os_distribution);
          renderConfigChart(res.config_distribution);
        }
      }
    } catch (err) {
      console.error('获取实例统计数据失败:', err);
    }
  };

  // 当趋势视图模式或年份变化时重新渲染趋势图
  useEffect(() => {
    if (window.Chart) {
      // 由于renderTrendChart现在是异步的，我们需要这样调用它
      renderTrendChart().catch(err => {
        console.error('渲染趋势图表失败:', err);
      });
    }
  }, [trendViewMode, selectedYear]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      // 使用实际的API调用
      const res = await http.get('/api/dashboard/statistics');
      setStatistics(res);
    } catch (err) {
      console.error('获取统计数据失败:', err);
      setError('获取统计数据失败，请检查网络连接或刷新页面重试');
    } finally {
      setLoading(false);
    }
  };

  const renderOSChart = (osData = null) => {
    try {
      const container = document.getElementById('osChart');
      if (!container || !window.Chart) {
        console.error('找不到osChart容器或Chart.js未加载');
        return;
      }

      // 清除之前的图表实例
      if (osChartRef.current) {
        osChartRef.current.destroy();
      }

      const ctx = container.getContext('2d');
      
      // 使用API数据或使用默认数据
      let chartData;
      
      if (osData && osData.length > 0) {
        // 使用API返回的实际数据
        chartData = {
          labels: osData.map(item => item.name),
          datasets: [{
            data: osData.map(item => item.value),
            backgroundColor: [
              '#3498db',  // Ubuntu
              '#2ecc71',  // CentOS
              '#9b59b6',  // Windows Server
              '#34495e',  // Debian
              '#1abc9c',  // 其他
              '#e74c3c',  // 额外颜色1
              '#f39c12',  // 额外颜色2
              '#d35400'   // 额外颜色3
            ],
            borderWidth: 0,
            borderRadius: 4
          }]
        };
      } else {
        // 使用默认数据（仅作为备份，实际应从API获取）
        chartData = {
          labels: ['Ubuntu', 'CentOS', 'Windows Server', 'Debian', '其他'],
          datasets: [{
            data: [0, 0, 0, 0, 0],
            backgroundColor: [
              '#3498db',
              '#2ecc71',
              '#9b59b6',
              '#34495e',
              '#1abc9c'
            ],
            borderWidth: 0,
            borderRadius: 4
          }]
        };
      }
      
      osChartRef.current = new window.Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 10,
                boxWidth: 12,
                font: {
                  size: 11
                }
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('渲染操作系统图表失败:', err);
    }
  };

  const renderConfigChart = (configData = null) => {
    try {
      const container = document.getElementById('configChart');
      if (!container || !window.Chart) {
        console.error('找不到configChart容器或Chart.js未加载');
        return;
      }

      // 清除之前的图表实例
      if (configChartRef.current) {
        configChartRef.current.destroy();
      }

      const ctx = container.getContext('2d');
      
      // 使用API数据或使用默认数据
      let chartData;
      
      if (configData && configData.length > 0) {
        // 为了保持顺序一致性，我们定义一个标准顺序
        const standardOrder = ['2核4G', '2核8G', '4核8G', '8核16G', '16核32G', '其他'];
        
        // 整理数据，确保它们按照标准顺序排列
        const orderedData = standardOrder.map(configName => {
          const found = configData.find(item => item.name === configName);
          return found ? found.value : 0;
        });
        
        // 查找可能在标准顺序之外的配置
        const extraConfigs = configData.filter(item => !standardOrder.includes(item.name));
        
        // 合并额外配置到"其他"类别
        if (extraConfigs.length > 0) {
          const otherIndex = standardOrder.indexOf('其他');
          if (otherIndex !== -1) {
            orderedData[otherIndex] += extraConfigs.reduce((sum, item) => sum + item.value, 0);
          }
        }
        
        chartData = {
          labels: standardOrder,
          datasets: [{
            label: '服务器数量',
            data: orderedData,
            backgroundColor: [
              '#3498db',
              '#2980b9',
              '#1abc9c',
              '#16a085',
              '#34495e',
              '#2c3e50'
            ],
            borderWidth: 0,
            borderRadius: 6,
            maxBarThickness: 40
          }]
        };
      } else {
        // 使用默认数据（仅作为备份，实际应从API获取）
        chartData = {
          labels: ['2核4G', '2核8G', '4核8G', '8核16G', '16核32G', '其他'],
          datasets: [{
            label: '服务器数量',
            data: [0, 0, 0, 0, 0, 0],
            backgroundColor: [
              '#3498db',
              '#2980b9',
              '#1abc9c',
              '#16a085',
              '#34495e',
              '#2c3e50'
            ],
            borderWidth: 0,
            borderRadius: 6,
            maxBarThickness: 40
          }]
        };
      }
      
      configChartRef.current = new window.Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              bottom: 10
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                display: true,
                color: '#ecf0f1'
              },
              ticks: {
                font: {
                  size: 12
                }
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                font: {
                  size: 11
                },
                maxRotation: 0,
                minRotation: 0
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    } catch (err) {
      console.error('渲染配置图表失败:', err);
    }
  };

  // 渲染成本趋势图表
  const renderTrendChart = async () => {
    try {
      const container = document.getElementById('trendChart');
      if (!container || !window.Chart) {
        console.error('找不到trendChart容器或Chart.js未加载');
        return;
      }

      // 清除之前的图表实例
      if (trendChartRef.current) {
        trendChartRef.current.destroy();
      }

      const ctx = container.getContext('2d');
      
      // 根据视图模式选择不同的数据和配置
      if (trendViewMode === 'month') {
        // 尝试从缓存获取数据
        const cacheKey = `cost_trend_monthly_${selectedYear}`;
        let monthlyData = null;
        
        const cachedData = localStorage.getItem(cacheKey);
        const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
        const now = Date.now();
        const cacheExpiry = 60 * 60 * 1000; // 1小时缓存过期
        
        if (cachedData && cacheTimestamp && (now - parseInt(cacheTimestamp) < cacheExpiry)) {
          console.log('使用缓存的月度成本趋势数据');
          monthlyData = JSON.parse(cachedData);
        } else {
          console.log('从API获取月度成本趋势数据');
          // 设置加载状态
          setLoading(true);
          
          try {
            // 从API获取真实数据
            const response = await http.get('/api/host/cost/trend/', {
              params: {
                year: selectedYear,
                mode: 'monthly'
              }
            });
            
            if (!response || !response.compute || !response.storage || !response.network) {
              throw new Error('API返回数据格式错误');
            }
            
            // 处理API返回的数据
            monthlyData = {
              labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
              datasets: [
                {
                  label: '计算资源',
                  data: response.compute,
                  borderColor: '#3498db',
                  backgroundColor: 'rgba(52, 152, 219, 0.1)',
                  borderWidth: 2,
                  tension: 0.3,
                  fill: true
                },
                {
                  label: '存储资源',
                  data: response.storage,
                  backgroundColor: 'rgba(46, 204, 113, 0.1)',
                  borderColor: '#2ecc71',
                  borderWidth: 2,
                  tension: 0.3,
                  fill: true
                },
                {
                  label: '网络资源',
                  data: response.network,
                  borderColor: '#e67e22',
                  backgroundColor: 'rgba(230, 126, 34, 0.1)',
                  borderWidth: 2,
                  tension: 0.3,
                  fill: true
                }
              ]
            };
            
            // 缓存数据
            localStorage.setItem(cacheKey, JSON.stringify(monthlyData));
            localStorage.setItem(`${cacheKey}_timestamp`, now.toString());
          } catch (error) {
            console.error('获取成本趋势数据失败:', error);
            
            // 如果API请求失败，使用上次缓存的数据（如果有）
            if (cachedData) {
              console.log('使用过期的缓存数据');
              monthlyData = JSON.parse(cachedData);
            } else {
              // API失败且无缓存数据时，返回空数据结构
              monthlyData = {
          labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
          datasets: [
            {
              label: '计算资源',
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              borderColor: '#3498db',
              backgroundColor: 'rgba(52, 152, 219, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true
            },
            {
              label: '存储资源',
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              borderColor: '#2ecc71',
              backgroundColor: 'rgba(46, 204, 113, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true
            },
            {
              label: '网络资源',
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              borderColor: '#e67e22',
              backgroundColor: 'rgba(230, 126, 34, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true
            }
          ]
        };
            }
          } finally {
            // 清除加载状态
            setLoading(false);
          }
        }

        trendChartRef.current = new window.Chart(ctx, {
          type: 'line',
          data: monthlyData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
              padding: {
                bottom: 15
              }
            },
            plugins: {
              title: {
                display: true,
                text: `${selectedYear}年月度成本趋势`,
                font: {
                  size: 16
                },
                padding: {
                  top: 10,
                  bottom: 15
                }
              },
              tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                  label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                      label += ': ';
                    }
                    if (context.parsed.y !== null) {
                      label += '¥' + context.parsed.y.toLocaleString();
                    }
                    return label;
                  }
                }
              },
              legend: {
                position: 'top',
                labels: {
                  usePointStyle: true,
                  padding: 15
                }
              }
            },
            scales: {
              y: {
                beginAtZero: false,
                grid: {
                  drawBorder: false,
                  color: '#ecf0f1'
                },
                ticks: {
                  callback: function(value) {
                    return '¥' + value.toLocaleString();
                  }
                }
              },
              x: {
                grid: {
                  display: false
                }
              }
            }
          }
        });
      } else {
        // 年度视图数据处理逻辑
        // 尝试从缓存获取数据
        const cacheKey = 'cost_trend_yearly';
        let yearlyData = null;
        
        const cachedData = localStorage.getItem(cacheKey);
        const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
        const now = Date.now();
        const cacheExpiry = 24 * 60 * 60 * 1000; // 24小时缓存过期
        
        if (cachedData && cacheTimestamp && (now - parseInt(cacheTimestamp) < cacheExpiry)) {
          console.log('使用缓存的年度成本趋势数据');
          yearlyData = JSON.parse(cachedData);
        } else {
          console.log('从API获取年度成本趋势数据');
          // 设置加载状态
          setLoading(true);
          
          try {
            // 从API获取真实数据
            const response = await http.get('/api/host/cost/trend/', {
              params: {
                mode: 'yearly'
              }
            });
            
            if (!response || !response.years || !response.compute || !response.storage || !response.network) {
              throw new Error('API返回数据格式错误');
            }

            // 获取当前年份索引，用于区分历史数据和预测数据
            const currentYear = new Date().getFullYear();
            const currentYearIndex = response.years.indexOf(currentYear.toString());
            
            // 处理API返回的数据
            yearlyData = {
              labels: response.years,
              datasets: [
                {
                  label: '计算资源',
                  data: response.compute.slice(0, currentYearIndex + 1),
                  borderColor: '#3498db',
                  backgroundColor: 'rgba(52, 152, 219, 0.1)',
                  borderWidth: 2,
                  tension: 0.3,
                  fill: true,
                  segment: {
                    borderDash: ctx => ctx.p0.parsed.x >= currentYearIndex ? [6, 6] : undefined,
                  }
                },
                {
                  label: '计算资源 (预测)',
                  data: Array(currentYearIndex + 1).fill(null).concat(response.compute.slice(currentYearIndex)),
                  borderColor: '#3498db',
                  borderDash: [6, 6],
                  borderWidth: 2,
                  tension: 0.3,
                  pointStyle: 'circle',
                  pointRadius: 3,
                  fill: false
                },
                {
                  label: '存储资源',
                  data: response.storage.slice(0, currentYearIndex + 1),
                  borderColor: '#2ecc71',
                  backgroundColor: 'rgba(46, 204, 113, 0.1)',
                  borderWidth: 2,
                  tension: 0.3,
                  fill: true,
                  segment: {
                    borderDash: ctx => ctx.p0.parsed.x >= currentYearIndex ? [6, 6] : undefined,
                  }
                },
                {
                  label: '存储资源 (预测)',
                  data: Array(currentYearIndex + 1).fill(null).concat(response.storage.slice(currentYearIndex)),
                  borderColor: '#2ecc71',
                  borderDash: [6, 6],
                  borderWidth: 2,
                  tension: 0.3,
                  pointStyle: 'circle',
                  pointRadius: 3,
                  fill: false
                },
                {
                  label: '网络资源',
                  data: response.network.slice(0, currentYearIndex + 1),
                  borderColor: '#e67e22',
                  backgroundColor: 'rgba(230, 126, 34, 0.1)',
                  borderWidth: 2,
                  tension: 0.3,
                  fill: true,
                  segment: {
                    borderDash: ctx => ctx.p0.parsed.x >= currentYearIndex ? [6, 6] : undefined,
                  }
                },
                {
                  label: '网络资源 (预测)',
                  data: Array(currentYearIndex + 1).fill(null).concat(response.network.slice(currentYearIndex)),
                  borderColor: '#e67e22',
                  borderDash: [6, 6],
                  borderWidth: 2,
                  tension: 0.3,
                  pointStyle: 'circle',
                  pointRadius: 3,
                  fill: false
                }
              ]
            };
            
            // 缓存数据
            localStorage.setItem(cacheKey, JSON.stringify(yearlyData));
            localStorage.setItem(`${cacheKey}_timestamp`, now.toString());
          } catch (error) {
            console.error('获取成本趋势数据失败:', error);
            
            // 如果API请求失败，使用上次缓存的数据（如果有）
            if (cachedData) {
              console.log('使用过期的缓存数据');
              yearlyData = JSON.parse(cachedData);
            } else {
              // API失败且无缓存数据时，返回空数据结构
              yearlyData = {
                labels: ['2021', '2022', '2023', '2024', '2025', '2026'],
                datasets: [
                  {
                    label: '计算资源',
                    data: [0, 0, 0, 0, null, null],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    segment: {
                      borderDash: ctx => ctx.p0.parsed.x >= 3 ? [6, 6] : undefined,
                    }
                  },
                  {
                    label: '计算资源 (预测)',
                    data: [null, null, null, 0, 0, 0],
                    borderColor: '#3498db',
                    borderDash: [6, 6],
                    borderWidth: 2,
                    tension: 0.3,
                    pointStyle: 'circle',
                    pointRadius: 3,
                    fill: false
                  },
                  {
                    label: '存储资源',
                    data: [0, 0, 0, 0, null, null],
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    segment: {
                      borderDash: ctx => ctx.p0.parsed.x >= 3 ? [6, 6] : undefined,
                    }
                  },
                  {
                    label: '存储资源 (预测)',
                    data: [null, null, null, 0, 0, 0],
                    borderColor: '#2ecc71',
                    borderDash: [6, 6],
                    borderWidth: 2,
                    tension: 0.3,
                    pointStyle: 'circle',
                    pointRadius: 3,
                    fill: false
                  },
                  {
                    label: '网络资源',
                    data: [0, 0, 0, 0, null, null],
                    borderColor: '#e67e22',
                    backgroundColor: 'rgba(230, 126, 34, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    segment: {
                      borderDash: ctx => ctx.p0.parsed.x >= 3 ? [6, 6] : undefined,
                    }
                  },
                  {
                    label: '网络资源 (预测)',
                    data: [null, null, null, 0, 0, 0],
                    borderColor: '#e67e22',
                    borderDash: [6, 6],
                    borderWidth: 2,
                    tension: 0.3,
                    pointStyle: 'circle',
                    pointRadius: 3,
                    fill: false
                  }
                ]
              };
            }
          } finally {
            // 清除加载状态
            setLoading(false);
          }
        }

        trendChartRef.current = new window.Chart(ctx, {
          type: 'line',
          data: yearlyData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
              padding: {
                bottom: 15
              }
            },
            plugins: {
              title: {
                display: true,
                text: '年度成本趋势与预测',
                font: {
                  size: 16
                },
                padding: {
                  top: 10,
                  bottom: 15
                }
              },
              tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                  label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                      label += ': ';
                    }
                    if (context.parsed.y !== null) {
                      label += '¥' + context.parsed.y.toLocaleString();
                    }
                    return label;
                  }
                }
              },
              legend: {
                position: 'top',
                labels: {
                  usePointStyle: true,
                  padding: 15
                }
              }
            },
            scales: {
              y: {
                beginAtZero: false,
                grid: {
                  drawBorder: false,
                  color: '#ecf0f1'
                },
                ticks: {
                  callback: function(value) {
                    return '¥' + value.toLocaleString();
                  }
                }
              },
              x: {
                grid: {
                  display: false
                }
              }
            }
          }
        });
      }
    } catch (err) {
      console.error('渲染成本趋势图表失败:', err);
    }
  };

  // 当组件卸载时清理图表实例
  useEffect(() => {
    return () => {
      if (osChartRef.current) {
        osChartRef.current.destroy();
      }
      if (configChartRef.current) {
        configChartRef.current.destroy();
      }
      if (trendChartRef.current) {
        trendChartRef.current.destroy();
      }
    };
  }, []);

    return (
      <AuthDiv auth="dashboard.dashboard.view">
      <Breadcrumb>
        <Breadcrumb.Item>首页</Breadcrumb.Item>
        <Breadcrumb.Item>Dashboard</Breadcrumb.Item>
      </Breadcrumb>
      <div className={styles.container}>
        <Row gutter={24} className={styles.statisticsRow}>
          <Col xs={24} sm={12} md={6}>
            <StatisticsCard 
              title="主机总数" 
              value={statistics.hostCount} 
              icon={<CloudServerOutlined />} 
              iconBackground="#3498db" 
              loading={loading}
              description="所有管理的服务器数量" 
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <StatisticsCard 
              title="在线主机" 
              value={statistics.onlineCount} 
              icon={<DesktopOutlined />} 
              iconBackground="#2ecc71" 
              loading={loading}
              description="当前在线的服务器数量" 
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <StatisticsCard 
              title="即将到期" 
              value={statistics.expiringCount} 
              icon={<ExclamationCircleOutlined />} 
              iconBackground="#e74c3c" 
              loading={loading}
              description="30天内到期的服务器数量" 
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <StatisticsCard 
              title="上个月支出" 
              value={`¥${statistics.monthlyExpense}`} 
              icon={<DollarOutlined />} 
              iconBackground="#9b59b6" 
              loading={loading}
              description="上个月实际支出总额" 
            />
          </Col>
        </Row>

        <Row gutter={24} className={styles.chartRow}>
          <Col xs={24} md={6}>
            <Card title="操作系统分布" className={styles.chartCard}>
              <div className={styles.chartContainer}>
                <canvas id="osChart"></canvas>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={10}>
            <Card title="服务器配置分布" className={styles.chartCard}>
              <div className={styles.chartContainer}>
                <canvas id="configChart"></canvas>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card title="资源到期提醒" className={styles.expiryCard}>
              {/* 到期提醒内容 */}
              <ul className={styles.expiryList}>
                <li className={styles.expiryItem}>
                  <div className={styles.expiryInfo}>
                    <div className={styles.expiryIcon} style={{backgroundColor: '#e74c3c'}}>
                      <CloudServerOutlined />
                    </div>
                    <div className={styles.expiryName}>web-server-01</div>
                  </div>
                  <div className={styles.expiryDate}>将在 3 天后到期</div>
                </li>
                <li className={styles.expiryItem}>
                  <div className={styles.expiryInfo}>
                    <div className={styles.expiryIcon} style={{backgroundColor: '#e74c3c'}}>
                      <CloudServerOutlined />
                    </div>
                    <div className={styles.expiryName}>db-master-02</div>
                  </div>
                  <div className={styles.expiryDate}>将在 5 天后到期</div>
                </li>
                <li className={styles.expiryItem}>
                  <div className={styles.expiryInfo}>
                    <div className={styles.expiryIcon} style={{backgroundColor: '#f39c12'}}>
                      <CloudServerOutlined />
                    </div>
                    <div className={styles.expiryName}>proxy-server-01</div>
                  </div>
                  <div className={styles.expiryDate}>将在 12 天后到期</div>
                </li>
              </ul>
            </Card>
          </Col>
        </Row>

        <Row gutter={24} className={styles.chartRow}>
          <Col xs={24} md={8}>
            <Card title="费用分析" className={styles.costCard}>
              <div className={styles.costContent}>
                <ul className={styles.costList}>
                  <li className={styles.costItem}>
                    <div className={styles.costInfo}>
                      <div className={styles.costName}>计算资源</div>
                      <div className={styles.costDesc}>服务器实例年度费用</div>
                    </div>
                    <div className={styles.costValue}>¥{statistics.yearlyCompute.toLocaleString()}</div>
                  </li>
                  <li className={styles.costItem}>
                    <div className={styles.costInfo}>
                      <div className={styles.costName}>存储资源</div>
                      <div className={styles.costDesc}>云硬盘、对象存储年度费用</div>
                    </div>
                    <div className={styles.costValue}>¥{statistics.yearlyStorage.toLocaleString()}</div>
                  </li>
                  <li className={styles.costItem}>
                    <div className={styles.costInfo}>
                      <div className={styles.costName}>网络资源</div>
                      <div className={styles.costDesc}>带宽、流量年度费用</div>
                    </div>
                    <div className={styles.costValue}>¥{statistics.yearlyNetwork.toLocaleString()}</div>
                  </li>
                </ul>

                <div className={styles.budgetProgress}>
                  <div className={styles.budgetHeader}>
                    <div className={styles.budgetTitle}>年度预算使用情况</div>
                    <div className={styles.budgetValue}>
                      ¥{(statistics.yearlyCompute + statistics.yearlyStorage + statistics.yearlyNetwork).toLocaleString()} / ¥600,000
                    </div>
                  </div>
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill} 
                      style={{
                        width: `${Math.min(100, ((statistics.yearlyCompute + statistics.yearlyStorage + statistics.yearlyNetwork) / 600000) * 100)}%`, 
                        backgroundColor: '#3498db'
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={16}>
            <Card 
              title="成本趋势" 
              className={styles.costTrendCard}
              extra={
                <div>
                  <span 
                    className={styles.spanButton + (trendViewMode === 'month' ? ' ' + styles.spanButtonActive : '')}
                    onClick={() => setTrendViewMode('month')}
                  >
                    月度视图
                  </span>
                  <span 
                    className={styles.spanButton + (trendViewMode === 'year' ? ' ' + styles.spanButtonActive : '')}
                    onClick={() => setTrendViewMode('year')}
                  >
                    年度视图
                  </span>
                  {trendViewMode === 'month' && (
                    <select 
                      value={selectedYear} 
                      onChange={e => setSelectedYear(e.target.value)}
                      className={styles.yearSelector}
                    >
                      {yearOptions.map(year => (
                        <option key={year} value={year}>{year}年</option>
                      ))}
                    </select>
                  )}
                </div>
              }
            >
              <div className={styles.trendChartContainer}>
                <canvas id="trendChart"></canvas>
              </div>
            </Card>
          </Col>
        </Row>
        
        <Row gutter={24} className={styles.chartRow}>
          <Col xs={24}>
            <NavIndex/>
          </Col>
        </Row>
      </div>
      </AuthDiv>
  );
}

export default Dashboard;
