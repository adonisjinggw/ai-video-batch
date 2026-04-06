/**
 * AI服务管理器 - 管理多个AI服务的配置和调用
 */

const axios = require('axios');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, i);
                console.log(`[AIServiceManager] 请求失败，${delay}ms后重试 (${i + 1}/${maxRetries})`);
                await sleep(delay);
            }
        }
    }
    throw lastError;
}

class AIServiceManager {
    constructor() {
        this.services = new Map();
        this.defaultService = null;
    }

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

    async callAI(serviceId, messages, options = {}) {
        const service = this.services.get(serviceId);
        if (!service) {
            throw new Error(`服务 ${serviceId} 不存在`);
        }

        if (!service.enabled) {
            throw new Error(`服务 ${service.name} 已禁用`);
        }

        const callFn = async () => {
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
        };

        return retryWithBackoff(callFn, 3, 1000);
    }

    buildUrl(baseUrl, defaultBaseUrl, endpoint) {
        let url = baseUrl || defaultBaseUrl;
        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }
        if (url.endsWith('/v1')) {
            url = url.slice(0, -3);
        }
        return `${url}${endpoint}`;
    }

    async callOpenAI(service, messages, options) {
        const url = this.buildUrl(service.baseUrl, 'https://api.openai.com', '/v1/chat/completions');
        const response = await axios.post(
            url,
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

    async callClaude(service, messages, options) {
        const url = this.buildUrl(service.baseUrl, 'https://api.anthropic.com', '/v1/messages');
        
        let systemPrompt = '';
        const claudeMessages = [];
        
        for (const msg of messages) {
            if (msg.role === 'system') {
                systemPrompt = msg.content;
            } else {
                claudeMessages.push(msg);
            }
        }

        const requestBody = {
            model: service.model || 'claude-3-opus-20240229',
            messages: claudeMessages,
            max_tokens: options.maxTokens || 4000,
            temperature: options.temperature || 0.7,
            ...options
        };

        if (systemPrompt) {
            requestBody.system = systemPrompt;
        }

        const response = await axios.post(url, requestBody, {
            headers: {
                'x-api-key': service.apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });

        return {
            content: response.data.content[0].text,
            usage: response.data.usage
        };
    }

    async callOllama(service, messages, options) {
        const url = this.buildUrl(service.baseUrl, 'http://localhost:11434', '/api/chat');
        const response = await axios.post(
            url,
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

    getAllServices() {
        return Array.from(this.services.values());
    }

    toggleService(serviceId, enabled) {
        const service = this.services.get(serviceId);
        if (service) {
            service.enabled = enabled;
        }
    }
}

module.exports = AIServiceManager;
