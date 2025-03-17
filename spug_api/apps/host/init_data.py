# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from apps.host.models import Disk, Storage, CDN, IP
from apps.account.models import User
from libs import human_datetime

# 模拟数据
mock_data = {
    'disk': [
        {'id': 1, 'name': '系统盘-01', 'size': 100, 'type': 'SSD', 'mount_point': '/', 'status': 'online', 'desc': '系统盘'},
        {'id': 2, 'name': '数据盘-01', 'size': 500, 'type': 'HDD', 'mount_point': '/data', 'status': 'online', 'desc': '数据盘'},
        {'id': 3, 'name': '备份盘-01', 'size': 1000, 'type': 'HDD', 'mount_point': '/backup', 'status': 'online', 'desc': '备份盘'},
        {'id': 4, 'name': '系统盘-02', 'size': 200, 'type': 'SSD', 'mount_point': '/', 'status': 'online', 'desc': '系统盘'},
        {'id': 5, 'name': '数据盘-02', 'size': 800, 'type': 'HDD', 'mount_point': '/data', 'status': 'online', 'desc': '数据盘'},
        {'id': 6, 'name': '备份盘-02', 'size': 2000, 'type': 'HDD', 'mount_point': '/backup', 'status': 'online', 'desc': '备份盘'}
    ],
    'storage': [
        {'id': 1, 'name': '对象存储-01', 'type': 'S3', 'capacity': 1000, 'usage': 45, 'status': 'online', 'desc': '对象存储'},
        {'id': 2, 'name': '对象存储-02', 'type': 'OSS', 'capacity': 2000, 'usage': 30, 'status': 'online', 'desc': '对象存储'},
        {'id': 3, 'name': '文件存储-01', 'type': 'NAS', 'capacity': 500, 'usage': 60, 'status': 'online', 'desc': '文件存储'},
        {'id': 4, 'name': '对象存储-03', 'type': 'S3', 'capacity': 3000, 'usage': 25, 'status': 'online', 'desc': '对象存储'},
        {'id': 5, 'name': '块存储-01', 'type': 'Block', 'capacity': 1500, 'usage': 50, 'status': 'online', 'desc': '块存储'},
        {'id': 6, 'name': '文件存储-02', 'type': 'NAS', 'capacity': 800, 'usage': 40, 'status': 'online', 'desc': '文件存储'}
    ],
    'cdn': [
        {'id': 1, 'name': 'CDN-01', 'domain': 'cdn1.example.com', 'type': '网页加速', 'bandwidth': 100, 'status': 'online', 'desc': 'CDN'},
        {'id': 2, 'name': 'CDN-02', 'domain': 'cdn2.example.com', 'type': '下载加速', 'bandwidth': 200, 'status': 'online', 'desc': 'CDN'},
        {'id': 3, 'name': 'CDN-03', 'domain': 'cdn3.example.com', 'type': '视频加速', 'bandwidth': 500, 'status': 'offline', 'desc': 'CDN'},
        {'id': 4, 'name': 'CDN-04', 'domain': 'cdn4.example.com', 'type': '网页加速', 'bandwidth': 150, 'status': 'online', 'desc': 'CDN'},
        {'id': 5, 'name': 'CDN-05', 'domain': 'cdn5.example.com', 'type': '下载加速', 'bandwidth': 300, 'status': 'online', 'desc': 'CDN'},
        {'id': 6, 'name': 'CDN-06', 'domain': 'cdn6.example.com', 'type': '视频加速', 'bandwidth': 800, 'status': 'online', 'desc': 'CDN'}
    ],
    'ip': [
        {'id': 1, 'address': '192.168.1.1', 'type': 'private', 'region': '内网', 'bandwidth': None, 'status': 'used', 'desc': 'IP地址'},
        {'id': 2, 'address': '10.0.0.1', 'type': 'private', 'region': '内网', 'bandwidth': None, 'status': 'used', 'desc': 'IP地址'},
        {'id': 3, 'address': '203.0.113.1', 'type': 'public', 'region': '华北', 'bandwidth': 100, 'status': 'used', 'desc': 'IP地址'},
        {'id': 4, 'address': '192.168.1.2', 'type': 'private', 'region': '内网', 'bandwidth': None, 'status': 'used', 'desc': 'IP地址'},
        {'id': 5, 'address': '10.0.0.2', 'type': 'private', 'region': '内网', 'bandwidth': None, 'status': 'unused', 'desc': 'IP地址'},
        {'id': 6, 'address': '203.0.113.2', 'type': 'public', 'region': '华东', 'bandwidth': 200, 'status': 'used', 'desc': 'IP地址'}
    ]
}


def init_asset_data():
    # 获取第一个管理员用户作为创建者
    admin_user = User.objects.filter(is_supper=True).first()
    if not admin_user:
        print("未找到管理员用户，无法初始化资产数据")
        return
    
    # 初始化磁盘数据
    if Disk.objects.count() == 0:
        print("正在初始化磁盘数据...")
        for item in mock_data['disk']:
            Disk.objects.create(
                name=item['name'],
                size=item['size'],
                type=item['type'],
                mount_point=item['mount_point'],
                status=item['status'],
                desc=item['desc'],
                created_at=human_datetime(),
                created_by=admin_user
            )
        print(f"已初始化 {len(mock_data['disk'])} 条磁盘数据")
    
    # 初始化存储数据
    if Storage.objects.count() == 0:
        print("正在初始化存储数据...")
        for item in mock_data['storage']:
            Storage.objects.create(
                name=item['name'],
                type=item['type'],
                capacity=item['capacity'],
                usage=item['usage'],
                status=item['status'],
                desc=item['desc'],
                created_at=human_datetime(),
                created_by=admin_user
            )
        print(f"已初始化 {len(mock_data['storage'])} 条存储数据")
    
    # 初始化CDN数据
    if CDN.objects.count() == 0:
        print("正在初始化CDN数据...")
        for item in mock_data['cdn']:
            CDN.objects.create(
                name=item['name'],
                domain=item['domain'],
                type=item['type'],
                bandwidth=item['bandwidth'],
                status=item['status'],
                desc=item['desc'],
                created_at=human_datetime(),
                created_by=admin_user
            )
        print(f"已初始化 {len(mock_data['cdn'])} 条CDN数据")
    
    # 初始化IP数据
    if IP.objects.count() == 0:
        print("正在初始化IP数据...")
        for item in mock_data['ip']:
            IP.objects.create(
                address=item['address'],
                type=item['type'],
                region=item['region'],
                bandwidth=item['bandwidth'],
                status=item['status'],
                desc=item['desc'],
                created_at=human_datetime(),
                created_by=admin_user
            )
        print(f"已初始化 {len(mock_data['ip'])} 条IP数据")
    
    print("资产数据初始化完成") 