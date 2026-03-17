/**
 * ========================================
 * 馃敡 API 鏍稿績妯″潡 (api-core.js)
 * ========================================
 * 
 * 鎻愪緵 Skill 鎵ц鎵€闇€鐨勬牳蹇?API 璋冪敤鍑芥暟
 * 姝ゆā鍧楀彲琚?chat.html 绛夐〉闈㈢嫭绔嬪紩鐢? * 
 * 鍖呭惈锛? * - callScriptGenerator - 鍓ф湰鐢熸垚
 * - callModelScopeImageAPI - 榄斿鍥剧墖鐢熸垚
 * - callModelScopeTextAPI - 榄斿鏂囨湰鐢熸垚
 * - callSora2TextToVideoAPI - Sora2 鏂囩敓瑙嗛
 * - callSora2ImageToVideoAPI - Sora2 鍥剧敓瑙嗛
 * - 浠ュ強鎵€鏈夊繀闇€鐨勮緟鍔╁嚱鏁? */

(function (global) {
    'use strict';

    // ==================== 馃敡 鍩虹宸ュ叿鍑芥暟 ====================

    /**
     * 馃敆 妫€鏌ユ槸鍚︿负鏈夋晥鐨勫獟浣揢RL锛堟敮鎸?http(s) 鍜?data: URL锛?     */
    function isValidMediaUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return url.startsWith('http') || url.startsWith('data:image/') || url.startsWith('data:video/');
    }

    /**
     * 寤惰繜鎵ц
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 馃攼 鑾峰彇褰撳墠鐢ㄦ埛ID锛堢敤浜嶢PI璋冪敤鏃朵紶閫抲serId锛?     */
    async function getCurrentUserId() {
        if (typeof NVAuth === 'undefined') return null;
        try {
            const user = await NVAuth.getCurrentUser();
            return user?.id || null;
        } catch (e) {
            console.warn('[getCurrentUserId] 鑾峰彇鐢ㄦ埛ID澶辫触:', e);
            return null;
        }
    }

    // 馃敀 鎵ｈ垂浼氳瘽鎺у埗锛氬洟闃?鎶€鑳芥墽琛屾湡闂磋烦杩囬€愭鎵ｈ垂锛岀敱璋冪敤鏂逛竴娆℃€ч鎵?    let _billingSessionCount = 0;
    function startBillingSession() { _billingSessionCount++; console.log('[api-core] 馃敀 鎵ｈ垂浼氳瘽寮€濮?count=' + _billingSessionCount); }
    function endBillingSession() { _billingSessionCount = Math.max(0, _billingSessionCount - 1); console.log('[api-core] 馃敁 鎵ｈ垂浼氳瘽缁撴潫 count=' + _billingSessionCount); }

    /**
     * 馃攧 甯﹂噸璇曠殑 API 璋冪敤
     */
    async function retryableAPICall(fn, optionsOrMaxRetries = {}, legacyRetryDelayMs) {
        const options = (typeof optionsOrMaxRetries === 'number')
            ? { maxRetries: optionsOrMaxRetries, retryDelayMs: legacyRetryDelayMs }
            : (optionsOrMaxRetries || {});
        const maxRetries = Number.isFinite(options.maxRetries) ? options.maxRetries : 3;
        const retryDelayMs = Number.isFinite(options.retryDelayMs) ? options.retryDelayMs : 3000;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn(attempt);
            } catch (e) {
                lastErr = e;
                if (e && e.name === 'AbortError') break;
                if (attempt >= maxRetries) break;
                await new Promise(r => setTimeout(r, retryDelayMs * attempt));
            }
        }
        throw lastErr || new Error('API璋冪敤澶辫触');
    }

    /**
     * 馃攳 妫€鏌ョ敤鎴锋槸鍚︿负浠樿垂鐢ㄦ埛
     */
    function isPaidUser() {
        const filmBalance = parseFloat(localStorage.getItem('film_balance') || '0');
        const memberType = localStorage.getItem('membership_type');
        if (memberType && memberType !== 'free') return true;

        const vipInfo = localStorage.getItem('vip_info');
        if (vipInfo) {
            try {
                const parsed = JSON.parse(vipInfo);
                if (parsed.expiry && new Date(parsed.expiry) > new Date()) return true;
            } catch (e) {
                if (vipInfo.includes('pro') || vipInfo.includes('mid') || vipInfo.includes('basic') || vipInfo.includes('vip')) {
                    return true;
                }
            }
        }
        return filmBalance > 0;
    }

    /**
     * 馃啌 妫€鏌ュ厤璐圭敤鎴锋槸鍚﹀彲浠ヤ娇鐢ㄦ煇鏂囨湰鐢熸垚鏈嶅姟
     */
    function checkFreeUserTextProvider(provider) {
        if (isPaidUser()) return { allowed: true, message: '' };
        if (provider === 'gemini3' || provider === 'gemini') {
            return {
                allowed: false,
                message: 'Gemini3 鏄粯璐圭敤鎴蜂笓灞炲姛鑳絓n\n馃啌 鍏嶈垂鐢ㄦ埛鍙娇鐢細榄斿鏅鸿兘鏂囨湰\n馃幀 鍏呭€间换鎰忓椁愬嵆鍙В閿?Gemini3'
            };
        }
        return { allowed: true, message: '' };
    }

    /**
     * 馃啌 妫€鏌ュ厤璐圭敤鎴疯闂潈闄愶紙绠€鍖栫増锛?     */
    function checkFreeUserAccess(featureType) {
        if (isPaidUser()) {
            return { blocked: false, useFirstTimeGift: false, useFreeAPI: false };
        }
        // 绠€鍖栫増锛氬厤璐圭敤鎴锋€绘槸鍏佽锛屽叿浣撻搴︾敱鍚庣鎺у埗
        return { blocked: false, useFreeAPI: true, message: '浣跨敤鍏嶈垂棰濆害' };
    }

    // ==================== 馃敡 瑙嗛妯″瀷杈呭姪鍑芥暟 ====================

    function __normalizeVideoModelName(model) {
        const m = String(model || '').trim();
        const ml = m.toLowerCase();
        if (!ml) return 'sora-2-vip-all';
        if (ml === 'sora-2-vip-all') return 'sora-2-vip-all';
        // 馃敡 鏃?sora2 妯″瀷宸插仠鐢紝缁熶竴杞崲涓鸿繃娓℃ā鍨?sora-2-vip-all
        if (ml === 'sora2' || ml === 'sora-2' || ml === 'sora-2-hd' || ml === 'sora2-hd' || ml === 'sora-2-all') return 'sora-2-vip-all';
        if (ml === 'sora2pro' || ml === 'sora-2-pro' || ml === 'sora2-pro' || ml === 'sora-2-pro-all') return 'sora-2-vip-all';
        if (ml === 'sora-2-characters') return 'sora-2-vip-all';
        if (ml === 'veo3.1fast' || ml === 'veo-3.1fast' || ml === 'veo-3.1-fast') return 'veo3.1';
        if (ml === 'veo3.1' || ml === 'veo-3.1') return 'veo3.1';
        if (ml === 'veo3.1-pro' || ml === 'veo-3.1-pro' || ml === 'veo3.1pro') return 'veo3.1';
        if (ml === 'veo2' || ml === 'veo-2' || ml === 'veo2-fast' || ml === 'veo-2-fast') return 'veo2';
        if (ml === 'veo3' || ml === 'veo-3') return 'veo3';
        if (ml === 'grok3' || ml === 'grok-video-3' || ml === 'grok-video-3-text' || ml === 'grok-video-3-hd') return 'grok-video-3';
        if (ml.startsWith('vidu-') || ml.startsWith('hailuo-') || ml.startsWith('kling-')) return m;
        if (ml.startsWith('wan26-')) return m;
        return m;
    }

    function __getFixedClipDurationByModel(model, hd) {
        const m = __normalizeVideoModelName(model);
        if (m === 'sora-2-vip-all') return 10; // 杩囨浮妯″瀷鍥哄畾10绉?        if (m === 'sora-2-pro-all') {
            const wantHd = (typeof hd === 'undefined') ? true : !!hd;
            return wantHd ? 15 : 25;
        }
        if (m === 'grok-video-3') return 6;
        if (m === 'grok-video-3-10s') return 10;
        if (m === 'veo3.1' || m === 'veo3') return 8;
        if (m === 'veo2') return 8;
        if (String(m).startsWith('vidu-') || String(m).startsWith('kling-')) {
            const durationMatch = String(m).match(/-(\\d+)s[-$]/i) || String(m).match(/-(\\d+)s$/i);
            return durationMatch ? parseInt(durationMatch[1]) : 5;
        }
        if (String(m).startsWith('hailuo-')) {
            const durationMatch = String(m).match(/-(\\d+)s[-$]/i) || String(m).match(/-(\\d+)s$/i);
            return durationMatch ? parseInt(durationMatch[1]) : 6;
        }
        if (String(m).startsWith('wan26-')) {
            const durationMatch = String(m).match(/-(\d+)s/i);
            return durationMatch ? parseInt(durationMatch[1]) : 5;
        }
        if (String(m).startsWith('sora-2')) return 10;
        return 15;
    }

    function __isViduModel(model) {
        return model && String(model).toLowerCase().startsWith('vidu-');
    }

    function __isHailuoModel(model) {
        return model && String(model).toLowerCase().startsWith('hailuo-');
    }

    function __isKlingModel(model) {
        return model && String(model).toLowerCase().startsWith('kling-');
    }

    function __isWan26Model(model) {
        return model && String(model).toLowerCase().startsWith('wan26-');
    }

    function __parseWan26Model(model) {
        // wan26-720p-5s, wan26-1080p-10s-audio
        const match = String(model || '').match(/wan26-(720p|1080p)-(\d+)s(-audio)?/i);
        if (match) {
            return {
                resolution: match[1].toUpperCase(),
                duration: parseInt(match[2]),
                audio: !!match[3]
            };
        }
        return { resolution: '720P', duration: 5, audio: false };
    }

    function __parseViduModel(model) {
        const newMatch = String(model || '').match(/vidu-(q3-pro|q2-pro|q2-turbo|q2)-(\d+)s-(720p|1080p)/i);
        if (newMatch) {
            return {
                version: newMatch[1],
                duration: parseInt(newMatch[2]),
                resolution: newMatch[3].toUpperCase()
            };
        }
        const oldMatch = String(model || '').match(/vidu-(q3-pro|q2-pro|q2-turbo|q2)-(720p|1080p)/i);
        if (oldMatch) {
            return {
                version: oldMatch[1],
                duration: 5,
                resolution: oldMatch[2].toUpperCase()
            };
        }
        return { version: 'q2', duration: 5, resolution: '720P' };
    }

    function __parseHailuoModel(model) {
        const match = String(model || '').match(/hailuo-(02|fast)-(768p|1080p)-(\d+)s/i);
        if (match) {
            const versionMap = { '02': '02', 'fast': '2.3-fast' };
            return {
                version: versionMap[match[1].toLowerCase()] || match[1],
                resolution: match[2].toUpperCase(),
                duration: parseInt(match[3])
            };
        }
        return { version: '02', duration: 6, resolution: '768P' };
    }

    function __parseKlingModel(model) {
        const match = String(model || '').match(/kling-(o1|2\.5|2\.0|2\.1|1\.6)-(720p|1080p)-(\d+)s/i);
        if (match) {
            const version = match[1].toUpperCase() === 'O1' ? 'O1' : match[1];
            return {
                version: version,
                resolution: match[2].toUpperCase(),
                duration: parseInt(match[3])
            };
        }
        return { version: '2.5', duration: 5, resolution: '720P' };
    }

    // ==================== 馃摑 鏂囨湰鐢熸垚 API ====================

    /**
     * 馃摑 璋冪敤鐪熻嚮鏂囨湰 API锛圙emini3锛?     * 馃敡 澧炲姞閲嶈瘯鏈哄埗锛岃В鍐?HTTP/2 杩炴帴绌洪棽鏂紑闂
     */
    async function callZhenzhenTextAPI(prompt, options = {}) {
        const model = options.model || 'gemini-3-pro-preview';
        const temperature = (typeof options.temperature === 'number') ? options.temperature : 0.7;
        const max_tokens = (typeof options.max_tokens === 'number') ? options.max_tokens : 4096;
        const speed = (typeof options.speed === 'number') ? options.speed : 1;

        if (!prompt) throw new Error('鎻愮ず璇嶄负绌?);

        const paid = isPaidUser();
        if (!paid) {
            const access = checkFreeUserTextProvider('gemini3');
            if (!access || !access.allowed) {
                throw new Error((access && access.message) ? access.message : 'Gemini3 涓轰粯璐圭敤鎴蜂笓灞炲姛鑳?);
            }
        }

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('璇峰厛鐧诲綍鍚庡啀浣跨敤姝ゅ姛鑳?);

        // 馃敡 鍐呴儴璇锋眰鍑芥暟锛堝甫閲嶈瘯锛?        const maxRetries = 3;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let res;
            try {
                res = await fetch('/api/yunwu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'text',
                        prompt,
                        model,
                        temperature,
                        max_tokens,
                        speed,
                        userId,
                        skip_billing: _billingSessionCount > 0 || undefined
                    })
                });
            } catch (fetchErr) {
                lastErr = fetchErr;
                if (attempt < maxRetries) {
                    console.warn(`[ZhenzhenText] 缃戠粶閿欒绗?{attempt}娆★紝閲嶈瘯涓?..`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(`鏂囨湰鐢熸垚缃戠粶閿欒: ${fetchErr.message}`);
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                // 馃敡 鏈嶅姟鍣ㄩ敊璇紝閲嶈瘯
                if (res.status >= 500 && attempt < maxRetries) {
                    console.warn(`[ZhenzhenText] 鏈嶅姟鍣ㄩ敊璇?{res.status}锛岄噸璇曚腑...`);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(data.message || data.error || `鏂囨湰鐢熸垚澶辫触: ${res.status}`);
            }
            const content = String(data.content || data.text || '').trim();
            if (!content) throw new Error('鏂囨湰鐢熸垚杩斿洖涓虹┖');
            return content;
        }
        throw lastErr || new Error('鏂囨湰鐢熸垚璇锋眰澶辫触');
    }

    /**
     * 馃摑 璋冪敤榄斿鏂囨湰 API
     */
    async function callModelScopeTextAPI(prompt) {
        let userId = await getCurrentUserId();
        if (!userId) throw new Error('璇峰厛鐧诲綍鍚庡啀浣跨敤姝ゅ姛鑳?);

        const res = await fetch('/api/modelscope', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'text',
                prompt,
                userId
,
                skip_billing: _billingSessionCount > 0 || undefined
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            throw new Error(data.message || data.error || `ModelScope鏂囨湰澶辫触: ${res.status}`);
        }
        const content = String(data.content || '').trim();
        if (!content) throw new Error('ModelScope鏂囨湰杩斿洖涓虹┖');
        return content;
    }

    /**
     * 馃摑 璋冪敤鍐欎綔 LLM锛堝厹搴曪級
     * 馃敡 澧炲姞閲嶈瘯鏈哄埗锛岃В鍐?HTTP/2 杩炴帴绌洪棽鏂紑闂
     */
    async function callWriterLLM(messages, opts = {}) {
        let userId = await getCurrentUserId();

        // 馃 娉ㄥ叆鐢ㄦ埛璁板繂鍒?system prompt
        if (typeof getUserMemoryPrompt === 'function' && Array.isArray(messages) && messages.length > 0) {
            const memPrompt = getUserMemoryPrompt();
            if (memPrompt && messages[0] && messages[0].role === 'system') {
                messages = messages.slice();
                messages[0] = { ...messages[0], content: memPrompt + '\n' + messages[0].content };
            }
        }

        const payload = {
            messages,
            userId,
            skip_billing: _billingSessionCount > 0 || undefined,
            model: opts.model || 'roll',
            temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.7,
            max_tokens: typeof opts.max_tokens === 'number' ? opts.max_tokens : 4096
        };

        // 馃敡 鍐呴儴璇锋眰鍑芥暟锛堝甫閲嶈瘯锛?        const maxRetries = 3;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let res;
            try {
                res = await fetch('/api/writer-llm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (fetchErr) {
                lastErr = fetchErr;
                if (attempt < maxRetries) {
                    console.warn(`[WriterLLM] 缃戠粶閿欒绗?{attempt}娆★紝閲嶈瘯涓?..`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(`WriterLLM缃戠粶閿欒: ${fetchErr.message}`);
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.success === false) {
                // 馃敡 鏈嶅姟鍣ㄩ敊璇紝閲嶈瘯
                if (res.status >= 500 && attempt < maxRetries) {
                    console.warn(`[WriterLLM] 鏈嶅姟鍣ㄩ敊璇?{res.status}锛岄噸璇曚腑...`);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(data?.message || data?.error || `writer-llm failed: ${res.status}`);
            }
            return String(data?.content || '').trim();
        }
        throw lastErr || new Error('WriterLLM璇锋眰澶辫触');
    }

    /**
     * 馃摑 鍓ф湰鐢熸垚鍣紙鑷姩閫夋嫨鏈€浣抽€氶亾锛?     */
    async function callScriptGenerator(idea, prompt) {
        // 馃 娉ㄥ叆鐢ㄦ埛璁板繂鍒?prompt 鍓?        if (typeof getUserMemoryPrompt === 'function') {
            const memPrompt = getUserMemoryPrompt();
            if (memPrompt && prompt) {
                prompt = memPrompt + '\n' + prompt;
            }
        }

        const s = (idea && idea.settings) ? idea.settings : {};
        const provider = String(s.scriptProvider || 'gemini3').trim().toLowerCase();
        const paid = isPaidUser();

        // 馃啌 鍏嶈垂鐢ㄦ埛锛氶粯璁よ蛋"榄斿/鏅鸿兘鏂囨湰"閫氶亾
        const wantFreeText = (provider === 'motaverse') || (!paid && provider === 'gemini3');
        if (wantFreeText) {
            // 閰嶉妫€鏌?            if (!paid) {
                const access = checkFreeUserAccess('modelscope_text');
                if (access && access.blocked) {
                    throw new Error(access.message || '浠婃棩鍏嶈垂鏂囨湰棰濆害宸茬敤瀹?);
                }
            }

            // 1) 浼樺厛锛歁odelScope 鏂囨湰
            try {
                const out = await retryableAPICall(() => callModelScopeTextAPI(prompt), 2, 2000);
                if (out) return out;
            } catch (e) { }

            // 2) 鍏滃簳锛歸riter-llm
            try {
                const msg = [
                    { role: 'system', content: '浣犳槸涓枃鐭棰戝墽鏈?鏁呬簨鍐欎綔鍔╂墜銆傝鐩存帴杈撳嚭杩炶疮鐨勬晠浜嬫鏂囷紝涓嶈瑙ｉ噴銆? },
                    { role: 'user', content: String(prompt || '') }
                ];
                const out = await retryableAPICall(() => callWriterLLM(msg, { temperature: 0.8, max_tokens: 4096 }), 2, 2000);
                if (out) return out;
            } catch (e) { }

            throw new Error('鏂囨湰鐢熸垚澶辫触锛氬厤璐归€氶亾涓嶅彲鐢?);
        }

        // 馃拵 浠樿垂鐢ㄦ埛 / Gemini3 楂樼骇閫氶亾
        const model = s.scriptModel || s.textModel || 'gemini-3-pro-preview';
        const temperature = (typeof s.scriptTemperature === 'number') ? s.scriptTemperature : 0.8;
        const max_tokens = (typeof s.scriptMaxTokens === 'number') ? s.scriptMaxTokens : 4096;
        const speed = (typeof s.scriptSpeed === 'number') ? s.scriptSpeed : 1;
        return await retryableAPICall(() => callZhenzhenTextAPI(prompt, { model, temperature, max_tokens, speed }), 2, 2500);
    }

    // ==================== 馃帹 鍥剧墖鐢熸垚 API ====================

    /**
     * 馃帹 璋冪敤榄斿鍥剧墖 API
     * 馃敡 涓?AI 鐢诲浘椤甸潰涓€鑷达細绉婚櫎鍓嶇瓒呮椂锛岃璇锋眰鑷劧瀹屾垚
     * 馃敡 澧炲姞閲嶈瘯鏈哄埗锛岃В鍐?HTTP/2 杩炴帴绌洪棽鏂紑闂
     */
    async function callModelScopeImageAPI(prompt, options = {}) {
        const aspectRatio = options.aspectRatio || '1:1';
        const refImage = options.refImage;
        const refImages = options.refImages;
        const skipDeduct = options.skipDeduct || false;

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('璇峰厛鐧诲綍鍚庡啀浣跨敤姝ゅ姛鑳?);

        let imageUrls = undefined;
        let action = 'image';

        if (refImages && Array.isArray(refImages) && refImages.length >= 2) {
            imageUrls = refImages.slice(0, 3);
            action = 'image2image';
            console.log(`馃幁 [涓囪薄Max] 澶氬浘缂栬緫妯″紡: ${imageUrls.length}寮犲弬鑰冨浘`);
        } else if (refImage) {
            imageUrls = [refImage];
            action = 'image2image';
        }

        // 馃敡 鍐呴儴璇锋眰鍑芥暟锛堝甫閲嶈瘯锛?        const maxRetries = 3;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let msRes;
            try {
                // 馃敡 绉婚櫎 signal锛岃璇锋眰鑷劧瀹屾垚锛堜笌 AI 鐢诲浘椤甸潰涓€鑷达級
                msRes = await fetch('/api/modelscope', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action,
                        prompt,
                        aspectRatio,
                        imageUrls,
                        userId,
                        skip_billing: _billingSessionCount > 0 || undefined
                    })
                });
            } catch (fetchErr) {
                lastErr = fetchErr;
                // 馃敡 HTTP/2 杩炴帴鏂紑鎴栫綉缁滈敊璇紝閲嶈瘯
                if (attempt < maxRetries) {
                    console.warn(`[ModelScope] 缃戠粶閿欒绗?{attempt}娆★紝閲嶈瘯涓?..`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(`ModelScope缃戠粶閿欒: ${fetchErr.message}`);
            }
            const res = msRes;
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                // 馃敡 鏈嶅姟鍣ㄩ敊璇紝閲嶈瘯
                if (res.status >= 500 && attempt < maxRetries) {
                    console.warn(`[ModelScope] 鏈嶅姟鍣ㄩ敊璇?{res.status}锛岄噸璇曚腑...`);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(data.message || data.error || `ModelScope澶辫触: ${res.status}`);
            }
            const img = (data.images && data.images[0]) ? data.images[0] : null;
            if (!img) throw new Error('ModelScope 鏈繑鍥炲浘鐗?);
            return img;
        }
        throw lastErr || new Error('ModelScope璇锋眰澶辫触');
    }

    /**
     * 馃幀 璋冪敤榄斿瑙嗛鐢熸垚 API
     */
    async function callModelScopeVideoAPI(prompt, options = {}) {
        const aspectRatio = options.aspectRatio || '16:9';
        const duration = options.duration || 5;
        const model = options.model;

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('璇峰厛鐧诲綍鍚庡啀浣跨敤姝ゅ姛鑳?);

        // 馃敡 鍐呴儴璇锋眰鍑芥暟锛堝甫閲嶈瘯锛?        const maxRetries = 2;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const msRes = await fetch('/api/modelscope', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'video',
                        prompt,
                        aspectRatio,
                        duration,
                        model,
                        userId,
                        skip_billing: _billingSessionCount > 0 || undefined
                    })
                });
                const data = await msRes.json().catch(() => ({}));
                if (!msRes.ok || !data.success) {
                    throw new Error(data.message || data.error || `ModelScope瑙嗛澶辫触: ${msRes.status}`);
                }
                const video = (data.videos && data.videos[0]) ? data.videos[0] : null;
                if (!video) throw new Error('ModelScope 鏈繑鍥炶棰?);
                return video;
            } catch (fetchErr) {
                lastErr = fetchErr;
                if (attempt < maxRetries) {
                    console.warn(`[ModelScope Video] 缃戠粶閿欒绗?{attempt}娆★紝閲嶈瘯涓?..`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 3000 * attempt));
                    continue;
                }
                throw lastErr;
            }
        }
        throw lastErr || new Error('ModelScope瑙嗛璇锋眰澶辫触');
    }

    /**
     * 馃幀 璋冪敤榄斿鍥剧敓瑙嗛 API
     */
    async function callModelScopeImageToVideoAPI(prompt, imageUrls, options = {}) {
        const aspectRatio = options.aspectRatio || '16:9';
        const duration = options.duration || 5;
        const model = options.model;

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('璇峰厛鐧诲綍鍚庡啀浣跨敤姝ゅ姛鑳?);

        // 馃敡 鍐呴儴璇锋眰鍑芥暟锛堝甫閲嶈瘯锛?        const maxRetries = 2;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const msRes = await fetch('/api/modelscope', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'image2video',
                        prompt,
                        imageUrls: Array.isArray(imageUrls) ? imageUrls : [imageUrls],
                        aspectRatio,
                        duration,
                        model,
                        userId,
                        skip_billing: _billingSessionCount > 0 || undefined
                    })
                });
                const data = await msRes.json().catch(() => ({}));
                if (!msRes.ok || !data.success) {
                    throw new Error(data.message || data.error || `ModelScope鍥剧敓瑙嗛澶辫触: ${msRes.status}`);
                }
                const video = (data.videos && data.videos[0]) ? data.videos[0] : null;
                if (!video) throw new Error('ModelScope 鏈繑鍥炶棰?);
                return video;
            } catch (fetchErr) {
                lastErr = fetchErr;
                if (attempt < maxRetries) {
                    console.warn(`[ModelScope I2V] 缃戠粶閿欒绗?{attempt}娆★紝閲嶈瘯涓?..`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 3000 * attempt));
                    continue;
                }
                throw lastErr;
            }
        }
        throw lastErr || new Error('ModelScope鍥剧敓瑙嗛璇锋眰澶辫触');
    }

    /**
     * 馃帹 璋冪敤 Banana2 鍥剧墖 API
     * 馃敡 涓?AI 鐢诲浘椤甸潰涓€鑷达細绉婚櫎鍓嶇瓒呮椂锛岃璇锋眰鑷劧瀹屾垚
     * 馃敡 澧炲姞閲嶈瘯鏈哄埗锛岃В鍐?HTTP/2 杩炴帴绌洪棽鏂紑闂
     */
    async function callBanana2ImageAPI(prompt, options = {}) {
        let userId = await getCurrentUserId();
        if (!userId) throw new Error('璇峰厛鐧诲綍鍚庡啀浣跨敤姝ゅ姛鑳?);

        // 馃敡 鍙傝€冨浘鍏煎锛氭敮鎸佸崟鍥惧拰澶氬浘
        const refImageUrl = options.imageUrl || options.image_url || options.refImage || undefined;
        const refImagesArr = options.refImages || options.image_urls || undefined;

        const model = options.model || 'nano-banana-2';

        // 馃敡 鍐呴儴璇锋眰鍑芥暟锛堝甫閲嶈瘯锛?        const maxRetries = 3;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let res;
            try {
                const body = {
                    prompt,
                    model,
                    aspect_ratio: options.aspectRatio || options.aspect_ratio || '16:9',
                    userId,
                    skip_billing: _billingSessionCount > 0 || undefined
                };
                // 澶氬弬鑰冨浘浼樺厛锛屽惁鍒欏崟鍥?                if (refImagesArr && Array.isArray(refImagesArr) && refImagesArr.length > 0) {
                    body.image_urls = refImagesArr;
                } else if (refImageUrl) {
                    body.image_url = refImageUrl;
                }
                // 馃敡 绉婚櫎 signal锛岃璇锋眰鑷劧瀹屾垚锛堜笌 AI 鐢诲浘椤甸潰涓€鑷达級
                res = await fetch('/api/banana2', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            } catch (fetchErr) {
                lastErr = fetchErr;
                // 馃敡 HTTP/2 杩炴帴鏂紑鎴栫綉缁滈敊璇紝閲嶈瘯
                if (attempt < maxRetries) {
                    console.warn(`[Banana2] 缃戠粶閿欒绗?{attempt}娆★紝閲嶈瘯涓?..`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(`Banana2缃戠粶閿欒: ${fetchErr.message}`);
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                // 馃敡 鏈嶅姟鍣ㄩ敊璇紝閲嶈瘯
                if (res.status >= 500 && attempt < maxRetries) {
                    console.warn(`[Banana2] 鏈嶅姟鍣ㄩ敊璇?{res.status}锛岄噸璇曚腑...`);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(data.message || data.error || `Banana2澶辫触: ${res.status}`);
            }
            const img = data.url || (data.urls && data.urls[0]) || (data.data && data.data[0] && data.data[0].url);
            if (!img) throw new Error('Banana2 鏈繑鍥炲浘鐗?);
            return img;
        }
        throw lastErr || new Error('Banana2璇锋眰澶辫触');
    }

    // ==================== 馃幀 瑙嗛鐢熸垚 API ====================

    /**
     * 馃寠 杞 Wan2.6 浠诲姟鐘舵€侊紙alibailian API锛?     */
    async function pollWan26Task(taskId) {
        const maxAttempts = 300;
        for (let i = 0; i < maxAttempts; i++) {
            await sleep(3000);
            try {
                const res = await fetch('/api/yunwu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'wan26-poll', task_id: taskId })
                });
                if (!res.ok) {
                    console.warn(`鈿狅笍 Wan2.6杞璇锋眰澶辫触: ${res.status} (${i + 1}/${maxAttempts})`);
                    continue;
                }
                const data = await res.json();
                const status = String(data.status || '').toUpperCase();

                if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'DONE') {
                    const videoUrl = data.video_url || data.url || data?.output?.video_url;
                    if (videoUrl) {
                        console.log(`鉁?Wan2.6浠诲姟瀹屾垚: ${taskId}`);
                        return videoUrl;
                    }
                    throw new Error('Wan2.6浠诲姟瀹屾垚浣嗘湭鎵惧埌瑙嗛URL');
                }
                if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELED') {
                    const errorMsg = data.error || data.message || data?.output?.message || '鏈煡閿欒';
                    throw new Error(`Wan2.6瑙嗛鐢熸垚澶辫触: ${errorMsg}`);
                }
                if (i === 0 || ((i + 1) % 10 === 0)) {
                    console.log(`鈴?Wan2.6浠诲姟杩涜涓?.. (${i + 1}/${maxAttempts})`);
                }
            } catch (pollError) {
                if (pollError.message.includes('鐢熸垚澶辫触')) throw pollError;
                console.warn(`鈿狅笍 Wan2.6杞寮傚父: ${pollError.message}`);
            }
        }
        throw new Error('Wan2.6瑙嗛鐢熸垚瓒呮椂锛堝凡绛夊緟15鍒嗛挓锛?);
    }

    /**
     * 馃攧 杞 Sora2 浠诲姟鐘舵€?     */
    async function pollSora2Task(taskId, options = {}) {
        const maxAttempts = 300;
        const { _source, _endpoint } = options;

        for (let i = 0; i < maxAttempts; i++) {
            await sleep(3000);

            try {
                const res = await fetch('/api/sora2', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'poll',
                        task_id: taskId,
                        _source,
                        _endpoint
                    })
                });

                if (!res.ok) {
                    console.warn(`鈿狅笍 杞璇锋眰澶辫触: ${res.status} (${i + 1}/${maxAttempts})`);
                    continue;
                }

                const data = await res.json();
                const status = (data.status || data.state || data.task_status || '').toUpperCase();

                if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'DONE') {
                    console.log(`鉁?Sora2浠诲姟瀹屾垚: ${taskId}`);
                    const videoUrl =
                        data.video_url ||
                        data.videoUrl ||
                        data.url ||
                        data.data?.output ||
                        data.data?.video_url ||
                        data.data?.url ||
                        (Array.isArray(data.data) && data.data[0]?.url) ||
                        (Array.isArray(data.data) && data.data[0]?.video_url) ||
                        data.result?.url ||
                        data.result?.video_url;

                    if (videoUrl) return videoUrl;
                    throw new Error('浠诲姟瀹屾垚浣嗘湭鎵惧埌瑙嗛URL');
                }

                if (status === 'FAILURE' || status === 'FAILED' || status === 'ERROR' || status === 'FAIL' || status === 'CANCELLED' || status === 'CANCELED') {
                    const errorMsg = data.fail_reason || data.error || data.message || data.error_message || data.detail || '鏈煡閿欒';
                    throw new Error(`瑙嗛鐢熸垚澶辫触: ${errorMsg}`);
                }

                if (data.data?.status && ['FAILURE', 'FAILED', 'ERROR', 'FAIL'].includes(String(data.data.status).toUpperCase())) {
                    const errorMsg = data.data.fail_reason || data.data.error || data.data.message || '浠诲姟鎵ц澶辫触';
                    throw new Error(`瑙嗛鐢熸垚澶辫触: ${errorMsg}`);
                }

                if (i === 0 || ((i + 1) % 10 === 0)) {
                    console.log(`鈴?Sora2浠诲姟杩涜涓?.. (${i + 1}/${maxAttempts})`);
                }

            } catch (pollError) {
                if (pollError.message.includes('瑙嗛鐢熸垚澶辫触')) throw pollError;
                console.warn(`鈿狅笍 杞寮傚父: ${pollError.message}`);
            }
        }

        throw new Error('瑙嗛鐢熸垚瓒呮椂锛堝凡绛夊緟15鍒嗛挓锛夛紝鏈嶅姟鍣ㄥ彲鑳界箒蹇欙紝璇风◢鍚庨噸璇?);
    }

    /**
     * 馃幀 Sora2 鏂囩敓瑙嗛 API
     */
    async function callSora2TextToVideoAPI(prompt, options = {}) {
        const { model = 'sora-2-all', aspectRatio = '16:9', duration = 15, hd, key_value, video_url, character_username, character_usernames, character_url, character_timestamps, input_reference, style } = options;

        const _m = __normalizeVideoModelName(model);
        const _hd = (_m === 'sora-2-pro-all') ? ((typeof hd === 'undefined') ? true : !!hd) : !!hd;
        const _dur = __getFixedClipDurationByModel(_m, _hd);

        console.log(`馃彏锔?[瑙嗛] 璺宠繃鍓嶇棰勬墸璐癸紝鐢卞悗绔粺涓€鎵ｈ垂`);

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('璇峰厛鐧诲綍鍚庡啀浣跨敤姝ゅ姛鑳?);

        // 馃幀 Vidu 妯″瀷
        if (__isViduModel(_m)) {
            const viduParams = __parseViduModel(_m);
            console.log(`馃幀 [Vidu] 浣跨敤 yunwu API, version=${viduParams.version}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'vidu',
                    prompt,
                    model_version: viduParams.version,
                    aspect_ratio: aspectRatio,
                    duration: parseInt(_dur) || 5,
                    resolution: viduParams.resolution,
                    userId
,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Vidu澶辫触: ${res.status}`);

            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollSora2Task(data.task_id || data.id, { _source: data._source || 'yunwu', _endpoint: data._endpoint, isVidu: true });
            }
            throw new Error('鏈繑鍥炶棰慤RL鎴杢ask_id');
        }

        // 馃悮 Hailuo 妯″瀷
        if (__isHailuoModel(_m)) {
            const hailuoParams = __parseHailuoModel(_m);
            console.log(`馃悮 [Hailuo] 浣跨敤 yunwu API, version=${hailuoParams.version}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'hailuo',
                    prompt,
                    model_version: hailuoParams.version,
                    duration: hailuoParams.duration,
                    resolution: hailuoParams.resolution,
                    userId
,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Hailuo澶辫触: ${res.status}`);

            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollSora2Task(data.task_id || data.id, { _source: data._source || 'yunwu', _endpoint: data._endpoint, isVidu: true });
            }
            throw new Error('鏈繑鍥炶棰慤RL鎴杢ask_id');
        }

        // 鉁?Kling 妯″瀷
        if (__isKlingModel(_m)) {
            const klingParams = __parseKlingModel(_m);
            console.log(`鉁?[Kling] 浣跨敤 yunwu API, version=${klingParams.version}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'kling',
                    prompt,
                    model_version: klingParams.version,
                    aspect_ratio: aspectRatio,
                    duration: klingParams.duration,
                    resolution: klingParams.resolution,
                    userId
,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Kling澶辫触: ${res.status}`);

            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollSora2Task(data.task_id || data.id, { _source: data._source || 'yunwu', _endpoint: data._endpoint, isVidu: true });
            }
            throw new Error('鏈繑鍥炶棰慤RL鎴杢ask_id');
        }

        // 榛樿 Sora2
        const res = await fetch('/api/sora2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'text-to-video',
                prompt,
                model: _m,
                duration: parseInt(_dur) || 15,
                aspect_ratio: aspectRatio,
                hd: !!_hd,
                key_value,
                video_url,
                character_username,
                character_usernames,
                character_url,
                character_timestamps,
                input_reference,
                style,
                userId
,
                skip_billing: _billingSessionCount > 0 || undefined
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || `Sora2澶辫触: ${res.status}`);

        if (data.url) return data.url;
        if (!data.task_id) throw new Error('鏈繑鍥?task_id');
        return await pollSora2Task(data.task_id, { _source: data._source, _endpoint: data._endpoint });
    }

    /**
     * 馃幀 Sora2 鍥剧敓瑙嗛 API
     */
    async function callSora2ImageToVideoAPI(imageUrl, prompt, options = {}) {
        const { model = 'sora-2', aspectRatio = '16:9', duration = 15, hd, key_value, video_url, character_username, character_usernames, character_url, character_timestamps, style } = options;

        const _m = __normalizeVideoModelName(model);
        const _hd = (_m === 'sora-2-pro-all') ? ((typeof hd === 'undefined') ? true : !!hd) : !!hd;
        const _dur = __getFixedClipDurationByModel(_m, _hd);

        console.log(`馃帪锔?[鍥剧敓瑙嗛] 璺宠繃鍓嶇棰勬墸璐癸紝鐢卞悗绔粺涓€鎵ｈ垂`);

        // 寮哄埗鍙傝€冨浘绾︽潫
        const imageRefPrefix = `[CRITICAL IMAGE REFERENCE: The uploaded reference image MUST be the primary visual source. Strictly maintain ALL visual elements from the reference image: exact face features, hairstyle, hair color, clothing, accessories, body proportions, art style, color palette. The video must look like the reference image came to life with motion. Do NOT generate new characters or change the visual style. Only add natural movement and animation to the existing image content.] `;
        const enhancedPrompt = imageRefPrefix + (prompt || 'Animate this image with natural movement');

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('璇峰厛鐧诲綍鍚庡啀浣跨敤姝ゅ姛鑳?);

        // 馃寠 Wan2.6 鍥剧敓瑙嗛锛堜笓鐢?alibailian API锛?        if (__isWan26Model(_m)) {
            const wan26Params = __parseWan26Model(_m);
            console.log(`馃寠 [Wan2.6] 浣跨敤 yunwu alibailian API, resolution=${wan26Params.resolution}, duration=${wan26Params.duration}, audio=${wan26Params.audio}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'wan26',
                    prompt: prompt || 'Animate this image with natural movement',
                    img_url: imageUrl,
                    resolution: wan26Params.resolution,
                    duration: wan26Params.duration,
                    audio: wan26Params.audio,
                    userId,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Wan2.6澶辫触: ${res.status}`);

            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollWan26Task(data.task_id || data.id);
            }
            throw new Error('Wan2.6鏈繑鍥炶棰慤RL鎴杢ask_id');
        }

        // 馃幀 Vidu 鍥剧敓瑙嗛
        if (__isViduModel(_m)) {
            const viduParams = __parseViduModel(_m);
            console.log(`馃幀 [Vidu I2V] 浣跨敤 yunwu API, version=${viduParams.version}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'vidu',
                    prompt: prompt || 'Animate this image with natural movement',
                    image_url: imageUrl,
                    model_version: viduParams.version,
                    aspect_ratio: aspectRatio,
                    duration: parseInt(_dur) || 5,
                    resolution: viduParams.resolution,
                    userId,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Vidu澶辫触: ${res.status}`);
            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollSora2Task(data.task_id || data.id, { _source: data._source || 'yunwu', _endpoint: data._endpoint, isVidu: true });
            }
            throw new Error('鏈繑鍥炶棰慤RL鎴杢ask_id');
        }

        // 馃悮 Hailuo 鍥剧敓瑙嗛
        if (__isHailuoModel(_m)) {
            const hailuoParams = __parseHailuoModel(_m);
            console.log(`馃悮 [Hailuo I2V] 浣跨敤 yunwu API, version=${hailuoParams.version}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'hailuo',
                    prompt: prompt || 'Animate this image with natural movement',
                    image_url: imageUrl,
                    model_version: hailuoParams.version,
                    duration: hailuoParams.duration,
                    resolution: hailuoParams.resolution,
                    userId,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Hailuo澶辫触: ${res.status}`);
            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollSora2Task(data.task_id || data.id, { _source: data._source || 'yunwu', _endpoint: data._endpoint, isVidu: true });
            }
            throw new Error('鏈繑鍥炶棰慤RL鎴杢ask_id');
        }

        // 鉁?Kling 鍥剧敓瑙嗛
        if (__isKlingModel(_m)) {
            const klingParams = __parseKlingModel(_m);
            console.log(`鉁?[Kling I2V] 浣跨敤 yunwu API, version=${klingParams.version}`);
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'kling',
                    prompt: prompt || 'Animate this image with natural movement',
                    image_url: imageUrl,
                    model_version: klingParams.version,
                    aspect_ratio: aspectRatio,
                    duration: klingParams.duration,
                    resolution: klingParams.resolution,
                    userId,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || `Kling澶辫触: ${res.status}`);
            if (data.url || data.video_url) return data.url || data.video_url;
            if (data.task_id || data.id) {
                return await pollSora2Task(data.task_id || data.id, { _source: data._source || 'yunwu', _endpoint: data._endpoint, isVidu: true });
            }
            throw new Error('鏈繑鍥炶棰慤RL鎴杢ask_id');
        }

        // 榛樿 Sora2 鍥剧敓瑙嗛
        const res = await fetch('/api/sora2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'image-to-video',
                image_url: imageUrl,
                prompt: enhancedPrompt,
                model: _m,
                duration: parseInt(_dur) || 15,
                aspect_ratio: aspectRatio,
                hd: !!_hd,
                key_value,
                video_url,
                character_username,
                character_usernames,
                character_url,
                character_timestamps,
                style,
                userId,
                skip_billing: _billingSessionCount > 0 || undefined
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || `Sora2澶辫触: ${res.status}`);

        if (data.url) return data.url;
        if (!data.task_id) throw new Error('鏈繑鍥?task_id');
        return await pollSora2Task(data.task_id, { _source: data._source, _endpoint: data._endpoint });
    }

    /**
     * 馃幀 渚挎嵎鍑芥暟锛氭枃鐢熻棰?     */
    async function callSora2TextToVideo(prompt, model, options = {}) {
        return await callSora2TextToVideoAPI(prompt, { ...(options || {}), model: model || options.model || 'sora-2' });
    }

    /**
     * 馃幀 渚挎嵎鍑芥暟锛氬浘鐢熻棰?     */
    async function callSora2ImageToVideo(prompt, lastFrameUrl, model, options = {}) {
        return await callSora2ImageToVideoAPI(lastFrameUrl, prompt, { ...(options || {}), model: model || options.model || 'sora-2' });
    }

    // ==================== 馃摎 瑙掕壊搴?绱犳潗搴撲繚瀛樺嚱鏁?====================

    /**
     * 馃摎 淇濆瓨瑙掕壊鍒拌鑹插簱
     * @param {string} name - 瑙掕壊鍚嶇О
     * @param {string} summary - 瑙掕壊鎻忚堪
     * @param {string} posterUrl - 瑙掕壊鍥剧墖URL
     * @param {string} videoUrl - 瑙掕壊瑙嗛URL锛堝彲閫夛級
     * @param {string} turnaroundUrl - 涓夎鍥綰RL锛堝彲閫夛級
     */
    function saveCharacterToLibrary(name, summary, posterUrl, videoUrl, turnaroundUrl) {
        try {
            if (!name || typeof name !== 'string') {
                console.error('[api-core] 瑙掕壊鍚嶇О鏃犳晥');
                return false;
            }

            // 楠岃瘉鑷冲皯鏈変竴涓湁鏁堢殑鍥剧墖/瑙嗛URL
            const hasValidImage = isValidMediaUrl(posterUrl);
            const hasValidVideo = isValidMediaUrl(videoUrl);
            if (!hasValidImage && !hasValidVideo) {
                console.warn(`[api-core] 瑙掕壊銆?{name}銆嶆病鏈夋湁鏁堢殑鍥剧墖鎴栬棰慤RL, 浠嶇劧淇濆瓨浣嗗彲鑳芥樉绀轰负绌篳);
            }

            // 鈿狅笍 base64 鍥剧墖澶ぇ锛岃烦杩?localStorage 淇濆瓨
            const isBase64 = (posterUrl && posterUrl.startsWith('data:')) || (videoUrl && videoUrl.startsWith('data:'));
            if (isBase64) {
                console.warn(`[api-core] 瑙掕壊銆?{name}銆嶅浘鐗囦负 base64 鏍煎紡锛岃烦杩囨湰鍦板簱淇濆瓨锛屼粎鍦ㄨ亰澶╀腑灞曠ず`);
                return true;
            }

            // 馃摫 淇濆瓨鍒版墜鏈虹増瑙掕壊搴?(library_chars)
            try {
                let mobileLib = [];
                try {
                    mobileLib = JSON.parse(localStorage.getItem('library_chars') || '[]');
                    if (!Array.isArray(mobileLib)) mobileLib = [];
                } catch (e) { mobileLib = []; }

                const mobileExistingIdx = mobileLib.findIndex(c => c.name === name);
                const mobileChar = {
                    name: name,
                    desc: summary || '',
                    image: posterUrl || '',
                    video: videoUrl || ''
                };
                
                if (mobileExistingIdx >= 0) {
                    mobileLib[mobileExistingIdx] = mobileChar;
                } else {
                    mobileLib.push(mobileChar);
                }
                localStorage.setItem('library_chars', JSON.stringify(mobileLib));
                console.log(`鉁?[api-core] 瑙掕壊銆?{name}銆嶅凡淇濆瓨鍒版墜鏈虹増瑙掕壊搴揱);
            } catch (e) {
                console.warn('[api-core] 淇濆瓨鍒版墜鏈虹増瑙掕壊搴撳け璐?', e);
            }

            // 馃捇 淇濆瓨鍒癙C鐗堣鑹插簱 (character_library)
            try {
                let pcLib = [];
                try {
                    pcLib = JSON.parse(localStorage.getItem('character_library') || '[]');
                    if (!Array.isArray(pcLib)) pcLib = [];
                } catch (e) { pcLib = []; }

                const pcExistingIdx = pcLib.findIndex(c => c.name === name);
                const pcChar = {
                    name: name,
                    summary: summary || '',
                    imageUrl: posterUrl || '',
                    videoUrl: videoUrl || '',
                    variants: {
                        poster: posterUrl || '',
                        turnaround: turnaroundUrl || ''
                    }
                };
                
                if (pcExistingIdx >= 0) {
                    pcLib[pcExistingIdx] = pcChar;
                } else {
                    pcLib.push(pcChar);
                }
                localStorage.setItem('character_library', JSON.stringify(pcLib));
                console.log(`鉁?[api-core] 瑙掕壊銆?{name}銆嶅凡淇濆瓨鍒癙C鐗堣鑹插簱`);
            } catch (e) {
                console.warn('[api-core] 淇濆瓨鍒癙C鐗堣鑹插簱澶辫触:', e);
            }

            return true;
        } catch (err) {
            console.error('鉂?[api-core] 淇濆瓨瑙掕壊澶辫触:', err);
            return false;
        }
    }

    /**
     * 馃敡 鍘嬬缉 base64 鍥剧墖骞朵繚瀛樺埌鏈湴搴擄紙寮傛锛?     * 灏嗗ぇ灏哄 base64 鍥剧墖鍘嬬缉涓虹缉鐣ュ浘鍚庡瓨鍏?localStorage
     */
    function _compressAndSaveBase64Image(base64Url, title, category) {
        try {
            const img = new Image();
            img.onload = function () {
                try {
                    const canvas = document.createElement('canvas');
                    const MAX_W = 400;
                    const scale = Math.min(1, MAX_W / img.width);
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.65);
                    console.log(`[api-core] 鉁?base64鍘嬬缉: ${(base64Url.length / 1024).toFixed(0)}KB 鈫?${(compressed.length / 1024).toFixed(0)}KB`);

                    // 淇濆瓨鍒?library_scenes
                    try {
                        let lib = JSON.parse(localStorage.getItem('library_scenes') || '[]');
                        if (!Array.isArray(lib)) lib = [];
                        lib.unshift({
                            name: title || '鎶€鑳界敓鎴愬浘鐗?,
                            desc: category || 'skill',
                            image: compressed,
                            createdAt: Date.now()
                        });
                        if (lib.length > 80) lib = lib.slice(0, 80);
                        localStorage.setItem('library_scenes', JSON.stringify(lib));
                        console.log(`[api-core] 鉁?鍘嬬缉鍥惧凡淇濆瓨鍒扮礌鏉愬簱: ${title}`);
                    } catch (e) {
                        console.warn('[api-core] 鍘嬬缉鍥句繚瀛樺埌 library_scenes 澶辫触:', e.message);
                    }

                    // 淇濆瓨鍒?material_library
                    try {
                        let mlib = JSON.parse(localStorage.getItem('material_library') || '[]');
                        if (!Array.isArray(mlib)) mlib = [];
                        mlib.push({
                            id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            type: 'image',
                            url: compressed,
                            title: title || '鎶€鑳界敓鎴愬浘鐗?,
                            category: category || 'skill',
                            createdAt: new Date().toISOString()
                        });
                        if (mlib.length > 80) mlib = mlib.slice(-80);
                        localStorage.setItem('material_library', JSON.stringify(mlib));
                    } catch (e) { }
                } catch (e) {
                    console.warn('[api-core] base64鍘嬬缉缁樺埗澶辫触:', e.message);
                }
            };
            img.onerror = function () {
                console.warn('[api-core] base64鍥剧墖鍔犺浇澶辫触锛屾棤娉曞帇缂╀繚瀛?);
            };
            img.src = base64Url;
        } catch (e) {
            console.warn('[api-core] _compressAndSaveBase64Image 寮傚父:', e.message);
        }
    }

    /**
     * 馃柤锔?淇濆瓨鍥剧墖鍒扮礌鏉愬簱
     * @param {string} url - 鍥剧墖URL
     * @param {string} title - 鍥剧墖鏍囬
     * @param {string} category - 鍒嗙被锛堝彲閫夛級
     */
    function saveImageToLibrary(url, title, category) {
        try {
            if (!isValidMediaUrl(url)) {
                console.error('[api-core] 鍥剧墖URL鏃犳晥:', typeof url === 'string' ? url.substring(0, 80) : url);
                return false;
            }

            // 馃敡 base64 鍥剧墖锛氬帇缂╀负缂╃暐鍥惧悗寮傛淇濆瓨锛堣В鍐冲ぇ鍥炬棤娉曞瓨鍌ㄧ殑闂锛?            if (url.startsWith('data:')) {
                const sizeKB = (url.length / 1024).toFixed(0);
                console.log(`[api-core] 鍥剧墖涓?base64 鏍煎紡(${sizeKB}KB)锛屽帇缂╁悗淇濆瓨: ${title}`);
                _compressAndSaveBase64Image(url, title, category);
                return true;
            }

            // 馃摫 淇濆瓨鍒扮礌鏉愬簱椤甸潰浣跨敤鐨勬牸寮?(library_scenes)
            try {
                let lib = [];
                try {
                    lib = JSON.parse(localStorage.getItem('library_scenes') || '[]');
                    if (!Array.isArray(lib)) lib = [];
                } catch (e) { lib = []; }

                // 妫€鏌ユ槸鍚﹀凡瀛樺湪
                if (!lib.some(item => item.image === url)) {
                    lib.unshift({
                        name: title || '鎶€鑳界敓鎴愬浘鐗?,
                        desc: category || 'skill',
                        image: url,
                        createdAt: Date.now()
                    });
                    localStorage.setItem('library_scenes', JSON.stringify(lib));
                    console.log(`鉁?[api-core] 鍥剧墖宸蹭繚瀛樺埌绱犳潗搴?library_scenes): ${title || url.substring(0, 50)}`);
                }
            } catch (e) {
                console.warn('[api-core] 淇濆瓨鍒?library_scenes 澶辫触:', e);
            }

            // 涔熶繚瀛樺埌閫氱敤绱犳潗搴?(material_library) 浠ヤ究鍚庣画鎵╁睍
            try {
                let lib = [];
                try {
                    lib = JSON.parse(localStorage.getItem('material_library') || '[]');
                    if (!Array.isArray(lib)) lib = [];
                } catch (e) { lib = []; }

                if (!lib.some(item => item.url === url)) {
                    lib.push({
                        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        type: 'image',
                        url: url,
                        title: title || '鎶€鑳界敓鎴愬浘鐗?,
                        category: category || 'skill',
                        createdAt: new Date().toISOString()
                    });
                    localStorage.setItem('material_library', JSON.stringify(lib));
                }
            } catch (e) { }

            return true;
        } catch (err) {
            console.error('鉂?[api-core] 淇濆瓨鍥剧墖澶辫触:', err);
            return false;
        }
    }

    /**
     * 馃幀 淇濆瓨瑙嗛鍒扮礌鏉愬簱
     * @param {string} url - 瑙嗛URL
     * @param {string} title - 瑙嗛鏍囬
     * @param {string} category - 鍒嗙被锛堝彲閫夛級
     * @param {string} thumbnailUrl - 缂╃暐鍥綰RL锛堝彲閫夛級
     */
    function saveVideoToLibrary(url, title, category, thumbnailUrl) {
        try {
            if (!isValidMediaUrl(url)) {
                console.error('[api-core] 瑙嗛URL鏃犳晥:', typeof url === 'string' ? url.substring(0, 80) : url);
                return false;
            }

            // 馃摫 淇濆瓨鍒扮礌鏉愬簱椤甸潰浣跨敤鐨勬牸寮?(library_scenes) - 瑙嗛涔熷彲浠ユ斁鍦ㄨ繖閲?            try {
                let lib = [];
                try {
                    lib = JSON.parse(localStorage.getItem('library_scenes') || '[]');
                    if (!Array.isArray(lib)) lib = [];
                } catch (e) { lib = []; }

                // 妫€鏌ユ槸鍚﹀凡瀛樺湪
                if (!lib.some(item => item.video === url || item.image === url)) {
                    lib.unshift({
                        name: title || '鎶€鑳界敓鎴愯棰?,
                        desc: category || 'skill',
                        image: thumbnailUrl || '',  // 缂╃暐鍥?                        video: url,  // 瑙嗛URL
                        createdAt: Date.now()
                    });
                    localStorage.setItem('library_scenes', JSON.stringify(lib));
                    console.log(`鉁?[api-core] 瑙嗛宸蹭繚瀛樺埌绱犳潗搴?library_scenes): ${title || url.substring(0, 50)}`);
                }
            } catch (e) {
                console.warn('[api-core] 淇濆瓨鍒?library_scenes 澶辫触:', e);
            }

            // 涔熶繚瀛樺埌閫氱敤绱犳潗搴?(material_library)
            try {
                let lib = [];
                try {
                    lib = JSON.parse(localStorage.getItem('material_library') || '[]');
                    if (!Array.isArray(lib)) lib = [];
                } catch (e) { lib = []; }

                if (!lib.some(item => item.url === url)) {
                    lib.push({
                        id: 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        type: 'video',
                        url: url,
                        thumbnailUrl: thumbnailUrl || '',
                        title: title || '鎶€鑳界敓鎴愯棰?,
                        category: category || 'skill',
                        createdAt: new Date().toISOString()
                    });
                    localStorage.setItem('material_library', JSON.stringify(lib));
                }
            } catch (e) { }

            return true;
        } catch (err) {
            console.error('鉂?[api-core] 淇濆瓨瑙嗛澶辫触:', err);
            return false;
        }
    }

    // ==================== 馃帹 Midjourney 鍥剧墖鐢熸垚 ====================

    /**
     * 馃帹 璋冪敤 Midjourney 鍥剧墖 API锛堥€氳繃 yunwu 鍚庣锛?     * 杩斿洖鍗曞紶鍥剧墖URL锛堣嚜鍔ㄥ彇缃戞牸鍥撅紝閫傜敤浜庢妧鑳?鏅鸿兘鍥㈤槦鍦烘櫙锛?     * 馃敡 涓?AI 鐢诲浘椤甸潰涓€鑷达細绉婚櫎鍓嶇瓒呮椂锛岃璇锋眰鑷劧瀹屾垚
     * 馃敡 澧炲姞閲嶈瘯鏈哄埗锛岃В鍐?HTTP/2 杩炴帴绌洪棽鏂紑闂
     */
    async function callMidjourneyImageAPI(prompt, options = {}) {
        const model = options.model || 'midjourney-fast';
        const aspectRatio = options.aspectRatio || options.aspect_ratio || '16:9';
        const version = options.version || '6.1';
        const image_url = options.refImage || options.image_url || undefined;

        const paid = isPaidUser();
        if (!paid) throw new Error('Midjourney 涓轰粯璐瑰姛鑳斤紝璇峰厛鍏呭€艰兌鐗?);

        let userId = await getCurrentUserId();
        if (!userId) throw new Error('璇峰厛鐧诲綍鍚庡啀浣跨敤姝ゅ姛鑳?);

        // 馃敡 鍐呴儴璇锋眰鍑芥暟锛堝甫閲嶈瘯锛?        const maxRetries = 3;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let res;
            try {
                // 馃敡 绉婚櫎 signal锛岃璇锋眰鑷劧瀹屾垚锛堜笌 AI 鐢诲浘椤甸潰涓€鑷达級
                res = await fetch('/api/yunwu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'midjourney',
                        prompt,
                        model,
                        aspect_ratio: aspectRatio,
                        version,
                        image_url,
                        userId,
                        skip_billing: _billingSessionCount > 0 || undefined
                    })
                });
            } catch (fetchErr) {
                lastErr = fetchErr;
                // 馃敡 HTTP/2 杩炴帴鏂紑鎴栫綉缁滈敊璇紝閲嶈瘯
                if (attempt < maxRetries) {
                    console.warn(`[Midjourney] 缃戠粶閿欒绗?{attempt}娆★紝閲嶈瘯涓?..`, fetchErr.message);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(`Midjourney缃戠粶閿欒: ${fetchErr.message}`);
            }

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                // 馃敡 鏈嶅姟鍣ㄩ敊璇紝閲嶈瘯
                if (res.status >= 500 && attempt < maxRetries) {
                    console.warn(`[Midjourney] 鏈嶅姟鍣ㄩ敊璇?{res.status}锛岄噸璇曚腑...`);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw new Error(data.message || data.error || `Midjourney澶辫触: ${res.status}`);
            }

            const imageUrl = data.imageUrl || data.url || '';
            if (!imageUrl) throw new Error('Midjourney 鏈繑鍥炲浘鐗嘦RL');

            console.log(`馃帹 [api-core MJ] 鐢熸垚鎴愬姛: ${imageUrl.substring(0, 80)}`);
            return imageUrl;
        }
        throw lastErr || new Error('Midjourney璇锋眰澶辫触');
    }

    // ==================== 馃攳 OCR 鏂囧瓧璇嗗埆 ====================

    /**
     * 馃攳 璋冪敤 OCR 璇嗗埆鍥剧墖涓殑鏂囧瓧
     * @param {string} imageUrl - 鍥剧墖URL鎴朾ase64
     * @param {string} prompt - 鎻愮ず璇嶏紙鍙€夛紝榛樿璇嗗埆鎵€鏈夋枃瀛楋級
     * @param {string} model - 妯″瀷锛堥粯璁?deepseek-ocr锛?     * @returns {Promise<string>} 璇嗗埆鍒扮殑鏂囧瓧
     */
    async function callOCRAPI(imageUrl, prompt, model) {
        if (!imageUrl) throw new Error('缂哄皯鍥剧墖');
        const ocrPrompt = prompt || '璇疯瘑鍒苟杈撳嚭杩欏紶鍥剧墖涓殑鎵€鏈夋枃瀛楀唴瀹癸紝淇濇寔鍘熷鏍煎紡銆?;
        let userId = await getCurrentUserId();

        const res = await fetch('/api/yunwu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'vision',
                model: model || 'deepseek-ocr',
                prompt: ocrPrompt,
                image_url: imageUrl,
                userId,
                skip_billing: _billingSessionCount > 0 || undefined
            })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            throw new Error(data.message || data.error || 'OCR璇嗗埆澶辫触');
        }
        return data.text || '';
    }

    // ==================== 馃帳 TTS 閰嶉煶 ====================

    /**
     * 馃帳 璋冪敤 TTS 閰嶉煶 API
     * @param {string} text - 瑕侀厤闊崇殑鏂囨湰
     * @param {object} options - { engine: 'gemini'|'kling'|'dubbingx', voiceId, model, emotion, speed }
     * @returns {Promise<string>} 闊抽URL
     */
    async function callTTSAPI(text, options = {}) {
        if (!text) throw new Error('缂哄皯閰嶉煶鏂囨湰');
        let userId = await getCurrentUserId();
        if (!userId) throw new Error('璇峰厛鐧诲綍鍚庡啀浣跨敤姝ゅ姛鑳?);

        const engine = options.engine || 'gemini';

        // Gemini TTS锛堟渶蹇渶渚垮疁锛岀洿鎺ヨ繑鍥為煶棰戯級
        if (engine === 'gemini') {
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'gemini-tts',
                    text,
                    voiceName: options.voiceId || options.voiceName || 'Kore',
                    model: options.model || 'flash',
                    userId
,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.message || data.error || 'Gemini TTS澶辫触');
            // Gemini TTS 杩斿洖 audioData(base64)锛岄渶瑕佽浆鎹负 data URL
            if (data.audioData) {
                const mime = data.mimeType || 'audio/wav';
                return `data:${mime};base64,${data.audioData}`;
            }
            return data.audioUrl || data.audio_url || '';
        }

        // Kling TTS
        if (engine === 'kling') {
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'kling-tts',
                    text,
                    voiceId: options.voiceId || 'genshin_vindi2',
                    voiceSpeed: options.speed || 1,
                    userId
,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.message || data.error || 'Kling TTS澶辫触');
            // 濡傛灉鐩存帴杩斿洖 audioUrl
            if (data.audioUrl) return data.audioUrl;
            // 鍚﹀垯闇€瑕佽疆璇?            if (data.taskId) {
                console.log(`馃帳 [api-core] Kling TTS 寮€濮嬭疆璇?taskId=${data.taskId}`);
                let failCount = 0;
                for (let i = 0; i < 90; i++) {
                    await sleep(2000);
                    try {
                        const pr = await fetch('/api/yunwu', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'kling-tts-poll', taskId: data.taskId })
                        });
                        const pd = await pr.json().catch(() => ({}));
                        
                        // 鎴愬姛鑾峰彇闊抽URL
                        if (pd.audioUrl) {
                            console.log(`鉁?[api-core] Kling TTS 瀹屾垚: ${pd.audioUrl.substring(0, 80)}`);
                            return pd.audioUrl;
                        }
                        if (pd.status === 'completed' && pd.audioUrl) return pd.audioUrl;
                        
                        // 褰诲簳澶辫触
                        if (pd.status === 'failed') {
                            throw new Error(pd.error || 'Kling TTS鐢熸垚澶辫触');
                        }
                        
                        // 鐘舵€佸畬鎴愪絾娌℃湁URL锛屽皾璇曚粠rawData鎻愬彇
                        if (pd.status === 'completed_no_url' && pd.rawData) {
                            console.warn('[api-core] Kling TTS: 鍚庣鐘舵€佸畬鎴愪絾鏃燯RL锛屽皾璇曞墠绔彁鍙?', JSON.stringify(pd.rawData).substring(0, 300));
                            const rd = pd.rawData;
                            const extractedUrl = rd?.data?.task_result?.works?.[0]?.resource?.resource ||
                                                rd?.data?.task_result?.works?.[0]?.audio?.resource ||
                                                rd?.data?.works?.[0]?.resource?.resource ||
                                                rd?.data?.works?.[0]?.audio?.resource ||
                                                rd?.data?.audio_url || rd?.audio_url || rd?.data?.resource || rd?.resource;
                            if (extractedUrl) {
                                console.log(`鉁?[api-core] Kling TTS 鍓嶇鎻愬彇鎴愬姛: ${extractedUrl.substring(0, 80)}`);
                                return extractedUrl;
                            }
                        }
                        
                        if ((i + 1) % 10 === 0) {
                            console.log(`馃攧 [api-core] Kling TTS 杞涓?.. ${i + 1}/90 status=${pd.status || 'unknown'}`);
                        }
                    } catch (pollErr) {
                        if (pollErr.message && (pollErr.message.includes('澶辫触') || pollErr.message.includes('failed'))) throw pollErr;
                        failCount++;
                        console.warn(`[api-core] Kling TTS 杞寮傚父 #${failCount}:`, pollErr.message);
                        if (failCount >= 5) throw new Error(`Kling TTS杞杩炵画澶辫触${failCount}娆? ${pollErr.message}`);
                    }
                }
                throw new Error('Kling TTS瓒呮椂(3鍒嗛挓)');
            }
            throw new Error('Kling TTS鏈繑鍥炵粨鏋?);
        }

        // DubbingX TTS
        if (engine === 'dubbingx') {
            // DubbingX 闇€瑕?voiceId锛屽鏋滀负绌哄垯浣跨敤榛樿闊宠壊
            const dxVoiceId = options.voiceId || 'zh_female_shuangkuaisisi_moon_bigtts';
            const res = await fetch('/api/yunwu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'tts-generate',
                    text,
                    voiceId: dxVoiceId,
                    language: options.language || 'zh',
                    audioSpeed: options.speed || 1,
                    emotion: options.emotion || '',
                    userId
,
                    skip_billing: _billingSessionCount > 0 || undefined
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.message || data.error || 'DubbingX TTS澶辫触');
            if (!data.taskId) throw new Error('DubbingX TTS鏈繑鍥瀟askId');
            // 杞
            for (let i = 0; i < 60; i++) {
                await sleep(3000);
                const pr = await fetch('/api/yunwu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'tts-poll', taskId: data.taskId })
                });
                const pd = await pr.json().catch(() => ({}));
                if (pd.success && pd.fileUrl) return pd.fileUrl;
                if (pd.status === 'Failed' || pd.status === 'Error') throw new Error('DubbingX TTS鐢熸垚澶辫触');
            }
            throw new Error('DubbingX TTS瓒呮椂');
        }

        throw new Error(`涓嶆敮鎸佺殑TTS寮曟搸: ${engine}`);
    }

    // ==================== 馃幍 Suno 闊充箰鐢熸垚 ====================

    /**
     * 馃幍 璋冪敤 Suno 闊充箰鐢熸垚 API
     * @param {object} options - { prompt, title, tags, model, instrumental, description }
     * @returns {Promise<{taskId: string, music: Array}>} 浠诲姟ID鍜岄煶涔愬垪琛?     */
    async function callSunoMusicAPI(options = {}) {
        let userId = await getCurrentUserId();
        if (!userId) throw new Error('璇峰厛鐧诲綍鍚庡啀浣跨敤姝ゅ姛鑳?);

        const body = {
            action: 'generate',
            userId,
            skip_billing: _billingSessionCount > 0 || undefined,
            mv: options.model || 'chirp-v4',
            title: options.title || '',
            tags: options.tags || '',
            make_instrumental: !!options.instrumental
        };

        // 鐏垫劅妯″紡 vs 鑷畾涔夋ā寮?        if (options.description && !options.prompt) {
            body.gpt_description_prompt = options.description;
        } else {
            body.prompt = options.prompt || options.description || '';
        }

        const res = await fetch('/api/suno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.message || data.error || '闊充箰鐢熸垚澶辫触');
        if (!data.task_id) throw new Error('闊充箰鐢熸垚鏈繑鍥炰换鍔D');

        // 杞缁撴灉
        for (let i = 0; i < 120; i++) {
            await sleep(5000);
            const pr = await fetch('/api/suno', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'fetch', task_id: data.task_id })
            });
            const pd = await pr.json().catch(() => ({}));
            if (pd.is_complete && pd.music && pd.music.length > 0) {
                console.log(`馃幍 [api-core Suno] 鐢熸垚鎴愬姛: ${pd.music.length}棣朻);
                return { taskId: data.task_id, music: pd.music };
            }
            if (pd.is_failed) throw new Error(pd.fail_reason || '闊充箰鐢熸垚澶辫触');
        }
        throw new Error('闊充箰鐢熸垚瓒呮椂锛?0鍒嗛挓锛?);
    }

    /**
     * 馃幍 璋冪敤 Suno 姝岃瘝鐢熸垚 API
     */
    async function callSunoLyricsAPI(prompt) {
        let userId = await getCurrentUserId();
        if (!userId) throw new Error('璇峰厛鐧诲綍');

        const res = await fetch('/api/suno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'lyrics', prompt, userId, skip_billing: _billingSessionCount > 0 || undefined })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.message || data.error || '姝岃瘝鐢熸垚澶辫触');
        return data;
    }

    // ==================== 馃摛 瀵煎嚭鍒板叏灞€ ====================

    // 鏍稿績 API 鍑芥暟
    global.callScriptGenerator = callScriptGenerator;
    global.callModelScopeImageAPI = callModelScopeImageAPI;
    global.callModelScopeTextAPI = callModelScopeTextAPI;
    global.callModelScopeVideoAPI = callModelScopeVideoAPI;
    global.callModelScopeImageToVideoAPI = callModelScopeImageToVideoAPI;
    global.callBanana2ImageAPI = callBanana2ImageAPI;
    global.callSora2TextToVideoAPI = callSora2TextToVideoAPI;
    global.callSora2ImageToVideoAPI = callSora2ImageToVideoAPI;
    global.callSora2TextToVideo = callSora2TextToVideo;
    global.callSora2ImageToVideo = callSora2ImageToVideo;
    global.callZhenzhenTextAPI = callZhenzhenTextAPI;
    global.callWriterLLM = callWriterLLM;
    global.callOCRAPI = callOCRAPI;
    global.callMidjourneyImageAPI = global.callMidjourneyImageAPI || callMidjourneyImageAPI;

    // 馃帳 闊抽/闊充箰 API
    global.callTTSAPI = callTTSAPI;
    global.callSunoMusicAPI = callSunoMusicAPI;
    global.callSunoLyricsAPI = callSunoLyricsAPI;

    // 杈呭姪鍑芥暟
    global.getCurrentUserId = global.getCurrentUserId || getCurrentUserId;
    global.startBillingSession = startBillingSession;
    global.endBillingSession = endBillingSession;
    global.retryableAPICall = global.retryableAPICall || retryableAPICall;
    global.isPaidUser = global.isPaidUser || isPaidUser;
    global.checkFreeUserAccess = global.checkFreeUserAccess || checkFreeUserAccess;
    global.checkFreeUserTextProvider = global.checkFreeUserTextProvider || checkFreeUserTextProvider;
    global.pollSora2Task = global.pollSora2Task || pollSora2Task;
    global.sleep = global.sleep || sleep;

    // 馃摎 瑙掕壊搴?绱犳潗搴撲繚瀛樺嚱鏁?    global.saveCharacterToLibrary = global.saveCharacterToLibrary || saveCharacterToLibrary;
    global.saveImageToLibrary = global.saveImageToLibrary || saveImageToLibrary;
    global.saveVideoToLibrary = global.saveVideoToLibrary || saveVideoToLibrary;
    global.isValidMediaUrl = global.isValidMediaUrl || isValidMediaUrl;

    console.log('鉁?[api-core.js] API 鏍稿績妯″潡宸插姞杞?);

})(typeof window !== 'undefined' ? window : this);
