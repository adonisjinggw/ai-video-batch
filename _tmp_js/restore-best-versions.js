const https = require('https');
const fs = require('fs');
const path = require('path');

// 根据分析，各文件应该从以下版本恢复
const restorePlan = [
    { file: 'index.html', version: '7h', url: 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app' },
    { file: 'mobile.html', version: 'latest', url: 'https://ai-video-batch-4b37cuyp1-adonisjinggws-projects.vercel.app' },
    { file: 'banana.html', version: 'latest', url: 'https://ai-video-batch-4b37cuyp1-adonisjinggws-projects.vercel.app' },
    { file: 'writing.html', version: 'latest', url: 'https://ai-video-batch-4b37cuyp1-adonisjinggws-projects.vercel.app' },
    { file: 'chat.html', version: 'latest', url: 'https://ai-video-batch-4b37cuyp1-adonisjinggws-projects.vercel.app' },
    { file: 'voice.html', version: 'latest', url: 'https://ai-video-batch-4b37cuyp1-adonisjinggws-projects.vercel.app' },
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
    console.log('开始从最佳版本恢复文件...\n');
    console.log('恢复计划:');
    restorePlan.forEach(p => {
        console.log(`  - ${p.file}: 从 ${p.version} 版本恢复`);
    });
    console.log('');
    
    for (const item of restorePlan) {
        const result = await downloadFile(item.url, item.file);
        if (result.success) {
            const outputPath = path.join('j:\\123pan\\13998416173\\NanoNoPort\\ai-video-batch', item.file);
            fs.writeFileSync(outputPath, result.data, 'utf-8');
            console.log(`✅ ${item.file}: 已恢复 (${result.size.toLocaleString()} bytes) 从 ${item.version}`);
        } else {
            console.log(`❌ ${item.file}: 恢复失败 - ${result.error}`);
        }
    }
    
    console.log('\n✅ 恢复完成！');
    console.log('\n注意：mobile.html可能需要添加Gemini模型选项');
})();
