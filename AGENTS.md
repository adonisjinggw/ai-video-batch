# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview
RollRoll (ai-video-batch) — Serverless AI创作平台，Vercel + vanilla JS + Supabase。用户输入创意主题，批量生成AI视频/图片/音乐/配音/文案。

**线上**: `https://lossloop.cn`, `https://www.rollroll.art`

## Build & Deploy

```powershell
# 本地开发
npm run dev              # vercel dev

# 部署（PowerShell）
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; vercel --prod

# 或使用 npm scripts
npm run deploy           # vercel --prod
npm run deploy:stable    # vercel deploy --prod --yes
npm run predeploy        # scripts/sync-version.js 同步版本号
```

**无构建步骤** — 纯 HTML/CSS/JS 直接由 Vercel 托管。
**语法检查**: `node -c "文件路径"` （无测试框架）
**PowerShell 注意**: 不支持 `&&`，用 `;` 分隔命令。
**缓存破坏**: JS/CSS 引用带版本参数如 `?v=2.2&t=20260209b`，更新文件后需同步更新引用处的版本参数。

## Project Rules

### 代码修改原则
- **最小化修改**，局部修正，保持现有结构，验证后再改
- 不乱改用户配置好的模型/格式字符，不自己造轮子
- 不能大量删除或改动代码，除非用户明确指示
- 出错后不能用错误的备份文件覆盖替换，等待用户命令
- 全部修好再部署，不要每次没修好就部署
- **禁止使用 PowerShell 命令编辑/写入代码文件**，只能使用 IDE 的 edit/multi_edit/write_to_file 工具修改文件。PowerShell 仅用于运行检查命令（如 `node -c`、`vercel` 部署等）

### Supabase 集成规则
- 使用 `var _sbClient` 而不是 `let supabase`（避免和 CDN 全局变量冲突）
- 所有 AI 功能必须有扣费逻辑，必须登录才能使用

### 移动端规则
- 按钮同时支持 `click` 和 `touchend` 事件
- 使用 `force=mobile` 参数标识来源

### 沟通
- 交互使用中文，不道歉不感谢，简洁相关

## Architecture

### 三层架构

```
浏览器前端 (HTML/JS/CSS)
    ├── 页面层: index.html(PC), mobile.html(移动端), chat.html(AI对话)
    ├── 技能系统: skill-system.js + skill-presets.js
    ├── 团队系统: agent-team.js + agent-roles.js + agent-ui.js
    ├── API调用层: api-core.js, batch.js, billing.js
    └── 基础设施: resilient-api.js, task-orchestrator.js, supabase-config.js

Vercel Serverless Functions (/api)
    ├── sora2.js (视频), banana2.js (图片), yunwu.js (多模态)
    ├── writer-llm.js (LLM文本), modelscope.js (免费图片)
    ├── supabase-proxy.js (数据库/计费/认证), proxy.js (通用代理)
    └── video-continuity.js (连续性视频), cron-billing.js (定时任务)

Supabase (数据库 + 认证)
```

### 技能系统 (Skill System)
核心文件: `js/skill-system.js` (~49KB) + `js/skill-presets.js` (~132KB)

- **SkillManager** — 全局单例，注册/执行/搜索技能，最大并发3
- **SkillUI** — 技能面板UI，参数收集，进度展示
- **17个预置技能** — 定义在 `skill-presets.js` 的 `registerPresetSkills()` 中
- 技能分类: `video | image | content | audio | design | tool | automation`

每个技能结构: `{ id, name, icon, category, parameters[], execute(), estimateCost() }`

**重要**: `skill-presets.js` 中 `VIDEO_MODEL_OPTIONS` 和 `IMAGE_MODEL_OPTIONS` 必须在 `registerPresetSkills()` 调用之前声明（IIFE顶部），否则触发 TDZ ReferenceError。

### 多智能体团队 (Agent Team System)
核心文件: `js/agent-team.js` + `js/agent-roles.js` + `js/agent-ui.js`

- **ToolRegistry** — 工具注册表，映射 tool_id → API函数（text_gen, image_banana, video_text, ocr, image_analyze, tts_generate 等）
- **Agent** — 智能体，具有角色定义、systemPrompt、可用工具列表
- **AgentTeam** — Coordinator 调度多 Agent 协作，波次并行执行引擎
- **AgentTeamFactory** — 角色注册 `registerRole()`，团队模板注册 `registerTemplate()`
- **AgentUI** — 嵌入 `chat.html`，提供团队选择/配置/执行/结果展示面板

角色定义在 `agent-roles.js`（coordinator, copywriter, visual_artist, video_producer, brand_strategist, character_designer, social_media_mgr, translator 等），视觉角色配备 `image_analyze` 工具 + 参考图引导 prompt。

### API 核心 (api-core.js)
提供全部页面共用的 API 调用函数:
- `callScriptGenerator()`, `callWriterLLM()`
- `callBanana2ImageAPI()`, `callModelScopeImageAPI()`, `callMidjourneyImageAPI()`
- `callSora2TextToVideoAPI()`, `callSora2ImageToVideoAPI()`
- `callOCRAPI()`, `callTTSAPI()`
- 辅助: `retryableAPICall()`, `isPaidUser()`, `checkFreeUserAccess()`, `__normalizeVideoModelName()`

### 弹性API网关 (resilient-api.js)
- 多节点负载均衡（权重调度）
- 熔断机制: 连续3次失败触发熔断，60s后半开恢复
- 智能降级: 付费节点 → 免费节点自动切换

### 任务调度器 (task-orchestrator.js)
- 优先级队列（VIP优先）
- 智能重试（指数退避，最大3次）
- 断点续传（localStorage 持久化状态）
- 并发控制（默认最大并发3）

## Billing System

### 服务端扣费（API 文件内）
`__billing('consume', userId, amount, desc)` → 执行API → 失败时 `__billing('refund', ...)`
Film costs 定义为每个 API 文件顶部的 `FILM_COST` 对象。

### 客户端两阶段扣费 (billing.js)
`reserveFilm(预扣)` → `apiCall()` → `commitFilm(确认)` | `releaseFilm(退还)`
通过 `window.Billing.executeWithBilling()` 统一封装。

所有计费最终路由到 `/api/supabase-proxy`（action: `consume` 或 `recharge`）。

## Backend API Pattern

每个 `/api/*.js` 导出 `module.exports = async function handler(req, res)`，统一 CORS + OPTIONS + POST-only。

### Multi-Endpoint Fallback
`sora2.js` / `yunwu.js` 使用多端点+多Key轮换:
- 主力: 云梦/云雾 (`api3.wlai.vip`, `yunwu.zeabur.app`, `yunwu.ai`, `api.apiplus.org`)
- 降级: ModelScope (免费)
- 禁用: 贞贞/t8star (`ALLOW_ZHENZHEN = false`)

## Required Environment Variables

```
YUNMENG_API_KEY          # 主力 AI API key（必须）
YUNMENG_API_KEY_2/3      # 备用 key（可选，轮换负载均衡）
SUPABASE_SERVICE_KEY     # Supabase service role key（必须）
VIP_SECRET               # VIP码验证（proxy.js）
MODELSCOPE_API_KEY       # ModelScope（降级图片）
WRITER_MIMO_API_KEY      # MIMO LLM（写作）
RUNNINGHUB_API_KEY       # 视频高清放大
```

## Vercel Configuration

- Function timeouts: 180s（大部分），300s（yunwu.js, cron-billing.js）
- Daily cron: `/api/cron-billing` at 03:00 UTC
- 所有 HTML/JS/CSS: `Cache-Control: no-cache`
- 部署需 `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"` 绕过 SSL

## Key Files Quick Reference

- `mobile.html` — 移动端主页（技能面板 ~L8082, 结果展示 ~L8403, 发布 ~L8675）
- `index.html` — PC端主页（自动重定向移动端到 mobile.html）
- `chat.html` — AI对话页（Agent Team UI 嵌入此页）
- `js/skill-system.js` — SkillManager + SkillUI 核心
- `js/skill-presets.js` — 17个预置技能定义（TDZ 敏感，变量声明顺序重要）
- `js/api-core.js` — 全页面共用的 API 调用函数
- `js/batch.js` — PC端核心逻辑：视频生成工作流、无限画布
- `js/billing.js` — 客户端两阶段扣费
- `js/supabase-config.js` — Supabase 初始化、认证状态管理
- `proxy.js` — IP限流 120 req/60s + CORS域名白名单
