const https = require('https');
const fs = require('fs');

// 下载7小时前的版本进行比较
const url = 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app/mobile.html';
const localPath = 'j:\\123pan\\13998416173\\NanoNoPort\\ai-video-batch\\mobile.html';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        // 比较fillTemplates
        const oldMatch = data.match(/const fillTemplates\s*=\s*\{[\s\S]*?\n\s*\};/);
        const localContent = fs.readFileSync(localPath, 'utf-8');
        const newMatch = localContent.match(/const fillTemplates\s*=\s*\{[\s\S]*?\n\s*\};/);
        
        if (oldMatch && newMatch) {
            const oldKeys = oldMatch[0].match(/fill_\w+:/g) || [];
            const newKeys = newMatch[0].match(/fill_\w+:/g) || [];
            
            console.log('7小时前版本模板数:', oldKeys.length);
            console.log('当前版本模板数:', newKeys.length);
            
            const missingInNew = oldKeys.filter(k => !newKeys.includes(k));
            const extraInNew = newKeys.filter(k => !oldKeys.includes(k));
            
            if (missingInNew.length > 0) {
                console.log('\n当前版本缺失的模板:');
                missingInNew.forEach(k => console.log('  -', k));
            }
            
            if (extraInNew.length > 0) {
                console.log('\n当前版本新增的模板:');
                extraInNew.forEach(k => console.log('  -', k));
            }
            
            if (missingInNew.length === 0 && extraInNew.length === 0) {
                console.log('\n✓ 模板完全一致');
            }
        }
    });
}).on('error', (e) => console.error('Error:', e.message));
