const https = require('https');

// 8-9小时前的版本
const versions = [
    { name: '8h', url: 'https://ai-video-batch-8mogej8ur-adonisjinggws-projects.vercel.app' },
    { name: '8h2', url: 'https://ai-video-batch-lng01oez4-adonisjinggws-projects.vercel.app' },
    { name: '8h3', url: 'https://ai-video-batch-ln0v00p5w-adonisjinggws-projects.vercel.app' },
    { name: '8h4', url: 'https://ai-video-batch-gv1pwgkfx-adonisjinggws-projects.vercel.app' },
    { name: '9h', url: 'https://ai-video-batch-bl4yihbk8-adonisjinggws-projects.vercel.app' },
    { name: '9h2', url: 'https://ai-video-batch-q98iy455u-adonisjinggws-projects.vercel.app' },
    { name: '9h3', url: 'https://ai-video-batch-6b3wqtkxz-adonisjinggws-projects.vercel.app' },
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
    console.log('检查8-9小时前的版本...\n');
    
    for (const version of versions) {
        const result = await downloadFile(version.url, 'index.html');
        if (result.success) {
            // 检查文件大小
            console.log(`${version.name}: ${result.size.toLocaleString()} bytes`);
            
            // 检查是否有AI漫画功能
            const hasComic = result.data.includes('AI漫画') || result.data.includes('switchProductType(\'comic\')');
            const hasWriting = result.data.includes('AI写作') || result.data.includes('switchProductType(\'writing\')');
            
            // 检查模型选择
            const hasComicModel = result.data.match(/<select[^>]*comic[^>]*>/i);
            const hasWritingModel = result.data.match(/sidebarWritingModel/);
            
            console.log(`  AI漫画: ${hasComic ? '✅' : '❌'}, 模型选择: ${hasComicModel ? '✅' : '❌'}`);
            console.log(`  AI写作: ${hasWriting ? '✅' : '❌'}, 模型选择: ${hasWritingModel ? '✅' : '❌'}`);
        }
    }
})();
