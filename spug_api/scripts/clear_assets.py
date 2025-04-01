# -*- coding: utf-8 -*-
import os
import sys
import sqlite3
import django

# 设置Django环境
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'spug.settings')
django.setup()

def clear_assets():
    # 获取数据库路径
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'db.sqlite3')
    
    # 连接数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 检查表是否存在并清空
        tables_to_check = ['instances', 'disks', 'ips']
        for table in tables_to_check:
            # 检查表是否存在
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if cursor.fetchone():
                print(f"正在清空{table}表...")
                cursor.execute(f"DELETE FROM {table}")
                cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}'")
                print(f"已清空{table}表")
            else:
                print(f"表{table}不存在，跳过")
        
        # 提交事务
        conn.commit()
        print("已清空所有现有资产表数据")
    
    except Exception as e:
        print(f"清空表时出错: {e}")
        conn.rollback()
    
    finally:
        # 关闭连接
        conn.close()

if __name__ == '__main__':
    # 要求用户确认
    response = input("警告: 此操作将清空所有资产数据。确定要继续吗? (y/n): ")
    if response.lower() == 'y':
        clear_assets()
    else:
        print("操作已取消。") 