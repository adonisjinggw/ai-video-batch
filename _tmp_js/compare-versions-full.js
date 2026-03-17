const https = require('https');
const fs = require('fs');

// 7小时前版本 vs 最新版本
const versions = {
    '7h': 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app',
    'latest': 'https://ai-video-batch-4b37cuyp1-adonisjinggws-projects.vercel.app'
};

const filesToCheck = [
    'index.html',
    'mobile.html',
    'banana.html',
    'writing.html',
    'chat.html',
    'voice.html'
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
    console.log('比较7小时前版本 vs 最新版本的文件差异...\n');
    
    const results = {};
    
    for (const file of filesToCheck) {
        console.log(`\n=== ${file} ===`);
        
        const v7h = await downloadFile(versions['7h'], file);
        const vLatest = await downloadFile(versions['latest'], file);
        
        if (v7h.success && vLatest.success) {
            const size7h = v7h.size;
            const sizeLatest = vLatest.size;
            const diff = sizeLatest - size7h;
            
            console.log(`  7h版本: ${size7h.toLocaleString()} bytes`);
            console.log(`  最新版本: ${sizeLatest.toLocaleString()} bytes`);
            console.log(`  差异: ${diff > 0 ? '+' : ''}${diff.toLocaleString()} bytes (${diff > 0 ? '增加' : diff < 0 ? '减少' : '相同'})`);
            
            // 检查关键功能是否存在
            const features = {
                '论文功能': /论文|paper|thesis/i,
                '长篇小说功能': /长篇小说|novel/i,
                'Gemini模型': /gemini-3\.1-flash/i,
                'Banana2模型': /nano-banana-2/i,
                '日历模板': /calendar|日历/i,
                '圣诞贺卡': /christmas|圣诞/i,
                '春节红包': /红包|spring.*festival/i,
                '批量漫画': /batch.*comic|批量漫画/i,
                'AI对话': /chat|对话/i,
                '语音功能': /voice|tts|语音/i
            };
            
            console.log('  功能检查:');
            for (const [feature, regex] of Object.entries(features)) {
                const has7h = regex.test(v7h.data);
                const hasLatest = regex.test(vLatest.data);
                const status = has7h === hasLatest ? (has7h ? '✅ 都有' : '❌ 都无') : 
                               has7h ? '⚠️ 7h有,最新无' : '⚠️ 7h无,最新有';
                console.log(`    ${feature}: ${status}`);
            }
            
            results[file] = { size7h, sizeLatest, diff };
        } else {
            console.log(`  ❌ 无法下载: 7h=${v7h.success}, 最新=${vLatest.success}`);
        }
    }
    
    console.log('\n\n=== 总结 ===');
    console.log('建议恢复策略:');
    for (const [file, data] of Object.entries(results)) {
        if (data.diff < -1000) {
            console.log(`  📥 ${file}: 最新版本减少${Math.abs(data.diff).toLocaleString()} bytes，建议从7h恢复`);
        } else if (data.diff > 1000) {
            console.log(`  📤 ${file}: 最新版本增加${data.diff.toLocaleString()} bytes，可能有新功能`);
        } else {
            console.log(`  ✅ ${file}: 差异较小(${data.diff.toLocaleString()} bytes)`);
        }
    }
})();
