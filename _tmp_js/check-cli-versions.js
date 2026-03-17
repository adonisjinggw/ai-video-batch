const https = require('https');

// 从历史部署URL列表中检查哪个包含 gemini-3.1-flash-image-preview
const urls = [
    'https://ai-video-batch-1ve6oxe8x-adonisjinggws-projects.vercel.app/banana.html',  // 41m前
    'https://ai-video-batch-pt15od3nn-adonisjinggws-projects.vercel.app/banana.html',  // 1h前
    'https://ai-video-batch-19r9ib8g4-adonisjinggws-projects.vercel.app/banana.html',  // 1h前
    'https://ai-video-batch-j1l3wn1uv-adonisjinggws-projects.vercel.app/banana.html',  // 1h前
    'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app/banana.html',  // 7h前（之前恢复的版本）
];

function checkVersion(url, label) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const hasGemini = data.includes('gemini-3.1-flash-image-preview');
                const hasBanana = data.includes('nano-banana-2');
                console.log(`${label}:`);
                console.log(`  有Gemini 3.1 Flash: ${hasGemini ? '✅' : '❌'}`);
                console.log(`  有Banana2: ${hasBanana ? '✅' : '❌'}`);
                if (hasGemini) {
                    const match = data.match(/<option[^>]*value="gemini-3\.1-flash[^"]*"[^>]*>[^<]*<\/option>/g);
                    if (match) {
                        console.log(`  找到选项:`);
                        match.forEach(m => console.log(`    ${m}`));
                    }
                }
                resolve({ url, hasGemini, hasBanana });
            });
        }).on('error', (e) => {
            console.log(`${label}: 错误 - ${e.message}`);
            resolve({ url, hasGemini: false, hasBanana: false, error: e.message });
        });
    });
}

(async () => {
    console.log('检查CLI历史部署版本...\n');
    for (let i = 0; i < urls.length; i++) {
        await checkVersion(urls[i], `版本 ${i + 1} (${urls[i].split('/')[2].split('-')[3]})`);
        console.log('');
    }
})();
