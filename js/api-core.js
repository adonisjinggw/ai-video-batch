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
        if (!ml) return 'sora-2-all';
        if (ml === 'sora2' || ml === 'sora-2' || ml === 'sora-2-hd' || ml === 'sora2-hd' || ml === 'sora-2-all') return 'sora-2-all';
        if (ml === 'sora2pro' || ml === 'sora-2-pro' || ml === 'sora2-pro' || ml === 'sora-2-pro-all') return 'sora-2-pro-all';
        if (ml === 'sora-2-characters') return 'sora-2-all';
        if (ml === 'veo3.1fast' || ml === 'veo-3.1fast' || ml === 'veo-3.1-fast') return 'veo3.1';
        if (ml === 'veo3.1' || ml === 'veo-3.1') return 'veo3.1';
        if (ml === 'veo3.1-pro' || ml === 'veo-3.1-pro' || ml === 'veo3.1pro') return 'veo3.1';
        if (ml === 'grok3' || ml === 'grok-video-3' || ml === 'grok-video-3-text' || ml === 'grok-video-3-hd') return 'grok-video-3';
        if (ml.startsWith('vidu-') || ml.startsWith('hailuo-') || ml.startsWith('kling-')) return m;
        return m;
    }

    function __getFixedClipDurationByModel(model, hd) {
        const m = __normalizeVideoModelName(model);
        if (m === 'sora-2-pro-all') {
            const wantHd = (typeof hd === 'undefined') ? true : !!hd;
            return wantHd ? 15 : 25;
        }
        if (m === 'grok-video-3') return 6;
        if (m === 'veo3.1') return 8;
        if (String(m).startsWith('vidu-') || String(m).startsWith('kling-')) {
            const durationMatch = String(m).match(/-(\\d+)s[-$]/i) || String(m).match(/-(\\d+)s$/i);
            return durationMatch ? parseInt(durationMatch[1]) : 5;
        }
        if (String(m).startsWith('hailuo-')) {
            const durationMatch = String(m).match(/-(\\d+)s[-$]/i) || String(m).match(/-(\\d+)s$/i);
            return durationMatch ? parseInt(durationMatch[1]) : 6;
        }
        if (String(m).startsWith('sora-2')) return 15;
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

    function __parseViduModel(model) {
        const newMatch = String(model || '').match(/vidu-(q2-pro|q2-turbo|q2)-(\d+)s-(720p|1080p)/i);
        if (newMatch) {
            return {
                version: newMatch[1],
                duration: parseInt(newMatch[2]),
                resolution: newMatch[3].toUpperCase()
            };
        }
        const oldMatch = String(model || '').match(/vidu-(q2-pro|q2-turbo|q2)-(720p|1080p)/i);
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

        const res = await fetch('/api/yunwu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'text',
                prompt,
                model,
                temperature,
                max_tokens,
                speed,
                userId
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            throw new Error(data.message || data.error || `文本生成失败: ${res.status}`);
        }
        const content = String(data.content || data.text || '').trim();
        if (!content) throw new Error('文本生成返回为空');
        return content;
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
     */
    async function callWriterLLM(messages, opts = {}) {
        let userId = await getCurrentUserId();
        
        const payload = {
            messages,
            userId,
            model: opts.model || 'roll',
            temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.7,
            max_tokens: typeof opts.max_tokens === 'number' ? opts.max_tokens : 4096
        };
        const res = await fetch('/api/writer-llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false) {
            throw new Error(data?.message || data?.error || `writer-llm failed: ${res.status}`);
        }
        return String(data?.content || '').trim();
    }

    /**
     * 📝 剧本生成器（自动选择最佳通道）
     */
    async function callScriptGenerator(idea, prompt) {
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

        const res = await fetch('/api/modelscope', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                prompt,
                aspectRatio,
                imageUrls,
                userId
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            throw new Error(data.message || data.error || `ModelScope失败: ${res.status}`);
        }
        const img = (data.images && data.images[0]) ? data.images[0] : null;
        if (!img) throw new Error('ModelScope 未返回图片');
        return img;
    }

    /**
     * 🎨 调用 Banana2 图片 API
     */
    async function callBanana2ImageAPI(prompt, options = {}) {
        let userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录后再使用此功能');

        const res = await fetch('/api/banana2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                model: options.model || 'nano-banana-2',
                aspect_ratio: options.aspectRatio || options.aspect_ratio || '16:9',
                image_url: options.imageUrl || options.image_url,
                userId
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            throw new Error(data.message || data.error || `Banana2失败: ${res.status}`);
        }
        const img = data.url || (data.urls && data.urls[0]) || (data.data && data.data[0] && data.data[0].url);
        if (!img) throw new Error('Banana2 未返回图片');
        return img;
    }

    // ==================== 🎬 视频生成 API ====================

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

        const userId = await getCurrentUserId();
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

        const userId = await getCurrentUserId();
        if (!userId) throw new Error('请先登录后再使用此功能');

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
                userId
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
            let lib = [];
            try {
                lib = JSON.parse(localStorage.getItem('character_library') || '[]');
                if (!Array.isArray(lib)) lib = [];
            } catch (e) {
                lib = [];
            }

            if (!name || typeof name !== 'string') {
                console.error('[api-core] 角色名称无效');
                return false;
            }

            // 检查是否存在相同名字的角色
            const existingIdx = lib.findIndex(c => c.name === name);
            if (existingIdx >= 0) {
                lib[existingIdx] = {
                    name: name,
                    summary: summary || '',
                    imageUrl: posterUrl || lib[existingIdx].imageUrl || '',
                    videoUrl: videoUrl || lib[existingIdx].videoUrl || '',
                    variants: {
                        poster: posterUrl || lib[existingIdx].variants?.poster || lib[existingIdx].imageUrl || '',
                        turnaround: turnaroundUrl || lib[existingIdx].variants?.turnaround || ''
                    }
                };
                console.log(`✅ [api-core] 角色「${name}」已更新`);
            } else {
                lib.push({
                    name: name,
                    summary: summary || '',
                    imageUrl: posterUrl || '',
                    videoUrl: videoUrl || '',
                    variants: {
                        poster: posterUrl || '',
                        turnaround: turnaroundUrl || ''
                    }
                });
                console.log(`✅ [api-core] 角色「${name}」已保存到角色库`);
            }

            localStorage.setItem('character_library', JSON.stringify(lib));
            return true;
        } catch (err) {
            console.error('❌ [api-core] 保存角色失败:', err);
            return false;
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
            let lib = [];
            try {
                lib = JSON.parse(localStorage.getItem('material_library') || '[]');
                if (!Array.isArray(lib)) lib = [];
            } catch (e) {
                lib = [];
            }

            if (!url) {
                console.error('[api-core] 图片URL无效');
                return false;
            }

            lib.push({
                id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: 'image',
                url: url,
                title: title || '技能生成图片',
                category: category || 'skill',
                createdAt: new Date().toISOString()
            });

            localStorage.setItem('material_library', JSON.stringify(lib));
            console.log(`✅ [api-core] 图片已保存到素材库: ${title || url.substring(0, 50)}`);
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
            let lib = [];
            try {
                lib = JSON.parse(localStorage.getItem('material_library') || '[]');
                if (!Array.isArray(lib)) lib = [];
            } catch (e) {
                lib = [];
            }

            if (!url) {
                console.error('[api-core] 视频URL无效');
                return false;
            }

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
            console.log(`✅ [api-core] 视频已保存到素材库: ${title || url.substring(0, 50)}`);
            return true;
        } catch (err) {
            console.error('❌ [api-core] 保存视频失败:', err);
            return false;
        }
    }

    // ==================== 📤 导出到全局 ====================

    // 核心 API 函数
    global.callScriptGenerator = callScriptGenerator;
    global.callModelScopeImageAPI = callModelScopeImageAPI;
    global.callModelScopeTextAPI = callModelScopeTextAPI;
    global.callBanana2ImageAPI = callBanana2ImageAPI;
    global.callSora2TextToVideoAPI = callSora2TextToVideoAPI;
    global.callSora2ImageToVideoAPI = callSora2ImageToVideoAPI;
    global.callSora2TextToVideo = callSora2TextToVideo;
    global.callSora2ImageToVideo = callSora2ImageToVideo;
    global.callZhenzhenTextAPI = callZhenzhenTextAPI;
    global.callWriterLLM = callWriterLLM;

    // 辅助函数
    global.getCurrentUserId = global.getCurrentUserId || getCurrentUserId;
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

    console.log('✅ [api-core.js] API 核心模块已加载');

})(typeof window !== 'undefined' ? window : this);
