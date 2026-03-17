/**
 * 📖 novel-features.js — 长篇小说增强特性
 * 多项目管理、Supabase云保存、角色卡片、一致性校验、统计面板、导出增强、阅读模式
 */

// ==================== 7. 多项目管理 ====================
const NOVEL_PROJECTS_KEY = 'novel_projects';

function novelGetProjects() {
    try { return JSON.parse(localStorage.getItem(NOVEL_PROJECTS_KEY) || '[]'); }
    catch (e) { return []; }
}

function novelSaveProjectList(projects) {
    localStorage.setItem(NOVEL_PROJECTS_KEY, JSON.stringify(projects));
}

function novelNewProject() {
    const name = prompt('请输入新项目名称：');
    if (!name || !name.trim()) return;

    // 保存当前项目
    novelSaveCurrentProject();

    // 清空状态
    novelState.chapters = [];
    novelState.outline = '';
    novelState.totalWords = 0;
    novelState.totalCost = 0;
    novelState.summaries = {};
    novelState.characters = [];
    novelState.writing = false;
    novelState.paused = false;
    novelState.currentProjectId = Date.now().toString();

    document.getElementById('novelThemeInput').value = '';
    document.getElementById('novelOutlineBox').textContent = '';
    document.getElementById('novelOutlineSection').style.display = 'none';
    document.getElementById('novelProgress').style.display = 'none';
    document.getElementById('novelStats').style.display = 'none';
    document.getElementById('novelChapterList').innerHTML = '';
    document.getElementById('novelChapterContent').style.display = 'none';
    document.getElementById('novelExportActions').style.display = 'none';

    // 注册新项目
    const projects = novelGetProjects();
    projects.unshift({ id: novelState.currentProjectId, name: name.trim(), createdAt: Date.now(), updatedAt: Date.now() });
    novelSaveProjectList(projects);
    novelRefreshProjectSelect();
    showToast('✅ 新项目已创建');
}

function novelSaveCurrentProject() {
    if (!novelState.currentProjectId) {
        novelState.currentProjectId = Date.now().toString();
        const projects = novelGetProjects();
        const theme = document.getElementById('novelThemeInput').value || '未命名';
        projects.unshift({ id: novelState.currentProjectId, name: theme.substring(0, 20), createdAt: Date.now(), updatedAt: Date.now() });
        novelSaveProjectList(projects);
    }
    const saveData = Object.assign({}, novelState, {
        theme: document.getElementById('novelThemeInput').value,
        genre: document.getElementById('novelGenreSelect').value
    });
    localStorage.setItem('novel_project_' + novelState.currentProjectId, JSON.stringify(saveData));

    // 更新项目列表的 updatedAt
    const projects = novelGetProjects();
    const p = projects.find(pp => pp.id === novelState.currentProjectId);
    if (p) { p.updatedAt = Date.now(); novelSaveProjectList(projects); }
}

function novelLoadProject(id) {
    // 先保存当前
    if (novelState.currentProjectId && novelState.chapters.length > 0) {
        novelSaveCurrentProject();
    }

    const raw = localStorage.getItem('novel_project_' + id);
    if (!raw) { showToast('项目数据不存在'); return; }

    try {
        const data = JSON.parse(raw);
        Object.assign(novelState, data);
        novelState.writing = false;
        novelState.paused = false;
        novelState.currentProjectId = id;

        document.getElementById('novelThemeInput').value = data.theme || '';
        if (data.genre) document.getElementById('novelGenreSelect').value = data.genre;
        if (data.outline) {
            document.getElementById('novelOutlineBox').textContent = data.outline;
            document.getElementById('novelOutlineSection').style.display = '';
        }
        if (data.chapters && data.chapters.length > 0) {
            document.getElementById('novelProgress').style.display = '';
            document.getElementById('novelStats').style.display = '';
            _novelRenderChapterList();
            _novelUpdateProgress();
        }
        novelExtractCharacters();
        novelUpdateStatsDashboard();
        showToast('✅ 项目已加载');
    } catch (e) { showToast('加载失败: ' + e.message); }
}

function novelDeleteProject(id) {
    if (!confirm('确定删除此项目？数据不可恢复。')) return;
    localStorage.removeItem('novel_project_' + id);
    const projects = novelGetProjects().filter(p => p.id !== id);
    novelSaveProjectList(projects);
    novelRefreshProjectSelect();
    if (novelState.currentProjectId === id) {
        novelState.currentProjectId = null;
    }
    showToast('项目已删除');
}

function novelRefreshProjectSelect() {
    const sel = document.getElementById('novelProjectSelect');
    if (!sel) return;
    const projects = novelGetProjects();
    sel.innerHTML = '<option value="">-- 选择项目 --</option>' +
        projects.map(p => `<option value="${p.id}" ${p.id === novelState.currentProjectId ? 'selected' : ''}>${p.name} (${new Date(p.updatedAt).toLocaleDateString()})</option>`).join('');
}

function novelOnProjectSelect() {
    const sel = document.getElementById('novelProjectSelect');
    if (sel.value) novelLoadProject(sel.value);
}

// ==================== 8. Supabase 云保存（分块存储，支持大数据） ====================
var NOVEL_CLOUD_CHUNK_SIZE = 800000; // 每块最大800KB，避免超出请求限制

// 获取当前用户ID（兼容 writing.html 和 batch.js 上下文）
function _novelGetUserId() {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) return currentUser.id;
    return null;
}
async function _novelGetUserIdAsync() {
    var uid = _novelGetUserId();
    if (uid) return uid;
    if (typeof getCurrentUserId === 'function') return await getCurrentUserId();
    return null;
}

// 保存单条记录到 Supabase
async function _novelCloudSaveRecord(userId, prompt, metadata) {
    var resp = await fetch('/api/supabase-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'saveGenerationRecord',
            userId: userId,
            recordType: 'novel',
            contentUrl: '',
            prompt: prompt,
            model: 'novel-engine',
            cost: 0,
            metadata: metadata
        })
    });
    return await resp.json();
}

// ☁️ 按钮：通过 Web Share API 分享到百度网盘/夸克/微信等第三方云盘
async function novelCloudSave() {
    if ((!novelState.chapters || novelState.chapters.length === 0) && !novelState.outline) {
        showToast('暂无小说数据可保存'); return;
    }

    novelSaveCurrentProject();
    var saveData = Object.assign({}, novelState, {
        theme: document.getElementById('novelThemeInput').value,
        genre: document.getElementById('novelGenreSelect').value,
        _savedAt: new Date().toISOString(),
        _version: 'rollroll-novel-v1'
    });

    var json = JSON.stringify(saveData, null, 2);
    var done = novelState.chapters.filter(function (c) { return c.status === 'done'; }).length;
    var name = (saveData.theme || '小说').substring(0, 20).replace(/[\\/:*?"<>|]/g, '_');
    var fileName = name + '_' + done + 'ch_' + new Date().toISOString().slice(0, 10) + '.json';
    var sizeKB = (json.length / 1024).toFixed(0);

    // Web Share API：弹出手机原生分享面板，可选择百度网盘/夸克/微信文件等
    if (navigator.share && navigator.canShare) {
        try {
            var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            var file = new File([blob], fileName, { type: 'application/json' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: '小说存档 - ' + name,
                    text: name + '（' + done + '章，' + sizeKB + 'KB）'
                });
                showToast('☁️ 已分享到云盘（' + done + '章，' + sizeKB + 'KB）');
                // 分享成功后静默备份到平台云端
                _novelSupabaseSave(saveData).catch(function () { });
                return;
            }
        } catch (err) {
            if (err.name === 'AbortError') return; // 用户取消
            console.warn('[novel] Web Share失败:', err.message);
        }
    }

    // 不支持 Web Share API 时降级为平台云端保存
    showToast('☁️ 当前浏览器不支持分享到云盘，将保存到平台云端...');
    try {
        await _novelSupabaseSave(saveData);
        showToast('☁️ 已保存到平台云端（' + sizeKB + 'KB）');
    } catch (e) {
        showToast('保存失败: ' + e.message);
    }
}

// Supabase 平台云端保存（内部函数，支持分块）
async function _novelSupabaseSave(saveData) {
    var userId = await _novelGetUserIdAsync();
    if (!userId) throw new Error('未登录');

    var projectId = novelState.currentProjectId || ('novel_' + Date.now());
    var themeName = saveData.theme || '未命名小说';
    var doneCount = novelState.chapters.filter(function (c) { return c.status === 'done'; }).length;
    var fullJson = JSON.stringify(saveData);
    var totalSize = fullJson.length;

    if (totalSize <= NOVEL_CLOUD_CHUNK_SIZE) {
        var result = await _novelCloudSaveRecord(userId, themeName, {
            projectId: projectId,
            totalChapters: novelState.chapters.length,
            doneChapters: doneCount,
            totalWords: novelState.totalWords,
            chunkIndex: 0,
            chunkTotal: 1,
            novelData: fullJson
        });
        if (!result.success) throw new Error(result.error || result.message || '未知错误');
    } else {
        var chunks = [];
        for (var i = 0; i < totalSize; i += NOVEL_CLOUD_CHUNK_SIZE) {
            chunks.push(fullJson.substring(i, i + NOVEL_CLOUD_CHUNK_SIZE));
        }
        var ts = Date.now();
        for (var ci = 0; ci < chunks.length; ci++) {
            var chunkResult = await _novelCloudSaveRecord(userId, themeName + ' [' + (ci + 1) + '/' + chunks.length + ']', {
                projectId: projectId,
                totalChapters: novelState.chapters.length,
                doneChapters: doneCount,
                totalWords: novelState.totalWords,
                chunkIndex: ci,
                chunkTotal: chunks.length,
                chunkTimestamp: ts,
                novelData: chunks[ci]
            });
            if (!chunkResult.success) throw new Error('第' + (ci + 1) + '块失败');
        }
    }
}

// 云端加载（支持分块数据拼合）
async function novelCloudLoad() {
    var userId = await _novelGetUserIdAsync();
    if (!userId) { showToast('请先登录后才能加载云端数据'); return; }

    try {
        showToast('☁️ 正在从云端加载...');
        var resp = await fetch('/api/supabase-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'getGenerationRecords',
                userId: userId,
                recordType: 'novel',
                limit: 50
            })
        });
        var result = await resp.json();
        if (!result.success || !result.records || result.records.length === 0) {
            showToast('云端没有找到小说项目');
            return;
        }

        // 按 projectId 分组，支持分块拼合
        var projectMap = {};
        result.records.forEach(function (r) {
            if (!r.metadata || !r.metadata.novelData) return;
            var pid = r.metadata.projectId || r.id;
            if (!projectMap[pid]) {
                projectMap[pid] = {
                    id: pid,
                    name: (r.prompt || '未命名').replace(/\s*\[\d+\/\d+\]$/, ''),
                    chunks: [],
                    chunkTotal: r.metadata.chunkTotal || 1,
                    updatedAt: new Date(r.created_at).getTime(),
                    totalChapters: r.metadata.totalChapters || 0,
                    doneChapters: r.metadata.doneChapters || 0,
                    totalWords: r.metadata.totalWords || 0,
                    chunkTimestamp: r.metadata.chunkTimestamp || 0
                };
            }
            var proj = projectMap[pid];
            // 只保留最新一次保存的分块（按 chunkTimestamp 过滤）
            if (r.metadata.chunkTimestamp && r.metadata.chunkTimestamp > proj.chunkTimestamp) {
                proj.chunks = [];
                proj.chunkTotal = r.metadata.chunkTotal || 1;
                proj.chunkTimestamp = r.metadata.chunkTimestamp;
                proj.updatedAt = new Date(r.created_at).getTime();
                proj.totalChapters = r.metadata.totalChapters || 0;
                proj.doneChapters = r.metadata.doneChapters || 0;
                proj.totalWords = r.metadata.totalWords || 0;
            }
            var ts = r.metadata.chunkTimestamp || 0;
            if (ts === 0 || ts === proj.chunkTimestamp) {
                proj.chunks.push({ index: r.metadata.chunkIndex || 0, data: r.metadata.novelData });
            }
        });

        // 拼合分块数据，解析为完整项目
        var cloudProjects = [];
        Object.keys(projectMap).forEach(function (pid) {
            var proj = projectMap[pid];
            try {
                // 按 chunkIndex 排序拼合
                proj.chunks.sort(function (a, b) { return a.index - b.index; });
                var fullJson = proj.chunks.map(function (c) { return c.data; }).join('');
                var data = JSON.parse(fullJson);
                cloudProjects.push({
                    id: pid,
                    name: proj.name,
                    cloudData: data,
                    updatedAt: proj.updatedAt,
                    totalChapters: proj.totalChapters,
                    doneChapters: proj.doneChapters,
                    totalWords: proj.totalWords,
                    complete: proj.chunks.length >= proj.chunkTotal
                });
            } catch (e) {
                console.warn('[novel] 项目', pid, '数据解析失败（可能分块不完整）:', e.message);
            }
        });

        // 按更新时间排序
        cloudProjects.sort(function (a, b) { return b.updatedAt - a.updatedAt; });

        if (cloudProjects.length === 0) { showToast('云端数据解析失败'); return; }

        // 如果只有一个项目直接加载，多个则让用户选
        var target = cloudProjects[0];
        if (cloudProjects.length > 1) {
            var names = cloudProjects.map(function (p, i) {
                var flag = p.complete ? '' : ' ⚠️不完整';
                return (i + 1) + '. ' + p.name + ' (' + p.doneChapters + '/' + p.totalChapters + '章, ' + p.totalWords + '字' + flag + ')';
            }).join('\n');
            var choice = prompt('选择要加载的云端项目（输入序号）：\n' + names);
            var idx = parseInt(choice) - 1;
            if (isNaN(idx) || idx < 0 || idx >= cloudProjects.length) { showToast('已取消'); return; }
            target = cloudProjects[idx];
        }

        // 恢复到本地
        var data = target.cloudData;
        Object.assign(novelState, data);
        novelState.writing = false;
        novelState.paused = false;
        novelState.currentProjectId = target.id;

        // 同步到 localStorage
        novelSaveCurrentProject();

        // 更新项目列表
        var projects = novelGetProjects();
        if (!projects.find(function (p) { return p.id === target.id; })) {
            projects.unshift({ id: target.id, name: target.name, createdAt: target.updatedAt, updatedAt: target.updatedAt });
            novelSaveProjectList(projects);
        }

        // 刷新UI
        document.getElementById('novelThemeInput').value = data.theme || '';
        if (data.genre) document.getElementById('novelGenreSelect').value = data.genre;
        if (data.outline) {
            document.getElementById('novelOutlineBox').textContent = data.outline;
            document.getElementById('novelOutlineSection').style.display = '';
        }
        if (data.chapters && data.chapters.length > 0) {
            document.getElementById('novelProgress').style.display = '';
            document.getElementById('novelStats').style.display = '';
            _novelRenderChapterList();
            _novelUpdateProgress();
        }
        if (typeof novelRefreshProjectSelect === 'function') novelRefreshProjectSelect();
        if (typeof novelExtractCharacters === 'function') novelExtractCharacters();
        if (typeof novelUpdateStatsDashboard === 'function') novelUpdateStatsDashboard();
        showToast('☁️ 已从云端恢复: ' + target.name + (target.complete ? '' : ' ⚠️数据可能不完整'));
    } catch (e) { showToast('云端加载失败: ' + e.message); }
}

// ==================== 9. 角色卡片提取 ====================
function novelExtractCharacters() {
    const outline = novelState.outline || '';
    // 取每章前500字+末200字，确保覆盖所有章节而非截断
    const doneChapters = novelState.chapters.filter(c => c.content);
    let sampleText = outline + '\n';
    for (var ci = 0; ci < doneChapters.length; ci++) {
        var ct = doneChapters[ci].content || '';
        sampleText += ct.substring(0, 500) + (ct.length > 700 ? '\n...\n' + ct.slice(-200) : '') + '\n';
    }

    // 从大纲中提取角色（多种格式匹配）
    const chars = [];

    // 优先：提取【角色】段落中的 "- 名字：描述" 格式（LLM大纲标准输出）
    const charSectionMatch = sampleText.match(/【角色】([\s\S]*?)(?=【|$)/);
    if (charSectionMatch) {
        const charLines = charSectionMatch[1].split('\n');
        for (var li = 0; li < charLines.length; li++) {
            var cline = charLines[li].trim();
            // 匹配 "- 名字：描述" 或 "- 名字:描述" 或 "名字：描述"
            var cm = cline.match(/^[-\-·•*]?\s*([A-Za-z\u4e00-\u9fa5]{2,8})\s*[：:]\s*(.+)/);
            if (cm) {
                var cname = cm[1].replace(/[""「」]/g, '');
                var cdesc = cm[2].trim().substring(0, 60);
                if (cname.length >= 2 && !chars.find(function (c) { return c.name === cname; })) {
                    chars.push({ name: cname, desc: cdesc || '暂无描述' });
                }
            }
        }
    }

    // 补充：关键词模式匹配
    const charPatterns = [
        /[【\[]主角[】\]]\s*[:：]?\s*(.+)/g,
        /[【\[](?:女主|男主|配角|反派|boss)[】\]]\s*[:：]?\s*(.+)/g,
        /(?:主角|女主|男主|主人公|男一|女一|男二|女二)\s*[:：]\s*(.+)/g,
        /角色\d*\s*[:：]\s*(.+)/g,
        /(?:人物|角色)(?:设定|简介)?[：:]\s*(.+)/g,
    ];
    charPatterns.forEach(pat => {
        let m;
        while ((m = pat.exec(sampleText)) !== null) {
            const line = m[1].trim();
            const nameMatch = line.match(/^([^\s,，、（(\n]+)/);
            if (nameMatch) {
                const name = nameMatch[1].replace(/[""「」]/g, '');
                if (name.length >= 2 && name.length <= 8 && !chars.find(c => c.name === name)) {
                    chars.push({ name, desc: line.substring(name.length).replace(/^[,，、（(\s]+/, '').substring(0, 60).trim() || '暂无描述' });
                }
            }
        }
    });

    // 从正文提取高频角色名（对话动词前的人名）
    const nameFreq = {};
    const stopWords = ['他们', '她们', '我们', '自己', '大家', '所有', '这个', '那个', '一个', '什么',
        '不过', '只是', '如果', '但是', '因为', '所以', '然后', '于是', '虽然', '可是',
        '突然', '终于', '居然', '竟然', '果然', '忽然', '已经', '正在', '马上', '立刻',
        '对方', '众人', '旁边', '周围', '这时', '此时', '那时', '当时'];

    // 模式1：名字+对话动词
    const namePattern1 = /(?:^|[\s，。！？；：\n])([A-Za-z\u4e00-\u9fa5]{2,4})(?:说道|笑道|喊道|叹道|怒道|问道|答道|骂道|哭道|叫道|嘟囔|低声|高声|冷声|淡淡|沉声|急忙|连忙|赶紧|忽然|突然|缓缓|微微)?(?:说|道|喊|笑|叹|怒|问|答|叫|吼|哼)/g;
    var dm;
    while ((dm = namePattern1.exec(sampleText)) !== null) {
        var n = dm[1];
        if (!stopWords.includes(n)) nameFreq[n] = (nameFreq[n] || 0) + 1;
    }
    // 模式2："xxx"前的人名
    const namePattern2 = /([\u4e00-\u9fa5]{2,4})\s*[：:]\s*[「""]/g;
    while ((dm = namePattern2.exec(sampleText)) !== null) {
        var n2 = dm[1];
        if (!stopWords.includes(n2)) nameFreq[n2] = (nameFreq[n2] || 0) + 1;
    }
    // 模式3：对xxx说
    const namePattern3 = /对([\u4e00-\u9fa5]{2,4})(?:说|道|喊|问)/g;
    while ((dm = namePattern3.exec(sampleText)) !== null) {
        var n3 = dm[1];
        if (!stopWords.includes(n3)) nameFreq[n3] = (nameFreq[n3] || 0) + 1;
    }

    // 按频次排序取前12个
    Object.entries(nameFreq).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([name, freq]) => {
        if (!chars.find(c => c.name === name) && freq >= 2) {
            chars.push({ name, desc: `出现${freq}次` });
        }
    });

    novelState.characters = chars;
    _novelRenderCharCards();
    console.log('[novel] 角色提取完成:', chars.length, '个角色', chars.map(c => c.name).join(', '));
    return chars;
}

// ==================== 10. 剧情一致性校验 + 智能修复 ====================
// 缓存最近一次校验结果（结构化问题列表）
var _novelIssues = [];

async function novelCheckConsistency() {
    var doneChapters = [];
    for (var i = 0; i < novelState.chapters.length; i++) {
        if (novelState.chapters[i].status === 'done') doneChapters.push({ idx: i, ch: novelState.chapters[i] });
    }
    if (doneChapters.length < 3) { showToast('至少需要3章已完成内容才能校验'); return; }

    var reportEl = document.getElementById('novelConsistencyReport');
    reportEl.classList.add('show');
    reportEl.innerHTML = '<div class="issue-loading">🔄 正在深度分析剧情一致性...</div>';

    // 取每章前200字和末200字 + 角色名
    var brief = doneChapters.map(function (d) {
        var s = d.ch.content || '';
        var head = s.substring(0, 200);
        var tail = s.length > 400 ? s.slice(-200) : '';
        return '第' + (d.idx + 1) + '章「' + d.ch.title + '」:\n开头：' + head + '\n结尾：' + tail;
    }).join('\n---\n');

    var sysPrompt = '你是专业小说编辑。请检查以下各章节内容的一致性问题，包括：角色名字拼写不一致、时间线矛盾、地点描述前后矛盾、人物性格突变、重要物品/线索消失、称呼混乱等。\n\n'
        + '必须严格用以下JSON数组格式回复（不要任何其他内容）：\n'
        + '[{"chapter":章节号,"type":"问题类型","desc":"问题描述","fix":"修复建议"}]\n'
        + '如果没发现问题，返回空数组 []。\n'
        + '章节号为整数（从1开始），type只能是以下之一：name_inconsistent|timeline_conflict|location_conflict|personality_shift|item_lost|other';

    try {
        var result = await _novelLLM([
            { role: 'system', content: sysPrompt },
            { role: 'user', content: '/no_think\n请检查以下小说内容的一致性：\n\n' + brief }
        ], { maxTokens: 4096, temperature: 0.2 });

        // 解析JSON（容错处理）
        var issues = [];
        try {
            var jsonStr = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            // 找到第一个 [ 和最后一个 ]
            var startBracket = jsonStr.indexOf('[');
            var endBracket = jsonStr.lastIndexOf(']');
            if (startBracket >= 0 && endBracket > startBracket) {
                jsonStr = jsonStr.substring(startBracket, endBracket + 1);
            }
            issues = JSON.parse(jsonStr);
        } catch (parseErr) {
            // JSON解析失败，降级为纯文本展示
            console.warn('[novel] 一致性校验JSON解析失败, 降级为文本:', parseErr);
            reportEl.innerHTML = '<div class="issue-header"><span>🔍 校验报告</span></div>'
                + '<div class="issue-text">' + result.replace(/\n/g, '<br>') + '</div>';
            _novelIssues = [];
            return;
        }

        _novelIssues = Array.isArray(issues) ? issues : [];
        _novelRenderConsistencyReport(reportEl);
    } catch (e) {
        reportEl.innerHTML = '<span class="issue-warn">校验失败: ' + e.message + '</span>';
        _novelIssues = [];
    }
}

// 渲染一致性报告（带修复按钮）
function _novelRenderConsistencyReport(reportEl) {
    if (!reportEl) reportEl = document.getElementById('novelConsistencyReport');
    reportEl.classList.add('show');

    if (_novelIssues.length === 0) {
        reportEl.innerHTML = '<div class="issue-header"><span>🔍 校验报告</span></div>'
            + '<div class="issue-pass">✅ 未发现一致性问题，剧情连贯性良好！</div>';
        return;
    }

    var typeLabel = { name_inconsistent: '👤 名字不一致', timeline_conflict: '⏰ 时间线矛盾', location_conflict: '📍 地点矛盾', personality_shift: '🎭 性格突变', item_lost: '🔑 线索丢失', other: '⚠️ 其他' };
    var html = '<div class="issue-header"><span>🔍 发现 ' + _novelIssues.length + ' 个问题</span>'
        + '<button class="issue-fix-all-btn" onclick="novelFixAll()">🔧 一键修复全部</button></div>';

    for (var i = 0; i < _novelIssues.length; i++) {
        var issue = _novelIssues[i];
        var label = typeLabel[issue.type] || typeLabel.other;
        var statusCls = issue._fixed ? 'issue-card fixed' : 'issue-card';
        var statusIcon = issue._fixed ? '✅' : (issue._fixing ? '⏳' : '');
        html += '<div class="' + statusCls + '" data-issue-idx="' + i + '">'
            + '<div class="issue-card-head"><span class="issue-type">' + label + '</span>'
            + '<span class="issue-chapter">第' + issue.chapter + '章</span></div>'
            + '<div class="issue-desc">' + (issue.desc || '') + '</div>'
            + '<div class="issue-fix-row">'
            + '<span class="issue-fix-hint">💡 ' + (issue.fix || '建议人工检查') + '</span>'
            + (issue._fixed ? '<span class="issue-status-ok">✅ 已修复</span>'
                : issue._fixing ? '<span class="issue-status-ing">⏳ 修复中...</span>'
                    : '<button class="issue-fix-btn" onclick="novelSmartFix(' + i + ')">🔧 智能修复</button>')
            + '</div></div>';
    }
    reportEl.innerHTML = html;
}

// 单条智能修复
async function novelSmartFix(issueIdx) {
    var issue = _novelIssues[issueIdx];
    if (!issue || issue._fixed || issue._fixing) return;

    var chIdx = (issue.chapter || 1) - 1;
    var ch = novelState.chapters[chIdx];
    if (!ch || ch.status !== 'done') {
        showToast('第' + issue.chapter + '章尚未完成，无法修复');
        return;
    }

    // 胶片检查
    if (userQuota < NOVEL_CHAPTER_COST) {
        showToast('胶片不足，修复需要 ' + NOVEL_CHAPTER_COST + ' 胶片');
        return;
    }

    issue._fixing = true;
    _novelRenderConsistencyReport();

    var genre = document.getElementById('novelGenreSelect').value;
    var fixInstruction = '问题类型：' + issue.type + '\n问题描述：' + issue.desc + '\n修复建议：' + issue.fix;

    // 构建上下文：前后章内容辅助修复
    var contextParts = [];
    if (chIdx > 0 && novelState.chapters[chIdx - 1].content) {
        contextParts.push('【前一章(第' + chIdx + '章)末尾】\n' + novelState.chapters[chIdx - 1].content.slice(-500));
    }
    if (chIdx < novelState.chapters.length - 1 && novelState.chapters[chIdx + 1] && novelState.chapters[chIdx + 1].content) {
        contextParts.push('【后一章(第' + (chIdx + 2) + '章)开头】\n' + novelState.chapters[chIdx + 1].content.substring(0, 500));
    }
    var contextStr = contextParts.length > 0 ? '\n\n参考上下文：\n' + contextParts.join('\n---\n') : '';

    try {
        ch.status = 'generating';
        _novelRenderChapterList();

        var result = await _novelLLM([
            { role: 'system', content: '你是' + genre + '小说作家兼编辑。你需要修复章节中的一致性问题，同时保持原文风格和情节不变。只修改有问题的部分，其他内容尽量保持原样。直接输出修改后的完整章节正文。' },
            { role: 'user', content: '/no_think\n以下是需要修复的第' + issue.chapter + '章「' + ch.title + '」原文：\n' + ch.content + contextStr + '\n\n需要修复的问题：\n' + fixInstruction + '\n\n请输出修复后的完整章节正文（保持原文风格和篇幅，只修正上述问题）：' }
        ], { maxTokens: 16384, temperature: 0.5 });

        novelState.totalWords -= (ch.wordCount || 0);
        ch.content = result;
        ch.wordCount = result.length;
        ch.status = 'done';
        ch.fixedAt = Date.now();
        novelState.totalWords += ch.wordCount;
        novelState.totalCost += NOVEL_CHAPTER_COST;
        _novelSaveState();

        issue._fixing = false;
        issue._fixed = true;
        showToast('✅ 第' + issue.chapter + '章已智能修复');
    } catch (e) {
        ch.status = 'done'; // 恢复原状态
        issue._fixing = false;
        showToast('修复失败: ' + e.message);
    }

    _novelRenderChapterList();
    _novelUpdateProgress();
    _novelRenderConsistencyReport();
    novelUpdateStatsDashboard();
}

// 批量修复全部问题
async function novelFixAll() {
    var unfixed = _novelIssues.filter(function (iss) { return !iss._fixed && !iss._fixing; });
    if (unfixed.length === 0) { showToast('没有需要修复的问题'); return; }

    var totalCost = unfixed.length * NOVEL_CHAPTER_COST;
    if (userQuota < totalCost) {
        showToast('胶片不足，修复 ' + unfixed.length + ' 个问题需要 ' + totalCost + ' 胶片');
        return;
    }

    if (!confirm('将自动修复 ' + unfixed.length + ' 个问题，预计消耗 ' + totalCost + ' 胶片，确认？')) return;

    for (var i = 0; i < _novelIssues.length; i++) {
        if (_novelIssues[i]._fixed || _novelIssues[i]._fixing) continue;
        await novelSmartFix(i);
        // 短暂延迟避免API压力
        await new Promise(function (r) { setTimeout(r, 1000); });
    }
    showToast('✅ 批量修复完成');
}

// ==================== 11. 统计面板 ====================
function novelUpdateStatsDashboard() {
    const dash = document.getElementById('novelStatsDashboard');
    if (!dash) return;

    const done = novelState.chapters.filter(c => c.status === 'done');
    if (done.length === 0) { dash.classList.remove('show'); return; }
    dash.classList.add('show');

    const totalWords = novelState.totalWords || 0;
    const avgWords = done.length > 0 ? Math.round(totalWords / done.length) : 0;
    const totalCost = novelState.totalCost || 0;
    const progress = novelState.chapters.length > 0 ? Math.round(done.length / novelState.chapters.length * 100) : 0;

    // 计算预计剩余
    const remaining = novelState.chapters.length - done.length;
    const estCost = remaining * NOVEL_CHAPTER_COST;

    dash.innerHTML = `
        <div class="novel-stat-card"><div class="stat-value">${totalWords.toLocaleString()}</div><div class="stat-label">总字数</div></div>
        <div class="novel-stat-card"><div class="stat-value">${avgWords.toLocaleString()}</div><div class="stat-label">平均每章字数</div></div>
        <div class="novel-stat-card"><div class="stat-value">${progress}%</div><div class="stat-label">完成进度 (${done.length}/${novelState.chapters.length})</div></div>
        <div class="novel-stat-card"><div class="stat-value">${totalCost}</div><div class="stat-label">已消耗胶片 (余≈${estCost})</div></div>
    `;
}

// ==================== 12. 导出增强 ====================
function novelDownloadEpubSimple() {
    // 简化版 EPUB = XHTML 打包
    const done = novelState.chapters.filter(c => c.status === 'done');
    if (done.length === 0) { showToast('没有已完成章节'); return; }

    const theme = document.getElementById('novelThemeInput').value || '未命名小说';
    // 生成一个完整的 HTML 文件作为简易电子书
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${theme}</title>
<style>body{font-family:serif;max-width:700px;margin:0 auto;padding:20px;line-height:2;color:#333}
h1{text-align:center;margin:40px 0}h2{margin:30px 0 15px;page-break-before:always}
p{text-indent:2em;margin:0.5em 0}</style></head><body>
<h1>${theme}</h1>`;

    done.forEach((ch, i) => {
        html += `<h2>第${i + 1}章 ${ch.title}</h2>`;
        const paragraphs = (ch.content || '').split(/\n+/).filter(Boolean);
        paragraphs.forEach(p => { html += `<p>${p.replace(/</g, '&lt;')}</p>`; });
    });

    html += `<hr><p style="text-align:center;color:#999">由 RollRoll AI 生成 · ${new Date().toLocaleDateString()}</p></body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${theme}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('📖 电子书已下载（HTML格式）');
}

function novelDownloadMarkdown() {
    const done = novelState.chapters.filter(c => c.status === 'done');
    if (done.length === 0) { showToast('没有已完成章节'); return; }

    const theme = document.getElementById('novelThemeInput').value || '未命名小说';
    let md = `# ${theme}\n\n`;
    md += `> 由 RollRoll AI 生成 · ${new Date().toLocaleDateString()}\n\n---\n\n`;

    done.forEach((ch, i) => {
        md += `## 第${i + 1}章 ${ch.title}\n\n${ch.content || ''}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${theme}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('📝 Markdown 已下载');
}

// ==================== 13. 发布到小说平台 ====================
const NOVEL_PLATFORMS = [
    { id: 'fanqie', name: '番茄小说', icon: '🍅', url: 'https://fanqienovel.com/writer/zone/', appScheme: 'snssdk1128://', appLink: 'https://fanqienovel.com/writer/zone/', desc: '字节旗下，流量大，新人友好', format: 'txt' },
    { id: 'qimao', name: '七猫中文网', icon: '🐱', url: 'https://www.qimao.com', appScheme: 'qimao://', appLink: 'https://www.qimao.com', desc: '免费阅读平台，签约门槛低', format: 'txt' },
    { id: 'qidian', name: '起点/阅文', icon: '📖', url: 'https://write.qq.com/', appScheme: 'qidian://', appLink: 'https://write.qq.com/', desc: '阅文作家专区，网文龙头', format: 'txt' },
    { id: 'feilu', name: '飞卢小说', icon: '🦅', url: 'https://b.faloo.com/', appScheme: 'faloo://', appLink: 'https://b.faloo.com/', desc: '同人/系统文热门平台', format: 'txt' },
    { id: 'zongheng', name: '纵横中文网', icon: '📚', url: 'https://www.zongheng.com', appScheme: 'zongheng://', appLink: 'https://www.zongheng.com', desc: '老牌网文平台', format: 'txt' },
    { id: 'ciweimao', name: '刺猬猫', icon: '🦔', url: 'https://www.ciweimao.com', appScheme: 'ciweimao://', appLink: 'https://www.ciweimao.com', desc: '二次元/轻小说平台', format: 'txt' },
    { id: 'tadu', name: '塔读文学', icon: '📕', url: 'https://www.tadu.com', appScheme: 'tadu://', appLink: 'https://www.tadu.com', desc: '男频小说平台', format: 'txt' },
    { id: 'shuqi', name: '书旗小说', icon: '📗', url: 'https://www.shuqi.com', appScheme: 'shuqi://', appLink: 'https://www.shuqi.com', desc: '阿里旗下小说平台', format: 'txt' }
];

function novelShowPublishPanel() {
    const done = novelState.chapters.filter(c => c.status === 'done');
    if (done.length === 0) { showToast('没有已完成章节，请先完成写作'); return; }

    const theme = document.getElementById('novelThemeInput').value || '未命名小说';
    const genre = document.getElementById('novelGenreSelect')?.value || '';
    const totalWords = done.reduce((s, c) => s + (c.wordCount || 0), 0);

    let html = `<div class="novel-publish-overlay" id="novelPublishOverlay">
        <div class="novel-publish-panel">
            <div class="publish-header">
                <h3>📤 发布到小说平台</h3>
                <button onclick="novelClosePublish()" class="publish-close">✕</button>
            </div>
            <div class="publish-info">
                <b>${theme}</b> · ${genre} · ${done.length}章 · ${totalWords.toLocaleString()}字
            </div>
            <div class="publish-steps">
                <div class="publish-step"><span class="step-num">1</span> 选择平台并打开作者后台</div>
                <div class="publish-step"><span class="step-num">2</span> 在平台创建新书并填写书名、简介</div>
                <div class="publish-step"><span class="step-num">3</span> 逐章复制粘贴内容（或下载TXT后上传）</div>
            </div>
            <div class="publish-actions-top">
                <button onclick="novelPublishCopyAll()" class="publish-btn-export">📋 复制全书</button>
                <button onclick="novelPublishDownloadTxt()" class="publish-btn-export">💾 下载TXT</button>
                <button onclick="novelPublishCopyOutline()" class="publish-btn-export">📝 复制简介</button>
            </div>
            <div class="publish-platform-list">`;

    NOVEL_PLATFORMS.forEach(p => {
        html += `<div class="publish-platform-item" onclick="novelPublishTo('${p.id}')">
            <span class="platform-icon">${p.icon}</span>
            <div class="platform-info">
                <div class="platform-name">${p.name}</div>
                <div class="platform-desc">${p.desc}</div>
            </div>
            <span class="platform-arrow">→</span>
        </div>`;
    });

    html += `</div>
            <div class="publish-chapter-tools">
                <div class="publish-section-title">📖 逐章发布（复制章节并跳转平台）</div>
                <div class="publish-target-select">
                    <label>目标平台：</label>
                    <select id="publishTargetPlatform">`;
    NOVEL_PLATFORMS.forEach((p, idx) => {
        html += `<option value="${p.id}" ${idx === 0 ? 'selected' : ''}>${p.icon} ${p.name}</option>`;
    });
    html += `</select></div>
                <div class="publish-chapter-list" id="publishChapterList">`;
    done.forEach((ch, i) => {
        html += `<div class="publish-ch-item">
            <span>第${i + 1}章 ${ch.title} (${(ch.wordCount || 0).toLocaleString()}字)</span>
            <div class="publish-ch-btns">
                <button onclick="novelPublishCopyChapter(${i})" title="仅复制">📋</button>
                <button onclick="novelPublishChapterTo(${i})" title="复制并跳转平台" class="publish-ch-go">📋→</button>
            </div>
        </div>`;
    });
    html += `</div></div></div></div>`;

    // 移除旧面板
    var old = document.getElementById('novelPublishOverlay');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
}

function novelClosePublish() {
    var el = document.getElementById('novelPublishOverlay');
    if (el) el.remove();
}

function novelPublishTo(platformId) {
    var p = NOVEL_PLATFORMS.find(x => x.id === platformId);
    if (!p) return;

    var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && p.appScheme) {
        // 移动端：先尝试唤起 APP
        showToast('正在尝试打开 ' + p.name + ' APP...');
        var startTime = Date.now();
        var hidden = false;

        // 监听页面隐藏（说明 APP 被成功唤起）
        var onVisChange = function () {
            if (document.hidden || document.webkitHidden) hidden = true;
        };
        document.addEventListener('visibilitychange', onVisChange);

        // 尝试通过 iframe 唤起 APP scheme
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = p.appScheme;
        document.body.appendChild(iframe);

        // 2秒后检查：如果页面没有隐藏，说明 APP 未安装，降级到网页
        setTimeout(function () {
            document.removeEventListener('visibilitychange', onVisChange);
            document.body.removeChild(iframe);
            if (!hidden && Date.now() - startTime < 3000) {
                showToast('未检测到 APP，正在打开网页版...');
                window.open(p.url, '_blank');
            }
        }, 2000);
    } else {
        // PC端直接打开网页
        showToast('正在打开 ' + p.name + ' 作者后台...');
        window.open(p.url, '_blank');
    }
}

function novelPublishCopyAll() {
    var done = novelState.chapters.filter(c => c.status === 'done');
    var theme = document.getElementById('novelThemeInput').value || '未命名小说';
    var text = done.map((c, i) => `第${i + 1}章 ${c.title}\n\n${c.content}`).join('\n\n' + '='.repeat(40) + '\n\n');
    navigator.clipboard.writeText(text).then(() => showToast('已复制全书内容（' + done.length + '章）'));
}

function novelPublishDownloadTxt() {
    var done = novelState.chapters.filter(c => c.status === 'done');
    var theme = document.getElementById('novelThemeInput').value || '未命名小说';
    var text = done.map((c, i) => `第${i + 1}章 ${c.title}\n\n${c.content}`).join('\n\n\n');
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = theme + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('已下载 ' + theme + '.txt');
}

function novelPublishCopyOutline() {
    var theme = document.getElementById('novelThemeInput').value || '未命名小说';
    var genre = document.getElementById('novelGenreSelect')?.value || '';
    var outline = novelState.outline || '';
    // 提取简介部分（世界观+角色）
    var briefEnd = outline.indexOf('【章节大纲】');
    var brief = briefEnd > 0 ? outline.substring(0, briefEnd).trim() : outline.substring(0, 500);
    var done = novelState.chapters.filter(c => c.status === 'done');
    var totalWords = done.reduce((s, c) => s + (c.wordCount || 0), 0);
    var text = `书名：${theme}\n类型：${genre}\n字数：${totalWords.toLocaleString()}字 / ${done.length}章\n\n${brief}`;
    navigator.clipboard.writeText(text).then(() => showToast('已复制书籍简介'));
}

function novelPublishCopyChapter(idx) {
    var done = novelState.chapters.filter(c => c.status === 'done');
    var ch = done[idx];
    if (!ch) return;
    var text = `第${idx + 1}章 ${ch.title}\n\n${ch.content}`;
    navigator.clipboard.writeText(text).then(() => showToast(`已复制第${idx + 1}章`));
}

function novelPublishChapterTo(idx) {
    var done = novelState.chapters.filter(c => c.status === 'done');
    var ch = done[idx];
    if (!ch) return;
    var text = `第${idx + 1}章 ${ch.title}\n\n${ch.content}`;
    navigator.clipboard.writeText(text).then(function () {
        showToast(`已复制第${idx + 1}章，正在跳转...`);
        var sel = document.getElementById('publishTargetPlatform');
        var platformId = sel ? sel.value : 'fanqie';
        novelPublishTo(platformId);
    });
}

// ==================== 13b. 角色图片生成（人物介绍卡+角色设计表风格） ====================
async function novelGenerateCharImage(charIdx) {
    var chars = novelState.characters || [];
    var ch = chars[charIdx];
    if (!ch || ch._generating) return;

    if (typeof callBanana2ImageAPI !== 'function') {
        showToast('图片生成API未加载，请刷新页面');
        return;
    }

    ch._generating = true;
    _novelRenderCharacterCards();

    var genre = '';
    try { genre = document.getElementById('novelGenreSelect').value; } catch (e) { }
    var theme = '';
    try { theme = document.getElementById('novelThemeInput').value; } catch (e) { }

    // 升级版 prompt — 参考人物介绍卡+角色设计表组合风格，全中文
    var prompt = '专业角色设计图(character design sheet)，全部文字必须使用中文标注。\n' +
        '大标题：「人物介绍」，风格：' + (genre || '奇幻') + '。\n' +
        '角色名：「' + ch.name + '」\n' +
        '角色设定：' + ch.desc + '\n' +
        '画面布局要求：\n' +
        '- 中央主图区：角色正面全身精致立绘（占画面40%），旁边半身特写头像\n' +
        '- 三视图区：正面、侧面、背面三个小图，下方中文标注「正面」「侧面」「背面」\n' +
        '- 表情变化区：6种表情小图（默认、开心、愤怒、悲伤、惊讶、冷酷），每个下方中文标注\n' +
        '- 动作姿态区：3-4种代表性动作，下方中文标注动作名称\n' +
        '- 角色信息面板：中文标注角色名、身份、性格特征、代表台词\n' +
        '- 服装细节：箭头指向关键服饰配件并用中文标注\n' +
        '整体风格：浅色米色复古纸张背景，中式装饰边框，高质量动漫插画，人物比例准确，' +
        '配色精致，排版专业，适合小说角色百科';

    try {
        var imageUrl = await callBanana2ImageAPI(prompt, {
            model: 'gemini-3.1-flash-image-preview-4k',
            aspectRatio: '3:4'
        });
        ch.imageUrl = imageUrl;
        ch._generating = false;
        _novelRenderCharacterCards();
        // 持久化保存到 localStorage
        try { novelSaveCurrentProject(); } catch (e) { }
        showToast('✅ ' + ch.name + ' 角色设计图已生成');
    } catch (e) {
        ch._generating = false;
        _novelRenderCharacterCards();
        showToast('角色图生成失败: ' + e.message);
    }
}

// 一键生成全部角色图
async function novelGenerateAllCharImages() {
    var chars = novelState.characters || [];
    if (chars.length === 0) { showToast('没有角色可生成'); return; }
    var toGen = chars.filter(function (c) { return !c.imageUrl && !c._generating; });
    if (toGen.length === 0) { showToast('所有角色图都已生成'); return; }
    if (!confirm('将为 ' + toGen.length + ' 个角色生成设计图，每个消耗约5胶片，确认？')) return;
    showToast('🎨 开始批量生成 ' + toGen.length + ' 个角色图...');
    for (var i = 0; i < chars.length; i++) {
        if (chars[i].imageUrl || chars[i]._generating) continue;
        await novelGenerateCharImage(i);
        if (i < chars.length - 1) await new Promise(function (r) { setTimeout(r, 1500); });
    }
    showToast('✅ 角色图批量生成完成');
}

// ==================== 13c. 章节智能配音（分段+智能音色+记忆） ====================

// TTS音色配置（使用DubbingX真实音色）
let NOVEL_TTS_VOICES = [
    // 默认中文音色（DubbingX常用音色）
    { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (女声-中文)', engine: 'dubbingx', language: 'zh' },
    { id: 'zh-CN-YunxiNeural', label: '云希 (男声-中文)', engine: 'dubbingx', language: 'zh' },
    { id: 'zh-CN-YunyangNeural', label: '云扬 (男声-中文)', engine: 'dubbingx', language: 'zh' },
    { id: 'zh-CN-XiaoyiNeural', label: '晓伊 (女声-中文)', engine: 'dubbingx', language: 'zh' },
    { id: 'zh-CN-YunjianNeural', label: '云健 (男声-中文)', engine: 'dubbingx', language: 'zh' },
    { id: 'zh-CN-XiaochenNeural', label: '晓辰 (女声-中文)', engine: 'dubbingx', language: 'zh' },
    // 英语音色
    { id: 'en-US-JennyNeural', label: 'Jenny (女声-英语)', engine: 'dubbingx', language: 'en' },
    { id: 'en-US-GuyNeural', label: 'Guy (男声-英语)', engine: 'dubbingx', language: 'en' },
    { id: 'en-US-AriaNeural', label: 'Aria (女声-英语)', engine: 'dubbingx', language: 'en' },
    { id: 'en-US-DavisNeural', label: 'Davis (男声-英语)', engine: 'dubbingx', language: 'en' },
    // 日语音色
    { id: 'ja-JP-NanamiNeural', label: 'Nanami (女声-日语)', engine: 'dubbingx', language: 'ja' },
    { id: 'ja-JP-KeitaNeural', label: 'Keita (男声-日语)', engine: 'dubbingx', language: 'ja' },
    // 韩语音色
    { id: 'ko-KO-SunHiNeural', label: 'SunHi (女声-韩语)', engine: 'dubbingx', language: 'ko' },
    { id: 'ko-KO-InJoonNeural', label: 'InJoon (男声-韩语)', engine: 'dubbingx', language: 'ko' },
    // 西班牙语音色
    { id: 'es-ES-ElviraNeural', label: 'Elvira (女声-西班牙语)', engine: 'dubbingx', language: 'es' },
    { id: 'es-ES-AlvaroNeural', label: 'Alvaro (男声-西班牙语)', engine: 'dubbingx', language: 'es' }
];

// 智能检测适合的配音音色（根据角色性别+小说题材）
function _novelDetectChapterVoice() {
    if (novelState._voicePrefs && novelState._voicePrefs.voiceName) {
        return novelState._voicePrefs;
    }
    var chars = novelState.characters || [];
    var genre = '';
    try { genre = document.getElementById('novelGenreSelect').value; } catch (e) { }
    var femaleRe = /女|母|姐|妹|娘|媳|嫂|婆|公主|皇后|夫人|小姐|女孩|女子|仙子|姑娘|闺|妃/;
    var maleRe = /男|父|兄|弟|王|侯|将|帅|先生|少年|少侠|大人|老爷|公子|世子|殿下/;
    var fScore = 0, mScore = 0;
    chars.forEach(function (c) {
        var d = (c.name || '') + (c.desc || '');
        if (femaleRe.test(d)) fScore++;
        if (maleRe.test(d)) mScore++;
    });
    var voiceName = 'Kore';
    if (/悬疑|科幻|军事/.test(genre)) voiceName = mScore >= fScore ? 'Fenrir' : 'Kore';
    else if (/言情|古风|宫斗/.test(genre)) voiceName = fScore >= mScore ? 'Aoede' : 'Zephyr';
    else if (/玄幻|仙侠|武侠/.test(genre)) voiceName = mScore >= fScore ? 'Charon' : 'Kore';
    else if (/都市|现代|青春/.test(genre)) voiceName = mScore >= fScore ? 'Zephyr' : 'Leda';
    else voiceName = mScore > fScore ? 'Charon' : 'Kore';
    return { engine: 'gemini', voiceName: voiceName };
}

// 长文本按句末智能分段（避免单段过长导致500超时/响应超限）
function _novelSplitTextForTTS(text, maxChars) {
    if (!text || text.length <= maxChars) return [text];
    var chunks = [];
    var remaining = text;
    while (remaining.length > 0) {
        if (remaining.length <= maxChars) { chunks.push(remaining); break; }
        var cutAt = maxChars;
        var searchStart = Math.max(0, maxChars - 100);
        var slice = remaining.substring(searchStart, maxChars);
        var bestBreak = -1;
        ['。', '！', '？', '\n', '；', '……', '——', '」', '"'].forEach(function (bp) {
            var pos = slice.lastIndexOf(bp);
            if (pos > bestBreak) bestBreak = pos;
        });
        if (bestBreak >= 0) cutAt = searchStart + bestBreak + 1;
        chunks.push(remaining.substring(0, cutAt));
        remaining = remaining.substring(cutAt);
    }
    return chunks;
}

// 音色选择弹窗
function novelShowVoiceSelector(callback) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
    var panel = document.createElement('div');
    panel.style.cssText = 'background:#1a1a2e;border-radius:16px;padding:20px;width:90%;max-width:360px;max-height:80vh;overflow-y:auto;';
    panel.innerHTML = '<div style="font-size:16px;font-weight:bold;color:#fff;margin-bottom:12px;">🎤 选择配音音色</div>';
    var currentVoice = (novelState._voicePrefs && novelState._voicePrefs.voiceName) || '';
    NOVEL_TTS_VOICES.forEach(function (v) {
        var sel = v.id === currentVoice;
        var btn = document.createElement('button');
        btn.style.cssText = 'display:block;width:100%;padding:12px;margin:6px 0;border-radius:10px;border:2px solid ' + (sel ? '#6c5ce7' : '#333') + ';background:' + (sel ? '#2d2b55' : '#222') + ';color:#fff;text-align:left;cursor:pointer;font-size:14px;';
        btn.innerHTML = '<div>' + (sel ? '✅ ' : '') + '<b>' + v.label + '</b></div><div style="font-size:12px;color:#888;margin-top:2px;">' + v.style + '</div>';
        btn.onclick = function () {
            novelState._voicePrefs = { engine: 'gemini', voiceName: v.id };
            try { novelSaveCurrentProject(); } catch (e) { }
            document.body.removeChild(overlay);
            showToast('已选择音色：' + v.label);
            if (callback) callback(novelState._voicePrefs);
        };
        // 移动端触摸
        btn.addEventListener('touchend', function (e) { e.preventDefault(); btn.click(); });
        panel.appendChild(btn);
    });
    var cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'display:block;width:100%;padding:10px;margin-top:10px;border-radius:8px;border:none;background:#444;color:#aaa;cursor:pointer;font-size:14px;';
    cancelBtn.textContent = '取消';
    cancelBtn.onclick = function () { document.body.removeChild(overlay); };
    panel.appendChild(cancelBtn);
    overlay.appendChild(panel);
    overlay.onclick = function (e) { if (e.target === overlay) document.body.removeChild(overlay); };
    document.body.appendChild(overlay);
}

// 连续播放多段配音
var _novelAudioPlaying = false;
async function novelPlayAllSegments(chIdx) {
    if (_novelAudioPlaying) { _novelAudioPlaying = false; showToast('⏹ 已停止播放'); return; }
    var ch = novelState.chapters[chIdx];
    if (!ch) return;
    var segments = ch._audioSegments || (ch._audioUrl ? [ch._audioUrl] : []);
    if (segments.length === 0) { showToast('暂无配音'); return; }
    _novelAudioPlaying = true;
    showToast('▶️ 连续播放第' + (chIdx + 1) + '章（' + segments.length + '段）');
    for (var i = 0; i < segments.length; i++) {
        if (!_novelAudioPlaying) break;
        var audio = new Audio(segments[i]);
        await new Promise(function (resolve) {
            audio.onended = resolve;
            audio.onerror = function () { console.warn('段' + (i + 1) + '播放失败'); resolve(); };
            audio.play().catch(resolve);
        });
    }
    _novelAudioPlaying = false;
}

async function novelTTSChapter(idx) {
    var ch = novelState.chapters[idx];
    if (!ch || ch.status !== 'done' || ch._ttsLoading) return;

    if (typeof callTTSAPI !== 'function') {
        showToast('配音API未加载，请刷新页面');
        return;
    }

    var text = (ch.content || '');
    if (!text) { showToast('章节内容为空'); return; }

    // 智能检测音色（首次自动检测并保存，后续复用）
    var voiceConfig = _novelDetectChapterVoice();
    if (!novelState._voicePrefs || !novelState._voicePrefs.voiceName) {
        novelState._voicePrefs = voiceConfig;
        try { novelSaveCurrentProject(); } catch (e) { }
        var autoV = NOVEL_TTS_VOICES.find(function (v) { return v.id === voiceConfig.voiceName; });
        showToast('🎤 智能选择音色：' + (autoV ? autoV.label : voiceConfig.voiceName));
    }
    voiceConfig = novelState._voicePrefs;

    ch._ttsLoading = true;
    _novelRenderChapterList();

    // 分段处理：每段最多500字（避免长文本超时/响应体过大触发500）
    var chunks = _novelSplitTextForTTS(text, 500);
    showToast('🎤 第' + (idx + 1) + '章配音中（' + chunks.length + '段，音色：' + voiceConfig.voiceName + '）');

    try {
        var audioResults = [];
        for (var i = 0; i < chunks.length; i++) {
            if (chunks.length > 1) {
                showToast('🎤 配音进度 ' + (i + 1) + '/' + chunks.length);
            }
            var audioUrl = await callTTSAPI(chunks[i], {
                engine: voiceConfig.engine || 'gemini',
                voiceName: voiceConfig.voiceName || 'Kore',
                voiceId: voiceConfig.voiceId
            });
            if (audioUrl) audioResults.push(audioUrl);
            // 段间间隔，避免并发限制
            if (i < chunks.length - 1) await new Promise(function (r) { setTimeout(r, 800); });
        }

        if (audioResults.length === 0) throw new Error('未生成任何音频');

        ch._audioUrl = audioResults[0];
        ch._audioSegments = audioResults.length > 1 ? audioResults : null;
        ch._ttsVoice = voiceConfig;
        ch._ttsLoading = false;
        _novelRenderChapterList();
        try { novelSaveCurrentProject(); } catch (e) { }
        showToast('✅ 第' + (idx + 1) + '章配音完成（' + audioResults.length + '段，音色：' + voiceConfig.voiceName + '）');
    } catch (e) {
        ch._ttsLoading = false;
        _novelRenderChapterList();
        showToast('配音失败: ' + e.message);
    }
}

// ==================== 13c2. 场景图生成 ====================
async function novelGenerateSceneImage(chapterIdx) {
    var ch = novelState.chapters[chapterIdx];
    if (!ch || ch.status !== 'done' || ch._sceneGenerating) return;

    if (typeof callBanana2ImageAPI !== 'function') {
        showToast('图片生成API未加载，请刷新页面');
        return;
    }

    ch._sceneGenerating = true;
    _novelRenderChapterList();

    var genre = '';
    try { genre = document.getElementById('novelGenreSelect').value; } catch (e) { }
    var title = ch.title || '第' + (chapterIdx + 1) + '章';
    // 从章节内容提取场景关键词（取前300字的环境描写）
    var content = (ch.content || '').substring(0, 300);

    var prompt = '小说场景插画，电影级概念艺术，' + (genre || '奇幻') + '风格。\n' +
        '章节：「' + title + '」\n' +
        '场景描写：' + content + '\n' +
        '画面要求：宏大场景氛围图，电影级光影构图，环境渲染细腻，' +
        '画面右下角小字白色标注「' + title + '」，' +
        '高品质数字绘画，16:9宽屏构图，色彩丰富有层次，适合小说插图';

    try {
        var imageUrl = await callBanana2ImageAPI(prompt, {
            model: 'gemini-3.1-flash-image-preview-4k',
            aspectRatio: '16:9'
        });
        ch._sceneImageUrl = imageUrl;
        ch._sceneGenerating = false;
        _novelRenderChapterList();
        try { novelSaveCurrentProject(); } catch (e) { }
        showToast('✅ 第' + (chapterIdx + 1) + '章场景图已生成');
    } catch (e) {
        ch._sceneGenerating = false;
        _novelRenderChapterList();
        showToast('场景图生成失败: ' + e.message);
    }
}

// ==================== 13c3. 保存图片到手机 ====================
async function novelSaveImageToPhone(encodedUrl, encodedName) {
    var url = decodeURIComponent(encodedUrl);
    var name = decodeURIComponent(encodedName);
    try {
        showToast('💾 正在保存...');
        var response = await fetch(url);
        var blob = await response.blob();
        // 尝试 Web Share API（移动端原生保存）
        if (navigator.share && navigator.canShare) {
            var file = new File([blob], name + '.png', { type: blob.type || 'image/png' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: name });
                showToast('✅ 已分享/保存');
                return;
            }
        }
        // 降级：下载
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name + '.png';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('✅ 图片已下载');
    } catch (e) {
        window.open(url, '_blank');
        showToast('请长按图片保存到手机');
    }
}

// ==================== 13c4. 导出项目(含图片/配音URL) ====================
function novelExportProjectMedia() {
    if (!novelState.chapters || novelState.chapters.length === 0) {
        showToast('暂无项目数据可导出'); return;
    }
    novelSaveCurrentProject();
    var saveData = Object.assign({}, novelState, {
        theme: document.getElementById('novelThemeInput').value,
        genre: document.getElementById('novelGenreSelect').value,
        _savedAt: new Date().toISOString(),
        _version: 'rollroll-novel-media-v1'
    });
    var json = JSON.stringify(saveData, null, 2);
    var name = (saveData.theme || '小说').substring(0, 20).replace(/[\\/:*?"<>|]/g, '_');
    var done = novelState.chapters.filter(function (c) { return c.status === 'done'; }).length;
    var charImgs = (novelState.characters || []).filter(function (c) { return c.imageUrl; }).length;
    var fileName = name + '_' + done + 'ch_' + charImgs + 'img_' + new Date().toISOString().slice(0, 10) + '.json';

    // 尝试 Web Share
    if (navigator.share && navigator.canShare) {
        try {
            var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            var file = new File([blob], fileName, { type: 'application/json' });
            if (navigator.canShare({ files: [file] })) {
                navigator.share({ files: [file], title: '小说项目 - ' + name });
                return;
            }
        } catch (e) { }
    }
    // 降级：直接下载
    var blob2 = new Blob([json], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob2);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('✅ 项目已导出（含 ' + charImgs + ' 张角色图）');
}

// 导入项目(含图片/配音URL)
function novelImportProjectMedia(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
        try {
            var data = JSON.parse(e.target.result);
            if (!data.chapters && !data.outline) {
                showToast('无效的小说项目文件'); return;
            }
            // 恢复状态
            Object.assign(novelState, data);
            novelState.writing = false;
            novelState.paused = false;
            novelState.currentProjectId = data.currentProjectId || Date.now().toString();
            // 同步到 localStorage
            novelSaveCurrentProject();
            // 刷新UI
            document.getElementById('novelThemeInput').value = data.theme || '';
            if (data.genre) document.getElementById('novelGenreSelect').value = data.genre;
            if (data.outline) {
                document.getElementById('novelOutlineBox').textContent = data.outline;
                document.getElementById('novelOutlineSection').style.display = '';
            }
            if (data.chapters && data.chapters.length > 0) {
                document.getElementById('novelProgress').style.display = '';
                document.getElementById('novelStats').style.display = '';
                _novelRenderChapterList();
                _novelUpdateProgress();
            }
            try { novelExtractCharacters(); } catch (ex) { }
            try { novelUpdateStatsDashboard(); } catch (ex) { }
            try { novelRefreshProjectSelect(); } catch (ex) { }
            var charImgs = (data.characters || []).filter(function (c) { return c.imageUrl; }).length;
            var audioCount = (data.chapters || []).filter(function (c) { return c._audioUrl; }).length;
            showToast('✅ 项目已导入（' + (data.chapters || []).length + '章，' + charImgs + '张图，' + audioCount + '段配音）');
        } catch (err) {
            showToast('导入失败: ' + err.message);
        }
    };
    reader.readAsText(file);
    input.value = '';
}

// ==================== 13d. 翻书阅读模式 ====================
var _readingChapterIdx = 0;
var _readerPages = [];      // 分页后的文本数组
var _readerCurrentPage = 0; // 当前页索引
var _readerTouchStartX = 0;
var _readerAnimating = false;

function novelOpenReader(startIdx) {
    var overlay = document.getElementById('novelReadingOverlay');
    if (!overlay) return;
    _readingChapterIdx = startIdx || 0;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    _readerCurrentPage = 0;
    _readerSplitPages();
    _readerRenderPage();
    // 绑定触摸翻页
    var book = document.getElementById('novelReaderBook');
    if (book && !book._swipeBound) {
        book._swipeBound = true;
        book.addEventListener('touchstart', function (e) {
            _readerTouchStartX = e.touches[0].clientX;
        }, { passive: true });
        book.addEventListener('touchend', function (e) {
            if (_readerAnimating) return;
            var dx = e.changedTouches[0].clientX - _readerTouchStartX;
            if (Math.abs(dx) > 50) {
                if (dx < 0) novelReaderNext(); // 左滑 → 下一页
                else novelReaderPrev();         // 右滑 → 上一页
            }
        }, { passive: true });
        // 点击翻页：左半屏上一页，右半屏下一页
        book.addEventListener('click', function (e) {
            if (_readerAnimating) return;
            var rect = book.getBoundingClientRect();
            var x = e.clientX - rect.left;
            if (x < rect.width * 0.35) novelReaderPrev();
            else if (x > rect.width * 0.65) novelReaderNext();
        });
    }
}

function novelCloseReader() {
    var overlay = document.getElementById('novelReadingOverlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// 将章节内容按字数分页（估算每页能显示的字数）
function _readerSplitPages() {
    var done = novelState.chapters.filter(function (c) { return c.status === 'done'; });
    var ch = done[_readingChapterIdx];
    if (!ch || !ch.content) { _readerPages = ['暂无内容']; return; }

    var text = ch.content;
    // 估算每页字数：根据屏幕高度，17px字号，行高2，约每行20字
    var bookEl = document.getElementById('novelReaderBook');
    var h = bookEl ? bookEl.clientHeight : (window.innerHeight - 120);
    var linesPerPage = Math.floor((h - 76) / 34); // 34px = 17px * 2 line-height
    var charsPerLine = Math.floor((bookEl ? bookEl.clientWidth - 40 : 340) / 17);
    var charsPerPage = Math.max(200, linesPerPage * charsPerLine);

    _readerPages = [];
    var paragraphs = text.split('\n');
    var currentPage = '';
    var currentLen = 0;

    for (var pi = 0; pi < paragraphs.length; pi++) {
        var para = paragraphs[pi];
        var paraLen = para.length + 2; // +2 for indent
        if (currentLen + paraLen > charsPerPage && currentPage) {
            _readerPages.push(currentPage);
            currentPage = '';
            currentLen = 0;
        }
        currentPage += (currentPage ? '\n' : '') + para;
        currentLen += paraLen;
    }
    if (currentPage) _readerPages.push(currentPage);
    if (_readerPages.length === 0) _readerPages = ['暂无内容'];
}

function novelReaderPrev() {
    if (_readerAnimating) return;
    if (_readerCurrentPage > 0) {
        _readerAnimateTurn('prev');
    } else if (_readingChapterIdx > 0) {
        // 跳到上一章最后一页
        _readingChapterIdx--;
        _readerSplitPages();
        _readerCurrentPage = _readerPages.length - 1;
        _readerAnimateTurn('prev');
    }
}

function novelReaderNext() {
    if (_readerAnimating) return;
    if (_readerCurrentPage < _readerPages.length - 1) {
        _readerAnimateTurn('next');
    } else {
        var done = novelState.chapters.filter(function (c) { return c.status === 'done'; });
        if (_readingChapterIdx < done.length - 1) {
            // 跳到下一章第一页
            _readingChapterIdx++;
            _readerCurrentPage = 0;
            _readerSplitPages();
            _readerAnimateTurn('next');
        }
    }
}

function _readerAnimateTurn(direction) {
    _readerAnimating = true;
    var pageA = document.getElementById('novelReaderPageA');
    var pageB = document.getElementById('novelReaderPageB');
    if (!pageA || !pageB) { _readerAnimating = false; return; }

    var newPageIdx = direction === 'next' ? _readerCurrentPage + 1 : _readerCurrentPage - 1;
    if (newPageIdx < 0) newPageIdx = 0;
    if (newPageIdx >= _readerPages.length) newPageIdx = _readerPages.length - 1;

    // 准备新页内容
    var totalPages = _readerPages.length;
    var done = novelState.chapters.filter(function (c) { return c.status === 'done'; });
    var chTitle = done[_readingChapterIdx] ? done[_readingChapterIdx].title : '';

    pageB.innerHTML = _readerPages[newPageIdx] + '<div class="page-number">' + (newPageIdx + 1) + ' / ' + totalPages + '</div>';
    pageB.style.display = '';

    // 动画：当前页翻出，新页翻入
    pageA.classList.add('turning');
    pageB.classList.add('entering');
    // 强制 reflow
    void pageB.offsetWidth;
    pageB.classList.add('show');

    setTimeout(function () {
        // 动画结束，交换
        _readerCurrentPage = newPageIdx;
        pageA.classList.remove('turning');
        pageB.classList.remove('entering', 'show');
        pageB.style.display = 'none';
        pageA.innerHTML = _readerPages[_readerCurrentPage] + '<div class="page-number">' + (_readerCurrentPage + 1) + ' / ' + totalPages + '</div>';
        _readerUpdateControls();
        _readerAnimating = false;
    }, 550);
}

function _readerRenderPage() {
    var pageA = document.getElementById('novelReaderPageA');
    if (!pageA) return;
    var totalPages = _readerPages.length;
    pageA.innerHTML = _readerPages[_readerCurrentPage] + '<div class="page-number">' + (_readerCurrentPage + 1) + ' / ' + totalPages + '</div>';
    _readerUpdateControls();
}

function _readerUpdateControls() {
    var done = novelState.chapters.filter(function (c) { return c.status === 'done'; });
    var ch = done[_readingChapterIdx];
    var totalPages = _readerPages.length;

    document.getElementById('novelReaderTitle').textContent = '第' + (_readingChapterIdx + 1) + '章 ' + (ch ? ch.title : '');
    var pageInfo = document.getElementById('novelReaderPageInfo');
    if (pageInfo) pageInfo.textContent = (_readerCurrentPage + 1) + '/' + totalPages + '页';
    var pageNum = document.getElementById('novelReaderPageNum');
    if (pageNum) pageNum.textContent = '第' + (_readingChapterIdx + 1) + '章 · ' + (_readerCurrentPage + 1) + '/' + totalPages + '页';

    var prevBtn = document.getElementById('novelReaderPrevBtn');
    var nextBtn = document.getElementById('novelReaderNextBtn');
    if (prevBtn) prevBtn.disabled = (_readerCurrentPage <= 0 && _readingChapterIdx <= 0);
    if (nextBtn) nextBtn.disabled = (_readerCurrentPage >= totalPages - 1 && _readingChapterIdx >= done.length - 1);
}

// ==================== 14. 增强版章节列表渲染（覆盖原始版本） ====================
function _novelRenderChapterListEnhanced() {
    const list = document.getElementById('novelChapterList');
    if (!list || !novelState.chapters.length) return;

    list.innerHTML = novelState.chapters.map((ch, i) => {
        const statusMap = { pending: '⏳', generating: '✍️', done: '✅', error: '❌' };
        const icon = statusMap[ch.status] || '⏳';
        const wordInfo = ch.wordCount ? `(${ch.wordCount.toLocaleString()}字)` : '';
        // 配音区域（支持多段音频+音色信息）
        var audioHtml = '';
        if (ch._audioUrl || (ch._audioSegments && ch._audioSegments.length > 0)) {
            var _vLabel = '';
            if (ch._ttsVoice) {
                var _vInfo = NOVEL_TTS_VOICES.find(function (vv) { return vv.id === ch._ttsVoice.voiceName; });
                _vLabel = _vInfo ? _vInfo.label : ch._ttsVoice.voiceName;
            }
            audioHtml = '<div class="ch-audio-wrap"><audio controls src="' + ch._audioUrl + '" style="width:100%;"></audio>';
            if (ch._audioSegments && ch._audioSegments.length > 1) {
                audioHtml += '<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">' +
                    '<button class="ch-scene-btn" onclick="event.stopPropagation();novelPlayAllSegments(' + i + ')" style="flex:1;padding:4px;font-size:11px;background:#6c5ce7;color:#fff;border:none;border-radius:4px;">▶️ 连播全部(' + ch._audioSegments.length + '段)</button>' +
                    '<button class="ch-scene-btn" onclick="event.stopPropagation();novelShowVoiceSelector()" style="padding:4px 8px;font-size:11px;background:#444;color:#fff;border:none;border-radius:4px;">🎤 换音色</button>' +
                    '</div>';
            }
            if (_vLabel) audioHtml += '<div style="font-size:11px;color:#888;margin-top:2px;">🎤 ' + _vLabel + '</div>';
            audioHtml += '</div>';
        } else if (ch._ttsLoading) {
            audioHtml = '<div class="ch-audio-wrap"><span class="audio-status">🎤 配音生成中...</span></div>';
        }
        // 场景图区域
        var sceneHtml = '';
        if (ch._sceneImageUrl) {
            sceneHtml = '<div class="ch-scene-wrap" style="margin:6px 0;">' +
                '<img src="' + ch._sceneImageUrl + '" alt="场景图" style="width:100%;border-radius:8px;max-height:200px;object-fit:cover;">' +
                '<div style="display:flex;gap:4px;margin-top:4px;">' +
                '<button class="ch-scene-btn" onclick="event.stopPropagation();novelSaveImageToPhone(\'' + encodeURIComponent(ch._sceneImageUrl) + '\',\'' + encodeURIComponent('第' + (i + 1) + '章_场景图') + '\')" style="flex:1;padding:4px;font-size:11px;background:#2a6;color:#fff;border:none;border-radius:4px;">💾 保存场景图</button>' +
                '<button class="ch-scene-btn" onclick="event.stopPropagation();novelGenerateSceneImage(' + i + ')" style="flex:1;padding:4px;font-size:11px;background:#36a;color:#fff;border:none;border-radius:4px;">🔄 重新生成</button>' +
                '</div></div>';
        } else if (ch._sceneGenerating) {
            sceneHtml = '<div class="ch-scene-wrap" style="margin:6px 0;text-align:center;color:#888;font-size:12px;">🖼️ 场景图生成中...</div>';
        }
        const actionsHtml = ch.status === 'done' ? `
            <div class="ch-actions">
                <button onclick="event.stopPropagation();novelViewChapter(${i})">📖 查看</button>
                <button onclick="event.stopPropagation();novelRewriteChapter(${i})">🔄 重写</button>
                <button onclick="event.stopPropagation();novelShowTweakModal(${i})">✏️ 微调</button>
                <button onclick="event.stopPropagation();novelOpenReader(${i})">👁️ 阅读</button>
                <button onclick="event.stopPropagation();novelTTSChapter(${i})">🎤 配音</button>
                <button onclick="event.stopPropagation();novelShowVoiceSelector()">🎙️ 换音色</button>
                <button onclick="event.stopPropagation();novelGenerateSceneImage(${i})">🖼️ 场景</button>
            </div>${sceneHtml}${audioHtml}` : ch.status === 'error' ? `
            <div class="ch-actions">
                <button onclick="event.stopPropagation();novelRetryChapter(${i})">🔄 重试</button>
            </div>` : '';

        return `<div class="novel-chapter-item" onclick="novelViewChapter(${i})" style="cursor:pointer;">
            <span>${icon} 第${i + 1}章 ${ch.title} ${wordInfo}</span>
            ${actionsHtml}
        </div>`;
    }).join('');

    // 📱 移动端：为动态生成的按钮绑定 touchend 事件
    list.querySelectorAll('.ch-actions button, .ch-scene-btn').forEach(function (btn) {
        btn.addEventListener('touchend', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var onclick = this.getAttribute('onclick');
            if (onclick) {
                // 移除 event.stopPropagation(); 前缀后执行
                var fn = onclick.replace('event.stopPropagation();', '');
                try { new Function(fn)(); } catch (err) { console.warn('[novel] touchend exec error:', err); }
            }
        });
    });

    // 📱 移动端：章节项也绑定 touchend
    list.querySelectorAll('.novel-chapter-item').forEach(function (item) {
        item.addEventListener('touchend', function (e) {
            // 只在点击非按钮区域时触发
            if (e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            var onclick = this.getAttribute('onclick');
            if (onclick) {
                try { new Function(onclick)(); } catch (err) { console.warn('[novel] touchend item error:', err); }
            }
        });
    });

    // 显示导出区域（如果有已完成章节）
    const doneCount = novelState.chapters.filter(c => c.status === 'done').length;
    if (doneCount > 0) {
        document.getElementById('novelExportActions').style.display = '';
    }
}

// ==================== 15. 增强版 novelStartWriting（替代原始版本） ====================
async function novelStartWritingEnhanced() {
    // 大纲变动检测
    novelReparseOutline();

    // 胶片预检
    const remaining = novelState.chapters.filter(c => c.status !== 'done').length;
    const totalCost = remaining * NOVEL_CHAPTER_COST;
    if (typeof userQuota !== 'undefined' && userQuota < totalCost) {
        if (!confirm(`⚠️ 预估需要${totalCost}胶片，当前余额${userQuota}胶片，可能不够。是否继续？`)) return;
    }

    novelState.writing = true;
    novelState.paused = false;
    document.getElementById('novelStartBtn').textContent = '🚀 写作中...';
    document.getElementById('novelStartBtn').disabled = true;
    document.getElementById('novelPauseBtn').style.display = '';

    // 防息屏保活
    if (typeof WakeLockUtil !== 'undefined') WakeLockUtil.acquire();

    if (novelState.mode === 'manual') {
        document.getElementById('novelNextBtn').style.display = '';
        const nextIdx = novelState.chapters.findIndex(c => c.status === 'pending' || c.status === 'error');
        if (nextIdx >= 0) {
            await _novelGenerateChapterEnhanced(nextIdx);
        }
    } else {
        // 自动模式 — 串行逐章生成（确保每章拥有前文完整上下文，避免内容重复）
        let _doneInRun = 0;
        let _lastDonePos = -1;
        for (let _pos = 0; _pos < novelState.chapters.length; _pos++) {
            if (!novelState.writing || novelState.paused) break;
            if (novelState.chapters[_pos].status === 'done') continue;
            await _novelGenerateChapterEnhanced(_pos);
            _doneInRun++;
            _lastDonePos = _pos;
            // 轻量进度更新（不做全量DOM渲染，加速章间衔接）
            try {
                var _doneN = novelState.chapters.filter(function (c) { return c.status === 'done'; }).length;
                document.getElementById('novelProgressLabel').textContent = '✅ 第' + (_pos + 1) + '章完成 (' + _doneN + '/' + novelState.chapters.length + ')';
            } catch (e) { }
            // 每10章做一次重操作（角色提取+统计+保存），减少章间开销
            if (_doneInRun % 10 === 0) {
                try { novelExtractCharacters(); } catch (e) { }
                try { novelUpdateStatsDashboard(); } catch (e) { }
                try { novelSaveCurrentProject(); } catch (e) { }
            }
        }
        // 循环结束后渲染最后完成的章节
        if (_lastDonePos >= 0) novelViewChapter(_lastDonePos);
    }

    // 释放保活
    if (typeof WakeLockUtil !== 'undefined') WakeLockUtil.release();

    if (novelState.chapters.every(c => c.status === 'done')) {
        novelState.writing = false;
        document.getElementById('novelStartBtn').textContent = '✅ 全部完成！';
        document.getElementById('novelPauseBtn').style.display = 'none';
        novelExtractCharacters();
        novelUpdateStatsDashboard();
        novelSaveCurrentProject();
        showToast('🎉 小说全部章节已完成！');
    } else {
        document.getElementById('novelStartBtn').disabled = false;
        document.getElementById('novelStartBtn').textContent = '🚀 继续写作';
    }
}

async function novelWriteNextChapterEnhanced() {
    const nextIdx = novelState.chapters.findIndex(c => c.status === 'pending' || c.status === 'error');
    if (nextIdx < 0) { showToast('所有章节已完成'); return; }
    await _novelGenerateChapterEnhanced(nextIdx);
    novelViewChapter(nextIdx);
}

// ==================== 初始化增强 ====================
function novelEnhancedInit() {
    // 覆盖原始函数为增强版
    window._novelRenderChapterList = _novelRenderChapterListEnhanced;
    window.novelStartWriting = novelStartWritingEnhanced;
    window.novelWriteNextChapter = novelWriteNextChapterEnhanced;
    window._novelGenerateChapter = _novelGenerateChapterEnhanced;

    // 初始化 novelState 扩展字段
    if (typeof novelState !== 'undefined') {
        novelState.summaries = novelState.summaries || {};
        novelState.characters = novelState.characters || [];
        novelState.currentProjectId = novelState.currentProjectId || null;
    }

    // 刷新项目列表
    novelRefreshProjectSelect();

    // 检查断点恢复
    novelShowRestoreBanner();

    // 写作中刷新/关闭页面警告（防止误操作丢失数据）
    window.addEventListener('beforeunload', function (e) {
        if (typeof novelState !== 'undefined' && novelState.writing && !novelState.paused) {
            e.preventDefault();
            e.returnValue = '小说正在生成中，刷新页面可能丢失未保存的数据！';
        }
    });

    // 设置选项变化时更新预检
    var chCountSel = document.getElementById('novelChapterCount');
    if (chCountSel) {
        chCountSel.addEventListener('change', novelCheckCostPreview);
    }

    console.log('[novel-engine] 增强模块已初始化 — 14项优化已激活');
}

// ==================== 角色生成功能 ====================
// 生成单个角色图片
async function novelGenerateCharImage(charIndex) {
    if (!novelState.characters || !novelState.characters[charIndex]) {
        showToast('角色数据不存在');
        return;
    }

    const char = novelState.characters[charIndex];
    if (char._generating) return;

    if (typeof callBanana2ImageAPI !== 'function') {
        showToast('图片生成API未加载，请刷新页面');
        return;
    }

    char._generating = true;
    _novelRenderCharCards();

    const genre = document.getElementById('novelGenreSelect')?.value || '奇幻';
    const prompt = `小说角色设计图，高质量数字绘画，${genre}风格。
角色名称：${char.name}
角色描述：${char.desc}
画面要求：全身角色设计图，清晰的服装和配饰，生动的表情，专业角色设定稿风格，白色背景，高质量渲染，16:9宽屏构图，适合小说角色插图`;

    try {
        const imageUrl = await callBanana2ImageAPI(prompt, {
            model: 'nano-banana-2-4k',
            aspectRatio: '16:9'
        });

        char.imageUrl = imageUrl;
        char._generating = false;
        _novelRenderCharCards();
        try { novelSaveCurrentProject(); } catch (e) { }
        showToast(`✅ ${char.name} 角色图已生成`);
    } catch (e) {
        char._generating = false;
        _novelRenderCharCards();
        showToast('角色图生成失败: ' + e.message);
    }
}

// 并发生成所有角色图片
async function novelGenerateAllCharImages() {
    if (!novelState.characters || novelState.characters.length === 0) {
        showToast('没有角色数据，请先完成一些章节');
        return;
    }

    const charsToGenerate = novelState.characters
        .map((char, idx) => ({ char, idx }))
        .filter(item => !item.char.imageUrl && !item.char._generating);

    if (charsToGenerate.length === 0) {
        showToast('所有角色都已生成图片');
        return;
    }

    showToast(`开始并发生成 ${charsToGenerate.length} 个角色图片...`);

    // 并发控制：最多同时3个
    const CONCURRENT_LIMIT = 3;
    const batches = [];
    for (let i = 0; i < charsToGenerate.length; i += CONCURRENT_LIMIT) {
        batches.push(charsToGenerate.slice(i, i + CONCURRENT_LIMIT));
    }

    try {
        for (const batch of batches) {
            // 并发执行当前批次
            await Promise.all(batch.map(item => novelGenerateCharImage(item.idx)));

            // 批次间短暂延迟，避免API限制
            if (batches.indexOf(batch) < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        showToast('✅ 所有角色图片生成完成！');
    } catch (e) {
        showToast('批量生成过程中出现错误: ' + e.message);
    }
}

// 渲染角色卡片
function _novelRenderCharCards() {
    const container = document.getElementById('novelCharCards');
    if (!container || !novelState.characters) return;

    container.parentElement.style.display = '';
    const chars = novelState.characters;

    container.innerHTML = chars.map((char, idx) => {
        const imgHtml = char.imageUrl ?
            `<img src="${char.imageUrl}" alt="${char.name}" style="width:100%;border-radius:8px;margin:8px 0;">` : '';

        const btnText = char._generating ? '✨ 生成中...' : '🎨 生成角色图';
        const btnClass = char._generating ? 'char-gen-btn loading' : 'char-gen-btn';

        return `<div class="novel-char-card">
            <div class="char-name">🎭 ${char.name}</div>
            <div class="char-desc">${char.desc}</div>
            ${imgHtml}
            <button class="${btnClass}" onclick="novelGenerateCharImage(${idx})">${btnText}</button>
        </div>`;
    }).join('');
}

// ==================== 配音辅助函数 ====================

// 获取真实音色列表
async function fetchRealTTSVoices() {
    try {
        const response = await fetch('/api/yunwu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'tts-voices',
                grade: 'premium',
                pageSize: 50
            })
        });

        const data = await response.json();
        if (data.success && data.voices) {
            // 转换DubbingX音色格式为我们的格式
            NOVEL_TTS_VOICES = data.voices.map(voice => ({
                id: voice.voiceId || voice.id,
                label: `${voice.name || voice.voiceName} (${voice.gender === 1 ? '女声' : '男声'}-${voice.languageName || voice.language || '未知'})`,
                engine: 'dubbingx',
                language: voice.languageCode || voice.language || 'zh',
                gender: voice.gender,
                original: voice
            }));
            console.log('[novel] 已加载真实音色列表:', NOVEL_TTS_VOICES.length, '个音色');
            return true;
        }
    } catch (e) {
        console.warn('[novel] 获取真实音色失败，使用默认音色:', e.message);
    }
    return false;
}

// 智能检测章节音色
function _novelDetectChapterVoice() {
    const genre = document.getElementById('novelGenreSelect')?.value || '奇幻';
    const theme = document.getElementById('novelThemeInput')?.value || '';

    // 根据题材和主题智能选择音色（使用DubbingX音色）
    if (genre.includes('仙侠') || genre.includes('玄幻') || genre.includes('武侠')) {
        return { voiceName: 'zh-CN-XiaoxiaoNeural', voiceId: 'zh-CN-XiaoxiaoNeural', engine: 'dubbingx' };
    } else if (genre.includes('都市') || genre.includes('现代')) {
        return { voiceName: 'zh-CN-YunxiNeural', voiceId: 'zh-CN-YunxiNeural', engine: 'dubbingx' };
    } else if (genre.includes('言情') || genre.includes('爱情')) {
        return { voiceName: 'zh-CN-XiaoyiNeural', voiceId: 'zh-CN-XiaoyiNeural', engine: 'dubbingx' };
    } else if (genre.includes('二次元') || genre.includes('轻小说')) {
        return { voiceName: 'zh-CN-XiaochenNeural', voiceId: 'zh-CN-XiaochenNeural', engine: 'dubbingx' };
    } else {
        // 默认中文女声
        return { voiceName: 'zh-CN-XiaoxiaoNeural', voiceId: 'zh-CN-XiaoxiaoNeural', engine: 'dubbingx' };
    }
}

// 将长文本分段用于TTS
function _novelSplitTextForTTS(text, maxChars = 500) {
    if (!text) return [];

    const chunks = [];
    const sentences = text.split(/[。！？.!?]/);
    let currentChunk = '';

    for (const sentence of sentences) {
        if (!sentence.trim()) continue;

        const sentenceWithPunct = sentence + '。';
        if (currentChunk.length + sentenceWithPunct.length > maxChars && currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = sentenceWithPunct;
        } else {
            currentChunk += sentenceWithPunct;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text.substring(0, maxChars)];
}

// 显示音色选择器
function novelShowVoiceSelector() {
    const currentVoice = novelState._voicePrefs?.voiceName || 'zh-CN-XiaoxiaoNeural';

    let html = '<div class="novel-voice-selector-overlay" id="novelVoiceSelectorOverlay">' +
        '<div class="novel-voice-selector-panel">' +
        '<div class="voice-selector-header">' +
        '<h3>🎙️ 选择配音音色</h3>' +
        '<button onclick="novelCloseVoiceSelector()" class="voice-selector-close">✕</button>' +
        '</div>' +
        '<div class="voice-selector-list">';

    NOVEL_TTS_VOICES.forEach(voice => {
        const selected = voice.id === currentVoice ? 'selected' : '';
        html += `<div class="voice-option ${selected}" onclick="novelSelectVoice('${voice.id}', '${voice.voiceId}', '${voice.engine}')">` +
            `<div class="voice-info">` +
            `<div class="voice-name">${voice.label}</div>` +
            `<div class="voice-desc">${voice.language} · ${voice.engine}</div>` +
            `</div>` +
            `<div class="voice-check">${selected ? '✓' : ''}</div>` +
            `</div>`;
    });

    html += '</div></div></div>';

    // 移除旧的选择器
    const old = document.getElementById('novelVoiceSelectorOverlay');
    if (old) old.remove();

    document.body.insertAdjacentHTML('beforeend', html);
}

// 关闭音色选择器
function novelCloseVoiceSelector() {
    const overlay = document.getElementById('novelVoiceSelectorOverlay');
    if (overlay) overlay.remove();
}

// 选择音色
function novelSelectVoice(voiceName, voiceId, engine) {
    novelState._voicePrefs = { voiceName, voiceId, engine };
    try { novelSaveCurrentProject(); } catch (e) { }

    const voice = NOVEL_TTS_VOICES.find(v => v.id === voiceName);
    showToast(`✅ 已选择音色：${voice ? voice.label : voiceName}`);

    novelCloseVoiceSelector();
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        novelEnhancedInit();
        // 异步获取真实音色列表
        await fetchRealTTSVoices();
    });
} else {
    novelEnhancedInit();
    // 异步获取真实音色列表
    fetchRealTTSVoices();
}

// ... (其余代码保持不变)
