# SPUG 部署文档

## 系统要求

- Python 3.8+
- Node.js 14+
- Redis 5.0+
- Git
- sshpass

## 后端部署步骤

### 1. 环境准备

```bash
# 安装系统依赖
# CentOS/RHEL
sudo yum install sshpass
# Ubuntu/Debian
sudo apt install sshpass

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

#### 数据迁移说明

如果您已经有正在运行的环境，想要在新环境中保留数据（包括资源费用、导航配置、系统设置等）

1. 复制整个数据目录：

```bash
# 在原环境中，进入spug_api目录
cd spug_api

# 打包整个数据目录（包含数据库和上传的文件）
tar -czf spug_data.tar.gz db.sqlite3 storage/

# 将spug_data.tar.gz复制到新环境的spug_api目录下
```

2. 在新环境中恢复数据：

```bash
# 进入新环境的spug_api目录
cd spug_api

# 解压数据文件（会自动覆盖db.sqlite3和storage目录）
tar -xzf spug_data.tar.gz
```

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

## 再次启动流程

### 前端启动

```bash
cd spug_web
npm start
```

### 后端启动

```bash
# 1. 激活虚拟环境
source ~/spug_venv/bin/activate

# 2. 进入项目目录
cd ~/shared/spug/spug_api

# 3. 启动服务
python manage.py runserver 0.0.0.0:8000 --settings=spug.production
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
