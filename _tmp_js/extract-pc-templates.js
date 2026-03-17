
const fs = require('fs');
const path = require('path');

const batchPath = path.join(__dirname, 'js', 'batch.js');
const content = fs.readFileSync(batchPath, 'utf-8');

const startMarker = 'const PT_PRESET_TEMPLATES = {';
const endMarker = '};';
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);

const templateSection = content.substring(startIdx + startMarker.length, endIdx);

const templateKeys = [];
let braceCount = 0;

const lines = templateSection.split('\n');

for (let i = 0; i &lt; lines.length; i++) {
    let line = lines[i].trim();
    
    if (line.startsWith('//') || line.startsWith('/*')) continue;
    if (line.includes('*/')) continue;
    
    if (braceCount === 0) {
        const match = line.match(/^([a-zA-Z0-9_]+):\s*\{/);
        if (match) {
            templateKeys.push(match[1]);
            braceCount = 1;
        }
    } else {
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        braceCount += openBraces - closeBraces;
    }
}

console.log('PC版提示词工坊模板列表 (' + templateKeys.length + '个):');
templateKeys.forEach((key, idx) =&gt; {
    console.log((idx + 1) + '. ' + key);
});

const output = `
// PC版提示词工坊模板键名
const PC_TEMPLATE_KEYS = [
${templateKeys.map(k =&gt; `  '${k}',`).join('\n')}
];
`;

fs.writeFileSync(path.join(__dirname, 'pc-template-keys.js'), output);
console.log('\n已保存到 pc-template-keys.js');

