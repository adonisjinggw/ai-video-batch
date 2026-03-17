const https = require('https');

// 更多版本
const versions = [
    { name: 'latest', url: 'https://ai-video-batch-k7539usnx-adonisjinggws-projects.vercel.app' },
    { name: '7m', url: 'https://ai-video-batch-4b37cuyp1-adonisjinggws-projects.vercel.app' },
    { name: '12m', url: 'https://ai-video-batch-5dxtj06ct-adonisjinggws-projects.vercel.app' },
    { name: '22m', url: 'https://ai-video-batch-hds3jt8i6-adonisjinggws-projects.vercel.app' },
    { name: '57m', url: 'https://ai-video-batch-1ve6oxe8x-adonisjinggws-projects.vercel.app' },
    { name: '1h', url: 'https://ai-video-batch-pt15od3nn-adonisjinggws-projects.vercel.app' },
    { name: '2h', url: 'https://ai-video-batch-j1l3wn1uv-adonisjinggws-projects.vercel.app' },
    { name: '7h', url: 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app' },
];

function downloadFile(url, file) {
    return new Promise((resolve) => {
        const fullUrl = `${url}/${file}`;
        https.get(fullUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ success: true, data }));
        }).on('error', (e) => resolve({ success: false }));
    });
}

(async () => {
    console.log('查找"默认.*banana2-4k"或"banana2-4k.*默认"的版本...\n');
    
    for (const version of versions) {
        const result = await downloadFile(version.url, 'js/batch.js');
        if (result.success) {
            // 查找各种可能的组合
            const patterns = [
                /默认.*banana2-4k/i,
                /banana2-4k.*默认/i,
                /图内嵌入.*banana/i,
                /embedded.*banana2-4k/i,
                /自动用.*banana2-4k/i,
                /更清晰.*banana2-4k/i
            ];
            
            let found = false;
            for (const pattern of patterns) {
                if (pattern.test(result.data)) {
                    console.log(`${version.name}: ✅ 匹配 ${pattern}`);
                    found = true;
                    
                    // 显示匹配内容
                    const match = result.data.match(pattern);
                    if (match) {
                        const start = Math.max(0, match.index - 100);
                        const end = Math.min(result.data.length, match.index + 200);
                        console.log('  上下文:', result.data.substring(start, end).replace(/\n/g, ' '));
                    }
                    break;
                }
            }
            
            if (!found) {
                // 检查comicDialogMode选项的完整文本
                const dialogMatch = result.data.match(/<option value="embedded"[^>]*>([^<]+)<\/option>/);
                if (dialogMatch) {
                    console.log(`${version.name}: 图内嵌入选项 = "${dialogMatch[1].trim()}"`);
                }
            }
        }
    }
})();
