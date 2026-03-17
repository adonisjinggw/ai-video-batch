
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
let i = 0;
let currentKey = '';

const lines = templateSection.split('\n');

for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*')) continue;
    
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

console.log('找到 ' + templateKeys.length + ' 个PC版模板:');
templateKeys.forEach((key, idx) =&gt; {
    console.log((idx + 1) + '. ' + key);
});

console.log('\n=== 完整列表 ===');
console.log(JSON.stringify(templateKeys, null, 2));

