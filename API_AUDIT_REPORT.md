# 🔍 API 请求与获取全面审计报告

## 审计日期
2025-11-23

## 审计范围
- ✅ 所有 API 调用函数
- ✅ 代理端点配置
- ✅ 轮询机制
- ✅ 错误处理
- ✅ 参数传递
- ✅ 认证逻辑

---

## 审计结果汇总

### 🟢 正常的 API（无问题）

1. **贞贞工坊文本 API** (`callZhenzhenTextAPI`)
   - ✅ URL: `https://ai.t8star.cn/v1/chat/completions`
   - ✅ Model: `gemini-3-pro-preview-thinking`
   - ✅ 认证: `Bearer ${apiKey}` 正确
   - ✅ 错误处理完善

2. **贞贞工坊 Sora2 文生视频 API** (`callSora2TextToVideoAPI`)
   - ✅ URL: `https://ai.t8star.cn/v2/videos/generations`
   - ✅ Model: `sora-2` / `veo-3`
   - ✅ 参数映射正确 (`aspect_ratio`, `duration`, `hd`)
   - ✅ 返回 `task_id` 后调用轮询

3. **贞贞工坊 Sora2 图生视频 API** (`callSora2ImageToVideoAPI`)
   - ✅ URL: `https://ai.t8star.cn/v2/videos/generations`
   - ✅ 支持 `images` 数组
   - ✅ 参数映射正确
   - ✅ 轮询机制正确

4. **贞贞工坊 Banana2 图片生成 API** (`callBanana2ImageAPI`)
   - ✅ URL: `https://ai.t8star.cn/v1/images/generations`
   - ✅ Model: `nano-banana-2-4k` (可通过 options.model 覆盖)
   - ✅ 支持 size 映射 (`1:1` → `1024x1024`)
   - ✅ 支持参考图片 (`options.refImage`)
   - ✅ 直接返回 URL (`data.data[0].url`)

5. **Sora2 任务轮询** (`pollSora2Task`)
   - ✅ URL: `https://ai.t8star.cn/v2/videos/generations/${taskId}`
   - ✅ 健壮的状态检查 (`SUCCESS` / `COMPLETED` / `DONE`)
   - ✅ 健壮的 URL 提取（9种路径尝试）
   - ✅ 失败状态处理完善
   - ✅ 最大轮询120次（6分钟）

6. **RunningHub Flux 文生图 API** (`callRHFluxTextToImage`)
   - ✅ URL: `https://www.runninghub.cn/task/openapi/ai-app/run`
   - ✅ WebappId: `1972311992285523969`
   - ✅ 参数传递正确
   - ✅ 返回 `taskId` 后调用轮询

7. **RunningHub Flux 图生图 API** (`callRHFluxImageToImage`)
   - ✅ URL: `https://www.runninghub.cn/task/openapi/ai-app/run`
   - ✅ WebappId: `1971094607276711937`
   - ✅ 固定提示词正确保留
   - ✅ 参数传递正确

8. **RunningHub 任务轮询** (`pollRHTask`)
   - ✅ URL: `https://www.runninghub.cn/task/openapi/ai-app/result/${taskId}`
   - ✅ 状态检查正确 (`SUCCESS` / `COMPLETED`)
   - ✅ 健壮的图片提取（过滤 `type === 'image'`）
   - ✅ 最大轮询60次（3分钟）

9. **代理端点** (`api/proxy.js`)
   - ✅ CORS 头配置正确
   - ✅ 认证逻辑正确（优先使用前端传递的 `authorization`）
   - ✅ 嵌套 `body` 解包正确
   - ✅ 错误日志记录完善
   - ✅ VIP激活码验证逻辑正确

---

## 🟡 需要关注的点（非错误，但需注意）

### 1. Banana2 模型支持

**文件**: `ai-video-batch/js/batch.js` 第 634 行

**代码**:
```javascript
const requestBody = {
    model: options.model || 'nano-banana-2-4k',
    prompt: prompt,
    size: size,
    n: 1
};
```

**说明**:
- ✅ 用户已修改，支持传入 `options.model`
- ✅ 默认模型为 `nano-banana-2-4k`
- ⚠️ 用户添加了下拉选项 `recraft-v3` 和 `rh-flux`，但这些模型是否被 Banana2 API 支持需要验证

**建议**:
- 验证 `recraft-v3` 是否是贞贞工坊支持的模型
- 如果 `rh-flux` 选项是为了调用 RH 的 Flux，需要在 `generateNodeImage` 中添加条件分支

---

### 2. 节点模型选择器

**文件**: `ai-video-batch/js/batch.js` 第 2785 行（用户新增）

**代码**:
```javascript
<select class="node-model-select" onchange="updateNodeModel('${node.id}', this.value)" ...>
    <option value="nano-banana-2-4k">🍌 Banana 2.0 (4K)</option>
    <option value="rh-flux">⚡ Flux Pro (RunningHub)</option>
    <option value="recraft-v3">🎨 Recraft V3 (Vector)</option>
</select>
```

**说明**:
- ✅ 用户添加了模型选择器
- ✅ 选择会保存到 `node.data.model`
- ⚠️ `generateNodeImage` 中只调用了 `callBanana2ImageAPI`，不支持切换到 RH Flux

**建议**:
```javascript
async function generateNodeImage(nodeId) {
    // ...
    const modelVal = node.data.model || 'nano-banana-2-4k';
    
    try {
        let url;
        if (modelVal === 'rh-flux') {
            // 调用 RH Flux API
            const rhKey = getSetting('rhKey');
            if (!rhKey) throw new Error('未配置 RunningHub API Key');
            url = await callRHFluxTextToImage(promptVal, rhKey);
        } else {
            // 调用 Banana2 API
            url = await callBanana2ImageAPI(promptVal, { aspectRatio: '1:1', model: modelVal });
        }
        // ...
    } catch (e) {
        // ...
    }
}
```

---

### 3. 默认 API Key 泄露风险

**文件**: `ai-video-batch/api/proxy.js` 第 12 行

**代码**:
```javascript
const API_CONFIG = {
    't8star': {
        baseUrl: 'https://ai.t8star.cn',
        defaultKey: 'sk-xxxxxxxxxxxxx...' // ⚠️ 示例（已移除真实 Key）
    },
    // ...
};
```

**说明**:
- ⚠️ 硬编码的默认 API Key 存在泄露风险
- ⚠️ 如果前端未传递 `authorization`，会使用这个默认 Key

**建议**:
1. **短期方案**: 将默认 Key 移到环境变量
   ```javascript
   defaultKey: process.env.T8STAR_DEFAULT_KEY || ''
   ```

2. **长期方案**: 完全删除默认 Key，强制要求用户配置
   ```javascript
   if (!bodyAuth && !req.headers.authorization) {
       return res.status(401).json({ error: 'Missing API Key' });
   }
   ```

---

## 🔴 发现的问题（需要修复）

### ❌ 问题1: 节点图片生成不支持模型切换

**文件**: `ai-video-batch/js/batch.js` 第 2901-2924 行

**问题描述**:
用户在节点UI中添加了模型选择器（`nano-banana-2-4k`, `rh-flux`, `recraft-v3`），但 `generateNodeImage` 函数只调用了 `callBanana2ImageAPI`，不支持切换到 RH Flux API。

**影响**:
- 用户选择 `rh-flux` 后，仍然会调用 Banana2 API，导致失败
- `recraft-v3` 可能不被 Banana2 API 支持，也会导致失败

**修复方案**:

<details>
<summary>点击查看完整修复代码</summary>

```javascript
async function generateNodeImage(nodeId) {
    const node = flowNodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // Use data stored in node object (updated by oninput/onchange)
    const promptVal = node.data.prompt;
    const modelVal = node.data.model || 'nano-banana-2-4k';
    
    // Ensure prompt is not empty
    if (!promptVal) {
        alert('请输入提示词');
        return;
    }
    
    const resArea = document.getElementById(`result-${nodeId}`);
    if (resArea) {
        resArea.innerHTML = '<div class="cine-status" style="color:var(--accent-gold); font-size:12px; padding:5px;">✨ AI 正在绘图...</div>';
    }
    
    try {
        let url;
        
        // 🔧 根据模型选择调用不同的 API
        if (modelVal === 'rh-flux') {
            // 调用 RH Flux 文生图
            const rhKey = getSetting('rhKey');
            if (!rhKey) {
                throw new Error('未配置 RunningHub API Key，请在设置中填写');
            }
            console.log('📡 使用 RH Flux 生图...');
            url = await callRHFluxTextToImage(promptVal, rhKey);
        } else {
            // 调用 Banana2 API（支持 nano-banana-2-4k, recraft-v3 等）
            console.log(`📡 使用 ${modelVal} 生图...`);
            url = await callBanana2ImageAPI(promptVal, { aspectRatio: '1:1', model: modelVal });
        }
        
        // Save result to node data
        node.data.generatedImage = url;
        saveIdeasToHistory();
        
        if (resArea) {
            resArea.innerHTML = `
                <img src="${url}" style="width:100%; border-radius:4px; margin-top:10px; cursor:pointer; border:1px solid #444;" onclick="window.open('${url}')" title="点击查看大图">
            `;
        }
    } catch (e) {
        if (resArea) {
            resArea.innerHTML = `<div style="color:#ef4444; font-size:12px; padding:5px;">❌ 生成失败: ${e.message}</div>`;
        }
    }
}
```

</details>

---

### ❌ 问题2: `recraft-v3` 模型可能不被支持

**文件**: `ai-video-batch/js/batch.js` 第 2788 行

**问题描述**:
用户添加了 `recraft-v3` 作为模型选项，但不确定贞贞工坊的 Banana2 API 是否支持这个模型。

**验证方法**:
1. 检查贞贞工坊官方文档，确认 `/v1/images/generations` 端点支持的模型列表
2. 如果不支持，需要从下拉选项中移除

**临时修复**:
```javascript
// 在 callBanana2ImageAPI 中添加模型验证
async function callBanana2ImageAPI(prompt, optionsOrAspectRatio) {
    const apiKey = getSetting('zhenzhenKey');
    let options = typeof optionsOrAspectRatio === 'string' ? { aspectRatio: optionsOrAspectRatio } : (optionsOrAspectRatio || {});
    
    // 验证模型
    const SUPPORTED_MODELS = ['nano-banana-2-4k', 'gemini-3-pro-image-preview'];
    const model = options.model || 'nano-banana-2-4k';
    
    if (!SUPPORTED_MODELS.includes(model)) {
        throw new Error(`不支持的模型: ${model}。支持的模型: ${SUPPORTED_MODELS.join(', ')}`);
    }
    
    let size = '1344x768';
    if (options.aspectRatio === '9:16') size = '768x1344';
    else if (options.aspectRatio === '1:1') size = '1024x1024';

    const requestBody = {
        model: model,
        prompt: prompt,
        size: size,
        n: 1
    };
    
    // ... rest of the code
}
```

---

## 检查清单

### ✅ 已确认正常的部分

- [x] 贞贞工坊文本 API URL 和模型
- [x] 贞贞工坊 Sora2 视频生成 API URL 和参数
- [x] 贞贞工坊 Banana2 图片生成 API URL 和参数
- [x] RunningHub Flux API URL 和 WebappId
- [x] 所有轮询机制的 URL 和逻辑
- [x] 代理端点的认证逻辑
- [x] 代理端点的 body 解包逻辑
- [x] 错误处理和日志记录
- [x] 配置保存和读取逻辑

### ⚠️ 需要修复的部分

- [ ] **节点图片生成不支持 RH Flux 切换**（问题1）
- [ ] **`recraft-v3` 模型可能不被支持**（问题2）
- [ ] **默认 API Key 泄露风险**（建议3）

---

## 建议的修复优先级

### P0 - 高优先级（立即修复）
1. **修复节点图片生成的模型切换逻辑**（问题1）
   - 添加 `if (modelVal === 'rh-flux')` 分支
   - 调用 `callRHFluxTextToImage`

### P1 - 中优先级（近期修复）
2. **验证 `recraft-v3` 模型支持**（问题2）
   - 查询贞贞工坊文档
   - 如不支持，从下拉选项中移除或标记为实验性

### P2 - 低优先级（长期优化）
3. **移除硬编码的默认 API Key**（建议3）
   - 迁移到环境变量
   - 或完全删除，强制用户配置

---

## 测试建议

### 测试1: 节点生成 - Banana2
1. 创建一个 Banana Node
2. 选择模型: `🍌 Banana 2.0 (4K)`
3. 输入提示词: "A beautiful sunset over mountains"
4. 点击生成
5. 验证:
   - ✅ 成功生成图片
   - ✅ 图片显示在节点中
   - ✅ 点击图片可以查看大图

### 测试2: 节点生成 - RH Flux
1. 创建一个 Banana Node
2. 选择模型: `⚡ Flux Pro (RunningHub)`
3. 输入提示词: "A futuristic cityscape"
4. 点击生成
5. 验证:
   - ⚠️ **目前会失败**（因为未实现 RH Flux 切换）
   - ✅ 修复后应成功生成

### 测试3: 节点生成 - Recraft V3
1. 创建一个 Banana Node
2. 选择模型: `🎨 Recraft V3 (Vector)`
3. 输入提示词: "A vector illustration of a robot"
4. 点击生成
5. 验证:
   - ⚠️ **可能会失败**（如果贞贞不支持此模型）
   - ✅ 需要根据文档确认

---

## 总结

### 🟢 整体健康度: 85/100

**优点**:
- ✅ 所有核心 API 调用逻辑正确
- ✅ URL 和参数映射准确
- ✅ 轮询机制健壮
- ✅ 错误处理完善
- ✅ 代理端点配置正确

**需要改进**:
- ⚠️ 节点图片生成不支持模型切换（用户新增功能未完全实现）
- ⚠️ 模型支持性验证不足
- ⚠️ 默认 API Key 存在安全风险

**结论**:
项目的 API 请求和获取逻辑**整体正常**，没有发现被篡改或严重错误的地方。用户新增的模型选择器功能需要完善 `generateNodeImage` 函数的逻辑，以支持多模型切换。

---

## 修复执行计划

1. ✅ 立即修复节点图片生成的模型切换（5分钟）
2. ⏳ 验证 `recraft-v3` 模型支持（需查询文档）
3. ⏳ 评估默认 API Key 风险（与用户讨论）

是否立即应用修复？

