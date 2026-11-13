@echo off
cd /d "%~dp0"
start "" cmd /c "timeout /t 1 >nul & start http://127.0.0.1:8731/"
python -m http.server 8731 --bind 127.0.0.1
