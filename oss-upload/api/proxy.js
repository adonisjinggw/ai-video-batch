const https = require('https');
const http = require('http');
const crypto = require('crypto');

// 🔐 系统密钥 (必须与 admin.html 中的一致)
const VIP_SECRET = process.env.VIP_SECRET || 'NanoVideo2025_Secret';

// 允许的 API 类型映射
const API_CONFIG = {
    't8star': {
        baseUrl: 'https://api.t8star.cn',
        defaultKey: '' // ❌ 已移除硬编码 Key
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
    // 1. 设置 CORS 头 (允许跨域)
    res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, apiType, targetUrl');

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

    // ==================== 🆕 会员激活码验证逻辑 ====================
    if (type === 'verify-vip') {
        const { code } = requestBody;
        if (!code) return res.status(400).json({ error: 'Missing code' });

        try {
            // 格式1 (简短版): M_AB12CD34_98765432 (由admin.html生成)
            // 格式: TYPEPREFIX_RANDOM_SIGNATURE (8位)
            
            const parts = code.toUpperCase().split('_');
            
            // 兼容旧格式 NANO-M-...
            if (code.startsWith('NANO-')) {
                 // ... (原有旧逻辑可以保留或提示升级)
                 return res.json({ success: false, message: '请使用新版激活码' });
            }

            if (parts.length !== 3) {
                return res.json({ success: false, message: '激活码格式错误' });
            }

            const [prefix, randomPart, signature] = parts;
            
            // 还原类型
            let fullType = '';
            if (prefix === 'M') fullType = 'VIP_MONTH';
            else if (prefix === 'Y') fullType = 'VIP_YEAR';
            else if (prefix === 'P') fullType = 'VIP_PERM';
            else return res.json({ success: false, message: '未知会员类型' });

            // 验证签名 (对应 admin.html 的生成逻辑)
            // Payload: PREFIX_RANDOM
            const payload = `${prefix}_${randomPart}`;
            
            // 使用 Node.js crypto 模块进行 HMAC-SHA256
            const expectedSignature = crypto.createHmac('sha256', VIP_SECRET)
                                           .update(payload)
                                           .digest('hex')
                                           .substring(0, 8)
                                           .toUpperCase();

            if (signature === expectedSignature) {
                // 验证成功！返回有效期
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
                    expiryDate: expiryDate.toISOString().split('T')[0]
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
        finalUrl = 'https://api.t8star.cn/v1/chat/completions';
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
