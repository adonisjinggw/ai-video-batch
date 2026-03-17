const fs = require('fs');

const filePath = 'j:\\123pan\\13998416173\\NanoNoPort\\ai-video-batch\\mobile.html';
const content = fs.readFileSync(filePath);

// 检查BOM
if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
    console.log('文件有UTF-8 BOM');
} else if (content[0] === 0xFF && content[1] === 0xFE) {
    console.log('文件有UTF-16 LE BOM');
} else if (content[0] === 0xFE && content[1] === 0xFF) {
    console.log('文件有UTF-16 BE BOM');
} else {
    console.log('文件无BOM');
}

// 读取第2475行
const lines = content.toString('utf-8').split('\n');
const line2475 = lines[2474]; // 数组索引从0开始

console.log('\n=== 第2475行内容 ===');
console.log(line2475);
console.log('\n=== 第2475行长度 ===');
console.log(line2475.length);

// 检查是否有乱码字符
const garbledPattern = /[^\x00-\x7F\u4e00-\u9fa5\u3000-\u303F\uFF00-\uFFEF\u2000-\u206F\u2600-\u26FF\u2700-\u27BF\u{1F300}-\u{1F9FF}]/gu;
const matches = line2475.match(garbledPattern);
if (matches) {
    console.log('\n=== 发现非标准字符 ===');
    matches.forEach((char, i) => {
        console.log(`字符 ${i+1}: "${char}" (charCode: ${char.charCodeAt(0)})`);
    });
} else {
    console.log('\n=== 无非标准字符 ===');
}

// 检查引号是否配对
const singleQuotes = (line2475.match(/'/g) || []).length;
const doubleQuotes = (line2475.match(/"/g) || []).length;
console.log(`\n单引号数量: ${singleQuotes}`);
console.log(`双引号数量: ${doubleQuotes}`);

// 检查花括号
const openBraces = (line2475.match(/{/g) || []).length;
const closeBraces = (line2475.match(/}/g) || []).length;
console.log(`左花括号数量: ${openBraces}`);
console.log(`右花括号数量: ${closeBraces}`);
