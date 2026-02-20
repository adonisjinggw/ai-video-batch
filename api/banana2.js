/**
 * Banana2 图片生成 API 代理
 * 🔐 API Key 通过环境变量配置，不暴露给前端
 * 🔄 支持云雾API自动备用（关闭VPN时自动切换）
 * 💰 计费通过 /api/supabase-proxy 统一处理
 * 📝 生成成功后保存记录，确保用户能找回内容
 */

// ========== 计费配置（整数，最小1胶片） ==========
const FILM_COST = {
    'modelscope': 0,           // 免费
    'nano-banana-2': 6,        // Banana 标准版
    'nano-banana-2-2k': 6,     // Banana 2K
    'nano-banana-2-4k': 10,    // Banana 4K
    'qwen-image-max': 8,       // 🌟 通义万相Max（banana.html 使用）
    'Qwen/Qwen-Image-2512': 8, // 通义万相Max（魔塔模型名）
    'doubao-seedream-4-5-251128': 7,  // 星梦画师
    'jimeng-4.5': 7            // 即梦4.5
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
            console.warn('[banana2] 保存记录失败:', data.error || data.message);
            return { success: false, error: data.error || data.message };
        }
        
        console.log(`[banana2] 📝 生成记录已保存: ${data.recordId}`);
        return { success: true, recordId: data.recordId };
    } catch (e) {
        console.warn('[banana2] 保存记录异常:', e.message);
        return { success: false, error: e.message };
    }
}

/**
 * 🔐 统一计费函数 - 调用 /api/supabase-proxy
 */
async function __billing(billingAction, userId, amount, description) {
    if (!userId || amount <= 0) return { success: true, skipped: true };
    
    const intAmount = Math.ceil(amount);
    const proxyAction = billingAction === 'refund' ? 'recharge' : 'consume';
    
    try {
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
            console.error(`[banana2] 退款失败:`, data);
            return { success: false, error: data.message || data.error };
        }
        
        console.log(`[banana2] 💰 ${billingAction === 'refund' ? '退款' : '扣费'}成功: ${userId} ${billingAction === 'refund' ? '+' : '-'}${intAmount}胶片`);
        return { success: true, newBalance: data.newBalance, newUsed: data.newUsed };
    } catch (e) {
        if (billingAction === 'consume') {
            throw e;
        }
        console.error(`[banana2] 退款异常:`, e.message);
        return { success: false, error: e.message };
    }
}

// ✅ 超时控制：避免上游卡死导致 Vercel 超时（前端表现为 Failed to fetch）
function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(new Error('UPSTREAM_TIMEOUT')), timeoutMs);
    const merged = { ...(options || {}), signal: controller.signal };
    return fetch(url, merged).finally(() => clearTimeout(t));
}

// 🚨 硬禁用所有贞贞(t8star)调用，避免误扣费
const ALLOW_ZHENZHEN = false;

// 🔧 贞贞API（已硬禁用）
const ZHENZHEN_API_KEY = '';
const ZHENZHEN_API_URL = process.env.IMAGE_API_URL || 'https://ai.t8star.cn';
const API_BASE_URL = ZHENZHEN_API_URL;

// 🆕 魔塔 ModelScope API 配置（qwen-image-max 模型）
// ✅ 优先用 MODELSCOPE_API_KEY，否则回退到 YUNMENG_API_KEY
const MODELSCOPE_API_KEY = process.env.MODELSCOPE_API_KEY || process.env.YUNMENG_API_KEY || '';
const MODELSCOPE_BASE_URL = 'https://api-inference.modelscope.cn';

// 🆕 云梦/云雾API配置（主力优先）- 支持多个 API Key
// ✅ 修复：读取 YUNMENG_API_KEY 系列环境变量
const YUNMENG_API_KEYS = (() => {
    const keys = [];
    const key1 = (process.env.YUNMENG_API_KEY || '').trim();
    const key2 = (process.env.YUNMENG_API_KEY_2 || '').trim();
    const key3 = (process.env.YUNMENG_API_KEY_3 || '').trim();
    if (key1) keys.push(key1);
    if (key2) keys.push(key2);
    if (key3) keys.push(key3);
    console.log(`[banana2] 🔑 初始化: 读取到 ${keys.length} 个 YUNMENG_API_KEY`);
    console.log(`[banana2] 🔑 Key1存在: ${!!key1}, Key2存在: ${!!key2}, Key3存在: ${!!key3}`);
    return keys;
})();
const YUNWU_API_KEY = YUNMENG_API_KEYS[0] || ''; // 兼容旧变量名

const YUNMENG_ENDPOINTS = [
    'https://api3.wlai.vip',
    'https://yunwu.zeabur.app',
    'https://yunwu.ai'
];

// 兼容旧变量名
const API_KEY = '';
// ✅ 直接使用 YUNMENG_ENDPOINTS（第144行已定义），不再重复声明

/**
 * 🔄 带自动备用的图片生成请求
 * ☁️ 优化：并行请求多个端点，哪个先返回用哪个，大幅提速
 */
async function fetchWithFallback(requestBody, isGemini3Native = false) {
    const model = String(requestBody?.model || '');
    const is4k = /4k|2k/i.test(model);
    const isJimeng = model.includes('jimeng');
    const isSeedream = model.includes('seedream') || model.includes('doubao');
    const timeoutMs = isGemini3Native ? 90000 : (isJimeng ? 150000 : ((is4k || isSeedream) ? 120000 : 45000));

    const apiPath = isGemini3Native
        ? '/v1beta/models/gemini-3-pro-image-preview:generateContent'
        : '/v1/images/generations';
    console.log(`[banana2] 🔧 模型 ${model || 'gemini-3'} 使用端点: ${apiPath}, 超时: ${timeoutMs}ms`);

    if (YUNMENG_API_KEYS.length === 0) {
        throw new Error('未配置YUNMENG_API_KEY环境变量，无法调用图片生成API');
    }

    // 🚀 并行请求所有端点，第一个成功的就返回（使用 Promise.race 加速）
    const apiKey = YUNMENG_API_KEYS[0];
    
    // 🆕 使用 Promise.race + Promise.all 组合：任一成功立即返回，全部失败才报错
    return new Promise((resolve, reject) => {
        let settled = false;  // 🔒 防止多次 resolve/reject
        let successCount = 0;
        let failCount = 0;
        const totalRequests = YUNMENG_ENDPOINTS.length;
        const errors = [];
        
        YUNMENG_ENDPOINTS.forEach((endpoint, idx) => {
            const url = `${endpoint}${apiPath}`;
            console.log(`[banana2] ☁️ 并行请求 ${idx + 1}/${totalRequests}: ${endpoint}`);
            
            fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    ...(requestBody?.__idempotencyKey ? { 'Idempotency-Key': String(requestBody.__idempotencyKey) } : {})
                },
                body: JSON.stringify(requestBody)
            }, timeoutMs)
            .then(response => {
                if (settled) return;  // 已经有结果了，忽略
                
                if (response.ok) {
                    console.log(`[banana2] ☁️ ✅ ${endpoint} 成功 (第${idx + 1}个)`);
                    settled = true;
                    resolve(response);
                } else {
                    console.warn(`[banana2] ☁️ ${endpoint} 返回 ${response.status}`);
                    errors.push({ endpoint, status: response.status });
                    failCount++;
                    
                    // 🆕 所有请求都失败了，才返回错误
                    if (failCount >= totalRequests && !settled) {
                        settled = true;
                        // 检查是否有429
                        const has429 = errors.some(e => e.status === 429);
                        if (has429) {
                            reject(new Error('请求过于频繁，请稍后重试'));
                        } else {
                            const clientError = errors.find(e => e.status >= 400 && e.status < 500);
                            if (clientError) {
                                reject(new Error(`请求失败: ${clientError.status}`));
                            } else {
                                reject(new Error('云梦API节点均不可访问'));
                            }
                        }
                    }
                }
            })
            .catch(err => {
                if (settled) return;
                console.warn(`[banana2] ☁️ ${endpoint} 异常:`, err.message);
                errors.push({ endpoint, error: err.message });
                failCount++;
                
                if (failCount >= totalRequests && !settled) {
                    settled = true;
                    reject(new Error(`云梦API节点均不可访问: ${errors.map(e => e.error || e.status).join(', ')}`));
                }
            });
        });
    });
}

/**
 * 🆕 魔塔 ModelScope qwen-image-max 图片生成（异步任务模式）
 * @param {string} prompt - 图片描述
 * @param {object} options - 配置选项
 * @returns {Promise<string>} - 图片 URL 或 base64
 */
async function callQwenImageMax(prompt, options = {}) {
    if (!MODELSCOPE_API_KEY) {
        throw new Error('未配置 MODELSCOPE_API_KEY');
    }

    const {
        size = '1328*1328',
        negativePrompt = '',
        watermark = false,
        promptExtend = true,
        image_url = null,  // 🎨 画面控制：参考图 (base64 或 URL)
        maxRetries = 2     // 🔄 最大重试次数
    } = options;

    // 将 size 转换为 aspect_ratio 格式
    let aspectRatio = '1:1';
    if (size) {
        const [w, h] = size.split(/[x*×]/).map(Number);
        if (w && h) {
            if (w > h) aspectRatio = '16:9';
            else if (h > w) aspectRatio = '9:16';
            else aspectRatio = '1:1';
        }
    }

    // 🔧 根据是否有参考图自动选择模型
    // - 文生图：Qwen/Qwen-Image-2512
    // - 图生图/编辑：Qwen/Qwen-Image-Edit-2511
    const hasRefImage = !!image_url;
    const modelName = hasRefImage ? 'Qwen/Qwen-Image-Edit-2511' : 'Qwen/Qwen-Image-2512';
    
    const requestBody = {
        model: modelName,
        prompt: prompt,
        size: size  // 🔧 传递尺寸参数
    };

    // 🎨 图生图模式：传入参考图
    if (hasRefImage) {
        requestBody.image_url = Array.isArray(image_url) ? image_url : [image_url];
        console.log(`[banana2] 🎨 万象Max 图生图模式 (Edit-2511)，参考图数量: ${requestBody.image_url.length}`);
    }

    if (negativePrompt) {
        requestBody.negative_prompt = negativePrompt;
    }

    console.log(`[banana2] 🎨 调用 ModelScope ${modelName}, prompt: ${prompt.substring(0, 50)}...`);

    // 第一步：提交异步任务
    const submitResponse = await fetchWithTimeout(
        `${MODELSCOPE_BASE_URL}/v1/images/generations`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MODELSCOPE_API_KEY}`,
                'Content-Type': 'application/json',
                'X-ModelScope-Async-Mode': 'true'
            },
            body: JSON.stringify(requestBody)
        },
        30000
    );

    if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        console.error(`[banana2] ModelScope qwen-image-max 提交失败: ${submitResponse.status}`, errorText);
        console.error(`[banana2] 请求体:`, JSON.stringify(requestBody));
        console.error(`[banana2] API Key 前8位: ${MODELSCOPE_API_KEY.substring(0, 8)}...`);
        let errorDetail = '';
        try {
            const errorJson = JSON.parse(errorText);
            errorDetail = errorJson?.message || errorJson?.error?.message || errorJson?.code || errorJson?.errors?.message || '';
        } catch (e) {
            errorDetail = errorText.substring(0, 300);
        }
        throw new Error(`万象Max生成失败: ${errorDetail || submitResponse.status}`);
    }

    const submitData = await submitResponse.json();
    const taskId = submitData?.task_id;
    if (!taskId) {
        throw new Error('qwen-image-max 未返回 task_id');
    }

    console.log(`[banana2] 🎯 qwen-image-max 任务已提交, task_id: ${taskId}`);

    // 第二步：轮询任务状态（增强容错）
    // 🔧 优化：控制在80秒内，避免Cloudflare 524超时（~100秒限制）
    const maxAttempts = 40;  // 🔧 40次×2秒=80秒，留出缓冲
    let consecutiveFailures = 0;
    let lastStatus = '';
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // 🔧 动态等待：前20次每2秒，之后每3秒，减少请求压力
        const waitTime = attempt < 20 ? 2000 : 3000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        try {
            const pollResponse = await fetchWithTimeout(
                `${MODELSCOPE_BASE_URL}/v1/tasks/${taskId}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${MODELSCOPE_API_KEY}`,
                        'X-ModelScope-Task-Type': 'image_generation'
                    }
                },
                30000  // 🔧 增加超时时间到30秒
            );

            if (!pollResponse.ok) {
                consecutiveFailures++;
                console.warn(`[banana2] 轮询失败 (attempt ${attempt + 1}): ${pollResponse.status}, 连续失败${consecutiveFailures}次`);
                // 🔧 放宽阈值：连续10次失败才终止
                if (consecutiveFailures >= 10) {
                    throw new Error(`轮询连续失败${consecutiveFailures}次`);
                }
                continue;
            }
            
            consecutiveFailures = 0;  // 重置连续失败计数
            
            const pollText = await pollResponse.text();
            let pollData;
            try {
                pollData = JSON.parse(pollText);
            } catch (e) {
                console.warn(`[banana2] 轮询返回非 JSON: ${pollText.substring(0, 100)}`);
                continue;
            }
            
            // 🔧 只在状态变化时打印日志，减少噪音
            if (pollData.task_status !== lastStatus) {
                console.log(`[banana2] 🔄 轮询 (${attempt + 1}/${maxAttempts}): ${pollData.task_status}`);
                lastStatus = pollData.task_status;
            }

            if (pollData.task_status === 'SUCCEED') {
                // 🔧 多种方式提取图片URL
                let imageUrl = '';
                const images = pollData.output_images || pollData.images || [];
                if (images.length > 0) {
                    imageUrl = images[0];
                }
                if (!imageUrl && pollData.output?.url) {
                    imageUrl = pollData.output.url;
                }
                if (!imageUrl && pollData.data?.url) {
                    imageUrl = pollData.data.url;
                }
                if (!imageUrl && pollData.url) {
                    imageUrl = pollData.url;
                }
                if (!imageUrl && pollData.result?.url) {
                    imageUrl = pollData.result.url;
                }
                
                if (imageUrl) {
                    console.log(`[banana2] ✅ qwen-image-max 生成成功: ${imageUrl.substring(0, 80)}...`);
                    
                    // 🔧 如果是 OSS URL，需要在服务端转换为 base64，避免前端 CORS 问题
                    if (imageUrl.includes('aliyuncs.com') || imageUrl.includes('oss-cn-') || imageUrl.includes('modelscope')) {
                        try {
                            console.log(`[banana2] 🔄 转换图片 URL 为 base64...`);
                            const imgResponse = await fetchWithTimeout(imageUrl, {}, 30000);
                            if (imgResponse.ok) {
                                const arrayBuffer = await imgResponse.arrayBuffer();
                                const base64 = Buffer.from(arrayBuffer).toString('base64');
                                const contentType = imgResponse.headers.get('content-type') || 'image/png';
                                return `data:${contentType};base64,${base64}`;
                            }
                            console.warn(`[banana2] ⚠️ 获取图片失败: ${imgResponse.status}, 返回原始 URL`);
                        } catch (e) {
                            console.warn(`[banana2] ⚠️ 转换 base64 失败: ${e.message}, 返回原始 URL`);
                        }
                    }
                    return imageUrl;
                } else {
                    console.warn(`[banana2] SUCCEED 但未找到图片URL:`, JSON.stringify(pollData).substring(0, 300));
                }
            }

            if (pollData.task_status === 'FAILED') {
                const errorMsg = pollData?.error_msg || pollData?.message || '图片生成失败';
                throw new Error(`万象Max生成失败: ${errorMsg}`);
            }
        } catch (err) {
            if (err.message.includes('轮询连续失败') || err.message.includes('生成失败')) {
                throw err;
            }
            // 🔧 UPSTREAM_TIMEOUT 不算连续失败，只是网络抖动
            if (err.message === 'UPSTREAM_TIMEOUT') {
                console.warn(`[banana2] 轮询超时 (attempt ${attempt + 1})，继续重试...`);
                continue;
            }
            console.warn(`[banana2] 轮询异常 (attempt ${attempt + 1}): ${err.message}`);
            consecutiveFailures++;
            // 🔧 放宽阈值：连续10次异常才终止
            if (consecutiveFailures >= 10) {
                throw new Error(`轮询连续异常${consecutiveFailures}次: ${err.message}`);
            }
        }
    }

    throw new Error(`万象Max生成超时（已等待约80秒），服务器繁忙请稍后重试`);
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

    // 💰 变量提升到 try 外面，确保 catch 块可以访问
    let billingSuccess = false;
    let filmCost = 0;
    let userId = null;

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        // ✅ 幂等键：用于超时/断线重试，尽量避免上游重复计费/重复生成
        // 优先读取 header，其次允许 body 传入
        const idemKey = (req.headers && (req.headers['idempotency-key'] || req.headers['Idempotency-Key'])) || body?.idempotencyKey;
        if (idemKey && body && typeof body === 'object') {
            body.__idempotencyKey = String(idemKey);
        }
        const {
            prompt,
            model = 'gemini-3-pro-image-preview',  // ✅ 云梦 API 的 Gemini-3 图片生成模型
            aspect_ratio = '1:1',
            image_url,   // 单图（兼容旧版）
            image_urls,  // 🆕 多图融合数组
            userId: reqUserId       // 🔐 用户ID（计费用）
        } = body || {};

        userId = reqUserId;  // 赋值给外层变量
        const skipBilling = body?.skip_billing === true;

        // 🔐 安全检查：必须提供 userId 才能使用 API（防止白嫫）
        if (!userId) {
            json(401, { error: 'UNAUTHORIZED', message: '请先登录后再使用此功能' });
            return;
        }

        if (!prompt) {
            json(400, { error: 'MISSING_PROMPT' });
            return;
        }

        // 💰 计费：获取模型费用
        filmCost = FILM_COST[model] || 0;

        // 🆕 模型名称映射
        // ✅ modelscope 免费模型使用云梦API (Gemini-3)，不要走ModelScope
        // ✅ qwen-image-max 才使用 ModelScope API
        let mappedModel = model;
        let useModelScopeAPI = false;  // 🆕 明确标记是否使用ModelScope API
        
        if (model === 'modelscope') {
            // ✅ modelscope免费模型使用云梦Gemini-3，不需要MODELSCOPE_API_KEY
            mappedModel = 'gemini-3-pro-image-preview';
            useModelScopeAPI = false;
            console.log(`[banana2] 🔄 模型映射: modelscope -> gemini-3-pro-image-preview (云梦API)`);
        } else if (model === 'qwen-image-max' || model === 'Qwen/Qwen-Image-2512') {
            // 🔧 明确选择 qwen-image-max 时才使用 ModelScope API
            mappedModel = 'Qwen/Qwen-Image-2512';
            useModelScopeAPI = true;
            console.log(`[banana2] 🔄 模型映射: ${model} -> Qwen/Qwen-Image-2512 (ModelScope API)`);
        }

        // 🆕 只有明确选择 qwen-image-max 时才使用 ModelScope API
        const isQwenModel = useModelScopeAPI;
        
        // 允许云梦/云雾或魔塔任一存在即可
        if (!isQwenModel && YUNMENG_API_KEYS.length === 0) {
            json(500, { error: 'SERVER_CONFIG_ERROR', message: '服务器未配置图像API Key' });
            return;
        }
        
        if (isQwenModel && !MODELSCOPE_API_KEY) {
            console.error('[banana2] ❗ MODELSCOPE_API_KEY 未配置，尝试使用云梦API替代');
            // 改用云梦API的Gemini-3替代
            mappedModel = 'gemini-3-pro-image-preview';
            useModelScopeAPI = false;
        }

        console.log(`[banana2] 🔑 可用API Key数量: 云梦=${YUNMENG_API_KEYS.length}, 魔塔=${MODELSCOPE_API_KEY ? 1 : 0}`);

        console.log('[banana2] 图片生成:', {
            model,
            aspect_ratio,
            hasRefImage: !!image_url,
            promptLength: prompt.length
        });

        // 🔧 模型名称映射：前端使用 nano-banana-2 系列，统一映射到云雾的 gemini-3-pro-image-preview
        let actualModel = model;
        let resolution = '1K';  // 默认 1K

        if (model === 'nano-banana-2' || model === 'banana2') {
            actualModel = 'gemini-3-pro-image-preview';  // 云雾 Gemini 图像生成
            resolution = '1K';
            console.log(`[banana2] 🔄 模型映射: ${model} -> ${actualModel} (${resolution})`);
        } else if (model === 'nano-banana-2-2k' || model === 'banana2-2k' || model === 'banana2_2k') {
            actualModel = 'gemini-3-pro-image-preview';  // 云雾 Gemini 图像生成
            resolution = '2K';
            console.log(`[banana2] 🔄 模型映射: ${model} -> ${actualModel} (${resolution})`);
        } else if (model === 'nano-banana-2-4k' || model === 'banana2-4k' || model === 'banana2_4k') {
            actualModel = 'gemini-3-pro-image-preview';  // 云雾 Gemini 图像生成
            resolution = '4K';
            console.log(`[banana2] 🔄 模型映射: ${model} -> ${actualModel} (${resolution})`);
        }

        // 🔧 模型特殊处理
        const isSeedream = actualModel && (actualModel.includes('seedream') || actualModel.includes('doubao'));
        const isJimeng = actualModel && actualModel.includes('jimeng');
        // ✅ modelscope 映射后会是 gemini-3，所以要用 actualModel 或 mappedModel 判断
        const isGemini3 = (actualModel && actualModel.includes('gemini-3-pro-image-preview')) || (mappedModel && mappedModel.includes('gemini-3-pro-image-preview'));
        const isNanoBanana = model && (model.includes('nano-banana-2') || model === 'banana2' || model === 'modelscope');
        // 🆕 只有配置了MODELSCOPE_API_KEY且明确使用ModelScope API时才走qwen-image-max分支
        const isQwenImageMax = useModelScopeAPI && MODELSCOPE_API_KEY;

        let response;

        // 🆕 qwen-image-max 使用魔塔 ModelScope API
        if (isQwenImageMax) {
            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, `画图生成:${model}`);
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            }

            try {
                // 根据 aspect_ratio 计算 size
                // 🔧 修复比例反转：ModelScope/万象Max API 的 size 格式是 "宽*高"
                let size = '1024*1024';  // 默认正方形
                if (aspect_ratio === '16:9') {
                    size = '1328*768';   // 横屏：宽1328 x 高768
                } else if (aspect_ratio === '9:16') {
                    size = '768*1328';   // 竖屏：宽768 x 高1328
                } else if (aspect_ratio === '4:3') {
                    size = '1328*1024';  // 横屏标准：宽1328 x 高1024
                } else if (aspect_ratio === '3:4') {
                    size = '1024*1328';  // 竖屏标准：宽1024 x 高1328
                }
                console.log(`[banana2] 🎨 万象Max size: ${size} (aspect_ratio=${aspect_ratio})`);

                // 🎨 万象Max 2512 本身支持画面控制（用文字改图），直接传参考图
                const refImage = (image_urls && Array.isArray(image_urls) && image_urls.length > 0) ? image_urls : (image_url || null);
                const imageUrl = await callQwenImageMax(prompt, { size, image_url: refImage });
                
                // ✅ 生成成功：保存记录并返回（已在开头扣费）
                await __saveGenerationRecord(userId, 'image', imageUrl, prompt, model, filmCost, { aspect_ratio, size });
                
                console.log(`[banana2] ✅ qwen-image-max 生成成功, 计费=${billingSuccess ? filmCost + '胶片' : '无'}`);
                json(200, {
                    success: true,
                    url: imageUrl,
                    data: [{ url: imageUrl }],
                    billed: billingSuccess ? filmCost : 0
                });
                return;
            } catch (err) {
                console.error('[banana2] qwen-image-max 失败:', err.message);
                // 🔄 生成失败退款
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, 'qwen-image-max失败退款');
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

        // 🔒 Gemini/其他模型先扣费
        if (!skipBilling && filmCost > 0 && userId && !billingSuccess) {
            const billingResult = await __billing('consume', userId, filmCost, `画图生成:${model}`);
            if (!billingResult.success && !billingResult.skipped) {
                json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                return;
            }
            billingSuccess = billingResult.success && !billingResult.skipped;
        }

        // 🌟 Gemini-3 使用原生格式请求
        if (isGemini3) {
            // 🔧 修复尺寸问题：在提示词中显式说明尺寸方向
            // 某些云梦API中转会颠倒宽高，通过在提示词中强调来修复
            let orientationHint = '';
            if (aspect_ratio === '9:16' || aspect_ratio === '3:4') {
                orientationHint = ' [IMPORTANT: Generate a VERTICAL/PORTRAIT image, taller than wide, aspect ratio ' + aspect_ratio + ']';
            } else if (aspect_ratio === '16:9' || aspect_ratio === '4:3') {
                orientationHint = ' [IMPORTANT: Generate a HORIZONTAL/LANDSCAPE image, wider than tall, aspect ratio ' + aspect_ratio + ']';
            }
            const enhancedPrompt = prompt + orientationHint;
            
            // 构建原生 Gemini 请求体
            const parts = [{ text: enhancedPrompt }];

            // 🔧 辅助函数：将图片URL/base64转换为Gemini格式
            const addImagePart = async (imgUrl) => {
                if (!imgUrl) return;
                // base64 格式
                if (imgUrl.startsWith('data:')) {
                    const matches = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
                    if (matches) {
                        parts.push({
                            inline_data: {
                                mime_type: matches[1],
                                data: matches[2]
                            }
                        });
                    }
                }
                // http URL 格式 - 需要先下载转换为base64
                else if (imgUrl.startsWith('http')) {
                    try {
                        console.log(`[banana2] 下载参考图转为base64: ${imgUrl.substring(0, 50)}...`);
                        const imgRes = await fetchWithTimeout(imgUrl, {}, 15000);
                        if (imgRes.ok) {
                            const arrayBuffer = await imgRes.arrayBuffer();
                            const base64Data = Buffer.from(arrayBuffer).toString('base64');
                            const contentType = imgRes.headers.get('content-type') || 'image/png';
                            parts.push({
                                inline_data: {
                                    mime_type: contentType,
                                    data: base64Data
                                }
                            });
                            console.log(`[banana2] 参考图转换成功: ${contentType}, ${Math.round(base64Data.length/1024)}KB`);
                        } else {
                            console.warn(`[banana2] 下载参考图失败: ${imgRes.status}`);
                        }
                    } catch (dlErr) {
                        console.warn(`[banana2] 下载参考图异常: ${dlErr.message}`);
                    }
                }
            };

            // 图生图模式：添加参考图
            if (image_urls && Array.isArray(image_urls) && image_urls.length > 0) {
                console.log(`[banana2] 🖼️ 检测到多参考图模式: 收到 ${image_urls.length} 张图片`);
                let successCount = 0;
                for (let imgIdx = 0; imgIdx < image_urls.length; imgIdx++) {
                    const imgUrl = image_urls[imgIdx];
                    const prevPartsLen = parts.length;
                    await addImagePart(imgUrl);
                    if (parts.length > prevPartsLen) {
                        successCount++;
                        console.log(`[banana2] ✅ 第 ${imgIdx + 1} 张图片添加成功`);
                    } else {
                        console.warn(`[banana2] ⚠️ 第 ${imgIdx + 1} 张图片添加失败 (类型: ${typeof imgUrl}, 长度: ${imgUrl?.length || 0})`);
                    }
                }
                console.log(`[banana2] Gemini原生图生图模式: 收到 ${image_urls.length} 张参考图, 成功添加 ${successCount} 张, parts总数: ${parts.length}`);
            } else if (image_url) {
                await addImagePart(image_url);
                console.log(`[banana2] Gemini原生图生图模式: 1 张参考图`);
            }

            // 🔧 修复：Gemini API 的 aspect_ratio 格式需要转换
            // 前端传入 "16:9" / "9:16"，Gemini 需要 "16:9" / "9:16" 格式
            // 但某些云梦API中转可能会颠倒宽高，这里做明确映射
            let geminiAspectRatio = aspect_ratio;
            // 确保格式正确：横屏用宽:高，竖屏用宽:高
            const aspectMap = {
                '16:9': '16:9',   // 横屏
                '9:16': '9:16',   // 竖屏
                '4:3': '4:3',     // 标准横屏
                '3:4': '3:4',     // 标准竖屏
                '1:1': '1:1'      // 正方形
            };
            geminiAspectRatio = aspectMap[aspect_ratio] || '1:1';
            console.log(`[banana2] 🎯 Gemini aspect_ratio: 前端=${aspect_ratio}, 实际=${geminiAspectRatio}`);

            const geminiRequestBody = {
                contents: [{
                    role: 'user',
                    parts: parts
                }],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    image_config: {
                        aspect_ratio: geminiAspectRatio
                    }
                }
            };

            // 🔧 清晰度配置：云梦/云雾 API 不支持 image_size，改用在 prompt 中强调高分辨率
            // Gemini 3 Pro 本身支持生成高分辨率图像，通过提示词引导
            if (resolution === '4K' || resolution === '2K') {
                // 在提示词中添加高清指令（如果还没有）
                const resHint = resolution === '4K' 
                    ? '[Generate in ultra-high resolution 4K quality, extremely detailed and sharp]'
                    : '[Generate in high resolution 2K quality, detailed and crisp]';
                if (parts[0]?.text && !parts[0].text.includes('resolution')) {
                    parts[0].text = parts[0].text + ' ' + resHint;
                    console.log(`[banana2] 🌟 添加${resolution}高清提示词`);
                }
            }

            console.log(`[banana2] Gemini原生格式请求, aspectRatio: ${aspect_ratio}, resolution: ${resolution}`);
            response = await fetchWithFallback(geminiRequestBody, true);
        } else {
            // 其他模型使用 OpenAI 兼容格式
            const requestBody = {
                model: actualModel,
                prompt
            };

            if (isSeedream) {
                // 🔧 修复比例反转：星梦画师使用 size 参数（宽x高格式）
                let width, height;
                if (aspect_ratio === '16:9' || aspect_ratio === '16:10') {
                    // 横屏：宽 > 高
                    width = (resolution === '4K') ? 3840 : (resolution === '2K' ? 2560 : 1920);
                    height = (resolution === '4K') ? 2160 : (resolution === '2K' ? 1440 : 1080);
                } else if (aspect_ratio === '9:16' || aspect_ratio === '10:16') {
                    // 竖屏：高 > 宽
                    width = (resolution === '4K') ? 2160 : (resolution === '2K' ? 1440 : 1080);
                    height = (resolution === '4K') ? 3840 : (resolution === '2K' ? 2560 : 1920);
                } else { // 1:1
                    width = (resolution === '4K') ? 2160 : (resolution === '2K' ? 1440 : 1080);
                    height = width;
                }
                requestBody.size = `${width}x${height}`;
                console.log(`[banana2] 星梦画师使用size: ${requestBody.size} (宽x高, ${resolution}, ${aspect_ratio})`);
            } else if (isJimeng) {
                // ✅ 即梦使用 aspect_ratio 参数
                requestBody.aspect_ratio = aspect_ratio;
                console.log(`[banana2] 即梦使用aspect_ratio: ${aspect_ratio}`);
            } else {
                // 其他模型默认使用 size
                requestBody.size = '1024x1024';
                console.log(`[banana2] ${model} 使用默认size: 1024x1024`);
            }

            // 图生图模式（支持多图融合）
            if (image_urls && Array.isArray(image_urls) && image_urls.length > 0) {
                requestBody.image_urls = image_urls;
                console.log(`[banana2] 多图融合模式: ${image_urls.length} 张参考图`);
            } else if (image_url) {
                requestBody.image_url = image_url;
            }

            response = await fetchWithFallback(requestBody, false);
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[image-api] 错误:', response.status);

            // 🔄 API失败退款
            if (billingSuccess) {
                await __billing('refund', userId, filmCost, '图片生成API失败退款');
            }

            // 🔍 解析错误详情
            let errorDetail = '';
            try {
                const errorJson = JSON.parse(errorText);
                errorDetail = errorJson?.error?.message || errorJson?.message || errorJson?.detail || '';
            } catch (e) {
                errorDetail = errorText.substring(0, 200);
            }

            if (response.status === 401) {
                throw new Error('API Key 无效或已过期');
            }
            if (response.status === 400) {
                // 🚫 内容违规或参数错误
                if (errorDetail.includes('sensitive') || errorDetail.includes('违规') || errorDetail.includes('nsfw') || errorDetail.includes('blocked')) {
                    throw new Error(`⚠️ 内容审核未通过: ${errorDetail || '包含敏感/违规内容'}`);
                }
                throw new Error(`请求参数错误: ${errorDetail || '请检查提示词'}`);
            }
            if (response.status === 413) {
                throw new Error('参考图过大，请压缩后重试');
            }
            if (response.status === 422) {
                // 422 既可能是内容审核，也可能是参数校验（例如“参数 xxx 不存在”）
                if (/参数|不存在|invalid parameter|unknown parameter/i.test(errorDetail || '')) {
                    throw new Error(`请求参数错误: ${errorDetail || '参数不合法'}`);
                }
                throw new Error(`⚠️ 内容不合规: ${errorDetail || '提示词包含敏感词汇，请修改后重试'}`);
            }
            if (response.status === 429) {
                throw new Error('请求过于频繁，请稍后重试');
            }
            throw new Error(`图片生成失败 (${response.status}): ${errorDetail || '未知错误'}`);
        }

        const data = await response.json();
        
        // 🔧 调试：输出原始返回格式
        console.log('[banana2] 返回数据:', JSON.stringify(data).substring(0, 500));

        // 🔍 检查返回数据中的错误信息
        if (data?.error) {
            const errMsg = data.error.message || data.error;
            if (errMsg.includes('sensitive') || errMsg.includes('违规') || errMsg.includes('nsfw')) {
                throw new Error(`⚠️ 内容审核未通过: ${errMsg}`);
            }
            throw new Error(`生成失败: ${errMsg}`);
        }

        // 🔧 URL验证函数
        const isValidImageUrl = (url) => {
            if (!url || typeof url !== 'string') return false;
            if (url.startsWith('http://') || url.startsWith('https://')) return true;
            if (url.startsWith('data:image/')) return true;
            return false;
        };

        let imageUrl = null;
        let imageUrls = [];  // 🆕 支持多图返回

        // 1️⃣ Gemini 原生格式: candidates[0].content.parts
        if (data?.candidates && data.candidates[0]?.content?.parts && Array.isArray(data.candidates[0].content.parts)) {
            const parts = data.candidates[0].content.parts;
            for (const part of parts) {
                const inlineData = part?.inline_data || part?.inlineData;
                if (inlineData?.data) {
                    const mimeType = inlineData.mime_type || inlineData.mimeType || 'image/png';
                    let base64Data = inlineData.data;
                    
                    // 🔧 修复黑图问题：检查data是否已经包含base64前缀，避免重复拼接
                    if (base64Data.startsWith('data:')) {
                        // 已经是完整的 data URL，直接使用
                        imageUrls.push(base64Data);
                        console.log('[banana2] base64数据已包含前缀，直接使用');
                    } else {
                        // 纯base64数据，需要添加前缀
                        const url = `data:${mimeType};base64,${base64Data}`;
                        imageUrls.push(url);
                    }
                }
            }
            if (imageUrls.length > 0) {
                console.log('[banana2] 从 Gemini candidates 提取到图片:', imageUrls.length);
            }
        }

        // 2️⃣ 标准 OpenAI images/generations 格式: data[]
        if (imageUrls.length === 0 && data?.data && Array.isArray(data.data)) {
            for (const item of data.data) {
                if (item?.url && isValidImageUrl(item.url)) {
                    imageUrls.push(item.url);
                } else if (item?.b64_json) {
                    // 🔧 修复黑图：检查是否已包含data:前缀
                    if (item.b64_json.startsWith('data:')) {
                        imageUrls.push(item.b64_json);
                    } else {
                        imageUrls.push(`data:image/png;base64,${item.b64_json}`);
                    }
                }
            }
            if (imageUrls.length > 0) {
                console.log('[banana2] 从 data 数组提取到图片:', imageUrls.length);
            }
        }

        // 3️⃣ 直接 data.url 格式
        if (imageUrls.length === 0 && data?.url && isValidImageUrl(data.url)) {
            imageUrls = [data.url];
            console.log('[banana2] 从 data.url 直接提取');
        }

        // 4️⃣ 兼容 choices[0].message.content 格式（星梦画师/即梦旧格式）
        if (imageUrls.length === 0) {
            const content = data?.choices?.[0]?.message?.content;
            if (content) {
                console.log('[banana2] 尝试从 choices.content 提取:', typeof content);
                if (typeof content === 'string' && isValidImageUrl(content)) {
                    imageUrls = [content];
                } else if (typeof content === 'string') {
                    // 尝试解析JSON字符串 ("[{\"url\":\"https://...\"}]")
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
                if (imageUrls.length > 0) {
                    console.log('[banana2] 从 choices.content 提取到图片:', imageUrls.length);
                }
            }
        }

        // 🔧 获取主图URL
        imageUrl = imageUrls[0] || null;

        if (!imageUrl) {
            // ⚠️ API返回数据但无图片URL
            console.error('[banana2] 无效图片URL, 原始返回:', JSON.stringify(data).substring(0, 800));
            throw new Error('API 未返回图片，可能内容审核未通过');
        }

        // ✅ 生成成功：保存记录并返回（已在开头扣费）
        await __saveGenerationRecord(userId, 'image', imageUrl, prompt, model, filmCost, { aspect_ratio, resolution, imageCount: imageUrls.length });

        console.log(`[banana2] ✅ 图片生成成功, 图片数=${imageUrls.length}, 计费=${billingSuccess ? filmCost + '胶片' : '无'}`);

        json(200, {
            success: true,
            url: imageUrl,
            urls: imageUrls,              // 🆕 所有图片 URL 数组
            imageCount: imageUrls.length, // 🆕 生成图片数量
            data: data.data || data.candidates,
            billed: billingSuccess ? filmCost : 0
        });

    } catch (error) {
        console.error('[image-api] 失败:', error.message);
        
        // 🔄 异常退款
        if (billingSuccess) {
            await __billing('refund', userId, filmCost, '图片生成异常退款');
        }
        json(500, { 
            success: false,
            error: 'API_ERROR', 
            error_code: 'API_ERROR',
            message: error.message,
            billed: 0
        });
    }
};
