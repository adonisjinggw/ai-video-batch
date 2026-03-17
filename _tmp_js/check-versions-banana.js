const https = require('https');

// 检查7小时前的版本
const oldUrl = 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app/mobile.html';
const newUrl = 'https://ai-video-batch-hds3jt8i6-adonisjinggws-projects.vercel.app/mobile.html';

function checkBanana(url, label) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const optionMatches = data.match(/<option[^>]*value="nano-banana[^"]*"[^>]*>[^<]*<\/option>/g);
                console.log(`\n=== ${label} ===`);
                if (optionMatches) {
                    console.log(`Found ${optionMatches.length} banana options:`);
                    optionMatches.forEach(x => console.log(' ', x.replace(/\s+/g, ' ').trim()));
                } else {
                    console.log('No banana models found');
                }
                resolve();
            });
        }).on('error', (e) => {
            console.error(`Error checking ${label}:`, e.message);
            reject(e);
        });
    });
}

(async () => {
    await checkBanana(oldUrl, '7小时前版本');
    await checkBanana(newUrl, '当前版本');
})();
