# -*- coding: utf-8 -*-
import os
import sys
import time
import django

# 设置Django环境
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'spug.settings')
django.setup()

# 导入必要的模块
import sqlite3
from clear_assets import clear_assets
from import_disks import import_disks
from import_eips import import_eips
from import_instances import import_instances

def run_all_imports():
    """
    顺序执行所有导入脚本
    """
    print("="*50)
    print("开始全量资产数据导入")
    print("="*50)
    
    # 步骤1: 清理所有资产数据
    print("\n[步骤1] 清理所有资产数据")
    clear_assets()
    time.sleep(1)  # 短暂延迟，确保数据清理完成
    
    # 步骤2: 导入磁盘数据
    print("\n[步骤2] 导入磁盘数据")
    import_disks()
    time.sleep(1)
    
    # 步骤3: 导入IP数据
    print("\n[步骤3] 导入IP数据")
    import_eips()
    time.sleep(1)
    
    # 步骤4: 导入实例数据
    print("\n[步骤4] 导入实例数据")
    import_instances()
    
    # 导入完成，检查数据库状态
    check_database_status()
    
    print("\n"+"="*50)
    print("全量资产数据导入完成")
    print("="*50)

def check_database_status():
    """
    检查数据库中各资产表的记录数
    """
    try:
        # 使用SQLite的底层连接直接操作数据库
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'db.sqlite3')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\n数据库状态检查:")
        print("-"*30)
        
        # 检查磁盘表
        cursor.execute("SELECT COUNT(*) FROM disks")
        disk_count = cursor.fetchone()[0]
        print(f"磁盘记录数: {disk_count}")
        
        # 检查IP表
        cursor.execute("SELECT COUNT(*) FROM ips")
        ip_count = cursor.fetchone()[0]
        print(f"IP记录数: {ip_count}")
        
        # 检查实例表
        cursor.execute("SELECT COUNT(*) FROM instances")
        instance_count = cursor.fetchone()[0]
        print(f"实例记录数: {instance_count}")
        
        conn.close()
        
    except Exception as e:
        print(f"数据库状态检查失败: {e}")

if __name__ == '__main__':
    run_all_imports() 