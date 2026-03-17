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
];

function downloadFile(url, file) {
    return new Promise((resolve) => {
        const fullUrl = `${url}/${file}`;
        https.get(fullUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ success: true, data }));
        }).on('error', (e) => resolve({ success: false, error: e.message }));
    });
}

(async () => {
    console.log('搜索"图内嵌入"相关代码...\n');
    
    for (const version of versions) {
        const result = await downloadFile(version.url, 'js/batch.js');
        if (result.success) {
            // 查找comicDialogMode选项
            const matches = result.data.match(/comicDialogMode[\s\S]{0,500}/g);
            if (matches) {
                console.log(`\n=== ${version.name} ===`);
                matches.slice(0, 2).forEach((match, i) => {
                    console.log(`  匹配${i+1}:`);
                    console.log('  ' + match.substring(0, 300).replace(/\n/g, '\n  '));
                });
            }
        }
    }
})();
