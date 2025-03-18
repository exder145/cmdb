@echo off
REM 设置代码页为UTF-8
chcp 65001 > nul
echo ===== Spug服务启动脚本 =====

REM 设置路径
set SPUG_PATH=%~dp0
set REDIS_PATH=D:\Redis-x64-5.0.14.1

echo 启动Redis服务...
start "" "%REDIS_PATH%\redis-server.exe"
timeout /t 2 > nul

echo 启动后端服务...
start powershell -NoExit -Command "cd %SPUG_PATH%\spug_api; .\venv\Scripts\activate; python manage.py runserver"

echo 启动前端服务...
start powershell -NoExit -Command "cd %SPUG_PATH%\spug_web; $env:NODE_OPTIONS='--openssl-legacy-provider --max-old-space-size=4096'; npm run start"

echo ===== Spug服务启动中 =====
echo 后端服务地址: http://localhost:8000
echo 前端服务地址: http://localhost:3000
echo.
echo 如果前端启动失败，请尝试手动执行以下命令：
echo ---前端---
echo cd %SPUG_PATH%\spug_web
echo $env:NODE_OPTIONS='--openssl-legacy-provider --max-old-space-size=4096'
echo npm run start
echo.
echo ---后端---
echo cd %SPUG_PATH%\spug_api
echo .\venv\Scripts\activate
echo python manage.py runserver