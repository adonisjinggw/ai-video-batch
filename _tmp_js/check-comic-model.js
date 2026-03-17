const https = require('https');

const versions = [
    { name: '7h', url: 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app' },
    { name: '2h', url: 'https://ai-video-batch-j1l3wn1uv-adonisjinggws-projects.vercel.app' },
    { name: 'latest', url: 'https://ai-video-batch-4b37cuyp1-adonisjinggws-projects.vercel.app' },
];

function downloadFile(url, file) {
    return new Promise((resolve) => {
        const fullUrl = `${url}/${file}`;
        
        https.get(fullUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({ success: true, data });
            });
        }).on('error', (e) => {
            resolve({ success: false, error: e.message });
        });
    });
}

(async () => {
    console.log('检查各版本的AI漫画模型选择...\n');
    
    for (const version of versions) {
        console.log(`\n=== ${version.name} ===`);
        
        const result = await downloadFile(version.url, 'index.html');
        if (result.success) {
            // 查找AI漫画相关的模型选择
            const comicModelMatch = result.data.match(/<select[^>]*id="([^"]*comic[^"]*)"[^>]*>([\s\S]*?)<\/select>/i);
            if (comicModelMatch) {
                console.log('找到漫画模型选择器:', comicModelMatch[1]);
                const options = comicModelMatch[2].match(/<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/g);
                if (options) {
                    console.log(`  找到 ${options.length} 个选项:`);
                    options.slice(0, 10).forEach(opt => {
                        const match = opt.match(/<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/);
                        if (match) {
                            console.log(`    - ${match[1]}: ${match[2].trim()}`);
                        }
                    });
                }
            } else {
                console.log('未找到漫画模型选择器');
            }
            
            // 查找switchProductType函数
            const switchFnMatch = result.data.match(/function switchProductType\([^)]*\)\s*\{([\s\S]*?)\}/);
            if (switchFnMatch) {
                console.log('找到switchProductType函数');
                // 检查是否有comic相关的case
                if (switchFnMatch[1].includes('comic')) {
                    console.log('  函数中包含comic处理逻辑');
                }
            }
            
            // 查找AI漫画面板
            const comicPanelMatch = result.data.match(/id="comic[^"]*"[\s\S]{0,500}/i);
            if (comicPanelMatch) {
                console.log('找到AI漫画相关元素');
            }
        }
    }
})();
