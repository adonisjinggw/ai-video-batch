/**
 * 视频连续性生成 API
 * 功能：自动串联多个分镜，使用前一个视频的最后一帧作为下一个视频的起始帧
 * 支持：Sora2 和 Veo3 模型
 * 💰 计费通过 /api/supabase-proxy 统一处理
 * 
 * ⚠️ 重要限制：
 * - 必须串行执行，无法并发
 * - 原因：第N+1个分镜依赖第N个分镜的输出（最后一帧）
 * - 总耗时 = 单个视频生成时间 × 分镜数量
 * 
 * 💰 计费标准：
 * - 第1个分镜：文生视频，3胶片/15秒 (¥0.9)
 * - 第2+个分镜：图生视频，3胶片/15秒 (¥0.9)
 * - 实际计费 = (时长/15) × 3 × 分镜数量
 * - 例如：3个5秒分镜 = 3 × (5/15) × 3 = 3胶片 = ¥0.9
 * 
 * 💡 优化策略：
 * - 使用流式处理：一个分镜完成立即开始下一个
 * - 提供实时进度反馈（通过轮询）
 * - 渐进式轮询：前30秒每5秒查询，之后每10秒查询，减少服务器压力
 * - 前端轮询间隔：10秒（考虑到单个分镜至少需要60秒生成）
 * - 支持断点续传：失败后可从中断处继续（未来支持）
 */

// ========== 计费配置 ==========
const FILM_COST_PER_SEGMENT = 15;  // 每个分镜15胶片

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
            console.error(`[video-continuity] 退款失败:`, data);
            return { success: false, error: data.message || data.error };
        }
        
        console.log(`[video-continuity] 💰 ${billingAction === 'refund' ? '退款' : '扣费'}成功: ${userId} ${billingAction === 'refund' ? '+' : '-'}${intAmount}胶片`);
        return { success: true, newBalance: data.newBalance, newUsed: data.newUsed };
    } catch (e) {
        if (billingAction === 'consume') {
            throw e;
        }
        console.error(`[video-continuity] 退款异常:`, e.message);
        return { success: false, error: e.message };
    }
}

const YUNMENG_API_KEYS = (() => {
    const keys = [];
    const key1 = process.env.YUNMENG_API_KEY || process.env.YUNWU_API_KEY || '';
    if (key1) keys.push(key1);
    const key2 = process.env.YUNMENG_API_KEY_2 || '';
    if (key2) keys.push(key2);
    const key3 = process.env.YUNMENG_API_KEY_3 || '';
    if (key3) keys.push(key3);
    return keys;
})();

const YUNMENG_ENDPOINTS = [
    'https://api3.wlai.vip',
    'https://yunwu.zeabur.app',
    'https://yunwu.ai',
    'https://api.apiplus.org'
];

/**
 * 从视频URL提取最后一帧
 * @param {string} videoUrl - 视频URL（可以是task_id格式：video_xxx）
 * @returns {Promise<string>} 最后一帧的图片URL
 */
async function extractLastFrame(videoUrl) {
    // 如果是task_id，需要先获取视频URL
    if (videoUrl.startsWith('video_')) {
        // 轮询获取视频URL
        const videoInfo = await pollVideoStatus(videoUrl);
        if (!videoInfo.url) {
            throw new Error('无法获取视频URL');
        }
        videoUrl = videoInfo.url;
    }
    
    // 这里返回视频URL本身，让云梦API自动提取最后一帧
    // 云梦API支持直接传视频URL作为input_reference
    return videoUrl;
}

/**
 * 轮询视频生成状态
 * 优化：每个分镜至少需要60秒，使用渐进式轮询间隔减少服务器压力
 * 🔧 修复：使用正确的云梦API端点 /v1/videos/{taskId}
 * 🔧 修复：正确解析视频URL字段（url / output_video_url / video_url）
 */
async function pollVideoStatus(taskId, maxAttempts = 120) {
    for (let i = 0; i < maxAttempts; i++) {
        for (const endpoint of YUNMENG_ENDPOINTS) {
            for (const apiKey of YUNMENG_API_KEYS) {
                try {
                    // ✅ 云梦API的任务查询端点是 /v1/videos/{taskId}（与 sora2.js 保持一致）
                    const url = `${endpoint}/v1/videos/${taskId}`;
                    const response = await fetch(url, {
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        const status = String(data.status || '').toUpperCase();
                        
                        if (status === 'COMPLETED' || status === 'SUCCESS' || status === 'SUCCEEDED') {
                            // 🔧 修复：正确提取视频URL（云梦API可能返回不同字段名）
                            const videoUrl = data.url || data.output_video_url || data.video_url || data.output?.url || '';
                            if (!videoUrl) {
                                console.warn(`[video-continuity] ⚠️ 任务完成但未找到视频URL:`, JSON.stringify(data).substring(0, 500));
                            }
                            data.url = videoUrl; // 统一为 url 字段
                            console.log(`[video-continuity] ✅ 分镜生成完成: ${taskId}, URL: ${videoUrl.substring(0, 80)}...`);
                            return data;
                        }
                        if (status === 'FAILED' || status === 'ERROR') {
                            throw new Error(`视频生成失败: ${data.error || data.message || data.failure_reason || '未知错误'}`);
                        }
                        // 其他状态（QUEUED, PROCESSING等）继续轮询
                        console.log(`[video-continuity] ⏳ 分镜生成中 (${i + 1}/${maxAttempts}): ${status}`);
                        break;
                    }
                } catch (err) {
                    console.warn(`[video-continuity] 轮询错误:`, err.message);
                }
            }
        }
        
        // 🔧 渐进式轮询间隔：前30秒每5秒查一次，之后每10秒查一次
        // 这样既能及时发现快速完成的任务，也不会过度消耗资源
        const waitTime = i < 6 ? 5000 : 10000; // 前6次(30秒)用5秒，之后用10秒
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    throw new Error('视频生成超时（超过20分钟）');
}

/**
 * 生成单个视频片段（文生视频或图生视频）
 * 🔧 修复：使用与 sora2.js 相同的云梦API端点
 * - 统一端点：/v1/video/create
 */
async function generateVideoSegment({ prompt, model, duration, aspect_ratio, hd, input_reference, character_url, character_timestamps, _character }) {
    let lastError = null;
    
    // 判断是图生视频还是文生视频
    const isImageToVideo = !!input_reference;
    // 🔧 修复：使用与 sora2.js 相同的端点
    const apiPath = '/v1/video/create';
    
    for (const endpoint of YUNMENG_ENDPOINTS) {
        for (const apiKey of YUNMENG_API_KEYS) {
            try {
                // 🔧 云梦API使用的字段命名（与 sora2.js 保持一致）
                const body = {
                    model: model || 'sora-2-vip-all',
                    prompt
                };
                
                // 🔧 模型名称标准化（与 sora2.js 保持一致）
                const m = String(body.model || '').trim();
                if (m === 'sora-2' || m === 'sora-2-hd' || m === 'sora-2-landscape' || m === 'sora-2-landscape-hd' || m === 'sora-2-portrait' || m === 'sora-2-portrait-hd' || m === 'sora-2-all' || m === 'sora-2-pro-all') {
                    body.model = 'sora-2-vip-all';
                } else if (m === 'sora-2-pro') {
                    body.model = 'sora-2-vip-all';
                }

                // ✅ HD 标志：仅对 sora 系列有意义（veo 不需要）
                const ml = m.toLowerCase();
                const isVeo = ml.startsWith('veo');
                const wantHd = (m === 'sora-2-pro' || m === 'sora-2-pro-all') ? ((typeof hd === 'undefined') ? true : !!hd) : !!hd;
                if (!isVeo && wantHd) {
                    body.hd = true;
                }
                
                // 云梦API使用 duration（int）而不是 seconds（string）
                if (duration) {
                    const d = Number(duration);
                    if (Number.isFinite(d) && d > 0) body.duration = Math.round(d);
                }
                
                // 云梦API使用 aspect_ratio
                if (aspect_ratio) {
                    body.aspect_ratio = aspect_ratio;
                    // 🔧 添加 orientation 参数（与 sora2.js 保持一致）
                    body.orientation = (aspect_ratio === '9:16' || aspect_ratio === 'portrait') ? 'portrait' : 'landscape';
                }
                
                // 🔧 添加 size 参数（云梦某些节点要求）
                const isPortrait = (aspect_ratio === '9:16' || aspect_ratio === 'portrait');
                if (isPortrait) {
                    body.size = wantHd ? '1080x1920' : '720x1280';
                } else {
                    body.size = wantHd ? '1920x1080' : '1280x720';
                }
                
                // 🔧 图生视频：使用前一个视频的最后一帧作为参考图
                if (input_reference) {
                    body.images = [input_reference]; // 云梦API使用 images 数组
                    console.log(`[video-continuity] 🖼️ 使用前一个分镜的最后一帧: ${input_reference.substring(0, 80)}...`);
                }
                
                // 🎨 角色锁定
                if (character_url && character_timestamps) {
                    body.character_url = character_url;
                    body.character_timestamps = character_timestamps;
                }
                
                // 🧬 支持 _character 参数（Sora2 角色锁定）
                if (_character) {
                    const usernames = _character.split(',').map(u => u.trim()).filter(Boolean);
                    if (usernames.length > 0) {
                        const prefix = usernames.map(u => `@${u}`).join(' ');
                        body.prompt = `${prefix} ${body.prompt || ''}`.trim();
                        console.log(`[video-continuity] 🧬 使用角色锁定: ${usernames.join(', ')}`);
                    }
                }
                
                // ✅ 使用统一端点 /v1/video/create
                console.log(`[video-continuity] 🎬 生成视频: ${endpoint}${apiPath}`, { model: body.model, duration: body.duration, hasImage: isImageToVideo, size: body.size });
                const response = await fetch(`${endpoint}${apiPath}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    // 云梦可能返回 id, task_id, job_id
                    const taskId = data.id || data.task_id || data.job_id || data.data?.id;
                    console.log(`[video-continuity] ✅ 视频任务创建成功: ${taskId}`);
                    // 统一返回格式，确保有 id 字段
                    if (!data.id) data.id = taskId;
                    return data;
                }
                
                const errText = await response.text();
                console.warn(`[video-continuity] ⚠️ ${endpoint} 返回 ${response.status}: ${errText.substring(0, 200)}`);
                lastError = { status: response.status, message: errText };
                
                if (response.status === 429) continue; // 限速，尝试下一个key
                if (response.status < 500) continue; // 客户端错误，尝试下一个key
                
            } catch (err) {
                console.warn(`[video-continuity] ❌ ${endpoint} 错误:`, err.message);
                lastError = { status: 502, message: err.message };
            }
        }
    }
    
    throw new Error(lastError?.message || '所有节点均不可用');
}

// 🗂️ 任务存储（简单内存存储，生产环境建议用Redis）
const taskStore = new Map();

/**
 * 主函数：连续性视频生成
 * @param {string} taskId - 任务ID，用于查询进度
 * @param {string} _character - Sora2 角色锁定（逗号分隔的 username 列表）
 */
async function generateContinuousVideo({ taskId, segments, model, duration, aspect_ratio, hd, character_url, character_timestamps, _character, onProgress }) {
    if (!segments || segments.length === 0) {
        throw new Error('至少需要一个分镜提示词');
    }
    
    const results = [];
    let previousVideoUrl = null;
    
    // 更新任务状态
    const updateTask = (updates) => {
        if (taskId && taskStore.has(taskId)) {
            const task = taskStore.get(taskId);
            Object.assign(task, updates, { updatedAt: Date.now() });
            taskStore.set(taskId, task);
        }
        if (onProgress) onProgress(updates);
    };
    
    console.log(`[video-continuity] 🎬 开始生成 ${segments.length} 个连续分镜${_character ? `，使用角色: ${_character}` : ''}`);
    updateTask({ status: 'processing', currentSegment: 0, totalSegments: segments.length });
    
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const prompt = typeof segment === 'string' ? segment : segment.prompt;
        const segmentDuration = segment.duration || duration;
        const segmentAspectRatio = segment.aspect_ratio || aspect_ratio;
        const segmentHd = (typeof segment?.hd === 'undefined') ? hd : segment.hd;
        
        console.log(`\n[video-continuity] 📍 分镜 ${i + 1}/${segments.length}: ${prompt.substring(0, 50)}...`);
        updateTask({ status: 'processing', currentSegment: i, currentPrompt: prompt });
        
        try {
            // 第一个分镜：文生视频
            // 后续分镜：使用前一个视频的最后一帧作为起始帧
            const taskData = await generateVideoSegment({
                prompt,
                model,
                duration: segmentDuration,
                aspect_ratio: segmentAspectRatio,
                hd: segmentHd,
                input_reference: previousVideoUrl, // 使用前一个视频URL作为参考
                character_url: i === 0 ? character_url : undefined, // 仅第一个分镜使用角色
                character_timestamps: i === 0 ? character_timestamps : undefined,
                _character  // 🧬 所有分镜都使用角色锁定
            });
            
            // 等待视频生成完成
            console.log(`[video-continuity] ⏳ 等待分镜 ${i + 1} 生成完成...`);
            updateTask({ status: 'processing', currentSegment: i, currentStatus: 'waiting' });
            
            const videoInfo = await pollVideoStatus(taskData.id);
            
            results.push({
                index: i,
                prompt,
                taskId: taskData.id,
                url: videoInfo.url,
                status: 'completed'
            });
            
            // 保存当前视频URL，用于下一个分镜
            previousVideoUrl = videoInfo.url;
            console.log(`[video-continuity] ✅ 分镜 ${i + 1} 完成: ${videoInfo.url.substring(0, 50)}...`);
            updateTask({ status: 'processing', currentSegment: i, currentStatus: 'completed', results });
            
        } catch (error) {
            console.error(`[video-continuity] ❌ 分镜 ${i + 1} 失败:`, error.message);
            results.push({
                index: i,
                prompt,
                status: 'failed',
                error: error.message
            });
            updateTask({ status: 'failed', currentSegment: i, error: error.message, results });
            // 失败后不再继续生成
            break;
        }
    }
    
    const finalResult = {
        success: results.every(r => r.status === 'completed'),
        total: segments.length,
        completed: results.filter(r => r.status === 'completed').length,
        results
    };
    
    updateTask({ status: 'completed', ...finalResult });
    return finalResult;
}

module.exports = async function handler(req, res) {
    const json = (status, payload) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        json(204, {});
        return;
    }

    // 📊 查询任务进度（GET请求）
    if (req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const taskId = url.searchParams.get('taskId');
        
        if (!taskId) {
            json(400, { error: 'MISSING_TASK_ID', message: '需要提供taskId参数' });
            return;
        }
        
        if (!taskStore.has(taskId)) {
            json(404, { error: 'TASK_NOT_FOUND', message: '任务不存在或已过期' });
            return;
        }
        
        const task = taskStore.get(taskId);
        json(200, task);
        return;
    }

    if (req.method !== 'POST') {
        json(405, { error: 'METHOD_NOT_ALLOWED' });
        return;
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const {
            action = 'generate',   // 'generate' 或 'status'
            taskId,                // 任务ID（查询状态时使用）
            segments,              // 分镜提示词数组
            model = 'sora-2',      // 模型：sora-2 或 veo-3
            duration = 5,          // 默认时长（秒）
            aspect_ratio = '16:9', // 默认比例
            hd = false,            // 是否高清
            character_url,         // 可选：角色视频URL（仅第一个分镜使用）
            character_timestamps,  // 可选：角色时间戳（仅第一个分镜使用）
            _character,            // 🧬 Sora2 角色锁定（username 列表，逗号分隔）
            async = false,         // 是否异步模式（立即返回taskId）
            userId                 // 🔐 用户ID（计费用）
        } = body || {};

        // 📊 查询任务状态（不需要登录验证）
        if (action === 'status') {
            if (!taskId) {
                json(400, { error: 'MISSING_TASK_ID', message: '需要提供taskId' });
                return;
            }
            
            if (!taskStore.has(taskId)) {
                json(404, { error: 'TASK_NOT_FOUND', message: '任务不存在或已过期' });
                return;
            }
            
            const task = taskStore.get(taskId);
            json(200, task);
            return;
        }

        // 🔐 安全检查：生成操作必须提供 userId（防止白嫖）
        if (!userId) {
            json(401, { error: 'UNAUTHORIZED', message: '请先登录后再使用此功能' });
            return;
        }

        // 🎬 生成视频
        if (!segments || !Array.isArray(segments) || segments.length === 0) {
            json(400, { error: 'MISSING_SEGMENTS', message: '需要提供分镜提示词数组' });
            return;
        }

        if (YUNMENG_API_KEYS.length === 0) {
            json(500, { error: 'SERVER_CONFIG_ERROR', message: '服务器未配置API Key' });
            return;
        }

        // 💰 计费：按分镜数量计费
        const filmCost = segments.length * FILM_COST_PER_SEGMENT;
        
        // 检查请求是否包含跳过扣费标志（由前端控制）
        const skipBilling = body.skip_billing === true;
        
        let billingSuccess = false;
        if (filmCost > 0 && userId && !skipBilling) {
            try {
                const billingResult = await __billing('consume', userId, filmCost, `连续视频:${segments.length}个分镜`);
                if (!billingResult.success && !billingResult.skipped) {
                    json(400, { error: 'BILLING_FAILED', message: billingResult.error || '扣费失败' });
                    return;
                }
                billingSuccess = !billingResult.skipped;
            } catch (billingErr) {
                json(400, { error: 'BILLING_FAILED', message: billingErr.message });
                return;
            }
        } else if (skipBilling) {
            console.log(`[video-continuity] 💰 跳过扣费: 前端已处理扣费`);
        }

        console.log(`[video-continuity] 📝 收到请求: ${segments.length} 个分镜, 模型: ${model}, 异步: ${async}`);

        // 生成任务ID
        const newTaskId = `continuity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 创建任务记录
        taskStore.set(newTaskId, {
            taskId: newTaskId,
            status: 'pending',
            totalSegments: segments.length,
            currentSegment: 0,
            results: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            userId,
            filmCost,
            billingSuccess
        });

        // 🔄 异步模式：立即返回taskId，后台处理
        if (async) {
            // 后台执行（不阻塞响应）
            generateContinuousVideo({
                taskId: newTaskId,
                segments,
                model,
                duration,
                aspect_ratio,
                hd,
                character_url,
                character_timestamps,
                _character  // 🧬 传递角色锁定参数
            }).then(result => {
                // 成功完成，计算实际完成的分镜数量
                const completedCount = result.completed || 0;
                const failedCount = segments.length - completedCount;
                
                // 🚨 根据"获取task_id后不退款"原则：
                // 每个分镜调用generateVideoSegment后已获取task_id，上游API已消耗
                // 因此即使后续轮询失败，也不退款
                if (failedCount > 0) {
                    console.warn(`[video-continuity] ${failedCount}个分镜失败，但上游API已消耗，不退款`);
                }
            }).catch(err => {
                console.error(`[video-continuity] 后台任务失败:`, err);
                if (taskStore.has(newTaskId)) {
                    const task = taskStore.get(newTaskId);
                    task.status = 'failed';
                    task.error = err.message;
                    taskStore.set(newTaskId, task);
                }
                // 🚨 不退款：即使全部失败，也可能已经调用了部分分镜的API
                console.warn(`[video-continuity] 任务失败，但上游API可能已消耗，不退款`);
            });
            
            json(202, { 
                taskId: newTaskId, 
                message: '任务已创建，请通过taskId查询进度',
                pollUrl: `/api/video-continuity?taskId=${newTaskId}`,
                billed: billingSuccess ? filmCost : 0
            });
            return;
        }

        // 📞 同步模式：等待完成后返回
        try {
            const result = await generateContinuousVideo({
                taskId: newTaskId,
                segments,
                model,
                duration,
                aspect_ratio,
                hd,
                character_url,
                character_timestamps,
                _character  // 🧬 传递角色锁定参数
            });

            // 计算实际完成的分镜数量
            const completedCount = result.completed || 0;
            const failedCount = segments.length - completedCount;
            
            // 🚨 根据"获取task_id后不退款"原则：
            // 每个分镜调用generateVideoSegment后已获取task_id，上游API已消耗
            // 因此即使后续轮询失败，也不退款
            if (failedCount > 0) {
                console.warn(`[video-continuity] ${failedCount}个分镜失败，但上游API已消耗，不退款`);
            }

            json(200, { 
                taskId: newTaskId, 
                ...result, 
                billed: billingSuccess ? filmCost : 0  // 🔧 修复：显示实际扣费金额（预扣全额）
            });
        } catch (err) {
            // 🚨 不退款：即使全部失败，也可能已经调用了部分分镜的API
            console.warn(`[video-continuity] 任务失败，但上游API可能已消耗，不退款:`, err?.message);
            throw err;
        }

    } catch (error) {
        console.error('[video-continuity] 调用失败:', error.message);
        json(500, { error: 'VIDEO_CONTINUITY_FAILED', message: error.message });
    }
};

