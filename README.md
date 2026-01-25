
---
## 2025-12-11 会话总结（累积）

- **主要目的**：按选择 C，关闭 `rollroll.art` 被强制跳转到 `lossloop.cn` 的逻辑，确保多域名可正常访问。
- **完成任务**：
  - 移除前端域名强制跳转：`ai-video-batch/js/supabase-config.js`
  - 放行 `rollroll.art` / `www.rollroll.art` 的 CORS：`ai-video-batch/api/proxy.js`
  - 取消 Vercel Host 重定向（不再强制跳域）：`ai-video-batch/vercel.json`
- **关键决策/方案**：不做任何域名统一跳转（C），避免误伤 `rollroll.art`；同时补齐后端代理的 CORS 白名单以免接口跨域失败。
- **技术栈**：Vercel + 前端原生 JS + Serverless Functions
- **修改文件**：`js/supabase-config.js`、`api/proxy.js`、`vercel.json`、`README.md`

---
## 2025-12-12 会话总结（累积）

- **主要目的**：修复批量文生视频流程里 `Sora2` 500 与“0 片段合并崩溃”的关键断点，让流程可继续/可重试。
- **完成任务**：
  - 修复 `api/sora2` 备用贞贞分支的基地址变量缺失（`API_BASE_URL` 未定义）导致的 500。
  - `mergeVideos` 在 0 片段时不再抛异常，改为记录错误并保持 UI 可重试。
- **关键决策/方案**：优先修“确定性代码错误”，并把合并阶段从“硬崩溃”改为“软失败可恢复”。
- **技术栈**：Vercel Serverless + 前端原生 JS
- **修改文件**：`api/sora2.js`、`js/batch.js`、`README.md`

---
## 2025-12-12 会话总结（累积）- 视频流程稳定性/可重试（C=A+B）

- **主要目的**：按选择 C（A+B），让视频流程“单段失败不阻断”，并把失败原因/重试入口直接做进 UI。
- **完成任务**：
  - 分镜生成加入自动重试（指数退避），不可重试错误（内容审核/权限）会立即失败提示：`js/batch.js`
  - 每个“视频片段”卡片直接展示失败原因与尝试次数，并提供单段重试按钮
  - 新增“一键重试失败片段”“重试合成”按钮，避免用户只能整任务重跑
- **关键决策/方案**：抽出单分镜生成器 `generateOneClipWithRetry` 统一逻辑，避免并发+失败处理散落导致体验和一致性问题。
- **技术栈**：原生 JS + Vercel
- **修改文件**：`js/batch.js`、`README.md`

---
## 2025-12-12 会话总结（累积）- 流程窗显示不全修复

- **主要目的**：修复 Sora2 文生视频/图生视频“工作窗显示不全、列被裁切”的问题，确保流程列完整可见。
- **完成任务**：调整横向流程卡默认尺寸为自适应大尺寸，并适度缩窄列宽以提升同屏可见列数：`css/style.css`
- **关键决策/方案**：原默认 1100px 宽不足以容纳多列流程（图生视频还多一列），改为 `min(92vw, 1900px)` 并保留 resize。
- **技术栈**：CSS
- **修改文件**：`css/style.css`、`README.md`

---
## 2025-12-12 会话总结（累积）- 方案3：自动缩放适配 + 多窗互斥排斥

- **主要目的**：实现“横向不滚动也能看到所有列”，并保证多任务流程窗在无限画布中互斥不重叠。
- **完成任务**：
  - 任务窗点击后自动缩放+居中（fit-to-viewport），并在窗口尺寸变化/卡片 resize 后自动重新适配：`js/batch.js`
  - 拖拽/缩放结束后执行互斥排斥（push-on-drop），推开重叠窗口并持久化坐标：`js/batch.js`
  - 流程列布局改为等分 Grid，禁止 `.flow-container` 横向滚动（列可压缩）：`css/style.css`
  - 移除 Edge 下对任务窗写死 1100×550 的强制尺寸，避免与上述逻辑冲突：`js/batch.js`
- **技术栈**：原生 JS + CSS Grid + Vercel
- **修改文件**：`js/batch.js`、`css/style.css`、`README.md`、`openspec/changes/update-task-window-fit-and-repel/*`

# AI视频批量创作工具

## 🎯 项目简介

基于**贞贞工坊 Grok-4 + Sora2** 的AI视频批量创作工具。

输入创意主题，一键生成：
- 📝 AI剧本
- 🎨 配图提示词
- 🎬 视频分镜提示词（Sora2专用）

## ✨ 特性

- ⚡ **完全Serverless** - 部署到Vercel，免费使用
- 🚀 **批量生成** - 支持多个创意同时处理
- 📤 **剧本上传** - 支持TXT/JSON格式剧本
- ⚙️ **自定义参数** - 时长（5-300秒）、分镜数（1-20个）
- 💾 **一键下载** - 生成结果打包下载
- 🎨 **多风格支持** - 卡通、真人、科幻、动漫等

## 🚀 快速开始

### 方式1：GitHub Pages部署（推荐，完全免费）

**超级简单，3分钟搞定！**

1. **双击运行** `一键部署到GitHub.bat`
2. 按照提示输入你的GitHub仓库地址
3. 打开GitHub仓库 → Settings → Pages
4. 选择 `gh-pages` 分支
5. 保存，等待1分钟

**你会得到一个网址：**
```
https://你的用户名.github.io/ai-video-batch/
```

**⚠️ 使用GitHub Pages需要安装浏览器扩展（解决CORS问题）：**
- Chrome: 安装 [Allow CORS](https://chromewebstore.google.com/detail/allow-cors-access-control/lhobafahddgcelffkeicbaginigeejlf)
- Edge: 安装 [CORS Unblock](https://microsoftedge.microsoft.com/addons/detail/cors-unblock/hkjklmhkbkdhlgnnfbbcihcajofmjgbh)

### 方式2：Vercel部署（无需浏览器扩展，真正在线版）

**100%无需用户安装任何扩展！**

1. Fork此仓库到你的GitHub
2. 登录 [Vercel](https://vercel.com)
3. 点击"New Project"
4. 选择你的仓库
5. 点击"Deploy"
6. 完成！获得你的在线地址：`https://你的项目.vercel.app`

**Vercel版本优势：**
- ✅ 客户无需安装任何扩展
- ✅ 内置API代理，完美解决CORS
- ✅ 自动HTTPS
- ✅ 全球CDN加速

### 方式3：本地测试

直接双击 `index.html` 即可（需要浏览器扩展）

## 📋 使用说明

1. **配置API Key**
   - 点击右上角⚙️设置
   - 输入贞贞工坊API Key
   - 点击保存

2. **添加创意**
   - 点击左侧 + 按钮
   - 输入创意主题（如："未来科技城市"）
   - 选择风格、时长、分镜数
   - 点击保存

3. **开始生成**
   - 点击"开始创作"按钮
   - 等待AI生成（约30秒-2分钟）
   - 查看结果

4. **下载结果**
   - 点击"📥 下载"按钮
   - 获取JSON格式的完整结果

## 🛠️ 技术栈

- **纯前端**: HTML + CSS + Vanilla JavaScript
- **无需后端**: 直接调用API
- **AI模型**: 
  - 贞贞工坊 Grok-4（文本生成）
  - Sora2（视频生成）
- **部署**: GitHub Pages（免费）

## 📁 项目结构

```
ai-video-batch/
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions自动部署
├── css/
│   └── style.css             # 样式
├── js/
│   └── batch.js              # 前端逻辑（含API调用）
├── index.html                # 主页面
├── package.json              # 项目配置
├── README.md                 # 项目说明
├── 一键部署到GitHub.bat      # 自动部署脚本
└── 快速部署指南.md           # 部署教程
```

## 🎨 功能演示

### 1. 欢迎页
- 功能介绍
- 配置提示
- 快速开始

### 2. 创意管理
- 添加/编辑/删除创意
- 批量操作
- 状态显示

### 3. 生成进度
- 实时进度
- 成功/失败状态
- 错误提示

### 4. 结果展示
- 剧本预览
- 提示词查看
- 一键下载

## 💡 使用场景

- 🎬 短视频创作
- 📺 广告脚本生成
- 🎭 故事板制作
- 🎨 创意头脑风暴
- 📝 内容批量生产

## ⚙️ 配置说明

### API Key

在浏览器的 `localStorage` 中存储：
- Key: `zhenzhen_api_key`
- Value: 你的贞贞工坊API Key

**获取API Key：** https://api.gptbest.com/

## 🔒 安全说明

- ✅ API Key存储在浏览器本地（localStorage）
- ✅ HTTPS加密通信（GitHub Pages自动提供）
- ✅ 纯前端，不存储任何数据到服务器
- ✅ 仅你自己可见你的API Key

## 📝 更新日志

### V7.9.14 (2025-11-24) 🎨
- ✨ **角色库UI现代化** - 彻底替换原生prompt()，采用精美模态框
- 🎭 **三种创建方式** - AI生成/本地上传/网络链接，可视化选择
- 🔧 **API参数确认** - 确保aspect_ratio参数正确使用（非size）
- 💾 **缓存破坏升级** - 版本号更新到v7.9.14&t=20251124006

### V7.9.13 (2025-11-24) 🎨
- ✨ **名言系统升级** - 从6条扩展到36条（名言、术语、灵感、历史4大类）
- 🎬 **黑白到彩色动画** - 12秒演进动画，致敬电影从1895到2024的发展史
- 🎭 **分类标签系统** - 每条名言带图标（🎬📚💡🌟）
- 🌈 **视觉升级** - 胶片图标从灰色到金色，RGB彩色点呼吸效果

### V7.9.12 (2025-11-24) 🔧
- ✅ **修复Banana2图像生成** - 正确使用 `nano-banana-2-4k` 模型
- ✅ **API错误处理增强** - 更清晰的401、500错误提示
- ✅ **模型名称标准化** - 文本用 `gemini-3-pro-preview-thinking-*`，图像用 `nano-banana-2-4k`
- ✅ **专家诊断** - GPT-5.1通过Zen MCP提供根本原因分析

### V7.9.11 (2025-11-24)
- ✅ **6步工作流优化** - 故事→角色→分镜→Sora2提示词→视频→合成
- ✅ **Sora2提示词规则** - 严格使用 `@` 标签格式
- ✅ **角色生成修复** - 默认启用角色生成
- ✅ **自动模式优化** - 步骤间500ms延迟，防止数据丢失
- ✅ **手动模式修复** - 正确的暂停/恢复逻辑

### v2.0.0 (2025-01-16)
- ✅ **纯前端版本** - 无需后端服务器
- ✅ GitHub Pages一键部署
- ✅ 支持贞贞工坊Grok-4 + Sora2
- ✅ 批量生成功能
- ✅ 剧本上传功能（TXT/JSON）
- ✅ 完全免费部署

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 License

MIT

---

**🎉 享受AI创作的乐趣！**
