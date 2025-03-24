#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'spug.settings')
django.setup()

# 导入模型
from apps.host.models import ResourceCost

def check_resource_costs():
    # 获取所有数据
    all_costs = ResourceCost.objects.all()
    count = all_costs.count()
    print(f"资源费用数据总数: {count}")
    
    # 检查资源类型分布
    type_counts = {}
    for cost in all_costs:
        res_type = cost.resource_type
        type_counts[res_type] = type_counts.get(res_type, 0) + 1
    
    print("资源类型分布:")
    for res_type, count in type_counts.items():
        print(f"  {res_type}: {count}条数据")
    
    # 检查各资源类型的示例数据
    print("\n各类型示例数据:")
    for res_type in type_counts.keys():
        sample = ResourceCost.objects.filter(resource_type=res_type).first()
        if sample:
            print(f"资源类型: {res_type}")
            print(f"  实例ID: {sample.instance_id}")
            print(f"  月份: {sample.month}")
            print(f"  计费方式: {sample.product_type}")
            print(f"  费用: {sample.finance_price}")
            print("")

if __name__ == "__main__":
    check_resource_costs() 