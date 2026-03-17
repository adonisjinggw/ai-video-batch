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

    const totalCost = done.length * NOVEL_CHAPTER_COST;
    if (!confirm('将对全部 ' + done.length + ' 章进行去AI化润色，预计消耗 ' + totalCost + ' 胶片。是否继续？')) return;

    showToast('开始批量去AI化...');
    var successCount = 0;
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
