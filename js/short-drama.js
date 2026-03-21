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
    paused: false
};

// 短剧类型配置
const SHORT_DRAMA_GENRES = {
    'urban': { name: '都市情感', tags: ['爱情', '职场', '家庭'], rhythm: 'fast' },
    'revenge': { name: '复仇逆袭', tags: ['复仇', '逆袭', '打脸'], rhythm: 'very-fast' },
    'fantasy': { name: '玄幻修仙', tags: ['修仙', '异能', '穿越'], rhythm: 'fast' },
    'romance': { name: '甜宠言情', tags: ['霸总', '甜宠', '虐恋'], rhythm: 'medium' },
    'suspense': { name: '悬疑推理', tags: ['悬疑', '推理', '反转'], rhythm: 'fast' }
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
    const genreConfig = SHORT_DRAMA_GENRES[genre] || SHORT_DRAMA_GENRES['urban'];

    const styleDescriptions = {
        normal: '节奏适中，情节合理',
        intense: '节奏紧凑，冲突激烈，情绪饱满',
        sweet: '温馨甜蜜，浪漫温情，少冲突多甜宠',
        suspenseful: '悬念迭起，反转不断，气氛紧张',
        humorous: '轻松幽默，诙谐搞笑，娱乐性强'
    };
    const styleDesc = styleDescriptions[style] || styleDescriptions.normal;

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

    const result = await _novelLLM([
        { role: 'user', content: prompt }
    ], {
        maxTokens: 4096,
        temperature: 0.9,
        timeout: 70000,  // 🔧 70秒，确保重试后也不超过Cloudflare 100秒限制
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

    const prompt = `你是一位专业的短剧编剧。请创作第${episodeIndex + 1}集的完整剧本。

**重要规则：全文必须使用中文，严禁出现任何英文单词、拼音或字母。**

【剧本信息】
主题：${shortDramaState.theme}
类型：${genreConfig.name}
第${episodeIndex + 1}集：${ep.title}
剧情：${ep.outline}

${previousContext ? `【前情提要】\n${previousContext}\n` : ''}

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

    const result = await callWriterLLM(prompt, {
        model: model,
        maxTokens: 2048,
        temperature: 0.9,
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
        // 匹配格式：第 X 集：标题 - 剧情（支持空格）
        const match = line.match(/第\s*(\d+)\s*集[：:\s]*(.+?)\s*[-—–]\s*(.+)/);
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

    if (mode === 'original') {
        originalPanel.style.display = 'block';
        adaptPanel.style.display = 'none';
    } else {
        originalPanel.style.display = 'none';
        adaptPanel.style.display = 'block';
    }
}

/**
 * 开始生成短剧
 */
async function startShortDramaGeneration() {
    if (shortDramaState.mode === 'original') {
        await generateOriginalShortDrama();
    } else {
        await adaptNovelToShortDramaFlow();
    }
}

/**
 * 原创短剧生成流程
 */
async function generateOriginalShortDrama() {
    const theme = document.getElementById('shortDramaTheme').value.trim();
    const genre = document.getElementById('shortDramaGenre').value;
    const style = document.getElementById('shortDramaStyle')?.value || 'normal';
    const episodeCount = parseInt(document.getElementById('shortDramaEpisodeCount').value);
    const model = document.getElementById('shortDramaModel')?.value || 'qwen3.5-plus';
    const useMemory = document.querySelector('input[name="shortDramaMemory"]:checked')?.value === 'true';

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

        // 完成
        if (progressLabel) progressLabel.textContent = `✅ 大纲生成完成（${episodes.length}集）`;
        if (progressPercent) progressPercent.textContent = '100%';
        if (progressFill) progressFill.style.width = '100%';

        showToast(`✅ 大纲生成完成（${episodes.length}集）`);

        // 2. 开始生成剧本
        if (confirm('大纲已生成，是否开始生成剧本？')) {
            await generateAllShortDramaEpisodes();
        }
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

        showToast(`✅ 改编大纲完成（${episodes.length}集）`);

        // 开始生成剧本
        if (confirm('改编大纲已生成，是否开始生成剧本？')) {
            await generateAllShortDramaEpisodes();
        }
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
    shortDramaState.writing = true;

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

        } catch (e) {
            ep.status = 'error';
            console.error(`[short-drama] 第${i + 1}集生成失败:`, e);
            showToast(`第${i + 1}集生成失败: ${e.message}`);
        }
    }

    shortDramaState.writing = false;

    if (shortDramaState.episodes.every(e => e.status === 'done')) {
        showToast('🎉 短剧全部完成！');
        // 自动显示评估
        setTimeout(() => evaluateAllShortDramaEpisodes(), 1000);
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

        return `
            <div class="episode-item ${ep.status}" onclick="viewShortDramaEpisode(${i})">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <span style="margin-right:8px;">${statusIcon}</span>
                        <span style="font-weight:bold;">第${i + 1}集</span>
                        <span style="margin-left:8px;color:#94a3b8;">${ep.title}</span>
                    </div>
                    ${scoreText ? `<div style="color:#fbbf24;font-size:14px;">${scoreText}</div>` : ''}
                </div>
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
