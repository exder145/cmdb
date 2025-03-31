# CMDB 项目开发记录

## 2024-03-10

### 环境搭建

- 安装并配置了 Python 虚拟环境
- 安装了项目依赖包
- 修复了 LDAP 模块导入问题，创建了模拟 LDAP 模块
- 安装并配置了 Redis 服务
- 使用 cnpm 安装了前端依赖

### 数据导入

详细脚本见： F:\实习相关\cmdb 开发\spug\spug_api\scripts
分别用于：导入主机，删除主机，导入详细信息

### 自动化启动脚本

- 创建了 `start_spug.bat` 批处理文件，用于一键启动整个开发环境
- 脚本自动启动 Redis、后端和前端服务
- 解决了中文路径和字符编码问题
- 添加了路径检查和错误处理逻辑

## 2024-03-11

### Dashboard 界面开发记录

- 完成了 Dashboard 界面的开发，主要功能包括：
  - 显示主机总数、在线主机、即将到期的主机数量和月度支出等统计信息。
  - 使用`StatisticsCard`组件展示各项统计数据，提供直观的视觉效果。
  - 实现了操作系统分布和服务器配置分布的图表，使用`Chart.js`库进行图表渲染。
  - 动态加载`Chart.js`库，确保图表在 DOM 元素渲染后正确显示。
  - 添加了错误处理逻辑，确保在图表渲染失败时能够输出错误信息。
  - 目前界面为静态界面！
  -

![image-20250311103518965](https://exder-1333988393.cos.ap-beijing.myqcloud.com/image-20250311103518965.png)

![image-20250311103539701](https://exder-1333988393.cos.ap-beijing.myqcloud.com/image-20250311103539701.png)

### 导出工具开发

- 开发了主机信息导出功能：
  - 支持自定义导出字段
  - 提供数据预览
  - 支持批量选择主机
  - 优化日期显示：修复 Excel 日期格式问题
  - 规范化数据格式：系统图标、IP 地址、CPU/内存单位
  - 提升导出体验：修复可访问性问题，支持中文编码

![image-20250311144431238](https://exder-1333988393.cos.ap-beijing.myqcloud.com/image-20250311144431238.png)

![image-20250311144443795](https://exder-1333988393.cos.ap-beijing.myqcloud.com/image-20250311144443795.png)

下次要启动前后端分离的环境，请按照以下步骤操作：

### 后端启动步骤（在虚拟机 CentOS 上）：

1. 先进入虚拟机并激活虚拟环境：

```bash

# 登录虚拟机后，激活虚拟环境

source ~/spug_venv/bin/activate

```

2. 确保 Redis 服务在运行：

```bash

# 检查Redis状态

sudo systemctl status redis

# 如果没有运行，启动Redis

sudo systemctl start redis

```

3. 启动后端服务：

```bash

# 使用sqlite_wrapper脚本启动Django

cd ~/

python ~/sqlite_wrapper.py runserver 0.0.0.0:8000 --settings=spug.production

```

### 前端启动步骤（在 Windows 上）：

1. 打开命令提示符或 PowerShell：

```cmd

# 进入前端项目目录

cd F:\实习相关\cmdb开发\spug\spug_web

# 启动开发服务器

npm start

```

### 重要提示：

1. 确保虚拟机 IP 没有变化，如果变化了需要更新以下文件：

   - `spug_web/.env`

   - `spug_web/.env.production`

   - `spug_web/src/setupProxy.js`

2. 如果虚拟机 IP 发生变化，可以使用以下命令查看当前 IP：

```bash

# 在虚拟机中执行

ip addr show

```

3. 数据库文件在虚拟机本地目录 `~/spug_data/db.sqlite3`，确保它存在且有正确权限

4. 前端登录后，能够正常访问和操作后端 API，说明前后端分离部署成功

前后端分离部署的优势是可以独立开发和维护前端和后端，并且能够更灵活地进行扩展和优化。

## 项目详细介绍

### 项目概述

本项目是一个基于前后端分离架构的 CMDB（配置管理数据库）系统，用于管理和监控 IT 基础设施资源。系统采用现代化的技术栈，提供了直观的用户界面和强大的后端功能。

### 技术架构

#### 前端框架

- **核心框架**：React 16.13.1
- **UI 组件库**：Ant Design 4.21.5
- **状态管理**：MobX 5.15.6

#### 后端框架

- **Web 框架**：Django 2.2.28
- **数据库**：SQLite3
- **缓存系统**：Redis 5.0.1

### 项目结构

```
spug/
├── spug_web/                # 前端项目目录
│   ├── src/
│   │   ├── components/     # 公共组件
│   │   ├── layout/        # 布局组件
│   │   ├── pages/         # 页面组件
│   │   ├── libs/          # 工具库
│   │   └── routes.js      # 路由配置
│   └── package.json       # 前端依赖配置
│
├── spug_api/               # 后端项目目录
│   ├── apps/              # 应用模块
│   ├── libs/              # 公共库
│   ├── tools/             # 工具脚本
│   ├── scripts/           # 数据脚本
│   └── requirements.txt   # 后端依赖配置
│
└── docs/                  # 项目文档
```
