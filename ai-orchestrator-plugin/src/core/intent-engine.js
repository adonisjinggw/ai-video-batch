/**
 * 意图理解引擎 - 分析用户意图，选择合适的任务类型和AI服务
 */

const TASK_TYPES = {
    CODE_GENERATION: 'code_generation',
    CODE_COMPLETION: 'code_completion',
    CODE_EXPLANATION: 'code_explanation',
    CODE_REVIEW: 'code_review',
    CODE_OPTIMIZATION: 'code_optimization',
    CODE_REFACTORING: 'code_refactoring',
    BUG_FIX: 'bug_fix',
    TEST_GENERATION: 'test_generation',
    DOCUMENTATION: 'documentation',
    QUESTION_ANSWERING: 'question_answering',
    GENERAL_CONVERSATION: 'general_conversation'
};

const INTENT_PATTERNS = {
    [TASK_TYPES.CODE_GENERATION]: [
        /写(一)?个?([\s\S]{0,20})函数/i,
        /创建(一)?个?([\s\S]{0,20})类/i,
        /实现([\s\S]{0,20})功能/i,
        /生成([\s\S]{0,20})代码/i,
        /帮我写/i,
        /写一段/i,
        /创建.*脚本/i,
        /开发.*模块/i
    ],
    [TASK_TYPES.CODE_COMPLETION]: [
        /补全/i,
        /继续写/i,
        /完成这个/i,
        /补充.*代码/i
    ],
    [TASK_TYPES.CODE_EXPLANATION]: [
        /解释(一下)?/i,
        /这段代码(是)?什么意思/i,
        /这个.*做什么/i,
        /分析(一下)?这段代码/i,
        /代码解释/i,
        /理解(这个)?代码/i
    ],
    [TASK_TYPES.CODE_REVIEW]: [
        /审查(一下)?代码/i,
        /检查(一下)?代码/i,
        /代码审查/i,
        /看看代码有什么问题/i,
        /代码质量/i,
        /代码问题/i
    ],
    [TASK_TYPES.CODE_OPTIMIZATION]: [
        /优化(一下)?代码/i,
        /改进(一下)?代码/i,
        /性能优化/i,
        /代码优化/i,
        /更高效/i
    ],
    [TASK_TYPES.CODE_REFACTORING]: [
        /重构(一下)?代码/i,
        /代码重构/i,
        /重写(一下)?代码/i,
        /改善代码结构/i
    ],
    [TASK_TYPES.BUG_FIX]: [
        /修复(这个)?bug/i,
        /修复错误/i,
        /解决(这个)?问题/i,
        /bug修复/i,
        /调试(一下)?/i,
        /哪里错了/i
    ],
    [TASK_TYPES.TEST_GENERATION]: [
        /写(一)?个?测试/i,
        /生成测试/i,
        /单元测试/i,
        /测试用例/i
    ],
    [TASK_TYPES.DOCUMENTATION]: [
        /写(一)?个?文档/i,
        /生成文档/i,
        /添加注释/i,
        /文档生成/i,
        /注释说明/i
    ],
    [TASK_TYPES.QUESTION_ANSWERING]: [
        /什么是/i,
        /如何/i,
        /怎么/i,
        /为什么/i,
        /吗\??$/i,
        /\?$/
    ]
};

class IntentEngine {
    constructor() {
        this.taskTypes = TASK_TYPES;
    }

    /**
     * 分析用户意图
     */
    analyzeIntent(userInput, context = {}) {
        const input = userInput.trim();
        
        let bestTaskType = TASK_TYPES.GENERAL_CONVERSATION;
        let confidence = 0.1;
        let matchedPattern = null;

        for (const [taskType, patterns] of Object.entries(INTENT_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(input)) {
                    const currentConfidence = this.calculateConfidence(input, pattern, taskType);
                    if (currentConfidence > confidence) {
                        confidence = currentConfidence;
                        bestTaskType = taskType;
                        matchedPattern = pattern;
                    }
                }
            }
        }

        if (context.hasCode && bestTaskType === TASK_TYPES.GENERAL_CONVERSATION) {
            bestTaskType = TASK_TYPES.CODE_EXPLANATION;
            confidence = Math.max(confidence, 0.5);
        }

        return {
            taskType: bestTaskType,
            confidence,
            matchedPattern,
            requiresConfirmation: confidence < 0.6
        };
    }

    /**
     * 计算置信度
     */
    calculateConfidence(input, pattern, taskType) {
        let confidence = 0.5;
        
        const match = input.match(pattern);
        if (match) {
            const matchLength = match[0].length;
            confidence += Math.min(matchLength / 50, 0.3);
        }

        if (input.length > 20 && input.length < 200) {
            confidence += 0.1;
        }

        const strongKeywords = ['帮我', '请', '需要', '生成', '创建', '实现', '修复'];
        for (const keyword of strongKeywords) {
            if (input.includes(keyword)) {
                confidence += 0.1;
                break;
            }
        }

        return Math.min(confidence, 0.95);
    }

    /**
     * 获取任务类型描述
     */
    getTaskTypeDescription(taskType) {
        const descriptions = {
            [TASK_TYPES.CODE_GENERATION]: '代码生成',
            [TASK_TYPES.CODE_COMPLETION]: '代码补全',
            [TASK_TYPES.CODE_EXPLANATION]: '代码解释',
            [TASK_TYPES.CODE_REVIEW]: '代码审查',
            [TASK_TYPES.CODE_OPTIMIZATION]: '代码优化',
            [TASK_TYPES.CODE_REFACTORING]: '代码重构',
            [TASK_TYPES.BUG_FIX]: 'Bug修复',
            [TASK_TYPES.TEST_GENERATION]: '测试生成',
            [TASK_TYPES.DOCUMENTATION]: '文档生成',
            [TASK_TYPES.QUESTION_ANSWERING]: '问题回答',
            [TASK_TYPES.GENERAL_CONVERSATION]: '普通对话'
        };
        return descriptions[taskType] || '未知任务';
    }

    /**
     * 获取推荐的AI服务能力
     */
    getRecommendedCapability(taskType) {
        const capabilities = {
            [TASK_TYPES.CODE_GENERATION]: 'code_generation',
            [TASK_TYPES.CODE_COMPLETION]: 'code_completion',
            [TASK_TYPES.CODE_EXPLANATION]: 'code_explanation',
            [TASK_TYPES.CODE_REVIEW]: 'code_review',
            [TASK_TYPES.CODE_OPTIMIZATION]: 'code_optimization',
            [TASK_TYPES.CODE_REFACTORING]: 'code_refactoring',
            [TASK_TYPES.BUG_FIX]: 'bug_fix',
            [TASK_TYPES.TEST_GENERATION]: 'test_generation',
            [TASK_TYPES.DOCUMENTATION]: 'documentation',
            [TASK_TYPES.QUESTION_ANSWERING]: 'text_generation',
            [TASK_TYPES.GENERAL_CONVERSATION]: 'text_generation'
        };
        return capabilities[taskType] || 'text_generation';
    }

    /**
     * 构建系统提示词
     */
    buildSystemPrompt(taskType, context = {}) {
        const basePrompts = {
            [TASK_TYPES.CODE_GENERATION]: `你是一个专业的代码生成助手。请根据用户需求生成高质量、可运行的代码。

重要规则：
1. 遵循项目现有的代码风格和命名规范
2. 添加必要的注释说明
3. 确保代码安全可靠
4. 如果有不确定的地方，先询问用户而不是猜测
5. 代码修改前必须经过用户确认`,

            [TASK_TYPES.CODE_EXPLANATION]: `你是一个专业的代码解释助手。请用清晰易懂的语言解释代码的功能和逻辑。

重要规则：
1. 分步骤解释代码执行流程
2. 说明关键函数和变量的作用
3. 指出代码中的关键点和注意事项
4. 如果有性能或安全问题，请指出`,

            [TASK_TYPES.CODE_REVIEW]: `你是一个专业的代码审查助手。请全面审查代码并提供建设性反馈。

审查要点：
1. 代码质量和可读性
2. 潜在的bug和逻辑错误
3. 性能问题
4. 安全隐患
5. 最佳实践遵循情况
6. 代码风格一致性

请提供具体的改进建议，而不仅仅是指出问题。`,

            [TASK_TYPES.CODE_OPTIMIZATION]: `你是一个专业的代码优化助手。请在保持功能不变的前提下优化代码。

优化原则：
1. 首先保证功能正确性
2. 优化性能但不牺牲可读性
3. 保持向后兼容
4. 说明优化的理由和预期效果
5. 所有修改必须经过用户确认`,

            [TASK_TYPES.BUG_FIX]: `你是一个专业的Bug修复助手。请帮助定位和修复代码问题。

修复原则：
1. 首先理解问题的根因
2. 最小化代码修改范围
3. 确保修复不会引入新问题
4. 说明修复的思路
5. 修改前必须经过用户确认`,

            [TASK_TYPES.DOCUMENTATION]: `你是一个专业的文档生成助手。请为代码生成清晰的文档和注释。

文档要求：
1. JSDoc/TSDoc 格式的函数注释
2. 说明参数和返回值
3. 提供使用示例
4. 说明注意事项和边界情况`
        };

        let prompt = basePrompts[taskType] || basePrompts[TASK_TYPES.QUESTION_ANSWERING];

        if (context.safetyMode) {
            prompt += `

🔒 安全模式启用：
- 所有代码修改都需要用户明确确认后才能应用
- 不会自动修改任何文件
- 会先展示修改预览，等待用户批准
- 遵循"安全第一，谨慎操作"的原则`;
        }

        if (context.language) {
            prompt += `\n\n当前文件语言: ${context.language}`;
        }

        return prompt;
    }
}

module.exports = IntentEngine;
