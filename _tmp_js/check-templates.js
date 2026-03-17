const fs = require('fs');
const path = require('path');

// 读取batch.js
const batchPath = path.join(__dirname, 'js', 'batch.js');
const batchContent = fs.readFileSync(batchPath, 'utf8');

// 读取mobile.html
const mobilePath = path.join(__dirname, 'mobile.html');
const mobileContent = fs.readFileSync(mobilePath, 'utf8');

// 提取batch.js里的PROMPT_TEMPLATES的key
console.log('正在提取batch.js里的模版keys...');
const batchMatch = batchContent.match(/const PROMPT_TEMPLATES = \{([\s\S]*?)\};\s*\/\//);
let batchKeys = [];
if (batchMatch) {
    const templateObjStr = batchMatch[1];
    const keyMatches = templateObjStr.match(/^\s*([a-z_][a-z0-9_]*)\s*:/gmi);
    if (keyMatches) {
        batchKeys = keyMatches.map(k => k.trim().replace(/:$/, ''));
    }
}
console.log('batch.js模版数量:', batchKeys.length);
console.log('batch.js模版列表:', batchKeys);

// 提取mobile.html里的fillTemplates的key
console.log('\n正在提取mobile.html里的模版keys...');
const mobileMatch = mobileContent.match(/const fillTemplates = \{([\s\S]*?)\};\s*\/\//);
let mobileKeys = [];
if (mobileMatch) {
    const templateObjStr = mobileMatch[1];
    const keyMatches = templateObjStr.match(/^\s*([a-z_][a-z0-9_]*)\s*:/gmi);
    if (keyMatches) {
        mobileKeys = keyMatches.map(k => k.trim().replace(/:$/, ''));
    }
}
console.log('mobile.html模版数量:', mobileKeys.length);
console.log('mobile.html模版列表:', mobileKeys);

// 对比
console.log('\n手机版缺少的模版:');
const missing = batchKeys.filter(k => !mobileKeys.includes(k));
console.log(missing);
console.log('\n缺失数量:', missing.length);
