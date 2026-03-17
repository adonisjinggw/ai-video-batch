const https = require('https');

// 搜索更多版本
const versions = [
    { name: 'latest', url: 'https://ai-video-batch-k7539usnx-adonisjinggws-projects.vercel.app' },
    { name: '7m', url: 'https://ai-video-batch-4b37cuyp1-adonisjinggws-projects.vercel.app' },
    { name: '12m', url: 'https://ai-video-batch-5dxtj06ct-adonisjinggws-projects.vercel.app' },
    { name: '22m', url: 'https://ai-video-batch-hds3jt8i6-adonisjinggws-projects.vercel.app' },
    { name: '57m', url: 'https://ai-video-batch-1ve6oxe8x-adonisjinggws-projects.vercel.app' },
    { name: '1h', url: 'https://ai-video-batch-pt15od3nn-adonisjinggws-projects.vercel.app' },
    { name: '2h', url: 'https://ai-video-batch-j1l3wn1uv-adonisjinggws-projects.vercel.app' },
    { name: '7h', url: 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app' },
    { name: '8h', url: 'https://ai-video-batch-8mogej8ur-adonisjinggws-projects.vercel.app' },
    { name: '9h', url: 'https://ai-video-batch-bl4yihbk8-adonisjinggws-projects.vercel.app' },
];

function downloadFile(url, file) {
    return new Promise((resolve) => {
        const fullUrl = `${url}/${file}`;
        https.get(fullUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ success: true, data, size: data.length }));
        }).on('error', (e) => resolve({ success: false }));
    });
}

(async () => {
    console.log('查找包含"banana2-4k"文本的js/batch.js版本...\n');
    
    for (const version of versions) {
        const result = await downloadFile(version.url, 'js/batch.js');
        if (result.success) {
            // 查找comicDialogMode附近是否有banana2-4k的引用
            const comicDialogIdx = result.data.indexOf('comicDialogMode');
            if (comicDialogIdx > 0) {
                const nearbyText = result.data.substring(comicDialogIdx, comicDialogIdx + 1000);
                
                // 检查附近是否有banana2-4k
                if (nearbyText.includes('banana2-4k') || nearbyText.includes('banana2_4k')) {
                    console.log(`${version.name}: ${result.size.toLocaleString()} bytes`);
                    console.log('  ✅ comicDialogMode附近有banana2-4k引用');
                    
                    // 显示相关代码
                    const lines = nearbyText.split('\n');
                    lines.slice(0, 20).forEach((line, i) => {
                        if (line.includes('banana') || line.includes('embedded') || line.includes('option')) {
                            console.log(`    ${line.trim()}`);
                        }
                    });
                }
            }
        }
    }
})();
