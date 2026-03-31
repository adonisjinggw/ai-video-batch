/**
 * 艾莉丝 (Alice) 插件使用示例
 */

const { createOrchestrator } = require('../src/index');

async function main() {
    console.log('=== 艾莉丝 (Alice) 使用示例 ===\n');

    const orchestrator = createOrchestrator({
        safetyOptions: {
            safetyMode: true,
            maxChangeRatio: 0.3,
            requiredConfirmation: true
        }
    });

    orchestrator.initialize([
        {
            id: 'example-service',
            name: '示例 AI 服务',
            type: 'openai',
            apiKey: 'demo-key',
            baseUrl: 'https://api.openai.com',
            model: 'gpt-4',
            capabilities: ['code_generation', 'code_review', 'text_generation'],
            priority: 10
        }
    ]);

    console.log('1. 服务已注册:', orchestrator.getServicesStatus().map(s => s.name));
    console.log();

    console.log('2. 测试意图理解:');
    const testInputs = [
        '帮我写一个快速排序函数',
        '解释一下这段代码',
        '审查一下这个文件',
        '优化这个函数的性能'
    ];

    for (const input of testInputs) {
        const intent = orchestrator.intentEngine.analyzeIntent(input);
        console.log(`   "${input}"`);
        console.log(`   → ${orchestrator.intentEngine.getTaskTypeDescription(intent.taskType)} (置信度: ${(intent.confidence * 100).toFixed(1)}%)`);
    }
    console.log();

    console.log('3. 测试代码安全检查:');
    const originalCode = `function sort(arr) {
    return arr.sort();
}`;

    const proposedCode = `function quickSort(arr) {
    if (arr.length <= 1) return arr;
    const pivot = arr[Math.floor(arr.length / 2)];
    const left = arr.filter(x => x < pivot);
    const middle = arr.filter(x => x === pivot);
    const right = arr.filter(x => x > pivot);
    return [...quickSort(left), ...middle, ...quickSort(right)];
}`;

    const safetyCheck = orchestrator.codeSafetyChecker.checkCodeModification(originalCode, proposedCode);
    console.log('   变更统计:', safetyCheck.changeSummary);
    console.log('   是否安全:', safetyCheck.safe);
    console.log('   警告:', safetyCheck.warnings);
    console.log('   需要确认:', safetyCheck.requiresConfirmation);
    console.log();

    console.log('4. 生成 Diff 预览:');
    const diff = orchestrator.codeSafetyChecker.generateDiffPreview(originalCode, proposedCode);
    for (const line of diff.slice(0, 10)) {
        const prefix = line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  ';
        console.log(`   ${prefix}${line.content}`);
    }
    if (diff.length > 10) {
        console.log('   ... (更多行)');
    }
    console.log();

    console.log('=== 使用说明 ===');
    console.log('1. 在 VSCode 中，按 Ctrl+Shift+P 打开命令面板');
    console.log('2. 输入 "艾莉丝: 启动助手" 开始使用');
    console.log('3. 或选中代码后使用 "艾莉丝: 代码审查"');
    console.log('4. 在设置中配置您的 AI 服务');
    console.log();
    console.log('=== 安全特性 ===');
    console.log('✓ 所有代码修改需要用户确认');
    console.log('✓ 限制单次修改比例（默认30%）');
    console.log('✓ 检测危险操作（eval、exec等）');
    console.log('✓ 保护敏感模式（API密钥、导入语句等）');
    console.log('✓ 语法检查');
}

main().catch(console.error);
