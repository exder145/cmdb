# 模拟ldap模块，用于开发环境
class SCOPE_SUBTREE:
    pass

class RES_SEARCH_ENTRY:
    pass

def initialize(*args, **kwargs):
    return MockLDAPConnection()

class MockLDAPConnection:
    def simple_bind_s(self, *args, **kwargs):
        pass
    
    def search(self, *args, **kwargs):
        return None
    
    def result(self, *args, **kwargs):
        return None, None 