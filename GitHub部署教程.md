# 🚀 GitHub Pages 部署教程 - 超详细版

## 📋 准备工作

- ✅ 有GitHub账号（你已经有了）
- ✅ 有贞贞工坊API Key

---

## 🎯 方式1：一键自动部署（最简单）

### 步骤1：创建GitHub仓库

1. 打开 https://github.com/new
2. **Repository name**: `ai-video-batch`
3. 选择 **Public**（公开）
4. **不要勾选** README、.gitignore等
5. 点击 **Create repository**

### 步骤2：运行一键部署脚本

1. **双击** `一键部署到GitHub.bat`
2. 当提示输入GitHub仓库地址时，输入：
   ```
   https://github.com/你的用户名/ai-video-batch.git
   ```
3. 按回车，等待推送完成

### 步骤3：启用GitHub Pages

1. 打开你的GitHub仓库页面
2. 点击 **Settings**
3. 左侧菜单找到 **Pages**
4. **Source** 选择 `gh-pages` 分支
5. 点击 **Save**
6. 等待1-2分钟，页面会显示你的网址：
   ```
   https://你的用户名.github.io/ai-video-batch/
   ```

**完成！** 🎉

---

## 🎯 方式2：手动命令行部署

如果一键脚本失败，可以手动执行：

```bash
# 进入项目目录
cd J:\123pan\13998416173\NanoNoPort\ai-video-batch

# 初始化Git（如果还没有）
git init

# 添加远程仓库
git remote add origin https://github.com/你的用户名/ai-video-batch.git

# 添加所有文件
git add .

# 提交
git commit -m "feat: 纯前端版本 - GitHub Pages"

# 推送到GitHub
git push -u origin main
```

然后按照方式1的步骤3启用GitHub Pages。

---

## 📝 使用你的在线网站

### 1. 打开网址

访问：`https://你的用户名.github.io/ai-video-batch/`

### 2. 配置API Key

1. 点击右上角 ⚙️ 设置
2. 输入你的贞贞工坊API Key
3. 点击保存

### 3. 开始创作

1. 点击左侧 **+** 添加创意
2. 填写创意主题（如："赛博朋克城市"）
3. 选择风格、时长、分镜数
4. 点击保存
5. 点击"开始创作"
6. 等待生成完成
7. 下载结果

---

## ❓ 常见问题

### Q1: 推送到GitHub失败？

**A: 可能原因：**
- ❌ GitHub仓库地址错误
- ❌ 没有权限（需要登录GitHub）
- ❌ 网络问题

**解决方案：**
1. 检查仓库地址是否正确
2. 确保已登录GitHub
3. 尝试使用SSH而不是HTTPS

### Q2: Pages显示404？

**A: 等待一下！**
- GitHub Actions需要1-2分钟构建
- 刷新页面
- 检查是否选择了 `gh-pages` 分支

### Q3: API调用失败？

**A: 检查：**
- ✅ API Key是否正确
- ✅ 网络是否正常
- ✅ 贞贞工坊API余额是否充足
- ✅ 浏览器控制台（F12）查看错误

### Q4: CORS错误？

**A: 这个不用担心！**
- GitHub Pages自动启用HTTPS
- 贞贞工坊API支持CORS
- 如果还有问题，联系API提供商

### Q5: 如何更新代码？

**A: 简单！**
1. 修改本地代码
2. 运行：
   ```bash
   git add .
   git commit -m "更新说明"
   git push
   ```
3. GitHub Actions自动重新部署
4. 约1-2分钟后生效

---

## 🔧 高级配置

### 自定义域名

如果你有自己的域名：

1. 在仓库根目录创建 `CNAME` 文件
2. 文件内容写：
   ```
   你的域名.com
   ```
3. 在域名DNS设置中添加CNAME记录指向：
   ```
   你的用户名.github.io
   ```

### 保护API Key

如果担心API Key泄露：

1. 不要在代码中硬编码API Key
2. 只通过浏览器localStorage配置
3. 定期更换API Key

---

## 🎊 恭喜！

你现在拥有：
- ✅ 一个公开的在线网址
- ✅ 免费的HTTPS
- ✅ 自动部署（每次git push自动更新）
- ✅ 无限流量（GitHub Pages）
- ✅ 全球CDN加速

**享受AI创作的乐趣吧！** 🚀

---

## 📞 需要帮助？

- GitHub Pages文档: https://pages.github.com/
- GitHub Actions文档: https://docs.github.com/actions
- 贞贞工坊: https://api.gptbest.com/

