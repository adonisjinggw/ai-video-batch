# AI 写作场景入口修复与写作回归排查 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 恢复章节卡片“场景”为稳定的单次生图多分镜感入口，并修复长篇小说/短剧接入后对普通 AI 写作、记忆区分和 524 超时的最直接回归问题，最后完成 CLI 部署。

**Architecture:** 采用最小改动策略：保留现有 storyboard 相关函数，但把默认“场景”入口切回 `novelGenerateSceneImage()`。在该函数内部复用现有模板思路与角色参考图能力，直接生成一张多分镜感图片；随后聚焦写作页的共享状态、记忆注入和超时参数，修复最明确的污染点并通过版本号刷新缓存。

**Tech Stack:** HTML, 原生 JavaScript, Vercel Serverless Functions, fetch API, localStorage, Vercel CLI

---

## File Map

- Modify: `js/novel-features.js`
  - 责任：章节卡片“场景”按钮入口、单次场景图生成、角色参考图采集、多分镜 prompt 组装
- Modify: `writing.html`
  - 责任：写作页共用状态、记忆注入、LLM 调用超时/流式参数、脚本版本号刷新
- Read only reference: `js/prompt-templates.js`
  - 责任：提供 `multi_char_comic`、`nine_grid_story`、`script_storyboard`、`consistency_lock` 等模板文本来源
- Read only reference: `js/batch.js`
  - 责任：提供 `buildGridImagePrompt(...)` 的多格分镜约束思路
- Verify/deploy: `package.json`
  - 责任：提供 `npm run deploy:stable` 等部署脚本

---

### Task 1: 切回章节卡片“场景”默认入口

**Files:**
- Modify: `js/novel-features.js:2253-2263`
- Test: `js/novel-features.js:2234-2263`

- [ ] **Step 1: 写一个最小变更，把“场景”按钮切回单次生图入口**

将这段代码：

```js
<button onclick="event.stopPropagation();novelStoryboardFullPipeline(${i})">🖼️ 场景</button>
```

改为：

```js
<button onclick="event.stopPropagation();novelGenerateSceneImage(${i})">🖼️ 场景</button>
```

- [ ] **Step 2: 运行文本检查看入口已切换**

Run:

```bash
python - <<'PY'
from pathlib import Path
p = Path('J:/123pan/13998416173/NanoNoPort/ai-video-batch/js/novel-features.js')
text = p.read_text(encoding='utf-8')
needle = 'novelGenerateSceneImage(${i})'>
print('found' if 'novelGenerateSceneImage(${i})' in text else 'missing')
PY
```

Expected: 输出 `found`

- [ ] **Step 3: 检查旧 storyboard 默认入口仍保留函数定义**

Run:

```bash
git diff -- "J:/123pan/13998416173/NanoNoPort/ai-video-batch/js/novel-features.js"
```

Expected: diff 只显示按钮入口变更，不删除 `novelGenerateStoryboards` / `novelStoryboardFullPipeline` 函数。

- [ ] **Step 4: Commit**

```bash
git add js/novel-features.js
git commit -m "fix: 恢复章节场景按钮为单次生图入口"
```

### Task 2: 将 `novelGenerateSceneImage()` 改为单次生成多分镜感图片

**Files:**
- Modify: `js/novel-features.js:1768-1808`
- Read: `js/prompt-templates.js:403-406`
- Read: `js/prompt-templates.js:482-485`
- Read: `js/prompt-templates.js:647-650`
- Read: `js/prompt-templates.js:1327-1330`
- Read: `js/batch.js:10971-11075`
- Test: `js/novel-features.js:1768-1808`

- [ ] **Step 1: 在 `novelGenerateSceneImage()` 内增加最小辅助变量，自动选择比例与分镜布局**

在函数内引入类似如下代码：

```js
var isShortDrama = (novelState && (novelState.novelType === 'short' || novelState.type === 'short_drama' || novelState.genre === '短剧'));
var aspectRatio = isShortDrama ? '9:16' : '16:9';
var panelHint = isShortDrama ? '竖版 4-6 格短剧分镜板' : '横版 4-6 格电影分镜板';
```

- [ ] **Step 2: 规范章节文本与角色信息输入，避免 prompt 过长**

在函数内补充最小数据整理逻辑：

```js
var rawContent = '';
if (typeof ch.content === 'string') rawContent = ch.content;
else if (Array.isArray(ch.content)) rawContent = ch.content.join('\n');
else if (ch.content && typeof ch.content === 'object') rawContent = ch.content.text || ch.content.content || ch.content.script || '';
else rawContent = String(ch.content || '');

var content = rawContent.replace(/\s+/g, ' ').trim().slice(0, 260);
var chars = (novelState.characters || []).slice(0, 6);
var charSummary = chars.map(function (c) {
  return [c.name || '未命名角色', c.description || c.prompt || ''].filter(Boolean).join('：');
}).join('\n');
var refImages = chars.map(function (c) { return c.imageUrl; }).filter(Boolean).slice(0, 4);
```

- [ ] **Step 3: 用现有模板思路重写多分镜感 prompt，避免再走二次 LLM**

将旧 prompt：

```js
var prompt = '小说场景插画，电影级概念艺术...';
```

改为类似下面这种精简但强约束的版本：

```js
var prompt = [
  '创建一张' + panelHint + '，不是单一大场景图，而是一张图中包含多个独立分镜格。',
  '每个分镜格都是独立完整画面，按阅读顺序展示同一章节的连续剧情。',
  '不要把一张完整大图切块；必须是真正的多格故事板构图。',
  '整体统一风格、统一角色外观、统一色调与电影级光影。',
  '参考风格：多角色串场漫画 + 九宫格叙事 + 电影故事板。',
  '章节标题：' + title,
  '章节内容摘要：' + (content || '无'),
  '主要角色：' + (charSummary || '无明确角色信息'),
  '一致性要求：同一角色在所有分镜中保持脸型、发型、服装和体态一致，只允许姿态、表情、镜头远近变化。',
  '画面要求：细白边或清晰分隔线区分分镜格，电影级构图，叙事连贯，细节丰富，不要额外 UI、水印、字幕或二维码。',
  '输出为高质量数字插画，适合小说/短剧场景展示。'
].join('\n');
```

- [ ] **Step 4: 将参考图和自动比例传给图片 API**

把调用改成：

```js
var imageUrl = await callBanana2ImageAPI(prompt, {
  model: 'gemini-3.1-flash-image-preview-4k',
  aspectRatio: aspectRatio,
  refImages: refImages
});
```

如果 `refImages.length === 0`，允许传空数组或在调用前删除该字段：

```js
var imageOptions = {
  model: 'gemini-3.1-flash-image-preview-4k',
  aspectRatio: aspectRatio
};
if (refImages.length > 0) imageOptions.refImages = refImages;
var imageUrl = await callBanana2ImageAPI(prompt, imageOptions);
```

- [ ] **Step 5: 运行静态检查，确认函数仍然只走 `callBanana2ImageAPI`，未新增 `_novelLLM` 调用**

Run:

```bash
python - <<'PY'
from pathlib import Path
text = Path('J:/123pan/13998416173/NanoNoPort/ai-video-batch/js/novel-features.js').read_text(encoding='utf-8')
start = text.index('async function novelGenerateSceneImage')
end = text.index('// ==================== 13c3. 保存图片到手机 ====================')
chunk = text[start:end]
print('_novelLLM' in chunk)
print('callBanana2ImageAPI' in chunk)
PY
```

Expected:

```text
False
True
```

- [ ] **Step 6: Commit**

```bash
git add js/novel-features.js
git commit -m "fix: 场景改为单次生成多分镜感图片"
```

### Task 3: 排查并修复写作页最直接的流式/超时回归点

**Files:**
- Modify: `writing.html:2615-2715`
- Test: `writing.html:2615-2786`

- [ ] **Step 1: 识别当前最直接的回归点：大纲生成仍默认 `stream: true`**

把这些调用从：

```js
], { maxTokens: 4096, temperature: 0.9, stream: true, useMemory: false });
], { maxTokens: 8192, temperature: 0.85, stream: true, useMemory: false });
```

改为：

```js
], { maxTokens: 4096, temperature: 0.9, stream: false, useMemory: false });
], { maxTokens: 8192, temperature: 0.85, stream: false, useMemory: false });
```

同文件内所有 novel 相关默认大纲生成调用都要做同样替换，目标是避免再次把易超时、易流式失败的路径带回前端。

- [ ] **Step 2: 保持 `_novelLLM` 的默认行为不变，只修调用点，不扩大改动面**

不要把 `_novelLLM` 的：

```js
const useStream = opts.stream === true;
```

改成别的全局行为；只修明确错误调用点，避免影响已稳定调用方。

- [ ] **Step 3: 检查普通 AI 写作记忆注入与 novel 记忆注入的边界**

验证以下行为仍然分离：

```js
const memoryPrompt = window.getUserMemoryPrompt();
```

普通写作使用自己已有入口，novel 仅在 `opts.useMemory === true` 时注入，不要把 novel memory 注入逻辑改成全局默认开启。

- [ ] **Step 4: 运行 grep，确认 `stream: true` 不再出现在 novel 大纲生成调用处**

Run:

```bash
python - <<'PY'
from pathlib import Path
text = Path('J:/123pan/13998416173/NanoNoPort/ai-video-batch/writing.html').read_text(encoding='utf-8')
for line in text.splitlines():
    if 'stream: true' in line and 'useMemory: false' in line:
        print(line.strip())
PY
```

Expected: 不应再打印 novel 大纲/章节批量生成那几处旧调用。

- [ ] **Step 5: Commit**

```bash
git add writing.html
git commit -m "fix: 关闭小说大纲生成的流式调用回归"
```

### Task 4: 排查并修复最直接的写作状态/记忆污染点

**Files:**
- Modify: `writing.html:16-28`
- Modify: `writing.html:1755-1761`
- Modify: `writing.html:2598-2607`
- Test: `writing.html`

- [ ] **Step 1: 识别写作页 localStorage 关键键，确认 novel 状态与普通写作历史分离**

保留以下键分离，不要合并：

```js
localStorage.getItem('writing_history')
localStorage.setItem('writing_history', ...)
localStorage.setItem('novel_state', JSON.stringify(novelState))
```

如果发现普通写作错误复用 `novel_state` 或 novel 功能读写 `writing_history` 以外的普通内容缓存，在对应调用点修回各自独立键。

- [ ] **Step 2: 给 `novelState` 初始化补齐类型字段，但不影响旧数据**

把初始化从：

```js
window.novelState = window.novelState || {
  mode: 'auto',
  outline: null,
  chapters: [],
  currentIdx: -1,
  paused: false,
  writing: false,
  totalWords: 0,
  totalCost: 0
};
```

补成：

```js
window.novelState = window.novelState || {
  mode: 'auto',
  outline: null,
  chapters: [],
  currentIdx: -1,
  paused: false,
  writing: false,
  totalWords: 0,
  totalCost: 0,
  novelType: 'novel'
};
```

这样 `novelGenerateSceneImage()` 自动判定比例时有稳定字段可读；同时不删除旧字段，不破坏已有存档。

- [ ] **Step 3: 只在短剧入口处设置 `novelState.novelType = 'short'`，在长篇小说入口处设置 `novelState.novelType = 'novel'`**

如果已有类型切换入口，加入最小赋值：

```js
novelState.novelType = 'short';
```

和：

```js
novelState.novelType = 'novel';
```

不要新增复杂枚举系统，只给当前自动比例逻辑提供稳定来源。

- [ ] **Step 4: 运行 grep 验证类型字段已可检索**

Run:

```bash
python - <<'PY'
from pathlib import Path
text = Path('J:/123pan/13998416173/NanoNoPort/ai-video-batch/writing.html').read_text(encoding='utf-8')
print(text.count('novelType'))
PY
```

Expected: 输出至少 `2`，表示初始化和模式赋值都已存在。

- [ ] **Step 5: Commit**

```bash
git add writing.html js/novel-features.js
git commit -m "fix: 隔离小说类型状态并稳定记忆边界"
```

### Task 5: 刷新写作页脚本版本，确保缓存拿到新逻辑

**Files:**
- Modify: `writing.html` 中脚本引用区
- Test: `writing.html`

- [ ] **Step 1: 找到写作页脚本版本号**

把类似：

```html
<script src="/js/novel-engine.js?v=8.21.1"></script>
<script src="/js/novel-features.js?v=8.21.1"></script>
```

提升为新的统一版本，例如：

```html
<script src="/js/novel-engine.js?v=8.21.2"></script>
<script src="/js/novel-features.js?v=8.21.2"></script>
```

如果当前版本已不是 `8.21.1`，则在现有基础上递增一个补丁版本。

- [ ] **Step 2: 运行 grep 验证两个脚本版本一致**

Run:

```bash
python - <<'PY'
from pathlib import Path
text = Path('J:/123pan/13998416173/NanoNoPort/ai-video-batch/writing.html').read_text(encoding='utf-8')
for line in text.splitlines():
    if '/js/novel-engine.js?v=' in line or '/js/novel-features.js?v=' in line:
        print(line.strip())
PY
```

Expected: 两行都打印，并且版本号一致。

- [ ] **Step 3: Commit**

```bash
git add writing.html
git commit -m "fix: 提升写作页小说脚本缓存版本"
```

### Task 6: 本地验证修改结果

**Files:**
- Verify: `js/novel-features.js`
- Verify: `writing.html`
- Verify: `package.json`

- [ ] **Step 1: 运行 git diff，人工确认只改了计划内文件**

Run:

```bash
git diff -- js/novel-features.js writing.html
```

Expected: 只出现“场景入口”“scene prompt”“stream false”“novelType”“脚本版本号”等相关差异。

- [ ] **Step 2: 运行本地静态检查脚本，确认关键字符串命中**

Run:

```bash
python - <<'PY'
from pathlib import Path
nf = Path('J:/123pan/13998416173/NanoNoPort/ai-video-batch/js/novel-features.js').read_text(encoding='utf-8')
wh = Path('J:/123pan/13998416173/NanoNoPort/ai-video-batch/writing.html').read_text(encoding='utf-8')
checks = {
    'scene_button': 'novelGenerateSceneImage(${i})' in nf,
    'scene_ref_images': 'refImages' in nf,
    'scene_no_novel_llm': '_novelLLM' not in nf[nf.index('async function novelGenerateSceneImage'):nf.index('// ==================== 13c3. 保存图片到手机 ====================')],
    'novel_type': 'novelType' in wh,
    'stream_false_present': 'stream: false' in wh,
}
for k, v in checks.items():
    print(k, v)
PY
```

Expected:

```text
scene_button True
scene_ref_images True
scene_no_novel_llm True
novel_type True
stream_false_present True
```

- [ ] **Step 3: 如项目已安装依赖，运行最小部署前检查**

Run:

```bash
npm run predeploy
```

Expected: 版本同步脚本成功，无报错退出。

- [ ] **Step 4: Commit**

```bash
git add js/novel-features.js writing.html
git commit -m "test: 完成场景修复与写作回归的本地验证"
```

### Task 7: CLI 部署并验证部署结果

**Files:**
- Verify/deploy: `package.json`
- Verify/deploy: Vercel CLI 输出

- [ ] **Step 1: 确认工作区干净或仅包含待部署变更**

Run:

```bash
git status --short
```

Expected: 仅有计划内文件修改，或已全部提交。

- [ ] **Step 2: 使用稳定部署命令发布生产环境**

Run:

```bash
npm run deploy:stable
```

Expected: Vercel 输出生产部署 URL，并成功完成发布。

- [ ] **Step 3: 记录部署 URL 并做最小回归检查**

至少验证：

```text
1. writing.html 已加载新版本 novel-engine.js / novel-features.js
2. 点击章节卡片“场景”不会再触发二次 storyboard 流程
3. 普通 AI 写作生成请求不再明显复现 524
```

- [ ] **Step 4: Commit（仅在部署前还有未提交验证或版本变更时）**

```bash
git add js/novel-features.js writing.html
git commit -m "chore: deploy writing scene recovery update"
```

如果部署前已经全部提交，则跳过此步，不创建空提交。

---

## Self-Review

### Spec coverage

- 场景按钮改回 `novelGenerateSceneImage()`：Task 1
- 单次生成多分镜感图片：Task 2
- 自动 9:16 / 16:9：Task 2 + Task 4
- 复用角色参考图：Task 2
- 不删除 storyboard 相关函数：Task 1 + Task 2
- 排查并修复 AI 写作回归、记忆区分、524：Task 3 + Task 4
- 缓存刷新：Task 5
- 验证与最终 CLI 部署：Task 6 + Task 7

### Placeholder scan

- 已移除 TBD / TODO / “后续实现” 类占位
- 每个任务都有具体文件、代码或命令
- 没有引用未定义的新函数名

### Type consistency

- 场景入口统一使用 `novelGenerateSceneImage`
- 类型字段统一使用 `novelType`
- 图片 API 参考图统一使用 `refImages`
- 没有引入新的复杂状态结构
