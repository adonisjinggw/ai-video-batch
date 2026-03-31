/**
 * AI Orchestrator Plugin - 智能AI调度插件
 * 
 * 支持多平台（VSCode、Trae CN、Cursor CC）的AI集成插件
 * 能够根据用户意图智能调度不同的AI服务，提供安全可靠的代码助手功能
 */

const AIServiceManager = require('./core/ai-service-manager');
const IntentEngine = require('./core/intent-engine');
const CodeSafetyChecker = require('./core/code-safety');
const TaskOrchestrator = require('./core/task-orchestrator');

module.exports = {
    AIServiceManager,
    IntentEngine,
    CodeSafetyChecker,
    TaskOrchestrator,
    createOrchestrator: function(options = {}) {
        return new TaskOrchestrator(options);
    }
};
