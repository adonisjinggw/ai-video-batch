
const fs = require('fs');

const batchContent = fs.readFileSync('js/batch.js', 'utf8');

const ptStart = batchContent.indexOf('const PT_PRESET_TEMPLATES = {');
if (ptStart !== -1) {
    let braceCount = 0;
    let ptEnd = ptStart;
    for (let i = ptStart; i < batchContent.length; i++) {
        if (batchContent[i] === '{') braceCount++;
        if (batchContent[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                ptEnd = i + 1;
                break;
            }
        }
    }

    const ptObjectStr = batchContent.substring(ptStart, ptEnd);
    
    const templateKeys = [];
    const lines = ptObjectStr.split('\n');
    let braceCount2 = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (braceCount2 === 0) {
            const match = line.match(/^([a-z_]+):\s*\{/);
            if (match) {
                templateKeys.push(match[1]);
                braceCount2 = 1;
            }
        } else {
            braceCount2 += (line.match(/{/g) || []).length;
            braceCount2 -= (line.match(/}/g) || []).length;
        }
    }

    console.log('=== 电脑版提示词工坊所有模板 (' + templateKeys.length + ' 个):\n');
    templateKeys.forEach((key, index) => {
        console.log((index + 1) + '. ' + key);
    });

    console.log('\n=== 完整列表:\n');
    console.log(JSON.stringify(templateKeys, null, 2));
}

