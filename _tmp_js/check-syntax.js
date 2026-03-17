const fs = require('fs');

const content = fs.readFileSync('mobile.html', 'utf-8');

// 提取script标签中的JavaScript
const scriptMatches = content.match(/<script[^>]*>([\s\S]*?)<\/script>/g);

if (scriptMatches) {
    scriptMatches.forEach((script, index) => {
        // 移除script标签
        const jsCode = script.replace(/<script[^>]*>|<\/script>/g, '');

        // 尝试解析JavaScript
        try {
            new Function(jsCode);
            console.log(`Script ${index + 1}: ✅ 语法正确`);
        } catch (e) {
            console.log(`Script ${index + 1}: ❌ 语法错误`);
            console.log(`  错误: ${e.message}`);

            // 尝试找到错误位置
            const lines = jsCode.split('\n');
            console.log(`  代码行数: ${lines.length}`);

            // 显示前30行代码用于调试
            console.log('  前30行代码:');
            lines.slice(0, 30).forEach((line, i) => {
                console.log(`    ${i + 1}: ${line.substring(0, 80)}`);
            });
        }
    });
}
