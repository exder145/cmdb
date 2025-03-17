# -*- coding: utf-8 -*-
import os
import sys
import django

# 设置Django环境
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'spug.settings')
django.setup()

from apps.host.models import Host

def clear_hosts():
    # 获取当前主机数量
    count = Host.objects.count()
    # 删除所有主机记录
    Host.objects.all().delete()
    print(f"已清空 {count} 条主机记录")

if __name__ == '__main__':
    clear_hosts() 