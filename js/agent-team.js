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

        // DubbingX 音色缓存 { male: [{voiceId,name,...}], female: [...], fetched: false }
        _dubbingxVoiceCache: { male: [], female: [], fetched: false },

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

        /** 预加载 DubbingX 音色列表（init 时异步调用） */
        async _fetchDubbingXVoices() {
            try {
                // 并发拉取男声和女声
                const [resM, resF] = await Promise.all([
                    fetch('/api/yunwu', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'tts-voices', gender: 1, pageSize: 50, grade: 'premium' })
                    }),
                    fetch('/api/yunwu', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'tts-voices', gender: 0, pageSize: 50, grade: 'premium' })
                    })
                ]);
                const [dataM, dataF] = await Promise.all([resM.json().catch(() => ({})), resF.json().catch(() => ({}))]);
                if (dataM.success && dataM.voices?.length) this._dubbingxVoiceCache.male = dataM.voices;
                if (dataF.success && dataF.voices?.length) this._dubbingxVoiceCache.female = dataF.voices;
                this._dubbingxVoiceCache.fetched = true;
                console.log(`🎤 [ToolRegistry] DubbingX音色预加载: 男声${this._dubbingxVoiceCache.male.length}个, 女声${this._dubbingxVoiceCache.female.length}个`);
            } catch (e) {
                console.warn('[ToolRegistry] DubbingX音色预加载失败:', e.message);
                this._dubbingxVoiceCache.fetched = true; // 标记已尝试，避免重复
            }
        },

        /** 根据 roleHint 从缓存智能选取 DubbingX voiceId，返回 null 表示缓存为空 */
        _pickDubbingXVoice(roleHint) {
            const hint = (roleHint || '').toLowerCase();
            const isFemale = /女|母|姐|妹|娘|公主|少女|她|girl|female/.test(hint);
            const pool = isFemale ? this._dubbingxVoiceCache.female : this._dubbingxVoiceCache.male;
            if (!pool.length) return null;
            // 随机选（前5个高质量音色中随机）
            const pick = pool[Math.floor(Math.random() * Math.min(pool.length, 5))];
            return pick?.voiceId || null;
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
            // 检查必需的全局函数
            const requiredFunctions = [
                'callScriptGenerator', 'callWriterLLM', 'callBanana2ImageAPI',
                'callModelScopeImageAPI', 'callMidjourneyImageAPI', 'callSora2TextToVideoAPI',
                'callSora2ImageToVideoAPI', 'callOCRAPI', 'callTTSAPI', 'callSunoMusicAPI'
            ];
            const missing = requiredFunctions.filter(fn => typeof window[fn] !== 'function');
            if (missing.length > 0) {
                console.warn(`[ToolRegistry] 缺少依赖函数: ${missing.join(', ')}`);
            }

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
                name: 'Banana2图片(Gemini3)',
                description: '高质量图片生成（快速,免费）。支持多参考图融合。参数: prompt(英文提示词), aspectRatio(比例,默认16:9), refImage(单张参考图URL,可选), refImages(多张参考图URL数组,可选)',
                params: ['prompt', 'aspectRatio', 'refImage', 'refImages'],
                fn: async (p) => {
                    if (typeof callBanana2ImageAPI === 'function') {
                        return await callBanana2ImageAPI(p.prompt, {
                            aspectRatio: p.aspectRatio || '16:9',
                            refImage: p.refImage,
                            refImages: p.refImages
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

            this.register('image_seedream', {
                name: '星梦画师(Seedream)',
                description: '星梦画师，豆包旗下高质量图片模型，特别擅长多参考图融合、IP角色设计、风格迁移。参数: prompt(英文提示词), aspectRatio(比例,默认16:9), refImage(单张参考图URL,可选), refImages(多张参考图URL数组,可选)',
                params: ['prompt', 'aspectRatio', 'refImage', 'refImages'],
                fn: async (p) => {
                    if (typeof callBanana2ImageAPI === 'function') {
                        return await callBanana2ImageAPI(p.prompt, {
                            model: 'doubao-seedream-4-5-251128',
                            aspectRatio: p.aspectRatio || '16:9',
                            refImage: p.refImage,
                            refImages: p.refImages
                        });
                    }
                    throw new Error('callBanana2ImageAPI 不可用');
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
            // 💰 允许使用的视频模型白名单，kling/hailuo/vidu/sora/modelscope-video不可用
            const ALLOWED_VIDEO_MODELS = [
                'grok-video-3', 'grok-video-3-10s', 'grok-video-3-15s',
                'veo3.1', 'veo3.1-4K', 'veo3',
                'wan26-720p-5s-audio', 'wan26-720p-10s-audio', 'wan26-720p-15s-audio',
                'wan26-1080p-5s-audio', 'wan26-1080p-10s-audio', 'wan26-1080p-15s-audio',
                'wan26-720p-5s', 'wan26-720p-10s', 'wan26-720p-15s',
                'wan26-1080p-5s', 'wan26-1080p-10s', 'wan26-1080p-15s'
            ];
            const _pickVideoModel = (requested, hint = {}) => {
                if (requested && ALLOWED_VIDEO_MODELS.includes(requested)) return requested;
                // 优先用全局智能选择函数（由 skill-presets.js 暴露）
                if (typeof window._selectVideoModel === 'function') {
                    return window._selectVideoModel({ preferred: requested, ...hint });
                }
                // 兜底：内容感知智能选择（与 batch.js __smartSelectVideoModel 一致）
                const topic = String(hint.topic || '').toLowerCase();
                const needVoice = /配音|对话|旁白|语音|说话|台词|独白|voice|narrat|dialogue|speak|dub/.test(topic);
                if (needVoice) return 'veo3.1';
                const needHighQuality = /电影|大片|史诗|4k|高质量|cinematic|epic|震撼|广告片|宣传片/.test(topic);
                if (needHighQuality) return 'veo3.1';
                const needMusic = /音乐|歌曲|音效|配乐|bgm|music|singing/.test(topic);
                if (needMusic) return 'wan26-720p-5s-audio';
                const needAudio = /有声|audio|声音/.test(topic);
                if (needAudio) return 'veo3.1';
                const dur = parseInt(hint.duration) || 0;
                if (dur > 10) return 'grok-video-3-15s';
                if (dur > 5) return 'grok-video-3-10s';
                return 'grok-video-3-10s';
            };

            this.register('video_text', {
                name: '文生视频',
                description: '文字描述生成视频。参数: prompt(英文提示词), model(优先选有声: grok-video-3=6s有声/grok-video-3-10s=10s有声/grok-video-3-15s=15s有声/wan26-720p-5s-audio=5s有声/wan26-720p-10s-audio=10s有声/wan26-720p-15s-audio=15s有声/wan26-1080p-5s-audio=5s有声高清/wan26-1080p-10s-audio=10s有声高清/wan26-1080p-15s-audio=15s有声高清/wan26-720p-5s=5s无声/veo3.1=高质量有声/veo3.1-4K=超清暂不稳定,默认grok-video-3,kling/hailuo/vidu/sora/modelscope-video均不可用), aspectRatio(比例,默认16:9)',
                params: ['prompt', 'model', 'aspectRatio'],
                fn: async (p) => {
                    if (typeof callSora2TextToVideoAPI === 'function') {
                        return await callSora2TextToVideoAPI(p.prompt, {
                            model: _pickVideoModel(p.model, { topic: p.prompt, duration: p.duration }),
                            aspectRatio: p.aspectRatio || '16:9'
                        });
                    }
                    throw new Error('callSora2TextToVideoAPI 不可用');
                }
            });

            this.register('video_image', {
                name: '图生视频',
                description: '图片动态化生成视频。参数: imageUrl(图片URL), prompt(英文动作描述), model(优先选有声: grok-video-3=6s有声/grok-video-3-10s=10s有声/grok-video-3-15s=15s有声/wan26-720p-5s-audio=5s有声/wan26-720p-10s-audio=10s有声/wan26-720p-15s-audio=15s有声/wan26-1080p-5s-audio=5s有声高清/wan26-1080p-10s-audio=10s有声高清/wan26-1080p-15s-audio=15s有声高清/wan26-720p-5s=5s无声/veo3.1=高质量有声/veo3.1-4K=超清暂不稳定,默认grok-video-3,kling/hailuo/vidu/sora/modelscope-video均不可用), aspectRatio(比例,默认16:9)',
                params: ['imageUrl', 'prompt', 'model', 'aspectRatio'],
                fn: async (p) => {
                    if (typeof callSora2ImageToVideoAPI === 'function') {
                        return await callSora2ImageToVideoAPI(p.imageUrl, p.prompt, {
                            model: _pickVideoModel(p.model, { topic: p.prompt, duration: p.duration }),
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
                    return await callOCRAPI(p.imageUrl, prompts[type] || prompts.all, 'gemini-3.1-flash-preview');
                }
            });

            // TTS配音
            this.register('tts_generate', {
                name: 'TTS配音',
                description: 'AI文字转语音配音。参数: text(配音文本), engine(引擎: dubbingx/kling/gemini,默认dubbingx), voiceId(音色ID,dubbingx需要用户指定或不填自动处理;已知kling男声:genshin_vindi2或diyinnansang_DB_CN_M_04-v2,女声:ai_shatang), speed(语速0.5-2,默认1), roleHint(角色描述如"旁白""年轻女性""成熟男性"，用于智能匹配音色)',
                params: ['text', 'engine', 'voiceId', 'speed', 'roleHint'],
                fn: async (p) => {
                    if (typeof callTTSAPI === 'function') {
                        let engine = p.engine || 'dubbingx';
                        let voiceId = p.voiceId || '';
                        // dubbingx 无 voiceId 时：优先从缓存智能选，缓存空才降级 Kling
                        if (engine === 'dubbingx' && !voiceId) {
                            const cached = ToolRegistry._pickDubbingXVoice(p.roleHint || '');
                            if (cached) {
                                voiceId = cached; // 使用 DubbingX 真实音色
                            } else {
                                engine = 'kling';
                                const hint = (p.roleHint || '').toLowerCase();
                                const isFemale = /女|母|姐|妹|娘|公主|少女|她/.test(hint);
                                voiceId = isFemale ? 'ai_shatang' : 'genshin_vindi2';
                            }
                        }
                        return await callTTSAPI(p.text, {
                            engine,
                            voiceId,
                            speed: parseFloat(p.speed) || 1,
                            roleHint: p.roleHint || ''
                        });
                    }
                    throw new Error('callTTSAPI 不可用');
                }
            });

            // AI音乐生成
            this.register('music_generate', {
                name: 'AI音乐',
                description: 'Suno AI音乐生成。参数: prompt(歌词或描述), title(标题,可选), tags(风格标签如pop/rock,可选), model(chirp-auk/chirp-v4/chirp-v5,默认chirp-auk即v4.5), instrumental(纯音乐true/false,默认false), description(灵感描述,可选-与prompt二选一)',
                params: ['prompt', 'title', 'tags', 'model', 'instrumental', 'description'],
                fn: async (p) => {
                    if (typeof callSunoMusicAPI === 'function') {
                        return await callSunoMusicAPI({
                            prompt: p.prompt || '',
                            description: p.description || '',
                            title: p.title || '',
                            tags: p.tags || '',
                            model: p.model || 'chirp-auk',
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

            // 🧊 混元生3D
            this.register('model3d', {
                name: '混元生3D',
                description: '腾讯混元生3D专业版，根据文字描述或图片生成高精度3D模型（GLB格式）。耗时约1-3分钟。参数: prompt(中文描述,如"一只熊猫"), imageUrl(参考图URL,可选,与prompt二选一或同时提供)',
                params: ['prompt', 'imageUrl'],
                fn: async (p) => {
                    if (typeof callHunyuan3DAPI === 'function') {
                        return await callHunyuan3DAPI({ prompt: p.prompt, imageUrl: p.imageUrl });
                    }
                    throw new Error('callHunyuan3DAPI 不可用');
                }
            });

            // 🧩 技能系统工具（调用 SkillManager 执行高级图像编辑技能）
            this.register('skill_portrait', {
                name: 'AI写真',
                description: '人像写真生成：保留人物特征，转换为时尚/商业/艺术/自然/复古/动漫风格写真，并行生成3张。参数: portrait(人像图URL,必须), style(fashion/commercial/artistic/natural/vintage/anime,默认fashion), sceneDesc(场景,可选), aspectRatio(3:4/1:1/9:16,默认3:4)',
                params: ['portrait', 'style', 'sceneDesc', 'aspectRatio'],
                fn: async (p) => {
                    if (global.SkillManager) return await global.SkillManager.execute('ai_portrait', p, { onProgress: (s, pct, m) => console.log(`[skill_portrait] ${s} ${pct}%`), onStepComplete: () => { } });
                    throw new Error('SkillManager 不可用');
                }
            });

            this.register('skill_bg_replace', {
                name: '商品背景替换',
                description: '电商商品换背景：保留商品主体，生成白底/渐变/场景/节日/高端/自定义背景，生成2张。参数: productImage(商品图URL,必须), bgType(white/gradient/scene/festive/luxury/custom,默认white), bgDesc(自定义描述,bgType=custom时填), aspectRatio(1:1/3:4/16:9/9:16,默认1:1)',
                params: ['productImage', 'bgType', 'bgDesc', 'aspectRatio'],
                fn: async (p) => {
                    if (global.SkillManager) return await global.SkillManager.execute('product_bg_replace', p, { onProgress: (s, pct, m) => console.log(`[skill_bg_replace] ${s} ${pct}%`), onStepComplete: () => { } });
                    throw new Error('SkillManager 不可用');
                }
            });

            this.register('skill_style_transfer', {
                name: '风格变身',
                description: '图片风格变换：转换为日漫/皮克斯/油画/水彩/赛博朋克/水墨/素描/吉卜力/像素/低多边形风格，生成2版本。参数: sourceImage(图片URL,必须), targetStyle(anime/pixar/oilpaint/watercolor/cyberpunk/ink/sketch/ghibli/pixel/lowpoly,默认anime), aspectRatio(1:1/9:16/16:9/3:4,默认1:1)',
                params: ['sourceImage', 'targetStyle', 'aspectRatio'],
                fn: async (p) => {
                    if (global.SkillManager) return await global.SkillManager.execute('style_transfer', p, { onProgress: (s, pct, m) => console.log(`[skill_style_transfer] ${s} ${pct}%`), onStepComplete: () => { } });
                    throw new Error('SkillManager 不可用');
                }
            });

            this.register('skill_outpaint', {
                name: '智能扩图',
                description: 'AI扩展图片边界，无损延伸画面。参数: sourceImage(图片URL,必须), expandDirection(wide横向→16:9/tall纵向→9:16/all四周/top/bottom/left/right,默认wide), contentHint(扩展区域描述,可选)',
                params: ['sourceImage', 'expandDirection', 'contentHint'],
                fn: async (p) => {
                    if (global.SkillManager) return await global.SkillManager.execute('smart_outpaint', p, { onProgress: (s, pct, m) => console.log(`[skill_outpaint] ${s} ${pct}%`), onStepComplete: () => { } });
                    throw new Error('SkillManager 不可用');
                }
            });

            // 🌤️ 天气查询工具
            this.register('weather_query', {
                name: '天气查询',
                description: '查询全球任意城市的实时天气和未来预报。零配置，支持中文/英文城市名。参数: city(城市名,如"北京"/"New York"), forecast(预报范围:current仅今天/3days未来3天/7days未来7天,默认current)',
                params: ['city', 'forecast'],
                fn: async (p) => {
                    if (global.SkillManager) {
                        return await global.SkillManager.execute('weather_query', {
                            city: p.city,
                            forecast: p.forecast || 'current'
                        }, { onProgress: () => { }, onStepComplete: () => { } });
                    }
                    throw new Error('SkillManager 不可用');
                }
            });

            // 📝 内容总结工具
            this.register('content_summarize', {
                name: '内容总结',
                description: '总结URL网页、长文本、视频内容。快速提取关键信息。参数: content(内容文本或URL), summaryType(总结方式:bullet要点列表/paragraph段落摘要/detailed详细总结/keypoints关键信息,默认bullet), language(输出语言:zh中文/en英文/auto自动,默认zh)',
                params: ['content', 'summaryType', 'language'],
                fn: async (p) => {
                    if (global.SkillManager) {
                        return await global.SkillManager.execute('content_summarize', {
                            content: p.content,
                            summaryType: p.summaryType || 'bullet',
                            language: p.language || 'zh'
                        }, { onProgress: () => { }, onStepComplete: () => { } });
                    }
                    throw new Error('SkillManager 不可用');
                }
            });

            // 🔍 联网搜索工具
            this.register('web_search', {
                name: '联网搜索',
                description: '实时搜索互联网获取最新信息。查新闻、找资料、搜热点。参数: query(搜索关键词), resultCount(结果数量:3/5/10,默认5), searchType(搜索类型:general综合/news新闻/tech技术,默认general)',
                params: ['query', 'resultCount', 'searchType'],
                fn: async (p) => {
                    if (global.SkillManager) {
                        return await global.SkillManager.execute('web_search', {
                            query: p.query,
                            resultCount: p.resultCount || '5',
                            searchType: p.searchType || 'general'
                        }, { onProgress: () => { }, onStepComplete: () => { } });
                    }
                    throw new Error('SkillManager 不可用');
                }
            });

            // 🐙 GitHub集成工具
            this.register('github_integration', {
                name: 'GitHub助手',
                description: '搜索代码仓库、查看Issue/PR、获取项目信息。参数: action(操作类型:search_repo/search_code/get_repo/get_issues/get_readme), query(搜索关键词或owner/repo), language(编程语言,可选)',
                params: ['action', 'query', 'language'],
                fn: async (p) => {
                    if (global.SkillManager) {
                        return await global.SkillManager.execute('github_integration', {
                            action: p.action,
                            query: p.query,
                            language: p.language
                        }, { onProgress: () => { }, onStepComplete: () => { } });
                    }
                    throw new Error('SkillManager 不可用');
                }
            });

            // 👍 反馈收集工具（自我迭代）
            this.register('feedback_collector', {
                name: '反馈收集',
                description: '收集用户对AI回复的反馈，帮助AI自我改进。参数: feedbackType(反馈类型:rating/suggestion/error_report), rating(评分1-5), content(详细反馈内容)',
                params: ['feedbackType', 'rating', 'content'],
                fn: async (p) => {
                    if (global.SkillManager) {
                        return await global.SkillManager.execute('feedback_collector', {
                            feedbackType: p.feedbackType || 'rating',
                            rating: p.rating || '5',
                            content: p.content || ''
                        }, { onProgress: () => { }, onStepComplete: () => { } });
                    }
                    throw new Error('SkillManager 不可用');
                }
            });

            // 🔧 技能发现工具
            this.register('find_skills', {
                name: '技能发现',
                description: '根据用户需求推荐合适的技能。参数: need(用户需求的描述文本)',
                params: ['need'],
                fn: async (p) => {
                    if (global.SkillManager) {
                        return await global.SkillManager.execute('find_skills', {
                            need: p.need
                        }, { onProgress: () => { }, onStepComplete: () => { } });
                    }
                    throw new Error('SkillManager 不可用');
                }
            });

            // 🤖 主动代理工具
            this.register('proactive_agent', {
                name: '主动助手',
                description: '分析用户行为，主动提供建议。参数: action(操作类型:analyze/suggest/remind)',
                params: ['action'],
                fn: async (p) => {
                    if (global.SkillManager) {
                        return await global.SkillManager.execute('proactive_agent', {
                            action: p.action || 'suggest'
                        }, { onProgress: () => { }, onStepComplete: () => { } });
                    }
                    throw new Error('SkillManager 不可用');
                }
            });

            // 🧠 记忆图谱工具
            this.register('ontology_memory', {
                name: '记忆图谱',
                description: '提取对话关键信息构建知识图谱。参数: action(操作类型:extract/view/forget), content(对话内容，extract时使用)',
                params: ['action', 'content'],
                fn: async (p) => {
                    if (global.SkillManager) {
                        return await global.SkillManager.execute('ontology_memory', {
                            action: p.action || 'view',
                            content: p.content || ''
                        }, { onProgress: () => { }, onStepComplete: () => { } });
                    }
                    throw new Error('SkillManager 不可用');
                }
            });

            console.log(`🔧 [ToolRegistry] 已注册 ${this._tools.size} 个工具`);
            // 异步预加载 DubbingX 音色缓存（不阻塞初始化）
            this._fetchDubbingXVoices();
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

    /** 判断错误是否为"后端已处理但连接中途断开"——此类错误不应重试（避免重复扣费） */
    function isConnectionClosedAfterBilling(e) {
        const msg = String(e?.message || '');
        // net::ERR_CONNECTION_CLOSED 且状态码为 200，说明后端已完成处理并扣费
        return /ERR_CONNECTION_CLOSED.*200|200.*ERR_CONNECTION_CLOSED|失败: 200$|failed.*200$/i.test(msg)
            || /ERR_CONNECTION_CLOSED/i.test(msg);
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
                // 后端已处理（连接中途断开），不重试避免重复扣费
                if (isConnectionClosedAfterBilling(e)) {
                    console.warn(`⚠️ [Retry] ${label} 检测到连接断开(后端已处理)，跳过重试`);
                    break;
                }
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
        if (toolId === 'model3d') return 300000;          // 3D模型: 5分钟
        if (toolId.startsWith('save_')) return 10000;    // 保存: 10秒
        if (toolId.startsWith('skill_')) return 300000;   // 技能工具: 5分钟
        return 60000; // 默认 1分钟
    }

    // ==================== 工具降级映射 ====================
    /** 同类工具降级顺序：当主工具失败时自动尝试同类替代工具 */
    const TOOL_FALLBACKS = {
        // 图片生成类：互为备选
        image_seedream: ['image_banana', 'image_modelscope', 'image_mj'],
        image_banana: ['image_seedream', 'image_modelscope', 'image_mj'],
        image_modelscope: ['image_banana', 'image_seedream', 'image_mj'],
        image_mj: ['image_banana', 'image_seedream', 'image_modelscope'],
        // 文本类
        text_gen: ['text_write'],
        text_write: ['text_gen'],
        // 视频类
        video_text: ['video_image'],
        video_image: ['video_text'],
    };

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

            // 构建可用工具ID列表（用于提示词强调）
            const toolIds = toolDescs.map(t => t.id);

            // 构建提示词
            const thinkPrompt = `${this.systemPrompt}

你可以使用以下工具:
${toolList}

【严格限制】你只能使用上面列出的工具ID: [${toolIds.join(', ')}]
绝对禁止使用未列出的工具ID。如果你需要的功能不在上述工具列表中，请使用 text_output 返回文字描述。

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
                // 🔧 修复：callZhenzhenTextAPI 失败时自动降级到 callWriterLLM
                const response = await withRetry(async (attempt) => {
                    // 第1次尝试：优先 callZhenzhenTextAPI（更稳定的JSON输出）
                    if (attempt <= 1 && typeof callZhenzhenTextAPI === 'function') {
                        try {
                            return await withTimeout(
                                callZhenzhenTextAPI(thinkPrompt, { model: 'gemini-3.1-pro-preview', temperature: 0.3, max_tokens: 4096 }),
                                120000, `${this.name} LLM推理`
                            );
                        } catch (e) {
                            console.warn(`⚠️ [${this.name}] callZhenzhenTextAPI 失败，降级到 callWriterLLM:`, e.message);
                            // 降级到 callWriterLLM
                            if (typeof callWriterLLM === 'function') {
                                return await withTimeout(
                                    callWriterLLM([
                                        { role: 'system', content: this.systemPrompt },
                                        { role: 'user', content: thinkPrompt }
                                    ], { temperature: 0.3, max_tokens: 4096 }),
                                    120000, `${this.name} LLM推理(降级)`
                                );
                            }
                            throw e; // 无可用降级，抛出原始错误
                        }
                    }
                    // 第2+次重试 或 callZhenzhenTextAPI 不可用：直接用 callWriterLLM
                    if (typeof callWriterLLM === 'function') {
                        return await withTimeout(
                            callWriterLLM([
                                { role: 'system', content: this.systemPrompt },
                                { role: 'user', content: thinkPrompt }
                            ], { temperature: 0.3, max_tokens: 4096 }),
                            120000, `${this.name} LLM推理`
                        );
                    }
                    throw new Error('无可用的 LLM 服务');
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
                    // 检测 content 是否是被包裹的 JSON plan（LLM有时把plan包在text_output里）
                    const cnt = (decision.content || '').trim();
                    if (cnt.startsWith('{') || cnt.startsWith('[')) {
                        try {
                            const inner = JSON.parse(cnt);
                            if (inner.action === 'plan' && Array.isArray(inner.steps) && inner.steps.length > 0) {
                                console.log(`[${this.name}] text_output 内含隐藏plan，自动转为plan执行`);
                                return await this._executePlan(inner.steps);
                            }
                        } catch (e) { /* 不是JSON，当普通文本 */ }
                    }
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

                // 单个工具调用（带自动降级）
                if (!this.tools.includes(decision.action)) {
                    throw new Error(`Agent [${this.name}] 没有权限使用工具: ${decision.action}`);
                }

                const toolChain = [decision.action, ...this._getToolFallbacks(decision.action)];
                let lastErr = null;
                for (const toolId of toolChain) {
                    try {
                        if (toolId !== decision.action) {
                            console.warn(`⚠️ [${this.name}] ${lastErr ? lastErr.message.substring(0, 60) : '失败'}，自动切换: ${decision.action} → ${toolId}`);
                        }
                        const timeout = getToolTimeout(toolId);
                        const result = await withTimeout(
                            ToolRegistry.execute(toolId, decision.params || {}),
                            timeout, `工具 ${toolId}`
                        );
                        this.status = 'done';
                        return { type: 'tool_result', tool: toolId, result };
                    } catch (e) {
                        lastErr = e;
                        console.warn(`⚠️ [${this.name}] 工具 ${toolId} 失败: ${e.message}`);
                    }
                }
                // 所有备选都失败
                throw lastErr || new Error(`工具 ${decision.action} 及其所有备选均失败`);

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

                    // 带降级的工具调用：主工具失败后自动尝试同类备选
                    const toolChain = [step.tool, ...this._getToolFallbacks(step.tool)];
                    let stepSuccess = false;
                    let lastStepErr = null;

                    for (const toolId of toolChain) {
                        try {
                            if (toolId !== step.tool) {
                                console.warn(`⚠️ [${this.name}] 步骤${i + 1} 自动切换: ${step.tool} → ${toolId}`);
                            }
                            const timeout = getToolTimeout(toolId);
                            const result = await withRetry(async () => {
                                return await withTimeout(
                                    ToolRegistry.execute(toolId, params),
                                    timeout, `${toolId}`
                                );
                            }, 2, 3000, `${this.name} 步骤${i + 1}`);

                            results.push({ step: i + 1, tool: toolId, result, status: 'success', description: step.description });
                            stepSuccess = true;
                            break;
                        } catch (e) {
                            lastStepErr = e;
                            console.warn(`⚠️ [${this.name}] 步骤${i + 1} 工具 ${toolId} 失败: ${e.message}`);
                        }
                    }

                    if (!stepSuccess) {
                        results.push({ step: i + 1, tool: step.tool, error: lastStepErr ? lastStepErr.message : '所有备选均失败', status: 'failed' });
                        console.warn(`⚠️ [${this.name}] 步骤${i + 1}所有备选均失败`);
                    }
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

            let parsed = null;

            // 尝试直接解析
            try {
                const p = JSON.parse(text.trim());
                if (p.action) parsed = p;
            } catch (e) { /* continue */ }

            // 尝试从 markdown 代码块提取
            if (!parsed) {
                const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
                if (jsonMatch) {
                    try {
                        const p = JSON.parse(jsonMatch[1].trim());
                        if (p.action) parsed = p;
                    } catch (e) { /* continue */ }
                }
            }

            // 尝试找到第一个 { 和最后一个 }
            if (!parsed) {
                const firstBrace = text.indexOf('{');
                const lastBrace = text.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                    try {
                        const p = JSON.parse(text.substring(firstBrace, lastBrace + 1));
                        if (p.action) parsed = p;
                    } catch (e) { /* continue */ }
                }
            }

            // 兜底：作为纯文本输出
            if (!parsed) {
                return { action: 'text_output', content: text, reasoning: 'LLM未返回有效JSON，作为文本输出' };
            }

            // ========== 验证工具ID合法性 ==========
            const SPECIAL_ACTIONS = ['text_output', 'done', 'plan', 'delegate'];

            // 验证单个action
            if (!SPECIAL_ACTIONS.includes(parsed.action)) {
                if (!this.tools.includes(parsed.action)) {
                    const corrected = this._findClosestTool(parsed.action);
                    if (corrected) {
                        console.warn(`🔧 [${this.name}] 工具ID自动纠正: ${parsed.action} → ${corrected}`);
                        parsed.action = corrected;
                    } else {
                        console.warn(`🔧 [${this.name}] LLM使用了不存在的工具: ${parsed.action}，转为文本输出`);
                        return { action: 'text_output', content: parsed.reasoning || JSON.stringify(parsed), reasoning: `LLM尝试使用不存在的工具: ${parsed.action}` };
                    }
                }
            }

            // 验证plan中每个step的tool（跳过协调器级别的agent分工计划）
            if (parsed.action === 'plan' && Array.isArray(parsed.steps)) {
                // 协调器计划使用 {agent, task} 格式，不含 tool 字段，无需验证工具ID
                const isCoordinatorPlan = parsed.steps.length > 0 && parsed.steps[0].agent && !parsed.steps[0].tool;
                if (!isCoordinatorPlan) {
                    parsed.steps = parsed.steps.filter(step => {
                        if (!step.tool) return false;
                        if (this.tools.includes(step.tool)) return true;
                        const corrected = this._findClosestTool(step.tool);
                        if (corrected) {
                            console.warn(`🔧 [${this.name}] 计划步骤工具ID纠正: ${step.tool} → ${corrected}`);
                            step.tool = corrected;
                            return true;
                        }
                        console.warn(`🔧 [${this.name}] 计划中移除不存在的工具步骤: ${step.tool}`);
                        return false;
                    });
                    // 如果所有步骤都被移除，转为文本输出
                    if (parsed.steps.length === 0) {
                        return { action: 'text_output', content: parsed.reasoning || '计划中所有工具均不可用', reasoning: '计划步骤全部无效' };
                    }
                }
            }

            return parsed;
        }

        /** 查找最接近的合法工具ID（用于纠正LLM幻觉） */
        _findClosestTool(toolId) {
            if (!toolId) return null;
            const tid = toolId.toLowerCase().replace(/[\s-]/g, '_');

            // 常见幻觉工具名 → 真实工具ID映射
            const HALLUCINATION_MAP = {
                'generate_image': 'image_banana', 'gen_image': 'image_banana',
                'create_image': 'image_banana', 'draw': 'image_banana', 'paint': 'image_banana',
                'image_generate': 'image_banana', 'image_gen': 'image_banana', 'image_create': 'image_banana',
                'generate_video': 'video_text', 'gen_video': 'video_text', 'create_video': 'video_text',
                'video_generate': 'video_text', 'video_gen': 'video_text', 'video_create': 'video_text',
                'generate_text': 'text_gen', 'write_text': 'text_write', 'write': 'text_write',
                'text_generate': 'text_gen', 'text_create': 'text_gen',
                'generate_music': 'music_generate', 'create_music': 'music_generate',
                'music_gen': 'music_generate', 'music_create': 'music_generate',
                'tts': 'tts_generate', 'voice': 'tts_generate', 'generate_voice': 'tts_generate',
                'voice_generate': 'tts_generate', 'speech': 'tts_generate',
                'analyze_image': 'image_analyze', 'image_analysis': 'image_analyze',
                'save': 'save_image',
                'generate_seedream': 'image_seedream', 'seedream': 'image_seedream',
                'midjourney': 'image_mj', 'mj': 'image_mj',
                'modelscope': 'image_modelscope',
            };

            // 直接映射
            const mapped = HALLUCINATION_MAP[tid];
            if (mapped && this.tools.includes(mapped)) return mapped;

            // 子串匹配：幻觉ID包含真实工具ID，或反过来
            for (const tool of this.tools) {
                if (tid.includes(tool) || tool.includes(tid)) return tool;
            }

            return null;
        }

        /** 获取同类备选工具（只返回当前Agent有权限的） */
        _getToolFallbacks(toolId) {
            const fallbacks = TOOL_FALLBACKS[toolId];
            if (!fallbacks) return [];
            return fallbacks.filter(t => this.tools.includes(t));
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
            const parts = ['📷 用户提供的参考图（必须参考！）:'];
            refs.forEach((ref, i) => {
                parts.push(`参考图${i + 1}${ref.label ? '(' + ref.label + ')' : ''}: ${ref.url}`);
                if (ref.analysis) {
                    const a = typeof ref.analysis === 'string' ? ref.analysis.substring(0, 800) : JSON.stringify(ref.analysis).substring(0, 800);
                    parts.push(`  分析: ${a}`);
                }
            });
            const refUrls = refs.map(r => r.url).filter(Boolean);
            parts.push(`\n【重要】所有图片生成工具调用必须在params中传入参考图:`);
            if (refUrls.length === 1) {
                parts.push(`  "refImage": "${refUrls[0]}"`);
            } else {
                parts.push(`  "refImages": ${JSON.stringify(refUrls)}`);
            }
            parts.push(`同时prompt必须融合参考图分析结果中的风格、色彩、构图等要素。`);
            return parts.join('\n');
        }

        /** 📷 自动注入参考图到图片生成工具的params（防止LLM遗忘） */
        _injectRefImages(decision) {
            const refs = this.sharedBoard.referenceImages;
            if (!refs || refs.length === 0) return decision;

            const IMAGE_TOOLS = ['image_banana', 'image_seedream', 'image_modelscope', 'image_mj'];
            const refUrls = refs.map(r => r.url).filter(Boolean);
            if (refUrls.length === 0) return decision;

            const inject = (params) => {
                if (!params) params = {};
                // 只在LLM未主动传入时注入
                if (!params.refImage && !params.refImages) {
                    if (refUrls.length === 1) {
                        params.refImage = refUrls[0];
                    } else {
                        params.refImages = refUrls;
                    }
                    return { params, injected: true };
                }
                return { params, injected: false };
            };

            // 单个工具调用
            if (IMAGE_TOOLS.includes(decision.action)) {
                const { params, injected } = inject(decision.params);
                decision.params = params;
                if (injected) console.log(`📷 [自动注入] ${decision.action} 注入 ${refUrls.length} 张参考图`);
            }

            // 计划中的步骤
            if (decision.action === 'plan' && Array.isArray(decision.steps)) {
                for (const step of decision.steps) {
                    if (IMAGE_TOOLS.includes(step.tool)) {
                        const { params, injected } = inject(step.params);
                        step.params = params;
                        if (injected) console.log(`📷 [自动注入] 计划步骤 ${step.tool} 注入 ${refUrls.length} 张参考图`);
                    }
                }
            }

            return decision;
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

                // 🎙️ 有声小说团队：硬编码计划，绕过coordinator自由发挥
                const hasVoiceArtist = Array.from(this.agents.values()).some(a => a.role === 'voice_artist');
                const hasWriter = Array.from(this.agents.values()).some(a => a.role === 'writer');
                const hasMusicProducer = Array.from(this.agents.values()).some(a => a.role === 'music_producer');
                // 只在纯音频团队（无视觉/视频制作）时走有声小说固定流程，影视制作/Skill-Agent团队不触发
                const hasVisualProducer = Array.from(this.agents.values()).some(a => ['visual_artist', 'video_producer', 'storyboard_master', 'skill_master'].includes(a.role));
                if (hasVoiceArtist && hasWriter && !hasVisualProducer) {
                    const writerId = Array.from(this.agents.values()).find(a => a.role === 'writer').id;
                    const voiceId = Array.from(this.agents.values()).find(a => a.role === 'voice_artist').id;
                    const hardcodedSteps = [
                        {
                            agent: writerId,
                            task: `请根据用户目标写一篇完整的中文有声小说/故事文本，要求：有清晰的角色对话和旁白，情节完整，字数1000-2000字。用户目标：${userGoal}`,
                            dependsOn: []
                        },
                        {
                            agent: voiceId,
                            task: `请将writer写好的完整小说文本分段配音。每段≤500字，使用engine:dubbingx(不需要voiceId)；女性角色也可用engine:kling voiceId:ai_shatang，男性/旁白也可用engine:kling voiceId:genshin_vindi2，必须返回plan格式包含所有段落的tts_generate步骤，不能只配一段就结束。文本内容从上下文中获取。`,
                            dependsOn: [0]
                        }
                    ];
                    if (hasMusicProducer) {
                        const musicId = Array.from(this.agents.values()).find(a => a.role === 'music_producer').id;
                        hardcodedSteps.push({
                            agent: musicId,
                            task: `为有声小说《${userGoal}》生成背景音乐BGM。严格要求：1.必须设置instrumental:true（纯音乐，绝对不要有人声/歌词）；2.prompt只写音乐风格描述（如"Chinese folk, peaceful, cinematic"），不要把故事文本或对话放进prompt；3.tags用英文（如folk, cinematic, ambient）。`,
                            dependsOn: []
                        });
                    }
                    const hardcodedPlan = { action: 'plan', steps: hardcodedSteps, reasoning: '有声小说固定流程：写作→配音→BGM' };
                    this._log(this.coordinator.id, 'result', `制定了 ${hardcodedSteps.length} 步计划（有声小说固定流程）`, hardcodedPlan);
                    console.log(`📋 [有声小说硬编码计划]`, JSON.stringify(hardcodedSteps, null, 2));
                    this._emit('planReady', hardcodedPlan);
                    await this._executePlan(hardcodedSteps, userGoal);
                    this.status = 'completed';
                    const elapsed = Math.round((Date.now() - this._startTime) / 1000);
                    this._log(this.coordinator.id, 'info', `✅ 任务完成！共产出 ${this.deliverables.length} 项交付物，耗时 ${elapsed}s`);
                    this._emit('completed', { deliverables: this.deliverables, messageLog: this.messageLog });
                    return { deliverables: this.deliverables, messageLog: this.messageLog };
                }

                const agentList = Array.from(this.agents.values())
                    .filter(a => a.role !== 'coordinator')
                    .map(a => `- ${a.id} (${a.name}): ${a.role}, 工具: [${a.tools.join(',')}]`)
                    .join('\n');

                // 📷 注入参考图上下文
                const refContext = this._getReferenceContext();

                // 检测是否为有声小说/广播剧任务（hasVoiceArtist 已在上方声明）
                const audiobookHint = hasVoiceArtist ? `
⚠️ 有声小说/广播剧任务强制规则（必须遵守）：
1. writer 先写完整中文小说文本（步骤0）
2. voice_artist 必须依赖 writer 步骤（dependsOn:[0]），其 task 描述必须包含：
   "请将以下完整文本分段配音，每段≤500字，使用 engine:dubbingx(不需要voiceId)或 engine:kling voiceId:genshin_vindi2(男)/ai_shatang(女)，必须返回 plan 格式包含所有段落的 tts_generate 步骤。文本内容：[从上下文获取writer产出的完整文本]"
3. music_producer 只负责生成背景音乐BGM（instrumental:true），绝对不能用来做人声配音
4. 配音必须用 voice_artist 的 tts_generate 工具，不能用 music_generate` : '';

                const planInput = `用户目标: ${userGoal}
${refContext ? '\n' + refContext + '\n' : ''}
可用的团队成员:
${agentList}
${audiobookHint}
请为这个项目制定详细的分工计划。返回 JSON:
{"action":"plan","steps":[{"agent":"<agent_id>","task":"具体任务描述","dependsOn":[]},...],"reasoning":"整体思路"}

规则：
- 每个步骤必须指定 agent（从上面列表选择）和具体 task
- 如果步骤之间有依赖，用 dependsOn 指定依赖的步骤索引（0-based）
- 没有依赖的步骤可以并行执行，但视觉类任务会自动串行以保证风格一致性
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
                console.log(`📋 [Coordinator计划] 完整步骤:`, JSON.stringify(plan.steps || [], null, 2));
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

                // 🚀 同一波次内的步骤并行执行（带错峰启动避免API限速）
                if (wave.length > 1) {
                    this._log(this.coordinator.id, 'info', `⚡ 并行执行 ${wave.length} 个任务: ${wave.map(i => `步骤${i + 1}`).join(', ')}`);
                }

                // 🔧 错峰启动：每个任务间隔 500ms 启动，避免同时请求API限速
                const wavePromises = wave.map((i, idx) => {
                    const delay = idx * 500;
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(this._executeStep(i, steps[i], steps, stepResults, completed, userGoal));
                        }, delay);
                    });
                });
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
                        this._log(steps[i].agent || 'system', 'error', `步骤 ${i + 1} 失败: ${errMsg}`);
                    }
                }
                if (waveErrors === wave.length) consecutiveErrors += waveErrors;
            }
        }

        /** 智能波次构建：根据任务类型自动决定并行/串行 */
        _buildExecutionWaves(steps) {
            const VISUAL_TOOLS = ['image_banana', 'image_seedream', 'image_modelscope', 'image_mj', 'video_text', 'video_image'];
            const TEXT_ROLES = ['writer', 'copywriter'];   // 文本生产者
            const AUDIO_ROLES = ['voice_artist'];           // 需要文本才能工作的角色

            // 1. 分析每个步骤的类型
            const stepTypes = steps.map(step => {
                const agent = this.agents.get(step.agent);
                const tools = agent ? agent.tools : [];
                const hasVisual = tools.some(t => VISUAL_TOOLS.includes(t));
                const role = agent ? agent.role : '';
                return { agent: step.agent, role, isVisual: hasVisual };
            });

            // 预先收集所有文本生产步骤的索引
            const textStepIndices = steps.reduce((acc, _, i) => {
                if (TEXT_ROLES.includes(stepTypes[i].role)) acc.push(i);
                return acc;
            }, []);

            // 2. 构建有效依赖（显式 + 智能隐式）
            let lastVisualIdx = -1;
            const effectiveDeps = steps.map((step, i) => {
                const deps = new Set(step.dependsOn || []);

                // 规则A: 同一Agent的步骤必须串行（保持记忆连贯性）
                for (let j = i - 1; j >= 0; j--) {
                    if (steps[j].agent === step.agent) {
                        deps.add(j);
                        break; // 只依赖同一Agent的最近一步
                    }
                }

                // 规则B: 视觉任务链式串行（风格一致性）
                if (stepTypes[i].isVisual && lastVisualIdx >= 0) {
                    deps.add(lastVisualIdx);
                }
                if (stepTypes[i].isVisual) lastVisualIdx = i;

                // 规则C: voice_artist 必须在所有文本生产步骤之后执行
                if (AUDIO_ROLES.includes(stepTypes[i].role)) {
                    for (const ti of textStepIndices) {
                        if (ti < i) deps.add(ti); // 只依赖排在前面的文本步骤
                    }
                }

                return deps;
            });

            // 3. 按有效依赖分波
            const waves = [];
            const scheduled = new Set();
            let safety = 0;

            while (scheduled.size < steps.length && safety++ < 50) {
                const wave = [];
                for (let i = 0; i < steps.length; i++) {
                    if (scheduled.has(i)) continue;
                    if ([...effectiveDeps[i]].every(d => scheduled.has(d))) {
                        wave.push(i);
                    }
                }
                if (wave.length === 0) break;
                wave.forEach(i => scheduled.add(i));
                waves.push(wave);
            }

            // 4. 日志调度结果
            const parallelWaves = waves.filter(w => w.length > 1).length;
            const seqWaves = waves.filter(w => w.length === 1).length;
            console.log(`🚀 [调度] ${waves.length}波次: ${parallelWaves}并行 + ${seqWaves}串行`);
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

            // 🎤 voice_artist 特殊处理：自动从前序 writer/copywriter 结果中提取完整文本注入 task
            let effectiveTask = step.task;
            if (agent.role === 'voice_artist') {
                const TEXT_PRODUCER_ROLES = ['writer', 'copywriter'];
                let writerText = '';
                for (const idx of completed) {
                    const prevStep = allSteps[idx];
                    const prevAgent = prevStep ? this.agents.get(prevStep.agent) : null;
                    if (prevAgent && TEXT_PRODUCER_ROLES.includes(prevAgent.role)) {
                        const r = stepResults[idx];
                        if (r && r.type === 'text' && r.content) {
                            writerText = String(r.content);
                        } else if (r && r.type === 'tool_result' && r.result) {
                            const res = r.result;
                            const tv = typeof res === 'string' ? res : (res.content || res.text || res.result || res.script || '');
                            if (tv) writerText = String(tv);
                        } else if (r && r.type === 'plan_result') {
                            for (const ps of (r.results || [])) {
                                if (ps.status === 'success' && ps.result) {
                                    const tv = typeof ps.result === 'string' ? ps.result : (ps.result.content || ps.result.text || '');
                                    if (tv && tv.length > writerText.length) writerText = String(tv);
                                }
                            }
                        }
                    }
                }
                if (writerText && writerText.length > 50) {
                    effectiveTask = `请将以下完整文本分段配音，每段≤500字。引擎选择：engine:dubbingx(不需要voiceId)或engine:kling男声voiceId:genshin_vindi2/女声voiceId:ai_shatang。必须返回 plan 格式包含所有段落的 tts_generate 步骤，不能只配一段就结束。\n\n完整文本：\n${writerText}`;
                    console.log(`🎤 [voice_artist] 自动注入writer文本 ${writerText.length}字`);
                } else {
                    console.warn(`🎤 [voice_artist] 未找到writer文本，使用原始task`);
                }
            }

            this._log(agent.id, 'thinking', `正在处理(${i + 1}/${allSteps.length}): ${step.task}`);
            this._emit('agentUpdate', this.getAgentStates());

            // 带重试的步骤执行
            const stepResult = await withRetry(async (attempt) => {
                if (attempt > 1) {
                    this._log(agent.id, 'info', `🔄 重试第 ${attempt} 次...`);
                }

                // Agent 思考
                if (agent.role === 'voice_artist') {
                    console.log(`🎤 [DEBUG voice_artist] effectiveTask(前300字):`, effectiveTask.substring(0, 300));
                    console.log(`🎤 [DEBUG voice_artist] context(前300字):`, context.substring(0, 300));
                }
                const decision = await agent.think(effectiveTask, context);
                if (this._cancelled) throw new Error('任务已取消');

                if (agent.role === 'voice_artist') {
                    console.log(`🎤 [DEBUG voice_artist] decision:`, JSON.stringify(decision));
                }

                // 📷 自动注入参考图到图片生成工具参数
                this._injectRefImages(decision);

                this._log(agent.id, 'tool_call', `决策: ${decision.action}`, decision);

                // 处理委托
                if (decision.action === 'delegate') {
                    const targetAgent = this.agents.get(decision.targetAgent);
                    if (targetAgent) {
                        this._log(agent.id, 'delegate', `委托给 ${targetAgent.name}: ${decision.task}`);
                        const delegateDecision = await targetAgent.think(decision.task, context);
                        this._injectRefImages(delegateDecision);
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
                    if (r.type === 'text') {
                        summary = `文本内容:\n${String(r.content).substring(0, 2000)}`;
                    } else if (r.type === 'tool_result') {
                        const res = r.result;
                        if (typeof res === 'string') {
                            summary = `工具结果:\n${res.substring(0, 2000)}`;
                        } else if (res && typeof res === 'object') {
                            // 提取对象中的文本字段
                            const textVal = res.content || res.text || res.result || res.script || res.copyText || res.outline || res.summary || null;
                            if (textVal && typeof textVal === 'string') {
                                summary = `工具结果(文本):\n${textVal.substring(0, 2000)}`;
                            } else {
                                summary = `工具结果: ${JSON.stringify(res).substring(0, 500)}`;
                            }
                        }
                    } else if (r.type === 'plan_result') {
                        const successCount = r.results?.filter(s => s.status === 'success').length || 0;
                        const failCount = r.results?.filter(s => s.status === 'failed').length || 0;
                        // 只显示数量摘要，不把音频URL或文本片段当内容注入
                        // 避免 music_producer 把配音文本段误当 Suno 歌词
                        summary = `任务计划已执行: ${successCount}步成功${failCount ? ', ' + failCount + '步失败' : ''}`;
                        // 若步骤结果为纯文本（非URL）则摘要提取，限200字防污染
                        const textOnly = (r.results || []).filter(s => s.status === 'success' && typeof s.result === 'string'
                            && !s.result.startsWith('http') && !s.result.startsWith('data:') && s.result.length > 5);
                        if (textOnly.length > 0) {
                            summary += `，文本摘要: ${textOnly.map(s => s.result).join(' ').substring(0, 200)}`;
                        }
                    } else if (r.type === 'done') {
                        summary = `完成: ${r.result?.summary || ''}`;
                    }
                    if (summary) parts.push(`[已完成步骤${idx + 1}] ${summary}`);
                }
            }

            // 共享板中间产出摘要（其他Agent的产出，供后续Agent引用）
            if (this.sharedBoard.intermediateResults.size > 0) {
                const shared = [];
                for (const [agentId, results] of this.sharedBoard.intermediateResults) {
                    const latest = results[results.length - 1];
                    if (latest && latest.data) {
                        const d = latest.data;
                        let s = '';
                        if (d.type === 'text') {
                            s = String(d.content).substring(0, 1500);
                        } else if (d.type === 'tool_result') {
                            const res = d.result;
                            if (typeof res === 'string') {
                                s = res.substring(0, 1500);
                            } else if (res && typeof res === 'object') {
                                const tv = res.content || res.text || res.result || res.script || res.copyText || res.outline || res.summary || null;
                                s = tv ? String(tv).substring(0, 1500) : JSON.stringify(res).substring(0, 500);
                            }
                        } else if (d.type === 'plan_result') {
                            const sc = d.results?.filter(r => r.status === 'success').length || 0;
                            const fc = d.results?.filter(r => r.status === 'failed').length || 0;
                            s = `计划完成: ${sc}步成功${fc ? ', ' + fc + '步失败' : ''}`;
                        }
                        if (s) shared.push(`[${agentId}产出]:\n${s}`);
                    }
                }
                if (shared.length > 0) parts.push(`🤝 团队共享内容:\n${shared.join('\n\n')}`);
            }

            return parts.join('\n');
        }

        /** 判断URL的媒体类型 */
        _detectMediaType(url, tool) {
            if (!url || typeof url !== 'string') return 'text';
            const lower = url.toLowerCase();
            // data: URI 直接根据 MIME 判断
            if (lower.startsWith('data:audio/')) return 'audio';
            if (lower.startsWith('data:video/')) return 'video';
            if (lower.startsWith('data:image/')) return 'image';
            // 工具类型优先判断（TTS 返回的 URL 不一定含音频扩展名）
            if (tool === 'tts_generate') return 'audio';
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
                    const mediaType = this._detectMediaType(r, result.tool);
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
                            const mediaType = this._detectMediaType(r, step.tool);
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
