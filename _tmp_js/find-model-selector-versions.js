const https = require('https');

// 更多部署版本
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
    console.log('查找有AI漫画模型选择的版本...\n');
    
    for (const version of versions) {
        const result = await downloadFile(version.url, 'index.html');
        if (result.success) {
            // 检查是否有AI漫画的模型选择器
            const hasComicImageModel = result.data.includes('comicImageModel') || 
                                       result.data.includes('comicSettingImageModel');
            
            // 检查左侧边栏是否有模型选择
            const sidebarModelMatch = result.data.match(/<select[^>]*id="([^"]*[Mm]odel[^"]*)"[^>]*>/g);
            const sidebarModels = sidebarModelMatch ? sidebarModelMatch.map(m => {
                const id = m.match(/id="([^"]+)"/);
                return id ? id[1] : '';
            }).filter(id => id) : [];
            
            console.log(`${version.name}: ${result.size.toLocaleString()} bytes`);
            console.log(`  漫画模型选择: ${hasComicImageModel ? '✅' : '❌'}`);
            console.log(`  侧边栏模型选择器: ${sidebarModels.join(', ') || '无'}`);
        }
    }
})();
