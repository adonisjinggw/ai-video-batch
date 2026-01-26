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
    'create-character': 5,   // 创建角色
    // Vidu 视频模型 - 按分辨率和版本计费（70%利润，按秒计费，默认5秒）
    'vidu-q2-720p': 25,       // ¥0.288/秒 × 5秒 / 0.59 = ¥2.45
    'vidu-q2-1080p': 36,      // ¥0.423/秒 × 5秒 / 0.59 = ¥3.60
    'vidu-q2-pro-720p': 27,   // ¥0.315/秒 × 5秒 / 0.59 = ¥2.68
    'vidu-q2-pro-1080p': 54,  // ¥0.630/秒 × 5秒 / 0.59 = ¥5.36
    'vidu-q2-turbo-720p': 19, // ¥0.225/秒 × 5秒 / 0.59 = ¥1.91
    'vidu-q2-turbo-1080p': 36, // ¥0.423/秒 × 5秒 / 0.59 = ¥3.60
    // Hailuo 海螺视频模型 - 固定时长计费（闪电×0.5=成本，70%利润，1胶片=¥0.3）
    'hailuo-02-768p-6s': 7,       // ⚡2.376×0.5×1.7/0.3 = 7
    'hailuo-02-768p-10s': 11,     // ⚡3.960×0.5×1.7/0.3 = 11
    'hailuo-02-1080p-6s': 12,     // ⚡4.176×0.5×1.7/0.3 = 12
    'hailuo-02-1080p-10s': 20,    // ⚡6.960×0.5×1.7/0.3 = 20
    'hailuo-fast-768p-6s': 5,     // ⚡1.656×0.5×1.7/0.3 = 5
    'hailuo-fast-768p-10s': 8,    // ⚡2.760×0.5×1.7/0.3 = 8
    'hailuo-fast-1080p-6s': 8,    // ⚡2.808×0.5×1.7/0.3 = 8
    'hailuo-fast-1080p-10s': 13,  // ⚡4.680×0.5×1.7/0.3 = 13
    // Kling 可灵视频模型 - 固定时长计费（闪电×0.5=成本，70%利润，1胶片=¥0.3）
    'kling-o1-720p-5s': 15,       // ⚡5.400×0.5×1.7/0.3 = 15
    'kling-o1-720p-10s': 31,      // ⚡10.800×0.5×1.7/0.3 = 31
    'kling-o1-1080p-5s': 20,      // ⚡7.200×0.5×1.7/0.3 = 20
    'kling-o1-1080p-10s': 41,     // ⚡14.400×0.5×1.7/0.3 = 41
    'kling-2.5-720p-5s': 5,       // ⚡1.800×0.5×1.7/0.3 = 5
    'kling-2.5-720p-10s': 10,     // ⚡3.600×0.5×1.7/0.3 = 10
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

const YUNWU_API_KEY = process.env.YUNWU_API_KEY || '';

// ========== DubbingX TTS 配置 ==========
const TTS_API_KEY = process.env.TTS_API_KEY || 'NWY1NmUxM20tYjAxZi00YTkzLTgzYjkt';
const TTS_BASE_URL = 'https://tts-api.dubbingx.com';
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
    { url: 'https://api3.wlai.vip', name: '国内服务器' },
    { url: 'https://yunwu.zeabur.app', name: 'ZeaBur-CDN' },
    { url: 'https://yunwu.ai', name: '主站' },
    { url: 'https://api.apiplus.org', name: 'CF站' }
];

// 默认使用第一个（国内最快）
let YUNWU_BASE_URL = YUNWU_ENDPOINTS[0].url;

/**
 * 带故障转移的fetch请求
 * @param {string} path - API路径
 * @param {object} options - fetch选项
 * @returns {Promise<Response>}
 */
async function fetchWithFallback(path, options) {
    let lastError = null;
    
    for (const endpoint of YUNWU_ENDPOINTS) {
        try {
            const url = `${endpoint.url}${path}`;
            console.log(`[yunwu] 尝试 ${endpoint.name}: ${url}`);
            
            const response = await fetch(url, {
                ...options,
                // 设置超时
                signal: AbortSignal.timeout(30000)
            });
            
            // 如果是429限速，尝试下一个节点
            if (response.status === 429) {
                console.warn(`[yunwu] ${endpoint.name} 限速，尝试下一节点...`);
                continue;
            }
            
            // 成功则返回
            if (response.ok || response.status < 500) {
                console.log(`[yunwu] ✅ ${endpoint.name} 成功`);
                return response;
            }
            
            console.warn(`[yunwu] ${endpoint.name} 返回 ${response.status}`);
        } catch (err) {
            console.warn(`[yunwu] ${endpoint.name} 失败:`, err.message);
            lastError = err;
        }
    }
    
    throw lastError || new Error('所有云雾节点均不可用');
}

/**
 * fetchWithFallback 的可配置超时版本
 * 说明：云雾的部分模型（例如 4K/高质量）响应可能超过 60s，必须提升超时。
 */
async function fetchWithFallbackWithTimeout(path, options, timeoutMs = 30000) {
    let lastError = null;
    
    for (const endpoint of YUNWU_ENDPOINTS) {
        try {
            const url = `${endpoint.url}${path}`;
            console.log(`[yunwu] 尝试 ${endpoint.name}: ${url} (timeout ${Math.round(timeoutMs / 1000)}s)`);
            
            const response = await fetch(url, {
                ...options,
                signal: AbortSignal.timeout(timeoutMs)
            });
            
            if (response.status === 429) {
                console.warn(`[yunwu] ${endpoint.name} 限速，尝试下一节点...`);
                continue;
            }
            
            if (response.ok || response.status < 500) {
                console.log(`[yunwu] ✅ ${endpoint.name} 成功`);
                return response;
            }
            
            console.warn(`[yunwu] ${endpoint.name} 返回 ${response.status}`);
        } catch (err) {
            console.warn(`[yunwu] ${endpoint.name} 失败:`, err.message);
            lastError = err;
        }
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

        // 🔐 安全检查：必须提供 userId 才能使用 API（防止白嫖）
        if (!userId) {
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

        // ========== 图片分析/视觉识别 (grok-4-fast-non-reasoning) ==========
        if (action === 'vision') {
            const { prompt, image_url, model = 'grok-4-fast-non-reasoning' } = body;
            
            if (!prompt || !image_url) {
                json(400, { 
                    success: false,
                    error: 'MISSING_PROMPT_OR_IMAGE',
                    error_code: 'MISSING_PROMPT_OR_IMAGE',
                    billed: 0
                });
                return;
            }

            const filmCost = FILM_COST['vision'] || 2;
            let billingSuccess = false;

            console.log('[yunwu] 图片分析:', { model, hasImage: !!image_url });

            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, '图片分析');
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } else if (skipBilling) {
                console.log(`[yunwu] 💰 图片分析跳过扣费: 前端已处理`);
            }

            try {
                const response = await fetchWithFallback(`/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNWU_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model,
                        messages: [{ 
                            role: 'user', 
                            content: [
                                { type: 'text', text: prompt },
                                { type: 'image_url', image_url: { url: image_url } }
                            ]
                        }],
                        max_tokens: 100
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
                'gemini-3-flash-preview': { input: 0.15, output: 0.9 },   // 最便宜
                'qwen-plus': { input: 0.24, output: 0.6 },                // 中文优化
                'deepseek-v3.2': { input: 0.6, output: 0.9 },             // 代码强
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
                if (filmCost > 0 && userId) {
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

            // 💰 计费配置
            const filmCost = hd ? (FILM_COST['video-hd'] || 25) : (FILM_COST['video'] || 15);
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
            
            // 🔧 规范化模型名：下划线转点号 (veo_3_1 -> veo3.1)
            if (veoModel && veoModel.includes('_')) {
                const oldModel = veoModel;
                veoModel = veoModel.replace(/_/g, '.');
                console.log(`[yunwu] 规范化Veo模型名: ${oldModel} -> ${veoModel}`);
            }
            
            // 🔧 图生视频必须使用 -frames 后缀模型
            // veo3/veo3.1 图生视频 → veo3-fast-frames 或 veo3-pro-frames
            // veo2 图生视频 → veo2-fast-frames
            const hasImage = !!image_url;
            let actualModel = veoModel;
            if (hasImage && !veoModel.includes('-frames')) {
                const m = String(veoModel).toLowerCase();
                if (m.includes('veo3.1') || m.includes('veo3-') || m === 'veo3') {
                    // veo3/veo3.1 系列 → veo3-fast-frames (4K 图生视频)
                    actualModel = 'veo3-fast-frames';
                } else if (m.includes('veo2')) {
                    actualModel = 'veo2-fast-frames';
                } else {
                    // 其他 veo 模型，尝试添加 -frames 后缀
                    actualModel = m.replace(/-?(fast|pro)?$/, '-fast-frames');
                }
                console.log(`[yunwu] 🎬 Veo图生视频模型转换: ${veoModel} -> ${actualModel}`);
            }

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
                    enhance_prompt: 'Enabled',
                    output_config: {
                        storage_mode: 'Temporary',
                        duration: parseInt(duration) || 6,
                        resolution: resolution,
                        person_generation: 'AllowAdult',
                        input_compliance_check: 'Enabled',
                        output_compliance_check: 'Enabled'
                    }
                };
                
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

            // 优化提示词
            let optimizedPrompt = prompt.trim().replace(/\s*--\w+\s*[\d.:]*\s*/g, ' ').trim();
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
                
                const response = await fetch(`${TTS_BASE_URL}/v2/getTTSTimbreList`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${TTS_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(15000)  // 15秒超时
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
            
            try {
                const requestBody = {
                    voiceId: voiceId,
                    text: text,
                    language: language || 'zh',
                    fileFormat: fileFormat || 'mp3'
                };
                if (audioSpeed) requestBody.audioSpeed = audioSpeed;
                if (audioPitch) requestBody.audioPitch = audioPitch;
                if (audioVolume) requestBody.audioVolume = audioVolume;
                if (emotion) requestBody.emotion = emotion;
                
                const response = await fetch(`${TTS_BASE_URL}/v1/addTtsTask`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${TTS_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
                
                const data = await response.json();
                
                if (data.success && data.data?.id) {
                    // 扣费
                    const cost = 2;  // TTS固定2胶片
                    if (userId) {
                        await __billing('consume', userId, cost, 'TTS配音');
                    }
                    
                    json(200, { 
                        success: true, 
                        taskId: data.data.id,
                        message: '任务已提交'
                    });
                } else {
                    json(200, { success: false, error: data.msg || 'TTS任务创建失败' });
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
                
                const response = await fetch(`${YUNWU_BASE_URL}/v1beta/models/${ttsModel}:generateContent?key=${YUNWU_API_KEY}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${YUNWU_API_KEY}`
                    },
                    body: JSON.stringify(requestBody)
                });
                
                if (!response.ok) {
                    const errText = await response.text();
                    console.error('[yunwu] Gemini TTS错误:', response.status, errText);
                    throw new Error(`Gemini TTS失败: ${response.status}`);
                }
                
                const data = await response.json();
                
                // 解析音频数据
                const audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                const mimeType = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/mp3';
                
                if (audioData) {
                    // 扣费
                    if (userId) {
                        await __billing('consume', userId, cost, `Gemini ${isProModel ? 'Pro' : 'Flash'} TTS配音`);
                    }
                    
                    json(200, { 
                        success: true, 
                        audioData: audioData,  // base64编码的音频
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
                    if (userId) {
                        await __billing('consume', userId, cost, 'Kling TTS配音');
                    }
                    
                    json(200, { 
                        success: true, 
                        taskId: taskId,
                        message: '任务已提交'
                    });
                } else if (data?.data?.works?.[0]?.resource?.resource) {
                    // 直接返回音频URL
                    const audioUrl = data.data.works[0].resource.resource;
                    
                    const cost = 2;
                    if (userId) {
                        await __billing('consume', userId, cost, 'Kling TTS配音');
                    }
                    
                    json(200, { 
                        success: true, 
                        audioUrl: audioUrl,
                        message: '生成成功'
                    });
                } else {
                    throw new Error('未获取到任务ID或音频');
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
                    json(200, { success: false, status: 'processing' });
                    return;
                }
                
                const data = await response.json();
                console.log('[yunwu] Kling TTS轮询返回:', JSON.stringify(data).substring(0, 300));
                
                const taskStatus = data?.data?.task_status || data?.task_status;
                
                if (taskStatus === 'succeed') {
                    const audioUrl = data?.data?.task_result?.works?.[0]?.resource?.resource || 
                                    data?.data?.works?.[0]?.resource?.resource;
                    json(200, {
                        success: true,
                        status: 'completed',
                        audioUrl: audioUrl
                    });
                } else if (taskStatus === 'failed') {
                    json(200, { success: false, status: 'failed', error: '生成失败' });
                } else {
                    json(200, { success: false, status: 'processing' });
                }
            } catch (err) {
                console.error('[yunwu] Kling TTS轮询错误:', err.message);
                json(200, { success: false, status: 'processing', error: err.message });
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

