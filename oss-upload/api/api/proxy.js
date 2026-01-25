const https = require('https');
const http = require('http');

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
    const { apiType, targetUrl, method = 'POST' } = req.query; // 优先从 query 获取，也可以从 body 获取
    const requestBody = req.body;

    // 确定目标 API 配置
    // 优先使用请求体中的参数，如果没有则使用 query 参数
    const type = requestBody?.apiType || apiType;
    const urlOverride = requestBody?.targetUrl || targetUrl;
    const reqMethod = requestBody?.method || method;

    const config = API_CONFIG[type];

    if (!config && !urlOverride) {
        return res.status(400).json({ error: 'Invalid API Type or Target URL' });
    }

    // 3. 构建目标 URL
    let finalUrl = '';
    if (type === 'rh-flux') {
        finalUrl = 'https://www.runninghub.cn/task/openapi/create';
    } else if (type === 'rh-flux-poll') {
        // 从 URL 路径中提取 taskId，或者假设它在 body/query 中
        // 这里的逻辑需要根据前端的具体传参调整
        // 假设前端在 body 中传了 taskId 或者直接传了完整 targetUrl
        finalUrl = urlOverride; 
    } else if (urlOverride) {
        finalUrl = urlOverride;
    } else {
        // 默认 T8Star chat
        finalUrl = 'https://api.t8star.cn/v1/chat/completions';
    }

    // 4. 准备 headers
    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; VercelProxy/1.0)'
    };

    // 处理 Authorization
    if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
    } else if (config && config.defaultKey) {
        headers['Authorization'] = `Bearer ${config.defaultKey}`;
    }

    // 5. 发起代理请求
    try {
        const responseData = await fetchRequest(finalUrl, reqMethod, headers, requestBody);
        res.status(200).json(responseData);
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: error.message, details: 'Proxy request failed' });
    }
}

// 辅助函数：发起请求
async function fetchRequest(url, method, headers, body) {
    // 剔除不需要的 body 字段
    if (body) {
        delete body.apiType;
        delete body.targetUrl;
        delete body.method;
    }

    const options = {
        method: method,
        headers: headers,
    };

    if (method !== 'GET' && method !== 'HEAD' && body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    // 尝试解析 JSON，如果失败则返回文本
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        return { data: text }; // 回退处理
    }
}

