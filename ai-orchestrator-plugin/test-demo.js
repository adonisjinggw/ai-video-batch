/**
 * 艾莉丝 (Alice) - 简单演示脚本
 * 运行这个脚本可以体验艾莉丝的核心功能（不需要真实API密钥）
 */

const { createOrchestrator } = require('./src/index');

console.log('========================================');
console.log('🌸 艾莉丝 (Alice) - 功能演示');
console.log('========================================\n');

async function main() {
    const orchestrator = createOrchestrator({
        safetyOptions: {
            safetyMode: true,
            maxChangeRatio: 0.3,
            requiredConfirmation: true
        }
    });

    console.log('✅ 艾莉丝已初始化');
    console.log();

    console.log('=== 1. 测试意图理解 ===\n');
    const testInputs = [
        '帮我写一个快速排序函数',
        '解释一下这段代码',
        '审查一下这个文件',
        '优化这个函数的性能',
        '修复这个bug',
        '给这段代码写文档'
    ];

    for (const input of testInputs) {
        const intent = orchestrator.intentEngine.analyzeIntent(input);
        const taskDesc = orchestrator.intentEngine.getTaskTypeDescription(intent.taskType);
        const confidence = (intent.confidence * 100).toFixed(1);
        console.log(`输入: "${input}"`);
        console.log(`→ 识别: ${taskDesc} (置信度: ${confidence}%)`);
        console.log();
    }

    console.log('=== 2. 测试代码安全检查 ===\n');
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

    console.log('原始代码:');
    console.log(originalCode);
    console.log();
    console.log('建议代码:');
    console.log(proposedCode);
    console.log();

    const safetyCheck = orchestrator.codeSafetyChecker.checkCodeModification(originalCode, proposedCode);
    console.log('安全检查结果:');
    console.log(`  是否安全: ${safetyCheck.safe ? '✅ 是' : '❌ 否'}`);
    console.log(`  需要确认: ${safetyCheck.requiresConfirmation ? '✅ 是' : '❌ 否'}`);
    console.log(`  变更统计:`);
    console.log(`    - 原始行数: ${safetyCheck.changeSummary.originalLines}`);
    console.log(`    - 新增行数: ${safetyCheck.changeSummary.addedLines}`);
    console.log(`    - 删除行数: ${safetyCheck.changeSummary.removedLines}`);
    console.log(`    - 变更比例: ${(safetyCheck.changeSummary.changeRatio * 100).toFixed(1)}%`);
    if (safetyCheck.warnings.length > 0) {
        console.log(`  警告: ${safetyCheck.warnings.length} 条`);
    }
    console.log();

    console.log('=== 3. Diff 预览 ===\n');
    const diff = orchestrator.codeSafetyChecker.generateDiffPreview(originalCode, proposedCode);
    for (const line of diff) {
        const prefix = line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  ';
        console.log(`${prefix}${line.content}`);
    }
    console.log();

    console.log('========================================');
    console.log('✅ 演示完成！');
    console.log('========================================');
    console.log();
    console.log('接下来你可以:');
    console.log('1. 打开 VSCode，按 F5 启动扩展');
    console.log('2. 在设置中配置你的 AI 服务');
    console.log('3. 开始使用艾莉丝！');
    console.log();
    console.log('查看 快速开始.md 了解更多详细信息');
}

main().catch(console.error);
