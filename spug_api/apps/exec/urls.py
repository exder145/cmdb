# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.conf.urls import url

from apps.exec.views import *
from apps.exec.transfer import TransferView
from apps.exec.ansible import AnsibleView

urlpatterns = [
    url(r'template/$', TemplateView.as_view()),
    url(r'do/$', TaskView.as_view()),
    url(r'transfer/$', TransferView.as_view()),
    url(r'ansible/$', AnsibleView.as_view()),
]
