/**
 * Vercel Serverless Proxy for AI Video Batch Project
 * - Injects API keys securely via environment variables
 * - Handles CORS
 * - Mirrors the behavior of 本地 `启动服务器.js`
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const requestData = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const targetUrl = requestData.targetUrl;
        const apiType = requestData.apiType || 'auto';
        const requestBody = requestData.body || {};

        if (!targetUrl) {
            return res.status(400).json({ error: 'targetUrl is required' });
        }

        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'NanoNoPort-AI/1.0',
            'Accept': 'application/json, text/plain, */*',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
        };

        if (apiType === 'rh-flux') {
            requestBody.apiKey = process.env.RH_FLUX_API_KEY;
            requestBody.webappId = process.env.RH_FLUX_WEBAPP_ID || requestBody.webappId;
        } else if (apiType === 'rh-flux-poll') {
            headers['Authorization'] = `Bearer ${process.env.RH_FLUX_API_KEY}`;
        } else if (targetUrl.includes('t8star.cn') || apiType === 't8star' || apiType === 'zhenzhen') {
            return res.status(403).json({ error: 'ZHENZHEN_DISABLED', message: '贞贞(t8star)已被管理员停用' });
        }

        const method = apiType === 'rh-flux-poll' ? 'GET' : 'POST';
        const fetchOptions = { method, headers };

        if (method === 'POST') {
            fetchOptions.body = JSON.stringify(requestBody);
        }

        const response = await fetch(targetUrl, fetchOptions);
        const text = await response.text();

        res.status(response.status).send(text);
    } catch (error) {
        console.error('[Proxy Error]', error);
        res.status(500).json({
            error: error.message || 'Proxy request failed'
        });
    }
}

