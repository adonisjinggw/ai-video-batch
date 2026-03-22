/**
 * 📖 novel-engine.js — 长篇小说增强引擎
 * 功能：断点恢复UI、胶片预检、单章重试/重写/微调、大纲重解析、
 *       全局摘要(每10章)、上下文滑窗、多项目管理、Supabase云保存、
 *       角色卡片提取、剧情一致性校验、统计面板、导出增强、阅读模式
 *
 * 依赖：writing.html 中的基础小说逻辑（novelState, _novelLLM 等）
 */

// ==================== 0. IndexedDB 持久化（支持大容量小说存储） ====================
const _novelDB = {
    _db: null,
    async open() {
        if (this._db) return this._db;
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('novel_store', 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore('state');
            req.onsuccess = e => { this._db = e.target.result; resolve(this._db); };
            req.onerror = e => reject(e.target.error);
        });
    },
    async save(key, data) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('state', 'readwrite');
            tx.objectStore('state').put(data, key);
            tx.oncomplete = resolve;
            tx.onerror = e => reject(e.target.error);
        });
    },
    async load(key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('state', 'readonly');
            const req = tx.objectStore('state').get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = e => reject(e.target.error);
        });
    }
};

// ==================== 1. 断点恢复 UI ====================
async function novelShowRestoreBanner() {
    try {
        // 优先检查 IndexedDB（大容量存储）
        let s = await _novelDB.load('novel_state').catch(() => null);
        if (!s) {
            const raw = localStorage.getItem('novel_state');
            if (raw) s = JSON.parse(raw);
        }
        if (!s || !s.chapters || s.chapters.length === 0) return;
        const done = s.chapters.filter(c => c.status === 'done').length;
        if (done === 0) return;

        const banner = document.getElementById('novelRestoreBanner');
        if (!banner) return;
        banner.style.display = 'flex';
        banner.querySelector('.restore-info').innerHTML =
            `📖 发现未完成的小说项目<small>${done}/${s.chapters.length}章已完成，共${(s.totalWords || 0).toLocaleString()}字</small>`;
    } catch (e) { console.warn('[novel] 恢复检查失败:', e); }
}

async function novelRestoreState() {
    try {
        // 优先从 IndexedDB 恢复完整数据
        let saved = await _novelDB.load('novel_state').catch(() => null);
        if (!saved) {
            const raw = localStorage.getItem('novel_state');
            if (raw) saved = JSON.parse(raw);
        }
        if (!saved) { showToast('未找到可恢复的数据'); return; }
        if (saved._idb) {
            showToast('⚠️ localStorage中仅有元数据，完整内容需从IndexedDB恢复');
            return;
        }
        Object.assign(novelState, saved);
        novelState.writing = false;
        novelState.paused = false;

        // 恢复 UI
        document.getElementById('novelThemeInput').value = saved.theme || '';
        if (saved.genre) document.getElementById('novelGenreSelect').value = saved.genre;
        if (saved.outline) {
            document.getElementById('novelOutlineBox').textContent = saved.outline;
            document.getElementById('novelOutlineSection').style.display = '';
        }
        document.getElementById('novelProgress').style.display = '';
        document.getElementById('novelStats').style.display = '';
        _novelRenderChapterList();
        _novelUpdateProgress();
        novelExtractCharacters();
        novelUpdateStatsDashboard();
        document.getElementById('novelRestoreBanner').style.display = 'none';
        document.getElementById('novelStartBtn').textContent = '🚀 继续写作';
        showToast(`✅ 小说项目已恢复（${novelState.chapters.filter(c => c.status === 'done').length}章）`);
    } catch (e) { showToast('恢复失败: ' + e.message); }
}

function novelDismissRestore() {
    document.getElementById('novelRestoreBanner').style.display = 'none';
}

// ==================== 2. 上下文滑窗 + 全局摘要 ====================
// 每10章自动生成前文摘要，作为后续章节的全局上下文
async function novelGenerateSummary(upToIdx) {
    const chapters = novelState.chapters.slice(0, upToIdx + 1).filter(c => c.status === 'done');
    if (chapters.length === 0) return '';

    // 拼接每章前200字
    const brief = chapters.map((c, i) => `第${i + 1}章「${c.title}」: ${(c.content || '').substring(0, 200)}...`).join('\n');

    try {
        if (typeof _novelLLM !== 'function') {
            throw new Error('_novelLLM函数未定义');
        }
        const summary = await _novelLLM([
            { role: 'system', content: '你是一位小说编辑助手。请用300字以内总结以下小说前文的关键剧情、人物关系变化和重要伏笔。' },
            { role: 'user', content: `/no_think\n请总结以下内容：\n${brief}` }
        ], { maxTokens: 1024, temperature: 0.3 });
        novelState.summaries = novelState.summaries || {};
        novelState.summaries[upToIdx] = summary;
        return summary;
    } catch (e) {
        console.warn('[novel] 摘要生成失败:', e.message);
        return '';
    }
}

function novelGetBestSummary(idx) {
    if (!novelState.summaries) return '';
    const keys = Object.keys(novelState.summaries).map(Number).filter(k => k < idx).sort((a, b) => b - a);
    return keys.length > 0 ? novelState.summaries[keys[0]] : '';
}

// 增强版上下文组装（替代原始的简单拼接）
function novelBuildContext(idx) {
    let context = '';
    const outlineText = novelState.outline || '';
    const worldEnd = outlineText.indexOf('【章节大纲】');
    const worldPart = outlineText.substring(0, worldEnd > 0 ? worldEnd : Math.min(500, outlineText.length));
    context += '[世界观与角色]\n' + worldPart + '\n';

    // 全局摘要（如果有）
    const summary = novelGetBestSummary(idx);
    if (summary) {
        context += '\n[前文摘要]\n' + summary + '\n';
    }

    // 角色设定注入
    if (novelState.characters && novelState.characters.length > 0) {
        context += '\n[角色设定]\n' + novelState.characters.map(c => `${c.name}：${c.desc}`).join('\n') + '\n';
    }

    // 已完成章节标题列表（帮助模型定位故事进度）
    const doneChapters = novelState.chapters.slice(0, idx).filter(c => c.status === 'done');
    if (doneChapters.length > 0) {
        const titles = doneChapters.map((c, i) => `第${i + 1}章「${c.title}」`);
        // 超过10章只显示最近10章标题
        const shown = titles.length > 10 ? ['...（前' + (titles.length - 10) + '章已省略）', ...titles.slice(-10)] : titles;
        context += '\n[已完成章节]\n' + shown.join('\n') + '\n';
    }

    // 前一章完整末尾（串行模式下前章已生成，提供充足上下文）
    if (idx > 0) {
        const prev = novelState.chapters[idx - 1];
        if (prev && prev.content) {
            const tail = prev.content.length > 2500 ? '...' + prev.content.slice(-2500) : prev.content;
            context += `\n[第${idx}章「${prev.title}」末尾（请紧密承接）]\n${tail}\n`;
        }
    }

    // 前后章节大纲（帮助模型了解故事走向，避免偏题）
    const outlineWindow = [];
    for (let i = Math.max(0, idx - 1); i <= Math.min(novelState.chapters.length - 1, idx + 2); i++) {
        const c = novelState.chapters[i];
        if (c) {
            const marker = i === idx ? '→ 当前' : (i < idx ? '已写' : '待写');
            outlineWindow.push(`[${marker}] 第${i + 1}章「${c.title}」：${c.outline || '无大纲'}`);
        }
    }
    if (outlineWindow.length > 0) {
        context += '\n[章节大纲走向]\n' + outlineWindow.join('\n') + '\n';
    }

    return context;
}

// ==================== 3. 胶片预检 ====================
function novelCheckCostPreview() {
    const chapterCount = parseInt(document.getElementById('novelChapterCount').value);
    const totalCost = NOVEL_OUTLINE_COST + chapterCount * NOVEL_CHAPTER_COST;
    const el = document.getElementById('novelCostPreview');
    if (!el) return;

    el.classList.add('show');
    const enough = userQuota >= totalCost;
    el.innerHTML = `💰 预估总消耗: <b>${totalCost}</b> 胶片（大纲${NOVEL_OUTLINE_COST} + ${chapterCount}章×${NOVEL_CHAPTER_COST}）| 当前余额: <b class="${enough ? 'cost-ok' : 'cost-warn'}">${userQuota}</b> 胶片${enough ? '' : ' ⚠️ 余额不足，建议先充值'}`;
}

// ==================== 4. 单章重试/重写/微调 ====================
async function novelRetryChapter(idx) {
    const ch = novelState.chapters[idx];
    if (!ch) return;
    ch.status = 'pending';
    ch.content = '';
    ch.wordCount = 0;
    _novelRenderChapterList();
    await _novelGenerateChapterEnhanced(idx);
    novelViewChapter(idx);
}

async function novelRewriteChapter(idx) {
    if (!confirm(`确定重写第${idx + 1}章？当前内容会被覆盖。`)) return;
    const ch = novelState.chapters[idx];
    novelState.totalWords -= (ch.wordCount || 0);
    ch.status = 'pending';
    ch.content = '';
    ch.wordCount = 0;
    _novelRenderChapterList();
    await _novelGenerateChapterEnhanced(idx);
    novelViewChapter(idx);
}

function novelShowTweakModal(idx) {
    novelState._tweakIdx = idx;
    const modal = document.getElementById('novelTweakModal');
    const ch = novelState.chapters[idx];
    modal.querySelector('.tweak-title').textContent = `微调第${idx + 1}章「${ch.title}」`;
    modal.querySelector('textarea').value = '';
    modal.querySelector('textarea').placeholder = '输入修改指令，例如：加强主角的内心描写、增加一段打斗场景、让对话更幽默...';
    modal.classList.add('active');
}

function novelCloseTweakModal() {
    document.getElementById('novelTweakModal').classList.remove('active');
}

async function novelConfirmTweak() {
    const idx = novelState._tweakIdx;
    const instruction = document.getElementById('novelTweakModal').querySelector('textarea').value.trim();
    if (!instruction) { showToast('请输入修改指令'); return; }
    novelCloseTweakModal();

    const ch = novelState.chapters[idx];
    ch.status = 'generating';
    _novelRenderChapterList();

    const genre = document.getElementById('novelGenreSelect').value;
    try {
        if (typeof _novelLLM !== 'function') {
            throw new Error('_novelLLM函数未定义');
        }
        const result = await _novelLLM([
            { role: 'system', content: `你是${genre}小说作家。根据用户的修改指令，重写以下章节内容。直接输出修改后的完整章节正文。全文使用中文，严禁混入英文单词。` },
            { role: 'user', content: `/no_think\n原文：\n${ch.content}\n\n修改指令：${instruction}\n\n请输出修改后的完整正文：` }
        ], { maxTokens: 16384, temperature: 0.8 });

        novelState.totalWords -= (ch.wordCount || 0);
        ch.content = result;
        ch.wordCount = result.length;
        ch.status = 'done';
        novelState.totalWords += ch.wordCount;
        novelState.totalCost += NOVEL_CHAPTER_COST;
        _novelSaveState();
        showToast(`第${idx + 1}章微调完成`);
    } catch (e) {
        ch.status = 'error';
        showToast('微调失败: ' + e.message);
    }
    _novelRenderChapterList();
    _novelUpdateProgress();
    novelViewChapter(idx);
}

// ==================== 4.5 去AI化润色 ====================
async function novelDeAIChapter(idx) {
    const ch = novelState.chapters[idx];
    if (!ch || ch.status !== 'done') { showToast('该章节尚未完成'); return; }
    if (!ch.content || ch.content.length < 100) { showToast('章节内容太短'); return; }

    // 胶片检查
    if (typeof userQuota !== 'undefined' && userQuota < NOVEL_CHAPTER_COST) {
        showToast('胶片不足，去AI化需要 ' + NOVEL_CHAPTER_COST + ' 胶片');
        return;
    }

    ch.status = 'generating';
    _novelRenderChapterList();
    showToast('第' + (idx + 1) + '章去AI化处理中...');

    const genre = document.getElementById('novelGenreSelect').value;
    const chTitle = ch.title || ('第' + (idx + 1) + '章');
    // 获取前一章末尾摘要，帮助LLM理解上下文连续性
    var prevSummary = '';
    if (idx > 0 && novelState.chapters[idx - 1] && novelState.chapters[idx - 1].content) {
        prevSummary = '\n\n【前一章末尾片段】\n' + novelState.chapters[idx - 1].content.slice(-300);
    }
    // 随机选择润色风格侧重点，避免多章结果趋同
    var styleHints = [
        '本章请侧重让对话更生动口语化，角色说话要有各自的语气特点和口头禅',
        '本章请侧重让叙述节奏更紧凑，删减冗余描写，让情节推进更快',
        '本章请侧重让场景描写更有画面感，用短句和具体细节替代笼统形容',
        '本章请侧重让角色情感更真实细腻，减少直白的心理描写，多用动作和微表情暗示',
        '本章请侧重让段落结构更错落有致，打破AI式工整排列，模仿网文作者随性的行文风格',
        '本章请侧重让战斗/冲突场景更有力量感，用短促有力的句子增强节奏感',
        '本章请侧重让过渡更自然流畅，删除生硬的时间/场景切换，让读者感觉不到断裂'
    ];
    var styleHint = styleHints[(idx * 7 + ch.content.length) % styleHints.length];
    try {
        if (typeof _novelLLM !== 'function') {
            throw new Error('_novelLLM函数未定义');
        }
        const result = await _novelLLM([
            {
                role: 'system', content: `你是一位资深${genre}小说编辑。现在请对「${chTitle}」进行去AI化润色，使其读起来像真人写的网文。全文使用中文，严禁混入英文单词。

核心规则：
1. 改写"仿佛""宛如""犹如"等过度比喻，用更直接的描写替代
2. 消除排比句和华丽辞藻堆砌，改为朴素简练的表达
3. 对话口语化，加入角色个性化的语气词和口头禅
4. 删除空洞的心理感悟和哲理总结，改为具体行动和反应
5. 减少"不禁""竟然""微微""缓缓""淡淡"等AI高频词
6. 保持原文情节、人物、设定完全不变，只改写表达方式

${styleHint}。

直接输出润色后的完整正文，不要加任何说明。` },
            { role: 'user', content: `/no_think\n${prevSummary}\n\n以下是「${chTitle}」需要去AI化的内容：\n\n${ch.content}\n\n请对以上内容进行去AI化润色，保持情节不变。直接输出完整正文：` }
        ], { maxTokens: 16384, temperature: 0.92 });

        novelState.totalWords -= (ch.wordCount || 0);
        ch.content = result;
        ch.wordCount = result.length;
        ch.status = 'done';
        novelState.totalWords += ch.wordCount;
        novelState.totalCost += NOVEL_CHAPTER_COST;
        _novelSaveState();
        showToast('第' + (idx + 1) + '章去AI化完成 ✅');
    } catch (e) {
        ch.status = 'done'; // 失败时恢复原状态，不丢失内容
        showToast('去AI化失败: ' + e.message);
    }
    _novelRenderChapterList();
    _novelUpdateProgress();
    novelViewChapter(idx);
}

// 批量去AI化（所有已完成章节）
async function novelDeAIAll() {
    const done = novelState.chapters.filter(c => c.status === 'done');
    if (done.length === 0) { showToast('没有已完成章节'); return; }

    // 🔒 防止重复点击
    if (novelState._deAIing) { showToast('正在批量去AI化中，请勿重复操作'); return; }
    novelState._deAIing = true;

    const totalCost = done.length * NOVEL_CHAPTER_COST;
    if (!confirm('将对全部 ' + done.length + ' 章进行去AI化润色，预计消耗 ' + totalCost + ' 胶片。是否继续？')) {
        novelState._deAIing = false;
        return;
    }

    showToast('开始批量去AI化...');
    var successCount = 0;
    try {
        for (var i = 0; i < novelState.chapters.length; i++) {
            if (novelState.chapters[i].status !== 'done') continue;
            try {
                await novelDeAIChapter(i);
                successCount++;
                document.getElementById('novelProgressLabel').textContent = '去AI化 ' + successCount + '/' + done.length + ' 章...';
            } catch (e) {
                console.warn('[novel] deAI chapter ' + i + ' failed:', e);
            }
        }
        showToast('批量去AI化完成：' + successCount + '/' + done.length + ' 章 ✅');
    } finally {
        novelState._deAIing = false;
    }
}

// ==================== 5. 大纲变动重解析 ====================
function novelReparseOutline() {
    const outlineEl = document.getElementById('novelOutlineBox');
    const newOutline = outlineEl.textContent || outlineEl.innerText || '';
    if (newOutline === novelState.outline) return false;

    novelState.outline = newOutline;
    const chapterCount = parseInt(document.getElementById('novelChapterCount').value);
    const chapterLines = newOutline.match(/第\d+章\s+[^\n：:]+/g) || [];

    for (let i = 0; i < chapterCount; i++) {
        const line = chapterLines[i] || '';
        const titleMatch = line.match(/第\d+章\s+(.+)/);
        const rawTitle = titleMatch ? titleMatch[1] : `第${i + 1}章`;
        const parts = rawTitle.split(/[：:]/);
        if (novelState.chapters[i]) {
            // 保留已生成的内容，只更新标题和大纲
            novelState.chapters[i].title = parts[0].trim();
            novelState.chapters[i].outline = parts.slice(1).join('：').trim() || novelState.chapters[i].outline;
        } else {
            novelState.chapters.push({
                title: parts[0].trim(),
                outline: parts.slice(1).join('：').trim() || '',
                content: '', status: 'pending', wordCount: 0
            });
        }
    }
    // 截断多余章节（仅未生成的）
    while (novelState.chapters.length > chapterCount && novelState.chapters[novelState.chapters.length - 1].status === 'pending') {
        novelState.chapters.pop();
    }
    _novelRenderChapterList();
    showToast('大纲已重新解析');
    return true;
}

// ==================== 6. 增强版章节生成（替代原始版本） ====================
async function _novelGenerateChapterEnhanced(idx) {
    const ch = novelState.chapters[idx];
    if (!ch || ch.status === 'done') return;

    ch.status = 'generating';
    _novelRenderChapterList();
    _novelUpdateProgress();

    const chapterLen = document.getElementById('novelChapterLength').value;
    const genre = document.getElementById('novelGenreSelect').value;

    // 每10章生成一次摘要（平衡生成速度与剧情一致性）
    if (idx > 0 && idx % 10 === 0 && (!novelState.summaries || !novelState.summaries[idx - 1])) {
        document.getElementById('novelProgressLabel').textContent = `正在生成前${idx}章摘要...`;
        await novelGenerateSummary(idx - 1);
    }

    const context = novelBuildContext(idx);

    // 动态 maxTokens：按章节目标字数调整，减少无用生成加速响应
    const targetLen = parseInt(chapterLen) || 3000;
    const dynamicMaxTokens = Math.min(16384, Math.max(4096, Math.ceil(targetLen * 1.8)));

    const sysPrompt = `你是一位顶级${genre}网络小说作家。你正在创作一部长篇连载${genre}小说，现在写第${idx + 1}章。
核心要求：
- 直接输出正文，禁止输出章节标题、写作说明、元评论
- 全文使用中文，严禁混入任何英文单词或英文短语
- 每章必须有独特的核心事件/冲突，严禁与前文重复相似的情节和对话
- 紧密承接前一章末尾的场景和情绪，开头自然过渡不要重新铺垫
- 人物语言要符合各自性格，不同角色说话风格有明显区别
- 章节末尾制造悬念或转折点

去AI化要求（重要，严格遵守）：
- 禁止使用"仿佛""宛如""犹如"等过度比喻，每章最多用2次比喻
- 禁止大段排比句和华丽辞藻堆砌，文风要朴素干练
- 禁止空泛的心理独白和感悟总结，用具体行为和对话推进情节
- 对话要口语化、生活化，避免书面腔和说教感
- 禁止使用"不禁""竟然""居然""却是""倒是"等AI高频转折词的密集堆叠
- 场景描写要简洁有力，不要每个细节都铺开描写
- 避免每段开头都用时间、环境或角色动作起笔，段落开头要多样化
- 情节推进要快，减少无意义的铺垫和过渡`;

    const prevChTitle = idx > 0 ? novelState.chapters[idx - 1]?.title : '';
    const userPrompt = `/no_think\n${context}\n\n=== 写作任务 ===\n第${idx + 1}章「${ch.title}」\n大纲：${ch.outline}\n目标字数：约${chapterLen}字\n\n特别注意：\n- 开头必须紧接前章${prevChTitle ? '「' + prevChTitle + '」' : ''}的最后一个场景，不要跳跃\n- 本章核心事件必须围绕大纲展开，不要偏离\n- 严禁出现与前文雷同的对话、场景描写或情节走向\n- 章节结尾要为下一章埋下伏笔`;

    try {
        const _chIdx = idx;
        if (typeof _novelLLM !== 'function') {
            throw new Error('_novelLLM函数未定义');
        }
        const content = await _novelLLM([
            { role: 'system', content: sysPrompt },
            { role: 'user', content: userPrompt }
        ], {
            maxTokens: dynamicMaxTokens,
            temperature: 0.9,
            stream: false
        });

        ch.content = content;
        ch.wordCount = content.length;
        ch.status = 'done';
        ch.generatedAt = Date.now();
        novelState.totalWords += ch.wordCount;
        novelState.totalCost += NOVEL_CHAPTER_COST;
        _novelSaveState();

        // 🆕 自动评估章节质量
        if (typeof novelAutoEvaluateChapter === 'function') {
            await novelAutoEvaluateChapter(idx);
        }

        // 每50章自动导出TXT备份
        const _doneTotal = novelState.chapters.filter(c => c.status === 'done').length;
        if (_doneTotal > 0 && _doneTotal % 50 === 0) {
            _novelAutoExportBackup();
        }
    } catch (e) {
        ch.status = 'error';
        console.error(`[novel] 第${idx + 1}章生成失败:`, e.message);
    }

    _novelRenderChapterList();
    _novelUpdateProgress();
    novelUpdateStatsDashboard();
}

// 保存状态的统一入口（IndexedDB主存储 + localStorage备份）
function _novelSaveState() {
    const saveData = Object.assign({}, novelState, {
        theme: document.getElementById('novelThemeInput').value,
        genre: document.getElementById('novelGenreSelect').value
    });
    // 主存储：IndexedDB（50MB+，不怕大数据）
    _novelDB.save('novel_state', saveData).catch(e => {
        console.error('[novel] IndexedDB保存失败:', e);
    });
    // 备份：localStorage（可能因5MB限制失败）
    try {
        localStorage.setItem('novel_state', JSON.stringify(saveData));
    } catch (e) {
        // 数据超出localStorage限制，只存元数据供恢复提示
        try {
            localStorage.setItem('novel_state', JSON.stringify({
                _idb: true, totalWords: saveData.totalWords, totalCost: saveData.totalCost,
                chapters: (saveData.chapters || []).map(c => ({ title: c.title, status: c.status, wordCount: c.wordCount, _published: c._published }))
            }));
        } catch (e2) { }
        if (!_novelSaveState._warned) {
            _novelSaveState._warned = true;
            if (typeof showToast === 'function') showToast('⚠️ 数据较大已保存到IndexedDB，请勿清除浏览器数据');
        }
    }
}

// 自动备份：导出TXT文件到本地
function _novelAutoExportBackup() {
    try {
        const doneChapters = novelState.chapters.filter(c => c.status === 'done');
        if (doneChapters.length === 0) return;
        const text = novelState.chapters
            .map((c, i) => c.status === 'done' ? `第${i + 1}章 ${c.title}\n\n${c.content}` : '')
            .filter(Boolean)
            .join('\n\n' + '='.repeat(40) + '\n\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.download = `novel_backup_${doneChapters.length}ch_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        console.log('[novel] 自动备份已导出:', a.download);
    } catch (e) { console.warn('[novel] 自动备份失败:', e); }
}

// ==================== 保存到手机文件 / 从手机文件加载 ====================
// 导出完整项目状态为 JSON 文件，保存到用户手机
function novelSaveToFile() {
    try {
        if ((!novelState.chapters || novelState.chapters.length === 0) && !novelState.outline) {
            showToast('暂无小说数据可保存'); return;
        }
        var saveData = Object.assign({}, novelState, {
            theme: document.getElementById('novelThemeInput').value,
            genre: document.getElementById('novelGenreSelect').value,
            _savedAt: new Date().toISOString(),
            _version: 'rollroll-novel-v1'
        });
        var json = JSON.stringify(saveData, null, 2);
        var done = novelState.chapters.filter(function (c) { return c.status === 'done'; }).length;
        var name = (document.getElementById('novelThemeInput').value || '小说').substring(0, 20).replace(/[\\/:*?"<>|]/g, '_');
        var fileName = name + '_' + done + 'ch_' + new Date().toISOString().slice(0, 10) + '.json';
        var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        var sizeKB = (json.length / 1024).toFixed(0);
        // 直接下载到手机本地
        _novelFallbackSave(blob, fileName, done, sizeKB);
    } catch (e) {
        showToast('保存失败: ' + e.message);
    }
}

// 兜底下载方式：先尝试 a.click，失败则 window.open
function _novelFallbackSave(blob, fileName, done, sizeKB) {
    var url = URL.createObjectURL(blob);
    try {
        var a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        // 延迟点击+延迟回收，提升移动端兼容性
        setTimeout(function () {
            a.click();
            setTimeout(function () {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 3000);
        }, 100);
        showToast('📱 已保存到手机（' + done + '章，' + sizeKB + 'KB）');
    } catch (e) {
        // 最终兜底：新窗口打开让用户长按保存
        window.open(url, '_blank');
        showToast('请在新页面长按保存文件');
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    }
}

// 从手机文件加载恢复小说项目
function novelLoadFromFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    // 重置 input 以允许重复选择同一文件
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const saved = JSON.parse(e.target.result);
            if (!saved.chapters || !Array.isArray(saved.chapters)) {
                showToast('无效的小说存档文件'); return;
            }
            const done = saved.chapters.filter(c => c.status === 'done').length;
            if (!confirm(`确认加载此存档？\n${saved.chapters.length}章（${done}章已完成，${(saved.totalWords || 0).toLocaleString()}字）\n\n当前数据将被覆盖。`)) return;

            Object.assign(novelState, saved);
            novelState.writing = false;
            novelState.paused = false;

            // 恢复 UI
            document.getElementById('novelThemeInput').value = saved.theme || '';
            if (saved.genre) document.getElementById('novelGenreSelect').value = saved.genre;
            if (saved.outline) {
                document.getElementById('novelOutlineBox').textContent = saved.outline;
                document.getElementById('novelOutlineSection').style.display = '';
            }
            document.getElementById('novelProgress').style.display = '';
            document.getElementById('novelStats').style.display = '';
            _novelRenderChapterList();
            _novelUpdateProgress();
            if (typeof novelExtractCharacters === 'function') novelExtractCharacters();
            if (typeof novelUpdateStatsDashboard === 'function') novelUpdateStatsDashboard();
            document.getElementById('novelStartBtn').textContent = '🚀 继续写作';
            // 同步保存到 IndexedDB + localStorage
            _novelSaveState();
            showToast(`✅ 已从文件恢复（${done}章，${(saved.totalWords || 0).toLocaleString()}字）`);
        } catch (err) {
            showToast('文件解析失败: ' + err.message);
        }
    };
    reader.onerror = function () { showToast('文件读取失败'); };
    reader.readAsText(file);
    input.value = ''; // 允许重复选择同一文件
}

// ==================== 📊 小说评分评估系统 ====================

/**
 * 评估单个章节的质量
 * @param {number} idx - 章节索引
 * @returns {Object} 评估结果 { score, issues, repetitions, errors }
 */
async function novelEvaluateChapter(idx) {
    const ch = novelState.chapters[idx];
    if (!ch || !ch.content || ch.status !== 'done') {
        return { score: 0, issues: ['章节未完成'], repetitions: [], errors: [] };
    }

    const content = ch.content;
    const issues = [];
    const repetitions = [];
    const errors = [];
    let score = 100;

    // 1. 检测重复内容（与前面章节对比）
    if (idx > 0) {
        const prevContents = novelState.chapters.slice(Math.max(0, idx - 5), idx)
            .filter(c => c.status === 'done')
            .map(c => c.content);

        // 检测重复的句子（超过15字的句子）
        const sentences = content.match(/[^。！？]+[。！？]/g) || [];
        for (const sent of sentences) {
            if (sent.length < 15) continue;
            for (let i = 0; i < prevContents.length; i++) {
                if (prevContents[i].includes(sent)) {
                    repetitions.push({
                        type: '重复句子',
                        content: sent.substring(0, 50) + '...',
                        chapter: idx - prevContents.length + i + 1
                    });
                    score -= 5;
                }
            }
        }

        // 检测重复的对话模式
        const dialogues = content.match(/["「『]([^"」』]{10,})["」』]/g) || [];
        for (const dialog of dialogues) {
            for (let i = 0; i < prevContents.length; i++) {
                if (prevContents[i].includes(dialog)) {
                    repetitions.push({
                        type: '重复对话',
                        content: dialog.substring(0, 50) + '...',
                        chapter: idx - prevContents.length + i + 1
                    });
                    score -= 3;
                }
            }
        }
    }

    // 2. 检测AI痕迹（高频词汇）
    const aiWords = [
        { word: '仿佛', limit: 2, penalty: 2 },
        { word: '宛如', limit: 2, penalty: 2 },
        { word: '犹如', limit: 2, penalty: 2 },
        { word: '不禁', limit: 3, penalty: 1 },
        { word: '竟然', limit: 3, penalty: 1 },
        { word: '居然', limit: 3, penalty: 1 },
        { word: '却是', limit: 3, penalty: 1 },
        { word: '倒是', limit: 3, penalty: 1 }
    ];

    for (const { word, limit, penalty } of aiWords) {
        const count = (content.match(new RegExp(word, 'g')) || []).length;
        if (count > limit) {
            issues.push(`AI痕迹：「${word}」出现${count}次（建议≤${limit}次）`);
            score -= (count - limit) * penalty;
        }
    }

    // 3. 检测常见错误
    // 3.1 标点符号错误
    if (/[,，][,，]/.test(content)) {
        errors.push('标点错误：连续逗号');
        score -= 2;
    }
    if (/[。.][。.]/.test(content)) {
        errors.push('标点错误：连续句号');
        score -= 2;
    }

    // 3.2 空格错误
    const spaceErrors = content.match(/[a-zA-Z]\s+[a-zA-Z]/g) || [];
    if (spaceErrors.length > 0) {
        errors.push(`英文单词：发现${spaceErrors.length}处英文（应全中文）`);
        score -= spaceErrors.length * 3;
    }

    // 3.3 段落格式
    const paragraphs = content.split('\n').filter(p => p.trim());
    if (paragraphs.length < 5) {
        issues.push('段落过少：建议增加分段提高可读性');
        score -= 5;
    }

    // 3.4 对话格式
    const hasDialogue = /["「『]/.test(content);
    if (!hasDialogue && content.length > 1000) {
        issues.push('缺少对话：长篇章节建议增加人物对话');
        score -= 3;
    }

    // 4. 检测章节标题或元评论（不应出现在正文中）
    if (/^第\d+章/.test(content) || /^【.*】/.test(content)) {
        errors.push('格式错误：正文包含章节标题');
        score -= 5;
    }
    if (/写作说明|作者注|元评论/.test(content)) {
        errors.push('格式错误：正文包含元评论');
        score -= 5;
    }

    // 5. 检测字数是否达标
    const targetLen = parseInt(document.getElementById('novelChapterLength')?.value || 3000);
    const actualLen = content.length;
    if (actualLen < targetLen * 0.8) {
        issues.push(`字数不足：${actualLen}字（目标${targetLen}字）`);
        score -= 10;
    } else if (actualLen > targetLen * 1.5) {
        issues.push(`字数过多：${actualLen}字（目标${targetLen}字）`);
        score -= 5;
    }

    // 确保分数在0-100之间
    score = Math.max(0, Math.min(100, score));

    // 🆕 收集AI痕迹的具体位置
    const aiTraces = [];
    for (const { word, limit } of aiWords) {
        const regex = new RegExp(word, 'g');
        const matches = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push(match.index);
        }
        if (matches.length > limit) {
            aiTraces.push({
                word,
                count: matches.length,
                limit,
                positions: matches
            });
        }
    }

    return {
        score: Math.round(score),
        issues,
        repetitions,
        errors,
        wordCount: actualLen,
        aiTraces  // 🆕 添加AI痕迹详情
    };
}

/**
 * 评估整部小说的质量
 * @returns {Object} 全局评估结果
 */
async function novelEvaluateAll() {
    const doneChapters = novelState.chapters.filter(c => c.status === 'done');
    if (doneChapters.length === 0) {
        return {
            overallScore: 0,
            chapterScores: [],
            globalIssues: ['没有已完成的章节'],
            totalRepetitions: 0,
            totalErrors: 0
        };
    }

    showToast('正在评估小说质量...');
    const chapterScores = [];
    let totalScore = 0;
    let totalRepetitions = 0;
    let totalErrors = 0;
    const globalIssues = [];

    // 评估每个章节
    for (let i = 0; i < novelState.chapters.length; i++) {
        if (novelState.chapters[i].status !== 'done') continue;

        const result = await novelEvaluateChapter(i);
        // 存到章节对象，供批量修正等功能使用
        novelState.chapters[i]._evaluation = result;
        chapterScores.push({
            index: i,
            title: novelState.chapters[i].title,
            ...result
        });
        totalScore += result.score;
        totalRepetitions += result.repetitions.length;
        totalErrors += result.errors.length;

        // 📊 评估进度反馈（每5章更新一次，最后一批也更新）
        const doneCount = chapterScores.length;
        if (doneCount <= 5 || doneCount % 5 === 0 || i === novelState.chapters.length - 1) {
            showToast(`评估进度: ${doneCount}/${doneChapters.length} 章`);
        }
    }

    const overallScore = Math.round(totalScore / doneChapters.length);

    // 全局问题检测
    // 1. 检测整体重复率
    if (totalRepetitions > doneChapters.length * 2) {
        globalIssues.push(`重复内容过多：发现${totalRepetitions}处重复`);
    }

    // 2. 检测整体AI痕迹
    const lowScoreChapters = chapterScores.filter(c => c.score < 70);
    if (lowScoreChapters.length > doneChapters.length * 0.3) {
        globalIssues.push(`质量较低章节过多：${lowScoreChapters.length}/${doneChapters.length}章低于70分`);
    }

    // 3. 检测字数波动
    const wordCounts = chapterScores.map(c => c.wordCount);
    const avgWords = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
    const maxWords = Math.max(...wordCounts);
    const minWords = Math.min(...wordCounts);
    if (maxWords > avgWords * 1.5 || minWords < avgWords * 0.5) {
        globalIssues.push(`章节字数波动较大：${minWords}-${maxWords}字（平均${Math.round(avgWords)}字）`);
    }

    return {
        overallScore,
        chapterScores,
        globalIssues,
        totalRepetitions,
        totalErrors,
        evaluatedChapters: doneChapters.length,
        totalChapters: novelState.chapters.length
    };
}

/**
 * 显示评估结果UI（增强版：显示具体内容+支持修正）
 */
function novelShowEvaluationResult(result) {
    const { overallScore, chapterScores, globalIssues, totalRepetitions, totalErrors } = result;

    // 创建评估结果面板
    let html = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="this.remove()">
            <div style="background:#1a1a2e;border-radius:16px;max-width:800px;max-height:85vh;overflow-y:auto;padding:24px;color:#fff;" onclick="event.stopPropagation()">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h3 style="margin:0;font-size:20px;">📊 小说质量评估报告（增强版）</h3>
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="background:none;border:none;color:#888;font-size:24px;cursor:pointer;">&times;</button>
                </div>

                <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;margin-bottom:16px;">
                    <div style="font-weight:bold;margin-bottom:10px;color:#94a3b8;">🔧 评估设置</div>
                    <div style="display:flex;gap:12px;margin-bottom:12px;align-items:center;flex-wrap:wrap;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <label style="color:#94a3b8;font-size:13px;">评估模型:</label>
                            <select id="evalModelSelect" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:6px;color:#fff;padding:6px 10px;font-size:13px;">
                                <option value="qwen3.5-plus" selected>🧠 Qwen3.5-Plus</option>
                                <option value="yunwu:qwen-plus">☁️ Qwen-Plus</option>
                                <option value="yunwu:grok-4-fast">⚡ Grok-4 Fast</option>
                                <option value="yunwu:grok-4.1">🌟 Grok-4.1</option>
                            </select>
                        </div>
                        <button onclick="novelReEvaluate()" style="background:#22c55e;color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;">
                            🔄 重新评估
                        </button>
                    </div>
                    <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:12px;">
                        <div style="color:#94a3b8;font-size:13px;margin-bottom:8px;">多模型评估（勾选要使用的模型）:</div>
                        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px;">
                            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:#fff;">
                                <input type="checkbox" class="eval-model-checkbox" value="qwen3.5-plus" checked style="cursor:pointer;"> 🧠 Qwen3.5-Plus
                            </label>
                            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:#fff;">
                                <input type="checkbox" class="eval-model-checkbox" value="yunwu:grok-4-fast" style="cursor:pointer;"> ⚡ Grok-4 Fast
                            </label>
                            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:#fff;">
                                <input type="checkbox" class="eval-model-checkbox" value="yunwu:grok-4.1" style="cursor:pointer;"> 🌟 Grok-4.1
                            </label>
                        </div>
                        <button onclick="novelMultiModelEvaluate()" style="background:#8b5cf6;color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;">
                            🎯 多模型对比评估
                        </button>
                    </div>
                </div>

                <div style="text-align:center;margin-bottom:24px;">
                    <div style="font-size:48px;font-weight:bold;color:${overallScore >= 80 ? '#22c55e' : overallScore >= 60 ? '#fbbf24' : '#ef4444'};">
                        ${overallScore}
                    </div>
                    <div style="color:#94a3b8;margin-top:8px;">综合评分</div>
                    <div style="color:#94a3b8;font-size:14px;margin-top:4px;">
                        ${result.evaluatedChapters}/${result.totalChapters} 章已评估
                    </div>
                    ${result.model ? `<div style="color:#fbbf24;font-size:12px;margin-top:4px;">模型: ${result.model}（按token计费，服务端扣减胶片）</div>` : ''}
                </div>

                ${globalIssues.length > 0 ? `
                <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px;margin-bottom:16px;">
                    <div style="font-weight:bold;margin-bottom:8px;color:#ef4444;">⚠️ 全局问题</div>
                    ${globalIssues.map(issue => `<div style="font-size:14px;color:#fca5a5;margin-bottom:4px;">• ${issue}</div>`).join('')}
                </div>
                ` : ''}

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                    <div style="background:rgba(251,191,36,0.1);border-radius:8px;padding:12px;text-align:center;">
                        <div style="font-size:24px;font-weight:bold;color:#fbbf24;">${totalRepetitions}</div>
                        <div style="font-size:14px;color:#94a3b8;margin-top:4px;">重复内容</div>
                    </div>
                    <div style="background:rgba(239,68,68,0.1);border-radius:8px;padding:12px;text-align:center;">
                        <div style="font-size:24px;font-weight:bold;color:#ef4444;">${totalErrors}</div>
                        <div style="font-size:14px;color:#94a3b8;margin-top:4px;">错误问题</div>
                    </div>
                </div>

                <div style="margin-bottom:16px;">
                    <div style="font-weight:bold;margin-bottom:12px;">📖 章节评分详情</div>
                    <div style="max-height:400px;overflow-y:auto;">
                        ${chapterScores.map(ch => `
                            <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;margin-bottom:8px;">
                                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                    <div style="font-weight:bold;cursor:pointer;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" onclick="novelViewChapter(${ch.index})">第${ch.index + 1}章 ${ch.title}</div>
                                    <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                                        <input type="number" min="0" max="100" value="${ch.score}" id="novelScoreInput_${ch.index}" onchange="novelManualSetScore(${ch.index}, this.value)" style="width:52px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:${ch.score >= 80 ? '#22c55e' : ch.score >= 60 ? '#fbbf24' : '#ef4444'};font-size:14px;font-weight:bold;text-align:center;padding:2px 4px;" />
                                        <span style="color:#94a3b8;font-size:13px;">分</span>
                                        <button onclick="event.stopPropagation(); novelFixChapter(${ch.index})" style="background:#3b82f6;color:#fff;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:12px;">
                                            🔧 修正
                                        </button>
                                        <button onclick="event.stopPropagation(); novelRegenerateChapter(${ch.index})" style="background:#f59e0b;color:#fff;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:12px;">
                                            🔄 重写
                                        </button>
                                    </div>
                                </div>

                                ${ch.issues.length > 0 ? `
                                    <div style="font-size:13px;color:#fbbf24;margin-bottom:8px;">
                                        <div style="font-weight:bold;margin-bottom:4px;">⚠️ 问题：</div>
                                        ${ch.issues.map(issue => `<div style="margin-left:12px;margin-bottom:2px;">• ${issue}</div>`).join('')}
                                    </div>
                                ` : ''}

                                ${ch.repetitions.length > 0 ? `
                                    <div style="font-size:13px;color:#ef4444;margin-bottom:8px;">
                                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                                            <div style="font-weight:bold;">🔄 重复内容：</div>
                                            <button onclick="event.stopPropagation(); novelAutoFixRepetitions(${ch.index})" style="background:#ef4444;color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;">
                                                ✨ 一键去重
                                            </button>
                                        </div>
                                        ${ch.repetitions.slice(0, 3).map((rep, idx) => `
                                            <div style="margin-left:12px;margin-bottom:4px;background:rgba(239,68,68,0.1);padding:4px 8px;border-radius:4px;position:relative;">
                                                <div style="color:#fca5a5;font-size:12px;">${rep.type} (与第${rep.chapter}章重复)</div>
                                                <div style="color:#fff;margin-top:2px;cursor:pointer;" onclick="novelHighlightText(${ch.index}, '${rep.content.replace(/'/g, "\\'")}')">
                                                    "${rep.content}"
                                                    <span style="color:#888;font-size:11px;margin-left:4px;">点击定位</span>
                                                </div>
                                            </div>
                                        `).join('')}
                                        ${ch.repetitions.length > 3 ? `<div style="margin-left:12px;color:#888;font-size:12px;">还有${ch.repetitions.length - 3}处重复...</div>` : ''}
                                    </div>
                                ` : ''}

                                ${ch.aiTraces && ch.aiTraces.length > 0 ? `
                                    <div style="font-size:13px;color:#a78bfa;margin-bottom:8px;">
                                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                                            <div style="font-weight:bold;">🤖 AI痕迹：</div>
                                            <button onclick="event.stopPropagation(); novelAutoFixAITraces(${ch.index})" style="background:#a78bfa;color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;">
                                                ✨ 一键优化
                                            </button>
                                        </div>
                                        ${ch.aiTraces.map(trace => `
                                            <div style="margin-left:12px;margin-bottom:2px;cursor:pointer;" onclick="novelHighlightText(${ch.index}, '${trace.word}')">
                                                • 「${trace.word}」出现${trace.count}次（建议≤${trace.limit}次）
                                                <span style="color:#888;font-size:11px;margin-left:4px;">点击定位</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}

                                ${ch.errors.length > 0 ? `
                                    <div style="font-size:13px;color:#ef4444;">
                                        <div style="font-weight:bold;margin-bottom:4px;">❌ 错误：</div>
                                        ${ch.errors.map(err => `<div style="margin-left:12px;margin-bottom:2px;">• ${err}</div>`).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div style="display:flex;gap:8px;">
                    <button onclick="event.stopPropagation(); novelBatchFixLowScoreChapters()" style="flex:1;background:#8b5cf6;color:#fff;border:none;border-radius:8px;padding:12px;cursor:pointer;font-size:14px;">
                        🔧 批量修正低分章节
                    </button>
                    <button onclick="event.stopPropagation(); novelExportEvaluationReport()" style="flex:1;background:#3b82f6;color:#fff;border:none;border-radius:8px;padding:12px;cursor:pointer;font-size:14px;">
                        📄 导出报告
                    </button>
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="flex:1;background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:8px;padding:12px;cursor:pointer;font-size:14px;">
                        关闭
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * 修正单个章节的质量问题
 */
async function novelFixChapter(idx) {
    console.log('[novel-fix] 开始修正章节:', idx);

    const ch = novelState.chapters[idx];
    if (!ch || ch.status !== 'done') {
        showToast('章节不存在或未完成');
        return;
    }

    const evaluation = ch._evaluation || await novelEvaluateChapter(idx);
    if (evaluation.score >= 80) {
        showToast('该章节质量已经很好，无需修正');
        return;
    }

    if (!confirm(`确定要修正第${idx + 1}章吗？\n当前评分：${evaluation.score}分\n将根据评估结果重新生成该章节。`)) {
        return;
    }

    // 关闭评估面板
    const modal = document.querySelector('div[style*="position:fixed"][style*="z-index:10000"]');
    if (modal) modal.remove();

    showToast('正在修正章节...');
    console.log('[novel-fix] 评估结果:', evaluation);

    try {
        // 构建修正提示
        const issues = [
            ...evaluation.issues,
            ...evaluation.errors,
            ...evaluation.repetitions.map(r => `避免重复：${r.content}`)
        ];

        const fixPrompt = `请重写第${idx + 1}章，修正以下问题：\n${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}\n\n原章节内容：\n${ch.content.substring(0, 500)}...\n\n要求：\n1. 保持故事情节连贯\n2. 避免上述所有问题\n3. 字数保持在${ch.content.length}字左右\n4. 减少AI痕迹词汇的使用\n5. 增加对话和细节描写`;

        // 调用LLM重写
        const newContent = await _novelLLM([
            { role: 'system', content: '你是专业小说编辑，擅长修正文本质量问题。全文使用中文，严禁混入英文单词。' },
            { role: 'user', content: fixPrompt }
        ], { maxTokens: 8192, temperature: 0.85, timeout: 120000 });

        // 更新章节内容
        ch.content = newContent;
        ch.wordCount = newContent.length;

        // 重新评估
        const newEvaluation = await novelEvaluateChapter(idx);
        ch._evaluation = newEvaluation;

        // 保存
        novelSaveCurrentProject();
        novelViewChapter(idx);

        showToast(`✅ 第${idx + 1}章修正完成！评分：${evaluation.score} → ${newEvaluation.score}`);

        // 刷新评估报告
        if (novelState._lastEvaluation) {
            const result = await novelEvaluateAll();
            novelState._lastEvaluation = result;
        }
    } catch (e) {
        showToast('修正失败: ' + e.message);
        console.error('[novel-fix] 修正失败:', e);
    }
}

/**
 * 批量修正低分章节
 */
async function novelBatchFixLowScoreChapters() {
    const lowScoreChapters = novelState.chapters
        .map((ch, idx) => ({ ch, idx, score: ch._evaluation?.score || 100 }))
        .filter(item => item.ch.status === 'done' && item.score < 70);

    if (lowScoreChapters.length === 0) {
        showToast('没有需要修正的低分章节');
        return;
    }

    // 🔒 防止重复点击
    if (novelState._batchFixing) { showToast('正在批量修正中，请勿重复操作'); return; }
    novelState._batchFixing = true;

    if (!confirm(`发现${lowScoreChapters.length}个低分章节（<70分），确定要批量修正吗？\n这可能需要较长时间。`)) {
        novelState._batchFixing = false;
        return;
    }

    // 关闭评估面板
    document.querySelector('div[style*="position:fixed"]')?.remove();

    showToast(`开始批量修正${lowScoreChapters.length}个章节...`);

    let successCount = 0;
    let failCount = 0;

    try {
        for (const { idx, score } of lowScoreChapters) {
            try {
                showToast(`正在修正第${idx + 1}章（${score}分）...`);
                await novelFixChapter(idx);
                successCount++;
            } catch (e) {
                console.error(`[novel-fix] 第${idx + 1}章修正失败:`, e);
                failCount++;
            }
        }

        showToast(`批量修正完成！成功：${successCount}，失败：${failCount}`);

        // 重新评估
        const result = await novelEvaluateAll();
        novelState._lastEvaluation = result;
        novelShowEvaluationResult(result);
    } finally {
        novelState._batchFixing = false;
    }
}

/**
 * 导出评估报告
 */
function novelExportEvaluationReport() {
    if (!novelState._lastEvaluation) {
        showToast('请先进行评估');
        return;
    }

    const { overallScore, chapterScores, globalIssues, totalRepetitions, totalErrors } = novelState._lastEvaluation;

    let report = `# 小说质量评估报告\n\n`;
    report += `**综合评分**: ${overallScore}/100\n`;
    report += `**评估章节**: ${chapterScores.length}章\n`;
    report += `**重复内容**: ${totalRepetitions}处\n`;
    report += `**错误问题**: ${totalErrors}处\n\n`;

    if (globalIssues.length > 0) {
        report += `## 全局问题\n\n`;
        globalIssues.forEach(issue => {
            report += `- ${issue}\n`;
        });
        report += `\n`;
    }

    report += `## 章节详情\n\n`;
    chapterScores.forEach(ch => {
        report += `### 第${ch.index + 1}章 ${ch.title} (${ch.score}分)\n\n`;
        if (ch.issues.length > 0) {
            report += `**问题**:\n`;
            ch.issues.forEach(issue => report += `- ${issue}\n`);
        }
        if (ch.repetitions.length > 0) {
            report += `\n**重复内容** (${ch.repetitions.length}处):\n`;
            ch.repetitions.forEach(rep => {
                report += `- ${rep.type}: ${rep.content} (与第${rep.chapter}章重复)\n`;
            });
        }
        if (ch.errors.length > 0) {
            report += `\n**错误**:\n`;
            ch.errors.forEach(err => report += `- ${err}\n`);
        }
        report += `\n`;
    });

    // 下载报告
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${novelState.theme || '小说'}_评估报告.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('评估报告已导出');
}

/**
 * 在章节生成后自动评估
 */
async function novelAutoEvaluateChapter(idx) {
    try {
        const result = await novelEvaluateChapter(idx);

        // 保存评估结果到章节
        if (!novelState.chapters[idx]._evaluation) {
            novelState.chapters[idx]._evaluation = result;
        }

        // 如果评分低于60，显示警告
        if (result.score < 60) {
            const issues = [...result.issues, ...result.errors].slice(0, 3).join('\n');
            showToast(`⚠️ 第${idx + 1}章评分较低(${result.score}分)\n${issues}`, 5000);
        }

        return result;
    } catch (e) {
        console.warn('[novel-eval] 章节评估失败:', e);
        return null;
    }
}

/**
 * 手动设置章节评分
 */
function novelManualSetScore(idx, value) {
    const score = Math.max(0, Math.min(100, parseInt(value) || 0));
    const input = document.getElementById('novelScoreInput_' + idx);
    if (input) {
        input.value = score;
        input.style.color = score >= 80 ? '#22c55e' : score >= 60 ? '#fbbf24' : '#ef4444';
    }
    const ch = novelState.chapters[idx];
    if (ch) {
        if (!ch._evaluation) ch._evaluation = { score: 100, issues: [], repetitions: [], errors: [] };
        ch._evaluation.score = score;
        console.log(`[novel] 第${idx + 1}章评分手动设为 ${score}分`);
    }
}

/**
 * 重新生成单个章节（不参考原内容，全新生成）
 */
async function novelRegenerateChapter(idx) {
    const ch = novelState.chapters[idx];
    if (!ch) {
        showToast('章节不存在');
        return;
    }

    // 🔒 防止重复点击（章节正在生成中）
    if (ch.status === 'generating') { showToast('该章节正在生成中，请稍候'); return; }

    if (!confirm(`确定要重新生成第${idx + 1}章吗？\n原内容将被覆盖。`)) return;

    // 关闭评估面板
    const modal = document.querySelector('div[style*="position:fixed"][style*="z-index:10000"]');
    if (modal) modal.remove();

    showToast(`正在重新生成第${idx + 1}章...`);
    try {
        // 重置状态
        ch.status = 'generating';
        ch.content = '';
        _novelRenderChapterList();
        _novelUpdateProgress();

        await _novelGenerateChapter(idx);

        // 自动评估
        const result = await novelEvaluateChapter(idx);
        ch._evaluation = result;

        novelSaveCurrentProject();
        novelViewChapter(idx);
        showToast(`✅ 第${idx + 1}章重新生成完成！评分：${result.score}分`);
    } catch (e) {
        ch.status = 'error';
        _novelRenderChapterList();
        showToast('重新生成失败: ' + e.message);
        console.error('[novel] 重新生成失败:', e);
    }
}

/**
 * 手动触发全局评估
 */
async function novelTriggerEvaluation() {
    const doneChapters = novelState.chapters.filter(c => c.status === 'done');
    if (doneChapters.length === 0) {
        showToast('没有已完成的章节可以评估');
        return;
    }

    const btn = document.getElementById('novelEvaluateBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '📊 评估中...';
    }

    try {
        // 默认使用 qwen3.5-plus 进行 LLM 评估
        const modelSelect = document.getElementById('evalModelSelect');
        const selectedModel = modelSelect ? modelSelect.value : 'qwen3.5-plus';
        const result = await novelEvaluateAllWithModel(selectedModel);
        novelState._lastEvaluation = result;
        novelState._lastEvalModel = selectedModel;
        novelShowEvaluationResult(result);
        showToast(`✅ 评估完成（${selectedModel}）`);
    } catch (e) {
        showToast('评估失败: ' + e.message);
        console.error('[novel-eval] 评估失败:', e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📊 质量评估';
        }
    }
}

/**
 * 显示/隐藏评估按钮
 */
function novelUpdateEvaluateButton() {
    const btn = document.getElementById('novelEvaluateBtn');
    if (!btn) return;

    const doneChapters = novelState.chapters.filter(c => c.status === 'done');
    if (doneChapters.length > 0) {
        btn.style.display = '';
    } else {
        btn.style.display = 'none';
    }
}

/**
 * 🆕 使用选定模型重新评估
 */
async function novelReEvaluate() {
    const modelSelect = document.getElementById('evalModelSelect');
    const selectedModel = modelSelect ? modelSelect.value : 'qwen3.5-plus';
    
    console.log('[novel-eval] 使用模型重新评估:', selectedModel);

    // 🔒 防止重复点击
    const btn = event?.target;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 评估中...'; }

    showToast(`正在使用 ${selectedModel} 重新评估...`);

    try {
        const result = await novelEvaluateAllWithModel(selectedModel);
        novelState._lastEvaluation = result;
        novelState._lastEvalModel = selectedModel;
        
        // 关闭当前面板并显示新结果
        const modal = document.querySelector('div[style*="position:fixed"][style*="z-index:10000"]');
        if (modal) modal.remove();
        
        novelShowEvaluationResult(result);
        showToast('✅ 重新评估完成');
    } catch (e) {
        showToast('评估失败: ' + e.message);
        console.error('[novel-eval] 重新评估失败:', e);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 重新评估'; }
    }
}

/**
 * 🆕 多模型评估（使用多个模型评估并对比结果）
 */
async function novelMultiModelEvaluate() {
    // 获取用户选择的模型
    const checkboxes = document.querySelectorAll('.eval-model-checkbox:checked');
    const models = Array.from(checkboxes).map(cb => cb.value);
    
    if (models.length < 2) {
        showToast('请至少选择2个模型进行对比评估');
        return;
    }

    // 🔒 防止重复点击
    const btn = event?.target;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 评估中...'; }

    console.log('[novel-eval] 开始多模型评估:', models);
    showToast(`正在使用 ${models.length} 个模型并行评估...`);

    // 🔧 估算胶片消耗（所有模型均通过 LLM 评估，按 token 计费）
    const doneCount = novelState.chapters.filter(c => c.status === 'done').length;
    const estFilm = models.length * doneCount; // 每章每模型约1胶片
    if (estFilm > 0) {
        showToast(`预估胶片消耗: 约 ${estFilm} 胶片（${models.length}个模型 × ${doneCount}章）`);
    }

    try {
        // 并行执行所有模型评估
        const evalPromises = models.map(async (model) => {
            try {
                const result = await novelEvaluateAllWithModel(model);
                return { model, result };
            } catch (e) {
                console.error(`[novel-eval] 模型 ${model} 评估失败:`, e);
                return { model, result: { error: e.message } };
            }
        });

        // 等待所有评估完成
        const evalResults = await Promise.all(evalPromises);
        
        // 整理结果
        const results = {};
        evalResults.forEach(({ model, result }) => {
            results[model] = result;
        });

        // 关闭当前面板并显示多模型对比结果
        const modal = document.querySelector('div[style*="position:fixed"][style*="z-index:10000"]');
        if (modal) modal.remove();

        // 显示多模型评估对比结果
        novelShowMultiModelResult(results);
        showToast('✅ 多模型评估完成');
    } catch (e) {
        showToast('多模型评估失败: ' + e.message);
        console.error('[novel-eval] 多模型评估失败:', e);
    } finally {
        // 🔓 恢复按钮状态
        if (btn) { btn.disabled = false; btn.textContent = '🎯 多模型对比评估'; }
    }
}

/**
 * 🆕 使用指定模型评估所有章节
 */
async function novelEvaluateAllWithModel(model) {
    const doneChapters = novelState.chapters.filter(c => c.status === 'done');
    if (doneChapters.length === 0) {
        return {
            overallScore: 0,
            chapterScores: [],
            globalIssues: ['没有已完成的章节'],
            totalRepetitions: 0,
            totalErrors: 0,
            model: model
        };
    }

    // 并行评估所有章节（最多3个并发）
    const chapterIndices = novelState.chapters
        .map((c, i) => c.status === 'done' ? i : -1)
        .filter(i => i !== -1);
    
    const batchSize = 3; // 每批最多3个章节并行
    const chapterScores = [];
    
    for (let i = 0; i < chapterIndices.length; i += batchSize) {
        // 📊 实时进度反馈
        const completed = Math.min(i + batchSize, chapterIndices.length);
        showToast(`${model} 评估进度: ${completed}/${chapterIndices.length} 章`);
        
        const batch = chapterIndices.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(async (idx) => {
                try {
                    const result = await novelEvaluateChapterWithModel(idx, model);
                    novelState.chapters[idx]._evaluation = result;
                    novelState.chapters[idx]._evalModel = model;
                    return {
                        index: idx,
                        title: novelState.chapters[idx].title,
                        ...result
                    };
                } catch (e) {
                    console.error(`[novel-eval] 章节 ${idx + 1} 评估失败:`, e);
                    // 返回默认结果
                    return {
                        index: idx,
                        title: novelState.chapters[idx].title,
                        score: 70,
                        issues: ['评估失败'],
                        repetitions: [],
                        errors: []
                    };
                }
            })
        );
        chapterScores.push(...batchResults);
    }

    // 计算统计数据
    let totalScore = 0;
    let totalRepetitions = 0;
    let totalErrors = 0;
    const globalIssues = [];

    chapterScores.forEach(ch => {
        totalScore += ch.score;
        totalRepetitions += ch.repetitions?.length || 0;
        totalErrors += ch.errors?.length || 0;
    });

    const overallScore = Math.round(totalScore / doneChapters.length);

    // 全局问题检测
    if (totalRepetitions > doneChapters.length * 2) {
        globalIssues.push(`重复内容过多：发现${totalRepetitions}处重复`);
    }

    const lowScoreChapters = chapterScores.filter(c => c.score < 70);
    if (lowScoreChapters.length > doneChapters.length * 0.3) {
        globalIssues.push(`质量较低章节过多：${lowScoreChapters.length}/${doneChapters.length}章低于70分`);
    }

    return {
        overallScore,
        chapterScores,
        globalIssues,
        totalRepetitions,
        totalErrors,
        evaluatedChapters: doneChapters.length,
        totalChapters: novelState.chapters.length,
        model: model
    };
}

/**
 * 🆕 使用指定模型评估单个章节
 */
async function novelEvaluateChapterWithModel(idx, model) {
    const ch = novelState.chapters[idx];
    if (!ch || !ch.content || ch.status !== 'done') {
        return { score: 0, issues: ['章节未完成'], repetitions: [], errors: [] };
    }

    // 网站模式不支持本地评估，所有评估均通过 LLM 模型完成
    if (model === 'local') {
        showToast('当前为在线模式，请选择 LLM 模型进行评估');
        throw new Error('在线模式不支持本地规则评估，请选择 LLM 模型');
    }

    // 使用 LLM 模型评估
    try {
        const evalPrompt = `/no_think
请作为专业小说编辑，评估以下章节的质量。

章节标题：${ch.title}
章节内容：
${ch.content.substring(0, 3000)}${ch.content.length > 3000 ? '...(内容过长已截断)' : ''}

请从以下维度评估并打分（每项0-20分，总分100分）：
1. 情节连贯性
2. 人物塑造
3. 语言表达
4. 节奏把控
5. 创意新颖度

输出格式（严格JSON）：
{"score":总分,"dimensions":{"plot":分,"character":分,"language":分,"pace":分,"creative":分},"issues":["问题1","问题2"],"suggestions":["建议1","建议2"]}`;

        const response = await _novelLLM([
            { role: 'system', content: '你是专业小说编辑，擅长评估小说质量。输出纯JSON格式。' },
            { role: 'user', content: evalPrompt }
        ], { model: model, maxTokens: 500, temperature: 0.3, timeout: 130000, retries: 0 });

        // 解析 JSON
        let evalResult;
        try {
            // 尝试提取 JSON
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                evalResult = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('无法解析评估结果');
            }
        } catch (parseErr) {
            console.warn('[novel-eval] JSON解析失败，使用默认值:', parseErr);
            evalResult = { score: 70, issues: ['评估结果解析失败'], suggestions: [] };
        }

        // 合并本地检测的重复内容
        const localResult = await novelEvaluateChapter(idx);
        
        return {
            score: Math.min(100, Math.max(0, evalResult.score || 70)),
            issues: evalResult.issues || [],
            suggestions: evalResult.suggestions || [],
            dimensions: evalResult.dimensions || {},
            repetitions: localResult.repetitions,
            errors: localResult.errors,
            wordCount: ch.content.length,
            aiTraces: localResult.aiTraces,
            model: model
        };
    } catch (e) {
        console.error('[novel-eval] LLM评估失败:', e);
        return { score: 0, issues: ['评估失败: ' + e.message], repetitions: [], errors: ['API调用失败'] };
    }
}

/**
 * 🆕 显示多模型评估对比结果
 */
function novelShowMultiModelResult(results) {
    const modelNames = {
        'qwen3.5-plus': 'Qwen3.5-Plus',
        'yunwu:qwen-plus': 'Qwen-Plus',
        'yunwu:grok-4-fast': 'Grok-4 Fast',
        'yunwu:grok-4.1': 'Grok-4.1'
    };

    const modelCount = Object.keys(results).length;
    const gridCols = modelCount <= 2 ? 2 : modelCount <= 4 ? 4 : modelCount;

    // 📊 统计胶片消耗（所有模型均通过 LLM 评估）
    const evaluatedChapters = Object.values(results).find(r => !r.error)?.chapterScores?.length || 0;
    const estimatedFilmCost = modelCount * evaluatedChapters;

    let html = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="this.remove()">
            <div style="background:#1a1a2e;border-radius:16px;max-width:900px;max-height:85vh;overflow-y:auto;padding:24px;color:#fff;" onclick="event.stopPropagation()">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h3 style="margin:0;font-size:20px;">🎯 多模型评估对比</h3>
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="background:none;border:none;color:#888;font-size:24px;cursor:pointer;">&times;</button>
                </div>

                <div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:10px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:13px;color:#fbbf24;">💰 本次评估胶片消耗（预估）</div>
                        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">${modelCount}个模型 × ${evaluatedChapters}章（按实际token计费，服务端扣减）</div>
                    </div>
                    <div style="font-size:20px;font-weight:bold;color:#fbbf24;">~${estimatedFilmCost} 胶片</div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(${gridCols},1fr);gap:16px;margin-bottom:24px;">
                    ${Object.entries(results).map(([model, result]) => `
                        <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;text-align:center;">
                            <div style="font-size:14px;color:#94a3b8;margin-bottom:8px;">${modelNames[model] || model}</div>
                            <div style="font-size:36px;font-weight:bold;color:${result.error ? '#ef4444' : result.overallScore >= 80 ? '#22c55e' : result.overallScore >= 60 ? '#fbbf24' : '#ef4444'};">
                                ${result.error ? '❌' : result.overallScore}
                            </div>
                            ${result.error ? `<div style="font-size:12px;color:#ef4444;">${result.error}</div>` : ''}
                        </div>
                    `).join('')}
                </div>

                <div style="margin-bottom:16px;">
                    <div style="font-weight:bold;margin-bottom:12px;">📊 章节评分对比</div>
                    <div style="max-height:400px;overflow-y:auto;">
                        ${Object.values(results).find(r => !r.error)?.chapterScores ? Object.values(results).find(r => !r.error).chapterScores.map(ch => {
                            const scores = Object.entries(results).map(([model, r]) => {
                                if (r.error) return { model, score: '-' };
                                const chapter = r.chapterScores?.find(c => c.index === ch.index);
                                return { model, score: chapter?.score || '-' };
                            });
                            return `
                                <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;margin-bottom:8px;">
                                    <div style="font-weight:bold;margin-bottom:8px;">第${ch.index + 1}章 ${ch.title}</div>
                                    <div style="display:flex;gap:12px;">
                                        ${scores.map(s => `
                                            <div style="flex:1;text-align:center;">
                                                <div style="font-size:12px;color:#94a3b8;">${modelNames[s.model] || s.model}</div>
                                                <div style="font-size:18px;font-weight:bold;color:${s.score === '-' ? '#888' : s.score >= 80 ? '#22c55e' : s.score >= 60 ? '#fbbf24' : '#ef4444'};">
                                                    ${s.score}
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('') : '<div style="color:#888;text-align:center;padding:20px;">暂无对比数据</div>'}
                    </div>
                </div>

                <div style="display:flex;gap:8px;">
                    <button onclick="novelShowEvaluationResult(novelState._lastEvaluation)" style="flex:1;background:#3b82f6;color:#fff;border:none;border-radius:8px;padding:12px;cursor:pointer;font-size:14px;">
                        📊 查看详细报告
                    </button>
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="flex:1;background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:8px;padding:12px;cursor:pointer;font-size:14px;">
                        关闭
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * 🆕 高亮显示章节中的特定文本
 */
function novelHighlightText(chapterIdx, text) {
    // 切换到该章节
    novelViewChapter(chapterIdx);

    // 关闭评估弹窗
    const modal = document.querySelector('div[style*="position:fixed"][style*="z-index:10000"]');
    if (modal) modal.remove();

    // 等待章节渲染完成后高亮
    setTimeout(() => {
        const contentDiv = document.getElementById('novelChapterContent');
        if (!contentDiv) return;

        const content = contentDiv.innerHTML;
        const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const highlightedContent = content.replace(
            new RegExp(escapedText, 'g'),
            `<mark style="background:#fbbf24;color:#000;padding:2px 4px;border-radius:2px;animation:pulse 1s ease-in-out 3;">$&</mark>`
        );

        contentDiv.innerHTML = highlightedContent;

        // 滚动到第一个高亮位置
        const firstMark = contentDiv.querySelector('mark');
        if (firstMark) {
            firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        showToast('已定位到重复内容');
    }, 300);
}

/**
 * 🆕 自动修复章节中的重复内容
 */
async function novelAutoFixRepetitions(idx) {
    const ch = novelState.chapters[idx];
    if (!ch || ch.status !== 'done') {
        showToast('章节不存在或未完成');
        return;
    }

    const evaluation = ch._evaluation || await novelEvaluateChapter(idx);
    if (evaluation.repetitions.length === 0) {
        showToast('该章节没有重复内容');
        return;
    }

    if (!confirm(`发现${evaluation.repetitions.length}处重复内容，确定要自动去重吗？\n\n将使用AI重写这些重复部分，保持故事连贯性。`)) {
        return;
    }

    // 关闭评估面板
    const modal = document.querySelector('div[style*="position:fixed"][style*="z-index:10000"]');
    if (modal) modal.remove();

    showToast('正在去除重复内容...');

    try {
        // 构建去重提示
        const repetitionList = evaluation.repetitions.map((r, i) =>
            `${i + 1}. "${r.content}" (${r.type}，与第${r.chapter}章重复)`
        ).join('\n');

        const fixPrompt = `请修改以下章节内容，去除重复部分并用新的表达替换：

原章节内容：
${ch.content}

需要去除/改写的重复内容：
${repetitionList}

要求：
1. 保持故事情节和人物性格一致
2. 用不同的表达方式替换重复内容
3. 保持章节字数不变（约${ch.content.length}字）
4. 确保修改后的内容自然流畅
5. 全文使用中文，严禁英文单词`;

        const newContent = await _novelLLM([
            { role: 'system', content: '你是专业小说编辑，擅长去除重复内容并保持故事连贯性。' },
            { role: 'user', content: fixPrompt }
        ], { maxTokens: 8192, temperature: 0.85, timeout: 120000 });

        // 更新章节
        ch.content = newContent;
        ch.wordCount = newContent.length;

        // 重新评估
        const newEvaluation = await novelEvaluateChapter(idx);
        ch._evaluation = newEvaluation;

        // 保存并刷新显示
        novelSaveCurrentProject();
        novelViewChapter(idx);

        showToast(`✅ 去重完成！重复内容从${evaluation.repetitions.length}处减少到${newEvaluation.repetitions.length}处`);

    } catch (err) {
        console.error('[novel] 自动去重失败:', err);
        showToast('去重失败: ' + err.message);
    }
}

/**
 * 🆕 自动优化AI痕迹词汇
 */
async function novelAutoFixAITraces(idx) {
    const ch = novelState.chapters[idx];
    if (!ch || ch.status !== 'done') {
        showToast('章节不存在或未完成');
        return;
    }

    const evaluation = ch._evaluation || await novelEvaluateChapter(idx);
    if (!evaluation.aiTraces || evaluation.aiTraces.length === 0) {
        showToast('该章节没有AI痕迹问题');
        return;
    }

    if (!confirm(`发现${evaluation.aiTraces.length}个AI痕迹词汇，确定要自动优化吗？\n\n将替换这些词汇为更自然的表达。`)) {
        return;
    }

    // 关闭评估面板
    const modal = document.querySelector('div[style*="position:fixed"][style*="z-index:10000"]');
    if (modal) modal.remove();

    showToast('正在优化AI痕迹...');

    try {
        const traceList = evaluation.aiTraces.map((t, i) =>
            `${i + 1}. 「${t.word}」出现${t.count}次（建议≤${t.limit}次）`
        ).join('\n');

        const fixPrompt = `请优化以下章节内容，减少AI痕迹词汇的使用：

原章节内容：
${ch.content}

需要减少使用的词汇：
${traceList}

要求：
1. 用更自然、多样化的表达替换这些词汇
2. 保持故事情节和人物性格不变
3. 保持章节字数（约${ch.content.length}字）
4. 确保修改后语言更加生动自然
5. 全文使用中文，严禁英文单词

示例替换：
- "仿佛" → "好像"、"似乎"、"如同"
- "不禁" → "忍不住"、直接描述动作
- "竟然" → "居然"、"没想到"、或省略`;

        const newContent = await _novelLLM([
            { role: 'system', content: '你是专业小说编辑，擅长优化文本表达，减少AI痕迹。' },
            { role: 'user', content: fixPrompt }
        ], { maxTokens: 8192, temperature: 0.85, timeout: 120000 });

        // 更新章节
        ch.content = newContent;
        ch.wordCount = newContent.length;

        // 重新评估
        const newEvaluation = await novelEvaluateChapter(idx);
        ch._evaluation = newEvaluation;

        // 保存并刷新显示
        novelSaveCurrentProject();
        novelViewChapter(idx);

        const oldTraceCount = evaluation.aiTraces.reduce((sum, t) => sum + t.count, 0);
        const newTraceCount = newEvaluation.aiTraces ? newEvaluation.aiTraces.reduce((sum, t) => sum + t.count, 0) : 0;

        showToast(`✅ 优化完成！AI痕迹词汇从${oldTraceCount}次减少到${newTraceCount}次`);

    } catch (err) {
        console.error('[novel] AI痕迹优化失败:', err);
        showToast('优化失败: ' + err.message);
    }
}


