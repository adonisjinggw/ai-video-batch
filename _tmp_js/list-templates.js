
const fs = require('fs');

// 读取batch.js文件
const content = fs.readFileSync('js/batch.js', 'utf8');

// 找到PT_PRESET_TEMPLATES的位置
const ptStart = content.indexOf('const PT_PRESET_TEMPLATES = {');
const ptEnd = content.indexOf('};', ptStart);
const ptContent = content.substring(ptStart, ptEnd + 2);

// 提取模板键名
const lines = ptContent.split('\n');
const templateKeys = [];
let braceCount = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (braceCount === 0) {
        const match = line.match(/^([a-z_]+):\s*\{/);
        if (match && !line.startsWith('//')) {
            templateKeys.push(match[1]);
            braceCount = 1;
        }
    } else {
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;
    }
}

console.log('PT_PRESET_TEMPLATES 中的模板列表:');
console.log('='.repeat(50));
templateKeys.forEach((key, index) => {
    console.log(`${index + 1}. ${key}`);
});
console.log('='.repeat(50));
console.log(`共找到 ${templateKeys.length} 个模板');
