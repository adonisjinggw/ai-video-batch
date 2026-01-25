/**
 * 高级文本 API 代理
 * 🔐 API Key 通过环境变量配置，不暴露给前端
 * 🔄 云梦API优先，贞贞API备用
 */

// 🚨 紧急开关：硬禁用所有贞贞(t8star)调用，避免误扣费
// 默认禁用；只有显式设置 ALLOW_ZHENZHEN=1 才允许（不建议生产开启）
const ALLOW_ZHENZHEN = (() => {
    const v = String(process.env.ALLOW_ZHENZHEN || '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
})();

// 🔧 贞贞API（备用）——已默认禁用
const ZHENZHEN_API_KEY = ALLOW_ZHENZHEN ? (process.env.ZHENZHEN_API_KEY || '') : '';
const ZHENZHEN_API_URL = process.env.TEXT_API_URL || 'https://ai.t8star.cn/v1';

// 🆕 云梦/云雾API配置（主力优先）
const YUNMENG_API_KEY = process.env.YUNMENG_API_KEY || process.env.YUNWU_API_KEY || '';
const YUNMENG_ENDPOINTS = [
    'https://api3.wlai.vip/v1',
    'https://yunwu.zeabur.app/v1',
    'https://yunwu.ai/v1'
];

/**
 * 🔄 带自动备用的文本生成请求
 * ☁️ 严格优先云梦API（主力），仅当全部失败时才切换贞贞API（备用）
 */
async function fetchWithFallback(requestBody) {
    // 1️⃣ 主力：云梦API（多节点自动切换）- 严格优先
    if (YUNMENG_API_KEY) {
        for (const endpoint of YUNMENG_ENDPOINTS) {
            try {
                console.log(`[text-api] ☁️ 尝试云梦API: ${endpoint}/chat/completions ...`);
                const response = await fetch(`${endpoint}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNMENG_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
                
                if (response.ok) {
                    console.log(`[text-api] ☁️ ✅ 云梦API成功: ${endpoint}`);
                    return response;
                }
                
                if (response.status === 429) {
                    console.warn(`[text-api] ☁️ ${endpoint} 限速，尝试下一节点...`);
                    continue;
                }
                
                // 客户端错误（如模型不支持），尝试下一节点
                if (response.status < 500) {
                    const errText = await response.text();
                    console.warn(`[text-api] ☁️ ${endpoint} 返回${response.status}: ${errText.substring(0, 200)}`);
                    continue;
                }
                
                console.warn(`[text-api] ☁️ ${endpoint} 返回500，尝试下一节点...`);
            } catch (err) {
                console.warn(`[text-api] ☁️ ${endpoint} 网络错误:`, err.message);
            }
        }
        console.warn('[text-api] ☁️ 云梦全部节点失败，尝试贞贞备用...');
    }
    
    // 2️⃣ 备用：贞贞API（默认禁用）
    if (ALLOW_ZHENZHEN && ZHENZHEN_API_KEY) {
        try {
            console.log('[text-api] 🔄 尝试贞贞API（备用）...');
            const response = await fetch(`${ZHENZHEN_API_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ZHENZHEN_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (response.ok) {
                console.log('[text-api] 🔄 ✅ 贞贞API成功');
            }
            return response;
        } catch (err) {
            console.warn('[text-api] 🔄 贞贞API网络错误:', err.message);
        }
    }
    
    throw new Error('所有API节点均不可用，请检查网络或稍后重试');
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

    // 🚨 硬禁用所有贞贞(t8star)接口
    json(403, { error: 'ZHENZHEN_DISABLED', message: '贞贞(t8star)已被管理员停用' });
    return;

    if (req.method !== 'POST') {
        json(405, { error: 'METHOD_NOT_ALLOWED' });
        return;
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { prompt, model = 'gemini-2.5-flash-preview-05-20', temperature = 0.7, max_tokens = 4096 } = body || {};

        if (!prompt) {
            json(400, { error: 'MISSING_PROMPT' });
            return;
        }

        // 🔧 必须至少配置一个API密钥
        if (!YUNMENG_API_KEY && !(ALLOW_ZHENZHEN && ZHENZHEN_API_KEY)) {
            json(500, { error: 'SERVER_CONFIG_ERROR', message: '服务器配置错误：未配置云梦API密钥（贞贞已禁用）' });
            return;
        }

        console.log('[text-api] 调用:', { model, len: prompt.length });

        const requestBody = {
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature,
                max_tokens
        };

        // 🔄 使用带备用的请求函数
        const response = await fetchWithFallback(requestBody);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[text-api] 错误:', response.status);
            throw new Error(`文本API错误: ${response.status}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('文本生成返回格式异常');
        }

        json(200, { success: true, content: content.trim() });

    } catch (error) {
        console.error('[text-api] 失败:', error.message);
        json(500, { error: 'TEXT_API_FAILED', message: error.message });
    }
};

