#!/bin/bash
# Gitee Pages 部署脚本
# 使用方法：在 Git Bash 或 PowerShell 中运行

echo "🚀 开始部署到 Gitee Pages..."

# 检查是否已经初始化 git
if [ ! -d ".git" ]; then
    echo "📦 初始化 Git 仓库..."
    git init
fi

# 添加 Gitee 远程仓库（替换为你的Gitee用户名）
echo "🔗 添加 Gitee 远程仓库..."
echo "⚠️ 请替换 YOUR_GITEE_USERNAME 为你的Gitee用户名"
# git remote add gitee https://gitee.com/YOUR_GITEE_USERNAME/ai-video-batch.git

# 或者如果已经添加过，使用：
# git remote set-url gitee https://gitee.com/YOUR_GITEE_USERNAME/ai-video-batch.git

# 添加所有文件
echo "📝 添加文件..."
git add .

# 提交
echo "💾 提交更改..."
git commit -m "部署到Gitee Pages - $(date '+%Y-%m-%d %H:%M:%S')"

# 推送到 Gitee
echo "🚀 推送到 Gitee..."
git push gitee master

echo "✅ 部署完成！"
echo "📍 下一步："
echo "1. 访问 https://gitee.com/YOUR_GITEE_USERNAME/ai-video-batch"
echo "2. 点击 '服务' → 'Gitee Pages'"
echo "3. 点击 '启动' 开启服务"
echo "4. 绑定域名 lossloop.cn"

