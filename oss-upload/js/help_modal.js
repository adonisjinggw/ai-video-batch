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
        <h4>📅 更新日志 (v6.2 - 2025.11.22)</h4>
        <ul style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; list-style: none;">
            <li style="margin-bottom:5px;">🔄 <strong>系统同步更新：</strong> 同步所有本地最新优化代码至线上环境。</li>
            <li style="margin-bottom:5px;">✨ <strong>新增 Sketch 绘图板：</strong> 无限画布支持手绘草图、上传参考图，通过连线直接控制视频生成画面。</li>
            <li style="margin-bottom:5px;">📂 <strong>剧本/文档上传：</strong> 快速输入区新增“上传”按钮，支持直接读取 txt/md/doc 文档内容。</li>
            <li style="margin-bottom:5px;">🎨 <strong>角色库与资产：</strong> 新增 3D 角色展示与资产管理面板（点击顶部按钮进入）。</li>
            <li style="margin-bottom:5px;">🚀 <strong>自动发布升级：</strong> 会员专属自动发布功能（支持 Playwright 本地/云端模式）。</li>
        </ul>

        <h4>🔑 如何获取 API Key？</h4>
        <p>本项目支持多种 AI 模型，请前往以下平台获取 Key：</p>
        <ul>
            <li><strong>贞贞工坊 (Sora-2 / Veo-3 / Gemini)：</strong><br>
                访问 <a href="https://ai.t8star.cn/register?aff=33d95943347" target="_blank" style="color:var(--accent-gold);">api.t8star.cn (邀请注册)</a> 获取 Key。<br>
                <code>支持模型：Sora-2, Veo-3, Gemini-1.5-Pro</code>
            </li>
            <li><strong>RunningHub (Flux / Kling)：</strong><br>
                宝子们，我发现一个AI图像视频宝藏产品 RunningHub！全球ComfyUI 开发者每天在此发布数百个超有趣超有用的AI应用，娱乐工作一网打尽。<br>
                👉 <a href="https://www.runninghub.cn/?inviteCode=36af1d09" target="_blank" style="color:var(--accent-gold);font-weight:bold;">点击这里注册领 500 RH币</a>，可以免费生成好多图片视频哦！<br>
                <code>支持模型：Flux-Pro, Kling-1.5</code>
            </li>
        </ul>

        <h4>🚀 核心功能介绍</h4>
        <p><strong>1. 智能批量生成：</strong> 输入一个创意，AI 自动完成“写剧本 -> 绘分镜 -> 生成视频 -> 剪辑”全流程。</p>
        <p><strong>2. 角色一致性 (Banana2)：</strong> 开启“角色设定图”功能，AI 会先设计角色三视图，确保分镜中人物长相统一。</p>
        <p><strong>3. 交互式画板 (Sketch)：</strong> 在画布上右键创建“绘图节点”，手绘草图或上传参考图，连线到任务卡片，精准控制画面构图。</p>
        
        <h4>🖱️ 画布操作指南</h4>
        <ul>
            <li><strong>平移：</strong> 空格+左键拖拽，或鼠标中键拖拽。</li>
            <li><strong>缩放：</strong> 鼠标滚轮 (Ctrl+滚轮)。</li>
            <li><strong>连线：</strong> 拖拽节点右侧的“输出点”到任务卡片，即可传递参考图。</li>
        </ul>
        
        <div class="help-btn-row">
            <button class="btn-primary" onclick="openSettingsModal()">前往设置填入 Key</button>
        </div>
    `;
}

// 确保全局暴露
window.openHelpModal = openHelpModal;
window.closeHelpModal = closeHelpModal;
