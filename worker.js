/**
 * Cloudflare Worker - API代理
 * 用于绕过CORS限制
 */

export default {
  async fetch(request, env) {
    // 处理CORS预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    try {
      const url = new URL(request.url);
      
      // 获取目标API地址
      let targetUrl;
      if (url.pathname.includes('/zhenzhen/')) {
        // 贞贞工坊API
        targetUrl = 'https://api.gptbest.com/v1/chat/completions';
      } else if (url.pathname.includes('/flux/')) {
        // RH Flux API
        targetUrl = 'https://www.runninghub.cn/task/openapi/ai-app/run';
      } else if (url.pathname.includes('/sora2/')) {
        // Sora2 API
        targetUrl = 'https://api.gptbest.com/v1/video/generate';
      } else {
        return new Response('Invalid API endpoint', { status: 400 });
      }

      // 转发请求
      const apiRequest = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      const response = await fetch(apiRequest);
      const data = await response.text();

      // 返回响应并添加CORS头
      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};

