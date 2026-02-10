/**
 * 🛡️ ResilientAPIGateway - 弹性 API 网关
 * @version 1.0.0
 * @description 统一 API 调用入口，实现负载均衡、熔断降级、健康检查、成本优化
 * 
 * 核心特性：
 * - 负载均衡：多节点自动分发
 * - 熔断机制：连续失败自动降级
 * - 健康检查：定期探测节点状态
 * - 成本优化：根据价格选择最优节点
 * - 智能降级：付费 → 免费自动切换
 */

(function(global) {
    'use strict';

    // ==================== API 节点配置 ====================
    const API_NODES = {
        // 🖼️ 图像生成节点
        image: {
            // Banana2 节点群
            banana2_primary: {
                endpoint: '/api/banana2',
                name: 'Banana2 主节点',
                cost: 0.17,          // 每次成本 ¥
                quality: 'high',
                models: ['nano-banana-2', 'nano-banana-2-4k'],
                timeout: 90000,
                weight: 100          // 权重（越高越优先）
            },
            banana2_backup: {
                endpoint: '/api/banana2-backup',
                name: 'Banana2 备用',
                cost: 0.17,
                quality: 'high',
                models: ['nano-banana-2', 'nano-banana-2-4k'],
                timeout: 90000,
                weight: 50
            },
            // ModelScope 免费节点
            modelscope: {
                endpoint: '/api/modelscope',
                name: '魔塔万象',
                cost: 0,             // 免费
                quality: 'medium',
                models: ['Tongyi-MAI/Z-Image-Turbo'],
                timeout: 60000,
                weight: 30
            },
            // Seedream 节点
            seedream: {
                endpoint: '/api/banana2',
                name: '豆包 Seedream',
                cost: 0.22,
                quality: 'high',
                models: ['doubao-seedream-4-5-251128'],
                timeout: 120000,
                weight: 70
            }
        },
        
        // 📝 文本生成节点
        text: {
            gemini3: {
                endpoint: '/api/zhenzhen',
                name: 'Gemini 3 Pro',
                cost: 0.026,
                quality: 'high',
                models: ['gemini-3-pro-preview', 'gemini-3-pro-preview-thinking'],
                timeout: 30000,
                weight: 100
            },
            modelscope_text: {
                endpoint: '/api/modelscope',
                name: '魔塔文本',
                cost: 0,
                quality: 'medium',
                models: ['ZhipuAI/GLM-4.6'],
                timeout: 30000,
                weight: 30
            },
            writer_llm: {
                endpoint: '/api/writer-llm',
                name: 'Writer LLM',
                cost: 0.01,
                quality: 'medium',
                timeout: 30000,
                weight: 50
            }
        },
        
        // 🎬 视频生成节点
        video: {
            sora2: {
                endpoint: '/api/sora2',
                name: 'Sora2',
                cost: 1.08,
                quality: 'high',
                models: ['sora-2-vip-all'],
                timeout: 180000,
                weight: 100
            },
            vidu: {
                endpoint: '/api/yunwu',
                name: 'Vidu',
                cost: 0.8,
                quality: 'high',
                models: ['vidu-1.5', 'vidu-2.0'],
                timeout: 180000,
                weight: 80
            },
            hailuo: {
                endpoint: '/api/yunwu',
                name: '海螺',
                cost: 0.6,
                quality: 'medium',
                models: ['hailuo-video'],
                timeout: 180000,
                weight: 60
            },
            kling: {
                endpoint: '/api/yunwu',
                name: '可灵',
                cost: 0.9,
                quality: 'high',
                models: ['kling-1.5', 'kling-2.0'],
                timeout: 180000,
                weight: 70
            }
        }
    };

    // ==================== 熔断器配置 ====================
    const CIRCUIT_BREAKER_CONFIG = {
        failureThreshold: 3,      // 连续失败N次触发熔断
        recoveryTimeout: 60000,   // 熔断恢复时间(ms)
        halfOpenRequests: 1       // 半开状态允许的请求数
    };

    // ==================== 节点状态管理 ====================
    class NodeState {
        constructor(nodeId) {
            this.nodeId = nodeId;
            this.failures = 0;
            this.successes = 0;
            this.lastFailure = null;
            this.lastSuccess = null;
            this.circuitState = 'closed';  // closed | open | half-open
            this.circuitOpenedAt = null;
            this.responseTimeHistory = [];
            this.avgResponseTime = 0;
        }

        recordSuccess(responseTime) {
            this.successes++;
            this.failures = 0;
            this.lastSuccess = Date.now();
            
            // 记录响应时间
            this.responseTimeHistory.push(responseTime);
            if (this.responseTimeHistory.length > 10) {
                this.responseTimeHistory.shift();
            }
            this.avgResponseTime = this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length;
            
            // 熔断恢复
            if (this.circuitState === 'half-open') {
                this.circuitState = 'closed';
                console.log(`🔌 [API网关] ${this.nodeId} 熔断恢复`);
            }
        }

        recordFailure() {
            this.failures++;
            this.lastFailure = Date.now();
            
            // 检查是否触发熔断
            if (this.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
                this.circuitState = 'open';
                this.circuitOpenedAt = Date.now();
                console.warn(`⚡ [API网关] ${this.nodeId} 触发熔断 (连续${this.failures}次失败)`);
            }
        }

        isAvailable() {
            if (this.circuitState === 'closed') return true;
            
            if (this.circuitState === 'open') {
                // 检查是否到了恢复时间
                if (Date.now() - this.circuitOpenedAt > CIRCUIT_BREAKER_CONFIG.recoveryTimeout) {
                    this.circuitState = 'half-open';
                    console.log(`🔄 [API网关] ${this.nodeId} 进入半开状态`);
                    return true;
                }
                return false;
            }
            
            return true;  // half-open
        }

        toJSON() {
            return {
                nodeId: this.nodeId,
                failures: this.failures,
                successes: this.successes,
                circuitState: this.circuitState,
                avgResponseTime: Math.round(this.avgResponseTime)
            };
        }
    }

    // ==================== 弹性 API 网关 ====================
    class ResilientAPIGateway {
        constructor() {
            this.nodeStates = new Map();
            this.requestQueue = [];
            this.activeRequests = 0;
            this.maxConcurrent = 5;
            
            // 初始化节点状态
            this._initNodeStates();
            
            // 定期健康检查
            this._startHealthCheck();
            
            // 从localStorage恢复状态
            this._restoreState();
        }

        _initNodeStates() {
            for (const category of Object.keys(API_NODES)) {
                for (const nodeId of Object.keys(API_NODES[category])) {
                    this.nodeStates.set(`${category}.${nodeId}`, new NodeState(`${category}.${nodeId}`));
                }
            }
        }

        // ==================== 核心调用接口 ====================
        /**
         * 调用图像生成 API
         * @param {Object} options - 调用配置
         * @returns {Promise<string>} 图片URL
         */
        async callImageAPI(options) {
            const { 
                prompt, 
                model = 'nano-banana-2',
                aspectRatio = '16:9',
                imageUrl,            // 图生图参考
                preferFree = false,  // 优先免费节点
                forceNode = null     // 强制指定节点
            } = options;

            // 选择最优节点
            const node = forceNode 
                ? this._getNode('image', forceNode)
                : this._selectBestNode('image', { preferFree, model });
            
            if (!node) {
                throw new Error('所有图像生成节点不可用');
            }

            const fullNodeId = `image.${node.id}`;
            const state = this.nodeStates.get(fullNodeId);
            const startTime = Date.now();

            try {
                console.log(`🖼️ [API网关] 使用 ${node.config.name} 生成图像`);
                
                const result = await this._executeRequest(node.config.endpoint, {
                    action: imageUrl ? 'image2image' : 'image',
                    prompt,
                    aspectRatio,
                    aspect_ratio: aspectRatio,
                    model,
                    image_url: imageUrl,
                    imageUrls: imageUrl ? [imageUrl] : undefined
                }, node.config.timeout);

                const responseTime = Date.now() - startTime;
                state.recordSuccess(responseTime);
                
                return this._extractImageUrl(result);
                
            } catch (error) {
                state.recordFailure();
                
                // 尝试降级
                if (!preferFree && node.config.cost > 0) {
                    console.log(`🔄 [API网关] ${node.config.name} 失败，降级到免费节点`);
                    return this.callImageAPI({ ...options, preferFree: true });
                }
                
                throw error;
            }
        }

        /**
         * 调用文本生成 API
         * @param {Object} options - 调用配置
         * @returns {Promise<string>} 生成的文本
         */
        async callTextAPI(options) {
            const {
                prompt,
                systemPrompt = '',
                model = 'gemini-3-pro-preview',
                temperature = 0.8,
                maxTokens = 4096,
                preferFree = false,
                forceNode = null
            } = options;

            const node = forceNode
                ? this._getNode('text', forceNode)
                : this._selectBestNode('text', { preferFree, model });
            
            if (!node) {
                throw new Error('所有文本生成节点不可用');
            }

            const fullNodeId = `text.${node.id}`;
            const state = this.nodeStates.get(fullNodeId);
            const startTime = Date.now();

            try {
                console.log(`📝 [API网关] 使用 ${node.config.name} 生成文本`);
                
                let result;
                
                // 根据节点类型调用不同接口
                if (node.id === 'modelscope_text') {
                    result = await this._executeRequest(node.config.endpoint, {
                        action: 'text',
                        prompt: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt
                    }, node.config.timeout);
                } else if (node.id === 'writer_llm') {
                    result = await this._executeRequest(node.config.endpoint, {
                        messages: [
                            { role: 'system', content: systemPrompt || '你是一个专业的中文短视频剧本写作助手。' },
                            { role: 'user', content: prompt }
                        ],
                        temperature,
                        max_tokens: maxTokens
                    }, node.config.timeout);
                } else {
                    result = await this._executeRequest(node.config.endpoint, {
                        prompt: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
                        model,
                        temperature,
                        max_tokens: maxTokens
                    }, node.config.timeout);
                }

                const responseTime = Date.now() - startTime;
                state.recordSuccess(responseTime);
                
                return this._extractTextContent(result);
                
            } catch (error) {
                state.recordFailure();
                
                // 尝试降级
                if (!preferFree && node.config.cost > 0) {
                    console.log(`🔄 [API网关] ${node.config.name} 失败，降级到免费节点`);
                    return this.callTextAPI({ ...options, preferFree: true });
                }
                
                throw error;
            }
        }

        /**
         * 调用视频生成 API
         * @param {Object} options - 调用配置
         * @returns {Promise<string>} 视频URL
         */
        async callVideoAPI(options) {
            const {
                prompt,
                model = 'sora-2-vip-all',
                aspectRatio = '16:9',
                duration = 15,
                imageUrl,           // 首帧图
                hd = false,
                forceNode = null
            } = options;

            const node = forceNode
                ? this._getNode('video', forceNode)
                : this._selectBestNode('video', { model });
            
            if (!node) {
                throw new Error('所有视频生成节点不可用');
            }

            const fullNodeId = `video.${node.id}`;
            const state = this.nodeStates.get(fullNodeId);
            const startTime = Date.now();

            try {
                console.log(`🎬 [API网关] 使用 ${node.config.name} 生成视频`);
                
                const result = await this._executeRequest(node.config.endpoint, {
                    action: imageUrl ? 'image-to-video' : 'text-to-video',
                    prompt,
                    model,
                    aspect_ratio: aspectRatio,
                    duration,
                    image_url: imageUrl,
                    hd
                }, node.config.timeout);

                const responseTime = Date.now() - startTime;
                state.recordSuccess(responseTime);
                
                return this._extractVideoUrl(result);
                
            } catch (error) {
                state.recordFailure();
                throw error;
            }
        }

        // ==================== 节点选择策略 ====================
        _selectBestNode(category, options = {}) {
            const { preferFree = false, model = null } = options;
            const nodes = API_NODES[category];
            if (!nodes) return null;

            // 获取可用节点
            const availableNodes = Object.entries(nodes)
                .map(([id, config]) => ({
                    id,
                    config,
                    state: this.nodeStates.get(`${category}.${id}`)
                }))
                .filter(n => n.state.isAvailable())
                .filter(n => !model || !n.config.models || n.config.models.some(m => model.includes(m) || m.includes(model)));

            if (availableNodes.length === 0) return null;

            // 排序策略
            availableNodes.sort((a, b) => {
                // 优先免费节点
                if (preferFree) {
                    if (a.config.cost === 0 && b.config.cost > 0) return -1;
                    if (a.config.cost > 0 && b.config.cost === 0) return 1;
                }
                
                // 按权重和响应时间综合排序
                const scoreA = a.config.weight - (a.state.avgResponseTime / 100);
                const scoreB = b.config.weight - (b.state.avgResponseTime / 100);
                
                return scoreB - scoreA;
            });

            return availableNodes[0];
        }

        _getNode(category, nodeId) {
            const config = API_NODES[category]?.[nodeId];
            if (!config) return null;
            
            const state = this.nodeStates.get(`${category}.${nodeId}`);
            if (!state || !state.isAvailable()) return null;
            
            return { id: nodeId, config, state };
        }

        // ==================== 请求执行 ====================
        async _executeRequest(endpoint, body, timeout = 60000) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: controller.signal
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok || !data.success) {
                    throw new Error(data.message || data.error || `请求失败: ${response.status}`);
                }

                return data;
            } finally {
                clearTimeout(timeoutId);
            }
        }

        // ==================== 结果提取 ====================
        _extractImageUrl(data) {
            return data.url || data.image_url || (data.images && data.images[0]) || (data.data && data.data[0]?.url);
        }

        _extractTextContent(data) {
            return data.content || data.text || data.message || '';
        }

        _extractVideoUrl(data) {
            return data.url || data.video_url || (data.data && data.data.url);
        }

        // ==================== 健康检查 ====================
        _startHealthCheck() {
            // 每30秒检查一次节点状态
            setInterval(() => this._performHealthCheck(), 30000);
        }

        async _performHealthCheck() {
            for (const [fullNodeId, state] of this.nodeStates) {
                // 只检查熔断中的节点
                if (state.circuitState === 'open') {
                    const elapsed = Date.now() - state.circuitOpenedAt;
                    if (elapsed > CIRCUIT_BREAKER_CONFIG.recoveryTimeout) {
                        // 尝试恢复
                        state.circuitState = 'half-open';
                        console.log(`🔄 [API网关] ${fullNodeId} 尝试恢复`);
                    }
                }
            }
            
            this._saveState();
        }

        // ==================== 状态管理 ====================
        getStatus() {
            const status = {
                nodes: {},
                summary: {
                    totalNodes: 0,
                    availableNodes: 0,
                    circuitOpenNodes: 0
                }
            };

            for (const [fullNodeId, state] of this.nodeStates) {
                status.nodes[fullNodeId] = state.toJSON();
                status.summary.totalNodes++;
                
                if (state.isAvailable()) {
                    status.summary.availableNodes++;
                }
                if (state.circuitState === 'open') {
                    status.summary.circuitOpenNodes++;
                }
            }

            return status;
        }

        _saveState() {
            try {
                const state = {};
                for (const [id, nodeState] of this.nodeStates) {
                    state[id] = nodeState.toJSON();
                }
                localStorage.setItem('resilient_api_state', JSON.stringify({
                    nodes: state,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn('[API网关] 保存状态失败:', e);
            }
        }

        _restoreState() {
            try {
                const saved = localStorage.getItem('resilient_api_state');
                if (!saved) return;
                
                const data = JSON.parse(saved);
                
                // 只恢复10分钟内的状态
                if (Date.now() - data.timestamp > 10 * 60 * 1000) {
                    return;
                }
                
                for (const [id, savedState] of Object.entries(data.nodes)) {
                    const state = this.nodeStates.get(id);
                    if (state) {
                        state.failures = savedState.failures;
                        state.circuitState = savedState.circuitState;
                    }
                }
                
                console.log('📂 [API网关] 恢复节点状态');
            } catch (e) {
                console.warn('[API网关] 恢复状态失败:', e);
            }
        }

        // ==================== 成本计算 ====================
        /**
         * 获取各节点成本信息
         * @param {string} category - 类别: image | text | video
         * @returns {Array} 节点成本列表
         */
        getCostInfo(category) {
            const nodes = API_NODES[category];
            if (!nodes) return [];

            return Object.entries(nodes).map(([id, config]) => ({
                id,
                name: config.name,
                cost: config.cost,
                quality: config.quality,
                isAvailable: this.nodeStates.get(`${category}.${id}`)?.isAvailable() || false
            })).sort((a, b) => a.cost - b.cost);
        }

        /**
         * 计算预估成本
         * @param {Object} usage - 使用量
         * @returns {Object} 成本信息
         */
        estimateCost(usage) {
            const { images = 0, texts = 0, videos = 0, preferFree = false } = usage;
            
            let totalCost = 0;
            const breakdown = [];

            if (images > 0) {
                const imageNode = this._selectBestNode('image', { preferFree });
                const imageCost = imageNode ? imageNode.config.cost * images : 0;
                totalCost += imageCost;
                breakdown.push({ type: 'image', count: images, unitCost: imageNode?.config.cost || 0, total: imageCost });
            }

            if (texts > 0) {
                const textNode = this._selectBestNode('text', { preferFree });
                const textCost = textNode ? textNode.config.cost * texts : 0;
                totalCost += textCost;
                breakdown.push({ type: 'text', count: texts, unitCost: textNode?.config.cost || 0, total: textCost });
            }

            if (videos > 0) {
                const videoNode = this._selectBestNode('video', {});
                const videoCost = videoNode ? videoNode.config.cost * videos : 0;
                totalCost += videoCost;
                breakdown.push({ type: 'video', count: videos, unitCost: videoNode?.config.cost || 0, total: videoCost });
            }

            return {
                totalCost: Math.round(totalCost * 100) / 100,
                breakdown,
                currency: 'CNY'
            };
        }

        // ==================== 手动熔断控制 ====================
        /**
         * 手动触发熔断
         * @param {string} fullNodeId - 完整节点ID (如 'image.banana2_primary')
         */
        tripCircuitBreaker(fullNodeId) {
            const state = this.nodeStates.get(fullNodeId);
            if (state) {
                state.circuitState = 'open';
                state.circuitOpenedAt = Date.now();
                console.warn(`⚡ [API网关] 手动熔断: ${fullNodeId}`);
            }
        }

        /**
         * 手动恢复熔断
         * @param {string} fullNodeId - 完整节点ID
         */
        resetCircuitBreaker(fullNodeId) {
            const state = this.nodeStates.get(fullNodeId);
            if (state) {
                state.circuitState = 'closed';
                state.failures = 0;
                console.log(`🔌 [API网关] 手动恢复: ${fullNodeId}`);
            }
        }
    }

    // ==================== 导出 ====================
    const gateway = new ResilientAPIGateway();
    
    global.ResilientAPIGateway = gateway;
    global.ResilientAPIGatewayClass = ResilientAPIGateway;
    global.API_NODES = API_NODES;

    console.log('🛡️ [ResilientAPIGateway] 弹性API网关已加载');

})(typeof window !== 'undefined' ? window : global);
