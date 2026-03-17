const fs = require('fs');
const path = require('path');

const batchJsPath = path.join(__dirname, 'js', 'batch.js');
const mobileHtmlPath = path.join(__dirname, 'mobile.html');

console.log('正在读取电脑版提示词工坊模板...');

const batchJsContent = fs.readFileSync(batchJsPath, 'utf-8');

// 找到PROMPT_TEMPLATES
const startIndex = batchJsContent.indexOf('const PROMPT_TEMPLATES = {');
const endIndex = batchJsContent.indexOf('};', startIndex) + 2;

const templatesStr = batchJsContent.substring(startIndex, endIndex);

// 提取所有模板
const templatesMatch = templatesStr.match(/([a-zA-Z0-9_]+):\s*\{[\s\S]*?\}(,|\n\s*\})/g);

const pcTemplates = {};
if (templatesMatch) {
    templatesMatch.forEach((match) => {
        // 简化解析
        const keyMatch = match.match(/^\s*([a-zA-Z0-9_]+):\s*\{/);
        if (keyMatch) {
            pcTemplates[keyMatch[1]] = true;
        }
    });
}

console.log(`✓ 找到 ${Object.keys(pcTemplates).length} 个电脑版模板`);

// 读取手机版
console.log('\n正在读取手机版...');
const mobileContent = fs.readFileSync(mobileHtmlPath, 'utf-8');

// 找到手机版的fillTemplates
const mobileStart = mobileContent.indexOf('const fillTemplates = {');
const mobileEnd = mobileContent.indexOf('};', mobileStart) + 2;

const mobileTemplatesStr = mobileContent.substring(mobileStart, mobileEnd);
const mobileTemplatesMatch = mobileTemplatesStr.match(/([a-zA-Z0-9_]+):\s*\{[\s\S]*?\}(,|\n\s*\})/g);

const mobileTemplates = {};
if (mobileTemplatesMatch) {
    mobileTemplatesMatch.forEach((match) => {
        const keyMatch = match.match(/^\s*([a-zA-Z0-9_]+):\s*\{/);
        if (keyMatch) {
            mobileTemplates[keyMatch[1]] = true;
        }
    });
}

console.log(`✓ 找到 ${Object.keys(mobileTemplates).length} 个手机版模板`);

// 找出缺失的
const missing = [];
Object.keys(pcTemplates).forEach(key => {
    if (!mobileTemplates[key]) {
        missing.push(key);
    }
});

console.log(`\n✗ 缺失 ${missing.length} 个模板`);
if (missing.length > 0) {
    console.log('缺失列表:');
    missing.forEach(k => console.log(`  - ${k}`));
}

// 现在直接从电脑版复制缺失的模板到手机版
// 先把电脑版的模板提取出来
let pcAllTemplates = {};
try {
    // 把batch.js里PROMPT_TEMPLATES之后的内容去掉
    const contentForEval = batchJsContent.substring(0, endIndex);
    // 用VM安全执行
    const vm = require('vm');
    const sandbox = {};
    vm.runInNewContext(contentForEval, sandbox);
    pcAllTemplates = sandbox.PROMPT_TEMPLATES;
    console.log('\n✓ 成功解析所有模板');
} catch (e) {
    console.log('解析错误:', e);
    process.exit(1);
}

// 生成要添加到手机版的模板代码
let additionalCode = '';
Object.keys(pcAllTemplates).forEach(key => {
    if (!mobileTemplates[key]) {
        const t = pcAllTemplates[key];
        additionalCode += `    ${key}: {
        name: '${t.name.replace(/'/g, "\\'")}',
        desc: '${(t.desc || '').replace(/'/g, "\\'")}',
        template: '${t.template.replace(/'/g, "\\'").replace(/\n/g, '\\n')}'
    },\n`;
    }
});

console.log('\n生成的代码长度:', additionalCode.length);

// 在手机版中添加
const insertPoint = '            calendar_birthday: { name: \'🎂 生日日历卡片\', desc: \'生日纪念日历设计\', template: \'生日主题日历卡片。顶部醒目显示：大号日期"______（生日日期如09/26）"，旁边"______（公历如2025.06）"、"______（农历如五月十四）"、"______（星期）"。主视觉：______（生日主题艺术图/人物插画/蛋糕场景），温馨欢乐氛围。底部：生日祝福"______（生日快乐/祝福语）"，寿星名字"______（姓名）"。蛋糕/气球/彩带装饰元素，竖版9:16比例\' }';

const newMobileContent = mobileContent.replace(
    insertPoint, 
    insertPoint + ',\n' + additionalCode
);

fs.writeFileSync(mobileHtmlPath, newMobileContent, 'utf-8');
console.log('\n✓ 成功更新手机版！');
console.log(`新增了 ${missing.length} 个模板`);
