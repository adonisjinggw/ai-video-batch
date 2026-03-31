/**
 * 任务调度器 - 协调所有核心模块工作
 */

const AIServiceManager = require('./ai-service-manager');
const IntentEngine = require('./intent-engine');
const CodeSafetyChecker = require('./code-safety');

class TaskOrchestrator {
    constructor(options = {}) {
        this.aiServiceManager = new AIServiceManager();
        this.intentEngine = new IntentEngine();
        this.codeSafetyChecker = new CodeSafetyChecker(options.safetyOptions);
        this.options = options;
        this.conversationHistory = [];
        this.pendingApprovals = new Map();
    }

    initialize(servicesConfig) {
        for (const serviceConfig of servicesConfig) {
            this.aiServiceManager.registerService(serviceConfig);
        }
        console.log('[TaskOrchestrator] 初始化完成');
    }

    async processRequest(userInput, context = {}) {
        console.log('[TaskOrchestrator] 处理用户请求:', userInput.substring(0, 100));

        const intent = this.intentEngine.analyzeIntent(userInput, context);
        console.log('[TaskOrchestrator] 识别意图:', intent);

        if (intent.requiresConfirmation) {
            return this.createIntentConfirmationRequest(intent, userInput);
        }

        return this.executeTask(intent, userInput, context);
    }

    createIntentConfirmationRequest(intent, userInput) {
        return {
            type: 'intent_confirmation',
            intent,
            userInput,
            taskTypeDescription: this.intentEngine.getTaskTypeDescription(intent.taskType),
            message: `我理解您想要进行"${this.intentEngine.getTaskTypeDescription(intent.taskType)}"任务，是否确认？`
        };
    }

    async executeTask(intent, userInput, context = {}) {
        const capability = this.intentEngine.getRecommendedCapability(intent.taskType);
        const service = this.aiServiceManager.getServiceForTask(capability);

        if (!service) {
            return {
                type: 'error',
                error: '没有找到适合的AI服务'
            };
        }

        console.log('[TaskOrchestrator] 使用服务:', service.name);

        const systemPrompt = this.intentEngine.buildSystemPrompt(intent.taskType, {
            ...context,
            safetyMode: this.codeSafetyChecker.safetyMode
        });

        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory,
            { role: 'user', content: this.buildUserMessage(userInput, context) }
        ];

        try {
            const response = await this.aiServiceManager.callAI(service.id, messages, {
                temperature: context.temperature || 0.7
            });

            this.conversationHistory.push(
                { role: 'user', content: userInput },
                { role: 'assistant', content: response.content }
            );

            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }

            const result = this.processAIResponse(response.content, intent.taskType, context);

            return {
                type: 'success',
                intent,
                service: { id: service.id, name: service.name },
                result,
                rawResponse: response.content,
                usage: response.usage
            };
        } catch (error) {
            console.error('[TaskOrchestrator] 执行失败:', error);
            return {
                type: 'error',
                error: error.message,
                intent,
                service: { id: service.id, name: service.name }
            };
        }
    }

    buildUserMessage(userInput, context) {
        let message = userInput;

        if (context.selectedCode) {
            message += `\n\n当前选中的代码：\n\`\`\`${context.language || 'text'}\n${context.selectedCode}\n\`\`\``;
        }

        if (context.fileContent) {
            message += `\n\n当前文件内容：\n\`\`\`${context.language || 'text'}\n${context.fileContent}\n\`\`\``;
        }

        if (context.filePath) {
            message += `\n\n文件路径: ${context.filePath}`;
        }

        return message;
    }

    processAIResponse(content, taskType, context) {
        const codeBlocks = this.extractCodeBlocks(content);

        if (codeBlocks.length > 0 && context.originalCode) {
            const proposedCode = codeBlocks[0].code;
            const approvalRequest = this.codeSafetyChecker.createApprovalRequest(
                context.originalCode,
                proposedCode,
                this.intentEngine.getTaskTypeDescription(taskType),
                context.usedService
            );

            this.pendingApprovals.set(approvalRequest.id, approvalRequest);

            return {
                type: 'requires_approval',
                approvalRequest,
                content,
                codeBlocks
            };
        }

        return {
            type: 'content',
            content,
            codeBlocks
        };
    }

    extractCodeBlocks(content) {
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        const blocks = [];
        let match;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            const language = match[1] || 'text';
            const code = match[2];

            blocks.push({
                language,
                code: code.trim(),
                fullBlock: match[0]
            });
        }

        return blocks;
    }

    approveModification(approvalId) {
        const approval = this.pendingApprovals.get(approvalId);
        if (!approval) {
            throw new Error('审批请求不存在');
        }

        approval.status = 'approved';
        approval.approvedAt = new Date().toISOString();
        this.pendingApprovals.delete(approvalId);

        return approval;
    }

    rejectModification(approvalId, reason = '') {
        const approval = this.pendingApprovals.get(approvalId);
        if (!approval) {
            throw new Error('审批请求不存在');
        }

        approval.status = 'rejected';
        approval.rejectionReason = reason;
        this.pendingApprovals.delete(approvalId);

        return approval;
    }

    getPendingApprovals() {
        return Array.from(this.pendingApprovals.values());
    }

    clearConversationHistory() {
        this.conversationHistory = [];
    }

    getServicesStatus() {
        return this.aiServiceManager.getAllServices();
    }
}

module.exports = TaskOrchestrator;
