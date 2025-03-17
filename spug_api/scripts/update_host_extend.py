# -*- coding: utf-8 -*-
import os
import sys
import json
import django

# 设置Django环境
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'spug.settings')
django.setup()

from apps.host.models import Host, HostExtend
import json

def update_host_extend():
    # 读取JSON文件
    json_path = 'F:/实习相关/cmdb开发/spug/OTHERS/instanceoutput.json'
    with open(json_path, 'r', encoding='utf-8') as f:
        instances = json.load(f)
    
    # 创建实例ID到实例数据的映射
    instance_map = {instance['id']: instance for instance in instances}
    
    # 更新每个主机的扩展信息
    success_count = 0
    for host in Host.objects.all():
        try:
            # 从描述中提取实例ID
            desc = host.desc
            instance_id = None
            if desc and 'ID:' in desc:
                instance_id = desc.split('ID:')[1].split(',')[0].strip()
            
            if not instance_id or instance_id not in instance_map:
                print(f"无法找到主机 {host.name} 的实例ID或实例数据")
                continue
            
            instance = instance_map[instance_id]
            
            # 检查是否已存在扩展信息
            host_extend, created = HostExtend.objects.get_or_create(
                host=host,
                defaults={
                    'cpu': 1,  # 默认值
                    'memory': 1.0,  # 默认值
                    'disk': json.dumps([{"name": "/", "size": 0}]),
                    'os_name': 'Unknown',
                    'os_type': 'linux',
                    'private_ip_address': json.dumps(['127.0.0.1']),
                    'public_ip_address': json.dumps(['']),
                    'instance_charge_type': 'Other',
                    'internet_charge_type': 'Other'
                }
            )
            
            # 更新扩展信息
            host_extend.instance_id = instance_id
            host_extend.zone_id = instance.get('zone_name', '')
            
            # 确保CPU值有效
            cpu_count = instance.get('cpu_count')
            if cpu_count is None or cpu_count == 'None' or not str(cpu_count).isdigit():
                cpu_count = 1  # 默认值
            else:
                cpu_count = int(cpu_count)
            host_extend.cpu = cpu_count
            
            # 确保内存值有效
            memory = instance.get('memory_capacity_in_gb')
            if memory is None or memory == 'None' or not str(memory).replace('.', '', 1).isdigit():
                memory = 1.0  # 默认值
            else:
                memory = float(memory)
            host_extend.memory = memory
            
            host_extend.disk = json.dumps([{"name": "/", "size": 0}])  # 默认磁盘信息
            host_extend.os_name = instance.get('os_name', 'Unknown')
            host_extend.os_type = 'linux' if 'linux' in instance.get('os_name', '').lower() or 'ubuntu' in instance.get('os_name', '').lower() or 'centos' in instance.get('os_name', '').lower() else 'windows'
            
            # 设置IP地址
            internal_ip = instance.get('internal_ip')
            if internal_ip == 'None' or not internal_ip:
                internal_ip = '127.0.0.1'
            
            public_ip = instance.get('public_ip')
            if public_ip == 'None' or not public_ip:
                public_ip = ''
            
            host_extend.private_ip_address = json.dumps([internal_ip])
            host_extend.public_ip_address = json.dumps([public_ip])
            
            # 设置计费类型
            host_extend.instance_charge_type = 'PrePaid' if instance.get('payment_timing') == 'Prepaid' else 'PostPaid'
            host_extend.internet_charge_type = 'Other'
            
            # 设置创建和过期时间
            host_extend.created_time = instance.get('create_time', '')
            host_extend.expired_time = instance.get('expire_time', '')
            
            # 保存更新
            host_extend.save()
            success_count += 1
            print(f"成功更新主机 {host.name} 的扩展信息")
        except Exception as e:
            print(f"更新主机 {host.name} 的扩展信息失败: {e}")
    
    print(f"更新完成，成功更新 {success_count} 台主机的扩展信息")

if __name__ == '__main__':
    update_host_extend() 