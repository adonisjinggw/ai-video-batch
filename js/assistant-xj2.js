/**
 * ==================== 小卷助手 V9.0.0.1 - 霓虹灵魂 (Neon Soul) ====================
 * 合并 AIRI 对话 + MiroFish 预测的统一助手
 * 保留旧版所有功能：记忆、语音、关键词回复、情绪检测
 */

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        // 预测类型配置
        predictionTypes: [
            { id: 'crypto', icon: '💰', label: '加密货币' },
            { id: 'stock', icon: '📈', label: '股票' },
            { id: 'weather', icon: '🌤️', label: '天气' },
            { id: 'trend', icon: '📊', label: '趋势' }
        ],

        // 智能体配置
        agents: [
            { id: 'analyst', name: '分析师', emoji: '📊', color: '#FF6B9D' },
            { id: 'skeptic', name: '怀疑者', emoji: '🤔', color: '#6366F1' },
            { id: 'optimist', name: '乐观派', emoji: '📈', color: '#10B981' },
            { id: 'realist', name: '现实派', emoji: '⚖️', color: '#F59E0B' },
            { id: 'strategist', name: '战略家', emoji: '🎯', color: '#8B5CF6' }
        ],

        // 情绪配置
        emotions: {
            neutral: { emoji: '😊', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
            happy: { emoji: '😄', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
            sad: { emoji: '😢', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
            angry: { emoji: '😠', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
            surprised: { emoji: '😲', gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
            thinking: { emoji: '🤔', gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' }
        }
    };

    // ==================== 小卷助手 V2 主类 ====================
    class AssistantXJ2 {
        constructor() {
            this.container = null;
            this.panel = null;
            this.messagesEl = null;
            this.inputEl = null;
            this.isOpen = false;
            this.isPredicting = false;
            this.isRecordingVoice = false;
            this.currentTopic = '';
            this.currentType = '';
            this.pendingPredictionType = null; // 待处理的预测类型（用户输入主题后执行）
        }

        /**
         * 初始化助手
         */
        init() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this._init());
            } else {
                this._init();
            }
        }

        _init() {
            this.container = document.getElementById('xj2Container');
            this.panel = document.getElementById('xj2Panel');
            this.messagesEl = document.getElementById('xj2Messages');
            this.inputEl = document.getElementById('xj2Input');

            if (!this.container || !this.panel) {
                console.warn('[XJ2] 助手容器未找到');
                return;
            }

            this._bindEvents();
            this._initPredictionCards();

            console.log('[XJ2] 小卷助手 V2 初始化完成');
        }

        /**
         * 绑定事件
         */
        _bindEvents() {
            const avatarBtn = document.getElementById('xj2AvatarBtn');
            if (avatarBtn) {
                avatarBtn.addEventListener('click', () => this.toggle());
            }

            const closeBtn = document.getElementById('xj2PanelClose');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.close());
            }

            // 发送按钮和Enter键由 mobile.html 的 initAssistant 绑定（真实AI调用）
            // 不在这里绑定，避免冲突

            const voiceBtn = document.getElementById('xj2VoiceBtn');
            if (voiceBtn) {
                voiceBtn.addEventListener('click', () => this.toggleVoiceRecording());
            }

            // 拖拽功能
            this._initDrag();

            // 阻止面板内部滚动穿透到页面
            this._initScrollLock();
        }

        _initDrag() {
            const container = this.container;
            if (!container) {
                console.warn('[XJ2 拖拽] container 未找到');
                return;
            }

            console.log('[XJ2 拖拽] 初始化拖拽功能');

            let isDragging = false;
            let hasMoved = false;
            let startX, startY, startLeft, startTop;

            const onDown = (e) => {
                // 只响应头像按钮上的拖拽，避免面板内操作受影响
                const avatarBtn = document.getElementById('xj2AvatarBtn');
                if (!avatarBtn || !avatarBtn.contains(e.target)) {
                    console.log('[XJ2 拖拽] onDown 触发但不在头像按钮上');
                    return;
                }
                console.log('[XJ2 拖拽] 开始拖拽');
                isDragging = true;
                hasMoved = false;
                const touch = e.touches ? e.touches[0] : e;
                startX = touch.clientX;
                startY = touch.clientY;
                const rect = container.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                container.style.transition = 'none';
                // 不在这里 preventDefault，让 click 事件能正常触发
            };

            const onMove = (e) => {
                if (!isDragging) return;
                console.log('[XJ2 拖拽] onMove 触发');
                const touch = e.touches ? e.touches[0] : e;
                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) hasMoved = true;
                if (!hasMoved) return;

                const newLeft = Math.max(0, Math.min(window.innerWidth - 70, startLeft + dx));
                const newTop = Math.max(0, Math.min(window.innerHeight - 70, startTop + dy));

                container.style.left = newLeft + 'px';
                container.style.top = newTop + 'px';
                container.style.right = 'auto';
                container.style.bottom = 'auto';
                e.preventDefault(); // 只有真正拖拽时才阻止
            };

            const onUp = (e) => {
                if (!isDragging) return;
                console.log('[XJ2 拖拽] onUp 触发，hasMoved:', hasMoved);
                isDragging = false;
                container.style.transition = '';
                if (hasMoved) {
                    // 阻止 click 触发 toggle
                    const block = (ev) => { ev.stopPropagation(); };
                    document.getElementById('xj2AvatarBtn')?.addEventListener('click', block, { once: true, capture: true });
                }
                // 点击（hasMoved=false）时不阻止，让 click 事件自然触发
            };

            console.log('[XJ2 拖拽] 绑定事件监听器');
            container.addEventListener('mousedown', onDown);
            container.addEventListener('touchstart', onDown, { passive: false });
            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchend', onUp);
        }

        /**
         * 阻止面板内部滚动穿透到页面
         * 当用户在面板内滑动时，阻止事件冒泡到主页
         */
        _initScrollLock() {
            if (!this.panel || !this.messagesEl) return;

            let touchStartY = 0;
            let scrollTop = 0;

            // 消息区域：最内层，阻止 touchmove 冒泡
            this.messagesEl.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
                scrollTop = this.messagesEl.scrollTop;
            }, { passive: true });

            this.messagesEl.addEventListener('touchmove', (e) => {
                // 如果消息区域还没滚到头或末尾，禁止冒泡
                const el = this.messagesEl;
                const atTop = el.scrollTop <= 0;
                const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
                const movingUp = e.touches[0].clientY > touchStartY;
                const movingDown = e.touches[0].clientY < touchStartY;

                // 到达边界且继续往边界外滑，阻止冒泡
                if ((atTop && movingUp) || (atBottom && movingDown)) {
                    e.stopPropagation();
                }
            }, { passive: true });

            // 面板整体：如果面板在顶部/底部，阻止冒泡
            this.panel.addEventListener('touchmove', (e) => {
                e.stopPropagation();
            }, { passive: true });

            console.log('[XJ2 滚动锁定] 已初始化');
        }

        /**
         * 初始化预测卡片
         */
        _initPredictionCards() {
            const cardsContainer = document.getElementById('xj2PredictionCards');
            if (!cardsContainer) return;

            cardsContainer.innerHTML = CONFIG.predictionTypes.map(type => `
                <div class="xj2-prediction-card" data-type="${type.id}" onclick="window.XJ2?.startPrediction('${type.id}')">
                    <div class="xj2-prediction-card-icon">${type.icon}</div>
                    <div class="xj2-prediction-card-label">${type.label}</div>
                </div>
            `).join('');
        }

        /**
         * 切换面板
         */
        toggle() {
            this.isOpen ? this.close() : this.open();
        }

        /**
         * 打开面板
         */
        open() {
            this.isOpen = true;
            this.panel.classList.add('open');
            this.inputEl?.focus();
        }

        /**
         * 关闭面板
         */
        close() {
            this.isOpen = false;
            this.panel.classList.remove('open');
        }

        /**
         * 添加消息
         */
        addMessage(content, type = 'assistant', options = {}) {
            if (!this.messagesEl) return;

            const msgEl = document.createElement('div');
            msgEl.className = `xj2-message ${type}`;
            msgEl.textContent = content;

            this.messagesEl.appendChild(msgEl);
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        }

        /**
         * 显示系统消息
         */
        addSystemMessage(content) {
            this.addMessage(content, 'system');
        }

        /**
         * 添加预测结果消息
         */
        addPredictionResult(result) {
            if (!this.messagesEl) return;

            const { topic, type, prediction } = result;

            const typeConfig = CONFIG.predictionTypes.find(t => t.id === type) || { icon: '🔮', label: '预测' };
            const sentimentClass = prediction.sentiment === 'positive' ? 'positive' :
                                  prediction.sentiment === 'negative' ? 'negative' : 'neutral';

            const msgEl = document.createElement('div');
            msgEl.className = 'xj2-message prediction';

            msgEl.innerHTML = `
                <div class="xj2-prediction-result">
                    <div class="xj2-prediction-result-header">
                        <div class="xj2-prediction-result-icon">${typeConfig.icon}</div>
                        <div class="xj2-prediction-result-info">
                            <div class="xj2-prediction-result-topic">${topic}</div>
                            <div class="xj2-prediction-result-type">${typeConfig.label}</div>
                        </div>
                    </div>
                    <div class="xj2-prediction-summary">${prediction.summary}</div>
                    <div class="xj2-prediction-metrics">
                        <div class="xj2-prediction-metric">
                            <div class="xj2-prediction-metric-value ${sentimentClass}">
                                ${prediction.sentiment === 'positive' ? '偏多' : prediction.sentiment === 'negative' ? '偏空' : '中性'}
                            </div>
                            <div class="xj2-prediction-metric-label">情绪</div>
                        </div>
                        <div class="xj2-prediction-metric">
                            <div class="xj2-prediction-metric-value">${prediction.confidence}%</div>
                            <div class="xj2-prediction-metric-label">置信度</div>
                        </div>
                    </div>
                    ${prediction.recommendations?.length ? `
                        <ul class="xj2-prediction-recommendations">
                            ${prediction.recommendations.map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    ` : ''}
                </div>
            `;

            this.messagesEl.appendChild(msgEl);
            // 强制滚动确保内容可见
            requestAnimationFrame(() => {
                this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
            });
        }

        /**
         * 显示打字指示器
         */
        showTyping() {
            if (!this.messagesEl) return;

            const el = document.createElement('div');
            el.className = 'xj2-message assistant';
            el.id = 'xj2Typing';
            el.innerHTML = `
                <span style="display: inline-block; animation: xj2-typing-bounce 1s infinite;">
                    🐟 正在思考
                </span>
            `;

            this.messagesEl.appendChild(el);
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        }

        /**
         * 移除打字指示器
         */
        removeTyping() {
            const el = document.getElementById('xj2Typing');
            if (el) el.remove();
        }

        /**
         * 显示预测中状态
         */
        showPredicting(type, topic) {
            if (!this.messagesEl) return;

            this.currentType = type;
            this.currentTopic = topic;

            const typeConfig = CONFIG.predictionTypes.find(t => t.id === type) || { icon: '🔮', label: '预测' };

            const el = document.createElement('div');
            el.className = 'xj2-message prediction';
            el.id = 'xj2Predicting';
            el.innerHTML = `
                <div class="xj2-predicting">
                    <div class="xj2-predicting-header">
                        <div class="xj2-predicting-avatar">${typeConfig.icon}</div>
                        <div class="xj2-predicting-info">
                            <div class="xj2-predicting-title">🐟 ${topic}</div>
                            <div class="xj2-predicting-status" id="xj2PredictingStatus">正在启动智能体...</div>
                        </div>
                    </div>
                    <div class="xj2-agents-grid">
                        ${CONFIG.agents.map(agent => `
                            <div class="xj2-agent-card" id="xj2Agent_${agent.id}">
                                <div class="xj2-agent-icon">${agent.emoji}</div>
                                <div class="xj2-agent-name">${agent.name}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="xj2-progress">
                        <div class="xj2-progress-bar" id="xj2ProgressBar" style="width: 0%"></div>
                    </div>
                </div>
            `;

            this.messagesEl.appendChild(el);
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        }

        /**
         * 更新预测进度
         */
        updatePredictionProgress(agentId, status) {
            const statusEl = document.getElementById('xj2PredictingStatus');
            const progressBar = document.getElementById('xj2ProgressBar');
            const agentCard = document.getElementById(`xj2Agent_${agentId}`);

            if (statusEl) {
                statusEl.textContent = status;
            }

            if (agentCard) {
                agentCard.classList.add('active');
                if (status.includes('完成') || status.includes('done')) {
                    agentCard.classList.remove('active');
                    agentCard.classList.add('done');
                }
            }

            const doneCount = CONFIG.agents.filter(a => {
                const card = document.getElementById(`xj2Agent_${a.id}`);
                return card?.classList.contains('done');
            }).length;
            const progress = Math.round((doneCount / CONFIG.agents.length) * 90);

            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
        }

        /**
         * 移除预测中状态
         */
        removePredicting() {
            const el = document.getElementById('xj2Predicting');
            if (el) el.remove();
        }

        /**
         * 开始预测（通过输入框收集主题）
         */
        async startPrediction(type) {
            // 存储待执行的预测类型
            this.pendingPredictionType = type;

            // 关闭面板再打开，确保输入框可见
            this.close();
            setTimeout(() => {
                this.open();
                if (this.inputEl) {
                    // 清空输入框并设置提示文字
                    this.inputEl.value = '';
                    this.inputEl.placeholder = `请输入${CONFIG.predictionTypes.find(t => t.id === type)?.label || '预测'}主题...`;
                    this.inputEl.focus();
                }
            }, 300);
        }

        /**
         * 执行预测
         */
        async _executePrediction(type, topic) {
            this.isPredicting = true;
            this.showPredicting(type, topic);

            try {
                if (typeof callWriterLLM !== 'function') {
                    throw new Error('LLM 调用功能不可用，请刷新页面重试');
                }

                const agentResults = {};
                const totalAgents = CONFIG.agents.length;
                const progressPerAgent = Math.floor(80 / totalAgents);

                const agentPromises = CONFIG.agents.map(async (agent, index) => {
                    try {
                        this.updatePredictionProgress(agent.id, `${agent.emoji} ${agent.name} 分析中...`);

                        const messages = [
                            { role: 'system', content: this._getAgentSystemPrompt(agent, type) },
                            { role: 'user', content: `请分析 ${topic} 的走势，给出你的专业判断。` }
                        ];

                        const response = await callWriterLLM(messages, {
                            model: 'qwen3.5-plus',
                            temperature: 0.7,
                            max_tokens: 500,
                            useMemory: false
                        });

                        agentResults[agent.id] = { ...agent, content: response };
                        this.updatePredictionProgress(agent.id, `✅ ${agent.name} 完成`);

                        return { id: agent.id, success: true };
                    } catch (error) {
                        console.error(`[XJ2] 智能体 ${agent.id} 失败:`, error);
                        agentResults[agent.id] = { ...agent, content: `分析暂时不可用: ${error.message}` };
                        this.updatePredictionProgress(agent.id, `⚠️ ${agent.name} 失败`);
                        return { id: agent.id, success: false, error: error.message };
                    }
                });

                await Promise.all(agentPromises);

                this.updatePredictionProgress('', '🎯 生成最终预测...');

                const summaryMessages = [
                    { role: 'system', content: this._getSummarySystemPrompt(type, topic) },
                    { role: 'user', content: `各智能体分析结果：\n\n${Object.values(agentResults).map(a => `${a.emoji} ${a.name}: ${a.content}`).join('\n\n')}` }
                ];

                const summaryResponse = await callWriterLLM(summaryMessages, {
                    model: 'qwen3.5-plus',
                    temperature: 0.5,
                    max_tokens: 800,
                    useMemory: false
                });

                let prediction = {
                    summary: summaryResponse,
                    sentiment: 'neutral',
                    confidence: 70,
                    recommendations: ['综合各智能体意见，请谨慎决策']
                };

                try {
                    const jsonMatch = summaryResponse.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        prediction = { ...prediction, ...parsed };
                    }
                } catch (e) {
                    console.warn('[XJ2] 解析预测 JSON 失败');
                }

                this.removePredicting();
                this.addSystemMessage(`🐟 群体智能预测「${topic}」已完成！`);
                this.addPredictionResult({ topic, type, prediction, agents: agentResults });

            } catch (error) {
                console.error('[XJ2] 预测失败:', error);
                this.removePredicting();
                this.addSystemMessage(`⚠️ 预测失败: ${error.message}`);
            } finally {
                this.isPredicting = false;
                this.updatePredictionProgress('', '');
            }
        }

        /**
         * 获取智能体系统提示词
         */
        _getAgentSystemPrompt(agent, type) {
            const typePrompts = {
                crypto: { context: '加密货币', focus: '价格走势、成交量、市场情绪' },
                stock: { context: '股票', focus: '基本面、技术面、行业趋势' },
                weather: { context: '天气', focus: '气象数据、季节规律' },
                trend: { context: '趋势', focus: '数据趋势、舆论走向' }
            };

            const config = typePrompts[type] || typePrompts.trend;

            const prompts = {
                analyst: `你是一位资深的数据分析师，擅长从数据中提取关键信息。你的分析应该基于事实数据，提供有力的数据支撑。\n\n分析主题：${config.context}\n重点：${config.focus}`,
                skeptic: `你是一位风险控制专家，擅长识别潜在风险和问题。你总是从最坏的情况出发，指出可能的不利因素和风险点。\n\n分析主题：${config.context}`,
                optimist: `你是一位乐观的趋势分析师，擅长发现机会和积极因素。你总是看到事情好的一面，给用户信心。\n\n分析主题：${config.context}`,
                realist: `你是一位客观的现实主义者，擅长平衡利弊给出中肯评价。你既不盲目乐观也不过度悲观。\n\n分析主题：${config.context}`,
                strategist: `你是一位战略规划专家，擅长综合各方观点给出最佳策略建议。\n\n分析主题：${config.context}`
            };

            return prompts[agent.id] || prompts.analyst;
        }

        /**
         * 获取综合预测系统提示词
         */
        _getSummarySystemPrompt(type, topic) {
            const typeLabel = { crypto: '加密货币', stock: '股票', weather: '天气', trend: '趋势' }[type] || '主题';

            return `你是一位群体智能预测专家，负责综合多个专业智能体的分析意见，生成最终的预测结论。

请根据以下各智能体的分析意见，综合给出：
1. 一个简短的总结（1-2句话）
2. 一个情绪判断（positive/negative/neutral）
3. 一个置信度评分（0-100）
4. 2-3条具体的操作建议

请用 JSON 格式输出：
{
  "summary": "总结文字",
  "sentiment": "positive/negative/neutral",
  "confidence": 75,
  "recommendations": ["建议1", "建议2", "建议3"]
}

预测主题：${topic}
预测类型：${typeLabel}`;
        }

        /**
         * 发送消息（完整版，包含关键词回复和预测处理）
         */
        sendMessage() {
            const message = this.inputEl?.value.trim();
            if (!message) return;

            this.addMessage(message, 'user');
            this.inputEl.value = '';

            // 如果有待执行的预测，直接执行预测
            if (this.pendingPredictionType) {
                const type = this.pendingPredictionType;
                this.pendingPredictionType = null; // 清除待处理状态
                this.inputEl.placeholder = '说点什么...';

                // 关闭面板，执行预测
                this.close();
                setTimeout(() => {
                    this.open();
                    this._executePrediction(type, message);
                }, 300);
                return;
            }

            this.setStatus('thinking');
            this.showTyping();

            // 记忆用户偏好
            if (window.AssistantMemory) {
                window.AssistantMemory.setPreference('last_topic', message);
            }

            // 模拟延迟和关键词回复
            setTimeout(() => {
                this.removeTyping();

                let response = '';
                let emotion = 'neutral';

                if (message.includes('预测') || message.includes('miro')) {
                    response = '🔮 我可以帮你进行群体智能预测！点击上方"加密货币"或"股票"卡片开始预测。';
                    emotion = 'happy';
                } else if (message.includes('记忆') || message.includes('历史')) {
                    response = '📋 我会记住你的使用偏好，让你下次使用更方便！';
                    emotion = 'happy';
                } else if (message.includes('帮助') || message.includes('help')) {
                    response = '💡 我可以帮你:\n• 进行群体智能预测\n• 记住你的使用偏好\n• 语音对话(点击麦克风图标)';
                    emotion = 'happy';
                } else {
                    response = '我收到了：' + message + '\n\n💡 如果需要预测，点击上方的预测卡片吧！';
                    emotion = 'neutral';
                }

                this.addMessage(response, 'assistant', { emotion });
                this.setStatus('idle');
            }, 500);
        }

        /**
         * 切换语音录制
         */
        async toggleVoiceRecording() {
            const btn = document.getElementById('xj2VoiceBtn');
            if (!btn) return;

            if (!this.isRecordingVoice) {
                // 检查麦克风权限
                if (window.AssistantVoice) {
                    try {
                        const hasPermission = await window.AssistantVoice.checkMicrophonePermission();
                        if (!hasPermission) {
                            const granted = await window.AssistantVoice.requestMicrophonePermission();
                            if (!granted) {
                                showToast?.('请允许麦克风权限');
                                return;
                            }
                        }
                    } catch (e) {
                        console.warn('[XJ2] 麦克风权限检查失败:', e);
                    }
                }

                btn.classList.add('recording');
                this.isRecordingVoice = true;
                this.setStatus('speaking');
                showToast?.('正在录音...');
            } else {
                btn.classList.remove('recording');
                this.isRecordingVoice = false;
                this.setStatus('idle');
                showToast?.('录音已停止');
            }
        }

        /**
         * 显示记忆历史
         */
        showMemoryHistory() {
            if (!window.AssistantMemory) {
                this.addMessage('📋 记忆系统暂不可用', 'assistant');
                return;
            }

            const memories = window.AssistantMemory.getByType('preference');
            if (memories.length === 0) {
                this.addMessage('📋 暂无记忆记录', 'assistant');
                return;
            }

            let memoryText = '📋 你的偏好记忆:\n';
            memories.forEach(m => {
                memoryText += `• ${m.key}: ${m.value}\n`;
            });

            this.addMessage(memoryText, 'assistant');
        }

        /**
         * 清空对话
         */
        clearMessages() {
            if (this.messagesEl) {
                this.messagesEl.innerHTML = `
                    <div class="xj2-message assistant">
                        👋 对话已清空！有什么我可以帮你的吗？
                    </div>
                `;
            }
        }

        /**
         * 设置状态
         */
        setStatus(status) {
            const statusEl = document.getElementById('xj2Status');
            if (!statusEl) return;

            statusEl.className = 'xj2-status';
            if (status !== 'idle') {
                statusEl.classList.add(status);
            }
        }

        /**
         * 检测情绪
         */
        detectEmotion(text) {
            if (!text) return 'neutral';

            const lowerText = text.toLowerCase();

            if (lowerText.includes('🔮') || lowerText.includes('预测') || lowerText.includes('神奇') || lowerText.includes('😊')) {
                return 'happy';
            }
            if (lowerText.includes('❌') || lowerText.includes('失败') || lowerText.includes('抱歉')) {
                return 'sad';
            }
            if (lowerText.includes('⚠️') || lowerText.includes('注意')) {
                return 'surprised';
            }
            if (lowerText.includes('🤔') || lowerText.includes('思考')) {
                return 'thinking';
            }

            return 'neutral';
        }
    }

    // ==================== 导出到全局 ====================
    window.AssistantXJ2 = AssistantXJ2;

    // 兼容旧版函数（供 mobile.html 调用）
    window.toggleAssistantPanel = function() {
        window.XJ2?.toggle();
    };

    window.sendAssistantMessage = function() {
        window.XJ2?.sendMessage();
    };

    window.toggleVoiceRecording = function() {
        window.XJ2?.toggleVoiceRecording();
    };

    window.showMemoryHistory = function() {
        window.XJ2?.showMemoryHistory();
    };

    window.addAssistantBubble = function(type, content, options) {
        window.XJ2?.addMessage(content, type, options);
    };

    window.quickAction = function(action) {
        if (!window.XJ2) return;
        switch(action) {
            case 'prediction':
                window.XJ2.open();
                break;
            case 'history':
                window.XJ2.showMemoryHistory();
                break;
            case 'clear':
                window.XJ2.clearMessages();
                break;
        }
    };

    // 自动初始化
    window.addEventListener('DOMContentLoaded', () => {
        window.XJ2 = new AssistantXJ2();
        window.XJ2.init();
    });

})();
