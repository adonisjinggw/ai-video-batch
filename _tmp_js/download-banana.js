const https = require('https');
const fs = require('fs');

// 下载7小时前包含gemini-3.1-flash-image-preview的版本
const url = 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app/banana.html';
const outputPath = 'j:\\123pan\\13998416173\\NanoNoPort\\ai-video-batch\\banana.html';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        // 验证是否包含gemini模型
        if (data.includes('gemini-3.1-flash-image-preview')) {
            fs.writeFileSync(outputPath, data, 'utf-8');
            console.log('✅ 下载成功！');
            console.log('文件保存到:', outputPath);
            console.log('文件大小:', data.length, 'bytes');

            // 显示找到的gemini选项
            const matches = data.match(/<option[^>]*value="gemini-3\.1-flash[^"]*"[^>]*>[^<]*<\/option>/g);
            if (matches) {
                console.log('\n找到的Gemini模型选项:');
                matches.forEach(m => console.log(' ', m.replace(/\s+/g, ' ').trim()));
            }
        } else {
            console.log('❌ 下载的文件不包含gemini-3.1-flash-image-preview模型');
        }
    });
}).on('error', (e) => console.error('Error:', e.message));
