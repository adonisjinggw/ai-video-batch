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
    'jimeng-4.5': 7,           // 即梦4.5
    'gemini-3.1-flash-image-preview': 4,  // Gemini Flash 图片生成
    'gemini-3.1-flash-image-preview-2k': 4,  // Gemini Flash 2K
    'gemini-3.1-flash-image-preview-4k': 7,  // Gemini Flash 4K
    'openrouter:bytedance-seed/seedream-4.5': 0  // OpenRouter Seedream 4.5（免费）
};

// ========== Supabase Storage 配置（大图上传，避免base64超过Vercel 4.5MB响应限制） ==========
const SUPABASE_URL = 'https://tdoquxvslsuhwgiqwbrv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const IMAGE_BUCKET = 'generated-images';

/**
 * 📤 将base64图片上传到Supabase Storage，返回公开URL
 * 解决4K图片base64响应超过Vercel 4.5MB限制的问题
 */
async function __uploadBase64ToStorage(base64Data, mimeType, userId) {
    if (!SUPABASE_SERVICE_KEY) {
        console.warn('[banana2] 无SUPABASE_SERVICE_KEY，跳过Storage上传');
        return null;
    }

    try {
        const buffer = Buffer.from(base64Data, 'base64');
        const ext = mimeType.includes('png') ? 'png' : (mimeType.includes('webp') ? 'webp' : 'jpg');
        const fileName = `${userId || 'anon'}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        // 尝试上传
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${fileName}`;
        let upRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': mimeType,
                'x-upsert': 'true'
            },
            body: buffer
        });

        // 如果bucket不存在(404)，尝试自动创建
        if (!upRes.ok && upRes.status === 404) {
            console.log(`[banana2] Bucket "${IMAGE_BUCKET}" 不存在，尝试自动创建...`);
            const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: IMAGE_BUCKET, name: IMAGE_BUCKET, public: true })
            });
            if (createRes.ok || createRes.status === 409) {
                // 重试上传
                upRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': mimeType,
                        'x-upsert': 'true'
                    },
                    body: buffer
                });
            }
        }

        if (!upRes.ok) {
            console.warn('[banana2] Storage上传失败:', upRes.status, await upRes.text().catch(() => ''));
            return null;
        }

        // 公开bucket直接用public URL
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${fileName}`;
        console.log(`[banana2] ✅ 大图已上传Storage: ${Math.round(buffer.length / 1024)}KB → ${publicUrl.substring(0, 80)}...`);
        return publicUrl;
    } catch (err) {
        console.warn('[banana2] Storage上传异常:', err.message);
        return null;
    }
}

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
function fetchWithTimeout(url, options = {}, timeoutMs = 120000) {
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

// 🆕 OpenRouter API 配置
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

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
 * ☁️ 串行 fallback：依次尝试端点，第一个成功就返回，失败才试下一个
 * ⚠️ 修复：原并行模式导致1次请求向云雾发N次（N=端点数），造成重复扣费和重复生成
 */
async function fetchWithFallback(requestBody, isGemini3Native = false, geminiModelName = '') {
    const model = String(requestBody?.model || '');
    const is4k = /4k|2k/i.test(model);
    const isJimeng = model.includes('jimeng');
    const isSeedream = model.includes('seedream') || model.includes('doubao') || model.includes('openrouter:bytedance-seed/seedream');
    // 🔧 统一超时设置：与生图页面(banana.html)保持一致
    // Gemini模型90秒，其他模型根据类型调整
    // 🔧 4K大图生成耗时更长：云雾API生成+下载可能超过90s
    const baseTimeoutMs = isGemini3Native ? (is4k ? 150000 : 120000) : (isJimeng ? 90000 : (isSeedream ? 120000 : 90000));

    // 🔧 全局时间守卫：防止总时间超过 Cloudflare 100s 代理超时
    // 4K大图需要额外时间上传Supabase Storage，所以留30秒给后处理
    const GLOBAL_DEADLINE_MS = 70000;  // 70秒硬上限，留30秒给Storage上传+计费+响应
    const startTime = Date.now();

    // 根据实际模型名构建正确的 API 路径
    const geminiModel = geminiModelName || 'gemini-3-pro-image-preview';
    const apiPath = isGemini3Native
        ? `/v1beta/models/${geminiModel}:generateContent`
        : '/v1/images/generations';
    console.log(`[banana2] 🔧 模型 ${model || 'gemini-3'} 使用端点: ${apiPath}, 单端点超时: ${baseTimeoutMs}ms`);

    if (YUNMENG_API_KEYS.length === 0) {
        throw new Error('未配置YUNMENG_API_KEY环境变量，无法调用图片生成API');
    }

    const apiKey = YUNMENG_API_KEYS[0];

    // 🔧 只使用第一个（主）端点，更稳定
    const endpoint = YUNMENG_ENDPOINTS[0];
    if (!endpoint) {
        throw new Error('没有可用的API端点');
    }

    const url = `${endpoint}${apiPath}`;
    console.log(`[banana2] ☁️ 请求主端点: ${endpoint} (超时${baseTimeoutMs/1000}s)`);

    try {
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                ...(requestBody?.__idempotencyKey ? { 'Idempotency-Key': String(requestBody.__idempotencyKey) } : {})
            },
            body: JSON.stringify(requestBody)
        }, baseTimeoutMs);

        if (response.ok) {
            console.log(`[banana2] ☁️ ✅ 主端点成功 (耗时${Math.round((Date.now() - startTime) / 1000)}s)`);
            return response;
        }

        // 4xx 客户端错误不重试（参数错误、余额不足等）
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            console.warn(`[banana2] ☁️ 主端点客户端错误 ${response.status}`);
            throw new Error(`请求失败: ${response.status}`);
        }

        // 5xx 或 429 错误
        console.warn(`[banana2] ☁️ 主端点返回 ${response.status}`);
        throw new Error(`图片生成失败: ${response.status}`);
    } catch (err) {
        // 客户端错误直接抛出
        if (err.message.startsWith('请求失败:')) throw err;

        console.warn(`[banana2] ☁️ 主端点异常: ${err.message}`);
        throw new Error(`图片生成超时或节点不可用: ${err.message}`);
    }
}

/**
 * 🆕 云雾API 万象Max 图片生成
 * @param {string} prompt - 图片描述
 * @param {object} options - 配置选项
 * @returns {Promise<string>} - 图片 URL
 */
async function callQwenImageMaxViaYunwu(prompt, options = {}) {
    const {
        size = '1024x1024',
        image_url = null
    } = options;

    // 选择第一个云梦API Key
    const apiKey = YUNMENG_API_KEYS[0];
    if (!apiKey) {
        throw new Error('未配置云梦/云雾API Key');
    }

    // 🔧 云雾API官方万象模型名
    const hasRefImage = !!image_url;
    const modelName = hasRefImage ? 'qwen-image-edit-2509' : 'qwen-image-max';

    // 调用云雾API（使用 yunwu.ai 端点）
    const yunwuBaseUrl = 'https://yunwu.ai';

    if (hasRefImage) {
        // 图生图模式：使用 images/generations 端点
        const imageUrl = Array.isArray(image_url) ? image_url[0] : image_url;
        console.log(`[banana2] 🎨 云雾万象Edit (图生图)，模型: ${modelName}，参考图: ${imageUrl.substring(0, 50)}...`);

        const response = await fetchWithTimeout(
            `${yunwuBaseUrl}/v1/images/generations`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelName,
                    prompt,
                    image_url: imageUrl
                })
            },
            120000
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[banana2] 云雾万象Edit 失败: ${response.status}`, errorText);
            throw new Error(`云雾万象图生图失败: ${response.status}`);
        }

        const data = await response.json();

        // 提取图片URL
        if (data?.data?.[0]?.url) {
            return data.data[0].url;
        }

        console.error('[banana2] 云雾万象Edit 返回格式异常:', JSON.stringify(data).substring(0, 500));
        throw new Error('云雾万象图生图未返回有效图片');
    } else {
        // 文生图模式：使用 images/generations 端点
        console.log(`[banana2] 🎨 云雾万象Max (文生图)，模型: ${modelName}`);

        const response = await fetchWithTimeout(
            `${yunwuBaseUrl}/v1/images/generations`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelName,
                    prompt,
                    size: size.replace(/[*×]/g, 'x'),
                    n: 1,
                    watermark: false,
                    prompt_extend: true
                })
            },
            120000
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[banana2] 云雾万象Max 失败: ${response.status}`, errorText);
            console.error(`[banana2] 请求参数: model=${modelName}, size=${size.replace(/[*×]/g, 'x')}`);
            throw new Error(`云雾万象文生图失败: ${response.status} - ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();

        // 提取图片URL
        if (data?.data?.[0]?.url) {
            return data.data[0].url;
        } else if (data?.url) {
            return data.url;
        }

        console.error('[banana2] 云雾万象Max 返回格式异常:', JSON.stringify(data).substring(0, 500));
        throw new Error('云雾万象文生图未返回有效图片');
    }
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

    // 🔧 修复：ModelScope API 要求 size 格式为 "WxH"（用x分隔），统一转换
    const normalizedSize = size.replace(/[*×]/g, 'x');

    const requestBody = {
        model: modelName,
        prompt: prompt,
        size: normalizedSize
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
    // 🔧 优化：控制在30秒内，失败后降级Gemini还有70秒余量（Cloudflare 524 ~100秒限制）
    const maxAttempts = 15;  // 🔧 15次×2秒=30秒，给降级留够时间
    let consecutiveFailures = 0;
    let lastStatus = '';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // 🔧 固定2秒间隔，保证总轮询时间在60秒内
        const waitTime = 2000;
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

    throw new Error(`万象Max生成超时（已等待约60秒），服务器繁忙请稍后重试`);
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

        console.log(`[banana2] 📥 收到请求: model=${model}, prompt=${prompt?.substring(0, 30)}...`);

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
        // ✅ qwen-image-max 走云雾API（付费），不是ModelScope
        let mappedModel = model;
        let useModelScopeAPI = false;  // 🆕 明确标记是否使用ModelScope API
        let useYunwuAPI = false;       // 🆕 标记是否使用云雾API

        if (model === 'modelscope') {
            // ✅ modelscope免费模型使用云梦Gemini-3，不需要MODELSCOPE_API_KEY
            mappedModel = 'gemini-3-pro-image-preview';
            useModelScopeAPI = false;
            console.log(`[banana2] 🔄 模型映射: modelscope -> gemini-3-pro-image-preview (云梦API)`);
        } else if (model === 'qwen-image-max' || model === 'Qwen/Qwen-Image-2512') {
            // 🔧 万象Max走云雾API（付费），不是ModelScope
            mappedModel = 'Qwen/Qwen-Image-2512';
            useModelScopeAPI = false;  // 不用ModelScope
            useYunwuAPI = true;        // 用云雾API
            console.log(`[banana2] 🔄 模型映射: ${model} -> Qwen/Qwen-Image-2512 (云雾API)`);
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

        // 🆕 OpenRouter 模型处理：去掉前缀
        if (model.startsWith('openrouter:')) {
            actualModel = model.replace('openrouter:', '');
            console.log(`[banana2] 🔄 OpenRouter 模型映射: ${model} -> ${actualModel}`);
        }

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
        } else if (model === 'gemini-3.1-flash-image-preview') {
            actualModel = 'gemini-3.1-flash-image-preview';  // ✅ 保持3.1模型名
            resolution = '1K';
            console.log(`[banana2] 🔄 模型: ${model} (${resolution})`);
        } else if (model === 'gemini-3.1-flash-image-preview-2k') {
            actualModel = 'gemini-3.1-flash-image-preview';  // ✅ 保持3.1模型名
            resolution = '2K';
            console.log(`[banana2] 🔄 模型: ${model} -> ${actualModel} (${resolution})`);
        } else if (model === 'gemini-3.1-flash-image-preview-4k') {
            actualModel = 'gemini-3.1-flash-image-preview';  // ✅ 保持3.1模型名
            resolution = '4K';
            console.log(`[banana2] 🔄 模型: ${model} -> ${actualModel} (${resolution})`);
        }

        // 🔧 模型特殊处理
        const isSeedream = actualModel && (actualModel.includes('seedream') || actualModel.includes('doubao'));
        const isJimeng = actualModel && actualModel.includes('jimeng');
        // ✅ modelscope 映射后会是 gemini-3，所以要用 actualModel 或 mappedModel 判断
        // ✅ 覆盖 gemini-3.0 和 gemini-3.1 图片模型
        let isGemini3 = (actualModel && (actualModel.includes('gemini-3-pro-image-preview') || actualModel.includes('gemini-3.1-flash-image-preview'))) || (mappedModel && mappedModel.includes('gemini-3-pro-image-preview'));
        const isNanoBanana = model && (model.includes('nano-banana-2') || model === 'banana2' || model === 'modelscope');
        // 🆕 只有配置了MODELSCOPE_API_KEY且明确使用ModelScope API时才走qwen-image-max分支
        const isQwenImageMax = useYunwuAPI && (model === 'qwen-image-max' || model === 'Qwen/Qwen-Image-2512');
        // 🆕 OpenRouter 图片模型
        const isOpenRouterImage = model && model.startsWith('openrouter:');

        let response;

        // 🆕 qwen-image-max 使用云雾API（付费）
        if (isQwenImageMax) {
            // 🔒 先扣费
            if (!skipBilling && filmCost > 0 && userId) {
                const billingResult = await __billing('consume', userId, filmCost, `画图生成:万象Max`);
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                    return;
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            }

            try {
                // 根据 aspect_ratio 计算 size
                // 🔧 云雾API qwen-image-max 支持的尺寸: 1024x1024, 1328x1328 等
                let size = '1328x1328';  // 默认正方形
                if (aspect_ratio === '16:9') {
                    size = '1328x768';   // 横屏：宽1328 x 高768
                } else if (aspect_ratio === '9:16') {
                    size = '768x1328';   // 竖屏：宽768 x 高1328
                } else if (aspect_ratio === '4:3') {
                    size = '1328x1024';  // 横屏标准：宽1328 x 高1024
                } else if (aspect_ratio === '3:4') {
                    size = '1024x1328';  // 竖屏标准：宽1024 x 高1328
                } else if (aspect_ratio === '1:1') {
                    size = '1328x1328';  // 正方形
                }
                console.log(`[banana2] 🎨 云雾万象Max size: ${size} (aspect_ratio=${aspect_ratio})`);

                // 🎨 万象Max 支持画面控制（用文字改图），直接传参考图
                const refImage = (image_urls && Array.isArray(image_urls) && image_urls.length > 0) ? image_urls : (image_url || null);
                const imageUrl = await callQwenImageMaxViaYunwu(prompt, { size, image_url: refImage });

                // ✅ 生成成功：保存记录并返回（已在开头扣费）
                await __saveGenerationRecord(userId, 'image', imageUrl, prompt, 'qwen-image-max', filmCost, { aspect_ratio, size });

                console.log(`[banana2] ✅ 云雾万象Max 生成成功, 计费=${billingSuccess ? filmCost + '胶片' : '无'}`);
                json(200, {
                    success: true,
                    url: imageUrl,
                    data: [{ url: imageUrl }],
                    billed: billingSuccess ? filmCost : 0
                });
                return;
            } catch (err) {
                console.error('[banana2] 云雾万象Max 失败:', err.message);
                // 💰 生成失败，退款
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, '云雾万象Max失败退款');
                }
                // ❌ 不降级，直接返回错误
                json(500, {
                    success: false,
                    error: 'API_ERROR',
                    error_code: 'API_ERROR',
                    message: `万象Max生成失败: ${err.message}`,
                    billed: 0
                });
                return;
            }
        }

        // 🆕 OpenRouter 图片模型处理
        if (isOpenRouterImage && OPENROUTER_API_KEY) {
            console.log(`[banana2] 🔄 检测到 OpenRouter 模型: ${model}，使用 OpenRouter API`);
            
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
                // 计算图片尺寸
                let width, height;
                if (aspect_ratio === '16:9' || aspect_ratio === '16:10') {
                    width = 1920;
                    height = 1080;
                } else if (aspect_ratio === '9:16' || aspect_ratio === '10:16') {
                    width = 1080;
                    height = 1920;
                } else { // 1:1
                    width = 1024;
                    height = 1024;
                }

                const requestBody = {
                    prompt,
                    model: actualModel,
                    size: `${width}x${height}`
                };

                console.log(`[banana2] ☁️ 请求 OpenRouter API: ${OPENROUTER_BASE_URL}/images/generations`);
                const response = await fetchWithTimeout(`${OPENROUTER_BASE_URL}/images/generations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'HTTP-Referer': 'https://www.rollroll.art',
                        'X-Title': 'RollRoll AI'
                    },
                    body: JSON.stringify(requestBody)
                }, 120000);

                if (!response.ok) {
                    const errorText = await response.text().catch(() => '未知错误');
                    console.error('[banana2] ❌ OpenRouter API错误:', response.status, errorText);
                    throw new Error(`OpenRouter图片生成失败 (${response.status}): ${errorText}`);
                }

                const data = await response.json();
                const imageUrl = data.data?.[0]?.url;

                if (!imageUrl) {
                    console.error('[banana2] ❌ 响应中未找到图片URL:', data);
                    throw new Error('OpenRouter响应中未找到图片URL');
                }

                // ✅ 生成成功：保存记录并返回
                await __saveGenerationRecord(userId, 'image', imageUrl, prompt, model, filmCost, { size: `${width}x${height}` });

                console.log(`[banana2] ✅ OpenRouter 图片生成成功, 计费=${billingSuccess ? filmCost + '胶片' : '无'}`);
                json(200, {
                    success: true,
                    url: imageUrl,
                    data,
                    billed: billingSuccess ? filmCost : 0
                });
                return;
            } catch (err) {
                console.error('[banana2] OpenRouter 失败:', err.message);
                // 🔄 生成失败退款
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, 'OpenRouter图片生成失败退款');
                    billingSuccess = false;
                }
                // 不降级，直接返回错误
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
            // 🔧 修复：使用 actualModel 而非 model，确保降级后显示正确的模型名
            const billingModel = actualModel || model;
            const billingResult = await __billing('consume', userId, filmCost, `画图生成:${billingModel}`);
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
                            console.log(`[banana2] 参考图转换成功: ${contentType}, ${Math.round(base64Data.length / 1024)}KB`);
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

            let width, height;
            if (aspect_ratio === '16:9' || aspect_ratio === '16:10') {
                width = (resolution === '4K') ? 3840 : (resolution === '2K' ? 2560 : 1920);
                height = (resolution === '4K') ? 2160 : (resolution === '2K' ? 1440 : 1080);
            } else if (aspect_ratio === '9:16' || aspect_ratio === '10:16') {
                width = (resolution === '4K') ? 2160 : (resolution === '2K' ? 1440 : 1080);
                height = (resolution === '4K') ? 3840 : (resolution === '2K' ? 2560 : 1920);
            } else {
                width = (resolution === '4K') ? 2160 : (resolution === '2K' ? 1440 : 1080);
                height = width;
            }

            const geminiRequestBody = {
                contents: [{
                    role: 'user',
                    parts: parts
                }],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    image_config: {
                        aspect_ratio: geminiAspectRatio,
                        size: `${width}x${height}`
                    }
                }
            };
            console.log(`[banana2] Gemini图像模型使用size: ${width}x${height} (${resolution}, ${aspect_ratio})`);

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

            console.log(`[banana2] Gemini原生格式请求, model: ${actualModel}, aspectRatio: ${aspect_ratio}, resolution: ${resolution}`);
            response = await fetchWithFallback(geminiRequestBody, true, actualModel);
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
            } else if (isGemini3) {
                // ✅ Gemini图像模型根据resolution设置size
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
                console.log(`[banana2] Gemini图像模型使用size: ${requestBody.size} (${resolution}, ${aspect_ratio})`);
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

        // 🔧 body读取超时：4K大图base64可能很大（30MB+），设180s上限
        const data = await Promise.race([
            response.json(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('响应体读取超时(180s)，图片数据过大或网络慢')), 180000))
        ]);

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

        // 📤 大图上传到Supabase Storage：base64超3MB自动上传，避免超Vercel 4.5MB响应限制
        for (let i = 0; i < imageUrls.length; i++) {
            const imgData = imageUrls[i];
            if (imgData && imgData.startsWith('data:') && imgData.length > 3 * 1024 * 1024) {
                const match = imgData.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    console.log(`[banana2] 📤 图片${i}过大(${Math.round(imgData.length / 1024 / 1024)}MB)，上传到Storage...`);
                    const storageUrl = await __uploadBase64ToStorage(match[2], match[1], userId);
                    if (storageUrl) {
                        imageUrls[i] = storageUrl;
                    } else {
                        console.warn(`[banana2] ⚠️ Storage上传失败，尝试截断base64返回`);
                    }
                }
            }
        }
        imageUrl = imageUrls[0] || null;

        // ✅ 生成成功：保存记录并返回（已在开头扣费）
        await __saveGenerationRecord(userId, 'image', imageUrl, prompt, model, filmCost, { aspect_ratio, resolution, imageCount: imageUrls.length });

        console.log(`[banana2] ✅ 图片生成成功, 图片数=${imageUrls.length}, 计费=${billingSuccess ? filmCost + '胶片' : '无'}`);

        // 🔧 安全检查：确保响应体不超过Vercel限制
        const responseData = {
            success: true,
            url: imageUrl,
            urls: imageUrls,
            imageCount: imageUrls.length,
            billed: billingSuccess ? filmCost : 0
        };
        // 不再返回原始candidates/data，节省响应体积
        json(200, responseData);

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
