const https = require('https');

// 所有从7h到latest的版本
const deployments = [
    { name: '7h (基准)', url: 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app' },
    { name: '2h', url: 'https://ai-video-batch-j1l3wn1uv-adonisjinggws-projects.vercel.app' },
    { name: '1h', url: 'https://ai-video-batch-pt15od3nn-adonisjinggws-projects.vercel.app' },
    { name: '57m', url: 'https://ai-video-batch-1ve6oxe8x-adonisjinggws-projects.vercel.app' },
    { name: '22m', url: 'https://ai-video-batch-hds3jt8i6-adonisjinggws-projects.vercel.app' },
    { name: '12m', url: 'https://ai-video-batch-5dxtj06ct-adonisjinggws-projects.vercel.app' },
    { name: 'latest (7m)', url: 'https://ai-video-batch-4b37cuyp1-adonisjinggws-projects.vercel.app' },
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
    console.log('检查所有部署版本的功能完整性...\n');
    
    const features = {
        '论文功能': /论文|paper|thesis/i,
        '长篇小说功能': /长篇小说|novel/i,
        'Gemini模型': /gemini-3\.1-flash/i,
        'Banana2模型': /nano-banana-2/i,
        '日历模板': /calendar_art|日历卡片/i,
        '圣诞贺卡': /christmas|圣诞贺卡/i,
        '春节红包': /红包封面|spring.*festival/i,
        '批量漫画': /batchComic|批量漫画/i,
        '生图模型选择': /comicModel|commandModelSelect/i,
        '视频模型选择': /quickGenMode|genModeSelect/i
    };
    
    const files = ['index.html', 'mobile.html', 'banana.html', 'writing.html'];
    
    for (const file of files) {
        console.log(`\n=== ${file} ===`);
        
        const results = [];
        for (const deploy of deployments) {
            const result = await downloadFile(deploy.url, file);
            if (result.success) {
                const featureStatus = {};
                for (const [name, regex] of Object.entries(features)) {
                    featureStatus[name] = regex.test(result.data);
                }
                results.push({ 
                    name: deploy.name, 
                    size: result.size,
                    features: featureStatus 
                });
            }
        }
        
        // 显示每个版本的功能状态
        for (const r of results) {
            const enabledFeatures = Object.entries(r.features)
                .filter(([k, v]) => v)
                .map(([k, v]) => k);
            console.log(`  ${r.name}: ${r.size.toLocaleString()} bytes - ${enabledFeatures.length}个功能`);
        }
        
        // 找出功能最完整的版本
        const bestVersion = results.reduce((best, current) => {
            const bestCount = Object.values(best.features).filter(v => v).length;
            const currentCount = Object.values(current.features).filter(v => v).length;
            return currentCount > bestCount ? current : best;
        }, results[0]);
        
        if (bestVersion) {
            console.log(`  ⭐ 最完整版本: ${bestVersion.name}`);
        }
    }
})();
