const fs = require('fs');
const path = require('path');

const batchJsPath = path.join(__dirname, 'js', 'batch.js');
const mobileHtmlPath = path.join(__dirname, 'mobile.html');

console.log('正在读取电脑版提示词工坊模板...');

const batchJsContent = fs.readFileSync(batchJsPath, 'utf-8');
const mobileHtmlContent = fs.readFileSync(mobileHtmlPath, 'utf-8');

// 提取电脑版 PROMPT_TEMPLATES
const pcTemplatesMatch = batchJsContent.match(/const PROMPT_TEMPLATES\s*=\s*\{([\s\S]*?)\}\s*;/);

if (pcTemplatesMatch) {
    console.log('✓ 成功定位电脑版PROMPT_TEMPLATES');
    
    let templateStr = pcTemplatesMatch[1];
    
    // 简化的模板提取方法
    const lines = templateStr.split('\n');
    let currentKey = null;
    let currentTemplate = null;
    let braceCount = 0;
    const pcTemplates = {};
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.match(/^\s*[a-zA-Z0-9_]+:\s*\{/) && !currentKey) {
            currentKey = line.match(/^\s*([a-zA-Z0-9_]+):\s*\{/)[1];
            braceCount = 1;
            currentTemplate = '{' + line.replace(/^[^\{]*/, '');
        } else if (currentKey) {
            currentTemplate += '\n' + lines[i];
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            
            if (braceCount === 0) {
                try {
                    // 使用eval解析（需要在安全环境）
                    const templateObj = eval('(' + currentTemplate + ')');
                    pcTemplates[currentKey] = templateObj;
                } catch (e) {
                    console.log(`跳过解析错误的模板: ${currentKey}`);
                }
                currentKey = null;
                currentTemplate = null;
            }
        }
    }
    
    console.log(`✓ 提取到 ${Object.keys(pcTemplates).length} 个电脑版模板`);
    
    // 提取手机版 fillTemplates
    console.log('\n正在读取手机版模板...');
    
    const mobileMatch = mobileHtmlContent.match(/const fillTemplates\s*=\s*\{([\s\S]*?)\}\s*;/);
    const mobileTemplates = {};
    
    if (mobileMatch) {
        console.log('✓ 成功定位手机版fillTemplates');
        
        let mobileTemplateStr = mobileMatch[1];
        let currentKey = null;
        let currentTemplate = null;
        let braceCount = 0;
        const lines = mobileTemplateStr.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.match(/^\s*[a-zA-Z0-9_]+:\s*\{/) && !currentKey) {
                currentKey = line.match(/^\s*([a-zA-Z0-9_]+):\s*\{/)[1];
                braceCount = 1;
                currentTemplate = '{' + line.replace(/^[^\{]*/, '');
            } else if (currentKey) {
                currentTemplate += '\n' + lines[i];
                braceCount += (line.match(/\{/g) || []).length;
                braceCount -= (line.match(/\}/g) || []).length;
                
                if (braceCount === 0) {
                    try {
                        const templateObj = eval('(' + currentTemplate + ')');
                        mobileTemplates[currentKey] = templateObj;
                    } catch (e) {
                        // 跳过解析错误
                    }
                    currentKey = null;
                    currentTemplate = null;
                }
            }
        }
        
        console.log(`✓ 提取到 ${Object.keys(mobileTemplates).length} 个手机版模板`);
        
        // 找出缺失的模板
        console.log('\n========== 模板对比结果 ==========');
        
        const missingTemplates = {};
        const pcKeys = Object.keys(pcTemplates);
        
        for (const key of pcKeys) {
            if (!mobileTemplates[key]) {
                missingTemplates[key] = pcTemplates[key];
            }
        }
        
        console.log(`\n✗ 手机版缺失的电脑版模板: ${Object.keys(missingTemplates).length} 个`);
        
        if (Object.keys(missingTemplates).length > 0) {
            console.log('\n缺失的模板列表:');
            Object.keys(missingTemplates).forEach(key => {
                const t = missingTemplates[key];
                console.log(`  - ${key}: ${t.name || '无名称'}`);
            });
            
            // 生成缺失模板代码
            console.log('\n========== 生成缺失模板代码 ==========\n');
            
            let outputCode = '';
            Object.keys(missingTemplates).forEach(key => {
                const t = missingTemplates[key];
                outputCode += `    ${key}: {\n`;
                if (t.name) outputCode += `        name: '${t.name.replace(/'/g, "\\'")}',\n`;
                if (t.desc) outputCode += `        desc: '${t.desc.replace(/'/g, "\\'")}',\n`;
                if (t.template) {
                    let templateText = t.template.replace(/'/g, "\\'");
                    if (templateText.includes('\n')) {
                        outputCode += `        template: \`${t.template.replace(/`/g, "\\`")}\`,\n`;
                    } else {
                        outputCode += `        template: '${templateText}',\n`;
                    }
                }
                outputCode += '    },\n';
            });
            
            // 在手机版中添加缺失的模板
            const insertionPoint = '            calendar_birthday: { name: \'🎂 生日日历卡片\', desc: \'生日纪念日历设计\', template: \'生日主题日历卡片。顶部醒目显示：大号日期"______（生日日期如09/26）"，旁边"______（公历如2025.06）"、"______（农历如五月十四）"、"______（星期）"。主视觉：______（生日主题艺术图/人物插画/蛋糕场景），温馨欢乐氛围。底部：生日祝福"______（生日快乐/祝福语）"，寿星名字"______（姓名）"。蛋糕/气球/彩带装饰元素，竖版9:16比例\' }';
            
            const newInsertionPoint = insertionPoint + ',\n' + outputCode;
            
            let newMobileContent = mobileHtmlContent;
            newMobileContent = newMobileContent.replace(insertionPoint, newInsertionPoint);
            
            fs.writeFileSync(mobileHtmlPath, newMobileContent, 'utf-8');
            console.log(`✓ 已成功将 ${Object.keys(missingTemplates).length} 个模板添加到手机版！`);
            
        } else {
            console.log('\n✓ 电脑版所有模板手机版都已存在！');
        }
        
        // 显示统计
        console.log('\n========== 统计信息 ==========');
        console.log(`电脑版总模板数: ${Object.keys(pcTemplates).length}`);
        console.log(`手机版总模板数: ${Object.keys(mobileTemplates).length}`);
        console.log(`新增模板数: ${Object.keys(missingTemplates).length}`);
        
    } else {
        console.log('✗ 未能找到手机版fillTemplates');
    }
    
} else {
    console.log('✗ 未能找到PROMPT_TEMPLATES');
}
