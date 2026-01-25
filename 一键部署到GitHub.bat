@echo off
chcp 65001 >nul
echo.
echo ========================================
echo    AI视频批量创作工具 - GitHub部署
echo ========================================
echo.

cd /d "%~dp0"

echo 📋 步骤1：检查Git状态...
git status >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：当前不是Git仓库
    echo.
    echo 💡 请先在GitHub创建仓库，然后运行：
    echo    git init
    echo    git remote add origin https://github.com/你的用户名/ai-video-batch.git
    echo.
    pause
    exit /b 1
)

echo ✅ Git仓库检查通过
echo.

echo 📋 步骤2：添加所有文件...
git add .
if errorlevel 1 (
    echo ❌ 添加文件失败
    pause
    exit /b 1
)
echo ✅ 文件添加成功
echo.

echo 📋 步骤3：提交更改...
git commit -m "feat: 纯前端版本 - GitHub Pages部署"
if errorlevel 1 (
    echo ⚠️ 没有新的更改需要提交
)
echo.

echo 📋 步骤4：推送到GitHub...
echo.
echo 💡 如果是第一次推送，请输入你的GitHub仓库地址：
echo    例如：https://github.com/你的用户名/ai-video-batch.git
echo.
set /p REPO_URL="请输入GitHub仓库地址（如果已配置，直接按回车）: "

if not "%REPO_URL%"=="" (
    echo 🔗 配置远程仓库...
    git remote remove origin 2>nul
    git remote add origin %REPO_URL%
)

echo 🚀 推送到GitHub...
git push -u origin main
if errorlevel 1 (
    echo ⚠️ 推送到main分支失败，尝试master分支...
    git push -u origin master
    if errorlevel 1 (
        echo ❌ 推送失败
        echo.
        echo 💡 可能的原因：
        echo    1. 仓库地址不正确
        echo    2. 没有权限
        echo    3. 网络问题
        echo.
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo    ✅ 部署成功！
echo ========================================
echo.
echo 📌 下一步：启用GitHub Pages
echo.
echo 1. 打开你的GitHub仓库
echo 2. 点击 Settings
echo 3. 左侧菜单找到 Pages
echo 4. Source 选择 "gh-pages" 分支
echo 5. 点击 Save
echo.
echo 🌐 你的网址将是：
echo    https://你的用户名.github.io/ai-video-batch/
echo.
echo 💡 GitHub Actions会自动构建，约1-2分钟后生效
echo.
pause

