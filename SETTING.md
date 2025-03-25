# SPUG 部署文档

## 项目简介

SPUG 是一个基于 Django 和 React 的前后端分离项目，包含 Web 前端和 API 后端两个主要部分。

## 系统要求

- Python 3.8+
- Node.js 14+
- Redis 5.0+
- Git

## 后端部署步骤

### 1. 环境准备

```bash
# 创建并激活虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows

# 安装依赖
cd spug_api
pip install -r requirements.txt
```

### 2. 数据库配置

- 项目使用 SQLite 作为默认数据库，数据库文件位于 `spug_api/db.sqlite3`
- 首次运行会自动创建数据库表

### 3. 启动后端服务

```bash
cd spug_api
python manage.py runserver 0.0.0.0:8000
```

## 前端部署步骤

### 1. 环境准备

```bash
# 安装Node.js依赖
cd spug_web
npm install
```

### 2. 开发环境运行

```bash
npm start
```

### 3. 生产环境构建

```bash
npm run build
```

### 4. 配置说明

- 开发环境配置文件：`.env`
- 生产环境配置文件：`.env.production`
- 主要配置项：
  - REACT_APP_API_BASE_URL：后端 API 地址（默认为http://192.168.75.140:8000）
  - NODE_OPTIONS：需要设置为--openssl-legacy-provider
  - FAST_REFRESH：设置为 false 以避免热重载问题
  - DISABLE_ESLINT_PLUGIN：设置为 true 以禁用 ESLint
  - SKIP_PREFLIGHT_CHECK：设置为 true 以跳过依赖检查

## 完整部署流程

1. 克隆项目

```bash
git clone [项目地址]
cd spug
```

2. 启动 Redis 服务

```bash
# 确保Redis服务已启动
redis-server
```

3. 启动后端服务

```bash
cd spug_api
python -m venv venv
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows
pip install -r requirements.txt
python manage.py runserver 0.0.0.0:8000
```

4. 启动前端服务

```bash
cd spug_web
npm install
npm start  # 开发环境
# 或
npm run build  # 生产环境
```

## 访问地址

- 开发环境：http://localhost:3001（如果 3000 端口被占用会自动使用 3001）
- 后端 API：http://localhost:8000

## 注意事项

1. 确保 Redis 服务正常运行
2. 前端开发环境需要设置 NODE_OPTIONS=--openssl-legacy-provider
3. 生产环境部署时建议使用 nginx 作为反向代理
4. 首次运行需要执行数据库迁移（如果需要）
5. 如果后端 API 地址不是默认的 192.168.75.140:8000，需要修改以下文件：
   - spug_web/.env
   - spug_web/.env.production
   - spug_web/src/setupProxy.js

## 常见问题

1. 如果遇到 Node.js 版本兼容性问题，建议使用 Node.js 14.x 版本
2. 如果遇到 Python 包安装问题，可以尝试使用国内镜像源
3. 确保所有必要的端口（3001, 8000, 6379）未被占用
4. 如果前端启动时遇到端口占用问题，React 会自动使用下一个可用端口（3001）

## 技术支持

如有问题，请联系项目维护人员。
