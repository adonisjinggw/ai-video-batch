/**
 * ==================== MiroFish 群体智能预测引擎 - 前端核心 ====================
 * 简化版多智能体预测系统，在浏览器端运行
 */

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        apiEndpoint: '/api/proxy',
        supportedTypes: ['crypto', 'weather', 'stock', 'trend'],
        maxAgents: 5
    };

    // ==================== 智能体定义 ====================
    const AGENTS = {
        analyst: {
            name: '分析师',
            role: '数据解读',
            color: '#FF6B9D'
        },
        skeptic: {
            name: '怀疑者',
            role: '风险提示',
            color: '#6366F1'
        },
        optimist: {
            name: '乐观派',
            role: '趋势看多',
            color: '#10B981'
        },
        realist: {
            name: '现实派',
            role: '客观评估',
            color: '#F59E0B'
        },
        strategist: {
            name: '战略家',
            role: '综合建议',
            color: '#8B5CF6'
        }
    };

    // ==================== MiroFish 核心引擎 ====================
    class MiroFishEngine {
        constructor() {
            this.agents = [];
            this.taskQueue = [];
            this.isProcessing = false;
            this.accessToken = null; // 存储 Supabase access token
        }

        /**
         * 设置认证令牌
         */
        setAuthToken(token) {
            this.accessToken = token;
        }

        /**
         * 获取认证头
         */
        getAuthHeaders() {
            const headers = { 'Content-Type': 'application/json' };
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }
            return headers;
        }

        /**
         * 初始化智能体池
         */
        initAgents() {
            this.agents = Object.entries(AGENTS).map(([key, agent]) => ({
                id: key,
                ...agent,
                status: 'idle',
                lastAnalysis: null
            }));
            console.log('[MiroFish] 智能体池初始化完成:', this.agents.length, '个智能体');
        }

        /**
         * 发起预测
         */
        async predict(taskType, params, userId) {
            console.log('[MiroFish] 发起预测:', taskType, params);

            // 1. 检查配额
            const quotaCheck = await this.checkQuota();
            if (!quotaCheck.success) {
                return { success: false, error: quotaCheck.error };
            }

            // 2. 数据采集
            this.updateStatus('正在采集数据...');
            const dataResponse = await fetch(CONFIG.apiEndpoint, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    action_mirofish: 'collect',
                    taskType,
                    params
                })
            });

            if (!dataResponse.ok) {
                return { success: false, error: '数据采集失败' };
            }

            const data = await dataResponse.json();
            if (!data.success) {
                return { success: false, error: data.error };
            }

            // 3. 多智能体分析
            this.updateStatus('智能体分析中...');
            const analyses = await this.runAgentAnalysis(data);

            // 4. 综合预测结果
            const prediction = this.generatePrediction(taskType, data, analyses);

            // 5. 保存到后端
            const saveResponse = await fetch(CONFIG.apiEndpoint, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    action_mirofish: 'predict',
                    taskType,
                    params,
                    prediction
                })
            });

            return {
                success: true,
                prediction,
                analyses,
                timestamp: Date.now()
            };
        }

        /**
         * 检查配额
         */
        async checkQuota() {
            try {
                const response = await fetch(`${CONFIG.apiEndpoint}?action_mirofish=quota`, {
                    headers: this.getAuthHeaders()
                });
                return await response.json();
            } catch (error) {
                console.error('[MiroFish] 配额检查失败:', error);
                return { success: true }; // 失败时允许继续
            }
        }

        /**
         * 运行智能体分析
         */
        async runAgentAnalysis(data) {
            const analyses = {};

            for (const agent of this.agents) {
                this.updateAgentStatus(agent.id, '分析中...');
                agent.lastAnalysis = await this.analyzeWithAgent(agent, data);
                analyses[agent.id] = agent.lastAnalysis;
                this.updateAgentStatus(agent.id, '完成');
            }

            return analyses;
        }

        /**
         * 单个智能体分析
         */
        async analyzeWithAgent(agent, data) {
            // 根据数据类型和智能体角色生成分析
            const analysis = {
                agent: agent.name,
                role: agent.role,
                content: '',
                sentiment: 'neutral',
                confidence: 0.5
            };

            switch (data.type) {
                case 'crypto':
                    return this.analyzeCrypto(agent, data);
                case 'weather':
                    return this.analyzeWeather(agent, data);
                case 'stock':
                    return this.analyzeStock(agent, data);
                case 'trend':
                    return this.analyzeTrend(agent, data);
                default:
                    analysis.content = '暂无分析';
                    return analysis;
            }
        }

        /**
         * 加密货币分析
         */
        analyzeCrypto(agent, data) {
            const { currentPrice, marketData } = data;
            const analysis = { agent: agent.name, role: agent.role };

            // 计算价格趋势
            const prices = marketData.slice(-7); // 最近7天
            const trend = prices[prices.length - 1][1] > prices[0][1] ? 'up' : 'down';
            const changePercent = ((prices[prices.length - 1][1] - prices[0][1]) / prices[0][1] * 100).toFixed(2);

            switch (agent.role) {
                case '数据解读':
                    analysis.content = `当前价格: $${currentPrice}，7日趋势: ${trend === 'up' ? '上涨' : '下跌'} ${changePercent}%`;
                    analysis.sentiment = trend === 'up' ? 'positive' : 'negative';
                    break;
                case '风险提示':
                    if (Math.abs(changePercent) > 10) {
                        analysis.content = `⚠️ 波动较大（${changePercent}%），建议谨慎操作`;
                        analysis.sentiment = 'warning';
                    } else {
                        analysis.content = `当前波动在正常范围内`;
                        analysis.sentiment = 'neutral';
                    }
                    break;
                case '趋势看多':
                    analysis.content = trend === 'up' ? `📈 上涨趋势，可能继续走强` : `📉 当前下跌，可能是入场机会`;
                    analysis.sentiment = trend === 'up' ? 'positive' : 'neutral';
                    break;
                default:
                    analysis.content = '观察中...';
            }

            return analysis;
        }

        /**
         * 天气分析
         */
        analyzeWeather(agent, data) {
            const { forecast, location } = data;
            const analysis = { agent: agent.name, role: agent.role };

            const today = forecast[0];
            const avgTemp = ((today.maxTemp + today.minTemp) / 2).toFixed(1);

            switch (agent.role) {
                case '数据解读':
                    analysis.content = `${location}今日: ${today.minTemp}°C ~ ${today.maxTemp}°C，降水概率: ${(today.precipitation > 0 ? '有' : '无')}`;
                    break;
                case '客观评估':
                    if (today.maxTemp > 30) {
                        analysis.content = '🌡️ 高温天气，注意防暑';
                    } else if (today.maxTemp < 5) {
                        analysis.content = '🧥 低温天气，注意保暖';
                    } else {
                        analysis.content = '🌤️ 温度适宜，适合外出';
                    }
                    break;
                default:
                    analysis.content = '天气正常';
            }

            return analysis;
        }

        /**
         * 股票分析
         */
        analyzeStock(agent, data) {
            const { price, change, changePercent } = data;
            const analysis = { agent: agent.name, role: agent.role };

            switch (agent.role) {
                case '数据解读':
                    analysis.content = `股价: $${price}，变动: ${change} (${changePercent})`;
                    analysis.sentiment = parseFloat(changePercent) > 0 ? 'positive' : 'negative';
                    break;
                case '风险提示':
                    const absChange = Math.abs(parseFloat(changePercent));
                    if (absChange > 2) {
                        analysis.content = `⚠️ 波动较大 (${changePercent})，注意风险`;
                        analysis.sentiment = 'warning';
                    } else {
                        analysis.content = `当前波动较小`;
                        analysis.sentiment = 'neutral';
                    }
                    break;
                default:
                    analysis.content = '观察中...';
            }

            return analysis;
        }

        /**
         * 趋势分析
         */
        analyzeTrend(agent, data) {
            const { keyword, results } = data;
            const analysis = { agent: agent.name, role: agent.role };

            if (data.degraded) {
                analysis.content = data.message;
                return analysis;
            }

            const count = results.length;
            switch (agent.role) {
                case '数据解读':
                    analysis.content = `找到 ${count} 条关于 "${keyword}" 的相关信息`;
                    break;
                case '综合建议':
                    if (count > 0) {
                        analysis.content = `💡 建议：关注 "${keyword}" 相关的 ${Math.min(count, 3)} 条核心信息`;
                    } else {
                        analysis.content = '暂无相关趋势数据';
                    }
                    break;
                default:
                    analysis.content = '分析中...';
            }

            return analysis;
        }

        /**
         * 生成综合预测
         */
        generatePrediction(taskType, data, analyses) {
            const prediction = {
                taskType,
                summary: '',
                sentiment: 'neutral',
                confidence: 0.5,
                recommendations: [],
                timestamp: Date.now()
            };

            // 统计各智能体情绪
            const sentiments = Object.values(analyses).map(a => a.sentiment);
            const positiveCount = sentiments.filter(s => s === 'positive').length;
            const negativeCount = sentiments.filter(s => s === 'negative').length;
            const warningCount = sentiments.filter(s => s === 'warning').length;

            // 确定整体情绪
            if (positiveCount > negativeCount) {
                prediction.sentiment = 'positive';
                prediction.confidence = 0.6 + (positiveCount / CONFIG.maxAgents) * 0.4;
            } else if (negativeCount > positiveCount) {
                prediction.sentiment = 'negative';
                prediction.confidence = 0.6 + (negativeCount / CONFIG.maxAgents) * 0.4;
            }

            // 生成总结和建议
            if (warningCount > 0) {
                prediction.summary = '⚠️ 需要注意风险';
                prediction.recommendations.push('建议谨慎操作，做好风险控制');
            } else if (prediction.sentiment === 'positive') {
                prediction.summary = '📈 趋势向好';
                prediction.recommendations.push('可以考虑积极参与');
            } else if (prediction.sentiment === 'negative') {
                prediction.summary = '📉 趋势偏弱';
                prediction.recommendations.push('建议观望或谨慎操作');
            } else {
                prediction.summary = '🤔 观望中';
                prediction.recommendations.push('继续观察市场变化');
            }

            return prediction;
        }

        /**
         * 获取历史记录
         */
        async getHistory(userId, limit = 10) {
            try {
                const response = await fetch(`${CONFIG.apiEndpoint}?action_mirofish=history&limit=${limit}`, {
                    headers: this.getAuthHeaders()
                });
                const result = await response.json();
                return result.success ? result.history : [];
            } catch (error) {
                console.error('[MiroFish] 获取历史失败:', error);
                return [];
            }
        }

        /**
         * 更新状态
         */
        updateStatus(message) {
            const statusEl = document.getElementById('mirofish-status');
            if (statusEl) {
                statusEl.textContent = message;
            }
        }

        /**
         * 更新智能体状态
         */
        updateAgentStatus(agentId, status) {
            const agentEl = document.getElementById(`agent-${agentId}-status`);
            const agentDot = document.getElementById(`agent-dot-${agentId}`);
            const agentCard = document.getElementById(`agent-card-${agentId}`);
            if (agentEl) {
                agentEl.textContent = status;
                // 更新状态样式
                agentEl.className = 'agent-status';
                if (agentDot) agentDot.className = 'agent-status-dot';
                if (status === '完成' || status === 'done') {
                    agentEl.classList.add('done');
                    if (agentDot) agentDot.classList.add('done');
                    if (agentCard) agentCard.classList.remove('active');
                } else if (status === '分析中...' || status === 'working') {
                    agentEl.classList.add('working');
                    if (agentDot) agentDot.classList.add('thinking');
                    if (agentCard) agentCard.classList.add('active');
                } else {
                    agentEl.classList.add('idle');
                    if (agentDot) agentDot.classList.add('active');
                    if (agentCard) agentCard.classList.remove('active');
                }
            }
        }
    }

    // ==================== 导出 ====================
    window.MiroFishEngine = new MiroFishEngine();

    console.log('[MiroFish] 预测引擎已加载');

})();
