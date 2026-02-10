/**
 * Sora2 视频生成 API 代理
 * 🔐 API Key 通过环境变量配置，不暴露给前端
 * 🔄 云梦/云雾API优先，贞贞API可选备用（生产默认尽量不走）
 * 💰 计费通过 /api/supabase-proxy 统一处理
 */

// ========== 计费配置（与 mobile.html QUOTA_COSTS 对齐） ==========
const FILM_COST = {
    'sora-2-vip-all': 7,   // Sora2 VIP 过渡模型（10s）
    'sora-2-all': 7,       // Sora2 通用（已停用，兼容旧任务）
    'sora-2-pro-all': 14,  // Sora2 Pro 通用（已停用，兼容旧任务）
    'sora-2-characters': 7, // 角色锁定模式
    'grok-video-3': 5,     // Grok Video 3 (6秒)
    'grok-video-3-10s': 8, // Grok Video 3 (10秒)
    'veo3': 30,            // Veo3 4K版本
    'veo3.1': 30,          // Veo 3.1 4K版本
    // 🔧 补充常见模型别名，避免默认7胶片的误计算
    'sora-2': 7,           // Sora2 基础模型
    'sora2': 7,            // Sora2 兼容名称
    'sora2-hd': 7,         // Sora2 HD 兼容名称
    'sora-image': 7,       // Sora 图生视频模型
    'sora-2-landscape': 7, // Sora2 横屏
    'sora-2-portrait': 7,  // Sora2 竖屏
    'sora-2-landscape-hd': 7, // Sora2 横屏HD
    'sora-2-portrait-hd': 7,  // Sora2 竖屏HD
    'sora-2-hd': 7,        // Sora2 HD
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
            console.warn('[sora2] 保存记录失败:', data.error || data.message);
            return { success: false, error: data.error || data.message };
        }
        
        console.log(`[sora2] 📝 生成记录已保存: ${data.recordId}`);
        return { success: true, recordId: data.recordId };
    } catch (e) {
        console.warn('[sora2] 保存记录异常:', e.message);
        return { success: false, error: e.message };
    }
}

/**
 * 🔐 统一计费函数 - 调用 /api/supabase-proxy
 */
async function __billing(billingAction, userId, amount, description) {
    console.log(`[sora2] 💰 开始${billingAction === 'refund' ? '退款' : '扣费'}: userId=${userId}, amount=${amount}, desc=${description}`);
    
    if (!userId || amount <= 0) {
        console.warn(`[sora2] ⚠️ 跳过扣费: userId=${userId}, amount=${amount}`);
        return { success: true, skipped: true };
    }
    
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
            console.error(`[sora2] 退款失败:`, data);
            return { success: false, error: data.message || data.error };
        }
        
        console.log(`[sora2] 💰 ${billingAction === 'refund' ? '退款' : '扣费'}成功: ${userId} ${billingAction === 'refund' ? '+' : '-'}${intAmount}胶片`);
        return { success: true, newBalance: data.newBalance, newUsed: data.newUsed };
    } catch (e) {
        if (billingAction === 'consume') {
            throw e;
        }
        console.error(`[sora2] 退款异常:`, e.message);
        return { success: false, error: e.message };
    }
}

// 🔧 贞贞API（备用）
// 🚨 硬禁用所有贞贞(t8star)调用，避免误扣费
const ALLOW_ZHENZHEN = false;

const ZHENZHEN_API_KEY = '';
const ZHENZHEN_API_URL = process.env.VIDEO_API_URL || 'https://ai.t8star.cn';
// 兼容旧命名：贞贞 API 基地址（历史代码里曾用 API_BASE_URL）
const API_BASE_URL = ZHENZHEN_API_URL;

// 🆕 云梦/云雾API配置（主力优先）- 支持多个 API Key 轮换
const YUNMENG_API_KEYS = (() => {
    const keys = [];
    // 主 key
    const key1 = process.env.YUNMENG_API_KEY || process.env.YUNWU_API_KEY || '';
    if (key1) keys.push(key1);

    // 备用 key（可配置多个）
    const key2 = process.env.YUNMENG_API_KEY_2 || '';
    if (key2) keys.push(key2);

    const key3 = process.env.YUNMENG_API_KEY_3 || '';
    if (key3) keys.push(key3);

    console.log(`[sora2] 🔑 已配置 ${keys.length} 个云梦 API Key`);
    return keys;
})();

const YUNMENG_API_KEY = YUNMENG_API_KEYS[0] || ''; // 兼容旧代码

const YUNMENG_ENDPOINTS = [
    'https://api3.wlai.vip',
    'https://yunwu.zeabur.app',
    'https://yunwu.ai',
    // 与 yunwu.js 保持一致：增加 CF 站兜底（很多时候反而是唯一可用的）
    'https://api.apiplus.org'
];

// 🔄 Key 轮换索引（全局状态，用于负载均衡）
let keyRotationIndex = 0;

/**
 * 🔑 获取下一个可用的 API Key（轮换）
 * @returns {string} API Key
 */
function getNextApiKey() {
    if (!YUNMENG_API_KEYS.length) return '';
    const key = YUNMENG_API_KEYS[keyRotationIndex % YUNMENG_API_KEYS.length];
    keyRotationIndex = (keyRotationIndex + 1) % YUNMENG_API_KEYS.length;
    return key;
}

// 兼容旧变量名
const API_KEY = ZHENZHEN_API_KEY;
const YUNWU_API_KEY = YUNMENG_API_KEY;
const YUNWU_ENDPOINTS = YUNMENG_ENDPOINTS;

// ✅ “尽量不走贞贞，但保证可用性”：
// - 默认：允许贞贞作为**最后兜底**（仅当云梦出现 5xx/网络故障等“服务端不可用”场景）
// - 明确禁用：设置 DISABLE_ZHENZHEN_FALLBACK=1
// - 明确启用：设置 ENABLE_ZHENZHEN_FALLBACK=1（优先级高于 disable）
const ENABLE_ZHENZHEN_FALLBACK = false;

/**
 * 🔄 带自动备用的视频生成请求
 * ☁️ 严格优先云梦/云雾API（主力），仅当全部失败时才切换贞贞API（备用）
 * 
 * ⚠️ 重要：云梦和贞贞的API路径不同！
 * - 云梦/云雾：/v1/video/create + /v1/videos/{task_id}
 * - 贞贞：/v2/videos/generations + /v2/videos/generations/{task_id}
 */
async function fetchWithFallback(requestBody, action) {
    // 🔧 兼容：部分上游不识别 sora-2-*-hd 这类 model 字符串（主要是“贞贞/备用链路”）
    // 统一策略（对所有上游都生效）：
    // - sora-2-landscape-hd / sora-2-portrait-hd / sora-2-hd → model=sora-2 + hd=true + aspect_ratio
    // - sora-2-landscape / sora-2-portrait → model=sora-2 + aspect_ratio（hd=false）
    // 说明：这样即使走到备用上游，也不会因为 model 名不在白名单而 400
    const normalizeForUpstream = (body) => {
        const b = { ...(body || {}) };
        const m = String(b.model || '').trim();
        if (!m) return b;
        // Characters / Pro 模式：保持原样（需要上游支持）
        if (m === 'sora-2-characters' || m === 'sora-2-pro') return b;
        if (m === 'sora-2-hd' || m === 'sora2-hd' || m === 'sora-2-landscape-hd') {
            b.model = 'sora-2';
            b.hd = true;
            if (!b.aspect_ratio) b.aspect_ratio = '16:9';
            return b;
        }
        if (m === 'sora-2-portrait-hd') {
            b.model = 'sora-2';
            b.hd = true;
            b.aspect_ratio = b.aspect_ratio || '9:16';
            return b;
        }
        if (m === 'sora-2-landscape') {
            b.model = 'sora-2';
            b.hd = false;
            b.aspect_ratio = b.aspect_ratio || '16:9';
            return b;
        }
        if (m === 'sora-2-portrait') {
            b.model = 'sora-2';
            b.hd = false;
            b.aspect_ratio = b.aspect_ratio || '9:16';
            return b;
        }
        return b;
    };

    // ⚠️ 重要：云梦这边**不要**做 model 拆解/重写（yunwu.js 直发 sora-2-landscape-hd 能成功）
    // 仅在走到贞贞时才做 normalize，避免贞贞不认识 sora-2-landscape-hd
    const zhenzhenBody = normalizeForUpstream(requestBody);

    // 🔧 云梦接口对字段更严格：只发送白名单字段，避免"unknown field / type mismatch"导致 4xx
    const toYunmengBody = (b) => {
        const out = {};
        if (!b || typeof b !== 'object') return out;
        if (b.model != null) out.model = b.model;
        if (b.prompt != null) out.prompt = b.prompt;
        if (Array.isArray(b.images)) out.images = b.images;
        if (b.aspect_ratio != null) out.aspect_ratio = b.aspect_ratio;
        if (b.hd != null) out.hd = !!b.hd;
        // 🆕 云雾 API 格式：orientation 参数（portrait/landscape）
        if (b.orientation != null) {
            out.orientation = String(b.orientation).toLowerCase();
        } else if (b.aspect_ratio) {
            // 自动根据 aspect_ratio 设置 orientation
            out.orientation = (b.aspect_ratio === '9:16' || b.aspect_ratio === 'portrait') ? 'portrait' : 'landscape';
        }
        // ✅ 云梦侧 duration 需要 int（否则会报：cannot unmarshal string into ... duration of type int）
        if (b.duration != null) {
            const d = Number(b.duration);
            if (Number.isFinite(d) && d > 0) out.duration = Math.round(d);
        }

        // 🆕 OpenAI 官方格式：创建视频时直接指定角色参数
        if (b.character_url != null) out.character_url = String(b.character_url);
        if (b.character_timestamps != null) out.character_timestamps = String(b.character_timestamps);

        // 🆕 OpenAI 官方格式：可选参数
        if (b.seconds != null) out.seconds = String(b.seconds); // 视频时长（秒）
        if (b.size != null && !b.size.startsWith('auto')) out.size = String(b.size); // 视频尺寸（例如 16x9）
        if (b.watermark != null) out.watermark = String(b.watermark); // 是否添加水印
        if (b.private != null) out.private = String(b.private); // 是否私密
        if (b.input_reference != null) out.input_reference = String(b.input_reference); // 输入参考图片（URL 或 base64）

        // 🆕 故事板格式扩展：从已完成任务创建角色
        if (b.character_from_task != null) out.character_from_task = String(b.character_from_task); // 已完成任务ID
        // 🆕 故事板格式扩展：生成视频后自动创建角色
        if (b.character_create === true || b.character_create === 'true') out.character_create = true;

        // 🎨 风格参数（仅支持特定值：thanksgiving, comic, news, selfie, nostalgic, anime）
        if (b.style != null) {
            const validStyles = ['thanksgiving', 'comic', 'news', 'selfie', 'nostalgic', 'anime'];
            const style = String(b.style).toLowerCase().trim();
            if (validStyles.includes(style)) {
                out.style = style;
            } else {
                console.warn(`[sora2] ⚠️ 不支持的风格: ${b.style}，有效值为: ${validStyles.join(', ')}`);
            }
        }

        // ✅ 云梦 Sora2 模型处理：sora-2-vip-all 是当前过渡模型
        // 🔧 旧 sora-2-all / sora-2-pro-all 已停用，统一转换为 sora-2-vip-all
        const m = String(out.model || '').trim();
        if (m === 'sora-2-vip-all') {
            // 当前过渡模型，保持原样
        } else if (m === 'sora-2-all' || m === 'sora-2-pro-all' || m === 'sora-2-characters') {
            // 旧模型统一转换为过渡模型
            out.model = 'sora-2-vip-all';
        } else if (m === 'sora-2-pro') {
            out.model = 'sora-2-vip-all';
        } else if (m === 'sora-2' || m === 'sora-2-hd' || m === 'sora2-hd' || m === 'sora-2-landscape' || m === 'sora-2-landscape-hd' || m === 'sora-2-portrait' || m === 'sora-2-portrait-hd') {
            out.model = 'sora-2-vip-all';
        }

        // 🆕 Grok Video 3 特殊参数处理 (6秒和10秒版本)
        const isGrokVideo = m === 'grok-video-3' || m === 'grok-video-3-hd' || m === 'grok-video-3-10s' || m === 'grok-video-3-10s-hd';
        if (isGrokVideo) {
            // Grok 使用不同的 aspect_ratio 格式
            if (out.aspect_ratio === '16:9') out.aspect_ratio = '3:2';
            else if (out.aspect_ratio === '9:16') out.aspect_ratio = '2:3';
            else if (out.aspect_ratio === '1:1') out.aspect_ratio = '1:1';

            // Grok 使用 "720P" 或 "1080P" 格式
            const wantHd = !!out.hd || m.includes('-hd');
            out.size = wantHd ? '1080P' : '720P';

            // Grok 10秒版本设置 duration
            const is10s = m.includes('10s');
            if (is10s) {
                out.duration = 10;
            } else {
                // 6秒版本不使用 duration
                delete out.duration;
            }
            delete out.seconds;
            delete out.hd;

            // 确保 model 名称正确 (10秒版本使用 grok-video-3-10s)
            out.model = is10s ? 'grok-video-3-10s' : 'grok-video-3';
        } else {
            // ✅ 云梦某些节点要求 size（否则 400: "size is required for sora-2"）
            // 这里按比例+hd 给一个稳妥尺寸，避免过大导致失败
            if (!out.size) {
                const isPortrait = (out.aspect_ratio === '9:16' || out.aspect_ratio === 'portrait');
                const wantHd = !!out.hd || /-hd$/.test(String(out.model || ''));
                if (isPortrait) {
                    out.size = wantHd ? '1080x1920' : '720x1280';
                } else {
                    out.size = wantHd ? '1920x1080' : '1280x720';
                }
            }
        }

        return out;
    };

    // 生成一个“类 response”对象给上层统一处理（避免在 Node 环境依赖 global Response）
    const makeFailResponse = (status, text) => ({
        ok: false,
        status: status || 500,
        text: async () => String(text || ''),
        json: async () => {
            try { return JSON.parse(String(text || '')); } catch { return { message: String(text || '') }; }
        }
    });

    // 1️⃣ 主力：云梦/云雾 API（多节点+多 key+多格式自动切换）
    // 🆕 支持多种 API 格式：
    // - 统一视频格式: /v1/video/create (默认)
    // - OpenAI官方格式: /v1/videos
    const API_FORMATS = [
        { path: '/v1/video/create', name: '统一格式' },
        { path: '/v1/videos', name: 'OpenAI格式' }
    ];
    
    if (YUNMENG_API_KEYS.length > 0) {
        let saw429 = false;
        let saw5xxOrNetwork = false;
        let lastClientErr = null; // { status, text, endpoint, keyIndex, format }
        let lastServerErr = null; // { status, text, endpoint, keyIndex, format }

        // 🆕 允许前端指定格式优先级：api_format = 'openai' | 'unified' | 'auto'
        let formats = API_FORMATS.slice();
        const prefer = String(requestBody.api_format || '').toLowerCase();
        if (prefer === 'openai') {
            formats = [API_FORMATS[1], API_FORMATS[0]]; // 先 OpenAI 再 统一
        } else if (prefer === 'unified' || prefer === 'create') {
            formats = [API_FORMATS[0], API_FORMATS[1]]; // 先 统一 再 OpenAI
        }

        // 🔑 对每个端点，尝试所有可用的 key 和格式
        for (const endpoint of YUNMENG_ENDPOINTS) {
            for (let keyIdx = 0; keyIdx < YUNMENG_API_KEYS.length; keyIdx++) {
                const apiKey = YUNMENG_API_KEYS[keyIdx];
                const keyLabel = `Key${keyIdx + 1}/${YUNMENG_API_KEYS.length}`;

                // 🆕 尝试多种 API 格式（可由前端 api_format 调整优先级）
                for (const format of formats) {
                    try {
                        console.log(`[sora2] ☁️ 尝试云雾API: ${endpoint}${format.path} [${keyLabel}] [${format.name}]...`);
                        const yunmengBody = toYunmengBody(requestBody);
                        const response = await fetch(`${endpoint}${format.path}`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(yunmengBody)
                        });

                        if (response.ok) {
                            console.log(`[sora2] ☁️ ✅ 云雾API成功: ${endpoint} [${keyLabel}] [${format.name}]`);
                            const data = await response.json();
                            console.log(`[sora2] ☁️ 云雾响应原始数据:`, JSON.stringify(data).substring(0, 500));

                            // 🔧 兼容不同 API 返回的 task_id 字段名
                            if (!data.task_id) {
                                data.task_id = data.id || data.job_id || data.data?.id || data.data?.task_id;
                                console.log(`[sora2] ☁️ 映射task_id: ${data.task_id}`);
                            }

                            data._source = 'yunmeng';
                            data._endpoint = endpoint;
                            data._keyIndex = keyIdx;
                            data._format = format.name;
                            return { ok: true, json: async () => data, status: 200 };
                        }

                        if (response.status === 429) {
                            console.warn(`[sora2] ☁️ ${endpoint} [${keyLabel}] [${format.name}] 限速，尝试下一个...`);
                            saw429 = true;
                            continue;
                        }

                        const errText = await response.text();
                        console.warn(`[sora2] ☁️ ${endpoint} [${keyLabel}] [${format.name}] 返回${response.status}: ${errText.substring(0, 200)}`);

                        if (response.status < 500) {
                            lastClientErr = { status: response.status, text: errText, endpoint, keyIndex: keyIdx, format: format.name };
                            // 🆕 4xx 错误时尝试下一种格式
                            continue;
                        }
                        saw5xxOrNetwork = true;
                        lastServerErr = { status: response.status, text: errText, endpoint, keyIndex: keyIdx, format: format.name };
                    } catch (err) {
                        console.warn(`[sora2] ☁️ ${endpoint} [${keyLabel}] [${format.name}] 网络错误:`, err.message);
                        saw5xxOrNetwork = true;
                        lastServerErr = { status: 502, text: String(err && (err.message || err)), endpoint, keyIndex: keyIdx, format: format.name };
                    }
                }
            }
        }
        // ✅ 云雾全节点全格式 429：直接让前端稍后重试
        if (saw429 && !saw5xxOrNetwork) {
            console.warn('[sora2] ☁️ 云雾节点均限速(429)，提示前端重试');
            return makeFailResponse(429, JSON.stringify({ error: 'RATE_LIMIT', message: '云雾节点限速，请稍后重试' }));
        }
        // ✅ 云雾全节点失败
        console.warn('[sora2] ☁️ 云雾全部节点和格式失败');

        if (!saw5xxOrNetwork) {
            const detail = lastClientErr?.text || '';
            const payload = JSON.stringify({
                error: 'UPSTREAM_REJECTED',
                message: `云雾节点返回客户端错误（已尝试所有格式）`,
                endpoint: lastClientErr?.endpoint,
                format: lastClientErr?.format,
                upstream_status: lastClientErr?.status,
                upstream_detail: detail ? String(detail).slice(0, 2000) : ''
            });
            return makeFailResponse(lastClientErr?.status || 400, payload);
        }

        if (saw5xxOrNetwork) {
            const payload = JSON.stringify({
                error: 'UPSTREAM_UNAVAILABLE',
                message: '云雾节点服务端不可用（已尝试所有格式）',
                endpoint: lastServerErr?.endpoint,
                format: lastServerErr?.format,
                upstream_status: lastServerErr?.status,
                upstream_detail: lastServerErr?.text ? String(lastServerErr.text).slice(0, 2000) : ''
            });
            return makeFailResponse(lastServerErr?.status || 502, payload);
        }
    }

    // 2️⃣ 贞贞API（已硬禁用）

    // 全部失败
    throw new Error('所有API节点均不可用（或已禁用贞贞备用），请稍后重试');
}

/**
 * 🔄 带自动备用的轮询请求
 * 🔧 严格按来源选择：云梦创建的任务必须用云梦轮询，贞贞的用贞贞
 */
async function pollWithFallback(taskId, source, endpoint) {
    // 🔧 修复：根据任务来源严格选择轮询API

    // 🆕 0️⃣ Grok Video 3 任务检测（通过 taskId 格式判断）
    const isGrokTask = String(taskId).startsWith('grok:');

    // 1️⃣ 云梦API创建的任务 → 只能用云梦轮询
    if ((source === 'yunmeng' || source === 'yunwu') && YUNMENG_API_KEYS.length > 0) {
        const pollEndpoint = endpoint || YUNMENG_ENDPOINTS[0];

        // ✅ 修复：轮询时尝试所有配置的keys
        for (let keyIdx = 0; keyIdx < YUNMENG_API_KEYS.length; keyIdx++) {
            const apiKey = YUNMENG_API_KEYS[keyIdx];
            const keyLabel = `Key${keyIdx + 1}/${YUNMENG_API_KEYS.length}`;

            // 🆕 Grok 使用不同的查询路径
            const pollPath = isGrokTask
                ? `/v1/video/query?id=${encodeURIComponent(taskId)}`
                : `/v1/videos/${taskId}`;

            // 先尝试指定的endpoint
            try {
                console.log(`[sora2] ☁️ 轮询云梦(指定): ${pollEndpoint}${pollPath} [${keyLabel}]`);
                const response = await fetch(`${pollEndpoint}${pollPath}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                if (response.ok) return response;
                console.warn(`[sora2] ☁️ 指定节点 [${keyLabel}] 返回${response.status}，尝试下一个...`);
            } catch (err) {
                console.warn(`[sora2] ☁️ 指定节点 [${keyLabel}] 失败:`, err.message);
            }

            // 尝试其他云梦节点
            for (const ep of YUNMENG_ENDPOINTS) {
                if (ep === pollEndpoint) continue; // 跳过已尝试的
                try {
                    console.log(`[sora2] ☁️ 轮询云梦(备用): ${ep}${pollPath} [${keyLabel}]`);
                    const response = await fetch(`${ep}${pollPath}`, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });
                    if (response.ok) {
                        console.log(`[sora2] ☁️ 云梦轮询成功: ${ep} [${keyLabel}]`);
                        return response;
                    }
                } catch (err) {
                    // 继续尝试下一个
                }
            }
        }

        // 云梦任务只能云梦轮询，不回退贞贞（跨API轮询无效）
        throw new Error('云梦轮询失败：所有云梦节点和Keys不可用');
    }

    // 2️⃣ 贞贞API创建的任务（已硬禁用）
    if (source === 'zhenzhen') {
        throw new Error('贞贞(t8star)已被管理员停用');
    }

    // 3️⃣ 未知来源（兼容旧任务）→ 优先云梦，云梦失败再贞贞
    if (YUNMENG_API_KEYS.length > 0) {
        for (let keyIdx = 0; keyIdx < YUNMENG_API_KEYS.length; keyIdx++) {
            const apiKey = YUNMENG_API_KEYS[keyIdx];
            const keyLabel = `Key${keyIdx + 1}/${YUNMENG_API_KEYS.length}`;

            for (const ep of YUNMENG_ENDPOINTS) {
                try {
                    console.log(`[sora2] ☁️ 轮询云梦(探测): ${ep}/v1/videos/${taskId} [${keyLabel}]`);
                    const response = await fetch(`${ep}/v1/videos/${taskId}`, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });
                    if (response.ok) {
                        console.log(`[sora2] ☁️ 云梦探测成功: ${ep} [${keyLabel}]`);
                        return response;
                    }
                } catch (err) {
                    // 继续
                }
            }
        }
    }

    // 云梦探测失败：贞贞已硬禁用，不再兜底

    throw new Error('轮询失败：所有API节点不可用');
}

/**
 * 🧬 创建 Sora Character（Cameo）
 * - 输入：{ url } 或 { from_task } + timestamps
 * - 输出：{ id, username, permalink, profile_picture_url, ... }
 */
async function createCharacterWithFallback({ url, from_task, timestamps = '1,3' } = {}) {
    if (YUNMENG_API_KEYS.length === 0) {
        throw new Error('未配置云梦/云雾 API Key，无法创建角色');
    }
    const body = { timestamps };
    if (url) body.url = String(url);
    if (from_task) body.from_task = String(from_task);

    let lastErr = null;
    let lastErrDetail = '';
    let rateLimitCount = 0;
    
    // 🔑 对每个端点，尝试所有可用的 key
    for (const endpoint of YUNMENG_ENDPOINTS) {
        for (let keyIdx = 0; keyIdx < YUNMENG_API_KEYS.length; keyIdx++) {
            const apiKey = YUNMENG_API_KEYS[keyIdx];
            const keyLabel = `Key${keyIdx + 1}/${YUNMENG_API_KEYS.length}`;

            try {
                const apiUrl = `${endpoint}/sora/v1/characters`;
                console.log(`[sora2] 🧬 创建角色: ${apiUrl} [${keyLabel}], from_task=${from_task}`);
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });
                if (response.ok) {
                    const data = await response.json();
                    console.log(`[sora2] 🧬 ✅ 创建角色成功: ${endpoint} [${keyLabel}], username=${data?.username}`);
                    return data;
                }
                const errText = await response.text();
                console.warn(`[sora2] 🧬 ${endpoint} [${keyLabel}] 创建角色返回${response.status}: ${errText.substring(0, 300)}`);
                lastErrDetail = errText.substring(0, 200);

                // 429 限速：记录并尝试下一个 key
                if (response.status === 429) {
                    rateLimitCount++;
                    console.warn(`[sora2] 🧬 ${endpoint} [${keyLabel}] 限速(429)，尝试下一个key...`);
                    // 🔧 429时稍等一下再试下一个
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                // 4xx 多为参数/权限问题，继续尝试下一个key
                if (response.status < 500) {
                    lastErr = new Error(`上游返回${response.status}: ${lastErrDetail}`);
                    continue;
                }
                
                // 5xx 服务器错误
                lastErr = new Error(`服务器错误(${response.status}): ${lastErrDetail}`);
            } catch (e) {
                lastErr = e;
                lastErrDetail = e?.message || String(e);
                console.warn(`[sora2] 🧬 ${endpoint} [${keyLabel}] 创建角色网络错误:`, e?.message || e);
            }
        }
    }
    
    // 🔧 构建详细错误信息
    let errMsg = '创建角色失败';
    if (rateLimitCount > 0) {
        errMsg += `（触发限速${rateLimitCount}次）`;
    }
    if (lastErrDetail) {
        errMsg += `: ${lastErrDetail}`;
    }
    throw lastErr || new Error(errMsg);
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
        const { action, prompt, image_url, model = 'sora-image', duration = 5, key_value, video_url, userId } = body || {};

        if (!action) {
            json(400, { error: 'MISSING_ACTION' });
            return;
        }

        // 🔐 安全检查：生成操作必须提供 userId（防止白媼poll操作不需要）
        const needsAuth = ['text-to-video', 'image-to-video', 'create-character', 'remix'].includes(action);
        if (needsAuth && !userId) {
            json(401, { error: 'UNAUTHORIZED', message: '请先登录后再使用此功能' });
            return;
        }

        // 🔧 必须至少配置一个API密钥（云梦优先，贞贞备用）
        if (!YUNMENG_API_KEY && !API_KEY) {
            json(500, { error: 'SERVER_CONFIG_ERROR', message: '服务器配置错误：未配置云梦或贞贞API密钥' });
            return;
        }

        // 文生视频
        if (action === 'text-to-video') {
            if (!prompt) {
                json(400, { error: 'MISSING_PROMPT' });
                return;
            }

            // 💰 先扣费模式：调用上游API前先扣费
            const filmCost = FILM_COST[model] || FILM_COST['sora-2-vip-all'] || 7;
            let billingSuccess = false;
            let billingSkipped = false;
            const skipBilling = body.skip_billing === true;
            
            if (!skipBilling && filmCost > 0 && userId) {
                try {
                    const billingResult = await __billing('consume', userId, filmCost, `视频生成:${model}`);
                    if (!billingResult.success && !billingResult.skipped) {
                        json(400, { error: 'BILLING_FAILED', message: billingResult.error || '扣费失败，请检查余额' });
                        return;
                    }
                    billingSuccess = billingResult.success && !billingResult.skipped;
                    billingSkipped = billingResult.skipped;
                    console.log(`[sora2] 💰 预扣费成功: ${filmCost}胶片, userId=${userId}`);
                } catch (billingErr) {
                    json(400, { error: 'BILLING_FAILED', message: billingErr.message || '扣费失败' });
                    return;
                }
            } else {
                billingSkipped = true;
                if (skipBilling) console.log(`[sora2] 💰 跳过扣费: 前端已处理`);
            }

            // 构建请求体，支持更多参数
            const requestBody = {
                model,
                prompt
            };
            // 🧬 视频一致性参考：支持 PID(key_value) / video_url（不同上游可能只认其中一个）
            if (key_value) requestBody.key_value = String(key_value);
            if (video_url) requestBody.video_url = String(video_url);

            // 🆕 OpenAI 官方格式：创建视频时直接指定角色
            // - character_url: 包含角色的视频 URL
            // - character_timestamps: 时间范围，例如 "1,3"（1-3秒，范围差值最大 3 秒最小 1 秒）
            // 这种方式云梦 API 会自动创建角色并应用到视频生成中
            if (body.character_url && body.character_timestamps) {
                requestBody.character_url = String(body.character_url);
                requestBody.character_timestamps = String(body.character_timestamps);
                console.log('[sora2] 🧬 使用 OpenAI 官方格式创建视频（带 Character）:', {
                    character_url: requestBody.character_url,
                    character_timestamps: requestBody.character_timestamps
                });
            }

            // 🖼️ 输入参考图片（input_reference）：OpenAI 官方格式支持图片引导生成
            if (body.input_reference) {
                requestBody.input_reference = String(body.input_reference);
                console.log('[sora2] 🖼️ 使用输入参考图片:', requestBody.input_reference.substring(0, 100));
            }

            // 🆕 故事板格式：从已完成任务创建角色
            // character_from_task: 已完成的任务ID，可以根据该任务生成的视频来创建角色
            if (body.character_from_task) {
                requestBody.character_from_task = String(body.character_from_task);
                console.log('[sora2] 🧬 使用已完成任务创建角色:', requestBody.character_from_task);
            }

            // 🆕 故事板格式：生成视频后自动创建角色
            // character_create: true - 视频生成完成后，自动根据生成的视频创建角色
            if (body.character_create === true || body.character_create === 'true') {
                requestBody.character_create = true;
                console.log('[sora2] 🧬 启用自动创建角色功能');
            }

            // 🎨 风格参数（style）：OpenAI 官方格式支持特定风格
            if (body.style) {
                requestBody.style = String(body.style).toLowerCase().trim();
                console.log('[sora2] 🎨 使用风格:', requestBody.style);
            }

            // 🆕 OpenAI 官方格式：可选参数
            if (body.seconds) requestBody.seconds = String(body.seconds);
            if (body.size) requestBody.size = String(body.size);
            if (body.watermark != null) requestBody.watermark = String(body.watermark);
            if (body.private != null) requestBody.private = String(body.private);

            // 🧦 角色锁定：支持所有模型（只要前端传了 character_usernames 就注入）
            // ✅ 修复：无论使用哪个模型，只要有角色ID都可以使用角色功能
            const charList = [];
            if (Array.isArray(body.character_usernames)) {
                body.character_usernames.forEach(u => charList.push(u));
            } else if (typeof body.character_usernames === 'string') {
                body.character_usernames.split(/[,\s]+/).forEach(u => charList.push(u));
            }
            if (body.character_username) charList.push(body.character_username);

            const charUsernames = [...new Set(charList.map(u => String(u || '').trim().replace(/^@/, '')).filter(Boolean))].slice(0, 6);
            
            if (charUsernames.length > 0) {
                // ✅ 前端已提供 usernames，直接注入
                const prefix = charUsernames.map(u => `@${u}`).join(' ');
                requestBody.prompt = `${prefix} ${requestBody.prompt || ''}`.trim();
                requestBody._character = { usernames: charUsernames };
                console.log('[sora2] 🧦 使用角色锁定(多人):', requestBody._character);
            } else if (String(requestBody.model || '') === 'sora-2-characters') {
                // 🎬 旧方式兼容：仅当模型为 sora-2-characters 且没有传 usernames 时，才尝试创建角色
                try {
                    const character = await createCharacterWithFallback({
                        url: video_url || undefined,
                        from_task: key_value || undefined,
                        timestamps: body.timestamps || '1,3'
                    });
                    const username = character?.username;
                    if (username) {
                        requestBody.prompt = `@${username} ${requestBody.prompt || ''}`.trim();
                        requestBody._character = { id: character?.id, usernames: [username] };
                        console.log('[sora2] 🧦 已注入角色锁定:', requestBody._character);
                    } else {
                        console.warn('[sora2] 🧦 创建角色未返回 username，跳过注入');
                    }
                } catch (e) {
                    console.warn('[sora2] 🧦 创建角色失败，继续生成(不锁定):', e?.message || e);
                }
            }

            // 处理不同模型的参数
            if (model && model.startsWith('veo')) {
                // 🆕 veo 模型必需参数（根据 API 文档）
                requestBody.enhance_prompt = true;  // 中文自动转英文
                requestBody.enable_upsample = body.enable_upsample !== false; // 超分，默认开启
                requestBody.aspect_ratio = body.aspect_ratio || '16:9'; // veo3 支持 16:9 或 9:16
                console.log(`[sora2] 🎬 veo文生视频: model=${model}, aspect_ratio=${requestBody.aspect_ratio}`);
            } else {
                if (body.aspect_ratio) requestBody.aspect_ratio = body.aspect_ratio;
                if (body.duration != null) {
                    const d = Number(body.duration);
                    if (Number.isFinite(d) && d > 0) requestBody.duration = d;
                }
                if (body.hd) requestBody.hd = true;
            }

            console.log('[sora2] 文生视频:', { model, duration: requestBody.duration, promptLength: prompt.length });

            // 🔄 使用带备用的请求函数
            const response = await fetchWithFallback(requestBody, 'text-to-video');

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[sora2] 文生视频错误:', response.status, errorText);
            
                // 🔍 解析错误详情
                let errorDetail = '';
                let parsed = null;
                try {
                    parsed = JSON.parse(errorText);
                    errorDetail = parsed?.upstream_detail || parsed?.detail || parsed?.message || parsed?.error?.message || '';
                } catch (e) {
                    errorDetail = errorText.substring(0, 200);
                }
            
                // 🔥 重要：检查响应中是否有 task_id（说明上游已消耗）
                const hasTaskId = parsed?.task_id || parsed?.id;
                if (hasTaskId) {
                    // 有 task_id = 上游已消耗，不退款
                    console.log(`[sora2] ⚠️ 响应失败但有task_id=${hasTaskId}，上游已消耗，不退款`);
                } else if (billingSuccess) {
                    // 没有 task_id = 上游未消耗，退款
                    console.log(`[sora2] 💰 上游未消耗，退款: ${filmCost}胶片`);
                    try {
                        await __billing('refund', userId, filmCost, `视频生成失败退款:${model}`);
                    } catch (refundErr) {
                        console.error('[sora2] 退款失败:', refundErr.message);
                    }
                }
            
                // ✅ 不再 throw（避免 400 被 catch 变 500，前端只看到"服务器错误"）
                if (response.status === 400 || response.status === 422) {
                    if (String(errorDetail || '').includes('sensitive') || String(errorDetail || '').includes('违规') || String(errorDetail || '').includes('nsfw') || String(errorDetail || '').includes('blocked') || String(errorDetail || '').includes('content')) {
                        json(response.status, { error: 'SORA2_FAILED', message: `⚠️ 视频内容审核未通过: ${errorDetail || '包含敏感/违规内容，请修改提示词'}`, detail: errorDetail, upstream: parsed || null, billed: 0 });
                        return;
                    }
                    json(response.status, { error: 'SORA2_FAILED', message: `请求参数错误: ${errorDetail || '请检查提示词/模型/参数'}`, detail: errorDetail, upstream: parsed || null, billed: 0 });
                    return;
                }
                if (response.status === 403) {
                    json(403, { error: 'SORA2_FAILED', message: 'API 权限不足: 请检查账户余额', detail: errorDetail, upstream: parsed || null, billed: 0 });
                    return;
                }
                if (response.status === 429) {
                    json(429, { error: 'SORA2_FAILED', message: '请求过于频繁，请稍后重试', detail: errorDetail, upstream: parsed || null, billed: 0 });
                    return;
                }
                json(response.status || 500, { error: 'SORA2_FAILED', message: `视频生成失败 (${response.status}): ${errorDetail || '未知错误'}`, detail: errorDetail, upstream: parsed || null, billed: 0 });
                return;
            }

            const data = await response.json();
            
            // 💰 已在调用前扣费，这里只记录和返回
            const taskId = data.task_id || data.id;
            console.log(`[sora2] 🎬 文生视频任务已提交: taskId=${taskId}, userId=${userId}, model=${model}`);
            
            // 保存生成记录
            if (taskId && userId) {
                try {
                    await __saveGenerationRecord(userId, 'video', `task:${taskId}`, prompt || '', model, filmCost, { duration: requestBody.duration, aspect_ratio: requestBody.aspect_ratio });
                } catch (e) {
                    console.warn('[sora2] 保存生成记录失败:', e.message);
                }
            }
            
            // 设置扣费金额
            data.billed = billingSuccess ? filmCost : 0;
            
            // 透传角色信息（若有）
            if (requestBody._character) {
                data._character = requestBody._character;
            }
            // 直接返回原始数据，保持 task_id 等字段
            json(200, data);
            return;
        }

        // 图生视频
        if (action === 'image-to-video') {
            if (!image_url) {
                json(400, { error: 'MISSING_IMAGE_URL' });
                return;
            }

            // 💰 先扣费模式：调用上游API前先扣费
            const i2vFilmCost = FILM_COST[model] || FILM_COST['sora-2-vip-all'] || 7;
            let i2vBillingSuccess = false;
            let i2vBillingSkipped = false;
            const i2vSkipBilling = body.skip_billing === true;
            
            if (!i2vSkipBilling && i2vFilmCost > 0 && userId) {
                try {
                    const billingResult = await __billing('consume', userId, i2vFilmCost, `图生视频:${model}`);
                    if (!billingResult.success && !billingResult.skipped) {
                        json(400, { error: 'BILLING_FAILED', message: billingResult.error || '扣费失败，请检查余额' });
                        return;
                    }
                    i2vBillingSuccess = billingResult.success && !billingResult.skipped;
                    i2vBillingSkipped = billingResult.skipped;
                    console.log(`[sora2] 💰 图生视频预扣费成功: ${i2vFilmCost}胶片, userId=${userId}`);
                } catch (billingErr) {
                    json(400, { error: 'BILLING_FAILED', message: billingErr.message || '扣费失败' });
                    return;
                }
            } else {
                i2vBillingSkipped = true;
                if (i2vSkipBilling) console.log(`[sora2] 💰 图生视频跳过扣费: 前端已处理`);
            }

            // 🆕 如果是 base64 图片，先上传到图床获取真实URL
            let finalImageUrl = image_url;
            if (image_url.startsWith('data:image')) {
                try {
                    console.log('[sora2] 检测到 base64 图片，上传到图床...');
                    const base64Data = image_url.replace(/^data:image\/\w+;base64,/, '');
                    const buffer = Buffer.from(base64Data, 'base64');

                    // 使用 catbox.moe 免费图床
                    const FormData = (await import('form-data')).default;
                    const form = new FormData();
                    form.append('reqtype', 'fileupload');
                    form.append('fileToUpload', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });

                    const uploadRes = await fetch('https://catbox.moe/user/api.php', {
                        method: 'POST',
                        body: form,
                        headers: form.getHeaders ? form.getHeaders() : {}
                    });

                    if (uploadRes.ok) {
                        const uploadedUrl = await uploadRes.text();
                        if (uploadedUrl && uploadedUrl.startsWith('http')) {
                            finalImageUrl = uploadedUrl.trim();
                            console.log('[sora2] ✅ 图片上传成功:', finalImageUrl);
                        }
                    } else {
                        console.warn('[sora2] ⚠️ 图床上传失败，尝试直接使用 base64');
                    }
                } catch (e) {
                    console.warn('[sora2] ⚠️ 图片上传异常:', e?.message);
                }
            }

            // 构建请求体
            const requestBody = {
                model: model || 'sora-image',
                prompt: prompt || '',
                images: [finalImageUrl],
                // 🧲 提高参考图一致性
                preserve_subject: true,
                image_weight: (body && body.image_weight != null) ? Number(body.image_weight) : 0.98
            };
            // 🧬 视频一致性参考：支持 PID(key_value) / video_url
            if (key_value) requestBody.key_value = String(key_value);
            if (video_url) requestBody.video_url = String(video_url);

            // 🆕 OpenAI 官方格式：创建视频时直接指定角色（图生视频同样支持）
            if (body.character_url && body.character_timestamps) {
                requestBody.character_url = String(body.character_url);
                requestBody.character_timestamps = String(body.character_timestamps);
                console.log('[sora2] 🧬 图生视频使用 OpenAI 官方格式（带 Character）:', {
                    character_url: requestBody.character_url,
                    character_timestamps: requestBody.character_timestamps
                });
            }

            // 🎨 风格参数（style）：OpenAI 官方格式支持特定风格（图生视频同样支持）
            if (body.style) {
                requestBody.style = String(body.style).toLowerCase().trim();
                console.log('[sora2] 🎨 图生视频使用风格:', requestBody.style);
            }

            // 🆕 OpenAI 官方格式：可选参数（图生视频）
            if (body.seconds) requestBody.seconds = String(body.seconds);
            if (body.size) requestBody.size = String(body.size);
            if (body.watermark != null) requestBody.watermark = String(body.watermark);
            if (body.private != null) requestBody.private = String(body.private);

            // 🧬 角色锁定：图生视频只能使用已有的username，不能创建新角色
            // 根据API文档，创建角色需要视频URL或任务ID，不是图片
            const list = [];
            if (Array.isArray(body.character_usernames)) {
                body.character_usernames.forEach(u => list.push(u));
            } else if (typeof body.character_usernames === 'string') {
                body.character_usernames.split(/[,\s]+/).forEach(u => list.push(u));
            }
            if (body.character_username) list.push(body.character_username);

            const usernames = [...new Set(list.map(u => String(u || '').trim().replace(/^@/, '')).filter(Boolean))].slice(0, 6);
            if (usernames.length) {
                const prefix = usernames.map(u => `@${u}`).join(' ');
                requestBody.prompt = `${prefix} ${requestBody.prompt || ''}`.trim();
                requestBody._character = { usernames };
                console.log('[sora2] 🧬 图生视频使用已有角色:', requestBody._character);
            }

            // 处理不同模型的参数
            const isGrokModel = model && (model.startsWith('grok-video') || model.includes('grok'));
            
            if (isGrokModel) {
                // 🎮 Grok 图生视频特殊参数处理
                // Grok 使用不同的 aspect_ratio 格式
                if (body.aspect_ratio === '16:9') requestBody.aspect_ratio = '3:2';
                else if (body.aspect_ratio === '9:16') requestBody.aspect_ratio = '2:3';
                else if (body.aspect_ratio === '1:1') requestBody.aspect_ratio = '1:1';
                else requestBody.aspect_ratio = body.aspect_ratio || '3:2';
                
                // 🧲 Grok 图生视频一致性增强参数
                requestBody.fidelity = body.fidelity || 'high';  // 高保真度，更好保持参考图外观
                requestBody.image_weight = Math.max(0.95, Number(body.image_weight) || 0.98);  // 强制高权重
                requestBody.preserve_subject = true;  // 保持主体不变
                requestBody.motion_intensity = body.motion_intensity || 'medium';  // 中等运动强度，避免形变过大
                
                // Grok 使用 "720P" 或 "1080P" 格式
                const wantHd = !!body.hd || (model && model.includes('-hd'));
                requestBody.size = wantHd ? '1080P' : '720P';
                
                // Grok 10秒版本设置 duration
                const is10s = model && model.includes('10s');
                if (is10s) {
                    requestBody.duration = 10;
                    requestBody.model = 'grok-video-3-10s';
                } else {
                    delete requestBody.duration;  // 6秒版本不使用 duration
                    requestBody.model = 'grok-video-3';
                }
                
                console.log(`[sora2] 🎮 Grok图生视频: model=${requestBody.model}, fidelity=${requestBody.fidelity}, image_weight=${requestBody.image_weight}`);
            } else if (model && model.startsWith('veo')) {
                // 🆕 veo 模型必需参数（根据 API 文档）
                requestBody.enhance_prompt = true;  // 中文自动转英文
                requestBody.enable_upsample = body.enable_upsample !== false; // 超分，默认开启
                requestBody.aspect_ratio = body.aspect_ratio || '16:9'; // veo3 支持 16:9 或 9:16
                
                // 🔧 veo 图生视频需要使用 -frames 后缀的模型
                // veo2 图生视频 → veo2-fast-frames（支持首尾帧）
                // veo3 图生视频 → veo3-fast-frames 或 veo3-pro-frames（支持首帧）
                const m = String(model).toLowerCase();
                if (m === 'veo3' || m === 'veo3.1') {
                    requestBody.model = 'veo3-fast-frames'; // 4K 图生视频
                } else if (m === 'veo3-pro') {
                    requestBody.model = 'veo3-pro-frames';
                } else if (m === 'veo2' || m === 'veo2-fast') {
                    requestBody.model = 'veo2-fast-frames';
                } else if (!m.includes('-frames')) {
                    // 其他 veo 模型，自动添加 -frames 后缀
                    requestBody.model = m + '-frames';
                }
                console.log(`[sora2] 🎬 veo图生视频: 原模型=${model} → 实际模型=${requestBody.model}`);
            } else {
                if (body.aspect_ratio) requestBody.aspect_ratio = body.aspect_ratio;
                if (duration != null) {
                    const d = Number(duration);
                    if (Number.isFinite(d) && d > 0) requestBody.duration = d;
                }
                if (body.hd) requestBody.hd = true;
            }

            console.log('[sora2] 图生视频:', { model: requestBody.model, duration: requestBody.duration, hasPrompt: !!prompt });

            // 🔄 使用带备用的请求函数
            const response = await fetchWithFallback(requestBody, 'image-to-video');

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[sora2] 图生视频错误:', response.status, errorText);

                // 🔍 解析错误详情
                let errorDetail = '';
                let parsed = null;
                try {
                    parsed = JSON.parse(errorText);
                    errorDetail = parsed?.upstream_detail || parsed?.detail || parsed?.message || parsed?.error?.message || '';
                } catch (e) {
                    errorDetail = errorText.substring(0, 200);
                }

                // 🔥 检查是否有 task_id（上游已消耗）
                const hasTaskId = parsed?.task_id || parsed?.id;
                if (hasTaskId) {
                    console.log(`[sora2] ⚠️ 图生视频失败但有task_id=${hasTaskId}，上游已消耗，不退款`);
                } else if (i2vBillingSuccess) {
                    console.log(`[sora2] 💰 图生视频上游未消耗，退款: ${i2vFilmCost}胶片`);
                    try {
                        await __billing('refund', userId, i2vFilmCost, `图生视频失败退款:${model}`);
                    } catch (refundErr) {
                        console.error('[sora2] 图生视频退款失败:', refundErr.message);
                    }
                }

                // ✅ 不再 throw（避免 400 被 catch 变 500）
                if (response.status === 400 || response.status === 422) {
                    if (String(errorDetail || '').includes('sensitive') || String(errorDetail || '').includes('违规') || String(errorDetail || '').includes('nsfw') || String(errorDetail || '').includes('blocked')) {
                        json(response.status, { error: 'SORA2_FAILED', message: `⚠️ 视频内容审核未通过: ${errorDetail || '图片或提示词包含敏感内容'}`, detail: errorDetail, upstream: parsed || null, billed: 0 });
                        return;
                    }
                    json(response.status, { error: 'SORA2_FAILED', message: `请求参数错误: ${errorDetail || '请检查图片/提示词/模型/参数'}`, detail: errorDetail, upstream: parsed || null, billed: 0 });
                    return;
                }
                if (response.status === 403) {
                    json(403, { error: 'SORA2_FAILED', message: 'API 权限不足: 请检查账户余额', detail: errorDetail, upstream: parsed || null, billed: 0 });
                    return;
                }
                if (response.status === 429) {
                    json(429, { error: 'SORA2_FAILED', message: '请求过于频繁，请稍后重试', detail: errorDetail, upstream: parsed || null, billed: 0 });
                    return;
                }
                json(response.status || 500, { error: 'SORA2_FAILED', message: `视频生成失败 (${response.status}): ${errorDetail || '未知错误'}`, detail: errorDetail, upstream: parsed || null, billed: 0 });
                return;
            }

            const data = await response.json();
            
            // 💰 已在调用前扣费，这里只记录和返回
            const taskId = data.task_id || data.id;
            console.log(`[sora2] 🎬 图生视频任务已提交: taskId=${taskId}, userId=${userId}, model=${model}`);
            
            // 保存生成记录
            if (taskId && userId) {
                try {
                    await __saveGenerationRecord(userId, 'video', `task:${taskId}`, prompt || '', model, i2vFilmCost, { duration: requestBody.duration, aspect_ratio: requestBody.aspect_ratio, image_url: finalImageUrl });
                } catch (e) {
                    console.warn('[sora2] 图生视频保存记录失败:', e.message);
                }
            }
            
            // 设置扣费金额
            data.billed = i2vBillingSuccess ? i2vFilmCost : 0;
            
            if (requestBody._character) {
                data._character = requestBody._character;
            }
            // 直接返回原始数据，保持 task_id 等字段
            json(200, data);
            return;
        }

        // 🧬 创建角色（Cameo / Character ID）
        // 前端不需要知道 PID：可以传入任意一个“包含目标角色的视频 URL”，这里会返回 { id, username, ... }
        if (action === 'create-character') {
            const { url, from_task, timestamps = '1,3' } = body || {};
            if (!url && !from_task) {
                json(400, { error: 'MISSING_URL_OR_TASK_ID', message: '需要提供视频URL或任务ID' });
                return;
            }
            const character = await createCharacterWithFallback({ url, from_task, timestamps });
            json(200, { success: true, character });
            return;
        }

        // 轮询任务状态
        if (action === 'poll') {
            const { task_id, _source, _endpoint } = body;
            if (!task_id) {
                json(400, { error: 'MISSING_TASK_ID' });
                return;
            }

            // 🔄 使用带备用的轮询函数（捕获异常避免500错误）
            let response;
            try {
                response = await pollWithFallback(task_id, _source, _endpoint);
            } catch (pollErr) {
                // 🔧 轮询节点全部失败时，返回 PENDING 让前端继续重试，而不是500
                console.warn('[sora2] 轮询节点暂时不可用:', pollErr.message);
                json(200, { success: false, status: 'PENDING', error: `轮询节点暂时不可用: ${pollErr.message}` });
                return;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[sora2] 轮询错误:', response.status, errorText);

                // 🔍 解析错误详情
                let errorDetail = '';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorDetail = errorJson?.error?.message || errorJson?.message || errorJson?.detail || '';
                } catch (e) {
                    errorDetail = errorText.substring(0, 200);
                }

                // 检查是否是内容审核失败
                if (errorDetail.includes('sensitive') || errorDetail.includes('违规') || errorDetail.includes('nsfw') || errorDetail.includes('blocked') || errorDetail.includes('moderation')) {
                    json(200, { success: false, status: 'FAILED', error: `⚠️ 内容审核未通过: ${errorDetail}` });
                    return;
                }

                // 对于其他轮询错误，返回错误但不抛出，让前端继续轮询
                json(200, { success: false, status: 'PENDING', error: `轮询失败: ${response.status}` });
                return;
            }

            const data = await response.json();

            // 🔍 检查任务状态中的错误信息
            if (data.status === 'FAILED' || data.status === 'failed') {
                const failReason = data.error || data.message || data.failure_reason || '';
                if (failReason.includes('sensitive') || failReason.includes('违规') || failReason.includes('nsfw') || failReason.includes('content')) {
                    data.error = `⚠️ 内容审核未通过: ${failReason || '视频内容包含敏感元素'}`;
                } else {
                    data.error = failReason || '视频生成失败，请重试';
                }
            }

            // 直接返回原始数据，保持与原API格式一致
            json(200, data);
            return;
        }

        // 🎬 视频编辑/Remix（合并自 video-remix.js）
        if (action === 'remix') {
            const { video_id, prompt } = body || {};
            if (!video_id || !prompt) {
                json(400, { error: 'MISSING_PARAMS', message: '缺少必需参数：video_id 和 prompt' });
                return;
            }
            if (!String(video_id).startsWith('video_')) {
                json(400, { error: 'INVALID_VIDEO_ID', message: 'video_id 格式错误，应为 video_xxx 格式' });
                return;
            }

            console.log(`[sora2] remix: 开始编辑视频: ${video_id}, prompt: ${prompt.substring(0, 50)}...`);

            let lastError = null;
            let remixResponse = null;
            for (const endpoint of YUNMENG_ENDPOINTS) {
                for (let keyIdx = 0; keyIdx < YUNMENG_API_KEYS.length; keyIdx++) {
                    const apiKey = YUNMENG_API_KEYS[keyIdx];
                    try {
                        const resp = await fetch(`${endpoint}/v1/videos/${video_id}/remix`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prompt: String(prompt).trim() })
                        });
                        if (resp.ok) {
                            remixResponse = resp;
                            break;
                        }
                        if (resp.status === 429) { lastError = { status: 429, message: '请求限速' }; continue; }
                        const errText = await resp.text();
                        lastError = { status: resp.status, message: errText };
                    } catch (err) {
                        lastError = { status: 502, message: err.message };
                    }
                }
                if (remixResponse) break;
            }

            if (!remixResponse) {
                json(500, { error: 'REMIX_FAILED', message: lastError?.message || '所有节点均不可用' });
                return;
            }

            const remixData = await remixResponse.json();
            console.log('[sora2] remix: ✅ 视频编辑任务已提交:', remixData);
            json(200, { success: true, message: '视频编辑任务已提交', data: remixData, original_video_id: video_id, new_video_id: remixData?.id || null });
            return;
        }

        json(400, { error: 'INVALID_ACTION' });

    } catch (error) {
        console.error('[sora2] 调用失败:', error);
        json(500, { error: 'SORA2_FAILED', message: error.message });
    }
};


