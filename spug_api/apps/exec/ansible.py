# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.views.generic import View
from django.http import JsonResponse
from django_redis import get_redis_connection
from django.conf import settings
from libs import json_response, JsonParser, Argument, human_datetime, auth
from apps.exec.models import ExecHistory
from apps.host.models import Host
from apps.setting.utils import AppSetting
from apps.account.utils import has_host_perm
from libs.utils import str_decode, human_seconds_time
from concurrent import futures
from threading import Thread
import tempfile
import uuid
import json
import time
import os
import subprocess


class AnsibleView(View):
    @auth('exec.task.do')
    def get(self, request):
        """获取用户Ansible执行历史记录"""
        records = ExecHistory.objects.filter(user=request.user, command_type='ansible')
        return json_response([x.to_dict() for x in records])

    @auth('exec.task.do')
    def post(self, request):
        """提交Ansible Playbook执行请求"""
        form, error = JsonParser(
            Argument('template_id', type=int, required=False),
            Argument('playbook', help='请输入Ansible Playbook内容'),
            Argument('host_list', type=list, filter=lambda x: len(x), help='请提供目标主机列表'),
            Argument('params', type=dict, required=False),
            Argument('extra_vars', required=False),
        ).parse(request.body)
        
        if error is None:
            # 验证主机列表格式
            for host in form.host_list:
                if not all(k in host for k in ('ip', 'port', 'username')):
                    return json_response(error='主机信息不完整，必须包含IP、端口和用户名')
            
            token = uuid.uuid4().hex
            rds = get_redis_connection()
            
            # 保存执行历史记录
            ExecHistory.objects.create(
                user=request.user,
                digest=token,
                command_type='ansible',
                interpreter='ansible-playbook',
                template_id=form.template_id if hasattr(form, 'template_id') else None,
                command=form.playbook,
                host_ids=json.dumps([h.get('id', 0) for h in form.host_list]),
                params=json.dumps(form.params) if hasattr(form, 'params') else '{}'
            )
            
            # 使用临时缓存，确保状态码为字符串
            rds.hset(f'ansible:result:{token}', 'status', str(-2))  # -2表示执行中
            rds.hset(f'ansible:result:{token}', 'output', '')
            rds.expire(f'ansible:result:{token}', 3600)  # 1小时过期
            
            # 触发异步执行
            task_data = {
                'token': token,
                'playbook': form.playbook,
                'hosts': form.host_list,
                'extra_vars': form.extra_vars if hasattr(form, 'extra_vars') else ''
            }
            Thread(target=_dispatch_ansible, args=(task_data,)).start()
            
            return json_response(token)
        
        return json_response(error=error)


class AnsibleResultView(View):
    # 不使用任何装饰器，确保无需认证即可访问
    def get(self, request, token):
        """轮询获取Ansible执行结果"""
        print(f"收到结果请求：token={token}")
        rds = get_redis_connection()
        output = rds.hget(f'ansible:result:{token}', 'output')
        status = rds.hget(f'ansible:result:{token}', 'status')
        
        if output is None:
            print(f"Token {token} 不存在或已过期")
            response = JsonResponse({'error': 'Token不存在或已过期'}, status=404)
        else:
            # 修复状态码处理，确保返回正确的整数类型
            try:
                status_code = int(status) if status else -2
            except (ValueError, TypeError):
                # 如果转换失败，默认为执行中状态
                print(f"状态码转换失败: {status}，设置为默认值 -2")
                status_code = -2
                
            print(f"返回Token {token} 的结果，状态码：{status_code}")
            response = JsonResponse({
                'output': output.decode() if output else '',
                'status': status_code
            })
        
        # 添加CORS头
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response["Access-Control-Allow-Headers"] = "*"
        return response


def _dispatch_ansible(task_data):
    """
    异步执行Ansible Playbook
    :param task_data: 包含token, playbook内容和主机列表的字典
    """
    rds = get_redis_connection()
    token = task_data['token']
    playbook = task_data['playbook']
    hosts = task_data['hosts']
    extra_vars = task_data['extra_vars']
    
    # 记录更详细的日志
    print(f"====== 开始处理Ansible请求 - Token: {token} ======")
    print(f"主机数量: {len(hosts)}")
    
    # 初始连接信息
    initial_msg = '\r\n\x1b[36m### Ansible服务已连接，正在准备环境... ###\x1b[0m\r\n'
    print(f"发送初始连接消息到token {token}")
    rds.hset(f'ansible:result:{token}', 'output', initial_msg)
    
    # 确保状态码为整数字符串，而不是字节
    rds.hset(f'ansible:result:{token}', 'status', str(-2))
    
    try:
        # 发送连接信息
        connection_info = f"\r\n\x1b[36m### 目标主机信息 ###\x1b[0m\r\n"
        for i, host in enumerate(hosts, 1):
            connection_info += f"\r\n\x1b[36m# 主机{i}: {host['ip']}:{host['port']} 用户: {host['username']} {'(使用密码认证)' if host.get('password') else '(使用密钥认证)'}\x1b[0m\r\n"
            print(f"准备连接主机: {host['ip']}:{host['port']} 用户: {host['username']}")
        
        print(f"发送主机连接信息到token {token}")
        current_output = rds.hget(f'ansible:result:{token}', 'output').decode()
        rds.hset(f'ansible:result:{token}', 'output', current_output + connection_info)
        
        # 创建临时目录用于存放inventory和playbook文件
        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"创建临时目录: {temp_dir}")
            
            # 创建inventory文件
            inventory_path = os.path.join(temp_dir, 'inventory')
            with open(inventory_path, 'w') as f:
                f.write('[all]\n')
                for host in hosts:
                    f.write(f"{host['ip']} ansible_port={host['port']} ansible_user={host['username']}\n")
            
            # 设置SSH密钥或密码认证
            ansible_vars = []
            for host in hosts:
                if host.get('password'):
                    # 如果提供了密码，配置为使用密码认证
                    ansible_vars.append(f"ansible_ssh_pass={host['password']}")
                    print(f"主机 {host['ip']} 使用密码认证")
                else:
                    # 否则使用默认密钥
                    with tempfile.NamedTemporaryFile(mode='w', delete=False) as key_file:
                        key_path = key_file.name
                        key_file.write(AppSetting.get('private_key'))
                        key_file.flush()
                        os.chmod(key_file.name, 0o600)
                        ansible_vars.append(f"ansible_ssh_private_key_file={key_file.name}")
                        print(f"主机 {host['ip']} 使用密钥认证，密钥文件: {key_file.name}")
            
            # 添加通用配置，增加连接超时设置
            ansible_vars.append("ansible_ssh_common_args='-o StrictHostKeyChecking=no -o ConnectTimeout=10'")
            
            # 写入全局变量
            with open(inventory_path, 'a') as f:
                f.write("\n[all:vars]\n")
                for var in ansible_vars:
                    f.write(f"{var}\n")
            
            print(f"Inventory文件已创建: {inventory_path}")
            
            # 发送inventory文件信息
            inventory_content = open(inventory_path, 'r').read()
            current_output = rds.hget(f'ansible:result:{token}', 'output').decode()
            inventory_info = f"\r\n\x1b[36m### Ansible Inventory文件 ###\x1b[0m\r\n{inventory_content}\r\n"
            rds.hset(f'ansible:result:{token}', 'output', current_output + inventory_info)
            
            # 创建playbook文件
            playbook_path = os.path.join(temp_dir, 'playbook.yml')
            with open(playbook_path, 'w') as f:
                f.write(playbook)
            
            print(f"Playbook文件已创建: {playbook_path}")
            
            # 准备执行命令，添加超时参数
            command = ['ansible-playbook', '-i', inventory_path, playbook_path, '-T', '30']
            
            # 添加额外变量
            if extra_vars:
                extra_vars_path = os.path.join(temp_dir, 'extra_vars.json')
                with open(extra_vars_path, 'w') as f:
                    f.write(extra_vars)
                command.extend(['--extra-vars', f'@{extra_vars_path}'])
                print(f"使用额外变量文件: {extra_vars_path}")
            
            # 发送命令信息
            cmd_str = ' '.join(command)
            print(f"完整命令: {cmd_str}")
            current_output = rds.hget(f'ansible:result:{token}', 'output').decode()
            cmd_info = f"\r\n\x1b[36m### 执行命令: {cmd_str} ###\x1b[0m\r\n"
            rds.hset(f'ansible:result:{token}', 'output', current_output + cmd_info)
            
            # 执行Ansible命令并捕获输出
            print(f"====== 开始执行Ansible命令 - Token: {token} ======")
            current_output = rds.hget(f'ansible:result:{token}', 'output').decode()
            exec_start_msg = '\r\n\x1b[36m### 开始执行Ansible Playbook...\x1b[0m\r\n'
            rds.hset(f'ansible:result:{token}', 'output', current_output + exec_start_msg)
            
            start_time = time.time()
            
            # 修改为使用run而不是Popen，更可靠地处理子进程
            try:
                # 使用subprocess.run来确保等待进程完成
                print(f"执行命令中...")
                result = subprocess.run(
                    command, 
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.STDOUT, 
                    text=True,
                    check=False  # 不要因为非零退出码而抛出异常
                )
                
                # 将输出添加到Redis
                print(f"命令执行完成，状态码: {result.returncode}")
                if result.stdout:
                    print(f"输出长度: {len(result.stdout)} 字节")
                else:
                    print("警告: 命令没有输出内容")
                
                current_output = rds.hget(f'ansible:result:{token}', 'output').decode()
                if result.stdout:
                    rds.hset(f'ansible:result:{token}', 'output', current_output + result.stdout)
                else:
                    no_output_msg = "\r\n\x1b[33m### 警告: 命令执行完成但没有输出 ###\x1b[0m\r\n"
                    rds.hset(f'ansible:result:{token}', 'output', current_output + no_output_msg)
                
                # 获取退出码
                exit_code = result.returncode
            except Exception as ex:
                print(f"执行Ansible命令时出错: {str(ex)}")
                current_output = rds.hget(f'ansible:result:{token}', 'output').decode()
                error_msg = f"\r\n\x1b[31m### 执行命令出错: {str(ex)} ###\x1b[0m\r\n"
                rds.hset(f'ansible:result:{token}', 'output', current_output + error_msg)
                exit_code = 1  # 设置为错误状态
            
            elapsed_time = human_seconds_time(time.time() - start_time)
            
            result_message = ""
            if exit_code == 0:
                result_message = f'\r\n\x1b[32m### Ansible Playbook执行成功，总耗时：{elapsed_time} ###\x1b[0m\r\n'
            else:
                result_message = f'\r\n\x1b[31m### Ansible Playbook执行失败，退出代码：{exit_code}，总耗时：{elapsed_time} ###\x1b[0m\r\n'
            
            print(f"====== Ansible执行结束 - Token: {token}，退出代码: {exit_code}，耗时: {elapsed_time} ======")
            current_output = rds.hget(f'ansible:result:{token}', 'output').decode()
            rds.hset(f'ansible:result:{token}', 'output', current_output + result_message)
            
            # 在最后设置状态码时确保使用整数字符串
            rds.hset(f'ansible:result:{token}', 'status', str(exit_code))
            print(f"状态码已更新为: {exit_code}")
    
    except Exception as e:
        # 捕获并发送异常信息
        error_message = f'\r\n\x1b[31m### 执行异常：{str(e)} ###\x1b[0m\r\n'
        print(f"执行异常: {str(e)}")
        current_output = rds.hget(f'ansible:result:{token}', 'output').decode()
        rds.hset(f'ansible:result:{token}', 'output', current_output + error_message)
        rds.hset(f'ansible:result:{token}', 'status', str(-1))  # -1表示执行失败，确保为字符串 
        print(f"状态码已更新为: -1 (失败)")
    
    print(f"====== Ansible请求处理完成 - Token: {token} ======") 