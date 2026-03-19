const BASE_URL = 'https://api-inference.modelscope.cn/';
// 🔐 API Key 必须通过环境变量配置，不在代码中暴露
const MODELSCOPE_API_KEY = process.env.MODELSCOPE_API_KEY || '';
const ZHENZHEN_API_KEY = process.env.ZHENZHEN_API_KEY || '';

// 🚀 OpenRouter API 配置
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_SITE_URL = 'https://lossloop.cn';
const OPENROUTER_SITE_NAME = 'RollRoll AI';

// OpenRouter 免费模型列表
const OPENROUTER_FREE_MODELS = [
    'openrouter/hunter-alpha',
    'openrouter/healer-alpha', 
    'nvidia/nemotron-3-super-120b-a12b:free'
];

// ☁️ 云雾 API 端点（用于 Gemini 等非 ModelScope 模型）
const YUNWU_ENDPOINTS = [
    { url: 'https://api3.wlai.vip', name: '国内服务器', keyIdx: 0 },
    { url: 'https://yunwu.zeabur.app', name: 'ZeaBur-CDN', keyIdx: 1 },
    { url: 'https://yunwu.ai', name: '主站', keyIdx: 2 },
    { url: 'https://api.apiplus.org', name: 'CF站', keyIdx: 0 }
];
const YUNWU_API_KEYS = [
    process.env.YUNMENG_API_KEY || '',
    process.env.YUNMENG_API_KEY_2 || '',
    process.env.YUNMENG_API_KEY_3 || ''
].filter(k => k);

// ========== 计费配置 ==========
const FILM_COST = {
    'image': 3,           // 图片生成
    'image2image': 4,     // 图生图
    'text': 1,             // 文本生成
    'video': 0,            // 视频生成（免费）
    'image2video': 0       // 图生视频（免费）
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
// 🎬 视频生成模型（通义万相）
const VIDEO_MODEL = 'Wan-AI/Wan2.1-T2V-1.3B';

// ========== 🎨 多角度出图视角模板 ==========
const ANGLE_TEMPLATES = {
    // 主体模式 - 旋转角度 (模拟3D旋转效果)
    'front': { 
        name: '正视图', 
        prompt: 'front view, direct front angle, centered composition, professional product photography, clean background, studio lighting, maintain exact same product appearance',
        mode: 'subject',
        rotation: { y: 0 }
    },
    'back': { 
        name: '后视图', 
        prompt: 'back view, rear angle, showing the back side, professional product photography, clean background, studio lighting, maintain exact same product appearance',
        mode: 'subject',
        rotation: { y: 180 }
    },
    'left': { 
        name: '左视图', 
        prompt: 'left side view, 90 degree angle from left, showing left profile, professional product photography, clean background, studio lighting, maintain exact same product appearance',
        mode: 'subject',
        rotation: { y: -90 }
    },
    'right': { 
        name: '右视图', 
        prompt: 'right side view, 90 degree angle from right, showing right profile, professional product photography, clean background, studio lighting, maintain exact same product appearance',
        mode: 'subject',
        rotation: { y: 90 }
    },
    'top': { 
        name: '俯视图', 
        prompt: 'top down view, overhead angle, bird eye view from directly above, professional product photography, clean background, studio lighting, maintain exact same product appearance',
        mode: 'subject',
        rotation: { x: -90 }
    },
    'bottom': { 
        name: '仰视图', 
        prompt: 'bottom view, worm eye view, looking up angle from below, professional product photography, clean background, studio lighting, maintain exact same product appearance',
        mode: 'subject',
        rotation: { x: 90 }
    },
    'iso-left': { 
        name: '左等轴测', 
        prompt: 'isometric view from left, 45 degree angle, three-quarter view showing front and left side, professional product photography, clean background, studio lighting, maintain exact same product appearance',
        mode: 'subject',
        rotation: { y: -45 }
    },
    'iso-right': { 
        name: '右等轴测', 
        prompt: 'isometric view from right, 45 degree angle, three-quarter view showing front and right side, professional product photography, clean background, studio lighting, maintain exact same product appearance',
        mode: 'subject',
        rotation: { y: 45 }
    },
    // 摄像头模式 - 镜头效果 (虚拟摄像机控制)
    'close-up': { 
        name: '特写镜头', 
        prompt: 'extreme close-up shot, macro photography, detail focus, shallow depth of field, professional product photography, tight framing on subject',
        mode: 'camera',
        lens: 'macro'
    },
    'wide': { 
        name: '广角镜头', 
        prompt: 'wide angle shot, expanded view, more context and environment, professional product photography, dramatic perspective, 24mm lens effect',
        mode: 'camera',
        lens: 'wide'
    },
    'macro': { 
        name: '微距镜头', 
        prompt: 'macro lens photography, extreme detail, texture focus, professional product photography, sharp details, 100mm macro lens effect',
        mode: 'camera',
        lens: 'macro'
    },
    'fisheye': { 
        name: '鱼眼镜头', 
        prompt: 'fisheye lens effect, distorted wide angle, spherical perspective, creative product photography, 8mm fisheye effect',
        mode: 'camera',
        lens: 'fisheye'
    },
    'telephoto': {
        name: '长焦镜头',
        prompt: 'telephoto lens compression, 85mm portrait lens, blurred background, professional product photography, subject isolation',
        mode: 'camera',
        lens: 'telephoto'
    },
    'tilt-shift': {
        name: '移轴镜头',
        prompt: 'tilt-shift lens effect, miniature look, selective focus, toy-like appearance, creative product photography',
        mode: 'camera',
        lens: 'tilt-shift'
    }
};

// 广角扩展提示词
const WIDE_ANGLE_PROMPT = 'Expand the image to wide angle view, show more of the surrounding environment, maintain the subject in center, professional photography style, seamless extension, outpainting technique';

// 智能分层编辑提示词
const LAYER_EDIT_PROMPTS = {
    'extract': 'Extract the main subject from background, clean cutout, transparent background ready, professional product photography isolation',
    'background': 'Replace background with {style}, maintain subject lighting consistency, professional product photography',
    'shadow': 'Add realistic drop shadow, professional lighting, ground contact shadow, product photography style',
    'reflection': 'Add realistic reflection below subject, mirror effect, professional product photography',
    'lighting': 'Adjust lighting to {style}, professional studio lighting, maintain subject details'
};

// 矢量转换提示词
const VECTOR_PROMPT = 'Convert to clean vector illustration, flat design, crisp edges, scalable graphics, SVG style, minimal colors, professional vector art';

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

// 🚀 调用 OpenRouter API（免费文本模型）
async function callOpenRouter(messages, model, timeoutMs = 60000) {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OpenRouter API Key 未配置');
    }
    
    const isFree = OPENROUTER_FREE_MODELS.includes(model);
    console.log(`[openrouter] 调用模型: ${model}, 免费: ${isFree}`);
    
    const response = await fetchWithTimeout(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': OPENROUTER_SITE_URL,
            'X-Title': OPENROUTER_SITE_NAME
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: 4096,
            temperature: 0.7
        })
    }, timeoutMs);
    
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenRouter 错误: ${response.status} - ${text}`);
    }
    
    return response;
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

/**
 * 调用云雾 API（用于 Gemini 等非 ModelScope 模型）
 * @param {string} path
 * @param {RequestInit} options
 * @param {number} timeoutMs - 超时时间（毫秒）
 * @returns {Promise<Response>}
 */
async function callYunwuAPI(path, options, timeoutMs = 30000) {
    // 轮询端点
    for (let i = 0; i < YUNWU_ENDPOINTS.length; i++) {
        const endpoint = YUNWU_ENDPOINTS[i];
        const apiKey = YUNWU_API_KEYS[endpoint.keyIdx] || YUNWU_API_KEYS[0];
        
        if (!apiKey) continue;
        
        try {
            const url = `${endpoint.url}${path.startsWith('/') ? '' : '/'}${path}`;
            console.log(`[modelscope] 尝试云雾端点: ${endpoint.name}`);
            
            const response = await fetchWithTimeout(url, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${apiKey}`
                }
            }, timeoutMs);
            
            if (response.ok) {
                console.log(`[modelscope] 云雾端点成功: ${endpoint.name}`);
                return response;
            }
            
            // 记录错误继续下一个端点
            const errText = await response.text();
            console.warn(`[modelscope] 云雾端点 ${endpoint.name} 失败: ${response.status}`, errText.slice(0, 200));
        } catch (err) {
            console.warn(`[modelscope] 云雾端点 ${endpoint.name} 异常:`, err.message);
        }
    }
    
    throw new Error('所有云雾端点均不可用');
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

/**
 * 轮询视频任务状态
 */
async function pollVideoTask(taskId, apiKey) {
    const maxAttempts = 120; // 6分钟超时（视频生成可能较慢）
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3秒轮询间隔
        try {
            const pollRes = await callModelScope(`v1/tasks/${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'X-ModelScope-Task-Type': 'video_generation'
                }
            }, 30000);
            const data = await pollRes.json();
            console.log(`[modelscope] 🎬 视频轮询 ${attempt + 1}/${maxAttempts}: ${data.task_status}`);
            if (data.task_status === 'SUCCEED') {
                const outputVideos = data.output_videos || [];
                return {
                    videos: outputVideos,
                    taskId
                };
            }
            if (data.task_status === 'FAILED') {
                throw new Error(data?.error_msg || 'Video Generation Failed');
            }
        } catch (err) {
            if (err.message === 'UPSTREAM_TIMEOUT') {
                console.warn(`[modelscope] 视频轮询超时，继续重试...`);
                continue;
            }
            throw err;
        }
    }
    throw new Error('视频生成超时，请稍后重试');
}

async function handleVideoGeneration(prompt, apiKey, aspectRatio = '16:9', duration = 5) {
    const videoSize = aspectRatioToSize(aspectRatio);
    const submitRes = await callModelScope('v1/videos/generations', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'X-ModelScope-Async-Mode': 'true'
        },
        body: JSON.stringify({
            model: VIDEO_MODEL,
            prompt,
            width: videoSize.width,
            height: videoSize.height,
            duration: duration
        })
    });

    const { task_id: taskId } = await submitRes.json();
    if (!taskId) throw new Error('未获取到视频生成task_id');

    return await pollVideoTask(taskId, apiKey);
}

async function handleImageToVideoGeneration(prompt, imageUrls, apiKey, aspectRatio = '16:9', duration = 5) {
    const videoSize = aspectRatioToSize(aspectRatio);
    const submitRes = await callModelScope('v1/videos/generations', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'X-ModelScope-Async-Mode': 'true'
        },
        body: JSON.stringify({
            model: VIDEO_MODEL,
            prompt,
            image_url: imageUrls,
            width: videoSize.width,
            height: videoSize.height,
            duration: duration
        })
    });

    const { task_id: taskId } = await submitRes.json();
    if (!taskId) throw new Error('未获取到图生视频task_id');

    return await pollVideoTask(taskId, apiKey);
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
        const { action, prompt, aspectRatio, aspect_ratio, imageUrls, image_url, userId, skip_billing } = body || {};
        const skipBilling = skip_billing === true;
        // 兼容两种命名风格
        const finalAspectRatio = aspectRatio || aspect_ratio || '1:1';
        const finalImageUrls = imageUrls || (image_url ? [image_url] : []);

        // 多角度出图使用 originalPrompt，不强制要求 prompt
        if (!action) {
            json(400, { error: 'MISSING_PARAMS', message: '缺少 action 参数' });
            return;
        }
        
        // 非多角度出图模式需要 prompt
        if (action !== 'multi-angle' && !prompt) {
            json(400, { error: 'MISSING_PARAMS', message: '缺少 prompt 参数' });
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
            if (!skipBilling && filmCost > 0 && userId) {
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
            if (!finalImageUrls || !Array.isArray(finalImageUrls) || finalImageUrls.length === 0) {
                json(400, { error: 'MISSING_IMAGE_URLS', message: '图生图需要提供参考图' });
                return;
            }

            // 💰 计费
            const filmCost = FILM_COST['image2image'] || 4;
            let billingSuccess = false;
            let taskIdObtained = false; // 🚨 跟踪是否已获取 task_id
            if (!skipBilling && filmCost > 0 && userId) {
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
                console.log(`[modelscope] 🖼️ 参考图数量: ${finalImageUrls.length}`);
                finalImageUrls.forEach((img, idx) => {
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
                for (const imgUrl of finalImageUrls) {
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
                let resultImageUrls = [];
                
                if (typeof content === 'string') {
                    // 可能是JSON字符串或直接URL
                    if (content.startsWith('http')) {
                        resultImageUrls = [content];
                    } else if (content.startsWith('[')) {
                        try {
                            const parsed = JSON.parse(content);
                            if (Array.isArray(parsed)) {
                                resultImageUrls = parsed.map(item => item.url || item).filter(u => u && typeof u === 'string');
                            }
                        } catch (e) {
                            console.warn('[modelscope] 解析JSON失败:', content.substring(0, 100));
                        }
                    }
                } else if (Array.isArray(content)) {
                    // 数组格式
                    for (const item of content) {
                        if (typeof item === 'string' && item.startsWith('http')) {
                            resultImageUrls.push(item);
                        } else if (item?.type === 'image_url' && item?.image_url?.url) {
                            resultImageUrls.push(item.image_url.url);
                        } else if (item?.url) {
                            resultImageUrls.push(item.url);
                        }
                    }
                }
                
                if (resultImageUrls.length === 0) {
                    console.error('[modelscope] 未从响应中提取到图片:', JSON.stringify(submitData).substring(0, 500));
                    throw new Error('图片编辑未返回有效图片');
                }
                
                json(200, { success: true, images: resultImageUrls, billed: billingSuccess ? filmCost : 0 });
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
            if (!skipBilling && filmCost > 0 && userId) {
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

        // 🚀 OpenRouter 文本生成（免费/付费模型）
        if (action === 'openrouter' || action === 'openrouter-chat') {
            const { messages, model } = body;
            const modelName = model || 'openrouter/hunter-alpha';
            
            // 检查是否是免费模型
            const isFreeModel = OPENROUTER_FREE_MODELS.includes(modelName);
            const isPaidModel = OPENROUTER_PAID_MODELS.includes(modelName);
            
            // 免费模型不扣费，付费模型扣费
            const filmCost = isFreeModel ? 0 : (isPaidModel ? 2 : 1);
            let billingSuccess = false;
            
            // 付费模型需要扣费
            if (!skipBilling && filmCost > 0 && userId) {
                try {
                    const billingResult = await __billing('consume', userId, filmCost, `OpenRouter: ${modelName}`);
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
                const chatMessages = messages || [{ role: 'user', content: prompt }];
                const response = await callOpenRouter(chatMessages, modelName);
                const data = await response.json();
                
                const content = data?.choices?.[0]?.message?.content || '';
                const usage = data?.usage || {};
                
                json(200, { 
                    success: true, 
                    content, 
                    model: modelName,
                    usage: { prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens, total_tokens: usage.total_tokens },
                    isFree: isFreeModel,
                    billed: billingSuccess ? filmCost : 0 
                });
                return;
            } catch (err) {
                if (billingSuccess) await __billing('refund', userId, filmCost, 'OpenRouter异常退款');
                json(500, { error: 'OPENROUTER_ERROR', message: err.message });
                return;
            }
        }

        if (action === 'video') {
            // 💰 计费（免费）
            const filmCost = FILM_COST['video'] || 0;
            let billingSuccess = false;
            let taskIdObtained = false;
            if (!skipBilling && filmCost > 0 && userId) {
                try {
                    const billingResult = await __billing('consume', userId, filmCost, 'ModelScope视频生成');
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
                const modelToUse = body.model || VIDEO_MODEL;
                const finalAspectRatio = aspectRatio || aspect_ratio || '16:9';
                const duration = body.duration || 5;
                const videoSize = aspectRatioToSize(finalAspectRatio);
                console.log(`[modelscope] 🎬 视频尺寸: ${finalAspectRatio} -> ${videoSize.width}x${videoSize.height}, 时长: ${duration}秒`);
                
                const submitRes = await callModelScope('v1/videos/generations', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'X-ModelScope-Async-Mode': 'true'
                    },
                    body: JSON.stringify({
                        model: modelToUse,
                        prompt,
                        width: videoSize.width,
                        height: videoSize.height,
                        duration: duration
                    })
                });
                const { task_id: taskId } = await submitRes.json();
                if (!taskId) throw new Error('未获取到视频生成task_id');
                
                taskIdObtained = true;
                
                const result = await pollVideoTask(taskId, apiKey);
                json(200, { success: true, ...result, billed: billingSuccess ? filmCost : 0 });
                return;
            } catch (err) {
                if (billingSuccess && !taskIdObtained) {
                    await __billing('refund', userId, filmCost, 'ModelScope视频:异常退款');
                } else if (billingSuccess && taskIdObtained) {
                    console.warn('[modelscope] ⚠️ 视频轮询失败，但上游已消耗，不退款:', err?.message);
                }
                throw err;
            }
        }

        if (action === 'image2video') {
            if (!finalImageUrls || !Array.isArray(finalImageUrls) || finalImageUrls.length === 0) {
                json(400, { error: 'MISSING_IMAGE_URLS', message: '图生视频需要提供参考图' });
                return;
            }

            // 💰 计费（免费）
            const filmCost = FILM_COST['image2video'] || 0;
            let billingSuccess = false;
            let taskIdObtained = false;
            if (!skipBilling && filmCost > 0 && userId) {
                try {
                    const billingResult = await __billing('consume', userId, filmCost, 'ModelScope图生视频');
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
                const modelToUse = body.model || VIDEO_MODEL;
                const finalAspectRatio = aspectRatio || aspect_ratio || '16:9';
                const duration = body.duration || 5;
                const videoSize = aspectRatioToSize(finalAspectRatio);
                console.log(`[modelscope] 🎬 图生视频尺寸: ${finalAspectRatio} -> ${videoSize.width}x${videoSize.height}, 时长: ${duration}秒`);
                
                const submitRes = await callModelScope('v1/videos/generations', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'X-ModelScope-Async-Mode': 'true'
                    },
                    body: JSON.stringify({
                        model: modelToUse,
                        prompt,
                        image_url: finalImageUrls,
                        width: videoSize.width,
                        height: videoSize.height,
                        duration: duration
                    })
                });
                const { task_id: taskId } = await submitRes.json();
                if (!taskId) throw new Error('未获取到图生视频task_id');
                
                taskIdObtained = true;
                
                const result = await pollVideoTask(taskId, apiKey);
                json(200, { success: true, ...result, billed: billingSuccess ? filmCost : 0 });
                return;
            } catch (err) {
                if (billingSuccess && !taskIdObtained) {
                    await __billing('refund', userId, filmCost, 'ModelScope图生视频:异常退款');
                } else if (billingSuccess && taskIdObtained) {
                    console.warn('[modelscope] ⚠️ 图生视频轮询失败，但上游已消耗，不退款:', err?.message);
                }
                throw err;
            }
        }

        // 🎨 多角度出图功能（完整版 - 包含主体模式、摄像头模式、广角扩展、分层编辑、矢量转换）
        if (action === 'multi-angle') {
            const { 
                angles, 
                mode, 
                originalPrompt, 
                referenceImage,
                layerEdit,
                vectorMode,
                batchGenerate,
                selectedModel
            } = body;
            
            if (!angles || !Array.isArray(angles) || angles.length === 0) {
                json(400, { error: 'MISSING_ANGLES', message: '请选择至少一个视角' });
                return;
            }
            
            if (!referenceImage && !originalPrompt) {
                json(400, { error: 'MISSING_REFERENCE', message: '需要提供参考图或原始提示词' });
                return;
            }

            // 💰 计费计算
            const costPerImage = FILM_COST['image2image'] || 4;
            let totalCost = costPerImage * angles.length;
            
            // 分层编辑额外计费
            if (layerEdit && layerEdit.enabled) {
                totalCost += 2; // 分层编辑额外2胶片
            }
            
            // 矢量转换额外计费
            if (vectorMode) {
                totalCost += 3; // 矢量转换额外3胶片
            }
            
            let billingSuccess = false;
            
            if (!skipBilling && totalCost > 0 && userId) {
                try {
                    const billingResult = await __billing('consume', userId, totalCost, `多角度出图(${angles.length}张${layerEdit?.enabled ? '+分层' : ''}${vectorMode ? '+矢量' : ''})`);
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
                console.log(`[modelscope] 🎨 多角度出图: 模式=${mode}, 视角数=${angles.length}, 分层=${layerEdit?.enabled}, 矢量=${vectorMode}`);
                
                const results = [];
                const failedAngles = [];
                
                console.log(`[modelscope] 🎨 开始生成 ${angles.length} 个视角...`);
                

                
                // 逐个生成每个角度的图片
                for (const angleKey of angles) {
                    const template = ANGLE_TEMPLATES[angleKey];
                    console.log(`[modelscope] 🎨 处理视角: ${angleKey}, template=${template ? 'found' : 'not found'}`);
                    
                    if (!template) {
                        failedAngles.push({ angle: angleKey, error: '未知视角' });
                        continue;
                    }
                    
                    try {
                        // 构建基础提示词
                        let basePrompt;
                        
                        // 根据模式选择提示词
                        switch (mode) {
                            case 'wide-extend':
                                basePrompt = WIDE_ANGLE_PROMPT;
                                break;
                            case 'subject':
                                // 主体模式 - 强调3D旋转和一致性
                                basePrompt = `${template.prompt}, rotate the subject to show ${angleKey} view, maintain exact same product, consistent lighting and style, 3D rotation effect`;
                                break;
                            case 'camera':
                                // 摄像头模式 - 强调镜头效果
                                basePrompt = `${template.prompt}, camera angle change, ${template.lens || 'standard'} lens perspective, professional cinematography`;
                                break;
                            default:
                                basePrompt = template.prompt;
                        }
                        
                        // 添加原始提示词
                        let promptText = `${basePrompt}, ${originalPrompt || 'maintain consistent style and lighting'}`;
                        
                        // 添加分层编辑提示词
                        if (layerEdit && layerEdit.enabled) {
                            const layerType = layerEdit.type || 'extract';
                            const layerStyle = layerEdit.style || '';
                            let layerPrompt = LAYER_EDIT_PROMPTS[layerType] || LAYER_EDIT_PROMPTS['extract'];
                            if (layerStyle) {
                                layerPrompt = layerPrompt.replace('{style}', layerStyle);
                            }
                            promptText = `${promptText}, ${layerPrompt}`;
                        }
                        
                        // 添加矢量转换提示词
                        if (vectorMode) {
                            promptText = `${promptText}, ${VECTOR_PROMPT}`;
                        }
                        
                        // 🎨 直接调用 /api/banana2（用户选什么模型就用什么，不做映射转换）
                        const modelToUse = selectedModel || 'nano-banana-2';
                        console.log(`[modelscope] 🎨 生成视角: ${template.name}, 使用模型: ${modelToUse}`);
                        
                        const banana2Body = {
                            prompt: promptText,
                            model: modelToUse,
                            aspect_ratio: '1:1',
                            userId,
                            skip_billing: true  // modelscope.js 已在进入循环前完成计费
                        };
                        if (referenceImage) {
                            banana2Body.image_url = referenceImage;
                        }
                        
                        const submitRes = await fetch('/api/banana2', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(banana2Body)
                        });
                        
                        if (!submitRes.ok) {
                            const errData = await submitRes.json().catch(() => ({ message: await submitRes.text() }));
                            throw new Error(`banana2错误(${submitRes.status}): ${errData.message || JSON.stringify(errData).slice(0, 200)}`);
                        }
                        
                        const submitData = await submitRes.json();
                        
                        // 解析 banana2 响应
                        let resultImageUrls = [];
                        
                        // 优先提取 output.url（Supabase Storage URL）
                        if (submitData.output?.url) {
                            resultImageUrls = [submitData.output.url];
                        } else if (submitData.output?.images?.length > 0) {
                            resultImageUrls = submitData.output.images;
                        } else if (submitData.data?.length > 0) {
                            // 标准 images/generations 格式
                            resultImageUrls = submitData.data.map(item => item.url || item).filter(u => u && typeof u === 'string');
                        } else if (submitData.images?.length > 0) {
                            resultImageUrls = submitData.images;
                        }
                        
                        console.log(`[modelscope] 🎨 视角 ${template.name} 生成完成，图片数: ${resultImageUrls.length}`);
                        
                        if (resultImageUrls.length === 0) {
                            failedAngles.push({
                                angle: angleKey,
                                name: template.name,
                                error: submitData.message || '未能获取图片URL'
                            });
                            console.log(`[modelscope] 🎨 视角 ${template.name} 未能获取图片URL`);
                        } else {
                            results.push({
                                angle: angleKey,
                                name: template.name,
                                mode: template.mode || 'normal',
                                images: resultImageUrls,
                                success: true,
                                rotation: template.rotation || null,
                                lens: template.lens || null
                            });
                        }
                        
                    } catch (angleError) {
                        console.error(`[modelscope] 🎨 视角 ${template.name} 生成失败:`, angleError.message);
                        failedAngles.push({ 
                            angle: angleKey, 
                            name: template.name, 
                            error: angleError.message
                        });
                    }
                }
                
                console.log(`[modelscope] 🎨 最终结果: results=${results.length}, failed=${failedAngles.length}`);
                console.log(`[modelscope] 🎨 results内容:`, JSON.stringify(results));
                
                // 如果有失败的，部分退款
                if (failedAngles.length > 0 && billingSuccess) {
                    const refundAmount = costPerImage * failedAngles.length;
                    await __billing('refund', userId, refundAmount, `多角度出图失败退款(${failedAngles.length}张)`);
                }
                
                json(200, { 
                    success: results.length > 0, 
                    results,
                    failed: failedAngles,
                    totalGenerated: results.length,
                    totalFailed: failedAngles.length,
                    mode: mode || 'normal',
                    layerEdit: layerEdit || null,
                    vectorMode: vectorMode || false,
                    billed: billingSuccess ? (costPerImage * results.length + (layerEdit?.enabled ? 2 : 0) + (vectorMode ? 3 : 0)) : 0
                });
                return;
                
            } catch (err) {
                // 全部失败时退款
                if (billingSuccess) {
                    await __billing('refund', userId, totalCost, '多角度出图全部失败退款');
                }
                throw err;
            }
        }

        json(400, { error: 'INVALID_ACTION' });
    } catch (error) {
        console.error('[modelscope] 调用失败:', error);
        console.error('[modelscope] 错误堆栈:', error.stack);
        // 确保返回有效的JSON
        json(500, {
            error: 'MODELSCOPE_FAILED',
            message: error.message || '服务器内部错误',
            debug: error.stack ? error.stack.substring(0, 500) : undefined
        });
    }
};

