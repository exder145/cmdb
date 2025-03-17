# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.apps import AppConfig


class HostConfig(AppConfig):
    name = 'apps.host'
    verbose_name = '主机管理'

    def ready(self):
        # 导入数据迁移模块
        from apps.host.init_data import init_asset_data
        # 初始化资产数据
        init_asset_data()
        pass 