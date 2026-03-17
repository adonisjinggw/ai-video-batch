const https = require('https');
const fs = require('fs');
const path = require('path');

const baseUrl = 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app';

const filesToRestore = [
    'mobile.html',
    'banana.html',
    'writing.html',
    'index.html',
    'voice.html',
    'chat.html'
];

function downloadFile(file) {
    return new Promise((resolve) => {
        const url = `${baseUrl}/${file}`;
        const outputPath = path.join('j:\\123pan\\13998416173\\NanoNoPort\\ai-video-batch', file);

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                fs.writeFileSync(outputPath, data, 'utf-8');
                console.log(`✅ ${file} - 已恢复 (${data.length} bytes)`);
                resolve({ file, success: true, size: data.length });
            });
        }).on('error', (e) => {
            console.log(`❌ ${file} - 下载失败: ${e.message}`);
            resolve({ file, success: false, error: e.message });
        });
    });
}

(async () => {
    console.log('正在从7小时前版本全面恢复...\n');
    console.log(`源地址: ${baseUrl}\n`);

    for (const file of filesToRestore) {
        await downloadFile(file);
    }

    console.log('\n✅ 恢复完成！');
})();
