const BASE_URL = 'https://api-inference.modelscope.cn/';
// 🔐 API Key 必须通过环境变量配置，不在代码中暴露
const MODELSCOPE_API_KEY = process.env.MODELSCOPE_API_KEY || '';
const ZHENZHEN_API_KEY = process.env.ZHENZHEN_API_KEY || '';

// ========== 计费配置 ==========
const FILM_COST = {
    'image': 3,           // 图片生成
    'image2image': 4,     // 图生图
    'text': 1             // 文本生成
};

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
            console.error(`[modelscope] 退款失败:`, data);
            return { success: false, error: data.message || data.error };
        }
        
        console.log(`[modelscope] 💰 ${billingAction === 'refund' ? '退款' : '扣费'}成功: ${userId} ${billingAction === 'refund' ? '+' : '-'}${intAmount}胶片`);
        return { success: true, newBalance: data.newBalance, newUsed: data.newUsed };
    } catch (e) {
        if (billingAction === 'consume') {
            throw e;
        }
        console.error(`[modelscope] 退款异常:`, e.message);
        return { success: false, error: e.message };
    }
}

// 📝 文本生成模型（适合写剧本）
const TEXT_MODEL = 'Qwen/Qwen2.5-72B-Instruct';
// 🖼️ 图片生成模型
const IMAGE_MODEL = 'Tongyi-MAI/Z-Image-Turbo';
// 🖼️ 图生图/多图编辑模型（升级到2511版本）
const IMAGE_EDIT_MODEL = 'Qwen/Qwen-Image-Edit-2511';

// ✅ 超时控制函数
function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(new Error('UPSTREAM_TIMEOUT')), timeoutMs);
    const merged = { ...(options || {}), signal: controller.signal };
    return fetch(url, merged).finally(() => clearTimeout(t));
}

// 🔧 将 aspect_ratio 转换为 width/height
function aspectRatioToSize(ratio) {
    const sizeMap = {
        '1:1': { width: 1024, height: 1024 },
        '16:9': { width: 1280, height: 720 },
        '9:16': { width: 720, height: 1280 },
        '4:3': { width: 1024, height: 768 },
        '3:4': { width: 768, height: 1024 },
        '3:2': { width: 1024, height: 683 },
        '2:3': { width: 683, height: 1024 },
        '21:9': { width: 1280, height: 549 },
        '9:21': { width: 549, height: 1280 }
    };
    return sizeMap[ratio] || sizeMap['1:1'];
}

/**
 * 调用 ModelScope 官方 API
 * @param {string} path
 * @param {RequestInit} options
 * @param {number} timeoutMs - 超时时间（毫秒）
 * @returns {Promise<Response>}
 */
async function callModelScope(path, options, timeoutMs = 30000) {
    const response = await fetchWithTimeout(`${BASE_URL}${path}`, options, timeoutMs);
    if (!response.ok) {
        const text = await response.text();
        // 🔧 尝试解析JSON错误信息
        let errorMsg = `ModelScope 请求失败: ${response.status}`;
        try {
            const errJson = JSON.parse(text);
            errorMsg = errJson?.errors?.message || errJson?.message || errJson?.error || text;
            console.error('[modelscope] API错误详情:', JSON.stringify(errJson, null, 2));
        } catch (e) {
            errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
    }
    return response;
}

async function handleImageGeneration(prompt, apiKey, aspectRatio = '1:1') {
    // 🔧 将 aspect_ratio 转换为 width/height
    const imageSize = aspectRatioToSize(aspectRatio);
    const submitRes = await callModelScope('v1/images/generations', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'X-ModelScope-Async-Mode': 'true'
        },
        body: JSON.stringify({
            model: IMAGE_MODEL, // Z-Image-Turbo 文生图
            prompt,
            width: imageSize.width,
            height: imageSize.height
        })
    });

    const { task_id: taskId } = await submitRes.json();
    if (!taskId) throw new Error('未获取到 task_id');

    return await pollImageTask(taskId, apiKey);
}

/**
 * 图生图：使用 Qwen-Image-Edit 模型（支持 base64 和 URL）
 * @param {string} prompt - 编辑指令
 * @param {string[]} imageUrls - 参考图 URL 或 base64 data URL 数组
 * @param {string} apiKey
 */
async function handleImageToImageGeneration(prompt, imageUrls, apiKey) {
    // 使用 Qwen-Image-Edit 模型，支持 base64 和远程 URL
    const requestBody = {
        model: IMAGE_EDIT_MODEL,
        prompt,
        image_url: imageUrls
    };
    
    console.log('[modelscope] 图生图请求:', {
        model: requestBody.model,
        prompt: requestBody.prompt,
        imageCount: imageUrls.length,
        firstImageType: imageUrls[0]?.substring(0, 30) + '...'
    });
    
    const submitRes = await callModelScope('v1/images/generations', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'X-ModelScope-Async-Mode': 'true'
        },
        body: JSON.stringify(requestBody)
    });

    const { task_id: taskId } = await submitRes.json();
    if (!taskId) throw new Error('未获取到 task_id');

    return await pollImageTask(taskId, apiKey);
}

/**
 * 🔧 辅助函数：将图片URL转换为base64（解决CORS/黑图问题）
 */
async function convertImageToBase64(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') return null;
    
    // 已经是 base64 格式，直接返回
    if (imageUrl.startsWith('data:')) {
        return imageUrl;
    }
    
    // 不是 http URL，无法转换
    if (!imageUrl.startsWith('http')) {
        return imageUrl;
    }
    
    try {
        console.log(`[modelscope] 🔄 转换图片为base64: ${imageUrl.substring(0, 60)}...`);
        const response = await fetchWithTimeout(imageUrl, {}, 30000);
        if (!response.ok) {
            console.warn(`[modelscope] 下载图片失败: ${response.status}`);
            return imageUrl;  // 失败时返回原始URL
        }
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/png';
        console.log(`[modelscope] ✅ 转换成功: ${contentType}, ${Math.round(base64.length/1024)}KB`);
        return `data:${contentType};base64,${base64}`;
    } catch (err) {
        console.warn(`[modelscope] 转换base64失败: ${err.message}`);
        return imageUrl;  // 失败时返回原始URL
    }
}

/**
 * 轮询图像任务状态（优化超时）
 */
async function pollImageTask(taskId, apiKey) {
    const maxAttempts = 40;  // 增加到 40 次
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));  // 缩短到 2 秒
        try {
            const pollRes = await callModelScope(`v1/tasks/${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'X-ModelScope-Task-Type': 'image_generation'
                }
            }, 15000);  // 轮询超时 15 秒
            const data = await pollRes.json();
            console.log(`[modelscope] 轮询 ${attempt + 1}/${maxAttempts}: ${data.task_status}`);
            if (data.task_status === 'SUCCEED') {
                const outputImages = data.output_images || [];
                
                // 🔧 修复黑图：将阿里云OSS URL转换为base64，避免CORS问题
                const convertedImages = [];
                for (const imgUrl of outputImages) {
                    // 检查是否是阿里云OSS链接（可能有CORS限制）
                    if (imgUrl && (imgUrl.includes('aliyuncs.com') || imgUrl.includes('oss-cn-') || imgUrl.includes('modelscope'))) {
                        const base64Url = await convertImageToBase64(imgUrl);
                        convertedImages.push(base64Url);
                    } else {
                        convertedImages.push(imgUrl);
                    }
                }
                
                return {
                    images: convertedImages,
                    taskId
                };
            }
            if (data.task_status === 'FAILED') {
                throw new Error(data?.error_msg || 'Image Generation Failed');
            }
        } catch (err) {
            if (err.message === 'UPSTREAM_TIMEOUT') {
                console.warn(`[modelscope] 轮询超时，继续重试...`);
                continue;
            }
            throw err;
        }
    }
    throw new Error('图像生成超时，请稍后重试');
}

async function handleTextGeneration(prompt, apiKey) {
    const response = await callModelScope('v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: TEXT_MODEL, // 使用 Qwen2.5-72B-Instruct，适合写剧本
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 4096
        })
    });
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('文本生成返回格式异常');
    }
    return content.trim();
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
        const { action, prompt, aspectRatio, aspect_ratio, imageUrls, userId } = body || {};
        // 兼容两种命名风格
        const finalAspectRatio = aspectRatio || aspect_ratio || '1:1';

        if (!action || !prompt) {
            json(400, { error: 'MISSING_PARAMS' });
            return;
        }

        // 🔐 安全检查：必须提供 userId 才能使用 API（防止白嫖）
        if (!userId) {
            json(401, { error: 'UNAUTHORIZED', message: '请先登录后再使用此功能' });
            return;
        }

        // 🔐 根据 action 类型选择 API Key
        let apiKey = MODELSCOPE_API_KEY;
        if (!apiKey && (action === 'image' || action === 'image2image')) {
            json(500, { error: 'SERVER_CONFIG_ERROR', message: '服务器未配置 MODELSCOPE_API_KEY 环境变量' });
            return;
        }

        if (action === 'image') {
            // 💰 计费
            const filmCost = FILM_COST['image'] || 3;
            let billingSuccess = false;
            let taskIdObtained = false; // 🚨 跟踪是否已获取 task_id
            if (filmCost > 0 && userId) {
                try {
                    const billingResult = await __billing('consume', userId, filmCost, 'ModelScope图片生成');
                    if (!billingResult.success && !billingResult.skipped) {
                        json(400, { error: 'BILLING_FAILED', message: billingResult.error || '扣费失败' });
                        return;
                    }
                    billingSuccess = !billingResult.skipped;
                } catch (billingErr) {
                    json(400, { error: 'BILLING_FAILED', message: billingErr.message });
                    return;
                }
            }

            try {
                // 🔐 使用内联逻辑跟踪 task_id 获取状态
                const modelToUse = body.model || IMAGE_MODEL; // 如果前端指定了模型，则使用指定的模型
                // 🔧 将 aspect_ratio 转换为 width/height（Z-Image-Turbo 需要）
                const imageSize = aspectRatioToSize(finalAspectRatio);
                console.log(`[modelscope] 📏 图片尺寸: ${finalAspectRatio} -> ${imageSize.width}x${imageSize.height}`);
                const submitRes = await callModelScope('v1/images/generations', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'X-ModelScope-Async-Mode': 'true'
                    },
                    body: JSON.stringify({
                        model: modelToUse,
                        prompt,
                        width: imageSize.width,
                        height: imageSize.height
                    })
                });
                const { task_id: taskId } = await submitRes.json();
                if (!taskId) throw new Error('未获取到 task_id');
                
                // 🚨 重要：获得 task_id 后，上游 API 已消耗，禁止退款
                taskIdObtained = true;
                
                const result = await pollImageTask(taskId, apiKey);
                json(200, { success: true, ...result, billed: billingSuccess ? filmCost : 0 });
                return;
            } catch (err) {
                // 🔐 仅在未获取 task_id 时退款（上游未消耗）
                if (billingSuccess && !taskIdObtained) {
                    await __billing('refund', userId, filmCost, 'ModelScope图片:异常退款');
                } else if (billingSuccess && taskIdObtained) {
                    console.warn('[modelscope] ⚠️ 图片轮询失败，但上游已消耗，不退款:', err?.message);
                }
                throw err;
            }
        }

        // 🆕 图生图：使用 FLUX.2-dev 模型
        if (action === 'image2image') {
            if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
                json(400, { error: 'MISSING_IMAGE_URLS', message: '图生图需要提供参考图' });
                return;
            }

            // 💰 计费
            const filmCost = FILM_COST['image2image'] || 4;
            let billingSuccess = false;
            let taskIdObtained = false; // 🚨 跟踪是否已获取 task_id
            if (filmCost > 0 && userId) {
                try {
                    const billingResult = await __billing('consume', userId, filmCost, 'ModelScope图生图');
                    if (!billingResult.success && !billingResult.skipped) {
                        json(400, { error: 'BILLING_FAILED', message: billingResult.error || '扣费失败' });
                        return;
                    }
                    billingSuccess = !billingResult.skipped;
                } catch (billingErr) {
                    json(400, { error: 'BILLING_FAILED', message: billingErr.message });
                    return;
                }
            }

            try {
                // 🔐 使用内联逻辑跟踪 task_id 获取状态
                // 🎨 图生图/多图编辑：智能切换到 Edit 模型
                console.log(`[modelscope] 🎨 图生图智能切换: ${body.model || '无'} -> ${IMAGE_EDIT_MODEL}`);
                
                // 🔧 调试：输出参考图信息
                console.log(`[modelscope] 🖼️ 参考图数量: ${imageUrls.length}`);
                imageUrls.forEach((img, idx) => {
                    const imgType = img?.startsWith('data:') ? 'base64' : (img?.startsWith('http') ? 'url' : 'unknown');
                    const imgLen = img?.length || 0;
                    console.log(`[modelscope] 🖼️ 图片${idx + 1}: ${imgType}, 长度=${Math.round(imgLen/1024)}KB`);
                });
                
                // 🔧 Qwen-Image-Edit-2511 使用 chat/completions 端点（最新版本）
                // 参考文档: https://help.aliyun.com/zh/model-studio/user-guide/qwen-vl
                
                // 🆕 构建多模态消息内容
                const messageContent = [];
                
                // 添加文本提示
                messageContent.push({ type: 'text', text: prompt });
                
                // 添加图片引用
                for (const imgUrl of imageUrls) {
                    if (imgUrl.startsWith('data:')) {
                        // base64 格式
                        messageContent.push({ type: 'image_url', image_url: { url: imgUrl } });
                    } else if (imgUrl.startsWith('http')) {
                        // URL 格式
                        messageContent.push({ type: 'image_url', image_url: { url: imgUrl } });
                    }
                }
                
                const requestBody = {
                    model: IMAGE_EDIT_MODEL,
                    messages: [{
                        role: 'user',
                        content: messageContent
                    }]
                };
                
                console.log('[modelscope] 📤 请求体:', JSON.stringify({
                    model: requestBody.model,
                    prompt: prompt?.substring(0, 50) + '...',
                    imageCount: imageUrls.length,
                    firstImageType: imageUrls[0]?.substring(0, 20)
                }));
                
                // 🔧 使用 chat/completions 端点（同步模式 - Qwen-VL系列通常不支持异步）
                const submitRes = await callModelScope('v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                        // 不使用异步模式
                    },
                    body: JSON.stringify(requestBody)
                }, 180000);  // 180秒超时（图片编辑可能较慢）
                
                const submitData = await submitRes.json();
                console.log('[modelscope] 📥 响应:', JSON.stringify(submitData).substring(0, 500));
                
                taskIdObtained = true;  // 请求已发送，上游已消耗
                
                // 🔧 解析响应：先检查是否是异步模式返回
                if (submitData.task_id) {
                    const result = await pollImageTask(submitData.task_id, apiKey);
                    json(200, { success: true, ...result, billed: billingSuccess ? filmCost : 0 });
                    return;
                }
                
                // 🔧 同步模式：直接从 choices 中提取图片
                const content = submitData?.choices?.[0]?.message?.content;
                let imageUrls = [];
                
                if (typeof content === 'string') {
                    // 可能是JSON字符串或直接URL
                    if (content.startsWith('http')) {
                        imageUrls = [content];
                    } else if (content.startsWith('[')) {
                        try {
                            const parsed = JSON.parse(content);
                            if (Array.isArray(parsed)) {
                                imageUrls = parsed.map(item => item.url || item).filter(u => u && typeof u === 'string');
                            }
                        } catch (e) {
                            console.warn('[modelscope] 解析JSON失败:', content.substring(0, 100));
                        }
                    }
                } else if (Array.isArray(content)) {
                    // 数组格式
                    for (const item of content) {
                        if (typeof item === 'string' && item.startsWith('http')) {
                            imageUrls.push(item);
                        } else if (item?.type === 'image_url' && item?.image_url?.url) {
                            imageUrls.push(item.image_url.url);
                        } else if (item?.url) {
                            imageUrls.push(item.url);
                        }
                    }
                }
                
                if (imageUrls.length === 0) {
                    console.error('[modelscope] 未从响应中提取到图片:', JSON.stringify(submitData).substring(0, 500));
                    throw new Error('图片编辑未返回有效图片');
                }
                
                json(200, { success: true, images: imageUrls, billed: billingSuccess ? filmCost : 0 });
                return;
            } catch (err) {
                // 🔐 仅在未获取 task_id 时退款（上游未消耗）
                if (billingSuccess && !taskIdObtained) {
                    await __billing('refund', userId, filmCost, 'ModelScope图生图:异常退款');
                } else if (billingSuccess && taskIdObtained) {
                    console.warn('[modelscope] ⚠️ 图生图轮询失败，但上游已消耗，不退款:', err?.message);
                }
                throw err;
            }
        }

        if (action === 'text') {
            // 💰 计费
            const filmCost = FILM_COST['text'] || 1;
            let billingSuccess = false;
            if (filmCost > 0 && userId) {
                try {
                    const billingResult = await __billing('consume', userId, filmCost, 'ModelScope文本生成');
                    if (!billingResult.success && !billingResult.skipped) {
                        json(400, { error: 'BILLING_FAILED', message: billingResult.error || '扣费失败' });
                        return;
                    }
                    billingSuccess = !billingResult.skipped;
                } catch (billingErr) {
                    json(400, { error: 'BILLING_FAILED', message: billingErr.message });
                    return;
                }
            }

            try {
                const content = await handleTextGeneration(prompt, apiKey);
                json(200, { success: true, content, billed: billingSuccess ? filmCost : 0 });
                return;
            } catch (err) {
                if (billingSuccess) await __billing('refund', userId, filmCost, 'ModelScope文本:异常退款');
                throw err;
            }
        }

        json(400, { error: 'INVALID_ACTION' });
    } catch (error) {
        console.error('[modelscope] 调用失败:', error);
        json(500, { error: 'MODELSCOPE_FAILED', message: error.message });
    }
};

