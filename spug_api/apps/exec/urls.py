# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.urls import path, re_path

from apps.exec.views import TaskView, TemplateView
from apps.exec.transfer import TransferView
from apps.exec.ansible import AnsibleView, AnsibleResultView

urlpatterns = [
    path('do/', TaskView.as_view()),
    path('template/', TemplateView.as_view()),
    re_path(r'^template/(?P<t_id>\d+)/$', TemplateView.as_view()),
    path('transfer/', TransferView.as_view()),
    re_path(r'^transfer/(?P<t_id>\d+)/$', TransferView.as_view()),
    re_path(r'ansible/$', AnsibleView.as_view()),
    re_path(r'^ansible/result/(?P<token>[a-zA-Z0-9]+)/$', AnsibleResultView.as_view()),
]
