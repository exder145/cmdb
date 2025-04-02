# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.db import models
from libs import ModelMixin, human_datetime
from apps.account.models import User
from apps.setting.utils import AppSetting
from libs.ssh import SSH
import json


class Host(models.Model, ModelMixin):
    name = models.CharField(max_length=100)
    hostname = models.CharField(max_length=50)
    port = models.IntegerField(null=True)
    username = models.CharField(max_length=50)
    pkey = models.TextField(null=True)
    desc = models.CharField(max_length=255, null=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.CharField(max_length=20, default=human_datetime)
    created_by = models.ForeignKey(User, models.PROTECT, related_name='+')

    @property
    def private_key(self):
        return self.pkey or AppSetting.get('private_key')

    def get_ssh(self, pkey=None, default_env=None):
        pkey = pkey or self.private_key
        return SSH(self.hostname, self.port, self.username, pkey, default_env=default_env)

    def to_view(self):
        tmp = self.to_dict()
        if hasattr(self, 'hostextend'):
            tmp.update(self.hostextend.to_view())
        tmp['group_ids'] = []
        return tmp

    def __repr__(self):
        return '<Host %r>' % self.name

    class Meta:
        db_table = 'hosts'
        ordering = ('-id',)


class HostExtend(models.Model, ModelMixin):
    INSTANCE_CHARGE_TYPES = (
        ('PrePaid', '包年包月'),
        ('PostPaid', '按量计费'),
        ('Other', '其他')
    )
    INTERNET_CHARGE_TYPES = (
        ('PayByTraffic', '按流量计费'),
        ('PayByBandwidth', '按带宽计费'),
        ('Other', '其他')
    )
    host = models.OneToOneField(Host, on_delete=models.CASCADE)
    instance_id = models.CharField(max_length=64, null=True)
    zone_id = models.CharField(max_length=30, null=True)
    cpu = models.IntegerField()
    memory = models.FloatField()
    disk = models.CharField(max_length=255, default='[]')
    os_name = models.CharField(max_length=50)
    os_type = models.CharField(max_length=20)
    private_ip_address = models.CharField(max_length=255)
    public_ip_address = models.CharField(max_length=255)
    instance_charge_type = models.CharField(max_length=20, choices=INSTANCE_CHARGE_TYPES)
    internet_charge_type = models.CharField(max_length=20, choices=INTERNET_CHARGE_TYPES)
    created_time = models.CharField(max_length=20, null=True)
    expired_time = models.CharField(max_length=20, null=True)
    updated_at = models.CharField(max_length=20, default=human_datetime)

    def to_view(self):
        tmp = self.to_dict(excludes=('id',))
        tmp['disk'] = json.loads(self.disk)
        tmp['private_ip_address'] = json.loads(self.private_ip_address)
        tmp['public_ip_address'] = json.loads(self.public_ip_address)
        tmp['instance_charge_type_alias'] = self.get_instance_charge_type_display()
        tmp['internet_charge_type_alisa'] = self.get_internet_charge_type_display()
        return tmp

    class Meta:
        db_table = 'host_extend'


class Group(models.Model, ModelMixin):
    name = models.CharField(max_length=50)
    parent_id = models.IntegerField(default=0)
    sort_id = models.IntegerField(default=0)
    hosts = models.ManyToManyField(Host, related_name='groups')

    def to_view(self, with_hosts=False):
        response = dict(key=self.id, value=self.id, title=self.name, children=[])
        if with_hosts:
            def make_item(x):
                return dict(title=x.name, hostname=x.hostname, key=f'{self.id}_{x.id}', id=x.id, isLeaf=True)

            response['children'] = [make_item(x) for x in self.hosts.all()]
        return response

    class Meta:
        db_table = 'host_groups'
        ordering = ('-sort_id',)


# 磁盘模型
class Disk(models.Model, ModelMixin):
    disk_id = models.CharField(max_length=100, null=True)
    server_id = models.CharField(max_length=100, null=True)
    name = models.CharField(max_length=100)
    size_in_gb = models.IntegerField(null=True)
    status = models.CharField(max_length=20)
    storage_type = models.CharField(max_length=50, null=True)
    create_time = models.CharField(max_length=50, null=True)
    expire_time = models.CharField(max_length=50, null=True)
    desc = models.CharField(max_length=255, null=True)
    
    def to_view(self):
        return self.to_dict()
    
    def __repr__(self):
        return '<Disk %r>' % self.name
    
    class Meta:
        db_table = 'disks'
        ordering = ('-id',)


# 存储模型
class Storage(models.Model, ModelMixin):
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=50)  # S3, OSS, NAS, Block
    capacity = models.IntegerField()  # GB
    usage = models.IntegerField(null=True)  # 使用率，百分比
    status = models.CharField(max_length=20)  # online, offline
    desc = models.CharField(max_length=255, null=True)
    created_at = models.CharField(max_length=20, default=human_datetime)
    created_by = models.ForeignKey(User, models.PROTECT, related_name='+')
    
    def to_view(self):
        return self.to_dict()
    
    def __repr__(self):
        return '<Storage %r>' % self.name
    
    class Meta:
        db_table = 'storages'
        ordering = ('-id',)


# CDN模型
class CDN(models.Model, ModelMixin):
    name = models.CharField(max_length=100)
    domain = models.CharField(max_length=255)
    type = models.CharField(max_length=50)  # 网页加速, 下载加速, 视频加速
    bandwidth = models.IntegerField(null=True)  # Mbps
    status = models.CharField(max_length=20)  # online, offline
    desc = models.CharField(max_length=255, null=True)
    created_at = models.CharField(max_length=20, default=human_datetime)
    created_by = models.ForeignKey(User, models.PROTECT, related_name='+')
    
    def to_view(self):
        return self.to_dict()
    
    def __repr__(self):
        return '<CDN %r>' % self.name
    
    class Meta:
        db_table = 'cdns'
        ordering = ('-id',)


# IP地址模型
class IP(models.Model, ModelMixin):
    name = models.CharField(max_length=100, null=True)  # 名称
    eip = models.CharField(max_length=50)  # IP地址
    status = models.CharField(max_length=20, null=True)  # 状态：used, unused
    instance = models.CharField(max_length=100, null=True)  # 关联实例ID
    paymentTiming = models.CharField(max_length=50, null=True)  # 付费类型
    billingMethod = models.CharField(max_length=50, null=True)  # 计费方式
    expireTime = models.CharField(max_length=50, null=True)  # 过期时间
    createTime = models.CharField(max_length=50, null=True)  # 创建时间
    
    def to_view(self):
        return self.to_dict()
    
    def __repr__(self):
        return '<IP %r>' % self.eip
    
    class Meta:
        db_table = 'ips'
        ordering = ('-id',)


# 资源费用模型
class ResourceCost(models.Model, ModelMixin):
    month = models.CharField(max_length=7)  # 格式：YYYY-MM
    instance_id = models.CharField(max_length=64)
    instance_name = models.CharField(max_length=100, null=True)
    resource_type = models.CharField(max_length=20)  # ECS实例, 云盘, 弹性IP
    product_type = models.CharField(max_length=20)  # prepay, postpay
    finance_price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.CharField(max_length=20, default=human_datetime)
    
    def to_view(self):
        return self.to_dict()
    
    def __repr__(self):
        return f'<ResourceCost {self.instance_id} {self.month}>'
    
    class Meta:
        db_table = 'resource_costs'
        ordering = ('-month', '-finance_price')


# 实例模型
class Instance(models.Model, ModelMixin):
    instance_id = models.CharField(max_length=100)  # 实例ID
    name = models.CharField(max_length=100, null=True)  # 实例名称
    internal_ip = models.CharField(max_length=50, null=True)  # 内网IP
    public_ip = models.CharField(max_length=50, null=True)  # 公网IP
    status = models.CharField(max_length=20, null=True)  # 状态
    zone_name = models.CharField(max_length=100, null=True)  # 可用区
    create_time = models.CharField(max_length=50, null=True)  # 创建时间
    expire_time = models.CharField(max_length=50, null=True)  # 过期时间
    payment_timing = models.CharField(max_length=50, null=True)  # 付费类型
    cpu_count = models.IntegerField(null=True)  # CPU核心数
    memory_capacity_in_gb = models.FloatField(null=True)  # 内存大小(GB)
    image_name = models.CharField(max_length=100, null=True)  # 镜像名称
    os_name = models.CharField(max_length=50, null=True)  # 操作系统名称
    os_version = models.CharField(max_length=50, null=True)  # 操作系统版本
    os_arch = models.CharField(max_length=20, null=True)  # 操作系统架构
    desc = models.CharField(max_length=255, null=True)  # 描述信息
    
    def to_view(self):
        return self.to_dict()
    
    def __repr__(self):
        return '<Instance %r>' % self.instance_id
    
    class Meta:
        db_table = 'instances'
        ordering = ('-id',)
