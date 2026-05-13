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
    'doubao-seedream-4-5-251128': 7,  // 星梦画师4.5
    'doubao-seedream-5-0-260128': 7,  // 星梦画师5.0
    'jimeng-4.5': 7,           // 即梦4.5
    'gemini-3.1-flash-image-preview': 4,  // Gemini Flash 图片生成
    'gemini-3.1-flash-image-preview-2k': 4,  // Gemini Flash 2K
    'gemini-3.1-flash-image-preview-4k': 7,  // Gemini Flash 4K
    'gpt-image-2': 1,  // GPT-Image-2 官方（预扣1胶片，最终根据token动态计算）
    'gpt2': 1,           // GPT-Image-2 简写（同上）
    'gpt-image-2-all': 12,  // GPT-Image-2-All（默认4K，尺寸选项控制实际分辨率）
    'openrouter:bytedance-seed/seedream-4.5': 0  // OpenRouter Seedream 4.5（免费）
};

// 🎯 按实际 token 计费：每 1000 token = 1 胶片（最低 1 胶片）
const FILM_PER_1K_TOKENS = 1;

/**
 * 根据 API 返回的 usage 计算实际胶片消耗
 * @param {object} usage - API 返回的 { prompt_tokens, completion_tokens, total_tokens }
 * @returns {number} 应扣胶片数
 */
function calculateTokenCost(usage) {
    const totalTokens = usage?.total_tokens || ((usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0));
    if (totalTokens <= 0) return 1; // 最低 1 胶片
    return Math.max(1, Math.ceil(totalTokens / 1000 * FILM_PER_1K_TOKENS));
}

// ========== Supabase Storage 配置（大图上传，避免base64超过Vercel 4.5MB响应限制） ==========
const SUPABASE_URL = 'https://tdoquxvslsuhwgiqwbrv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const IMAGE_BUCKET = 'generated-images';

// 🆕 异步任务管理 - 通过 supabase-proxy 操作（避免直连 Supabase REST 权限问题）
// ⚠️ 需要在 Supabase 中先创建表：
// CREATE TABLE generation_tasks (id UUID PRIMARY KEY, user_id UUID, task_type TEXT, status TEXT DEFAULT 'pending', request_body JSONB, result JSONB, error TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, completed_at TIMESTAMPTZ);
const INTERNAL_BASE = 'https://lossloop.cn';

async function __createGenerationTask(userId, taskType, requestBody, customTaskId) {
    try {
        const taskId = customTaskId || require('crypto').randomUUID();
        const res = await fetch(`${INTERNAL_BASE}/api/supabase-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'createGenerationTask',
                userId,
                provider: taskType,
                model: requestBody?.model || '',
                prompt: requestBody?.prompt || '',
                requestBody,
                meta: { taskId, taskType }
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            console.warn(`[banana2] 创建任务失败: ${data.error || data.message || res.status}`);
            return null;
        }
        console.log(`[banana2] 📋 异步任务创建: ${data.taskId || taskId}`);
        return data.taskId || taskId;
    } catch(e) { console.warn(`[banana2] 创建任务异常: ${e.message}`); return null; }
}

async function __getGenerationTask(taskId) {
    try {
        // 🔧 直连 Supabase REST（使用 service key，不过滤 userId，因为轮询时不一定有 userId）
        const res = await fetch(`${SUPABASE_URL}/rest/v1/generation_tasks?id=eq.${encodeURIComponent(taskId)}&select=*&limit=1`, {
            headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
        });
        if (!res.ok) return null;
        const rows = await res.json().catch(() => ([]));
        return rows?.[0] || null;
    } catch(e) { return null; }
}

async function __updateGenerationTask(taskId, status, result, error) {
    try {
        const data = { status, updated_at: new Date().toISOString() };
        if (result) data.result = result;
        if (error) data.error = error;
        if (status === 'completed') data.completed_at = new Date().toISOString();
        // 🔧 直连 Supabase REST（service key，不过滤 userId）
        await fetch(`${SUPABASE_URL}/rest/v1/generation_tasks?id=eq.${encodeURIComponent(taskId)}`, {
            method: 'PATCH', headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch(e) { console.warn(`[banana2] 更新任务异常: ${e.message}`); }
}

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

        // 尝试上传（带10秒超时）
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${fileName}`;
        const uploadController = new AbortController();
        const uploadTimeout = setTimeout(() => uploadController.abort(), 10000);
        
        let upRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': mimeType,
                'x-upsert': 'true'
            },
            body: buffer,
            signal: uploadController.signal
        });
        clearTimeout(uploadTimeout);

        // 如果bucket不存在(404)，尝试自动创建
        if (!upRes.ok && upRes.status === 404) {
            console.log(`[banana2] Bucket "${IMAGE_BUCKET}" 不存在，尝试自动创建...`);
            const createController = new AbortController();
            const createTimeout = setTimeout(() => createController.abort(), 10000);
            const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: IMAGE_BUCKET, name: IMAGE_BUCKET, public: true }),
                signal: createController.signal
            });
            clearTimeout(createTimeout);
            
            if (createRes.ok || createRes.status === 409) {
                // 重试上传（带10秒超时）
                const retryController = new AbortController();
                const retryTimeout = setTimeout(() => retryController.abort(), 10000);
                upRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': mimeType,
                        'x-upsert': 'true'
                    },
                    body: buffer,
                    signal: retryController.signal
                });
                clearTimeout(retryTimeout);
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
 * 🌐 下载外部图片URL并上传到Supabase Storage
 * 解决第三方CDN(pro.filesystem.site等)不稳定导致前端无法加载的问题
 */
async function __downloadAndUploadToStorage(imageUrl, userId) {
    if (!SUPABASE_SERVICE_KEY) {
        console.warn('[banana2] 无SUPABASE_SERVICE_KEY，跳过图片转存');
        return null;
    }
    if (!imageUrl || typeof imageUrl !== 'string') return null;
    // 已经是Supabase URL或base64，无需转存
    if (imageUrl.includes('supabase.co') || imageUrl.startsWith('data:')) {
        return imageUrl;
    }

    try {
        console.log(`[banana2] 🌐 下载外部图片: ${imageUrl.substring(0, 80)}...`);
        const imgRes = await fetchWithTimeout(imageUrl, {}, 30000);
        if (!imgRes.ok) {
            console.warn(`[banana2] ⚠️ 下载外部图片失败: ${imgRes.status}`);
            return null;
        }
        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = imgRes.headers.get('content-type') || 'image/png';
        const ext = contentType.includes('png') ? 'png' : (contentType.includes('webp') ? 'webp' : 'jpg');
        const fileName = `${userId || 'anon'}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        // 上传到Storage
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${fileName}`;
        const uploadController = new AbortController();
        const uploadTimeout = setTimeout(() => uploadController.abort(), 10000);
        const upRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': contentType,
                'x-upsert': 'true'
            },
            body: buffer,
            signal: uploadController.signal
        });
        clearTimeout(uploadTimeout);

        if (!upRes.ok) {
            console.warn(`[banana2] ⚠️ Storage上传失败: ${upRes.status}`);
            return null;
        }

        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${fileName}`;
        console.log(`[banana2] ✅ 外部图片转存成功: ${Math.round(buffer.length / 1024)}KB → ${publicUrl.substring(0, 80)}...`);
        return publicUrl;
    } catch (err) {
        console.warn(`[banana2] ⚠️ 图片转存异常: ${err.message}`);
        return null;
    }
}

/**
 * 📝 保存生成记录 - 确保用户能找回已生成的内容
 */
async function __saveGenerationRecord(userId, recordType, contentUrl, prompt, model, cost, metadata) {
    if (!userId) return { success: false, error: 'no userId' };

    try {
        const baseUrl = 'https://www.rollroll.art';

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
    const SUPABASE_URL = 'https://tdoquxvslsuhwgiqwbrv.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    };

    try {
        const profileUrl = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=quota_balance,quota_used`;
        const profileRes = await fetch(profileUrl, { headers });
        if (!profileRes.ok) throw new Error(`获取余额失败: ${profileRes.status}`);
        const rows = await profileRes.json().catch(() => []);
        const row = rows?.[0];
        if (!row) throw new Error('用户不存在');

        const currentBalance = row.quota_balance || 0;
        const currentUsed = row.quota_used || 0;
        let newBalance, newUsed;

        if (billingAction === 'consume') {
            if (currentBalance < intAmount) throw new Error('余额不足');
            newBalance = Math.round((currentBalance - intAmount) * 100) / 100;
            newUsed = Math.round((currentUsed + intAmount) * 100) / 100;
        } else {
            newBalance = Math.round((currentBalance + intAmount) * 100) / 100;
            newUsed = currentUsed;
        }

        const updateUrl = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`;
        const updateData = { quota_balance: newBalance };
        if (billingAction === 'consume') updateData.quota_used = newUsed;

        const updateRes = await fetch(updateUrl, { method: 'PATCH', headers, body: JSON.stringify(updateData) });
        if (!updateRes.ok) throw new Error(`更新余额失败: ${updateRes.status}`);

        fetch(`${SUPABASE_URL}/rest/v1/quota_logs`, {
            method: 'POST', headers,
            body: JSON.stringify({ user_id: userId, action_type: billingAction === 'refund' ? 'recharge' : 'consume', amount: billingAction === 'refund' ? intAmount : -intAmount, balance_after: newBalance, description: description || (billingAction === 'refund' ? '退款' : '消费') })
        }).catch(() => {});

        console.log(`[banana2] 💰 ${billingAction === 'refund' ? '退款' : '扣费'}成功: ${userId} ${billingAction === 'refund' ? '+' : '-'}${intAmount}胶片`);
        return { success: true, newBalance, newUsed };
    } catch (e) {
        if (billingAction === 'consume') throw e;
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
    'https://api.wlai.vip',
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
    console.log(`[banana2] 📥 fetchWithFallback 收到模型:`, model);
    const is4k = /4k/i.test(model);
    const is2k = /2k/i.test(model);
    const isJimeng = model.includes('jimeng');
    const isSeedream = model.includes('seedream') || model.includes('doubao') || model.includes('openrouter:bytedance-seed/seedream');
    const modelLower = model.toLowerCase();
    const isGptImage2 = modelLower === 'gpt-image-2' || modelLower === 'gpt2';
    const isGptImage2All = modelLower.includes('gpt-image-2-all');
    const isGptImage2Family = isGptImage2 || isGptImage2All;
    // 🔧 统一超时设置：Cloudflare 100秒限制，所有模型统一 95 秒
    // 避免 524 错误（Cloudflare 在 100 秒时断开连接）
    const baseTimeoutMs = is4k ? 95000 : (is2k || isGptImage2All ? 95000 : (isGemini3Native ? 85000 : (isJimeng ? 80000 : (isSeedream ? 85000 : 80000))));

    const GLOBAL_DEADLINE_MS = 95000;  // 统一 95 秒，避免 Cloudflare 524
    const startTime = Date.now();

    // 根据实际模型名构建正确的 API 路径
    const geminiModel = geminiModelName || 'gemini-3.1-flash-image-preview';
    // 🆕 GPT-Image-2 系列支持图生图/编辑模式
    const hasRefImage = !!(requestBody?.image_url || (requestBody?.image_urls && requestBody.image_urls.length > 0));
    let apiPath;
    
    if (isGemini3Native) {
        apiPath = `/v1beta/models/${geminiModel}:generateContent`;
    } else if (isGptImage2 && hasRefImage) {
        // 🆕 GPT-Image-2 官方模型带参考图/编辑：使用 images/edits 端点
        apiPath = '/v1/images/edits';
        console.log(`[banana2] 🔧 GPT-Image-2 官方模型带参考图/编辑，使用 edits 端点`);
    } else {
        // 其他模型（包括 gpt-image-2-all）使用 generations 端点
        apiPath = '/v1/images/generations';
        if (isGptImage2All && hasRefImage) {
            console.log(`[banana2] 🔧 GPT-Image-2-All 带参考图，使用 generations 端点`);
        }
    }
    console.log(`[banana2] 🔧 模型 ${model || 'gemini-3'} 使用端点: ${apiPath}, 单端点超时: ${baseTimeoutMs}ms`);

    if (YUNMENG_API_KEYS.length === 0) {
        throw new Error('未配置YUNMENG_API_KEY环境变量，无法调用图片生成API');
    }

    const apiKey = YUNMENG_API_KEYS[0];

    // 🆕 GPT-Image-2 系列：构建请求体
    let finalRequestBody = { ...requestBody };
    // 🆕 传递 response_format 参数（例如 "psd" 用于生成分层PSD）
    if (requestBody.response_format) {
        finalRequestBody.response_format = requestBody.response_format;
        console.log(`[banana2] 📄 设置response_format:`, requestBody.response_format);
    }
    console.log(`[banana2] 📝 构建finalRequestBody前，原始model:`, requestBody.model, 'isGptImage2:', isGptImage2, 'isGptImage2All:', isGptImage2All, 'isGptImage2Family:', isGptImage2Family, 'hasRefImage:', hasRefImage, 'requestBody.image_urls:', !!requestBody.image_urls, 'requestBody.image_url:', !!requestBody.image_url);
    let refImages = [];
    if (isGptImage2Family && hasRefImage) {
        refImages = requestBody.image_urls || (requestBody.image_url ? [requestBody.image_url] : []);
        // 🔧 直接使用原始参考图（base64或URL），云雾API原生支持base64
        const uploadedRefs = [];
        for (let ri = 0; ri < refImages.length; ri++) {
            const ref = refImages[ri];
            if (ref) {
                uploadedRefs.push(ref);
            }
        }
        refImages = uploadedRefs;

        if (refImages.length > 0) {
            if (isGptImage2) {
                finalRequestBody.images = refImages.map(url => ({ image_url: String(url).trim() }));
                delete finalRequestBody.image_url;
                delete finalRequestBody.image_urls;
                delete finalRequestBody.image;
                console.log(`[banana2] 🎨 GPT-Image-2 编辑/图生图模式: ${refImages.length}张参考图`);
                if (requestBody.mask) {
                    finalRequestBody.mask = requestBody.mask;
                }
                if (requestBody.background) {
                    finalRequestBody.background = requestBody.background;
                }
                if (requestBody.input_fidelity) {
                    finalRequestBody.input_fidelity = requestBody.input_fidelity;
                }
            } else if (isGptImage2All) {
                finalRequestBody.image = refImages.map(url => String(url).trim());
                delete finalRequestBody.image_url;
                delete finalRequestBody.image_urls;
                delete finalRequestBody.images;
                console.log(`[banana2] 🎨 GPT-Image-2-All 图生图模式: ${refImages.length}张参考图`);
            }
        }
    }
    // 🔧 清理内部字段，不发送给云雾API
    delete finalRequestBody.__userId;
    delete finalRequestBody.__idempotencyKey;
    
    // 🔍 打印完整请求体（但不打印完整base64避免日志过大）
    const logRequestBody = { ...finalRequestBody };
    if (logRequestBody.image) {
        logRequestBody.image = logRequestBody.image.map(url => url.substring(0, 80) + '...');
    }
    if (logRequestBody.images) {
        logRequestBody.images = logRequestBody.images.map(img => ({ image_url: img.image_url.substring(0, 80) + '...' }));
    }
    console.log(`[banana2] 📤 发送请求到云雾:`, JSON.stringify(logRequestBody, null, 2));

    // 🔄 依次尝试所有端点，遇到 429/5xx 自动切换，带延迟重试
    let lastError = null;
    let retryCount = 0;
    const maxRetries = 2; // 最多额外重试2轮
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        for (let i = 0; i < YUNMENG_ENDPOINTS.length; i++) {
            const endpoint = YUNMENG_ENDPOINTS[i];
            if (!endpoint) continue;

            const url = `${endpoint}${apiPath}`;
            // 🔧 全局时间守卫：如果已超过截止时间，不再尝试下一个端点
            const _elapsed = Date.now() - startTime;
            if (_elapsed >= GLOBAL_DEADLINE_MS) {
                console.warn(`[banana2] ⏰ 全局时间守卫触发 (已耗时${Math.round(_elapsed / 1000)}s >= ${Math.round(GLOBAL_DEADLINE_MS / 1000)}s)，停止尝试`);
                break;
            }
            // 🔧 剩余时间作为本端点的超时上限
            const _remainingMs = GLOBAL_DEADLINE_MS - _elapsed;
            const _endpointTimeoutMs = Math.min(baseTimeoutMs, _remainingMs);
            console.log(`[banana2] ☁️ 请求端点[${i + 1}/${YUNMENG_ENDPOINTS.length}] (第${attempt + 1}轮): ${endpoint} (超时${Math.round(_endpointTimeoutMs / 1000)}s, 剩余${Math.round(_remainingMs / 1000)}s)`);

            try {
                console.log(`[banana2] 🚀 发送请求到 ${url}, 模型: ${finalRequestBody.model}, 端点: ${apiPath}`);
                    console.log(`[banana2] 📤 请求体:`, JSON.stringify(finalRequestBody, null, 2));
                    const response = await fetchWithTimeout(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                            ...(requestBody?.__idempotencyKey ? { 'Idempotency-Key': String(requestBody.__idempotencyKey) } : {})
                        },
                        body: JSON.stringify(finalRequestBody)
                    }, _endpointTimeoutMs);

                if (response.ok) {
                    console.log(`[banana2] ☁️ ✅ 端点[${i + 1}]成功 (耗时${Math.round((Date.now() - startTime) / 1000)}s)`);
                    return response;
                }

                // 4xx 客户端错误不重试（参数错误、余额不足等），但 429 可以换端点重试
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    console.warn(`[banana2] ☁️ 端点[${i + 1}]客户端错误 ${response.status}，不再重试`);
                    throw new Error(`请求失败: ${response.status}`);
                }

                // 5xx 或 429 错误，记录并尝试下一个端点
                console.warn(`[banana2] ☁️ 端点[${i + 1}]返回 ${response.status}，尝试下一个端点...`);
                lastError = new Error(`图片生成失败: ${response.status}`);

            } catch (err) {
                // 客户端错误直接抛出
                if (err.message.startsWith('请求失败:')) throw err;

                console.warn(`[banana2] ☁️ 端点[${i + 1}]异常: ${err.message}`);
                lastError = err;
            }
        }
        
        // 如果还有重试次数，且是因为429/5xx失败，等待后重试
        if (attempt < maxRetries && lastError && (lastError.message.includes('429') || lastError.message.includes('5'))) {
            const delayMs = 3000 * (attempt + 1); // 3s, 6s 递增
            console.log(`[banana2] ⏳ 所有端点失败，等待 ${delayMs}ms 后第 ${attempt + 2} 轮重试...`);
            await new Promise(r => setTimeout(r, delayMs));
        } else {
            break;
        }
    }

    // 所有端点都失败了
    throw new Error(`图片生成超时或节点不可用: ${lastError?.message || '所有端点均失败'}`);
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
            180000
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
    let json = (status, payload) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        json(204, {});
        return;
    }

    // 🆕 GET 端点：轮询任务状态（异步任务模式）
    if (req.method === 'GET') {
        const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
        const taskId = url.searchParams.get('task_id');

        if (!taskId) {
            json(400, { error: 'MISSING_TASK_ID' });
            return;
        }

        try {
            const task = await __getGenerationTask(taskId);
            if (!task) {
                // 🔧 不返404：Supabase记录可能还在异步写入中，返回 pending 状态让前端继续轮询
                json(200, { status: 'pending', message: '任务正在初始化...' });
                return;
            }
            json(200, task);
        } catch (err) {
            console.error('[banana2] GET 任务查询失败:', err.message);
            json(500, { error: 'INTERNAL_ERROR', message: err.message });
        }
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
            model = 'gemini-3.1-flash-image-preview',  // ✅ 云梦 API 的 Gemini Flash 图片生成模型
            aspect_ratio = '1:1',
            image_url,   // 单图（兼容旧版）
            image_urls,  // 🆕 多图融合数组
            response_format, // 🆕 响应格式：支持 "psd"、"png" 等
            userId: reqUserId,       // 🔐 用户ID（计费用）
            async: isAsync           // 🆕 异步模式：true 时立即返回 task_id，后台生成
        } = body || {};

        console.log(`[banana2] 📥 收到请求: model=${model}, prompt=${prompt?.substring(0, 30)}..., async=${isAsync}`);

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
            // ✅ modelscope 走真正的魔塔 API (qwen-image-max)，与 GPT 模型完全分开
            mappedModel = 'qwen-image-max';
            useModelScopeAPI = true;
            useYunwuAPI = false;
            console.log(`[banana2] 🔄 模型映射: modelscope -> qwen-image-max (魔塔API)`);
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
            // 改用云梦API的GPT-Image-2-All替代
            mappedModel = 'gpt-image-2-all';
            useModelScopeAPI = false;
        }

        console.log(`[banana2] 🔑 可用API Key数量: 云梦=${YUNMENG_API_KEYS.length}, 魔塔=${MODELSCOPE_API_KEY ? 1 : 0}`);

        console.log('[banana2] 图片生成:', {
            model,
            aspect_ratio,
            hasRefImage: !!image_url,
            hasRefImages: !!(image_urls && Array.isArray(image_urls) && image_urls.length > 0),
            refImagesCount: image_urls ? image_urls.length : 0,
            promptLength: prompt.length
        });

        // 🔧 模型名称映射：模型不再携带 2K/4K，分辨率统一由尺寸/比例字段决定
        let actualModel = model;
        let resolution = '4K';  // 默认统一 4K

        // 🆕 OpenRouter 模型处理：去掉前缀
        if (model.startsWith('openrouter:')) {
            actualModel = model.replace('openrouter:', '');
            console.log(`[banana2] 🔄 OpenRouter 模型映射: ${model} -> ${actualModel}`);
        }

        // ✅ 优先按前端传来的尺寸值推断分辨率，彻底避免“4K模型 + 4K尺寸 => 8K”叠加
        if (/^(2048x2048|2048x1152|1152x2048)$/i.test(aspect_ratio)) {
            resolution = '2K';
        } else if (/^(1024x1024|1536x1024|1024x1536)$/i.test(aspect_ratio)) {
            resolution = '1K';
        } else {
            resolution = '4K';
        }

        // 🆓 modelscope 免费模型使用 1K 分辨率，避免超大尺寸导致 API 503
        if (model === 'modelscope') {
            resolution = '1K';
            console.log(`[banana2] 🆓 modelscope 免费模型限制为 1K 分辨率`);
        }

        if (model === 'nano-banana-2' || model === 'banana2') {
            actualModel = 'gpt-image-2-all';
            console.log(`[banana2] 🔄 模型映射: ${model} -> ${actualModel} (${resolution})`);
        } else if (model.includes('seedream') || model.includes('doubao')) {
            actualModel = model;
            console.log(`[banana2] 🔄 星梦画师模型: ${model} (${resolution})`);
        } else if (model === 'gemini-3.1-flash-image-preview') {
            actualModel = 'gemini-3.1-flash-image-preview';
            console.log(`[banana2] 🔄 模型: ${model} (${resolution})`);
        } else if (model === 'gpt-image-2' || model === 'gpt2') {
            actualModel = 'gpt-image-2';
            console.log(`[banana2] 🔄 模型: ${model} -> ${actualModel} (${resolution})`);
        } else if (model === 'gpt-image-2-all') {
            actualModel = 'gpt-image-2-all';
            console.log(`[banana2] 🔄 模型: ${model} -> ${actualModel} (${resolution})`);
        }

        // 🔧 模型特殊处理
        const isSeedream = actualModel && (actualModel.includes('seedream') || actualModel.includes('doubao'));
        const isJimeng = actualModel && actualModel.includes('jimeng');
        // ✅ modelscope 映射后会是 gemini-3，所以要用 actualModel 或 mappedModel 判断
        // ✅ 覆盖 gemini-3.0 和 gemini-3.1 图片模型
        let isGemini3 = (actualModel && (actualModel.includes('gemini-3.1-flash-image-preview'))) || (mappedModel && mappedModel.includes('gemini-3.1-flash-image-preview'));
        const isNanoBanana = model && (model === 'nano-banana-2' || model === 'banana2');
        // 🆕 modelscope 和 qwen-image-max 都走魔塔 API (ModelScope)
        const isQwenImageMax = useModelScopeAPI && (model === 'modelscope' || model === 'qwen-image-max' || model === 'Qwen/Qwen-Image-2512');
        // 🆕 OpenRouter 图片模型
        const isOpenRouterImage = model && model.startsWith('openrouter:');
        // 🆕 GPT-Image-2 官方模型
        const isGptImage2 = model === 'gpt-image-2' || model === 'gpt2';
        const isGptImage2All = model === 'gpt-image-2-all';

        let response;

        // 🆕 长连接直返模式（已禁用，前端不支持）：
        // 1) 所有 GPT-Image-2-All 变体（1K/2K/4K）
        // 2) GPT-Image-2 官方模型在参考图生图/编辑模式下
        // 暂时禁用长连接模式，直接返回 JSON，避免前端解析失败
        const hasGptRefInput = !!image_url || !!(image_urls && Array.isArray(image_urls) && image_urls.length > 0);
        const isLongRunningGptRequest = false; // 禁用长连接模式: isGptImage2All || (isGptImage2 && hasGptRefInput);
        if (isLongRunningGptRequest && userId && filmCost > 0) {
            console.log(`[banana2] 🚀 GPT 图片长连接直返模式启动: model=${model}, resolution=${resolution}, hasRef=${hasGptRefInput}`);
            // 立即发送响应头，建立连接
            res.writeHead(200, {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'X-Content-Type-Options': 'nosniff'
            });
            // 🔧 立刻先发一个字节，马上把响应冲出去，避免卡到 15 秒后才有首包
            try { res.write('.'); } catch (e) {}
            // 心跳保活：每 15 秒发一个点，防止 Cloudflare 100s 杀连接
            const heartbeat = setInterval(() => {
                try { res.write('.'); } catch (e) { clearInterval(heartbeat); }
            }, 15000);
            // 🔄 重写 json 函数：停止心跳后输出最终 JSON
            const _origJson = json;
            json = function(status, payload) {
                clearInterval(heartbeat);
                // 最终响应是纯 JSON，前端通过 lastIndexOf('{') 提取
                res.end(JSON.stringify(status === 200 ? { ...payload, _streamed: true } : payload));
                // 后台异步补录 Supabase（不阻塞响应）
                if (status === 200) {
                    __updateGenerationTask(taskId, 'completed', { url: payload.url, urls: payload.urls || [payload.url], billed: payload.billed || 0 }).catch(() => {});
                }
            };
            taskId = require('crypto').randomUUID();
            // 后台异步创建 Supabase 记录
            __createGenerationTask(userId, 'image', { prompt, model, aspect_ratio, image_url: image_url || null, image_urls: image_urls || null, resolution }, taskId).catch(() => {});
            // 继续执行图片生成，完成后 json(200, responseData) 会被重写的 json 处理
        }

        // 🆕 modelscope 走魔塔原生 API（免费）
        if (model === 'modelscope') {
            try {
                // 根据 aspect_ratio 计算 size
                let size = '1024*1024';  // 默认正方形
                if (aspect_ratio === '21:9') {
                    size = '1024*432';
                } else if (aspect_ratio === '16:9') {
                    size = '1024*576';
                } else if (aspect_ratio === '9:16') {
                    size = '576*1024';
                } else if (aspect_ratio === '4:3') {
                    size = '1024*768';
                } else if (aspect_ratio === '3:4') {
                    size = '768*1024';
                } else if (aspect_ratio === '1:1') {
                    size = '1024*1024';
                }
                console.log(`[banana2] 🆓 modelscope 魔塔API size: ${size} (aspect_ratio=${aspect_ratio})`);

                const refImage = (image_urls && Array.isArray(image_urls) && image_urls.length > 0) ? image_urls : (image_url || null);
                const imageUrl = await callQwenImageMax(prompt, { size, image_url: refImage });

                // ✅ 生成成功：保存记录并返回（免费，不扣费）
                await __saveGenerationRecord(userId, 'image', imageUrl, prompt, 'modelscope', 0, { aspect_ratio, size });

                console.log(`[banana2] ✅ modelscope 魔塔API 生成成功, 计费=免费`);
                json(200, {
                    success: true,
                    url: imageUrl,
                    data: [{ url: imageUrl }],
                    billed: 0
                });
                return;
            } catch (err) {
                console.error('[banana2] modelscope 魔塔API 失败:', err.message);
                json(500, {
                    success: false,
                    error: 'API_ERROR',
                    error_code: 'API_ERROR',
                    message: `智能绘图生成失败: ${err.message}`,
                    billed: 0
                });
                return;
            }
        }

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
                if (aspect_ratio === '21:9') {
                    size = '1328x570';   // 超宽：宽1328 x 高570
                } else if (aspect_ratio === '16:9') {
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
                if (aspect_ratio === '21:9') {
                    width = 2560;
                    height = 1080;
                } else if (aspect_ratio === '16:9' || aspect_ratio === '16:10') {
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
            } else if (aspect_ratio === '16:9' || aspect_ratio === '4:3' || aspect_ratio === '21:9') {
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
                '1:1': '1:1',     // 正方形
                '21:9': '21:9'    // 超宽银幕
            };
            geminiAspectRatio = aspectMap[aspect_ratio] || '1:1';
            console.log(`[banana2] 🎯 Gemini aspect_ratio: 前端=${aspect_ratio}, 实际=${geminiAspectRatio}`);

            let width, height;
            if (aspect_ratio === '21:9') {
                width = (resolution === '4K') ? 3840 : (resolution === '2K' ? 2560 : 1920);
                height = (resolution === '4K') ? 1646 : (resolution === '2K' ? 1097 : 823);
            } else if (aspect_ratio === '16:9' || aspect_ratio === '16:10') {
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

            console.log(`[banana2] Gemini原生格式请求, model: ${actualModel}, aspectRatio: ${aspect_ratio}, resolution: ${resolution}`);
            response = await fetchWithFallback(geminiRequestBody, true, actualModel);
        } else {
            // 其他模型使用 OpenAI 兼容格式
            const requestBody = {
                model: actualModel,
                prompt,
                __userId: userId
            };

            if (isSeedream) {
                // 🔧 修复比例反转：星梦画师使用 size 参数（宽x高格式）
                let width, height;
                if (aspect_ratio === '21:9') {
                    width = (resolution === '4K') ? 3840 : (resolution === '2K' ? 2560 : 1920);
                    height = (resolution === '4K') ? 1646 : (resolution === '2K' ? 1097 : 823);
                } else if (aspect_ratio === '16:9' || aspect_ratio === '16:10') {
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
                if (aspect_ratio === '21:9') {
                    width = (resolution === '4K') ? 3840 : (resolution === '2K' ? 2560 : 1920);
                    height = (resolution === '4K') ? 1646 : (resolution === '2K' ? 1097 : 823);
                } else if (aspect_ratio === '16:9' || aspect_ratio === '16:10') {
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
            } else if (isGptImage2) {
                // ✅ gpt-image-2 官方支持的尺寸
                // 前端直接发送尺寸格式（如1024x1024），后端直接使用
                if (aspect_ratio && aspect_ratio.includes('x')) {
                    requestBody.size = aspect_ratio;
                    console.log(`[banana2] gpt-image-2 直接使用前端尺寸: ${aspect_ratio}`);
                } else {
                    // 按比例计算尺寸
                    let width, height;
                    if (aspect_ratio === '16:9') {
                        width = 1536;
                        height = 1024;
                    } else if (aspect_ratio === '9:16') {
                        width = 1024;
                        height = 1536;
                    } else if (aspect_ratio === '4:3') {
                        width = 1024;
                        height = 768;
                    } else if (aspect_ratio === '3:4') {
                        width = 768;
                        height = 1024;
                    } else if (aspect_ratio === '1:1') {
                        width = 1024;
                        height = 1024;
                    } else if (aspect_ratio === '21:9') {
                        width = 2560;
                        height = 1080;
                    } else if (aspect_ratio === 'auto' || !aspect_ratio) {
                        width = 1024;
                        height = 1024;
                    } else {
                        width = 1024;
                        height = 1024;
                    }
                    requestBody.size = `${width}x${height}`;
                    console.log(`[banana2] gpt-image-2 计算尺寸: ${requestBody.size} (${aspect_ratio})`);
                }
            } else if (isGptImage2All) {
                // ✅ gpt-image-2-all 尺寸完全由前端尺寸选项控制，模型名不再携带 2K/4K
                if (aspect_ratio && aspect_ratio.includes('x')) {
                    requestBody.size = aspect_ratio;
                    console.log(`[banana2] gpt-image-2-all 直接使用前端尺寸: ${aspect_ratio}`);
                } else {
                    let width, height;
                    const sizeMultiplier = resolution === '4K' ? 4 : (resolution === '2K' ? 2 : 1);
                    if (aspect_ratio === '16:9') {
                        width = 1536 * sizeMultiplier;
                        height = 1024 * sizeMultiplier;
                    } else if (aspect_ratio === '9:16') {
                        width = 1024 * sizeMultiplier;
                        height = 1536 * sizeMultiplier;
                    } else if (aspect_ratio === '4:3') {
                        width = 1024 * sizeMultiplier;
                        height = 768 * sizeMultiplier;
                    } else if (aspect_ratio === '3:4') {
                        width = 768 * sizeMultiplier;
                        height = 1024 * sizeMultiplier;
                    } else if (aspect_ratio === '1:1') {
                        width = 1024 * sizeMultiplier;
                        height = 1024 * sizeMultiplier;
                    } else if (aspect_ratio === '21:9') {
                        width = 2560 * sizeMultiplier;
                        height = 1080 * sizeMultiplier;
                    } else if (aspect_ratio === 'auto' || !aspect_ratio) {
                        width = 1024 * sizeMultiplier;
                        height = 1024 * sizeMultiplier;
                    } else {
                        width = 1024 * sizeMultiplier;
                        height = 1024 * sizeMultiplier;
                    }
                    requestBody.size = `${width}x${height}`;
                    console.log(`[banana2] gpt-image-2-all 计算尺寸: ${requestBody.size} (${aspect_ratio}, ${resolution})`);
                }
            } else {
                // 其他模型默认使用 size
                requestBody.size = '1024x1024';
                console.log(`[banana2] ${model} 使用默认size: 1024x1024`);
            }

            // 图生图模式（支持多图融合）
            if (image_urls && Array.isArray(image_urls) && image_urls.length > 0) {
                requestBody.image_urls = image_urls;
                console.log(`[banana2] 多图融合模式: ${image_urls.length} 张参考图，第一个参考图:`, image_urls[0] ? (typeof image_urls[0] + ' ' + (image_urls[0].startsWith('data:') ? 'base64' : 'http')) : 'null');
            } else if (image_url) {
                requestBody.image_url = image_url;
                console.log(`[banana2] 单图模式:`, image_url ? (typeof image_url + ' ' + (image_url.startsWith('data:') ? 'base64' : 'http')) : 'null');
            }

            console.log(`[banana2] 📤 即将调用fetchWithFallback，requestBody.model:`, requestBody.model);
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
        let data = await Promise.race([
            response.json(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('响应体读取超时(180s)，图片数据过大或网络慢')), 180000))
        ]);

        // 🔧 GPT-Image-2-All 异步任务处理：如果返回 task_id，根据 pollBackend 参数决定是否后端轮询
        const pollBackend = req.body.pollBackend !== false;  // 默认 true，向后兼容
        if (isGptImage2All && data?.task_id) {
            if (pollBackend) {
                // 旧模式：后端轮询（给 banana.html 用）
                console.log(`[banana2] 🤖 GPT-Image-2-All 后端轮询模式: ${data.task_id}，开始轮询...`);
                const taskId = data.task_id;
                const maxPollAttempts = 200;  // 200次 × 3秒 = 600秒
                let pollData = null;

                for (let pollAttempt = 0; pollAttempt < maxPollAttempts; pollAttempt++) {
                    await new Promise(resolve => setTimeout(resolve, 3000));  // 3秒轮询间隔

                    try {
                        const pollResponse = await fetchWithTimeout(
                            `https://yunwu.ai/v1/images/generations/${taskId}`,
                            {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${apiKey}`,
                                    'Content-Type': 'application/json'
                                }
                            },
                            60000
                        );

                        if (pollResponse.ok) {
                            pollData = await pollResponse.json();
                            console.log(`[banana2] 轮询[${pollAttempt + 1}/${maxPollAttempts}]:`, JSON.stringify(pollData).substring(0, 200));

                            // 检查是否完成
                            if (pollData?.data && pollData.data.length > 0) {
                                console.log(`[banana2] ✅ GPT-Image-2-All 任务完成`);
                                data = pollData;  // 使用轮询结果
                                break;
                            }

                            // 检查状态
                            if (pollData?.status === 'failed') {
                                throw new Error(`GPT-Image任务失败: ${pollData?.error || '未知错误'}`);
                            }
                        }
                    } catch (pollErr) {
                        console.warn(`[banana2] 轮询异常: ${pollErr.message}`);
                    }

                    // 每10次输出进度
                    if ((pollAttempt + 1) % 10 === 0) {
                        console.log(`[banana2] ⏳ GPT-Image-2-All 轮询进度: ${pollAttempt + 1}/${maxPollAttempts} (${Math.round((pollAttempt + 1) * 3)}秒)`);
                    }
                }

                if (!data?.data || data.data.length === 0) {
                    throw new Error('GPT-Image-2-All 异步任务超时，未获取到结果');
                }
            } else {
                // 新模式：前端轮询（给 mobile.html 漫画功能用），立刻返回 task_id
                console.log(`[banana2] 🤖 GPT-Image-2-All 前端轮询模式: ${data.task_id}，直接返回给前端`);
                data.needPoll = true;  // 标记需要前端轮询
            }
        }

        // 🔧 调试：输出原始返回格式
        console.log('[banana2] 返回数据完整格式:', JSON.stringify(data).substring(0, 1500));

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

        // 🔧 只处理超大base64，其他URL直接返回（避免过度转换导致失败）
        const _storageUploads = [];
        for (let i = 0; i < imageUrls.length; i++) {
            const imgData = imageUrls[i];
            // 只上传超大base64（超过3MB），普通URL和小型base64直接返回
            if (imgData && imgData.startsWith('data:') && imgData.length > 3 * 1024 * 1024) {
                _storageUploads.push({ index: i, type: 'base64', data: imgData });
            }
            // 外部CORS受限的URL才下载到Storage（跳过已经是supabase的URL）
            else if (imgData && imgData.startsWith('http') && !imgData.includes('supabase.co') && !imgData.includes('rollroll.art')) {
                _storageUploads.push({ index: i, type: 'url', data: imgData });
            }
        }
        if (_storageUploads.length > 0) {
            for (const upload of _storageUploads) {
                const i = upload.index;
                try {
                    if (upload.type === 'base64') {
                        const imgData = upload.data;
                        const match = imgData.match(/^data:([^;]+);base64,(.+)$/);
                        if (match) {
                            console.log(`[banana2] 📤 图片${i}过大(${Math.round(imgData.length / 1024 / 1024)}MB)，上传到Storage...`);
                            const storageUrl = await __uploadBase64ToStorage(match[2], match[1], userId);
                            if (storageUrl) {
                                imageUrls[i] = storageUrl;
                            } else {
                            console.warn(`[banana2] ⚠️ Storage上传失败，保留原始URL（超大base64）`);
                            }
                        }
                    } else if (upload.type === 'url') {
                        // 🔧 下载CORS受限的图片到Storage
                        console.log(`[banana2] 📤 图片${i}存在CORS限制，下载到Storage...`);
                        try {
                            const response = await fetchWithTimeout(imgData, {}, 30000);
                            if (!response.ok) throw new Error(`HTTP ${response.status}`);
                            const buffer = await response.arrayBuffer();
                            const base64 = Buffer.from(buffer).toString('base64');
                            const mimeType = response.headers.get('content-type') || 'image/png';
                            const storageUrl = await __uploadBase64ToStorage(base64, mimeType, userId);
                            if (storageUrl) {
                                imageUrls[i] = storageUrl;
                                console.log(`[banana2] ✅ CORS图片转换成功: ${imgData.substring(0, 50)}... -> ${storageUrl}`);
                            } else {
                                console.warn(`[banana2] ⚠️ CORS图片下载失败，保留原URL`);
                            }
                        } catch (downloadErr) {
                            console.warn(`[banana2] ⚠️ CORS图片下载异常: ${downloadErr.message}`);
                        }
                    }
                } catch (uploadErr) {
                    console.warn(`[banana2] ⚠️ Storage上传异常: ${uploadErr.message}，移除超大图片`);
                    imageUrls[i] = null;
                }
            }
        }
        imageUrl = imageUrls.filter(Boolean)[0] || null;

        if (!imageUrl) {
            console.error('[banana2] 所有图片URL无效（Storage上传可能失败）');
            throw new Error('图片生成成功但无法获取URL，请重试');
        }

        // 🌐 转存外部CDN图片到Supabase Storage（解决pro.filesystem.site等CDN不稳定问题）
        for (let i = 0; i < imageUrls.length; i++) {
            const imgUrl = imageUrls[i];
            if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http') && !imgUrl.includes('supabase.co')) {
                console.log(`[banana2] 🌐 图片${i}是外部URL，尝试转存到Storage...`);
                try {
                    const storageUrl = await __downloadAndUploadToStorage(imgUrl, userId);
                    if (storageUrl) {
                        imageUrls[i] = storageUrl;
                    } else {
                        console.warn(`[banana2] ⚠️ 图片${i}转存失败，保留原始URL`);
                    }
                } catch (transferErr) {
                    console.warn(`[banana2] ⚠️ 图片${i}转存异常: ${transferErr.message}，保留原始URL`);
                }
            }
        }
        imageUrl = imageUrls.filter(Boolean)[0] || null;

        const validImageUrls = imageUrls.filter(Boolean);

        // 🎯 GPT-Image-2 官方模型：根据 token 重新计算胶片
        let actualFilmCost = filmCost;
        if (isGptImage2 && data?.usage) {
            const calculatedCost = calculateTokenCost(data.usage);
            console.log(`[banana2] 🎯 GPT-Image-2 token用量:`, data.usage, `→ 重新计算胶片: ${calculatedCost}`);
            
            if (calculatedCost !== filmCost) {
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, 'GPT-Image-2预扣退还');
                }
                if (calculatedCost > 0 && userId && !skipBilling) {
                    const billingResult = await __billing('consume', userId, calculatedCost, `画图生成:GPT-Image-2`);
                    billingSuccess = billingResult.success && !billingResult.skipped;
                }
                actualFilmCost = calculatedCost;
            }
        }

        // 🔧 关键优化：先立即返回响应给前端，保存记录改为异步不阻塞
        // 图片已生成成功，前端需要尽快拿到URL，保存记录不应阻塞响应
        console.log(`[banana2] ✅ 图片生成成功, 图片数=${validImageUrls.length}, 计费=${billingSuccess ? actualFilmCost + '胶片' : '无'}`);

        const responseData = {
            success: true,
            url: imageUrl,
            urls: validImageUrls,
            imageCount: validImageUrls.length,
            billed: billingSuccess ? actualFilmCost : 0
        };

        // 🔧 保存记录加短超时（5秒），超时则跳过但不阻塞响应
        // 图片已生成成功，前端需要尽快拿到URL，保存记录不应成为瓶颈
        if (userId && imageUrl) {
            try {
                await Promise.race([
                    __saveGenerationRecord(userId, 'image', imageUrl, prompt, model, actualFilmCost, { aspect_ratio, resolution, imageCount: validImageUrls.length, usage: data?.usage }),
                    new Promise((resolve) => setTimeout(resolve, 5000))
                ]);
            } catch (saveErr) {
                console.warn(`[banana2] ⚠️ 保存记录超时或失败: ${saveErr?.message || '5s timeout'}`);
            }
        }

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
