# -*- coding: utf-8 -*-
import os
import sys
import json
import django
from django.db import transaction

# 设置Django环境
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'spug.settings')
django.setup()

from apps.host.models import Host
from apps.account.models import User

def import_instances():
    # 获取脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # 构建JSON文件的绝对路径
    json_path = os.path.join(os.path.dirname(os.path.dirname(script_dir)), 'OTHERS', 'instanceoutput.json')
    
    # 如果文件不存在，尝试其他可能的路径
    if not os.path.exists(json_path):
        json_path = os.path.join(os.path.dirname(script_dir), 'OTHERS', 'instanceoutput.json')
    
    if not os.path.exists(json_path):
        json_path = 'F:/实习相关/cmdb开发/spug/OTHERS/instanceoutput.json'
    
    if not os.path.exists(json_path):
        print(f"错误: 无法找到JSON文件。尝试过的路径: {json_path}")
        print("请确保instanceoutput.json文件位于正确的位置，或者修改脚本中的文件路径。")
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
    
    # 导入实例数据
    success_count = 0
    for instance in instances:
        try:
            # 使用实例ID作为主机名，使用默认IP地址
            # 对于内部IP和公共IP，使用实例ID作为占位符
            internal_ip = instance.get('internal_ip')
            if internal_ip == 'None' or not internal_ip:
                internal_ip = '0.0.0.0'  # 使用默认IP
            
            # 检查主机是否已存在
            existing_host = Host.objects.filter(name=instance['name']).first()
            if existing_host:
                print(f"更新主机: {instance['name']}")
                # 更新现有记录
                existing_host.hostname = internal_ip
                existing_host.desc = f"ID: {instance['id']}, OS: {instance['os_name']} {instance['os_version']}, CPU: {instance['cpu_count']}核, 内存: {instance['memory_capacity_in_gb']}GB, 状态: {instance['status']}, 到期时间: {instance['expire_time']}"
                existing_host.save()
                success_count += 1
                continue
            
            # 创建主机记录
            with transaction.atomic():
                host = Host.objects.create(
                    name=f"{instance['name']}_imported",
                    hostname=internal_ip,  # 使用内部IP作为主机名
                    port=22,               # 默认SSH端口
                    username='root',       # 默认用户名
                    pkey=None,
                    desc=f"ID: {instance['id']}, OS: {instance['os_name']} {instance['os_version']}, CPU: {instance['cpu_count']}核, 内存: {instance['memory_capacity_in_gb']}GB, 状态: {instance['status']}, 到期时间: {instance['expire_time']}",
                    created_by=admin
                )
                success_count += 1
                print(f"成功导入主机: {instance['name']}")
        except Exception as e:
            print(f"导入主机 {instance['name']} 失败: {e}")
    
    print(f"导入完成，成功导入 {success_count} 台主机")

if __name__ == '__main__':
    import_instances() 