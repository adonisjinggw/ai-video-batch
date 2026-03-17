const fs = require('fs');

console.log('📋 正在读取文件...\n');

try {
  const batchJs = fs.readFileSync('./js/batch.js', 'utf8');
  const mobileHtml = fs.readFileSync('./mobile.html', 'utf8');

  // 1. 从batch.js提取PROMPT_TEMPLATES
  const batchMatch = batchJs.match(/const PROMPT_TEMPLATES = \{([\s\S]*?)\n};/);
  if (!batchMatch) {
    console.error('❌ 找不到 PROMPT_TEMPLATES');
    process.exit(1);
  }
  
  const batchKeys = [];
  const keyPattern = /^\s*([a-zA-Z_][a-zA-Z0-9_]*):\s*\{/gm;
  let match;
  while ((match = keyPattern.exec(batchMatch[1])) !== null) {
    if (!match[1].startsWith('//')) {
      batchKeys.push(match[1]);
    }
  }
  console.log(`✅ 电脑版 PROMPT_TEMPLATES: ${batchKeys.length} 个模板`);

  // 2. 从mobile.html提取fillTemplates
  const mobileMatch = mobileHtml.match(/const fillTemplates = \{([\s\S]*?)\n        };/);
  if (!mobileMatch) {
    console.error('❌ 找不到 fillTemplates');
    process.exit(1);
  }
  
  const mobileKeys = [];
  while ((match = keyPattern.exec(mobileMatch[1])) !== null) {
    if (!match[1].startsWith('//')) {
      mobileKeys.push(match[1]);
    }
  }
  console.log(`✅ 手机版 fillTemplates: ${mobileKeys.length} 个模板\n`);

  // 3. 找出手机版缺少的
  const missingFromMobile = batchKeys.filter(k => !mobileKeys.includes(k));
  
  console.log('❌ 手机版缺少的模板:', missingFromMobile.length, '个');
  if (missingFromMobile.length > 0) {
    console.log('\n📋 缺少的模板列表:');
    missingFromMobile.forEach((k, i) => console.log(`  ${i+1}. ${k}`));
  } else {
    console.log('🎉 手机版不缺少任何模板！');
  }
  
  // 4. 找出手机版多出的
  const extraInMobile = mobileKeys.filter(k => !batchKeys.includes(k));
  if (extraInMobile.length > 0) {
    console.log('\n📱 手机版额外的模板:', extraInMobile.length, '个');
    extraInMobile.forEach((k, i) => console.log(`  ${i+1}. ${k}`));
  }

} catch (e) {
  console.error('❌ 错误:', e);
}
