/**
 * 🧩 RollRoll Skill 技能系统 - 预置技能定义
 * 包含 10 个成熟的生产级技能
 */

(function () {
    'use strict';

    // 等待 SkillManager 加载
    if (typeof SkillManager === 'undefined') {
        console.warn('[SkillPresets] 等待 SkillManager 加载...');
        setTimeout(() => {
            if (typeof SkillManager !== 'undefined') {
                registerPresetSkills();
            }
        }, 500);
        return;
    }

    registerPresetSkills();

    function registerPresetSkills() {
        const presetSkills = [
            // ==================== 视频类 ====================

            // 1. 短视频批量生成
            {
                id: 'batch_short_video',
                name: '短视频批量生成',
                icon: '🎬',
                category: 'video',
                description: '输入主题，AI 自动生成多个短视频。支持批量生成 1-20 个视频，每个视频独立剧本和画面。',
                parameters: [
                    {
                        key: 'topic',
                        label: '主题/关键词',
                        type: 'textarea',
                        required: true,
                        placeholder: '例如：中国古代神话故事、科幻冒险、都市爱情...',
                        hint: '输入一个创意主题，AI 会据此生成多个不同的短视频'
                    },
                    {
                        key: 'count',
                        label: '生成数量',
                        type: 'number',
                        default: 3,
                        min: 1,
                        max: 20,
                        hint: '建议 3-5 个，数量越多耗时越长'
                    },
                    {
                        key: 'style',
                        label: '视觉风格',
                        type: 'select',
                        default: 'anime',
                        options: [
                            { value: 'anime', label: '🎌 日系动漫' },
                            { value: 'realistic', label: '📸 真人写实' },
                            { value: 'chinese', label: '🏮 国风古典' },
                            { value: '3d', label: '🎮 3D 渲染' },
                            { value: 'watercolor', label: '🎨 水彩插画' }
                        ]
                    },
                    {
                        key: 'duration',
                        label: '单个视频时长（秒）',
                        type: 'select',
                        default: '15',
                        options: [
                            { value: '5', label: '5 秒（超短）' },
                            { value: '10', label: '10 秒' },
                            { value: '15', label: '15 秒（推荐）' },
                            { value: '30', label: '30 秒' }
                        ]
                    },
                    {
                        key: 'videoModel',
                        label: '视频模型',
                        type: 'select',
                        default: 'sora-2-all',
                        options: [
                            { value: 'sora-2-all', label: 'Sora-2（推荐）' },
                            { value: 'veo3.1', label: 'Veo 3.1 4K（超清）' },
                            { value: 'kling-2.5-720p-5s', label: '可灵 2.5（性价比）' },
                            { value: 'hailuo-02-768p-6s', label: '海螺（经济）' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    const count = params.count || 3;
                    const duration = parseInt(params.duration) || 15;
                    const model = params.videoModel || 'sora-2-all';

                    // 每个视频：剧本(0.1) + 图片(0.5) + 视频(根据模型)
                    let videoFilm = 3; // Sora-2 默认
                    if (model.includes('veo')) videoFilm = 5;
                    if (model.includes('kling')) videoFilm = duration <= 5 ? 5 : 10;
                    if (model.includes('hailuo')) videoFilm = duration <= 6 ? 7 : 11;

                    const perVideo = 0.1 + 0.5 + videoFilm;
                    const totalFilm = Math.ceil(count * perVideo);
                    const timePerVideo = duration <= 10 ? 2 : 3; // 分钟

                    return {
                        film: totalFilm,
                        time: `约 ${count * timePerVideo} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { topic, count, style, duration, videoModel } = params;
                    const results = [];

                    for (let i = 0; i < count; i++) {
                        if (callbacks.isCancelled?.()) break;

                        const progress = Math.round((i / count) * 100);
                        callbacks.onProgress?.(`生成视频 ${i + 1}/${count}`, progress, `正在创作第 ${i + 1} 个视频...`);

                        try {
                            // 步骤 1: 生成剧本
                            const scriptPrompt = `请为以下主题生成一个短视频剧本，时长约${duration}秒，风格为${style}：\n${topic}\n\n要求：
1. 剧本要简洁有力，适合短视频
2. 包含具体的画面描述
3. 第 ${i + 1} 个视频要与其他视频有所不同
4. 直接输出剧本内容，不要解释`;

                            let script = '';
                            if (typeof callScriptGenerator === 'function') {
                                script = await callScriptGenerator({}, scriptPrompt);
                            } else if (typeof callModelScopeTextAPI === 'function') {
                                script = await callModelScopeTextAPI(scriptPrompt);
                            } else {
                                throw new Error('文本生成功能不可用');
                            }

                            callbacks.onStepComplete?.(`视频${i + 1} 剧本`, { script: script.substring(0, 100) + '...' });

                            // 步骤 2: 生成封面图
                            const stylePrompts = {
                                anime: 'Japanese anime style, vibrant colors, cel-shaded',
                                realistic: 'photorealistic, cinematic lighting, detailed',
                                chinese: 'Chinese traditional style, ink painting influence',
                                '3d': '3D rendered, Pixar style, high quality CGI',
                                watercolor: 'watercolor painting, soft colors, artistic'
                            };

                            const imagePrompt = `${stylePrompts[style] || ''}, ${script.substring(0, 200)}, high quality, 16:9 aspect ratio`;

                            let imageUrl = '';
                            if (typeof callBanana2ImageAPI === 'function') {
                                imageUrl = await callBanana2ImageAPI(imagePrompt, { aspectRatio: '16:9' });
                            } else if (typeof callModelScopeImageAPI === 'function') {
                                imageUrl = await callModelScopeImageAPI(imagePrompt, { aspectRatio: '16:9' });
                            }

                            callbacks.onStepComplete?.(`视频${i + 1} 封面图`, { imageUrl });

                            // 步骤 3: 生成视频
                            let videoUrl = '';
                            const videoPrompt = script.substring(0, 500);

                            if (imageUrl && typeof callSora2ImageToVideoAPI === 'function') {
                                videoUrl = await callSora2ImageToVideoAPI(imageUrl, videoPrompt, {
                                    model: videoModel,
                                    duration: parseInt(duration),
                                    aspectRatio: '16:9'
                                });
                            } else if (typeof callSora2TextToVideoAPI === 'function') {
                                videoUrl = await callSora2TextToVideoAPI(videoPrompt, {
                                    model: videoModel,
                                    duration: parseInt(duration),
                                    aspectRatio: '16:9'
                                });
                            }

                            callbacks.onStepComplete?.(`视频${i + 1} 完成`, { videoUrl });

                            results.push({
                                index: i + 1,
                                script,
                                imageUrl,
                                videoUrl,
                                status: 'success'
                            });

                        } catch (error) {
                            console.error(`视频 ${i + 1} 生成失败:`, error);
                            results.push({
                                index: i + 1,
                                error: error.message,
                                status: 'failed'
                            });
                        }
                    }

                    callbacks.onProgress?.('完成', 100, `成功生成 ${results.filter(r => r.status === 'success').length}/${count} 个视频`);

                    return { videos: results, successCount: results.filter(r => r.status === 'success').length };
                }
            },

            // 2. 连续剧情视频
            {
                id: 'continuous_story_video',
                name: '连续剧情视频',
                icon: '📺',
                category: 'video',
                description: '生成有剧情连贯性的系列视频，适合连续剧、系列故事。每个片段衔接上一段的结尾。',
                parameters: [
                    {
                        key: 'story',
                        label: '故事大纲',
                        type: 'textarea',
                        required: true,
                        placeholder: '描述一个完整的故事...',
                        hint: 'AI 会自动将故事拆分为多个连贯片段'
                    },
                    {
                        key: 'episodes',
                        label: '分集数量',
                        type: 'number',
                        default: 3,
                        min: 2,
                        max: 10
                    },
                    {
                        key: 'style',
                        label: '视觉风格',
                        type: 'select',
                        default: 'anime',
                        options: [
                            { value: 'anime', label: '🎌 日系动漫' },
                            { value: 'realistic', label: '📸 电影质感' },
                            { value: 'chinese', label: '🏮 国风古典' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    const episodes = params.episodes || 3;
                    // 每集：剧本(0.1) + 图片(0.5) + 视频(3)
                    return {
                        film: Math.ceil(episodes * 3.6),
                        time: `约 ${episodes * 3} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { story, episodes, style } = params;
                    const results = [];

                    // 先生成分集大纲
                    callbacks.onProgress?.('规划剧情', 5, '正在将故事拆分为多个片段...');

                    const outlinePrompt = `请将以下故事拆分为 ${episodes} 个连续片段，每个片段 15 秒视频内容：

${story}

要求：
1. 每个片段剧情连贯
2. 每个片段结尾要设置悬念或衔接点
3. 输出格式为：
片段1：[内容]
片段2：[内容]
...`;

                    let outline = '';
                    if (typeof callScriptGenerator === 'function') {
                        outline = await callScriptGenerator({}, outlinePrompt);
                    }

                    callbacks.onStepComplete?.('剧情规划', { outline: outline.substring(0, 200) + '...' });

                    // 解析片段
                    const segments = outline.split(/片段\d+[：:]/i).filter(s => s.trim());
                    let lastImageUrl = '';

                    for (let i = 0; i < Math.min(episodes, segments.length); i++) {
                        if (callbacks.isCancelled?.()) break;

                        const segment = segments[i]?.trim() || `第${i + 1}幕`;
                        const progress = 10 + Math.round((i / episodes) * 85);
                        callbacks.onProgress?.(`生成片段 ${i + 1}/${episodes}`, progress, `正在创作第 ${i + 1} 集...`);

                        try {
                            // 生成本集画面
                            const styleMap = {
                                anime: 'anime style, Japanese animation',
                                realistic: 'cinematic, photorealistic',
                                chinese: 'Chinese traditional art'
                            };

                            const imagePrompt = `${styleMap[style]}, ${segment.substring(0, 300)}, sequential storytelling, 16:9`;

                            let imageUrl = '';
                            if (lastImageUrl && typeof callBanana2ImageAPI === 'function') {
                                // 使用上一帧作为参考，保持角色一致性
                                imageUrl = await callBanana2ImageAPI(imagePrompt, {
                                    aspectRatio: '16:9',
                                    refImage: lastImageUrl
                                });
                            } else if (typeof callBanana2ImageAPI === 'function') {
                                imageUrl = await callBanana2ImageAPI(imagePrompt, { aspectRatio: '16:9' });
                            }

                            // 生成视频
                            let videoUrl = '';
                            if (imageUrl && typeof callSora2ImageToVideoAPI === 'function') {
                                videoUrl = await callSora2ImageToVideoAPI(imageUrl, segment, {
                                    model: 'sora-2-all',
                                    duration: 15,
                                    aspectRatio: '16:9'
                                });
                            }

                            lastImageUrl = imageUrl; // 保存用于下一集参考

                            callbacks.onStepComplete?.(`第${i + 1}集`, { videoUrl });

                            results.push({
                                episode: i + 1,
                                script: segment,
                                imageUrl,
                                videoUrl,
                                status: 'success'
                            });

                        } catch (error) {
                            results.push({
                                episode: i + 1,
                                error: error.message,
                                status: 'failed'
                            });
                        }
                    }

                    callbacks.onProgress?.('完成', 100, `成功生成 ${results.filter(r => r.status === 'success').length}/${episodes} 集`);

                    return { episodes: results };
                }
            },

            // 3. 图生视频批量
            {
                id: 'batch_image_to_video',
                name: '图生视频批量',
                icon: '🖼️',
                category: 'video',
                description: '上传多张图片，批量转换为动态视频。适合将插画、照片等静态内容转为动画。',
                parameters: [
                    {
                        key: 'images',
                        label: '上传图片',
                        type: 'image',
                        required: true,
                        multiple: true,
                        hint: '支持 JPG/PNG，最多 10 张'
                    },
                    {
                        key: 'motion',
                        label: '运动类型',
                        type: 'select',
                        default: 'natural',
                        options: [
                            { value: 'natural', label: '自然运动' },
                            { value: 'zoom', label: '推拉镜头' },
                            { value: 'pan', label: '平移镜头' },
                            { value: 'dramatic', label: '戏剧动作' }
                        ]
                    },
                    {
                        key: 'duration',
                        label: '视频时长',
                        type: 'select',
                        default: '5',
                        options: [
                            { value: '5', label: '5 秒' },
                            { value: '10', label: '10 秒' },
                            { value: '15', label: '15 秒' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    const imageCount = params.images?.length || 1;
                    return {
                        film: Math.ceil(imageCount * 3),
                        time: `约 ${imageCount * 2} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { images, motion, duration } = params;
                    const results = [];

                    if (!images || images.length === 0) {
                        throw new Error('请上传至少一张图片');
                    }

                    const motionPrompts = {
                        natural: 'natural movement, subtle animation, breathing effect',
                        zoom: 'slow zoom in, cinematic camera movement',
                        pan: 'smooth horizontal pan, tracking shot',
                        dramatic: 'dramatic action, dynamic movement'
                    };

                    for (let i = 0; i < images.length; i++) {
                        if (callbacks.isCancelled?.()) break;

                        const progress = Math.round((i / images.length) * 100);
                        callbacks.onProgress?.(`处理图片 ${i + 1}/${images.length}`, progress, `正在生成第 ${i + 1} 个视频...`);

                        try {
                            const file = images[i];

                            // 将文件转为 URL
                            const imageUrl = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => resolve(reader.result);
                                reader.onerror = reject;
                                reader.readAsDataURL(file);
                            });

                            // 生成视频
                            const prompt = `${motionPrompts[motion]}, animate this image with ${motion} effect`;

                            let videoUrl = '';
                            if (typeof callSora2ImageToVideoAPI === 'function') {
                                videoUrl = await callSora2ImageToVideoAPI(imageUrl, prompt, {
                                    model: 'sora-2-all',
                                    duration: parseInt(duration),
                                    aspectRatio: '16:9'
                                });
                            }

                            callbacks.onStepComplete?.(`图片${i + 1}`, { videoUrl });

                            results.push({
                                index: i + 1,
                                fileName: file.name,
                                videoUrl,
                                status: 'success'
                            });

                        } catch (error) {
                            results.push({
                                index: i + 1,
                                error: error.message,
                                status: 'failed'
                            });
                        }
                    }

                    callbacks.onProgress?.('完成', 100, `成功处理 ${results.filter(r => r.status === 'success').length}/${images.length} 张图片`);

                    return { videos: results };
                }
            },

            // ==================== 图像类 ====================

            // 4. 风格统一出图
            {
                id: 'style_consistent_images',
                name: '风格统一出图',
                icon: '🎨',
                category: 'image',
                description: '指定一种风格，批量生成多张风格一致的图片。适合素材库、表情包、系列插画等。',
                parameters: [
                    {
                        key: 'styleRef',
                        label: '风格参考（可选）',
                        type: 'image',
                        hint: '上传一张参考图，AI 会模仿其风格'
                    },
                    {
                        key: 'styleDesc',
                        label: '风格描述',
                        type: 'text',
                        required: true,
                        placeholder: '例如：赛博朋克、水墨画、扁平插画...',
                        hint: '用文字描述想要的风格'
                    },
                    {
                        key: 'subjects',
                        label: '图片主题（每行一个）',
                        type: 'textarea',
                        required: true,
                        placeholder: '一只可爱的猫咪\n一棵大树\n一座古堡\n一辆跑车',
                        hint: '每行输入一个主题，将生成对应数量的图片'
                    },
                    {
                        key: 'aspectRatio',
                        label: '图片比例',
                        type: 'select',
                        default: '1:1',
                        options: [
                            { value: '1:1', label: '1:1 正方形' },
                            { value: '16:9', label: '16:9 横版' },
                            { value: '9:16', label: '9:16 竖版' },
                            { value: '4:3', label: '4:3 标准' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    const subjects = (params.subjects || '').split('\n').filter(s => s.trim());
                    return {
                        film: Math.ceil(subjects.length * 0.5),
                        time: `约 ${Math.ceil(subjects.length * 0.5)} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { styleRef, styleDesc, subjects, aspectRatio } = params;
                    const subjectList = subjects.split('\n').filter(s => s.trim());
                    const results = [];

                    // 处理参考图
                    let refImageUrl = null;
                    if (styleRef && styleRef.length > 0) {
                        refImageUrl = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(styleRef[0]);
                        });
                    }

                    for (let i = 0; i < subjectList.length; i++) {
                        if (callbacks.isCancelled?.()) break;

                        const subject = subjectList[i].trim();
                        const progress = Math.round((i / subjectList.length) * 100);
                        callbacks.onProgress?.(`生成图片 ${i + 1}/${subjectList.length}`, progress, `正在生成: ${subject}`);

                        try {
                            const prompt = `${styleDesc} style, ${subject}, high quality, detailed, consistent art style`;

                            let imageUrl = '';
                            if (refImageUrl && typeof callBanana2ImageAPI === 'function') {
                                imageUrl = await callBanana2ImageAPI(prompt, {
                                    aspectRatio,
                                    refImage: refImageUrl
                                });
                            } else if (typeof callBanana2ImageAPI === 'function') {
                                imageUrl = await callBanana2ImageAPI(prompt, { aspectRatio });
                            } else if (typeof callModelScopeImageAPI === 'function') {
                                imageUrl = await callModelScopeImageAPI(prompt, { aspectRatio });
                            }

                            callbacks.onStepComplete?.(subject, { imageUrl });

                            results.push({
                                subject,
                                imageUrl,
                                status: 'success'
                            });

                        } catch (error) {
                            results.push({
                                subject,
                                error: error.message,
                                status: 'failed'
                            });
                        }
                    }

                    callbacks.onProgress?.('完成', 100, `成功生成 ${results.filter(r => r.status === 'success').length}/${subjectList.length} 张图片`);

                    return { images: results };
                }
            },

            // 5. 角色设定包
            {
                id: 'character_design_pack',
                name: '角色设定包',
                icon: '👤',
                category: 'image',
                description: '输入角色描述，生成完整的角色设定包：三视图、表情包、动作参考、服装细节。',
                parameters: [
                    {
                        key: 'name',
                        label: '角色名称',
                        type: 'text',
                        required: true,
                        placeholder: '例如：林小月'
                    },
                    {
                        key: 'description',
                        label: '角色描述',
                        type: 'textarea',
                        required: true,
                        placeholder: '描述角色的外貌、性格、服装等...',
                        hint: '越详细越好，包括发型、服装、配饰等'
                    },
                    {
                        key: 'style',
                        label: '画风',
                        type: 'select',
                        default: 'anime',
                        options: [
                            { value: 'anime', label: '🎌 日系动漫' },
                            { value: 'realistic', label: '📸 写实风格' },
                            { value: 'chinese', label: '🏮 国风' },
                            { value: 'chibi', label: '🎀 Q版可爱' }
                        ]
                    },
                    {
                        key: 'includeExpressions',
                        label: '生成表情包',
                        type: 'checkbox',
                        default: true,
                        checkboxLabel: '包含 6 种表情'
                    },
                    {
                        key: 'includeActions',
                        label: '生成动作参考',
                        type: 'checkbox',
                        default: true,
                        checkboxLabel: '包含 4 个动作'
                    }
                ],
                estimateCost: (params) => {
                    let count = 2; // 基础：三视图 + 设定海报
                    if (params.includeExpressions) count += 1;
                    if (params.includeActions) count += 1;
                    return {
                        film: Math.ceil(count * 1),
                        time: `约 ${count * 1} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { name, description, style, includeExpressions, includeActions } = params;
                    const results = {};

                    const stylePrompts = {
                        anime: 'Japanese anime style, vibrant colors, detailed',
                        realistic: 'photorealistic, detailed, professional',
                        chinese: 'Chinese traditional art style, elegant',
                        chibi: 'chibi style, cute, round features'
                    };

                    const baseStyle = stylePrompts[style] || stylePrompts.anime;

                    // 1. 三视图设定
                    callbacks.onProgress?.('三视图', 10, '正在生成角色三视图...');

                    try {
                        const turnaroundPrompt = `${baseStyle}, character turnaround sheet, ${name}, ${description}, front view, side view, back view, clean white background, professional character design, full body, same character in all views`;

                        if (typeof createCharacterImageVariants === 'function') {
                            const variants = await createCharacterImageVariants({
                                name,
                                summary: description,
                                storyContext: description,
                                userCharStyle: style === 'realistic' ? 'realistic' : style === 'chinese' ? 'chinese' : 'anime'
                            });
                            results.turnaround = variants;
                        } else if (typeof callBanana2ImageAPI === 'function') {
                            results.turnaround = await callBanana2ImageAPI(turnaroundPrompt, { aspectRatio: '16:9' });
                        }

                        callbacks.onStepComplete?.('三视图', { url: results.turnaround });
                    } catch (e) {
                        console.error('三视图生成失败:', e);
                    }

                    // 2. 设定海报
                    callbacks.onProgress?.('设定海报', 30, '正在生成角色设定海报...');

                    try {
                        const posterPrompt = `${baseStyle}, character design poster, ${name}, ${description}, clothing details, color palette, accessories, full body pose, professional character sheet`;

                        if (typeof callBanana2ImageAPI === 'function') {
                            results.poster = await callBanana2ImageAPI(posterPrompt, { aspectRatio: '16:9' });
                        }

                        callbacks.onStepComplete?.('设定海报', { url: results.poster });
                    } catch (e) {
                        console.error('设定海报生成失败:', e);
                    }

                    // 3. 表情包
                    if (includeExpressions) {
                        callbacks.onProgress?.('表情包', 50, '正在生成表情包...');

                        try {
                            const expressionPrompt = `${baseStyle}, expression sheet, ${name}, ${description}, 6 different expressions: happy, sad, angry, surprised, shy, confident, portrait close-up, white background, grid layout`;

                            if (typeof callBanana2ImageAPI === 'function') {
                                results.expressions = await callBanana2ImageAPI(expressionPrompt, { aspectRatio: '16:9' });
                            }

                            callbacks.onStepComplete?.('表情包', { url: results.expressions });
                        } catch (e) {
                            console.error('表情包生成失败:', e);
                        }
                    }

                    // 4. 动作参考
                    if (includeActions) {
                        callbacks.onProgress?.('动作参考', 75, '正在生成动作参考...');

                        try {
                            const actionPrompt = `${baseStyle}, action pose sheet, ${name}, ${description}, 4 dynamic poses: standing, running, fighting, sitting, full body, white background, action reference`;

                            if (typeof callBanana2ImageAPI === 'function') {
                                results.actions = await callBanana2ImageAPI(actionPrompt, { aspectRatio: '16:9' });
                            }

                            callbacks.onStepComplete?.('动作参考', { url: results.actions });
                        } catch (e) {
                            console.error('动作参考生成失败:', e);
                        }
                    }

                    callbacks.onProgress?.('完成', 100, `角色设定包已生成`);

                    return { characterName: name, assets: results };
                }
            },

            // 6. 漫画分镜生成
            {
                id: 'comic_storyboard',
                name: '漫画分镜生成',
                icon: '📖',
                category: 'image',
                description: '根据剧本/故事生成漫画分镜页面，自动排版，适合条漫、四格漫画等。',
                parameters: [
                    {
                        key: 'story',
                        label: '故事/剧本',
                        type: 'textarea',
                        required: true,
                        placeholder: '输入故事内容...',
                        hint: 'AI 会自动拆分为分镜'
                    },
                    {
                        key: 'pageCount',
                        label: '页数',
                        type: 'number',
                        default: 4,
                        min: 1,
                        max: 20
                    },
                    {
                        key: 'style',
                        label: '漫画风格',
                        type: 'select',
                        default: 'manga',
                        options: [
                            { value: 'manga', label: '日式漫画' },
                            { value: 'webtoon', label: '条漫' },
                            { value: 'american', label: '美式漫画' },
                            { value: 'chibi', label: 'Q版' }
                        ]
                    },
                    {
                        key: 'panelsPerPage',
                        label: '每页格数',
                        type: 'select',
                        default: '4',
                        options: [
                            { value: '2', label: '2 格' },
                            { value: '4', label: '4 格' },
                            { value: '6', label: '6 格' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    const pages = params.pageCount || 4;
                    return {
                        film: Math.ceil(pages * 0.5),
                        time: `约 ${pages} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { story, pageCount, style, panelsPerPage } = params;
                    const results = [];

                    const styleMap = {
                        manga: 'manga style, black and white, screen tones, dynamic angles',
                        webtoon: 'webtoon style, full color, vertical scroll format',
                        american: 'American comic style, bold lines, vivid colors',
                        chibi: 'chibi style, cute deformed characters, simple backgrounds'
                    };

                    // 先拆分分镜
                    callbacks.onProgress?.('规划分镜', 5, '正在将故事拆分为分镜...');

                    const totalPanels = pageCount * parseInt(panelsPerPage);
                    const splitPrompt = `将以下故事拆分为 ${totalPanels} 个漫画分镜，每个分镜用"【分镜X】"标记：

${story}

要求：每个分镜描述具体画面内容，包括角色动作、表情、对话、背景`;

                    let panelDescriptions = [];
                    try {
                        let outline = '';
                        if (typeof callScriptGenerator === 'function') {
                            outline = await callScriptGenerator({}, splitPrompt);
                        }
                        panelDescriptions = outline.split(/【分镜\d+】/i).filter(s => s.trim());
                    } catch (e) {
                        // 如果拆分失败，按段落处理
                        panelDescriptions = story.split(/[。！？\n]+/).filter(s => s.trim()).slice(0, totalPanels);
                    }

                    callbacks.onStepComplete?.('分镜规划', { panelCount: panelDescriptions.length });

                    // 生成每页
                    for (let page = 0; page < pageCount; page++) {
                        if (callbacks.isCancelled?.()) break;

                        const progress = 10 + Math.round((page / pageCount) * 85);
                        callbacks.onProgress?.(`生成第 ${page + 1} 页`, progress, `正在绘制第 ${page + 1} 页...`);

                        try {
                            const startPanel = page * parseInt(panelsPerPage);
                            const pagePanels = panelDescriptions.slice(startPanel, startPanel + parseInt(panelsPerPage));
                            const panelDesc = pagePanels.join('; ');

                            const pagePrompt = `${styleMap[style]}, comic page, ${parseInt(panelsPerPage)} panels layout, sequential art, ${panelDesc}`;

                            let imageUrl = '';
                            if (typeof callBanana2ImageAPI === 'function') {
                                imageUrl = await callBanana2ImageAPI(pagePrompt, { aspectRatio: '9:16' });
                            }

                            callbacks.onStepComplete?.(`第${page + 1}页`, { imageUrl });

                            results.push({
                                page: page + 1,
                                panels: pagePanels,
                                imageUrl,
                                status: 'success'
                            });

                        } catch (error) {
                            results.push({
                                page: page + 1,
                                error: error.message,
                                status: 'failed'
                            });
                        }
                    }

                    callbacks.onProgress?.('完成', 100, `成功生成 ${results.filter(r => r.status === 'success').length}/${pageCount} 页漫画`);

                    return { pages: results };
                }
            },

            // ==================== 内容类 ====================

            // 7. 热点文案生成
            {
                id: 'trending_copywriting',
                name: '热点文案生成',
                icon: '🔥',
                category: 'content',
                description: '根据热点话题或关键词，批量生成多条吸引眼球的文案。适合社交媒体、营销推广。',
                parameters: [
                    {
                        key: 'topic',
                        label: '话题/关键词',
                        type: 'text',
                        required: true,
                        placeholder: '例如：春节、AI 工具、健身...'
                    },
                    {
                        key: 'count',
                        label: '生成数量',
                        type: 'number',
                        default: 10,
                        min: 1,
                        max: 50
                    },
                    {
                        key: 'platform',
                        label: '目标平台',
                        type: 'select',
                        default: 'douyin',
                        options: [
                            { value: 'douyin', label: '抖音' },
                            { value: 'xiaohongshu', label: '小红书' },
                            { value: 'weibo', label: '微博' },
                            { value: 'wechat', label: '公众号' },
                            { value: 'bilibili', label: 'B站' }
                        ]
                    },
                    {
                        key: 'tone',
                        label: '语气风格',
                        type: 'select',
                        default: 'casual',
                        options: [
                            { value: 'casual', label: '轻松活泼' },
                            { value: 'professional', label: '专业正式' },
                            { value: 'humorous', label: '幽默搞笑' },
                            { value: 'emotional', label: '情感共鸣' },
                            { value: 'provocative', label: '引发讨论' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    return {
                        film: Math.ceil((params.count || 10) * 0.1),
                        time: `约 1-2 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { topic, count, platform, tone } = params;

                    callbacks.onProgress?.('生成文案', 20, '正在创作文案...');

                    const platformStyles = {
                        douyin: '简短有力，适合配合视频，多用 emoji',
                        xiaohongshu: '种草风格，真诚分享，适当加标签',
                        weibo: '话题性强，可以有争议性',
                        wechat: '标题党风格，引人点击',
                        bilibili: '年轻化，二次元风格，可以玩梗'
                    };

                    const toneStyles = {
                        casual: '轻松活泼，像朋友聊天',
                        professional: '专业可信，有数据支撑',
                        humorous: '幽默搞笑，有梗有料',
                        emotional: '触动情感，引发共鸣',
                        provocative: '有观点，引发讨论'
                    };

                    const prompt = `请为"${topic}"主题生成 ${count} 条${platformStyles[platform]}的文案。

风格要求：${toneStyles[tone]}

输出格式：每条文案单独一行，序号开头

注意：
1. 每条文案要独特，不要重复
2. 符合${platform}平台特点
3. 有吸引力，能引发互动`;

                    let copywritings = [];
                    try {
                        let result = '';
                        if (typeof callScriptGenerator === 'function') {
                            result = await callScriptGenerator({}, prompt);
                        } else if (typeof callModelScopeTextAPI === 'function') {
                            result = await callModelScopeTextAPI(prompt);
                        }

                        // 解析文案
                        copywritings = result.split(/\n+/)
                            .filter(line => line.trim())
                            .map(line => line.replace(/^\d+[\.\)、]\s*/, '').trim())
                            .filter(line => line.length > 5)
                            .slice(0, count);

                    } catch (error) {
                        throw new Error('文案生成失败: ' + error.message);
                    }

                    callbacks.onStepComplete?.('文案生成', { count: copywritings.length });
                    callbacks.onProgress?.('完成', 100, `成功生成 ${copywritings.length} 条文案`);

                    return {
                        topic,
                        platform,
                        copywritings,
                        count: copywritings.length
                    };
                }
            },

            // 8. 小说转漫画
            {
                id: 'novel_to_comic',
                name: '小说转漫画',
                icon: '📚',
                category: 'content',
                description: '将小说章节自动转换为漫画页面。AI 分析情节、设计分镜、生成画面。',
                parameters: [
                    {
                        key: 'novel',
                        label: '小说内容',
                        type: 'textarea',
                        required: true,
                        placeholder: '粘贴小说章节内容...',
                        hint: '建议 1000-3000 字为宜'
                    },
                    {
                        key: 'pageCount',
                        label: '漫画页数',
                        type: 'number',
                        default: 6,
                        min: 2,
                        max: 20
                    },
                    {
                        key: 'style',
                        label: '漫画风格',
                        type: 'select',
                        default: 'manga',
                        options: [
                            { value: 'manga', label: '日式漫画' },
                            { value: 'manhwa', label: '韩式漫画' },
                            { value: 'manhua', label: '国风漫画' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    const pages = params.pageCount || 6;
                    return {
                        film: Math.ceil(pages * 0.6),
                        time: `约 ${pages + 2} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { novel, pageCount, style } = params;
                    const results = [];

                    // 步骤 1: 分析小说，提取分镜
                    callbacks.onProgress?.('分析小说', 5, '正在分析故事情节...');

                    const analysisPrompt = `请将以下小说内容转换为 ${pageCount} 页漫画的分镜脚本。

小说内容：
${novel.substring(0, 3000)}

要求：
1. 每页 4 个分镜
2. 每个分镜包含：画面描述、角色表情、对话（如有）
3. 输出格式：
【第X页】
分镜1: ...
分镜2: ...
...`;

                    let storyboard = '';
                    try {
                        if (typeof callScriptGenerator === 'function') {
                            storyboard = await callScriptGenerator({}, analysisPrompt);
                        }
                    } catch (e) {
                        storyboard = novel;
                    }

                    callbacks.onStepComplete?.('分镜脚本', { length: storyboard.length });

                    // 步骤 2: 生成每页漫画
                    const styleMap = {
                        manga: 'Japanese manga style, black and white with screentones',
                        manhwa: 'Korean manhwa style, full color, detailed',
                        manhua: 'Chinese manhua style, traditional influenced'
                    };

                    const pages = storyboard.split(/【第\d+页】/i).filter(p => p.trim());

                    for (let i = 0; i < Math.min(pageCount, pages.length || pageCount); i++) {
                        if (callbacks.isCancelled?.()) break;

                        const progress = 10 + Math.round((i / pageCount) * 85);
                        callbacks.onProgress?.(`绘制第 ${i + 1} 页`, progress, `正在生成第 ${i + 1} 页漫画...`);

                        try {
                            const pageContent = pages[i] || novel.substring(i * 500, (i + 1) * 500);
                            const pagePrompt = `${styleMap[style]}, comic page, 4 panels, sequential art, ${pageContent.substring(0, 400)}`;

                            let imageUrl = '';
                            if (typeof callBanana2ImageAPI === 'function') {
                                imageUrl = await callBanana2ImageAPI(pagePrompt, { aspectRatio: '9:16' });
                            }

                            callbacks.onStepComplete?.(`第${i + 1}页`, { imageUrl });

                            results.push({
                                page: i + 1,
                                content: pageContent.substring(0, 100) + '...',
                                imageUrl,
                                status: 'success'
                            });

                        } catch (error) {
                            results.push({
                                page: i + 1,
                                error: error.message,
                                status: 'failed'
                            });
                        }
                    }

                    callbacks.onProgress?.('完成', 100, `成功生成 ${results.filter(r => r.status === 'success').length}/${pageCount} 页漫画`);

                    return { pages: results };
                }
            },

            // 9. 脚本智能拆分
            {
                id: 'script_split',
                name: '脚本智能拆分',
                icon: '✂️',
                category: 'content',
                description: '将长脚本/剧本智能拆分为分镜、片段，生成每个片段的描述和提示词。',
                parameters: [
                    {
                        key: 'script',
                        label: '完整脚本',
                        type: 'textarea',
                        required: true,
                        placeholder: '粘贴完整脚本/剧本...'
                    },
                    {
                        key: 'targetDuration',
                        label: '目标时长（秒）',
                        type: 'number',
                        default: 60,
                        min: 15,
                        max: 300,
                        hint: '最终视频的目标时长'
                    },
                    {
                        key: 'outputFormat',
                        label: '输出格式',
                        type: 'select',
                        default: 'storyboard',
                        options: [
                            { value: 'storyboard', label: '分镜表' },
                            { value: 'scenes', label: '场景列表' },
                            { value: 'prompts', label: 'AI 提示词' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    return {
                        film: 0.2,
                        time: '约 30 秒'
                    };
                },
                execute: async (params, callbacks) => {
                    const { script, targetDuration, outputFormat } = params;

                    callbacks.onProgress?.('分析脚本', 20, '正在分析脚本结构...');

                    const scenesCount = Math.ceil(targetDuration / 15);

                    const formatInstructions = {
                        storyboard: `分镜表格式，包含：镜号、画面描述、时长、旁白/对话、备注`,
                        scenes: `场景列表格式，包含：场景号、场景描述、出场角色、时间地点`,
                        prompts: `AI 提示词格式，每个分镜生成可直接用于 AI 绘图/视频的英文 prompt`
                    };

                    const prompt = `请将以下脚本拆分为 ${scenesCount} 个分镜，总时长约 ${targetDuration} 秒。

脚本内容：
${script.substring(0, 4000)}

输出格式要求：${formatInstructions[outputFormat]}

注意：
1. 每个分镜约 15 秒
2. 保持故事连贯性
3. 分镜要有画面感，可执行`;

                    let result = '';
                    try {
                        if (typeof callScriptGenerator === 'function') {
                            result = await callScriptGenerator({}, prompt);
                        } else if (typeof callModelScopeTextAPI === 'function') {
                            result = await callModelScopeTextAPI(prompt);
                        }
                    } catch (error) {
                        throw new Error('脚本分析失败: ' + error.message);
                    }

                    callbacks.onStepComplete?.('脚本拆分', { scenesCount });
                    callbacks.onProgress?.('完成', 100, `已拆分为 ${scenesCount} 个分镜`);

                    return {
                        originalLength: script.length,
                        targetDuration,
                        scenesCount,
                        format: outputFormat,
                        result
                    };
                }
            },

            // ==================== 自动化类 ====================

            // 10. 全流程自动化
            {
                id: 'full_auto_workflow',
                name: '全流程自动化',
                icon: '🤖',
                category: 'automation',
                description: '从一个创意到完整作品的一键全自动流程：创意 → 剧本 → 角色 → 分镜 → 视频/漫画。',
                parameters: [
                    {
                        key: 'idea',
                        label: '创意主题',
                        type: 'textarea',
                        required: true,
                        placeholder: '输入您的创意...',
                        hint: '一句话或一段描述都可以'
                    },
                    {
                        key: 'outputType',
                        label: '输出类型',
                        type: 'select',
                        default: 'video',
                        options: [
                            { value: 'video', label: '🎬 短视频' },
                            { value: 'comic', label: '📖 漫画' },
                            { value: 'both', label: '🎁 视频+漫画' }
                        ]
                    },
                    {
                        key: 'style',
                        label: '视觉风格',
                        type: 'select',
                        default: 'anime',
                        options: [
                            { value: 'anime', label: '🎌 日系动漫' },
                            { value: 'realistic', label: '📸 写实电影' },
                            { value: 'chinese', label: '🏮 国风古典' }
                        ]
                    },
                    {
                        key: 'duration',
                        label: '视频时长',
                        type: 'select',
                        default: '60',
                        options: [
                            { value: '30', label: '30 秒' },
                            { value: '60', label: '1 分钟' },
                            { value: '120', label: '2 分钟' }
                        ]
                    },
                    {
                        key: 'includeCharacter',
                        label: '生成角色设定',
                        type: 'checkbox',
                        default: true,
                        checkboxLabel: '先设计角色，保证人物一致性'
                    }
                ],
                estimateCost: (params) => {
                    const duration = parseInt(params.duration) || 60;
                    const scenes = Math.ceil(duration / 15);
                    let film = 0.5; // 剧本

                    if (params.includeCharacter) film += 1; // 角色
                    if (params.outputType === 'video' || params.outputType === 'both') {
                        film += scenes * 3.5; // 每个分镜：图+视频
                    }
                    if (params.outputType === 'comic' || params.outputType === 'both') {
                        film += Math.ceil(scenes / 2) * 0.5; // 漫画页
                    }

                    return {
                        film: Math.ceil(film),
                        time: `约 ${Math.ceil(duration / 10)} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { idea, outputType, style, duration, includeCharacter } = params;
                    const results = {
                        script: null,
                        character: null,
                        scenes: [],
                        videos: [],
                        comics: []
                    };

                    const scenesCount = Math.ceil(parseInt(duration) / 15);

                    // 步骤 1: 生成剧本
                    callbacks.onProgress?.('编写剧本', 5, '正在创作剧本...');

                    const scriptPrompt = `请为以下创意编写一个短视频剧本，时长约 ${duration} 秒，分 ${scenesCount} 个分镜：

创意：${idea}
风格：${style === 'anime' ? '动漫风格' : style === 'realistic' ? '写实电影风格' : '国风古典风格'}

要求：
1. 剧情紧凑，有开头、发展、高潮、结尾
2. 每个分镜约 15 秒
3. 描述具体画面和动作
4. 如果有角色，描述其外貌特征`;

                    try {
                        if (typeof callScriptGenerator === 'function') {
                            results.script = await callScriptGenerator({}, scriptPrompt);
                        }
                        callbacks.onStepComplete?.('剧本', { preview: results.script?.substring(0, 100) + '...' });
                    } catch (e) {
                        console.error('剧本生成失败:', e);
                    }

                    // 步骤 2: 生成角色设定（可选）
                    if (includeCharacter && results.script) {
                        callbacks.onProgress?.('设计角色', 15, '正在设计角色...');

                        try {
                            if (typeof createCharacterImageVariants === 'function') {
                                // 从剧本中提取主角
                                const charPrompt = `从以下剧本中提取主角信息，输出格式为"名字：外貌描述"
${results.script.substring(0, 1000)}`;

                                let charInfo = '';
                                if (typeof callScriptGenerator === 'function') {
                                    charInfo = await callScriptGenerator({}, charPrompt);
                                }

                                const variants = await createCharacterImageVariants({
                                    name: charInfo.split('：')[0] || '主角',
                                    summary: charInfo.split('：')[1] || results.script.substring(0, 200),
                                    storyContext: results.script,
                                    userCharStyle: style === 'realistic' ? 'realistic' : style === 'chinese' ? 'chinese' : 'anime'
                                });

                                results.character = variants;
                                callbacks.onStepComplete?.('角色设定', { variants });
                            }
                        } catch (e) {
                            console.error('角色设定失败:', e);
                        }
                    }

                    // 步骤 3: 生成分镜图像
                    const stylePrompts = {
                        anime: 'anime style, Japanese animation, vibrant',
                        realistic: 'cinematic, photorealistic, movie quality',
                        chinese: 'Chinese traditional art, ink painting influence'
                    };

                    const sceneTexts = results.script?.split(/分镜\d+|镜头\d+|【\d+】/i).filter(s => s.trim().length > 20) || [results.script || idea];

                    for (let i = 0; i < scenesCount; i++) {
                        if (callbacks.isCancelled?.()) break;

                        const baseProgress = 20 + Math.round((i / scenesCount) * 60);
                        callbacks.onProgress?.(`生成分镜 ${i + 1}/${scenesCount}`, baseProgress, `正在绘制第 ${i + 1} 个分镜...`);

                        try {
                            const sceneText = sceneTexts[i] || sceneTexts[0] || idea;
                            const imagePrompt = `${stylePrompts[style]}, ${sceneText.substring(0, 300)}, cinematic composition, high quality`;

                            let imageUrl = '';
                            const refImage = results.character?.[0]?.url;

                            if (typeof callBanana2ImageAPI === 'function') {
                                imageUrl = await callBanana2ImageAPI(imagePrompt, {
                                    aspectRatio: '16:9',
                                    refImage
                                });
                            }

                            results.scenes.push({
                                index: i + 1,
                                text: sceneText.substring(0, 100),
                                imageUrl
                            });

                            // 如果需要视频
                            if ((outputType === 'video' || outputType === 'both') && imageUrl) {
                                callbacks.onProgress?.(`生成视频 ${i + 1}/${scenesCount}`, baseProgress + 5, `正在生成第 ${i + 1} 个视频...`);

                                if (typeof callSora2ImageToVideoAPI === 'function') {
                                    const videoUrl = await callSora2ImageToVideoAPI(imageUrl, sceneText, {
                                        model: 'sora-2-all',
                                        duration: 15,
                                        aspectRatio: '16:9'
                                    });
                                    results.videos.push({ index: i + 1, videoUrl });
                                }
                            }

                            callbacks.onStepComplete?.(`分镜${i + 1}`, { imageUrl });

                        } catch (e) {
                            console.error(`分镜 ${i + 1} 失败:`, e);
                        }
                    }

                    // 步骤 4: 生成漫画（如果需要）
                    if (outputType === 'comic' || outputType === 'both') {
                        const comicPages = Math.ceil(scenesCount / 4);
                        for (let p = 0; p < comicPages; p++) {
                            if (callbacks.isCancelled?.()) break;

                            callbacks.onProgress?.(`生成漫画 ${p + 1}/${comicPages}`, 80 + Math.round((p / comicPages) * 15), `正在生成第 ${p + 1} 页漫画...`);

                            try {
                                const pageScenes = results.scenes.slice(p * 4, (p + 1) * 4);
                                const comicPrompt = `${stylePrompts[style]}, comic page, 4 panels, ${pageScenes.map(s => s.text).join('; ')}`;

                                if (typeof callBanana2ImageAPI === 'function') {
                                    const comicUrl = await callBanana2ImageAPI(comicPrompt, { aspectRatio: '9:16' });
                                    results.comics.push({ page: p + 1, imageUrl: comicUrl });
                                }
                            } catch (e) {
                                console.error(`漫画第 ${p + 1} 页失败:`, e);
                            }
                        }
                    }

                    callbacks.onProgress?.('完成', 100, '全流程执行完成！');

                    return results;
                }
            }
        ];

        // 注册所有预置 Skills
        SkillManager.registerAll(presetSkills);

        console.log('🧩 预置 Skills 注册完成');
    }
})();
