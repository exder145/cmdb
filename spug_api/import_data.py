#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'spug.settings')
django.setup()

# 导入数据
from apps.host.init_data import init_asset_data
init_asset_data()

print("数据导入完成！") 