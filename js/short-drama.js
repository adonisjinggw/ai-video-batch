/**
 * 📺 short-drama.js — 短剧生成引擎
 * 功能：原创短剧生成、小说改编短剧、符合短剧标准规则
 */

// ==================== 短剧状态管理 ====================
const shortDramaState = {
    mode: 'original',  // 'original' | 'adapt'
    sourceNovel: null,  // 小说改编时的源小说
    theme: '',
    genre: '',
    episodes: [],  // 集数列表
    totalEpisodes: 60,
    episodeDuration: 90,  // 秒
    currentEpisode: 0,
    writing: false,
    paused: false,
    characters: [],  // 🆕 角色列表（同小说引擎）
    scenes: []       // 🆕 场景列表
};

// 短剧类型配置
const SHORT_DRAMA_GENRES = {
    'urban': { name: '都市情感', tags: ['爱情', '职场', '家庭'], rhythm: 'fast' },
    'revenge': { name: '复仇逆袭', tags: ['复仇', '逆袭', '打脸'], rhythm: 'very-fast' },
    'fantasy': { name: '玄幻修仙', tags: ['修仙', '异能', '穿越'], rhythm: 'fast' },
    'romance': { name: '甜宠言情', tags: ['霸总', '甜宠', '虐恋'], rhythm: 'medium' },
    'suspense': { name: '悬疑推理', tags: ['悬疑', '推理', '反转'], rhythm: 'fast' },
    'ceo': { name: '霸总豪门', tags: ['霸总', '豪门', '契约'], rhythm: 'fast' },
    'rebirth': { name: '重生逆袭', tags: ['重生', '逆袭', '复仇'], rhythm: 'very-fast' },
    'medical': { name: '医疗救赎', tags: ['医生', '救赎', '温情'], rhythm: 'medium' },
    'military': { name: '军旅铁血', tags: ['军人', '热血', '兄弟'], rhythm: 'fast' },
    'ancient': { name: '古装宫斗', tags: ['宫斗', '权谋', '爱恨'], rhythm: 'fast' },
    'campus': { name: '校园青春', tags: ['校园', '青春', '初恋'], rhythm: 'medium' },
    'supernatural': { name: '灵异奇幻', tags: ['灵异', '奇幻', '冒险'], rhythm: 'fast' },
    'business': { name: '商战谋略', tags: ['商战', '谋略', '权力'], rhythm: 'fast' },
    'family': { name: '家庭伦理', tags: ['家庭', '亲情', '矛盾'], rhythm: 'medium' },
    'comedy': { name: '喜剧搞笑', tags: ['喜剧', '搞笑', '轻松'], rhythm: 'fast' }
};

// 短剧标准规则
const SHORT_DRAMA_RULES = {
    episodeLength: { min: 60, max: 180, target: 90 },  // 秒
    scenesPerEpisode: { min: 2, max: 4 },
    dialoguesPerScene: { min: 3, max: 8 },
    wordsPerEpisode: { min: 200, max: 500, target: 350 },
    conflictRequired: true,  // 每集必须有冲突
    cliffhangerRequired: true  // 每集必须有悬念
};

// ==================== 原创短剧生成 ====================

/**
 * 生成短剧大纲
 */
async function generateShortDramaOutline(theme, genre, episodeCount, model = 'qwen3.5-plus', useMemory = true, style = 'normal') {
    // 处理自定义类型：如果有预设配置用预设，否则用自定义值
    const genreConfig = SHORT_DRAMA_GENRES[genre] || (genre ? { name: genre, tags: [genre], rhythm: 'fast' } : SHORT_DRAMA_GENRES['urban']);

    const styleDescriptions = {
        normal: '节奏适中，情节合理',
        intense: '节奏紧凑，冲突激烈，情绪饱满',
        sweet: '温馨甜蜜，浪漫温情，少冲突多甜宠',
        suspenseful: '悬念迭起，反转不断，气氛紧张',
        humorous: '轻松幽默，诙谐搞笑，娱乐性强',
        dramatic: '戏剧张力强，情感浓烈，高潮迭起',
        realistic: '贴近生活，真实细腻，情感共鸣',
        poetic: '文艺唯美，意境深远，诗意浪漫',
        thriller: '惊悚刺激，紧张压抑，扣人心弦',
        inspirational: '励志向上，正能量满满，温暖治愈',
        tragic: '虐心悲情，催泪虐恋，情感虐心，悲剧色彩浓厚'
    };
    const styleDesc = styleDescriptions[style] || (style ? style : styleDescriptions.normal);

    const prompt = `你是一位专业的短剧编剧。请为以下主题创作一部${episodeCount}集的短剧大纲。

**重要规则：全文必须使用中文，严禁出现任何英文单词、拼音或字母。**

主题：${theme}
类型：${genreConfig.name}
风格：${styleDesc}
集数：${episodeCount}集
每集时长：约90秒（350字左右）

短剧创作规则：
1. 节奏要快，每集必须有明确的冲突或反转
2. 开头3秒抓人，结尾必须留悬念
3. 主线清晰，支线简洁，不拖沓
4. 每10集一个小高潮，每30集一个大高潮
5. 对话简短有力，口语化，避免长篇大论
6. 场景切换快，每集2-4个场景
7. 人物性格鲜明，矛盾冲突激烈

请输出格式：
第1集：[标题] - [一句话剧情]
第2集：[标题] - [一句话剧情]
...

要求：
- 每集标题要吸引人，体现核心冲突
- 剧情要环环相扣，层层递进
- 避免重复套路，每集都有新看点
- 结局要有反转或升华
- **全文使用中文，不得出现英文单词**`;

    // 🔧 和长篇小说完全一致的超时配置：90秒超时，重试2次
    const result = await _novelLLM([
        { role: 'user', content: prompt }
    ], {
        maxTokens: 4096,
        temperature: 0.9,
        timeout: 90000,
        retries: 2,
        model: model,
        useMemory: useMemory
    });

    return result;
}

/**
 * 生成单集短剧内容
 */
async function generateShortDramaEpisode(episodeIndex, outline, previousContext = '', model = 'qwen3.5-plus', useMemory = true) {
    const ep = shortDramaState.episodes[episodeIndex];
    if (!ep) throw new Error('集数不存在');

    const genreConfig = SHORT_DRAMA_GENRES[shortDramaState.genre] || SHORT_DRAMA_GENRES['urban'];

    // 🆕 构建一致性约束
    const consistencyConstraint = _shortDramaBuildConsistencyPrompt();

    const prompt = `你是一位专业的短剧编剧。请创作第${episodeIndex + 1}集的完整剧本。

**重要规则：全文必须使用中文，严禁出现任何英文单词、拼音或字母。**

【剧本信息】
主题：${shortDramaState.theme}
类型：${genreConfig.name}
第${episodeIndex + 1}集：${ep.title}
剧情：${ep.outline}

${previousContext ? `【前情提要】\n${previousContext}\n` : ''}
${consistencyConstraint}
【短剧标准规则】
1. 时长：90秒（约350字）
2. 场景：2-4个场景，快速切换
3. 对话：每个场景3-8句对话，简短有力
4. 冲突：必须有明确的冲突或反转
5. 悬念：结尾必须留悬念，吸引观众看下一集
6. 节奏：开头3秒抓人，中间冲突激烈，结尾反转

【输出格式】
场景1：[地点-时间]
[简短场景描述]
角色A：[对话]
角色B：[对话]
[动作描述]

场景2：[地点-时间]
...

【创作要求】
- 直接输出剧本，不要写创意分析
- 对话要口语化，符合人物性格
- 每个场景要有视觉冲击力
- 冲突要激烈，情绪要饱满
- 结尾要让人想看下一集
- 严禁与前面集数重复相似的情节和对话
- **全文使用中文，不得出现英文单词**`;

    // 🔧 使用 _novelLLM（和大纲生成一致），支持超时和重试
    const result = await _novelLLM([
        { role: 'user', content: prompt }
    ], {
        maxTokens: 2048,
        temperature: 0.9,
        timeout: 90000,
        retries: 2,
        model: model,
        useMemory: useMemory
    });

    return result;
}

// ==================== 小说改编短剧 ====================

/**
 * 将小说改编为短剧大纲
 */
async function adaptNovelToShortDrama(novelContent, episodeCount, model = 'qwen3.5-plus', useMemory = true) {
    const prompt = `你是一位专业的短剧改编编剧。请将以下小说内容改编为${episodeCount}集的短剧大纲。

**重要规则：全文必须使用中文，严禁出现任何英文单词、拼音或字母。**

【原小说内容】
${novelContent.substring(0, 10000)}...

【改编要求】
1. 提炼核心冲突和主线剧情
2. 删减支线和次要角色
3. 强化戏剧冲突，加快节奏
4. 每集90秒（350字），必须有冲突和悬念
5. 保留原作精华，但要符合短剧快节奏特点

【输出格式】
第1集：[标题] - [一句话剧情]
第2集：[标题] - [一句话剧情]
...

【要求】
- 每集标题要吸引人
- 剧情要环环相扣
- 结局要有反转
- **全文使用中文，不得出现英文单词**`;

    const result = await callWriterLLM(prompt, {
        model: model,
        maxTokens: 4096,
        temperature: 0.8,
        useMemory: useMemory
    });

    return result;
}

/**
 * 解析短剧大纲
 */
function parseShortDramaOutline(outlineText) {
    console.log('[short-drama] 开始解析大纲，原文长度:', outlineText.length);
    console.log('[short-drama] 大纲前500字:', outlineText.substring(0, 500));

    const episodes = [];
    const lines = outlineText.split('\n').filter(line => line.trim());

    for (const line of lines) {
        // 匹配格式：第四集：新欢登场 - 剧情 或 第4集:标题 - 剧情
        // 支持全角冒号（：）和半角冒号（:），支持空格
        const match = line.match(/第\s*(\d+)\s*集[：:：]\s*(.+?)\s*[-—–]\s*(.+)/);
        if (match) {
            episodes.push({
                index: parseInt(match[1]) - 1,
                title: match[2].trim(),
                outline: match[3].trim(),
                content: '',
                status: 'pending',
                wordCount: 0,
                duration: 0
            });
        }
    }

    console.log('[short-drama] 解析结果: 共', episodes.length, '集');
    if (episodes.length > 0) {
        console.log('[short-drama] 第一集:', episodes[0]);
    }

    return episodes;
}

// ==================== 短剧质量评估 ====================

/**
 * 评估单集短剧质量
 */
function evaluateShortDramaEpisode(episode) {
    const content = episode.content;
    if (!content) return { score: 0, issues: ['内容为空'] };

    const issues = [];
    let score = 100;

    // 1. 字数检查
    const wordCount = content.length;
    if (wordCount < SHORT_DRAMA_RULES.wordsPerEpisode.min) {
        issues.push(`字数不足：${wordCount}字（建议${SHORT_DRAMA_RULES.wordsPerEpisode.target}字）`);
        score -= 15;
    } else if (wordCount > SHORT_DRAMA_RULES.wordsPerEpisode.max) {
        issues.push(`字数过多：${wordCount}字（建议${SHORT_DRAMA_RULES.wordsPerEpisode.target}字）`);
        score -= 10;
    }

    // 2. 场景数量检查
    const sceneCount = (content.match(/场景\d+/g) || []).length;
    if (sceneCount < SHORT_DRAMA_RULES.scenesPerEpisode.min) {
        issues.push(`场景过少：${sceneCount}个（建议${SHORT_DRAMA_RULES.scenesPerEpisode.min}-${SHORT_DRAMA_RULES.scenesPerEpisode.max}个）`);
        score -= 10;
    }

    // 3. 对话检查
    const dialogues = content.match(/[：:][「"』"](.+?)[」"』"]/g) || [];
    if (dialogues.length < 5) {
        issues.push('对话过少：短剧需要更多对话推进剧情');
        score -= 10;
    }

    // 4. 冲突检查（关键词）
    const conflictKeywords = ['冲突', '矛盾', '争吵', '对抗', '反对', '拒绝', '愤怒', '质问'];
    const hasConflict = conflictKeywords.some(kw => content.includes(kw));
    if (!hasConflict) {
        issues.push('缺少明显冲突：短剧每集必须有冲突');
        score -= 20;
    }

    // 5. 悬念检查（结尾）
    const lastPart = content.substring(content.length - 100);
    const cliffhangerKeywords = ['突然', '忽然', '没想到', '竟然', '原来', '？', '！'];
    const hasCliffhanger = cliffhangerKeywords.some(kw => lastPart.includes(kw));
    if (!hasCliffhanger) {
        issues.push('结尾缺少悬念：建议增加反转或悬念');
        score -= 15;
    }

    // 6. 节奏检查（段落长度）
    const paragraphs = content.split('\n').filter(p => p.trim());
    const longParagraphs = paragraphs.filter(p => p.length > 100);
    if (longParagraphs.length > 2) {
        issues.push('段落过长：短剧要快节奏，避免长段描述');
        score -= 10;
    }

    score = Math.max(0, Math.min(100, score));

    return {
        score: Math.round(score),
        issues,
        wordCount,
        sceneCount,
        dialogueCount: dialogues.length,
        hasConflict,
        hasCliffhanger
    };
}

// ==================== UI 交互函数 ====================

/**
 * 切换短剧模式（原创/改编）
 */
function switchShortDramaMode(mode) {
    shortDramaState.mode = mode;

    const originalPanel = document.getElementById('shortDramaOriginalPanel');
    const adaptPanel = document.getElementById('shortDramaAdaptPanel');
    const originalBtn = document.getElementById('shortDramaOriginalBtn');
    const adaptBtn = document.getElementById('shortDramaAdaptBtn');

    if (mode === 'original') {
        originalPanel.style.display = 'block';
        adaptPanel.style.display = 'none';
        originalBtn.classList.add('active');
        adaptBtn.classList.remove('active');
    } else {
        originalPanel.style.display = 'none';
        adaptPanel.style.display = 'block';
        originalBtn.classList.remove('active');
        adaptBtn.classList.add('active');
    }
}

/**
 * 开始生成短剧
 */
async function startShortDramaGeneration() {
    // 🔒 防止重复点击
    if (shortDramaState.writing) { showToast('正在生成中，请勿重复操作'); return; }
    shortDramaState.writing = true;

    try {
        if (shortDramaState.mode === 'original') {
            await generateOriginalShortDrama();
        } else {
            await adaptNovelToShortDramaFlow();
        }
    } finally {
        shortDramaState.writing = false;
    }
}

/**
 * 原创短剧生成流程
 */
async function generateOriginalShortDrama() {
    const theme = document.getElementById('shortDramaTheme').value.trim();
    let genre = document.getElementById('shortDramaGenre').value;
    let style = document.getElementById('shortDramaStyle')?.value || 'normal';

    // 处理自定义类型和风格
    if (genre === 'custom') {
        const customGenre = document.getElementById('shortDramaCustomGenre')?.value.trim();
        genre = customGenre || '';
    }
    if (style === 'custom') {
        const customStyle = document.getElementById('shortDramaCustomStyle')?.value.trim();
        style = customStyle || '';
    }

    const episodeCount = parseInt(document.getElementById('shortDramaEpisodeCount').value);
    const model = document.getElementById('shortDramaModel')?.value || 'qwen3.5-plus';
    const useMemory = document.querySelector('input[name="shortDramaMemory"]:checked')?.value === 'true';

    // 检查登录状态（异步等待登录加载）
    if (typeof currentUser !== 'undefined' && !currentUser) {
        try {
            console.log('[short-drama] currentUser 为空，尝试通过 NVAuth 获取登录状态...');
            let user = null;
            if (typeof NVAuth !== 'undefined' && typeof NVAuth.getCurrentUser === 'function') {
                user = await NVAuth.getCurrentUser();
                if (user) {
                    console.log('[short-drama] 通过 NVAuth.getCurrentUser 获取到用户:', user.email);
                }
            } else if (typeof getSupabase === 'function') {
                const client = getSupabase();
                if (client && client.auth) {
                    const { data: { session } } = await client.auth.getSession();
                    if (session && session.user) {
                        user = session.user;
                        console.log('[short-drama] 通过 getSupabase.getSession 获取到用户:', user.email);
                    }
                }
            }
            if (user) {
                window.currentUser = user;
            } else {
                showToast('请先登录后再使用短剧功能');
                return;
            }
        } catch (e) {
            console.warn('[short-drama] 获取登录状态失败:', e);
            showToast('请先登录后再使用短剧功能');
            return;
        }
    }

    console.log('🎬 [short-drama] 开始生成短剧');
    console.log('  主题:', theme);
    console.log('  类型:', genre);
    console.log('  风格:', style);
    console.log('  集数:', episodeCount);
    console.log('  模型:', model);
    console.log('  使用记忆:', useMemory);

    if (!theme) {
        showToast('请输入短剧主题');
        return;
    }

    // 验证自定义类型和风格是否已填写
    const genreSel = document.getElementById('shortDramaGenre');
    const styleSel = document.getElementById('shortDramaStyle');
    if (genreSel?.value === 'custom' && !genre) {
        showToast('请输入自定义短剧类型');
        return;
    }
    if (styleSel?.value === 'custom' && !style) {
        showToast('请输入自定义写作风格');
        return;
    }

    shortDramaState.theme = theme;
    shortDramaState.genre = genre;
    shortDramaState.style = style;
    shortDramaState.totalEpisodes = episodeCount;
    shortDramaState.model = model;
    shortDramaState.useMemory = useMemory;

    // 显示进度条
    const progress = document.getElementById('shortDramaProgress');
    const progressLabel = document.getElementById('shortDramaProgressLabel');
    const progressPercent = document.getElementById('shortDramaProgressPercent');
    const progressFill = document.getElementById('shortDramaProgressFill');

    if (progress) progress.style.display = '';
    if (progressLabel) progressLabel.textContent = '正在生成短剧大纲...';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressFill) progressFill.style.width = '0%';

    showToast('正在生成短剧大纲...');

    try {
        // 1. 生成大纲
        const outlineText = await generateShortDramaOutline(theme, genre, episodeCount, model, useMemory, style);

        // 大纲生成完成，更新进度
        if (progressLabel) progressLabel.textContent = '大纲生成完成，正在解析...';
        if (progressPercent) progressPercent.textContent = '50%';
        if (progressFill) progressFill.style.width = '50%';

        const episodes = parseShortDramaOutline(outlineText);

        if (episodes.length === 0) {
            throw new Error('大纲解析失败');
        }

        shortDramaState.episodes = episodes;
        renderShortDramaEpisodeList();
        updateShortDramaProgress();

        // 🆕 大纲生成后自动提取角色
        shortDramaExtractCharacters();

        // 完成
        if (progressLabel) progressLabel.textContent = `✅ 大纲生成完成（${episodes.length}集）`;
        if (progressPercent) progressPercent.textContent = '100%';
        if (progressFill) progressFill.style.width = '100%';

        showToast(`✅ 大纲生成完成（${episodes.length}集），请查看后决定是否生成剧本`);

        // 显示"生成剧本"按钮，让用户看完大纲再决定
        const startBtn = document.getElementById('shortDramaStartWritingBtn');
        if (startBtn) startBtn.style.display = '';
    } catch (e) {
        showToast('生成失败: ' + e.message);
        console.error('[short-drama] 生成失败:', e);
        // 隐藏进度条
        if (progress) progress.style.display = 'none';
    }
}

/**
 * 小说改编短剧流程
 */
async function adaptNovelToShortDramaFlow() {
    // 检查登录状态（异步等待登录加载）
    if (typeof currentUser !== 'undefined' && !currentUser) {
        try {
            console.log('[short-drama] adaptNovel: currentUser 为空，尝试通过 NVAuth 获取登录状态...');
            let user = null;
            if (typeof NVAuth !== 'undefined' && typeof NVAuth.getCurrentUser === 'function') {
                user = await NVAuth.getCurrentUser();
                if (user) {
                    console.log('[short-drama] adaptNovel: 通过 NVAuth.getCurrentUser 获取到用户:', user.email);
                }
            } else if (typeof getSupabase === 'function') {
                const client = getSupabase();
                if (client && client.auth) {
                    const { data: { session } } = await client.auth.getSession();
                    if (session && session.user) {
                        user = session.user;
                        console.log('[short-drama] adaptNovel: 通过 getSupabase.getSession 获取到用户:', user.email);
                    }
                }
            }
            if (user) {
                window.currentUser = user;
            } else {
                showToast('请先登录后再使用短剧功能');
                return;
            }
        } catch (e) {
            console.warn('[short-drama] adaptNovel: 获取登录状态失败:', e);
            showToast('请先登录后再使用短剧功能');
            return;
        }
    }

    const episodeCount = parseInt(document.getElementById('shortDramaAdaptEpisodeCount').value);
    const model = document.getElementById('shortDramaAdaptModel')?.value || 'qwen3.5-plus';
    const useMemory = document.querySelector('input[name="shortDramaAdaptMemory"]:checked')?.value === 'true';
    let novelContent = '';
    let novelTitle = '';

    // 优先使用导入的小说源
    if (shortDramaState.sourceNovel) {
        novelContent = shortDramaState.sourceNovel.content;
        novelTitle = shortDramaState.sourceNovel.name;
    }
    // 否则从当前小说项目获取内容
    else if (novelState && novelState.chapters && novelState.chapters.length > 0) {
        const doneChapters = novelState.chapters.filter(c => c.status === 'done');
        if (doneChapters.length === 0) {
            showToast('小说还没有完成的章节');
            return;
        }
        novelContent = doneChapters.map((ch, i) =>
            `第${i + 1}章 ${ch.title}\n${ch.content}`
        ).join('\n\n');
        novelTitle = novelState.theme || '未命名小说';
    }
    // 都没有则提示
    else {
        showToast('请先导入小说或创建小说项目');
        return;
    }

    // 显示进度条
    const progress = document.getElementById('shortDramaProgress');
    const progressLabel = document.getElementById('shortDramaProgressLabel');
    const progressPercent = document.getElementById('shortDramaProgressPercent');
    const progressFill = document.getElementById('shortDramaProgressFill');

    if (progress) progress.style.display = '';
    if (progressLabel) progressLabel.textContent = '正在改编小说为短剧...';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressFill) progressFill.style.width = '0%';

    showToast('正在改编小说为短剧...');

    try {
        // 生成改编大纲
        const outlineText = await adaptNovelToShortDrama(novelContent, episodeCount, model, useMemory);
        const episodes = parseShortDramaOutline(outlineText);

        if (episodes.length === 0) {
            throw new Error('改编大纲解析失败');
        }

        shortDramaState.mode = 'adapt';
        shortDramaState.theme = `${novelTitle}（改编）`;
        shortDramaState.genre = 'urban';
        shortDramaState.episodes = episodes;
        shortDramaState.totalEpisodes = episodes.length;
        shortDramaState.model = model;
        shortDramaState.useMemory = useMemory;

        renderShortDramaEpisodeList();
        updateShortDramaProgress();

        // 🆕 大纲生成后自动提取角色
        shortDramaExtractCharacters();

        showToast(`✅ 改编大纲完成（${episodes.length}集），请查看后决定是否生成剧本`);

        // 显示"生成剧本"按钮，让用户看完大纲再决定
        const startBtn = document.getElementById('shortDramaStartWritingBtn');
        if (startBtn) startBtn.style.display = '';
    } catch (e) {
        showToast('改编失败: ' + e.message);
        console.error('[short-drama] 改编失败:', e);
        // 隐藏进度条
        const progress = document.getElementById('shortDramaProgress');
        if (progress) progress.style.display = 'none';
    }
}

/**
 * 生成所有集数的剧本
 */
async function generateAllShortDramaEpisodes() {
    // 🔒 防止重复点击
    if (shortDramaState.writing) { showToast('正在生成剧本中，请勿重复操作'); return; }
    shortDramaState.writing = true;

    const startBtn = document.getElementById('shortDramaStartWritingBtn');
    if (startBtn) { startBtn.disabled = true; startBtn.textContent = '⏳ 剧本生成中...'; }

    try {
        for (let i = 0; i < shortDramaState.episodes.length; i++) {
            if (shortDramaState.paused) break;

            const ep = shortDramaState.episodes[i];
            if (ep.status === 'done') continue;

            ep.status = 'generating';
            renderShortDramaEpisodeList();
            updateShortDramaProgress();

            try {
                // 获取前文上下文（最近3集）
                const prevContext = shortDramaState.episodes
                    .slice(Math.max(0, i - 3), i)
                    .filter(e => e.status === 'done')
                    .map(e => `第${e.index + 1}集：${e.title}\n${e.content.substring(0, 200)}...`)
                    .join('\n\n');

                const content = await generateShortDramaEpisode(i, ep.outline, prevContext, shortDramaState.model, shortDramaState.useMemory);

                ep.content = content;
                ep.wordCount = content.length;
                ep.duration = Math.round(content.length / 4);  // 估算：4字/秒
                ep.status = 'done';

                // 自动评估
                const evaluation = evaluateShortDramaEpisode(ep);
                ep._evaluation = evaluation;

                if (evaluation.score < 60) {
                    showToast(`⚠️ 第${i + 1}集评分较低(${evaluation.score}分)`, 3000);
                }

                renderShortDramaEpisodeList();
                updateShortDramaProgress();

                // 🆕 每5集更新一次角色和场景提取
                if ((i + 1) % 5 === 0) {
                    shortDramaExtractCharacters();
                    shortDramaExtractScenes();
                }

            } catch (e) {
                ep.status = 'error';
                console.error(`[short-drama] 第${i + 1}集生成失败:`, e);
                showToast(`第${i + 1}集生成失败: ${e.message}`);
            }
        }

        if (shortDramaState.episodes.every(e => e.status === 'done')) {
            showToast('🎉 短剧全部完成！');
            // 🆕 最终提取角色和场景
            shortDramaExtractCharacters();
            shortDramaExtractScenes();
            // 自动显示评估
            setTimeout(() => evaluateAllShortDramaEpisodes(), 1000);
        }
    } finally {
        shortDramaState.writing = false;
        if (startBtn) { startBtn.disabled = false; startBtn.textContent = '🎬 生成剧本'; }
    }
}

/**
 * 评估所有集数
 */
function evaluateAllShortDramaEpisodes() {
    const doneEpisodes = shortDramaState.episodes.filter(e => e.status === 'done');
    if (doneEpisodes.length === 0) {
        showToast('没有已完成的集数');
        return;
    }

    let totalScore = 0;
    const episodeScores = [];

    for (const ep of doneEpisodes) {
        const result = evaluateShortDramaEpisode(ep);
        episodeScores.push({
            index: ep.index,
            title: ep.title,
            ...result
        });
        totalScore += result.score;
    }

    const overallScore = Math.round(totalScore / doneEpisodes.length);

    showShortDramaEvaluationResult({
        overallScore,
        episodeScores,
        totalEpisodes: shortDramaState.totalEpisodes,
        completedEpisodes: doneEpisodes.length
    });
}

/**
 * 显示短剧评估结果
 */
function showShortDramaEvaluationResult(result) {
    const { overallScore, episodeScores } = result;

    let html = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="this.remove()">
            <div style="background:#1a1a2e;border-radius:16px;max-width:600px;max-height:80vh;overflow-y:auto;padding:24px;color:#fff;" onclick="event.stopPropagation()">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h3 style="margin:0;font-size:20px;">📺 短剧质量评估</h3>
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="background:none;border:none;color:#888;font-size:24px;cursor:pointer;">&times;</button>
                </div>

                <div style="text-align:center;margin-bottom:24px;">
                    <div style="font-size:48px;font-weight:bold;color:${overallScore >= 80 ? '#22c55e' : overallScore >= 60 ? '#fbbf24' : '#ef4444'};">
                        ${overallScore}
                    </div>
                    <div style="color:#94a3b8;margin-top:8px;">综合评分</div>
                    <div style="color:#94a3b8;font-size:14px;margin-top:4px;">
                        ${result.completedEpisodes}/${result.totalEpisodes} 集已完成
                    </div>
                </div>

                <div style="margin-bottom:16px;">
                    <div style="font-weight:bold;margin-bottom:12px;">📺 集数评分详情</div>
                    <div style="max-height:300px;overflow-y:auto;">
                        ${episodeScores.map(ep => `
                            <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;margin-bottom:8px;">
                                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                    <div style="font-weight:bold;">第${ep.index + 1}集 ${ep.title}</div>
                                    <div style="font-size:18px;font-weight:bold;color:${ep.score >= 80 ? '#22c55e' : ep.score >= 60 ? '#fbbf24' : '#ef4444'};">
                                        ${ep.score}分
                                    </div>
                                </div>
                                <div style="font-size:13px;color:#94a3b8;margin-bottom:4px;">
                                    ${ep.wordCount}字 | ${ep.sceneCount}场景 | ${ep.dialogueCount}句对话
                                </div>
                                ${ep.issues.length > 0 ? `
                                    <div style="font-size:13px;color:#fbbf24;">
                                        ${ep.issues.map(issue => `• ${issue}`).join('<br>')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <button onclick="exportShortDramaScript()" style="width:100%;background:#3b82f6;color:#fff;border:none;border-radius:8px;padding:12px;cursor:pointer;font-size:14px;margin-top:12px;">
                    📄 导出完整剧本
                </button>
                <button onclick="exportShortDramaJSON()" style="width:100%;background:#10b981;color:#fff;border:none;border-radius:8px;padding:12px;cursor:pointer;font-size:14px;margin-top:8px;">
                    💾 导出JSON（手机可读）
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * 渲染集数列表
 */
function renderShortDramaEpisodeList() {
    const list = document.getElementById('shortDramaEpisodeList');
    if (!list) return;

    list.innerHTML = shortDramaState.episodes.map((ep, i) => {
        const statusIcon = ep.status === 'done' ? '✅' : ep.status === 'generating' ? '⏳' : ep.status === 'error' ? '❌' : '⭕';
        const scoreText = ep._evaluation ? `${ep._evaluation.score}分` : '';
        const outlineText = ep.outline ? `<div style="font-size:12px;color:var(--text-dim);margin-top:4px;line-height:1.5;">${ep.outline}</div>` : '';

        return `
            <div class="novel-chapter-item ${ep.status}" onclick="viewShortDramaEpisode(${i})">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <span style="margin-right:8px;">${statusIcon}</span>
                        <span style="font-weight:bold;">第${i + 1}集</span>
                        <span style="margin-left:8px;color:#94a3b8;">${ep.title}</span>
                    </div>
                    ${scoreText ? `<div style="color:#fbbf24;font-size:14px;">${scoreText}</div>` : ''}
                </div>
                ${outlineText}
            </div>
        `;
    }).join('');
}

/**
 * 查看单集内容
 */
function viewShortDramaEpisode(index) {
    const ep = shortDramaState.episodes[index];
    if (!ep || !ep.content) {
        showToast('该集还未生成');
        return;
    }

    const contentEl = document.getElementById('shortDramaContent');
    if (contentEl) {
        contentEl.textContent = `第${index + 1}集 ${ep.title}\n\n${ep.content}`;
        contentEl.style.display = 'block';
    }
}

/**
 * 更新短剧进度
 */
function updateShortDramaProgress() {
    const done = shortDramaState.episodes.filter(e => e.status === 'done').length;
    const total = shortDramaState.episodes.length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;

    const progressLabel = document.getElementById('shortDramaProgressLabel');
    const progressPercent = document.getElementById('shortDramaProgressPercent');
    const progressFill = document.getElementById('shortDramaProgressFill');
    const doneCount = document.getElementById('shortDramaDoneCount');
    const totalEpisodes = document.getElementById('shortDramaTotalEpisodes');
    const totalDuration = document.getElementById('shortDramaTotalDuration');

    if (progressLabel) {
        progressLabel.textContent = shortDramaState.writing ?
            `正在生成第 ${done + 1} 集...` :
            (done >= total ? '全部完成！' : `已完成 ${done}/${total} 集`);
    }
    if (progressPercent) progressPercent.textContent = pct + '%';
    if (progressFill) progressFill.style.width = pct + '%';
    if (doneCount) doneCount.textContent = done;
    if (totalEpisodes) totalEpisodes.textContent = total;
    if (totalDuration) {
        const minutes = Math.round(shortDramaState.episodes
            .filter(e => e.status === 'done')
            .reduce((sum, e) => sum + (e.duration || 0), 0) / 60);
        totalDuration.textContent = minutes;
    }

    // 显示/隐藏相关元素
    const progress = document.getElementById('shortDramaProgress');
    const stats = document.getElementById('shortDramaStats');
    const actions = document.getElementById('shortDramaActions');

    if (progress && total > 0) progress.style.display = '';
    if (stats && done > 0) stats.style.display = '';
    if (actions && done > 0) actions.style.display = '';
}

/**
 * 暂停/继续短剧生成
 */
function shortDramaPauseResume() {
    shortDramaState.paused = !shortDramaState.paused;
    const btn = event.target;
    if (btn) {
        btn.textContent = shortDramaState.paused ? '▶️ 继续' : '⏸️ 暂停';
    }
    showToast(shortDramaState.paused ? '已暂停' : '继续生成');
}

/**
 * 导出短剧剧本
 */
function exportShortDramaScript() {
    const doneEpisodes = shortDramaState.episodes.filter(e => e.status === 'done');
    if (doneEpisodes.length === 0) {
        showToast('没有已完成的集数');
        return;
    }

    let script = `# ${shortDramaState.theme}\n\n`;
    script += `类型：${SHORT_DRAMA_GENRES[shortDramaState.genre]?.name || '短剧'}\n`;
    script += `总集数：${shortDramaState.totalEpisodes}集\n`;
    script += `已完成：${doneEpisodes.length}集\n\n`;
    script += `---\n\n`;

    for (const ep of doneEpisodes) {
        script += `## 第${ep.index + 1}集 ${ep.title}\n\n`;
        script += `${ep.content}\n\n`;
        if (ep._evaluation) {
            script += `> 评分：${ep._evaluation.score}分 | ${ep.wordCount}字 | ${ep._evaluation.sceneCount}场景\n\n`;
        }
        script += `---\n\n`;
    }

    const blob = new Blob([script], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shortDramaState.theme}_短剧剧本.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('剧本已导出');
}

// ==================== 小说导入功能 ====================

/**
 * 触发文件上传
 */
function importNovelFromFile() {
    const fileInput = document.getElementById('shortDramaNovelFileInput');
    if (fileInput) {
        fileInput.click();
    }
}

/**
 * 处理文件上传
 */
async function handleNovelFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 检查文件类型
    const validTypes = ['.txt', '.md'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(fileExt)) {
        showToast('仅支持 .txt 和 .md 格式的文件');
        return;
    }

    // 检查文件大小（限制10MB）
    if (file.size > 10 * 1024 * 1024) {
        showToast('文件过大，请选择小于10MB的文件');
        return;
    }

    try {
        showToast('正在读取文件...');
        const text = await file.text();

        // 清理文本
        const cleanedText = text.trim();
        const wordCount = cleanedText.length;

        if (wordCount < 1000) {
            showToast('文件内容过短，至少需要1000字');
            return;
        }

        // 保存到状态
        shortDramaState.sourceNovel = {
            name: file.name,
            content: cleanedText,
            wordCount: wordCount
        };

        // 更新UI
        updateSourceInfo();
        showToast(`✅ 已导入: ${file.name} (${wordCount}字)`);
    } catch (error) {
        console.error('文件读取失败:', error);
        showToast('文件读取失败，请重试');
    }

    // 清空input，允许重复选择同一文件
    event.target.value = '';
}

/**
 * 从历史记录导入小说
 */
async function importNovelFromHistory() {
    try {
        // 从 IndexedDB 获取所有小说项目
        const db = await openNovelDB();
        const tx = db.transaction('novels', 'readonly');
        const store = tx.objectStore('novels');
        const novels = await store.getAll();

        if (!novels || novels.length === 0) {
            showToast('暂无已生成的小说');
            return;
        }

        // 创建选择对话框
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';

        const content = document.createElement('div');
        content.style.cssText = 'background:#1a1a1a;border-radius:12px;padding:24px;max-width:600px;width:100%;max-height:80vh;overflow-y:auto;';

        let html = '<div style="font-size:18px;font-weight:bold;margin-bottom:16px;color:#fff;">📖 选择要导入的小说</div>';
        html += '<div style="display:flex;flex-direction:column;gap:12px;">';

        for (const novel of novels) {
            const chapters = novel.chapters || [];
            const totalWords = chapters.reduce((sum, ch) => sum + (ch.content?.length || 0), 0);
            const doneCount = chapters.filter(ch => ch.status === 'done').length;

            html += `
                <div onclick="selectNovelFromHistory('${novel.id}')" style="padding:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                    <div style="font-size:16px;font-weight:600;color:#fff;margin-bottom:8px;">${novel.title || '未命名小说'}</div>
                    <div style="font-size:13px;color:#888;">
                        📊 ${doneCount}/${chapters.length}章 · ${totalWords}字 · ${novel.genre || '未分类'}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        html += '<button onclick="this.closest(\'.novel-import-modal\').remove()" style="margin-top:16px;width:100%;padding:12px;background:#444;color:#fff;border:none;border-radius:8px;cursor:pointer;">取消</button>';

        content.innerHTML = html;
        modal.appendChild(content);
        modal.className = 'novel-import-modal';
        document.body.appendChild(modal);

    } catch (error) {
        console.error('获取小说列表失败:', error);
        showToast('获取小说列表失败');
    }
}

/**
 * 选择历史小说
 */
async function selectNovelFromHistory(novelId) {
    try {
        const db = await openNovelDB();
        const tx = db.transaction('novels', 'readonly');
        const store = tx.objectStore('novels');
        const novel = await store.get(novelId);

        if (!novel) {
            showToast('小说不存在');
            return;
        }

        // 合并所有章节内容
        const chapters = novel.chapters || [];
        const doneChapters = chapters.filter(ch => ch.status === 'done');

        if (doneChapters.length === 0) {
            showToast('该小说没有已完成的章节');
            return;
        }

        let content = `# ${novel.title}\n\n`;
        for (const chapter of doneChapters) {
            content += `## ${chapter.title}\n\n${chapter.content}\n\n`;
        }

        const wordCount = content.length;

        // 保存到状态
        shortDramaState.sourceNovel = {
            name: novel.title || '未命名小说',
            content: content,
            wordCount: wordCount
        };

        // 更新UI
        updateSourceInfo();

        // 关闭对话框
        const modal = document.querySelector('.novel-import-modal');
        if (modal) modal.remove();

        showToast(`✅ 已导入: ${novel.title} (${wordCount}字)`);
    } catch (error) {
        console.error('导入小说失败:', error);
        showToast('导入失败，请重试');
    }
}

/**
 * 更新源信息显示
 */
function updateSourceInfo() {
    const infoDiv = document.getElementById('shortDramaSourceInfo');
    const nameSpan = document.getElementById('shortDramaSourceName');
    const wordsSpan = document.getElementById('shortDramaSourceWords');

    if (shortDramaState.sourceNovel) {
        if (infoDiv) infoDiv.style.display = 'block';
        if (nameSpan) nameSpan.textContent = shortDramaState.sourceNovel.name;
        if (wordsSpan) wordsSpan.textContent = shortDramaState.sourceNovel.wordCount;
    } else {
        if (infoDiv) infoDiv.style.display = 'none';
    }
}

/**
 * 打开 IndexedDB
 */
function openNovelDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('NovelWriterDB', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ==================== 🆕 角色提取（适配短剧大纲格式） ====================

/**
 * 从短剧大纲中提取角色
 * 短剧大纲格式: "第1集：标题 - 剧情" 中剧情描述可能包含角色名
 * 同时也会尝试从已生成的剧本内容中提取角色
 */
function shortDramaExtractCharacters() {
    const chars = [];
    const addedNames = new Set();
    const outline = shortDramaState.episodes.map(ep => ep.outline || '').join('\n');

    function _addChar(name, desc, source) {
        name = name.replace(/[""「」『』【】\[\]]/g, '').trim();
        if (name.length < 2 || name.length > 10) return false;
        if (addedNames.has(name)) return false;

        // 黑名单（通用代词和模糊称呼）
        const stopWords = new Set(['他们','她们','我们','自己','大家','所有','这个','那个','一个','什么','对方','众人','旁边','周围','有人','别人','某人','此人','其他','各位','那人','这人','老者','少年','少女','女子','男子','老人','孩子','小孩','老头','妇人','小姐','公子','先生','夫人','陛下','殿下']);
        if (stopWords.has(name)) return false;

        // 过滤含虚词的短名字
        if (/[的了是在有不人我他她它这那里也就都要会可以上下来去到过说着被让给把还没很太更最又再才刚]/.test(name) && name.length <= 3) return false;

        addedNames.add(name);
        chars.push({ name, desc: (desc || '').substring(0, 80).trim() || '主要角色', _source: source });
        return true;
    }

    // 第1层：从已生成剧本中提取角色名（以"角色名："或"角色名说"格式出现）
    const allContent = shortDramaState.episodes
        .filter(e => e.status === 'done' && e.content)
        .map(e => e.content)
        .join('\n');

    if (allContent) {
        // 匹配 "角色名：对话" 格式（剧本中最常见的角色标识）
        const dialoguePattern = /^([\u4e00-\u9fa5]{2,6})[：:]/gm;
        let dm;
        while ((dm = dialoguePattern.exec(allContent)) !== null) {
            _addChar(dm[1], '剧中角色', 'script_dialogue');
        }
    }

    // 第2层：从大纲剧情描述中提取高频出现的名字
    if (chars.length < 3 && outline) {
        // 统计2-4字中文词组出现频率
        const wordFreq = {};
        const namePattern = /([\u4e00-\u9fa5]{2,4})(?:的|和|与|被|把|对|向|在|给|让|从|到|跟)/g;
        let nm;
        while ((nm = namePattern.exec(outline)) !== null) {
            const w = nm[1];
            if (!addedNames.has(w) && w.length >= 2) {
                wordFreq[w] = (wordFreq[w] || 0) + 1;
            }
        }
        // 取出现>=2次的名字
        for (const [name, freq] of Object.entries(wordFreq)) {
            if (freq >= 2) {
                _addChar(name, '大纲角色', 'outline_freq');
            }
        }
    }

    // 保留已有角色的 imageUrl
    if (shortDramaState.characters && shortDramaState.characters.length > 0) {
        var oldCharsMap = {};
        shortDramaState.characters.forEach(function (oc) { if (oc.imageUrl) oldCharsMap[oc.name] = oc; });
        chars.forEach(function (nc) {
            var old = oldCharsMap[nc.name];
            if (old) {
                nc.imageUrl = old.imageUrl;
                if (old._generating) nc._generating = old._generating;
                if (old.desc && old.desc.length > nc.desc.length) nc.desc = old.desc;
            }
        });
    }

    shortDramaState.characters = chars;
    _shortDramaRenderCharCards();
    console.log('[short-drama] 角色提取完成:', chars.length, '个角色', chars.map(c => c.name).join(', '));
    return chars;
}

// ==================== 🆕 场景提取 ====================

/**
 * 从已生成的剧本中提取场景
 */
function shortDramaExtractScenes() {
    const scenes = [];
    const addedNames = new Set();

    const allContent = shortDramaState.episodes
        .filter(e => e.status === 'done' && e.content)
        .map(e => e.content)
        .join('\n');

    if (!allContent) {
        shortDramaState.scenes = scenes;
        _shortDramaRenderSceneCards();
        return scenes;
    }

    // 匹配 "场景N：地点-时间" 或 "场景N: 地点 时间"
    const scenePattern = /场景\d+[：:]\s*(.+?)(?:\n|$)/g;
    let sm;
    while ((sm = scenePattern.exec(allContent)) !== null) {
        let sceneName = sm[1].replace(/[-—]\s*.+$/, '').trim(); // 只取地点部分
        sceneName = sceneName.replace(/\s*-\s*.+$/, '').trim(); // 处理 "地点 - 时间"
        if (sceneName.length >= 2 && sceneName.length <= 20 && !addedNames.has(sceneName)) {
            addedNames.add(sceneName);
            scenes.push({ name: sceneName, desc: sm[1].trim() });
        }
    }

    shortDramaState.scenes = scenes;
    _shortDramaRenderSceneCards();
    console.log('[short-drama] 场景提取完成:', scenes.length, '个场景');
    return scenes;
}

// ==================== 🆕 一致性约束注入 ====================

/**
 * 将角色设定和场景约束注入到集数生成提示词中
 * 在 generateShortDramaEpisode 调用时使用
 */
function _shortDramaBuildConsistencyPrompt() {
    let constraint = '';

    // 角色一致性约束
    if (shortDramaState.characters && shortDramaState.characters.length > 0) {
        constraint += '\n【🎭 角色一致性约束】\n';
        constraint += '以下角色必须保持外貌、性格、说话方式前后一致：\n';
        shortDramaState.characters.forEach(ch => {
            constraint += `- ${ch.name}：${ch.desc || '主要角色'}\n`;
        });
        constraint += '⚠️ 严禁角色名字拼写不一致、性格突变、外貌描述矛盾。\n';
    }

    // 场景一致性约束
    if (shortDramaState.scenes && shortDramaState.scenes.length > 0) {
        constraint += '\n【📍 场景一致性约束】\n';
        constraint += '以下场景的描述必须保持一致：\n';
        shortDramaState.scenes.forEach(sc => {
            constraint += `- ${sc.name}：${sc.desc || ''}\n`;
        });
        constraint += '⚠️ 同一场景的环境、光线、氛围描述必须前后一致。\n';
    }

    return constraint;
}

// ==================== 🆕 角色卡片渲染 ====================

function _shortDramaRenderCharCards() {
    const container = document.getElementById('shortDramaCharCards');
    if (!container) return;

    const chars = shortDramaState.characters || [];
    if (chars.length === 0) {
        container.parentElement.style.display = 'none';
        return;
    }

    container.parentElement.style.display = '';
    container.innerHTML = chars.map(function (char, idx) {
        var imgHtml = char.imageUrl
            ? '<div style="margin-bottom:10px;"><img src="' + char.imageUrl + '" style="width:100%;border-radius:8px;cursor:pointer;" onclick="window.open(\'' + char.imageUrl + '\')"></div>'
            : '';
        var btnText = char._generating ? '⏳ 生成中...' : '🎨 生成角色图';
        var btnDisabled = char._generating ? ' opacity:0.6;cursor:not-allowed;' : '';
        return '<div class="novel-char-card">'
            + '<div class="char-name">🎭 ' + char.name + '</div>'
            + '<div class="char-desc">' + char.desc + '</div>'
            + imgHtml
            + '<button class="char-gen-btn' + (char._generating ? ' loading' : '') + '" onclick="shortDramaGenerateCharImage(' + idx + ')" style="' + btnDisabled + '">' + btnText + '</button>'
            + '</div>';
    }).join('');
}

// ==================== 🆕 场景卡片渲染 ====================

function _shortDramaRenderSceneCards() {
    const container = document.getElementById('shortDramaSceneCards');
    if (!container) return;

    const scenes = shortDramaState.scenes || [];
    if (scenes.length === 0) {
        container.parentElement.style.display = 'none';
        return;
    }

    container.parentElement.style.display = '';
    container.innerHTML = scenes.map(function (sc, idx) {
        return '<div class="novel-char-card">'
            + '<div class="char-name">📍 ' + sc.name + '</div>'
            + '<div class="char-desc">' + (sc.desc || '场景') + '</div>'
            + '</div>';
    }).join('');
}

// ==================== 🆕 角色图片生成 ====================

async function shortDramaGenerateCharImage(charIdx) {
    var chars = shortDramaState.characters || [];
    var ch = chars[charIdx];
    if (!ch || ch._generating) return;

    if (typeof callBanana2ImageAPI !== 'function') {
        showToast('图片生成API未加载，请刷新页面');
        return;
    }

    ch._generating = true;
    _shortDramaRenderCharCards();

    var genre = SHORT_DRAMA_GENRES[shortDramaState.genre] || SHORT_DRAMA_GENRES['urban'];
    var theme = shortDramaState.theme || '';

    try {
        var imageUrl = await callBanana2ImageAPI(
            '专业角色设计图(character design sheet)，全部文字必须使用中文标注。\n'
            + '大标题：「人物介绍」，风格：' + genre.name + '短剧。\n'
            + '角色名称：' + ch.name + '\n'
            + '角色描述：' + (ch.desc || '主要角色') + '\n'
            + '故事背景：' + theme.substring(0, 50) + '\n'
            + '请生成一张精美的角色设计图，包含全身像和面部特写，风格统一，适合短剧角色参考。',
            {
                model: 'gemini-3.1-flash-image-preview-4k',
                aspectRatio: '3:4'
            }
        );
        ch.imageUrl = imageUrl;
        ch._generating = false;
        _shortDramaRenderCharCards();
        showToast('✅ ' + ch.name + ' 角色设计图已生成');
    } catch (e) {
        ch._generating = false;
        _shortDramaRenderCharCards();
        let msg = e.message || '';
        if (msg.includes('abort') || msg.includes('Abort')) {
            msg = '图片生成超时，请稍后重试（4K图片生成较慢）';
        }
        showToast('角色图生成失败: ' + msg);
    }
}

// ==================== 🆕 JSON 导出（手机可读） ====================

/**
 * 导出短剧数据为 JSON 文件
 * 包含：主题、类型、角色、场景、集数列表、每集内容
 */
function exportShortDramaJSON() {
    const doneEpisodes = shortDramaState.episodes.filter(e => e.status === 'done');
    if (doneEpisodes.length === 0) {
        showToast('没有已完成的集数');
        return;
    }

    const exportData = {
        title: shortDramaState.theme || '未命名短剧',
        genre: SHORT_DRAMA_GENRES[shortDramaState.genre]?.name || shortDramaState.genre || '短剧',
        genreKey: shortDramaState.genre,
        style: shortDramaState.style || 'normal',
        totalEpisodes: shortDramaState.totalEpisodes,
        completedEpisodes: doneEpisodes.length,
        exportTime: new Date().toISOString(),
        characters: (shortDramaState.characters || []).map(c => ({
            name: c.name,
            desc: c.desc,
            imageUrl: c.imageUrl || null
        })),
        scenes: (shortDramaState.scenes || []).map(s => ({
            name: s.name,
            desc: s.desc
        })),
        episodes: doneEpisodes.map(ep => ({
            episode: ep.index + 1,
            title: ep.title,
            outline: ep.outline,
            content: ep.content,
            wordCount: ep.wordCount,
            duration: ep.duration,
            evaluation: ep._evaluation ? {
                score: ep._evaluation.score,
                issues: ep._evaluation.issues
            } : null
        }))
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shortDramaState.theme || '短剧'}_数据.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('JSON 文件已导出，可在手机上查看');
}

// ==================== 🆕 一致性校验（短剧版） ====================

/**
 * 校验短剧各集之间的一致性
 */
async function shortDramaCheckConsistency() {
    // 🔒 防止重复点击
    if (shortDramaState._checking) { showToast('正在校验中，请稍候'); return; }
    shortDramaState._checking = true;

    var doneEpisodes = shortDramaState.episodes.filter(e => e.status === 'done');
    if (doneEpisodes.length < 3) {
        showToast('至少需要3集已完成内容才能校验');
        return;
    }

    // 显示加载提示
    var resultDiv = document.getElementById('shortDramaConsistencyResult');
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div style="text-align:center;padding:20px;color:#60a5fa;">🔄 正在分析短剧一致性...</div>';
    }

    // 取每集前200字和末200字
    var brief = doneEpisodes.map(function (ep) {
        var s = ep.content || '';
        var head = s.substring(0, 200);
        var tail = s.length > 400 ? s.slice(-200) : '';
        return '第' + (ep.index + 1) + '集「' + ep.title + '」:\n开头：' + head + '\n结尾：' + tail;
    }).join('\n---\n');

    // 角色信息
    var charInfo = '';
    if (shortDramaState.characters && shortDramaState.characters.length > 0) {
        charInfo = '\n\n【已识别角色】\n' + shortDramaState.characters.map(c => c.name + '：' + c.desc).join('\n');
    }

    var sysPrompt = '你是专业短剧编剧和编辑。请检查以下短剧各集内容的一致性问题，包括：角色名字拼写不一致、时间线矛盾、地点描述前后矛盾、人物性格突变、服装/外观描述矛盾、称呼混乱等。\n\n'
        + '必须严格用以下JSON数组格式回复（不要任何其他内容）：\n'
        + '[{"episode":集数,"type":"问题类型","desc":"问题描述","fix":"修复建议"}]\n'
        + '如果没发现问题，返回空数组 []。\n'
        + '集号为整数（从1开始），type只能是以下之一：name_inconsistent|timeline_conflict|location_conflict|personality_shift|appearance_conflict|other';

    try {
        var model = shortDramaState.model || 'qwen3.5-plus';
        var result = await _novelLLM([
            { role: 'system', content: sysPrompt },
            { role: 'user', content: '/no_think\n请检查以下短剧内容的一致性：\n\n' + brief + charInfo }
        ], { maxTokens: 4096, temperature: 0.2, model: model, useMemory: false });

        // 解析JSON
        var issues = [];
        try {
            var jsonStr = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            var startBracket = jsonStr.indexOf('[');
            var endBracket = jsonStr.lastIndexOf(']');
            if (startBracket >= 0 && endBracket > startBracket) {
                jsonStr = jsonStr.substring(startBracket, endBracket + 1);
            }
            issues = JSON.parse(jsonStr);
        } catch (parseErr) {
            if (resultDiv) {
                resultDiv.innerHTML = '<div style="padding:16px;color:#94a3b8;">' + result.replace(/\n/g, '<br>') + '</div>';
            }
            return;
        }

        // 显示结果
        _shortDramaRenderConsistencyResult(issues, resultDiv);
    } catch (e) {
        if (resultDiv) {
            resultDiv.innerHTML = '<div style="padding:16px;color:#ef4444;">校验失败: ' + e.message + '</div>';
        }
    } finally {
        shortDramaState._checking = false;
    }
}

function _shortDramaRenderConsistencyResult(issues, container) {
    if (!container) container = document.getElementById('shortDramaConsistencyResult');
    if (!container) return;
    container.style.display = 'block';

    if (!issues || issues.length === 0) {
        container.innerHTML = '<div style="padding:16px;text-align:center;color:#22c55e;">✅ 未发现一致性问题，短剧剧情连贯性良好！</div>';
        return;
    }

    var typeLabel = {
        name_inconsistent: '👤 名字不一致',
        timeline_conflict: '⏰ 时间线矛盾',
        location_conflict: '📍 地点矛盾',
        personality_shift: '🎭 性格突变',
        appearance_conflict: '👗 外观矛盾',
        other: '⚠️ 其他'
    };

    var html = '<div style="padding:16px;">';
    html += '<div style="font-size:16px;font-weight:bold;margin-bottom:12px;color:#fbbf24;">🔍 发现 ' + issues.length + ' 个一致性问题</div>';

    issues.forEach(function (issue) {
        var label = typeLabel[issue.type] || typeLabel.other;
        html += '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;margin-bottom:8px;">'
            + '<div style="display:flex;justify-content:space-between;margin-bottom:8px;">'
            + '<span style="color:#fbbf24;">' + label + '</span>'
            + '<span style="color:#888;">第' + issue.episode + '集</span>'
            + '</div>'
            + '<div style="font-size:14px;color:#e2e8f0;margin-bottom:6px;">' + (issue.desc || '') + '</div>'
            + '<div style="font-size:13px;color:#60a5fa;">💡 ' + (issue.fix || '建议人工检查') + '</div>'
            + '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
}
