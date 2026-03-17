// 直接将缺失模板插入到 mobile.html 的 fillTemplates 中
const fs = require('fs');

const batchJs = fs.readFileSync('js/batch.js', 'utf8');
let mobileHtml = fs.readFileSync('mobile.html', 'utf8');

// 提取 PROMPT_TEMPLATES 整个对象体
const ptStart = batchJs.indexOf('const PROMPT_TEMPLATES = {');
let depth = 0, ptEnd = 0;
for (let i = ptStart + 26; i < batchJs.length; i++) {
    if (batchJs[i] === '{') depth++;
    if (batchJs[i] === '}') { if (depth === 0) { ptEnd = i; break; } depth--; }
}
const ptBody = batchJs.substring(ptStart + 26, ptEnd);

// 提取手机版已有的key
const mbMatch = mobileHtml.match(/const fillTemplates\s*=\s*\{([\s\S]*?)\n\s*\};/);
const mbKeys = new Set();
const re1 = /(\w+)\s*:\s*\{/g;
let m1;
while (m1 = re1.exec(mbMatch[1])) mbKeys.add(m1[1]);

// 提取电脑版所有key
const pcKeys = [];
const re2 = /(\w+)\s*:\s*\{/g;
let m2;
while (m2 = re2.exec(ptBody)) pcKeys.push(m2[1]);

const missing = pcKeys.filter(k => !mbKeys.has(k));
console.log('电脑版:', pcKeys.length, '手机版:', mbKeys.size, '缺失:', missing.length);

// 提取每个缺失key的完整定义，转为单行格式
const lines = [];
for (const key of missing) {
    const idx = ptBody.indexOf(key + ':');
    if (idx === -1) { console.log('WARN skip:', key); continue; }
    
    const sub = ptBody.substring(idx);
    const braceStart = sub.indexOf('{');
    let d = 0, braceEnd = 0;
    for (let i = braceStart; i < sub.length; i++) {
        if (sub[i] === '{') d++;
        if (sub[i] === '}') { d--; if (d === 0) { braceEnd = i + 1; break; } }
    }
    let entry = sub.substring(0, braceEnd);
    
    // 转为单行格式（和手机版已有模板风格一致）
    entry = entry.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (!entry.endsWith(',')) entry += ',';
    
    lines.push('            ' + entry);
}

console.log('提取了', lines.length, '个模板定义');

// 构建插入内容
const insertContent = '\n            // ==================== 从电脑版同步的模板 ====================\n' + lines.join('\n');

// 在 fillTemplates 的 }; 之前插入
const fillStart = mobileHtml.indexOf('const fillTemplates');
const closingBrace = mobileHtml.indexOf('        };', fillStart);
if (closingBrace === -1) { console.log('ERROR: 找不到插入点'); process.exit(1); }

mobileHtml = mobileHtml.substring(0, closingBrace) + insertContent + '\n' + mobileHtml.substring(closingBrace);

fs.writeFileSync('mobile.html', mobileHtml, 'utf8');
console.log('已写入 mobile.html');

// 验证
const newHtml = fs.readFileSync('mobile.html', 'utf8');
const newMatch = newHtml.match(/const fillTemplates\s*=\s*\{([\s\S]*?)\n\s*\};/);
const newKeys = new Set();
const re3 = /(\w+)\s*:\s*\{/g;
let m3;
while (m3 = re3.exec(newMatch[1])) newKeys.add(m3[1]);
console.log('更新后手机版模板数:', newKeys.size);

const stillMissing = missing.filter(k => !newKeys.has(k));
if (stillMissing.length > 0) {
    console.log('仍然缺失:', stillMissing.join(', '));
} else {
    console.log('全部补全，无遗漏');
}
