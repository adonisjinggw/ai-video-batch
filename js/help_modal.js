/**
 * 帮助模态框逻辑
 * v6.1
 */

function openHelpModal() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        renderHelpContent(); // 每次打开重新渲染，确保内容最新
        modal.style.display = 'flex';
    }
}

function closeHelpModal() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function renderHelpContent() {
    const contentDiv = document.querySelector('.help-content');
    if (!contentDiv) return;

    contentDiv.innerHTML = `
        <h4>📅 更新日志 (v8.6.4 - 2025.12.19)</h4>
        <ul style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; list-style: none;">
            <li style="margin-bottom:5px;">🔐 <strong>登录稳定性修复：</strong> 登录后刷新/跳转不再掉线。</li>
            <li style="margin-bottom:5px;">🗺️ <strong>小地图修复：</strong> 关闭按钮可用，拖拽不会吞点击。</li>
            <li style="margin-bottom:5px;">✍️ <strong>AI写作升级：</strong> 编辑器新增 AI续写 / AI润色 / AI扩写，并可一键保存到章节。</li>
        </ul>

        <h4>✅ 关于 Key（重要）</h4>
        <div style="background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.18); padding: 10px; border-radius: 8px; font-size: 13px; line-height: 1.6;">
            本站<strong>无需用户填写任何 API Key</strong>。所有模型请求都通过后端代理与环境变量完成。
        </div>

        <h4>🛡️ 登录/会员状态异常（最常见）</h4>
        <ul>
            <li><strong>提示“浏览器阻止了登录脚本”：</strong> 关闭脚本注入/广告拦截/翻译类插件，或用无痕模式打开。</li>
            <li><strong>登录后刷新变未登录：</strong> 请强制刷新（Ctrl+F5）一次；仍不行请关闭拦截插件。</li>
        </ul>

        <h4>🖱️ 画布快捷操作</h4>
        <ul>
            <li><strong>找回任务窗：</strong> 按 <code>H</code> 或点击顶部 🎯</li>
            <li><strong>小地图：</strong> 按 <code>M</code> 或点击顶部 🗺️（右上角 × 关闭）</li>
            <li><strong>平移：</strong> 空格 + 左键拖拽，或鼠标中键拖拽</li>
            <li><strong>缩放：</strong> Ctrl + 滚轮</li>
        </ul>

        <h4>✍️ AI 写作怎么用</h4>
        <ol style="margin-left: 16px;">
            <li>左侧切换到 <strong>AI写作</strong> 标签</li>
            <li>新建写作项目 → 新建章节</li>
            <li>在编辑器里使用 <strong>AI续写 / AI润色 / AI扩写</strong></li>
            <li>生成后点 <strong>保存</strong>（否则只是临时内容）</li>
        </ol>

        <div class="help-btn-row">
            <button class="btn-primary" onclick="closeHelpModal(); openMemberModal();">打开会员中心</button>
        </div>
    `;
}

// 确保全局暴露
window.openHelpModal = openHelpModal;
window.closeHelpModal = closeHelpModal;
