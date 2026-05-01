/**
 * 宫格切割 → 批量图生视频
 * 上传宫格图(16/12/9/8/4格)，自动切割，每格填提示词，批量图生视频
 */
var _gridSplitState = {
    gridSize: 4,
    originalImage: null,
    originalDataUrl: '',
    pieces: [],
    generating: false
};

function selectGridType(size) {
    _gridSplitState.gridSize = size;
    document.querySelectorAll('.grid-type-btn').forEach(function(btn) {
        btn.classList.toggle('active', parseInt(btn.dataset.grid) === size);
    });
    if (_gridSplitState.originalImage) performGridSplit();
}

function openGridSplit() {
    var section = document.getElementById('gridSplitSection');
    var btn = document.getElementById('gridSplitOpenBtn');
    if (section) section.style.display = 'block';
    if (btn) btn.style.display = 'none';
}

function closeGridSplit() {
    var section = document.getElementById('gridSplitSection');
    var btn = document.getElementById('gridSplitOpenBtn');
    if (section) section.style.display = 'none';
    if (btn) btn.style.display = 'block';
    _gridSplitState.originalImage = null;
    _gridSplitState.originalDataUrl = '';
    _gridSplitState.pieces = [];
}

function handleGridSplitUpload(input) {
    if (!input.files || input.files.length === 0) return;
    var file = input.files[0];
    console.log('[grid-split] upload:', file.name);
    var reader = new FileReader();
    reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
            _gridSplitState.originalImage = img;
            _gridSplitState.originalDataUrl = e.target.result;
            var uploadArea = document.getElementById('gridSplitUploadArea');
            if (uploadArea) {
                uploadArea.innerHTML = '<img src="' + e.target.result + '" style="max-width:100%;max-height:160px;border-radius:6px;"><div style="color:#888;font-size:11px;margin-top:6px;">点击更换图片</div>';
            }
            performGridSplit();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function performGridSplit() {
    var img = _gridSplitState.originalImage;
    if (!img) return;
    var size = _gridSplitState.gridSize;
    var rows, cols;
    if (size === 4) { rows = 2; cols = 2; }
    else if (size === 6) { rows = 2; cols = 3; }
    else if (size === 8) { rows = 2; cols = 4; }
    else if (size === 9) { rows = 3; cols = 3; }
    else if (size === 12) { rows = 3; cols = 4; }
    else if (size === 16) { rows = 4; cols = 4; }
    else { rows = 2; cols = 2; }
    // 先计算理想的格子尺寸
    var cellW = Math.floor(img.naturalWidth / cols);
    var cellH = Math.floor(img.naturalHeight / rows);
    // 把原图缩放到完美匹配的尺寸（刚好是行数×列数的倍数），避免错位
    var scaledCanvas = document.createElement('canvas');
    var scaledW = cellW * cols;
    var scaledH = cellH * rows;
    scaledCanvas.width = scaledW;
    scaledCanvas.height = scaledH;
    var scaledCtx = scaledCanvas.getContext('2d');
    scaledCtx.drawImage(img, 0, 0, scaledW, scaledH);
    console.log('[grid-split] 宫格选择: ' + rows + 'x' + cols + ' = ' + size + '格, 原图: ' + img.naturalWidth + 'x' + img.naturalHeight + ', 缩放后: ' + scaledW + 'x' + scaledH + ', 格子尺寸: ' + cellW + 'x' + cellH);
    _gridSplitState.pieces = [];
    var previewEl = document.getElementById('gridSplitPreview');
    var actionsEl = document.getElementById('gridSplitActions');
    var resultsEl = document.getElementById('gridSplitResults');
    if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }
    var html = '<div style="font-size:12px;color:#fbbf24;margin-bottom:8px;">✂️ 已切割为 ' + rows + '×' + cols + ' = ' + size + '张，为每张选择模型和填写提示词：</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:10px;">';
    for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
            var idx = r * cols + c;
            var canvas = document.createElement('canvas');
            canvas.width = cellW; canvas.height = cellH;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(scaledCanvas, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
            var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            _gridSplitState.pieces.push({ dataUrl: dataUrl, prompt: '', model: '', videoUrl: null, status: 'pending' });
            html += '<div id="gridCard_' + idx + '" style="background:#1a1a24;border-radius:8px;padding:8px;border:1px solid #333;">';
            html += '<img src="' + dataUrl + '" style="width:100%;border-radius:4px;display:block;">';
            html += '<div style="font-size:10px;color:#666;margin-top:4px;text-align:center;">第 ' + (idx + 1) + ' 格</div>';
            // 独立视频模型选择
            html += '<select id="gridModel_' + idx + '" onchange="_gridSplitState.pieces[' + idx + '].model=this.value" style="width:100%;margin-top:4px;padding:4px 6px;background:#111;border:1px solid #333;border-radius:4px;color:#aaa;font-size:10px;">';
            html += '<option value="">跟随全局模型</option>';
html += '<option value="modelscope-video">🆓 魔塔视频（免费）</option>';
html += '<option value="veo3.1-components-4k">Veo 3.1 4K (推荐)</option>';
html += '<option value="veo_3_1-fast-4K">Veo 3.1 Fast 4K (快速)</option>';
html += '<option value="veo_3_1-fast-components-4K">veo_3_1-fast-components-4K</option>';
html += '<option value="veo_3_1-components-4K">Veo 3.1 Components 4K</option>';
html += '<option value="vidu-q2-5s-720p">Vidu q2 5秒 720P (25胶片/支持7图)</option>';
html += '<option value="vidu-q2-5s-1080p">Vidu q2 5秒 1080P (36胶片/支持7图)</option>';
html += '<option value="vidu-q2-pro-5s-720p">Vidu q2-pro 5秒 720P (27胶片)</option>';
html += '<option value="vidu-q2-pro-5s-1080p">Vidu q2-pro 5秒 1080P (54胶片)</option>';
html += '<option value="vidu-q2-turbo-5s-720p">Vidu q2-turbo 5秒 720P (19胶片/最快)</option>';
html += '<option value="vidu-q2-turbo-5s-1080p">Vidu q2-turbo 5秒 1080P (36胶片)</option>';
html += '<option value="vidu-q3-pro-5s-720p">Vidu q3-pro 5秒 720P (72胶片/顶级)</option>';
html += '<option value="vidu-q3-pro-5s-1080p">Vidu q3-pro 5秒 1080P (77胶片/顶级)</option>';
html += '<option value="vidu-q2-10s-720p">Vidu q2 10秒 720P (50胶片/支持7图)</option>';
html += '<option value="vidu-q2-10s-1080p">Vidu q2 10秒 1080P (72胶片/支持7图)</option>';
html += '<option value="vidu-q2-pro-10s-720p">Vidu q2-pro 10秒 720P (54胶片)</option>';
html += '<option value="vidu-q2-pro-10s-1080p">Vidu q2-pro 10秒 1080P (108胶片)</option>';
html += '<option value="vidu-q2-turbo-10s-720p">Vidu q2-turbo 10秒 720P (38胶片)</option>';
html += '<option value="vidu-q2-turbo-10s-1080p">Vidu q2-turbo 10秒 1080P (72胶片)</option>';
html += '<option value="vidu-q3-pro-10s-720p">Vidu q3-pro 10秒 720P (144胶片/顶级)</option>';
html += '<option value="vidu-q3-pro-10s-1080p">Vidu q3-pro 10秒 1080P (154胶片/顶级)</option>';
html += '<option value="hailuo-02-768p-6s">海螺 02 6秒 768P (7胶片)</option>';
html += '<option value="hailuo-02-1080p-6s">海螺 02 6秒 1080P (12胶片)</option>';
html += '<option value="hailuo-fast-768p-6s">海螺 Fast 6秒 768P (5胶片/最快)</option>';
html += '<option value="hailuo-fast-1080p-6s">海螺 Fast 6秒 1080P (8胶片)</option>';
html += '<option value="hailuo-02-768p-10s">海螺 02 10秒 768P (11胶片)</option>';
html += '<option value="hailuo-02-1080p-10s">海螺 02 10秒 1080P (20胶片)</option>';
html += '<option value="hailuo-fast-768p-10s">海螺 Fast 10秒 768P (8胶片)</option>';
html += '<option value="hailuo-fast-1080p-10s">海螺 Fast 10秒 1080P (13胶片)</option>';
html += '<option value="kling-2.5-720p-5s">可灵 2.5 5秒 720P (5胶片/性价比)</option>';
html += '<option value="kling-2.5-1080p-5s">可灵 2.5 5秒 1080P (9胶片)</option>';
html += '<option value="kling-2.0-720p-5s">可灵 2.0 5秒 720P (7胶片)</option>';
html += '<option value="kling-2.0-1080p-5s">可灵 2.0 5秒 1080P (12胶片)</option>';
html += '<option value="kling-o1-720p-5s">可灵 O1 5秒 720P (15胶片/顶级)</option>';
html += '<option value="kling-o1-1080p-5s">可灵 O1 5秒 1080P (20胶片)</option>';
html += '<option value="kling-2.5-720p-10s">可灵 2.5 10秒 720P (10胶片)</option>';
html += '<option value="kling-2.5-1080p-10s">可灵 2.5 10秒 1080P (17胶片)</option>';
html += '<option value="kling-2.0-720p-10s">可灵 2.0 10秒 720P (14胶片)</option>';
html += '<option value="kling-2.0-1080p-10s">可灵 2.0 10秒 1080P (24胶片)</option>';
html += '<option value="kling-o1-720p-10s">可灵 O1 10秒 720P (31胶片)</option>';
html += '<option value="kling-o1-1080p-10s">可灵 O1 10秒 1080P (41胶片)</option>';
html += '<option value="grok-video-3">Grok Video 3 (6秒)</option>';
html += '<option value="grok-video-3-10s">Grok Video 3 (10秒)</option>';
html += '<option value="grok-video-3-15s">Grok Video 3 (15秒)</option>';
html += '<option value="wan26-720p-5s">Wan2.6 720p 5秒 (3胶片)</option>';
html += '<option value="wan26-1080p-5s">Wan2.6 1080p 5秒 (5胶片)</option>';
html += '<option value="wan26-720p-5s-audio">Wan2.6 720p 5秒 有声 (4胶片)</option>';
html += '<option value="wan26-1080p-5s-audio">Wan2.6 1080p 5秒 有声 (7胶片)</option>';
html += '<option value="wan26-720p-10s">Wan2.6 720p 10秒 (5胶片)</option>';
html += '<option value="wan26-1080p-10s">Wan2.6 1080p 10秒 (9胶片)</option>';
html += '<option value="wan26-720p-10s-audio">Wan2.6 720p 10秒 有声 (7胶片)</option>';
html += '<option value="wan26-1080p-10s-audio">Wan2.6 1080p 10秒 有声 (14胶片)</option>';
html += '<option value="wan26-720p-15s">Wan2.6 720p 15秒 (7胶片)</option>';
html += '<option value="wan26-1080p-15s">Wan2.6 1080p 15秒 (13胶片)</option>';
html += '<option value="wan26-720p-15s-audio">Wan2.6 720p 15秒 有声 (11胶片)</option>';
html += '<option value="wan26-1080p-15s-audio">Wan2.6 1080p 15秒 有声 (21胶片)</option>';
html += '<option value="ltx-video-5s">LTX-Video 5秒 (4胶片/快速)</option>';
html += '<option value="ltx-video-10s">LTX-Video 10秒 (7胶片)</option>';
html += '<option value="ltx-video-15s">LTX-Video 15秒 (10胶片)</option>';
html += '<option value="ltx-video-custom">LTX-Video 自定义时长</option>';
html += '</select>';
            // 提示词
            html += '<textarea id="gridPrompt_' + idx + '" placeholder="输入提示词..." oninput="_gridSplitState.pieces[' + idx + '].prompt=this.value" style="width:100%;margin-top:4px;padding:6px;background:#111;border:1px solid #333;border-radius:4px;color:#fff;font-size:11px;resize:none;height:44px;"></textarea>';
            // 单独生成按钮
            html += '<button onclick="startSingleGridGenerate(' + idx + ')" id="gridSingleBtn_' + idx + '" style="width:100%;margin-top:4px;padding:5px 8px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);border-radius:4px;color:#fbbf24;font-size:11px;cursor:pointer;text-align:center;">▶ 单独生成</button>';
            // 状态指示
            html += '<div id="gridStatus_' + idx + '" style="font-size:10px;color:#555;margin-top:3px;text-align:center;min-height:14px;"></div>';
            html += '</div>';
        }
    }
    html += '</div>';
    // 批量填充
    html += '<div style="margin-top:10px;display:flex;gap:6px;align-items:center;">';
    html += '<input id="gridBatchPrompt" placeholder="批量填充：输入通用提示词，回车应用到所有空格" onkeydown="if(event.key===\'Enter\'){applyBatchGridPrompt();event.preventDefault();}" style="flex:1;padding:8px;background:#111;border:1px solid #333;border-radius:6px;color:#fff;font-size:12px;">';
    html += '<button onclick="applyBatchGridPrompt()" style="padding:8px 12px;background:#333;border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer;">填充</button>';
    html += '<button onclick="clearAllGridPrompts()" style="padding:8px 12px;background:#333;border:none;border-radius:6px;color:#f87171;font-size:12px;cursor:pointer;">清空</button>';
    html += '</div>';
    if (previewEl) { previewEl.innerHTML = html; previewEl.style.display = 'block'; }
    if (actionsEl) actionsEl.style.display = 'block';
}

function applyBatchGridPrompt() {
    var el = document.getElementById('gridBatchPrompt');
    if (!el || !el.value.trim()) return;
    var val = el.value.trim();
    var count = 0;
    _gridSplitState.pieces.forEach(function(p, i) {
        if (!p.prompt) {
            p.prompt = val;
            var ta = document.getElementById('gridPrompt_' + i);
            if (ta) ta.value = val;
            count++;
        }
    });
    if (typeof showToast === 'function') showToast('已填充 ' + count + ' 个空格');
}

function clearAllGridPrompts() {
    _gridSplitState.pieces.forEach(function(p, i) {
        p.prompt = '';
        var ta = document.getElementById('gridPrompt_' + i);
        if (ta) ta.value = '';
    });
}

function redoGridSplit() {
    _gridSplitState.pieces.forEach(function(p) { p.videoUrl = null; p.status = 'pending'; });
    clearAllGridPrompts();
    var el = document.getElementById('gridSplitResults');
    if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    if (typeof showToast === 'function') showToast('已重置');
}

// ====== 单独生成某格视频 ======
async function startSingleGridGenerate(index) {
    var piece = _gridSplitState.pieces[index];
    if (!piece) return;
    if (!piece.prompt.trim()) { if (typeof showToast === 'function') showToast('请先填写提示词'); return; }

    var _gsLoggedIn = (typeof isLoggedIn !== 'undefined' && isLoggedIn) || (typeof currentUser !== 'undefined' && currentUser);
    if (!_gsLoggedIn) { if (typeof showToast === 'function') showToast('请先登录'); return; }

    // 确定模型：每格独立模型 > 全局模型
    var model = piece.model;
    if (!model) {
        var globalSelect = document.getElementById('gridSplitVideoModel');
        model = globalSelect ? globalSelect.value : 'grok-video-3-10s';
    }

    var costPerVideo = (typeof VIDEO_COST !== 'undefined') ? (VIDEO_COST[model] || 7) : 7;
    if (typeof userQuota !== 'undefined' && userQuota < costPerVideo) {
        if (typeof showToast === 'function') showToast('胶片不足，需要' + costPerVideo + '胶片');
        return;
    }

    var singleBtn = document.getElementById('gridSingleBtn_' + index);
    if (singleBtn) singleBtn.disabled = true;

    try {
        // 获取用户
        var curUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : ((typeof __mobileCurrentUser !== 'undefined') ? __mobileCurrentUser : null);
        if (!curUser || !curUser.id) {
            if (typeof _sbClient !== 'undefined' && _sbClient) {
                var sess = await _sbClient.auth.getSession();
                curUser = sess.data.session ? sess.data.session.user : null;
            }
        }
        if (!curUser || !curUser.id) { if (typeof showToast === 'function') showToast('请先登录'); return; }
        var userId = curUser.id;

        // 扣费
        var consumeRes = await fetch('/api/supabase-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'consume', userId: userId, amount: costPerVideo, description: '宫格切割单独生成 #' + (index + 1) + ' ' + model })
        });
        if (!consumeRes.ok) {
            var cd = await consumeRes.json().catch(function() { return {}; });
            throw new Error(cd.message || cd.error || '扣费失败');
        }
        var cd2 = await consumeRes.json().catch(function() { return {}; });
        if (typeof userQuota !== 'undefined') {
            userQuota = cd2.newBalance || (userQuota - costPerVideo);
            localStorage.setItem('film_balance', String(userQuota));
            if (typeof updateQuotaDisplay === 'function') updateQuotaDisplay(userQuota);
        }

        // 更新状态
        piece.status = 'generating';
        var se = document.getElementById('gridStatus_' + index);
        if (se) se.innerHTML = '🔄 生成中(' + model + ')...';

        var videoUrl = await generateGridSplitVideo(piece, model, userId);
        piece.videoUrl = videoUrl;
        piece.status = 'done';
        if (se) se.innerHTML = '✅ 完成 <a href="' + videoUrl + '" target="_blank" style="color:#60a5fa;">▶播放</a>';

        // 在卡片内替换图片为视频
        var card = document.getElementById('gridCard_' + index);
        if (card) {
            var im = card.querySelector('img');
            if (im) {
                var vid = document.createElement('video');
                vid.src = videoUrl; vid.controls = true; vid.autoplay = true; vid.loop = true; vid.muted = true;
                vid.style.cssText = 'width:100%;border-radius:4px;aspect-ratio:1;object-fit:cover;';
                im.parentNode.replaceChild(vid, im);
            }
        }

        // 同时更新底部结果区（如果有）
        var resultCard = document.getElementById('gridResult_' + index);
        if (resultCard) {
            var rim = resultCard.querySelector('img');
            if (rim) {
                var rvid = document.createElement('video');
                rvid.src = videoUrl; rvid.controls = true; rvid.autoplay = true; rvid.loop = true; rvid.muted = true;
                rvid.style.cssText = 'width:100%;border-radius:4px;aspect-ratio:1;object-fit:cover;';
                rim.parentNode.replaceChild(rvid, rim);
            }
        }

        if (typeof showToast === 'function') showToast('✅ 第 ' + (index + 1) + ' 格视频生成完成');
    } catch (err) {
        piece.status = 'error';
        var se2 = document.getElementById('gridStatus_' + index);
        if (se2) se2.innerHTML = '❌ ' + (err.message || 'err').substring(0, 20);
        if (typeof showToast === 'function') showToast('第 ' + (index + 1) + ' 格生成失败: ' + (err.message || ''));
        console.error('[grid-split] single #' + index + ' error:', err);
    } finally {
        if (singleBtn) singleBtn.disabled = false;
    }
}

// ====== 批量生成 ======
async function startGridSplitGenerate() {
    if (_gridSplitState.generating) { if (typeof showToast === 'function') showToast('正在生成中，请等待'); return; }
    var _gsLoggedIn = (typeof isLoggedIn !== 'undefined' && isLoggedIn) || (typeof currentUser !== 'undefined' && currentUser); if (!_gsLoggedIn) { if (typeof showToast === 'function') showToast('请先登录'); return; }
    var pieces = _gridSplitState.pieces;
    var activeCount = pieces.filter(function(p) { return p.prompt.trim(); }).length;
    if (activeCount === 0) { if (typeof showToast === 'function') showToast('请至少为一个格子填写提示词'); return; }

    // 计算总费用（每格可能用不同模型）
    var globalModel = (function() { var s = document.getElementById('gridSplitVideoModel'); return s ? s.value : 'grok-video-3-10s'; })();
    var totalCost = 0;
    pieces.forEach(function(p) {
        if (!p.prompt.trim()) return;
        var m = p.model || globalModel;
        var c = (typeof VIDEO_COST !== 'undefined') ? (VIDEO_COST[m] || 7) : 7;
        totalCost += c;
    });

    if (typeof userQuota !== 'undefined' && userQuota < totalCost) {
        if (typeof showToast === 'function') showToast('胶片不足，需要' + totalCost + '胶片（' + activeCount + '个）');
        return;
    }
    _gridSplitState.generating = true;
    var genBtn = document.getElementById('gridSplitGenBtn');
    if (genBtn) genBtn.disabled = true;
    try {
        // 获取用户
        var curUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : ((typeof __mobileCurrentUser !== 'undefined') ? __mobileCurrentUser : null);
        if (!curUser || !curUser.id) {
            if (typeof _sbClient !== 'undefined' && _sbClient) {
                var sess = await _sbClient.auth.getSession();
                curUser = sess.data.session ? sess.data.session.user : null;
            }
        }
        if (!curUser || !curUser.id) { if (typeof showToast === 'function') showToast('请先登录'); return; }
        var userId = curUser.id;
        // 扣费
        var consumeRes = await fetch('/api/supabase-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'consume', userId: userId, amount: totalCost, description: '宫格切割批量图生视频 ' + activeCount + '个' })
        });
        if (!consumeRes.ok) {
            var cd = await consumeRes.json().catch(function() { return {}; });
            throw new Error(cd.message || cd.error || '扣费失败');
        }
        var cd2 = await consumeRes.json().catch(function() { return {}; });
        if (typeof userQuota !== 'undefined') {
            userQuota = cd2.newBalance || (userQuota - totalCost);
            localStorage.setItem('film_balance', String(userQuota));
            if (typeof updateQuotaDisplay === 'function') updateQuotaDisplay(userQuota);
        }
        if (typeof showLoading === 'function') showLoading('🎬 正在生成 ' + activeCount + ' 个视频...');
        // 结果区
        var resultsEl = document.getElementById('gridSplitResults');
        if (resultsEl) resultsEl.style.display = 'block';
        var rhtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;">';
        pieces.forEach(function(p, i) {
            var modelLabel = p.model || globalModel;
            rhtml += '<div id="gridResult_' + i + '" style="background:#1a1a24;border-radius:8px;padding:8px;border:1px solid #333;text-align:center;">';
            rhtml += '<img src="' + p.dataUrl + '" style="width:100%;border-radius:4px;aspect-ratio:1;object-fit:cover;">';
            rhtml += '<div id="gridResultStatus_' + i + '" style="font-size:11px;color:#888;margin-top:4px;">' + (p.prompt.trim() ? '⏳ ' + modelLabel : '⊘ 无提示词') + '</div>';
            rhtml += '</div>';
        });
        rhtml += '</div>';
        if (resultsEl) resultsEl.innerHTML = rhtml;
        // 并发生成 2路
        var queue = [];
        pieces.forEach(function(p, i) { if (p.prompt.trim()) queue.push({ piece: p, index: i }); });
        var queueIdx = 0;
        async function processNext() {
            while (queueIdx < queue.length) {
                var item = queue[queueIdx++];
                var piece = item.piece;
                var index = item.index;
                var useModel = piece.model || globalModel;
                piece.status = 'generating';
                // 更新卡片内状态
                var se = document.getElementById('gridStatus_' + index);
                if (se) se.innerHTML = '🔄 ' + useModel + '...';
                // 更新结果区状态
                var rse = document.getElementById('gridResultStatus_' + index);
                if (rse) rse.innerHTML = '🔄 生成中(' + useModel + ')...';
                try {
                    var videoUrl = await generateGridSplitVideo(piece, useModel, userId);
                    piece.videoUrl = videoUrl;
                    piece.status = 'done';
                    if (se) se.innerHTML = '✅ 完成 <a href="' + videoUrl + '" target="_blank" style="color:#60a5fa;">▶播放</a>';
                    if (rse) rse.innerHTML = '✅ 完成';
                    // 更新卡片内图片→视频
                    var card = document.getElementById('gridCard_' + index);
                    if (card) {
                        var im = card.querySelector('img');
                        if (im) {
                            var vid = document.createElement('video');
                            vid.src = videoUrl; vid.controls = true; vid.autoplay = true; vid.loop = true; vid.muted = true;
                            vid.style.cssText = 'width:100%;border-radius:4px;aspect-ratio:1;object-fit:cover;';
                            im.parentNode.replaceChild(vid, im);
                        }
                    }
                    // 更新结果区图片→视频
                    var re = document.getElementById('gridResult_' + index);
                    if (re) {
                        var rim = re.querySelector('img');
                        if (rim) {
                            var rvid = document.createElement('video');
                            rvid.src = videoUrl; rvid.controls = true; rvid.autoplay = true; rvid.loop = true; rvid.muted = true;
                            rvid.style.cssText = 'width:100%;border-radius:4px;aspect-ratio:1;object-fit:cover;';
                            rim.parentNode.replaceChild(rvid, rim);
                        }
                    }
                } catch (err) {
                    console.error('[grid-split] #' + (index + 1) + ' failed:', err);
                    piece.status = 'error';
                    if (se) se.innerHTML = '❌ ' + (err.message || 'err').substring(0, 25);
                    if (rse) rse.innerHTML = '❌ 失败';
                }
            }
        }
        await Promise.all([processNext(), processNext()]);
        if (typeof hideLoading === 'function') hideLoading();
        var doneCount = pieces.filter(function(p) { return p.status === 'done'; }).length;
        if (typeof showToast === 'function') showToast('✅ 完成 ' + doneCount + '/' + activeCount + ' 个视频');
    } catch (err) {
        if (typeof hideLoading === 'function') hideLoading();
        if (typeof showToast === 'function') showToast('生成失败: ' + (err.message || ''));
        console.error('[grid-split] batch error:', err);
    } finally {
        _gridSplitState.generating = false;
        if (genBtn) genBtn.disabled = false;
    }
}

async function generateGridSplitVideo(piece, model, userId) {
    var prompt = piece.prompt || '让图片动起来，平滑过渡';
    var imageUrl = piece.dataUrl;
    var ratio = '1:1';
    var isWan26 = model && model.startsWith('wan26-');
    var isGrok = model && model.startsWith('grok-video');
    var isVeo = model && (model.startsWith('veo') || model.includes('veo'));
    var isVidu = model && model.startsWith('vidu-');
    var isHailuo = model && model.startsWith('hailuo-');
    var isKling = model && model.startsWith('kling-');
    var isLtxVideo = model && model.startsWith('ltx-');
    var isSeedance = model === 'seedance-i2v' || model === 'seedance-ref';

    var apiEndpoint, requestBody;

    if (isVidu) {
        // Vidu模型
        var vMatch = model.match(/vidu-(q\d+)-(pro|turbo)?-?(\d+)s-(\d+p)/i);
        var vVersion = vMatch ? vMatch[1] : 'q2';
        var vRes = vMatch ? vMatch[4] : '720p';
        var vDur = vMatch ? parseInt(vMatch[3]) : 5;
        apiEndpoint = '/api/yunwu';
        requestBody = {
            action: 'vidu',
            prompt: prompt,
            model_version: vVersion,
            aspect_ratio: ratio,
            duration: vDur,
            resolution: vRes,
            image_url: imageUrl,
            userId: userId,
            skip_billing: true
        };
    } else if (isHailuo) {
        // 海螺Hailuo模型
        var hMatch = model.match(/hailuo-(\w+)-(\d+)p-(\d+)s/i);
        var hVersion = hMatch ? hMatch[1] : '02';
        var hRes = hMatch ? hMatch[2] + 'p' : '768p';
        var hDur = hMatch ? parseInt(hMatch[3]) : 6;
        apiEndpoint = '/api/yunwu';
        requestBody = {
            action: 'hailuo',
            prompt: prompt,
            image_url: imageUrl,
            model_version: hVersion,
            duration: hDur,
            resolution: hRes,
            userId: userId,
            skip_billing: true
        };
    } else if (isKling) {
        // 可灵Kling模型
        var kMatch = model.match(/kling-([\d.]+|o1)-(\d+)p-(\d+)s/i);
        var kVersion = kMatch ? kMatch[1] : '2.0';
        var kRes = kMatch ? kMatch[2] + 'p' : '720p';
        var kDur = kMatch ? parseInt(kMatch[3]) : 5;
        apiEndpoint = '/api/yunwu';
        requestBody = {
            action: 'kling',
            prompt: prompt,
            image_url: imageUrl,
            model_version: kVersion,
            aspect_ratio: ratio,
            duration: kDur,
            resolution: kRes,
            userId: userId,
            skip_billing: true
        };
    } else if (isVeo) {
        // Veo 3.1模型
        apiEndpoint = '/api/yunwu';
        requestBody = {
            action: 'veo3',
            prompt: prompt,
            model: model,
            image_url: imageUrl,
            aspect_ratio: ratio,
            with_audio: true,
            userId: userId,
            skip_billing: true
        };
    } else if (isWan26) {
        // Wan2.6模型
        var wMatch = model.match(/wan26-(\d+p)-(\d+)s(-audio)?/i);
        var wRes = wMatch ? wMatch[1] : '720p';
        var wDur = wMatch ? parseInt(wMatch[2]) : 5;
        var wAudio = model.includes('audio');
        apiEndpoint = '/api/yunwu';
        var wPrompt = prompt;
        if (wAudio) wPrompt += '，使用中文配音，语速适中，断句自然';
        requestBody = {
            action: 'wan26',
            prompt: wPrompt,
            img_url: imageUrl,
            resolution: wRes,
            duration: wDur,
            audio: wAudio,
            userId: userId,
            skip_billing: true
        };
    } else if (isGrok) {
        // Grok模型
        apiEndpoint = '/api/yunwu';
        var gDur = 6;
        if (model.includes('10s')) gDur = 10;
        else if (model.includes('15s')) gDur = 15;
        requestBody = {
            action: 'image-to-video',
            prompt: prompt,
            image_url: imageUrl,
            model: model,
            aspect_ratio: ratio,
            duration: gDur,
            userId: userId,
            skip_billing: true,
            image_weight: 0.98,
            preserve_subject: true
        };
    } else if (isLtxVideo) {
        // LTX-Video模型
        apiEndpoint = '/api/yunwu';
        var lDur = 5;
        if (model.includes('10s')) lDur = 10;
        else if (model.includes('15s')) lDur = 15;
        requestBody = {
            action: 'ltx',
            model: model,
            prompt: prompt,
            img_url: imageUrl,
            aspect_ratio: ratio,
            duration: lDur,
            userId: userId,
            skip_billing: true
        };
    } else if (isSeedance) {
        // Seedance模型
        apiEndpoint = '/api/yunwu';
        requestBody = {
            action: 'seedance-i2v',
            model: 'seedance-i2v',
            prompt: prompt,
            firstFrameImage: imageUrl,
            duration: 5,
            ratio: ratio,
            resolution: '720p',
            skip_billing: true,
            userId: userId
        };
    } else {
        // 默认/魔塔模型
        apiEndpoint = '/api/sora2';
        requestBody = {
            action: 'image-to-video',
            model: model,
            prompt: prompt,
            image_url: imageUrl,
            image_weight: 0.95,
            preserve_subject: true,
            motion_intensity: 'medium',
            duration: 6,
            aspect_ratio: ratio,
            skip_billing: true,
            userId: userId
        };
    }

    console.log('[grid-split] model=' + model + ' endpoint=' + apiEndpoint);
    var res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'HTTP ' + res.status);
    var taskId = data.taskId || data.task_id || data.id;
    if (taskId && !data.videoUrl && !data.url && !data.video_url) {
        return await pollGridSplitVideo(taskId, apiEndpoint, model);
    }
    return data.videoUrl || data.url || data.output || data.video_url;
}

async function pollGridSplitVideo(taskId, apiEndpoint, model) {
    for (var i = 0; i < 150; i++) {
        await new Promise(function(r) { setTimeout(r, 5000); });
        try {
            var res = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'query', taskId: taskId, model: model, skip_billing: true })
            });
            var data = await res.json();
            if (data.status === 'completed' || data.status === 'success' || data.status === 'done') {
                return data.videoUrl || data.url || data.output || data.video_url;
            }
            if (data.status === 'failed' || data.status === 'error') {
                throw new Error(data.message || data.error || '视频生成失败');
            }
        } catch (err) {
            if (err.message && err.message.indexOf('生成失败') > -1) throw err;
        }
    }
    throw new Error('视频生成超时');
}

async function downloadAllGridSplitVideos() {
    var done = _gridSplitState.pieces.filter(function(p) { return p.status === 'done' && p.videoUrl; });
    if (done.length === 0) { if (typeof showToast === 'function') showToast('没有可下载的视频'); return; }
    if (typeof showToast === 'function') showToast('开始下载 ' + done.length + ' 个视频...');
    for (var i = 0; i < done.length; i++) {
        try {
            var resp = await fetch(done[i].videoUrl);
            var blob = await resp.blob();
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'grid_video_' + (i + 1) + '.mp4';
            a.click();
            URL.revokeObjectURL(a.href);
            await new Promise(function(r) { setTimeout(r, 500); });
        } catch (err) {
            console.error('[grid-split] download error:', err);
        }
    }
}

// 注入样式
(function() {
    var s = document.createElement('style');
    s.textContent = '.grid-type-btn{padding:6px 12px;background:#222;border:1px solid #444;border-radius:6px;color:#aaa;font-size:12px;cursor:pointer;transition:all 0.2s}.grid-type-btn.active{background:rgba(251,191,36,0.15);border-color:#f59e0b;color:#fbbf24;font-weight:600}.grid-type-btn:hover{border-color:#f59e0b}';
    document.head.appendChild(s);
})();
