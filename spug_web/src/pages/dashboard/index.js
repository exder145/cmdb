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
    monthlyExpense: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const osChartRef = useRef(null);
  const configChartRef = useRef(null);
  const trendChartRef = useRef(null);
  const [trendViewMode, setTrendViewMode] = useState('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearOptions, setYearOptions] = useState([2023, 2024, 2025]);
  const [costData, setCostData] = useState({
    yearlyCompute: 101400,
    yearlyStorage: 25440,
    yearlyNetwork: 22320
  });

  useEffect(() => {
    fetchStatistics();
    
    // 动态加载Chart.js
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.async = true;
    script.onload = () => {
      setTimeout(() => {
        renderOSChart();
        renderConfigChart();
        renderTrendChart();
      }, 300);
    };
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // 当趋势视图模式或年份变化时重新渲染趋势图
  useEffect(() => {
    if (window.Chart && trendChartRef.current) {
      renderTrendChart();
    }
  }, [trendViewMode, selectedYear]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      // 这里可以替换为实际的API调用
      // const res = await http.get('/api/dashboard/statistics');
      // setStatistics(res);
      
      // 模拟数据
      setStatistics({
        hostCount: 70,
        onlineCount: 65,
        expiringCount: 5,
        monthlyExpense: 12680
      });
    } catch (err) {
      console.error('获取统计数据失败:', err);
      setError('获取统计数据失败，请检查网络连接或刷新页面重试');
    } finally {
      setLoading(false);
    }
  };

  const renderOSChart = () => {
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
      
      osChartRef.current = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Ubuntu', 'CentOS', 'Windows Server', 'Debian', '其他'],
          datasets: [{
            data: [35, 20, 10, 3, 2],
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
        },
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

  const renderConfigChart = () => {
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
      
      configChartRef.current = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['2核4G', '2核8G', '4核8G', '8核16G', '16核32G', '其他'],
          datasets: [{
            label: '服务器数量',
            data: [15, 25, 18, 8, 3, 1],
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
        },
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
  const renderTrendChart = () => {
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
        // 月度视图数据
        const monthlyData = {
          labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
          datasets: [
            {
              label: '计算资源',
              data: [8100, 8500, 8700, 8500, 8400, 8300, 8600, 8700, 8500, 8400, 8300, 8400],
              borderColor: '#3498db',
              backgroundColor: 'rgba(52, 152, 219, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true
            },
            {
              label: '存储资源',
              data: [1700, 1900, 2000, 2000, 2100, 2000, 2100, 2200, 2100, 2000, 2100, 2200],
              borderColor: '#2ecc71',
              backgroundColor: 'rgba(46, 204, 113, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true
            },
            {
              label: '网络资源',
              data: [1800, 1900, 2000, 1900, 1800, 1700, 1800, 1900, 1800, 1700, 1800, 1900],
              borderColor: '#e67e22',
              backgroundColor: 'rgba(230, 126, 34, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true
            }
          ]
        };

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
        // 年度视图数据（包含预测）
        const yearlyData = {
          labels: ['2020', '2021', '2022', '2023', '2024', '2025', '2026'],
          datasets: [
            {
              label: '计算资源',
              data: [78000, 86000, 94000, 101400, 108000, null, null],
              borderColor: '#3498db',
              backgroundColor: 'rgba(52, 152, 219, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true,
              segment: {
                borderDash: ctx => ctx.p0.parsed.x >= 4 ? [6, 6] : undefined,
              }
            },
            {
              label: '计算资源 (预测)',
              data: [null, null, null, null, 108000, 115000, 122000],
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
              data: [16000, 19000, 22000, 25440, 28000, null, null],
              borderColor: '#2ecc71',
              backgroundColor: 'rgba(46, 204, 113, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true,
              segment: {
                borderDash: ctx => ctx.p0.parsed.x >= 4 ? [6, 6] : undefined,
              }
            },
            {
              label: '存储资源 (预测)',
              data: [null, null, null, null, 28000, 31000, 34000],
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
              data: [15000, 17500, 20000, 22320, 24000, null, null],
              borderColor: '#e67e22',
              backgroundColor: 'rgba(230, 126, 34, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true,
              segment: {
                borderDash: ctx => ctx.p0.parsed.x >= 4 ? [6, 6] : undefined,
              }
            },
            {
              label: '网络资源 (预测)',
              data: [null, null, null, null, 24000, 26000, 28000],
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
                    <div className={styles.costValue}>¥{costData.yearlyCompute.toLocaleString()}</div>
                  </li>
                  <li className={styles.costItem}>
                    <div className={styles.costInfo}>
                      <div className={styles.costName}>存储资源</div>
                      <div className={styles.costDesc}>云硬盘、对象存储年度费用</div>
                    </div>
                    <div className={styles.costValue}>¥{costData.yearlyStorage.toLocaleString()}</div>
                  </li>
                  <li className={styles.costItem}>
                    <div className={styles.costInfo}>
                      <div className={styles.costName}>网络资源</div>
                      <div className={styles.costDesc}>带宽、流量年度费用</div>
                    </div>
                    <div className={styles.costValue}>¥{costData.yearlyNetwork.toLocaleString()}</div>
                  </li>
                </ul>

                <div className={styles.budgetProgress}>
                  <div className={styles.budgetHeader}>
                    <div className={styles.budgetTitle}>年度预算使用情况</div>
                    <div className={styles.budgetValue}>¥{(costData.yearlyCompute + costData.yearlyStorage + costData.yearlyNetwork).toLocaleString()} / ¥180,000</div>
                  </div>
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill} 
                      style={{
                        width: `${Math.min(100, ((costData.yearlyCompute + costData.yearlyStorage + costData.yearlyNetwork) / 180000) * 100)}%`, 
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
