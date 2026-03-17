/**
 * 本地CORS代理服务器
 * 解决纯前端跨域问题
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 8899;
const API_KEY = ''; // ❌ 已移除硬编码，需从环境变量获取

const server = http.createServer((req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 🆕 处理 /api/proxy 路由（GET 和 POST）
  if (req.url.startsWith('/api/proxy')) {
    console.log(`📥 ${req.method} ${req.url}`);
    
    if (req.method === 'GET') {
      // GET 请求不需要 body，直接从 URL 读取参数
      // 通常用于轮询任务状态
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const targetUrl = urlObj.searchParams.get('targetUrl');
      
      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'GET 请求缺少 targetUrl 参数' }));
        return;
      }
      
      console.log(`✓ 匹配到API代理路由 (GET)`);
      console.log(`🎯 代理到: ${targetUrl}`);
      
      const apiUrl = new URL(targetUrl);
      const options = {
        hostname: apiUrl.hostname,
        port: apiUrl.port || 443,
        path: apiUrl.pathname + apiUrl.search,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      };
      
      const proxyReq = https.request(options, (proxyRes) => {
        let responseBody = '';
        proxyRes.on('data', chunk => {
          responseBody += chunk.toString();
        });
        proxyRes.on('end', () => {
          console.log(`✅ 响应状态: ${proxyRes.statusCode}`);
          res.writeHead(proxyRes.statusCode, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(responseBody);
        });
      });
      
      proxyReq.on('error', (error) => {
        console.error('❌ 代理请求失败:', error);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: error.message }));
      });
      
      proxyReq.end();
      return;
    }
    
    // POST 请求处理
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        if (!body) {
          console.log('⚠️ POST请求没有 body 数据');
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'POST请求缺少body' }));
          return;
        }
        
        try {
          const requestData = JSON.parse(body);
          console.log(`✓ 匹配到API代理路由`);
          console.log(`📦 收到请求体:`, JSON.stringify(requestData));
          
          const targetUrl = new URL(requestData.targetUrl);
          console.log(`🎯 代理到: ${targetUrl.hostname}${targetUrl.pathname} (类型: ${requestData.apiType})`);
          
          const headers = {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          };
          
          const postData = JSON.stringify(requestData.body);
          console.log(`📤 发送请求体: ${postData}`);
          console.log(`📏 请求体长度: ${postData.length}`);
          
          const options = {
            hostname: targetUrl.hostname,
            port: targetUrl.port || 443,
            path: targetUrl.pathname + targetUrl.search,
            method: 'POST',
            headers: headers
          };

          const proxyReq = https.request(options, (proxyRes) => {
            let responseBody = '';
            proxyRes.on('data', chunk => {
              responseBody += chunk.toString();
            });
            proxyRes.on('end', () => {
              console.log(`✅ 响应状态: ${proxyRes.statusCode}`);
              if (proxyRes.statusCode >= 400) {
                console.log(`⚠️ API返回错误: ${responseBody}`);
              }
              res.writeHead(proxyRes.statusCode, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(responseBody);
            });
          });

          proxyReq.on('error', (error) => {
            console.error('❌ 代理请求失败:', error);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: error.message }));
          });

          proxyReq.write(postData);
          proxyReq.end();

        } catch (error) {
          console.error('❌ 请求解析失败:', error);
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: '请求格式错误' }));
        }
      });
      return;
    }
  }

  // 其他请求返回 404
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: '路由不存在' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🚀 AI视频批量创作 - 本地代理服务器      ║
╚════════════════════════════════════════════╝

✅ 服务器已启动！
📡 代理地址: http://localhost:${PORT}
🔑 API Key: ${API_KEY.substring(0, 20)}...

💡 使用方法：
   保持此窗口运行，然后打开浏览器访问：
   http://localhost:${PORT}/index.html

⚠️  请勿关闭此窗口！
`);
});

