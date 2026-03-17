const https = require('https');

// 所有部署版本
const deployments = [
    { name: '7h', url: 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app' },
    { name: '2h', url: 'https://ai-video-batch-j1l3wn1uv-adonisjinggws-projects.vercel.app' },
    { name: '1h', url: 'https://ai-video-batch-pt15od3nn-adonisjinggws-projects.vercel.app' },
    { name: '57m', url: 'https://ai-video-batch-1ve6oxe8x-adonisjinggws-projects.vercel.app' },
    { name: '22m', url: 'https://ai-video-batch-hds3jt8i6-adonisjinggws-projects.vercel.app' },
    { name: '12m', url: 'https://ai-video-batch-5dxtj06ct-adonisjinggws-projects.vercel.app' },
    { name: 'latest', url: 'https://ai-video-batch-4b37cuyp1-adonisjinggws-projects.vercel.app' },
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
    
    for (const deploy of deployments) {
        const result = await downloadFile(deploy.url, 'index.html');
        if (result.success) {
            // 查找所有select元素
            const selects = result.data.match(/<select[^>]*id="([^"]+)"[^>]*>/g);
            
            // 查找与漫画相关的select
            const comicSelects = selects ? selects.filter(s => 
                s.toLowerCase().includes('comic') || 
                s.toLowerCase().includes('漫画')
            ) : [];
            
            // 查找sidebarComic
            const hasSidebarComic = result.data.includes('sidebarComic') || result.data.includes('comicPanel');
            
            // 查找AI漫画相关的div面板
            const comicPanelRegex = /<div[^>]*id="[^"]*comic[^"]*"[^>]*>/gi;
            const comicPanels = result.data.match(comicPanelRegex) || [];
            
            console.log(`${deploy.name}: ${result.size.toLocaleString()} bytes`);
            console.log(`  - 漫画相关select: ${comicSelects.length}个`);
            console.log(`  - sidebarComic: ${hasSidebarComic ? '✅' : '❌'}`);
            console.log(`  - 漫画面板: ${comicPanels.length}个`);
            
            if (comicSelects.length > 0) {
                comicSelects.forEach(s => console.log(`    ${s}`));
            }
            if (comicPanels.length > 0) {
                comicPanels.forEach(p => console.log(`    ${p.substring(0, 100)}`));
            }
        }
    }
})();
