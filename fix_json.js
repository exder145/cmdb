const fs = require('fs');
const path = require('path');

// 定义文件路径
const cdsFilePath = path.join('spug_web', 'src', 'pages', 'cost', 'data', 'cdscost_monthly.json');
const bccFilePath = path.join('spug_web', 'src', 'pages', 'cost', 'data', 'bcccost_monthly.json');
const eipFilePath = path.join('spug_web', 'src', 'pages', 'cost', 'data', 'eipcost_monthly.json');

try {
  console.log('开始修复 cdscost_monthly.json 文件...');
  
  // 读取cdscost_monthly.json文件内容
  const cdsContent = fs.readFileSync(cdsFilePath, 'utf8');
  
  // 解析JSON数据
  let cdsData = [];
  try {
    // 先尝试常规解析
    cdsData = JSON.parse(cdsContent);
  } catch (e) {
    console.error('解析cdscost_monthly.json失败，尝试行解析...');
    
    // 逐行解析
    const lines = cdsContent.split('\n').filter(line => 
      line.trim() && !line.trim().startsWith('[') && !line.trim().startsWith(']')
    );
    
    lines.forEach(line => {
      try {
        // 移除行末的逗号
        let cleanLine = line.trim();
        if (cleanLine.endsWith(',')) {
          cleanLine = cleanLine.slice(0, -1);
        }
        
        // 处理没有大括号的格式，如 {"key": "value", ...}
        if (!cleanLine.startsWith('{')) {
          cleanLine = '{' + cleanLine;
        }
        if (!cleanLine.endsWith('}')) {
          cleanLine = cleanLine + '}';
        }
        
        const obj = JSON.parse(cleanLine);
        cdsData.push(obj);
      } catch (err) {
        console.error(`无法解析行: ${line}`);
      }
    });
  }
  
  console.log(`成功从cdscost_monthly.json解析出${cdsData.length}个对象`);
  
  // 确保每个对象格式一致
  const formattedCdsData = cdsData.map(item => {
    return {
      "month": item.month || "",
      "instanceid": item.instanceid || "",
      "productType": item.productType || "",
      "financePrice": item.financePrice || "0.0"
    };
  });
  
  // 写回标准化的JSON
  fs.writeFileSync(cdsFilePath, JSON.stringify(formattedCdsData, null, 2), 'utf8');
  console.log('cdscost_monthly.json已修复完成!');
  
  // 分析各文件中的月份数据
  console.log('\n分析JSON文件中的时间范围:');
  
  // 读取其他JSON文件
  const bccData = JSON.parse(fs.readFileSync(bccFilePath, 'utf8'));
  const eipData = JSON.parse(fs.readFileSync(eipFilePath, 'utf8'));
  
  // 统计每个文件中的月份分布
  const bccMonths = [...new Set(bccData.map(item => item.month))].sort();
  const cdsMonths = [...new Set(formattedCdsData.map(item => item.month))].sort();
  const eipMonths = [...new Set(eipData.map(item => item.month))].sort();
  
  console.log('BCC月份:', bccMonths.join(', '));
  console.log('CDS月份:', cdsMonths.join(', '));
  console.log('EIP月份:', eipMonths.join(', '));
  
  console.log('\n检查是否存在特定月份 (2024-01, 2024-02, 2024-03):');
  console.log('BCC 2024-01:', bccData.some(item => item.month === '2024-01'));
  console.log('BCC 2024-02:', bccData.some(item => item.month === '2024-02'));
  console.log('BCC 2024-03:', bccData.some(item => item.month === '2024-03'));
  
  console.log('CDS 2024-01:', formattedCdsData.some(item => item.month === '2024-01'));
  console.log('CDS 2024-02:', formattedCdsData.some(item => item.month === '2024-02'));
  console.log('CDS 2024-03:', formattedCdsData.some(item => item.month === '2024-03'));
  
  console.log('EIP 2024-01:', eipData.some(item => item.month === '2024-01'));
  console.log('EIP 2024-02:', eipData.some(item => item.month === '2024-02'));
  console.log('EIP 2024-03:', eipData.some(item => item.month === '2024-03'));
  
  // 计算每个月份的数据条数
  const countByMonth = (data) => {
    const counts = {};
    data.forEach(item => {
      const month = item.month;
      counts[month] = (counts[month] || 0) + 1;
    });
    return counts;
  };
  
  console.log('\n每个月份的数据条数:');
  console.log('BCC:', JSON.stringify(countByMonth(bccData), null, 2));
  console.log('CDS:', JSON.stringify(countByMonth(formattedCdsData), null, 2));
  console.log('EIP:', JSON.stringify(countByMonth(eipData), null, 2));
  
} catch (error) {
  console.error('处理JSON文件时出错:', error.message);
} 