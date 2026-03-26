# 项目长期记忆

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
