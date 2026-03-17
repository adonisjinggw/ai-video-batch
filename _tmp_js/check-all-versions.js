const https = require('https');

// 从部署历史中提取的版本
const versions = [
    { name: '最新 (7m)', url: 'https://ai-video-batch-4b37cuyp1-adonisjinggws-projects.vercel.app' },
    { name: '12m', url: 'https://ai-video-batch-5dxtj06ct-adonisjinggws-projects.vercel.app' },
    { name: '22m', url: 'https://ai-video-batch-hds3jt8i6-adonisjinggws-projects.vercel.app' },
    { name: '57m', url: 'https://ai-video-batch-1ve6oxe8x-adonisjinggws-projects.vercel.app' },
    { name: '1h', url: 'https://ai-video-batch-pt15od3nn-adonisjinggws-projects.vercel.app' },
    { name: '2h', url: 'https://ai-video-batch-j1l3wn1uv-adonisjinggws-projects.vercel.app' },
    { name: '7h (基准)', url: 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app' },
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
    console.log('检查各版本的模型列表...\n');
    
    for (const version of versions) {
        console.log(`\n=== ${version.name} ===`);
        
        // 检查 mobile.html
        const mobileResult = await downloadFile(version.url, 'mobile.html');
        if (mobileResult.success) {
            // 查找comicModel select中的选项
            const selectMatch = mobileResult.data.match(/<select[^>]*id="comicModel"[^>]*>([\s\S]*?)<\/select>/);
            if (selectMatch) {
                const options = selectMatch[1].match(/<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/g);
                if (options) {
                    console.log(`  mobile.html 找到 ${options.length} 个模型选项`);
                    
                    // 检查是否有gemini
                    const hasGemini = options.some(opt => opt.includes('gemini'));
                    const hasBanana = options.some(opt => opt.includes('banana'));
                    console.log(`    - Gemini模型: ${hasGemini ? '✅' : '❌'}`);
                    console.log(`    - Banana模型: ${hasBanana ? '✅' : '❌'}`);
                }
            }
        }
        
        // 检查 index.html
        const indexResult = await downloadFile(version.url, 'index.html');
        if (indexResult.success) {
            const selectMatch = indexResult.data.match(/<select[^>]*id="commandModelSelect"[^>]*>([\s\S]*?)<\/select>/);
            if (selectMatch) {
                const options = selectMatch[1].match(/<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/g);
                if (options) {
                    console.log(`  index.html 找到 ${options.length} 个模型选项`);
                    
                    const hasGemini = options.some(opt => opt.includes('gemini'));
                    const hasBanana = options.some(opt => opt.includes('banana'));
                    console.log(`    - Gemini模型: ${hasGemini ? '✅' : '❌'}`);
                    console.log(`    - Banana模型: ${hasBanana ? '✅' : '❌'}`);
                }
            }
        }
        
        // 检查 banana.html
        const bananaResult = await downloadFile(version.url, 'banana.html');
        if (bananaResult.success) {
            const selectMatch = bananaResult.data.match(/<select[^>]*id="modelSelect"[^>]*>([\s\S]*?)<\/select>/);
            if (selectMatch) {
                const options = selectMatch[1].match(/<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/g);
                if (options) {
                    console.log(`  banana.html 找到 ${options.length} 个模型选项`);
                    
                    const hasGemini = options.some(opt => opt.includes('gemini'));
                    const hasBanana = options.some(opt => opt.includes('banana'));
                    console.log(`    - Gemini模型: ${hasGemini ? '✅' : '❌'}`);
                    console.log(`    - Banana模型: ${hasBanana ? '✅' : '❌'}`);
                }
            }
        }
    }
})();
