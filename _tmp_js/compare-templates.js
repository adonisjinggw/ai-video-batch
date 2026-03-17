const fs = require('fs');
const path = require('path');

console.log('正在读取文件...');

// 读取batch.js并提取模版
const batchPath = path.join(__dirname, 'js', 'batch.js');
const batchContent = fs.readFileSync(batchPath, 'utf8');
const batchStart = batchContent.indexOf('const PROMPT_TEMPLATES = {');
const batchEnd = batchContent.indexOf('};', batchStart + 20000);
const batchTemplateStr = batchContent.substring(batchStart + 27, batchEnd);

// 简单提取key
const batchKeys = [];
const batchLines = batchTemplateStr.split('\n');
for (let line of batchLines) {
    const match = line.match(/^\s*([a-z_][a-z0-9_]*)\s*:/i);
    if (match) {
        if (match[1] && !['//'.includes(match[1])) {
            batchKeys.push(match[1]);
        }
    }
}

console.log('batch.js模版keys:', batchKeys.filter(k => k.length > 0 && k !== '');

// 读取mobile.html
const mobilePath = path.join(__dirname, 'mobile.html');
const mobileContent = fs.readFileSync(mobilePath, 'utf8');
const mobileStart = mobileContent.indexOf('const fillTemplates = {');
const mobileEnd = mobileContent.indexOf('};', mobileStart + 20000);
const mobileTemplateStr = mobileContent.substring(mobileStart + 25, mobileEnd);

// 简单提取key
const mobileKeys = [];
const mobileLines = mobileTemplateStr.split('\n');
for (let line of mobileLines) {
    const match = line.match(/^\s*([a-z_][a-z0-9_]*)\s*:/i);
    if (match) {
        if (match[1] && !['//'.includes(match[1])) {
            mobileKeys.push(match[1]);
        }
    }
}

console.log('mobile.html模版keys:', mobileKeys.filter(k => k.length > 0 && k !== ''));

console.log('\n对比...');
const missing = batchKeys.filter(k => !mobileKeys.includes(k));
console.log('手机版缺少的模版:', missing);
console.log('缺失数量:', missing.length);
