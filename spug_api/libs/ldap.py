# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.

# 模拟LDAP模块，用于开发环境
class LDAP:
    def __init__(self, server, bind_dn, password):
        self.server = server
        self.bind_dn = bind_dn
        self.password = password
        self.is_active = False
    
    def valid_user(self, username, password):
        # 开发环境下，LDAP认证始终返回False
        return False
