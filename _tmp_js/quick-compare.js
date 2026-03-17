const fs = require('fs');

console.log('正在读取batch.js...');
const batchJsContent = fs.readFileSync('./js/batch.js', 'utf-8');
console.log('正在读取mobile.html...');
const mobileHtmlContent = fs.readFileSync('./mobile.html', 'utf-8');

console.log('\n========== 提取 batch.js 的 PROMPT_TEMPLATES ==========');
// 提取batch.js的PROMPT_TEMPLATES
const batchMatch = batchJsContent.match(/const PROMPT_TEMPLATES = \{([\s\S]*?)\n};/);
if (!batchMatch) {
  console.log('❌ 找不到 PROMPT_TEMPLATES 在 batch.js');
  process.exit(1);
}

console.log('✓ 找到 PROMPT_TEMPLATES');
// 简单提取所有key
const batchKeys = [];
const keyPattern = /^\s*([a-zA-Z_][a-zA-Z0-9_]*):\s*\{/gm;
let match;
while ((match = keyPattern.exec(batchMatch[1])) !== null) {
  if (!match[1].startsWith('//')) {
    batchKeys.push(match[1]);
  }
}
console.log(`✓ batch.js 有 ${batchKeys.length} 个模板`);

console.log('\n========== 提取 mobile.html 的 fillTemplates ==========');
const mobileMatch = mobileHtmlContent.match(/const fillTemplates = \{([\s\S]*?)\n        };/);
if (!mobileMatch) {
  console.log('❌ 找不到 fillTemplates 在 mobile.html');
  process.exit(1);
}
console.log('✓ 找到 fillTemplates');

const mobileKeys = [];
while ((match = keyPattern.exec(mobileMatch[1])) !== null) {
  if (!match[1].startsWith('//')) {
    mobileKeys.push(match[1]);
  }
}
console.log(`✓ mobile.html 有 ${mobileKeys.length} 个模板`);

console.log('\n========== 对比结果 ==========');
const missingFromMobile = batchKeys.filter(k => !mobileKeys.includes(k));
console.log(`❌ 手机版缺少的模板 (${missingFromMobile.length}个):`);
if (missingFromMobile.length > 0) {
  console.log(missingFromMobile.slice(0, 50));
  if (missingFromMobile.length > 50) {
    console.log(`... 还有 ${missingFromMobile.length - 50} 个`);
  }
} else {
  console.log('✓ 手机版不缺少任何模板！');
}

const extraInMobile = mobileKeys.filter(k => !batchKeys.includes(k));
console.log(`\n手机版有但电脑版没有的模板 (${extraInMobile.length}个):`);
if (extraInMobile.length > 0) {
  console.log(extraInMobile);
} else {
  console.log('✓ 没有额外模板');
}
