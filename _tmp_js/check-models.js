// 从batch.js提取缺失模板，生成插入代码写入文件
const fs = require('fs');

const batchJs = fs.readFileSync('js/batch.js', 'utf8');
const mobileHtml = fs.readFileSync('mobile.html', 'utf8');

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

// 找缺失的key
const missing = pcKeys.filter(k => !mbKeys.has(k));
console.log(`电脑版: ${pcKeys.length}, 手机版: ${mbKeys.size}, 缺失: ${missing.length}`);

// 提取每个缺失key的完整定义（从key到下一个key之前）
const missingCode = [];
for (const key of missing) {
    // 找到这个key在ptBody中的位置
    const keyRe = new RegExp('(\\n\\s*(?://[^\\n]*\\n\\s*)*)(' + key + '\\s*:\\s*\\{)');
    const km = keyRe.exec(ptBody);
    if (!km) { console.log('WARN: cannot find', key); continue; }

    const startIdx = km.index + km[1].length;
    // 从key开始，找到匹配的}
    const sub = ptBody.substring(startIdx);
    let d = 0, endIdx = 0;
    for (let i = sub.indexOf('{'); i < sub.length; i++) {
        if (sub[i] === '{') d++;
        if (sub[i] === '}') { d--; if (d === 0) { endIdx = i + 1; break; } }
    }
    let entry = sub.substring(0, endIdx).trim();
    // 确保末尾有逗号
    if (!entry.endsWith(',')) entry += ',';

    // 如果前面有注释行，也带上
    const comments = km[1].trim();
    if (comments) {
        missingCode.push('            ' + comments);
    }
    missingCode.push('            ' + entry);
}

// 写入输出文件
const output = missingCode.join('\n');
fs.writeFileSync('missing_templates.txt', output, 'utf8');
console.log(`已生成 missing_templates.txt (${output.split('\n').length} 行, ${output.length} 字符)`);
console.log('\n前5行预览:');
output.split('\n').slice(0, 5).forEach(l => console.log(l.substring(0, 120)));

process.exit(0);

// ===== 以下原脚本不再执行 =====

function extractSelect(html, selectId) {
    const re = new RegExp('<select[^>]*id="' + selectId + '"[^>]*>([\\s\\S]*?)</select>', 'i');
    const m = re.exec(html);
    if (!m) return null;
    const opts = [];
    const optRe = /<option\s+value="([^"]+)"[^>]*>([^<]*)<\/option>/gi;
    let o;
    while (o = optRe.exec(m[1])) {
        opts.push({ value: o[1], label: o[2].trim() });
    }
    return opts;
}

// ========== 图片模型选择器 ==========
// 每个条目: { file, label, selectId }
const imageSelectors = [
    { file: 'banana.html', label: 'Banana页 modelSelect', selectId: 'modelSelect' },
    { file: 'sticker.html', label: '贴纸页 modelSelect', selectId: 'modelSelect' },
    { file: 'sticker.html', label: '贴纸页 batchModelSelect', selectId: 'batchModelSelect' },
    { file: 'mobile.html', label: '手机版 comicModel(漫画生图)', selectId: 'comicModel' },
    { file: 'mobile.html', label: '手机版 i2vImageModel(图生视频用图)', selectId: 'i2vImageModel' },
];

// ========== 视频模型选择器 ==========
const videoSelectors = [
    { file: 'index.html', label: 'PC版 quickGenMode', selectId: 'quickGenMode' },
    { file: 'mobile.html', label: '手机版 quickGenMode', selectId: 'quickGenMode' },
    { file: 'video-tools.html', label: '视频工具 t2vModel', selectId: 't2vModel' },
    { file: 'video-tools.html', label: '视频工具 i2vModel', selectId: 'i2vModel' },
    { file: 'video-tools.html', label: '视频工具 batchModel', selectId: 'batchModel' },
];

// ========== 混合模型选择器（同时有图片和视频） ==========
const mixedSelectors = [
    { file: 'index.html', label: 'PC版 commandModelSelect', selectId: 'commandModelSelect' },
];

function printComparison(title, selectors) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`  ${title}`);
    console.log('='.repeat(50));

    // 收集所有value的并集
    const allValues = new Set();
    const selectorData = [];
    for (const s of selectors) {
        try {
            const html = fs.readFileSync(s.file, 'utf8');
            const opts = extractSelect(html, s.selectId);
            if (!opts) { selectorData.push({ ...s, opts: [] }); continue; }
            selectorData.push({ ...s, opts });
            opts.forEach(o => allValues.add(o.value));
        } catch (e) {
            selectorData.push({ ...s, opts: [] });
        }
    }

    // 打印每个选择器的数量
    for (const s of selectorData) {
        console.log(`  [${s.label}] ${s.opts.length} 个选项`);
    }

    // 找出最完整的选择器作为基准
    let maxOpts = selectorData.reduce((a, b) => a.opts.length > b.opts.length ? a : b);
    console.log(`\n  基准(最完整): ${maxOpts.label} (${maxOpts.opts.length}项)`);
    console.log(`  基准选项: ${maxOpts.opts.map(o => o.value).join(', ')}`);

    // 对比每个选择器缺少哪些
    const baseValues = new Set(maxOpts.opts.map(o => o.value));
    for (const s of selectorData) {
        if (s === maxOpts) continue;
        const sValues = new Set(s.opts.map(o => o.value));
        const missing = [...baseValues].filter(v => !sValues.has(v));
        const extra = [...sValues].filter(v => !baseValues.has(v));
        if (missing.length === 0 && extra.length === 0) {
            console.log(`\n  ${s.label} ✅ 与基准一致`);
        } else {
            if (missing.length > 0) {
                console.log(`\n  ${s.label} 缺少 ${missing.length} 个:`);
                missing.forEach(v => {
                    const ref = maxOpts.opts.find(o => o.value === v);
                    console.log(`    ❌ ${v} (${ref ? ref.label : ''})`);
                });
            }
            if (extra.length > 0) {
                console.log(`  ${s.label} 多出 ${extra.length} 个:`);
                extra.forEach(v => {
                    const ref = s.opts.find(o => o.value === v);
                    console.log(`    ➕ ${v} (${ref ? ref.label : ''})`);
                });
            }
        }
    }
}

printComparison('图片模型选择器对比', imageSelectors);
printComparison('视频模型选择器对比', videoSelectors);
printComparison('混合模型选择器(commandModelSelect)', mixedSelectors);
