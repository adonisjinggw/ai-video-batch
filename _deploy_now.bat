@echo off
cd /d j:\123pan\13998416173\NanoNoPort\ai-video-batch
set NODE_TLS_REJECT_UNAUTHORIZED=0

REM Try to find node/npm in common locations
if exist "C:\Program Files\nodejs\npm.cmd" (
    "C:\Program Files\nodejs\npm.cmd" run deploy
    goto :end
)

if exist "C:\Program Files (x86)\nodejs\npm.cmd" (
    "C:\Program Files (x86)\nodejs\npm.cmd" run deploy
    goto :end
)

if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" (
    "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" run deploy
    goto :end
)

if exist "%APPDATA%\npm\npm.cmd" (
    "%APPDATA%\npm\npm.cmd" run deploy
    goto :end
)

REM Try npx directly
if exist "C:\Program Files\nodejs\npx.cmd" (
    "C:\Program Files\nodejs\npx.cmd" vercel --prod
    goto :end
)

if exist "%APPDATA%\npm\npx.cmd" (
    "%APPDATA%\npm\npx.cmd" vercel --prod
    goto :end
)

echo Node/npm not found in common locations
echo Please run 'vercel --prod' manually

:end
pause
