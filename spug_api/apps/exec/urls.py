# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.urls import re_path

from apps.exec.views import *
from apps.exec.transfer import TransferView
from apps.exec.ansible import AnsibleView

urlpatterns = [
    re_path(r'template/$', TemplateView.as_view()),
    re_path(r'do/$', TaskView.as_view()),
    re_path(r'transfer/$', TransferView.as_view()),
    re_path(r'ansible/$', AnsibleView.as_view()),
]
