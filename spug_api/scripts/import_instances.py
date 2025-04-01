# -*- coding: utf-8 -*-
import os
import sys
import json
import django
import sqlite3
from django.db import transaction

# 设置Django环境
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'spug.settings')
django.setup()

from apps.account.models import User
from libs import human_datetime

def import_instances():
    # 获取脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # 构建JSON文件的绝对路径
    json_path = os.path.join(os.path.dirname(os.path.dirname(script_dir)), 'test', 'instancelist.json')
    
    # 如果文件不存在，尝试其他可能的路径
    if not os.path.exists(json_path):
        json_path = os.path.join(script_dir, '..', '..', 'test', 'instancelist.json')
    
    if not os.path.exists(json_path):
        json_path = 'F:/实习相关/cmdb开发/spug/test/instancelist.json'
    
    if not os.path.exists(json_path):
        print(f"错误: 无法找到JSON文件。尝试过的路径: {json_path}")
        print("请确保instancelist.json文件位于正确的位置，或者修改脚本中的文件路径。")
        return
    
    print(f"使用JSON文件: {json_path}")
    
    # 读取JSON文件
    with open(json_path, 'r', encoding='utf-8') as f:
        instances = json.load(f)
    
    # 获取管理员用户
    admin = User.objects.filter(is_supper=True).first()
    if not admin:
        print("未找到管理员用户，请先创建管理员用户")
        return
    
    # 使用SQLite的底层连接直接操作数据库
    # 这样可以避免Django ORM的限制
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'db.sqlite3')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 清空现有实例数据
    cursor.execute("DELETE FROM instances")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='instances'")
    print("已清空现有实例数据")
    
    # 导入实例数据
    success_count = 0
    for instance in instances:
        try:
            # 获取实例ID
            instance_id = instance.get('id')
            if not instance_id:  # 如果没有实例ID，跳过
                print(f"跳过没有实例ID的记录")
                continue
                
            # 创建描述信息（包含所有详细信息，因为表中缺少列）
            desc_parts = []
            for key in ['name', 'zone_name', 'internal_ip', 'cpu_count', 'memory_capacity_in_gb', 'payment_timing', 'create_time', 'expire_time', 
                        'status', 'os_name', 'os_version', 'os_arch']:
                if instance.get(key):
                    desc_parts.append(f"{key}: {instance[key]}")
                else:
                    desc_parts.append(f"{key}: 数据缺失")
            
            # 拼接描述信息
            full_desc = ", ".join(desc_parts)
            
            # 直接进行SQL插入，使用表的实际列结构
            cursor.execute('''
            INSERT INTO instances (
                instance_id,
                name,
                internal_ip,
                public_ip,
                status,
                zone_name,
                create_time,
                expire_time,
                payment_timing,
                cpu_count,
                memory_capacity_in_gb,
                image_name,
                os_name,
                os_version,
                os_arch,
                desc
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                instance_id,
                instance.get('name'),
                instance.get('internal_ip'),
                instance.get('public_ip'),
                instance.get('status'),
                instance.get('zone_name'),
                instance.get('create_time'),
                instance.get('expire_time'),
                instance.get('payment_timing'),
                instance.get('cpu_count'),
                instance.get('memory_capacity_in_gb'),
                instance.get('image_name'),
                instance.get('os_name'),
                instance.get('os_version'),
                instance.get('os_arch'),
                full_desc
            ))
            
            success_count += 1
            print(f"成功导入实例: {instance_id} - {instance.get('name', '未命名')}")
        except Exception as e:
            print(f"导入实例 {instance.get('id', '未知')} 失败: {e}")
    
    # 提交更改并关闭连接
    conn.commit()
    conn.close()
    
    print(f"导入完成，成功导入 {success_count} 个实例")

if __name__ == '__main__':
    import_instances() 