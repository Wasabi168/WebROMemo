@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title WebROMemo
set "PORT=8731"
set "URL=http://127.0.0.1:%PORT%/"

echo [WebROMemo] 檢查連接埠 %PORT% ...

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":%PORT% " ^| findstr /I /C:"LISTENING"') do (
  if %%P LEQ 4 (
    echo [WebROMemo] 連接埠 %PORT% 被系統行程 PID %%P 占用，無法關閉。
    pause
    exit /b 1
  )
  echo [WebROMemo] 連接埠 %PORT% 被 PID %%P 占用，先關閉再開。
  taskkill /F /PID %%P
)

set /a WAIT=0
:waitfree
netstat -ano | findstr /C:":%PORT% " | findstr /I /C:"LISTENING" >nul
if errorlevel 1 goto portfree
set /a WAIT+=1
if %WAIT% GEQ 15 goto portstuck
ping -n 2 127.0.0.1 >nul
goto waitfree

:portstuck
echo [WebROMemo] 無法釋放連接埠 %PORT%。請手動關閉占用程式後再試。
pause
exit /b 1

:portfree
if not exist "%~dp0serve.py" (
  echo [WebROMemo] 找不到 serve.py
  pause
  exit /b 1
)

echo [WebROMemo] 啟動 %URL%
start "open-webromemo" powershell -NoProfile -WindowStyle Hidden -Command "$u='%URL%'; foreach ($i in 1..40) { try { $req = [System.Net.HttpWebRequest]::Create($u); $req.Proxy = [System.Net.GlobalProxySelection]::GetEmptyWebProxy(); $req.Timeout = 2000; $resp = $req.GetResponse(); $code = [int]$resp.StatusCode; $resp.Close(); if ($code -ge 200) { Start-Process $u; exit 0 } } catch { Start-Sleep -Milliseconds 250 } }"

python "%~dp0serve.py" %PORT%
if errorlevel 1 (
  echo [WebROMemo] 伺服器啟動失敗。
  pause
  exit /b 1
)
