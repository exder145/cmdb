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

def fix_host_extend():
    # 删除所有现有的扩展信息
    HostExtend.objects.all().delete()
    print("已删除所有现有的主机扩展信息")
    
    # 为所有主机创建新的扩展信息
    for host in Host.objects.all():
        try:
            # 创建基本的扩展信息记录
            HostExtend.objects.create(
                host=host,
                instance_id=f"i-{host.id}",  # 使用主机ID作为实例ID
                zone_id="cn-beijing-a",  # 默认可用区
                cpu=2,  # 默认2核
                memory=4.0,  # 默认4GB
                disk=json.dumps([{"name": "/", "size": 40}]),  # 默认40GB磁盘
                os_name="Ubuntu 20.04 LTS",  # 默认操作系统
                os_type="linux",  # 默认类型
                private_ip_address=json.dumps([host.hostname]),  # 使用主机名作为内网IP
                public_ip_address=json.dumps([""]),  # 空公网IP
                instance_charge_type="PrePaid",  # 默认包年包月
                internet_charge_type="PayByTraffic",  # 默认按流量计费
                created_time="2023-01-01 00:00:00",  # 默认创建时间
                expired_time="2024-12-31 23:59:59"  # 默认过期时间
            )
            print(f"为主机 {host.name} 创建了新的扩展信息")
        except Exception as e:
            print(f"为主机 {host.name} 创建扩展信息失败: {e}")
    
    print("完成!")

if __name__ == '__main__':
    fix_host_extend() 