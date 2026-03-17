const https = require('https');

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
            res.on('end', () => resolve({ success: true, data }));
        }).on('error', (e) => resolve({ success: false }));
    });
}

(async () => {
    console.log('检查所有版本的comicDialogMode选项文本...\n');
    
    const results = [];
    for (const version of versions) {
        const result = await downloadFile(version.url, 'js/batch.js');
        if (result.success) {
            // 提取comicDialogMode的option文本
            const matches = result.data.matchAll(/<option value="embedded"[^>]*>([^<]+)<\/option>/g);
            for (const match of matches) {
                results.push({ version: version.name, text: match[1].trim() });
            }
        }
    }
    
    // 显示所有不同的文本
    const uniqueTexts = [...new Set(results.map(r => r.text))];
    console.log('找到的不同文本:');
    uniqueTexts.forEach((text, i) => {
        console.log(`  ${i+1}. "${text}"`);
        const versionsWithThisText = results.filter(r => r.text === text).map(r => r.version);
        console.log(`     版本: ${versionsWithThisText.join(', ')}`);
    });
})();
