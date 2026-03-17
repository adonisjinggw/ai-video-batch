const fs = require('fs');
const path = require('path');

const batchJsPath = path.join(__dirname, 'js', 'batch.js');
const mobileHtmlPath = path.join(__dirname, 'mobile.html');

console.log('正在读取文件...');

const batchJsContent = fs.readFileSync(batchJsPath, 'utf-8');
const mobileHtmlContent = fs.readFileSync(mobileHtmlPath, 'utf-8');

console.log('正在解析模板...');

// 从batch.js中提取PROMPT_TEMPLATES
const promptTemplatesMatch = batchJsContent.match(/const\s+PROMPT_TEMPLATES\s*=\s*\{([\s\S]*?)\};\s*\/\/\s*🧩\s+PromptFill\s+风格/);

if (!promptTemplatesMatch) {
    console.error('无法找到PROMPT_TEMPLATES对象');
    process.exit(1);
}

// 从mobile.html中提取fillTemplates
const fillTemplatesMatch = mobileHtmlContent.match(/const\s+fillTemplates\s*=\s*\{([\s\S]*?)\};\s*\/\/\s*====================\s*下划线填空逻辑/);

if (!fillTemplatesMatch) {
    console.error('无法找到fillTemplates对象');
    process.exit(1);
}

// 简单解析模板对象，提取所有键名
function extractTemplateKeys(content) {
    const keys = [];
    const lines = content.split('\n');
    let braceCount = 0;
    let inObject = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (!inObject && line.includes('{')) {
            inObject = true;
            braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
            continue;
        }
        
        if (inObject) {
            braceCount += (line.match(/{/g) || []).length;
            braceCount -= (line.match(/}/g) || []).length;
            
            if (braceCount <= 0) {
                break;
            }
            
            // 匹配键名
            const keyMatch = line.match(/^\s*([a-z0-9_]+):\s*\{/i);
            if (keyMatch) {
                keys.push(keyMatch[1]);
            }
        }
    }
    
    return keys;
}

const pcTemplateKeys = extractTemplateKeys(promptTemplatesMatch[1]);
const mobileTemplateKeys = extractTemplateKeys(fillTemplatesMatch[1]);

console.log('\n电脑版模板数量:', pcTemplateKeys.length);
console.log('手机版模板数量:', mobileTemplateKeys.length);

// 找出手机版缺少的模板
const missingTemplates = pcTemplateKeys.filter(key => !mobileTemplateKeys.includes(key));

console.log('\n手机版缺少的模板数量:', missingTemplates.length);
console.log('\n缺少的模板:');
missingTemplates.forEach((key, index) => {
    console.log(`${index + 1}. ${key}`);
});

// 尝试提取缺少的模板完整内容
console.log('\n\n正在提取缺少的模板内容...');

function extractTemplateContent(content, templateKey) {
    const pattern = new RegExp(`\\s*${templateKey}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},?\\s*\\n`, 's');
    const match = content.match(pattern);
    return match ? `${templateKey}: {${match[1]}}` : null;
}

const missingTemplateContents = [];
missingTemplates.forEach(key => {
    const content = extractTemplateContent(promptTemplatesMatch[0], key);
    if (content) {
        missingTemplateContents.push(content);
    }
});

console.log('\n提取到的缺少模板内容数量:', missingTemplateContents.length);

// 保存结果
const outputPath = path.join(__dirname, 'missing-templates.txt');
fs.writeFileSync(outputPath, missingTemplateContents.join(',\n\n'), 'utf-8');

console.log(`\n结果已保存到: ${outputPath}`);
