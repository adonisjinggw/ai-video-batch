const https = require('https');
const fs = require('fs');

const url = 'https://rollroll.art/mobile.html';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('=== 线上版本乱码检查 ===\n');
        
        // 保存到文件以便检查
        fs.writeFileSync('online-mobile.html', data);
        
        // 检查特定文本
        const checkTexts = [
            { text: '从灵感闪现到成片', desc: '欢迎页描述' },
            { text: '输入区域', desc: '输入区注释' },
            { text: '选项', desc: '网格图选项' },
            { text: '战服，', desc: '超级英雄模板' },
            { text: '花边和', desc: 'Lolita模板' },
            { text: '动作帅气', desc: '架子鼓模板' },
            { text: '下方', desc: '红包模板' },
            { text: '工作室动画', desc: '吉卜力模板' },
            { text: '大师】', desc: '艺术大师模板' },
            { text: '标签', desc: '电商Banner' },
            { text: '高价', desc: 'Vidu模型' },
            { text: '按钮', desc: '操作按钮' }
        ];
        
        let hasGarbled = false;
        checkTexts.forEach(item => {
            if (data.includes(item.text)) {
                console.log(`✅ "${item.text}" - ${item.desc}`);
            } else {
                console.log(`❌ "${item.text}" - ${item.desc} - 缺失或有乱码`);
                hasGarbled = true;
            }
        });
        
        // 检查乱码字符
        const garbledMatches = data.match(/ï¿½|�/g);
        if (garbledMatches) {
            console.log(`\n⚠️  发现 ${garbledMatches.length} 处乱码字符！`);
            hasGarbled = true;
            
            // 显示乱码位置
            const lines = data.split('\n');
            lines.forEach((line, index) => {
                if (/ï¿½|�/.test(line)) {
                    console.log(`  第 ${index + 1} 行: ${line.substring(0, 100)}...`);
                }
            });
        } else {
            console.log('\n✅ 未发现乱码字符');
        }
        
        console.log(`\n文件大小: ${data.length} bytes`);
        
        if (hasGarbled) {
            console.log('\n❌ 线上版本仍有乱码问题，需要重新部署');
            process.exit(1);
        } else {
            console.log('\n✅ 线上版本无乱码');
            process.exit(0);
        }
    });
}).on('error', (e) => {
    console.error('检查失败:', e.message);
    process.exit(1);
});
