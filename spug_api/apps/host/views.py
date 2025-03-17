# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.views.generic import View
from django.db.models import F
from django.http.response import HttpResponseBadRequest
from libs import json_response, JsonParser, Argument, AttrDict, auth
from apps.setting.utils import AppSetting
from apps.account.utils import get_host_perms
from apps.host.models import Host, Group, Disk, Storage, CDN, IP
from apps.host.utils import batch_sync_host, _sync_host_extend
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
        disks = Disk.objects.all()
        if not request.user.is_supper:
            disks = disks.filter(created_by=request.user)
        return json_response([x.to_view() for x in disks])

    @auth('host.disk.add|host.disk.edit')
    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('name', help='请输入磁盘名称'),
            Argument('size', type=int, help='请输入磁盘容量'),
            Argument('type', help='请选择磁盘类型'),
            Argument('mount_point', required=False),
            Argument('status', help='请选择状态'),
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
        ips = IP.objects.all()
        if not request.user.is_supper:
            ips = ips.filter(created_by=request.user)
        return json_response([x.to_view() for x in ips])

    @auth('host.ip.add|host.ip.edit')
    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('address', help='请输入IP地址'),
            Argument('type', help='请选择IP类型'),
            Argument('region', required=False),
            Argument('bandwidth', type=int, required=False),
            Argument('status', help='请选择状态'),
            Argument('desc', required=False),
        ).parse(request.body)
        if error is None:
            if form.id:
                ip = IP.objects.filter(pk=form.id).first()
                if not ip:
                    return json_response(error='未找到指定IP')
                ip.update_by_dict(form)
            else:
                IP.objects.create(created_by=request.user, **form)
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
