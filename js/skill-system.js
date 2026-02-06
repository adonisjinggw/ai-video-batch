/**
 * 🧩 RollRoll Skill 技能系统 - 核心管理模块
 * 让用户可以选择不同的 Skills（技能/工作流）来完成特定任务
 * 基于现有 API（TaskOrchestrator、各种生成函数）构建，零额外 Token 成本
 */

(function () {
    'use strict';

    // ==================== 数据结构定义 ====================
    /**
     * Skill 定义结构
     * @typedef {Object} SkillDefinition
     * @property {string} id - 唯一标识
     * @property {string} name - 显示名称
     * @property {string} icon - 图标 emoji
     * @property {string} category - 分类: video | image | content | automation
     * @property {string} description - 详细描述
     * @property {Array<SkillParameter>} parameters - 参数列表
     * @property {Function} execute - 执行函数
     * @property {Function} [estimateCost] - 成本预估函数
     * @property {Function} [estimateTime] - 时间预估函数
     */

    /**
     * Skill 参数定义
     * @typedef {Object} SkillParameter
     * @property {string} key - 参数键名
     * @property {string} label - 显示标签
     * @property {string} type - 类型: text | number | select | checkbox | textarea | file | image
     * @property {boolean} [required] - 是否必填
     * @property {*} [default] - 默认值
     * @property {number} [min] - 最小值（number类型）
     * @property {number} [max] - 最大值（number类型）
     * @property {Array<{value: string, label: string}>} [options] - 选项列表（select类型）
     * @property {string} [placeholder] - 占位符文本
     * @property {string} [hint] - 提示信息
     */

    // ==================== Skill 管理器 ====================
    const SkillManager = {
        /** @type {Map<string, SkillDefinition>} */
        _skills: new Map(),

        /** @type {Array<Object>} */
        _history: [],

        /** @type {Object|null} */
        _currentExecution: null,

        /** @type {Array<Function>} */
        _listeners: [],

        // ---------- 注册与获取 ----------

        /**
         * 注册一个 Skill
         * @param {SkillDefinition} skill
         */
        register(skill) {
            if (!skill.id || !skill.name || !skill.execute) {
                console.error('❌ [SkillManager] Skill 缺少必要字段:', skill);
                return false;
            }
            this._skills.set(skill.id, skill);
            console.log(`✅ [SkillManager] 已注册 Skill: ${skill.icon} ${skill.name}`);
            return true;
        },

        /**
         * 批量注册 Skills
         * @param {Array<SkillDefinition>} skills
         */
        registerAll(skills) {
            let count = 0;
            for (const skill of skills) {
                if (this.register(skill)) count++;
            }
            console.log(`🧩 [SkillManager] 批量注册完成: ${count}/${skills.length} 个 Skill`);
            return count;
        },

        /**
         * 获取所有已注册的 Skills
         * @returns {Array<SkillDefinition>}
         */
        getAll() {
            return Array.from(this._skills.values());
        },

        /**
         * 按分类获取 Skills
         * @param {string} category
         * @returns {Array<SkillDefinition>}
         */
        getByCategory(category) {
            if (!category || category === 'all') {
                return this.getAll();
            }
            return this.getAll().filter(s => s.category === category);
        },

        /**
         * 根据 ID 获取 Skill
         * @param {string} id
         * @returns {SkillDefinition|undefined}
         */
        getById(id) {
            return this._skills.get(id);
        },

        /**
         * 搜索 Skills
         * @param {string} keyword
         * @returns {Array<SkillDefinition>}
         */
        search(keyword) {
            const kw = keyword.toLowerCase().trim();
            if (!kw) return this.getAll();
            return this.getAll().filter(s =>
                s.name.toLowerCase().includes(kw) ||
                s.description.toLowerCase().includes(kw)
            );
        },

        // ---------- 执行与控制 ----------

        /**
         * 执行一个 Skill
         * @param {string} skillId - Skill ID
         * @param {Object} params - 参数对象
         * @param {Object} callbacks - 回调函数
         * @param {Function} [callbacks.onProgress] - 进度回调 (step, progress, message)
         * @param {Function} [callbacks.onStepComplete] - 步骤完成回调 (stepName, result)
         * @param {Function} [callbacks.onComplete] - 完成回调 (result)
         * @param {Function} [callbacks.onError] - 错误回调 (error)
         * @returns {Promise<Object>}
         */
        async execute(skillId, params, callbacks = {}) {
            const skill = this.getById(skillId);
            if (!skill) {
                const error = new Error(`Skill 不存在: ${skillId}`);
                callbacks.onError?.(error);
                throw error;
            }

            // 检查是否有正在执行的任务
            if (this._currentExecution) {
                const error = new Error('已有 Skill 正在执行中，请等待完成或取消');
                callbacks.onError?.(error);
                throw error;
            }

            // 验证必填参数
            for (const param of skill.parameters || []) {
                if (param.required && (params[param.key] === undefined || params[param.key] === '')) {
                    const error = new Error(`缺少必填参数: ${param.label}`);
                    callbacks.onError?.(error);
                    throw error;
                }
            }

            // 创建执行上下文
            const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const startTime = Date.now();

            this._currentExecution = {
                id: executionId,
                skillId,
                skillName: skill.name,
                params,
                startTime,
                status: 'running',
                progress: 0,
                steps: [],
                cancelled: false
            };

            this._emit('executionStarted', this._currentExecution);

            try {
                console.log(`🚀 [SkillManager] 开始执行 Skill: ${skill.icon} ${skill.name}`);

                // 执行 Skill
                const result = await skill.execute(params, {
                    ...callbacks,
                    onProgress: (step, progress, message) => {
                        if (this._currentExecution?.cancelled) {
                            throw new Error('用户取消执行');
                        }
                        this._currentExecution.progress = progress;
                        this._currentExecution.currentStep = step;
                        callbacks.onProgress?.(step, progress, message);
                        this._emit('executionProgress', { ...this._currentExecution, message });
                    },
                    onStepComplete: (stepName, stepResult) => {
                        if (this._currentExecution) {
                            this._currentExecution.steps.push({ name: stepName, result: stepResult, time: Date.now() });
                        }
                        callbacks.onStepComplete?.(stepName, stepResult);
                    },
                    isCancelled: () => this._currentExecution?.cancelled || false
                });

                // 记录成功
                const endTime = Date.now();
                const record = {
                    id: executionId,
                    skillId,
                    skillName: skill.name,
                    skillIcon: skill.icon,
                    params,
                    result,
                    startTime,
                    endTime,
                    duration: endTime - startTime,
                    status: 'completed'
                };

                this._addHistory(record);
                this._currentExecution = null;
                this._emit('executionCompleted', record);

                console.log(`✅ [SkillManager] Skill 执行完成: ${skill.name}, 耗时 ${((endTime - startTime) / 1000).toFixed(1)}s`);
                callbacks.onComplete?.(result);
                return result;

            } catch (error) {
                // 记录失败
                const endTime = Date.now();
                const record = {
                    id: executionId,
                    skillId,
                    skillName: skill.name,
                    skillIcon: skill.icon,
                    params,
                    error: error.message,
                    startTime,
                    endTime,
                    duration: endTime - startTime,
                    status: this._currentExecution?.cancelled ? 'cancelled' : 'failed'
                };

                this._addHistory(record);
                this._currentExecution = null;
                this._emit('executionFailed', record);

                console.error(`❌ [SkillManager] Skill 执行失败: ${skill.name}`, error);
                callbacks.onError?.(error);
                throw error;
            }
        },

        /**
         * 取消当前执行
         */
        cancel() {
            if (this._currentExecution) {
                this._currentExecution.cancelled = true;
                console.log('🛑 [SkillManager] 已请求取消当前 Skill 执行');
                return true;
            }
            return false;
        },

        /**
         * 获取当前执行状态
         * @returns {Object|null}
         */
        getCurrentExecution() {
            return this._currentExecution ? { ...this._currentExecution } : null;
        },

        // ---------- 历史记录 ----------

        /**
         * 获取执行历史
         * @param {number} [limit=50] - 限制数量
         * @returns {Array<Object>}
         */
        getHistory(limit = 50) {
            return this._history.slice(0, limit);
        },

        /**
         * 清空历史记录
         */
        clearHistory() {
            this._history = [];
            this._saveHistory();
        },

        /**
         * 添加历史记录
         * @private
         */
        _addHistory(record) {
            this._history.unshift(record);
            // 保留最近100条
            if (this._history.length > 100) {
                this._history = this._history.slice(0, 100);
            }
            this._saveHistory();
        },

        /**
         * 保存历史到 localStorage
         * @private
         */
        _saveHistory() {
            try {
                localStorage.setItem('rollroll_skill_history', JSON.stringify(this._history));
            } catch (e) {
                console.warn('[SkillManager] 保存历史失败:', e);
            }
        },

        /**
         * 从 localStorage 加载历史
         * @private
         */
        _loadHistory() {
            try {
                const data = localStorage.getItem('rollroll_skill_history');
                if (data) {
                    this._history = JSON.parse(data);
                }
            } catch (e) {
                console.warn('[SkillManager] 加载历史失败:', e);
            }
        },

        // ---------- 收藏功能 ----------

        /**
         * 获取收藏的 Skills
         * @returns {Array<string>}
         */
        getFavorites() {
            try {
                const data = localStorage.getItem('rollroll_skill_favorites');
                return data ? JSON.parse(data) : [];
            } catch (e) {
                return [];
            }
        },

        /**
         * 添加收藏
         * @param {string} skillId
         */
        addFavorite(skillId) {
            const favorites = this.getFavorites();
            if (!favorites.includes(skillId)) {
                favorites.push(skillId);
                localStorage.setItem('rollroll_skill_favorites', JSON.stringify(favorites));
            }
        },

        /**
         * 移除收藏
         * @param {string} skillId
         */
        removeFavorite(skillId) {
            const favorites = this.getFavorites().filter(id => id !== skillId);
            localStorage.setItem('rollroll_skill_favorites', JSON.stringify(favorites));
        },

        /**
         * 切换收藏状态
         * @param {string} skillId
         * @returns {boolean} 新的收藏状态
         */
        toggleFavorite(skillId) {
            const favorites = this.getFavorites();
            if (favorites.includes(skillId)) {
                this.removeFavorite(skillId);
                return false;
            } else {
                this.addFavorite(skillId);
                return true;
            }
        },

        /**
         * 检查是否已收藏
         * @param {string} skillId
         * @returns {boolean}
         */
        isFavorite(skillId) {
            return this.getFavorites().includes(skillId);
        },

        // ---------- 事件系统 ----------

        /**
         * 监听事件
         * @param {string} event
         * @param {Function} callback
         */
        on(event, callback) {
            this._listeners.push({ event, callback });
        },

        /**
         * 移除监听
         * @param {string} event
         * @param {Function} callback
         */
        off(event, callback) {
            this._listeners = this._listeners.filter(l => !(l.event === event && l.callback === callback));
        },

        /**
         * 触发事件
         * @private
         */
        _emit(event, data) {
            for (const listener of this._listeners) {
                if (listener.event === event) {
                    try {
                        listener.callback(data);
                    } catch (e) {
                        console.error('[SkillManager] 事件回调错误:', e);
                    }
                }
            }
        },

        // ---------- 自定义技能 ----------

        /**
         * 注销一个 Skill
         * @param {string} skillId
         */
        unregister(skillId) {
            return this._skills.delete(skillId);
        },

        /**
         * 保存自定义技能到 localStorage 并注册
         * @param {Object} skillDef - 自定义技能定义（不含 execute/estimateCost）
         * @returns {Object} 注册后的完整 skill
         */
        saveCustomSkill(skillDef) {
            // 确保有 id
            if (!skillDef.id) {
                skillDef.id = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            }
            skillDef.isCustom = true;

            // 保存到 localStorage（不含函数）
            const stored = this._getStoredCustomSkills();
            const idx = stored.findIndex(s => s.id === skillDef.id);
            // 存储时剥离函数
            const toStore = { ...skillDef };
            delete toStore.execute;
            delete toStore.estimateCost;
            if (idx >= 0) {
                stored[idx] = toStore;
            } else {
                stored.push(toStore);
            }
            try {
                localStorage.setItem('rollroll_custom_skills', JSON.stringify(stored));
            } catch (e) {
                console.error('[SkillManager] 保存自定义技能失败:', e);
            }

            // 构建可执行版本并注册
            const fullSkill = this._hydrateCustomSkill(toStore);
            this._skills.set(fullSkill.id, fullSkill);
            console.log(`✅ [SkillManager] 自定义技能已保存: ${fullSkill.icon} ${fullSkill.name}`);
            return fullSkill;
        },

        /**
         * 删除自定义技能
         * @param {string} skillId
         */
        deleteCustomSkill(skillId) {
            const stored = this._getStoredCustomSkills().filter(s => s.id !== skillId);
            try {
                localStorage.setItem('rollroll_custom_skills', JSON.stringify(stored));
            } catch (e) { }
            this._skills.delete(skillId);
            console.log(`🗑️ [SkillManager] 自定义技能已删除: ${skillId}`);
        },

        /**
         * 获取所有自定义技能（原始数据）
         * @returns {Array}
         */
        getCustomSkills() {
            return this._getStoredCustomSkills();
        },

        /**
         * 导出技能为通用 JSON
         * @param {string} skillId
         * @returns {Object}
         */
        exportSkill(skillId) {
            const skill = this.getById(skillId);
            if (!skill) return null;
            const exported = { ...skill };
            delete exported.execute;
            delete exported.estimateCost;
            return { version: '1.0', type: 'rollroll-skill', skill: exported };
        },

        /**
         * 导入技能 JSON
         * @param {Object} json
         * @returns {Object} 注册后的 skill
         */
        importSkill(json) {
            if (!json || json.type !== 'rollroll-skill' || !json.skill) {
                throw new Error('无效的技能文件格式');
            }
            const skillDef = { ...json.skill };
            // 生成新 ID 避免冲突
            skillDef.id = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            skillDef.isCustom = true;
            return this.saveCustomSkill(skillDef);
        },

        /** @private */
        _getStoredCustomSkills() {
            try {
                const data = localStorage.getItem('rollroll_custom_skills');
                return data ? JSON.parse(data) : [];
            } catch (e) { return []; }
        },

        /**
         * 将存储的自定义技能数据转化为可执行 skill
         * @private
         */
        _hydrateCustomSkill(def) {
            const skill = { ...def };
            skill.estimateCost = this._buildCustomEstimateCost(def);
            skill.execute = this._buildCustomExecute(def);
            return skill;
        },

        /**
         * 根据模板类型构建 estimateCost 函数
         * @private
         */
        _buildCustomEstimateCost(def) {
            return (params) => {
                const type = def.templateType || 'text';
                const count = parseInt(params.count || def.count) || 1;
                if (type === 'text') {
                    return { film: Math.ceil(count * 0.2), time: '约 30 秒' };
                } else if (type === 'image') {
                    return { film: Math.ceil(count * 0.5), time: `约 ${count} 分钟` };
                } else if (type === 'video') {
                    return { film: Math.ceil(count * 3.5), time: `约 ${count * 2} 分钟` };
                }
                return { film: 1, time: '约 1 分钟' };
            };
        },

        /**
         * 根据模板类型构建 execute 函数
         * @private
         */
        _buildCustomExecute(def) {
            const templateType = def.templateType || 'text';
            const promptTemplate = def.promptTemplate || '';
            const aspectRatio = def.aspectRatio || '16:9';
            const videoModel = def.videoModel || 'sora-2-all';
            const defaultCount = parseInt(def.count) || 1;

            // 替换模板中的 {{key}} 为参数值
            function fillTemplate(template, params) {
                return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
                    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
                });
            }

            if (templateType === 'text') {
                return async (params, callbacks) => {
                    callbacks.onProgress?.('生成文本', 20, '正在生成...');
                    const prompt = fillTemplate(promptTemplate, params);
                    let result = '';
                    if (typeof callScriptGenerator === 'function') {
                        result = await callScriptGenerator({}, prompt);
                    } else if (typeof callModelScopeTextAPI === 'function') {
                        result = await callModelScopeTextAPI(prompt);
                    } else {
                        throw new Error('文本生成功能不可用');
                    }
                    callbacks.onStepComplete?.('文本生成', { script: result.substring(0, 100) + '...' });
                    callbacks.onProgress?.('完成', 100, '生成完成');
                    // 解析为列表（按换行拆分）
                    const lines = result.split(/\n+/).filter(l => l.trim()).map(l => l.replace(/^\d+[\.\)、]\s*/, '').trim()).filter(l => l.length > 3);
                    return { content: result, copywritings: lines };
                };
            }

            if (templateType === 'image') {
                return async (params, callbacks) => {
                    const count = parseInt(params.count) || defaultCount;
                    const results = [];
                    for (let i = 0; i < count; i++) {
                        if (callbacks.isCancelled?.()) break;
                        const progress = Math.round((i / count) * 100);
                        callbacks.onProgress?.(`生成图片 ${i + 1}/${count}`, progress, `正在生成第 ${i + 1} 张...`);
                        try {
                            const prompt = fillTemplate(promptTemplate, { ...params, index: i + 1 });
                            let imageUrl = '';
                            if (typeof callBanana2ImageAPI === 'function') {
                                imageUrl = await callBanana2ImageAPI(prompt, { aspectRatio: params.aspectRatio || aspectRatio });
                            } else if (typeof callModelScopeImageAPI === 'function') {
                                imageUrl = await callModelScopeImageAPI(prompt, { aspectRatio: params.aspectRatio || aspectRatio });
                            } else {
                                throw new Error('图片生成功能不可用');
                            }
                            callbacks.onStepComplete?.(`图片${i + 1}`, { imageUrl });
                            results.push({ subject: `图片${i + 1}`, imageUrl, status: 'success' });
                        } catch (error) {
                            results.push({ subject: `图片${i + 1}`, error: error.message, status: 'failed' });
                        }
                    }
                    callbacks.onProgress?.('完成', 100, `生成 ${results.filter(r => r.status === 'success').length}/${count} 张`);
                    return { images: results };
                };
            }

            if (templateType === 'video') {
                return async (params, callbacks) => {
                    const count = parseInt(params.count) || defaultCount;
                    const results = [];
                    for (let i = 0; i < count; i++) {
                        if (callbacks.isCancelled?.()) break;
                        const progress = Math.round((i / count) * 100);
                        callbacks.onProgress?.(`生成视频 ${i + 1}/${count}`, progress, `正在生成第 ${i + 1} 个...`);
                        try {
                            const prompt = fillTemplate(promptTemplate, { ...params, index: i + 1 });
                            // 先生成封面图
                            let imageUrl = '';
                            if (typeof callBanana2ImageAPI === 'function') {
                                callbacks.onProgress?.(`视频${i + 1} 封面`, progress, '生成封面图...');
                                imageUrl = await callBanana2ImageAPI(prompt, { aspectRatio: params.aspectRatio || aspectRatio });
                            }
                            callbacks.onStepComplete?.(`视频${i + 1} 封面`, { imageUrl });
                            // 图生视频
                            let videoUrl = '';
                            if (imageUrl && typeof callSora2ImageToVideoAPI === 'function') {
                                callbacks.onProgress?.(`视频${i + 1} 渲染`, progress + 5, '生成视频...');
                                videoUrl = await callSora2ImageToVideoAPI(imageUrl, prompt, {
                                    model: params.videoModel || videoModel,
                                    duration: parseInt(params.duration) || 15,
                                    aspectRatio: params.aspectRatio || aspectRatio
                                });
                            } else if (typeof callSora2TextToVideoAPI === 'function') {
                                videoUrl = await callSora2TextToVideoAPI(prompt, {
                                    model: params.videoModel || videoModel,
                                    duration: parseInt(params.duration) || 15,
                                    aspectRatio: params.aspectRatio || aspectRatio
                                });
                            }
                            callbacks.onStepComplete?.(`视频${i + 1}`, { videoUrl });
                            results.push({ index: i + 1, imageUrl, videoUrl, status: 'success' });
                        } catch (error) {
                            results.push({ index: i + 1, error: error.message, status: 'failed' });
                        }
                    }
                    callbacks.onProgress?.('完成', 100, `生成 ${results.filter(r => r.status === 'success').length}/${count} 个`);
                    return { videos: results };
                };
            }

            // fallback
            return async (params, callbacks) => {
                callbacks.onProgress?.('执行', 50, '执行中...');
                callbacks.onProgress?.('完成', 100, '完成');
                return { content: fillTemplate(promptTemplate, params) };
            };
        },

        /**
         * 从 localStorage 加载自定义技能
         * @private
         */
        _loadCustomSkills() {
            const stored = this._getStoredCustomSkills();
            let count = 0;
            for (const def of stored) {
                try {
                    const skill = this._hydrateCustomSkill(def);
                    this._skills.set(skill.id, skill);
                    count++;
                } catch (e) {
                    console.warn('[SkillManager] 加载自定义技能失败:', def.id, e);
                }
            }
            if (count > 0) {
                console.log(`🔧 [SkillManager] 已加载 ${count} 个自定义技能`);
            }
        },

        // ---------- 初始化 ----------

        /**
         * 初始化
         */
        init() {
            this._loadHistory();
            this._loadCustomSkills();
            console.log('🧩 [SkillManager] 初始化完成');
        }
    };

    // ==================== UI 渲染器 ====================
    const SkillUI = {
        /** @type {string|null} */
        _selectedSkillId: null,

        /** @type {string} */
        _currentCategory: 'all',

        /** @type {string} */
        _searchKeyword: '',

        /**
         * 初始化 UI
         */
        init() {
            // 绑定事件
            SkillManager.on('executionStarted', (data) => this._onExecutionStarted(data));
            SkillManager.on('executionProgress', (data) => this._onExecutionProgress(data));
            SkillManager.on('executionCompleted', (data) => this._onExecutionCompleted(data));
            SkillManager.on('executionFailed', (data) => this._onExecutionFailed(data));

            console.log('🎨 [SkillUI] 初始化完成');
        },

        /**
         * 渲染 Skill 列表
         * @param {string} [containerId='skillsGrid']
         */
        renderSkillList(containerId = 'skillsGrid') {
            const container = document.getElementById(containerId);
            if (!container) return;

            let skills = this._searchKeyword
                ? SkillManager.search(this._searchKeyword)
                : SkillManager.getByCategory(this._currentCategory);

            const favorites = SkillManager.getFavorites();

            // 收藏的排在前面
            skills.sort((a, b) => {
                const aFav = favorites.includes(a.id) ? 0 : 1;
                const bFav = favorites.includes(b.id) ? 0 : 1;
                return aFav - bFav;
            });

            if (skills.length === 0) {
                container.innerHTML = `
                    <div class="skill-empty-state">
                        <div class="skill-empty-icon">🔍</div>
                        <div class="skill-empty-text">未找到匹配的技能</div>
                    </div>
                `;
                return;
            }

            container.innerHTML = skills.map(skill => this._renderSkillCard(skill)).join('');
        },

        /**
         * 渲染单个 Skill 卡片
         * @private
         */
        _renderSkillCard(skill) {
            const isFavorite = SkillManager.isFavorite(skill.id);
            const categoryLabels = {
                video: '视频',
                image: '图像',
                content: '内容',
                automation: '自动化'
            };

            return `
                <div class="skill-card" data-skill-id="${skill.id}" onclick="SkillUI.openSkillConfig('${skill.id}')">
                    <div class="skill-card-header">
                        <div class="skill-card-icon">${skill.icon}</div>
                        <button class="skill-favorite-btn ${isFavorite ? 'active' : ''}" 
                                onclick="event.stopPropagation(); SkillUI.toggleFavorite('${skill.id}')"
                                title="${isFavorite ? '取消收藏' : '添加收藏'}">
                            ${isFavorite ? '⭐' : '☆'}
                        </button>
                    </div>
                    <div class="skill-card-name">${skill.name}</div>
                    <div class="skill-card-desc">${skill.description}</div>
                    <div class="skill-card-footer">
                        <span class="skill-card-category">${categoryLabels[skill.category] || skill.category}</span>
                    </div>
                </div>
            `;
        },

        /**
         * 切换分类
         * @param {string} category
         */
        setCategory(category) {
            this._currentCategory = category;
            this._searchKeyword = '';

            // 更新 Tab 状态
            document.querySelectorAll('.skill-category-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.category === category);
            });

            // 清空搜索框
            const searchInput = document.getElementById('skillSearchInput');
            if (searchInput) searchInput.value = '';

            this.renderSkillList();
        },

        /**
         * 搜索
         * @param {string} keyword
         */
        search(keyword) {
            this._searchKeyword = keyword;
            this.renderSkillList();
        },

        /**
         * 切换收藏
         * @param {string} skillId
         */
        toggleFavorite(skillId) {
            SkillManager.toggleFavorite(skillId);
            this.renderSkillList();
        },

        /**
         * 打开 Skill 配置弹窗
         * @param {string} skillId
         */
        openSkillConfig(skillId) {
            const skill = SkillManager.getById(skillId);
            if (!skill) return;

            this._selectedSkillId = skillId;

            const modal = document.getElementById('skillConfigModal');
            if (!modal) return;

            // 填充弹窗内容
            document.getElementById('skillConfigTitle').textContent = `${skill.icon} ${skill.name}`;
            document.getElementById('skillConfigDesc').textContent = skill.description;

            // 渲染参数表单
            const formContainer = document.getElementById('skillConfigForm');
            formContainer.innerHTML = this._renderParameterForm(skill.parameters || []);

            // 预估成本
            this._updateCostEstimate(skill);

            // 显示弹窗
            modal.style.display = 'flex';
        },

        /**
         * 关闭 Skill 配置弹窗
         */
        closeSkillConfig() {
            const modal = document.getElementById('skillConfigModal');
            if (modal) modal.style.display = 'none';
            this._selectedSkillId = null;
        },

        /**
         * 渲染参数表单
         * @private
         */
        _renderParameterForm(parameters) {
            if (!parameters || parameters.length === 0) {
                return '<div class="skill-form-empty">此技能无需额外配置参数</div>';
            }

            return parameters.map(param => {
                const required = param.required ? '<span class="required">*</span>' : '';
                const hint = param.hint ? `<div class="skill-param-hint">${param.hint}</div>` : '';

                let input = '';
                switch (param.type) {
                    case 'text':
                        input = `<input type="text" id="skill_param_${param.key}" 
                                        class="skill-param-input" 
                                        placeholder="${param.placeholder || ''}"
                                        value="${param.default || ''}"
                                        ${param.required ? 'required' : ''}>`;
                        break;

                    case 'number':
                        input = `<input type="number" id="skill_param_${param.key}" 
                                        class="skill-param-input" 
                                        value="${param.default || ''}"
                                        min="${param.min ?? ''}" max="${param.max ?? ''}"
                                        ${param.required ? 'required' : ''}>`;
                        break;

                    case 'textarea':
                        input = `<textarea id="skill_param_${param.key}" 
                                           class="skill-param-textarea" 
                                           placeholder="${param.placeholder || ''}"
                                           ${param.required ? 'required' : ''}>${param.default || ''}</textarea>`;
                        break;

                    case 'select':
                        const options = (param.options || []).map(opt =>
                            `<option value="${opt.value}" ${opt.value === param.default ? 'selected' : ''}>${opt.label}</option>`
                        ).join('');
                        input = `<select id="skill_param_${param.key}" class="skill-param-select" ${param.required ? 'required' : ''}>
                                    ${options}
                                 </select>`;
                        break;

                    case 'checkbox':
                        input = `<label class="skill-param-checkbox">
                                    <input type="checkbox" id="skill_param_${param.key}" 
                                           ${param.default ? 'checked' : ''}>
                                    <span>${param.checkboxLabel || '启用'}</span>
                                 </label>`;
                        break;

                    case 'file':
                    case 'image':
                        input = `<div class="skill-param-file">
                                    <input type="file" id="skill_param_${param.key}" 
                                           accept="${param.type === 'image' ? 'image/*' : '*'}"
                                           ${param.multiple ? 'multiple' : ''}
                                           style="display:none;"
                                           onchange="SkillUI._onFileSelected('${param.key}', this)">
                                    <button type="button" class="skill-file-btn" 
                                            onclick="document.getElementById('skill_param_${param.key}').click()">
                                        ${param.type === 'image' ? '📷' : '📁'} 选择${param.type === 'image' ? '图片' : '文件'}
                                    </button>
                                    <span id="skill_param_${param.key}_name" class="skill-file-name">未选择</span>
                                 </div>`;
                        break;

                    default:
                        input = `<input type="text" id="skill_param_${param.key}" 
                                        class="skill-param-input" 
                                        value="${param.default || ''}">`;
                }

                return `
                    <div class="skill-param-group">
                        <label class="skill-param-label">${param.label}${required}</label>
                        ${input}
                        ${hint}
                    </div>
                `;
            }).join('');
        },

        /**
         * 文件选择回调
         * @private
         */
        _onFileSelected(key, input) {
            const nameEl = document.getElementById(`skill_param_${key}_name`);
            if (nameEl && input.files.length > 0) {
                nameEl.textContent = input.files.length > 1
                    ? `已选择 ${input.files.length} 个文件`
                    : input.files[0].name;
            }
        },

        /**
         * 更新成本预估
         * @private
         */
        _updateCostEstimate(skill) {
            const estimateEl = document.getElementById('skillCostEstimate');
            if (!estimateEl) return;

            if (skill.estimateCost) {
                const params = this._collectFormParams();
                try {
                    const cost = skill.estimateCost(params);
                    estimateEl.innerHTML = `
                        <div class="skill-estimate-row">
                            <span>预估消耗:</span>
                            <span class="skill-estimate-value">🎞️ ${cost.film || 0} 胶片</span>
                        </div>
                        ${cost.time ? `
                        <div class="skill-estimate-row">
                            <span>预估时间:</span>
                            <span class="skill-estimate-value">⏱️ ${cost.time}</span>
                        </div>
                        ` : ''}
                    `;
                } catch (e) {
                    estimateEl.innerHTML = '<div class="skill-estimate-note">无法预估成本</div>';
                }
            } else {
                estimateEl.innerHTML = '<div class="skill-estimate-note">成本取决于实际生成内容</div>';
            }
        },

        /**
         * 收集表单参数
         * @private
         */
        _collectFormParams() {
            const skill = SkillManager.getById(this._selectedSkillId);
            if (!skill) return {};

            const params = {};
            for (const param of skill.parameters || []) {
                const el = document.getElementById(`skill_param_${param.key}`);
                if (!el) continue;

                switch (param.type) {
                    case 'checkbox':
                        params[param.key] = el.checked;
                        break;
                    case 'number':
                        params[param.key] = el.value ? Number(el.value) : param.default;
                        break;
                    case 'file':
                    case 'image':
                        params[param.key] = el.files;
                        break;
                    default:
                        params[param.key] = el.value || param.default;
                }
            }
            return params;
        },

        /**
         * 执行当前选中的 Skill
         */
        async executeCurrentSkill() {
            if (!this._selectedSkillId) return;

            const params = this._collectFormParams();

            // 关闭配置弹窗
            this.closeSkillConfig();

            // 显示进度面板
            this._showProgressPanel();

            try {
                await SkillManager.execute(this._selectedSkillId, params, {
                    onProgress: (step, progress, message) => {
                        this._updateProgress(step, progress, message);
                    },
                    onStepComplete: (stepName, result) => {
                        this._addStepResult(stepName, result);
                    }
                });
            } catch (error) {
                // 错误已在 _onExecutionFailed 中处理
            }
        },

        /**
         * 显示进度面板
         * @private
         */
        _showProgressPanel() {
            const panel = document.getElementById('skillProgressPanel');
            if (panel) {
                panel.style.display = 'flex';
                document.getElementById('skillProgressSteps').innerHTML = '';
                document.getElementById('skillProgressBar').style.width = '0%';
                document.getElementById('skillProgressText').textContent = '准备中...';
            }
        },

        /**
         * 隐藏进度面板
         * @private
         */
        _hideProgressPanel() {
            const panel = document.getElementById('skillProgressPanel');
            if (panel) panel.style.display = 'none';
        },

        /**
         * 更新进度
         * @private
         */
        _updateProgress(step, progress, message) {
            const bar = document.getElementById('skillProgressBar');
            const text = document.getElementById('skillProgressText');
            if (bar) bar.style.width = `${progress}%`;
            if (text) text.textContent = message || `正在执行: ${step}`;
        },

        /**
         * 添加步骤结果
         * @private
         */
        _addStepResult(stepName, result) {
            const container = document.getElementById('skillProgressSteps');
            if (!container) return;

            const stepEl = document.createElement('div');
            stepEl.className = 'skill-progress-step completed';
            stepEl.innerHTML = `
                <span class="step-icon">✅</span>
                <span class="step-name">${stepName}</span>
            `;
            container.appendChild(stepEl);
        },

        // ---------- 事件处理 ----------

        _onExecutionStarted(data) {
            console.log('[SkillUI] 执行开始:', data.skillName);
        },

        _onExecutionProgress(data) {
            // 进度更新由回调处理
        },

        _onExecutionCompleted(data) {
            setTimeout(() => {
                this._hideProgressPanel();
                this._showCompletionMessage(data);
            }, 500);
        },

        _onExecutionFailed(data) {
            setTimeout(() => {
                this._hideProgressPanel();
                this._showErrorMessage(data);
            }, 500);
        },

        _showCompletionMessage(data) {
            const duration = ((data.duration || 0) / 1000).toFixed(1);
            if (typeof showToast === 'function') {
                showToast(`✅ ${data.skillName} 执行完成！耗时 ${duration}s`, 'success');
            } else {
                alert(`✅ ${data.skillName} 执行完成！耗时 ${duration}s`);
            }
        },

        _showErrorMessage(data) {
            const message = data.status === 'cancelled'
                ? `🛑 ${data.skillName} 已取消`
                : `❌ ${data.skillName} 执行失败: ${data.error}`;

            if (typeof showToast === 'function') {
                showToast(message, data.status === 'cancelled' ? 'warning' : 'error');
            } else {
                alert(message);
            }
        },

        /**
         * 取消当前执行
         */
        cancelExecution() {
            if (SkillManager.cancel()) {
                if (typeof showToast === 'function') {
                    showToast('🛑 正在取消...', 'warning');
                }
            }
        }
    };

    // ==================== 全局导出 ====================
    window.SkillManager = SkillManager;
    window.SkillUI = SkillUI;

    // 初始化
    SkillManager.init();
    SkillUI.init();

    console.log('🧩 Skill 系统加载完成');
})();
