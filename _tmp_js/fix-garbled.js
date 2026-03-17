const fs = require('fs');

const filePath = 'j:\\123pan\\13998416173\\NanoNoPort\\ai-video-batch\\mobile.html';
let content = fs.readFileSync(filePath, 'utf-8');

// 定义乱码修复映射
const fixes = [
    { from: '�����', to: '' },
    { from: '��', to: '' },
    { from: '���', to: '' },
    { from: '��', to: '酷' },
    { from: '��', to: '和' },
    { from: '��', to: '签' },
    { from: '��', to: '元' },
    { from: '��', to: '动' },
    { from: '��', to: '画' },
    { from: '��', to: '风' },
    { from: '��', to: '高' },
    { from: '��', to: '旦' },
    { from: '��', to: '按' },
    { from: '��', to: '钮' },
    { from: '��', to: '价' },
];

let fixedCount = 0;
fixes.forEach(fix => {
    const regex = new RegExp(fix.from, 'g');
    const matches = content.match(regex);
    if (matches) {
        content = content.replace(regex, fix.to);
        fixedCount += matches.length;
        console.log(`修复: "${fix.from}" -> "${fix.to}" (${matches.length}处)`);
    }
});

fs.writeFileSync(filePath, content, 'utf-8');
console.log(`\n总共修复了 ${fixedCount} 处乱码`);
