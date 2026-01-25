const https = require('https');
const http = require('http');
const crypto = require('crypto');

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

// 🛡️ 简单限流（IP+路径），窗口60秒，最大120次
const rateLimitStore = new Map();
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

module.exports = async function handler(req, res) {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
    const key = `${ip}:${req.url}`;
    const now = Date.now();
    const record = rateLimitStore.get(key) || { count: 0, reset: now + RATE_LIMIT_WINDOW_MS };
    if (now > record.reset) {
        record.count = 0;
        record.reset = now + RATE_LIMIT_WINDOW_MS;
    }
    record.count += 1;
    rateLimitStore.set(key, record);
    if (record.count > RATE_LIMIT_MAX) {
        res.status(429).json({ error: 'Too Many Requests' });
        return;
    }

    // 1. 设置 CORS 头 (🔧 安全修复：限制允许的域名)
    const allowedOrigins = [
        'https://lossloop.cn',
        'https://www.lossloop.cn',
        'https://rollroll.art',
        'https://www.rollroll.art',
        'https://ai-video-batch.vercel.app',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
        // 同源/服务端请求没有 Origin 头：允许通过（不强行绑定到单域名）
        // 注意：这里不能用 "*" 因为启用了 credentials
        res.setHeader('Access-Control-Allow-Origin', 'https://rollroll.art');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
