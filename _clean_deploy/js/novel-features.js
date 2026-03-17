/**
 * 📖 novel-features.js — 长篇小说增强特性
 * 多项目管理、Supabase云保存、角色卡片、一致性校验、统计面板、导出增强、阅读模式
 */

// 统一的章节标题显示（处理title为纯编号"第X章"、含编号"第X章 名字"、纯名字 三种情况）
function _novelDisplayTitle(ch, idx) {
    var title = (ch.title || '').trim();
    var num = idx + 1;
    // 情况1：title已经是"第X章 名字"格式（含编号+名字）
    var fullMatch = title.match(/^第\d+章\s+(.+)/);
    if (fullMatch && fullMatch[1]) return title;
    // 情况2：title是纯编号"第X章"（无章节名）→ 从outline提取
    if (/^第\d+章$/.test(title)) {
        var name = '';
        if (ch.outline) {
            // outline可能是"章节名：大纲内容" 或直接是大纲内容
            var colonIdx = ch.outline.indexOf('：');
            if (colonIdx < 0) colonIdx = ch.outline.indexOf(':');
            if (colonIdx > 0 && colonIdx < 20) {
                name = ch.outline.substring(0, colonIdx).trim();
            } else {
                // 取outline前15个字作为名字
                name = ch.outline.substring(0, 15).replace(/[，。！？、；：].*$/, '').trim();
            }
        }
        return name ? '第' + num + '章 ' + name : '第' + num + '章';
    }
    // 情况3：title是纯名字（不含"第X章"前缀）
    return '第' + num + '章 ' + title;
}

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
// 🔧 修复 Permission denied：Web Share 必须在用户手势同步调用栈中执行，不能在 await 之后
function novelCloudSave() {
    if ((!novelState.chapters || novelState.chapters.length === 0) && !novelState.outline) {
        showToast('暂无小说数据可保存'); return;
    }

    // 同步准备数据（不能有 await，否则 Web Share 权限丢失）
    try { novelSaveCurrentProject(); } catch (e) { }
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
    // 🔧 关键：navigator.share 必须在同步调用栈中执行
    if (navigator.share && navigator.canShare) {
        try {
            var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            var file = new File([blob], fileName, { type: 'application/json' });
            if (navigator.canShare({ files: [file] })) {
                navigator.share({
                    files: [file],
                    title: '小说存档 - ' + name,
                    text: name + '（' + done + '章，' + sizeKB + 'KB）'
                }).then(function () {
                    showToast('☁️ 已分享到云盘（' + done + '章，' + sizeKB + 'KB）');
                    _novelSupabaseSave(saveData).catch(function () { });
                }).catch(function (err) {
                    if (err.name === 'AbortError') return;
                    console.warn('[novel] Web Share失败:', err.message);
                    // 降级到平台云端
                    _novelCloudSaveFallback(saveData, sizeKB);
                });
                return;
            }
        } catch (err) {
            console.warn('[novel] Web Share不支持:', err.message);
        }
    }

    // 不支持 Web Share API 时降级为平台云端保存
    _novelCloudSaveFallback(saveData, sizeKB);
}

// 降级保存到平台云端
async function _novelCloudSaveFallback(saveData, sizeKB) {
    showToast('☁️ 正在保存到平台云端...');
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

// ==================== 9. 角色卡片提取（增强版：全角色识别+精准过滤） ====================
function novelExtractCharacters() {
    const outline = novelState.outline || '';
    // 取全量正文（每章取前1500字+末500字，覆盖更多角色出场信息）
    const doneChapters = novelState.chapters.filter(c => c.content);
    let sampleText = outline + '\n';
    for (var ci = 0; ci < doneChapters.length; ci++) {
        var ct = doneChapters[ci].content || '';
        if (ct.length <= 2500) {
            sampleText += ct + '\n';
        } else {
            sampleText += ct.substring(0, 1500) + '\n...\n' + ct.slice(-500) + '\n';
        }
    }

    // 从大纲中提取角色（多种格式匹配）
    const chars = [];
    const addedNames = new Set(); // 用Set加速去重

    function _addChar(name, desc, source) {
        name = name.replace(/[""「」『』【】\[\]]/g, '').trim();
        if (name.length < 2 || name.length > 15) return false;
        if (addedNames.has(name)) return false;
        // 大纲来源允许英文名（用户明确标注的），正文来源走完整过滤
        var isOutlineSource = (source === 'outline_section' || source === 'keyword_pattern');
        if (_isNotCharName(name, isOutlineSource)) return false;
        addedNames.add(name);
        chars.push({ name, desc: (desc || '').substring(0, 80).trim() || '暂无描述', _source: source });
        return true;
    }

    // 非角色名黑名单（地名、组织、物品、修饰语、常见非人名词汇）
    const _stopWordsSet = new Set([
        // 代词/指代/泛指人物
        '他们', '她们', '我们', '自己', '大家', '所有', '这个', '那个', '一个', '什么',
        '对方', '众人', '旁边', '周围', '有人', '别人', '某人', '此人', '其他', '各位',
        '那人', '这人', '来人', '何人', '老者', '少年', '少女', '女子', '男子', '老人',
        '孩子', '小孩', '老头', '妇人', '小姐', '公子', '先生', '夫人', '陛下', '殿下',
        '掌柜', '伙计', '侍卫', '护卫', '士兵', '弟子', '长辈', '晚辈', '下人', '仆人',
        '丫鬟', '婢女', '侍女', '管家', '掌门', '门主', '教主', '魔头', '妖怪', '怪物',
        // 连词/副词/助词/语气词
        '不过', '只是', '如果', '但是', '因为', '所以', '然后', '于是', '虽然', '可是',
        '突然', '终于', '居然', '竟然', '果然', '忽然', '已经', '正在', '马上', '立刻',
        '只见', '原来', '看来', '似乎', '仿佛', '几乎', '随即', '随后', '接着', '忽地',
        '这时', '此时', '那时', '当时', '顿时', '瞬间', '刹那', '霎时', '同时', '眼前',
        '而且', '并且', '不仅', '不但', '即使', '尽管', '何况', '况且', '否则', '要么',
        '或许', '也许', '大概', '恐怕', '只好', '只得', '不禁', '不由', '不免', '难免',
        // 常见误识别词（动作/状态/方向/量词/身体部位/场所）
        '一声', '一步', '两人', '三人', '几人', '数人', '众人', '二人', '四人', '五人',
        '身后', '面前', '身旁', '身边', '脚下', '头顶', '上方', '下方', '左右', '前方',
        '心中', '脑海', '眼中', '手中', '怀中', '口中', '耳边', '嘴角', '眼角', '额头',
        '门外', '门口', '窗外', '屋内', '殿内', '房间', '院子', '客厅', '大厅', '广场',
        '天空', '地面', '远处', '近处', '深处', '尽头', '山顶', '水面', '空中', '雾中',
        '一时', '片刻', '许久', '好久', '不久', '多久', '此刻', '那刻', '良久', '半晌',
        '修为', '修炼', '修行', '武功', '内力', '真气', '灵力', '法力', '魔力', '功法',
        '第一', '第二', '第三', '第四', '第五', '最后', '最终', '目前', '此番', '这次',
        // 常见物品/概念
        '宝剑', '长剑', '飞剑', '法器', '法宝', '灵石', '灵药', '丹药', '阵法', '禁制',
        '功力', '境界', '天赋', '血脉', '命运', '因果', '轮回', '天道', '大道', '规则',
        '一切', '一些', '所有', '全部', '整个', '每个', '任何', '无数', '万千', '千万',
        // 时间词
        '今天', '明天', '昨天', '今日', '明日', '昨日', '今晚', '昨晚', '早上', '晚上',
        '白天', '夜晚', '深夜', '清晨', '黄昏', '傍晚', '午后', '正午', '子时', '丑时',
        '多年', '数年', '百年', '千年', '万年', '几天', '数日', '多日', '数月', '几年'
    ]);

    // 常见地名/组织后缀 — 用于判断是否为非人名
    const _placeOrgSuffix = /(?:城|镇|村|山|岛|谷|洞|宫|殿|阁|楼|院|寺|庙|派|宗|门|盟|帮|族|国|界|域|林|海|湖|河|峰|崖|关|堡|营|府|堂|庄|居|台|坛|池|塔|洲|陆|境|天下|世界|大陆|王朝|帝国|联邦|公司|集团|学院|学校|组织|协会)$/;

    // 常见双字非人名前缀（动词/形容词开头）
    const _verbAdjectivePrefix = /^(?:突然|忽然|渐渐|慢慢|轻轻|缓缓|微微|猛然|赫然|骤然|蓦然|悄然|默默|静静|急忙|连忙|赶紧|飞速|迅速|快速|拼命|用力|奋力|尽力|全力|死死|紧紧|狠狠|重重|深深|高高|远远|暗暗|偷偷|纷纷|频频|处处|步步|层层|阵阵|声声|隐隐|淡淡|冷冷|幽幽|森森|沉沉|茫茫)/;

    function _isNotCharName(name, isOutlineSource) {
        if (_stopWordsSet.has(name)) return true;
        // 纯数字/纯符号
        if (/^[\d\s\p{P}]+$/u.test(name)) return true;
        // 以地名/组织后缀结尾
        if (_placeOrgSuffix.test(name)) return true;
        // 常见叠词（轻轻、慢慢等）或副词前缀开头
        if (_verbAdjectivePrefix.test(name)) return true;
        // 全是常见虚词/功能词（2字）
        if (/^[的了是在有不人我他她它这那里也就都要会可以上下来去到过说着被让给把还没很太更最又再才刚也]/.test(name) && name.length === 2) return true;
        // 以常见动词开头的2字组合（如"说完""走了""看着"）
        if (/^(?:说|道|喊|问|笑|叹|怒|吼|想|看|听|走|跑|飞|打|杀|拿|握|拉|推|挡|挥|抬|低|站|坐|躺|跪|蹲)[了着过去来到完下出入开关住好掉起]$/.test(name)) return true;
        // 含英文字母 → 中文小说正文中排除；大纲来源允许（用户明确标注的英文角色名）
        if (!isOutlineSource && /[a-zA-Z]/.test(name)) return true;
        // 包含标点符号
        if (/[，。！？、；：""''（）《》【】\[\]{}]/.test(name)) return true;
        return false;
    }

    // ===== 第1层：大纲【角色】段落提取（最可靠） =====
    const charSectionPatterns = [
        /【角色[设定简介]*】([\s\S]*?)(?=【|$)/g,
        /【(?:主要)?人物[设定简介]*】([\s\S]*?)(?=【|$)/g,
        /#{1,3}\s*角色[设定简介]*\n([\s\S]*?)(?=#{1,3}\s|$)/g,
        /角色[设定简介]*[：:]\s*\n([\s\S]*?)(?=\n\n|\n【|$)/g,
    ];
    charSectionPatterns.forEach(pat => {
        var sm;
        while ((sm = pat.exec(sampleText)) !== null) {
            var secLines = sm[1].split('\n');
            for (var li = 0; li < secLines.length; li++) {
                var cline = secLines[li].trim();
                if (!cline || cline.length < 3) continue;
                // "- 名字：描述" 或 "- 名字（身份）：描述" 或 "1. 名字：描述"
                var cm = cline.match(/^[-\-·•*\d.、)）]?\s*[「""]?([A-Za-z\u4e00-\u9fa5·\s]{2,15}?)[」""]?\s*[（(]?[^)）]*[)）]?\s*[：:—\-]\s*(.+)/);
                if (cm) {
                    _addChar(cm[1], cm[2], 'outline_section');
                }
            }
        }
    });

    // ===== 第2层：关键词模式匹配（大纲中的角色标记） =====
    const charPatterns = [
        /[【\[]主角[】\]]\s*[:：]?\s*(.+)/g,
        /[【\[](?:女主|男主|配角|反派|BOSS|boss|Boss)[】\]]\s*[:：]?\s*(.+)/g,
        /(?:主角|女主角?|男主角?|主人公|男一号?|女一号?|男二号?|女二号?|反派|大Boss|BOSS)\s*[:：]\s*(.+)/g,
        /角色\d*\s*[:：]\s*(.+)/g,
        /(?:人物|角色|配角)(?:设定|简介)?[：:]\s*(.+)/g,
    ];
    charPatterns.forEach(pat => {
        let m;
        while ((m = pat.exec(sampleText)) !== null) {
            const line = m[1].trim();
            const nameMatch = line.match(/^[「""]?([^\s,，、（(\n""」]+)/);
            if (nameMatch) {
                var desc = line.substring(nameMatch[0].length).replace(/^[,，、（(\s""」]+/, '').substring(0, 80).trim();
                _addChar(nameMatch[1], desc, 'keyword_pattern');
            }
        }
    });

    // ===== 第3层：正文行为模式匹配（对话/动作/心理） =====
    const nameFreq = {};
    const nameContexts = {}; // 记录角色周围上下文片段（用于生成描述）

    // 辅助：记录名字出现+收集上下文
    function _hitName(name, matchIndex) {
        name = name.trim();
        if (!name || _isNotCharName(name)) return;
        nameFreq[name] = (nameFreq[name] || 0) + 1;
        // 收集匹配位置前后各40字作为上下文（最多保留8条）
        if (!nameContexts[name]) nameContexts[name] = [];
        if (nameContexts[name].length < 8 && typeof matchIndex === 'number') {
            var ctxStart = Math.max(0, matchIndex - 40);
            var ctxEnd = Math.min(sampleText.length, matchIndex + name.length + 40);
            nameContexts[name].push(sampleText.substring(ctxStart, ctxEnd));
        }
    }

    var dm;

    // 模式1：名字+对话动词
    const dialogVerbs = '说道|笑道|喊道|叹道|怒道|问道|答道|骂道|哭道|叫道|嘟囔|低声|高声|冷声|淡淡|沉声|厉声|轻声|柔声|急声|朗声|娇声|嘶声|哑声|闷声|大声|小声|尖声';
    const simpleVerbs = '说|道|喊|笑|叹|怒|问|答|叫|吼|哼|嗤|哂|嘲|斥|呵|喝|吩咐|命令|提醒|解释|回应|反驳|插嘴|附和|嘀咕|呢喃|自语|咆哮|恳求|央求';
    const namePattern1 = new RegExp('(?:^|[\\s，。！？；：\\n])([A-Za-z\\u4e00-\\u9fa5·]{2,8})(?:' + dialogVerbs + '|' + simpleVerbs + ')', 'g');
    while ((dm = namePattern1.exec(sampleText)) !== null) {
        _hitName(dm[1], dm.index);
    }

    // 模式2："xxx"前的人名（对话标记）
    const namePattern2 = /([\u4e00-\u9fa5A-Za-z·]{2,8})\s*[：:]\s*[「""']/g;
    while ((dm = namePattern2.exec(sampleText)) !== null) {
        _hitName(dm[1], dm.index);
    }

    // 模式3：动作描写 — 对xxx说/xxx转身 等
    const actionVerbs = '说|道|喊|问|笑|叹|怒|吼|转身|点头|摇头|皱眉|抬头|低头|起身|坐下|站起|走到|跑到|飞到|看向|望向|扑向|冲向|退后|后退|上前|走来|赶到|来到|出现|消失|离开|离去|回到|进入|走出|跳出|冲出|闪身|挥手|伸手|收手|出手|拔剑|拔刀|挥剑|举刀|施法|运功';
    const namePattern3 = new RegExp('(?:对|向|朝|跟|与|和|替|帮|给|让|叫|被|把|将|拉着|拽着|扶着|看着|望着|盯着|瞪着|指着|拦住|挡住|救了|打了|杀了|伤了)([\\u4e00-\\u9fa5A-Za-z·]{2,8})(?:' + actionVerbs + ')', 'g');
    while ((dm = namePattern3.exec(sampleText)) !== null) {
        _hitName(dm[1], dm.index);
    }

    // 模式4：心理活动 — xxx心想/xxx暗道
    const namePattern4 = /([\u4e00-\u9fa5A-Za-z·]{2,8})(?:心想|暗想|心道|暗道|想到|心中|内心|感到|觉得|认为|明白|知道|意识到)/g;
    while ((dm = namePattern4.exec(sampleText)) !== null) {
        _hitName(dm[1], dm.index);
    }

    // 模式5：称谓+名字
    const titlePattern = /(?:师父|师傅|师兄|师姐|师弟|师妹|前辈|晚辈|老师|教授|院长|队长|将军|大人|陛下|殿下|王爷|皇上|掌门|宗主|长老|护法|圣女|圣子|使者|首领|头目|老板|老大|二哥|三哥|大姐|二姐)([\u4e00-\u9fa5A-Za-z·]{2,6})|([\u4e00-\u9fa5A-Za-z·]{2,6})(?:师兄|师姐|师弟|师妹|前辈|老师|教授|队长|将军|大人|大哥|大姐|哥哥|姐姐|弟弟|妹妹|叔叔|阿姨|爷爷|奶奶|伯伯|婶婶)/g;
    while ((dm = titlePattern.exec(sampleText)) !== null) {
        var n5 = (dm[1] || dm[2] || '').trim();
        if (n5) _hitName(n5, dm.index);
    }

    // 模式6：引号后紧跟的说话人 — "xxx"，xxx说/道
    const quotePattern = /[""」』]\s*[，,]?\s*([\u4e00-\u9fa5A-Za-z·]{2,8})(?:说|道|喊|问|笑|叹|怒|吼|哼|嗤|答|叫)/g;
    while ((dm = quotePattern.exec(sampleText)) !== null) {
        _hitName(dm[1], dm.index);
    }

    // ===== 第4层：子串去重 + 频次过滤 + 智能描述 =====

    // 🔑 子串去重：如果"高长青"(freq=20)已存在，则"高长"(freq=5)和"长青"(freq=3)被排除
    // 原理：长名字包含短名字，且长名字频次更高 → 短名字是误切割
    const allCandidateNames = Object.keys(nameFreq);
    const substringBlacklist = new Set();
    // 按名字长度降序排列，长名字优先
    allCandidateNames.sort((a, b) => b.length - a.length);
    for (var li = 0; li < allCandidateNames.length; li++) {
        var longName = allCandidateNames[li];
        if (substringBlacklist.has(longName)) continue;
        for (var si = li + 1; si < allCandidateNames.length; si++) {
            var shortName = allCandidateNames[si];
            // 短名字是长名字的子串，且长名字频次 >= 短名字频次的30%
            if (longName.includes(shortName) && nameFreq[longName] >= nameFreq[shortName] * 0.3) {
                substringBlacklist.add(shortName);
            }
        }
    }

    // 从上下文片段中提取角色描述
    function _buildCharDesc(name, contexts, freq) {
        var traits = [];
        var allCtx = contexts.join(' ');

        // 性别推断（只在该角色自己的上下文中查找）
        var femaleHints = /她|姐|妹|娘|媳|嫂|婆|公主|皇后|夫人|小姐|姑娘|仙子|闺|妃|美人|少女|女儿|母亲|娘亲|丫鬟|婢女|女侠|姐姐|妹妹|奶奶|阿姨|婶婶/;
        var maleHints = /他|兄|弟|爷|叔|伯|侯|将|帅|先生|少年|公子|世子|殿下|大人|老爷|少侠|少主|大哥|弟弟|爷爷|叔叔|伯伯|父亲|爹|师兄|师弟|壮汉/;
        var fHit = femaleHints.test(allCtx);
        var mHit = maleHints.test(allCtx);
        if (fHit && !mHit) traits.push('女');
        else if (mHit && !fHit) traits.push('男');

        // 身份/称谓提取（精确匹配该角色名+称谓）
        var titleRe = new RegExp(name + '(?:师兄|师姐|师弟|师妹|前辈|老师|教授|队长|将军|大人|大哥|大姐|哥哥|姐姐|弟弟|妹妹|叔叔|阿姨|爷爷|奶奶)');
        var titleMatch = allCtx.match(titleRe);
        if (titleMatch) {
            var t = titleMatch[0].replace(name, '');
            if (t && !traits.includes(t)) traits.push(t);
        }
        var preTitleRe = new RegExp('(?:师父|师傅|掌门|宗主|长老|护法|圣女|圣子|使者|首领|头目|老板|老大|王爷|皇上|陛下|殿下)' + name);
        var preTitleMatch = allCtx.match(preTitleRe);
        if (preTitleMatch) {
            var pt = preTitleMatch[0].replace(name, '');
            if (pt && !traits.includes(pt)) traits.push(pt);
        }

        // 身份描述 — "xxx是xxx的弟子"
        var idRe = new RegExp(name + '(?:是|乃|本是|原是)([\\u4e00-\\u9fa5]{2,15})');
        var idMatch = idRe.exec(allCtx);
        if (idMatch && idMatch[1]) {
            var idDesc = idMatch[1].replace(/[，。！？]/g, '').substring(0, 12);
            if (idDesc.length >= 2 && !traits.includes(idDesc)) traits.push(idDesc);
        }

        // 性格/语气推断
        var coldRe = new RegExp(name + '(?:冷声|冷笑|冷哼|冰冷|淡漠|漠然)');
        var gentleRe = new RegExp(name + '(?:柔声|轻声|温柔|微笑|淡淡|轻笑|莞尔)');
        var angryRe = new RegExp(name + '(?:怒道|怒吼|厉声|斥道|喝道|咆哮|骂道)');
        if (coldRe.test(allCtx)) traits.push('性格冷峻');
        else if (gentleRe.test(allCtx)) traits.push('性格温和');
        else if (angryRe.test(allCtx)) traits.push('性格刚烈');

        // 组合描述
        if (traits.length > 0) {
            return traits.join('，') + `（出现${freq}次）`;
        }
        return freq >= 10 ? `主要角色（出现${freq}次）` : `配角（出现${freq}次）`;
    }

    // 按频次降序排列，排除子串，提高频次门槛
    const sortedNames = Object.entries(nameFreq)
        .filter(([name]) => !substringBlacklist.has(name))
        .sort((a, b) => b[1] - a[1]);
    var textCharCount = 0;
    sortedNames.forEach(([name, freq]) => {
        if (addedNames.has(name)) return;
        if (textCharCount >= 15) return; // 最多从正文提取15个角色
        if (freq >= 5) {
            var desc = _buildCharDesc(name, nameContexts[name] || [], freq);
            _addChar(name, desc, 'text_major');
            textCharCount++;
        } else if (freq >= 3) {
            var desc2 = _buildCharDesc(name, nameContexts[name] || [], freq);
            _addChar(name, desc2, 'text_minor');
            textCharCount++;
        }
    });

    // 保留已有角色的imageUrl（避免重新生成时丢失图片）
    if (novelState.characters && novelState.characters.length > 0) {
        var oldCharsMap = {};
        novelState.characters.forEach(function (oc) { if (oc.imageUrl) oldCharsMap[oc.name] = oc; });
        chars.forEach(function (nc) {
            var old = oldCharsMap[nc.name];
            if (old) {
                nc.imageUrl = old.imageUrl;
                if (old._generating) nc._generating = old._generating;
                // 保留更详细的描述
                if (old.desc && old.desc.length > nc.desc.length && !nc.desc.includes('主要角色')) nc.desc = old.desc;
            }
        });
    }

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
            { role: 'system', content: '你是' + genre + '小说作家兼编辑。你需要修复章节中的一致性问题，同时保持原文风格和情节不变。只修改有问题的部分，其他内容尽量保持原样。直接输出修改后的完整章节正文。全文使用中文，严禁混入英文单词。' },
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
// 各平台格式规则：indent=段首缩进, paragraphGap=段落间空行数, titleInContent=正文是否包含标题, titleFormat=标题格式
const NOVEL_PLATFORMS = [
    { id: 'fanqie', name: '番茄小说', icon: '🍅', url: 'https://fanqienovel.com/writer/zone/', appScheme: 'snssdk1128://', appLink: 'https://fanqienovel.com/writer/zone/', desc: '字节旗下，流量大，新人友好', format: 'txt', indent: '　　', paragraphGap: 1, titleInContent: false, titleFormat: '', tip: '番茄后台会自动设置章节标题，正文不需要带标题。每段开头自动缩进两个全角空格。' },
    { id: 'qimao', name: '七猫中文网', icon: '🐱', url: 'https://www.qimao.com', appScheme: 'qimao://', appLink: 'https://www.qimao.com', desc: '免费阅读平台，签约门槛低', format: 'txt', indent: '　　', paragraphGap: 1, titleInContent: false, titleFormat: '', tip: '七猫后台单独填写标题，正文只粘贴正文内容即可。段首自动缩进。' },
    { id: 'qidian', name: '起点/阅文', icon: '📖', url: 'https://write.qq.com/', appScheme: 'qidian://', appLink: 'https://write.qq.com/', desc: '阅文作家专区，网文龙头', format: 'txt', indent: '　　', paragraphGap: 1, titleInContent: false, titleFormat: '', tip: '起点作家专区会单独设置标题，复制正文即可。段首自动缩进两个全角空格。' },
    { id: 'feilu', name: '飞卢小说', icon: '🦅', url: 'https://b.faloo.com/', appScheme: 'faloo://', appLink: 'https://b.faloo.com/', desc: '同人/系统文热门平台', format: 'txt', indent: '　　', paragraphGap: 1, titleInContent: true, titleFormat: 'chapter', tip: '飞卢建议正文开头带章节标题。段首自动缩进。' },
    { id: 'zongheng', name: '纵横中文网', icon: '📚', url: 'https://www.zongheng.com', appScheme: 'zongheng://', appLink: 'https://www.zongheng.com', desc: '老牌网文平台', format: 'txt', indent: '　　', paragraphGap: 1, titleInContent: false, titleFormat: '', tip: '纵横后台单独填写标题，正文粘贴内容即可。段首自动缩进。' },
    { id: 'ciweimao', name: '刺猬猫', icon: '🦔', url: 'https://www.ciweimao.com', appScheme: 'ciweimao://', appLink: 'https://www.ciweimao.com', desc: '二次元/轻小说平台', format: 'txt', indent: '', paragraphGap: 1, titleInContent: false, titleFormat: '', tip: '刺猬猫不需要段首缩进（平台会自动处理），直接粘贴纯正文。' },
    { id: 'tadu', name: '塔读文学', icon: '📕', url: 'https://www.tadu.com', appScheme: 'tadu://', appLink: 'https://www.tadu.com', desc: '男频小说平台', format: 'txt', indent: '　　', paragraphGap: 1, titleInContent: false, titleFormat: '', tip: '塔读后台单独设置标题，正文粘贴即可。段首自动缩进。' },
    { id: 'shuqi', name: '书旗小说', icon: '📗', url: 'https://www.shuqi.com', appScheme: 'shuqi://', appLink: 'https://www.shuqi.com', desc: '阿里旗下小说平台', format: 'txt', indent: '　　', paragraphGap: 1, titleInContent: false, titleFormat: '', tip: '书旗后台单独设置标题，正文粘贴即可。段首自动缩进。' }
];

// 根据平台规则格式化章节正文
function _novelFormatContent(content, platform) {
    if (!content) return '';
    var indent = platform ? (platform.indent || '') : '';
    var gap = platform ? (platform.paragraphGap || 1) : 1;
    // 按换行拆分段落，去除空段落，重新组合
    var paragraphs = content.split(/\n+/).filter(function (p) { return p.trim().length > 0; });
    // 给每段添加缩进（如果段落本身已有缩进则不重复添加）
    paragraphs = paragraphs.map(function (p) {
        var trimmed = p.trim();
        if (!indent) return trimmed;
        // 已有全角空格缩进的不重复加
        if (trimmed.startsWith('\u3000\u3000')) return trimmed;
        return indent + trimmed;
    });
    // 用指定数量的空行连接段落
    var separator = '\n' + '\n'.repeat(gap);
    return paragraphs.join(separator);
}

// 格式化单章完整文本（含或不含标题）
function _novelFormatChapter(chapterIdx, chapter, platform) {
    var titleLine = '';
    if (!platform || platform.titleInContent) {
        titleLine = '第' + (chapterIdx + 1) + '章 ' + chapter.title + '\n\n';
    }
    return titleLine + _novelFormatContent(chapter.content, platform);
}

// 获取当前选中的目标平台
function _novelGetSelectedPlatform() {
    var sel = document.getElementById('publishTargetPlatform');
    var platformId = sel ? sel.value : 'fanqie';
    return NOVEL_PLATFORMS.find(function (x) { return x.id === platformId; }) || NOVEL_PLATFORMS[0];
}

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
    html += `</select>
                    <div class="publish-platform-tip" id="publishPlatformTip" style="margin-top:6px;padding:8px 10px;background:rgba(249,115,22,0.1);border-radius:8px;font-size:12px;color:#f97316;line-height:1.5;"></div>
                </div>
                <div class="publish-format-preview" style="margin:8px 0;">
                    <button onclick="novelShowFormatPreview()" class="publish-btn-export" style="font-size:12px;padding:6px 12px;">👁️ 预览格式化效果</button>
                </div>
                <div id="publishFormatPreview" style="display:none;margin:8px 0;padding:10px;background:rgba(255,255,255,0.05);border:1px solid #333;border-radius:8px;max-height:200px;overflow-y:auto;font-size:12px;white-space:pre-wrap;color:#ccc;font-family:monospace;"></div>
                <div class="publish-chapter-list" id="publishChapterList">`;
    done.forEach((ch, i) => {
        var pubTag = ch._published ? '<span style="font-size:11px;color:#22c55e;margin-left:6px;font-weight:600;">✅ 已发布</span>' : '';
        html += `<div class="publish-ch-item" style="${ch._published ? 'border-left:3px solid #22c55e;padding-left:8px;' : ''}">
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
                <span>${_novelDisplayTitle(ch, i)} (${(ch.wordCount || 0).toLocaleString()}字)</span>${pubTag}
            </div>
            <div class="publish-ch-btns">
                <button onclick="novelPublishCopyTitle(${i})" title="复制章节标题">🏷️</button>
                <button onclick="novelPublishCopyChapter(${i})" title="复制正文">📋</button>
                <button onclick="novelPublishChapterTo(${i})" title="复制并跳转平台" class="publish-ch-go">📋→</button>
                <button onclick="novelMarkPublished(${i})" title="${ch._published ? '取消已发布' : '标记为已发布'}" style="font-size:12px;">${ch._published ? '✅' : '⬜'}</button>
            </div>
        </div>`;
    });
    html += `</div></div></div></div>`;


    // 移除旧面板
    var old = document.getElementById('novelPublishOverlay');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    // 初始化平台提示 + 监听切换
    _novelUpdatePlatformTip();
    var platformSel = document.getElementById('publishTargetPlatform');
    if (platformSel) {
        platformSel.addEventListener('change', function () {
            _novelUpdatePlatformTip();
            // 如果预览区可见，自动刷新
            var previewEl = document.getElementById('publishFormatPreview');
            if (previewEl && previewEl.style.display !== 'none') novelShowFormatPreview();
        });
    }
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
    var platform = _novelGetSelectedPlatform();
    var text = done.map(function (c, i) {
        return _novelFormatChapter(i, c, platform);
    }).join('\n\n' + '='.repeat(40) + '\n\n');
    navigator.clipboard.writeText(text).then(function () {
        showToast('已复制全书（' + platform.name + '格式，' + done.length + '章）');
    });
}

function novelPublishDownloadTxt() {
    var done = novelState.chapters.filter(c => c.status === 'done');
    var theme = document.getElementById('novelThemeInput').value || '未命名小说';
    var platform = _novelGetSelectedPlatform();
    var text = done.map(function (c, i) {
        return _novelFormatChapter(i, c, platform);
    }).join('\n\n\n');
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = theme + '_' + platform.name + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('已下载 ' + platform.name + ' 格式 TXT');
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
    var platform = _novelGetSelectedPlatform();
    var text = _novelFormatChapter(idx, ch, platform);
    navigator.clipboard.writeText(text).then(function () {
        showToast('已复制第' + (idx + 1) + '章（' + platform.name + '格式）');
    });
}

function novelPublishChapterTo(idx) {
    var done = novelState.chapters.filter(c => c.status === 'done');
    var ch = done[idx];
    if (!ch) return;
    var platform = _novelGetSelectedPlatform();
    var text = _novelFormatChapter(idx, ch, platform);
    navigator.clipboard.writeText(text).then(function () {
        // 自动标记为已发布
        ch._published = true;
        try { novelSaveCurrentProject(); } catch (e) { }
        // 刷新面板中该章的显示状态
        _novelRefreshPublishChapterList();
        showToast('已复制第' + (idx + 1) + '章（' + platform.name + '格式），正在跳转...');
        novelPublishTo(platform.id);
    });
}

function novelPublishCopyTitle(idx) {
    var done = novelState.chapters.filter(c => c.status === 'done');
    var ch = done[idx];
    if (!ch) return;
    var title = _novelDisplayTitle(ch, idx);
    navigator.clipboard.writeText(title).then(function () {
        showToast('已复制标题：' + title);
    });
}

function novelMarkPublished(idx) {
    var done = novelState.chapters.filter(c => c.status === 'done');
    var ch = done[idx];
    if (!ch) return;
    ch._published = !ch._published;
    try { novelSaveCurrentProject(); } catch (e) { }
    _novelRefreshPublishChapterList();
    showToast(ch._published ? '第' + (idx + 1) + '章 已标记为已发布' : '第' + (idx + 1) + '章 已取消发布标记');
}

function _novelRefreshPublishChapterList() {
    var listEl = document.getElementById('publishChapterList');
    if (!listEl) return;
    var done = novelState.chapters.filter(c => c.status === 'done');
    var html = '';
    done.forEach(function (ch, i) {
        var pubTag = ch._published ? '<span style="font-size:11px;color:#22c55e;margin-left:6px;font-weight:600;">✅ 已发布</span>' : '';
        html += '<div class="publish-ch-item" style="' + (ch._published ? 'border-left:3px solid #22c55e;padding-left:8px;' : '') + '">' +
            '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">' +
            '<span>' + _novelDisplayTitle(ch, i) + ' (' + (ch.wordCount || 0).toLocaleString() + '字)</span>' + pubTag +
            '</div>' +
            '<div class="publish-ch-btns">' +
            '<button onclick="novelPublishCopyTitle(' + i + ')" title="复制章节标题">🏷️</button>' +
            '<button onclick="novelPublishCopyChapter(' + i + ')" title="复制正文">📋</button>' +
            '<button onclick="novelPublishChapterTo(' + i + ')" title="复制并跳转平台" class="publish-ch-go">📋→</button>' +
            '<button onclick="novelMarkPublished(' + i + ')" title="' + (ch._published ? '取消已发布' : '标记为已发布') + '" style="font-size:12px;">' + (ch._published ? '✅' : '⬜') + '</button>' +
            '</div></div>';
    });
    listEl.innerHTML = html;
}

// 更新平台格式提示
function _novelUpdatePlatformTip() {
    var platform = _novelGetSelectedPlatform();
    var tipEl = document.getElementById('publishPlatformTip');
    if (tipEl && platform.tip) {
        tipEl.innerHTML = '💡 <b>' + platform.name + '</b>：' + platform.tip;
    } else if (tipEl) {
        tipEl.innerHTML = '';
    }
}

// 预览格式化效果（显示第一章前200字）
function novelShowFormatPreview() {
    var previewEl = document.getElementById('publishFormatPreview');
    if (!previewEl) return;
    var done = novelState.chapters.filter(function (c) { return c.status === 'done'; });
    if (done.length === 0) { previewEl.textContent = '没有已完成章节'; previewEl.style.display = 'block'; return; }
    var platform = _novelGetSelectedPlatform();
    var formatted = _novelFormatChapter(0, done[0], platform);
    // 截取前400字符预览
    var preview = formatted.length > 400 ? formatted.substring(0, 400) + '\n\n...（已截取前400字预览）' : formatted;
    previewEl.textContent = preview;
    previewEl.style.display = 'block';
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
    _novelRenderCharCards();

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
        _novelRenderCharCards();
        // 持久化保存到 localStorage
        try { novelSaveCurrentProject(); } catch (e) { }
        showToast('✅ ' + ch.name + ' 角色设计图已生成');
    } catch (e) {
        ch._generating = false;
        _novelRenderCharCards();
        showToast('角色图生成失败: ' + e.message);
    }
}

// 重新识别角色（清除旧角色后重新提取）
function novelReExtractCharacters() {
    if (!novelState.chapters || novelState.chapters.filter(function (c) { return c.status === 'done'; }).length === 0) {
        showToast('暂无已完成章节，无法识别角色');
        return;
    }
    var oldCount = (novelState.characters || []).length;
    if (oldCount > 0 && !confirm('当前已有 ' + oldCount + ' 个角色，重新识别将清除现有角色列表（已生成的角色图也会丢失），确认？')) return;
    novelState.characters = [];
    novelExtractCharacters();
    var newCount = (novelState.characters || []).length;
    _novelRenderCharCards();
    try { novelSaveCurrentProject(); } catch (e) { }
    showToast('🔄 已重新识别角色：' + newCount + ' 个');
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

// ==================== 13c. 章节智能配音（分段+智能音色+记忆） ====================

// TTS音色配置（DubbingX音色，动态加载填充）
let NOVEL_TTS_VOICES = [];
var _novelVoiceListLoaded = false;

// 动态加载DubbingX音色列表（和voice.html一致）
async function _novelLoadDubbingXVoices() {
    if (_novelVoiceListLoaded && NOVEL_TTS_VOICES.length > 0) return;
    try {
        var res = await fetch('/api/yunwu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'tts-voices', grade: 'premium' })
        });
        var data = await res.json();
        if (data.success && data.voices && data.voices.length > 0) {
            NOVEL_TTS_VOICES = data.voices.map(function (v) {
                return {
                    id: v.voiceId || v.id,
                    label: v.name + ' (' + (v.gender === 1 ? '男声' : '女声') + ')',
                    engine: 'dubbingx',
                    language: 'zh',
                    gender: v.gender
                };
            });
            _novelVoiceListLoaded = true;
            console.log('[novel-tts] DubbingX音色加载成功，共' + NOVEL_TTS_VOICES.length + '个');
        }
    } catch (e) {
        console.warn('[novel-tts] DubbingX音色加载失败:', e.message);
    }
}

// 智能检测适合的配音音色（根据角色性别+小说题材）
function _novelDetectChapterVoice() {
    // 兼容旧数据：如果已保存的配置使用了旧的Azure音色ID，自动清除重新检测
    if (novelState._voicePrefs && novelState._voicePrefs.voiceName) {
        var oldName = novelState._voicePrefs.voiceName;
        if (/Neural$/i.test(oldName)) {
            console.log('[novel-tts] 检测到旧Azure音色ID ' + oldName + '，重新选择DubbingX音色');
            novelState._voicePrefs = null;
        } else {
            return novelState._voicePrefs;
        }
    }
    // 从DubbingX音色列表中根据性别智能选择
    var chars = novelState.characters || [];
    var femaleRe = /女|母|姐|妹|娘|媳|嫂|婆|公主|皇后|夫人|小姐|女孩|女子|仙子|姑娘|闺|妃/;
    var maleRe = /男|父|兄|弟|王|侯|将|帅|先生|少年|少侠|大人|老爷|公子|世子|殿下/;
    var fScore = 0, mScore = 0;
    chars.forEach(function (c) {
        var d = (c.name || '') + (c.desc || '');
        if (femaleRe.test(d)) fScore++;
        if (maleRe.test(d)) mScore++;
    });
    var preferGender = mScore > fScore ? 1 : 2; // 1=男 2=女
    // 从DubbingX已加载的音色列表中挑选匹配性别的第一个
    var voiceId = '';
    if (NOVEL_TTS_VOICES.length > 0) {
        var matched = NOVEL_TTS_VOICES.find(function (v) { return v.gender === preferGender; });
        voiceId = matched ? matched.id : NOVEL_TTS_VOICES[0].id;
    }
    return { engine: 'dubbingx', voiceName: voiceId, voiceId: voiceId };
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
async function novelShowVoiceSelector(callback) {
    // 先加载音色列表
    await _novelLoadDubbingXVoices();
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
    var panel = document.createElement('div');
    panel.style.cssText = 'background:#1a1a2e;border-radius:16px;padding:20px;width:90%;max-width:360px;max-height:80vh;overflow-y:auto;';
    panel.innerHTML = '<div style="font-size:16px;font-weight:bold;color:#fff;margin-bottom:12px;">🎤 选择配音音色</div>';
    if (NOVEL_TTS_VOICES.length === 0) {
        panel.innerHTML += '<div style="color:#f66;padding:12px;text-align:center;">音色列表加载失败，请检查网络后重试</div>';
    }
    var currentVoice = (novelState._voicePrefs && (novelState._voicePrefs.voiceId || novelState._voicePrefs.voiceName)) || '';
    NOVEL_TTS_VOICES.forEach(function (v) {
        var sel = v.id === currentVoice;
        var btn = document.createElement('button');
        btn.style.cssText = 'display:block;width:100%;padding:12px;margin:6px 0;border-radius:10px;border:2px solid ' + (sel ? '#6c5ce7' : '#333') + ';background:' + (sel ? '#2d2b55' : '#222') + ';color:#fff;text-align:left;cursor:pointer;font-size:14px;';
        btn.innerHTML = '<div>' + (sel ? '✅ ' : '') + '<b>' + v.label + '</b></div>';
        btn.onclick = function () {
            novelState._voicePrefs = { engine: 'dubbingx', voiceName: v.id, voiceId: v.id };
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

    // 先加载DubbingX音色列表（如果尚未加载）
    await _novelLoadDubbingXVoices();

    // 智能检测音色（首次自动检测并保存，后续复用）
    var voiceConfig = _novelDetectChapterVoice();
    // 如果音色列表加载失败且voiceId为空，提示用户手动选择
    if (!voiceConfig.voiceId && !voiceConfig.voiceName) {
        showToast('⚠️ 音色列表未加载，请先点击🎤选择音色');
        return;
    }
    if (!novelState._voicePrefs || !novelState._voicePrefs.voiceName) {
        novelState._voicePrefs = voiceConfig;
        try { novelSaveCurrentProject(); } catch (e) { }
        var autoV = NOVEL_TTS_VOICES.find(function (v) { return v.id === (voiceConfig.voiceId || voiceConfig.voiceName); });
        showToast('🎤 智能选择音色：' + (autoV ? autoV.label : (voiceConfig.voiceId || voiceConfig.voiceName)));
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
                engine: voiceConfig.engine || 'dubbingx',
                voiceName: voiceConfig.voiceName || '',
                voiceId: voiceConfig.voiceId || voiceConfig.voiceName || ''
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
                <button onclick="event.stopPropagation();if(confirm('确认重写第${i + 1}章？原内容将被覆盖'))novelRewriteChapter(${i})">🔄 重写</button>
                <button onclick="event.stopPropagation();novelShowTweakModal(${i})">✏️ 微调</button>
                <button onclick="event.stopPropagation();novelOpenReader(${i})">👁️ 阅读</button>
                <button onclick="event.stopPropagation();if(confirm('为第${i + 1}章生成配音？将消耗胶片'))novelTTSChapter(${i})">🎤 配音</button>
                <button onclick="event.stopPropagation();novelShowVoiceSelector()">🎙️ 换音色</button>
                <button onclick="event.stopPropagation();if(confirm('为第${i + 1}章生成场景图？将消耗约5胶片'))novelGenerateSceneImage(${i})">🖼️ 场景</button>
                <button onclick="event.stopPropagation();if(confirm('对第${i + 1}章进行去AI化润色？将消耗胶片'))novelDeAIChapter(${i})">🧹 去AI</button>
            </div>${sceneHtml}${audioHtml}` : ch.status === 'error' ? `
            <div class="ch-actions">
                <button onclick="event.stopPropagation();novelRetryChapter(${i})">🔄 重试</button>
            </div>` : '';

        return `<div class="novel-chapter-item" onclick="novelViewChapter(${i})" style="cursor:pointer;">
            <span>${icon} ${_novelDisplayTitle(ch, i)} ${wordInfo}</span>
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

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        novelEnhancedInit();
        _novelLoadDubbingXVoices();
    });
} else {
    novelEnhancedInit();
    _novelLoadDubbingXVoices();
}
