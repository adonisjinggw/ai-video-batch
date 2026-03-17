/**
 * ========================================
 * 🔧 API 核心模块 (api-core.js)
 * ========================================
 * 
 * 提供 Skill 执行所需的核心 API 调用函数
 * 此模块可被 chat.html 等页面独立引用
 * 
 * 包含：
 * - callScriptGenerator - 剧本生成
 * - callModelScopeImageAPI - 魔塔图片生成
 * - callModelScopeTextAPI - 魔塔文本生成
 * - callSora2TextToVideoAPI - Sora2 文生视频
 * - callSora2ImageToVideoAPI - Sora2 图生视频
 * - 以及所有必需的辅助函数
 */

(function (global) {
    'use strict';

    // ==================== 🔧 基础工具函数 ====================

    /**
     * 🔗 检查是否为有效的媒体URL（支持 http(s) 和 data: URL）
     */
    function isValidMediaUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return url.startsWith('http') || url.startsWith('data:image/') || url.startsWith('data:video/');
    }

    /**
     * 延迟执行
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 🔐 获取当前用户ID（用于API调用时传递userId）
     */
    async function getCurrentUserId() {
        if (typeof NVAuth === 'undefined') return null;
        try {
            const user = await NVAuth.getCurrentUser();
            return user?.id || null;
        } catch (e) {
            console.warn('[getCurrentUserId] 获取用户ID失败:', e);
            return null;
        }
    }

    // 🔒 扣费会话控制：团队/技能执行期间跳过逐次扣费，由调用方一次性预扣
    let _billingSessionCount = 0;
    function startBillingSession() { _billingSessionCount++; console.log('[api-core] 🔒 扣费会话开始 count=' + _billingSessionCount); }
    function endBillingSession() { _billingSessionCount = Math.max(0, _billingSessionCount - 1); console.log('[api-core] 🔓 扣费会话结束 count=' + _billingSessionCount); }

    /**
     * 🔄 带重试的 API 调用
     */
    async function retryableAPICall(fn, optionsOrMaxRetries = {}, legacyRetryDelayMs) {
        const options = (typeof optionsOrMaxRetries === 'number')
            ? { maxRetries: optionsOrMaxRetries, retryDelayMs: legacyRetryDelayMs }
            : (optionsOrMaxRetries || {});
        const maxRetries = Number.isFinite(options.maxRetries) ? options.maxRetries : 3;
        const retryDelayMs = Number.isFinite(options.retryDelayMs) ? options.retryDelayMs : 3000;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn(attempt);
            } catch (e) {
                lastErr = e;
                if (e && e.name === 'AbortError') break;
                if (attempt >= maxRetries) break;
                await new Promise(r => setTimeout(r, retryDelayMs * attempt));
            }
        }
        throw lastErr || new Error('API调用失败');
    }

    /**
     * 🔍 检查用户是否为付费用户
     */
    function isPaidUser() {
        const filmBalance = parseFloat(localStorage.getItem('film_balance') || '0');
        const memberType = localStorage.getItem('membership_type');
        if (memberType && memberType !== 'free') return true;

        const vipInfo = localStorage.getItem('vip_info');
        if (vipInfo) {
            try {
                const parsed = JSON.parse(vipInfo);
                if (parsed.expiry && new Date(parsed.expiry) > new Date()) return true;
            } catch (e) {
                if (vipInfo.includes('pro') || vipInfo.includes('mid') || vipInfo.includes('basic') || vipInfo.includes('vip')) {
                    return true;
                }
            }
        }
        return filmBalance > 0;
    }

    /**
     * 🆓 检查免费用户是否可以使用某文本生成服务
     */
    function checkFreeUserTextProvider(provider) {
        if (isPaidUser()) return { allowed: true, message: '' };
        if (provider === 'gemini3' || provider === 'gemini') {
            return {
                allowed: false,
                message: 'Gemini3 是付费用户专属功能\n\n🆓 免费用户可使用：魔塔智能文本\n🎬 充值任意套餐即可解锁 Gemini3'
            };
        }
        return { allowed: true, message: '' };
    }

    /**
     * 🆓 检查免费用户访问权限（简化版）
     */
    function checkFreeUserAccess(featureType) {
        if (isPaidUser()) {
            return { blocked: false, useFirstTimeGift: false, useFreeAPI: false };
        }
        // 简化版：免费用户总是允许，具体额度由后端控制
        return { blocked: false, useFreeAPI: true, message: '使用免费额度' };
    }

    // ==================== 🔧 视频模型辅助函数 ====================

    function __normalizeVideoModelName(model) {
        const m = String(model || '').trim();
        const ml = m.toLowerCase();
        if (!ml) return 'sora-2-vip-all';
        if (ml === 'sora-2-vip-all') return 'sora-2-vip-all';
        // 🔧 旧 sora2 模型已停用，统一转换为过渡模型 sora-2-vip-all
        if (ml === 'sora2' || ml === 'sora-2' || ml === 'sora-2-hd' || ml === 'sora2-hd' || ml === 'sora-2-all') return 'sora-2-vip-all';
        if (ml === 'sora2pro' || ml === 'sora-2-pro' || ml === 'sora2-pro' || ml === 'sora-2-pro-all') return 'sora-2-vip-all';
        if (ml === 'sora-2-characters') return 'sora-2-vip-all';
        if (ml === 'veo3.1fast' || ml === 'veo-3.1fast' || ml === 'veo-3.1-fast') return 'veo3.1';
        if (ml === 'veo3.1' || ml === 'veo-3.1') return 'veo3.1';
        if (ml === 'veo3.1-pro' || ml === 'veo-3.1-pro' || ml === 'veo3.1pro') return 'veo3.1';
        if (ml === 'veo2' || ml === 'veo-2' || ml === 'veo2-fast' || ml === 'veo-2-fast') return 'veo2';
        if (ml === 'veo3' || ml === 'veo-3') return 'veo3';
        if (ml === 'grok3' || ml === 'grok-video-3' || ml === 'grok-video-3-text' || ml === 'grok-video-3-hd') return 'grok-video-3';
        if (ml.startsWith('vidu-') || ml.startsWith('hailuo-') || ml.startsWith('kling-')) return m;
        if (ml.startsWith('wan26-')) return m;
        return m;
    }

    function __getFixedClipDurationByModel(model, hd) {
        const m = __normalizeVideoModelName(model);
        if (m === 'sora-2-vip-all') return 10; // 过渡模型固定10秒
        if (m === 'sora-2-pro-all') {
            const wantHd = (typeof hd === 'undefined') ? true : !!hd;
            return wantHd ? 15 : 25;
        }
        if (m === 'grok-video-3') return 6;
        if (m === 'grok-video-3-10s') return 10;
        if (m === 'veo3.1' || m === 'veo3') return 8;
        if (m === 'veo2') return 8;
        if (String(m).startsWith('vidu-') || String(m).startsWith('kling-')) {
            const durationMatch = String(m).match(/-(\\d+)s[-$]/i) || String(m).match(/-(\\d+)s$/i);
            return durationMatch ? parseInt(durationMatch[1]) : 5;
        }
        if (String(m).startsWith('hailuo-')) {
            const durationMatch = String(m).match(/-(\\d+)s[-$]/i) || String(m).match(/-(\\d+)s$/i);
            return durationMatch ? parseInt(durationMatch[1]) : 6;
        }
        if (String(m).startsWith('wan26-')) {
            const durationMatch = String(m).match(/-(\d+)s/i);
            return durationMatch ? parseInt(durationMatch[1]) : 5;
        }
        if (String(m).startsWith('sora-2')) return 10;
        return 15;
    }

    function __isViduModel(model) {
        return model && String(model).toLowerCase().startsWith('vidu-');
    }

    function __isHailuoModel(model) {
        return model && String(model).toLowerCase().startsWith('hailuo-');
    }

    function __isKlingModel(model) {
        return model && String(model).toLowerCase().startsWith('kling-');
    }

    function __isWan26Model(model) {
        return model && String(model).toLowerCase().startsWith('wan26-');
    }

    function __parseWan26Model(model) {
        // wan26-720p-5s, wan26-1080p-10s-audio
        const match = String(model || '').match(/wan26-(720p|1080p)-(\d+)s(-audio)?/i);
        if (match) {
            return {
                resolution: match[1].toUpperCase(),
                duration: parseInt(match[2]),
                audio: !!match[3]
            };
        }
        return { resolution: '720P', duration: 5, audio: false };
    }

    function __parseViduModel(model) {
        const newMatch = String(model || '').match(/vidu-(q3-pro|q2-pro|q2-turbo|q2)-(\d+)s-(720p|1080p)/i);
        if (newMatch) {
            return {
                version: newMatch[1],
                duration: parseInt(newMatch[2]),
                resolution: newMatch[3].toUpperCase()
            };
        }
        const oldMatch = String(model || '').match(/vidu-(q3-pro|q2-pro|q2-turbo|q2)-(720p|1080p)/i);
        if (oldMatch) {
            return {
                version: oldMatch[1],
                duration: 5,
                resolution: oldMatch[2].toUpperCase()
            };
        }
        return { version: 'q2', duration: 5, resolution: '720P' };
    }

    function __parseHailuoModel(model) {
        const match = String(model || '').match(/hailuo-(02|fast)-(768p|1080p)-(\d+)s/i);
        if (match) {
            const versionMap = { '02': '02', 'fast': '2.3-fast' };
            return {
                version: versionMap[match[1].toLowerCase()] || match[1],
                resolution: match[2].toUpperCase(),
                duration: parseInt(match[3])
            };
        }
        return { version: '02', duration: 6, resolution: '768P' };
    }

    function __parseKlingModel(model) {
        const match = String(model || '').match(/kling-(o1|2\.5|2\.0|2\.1|1\.6)-(720p|1080p)-(\d+)s/i);
        if (match) {
            const version = match[1].toUpperCase() === 'O1' ? 'O1' : match[1];
            return {
                version: version,
                resolution: match[2].toUpperCase(),
                duration: parseInt(match[3])
            };
        }
        return { version: '2.5', duration: 5, resolution: '720P' };
    }

    // ==================== 📝 文本生成 API ====================

    /**
     * 📝 调用真臻文本 API（Gemini3）
     * 🔧 增加重试机制，解决 HTTP/2 连接空闲断开问题
     */
    async function callZhenzhenTextAPI(prompt, options = {}) {
        const model = options.model || 'gemini-3-pro-preview';
        const temperature = (typeof options.temperature === 'number') ? options.temperature : 0.7;
        const max_tokens = (typeof options.max_tokens === 'number') ? options.max_tokens : 4096;
        const speed = (typeof options.speed === 'number') ? options.speed : 1;

        if (!prompt) throw new Error('提示词为空');

        const paid = isPaidUser();
        if (!paid) {
            const access = checkFreeUserTextProvider('gemini3');
            if (!access || !access.allowed) {
                throw new Error((access && access.message) ? access.message : 'Gemini3 为付费用户专属功能');
            }
        }

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录后再使用此功能');

        // 🔧 内部请求函数（带重试）
        const maxRetries = 3;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let res;
            try {
                res = await fetch('/api/yunwu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'text',
                        prompt,
                        model,
                        temperature,
                        max_tokens,
                        speed,
                        userId,
                        skip_billing: _billingSessionCount > 0 || undefined
                    })
                });
            } catch (fetchErr) {
                lastErr = fetchErr;
                if (attempt < maxRetries) {
                    console.warn(`[ZhenzhenText] 网络错误第${attempt}次，重试中...`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(`文本生成网络错误: ${fetchErr.message}`);
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                // 🔧 服务器错误，重试
                if (res.status >= 500 && attempt < maxRetries) {
                    console.warn(`[ZhenzhenText] 服务器错误${res.status}，重试中...`);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(data.message || data.error || `文本生成失败: ${res.status}`);
            }
            const content = String(data.content || data.text || '').trim();
            if (!content) throw new Error('文本生成返回为空');
            return content;
        }
        throw lastErr || new Error('文本生成请求失败');
    }

    /**
     * 📝 调用魔塔文本 API
     */
    async function callModelScopeTextAPI(prompt) {
        let userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录后再使用此功能');

        const res = await fetch('/api/modelscope', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'text',
                prompt,
                userId
,
                skip_billing: _billingSessionCount > 0 || undefined
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            throw new Error(data.message || data.error || `ModelScope文本失败: ${res.status}`);
        }
        const content = String(data.content || '').trim();
        if (!content) throw new Error('ModelScope文本返回为空');
        return content;
    }

    /**
     * 📝 调用写作 LLM（兜底）
     * 🔧 增加重试机制，解决 HTTP/2 连接空闲断开问题
     */
    async function callWriterLLM(messages, opts = {}) {
        let userId = await getCurrentUserId();

        // 🧠 注入用户记忆到 system prompt
        if (typeof getUserMemoryPrompt === 'function' && Array.isArray(messages) && messages.length > 0) {
            const memPrompt = getUserMemoryPrompt();
            if (memPrompt && messages[0] && messages[0].role === 'system') {
                messages = messages.slice();
                messages[0] = { ...messages[0], content: memPrompt + '\n' + messages[0].content };
            }
        }

        const payload = {
            messages,
            userId,
            skip_billing: _billingSessionCount > 0 || undefined,
            model: opts.model || 'roll',
            temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.7,
            max_tokens: typeof opts.max_tokens === 'number' ? opts.max_tokens : 4096
        };

        // 🔧 内部请求函数（带重试）
        const maxRetries = 3;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let res;
            try {
                res = await fetch('/api/writer-llm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (fetchErr) {
                lastErr = fetchErr;
                if (attempt < maxRetries) {
                    console.warn(`[WriterLLM] 网络错误第${attempt}次，重试中...`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(`WriterLLM网络错误: ${fetchErr.message}`);
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.success === false) {
                // 🔧 服务器错误，重试
                if (res.status >= 500 && attempt < maxRetries) {
                    console.warn(`[WriterLLM] 服务器错误${res.status}，重试中...`);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(data?.message || data?.error || `writer-llm failed: ${res.status}`);
            }
            return String(data?.content || '').trim();
        }
        throw lastErr || new Error('WriterLLM请求失败');
    }

    /**
     * 📝 剧本生成器（自动选择最佳通道）
     */
    async function callScriptGenerator(idea, prompt) {
        // 🧠 注入用户记忆到 prompt 前
        if (typeof getUserMemoryPrompt === 'function') {
            const memPrompt = getUserMemoryPrompt();
            if (memPrompt && prompt) {
                prompt = memPrompt + '\n' + prompt;
            }
        }

        const s = (idea && idea.settings) ? idea.settings : {};
        const provider = String(s.scriptProvider || 'gemini3').trim().toLowerCase();
        const paid = isPaidUser();

        // 🆓 免费用户：默认走"魔塔/智能文本"通道
        const wantFreeText = (provider === 'motaverse') || (!paid && provider === 'gemini3');
        if (wantFreeText) {
            // 配额检查
            if (!paid) {
                const access = checkFreeUserAccess('modelscope_text');
                if (access && access.blocked) {
                    throw new Error(access.message || '今日免费文本额度已用完');
                }
            }

            // 1) 优先：ModelScope 文本
            try {
                const out = await retryableAPICall(() => callModelScopeTextAPI(prompt), 2, 2000);
                if (out) return out;
            } catch (e) { }

            // 2) 兜底：writer-llm
            try {
                const msg = [
                    { role: 'system', content: '你是中文短视频剧本/故事写作助手。请直接输出连贯的故事正文，不要解释。' },
                    { role: 'user', content: String(prompt || '') }
                ];
                const out = await retryableAPICall(() => callWriterLLM(msg, { temperature: 0.8, max_tokens: 4096 }), 2, 2000);
                if (out) return out;
            } catch (e) { }

            throw new Error('文本生成失败：免费通道不可用');
        }

        // 💎 付费用户 / Gemini3 高级通道
        const model = s.scriptModel || s.textModel || 'gemini-3-pro-preview';
        const temperature = (typeof s.scriptTemperature === 'number') ? s.scriptTemperature : 0.8;
        const max_tokens = (typeof s.scriptMaxTokens === 'number') ? s.scriptMaxTokens : 4096;
        const speed = (typeof s.scriptSpeed === 'number') ? s.scriptSpeed : 1;
        return await retryableAPICall(() => callZhenzhenTextAPI(prompt, { model, temperature, max_tokens, speed }), 2, 2500);
    }

    // ==================== 🎨 图片生成 API ====================

    /**
     * 🎨 调用魔塔图片 API
     * 🔧 与 AI 画图页面一致：移除前端超时，让请求自然完成
     * 🔧 增加重试机制，解决 HTTP/2 连接空闲断开问题
     */
    async function callModelScopeImageAPI(prompt, options = {}) {
        const aspectRatio = options.aspectRatio || '1:1';
        const refImage = options.refImage;
        const refImages = options.refImages;
        const skipDeduct = options.skipDeduct || false;

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录后再使用此功能');

        let imageUrls = undefined;
        let action = 'image';

        if (refImages && Array.isArray(refImages) && refImages.length >= 2) {
            imageUrls = refImages.slice(0, 3);
            action = 'image2image';
            console.log(`🎭 [万象Max] 多图编辑模式: ${imageUrls.length}张参考图`);
        } else if (refImage) {
            imageUrls = [refImage];
            action = 'image2image';
        }

        // 🔧 内部请求函数（带重试）
        const maxRetries = 3;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let msRes;
            try {
                // 🔧 移除 signal，让请求自然完成（与 AI 画图页面一致）
                msRes = await fetch('/api/modelscope', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action,
                        prompt,
                        aspectRatio,
                        imageUrls,
                        userId,
                        skip_billing: _billingSessionCount > 0 || undefined
                    })
                });
            } catch (fetchErr) {
                lastErr = fetchErr;
                // 🔧 HTTP/2 连接断开或网络错误，重试
                if (attempt < maxRetries) {
                    console.warn(`[ModelScope] 网络错误第${attempt}次，重试中...`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(`ModelScope网络错误: ${fetchErr.message}`);
            }
            const res = msRes;
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                // 🔧 服务器错误，重试
                if (res.status >= 500 && attempt < maxRetries) {
                    console.warn(`[ModelScope] 服务器错误${res.status}，重试中...`);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(data.message || data.error || `ModelScope失败: ${res.status}`);
            }
            const img = (data.images && data.images[0]) ? data.images[0] : null;
            if (!img) throw new Error('ModelScope 未返回图片');
            return img;
        }
        throw lastErr || new Error('ModelScope请求失败');
    }

    /**
     * 🎬 调用魔塔视频生成 API
     */
    async function callModelScopeVideoAPI(prompt, options = {}) {
        const aspectRatio = options.aspectRatio || '16:9';
        const duration = options.duration || 5;
        const model = options.model;

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录后再使用此功能');

        // 🔧 内部请求函数（带重试）
        const maxRetries = 2;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const msRes = await fetch('/api/modelscope', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'video',
                        prompt,
                        aspectRatio,
                        duration,
                        model,
                        userId,
                        skip_billing: _billingSessionCount > 0 || undefined
                    })
                });
                const data = await msRes.json().catch(() => ({}));
                if (!msRes.ok || !data.success) {
                    throw new Error(data.message || data.error || `ModelScope视频失败: ${msRes.status}`);
                }
                const video = (data.videos && data.videos[0]) ? data.videos[0] : null;
                if (!video) throw new Error('ModelScope 未返回视频');
                return video;
            } catch (fetchErr) {
                lastErr = fetchErr;
                if (attempt < maxRetries) {
                    console.warn(`[ModelScope Video] 网络错误第${attempt}次，重试中...`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 3000 * attempt));
                    continue;
                }
                throw lastErr;
            }
        }
        throw lastErr || new Error('ModelScope视频请求失败');
    }

    /**
     * 🎬 调用魔塔图生视频 API
     */
    async function callModelScopeImageToVideoAPI(prompt, imageUrls, options = {}) {
        const aspectRatio = options.aspectRatio || '16:9';
        const duration = options.duration || 5;
        const model = options.model;

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录后再使用此功能');

        // 🔧 内部请求函数（带重试）
        const maxRetries = 2;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const msRes = await fetch('/api/modelscope', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'image2video',
                        prompt,
                        imageUrls: Array.isArray(imageUrls) ? imageUrls : [imageUrls],
                        aspectRatio,
                        duration,
                        model,
                        userId,
                        skip_billing: _billingSessionCount > 0 || undefined
                    })
                });
                const data = await msRes.json().catch(() => ({}));
                if (!msRes.ok || !data.success) {
                    throw new Error(data.message || data.error || `ModelScope图生视频失败: ${msRes.status}`);
                }
                const video = (data.videos && data.videos[0]) ? data.videos[0] : null;
                if (!video) throw new Error('ModelScope 未返回视频');
                return video;
            } catch (fetchErr) {
                lastErr = fetchErr;
                if (attempt < maxRetries) {
                    console.warn(`[ModelScope I2V] 网络错误第${attempt}次，重试中...`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 3000 * attempt));
                    continue;
                }
                throw lastErr;
            }
        }
        throw lastErr || new Error('ModelScope图生视频请求失败');
    }

    /**
     * 🎨 调用 Banana2 图片 API
     * 🔧 与 AI 画图页面一致：移除前端超时，让请求自然完成
     * 🔧 增加重试机制，解决 HTTP/2 连接空闲断开问题
     */
    async function callBanana2ImageAPI(prompt, options = {}) {
        let userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录后再使用此功能');

        // 🔧 参考图兼容：支持单图和多图
        const refImageUrl = options.imageUrl || options.image_url || options.refImage || undefined;
        const refImagesArr = options.refImages || options.image_urls || undefined;

        const model = options.model || 'nano-banana-2';

        // 🔧 内部请求函数（带重试）
        const maxRetries = 3;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let res;
            try {
                const body = {
                    prompt,
                    model,
                    aspect_ratio: options.aspectRatio || options.aspect_ratio || '16:9',
                    userId,
                    skip_billing: _billingSessionCount > 0 || undefined
                };
                // 多参考图优先，否则单图
                if (refImagesArr && Array.isArray(refImagesArr) && refImagesArr.length > 0) {
                    body.image_urls = refImagesArr;
                } else if (refImageUrl) {
                    body.image_url = refImageUrl;
                }
                // 🔧 移除 signal，让请求自然完成（与 AI 画图页面一致）
                res = await fetch('/api/banana2', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            } catch (fetchErr) {
                lastErr = fetchErr;
                // 🔧 HTTP/2 连接断开或网络错误，重试
                if (attempt < maxRetries) {
                    console.warn(`[Banana2] 网络错误第${attempt}次，重试中...`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(`Banana2网络错误: ${fetchErr.message}`);
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                // 🔧 服务器错误，重试
                if (res.status >= 500 && attempt < maxRetries) {
                    console.warn(`[Banana2] 服务器错误${res.status}，重试中...`);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(data.message || data.error || `Banana2失败: ${res.status}`);
            }
            const img = data.url || (data.urls && data.urls[0]) || (data.data && data.data[0] && data.data[0].url);
            if (!img) throw new Error('Banana2 未返回图片');
            return img;
        }
        throw lastErr || new Error('Banana2请求失败');
    }

    // ==================== 🎬 视频生成 API ====================

    /**
     * 🌊 轮询 Wan2.6 任务状态（alibailian API）
     */
    async function pollWan26Task(taskId) {
        const maxAttempts = 300;
        for (let i = 0; i < maxAttempts; i++) {
            await sleep(3000);
            try {
                const res = await fetch('/api/yunwu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'wan26-poll', task_id: taskId })
                });
                if (!res.ok) {
                    console.warn(`⚠️ Wan2.6轮询请求失败: ${res.status} (${i + 1}/${maxAttempts})`);
                    continue;
                }
                const data = await res.json();
                const status = String(data.status || '').toUpperCase();

                if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'DONE') {
                    const videoUrl = data.video_url || data.url || data?.output?.video_url;
                    if (videoUrl) {
                        console.log(`✅ Wan2.6任务完成: ${taskId}`);
                        return videoUrl;
                    }
                    throw new Error('Wan2.6任务完成但未找到视频URL');
                }
                if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELED') {
                    const errorMsg = data.error || data.message || data?.output?.message || '未知错误';
                    throw new Error(`Wan2.6视频生成失败: ${errorMsg}`);
                }
                if (i === 0 || ((i + 1) % 10 === 0)) {
                    console.log(`⏳ Wan2.6任务进行中... (${i + 1}/${maxAttempts})`);
                }
            } catch (pollError) {
                if (pollError.message.includes('生成失败')) throw pollError;
                console.warn(`⚠️ Wan2.6轮询异常: ${pollError.message}`);
            }
        }
        throw new Error('Wan2.6视频生成超时（已等待15分钟）');
    }

    /**
     * 🔄 轮询 Sora2 任务状态
     */
    async function pollSora2Task(taskId, options = {}) {
        const maxAttempts = 300;
        const { _source, _endpoint } = options;

        for (let i = 0; i < maxAttempts; i++) {
            await sleep(3000);

            try {
                const res = await fetch('/api/sora2', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'poll',
                        task_id: taskId,
                        _source,
                        _endpoint
                    })
                });

                if (!res.ok) {
                    console.warn(`⚠️ 轮询请求失败: ${res.status} (${i + 1}/${maxAttempts})`);
                    continue;
                }

                const data = await res.json();
                const status = (data.status || data.state || data.task_status || '').toUpperCase();

                if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'DONE') {
                    console.log(`✅ Sora2任务完成: ${taskId}`);
                    const videoUrl =
                        data.video_url ||
                        data.videoUrl ||
                        data.url ||
                        data.data?.output ||
                        data.data?.video_url ||
                        data.data?.url ||
                        (Array.isArray(data.data) && data.data[0]?.url) ||
                        (Array.isArray(data.data) && data.data[0]?.video_url) ||
                        data.result?.url ||
                        data.result?.video_url;

                    if (videoUrl) return videoUrl;
                    throw new Error('任务完成但未找到视频URL');
                }

                if (status === 'FAILURE' || status === 'FAILED' || status === 'ERROR' || status === 'FAIL' || status === 'CANCELLED' || status === 'CANCELED') {
                    const errorMsg = data.fail_reason || data.error || data.message || data.error_message || data.detail || '未知错误';
                    throw new Error(`视频生成失败: ${errorMsg}`);
                }

                if (data.data?.status && ['FAILURE', 'FAILED', 'ERROR', 'FAIL'].includes(String(data.data.status).toUpperCase())) {
                    const errorMsg = data.data.fail_reason || data.data.error || data.data.message || '任务执行失败';
                    throw new Error(`视频生成失败: ${errorMsg}`);
                }

                if (i === 0 || ((i + 1) % 10 === 0)) {
                    console.log(`⏳ Sora2任务进行中... (${i + 1}/${maxAttempts})`);
                }

            } catch (pollError) {
                if (pollError.message.includes('视频生成失败')) throw pollError;
                console.warn(`⚠️ 轮询异常: ${pollError.message}`);
            }
        }

        throw new Error('视频生成超时（已等待15分钟），服务器可能繁忙，请稍后重试');
    }

    /**
     * 🎬 Sora2 文生视频 API
     */
    async function callSora2TextToVideoAPI(prompt, options = {}) {
        const { model = 'sora-2-all', aspectRatio = '16:9', duration = 15, hd, key_value, video_url, character_username, character_usernames, character_url, character_timestamps, input_reference, style } = options;

        const _m = __normalizeVideoModelName(model);
        const _hd = (_m === 'sora-2-pro-all') ? ((typeof hd === 'undefined') ? true : !!hd) : !!hd;
        const _dur = __getFixedClipDurationByModel(_m, _hd);

        console.log(`🏞️ [视频] 跳过前端预扣费，由后端统一扣费`);

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录后再使用此功能');

        // 🎬 Vidu 模型
        if (__isViduModel(_m)) {
            const viduParams = __parseViduModel(_m);
            console.log(`🎬 [Vidu] 使用 yunwu API, version=${viduParams.version}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'vidu',
                    prompt,
                    model_version: viduParams.version,
                    aspect_ratio: aspectRatio,
                    duration: parseInt(_dur) || 5,
                    resolution: viduParams.resolution,
                    userId
,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Vidu失败: ${res.status}`);

            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollSora2Task(data.task_id || data.id, { _source: data._source || 'yunwu', _endpoint: data._endpoint, isVidu: true });
            }
            throw new Error('未返回视频URL或task_id');
        }

        // 🐚 Hailuo 模型
        if (__isHailuoModel(_m)) {
            const hailuoParams = __parseHailuoModel(_m);
            console.log(`🐚 [Hailuo] 使用 yunwu API, version=${hailuoParams.version}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'hailuo',
                    prompt,
                    model_version: hailuoParams.version,
                    duration: hailuoParams.duration,
                    resolution: hailuoParams.resolution,
                    userId
,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Hailuo失败: ${res.status}`);

            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollSora2Task(data.task_id || data.id, { _source: data._source || 'yunwu', _endpoint: data._endpoint, isVidu: true });
            }
            throw new Error('未返回视频URL或task_id');
        }

        // ✨ Kling 模型
        if (__isKlingModel(_m)) {
            const klingParams = __parseKlingModel(_m);
            console.log(`✨ [Kling] 使用 yunwu API, version=${klingParams.version}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'kling',
                    prompt,
                    model_version: klingParams.version,
                    aspect_ratio: aspectRatio,
                    duration: klingParams.duration,
                    resolution: klingParams.resolution,
                    userId
,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Kling失败: ${res.status}`);

            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollSora2Task(data.task_id || data.id, { _source: data._source || 'yunwu', _endpoint: data._endpoint, isVidu: true });
            }
            throw new Error('未返回视频URL或task_id');
        }

        // 默认 Sora2
        const res = await fetch('/api/sora2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'text-to-video',
                prompt,
                model: _m,
                duration: parseInt(_dur) || 15,
                aspect_ratio: aspectRatio,
                hd: !!_hd,
                key_value,
                video_url,
                character_username,
                character_usernames,
                character_url,
                character_timestamps,
                input_reference,
                style,
                userId
,
                skip_billing: _billingSessionCount > 0 || undefined
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || `Sora2失败: ${res.status}`);

        if (data.url) return data.url;
        if (!data.task_id) throw new Error('未返回 task_id');
        return await pollSora2Task(data.task_id, { _source: data._source, _endpoint: data._endpoint });
    }

    /**
     * 🎬 Sora2 图生视频 API
     */
    async function callSora2ImageToVideoAPI(imageUrl, prompt, options = {}) {
        const { model = 'sora-2', aspectRatio = '16:9', duration = 15, hd, key_value, video_url, character_username, character_usernames, character_url, character_timestamps, style } = options;

        const _m = __normalizeVideoModelName(model);
        const _hd = (_m === 'sora-2-pro-all') ? ((typeof hd === 'undefined') ? true : !!hd) : !!hd;
        const _dur = __getFixedClipDurationByModel(_m, _hd);

        console.log(`🎞️ [图生视频] 跳过前端预扣费，由后端统一扣费`);

        // 强制参考图约束
        const imageRefPrefix = `[CRITICAL IMAGE REFERENCE: The uploaded reference image MUST be the primary visual source. Strictly maintain ALL visual elements from the reference image: exact face features, hairstyle, hair color, clothing, accessories, body proportions, art style, color palette. The video must look like the reference image came to life with motion. Do NOT generate new characters or change the visual style. Only add natural movement and animation to the existing image content.] `;
        const enhancedPrompt = imageRefPrefix + (prompt || 'Animate this image with natural movement');

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录后再使用此功能');

        // 🌊 Wan2.6 图生视频（专用 alibailian API）
        if (__isWan26Model(_m)) {
            const wan26Params = __parseWan26Model(_m);
            console.log(`🌊 [Wan2.6] 使用 yunwu alibailian API, resolution=${wan26Params.resolution}, duration=${wan26Params.duration}, audio=${wan26Params.audio}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'wan26',
                    prompt: prompt || 'Animate this image with natural movement',
                    img_url: imageUrl,
                    resolution: wan26Params.resolution,
                    duration: wan26Params.duration,
                    audio: wan26Params.audio,
                    userId,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Wan2.6失败: ${res.status}`);

            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollWan26Task(data.task_id || data.id);
            }
            throw new Error('Wan2.6未返回视频URL或task_id');
        }

        // 🎬 Vidu 图生视频
        if (__isViduModel(_m)) {
            const viduParams = __parseViduModel(_m);
            console.log(`🎬 [Vidu I2V] 使用 yunwu API, version=${viduParams.version}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'vidu',
                    prompt: prompt || 'Animate this image with natural movement',
                    image_url: imageUrl,
                    model_version: viduParams.version,
                    aspect_ratio: aspectRatio,
                    duration: parseInt(_dur) || 5,
                    resolution: viduParams.resolution,
                    userId,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Vidu失败: ${res.status}`);
            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollSora2Task(data.task_id || data.id, { _source: data._source || 'yunwu', _endpoint: data._endpoint, isVidu: true });
            }
            throw new Error('未返回视频URL或task_id');
        }

        // 🐚 Hailuo 图生视频
        if (__isHailuoModel(_m)) {
            const hailuoParams = __parseHailuoModel(_m);
            console.log(`🐚 [Hailuo I2V] 使用 yunwu API, version=${hailuoParams.version}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'hailuo',
                    prompt: prompt || 'Animate this image with natural movement',
                    image_url: imageUrl,
                    model_version: hailuoParams.version,
                    duration: hailuoParams.duration,
                    resolution: hailuoParams.resolution,
                    userId,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Hailuo失败: ${res.status}`);
            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollSora2Task(data.task_id || data.id, { _source: data._source || 'yunwu', _endpoint: data._endpoint, isVidu: true });
            }
            throw new Error('未返回视频URL或task_id');
        }

        // ✨ Kling 图生视频
        if (__isKlingModel(_m)) {
            const klingParams = __parseKlingModel(_m);
            console.log(`✨ [Kling I2V] 使用 yunwu API, version=${klingParams.version}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'kling',
                    prompt: prompt || 'Animate this image with natural movement',
                    image_url: imageUrl,
                    model_version: klingParams.version,
                    aspect_ratio: aspectRatio,
                    duration: klingParams.duration,
                    resolution: klingParams.resolution,
                    userId,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Kling失败: ${res.status}`);
            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollSora2Task(data.task_id || data.id, { _source: data._source || 'yunwu', _endpoint: data._endpoint, isVidu: true });
            }
            throw new Error('未返回视频URL或task_id');
        }

        // 默认 Sora2 图生视频
        const res = await fetch('/api/sora2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'image-to-video',
                image_url: imageUrl,
                prompt: enhancedPrompt,
                model: _m,
                duration: parseInt(_dur) || 15,
                aspect_ratio: aspectRatio,
                hd: !!_hd,
                key_value,
                video_url,
                character_username,
                character_usernames,
                character_url,
                character_timestamps,
                style,
                userId,
                skip_billing: _billingSessionCount > 0 || undefined
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || `Sora2失败: ${res.status}`);

        if (data.url) return data.url;
        if (!data.task_id) throw new Error('未返回 task_id');
        return await pollSora2Task(data.task_id, { _source: data._source, _endpoint: data._endpoint });
    }

    /**
     * 🎬 便捷函数：文生视频
     */
    async function callSora2TextToVideo(prompt, model, options = {}) {
        return await callSora2TextToVideoAPI(prompt, { ...(options || {}), model: model || options.model || 'sora-2' });
    }

    /**
     * 🎬 便捷函数：图生视频
     */
    async function callSora2ImageToVideo(prompt, lastFrameUrl, model, options = {}) {
        return await callSora2ImageToVideoAPI(lastFrameUrl, prompt, { ...(options || {}), model: model || options.model || 'sora-2' });
    }

    // ==================== 📚 角色库/素材库保存函数 ====================

    /**
     * 📚 保存角色到角色库
     * @param {string} name - 角色名称
     * @param {string} summary - 角色描述
     * @param {string} posterUrl - 角色图片URL
     * @param {string} videoUrl - 角色视频URL（可选）
     * @param {string} turnaroundUrl - 三视图URL（可选）
     */
    function saveCharacterToLibrary(name, summary, posterUrl, videoUrl, turnaroundUrl) {
        try {
            if (!name || typeof name !== 'string') {
                console.error('[api-core] 角色名称无效');
                return false;
            }

            // 验证至少有一个有效的图片/视频URL
            const hasValidImage = isValidMediaUrl(posterUrl);
            const hasValidVideo = isValidMediaUrl(videoUrl);
            if (!hasValidImage && !hasValidVideo) {
                console.warn(`[api-core] 角色「${name}」没有有效的图片或视频URL, 仍然保存但可能显示为空`);
            }

            // ⚠️ base64 图片太大，跳过 localStorage 保存
            const isBase64 = (posterUrl && posterUrl.startsWith('data:')) || (videoUrl && videoUrl.startsWith('data:'));
            if (isBase64) {
                console.warn(`[api-core] 角色「${name}」图片为 base64 格式，跳过本地库保存，仅在聊天中展示`);
                return true;
            }

            // 📱 保存到手机版角色库 (library_chars)
            try {
                let mobileLib = [];
                try {
                    mobileLib = JSON.parse(localStorage.getItem('library_chars') || '[]');
                    if (!Array.isArray(mobileLib)) mobileLib = [];
                } catch (e) { mobileLib = []; }

                const mobileExistingIdx = mobileLib.findIndex(c => c.name === name);
                const mobileChar = {
                    name: name,
                    desc: summary || '',
                    image: posterUrl || '',
                    video: videoUrl || ''
                };
                
                if (mobileExistingIdx >= 0) {
                    mobileLib[mobileExistingIdx] = mobileChar;
                } else {
                    mobileLib.push(mobileChar);
                }
                localStorage.setItem('library_chars', JSON.stringify(mobileLib));
                console.log(`✅ [api-core] 角色「${name}」已保存到手机版角色库`);
            } catch (e) {
                console.warn('[api-core] 保存到手机版角色库失败:', e);
            }

            // 💻 保存到PC版角色库 (character_library)
            try {
                let pcLib = [];
                try {
                    pcLib = JSON.parse(localStorage.getItem('character_library') || '[]');
                    if (!Array.isArray(pcLib)) pcLib = [];
                } catch (e) { pcLib = []; }

                const pcExistingIdx = pcLib.findIndex(c => c.name === name);
                const pcChar = {
                    name: name,
                    summary: summary || '',
                    imageUrl: posterUrl || '',
                    videoUrl: videoUrl || '',
                    variants: {
                        poster: posterUrl || '',
                        turnaround: turnaroundUrl || ''
                    }
                };
                
                if (pcExistingIdx >= 0) {
                    pcLib[pcExistingIdx] = pcChar;
                } else {
                    pcLib.push(pcChar);
                }
                localStorage.setItem('character_library', JSON.stringify(pcLib));
                console.log(`✅ [api-core] 角色「${name}」已保存到PC版角色库`);
            } catch (e) {
                console.warn('[api-core] 保存到PC版角色库失败:', e);
            }

            return true;
        } catch (err) {
            console.error('❌ [api-core] 保存角色失败:', err);
            return false;
        }
    }

    /**
     * 🔧 压缩 base64 图片并保存到本地库（异步）
     * 将大尺寸 base64 图片压缩为缩略图后存入 localStorage
     */
    function _compressAndSaveBase64Image(base64Url, title, category) {
        try {
            const img = new Image();
            img.onload = function () {
                try {
                    const canvas = document.createElement('canvas');
                    const MAX_W = 400;
                    const scale = Math.min(1, MAX_W / img.width);
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.65);
                    console.log(`[api-core] ✅ base64压缩: ${(base64Url.length / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB`);

                    // 保存到 library_scenes
                    try {
                        let lib = JSON.parse(localStorage.getItem('library_scenes') || '[]');
                        if (!Array.isArray(lib)) lib = [];
                        lib.unshift({
                            name: title || '技能生成图片',
                            desc: category || 'skill',
                            image: compressed,
                            createdAt: Date.now()
                        });
                        if (lib.length > 80) lib = lib.slice(0, 80);
                        localStorage.setItem('library_scenes', JSON.stringify(lib));
                        console.log(`[api-core] ✅ 压缩图已保存到素材库: ${title}`);
                    } catch (e) {
                        console.warn('[api-core] 压缩图保存到 library_scenes 失败:', e.message);
                    }

                    // 保存到 material_library
                    try {
                        let mlib = JSON.parse(localStorage.getItem('material_library') || '[]');
                        if (!Array.isArray(mlib)) mlib = [];
                        mlib.push({
                            id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            type: 'image',
                            url: compressed,
                            title: title || '技能生成图片',
                            category: category || 'skill',
                            createdAt: new Date().toISOString()
                        });
                        if (mlib.length > 80) mlib = mlib.slice(-80);
                        localStorage.setItem('material_library', JSON.stringify(mlib));
                    } catch (e) { }
                } catch (e) {
                    console.warn('[api-core] base64压缩绘制失败:', e.message);
                }
            };
            img.onerror = function () {
                console.warn('[api-core] base64图片加载失败，无法压缩保存');
            };
            img.src = base64Url;
        } catch (e) {
            console.warn('[api-core] _compressAndSaveBase64Image 异常:', e.message);
        }
    }

    /**
     * 🖼️ 保存图片到素材库
     * @param {string} url - 图片URL
     * @param {string} title - 图片标题
     * @param {string} category - 分类（可选）
     */
    function saveImageToLibrary(url, title, category) {
        try {
            if (!isValidMediaUrl(url)) {
                console.error('[api-core] 图片URL无效:', typeof url === 'string' ? url.substring(0, 80) : url);
                return false;
            }

            // 🔧 base64 图片：压缩为缩略图后异步保存（解决大图无法存储的问题）
            if (url.startsWith('data:')) {
                const sizeKB = (url.length / 1024).toFixed(0);
                console.log(`[api-core] 图片为 base64 格式(${sizeKB}KB)，压缩后保存: ${title}`);
                _compressAndSaveBase64Image(url, title, category);
                return true;
            }

            // 📱 保存到素材库页面使用的格式 (library_scenes)
            try {
                let lib = [];
                try {
                    lib = JSON.parse(localStorage.getItem('library_scenes') || '[]');
                    if (!Array.isArray(lib)) lib = [];
                } catch (e) { lib = []; }

                // 检查是否已存在
                if (!lib.some(item => item.image === url)) {
                    lib.unshift({
                        name: title || '技能生成图片',
                        desc: category || 'skill',
                        image: url,
                        createdAt: Date.now()
                    });
                    localStorage.setItem('library_scenes', JSON.stringify(lib));
                    console.log(`✅ [api-core] 图片已保存到素材库(library_scenes): ${title || url.substring(0, 50)}`);
                }
            } catch (e) {
                console.warn('[api-core] 保存到 library_scenes 失败:', e);
            }

            // 也保存到通用素材库 (material_library) 以便后续扩展
            try {
                let lib = [];
                try {
                    lib = JSON.parse(localStorage.getItem('material_library') || '[]');
                    if (!Array.isArray(lib)) lib = [];
                } catch (e) { lib = []; }

                if (!lib.some(item => item.url === url)) {
                    lib.push({
                        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        type: 'image',
                        url: url,
                        title: title || '技能生成图片',
                        category: category || 'skill',
                        createdAt: new Date().toISOString()
                    });
                    localStorage.setItem('material_library', JSON.stringify(lib));
                }
            } catch (e) { }

            return true;
        } catch (err) {
            console.error('❌ [api-core] 保存图片失败:', err);
            return false;
        }
    }

    /**
     * 🎬 保存视频到素材库
     * @param {string} url - 视频URL
     * @param {string} title - 视频标题
     * @param {string} category - 分类（可选）
     * @param {string} thumbnailUrl - 缩略图URL（可选）
     */
    function saveVideoToLibrary(url, title, category, thumbnailUrl) {
        try {
            if (!isValidMediaUrl(url)) {
                console.error('[api-core] 视频URL无效:', typeof url === 'string' ? url.substring(0, 80) : url);
                return false;
            }

            // 📱 保存到素材库页面使用的格式 (library_scenes) - 视频也可以放在这里
            try {
                let lib = [];
                try {
                    lib = JSON.parse(localStorage.getItem('library_scenes') || '[]');
                    if (!Array.isArray(lib)) lib = [];
                } catch (e) { lib = []; }

                // 检查是否已存在
                if (!lib.some(item => item.video === url || item.image === url)) {
                    lib.unshift({
                        name: title || '技能生成视频',
                        desc: category || 'skill',
                        image: thumbnailUrl || '',  // 缩略图
                        video: url,  // 视频URL
                        createdAt: Date.now()
                    });
                    localStorage.setItem('library_scenes', JSON.stringify(lib));
                    console.log(`✅ [api-core] 视频已保存到素材库(library_scenes): ${title || url.substring(0, 50)}`);
                }
            } catch (e) {
                console.warn('[api-core] 保存到 library_scenes 失败:', e);
            }

            // 也保存到通用素材库 (material_library)
            try {
                let lib = [];
                try {
                    lib = JSON.parse(localStorage.getItem('material_library') || '[]');
                    if (!Array.isArray(lib)) lib = [];
                } catch (e) { lib = []; }

                if (!lib.some(item => item.url === url)) {
                    lib.push({
                        id: 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        type: 'video',
                        url: url,
                        thumbnailUrl: thumbnailUrl || '',
                        title: title || '技能生成视频',
                        category: category || 'skill',
                        createdAt: new Date().toISOString()
                    });
                    localStorage.setItem('material_library', JSON.stringify(lib));
                }
            } catch (e) { }

            return true;
        } catch (err) {
            console.error('❌ [api-core] 保存视频失败:', err);
            return false;
        }
    }

    // ==================== 🎨 Midjourney 图片生成 ====================

    /**
     * 🎨 调用 Midjourney 图片 API（通过 yunwu 后端）
     * 返回单张图片URL（自动取网格图，适用于技能/智能团队场景）
     * 🔧 与 AI 画图页面一致：移除前端超时，让请求自然完成
     * 🔧 增加重试机制，解决 HTTP/2 连接空闲断开问题
     */
    async function callMidjourneyImageAPI(prompt, options = {}) {
        const model = options.model || 'midjourney-fast';
        const aspectRatio = options.aspectRatio || options.aspect_ratio || '16:9';
        const version = options.version || '6.1';
        const image_url = options.refImage || options.image_url || undefined;

        const paid = isPaidUser();
        if (!paid) throw new Error('Midjourney 为付费功能，请先充值胶片');

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录后再使用此功能');

        // 🔧 内部请求函数（带重试）
        const maxRetries = 3;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let res;
            try {
                // 🔧 移除 signal，让请求自然完成（与 AI 画图页面一致）
                res = await fetch('/api/yunwu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'midjourney',
                        prompt,
                        model,
                        aspect_ratio: aspectRatio,
                        version,
                        image_url,
                        userId,
                        skip_billing: _billingSessionCount > 0 || undefined
                    })
                });
            } catch (fetchErr) {
                lastErr = fetchErr;
                // 🔧 HTTP/2 连接断开或网络错误，重试
                if (attempt < maxRetries) {
                    console.warn(`[Midjourney] 网络错误第${attempt}次，重试中...`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(`Midjourney网络错误: ${fetchErr.message}`);
            }

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                // 🔧 服务器错误，重试
                if (res.status >= 500 && attempt < maxRetries) {
                    console.warn(`[Midjourney] 服务器错误${res.status}，重试中...`);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(data.message || data.error || `Midjourney失败: ${res.status}`);
            }

            const imageUrl = data.imageUrl || data.url || '';
            if (!imageUrl) throw new Error('Midjourney 未返回图片URL');

            console.log(`🎨 [api-core MJ] 生成成功: ${imageUrl.substring(0, 80)}`);
            return imageUrl;
        }
        throw lastErr || new Error('Midjourney请求失败');
    }

    // ==================== 🔍 OCR 文字识别 ====================

    /**
     * 🔍 调用 OCR 识别图片中的文字
     * @param {string} imageUrl - 图片URL或base64
     * @param {string} prompt - 提示词（可选，默认识别所有文字）
     * @param {string} model - 模型（默认 deepseek-ocr）
     * @returns {Promise<string>} 识别到的文字
     */
    async function callOCRAPI(imageUrl, prompt, model) {
        if (!imageUrl) throw new Error('缺少图片');
        const ocrPrompt = prompt || '请识别并输出这张图片中的所有文字内容，保持原始格式。';
        let userId = await getCurrentUserId();

        const res = await fetch('/api/yunwu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'vision',
                model: model || 'deepseek-ocr',
                prompt: ocrPrompt,
                image_url: imageUrl,
                userId,
                skip_billing: _billingSessionCount > 0 || undefined
            })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            throw new Error(data.message || data.error || 'OCR识别失败');
        }
        return data.text || '';
    }

    // ==================== 🎤 TTS 配音 ====================

    /**
     * 🎤 调用 TTS 配音 API
     * @param {string} text - 要配音的文本
     * @param {object} options - { engine: 'gemini'|'kling'|'dubbingx', voiceId, model, emotion, speed }
     * @returns {Promise<string>} 音频URL
     */
    async function callTTSAPI(text, options = {}) {
        if (!text) throw new Error('缺少配音文本');
        let userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录后再使用此功能');

        const engine = options.engine || 'gemini';

        // Gemini TTS（最快最便宜，直接返回音频）
        if (engine === 'gemini') {
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'gemini-tts',
                    text,
                    voiceName: options.voiceId || options.voiceName || 'Kore',
                    model: options.model || 'flash',
                    userId
,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.message || data.error || 'Gemini TTS失败');
            // Gemini TTS 返回 audioData(base64)，需要转换为 data URL
            if (data.audioData) {
                const mime = data.mimeType || 'audio/wav';
                return `data:${mime};base64,${data.audioData}`;
            }
            return data.audioUrl || data.audio_url || '';
        }

        // Kling TTS
        if (engine === 'kling') {
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'kling-tts',
                    text,
                    voiceId: options.voiceId || 'genshin_vindi2',
                    voiceSpeed: options.speed || 1,
                    userId
,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.message || data.error || 'Kling TTS失败');
            // 如果直接返回 audioUrl
            if (data.audioUrl) return data.audioUrl;
            // 否则需要轮询
            if (data.taskId) {
                console.log(`🎤 [api-core] Kling TTS 开始轮询 taskId=${data.taskId}`);
                let failCount = 0;
                for (let i = 0; i < 90; i++) {
                    await sleep(2000);
                    try {
                        const pr = await fetch('/api/yunwu', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'kling-tts-poll', taskId: data.taskId })
                        });
                        const pd = await pr.json().catch(() => ({}));
                        
                        // 成功获取音频URL
                        if (pd.audioUrl) {
                            console.log(`✅ [api-core] Kling TTS 完成: ${pd.audioUrl.substring(0, 80)}`);
                            return pd.audioUrl;
                        }
                        if (pd.status === 'completed' && pd.audioUrl) return pd.audioUrl;
                        
                        // 彻底失败
                        if (pd.status === 'failed') {
                            throw new Error(pd.error || 'Kling TTS生成失败');
                        }
                        
                        // 状态完成但没有URL，尝试从rawData提取
                        if (pd.status === 'completed_no_url' && pd.rawData) {
                            console.warn('[api-core] Kling TTS: 后端状态完成但无URL，尝试前端提取:', JSON.stringify(pd.rawData).substring(0, 300));
                            const rd = pd.rawData;
                            const extractedUrl = rd?.data?.task_result?.works?.[0]?.resource?.resource ||
                                                rd?.data?.task_result?.works?.[0]?.audio?.resource ||
                                                rd?.data?.works?.[0]?.resource?.resource ||
                                                rd?.data?.works?.[0]?.audio?.resource ||
                                                rd?.data?.audio_url || rd?.audio_url || rd?.data?.resource || rd?.resource;
                            if (extractedUrl) {
                                console.log(`✅ [api-core] Kling TTS 前端提取成功: ${extractedUrl.substring(0, 80)}`);
                                return extractedUrl;
                            }
                        }
                        
                        if ((i + 1) % 10 === 0) {
                            console.log(`🔄 [api-core] Kling TTS 轮询中... ${i + 1}/90 status=${pd.status || 'unknown'}`);
                        }
                    } catch (pollErr) {
                        if (pollErr.message && (pollErr.message.includes('失败') || pollErr.message.includes('failed'))) throw pollErr;
                        failCount++;
                        console.warn(`[api-core] Kling TTS 轮询异常 #${failCount}:`, pollErr.message);
                        if (failCount >= 5) throw new Error(`Kling TTS轮询连续失败${failCount}次: ${pollErr.message}`);
                    }
                }
                throw new Error('Kling TTS超时(3分钟)');
            }
            throw new Error('Kling TTS未返回结果');
        }

        // DubbingX TTS
        if (engine === 'dubbingx') {
            // DubbingX 需要 voiceId，如果为空则使用默认音色
            const dxVoiceId = options.voiceId || 'zh_female_shuangkuaisisi_moon_bigtts';
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'tts-generate',
                    text,
                    voiceId: dxVoiceId,
                    language: options.language || 'zh',
                    audioSpeed: options.speed || 1,
                    emotion: options.emotion || '',
                    userId
,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.message || data.error || 'DubbingX TTS失败');
            if (!data.taskId) throw new Error('DubbingX TTS未返回taskId');
            // 轮询
            for (let i = 0; i < 60; i++) {
                await sleep(3000);
                const pr = await fetch('/api/yunwu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'tts-poll', taskId: data.taskId })
                });
                const pd = await pr.json().catch(() => ({}));
                if (pd.success && pd.fileUrl) return pd.fileUrl;
                if (pd.status === 'Failed' || pd.status === 'Error') throw new Error('DubbingX TTS生成失败');
            }
            throw new Error('DubbingX TTS超时');
        }

        throw new Error(`不支持的TTS引擎: ${engine}`);
    }

    // ==================== 🎵 Suno 音乐生成 ====================

    /**
     * 🎵 调用 Suno 音乐生成 API
     * @param {object} options - { prompt, title, tags, model, instrumental, description }
     * @returns {Promise<{taskId: string, music: Array}>} 任务ID和音乐列表
     */
    async function callSunoMusicAPI(options = {}) {
        let userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录后再使用此功能');

        const body = {
            action: 'generate',
            userId,
            skip_billing: _billingSessionCount > 0 || undefined,
            mv: options.model || 'chirp-v4',
            title: options.title || '',
            tags: options.tags || '',
            make_instrumental: !!options.instrumental
        };

        // 灵感模式 vs 自定义模式
        if (options.description && !options.prompt) {
            body.gpt_description_prompt = options.description;
        } else {
            body.prompt = options.prompt || options.description || '';
        }

        const res = await fetch('/api/suno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.message || data.error || '音乐生成失败');
        if (!data.task_id) throw new Error('音乐生成未返回任务ID');

        // 轮询结果
        for (let i = 0; i < 120; i++) {
            await sleep(5000);
            const pr = await fetch('/api/suno', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'fetch', task_id: data.task_id })
            });
            const pd = await pr.json().catch(() => ({}));
            if (pd.is_complete && pd.music && pd.music.length > 0) {
                console.log(`🎵 [api-core Suno] 生成成功: ${pd.music.length}首`);
                return { taskId: data.task_id, music: pd.music };
            }
            if (pd.is_failed) throw new Error(pd.fail_reason || '音乐生成失败');
        }
        throw new Error('音乐生成超时（10分钟）');
    }

    /**
     * 🎵 调用 Suno 歌词生成 API
     */
    async function callSunoLyricsAPI(prompt) {
        let userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录');

        const res = await fetch('/api/suno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'lyrics', prompt, userId, skip_billing: _billingSessionCount > 0 || undefined })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.message || data.error || '歌词生成失败');
        return data;
    }

    // ==================== 📤 导出到全局 ====================

    // 核心 API 函数
    global.callScriptGenerator = callScriptGenerator;
    global.callModelScopeImageAPI = callModelScopeImageAPI;
    global.callModelScopeTextAPI = callModelScopeTextAPI;
    global.callModelScopeVideoAPI = callModelScopeVideoAPI;
    global.callModelScopeImageToVideoAPI = callModelScopeImageToVideoAPI;
    global.callBanana2ImageAPI = callBanana2ImageAPI;
    global.callSora2TextToVideoAPI = callSora2TextToVideoAPI;
    global.callSora2ImageToVideoAPI = callSora2ImageToVideoAPI;
    global.callSora2TextToVideo = callSora2TextToVideo;
    global.callSora2ImageToVideo = callSora2ImageToVideo;
    global.callZhenzhenTextAPI = callZhenzhenTextAPI;
    global.callWriterLLM = callWriterLLM;
    global.callOCRAPI = callOCRAPI;
    global.callMidjourneyImageAPI = global.callMidjourneyImageAPI || callMidjourneyImageAPI;

    // 🎤 音频/音乐 API
    global.callTTSAPI = callTTSAPI;
    global.callSunoMusicAPI = callSunoMusicAPI;
    global.callSunoLyricsAPI = callSunoLyricsAPI;

    // 辅助函数
    global.getCurrentUserId = global.getCurrentUserId || getCurrentUserId;
    global.startBillingSession = startBillingSession;
    global.endBillingSession = endBillingSession;
    global.retryableAPICall = global.retryableAPICall || retryableAPICall;
    global.isPaidUser = global.isPaidUser || isPaidUser;
    global.checkFreeUserAccess = global.checkFreeUserAccess || checkFreeUserAccess;
    global.checkFreeUserTextProvider = global.checkFreeUserTextProvider || checkFreeUserTextProvider;
    global.pollSora2Task = global.pollSora2Task || pollSora2Task;
    global.sleep = global.sleep || sleep;

    // 📚 角色库/素材库保存函数
    global.saveCharacterToLibrary = global.saveCharacterToLibrary || saveCharacterToLibrary;
    global.saveImageToLibrary = global.saveImageToLibrary || saveImageToLibrary;
    global.saveVideoToLibrary = global.saveVideoToLibrary || saveVideoToLibrary;
    global.isValidMediaUrl = global.isValidMediaUrl || isValidMediaUrl;

    console.log('✅ [api-core.js] API 核心模块已加载');

})(typeof window !== 'undefined' ? window : this);
