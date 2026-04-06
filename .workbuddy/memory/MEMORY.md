# 项目长期记忆

## 2026-04-04 部署记录
- veo_3_1-fast-components-4K 模型展示名在 video-tools.html 的 3 处 <option> 全部改为 veo_3_1-fast-components-4K，已部署到 lossloop.cn
- Seedance 2.0（T2V/I2V/Ref）提交失败/异常分支的 refund 行为移除，RunningHub 后台生成失败不退款不退胶片，已部署
- 移动端 pollVideoCompletion() maxAttempts 从 120 提升到 150（Seedance 等待窗口约15s）
- **novel-features.js 场景图生成修复**：`refImages` 变量未定义导致 `ReferenceError`，前端报错后台无反应。修复：在 `novelGenerateSceneImage()` 调用前声明并初始化 refImages（调用 `_novelGetCharImageUrls()`），已部署

## 2026-04-05 修复记录
- **index.html 混元3D 修复**：混元3D script 块末尾多了一个 `})();` 导致语法错误，整个 IIFE 不执行，`openHunyuan3DModal` 等函数未注册。已删除多余闭包。
- **无限画板快捷指令折叠**：index.html 快捷指令栏新增 ▲/▼ 折叠按钮，CSS 加 `.collapsed` 样式，batch.js 加 `toggleQuickCommands()` 函数。点击可收起释放画布空间。
- **localStorage QuotaExceededError 修复**：skill-system.js 的 `_saveHistory()` 改进：1)保存前去掉 imageBase64/images 等大数据字段；2)历史上限从100降到50；3)存储满时自动清空而非抛错。
- **AI写真 banana2 500 错误**：属于云雾 API 上游问题（qwen-image-edit-2509 图生图），需进一步排查上游返回的具体错误信息。

## 2026-04-01 Agent 角色专家路由修复
- 问题：用户说"做一个XX网站"，coordinator 误判为视频全流程自动化
- 根因：coordinator 路由规则没有覆盖"网站开发"类任务
- 修复：在 coordinator 添加"本平台不支持的任务"识别规则，礼貌拒绝并建议专业开发工具

## 2026-04-01 小助手 V2 修复

### 小助手图标显示时机
- 问题：欢迎页/登录状态判断不准
- 修复：移除 URL 参数判断，改为只依赖 session 验证 (actuallyLoggedIn)

### 预测功能修复
- 问题1：使用 prompt() 弹出输入框
- 修复：改为在对话输入框内填写主题
- 问题2：预测完成内容不显示
- 修复：强化预测卡片样式 + requestAnimationFrame 强制滚动

### 磨砂玻璃效果增强
- 面板背景：rgba(15, 15, 20, 0.75) + blur(40px) saturate(200%)
- 预测结果卡片：添加青色边框 + 阴影
- 版本：assistant-xj2.css?v=20260401b

## 所有 _novelLLM 调用必须用 stream: true（重要）
- Cloudflare 非流式响应100秒硬限制，超时触发204/524
- **大纲生成**（writing.html）和**章节生成**（novel-engine.js）都必须 `stream: true`
- 只有评分（maxTokens:500）等小任务可以用非流式
- `_novelLLM` 流式返回纯字符串，非流式返回 `{content, billed, tokens}` 对象

## _novelLLM 超时机制（重要）
- **必须使用 AbortController + signal**: `const controller = new AbortController(); setTimeout(() => controller.abort(), timeout); fetch(..., {signal: controller.signal}); clearTimeout(timer);`
- **禁止使用 Promise.race 超时**: `Promise.race([fetchPromise, timeoutPromise])` 不会真正取消 fetch，且会导致 Cloudflare 524
- **fetch 后立即 clearTimeout**: `clearTimeout(timer)` 在 `await fetch()` 之后立刻执行，`res.json()` 无超时限制
- **默认超时 150000（150秒）**, 大纲骨架 120000, 详细大纲 150000
- `_novelLLM` 非流式返回 `{content, billed, tokens}` 对象，调用方需提取 `.content`

## 短剧代码已清理（v8.17+）
- `js/short-drama.js` 已删除
- `writing.html` 中所有 `if (genre === '短剧')` 分支已移除
- 短剧和长篇小说共用完全相同的生成逻辑代码路径（同一个 `_novelLLM`、同一个 `novelGenerateOutline`）
- 但 prompt 内容根据 `genre === '短剧'` 区分（v8.21.0）：
  - 骨架：短剧用"集"、高反转、快节奏、每集字数用 `shortDramaEpisodeLength`
  - 详细大纲：短剧格式"第X集 标题：大纲（含反转/钩子）"
  - 章节生成：短剧用剧本式对话+动作描写，极简对话、大量换行、竖屏风格
  - `_novelParseChapters` 正则匹配 `第\d+[章节集]` 兼容两种格式
  - `novelState.genre = genre` 在大纲生成时保存，供章节生成判断
- 大纲生成全部用 `stream: true` 避免 Cloudflare 524

## 后端 API 超时
- `api/writer-llm.js`: 后端超时 80秒（AbortSignal.timeout(80000)），但这是后端限制，前端不应因此缩短超时
- qwen3.5-plus 走云雾通道（多个端点串行 fallback）

## 2026-03-31 内容审核员重写
- 改为**两步审核**：意图识别 → 动态规则应用
- 新增"意图提示"参数，用户可补充审核目的
- 平台选择改为"自动识别"为默认
- 输出格式重构：🟢安全/🟡注意/🟠警告/🔴高危 + 快速修改版
- **方案C混合版**：新增"使用最新规则"复选框
  - 默认：用 LLM 知识库快速审核（10胶片）
  - 勾选：调用 `/api/yunwu.js` 的 `enableSearch: true` 联网搜索最新规则（15胶片）
  - 搜索结果拼进审核 prompt，实现真正实时规则

## 2026-03-31 novel-engine.js 修复
- `novelEvaluateChapterWithModel()`: `ch.content.substring` 报错
- 根因：`ch.content` 可能是对象（非流式 `_novelLLM` 返回 `{content, billed, tokens}`）
- 修复：`const chContent = typeof ch?.content === 'string' ? ch.content : '';`

## 2026-03-31 新增：rollroll-cli 项目
- **位置**: `rollroll-cli/`
- **功能**: 完整复制网站所有功能的命令行工具（视频/图片/音乐/TTS/技能系统/群体预测/短剧创作/内容审核）
- **技术栈**: Node.js + Commander.js + chalk + ora
- **命令**: `video`, `image`, `script`, `music`, `tts`, `skill`, `predict`, `drama`, `auditor`
- **视频模型**: 41个（grok-3/veo3.1/vidu/hailuo/kling/wan2.6/ltx-video/runninghub）
- **启动**: `cd rollroll-cli && npm install && npm link && rollroll --help`
- **配置文件**: `~/.rollroll/config.json`（cookie/token 存储）
- **OpenCLI 适配器**: `opencli-adapter.yaml`

## 项目部署
- 命令: `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; vercel --prod --yes`
- 无构建步骤，纯 HTML/JS/CSS
- 版本缓存: JS/CSS 引用带 `?v=X.Y.Z`

## 2026-03-22 技术问题修复记录

### 问题1：writing.html 被覆盖为旧版
- 本地 writing.html 被错误覆盖为 _clean_deploy 旧版（2612行），丢失32次git提交功能
- 通过 `git checkout HEAD -- writing.html` 恢复

### 问题2：short-drama.js 大纲解析正则不支持全角冒号
- 修改正则 `[：:\s]*` → `[：:：]\s*`

### 问题3：小说评分批量修正按钮无效
- 根因: `novelEvaluateAll()` 评估后没存到 `ch._evaluation`
- 修复: 添加 `novelState.chapters[i]._evaluation = result`

### 问题4：_novelLLM 超时524（v8.17~v8.19 彻底修复）
- 见上方 "_novelLLM 超时机制" 章节

## 2026-03-30（续）

### miroprediction.html 重新设计（frontend-design skill）
- 风格：深空神经控制台（Deep Space Neural Console）
- 配色：深空蓝黑底 + 青蓝生物荧光 + 紫罗兰辅助 + 珊瑚红点缀
- 字体：Orbitron（科幻标题）+ Space Grotesk（正文）+ JetBrains Mono（数据）
- 动效：智能体呼吸状态灯（心跳动画）+ 玻璃态卡片 + 脉冲边框 + 星空气泡背景
- 新增：置信度仪表条、预测结果渐入动画、智能体分析分栏展示
- mirofish-core.js 的 updateAgentStatus() 增强：同步更新状态dot和CSS类

### skill-system.js 分类标签修复
- 添加 `tool: '工具'` 到 categoryLabels，使 miro_prediction 技能正常显示

## 2026-03-30 续：miro_prediction 技能重写

### 问题背景
- 原有 `miro_prediction` 技能只是跳转到 PC 端 `miroprediction.html`，手机上体验不好
- 预测功能是前端模拟的，没有真正调用 AI 模型
- 没有模型选择和扣费功能

### 解决方案
**1. skill-presets.js 重写 miro_prediction 技能：**
- 添加 `TEXT_MODEL_OPTIONS` 文本模型选项（auto/roll/qwen3.5-plus/gemini-3.1-pro-preview）
- 5 个智能体（分析师、怀疑者、乐观派、现实派、战略家）并行调用 `callWriterLLM()` 真正生成分析
- 每个智能体使用不同 prompt 和角色设定
- 综合所有分析生成最终预测结论（JSON格式）
- 添加 `result` 字段用于移动端结果展示
- estimateCost 返回 8 胶片

**2. mobile.html 修改：**
- 预测分类入口从跳转改为调用 `mobileSkillOpen('miro_prediction')` 内联执行
- quickAction('prediction') 改为打开技能面板并定位到预测技能
- 不再依赖 PC 端页面

### 关键代码
- `js/skill-presets.js`: 添加 TEXT_MODEL_OPTIONS，重写 miro_prediction execute 函数
- `mobile.html`: 修改 prediction 分类处理和 quickAction 函数

## 2026-04-01 小助手图标显示时机修复
- 问题：欢迎页期间小助手图标错误显示
- 修复1：欢迎页隐藏CSS添加 `.xj2-container` 隐藏
- 修复2：`initAssistant()` 添加 `isWelcomePage` 检查，只有已登录且不在欢迎页时才显示

## 2026-03-31 小卷助手 V2 重构

### 设计方向：霓虹灵魂 (Neon Soul)
- 深色玻璃态 + 柔和霓虹光效
- 3D 头像 + 悬浮呼吸动画
- 预测功能直接集成在面板内
- 流畅的状态过渡动画

### 合并内容
1. **AIRI 浮动助手** - 原有对话功能
2. **MiroFish 群体智能预测** - 预测功能直接集成

### 新增文件
- `css/assistant-xj2.css` - 霓虹灵魂风格 CSS
- `js/assistant-xj2.js` - 统一助手 JavaScript

### 关键特性
- **预测卡片**：面板顶部显示 4 个预测入口（加密货币/股票/天气/趋势）
- **实时进度**：显示 5 个智能体分析状态
- **预测结果**：情绪/置信度/建议，格式化展示
- **对话功能**：普通聊天模式（预留）

### 移动端适配
- 响应式设计，适配 420px 以下屏幕
- 面板宽度自适应
- 进度条动画

### 关键代码
- `mobile.html`: 替换旧助手 HTML，引用新 CSS/JS
- `js/assistant-xj2.js`: 完整实现预测和对话逻辑

## 2026-03-31 短剧创作大师 + 审核员技能

### 新增技能

**1. 短剧创作大师 (short_drama_master)**
- 基于 drama-creator 专业方法论
- 核心功能：大纲设计、单集剧本、打脸场景、悬念钩子
- 参数：任务类型（大纲/剧本/打脸/钩子）、题材类型、创作素材
- 消耗：8 胶片

**2. 内容审核员 (content_auditor)**
- 熟知各大平台规则（抖音/快手/小红书/视频号/B站）
- 核心功能：合规性检查、敏感词检测、风险评估、修改建议
- 参数：内容类型、目标平台、待审核内容
- 消耗：8 胶片

### writing.html 嵌入"情绪弹簧理论"
- systemRole 更新为"金牌剧作官"，强调压弹簧/放弹簧方法论
- 骨架生成 prompt 增加"压弹簧/放弹簧"标注要求
- 详细大纲 prompt 要求每集标注弹簧类型和情绪释放点
- batch prompt 要求严格遵循"压弹簧/放弹簧"节奏

### 文件变更
- `js/skill-presets.js`: 添加 short_drama_master 和 content_auditor 技能
- `writing.html`: 嵌入情绪弹簧理论到短剧生成 prompt



