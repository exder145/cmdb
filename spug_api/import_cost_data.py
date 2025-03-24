#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import json
import django
import sys

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'spug.settings')
django.setup()

# 导入模型
from apps.host.models import ResourceCost
from libs import human_datetime

def import_cost_data(clear_existing=True):
    """导入成本数据
    
    Args:
        clear_existing (bool): 是否清除现有数据
    """
    # 首先清空所有现有数据，重新导入
    if clear_existing:
        ResourceCost.objects.all().delete()
        print("已清空现有资源费用数据")
    
    # 定义资源类型映射
    resource_types = {
        'bcccost_monthly.json': 'ECS实例',
        'cdscost_monthly.json': '云盘',
        'eipcost_monthly.json': '弹性IP'
    }
    
    # 导入每个JSON文件的数据
    for json_file, resource_type in resource_types.items():
        # 构建文件路径 (JSON文件位于spug_web/src/pages/cost/data/下)
        file_path = os.path.join('..', 'spug_web', 'src', 'pages', 'cost', 'data', json_file)
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            print(f"正在导入{resource_type}费用数据...")
            count = 0
            
            # 创建批量插入数据列表
            bulk_data = []
            
            # 遍历数据并准备插入
            for item in data:
                try:
                    # 创建记录对象但不保存
                    cost_record = ResourceCost(
                        month=item.get('month'),
                        instance_id=item.get('instanceid'),
                        instance_name=item.get('instance_name', item.get('instanceid')),
                        resource_type=resource_type,
                        product_type=item.get('productType'),
                        finance_price=float(item.get('financePrice', 0)),
                        created_at=human_datetime()
                    )
                    bulk_data.append(cost_record)
                    count += 1
                    
                    # 每1000条数据批量插入一次
                    if len(bulk_data) >= 1000:
                        ResourceCost.objects.bulk_create(bulk_data)
                        bulk_data = []
                        print(f"已批量导入 {count} 条记录")
                        
                except Exception as e:
                    print(f"准备数据时出错: {e}, 数据: {item}")
            
            # 插入剩余数据
            if bulk_data:
                ResourceCost.objects.bulk_create(bulk_data)
            
            print(f"已导入 {count} 条{resource_type}费用数据")
            
        except FileNotFoundError:
            print(f"文件不存在: {file_path}")
        except json.JSONDecodeError:
            print(f"JSON格式错误: {file_path}")
        except Exception as e:
            print(f"导入数据时出错: {e}")
    
    # 验证导入的数据
    verify_imported_data()
    
    print("费用数据导入完成")

def verify_imported_data():
    """验证导入的数据"""
    # 检查各资源类型的数据数量
    print("\n验证导入的数据:")
    total_count = ResourceCost.objects.count()
    print(f"总数据条数: {total_count}")
    
    for resource_type in ['ECS实例', '云盘', '弹性IP']:
        count = ResourceCost.objects.filter(resource_type=resource_type).count()
        print(f"{resource_type}数据条数: {count}")
        
        # 打印示例数据
        if count > 0:
            sample = ResourceCost.objects.filter(resource_type=resource_type).first()
            print(f"  示例: ID={sample.instance_id}, 月份={sample.month}, 费用={sample.finance_price}")

if __name__ == "__main__":
    # 检查命令行参数
    clear_data = True
    if len(sys.argv) > 1 and sys.argv[1].lower() == 'no-clear':
        clear_data = False
        print("将不清除现有数据，仅添加新数据")
    
    try:
        import_cost_data(clear_existing=clear_data)
    except KeyboardInterrupt:
        print("\n导入过程被中断")
    except Exception as e:
        print(f"导入过程中发生错误: {e}") 