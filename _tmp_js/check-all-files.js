const fs = require('fs');
const path = require('path');

const filesToCheck = [
    'mobile.html',
    'index.html',
    'banana.html',
    'writing.html',
    'chat.html',
    'voice.html',
    'js/batch.js',
    'js/skill-system.js',
    'js/skill-presets.js',
    'js/api-core.js',
    'js/billing.js'
];

function checkFile(filePath) {
    const fullPath = path.join('j:\\123pan\\13998416173\\NanoNoPort\\ai-video-batch', filePath);
    
    if (!fs.existsSync(fullPath)) {
        return { file: filePath, exists: false, error: '文件不存在' };
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    const errors = [];
    
    // 检查JavaScript语法
    const scriptMatches = content.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    if (scriptMatches) {
        scriptMatches.forEach((script, index) => {
            const jsCode = script.replace(/<script[^>]*>|<\/script>/g, '');
            try {
                new Function(jsCode);
            } catch (e) {
                errors.push({
                    type: 'JavaScript语法错误',
                    scriptIndex: index + 1,
                    message: e.message,
                    line: e.lineNumber || '未知'
                });
            }
        });
    }
    
    // 检查常见的语法问题
    // 1. 检查未闭合的括号
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
        errors.push({ type: '括号不匹配', message: `开括号: ${openParens}, 闭括号: ${closeParens}` });
    }
    
    // 2. 检查未闭合的大括号
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        errors.push({ type: '大括号不匹配', message: `开括号: ${openBraces}, 闭括号: ${closeBraces}` });
    }
    
    // 3. 检查未闭合的方括号
    const openBrackets = (content.match(/\[/g) || []).length;
    const closeBrackets = (content.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
        errors.push({ type: '方括号不匹配', message: `开括号: ${openBrackets}, 闭括号: ${closeBrackets}` });
    }
    
    // 4. 检查未闭合的引号（简单检查）
    const singleQuotes = (content.match(/'/g) || []).length;
    const doubleQuotes = (content.match(/"/g) || []).length;
    const backticks = (content.match(/`/g) || []).length;
    
    return {
        file: filePath,
        exists: true,
        size: content.length,
        errors: errors,
        stats: {
            openParens, closeParens,
            openBraces, closeBraces,
            openBrackets, closeBrackets,
            singleQuotes, doubleQuotes, backticks
        }
    };
}

console.log('=== 全局代码检查 ===\n');

let totalErrors = 0;
filesToCheck.forEach(file => {
    const result = checkFile(file);
    if (!result.exists) {
        console.log(`❌ ${file}: ${result.error}`);
    } else if (result.errors.length > 0) {
        console.log(`❌ ${file}: ${result.errors.length}个错误`);
        result.errors.forEach(err => {
            console.log(`   - ${err.type}: ${err.message}`);
        });
        totalErrors += result.errors.length;
    } else {
        console.log(`✅ ${file}: 语法正确 (${result.size.toLocaleString()} bytes)`);
    }
});

console.log(`\n=== 检查完成 ===`);
console.log(`总错误数: ${totalErrors}`);
process.exit(totalErrors > 0 ? 1 : 0);
