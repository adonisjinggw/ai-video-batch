
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
while (i &lt; templateSection.length) {
    if (templateSection[i] === '{') {
        braceCount++;
    } else if (templateSection[i] === '}') {
        braceCount--;
    }
    
    if (braceCount === 0 &amp;&amp; !templateSection.substring(0, i).trim().endsWith(',')) {
        const keyMatch = templateSection.substring(0, i).match(/^\s*([a-zA-Z0-9_]+)\s*:/);
        if (keyMatch) {
            templateKeys.push(keyMatch[1]);
        }
        templateSection = templateSection.substring(i);
        i = 0;
        continue;
    }
    i++;
}

console.log('Found templates:', templateKeys);

