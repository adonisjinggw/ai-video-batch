# 🖼️ 无限画布和缩放功能修复

## 修复日期
2025-11-23

## 问题描述
用户报告：**右侧工作区域的无限画布功能和缩放功能不好用了**

## 根本原因分析

### 缩放系统冲突
项目中存在**两个独立的缩放系统**，它们都操作同一个 `transform: scale()` 属性，导致冲突：

1. **`setupInfiniteCanvas()` 内部的 `scale` 变量**
   - 通过 Ctrl+滚轮缩放
   - 维护自己的 `scale` 变量
   - 设置 `content.style.transform = scale(${scale})`

2. **`window.zoomIn/zoomOut/resetZoom` 使用的 `currentZoom` 变量**
   - 通过按钮触发
   - 维护自己的 `currentZoom` 变量
   - 设置 `canvas.style.transform = scale(${currentZoom})`

### 问题表现
- 用户使用 Ctrl+滚轮缩放后，缩放值被 `setupInfiniteCanvas` 更新
- 然后点击缩放按钮（+/-/100%），缩放值被 `window.zoomIn/Out/resetZoom` 覆盖
- 两个系统的缩放值不同步，导致缩放行为混乱
- 连线位置计算错误，因为 `getCurrentScale()` 返回的是旧的 `scale` 值

---

## 修复方案

### 核心思路
**统一缩放系统**：所有缩放操作都直接读取和修改 DOM 的 `transform: scale()` 值，而不是维护独立的变量。

---

## 修复内容

### 1. 修复 `window.zoomIn/zoomOut/resetZoom`

**修改位置**: `ai-video-batch/js/batch.js` 第 4648 行

**修改前**:
```javascript
let currentZoom = 1;
window.zoomIn = function() {
    currentZoom = Math.min(currentZoom + 0.1, 3);
    const canvas = document.getElementById('taskCanvas');
    if (canvas) canvas.style.transform = `scale(${currentZoom})`;
};

window.zoomOut = function() {
    currentZoom = Math.max(currentZoom - 0.1, 0.3);
    const canvas = document.getElementById('taskCanvas');
    if (canvas) canvas.style.transform = `scale(${currentZoom})`;
};

window.resetZoom = function() {
    currentZoom = 1;
    const canvas = document.getElementById('taskCanvas');
    if (canvas) canvas.style.transform = 'scale(1)';
};
```

**修改后**:
```javascript
// 画布缩放控制（使用 setupInfiniteCanvas 内部的 scale）
// 存储当前缩放值，避免与 setupInfiniteCanvas 冲突
let canvasScale = 1;

window.zoomIn = function() {
    const canvas = document.getElementById('taskCanvas');
    if (!canvas) return;
    
    // ✅ 从 DOM 读取当前 transform 的 scale 值
    const currentTransform = canvas.style.transform;
    const match = currentTransform.match(/scale\(([\d.]+)\)/);
    const currentScale = match ? parseFloat(match[1]) : 1;
    
    const newScale = Math.min(currentScale + 0.1, 5);
    canvas.style.transform = `scale(${newScale})`;
    canvas.style.transformOrigin = '0 0';
    canvasScale = newScale;
    
    // ✅ 更新缩放显示
    const zoomDisplay = document.querySelector('.zoom-level');
    if (zoomDisplay) zoomDisplay.textContent = Math.round(newScale * 100) + '%';
    
    // ✅ 重绘连线
    if (typeof renderConnections === 'function') renderConnections();
};

window.zoomOut = function() {
    const canvas = document.getElementById('taskCanvas');
    if (!canvas) return;
    
    // ✅ 从 DOM 读取当前 transform 的 scale 值
    const currentTransform = canvas.style.transform;
    const match = currentTransform.match(/scale\(([\d.]+)\)/);
    const currentScale = match ? parseFloat(match[1]) : 1;
    
    const newScale = Math.max(currentScale - 0.1, 0.1);
    canvas.style.transform = `scale(${newScale})`;
    canvas.style.transformOrigin = '0 0';
    canvasScale = newScale;
    
    // ✅ 更新缩放显示
    const zoomDisplay = document.querySelector('.zoom-level');
    if (zoomDisplay) zoomDisplay.textContent = Math.round(newScale * 100) + '%';
    
    // ✅ 重绘连线
    if (typeof renderConnections === 'function') renderConnections();
};

window.resetZoom = function() {
    const canvas = document.getElementById('taskCanvas');
    if (!canvas) return;
    
    canvas.style.transform = 'scale(1)';
    canvas.style.transformOrigin = '0 0';
    canvasScale = 1;
    
    // ✅ 更新缩放显示
    const zoomDisplay = document.querySelector('.zoom-level');
    if (zoomDisplay) zoomDisplay.textContent = '100%';
    
    // ✅ 重绘连线
    if (typeof renderConnections === 'function') renderConnections();
};
```

**改进点**:
- ✅ **从 DOM 读取实时缩放值**，而不是使用独立变量
- ✅ 统一 `transformOrigin = '0 0'`，确保缩放原点一致
- ✅ 更新缩放显示（`.zoom-level`）
- ✅ 自动重绘连线，确保连线位置正确
- ✅ 最大缩放改为 5（与 Ctrl+滚轮一致）
- ✅ 最小缩放改为 0.1（与 Ctrl+滚轮一致）

---

### 2. 修复 `window.getCurrentScale()`

**修改位置**: `ai-video-batch/js/batch.js` 第 2574 行

**修改前**:
```javascript
// 暴露给全局以便其他函数调用
window.getCurrentScale = () => scale;
```

**问题**:
- 返回的是 `setupInfiniteCanvas` 闭包内的 `scale` 变量
- 如果用户使用按钮缩放，`scale` 变量不会更新
- 导致连线位置计算错误

**修改后**:
```javascript
// 暴露给全局以便其他函数调用（改为从 DOM 读取实时值）
window.getCurrentScale = () => {
    const canvas = document.getElementById('taskCanvas');
    if (!canvas) return 1;
    
    const currentTransform = canvas.style.transform;
    const match = currentTransform.match(/scale\(([\d.]+)\)/);
    return match ? parseFloat(match[1]) : 1;
};
```

**改进点**:
- ✅ **从 DOM 读取实时缩放值**
- ✅ 与 `zoomIn/zoomOut/resetZoom` 保持一致
- ✅ 确保连线位置计算正确

---

### 3. 修复 `setupInfiniteCanvas` 内部的 Ctrl+滚轮缩放

**修改位置**: `ai-video-batch/js/batch.js` 第 2435 行

**修改前**:
```javascript
// 缩放处理
container.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(0.1, scale * delta), 5);
        
        content.style.transformOrigin = '0 0';
        content.style.transform = `scale(${newScale})`;
        scale = newScale;
        
        // update zoom display
        const zoomDisplay = document.querySelector('.zoom-level');
        if(zoomDisplay) zoomDisplay.textContent = Math.round(scale * 100) + '%';
        
        renderConnections(); // 重绘连线
    }
}, { passive: false });
```

**修改后**:
```javascript
// 缩放处理
container.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        // ✅ 从 DOM 读取当前缩放值，确保与按钮缩放同步
        const currentTransform = content.style.transform;
        const match = currentTransform.match(/scale\(([\d.]+)\)/);
        scale = match ? parseFloat(match[1]) : 1;
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(0.1, scale * delta), 5);
        
        content.style.transformOrigin = '0 0';
        content.style.transform = `scale(${newScale})`;
        scale = newScale;
        
        // update zoom display
        const zoomDisplay = document.querySelector('.zoom-level');
        if(zoomDisplay) zoomDisplay.textContent = Math.round(scale * 100) + '%';
        
        if (typeof renderConnections === 'function') renderConnections(); // 重绘连线
    }
}, { passive: false });
```

**改进点**:
- ✅ **每次滚轮缩放前，先从 DOM 读取当前缩放值**
- ✅ 确保与按钮缩放同步
- ✅ 添加 `typeof renderConnections === 'function'` 检查，避免报错

---

## 工作原理

### 统一的缩放流程

```
用户操作
   ↓
1. 从 DOM 读取当前 transform: scale(X)
   ↓
2. 计算新的缩放值
   ↓
3. 设置 DOM: transform: scale(newX)
   ↓
4. 更新缩放显示（.zoom-level）
   ↓
5. 重绘连线（renderConnections）
```

### 所有缩放操作的数据源

| 操作 | 数据源 | 目标 |
|------|--------|------|
| Ctrl+滚轮 | DOM `transform` | DOM `transform` |
| 按钮 `+` | DOM `transform` | DOM `transform` |
| 按钮 `-` | DOM `transform` | DOM `transform` |
| 按钮 `100%` | - | DOM `transform` |
| `getCurrentScale()` | DOM `transform` | 返回值 |

**核心原则**：**DOM 是唯一的数据源（Single Source of Truth）**

---

## 测试验证

### 测试场景 1：Ctrl+滚轮缩放
1. 按住 `Ctrl`，滚动鼠标滚轮
2. 验证：画布平滑缩放
3. 验证：右上角显示缩放百分比
4. 验证：连线位置正确

### 测试场景 2：按钮缩放
1. 点击 `+` 按钮
2. 验证：画布放大
3. 验证：右上角显示缩放百分比
4. 验证：连线位置正确

### 测试场景 3：混合缩放
1. Ctrl+滚轮放大到 150%
2. 点击 `+` 按钮
3. 验证：画布继续放大到 160%
4. 验证：缩放值同步
5. 点击 `100%` 按钮
6. 验证：画布恢复到 100%

### 测试场景 4：连线绘制
1. 缩放到 200%
2. 拖拽输出手柄创建连线
3. 验证：连线位置正确
4. 缩放到 50%
5. 验证：连线位置仍然正确

---

## 改进效果

### 修复前：
- ❌ Ctrl+滚轮和按钮缩放冲突
- ❌ 缩放值不同步
- ❌ 连线位置计算错误
- ❌ 缩放行为不可预测

### 修复后：
- ✅ 所有缩放操作统一
- ✅ 缩放值实时同步
- ✅ 连线位置始终正确
- ✅ 缩放行为稳定可预测

---

## 遵守的约束

✅ **不改动 UI**：未修改任何 HTML 或 CSS
✅ **不影响其他功能**：仅修改缩放相关逻辑
✅ **保持功能完整**：所有缩放方式都正常工作

---

## 总结

✅ **已修复问题**:
1. 无限画布缩放功能冲突
2. Ctrl+滚轮和按钮缩放不同步
3. 连线位置计算错误

✅ **改进点**:
1. 统一缩放系统，DOM 是唯一数据源
2. 所有缩放操作都从 DOM 读取和写入
3. 自动更新缩放显示和重绘连线

✅ **测试验证**:
- Ctrl+滚轮缩放 ✅
- 按钮缩放 ✅
- 混合缩放 ✅
- 连线绘制 ✅

