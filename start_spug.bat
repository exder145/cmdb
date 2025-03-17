@echo off
REM 设置代码页为UTF-8
chcp 65001 > nul
echo ===== Spug服务启动脚本 =====

REM 获取当前批处理文件所在目录
set CURRENT_DIR=%~dp0
echo 当前目录: %CURRENT_DIR%

REM 设置正确的项目路径 - 请根据实际情况修改
set SPUG_PATH=%CURRENT_DIR%
set REDIS_PATH=D:\Redis-x64-5.0.14.1

echo 使用的Spug路径: %SPUG_PATH%
echo 使用的Redis路径: %REDIS_PATH%

REM 检查路径是否存在
if not exist "%SPUG_PATH%\spug_api" (
    echo 错误: Spug项目路径不存在: %SPUG_PATH%\spug_api
    echo 请确认批处理文件是否放在Spug项目根目录
    pause
    exit /b 1
)

if not exist "%REDIS_PATH%\redis-server.exe" (
    echo 错误: Redis可执行文件不存在: %REDIS_PATH%\redis-server.exe
    echo 请确认路径是否正确，并修改批处理文件中的REDIS_PATH变量
    pause
    exit /b 1
)

REM 检查Redis是否已在运行
echo 检查Redis服务状态...
netstat -an | find ":6379" > nul
if %errorlevel% == 0 (
    echo Redis服务已在运行，跳过启动步骤
) else (
    echo 启动Redis服务...
    start "" "%REDIS_PATH%\redis-server.exe"
    timeout /t 2 > nul
)

echo 启动后端服务...
start cmd /k "chcp 65001 > nul && cd /d %SPUG_PATH%\spug_api && venv\Scripts\activate && python manage.py runserver"

echo 启动前端服务...
start cmd /k "chcp 65001 > nul && cd /d %SPUG_PATH%\spug_web && set NODE_OPTIONS=--openssl-legacy-provider && npm start"

echo ===== Spug服务启动中，请稍候... =====
echo 后端服务地址: http://localhost:8000
echo 前端服务地址: http://localhost:3000
echo.
echo 提示: 关闭所有命令窗口将停止所有服务
echo ===== 启动完成 =====