const DEFAULT_VERSION = '2.45.1';

// 🇨🇳 多 CDN 源，优先国内可用的（按速度排序）
const CDN_SOURCES = [
    {
        // 🚀 npmmirror（阿里云镜像）- 国内最快
        name: 'npmmirror',
        buildUrl: (version) => `https://registry.npmmirror.com/@supabase/supabase-js/${version}/files/dist/umd/supabase.min.js`
    },
    {
        // gcore 有国内节点，较快
        name: 'gcore',
        buildUrl: (version) => `https://gcore.jsdelivr.net/npm/@supabase/supabase-js@${version}/dist/umd/supabase.min.js`
    },
    {
        // jsdelivr 有国内节点
        name: 'jsdelivr',
        buildUrl: (version) => `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${version}/dist/umd/supabase.min.js`
    },
    {
        // bootcdn - 国内 CDN
        name: 'bootcdn',
        buildUrl: (version) => `https://cdn.bootcdn.net/ajax/libs/@supabase/supabase-js/${version}/supabase.min.js`
    },
    {
        // unpkg 备用
        name: 'unpkg',
        buildUrl: (version) => `https://unpkg.com/@supabase/supabase-js@${version}/dist/umd/supabase.min.js`
    }
];

/**
 * Supabase SDK 反向代理
 * 作用：从我们自己的域名提供 SDK，避免浏览器插件拦截第三方 CDN。
 */
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
        return;
    }

    const rawVersion = req.query.version || DEFAULT_VERSION;
    // 只允许数字、字母、点和连字符，避免 SSRF
    const version = String(rawVersion).replace(/[^0-9a-zA-Z.\-]/g, '') || DEFAULT_VERSION;
    const cacheBuster = req.query.v || '';
    const preferredCdn = String(req.query.cdn || '').trim().toLowerCase();

    const candidates = (() => {
        const base = CDN_SOURCES.slice();
        if (!preferredCdn) return base;
        const idx = base.findIndex(s => s.name === preferredCdn);
        if (idx <= 0) return base;
        const first = base[idx];
        base.splice(idx, 1);
        base.unshift(first);
        return base;
    })();

    // 🚀 缩短超时时间，更快切换备用源（国内 CDN 通常 2 秒内响应）
    const fetchUpstream = async (url, timeoutMs = 4000) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
            const upstream = await fetch(url, {
                headers: {
                    'User-Agent': 'RollRoll/SDKProxy',
                    'Accept': 'application/javascript, text/plain, */*'
                },
                signal: controller.signal
            });
            clearTimeout(timeout);
            
            if (!upstream.ok) {
                const text = await upstream.text().catch(() => '');
                const err = new Error(`Upstream ${upstream.status}`);
                err.upstreamStatus = upstream.status;
                err.upstreamBody = text.slice(0, 200);
                throw err;
            }
            const buffer = Buffer.from(await upstream.arrayBuffer());
            const contentType = upstream.headers.get('content-type') || 'application/javascript; charset=utf-8';
            return { buffer, contentType };
        } catch (e) {
            clearTimeout(timeout);
            if (e.name === 'AbortError') {
                const err = new Error('Request timeout');
                err.isTimeout = true;
                throw err;
            }
            throw e;
        }
    };

    let lastErr = null;
    for (const src of candidates) {
        const url = src.buildUrl(version);
        try {
            const { buffer, contentType } = await fetchUpstream(url);
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
            res.setHeader('Content-Type', contentType);
            res.setHeader('X-Supabase-SDK-Version', version);
            res.setHeader('X-Supabase-SDK-CDN', src.name);
            if (cacheBuster) {
                res.setHeader('X-Cache-Buster', cacheBuster);
            }
            res.status(200).send(buffer);
            return;
        } catch (e) {
            lastErr = e;
            console.error('[Supabase SDK Proxy] upstream failed:', src.name, e && e.message ? e.message : e);
        }
    }

    // ⚠️ 重要：script 标签加载失败时，如果返回 JSON，会导致浏览器执行时报语法错误。
    // 这里保证始终返回可执行 JS，并给前端提示信息。
    const safeMsg = (lastErr && lastErr.message) ? String(lastErr.message).replace(/`/g, '\\`') : 'unknown';
    const bodyHint = (lastErr && lastErr.upstreamBody) ? String(lastErr.upstreamBody).replace(/`/g, '\\`') : '';
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('X-Supabase-SDK-Error', '1');
    res.status(200).send(
        `console.error('[Supabase SDK Proxy] Failed to load v${version}: ${safeMsg}');\n` +
        `window.__supabaseSdkLoadError = 'Supabase SDK加载失败（网络或插件拦截）。';\n` +
        (bodyHint ? `console.warn('[Supabase SDK Proxy] Upstream response:', ${JSON.stringify(bodyHint)});\n` : '')
    );
};

