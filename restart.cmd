@echo off
cd /d "%~dp0"
schtasks /End /TN "TeaHousePrototype" >nul 2>&1
schtasks /Run /TN "TeaHousePrototype" >nul 2>&1
start "" http://127.0.0.1:8787
exit /b 0
