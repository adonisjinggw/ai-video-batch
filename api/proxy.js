const https = require('https');
const http = require('http');
const crypto = require('crypto');

// ==================== API Key管理和验证辅助函数 ====================
const SUPABASE_URL = 'https://tdoquxvslsuhwgiqwbrv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function __billingPublic(billingAction, userId, amount, description) {
    if (!userId || amount <= 0) return { success: true, skipped: true };

    const intAmount = Math.ceil(amount);
    const action = billingAction === 'refund' ? 'recharge' : 'consume';

    try {
        const headers = {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        };

        const profileUrl = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=quota_balance,quota_used,membership_type`;
        const profileRes = await fetch(profileUrl, { headers });

        if (!profileRes.ok) {
            throw new Error('查询用户信息失败');
        }

        const profiles = await profileRes.json();
        if (!profiles || profiles.length === 0) {
            throw new Error('用户不存在');
        }

        const currentProfile = profiles[0];
        let currentBalance = Number(currentProfile.quota_balance || 0);
        let currentUsed = Number(currentProfile.quota_used || 0);
        let newBalance = currentBalance;
        let newUsed = currentUsed;

        if (action === 'recharge') {
            newBalance = Math.round((currentBalance + intAmount) * 100) / 100;
        } else if (action === 'consume') {
            if (currentBalance < intAmount) {
                throw new Error('余额不足');
            }
            newBalance = Math.round((currentBalance - intAmount) * 100) / 100;
            newUsed = Math.round((currentUsed + intAmount) * 100) / 100;
        }

        const needUpdateQuotaBalance = newBalance !== currentBalance;
        const needUpdateQuotaUsed = action === 'consume' && newUsed !== currentUsed;

        if (needUpdateQuotaBalance || needUpdateQuotaUsed) {
            const updateUrl = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`;
            const updateData = {};

            if (needUpdateQuotaBalance) {
                updateData.quota_balance = newBalance;
            }
            if (needUpdateQuotaUsed) {
                updateData.quota_used = newUsed;
            }

            const updateRes = await fetch(updateUrl, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(updateData)
            });

            if (!updateRes.ok) {
                throw new Error('更新余额失败');
            }
        }

        try {
            const logUrl = `${SUPABASE_URL}/rest/v1/quota_logs`;
            await fetch(logUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    user_id: userId,
                    action_type: action,
                    amount: action === 'recharge' ? intAmount : -intAmount,
                    balance_after: newBalance,
                    description: description || (action === 'recharge' ? '充值' : '消费')
                })
            });
        } catch (logErr) {
            console.warn('[proxy-billing] 日志记录失败:', logErr.message);
        }

        console.log(`[proxy-billing] 💰 ${action === 'recharge' ? '充值' : '扣费'}成功: ${userId} ${action === 'recharge' ? '+' : '-'}${intAmount}胶片`);
        return { success: true, newBalance, newUsed };
    } catch (e) {
        if (action === 'consume') {
            throw e;
        }
        console.error(`[proxy-billing] 退款异常:`, e.message);
        return { success: false, error: e.message };
    }
}

async function supabaseRpc(functionName, params) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error('Supabase配置未设置');
    }
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify(params)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`RPC调用失败: ${response.status} - ${text}`);
    }
    return response.json();
}

async function supabaseQuery(table, queryParams) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error('Supabase配置未设置');
    }
    const params = new URLSearchParams(queryParams).toString();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
        method: 'GET',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`查询失败: ${response.status} - ${text}`);
    }
    return response.json();
}

async function supabaseInsert(table, data) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error('Supabase配置未设置');
    }
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`插入失败: ${response.status} - ${text}`);
    }
    return response.json();
}

async function supabaseUpdate(table, data, filter) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error('Supabase配置未设置');
    }
    const params = new URLSearchParams(filter).toString();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`更新失败: ${response.status} - ${text}`);
    }
    return response.json();
}

// 验证API Key
async function validateApiKey(apiKey) {
    try {
        const result = await supabaseRpc('validate_api_key', { p_api_key: apiKey });
        if (result && result.length > 0) {
            return result[0];
        }
        return { valid: false, user_id: null, key_id: null, quota_remaining: 0 };
    } catch (e) {
        console.error('[API Key验证失败]', e);
        return { valid: false, user_id: null, key_id: null, quota_remaining: 0 };
    }
}

// 记录API调用
async function logApiCall(keyId, userId, action, requestBody, responseStatus, success, errorMessage, responseTimeMs, filmConsumed) {
    try {
        await supabaseRpc('log_api_call', {
            p_key_id: keyId,
            p_user_id: userId,
            p_action: action,
            p_request_body: requestBody,
            p_response_status: responseStatus,
            p_success: success,
            p_error_message: errorMessage,
            p_response_time_ms: responseTimeMs,
            p_film_consumed: filmConsumed
        });
    } catch (e) {
        console.error('[API调用记录失败]', e);
    }
}

// 获取技能预计时间
function getEstimatedTime(skillId) {
    const timeMap = {
        'batch_short_video': '约3-5分钟',
        'continuous_story_video': '约5-8分钟',
        'batch_image_to_video': '约2-4分钟',
        'style_consistent_images': '约1-2分钟',
        'character_design_pack': '约3-5分钟',
        'comic_storyboard': '约3-5分钟',
        'ai_dubbing': '约30秒-2分钟',
        'ai_music': '约1-3分钟',
        'trending_copywriting': '约30秒',
        'novel_to_comic': '约3-5分钟',
        'script_split': '约30秒',
        'full_auto_workflow': '约5-10分钟',
        'brand_visual_system': '约3-5分钟',
        'social_media_kit': '约1-2分钟',
        'ecommerce_complete': '约6-8分钟',
        'marketing_brochure': '约3分钟',
        'ip_character_ecosystem': '约3-5分钟',
        'storyboard_character_sheet': '约3-5分钟',
        'image_ocr': '约10秒'
    };
    return timeMap[skillId] || '约1-2分钟';
}
// ============================================================

// 🔐 系统密钥 (必须配置环境变量，否则VIP验证将失败)
const VIP_SECRET = process.env.VIP_SECRET;
if (!VIP_SECRET) {
    console.error('❌ 严重警告: VIP_SECRET 环境变量未配置，VIP验证功能将不可用');
}

// 允许的 API 类型映射
const API_CONFIG = {
    't8star': {
        baseUrl: 'https://ai.t8star.cn',
        defaultKey: '' // ❌ 已移除硬编码 Key，强制用户配置
    },
    'rh-flux': {
        baseUrl: 'https://www.runninghub.cn',
        defaultKey: ''
    },
    'rh-flux-poll': {
        baseUrl: 'https://www.runninghub.cn',
        defaultKey: ''
    }
};

module.exports = async function handler(req, res) {

    // 1. 设置 CORS 头 (放宽限制，支持第三方工具调用)
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // 没有 Origin 头时，使用通配符（但不能与 credentials 一起使用）
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    // 移除 credentials 限制，使第三方工具可以正常调用
    // res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, apiType, targetUrl, x-api-key');

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. 解析请求参数
    const { apiType, targetUrl, method = 'POST' } = req.query;

    // 🛡️ 鲁棒性修复：确保 requestBody 是对象
    let requestBody = req.body;
    if (typeof requestBody === 'string') {
        try {
            requestBody = JSON.parse(requestBody);
        } catch (e) {
            console.warn('Request body parsing failed:', e);
            requestBody = {};
        }
    }

    // 优先从 requestBody 获取参数
    const type = requestBody?.apiType || apiType;
    const urlOverride = requestBody?.targetUrl || targetUrl;
    const reqMethod = requestBody?.method || method;

    // 🚨 硬禁用所有贞贞(t8star)代理流量（无视环境变量），避免误扣费
    {
        const u = String(urlOverride || '');
        if (type === 't8star' || type === 'zhenzhen' || u.includes('t8star.cn')) {
            return res.status(403).json({ error: 'ZHENZHEN_DISABLED', message: '贞贞(t8star)已被管理员停用' });
        }
    }

    // ==================== 🆕 会员激活码验证逻辑 ====================
    if (type === 'verify-vip') {
        const { code } = requestBody;
        if (!code) return res.status(400).json({ error: 'Missing code' });

        // 🔧 安全修复：必须配置VIP_SECRET才能验证
        if (!VIP_SECRET) {
            return res.status(500).json({ success: false, message: '服务器配置错误，请联系管理员' });
        }

        try {
            const parts = code.toUpperCase().split('_');

            // 兼容旧格式 NANO-M-...
            if (code.startsWith('NANO-')) {
                return res.json({ success: false, message: '请使用新版激活码' });
            }

            // 新格式 (4段): TYPE_FILM_RANDOM_SIGNATURE
            // 例如: M_C_AB12CD34_98765432 (M=月卡, C=1000胶片)
            // 旧格式 (3段): TYPE_RANDOM_SIGNATURE
            // 例如: M_AB12CD34_98765432 (M=月卡, 无胶片)

            let prefix, filmCode, randomPart, signature;
            let filmAmount = 0;

            if (parts.length === 4) {
                // 新格式：包含胶片数量
                [prefix, filmCode, randomPart, signature] = parts;

                // 解码胶片数量
                // 0=0, A=100, B=500, C=1000, D=2000, E=5000, F=10000, G=50000, H=100000
                const filmMap = { '0': 0, 'A': 100, 'B': 500, 'C': 1000, 'D': 2000, 'E': 5000, 'F': 10000, 'G': 50000, 'H': 100000 };
                filmAmount = filmMap[filmCode] || 0;

            } else if (parts.length === 3) {
                // 旧格式：无胶片数量（向后兼容）
                [prefix, randomPart, signature] = parts;
                filmCode = null;
            } else {
                return res.json({ success: false, message: '激活码格式错误' });
            }

            // 还原会员类型
            let fullType = '';
            if (prefix === 'M') fullType = 'VIP_MONTH';
            else if (prefix === 'Y') fullType = 'VIP_YEAR';
            else if (prefix === 'P') fullType = 'VIP_PERM';
            else return res.json({ success: false, message: '未知会员类型' });

            // 验证签名 (对应 admin.html 的生成逻辑)
            const payload = filmCode !== null
                ? `${prefix}_${filmCode}_${randomPart}`  // 新格式
                : `${prefix}_${randomPart}`;             // 旧格式

            // 使用 Node.js crypto 模块进行 HMAC-SHA256
            const expectedSignature = crypto.createHmac('sha256', VIP_SECRET)
                .update(payload)
                .digest('hex')
                .substring(0, 8)
                .toUpperCase();

            if (signature === expectedSignature) {
                // 验证成功！返回有效期和胶片数量
                let days = 0;
                if (prefix === 'M') days = 30;
                else if (prefix === 'Y') days = 365;
                else if (prefix === 'P') days = 9999;

                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + days);

                return res.json({
                    success: true,
                    type: fullType,
                    days: days,
                    expiryDate: expiryDate.toISOString().split('T')[0],
                    filmAmount: filmAmount  // 🆕 返回赠送胶片数量
                });
            } else {
                return res.json({ success: false, message: '激活码无效' });
            }

        } catch (e) {
            console.error('Verify Error:', e);
            return res.json({ success: false, message: '验证出错' });
        }
    }
    // ============================================================

    // ==================== 🔍 内部联网搜索（无需API Key） ====================
    const _internalAction = requestBody?.action || req.query?.action;
    
    // Tavily Search API - 专业联网搜索
    async function callTavilySearch(query, count = 5) {
        const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
        if (!TAVILY_API_KEY) {
            return null; // 没有配置 Tavily API Key，降级使用其他搜索
        }
        
        try {
            console.log('[tavily-search] 调用 Tavily API');
            const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TAVILY_API_KEY}`
                },
                body: JSON.stringify({
                    query,
                    search_depth: 'basic',
                    max_results: count,
                    include_answer: true,
                    include_images: false
                }),
                signal: AbortSignal.timeout(10000)
            });
            
            if (!response.ok) {
                console.error('[tavily-search] Tavily API 错误:', response.status);
                return null;
            }
            
            const data = await response.json();
            console.log('[tavily-search] Tavily API 响应成功');
            
            return {
                answer: data.answer || '',
                results: (data.results || []).slice(0, count).map((r, i) => ({
                    title: r.title || '无标题',
                    url: r.url || '',
                    content: r.content || '',
                    score: 0.95 - i * 0.02
                }))
            };
        } catch (e) {
            console.error('[tavily-search] Tavily API 调用失败:', e.message);
            return null;
        }
    }
    
    if (_internalAction === 'web-search' || _internalAction === 'tavily-search') {
        const { query, count = 5 } = requestBody || {};
        if (!query) {
            return res.status(400).json({ success: false, error: 'MISSING_QUERY', message: '缺少 query 参数' });
        }
        try {
            let searchResults = [];
            let answer = '';
            
            if (_internalAction === 'tavily-search' || _internalAction === 'web-search') {
                const tavilyResult = await callTavilySearch(query, count);
                if (tavilyResult) {
                    searchResults = tavilyResult.results;
                    answer = tavilyResult.answer;
                }
            }
            
            if (searchResults.length === 0) {
                const searchEngines = [
                    `https://search.sapti.me/search?q=${encodeURIComponent(query)}&format=json&language=zh-CN`,
                    `https://search.bus-hit.me/search?q=${encodeURIComponent(query)}&format=json&language=zh-CN`,
                    `https://search.projectsegfault.com/search?q=${encodeURIComponent(query)}&format=json&language=zh-CN`
                ];
                for (const searchUrl of searchEngines) {
                    try {
                        const sr = await fetch(searchUrl, {
                            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
                            signal: AbortSignal.timeout(8000)
                        });
                        if (sr.ok) {
                            const data = await sr.json();
                            if (data.results && Array.isArray(data.results) && data.results.length > 0) {
                                searchResults = data.results.slice(0, count).map((r, i) => ({
                                    title: r.title || '无标题',
                                    url: r.url || r.link || '',
                                    content: r.content || r.snippet || '',
                                    score: 0.9 - i * 0.05
                                }));
                                break;
                            }
                        }
                    } catch (e) { continue; }
                }
            }
            
            if (searchResults.length === 0) {
                searchResults = [
                    { title: `在 DuckDuckGo 搜索 "${query}"`, url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`, content: '点击链接查看搜索结果', score: 0.9 },
                    { title: `在 Bing 搜索 "${query}"`, url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`, content: '点击链接查看搜索结果', score: 0.85 }
                ];
            }
            
            return res.json({ 
                success: true, 
                data: { 
                    results: searchResults, 
                    query,
                    answer: answer || `关于 "${query}" 的搜索结果：`
                } 
            });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    }
    // ============================================================

    // ==================== 🐟 MiroFish 群体智能预测接口 ====================
    const mirofishAction = requestBody?.action_mirofish || req.query?.action_mirofish;
    if (mirofishAction) {
        console.log('[mirofish] 收到请求:', mirofishAction);

        // 需要用户认证
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: '需要用户认证'
            });
        }

        const token = authHeader.split(' ')[1];
        let userId;

        // 验证 Supabase token
        try {
            const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': SUPABASE_SERVICE_KEY
                }
            });

            if (!verifyRes.ok) {
                return res.status(401).json({
                    success: false,
                    error: 'INVALID_TOKEN',
                    message: '无效的认证令牌'
                });
            }

            const user = await verifyRes.json();
            userId = user.id;
        } catch (error) {
            console.error('[mirofish] 用户认证失败:', error);
            return res.status(401).json({
                success: false,
                error: 'AUTH_FAILED',
                message: '用户认证失败'
            });
        }

        try {
            const result = await handleMiroFish(mirofishAction, req, res, userId);
            return res.json(result);
        } catch (error) {
            console.error('[mirofish] 处理失败:', error);
            return res.status(500).json({
                success: false,
                error: 'MIROFISH_ERROR',
                message: error.message
            });
        }
    }
    // ============================================================

    // ==================== 🆕 对外公开API ====================
    if (type === 'public-api') {
        const action = requestBody?.action || req.query?.action;
        console.log('[public-api] 收到请求 action:', action);
        const startTime = Date.now();

        try {
            // ==================== API Key管理接口（需要用户认证） ====================
            if (['create-key', 'list-keys', 'revoke-key', 'key-stats', 'call-logs'].includes(action)) {
                const userId = requestBody?.userId || req.query?.userId;
                if (!userId) {
                    return res.status(401).json({
                        success: false,
                        error: 'UNAUTHORIZED',
                        message: '需要用户认证'
                    });
                }

                // 1. 创建API Key
                if (action === 'create-key') {
                    const { keyName, quotaLimit = 1000 } = requestBody || {};
                    if (!keyName) {
                        return res.status(400).json({
                            success: false,
                            error: 'MISSING_PARAMS',
                            message: '缺少 keyName 参数'
                        });
                    }
                    const result = await supabaseRpc('create_api_key', {
                        p_user_id: userId,
                        p_key_name: keyName,
                        p_quota_limit: quotaLimit
                    });
                    const row = result[0];
                    return res.json({
                        success: true,
                        message: 'API Key创建成功',
                        data: {
                            api_key: row.out_api_key,
                            key_prefix: row.out_key_prefix,
                            id: row.out_id
                        }
                    });
                }

                // 2. 列出API Keys
                if (action === 'list-keys') {
                    const keys = await supabaseQuery('api_keys', {
                        user_id: `eq.${userId}`,
                        select: 'id,key_name,key_prefix,status,quota_limit,quota_used,quota_reset_at,last_used_at,created_at',
                        order: 'created_at.desc'
                    });
                    return res.json({ success: true, data: keys });
                }

                // 3. 撤销API Key
                if (action === 'revoke-key') {
                    const { keyId } = requestBody || {};
                    if (!keyId) {
                        return res.status(400).json({
                            success: false,
                            error: 'MISSING_PARAMS',
                            message: '缺少 keyId 参数'
                        });
                    }
                    await supabaseUpdate('api_keys', { status: 'revoked' }, {
                        id: `eq.${keyId}`,
                        user_id: `eq.${userId}`
                    });
                    return res.json({ success: true, message: 'API Key已撤销' });
                }

                // 4. API Key统计
                if (action === 'key-stats') {
                    const { keyId } = requestBody || {};
                    const logs = await supabaseQuery('api_call_logs', {
                        api_key_id: `eq.${keyId}`,
                        select: 'count',
                        order: 'created_at.desc'
                    });
                    return res.json({ success: true, data: { totalCalls: logs.length } });
                }

                // 5. 调用日志
                if (action === 'call-logs') {
                    const { keyId, limit = 50 } = requestBody || {};
                    const logs = await supabaseQuery('api_call_logs', {
                        api_key_id: `eq.${keyId}`,
                        select: '*',
                        order: 'created_at.desc',
                        limit: limit
                    });
                    return res.json({ success: true, data: logs });
                }
            }

            // ==================== 公共API接口（需要API Key验证） ====================
            // 支持多种方式获取API Key：
            // 1. Authorization header (Bearer token)
            // 2. x-api-key header
            // 3. requestBody.apiKey
            // 4. requestBody.authorization
            // 5. query参数 apiKey
            let apiKey = null;

            const authHeader = req.headers.authorization;
            const xApiKeyHeader = req.headers['x-api-key'];

            if (authHeader && authHeader.startsWith('Bearer ')) {
                apiKey = authHeader.substring(7);
            } else if (xApiKeyHeader) {
                apiKey = xApiKeyHeader;
            } else if (requestBody?.apiKey) {
                apiKey = requestBody.apiKey;
            } else if (requestBody?.authorization) {
                apiKey = requestBody.authorization;
            } else if (req.query?.apiKey) {
                apiKey = req.query.apiKey;
            }

            // 除了health外，其他接口都需要API Key
            if (action !== 'health' && !apiKey) {
                return res.status(401).json({
                    success: false,
                    error: 'MISSING_API_KEY',
                    message: '缺少API Key，请通过以下任一方式提供：Authorization header (Bearer token), x-api-key header, requestBody.apiKey, 或 query参数apiKey'
                });
            }

            let authResult = { valid: true, user_id: null, key_id: null, quota_remaining: 99999 };
            if (apiKey) {
                authResult = await validateApiKey(apiKey);
                if (!authResult.valid) {
                    return res.status(401).json({
                        success: false,
                        error: 'INVALID_API_KEY',
                        message: '无效的API Key'
                    });
                }
                if (authResult.quota_remaining <= 0) {
                    return res.status(429).json({
                        success: false,
                        error: 'QUOTA_EXCEEDED',
                        message: 'API调用配额已用完'
                    });
                }
            }

            // 1. 健康检查
            if (action === 'health') {
                const responseTime = Date.now() - startTime;
                if (apiKey) {
                    await logApiCall(authResult.key_id, authResult.user_id, 'health', requestBody, 200, true, null, responseTime, 0);
                }
                return res.json({
                    success: true,
                    message: 'AI Video Batch API is running',
                    version: '9.2.0',
                    timestamp: Date.now(),
                    quotaRemaining: apiKey ? authResult.quota_remaining : undefined
                });
            }

            // 2. 获取技能列表
            if (action === 'skills') {
                const responseTime = Date.now() - startTime;
                await logApiCall(authResult.key_id, authResult.user_id, 'skills', requestBody, 200, true, null, responseTime, 0);
                return res.json({
                    success: true,
                    data: [
                        { id: 'batch_short_video', name: '批量视频生成', category: 'video', description: '输入主题，批量生成多条短视频，支持并行生成和风格统一', filmCost: 20 },
                        { id: 'continuous_story_video', name: '连续剧情视频', category: 'video', description: '生成有剧情连贯性的系列视频，适合连续剧、系列故事', filmCost: 25 },
                        { id: 'batch_image_to_video', name: '图生视频批量', category: 'video', description: '上传多张图片，批量转换为动态视频', filmCost: 15 },
                        { id: 'style_consistent_images', name: '风格统一出图', category: 'image', description: '指定一种风格，批量生成多张风格一致的图片', filmCost: 5 },
                        { id: 'character_design_pack', name: '角色设定包', category: 'image', description: '输入角色描述，生成完整的角色设定包', filmCost: 6 },
                        { id: 'comic_storyboard', name: '漫画分镜生成', category: 'image', description: '根据剧本/故事生成漫画分镜页面', filmCost: 5 },
                        { id: 'ai_dubbing', name: 'AI智能配音', category: 'audio', description: '输入文本，AI 自动分析内容类型，智能选择最佳音色', filmCost: 1 },
                        { id: 'ai_music', name: 'AI智能音乐', category: 'audio', description: '描述想要的音乐氛围或用途，AI 自动创作音乐', filmCost: 9 },
                        { id: 'trending_copywriting', name: '热点文案生成', category: 'content', description: '根据热点话题或关键词，批量生成多条吸引眼球的文案', filmCost: 1 },
                        { id: 'novel_to_comic', name: '小说转漫画', category: 'content', description: '将小说章节自动转换为漫画页面', filmCost: 5 },
                        { id: 'script_split', name: '脚本智能拆分', category: 'content', description: '将长脚本/剧本智能拆分为分镜、片段', filmCost: 1 },
                        { id: 'full_auto_workflow', name: '全流程自动化', category: 'automation', description: '从一个创意到完整作品的一键全自动流程', filmCost: 30 },
                        { id: 'brand_visual_system', name: '品牌视觉全案', category: 'design', description: '输入品牌名称和行业，AI 自动规划品牌策略并生成完整视觉体系', filmCost: 6 },
                        { id: 'social_media_kit', name: '社媒素材套装', category: 'design', description: '一键生成多平台适配的社媒素材', filmCost: 4 },
                        { id: 'ecommerce_complete', name: '电商全套图', category: 'design', description: '一站式生成全套电商素材', filmCost: 12 },
                        { id: 'marketing_brochure', name: '营销宣传册', category: 'design', description: '生成专业三折页宣传册', filmCost: 4 },
                        { id: 'ip_character_ecosystem', name: 'IP角色生态', category: 'design', description: '从角色设定到表情包、贴纸、周边商品、社媒头像', filmCost: 5 },
                        { id: 'storyboard_character_sheet', name: '分镜脚本和角色设定表', category: 'design', description: '上传角色参考图 + 一句话描述，AI 自动生成角色设定表和分镜脚本图', filmCost: 5 },
                        { id: 'image_ocr', name: '图片文字识别', category: 'tool', description: '使用 DeepSeek OCR 识别图片中的所有文字', filmCost: 2 }
                    ],
                    quotaRemaining: authResult.quota_remaining - 1
                });
            }

            // 3. 测试接口 - 真实的图像生成
            if (action === 'generate') {
                const { prompt, aspectRatio = '1:1', model = 'nano-banana-2' } = requestBody || {};
                if (!prompt) {
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, 'generate', requestBody, 400, false, '缺少 prompt 参数', responseTime, 0);
                    return res.status(400).json({
                        success: false,
                        error: 'MISSING_PROMPT',
                        message: '缺少 prompt 参数'
                    });
                }
                try {
                    const baseUrl = process.env.VERCEL_URL
                        ? `https://${process.env.VERCEL_URL}`
                        : 'https://www.rollroll.art';

                    const proxyResponse = await fetch(`${baseUrl}/api/banana2`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt,
                            aspectRatio,
                            model,
                            userId: authResult.user_id,
                            skip_billing: true
                        })
                    });

                    const result = await proxyResponse.json();
                    const responseTime = Date.now() - startTime;
                    const filmConsumed = result?.data?.cost || 0;

                    await logApiCall(authResult.key_id, authResult.user_id, 'generate', requestBody, proxyResponse.status, result.success !== false, result.error || null, responseTime, filmConsumed);

                    if (filmConsumed > 0 && result.success !== false) {
                        try {
                            await __billingPublic('consume', authResult.user_id, filmConsumed, `图像生成:${model}`);
                        } catch (billingErr) {
                            console.warn('[generate] 扣费失败:', billingErr.message);
                        }
                    }

                    return res.json({
                        success: true,
                        data: result,
                        quotaRemaining: authResult.quota_remaining - 1
                    });
                } catch (proxyError) {
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, 'generate', requestBody, 500, false, proxyError.message, responseTime, 0);
                    return res.status(500).json({
                        success: false,
                        error: 'GENERATE_ERROR',
                        message: `图像生成失败: ${proxyError.message}`
                    });
                }
            }

            // 4. 获取项目信息
            if (action === 'info') {
                const responseTime = Date.now() - startTime;
                await logApiCall(authResult.key_id, authResult.user_id, 'info', requestBody, 200, true, null, responseTime, 0);
                return res.json({
                    success: true,
                    data: {
                        name: 'ai-video-batch',
                        version: '9.2.0',
                        description: 'RollRoll AI - 手机版完整功能集',

                        // 手机版独立功能页面
                        standaloneTools: [
                            { id: 'knolling', name: '提示词', icon: '📝', page: 'knolling.html' },
                            { id: 'banana', name: '画图', icon: '🎨', page: 'banana.html' },
                            { id: 'music', name: '音乐', icon: '🎵', page: 'music.html' },
                            { id: 'video-tools', name: '视频', icon: '🎬', page: 'video-tools.html' },
                            { id: 'chat', name: '对话', icon: '💬', page: 'chat.html' },
                            { id: 'writing', name: '写作', icon: '✍️', page: 'writing.html' },
                            { id: 'sticker', name: '表情包', icon: '😀', page: 'sticker.html' },
                            { id: 'video-continuity', name: '分镜', icon: '🎞️', page: 'video-continuity.html' },
                            { id: 'sketchpad', name: '涂鸦', icon: '✏️', page: 'sketchpad.html' },
                            { id: 'prompt-fill', name: '填空', icon: '🧩', page: 'prompt-fill.html' },
                            { id: 'library', name: '素材库', icon: '📚', page: 'library.html' },
                            { id: 'character-library', name: '角色库', icon: '👤', internal: true },
                            { id: 'mv-generator', name: '音乐MV', icon: '🎵', internal: true },
                            { id: 'voice', name: '配音', icon: '🎤', page: 'voice.html' },
                            { id: 'sora2-character', name: 'Sora2角色', icon: '🎭', internal: true }
                        ],

                        // 主要模式
                        mainModes: [
                            { id: 'video', name: 'AI视频', icon: '🎬' },
                            { id: 'comic', name: 'AI漫画', icon: '📖' }
                        ],

                        // 技能系统（19个）
                        skillCategories: {
                            'video': [
                                { id: 'batch_short_video', name: '批量视频生成', filmCost: 20 },
                                { id: 'continuous_story_video', name: '连续剧情视频', filmCost: 25 },
                                { id: 'batch_image_to_video', name: '图生视频批量', filmCost: 15 }
                            ],
                            'image': [
                                { id: 'style_consistent_images', name: '风格统一出图', filmCost: 5 },
                                { id: 'character_design_pack', name: '角色设定包', filmCost: 6 },
                                { id: 'comic_storyboard', name: '漫画分镜生成', filmCost: 5 }
                            ],
                            'audio': [
                                { id: 'ai_dubbing', name: 'AI智能配音', filmCost: 1 },
                                { id: 'ai_music', name: 'AI智能音乐', filmCost: 9 }
                            ],
                            'content': [
                                { id: 'trending_copywriting', name: '热点文案生成', filmCost: 1 },
                                { id: 'novel_to_comic', name: '小说转漫画', filmCost: 5 },
                                { id: 'script_split', name: '脚本智能拆分', filmCost: 1 }
                            ],
                            'automation': [
                                { id: 'full_auto_workflow', name: '全流程自动化', filmCost: 30 }
                            ],
                            'design': [
                                { id: 'brand_visual_system', name: '品牌视觉全案', filmCost: 6 },
                                { id: 'social_media_kit', name: '社媒素材套装', filmCost: 4 },
                                { id: 'ecommerce_complete', name: '电商全套图', filmCost: 12 },
                                { id: 'marketing_brochure', name: '营销宣传册', filmCost: 4 },
                                { id: 'ip_character_ecosystem', name: 'IP角色生态', filmCost: 5 },
                                { id: 'storyboard_character_sheet', name: '分镜脚本和角色设定表', filmCost: 5 }
                            ],
                            'tool': [
                                { id: 'image_ocr', name: '图片文字识别', filmCost: 2 }
                            ]
                        },

                        // 填空模板（100+个）
                        fillTemplates: {
                            count: 100,
                            categories: [
                                '梦幻光效', '动漫风格', '樱花场景', '史诗战斗', '月光夜景',
                                '多重身份', '房间设计', 'Q版可爱', '彩虹渐变', '复古胶片',
                                '像素游戏', '水下世界', '赛博朋克', '森林精灵', '油画艺术',
                                '超级英雄', '马戏团', '中世纪', '中国风', '表情包',
                                '印象派', '京剧脸谱', '女超人', '月亮公主', '太阳神',
                                '小丑女', '星际战士', '蝙蝠侠', '蜘蛛侠', '猫耳娘',
                                '狐狸精', '狼人', '吸血鬼', '幽灵', '机器人',
                                'Lolita', '摇滚', '图书馆', '咖啡馆', '独角兽',
                                '女武士', '精灵弓箭手', '魔法少女', '绅士', '皇室贵族',
                                '毕业纪念', '职场精英', '甜品师', '向日葵', '麦田',
                                '沙漠探险', '雪山登顶', '火山', '时空漩涡', '烟花',
                                '城市夜景', '蒸汽朋克', '小丑', '旋转木马', '摩天轮',
                                '过山车', '杂技', '射箭', '足球', '篮球', '网球',
                                '游泳', '自行车', '瑜伽', 'SPA', '美甲',
                                '化妆', '时装走秀', '摄影师', '导演', '歌手',
                                '钢琴', '小提琴', '架子鼓', 'DJ', '拉面师傅',
                                '寿司大师', '蛋糕装饰', '披萨制作', '圣诞视频', '春节视频',
                                '圣诞贺卡', '圣诞红包', '春节贺卡', '春节红包', 'Knolling',
                                '人物关系图', 'Y2K海报', '极简黑白', '人物名片', '钥匙扣',
                                'Cosplay', '角色设定', '手办场景', 'LINE表情包', '吉卜力',
                                'Pixar', '赛博朋克', '水彩', '油画', '像素',
                                '照片转动漫', '照片增强', '复古胶片', '专业人像', '街头摄影',
                                '胶片质感', '微距特写', '圣诞节', '春节', '情人节',
                                '万圣节', '印象派', '超现实主义', '波普艺术', '水墨画',
                                '游戏UI', '游戏卡牌', 'App图标', '文字形状', '象形图',
                                '信息图表', '房间改造', '微缩世界', '年龄变换', '内心小孩',
                                '时尚模特', '毛绒玩具', '珐琅徽章', '纹身设计'
                            ]
                        },

                        // 视频生成模型
                        videoModels: [
                            { id: 'text-to-video', name: 'Sora-2 (文生视频)', series: 'Sora' },
                            { id: 'image-to-video', name: 'Flux + Sora-2 (图生视频)', series: 'Sora' },
                            { id: 'banana-image-to-video', name: 'Gemini-3 + Sora-2 (图生视频)', series: 'Sora' },
                            { id: 'banana-grid-to-video', name: '网格图省费版 (1图切N分镜)', series: 'Sora' },
                            { id: 'veo3.1-components-4k', name: 'Veo 3.1 4K (推荐)', series: 'Veo' },
                            { id: 'veo_3_1-fast-4K', name: 'Veo 3.1 Fast 4K (快速)', series: 'Veo' },
                            { id: 'veo_3_1-fast-components-4K', name: 'veo_3_1-fast-components-4K', series: 'Veo' },
                            { id: 'vidu-q2-5s-720p', name: 'Vidu q2 5秒 720P (25胶片)', series: 'Vidu', duration: '5s' },
                            { id: 'vidu-q2-5s-1080p', name: 'Vidu q2 5秒 1080P (36胶片)', series: 'Vidu', duration: '5s' },
                            { id: 'vidu-q2-pro-5s-720p', name: 'Vidu q2-pro 5秒 720P (27胶片)', series: 'Vidu', duration: '5s' },
                            { id: 'vidu-q2-pro-5s-1080p', name: 'Vidu q2-pro 5秒 1080P (54胶片)', series: 'Vidu', duration: '5s' },
                            { id: 'vidu-q2-turbo-5s-720p', name: 'Vidu q2-turbo 5秒 720P (19胶片/最快)', series: 'Vidu', duration: '5s' },
                            { id: 'vidu-q2-turbo-5s-1080p', name: 'Vidu q2-turbo 5秒 1080P (36胶片)', series: 'Vidu', duration: '5s' },
                            { id: 'vidu-q3-pro-5s-720p', name: 'Vidu q3-pro 5秒 720P (72胶片/顶级)', series: 'Vidu', duration: '5s' },
                            { id: 'vidu-q3-pro-5s-1080p', name: 'Vidu q3-pro 5秒 1080P (77胶片/顶级)', series: 'Vidu', duration: '5s' },
                            { id: 'vidu-q2-10s-720p', name: 'Vidu q2 10秒 720P (50胶片)', series: 'Vidu', duration: '10s' },
                            { id: 'vidu-q2-10s-1080p', name: 'Vidu q2 10秒 1080P (72胶片)', series: 'Vidu', duration: '10s' },
                            { id: 'vidu-q2-pro-10s-720p', name: 'Vidu q2-pro 10秒 720P (54胶片)', series: 'Vidu', duration: '10s' },
                            { id: 'vidu-q2-pro-10s-1080p', name: 'Vidu q2-pro 10秒 1080P (108胶片)', series: 'Vidu', duration: '10s' },
                            { id: 'vidu-q2-turbo-10s-720p', name: 'Vidu q2-turbo 10秒 720P (38胶片)', series: 'Vidu', duration: '10s' },
                            { id: 'vidu-q2-turbo-10s-1080p', name: 'Vidu q2-turbo 10秒 1080P (72胶片)', series: 'Vidu', duration: '10s' },
                            { id: 'vidu-q3-pro-10s-720p', name: 'Vidu q3-pro 10秒 720P (144胶片/顶级)', series: 'Vidu', duration: '10s' },
                            { id: 'vidu-q3-pro-10s-1080p', name: 'Vidu q3-pro 10秒 1080P (154胶片/顶级)', series: 'Vidu', duration: '10s' },
                            { id: 'hailuo-02-768p-6s', name: '海螺 02 6秒 768P (7胶片)', series: 'Hailuo', duration: '6s' },
                            { id: 'hailuo-02-1080p-6s', name: '海螺 02 6秒 1080P (12胶片)', series: 'Hailuo', duration: '6s' },
                            { id: 'hailuo-fast-768p-6s', name: '海螺 Fast 6秒 768P (5胶片/最快)', series: 'Hailuo', duration: '6s' },
                            { id: 'hailuo-fast-1080p-6s', name: '海螺 Fast 6秒 1080P (8胶片)', series: 'Hailuo', duration: '6s' },
                            { id: 'hailuo-02-768p-10s', name: '海螺 02 10秒 768P (11胶片)', series: 'Hailuo', duration: '10s' },
                            { id: 'hailuo-02-1080p-10s', name: '海螺 02 10秒 1080P (20胶片)', series: 'Hailuo', duration: '10s' },
                            { id: 'hailuo-fast-768p-10s', name: '海螺 Fast 10秒 768P (8胶片)', series: 'Hailuo', duration: '10s' },
                            { id: 'hailuo-fast-1080p-10s', name: '海螺 Fast 10秒 1080P (13胶片)', series: 'Hailuo', duration: '10s' },
                            { id: 'kling-2.5-720p-5s', name: '可灵 2.5 5秒 720P (5胶片/性价比)', series: 'Kling', duration: '5s' },
                            { id: 'kling-2.5-1080p-5s', name: '可灵 2.5 5秒 1080P (9胶片)', series: 'Kling', duration: '5s' },
                            { id: 'kling-2.0-720p-5s', name: '可灵 2.0 5秒 720P (7胶片)', series: 'Kling', duration: '5s' },
                            { id: 'kling-2.0-1080p-5s', name: '可灵 2.0 5秒 1080P (12胶片)', series: 'Kling', duration: '5s' },
                            { id: 'kling-o1-720p-5s', name: '可灵 O1 5秒 720P (15胶片/顶级)', series: 'Kling', duration: '5s' },
                            { id: 'kling-o1-1080p-5s', name: '可灵 O1 5秒 1080P (20胶片)', series: 'Kling', duration: '5s' },
                            { id: 'kling-2.5-720p-10s', name: '可灵 2.5 10秒 720P (10胶片)', series: 'Kling', duration: '10s' },
                            { id: 'kling-2.5-1080p-10s', name: '可灵 2.5 10秒 1080P (17胶片)', series: 'Kling', duration: '10s' },
                            { id: 'kling-2.0-720p-10s', name: '可灵 2.0 10秒 720P (14胶片)', series: 'Kling', duration: '10s' },
                            { id: 'kling-2.0-1080p-10s', name: '可灵 2.0 10秒 1080P (24胶片)', series: 'Kling', duration: '10s' },
                            { id: 'kling-o1-720p-10s', name: '可灵 O1 10秒 720P (31胶片)', series: 'Kling', duration: '10s' },
                            { id: 'kling-o1-1080p-10s', name: '可灵 O1 10秒 1080P (41胶片)', series: 'Kling', duration: '10s' },
                            { id: 'grok-video-3-text', name: 'Grok Video 3 6秒 (文生视频)', series: 'Grok', duration: '6s' },
                            { id: 'grok-video-3', name: 'Grok Video 3 6秒 (图生视频)', series: 'Grok', duration: '6s' },
                            { id: 'grok-video-3-10s-text', name: 'Grok Video 3 10秒 (文生视频)', series: 'Grok', duration: '10s' },
                            { id: 'grok-video-3-10s', name: 'Grok Video 3 10秒 (图生视频)', series: 'Grok', duration: '10s' },
                            { id: 'grok-video-3-15s-text', name: 'Grok Video 3 15秒 (文生视频)', series: 'Grok', duration: '15s' },
                            { id: 'grok-video-3-15s', name: 'Grok Video 3 15秒 (图生视频)', series: 'Grok', duration: '15s' },
                            { id: 'video-continuity', name: '连续性视频 (逐帧衔接)', series: 'Continuity' }
                        ],

                        // 图像生成模型
                        imageModels: [
                            { id: 'modelscope', name: '智能绘图（推荐、免费）', filmCost: 0 },
                            { id: 'nano-banana-2', name: 'Banana 标准版 (0.7胶片)', filmCost: 0.7 },
                            { id: 'nano-banana-2-2k', name: 'Banana 2K 超清 (0.7胶片)', filmCost: 0.7 },
                            { id: 'nano-banana-2-4k', name: 'Banana 4K 顶级 (1.2胶片)', filmCost: 1.2 },
                            { id: 'doubao-seedream-4-5-251128', name: '星梦画师（文/图生图）', filmCost: 7 },
                            { id: 'Qwen/Qwen-Image-2512', name: '通义万相Max (8胶片)', filmCost: 8 },
                            { id: 'midjourney-fast', name: 'Midjourney Fast (2胶片)', filmCost: 2 },
                            { id: 'midjourney-turbo', name: 'Midjourney Turbo (2胶片)', filmCost: 2 },
                            { id: 'midjourney-relax', name: 'Midjourney Relax (2胶片)', filmCost: 2 }
                        ],

                        // 漫画风格
                        comicStyles: [
                            { id: 'japanese', name: '日式漫画' },
                            { id: 'japaneseColor', name: '日式彩漫' },
                            { id: 'american', name: '美式漫画' },
                            { id: 'korean', name: '韩式条漫' },
                            { id: 'shagou', name: '沙雕漫画' },
                            { id: 'children', name: '儿童绘本' }
                        ],

                        // 运镜选项
                        cameraMoves: [
                            { key: '35mm_wide', label: '35mm广角建立' },
                            { key: '50mm_medium', label: '50mm中景叙事' },
                            { key: '85mm_closeup', label: '85mm人像特写浅景深' },
                            { key: 'handheld', label: '手持纪实轻微晃动' },
                            { key: 'steadicam', label: '斯坦尼康平滑推进' },
                            { key: 'push', label: '推镜头强调情绪' },
                            { key: 'pull', label: '拉镜头揭示环境' },
                            { key: 'orbit', label: '环绕镜头360度旋转' }
                        ],

                        // 发布平台
                        publishPlatforms: [
                            { id: 'xiaohongshu', name: '小红书', icon: '📕' },
                            { id: 'douyin', name: '抖音', icon: '🎵' },
                            { id: 'weibo', name: '微博', icon: '🌐' },
                            { id: 'gongzhonghao', name: '公众号', icon: '💬' },
                            { id: 'bilibili', name: 'B站', icon: '📺' },
                            { id: 'kuaishou', name: '快手', icon: '⚡' }
                        ],

                        // 作品管理
                        worksManagement: {
                            filters: ['all', 'video', 'comic', 'completed', 'processing', 'skill'],
                            features: ['sync', 'view', 'share', 'retry', 'delete']
                        },

                        // 交互功能
                        interactiveFeatures: [
                            '下拉刷新',
                            '左滑删除/分享',
                            '长按菜单',
                            '双指缩放图片预览',
                            '手势操作'
                        ],

                        // 可用API接口
                        availableApis: [
                            'yunwu', 'banana2', 'modelscope', 'sora2', 'suno',
                            'writer-llm', 'video-continuity', 'mv-merge', 'supabase-proxy'
                        ]
                    },
                    quotaRemaining: authResult.quota_remaining - 1
                });
            }





            // ========== 🎤 配音功能接口 ==========
            const ttsActions = ['tts-voices', 'tts-generate', 'tts-poll', 'gemini-tts', 'kling-tts', 'kling-tts-poll', 'vc-list', 'vc-create', 'vc-poll', 'speech-to-text', 'kling-custom-voice', 'kling-custom-voice-query'];
            if (ttsActions.includes(action)) {
                try {
                    const baseUrl = process.env.VERCEL_URL
                        ? `https://${process.env.VERCEL_URL}`
                        : 'https://www.rollroll.art';

                    const proxyResponse = await fetch(`${baseUrl}/api/yunwu`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            ...requestBody,
                            action,
                            userId: authResult.user_id,
                            skip_billing: true
                        })
                    });

                    const result = await proxyResponse.json();
                    const responseTime = Date.now() - startTime;

                    let filmConsumed = 0;
                    if (action === 'tts-generate') filmConsumed = 2;
                    else if (action === 'gemini-tts') {
                        filmConsumed = requestBody.model === 'pro' ? 3 : 1;
                    } else if (action === 'kling-tts') filmConsumed = 2;
                    else if (action === 'vc-create') filmConsumed = 2;
                    else if (action === 'speech-to-text') filmConsumed = 1;
                    else if (action === 'kling-custom-voice') filmConsumed = 5;

                    await logApiCall(authResult.key_id, authResult.user_id, `tts-${action}`, requestBody, proxyResponse.status, result.success !== false, result.error || null, responseTime, filmConsumed);

                    if (filmConsumed > 0 && result.success !== false) {
                        try {
                            await __billingPublic('consume', authResult.user_id, filmConsumed, `TTS配音:${action}`);
                        } catch (billingErr) {
                            console.warn('[TTS] 扣费失败:', billingErr.message);
                        }
                    }

                    return res.json({
                        success: true,
                        data: result,
                        quotaRemaining: authResult.quota_remaining - 1
                    });
                } catch (proxyError) {
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, `tts-${action}`, requestBody, 500, false, proxyError.message, responseTime, 0);
                    return res.status(500).json({
                        success: false,
                        error: 'TTS_ERROR',
                        message: `配音功能请求失败: ${proxyError.message}`
                    });
                }
            }

            // 7. 文生视频
            if (action === 'text-to-video') {
                const { prompt, model, aspect_ratio, seconds, size, ...otherParams } = requestBody || {};
                // 🔧 去掉 -text 后缀
                const cleanModel = model ? model.replace(/-text$/, '') : undefined;
                if (!prompt) {
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, 'text-to-video', requestBody, 400, false, '缺少 prompt 参数', responseTime, 0);
                    return res.status(400).json({
                        success: false,
                        error: 'MISSING_PROMPT',
                        message: '缺少 prompt 参数'
                    });
                }

                try {
                    const baseUrl = process.env.VERCEL_URL
                        ? `https://${process.env.VERCEL_URL}`
                        : 'https://www.rollroll.art';

                    const proxyResponse = await fetch(`${baseUrl}/api/sora2`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'text-to-video',
                            prompt,
                            model: cleanModel || 'grok-video-3',
                            aspect_ratio,
                            seconds,
                            size,
                            ...otherParams,
                            userId: authResult.user_id,
                            skip_billing: true
                        })
                    });

                    const result = await proxyResponse.json();
                    const responseTime = Date.now() - startTime;
                    const filmConsumed = result?.data?.cost || 7;

                    await logApiCall(authResult.key_id, authResult.user_id, 'text-to-video', requestBody, proxyResponse.status, true, null, responseTime, filmConsumed);

                    if (filmConsumed > 0) {
                        try {
                            await __billingPublic('consume', authResult.user_id, filmConsumed, `文生视频:${model || 'sora-2-vip-all'}`);
                        } catch (billingErr) {
                            console.warn('[text-to-video] 扣费失败:', billingErr.message);
                        }
                    }

                    return res.json({
                        success: true,
                        data: result,
                        quotaRemaining: authResult.quota_remaining - 1
                    });
                } catch (proxyError) {
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, 'text-to-video', requestBody, 500, false, proxyError.message, responseTime, 0);
                    return res.status(500).json({
                        success: false,
                        error: 'VIDEO_ERROR',
                        message: `文生视频请求失败: ${proxyError.message}`
                    });
                }
            }

            // 8. 图生视频
            if (action === 'image-to-video') {
                const { image_url, prompt, model, image_weight, motion_intensity, preserve_subject, ...otherParams } = requestBody || {};
                // 🔧 去掉 -text 后缀
                const cleanModel = model ? model.replace(/-text$/, '') : undefined;
                if (!image_url) {
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, 'image-to-video', requestBody, 400, false, '缺少 image_url 参数', responseTime, 0);
                    return res.status(400).json({
                        success: false,
                        error: 'MISSING_IMAGE_URL',
                        message: '缺少 image_url 参数'
                    });
                }

                try {
                    const baseUrl = process.env.VERCEL_URL
                        ? `https://${process.env.VERCEL_URL}`
                        : 'https://www.rollroll.art';

                    const proxyResponse = await fetch(`${baseUrl}/api/sora2`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'image-to-video',
                            image_url,
                            prompt,
                            model: cleanModel || 'grok-video-3',
                            image_weight: image_weight || 0.98,
                            motion_intensity,
                            preserve_subject: preserve_subject !== false,
                            ...otherParams,
                            userId: authResult.user_id,
                            skip_billing: true
                        })
                    });

                    const result = await proxyResponse.json();
                    const responseTime = Date.now() - startTime;
                    const filmConsumed = result?.data?.cost || 7;

                    await logApiCall(authResult.key_id, authResult.user_id, 'image-to-video', requestBody, proxyResponse.status, true, null, responseTime, filmConsumed);

                    if (filmConsumed > 0) {
                        try {
                            await __billingPublic('consume', authResult.user_id, filmConsumed, `图生视频:${model || 'sora-image'}`);
                        } catch (billingErr) {
                            console.warn('[image-to-video] 扣费失败:', billingErr.message);
                        }
                    }

                    return res.json({
                        success: true,
                        data: result,
                        quotaRemaining: authResult.quota_remaining - 1
                    });
                } catch (proxyError) {
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, 'image-to-video', requestBody, 500, false, proxyError.message, responseTime, 0);
                    return res.status(500).json({
                        success: false,
                        error: 'VIDEO_ERROR',
                        message: `图生视频请求失败: ${proxyError.message}`
                    });
                }
            }

            // 9. 轮询视频任务状态
            if (action === 'poll') {
                const { task_id, ...otherParams } = requestBody || {};
                if (!task_id) {
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, 'poll', requestBody, 400, false, '缺少 task_id 参数', responseTime, 0);
                    return res.status(400).json({
                        success: false,
                        error: 'MISSING_TASK_ID',
                        message: '缺少 task_id 参数'
                    });
                }

                try {
                    const baseUrl = process.env.VERCEL_URL
                        ? `https://${process.env.VERCEL_URL}`
                        : 'https://www.rollroll.art';

                    const proxyResponse = await fetch(`${baseUrl}/api/sora2`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'poll',
                            task_id,
                            ...otherParams,
                            userId: authResult.user_id
                        })
                    });

                    const result = await proxyResponse.json();
                    const responseTime = Date.now() - startTime;

                    await logApiCall(authResult.key_id, authResult.user_id, 'poll', requestBody, proxyResponse.status, true, null, responseTime, 0);

                    return res.json({
                        success: true,
                        data: result,
                        quotaRemaining: authResult.quota_remaining - 1
                    });
                } catch (proxyError) {
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, 'poll', requestBody, 500, false, proxyError.message, responseTime, 0);
                    return res.status(500).json({
                        success: false,
                        error: 'POLL_ERROR',
                        message: `轮询请求失败: ${proxyError.message}`
                    });
                }
            }

            // 10. 代理到内部API - 支持项目全部功能
            if (action === 'proxy') {
                const { targetApi, ...apiParams } = requestBody || {};
                if (!targetApi) {
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, 'proxy', requestBody, 400, false, '缺少 targetApi 参数', responseTime, 0);
                    return res.status(400).json({
                        success: false,
                        error: 'MISSING_TARGET_API',
                        message: '缺少 targetApi 参数，可选值: yunwu, banana2, modelscope, sora2, suno, writer-llm, video-continuity, mv-merge'
                    });
                }

                const validApis = ['yunwu', 'banana2', 'modelscope', 'sora2', 'suno', 'writer-llm', 'video-continuity', 'mv-merge'];
                if (!validApis.includes(targetApi)) {
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, 'proxy', requestBody, 400, false, '无效的 targetApi', responseTime, 0);
                    return res.status(400).json({
                        success: false,
                        error: 'INVALID_TARGET_API',
                        message: `无效的 targetApi: ${targetApi}`,
                        validApis
                    });
                }

                try {
                    const baseUrl = process.env.VERCEL_URL
                        ? `https://${process.env.VERCEL_URL}`
                        : 'https://www.rollroll.art';

                    const proxyResponse = await fetch(`${baseUrl}/api/${targetApi}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            ...apiParams,
                            userId: authResult.user_id
                        })
                    });

                    const result = await proxyResponse.json();
                    const responseTime = Date.now() - startTime;
                    const filmConsumed = result?.data?.cost || 0;

                    await logApiCall(authResult.key_id, authResult.user_id, `proxy-${targetApi}`, requestBody, proxyResponse.status, true, null, responseTime, filmConsumed);

                    return res.json({
                        success: true,
                        data: result,
                        quotaRemaining: authResult.quota_remaining - 1
                    });
                } catch (proxyError) {
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, `proxy-${targetApi}`, requestBody, 500, false, proxyError.message, responseTime, 0);
                    return res.status(500).json({
                        success: false,
                        error: 'PROXY_ERROR',
                        message: `代理请求失败: ${proxyError.message}`
                    });
                }
            }

            // 11. 联网搜索代理
            if (action === 'web-search') {
                const { query, count = 5 } = requestBody || {};
                if (!query) {
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, 'web-search', requestBody, 400, false, '缺少 query 参数', responseTime, 0);
                    return res.status(400).json({
                        success: false,
                        error: 'MISSING_QUERY',
                        message: '缺少 query 参数'
                    });
                }

                try {
                    // 使用 SearXNG 搜索 API（开源、无需认证）
                    const searchEngines = [
                        // SearXNG 公共实例
                        `https://search.sapti.me/search?q=${encodeURIComponent(query)}&format=json&language=zh-CN`,
                        `https://search.bus-hit.me/search?q=${encodeURIComponent(query)}&format=json&language=zh-CN`,
                        `https://search.projectsegfault.com/search?q=${encodeURIComponent(query)}&format=json&language=zh-CN`,
                        // 备用：直接返回搜索链接
                        null
                    ];

                    let searchResults = [];
                    let searchError = null;

                    for (const searchUrl of searchEngines) {
                        if (!searchUrl) break; // 所有引擎都失败了

                        try {
                            console.log('[web-search] 尝试搜索引擎:', searchUrl);
                            const searchResponse = await fetch(searchUrl, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                    'Accept': 'application/json'
                                },
                                timeout: 8000
                            });

                            if (searchResponse.ok) {
                                const data = await searchResponse.json();
                                if (data.results && Array.isArray(data.results)) {
                                    searchResults = data.results.slice(0, count).map(r => ({
                                        title: r.title || '无标题',
                                        url: r.url || r.link || '',
                                        content: r.content || r.snippet || '',
                                        score: 0.9 - (searchResults.length * 0.05)
                                    }));
                                    console.log('[web-search] 搜索成功，找到', searchResults.length, '条结果');
                                    break;
                                }
                            }
                        } catch (e) {
                            console.log('[web-search] 搜索引擎失败:', searchUrl, e.message);
                            searchError = e;
                            continue; // 尝试下一个引擎
                        }
                    }

                    // 如果所有搜索引擎都失败了，返回手动构造的搜索链接
                    if (searchResults.length === 0) {
                        console.log('[web-search] 所有搜索引擎都失败，返回降级结果');
                        searchResults = [
                            {
                                title: `在 DuckDuckGo 中搜索 "${query}"`,
                                url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                                content: '点击链接在 DuckDuckGo 中查看搜索结果',
                                score: 0.9
                            },
                            {
                                title: `在 Bing 中搜索 "${query}"`,
                                url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
                                content: '点击链接在 Bing 中查看搜索结果',
                                score: 0.85
                            },
                            {
                                title: `在 Google 中搜索 "${query}"`,
                                url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                                content: '点击链接在 Google 中查看搜索结果',
                                score: 0.8
                            }
                        ];
                    }

                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, 'web-search', requestBody, 200, true, null, responseTime, 0);

                    return res.json({
                        success: true,
                        data: {
                            query,
                            answer: `关于 "${query}" 的搜索结果：`,
                            results: searchResults
                        },
                        quotaRemaining: authResult.quota_remaining - 1
                    });
                } catch (error) {
                    console.error('[web-search] 搜索代理错误:', error);
                    const responseTime = Date.now() - startTime;
                    await logApiCall(authResult.key_id, authResult.user_id, 'web-search', requestBody, 500, false, error.message, responseTime, 0);

                    // 返回降级结果
                    return res.json({
                        success: true,
                        data: {
                            query,
                            answer: `关于 "${query}" 的搜索：`,
                            results: [
                                {
                                    title: `在 DuckDuckGo 中搜索 "${query}"`,
                                    url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                                    content: '点击链接在 DuckDuckGo 中查看搜索结果',
                                    score: 0.9
                                },
                                {
                                    title: `在 Bing 中搜索 "${query}"`,
                                    url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
                                    content: '点击链接在 Bing 中查看搜索结果',
                                    score: 0.85
                                }
                            ]
                        },
                        quotaRemaining: authResult.quota_remaining - 1
                    });
                }
            }

            // 未知操作
            const responseTime = Date.now() - startTime;
            if (apiKey) {
                await logApiCall(authResult.key_id, authResult.user_id, action, requestBody, 400, false, '不支持的操作', responseTime, 0);
            }
            return res.status(400).json({
                success: false,
                error: 'INVALID_ACTION',
                message: `不支持的操作: ${action}`,
                availableActions: [
                    'health',
                    'skills',
                    'generate',
                    'info',
                    'proxy',
                    'text-to-video',
                    'image-to-video',
                    'poll',
                    'tts-voices',
                    'tts-generate',
                    'tts-poll',
                    'gemini-tts',
                    'kling-tts',
                    'kling-tts-poll',
                    'vc-list',
                    'vc-create',
                    'vc-poll',
                    'speech-to-text',
                    'kling-custom-voice',
                    'kling-custom-voice-query',
                    'web-search'
                ]
            });

        } catch (error) {
            console.error('[public-api] 错误:', error);
            return res.status(500).json({
                success: false,
                error: 'INTERNAL_ERROR',
                message: error.message
            });
        }
    }
    // ============================================================

    const config = API_CONFIG[type];

    if (!config && !urlOverride) {
        return res.status(400).json({ error: 'Invalid API Type or Target URL' });
    }

    // 3. 构建目标 URL
    let finalUrl = '';
    if (type === 'rh-flux') {
        finalUrl = 'https://www.runninghub.cn/task/openapi/create';
    } else if (type === 'rh-flux-poll') {
        finalUrl = urlOverride;
    } else if (urlOverride) {
        finalUrl = urlOverride;
    } else {
        return res.status(400).json({ error: 'MISSING_TARGET_URL', message: '缺少 targetUrl' });
    }

    // 4. 准备 headers
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
    };

    // 只有非 GET 请求才设置 Content-Type
    if (reqMethod !== 'GET' && reqMethod !== 'HEAD') {
        headers['Content-Type'] = 'application/json';
    }

    // 处理 Authorization
    // 优先使用 requestBody 中的 authorization/apiKey (前端传过来的)
    const bodyAuth = requestBody?.authorization || requestBody?.apiKey;

    if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
    } else if (bodyAuth) {
        // 如果是 Bearer 格式就直接用，否则加上 Bearer (针对 T8Star)
        if (bodyAuth.startsWith('Bearer ') || type.includes('flux')) {
            headers['Authorization'] = bodyAuth;
            // Flux 使用 "key" 或 "Authorization" 都可以，这里保持原样传
            if (type === 'rh-flux') {
                headers['uuid'] = bodyAuth; // RunningHub 有时需要 uuid
                headers['x-api-key'] = bodyAuth;
            }
        } else {
            headers['Authorization'] = `Bearer ${bodyAuth}`;
        }
    } else if (config && config.defaultKey) {
        headers['Authorization'] = `Bearer ${config.defaultKey}`;
    }

    // 5. 发起代理请求
    try {
        // 🔧 检查是否是图片请求（用于 CORS 绕过）
        const isImageRequest = reqMethod === 'GET' && (
            finalUrl.includes('aliyuncs.com') ||
            finalUrl.includes('oss-cn-') ||
            finalUrl.includes('rollroll.art') ||
            finalUrl.includes('lossloop.cn') ||
            finalUrl.includes('volces.com') ||  // 🌋 火山引擎 TOS 存储（星梦画师等）
            finalUrl.includes('volcengineapi.com') ||
            finalUrl.includes('byteimg.com') ||  // 字节跳动 CDN
            finalUrl.match(/\.(png|jpg|jpeg|gif|webp|bmp)(\?|$)/i)
        );

        if (isImageRequest) {
            // 🖼️ 图片请求：返回 base64 数据
            console.log(`🖼️ 图片代理请求: ${finalUrl.substring(0, 100)}...`);
            const imgResponse = await fetch(finalUrl, { headers });
            if (!imgResponse.ok) {
                return res.status(imgResponse.status).json({ error: 'IMAGE_FETCH_FAILED', status: imgResponse.status });
            }
            const arrayBuffer = await imgResponse.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const contentType = imgResponse.headers.get('content-type') || 'image/png';
            return res.status(200).json({
                success: true,
                dataUrl: `data:${contentType};base64,${base64}`,
                contentType: contentType
            });
        }

        const { status, data } = await fetchRequest(finalUrl, reqMethod, headers, requestBody);

        // 📝 记录非200响应日志 (方便在 Vercel 后台查看)
        if (status >= 400) {
            console.error(`⚠️ Upstream Error [${status}]:`, JSON.stringify(data).substring(0, 200));
        } else {
            console.log(`✅ Upstream Success [${status}]`);
        }

        res.status(status).json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: error.message, details: 'Proxy request failed' });
    }
}

// 辅助函数：发起请求
async function fetchRequest(url, method, headers, body) {
    let payload = body;

    // 核心修复：解包嵌套的 body
    // 前端传来的格式: { apiType, targetUrl, authorization, body: { ...realPayload } }
    if (body && body.body) {
        payload = body.body;
    } else if (body) {
        // 如果没有嵌套 body，则剔除元数据
        const { apiType, targetUrl, method: m, code, authorization, apiKey, ...rest } = body;
        payload = rest;
    }

    const options = {
        method: method,
        headers: headers,
    };

    if (method !== 'GET' && method !== 'HEAD') {
        // 确保 payload 是对象且不为空
        if (payload && Object.keys(payload).length > 0) {
            options.body = JSON.stringify(payload);
        }
    }

    console.log(`📡 Fetching: ${method} ${url}`);
    const response = await fetch(url, options);
    const text = await response.text();

    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        data = { data: text };
    }

    return { status: response.status, data };
}

// ==================== MiroFish 群体智能预测功能 ====================
/**
 * 处理 MiroFish 相关的 API 请求
 * 支持的操作: collect, predict, history, quota
 * 返回结果对象，不直接发送响应
 */
async function handleMiroFish(action, req, res, userId) {
    switch (action) {
        case 'collect':
            // 数据采集
            const { taskType, params } = req.body;
            const data = await collectMiroFishData(taskType, params);
            return data;

        case 'predict':
            // 发起预测
            const { taskType: predictTaskType, params: predictParams } = req.body;

            // 检查配额
            const quotaInfo = await checkMiroFishQuota(userId);
            if (!quotaInfo.allowed) {
                return {
                    success: false,
                    error: '今日预测次数已用完，请明天再试'
                };
            }

            // 采集数据
            const predictionData = await collectMiroFishData(predictTaskType, predictParams);

            // 保存任务记录
            await saveMiroFishTask(userId, predictTaskType, predictParams, predictionData);

            return {
                success: true,
                data: predictionData,
                message: '预测任务完成'
            };

        case 'history':
            // 获取历史记录
            const { limit = 10 } = req.query;
            const history = await getMiroFishHistory(userId, limit);
            return { success: true, history };

        case 'quota':
            // 检查配额
            const quotaCheck = await checkMiroFishQuota(userId);
            return {
                success: true,
                hasQuota: quotaCheck.allowed,
                maxDaily: 10,
                used: quotaCheck.used || 0
            };

        default:
            return {
                success: false,
                error: '未知的操作类型'
            };
    }
}

/**
 * MiroFish 数据采集
 */
async function collectMiroFishData(taskType, params) {
    switch (taskType) {
        case 'crypto':
            return await collectCryptoData(params);
        case 'weather':
            return await collectWeatherData(params);
        case 'stock':
            return await collectStockData(params);
        case 'trend':
            return await collectTrendData(params);
        default:
            return { success: false, error: `不支持的预测类型: ${taskType}` };
    }
}

/**
 * 加密货币数据采集
 */
async function collectCryptoData(params) {
    const { symbol = 'bitcoin' } = params;

    try {
        // 使用 Coingecko API (免费)
        const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`;
        const priceRes = await fetch(priceUrl);
        const priceData = await priceRes.json();

        if (priceData.error) {
            throw new Error(priceData.error);
        }

        // 获取市场数据
        const marketUrl = `https://api.coingecko.com/api/v3/coins/${symbol}/market_chart?vs_currency=usd&days=7`;
        const marketRes = await fetch(marketUrl);
        const marketData = await marketRes.json();

        return {
            success: true,
            type: 'crypto',
            symbol,
            currentPrice: priceData[symbol]?.usd || 0,
            marketData: marketData.prices || [],
            timestamp: Date.now()
        };
    } catch (error) {
        console.error('[MiroFish] Coingecko API error:', error);
        return { success: false, error: '数据采集失败，请稍后重试' };
    }
}

/**
 * 天气数据采集
 */
async function collectWeatherData(params) {
    const { location = 'Beijing' } = params;

    try {
        // 地理编码
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            return { success: false, error: '未找到该位置' };
        }

        const { latitude, longitude, name } = geoData.results[0];

        // 天气预报
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();

        return {
            success: true,
            type: 'weather',
            location: name,
            latitude,
            longitude,
            forecast: weatherData.daily?.time?.map((time, i) => ({
                date: time,
                maxTemp: weatherData.daily.temperature_2m_max[i],
                minTemp: weatherData.daily.temperature_2m_min[i],
                precipitation: weatherData.daily.precipitation_sum[i]
            })) || [],
            timestamp: Date.now()
        };
    } catch (error) {
        console.error('[MiroFish] Weather API error:', error);
        return { success: false, error: '天气数据采集失败' };
    }
}

/**
 * 股票数据采集 (使用 Alpha Vantage 或免费备选)
 */
async function collectStockData(params) {
    const { symbol = 'AAPL' } = params;

    try {
        // 使用 Alpha Vantage (demo key) 或 Yahoo Finance
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
        const apiUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data['Note']) {
            return { success: false, error: 'API调用频率超限，请稍后重试' };
        }

        const quote = data['Global Quote'] || {};

        return {
            success: true,
            type: 'stock',
            symbol,
            price: parseFloat(quote['05. price'] || '0'),
            change: parseFloat(quote['09. change'] || '0'),
            changePercent: quote['10. change percent'] || '0%',
            timestamp: Date.now()
        };
    } catch (error) {
        console.error('[MiroFish] Stock API error:', error);
        return { success: false, error: '股票数据采集失败' };
    }
}

/**
 * 趋势数据采集 (使用 Tavily 或降级方案)
 */
async function collectTrendData(params) {
    const { keyword = 'AI' } = params;

    try {
        // 尝试使用 Tavily Search
        if (process.env.TAVILY_API_KEY) {
            const tavilyUrl = 'https://api.tavily.com/search';
            const tavilyRes = await fetch(tavilyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`
                },
                body: JSON.stringify({
                    query: keyword,
                    max_results: 5,
                    search_depth: 'basic'
                })
            });

            if (tavilyRes.ok) {
                const tavilyData = await tavilyRes.json();
                return {
                    success: true,
                    type: 'trend',
                    keyword,
                    results: tavilyData.results || [],
                    timestamp: Date.now()
                };
            }
        }

        // 降级方案：返回模拟数据
        return {
            success: true,
            type: 'trend',
            keyword,
            degraded: true,
            message: '建议配置 Tavily API 获取更详细的趋势分析',
            results: [{
                title: `${keyword} 趋势分析`,
                url: `https://www.google.com/search?q=${encodeURIComponent(keyword)}`,
                content: `请手动搜索 "${keyword}" 获取最新趋势信息`
            }],
            timestamp: Date.now()
        };
    } catch (error) {
        console.error('[MiroFish] Trend API error:', error);
        return { success: false, error: '趋势数据采集失败' };
    }
}

/**
 * 检查用户每日预测配额
 */
async function checkMiroFishQuota(userId) {
    if (!userId) return { allowed: true, used: 0 };

    try {
        const today = new Date().toISOString().split('T')[0];
        const quotaUrl = `${SUPABASE_URL}/rest/v1/prediction_tasks?user_id=eq.${userId}&created_at=gte.${today}T00:00:00Z&select=count`;
        const quotaRes = await fetch(quotaUrl, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        });

        if (quotaRes.ok) {
            const result = await quotaRes.json();
            const used = result[0]?.count || 0;
            return { allowed: used < 10, used };
        }

        return { allowed: true, used: 0 };
    } catch (error) {
        console.error('[MiroFish] Quota check error:', error);
        return { allowed: true, used: 0 }; // 失败时允许继续
    }
}

/**
 * 保存预测任务
 */
async function saveMiroFishTask(userId, taskType, params, result) {
    try {
        const saveUrl = `${SUPABASE_URL}/rest/v1/prediction_tasks`;
        const saveRes = await fetch(saveUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            },
            body: JSON.stringify({
                user_id: userId,
                task_type: taskType,
                input_params: params,
                status: 'completed',
                result: result
            })
        });

        return saveRes.ok;
    } catch (error) {
        console.error('[MiroFish] Save task error:', error);
        return false;
    }
}

/**
 * 获取用户历史预测记录
 */
async function getMiroFishHistory(userId, limit = 10) {
    if (!userId) return [];

    try {
        const historyUrl = `${SUPABASE_URL}/rest/v1/prediction_tasks?user_id=eq.${userId}&order=created_at.desc&limit=${limit}`;
        const historyRes = await fetch(historyUrl, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        });

        if (historyRes.ok) {
            return await historyRes.json();
        }

        return [];
    } catch (error) {
        console.error('[MiroFish] Get predictions error:', error);
        return [];
    }
}
