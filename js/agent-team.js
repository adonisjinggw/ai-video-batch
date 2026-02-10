/**
 * 🤖 Agent Team - 多智能体协作系统核心
 * @version 1.0.0
 * 
 * 核心组件：
 * - ToolRegistry: 工具注册表，映射 tool_id → API 函数
 * - Agent: 智能体，具有专业角色、系统提示词、可用工具
 * - AgentTeam: 团队，由 Coordinator 调度多 Agent 协作
 */

(function (global) {
    'use strict';

    // ==================== 工具注册表 ====================
    const ToolRegistry = {
        _tools: new Map(),

        register(id, config) {
            this._tools.set(id, config);
        },

        get(id) {
            return this._tools.get(id);
        },

        async execute(toolId, params) {
            const tool = this._tools.get(toolId);
            if (!tool) throw new Error(`工具不存在: ${toolId}`);
            console.log(`🔧 [Tool] 执行: ${toolId}`, params);
            return await tool.fn(params);
        },

        /** 获取工具描述（供 LLM 理解） */
        describeTools(toolIds) {
            return toolIds.map(id => {
                const t = this._tools.get(id);
                if (!t) return null;
                return { id, name: t.name, description: t.description, params: t.params || [] };
            }).filter(Boolean);
        },

        /** 初始化内置工具映射 */
        init() {
            // 文本生成
            this.register('text_gen', {
                name: '文本生成',
                description: '生成文案/剧本/策划文本。参数: prompt(提示词)',
                params: ['prompt'],
                fn: async (p) => {
                    if (typeof callScriptGenerator === 'function') {
                        return await callScriptGenerator({}, p.prompt);
                    }
                    throw new Error('callScriptGenerator 不可用');
                }
            });

            this.register('text_write', {
                name: '写作LLM',
                description: '灵活写作，支持多轮对话。参数: prompt(提示词)',
                params: ['prompt'],
                fn: async (p) => {
                    if (typeof callWriterLLM === 'function') {
                        const msgs = [
                            { role: 'system', content: '你是专业写作助手。直接输出内容，不要解释。' },
                            { role: 'user', content: p.prompt }
                        ];
                        return await callWriterLLM(msgs, { temperature: 0.8 });
                    }
                    throw new Error('callWriterLLM 不可用');
                }
            });

            // 图片生成
            this.register('image_banana', {
                name: 'Banana2图片',
                description: '高质量图片生成（快速）。参数: prompt(英文提示词), aspectRatio(比例,默认16:9), refImage(参考图URL,可选)',
                params: ['prompt', 'aspectRatio', 'refImage'],
                fn: async (p) => {
                    if (typeof callBanana2ImageAPI === 'function') {
                        return await callBanana2ImageAPI(p.prompt, {
                            aspectRatio: p.aspectRatio || '16:9',
                            refImage: p.refImage
                        });
                    }
                    throw new Error('callBanana2ImageAPI 不可用');
                }
            });

            this.register('image_modelscope', {
                name: '万象Max图片',
                description: '万象Max图片生成（支持多图编辑）。参数: prompt(提示词), aspectRatio(比例), refImage(参考图URL,可选)',
                params: ['prompt', 'aspectRatio', 'refImage'],
                fn: async (p) => {
                    if (typeof callModelScopeImageAPI === 'function') {
                        return await callModelScopeImageAPI(p.prompt, {
                            aspectRatio: p.aspectRatio || '1:1',
                            refImage: p.refImage
                        });
                    }
                    throw new Error('callModelScopeImageAPI 不可用');
                }
            });

            this.register('image_mj', {
                name: 'Midjourney图片',
                description: 'Midjourney高质量图片生成（付费）。参数: prompt(英文提示词), aspectRatio(比例,默认16:9), model(midjourney-fast/midjourney-turbo,默认midjourney-fast), refImage(参考图URL,可选)',
                params: ['prompt', 'aspectRatio', 'model', 'refImage'],
                fn: async (p) => {
                    if (typeof callMidjourneyImageAPI === 'function') {
                        return await callMidjourneyImageAPI(p.prompt, {
                            aspectRatio: p.aspectRatio || '16:9',
                            model: p.model || 'midjourney-fast',
                            refImage: p.refImage
                        });
                    }
                    throw new Error('callMidjourneyImageAPI 不可用');
                }
            });

            // 视频生成
            this.register('video_text', {
                name: '文生视频',
                description: '文字描述生成视频。参数: prompt(英文提示词), model(视频模型: sora-2-vip-all/veo3.1/grok-video-3/kling-2.5-720p-5s/hailuo-02-768p-6s/vidu-q2-pro-8s-1080p等,默认sora-2-vip-all), aspectRatio(比例)',
                params: ['prompt', 'model', 'aspectRatio'],
                fn: async (p) => {
                    if (typeof callSora2TextToVideoAPI === 'function') {
                        return await callSora2TextToVideoAPI(p.prompt, {
                            model: p.model || 'sora-2-vip-all',
                            aspectRatio: p.aspectRatio || '16:9'
                        });
                    }
                    throw new Error('callSora2TextToVideoAPI 不可用');
                }
            });

            this.register('video_image', {
                name: '图生视频',
                description: '图片动态化生成视频。参数: imageUrl(图片URL), prompt(英文动作描述), model(视频模型: sora-2-vip-all/veo3.1/grok-video-3等,默认sora-2-vip-all), aspectRatio(比例)',
                params: ['imageUrl', 'prompt', 'model', 'aspectRatio'],
                fn: async (p) => {
                    if (typeof callSora2ImageToVideoAPI === 'function') {
                        return await callSora2ImageToVideoAPI(p.imageUrl, p.prompt, {
                            model: p.model || 'sora-2-vip-all',
                            aspectRatio: p.aspectRatio || '16:9'
                        });
                    }
                    throw new Error('callSora2ImageToVideoAPI 不可用');
                }
            });

            // OCR
            this.register('ocr', {
                name: 'OCR识别',
                description: '识别图片中的文字。参数: imageUrl(图片URL), prompt(识别要求,可选)',
                params: ['imageUrl', 'prompt'],
                fn: async (p) => {
                    if (typeof callOCRAPI === 'function') {
                        return await callOCRAPI(p.imageUrl, p.prompt);
                    }
                    throw new Error('callOCRAPI 不可用');
                }
            });

            // 📷 图片智能分析（参考图深度理解）
            this.register('image_analyze', {
                name: '图片智能分析',
                description: '深度分析参考图片的内容、风格、构图、色彩等。用于理解用户上传的参考图。参数: imageUrl(图片URL或base64), analysisType(分析类型: style/content/color/composition/all, 默认all)',
                params: ['imageUrl', 'analysisType'],
                fn: async (p) => {
                    if (typeof callOCRAPI !== 'function') throw new Error('callOCRAPI 不可用');
                    const type = p.analysisType || 'all';
                    const prompts = {
                        style: '请详细分析这张图片的视觉风格，包括：艺术风格(写实/卡通/扁平/3D等)、色彩倾向(暖色/冷色/高饱和/低饱和)、质感(磨砂/光滑/复古/现代)、整体氛围。用JSON格式输出: {"style":"","colorTone":"","texture":"","mood":"","keywords":[]}',
                        content: '请详细描述这张图片的内容，包括：主体是什么、背景环境、人物/物体的姿态和表情、文字内容(如果有)、品牌元素。用JSON格式输出: {"subject":"","background":"","details":"","text":"","brandElements":[]}',
                        color: '请分析这张图片的色彩方案，提取：主色调(hex)、辅助色(hex)、点缀色(hex)、整体明暗、色彩搭配风格。用JSON格式输出: {"primary":"","secondary":"","accent":"","brightness":"","palette":""}',
                        composition: '请分析这张图片的构图方式，包括：构图法则(三分法/对称/引导线等)、视觉焦点位置、空间层次、适合的应用场景。用JSON格式输出: {"composition":"","focalPoint":"","layers":"","useCase":""}',
                        all: '请全面分析这张图片，包括以下维度：\n1. 内容：主体、背景、细节\n2. 风格：艺术风格、质感、氛围\n3. 色彩：主色调、配色方案、明暗\n4. 构图：构图方式、视觉焦点\n5. 文字：图中所有文字内容\n6. 建议：如何用AI复现类似风格的英文prompt关键词\n用JSON格式输出完整分析结果。'
                    };
                    return await callOCRAPI(p.imageUrl, prompts[type] || prompts.all, 'gemini-2.0-flash');
                }
            });

            // TTS配音
            this.register('tts_generate', {
                name: 'TTS配音',
                description: 'AI文字转语音配音。参数: text(配音文本), engine(引擎: gemini/kling/dubbingx,默认gemini), voiceId(音色ID,可选), speed(语速0.5-2,默认1)',
                params: ['text', 'engine', 'voiceId', 'speed'],
                fn: async (p) => {
                    if (typeof callTTSAPI === 'function') {
                        return await callTTSAPI(p.text, {
                            engine: p.engine || 'gemini',
                            voiceId: p.voiceId || '',
                            speed: parseFloat(p.speed) || 1
                        });
                    }
                    throw new Error('callTTSAPI 不可用');
                }
            });

            // AI音乐生成
            this.register('music_generate', {
                name: 'AI音乐',
                description: 'Suno AI音乐生成。参数: prompt(歌词或描述), title(标题,可选), tags(风格标签如pop/rock,可选), model(chirp-v4/chirp-v5/chirp-auk,默认chirp-v4), instrumental(纯音乐true/false,默认false), description(灵感描述,可选-与prompt二选一)',
                params: ['prompt', 'title', 'tags', 'model', 'instrumental', 'description'],
                fn: async (p) => {
                    if (typeof callSunoMusicAPI === 'function') {
                        return await callSunoMusicAPI({
                            prompt: p.prompt || '',
                            description: p.description || '',
                            title: p.title || '',
                            tags: p.tags || '',
                            model: p.model || 'chirp-v4',
                            instrumental: p.instrumental === true || p.instrumental === 'true'
                        });
                    }
                    throw new Error('callSunoMusicAPI 不可用');
                }
            });

            // 保存
            this.register('save_image', {
                name: '保存图片',
                description: '保存图片到素材库。参数: url(图片URL), title(标题)',
                params: ['url', 'title'],
                fn: async (p) => {
                    if (typeof saveImageToLibrary === 'function') {
                        return saveImageToLibrary(p.url, p.title, 'agent-team');
                    }
                    return false;
                }
            });

            this.register('save_video', {
                name: '保存视频',
                description: '保存视频到素材库。参数: url(视频URL), title(标题)',
                params: ['url', 'title'],
                fn: async (p) => {
                    if (typeof saveVideoToLibrary === 'function') {
                        return saveVideoToLibrary(p.url, p.title, 'agent-team');
                    }
                    return false;
                }
            });

            this.register('save_character', {
                name: '保存角色',
                description: '保存角色到角色库。参数: name(角色名), summary(描述), posterUrl(图片URL)',
                params: ['name', 'summary', 'posterUrl'],
                fn: async (p) => {
                    if (typeof saveCharacterToLibrary === 'function') {
                        return saveCharacterToLibrary(p.name, p.summary, p.posterUrl);
                    }
                    return false;
                }
            });

            console.log(`🔧 [ToolRegistry] 已注册 ${this._tools.size} 个工具`);
        }
    };

    // ==================== 工具函数 ====================
    /** 带超时的 Promise 包装 */
    function withTimeout(promise, ms, label) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`${label || '操作'}超时(${Math.round(ms / 1000)}s)`)), ms);
            promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
        });
    }

    /** 带重试的函数调用 */
    async function withRetry(fn, maxRetries = 2, delayMs = 3000, label = '') {
        let lastErr;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn(attempt);
            } catch (e) {
                lastErr = e;
                console.warn(`⚠️ [Retry] ${label} 第${attempt}次失败: ${e.message}`);
                if (attempt < maxRetries) await new Promise(r => setTimeout(r, delayMs * attempt));
            }
        }
        throw lastErr;
    }

    /** 根据工具类型获取超时时间(ms) */
    function getToolTimeout(toolId) {
        if (!toolId) return 60000;
        if (toolId.startsWith('video_')) return 300000;  // 视频: 5分钟
        if (toolId === 'image_analyze') return 90000;    // 图片分析: 1.5分钟
        if (toolId.startsWith('image_')) return 120000;  // 图片: 2分钟
        if (toolId === 'ocr') return 60000;              // OCR: 1分钟
        if (toolId === 'tts_generate') return 120000;     // TTS: 2分钟
        if (toolId === 'music_generate') return 300000;    // 音乐: 5分钟
        if (toolId.startsWith('save_')) return 10000;    // 保存: 10秒
        return 60000; // 默认 1分钟
    }

    // ==================== Agent 智能体 ====================
    class Agent {
        constructor(config) {
            this.id = config.id;
            this.name = config.name;
            this.role = config.role || '';
            this.icon = config.icon || '🤖';
            this.systemPrompt = config.systemPrompt || '';
            this.tools = config.tools || [];
            this.memory = [];
            this.status = 'idle'; // idle | working | done | error
            this.currentTask = null;
            this.maxMemory = 20; // 保留最近20条记忆
        }

        /** 添加记忆 */
        addMemory(role, content) {
            this.memory.push({ role, content, time: Date.now() });
            if (this.memory.length > this.maxMemory) {
                this.memory = this.memory.slice(-this.maxMemory);
            }
        }

        /** LLM 推理 - 返回结构化决策 */
        async think(input, context) {
            this.status = 'working';
            this.currentTask = input.substring(0, 50) + '...';

            // 构建工具描述
            const toolDescs = ToolRegistry.describeTools(this.tools);
            const toolList = toolDescs.map(t =>
                `- ${t.id}: ${t.description}`
            ).join('\n');

            // 构建提示词
            const thinkPrompt = `${this.systemPrompt}

你可以使用以下工具:
${toolList}

${context ? `当前项目上下文:\n${context}\n` : ''}
请根据以下任务返回 JSON 决策。务必返回纯 JSON，不要包裹 markdown 代码块。

JSON 格式要求（只能选以下之一）:
1. 执行工具: {"action":"<tool_id>","params":{...},"reasoning":"为什么这样做"}
2. 返回多步计划: {"action":"plan","steps":[{"tool":"<tool_id>","params":{...},"description":"步骤描述"}],"reasoning":"整体思路"}
3. 委托其他Agent: {"action":"delegate","targetAgent":"<agent_id>","task":"任务描述","reasoning":"为什么委托"}
4. 纯文本输出: {"action":"text_output","content":"输出文本内容","reasoning":"思路"}
5. 完成任务: {"action":"done","result":{"summary":"总结","outputs":[]},"reasoning":"为什么完成"}

当前任务:
${input}`;

            this.addMemory('user', input);

            try {
                // 带重试的 LLM 调用（120s超时，复杂任务/参考图上下文需要更长时间）
                const response = await withRetry(async () => {
                    // 优先使用 callZhenzhenTextAPI (更稳定的JSON输出)
                    if (typeof callZhenzhenTextAPI === 'function') {
                        return await withTimeout(
                            callZhenzhenTextAPI(thinkPrompt, { model: 'gemini-3-pro-preview', temperature: 0.3, max_tokens: 4096 }),
                            120000, `${this.name} LLM推理`
                        );
                    } else if (typeof callWriterLLM === 'function') {
                        return await withTimeout(
                            callWriterLLM([
                                { role: 'system', content: this.systemPrompt },
                                { role: 'user', content: thinkPrompt }
                            ], { temperature: 0.3 }),
                            120000, `${this.name} LLM推理`
                        );
                    } else {
                        throw new Error('无可用的 LLM 服务');
                    }
                }, 2, 5000, `${this.name}推理`);

                this.addMemory('assistant', response);

                // 解析 JSON
                const decision = this._parseDecision(response);
                console.log(`🧠 [${this.name}] 决策:`, decision.action);
                return decision;

            } catch (err) {
                this.status = 'error';
                console.error(`❌ [${this.name}] 推理失败:`, err);
                throw err;
            }
        }

        /** 执行决策 */
        async executeDecision(decision) {
            this.status = 'working';

            try {
                if (decision.action === 'text_output') {
                    this.status = 'done';
                    return { type: 'text', content: decision.content };
                }

                if (decision.action === 'done') {
                    this.status = 'done';
                    return { type: 'done', result: decision.result };
                }

                if (decision.action === 'plan') {
                    return await this._executePlan(decision.steps);
                }

                if (decision.action === 'delegate') {
                    // 委托由 Team 层处理
                    return { type: 'delegate', targetAgent: decision.targetAgent, task: decision.task };
                }

                // 单个工具调用
                if (!this.tools.includes(decision.action)) {
                    throw new Error(`Agent [${this.name}] 没有权限使用工具: ${decision.action}`);
                }

                const timeout = getToolTimeout(decision.action);
                const result = await withTimeout(
                    ToolRegistry.execute(decision.action, decision.params || {}),
                    timeout, `工具 ${decision.action}`
                );
                this.status = 'done';
                return { type: 'tool_result', tool: decision.action, result };

            } catch (err) {
                this.status = 'error';
                throw err;
            }
        }

        /** 执行多步计划（带重试和超时） */
        async _executePlan(steps) {
            const results = [];
            // 安全限制: 最多 20 步
            const safeSteps = steps.slice(0, 20);

            for (let i = 0; i < safeSteps.length; i++) {
                const step = safeSteps[i];
                this.currentTask = step.description || `步骤 ${i + 1}/${safeSteps.length}`;

                if (!this.tools.includes(step.tool)) {
                    results.push({ step: i + 1, error: `无权限: ${step.tool}`, status: 'skipped' });
                    continue;
                }

                try {
                    // 将前序结果注入参数（支持链式引用）
                    const params = this._resolveParams(step.params, results);
                    const timeout = getToolTimeout(step.tool);

                    // 带重试 + 超时的工具调用
                    const result = await withRetry(async () => {
                        return await withTimeout(
                            ToolRegistry.execute(step.tool, params),
                            timeout, `${step.tool}`
                        );
                    }, 2, 3000, `${this.name} 步骤${i + 1}`);

                    results.push({ step: i + 1, tool: step.tool, result, status: 'success', description: step.description });
                } catch (err) {
                    results.push({ step: i + 1, tool: step.tool, error: err.message, status: 'failed' });
                    console.warn(`⚠️ [${this.name}] 步骤${i + 1}最终失败:`, err.message);
                }
            }

            this.status = 'done';
            return { type: 'plan_result', results };
        }

        /** 解析参数中的引用（如 $step1.result） */
        _resolveParams(params, previousResults) {
            if (!params || typeof params !== 'object') return params;
            const resolved = { ...params };
            for (const [key, value] of Object.entries(resolved)) {
                if (typeof value === 'string' && value.startsWith('$step')) {
                    const match = value.match(/^\$step(\d+)\.(\w+)$/);
                    if (match) {
                        const stepIdx = parseInt(match[1]) - 1;
                        const field = match[2];
                        if (previousResults[stepIdx] && previousResults[stepIdx].status === 'success') {
                            resolved[key] = previousResults[stepIdx].result;
                        }
                    }
                }
            }
            return resolved;
        }

        /** 解析 LLM 响应为 JSON 决策 */
        _parseDecision(text) {
            if (!text || typeof text !== 'string') {
                return { action: 'text_output', content: String(text || ''), reasoning: '无法解析' };
            }

            // 尝试直接解析
            try {
                const parsed = JSON.parse(text.trim());
                if (parsed.action) return parsed;
            } catch (e) { /* continue */ }

            // 尝试从 markdown 代码块提取
            const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[1].trim());
                    if (parsed.action) return parsed;
                } catch (e) { /* continue */ }
            }

            // 尝试找到第一个 { 和最后一个 }
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                try {
                    const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
                    if (parsed.action) return parsed;
                } catch (e) { /* continue */ }
            }

            // 兜底：作为纯文本输出
            return { action: 'text_output', content: text, reasoning: 'LLM未返回有效JSON，作为文本输出' };
        }

        /** 重置状态 */
        reset() {
            this.status = 'idle';
            this.currentTask = null;
            this.memory = [];
        }

        toJSON() {
            return {
                id: this.id, name: this.name, role: this.role, icon: this.icon,
                status: this.status, currentTask: this.currentTask,
                tools: this.tools
            };
        }
    }

    // ==================== AgentTeam 团队 ====================
    class AgentTeam {
        constructor(config) {
            this.id = config.id || `team_${Date.now()}`;
            this.name = config.name || '智能团队';
            this.icon = config.icon || '🤖';
            this.description = config.description || '';
            this.agents = new Map();
            this.coordinator = null;
            this.messageLog = [];
            this.deliverables = []; // 最终交付物
            this.status = 'idle'; // idle | running | completed | error | cancelled
            this._listeners = [];
            this._cancelled = false;

            // 📋 共享上下文板：多专家间共享信息
            this.sharedBoard = {
                referenceImages: [],   // 参考图 [{url, analysis, uploadTime}]
                styleGuide: null,      // 风格指南（由分析生成）
                keyDecisions: [],      // 关键决策记录
                intermediateResults: new Map() // 中间产出 {agentId -> [{type, data, step}]}
            };
        }

        /** 📷 添加参考图（用户上传，自动OCR+风格分析） */
        async addReferenceImage(imageUrl, label) {
            const ref = { url: imageUrl, label: label || '', analysis: null, uploadTime: Date.now() };

            // 自动分析参考图（带超时保护，避免阻塞）
            try {
                if (ToolRegistry.get('image_analyze')) {
                    const analysis = await withTimeout(
                        ToolRegistry.execute('image_analyze', { imageUrl, analysisType: 'all' }),
                        90000, '参考图分析'
                    );
                    ref.analysis = analysis;
                    console.log(`📷 [参考图] 分析完成: ${label || imageUrl.substring(0, 40)}`);
                }
            } catch (e) {
                console.warn(`📷 [参考图] 分析失败(将跳过分析继续执行):`, e.message);
            }

            this.sharedBoard.referenceImages.push(ref);
            this._emit('referenceImageAdded', ref);
            return ref;
        }

        /** 获取参考图上下文文本（供注入Agent prompt） */
        _getReferenceContext() {
            const refs = this.sharedBoard.referenceImages;
            if (refs.length === 0) return '';
            const parts = ['📷 用户提供的参考图:'];
            refs.forEach((ref, i) => {
                parts.push(`参考图${i + 1}${ref.label ? '(' + ref.label + ')' : ''}: ${ref.url.substring(0, 80)}`);
                if (ref.analysis) {
                    const a = typeof ref.analysis === 'string' ? ref.analysis.substring(0, 500) : JSON.stringify(ref.analysis).substring(0, 500);
                    parts.push(`  分析: ${a}`);
                }
            });
            return parts.join('\n');
        }

        /** 添加 Agent */
        addAgent(agentConfig) {
            const agent = (agentConfig instanceof Agent) ? agentConfig : new Agent(agentConfig);
            this.agents.set(agent.id, agent);
            if (agent.role === 'coordinator') {
                this.coordinator = agent;
            }
            return agent;
        }

        /** 获取 Agent */
        getAgent(id) {
            return this.agents.get(id);
        }

        /** 获取所有 Agent 状态 */
        getAgentStates() {
            return Array.from(this.agents.values()).map(a => a.toJSON());
        }

        /** 添加消息到日志 */
        _log(agentId, type, content, data) {
            const entry = {
                id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                agentId,
                agentName: this.agents.get(agentId)?.name || agentId,
                agentIcon: this.agents.get(agentId)?.icon || '🤖',
                type, // 'thinking' | 'tool_call' | 'result' | 'delegate' | 'error' | 'info'
                content,
                data,
                time: Date.now()
            };
            this.messageLog.push(entry);
            this._emit('message', entry);
            return entry;
        }

        /** 执行团队任务 */
        async run(userGoal, options = {}) {
            if (this.status === 'running') {
                throw new Error('团队正在执行中，请等待完成或取消');
            }

            if (!this.coordinator) {
                throw new Error('团队缺少 Coordinator');
            }

            this.status = 'running';
            this._cancelled = false;
            this.messageLog = [];
            this.deliverables = [];
            this._startTime = Date.now();
            this._maxDuration = 30 * 60 * 1000; // 30分钟总时限

            // 重置所有 Agent
            for (const agent of this.agents.values()) {
                agent.reset();
            }

            this._emit('started', { goal: userGoal });
            this._log(this.coordinator.id, 'info', `📋 收到任务: ${userGoal}`);

            try {
                // 1. Coordinator 分析任务
                this._log(this.coordinator.id, 'thinking', '正在分析任务并制定计划...');
                this._emit('agentUpdate', this.getAgentStates());

                const agentList = Array.from(this.agents.values())
                    .filter(a => a.role !== 'coordinator')
                    .map(a => `- ${a.id} (${a.name}): ${a.role}, 工具: [${a.tools.join(',')}]`)
                    .join('\n');

                // 📷 注入参考图上下文
                const refContext = this._getReferenceContext();

                const planInput = `用户目标: ${userGoal}
${refContext ? '\n' + refContext + '\n' : ''}
可用的团队成员:
${agentList}

请为这个项目制定详细的分工计划。返回 JSON:
{"action":"plan","steps":[{"agent":"<agent_id>","task":"具体任务描述","dependsOn":[]},...],"reasoning":"整体思路"}

规则：
- 每个步骤必须指定 agent（从上面列表选择）和具体 task
- 如果步骤之间有依赖，用 dependsOn 指定依赖的步骤索引（0-based）
- 没有依赖的步骤会自动并行执行（重要！尽量让独立任务并行）
- 如果有参考图，视觉类任务必须在task描述中包含参考图URL和分析结果
- 同一个 Agent 可以被分配多个步骤（不同子任务）
- 步骤数量控制在 3-12 步以内`;

                let plan = await this.coordinator.think(planInput);
                if (this._cancelled) throw new Error('任务已取消');

                // 🔄 如果 coordinator 返回 text_output 而非 plan，重新提示一次
                if (plan.action === 'text_output' && !plan.steps) {
                    this._log(this.coordinator.id, 'info', '重新请求制定结构化计划...');
                    const retryInput = `你刚才返回了文本而不是JSON计划。请严格按以下格式返回纯JSON：
{"action":"plan","steps":[{"agent":"agent_id","task":"任务描述","dependsOn":[]}],"reasoning":"思路"}

可用成员:
${agentList}

用户目标: ${userGoal}`;
                    plan = await this.coordinator.think(retryInput);
                }

                if (this._cancelled) throw new Error('任务已取消');

                this._log(this.coordinator.id, 'result', `制定了 ${plan.steps?.length || 0} 步计划`, plan);
                this._emit('planReady', plan);

                // 2. 执行计划
                if (plan.action === 'plan' && plan.steps) {
                    // 安全限制: 最多 15 步
                    const safeSteps = plan.steps.slice(0, 15);
                    if (plan.steps.length > 15) {
                        this._log(this.coordinator.id, 'info', `⚠️ 计划有 ${plan.steps.length} 步，截取前15步执行`);
                    }
                    await this._executePlan(safeSteps, userGoal);
                } else if (plan.action === 'text_output') {
                    this.deliverables.push({ type: 'text', content: plan.content, agent: this.coordinator.name });
                } else {
                    // Coordinator 直接执行
                    const result = await this.coordinator.executeDecision(plan);
                    this._processResult(this.coordinator, result);
                }

                if (this._cancelled) throw new Error('任务已取消');

                // 3. 汇总结果
                this.status = 'completed';
                const elapsed = Math.round((Date.now() - this._startTime) / 1000);
                this._log(this.coordinator.id, 'info', `✅ 任务完成！共产出 ${this.deliverables.length} 项交付物，耗时 ${elapsed}s`);
                this._emit('completed', { deliverables: this.deliverables, messageLog: this.messageLog });

                return { deliverables: this.deliverables, messageLog: this.messageLog };

            } catch (err) {
                this.status = this._cancelled ? 'cancelled' : 'error';
                this._log(this.coordinator.id, 'error', `❌ ${err.message}`);
                this._emit('error', { error: err.message });
                throw err;
            }
        }

        /** 执行分工计划（支持并行执行 + 智能调度） */
        async _executePlan(steps, userGoal) {
            const stepResults = new Array(steps.length).fill(null);
            const completed = new Set();
            let consecutiveErrors = 0;

            // 🚀 分析并行分组：把步骤按依赖关系分为波次（wave）
            const waves = this._buildExecutionWaves(steps);
            this._log(this.coordinator.id, 'info', `🚀 执行计划: ${waves.length} 波次, 其中 ${waves.filter(w => w.length > 1).length} 波并行`);

            for (const wave of waves) {
                if (this._cancelled) break;

                // 总时限检查
                if (Date.now() - this._startTime > this._maxDuration) {
                    this._log(this.coordinator.id, 'error', `⏰ 已超过总时限(30分钟)，终止后续步骤`);
                    break;
                }

                if (consecutiveErrors >= 3) {
                    this._log(this.coordinator.id, 'error', `⚠️ 连续 ${consecutiveErrors} 步失败，终止执行`);
                    break;
                }

                // 🚀 同一波次内的步骤并行执行
                if (wave.length > 1) {
                    this._log(this.coordinator.id, 'info', `⚡ 并行执行 ${wave.length} 个任务: ${wave.map(i => `步骤${i+1}`).join(', ')}`);
                }

                const wavePromises = wave.map(i => this._executeStep(i, steps[i], steps, stepResults, completed, userGoal));
                const waveResults = await Promise.allSettled(wavePromises);

                // 统计结果
                let waveErrors = 0;
                for (let w = 0; w < wave.length; w++) {
                    const i = wave[w];
                    const wr = waveResults[w];
                    if (wr.status === 'fulfilled' && wr.value) {
                        stepResults[i] = wr.value;
                        completed.add(i);
                        consecutiveErrors = 0;
                        this._emit('stepCompleted', { step: i, agent: steps[i].agent, result: wr.value });
                    } else {
                        const errMsg = wr.status === 'rejected' ? wr.reason?.message : '未知错误';
                        stepResults[i] = { error: errMsg };
                        waveErrors++;
                        this._log(steps[i].agent || 'system', 'error', `步骤 ${i+1} 失败: ${errMsg}`);
                    }
                }
                if (waveErrors === wave.length) consecutiveErrors += waveErrors;
            }
        }

        /** 将步骤按依赖关系分成波次（无依赖的同一波并行） */
        _buildExecutionWaves(steps) {
            const waves = [];
            const scheduled = new Set();
            let safety = 0;

            while (scheduled.size < steps.length && safety++ < 50) {
                const wave = [];
                for (let i = 0; i < steps.length; i++) {
                    if (scheduled.has(i)) continue;
                    const deps = steps[i].dependsOn || [];
                    if (deps.every(d => scheduled.has(d))) {
                        wave.push(i);
                    }
                }
                if (wave.length === 0) break; // 无法继续（循环依赖）
                wave.forEach(i => scheduled.add(i));
                waves.push(wave);
            }
            return waves;
        }

        /** 执行单个步骤（含重试、上下文注入、共享板写入） */
        async _executeStep(i, step, allSteps, stepResults, completed, userGoal) {
            const agentId = step.agent;
            const agent = this.agents.get(agentId);

            if (!agent) {
                this._log('system', 'error', `Agent 不存在: ${agentId}`);
                throw new Error(`Agent 不存在: ${agentId}`);
            }

            // 构建上下文（包含前序结果 + 参考图 + 共享板）
            const context = this._buildStepContext(stepResults, completed, userGoal);

            this._log(agent.id, 'thinking', `正在处理(${i + 1}/${allSteps.length}): ${step.task}`);
            this._emit('agentUpdate', this.getAgentStates());

            // 带重试的步骤执行
            const stepResult = await withRetry(async (attempt) => {
                if (attempt > 1) {
                    this._log(agent.id, 'info', `🔄 重试第 ${attempt} 次...`);
                }

                // Agent 思考
                const decision = await agent.think(step.task, context);
                if (this._cancelled) throw new Error('任务已取消');

                this._log(agent.id, 'tool_call', `决策: ${decision.action}`, decision);

                // 处理委托
                if (decision.action === 'delegate') {
                    const targetAgent = this.agents.get(decision.targetAgent);
                    if (targetAgent) {
                        this._log(agent.id, 'delegate', `委托给 ${targetAgent.name}: ${decision.task}`);
                        const delegateDecision = await targetAgent.think(decision.task, context);
                        const delegateResult = await targetAgent.executeDecision(delegateDecision);
                        this._processResult(targetAgent, delegateResult);
                        return delegateResult;
                    } else {
                        throw new Error(`委托目标不存在: ${decision.targetAgent}`);
                    }
                } else {
                    // 执行决策
                    const result = await agent.executeDecision(decision);
                    this._processResult(agent, result);
                    return result;
                }
            }, 2, 5000, `步骤${i + 1}`);

            // 📋 写入共享板（供后续步骤引用）
            if (!this.sharedBoard.intermediateResults.has(agentId)) {
                this.sharedBoard.intermediateResults.set(agentId, []);
            }
            this.sharedBoard.intermediateResults.get(agentId).push({
                step: i, type: stepResult?.type || 'unknown', data: stepResult, time: Date.now()
            });

            this._log(agent.id, 'result', `✅ 步骤 ${i + 1} 完成`);
            this._emit('agentUpdate', this.getAgentStates());
            return stepResult;
        }

        /** 构建步骤上下文（前序结果 + 参考图 + 共享板） */
        _buildStepContext(stepResults, completed, userGoal) {
            const parts = [`项目目标: ${userGoal}`];

            // 📷 注入参考图上下文
            const refCtx = this._getReferenceContext();
            if (refCtx) parts.push(refCtx);

            // 📋 注入共享板关键决策
            if (this.sharedBoard.styleGuide) {
                parts.push(`🎨 风格指南: ${this.sharedBoard.styleGuide}`);
            }
            if (this.sharedBoard.keyDecisions.length > 0) {
                parts.push(`📌 关键决策: ${this.sharedBoard.keyDecisions.slice(-5).join('; ')}`);
            }

            // 已完成步骤结果摘要
            for (const idx of completed) {
                const r = stepResults[idx];
                if (r && !r.error) {
                    let summary = '';
                    if (r.type === 'text') summary = `文本: ${String(r.content).substring(0, 200)}`;
                    else if (r.type === 'tool_result') summary = `工具结果: ${typeof r.result === 'string' ? r.result.substring(0, 200) : JSON.stringify(r.result).substring(0, 200)}`;
                    else if (r.type === 'plan_result') summary = `计划执行: ${r.results?.filter(s => s.status === 'success').length || 0} 步成功`;
                    else if (r.type === 'done') summary = `完成: ${r.result?.summary || ''}`;
                    if (summary) parts.push(`[已完成步骤${idx + 1}] ${summary}`);
                }
            }

            // 共享板中间产出摘要（其他Agent的产出）
            if (this.sharedBoard.intermediateResults.size > 0) {
                const shared = [];
                for (const [agentId, results] of this.sharedBoard.intermediateResults) {
                    const latest = results[results.length - 1];
                    if (latest && latest.data) {
                        const d = latest.data;
                        let s = '';
                        if (d.type === 'tool_result' && typeof d.result === 'string') s = d.result.substring(0, 100);
                        else if (d.type === 'text') s = String(d.content).substring(0, 100);
                        if (s) shared.push(`${agentId}: ${s}`);
                    }
                }
                if (shared.length > 0) parts.push(`🤝 团队共享:\n${shared.join('\n')}`);
            }

            return parts.join('\n');
        }

        /** 判断URL的媒体类型 */
        _detectMediaType(url) {
            if (!url || typeof url !== 'string') return 'text';
            const lower = url.toLowerCase();
            // data: URI 直接根据 MIME 判断
            if (lower.startsWith('data:audio/')) return 'audio';
            if (lower.startsWith('data:video/')) return 'video';
            if (lower.startsWith('data:image/')) return 'image';
            // 音频检测
            if (lower.includes('.mp3') || lower.includes('.wav') || lower.includes('.ogg') ||
                lower.includes('.aac') || lower.includes('.flac') || lower.includes('.m4a') ||
                lower.includes('/audio/') || lower.includes('audio_url')) return 'audio';
            // 视频检测
            if (lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mov') ||
                lower.includes('/video/') || lower.includes('video_url')) return 'video';
            // 默认 http URL 为图片
            if (lower.startsWith('http')) return 'image';
            return 'text';
        }

        /** 处理结果，提取交付物 */
        _processResult(agent, result) {
            if (!result) return;

            if (result.type === 'text') {
                this.deliverables.push({ type: 'text', content: result.content, agent: agent.name, icon: agent.icon });
            }

            if (result.type === 'tool_result' && result.result) {
                const r = result.result;
                
                // 🎵 Suno 音乐对象: {taskId, music: [{audio_url, title, ...}]}
                if (r && typeof r === 'object' && !Array.isArray(r) && r.music && Array.isArray(r.music)) {
                    for (const track of r.music) {
                        if (track.audio_url) {
                            this.deliverables.push({
                                type: 'audio',
                                url: track.audio_url,
                                title: track.title || '生成音乐',
                                imageUrl: track.image_url || '',
                                videoUrl: track.video_url || '',
                                duration: track.duration || 0,
                                tags: track.tags || '',
                                agent: agent.name,
                                icon: agent.icon,
                                tool: result.tool
                            });
                        }
                    }
                    return;
                }
                
                // URL字符串结果
                if (typeof r === 'string' && (r.startsWith('http') || r.startsWith('data:'))) {
                    const mediaType = this._detectMediaType(r);
                    this.deliverables.push({ type: mediaType, url: r, agent: agent.name, icon: agent.icon, tool: result.tool });
                }
                // 其他文本
                else if (typeof r === 'string' && r.length > 0) {
                    this.deliverables.push({ type: 'text', content: r, agent: agent.name, icon: agent.icon });
                }
                // 其他对象结果（非音乐），尝试提取URL
                else if (r && typeof r === 'object') {
                    const url = r.url || r.audioUrl || r.audio_url || r.imageUrl || r.videoUrl || '';
                    if (url && typeof url === 'string' && url.startsWith('http')) {
                        const mediaType = this._detectMediaType(url);
                        this.deliverables.push({ type: mediaType, url, agent: agent.name, icon: agent.icon, tool: result.tool });
                    } else {
                        const text = r.content || r.text || r.summary || JSON.stringify(r).substring(0, 500);
                        if (text) this.deliverables.push({ type: 'text', content: text, agent: agent.name, icon: agent.icon });
                    }
                }
            }

            if (result.type === 'plan_result' && result.results) {
                for (const step of result.results) {
                    if (step.status === 'success' && step.result) {
                        const r = step.result;
                        // 🎵 音乐对象
                        if (r && typeof r === 'object' && !Array.isArray(r) && r.music && Array.isArray(r.music)) {
                            for (const track of r.music) {
                                if (track.audio_url) {
                                    this.deliverables.push({
                                        type: 'audio',
                                        url: track.audio_url,
                                        title: track.title || '生成音乐',
                                        imageUrl: track.image_url || '',
                                        videoUrl: track.video_url || '',
                                        duration: track.duration || 0,
                                        tags: track.tags || '',
                                        agent: agent.name,
                                        icon: agent.icon,
                                        description: step.description
                                    });
                                }
                            }
                        }
                        else if (typeof r === 'string' && (r.startsWith('http') || r.startsWith('data:'))) {
                            const mediaType = this._detectMediaType(r);
                            this.deliverables.push({
                                type: mediaType,
                                url: r,
                                agent: agent.name,
                                icon: agent.icon,
                                description: step.description
                            });
                        } else if (typeof r === 'string' && r.length > 10) {
                            this.deliverables.push({ type: 'text', content: r, agent: agent.name, icon: agent.icon });
                        }
                    }
                }
            }

            if (result.type === 'done' && result.result) {
                if (result.result.summary) {
                    this.deliverables.push({ type: 'summary', content: result.result.summary, agent: agent.name, icon: agent.icon });
                }
            }
        }

        /** 取消执行 */
        cancel() {
            this._cancelled = true;
            this.status = 'cancelled';
            for (const agent of this.agents.values()) {
                agent.status = 'idle';
            }
            this._emit('cancelled', {});
        }

        // ==================== 事件系统 ====================
        on(event, callback) {
            this._listeners.push({ event, callback });
        }

        off(event, callback) {
            this._listeners = this._listeners.filter(l => !(l.event === event && l.callback === callback));
        }

        _emit(event, data) {
            for (const l of this._listeners) {
                if (l.event === event) {
                    try { l.callback(data); } catch (e) { console.error('[AgentTeam] 事件回调错误:', e); }
                }
            }
        }
    }

    // ==================== 团队工厂 ====================
    const AgentTeamFactory = {
        _templates: new Map(),
        _roleConfigs: new Map(),

        /** 注册角色配置 */
        registerRole(id, config) {
            this._roleConfigs.set(id, config);
        },

        /** 注册团队模板 */
        registerTemplate(id, template) {
            this._templates.set(id, template);
        },

        /** 获取所有模板 */
        getTemplates() {
            return Array.from(this._templates.values());
        },

        /** 根据模板创建团队 */
        createFromTemplate(templateId) {
            const template = this._templates.get(templateId);
            if (!template) throw new Error(`团队模板不存在: ${templateId}`);

            const team = new AgentTeam({
                id: `team_${templateId}_${Date.now()}`,
                name: template.name,
                icon: template.icon,
                description: template.description
            });

            for (const roleId of template.roles) {
                const roleConfig = this._roleConfigs.get(roleId);
                if (roleConfig) {
                    team.addAgent(new Agent({ ...roleConfig }));
                } else {
                    console.warn(`[AgentTeamFactory] 角色不存在: ${roleId}`);
                }
            }

            return team;
        },

        /** 自由组队 */
        createCustomTeam(name, roleIds) {
            const team = new AgentTeam({ name, icon: '🎯' });

            // 必须包含 coordinator
            if (!roleIds.includes('coordinator')) {
                roleIds.unshift('coordinator');
            }

            for (const roleId of roleIds) {
                const roleConfig = this._roleConfigs.get(roleId);
                if (roleConfig) {
                    team.addAgent(new Agent({ ...roleConfig }));
                }
            }

            return team;
        },

        /** 创建并注册自定义角色 */
        createCustomRole({ name, icon, systemPrompt, tools }) {
            // 只允许使用已注册的工具
            const validTools = tools.filter(t => ToolRegistry._tools.has(t));
            if (validTools.length === 0) {
                throw new Error('至少选择一个有效工具');
            }
            const id = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            const config = {
                id,
                name,
                role: id,
                icon: icon || '🧩',
                tools: validTools,
                isCustom: true,
                systemPrompt: systemPrompt + '\n你必须返回纯 JSON 格式。不要输出 markdown 代码块。\n中文回复（图片/视频prompt用英文）。'
            };
            this.registerRole(id, config);
            return config;
        },

        /** 获取所有角色（含自定义） */
        getAllRoles() {
            return Array.from(this._roleConfigs.entries())
                .filter(([id]) => id !== 'coordinator')
                .map(([id, cfg]) => ({ id, ...cfg }));
        },

        /** 获取所有自定义角色 */
        getCustomRoles() {
            return this.getAllRoles().filter(r => r.isCustom);
        },

        /** 从 localStorage 恢复自定义角色 */
        loadCustomRoles() {
            try {
                const saved = localStorage.getItem('agent_custom_roles');
                if (!saved) return;
                const roles = JSON.parse(saved);
                for (const r of roles) {
                    if (r.id && r.name && r.systemPrompt) {
                        this._roleConfigs.set(r.id, r);
                    }
                }
                console.log(`🧩 [AgentTeamFactory] 已恢复 ${roles.length} 个自定义角色`);
            } catch (e) {
                console.warn('[AgentTeamFactory] 恢复自定义角色失败:', e);
            }
        },

        /** 保存自定义角色到 localStorage */
        saveCustomRoles() {
            const customs = this.getCustomRoles();
            localStorage.setItem('agent_custom_roles', JSON.stringify(customs));
        },

        /** 删除自定义角色 */
        deleteCustomRole(roleId) {
            if (!roleId.startsWith('custom_')) return false;
            this._roleConfigs.delete(roleId);
            this.saveCustomRoles();
            return true;
        }
    };

    // ==================== 导出 ====================
    global.ToolRegistry = ToolRegistry;
    global.Agent = Agent;
    global.AgentTeam = AgentTeam;
    global.AgentTeamFactory = AgentTeamFactory;

    // 初始化工具注册表
    ToolRegistry.init();

    // 恢复自定义角色
    AgentTeamFactory.loadCustomRoles();

    console.log('🤖 [AgentTeam] 核心引擎已加载');

})(typeof window !== 'undefined' ? window : this);
