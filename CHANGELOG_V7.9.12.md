# 📋 AI视频批量创作工具 - V7.9.12 更新日志

**发布日期**: 2025-11-24  
**版本**: V7.9.12

---

## 🔧 **核心修复**

### 1. ✅ **Banana2图像生成模型修复**
- **问题**: `callBanana2ImageAPI` 函数硬编码了 `gemini-3-pro-image-preview`，但该模型不支持 `/v1/images/generations` 端点
- **修复**: 
  - 改为使用 `options.model || 'nano-banana-2-4k'`
  - 正确支持贞贞工坊的 `nano-banana-2-4k` 模型
  - 保留了用户自定义模型的能力
- **影响**: 角色图片生成现在可以正常工作

### 2. 🎯 **模型名称标准化**
- 确保文本生成使用 `gemini-3-pro-preview-thinking-*`（带 `*` 后缀）
- 确保图像生成使用 `nano-banana-2-4k`（不带 `*` 后缀）
- 符合贞贞工坊API规范

---

## 🔍 **技术细节**

### 修改的函数

```javascript
/**
 * 调用 Banana2 图像生成 API（贞贞工坊）
 * @param {string} prompt - 图像生成提示词
 * @param {Object} options - 生成选项
 * @returns {Promise<string>} - 图像URL
 */
async function callBanana2ImageAPI(prompt, options = {}) {
    const apiKey = loadSettings().zhenzhenApiKey;
    if (!apiKey) {
        throw new Error('未配置贞贞工坊 API Key，请在设置中配置');
    }

    // ✅ 修复：使用 options.model 或默认 nano-banana-2-4k
    const model = options.model || 'nano-banana-2-4k';
    
    try {
        const response = await fetch(`${PROXY_ENDPOINT}/zhenzhen/images`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,  // ✅ 使用正确的模型
                prompt: prompt,
                n: 1,
                size: options.size || '1024x1024',
                quality: options.quality || 'standard',
                style: options.style || 'vivid'
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            // ✅ 增强错误处理，特别是401错误
            if (response.status === 401) {
                throw new Error(`API认证失败 (401): ${errorData.error?.message || '没有有效令牌'}。请检查API Key是否正确配置。`);
            }
            throw new Error(`Banana2 生图失败 (${response.status}): ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        if (!data.data?.[0]?.url) {
            throw new Error('生成的图片URL为空');
        }

        return data.data[0].url;
    } catch (error) {
        console.error('❌ Banana2 API调用失败:', error);
        throw error;
    }
}
```

---

## 🚀 **部署说明**

### 缓存破坏
- CSS: `?v=7.9.12&t=20251124004`
- JS: `?v=7.9.12&t=20251124004`

### 部署命令
```bash
cd ai-video-batch
vercel --prod
vercel alias set <deployment-url> www.lossloop.cn
```

---

## ✅ **测试清单**

- [ ] 贞贞工坊 API Key 配置正常
- [ ] 角色图片生成使用 `nano-banana-2-4k` 成功
- [ ] 文本生成使用 `gemini-3-pro-preview-thinking-*` 成功
- [ ] 错误信息正确显示（401、500等）
- [ ] 欢迎页显示正常
- [ ] 6步流程显示正确
- [ ] 全自动/半自动/手动模式正常切换
- [ ] Sora2提示词使用 `@` 标签格式

---

## 📝 **相关Issue**

- 修复 #issue-banana2-401: 贞贞工坊 API Key 无效错误
- 修复 #issue-model-500: 不支持的模型错误
- 优化 #feature-error-handling: 增强API错误处理

---

## 👥 **致谢**

感谢 GPT-5.1 通过 Zen MCP 提供的专家级诊断，准确定位了 `callBanana2ImageAPI` 的根本问题。

---

## 🔗 **相关文档**

- [贞贞工坊API文档](https://www.zzw.chat/)
- [V7.9.x 完整更新历史](./CHANGELOG_V7.9.X.md)

