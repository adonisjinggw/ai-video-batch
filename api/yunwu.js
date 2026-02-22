/**
 * 云雾AI API 代理
 * 🔐 API Key 通过环境变量配置，不暴露给前端
 * 📍 多线路支持，自动故障转移
 * 💰 计费通过 /api/supabase-proxy 统一处理
 * 🎯 功能：图片生成、视频生成、文本生成、角色固定、图片分析
 */

// ========== 计费配置 ==========
const FILM_COST = {
    'image': 5,              // 图片生成
    'seedream': 7.5,         // 星梦画师
    'vision': 2,             // 图片分析
    'text': 1,               // 文本生成
    'video': 15,             // 视频生成（基础）
    'video-hd': 25,          // 视频生成（高清）
    'veo3': 30,              // Veo3 4K视频 (升级为4k版本)
    'grok-video-3': 5,       // Grok Video 3 6秒
    'grok-video-3-10s': 8,   // Grok Video 3 10秒
    'create-character': 5,   // 创建角色
    // Vidu 视频模型 - 按分辨率和版本计费（70%利润，按秒计费，默认5秒）
    'vidu-q2-720p': 25,       // ¥0.288/秒 × 5秒 / 0.59 = ¥2.45
    'vidu-q2-1080p': 36,      // ¥0.423/秒 × 5秒 / 0.59 = ¥3.60
    'vidu-q2-pro-720p': 27,   // ¥0.315/秒 × 5秒 / 0.59 = ¥2.68
    'vidu-q2-pro-1080p': 54,  // ¥0.630/秒 × 5秒 / 0.59 = ¥5.36
    'vidu-q2-turbo-720p': 19, // ¥0.225/秒 × 5秒 / 0.59 = ¥1.91
    'vidu-q2-turbo-1080p': 36, // ¥0.423/秒 × 5秒 / 0.59 = ¥3.60
    'vidu-q3-pro-720p': 72,    // ⚡0.843/秒 × 5秒 × 17.1 = 72
    'vidu-q3-pro-1080p': 77,   // ⚡0.900/秒 × 5秒 × 17.1 = 77
    // Hailuo 海螺视频模型 - 固定时长计费（闪电×0.5=成本，70%利润，1胶片=¥0.3）
    'hailuo-02-768p-6s': 7,       // ⚡2.376×0.5×1.7/0.3 = 7
    'hailuo-02-768p-10s': 12,     // ⚡3.960×0.5×1.7/0.3 = 11.22 → ceil = 12
    'hailuo-02-1080p-6s': 12,     // ⚡4.176×0.5×1.7/0.3 = 12
    'hailuo-02-1080p-10s': 20,    // ⚡6.960×0.5×1.7/0.3 = 20
    'hailuo-fast-768p-6s': 5,     // ⚡1.656×0.5×1.7/0.3 = 5
    'hailuo-fast-768p-10s': 8,    // ⚡2.760×0.5×1.7/0.3 = 8
    'hailuo-fast-1080p-6s': 8,    // ⚡2.808×0.5×1.7/0.3 = 8
    'hailuo-fast-1080p-10s': 14,  // ⚡4.680×0.5×1.7/0.3 = 13.26 → ceil = 14
    // Kling 可灵视频模型 - 固定时长计费（闪电×0.5=成本，70%利润，1胶片=¥0.3）
    'kling-o1-720p-5s': 16,       // ⚡5.400×0.5×1.7/0.3 = 15.3 → ceil = 16
    'kling-o1-720p-10s': 31,      // ⚡10.800×0.5×1.7/0.3 = 31
    'kling-o1-1080p-5s': 21,      // ⚡7.200×0.5×1.7/0.3 = 20.4 → ceil = 21
    'kling-o1-1080p-10s': 41,     // ⚡14.400×0.5×1.7/0.3 = 41
    'kling-2.5-720p-5s': 6,       // ⚡1.800×0.5×1.7/0.3 = 5.1 → ceil = 6
    'kling-2.5-720p-10s': 11,     // ⚡3.600×0.5×1.7/0.3 = 10.2 → ceil = 11
    'kling-2.5-1080p-5s': 9,      // ⚡3.000×0.5×1.7/0.3 = 9
    'kling-2.5-1080p-10s': 17,    // ⚡6.000×0.5×1.7/0.3 = 17
    'kling-2.1-720p-5s': 6,       // 2.1版本 - 估算2.0和2.5之间
    'kling-2.1-720p-10s': 12,
    'kling-2.1-1080p-5s': 10,
    'kling-2.1-1080p-10s': 20,
    'kling-2.0-720p-5s': 7,       // ⚡2.400×0.5×1.7/0.3 = 7
    'kling-2.0-720p-10s': 14,     // ⚡4.800×0.5×1.7/0.3 = 14
    'kling-2.0-1080p-5s': 12,     // ⚡4.200×0.5×1.7/0.3 = 12
    'kling-2.0-1080p-10s': 24,    // ⚡8.400×0.5×1.7/0.3 = 24
    'kling-1.6-720p-5s': 8,       // 1.6版本 - 估算略高于2.0
    'kling-1.6-720p-10s': 16,
    'kling-1.6-1080p-5s': 14,
    'kling-1.6-1080p-10s': 28,
    // Wan2.6 图生视频模型 - alibailian API（⚡×0.49=成本¥，70%利润，1胶片=¥0.3）
    // 公式: ceil(⚡cost × 0.49 × 1.7 / 0.3)
    'wan26-720p-5s': 3,            // 无声 ⚡0.750 → 3
    'wan26-720p-10s': 5,           // 无声 ⚡1.500 → 5
    'wan26-720p-15s': 7,           // 无声 ⚡2.250 → 7
    'wan26-1080p-5s': 5,           // 无声 ⚡1.500 → 5
    'wan26-1080p-10s': 9,          // 无声 ⚡3.000 → 9
    'wan26-1080p-15s': 13,         // 无声 ⚡4.500 → 13
    'wan26-720p-5s-audio': 4,      // 有声 ⚡1.250 → 4
    'wan26-720p-10s-audio': 7,     // 有声 ⚡2.500 → 7
    'wan26-720p-15s-audio': 11,    // 有声 ⚡3.750 → 11
    'wan26-1080p-5s-audio': 7,     // 有声 ⚡2.500 → 7
    'wan26-1080p-10s-audio': 14,   // 有声 ⚡5.000 → 14
    'wan26-1080p-15s-audio': 21,   // 有声 ⚡7.500 → 21
    // TTS 语音合成模型
    'tts-dubbingx': 2,             // DubbingX TTS 2胶片/次
    'tts-gemini-flash': 1,         // Gemini Flash TTS 1胶片/次 (便宜快速)
    'tts-gemini-pro': 3,           // Gemini Pro TTS 3胶片/次 (高质量)
    'tts-kling': 2,                // Kling TTS 2胶片/次
    'tts-kling-custom-voice': 5    // Kling 自定义音色 5胶片/次
};

/**
 * 📝 保存生成记录 - 确保用户能找回已生成的内容
 */
async function __saveGenerationRecord(userId, recordType, contentUrl, prompt, model, cost, metadata) {
    if (!userId) return { success: false, error: 'no userId' };
    
    try {
        const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'https://www.rollroll.art';
        
        const res = await fetch(`${baseUrl}/api/supabase-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveGenerationRecord',
                userId,
                recordType,
                contentUrl,
                prompt,
                model,
                cost,
                metadata
            })
        });
        
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            console.warn('[yunwu] 保存记录失败:', data.error || data.message);
            return { success: false, error: data.error || data.message };
        }
        
        console.log(`[yunwu] 📝 生成记录已保存: ${data.recordId}`);
        return { success: true, recordId: data.recordId };
    } catch (e) {
        console.warn('[yunwu] 保存记录异常:', e.message);
        return { success: false, error: e.message };
    }
}

/**
 * 🔐 统一计费函数 - 调用 /api/supabase-proxy
 * @param {string} billingAction - 'consume' 或 'refund'
 * @param {string} userId - 用户ID
 * @param {number} amount - 金额
 * @param {string} description - 描述
 */
async function __billing(billingAction, userId, amount, description) {
    if (!userId || amount <= 0) return { success: true, skipped: true };
    
    // 🔧 确保金额是整数
    const intAmount = Math.ceil(amount);
    
    // 映射 action: consume -> consume, refund -> recharge
    const proxyAction = billingAction === 'refund' ? 'recharge' : 'consume';
    
    try {
        // 获取当前请求的 host（用于内部调用）
        const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'https://www.rollroll.art';
        
        const res = await fetch(`${baseUrl}/api/supabase-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: proxyAction,
                userId,
                amount: intAmount,
                description: description || (billingAction === 'refund' ? '退款' : '消费')
            })
        });
        
        const data = await res.json().catch(() => ({}));
        
        if (!res.ok || !data.success) {
            if (billingAction === 'consume') {
                throw new Error(data.message || data.error || '扣费失败');
            }
            console.error(`[yunwu] 退款失败:`, data);
            return { success: false, error: data.message || data.error };
        }
        
        console.log(`[yunwu] 💰 ${billingAction === 'refund' ? '退款' : '扣费'}成功: ${userId} ${billingAction === 'refund' ? '+' : '-'}${intAmount}胶片`);
        return { success: true, newBalance: data.newBalance, newUsed: data.newUsed };
    } catch (e) {
        if (billingAction === 'consume') {
            throw e;
        }
        console.error(`[yunwu] 退款异常:`, e.message);
        return { success: false, error: e.message };
    }
}

const YUNWU_API_KEYS = (() => {
    const keys = [];
    const key1 = (process.env.YUNWU_API_KEY || process.env.YUNMENG_API_KEY || '').trim();
    const key2 = (process.env.YUNWU_API_KEY_2 || process.env.YUNMENG_API_KEY_2 || '').trim();
    const key3 = (process.env.YUNWU_API_KEY_3 || process.env.YUNMENG_API_KEY_3 || '').trim();
    if (key1) keys.push(key1);
    if (key2) keys.push(key2);
    if (key3) keys.push(key3);
    console.log(`[yunwu] 🔑 初始化: 读取到 ${keys.length} 个 API_KEY`);
    return keys;
})();
const YUNWU_API_KEY = YUNWU_API_KEYS[0] || '';

// ========== DubbingX TTS 配置 ==========
// DubbingX 只需要 apiKey（第一个key），不需要 apiSecret
const TTS_API_KEY = process.env.TTS_API_KEY || 'NWY1NmUxM2QtYjAxZi00YTkzLTgzYjkt';
const TTS_BASE_URL = 'https://tts-api.dubbingx.com';
const VC_BASE_URL = 'https://vc-api.dubbingx.com';

// DubbingX 文档要求 Bearer apiKey
function getDubbingXBearerHeaders() {
    return { Authorization: `Bearer ${TTS_API_KEY}` };
}
const TTS_MAX_CONCURRENT = 5;  // 最大并发数
let ttsCurrentConcurrent = 0;  // 当前并发数
let ttsQueue = [];  // 等待队列

/**
 * 云雾API多线路配置（按优先级排序）
 * 1. 国内服务器 - 国内高防服务器线路（最快）
 * 2. ZeaBur-CDN - 国内访问速度快
 * 3. 主站 - 美国高防负载均衡站群
 * 4. CF站 - 全球CDN备用
 */
const YUNWU_ENDPOINTS = [
    { url: 'https://api3.wlai.vip', name: '国内服务器', keyIdx: 0 },
    { url: 'https://yunwu.zeabur.app', name: 'ZeaBur-CDN', keyIdx: 1 },
    { url: 'https://yunwu.ai', name: '主站', keyIdx: 2 },
    { url: 'https://api.apiplus.org', name: 'CF站', keyIdx: 0 }
];

// 默认使用第一个（国内最快）
let YUNWU_BASE_URL = YUNWU_ENDPOINTS[0].url;

/** 🚀 只使用第一个端点（避免创建重复任务） */
async function _tryAllEndpoints(path, options, timeoutMs) {
    // 🔧 只使用第一个端点，避免多个端点同时创建任务
    const endpoint = YUNWU_ENDPOINTS[0];
    const url = `${endpoint.url}${path}`;
    
    // 🔑 使用第一个 API Key
    const apiKey = YUNWU_API_KEYS[0] || YUNWU_API_KEY;
    const headers = { ...(options.headers || {}) };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    console.log(`[yunwu] 🔄 使用端点: ${endpoint.name}`);
    
    try {
        const response = await fetch(url, {
            ...options,
            headers,
            signal: AbortSignal.timeout(timeoutMs)
        });
        
        if (response.ok) {
            console.log(`[yunwu] ✅ ${endpoint.name} 成功 (${response.status})`);
            return { response };
        } else if (response.status === 429) {
            console.warn(`[yunwu] ${endpoint.name} 限速(429)`);
            return { error: new Error('RATE_LIMIT'), got429: true };
        } else {
            console.warn(`[yunwu] ${endpoint.name} 返回 ${response.status}`);
            return { error: new Error(`请求失败: ${response.status}`), got429: false };
        }
    } catch (err) {
        console.warn(`[yunwu] ${endpoint.name} 异常:`, err.message);
        return { error: new Error(err.message), got429: false };
    }
}

/**
 * 带故障转移 + 429重试的fetch请求
 * 逻辑：先轮询所有节点，如果全部429则等待2s后再试一轮（最多3轮）
 */
async function fetchWithFallback(path, options) {
    const MAX_ROUNDS = 3;
    let lastError = null;
    
    for (let round = 0; round < MAX_ROUNDS; round++) {
        if (round > 0) {
            const delay = 1500 * round;
            console.log(`[yunwu] 全节点限速，等待${delay}ms后第${round + 1}轮重试...`);
            await new Promise(r => setTimeout(r, delay));
        }
        
        const result = await _tryAllEndpoints(path, options, 30000);
        if (result.response) return result.response;
        
        lastError = result.error;
        if (!result.got429) break;  // 非429错误，不用重试
    }
    
    throw lastError || new Error('所有云雾节点均不可用');
}

/**
 * fetchWithFallback 的可配置超时版本（同样支持429重试）
 */
async function fetchWithFallbackWithTimeout(path, options, timeoutMs = 30000) {
    const MAX_ROUNDS = 3;
    let lastError = null;
    
    for (let round = 0; round < MAX_ROUNDS; round++) {
        if (round > 0) {
            const delay = 1500 * round;
            console.log(`[yunwu] 全节点限速，等待${delay}ms后第${round + 1}轮重试...`);
            await new Promise(r => setTimeout(r, delay));
        }
        
        const result = await _tryAllEndpoints(path, options, timeoutMs);
        if (result.response) return result.response;
        
        lastError = result.error;
        if (!result.got429) break;
    }
    
    throw lastError || new Error('所有云雾节点均不可用');
}

module.exports = async function handler(req, res) {
    const json = (status, payload) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        json(204, {});
        return;
    }

    if (req.method !== 'POST') {
        json(405, { error: 'METHOD_NOT_ALLOWED' });
        return;
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { action, userId, skip_billing } = body || {};
        const skipBilling = skip_billing === true;

        if (!action) {
            json(400, { error: 'MISSING_ACTION' });
            return;
        }

        // 🔐 安全检查：必须提供 userId 才能使用 API（防止白嫒）
        // 豁免某些只读操作（不扣费）
        const exemptActions = ['tts-voices', 'kling-voices', 'tts-poll', 'kling-tts-poll', 'vc-poll', 'vc-list', 'wan26-poll'];  // 获取音色列表和轮询不需要登录
        if (!userId && !exemptActions.includes(action)) {
            json(401, { error: 'UNAUTHORIZED', message: '请先登录后再使用此功能' });
            return;
        }

        if (!YUNWU_API_KEY) {
            json(500, { error: 'YUNWU_NOT_CONFIGURED', message: '云雾API未配置' });
            return;
        }

        // ========== 图片生成 (Flux / DALL-E 格式) ==========
        if (action === 'image') {
            const { 
                prompt, 
                model = 'flux-1-schnell',  // 默认Flux schnell快速模型
                size = '1024x1024',
                width = 1024,
                height = 1024,
                n = 1 
            } = body;
            
            if (!prompt) {
                json(400, { 
                    success: false,
                    error: 'MISSING_PROMPT',
                    error_code: 'MISSING_PROMPT',
                    billed: 0
                });
                return;
            }

            // 💰 先扣费模式：调用上游API前先扣费
            const filmCost = FILM_COST['image'] || 5;
            let billingSuccess = false;
            
            if (!skipBilling && filmCost > 0 && userId) {
                try {
                    const billingResult = await __billing('consume', userId, filmCost, `图片生成:${model}`);
                    if (!billingResult.success && !billingResult.skipped) {
                        json(400, { success: false, error: 'BILLING_FAILED', message: billingResult.error || '扣费失败，请检查余额', billed: 0 });
                        return;
                    }
                    billingSuccess = billingResult.success && !billingResult.skipped;
                    console.log(`[yunwu] 💰 图片预扣费成功: ${filmCost}胶片`);
                } catch (billingErr) {
                    json(400, { success: false, error: 'BILLING_FAILED', message: billingErr.message || '扣费失败', billed: 0 });
                    return;
                }
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 图片跳过扣费: 前端已处理`);
            }

            // 支持多种尺寸格式
            const finalSize = size || `${width}x${height}`;
            console.log('[yunwu] 图片生成:', { model, size: finalSize, promptLen: prompt.length });

            // ✅ 慢模型/高质量：提高超时
            const m = String(model || '').toLowerCase();
            const is4k = m.includes('4k') || m.includes('2k');
            const timeoutMs = is4k ? 120000 : 60000;

            try {
                const response = await fetchWithFallbackWithTimeout(`/v1/images/generations`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model,
                        prompt,
                        size: finalSize,
                        n
                    })
                }, timeoutMs);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] 图片生成错误:', response.status, errorText);
                    // 💰 生成失败，退款
                    if (billingSuccess) {
                        try {
                            await __billing('refund', userId, filmCost, `图片生成失败退款:${model}`);
                            console.log(`[yunwu] 💰 图片生成失败，已退款: ${filmCost}胶片`);
                        } catch (refundErr) {
                            console.error('[yunwu] 退款失败:', refundErr.message);
                        }
                    }
                    json(500, { 
                        success: false,
                        error: 'API_ERROR',
                        error_code: 'API_ERROR',
                        message: `图片生成失败 (${response.status}): ${errorText}`,
                        billed: 0
                    });
                    return;
                }

                const data = await response.json();
                const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json || data.url;
                
                // ✅ 生成成功，保存记录
                await __saveGenerationRecord(userId, 'image', imageUrl, prompt, model, filmCost, { size: finalSize });
                
                // 返回内容
                json(200, { 
                    success: true, 
                    url: imageUrl,
                    data,
                    billed: billingSuccess ? filmCost : 0
                });
                return;
            } catch (err) {
                // ✅ 异常，退款
                if (billingSuccess) {
                    try {
                        await __billing('refund', userId, filmCost, `图片生成异常退款:${model}`);
                        console.log(`[yunwu] 💰 图片生成异常，已退款: ${filmCost}胶片`);
                    } catch (refundErr) {
                        console.error('[yunwu] 退款失败:', refundErr.message);
                    }
                }
                json(500, { 
                    success: false,
                    error: 'API_ERROR',
                    error_code: 'API_ERROR',
                    message: err.message,
                    billed: 0
                });
                return;
            }
        }

        // ========== 星梦画师 (doubao-seedream-4-5-251128) ==========
        // 🌟 支持功能：
        //   - 文生图：纯 prompt 输入
        //   - 图生图：单张参考图 + prompt (image_url)
        //   - 多图生图：多张参考图(2-10张) + prompt (image_urls 数组)
        //   - 批量生成：输出多张图片 (n 参数)
        if (action === 'seedream') {
            const { 
                prompt, 
                model = 'doubao-seedream-4-5-251128', 
                size = '1024x1024', 
                image_url,       // 单张参考图 URL
                image_urls,      // 🆕 多张参考图 URL 数组 (2-10张)
                n = 1,           // 🆕 输出图片数量 (1-15, 输入图+输出图总数≤ 15)
                speed = 1,
                mode             // 🆕 生成模式: 'text2image'|‘image2image’|‘multi-image’|‘batch’
            } = body;
            
            if (!prompt && !image_url && (!image_urls || image_urls.length === 0)) {
                json(400, { 
                    success: false,
                    error: 'MISSING_PROMPT_OR_IMAGE',
                    error_code: 'MISSING_PROMPT_OR_IMAGE',
                    message: '请提供提示词或参考图',
                    billed: 0
                });
                return;
            }

            // 🆕 多图模式验证 (2-10张参考图)
            const multiImageMode = image_urls && Array.isArray(image_urls) && image_urls.length >= 2;
            if (multiImageMode) {
                if (image_urls.length > 10) {
                    json(400, { 
                        success: false,
                        error: 'TOO_MANY_IMAGES',
                        error_code: 'TOO_MANY_IMAGES',
                        message: '多图模式最多支持 10 张参考图',
                        billed: 0
                    });
                    return;
                }
                // 输入图数 + 输出图数 ≤ 15
                if (image_urls.length + parseInt(n) > 15) {
                    json(400, { 
                        success: false,
                        error: 'IMAGE_COUNT_EXCEEDED',
                        error_code: 'IMAGE_COUNT_EXCEEDED',
                        message: `参考图数(${image_urls.length})加输出数(${n})不能超过 15`,
                        billed: 0
                    });
                    return;
                }
            }

            // 💰 计费：根据输出数量计算
            const baseCost = FILM_COST['seedream'] || 7.5;
            const outputCount = Math.min(Math.max(parseInt(n) || 1, 1), 15);
            const filmCost = baseCost * outputCount;
            let billingSuccess = false;

            // 确定生成模式
            const actualMode = multiImageMode ? 'multi-image' : (image_url ? 'image2image' : 'text2image');
            console.log('[yunwu] 星梦画师:', { 
                model, size, mode: actualMode, 
                refImageCount: multiImageMode ? image_urls.length : (image_url ? 1 : 0),
                outputCount, speed 
            });

            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, `星梦画师:${actualMode}`);
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 星梦画师跳过扣费: 前端已处理`);
            }

            // 🌟 构建请求体 - 使用云雾API的 /v1/images/generations 端点
            // 文档参考: https://yunwu.apifox.cn/api-386006897
            const requestBody = {
                model,
                prompt: prompt || '根据参考图生成',
                size,  // 支持 '1K', '2K', '4K' 或 '1024x1024' 等
                stream: false,
                response_format: 'url',
                watermark: false
            };

            // 🆕 处理参考图片
            if (multiImageMode) {
                // 多图模式：image 是数组
                requestBody.image = image_urls;
                console.log('[yunwu] 星梦画师多图模式，参考图数量:', image_urls.length);
            } else if (image_url) {
                // 单图模式：image 是单个URL
                requestBody.image = image_url;
            }

            // 🆕 批量生成模式：启用 sequential_image_generation
            if (outputCount > 1) {
                requestBody.sequential_image_generation = 'auto';
                requestBody.sequential_image_generation_options = {
                    max_images: outputCount
                };
            } else {
                // 多图融合输出单图时用 disabled
                requestBody.sequential_image_generation = 'disabled';
            }

            const timeoutMs = outputCount > 1 ? 180000 : 120000; // 批量生成需要更长超时
            console.log('[yunwu] 星梦画师请求体:', JSON.stringify(requestBody).substring(0, 500));

            try {
                const response = await fetchWithFallbackWithTimeout(`/v1/images/generations`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }, timeoutMs);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] 星梦画师错误:', response.status, errorText);
                    // 🔄 API失败且无内容消耗，退款
                    if (billingSuccess) {
                        await __billing('refund', userId, filmCost, '星梦画师API失败退款');
                    }
                    json(500, { 
                        success: false,
                        error: 'API_ERROR',
                        error_code: 'API_ERROR',
                        message: `星梦画师生成失败 (${response.status})`,
                        billed: 0
                    });
                    return;
                }

                const data = await response.json();
                
                // 🌟 提取图片结果 - /v1/images/generations 返回格式：
                // { data: [{ url: "https://...", size: "3104x1312" }], created: ..., usage: {...} }
                let imageUrls = [];
                
                // 🔧 调试：输出原始返回格式
                console.log('[yunwu] 星梦画师返回完整数据:', JSON.stringify(data).substring(0, 500));
                
                // 🔧 URL验证函数：确保是有效的图片URL
                const isValidImageUrl = (url) => {
                    if (!url || typeof url !== 'string') return false;
                    if (url.startsWith('http://') || url.startsWith('https://')) return true;
                    if (url.startsWith('data:image/')) return true;
                    return false;
                };
                
                // 🌟 主要提取方式：从 data 数组提取 (标准 images/generations 格式)
                if (data?.data && Array.isArray(data.data)) {
                    for (const item of data.data) {
                        if (item?.url && isValidImageUrl(item.url)) {
                            imageUrls.push(item.url);
                        } else if (item?.b64_json) {
                            // base64 格式
                            imageUrls.push(`data:image/png;base64,${item.b64_json}`);
                        }
                    }
                    console.log('[yunwu] 从 data 数组提取到URL数量:', imageUrls.length);
                }
                
                // 🔧 备用：直接 data.url (单图简化格式)
                if (imageUrls.length === 0 && data?.url && isValidImageUrl(data.url)) {
                    imageUrls = [data.url];
                    console.log('[yunwu] 从 data.url 直接提取');
                }
                
                // 🔧 兼容旧格式：从 choices[0].message.content 提取
                if (imageUrls.length === 0) {
                    const content = data?.choices?.[0]?.message?.content;
                    if (content) {
                        console.log('[yunwu] 尝试从 choices.content 提取:', typeof content);
                        if (typeof content === 'string' && isValidImageUrl(content)) {
                            imageUrls = [content];
                        } else if (typeof content === 'string') {
                            // 尝试解析JSON字符串
                            try {
                                const parsed = JSON.parse(content);
                                if (Array.isArray(parsed)) {
                                    for (const item of parsed) {
                                        if (item?.url && isValidImageUrl(item.url)) imageUrls.push(item.url);
                                    }
                                } else if (parsed?.url && isValidImageUrl(parsed.url)) {
                                    imageUrls = [parsed.url];
                                }
                            } catch (e) { /* 非JSON字符串 */ }
                        } else if (Array.isArray(content)) {
                            for (const item of content) {
                                if (item?.url && isValidImageUrl(item.url)) imageUrls.push(item.url);
                                else if (item?.image_url?.url && isValidImageUrl(item.image_url.url)) imageUrls.push(item.image_url.url);
                            }
                        }
                    }
                }
                
                // 🔧 如果没有有效URL，返回错误并包含完整调试信息
                // ⚠️ 注意：API返回了数据但无法提取URL，说明上游已消耗，不退款
                if (imageUrls.length === 0) {
                    const debugInfo = JSON.stringify(data).substring(0, 800);
                    console.error('[yunwu] 星梦画师无有效图片URL, 原始返回:', debugInfo);
                    json(500, { 
                        success: false,
                        error: 'NO_VALID_IMAGE',
                        error_code: 'NO_VALID_IMAGE',
                        message: '星梦画师未返回有效图片URL',
                        debug: debugInfo,
                        billed: billingSuccess ? filmCost : 0  // 已消耗上游资源，不退款
                    });
                    return;
                }
                
                // ✅ 生成成功：保存记录并返回（已在开头扣费）
                const primaryUrl = imageUrls[0] || JSON.stringify(data);
                await __saveGenerationRecord(userId, 'image', primaryUrl, prompt, model, filmCost, { 
                    size, 
                    mode: actualMode,
                    refImageCount: multiImageMode ? image_urls.length : (image_url ? 1 : 0),
                    outputCount: imageUrls.length
                });
                
                // 返回内容
                json(200, { 
                    success: true, 
                    data,
                    url: imageUrls[0] || '',      // 主图 URL
                    urls: imageUrls,               // 🆕 所有图片 URL 数组
                    imageCount: imageUrls.length,  // 🆕 生成图片数量
                    mode: actualMode,              // 🆕 生成模式
                    billed: billingSuccess ? filmCost : 0 
                });
                return;
            } catch (err) {
                // 🔄 异常退款（网络超时等，上游未消耗资源）
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, '星梦画师异常退款');
                }
                json(500, { 
                    success: false,
                    error: 'API_ERROR',
                    error_code: 'API_ERROR',
                    message: err.message,
                    billed: 0
                });
                return;
            }
        }

        // ========== 图片分析/视觉识别/OCR ==========
        if (action === 'vision') {
            const { prompt, image_url, model: reqModel = 'grok-4-fast-non-reasoning' } = body;
            
            if (!prompt || !image_url) {
                json(400, { 
                    success: false,
                    error: 'MISSING_PROMPT_OR_IMAGE',
                    error_code: 'MISSING_PROMPT_OR_IMAGE',
                    billed: 0
                });
                return;
            }

            // 🔧 模型映射：用户友好名 → 实际API模型名
            const VISION_MODEL_MAP = {
                'deepseek-ocr': 'deepseek-ocr',               // OCR专用：云雾已配置
                'grok-4-fast-non-reasoning': 'grok-4-fast-non-reasoning',
                'gemini-2.0-flash': 'gemini-2.0-flash'
            };
            const model = VISION_MODEL_MAP[reqModel] || reqModel;
            const isOCR = reqModel === 'deepseek-ocr' || /ocr/i.test(reqModel);

            const filmCost = FILM_COST['vision'] || 2;
            let billingSuccess = false;

            console.log('[yunwu] 图片分析:', { reqModel, actualModel: model, isOCR, hasImage: !!image_url });

            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, isOCR ? 'OCR文字识别' : '图片分析');
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 图片分析跳过扣费: 前端已处理`);
            }

            try {
                // 🔧 OCR模式：添加系统提示 + 更大的max_tokens
                const ocrSystemMsg = isOCR ? {
                    role: 'system',
                    content: '你是专业的OCR文字识别引擎。请精确识别并输出图片中的所有文字内容，保持原始排版格式。如有表格，用markdown表格格式输出。如有多语言混排，分别标注语言。不要添加任何额外解释或评论，只输出识别到的文字。'
                } : null;
                const maxTokens = isOCR ? 4096 : (body.max_tokens || 800);

                const msgContent = [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: image_url } }
                ];
                const messages = [];
                if (ocrSystemMsg) messages.push(ocrSystemMsg);
                messages.push({ role: 'user', content: msgContent });

                const response = await fetchWithFallback(`/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model,
                        messages,
                        max_tokens: maxTokens
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] 图片分析错误:', response.status, errorText);
                    // 🔄 API失败退款
                    if (billingSuccess) {
                        await __billing('refund', userId, filmCost, '图片分析API失败退款');
                    }
                    json(500, { 
                        success: false,
                        error: 'API_ERROR',
                        error_code: 'API_ERROR',
                        message: `图片分析失败 (${response.status})`,
                        billed: 0
                    });
                    return;
                }

                const data = await response.json();
                const content = data?.choices?.[0]?.message?.content;
                
                // ✅ 生成成功：保存记录并返回（已在开头扣费）
                await __saveGenerationRecord(userId, 'text', content?.trim() || '', prompt, model, filmCost, { image_url });
                
                // 3. 返回内容
                json(200, { success: true, text: content?.trim() || '', billed: billingSuccess ? filmCost : 0 });
                return;
            } catch (err) {
                // 🔄 异常退款
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, '图片分析异常退款');
                }
                json(500, { 
                    success: false,
                    error: 'API_ERROR',
                    error_code: 'API_ERROR',
                    message: err.message,
                    billed: 0
                });
                return;
            }
        }

        // ========== AI对话 (按token实际消耗计费) ==========
        if (action === 'chat') {
            const { 
                messages = [],  // 多轮对话消息数组
                system = '',    // 系统提示词
                model = 'gemini-3-flash-preview',  // 默认用最便宜的
                temperature = 0.7,
                max_tokens = 4096,
                enableSearch = false  // 联网搜索
            } = body;
            
            if (!messages || messages.length === 0) {
                json(400, { success: false, error: 'MISSING_MESSAGES', billed: 0 });
                return;
            }

            // 💰 模型价格配置 (yunwu.ai 价格，每百万tokens)
            const MODEL_PRICING = {
                'grok-4-fast': { input: 1.5, output: 6.0 },               // 🌟 首选对话模型
                'grok-4-fast-non-reasoning': { input: 1.5, output: 6.0 }, // Grok-4 无推理版
                'gemini-3-flash-preview': { input: 0.15, output: 0.9 },   // 最便宜
                'qwen-plus': { input: 0.24, output: 0.6 },                // 中文优化
                'gemini-3-pro-preview': { input: 0.6, output: 3.6 },      // 多模态
                'gemini-3-pro-preview-thinking': { input: 0.6, output: 3.6 }  // 思考模式
            };
            
            // 获取价格，未知模型用flash的价格（最便宜）
            const pricing = MODEL_PRICING[model] || MODEL_PRICING['gemini-3-flash-preview'];
            
            console.log('[yunwu] AI对话:', { model, messagesCount: messages.length, enableSearch });

            // 构建请求消息
            let finalMessages = [...messages];
            if (system) {
                finalMessages.unshift({ role: 'system', content: system });
            }

            const timeoutMs = 120000;  // 2分钟超时

            // 🔧 优先尝试 MODELSCOPE（更稳定）
            const MODELSCOPE_API_KEY = process.env.MODELSCOPE_API_KEY || '';
            if (MODELSCOPE_API_KEY) {
                try {
                    console.log('[yunwu] chat 尝试魔塔模型...');
                    const msResponse = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${MODELSCOPE_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
                            messages: finalMessages,
                            temperature,
                            max_tokens,
                            stream: false
                        }),
                        signal: AbortSignal.timeout(180000)
                    });

                    if (msResponse.ok) {
                        const msData = await msResponse.json();
                        const msContent = msData?.choices?.[0]?.message?.content;
                        const msUsage = msData?.usage || {};
                        
                        // 📊 计算实际token消耗和费用
                        const promptTokens = msUsage.prompt_tokens || 0;
                        const completionTokens = msUsage.completion_tokens || 0;
                        const totalTokens = promptTokens + completionTokens;
                        const filmCost = Math.max(1, Math.ceil(totalTokens / 4000)); // 简化计费
                        
                        console.log(`[yunwu] 📊 魔塔Token: ${totalTokens} → ${filmCost}胶片`);
                        
                        // 💰 扣费
                        let billingSuccess = false;
                        if (!skipBilling && filmCost > 0 && userId) {
                            const billingResult = await __billing('consume', userId, filmCost, `AI对话:roll(${totalTokens}tokens)`);
                            if (!billingResult.success && !billingResult.skipped) {
                                json(400, { success: false, error: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                                return;
                            }
                            billingSuccess = billingResult.success && !billingResult.skipped;
                        }
                        
                        await __saveGenerationRecord(userId, 'chat', msContent?.trim() || '', messages[messages.length - 1]?.content || '', 'roll', filmCost, { promptTokens, completionTokens, totalTokens });
                        
                        json(200, { 
                            success: true, 
                            content: msContent?.trim() || '', 
                            usage: { promptTokens, completionTokens, totalTokens },
                            cost: { film: filmCost },
                            billed: billingSuccess ? filmCost : 0,
                            model: 'roll'
                        });
                        return;
                    }
                    console.warn('[yunwu] 魔塔模型失败，回退到云雾:', msResponse.status);
                } catch (msErr) {
                    console.warn('[yunwu] 魔塔模型异常，回退到云雾:', msErr.message);
                }
            }

            try {
                const requestBody = {
                    model,
                    messages: finalMessages,
                    temperature,
                    max_tokens,
                    stream: false
                };
                
                // 联网搜索模式
                if (enableSearch) {
                    requestBody.tools = [{ type: 'web_search' }];
                }

                const response = await fetchWithFallbackWithTimeout(`/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }, timeoutMs);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] AI对话错误:', response.status, errorText);
                    json(500, { success: false, error: 'API_ERROR', message: `AI对话失败 (${response.status})`, billed: 0 });
                    return;
                }

                const data = await response.json();
                const content = data?.choices?.[0]?.message?.content;
                const usage = data?.usage || {};
                
                // 📊 计算实际token消耗和费用
                const promptTokens = usage.prompt_tokens || 0;
                const completionTokens = usage.completion_tokens || 0;
                const totalTokens = promptTokens + completionTokens;
                
                // 计算成本（元）: (输入tokens × 输入价格 + 输出tokens × 输出价格) / 1000000
                const inputCost = (promptTokens * pricing.input) / 1000000;
                const outputCost = (completionTokens * pricing.output) / 1000000;
                const totalCostYuan = inputCost + outputCost;
                
                // 转换为胶片（1胶片 = ¥0.3），向上取整，最少1胶片
                const filmCost = Math.max(1, Math.ceil(totalCostYuan / 0.3));
                
                console.log(`[yunwu] 📊 Token: 输入${promptTokens}+输出${completionTokens}=${totalTokens}, 成本¥${totalCostYuan.toFixed(4)} → ${filmCost}胶片`);
                
                // 💰 按实际消耗扣费
                let billingSuccess = false;
                if (!skipBilling && filmCost > 0 && userId) {
                    const billingResult = await __billing('consume', userId, filmCost, `AI对话:${model}(${totalTokens}tokens)`);
                    if (!billingResult.success && !billingResult.skipped) {
                        json(400, { success: false, error: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                        return;
                    }
                    billingSuccess = billingResult.success && !billingResult.skipped;
                }
                
                // 保存记录
                await __saveGenerationRecord(userId, 'chat', content?.trim() || '', messages[messages.length - 1]?.content || '', model, filmCost, { 
                    promptTokens, completionTokens, totalTokens, enableSearch 
                });
                
                // 返回结果
                json(200, { 
                    success: true, 
                    content: content?.trim() || '', 
                    usage: { promptTokens, completionTokens, totalTokens },
                    cost: { yuan: totalCostYuan, film: filmCost },
                    billed: billingSuccess ? filmCost : 0,
                    model
                });
                return;
            } catch (err) {
                console.error('[yunwu] AI对话异常:', err.message);
                json(500, { success: false, error: 'API_ERROR', message: err.message, billed: 0 });
                return;
            }
        }

        // ========== 📤 文件上传代理（解决国内网络问题） ==========
        if (action === 'upload-file') {
            const { fileData, fileType = 'video/mp4', fileName = 'file.mp4' } = body;
            
            if (!fileData) {
                json(400, { success: false, error: 'MISSING_FILE_DATA' });
                return;
            }
            
            try {
                // 解析base64
                const base64Match = fileData.match(/^data:([^;]+);base64,(.+)$/);
                const mimeType = base64Match ? base64Match[1] : fileType;
                const b64 = base64Match ? base64Match[2] : fileData.replace(/^data:[^;]+;base64,/, '');
                const buffer = Buffer.from(b64, 'base64');
                
                console.log(`[yunwu] 📤 代理上传文件: ${fileName}, 大小: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
                
                // 方案１：尝试 catbox.moe
                try {
                    const FormData = require('form-data');
                    const formData = new FormData();
                    formData.append('reqtype', 'fileupload');
                    formData.append('fileToUpload', buffer, {
                        filename: fileName,
                        contentType: mimeType
                    });
                    
                    const catboxRes = await fetch('https://catbox.moe/user/api.php', {
                        method: 'POST',
                        body: formData,
                        headers: formData.getHeaders(),
                        signal: AbortSignal.timeout(60000)  // 60秒超时
                    });
                    
                    if (catboxRes.ok) {
                        const url = await catboxRes.text();
                        if (url && url.startsWith('http')) {
                            console.log('[yunwu] ✅ catbox上传成功:', url.trim());
                            json(200, { success: true, url: url.trim() });
                            return;
                        }
                    }
                } catch (catboxErr) {
                    console.warn('[yunwu] catbox上传失败:', catboxErr.message);
                }
                
                // 方案２：尝试 0x0.st（更稳定的备用图床）
                try {
                    const FormData = require('form-data');
                    const formData = new FormData();
                    formData.append('file', buffer, {
                        filename: fileName,
                        contentType: mimeType
                    });
                    
                    const nullRes = await fetch('https://0x0.st', {
                        method: 'POST',
                        body: formData,
                        headers: formData.getHeaders(),
                        signal: AbortSignal.timeout(60000)
                    });
                    
                    if (nullRes.ok) {
                        const url = await nullRes.text();
                        if (url && url.startsWith('http')) {
                            console.log('[yunwu] ✅ 0x0.st上传成功:', url.trim());
                            json(200, { success: true, url: url.trim() });
                            return;
                        }
                    }
                } catch (nullErr) {
                    console.warn('[yunwu] 0x0.st上传失败:', nullErr.message);
                }
                
                // 所有方案失败
                json(500, { success: false, error: '所有上传服务均不可用' });
            } catch (err) {
                console.error('[yunwu] 文件上传异常:', err.message);
                json(500, { success: false, error: err.message });
            }
            return;
        }

        // ========== 文本生成 (优先使用魔塔roll模型节约成本) ==========
        if (action === 'text') {
            const { prompt, model = 'roll', temperature = 0.7, max_tokens = 4096, speed = 1 } = body;
            
            if (!prompt) {
                json(400, { 
                    success: false,
                    error: 'MISSING_PROMPT',
                    error_code: 'MISSING_PROMPT',
                    billed: 0
                });
                return;
            }

            const filmCost = FILM_COST['text'] || 1;
            let billingSuccess = false;

            console.log('[yunwu] 文本生成:', { model, promptLen: prompt.length, speed });

            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, `文本生成:${model}`);
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 文本生成跳过扣费: 前端已处理`);
            }

            // 🆕 优先使用魔塔roll模型（免费节约成本）
            const MODELSCOPE_API_KEY = process.env.MODELSCOPE_API_KEY || '';
            const useRoll = (String(model).toLowerCase() === 'roll' || model === 'gemini-3-pro-preview') && MODELSCOPE_API_KEY;
            
            if (useRoll) {
                try {
                    const rollResponse = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${MODELSCOPE_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
                            messages: [{ role: 'user', content: prompt }],
                            temperature,
                            max_tokens,
                            stream: false
                        }),
                        signal: AbortSignal.timeout(180000)
                    });

                    if (rollResponse.ok) {
                        const rollData = await rollResponse.json();
                        const content = rollData?.choices?.[0]?.message?.content;
                        
                        // ✅ 生成成功：保存记录并返回（已在开头扣费）
                        await __saveGenerationRecord(userId, 'text', content?.trim() || '', prompt, 'roll', filmCost, {});
                        json(200, { success: true, content: content?.trim() || '', billed: billingSuccess ? filmCost : 0, model: 'roll' });
                        return;
                    }
                    console.warn('[yunwu] 魔塔roll模型失败，回退到云雾:', rollResponse.status);
                } catch (rollErr) {
                    console.warn('[yunwu] 魔塔roll模型异常，回退到云雾:', rollErr.message);
                }
            }

            // ✅ 回退到云雾API
            const timeoutMs = 60000;

            try {
                const response = await fetchWithFallbackWithTimeout(`/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gemini-3-pro-preview',
                        messages: [{ role: 'user', content: prompt }],
                        temperature,
                        max_tokens,
                        speed
                    })
                }, timeoutMs);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] 文本生成错误:', response.status, errorText);
                    // 🔄 API失败退款
                    if (billingSuccess) {
                        await __billing('refund', userId, filmCost, '文本生成API失败退款');
                    }
                    json(500, { 
                        success: false,
                        error: 'API_ERROR',
                        error_code: 'API_ERROR',
                        message: `文本生成失败 (${response.status})`,
                        billed: 0
                    });
                    return;
                }

                const data = await response.json();
                const content = data?.choices?.[0]?.message?.content;
                
                // ✅ 生成成功：保存记录并返回（已在开头扣费）
                await __saveGenerationRecord(userId, 'text', content?.trim() || '', prompt, model, filmCost, {});
                json(200, { success: true, content: content?.trim() || '', billed: billingSuccess ? filmCost : 0 });
                return;
            } catch (err) {
                // 🔄 异常退款
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, '文本生成异常退款');
                }
                json(500, { 
                    success: false,
                    error: 'API_ERROR',
                    error_code: 'API_ERROR',
                    message: err.message,
                    billed: 0
                });
                return;
            }
        }

        // ========== 视频生成 (sora-2 系列) ==========
        if (action === 'video') {
            const { 
                prompt, 
                model = 'sora-2', 
                image_url,
                aspect_ratio = '16:9',
                duration = '15',
                hd = false,
                character_ids = [],
                speed = 1
            } = body;
            
            if (!prompt && !image_url) {
                json(400, { 
                    success: false,
                    error: 'MISSING_PROMPT_OR_IMAGE',
                    error_code: 'MISSING_PROMPT_OR_IMAGE',
                    billed: 0
                });
                return;
            }

            // 💰 计费配置 - 支持多种模型
            let filmCost = 15; // 默认
            const modelLc = String(model).toLowerCase();
            if (FILM_COST[model]) {
                filmCost = FILM_COST[model];
            } else if (modelLc.startsWith('veo') || modelLc.startsWith('grok-video') || modelLc.startsWith('vidu') || modelLc.startsWith('hailuo') || modelLc.startsWith('kling') || modelLc.startsWith('wan26')) {
                filmCost = FILM_COST[model] || 15;
            } else if (hd) {
                filmCost = FILM_COST['video-hd'] || 25;
            }
            let billingSuccess = false;

            // 根据参数选择合适的模型
            let finalModel = model;
            if (model === 'sora-2') {
                if (character_ids && character_ids.length > 0) {
                    finalModel = 'sora-2-characters';
                }
            }

            console.log('[yunwu] 视频生成:', { 
                model: finalModel, 
                aspect_ratio, 
                duration, 
                hd,
                hasImage: !!image_url,
                characterCount: character_ids?.length || 0
            });

            const requestBody = {
                model: finalModel,
                prompt: prompt || ''
            };

            if (image_url) {
                requestBody.images = [image_url];
            }

            if (aspect_ratio) requestBody.aspect_ratio = aspect_ratio;
            if (duration) requestBody.duration = String(duration);
            if (hd) requestBody.hd = true;

            if (character_ids && character_ids.length > 0) {
                const characterMentions = character_ids.map(c => `@${c.username}`).join(' ');
                requestBody.prompt = `${characterMentions} ${requestBody.prompt}`;
            }

            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, `视频生成:${model}${hd ? '-HD' : ''}`);
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 视频生成跳过扣费: 前端已处理`);
            }

            const timeoutMs = 60000;

            try {
                const response = await fetchWithFallbackWithTimeout(`/v1/video/create`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }, timeoutMs);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] 视频生成错误:', response.status, errorText);
                    
                    let errorDetail = '';
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorDetail = errorJson?.error?.message || errorJson?.message || '';
                    } catch (e) {
                        errorDetail = errorText.substring(0, 200);
                    }
                    
                    // 🔄 API失败退款（未获得task_id）
                    if (billingSuccess) {
                        await __billing('refund', userId, filmCost, '视频生成API失败退款');
                    }
                    json(500, { 
                        success: false,
                        error: 'API_ERROR',
                        error_code: 'API_ERROR',
                        message: `视频生成失败 (${response.status}): ${errorDetail}`,
                        billed: 0
                    });
                    return;
                }

                const data = await response.json();
                
                // ✅ 任务提交成功：保存记录并返回（已在开头扣费，有task_id意味着上游已消耗，不退款）
                const taskId = data?.task_id || data?.id || '';
                await __saveGenerationRecord(userId, 'video', `task:${taskId}`, prompt, model, filmCost, { aspect_ratio, duration, hd });
                
                json(200, { success: true, ...data, billed: billingSuccess ? filmCost : 0 });
                return;
            } catch (err) {
                // 🔄 异常退款
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, '视频生成异常退款');
                }
                json(500, { 
                    success: false,
                    error: 'API_ERROR',
                    error_code: 'API_ERROR',
                    message: err.message,
                    billed: 0
                });
                return;
            }
        }

        // ========== Grok Video 3 视频生成 ==========
        // 支持模型: grok-video-3 (6秒), grok-video-3-10s (10秒)
        const bodyModel = body.model || '';
        if (action === 'grok' || (action === 'text-to-video' && bodyModel.startsWith('grok-video')) || (action === 'image-to-video' && bodyModel.startsWith('grok-video'))) {
            let { prompt, image_url, model: grokModel = 'grok-video-3', aspect_ratio = '16:9', duration } = body;
            
            if (!prompt && !image_url) {
                json(400, { 
                    success: false,
                    error: 'MISSING_PROMPT_OR_IMAGE',
                    error_code: 'MISSING_PROMPT_OR_IMAGE',
                    billed: 0
                });
                return;
            }
            
            const is10s = grokModel.includes('10s');
            // 🔧 去掉 -text 后缀
            const actualModel = grokModel.replace(/-text$/, '');
            const filmCost = FILM_COST[actualModel] || (is10s ? 8 : 5);
            let billingSuccess = false;

            // Grok 使用不同的 aspect_ratio 格式
            let grokAspectRatio = aspect_ratio;
            if (aspect_ratio === '16:9') grokAspectRatio = '3:2';
            else if (aspect_ratio === '9:16') grokAspectRatio = '2:3';

            console.log(`[yunwu] 🎬 Grok视频: ${actualModel}, duration=${is10s ? 10 : 6}s, hasImage=${!!image_url}`);

            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, `Grok视频:${actualModel}`);
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            }

            const requestBody = {
                model: actualModel,
                prompt: prompt || '',
                aspect_ratio: grokAspectRatio,
                size: '720P'
            };

            if (is10s) {
                requestBody.duration = 10;
            }

            if (image_url) {
                requestBody.images = [image_url];
            }

            try {
                const response = await fetchWithFallbackWithTimeout(`/v1/video/create`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }, 60000);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] Grok视频生成错误:', response.status, errorText);
                    
                    if (billingSuccess) {
                        await __billing('refund', userId, filmCost, 'Grok视频生成API失败退款');
                    }
                    
                    let errorDetail = '';
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorDetail = errorJson?.error?.message || errorJson?.message || '';
                    } catch (e) {
                        errorDetail = errorText.substring(0, 200);
                    }
                    
                    json(500, { 
                        success: false,
                        error: 'API_ERROR',
                        error_code: 'API_ERROR',
                        message: `Grok视频生成失败 (${response.status}): ${errorDetail}`,
                        billed: 0
                    });
                    return;
                }

                const data = await response.json();
                const taskId = data?.task_id || data?.id || '';
                await __saveGenerationRecord(userId, 'video', `task:${taskId}`, prompt, actualModel, filmCost, { aspect_ratio, duration: is10s ? 10 : 6 });
                
                json(200, { success: true, ...data, billed: billingSuccess ? filmCost : 0 });
                return;
            } catch (err) {
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, 'Grok视频生成异常退款');
                }
                json(500, { 
                    success: false,
                    error: 'API_ERROR',
                    error_code: 'API_ERROR',
                    message: err.message,
                    billed: 0
                });
                return;
            }
        }

        // ========== Veo 视频生成 - 使用官方 /v1/video/create API ==========
        // 支持模型: veo2, veo2-fast, veo2-pro, veo3, veo3-fast, veo3-pro, veo3.1-components 等
        // 🔧 图生视频必须使用 -frames 后缀模型（如 veo3-fast-frames）
        if (action === 'veo3') {
            // 🎬 支持前端传递的模型名，默认使用 veo3.1-components-4k (4K+音频)
            let { prompt, image_url, aspect_ratio = '16:9', model: veoModel = 'veo3.1-components-4k' } = body;
            
            if (!prompt && !image_url) {
                json(400, { 
                    success: false,
                    error: 'MISSING_PROMPT_OR_IMAGE',
                    error_code: 'MISSING_PROMPT_OR_IMAGE',
                    billed: 0
                });
                return;
            }
            
            // 🔧 直接使用前端传来的模型名
            const hasImage = !!image_url;
            let actualModel = veoModel || 'veo3.1-components-4k';
            console.log(`[yunwu] 🎬 Veo模型: ${actualModel} (hasImage=${hasImage})`);

            const filmCost = FILM_COST['veo3'] || 30;
            let billingSuccess = false;

            console.log('[yunwu] Veo生成:', { model: actualModel, originalModel: veoModel, hasImage, promptLen: prompt?.length, aspect_ratio });

            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, `Veo视频:${actualModel}`);
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 Veo跳过扣费: 前端已处理`);
            }

            try {
                // 🌟 使用官方 /v1/video/create API (JSON 格式)
                const requestBody = {
                    model: actualModel,
                    prompt: prompt || '让图片动起来，平滑过渡',
                    enhance_prompt: true,  // 必需参数
                    aspect_ratio: aspect_ratio
                };
                
                // 🧲 图生视频一致性增强参数（Veo）
                if (image_url) {
                    requestBody.preserve_subject = true;       // 保持主体不变
                    requestBody.image_weight = (body.image_weight != null) ? Number(body.image_weight) : 0.95;  // 高图片权重
                    requestBody.motion_intensity = body.motion_intensity || 'medium';  // 中等运动强度
                    requestBody.style_consistency = true;      // 风格一致性
                    console.log(`[yunwu] 🧲 Veo图生视频一致性参数: image_weight=${requestBody.image_weight}, preserve_subject=true`);
                }
                
                // 如果有图片参考，添加 images 数组
                if (image_url) {
                    // 如果是 base64，需要先上传到图床获取 URL
                    if (image_url.startsWith('data:')) {
                        // 尝试上传到 catbox 获取 URL
                        try {
                            const matches = image_url.match(/^data:([^;]+);base64,(.+)$/);
                            if (matches) {
                                const base64Data = matches[2];
                                const buffer = Buffer.from(base64Data, 'base64');
                                const FormData = (await import('form-data')).default;
                                const formData = new FormData();
                                formData.append('reqtype', 'fileupload');
                                formData.append('fileToUpload', buffer, { filename: 'image.png', contentType: 'image/png' });
                                
                                const uploadRes = await fetch('https://catbox.moe/user/api.php', {
                                    method: 'POST',
                                    body: formData
                                });
                                if (uploadRes.ok) {
                                    const uploadUrl = (await uploadRes.text()).trim();
                                    if (uploadUrl.startsWith('http')) {
                                        requestBody.images = [uploadUrl];
                                    }
                                }
                            }
                        } catch (uploadErr) {
                            console.warn('[yunwu] 图片上传失败:', uploadErr.message);
                        }
                    } else {
                        // 直接使用 URL
                        requestBody.images = [image_url];
                    }
                }

                console.log('[yunwu] Veo请求体:', JSON.stringify(requestBody).substring(0, 500));

                // 使用更长超时，4K视频生成需要更多时间
                const response = await fetchWithFallbackWithTimeout(`/v1/video/create`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }, 120000);  // 120秒超时

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] Veo错误:', response.status, errorText);
                    
                    let errorDetail = '';
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorDetail = errorJson?.error?.message || errorJson?.message || errorText.substring(0, 200);
                    } catch (e) {
                        errorDetail = errorText.substring(0, 200);
                    }
                    
                    // 🔄 API失败退款
                    if (billingSuccess) {
                        await __billing('refund', userId, filmCost, 'VeoAPI失败退款');
                    }
                    json(500, { 
                        success: false,
                        error: 'API_ERROR',
                        error_code: 'API_ERROR',
                        message: `Veo生成失败 (${response.status}): ${errorDetail}`,
                        billed: 0
                    });
                    return;
                }

                const data = await response.json();
                
                // ✅ 任务提交成功：保存记录并返回
                const taskId = data?.task_id || data?.id || '';
                await __saveGenerationRecord(userId, 'video', `task:${taskId}`, prompt, veoModel, filmCost, { aspect_ratio });
                
                json(200, { success: true, ...data, billed: billingSuccess ? filmCost : 0 });
                return;
            } catch (err) {
                console.error('[yunwu] Veo异常:', err);
                // 🔄 异常退款
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, 'Veo异常退款');
                }
                json(500, { 
                    success: false,
                    error: 'API_ERROR',
                    error_code: 'API_ERROR',
                    message: err.message,
                    billed: 0
                });
                return;
            }
        }

        // ========== Vidu 视频生成 - 使用云雾 API /tencent-vod/v1/aigc-video ==========
        // 支持多图参考 (q2模型支持1-7张图片)
        if (action === 'vidu') {
            const { 
                prompt, 
                image_url,           // 单图（兼容旧版）
                image_urls,          // 多图数组（最多7张）
                model_version = 'q2',      // q2, q2-pro, q2-turbo
                aspect_ratio = '16:9', 
                duration = 5,              // 1-10秒
                resolution = '720P',       // 720P, 1080P
                last_frame_url             // 尾帧图片（q2-pro/q2-turbo支持）
            } = body;
            
            // 合并 image_url 和 image_urls
            let allImageUrls = [];
            if (image_urls && Array.isArray(image_urls)) {
                allImageUrls = image_urls.filter(u => u);
            } else if (image_url) {
                allImageUrls = [image_url];
            }
            
            if (!prompt && allImageUrls.length === 0) {
                json(400, { 
                    success: false,
                    error: 'MISSING_PROMPT_OR_IMAGE',
                    error_code: 'MISSING_PROMPT_OR_IMAGE',
                    message: '请提供提示词或参考图片',
                    billed: 0
                });
                return;
            }
            
            // q2模型最多支持7张图片
            if (allImageUrls.length > 7) {
                json(400, { 
                    success: false,
                    error: 'TOO_MANY_IMAGES',
                    error_code: 'TOO_MANY_IMAGES',
                    message: 'Vidu q2模型最多支持7张参考图片',
                    billed: 0
                });
                return;
            }

            // 根据版本和分辨率计算费用
            const costKey = `vidu-${model_version}-${resolution.toLowerCase()}`;
            const filmCost = FILM_COST[costKey] || 5;
            let billingSuccess = false;

            console.log('[yunwu] Vidu生成:', { model_version, resolution, imageCount: allImageUrls.length, promptLen: prompt?.length, aspect_ratio, duration, hasLastFrame: !!last_frame_url });

            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, `Vidu视频:${model_version}-${resolution}`);
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 Vidu跳过扣费: 前端已处理`);
            }

            try {
                // 构建请求体 - 按照 aigc-video-vidu API 规范
                const requestBody = {
                    model_name: 'Vidu',
                    model_version: model_version,
                    prompt: prompt || '让图片动起来，平滑过渡',
                    enhance_prompt: 'Enabled',
                    output_config: {
                        storage_mode: 'Temporary',
                        aspect_ratio: aspect_ratio,
                        duration: parseInt(duration) || 5,
                        resolution: resolution,
                        person_generation: 'AllowAdult',
                        input_compliance_check: 'Enabled',
                        output_compliance_check: 'Enabled'
                    }
                };
                
                // 🧲 Vidu图生视频一致性增强参数
                if (allImageUrls.length > 0) {
                    requestBody.preserve_subject = true;       // 保持主体不变
                    requestBody.image_weight = (body.image_weight != null) ? Number(body.image_weight) : 0.95;
                    requestBody.motion_intensity = body.motion_intensity || 'medium';
                    requestBody.style_consistency = true;
                    console.log(`[yunwu] 🧲 Vidu图生视频一致性参数: image_weight=${requestBody.image_weight}, imageCount=${allImageUrls.length}`);
                }
                
                // 🖼️ 处理参考图片（支持多图）
                if (allImageUrls.length > 0) {
                    const fileInfos = [];
                    
                    for (let i = 0; i < allImageUrls.length; i++) {
                        let imgUrl = allImageUrls[i];
                        
                        // 如果是 base64，需要先上传到图床获取 URL
                        if (imgUrl.startsWith('data:')) {
                            try {
                                const matches = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
                                if (matches) {
                                    const base64Data = matches[2];
                                    const buffer = Buffer.from(base64Data, 'base64');
                                    const FormData = (await import('form-data')).default;
                                    const formData = new FormData();
                                    formData.append('reqtype', 'fileupload');
                                    formData.append('fileToUpload', buffer, { filename: `image_${i}.png`, contentType: 'image/png' });
                                    
                                    const uploadRes = await fetch('https://catbox.moe/user/api.php', {
                                        method: 'POST',
                                        body: formData
                                    });
                                    if (uploadRes.ok) {
                                        const uploadUrl = (await uploadRes.text()).trim();
                                        if (uploadUrl.startsWith('http')) {
                                            imgUrl = uploadUrl;
                                        }
                                    }
                                }
                            } catch (uploadErr) {
                                console.warn(`[yunwu] Vidu图片${i}上传失败:`, uploadErr.message);
                            }
                        }
                        
                        // 添加有效URL到 file_infos
                        if (imgUrl && !imgUrl.startsWith('data:')) {
                            fileInfos.push({
                                type: 'Url',
                                url: imgUrl
                            });
                        }
                    }
                    
                    if (fileInfos.length > 0) {
                        requestBody.file_infos = fileInfos;
                    }
                }
                
                // 🎬 尾帧图片支持（q2-pro/q2-turbo）
                if (last_frame_url && (model_version === 'q2-pro' || model_version === 'q2-turbo')) {
                    let finalLastFrameUrl = last_frame_url;
                    if (last_frame_url.startsWith('data:')) {
                        try {
                            const matches = last_frame_url.match(/^data:([^;]+);base64,(.+)$/);
                            if (matches) {
                                const buffer = Buffer.from(matches[2], 'base64');
                                const FormData = (await import('form-data')).default;
                                const formData = new FormData();
                                formData.append('reqtype', 'fileupload');
                                formData.append('fileToUpload', buffer, { filename: 'last_frame.png', contentType: 'image/png' });
                                const uploadRes = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: formData });
                                if (uploadRes.ok) {
                                    const url = (await uploadRes.text()).trim();
                                    if (url.startsWith('http')) finalLastFrameUrl = url;
                                }
                            }
                        } catch (e) {
                            console.warn('[yunwu] Vidu尾帧上传失败:', e.message);
                        }
                    }
                    if (finalLastFrameUrl && !finalLastFrameUrl.startsWith('data:')) {
                        requestBody.last_frame_url = finalLastFrameUrl;
                    }
                }

                console.log('[yunwu] Vidu请求体:', JSON.stringify(requestBody).substring(0, 500));

                // 调用云雾 API
                const response = await fetchWithFallbackWithTimeout(`/tencent-vod/v1/aigc-video`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }, 120000);  // 120秒超时

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] Vidu错误:', response.status, errorText);
                    
                    let errorDetail = '';
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorDetail = errorJson?.error?.message || errorJson?.message || errorText.substring(0, 200);
                    } catch (e) {
                        errorDetail = errorText.substring(0, 200);
                    }
                    
                    // 🔄 API失败退款
                    if (billingSuccess) {
                        await __billing('refund', userId, filmCost, 'ViduAPI失败退款');
                    }
                    json(500, { 
                        success: false,
                        error: 'API_ERROR',
                        error_code: 'API_ERROR',
                        message: `Vidu生成失败 (${response.status}): ${errorDetail}`,
                        billed: 0
                    });
                    return;
                }

                const data = await response.json();
                
                // ✅ 任务提交成功：保存记录并返回
                const taskId = data?.request_id || data?.task_id || data?.id || '';
                await __saveGenerationRecord(userId, 'video', `task:${taskId}`, prompt, `vidu-${model_version}`, filmCost, { aspect_ratio, duration, resolution, imageCount: allImageUrls.length });
                
                // 返回结果，兼容前端轮询格式
                json(200, { 
                    success: true, 
                    task_id: taskId,
                    id: taskId,
                    status: data?.status || 'IN_QUEUE',
                    status_url: data?.status_url,
                    response_url: data?.response_url,
                    ...data, 
                    billed: billingSuccess ? filmCost : 0 
                });
                return;
            } catch (err) {
                console.error('[yunwu] Vidu异常:', err);
                // 🔄 异常退款
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, 'Vidu异常退款');
                }
                json(500, { 
                    success: false,
                    error: 'API_ERROR',
                    error_code: 'API_ERROR',
                    message: err.message,
                    billed: 0
                });
                return;
            }
        }

        // ========== Hailuo 海螺视频生成 - 使用云雾 API /tencent-vod/v1/aigc-video ==========
        if (action === 'hailuo') {
            const { 
                prompt, 
                image_url,
                model_version = '02',      // 02, 2.3, 2.3-fast
                duration = 6,              // 6 或 10 秒
                resolution = '768P'        // 768P, 1080P
            } = body;
            
            if (!prompt && !image_url) {
                json(400, { 
                    success: false,
                    error: 'MISSING_PROMPT_OR_IMAGE',
                    error_code: 'MISSING_PROMPT_OR_IMAGE',
                    message: '请提供提示词或参考图片',
                    billed: 0
                });
                return;
            }

            // 根据版本和分辨率计算费用 (hailuo-{version}-{resolution}-{duration}s)
            // version: 02 -> 02, 2.3-fast -> fast
            const versionKey = model_version === '2.3-fast' ? 'fast' : model_version;
            const costKey = `hailuo-${versionKey}-${resolution.toLowerCase()}-${duration}s`;
            const filmCost = FILM_COST[costKey] || 7;
            let billingSuccess = false;

            console.log('[yunwu] Hailuo生成:', { model_version, resolution, duration, hasImage: !!image_url, promptLen: prompt?.length, costKey });

            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, `Hailuo视频:${model_version}-${resolution}-${duration}s`);
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 Hailuo跳过扣费: 前端已处理`);
            }

            try {
                // 构建请求体 - 按照 aigc-video API 规范
                const requestBody = {
                    model_name: 'Hailuo',
                    model_version: model_version,
                    prompt: prompt || '让图片动起来，平滑过渡',
                    enhance_prompt: 'Disabled',
                    output_config: {
                        storage_mode: 'Temporary',
                        duration: parseInt(duration) || 6,
                        resolution: resolution,
                        person_generation: 'AllowAdult',
                        input_compliance_check: 'Enabled',
                        output_compliance_check: 'Enabled'
                    }
                };
                
                // 🧲 Hailuo图生视频一致性增强参数
                if (image_url) {
                    requestBody.preserve_subject = true;       // 保持主体不变
                    requestBody.image_weight = (body.image_weight != null) ? Number(body.image_weight) : 0.95;
                    requestBody.motion_intensity = body.motion_intensity || 'medium';
                    requestBody.style_consistency = true;
                    console.log(`[yunwu] 🧲 Hailuo图生视频一致性参数: image_weight=${requestBody.image_weight}`);
                }
                
                // 如果有参考图片
                if (image_url) {
                    let finalImageUrl = image_url;
                    if (image_url.startsWith('data:')) {
                        try {
                            const matches = image_url.match(/^data:([^;]+);base64,(.+)$/);
                            if (matches) {
                                const buffer = Buffer.from(matches[2], 'base64');
                                const FormData = (await import('form-data')).default;
                                const formData = new FormData();
                                formData.append('reqtype', 'fileupload');
                                formData.append('fileToUpload', buffer, { filename: 'image.png', contentType: 'image/png' });
                                const uploadRes = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: formData });
                                if (uploadRes.ok) {
                                    const url = (await uploadRes.text()).trim();
                                    if (url.startsWith('http')) finalImageUrl = url;
                                }
                            }
                        } catch (e) {
                            console.warn('[yunwu] Hailuo图片上传失败:', e.message);
                        }
                    }
                    if (finalImageUrl && !finalImageUrl.startsWith('data:')) {
                        requestBody.file_infos = [{ type: 'Url', url: finalImageUrl }];
                    }
                }

                console.log('[yunwu] Hailuo请求体:', JSON.stringify(requestBody).substring(0, 500));

                const response = await fetchWithFallbackWithTimeout(`/tencent-vod/v1/aigc-video`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }, 120000);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] Hailuo错误:', response.status, errorText);
                    let errorDetail = '';
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorDetail = errorJson?.error?.message || errorJson?.message || errorText.substring(0, 200);
                    } catch (e) {
                        errorDetail = errorText.substring(0, 200);
                    }
                    if (billingSuccess) {
                        await __billing('refund', userId, filmCost, 'HailuoAPI失败退款');
                    }
                    json(500, { 
                        success: false, error: 'API_ERROR', error_code: 'API_ERROR',
                        message: `Hailuo生成失败 (${response.status}): ${errorDetail}`, billed: 0
                    });
                    return;
                }

                const data = await response.json();
                const taskId = data?.request_id || data?.task_id || data?.id || '';
                await __saveGenerationRecord(userId, 'video', `task:${taskId}`, prompt, `hailuo-${model_version}`, filmCost, { duration, resolution });
                
                json(200, { 
                    success: true, 
                    task_id: taskId, id: taskId,
                    status: data?.status || 'IN_QUEUE',
                    status_url: data?.status_url, response_url: data?.response_url,
                    ...data, billed: billingSuccess ? filmCost : 0 
                });
                return;
            } catch (err) {
                console.error('[yunwu] Hailuo异常:', err);
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, 'Hailuo异常退款');
                }
                json(500, { success: false, error: 'API_ERROR', error_code: 'API_ERROR', message: err.message, billed: 0 });
                return;
            }
        }

        // ========== Kling 可灵视频生成 - 使用云雾 API /tencent-vod/v1/aigc-video ==========
        if (action === 'kling') {
            const { 
                prompt, 
                image_url,
                last_frame_url,            // 尾帧图片（2.1版本+1080P支持）
                model_version = '2.5',     // 1.6, 2.0, 2.1, 2.5, O1
                aspect_ratio = '16:9',     // 16:9, 9:16, 1:1
                duration = 5,              // 5 或 10 秒
                resolution = '720P'        // 720P, 1080P
            } = body;
            
            if (!prompt && !image_url) {
                json(400, { 
                    success: false,
                    error: 'MISSING_PROMPT_OR_IMAGE',
                    error_code: 'MISSING_PROMPT_OR_IMAGE',
                    message: '请提供提示词或参考图片',
                    billed: 0
                });
                return;
            }

            // 根据版本和分辨率计算费用 (kling-{version}-{resolution}-{duration}s)
            // O1 -> o1
            const versionKey = model_version.toLowerCase();
            const costKey = `kling-${versionKey}-${resolution.toLowerCase()}-${duration}s`;
            const filmCost = FILM_COST[costKey] || 10;
            let billingSuccess = false;

            console.log('[yunwu] Kling生成:', { model_version, resolution, duration, aspect_ratio, hasImage: !!image_url, hasLastFrame: !!last_frame_url, promptLen: prompt?.length, costKey });

            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, `Kling视频:${model_version}-${resolution}-${duration}s`);
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 Kling跳过扣费: 前端已处理`);
            }

            try {
                // 构建请求体
                const requestBody = {
                    model_name: 'Kling',
                    model_version: model_version,
                    prompt: prompt || '让图片动起来，平滑过渡',
                    enhance_prompt: 'Disabled',
                    output_config: {
                        storage_mode: 'Temporary',
                        aspect_ratio: aspect_ratio,
                        duration: parseInt(duration) || 5,
                        resolution: resolution,
                        person_generation: 'AllowAdult',
                        input_compliance_check: 'Enabled',
                        output_compliance_check: 'Enabled'
                    }
                };
                
                // 🧲 Kling图生视频一致性增强参数
                if (image_url) {
                    requestBody.preserve_subject = true;       // 保持主体不变
                    requestBody.image_weight = (body.image_weight != null) ? Number(body.image_weight) : 0.95;
                    requestBody.motion_intensity = body.motion_intensity || 'medium';
                    requestBody.style_consistency = true;
                    console.log(`[yunwu] 🧲 Kling图生视频一致性参数: image_weight=${requestBody.image_weight}`);
                }
                
                // 如果有参考图片
                if (image_url) {
                    let finalImageUrl = image_url;
                    if (image_url.startsWith('data:')) {
                        try {
                            const matches = image_url.match(/^data:([^;]+);base64,(.+)$/);
                            if (matches) {
                                const buffer = Buffer.from(matches[2], 'base64');
                                const FormData = (await import('form-data')).default;
                                const formData = new FormData();
                                formData.append('reqtype', 'fileupload');
                                formData.append('fileToUpload', buffer, { filename: 'image.png', contentType: 'image/png' });
                                const uploadRes = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: formData });
                                if (uploadRes.ok) {
                                    const url = (await uploadRes.text()).trim();
                                    if (url.startsWith('http')) finalImageUrl = url;
                                }
                            }
                        } catch (e) {
                            console.warn('[yunwu] Kling图片上传失败:', e.message);
                        }
                    }
                    if (finalImageUrl && !finalImageUrl.startsWith('data:')) {
                        requestBody.file_infos = [{ type: 'Url', url: finalImageUrl }];
                    }
                }
                
                // 尾帧图片支持（2.1版本 + 1080P）
                if (last_frame_url && model_version === '2.1' && resolution === '1080P') {
                    let finalLastFrameUrl = last_frame_url;
                    if (last_frame_url.startsWith('data:')) {
                        try {
                            const matches = last_frame_url.match(/^data:([^;]+);base64,(.+)$/);
                            if (matches) {
                                const buffer = Buffer.from(matches[2], 'base64');
                                const FormData = (await import('form-data')).default;
                                const formData = new FormData();
                                formData.append('reqtype', 'fileupload');
                                formData.append('fileToUpload', buffer, { filename: 'last_frame.png', contentType: 'image/png' });
                                const uploadRes = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: formData });
                                if (uploadRes.ok) {
                                    const url = (await uploadRes.text()).trim();
                                    if (url.startsWith('http')) finalLastFrameUrl = url;
                                }
                            }
                        } catch (e) {
                            console.warn('[yunwu] Kling尾帧上传失败:', e.message);
                        }
                    }
                    if (finalLastFrameUrl && !finalLastFrameUrl.startsWith('data:')) {
                        requestBody.last_frame_url = finalLastFrameUrl;
                    }
                }

                console.log('[yunwu] Kling请求体:', JSON.stringify(requestBody).substring(0, 500));

                const response = await fetchWithFallbackWithTimeout(`/tencent-vod/v1/aigc-video`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }, 120000);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] Kling错误:', response.status, errorText);
                    let errorDetail = '';
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorDetail = errorJson?.error?.message || errorJson?.message || errorText.substring(0, 200);
                    } catch (e) {
                        errorDetail = errorText.substring(0, 200);
                    }
                    if (billingSuccess) {
                        await __billing('refund', userId, filmCost, 'KlingAPI失败退款');
                    }
                    json(500, { 
                        success: false, error: 'API_ERROR', error_code: 'API_ERROR',
                        message: `Kling生成失败 (${response.status}): ${errorDetail}`, billed: 0
                    });
                    return;
                }

                const data = await response.json();
                const taskId = data?.request_id || data?.task_id || data?.id || '';
                await __saveGenerationRecord(userId, 'video', `task:${taskId}`, prompt, `kling-${model_version}`, filmCost, { aspect_ratio, duration, resolution });
                
                json(200, { 
                    success: true, 
                    task_id: taskId, id: taskId,
                    status: data?.status || 'IN_QUEUE',
                    status_url: data?.status_url, response_url: data?.response_url,
                    ...data, billed: billingSuccess ? filmCost : 0 
                });
                return;
            } catch (err) {
                console.error('[yunwu] Kling异常:', err);
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, 'Kling异常退款');
                }
                json(500, { success: false, error: 'API_ERROR', error_code: 'API_ERROR', message: err.message, billed: 0 });
                return;
            }
        }

        // ========== Wan2.6 文生视频/图生视频 (alibailian API) ==========
        // 云雾API支持: wan2.6-i2v, wan2.6-i2v-flash (文生视频和图生视频)
        if (action === 'wan26') {
            const {
                prompt,
                img_url,
                negative_prompt = '',
                resolution = '720P',
                duration = 5,
                audio = false,
                image_weight = 0.3,
                prompt_extend = true,
                seed
            } = body;

            const isTextToVideo = !img_url;

            // 根据参数计算费用
            const dur = parseInt(duration) || 5;
            const res720 = String(resolution).includes('720');
            const resKey = res720 ? '720p' : '1080p';
            const durKey = `${dur}s`;
            const audioSuffix = audio ? '-audio' : '';
            const costKey = `wan26-${resKey}-${durKey}${audioSuffix}`;
            const filmCost = FILM_COST[costKey] || FILM_COST['wan26-720p-5s'] || 3;
            let billingSuccess = false;

            console.log('[yunwu] Wan2.6视频:', { type: isTextToVideo ? '文生视频' : '图生视频', resolution: resKey, duration: dur, audio, image_weight, costKey, filmCost, promptLen: prompt?.length, hasImage: !!img_url });

            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, `Wan2.6:${resKey}-${durKey}${audioSuffix}`);
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 Wan2.6跳过扣费: 前端已处理`);
            }

            try {
                // 构建 alibailian API 请求体
                const requestBody = {
                    model: 'wan2.6-i2v-flash',
                    input: {
                        prompt: prompt || '让图片动起来，平滑过渡'
                    },
                    parameters: {
                        resolution: res720 ? '720P' : '1080P',
                        duration: dur,
                        prompt_extend: prompt_extend !== false,
                        watermark: false,
                        audio: !!audio
                    }
                };

                // 图生视频添加img_url
                if (!isTextToVideo) {
                    requestBody.input.img_url = img_url;
                    requestBody.parameters.image_weight = Number(image_weight) || 0.3;
                }
                if (negative_prompt) {
                    requestBody.input.negative_prompt = negative_prompt;
                }
                if (seed) {
                    requestBody.parameters.seed = seed;
                }

                console.log('[yunwu] Wan2.6请求体:', JSON.stringify(requestBody).substring(0, 500));

                const response = await fetchWithFallbackWithTimeout(
                    `/alibailian/api/v1/services/aigc/video-generation/video-synthesis`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${YUNWU_API_KEY}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    },
                    120000  // 120秒超时
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] Wan2.6错误:', response.status, errorText);
                    let errorDetail = '';
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorDetail = errorJson?.error?.message || errorJson?.message || errorText.substring(0, 200);
                    } catch (e) {
                        errorDetail = errorText.substring(0, 200);
                    }
                    if (billingSuccess) {
                        await __billing('refund', userId, filmCost, 'Wan2.6API失败退款');
                    }
                    json(500, {
                        success: false, error: 'API_ERROR', error_code: 'API_ERROR',
                        message: `Wan2.6生成失败 (${response.status}): ${errorDetail}`, billed: 0
                    });
                    return;
                }

                const data = await response.json();
                // alibailian 返回格式: { output: { task_id, task_status }, request_id, usage }
                const taskId = data?.output?.task_id || data?.task_id || data?.request_id || data?.id || '';
                const taskStatus = data?.output?.task_status || data?.status || 'PENDING';
                await __saveGenerationRecord(userId, 'video', `task:${taskId}`, prompt, 'wan2.6-i2v-flash', filmCost, { resolution: resKey, duration: dur, audio, image_weight });

                json(200, {
                    success: true,
                    task_id: taskId,
                    id: taskId,
                    status: taskStatus,
                    _source: 'wan26',
                    ...data,
                    billed: billingSuccess ? filmCost : 0
                });
                return;
            } catch (err) {
                console.error('[yunwu] Wan2.6异常:', err);
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, 'Wan2.6异常退款');
                }
                json(500, { success: false, error: 'API_ERROR', error_code: 'API_ERROR', message: err.message, billed: 0 });
                return;
            }
        }

        // ========== Wan2.6 任务轮询 ==========
        if (action === 'wan26-poll') {
            const { task_id } = body;
            if (!task_id) {
                json(400, { success: false, error: 'MISSING_TASK_ID', message: '缺少 task_id' });
                return;
            }

            try {
                const response = await fetchWithFallbackWithTimeout(
                    `/alibailian/api/v1/tasks/${encodeURIComponent(task_id)}`,
                    {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${YUNWU_API_KEY}`,
                            'Accept': 'application/json'
                        }
                    },
                    30000
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    console.warn('[yunwu] Wan2.6轮询失败:', response.status, errorText);
                    json(200, { success: false, status: 'PENDING', error: `轮询失败: ${response.status}` });
                    return;
                }

                const data = await response.json();
                // alibailian 轮询返回: { output: { task_id, task_status, video_url }, request_id, usage }
                const taskStatus = String(data?.output?.task_status || data?.status || 'PENDING').toUpperCase();
                const videoUrl = data?.output?.video_url || data?.video_url || '';

                // 映射状态到统一格式
                let normalizedStatus = 'PENDING';
                if (taskStatus === 'SUCCEEDED' || taskStatus === 'SUCCESS' || taskStatus === 'COMPLETED' || taskStatus === 'DONE') {
                    normalizedStatus = 'SUCCESS';
                } else if (taskStatus === 'FAILED' || taskStatus === 'FAILURE' || taskStatus === 'ERROR' || taskStatus === 'CANCELED') {
                    normalizedStatus = 'FAILED';
                } else if (taskStatus === 'RUNNING' || taskStatus === 'PROCESSING' || taskStatus === 'PENDING' || taskStatus === 'QUEUING') {
                    normalizedStatus = 'PENDING';
                }

                console.log(`[yunwu] Wan2.6轮询: taskId=${task_id}, status=${taskStatus} → ${normalizedStatus}, hasVideo=${!!videoUrl}`);

                json(200, {
                    success: normalizedStatus === 'SUCCESS',
                    status: normalizedStatus,
                    task_status: taskStatus,
                    video_url: videoUrl,
                    url: videoUrl,
                    ...data
                });
                return;
            } catch (err) {
                console.warn('[yunwu] Wan2.6轮询异常:', err.message);
                json(200, { success: false, status: 'PENDING', error: `轮询异常: ${err.message}` });
                return;
            }
        }

        // ========== 创建角色 (sora-2-characters) ==========
        if (action === 'create-character') {
            const { url, from_task, timestamps = '1,3' } = body;
            
            if (!url && !from_task) {
                json(400, { 
                    success: false,
                    error: 'MISSING_URL_OR_TASK_ID', 
                    error_code: 'MISSING_URL_OR_TASK_ID',
                    message: '需要提供视频URL或任务ID',
                    billed: 0
                });
                return;
            }

            const filmCost = FILM_COST['create-character'] || 5;
            let billingSuccess = false;

            console.log('[yunwu] 创建角色:', { hasUrl: !!url, hasTask: !!from_task, timestamps });

            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, '创建角色');
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 创建角色跳过扣费: 前端已处理`);
            }

            const requestBody = { timestamps };
            if (url) requestBody.url = url;
            if (from_task) requestBody.from_task = from_task;

            try {
                const response = await fetchWithFallback(`/sora/v1/characters`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] 创建角色错误:', response.status, errorText);
                    // 🔄 API失败退款
                    if (billingSuccess) {
                        await __billing('refund', userId, filmCost, '创建角色API失败退款');
                    }
                    json(500, { 
                        success: false,
                        error: 'API_ERROR',
                        error_code: 'API_ERROR',
                        message: `创建角色失败 (${response.status})`,
                        billed: 0
                    });
                    return;
                }

                const data = await response.json();
                
                // ✅ 创建成功：返回角色信息（已在开头扣费）
                json(200, { success: true, character: data, billed: billingSuccess ? filmCost : 0 });
                return;
            } catch (err) {
                // 🔄 异常退款
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, '创建角色异常退款');
                }
                json(500, { 
                    success: false,
                    error: 'API_ERROR',
                    error_code: 'API_ERROR',
                    message: err.message,
                    billed: 0
                });
                return;
            }
        }

        // ========== Midjourney 图片生成 ==========
        if (action === 'midjourney' || action === 'mj-imagine') {
            const {
                prompt,
                model = 'midjourney-fast',
                aspect_ratio = '1:1',
                version = '6.1',
                style,
                quality = 1,
                chaos = 0,
                stylize = 100,
                image_url  // 🆕 参考图（图生图）
            } = body;

            if (!prompt) {
                json(400, { success: false, error: 'MISSING_PROMPT', message: '请输入提示词', billed: 0 });
                return;
            }

            // Midjourney 计费配置
            const MJ_COSTS = { 'midjourney-fast': 2, 'midjourney-turbo': 2, 'midjourney-relax': 2 };
            const filmCost = MJ_COSTS[model] || 20;
            let billingSuccess = false;
            let taskIdObtained = false;  // 标记是否获得了任务ID（上游已消耗）

            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, `Midjourney:${model}`);
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 Midjourney跳过扣费: 前端已处理`);
            }

            // 🔧 优化提示词：清理所有已有参数，然后重新添加正确格式
            let optimizedPrompt = prompt.trim()
                // 清理各种 MJ 参数格式（包括错误格式）
                .replace(/\s*--ar\s*[\d:x\u00d7]+\s*/gi, ' ')        // --ar 16:9, --ar 16x9
                .replace(/\s*--v\s*[\d.]+\s*/gi, ' ')               // --v 6.1, --v 7
                .replace(/\s*--niji\s*\d*\s*/gi, ' ')               // --niji, --niji 6
                .replace(/\s*--style\s*\w+\s*/gi, ' ')              // --style raw
                .replace(/\s*--q\s*[\d.]+\s*/gi, ' ')               // --q 1, --q 0.5
                .replace(/\s*--quality\s*[\d.]+\s*/gi, ' ')         // --quality 1
                .replace(/\s*--chaos\s*\d+\s*/gi, ' ')              // --chaos 50
                .replace(/\s*--s\s*\d+\s*/gi, ' ')                  // --s 100
                .replace(/\s*--stylize\s*\d+\s*/gi, ' ')            // --stylize 100
                .replace(/\s*--seed\s*\d+\s*/gi, ' ')               // --seed 12345
                .replace(/\s*--no\s+[\w,\s]+(?=\s*--|$)/gi, ' ')    // --no text, watermark
                .replace(/\s*--iw\s*[\d.]+\s*/gi, ' ')              // --iw 0.5
                .replace(/\s*--tile\s*/gi, ' ')                      // --tile
                .replace(/\s*--repeat\s*\d+\s*/gi, ' ')             // --repeat 4
                .replace(/\s*--cref\s*\S+\s*/gi, ' ')               // --cref url
                .replace(/\s*--sref\s*\S+\s*/gi, ' ')               // --sref url
                .replace(/\s*--cw\s*\d+\s*/gi, ' ')                 // --cw 100
                .replace(/\s*--sw\s*\d+\s*/gi, ' ')                 // --sw 100
                .replace(/\s*--p\s*/gi, ' ')                         // --p (personalization)
                .replace(/\s*--w\s*\d+\s*/gi, ' ')                  // --w 1920 (无效参数)
                .replace(/\s*--h\s*\d+\s*/gi, ' ')                  // --h 1080 (无效参数)
                .replace(/\s*--aspect\s*[\d:x]+\s*/gi, ' ')         // --aspect 16:9 (错误格式)
                .replace(/\s*--ratio\s*[\d:x]+\s*/gi, ' ')          // --ratio 16:9 (错误格式)
                .replace(/\s*--version\s*[\d.]+\s*/gi, ' ')         // --version 6 (错误格式)
                .replace(/\s*--\w+\s*[\d.:]*(?=\s|$)/g, ' ')        // 其他未知参数
                .replace(/\s{2,}/g, ' ')                             // 多个空格合并
                .trim();
            
            // 重新添加正确格式的参数
            if (aspect_ratio && aspect_ratio !== '1:1') optimizedPrompt += ` --ar ${aspect_ratio}`;
            // 🔧 修复 niji 版本参数：niji6 需要用 --niji 6 而不是 --v niji6
            if (version) {
                if (version.startsWith('niji')) {
                    const nijiVersion = version.replace('niji', '') || '6';
                    optimizedPrompt += ` --niji ${nijiVersion}`;
                } else {
                    optimizedPrompt += ` --v ${version}`;
                }
            }
            if (style) optimizedPrompt += ` --style ${style}`;
            if (quality && quality !== 1) optimizedPrompt += ` --q ${quality}`;
            if (chaos && chaos > 0) optimizedPrompt += ` --chaos ${chaos}`;
            if (stylize && stylize !== 100) optimizedPrompt += ` --s ${stylize}`;

            console.log('[yunwu] 🎨 Midjourney:', { model, aspectRatio: aspect_ratio, hasRefImage: !!image_url, prompt: optimizedPrompt.substring(0, 80) });

            // 速度模式
            let speedMode = 'FAST';
            if (model === 'midjourney-turbo') speedMode = 'TURBO';
            else if (model === 'midjourney-relax') speedMode = 'RELAX';

            // 🆕 处理参考图（图生图）
            let base64Array = [];
            if (image_url) {
                try {
                    let refBase64 = image_url;
                    // 如果是 URL，需要先转换成 base64
                    if (image_url.startsWith('http://') || image_url.startsWith('https://')) {
                        console.log('[yunwu] 🖼️ MJ 图生图: 正在转换参考图 URL 为 base64...');
                        const imgRes = await fetch(image_url);
                        if (imgRes.ok) {
                            const buffer = await imgRes.arrayBuffer();
                            const base64Data = Buffer.from(buffer).toString('base64');
                            const contentType = imgRes.headers.get('content-type') || 'image/png';
                            refBase64 = `data:${contentType};base64,${base64Data}`;
                        }
                    }
                    // 去掉 data:xxx;base64, 前缀，MJ API 只需要纯 base64
                    if (refBase64.startsWith('data:')) {
                        refBase64 = refBase64.split(',')[1] || refBase64;
                    }
                    base64Array = [refBase64];
                    console.log(`[yunwu] 🖼️ MJ 图生图: 参考图已准备, 大小: ${Math.round(refBase64.length / 1024)}KB`);
                } catch (refErr) {
                    console.warn('[yunwu] MJ 参考图处理失败:', refErr.message);
                }
            }

            try {
                // 提交 Imagine 任务
                const submitResponse = await fetchWithFallbackWithTimeout('/mj-turbo/mj/submit/imagine', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        prompt: optimizedPrompt,
                        base64Array: base64Array,  // 🆕 传入参考图（图生图）
                        notifyHook: '',
                        state: '',
                        mode: speedMode
                    })
                }, 60000);

                if (!submitResponse.ok) {
                    const errorText = await submitResponse.text();
                    console.error('[yunwu] Midjourney 提交失败:', submitResponse.status, errorText);
                    // 🔄 任务提交失败退款
                    if (billingSuccess) {
                        await __billing('refund', userId, filmCost, 'MJ提交失败退款');
                    }
                    json(500, { success: false, error: 'MJ_SUBMIT_FAILED', message: `Midjourney 提交失败: ${submitResponse.status}`, billed: 0 });
                    return;
                }

                const submitData = await submitResponse.json();
                if (submitData.code !== 1 && submitData.code !== 22) {
                    // 🔄 任务提交失败退款
                    if (billingSuccess) {
                        await __billing('refund', userId, filmCost, 'MJ任务提交失败退款');
                    }
                    json(500, { success: false, error: 'MJ_TASK_FAILED', message: submitData.description || 'Midjourney 任务提交失败', billed: 0 });
                    return;
                }

                const mjTaskId = submitData.result;
                taskIdObtained = true;  // ✅ 获得了任务ID，上游已消耗资源，后续不退款
                console.log('[yunwu] 🎯 Midjourney 任务已提交:', mjTaskId);

                // 🚀 优化轮询：渐进式间隔，首次不等待
                // 前10次: 2秒间隔 (0-20秒)
                // 后续: 3秒间隔 (20秒-3分钟)
                let imageUrl = null;
                const maxAttempts = 70;  // 约3分钟
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    // 🆕 首次立即轮询，不等待
                    if (attempt > 0) {
                        const interval = attempt < 10 ? 2000 : 3000;  // 渐进式：前10次2秒，后续3秒
                        await new Promise(resolve => setTimeout(resolve, interval));
                    }

                    try {
                        const pollResponse = await fetchWithFallbackWithTimeout(`/mj-turbo/mj/task/${mjTaskId}/fetch`, {
                            method: 'GET',
                            headers: { 'Authorization': `Bearer ${YUNWU_API_KEY}` }
                        }, 10000);  // 缩短超时到10秒

                        if (!pollResponse.ok) continue;

                        const pollData = await pollResponse.json();
                        const status = pollData.status;
                        const progress = pollData.progress || 0;
                        
                        // 🆕 输出进度日志（每5次或有进度变化时）
                        if (attempt % 5 === 0 || progress > 0) {
                            console.log(`[yunwu] 🔄 MJ轮询 (${attempt + 1}/${maxAttempts}): ${status} ${progress}%`);
                        }

                        if (status === 'SUCCESS') {
                            imageUrl = pollData.imageUrl;
                            console.log('[yunwu] ✅ Midjourney 生成成功:', imageUrl);
                            break;
                        } else if (status === 'FAILURE') {
                            throw new Error(pollData.failReason || 'Midjourney 生成失败');
                        }
                        // IN_PROGRESS, SUBMITTED, NOT_START 继续等待
                    } catch (pollErr) {
                        console.warn('[yunwu] Midjourney 轮询异常:', pollErr.message);
                    }
                }

                if (!imageUrl) {
                    // ⚠️ 任务已提交但超时，上游已消耗资源，不退款
                    json(500, { success: false, error: 'MJ_TIMEOUT', message: 'Midjourney 生成超时', billed: billingSuccess ? filmCost : 0 });
                    return;
                }

                // 🔪 直接返回网格图 + taskId，由前端切图选择后再调 upscale
                // 不在这里自动 upscale 4张，避免浪费 API 调用
                
                // 🔄 把网格图转成 base64，解决前端跨域切图问题
                let gridBase64 = null;
                try {
                    const imgResponse = await fetch(imageUrl);
                    if (imgResponse.ok) {
                        const buffer = await imgResponse.arrayBuffer();
                        const base64 = Buffer.from(buffer).toString('base64');
                        const contentType = imgResponse.headers.get('content-type') || 'image/png';
                        gridBase64 = `data:${contentType};base64,${base64}`;
                        console.log(`[yunwu] 🖼️ 网格图已转 base64, 大小: ${Math.round(base64.length / 1024)}KB`);
                    }
                } catch (imgErr) {
                    console.warn('[yunwu] 网格图转 base64 失败:', imgErr.message);
                }
                
                // 保存记录（已在开头扣费）
                await __saveGenerationRecord(userId, 'image', imageUrl, prompt, model, filmCost, { aspect_ratio, version, taskId: mjTaskId });

                json(200, { 
                    success: true, 
                    imageUrl,  // 网格图 URL
                    url: imageUrl, 
                    gridBase64,  // 🆕 base64 网格图，前端用这个切图
                    taskId: mjTaskId,  // 前端需要用这个调 upscale
                    billed: billingSuccess ? filmCost : 0 
                });
                return;
            } catch (err) {
                // 🔄 只有在未获得任务ID时才退款
                if (billingSuccess && !taskIdObtained) {
                    await __billing('refund', userId, filmCost, 'MJ异常退款');
                }
                json(500, { success: false, error: 'MJ_ERROR', message: err.message, billed: taskIdObtained ? (billingSuccess ? filmCost : 0) : 0 });
                return;
            }
        }
        
        // ========== Midjourney Upscale 单张放大 ==========
        if (action === 'mj-upscale') {
            const { taskId, index } = body;  // index: 1-4
            
            if (!taskId || !index) {
                json(400, { success: false, error: 'MISSING_PARAMS', message: '缺少 taskId 或 index' });
                return;
            }
            
            // 💰 Upscale 扣费 1 胶片
            const upscaleCost = 1;
            let billingSuccess = false;
            let taskIdObtained = false;  // 标记是否获得了任务ID
            
            console.log(`[yunwu] 🔍 Upscale 请求: taskId=${taskId}, index=${index}`);
            
            // 🔒 先扣费
            if (!skipBilling && upscaleCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, upscaleCost, 'MJ Upscale');
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 MJ Upscale跳过扣费: 前端已处理`);
            }
            
            try {
                // 提交 upscale 任务
                const upscaleResponse = await fetchWithFallbackWithTimeout('/mj-turbo/mj/submit/upscale', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        taskId: taskId,
                        index: parseInt(index),
                        mode: 'FAST'
                    })
                }, 60000);
                
                if (!upscaleResponse.ok) {
                    const errText = await upscaleResponse.text();
                    // 🔄 提交失败退款
                    if (billingSuccess) {
                        await __billing('refund', userId, upscaleCost, 'Upscale提交失败退款');
                    }
                    json(500, { success: false, error: 'UPSCALE_SUBMIT_FAILED', message: `Upscale 提交失败: ${upscaleResponse.status}`, billed: 0 });
                    return;
                }
                
                const upscaleData = await upscaleResponse.json();
                if (upscaleData.code !== 1 && upscaleData.code !== 22) {
                    // 🔄 任务提交失败退款
                    if (billingSuccess) {
                        await __billing('refund', userId, upscaleCost, 'Upscale任务提交失败退款');
                    }
                    json(500, { success: false, error: 'UPSCALE_FAILED', message: upscaleData.description || 'Upscale 任务提交失败', billed: 0 });
                    return;
                }
                
                const upscaleTaskId = upscaleData.result;
                taskIdObtained = true;  // ✅ 获得了任务ID，上游已消耗资源
                console.log(`[yunwu] 🎯 Upscale 任务已提交: ${upscaleTaskId}`);
                
                // 🚀 优化轮询：首次不等待，2秒间隔
                let upscaleImageUrl = null;
                const maxUpscaleAttempts = 45;  // 约90秒
                for (let attempt = 0; attempt < maxUpscaleAttempts; attempt++) {
                    // 🆕 首次立即轮询，不等待
                    if (attempt > 0) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    
                    try {
                        const pollResponse = await fetchWithFallbackWithTimeout(`/mj-turbo/mj/task/${upscaleTaskId}/fetch`, {
                            method: 'GET',
                            headers: { 'Authorization': `Bearer ${YUNWU_API_KEY}` }
                        }, 8000);  // 缩短超时
                        
                        if (pollResponse.ok) {
                            const pollData = await pollResponse.json();
                            // 🆕 减少日志刷屏，每5次输出一次
                            if (attempt % 5 === 0) {
                                console.log(`[yunwu] 🔄 Upscale轮询 (${attempt + 1}/${maxUpscaleAttempts}): ${pollData.status}`);
                            }
                            
                            if (pollData.status === 'SUCCESS') {
                                upscaleImageUrl = pollData.imageUrl;
                                break;
                            } else if (pollData.status === 'FAILURE') {
                                // ⚠️ 任务已提交但失败，上游已消耗资源，不退款
                                json(500, { success: false, error: 'UPSCALE_FAILED', message: pollData.failReason || 'Upscale 失败', billed: billingSuccess ? upscaleCost : 0 });
                                return;
                            }
                        }
                    } catch (pollErr) {
                        console.warn('[yunwu] Upscale轮询异常:', pollErr.message);
                    }
                }
                
                if (!upscaleImageUrl) {
                    // ⚠️ 任务已提交但超时，上游已消耗资源，不退款
                    json(500, { success: false, error: 'UPSCALE_TIMEOUT', message: 'Upscale 超时', billed: billingSuccess ? upscaleCost : 0 });
                    return;
                }
                
                // ✅ Upscale 成功（已在开头扣费）
                console.log(`[yunwu] ✅ Upscale 成功:`, upscaleImageUrl);
                json(200, { success: true, imageUrl: upscaleImageUrl, url: upscaleImageUrl, billed: billingSuccess ? upscaleCost : 0 });
                return;
            } catch (err) {
                // 🔄 只有在未获得任务ID时才退款
                if (billingSuccess && !taskIdObtained) {
                    await __billing('refund', userId, upscaleCost, 'Upscale异常退款');
                }
                json(500, { success: false, error: 'UPSCALE_ERROR', message: err.message, billed: taskIdObtained ? (billingSuccess ? upscaleCost : 0) : 0 });
                return;
            }
        }

        // ========== Midjourney 轮询任务状态 ==========
        if (action === 'mj-poll') {
            const { taskId } = body;

            if (!taskId) {
                json(400, { success: false, error: 'MISSING_TASK_ID', message: '缺少 taskId' });
                return;
            }

            try {
                const pollResponse = await fetchWithFallbackWithTimeout(`/mj-turbo/mj/task/${taskId}/fetch`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${YUNWU_API_KEY}` }
                }, 15000);

                if (!pollResponse.ok) {
                    json(200, { success: false, status: 'IN_PROGRESS' });
                    return;
                }

                const pollData = await pollResponse.json();
                const status = pollData.status;

                if (status === 'SUCCESS') {
                    json(200, { success: true, status: 'SUCCESS', imageUrl: pollData.imageUrl, taskId });
                } else if (status === 'FAILURE') {
                    json(200, { success: false, status: 'FAILURE', message: pollData.failReason });
                } else {
                    json(200, { success: false, status: status || 'IN_PROGRESS', progress: pollData.progress || 0 });
                }
            } catch (err) {
                json(200, { success: false, status: 'IN_PROGRESS', message: err.message });
            }
            return;
        }

        // ========== 轮询视频任务状态 (Veo等) ==========
        if (action === 'poll') {
            const { task_id } = body;
            
            if (!task_id) {
                json(400, { error: 'MISSING_TASK_ID' });
                return;
            }

            // ✅ 轮询应更短，避免占用函数执行时间
            const response = await fetchWithFallbackWithTimeout(`/v1/videos/${task_id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${YUNWU_API_KEY}`
                }
            }, 15000);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[yunwu] 轮询错误:', response.status, errorText);
                json(200, { success: false, status: 'PENDING', error: `轮询失败: ${response.status}` });
                return;
            }

            const data = await response.json();
            json(200, { success: true, ...data });
            return;
        }
        
        // ========== 🆕 轮询腾讯VOD视频任务状态 (Vidu/Hailuo/Kling) ==========
        if (action === 'poll-vod') {
            const { task_id } = body;
            
            if (!task_id) {
                json(400, { error: 'MISSING_TASK_ID' });
                return;
            }

            console.log('[yunwu] 📽️ 轮询腾讯VOD任务:', task_id);

            try {
                const response = await fetchWithFallbackWithTimeout(`/tencent-vod/v1/query/${task_id}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Accept': 'application/json'
                    }
                }, 15000);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[yunwu] VOD轮询错误:', response.status, errorText);
                    json(200, { success: false, status: 'PENDING', error: `轮询失败: ${response.status}` });
                    return;
                }

                const data = await response.json();
                console.log('[yunwu] VOD轮询返回:', JSON.stringify(data).substring(0, 500));
                
                // 解析腾讯VOD的返回结构
                // Response.Status: FINISH / PROCESSING / FAIL
                // Response.AigcVideoTask.Output.VideoInfos[0].FileUrl
                const vodResponse = data?.Response || data;
                const status = vodResponse?.Status || vodResponse?.AigcVideoTask?.Status || '';
                
                if (status === 'FINISH') {
                    // 成功完成
                    const videoInfos = vodResponse?.AigcVideoTask?.Output?.VideoInfos || [];
                    const videoUrl = videoInfos[0]?.FileUrl || '';
                    
                    if (videoUrl) {
                        console.log('[yunwu] ✅ VOD视频生成成功:', videoUrl);
                        json(200, { 
                            success: true, 
                            status: 'COMPLETED',
                            video_url: videoUrl,
                            url: videoUrl,
                            output_url: videoUrl,
                            data: vodResponse
                        });
                    } else {
                        console.warn('[yunwu] VOD任务完成但无视频URL');
                        json(200, { success: false, status: 'FAILED', error: '未获取到视频URL' });
                    }
                } else if (status === 'FAIL' || status === 'FAILED') {
                    // 失败
                    const errMsg = vodResponse?.AigcVideoTask?.ErrCodeExt || vodResponse?.Error?.Message || '视频生成失败';
                    console.error('[yunwu] ❌ VOD视频生成失败:', errMsg);
                    json(200, { success: false, status: 'FAILED', error: errMsg });
                } else {
                    // 进行中
                    const progress = vodResponse?.AigcVideoTask?.Progress || 0;
                    console.log(`[yunwu] ⏳ VOD视频生成中... ${progress}%`);
                    json(200, { success: false, status: 'PENDING', progress });
                }
            } catch (err) {
                console.error('[yunwu] VOD轮询异常:', err.message);
                json(200, { success: false, status: 'PENDING', error: err.message });
            }
            return;
        }

        // ========== 🎵 TTS 配音功能 ==========
        
        // 获取音色列表
        if (action === 'tts-voices') {
            const { grade, gender, pageIndex, pageSize, keyword } = body;
            
            // 检查TTS API KEY是否配置
            if (!TTS_API_KEY || TTS_API_KEY.length < 20) {
                console.error('[yunwu] TTS_API_KEY 未配置或无效');
                json(200, { success: false, error: 'TTS服务未配置，请联系管理员' });
                return;
            }
            
            try {
                const requestBody = {
                    pageIndex: pageIndex || 1,
                    pageSize: pageSize || 100,
                    grade: grade || 'premium'
                };
                if (gender !== undefined && gender !== '') requestBody.gender = parseInt(gender);
                if (keyword) requestBody.keyword = keyword;
                
                console.log('[yunwu] TTS请求音色列表:', TTS_BASE_URL, JSON.stringify(requestBody));
                
                const authHeaders = getDubbingXBearerHeaders();
                const response = await fetch(`${TTS_BASE_URL}/v2/getTTSTimbreList`, {
                    method: 'POST',
                    headers: {
                        'Authorization': authHeaders.Authorization,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(15000)
                });
                
                if (!response.ok) {
                    const errText = await response.text().catch(() => '');
                    console.error(`[yunwu] TTS API返回 ${response.status}:`, errText.substring(0, 200));
                    json(200, { success: false, error: `TTS服务异常(${response.status})` });
                    return;
                }
                
                const data = await response.json();
                
                if (data.success && data.data?.list) {
                    console.log(`[yunwu] TTS音色列表成功，共${data.data.list.length}个`);
                    json(200, { 
                        success: true, 
                        voices: data.data.list,
                        total: data.data.total
                    });
                } else {
                    console.warn('[yunwu] TTS音色列表返回异常:', JSON.stringify(data).substring(0, 300));
                    json(200, { success: false, error: data.msg || '获取音色失败' });
                }
            } catch (err) {
                console.error('[yunwu] TTS音色列表错误:', err.message);
                json(200, { success: false, error: 'TTS服务连接失败: ' + err.message });
            }
            return;
        }
        
        // TTS生成（带队列控制）
        if (action === 'tts-generate') {
            const { voiceId, text, language, audioSpeed, audioPitch, audioVolume, fileFormat, emotion, userId } = body;
            
            if (!voiceId || !text) {
                json(400, { error: 'MISSING_PARAMS', message: '缺少voiceId或text' });
                return;
            }
            
            // 检查并发数
            if (ttsCurrentConcurrent >= TTS_MAX_CONCURRENT) {
                // 返回队列位置
                const queuePosition = ttsQueue.length + 1;
                console.log(`[yunwu] TTS队列已满，当前位置: ${queuePosition}`);
                json(200, { 
                    success: false, 
                    queuePosition,
                    message: `当前排队位置: ${queuePosition}，请稍后重试`
                });
                return;
            }
            
            ttsCurrentConcurrent++;
            console.log(`[yunwu] TTS并发: ${ttsCurrentConcurrent}/${TTS_MAX_CONCURRENT}`);
            console.log(`[yunwu] TTS请求参数: voiceId=${voiceId}, textLen=${text?.length}, language=${language}`);
            
            try {
                // DubbingX v2 API 使用 SSML 格式
                const speed = audioSpeed || 1;
                const pitch = audioPitch || 1;
                const lang = language || 'zh';
                // emotion 必须提供，默认使用“常规-日常说话-1”
                const emo = emotion || '常规-日常说话-1';
                
                // 构建 SSML 文本
                const ssmlText = `<speak voiceId="${voiceId}" language="${lang}" emotion="${emo}" audioPitch="${pitch}" audioSpeed="${speed}">${text}</speak>`;
                
                const requestBody = {
                    text: ssmlText
                };
                
                console.log(`[yunwu] TTS v2 SSML请求:`, ssmlText.substring(0, 200));
                
                const ttsAuthHeaders = getDubbingXBearerHeaders();
                const response = await fetch(`${TTS_BASE_URL}/v2/addTtsTask`, {
                    method: 'POST',
                    headers: {
                        'Authorization': ttsAuthHeaders.Authorization,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
                
                const data = await response.json();
                console.log('[yunwu] DubbingX TTS响应:', JSON.stringify(data).substring(0, 500));
                
                if (data.success && (data.data?.id || data.data?.taskId)) {
                    const taskId = data.data?.taskId || data.data?.id;
                    // 扣费
                    const cost = 2;  // TTS固定2胶片
                    if (userId && !skipBilling) {
                        await __billing('consume', userId, cost, 'TTS配音');
                    }
                    
                    json(200, { 
                        success: true, 
                        taskId: taskId,
                        message: '任务已提交'
                    });
                } else {
                    // 详细记录错误
                    console.error('[yunwu] DubbingX TTS失败:', JSON.stringify(data));
                    const errMsg = data.msg || data.message || data.error || 'TTS任务创建失败';
                    // 返回更详细的错误信息给前端
                    json(200, { 
                        success: false, 
                        error: `${errMsg} (voiceId: ${voiceId})`, 
                        detail: data.data || null,
                        rawResponse: JSON.stringify(data).substring(0, 200)
                    });
                }
            } catch (err) {
                console.error('[yunwu] TTS生成错误:', err.message);
                json(500, { success: false, error: err.message });
            } finally {
                ttsCurrentConcurrent--;
            }
            return;
        }
        
        // Gemini TTS生成（实时返回音频）
        // 支持 flash 和 pro 两个版本
        if (action === 'gemini-tts') {
            const { text, voiceName, model, userId } = body;
            // model: 'flash' 或 'pro'，默认 flash
            
            if (!text) {
                json(400, { error: 'MISSING_TEXT', message: '缺少text参数' });
                return;
            }
            
            // 检查并发数
            if (ttsCurrentConcurrent >= TTS_MAX_CONCURRENT) {
                const queuePosition = ttsQueue.length + 1;
                json(200, { 
                    success: false, 
                    queuePosition,
                    message: `当前排队位置: ${queuePosition}，请稍后重试`
                });
                return;
            }
            
            ttsCurrentConcurrent++;
            
            // 选择模型：flash(便宜快速) 或 pro(高质量)
            const isProModel = model === 'pro';
            const ttsModel = isProModel ? 'gemini-2.5-pro-preview-tts' : 'gemini-2.5-flash-preview-tts';
            const cost = isProModel ? FILM_COST['tts-gemini-pro'] : FILM_COST['tts-gemini-flash'];
            
            console.log(`[yunwu] Gemini TTS并发: ${ttsCurrentConcurrent}/${TTS_MAX_CONCURRENT}, 模型: ${ttsModel}`);
            
            try {
                const requestBody = {
                    contents: [{
                        parts: [{ text: text }]
                    }],
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName: voiceName || 'Kore'
                                }
                            }
                        }
                    }
                };
                
                const response = await fetchWithFallbackWithTimeout(`/v1beta/models/${ttsModel}:generateContent?key=${YUNWU_API_KEY}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${YUNWU_API_KEY}`
                    },
                    body: JSON.stringify(requestBody)
                }, 60000);
                
                if (!response.ok) {
                    const errText = await response.text();
                    console.error('[yunwu] Gemini TTS错误:', response.status, errText);
                    throw new Error(`Gemini TTS失败: ${response.status}`);
                }
                
                const data = await response.json();
                
                // 解析音频数据
                let audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                let mimeType = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/mp3';
                
                if (audioData) {
                    // 🔧 PCM → WAV 转换：Gemini 返回的 audio/L16 是原始 PCM 数据，浏览器无法直接播放
                    if (mimeType && (mimeType.includes('L16') || mimeType.includes('pcm') || mimeType.includes('raw'))) {
                        const rateMatch = mimeType.match(/rate=(\d+)/);
                        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
                        const channels = 1;
                        const bitsPerSample = 16;
                        const pcmBuffer = Buffer.from(audioData, 'base64');
                        const dataLength = pcmBuffer.length;
                        const wavBuffer = Buffer.alloc(44 + dataLength);
                        // RIFF header
                        wavBuffer.write('RIFF', 0);
                        wavBuffer.writeUInt32LE(36 + dataLength, 4);
                        wavBuffer.write('WAVE', 8);
                        // fmt chunk
                        wavBuffer.write('fmt ', 12);
                        wavBuffer.writeUInt32LE(16, 16);
                        wavBuffer.writeUInt16LE(1, 20);
                        wavBuffer.writeUInt16LE(channels, 22);
                        wavBuffer.writeUInt32LE(sampleRate, 24);
                        wavBuffer.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
                        wavBuffer.writeUInt16LE(channels * bitsPerSample / 8, 32);
                        wavBuffer.writeUInt16LE(bitsPerSample, 34);
                        // data chunk
                        wavBuffer.write('data', 36);
                        wavBuffer.writeUInt32LE(dataLength, 40);
                        pcmBuffer.copy(wavBuffer, 44);
                        audioData = wavBuffer.toString('base64');
                        mimeType = 'audio/wav';
                        console.log(`[yunwu] Gemini TTS: PCM→WAV 转换完成, sampleRate=${sampleRate}, size=${dataLength}bytes`);
                    }

                    // 扣费
                    if (userId && !skipBilling) {
                        await __billing('consume', userId, cost, `Gemini ${isProModel ? 'Pro' : 'Flash'} TTS配音`);
                    }
                    
                    json(200, { 
                        success: true, 
                        audioData: audioData,  // base64编码的音频（WAV格式）
                        mimeType: mimeType,
                        model: ttsModel,
                        message: '生成成功'
                    });
                } else {
                    throw new Error('未获取到音频数据');
                }
            } catch (err) {
                console.error('[yunwu] Gemini TTS错误:', err.message);
                json(500, { success: false, error: err.message });
            } finally {
                ttsCurrentConcurrent--;
            }
            return;
        }
        
        // TTS轮询状态
        if (action === 'tts-poll') {
            const { taskId } = body;
            
            if (!taskId) {
                json(400, { error: 'MISSING_TASK_ID' });
                return;
            }
            
            try {
                const response = await fetch(`${TTS_BASE_URL}/v1/getTtsTaskInfo/${taskId}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${TTS_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                });
                
                const data = await response.json();
                
                if (data.success && data.data) {
                    const taskInfo = data.data;
                    json(200, {
                        success: true,
                        status: taskInfo.status,
                        fileUrl: taskInfo.fileUrl,
                        fileName: taskInfo.fileName
                    });
                } else {
                    json(200, { success: false, status: 'Pending' });
                }
            } catch (err) {
                console.error('[yunwu] TTS轮询错误:', err.message);
                json(200, { success: false, status: 'Pending', error: err.message });
            }
            return;
        }
        
        // ========== 🎤 VC 变声 ==========
        
        // 获取VC音色列表
        if (action === 'vc-list') {
            const { pageIndex, pageSize, isMyModel, keyword, gender, ageGroup } = body;
            try {
                const headers = { ...getDubbingXBearerHeaders(), 'Content-Type': 'application/json' };
                const requestBody = {
                    pageIndex: pageIndex || 1,
                    pageSize: pageSize || 50,
                    isMyModel: isMyModel ?? false,
                    keyword,
                    gender,
                    ageGroup
                };
                console.log('[yunwu] VC音色列表请求:', VC_BASE_URL, JSON.stringify(requestBody));
                
                const response = await fetch(`${VC_BASE_URL}/v1/getVCTimbreList`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(15000)
                });
                
                if (!response.ok) {
                    const errText = await response.text().catch(() => '');
                    console.error(`[yunwu] VC API返回 ${response.status}:`, errText.substring(0, 300));
                    json(200, { success: false, error: `VC服务异常(${response.status}): ${errText.substring(0, 100)}` });
                    return;
                }
                
                const data = await response.json();
                console.log('[yunwu] VC音色列表返回:', JSON.stringify(data).substring(0, 300));
                
                if (data.success && data.data) {
                    json(200, { success: true, voices: data.data, total: data.data.length || 0 });
                } else {
                    json(200, { success: false, voices: [], total: 0, error: data.msg || '获取音色失败' });
                }
            } catch (err) {
                console.error('[yunwu] VC音色列表错误:', err.message);
                json(500, { success: false, error: 'VC服务连接失败: ' + err.message });
            }
            return;
        }
        
        // 创建VC变声任务（上传文件 + 创建任务）
        if (action === 'vc-create') {
            const { audioData, timbreId, pitch, userId } = body;
            if (!audioData || !timbreId) {
                json(400, { error: 'MISSING_PARAMS', message: '缺少audioData或timbreId参数' });
                return;
            }
            try {
                // 扣费（默认2胶片，可按需调整）
                const cost = 2;
                if (userId) {
                    await __billing('consume', userId, cost, 'VC变声');
                }
                
                // 解析base64
                const match = audioData.match(/^data:(.+);base64,(.+)$/);
                const mimeType = match ? match[1] : 'audio/wav';
                const b64 = match ? match[2] : audioData;
                const buffer = Buffer.from(b64, 'base64');
                
                // 上传文件
                const form = new FormData();
                form.append('file', new Blob([buffer], { type: mimeType }), 'voice.wav');
                
                const uploadRes = await fetch(`${VC_BASE_URL}/v1/uploadFile`, {
                    method: 'POST',
                    headers: getDubbingXBearerHeaders(),
                    body: form
                });
                const uploadData = await uploadRes.json();
                if (!uploadData.success || !uploadData.data?.key) {
                    throw new Error(uploadData.msg || '上传音频失败');
                }
                
                // 创建变声任务
                const taskRes = await fetch(`${VC_BASE_URL}/v1/addVoiceConvertTask`, {
                    method: 'POST',
                    headers: { ...getDubbingXBearerHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        timbreId: timbreId,
                        pitch: typeof pitch === 'number' ? pitch : 0,
                        fileKey: uploadData.data.key
                    })
                });
                const taskData = await taskRes.json();
                if (taskData.success && taskData.data?.taskId) {
                    json(200, { success: true, taskId: taskData.data.taskId });
                } else {
                    throw new Error(taskData.msg || '创建变声任务失败');
                }
            } catch (err) {
                console.error('[yunwu] VC任务创建错误:', err.message);
                json(500, { success: false, error: err.message });
            }
            return;
        }
        
        // VC任务查询
        if (action === 'vc-poll') {
            const { taskId } = body;
            if (!taskId) {
                json(400, { error: 'MISSING_TASK_ID' });
                return;
            }
            try {
                const response = await fetch(`${VC_BASE_URL}/v1/getVoiceConvertTaskInfo/${taskId}`, {
                    method: 'POST',
                    headers: { ...getDubbingXBearerHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const data = await response.json();
                if (data.success && data.data) {
                    json(200, {
                        success: true,
                        status: data.data.status,
                        audioUrl: data.data.audioUrl
                    });
                } else {
                    json(200, { success: false, status: 'Pending', msg: data.msg });
                }
            } catch (err) {
                console.error('[yunwu] VC任务查询错误:', err.message);
                json(500, { success: false, error: err.message });
            }
            return;
        }
        
        // ========== 🎵 可灵 Kling TTS 语音合成 ==========
        if (action === 'kling-tts') {
            const { text, voiceId, voiceLanguage, voiceSpeed, userId } = body;
            
            if (!text || !voiceId) {
                json(400, { error: 'MISSING_PARAMS', message: '缺少text或voiceId参数' });
                return;
            }
            
            // 检查并发数
            if (ttsCurrentConcurrent >= TTS_MAX_CONCURRENT) {
                const queuePosition = ttsQueue.length + 1;
                json(200, { 
                    success: false, 
                    queuePosition,
                    message: `当前排队位置: ${queuePosition}，请稍后重试`
                });
                return;
            }
            
            ttsCurrentConcurrent++;
            console.log(`[yunwu] Kling TTS并发: ${ttsCurrentConcurrent}/${TTS_MAX_CONCURRENT}`);
            
            try {
                const requestBody = {
                    text: text,
                    voice_id: voiceId,
                    voice_language: voiceLanguage || 'zh'
                };
                if (voiceSpeed) requestBody.voice_speed = voiceSpeed;
                
                const response = await fetchWithFallbackWithTimeout(`/kling/v1/audio/tts`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }, 60000);
                
                if (!response.ok) {
                    const errText = await response.text();
                    console.error('[yunwu] Kling TTS错误:', response.status, errText);
                    throw new Error(`Kling TTS失败: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('[yunwu] Kling TTS返回:', JSON.stringify(data).substring(0, 300));
                
                // 检查返回结果
                if (data?.data?.task_id || data?.task_id) {
                    const taskId = data?.data?.task_id || data?.task_id;
                    
                    // 扣费
                    const cost = 2;  // Kling TTS 2胶片
                    if (userId && !skipBilling) {
                        await __billing('consume', userId, cost, 'Kling TTS配音');
                    }
                    
                    json(200, { 
                        success: true, 
                        taskId: taskId,
                        message: '任务已提交'
                    });
                } else {
                    // 尝试多种路径提取直接返回的音频URL
                    const audioUrl = data?.data?.task_result?.audios?.[0]?.url ||  // ✅ Kling TTS 实际格式
                                    data?.data?.task_result?.works?.[0]?.resource?.resource ||
                                    data?.data?.task_result?.works?.[0]?.audio?.resource ||
                                    data?.data?.works?.[0]?.resource?.resource ||
                                    data?.data?.works?.[0]?.audio?.resource ||
                                    data?.data?.audios?.[0]?.url ||
                                    data?.data?.audio_url ||
                                    data?.audio_url;
                    
                    if (audioUrl) {
                        const cost = 2;
                        if (userId && !skipBilling) {
                            await __billing('consume', userId, cost, 'Kling TTS配音');
                        }
                        
                        json(200, { 
                            success: true, 
                            audioUrl: audioUrl,
                            message: '生成成功'
                        });
                    } else {
                        console.error('[yunwu] Kling TTS 未能提取taskId或audioUrl, 完整返回:', JSON.stringify(data).substring(0, 500));
                        throw new Error('未获取到任务ID或音频');
                    }
                }
            } catch (err) {
                console.error('[yunwu] Kling TTS错误:', err.message);
                json(500, { success: false, error: err.message });
            } finally {
                ttsCurrentConcurrent--;
            }
            return;
        }
        
        // 可灵 Kling TTS 轮询任务状态
        if (action === 'kling-tts-poll') {
            const { taskId } = body;
            
            if (!taskId) {
                json(400, { error: 'MISSING_TASK_ID' });
                return;
            }
            
            try {
                const response = await fetchWithFallbackWithTimeout(`/kling/v1/audio/tts/${taskId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`
                    }
                }, 15000);
                
                if (!response.ok) {
                    // 读取真实错误
                    let errBody = '';
                    try { errBody = await response.text(); } catch(e) {}
                    console.warn(`[yunwu] Kling TTS轮询 HTTP ${response.status}:`, errBody.substring(0, 300));
                    
                    // 4xx = 永久性错误（认证/找不到），直接返回failed
                    if (response.status >= 400 && response.status < 500) {
                        json(200, { success: false, status: 'failed', error: `HTTP ${response.status}: ${errBody.substring(0, 100)}` });
                    } else {
                        // 5xx = 临时错误，继续轮询
                        json(200, { success: false, status: 'processing', _httpStatus: response.status });
                    }
                    return;
                }
                
                const data = await response.json();
                console.log('[yunwu] Kling TTS轮询返回:', JSON.stringify(data).substring(0, 800));
                
                const taskStatus = data?.data?.task_status || data?.task_status || data?.status;
                const taskStatusLower = String(taskStatus || '').toLowerCase();
                const taskCode = data?.code ?? data?.data?.code;
                
                // 先尝试从任何位置提取音频URL（即使状态判断失败也能工作）
                const audioUrl = data?.data?.task_result?.audios?.[0]?.url ||  // ✅ Kling TTS 实际格式
                                data?.data?.task_result?.works?.[0]?.resource?.resource ||
                                data?.data?.task_result?.works?.[0]?.audio?.resource ||
                                data?.data?.task_result?.works?.[0]?.audio?.resource_without_watermark ||
                                data?.data?.task_result?.works?.[0]?.url ||
                                data?.data?.works?.[0]?.resource?.resource ||
                                data?.data?.works?.[0]?.audio?.resource ||
                                data?.data?.works?.[0]?.audio?.resource_without_watermark ||
                                data?.data?.works?.[0]?.url ||
                                data?.data?.task_result?.audios?.[0]?.resource ||  // 备选
                                data?.data?.audios?.[0]?.url ||  // 备选
                                data?.data?.audio_url ||
                                data?.audio_url ||
                                data?.data?.task_result?.resource ||
                                data?.data?.resource ||
                                data?.resource;
                
                // 如果能找到音频URL，无论状态如何都返回成功
                if (audioUrl) {
                    console.log('[yunwu] ✅ Kling TTS轮询: 找到audioUrl:', audioUrl.substring(0, 100));
                    json(200, {
                        success: true,
                        status: 'completed',
                        audioUrl: audioUrl
                    });
                    return;
                }
                
                if (taskStatusLower === 'succeed' || taskStatusLower === 'completed' || taskStatusLower === 'success' || taskCode === 0) {
                    // 状态显示完成但没有audioUrl，记录详细数据
                    console.error('[yunwu] ⚠️ Kling TTS轮询: 状态完成但未找到audioUrl, 完整数据:', JSON.stringify(data));
                    // 返回完整rawData供前端尝试提取
                    json(200, { success: false, status: 'completed_no_url', rawData: data, _note: 'status OK but no audioUrl found' });
                } else if (taskStatusLower === 'failed' || taskStatusLower === 'error' || taskStatusLower === 'timeout') {
                    const errMsg = data?.data?.task_status_msg || data?.data?.error || data?.message || '生成失败';
                    json(200, { success: false, status: 'failed', error: errMsg });
                } else {
                    // 仍在处理中
                    json(200, { success: false, status: 'processing', _taskStatus: taskStatus });
                }
            } catch (err) {
                console.error('[yunwu] Kling TTS轮询错误:', err.message);
                // 网络/超时等瞬态错误 → processing; 其他 → 也返回processing但带错误信息
                json(200, { success: false, status: 'processing', error: err.message });
            }
            return;
        }
        
        // ========== 🎙️ Whisper 语音识别（Speech-to-Text）==========
        if (action === 'speech-to-text') {
            const { audio, format, userId } = body;
            
            if (!audio) {
                json(400, { error: 'MISSING_AUDIO', message: '缺少音频数据' });
                return;
            }
            
            try {
                console.log('[yunwu] 开始语音识别，音频格式:', format || 'webm');
                
                // 将 base64 转换为 Buffer
                const audioBuffer = Buffer.from(audio, 'base64');
                console.log('[yunwu] 音频大小:', audioBuffer.length, 'bytes');
                
                // 使用 form-data 构建 multipart/form-data 请求
                const FormData = require('form-data');
                const formData = new FormData();
                
                // 添加音频文件
                const mimeType = format === 'webm' ? 'audio/webm' : 
                                 format === 'mp3' ? 'audio/mp3' : 
                                 format === 'wav' ? 'audio/wav' : 'audio/webm';
                formData.append('file', audioBuffer, {
                    filename: `audio.${format || 'webm'}`,
                    contentType: mimeType
                });
                formData.append('model', 'whisper-1');
                formData.append('language', 'zh');  // 中文识别
                
                // 调用云雾 Whisper API
                const response = await fetchWithFallbackWithTimeout(`/v1/audio/transcriptions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        ...formData.getHeaders()
                    },
                    body: formData
                }, 60000);  // 60秒超时
                
                if (!response.ok) {
                    const errText = await response.text();
                    console.error('[yunwu] Whisper识别错误:', response.status, errText);
                    throw new Error(`语音识别失败: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('[yunwu] Whisper返回:', JSON.stringify(data).substring(0, 200));
                
                // 提取识别文本
                const text = data?.text || data?.content || data?.data?.text || '';
                
                if (text) {
                    // 扣费 - 语音识别 1胶片/次
                    const cost = 1;
                    if (userId) {
                        await __billing('consume', userId, cost, 'Whisper语音识别');
                    }
                    
                    json(200, { 
                        success: true, 
                        text: text,
                        message: '识别成功'
                    });
                } else {
                    json(200, { 
                        success: false, 
                        text: '',
                        message: '未识别到内容'
                    });
                }
            } catch (err) {
                console.error('[yunwu] Whisper语音识别错误:', err.message);
                json(500, { error: err.message, success: false });
            }
            return;
        }
        
        // ========== 🎤 可灵自定义音色 ==========
        if (action === 'kling-custom-voice') {
            const { voiceName, voiceUrl, videoId, userId } = body;
            
            if (!voiceName) {
                json(400, { error: 'MISSING_VOICE_NAME', message: '缺少音色名称' });
                return;
            }
            
            if (!voiceUrl && !videoId) {
                json(400, { error: 'MISSING_SOURCE', message: '需要提供音频URL或视频ID' });
                return;
            }
            
            try {
                const requestBody = { voice_name: voiceName };
                if (voiceUrl) requestBody.voice_url = voiceUrl;
                if (videoId) requestBody.video_id = videoId;
                
                const response = await fetchWithFallbackWithTimeout(`/kling/v1/general/custom-voices`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }, 60000);
                
                if (!response.ok) {
                    const errText = await response.text();
                    console.error('[yunwu] Kling自定义音色错误:', response.status, errText);
                    throw new Error(`创建自定义音色失败: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('[yunwu] Kling自定义音色返回:', JSON.stringify(data).substring(0, 300));
                
                const taskId = data?.data?.task_id || data?.task_id;
                if (taskId) {
                    // 扣费
                    const cost = 5;  // 自定义音色 5胶片
                    if (userId) {
                        await __billing('consume', userId, cost, 'Kling自定义音色');
                    }
                    
                    json(200, { 
                        success: true, 
                        taskId: taskId,
                        message: '音色创建任务已提交'
                    });
                } else {
                    throw new Error('未获取到任务ID');
                }
            } catch (err) {
                console.error('[yunwu] Kling自定义音色错误:', err.message);
                json(500, { success: false, error: err.message });
            }
            return;
        }
        
        // 查询可灵自定义音色状态
        if (action === 'kling-custom-voice-query') {
            const { voiceId } = body;
            
            if (!voiceId) {
                json(400, { error: 'MISSING_VOICE_ID' });
                return;
            }
            
            try {
                const response = await fetchWithFallbackWithTimeout(`/kling/v1/general/custom-voices/${voiceId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`
                    }
                }, 15000);
                
                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`查询失败: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('[yunwu] Kling音色查询返回:', JSON.stringify(data).substring(0, 300));
                
                const voiceData = data?.data || data;
                const status = voiceData?.task_status || voiceData?.status;
                
                json(200, {
                    success: true,
                    status: status,
                    voiceId: voiceData?.voice_id || voiceId,
                    voiceName: voiceData?.voice_name,
                    data: voiceData
                });
            } catch (err) {
                console.error('[yunwu] Kling音色查询错误:', err.message);
                json(500, { success: false, error: err.message });
            }
            return;
        }

        json(400, { error: 'INVALID_ACTION', message: `不支持的操作: ${action}` });

    } catch (error) {
        console.error('[yunwu] 调用失败:', error.message);
        json(500, { error: 'YUNWU_FAILED', message: error.message });
    }
};

