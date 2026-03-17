const https = require('https');
const fs = require('fs');

const url = 'https://rollroll.art/mobile.html';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('=== 检查部署版本 ===\n');
        
        // 保存到文件
        fs.writeFileSync('deployed-mobile.html', data);
        console.log('已保存到 deployed-mobile.html\n');
        
        // 检查版本号
        const versionMatch = data.match(/<title>RollRoll 移动版 (V[\d.]+)/);
        if (versionMatch) {
            console.log(`线上版本: ${versionMatch[1]}`);
        }
        
        // 检查switchMode函数
        if (data.includes('function switchMode')) {
            console.log('✅ switchMode函数已定义');
        } else {
            console.log('❌ switchMode函数未定义');
        }
        
        // 检查Season\'s
        if (data.includes("Season's Greetings")) {
            console.log('✅ Season\\'s Greetings 正常');
        } else if (data.includes("Season\\'s Greetings")) {
            console.log('⚠️ Season\\\\'s Greetings 有转义问题');
        }
        
        // 检查是否有语法错误提示
        const lines = data.split('\n');
        console.log(`\n总行数: ${lines.length}`);
        
        // 检查第188行附近
        if (lines[187]) {
            console.log(`\n第188行: ${lines[187].substring(0, 100)}...`);
        }
    });
}).on('error', (e) => {
    console.error('检查失败:', e.message);
});
