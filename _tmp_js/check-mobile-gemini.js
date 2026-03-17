const https = require('https');

// 检查当前版本和7小时前版本的mobile.html
const currentUrl = 'https://ai-video-batch-hds3jt8i6-adonisjinggws-projects.vercel.app/mobile.html';
const oldUrl = 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app/mobile.html';

function checkMobile(url, label) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const hasGemini = data.includes('gemini-3.1-flash-image-preview');
                const hasBanana = data.includes('nano-banana-2');
                const hasPaper = data.includes('data-type="paper"');
                const hasNovel = data.includes('data-type="novel"');

                console.log(`\n=== ${label} ===`);
                console.log(`Gemini 3.1 Flash: ${hasGemini ? '✅' : '❌'}`);
                console.log(`Banana2: ${hasBanana ? '✅' : '❌'}`);
                console.log(`论文功能: ${hasPaper ? '✅' : '❌'}`);
                console.log(`长篇小说功能: ${hasNovel ? '✅' : '❌'}`);

                resolve({ hasGemini, hasBanana, hasPaper, hasNovel });
            });
        }).on('error', (e) => {
            console.log(`${label}: 错误 - ${e.message}`);
            resolve({ error: e.message });
        });
    });
}

(async () => {
    await checkMobile(currentUrl, '当前版本');
    await checkMobile(oldUrl, '7小时前版本');
})();
