/**
 * Suno 音乐生成 API 代理
 * 🔐 API Key 通过环境变量配置，不暴露给前端
 * 💰 计费通过 /api/supabase-proxy 统一处理
 * 支持：灵感模式、自定义模式、续写模式、歌手风格、上传二创、歌曲拼接、歌词生成
 */

// ========== 计费配置 ==========
const FILM_COST = {
    'music': 8,           // 音乐生成
    'lyrics': 1,          // 歌词生成
    'concat': 2,          // 歌曲拼接
    'artist': 10,         // 歌手风格
    'upload_extend': 8    // 上传二创
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
            console.warn('[suno] 保存记录失败:', data.error || data.message);
            return { success: false, error: data.error || data.message };
        }
        
        console.log(`[suno] 📝 生成记录已保存: ${data.recordId}`);
        return { success: true, recordId: data.recordId };
    } catch (e) {
        console.warn('[suno] 保存记录异常:', e.message);
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
            console.error(`[suno] 退款失败:`, data);
            return { success: false, error: data.message || data.error };
        }
        
        console.log(`[suno] 💰 ${billingAction === 'refund' ? '退款' : '扣费'}成功: ${userId} ${billingAction === 'refund' ? '+' : '-'}${intAmount}胶片`);
        return { success: true, newBalance: data.newBalance, newUsed: data.newUsed };
    } catch (e) {
        if (billingAction === 'consume') {
            throw e;
        }
        console.error(`[suno] 退款异常:`, e.message);
        return { success: false, error: e.message };
    }
}

// API 配置
const SUNO_API_KEYS = (() => {
    const keys = [];
    const key1 = process.env.YUNMENG_API_KEY || process.env.YUNWU_API_KEY || '';
    if (key1) keys.push(key1);
    const key2 = process.env.YUNMENG_API_KEY_2 || '';
    if (key2) keys.push(key2);
    const key3 = process.env.YUNMENG_API_KEY_3 || '';
    if (key3) keys.push(key3);
    console.log(`[suno] 🔑 已配置 ${keys.length} 个 API Key`);
    return keys;
})();

const SUNO_ENDPOINTS = [
    'https://api3.wlai.vip',
    'https://yunwu.zeabur.app',
    'https://yunwu.ai',
    'https://api.apiplus.org'
];

// Key 轮换索引
let keyRotationIndex = 0;

function getNextApiKey() {
    if (!SUNO_API_KEYS.length) return '';
    const key = SUNO_API_KEYS[keyRotationIndex % SUNO_API_KEYS.length];
    keyRotationIndex = (keyRotationIndex + 1) % SUNO_API_KEYS.length;
    return key;
}

/**
 * 支持的模型列表
 */
const SUNO_MODELS = {
    'chirp-v3-0': 'v3.0',
    'chirp-v3-5': 'v3.5',
    'chirp-v3-5-tau': 'v3.5-tau (歌手风格)',
    'chirp-v4': 'v4.0',
    'chirp-v4-tau': 'v4-tau (歌手风格)',
    'chirp-auk': 'v4.5',
    'chirp-v5': 'v5.0'
};

/**
 * 带自动备用的 POST 请求函数（含超时控制）
 */
async function fetchWithFallback(endpoint, body, action) {
    const errors = [];
    const timeoutMs = 30000; // 30秒超时

    for (const baseUrl of SUNO_ENDPOINTS) {
        const apiKey = getNextApiKey();
        if (!apiKey) {
            errors.push(`[${baseUrl}] 无可用 API Key`);
            continue;
        }

        try {
            console.log(`[suno] 尝试 ${baseUrl}${endpoint}`);
            
            // 🔧 添加超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const res = await fetch(`${baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = { raw: text };
            }

            if (res.ok && (data.code === 'success' || data.data)) {
                console.log(`[suno] ✅ ${action} 成功 via ${baseUrl}`);
                return { success: true, data, endpoint: baseUrl };
            }

            const errDetail = typeof data.message === 'string' ? data.message
                            : typeof data.error === 'string' ? data.error
                            : text.slice(0, 200);
            errors.push(`[${baseUrl}] ${res.status}: ${errDetail}`);
        } catch (e) {
            if (e.name === 'AbortError') {
                errors.push(`[${baseUrl}] 请求超时(${timeoutMs/1000}s)`);
            } else {
                errors.push(`[${baseUrl}] 网络错误: ${e.message}`);
            }
        }
    }

    return { success: false, error: errors.join(' | ') };
}

/**
 * 带自动备用的 GET 请求函数
 */
async function fetchGetWithFallback(endpoint, action) {
    const errors = [];

    for (const baseUrl of SUNO_ENDPOINTS) {
        const apiKey = getNextApiKey();
        if (!apiKey) continue;

        try {
            console.log(`[suno] GET ${baseUrl}${endpoint}`);
            const res = await fetch(`${baseUrl}${endpoint}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = { raw: text };
            }

            if (res.ok && data) {
                console.log(`[suno] ✅ ${action} 成功 via ${baseUrl}`);
                return { success: true, data, endpoint: baseUrl };
            }

            errors.push(`[${baseUrl}] ${res.status}`);
        } catch (e) {
            errors.push(`[${baseUrl}] ${e.message}`);
        }
    }

    return { success: false, error: errors.join(' | ') };
}

/**
 * 查询任务状态 (POST 批量 / GET 单个)
 */
async function fetchTaskStatus(taskId, useBatch = false, ids = null) {
    const errors = [];

    for (const baseUrl of SUNO_ENDPOINTS) {
        const apiKey = getNextApiKey();
        if (!apiKey) continue;

        try {
            let res;
            if (useBatch && ids) {
                // 批量查询
                res = await fetch(`${baseUrl}/suno/fetch`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({ ids })
                });
            } else if (taskId) {
                // 单个查询 (GET)
                res = await fetch(`${baseUrl}/suno/fetch/${taskId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    }
                });
            } else {
                continue;
            }

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = { raw: text };
            }

            if (res.ok && data) {
                return { success: true, data, endpoint: baseUrl };
            }

            errors.push(`[${baseUrl}] ${res.status}`);
        } catch (e) {
            errors.push(`[${baseUrl}] ${e.message}`);
        }
    }

    return { success: false, error: errors.join(' | ') };
}

/**
 * Vercel Serverless 入口
 */
module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const json = (code, data) => res.status(code).json(data);

    if (req.method !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }

    const {
        action,
        userId,  // 🔐 用户ID（计费用）
        // 通用参数
        task_id,
        // 音乐生成参数
        prompt,              // 歌词内容（自定义模式）或创作描述（灵感模式）
        mv,                  // 模型：chirp-v3-0, chirp-v3-5, chirp-v4, chirp-auk, chirp-v5
        title,               // 歌曲标题
        tags,                // 风格标签（逗号分隔）
        make_instrumental,   // 是否纯音乐
        gpt_description_prompt, // 灵感模式描述
        // 续写参数
        continue_at,         // 续写起始时间
        continue_clip_id,    // 续写歌曲ID
        task,                // 任务类型：extend（续写）
        // 高级参数
        negative_tags,       // 不希望的风格
        metadata             // 自定义参数 {create_mode, vocal_gender}
    } = req.body || {};

    // 🔐 安全检查：必须提供 userId 才能使用 API（防止白嫖）
    // 排除查询操作（轮询/查询状态不需要登录，因为不涉及计费）
    const noAuthActions = ['poll', 'fetch', 'status', 'fetch_batch', 'models'];
    if (!userId && !noAuthActions.includes(action)) {
        return json(401, { error: 'UNAUTHORIZED', message: '请先登录后再使用此功能' });
    }

    console.log(`[suno] action=${action}, model=${mv}, title=${title}`);

    // ========== 提交音乐生成任务 ==========
    if (action === 'generate' || action === 'music') {
        // 💰 计费配置
        const filmCost = FILM_COST['music'] || 8;
        let billingSuccess = false;

        // 🔒 先扣费（🔧 修复：__billing 会 throw，必须 try-catch 防止函数崩溃）
        if (filmCost > 0 && userId) {
            try {
                const billingResult = await __billing('consume', userId, filmCost, `音乐生成:${mv || 'chirp-v4'}`);
                if (!billingResult.success && !billingResult.skipped) {
                    return json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: String(billingResult.error || '扣费失败'), billed: 0 });
                }
                billingSuccess = billingResult.success && !billingResult.skipped;
            } catch (billingErr) {
                console.error('[suno] 扣费异常:', billingErr.message);
                return json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: String(billingErr.message || '扣费失败'), billed: 0 });
            }
        }
        
        const requestBody = {
            mv: mv || 'chirp-v4'
        };

        // 灵感模式：使用 gpt_description_prompt
        if (gpt_description_prompt) {
            requestBody.gpt_description_prompt = gpt_description_prompt;
            requestBody.make_instrumental = !!make_instrumental;
        }
        // 自定义模式：使用 prompt, title, tags
        else if (prompt) {
            requestBody.prompt = prompt;
            requestBody.title = title || '未命名歌曲';
            requestBody.tags = tags || '';
            requestBody.make_instrumental = !!make_instrumental;

            // 续写模式
            if (continue_clip_id && continue_at !== undefined) {
                requestBody.continue_clip_id = continue_clip_id;
                requestBody.continue_at = parseFloat(continue_at) || 0;
                requestBody.task = task || 'extend';
            }

            // 高级参数
            if (negative_tags) requestBody.negative_tags = negative_tags;
            if (metadata) requestBody.metadata = metadata;
        } else {
            return json(400, { 
                success: false,
                error: 'MISSING_PROMPT', 
                error_code: 'MISSING_PROMPT',
                message: '请提供歌词内容或创作描述',
                billed: 0
            });
        }

        const result = await fetchWithFallback('/suno/submit/music', requestBody, 'music-generate');

        if (!result.success) {
            // 🔄 API失败退款
            if (billingSuccess) {
                await __billing('refund', userId, filmCost, '音乐生成API失败退款');
            }
            return json(500, { 
                success: false,
                error: 'API_ERROR', 
                error_code: 'API_ERROR',
                message: result.error,
                billed: 0
            });
        }

        const taskId = result.data.data || result.data.task_id;
        if (!taskId) {
            // 🔄 无任务ID退款
            if (billingSuccess) {
                await __billing('refund', userId, filmCost, '音乐生成无taskID退款');
            }
            return json(500, { 
                success: false,
                error: 'NO_TASK_ID', 
                error_code: 'API_ERROR',
                message: '未返回任务ID', 
                raw: result.data,
                billed: 0
            });
        }

        // ✅ 任务提交成功（已在开头扣费，有task_id意味着上游已消耗，不退款）
        await __saveGenerationRecord(userId, 'music', `task:${taskId}`, gpt_description_prompt || prompt || '', mv || 'chirp-v4', filmCost, { title, tags, make_instrumental });

        return json(200, {
            success: true,
            task_id: taskId,
            message: '音乐生成任务已提交',
            billed: billingSuccess ? filmCost : 0,
            _endpoint: result.endpoint
        });
    }

    // ========== 查询任务状态 ==========
    if (action === 'fetch' || action === 'status') {
        if (!task_id) {
            return json(400, { error: 'MISSING_TASK_ID', message: '请提供任务ID' });
        }

        const result = await fetchTaskStatus(task_id);

        if (!result.success) {
            return json(500, { error: 'API_ERROR', message: result.error });
        }

        const taskData = result.data.data || result.data;
        console.log('[suno] 原始任务数据:', JSON.stringify(taskData, null, 2));

        // 解析状态
        const status = taskData.status || 'UNKNOWN';
        const isComplete = ['SUCCESS', 'COMPLETED', 'DONE', 'COMPLETE'].includes(status.toUpperCase());
        const isFailed = ['FAILURE', 'FAILED', 'ERROR'].includes(status.toUpperCase());

        // 🔧 增强：提取音乐数据，支持多种数据结构
        let musicList = [];
        
        // 辅助函数：从单个项目提取音乐数据
        const extractMusicItem = (item) => {
            if (!item) return null;
            const audioUrl = item.audio_url || item.url || item.song_url || item.mp3_url || '';
            if (!audioUrl) return null;
            return {
                id: item.id || item.clip_id || item.song_id || '',
                title: item.title || item.name || '未命名',
                audio_url: audioUrl,
                video_url: item.video_url || item.mv_url || '',
                image_url: item.image_url || item.cover || item.cover_url || item.image_large_url || '',
                duration: item.duration || item.song_duration || 0,
                tags: item.tags || item.style || '',
                prompt: item.prompt || item.lyrics || ''
            };
        };
        
        // 结构1: taskData.data 是数组
        if (taskData.data && Array.isArray(taskData.data)) {
            musicList = taskData.data.map(extractMusicItem).filter(Boolean);
            console.log('[suno] 从 taskData.data 数组提取:', musicList.length);
        }
        // 结构2: taskData.clips 是数组
        if (!musicList.length && taskData.clips && Array.isArray(taskData.clips)) {
            musicList = taskData.clips.map(extractMusicItem).filter(Boolean);
            console.log('[suno] 从 taskData.clips 数组提取:', musicList.length);
        }
        // 结构3: taskData.output 是数组
        if (!musicList.length && taskData.output && Array.isArray(taskData.output)) {
            musicList = taskData.output.map(extractMusicItem).filter(Boolean);
            console.log('[suno] 从 taskData.output 数组提取:', musicList.length);
        }
        // 结构4: taskData.songs 是数组
        if (!musicList.length && taskData.songs && Array.isArray(taskData.songs)) {
            musicList = taskData.songs.map(extractMusicItem).filter(Boolean);
            console.log('[suno] 从 taskData.songs 数组提取:', musicList.length);
        }
        // 结构5: taskData 本身是数组
        if (!musicList.length && Array.isArray(taskData)) {
            musicList = taskData.map(extractMusicItem).filter(Boolean);
            console.log('[suno] 从 taskData 数组提取:', musicList.length);
        }
        // 结构6: taskData 本身有 audio_url
        if (!musicList.length) {
            const item = extractMusicItem(taskData);
            if (item) {
                musicList = [item];
                console.log('[suno] 从 taskData 单对象提取:', musicList.length);
            }
        }
        
        console.log('[suno] 最终解析的音乐列表:', JSON.stringify(musicList, null, 2));

        return json(200, {
            success: true,
            task_id,
            status,
            is_complete: isComplete,
            is_failed: isFailed,
            fail_reason: taskData.failReason || taskData.fail_reason || '',
            music: musicList,
            raw: taskData,
            _endpoint: result.endpoint
        });
    }

    // ========== 获取支持的模型列表 ==========
    if (action === 'models') {
        return json(200, {
            success: true,
            models: SUNO_MODELS
        });
    }

    // ========== 生成歌词 ==========
    if (action === 'lyrics') {
        const { prompt: lyricsPrompt } = req.body || {};
        if (!lyricsPrompt) {
            return json(400, { 
                success: false,
                error: 'MISSING_PROMPT', 
                error_code: 'MISSING_PROMPT',
                message: '请提供歌词提示词',
                billed: 0
            });
        }

        const filmCost = FILM_COST['lyrics'] || 1;
        let billingSuccess = false;

        // 🔒 先扣费
        if (filmCost > 0 && userId) {
            const billingResult = await __billing('consume', userId, filmCost, '歌词生成');
            if (!billingResult.success && !billingResult.skipped) {
                return json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
            }
            billingSuccess = billingResult.success && !billingResult.skipped;
        }

        const result = await fetchWithFallback('/suno/submit/lyrics', {
            prompt: lyricsPrompt
        }, 'lyrics-generate');

        if (!result.success) {
            // 🔄 API失败退款
            if (billingSuccess) {
                await __billing('refund', userId, filmCost, '歌词生成API失败退款');
            }
            return json(500, { 
                success: false,
                error: 'API_ERROR', 
                error_code: 'API_ERROR',
                message: result.error,
                billed: 0
            });
        }

        // ✅ 任务提交成功（已在开头扣费）
        const taskId = result.data.data || result.data.task_id;
        return json(200, {
            success: true,
            task_id: taskId,
            message: '歌词生成任务已提交',
            billed: billingSuccess ? filmCost : 0,
            _endpoint: result.endpoint
        });
    }

    // ========== 歌手风格创作 ==========
    if (action === 'artist' || action === 'artist_consistency') {
        const {
            prompt: artistPrompt,
            mv: artistMv,
            title: artistTitle,
            tags: artistTags,
            persona_id,
            artist_clip_id,
            negative_tags: artistNegativeTags,
            generation_type
        } = req.body || {};

        if (!persona_id || !artist_clip_id) {
            return json(400, { 
                success: false,
                error: 'MISSING_PARAMS', 
                error_code: 'MISSING_PARAMS',
                message: '歌手风格需要 persona_id 和 artist_clip_id',
                billed: 0
            });
        }

        const filmCost = FILM_COST['artist'] || 10;
        let billingSuccess = false;

        // 🔒 先扣费
        if (filmCost > 0 && userId) {
            const billingResult = await __billing('consume', userId, filmCost, '歌手风格创作');
            if (!billingResult.success && !billingResult.skipped) {
                return json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
            }
            billingSuccess = billingResult.success && !billingResult.skipped;
        }

        const requestBody = {
            prompt: artistPrompt || '',
            mv: artistMv || 'chirp-v4-tau',
            title: artistTitle || '',
            tags: artistTags || '',
            task: 'artist_consistency',
            persona_id,
            artist_clip_id,
            generation_type: generation_type || 'TEXT'
        };
        if (artistNegativeTags) requestBody.negative_tags = artistNegativeTags;

        const result = await fetchWithFallback('/suno/submit/music', requestBody, 'artist-style');

        if (!result.success) {
            // 🔄 API失败退款
            if (billingSuccess) {
                await __billing('refund', userId, filmCost, '歌手风格API失败退款');
            }
            return json(500, { 
                success: false,
                error: 'API_ERROR', 
                error_code: 'API_ERROR',
                message: result.error,
                billed: 0
            });
        }

        // ✅ 任务提交成功（已在开头扣费）
        const taskId = result.data.data || result.data.task_id;
        return json(200, {
            success: true,
            task_id: taskId,
            message: '歌手风格创作任务已提交',
            billed: billingSuccess ? filmCost : 0,
            _endpoint: result.endpoint
        });
    }

    // ========== 上传歌曲二次创作 ==========
    if (action === 'upload_extend') {
        const {
            prompt: uploadPrompt,
            mv: uploadMv,
            title: uploadTitle,
            tags: uploadTags,
            continue_clip_id: uploadClipId,
            continue_at: uploadAt,
            negative_tags: uploadNegativeTags
        } = req.body || {};

        if (!uploadClipId) {
            return json(400, { 
                success: false,
                error: 'MISSING_CLIP_ID', 
                error_code: 'MISSING_CLIP_ID',
                message: '二次创作需要 continue_clip_id',
                billed: 0
            });
        }

        const filmCost = FILM_COST['upload_extend'] || 8;
        let billingSuccess = false;

        // 🔒 先扣费
        if (filmCost > 0 && userId) {
            const billingResult = await __billing('consume', userId, filmCost, '上传歌曲二创');
            if (!billingResult.success && !billingResult.skipped) {
                return json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
            }
            billingSuccess = billingResult.success && !billingResult.skipped;
        }

        const requestBody = {
            prompt: uploadPrompt || '歌词',
            mv: uploadMv || 'chirp-v4',
            title: uploadTitle || '标题',
            tags: uploadTags || '',
            continue_clip_id: uploadClipId,
            continue_at: parseFloat(uploadAt) || 10,
            task: 'upload_extend'
        };
        if (uploadNegativeTags) requestBody.negative_tags = uploadNegativeTags;

        const result = await fetchWithFallback('/suno/submit/music', requestBody, 'upload-extend');

        if (!result.success) {
            // 🔄 API失败退款
            if (billingSuccess) {
                await __billing('refund', userId, filmCost, '上传二创API失败退款');
            }
            return json(500, { 
                success: false,
                error: 'API_ERROR', 
                error_code: 'API_ERROR',
                message: result.error,
                billed: 0
            });
        }

        // ✅ 任务提交成功（已在开头扣费）
        const taskId = result.data.data || result.data.task_id;
        return json(200, {
            success: true,
            task_id: taskId,
            message: '上传歌曲二次创作任务已提交',
            billed: billingSuccess ? filmCost : 0,
            _endpoint: result.endpoint
        });
    }

    // ========== 歌曲拼接 ==========
    if (action === 'concat') {
        const { clip_id, is_infill } = req.body || {};

        if (!clip_id) {
            return json(400, { 
                success: false,
                error: 'MISSING_CLIP_ID', 
                error_code: 'MISSING_CLIP_ID',
                message: '歌曲拼接需要 clip_id',
                billed: 0
            });
        }

        const filmCost = FILM_COST['concat'] || 2;
        let billingSuccess = false;

        // 🔒 先扣费
        if (filmCost > 0 && userId) {
            const billingResult = await __billing('consume', userId, filmCost, '歌曲拼接');
            if (!billingResult.success && !billingResult.skipped) {
                return json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
            }
            billingSuccess = billingResult.success && !billingResult.skipped;
        }

        const result = await fetchWithFallback('/suno/submit/concat', {
            clip_id,
            is_infill: is_infill !== undefined ? is_infill : false
        }, 'concat');

        if (!result.success) {
            // 🔄 API失败退款
            if (billingSuccess) {
                await __billing('refund', userId, filmCost, '歌曲拼接API失败退款');
            }
            return json(500, { 
                success: false,
                error: 'API_ERROR', 
                error_code: 'API_ERROR',
                message: result.error,
                billed: 0
            });
        }

        // ✅ 任务提交成功（已在开头扣费）
        const taskId = result.data.data || result.data.task_id;
        return json(200, {
            success: true,
            task_id: taskId,
            message: '歌曲拼接任务已提交',
            billed: billingSuccess ? filmCost : 0,
            _endpoint: result.endpoint
        });
    }

    // ========== 批量获取任务 ==========
    if (action === 'fetch_batch') {
        const { ids } = req.body || {};

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return json(400, { error: 'MISSING_IDS', message: '请提供任务ID数组' });
        }

        const result = await fetchTaskStatus(null, true, ids);

        if (!result.success) {
            return json(500, { error: 'API_ERROR', message: result.error });
        }

        return json(200, {
            success: true,
            data: result.data.data || result.data,
            _endpoint: result.endpoint
        });
    }

    // ========== 获取WAV格式 ==========
    if (action === 'wav') {
        const { clip_id } = req.body || {};

        if (!clip_id) {
            return json(400, { error: 'MISSING_CLIP_ID', message: '请提供 clip_id' });
        }

        const result = await fetchGetWithFallback(`/suno/act/wav/${clip_id}`, 'get-wav');

        if (!result.success) {
            return json(500, { error: 'API_ERROR', message: result.error });
        }

        return json(200, {
            success: true,
            data: result.data.data || result.data,
            _endpoint: result.endpoint
        });
    }

    return json(400, { error: 'INVALID_ACTION', message: `未知操作: ${action}` });
}
