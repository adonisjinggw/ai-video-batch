/**
 * 馃З RollRoll Skill 鎶€鑳界郴缁?- 棰勭疆鎶€鑳藉畾涔? * 鍖呭惈 10 涓垚鐔熺殑鐢熶骇绾ф妧鑳? */

(function () {
    'use strict';

    // 馃帹 閫氱敤鐢熷浘妯″瀷閫夐」锛堝繀椤诲湪 registerPresetSkills 涔嬪墠澹版槑锛岄伩鍏?TDZ锛?    const IMAGE_MODEL_OPTIONS = [
        { value: 'doubao-seedream-4-5-251128', label: '鉁?鏄熸ⅵ鐢诲笀锛堟帹鑽?7鑳剁墖锛? },
        { value: 'nano-banana-2', label: '馃帹 Banana 鏍囧噯锛?鑳剁墖锛? },
        { value: 'nano-banana-2-4k', label: '馃拵 Banana 4K锛?0鑳剁墖锛? },
        { value: 'modelscope', label: '馃啌 鏅鸿兘缁樺浘锛堝厤璐癸級' },
        { value: 'Qwen/Qwen-Image-2512', label: '馃専 閫氫箟涓囪薄Max锛?鑳剁墖锛? },
        { value: 'midjourney-fast', label: '馃帹 MJ Fast锛?鑳剁墖锛? },
        { value: 'midjourney-turbo', label: '鈿?MJ Turbo锛?鑳剁墖锛? },
        { value: 'midjourney-relax', label: '馃悽 MJ Relax锛?鑳剁墖锛? }
    ];

    // 馃幀 閫氱敤瑙嗛妯″瀷閫夐」
    const VIDEO_MODEL_OPTIONS = [
        { value: 'modelscope-video', label: '馃啌 榄斿瑙嗛锛堝厤璐癸級' },
        { value: 'sora-2-vip-all', label: 'Sora-2 VIP锛堣繃娓?10s锛? },
        // { value: 'sora-2-all', label: 'Sora-2锛堝凡鍋滅敤锛? },
        // { value: 'sora-2-pro-all', label: 'Sora-2 Pro锛堝凡鍋滅敤锛? },
        { value: 'veo3.1', label: 'Veo 3.1 4K锛堣秴娓?8s锛? },
        { value: 'veo2', label: 'Veo 2.0锛?s锛? },
        { value: 'grok-video-3', label: 'Grok Video 3锛?s锛? },
        { value: 'kling-2.5-720p-5s', label: '鍙伒 2.5 720p 5s' },
        { value: 'kling-2.5-720p-10s', label: '鍙伒 2.5 720p 10s' },
        { value: 'kling-2.5-1080p-5s', label: '鍙伒 2.5 1080p 5s' },
        { value: 'kling-o1-720p-5s', label: '鍙伒 O1 720p 5s' },
        { value: 'hailuo-02-768p-6s', label: '娴疯灪 02 768p 6s' },
        { value: 'hailuo-02-768p-10s', label: '娴疯灪 02 768p 10s' },
        { value: 'hailuo-fast-768p-6s', label: '娴疯灪 Fast 768p 6s' },
        { value: 'vidu-q2-pro-8s-1080p', label: 'Vidu Q2 Pro 1080p 8s' },
        { value: 'vidu-q3-pro-8s-1080p', label: 'Vidu Q3 Pro 1080p 8s' },
        { value: 'vidu-q2-turbo-4s-720p', label: 'Vidu Q2 Turbo 720p 4s' },
        { value: 'vidu-q2-4s-720p', label: 'Vidu Q2 720p 4s' },
        { value: 'wan26-720p-5s', label: 'Wan2.6 720p 5s' },
        { value: 'wan26-1080p-5s', label: 'Wan2.6 1080p 5s' },
        { value: 'wan26-720p-10s', label: 'Wan2.6 720p 10s' },
        { value: 'wan26-1080p-10s', label: 'Wan2.6 1080p 10s' },
        { value: 'wan26-720p-15s', label: 'Wan2.6 720p 15s' },
        { value: 'wan26-1080p-15s', label: 'Wan2.6 1080p 15s' },
        { value: 'wan26-720p-5s-audio', label: 'Wan2.6 720p 5s 鏈夊０' },
        { value: 'wan26-1080p-5s-audio', label: 'Wan2.6 1080p 5s 鏈夊０' },
        { value: 'wan26-720p-10s-audio', label: 'Wan2.6 720p 10s 鏈夊０' },
        { value: 'wan26-1080p-10s-audio', label: 'Wan2.6 1080p 10s 鏈夊０' },
        { value: 'wan26-720p-15s-audio', label: 'Wan2.6 720p 15s 鏈夊０' },
        { value: 'wan26-1080p-15s-audio', label: 'Wan2.6 1080p 15s 鏈夊０' }
    ];

    // 绛夊緟 SkillManager 鍔犺浇
    if (typeof SkillManager === 'undefined') {
        console.warn('[SkillPresets] 绛夊緟 SkillManager 鍔犺浇...');
        setTimeout(() => {
            if (typeof SkillManager !== 'undefined') {
                registerPresetSkills();
            }
        }, 500);
        return;
    }

    registerPresetSkills();

    /**
     * 馃柤锔?缁熶竴瑙ｆ瀽鍙傝€冨浘鍙傛暟锛堝吋瀹?base64 鏁扮粍 / FileList / 鍗曟枃浠讹級
     * @param {Array|FileList|null} imageParam - 浠?collectSkillParams 杩斿洖鐨勫浘鐗囧弬鏁?     * @returns {Promise<{first: string|null, all: string[]}>} first=绗竴寮燽ase64, all=鍏ㄩ儴base64鏁扮粍
     */
    async function resolveRefImages(imageParam) {
        if (!imageParam || (Array.isArray(imageParam) && imageParam.length === 0)) {
            return { first: null, all: [] };
        }
        // 宸叉槸 base64 鏁扮粍锛堜粠 skillImageStore 鏉ワ級
        if (Array.isArray(imageParam) && typeof imageParam[0] === 'string') {
            return { first: imageParam[0], all: [...imageParam] };
        }
        // FileList 鎴栫被浼煎璞?        const files = Array.from(imageParam);
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
     * 馃柤锔?鍥剧墖鍘嬬缉鍑芥暟锛氶伩鍏?13閿欒
     * @param {string} dataUrl - base64鍥剧墖
     * @param {number} maxSize - 鏈€澶у昂瀵革紙瀹芥垨楂橈級
     * @param {number} quality - 鍘嬬缉璐ㄩ噺 0-1
     * @returns {Promise<string>} 鍘嬬缉鍚庣殑base64
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
     * 馃帹 鏅鸿兘璋冪敤鍥剧墖鐢熸垚 API
     * 鏀寔 imageModel 璺敱锛?     *   doubao-seedream-* / nano-banana-2 / nano-banana-2-4k / modelscope /
     *   Qwen/Qwen-Image-2512 / midjourney-fast / midjourney-turbo / midjourney-relax
     */
    async function callImageAPIWithRefs(prompt, opts, refImages) {
        const imageModel = opts?.imageModel || '';

        // 馃帹 Midjourney 璺敱
        if (imageModel.startsWith('midjourney') && typeof callMidjourneyImageAPI === 'function') {
            console.log(`馃帹 [MJ璺敱] 浣跨敤 ${imageModel}`);
            return await callMidjourneyImageAPI(prompt, { ...opts, model: imageModel });
        }

        // 馃帹 ModelScope 璺敱
        if (imageModel === 'modelscope' && typeof callModelScopeImageAPI === 'function') {
            console.log(`馃柤锔?[ModelScope璺敱] 浣跨敤鏅鸿兘缁樺浘`);
            return await callModelScopeImageAPI(prompt, { ...opts, refImages });
        }

        // 鉁?鏄熸ⅵ鐢诲笀 / Banana 4K / Banana 2K / 閫氫箟涓囪薄 鈫?閫氳繃 callBanana2ImageAPI 鎸囧畾 model
        if ((imageModel.includes('seedream') || imageModel.includes('doubao') ||
             imageModel.includes('banana-2-4k') || imageModel.includes('banana-2-2k') ||
             imageModel.startsWith('Qwen/')) && typeof callBanana2ImageAPI === 'function') {
            console.log(`馃帹 [妯″瀷璺敱] 浣跨敤 ${imageModel}`);
            return await callBanana2ImageAPI(prompt, { ...opts, model: imageModel });
        }

        // 澶氬浘鍙傝€冿紙>= 2寮狅級鈫?浼樺厛璧?ModelScope 鐨?image2image
        if (refImages && refImages.length >= 2 && typeof callModelScopeImageAPI === 'function') {
            console.log(`馃柤锔?[澶氬浘鍙傝€僝 浣跨敤 ModelScope image2image锛?{refImages.length}寮犲弬鑰冨浘`);
            return await callModelScopeImageAPI(prompt, { ...opts, refImages });
        }
        // 榛樿 鈫?Banana2
        if (typeof callBanana2ImageAPI === 'function') {
            return await callBanana2ImageAPI(prompt, { ...opts, model: imageModel || 'nano-banana-2' });
        }
        if (typeof callModelScopeImageAPI === 'function') {
            return await callModelScopeImageAPI(prompt, opts);
        }
        throw new Error('鍥剧墖鐢熸垚鍔熻兘涓嶅彲鐢?);
    }

    // ==================== 馃挵 缁熶竴鎴愭湰璁＄畻鍑芥暟锛堜笌 yunwu.js 淇濇寔涓€鑷达級 ====================
    
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
        const m = String(videoModel || 'sora-2-vip-all').toLowerCase();
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
    
    // ==================== 馃 鏅鸿兘鍒嗘瀽杈呭姪鍑芥暟 ====================

    /** 妫€娴嬮厤闊冲満鏅?*/
    function _detectScene(text) {
        const t = text.toLowerCase();
        if (/\[.{1,10}\]/.test(text) && (text.match(/\[/g) || []).length >= 3) return 'story';
        if (/骞垮憡|鎺ㄥ箍|浜у搧|鍝佺墝|淇冮攢|涔皘浼樻儬/.test(t)) return 'ad';
        if (/璇剧▼|鏁欏|鐭ヨ瘑|绉戞櫘|璁茶В|鎾/.test(t)) return 'education';
        if (/娲绘臣|鎼炵瑧|鏈夎叮|寮€蹇億蹇箰|鍜曞挄|鐭棰?.test(t)) return 'lively';
        if (/灏忚|鏁呬簨|瑙掕壊|瀵硅瘽|骞挎挱鍓鏃佺櫧/.test(t)) return 'story';
        return 'narration';
    }

    /** 妫€娴嬮煶涔愮敤閫?*/
    function _detectMusicPurpose(desc) {
        const d = (desc || '').toLowerCase();
        if (/bgm|鑳屾櫙闊充箰|閰嶄箰|瑙嗛|鐭棰憒瀹ｄ紶鐗?.test(d)) return 'bgm';
        if (/姝屾洸|姝岃瘝|鍞眧浜哄０|鍞辨瓕|鍘熷垱姝?.test(d)) return 'song';
        if (/鏀炬澗|鍐ユ兂|鐫＄湢|鐧藉櫔闊硘鑷劧|姘涘洿/.test(d)) return 'ambient';
        if (/娓告垙|鍔ㄧ敾|鍍忕礌|鎴樻枟|鍐掗櫓/.test(d)) return 'game';
        if (/鍝佺墝|骞垮憡|浼佷笟|鍟嗕笟|钀ラ攢/.test(d)) return 'brand';
        return 'bgm';
    }

    /** 鏅鸿兘鐢熸垚闊充箰椋庢牸鏍囩 */
    function _generateMusicTags(desc, purpose) {
        const d = (desc || '').toLowerCase();
        const tags = [];

        // 鍩轰簬鐢ㄩ€旂殑鍩虹鏍囩
        const purposeTags = {
            bgm: ['instrumental', 'background'],
            song: ['vocal', 'pop'],
            ambient: ['ambient', 'calm', 'instrumental'],
            game: ['electronic', 'cinematic', 'instrumental'],
            brand: ['corporate', 'uplifting', 'instrumental']
        };
        if (purposeTags[purpose]) tags.push(...purposeTags[purpose]);

        // 鍩轰簬鎻忚堪鐨勯鏍兼娴?        if (/涓浗椋巪鍥介|鍙ゅ吀|鍙ら|姘村ⅷ|姘戜箰/.test(d)) tags.push('chinese folk', 'traditional');
        if (/鐢靛瓙|鐢甸煶|edm|dj|韫﹁开/.test(d)) tags.push('electronic', 'synth');
        if (/鎽囨粴|rock|鍚变粬/.test(d)) tags.push('rock', 'guitar');
        if (/鍢村＋|jazz|鎱版剰/.test(d)) tags.push('jazz', 'smooth');
        if (/璇村敱|rap|鍢村搱/.test(d)) tags.push('hip-hop', 'rap');
        if (/鍙茶瘲|瀹忓ぇ|澹附|鍙茶瘲鎰?.test(d)) tags.push('cinematic', 'epic', 'orchestral');
        if (/杞诲揩|娆㈠揩|娲绘臣|寮€蹇?.test(d)) tags.push('upbeat', 'happy');
        if (/鎮蹭激|浼ゆ劅|蹇ч儊|娣€?.test(d)) tags.push('sad', 'emotional', 'piano');
        if (/缇庨|缇庨鎺㈠簵|鐑归オ/.test(d)) tags.push('upbeat', 'fun', 'acoustic');
        if (/绉戝够|鏈潵|澶┖/.test(d)) tags.push('sci-fi', 'electronic', 'cinematic');
        if (/娴极|鐖辨儏|娓╅獖/.test(d)) tags.push('romantic', 'soft', 'piano');

        // 鍘婚噸锛岄檺鍒舵爣绛炬暟閲?        const unique = [...new Set(tags)];
        return unique.slice(0, 6).join(', ') || 'pop, melodic';
    }

    function registerPresetSkills() {
        const presetSkills = [
            // ==================== 瑙嗛绫?====================

            // 1. 鐭棰戞壒閲忕敓鎴?            {
                id: 'batch_short_video',
                name: '鐭棰戞壒閲忕敓鎴?,
                icon: '馃幀',
                category: 'video',
                description: '杈撳叆涓婚锛孉I 鑷姩鐢熸垚澶氫釜鐭棰戙€傛敮鎸佹壒閲忕敓鎴?1-20 涓棰戯紝姣忎釜瑙嗛鐙珛鍓ф湰鍜岀敾闈€?,
                parameters: [
                    {
                        key: 'topic',
                        label: '涓婚/鍏抽敭璇?,
                        type: 'textarea',
                        required: true,
                        placeholder: '渚嬪锛氫腑鍥藉彜浠ｇ璇濇晠浜嬨€佺骞诲啋闄┿€侀兘甯傜埍鎯?..',
                        hint: '杈撳叆涓€涓垱鎰忎富棰橈紝AI 浼氭嵁姝ょ敓鎴愬涓笉鍚岀殑鐭棰?
                    },
                    {
                        key: 'count',
                        label: '鐢熸垚鏁伴噺',
                        type: 'number',
                        default: 3,
                        min: 1,
                        max: 20,
                        hint: '寤鸿 3-5 涓紝鏁伴噺瓒婂鑰楁椂瓒婇暱'
                    },
                    {
                        key: 'style',
                        label: '瑙嗚椋庢牸',
                        type: 'select',
                        default: 'anime',
                        options: [
                            { value: 'anime', label: '馃帉 鏃ョ郴鍔ㄦ极' },
                            { value: 'realistic', label: '馃摳 鐪熶汉鍐欏疄' },
                            { value: 'chinese', label: '馃彯 鍥介鍙ゅ吀' },
                            { value: '3d', label: '馃幃 3D 娓叉煋' },
                            { value: 'watercolor', label: '馃帹 姘村僵鎻掔敾' },
                            { value: 'cyberpunk', label: '馃寖 璧涘崥鏈嬪厠' },
                            { value: 'retro', label: '馃摵 澶嶅彜鎬€鏃? },
                            { value: 'comic', label: '馃挜 缇庡紡婕敾' },
                            { value: 'pixel', label: '馃幃 鍍忕礌鑹烘湳' },
                            { value: 'vintage', label: '馃摲 鑰佺収鐗囬鏍? },
                            { value: 'studio', label: '馃幀 宸ヤ綔瀹よ川鎰? },
                            { value: 'documentary', label: '馃帴 绾綍鐗囬鏍? }
                        ]
                    },
                    {
                        key: 'aspectRatio',
                        label: '瑙嗛姣斾緥',
                        type: 'select',
                        default: '16:9',
                        options: [
                            { value: '16:9', label: '16:9 妯睆锛堟帹鑽愶級' },
                            { value: '9:16', label: '9:16 绔栧睆锛堟姈闊?蹇墜锛? },
                            { value: '1:1', label: '1:1 鏂瑰舰锛圛nstagram锛? },
                            { value: '4:3', label: '4:3 浼犵粺鐢佃' },
                            { value: '3:4', label: '3:4 灏忕孩涔? },
                            { value: '21:9', label: '21:9 瀹介摱骞曠數褰? }
                        ]
                    },
                    {
                        key: 'duration',
                        label: '鍗曚釜瑙嗛鏃堕暱锛堢锛?,
                        type: 'select',
                        default: '15',
                        options: [
                            { value: '5', label: '5 绉掞紙瓒呯煭锛? },
                            { value: '10', label: '10 绉? },
                            { value: '15', label: '15 绉掞紙鎺ㄨ崘锛? },
                            { value: '30', label: '30 绉? }
                        ]
                    },
                    {
                        key: 'aspectRatio',
                        label: '瑙嗛姣斾緥',
                        type: 'select',
                        default: '16:9',
                        options: [
                            { value: '16:9', label: '16:9 妯睆锛堟帹鑽愶級' },
                            { value: '9:16', label: '9:16 绔栧睆锛堟姈闊?蹇墜锛? },
                            { value: '1:1', label: '1:1 鏂瑰舰锛圛nstagram锛? },
                            { value: '4:3', label: '4:3 浼犵粺鐢佃' },
                            { value: '3:4', label: '3:4 灏忕孩涔? },
                            { value: '21:9', label: '21:9 瀹介摱骞曠數褰? }
                        ]
                    },
                    {
                        key: 'videoModel',
                        label: '瑙嗛妯″瀷',
                        type: 'select',
                        default: 'sora-2-vip-all',
                        options: VIDEO_MODEL_OPTIONS
                    },
                    {
                        key: 'imageModel',
                        label: '鐢熷浘妯″瀷',
                        type: 'select',
                        default: 'nano-banana-2',
                        options: IMAGE_MODEL_OPTIONS
                    },
                    {
                        key: 'styleRef',
                        label: '椋庢牸鍙傝€冨浘锛堝彲閫夛級',
                        type: 'image',
                        hint: '涓婁紶鍙傝€冨浘锛岃棰戠敾闈㈠皢妯′豢璇ラ鏍?
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
                        time: `绾?${count * timePerVideo} 鍒嗛挓`
                    };
                },
                execute: async (params, callbacks) => {
                    const { topic, count, style, aspectRatio, duration, videoModel, styleRef, imageModel } = params;
                    // 馃柤锔?瑙ｆ瀽鍙傝€冨浘锛堟敮鎸佸鍥撅級
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

                    // 馃帹 涓€鑷存€х瓥鐣ワ細鏃犲弬鑰冨浘鏃讹紝鍏堢敓鎴愮1寮犲浘浣滀负椋庢牸鍙傝€?                    let _autoRef = userRefImage;
                    if (!_autoRef && count > 1) {
                        callbacks.onProgress?.('鐢熸垚椋庢牸鍩哄噯', 3, '鍏堢敓鎴愮1寮犲浘鐗囦綔涓洪鏍煎弬鑰?..');
                        try {
                            const _seedPrompt = `${stylePrompts[style] || ''}, ${topic}, establishing shot, high quality, ${aspectRatio} aspect ratio`;
                            _autoRef = await callImageAPIWithRefs(_seedPrompt, { aspectRatio, imageModel }, allRefImages);
                            callbacks.onStepComplete?.('椋庢牸鍩哄噯鍥?, { imageUrl: _autoRef });
                        } catch (e) { console.warn('椋庢牸鍩哄噯鍥剧敓鎴愬け璐? 缁х画鏃犲弬鑰冪敓鎴?', e.message); }
                    }

                    callbacks.onProgress?.('骞惰鐢熸垚', 5, `鍚屾椂鐢熸垚 ${count} 涓棰?..`);
                    let _vDone = 0;
                    const results = await Promise.all(Array.from({ length: count }, (_, i) => (async () => {
                        try {
                            const scriptPrompt = `璇蜂负浠ヤ笅涓婚鐢熸垚涓€涓煭瑙嗛鍓ф湰锛屾椂闀跨害${duration}绉掞紝椋庢牸涓?{style}锛歕n${topic}\n\n瑕佹眰锛?1. 鍓ф湰瑕佺畝娲佹湁鍔涳紝閫傚悎鐭棰?2. 鍖呭惈鍏蜂綋鐨勭敾闈㈡弿杩?3. 绗?${i + 1} 涓棰戣涓庡叾浠栬棰戞湁鎵€涓嶅悓
4. 鐩存帴杈撳嚭鍓ф湰鍐呭锛屼笉瑕佽В閲奰;
                            let script = '';
                            if (typeof callScriptGenerator === 'function') {
                                script = await callScriptGenerator({}, scriptPrompt);
                            } else if (typeof callModelScopeTextAPI === 'function') {
                                script = await callModelScopeTextAPI(scriptPrompt);
                            } else { throw new Error('鏂囨湰鐢熸垚鍔熻兘涓嶅彲鐢?); }
                            callbacks.onStepComplete?.(`瑙嗛${i + 1} 鍓ф湰`, { script: script.substring(0, 100) + '...' });

                            const imagePrompt = `${stylePrompts[style] || ''}, ${script.substring(0, 200)}, high quality, ${aspectRatio} aspect ratio`;
                            const imgOpts = { aspectRatio, imageModel };
                            if (_autoRef) imgOpts.refImage = _autoRef;
                            const imageUrl = await callImageAPIWithRefs(imagePrompt, imgOpts, allRefImages);
                            callbacks.onStepComplete?.(`瑙嗛${i + 1} 灏侀潰鍥綻, { imageUrl });

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
                            callbacks.onStepComplete?.(`瑙嗛${i + 1} 瀹屾垚`, { videoUrl });

                            _vDone++;
                            callbacks.onProgress?.(`宸插畬鎴?${_vDone}/${count}`, Math.round((_vDone / count) * 95) + 5, `鉁?瑙嗛${i + 1}`);
                            return { index: i + 1, script, imageUrl, videoUrl, status: 'success' };
                        } catch (error) {
                            console.error(`瑙嗛 ${i + 1} 鐢熸垚澶辫触:`, error);
                            _vDone++;
                            callbacks.onProgress?.(`宸插畬鎴?${_vDone}/${count}`, Math.round((_vDone / count) * 95) + 5, `鉂?瑙嗛${i + 1}`);
                            return { index: i + 1, error: error.message, status: 'failed' };
                        }
                    })()));
                    results.sort((a, b) => a.index - b.index);

                    callbacks.onProgress?.('瀹屾垚', 100, `鎴愬姛鐢熸垚 ${results.filter(r => r.status === 'success').length}/${count} 涓棰慲);

                    return { videos: results, successCount: results.filter(r => r.status === 'success').length };
                }
            },

            // 2. 杩炵画鍓ф儏瑙嗛
            {
                id: 'continuous_story_video',
                name: '杩炵画鍓ф儏瑙嗛',
                icon: '馃摵',
                category: 'video',
                description: '鐢熸垚鏈夊墽鎯呰繛璐€х殑绯诲垪瑙嗛锛岄€傚悎杩炵画鍓с€佺郴鍒楁晠浜嬨€傛瘡涓墖娈佃鎺ヤ笂涓€娈电殑缁撳熬銆?,
                parameters: [
                    {
                        key: 'story',
                        label: '鏁呬簨澶х翰',
                        type: 'textarea',
                        required: true,
                        placeholder: '鎻忚堪涓€涓畬鏁寸殑鏁呬簨...',
                        hint: 'AI 浼氳嚜鍔ㄥ皢鏁呬簨鎷嗗垎涓哄涓繛璐墖娈?
                    },
                    {
                        key: 'episodes',
                        label: '鍒嗛泦鏁伴噺',
                        type: 'number',
                        default: 3,
                        min: 2,
                        max: 10
                    },
                    {
                        key: 'style',
                        label: '瑙嗚椋庢牸',
                        type: 'select',
                        default: 'anime',
                        options: [
                            { value: 'anime', label: '馃帉 鏃ョ郴鍔ㄦ极' },
                            { value: 'realistic', label: '馃摳 鐢靛奖璐ㄦ劅' },
                            { value: 'chinese', label: '馃彯 鍥介鍙ゅ吀' },
                            { value: '3d', label: '馃幃 3D 娓叉煋' },
                            { value: 'watercolor', label: '馃帹 姘村僵鎻掔敾' },
                            { value: 'cyberpunk', label: '馃寖 璧涘崥鏈嬪厠' },
                            { value: 'retro', label: '馃摵 澶嶅彜鎬€鏃? },
                            { value: 'comic', label: '馃挜 缇庡紡婕敾' },
                            { value: 'pixel', label: '馃幃 鍍忕礌鑹烘湳' },
                            { value: 'vintage', label: '馃摲 鑰佺収鐗囬鏍? },
                            { value: 'studio', label: '馃幀 宸ヤ綔瀹よ川鎰? },
                            { value: 'documentary', label: '馃帴 绾綍鐗囬鏍? }
                        ]
                    },
                    {
                        key: 'aspectRatio',
                        label: '瑙嗛姣斾緥',
                        type: 'select',
                        default: '16:9',
                        options: [
                            { value: '16:9', label: '16:9 妯睆锛堟帹鑽愶級' },
                            { value: '9:16', label: '9:16 绔栧睆锛堟姈闊?蹇墜锛? },
                            { value: '1:1', label: '1:1 鏂瑰舰锛圛nstagram锛? },
                            { value: '4:3', label: '4:3 浼犵粺鐢佃' },
                            { value: '3:4', label: '3:4 灏忕孩涔? },
                            { value: '21:9', label: '21:9 瀹介摱骞曠數褰? }
                        ]
                    },
                    {
                        key: 'videoModel',
                        label: '瑙嗛妯″瀷',
                        type: 'select',
                        default: 'sora-2-vip-all',
                        options: VIDEO_MODEL_OPTIONS
                    }
                ],
                estimateCost: (params) => {
                    const episodes = params.episodes || 3;
                    const videoFilm = calculateVideoCost(params.videoModel, 15);
                    const imgFilm = calculateImageCost(params.imageModel || 'nano-banana-2');
                    // 姣忛泦: 鏂囨湰1 + 鍥剧墖5 + 瑙嗛
                    return {
                        film: Math.ceil(episodes * (1 + imgFilm + videoFilm)),
                        time: `绾?${episodes * 3} 鍒嗛挓`
                    };
                },
                execute: async (params, callbacks) => {
                    const { story, episodes, style, aspectRatio, videoModel } = params;
                    const results = [];

                    // 鍏堢敓鎴愬垎闆嗗ぇ绾?                    callbacks.onProgress?.('瑙勫垝鍓ф儏', 5, '姝ｅ湪灏嗘晠浜嬫媶鍒嗕负澶氫釜鐗囨...');

                    const outlinePrompt = `璇峰皢浠ヤ笅鏁呬簨鎷嗗垎涓?${episodes} 涓繛缁墖娈碉紝姣忎釜鐗囨 15 绉掕棰戝唴瀹癸細

${story}

瑕佹眰锛?1. 姣忎釜鐗囨鍓ф儏杩炶疮
2. 姣忎釜鐗囨缁撳熬瑕佽缃偓蹇垫垨琛旀帴鐐?3. 杈撳嚭鏍煎紡涓猴細
鐗囨1锛歔鍐呭]
鐗囨2锛歔鍐呭]
...`;

                    let outline = '';
                    if (typeof callScriptGenerator === 'function') {
                        outline = await callScriptGenerator({}, outlinePrompt);
                    }

                    callbacks.onStepComplete?.('鍓ф儏瑙勫垝', { outline: outline.substring(0, 200) + '...' });

                    // 瑙ｆ瀽鐗囨
                    const segments = outline.split(/鐗囨\d+[锛?]/i).filter(s => s.trim());
                    let lastImageUrl = '';

                    for (let i = 0; i < Math.min(episodes, segments.length); i++) {
                        if (callbacks.isCancelled?.()) break;

                        const segment = segments[i]?.trim() || `绗?{i + 1}骞昤;
                        const progress = 10 + Math.round((i / episodes) * 85);
                        callbacks.onProgress?.(`鐢熸垚鐗囨 ${i + 1}/${episodes}`, progress, `姝ｅ湪鍒涗綔绗?${i + 1} 闆?..`);

                        try {
                            // 鐢熸垚鏈泦鐢婚潰
                            const styleMap = {
                                anime: 'anime style, Japanese animation',
                                realistic: 'cinematic, photorealistic',
                                chinese: 'Chinese traditional art',
                                '3d': '3D rendered, Pixar style, high quality CGI',
                                watercolor: 'watercolor painting, soft colors, artistic',
                                cyberpunk: 'cyberpunk style, neon lights, futuristic city',
                                retro: 'retro 80s/90s style, vintage aesthetic',
                                comic: 'American comic style, bold lines, vibrant colors',
                                pixel: 'pixel art, retro game style',
                                vintage: 'vintage photo style, film grain, warm tones',
                                studio: 'studio photography, professional lighting',
                                documentary: 'documentary style, realistic, handheld camera'
                            };

                            const imagePrompt = `${styleMap[style]}, ${segment.substring(0, 300)}, sequential storytelling, ${aspectRatio} aspect ratio`;

                            let imageUrl = '';
                            const _storyOpts = { aspectRatio };
                            if (lastImageUrl) _storyOpts.refImage = lastImageUrl;
                            imageUrl = await callImageAPIWithRefs(imagePrompt, _storyOpts, []);

                            // 鐢熸垚瑙嗛
                            let videoUrl = '';
                            if (videoModel && String(videoModel).toLowerCase().includes('modelscope')) {
                                if (imageUrl && typeof callModelScopeImageToVideoAPI === 'function') {
                                    videoUrl = await callModelScopeImageToVideoAPI(segment, imageUrl, { duration: 15, aspectRatio, model: videoModel });
                                } else if (typeof callModelScopeVideoAPI === 'function') {
                                    videoUrl = await callModelScopeVideoAPI(segment, { duration: 15, aspectRatio, model: videoModel });
                                }
                            } else if (imageUrl && typeof callSora2ImageToVideoAPI === 'function') {
                                videoUrl = await callSora2ImageToVideoAPI(imageUrl, segment, {
                                    model: videoModel || 'sora-2-all',
                                    duration: 15,
                                    aspectRatio
                                });
                            }

                            lastImageUrl = imageUrl; // 淇濆瓨鐢ㄤ簬涓嬩竴闆嗗弬鑰?
                            callbacks.onStepComplete?.(`绗?{i + 1}闆哷, { videoUrl });

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

                    callbacks.onProgress?.('瀹屾垚', 100, `鎴愬姛鐢熸垚 ${results.filter(r => r.status === 'success').length}/${episodes} 闆哷);

                    return { episodes: results };
                }
            },

            // 3. 鍥剧敓瑙嗛鎵归噺
            {
                id: 'batch_image_to_video',
                name: '鍥剧敓瑙嗛鎵归噺',
                icon: '馃柤锔?,
                category: 'video',
                description: '涓婁紶澶氬紶鍥剧墖锛屾壒閲忚浆鎹负鍔ㄦ€佽棰戙€傞€傚悎灏嗘彃鐢汇€佺収鐗囩瓑闈欐€佸唴瀹硅浆涓哄姩鐢汇€?,
                parameters: [
                    {
                        key: 'images',
                        label: '涓婁紶鍥剧墖',
                        type: 'image',
                        required: true,
                        multiple: true,
                        hint: '鏀寔 JPG/PNG锛屾渶澶?10 寮?
                    },
                    {
                        key: 'motion',
                        label: '杩愬姩绫诲瀷',
                        type: 'select',
                        default: 'natural',
                        options: [
                            { value: 'natural', label: '鑷劧杩愬姩' },
                            { value: 'zoom', label: '鎺ㄦ媺闀滃ご' },
                            { value: 'pan', label: '骞崇Щ闀滃ご' },
                            { value: 'dramatic', label: '鎴忓墽鍔ㄤ綔' }
                        ]
                    },
                    {
                        key: 'duration',
                        label: '瑙嗛鏃堕暱',
                        type: 'select',
                        default: '5',
                        options: [
                            { value: '5', label: '5 绉? },
                            { value: '10', label: '10 绉? },
                            { value: '15', label: '15 绉? }
                        ]
                    },
                    {
                        key: 'videoModel',
                        label: '瑙嗛妯″瀷',
                        type: 'select',
                        default: 'sora-2-vip-all',
                        options: VIDEO_MODEL_OPTIONS
                    }
                ],
                estimateCost: (params) => {
                    const imageCount = params.images?.length || 1;
                    const duration = parseInt(params.duration) || 5;
                    const videoFilm = calculateVideoCost(params.videoModel, duration);
                    return {
                        film: Math.ceil(imageCount * videoFilm),
                        time: `绾?${imageCount * 2} 鍒嗛挓`
                    };
                },
                execute: async (params, callbacks) => {
                    const { images, motion, duration, aspectRatio, videoModel } = params;
                    if (!images || images.length === 0) {
                        throw new Error('璇蜂笂浼犺嚦灏戜竴寮犲浘鐗?);
                    }

                    const motionPrompts = {
                        natural: 'natural movement, subtle animation, breathing effect',
                        zoom: 'slow zoom in, cinematic camera movement',
                        pan: 'smooth horizontal pan, tracking shot',
                        dramatic: 'dramatic action, dynamic movement'
                    };

                    callbacks.onProgress?.('骞惰鐢熸垚', 5, `鍚屾椂澶勭悊 ${images.length} 寮犲浘鐗?..`);
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
                                videoUrl = await callSora2ImageToVideoAPI(imageUrl, prompt, { model: videoModel || 'sora-2-all', duration: parseInt(duration), aspectRatio });
                            }
                            _i2vDone++;
                            callbacks.onProgress?.(`宸插畬鎴?${_i2vDone}/${images.length}`, Math.round((_i2vDone / images.length) * 95) + 5, `鉁?鍥剧墖${i + 1}`);
                            callbacks.onStepComplete?.(`鍥剧墖${i + 1}`, { videoUrl });
                            return { index: i + 1, fileName: file.name, videoUrl, status: 'success' };
                        } catch (error) {
                            _i2vDone++;
                            callbacks.onProgress?.(`宸插畬鎴?${_i2vDone}/${images.length}`, Math.round((_i2vDone / images.length) * 95) + 5, `鉂?鍥剧墖${i + 1}`);
                            return { index: i + 1, error: error.message, status: 'failed' };
                        }
                    })()));
                    results.sort((a, b) => a.index - b.index);

                    callbacks.onProgress?.('瀹屾垚', 100, `鎴愬姛澶勭悊 ${results.filter(r => r.status === 'success').length}/${images.length} 寮犲浘鐗嘸);

                    return { videos: results };
                }
            },

            // ==================== 鍥惧儚绫?====================

            // 4. 椋庢牸缁熶竴鍑哄浘
            {
                id: 'style_consistent_images',
                name: '椋庢牸缁熶竴鍑哄浘',
                icon: '馃帹',
                category: 'image',
                description: '鎸囧畾涓€绉嶉鏍硷紝鎵归噺鐢熸垚澶氬紶椋庢牸涓€鑷寸殑鍥剧墖銆傞€傚悎绱犳潗搴撱€佽〃鎯呭寘銆佺郴鍒楁彃鐢荤瓑銆?,
                parameters: [
                    {
                        key: 'styleRef',
                        label: '椋庢牸鍙傝€冿紙鍙€夛級',
                        type: 'image',
                        hint: '涓婁紶涓€寮犲弬鑰冨浘锛孉I 浼氭ā浠垮叾椋庢牸'
                    },
                    {
                        key: 'styleDesc',
                        label: '椋庢牸鎻忚堪',
                        type: 'text',
                        required: true,
                        placeholder: '渚嬪锛氳禌鍗氭湅鍏嬨€佹按澧ㄧ敾銆佹墎骞虫彃鐢?..',
                        hint: '鐢ㄦ枃瀛楁弿杩版兂瑕佺殑椋庢牸'
                    },
                    {
                        key: 'subjects',
                        label: '鍥剧墖涓婚锛堟瘡琛屼竴涓級',
                        type: 'textarea',
                        required: true,
                        placeholder: '涓€鍙彲鐖辩殑鐚挭\n涓€妫靛ぇ鏍慭n涓€搴у彜鍫n涓€杈嗚窇杞?,
                        hint: '姣忚杈撳叆涓€涓富棰橈紝灏嗙敓鎴愬搴旀暟閲忕殑鍥剧墖'
                    },
                    {
                        key: 'aspectRatio',
                        label: '鍥剧墖姣斾緥',
                        type: 'select',
                        default: '1:1',
                        options: [
                            { value: '1:1', label: '1:1 姝ｆ柟褰? },
                            { value: '16:9', label: '16:9 妯増' },
                            { value: '9:16', label: '9:16 绔栫増' },
                            { value: '4:3', label: '4:3 妯増鏍囧噯' },
                            { value: '3:4', label: '3:4 绔栫増鏍囧噯' }
                        ]
                    },
                    {
                        key: 'imageModel',
                        label: '鐢熷浘妯″瀷',
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
                        time: `绾?${Math.ceil(count * (params.imageModel?.startsWith('midjourney') ? 1.5 : 0.5))} 鍒嗛挓`
                    };
                },
                execute: async (params, callbacks) => {
                    const { styleRef, styleDesc, subjects, aspectRatio, imageModel } = params;
                    const subjectList = subjects.split('\n').filter(s => s.trim());

                    // 馃柤锔?瑙ｆ瀽鍙傝€冨浘锛堟敮鎸佸鍥撅級
                    const refs = await resolveRefImages(styleRef);
                    const refImageUrl = refs.first;
                    const allRefImages = refs.all;

                    // 馃帹 涓€鑷存€х瓥鐣ワ細鏃犲弬鑰冨浘鏃讹紝鍏堢敓鎴愮1寮犲浘浣滀负椋庢牸鍩哄噯
                    let _styleRef = refImageUrl;
                    if (!_styleRef && subjectList.length > 1) {
                        callbacks.onProgress?.('鐢熸垚椋庢牸鍩哄噯', 3, '鍏堢敓鎴愮1寮犲浘鐗囩‘瀹氶鏍?..');
                        try {
                            const _firstPrompt = `${styleDesc} style, ${subjectList[0].trim()}, high quality, detailed, consistent art style`;
                            _styleRef = await callImageAPIWithRefs(_firstPrompt, { aspectRatio, imageModel }, allRefImages);
                            callbacks.onStepComplete?.('椋庢牸鍩哄噯鍥?, { imageUrl: _styleRef });
                        } catch (e) { console.warn('椋庢牸鍩哄噯鍥惧け璐?', e.message); }
                    }

                    callbacks.onProgress?.('骞惰鐢熸垚', 5, `鍚屾椂鐢熸垚 ${subjectList.length} 寮犲浘鐗?..`);

                    // 馃殌 骞惰鐢熸垚鎵€鏈夊浘鐗囷紙宸叉湁鍩哄噯鐨勭1寮犱細澶嶇敤缂撳瓨锛?                    let completedCount = 0;
                    const promises = subjectList.map((subject, i) => {
                        const trimmed = subject.trim();
                        const prompt = `${styleDesc} style, ${trimmed}, high quality, detailed, consistent art style`;
                        const imgOpts = { aspectRatio, imageModel };
                        if (_styleRef) imgOpts.refImage = _styleRef;

                        // 绗?寮犲凡浣滀负鍩哄噯鍥剧敓鎴愯繃锛岀洿鎺ュ鐢?                        if (i === 0 && _styleRef && !refImageUrl) {
                            completedCount++;
                            callbacks.onProgress?.(`宸插畬鎴?1/${subjectList.length}`, 10, `鉁?${trimmed}`);
                            callbacks.onStepComplete?.(trimmed, { imageUrl: _styleRef });
                            return Promise.resolve({ subject: trimmed, imageUrl: _styleRef, status: 'success' });
                        }

                        return callImageAPIWithRefs(prompt, imgOpts, allRefImages)
                            .then(imageUrl => {
                                completedCount++;
                                const progress = Math.round((completedCount / subjectList.length) * 95) + 5;
                                callbacks.onProgress?.(`宸插畬鎴?${completedCount}/${subjectList.length}`, progress, `鉁?${trimmed}`);
                                callbacks.onStepComplete?.(trimmed, { imageUrl });
                                return { subject: trimmed, imageUrl, status: 'success' };
                            })
                            .catch(error => {
                                completedCount++;
                                const progress = Math.round((completedCount / subjectList.length) * 95) + 5;
                                callbacks.onProgress?.(`宸插畬鎴?${completedCount}/${subjectList.length}`, progress, `鉂?${trimmed}: ${error.message}`);
                                return { subject: trimmed, error: error.message, status: 'failed' };
                            });
                    });

                    const results = await Promise.all(promises);

                    callbacks.onProgress?.('瀹屾垚', 100, `鎴愬姛鐢熸垚 ${results.filter(r => r.status === 'success').length}/${subjectList.length} 寮犲浘鐗嘸);

                    return { images: results };
                }
            },

            // 5. 瑙掕壊璁惧畾鍖?            {
                id: 'character_design_pack',
                name: '瑙掕壊璁惧畾鍖?,
                icon: '馃懁',
                category: 'image',
                description: '杈撳叆瑙掕壊鎻忚堪锛岀敓鎴愬畬鏁寸殑瑙掕壊璁惧畾鍖咃細涓夎鍥俱€佽〃鎯呭寘銆佸姩浣滃弬鑰冦€佹湇瑁呯粏鑺傘€?,
                parameters: [
                    {
                        key: 'name',
                        label: '瑙掕壊鍚嶇О',
                        type: 'text',
                        required: true,
                        placeholder: '渚嬪锛氭灄灏忔湀'
                    },
                    {
                        key: 'description',
                        label: '瑙掕壊鎻忚堪',
                        type: 'textarea',
                        required: true,
                        placeholder: '鎻忚堪瑙掕壊鐨勫璨屻€佹€ф牸銆佹湇瑁呯瓑...',
                        hint: '瓒婅缁嗚秺濂斤紝鍖呮嫭鍙戝瀷銆佹湇瑁呫€侀厤楗扮瓑'
                    },
                    {
                        key: 'style',
                        label: '鐢婚',
                        type: 'select',
                        default: 'anime',
                        options: [
                            { value: 'anime', label: '馃帉 鏃ョ郴鍔ㄦ极' },
                            { value: 'realistic', label: '馃摳 鍐欏疄椋庢牸' },
                            { value: 'chinese', label: '馃彯 鍥介' },
                            { value: 'chibi', label: '馃巰 Q鐗堝彲鐖? }
                        ]
                    },
                    {
                        key: 'aspectRatio',
                        label: '鍥剧墖姣斾緥',
                        type: 'select',
                        default: '16:9',
                        options: [
                            { value: '16:9', label: '16:9 妯増' },
                            { value: '4:3', label: '4:3 鏍囧噯' },
                            { value: '1:1', label: '1:1 鏂瑰舰' },
                            { value: '3:4', label: '3:4 绔栫増' },
                            { value: '9:16', label: '9:16 鎵嬫満绔栧睆' }
                        ]
                    },
                    {
                        key: 'charRefImage',
                        label: '瑙掕壊鍙傝€冨浘锛堝彲閫夛級',
                        type: 'image',
                        hint: '涓婁紶宸叉湁瑙掕壊鑽夌鎴栧弬鑰冨浘锛岀敓鎴愮粨鏋滃皢淇濇寔涓€鑷?
                    },
                    {
                        key: 'includeExpressions',
                        label: '鐢熸垚琛ㄦ儏鍖?,
                        type: 'checkbox',
                        default: true,
                        checkboxLabel: '鍖呭惈 6 绉嶈〃鎯?
                    },
                    {
                        key: 'includeActions',
                        label: '鐢熸垚鍔ㄤ綔鍙傝€?,
                        type: 'checkbox',
                        default: true,
                        checkboxLabel: '鍖呭惈 4 涓姩浣?
                    },
                    {
                        key: 'imageModel',
                        label: '鐢熷浘妯″瀷',
                        type: 'select',
                        default: 'nano-banana-2',
                        options: IMAGE_MODEL_OPTIONS
                    }
                ],
                estimateCost: (params) => {
                    let count = 2; // 鍩虹锛氫笁瑙嗗浘 + 璁惧畾娴锋姤
                    if (params.includeExpressions) count += 1;
                    if (params.includeActions) count += 1;
                    const imgFilm = calculateImageCost(params.imageModel);
                    return {
                        film: Math.ceil(count * imgFilm) + 1, // +1鏂囨湰
                        time: `绾?${count} 鍒嗛挓`
                    };
                },
                execute: async (params, callbacks) => {
                    const { name, description, style, aspectRatio, charRefImage, includeExpressions, includeActions } = params;
                    const charAspectRatio = aspectRatio || '16:9';
                    const results = {};

                    // 馃柤锔?瑙ｆ瀽瑙掕壊鍙傝€冨浘锛堟敮鎸佸鍥撅級
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

                    // 1. 涓夎鍥捐瀹?                    callbacks.onProgress?.('涓夎鍥?, 10, '姝ｅ湪鐢熸垚瑙掕壊涓夎鍥?..');

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
                        // 棣栧紶鐢熸垚鍥句綔涓哄悗缁弬鑰冿紙淇濇寔瑙掕壊涓€鑷存€э級
                        if (!charRef && results.turnaround) charRef = results.turnaround;

                        callbacks.onStepComplete?.('涓夎鍥?, { url: results.turnaround });
                    } catch (e) {
                        console.error('涓夎鍥剧敓鎴愬け璐?', e);
                    }

                    // 2-4. 骞惰鐢熸垚娴锋姤+琛ㄦ儏鍖?鍔ㄤ綔鍙傝€?                    const charTasks = [];
                    charTasks.push({ key: 'poster', name: '璁惧畾娴锋姤', prompt: `${baseStyle}, character design poster, ${name}, ${description}, clothing details, color palette, accessories, full body pose, professional character sheet` });
                    if (includeExpressions) charTasks.push({ key: 'expressions', name: '琛ㄦ儏鍖?, prompt: `${baseStyle}, expression sheet, ${name}, ${description}, 6 different expressions: happy, sad, angry, surprised, shy, confident, portrait close-up, white background, grid layout` });
                    if (includeActions) charTasks.push({ key: 'actions', name: '鍔ㄤ綔鍙傝€?, prompt: `${baseStyle}, action pose sheet, ${name}, ${description}, 4 dynamic poses: standing, running, fighting, sitting, full body, white background, action reference` });

                    callbacks.onProgress?.('骞惰鐢熸垚', 30, `鍚屾椂鐢熸垚 ${charTasks.length} 椤硅鑹茬礌鏉?..`);
                    let _chDone = 0;
                    await Promise.all(charTasks.map(task => {
                        const opts = { aspectRatio: charAspectRatio };
                        if (charRef) opts.refImage = charRef;
                        return callImageAPIWithRefs(task.prompt, opts, allCharRefImages)
                            .then(url => {
                                results[task.key] = url;
                                _chDone++;
                                callbacks.onProgress?.(`宸插畬鎴?${_chDone}/${charTasks.length}`, 30 + Math.round((_chDone / charTasks.length) * 65), `鉁?${task.name}`);
                                callbacks.onStepComplete?.(task.name, { url });
                            })
                            .catch(e => {
                                _chDone++;
                                console.error(`${task.name}鐢熸垚澶辫触:`, e);
                                callbacks.onProgress?.(`宸插畬鎴?${_chDone}/${charTasks.length}`, 30 + Math.round((_chDone / charTasks.length) * 65), `鉂?${task.name}`);
                            });
                    }));

                    callbacks.onProgress?.('瀹屾垚', 100, `瑙掕壊璁惧畾鍖呭凡鐢熸垚`);

                    return { characterName: name, assets: results };
                }
            },

            // 6. 婕敾鍒嗛暅鐢熸垚
            {
                id: 'comic_storyboard',
                name: '婕敾鍒嗛暅鐢熸垚',
                icon: '馃摉',
                category: 'image',
                description: '鏍规嵁鍓ф湰/鏁呬簨鐢熸垚婕敾鍒嗛暅椤甸潰锛岃嚜鍔ㄦ帓鐗堬紝閫傚悎鏉℃极銆佸洓鏍兼极鐢荤瓑銆?,
                parameters: [
                    {
                        key: 'story',
                        label: '鏁呬簨/鍓ф湰',
                        type: 'textarea',
                        required: true,
                        placeholder: '杈撳叆鏁呬簨鍐呭...',
                        hint: 'AI 浼氳嚜鍔ㄦ媶鍒嗕负鍒嗛暅'
                    },
                    {
                        key: 'styleRef',
                        label: '椋庢牸鍙傝€冨浘锛堝彲閫夛級',
                        type: 'image',
                        hint: '涓婁紶瑙掕壊鎴栫敾椋庡弬鑰冨浘锛屾极鐢婚鏍煎皢鍩轰簬姝ょ敓鎴?
                    },
                    {
                        key: 'pageCount',
                        label: '椤垫暟',
                        type: 'number',
                        default: 4,
                        min: 1,
                        max: 20
                    },
                    {
                        key: 'style',
                        label: '婕敾椋庢牸',
                        type: 'select',
                        default: 'manga',
                        options: [
                            { value: 'manga', label: '鏃ュ紡婕敾' },
                            { value: 'webtoon', label: '鏉℃极' },
                            { value: 'american', label: '缇庡紡婕敾' },
                            { value: 'chibi', label: 'Q鐗? }
                        ]
                    },
                    {
                        key: 'panelsPerPage',
                        label: '姣忛〉鏍兼暟',
                        type: 'select',
                        default: '4',
                        options: [
                            { value: '2', label: '2 鏍? },
                            { value: '4', label: '4 鏍? },
                            { value: '6', label: '6 鏍? }
                        ]
                    },
                    {
                        key: 'aspectRatio',
                        label: '椤甸潰姣斾緥',
                        type: 'select',
                        default: '9:16',
                        options: [
                            { value: '9:16', label: '9:16 鏉℃极绔栧睆' },
                            { value: '3:4', label: '3:4 绔栫増' },
                            { value: '4:3', label: '4:3 妯増' },
                            { value: '1:1', label: '1:1 鏂瑰舰' },
                            { value: '16:9', label: '16:9 妯睆' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    const pages = params.pageCount || 4;
                    return {
                        film: Math.ceil(pages * 5) + 1, // 5鑳剁墖/椤?+ 鏂囨湰1
                        time: `绾?${pages} 鍒嗛挓`
                    };
                },
                execute: async (params, callbacks) => {
                    const { story, styleRef, pageCount, style, panelsPerPage, aspectRatio } = params;
                    const comicAspectRatio = aspectRatio || '9:16';

                    // 馃柤锔?瑙ｆ瀽鍙傝€冨浘锛堟敮鎸佸鍥撅級
                    const comicRefs = await resolveRefImages(styleRef);
                    let comicRef = comicRefs.first;
                    const allComicRefImages = comicRefs.all;

                    const styleMap = {
                        manga: 'manga style, black and white, screen tones, dynamic angles',
                        webtoon: 'webtoon style, full color, vertical scroll format',
                        american: 'American comic style, bold lines, vivid colors',
                        chibi: 'chibi style, cute deformed characters, simple backgrounds'
                    };

                    // 鍏堟媶鍒嗗垎闀?                    callbacks.onProgress?.('瑙勫垝鍒嗛暅', 5, '姝ｅ湪灏嗘晠浜嬫媶鍒嗕负鍒嗛暅...');

                    const totalPanels = pageCount * parseInt(panelsPerPage);
                    const splitPrompt = `灏嗕互涓嬫晠浜嬫媶鍒嗕负 ${totalPanels} 涓极鐢诲垎闀滐紝姣忎釜鍒嗛暅鐢?銆愬垎闀淴銆?鏍囪锛?
${story}

瑕佹眰锛氭瘡涓垎闀滄弿杩板叿浣撶敾闈㈠唴瀹癸紝鍖呮嫭瑙掕壊鍔ㄤ綔銆佽〃鎯呫€佸璇濄€佽儗鏅痐;

                    let panelDescriptions = [];
                    try {
                        let outline = '';
                        if (typeof callScriptGenerator === 'function') {
                            outline = await callScriptGenerator({}, splitPrompt);
                        }
                        panelDescriptions = outline.split(/銆愬垎闀淺d+銆?i).filter(s => s.trim());
                    } catch (e) {
                        // 濡傛灉鎷嗗垎澶辫触锛屾寜娈佃惤澶勭悊
                        panelDescriptions = story.split(/[銆傦紒锛焅n]+/).filter(s => s.trim()).slice(0, totalPanels);
                    }

                    callbacks.onStepComplete?.('鍒嗛暅瑙勫垝', { panelCount: panelDescriptions.length });

                    // 馃帹 涓€鑷存€х瓥鐣ワ細鏃犲弬鑰冨浘鏃讹紝鍏堢敓鎴愮1椤典綔涓洪鏍煎熀鍑?                    if (!comicRef && pageCount > 1) {
                        callbacks.onProgress?.('鐢熸垚椋庢牸鍩哄噯', 8, '鍏堢敓鎴愮1椤电‘瀹氭极鐢婚鏍?..');
                        try {
                            const _firstPanels = panelDescriptions.slice(0, parseInt(panelsPerPage)).join('; ');
                            const _firstPrompt = `${styleMap[style]}, comic page, ${parseInt(panelsPerPage)} panels layout, sequential art, ${_firstPanels}`;
                            comicRef = await callImageAPIWithRefs(_firstPrompt, { aspectRatio: comicAspectRatio }, allComicRefImages);
                            callbacks.onStepComplete?.('椋庢牸鍩哄噯椤?, { imageUrl: comicRef });
                        } catch (e) { console.warn('椋庢牸鍩哄噯椤靛け璐?', e.message); }
                    }

                    // 骞惰鐢熸垚姣忛〉
                    callbacks.onProgress?.('骞惰鐢熸垚', 10, `鍚屾椂鐢熸垚 ${pageCount} 椤垫极鐢?..`);
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
                                callbacks.onProgress?.(`宸插畬鎴?${_cDone}/${pageCount}`, 10 + Math.round((_cDone / pageCount) * 85), `鉁?绗?{page + 1}椤礰);
                                callbacks.onStepComplete?.(`绗?{page + 1}椤礰, { imageUrl });
                                return { page: page + 1, panels: pagePanels, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _cDone++;
                                callbacks.onProgress?.(`宸插畬鎴?${_cDone}/${pageCount}`, 10 + Math.round((_cDone / pageCount) * 85), `鉂?绗?{page + 1}椤礰);
                                return { page: page + 1, error: e.message, status: 'failed' };
                            });
                    }));

                    callbacks.onProgress?.('瀹屾垚', 100, `鎴愬姛鐢熸垚 ${results.filter(r => r.status === 'success').length}/${pageCount} 椤垫极鐢籤);

                    return { pages: results };
                }
            },

            // ==================== 闊抽绫?====================

            // 7. AI鏅鸿兘閰嶉煶
            {
                id: 'ai_dubbing',
                name: 'AI鏅鸿兘閰嶉煶',
                icon: '馃帣锔?,
                category: 'audio',
                description: '杈撳叆鏂囨湰锛孉I 鑷姩鍒嗘瀽鍐呭绫诲瀷锛屾櫤鑳介€夋嫨鏈€浣抽煶鑹层€佽閫熴€佸紩鎿庛€傛敮鎸佹梺鐧姐€佸璇濄€佸瑙掕壊鑷姩鍒嗘閰嶉煶銆?,
                parameters: [
                    {
                        key: 'text',
                        label: '閰嶉煶鏂囨湰',
                        type: 'textarea',
                        required: true,
                        placeholder: '杈撳叆瑕侀厤闊崇殑鏂囧瓧鍐呭...\n\u2022 绾梺鐧斤細鐩存帴杈撳叆鏂囧瓧\n\u2022 澶氳鑹诧細鐢?[瑙掕壊鍚峕 鏍囪锛屽 [鏃佺櫧] [灏忔槑] [灏忕孩]',
                        hint: '鏀寔鑷姩璇嗗埆瑙掕壊瀵硅瘽锛屾瘡娈典笉瓒呰繃500瀛?
                    },
                    {
                        key: 'scene',
                        label: '鍦烘櫙鎻忚堪锛堝彲閫夛級',
                        type: 'select',
                        default: 'auto',
                        options: [
                            { value: 'auto', label: '馃 AI 鑷姩鍒ゆ柇' },
                            { value: 'narration', label: '馃帴 瑙嗛鏃佺櫧 / 绾綍鐗? },
                            { value: 'story', label: '馃摉 鏈夊０灏忚 / 骞挎挱鍓? },
                            { value: 'ad', label: '馃摙 骞垮憡 / 浜у搧浠嬬粛' },
                            { value: 'education', label: '馃帗 鏁欒偛璇剧▼ / 鎾' },
                            { value: 'lively', label: '馃帀 娲绘臣娲诲姏 / 鐭棰? }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    // 鏅鸿兘浼扮畻锛氭娴嬪瑙掕壊鏍囪
                    const text = params.text || '';
                    const roleMatches = text.match(/\[.{1,10}\]/g);
                    const segments = roleMatches ? new Set(roleMatches).size : 1;
                    const totalSegments = roleMatches ? roleMatches.length : 1;
                    // 澶氳鑹茬敤楂樿川閲忓紩鎿庯紝鍗曡鑹茬敤蹇€熷紩鎿?                    const costPerSegment = segments > 1 ? 1 : 1;
                    return {
                        film: Math.max(1, totalSegments * costPerSegment),
                        time: totalSegments > 3 ? `绾?${totalSegments * 8} 绉抈 : '绾?10-30 绉?
                    };
                },
                execute: async (params, callbacks) => {
                    const { text, scene } = params;
                    if (typeof callTTSAPI !== 'function') throw new Error('TTS鍔熻兘涓嶅彲鐢?);

                    // 馃 Step 1: 鏅鸿兘鍒嗘瀽鏂囨湰鍐呭
                    callbacks.onProgress?.('鍒嗘瀽鏂囨湰', 5, 'AI 姝ｅ湪鍒嗘瀽鏂囨湰鍐呭...');

                    // 瑙掕壊鍒嗘妫€娴嬶細[瑙掕壊鍚峕 鏂囨湰鍐呭
                    const rolePattern = /\[(.{1,10})\]\s*([\s\S]*?)(?=\[.{1,10}\]|$)/g;
                    const segments = [];
                    let roleMatch;
                    while ((roleMatch = rolePattern.exec(text)) !== null) {
                        const roleName = roleMatch[1].trim();
                        const roleText = roleMatch[2].trim();
                        if (roleText) segments.push({ role: roleName, text: roleText });
                    }

                    // 鏃犺鑹叉爣璁?鈫?鏁存閰嶉煶
                    if (segments.length === 0) {
                        segments.push({ role: 'narrator', text: text.trim() });
                    }

                    // 馃幁 Step 2: 鏅鸿兘闊宠壊鍒嗛厤
                    const detectedScene = scene === 'auto' ? _detectScene(text) : scene;

                    // 瑙掕壊闊宠壊鏄犲皠琛?                    const voiceProfiles = {
                        // 鏃佺櫧绫?                        '鏃佺櫧':   { engine: 'gemini', voiceId: 'Charon', speed: 0.95 },
                        'narrator': { engine: 'gemini', voiceId: 'Charon', speed: 0.95 },
                        '鍙欒堪':   { engine: 'gemini', voiceId: 'Charon', speed: 0.95 },
                        // 濂虫€ц鑹?                        '濂?: { engine: 'gemini', voiceId: 'Kore', speed: 1.0 },
                        '濂冲': { engine: 'gemini', voiceId: 'Kore', speed: 1.1 },
                        '灏忕孩': { engine: 'gemini', voiceId: 'Kore', speed: 1.0 },
                        '濞?: { engine: 'gemini', voiceId: 'Aoede', speed: 0.9 },
                        '娓╂煍': { engine: 'gemini', voiceId: 'Aoede', speed: 0.9 },
                        '濂冲０': { engine: 'kling', voiceId: 'ai_shatang', speed: 1.0 },
                        // 鐢锋€ц鑹?                        '鐢?: { engine: 'gemini', voiceId: 'Puck', speed: 1.0 },
                        '鐢峰': { engine: 'gemini', voiceId: 'Puck', speed: 1.1 },
                        '灏忔槑': { engine: 'gemini', voiceId: 'Puck', speed: 1.0 },
                        '鑰佷汉': { engine: 'gemini', voiceId: 'Charon', speed: 0.85 },
                        '鐢峰０': { engine: 'kling', voiceId: 'genshin_vindi2', speed: 1.0 },
                        '娣辨矇': { engine: 'gemini', voiceId: 'Charon', speed: 0.9 }
                    };

                    // 鍦烘櫙榛樿闊宠壊锛堝綋瑙掕壊鍚嶆湭鍖归厤鏃剁殑鍏嗗簳锛?                    const sceneDefaults = {
                        narration:  { engine: 'gemini', voiceId: 'Charon', speed: 0.95 },
                        story:      { engine: 'kling', voiceId: 'diyinnansang_DB_CN_M_04-v2', speed: 1.0 },
                        ad:         { engine: 'gemini', voiceId: 'Puck', speed: 1.1 },
                        education:  { engine: 'gemini', voiceId: 'Charon', speed: 0.9 },
                        lively:     { engine: 'gemini', voiceId: 'Kore', speed: 1.2 }
                    };
                    const defaultVoice = sceneDefaults[detectedScene] || sceneDefaults.narration;

                    // 涓烘瘡涓鑹插垎閰嶉煶鑹诧紝鍚屼竴瑙掕壊鍚嶄繚鎸佷竴鑷?                    const roleVoiceMap = {};
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
                        // 鍖归厤棰勫畾涔夎鑹?                        const matched = Object.entries(voiceProfiles).find(([key]) =>
                            seg.role.includes(key) || key.includes(seg.role)
                        );
                        if (matched && !usedVoices.has(matched[1].voiceId)) {
                            roleVoiceMap[seg.role] = matched[1];
                            usedVoices.add(matched[1].voiceId);
                        } else if (segments.length === 1) {
                            roleVoiceMap[seg.role] = defaultVoice;
                        } else {
                            // 澶氳鑹叉椂鍒嗛厤涓嶅悓闊宠壊
                            while (altIdx < alternateVoices.length && usedVoices.has(alternateVoices[altIdx].voiceId)) altIdx++;
                            const voice = altIdx < alternateVoices.length ? alternateVoices[altIdx] : defaultVoice;
                            roleVoiceMap[seg.role] = voice;
                            usedVoices.add(voice.voiceId);
                            altIdx++;
                        }
                    }

                    callbacks.onProgress?.('寮€濮嬮厤闊?, 10,
                        `妫€娴嬪埌 ${segments.length} 娈甸厤闊筹紝${Object.keys(roleVoiceMap).length} 涓鑹诧紝鍦烘櫙: ${detectedScene}`);

                    // 馃帳 Step 3: 閫愭閰嶉煶
                    const results = [];
                    for (let i = 0; i < segments.length; i++) {
                        const seg = segments[i];
                        const voice = roleVoiceMap[seg.role];
                        const segText = seg.text.substring(0, 500); // 鍗曟闄愬埗500瀛?                        const progress = 10 + Math.round((i / segments.length) * 85);
                        callbacks.onProgress?.(`閰嶉煶涓?${i + 1}/${segments.length}`, progress,
                            `馃帳 [${seg.role}] ${voice.engine}/${voice.voiceId} speed=${voice.speed}`);

                        try {
                            const audioUrl = await callTTSAPI(segText, {
                                engine: voice.engine,
                                voiceId: voice.voiceId,
                                speed: voice.speed
                            });
                            results.push({ role: seg.role, audioUrl, text: segText, status: 'success' });
                            callbacks.onStepComplete?.(`[${seg.role}] 閰嶉煶瀹屾垚`, { audioUrl });
                        } catch (err) {
                            results.push({ role: seg.role, error: err.message, text: segText, status: 'failed' });
                        }
                    }

                    callbacks.onProgress?.('瀹屾垚', 100,
                        `鎴愬姛 ${results.filter(r => r.status === 'success').length}/${segments.length} 娈礰);

                    return {
                        scene: detectedScene,
                        segments: results,
                        roles: Object.entries(roleVoiceMap).map(([role, v]) => ({ role, ...v }))
                    };
                }
            },

            // 8. AI鏅鸿兘闊充箰
            {
                id: 'ai_music',
                name: 'AI鏅鸿兘闊充箰',
                icon: '馃幍',
                category: 'audio',
                description: '鎻忚堪鎯宠鐨勯煶涔愭皼鍥存垨鐢ㄩ€旓紝AI 鑷姩鐢熸垚姝岃瘝銆侀€夋嫨椋庢牸銆侀厤缃弬鏁帮紝涓€閿垱浣滈煶涔愩€?,
                parameters: [
                    {
                        key: 'description',
                        label: '闊充箰鎻忚堪',
                        type: 'textarea',
                        required: true,
                        placeholder: '鎻忚堪鎯宠鐨勯煶涔愶紝渚嬪锛歕n\u2022 缁欑編椋熸帰搴楄棰戝仛涓€娈佃交蹇殑BGM\n\u2022 鍐欎竴棣栧叧浜庣澶╃殑涓浗椋庢瓕鏇瞈n\u2022 绉戝够鐢靛奖棰勫憡鐗囩殑鍙茶瘲閰嶄箰',
                        hint: '鎻忚堪瓒婂叿浣擄紝AI 鐢熸垚鐨勯煶涔愯秺绗﹀悎棰勬湡'
                    },
                    {
                        key: 'purpose',
                        label: '闊充箰鐢ㄩ€旓紙鍙€夛級',
                        type: 'select',
                        default: 'auto',
                        options: [
                            { value: 'auto', label: '馃 AI 鑷姩鍒ゆ柇' },
                            { value: 'bgm', label: '馃幀 瑙嗛/鐭棰態GM' },
                            { value: 'song', label: '馃帳 瀹屾暣姝屾洸锛堝甫浜哄０锛? },
                            { value: 'ambient', label: '馃尶 姘涘洿闊充箰/鏀炬澗' },
                            { value: 'game', label: '馃幃 娓告垙/鍔ㄧ敾閰嶄箰' },
                            { value: 'brand', label: '馃彚 鍝佺墝/骞垮憡闊充箰' }
                        ]
                    }
                ],
                estimateCost: () => ({
                    film: 9,
                    time: '绾?1-3 鍒嗛挓'
                }),
                execute: async (params, callbacks) => {
                    const { description, purpose } = params;
                    if (typeof callSunoMusicAPI !== 'function') throw new Error('闊充箰鐢熸垚鍔熻兘涓嶅彲鐢?);

                    // 馃 Step 1: AI 鍒嗘瀽鎻忚堪锛岃嚜鍔ㄧ敓鎴愬弬鏁?                    callbacks.onProgress?.('鍒嗘瀽闊充箰闇€姹?, 5, 'AI 姝ｅ湪鍒嗘瀽浣犵殑闊充箰闇€姹?..');

                    const detectedPurpose = purpose === 'auto' ? _detectMusicPurpose(description) : purpose;
                    const isInstrumental = ['bgm', 'ambient', 'game'].includes(detectedPurpose);
                    const needLyrics = ['song'].includes(detectedPurpose) || (!isInstrumental && detectedPurpose === 'auto');

                    // 鏅鸿兘椋庢牸鏍囩鐢熸垚
                    const autoTags = _generateMusicTags(description, detectedPurpose);
                    const model = 'chirp-v4'; // 榛樿绋冲畾鐗堟湰

                    callbacks.onProgress?.('鐢熸垚闊充箰鍙傛暟', 10,
                        `鐢ㄩ€? ${detectedPurpose} | 椋庢牸: ${autoTags} | ${isInstrumental ? '绾疊GM' : '甯︿汉澹?}`);

                    // 馃幍 Step 2: 濡傛灉闇€瑕佹瓕璇嶏紝鍏堢敤AI鐢熸垚姝岃瘝
                    let lyrics = '';
                    if (needLyrics) {
                        callbacks.onProgress?.('鍒涗綔姝岃瘝', 15, 'AI 姝ｅ湪鏍规嵁鎻忚堪鍒涗綔姝岃瘝...');
                        try {
                            if (typeof callScriptGenerator === 'function') {
                                lyrics = await callScriptGenerator({},
                                    `浣犳槸涓€浣嶄笓涓氳瘝浣滃銆傛牴鎹互涓嬫弿杩板垱浣滀竴棣栨瓕鏇茬殑姝岃瘝锛?
鎻忚堪锛?{description}
椋庢牸锛?{autoTags}

瑕佹眰锛?- 鍖呭惈涓绘瓕(Verse)銆佸壇姝?Chorus)銆丅ridge
- 鍓瓕鏈楁湕涓婂彛锛屾湁璁板繂鐐?- 涓枃姝岃瘝
- 鐩存帴杈撳嚭姝岃瘝鍐呭锛屼笉瑕佽В閲奰);
                            }
                            if (lyrics) {
                                callbacks.onStepComplete?.('姝岃瘝鍒涗綔瀹屾垚', { lyrics });
                            }
                        } catch (e) {
                            console.warn('[ai_music] 姝岃瘝鐢熸垚澶辫触锛屾敼鐢ㄧ伒鎰熸ā寮?', e.message);
                        }
                    }

                    // 馃幎 Step 3: 璋冪敤 Suno 鐢熸垚闊充箰
                    callbacks.onProgress?.('鐢熸垚闊充箰', 25, '姝ｅ湪鐢熸垚闊充箰锛岃鑰愬績绛夊緟...');

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

                    callbacks.onProgress?.('瀹屾垚', 100, `鎴愬姛鐢熸垚 ${result.music.length} 棣栭煶涔恅);

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

            // ==================== 鍐呭绫?====================

            // 9. 鐑偣鏂囨鐢熸垚
            {
                id: 'trending_copywriting',
                name: '鐑偣鏂囨鐢熸垚',
                icon: '馃敟',
                category: 'content',
                description: '鏍规嵁鐑偣璇濋鎴栧叧閿瘝锛屾壒閲忕敓鎴愬鏉″惛寮曠溂鐞冪殑鏂囨銆傞€傚悎绀句氦濯掍綋銆佽惀閿€鎺ㄥ箍銆?,
                parameters: [
                    {
                        key: 'topic',
                        label: '璇濋/鍏抽敭璇?,
                        type: 'text',
                        required: true,
                        placeholder: '渚嬪锛氭槬鑺傘€丄I 宸ュ叿銆佸仴韬?..'
                    },
                    {
                        key: 'count',
                        label: '鐢熸垚鏁伴噺',
                        type: 'number',
                        default: 10,
                        min: 1,
                        max: 50
                    },
                    {
                        key: 'platform',
                        label: '鐩爣骞冲彴',
                        type: 'select',
                        default: 'douyin',
                        options: [
                            { value: 'douyin', label: '鎶栭煶' },
                            { value: 'xiaohongshu', label: '灏忕孩涔? },
                            { value: 'weibo', label: '寰崥' },
                            { value: 'wechat', label: '鍏紬鍙? },
                            { value: 'bilibili', label: 'B绔? }
                        ]
                    },
                    {
                        key: 'tone',
                        label: '璇皵椋庢牸',
                        type: 'select',
                        default: 'casual',
                        options: [
                            { value: 'casual', label: '杞绘澗娲绘臣' },
                            { value: 'professional', label: '涓撲笟姝ｅ紡' },
                            { value: 'humorous', label: '骞介粯鎼炵瑧' },
                            { value: 'emotional', label: '鎯呮劅鍏遍福' },
                            { value: 'provocative', label: '寮曞彂璁ㄨ' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    return {
                        film: 1, // 鍗曟鏂囨湰璋冪敤1鑳剁墖
                        time: '绾?30 绉?
                    };
                },
                execute: async (params, callbacks) => {
                    const { topic, count, platform, tone } = params;

                    callbacks.onProgress?.('鐢熸垚鏂囨', 20, '姝ｅ湪鍒涗綔鏂囨...');

                    const platformStyles = {
                        douyin: '绠€鐭湁鍔涳紝閫傚悎閰嶅悎瑙嗛锛屽鐢?emoji',
                        xiaohongshu: '绉嶈崏椋庢牸锛岀湡璇氬垎浜紝閫傚綋鍔犳爣绛?,
                        weibo: '璇濋鎬у己锛屽彲浠ユ湁浜夎鎬?,
                        wechat: '鏍囬鍏氶鏍硷紝寮曚汉鐐瑰嚮',
                        bilibili: '骞磋交鍖栵紝浜屾鍏冮鏍硷紝鍙互鐜╂'
                    };

                    const toneStyles = {
                        casual: '杞绘澗娲绘臣锛屽儚鏈嬪弸鑱婂ぉ',
                        professional: '涓撲笟鍙俊锛屾湁鏁版嵁鏀拺',
                        humorous: '骞介粯鎼炵瑧锛屾湁姊楁湁鏂?,
                        emotional: '瑙﹀姩鎯呮劅锛屽紩鍙戝叡楦?,
                        provocative: '鏈夎鐐癸紝寮曞彂璁ㄨ'
                    };

                    const prompt = `璇蜂负"${topic}"涓婚鐢熸垚 ${count} 鏉?{platformStyles[platform]}鐨勬枃妗堛€?
椋庢牸瑕佹眰锛?{toneStyles[tone]}

杈撳嚭鏍煎紡锛氭瘡鏉℃枃妗堝崟鐙竴琛岋紝搴忓彿寮€澶?
娉ㄦ剰锛?1. 姣忔潯鏂囨瑕佺嫭鐗癸紝涓嶈閲嶅
2. 绗﹀悎${platform}骞冲彴鐗圭偣
3. 鏈夊惛寮曞姏锛岃兘寮曞彂浜掑姩`;

                    let copywritings = [];
                    try {
                        let result = '';
                        if (typeof callScriptGenerator === 'function') {
                            result = await callScriptGenerator({}, prompt);
                        } else if (typeof callModelScopeTextAPI === 'function') {
                            result = await callModelScopeTextAPI(prompt);
                        }

                        // 瑙ｆ瀽鏂囨
                        copywritings = result.split(/\n+/)
                            .filter(line => line.trim())
                            .map(line => line.replace(/^\d+[\.\)銆乚\s*/, '').trim())
                            .filter(line => line.length > 0)
                            .slice(0, count);

                    } catch (error) {
                        throw new Error('鏂囨鐢熸垚澶辫触: ' + error.message);
                    }

                    callbacks.onStepComplete?.('鏂囨鐢熸垚', { count: copywritings.length });
                    callbacks.onProgress?.('瀹屾垚', 100, `鎴愬姛鐢熸垚 ${copywritings.length} 鏉℃枃妗坄);

                    return {
                        topic,
                        platform,
                        copywritings,
                        count: copywritings.length
                    };
                }
            },

            // 8. 灏忚杞极鐢?            {
                id: 'novel_to_comic',
                name: '灏忚杞极鐢?,
                icon: '馃摎',
                category: 'content',
                description: '灏嗗皬璇寸珷鑺傝嚜鍔ㄨ浆鎹负婕敾椤甸潰銆侫I 鍒嗘瀽鎯呰妭銆佽璁″垎闀溿€佺敓鎴愮敾闈€?,
                parameters: [
                    {
                        key: 'novel',
                        label: '灏忚鍐呭',
                        type: 'textarea',
                        required: true,
                        placeholder: '绮樿创灏忚绔犺妭鍐呭...',
                        hint: '寤鸿 1000-3000 瀛椾负瀹?
                    },
                    {
                        key: 'styleRef',
                        label: '椋庢牸/瑙掕壊鍙傝€冨浘锛堝彲閫夛級',
                        type: 'image',
                        hint: '涓婁紶瑙掕壊鎴栫敾椋庡弬鑰冨浘锛屾极鐢诲皢淇濇寔涓€鑷撮鏍?
                    },
                    {
                        key: 'pageCount',
                        label: '婕敾椤垫暟',
                        type: 'number',
                        default: 6,
                        min: 2,
                        max: 20
                    },
                    {
                        key: 'style',
                        label: '婕敾椋庢牸',
                        type: 'select',
                        default: 'manga',
                        options: [
                            { value: 'manga', label: '鏃ュ紡婕敾' },
                            { value: 'manhwa', label: '闊╁紡婕敾' },
                            { value: 'manhua', label: '鍥介婕敾' }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    const pages = params.pageCount || 6;
                    return {
                        film: Math.ceil(pages * 5) + 1, // 5鑳剁墖/椤?+ 鏂囨湰1
                        time: `绾?${pages + 2} 鍒嗛挓`
                    };
                },
                execute: async (params, callbacks) => {
                    const { novel, styleRef, pageCount, style } = params;

                    // 馃柤锔?瑙ｆ瀽椋庢牸鍙傝€冨浘锛堟敮鎸佸鍥?base64 鏁扮粍锛?                    const novelRefs = await resolveRefImages(styleRef);
                    let novelRef = novelRefs.first;

                    // 姝ラ 1: 鍒嗘瀽灏忚锛屾彁鍙栧垎闀?                    callbacks.onProgress?.('鍒嗘瀽灏忚', 5, '姝ｅ湪鍒嗘瀽鏁呬簨鎯呰妭...');

                    const analysisPrompt = `璇峰皢浠ヤ笅灏忚鍐呭杞崲涓?${pageCount} 椤垫极鐢荤殑鍒嗛暅鑴氭湰銆?
灏忚鍐呭锛?${novel.substring(0, 3000)}

瑕佹眰锛?1. 姣忛〉 4 涓垎闀?2. 姣忎釜鍒嗛暅鍖呭惈锛氱敾闈㈡弿杩般€佽鑹茶〃鎯呫€佸璇濓紙濡傛湁锛?3. 杈撳嚭鏍煎紡锛?銆愮X椤点€?鍒嗛暅1: ...
鍒嗛暅2: ...
...`;

                    let storyboard = '';
                    try {
                        if (typeof callScriptGenerator === 'function') {
                            storyboard = await callScriptGenerator({}, analysisPrompt);
                        }
                    } catch (e) {
                        storyboard = novel;
                    }

                    callbacks.onStepComplete?.('鍒嗛暅鑴氭湰', { length: storyboard.length });

                    // 姝ラ 2: 鐢熸垚姣忛〉婕敾
                    const styleMap = {
                        manga: 'Japanese manga style, black and white with screentones',
                        manhwa: 'Korean manhwa style, full color, detailed',
                        manhua: 'Chinese manhua style, traditional influenced'
                    };

                    const pages = storyboard.split(/銆愮\d+椤点€?i).filter(p => p.trim());
                    const actualCount = Math.min(pageCount, pages.length || pageCount);

                    // 馃帹 涓€鑷存€х瓥鐣ワ細鏃犲弬鑰冨浘鏃讹紝鍏堢敓鎴愮1椤典綔涓洪鏍煎熀鍑?                    if (!novelRef && actualCount > 1) {
                        callbacks.onProgress?.('鐢熸垚椋庢牸鍩哄噯', 8, '鍏堢敓鎴愮1椤电‘瀹氭极鐢婚鏍?..');
                        try {
                            const _firstContent = pages[0] || novel.substring(0, 500);
                            const _firstPrompt = `${styleMap[style]}, comic page, 4 panels, sequential art, ${_firstContent.substring(0, 400)}`;
                            novelRef = await callImageAPIWithRefs(_firstPrompt, { aspectRatio: '9:16' }, novelRefs.all);
                            callbacks.onStepComplete?.('椋庢牸鍩哄噯椤?, { imageUrl: novelRef });
                        } catch (e) { console.warn('椋庢牸鍩哄噯椤靛け璐?', e.message); }
                    }

                    callbacks.onProgress?.('骞惰鐢熸垚', 10, `鍚屾椂鐢熸垚 ${actualCount} 椤垫极鐢?..`);
                    let _nDone = 0;
                    const results = await Promise.all(Array.from({ length: actualCount }, (_, i) => {
                        const pageContent = pages[i] || novel.substring(i * 500, (i + 1) * 500);
                        const pagePrompt = `${styleMap[style]}, comic page, 4 panels, sequential art, ${pageContent.substring(0, 400)}`;
                        const opts = { aspectRatio: '9:16' };
                        if (novelRef) opts.refImage = novelRef;
                        return callImageAPIWithRefs(pagePrompt, opts, novelRefs.all)
                            .then(imageUrl => {
                                _nDone++;
                                callbacks.onProgress?.(`宸插畬鎴?${_nDone}/${actualCount}`, 10 + Math.round((_nDone / actualCount) * 85), `鉁?绗?{i + 1}椤礰);
                                callbacks.onStepComplete?.(`绗?{i + 1}椤礰, { imageUrl });
                                return { page: i + 1, content: pageContent.substring(0, 100) + '...', imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _nDone++;
                                callbacks.onProgress?.(`宸插畬鎴?${_nDone}/${actualCount}`, 10 + Math.round((_nDone / actualCount) * 85), `鉂?绗?{i + 1}椤礰);
                                return { page: i + 1, error: e.message, status: 'failed' };
                            });
                    }));

                    callbacks.onProgress?.('瀹屾垚', 100, `鎴愬姛鐢熸垚 ${results.filter(r => r.status === 'success').length}/${pageCount} 椤垫极鐢籤);

                    return { pages: results };
                }
            },

            // 9. 鑴氭湰鏅鸿兘鎷嗗垎
            {
                id: 'script_split',
                name: '鑴氭湰鏅鸿兘鎷嗗垎',
                icon: '鉁傦笍',
                category: 'content',
                description: '灏嗛暱鑴氭湰/鍓ф湰鏅鸿兘鎷嗗垎涓哄垎闀溿€佺墖娈碉紝鐢熸垚姣忎釜鐗囨鐨勬弿杩板拰鎻愮ず璇嶃€?,
                parameters: [
                    {
                        key: 'script',
                        label: '瀹屾暣鑴氭湰',
                        type: 'textarea',
                        required: true,
                        placeholder: '绮樿创瀹屾暣鑴氭湰/鍓ф湰...'
                    },
                    {
                        key: 'targetDuration',
                        label: '鐩爣鏃堕暱锛堢锛?,
                        type: 'number',
                        default: 60,
                        min: 15,
                        max: 300,
                        hint: '鏈€缁堣棰戠殑鐩爣鏃堕暱'
                    },
                    {
                        key: 'outputFormat',
                        label: '杈撳嚭鏍煎紡',
                        type: 'select',
                        default: 'storyboard',
                        options: [
                            { value: 'storyboard', label: '鍒嗛暅琛? },
                            { value: 'scenes', label: '鍦烘櫙鍒楄〃' },
                            { value: 'prompts', label: 'AI 鎻愮ず璇? }
                        ]
                    }
                ],
                estimateCost: (params) => {
                    return {
                        film: 1, // 鏂囨湰1鑳剁墖
                        time: '绾?30 绉?
                    };
                },
                execute: async (params, callbacks) => {
                    const { script, targetDuration, outputFormat } = params;

                    callbacks.onProgress?.('鍒嗘瀽鑴氭湰', 20, '姝ｅ湪鍒嗘瀽鑴氭湰缁撴瀯...');

                    const scenesCount = Math.ceil(targetDuration / 15);

                    const formatInstructions = {
                        storyboard: `鍒嗛暅琛ㄦ牸寮忥紝鍖呭惈锛氶暅鍙枫€佺敾闈㈡弿杩般€佹椂闀裤€佹梺鐧?瀵硅瘽銆佸娉╜,
                        scenes: `鍦烘櫙鍒楄〃鏍煎紡锛屽寘鍚細鍦烘櫙鍙枫€佸満鏅弿杩般€佸嚭鍦鸿鑹层€佹椂闂村湴鐐筦,
                        prompts: `AI 鎻愮ず璇嶆牸寮忥紝姣忎釜鍒嗛暅鐢熸垚鍙洿鎺ョ敤浜?AI 缁樺浘/瑙嗛鐨勮嫳鏂?prompt`
                    };

                    const prompt = `璇峰皢浠ヤ笅鑴氭湰鎷嗗垎涓?${scenesCount} 涓垎闀滐紝鎬绘椂闀跨害 ${targetDuration} 绉掋€?
鑴氭湰鍐呭锛?${script.substring(0, 4000)}

杈撳嚭鏍煎紡瑕佹眰锛?{formatInstructions[outputFormat]}

娉ㄦ剰锛?1. 姣忎釜鍒嗛暅绾?15 绉?2. 淇濇寔鏁呬簨杩炶疮鎬?3. 鍒嗛暅瑕佹湁鐢婚潰鎰燂紝鍙墽琛宍;

                    let result = '';
                    try {
                        if (typeof callScriptGenerator === 'function') {
                            result = await callScriptGenerator({}, prompt);
                        } else if (typeof callModelScopeTextAPI === 'function') {
                            result = await callModelScopeTextAPI(prompt);
                        }
                    } catch (error) {
                        throw new Error('鑴氭湰鍒嗘瀽澶辫触: ' + error.message);
                    }

                    callbacks.onStepComplete?.('鑴氭湰鎷嗗垎', { scenesCount });
                    callbacks.onProgress?.('瀹屾垚', 100, `宸叉媶鍒嗕负 ${scenesCount} 涓垎闀渀);

                    return {
                        originalLength: script.length,
                        targetDuration,
                        scenesCount,
                        format: outputFormat,
                        result
                    };
                }
            },

            // ==================== 鑷姩鍖栫被 ====================

            // 10. 鍏ㄦ祦绋嬭嚜鍔ㄥ寲
            {
                id: 'full_auto_workflow',
                name: '鍏ㄦ祦绋嬭嚜鍔ㄥ寲',
                icon: '馃',
                category: 'automation',
                description: '浠庝竴涓垱鎰忓埌瀹屾暣浣滃搧鐨勪竴閿叏鑷姩娴佺▼锛氬垱鎰?鈫?鍓ф湰 鈫?瑙掕壊 鈫?鍒嗛暅 鈫?瑙嗛/婕敾銆?,
                parameters: [
                    {
                        key: 'idea',
                        label: '鍒涙剰涓婚',
                        type: 'textarea',
                        required: true,
                        placeholder: '杈撳叆鎮ㄧ殑鍒涙剰...',
                        hint: '涓€鍙ヨ瘽鎴栦竴娈垫弿杩伴兘鍙互'
                    },
                    {
                        key: 'outputType',
                        label: '杈撳嚭绫诲瀷',
                        type: 'select',
                        default: 'video',
                        options: [
                            { value: 'video', label: '馃幀 鐭棰? },
                            { value: 'comic', label: '馃摉 婕敾' },
                            { value: 'both', label: '馃巵 瑙嗛+婕敾' }
                        ]
                    },
                    {
                        key: 'style',
                        label: '瑙嗚椋庢牸',
                        type: 'select',
                        default: 'anime',
                        options: [
                            { value: 'anime', label: '馃帉 鏃ョ郴鍔ㄦ极' },
                            { value: 'realistic', label: '馃摳 鍐欏疄鐢靛奖' },
                            { value: 'chinese', label: '馃彯 鍥介鍙ゅ吀' },
                            { value: '3d', label: '馃幃 3D 娓叉煋' },
                            { value: 'watercolor', label: '馃帹 姘村僵鎻掔敾' }
                        ]
                    },
                    {
                        key: 'duration',
                        label: '瑙嗛鏃堕暱',
                        type: 'select',
                        default: '60',
                        options: [
                            { value: '30', label: '30 绉? },
                            { value: '60', label: '1 鍒嗛挓' },
                            { value: '120', label: '2 鍒嗛挓' }
                        ]
                    },
                    {
                        key: 'includeCharacter',
                        label: '鐢熸垚瑙掕壊璁惧畾',
                        type: 'checkbox',
                        default: true,
                        checkboxLabel: '鍏堣璁¤鑹诧紝淇濊瘉浜虹墿涓€鑷存€?
                    },
                    {
                        key: 'styleRef',
                        label: '椋庢牸/瑙掕壊鍙傝€冨浘锛堝彲閫夛級',
                        type: 'image',
                        hint: '涓婁紶瑙掕壊鎴栭鏍煎弬鑰冨浘锛屾墍鏈夌敓鎴愬唴瀹瑰皢鍩轰簬姝ら鏍?
                    },
                    {
                        key: 'videoModel',
                        label: '瑙嗛妯″瀷',
                        type: 'select',
                        default: 'sora-2-vip-all',
                        options: VIDEO_MODEL_OPTIONS
                    },
                    {
                        key: 'imageModel',
                        label: '鐢熷浘妯″瀷',
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
                    let film = 1; // 鍓ф湰

                    if (params.includeCharacter) film += 1 + (4 * imgFilm); // 瑙掕壊璁惧畾(鏂囨湰1+鍥剧墖4)
                    if (params.outputType === 'video' || params.outputType === 'both') {
                        film += scenes * (imgFilm + videoFilm); // 姣忎釜鍒嗛暅锛氬浘鐗?瑙嗛
                    }
                    if (params.outputType === 'comic' || params.outputType === 'both') {
                        film += Math.ceil(scenes / 2) * imgFilm; // 婕敾椤?                    }

                    return {
                        film: Math.ceil(film),
                        time: `绾?${Math.ceil(duration / 10)} 鍒嗛挓`
                    };
                },
                execute: async (params, callbacks) => {
                    const { idea, outputType, style, duration, includeCharacter, styleRef, videoModel } = params;

                    // 馃柤锔?瑙ｆ瀽鍙傝€冨浘锛堟敮鎸佸鍥撅級
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

                    // 姝ラ 1: 鐢熸垚鍓ф湰
                    callbacks.onProgress?.('缂栧啓鍓ф湰', 5, '姝ｅ湪鍒涗綔鍓ф湰...');

                    const scriptPrompt = `璇蜂负浠ヤ笅鍒涙剰缂栧啓涓€涓煭瑙嗛鍓ф湰锛屾椂闀跨害 ${duration} 绉掞紝鍒?${scenesCount} 涓垎闀滐細

鍒涙剰锛?{idea}
椋庢牸锛?{style === 'anime' ? '鍔ㄦ极椋庢牸' : style === 'realistic' ? '鍐欏疄鐢靛奖椋庢牸' : '鍥介鍙ゅ吀椋庢牸'}

瑕佹眰锛?1. 鍓ф儏绱у噾锛屾湁寮€澶淬€佸彂灞曘€侀珮娼€佺粨灏?2. 姣忎釜鍒嗛暅绾?15 绉?3. 鎻忚堪鍏蜂綋鐢婚潰鍜屽姩浣?4. 濡傛灉鏈夎鑹诧紝鎻忚堪鍏跺璨岀壒寰乣;

                    try {
                        if (typeof callScriptGenerator === 'function') {
                            results.script = await callScriptGenerator({}, scriptPrompt);
                        }
                        callbacks.onStepComplete?.('鍓ф湰', { preview: results.script?.substring(0, 100) + '...' });
                    } catch (e) {
                        console.error('鍓ф湰鐢熸垚澶辫触:', e);
                    }

                    // 姝ラ 2: 鐢熸垚瑙掕壊璁惧畾锛堝彲閫夛級
                    if (includeCharacter && results.script) {
                        callbacks.onProgress?.('璁捐瑙掕壊', 15, '姝ｅ湪璁捐瑙掕壊...');

                        try {
                            if (typeof createCharacterImageVariants === 'function') {
                                // 浠庡墽鏈腑鎻愬彇涓昏
                                const charPrompt = `浠庝互涓嬪墽鏈腑鎻愬彇涓昏淇℃伅锛岃緭鍑烘牸寮忎负"鍚嶅瓧锛氬璨屾弿杩?
${results.script.substring(0, 1000)}`;

                                let charInfo = '';
                                if (typeof callScriptGenerator === 'function') {
                                    charInfo = await callScriptGenerator({}, charPrompt);
                                }

                                const variants = await createCharacterImageVariants({
                                    name: charInfo.split('锛?)[0] || '涓昏',
                                    summary: charInfo.split('锛?)[1] || results.script.substring(0, 200),
                                    storyContext: results.script,
                                    userCharStyle: style === 'realistic' ? 'realistic' : style === 'chinese' ? 'chinese' : 'anime'
                                });

                                results.character = variants;
                                callbacks.onStepComplete?.('瑙掕壊璁惧畾', { variants });
                            }
                        } catch (e) {
                            console.error('瑙掕壊璁惧畾澶辫触:', e);
                        }
                    }

                    // 姝ラ 3: 鐢熸垚鍒嗛暅鍥惧儚
                    const stylePrompts = {
                        anime: 'anime style, Japanese animation, vibrant',
                        realistic: 'cinematic, photorealistic, movie quality',
                        chinese: 'Chinese traditional art, ink painting influence'
                    };

                    const sceneTexts = results.script?.split(/鍒嗛暅\d+|闀滃ご\d+|銆怽d+銆?i).filter(s => s.trim().length > 20) || [results.script || idea];
                    let refImage = userRefImage || results.character?.[0]?.url;

                    // 馃帹 涓€鑷存€х瓥鐣ワ細鏃犲弬鑰冨浘鏃讹紝鍏堢敓鎴愮1寮犲垎闀滃浘浣滀负椋庢牸鍩哄噯
                    if (!refImage && scenesCount > 1) {
                        callbacks.onProgress?.('鐢熸垚椋庢牸鍩哄噯', 18, '鍏堢敓鎴愮1寮犲垎闀滃浘纭畾椋庢牸...');
                        try {
                            const _firstText = sceneTexts[0] || idea;
                            const _firstPrompt = `${stylePrompts[style]}, ${_firstText.substring(0, 300)}, cinematic composition, high quality`;
                            refImage = await callImageAPIWithRefs(_firstPrompt, { aspectRatio: '16:9' }, allAutoRefImages);
                            callbacks.onStepComplete?.('椋庢牸鍩哄噯鍒嗛暅', { imageUrl: refImage });
                        } catch (e) { console.warn('椋庢牸鍩哄噯鍒嗛暅澶辫触:', e.message); }
                    }

                    // 姝ラ 3: 骞惰鐢熸垚鍒嗛暅鍥惧儚 + 瑙嗛
                    callbacks.onProgress?.('骞惰鐢熸垚鍒嗛暅', 20, `鍚屾椂鐢熸垚 ${scenesCount} 涓垎闀?..`);
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
                                videoUrl = await callSora2ImageToVideoAPI(imageUrl, sceneText, { model: videoModel || 'sora-2-all', duration: 15, aspectRatio: '16:9' });
                            }

                            _faDone++;
                            callbacks.onProgress?.(`宸插畬鎴?${_faDone}/${scenesCount}`, 20 + Math.round((_faDone / scenesCount) * 55), `鉁?鍒嗛暅${i + 1}`);
                            callbacks.onStepComplete?.(`鍒嗛暅${i + 1}`, { imageUrl });
                            return { index: i + 1, text: sceneText.substring(0, 100), imageUrl, videoUrl };
                        } catch (e) {
                            _faDone++;
                            console.error(`鍒嗛暅 ${i + 1} 澶辫触:`, e);
                            callbacks.onProgress?.(`宸插畬鎴?${_faDone}/${scenesCount}`, 20 + Math.round((_faDone / scenesCount) * 55), `鉂?鍒嗛暅${i + 1}`);
                            return { index: i + 1, text: '', imageUrl: null, videoUrl: null };
                        }
                    })()));
                    sceneResults.sort((a, b) => a.index - b.index);
                    results.scenes = sceneResults.filter(s => s.imageUrl);
                    results.videos = sceneResults.filter(s => s.videoUrl).map(s => ({ index: s.index, videoUrl: s.videoUrl }));

                    // 姝ラ 4: 骞惰鐢熸垚婕敾锛堝鏋滈渶瑕侊級
                    if (outputType === 'comic' || outputType === 'both') {
                        const comicPages = Math.ceil(scenesCount / 4);
                        callbacks.onProgress?.('骞惰鐢熸垚婕敾', 80, `鍚屾椂鐢熸垚 ${comicPages} 椤垫极鐢?..`);
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
                                    callbacks.onProgress?.(`婕敾 ${_cmDone}/${comicPages}`, 80 + Math.round((_cmDone / comicPages) * 15), `鉁?绗?{p + 1}椤礰);
                                    return { page: p + 1, imageUrl: comicUrl };
                                })
                                .catch(e => { _cmDone++; console.error(`婕敾绗?${p + 1} 椤靛け璐?`, e); return null; });
                        }))).filter(Boolean);
                    }

                    callbacks.onProgress?.('瀹屾垚', 100, '鍏ㄦ祦绋嬫墽琛屽畬鎴愶紒');

                    return results;
                }
            },

            // ==================== 馃帹 璁捐绫?====================

            // 11. 鍝佺墝瑙嗚鍏ㄦ (Logo & Brand System)
            {
                id: 'brand_visual_system',
                name: '鍝佺墝瑙嗚鍏ㄦ',
                icon: '馃幆',
                category: 'design',
                description: '杈撳叆鍝佺墝鍚嶇О鍜岃涓氾紝AI 鑷姩瑙勫垝鍝佺墝绛栫暐骞剁敓鎴愬畬鏁磋瑙変綋绯伙細Logo銆佸悕鐗囥€佸寘瑁呫€佺ぞ濯掑皝闈€佸搧鐗屾墜鍐屻€?,
                parameters: [
                    { key: 'brandName', label: '鍝佺墝鍚嶇О', type: 'text', required: true, placeholder: '渚嬪锛歋tarFlow銆佹槦娴? },
                    { key: 'industry', label: '琛屼笟/棰嗗煙', type: 'text', required: true, placeholder: '渚嬪锛氱鎶€銆侀楗€佺編濡嗐€佹暀鑲?..' },
                    { key: 'refImage', label: '鍙傝€冨浘锛堝彲閫夛級', type: 'image', hint: '涓婁紶宸叉湁 Logo 鎴栭鏍煎弬鑰冨浘锛孉I 浼氬熀浜庢璁捐' },
                    { key: 'style', label: '璁捐椋庢牸', type: 'select', default: 'modern', options: [
                        { value: 'modern', label: '绠€绾︾幇浠? }, { value: 'luxury', label: '楂樼濂㈠崕' },
                        { value: 'playful', label: '娲绘臣鏈夎叮' }, { value: 'tech', label: '绉戞妧鏈潵' },
                        { value: 'natural', label: '鑷劧娓呮柊' }, { value: 'retro', label: '澶嶅彜缁忓吀' }
                    ]},
                    { key: 'slogan', label: '鍝佺墝鏍囪锛堝彲閫夛級', type: 'text', placeholder: '渚嬪锛歀et creativity flow' },
                    { key: 'colorPref', label: '鍋忓ソ鑹茬郴锛堝彲閫夛級', type: 'text', placeholder: '渚嬪锛氳摑绱壊绯汇€佺孩閲戦厤鑹?..' }
                ],
                estimateCost: () => ({ film: 6, time: '绾?3-5 鍒嗛挓' }),
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

                    // Step 1: LLM 瑙勫垝鍝佺墝绛栫暐
                    callbacks.onProgress?.('鍝佺墝绛栫暐', 5, '姝ｅ湪瑙勫垝鍝佺墝瑙嗚绛栫暐...');
                    try {
                        const strategyPrompt = `浣犳槸璧勬繁鍝佺墝璁捐鎬荤洃銆備负銆?{brandName}銆嶏紙琛屼笟锛?{industry}锛夊埗瀹氬搧鐗岃瑙夌瓥鐣ャ€?璁捐椋庢牸锛?{style}
${slogan ? '鏍囪锛? + slogan : ''}
${colorPref ? '鑹插僵鍋忓ソ锛? + colorPref : ''}

璇疯緭鍑猴細
1. 鍝佺墝瀹氫綅锛堜竴鍙ヨ瘽锛?2. 涓昏壊璋冿紙HEX鑹插€?+ 璇箟锛?3. 杈呭姪鑹诧紙2-3涓級
4. 瀛椾綋椋庢牸寤鸿
5. Logo璁捐鏂瑰悜锛堝浘褰㈠厓绱犮€佺粨鏋勶級
6. 璁捐鐞嗗康锛堢敤 1-2 鍙ヨ瘽瑙ｉ噴鍟嗕笟閫昏緫锛?
绠€娲佽緭鍑猴紝姣忛」涓€琛屻€俙;
                        if (typeof callScriptGenerator === 'function') {
                            results.strategy = await callScriptGenerator({}, strategyPrompt);
                        }
                        callbacks.onStepComplete?.('鍝佺墝绛栫暐', { script: results.strategy?.substring(0, 150) + '...' });
                    } catch (e) { console.error('鍝佺墝绛栫暐澶辫触:', e); }

                    const brandContext = results.strategy ? results.strategy.substring(0, 300) : `${brandName}, ${industry}, ${designStyle}`;

                    // 馃柤锔?瑙ｆ瀽鍙傝€冨浘锛堟敮鎸佸鍥撅級
                    const brandRefs = await resolveRefImages(refImage);
                    let userRefImage = brandRefs.first;
                    const allBrandRefImages = brandRefs.all;

                    // Step 2-7: 鎵归噺鐢熸垚鍝佺墝鐗╂枡
                    const assets = [
                        { name: 'Logo 璁捐', prompt: `Professional logo design for "${brandName}", ${designStyle}, ${industry} brand, vector style, clean white background, centered composition, brand identity, ${brandContext.substring(0, 100)}`, ratio: '1:1' },
                        { name: 'Logo 鍙樹綋濂楄', prompt: `Logo variations sheet for "${brandName}", showing 6 different versions: full color, monochrome, reversed, icon only, horizontal layout, stacked layout, ${designStyle}, white background, organized grid`, ratio: '16:9' },
                        { name: '鍚嶇墖璁捐', prompt: `Professional business card design for "${brandName}", front and back view, ${designStyle}, ${industry}, showing name/title/phone/email/website placeholders, premium print quality mockup`, ratio: '16:9' },
                        { name: '浜у搧鍖呰', prompt: `Product packaging design mockup for "${brandName}", ${industry} product, ${designStyle}, 3D rendered box/bag/bottle on clean background, premium quality, photorealistic`, ratio: '1:1' },
                        { name: '绀惧獟灏侀潰', prompt: `Social media cover design for "${brandName}", ${slogan || industry}, ${designStyle}, modern banner layout, brand colors, eye-catching composition, 16:9 aspect ratio`, ratio: '16:9' },
                        { name: '鍝佺墝鎵嬪唽椤?, prompt: `Brand guidelines page for "${brandName}", showing color palette, typography, logo usage rules, spacing guidelines, ${designStyle}, clean professional layout, design manual page`, ratio: '9:16' }
                    ];

                    // 馃幆 鏃犲弬鑰冨浘鏃讹紝鍏堢敓鎴愰寮犱綔涓洪鏍奸敋鐐?                    let _firstBrandUrl = null;
                    if (!userRefImage && assets.length > 1) {
                        callbacks.onProgress?.('鐢熸垚椋庢牸鍩哄噯', 8, '鍏堢敓鎴愰寮犲搧鐗岀墿鏂欑‘瀹氶鏍?..');
                        try {
                            const firstAsset = assets[0];
                            _firstBrandUrl = await callImageAPIWithRefs(firstAsset.prompt, { aspectRatio: firstAsset.ratio }, allBrandRefImages);
                            userRefImage = _firstBrandUrl;
                            callbacks.onStepComplete?.(firstAsset.name + '(椋庢牸鍩哄噯)', { imageUrl: _firstBrandUrl });
                        } catch (e) { console.warn('椋庢牸鍩哄噯鍥惧け璐?', e.message); }
                    }

                    callbacks.onProgress?.('骞惰鐢熸垚', 10, `鍚屾椂鐢熸垚 ${assets.length} 寮犲搧鐗岀墿鏂?..`);
                    let _bDone = 0;
                    results.images = await Promise.all(assets.map((asset, _bIdx) => {
                        // 棣栧紶宸蹭綔涓哄熀鍑嗗浘鐢熸垚杩囷紝鐩存帴澶嶇敤
                        if (_bIdx === 0 && _firstBrandUrl) {
                            _bDone++;
                            callbacks.onProgress?.(`宸插畬鎴?${_bDone}/${assets.length}`, 10 + Math.round((_bDone / assets.length) * 85), `鉁?${asset.name}`);
                            callbacks.onStepComplete?.(asset.name, { imageUrl: _firstBrandUrl });
                            return Promise.resolve({ subject: asset.name, imageUrl: _firstBrandUrl, status: 'success' });
                        }
                        const opts = { aspectRatio: asset.ratio };
                        if (userRefImage) opts.refImage = userRefImage;
                        return callImageAPIWithRefs(asset.prompt, opts, allBrandRefImages)
                            .then(imageUrl => {
                                _bDone++;
                                callbacks.onProgress?.(`宸插畬鎴?${_bDone}/${assets.length}`, 10 + Math.round((_bDone / assets.length) * 85), `鉁?${asset.name}`);
                                callbacks.onStepComplete?.(asset.name, { imageUrl });
                                return { subject: asset.name, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _bDone++;
                                callbacks.onProgress?.(`宸插畬鎴?${_bDone}/${assets.length}`, 10 + Math.round((_bDone / assets.length) * 85), `鉂?${asset.name}`);
                                return { subject: asset.name, error: e.message, status: 'failed' };
                            });
                    }));

                    callbacks.onProgress?.('瀹屾垚', 100, `鍝佺墝瑙嗚鍏ㄦ宸茬敓鎴愶紒鍏?${results.images.filter(i => i.status === 'success').length} 寮犺璁″浘`);
                    return { brandName, strategy: results.strategy, images: results.images };
                }
            },

            // 12. 绀惧獟绱犳潗濂楄 (Social Media Visual Assets)
            {
                id: 'social_media_kit',
                name: '绀惧獟绱犳潗濂楄',
                icon: '馃摫',
                category: 'design',
                description: '涓€閿敓鎴愬骞冲彴閫傞厤鐨勭ぞ濯掔礌鏉愶細鎶栭煶銆佸皬绾功銆佸井鍗氥€丅绔欍€佸叕浼楀彿銆傝嚜鍔ㄩ€傞厤灏哄鍜岄鏍笺€?,
                parameters: [
                    { key: 'topic', label: '鍐呭涓婚', type: 'textarea', required: true, placeholder: '渚嬪锛?026鏂板勾淇冮攢銆佹柊鍝佸彂甯冦€佸搧鐗屽浼?..' },
                    { key: 'brandInfo', label: '鍝佺墝/浜у搧鍚?, type: 'text', placeholder: '渚嬪锛歋tarFlow 鍜栧暋' },
                    { key: 'refImage', label: '鍝佺墝鍙傝€冨浘锛堝彲閫夛級', type: 'image', hint: '涓婁紶鍝佺墝 Logo 鎴栦骇鍝佸浘锛屾墍鏈夌礌鏉愬熀浜庢椋庢牸鐢熸垚' },
                    { key: 'platforms', label: '鐩爣骞冲彴', type: 'select', default: 'all', options: [
                        { value: 'all', label: '鍏ㄥ钩鍙帮紙6寮狅級' }, { value: 'douyin', label: '鎶栭煶锛?:16锛? },
                        { value: 'xiaohongshu', label: '灏忕孩涔︼紙3:4锛? }, { value: 'weibo', label: '寰崥锛?6:9锛? },
                        { value: 'bilibili', label: 'B绔欙紙16:9锛? }, { value: 'wechat', label: '鍏紬鍙凤紙16:9锛? }
                    ]},
                    { key: 'style', label: '瑙嗚椋庢牸', type: 'select', default: 'trendy', options: [
                        { value: 'trendy', label: '娼祦鏃跺皻' }, { value: 'minimal', label: '鏋佺畝澶ф皵' },
                        { value: 'vibrant', label: '娲诲姏缂悍' }, { value: 'elegant', label: '绮捐嚧浼橀泤' }
                    ]}
                ],
                estimateCost: (params) => {
                    const count = params.platforms === 'all' ? 6 : 1;
                    return { film: Math.ceil(count * 0.5), time: `绾?${count} 鍒嗛挓` };
                },
                execute: async (params, callbacks) => {
                    const { topic, brandInfo, platforms, style, refImage } = params;

                    // 馃柤锔?瑙ｆ瀽鍙傝€冨浘锛堟敮鎸佸鍥撅級
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
                        { id: 'douyin', name: '鎶栭煶', ratio: '9:16', hint: 'vertical full-screen, big centered text, Douyin/TikTok style' },
                        { id: 'xiaohongshu', name: '灏忕孩涔?, ratio: '9:16', hint: 'lifestyle aesthetic, soft tones, Xiaohongshu style, Chinese text overlay' },
                        { id: 'weibo', name: '寰崥', ratio: '16:9', hint: 'horizontal banner, news-style layout, Weibo post image' },
                        { id: 'bilibili', name: 'B绔?, ratio: '16:9', hint: 'thumbnail cover, anime-influenced, Bilibili video cover' },
                        { id: 'wechat', name: '鍏紬鍙?, ratio: '16:9', hint: 'WeChat article header, professional, editorial style' },
                        { id: 'instagram', name: 'Instagram', ratio: '1:1', hint: 'square format, Instagram aesthetic, lifestyle photography style' }
                    ];

                    const targets = platforms === 'all' ? platformSpecs : platformSpecs.filter(p => p.id === platforms);

                    // 馃幆 鏃犲弬鑰冨浘鏃讹紝鍏堢敓鎴愰寮犱綔涓洪鏍奸敋鐐?                    let _firstSocialUrl = null;
                    if (!userRefImage && targets.length > 1) {
                        callbacks.onProgress?.('鐢熸垚椋庢牸鍩哄噯', 3, '鍏堢敓鎴愰寮犵ぞ濯掔礌鏉愮‘瀹氶鏍?..');
                        try {
                            const firstP = targets[0];
                            const firstPrompt = `${designStyle}, social media post design for ${firstP.name}, ${firstP.hint}, topic: ${topic}, ${brandInfo ? 'brand: ' + brandInfo + ',' : ''} high quality, professional marketing design`;
                            _firstSocialUrl = await callImageAPIWithRefs(firstPrompt, { aspectRatio: firstP.ratio }, allSocialRefImages);
                            userRefImage = _firstSocialUrl;
                            callbacks.onStepComplete?.(firstP.name + '(椋庢牸鍩哄噯)', { imageUrl: _firstSocialUrl });
                        } catch (e) { console.warn('椋庢牸鍩哄噯鍥惧け璐?', e.message); }
                    }

                    callbacks.onProgress?.('骞惰鐢熸垚', 5, `鍚屾椂鐢熸垚 ${targets.length} 寮犵ぞ濯掔礌鏉?..`);
                    let _sDone = 0;
                    const results = await Promise.all(targets.map((p, _sIdx) => {
                        // 棣栧紶宸蹭綔涓哄熀鍑嗗浘鐢熸垚杩囷紝鐩存帴澶嶇敤
                        if (_sIdx === 0 && _firstSocialUrl) {
                            _sDone++;
                            callbacks.onProgress?.(`宸插畬鎴?${_sDone}/${targets.length}`, Math.round((_sDone / targets.length) * 95), `鉁?${p.name}`);
                            callbacks.onStepComplete?.(`${p.name}绱犳潗`, { imageUrl: _firstSocialUrl });
                            return Promise.resolve({ subject: `${p.name} (${p.ratio})`, imageUrl: _firstSocialUrl, status: 'success' });
                        }
                        const prompt = `${designStyle}, social media post design for ${p.name}, ${p.hint}, topic: ${topic}, ${brandInfo ? 'brand: ' + brandInfo + ',' : ''} high quality, professional marketing design`;
                        const opts = { aspectRatio: p.ratio };
                        if (userRefImage) opts.refImage = userRefImage;
                        return callImageAPIWithRefs(prompt, opts, allSocialRefImages)
                            .then(imageUrl => {
                                _sDone++;
                                callbacks.onProgress?.(`宸插畬鎴?${_sDone}/${targets.length}`, Math.round((_sDone / targets.length) * 95), `鉁?${p.name}`);
                                callbacks.onStepComplete?.(`${p.name}绱犳潗`, { imageUrl });
                                return { subject: `${p.name} (${p.ratio})`, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _sDone++;
                                callbacks.onProgress?.(`宸插畬鎴?${_sDone}/${targets.length}`, Math.round((_sDone / targets.length) * 95), `鉂?${p.name}`);
                                return { subject: p.name, error: e.message, status: 'failed' };
                            });
                    }));

                    callbacks.onProgress?.('瀹屾垚', 100, `宸茬敓鎴?${results.filter(r => r.status === 'success').length} 寮犵ぞ濯掔礌鏉恅);
                    return { images: results };
                }
            },

            // 13. 鐢靛晢鍏ㄥ鍥?(E-commerce Complete Kit)
            {
                id: 'ecommerce_complete',
                name: '鐢靛晢鍏ㄥ鍥?,
                icon: '馃洅',
                category: 'design',
                description: '涓€绔欏紡鐢熸垚鍏ㄥ鐢靛晢绱犳潗锛氫骇鍝佸鍥?+ 鍟嗚椤?+ 绀句氦闀垮浘銆傛敮鎸佹窐瀹?浜笢/浜氶┈閫?灏忕孩涔︾瓑骞冲彴銆?,
                parameters: [
                    { key: 'product', label: '浜у搧鍚嶇О', type: 'text', required: true, placeholder: '渚嬪锛氭棤绾胯摑鐗欒€虫満銆佺礌鐨弻鑲╁寘...' },
                    { key: 'productImage', label: '浜у搧鍙傝€冨浘锛堟帹鑽愶級', type: 'image', hint: '涓婁紶浜у搧瀹炴媿鍥炬垨3D娓叉煋鍥撅紝AI 鍩轰簬姝ょ敓鎴愬叏濂楃數鍟嗗浘' },
                    { key: 'sellingPoints', label: '鏍稿績鍗栫偣', type: 'textarea', required: true, placeholder: '姣忚涓€涓崠鐐癸紝渚嬪锛歕n闄嶅櫔40dB\n缁埅30灏忔椂\nIPX5闃叉按' },
                    { key: 'scenes', label: '浣跨敤鍦烘櫙', type: 'textarea', placeholder: '渚嬪锛歕n閫氬嫟璺笂\n鍋ヨ韩鎴縗n鍔炲叕瀹n灞呭浼戦棽' },
                    { key: 'price', label: '浠锋牸/淇冮攢', type: 'text', placeholder: '渚嬪锛毬?9 闄愭椂鐗规儬 鍘熶环楼199' },
                    { key: 'platform', label: '鐩爣骞冲彴', type: 'select', default: 'taobao', options: [
                        { value: 'taobao', label: '娣樺疂/澶╃尗' }, { value: 'jd', label: '浜笢' },
                        { value: 'amazon', label: '浜氶┈閫? }, { value: 'xiaohongshu', label: '灏忕孩涔? },
                        { value: 'douyin', label: '鎶栭煶' }, { value: 'wechat', label: '鏈嬪弸鍦? }
                    ]},
                    { key: 'style', label: '瑙嗚椋庢牸', type: 'select', default: 'premium', options: [
                        { value: 'premium', label: '楂樼鍝佽川' }, { value: 'minimal', label: '鏋佺畝鐧藉簳' },
                        { value: 'lifestyle', label: '鐢熸椿鍦烘櫙' }, { value: 'tech', label: '绉戞妧鎰? },
                        { value: 'luxury', label: '楂樼濂㈠崕' }
                    ]}
                ],
                estimateCost: () => ({ film: 12, time: '绾?6-8 鍒嗛挓' }),
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
                    
                    shots.push({ name: '鐧藉簳涓诲浘', prompt: `${product}, pure white background, studio product photography, centered, clean, professional listing main image, high resolution, ${designStyle}`, ratio: '1:1' });
                    shots.push({ name: '鍗栫偣淇℃伅鍥?, prompt: `${product} infographic, product features highlight, ${points.slice(0, 3).join(', ')}, ${designStyle}, annotated product image with feature callouts, icons and text overlay, marketing design`, ratio: '1:1' });
                    shots.push({ name: '鍦烘櫙灞曠ず', prompt: `${product} lifestyle photography, person using/wearing the product in real life scenario, ${designStyle}, natural lighting, aspirational, editorial quality`, ratio: '1:1' });
                    shots.push({ name: '缁嗚妭鐗瑰啓', prompt: `${product} detail close-up shots, material texture, craftsmanship, quality details, macro photography, ${designStyle}, showing premium quality`, ratio: '1:1' });
                    shots.push({ name: '灏哄瀵规瘮', prompt: `${product} size comparison, product next to common objects for scale reference, dimensions labeled, clean infographic style, white background`, ratio: '1:1' });
                    shots.push({ name: '鍝佺墝妯箙', prompt: `Brand banner for ${product}, premium brand story header, ${designStyle}, wide horizontal banner, brand values, elegant typography, marketing page hero image`, ratio: '16:9' });
                    
                    shots.push({ name: '鍟嗚棣栧睆', prompt: `${product} hero banner, premium product showcase, ${designStyle}, eye-catching, marketing poster, vertical format 9:16, professional typography`, ratio: '9:16' });
                    points.slice(0, 4).forEach((point, i) => {
                        shots.push({ name: `鍔熻兘灞曠ず${i + 1}`, prompt: `${product} feature showcase, highlighting: ${point}, ${designStyle}, infographic style, icons and text annotations, clear communication, vertical 9:16`, ratio: '9:16' });
                    });
                    sceneList.slice(0, 2).forEach((s, i) => {
                        shots.push({ name: `鍦烘櫙灞曠ず${i + 1}`, prompt: `${product} in ${s} scenario, lifestyle photography, person using the product, ${designStyle}, natural lighting, authentic atmosphere, vertical 9:16`, ratio: '9:16' });
                    });
                    shots.push({ name: '鍟嗚缁嗚妭', prompt: `${product} detail close-up, material texture, craftsmanship, quality details, macro photography, ${designStyle}, showing premium quality, vertical 9:16`, ratio: '9:16' });
                    shots.push({ name: '鍝佺墝鑳屼功', prompt: `${product} brand story section, trust badges, warranty info, quality guarantee, ${designStyle}, professional trust-building design, vertical 9:16`, ratio: '9:16' });
                    
                    shots.push({ name: '绀句氦涓诲浘', prompt: `${product} e-commerce social media post, ${platformStyle}, ${price ? `price tag showing ${price}, ` : ''}product main showcase, eye-catching design, vertical format 9:16, professional typography, ${designStyle}`, ratio: '9:16' });
                    shots.push({ name: '绀句氦鍗栫偣', prompt: `${product} selling points infographic, ${points.slice(0, 4).join(', ')}, ${platformStyle}, clear feature icons, text annotations, vertical 9:16, easy to read, ${designStyle}`, ratio: '9:16' });
                    shots.push({ name: '绀句氦鍦烘櫙', prompt: `${product} lifestyle scene, ${platformStyle}, showing product quality and usage, vertical 9:16, ${designStyle}`, ratio: '9:16' });
                    shots.push({ name: '绀句氦CTA', prompt: `${product} call-to-action, ${platformStyle}, shop now, limited time offer, urgency, vertical 9:16, ${designStyle}`, ratio: '9:16' });

                    // 馃幆 鏃犲弬鑰冨浘鏃讹紝鍏堢敓鎴愰寮犱綔涓洪鏍奸敋鐐?                    let _firstUrl = null;
                    if (!productRefImage && shots.length > 1) {
                        callbacks.onProgress?.('鐢熸垚椋庢牸鍩哄噯', 2, '鍏堢敓鎴愰寮犲浘纭畾椋庢牸...');
                        try {
                            const firstShot = shots[0];
                            _firstUrl = await callImageAPIWithRefs(firstShot.prompt, { aspectRatio: firstShot.ratio }, compressedAllRefs);
                            productRefImage = _firstUrl;
                            callbacks.onStepComplete?.(firstShot.name + '(椋庢牸鍩哄噯)', { imageUrl: _firstUrl });
                        } catch (e) { console.warn('椋庢牸鍩哄噯鍥惧け璐?', e.message); }
                    }

                    callbacks.onProgress?.('骞惰鐢熸垚', 5, `鍚屾椂鐢熸垚 ${shots.length} 寮犵數鍟嗗叏濂楀浘...`);
                    let _done = 0;
                    const results = await Promise.all(shots.map((shot, idx) => {
                        if (idx === 0 && _firstUrl) {
                            _done++;
                            callbacks.onProgress?.(`宸插畬鎴?${_done}/${shots.length}`, 5 + Math.round((_done / shots.length) * 90), `鉁?${shot.name}`);
                            callbacks.onStepComplete?.(shot.name, { imageUrl: _firstUrl });
                            return Promise.resolve({ subject: shot.name, imageUrl: _firstUrl, status: 'success' });
                        }
                        const opts = { aspectRatio: shot.ratio };
                        if (productRefImage) opts.refImage = productRefImage;
                        return callImageAPIWithRefs(shot.prompt, opts, compressedAllRefs)
                            .then(imageUrl => {
                                _done++;
                                callbacks.onProgress?.(`宸插畬鎴?${_done}/${shots.length}`, 5 + Math.round((_done / shots.length) * 90), `鉁?${shot.name}`);
                                callbacks.onStepComplete?.(shot.name, { imageUrl });
                                return { subject: shot.name, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _done++;
                                callbacks.onProgress?.(`宸插畬鎴?${_done}/${shots.length}`, 5 + Math.round((_done / shots.length) * 90), `鉂?${shot.name}`);
                                return { subject: shot.name, error: e.message, status: 'failed' };
                            });
                    }));

                    callbacks.onProgress?.('瀹屾垚', 100, `鐢靛晢鍏ㄥ鍥惧凡鐢熸垚锛佸叡 ${results.filter(r => r.status === 'success').length} 寮燻);
                    return { images: results };
                }
            },

            // 14. 钀ラ攢瀹ｄ紶鍐?(Marketing Brochure)
            {
                id: 'marketing_brochure',
                name: '钀ラ攢瀹ｄ紶鍐?,
                icon: '馃摉',
                category: 'design',
                description: '鐢熸垚涓撲笟涓夋姌椤靛浼犲唽锛屽寘鍚皝闈€佸唴椤点€佸皝搴曪紝鍙洿鎺ュ嵃鍒枫€?,
                parameters: [
                    { key: 'subject', label: '瀹ｄ紶涓婚', type: 'textarea', required: true, placeholder: '渚嬪锛氶珮绔憸浼芥湇鍝佺墝瀹ｄ紶鍐屻€佹梾娓稿害鍋囨潙鎷涘晢鎵嬪唽...' },
                    { key: 'refImage', label: '椋庢牸鍙傝€冨浘锛堝彲閫夛級', type: 'image', hint: '涓婁紶鍝佺墝绱犳潗鎴栬璁″弬鑰冨浘锛屽浼犲唽椋庢牸灏嗗熀浜庢鐢熸垚' },
                    { key: 'audience', label: '鐩爣鍙椾紬', type: 'text', placeholder: '渚嬪锛?5-40宀侀兘甯傚コ鎬с€佷紒涓氬喅绛栬€?..' },
                    { key: 'keyPoints', label: '鏍稿績鍗栫偣', type: 'textarea', required: true, placeholder: '姣忚涓€涓崠鐐癸紝鏈€澶?涓? },
                    { key: 'style', label: '璁捐椋庢牸', type: 'select', default: 'professional', options: [
                        { value: 'professional', label: '涓撲笟鍟嗗姟' }, { value: 'creative', label: '鍒涙剰娲绘臣' },
                        { value: 'luxury', label: '楂樼濂㈠崕' }, { value: 'eco', label: '鑷劧鐜繚' }
                    ]}
                ],
                estimateCost: () => ({ film: 4, time: '绾?3 鍒嗛挓' }),
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

                    // 馃柤锔?瑙ｆ瀽鍙傝€冨浘锛堟敮鎸佸鍥撅級
                    const brochureRefs = await resolveRefImages(refImage);
                    let userRefImage = brochureRefs.first;
                    const allBrochureRefImages = brochureRefs.all;

                    // Step 1: LLM 鐢熸垚瀹ｄ紶鍐屾枃妗?                    callbacks.onProgress?.('绛栧垝鏂囨', 5, '姝ｅ湪鎾板啓瀹ｄ紶鍐屾枃妗?..');
                    let copyText = '';
                    try {
                        if (typeof callScriptGenerator === 'function') {
                            copyText = await callScriptGenerator({}, `涓轰互涓嬩富棰樻挵鍐欎笁鎶橀〉瀹ｄ紶鍐屾枃妗堬細
涓婚锛?{subject}
鍙椾紬锛?{audience || '閫氱敤'}
鍗栫偣锛?{points.join('銆?)}

杈撳嚭鏍煎紡锛?[灏侀潰] 鏍囬 + 鍓爣棰?[鍐呴〉宸 鍗栫偣浠嬬粛
[鍐呴〉涓璢 浜у搧/鏈嶅姟璇︽儏
[鍐呴〉鍙砞 瀹㈡埛璇勪环/鏁版嵁
[灏佸簳] 鑱旂郴鏂瑰紡 + CTA

绠€娲佹湁鍔涳紝閫傚悎鍗板埛銆俙);
                        }
                        callbacks.onStepComplete?.('瀹ｄ紶鍐屾枃妗?, { script: copyText?.substring(0, 100) + '...' });
                    } catch (e) { }

                    const pages = [
                        { name: '澶栭〉灞曞紑鍥?, prompt: `Tri-fold brochure OUTER layout flat design, ${designStyle}, for "${subject}", front cover (right panel) with headline, back cover (left panel) with contact info, middle panel with summary, unfolded view, ${audience ? 'targeting ' + audience : ''}, print-ready quality`, ratio: '16:9' },
                        { name: '鍐呴〉灞曞紑鍥?, prompt: `Tri-fold brochure INNER layout flat design, ${designStyle}, for "${subject}", 3 panels showing: left-features/benefits, center-product details with images, right-testimonials/CTA, unfolded view, professional print quality`, ratio: '16:9' },
                        { name: '鎶樺彔瀹炵墿娓叉煋', prompt: `Photorealistic mockup of folded tri-fold brochure, ${designStyle}, for "${subject}", ${audience ? 'targeting ' + audience : ''}, brochure on desk/table, soft shadows, professional studio photography`, ratio: '16:9' },
                        { name: '鍦烘櫙灞曠ず', prompt: `Marketing brochure in real-world context, person holding/reading the brochure at ${subject.includes('鏃呮父') ? 'travel expo' : subject.includes('鍋ヨ韩') ? 'gym reception' : 'business meeting'}, ${designStyle}, lifestyle photography, professional`, ratio: '16:9' }
                    ];

                    // 馃幆 鏃犲弬鑰冨浘鏃讹紝鍏堢敓鎴愰寮犱綔涓洪鏍奸敋鐐?                    let _firstBrochUrl = null;
                    if (!userRefImage && pages.length > 1) {
                        callbacks.onProgress?.('鐢熸垚椋庢牸鍩哄噯', 12, '鍏堢敓鎴愰寮犲浼犲唽纭畾椋庢牸...');
                        try {
                            const firstPage = pages[0];
                            _firstBrochUrl = await callImageAPIWithRefs(firstPage.prompt, { aspectRatio: firstPage.ratio }, allBrochureRefImages);
                            userRefImage = _firstBrochUrl;
                            callbacks.onStepComplete?.(firstPage.name + '(椋庢牸鍩哄噯)', { imageUrl: _firstBrochUrl });
                        } catch (e) { console.warn('椋庢牸鍩哄噯鍥惧け璐?', e.message); }
                    }

                    callbacks.onProgress?.('骞惰鐢熸垚', 15, `鍚屾椂鐢熸垚 ${pages.length} 寮犲浼犲唽...`);
                    let _mDone = 0;
                    const results = await Promise.all(pages.map((page, _mIdx) => {
                        // 棣栧紶宸蹭綔涓哄熀鍑嗗浘鐢熸垚杩囷紝鐩存帴澶嶇敤
                        if (_mIdx === 0 && _firstBrochUrl) {
                            _mDone++;
                            callbacks.onProgress?.(`宸插畬鎴?${_mDone}/${pages.length}`, 15 + Math.round((_mDone / pages.length) * 80), `鉁?${page.name}`);
                            callbacks.onStepComplete?.(page.name, { imageUrl: _firstBrochUrl });
                            return Promise.resolve({ subject: page.name, imageUrl: _firstBrochUrl, status: 'success' });
                        }
                        const opts = { aspectRatio: page.ratio };
                        if (userRefImage) opts.refImage = userRefImage;
                        return callImageAPIWithRefs(page.prompt, opts, allBrochureRefImages)
                            .then(imageUrl => {
                                _mDone++;
                                callbacks.onProgress?.(`宸插畬鎴?${_mDone}/${pages.length}`, 15 + Math.round((_mDone / pages.length) * 80), `鉁?${page.name}`);
                                callbacks.onStepComplete?.(page.name, { imageUrl });
                                return { subject: page.name, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _mDone++;
                                callbacks.onProgress?.(`宸插畬鎴?${_mDone}/${pages.length}`, 15 + Math.round((_mDone / pages.length) * 80), `鉂?${page.name}`);
                                return { subject: page.name, error: e.message, status: 'failed' };
                            });
                    }));

                    callbacks.onProgress?.('瀹屾垚', 100, `瀹ｄ紶鍐屽凡鐢熸垚锛佸叡 ${results.filter(r => r.status === 'success').length} 寮犺璁″浘`);
                    return { copyText, images: results };
                }
            },

            // 15. IP瑙掕壊鐢熸€?(IP Character Ecosystem)
            {
                id: 'ip_character_ecosystem',
                name: 'IP瑙掕壊鐢熸€?,
                icon: '馃幁',
                category: 'design',
                description: '浠庤鑹茶瀹氬埌琛ㄦ儏鍖呫€佽创绾搞€佸懆杈瑰晢鍝併€佺ぞ濯掑ご鍍忥紝涓€閿敓鎴愬畬鏁碔P瑙掕壊璧勪骇銆?,
                parameters: [
                    { key: 'charConcept', label: '瑙掕壊姒傚康', type: 'textarea', required: true, placeholder: '鎻忚堪瑙掕壊澶栬銆佹€ф牸銆佹晠浜嬭儗鏅?..' },
                    { key: 'charName', label: '瑙掕壊鍚嶇О', type: 'text', required: true, placeholder: '渚嬪锛氬皬鏄熴€丮ochi...' },
                    { key: 'charRefImage', label: '瑙掕壊鍙傝€冨浘锛堝彲閫夛級', type: 'image', hint: '涓婁紶宸叉湁瑙掕壊鑽夌/鍘熷瀷鍥撅紝AI 浼氬熀浜庢淇濇寔涓€鑷存€? },
                    { key: 'style', label: '鐢婚', type: 'select', default: 'cute', options: [
                        { value: 'cute', label: '鍙埍钀岀郴' }, { value: 'cool', label: '娼叿琛楀ご' },
                        { value: 'chibi', label: 'Q鐗堝崱閫? }, { value: 'realistic', label: '鍐欏疄3D' },
                        { value: 'pixel', label: '鍍忕礌椋? }
                    ]},
                    { key: 'usage', label: '鐢ㄩ€斿満鏅?, type: 'select', default: 'brand', options: [
                        { value: 'brand', label: '鍝佺墝鍚夌ゥ鐗? }, { value: 'sticker', label: '鑱婂ぉ琛ㄦ儏鍖? },
                        { value: 'merch', label: '鍛ㄨ竟鍟嗗搧' }, { value: 'all', label: '鍏ㄩ儴锛?寮狅級' }
                    ]}
                ],
                estimateCost: (params) => {
                    const count = params.usage === 'all' ? 8 : 4;
                    return { film: Math.ceil(count * 0.5), time: `绾?${count} 鍒嗛挓` };
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

                    // 馃柤锔?瑙ｆ瀽瑙掕壊鍙傝€冨浘锛堟敮鎸佸鍥撅級
                    const ipRefs = await resolveRefImages(charRefImage);
                    let refImageUrl = ipRefs.first;
                    const allIPRefImages = ipRefs.all;

                    const allAssets = [
                        { name: '瑙掕壊璁惧畾鍥?, prompt: `Character design sheet for "${charName}", ${charConcept}, ${designStyle}, front view and side view and back view, full body, clean white background, character reference sheet, professional concept art`, ratio: '16:9', group: 'core' },
                        { name: '琛ㄦ儏鍖呭鍥?, prompt: `Expression sheet of "${charName}" character, ${designStyle}, ${charConcept}, 9 different emotions in 3x3 grid: happy, sad, angry, surprised, shy, love, sleepy, confused, laughing, close-up face, white background`, ratio: '1:1', group: 'sticker' },
                        { name: '鍔ㄦ€佽创绾?, prompt: `Sticker pack of "${charName}", ${designStyle}, ${charConcept}, 6 cute animated pose stickers: waving, dancing, thumbs up, eating, sleeping, celebrating, die-cut style, white background`, ratio: '1:1', group: 'sticker' },
                        { name: '绀惧獟澶村儚濂楄', prompt: `Social media avatar set of "${charName}", ${designStyle}, ${charConcept}, 4 profile picture variations: default, holiday, night mode, celebration, circular crop friendly, vibrant background`, ratio: '1:1', group: 'brand' },
                        { name: 'T鎭よ璁?, prompt: `T-shirt mockup featuring "${charName}" character, ${designStyle}, ${charConcept}, creative graphic tee design, front print, photorealistic clothing mockup on model or flat lay`, ratio: '1:1', group: 'merch' },
                        { name: '椹厠鏉璁?, prompt: `Mug mockup featuring "${charName}" character, ${designStyle}, ${charConcept}, cute character wrapped around ceramic mug, photorealistic product mockup, studio lighting`, ratio: '1:1', group: 'merch' },
                        { name: '鎵嬫満澹宠璁?, prompt: `Phone case mockup featuring "${charName}" character, ${designStyle}, ${charConcept}, creative phone case design, photorealistic mockup on latest smartphone`, ratio: '9:16', group: 'merch' },
                        { name: '鍦烘櫙鎻掔敾', prompt: `"${charName}" character illustration in a scene, ${designStyle}, ${charConcept}, character in their natural environment, storytelling illustration, detailed background, atmospheric lighting`, ratio: '16:9', group: 'core' }
                    ];

                    const targets = usage === 'all' ? allAssets : allAssets.filter(a => a.group === 'core' || a.group === usage);

                    // 馃幆 鏃犲弬鑰冨浘鏃讹紝鍏堢敓鎴愰寮狅紙瑙掕壊璁惧畾鍥撅級浣滀负椋庢牸閿氱偣
                    let _firstIPUrl = null;
                    if (!refImageUrl && targets.length > 1) {
                        callbacks.onProgress?.('鐢熸垚椋庢牸鍩哄噯', 3, '鍏堢敓鎴愯鑹茶瀹氬浘纭畾椋庢牸...');
                        try {
                            const firstAsset = targets[0];
                            _firstIPUrl = await callImageAPIWithRefs(firstAsset.prompt, { aspectRatio: firstAsset.ratio }, allIPRefImages);
                            refImageUrl = _firstIPUrl;
                            callbacks.onStepComplete?.(firstAsset.name + '(椋庢牸鍩哄噯)', { imageUrl: _firstIPUrl });
                        } catch (e) { console.warn('椋庢牸鍩哄噯鍥惧け璐?', e.message); }
                    }

                    callbacks.onProgress?.('骞惰鐢熸垚', 5, `鍚屾椂鐢熸垚 ${targets.length} 寮營P绱犳潗...`);
                    let _ipDone = 0;
                    const ipResults = await Promise.all(targets.map((asset, _ipIdx) => {
                        // 棣栧紶宸蹭綔涓哄熀鍑嗗浘鐢熸垚杩囷紝鐩存帴澶嶇敤
                        if (_ipIdx === 0 && _firstIPUrl) {
                            _ipDone++;
                            callbacks.onProgress?.(`宸插畬鎴?${_ipDone}/${targets.length}`, Math.round((_ipDone / targets.length) * 95), `鉁?${asset.name}`);
                            callbacks.onStepComplete?.(asset.name, { imageUrl: _firstIPUrl });
                            return Promise.resolve({ subject: asset.name, imageUrl: _firstIPUrl, status: 'success' });
                        }
                        const opts = { aspectRatio: asset.ratio };
                        if (refImageUrl) opts.refImage = refImageUrl;
                        return callImageAPIWithRefs(asset.prompt, opts, allIPRefImages)
                            .then(imageUrl => {
                                _ipDone++;
                                callbacks.onProgress?.(`宸插畬鎴?${_ipDone}/${targets.length}`, Math.round((_ipDone / targets.length) * 95), `鉁?${asset.name}`);
                                callbacks.onStepComplete?.(asset.name, { imageUrl });
                                return { subject: asset.name, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                _ipDone++;
                                callbacks.onProgress?.(`宸插畬鎴?${_ipDone}/${targets.length}`, Math.round((_ipDone / targets.length) * 95), `鉂?${asset.name}`);
                                return { subject: asset.name, error: e.message, status: 'failed' };
                            });
                    }));

                    callbacks.onProgress?.('瀹屾垚', 100, `IP瑙掕壊鐢熸€佸凡鐢熸垚锛佸叡 ${ipResults.filter(r => r.status === 'success').length} 寮燻);
                    return { characterName: charName, images: ipResults };
                }
            },

            // 16. 鍒嗛暅鑴氭湰鍜岃鑹茶瀹氳〃 (Production Storyboards & Character Sheets)
            {
                id: 'storyboard_character_sheet',
                name: '鍒嗛暅鑴氭湰鍜岃鑹茶瀹氳〃',
                icon: '馃幀',
                category: 'design',
                description: '涓婁紶瑙掕壊鍙傝€冨浘 + 涓€鍙ヨ瘽鎻忚堪锛孉I 鑷姩鐢熸垚瑙掕壊璁惧畾琛ㄥ拰鍒嗛暅鑴氭湰鍥俱€傞€傚悎鍔ㄧ敾銆佹极鐢汇€佺煭鐗囩殑鍓嶆湡鍒朵綔銆?,
                parameters: [
                    { key: 'story', label: '鏁呬簨/鍦烘櫙鎻忚堪', type: 'textarea', required: true, placeholder: '渚嬪锛氱┛榛戣壊T鎭ょ殑瓒呭摜楠戠潃椹効锛岀粰绀剧兢鎴愬憳鎸ㄤ釜閫侀┈骞寸绂?..', hint: '涓€鍙ヨ瘽鎴栦竴娈佃瘽閮藉彲浠ワ紝AI 浼氳嚜鍔ㄦ媶鍒嗕负鍒嗛暅' },
                    { key: 'refImage', label: '瑙掕壊/鍦烘櫙鍙傝€冨浘', type: 'image', hint: '涓婁紶瑙掕壊鐓х墖鎴栨彃鐢伙紝鍒嗛暅灏嗕繚鎸佽鑹蹭竴鑷存€э紙寮虹儓鎺ㄨ崘锛? },
                    { key: 'panelCount', label: '鍒嗛暅鏁伴噺', type: 'number', default: 6, min: 2, max: 20, hint: '寤鸿 4-8 涓垎闀? },
                    { key: 'includeCharSheet', label: '鐢熸垚瑙掕壊璁惧畾琛?, type: 'checkbox', default: true, checkboxLabel: '鍏堢敓鎴愯鑹蹭笁瑙嗗浘璁惧畾锛岀‘淇濆垎闀滆鑹蹭竴鑷? },
                    { key: 'style', label: '鐢婚', type: 'select', default: 'anime', options: [
                        { value: 'anime', label: '馃帉 鍔ㄦ极椋? }, { value: 'realistic', label: '馃摳 鍐欏疄椋? },
                        { value: 'chinese', label: '馃彯 鍥介' }, { value: 'storyboard', label: '鉁忥笍 绾跨鍒嗛暅' },
                        { value: 'cinematic', label: '馃帴 鐢靛奖鎰? }
                    ]},
                    { key: 'aspectRatio', label: '鍒嗛暅姣斾緥', type: 'select', default: '16:9', options: [
                        { value: '16:9', label: '16:9 妯増锛堟帹鑽愶級' }, { value: '1:1', label: '1:1 姝ｆ柟褰? },
                        { value: '9:16', label: '9:16 绔栫増' }, { value: '3:4', label: '3:4 绔栫増鏍囧噯' }
                    ]}
                ],
                estimateCost: (params) => {
                    const panels = params.panelCount || 6;
                    let count = panels; // 姣忎釜鍒嗛暅 1 寮犲浘
                    if (params.includeCharSheet) count += 1; // 瑙掕壊璁惧畾琛?                    return { film: count * 5, time: `绾?${Math.ceil(count * 0.5)} 鍒嗛挓` };
                },
                execute: async (params, callbacks) => {
                    const { story, refImage, panelCount, includeCharSheet, style, aspectRatio } = params;
                    const results = { charSheet: null, panels: [] };

                    // 馃柤锔?瑙ｆ瀽鍙傝€冨浘
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

                    // ========== Step 1: LLM 鎷嗗垎鍒嗛暅鑴氭湰 ==========
                    callbacks.onProgress?.('鎷嗗垎鍒嗛暅鑴氭湰', 5, '姝ｅ湪灏嗘晠浜嬫媶鍒嗕负鍒嗛暅...');

                    const splitPrompt = `浣犳槸涓撲笟鍔ㄧ敾鍒嗛暅甯堛€傝灏嗕互涓嬫晠浜?鎻忚堪鎷嗗垎涓?${panelCount} 涓垎闀滅敾闈€?
鏁呬簨鎻忚堪锛?{story}

璇蜂负姣忎釜鍒嗛暅杈撳嚭锛?銆愬垎闀?銆戠敾闈㈡弿杩帮紙鐢ㄨ嫳鏂囷紝璇︾粏鎻忚堪瑙掕壊鍔ㄤ綔銆佽〃鎯呫€侀暅澶磋搴︺€佸満鏅幆澧冿級
銆愬垎闀?銆?..
...

瑕佹眰锛?1. 姣忎釜鍒嗛暅鏄竴涓嫭绔嬬敾闈?2. 闀滃ご瑕佹湁鍙樺寲锛堣繙鏅€佷腑鏅€佽繎鏅€佺壒鍐欎氦鏇匡級
3. 鎻忚堪瑕佸叿浣擄紝鍙互鐩存帴浣滀负 AI 缁樼敾鐨?prompt
4. 淇濇寔瑙掕壊鐗瑰緛涓€鑷?5. 鐢婚潰鎻忚堪鐢ㄨ嫳鏂囪緭鍑篳;

                    let panelDescriptions = [];
                    try {
                        let outline = '';
                        if (typeof callScriptGenerator === 'function') {
                            outline = await callScriptGenerator({}, splitPrompt);
                        } else if (typeof callModelScopeTextAPI === 'function') {
                            outline = await callModelScopeTextAPI(splitPrompt);
                        }
                        // 瑙ｆ瀽鍒嗛暅
                        panelDescriptions = outline.split(/銆愬垎闀淺d+銆?i).filter(s => s.trim());
                        if (panelDescriptions.length === 0) {
                            // fallback: 鎸夋钀藉垎
                            panelDescriptions = outline.split(/\n+/).filter(s => s.trim().length > 10);
                        }
                        callbacks.onStepComplete?.('鍒嗛暅鑴氭湰', { script: outline.substring(0, 200) + '...' });
                    } catch (e) {
                        console.error('鍒嗛暅鑴氭湰鐢熸垚澶辫触:', e);
                        // fallback: 鐢ㄦ晠浜嬫湰韬媶鍒?                        for (let i = 0; i < panelCount; i++) {
                            panelDescriptions.push(`scene ${i + 1} of the story: ${story}`);
                        }
                    }

                    // 纭繚鏁伴噺鍖归厤
                    while (panelDescriptions.length < panelCount) {
                        panelDescriptions.push(panelDescriptions[panelDescriptions.length - 1] || story);
                    }
                    panelDescriptions = panelDescriptions.slice(0, panelCount);

                    // ========== Step 2: 瑙掕壊璁惧畾琛紙鍙€夛級==========
                    if (includeCharSheet) {
                        callbacks.onProgress?.('鐢熸垚瑙掕壊璁惧畾琛?, 10, '姝ｅ湪缁樺埗瑙掕壊涓夎鍥捐瀹?..');
                        try {
                            const charPrompt = `${designStyle}, professional character design reference sheet, character turnaround, front view, 3/4 view, side view, back view, full body, clean white background, consistent character design, model sheet, ${story.substring(0, 200)}, detailed character features, professional concept art`;

                            const opts = { aspectRatio: '16:9' };
                            if (charRefUrl) opts.refImage = charRefUrl;
                            results.charSheet = await callImageAPIWithRefs(charPrompt, opts, allRefImages);

                            // 鐢ㄨ鑹茶瀹氬浘浣滀负鍚庣画鍒嗛暅鐨勫弬鑰冿紙淇濇寔涓€鑷存€э級
                            if (results.charSheet && !charRefUrl) {
                                charRefUrl = results.charSheet;
                            }
                            callbacks.onStepComplete?.('瑙掕壊璁惧畾琛?, { imageUrl: results.charSheet });
                        } catch (e) {
                            console.error('瑙掕壊璁惧畾琛ㄧ敓鎴愬け璐?', e);
                        }
                    }

                    // ========== Step 3: 骞惰鐢熸垚鍏ㄩ儴鍒嗛暅鐢婚潰 ==========
                    const baseProgress = includeCharSheet ? 20 : 10;
                    callbacks.onProgress?.('骞惰鐢熸垚鍒嗛暅', baseProgress, `鍚屾椂鐢熸垚 ${panelDescriptions.length} 涓垎闀?..`);

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
                                callbacks.onProgress?.(`宸插畬鎴?${completedCount}/${panelDescriptions.length}`, progress, `鉁?鍒嗛暅${i + 1}`);
                                callbacks.onStepComplete?.(`鍒嗛暅${i + 1}`, { imageUrl });
                                return { index: i + 1, description: desc, imageUrl, status: 'success' };
                            })
                            .catch(e => {
                                completedCount++;
                                const progress = baseProgress + Math.round((completedCount / panelDescriptions.length) * (95 - baseProgress));
                                callbacks.onProgress?.(`宸插畬鎴?${completedCount}/${panelDescriptions.length}`, progress, `鉂?鍒嗛暅${i + 1}: ${e.message}`);
                                return { index: i + 1, description: desc, error: e.message, status: 'failed' };
                            });
                    });

                    results.panels = await Promise.all(panelPromises);
                    // 鎸夊垎闀滃簭鍙锋帓搴?                    results.panels.sort((a, b) => a.index - b.index);

                    const successCount = results.panels.filter(p => p.status === 'success').length;
                    callbacks.onProgress?.('瀹屾垚', 100, `鍒嗛暅鑴氭湰宸茬敓鎴愶紒瑙掕壊璁惧畾琛?${results.charSheet ? '1寮? : '鏃?} + 鍒嗛暅 ${successCount}/${panelDescriptions.length} 寮燻);

                    return {
                        charSheet: results.charSheet,
                        images: [
                            ...(results.charSheet ? [{ subject: '瑙掕壊璁惧畾琛?, imageUrl: results.charSheet, status: 'success' }] : []),
                            ...results.panels.map(p => ({ subject: `鍒嗛暅${p.index}`, imageUrl: p.imageUrl, status: p.status, error: p.error }))
                        ]
                    };
                }
            },

            // ==================== 馃敡 宸ュ叿绫?====================

            // 17. 鍥剧墖鏂囧瓧璇嗗埆 (OCR)
            {
                id: 'image_ocr',
                name: '鍥剧墖鏂囧瓧璇嗗埆',
                icon: '馃攳',
                category: 'tool',
                description: '浣跨敤 DeepSeek OCR 璇嗗埆鍥剧墖涓殑鎵€鏈夋枃瀛楋紝鏀寔涓枃銆佽嫳鏂囥€佽〃鏍笺€佹墜鍐欎綋绛夈€?,
                parameters: [
                    { key: 'image', label: '涓婁紶鍥剧墖', type: 'image', required: true, hint: '鏀寔 JPG/PNG锛屾埅鍥俱€佺収鐗囥€佹枃妗ｆ壂鎻忎欢绛? },
                    { key: 'ocrMode', label: '璇嗗埆妯″紡', type: 'select', default: 'all', options: [
                        { value: 'all', label: '鍏ㄩ儴鏂囧瓧' }, { value: 'table', label: '琛ㄦ牸璇嗗埆' },
                        { value: 'handwrite', label: '鎵嬪啓浣? }, { value: 'translate', label: '璇嗗埆+缈昏瘧' }
                    ]}
                ],
                estimateCost: () => ({ film: 2, time: '绾?10 绉? }),
                execute: async (params, callbacks) => {
                    const { image, ocrMode } = params;
                    if (!image || image.length === 0) throw new Error('璇蜂笂浼犲浘鐗?);

                    callbacks.onProgress?.('OCR璇嗗埆', 30, '姝ｅ湪璇嗗埆鍥剧墖鏂囧瓧...');

                    // 馃柤锔?鍏煎 base64 鏁扮粍鍜?FileList
                    const ocrRefs = await resolveRefImages(image);
                    const imageUrl = ocrRefs.first;
                    if (!imageUrl) throw new Error('鍥剧墖璇诲彇澶辫触');

                    const modePrompts = {
                        all: '璇疯瘑鍒苟杈撳嚭鍥剧墖涓殑鎵€鏈夋枃瀛楀唴瀹癸紝淇濇寔鍘熷鎺掔増鏍煎紡銆?,
                        table: '璇疯瘑鍒浘鐗囦腑鐨勮〃鏍硷紝鐢?Markdown 琛ㄦ牸鏍煎紡杈撳嚭锛屼繚鎸佽鍒楃粨鏋勩€?,
                        handwrite: '璇疯瘑鍒浘鐗囦腑鐨勬墜鍐欐枃瀛楋紝灏藉彲鑳藉噯纭緭鍑恒€?,
                        translate: '璇疯瘑鍒浘鐗囦腑鐨勬墍鏈夋枃瀛楋紝鍏堣緭鍑哄師鏂囷紝鐒跺悗鍦ㄤ笅鏂规彁渚涗腑鏂囩炕璇戙€?
                    };

                    let result = '';
                    if (typeof callOCRAPI === 'function') {
                        result = await callOCRAPI(imageUrl, modePrompts[ocrMode] || modePrompts.all, 'deepseek-ocr');
                    } else {
                        throw new Error('OCR 鍔熻兘涓嶅彲鐢?);
                    }

                    callbacks.onStepComplete?.('OCR璇嗗埆', { text: result?.substring(0, 100) + '...' });
                    callbacks.onProgress?.('瀹屾垚', 100, `璇嗗埆瀹屾垚锛佸叡 ${result.length} 涓瓧绗);

                    return { ocrText: result, outline: result };
                }
            }
        ];

        // 娉ㄥ唽鎵€鏈夐缃?Skills
        SkillManager.registerAll(presetSkills);

console.log('馃З 棰勭疆 Skills 娉ㄥ唽瀹屾垚锛?7 涓妧鑳斤級');
    }
})();
