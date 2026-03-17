const https = require('https');

const url = 'https://rollroll.art/mobile.html';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('检查线上版本乱码...\n');
        
        // 检查特定文本
        const checkTexts = [
            '从灵感闪现到成片',
            '输入区域',
            '选项',
            '战服，',
            '花边和',
            '动作帅气',
            '下方',
            '工作室动画',
            '大师】',
            '标签',
            '高价',
            '按钮'
        ];
        
        let hasGarbled = false;
        checkTexts.forEach(text => {
            if (data.includes(text)) {
                console.log(`✅ "${text}" - 正常`);
            } else {
                console.log(`❌ "${text}" - 可能缺失或有乱码`);
                hasGarbled = true;
            }
        });
        
        // 检查乱码字符
        const garbledPattern = /ï¿½|�/;
        if (garbledPattern.test(data)) {
            console.log('\n⚠️  发现乱码字符！');
            hasGarbled = true;
        } else {
            console.log('\n✅ 未发现乱码字符');
        }
        
        if (hasGarbled) {
            console.log('\n❌ 线上版本可能还有乱码问题');
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
