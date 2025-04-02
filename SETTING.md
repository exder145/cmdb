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
python manage.py runserver 0.0.0.0:8000 --settings=spug.production
#注：spug_api\spug\production.py文件覆盖了默认的settings.py中的配置，专为生产环境做了以下优化：
#关闭调试模式（DEBUG = False）
#配置数据库路径指向生产环境位置（/home/EXDER/spug_data/db.sqlite3）
#使用Redis而非内存作为缓存和Channel Layers后端
#配置日志系统将日志写入固定文件（/var/log/spug/spug.log）
#自动创建日志目录
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

### 账号密码

admin

spug.cc

## 注意事项以及配置修改

1. 确保 Redis 服务正常运行， _systemctl_ status redis
2. 后端 API 修改为自己主机，需要修改以下文件：

   - spug_web/.env
   - spug_web/.env.production
   - spug_web/src/setupProxy.js

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
cd /mnt/hgfs/spug/spug_api

# 3. 启动服务
python manage.py runserver 0.0.0.0:8000 --settings=spug.production
```

## 访问地址

- 开发环境：http://localhost:3000（如果 3000 端口被占用会自动使用 3001）
- 后端 API：http://localhost:8000
