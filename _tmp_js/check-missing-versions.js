const https = require('https');

// 检查可能被跳过的版本（包括Canceled的）
const versions = [
    { name: 'kl7ibexim (7h)', url: 'https://ai-video-batch-kl7ibexim-adonisjinggws-projects.vercel.app' },
    { name: '5xe2s0mi6 (7h)', url: 'https://ai-video-batch-5xe2s0mi6-adonisjinggws-projects.vercel.app' },
    { name: 'bbkdi8zrd (7h)', url: 'https://ai-video-batch-bbkdi8zrd-adonisjinggws-projects.vercel.app' },
    { name: '6wbdno3d4 (12h)', url: 'https://ai-video-batch-6wbdno3d4-adonisjinggws-projects.vercel.app' },
    { name: '5hs1ggl6j (14h)', url: 'https://ai-video-batch-5hs1ggl6j-adonisjinggws-projects.vercel.app' },
    { name: '5bu7pdmat (14h)', url: 'https://ai-video-batch-5bu7pdmat-adonisjinggws-projects.vercel.app' },
];

function downloadFile(url, file) {
    return new Promise((resolve) => {
        const fullUrl = `${url}/${file}`;
        https.get(fullUrl, (res) => {
            if (res.statusCode === 404) {
                resolve({ success: false, status: 404 });
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ success: true, data, size: data.length }));
        }).on('error', (e) => resolve({ success: false, error: e.message }));
    });
}

(async () => {
    console.log('检查可能被跳过的版本...\n');
    
    for (const version of versions) {
        const result = await downloadFile(version.url, 'js/batch.js');
        if (result.success) {
            // 查找comicDialogMode选项
            const matches = result.data.matchAll(/<option value="embedded"[^>]*>([^<]+)<\/option>/g);
            const texts = [];
            for (const match of matches) {
                texts.push(match[1].trim());
            }
            
            if (texts.length > 0) {
                console.log(`${version.name}: ${result.size.toLocaleString()} bytes`);
                console.log(`  图内嵌入选项: ${texts.join(' | ')}`);
                
                // 检查是否有banana2-4k相关文本
                if (result.data.includes('banana2-4k') && result.data.includes('embedded')) {
                    const idx = result.data.indexOf('embedded');
                    const nearby = result.data.substring(idx - 200, idx + 200);
                    console.log('  ⚠️ 包含embedded和banana2-4k');
                }
            }
        } else if (result.status === 404) {
            console.log(`${version.name}: ❌ 404 Not Found (可能已删除)`);
        }
    }
})();
