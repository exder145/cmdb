# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.views.generic import View
from django.db.models import F, Q
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


class HostView(View):
    def get(self, request):
        hosts = Host.objects.select_related('hostextend')
        if not request.user.is_supper:
            hosts = hosts.filter(id__in=get_host_perms(request.user))
        hosts = {x.id: x.to_view() for x in hosts}
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
            if not _do_host_verify(form):
                return json_response('auth fail')

            group_ids = form.pop('group_ids')
            other = Host.objects.filter(name=form.name).first()
            if other and (not form.id or other.id != form.id):
                return json_response(error=f'已存在的主机名称【{form.name}】')
            if form.id:
                Host.objects.filter(pk=form.id).update(is_verified=True, **form)
                host = Host.objects.get(pk=form.id)
            else:
                host = Host.objects.create(created_by=request.user, is_verified=True, **form)
            host.groups.set(group_ids)
            response = host.to_view()
            response['group_ids'] = group_ids
            return json_response(response)
        return json_response(error=error)

    @auth('host.host.add|host.host.edit')
    def put(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='参数错误')
        ).parse(request.body)
        if error is None:
            host = Host.objects.get(pk=form.id)
            with host.get_ssh() as ssh:
                _sync_host_extend(host, ssh=ssh)
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
            Host.objects.filter(id__in=host_ids).delete()
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
            hosts = Host.objects.all()
        else:
            hosts = Host.objects.filter(is_verified=False).all()
        token = uuid.uuid4().hex
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
        
        # 返回结果
        return json_response({
            'total': total,
            'data': data
        })

# 资源费用统计API视图
class ResourceCostStatsView(View):
    def get(self, request):
        month = request.GET.get('month', '')
        
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
        
        # 返回结果
        return json_response({
            'stats_by_type': stats_by_type,
            'stats_by_month': stats_by_month
        })
