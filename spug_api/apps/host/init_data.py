# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from apps.host.models import Disk, Storage, CDN, IP
from apps.account.models import User
from libs import human_datetime

# 禁用模拟数据
mock_data = {}

def init_asset_data():
    # 仅检查数据库状态，不再自动初始化测试数据
    disk_count = Disk.objects.count()
    storage_count = Storage.objects.count()
    cdn_count = CDN.objects.count()
    ip_count = IP.objects.count()
    
    print(f"当前数据库状态: 磁盘数据 {disk_count}条, 存储数据 {storage_count}条, CDN数据 {cdn_count}条, IP数据 {ip_count}条")
    print("测试数据初始化已禁用，如需导入测试数据请使用导入脚本") 