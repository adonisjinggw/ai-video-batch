const fs = require('fs');

const filePath = 'j:\\123pan\\13998416173\\NanoNoPort\\ai-video-batch\\mobile.html';

// 读取文件
let content = fs.readFileSync(filePath);

// 检查并移除BOM
if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
    console.log('移除UTF-8 BOM');
    content = content.slice(3);
}

// 转换为字符串
let str = content.toString('utf-8');

// 替换所有乱码字符
const replacements = [
    { from: /ï¿½/g, to: '' },
    { from: /�/g, to: '' },
    { from: /\uFFFD/g, to: '' },
    { from: /\u0000/g, to: '' },
];

let fixedCount = 0;
replacements.forEach(({ from, to }) => {
    const matches = str.match(from);
    if (matches) {
        str = str.replace(from, to);
        fixedCount += matches.length;
        console.log(`修复 ${matches.length} 处乱码`);
    }
});

// 保存文件
fs.writeFileSync(filePath, str, 'utf-8');
console.log(`\n总共修复 ${fixedCount} 处乱码`);
console.log('文件已保存为UTF-8无BOM格式');
