const https = require('https');

// 所有部署版本
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
            res.on('end', () => {
                resolve({ success: true, data, size: data.length });
            });
        }).on('error', (e) => {
            resolve({ success: false, error: e.message });
        });
    });
}

(async () => {
    console.log('查找"图片内嵌默认使用banana2-4k"的版本...\n');
    
    for (const version of versions) {
        const result = await downloadFile(version.url, 'js/batch.js');
        if (result.success) {
            // 检查是否有"图片内嵌" + "banana2-4k"的组合
            const hasEmbedded = result.data.includes('图内嵌入') || result.data.includes('embedded');
            const hasBanana2_4k = result.data.includes('banana2-4k') || result.data.includes('banana2_4k');
            
            // 检查comicDialogMode的默认选项
            const dialogModeMatch = result.data.match(/comicDialogMode[\s\S]{0,300}/);
            const hasEmbeddedDefault = dialogModeMatch && dialogModeMatch[0].includes('embedded');
            
            // 检查是否有"默认使用banana2-4k"的提示
            const hasDefaultBanana = result.data.includes('默认使用') && result.data.includes('banana');
            
            if (hasEmbedded && hasBanana2_4k) {
                console.log(`${version.name}: ${result.size.toLocaleString()} bytes`);
                console.log(`  图内嵌入: ✅, banana2-4k: ✅`);
                console.log(`  默认内嵌: ${hasEmbeddedDefault ? '✅' : '❌'}`);
                console.log(`  默认banana提示: ${hasDefaultBanana ? '✅' : '❌'}`);
                
                // 显示相关代码片段
                const embeddedMatch = result.data.match(/图内嵌入[\s\S]{0,200}/);
                if (embeddedMatch) {
                    console.log('  代码片段:', embeddedMatch[0].substring(0, 150));
                }
            }
        }
    }
})();
