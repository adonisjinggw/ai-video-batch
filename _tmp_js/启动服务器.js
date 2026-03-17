/**
 * AI视频批量创作 - 本地服务器（静态文件 + API代理）
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 8899;

// 🔑 API 认证信息（安全存储在后端）
const API_KEYS = {
    t8star: '', // ❌ 已移除硬编码，需从环境变量或前端配置获取
    rhFlux: {
        apiKey: 'a380bfb6f25b4733ad6756a0bb0a8403',
        webappId: '1986431735514726401'
    }
};

// 🌐 API Base URLs
const API_BASE_URLS = {
    t8star: 'https://ai.t8star.cn', // T8星辰/贞贞工坊官方地址
    rhFlux: 'https://www.runninghub.cn'
};

// MIME类型映射
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // 打印请求日志
  console.log(`📥 ${req.method} ${req.url}`);
  
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    console.log('✓ 处理OPTIONS预检请求');
    res.writeHead(200);
    res.end();
    return;
  }

  // API代理请求
  if (req.method === 'POST' && req.url === '/api/proxy') {
    console.log('✓ 匹配到API代理路由');
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                // 🔍 调试：打印原始请求体
                console.log('📦 收到请求体:', body.substring(0, 500)); // 打印前500字符
                
                if (!body || body.trim() === '') {
                    throw new Error('请求体为空');
                }
                
                const requestData = JSON.parse(body);
                
                // 🔍 调试：检查关键字段
                if (!requestData.targetUrl) {
                    throw new Error('缺少 targetUrl 字段');
                }
                // 🆕 只在POST请求时检查body
                if (requestData.method !== 'GET' && !requestData.body) {
                    console.warn('⚠️ POST请求但 body 字段为空或未定义');
                }
                
                const targetUrl = new URL(requestData.targetUrl);
                const apiType = requestData.apiType || 'auto'; // 识别API类型
                console.log(`🎯 代理到: ${targetUrl.hostname}${targetUrl.pathname} (类型: ${apiType})`);

                // 🚨 硬禁用所有贞贞(t8star)代理流量（无视任何Key配置）
                if (targetUrl.hostname.includes('t8star.cn') || apiType === 't8star' || apiType === 'zhenzhen') {
                    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: 'ZHENZHEN_DISABLED', message: '贞贞(t8star)已被管理员停用' }));
                    return;
                }
                
                // 准备请求头（增强兼容性）
                const headers = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Cache-Control': 'no-cache'
                };
                
                // 根据 API 类型添加认证
                // 🆕 优先使用前端传递的 Key
                const userAuth = requestData.authorization;
                const userApiKey = requestData.apiKey;

                if (apiType === 'rh-flux' || apiType === 'rh-flux-poll') {
                    // RH Flux API：认证信息在 body 中或 header 中
                    if (apiType === 'rh-flux') {
                        // 创建任务：添加 apiKey 和 webappId 到 body
                        requestData.body.apiKey = userApiKey || API_KEYS.rhFlux.apiKey;
                        requestData.body.webappId = requestData.webappId || API_KEYS.rhFlux.webappId;
                        console.log(userApiKey ? '✓ 使用用户提供的RH认证' : '✓ 使用内置RH认证');
                    } else {
                        // 轮询任务：添加到 header
                        headers['Authorization'] = userAuth || `Bearer ${API_KEYS.rhFlux.apiKey}`;
                        console.log(userAuth ? '✓ 使用用户提供的RH认证(Header)' : '✓ 使用内置RH认证(Header)');
                    }
                } else if (targetUrl.hostname.includes('t8star.cn') || apiType === 't8star' || apiType === 'zhenzhen') {
                    // T8星辰/贞贞工坊 API
                    headers['Authorization'] = userAuth || `Bearer ${API_KEYS.t8star}`;
                    console.log(userAuth ? '✓ 使用用户提供的T8认证' : '✓ 使用内置T8认证');
                } else {
                    console.log('⚠️ 未识别的API类型，使用原始请求');
                }
                
                // 确定请求方法：优先使用前端指定的 method，否则根据 apiType 判断
                const requestMethod = requestData.method || (apiType === 'rh-flux-poll' ? 'GET' : 'POST');
                
                const options = {
                    hostname: targetUrl.hostname,
                    port: 443,
                    path: targetUrl.pathname + (targetUrl.search || ''),
                    method: requestMethod,
                    headers: headers,
                    servername: targetUrl.hostname,  // 🔑 SNI支持
                    timeout: 60000, // ⏱️ 60秒超时
                    // 🔧 完整的TLS配置
                    minVersion: 'TLSv1.2',
                    maxVersion: 'TLSv1.3',
                    ciphers: 'HIGH:!aNULL:!MD5',
                    honorCipherOrder: true
                };

                const proxyReq = https.request(options, (proxyRes) => {
                    let responseBody = '';
                    proxyRes.on('data', chunk => responseBody += chunk.toString());
                    proxyRes.on('end', () => {
                        console.log(`✅ 响应状态: ${proxyRes.statusCode}`);
                        if (proxyRes.statusCode >= 400) {
                            console.error(`⚠️ API返回错误: ${responseBody.substring(0, 200)}`);
                        }
                        res.writeHead(proxyRes.statusCode, {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(responseBody);
                    });
                });

                // 超时处理
                proxyReq.on('timeout', () => {
                    console.error('⏱️ API请求超时');
                    proxyReq.destroy();
                    res.writeHead(504, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'API请求超时，请稍后重试' }));
                });

                // 错误处理（增强版）
                proxyReq.on('error', (error) => {
                    console.error('❌ API请求失败:', error.message);
                    console.error('❌ 错误代码:', error.code || 'UNKNOWN');
                    console.error('❌ 目标地址:', targetUrl.href);
                    
                    let errorMessage = error.message;
                    if (error.code === 'ECONNRESET') {
                        errorMessage = 'API连接被重置，可能是网络问题或API限流，请稍后重试';
                    } else if (error.code === 'ETIMEDOUT') {
                        errorMessage = 'API请求超时，请检查网络连接';
                    } else if (error.code === 'ENOTFOUND') {
                        errorMessage = 'API地址无法解析，请检查API配置';
                    }
                    
                    res.writeHead(500, { 
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ 
                        error: errorMessage,
                        code: error.code 
                    }));
                });

                // 只有 POST 请求才发送 body
                if (requestMethod === 'POST' && requestData.body) {
                    const bodyString = JSON.stringify(requestData.body);
                    console.log('📤 发送请求体:', bodyString.substring(0, 300)); // 打印前300字符
                    console.log('📏 请求体长度:', bodyString.length);
                    proxyReq.write(bodyString);
                } else if (requestMethod === 'POST') {
                    console.warn('⚠️ POST请求但没有 body 数据');
                }
                proxyReq.end();
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: '请求格式错误' }));
            }
        });
        return;
    }

    // 静态文件服务
    // 🆕 修复：去除查询参数 (?v=6.8)，防止本地文件查找失败
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    let filePath = urlObj.pathname === '/' ? '/index.html' : urlObj.pathname;
    
    // 安全检查：防止目录遍历
    if (filePath.includes('..')) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    filePath = path.join(__dirname, filePath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath);
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
    });
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.log(`
╔════════════════════════════════════════════╗
║   ❌ 启动失败：端口 8899 被占用           ║
╚════════════════════════════════════════════╝

💡 原因：您可能已经运行了一个服务器窗口，或者上次未正常关闭。
👉 解决：
   1. 请检查任务栏，关闭已有的 "node" 或 "cmd" 窗口
   2. 或者直接使用当前已打开的浏览器页面
   3. 如果需要重启，请先关闭旧窗口
`);
        process.exit(1);
    } else {
        console.error('❌ 服务器错误:', e);
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`
╔════════════════════════════════════════════╗
║   🚀 AI视频批量创作工具已启动             ║
╚════════════════════════════════════════════╝

✅ 服务器运行中！
📡 访问地址: http://localhost:${PORT}
🔑 API Key已内置

💡 浏览器会自动打开，开始创作吧！

⚠️  使用完毕后关闭此窗口即可
`);
});

