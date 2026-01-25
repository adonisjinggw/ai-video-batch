# AI视频批量创作工具 - 代码重构计划

> 状态：📋 备用计划（暂不执行）  
> 创建日期：2024-12-17  
> 预计工时：2-3天

---

## 1. 目标

将 `js/batch.js`（约29000行）拆分为多个模块文件，提高代码可维护性。

## 2. 拆分方案

### 目录结构

```
js/
├── batch.js              # 主入口（保留，负责导入和初始化）
├── modules/
│   ├── api/
│   │   ├── banana.js     # Banana图像生成API
│   │   ├── video.js      # 视频生成API (Sora, Veo等)
│   │   ├── modelscope.js # 魔塔API
│   │   └── index.js      # API统一导出
│   │
│   ├── nodes/
│   │   ├── banana-node.js    # Banana画板节点
│   │   ├── sketchpad-node.js # 手绘参考图节点
│   │   ├── video-node.js     # 视频节点
│   │   ├── text-node.js      # 文本节点
│   │   └── index.js          # 节点统一导出
│   │
│   ├── canvas/
│   │   ├── drawing.js        # 绘图功能
│   │   ├── text-tool.js      # 文字标注工具
│   │   └── index.js
│   │
│   ├── storage/
│   │   ├── local.js          # localStorage操作
│   │   ├── supabase.js       # Supabase同步
│   │   └── index.js
│   │
│   └── utils/
│       ├── image.js          # 图片处理工具
│       ├── compress.js       # 压缩工具
│       ├── retry.js          # 重试逻辑
│       └── index.js
```

## 3. 拆分顺序（低风险优先）

| 阶段 | 模块 | 风险 | 说明 |
|------|------|------|------|
| 1 | `utils/` | 🟢 低 | 纯工具函数，无状态依赖 |
| 2 | `api/` | 🟢 低 | API调用函数，相对独立 |
| 3 | `storage/` | 🟡 中 | 涉及数据持久化 |
| 4 | `canvas/` | 🟡 中 | 绑定DOM事件 |
| 5 | `nodes/` | 🟠 中高 | 核心渲染逻辑 |

## 4. 关键保护措施

### 4.1 保持全局挂载

```javascript
// 拆分后的模块必须保持 window.xxx 挂载
// 以确保 HTML onclick="xxx()" 调用正常

// modules/nodes/banana-node.js
export function createBananaNode(x, y, sourceId) { ... }
window.createBananaNode = createBananaNode;

// modules/api/banana.js  
export async function generateNodeImage(nodeId) { ... }
window.generateNodeImage = generateNodeImage;
```

### 4.2 HTML引入方式

```html
<!-- 方案A：使用 ES6 模块 -->
<script type="module" src="js/batch.js"></script>

<!-- 方案B：打包工具 (推荐) -->
<!-- 使用 Vite/Rollup 打包成单文件 -->
<script src="js/bundle.js"></script>
```

### 4.3 测试检查清单

每拆分一个模块后，检查：

- [ ] 节点创建正常（Banana画板、手绘参考图、视频节点）
- [ ] 画布绘图正常（画笔、橡皮擦、文字工具）
- [ ] 图片生成正常（文生图、图生图）
- [ ] 视频生成正常
- [ ] 数据保存/加载正常
- [ ] 历史记录正常

## 5. 回滚方案

保留原始 `batch.js` 备份：

```bash
cp js/batch.js js/batch.js.backup
```

如拆分后出现问题，可立即回滚。

## 6. 不执行原因记录

当前暂不执行的原因：
- 功能开发优先级更高
- 需要先完成错误监控接入
- 用户量增长后再考虑

---

## 附录：待拆分函数清单（Top 20）

| 函数名 | 行数(估) | 目标模块 |
|--------|----------|----------|
| `generateNodeImage` | ~200 | nodes/banana-node.js |
| `callBanana2ImageAPI` | ~150 | api/banana.js |
| `initBananaNodeUI` | ~300 | canvas/drawing.js |
| `initSketchpadNodeUI` | ~250 | canvas/drawing.js |
| `renderCanvas` | ~500 | nodes/index.js |
| `createBananaNode` | ~50 | nodes/banana-node.js |
| `createVideoNode` | ~50 | nodes/video-node.js |
| `showTextInputDialog` | ~80 | canvas/text-tool.js |
| `saveIdeasToHistory` | ~30 | storage/local.js |
| `loadIdeasFromHistory` | ~30 | storage/local.js |
| `compressDataUrl` | ~40 | utils/compress.js |
| `retryableAPICall` | ~50 | utils/retry.js |
| `fetchWithFallback` | ~80 | api/index.js |
| `callModelScopeImageAPI` | ~100 | api/modelscope.js |
| `callSora2VideoAPI` | ~150 | api/video.js |
| ... | ... | ... |
