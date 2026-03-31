/**
 * AI服务管理器 - 管理多个AI服务的配置和调用
 */

const axios = require('axios');

class AIServiceManager {
    constructor() {
        this.services = new Map();
        this.defaultService = null;
    }

    /**
     * 注册AI服务
     */
    registerService(config) {
        const { id, name, type, apiKey, baseUrl, model, capabilities, priority = 0 } = config;
        
        this.services.set(id, {
            id,
            name,
            type,
            apiKey,
            baseUrl,
            model,
            capabilities: capabilities || ['text_generation'],
            priority,
            enabled: true
        });

        if (!this.defaultService || priority > this.defaultService.priority) {
            this.defaultService = this.services.get(id);
        }

        console.log(`[AIServiceManager] 注册服务: ${name} (${id})`);
    }

    /**
     * 获取适合的AI服务
     */
    getServiceForTask(taskType) {
        let bestService = null;
        let highestPriority = -1;

        for (const service of this.services.values()) {
            if (!service.enabled) continue;
            if (!service.capabilities.includes(taskType)) continue;

            if (service.priority > highestPriority) {
                highestPriority = service.priority;
                bestService = service;
            }
        }

        return bestService || this.defaultService;
    }

    /**
     * 调用AI服务
     */
    async callAI(serviceId, messages, options = {}) {
        const service = this.services.get(serviceId);
        if (!service) {
            throw new Error(`服务 ${serviceId} 不存在`);
        }

        if (!service.enabled) {
            throw new Error(`服务 ${service.name} 已禁用`);
        }

        switch (service.type) {
            case 'openai':
                return this.callOpenAI(service, messages, options);
            case 'claude':
                return this.callClaude(service, messages, options);
            case 'ollama':
                return this.callOllama(service, messages, options);
            case 'custom':
                return this.callCustom(service, messages, options);
            default:
                throw new Error(`不支持的服务类型: ${service.type}`);
        }
    }

    /**
     * 调用 OpenAI 兼容API
     */
    async callOpenAI(service, messages, options) {
        const response = await axios.post(
            `${service.baseUrl || 'https://api.openai.com'}/v1/chat/completions`,
            {
                model: service.model || 'gpt-4',
                messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 4000,
                ...options
            },
            {
                headers: {
                    'Authorization': `Bearer ${service.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );

        return {
            content: response.data.choices[0].message.content,
            usage: response.data.usage
        };
    }

    /**
     * 调用 Claude API
     */
    async callClaude(service, messages, options) {
        const response = await axios.post(
            `${service.baseUrl || 'https://api.anthropic.com'}/v1/messages`,
            {
                model: service.model || 'claude-3-opus-20240229',
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content
                })),
                max_tokens: options.maxTokens || 4000,
                temperature: options.temperature || 0.7,
                ...options
            },
            {
                headers: {
                    'x-api-key': service.apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );

        return {
            content: response.data.content[0].text,
            usage: response.data.usage
        };
    }

    /**
     * 调用 Ollama 本地模型
     */
    async callOllama(service, messages, options) {
        const response = await axios.post(
            `${service.baseUrl || 'http://localhost:11434'}/api/chat`,
            {
                model: service.model || 'llama2',
                messages,
                stream: false,
                options: {
                    temperature: options.temperature || 0.7,
                    num_predict: options.maxTokens || 4000,
                    ...options
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 120000
            }
        );

        return {
            content: response.data.message.content,
            usage: response.data.usage || {}
        };
    }

    /**
     * 调用自定义API
     */
    async callCustom(service, messages, options) {
        const response = await axios.post(
            service.baseUrl,
            {
                model: service.model,
                messages,
                ...options
            },
            {
                headers: {
                    'Authorization': service.apiKey ? `Bearer ${service.apiKey}` : undefined,
                    'Content-Type': 'application/json',
                    ...service.customHeaders
                },
                timeout: 60000
            }
        );

        const contentPath = service.responsePath || 'choices[0].message.content';
        const content = this.getNestedValue(response.data, contentPath);

        return {
            content,
            usage: response.data.usage || {}
        };
    }

    /**
     * 获取嵌套对象的值
     */
    getNestedValue(obj, path) {
        const parts = path.match(/(\w+|\[\d+\])/g);
        let result = obj;

        for (const part of parts) {
            if (part.startsWith('[')) {
                const index = parseInt(part.slice(1, -1));
                result = result[index];
            } else {
                result = result[part];
            }

            if (result === undefined) break;
        }

        return result;
    }

    /**
     * 获取所有服务
     */
    getAllServices() {
        return Array.from(this.services.values());
    }

    /**
     * 启用/禁用服务
     */
    toggleService(serviceId, enabled) {
        const service = this.services.get(serviceId);
        if (service) {
            service.enabled = enabled;
        }
    }
}

module.exports = AIServiceManager;
