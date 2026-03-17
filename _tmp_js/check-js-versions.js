const https = require('https');

const versions = [
    { name: 'latest', url: 'https://ai-video-batch-k7539usnx-adonisjinggws-projects.vercel.app' },
    { name: '7h', url: 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app' },
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
    console.log('检查js/batch.js中的漫画模型选择...\n');
    
    for (const version of versions) {
        const result = await downloadFile(version.url, 'js/batch.js');
        if (result.success) {
            console.log(`${version.name}: ${result.size.toLocaleString()} bytes`);
            
            // 检查是否有comicSettingImageModel
            const hasComicSetting = result.data.includes('comicSettingImageModel');
            const hasComicImageModel = result.data.includes('comicImageModel');
            const hasAddComicStyle = result.data.includes('addComicStyleSelector');
            
            console.log(`  comicSettingImageModel: ${hasComicSetting ? '✅' : '❌'}`);
            console.log(`  comicImageModel: ${hasComicImageModel ? '✅' : '❌'}`);
            console.log(`  addComicStyleSelector: ${hasAddComicStyle ? '✅' : '❌'}`);
            
            // 如果存在，显示模型选项
            if (hasComicSetting) {
                const match = result.data.match(/comicSettingImageModel[\s\S]{0,500}/);
                if (match) {
                    console.log('  找到代码片段');
                }
            }
        }
    }
})();
