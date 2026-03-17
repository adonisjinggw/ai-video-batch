/**
 * 🧩 RollRoll Skill 技能系统 - 预置技能定义
 * 包含 10 个成熟的生产级技能
 */

(function () {
    'use strict';

    // 🎨 通用生图模型选项（必须在 registerPresetSkills 之前声明，避免 TDZ）
    const IMAGE_MODEL_OPTIONS = [
        { value: 'doubao-seedream-4-5-251128', label: '✨ 星梦画师（推荐 7胶片）' },
        { value: 'nano-banana-2', label: '🎨 Banana 标准（6胶片）' },
        { value: 'nano-banana-2-4k', label: '💎 Banana 4K（10胶片）' },
        { value: 'modelscope', label: '🆓 智能绘图（免费）' },
        { value: 'Qwen/Qwen-Image-2512', label: '🌟 通义万象Max（8胶片）' },
        { value: 'midjourney-fast', label: '🎨 MJ Fast（2胶片）' },
        { value: 'midjourney-turbo', label: '⚡ MJ Turbo（2胶片）' },
        { value: 'midjourney-relax', label: '🐢 MJ Relax（2胶片）' }
    ];

    // 🎬 通用视频模型选项（只保留可用且性价比高的模型）
    const VIDEO_MODEL_OPTIONS = [
        { value: 'wan26-720p-5s', label: 'Wan2.6 720p 5s（推荐 3胶片）' },
        { value: 'wan26-720p-10s', label: 'Wan2.6 720p 10s（5胶片）' },
        { value: 'wan26-720p-15s', label: 'Wan2.6 720p 15s（7胶片）' },
        { value: 'wan26-1080p-5s', label: 'Wan2.6 1080p 5s（5胶片）' },
        { value: 'wan26-1080p-10s', label: 'Wan2.6 1080p 10s（9胶片）' },
        { value: 'wan26-1080p-15s', label: 'Wan2.6 1080p 15s（13胶片）' },
        { value: 'wan26-720p-5s-audio', label: 'Wan2.6 720p 5s 有声（4胶片）' },
        { value: 'wan26-720p-10s-audio', label: 'Wan2.6 720p 10s 有声（7胶片）' },
        { value: 'wan26-720p-15s-audio', label: 'Wan2.6 720p 15s 有声（10胶片）' },
        { value: 'wan26-1080p-5s-audio', label: 'Wan2.6 1080p 5s 有声（7胶片）' },
        { value: 'wan26-1080p-10s-audio', label: 'Wan2.6 1080p 10s 有声（14胶片）' },
        { value: 'wan26-1080p-15s-audio', label: 'Wan2.6 1080p 15s 有声（20胶片）' },
        { value: 'grok-video-3', label: 'Grok Video 3（6s 5胶片）' },
        { value: 'grok-video-3-10s', label: 'Grok Video 3（10s 有声 8胶片）' },
        { value: 'grok-video-3-15s', label: 'Grok Video 3（15s 有声 12胶片）' },
        { value: 'veo3.1', label: 'Veo 3.1 4K（超清 8s 30胶片）' }
    ];

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

    /**
     * 🖼️ 统一解析参考图参数（兼容 base64 数组 / FileList / 单文件）
     * @param {Array|FileList|null} imageParam - 从 collectSkillParams 返回的图片参数
     * @returns {Promise<{first: string|null, all: string[]}>} first=第一张base64, all=全部base64数组
     */
    async function resolveRefImages(imageParam) {
        if (!imageParam || (Array.isArray(imageParam) && imageParam.length === 0)) {
            return { first: null, all: [] };
        }
        // 已是 base64 数组（从 skillImageStore 来）
        if (Array.isArray(imageParam) && typeof imageParam[0] === 'string') {
            return { first: imageParam[0], all: [...imageParam] };
        }
        // FileList 或类似对象
        const files = Array.from(imageParam);
        const results = await Promise.all(files.map(file => {
            if (typeof file === 'string') return Promise.resolve(file);
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            });
        }));
        const valid = results.filter(Boolean);
        return { first: valid[0] || null, all: valid };
    }

    /**
     * 🖼️ 图片压缩函数：避免413错误
     * @param {string} dataUrl - base64图片
     * @param {number} maxSize - 最大尺寸（宽或高）
     * @param {number} quality - 压缩质量 0-1
     * @returns {Promise<string>} 压缩后的base64
     */
    function compressDataUrl(dataUrl, maxSize = 1200, quality = 0.85) {
        return new Promise((resolve) => {
            if (!dataUrl || dataUrl.length < 100 * 1024) {
                resolve(dataUrl);
                return;
            }
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = Math.round(height * (maxSize / width));
                        width = maxSize;
                    } else {
                        width = Math.round(width * (maxSize / height));
                        height = maxSize;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    }

    /**
     * 🎨 智能调用图片生成 API
     * 支持 imageModel 路由：
     *   doubao-seedream-* / nano-banana-2 / nano-banana-2-4k / modelscope /
     *   Qwen/Qwen-Image-2512 / midjourney-fast / midjourney-turbo / midjourney-relax
     */
    async function callImageAPIWithRefs(prompt, opts, refImages) {
        const imageModel = opts?.imageModel || '';

        // 🎨 Midjourney 路由
        if (imageModel.startsWith('midjourney') && typeof callMidjourneyImageAPI === 'function') {
            console.log(`🎨 [MJ路由] 使用 ${imageModel}`);
            return await callMidjourneyImageAPI(prompt, { ...opts, model: imageModel });
        }

        // 🎨 ModelScope 路由
        if (imageModel === 'modelscope' && typeof callModelScopeImageAPI === 'function') {
            console.log(`🖼️ [ModelScope路由] 使用智能绘图`);
            return await callModelScopeImageAPI(prompt, { ...opts, refImages });
        }

        // ✨ 星梦画师 / Banana 4K / Banana 2K / 通义万象 → 通过 callBanana2ImageAPI 指定 model
        if ((imageModel.includes('seedream') || imageModel.includes('doubao') ||
            imageModel.includes('banana-2-4k') || imageModel.includes('banana-2-2k') ||
            imageModel.startsWith('Qwen/')) && typeof callBanana2ImageAPI === 'function') {
            console.log(`🎨 [模型路由] 使用 ${imageModel}`);
            return await callBanana2ImageAPI(prompt, { ...opts, model: imageModel });
        }

        // 多图参考（>= 2张）→ 优先走 ModelScope 的 image2image
        if (refImages && refImages.length >= 2 && typeof callModelScopeImageAPI === 'function') {
            console.log(`🖼️ [多图参考] 使用 ModelScope image2image，${refImages.length}张参考图`);
            return await callModelScopeImageAPI(prompt, { ...opts, refImages });
        }
        // 默认 → Banana2
        if (typeof callBanana2ImageAPI === 'function') {
            return await callBanana2ImageAPI(prompt, { ...opts, model: imageModel || 'nano-banana-2' });
        }
        if (typeof callModelScopeImageAPI === 'function') {
            return await callModelScopeImageAPI(prompt, opts);
        }
        throw new Error('图片生成功能不可用');
    }

    // ==================== 💰 统一成本计算函数（与 yunwu.js 保持一致） ====================

    function calculateImageCost(imageModel) {
        const im = String(imageModel || 'nano-banana-2').toLowerCase();
        if (im.startsWith('midjourney')) return 12;
        if (im === 'modelscope') return 0;
        if (im.includes('seedream') || im.includes('doubao')) return 8;
        if (im.includes('4k')) return 10;
        if (im.includes('qwen')) return 8;
        return 5;
    }

    function calculateVideoCost(videoModel, duration = 5) {
        const m = String(videoModel || 'wan26-720p-5s').toLowerCase();
        const d = parseInt(duration) || 5;

        if (m.includes('modelscope')) return 0;

        if (m.includes('veo')) return 30;
        if (m.includes('grok')) {
            const baseCost = m.includes('10s') ? 8 : 5;
            const baseDur = m.includes('10s') ? 10 : 6;
            return Math.ceil((baseCost / baseDur) * d);
        }

        if (m.startsWith('vidu-')) {
            let baseCost = 25;
            let baseDur = 5;
            if (m.includes('q3-pro')) {
                baseCost = m.includes('1080p') ? 77 : 72;
            } else if (m.includes('q2-pro')) {
                baseCost = m.includes('1080p') ? 54 : 27;
            } else if (m.includes('q2-turbo')) {
                baseCost = m.includes('1080p') ? 36 : 19;
            } else {
                baseCost = m.includes('1080p') ? 36 : 25;
            }
            return Math.ceil((baseCost / baseDur) * d);
        }

        if (m.startsWith('hailuo-')) {
            let baseCost = 7;
            let baseDur = 6;
            if (m.includes('02') && m.includes('768p')) {
                baseCost = m.includes('10s') ? 12 : 7;
                baseDur = m.includes('10s') ? 10 : 6;
            } else if (m.includes('02') && m.includes('1080p')) {
                baseCost = m.includes('10s') ? 20 : 12;
                baseDur = m.includes('10s') ? 10 : 6;
            } else if (m.includes('fast') && m.includes('768p')) {
                baseCost = m.includes('10s') ? 8 : 5;
                baseDur = m.includes('10s') ? 10 : 6;
            } else if (m.includes('fast') && m.includes('1080p')) {
                baseCost = m.includes('10s') ? 14 : 8;
                baseDur = m.includes('10s') ? 10 : 6;
            } else {
                baseCost = m.includes('10s') ? 14 : 8;
                baseDur = m.includes('10s') ? 10 : 6;
            }
            return Math.ceil((baseCost / baseDur) * d);
        }

        if (m.startsWith('kling-')) {
            let baseCost = 16;
            let baseDur = 5;
            if (m.includes('o1')) {
                if (m.includes('720p')) {
                    baseCost = m.includes('10s') ? 31 : 16;
                    baseDur = m.includes('10s') ? 10 : 5;
                } else {
                    baseCost = m.includes('10s') ? 41 : 21;
                    baseDur = m.includes('10s') ? 10 : 5;
                }
            } else if (m.includes('2.5')) {
                if (m.includes('720p')) {
                    baseCost = m.includes('10s') ? 11 : 6;
                    baseDur = m.includes('10s') ? 10 : 5;
                } else {
                    baseCost = m.includes('10s') ? 17 : 9;
                    baseDur = m.includes('10s') ? 10 : 5;
                }
            } else if (m.includes('2.1')) {
                if (m.includes('720p')) {
                    baseCost = m.includes('10s') ? 12 : 6;
                    baseDur = m.includes('10s') ? 10 : 5;
                } else {
                    baseCost = m.includes('10s') ? 20 : 10;
                    baseDur = m.includes('10s') ? 10 : 5;
                }
            } else if (m.includes('2.0')) {
                if (m.includes('720p')) {
                    baseCost = m.includes('10s') ? 14 : 7;
                    baseDur = m.includes('10s') ? 10 : 5;
                } else {
                    baseCost = m.includes('10s') ? 24 : 12;
                    baseDur = m.includes('10s') ? 10 : 5;
                }
            } else if (m.includes('1.6')) {
                if (m.includes('720p')) {
                    baseCost = m.includes('10s') ? 16 : 8;
                    baseDur = m.includes('10s') ? 10 : 5;
                } else {
                    baseCost = m.includes('10s') ? 28 : 14;
                    baseDur = m.includes('10s') ? 10 : 5;
                }
            } else {
                baseCost = m.includes('10s') ? 20 : 10;
                baseDur = m.includes('10s') ? 10 : 5;
            }
            return Math.ceil((baseCost / baseDur) * d);
        }

        if (m.startsWith('wan26-')) {
            let baseCost = 3;
            let baseDur = 5;
            const hasAudio = m.includes('audio');
            if (m.includes('720p')) {
                if (m.includes('15s')) {
                    baseCost = hasAudio ? 11 : 7;
                    baseDur = 15;
                } else if (m.includes('10s')) {
                    baseCost = hasAudio ? 7 : 5;
                    baseDur = 10;
                } else {
                    baseCost = hasAudio ? 4 : 3;
                    baseDur = 5;
                }
            } else if (m.includes('1080p')) {
                if (m.includes('15s')) {
                    baseCost = hasAudio ? 21 : 13;
                    baseDur = 15;
                } else if (m.includes('10s')) {
                    baseCost = hasAudio ? 14 : 9;
                    baseDur = 10;
                } else {
                    baseCost = hasAudio ? 7 : 5;
                    baseDur = 5;
                }
            } else {
                baseCost = hasAudio ? 7 : 5;
                baseDur = 5;
            }
            return Math.ceil((baseCost / baseDur) * d);
        }

        return Math.ceil(15 / 5 * d);
    }

    // ==================== 🎬 智能视频模型选择 ====================

    /**
     * 根据用户意图/参数智能选择最合适的视频模型
     * @param {Object} hint - 意图提示
     * @param {string} [hint.topic] - 主题内容
     * @param {number|string} [hint.duration] - 时长(秒)
     * @param {boolean} [hint.needAudio] - 是否需要有声
     * @param {boolean} [hint.needHD] - 是否需要高清
     * @param {boolean} [hint.needHighQuality] - 是否需要高质量
     * @param {string} [hint.preferred] - 用户指定模型(优先检查是否可用)
     * @returns {string} 视频模型名称
     */
    function selectVideoModel(hint = {}) {
        const AVAILABLE_MODELS = [
            'wan26-720p-5s', 'wan26-720p-10s', 'wan26-720p-15s',
            'wan26-1080p-5s', 'wan26-1080p-10s', 'wan26-1080p-15s',
            'wan26-720p-5s-audio', 'wan26-720p-10s-audio', 'wan26-720p-15s-audio',
            'wan26-1080p-5s-audio', 'wan26-1080p-10s-audio', 'wan26-1080p-15s-audio',
            'grok-video-3', 'grok-video-3-10s', 'grok-video-3-15s',
            'sora-2-vip-all', 'veo3.1', 'veo_3_1-fast-4K'
        ];

        // 用户指定且可用 → 直接用
        if (hint.preferred && AVAILABLE_MODELS.includes(hint.preferred)) {
            return hint.preferred;
        }

        const dur = parseInt(hint.duration) || 5;
        const topic = String(hint.topic || '').toLowerCase();
        const needAudio = hint.needAudio ||
            /有声|音效|音乐|配乐|声音|audio|sound/.test(topic);
        const needHD = hint.needHD ||
            /高清|1080|hd|超清|清晰/.test(topic);
        const needHighQuality = hint.needHighQuality ||
            /高质量|精品|premium|专业|顶级|最好|最高/.test(topic);
        const isShort = dur <= 5;
        const isMedium = dur > 5 && dur <= 10;
        const isLong = dur > 10;

        // 高质量优先 → Veo 3.1
        if (needHighQuality) return 'veo3.1';

        // 有声优先 → Grok Video 3（天然有声）或 Wan2.6 Audio
        if (needAudio) {
            if (isLong) return needHD ? 'wan26-1080p-15s-audio' : 'wan26-720p-15s-audio';
            if (isMedium) return needHD ? 'wan26-1080p-10s-audio' : 'grok-video-3-10s';
            return needHD ? 'wan26-1080p-5s-audio' : 'grok-video-3';
        }

        // 无声：按时长+清晰度选 Wan2.6
        if (isLong) return needHD ? 'wan26-1080p-15s' : 'wan26-720p-15s';
        if (isMedium) return needHD ? 'wan26-1080p-10s' : 'wan26-720p-10s';
        return needHD ? 'wan26-1080p-5s' : 'wan26-720p-5s';
    }

    // 暴露给外部使用（agent-team.js等）
    window._selectVideoModel = selectVideoModel;

    // ==================== 🧠 智能分析辅助函数 ====================

    /** 检测配音场景 */
    function _detectScene(text) {
        const t = text.toLowerCase();
        if (/\[.{1,10}\]/.test(text) && (text.match(/\[/g) || []).length >= 3) return 'story';
        if (/广告|推广|产品|品牌|促销|买|优惠/.test(t)) return 'ad';
        if (/课程|教学|知识|科普|讲解|播客/.test(t)) return 'education';
        if (/活泼|搞笑|有趣|开心|快乐|咕咕|短视频/.test(t)) return 'lively';
        if (/小说|故事|角色|对话|广播剧|旁白/.test(t)) return 'story';
        return 'narration';
    }

    /** 检测音乐用途 */
    function _detectMusicPurpose(desc) {
        const d = (desc || '').toLowerCase();
        if (/bgm|背景音乐|配乐|视频|短视频|宣传片/.test(d)) return 'bgm';
        if (/歌曲|歌词|唱|人声|唱歌|原创歌/.test(d)) return 'song';
        if (/放松|冥想|睡眠|白噪音|自然|氛围/.test(d)) return 'ambient';
        if (/游戏|动画|像素|战斗|冒险/.test(d)) return 'game';
        if (/品牌|广告|企业|商业|营销/.test(d)) return 'brand';
        return 'bgm';
    }

    /** 智能生成音乐风格标签 */
    function _generateMusicTags(desc, purpose) {
        const d = (desc || '').toLowerCase();
        const tags = [];

        // 基于用途的基础标签
        const purposeTags = {
            bgm: ['instrumental', 'background'],
            song: ['vocal', 'pop'],
            ambient: ['ambient', 'calm', 'instrumental'],
            game: ['electronic', 'cinematic', 'instrumental'],
            brand: ['corporate', 'uplifting', 'instrumental']
        };
        if (purposeTags[purpose]) tags.push(...purposeTags[purpose]);

        // 基于描述的风格检测
        if (/中国风|国风|古典|古风|水墨|民乐/.test(d)) tags.push('chinese folk', 'traditional');
        if (/电子|电音|edm|dj|蹦迪/.test(d)) tags.push('electronic', 'synth');
        if (/摇滚|rock|吱他/.test(d)) tags.push('rock', 'guitar');
        if (/嘴士|jazz|慰意/.test(d)) tags.push('jazz', 'smooth');
        if (/说唱|rap|嘴哈/.test(d)) tags.push('hip-hop', 'rap');
        if (/史诗|宏大|壮丽|史诗感/.test(d)) tags.push('cinematic', 'epic', 'orchestral');
        if (/轻快|欢快|活泼|开心/.test(d)) tags.push('upbeat', 'happy');
        if (/悲伤|伤感|忧郁|淮思/.test(d)) tags.push('sad', 'emotional', 'piano');
        if (/美食|美食探店|烹饪/.test(d)) tags.push('upbeat', 'fun', 'acoustic');
        if (/科幻|未来|太空/.test(d)) tags.push('sci-fi', 'electronic', 'cinematic');
        if (/浪漫|爱情|温骊/.test(d)) tags.push('romantic', 'soft', 'piano');

        // 去重，限制标签数量
        const unique = [...new Set(tags)];
        return unique.slice(0, 6).join(', ') || 'pop, melodic';
    }

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
                            { value: 'watercolor', label: '🎨 水彩插画' },
                            { value: 'cyberpunk', label: '🌃 赛博朋克' },
                            { value: 'retro', label: '📺 复古怀旧' },
                            { value: 'comic', label: '💥 美式漫画' },
                            { value: 'pixel', label: '🎮 像素艺术' },
                            { value: 'vintage', label: '📷 老照片风格' },
                            { value: 'studio', label: '🎬 工作室质感' },
                            { value: 'documentary', label: '🎥 纪录片风格' }
                        ]
                    },
                    {
                        key: 'aspectRatio',
                        label: '视频比例',
                        type: 'select',
                        default: '16:9',
                        options: [
                            { value: '16:9', label: '16:9 横屏（推荐）' },
                            { value: '9:16', label: '9:16 竖屏（抖音/快手）' },
                            { value: '1:1', label: '1:1 方形（Instagram）' },
                            { value: '4:3', label: '4:3 传统电视' },
                            { value: '3:4', label: '3:4 小红书' },
                            { value: '21:9', label: '21:9 宽银幕电影' }
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
                        key: 'aspectRatio',
                        label: '视频比例',
                        type: 'select',
                        default: '16:9',
                        options: [
                            { value: '16:9', label: '16:9 横屏（推荐）' },
                            { value: '9:16', label: '9:16 竖屏（抖音/快手）' },
                            { value: '1:1', label: '1:1 方形（Instagram）' },
                            { value: '4:3', label: '4:3 传统电视' },
                            { value: '3:4', label: '3:4 小红书' },
                            { value: '21:9', label: '21:9 宽银幕电影' }
                        ]
                    },
                    {
                        key: 'videoModel',
                        label: '视频模型',
                        type: 'select',
                        default: 'wan26-720p-5s',
                        options: VIDEO_MODEL_OPTIONS
                    },
                    {
                        key: 'imageModel',
                        label: '生图模型',
                        type: 'select',
                        default: 'nano-banana-2',
                        options: IMAGE_MODEL_OPTIONS
                    },
                    {
                        key: 'styleRef',
                        label: '风格参考图（可选）',
                        type: 'image',
                        hint: '上传参考图，视频画面将模仿该风格'
                    }
                ],
                estimateCost: (params) => {
                    const count = params.count || 3;
                    const duration = parseInt(params.duration) || 15;

                    const imgFilm = calculateImageCost(params.imageModel);
                    const videoFilm = calculateVideoCost(params.videoModel, duration);

                    const perVideo = 1 + imgFilm + videoFilm;
                    const totalFilm = Math.ceil(count * perVideo);
                    const timePerVideo = duration <= 10 ? 2 : 3;

                    return {
                        film: totalFilm,
                        time: `约 ${count * timePerVideo} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { topic, count, style, aspectRatio, styleRef, imageModel } = params;
                    const duration = params.duration || 5;
                    // 🎬 智能选择视频模型：根据时长/内容/清晰度需求自动推断
                    const videoModel = selectVideoModel({ preferred: params.videoModel, topic, duration, needHD: params.videoModel?.includes('1080p') });
                    // 🖼️ 解析参考图（支持多图）
                    const refs = await resolveRefImages(styleRef);
                    const userRefImage = refs.first;
                    const allRefImages = refs.all;

                    const stylePrompts = {
                        anime: 'Japanese anime style, vibrant colors, cel-shaded',
                        realistic: 'photorealistic, cinematic lighting, detailed',
                        chinese: 'Chinese traditional style, ink painting influence',
                        '3d': '3D rendered, Pixar style, high quality CGI',
                        watercolor: 'watercolor painting, soft colors, artistic',
                        cyberpunk: 'cyberpunk style, neon lights, futuristic city, high contrast',
                        retro: 'retro 80s/90s style, vintage aesthetic, film grain',
                        comic: 'American comic style, bold lines, vibrant colors',
                        pixel: 'pixel art, retro game style, 8-bit/16-bit aesthetic',
                        vintage: 'vintage photo style, film grain, warm tones, nostalgic',
                        studio: 'studio photography, professional lighting, clean composition',
                        documentary: 'documentary style, realistic, handheld camera feel'
                    };

                    // 🎨 一致性策略：无参考图时，先生成第1张图作为风格参考
                    let _autoRef = userRefImage;
                    if (!_autoRef && count > 1) {
                        callbacks.onProgress?.('生成风格基准', 3, '先生成第1张图片作为风格参考...');
                        try {
                            const _seedPrompt = `${stylePrompts[style] || ''}, ${topic}, establishing shot, high quality, ${aspectRatio} aspect ratio`;
                            _autoRef = await callImageAPIWithRefs(_seedPrompt, { aspectRatio, imageModel }, allRefImages);
                            callbacks.onStepComplete?.('风格基准图', { imageUrl: _autoRef });
                        } catch (e) { console.warn('风格基准图生成失败, 继续无参考生成:', e.message); }
                    }

                    callbacks.onProgress?.('并行生成', 5, `同时生成 ${count} 个视频...`);
                    let _vDone = 0;
                    const results = await Promise.all(Array.from({ length: count }, (_, i) => (async () => {
                        try {
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
                            } else { throw new Error('文本生成功能不可用'); }
                            callbacks.onStepComplete?.(`视频${i + 1} 剧本`, { script: script.substring(0, 100) + '...' });

                            const imagePrompt = `${stylePrompts[style] || ''}, ${script.substring(0, 200)}, high quality, ${aspectRatio} aspect ratio`;
                            const imgOpts = { aspectRatio, imageModel };
                            if (_autoRef) imgOpts.refImage = _autoRef;
                            const imageUrl = await callImageAPIWithRefs(imagePrompt, imgOpts, allRefImages);
                            callbacks.onStepComplete?.(`视频${i + 1} 封面图`, { imageUrl });

                            let videoUrl = '';
                            const videoPrompt = script.substring(0, 500);
                            if (videoModel && String(videoModel).toLowerCase().includes('modelscope')) {
                                if (imageUrl && typeof callModelScopeImageToVideoAPI === 'function') {
                                    videoUrl = await callModelScopeImageToVideoAPI(videoPrompt, imageUrl, { duration: parseInt(duration), aspectRatio, model: videoModel });
                                } else if (typeof callModelScopeVideoAPI === 'function') {
                                    videoUrl = await callModelScopeVideoAPI(videoPrompt, { duration: parseInt(duration), aspectRatio, model: videoModel });
                                }
                            } else if (imageUrl && typeof callSora2ImageToVideoAPI === 'function') {
                                videoUrl = await callSora2ImageToVideoAPI(imageUrl, videoPrompt, { model: videoModel, duration: parseInt(duration), aspectRatio });
                            } else if (typeof callSora2TextToVideoAPI === 'function') {
                                videoUrl = await callSora2TextToVideoAPI(videoPrompt, { model: videoModel, duration: parseInt(duration), aspectRatio });
                            }
                            callbacks.onStepComplete?.(`视频${i + 1} 完成`, { videoUrl });

                            _vDone++;
                            callbacks.onProgress?.(`已完成 ${_vDone}/${count}`, Math.round((_vDone / count) * 95) + 5, `✅ 视频${i + 1}`);
                            return { index: i + 1, script, imageUrl, videoUrl, status: 'success' };
                        } catch (error) {
                            console.error(`视频 ${i + 1} 生成失败:`, error);
                            _vDone++;
                            callbacks.onProgress?.(`已完成 ${_vDone}/${count}`, Math.round((_vDone / count) * 95) + 5, `❌ 视频${i + 1}`);
                            return { index: i + 1, error: error.message, status: 'failed' };
                        }
                    })()));
                    results.sort((a, b) => a.index - b.index);

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
                            { value: 'chinese', label: '🏮 国风古典' },
                            { value: '3d', label: '🎮 3D 渲染' },
                            { value: 'watercolor', label: '🎨 水彩插画' },
                            { value: 'cyberpunk', label: '🌃 赛博朋克' },
                            { value: 'retro', label: '📺 复古怀旧' },
                            { value: 'comic', label: '💥 美式漫画' },
                            { value: 'pixel', label: '🎮 像素艺术' },
                            { value: 'vintage', label: '📷 老照片风格' },
                            { value: 'studio', label: '🎬 工作室质感' },
                            { value: 'documentary', label: '🎥 纪录片风格' }
                        ]
                    },
                    {
                        key: 'aspectRatio',
                        label: '视频比例',
                        type: 'select',
                        default: '16:9',
                        options: [
                            { value: '16:9', label: '16:9 横屏（推荐）' },
                            { value: '9:16', label: '9:16 竖屏（抖音/快手）' },
                            { value: '1:1', label: '1:1 方形（Instagram）' },
                            { value: '4:3', label: '4:3 传统电视' },
                            { value: '3:4', label: '3:4 小红书' },
                            { value: '21:9', label: '21:9 宽银幕电影' }
                        ]
                    },
                    {
                        key: 'videoModel',
                        label: '视频模型',
                        type: 'select',
                        default: 'wan26-720p-5s',
                        options: VIDEO_MODEL_OPTIONS
                    }
                ],
                estimateCost: (params) => {
                    const episodes = params.episodes || 3;
                    const videoFilm = calculateVideoCost(params.videoModel, 15);
                    const imgFilm = calculateImageCost(params.imageModel || 'nano-banana-2');
                    // 每集: 文本1 + 图片5 + 视频
                    return {
                        film: Math.ceil(episodes * (1 + imgFilm + videoFilm)),
                        time: `约 ${episodes * 3} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { story, episodes, style, aspectRatio } = params;
                    // 从 videoModel 名称中提取时长（如 wan26-720p-5s → 5）
                    const _vmMatch = (params.videoModel || '').match(/(\d+)s/);
                    const segDuration = _vmMatch ? parseInt(_vmMatch[1]) : 15;
                    // 🔒 全程锁定同一模型，避免各段视觉差异
                    const videoModel = selectVideoModel({ preferred: params.videoModel, topic: story, duration: segDuration });
                    const totalDuration = episodes * segDuration;
                    const results = [];

                    // ═══ 阶段0: 全局风格锚定 ═══
                    const styleMap = {
                        anime: 'anime style, Japanese animation, cel-shaded, vibrant colors',
                        realistic: 'cinematic photorealistic, professional color grading, shallow depth of field, anamorphic lens',
                        chinese: 'Chinese traditional ink painting style, elegant brushwork, muted earthy tones',
                        '3d': '3D rendered, Pixar-quality CGI, global illumination, subsurface scattering',
                        watercolor: 'watercolor painting, soft bleeding edges, muted pastels, artistic',
                        cyberpunk: 'cyberpunk neon aesthetic, high contrast, rain-slicked streets, holographic UI',
                        retro: 'retro 80s/90s VHS aesthetic, film grain, warm color cast, soft glow',
                        comic: 'American comic book style, bold ink outlines, halftone dots, dynamic poses',
                        pixel: 'pixel art, retro 16-bit game style, limited palette, crisp edges',
                        vintage: 'vintage film photography, kodachrome colors, natural grain, warm highlights',
                        studio: 'studio photography, controlled lighting, clean backdrop, commercial quality',
                        documentary: 'documentary cinematography, natural light, handheld subtle movement, raw authentic'
                    };
                    const globalStyle = styleMap[style] || 'cinematic, high quality';

                    // ═══ 阶段1: 生成连贯分镜大纲 ═══
                    callbacks.onProgress?.('规划分镜', 3, `正在规划 ${episodes} 个连贯片段（每段${segDuration}秒，共${totalDuration}秒）...`);

                    const outlinePrompt = `You are a professional storyboard director. Break the following concept into exactly ${episodes} sequential video segments, each about ${segDuration} seconds long.

CONCEPT: ${story}
VISUAL STYLE: ${globalStyle}
TOTAL DURATION: ${totalDuration} seconds

CRITICAL RULES for CONSISTENCY:
1. All segments MUST share the same subject/character, setting, color palette, and lighting direction
2. Describe the SAME main subject in every segment (e.g. if it's a car ad, the SAME car model appears in every shot)
3. Each segment must visually CONNECT to the next: the ending frame of segment N should logically lead into segment N+1
4. Use consistent camera language (e.g. if segment 1 uses cinematic wide shots, don't suddenly switch to handheld)
5. Include specific visual anchors that repeat across segments (a color, an object, a setting element)

FORMAT for each segment — be SPECIFIC about:
- Camera angle and movement (e.g. "slow dolly forward", "aerial tracking shot", "close-up rack focus")
- Subject action and position (e.g. "silver sedan drifting through corner, tires smoking")
- Lighting and atmosphere (e.g. "golden hour backlight, lens flare", "moody blue-toned fog")
- Transition hint to next segment (e.g. "camera pushes into headlight, transitioning to...")

Output EXACTLY in this format:
片段1：[detailed English scene description]
片段2：[detailed English scene description]
...
片段${episodes}：[detailed English scene description]`;

                    let outline = '';
                    if (typeof callScriptGenerator === 'function') {
                        outline = await callScriptGenerator({}, outlinePrompt);
                    }

                    callbacks.onStepComplete?.('分镜规划', { outline: outline.substring(0, 300) + '...' });

                    // 解析片段 + 数量兜底
                    let segments = outline.split(/片段\d+[：:]/i).filter(s => s.trim());
                    // 如果LLM输出的片段不够，复制最后一个片段并加变体描述
                    while (segments.length < episodes) {
                        const lastSeg = segments[segments.length - 1] || story;
                        segments.push(`continuation of previous scene, ${lastSeg.substring(0, 200)}, slightly different camera angle`);
                    }

                    // ═══ 阶段2: 生成风格锚定基准图 ═══
                    callbacks.onProgress?.('锚定风格', 8, '生成风格基准图，确保全片视觉一致...');
                    let styleAnchorUrl = '';
                    try {
                        const anchorPrompt = `${globalStyle}, ${segments[0].substring(0, 300)}, establishing shot, ${aspectRatio} aspect ratio, masterpiece, best quality`;
                        styleAnchorUrl = await callImageAPIWithRefs(anchorPrompt, { aspectRatio }, []);
                        callbacks.onStepComplete?.('风格锚定', { imageUrl: styleAnchorUrl });
                    } catch (e) { console.warn('[连续视频] 风格锚定图生成失败:', e.message); }

                    let lastImageUrl = styleAnchorUrl;

                    // ═══ 阶段3: 流水线并行生成（图片+视频） ═══
                    // 策略：视频[i]生成时同时生成图片[i+1]，大幅减少总等待时间
                    // 辅助函数：生成单段图片
                    async function _genImage(idx) {
                        const seg = segments[idx]?.trim() || `第${idx + 1}幕`;
                        const imgPrompt = `${globalStyle}, ${seg.substring(0, 300)}, consistent with previous scenes, same subject and color palette, ${aspectRatio} aspect ratio`;
                        const opts = { aspectRatio };
                        const refs = [];
                        if (styleAnchorUrl) refs.push(styleAnchorUrl);
                        if (lastImageUrl && lastImageUrl !== styleAnchorUrl) refs.push(lastImageUrl);
                        if (refs.length > 0) opts.refImage = refs[0];
                        return await callImageAPIWithRefs(imgPrompt, opts, refs);
                    }
                    // 辅助函数：生成单段视频
                    async function _genVideo(idx, imgUrl) {
                        let vParts = [globalStyle];
                        if (idx > 0 && segments[idx - 1]) vParts.push(`continuing from: ${segments[idx - 1].substring(0, 80)}`);
                        vParts.push((segments[idx] || '').substring(0, 350));
                        if (idx < episodes - 1 && segments[idx + 1]) vParts.push(`transitioning towards: ${segments[idx + 1].substring(0, 60)}`);
                        const vPrompt = vParts.join('. ');
                        if (videoModel && String(videoModel).toLowerCase().includes('modelscope')) {
                            if (imgUrl && typeof callModelScopeImageToVideoAPI === 'function') {
                                return await callModelScopeImageToVideoAPI(vPrompt, imgUrl, { duration: segDuration, aspectRatio, model: videoModel });
                            } else if (typeof callModelScopeVideoAPI === 'function') {
                                return await callModelScopeVideoAPI(vPrompt, { duration: segDuration, aspectRatio, model: videoModel });
                            }
                        } else if (imgUrl && typeof callSora2ImageToVideoAPI === 'function') {
                            return await callSora2ImageToVideoAPI(imgUrl, vPrompt, { model: videoModel, duration: segDuration, aspectRatio });
                        }
                        return '';
                    }

                    // 流水线：视频[i] 与 图片[i+1] 并行
                    let pendingVideo = null; // { promise, idx, imageUrl }
                    for (let i = 0; i < episodes; i++) {
                        if (callbacks.isCancelled?.()) break;

                        const segment = segments[i]?.trim() || `第${i + 1}幕`;
                        const progress = 10 + Math.round((i / episodes) * 85);
                        callbacks.onProgress?.(`生成片段 ${i + 1}/${episodes}`, progress, `正在创作第 ${i + 1} 段（${segDuration}秒）...`);

                        try {
                            // 🖼️ 生成本段图片（如果上一轮已预取则直接用）
                            let imageUrl = '';
                            if (pendingVideo && pendingVideo._nextImage) {
                                // 上一轮流水线已预取本段图片
                                imageUrl = await pendingVideo._nextImage;
                            } else {
                                imageUrl = await _genImage(i);
                            }
                            lastImageUrl = imageUrl;

                            // 🎬 启动本段视频生成（不立即 await）
                            const videoPromise = _genVideo(i, imageUrl);

                            // ⚡ 流水线：同时预取下一段图片
                            let nextImagePromise = null;
                            if (i + 1 < episodes && !callbacks.isCancelled?.()) {
                                nextImagePromise = _genImage(i + 1).catch(e => {
                                    console.warn(`[连续视频] 预取片段${i + 2}图片失败:`, e.message);
                                    return '';
                                });
                            }

                            // 等待上一段视频完成（如果有）
                            if (pendingVideo) {
                                try {
                                    const prevVideoUrl = await pendingVideo.promise;
                                    callbacks.onStepComplete?.(`第${pendingVideo.idx + 1}段`, { videoUrl: prevVideoUrl, imageUrl: pendingVideo.imageUrl });
                                    results.push({ episode: pendingVideo.idx + 1, script: segments[pendingVideo.idx], imageUrl: pendingVideo.imageUrl, videoUrl: prevVideoUrl, status: 'success' });
                                } catch (prevErr) {
                                    console.error(`[连续视频] 片段${pendingVideo.idx + 1}视频失败:`, prevErr);
                                    results.push({ episode: pendingVideo.idx + 1, error: prevErr.message, status: 'failed' });
                                }
                            }

                            // 记录本段视频 Promise + 下一段图片预取
                            pendingVideo = { promise: videoPromise, idx: i, imageUrl, _nextImage: nextImagePromise };

                        } catch (error) {
                            console.error(`[连续视频] 片段${i + 1}生成失败:`, error);
                            // 先收回上一段未完成的视频
                            if (pendingVideo) {
                                try {
                                    const pv = await pendingVideo.promise;
                                    results.push({ episode: pendingVideo.idx + 1, script: segments[pendingVideo.idx], imageUrl: pendingVideo.imageUrl, videoUrl: pv, status: 'success' });
                                } catch (e2) {
                                    results.push({ episode: pendingVideo.idx + 1, error: e2.message, status: 'failed' });
                                }
                                pendingVideo = null;
                            }
                            results.push({ episode: i + 1, error: error.message, status: 'failed' });
                        }
                    }
                    // 收回最后一段视频
                    if (pendingVideo) {
                        try {
                            const lastVideoUrl = await pendingVideo.promise;
                            callbacks.onStepComplete?.(`第${pendingVideo.idx + 1}段`, { videoUrl: lastVideoUrl, imageUrl: pendingVideo.imageUrl });
                            results.push({ episode: pendingVideo.idx + 1, script: segments[pendingVideo.idx], imageUrl: pendingVideo.imageUrl, videoUrl: lastVideoUrl, status: 'success' });
                        } catch (e) {
                            results.push({ episode: pendingVideo.idx + 1, error: e.message, status: 'failed' });
                        }
                    }

                    callbacks.onProgress?.('完成', 100, `成功生成 ${results.filter(r => r.status === 'success').length}/${episodes} 段`);

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
                    },
                    {
                        key: 'videoModel',
                        label: '视频模型',
                        type: 'select',
                        default: 'wan26-720p-5s',
                        options: VIDEO_MODEL_OPTIONS
                    }
                ],
                estimateCost: (params) => {
                    const imageCount = params.images?.length || 1;
                    const duration = parseInt(params.duration) || 5;
                    const videoFilm = calculateVideoCost(params.videoModel, duration);
                    return {
                        film: Math.ceil(imageCount * videoFilm),
                        time: `约 ${imageCount * 2} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { images, motion, duration, aspectRatio } = params;
                    const videoModel = selectVideoModel({ preferred: params.videoModel, duration: parseInt(duration) || 5 });
                    if (!images || images.length === 0) {
                        throw new Error('请上传至少一张图片');
                    }

                    const motionPrompts = {
                        natural: 'natural movement, subtle animation, breathing effect',
                        zoom: 'slow zoom in, cinematic camera movement',
                        pan: 'smooth horizontal pan, tracking shot',
                        dramatic: 'dramatic action, dynamic movement'
                    };

                    callbacks.onProgress?.('并行生成', 5, `同时处理 ${images.length} 张图片...`);
                    let _i2vDone = 0;
                    const results = await Promise.all(Array.from(images).map((file, i) => (async () => {
                        try {
                            let imageUrl = '';
                            if (typeof file === 'string') {
                                imageUrl = file;
                            } else {
                                imageUrl = await new Promise((resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.onload = () => resolve(reader.result);
                                    reader.onerror = reject;
                                    reader.readAsDataURL(file);
                                });
                            }
                            const prompt = `${motionPrompts[motion]}, animate this image with ${motion} effect`;
                            let videoUrl = '';
                            if (videoModel && String(videoModel).toLowerCase().includes('modelscope')) {
                                if (typeof callModelScopeImageToVideoAPI === 'function') {
                                    videoUrl = await callModelScopeImageToVideoAPI(prompt, imageUrl, { duration: parseInt(duration), aspectRatio, model: videoModel });
                                }
                            } else if (typeof callSora2ImageToVideoAPI === 'function') {
                                videoUrl = await callSora2ImageToVideoAPI(imageUrl, prompt, { model: videoModel, duration: parseInt(duration), aspectRatio });
                            }
                            _i2vDone++;
                            callbacks.onProgress?.(`已完成 ${_i2vDone}/${images.length}`, Math.round((_i2vDone / images.length) * 95) + 5, `✅ 图片${i + 1}`);
                            callbacks.onStepComplete?.(`图片${i + 1}`, { videoUrl });
                            return { index: i + 1, fileName: file.name, videoUrl, status: 'success' };
                        } catch (error) {
                            _i2vDone++;
                            callbacks.onProgress?.(`已完成 ${_i2vDone}/${images.length}`, Math.round((_i2vDone / images.length) * 95) + 5, `❌ 图片${i + 1}`);
                            return { index: i + 1, error: error.message, status: 'failed' };
                        }
                    })()));
                    results.sort((a, b) => a.index - b.index);

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
                            { value: '4:3', label: '4:3 横版标准' },
                            { value: '3:4', label: '3:4 竖版标准' }
                        ]
                    },
                    {
                        key: 'imageModel',
                        label: '生图模型',
                        type: 'select',
                        default: 'nano-banana-2',
                        options: IMAGE_MODEL_OPTIONS
                    }
                ],
                estimateCost: (params) => {
                    const subjects = (params.subjects || '').split('\n').filter(s => s.trim());
                    const count = Math.max(subjects.length, 1);
                    const imgFilm = calculateImageCost(params.imageModel);
                    return {
                        film: count * imgFilm,
                        time: `约 ${Math.ceil(count * (params.imageModel?.startsWith('midjourney') ? 1.5 : 0.5))} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { styleRef, styleDesc, subjects, aspectRatio, imageModel } = params;
                    const subjectList = subjects.split('\n').filter(s => s.trim());

                    // 🖼️ 解析参考图（支持多图）
                    const refs = await resolveRefImages(styleRef);
                    const refImageUrl = refs.first;
                    const allRefImages = refs.all;

                    // 🎨 一致性策略：无参考图时，先生成第1张图作为风格基准
                    let _styleRef = refImageUrl;
                    if (!_styleRef && subjectList.length > 1) {
                        callbacks.onProgress?.('生成风格基准', 3, '先生成第1张图片确定风格...');
                        try {
                            const _firstPrompt = `${styleDesc} style, ${subjectList[0].trim()}, high quality, detailed, consistent art style`;
                            _styleRef = await callImageAPIWithRefs(_firstPrompt, { aspectRatio, imageModel }, allRefImages);
                            callbacks.onStepComplete?.('风格基准图', { imageUrl: _styleRef });
                        } catch (e) { console.warn('风格基准图失败:', e.message); }
                    }

                    callbacks.onProgress?.('并行生成', 5, `同时生成 ${subjectList.length} 张图片...`);

                    // 🚀 并行生成所有图片（已有基准的第1张会复用缓存）
                    let completedCount = 0;
                    const promises = subjectList.map((subject, i) => {
                        const trimmed = subject.trim();
                        const prompt = `${styleDesc} style, ${trimmed}, high quality, detailed, consistent art style`;
                        const imgOpts = { aspectRatio, imageModel };
                        if (_styleRef) imgOpts.refImage = _styleRef;

                        // 第1张已作为基准图生成过，直接复用
                        if (i === 0 && _styleRef && !refImageUrl) {
                            completedCount++;
                            callbacks.onProgress?.(`已完成 1/${subjectList.length}`, 10, `✅ ${trimmed}`);
                            callbacks.onStepComplete?.(trimmed, { imageUrl: _styleRef });
                            return Promise.resolve({ subject: trimmed, imageUrl: _styleRef, status: 'success' });
                        }

                        return callImageAPIWithRefs(prompt, imgOpts, allRefImages)
                            .then(imageUrl => {
                                completedCount++;
                                const progress = Math.round((completedCount / subjectList.length) * 95) + 5;
                                callbacks.onProgress?.(`已完成 ${completedCount}/${subjectList.length}`, progress, `✅ ${trimmed}`);
                                callbacks.onStepComplete?.(trimmed, { imageUrl });
                                return { subject: trimmed, imageUrl, status: 'success' };
                            })
                            .catch(error => {
                                completedCount++;
                                const progress = Math.round((completedCount / subjectList.length) * 95) + 5;
                                callbacks.onProgress?.(`已完成 ${completedCount}/${subjectList.length}`, progress, `❌ ${trimmed}: ${error.message}`);
                                return { subject: trimmed, error: error.message, status: 'failed' };
                            });
                    });

                    const results = await Promise.all(promises);

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
                        key: 'aspectRatio',
                        label: '图片比例',
                        type: 'select',
                        default: '16:9',
                        options: [
                            { value: '16:9', label: '16:9 横版' },
                            { value: '4:3', label: '4:3 标准' },
                            { value: '1:1', label: '1:1 方形' },
                            { value: '3:4', label: '3:4 竖版' },
                            { value: '9:16', label: '9:16 手机竖屏' }
                        ]
                    },
                    {
                        key: 'charRefImage',
                        label: '角色参考图（可选）',
                        type: 'image',
                        hint: '上传已有角色草稿或参考图，生成结果将保持一致'
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
                    },
                    {
                        key: 'imageModel',
                        label: '生图模型',
                        type: 'select',
                        default: 'nano-banana-2',
                        options: IMAGE_MODEL_OPTIONS
                    }
                ],
                estimateCost: (params) => {
                    let count = 2; // 基础：三视图 + 设定海报
                    if (params.includeExpressions) count += 1;
                    if (params.includeActions) count += 1;
                    const imgFilm = calculateImageCost(params.imageModel);
                    return {
                        film: Math.ceil(count * imgFilm) + 1, // +1文本
                        time: `约 ${count} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { name, description, style, aspectRatio, charRefImage, includeExpressions, includeActions } = params;
                    const charAspectRatio = aspectRatio || '16:9';
                    const results = {};

                    // 🖼️ 解析角色参考图（支持多图）
                    const charRefs = await resolveRefImages(charRefImage);
                    let charRef = charRefs.first;
                    const allCharRefImages = charRefs.all;

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
                            const opts = { aspectRatio: charAspectRatio };
                            if (charRef) opts.refImage = charRef;
                            results.turnaround = await callBanana2ImageAPI(turnaroundPrompt, opts);
                        }
                        // 首张生成图作为后续参考（保持角色一致性）
                        if (!charRef && results.turnaround) charRef = results.turnaround;

                        callbacks.onStepComplete?.('三视图', { url: results.turnaround });
                    } catch (e) {
                        console.error('三视图生成失败:', e);
                    }

                    // 2-4. 并行生成海报+表情包+动作参考
                    const charTasks = [];
                    charTasks.push({ key: 'poster', name: '设定海报', prompt: `${baseStyle}, character design poster, ${name}, ${description}, clothing details, color palette, accessories, full body pose, professional character sheet` });
                    if (includeExpressions) charTasks.push({ key: 'expressions', name: '表情包', prompt: `${baseStyle}, expression sheet, ${name}, ${description}, 6 different expressions: happy, sad, angry, surprised, shy, confident, portrait close-up, white background, grid layout` });
                    if (includeActions) charTasks.push({ key: 'actions', name: '动作参考', prompt: `${baseStyle}, action pose sheet, ${name}, ${description}, 4 dynamic poses: standing, running, fighting, sitting, full body, white background, action reference` });

                    callbacks.onProgress?.('并行生成', 30, `同时生成 ${charTasks.length} 项角色素材...`);
                    let _chDone = 0;
                    await Promise.all(charTasks.map(task => {
                        const opts = { aspectRatio: charAspectRatio };
                        if (charRef) opts.refImage = charRef;
                        return callImageAPIWithRefs(task.prompt, opts, allCharRefImages)
                            .then(url => {
                                results[task.key] = url;
                                _chDone++;
                                callbacks.onProgress?.(`已完成 ${_chDone}/${charTasks.length}`, 30 + Math.round((_chDone / charTasks.length) * 65), `✅ ${task.name}`);
                                callbacks.onStepComplete?.(task.name, { url });
                            })
                            .catch(e => {
                                _chDone++;
                                console.error(`${task.name}生成失败:`, e);
                                callbacks.onProgress?.(`已完成 ${_chDone}/${charTasks.length}`, 30 + Math.round((_chDone / charTasks.length) * 65), `❌ ${task.name}`);
                            });
                    }));

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
                        key: 'styleRef',
                        label: '风格参考图（可选）',
                        type: 'image',
                        hint: '上传角色或画风参考图，漫画风格将基于此生成'
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
                    },
                    {
                        key: 'aspectRatio',
                        label: '页面比例',
                        type: 'select',
                        default: '9:16',
                        options: [
                            { value: '9:16', label: '9:16 条漫竖屏' },
                            { value: '3:4', label: '3:4 竖版' },
                            { value: '4:3', label: '4:3 横版' },
                            { value: '1:1', label: '1:1 方形' },
                            { value: '16:9', label: '16:9 横屏' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    const pages = params.pageCount || 4;
                    return {
                        film: Math.ceil(pages * 5) + 1, // 5胶片/页 + 文本1
                        time: `约 ${pages} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { story, styleRef, pageCount, style, panelsPerPage, aspectRatio } = params;
                    const comicAspectRatio = aspectRatio || '9:16';

                    // 🖼️ 解析参考图（支持多图）
                    const comicRefs = await resolveRefImages(styleRef);
                    let comicRef = comicRefs.first;
                    const allComicRefImages = comicRefs.all;

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

                    // 🎨 一致性策略：无参考图时，先生成第1页作为风格基准
                    if (!comicRef && pageCount > 1) {
                        callbacks.onProgress?.('生成风格基准', 8, '先生成第1页确定漫画风格...');
                        try {
                            const _firstPanels = panelDescriptions.slice(0, parseInt(panelsPerPage)).join('; ');
                            const _firstPrompt = `${styleMap[style]}, comic page, ${parseInt(panelsPerPage)} panels layout, sequential art, ${_firstPanels}`;
                            comicRef = await callImageAPIWithRefs(_firstPrompt, { aspectRatio: comicAspectRatio }, allComicRefImages);
                            callbacks.onStepComplete?.('风格基准页', { imageUrl: comicRef });
                        } catch (e) { console.warn('风格基准页失败:', e.message); }
                    }

                    // 并行生成每页
                    callbacks.onProgress?.('并行生成', 10, `同时生成 ${pageCount} 页漫画...`);
                    let _cDone = 0;
                    const results = await Promise.all(Array.from({ length: pageCount }, (_, page) => {
                        const startPanel = page * parseInt(panelsPerPage);
                        const pagePanels = panelDescriptions.slice(startPanel, startPanel + parseInt(panelsPerPage));
                        const panelDesc = pagePanels.join('; ');
                        const pagePrompt = `${styleMap[style]}, comic page, ${parseInt(panelsPerPage)} panels layout, sequential art, ${panelDesc}`;
                        const opts = { aspectRatio: comicAspectRatio };
                        if (comicRef) opts.refImage = comicRef;
                        return callImageAPIWithRefs(pagePrompt, opts, allComicRefImages)
                            .then(imageUrl => {
                                _cDone++;
                                callbacks.onProgress?.(`已完成 ${_cDone}/${pageCount}`, 10 + Math.round((_cDone / pageCount) * 85), `✅ 第${page + 1}页`);
                                callbacks.onStepComplete?.(`第${page + 1}页`, { imageUrl });
                                return { page: page + 1, panels: pagePanels, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _cDone++;
                                callbacks.onProgress?.(`已完成 ${_cDone}/${pageCount}`, 10 + Math.round((_cDone / pageCount) * 85), `❌ 第${page + 1}页`);
                                return { page: page + 1, error: e.message, status: 'failed' };
                            });
                    }));

                    callbacks.onProgress?.('完成', 100, `成功生成 ${results.filter(r => r.status === 'success').length}/${pageCount} 页漫画`);

                    return { pages: results };
                }
            },

            // ==================== 音频类 ====================

            // 7. AI智能配音
            {
                id: 'ai_dubbing',
                name: 'AI智能配音',
                icon: '🎙️',
                category: 'audio',
                description: '输入文本，AI 自动分析内容类型，智能选择最佳音色、语速、引擎。支持旁白、对话、多角色自动分段配音。',
                parameters: [
                    {
                        key: 'text',
                        label: '配音文本',
                        type: 'textarea',
                        required: true,
                        placeholder: '输入要配音的文字内容...\n\u2022 纯旁白：直接输入文字\n\u2022 多角色：用 [角色名] 标记，如 [旁白] [小明] [小红]',
                        hint: '支持自动识别角色对话，每段不超过500字'
                    },
                    {
                        key: 'scene',
                        label: '场景描述（可选）',
                        type: 'select',
                        default: 'auto',
                        options: [
                            { value: 'auto', label: '🧠 AI 自动判断' },
                            { value: 'narration', label: '🎥 视频旁白 / 纪录片' },
                            { value: 'story', label: '📖 有声小说 / 广播剧' },
                            { value: 'ad', label: '📢 广告 / 产品介绍' },
                            { value: 'education', label: '🎓 教育课程 / 播客' },
                            { value: 'lively', label: '🎉 活泼活力 / 短视频' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    // 智能估算：检测多角色标记
                    const text = params.text || '';
                    const roleMatches = text.match(/\[.{1,10}\]/g);
                    const segments = roleMatches ? new Set(roleMatches).size : 1;
                    const totalSegments = roleMatches ? roleMatches.length : 1;
                    // 多角色用高质量引擎，单角色用快速引擎
                    const costPerSegment = segments > 1 ? 1 : 1;
                    return {
                        film: Math.max(1, totalSegments * costPerSegment),
                        time: totalSegments > 3 ? `约 ${totalSegments * 8} 秒` : '约 10-30 秒'
                    };
                },
                execute: async (params, callbacks) => {
                    const { text, scene } = params;
                    if (typeof callTTSAPI !== 'function') throw new Error('TTS功能不可用');

                    // 🧠 Step 1: 智能分析文本内容
                    callbacks.onProgress?.('分析文本', 5, 'AI 正在分析文本内容...');

                    // 角色分段检测：[角色名] 文本内容
                    const rolePattern = /\[(.{1,10})\]\s*([\s\S]*?)(?=\[.{1,10}\]|$)/g;
                    const segments = [];
                    let roleMatch;
                    while ((roleMatch = rolePattern.exec(text)) !== null) {
                        const roleName = roleMatch[1].trim();
                        const roleText = roleMatch[2].trim();
                        if (roleText) segments.push({ role: roleName, text: roleText });
                    }

                    // 无角色标记 → 整段配音
                    if (segments.length === 0) {
                        segments.push({ role: 'narrator', text: text.trim() });
                    }

                    // 🎭 Step 2: 智能音色分配
                    const detectedScene = scene === 'auto' ? _detectScene(text) : scene;

                    // 角色音色映射表
                    const voiceProfiles = {
                        // 旁白类
                        '旁白': { engine: 'gemini', voiceId: 'Charon', speed: 0.95 },
                        'narrator': { engine: 'gemini', voiceId: 'Charon', speed: 0.95 },
                        '叙述': { engine: 'gemini', voiceId: 'Charon', speed: 0.95 },
                        // 女性角色
                        '女': { engine: 'gemini', voiceId: 'Kore', speed: 1.0 },
                        '女孩': { engine: 'gemini', voiceId: 'Kore', speed: 1.1 },
                        '小红': { engine: 'gemini', voiceId: 'Kore', speed: 1.0 },
                        '娘': { engine: 'gemini', voiceId: 'Aoede', speed: 0.9 },
                        '温柔': { engine: 'gemini', voiceId: 'Aoede', speed: 0.9 },
                        '女声': { engine: 'kling', voiceId: 'ai_shatang', speed: 1.0 },
                        // 男性角色
                        '男': { engine: 'gemini', voiceId: 'Puck', speed: 1.0 },
                        '男孩': { engine: 'gemini', voiceId: 'Puck', speed: 1.1 },
                        '小明': { engine: 'gemini', voiceId: 'Puck', speed: 1.0 },
                        '老人': { engine: 'gemini', voiceId: 'Charon', speed: 0.85 },
                        '男声': { engine: 'kling', voiceId: 'genshin_vindi2', speed: 1.0 },
                        '深沉': { engine: 'gemini', voiceId: 'Charon', speed: 0.9 }
                    };

                    // 场景默认音色（当角色名未匹配时的兆底）
                    const sceneDefaults = {
                        narration: { engine: 'gemini', voiceId: 'Charon', speed: 0.95 },
                        story: { engine: 'kling', voiceId: 'diyinnansang_DB_CN_M_04-v2', speed: 1.0 },
                        ad: { engine: 'gemini', voiceId: 'Puck', speed: 1.1 },
                        education: { engine: 'gemini', voiceId: 'Charon', speed: 0.9 },
                        lively: { engine: 'gemini', voiceId: 'Kore', speed: 1.2 }
                    };
                    const defaultVoice = sceneDefaults[detectedScene] || sceneDefaults.narration;

                    // 为每个角色分配音色，同一角色名保持一致
                    const roleVoiceMap = {};
                    const usedVoices = new Set();
                    const alternateVoices = [
                        { engine: 'gemini', voiceId: 'Puck', speed: 1.0 },
                        { engine: 'gemini', voiceId: 'Kore', speed: 1.0 },
                        { engine: 'gemini', voiceId: 'Aoede', speed: 0.95 },
                        { engine: 'gemini', voiceId: 'Charon', speed: 0.9 },
                        { engine: 'kling', voiceId: 'genshin_vindi2', speed: 1.0 },
                        { engine: 'kling', voiceId: 'ai_shatang', speed: 1.0 }
                    ];
                    let altIdx = 0;

                    for (const seg of segments) {
                        if (roleVoiceMap[seg.role]) continue;
                        // 匹配预定义角色
                        const matched = Object.entries(voiceProfiles).find(([key]) =>
                            seg.role.includes(key) || key.includes(seg.role)
                        );
                        if (matched && !usedVoices.has(matched[1].voiceId)) {
                            roleVoiceMap[seg.role] = matched[1];
                            usedVoices.add(matched[1].voiceId);
                        } else if (segments.length === 1) {
                            roleVoiceMap[seg.role] = defaultVoice;
                        } else {
                            // 多角色时分配不同音色
                            while (altIdx < alternateVoices.length && usedVoices.has(alternateVoices[altIdx].voiceId)) altIdx++;
                            const voice = altIdx < alternateVoices.length ? alternateVoices[altIdx] : defaultVoice;
                            roleVoiceMap[seg.role] = voice;
                            usedVoices.add(voice.voiceId);
                            altIdx++;
                        }
                    }

                    callbacks.onProgress?.('开始配音', 10,
                        `检测到 ${segments.length} 段配音，${Object.keys(roleVoiceMap).length} 个角色，场景: ${detectedScene}`);

                    // 🎤 Step 3: 逐段配音
                    const results = [];
                    for (let i = 0; i < segments.length; i++) {
                        const seg = segments[i];
                        const voice = roleVoiceMap[seg.role];
                        const segText = seg.text.substring(0, 500); // 单段限制500字
                        const progress = 10 + Math.round((i / segments.length) * 85);
                        callbacks.onProgress?.(`配音中 ${i + 1}/${segments.length}`, progress,
                            `🎤 [${seg.role}] ${voice.engine}/${voice.voiceId} speed=${voice.speed}`);

                        try {
                            const audioUrl = await callTTSAPI(segText, {
                                engine: voice.engine,
                                voiceId: voice.voiceId,
                                speed: voice.speed
                            });
                            results.push({ role: seg.role, audioUrl, text: segText, status: 'success' });
                            callbacks.onStepComplete?.(`[${seg.role}] 配音完成`, { audioUrl });
                        } catch (err) {
                            results.push({ role: seg.role, error: err.message, text: segText, status: 'failed' });
                        }
                    }

                    callbacks.onProgress?.('完成', 100,
                        `成功 ${results.filter(r => r.status === 'success').length}/${segments.length} 段`);

                    return {
                        scene: detectedScene,
                        segments: results,
                        roles: Object.entries(roleVoiceMap).map(([role, v]) => ({ role, ...v }))
                    };
                }
            },

            // 8. AI智能音乐
            {
                id: 'ai_music',
                name: 'AI智能音乐',
                icon: '🎵',
                category: 'audio',
                description: '描述想要的音乐氛围或用途，AI 自动生成歌词、选择风格、配置参数，一键创作音乐。',
                parameters: [
                    {
                        key: 'description',
                        label: '音乐描述',
                        type: 'textarea',
                        required: true,
                        placeholder: '描述想要的音乐，例如：\n\u2022 给美食探店视频做一段轻快的BGM\n\u2022 写一首关于秋天的中国风歌曲\n\u2022 科幻电影预告片的史诗配乐',
                        hint: '描述越具体，AI 生成的音乐越符合预期'
                    },
                    {
                        key: 'purpose',
                        label: '音乐用途（可选）',
                        type: 'select',
                        default: 'auto',
                        options: [
                            { value: 'auto', label: '🧠 AI 自动判断' },
                            { value: 'bgm', label: '🎬 视频/短视频BGM' },
                            { value: 'song', label: '🎤 完整歌曲（带人声）' },
                            { value: 'ambient', label: '🌿 氛围音乐/放松' },
                            { value: 'game', label: '🎮 游戏/动画配乐' },
                            { value: 'brand', label: '🏢 品牌/广告音乐' }
                        ]
                    }
                ],
                estimateCost: () => ({
                    film: 9,
                    time: '约 1-3 分钟'
                }),
                execute: async (params, callbacks) => {
                    const { description, purpose } = params;
                    if (typeof callSunoMusicAPI !== 'function') throw new Error('音乐生成功能不可用');

                    // 🧠 Step 1: AI 分析描述，自动生成参数
                    callbacks.onProgress?.('分析音乐需求', 5, 'AI 正在分析你的音乐需求...');

                    const detectedPurpose = purpose === 'auto' ? _detectMusicPurpose(description) : purpose;
                    const isInstrumental = ['bgm', 'ambient', 'game'].includes(detectedPurpose);
                    const needLyrics = ['song'].includes(detectedPurpose) || (!isInstrumental && detectedPurpose === 'auto');

                    // 智能风格标签生成
                    const autoTags = _generateMusicTags(description, detectedPurpose);
                    const model = 'chirp-v4'; // 默认稳定版本

                    callbacks.onProgress?.('生成音乐参数', 10,
                        `用途: ${detectedPurpose} | 风格: ${autoTags} | ${isInstrumental ? '纯BGM' : '带人声'}`);

                    // 🎵 Step 2: 如果需要歌词，先用AI生成歌词
                    let lyrics = '';
                    if (needLyrics) {
                        callbacks.onProgress?.('创作歌词', 15, 'AI 正在根据描述创作歌词...');
                        try {
                            if (typeof callScriptGenerator === 'function') {
                                lyrics = await callScriptGenerator({},
                                    `你是一位专业词作家。根据以下描述创作一首歌曲的歌词：

描述：${description}
风格：${autoTags}

要求：
- 包含主歌(Verse)、副歌(Chorus)、Bridge
- 副歌朗朗上口，有记忆点
- 中文歌词
- 直接输出歌词内容，不要解释`);
                            }
                            if (lyrics) {
                                callbacks.onStepComplete?.('歌词创作完成', { lyrics });
                            }
                        } catch (e) {
                            console.warn('[ai_music] 歌词生成失败，改用灵感模式:', e.message);
                        }
                    }

                    // 🎶 Step 3: 调用 Suno 生成音乐
                    callbacks.onProgress?.('生成音乐', 25, '正在生成音乐，请耐心等待...');

                    const sunoOptions = {
                        model,
                        title: '',
                        tags: autoTags,
                        instrumental: isInstrumental
                    };

                    if (lyrics) {
                        sunoOptions.prompt = lyrics;
                    } else {
                        sunoOptions.description = description;
                    }

                    const result = await callSunoMusicAPI(sunoOptions);

                    callbacks.onProgress?.('完成', 100, `成功生成 ${result.music.length} 首音乐`);

                    return {
                        taskId: result.taskId,
                        purpose: detectedPurpose,
                        tags: autoTags,
                        isInstrumental,
                        lyrics: lyrics || null,
                        music: result.music.map(m => ({
                            title: m.title,
                            audioUrl: m.audio_url,
                            imageUrl: m.image_url,
                            duration: m.duration,
                            tags: m.tags
                        }))
                    };
                }
            },

            // ==================== 内容类 ====================

            // 9. 热点文案生成
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
                        film: 1, // 单次文本调用1胶片
                        time: '约 30 秒'
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
                            .filter(line => line.length > 0)
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
                        key: 'styleRef',
                        label: '风格/角色参考图（可选）',
                        type: 'image',
                        hint: '上传角色或画风参考图，漫画将保持一致风格'
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
                        film: Math.ceil(pages * 5) + 1, // 5胶片/页 + 文本1
                        time: `约 ${pages + 2} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { novel, styleRef, pageCount, style } = params;

                    // 🖼️ 解析风格参考图（支持多图 base64 数组）
                    const novelRefs = await resolveRefImages(styleRef);
                    let novelRef = novelRefs.first;

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
                    const actualCount = Math.min(pageCount, pages.length || pageCount);

                    // 🎨 一致性策略：无参考图时，先生成第1页作为风格基准
                    if (!novelRef && actualCount > 1) {
                        callbacks.onProgress?.('生成风格基准', 8, '先生成第1页确定漫画风格...');
                        try {
                            const _firstContent = pages[0] || novel.substring(0, 500);
                            const _firstPrompt = `${styleMap[style]}, comic page, 4 panels, sequential art, ${_firstContent.substring(0, 400)}`;
                            novelRef = await callImageAPIWithRefs(_firstPrompt, { aspectRatio: '9:16' }, novelRefs.all);
                            callbacks.onStepComplete?.('风格基准页', { imageUrl: novelRef });
                        } catch (e) { console.warn('风格基准页失败:', e.message); }
                    }

                    callbacks.onProgress?.('并行生成', 10, `同时生成 ${actualCount} 页漫画...`);
                    let _nDone = 0;
                    const results = await Promise.all(Array.from({ length: actualCount }, (_, i) => {
                        const pageContent = pages[i] || novel.substring(i * 500, (i + 1) * 500);
                        const pagePrompt = `${styleMap[style]}, comic page, 4 panels, sequential art, ${pageContent.substring(0, 400)}`;
                        const opts = { aspectRatio: '9:16' };
                        if (novelRef) opts.refImage = novelRef;
                        return callImageAPIWithRefs(pagePrompt, opts, novelRefs.all)
                            .then(imageUrl => {
                                _nDone++;
                                callbacks.onProgress?.(`已完成 ${_nDone}/${actualCount}`, 10 + Math.round((_nDone / actualCount) * 85), `✅ 第${i + 1}页`);
                                callbacks.onStepComplete?.(`第${i + 1}页`, { imageUrl });
                                return { page: i + 1, content: pageContent.substring(0, 100) + '...', imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _nDone++;
                                callbacks.onProgress?.(`已完成 ${_nDone}/${actualCount}`, 10 + Math.round((_nDone / actualCount) * 85), `❌ 第${i + 1}页`);
                                return { page: i + 1, error: e.message, status: 'failed' };
                            });
                    }));

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
                        film: 1, // 文本1胶片
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
                            { value: 'chinese', label: '🏮 国风古典' },
                            { value: '3d', label: '🎮 3D 渲染' },
                            { value: 'watercolor', label: '🎨 水彩插画' }
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
                    },
                    {
                        key: 'styleRef',
                        label: '风格/角色参考图（可选）',
                        type: 'image',
                        hint: '上传角色或风格参考图，所有生成内容将基于此风格'
                    },
                    {
                        key: 'videoModel',
                        label: '视频模型',
                        type: 'select',
                        default: 'wan26-720p-5s',
                        options: VIDEO_MODEL_OPTIONS
                    },
                    {
                        key: 'imageModel',
                        label: '生图模型',
                        type: 'select',
                        default: 'nano-banana-2',
                        options: IMAGE_MODEL_OPTIONS
                    }
                ],
                estimateCost: (params) => {
                    const duration = parseInt(params.duration) || 60;
                    const scenes = Math.ceil(duration / 15);
                    const videoFilm = calculateVideoCost(params.videoModel, 15);
                    const imgFilm = calculateImageCost(params.imageModel);
                    let film = 1; // 剧本

                    if (params.includeCharacter) film += 1 + (4 * imgFilm); // 角色设定(文本1+图片4)
                    if (params.outputType === 'video' || params.outputType === 'both') {
                        film += scenes * (imgFilm + videoFilm); // 每个分镜：图片+视频
                    }
                    if (params.outputType === 'comic' || params.outputType === 'both') {
                        film += Math.ceil(scenes / 2) * imgFilm; // 漫画页
                    }

                    return {
                        film: Math.ceil(film),
                        time: `约 ${Math.ceil(duration / 10)} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { idea, outputType, style, duration, includeCharacter, styleRef } = params;
                    const videoModel = selectVideoModel({ preferred: params.videoModel, topic: idea, duration: parseInt(duration) || 15 });

                    // 🖼️ 解析参考图（支持多图）
                    const autoRefs = await resolveRefImages(styleRef);
                    let userRefImage = autoRefs.first;
                    const allAutoRefImages = autoRefs.all;

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
                    let refImage = userRefImage || results.character?.[0]?.url;

                    // 🎨 一致性策略：无参考图时，先生成第1张分镜图作为风格基准
                    if (!refImage && scenesCount > 1) {
                        callbacks.onProgress?.('生成风格基准', 18, '先生成第1张分镜图确定风格...');
                        try {
                            const _firstText = sceneTexts[0] || idea;
                            const _firstPrompt = `${stylePrompts[style]}, ${_firstText.substring(0, 300)}, cinematic composition, high quality`;
                            refImage = await callImageAPIWithRefs(_firstPrompt, { aspectRatio: '16:9' }, allAutoRefImages);
                            callbacks.onStepComplete?.('风格基准分镜', { imageUrl: refImage });
                        } catch (e) { console.warn('风格基准分镜失败:', e.message); }
                    }

                    // 步骤 3: 并行生成分镜图像 + 视频
                    callbacks.onProgress?.('并行生成分镜', 20, `同时生成 ${scenesCount} 个分镜...`);
                    let _faDone = 0;
                    const sceneResults = await Promise.all(Array.from({ length: scenesCount }, (_, i) => (async () => {
                        try {
                            const sceneText = sceneTexts[i] || sceneTexts[0] || idea;
                            const imagePrompt = `${stylePrompts[style]}, ${sceneText.substring(0, 300)}, cinematic composition, high quality`;
                            const opts = { aspectRatio: '16:9' };
                            if (refImage) opts.refImage = refImage;
                            const imageUrl = await callImageAPIWithRefs(imagePrompt, opts, allAutoRefImages);

                            let videoUrl = null;
                            if ((outputType === 'video' || outputType === 'both') && imageUrl && typeof callSora2ImageToVideoAPI === 'function') {
                                videoUrl = await callSora2ImageToVideoAPI(imageUrl, sceneText, { model: videoModel, duration: 15, aspectRatio: '16:9' });
                            }

                            _faDone++;
                            callbacks.onProgress?.(`已完成 ${_faDone}/${scenesCount}`, 20 + Math.round((_faDone / scenesCount) * 55), `✅ 分镜${i + 1}`);
                            callbacks.onStepComplete?.(`分镜${i + 1}`, { imageUrl });
                            return { index: i + 1, text: sceneText.substring(0, 100), imageUrl, videoUrl };
                        } catch (e) {
                            _faDone++;
                            console.error(`分镜 ${i + 1} 失败:`, e);
                            callbacks.onProgress?.(`已完成 ${_faDone}/${scenesCount}`, 20 + Math.round((_faDone / scenesCount) * 55), `❌ 分镜${i + 1}`);
                            return { index: i + 1, text: '', imageUrl: null, videoUrl: null };
                        }
                    })()));
                    sceneResults.sort((a, b) => a.index - b.index);
                    results.scenes = sceneResults.filter(s => s.imageUrl);
                    results.videos = sceneResults.filter(s => s.videoUrl).map(s => ({ index: s.index, videoUrl: s.videoUrl }));

                    // 步骤 4: 并行生成漫画（如果需要）
                    if (outputType === 'comic' || outputType === 'both') {
                        const comicPages = Math.ceil(scenesCount / 4);
                        callbacks.onProgress?.('并行生成漫画', 80, `同时生成 ${comicPages} 页漫画...`);
                        let _cmDone = 0;
                        results.comics = (await Promise.all(Array.from({ length: comicPages }, (_, p) => {
                            const pageScenes = results.scenes.slice(p * 4, (p + 1) * 4);
                            const comicPrompt = `${stylePrompts[style]}, comic page, 4 panels, ${pageScenes.map(s => s.text).join('; ')}`;
                            if (typeof callBanana2ImageAPI !== 'function') return Promise.resolve(null);
                            const _comicOpts = { aspectRatio: '9:16' };
                            if (refImage) _comicOpts.refImage = refImage;
                            return callBanana2ImageAPI(comicPrompt, _comicOpts)
                                .then(comicUrl => {
                                    _cmDone++;
                                    callbacks.onProgress?.(`漫画 ${_cmDone}/${comicPages}`, 80 + Math.round((_cmDone / comicPages) * 15), `✅ 第${p + 1}页`);
                                    return { page: p + 1, imageUrl: comicUrl };
                                })
                                .catch(e => { _cmDone++; console.error(`漫画第 ${p + 1} 页失败:`, e); return null; });
                        }))).filter(Boolean);
                    }

                    callbacks.onProgress?.('完成', 100, '全流程执行完成！');

                    return results;
                }
            },

            // ==================== 🎨 设计类 ====================

            // 11. 品牌视觉全案 (Logo & Brand System)
            {
                id: 'brand_visual_system',
                name: '品牌视觉全案',
                icon: '🎯',
                category: 'design',
                description: '输入品牌名称和行业，AI 自动规划品牌策略并生成完整视觉体系：Logo、名片、包装、社媒封面、品牌手册。',
                parameters: [
                    { key: 'brandName', label: '品牌名称', type: 'text', required: true, placeholder: '例如：StarFlow、星流' },
                    { key: 'industry', label: '行业/领域', type: 'text', required: true, placeholder: '例如：科技、餐饮、美妆、教育...' },
                    { key: 'refImage', label: '参考图（可选）', type: 'image', hint: '上传已有 Logo 或风格参考图，AI 会基于此设计' },
                    {
                        key: 'style', label: '设计风格', type: 'select', default: 'modern', options: [
                            { value: 'modern', label: '简约现代' }, { value: 'luxury', label: '高端奢华' },
                            { value: 'playful', label: '活泼有趣' }, { value: 'tech', label: '科技未来' },
                            { value: 'natural', label: '自然清新' }, { value: 'retro', label: '复古经典' }
                        ]
                    },
                    { key: 'slogan', label: '品牌标语（可选）', type: 'text', placeholder: '例如：Let creativity flow' },
                    { key: 'colorPref', label: '偏好色系（可选）', type: 'text', placeholder: '例如：蓝紫色系、红金配色...' }
                ],
                estimateCost: (params) => {
                    const imgFilm = calculateImageCost(params.imageModel);
                    return { film: Math.ceil(5 * imgFilm) + 1, time: '约 5-8 分钟' };
                },
                execute: async (params, callbacks) => {
                    const { brandName, industry, style, slogan, colorPref, refImage } = params;
                    const results = { strategy: '', images: [] };
                    const styleMap = {
                        modern: 'minimalist modern design, clean lines, sans-serif typography',
                        luxury: 'luxury premium design, gold accents, elegant serif fonts',
                        playful: 'playful colorful design, rounded shapes, fun typography',
                        tech: 'futuristic tech design, gradients, geometric shapes, neon accents',
                        natural: 'organic natural design, earth tones, botanical elements',
                        retro: 'vintage retro design, classic typography, nostalgic palette'
                    };
                    const designStyle = styleMap[style] || styleMap.modern;

                    // Step 1: LLM 规划品牌策略
                    callbacks.onProgress?.('品牌策略', 5, '正在规划品牌视觉策略...');
                    try {
                        const strategyPrompt = `你是资深品牌设计总监。为「${brandName}」（行业：${industry}）制定品牌视觉策略。
设计风格：${style}
${slogan ? '标语：' + slogan : ''}
${colorPref ? '色彩偏好：' + colorPref : ''}

请输出：
1. 品牌定位（一句话）
2. 主色调（HEX色值 + 语义）
3. 辅助色（2-3个）
4. 字体风格建议
5. Logo设计方向（图形元素、结构）
6. 设计理念（用 1-2 句话解释商业逻辑）

简洁输出，每项一行。`;
                        if (typeof callScriptGenerator === 'function') {
                            results.strategy = await callScriptGenerator({}, strategyPrompt);
                        }
                        callbacks.onStepComplete?.('品牌策略', { script: results.strategy?.substring(0, 150) + '...' });
                    } catch (e) { console.error('品牌策略失败:', e); }

                    const brandContext = results.strategy ? results.strategy.substring(0, 300) : `${brandName}, ${industry}, ${designStyle}`;

                    // 🖼️ 解析参考图（支持多图）
                    const brandRefs = await resolveRefImages(refImage);
                    let userRefImage = brandRefs.first;
                    const allBrandRefImages = brandRefs.all;

                    // Step 2-7: 批量生成品牌物料
                    const assets = [
                        { name: 'Logo 设计', prompt: `Professional logo design for "${brandName}", ${designStyle}, ${industry} brand, vector style, clean white background, centered composition, brand identity, ${brandContext.substring(0, 100)}`, ratio: '1:1' },
                        { name: 'Logo 变体套装', prompt: `Logo variations sheet for "${brandName}", showing 6 different versions: full color, monochrome, reversed, icon only, horizontal layout, stacked layout, ${designStyle}, white background, organized grid`, ratio: '16:9' },
                        { name: '名片设计', prompt: `Professional business card design for "${brandName}", front and back view, ${designStyle}, ${industry}, showing name/title/phone/email/website placeholders, premium print quality mockup`, ratio: '16:9' },
                        { name: '产品包装', prompt: `Product packaging design mockup for "${brandName}", ${industry} product, ${designStyle}, 3D rendered box/bag/bottle on clean background, premium quality, photorealistic`, ratio: '1:1' },
                        { name: '社媒封面', prompt: `Social media cover design for "${brandName}", ${slogan || industry}, ${designStyle}, modern banner layout, brand colors, eye-catching composition, 16:9 aspect ratio`, ratio: '16:9' },
                        { name: '品牌手册页', prompt: `Brand guidelines page for "${brandName}", showing color palette, typography, logo usage rules, spacing guidelines, ${designStyle}, clean professional layout, design manual page`, ratio: '9:16' }
                    ];

                    // 🎯 无参考图时，先生成首张作为风格锚点
                    let _firstBrandUrl = null;
                    if (!userRefImage && assets.length > 1) {
                        callbacks.onProgress?.('生成风格基准', 8, '先生成首张品牌物料确定风格...');
                        try {
                            const firstAsset = assets[0];
                            _firstBrandUrl = await callImageAPIWithRefs(firstAsset.prompt, { aspectRatio: firstAsset.ratio }, allBrandRefImages);
                            userRefImage = _firstBrandUrl;
                            callbacks.onStepComplete?.(firstAsset.name + '(风格基准)', { imageUrl: _firstBrandUrl });
                        } catch (e) { console.warn('风格基准图失败:', e.message); }
                    }

                    callbacks.onProgress?.('并行生成', 10, `同时生成 ${assets.length} 张品牌物料...`);
                    let _bDone = 0;
                    results.images = await Promise.all(assets.map((asset, _bIdx) => {
                        // 首张已作为基准图生成过，直接复用
                        if (_bIdx === 0 && _firstBrandUrl) {
                            _bDone++;
                            callbacks.onProgress?.(`已完成 ${_bDone}/${assets.length}`, 10 + Math.round((_bDone / assets.length) * 85), `✅ ${asset.name}`);
                            callbacks.onStepComplete?.(asset.name, { imageUrl: _firstBrandUrl });
                            return Promise.resolve({ subject: asset.name, imageUrl: _firstBrandUrl, status: 'success' });
                        }
                        const opts = { aspectRatio: asset.ratio };
                        if (userRefImage) opts.refImage = userRefImage;
                        return callImageAPIWithRefs(asset.prompt, opts, allBrandRefImages)
                            .then(imageUrl => {
                                _bDone++;
                                callbacks.onProgress?.(`已完成 ${_bDone}/${assets.length}`, 10 + Math.round((_bDone / assets.length) * 85), `✅ ${asset.name}`);
                                callbacks.onStepComplete?.(asset.name, { imageUrl });
                                return { subject: asset.name, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _bDone++;
                                callbacks.onProgress?.(`已完成 ${_bDone}/${assets.length}`, 10 + Math.round((_bDone / assets.length) * 85), `❌ ${asset.name}`);
                                return { subject: asset.name, error: e.message, status: 'failed' };
                            });
                    }));

                    callbacks.onProgress?.('完成', 100, `品牌视觉全案已生成！共 ${results.images.filter(i => i.status === 'success').length} 张设计图`);
                    return { brandName, strategy: results.strategy, images: results.images };
                }
            },

            // 12. 社媒素材套装 (Social Media Visual Assets)
            {
                id: 'social_media_kit',
                name: '社媒素材套装',
                icon: '📱',
                category: 'design',
                description: '一键生成多平台适配的社媒素材：抖音、小红书、微博、B站、公众号。自动适配尺寸和风格。',
                parameters: [
                    { key: 'topic', label: '内容主题', type: 'textarea', required: true, placeholder: '例如：2026新年促销、新品发布、品牌宣传...' },
                    { key: 'brandInfo', label: '品牌/产品名', type: 'text', placeholder: '例如：StarFlow 咖啡' },
                    { key: 'refImage', label: '品牌参考图（可选）', type: 'image', hint: '上传品牌 Logo 或产品图，所有素材基于此风格生成' },
                    {
                        key: 'platforms', label: '目标平台', type: 'select', default: 'all', options: [
                            { value: 'all', label: '全平台（6张）' }, { value: 'douyin', label: '抖音（9:16）' },
                            { value: 'xiaohongshu', label: '小红书（3:4）' }, { value: 'weibo', label: '微博（16:9）' },
                            { value: 'bilibili', label: 'B站（16:9）' }, { value: 'wechat', label: '公众号（16:9）' }
                        ]
                    },
                    {
                        key: 'style', label: '视觉风格', type: 'select', default: 'trendy', options: [
                            { value: 'trendy', label: '潮流时尚' }, { value: 'minimal', label: '极简大气' },
                            { value: 'vibrant', label: '活力缮纷' }, { value: 'elegant', label: '精致优雅' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    const count = params.platforms === 'all' ? 6 : 1;
                    const imgFilm = calculateImageCost(params.imageModel);
                    return { film: Math.ceil(count * imgFilm) + 1, time: `约 ${count} 分钟` };
                },
                execute: async (params, callbacks) => {
                    const { topic, brandInfo, platforms, style, refImage } = params;

                    // 🖼️ 解析参考图（支持多图）
                    const socialRefs = await resolveRefImages(refImage);
                    let userRefImage = socialRefs.first;
                    const allSocialRefImages = socialRefs.all;

                    const styleMap = {
                        trendy: 'trendy social media design, bold typography, vibrant gradients, Gen-Z aesthetic',
                        minimal: 'minimalist clean design, whitespace, elegant typography, premium feel',
                        vibrant: 'colorful energetic design, dynamic shapes, eye-catching, bold colors',
                        elegant: 'sophisticated elegant design, muted palette, refined typography, luxury feel'
                    };
                    const designStyle = styleMap[style] || styleMap.trendy;

                    const platformSpecs = [
                        { id: 'douyin', name: '抖音', ratio: '9:16', hint: 'vertical full-screen, big centered text, Douyin/TikTok style' },
                        { id: 'xiaohongshu', name: '小红书', ratio: '9:16', hint: 'lifestyle aesthetic, soft tones, Xiaohongshu style, Chinese text overlay' },
                        { id: 'weibo', name: '微博', ratio: '16:9', hint: 'horizontal banner, news-style layout, Weibo post image' },
                        { id: 'bilibili', name: 'B站', ratio: '16:9', hint: 'thumbnail cover, anime-influenced, Bilibili video cover' },
                        { id: 'wechat', name: '公众号', ratio: '16:9', hint: 'WeChat article header, professional, editorial style' },
                        { id: 'instagram', name: 'Instagram', ratio: '1:1', hint: 'square format, Instagram aesthetic, lifestyle photography style' }
                    ];

                    const targets = platforms === 'all' ? platformSpecs : platformSpecs.filter(p => p.id === platforms);

                    // 🎯 无参考图时，先生成首张作为风格锚点
                    let _firstSocialUrl = null;
                    if (!userRefImage && targets.length > 1) {
                        callbacks.onProgress?.('生成风格基准', 3, '先生成首张社媒素材确定风格...');
                        try {
                            const firstP = targets[0];
                            const firstPrompt = `${designStyle}, social media post design for ${firstP.name}, ${firstP.hint}, topic: ${topic}, ${brandInfo ? 'brand: ' + brandInfo + ',' : ''} high quality, professional marketing design`;
                            _firstSocialUrl = await callImageAPIWithRefs(firstPrompt, { aspectRatio: firstP.ratio }, allSocialRefImages);
                            userRefImage = _firstSocialUrl;
                            callbacks.onStepComplete?.(firstP.name + '(风格基准)', { imageUrl: _firstSocialUrl });
                        } catch (e) { console.warn('风格基准图失败:', e.message); }
                    }

                    callbacks.onProgress?.('并行生成', 5, `同时生成 ${targets.length} 张社媒素材...`);
                    let _sDone = 0;
                    const results = await Promise.all(targets.map((p, _sIdx) => {
                        // 首张已作为基准图生成过，直接复用
                        if (_sIdx === 0 && _firstSocialUrl) {
                            _sDone++;
                            callbacks.onProgress?.(`已完成 ${_sDone}/${targets.length}`, Math.round((_sDone / targets.length) * 95), `✅ ${p.name}`);
                            callbacks.onStepComplete?.(`${p.name}素材`, { imageUrl: _firstSocialUrl });
                            return Promise.resolve({ subject: `${p.name} (${p.ratio})`, imageUrl: _firstSocialUrl, status: 'success' });
                        }
                        const prompt = `${designStyle}, social media post design for ${p.name}, ${p.hint}, topic: ${topic}, ${brandInfo ? 'brand: ' + brandInfo + ',' : ''} high quality, professional marketing design`;
                        const opts = { aspectRatio: p.ratio };
                        if (userRefImage) opts.refImage = userRefImage;
                        return callImageAPIWithRefs(prompt, opts, allSocialRefImages)
                            .then(imageUrl => {
                                _sDone++;
                                callbacks.onProgress?.(`已完成 ${_sDone}/${targets.length}`, Math.round((_sDone / targets.length) * 95), `✅ ${p.name}`);
                                callbacks.onStepComplete?.(`${p.name}素材`, { imageUrl });
                                return { subject: `${p.name} (${p.ratio})`, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _sDone++;
                                callbacks.onProgress?.(`已完成 ${_sDone}/${targets.length}`, Math.round((_sDone / targets.length) * 95), `❌ ${p.name}`);
                                return { subject: p.name, error: e.message, status: 'failed' };
                            });
                    }));

                    callbacks.onProgress?.('完成', 100, `已生成 ${results.filter(r => r.status === 'success').length} 张社媒素材`);
                    return { images: results };
                }
            },

            // 13. 电商全套图 (E-commerce Complete Kit)
            {
                id: 'ecommerce_complete',
                name: '电商全套图',
                icon: '🛒',
                category: 'design',
                description: '一站式生成全套电商素材：产品套图 + 商详页 + 社交长图。支持淘宝/京东/亚马逊/小红书等平台。',
                parameters: [
                    { key: 'product', label: '产品名称', type: 'text', required: true, placeholder: '例如：无线蓝牙耳机、素皮双肩包...' },
                    { key: 'productImage', label: '产品参考图（推荐）', type: 'image', hint: '上传产品实拍图或3D渲染图，AI 基于此生成全套电商图' },
                    { key: 'sellingPoints', label: '核心卖点', type: 'textarea', required: true, placeholder: '每行一个卖点，例如：\n降噪40dB\n续航30小时\nIPX5防水' },
                    { key: 'scenes', label: '使用场景', type: 'textarea', placeholder: '例如：\n通勤路上\n健身房\n办公室\n居家休闲' },
                    { key: 'price', label: '价格/促销', type: 'text', placeholder: '例如：¥99 限时特惠 原价¥199' },
                    {
                        key: 'platform', label: '目标平台', type: 'select', default: 'taobao', options: [
                            { value: 'taobao', label: '淘宝/天猫' }, { value: 'jd', label: '京东' },
                            { value: 'amazon', label: '亚马逊' }, { value: 'xiaohongshu', label: '小红书' },
                            { value: 'douyin', label: '抖音' }, { value: 'wechat', label: '朋友圈' }
                        ]
                    },
                    {
                        key: 'style', label: '视觉风格', type: 'select', default: 'premium', options: [
                            { value: 'premium', label: '高端品质' }, { value: 'minimal', label: '极简白底' },
                            { value: 'lifestyle', label: '生活场景' }, { value: 'tech', label: '科技感' },
                            { value: 'luxury', label: '高端奢华' }
                        ]
                    }
                ],
                estimateCost: () => ({ film: 12, time: '约 6-8 分钟' }),
                execute: async (params, callbacks) => {
                    const { product, productImage, sellingPoints, scenes, price, platform, style } = params;
                    const points = sellingPoints.split('\n').filter(s => s.trim());
                    const styleMap = {
                        premium: 'premium product photography, studio lighting, high-end feel',
                        minimal: 'minimalist white background, clean product shot',
                        lifestyle: 'lifestyle product photography, in-use scenario, warm lighting',
                        tech: 'tech product showcase, dark background, neon accents, futuristic',
                        luxury: 'luxury premium design, dark background, gold accents, elegant typography'
                    };
                    const platformStyles = {
                        xiaohongshu: 'Xiaohongshu style, warm aesthetic, soft colors, cute elements',
                        wechat: 'WeChat Moments style, clean layout, bold price tag',
                        douyin: 'Douyin style, dynamic layout, high contrast, energetic',
                        taobao: 'Taobao/Tmall style, bright, clean, shopping oriented',
                        jd: 'JD style, professional, trustworthy, premium',
                        amazon: 'Amazon style, white background, clean, professional'
                    };

                    const designStyle = styleMap[style] || styleMap.premium;
                    const platformStyle = platformStyles[platform] || platformStyles.taobao;

                    const prodRefs = await resolveRefImages(productImage);
                    let productRefImage = prodRefs.first;
                    const allProdRefImages = prodRefs.all;

                    if (productRefImage) {
                        productRefImage = await compressDataUrl(productRefImage, 1000, 0.8);
                    }
                    const compressedAllRefs = await Promise.all(allProdRefImages.map(url => compressDataUrl(url, 1000, 0.8)));

                    const sceneList = scenes ? scenes.split('\n').filter(s => s.trim()) : [];

                    const shots = [];

                    shots.push({ name: '白底主图', prompt: `${product}, pure white background, studio product photography, centered, clean, professional listing main image, high resolution, ${designStyle}`, ratio: '1:1' });
                    shots.push({ name: '卖点信息图', prompt: `${product} infographic, product features highlight, ${points.slice(0, 3).join(', ')}, ${designStyle}, annotated product image with feature callouts, icons and text overlay, marketing design`, ratio: '1:1' });
                    shots.push({ name: '场景展示', prompt: `${product} lifestyle photography, person using/wearing the product in real life scenario, ${designStyle}, natural lighting, aspirational, editorial quality`, ratio: '1:1' });
                    shots.push({ name: '细节特写', prompt: `${product} detail close-up shots, material texture, craftsmanship, quality details, macro photography, ${designStyle}, showing premium quality`, ratio: '1:1' });
                    shots.push({ name: '尺寸对比', prompt: `${product} size comparison, product next to common objects for scale reference, dimensions labeled, clean infographic style, white background`, ratio: '1:1' });
                    shots.push({ name: '品牌横幅', prompt: `Brand banner for ${product}, premium brand story header, ${designStyle}, wide horizontal banner, brand values, elegant typography, marketing page hero image`, ratio: '16:9' });

                    shots.push({ name: '商详首屏', prompt: `${product} hero banner, premium product showcase, ${designStyle}, eye-catching, marketing poster, vertical format 9:16, professional typography`, ratio: '9:16' });
                    points.slice(0, 4).forEach((point, i) => {
                        shots.push({ name: `功能展示${i + 1}`, prompt: `${product} feature showcase, highlighting: ${point}, ${designStyle}, infographic style, icons and text annotations, clear communication, vertical 9:16`, ratio: '9:16' });
                    });
                    sceneList.slice(0, 2).forEach((s, i) => {
                        shots.push({ name: `场景展示${i + 1}`, prompt: `${product} in ${s} scenario, lifestyle photography, person using the product, ${designStyle}, natural lighting, authentic atmosphere, vertical 9:16`, ratio: '9:16' });
                    });
                    shots.push({ name: '商详细节', prompt: `${product} detail close-up, material texture, craftsmanship, quality details, macro photography, ${designStyle}, showing premium quality, vertical 9:16`, ratio: '9:16' });
                    shots.push({ name: '品牌背书', prompt: `${product} brand story section, trust badges, warranty info, quality guarantee, ${designStyle}, professional trust-building design, vertical 9:16`, ratio: '9:16' });

                    shots.push({ name: '社交主图', prompt: `${product} e-commerce social media post, ${platformStyle}, ${price ? `price tag showing ${price}, ` : ''}product main showcase, eye-catching design, vertical format 9:16, professional typography, ${designStyle}`, ratio: '9:16' });
                    shots.push({ name: '社交卖点', prompt: `${product} selling points infographic, ${points.slice(0, 4).join(', ')}, ${platformStyle}, clear feature icons, text annotations, vertical 9:16, easy to read, ${designStyle}`, ratio: '9:16' });
                    shots.push({ name: '社交场景', prompt: `${product} lifestyle scene, ${platformStyle}, showing product quality and usage, vertical 9:16, ${designStyle}`, ratio: '9:16' });
                    shots.push({ name: '社交CTA', prompt: `${product} call-to-action, ${platformStyle}, shop now, limited time offer, urgency, vertical 9:16, ${designStyle}`, ratio: '9:16' });

                    // 🎯 无参考图时，先生成首张作为风格锚点
                    let _firstUrl = null;
                    if (!productRefImage && shots.length > 1) {
                        callbacks.onProgress?.('生成风格基准', 2, '先生成首张图确定风格...');
                        try {
                            const firstShot = shots[0];
                            _firstUrl = await callImageAPIWithRefs(firstShot.prompt, { aspectRatio: firstShot.ratio }, compressedAllRefs);
                            productRefImage = _firstUrl;
                            callbacks.onStepComplete?.(firstShot.name + '(风格基准)', { imageUrl: _firstUrl });
                        } catch (e) { console.warn('风格基准图失败:', e.message); }
                    }

                    callbacks.onProgress?.('并行生成', 5, `同时生成 ${shots.length} 张电商全套图...`);
                    let _done = 0;
                    const results = await Promise.all(shots.map((shot, idx) => {
                        if (idx === 0 && _firstUrl) {
                            _done++;
                            callbacks.onProgress?.(`已完成 ${_done}/${shots.length}`, 5 + Math.round((_done / shots.length) * 90), `✅ ${shot.name}`);
                            callbacks.onStepComplete?.(shot.name, { imageUrl: _firstUrl });
                            return Promise.resolve({ subject: shot.name, imageUrl: _firstUrl, status: 'success' });
                        }
                        const opts = { aspectRatio: shot.ratio };
                        if (productRefImage) opts.refImage = productRefImage;
                        return callImageAPIWithRefs(shot.prompt, opts, compressedAllRefs)
                            .then(imageUrl => {
                                _done++;
                                callbacks.onProgress?.(`已完成 ${_done}/${shots.length}`, 5 + Math.round((_done / shots.length) * 90), `✅ ${shot.name}`);
                                callbacks.onStepComplete?.(shot.name, { imageUrl });
                                return { subject: shot.name, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _done++;
                                callbacks.onProgress?.(`已完成 ${_done}/${shots.length}`, 5 + Math.round((_done / shots.length) * 90), `❌ ${shot.name}`);
                                return { subject: shot.name, error: e.message, status: 'failed' };
                            });
                    }));

                    callbacks.onProgress?.('完成', 100, `电商全套图已生成！共 ${results.filter(r => r.status === 'success').length} 张`);
                    return { images: results };
                }
            },

            // 14. 营销宣传册 (Marketing Brochure)
            {
                id: 'marketing_brochure',
                name: '营销宣传册',
                icon: '📖',
                category: 'design',
                description: '生成专业三折页宣传册，包含封面、内页、封底，可直接印刷。',
                parameters: [
                    { key: 'subject', label: '宣传主题', type: 'textarea', required: true, placeholder: '例如：高端瑜伽服品牌宣传册、旅游度假村招商手册...' },
                    { key: 'refImage', label: '风格参考图（可选）', type: 'image', hint: '上传品牌素材或设计参考图，宣传册风格将基于此生成' },
                    { key: 'audience', label: '目标受众', type: 'text', placeholder: '例如：25-40岁都市女性、企业决策者...' },
                    { key: 'keyPoints', label: '核心卖点', type: 'textarea', required: true, placeholder: '每行一个卖点，最多5个' },
                    {
                        key: 'style', label: '设计风格', type: 'select', default: 'professional', options: [
                            { value: 'professional', label: '专业商务' }, { value: 'creative', label: '创意活泼' },
                            { value: 'luxury', label: '高端奢华' }, { value: 'eco', label: '自然环保' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    const imgFilm = calculateImageCost(params.imageModel);
                    return { film: Math.ceil(3 * imgFilm) + 1, time: '约 3-5 分钟' };
                },
                execute: async (params, callbacks) => {
                    const { subject, refImage, audience, keyPoints, style } = params;
                    const points = keyPoints.split('\n').filter(s => s.trim());
                    const styleMap = {
                        professional: 'professional corporate brochure, blue/gray palette, clean layout',
                        creative: 'creative colorful brochure, dynamic layout, bold typography',
                        luxury: 'luxury premium brochure, gold foil, dark background, elegant',
                        eco: 'eco-friendly brochure, earth tones, natural textures, organic design'
                    };
                    const designStyle = styleMap[style] || styleMap.professional;

                    // 🖼️ 解析参考图（支持多图）
                    const brochureRefs = await resolveRefImages(refImage);
                    let userRefImage = brochureRefs.first;
                    const allBrochureRefImages = brochureRefs.all;

                    // Step 1: LLM 生成宣传册文案
                    callbacks.onProgress?.('策划文案', 5, '正在撰写宣传册文案...');
                    let copyText = '';
                    try {
                        if (typeof callScriptGenerator === 'function') {
                            copyText = await callScriptGenerator({}, `为以下主题撰写三折页宣传册文案：
主题：${subject}
受众：${audience || '通用'}
卖点：${points.join('、')}

输出格式：
[封面] 标题 + 副标题
[内页左] 卖点介绍
[内页中] 产品/服务详情
[内页右] 客户评价/数据
[封底] 联系方式 + CTA

简洁有力，适合印刷。`);
                        }
                        callbacks.onStepComplete?.('宣传册文案', { script: copyText?.substring(0, 100) + '...' });
                    } catch (e) { }

                    const pages = [
                        { name: '外页展开图', prompt: `Tri-fold brochure OUTER layout flat design, ${designStyle}, for "${subject}", front cover (right panel) with headline, back cover (left panel) with contact info, middle panel with summary, unfolded view, ${audience ? 'targeting ' + audience : ''}, print-ready quality`, ratio: '16:9' },
                        { name: '内页展开图', prompt: `Tri-fold brochure INNER layout flat design, ${designStyle}, for "${subject}", 3 panels showing: left-features/benefits, center-product details with images, right-testimonials/CTA, unfolded view, professional print quality`, ratio: '16:9' },
                        { name: '折叠实物渲染', prompt: `Photorealistic mockup of folded tri-fold brochure, ${designStyle}, for "${subject}", ${audience ? 'targeting ' + audience : ''}, brochure on desk/table, soft shadows, professional studio photography`, ratio: '16:9' },
                        { name: '场景展示', prompt: `Marketing brochure in real-world context, person holding/reading the brochure at ${subject.includes('旅游') ? 'travel expo' : subject.includes('健身') ? 'gym reception' : 'business meeting'}, ${designStyle}, lifestyle photography, professional`, ratio: '16:9' }
                    ];

                    // 🎯 无参考图时，先生成首张作为风格锚点
                    let _firstBrochUrl = null;
                    if (!userRefImage && pages.length > 1) {
                        callbacks.onProgress?.('生成风格基准', 12, '先生成首张宣传册确定风格...');
                        try {
                            const firstPage = pages[0];
                            _firstBrochUrl = await callImageAPIWithRefs(firstPage.prompt, { aspectRatio: firstPage.ratio }, allBrochureRefImages);
                            userRefImage = _firstBrochUrl;
                            callbacks.onStepComplete?.(firstPage.name + '(风格基准)', { imageUrl: _firstBrochUrl });
                        } catch (e) { console.warn('风格基准图失败:', e.message); }
                    }

                    callbacks.onProgress?.('并行生成', 15, `同时生成 ${pages.length} 张宣传册...`);
                    let _mDone = 0;
                    const results = await Promise.all(pages.map((page, _mIdx) => {
                        // 首张已作为基准图生成过，直接复用
                        if (_mIdx === 0 && _firstBrochUrl) {
                            _mDone++;
                            callbacks.onProgress?.(`已完成 ${_mDone}/${pages.length}`, 15 + Math.round((_mDone / pages.length) * 80), `✅ ${page.name}`);
                            callbacks.onStepComplete?.(page.name, { imageUrl: _firstBrochUrl });
                            return Promise.resolve({ subject: page.name, imageUrl: _firstBrochUrl, status: 'success' });
                        }
                        const opts = { aspectRatio: page.ratio };
                        if (userRefImage) opts.refImage = userRefImage;
                        return callImageAPIWithRefs(page.prompt, opts, allBrochureRefImages)
                            .then(imageUrl => {
                                _mDone++;
                                callbacks.onProgress?.(`已完成 ${_mDone}/${pages.length}`, 15 + Math.round((_mDone / pages.length) * 80), `✅ ${page.name}`);
                                callbacks.onStepComplete?.(page.name, { imageUrl });
                                return { subject: page.name, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _mDone++;
                                callbacks.onProgress?.(`已完成 ${_mDone}/${pages.length}`, 15 + Math.round((_mDone / pages.length) * 80), `❌ ${page.name}`);
                                return { subject: page.name, error: e.message, status: 'failed' };
                            });
                    }));

                    callbacks.onProgress?.('完成', 100, `宣传册已生成！共 ${results.filter(r => r.status === 'success').length} 张设计图`);
                    return { copyText, images: results };
                }
            },

            // 15. IP角色生态 (IP Character Ecosystem)
            {
                id: 'ip_character_ecosystem',
                name: 'IP角色生态',
                icon: '🎭',
                category: 'design',
                description: '从角色设定到表情包、贴纸、周边商品、社媒头像，一键生成完整IP角色资产。',
                parameters: [
                    { key: 'charConcept', label: '角色概念', type: 'textarea', required: true, placeholder: '描述角色外观、性格、故事背景...' },
                    { key: 'charName', label: '角色名称', type: 'text', required: true, placeholder: '例如：小星、Mochi...' },
                    { key: 'charRefImage', label: '角色参考图（可选）', type: 'image', hint: '上传已有角色草稿/原型图，AI 会基于此保持一致性' },
                    {
                        key: 'style', label: '画风', type: 'select', default: 'cute', options: [
                            { value: 'cute', label: '可爱萌系' }, { value: 'cool', label: '潮酷街头' },
                            { value: 'chibi', label: 'Q版卡通' }, { value: 'realistic', label: '写实3D' },
                            { value: 'pixel', label: '像素风' }
                        ]
                    },
                    {
                        key: 'usage', label: '用途场景', type: 'select', default: 'brand', options: [
                            { value: 'brand', label: '品牌吉祥物' }, { value: 'sticker', label: '聊天表情包' },
                            { value: 'merch', label: '周边商品' }, { value: 'all', label: '全部（8张）' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    const count = params.usage === 'all' ? 8 : 4;
                    const imgFilm = calculateImageCost(params.imageModel);
                    return { film: Math.ceil(count * imgFilm) + 1, time: `约 ${count} 分钟` };
                },
                execute: async (params, callbacks) => {
                    const { charConcept, charName, charRefImage, style, usage } = params;
                    const styleMap = {
                        cute: 'cute kawaii style, soft colors, round features, adorable',
                        cool: 'urban street style, bold colors, graffiti influenced, edgy',
                        chibi: 'chibi super-deformed style, big head small body, cute cartoon',
                        realistic: '3D rendered character, Pixar/Disney quality, soft lighting',
                        pixel: 'pixel art style, retro game aesthetic, 16-bit'
                    };
                    const designStyle = styleMap[style] || styleMap.cute;
                    const results = [];

                    // 🖼️ 解析角色参考图（支持多图）
                    const ipRefs = await resolveRefImages(charRefImage);
                    let refImageUrl = ipRefs.first;
                    const allIPRefImages = ipRefs.all;

                    const allAssets = [
                        { name: '角色设定图', prompt: `Character design sheet for "${charName}", ${charConcept}, ${designStyle}, front view and side view and back view, full body, clean white background, character reference sheet, professional concept art`, ratio: '16:9', group: 'core' },
                        { name: '表情包套图', prompt: `Expression sheet of "${charName}" character, ${designStyle}, ${charConcept}, 9 different emotions in 3x3 grid: happy, sad, angry, surprised, shy, love, sleepy, confused, laughing, close-up face, white background`, ratio: '1:1', group: 'sticker' },
                        { name: '动态贴纸', prompt: `Sticker pack of "${charName}", ${designStyle}, ${charConcept}, 6 cute animated pose stickers: waving, dancing, thumbs up, eating, sleeping, celebrating, die-cut style, white background`, ratio: '1:1', group: 'sticker' },
                        { name: '社媒头像套装', prompt: `Social media avatar set of "${charName}", ${designStyle}, ${charConcept}, 4 profile picture variations: default, holiday, night mode, celebration, circular crop friendly, vibrant background`, ratio: '1:1', group: 'brand' },
                        { name: 'T恤设计', prompt: `T-shirt mockup featuring "${charName}" character, ${designStyle}, ${charConcept}, creative graphic tee design, front print, photorealistic clothing mockup on model or flat lay`, ratio: '1:1', group: 'merch' },
                        { name: '马克杯设计', prompt: `Mug mockup featuring "${charName}" character, ${designStyle}, ${charConcept}, cute character wrapped around ceramic mug, photorealistic product mockup, studio lighting`, ratio: '1:1', group: 'merch' },
                        { name: '手机壳设计', prompt: `Phone case mockup featuring "${charName}" character, ${designStyle}, ${charConcept}, creative phone case design, photorealistic mockup on latest smartphone`, ratio: '9:16', group: 'merch' },
                        { name: '场景插画', prompt: `"${charName}" character illustration in a scene, ${designStyle}, ${charConcept}, character in their natural environment, storytelling illustration, detailed background, atmospheric lighting`, ratio: '16:9', group: 'core' }
                    ];

                    const targets = usage === 'all' ? allAssets : allAssets.filter(a => a.group === 'core' || a.group === usage);

                    // 🎯 无参考图时，先生成首张（角色设定图）作为风格锚点
                    let _firstIPUrl = null;
                    if (!refImageUrl && targets.length > 1) {
                        callbacks.onProgress?.('生成风格基准', 3, '先生成角色设定图确定风格...');
                        try {
                            const firstAsset = targets[0];
                            _firstIPUrl = await callImageAPIWithRefs(firstAsset.prompt, { aspectRatio: firstAsset.ratio }, allIPRefImages);
                            refImageUrl = _firstIPUrl;
                            callbacks.onStepComplete?.(firstAsset.name + '(风格基准)', { imageUrl: _firstIPUrl });
                        } catch (e) { console.warn('风格基准图失败:', e.message); }
                    }

                    callbacks.onProgress?.('并行生成', 5, `同时生成 ${targets.length} 张IP素材...`);
                    let _ipDone = 0;
                    const ipResults = await Promise.all(targets.map((asset, _ipIdx) => {
                        // 首张已作为基准图生成过，直接复用
                        if (_ipIdx === 0 && _firstIPUrl) {
                            _ipDone++;
                            callbacks.onProgress?.(`已完成 ${_ipDone}/${targets.length}`, Math.round((_ipDone / targets.length) * 95), `✅ ${asset.name}`);
                            callbacks.onStepComplete?.(asset.name, { imageUrl: _firstIPUrl });
                            return Promise.resolve({ subject: asset.name, imageUrl: _firstIPUrl, status: 'success' });
                        }
                        const opts = { aspectRatio: asset.ratio };
                        if (refImageUrl) opts.refImage = refImageUrl;
                        return callImageAPIWithRefs(asset.prompt, opts, allIPRefImages)
                            .then(imageUrl => {
                                _ipDone++;
                                callbacks.onProgress?.(`已完成 ${_ipDone}/${targets.length}`, Math.round((_ipDone / targets.length) * 95), `✅ ${asset.name}`);
                                callbacks.onStepComplete?.(asset.name, { imageUrl });
                                return { subject: asset.name, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _ipDone++;
                                callbacks.onProgress?.(`已完成 ${_ipDone}/${targets.length}`, Math.round((_ipDone / targets.length) * 95), `❌ ${asset.name}`);
                                return { subject: asset.name, error: e.message, status: 'failed' };
                            });
                    }));

                    callbacks.onProgress?.('完成', 100, `IP角色生态已生成！共 ${ipResults.filter(r => r.status === 'success').length} 张`);
                    return { characterName: charName, images: ipResults };
                }
            },

            // 16. 分镜脚本和角色设定表 (Production Storyboards & Character Sheets)
            {
                id: 'storyboard_character_sheet',
                name: '分镜脚本和角色设定表',
                icon: '🎬',
                category: 'design',
                description: '上传角色参考图 + 一句话描述，AI 自动生成角色设定表和分镜脚本图。适合动画、漫画、短片的前期制作。',
                parameters: [
                    { key: 'story', label: '故事/场景描述', type: 'textarea', required: true, placeholder: '例如：穿黑色T恤的超哥骑着马儿，给社群成员挨个送马年祝福...', hint: '一句话或一段话都可以，AI 会自动拆分为分镜' },
                    { key: 'refImage', label: '角色/场景参考图', type: 'image', hint: '上传角色照片或插画，分镜将保持角色一致性（强烈推荐）' },
                    { key: 'panelCount', label: '分镜数量', type: 'number', default: 6, min: 2, max: 20, hint: '建议 4-8 个分镜' },
                    { key: 'includeCharSheet', label: '生成角色设定表', type: 'checkbox', default: true, checkboxLabel: '先生成角色三视图设定，确保分镜角色一致' },
                    {
                        key: 'style', label: '画风', type: 'select', default: 'anime', options: [
                            { value: 'anime', label: '🎌 动漫风' }, { value: 'realistic', label: '📸 写实风' },
                            { value: 'chinese', label: '🏮 国风' }, { value: 'storyboard', label: '✏️ 线稿分镜' },
                            { value: 'cinematic', label: '🎥 电影感' }
                        ]
                    },
                    {
                        key: 'aspectRatio', label: '分镜比例', type: 'select', default: '16:9', options: [
                            { value: '16:9', label: '16:9 横版（推荐）' }, { value: '1:1', label: '1:1 正方形' },
                            { value: '9:16', label: '9:16 竖版' }, { value: '3:4', label: '3:4 竖版标准' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    const panels = params.panelCount || 6;
                    let count = panels; // 每个分镜 1 张图
                    if (params.includeCharSheet) count += 1; // 角色设定表
                    return { film: count * 5, time: `约 ${Math.ceil(count * 0.5)} 分钟` };
                },
                execute: async (params, callbacks) => {
                    const { story, refImage, panelCount, includeCharSheet, style, aspectRatio } = params;
                    const results = { charSheet: null, panels: [] };

                    // 🖼️ 解析参考图
                    const refs = await resolveRefImages(refImage);
                    let charRefUrl = refs.first;
                    const allRefImages = refs.all;

                    const styleMap = {
                        anime: 'anime style, Japanese animation, vibrant colors, cel-shaded',
                        realistic: 'photorealistic, cinematic lighting, detailed textures',
                        chinese: 'Chinese traditional art style, ink painting influence, elegant',
                        storyboard: 'professional storyboard sketch, pencil line art, grayscale, clean lines, film production style',
                        cinematic: 'cinematic movie still, dramatic lighting, film grain, wide angle'
                    };
                    const designStyle = styleMap[style] || styleMap.anime;

                    // ========== Step 1: LLM 拆分分镜脚本 ==========
                    callbacks.onProgress?.('拆分分镜脚本', 5, '正在将故事拆分为分镜...');

                    const splitPrompt = `你是专业动画分镜师。请将以下故事/描述拆分为 ${panelCount} 个分镜画面。

故事描述：${story}

请为每个分镜输出：
【分镜1】画面描述（用英文，详细描述角色动作、表情、镜头角度、场景环境）
【分镜2】...
...

要求：
1. 每个分镜是一个独立画面
2. 镜头要有变化（远景、中景、近景、特写交替）
3. 描述要具体，可以直接作为 AI 绘画的 prompt
4. 保持角色特征一致
5. 画面描述用英文输出`;

                    let panelDescriptions = [];
                    try {
                        let outline = '';
                        if (typeof callScriptGenerator === 'function') {
                            outline = await callScriptGenerator({}, splitPrompt);
                        } else if (typeof callModelScopeTextAPI === 'function') {
                            outline = await callModelScopeTextAPI(splitPrompt);
                        }
                        // 解析分镜
                        panelDescriptions = outline.split(/【分镜\d+】/i).filter(s => s.trim());
                        if (panelDescriptions.length === 0) {
                            // fallback: 按段落分
                            panelDescriptions = outline.split(/\n+/).filter(s => s.trim().length > 10);
                        }
                        callbacks.onStepComplete?.('分镜脚本', { script: outline.substring(0, 200) + '...' });
                    } catch (e) {
                        console.error('分镜脚本生成失败:', e);
                        // fallback: 用故事本身拆分
                        for (let i = 0; i < panelCount; i++) {
                            panelDescriptions.push(`scene ${i + 1} of the story: ${story}`);
                        }
                    }

                    // 确保数量匹配
                    while (panelDescriptions.length < panelCount) {
                        panelDescriptions.push(panelDescriptions[panelDescriptions.length - 1] || story);
                    }
                    panelDescriptions = panelDescriptions.slice(0, panelCount);

                    // ========== Step 2: 角色设定表（可选）==========
                    if (includeCharSheet) {
                        callbacks.onProgress?.('生成角色设定表', 10, '正在绘制角色三视图设定...');
                        try {
                            const charPrompt = `${designStyle}, professional character design reference sheet, character turnaround, front view, 3/4 view, side view, back view, full body, clean white background, consistent character design, model sheet, ${story.substring(0, 200)}, detailed character features, professional concept art`;

                            const opts = { aspectRatio: '16:9' };
                            if (charRefUrl) opts.refImage = charRefUrl;
                            results.charSheet = await callImageAPIWithRefs(charPrompt, opts, allRefImages);

                            // 用角色设定图作为后续分镜的参考（保持一致性）
                            if (results.charSheet && !charRefUrl) {
                                charRefUrl = results.charSheet;
                            }
                            callbacks.onStepComplete?.('角色设定表', { imageUrl: results.charSheet });
                        } catch (e) {
                            console.error('角色设定表生成失败:', e);
                        }
                    }

                    // ========== Step 3: 并行生成全部分镜画面 ==========
                    const baseProgress = includeCharSheet ? 20 : 10;
                    callbacks.onProgress?.('并行生成分镜', baseProgress, `同时生成 ${panelDescriptions.length} 个分镜...`);

                    let completedCount = 0;
                    const panelPromises = panelDescriptions.map((rawDesc, i) => {
                        const desc = rawDesc.trim();
                        const panelPrompt = `${designStyle}, storyboard panel ${i + 1}, ${desc}, cinematic composition, professional production storyboard, high quality, detailed`;

                        const opts = { aspectRatio };
                        if (charRefUrl) opts.refImage = charRefUrl;

                        return callImageAPIWithRefs(panelPrompt, opts, allRefImages)
                            .then(imageUrl => {
                                completedCount++;
                                const progress = baseProgress + Math.round((completedCount / panelDescriptions.length) * (95 - baseProgress));
                                callbacks.onProgress?.(`已完成 ${completedCount}/${panelDescriptions.length}`, progress, `✅ 分镜${i + 1}`);
                                callbacks.onStepComplete?.(`分镜${i + 1}`, { imageUrl });
                                return { index: i + 1, description: desc, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                completedCount++;
                                const progress = baseProgress + Math.round((completedCount / panelDescriptions.length) * (95 - baseProgress));
                                callbacks.onProgress?.(`已完成 ${completedCount}/${panelDescriptions.length}`, progress, `❌ 分镜${i + 1}: ${e.message}`);
                                return { index: i + 1, description: desc, error: e.message, status: 'failed' };
                            });
                    });

                    results.panels = await Promise.all(panelPromises);
                    // 按分镜序号排序
                    results.panels.sort((a, b) => a.index - b.index);

                    const successCount = results.panels.filter(p => p.status === 'success').length;
                    callbacks.onProgress?.('完成', 100, `分镜脚本已生成！角色设定表 ${results.charSheet ? '1张' : '无'} + 分镜 ${successCount}/${panelDescriptions.length} 张`);

                    return {
                        charSheet: results.charSheet,
                        images: [
                            ...(results.charSheet ? [{ subject: '角色设定表', imageUrl: results.charSheet, status: 'success' }] : []),
                            ...results.panels.map(p => ({ subject: `分镜${p.index}`, imageUrl: p.imageUrl, status: p.status, error: p.error }))
                        ]
                    };
                }
            },

            // ==================== 🔧 工具类 ====================

            // 17. 图片文字识别 (OCR)
            {
                id: 'image_ocr',
                name: '图片文字识别',
                icon: '🔍',
                category: 'tool',
                description: '使用 DeepSeek OCR 识别图片中的所有文字，支持中文、英文、表格、手写体等。',
                parameters: [
                    { key: 'image', label: '上传图片', type: 'image', required: true, hint: '支持 JPG/PNG，截图、照片、文档扫描件等' },
                    {
                        key: 'ocrMode', label: '识别模式', type: 'select', default: 'all', options: [
                            { value: 'all', label: '全部文字' }, { value: 'table', label: '表格识别' },
                            { value: 'handwrite', label: '手写体' }, { value: 'translate', label: '识别+翻译' }
                        ]
                    }
                ],
                estimateCost: () => ({ film: 2, time: '约 10 秒' }),
                execute: async (params, callbacks) => {
                    const { image, ocrMode } = params;
                    if (!image || image.length === 0) throw new Error('请上传图片');

                    callbacks.onProgress?.('OCR识别', 30, '正在识别图片文字...');

                    // 🖼️ 兼容 base64 数组和 FileList
                    const ocrRefs = await resolveRefImages(image);
                    const imageUrl = ocrRefs.first;
                    if (!imageUrl) throw new Error('图片读取失败');

                    const modePrompts = {
                        all: '请识别并输出图片中的所有文字内容，保持原始排版格式。',
                        table: '请识别图片中的表格，用 Markdown 表格格式输出，保持行列结构。',
                        handwrite: '请识别图片中的手写文字，尽可能准确输出。',
                        translate: '请识别图片中的所有文字，先输出原文，然后在下方提供中文翻译。'
                    };

                    let result = '';
                    if (typeof callOCRAPI === 'function') {
                        result = await callOCRAPI(imageUrl, modePrompts[ocrMode] || modePrompts.all, 'deepseek-ocr');
                    } else {
                        throw new Error('OCR 功能不可用');
                    }

                    callbacks.onStepComplete?.('OCR识别', { text: result?.substring(0, 100) + '...' });
                    callbacks.onProgress?.('完成', 100, `识别完成！共 ${result.length} 个字符`);

                    return { ocrText: result, outline: result };
                }
            },

            // ==================== 🎬 小说转短剧（Toonflow精华）====================

            // 18. 小说转短剧
            {
                id: 'novel_to_drama',
                name: '小说转短剧',
                icon: '🎭',
                category: 'video',
                description: '借鉴 Toonflow 核心工作流：小说→角色卡提取→结构化剧本→分镜 prompt→图片→视频。角色一致性锚点保证人物不变脸。',
                parameters: [
                    {
                        key: 'novel',
                        label: '小说/故事内容',
                        type: 'textarea',
                        required: true,
                        placeholder: '粘贴小说章节内容（建议 500-3000 字）...',
                        hint: 'AI 会自动提取角色、生成剧本、分镜、视频'
                    },
                    {
                        key: 'sceneCount',
                        label: '分镜数量',
                        type: 'number',
                        default: 6,
                        min: 3,
                        max: 16,
                        hint: '每个分镜生成一张图+一段视频'
                    },
                    {
                        key: 'style',
                        label: '视觉风格',
                        type: 'select',
                        default: 'anime',
                        options: [
                            { value: 'anime', label: '🎌 日系动漫' },
                            { value: 'realistic', label: '📸 写实电影' },
                            { value: 'chinese', label: '🏮 国风古典' },
                            { value: 'manhwa', label: '🇰🇷 韩漫彩色' },
                            { value: '3d', label: '🎮 3D 渲染' }
                        ]
                    },
                    {
                        key: 'outputMode',
                        label: '输出模式',
                        type: 'select',
                        default: 'image_video',
                        options: [
                            { value: 'image_only', label: '🖼️ 仅分镜图' },
                            { value: 'image_video', label: '🎬 分镜图 + 视频' }
                        ]
                    },
                    {
                        key: 'styleRef',
                        label: '角色/风格参考图（可选）',
                        type: 'image',
                        hint: '上传角色参考图，AI 会保持人物外貌一致性'
                    },
                    {
                        key: 'videoModel',
                        label: '视频模型',
                        type: 'select',
                        default: 'wan26-720p-5s',
                        options: VIDEO_MODEL_OPTIONS
                    },
                    {
                        key: 'imageModel',
                        label: '生图模型',
                        type: 'select',
                        default: 'nano-banana-2',
                        options: IMAGE_MODEL_OPTIONS
                    }
                ],
                estimateCost: (params) => {
                    const n = params.sceneCount || 6;
                    const imgFilm = calculateImageCost(params.imageModel);
                    const vidFilm = params.outputMode === 'image_video' ? calculateVideoCost(params.videoModel, 5) : 0;
                    return {
                        film: Math.ceil(2 + n * (imgFilm + vidFilm)), // 角色卡+剧本(2) + 每镜头
                        time: `约 ${Math.ceil(n * 1.5 + 3)} 分钟`
                    };
                },
                execute: async (params, callbacks) => {
                    const { novel, sceneCount, style, outputMode, styleRef, imageModel } = params;
                    const videoModel = selectVideoModel({ preferred: params.videoModel, topic: novel, duration: 5 });
                    const n = sceneCount || 6;

                    const styleMap = {
                        anime: 'anime style, Japanese animation, vibrant colors, detailed linework',
                        realistic: 'cinematic photorealistic, movie quality, dramatic lighting',
                        chinese: 'Chinese traditional ink painting style, elegant brushwork, classical atmosphere',
                        manhwa: 'Korean manhwa style, full color, webtoon format, expressive characters',
                        '3d': '3D rendered, Pixar-like quality, volumetric lighting, detailed textures'
                    };
                    const designStyle = styleMap[style] || styleMap.anime;

                    const results = { characters: [], script: '', panels: [], videos: [] };

                    // ========== Step 1: 角色卡提取（Toonflow核心精华）==========
                    callbacks.onProgress?.('提取角色卡', 3, '正在从小说中提取角色设定...');
                    let charCardText = '';
                    try {
                        const charPrompt = `请从以下小说文本中提取所有主要角色，生成结构化角色卡。

小说内容：
${novel.substring(0, 2000)}

输出格式（每个角色一段）：
【角色名】
- 性别：男/女
- 年龄：大约XX岁
- 外貌：发型颜色、脸型、肤色、眼睛特征
- 服装：主要着装风格和颜色
- 性格：2-3个关键词
- 图像生成关键词（英文）：用于AI绘图的外貌描述，15字以内

只提取有台词或重要戏份的角色，最多5个。`;
                        if (typeof callScriptGenerator === 'function') {
                            charCardText = await callScriptGenerator({}, charPrompt);
                        }
                        callbacks.onStepComplete?.('角色卡', { preview: charCardText.substring(0, 200) });
                    } catch (e) {
                        console.warn('[novel_to_drama] 角色卡提取失败:', e.message);
                        charCardText = '';
                    }

                    // 解析角色卡，提取主角英文描述作为图像一致性锚点
                    let mainCharDesc = '';
                    const charMatch = charCardText.match(/图像生成关键词[（(]英文[）)][:：]\s*([^\n]+)/i);
                    if (charMatch) mainCharDesc = charMatch[1].trim();

                    // ========== Step 2: 生成结构化剧本（Toonflow核心精华）==========
                    callbacks.onProgress?.('生成剧本', 8, '正在将小说转换为结构化剧本...');
                    let scriptText = '';
                    try {
                        const scriptPrompt = `请将以下小说内容转换为 ${n} 个分镜的短剧剧本。

小说内容：
${novel.substring(0, 3000)}

${charCardText ? '角色设定：\n' + charCardText.substring(0, 500) : ''}

输出格式（每个分镜一段）：
【分镜1】
场景：室内/室外/时间地点
前景：近处的主要元素
中景：角色位置和动作
背景：环境描述
镜头：特写/中景/远景/俯拍/仰拍
对白：（如有）"台词内容"
情绪：紧张/温馨/悲伤/欢快/神秘

共输出 ${n} 个分镜，保持故事连贯性，有开头发展高潮结尾。`;
                        if (typeof callScriptGenerator === 'function') {
                            scriptText = await callScriptGenerator({}, scriptPrompt);
                        }
                        results.script = scriptText;
                        callbacks.onStepComplete?.('剧本', { preview: scriptText.substring(0, 150) + '...' });
                    } catch (e) {
                        console.warn('[novel_to_drama] 剧本生成失败:', e.message);
                        scriptText = novel;
                    }

                    // ========== Step 3: 解析分镜描述（Toonflow分镜prompt工程）==========
                    const rawPanels = scriptText.split(/【分镜\d+】/i).filter(s => s.trim().length > 10);
                    const panelDescs = rawPanels.length >= 3 ? rawPanels : novel.split(/[。！？\n]+/).filter(s => s.trim()).slice(0, n);

                    // 解析参考图
                    const dramaRefs = await resolveRefImages(styleRef);
                    let refImage = dramaRefs.first;
                    const allRefImages = dramaRefs.all;

                    // ========== Step 4: 生成角色一致性锚点图（无参考图时）==========
                    if (!refImage && mainCharDesc && panelDescs.length > 1) {
                        callbacks.onProgress?.('生成角色锚点', 12, '生成角色一致性参考图...');
                        try {
                            const anchorPrompt = `${designStyle}, character reference sheet, ${mainCharDesc}, full body, front view, clean background, character design, high quality`;
                            refImage = await callImageAPIWithRefs(anchorPrompt, { aspectRatio: '1:1' }, allRefImages);
                            results.characters.push({ name: '主角参考', imageUrl: refImage });
                            callbacks.onStepComplete?.('角色锚点', { imageUrl: refImage });
                        } catch (e) {
                            console.warn('[novel_to_drama] 角色锚点生成失败:', e.message);
                        }
                    }

                    // ========== Step 5: 并行生成分镜图像（带角色一致性）==========
                    const actualCount = Math.min(n, panelDescs.length);
                    callbacks.onProgress?.('并行生成分镜', 15, `同时生成 ${actualCount} 个分镜画面...`);

                    let donePanels = 0;
                    const panelPromises = Array.from({ length: actualCount }, (_, i) => (async () => {
                        const rawDesc = panelDescs[i] || '';
                        // 提取分镜中的场景/镜头/情绪关键词，构建高质量 prompt
                        const sceneMatch = rawDesc.match(/场景[:：]\s*([^\n]+)/);
                        const shotMatch = rawDesc.match(/镜头[:：]\s*([^\n]+)/);
                        const moodMatch = rawDesc.match(/情绪[:：]\s*([^\n]+)/);
                        const fgMatch = rawDesc.match(/前景[:：]\s*([^\n]+)/);
                        const mgMatch = rawDesc.match(/中景[:：]\s*([^\n]+)/);
                        const bgMatch = rawDesc.match(/背景[:：]\s*([^\n]+)/);

                        const sceneDesc = [
                            fgMatch?.[1], mgMatch?.[1], bgMatch?.[1],
                            sceneMatch?.[1], shotMatch?.[1], moodMatch?.[1]
                        ].filter(Boolean).join(', ') || rawDesc.substring(0, 300);

                        const charAnchor = mainCharDesc ? `${mainCharDesc}, ` : '';
                        const panelPrompt = `${designStyle}, ${charAnchor}${sceneDesc}, cinematic composition, storyboard panel ${i + 1}, high quality, detailed`;

                        const opts = { aspectRatio: '16:9' };
                        if (refImage) opts.refImage = refImage;

                        try {
                            const imageUrl = await callImageAPIWithRefs(panelPrompt, opts, allRefImages);
                            donePanels++;
                            const pct = 15 + Math.round((donePanels / actualCount) * (outputMode === 'image_video' ? 40 : 80));
                            callbacks.onProgress?.(`已完成 ${donePanels}/${actualCount}`, pct, `✅ 分镜${i + 1}`);
                            callbacks.onStepComplete?.(`分镜${i + 1}`, { imageUrl });
                            return { index: i + 1, description: rawDesc.substring(0, 120), imageUrl, status: 'success' };
                        } catch (e) {
                            donePanels++;
                            callbacks.onProgress?.(`已完成 ${donePanels}/${actualCount}`, 15 + Math.round((donePanels / actualCount) * 40), `❌ 分镜${i + 1}`);
                            return { index: i + 1, description: rawDesc.substring(0, 120), error: e.message, status: 'failed' };
                        }
                    })());

                    results.panels = (await Promise.all(panelPromises)).sort((a, b) => a.index - b.index);

                    // ========== Step 6: 图生视频（可选）==========
                    if (outputMode === 'image_video') {
                        const successPanels = results.panels.filter(p => p.status === 'success' && p.imageUrl);
                        callbacks.onProgress?.('图生视频', 55, `并行生成 ${successPanels.length} 段视频...`);

                        let doneVids = 0;
                        const vidPromises = successPanels.map(panel => (async () => {
                            try {
                                const motionDesc = panelDescs[panel.index - 1]?.substring(0, 200) || panel.description;
                                const videoUrl = await callSora2ImageToVideoAPI(
                                    panel.imageUrl,
                                    motionDesc,
                                    { model: videoModel || 'wan26-720p-5s', duration: 5, aspectRatio: '16:9' }
                                );
                                doneVids++;
                                const pct = 55 + Math.round((doneVids / successPanels.length) * 40);
                                callbacks.onProgress?.(`视频 ${doneVids}/${successPanels.length}`, pct, `✅ 视频${panel.index}`);
                                callbacks.onStepComplete?.(`视频${panel.index}`, { videoUrl });
                                return { index: panel.index, videoUrl, status: 'success' };
                            } catch (e) {
                                doneVids++;
                                callbacks.onProgress?.(`视频 ${doneVids}/${successPanels.length}`, 55 + Math.round((doneVids / successPanels.length) * 40), `❌ 视频${panel.index}`);
                                return { index: panel.index, error: e.message, status: 'failed' };
                            }
                        })());

                        results.videos = (await Promise.all(vidPromises)).sort((a, b) => a.index - b.index);
                    }

                    const imgOk = results.panels.filter(p => p.status === 'success').length;
                    const vidOk = results.videos.filter(v => v.status === 'success').length;
                    callbacks.onProgress?.('完成', 100, `分镜 ${imgOk}/${actualCount} 张${outputMode === 'image_video' ? `，视频 ${vidOk}/${results.videos.length} 段` : ''}`);

                    return {
                        charCard: charCardText,
                        script: results.script,
                        characters: results.characters,
                        images: [
                            ...results.characters.map(c => ({ subject: c.name, imageUrl: c.imageUrl, status: 'success' })),
                            ...results.panels.map(p => ({ subject: `分镜${p.index}`, imageUrl: p.imageUrl, status: p.status, error: p.error }))
                        ],
                        videos: results.videos.filter(v => v.status === 'success').map(v => ({ subject: `视频${v.index}`, videoUrl: v.videoUrl }))
                    };
                }
            }
        ];

        // ========== 混元生3D ==========
        presetSkills.push({
            id: 'hunyuan3d',
            name: '混元生3D',
            icon: '🧊',
            category: 'image',
            description: '腾讯混元生3D专业版：输入文字描述或上传参考图，生成高精度3D模型（GLB格式），可下载用于游戏/设计/动画。约1-3分钟完成。',
            parameters: [
                {
                    key: 'prompt',
                    label: '文字描述',
                    type: 'textarea',
                    required: false,
                    placeholder: '描述你想生成的3D模型，如：一只可爱的熊猫、一辆赛车...',
                    hint: '中文描述即可，与参考图二选一或同时提供'
                },
                {
                    key: 'refImage',
                    label: '参考图（可选）',
                    type: 'image',
                    hint: '上传参考图，AI 会根据图片生成3D模型'
                }
            ],
            estimateCost: () => ({ film: 30, time: '约1-3分钟' }),
            execute: async (params, callbacks) => {
                const { prompt, refImage } = params;
                if (!prompt && !refImage) throw new Error('请提供文字描述或参考图');

                callbacks.onProgress?.('提交任务', 5, '正在提交混元生3D任务...');

                let imageUrl = null;
                let imageBase64 = null;

                // 处理参考图
                if (refImage) {
                    const refs = await resolveRefImages(refImage);
                    if (refs.first) {
                        if (refs.first.startsWith('data:')) {
                            imageBase64 = refs.first.split(',')[1];
                        } else {
                            imageUrl = refs.first;
                        }
                    }
                }

                const result = await callHunyuan3DAPI({ prompt, imageUrl, imageBase64 });

                callbacks.onProgress?.('完成', 100, `生成完成，共 ${result.files.length} 个文件`);
                callbacks.onStepComplete?.('3D模型', { files: result.files });

                return {
                    jobId: result.jobId,
                    files: result.files,
                    // 兼容结果展示：取预览图作为 images
                    images: result.files
                        .filter(f => f.previewUrl)
                        .map(f => ({ subject: `3D预览(${f.type})`, imageUrl: f.previewUrl, status: 'success' })),
                    model3dFiles: result.files
                };
            }
        });

        // ========== AI写真 ==========
        presetSkills.push({
            id: 'ai_portrait',
            name: 'AI写真',
            icon: '🤳',
            category: 'image',
            description: '上传人像照片，AI生成专业写真大片。时尚大片、电商模特图、动漫写真等多种风格。',
            parameters: [
                { key: 'portrait', label: '人像照片', type: 'image', required: true, hint: '上传清晰人像照片，AI保留人物特征生成写真' },
                {
                    key: 'style', label: '写真风格', type: 'select', default: 'fashion',
                    options: [
                        { value: 'fashion', label: '🌟 时尚大片' },
                        { value: 'commercial', label: '🛍️ 商业电商' },
                        { value: 'artistic', label: '🎨 艺术写真' },
                        { value: 'natural', label: '🌿 自然清新' },
                        { value: 'vintage', label: '📷 复古胶片' },
                        { value: 'anime', label: '🎌 动漫写真' }
                    ]
                },
                { key: 'sceneDesc', label: '场景描述（可选）', type: 'text', placeholder: '例如：樱花树下、城市夜景、咖啡馆...', hint: '留空则AI自动生成' },
                {
                    key: 'aspectRatio', label: '图片比例', type: 'select', default: '3:4',
                    options: [
                        { value: '3:4', label: '3:4 竖版（推荐）' },
                        { value: '1:1', label: '1:1 正方形' },
                        { value: '9:16', label: '9:16 全屏' },
                        { value: '4:3', label: '4:3 横版' }
                    ]
                }
            ],
            estimateCost: () => ({ film: calculateImageCost('qwen-image-max') * 3, time: '约1-2分钟' }),
            execute: async (params, callbacks) => {
                const { portrait, style, sceneDesc, aspectRatio } = params;
                const refs = await resolveRefImages(portrait);
                if (!refs.first) throw new Error('请上传人像照片');
                const styleMap = {
                    fashion: 'high fashion editorial photography, professional studio lighting, luxury magazine cover style, glamorous',
                    commercial: 'commercial e-commerce model photo, clean professional look, soft studio background, natural lighting',
                    artistic: 'artistic portrait photography, dramatic moody lighting, fine art aesthetic, cinematic bokeh',
                    natural: 'natural light portrait, outdoor soft lighting, fresh candid style, warm tones, lifestyle',
                    vintage: 'vintage film photography style, warm retro tones, grain texture, nostalgic analog look',
                    anime: 'anime style portrait illustration, vibrant colors, clean line art, visual novel character art'
                };
                const scenePrompt = sceneDesc ? `, scene: ${sceneDesc}` : '';
                const prompt = `Professional portrait of the same person from the reference image. ${styleMap[style] || styleMap.fashion}${scenePrompt}. Keep face and identity consistent with reference. Ultra high quality 8K`;
                const opts = { imageUrl: refs.first, aspectRatio: aspectRatio || '3:4', model: 'qwen-image-max' };
                callbacks.onProgress?.('生成写真', 10, '并行生成3张写真...');
                let done = 0;
                const results = await Promise.all([1, 2, 3].map(i =>
                    callBanana2ImageAPI(prompt, opts)
                        .then(url => { done++; callbacks.onProgress?.(`完成${done}/3`, done * 30 + 10, `✅ 写真${i}`); callbacks.onStepComplete?.(`写真${i}`, { imageUrl: url }); return { subject: `写真${i}`, imageUrl: url, status: 'success' }; })
                        .catch(e => { done++; return { subject: `写真${i}`, error: e.message, status: 'failed' }; })
                ));
                callbacks.onProgress?.('完成', 100, `生成 ${results.filter(r => r.status === 'success').length}/3 张写真`);
                return { images: results };
            }
        });

        // ========== 商品背景替换 ==========
        presetSkills.push({
            id: 'product_bg_replace',
            name: '商品背景替换',
            icon: '🛍️',
            category: 'image',
            description: '上传商品图，一键替换为白底、场景、节日等背景。电商运营必备，快速出主图。',
            parameters: [
                { key: 'productImage', label: '商品图片', type: 'image', required: true, hint: '上传需要替换背景的商品照片' },
                {
                    key: 'bgType', label: '背景类型', type: 'select', default: 'white',
                    options: [
                        { value: 'white', label: '⬜ 纯白底（电商标准）' },
                        { value: 'gradient', label: '🌈 渐变色背景' },
                        { value: 'scene', label: '🌿 生活场景背景' },
                        { value: 'festive', label: '🎉 节日活动背景' },
                        { value: 'luxury', label: '✨ 高端质感背景' },
                        { value: 'custom', label: '✏️ 自定义描述' }
                    ]
                },
                { key: 'bgDesc', label: '背景描述（自定义时填写）', type: 'text', placeholder: '例如：薰衣草花田、现代简约客厅...', hint: '选择"自定义描述"时填写' },
                {
                    key: 'aspectRatio', label: '输出比例', type: 'select', default: '1:1',
                    options: [
                        { value: '1:1', label: '1:1 正方形（天猫/京东）' },
                        { value: '3:4', label: '3:4 竖版' },
                        { value: '16:9', label: '16:9 横幅' },
                        { value: '9:16', label: '9:16 手机全屏' }
                    ]
                }
            ],
            estimateCost: () => ({ film: calculateImageCost('qwen-image-max') * 2, time: '约1分钟' }),
            execute: async (params, callbacks) => {
                const { productImage, bgType, bgDesc, aspectRatio } = params;
                const refs = await resolveRefImages(productImage);
                if (!refs.first) throw new Error('请上传商品图片');
                const bgMap = {
                    white: 'pure white seamless background, professional product photography studio, clean white backdrop',
                    gradient: 'soft gradient background, modern aesthetic, smooth color transition, professional showcase',
                    scene: 'natural lifestyle scene, soft bokeh background, complementary environment enhancing the product',
                    festive: 'festive celebration background, colorful decorations, festive atmosphere, promotional banner style',
                    luxury: 'luxury premium dark marble surface, high-end product showcase, elegant studio lighting',
                    custom: bgDesc || 'beautiful professional background'
                };
                const prompt = `Product photography: keep the exact product from the reference completely unchanged, replace only the background with: ${bgMap[bgType] || bgMap.white}. Product must remain identical in shape, color, details. Professional product photography, sharp focus`;
                const opts = { imageUrl: refs.first, aspectRatio: aspectRatio || '1:1', model: 'qwen-image-max' };
                callbacks.onProgress?.('处理商品图', 10, '分析商品并替换背景...');
                const results = await Promise.all([1, 2].map(i =>
                    callBanana2ImageAPI(i === 2 ? prompt + ', slightly different lighting' : prompt, opts)
                        .then(url => { callbacks.onStepComplete?.(`背景效果${i}`, { imageUrl: url }); return { subject: `背景效果${i}`, imageUrl: url, status: 'success' }; })
                        .catch(e => ({ subject: `背景效果${i}`, error: e.message, status: 'failed' }))
                ));
                callbacks.onProgress?.('完成', 100, `生成 ${results.filter(r => r.status === 'success').length} 张背景替换图`);
                return { images: results };
            }
        });

        // ========== 风格变身 ==========
        presetSkills.push({
            id: 'style_transfer',
            name: '风格变身',
            icon: '🎨',
            category: 'image',
            description: '上传任意图片，一键变换艺术风格。日漫、油画、水彩、赛博朋克、吉卜力...轻松打造创意视觉。',
            parameters: [
                { key: 'sourceImage', label: '原始图片', type: 'image', required: true, hint: '上传需要进行风格变换的图片' },
                {
                    key: 'targetStyle', label: '目标风格', type: 'select', default: 'anime',
                    options: [
                        { value: 'anime', label: '🎌 日本动漫' },
                        { value: 'pixar', label: '🎬 皮克斯3D' },
                        { value: 'oilpaint', label: '🖼️ 油画大师' },
                        { value: 'watercolor', label: '🎨 水彩插画' },
                        { value: 'cyberpunk', label: '🌃 赛博朋克' },
                        { value: 'ink', label: '🖌️ 中国水墨' },
                        { value: 'sketch', label: '✏️ 素描铅笔' },
                        { value: 'ghibli', label: '🌿 吉卜力风' },
                        { value: 'pixel', label: '👾 像素艺术' },
                        { value: 'lowpoly', label: '💎 低多边形' }
                    ]
                },
                {
                    key: 'aspectRatio', label: '输出比例', type: 'select', default: '1:1',
                    options: [
                        { value: '1:1', label: '1:1 正方形' },
                        { value: '9:16', label: '9:16 竖版' },
                        { value: '16:9', label: '16:9 横版' },
                        { value: '3:4', label: '3:4 竖版标准' }
                    ]
                }
            ],
            estimateCost: () => ({ film: calculateImageCost('qwen-image-max') * 2, time: '约1-2分钟' }),
            execute: async (params, callbacks) => {
                const { sourceImage, targetStyle, aspectRatio } = params;
                const refs = await resolveRefImages(sourceImage);
                if (!refs.first) throw new Error('请上传原始图片');
                const styleMap = {
                    anime: 'Japanese anime style illustration, vibrant colors, clean line art, anime shading, modern anime aesthetic',
                    pixar: 'Pixar 3D animation style, soft rounded shapes, warm lighting, colorful charming, Disney Pixar movie quality',
                    oilpaint: 'classical oil painting style, rich impasto texture, Old Masters technique, dramatic lighting, museum quality',
                    watercolor: 'watercolor painting style, soft flowing colors, paper texture, transparent washes, artistic illustration',
                    cyberpunk: 'cyberpunk neon aesthetic, dark futuristic, neon lights and holograms, blade runner inspired, high contrast',
                    ink: 'traditional Chinese ink painting, monochrome brush strokes, zen minimalism, rice paper texture, Sumi-e art',
                    sketch: 'detailed pencil sketch drawing, graphite texture, hatching and cross-hatching, fine art drawing',
                    ghibli: 'Studio Ghibli art style, soft pastoral colors, hand-drawn animation, nostalgic warmth, nature-inspired',
                    pixel: 'retro pixel art style, 16-bit game aesthetic, crisp pixel grid, limited color palette, retro game look',
                    lowpoly: 'low polygon geometric art, faceted surfaces, geometric abstraction, crystalline structure, digital art'
                };
                const prompt = `Transform this image into ${styleMap[targetStyle] || styleMap.anime}, maintaining the same composition and subjects from the reference image. High quality detailed professional artwork`;
                const opts = { imageUrl: refs.first, aspectRatio: aspectRatio || '1:1', model: 'qwen-image-max' };
                callbacks.onProgress?.('风格变换中', 10, `正在转换为${targetStyle}风格，生成2个版本...`);
                const results = await Promise.all([1, 2].map(i =>
                    callBanana2ImageAPI(prompt, opts)
                        .then(url => { callbacks.onStepComplete?.(`变换版本${i}`, { imageUrl: url }); return { subject: `变换版本${i}`, imageUrl: url, status: 'success' }; })
                        .catch(e => ({ subject: `变换版本${i}`, error: e.message, status: 'failed' }))
                ));
                callbacks.onProgress?.('完成', 100, `生成 ${results.filter(r => r.status === 'success').length}/2 个变换版本`);
                return { images: results };
            }
        });

        // ========== 智能扩图 ==========
        presetSkills.push({
            id: 'smart_outpaint',
            name: '智能扩图',
            icon: '🌅',
            category: 'image',
            description: '向外延伸扩展图片边界，AI自动填充协调内容。适合拓展画面构图、调整图片比例。',
            parameters: [
                { key: 'sourceImage', label: '原始图片', type: 'image', required: true, hint: '上传需要扩展的图片' },
                {
                    key: 'expandDirection', label: '扩展方向', type: 'select', default: 'wide',
                    options: [
                        { value: 'wide', label: '↔️ 横向扩展（→16:9）' },
                        { value: 'tall', label: '↕️ 纵向扩展（→9:16）' },
                        { value: 'all', label: '⬛ 四周均匀扩展' },
                        { value: 'top', label: '⬆️ 向上扩展' },
                        { value: 'bottom', label: '⬇️ 向下扩展' },
                        { value: 'left', label: '⬅️ 向左扩展' },
                        { value: 'right', label: '➡️ 向右扩展' }
                    ]
                },
                { key: 'contentHint', label: '扩展内容描述（可选）', type: 'text', placeholder: '例如：蓝天白云、城市街道、森林小径...', hint: '描述扩展区域应有什么内容，留空则AI自动延续原图风格' }
            ],
            estimateCost: () => ({ film: calculateImageCost('qwen-image-max') * 2, time: '约1分钟' }),
            execute: async (params, callbacks) => {
                const { sourceImage, expandDirection, contentHint } = params;
                const refs = await resolveRefImages(sourceImage);
                if (!refs.first) throw new Error('请上传需要扩展的图片');
                const dirMap = {
                    wide: { prompt: 'extend the image horizontally to create a cinematic 16:9 widescreen format, adding more scene on left and right sides', ratio: '16:9' },
                    tall: { prompt: 'extend the image vertically to create a 9:16 portrait format, adding more scene on top and bottom', ratio: '9:16' },
                    all: { prompt: 'extend the image in all four directions, expanding the scene naturally outward', ratio: '1:1' },
                    top: { prompt: 'extend the image upward, revealing more sky or upper environment above', ratio: '3:4' },
                    bottom: { prompt: 'extend the image downward, revealing more ground or lower environment', ratio: '3:4' },
                    left: { prompt: 'extend the image to the left, revealing more of the scene on the left side', ratio: '16:9' },
                    right: { prompt: 'extend the image to the right, revealing more of the scene on the right side', ratio: '16:9' }
                };
                const { prompt: dirPrompt, ratio } = dirMap[expandDirection] || dirMap.wide;
                const contentPrompt = contentHint ? `. Extended area should show: ${contentHint}` : '';
                const prompt = `Outpaint this image: ${dirPrompt}${contentPrompt}. Seamlessly continue the visual style, lighting, colors and atmosphere of the original. Original image content appears in appropriate position within expanded canvas. High quality photorealistic seamless blending`;
                callbacks.onProgress?.('智能扩图中', 10, '分析图片并生成扩展内容...');
                const results = await Promise.all([1, 2].map(i =>
                    callBanana2ImageAPI(prompt, { imageUrl: refs.first, aspectRatio: ratio, model: 'qwen-image-max' })
                        .then(url => { callbacks.onStepComplete?.(`扩图结果${i}`, { imageUrl: url }); return { subject: `扩图结果${i}`, imageUrl: url, status: 'success' }; })
                        .catch(e => ({ subject: `扩图结果${i}`, error: e.message, status: 'failed' }))
                ));
                callbacks.onProgress?.('完成', 100, `生成 ${results.filter(r => r.status === 'success').length}/2 张扩图结果`);
                return { images: results };
            }
        });

        // 注册所有预置 Skills
        SkillManager.registerAll(presetSkills);

        console.log('🧩 预置 Skills 注册完成（23 个技能）');
    }
})();
