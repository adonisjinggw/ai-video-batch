@echo off
chcp 65001 >nul
echo ========================================
echo   艾莉丝插件修复工具 v1.0.3 (诊断版)
echo ========================================
echo.

set "TARGET=C:\Users\Administrator\.trae-cn\extensions\undefined_publisher.alice-plugin-1.0.0"
set "SOURCE=J:\123pan\13998416173\NanoNoPort\ai-video-batch\alice-plugin"

if not exist "%TARGET%" (
    echo [错误] 找不到插件目录: %TARGET%
    pause
    exit /b 1
)

echo [1/3] 清理旧文件...
del /q "%TARGET%\package.json" 2>nul
rmdir /s /q "%TARGET%\src" 2>nul

echo [2/3] 复制文件...
copy /y "%SOURCE%\package.json" "%TARGET%\package.json" >nul
xcopy /E /Y /I "%SOURCE%\src" "%TARGET%\src" >nul

echo [3/3] 验证...
if exist "%TARGET%\package.json" (
    if exist "%TARGET%\src\platforms\vscode-extension.js" (
        echo.
        echo ✅ 文件部署成功！
        echo.
        echo 当前版本: 最简诊断版（仅注册命令，无复杂逻辑）
        echo.
        echo 请立即:
        echo   1. 关闭 Trae CN 窗口
        echo   2. 重新打开 Trae CN
        echo   3. 按 Ctrl+Shift+P 输入 Alice
        echo.
        echo 如果还是报错 = Trae CN 插件系统问题
        echo 如果弹出提示框 = 插件正常，再恢复完整功能
        echo.
    ) else (
        echo ❌ vscode-extension.js 缺失
    )
) else (
    echo ❌ package.json 缺失
)

pause
