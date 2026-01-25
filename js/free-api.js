/**
 * 免费API模块 - 无需配置，开箱即用
 * 适合宝妈、退休大爷等普通用户
 * @version 1.0.0
 */

// ==================== Pollinations.ai 免费API ====================
// 官网: https://pollinations.ai
// 特点: 完全免费，无需API Key，无限制

const FREE_API = {
    // 文本生成API
    TEXT_API: 'https://text.pollinations.ai/',
    // 图片生成API  
    IMAGE_API: 'https://image.pollinations.ai/prompt/',
    
    // 默认模型
    TEXT_MODEL: 'openai',  // 可选: openai, mistral, llama
    IMAGE_MODEL: 'flux',   // 可选: flux, turbo
};

/**
 * 🆓 免费文本生成 - Pollinations.ai
 * @param {string} prompt - 提示词
 * @param {string} systemPrompt - 系统提示（可选）
 * @returns {Promise<string>} 生成的文本
 */
async function callFreeTextAPI(prompt, systemPrompt = '') {
    console.log('🆓 [免费模式] 调用 Pollinations 文本API...');
    
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    
    // Pollinations 文本API - 直接GET请求
    const url = `${FREE_API.TEXT_API}${encodeURIComponent(fullPrompt)}?model=${FREE_API.TEXT_MODEL}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'text/plain'
            }
        });
        
        if (!response.ok) {
            throw new Error(`免费API请求失败: ${response.status}`);
        }
        
        const text = await response.text();
        console.log('✅ [免费模式] 文本生成成功');
        return text;
    } catch (error) {
        console.error('❌ [免费模式] 文本生成失败:', error);
        throw new Error('免费文本生成失败，请稍后重试');
    }
}

/**
 * 🆓 免费图片生成 - Pollinations.ai
 * @param {string} prompt - 提示词（英文效果更好）
 * @param {Object} options - 选项
 * @returns {Promise<string>} 图片URL
 */
async function callFreeImageAPI(prompt, options = {}) {
    console.log('🆓 [免费模式] 调用 Pollinations 图片API...');
    
    const {
        width = 1024,
        height = 1024,
        seed = Math.floor(Math.random() * 1000000),
        model = FREE_API.IMAGE_MODEL,
        nologo = true,
        enhance = true
    } = options;
    
    // 如果是中文，先翻译成英文（简单处理）
    let englishPrompt = prompt;
    if (/[\u4e00-\u9fa5]/.test(prompt)) {
        // 包含中文，尝试用简单方式翻译
        englishPrompt = await translateToEnglish(prompt);
    }
    
    // 构建图片URL
    const params = new URLSearchParams({
        width: width.toString(),
        height: height.toString(),
        seed: seed.toString(),
        model: model,
        nologo: nologo.toString(),
        enhance: enhance.toString()
    });
    
    const imageUrl = `${FREE_API.IMAGE_API}${encodeURIComponent(englishPrompt)}?${params}`;
    
    console.log('🖼️ [免费模式] 图片URL:', imageUrl);
    
    // 验证图片是否可访问
    try {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        if (response.ok) {
            console.log('✅ [免费模式] 图片生成成功');
            return imageUrl;
        }
    } catch (e) {
        // HEAD请求可能被阻止，直接返回URL
    }
    
    return imageUrl;
}

/**
 * 简单的中英翻译（用于图片提示词）
 * @param {string} chineseText - 中文文本
 * @returns {Promise<string>} 英文文本
 */
async function translateToEnglish(chineseText) {
    try {
        // 使用Pollinations翻译
        const translatePrompt = `Translate the following Chinese text to English. Only output the translation, nothing else:\n\n${chineseText}`;
        const url = `${FREE_API.TEXT_API}${encodeURIComponent(translatePrompt)}?model=openai`;
        
        const response = await fetch(url);
        if (response.ok) {
            const translated = await response.text();
            console.log('🌐 [翻译] 中文 → 英文:', translated.substring(0, 100));
            return translated.trim();
        }
    } catch (e) {
        console.warn('翻译失败，使用原文');
    }
    return chineseText;
}

/**
 * 🆓 免费生成故事
 * @param {string} idea - 用户创意
 * @returns {Promise<string>} 生成的故事
 */
async function freeGenerateStory(idea) {
    const systemPrompt = `你是一位专业的短视频剧本编剧。请根据用户的创意，创作一个适合短视频的故事。

要求：
1. 故事要有吸引力，适合1-3分钟的短视频
2. 包含清晰的开头、发展、高潮、结尾
3. 人物形象鲜明，情感真实
4. 语言生动，画面感强
5. 直接输出故事内容，不要加标题或解释

用户创意：${idea}`;

    return await callFreeTextAPI(systemPrompt);
}

/**
 * 🆓 免费提取角色
 * @param {string} story - 故事内容
 * @returns {Promise<Array>} 角色列表
 */
async function freeExtractCharacters(story) {
    const prompt = `分析以下故事，提取所有角色信息。

故事内容：
${story}

请按以下JSON格式输出（只输出JSON，不要其他内容）：
[
  {
    "name": "角色名称",
    "description": "角色的外貌、性格、年龄等详细描述（用于生成图片）"
  }
]`;

    const result = await callFreeTextAPI(prompt);
    
    try {
        // 尝试解析JSON
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        console.warn('角色解析失败，返回默认');
    }
    
    return [{ name: '主角', description: '故事的主要人物' }];
}

/**
 * 🆓 免费生成角色图片
 * @param {string} name - 角色名
 * @param {string} description - 角色描述
 * @returns {Promise<string>} 图片URL
 */
async function freeGenerateCharacterImage(name, description) {
    const prompt = `Character design, ${name}, ${description}, full body portrait, detailed face, high quality, professional illustration, white background, anime style`;
    
    return await callFreeImageAPI(prompt, {
        width: 768,
        height: 1024,
        model: 'flux'
    });
}

/**
 * 🆓 免费生成分镜
 * @param {string} story - 故事内容
 * @param {number} count - 分镜数量
 * @returns {Promise<Array>} 分镜列表
 */
async function freeGenerateStoryboards(story, count = 6) {
    const prompt = `将以下故事分解为${count}个分镜画面。

故事内容：
${story}

请按以下格式输出每个分镜（只输出分镜内容，不要其他解释）：

【分镜1】
画面描述：（详细描述这个镜头的画面内容）
台词/旁白：（如果有的话）

【分镜2】
...

以此类推，共${count}个分镜。`;

    const result = await callFreeTextAPI(prompt);
    
    // 解析分镜
    const storyboards = [];
    const matches = result.match(/【分镜\d+】[\s\S]*?(?=【分镜|$)/g);
    
    if (matches) {
        matches.forEach((match, index) => {
            const sceneMatch = match.match(/画面描述[：:]([\s\S]*?)(?=台词|旁白|$)/);
            const dialogMatch = match.match(/(?:台词|旁白)[：:]([\s\S]*?)$/);
            
            storyboards.push({
                index: index + 1,
                scene: sceneMatch ? sceneMatch[1].trim() : match.replace(/【分镜\d+】/, '').trim(),
                dialog: dialogMatch ? dialogMatch[1].trim() : ''
            });
        });
    }
    
    return storyboards.length > 0 ? storyboards : [{ index: 1, scene: story, dialog: '' }];
}

/**
 * 🆓 免费生成分镜图片
 * @param {string} sceneDescription - 场景描述
 * @param {number} index - 分镜序号
 * @returns {Promise<string>} 图片URL
 */
async function freeGenerateStoryboardImage(sceneDescription, index = 1) {
    const prompt = `Cinematic scene, ${sceneDescription}, movie still, professional cinematography, dramatic lighting, 16:9 aspect ratio, high quality`;
    
    return await callFreeImageAPI(prompt, {
        width: 1280,
        height: 720,
        model: 'flux',
        seed: index * 12345  // 使用固定种子保证可重现
    });
}

/**
 * 🆓 免费优化视频提示词
 * @param {string} sceneDescription - 场景描述
 * @returns {Promise<string>} 优化后的提示词
 */
async function freeOptimizeVideoPrompt(sceneDescription) {
    const prompt = `将以下场景描述优化为适合AI视频生成的英文提示词。

场景描述：${sceneDescription}

要求：
1. 使用英文
2. 包含镜头运动描述（如：camera slowly pans, tracking shot）
3. 包含光影效果（如：golden hour lighting, dramatic shadows）
4. 包含画面风格（如：cinematic, film grain, 4K）
5. 简洁有力，不超过100词

直接输出优化后的英文提示词：`;

    return await callFreeTextAPI(prompt);
}

/**
 * 🆓 获取免费视频生成平台链接
 * @returns {Array} 免费平台列表
 */
function getFreeVideoPlatforms() {
    return [
        {
            name: 'Pika Labs',
            url: 'https://pika.art',
            description: '每日免费额度，效果好',
            tutorial: '1. 注册账号\n2. 粘贴提示词\n3. 点击生成'
        },
        {
            name: 'Runway Gen-2',
            url: 'https://runwayml.com',
            description: '新用户免费试用',
            tutorial: '1. 注册账号\n2. 选择Text to Video\n3. 粘贴提示词'
        },
        {
            name: 'Kaiber',
            url: 'https://kaiber.ai',
            description: '免费试用，风格独特',
            tutorial: '1. 注册账号\n2. 上传图片或输入提示词\n3. 选择风格生成'
        },
        {
            name: 'Luma Dream Machine',
            url: 'https://lumalabs.ai/dream-machine',
            description: '每月免费额度',
            tutorial: '1. 注册账号\n2. 输入提示词\n3. 等待生成'
        }
    ];
}

/**
 * 检查是否启用免费模式
 * @returns {boolean}
 */
function isFreeMode() {
    return localStorage.getItem('nv_free_mode') === 'true';
}

/**
 * 设置免费模式
 * @param {boolean} enabled
 */
function setFreeMode(enabled) {
    localStorage.setItem('nv_free_mode', enabled ? 'true' : 'false');
    console.log(enabled ? '🆓 已启用免费模式' : '💎 已切换到专业模式');
}

// ==================== 导出 ====================

window.FreeAPI = {
    // 核心API
    callFreeTextAPI,
    callFreeImageAPI,
    
    // 业务功能
    freeGenerateStory,
    freeExtractCharacters,
    freeGenerateCharacterImage,
    freeGenerateStoryboards,
    freeGenerateStoryboardImage,
    freeOptimizeVideoPrompt,
    
    // 工具
    translateToEnglish,
    getFreeVideoPlatforms,
    isFreeMode,
    setFreeMode
};

console.log('🆓 免费API模块已加载 - Powered by Pollinations.ai');

