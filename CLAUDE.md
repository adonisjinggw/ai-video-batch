# AI Video Batch - Claude Code 项目配置

## 项目简介
AI视频批量生成平台，支持文生图、图生视频、AI写作等多种AI创作功能。

## gstack 技能集成

使用 `/browse` 技能进行所有网页浏览操作。**永远不要使用** `mcp__claude-in-chrome__*` 工具。

### 可用技能列表

**开发流程技能：**
- `/office-hours` - 产品构思和需求分析
- `/plan-ceo-review` - CEO视角的战略审查
- `/plan-eng-review` - 工程架构审查
- `/plan-design-review` - 设计审查
- `/design-consultation` - 设计系统咨询
- `/review` - 代码审查
- `/ship` - 部署和PR创建
- `/browse` - 网页浏览和测试
- `/qa` - 自动化QA测试
- `/qa-only` - 仅报告问题的QA
- `/design-review` - 视觉设计审查
- `/setup-browser-cookies` - 浏览器Cookie配置
- `/retro` - 每周回顾
- `/investigate` - 调试和问题排查
- `/document-release` - 发布文档更新
- `/codex` - 第二意见代码审查

**工具技能：**
- `/careful` - 危险操作警告
- `/freeze` - 限制编辑范围
- `/guard` - 完全安全模式
- `/unfreeze` - 解除编辑限制
- `/gstack-upgrade` - 升级gstack

### 故障排除

如果gstack技能无法工作，运行：
```bash
cd ~/.claude/skills/gstack && ./setup
```

## 技术栈
- 前端：HTML + JavaScript + CSS
- 后端：Vercel Serverless Functions
- API：云雾API、OpenRouter、Midjourney等
- 部署：Vercel

## 项目维护规范（自动生效）

**每次修改本项目代码时，必须自动遵循 `rollroll-maintainer` 技能的规范。** 在编辑任何文件之前，先阅读 `~/.claude/skills/rollroll-maintainer/skill.md` 中的维护规则。

核心要求：

- 修改前确认影响范围（PC版/手机版/两端共享）
- 搜索函数/变量的所有引用后再修改
- 修改后运行语法检查：`node -c "文件路径"`
- 只提交修改的文件，禁止 `git add -A`
- 更新 HTML 中的版本参数 `?v=xxx&t=xxx`

## 开发规范
- 所有代码使用中文注释
- API调用需要错误处理和超时设置
- 前端使用原生JavaScript，避免引入大型框架
