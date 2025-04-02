# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.views.generic import View
from django.db.models import F, Q, Sum
from django.http.response import HttpResponseBadRequest
from libs import json_response, JsonParser, Argument, AttrDict, auth
from apps.setting.utils import AppSetting
from apps.account.utils import get_host_perms
from apps.host.models import Host, Group, Disk, Storage, CDN, IP, ResourceCost, Instance
from apps.host.utils import batch_sync_host, _sync_host_extend, check_os_type
from apps.exec.models import ExecTemplate
from apps.app.models import Deploy
from apps.schedule.models import Task
from apps.monitor.models import Detection
from libs.ssh import SSH, AuthenticationException
from paramiko.ssh_exception import BadAuthenticationType
from openpyxl import load_workbook
from threading import Thread
import socket
import uuid
from libs import human_datetime
from libs.spug import Notification
from functools import partial
import ipaddress
import json
from django.db import models
from django.core.cache import cache
from dateutil.relativedelta import relativedelta


class HostView(View):
    def get(self, request):
        # 使用Instance模型替代Host模型
        instances = Instance.objects.all()
        if not request.user.is_supper:
            # 保持权限检查逻辑，但使用Instance
            hosts_with_perm = get_host_perms(request.user)
            instances = instances.filter(id__in=hosts_with_perm)
        
        # 转换实例数据为服务器格式
        hosts = {}
        for x in instances:
            hosts[x.id] = {
                'id': x.id,
                'name': x.name,
                'hostname': x.internal_ip or x.public_ip or '',
                'port': 22,  # 默认SSH端口
                'username': 'root',  # 默认用户名
                'desc': x.desc,
                'instance_id': x.instance_id,
                'cpu': x.cpu_count,
                'memory': x.memory_capacity_in_gb,
                'os_name': x.os_name or '',
                'os_type': 'linux' if x.os_name and 'linux' in x.os_name.lower() else ('windows' if x.os_name and 'windows' in x.os_name.lower() else ''),
                'private_ip_address': [x.internal_ip] if x.internal_ip else [],
                'public_ip_address': [x.public_ip] if x.public_ip else [],
                'expired_time': x.expire_time,
                'is_verified': x.status == 'Running',
                'status': x.status or 'Stopped',  # 添加status字段
                'group_ids': []
            }
        
        # 保持原有的分组关联逻辑
        for rel in Group.hosts.through.objects.filter(host_id__in=hosts.keys()):
            hosts[rel.host_id]['group_ids'].append(rel.group_id)
            
        return json_response(list(hosts.values()))

    @auth('host.host.add|host.host.edit')
    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('group_ids', type=list, filter=lambda x: len(x), help='请选择主机分组'),
            Argument('name', help='请输主机名称'),
            Argument('username', handler=str.strip, help='请输入登录用户名'),
            Argument('hostname', handler=str.strip, help='请输入主机名或IP'),
            Argument('port', type=int, help='请输入SSH端口'),
            Argument('pkey', required=False),
            Argument('desc', required=False),
            Argument('password', required=False),
        ).parse(request.body)
        if error is None:
            group_ids = form.pop('group_ids')
            
            # 使用实例表代替主机表
            if form.id:
                # 查找并更新实例
                instance = Instance.objects.filter(pk=form.id).first()
                if not instance:
                    return json_response(error='未找到指定服务器')
                    
                # 更新实例信息
                instance.name = form.name
                instance.internal_ip = form.hostname
                instance.desc = form.get('desc')
                instance.status = 'Running'  # 标记为已验证
                instance.save()
                
                # 获取完整的实例数据
                result = {
                    'id': instance.id,
                    'name': instance.name,
                    'hostname': instance.internal_ip or instance.public_ip or '',
                    'port': form.port,  # 保存端口
                    'username': form.username,  # 保存用户名
                    'desc': instance.desc,
                    'instance_id': instance.instance_id,
                    'cpu': instance.cpu_count,
                    'memory': instance.memory_capacity_in_gb,
                    'os_name': instance.os_name or '',
                    'os_type': 'linux' if instance.os_name and 'linux' in instance.os_name.lower() else ('windows' if instance.os_name and 'windows' in instance.os_name.lower() else ''),
                    'private_ip_address': [instance.internal_ip] if instance.internal_ip else [],
                    'public_ip_address': [instance.public_ip] if instance.public_ip else [],
                    'expired_time': instance.expire_time,
                    'is_verified': instance.status == 'Running',
                    'status': instance.status or 'Stopped',  # 添加status字段
                    'group_ids': group_ids
                }
            else:
                # 创建新实例
                instance = Instance.objects.create(
                    name=form.name,
                    internal_ip=form.hostname,
                    status='Running',  # 标记为已验证
                    desc=form.get('desc'),
                    created_by=request.user
                )
                
                # 获取完整的实例数据
                result = {
                    'id': instance.id,
                    'name': instance.name,
                    'hostname': instance.internal_ip or '',
                    'port': form.port,
                    'username': form.username,
                    'desc': instance.desc,
                    'instance_id': instance.instance_id,
                    'cpu': instance.cpu_count,
                    'memory': instance.memory_capacity_in_gb,
                    'os_name': instance.os_name or '',
                    'os_type': 'linux',  # 默认类型
                    'private_ip_address': [instance.internal_ip] if instance.internal_ip else [],
                    'public_ip_address': [instance.public_ip] if instance.public_ip else [],
                    'expired_time': instance.expire_time,
                    'is_verified': instance.status == 'Running',
                    'status': instance.status or 'Stopped',  # 添加status字段
                    'group_ids': group_ids
                }
            
            # 更新分组关系 - 使用现有的Group和Host的关联关系
            # 需要创建一个可用的Host记录来维持分组关系，或修改分组模型
            if group_ids:
                # 获取分组
                groups = Group.objects.filter(id__in=group_ids)
                for group in groups:
                    group.hosts.add(instance.id)
            
            return json_response(result)
        return json_response(error=error)

    @auth('host.host.add|host.host.edit')
    def put(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='参数错误')
        ).parse(request.body)
        if error is None:
            # 查找并获取实例
            instance = Instance.objects.get(pk=form.id)
            
            # 创建一个临时的主机对象用于SSH连接
            host = AttrDict()
            host.hostname = instance.internal_ip or instance.public_ip
            host.port = 22  # 默认SSH端口
            host.username = 'root'  # 默认用户名
            host.private_key = AppSetting.get('private_key')
            
            def get_ssh(self, pkey=None, default_env=None):
                pkey = pkey or self.private_key
                return SSH(self.hostname, self.port, self.username, pkey, default_env=default_env)
            
            host.get_ssh = lambda pkey=None, default_env=None: get_ssh(host, pkey, default_env)
            
            # 执行验证和扩展信息获取
            try:
                with host.get_ssh() as ssh:
                    # 获取扩展信息
                    info = ssh.exec_command('cat /proc/cpuinfo | grep processor | wc -l')
                    if info:
                        instance.cpu_count = int(info)
                    
                    info = ssh.exec_command("free -m | grep Mem | awk '{print $2}'")
                    if info:
                        instance.memory_capacity_in_gb = round(int(info) / 1024, 2)
                    
                    info = ssh.exec_command("uname -a")
                    if info:
                        instance.os_name = info
                        
                    # 更新状态为已验证
                    instance.status = 'Running'
                    instance.save()
            except Exception as e:
                return json_response(error=f'验证失败: {str(e)}')
                
        return json_response(error=error)

    @auth('admin')
    def patch(self, request):
        form, error = JsonParser(
            Argument('host_ids', type=list, filter=lambda x: len(x), help='请选择主机'),
            Argument('s_group_id', type=int, help='参数错误'),
            Argument('t_group_id', type=int, help='参数错误'),
            Argument('is_copy', type=bool, help='参数错误'),
        ).parse(request.body)
        if error is None:
            if form.t_group_id == form.s_group_id:
                return json_response(error='不能选择本分组的主机')
            s_group = Group.objects.get(pk=form.s_group_id)
            t_group = Group.objects.get(pk=form.t_group_id)
            t_group.hosts.add(*form.host_ids)
            if not form.is_copy:
                s_group.hosts.remove(*form.host_ids)
        return json_response(error=error)

    @auth('host.host.del')
    def delete(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('group_id', type=int, required=False),
        ).parse(request.GET)
        if error is None:
            if form.id:
                host_ids = [form.id]
            elif form.group_id:
                group = Group.objects.get(pk=form.group_id)
                host_ids = [x.id for x in group.hosts.all()]
            else:
                return json_response(error='参数错误')
                
            for host_id in host_ids:
                regex = fr'[^0-9]{host_id}[^0-9]'
                deploy = Deploy.objects.filter(host_ids__regex=regex) \
                    .annotate(app_name=F('app__name'), env_name=F('env__name')).first()
                if deploy:
                    return json_response(error=f'应用【{deploy.app_name}】在【{deploy.env_name}】的发布配置关联了该主机，请解除关联后再尝试删除该主机')
                task = Task.objects.filter(targets__regex=regex).first()
                if task:
                    return json_response(error=f'任务计划中的任务【{task.name}】关联了该主机，请解除关联后再尝试删除该主机')
                detection = Detection.objects.filter(type__in=('3', '4'), targets__regex=regex).first()
                if detection:
                    return json_response(error=f'监控中心的任务【{detection.name}】关联了该主机，请解除关联后再尝试删除该主机')
                tpl = ExecTemplate.objects.filter(host_ids__regex=regex).first()
                if tpl:
                    return json_response(error=f'执行模板【{tpl.name}】关联了该主机，请解除关联后再尝试删除该主机')
                    
            # 删除实例而不是主机
            Instance.objects.filter(id__in=host_ids).delete()
        return json_response(error=error)


@auth('host.host.add')
def post_import(request):
    group_id = request.POST.get('group_id')
    file = request.FILES['file']
    hosts = []
    ws = load_workbook(file, read_only=True)['Sheet1']
    summary = {'fail': 0, 'success': 0, 'invalid': [], 'skip': [], 'repeat': []}
    for i, row in enumerate(ws.rows, start=1):
        if i == 1:  # 第1行是表头 略过
            continue
        if not all([row[x].value for x in range(4)]):
            summary['invalid'].append(i)
            summary['fail'] += 1
            continue
        data = AttrDict(
            name=row[0].value,
            hostname=row[1].value,
            port=row[2].value,
            username=row[3].value,
            desc=row[5].value
        )
        if Host.objects.filter(hostname=data.hostname, port=data.port, username=data.username).exists():
            summary['skip'].append(i)
            summary['fail'] += 1
            continue
        if Host.objects.filter(name=data.name).exists():
            summary['repeat'].append(i)
            summary['fail'] += 1
            continue
        host = Host.objects.create(created_by=request.user, **data)
        host.groups.add(group_id)
        summary['success'] += 1
        host.password = row[4].value
        hosts.append(host)
    token = uuid.uuid4().hex
    if hosts:
        Thread(target=batch_sync_host, args=(token, hosts)).start()
    return json_response({'summary': summary, 'token': token, 'hosts': {x.id: {'name': x.name} for x in hosts}})


@auth('host.host.add')
def post_parse(request):
    file = request.FILES['file']
    if file:
        data = file.read()
        return json_response(data.decode())
    else:
        return HttpResponseBadRequest()


@auth('host.host.add')
def batch_valid(request):
    form, error = JsonParser(
        Argument('password', required=False),
        Argument('range', filter=lambda x: x in ('1', '2'), help='参数错误')
    ).parse(request.body)
    if error is None:
        if form.range == '1':  # all hosts
            instances = Instance.objects.all()
        else:
            # 查找未验证的实例（状态不是Running的）
            instances = Instance.objects.exclude(status='Running').all()
            
        token = uuid.uuid4().hex
        
        # 由于batch_sync_host函数需要Host对象，这里我们需要创建临时的主机对象
        hosts = []
        for instance in instances:
            # 创建临时Host对象，包含实例的基本信息
            host = AttrDict()
            host.id = instance.id
            host.name = instance.name
            host.hostname = instance.internal_ip or instance.public_ip or ''
            host.port = 22  # 默认SSH端口
            host.username = 'root'  # 默认用户名
            host.is_verified = instance.status == 'Running'
            host.save = lambda: Instance.objects.filter(id=instance.id).update(status='Running')
            hosts.append(host)
            
        Thread(target=batch_sync_host, args=(token, hosts, form.password)).start()
        return json_response({'token': token, 'hosts': {x.id: {'name': x.name} for x in hosts}})
    return json_response(error=error)


def _do_host_verify(form):
    password = form.pop('password')
    if form.pkey:
        try:
            with SSH(form.hostname, form.port, form.username, form.pkey) as ssh:
                ssh.ping()
            return True
        except BadAuthenticationType:
            raise Exception('该主机不支持密钥认证，请参考官方文档，错误代码：E01')
        except AuthenticationException:
            raise Exception('上传的独立密钥认证失败，请检查该密钥是否能正常连接主机（推荐使用全局密钥）')
        except socket.timeout:
            raise Exception('连接主机超时，请检查网络')

    private_key, public_key = AppSetting.get_ssh_key()
    if password:
        try:
            with SSH(form.hostname, form.port, form.username, password=password) as ssh:
                ssh.add_public_key(public_key)
        except BadAuthenticationType:
            raise Exception('该主机不支持密码认证，请参考官方文档，错误代码：E00')
        except AuthenticationException:
            raise Exception('密码连接认证失败，请检查密码是否正确')
        except socket.timeout:
            raise Exception('连接主机超时，请检查网络')

    try:
        with SSH(form.hostname, form.port, form.username, private_key) as ssh:
            ssh.ping()
    except BadAuthenticationType:
        raise Exception('该主机不支持密钥认证，请参考官方文档，错误代码：E01')
    except AuthenticationException:
        if password:
            raise Exception('密钥认证失败，请参考官方文档，错误代码：E02')
        return False
    except socket.timeout:
        raise Exception('连接主机超时，请检查网络')
    return True


# 磁盘视图
class DiskView(View):
    def get(self, request):
        # 检查是否有强制刷新参数
        force_refresh = request.GET.get('force', '0') == '1'
        
        # 从数据库获取磁盘数据
        disks = Disk.objects.all()
        if not request.user.is_supper:
            disks = disks.filter(created_by=request.user)
        
        return json_response([x.to_view() for x in disks])

    @auth('host.disk.add|host.disk.edit')
    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('name', help='请输入磁盘名称'),
            Argument('disk_id', required=False),
            Argument('server_id', required=False),
            Argument('size_in_gb', type=int, required=False),
            Argument('storage_type', required=False),
            Argument('status', help='请选择状态'),
            Argument('create_time', required=False),
            Argument('expire_time', required=False),
            Argument('desc', required=False),
        ).parse(request.body)
        if error is None:
            if form.id:
                disk = Disk.objects.filter(pk=form.id).first()
                if not disk:
                    return json_response(error='未找到指定磁盘')
                disk.update_by_dict(form)
            else:
                Disk.objects.create(created_by=request.user, **form)
            return json_response()
        return json_response(error=error)

    @auth('host.disk.del')
    def delete(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='请指定磁盘ID'),
        ).parse(request.GET)
        if error is None:
            Disk.objects.filter(pk=form.id).delete()
        return json_response(error=error)


# 存储视图
class StorageView(View):
    def get(self, request):
        # 检查是否有强制刷新参数
        force_refresh = request.GET.get('force', '0') == '1'
        
        # 从数据库获取存储数据
        storages = Storage.objects.all()
        if not request.user.is_supper:
            storages = storages.filter(created_by=request.user)
        
        return json_response([x.to_view() for x in storages])

    @auth('host.storage.add|host.storage.edit')
    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('name', help='请输入存储名称'),
            Argument('type', help='请选择存储类型'),
            Argument('capacity', type=int, help='请输入存储容量'),
            Argument('usage', type=int, required=False),
            Argument('status', help='请选择状态'),
            Argument('desc', required=False),
        ).parse(request.body)
        if error is None:
            if form.id:
                storage = Storage.objects.filter(pk=form.id).first()
                if not storage:
                    return json_response(error='未找到指定存储')
                storage.update_by_dict(form)
            else:
                Storage.objects.create(created_by=request.user, **form)
            return json_response()
        return json_response(error=error)

    @auth('host.storage.del')
    def delete(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='请指定存储ID'),
        ).parse(request.GET)
        if error is None:
            Storage.objects.filter(pk=form.id).delete()
        return json_response(error=error)


# CDN视图
class CDNView(View):
    def get(self, request):
        # 检查是否有强制刷新参数
        force_refresh = request.GET.get('force', '0') == '1'
        
        # 从数据库获取CDN数据
        cdns = CDN.objects.all()
        if not request.user.is_supper:
            cdns = cdns.filter(created_by=request.user)
        
        return json_response([x.to_view() for x in cdns])

    @auth('host.cdn.add|host.cdn.edit')
    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('name', help='请输入CDN名称'),
            Argument('domain', help='请输入域名'),
            Argument('type', help='请选择CDN类型'),
            Argument('bandwidth', type=int, required=False),
            Argument('status', help='请选择状态'),
            Argument('desc', required=False),
        ).parse(request.body)
        if error is None:
            if form.id:
                cdn = CDN.objects.filter(pk=form.id).first()
                if not cdn:
                    return json_response(error='未找到指定CDN')
                cdn.update_by_dict(form)
            else:
                CDN.objects.create(created_by=request.user, **form)
            return json_response()
        return json_response(error=error)

    @auth('host.cdn.del')
    def delete(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='请指定CDN ID'),
        ).parse(request.GET)
        if error is None:
            CDN.objects.filter(pk=form.id).delete()
        return json_response(error=error)


# IP地址视图
class IPView(View):
    def get(self, request):
        # 检查是否有强制刷新参数
        force_refresh = request.GET.get('force', '0') == '1'
        
        # 从数据库获取IP数据
        ips = IP.objects.all()
        if not request.user.is_supper:
            ips = ips.filter(name__contains=request.user.username)
        
        return json_response([x.to_view() for x in ips])

    @auth('host.ip.add|host.ip.edit')
    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('name', required=False),
            Argument('eip', help='请输入IP地址'),
            Argument('status', required=False),
            Argument('instance', required=False),
            Argument('paymentTiming', required=False),
            Argument('billingMethod', required=False),
            Argument('expireTime', required=False),
            Argument('createTime', required=False),
        ).parse(request.body)
        if error is None:
            if form.id:
                ip = IP.objects.filter(pk=form.id).first()
                if not ip:
                    return json_response(error='未找到指定IP')
                ip.update_by_dict(form)
            else:
                IP.objects.create(**form)
            return json_response()
        return json_response(error=error)

    @auth('host.ip.del')
    def delete(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='请指定IP ID'),
        ).parse(request.GET)
        if error is None:
            IP.objects.filter(pk=form.id).delete()
        return json_response(error=error)


# 实例视图
class InstanceView(View):
    def get(self, request):
        # 检查是否有强制刷新参数
        force_refresh = request.GET.get('force', '0') == '1'
        
        # 从数据库获取实例数据
        instances = Instance.objects.all()
        
        return json_response([x.to_view() for x in instances])

    @auth('host.instance.add|host.instance.edit')
    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('instance_id', help='请输入实例ID'),
            Argument('name', required=False),
            Argument('internal_ip', required=False),
            Argument('public_ip', required=False),
            Argument('status', required=False),
            Argument('zone_name', required=False),
            Argument('create_time', required=False),
            Argument('expire_time', required=False),
            Argument('payment_timing', required=False),
            Argument('cpu_count', type=int, required=False),
            Argument('memory_capacity_in_gb', type=float, required=False),
            Argument('image_name', required=False),
            Argument('os_name', required=False),
            Argument('os_version', required=False),
            Argument('os_arch', required=False),
            Argument('desc', required=False),
        ).parse(request.body)
        if error is None:
            if form.id:
                instance = Instance.objects.filter(pk=form.id).first()
                if not instance:
                    return json_response(error='未找到指定实例')
                instance.update_by_dict(form)
            else:
                Instance.objects.create(**form)
            return json_response()
        return json_response(error=error)

    @auth('host.instance.del')
    def delete(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='请指定实例ID'),
        ).parse(request.GET)
        if error is None:
            Instance.objects.filter(pk=form.id).delete()
        return json_response(error=error)


# 资源费用API视图
class ResourceCostView(View):
    def get(self, request):
        resource_type = request.GET.get('resource_type', '')
        month = request.GET.get('month', '')
        product_type = request.GET.get('product_type', '')
        limit = int(request.GET.get('limit', 10))
        offset = int(request.GET.get('offset', 0))
        sort_by = request.GET.get('sort_by', '-month')
        search = request.GET.get('search', '')
        start_date = request.GET.get('start_date', '')
        end_date = request.GET.get('end_date', '')
        
        # 生成缓存键，包含所有查询参数
        cache_key = f"resource_costs_{resource_type}_{month}_{product_type}_{limit}_{offset}_{sort_by}_{search}_{start_date}_{end_date}"
        
        # 尝试从缓存获取数据
        cached_data = cache.get(cache_key)
        if cached_data and not request.GET.get('force', '0') == '1':
            print(f"从缓存返回资源费用数据: {cache_key}")
            return json_response(cached_data)
            
        # 构建查询条件
        filters = {}
        if resource_type:
            filters['resource_type'] = resource_type
        if month:
            filters['month'] = month
        if product_type:
            filters['product_type'] = product_type
            
        # 添加自定义日期范围
        if start_date and end_date and not month:
            start_month = start_date[:7]  # 提取YYYY-MM部分
            end_month = end_date[:7]      # 提取YYYY-MM部分
            # 如果起始月份和结束月份相同，就直接用month过滤
            if start_month == end_month:
                filters['month'] = start_month
            else:
                # 获取日期范围内的所有月份
                import datetime
                
                start_year, start_month_num = map(int, start_month.split('-'))
                end_year, end_month_num = map(int, end_month.split('-'))
                
                months = []
                # 循环生成所有月份
                for year in range(start_year, end_year + 1):
                    for month_num in range(1, 13):
                        # 跳过范围外的月份
                        if year == start_year and month_num < start_month_num:
                            continue
                        if year == end_year and month_num > end_month_num:
                            continue
                        # 添加月份
                        months.append(f"{year}-{month_num:02d}")
                
                # 使用__in查询包含所有月份
                filters['month__in'] = months
            
        # 获取数据并去重
        queryset = ResourceCost.objects.filter(**filters)
        
        # 添加搜索条件
        if search:
            queryset = queryset.filter(
                models.Q(instance_id__icontains=search) | 
                models.Q(instance_name__icontains=search)
            )
            
        queryset = queryset.values('instance_id', 'month') \
            .annotate(
                max_id=models.Max('id'),
                latest_finance_price=models.Max('finance_price')
            )
        
        # 获取完整记录
        ids = [item['max_id'] for item in queryset]
        queryset = ResourceCost.objects.filter(id__in=ids)
        
        # 添加排序
        if 'finance_price' in sort_by:
            # SQLite不支持CAST AS DECIMAL，使用CAST AS REAL
            sort_by = f"-finance_price" if sort_by.startswith('-') else "finance_price"
            queryset = queryset.extra(
                select={'finance_price_float': 'CAST(REPLACE(REPLACE(finance_price, "¥", ""), ",", "") AS REAL)'}) \
                .order_by(sort_by.replace('finance_price', 'finance_price_float'))
        else:
            queryset = queryset.order_by(sort_by)
            
        # 获取总数
        total = queryset.count()
        
        # 如果limit非常大（比如999999），则返回所有数据
        if limit > 1000:
            results = queryset.all()
        else:
            # 否则进行正常分页
            results = queryset[offset:offset + limit]
        
        # 获取上个月数据用于计算环比
        all_months = ResourceCost.objects.values_list('month', flat=True).distinct().order_by('month')
        all_months = list(all_months)
        month_map = {m: idx for idx, m in enumerate(all_months)}
        
        # 计算每个资源每个月的环比变化
        change_map = {}
        for item in results:
            # 获取上个月
            current_idx = month_map.get(item.month)
            if current_idx is not None and current_idx > 0:
                prev_month = all_months[current_idx - 1]
                # 查找同一资源上个月的数据
                prev_record = ResourceCost.objects.filter(
                    instance_id=item.instance_id,
                    resource_type=item.resource_type,
                    month=prev_month
                ).first()
                
                if prev_record:
                    # 计算环比变化
                    current_price = float(str(item.finance_price).replace('¥', '').replace(',', ''))
                    prev_price = float(str(prev_record.finance_price).replace('¥', '').replace(',', ''))
                    if prev_price > 0:
                        change = round(((current_price - prev_price) / prev_price) * 100, 2)
                    else:
                        change = 100 if current_price > 0 else 0
                    change_map[(item.instance_id, item.month)] = change
        
        # 转换为字典格式
        data = []
        for item in results:
            # 获取环比变化
            change = change_map.get((item.instance_id, item.month), 0)
            
            data.append({
                'id': item.id,
                'month': item.month,
                'instance_id': item.instance_id,
                'instance_name': item.instance_name or item.instance_id,
                'resource_type': item.resource_type,
                'product_type': item.product_type,
                'finance_price': str(item.finance_price).replace('¥', '').replace(',', ''),
                'change': change,
                'created_at': item.created_at
            })
        
        # 构建响应数据
        response_data = {
            'total': total,
            'data': data
        }
        
        # 将结果保存到缓存（设置5分钟过期）
        cache.set(cache_key, response_data, 300)  # 缓存5分钟
        
        # 返回结果
        return json_response(response_data)

# 资源费用统计API视图
class ResourceCostStatsView(View):
    def get(self, request):
        from django.core.cache import cache
        
        month = request.GET.get('month', '')
        
        # 生成缓存键
        cache_key = f"resource_cost_stats_{month}"
        
        # 尝试从缓存获取数据
        cached_data = cache.get(cache_key)
        if cached_data and not request.GET.get('force', '0') == '1':
            print(f"从缓存返回统计数据: {cache_key}")
            return json_response(cached_data)
        
        # 按资源类型统计费用总额
        stats_by_type = []
        for resource_type in ['ECS实例', '云盘', '弹性IP']:
            filters = {'resource_type': resource_type}
            if month:
                filters['month'] = month
                
            queryset = ResourceCost.objects.filter(**filters)
            total = queryset.count()
            if total > 0:
                sum_price = sum(float(item.finance_price) for item in queryset)
                stats_by_type.append({
                    'type': resource_type,
                    'count': total,
                    'total_cost': round(sum_price, 2)
                })
        
        # 按月份统计费用总额
        months = ResourceCost.objects.values_list('month', flat=True).distinct()
        stats_by_month = []
        for month in months:
            queryset = ResourceCost.objects.filter(month=month)
            sum_price = sum(float(item.finance_price) for item in queryset)
            stats_by_month.append({
                'month': month,
                'total_cost': round(sum_price, 2)
            })
        
        # 构建响应数据
        response_data = {
            'stats_by_type': stats_by_type,
            'stats_by_month': stats_by_month
        }
        
        # 将结果保存到缓存（设置10分钟过期）
        cache.set(cache_key, response_data, 600)  # 缓存10分钟
        
        # 返回结果
        return json_response(response_data)

# 实例统计视图 - 用于提供操作系统分布和服务器配置分布的统计数据
class InstanceStatsView(View):
    def get(self, request):
        from django.core.cache import cache
        from django.db.models import Count
        from collections import defaultdict
        
        # 生成缓存键
        cache_key = "instance_stats"
        
        # 尝试从缓存获取数据
        cached_data = cache.get(cache_key)
        if cached_data and not request.GET.get('force', '0') == '1':
            print(f"从缓存返回实例统计数据")
            return json_response(cached_data)
        
        # 获取所有实例
        instances = Instance.objects.all()
        
        # 操作系统分布统计
        os_stats = defaultdict(int)
        for instance in instances:
            # 如果os_name存在且不为None，否则标记为"其他"
            os_name = instance.os_name if instance.os_name else '其他'
            os_stats[os_name] += 1
        
        # 将操作系统分布转换为列表格式
        os_distribution = [
            {'name': name, 'value': count}
            for name, count in os_stats.items()
        ]
        
        # 服务器配置分布统计 (基于CPU和内存)
        config_stats = defaultdict(int)
        for instance in instances:
            if instance.cpu_count is not None and instance.memory_capacity_in_gb is not None:
                # 将服务器按配置分类
                cpu = instance.cpu_count
                memory = instance.memory_capacity_in_gb
                
                # 分类逻辑
                if cpu == 2 and memory <= 4:
                    config = '2核4G'
                elif cpu == 2 and memory <= 8:
                    config = '2核8G'
                elif cpu == 4 and memory <= 8:
                    config = '4核8G'
                elif cpu == 8 and memory <= 16:
                    config = '8核16G'
                elif cpu == 16 and memory <= 32:
                    config = '16核32G'
                else:
                    config = '其他'
                
                config_stats[config] += 1
            else:
                config_stats['其他'] += 1
        
        # 将服务器配置分布转换为列表格式
        config_distribution = [
            {'name': name, 'value': count}
            for name, count in config_stats.items()
        ]
        
        # 构建响应数据
        response_data = {
            'os_distribution': os_distribution,
            'config_distribution': config_distribution
        }
        
        # 将结果保存到缓存（设置1小时过期）
        cache.set(cache_key, response_data, 60 * 60)  # 缓存1小时
        
        # 返回结果
        return json_response(response_data)

# 成本趋势API视图
class CostTrendView(View):
    def get(self, request):
        from django.core.cache import cache
        import datetime
        
        # 获取请求参数
        mode = request.GET.get('mode', 'monthly')  # monthly或yearly
        year = request.GET.get('year', datetime.datetime.now().year)
        
        # 生成缓存键
        cache_key = f"cost_trend_{mode}_{year}"
        
        # 尝试从缓存获取数据
        cached_data = cache.get(cache_key)
        if cached_data and not request.GET.get('force', '0') == '1':
            return json_response(cached_data)
        
        if mode == 'monthly':
            # 按月查询指定年份的资源消费数据
            # 计算资源 (ECS实例)
            compute_costs = []
            storage_costs = []
            network_costs = []
            
            # 遍历12个月
            for month in range(1, 13):
                month_str = f"{year}-{month:02d}"
                
                # 计算资源费用 - ECS实例
                compute_query = ResourceCost.objects.filter(
                    resource_type='ECS实例',
                    month=month_str
                )
                compute_cost = sum(float(str(record.finance_price).replace('¥', '').replace(',', '')) 
                                for record in compute_query) if compute_query else 0
                compute_costs.append(round(compute_cost, 2))
                
                # 存储资源费用 - 云盘
                storage_query = ResourceCost.objects.filter(
                    resource_type='云盘',
                    month=month_str
                )
                storage_cost = sum(float(str(record.finance_price).replace('¥', '').replace(',', '')) 
                                for record in storage_query) if storage_query else 0
                storage_costs.append(round(storage_cost, 2))
                
                # 网络资源费用 - 弹性IP
                network_query = ResourceCost.objects.filter(
                    resource_type='弹性IP',
                    month=month_str
                )
                network_cost = sum(float(str(record.finance_price).replace('¥', '').replace(',', '')) 
                                for record in network_query) if network_query else 0
                network_costs.append(round(network_cost, 2))
            
            # 如果某月没有数据，使用趋势预测或平均值填充
            for i in range(len(compute_costs)):
                if compute_costs[i] == 0 and i > 0:
                    # 简单使用上月数据作为预测
                    compute_costs[i] = compute_costs[i-1]
                if storage_costs[i] == 0 and i > 0:
                    storage_costs[i] = storage_costs[i-1]
                if network_costs[i] == 0 and i > 0:
                    network_costs[i] = network_costs[i-1]
            
            response_data = {
                'year': year,
                'compute': compute_costs,
                'storage': storage_costs,
                'network': network_costs
            }
            
            # 缓存数据 (1小时)
            cache.set(cache_key, response_data, 60 * 60)
            
            return json_response(response_data)
            
        elif mode == 'yearly':
            # 获取最近几年的数据，包括当前年份和未来2年的预测
            current_year = datetime.datetime.now().year
            start_year = 2021  # 从2021年开始
            end_year = current_year + 2
            
            years = list(range(start_year, end_year + 1))
            compute_yearly = []
            storage_yearly = []
            network_yearly = []
            
            # 对于每一年，计算总费用
            for year in years:
                # 如果是2025年及以后，使用预测值
                if year >= 2025:
                    # 简单的线性增长预测，每年增长10%
                    if compute_yearly:
                        compute_yearly.append(round(compute_yearly[-1] * 1.10))
                        storage_yearly.append(round(storage_yearly[-1] * 1.10))
                        network_yearly.append(round(network_yearly[-1] * 1.10))
                    continue
                
                # 获取该年的所有月份数据
                compute_cost = 0
                storage_cost = 0
                network_cost = 0
                
                # 遍历年份的12个月
                for month in range(1, 13):
                    month_str = f"{year}-{month:02d}"
                    
                    # 计算资源费用
                    compute_query = ResourceCost.objects.filter(
                        resource_type='ECS实例',
                        month=month_str
                    )
                    if compute_query:
                        compute_cost += sum(float(str(record.finance_price).replace('¥', '').replace(',', '')) 
                                          for record in compute_query)
                    
                    # 存储资源费用
                    storage_query = ResourceCost.objects.filter(
                        resource_type='云盘',
                        month=month_str
                    )
                    if storage_query:
                        storage_cost += sum(float(str(record.finance_price).replace('¥', '').replace(',', '')) 
                                          for record in storage_query)
                    
                    # 网络资源费用
                    network_query = ResourceCost.objects.filter(
                        resource_type='弹性IP',
                        month=month_str
                    )
                    if network_query:
                        network_cost += sum(float(str(record.finance_price).replace('¥', '').replace(',', '')) 
                                          for record in network_query)
                
                compute_yearly.append(round(compute_cost))
                storage_yearly.append(round(storage_cost))
                network_yearly.append(round(network_cost))
            
            response_data = {
                'years': [str(y) for y in years],
                'compute': compute_yearly,
                'storage': storage_yearly,
                'network': network_yearly
            }
            
            # 缓存数据 (24小时)
            cache.set(cache_key, response_data, 24 * 60 * 60)
            
            return json_response(response_data)
            
        return json_response(error='无效的模式参数')

# Dashboard统计视图
class DashboardStatsView(View):
    def get(self, request):
        from django.core.cache import cache
        import datetime
        from dateutil.relativedelta import relativedelta
        
        # 生成缓存键
        cache_key = "dashboard_stats_summary"
        
        # 尝试从缓存获取数据
        cached_data = cache.get(cache_key)
        if cached_data and not request.GET.get('force', '0') == '1':
            print(f"从缓存返回仪表盘统计数据")
            return json_response(cached_data)
        
        # 计算主机总数
        host_count = Instance.objects.count()
        
        # 计算在线主机数量
        online_count = Instance.objects.filter(status='Running').count()
        
        # 计算30天内即将到期的主机数量
        now = datetime.datetime.now()
        thirty_days_later = now + relativedelta(days=30)
        now_str = now.strftime('%Y-%m-%d')
        thirty_days_later_str = thirty_days_later.strftime('%Y-%m-%d')
        
        expiring_count = Instance.objects.filter(
            expire_time__gte=now_str,
            expire_time__lte=thirty_days_later_str
        ).count()
        
        # 计算上个月的支出总额
        last_month = now - relativedelta(months=1)
        last_month_str = last_month.strftime('%Y-%m')
        
        # 计算当前年度的累计费用
        current_year = now.year
        current_month = now.month
        yearly_costs = {
            'compute': 0,
            'storage': 0,
            'network': 0
        }
        
        # 获取当前年度到目前为止的所有月份的费用数据
        for month in range(1, current_month + 1):
            month_str = f"{current_year}-{month:02d}"
            
            # 计算资源费用
            compute_query = ResourceCost.objects.filter(
                resource_type='ECS实例',
                month=month_str
            )
            if compute_query:
                yearly_costs['compute'] += sum(float(str(record.finance_price).replace('¥', '').replace(',', '')) 
                                          for record in compute_query)
            
            # 存储资源费用
            storage_query = ResourceCost.objects.filter(
                resource_type='云盘',
                month=month_str
            )
            if storage_query:
                yearly_costs['storage'] += sum(float(str(record.finance_price).replace('¥', '').replace(',', '')) 
                                          for record in storage_query)
            
            # 网络资源费用
            network_query = ResourceCost.objects.filter(
                resource_type='弹性IP',
                month=month_str
            )
            if network_query:
                yearly_costs['network'] += sum(float(str(record.finance_price).replace('¥', '').replace(',', '')) 
                                          for record in network_query)
        
        # 计算上个月总支出
        monthly_expense_query = ResourceCost.objects.filter(month=last_month_str)
        monthly_expense = sum(float(str(item.finance_price).replace('¥', '').replace(',', '')) 
                            for item in monthly_expense_query)
                
        # 准备响应数据
        response_data = {
            'hostCount': host_count,
            'onlineCount': online_count,
            'expiringCount': expiring_count,
            'monthlyExpense': round(monthly_expense),
            'yearlyCompute': round(yearly_costs['compute']),
            'yearlyStorage': round(yearly_costs['storage']),
            'yearlyNetwork': round(yearly_costs['network'])
        }
        
        # 缓存结果（1小时过期）
        cache.set(cache_key, response_data, 60 * 60)
        
        # 返回结果
        return json_response(response_data)
