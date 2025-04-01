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

def import_disks():
    # 获取脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # 构建JSON文件的绝对路径
    json_path = os.path.join(os.path.dirname(os.path.dirname(script_dir)), 'test', 'diskoutput.json')
    
    # 如果文件不存在，尝试其他可能的路径
    if not os.path.exists(json_path):
        json_path = os.path.join(script_dir, '..', '..', 'test', 'diskoutput.json')
    
    if not os.path.exists(json_path):
        json_path = 'F:/实习相关/cmdb开发/spug/test/diskoutput.json'
    
    if not os.path.exists(json_path):
        print(f"错误: 无法找到JSON文件。尝试过的路径: {json_path}")
        print("请确保diskoutput.json文件位于正确的位置，或者修改脚本中的文件路径。")
        return
    
    print(f"使用JSON文件: {json_path}")
    
    # 读取JSON文件
    with open(json_path, 'r', encoding='utf-8') as f:
        disks = json.load(f)
    
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
    
    # 清空现有磁盘数据
    cursor.execute("DELETE FROM disks")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='disks'")
    print("已清空现有磁盘数据")
    
    # 导入磁盘数据
    success_count = 0
    for disk in disks:
        try:
            # 创建描述信息，标记出缺失的数据
            desc_parts = []
            for key in ['id', 'serverid', 'storage_type', 'create_time', 'size_in_gb', 'expire_time']:
                if disk.get(key):
                    desc_parts.append(f"{key}: {disk[key]}")
                else:
                    desc_parts.append(f"{key}: 数据缺失")
            
            # 拼接描述信息
            full_desc = ", ".join(desc_parts)
            
            # 直接进行SQL插入，使用新的表结构
            cursor.execute('''
            INSERT INTO disks (
                disk_id, 
                server_id, 
                name, 
                size_in_gb, 
                status, 
                storage_type, 
                create_time, 
                expire_time, 
                desc, 
                created_at, 
                created_by_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                disk.get('id'),
                disk.get('serverid'),
                disk.get('name', f"未命名磁盘-{disk.get('id', 'unknown')}"),
                disk.get('size_in_gb'),
                disk.get('status', '未知'),
                disk.get('storage_type'),
                disk.get('create_time'),
                disk.get('expire_time'),
                full_desc,
                human_datetime(),
                admin.id
            ))
            
            success_count += 1
            print(f"成功导入磁盘: {disk.get('name', f'未命名磁盘-{disk.get('id', 'unknown')}')}")
        except Exception as e:
            print(f"导入磁盘 {disk.get('name', '未知磁盘')} 失败: {e}")
    
    # 提交更改并关闭连接
    conn.commit()
    conn.close()
    
    print(f"导入完成，成功导入 {success_count} 个磁盘")

if __name__ == '__main__':
    import_disks() 