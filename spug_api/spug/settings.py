"""
# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.

Django settings for spug project.

Generated by 'django-admin startproject' using Django 2.2.7.

For more information on this file, see
https://docs.djangoproject.com/en/2.2/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/2.2/ref/settings/
"""

import os
import re

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/2.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'vk0do47)egwzz!uk49%(y3s(fpx4+ha@ugt-hcv&%&d@hwr&p7'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['127.0.0.1', 'localhost', '0.0.0.0', '*']

# CORS设置
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = ['Content-Type', 'X-Requested-With', 'Authorization', 'Content-Disposition']
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-token',
    'x-real-ip',
    'x-forwarded-for',
    'x-forwarded-proto',
]

# Application definition

INSTALLED_APPS = [
    'apps.account',
    'apps.host',
    'apps.setting',
    'apps.exec',
    'apps.schedule',
    'apps.monitor',
    'apps.config',
    'apps.app',
    'apps.deploy',
    'apps.notify',
    'apps.repository',
    'apps.home',
    'channels',
    'corsheaders',  # 添加CORS支持
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # CORS中间件，必须放在最前面
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'libs.middleware.AuthenticationMiddleware',
    'libs.middleware.HandleExceptionMiddleware',
]

ROOT_URLCONF = 'spug.urls'

WSGI_APPLICATION = 'spug.wsgi.application'
ASGI_APPLICATION = 'spug.routing.application'

# Database
# https://docs.djangoproject.com/en/2.2/ref/settings/#databases

DATABASES = {
    'default': {
        'ATOMIC_REQUESTS': True,
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "unique-snowflake",
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': False,
    },
]

TOKEN_TTL = 8 * 3600
SCHEDULE_KEY = 'spug:schedule'
SCHEDULE_WORKER_KEY = 'spug:schedule:worker'
MONITOR_KEY = 'spug:monitor'
MONITOR_WORKER_KEY = 'spug:monitor:worker'
EXEC_WORKER_KEY = 'spug:exec:worker'
REQUEST_KEY = 'spug:request'
BUILD_KEY = 'spug:build'
REPOS_DIR = os.path.join(os.path.dirname(os.path.dirname(BASE_DIR)), 'repos')
BUILD_DIR = os.path.join(REPOS_DIR, 'build')
TRANSFER_DIR = os.path.join(BASE_DIR, 'storage', 'transfer')

# Internationalization
# https://docs.djangoproject.com/en/2.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Asia/Shanghai'

USE_I18N = True

USE_L10N = True

USE_TZ = False

AUTHENTICATION_EXCLUDES = (
    '/account/login/',
    '/setting/basic/',
    re.compile('/apis/.*'),
    re.compile('/exec/ansible/result/.*'),
)

SPUG_VERSION = 'v3.3.3'

# override default config
try:
    from spug.overrides import *
except ImportError:
    pass

# 允许处理来自代理的IP
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
