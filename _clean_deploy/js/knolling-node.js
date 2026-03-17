/**
 * 🧩 万物拆解提示词生成器 (Knolling Generator)
 * 独立逻辑文件，避免污染主逻辑
 */

// 1. 创建节点数据结构
function createKnollingNodeData(x, y) {
    return {
        id: 'knoll_' + Date.now(),
        type: 'knolling',
        x: x,
        y: y,
        width: 320,
        height: 480,
        data: {
            subject: '',
            logo: '',
            generatedPrompt: ''
        }
    };
}

// 2. 渲染节点 HTML (包含连接点)
function getKnollingNodeHTML(node) {
    const data = node.data || {};
    return `
        <!-- 输入连接点 (用于触发) -->
        <div class="input-handle" onmouseup="endConnection(event, '${node.id}')" title="输入连接点" 
             style="top: 50% !important; left: -12px !important; transform: translateY(-50%); width: 12px; height: 12px; background: #fbbf24; border: 2px solid #000; border-radius: 50%; position: absolute; cursor: crosshair; z-index: 100;"></div>
        
        <div class="banana-node-header knolling-node-header">
            <span>🧩 万物拆解生成器</span>
            <button class="btn-close-node" onclick="removeNode('${node.id}')">×</button>
        </div>
        
        <div class="node-content knolling-content">
            <div class="knolling-form">
                <div class="k-group">
                    <label>📦 拆解主体</label>
                    <input type="text" class="k-input" value="${data.subject || ''}" 
                           placeholder="例如: 复古机械键盘"
                           onchange="updateKnollingData('${node.id}', 'subject', this.value)"
                           onmousedown="event.stopPropagation()">
                </div>
                
                <div class="k-group">
                    <label>🏷️ 品牌 Logo</label>
                    <input type="text" class="k-input" value="${data.logo || ''}" 
                           placeholder="例如: Cherry"
                           onchange="updateKnollingData('${node.id}', 'logo', this.value)"
                           onmousedown="event.stopPropagation()">
                </div>

                <button class="btn-k-gen" id="btn-gen-${node.id}" onclick="runKnollingGen('${node.id}')">
                    ⚡ AI 自动拆解
                </button>

                <div class="k-group" style="flex:1; display:flex; flex-direction:column;">
                    <label>📝 提示词结果</label>
                    <textarea class="k-output" id="output-${node.id}" readonly>${data.generatedPrompt || ''}</textarea>
                </div>
                
                <div class="k-status" id="status-${node.id}"></div>
            </div>
        </div>

        <!-- 输出连接点 (用于传导 Prompt) -->
        <div class="output-handle" onmousedown="startConnection(event, '${node.id}')" title="输出 Prompt 给画板"></div>
        <div class="resize-handle" onmousedown="startNodeResize(event, '${node.id}')"></div>
    `;
}

// 3. 数据更新
function updateKnollingData(nodeId, key, value) {
    const node = flowNodes.find(n => n.id === nodeId);
    if (node) {
        node.data[key] = value;
        saveIdeasToHistory();
    }
}

// 4. 执行生成
async function runKnollingGen(nodeId) {
    const node = flowNodes.find(n => n.id === nodeId);
    if (!node) return;

    const { subject, logo } = node.data;
    if (!subject || !logo) {
        alert('请先填写主体和 Logo！');
        return;
    }

    const btn = document.getElementById(`btn-gen-${nodeId}`);
    const status = document.getElementById(`status-${nodeId}`);
    
    // UI Loading
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ 拆解中...'; }
    if (status) status.innerHTML = '🤖 正在分析构造...';

    const prompt = `
    你现在是 Midjourney 顶级提示词专家。请为用户生成 **"产品解构与陈列"** 的 Prompt。
    
    用户输入信息：
    - 主体/描述：${subject}
    - 品牌/Logo：${logo}

    **请按照以下逻辑优先级执行：**

    ---
    🔥 **第一优先级：用户指定风格 (User Override)**
    *分析用户输入的【主体/描述】中是否包含明确的风格关键词（如 "Cyberpunk", "Vintage", "Sketch", "Neon", "Minimalist" 等）。*
    - **如果有**：请直接采用用户指定的风格来设定 Background, Lighting 和 Vibe，忽略下方的默认分类建议。
    - **如果无**：请继续执行第二优先级的自动分类。

    ---
    🚀 **第二优先级：智能自动分类 (Auto-Adaptive)**
    *(仅在用户未指定风格时执行)*

    👉 **分类 A：高科技、机械、硬核电子 (Tech/Mech)**
    - **View**: 3D Axonometric Exploded View (3D轴测爆炸).
    - **Background**: Dark Tech Gradient + Holographic Schematics (全息图纸).
    - **Vibe**: Precision, Future, Industrial.

    👉 **分类 B：生物、解剖、有机体 (Biological/Anatomy)**
    - **View**: Scientific/Medical Exploded View (科学解剖爆炸图).
    - **Background**: Clean Laboratory White or Textured Medical Chart (实验室白/医学图表).
    - **Details**: Anatomy labels, biological cross-sections (生物横切面).
    - **Vibe**: Clinical, Detailed, Scientific.

    👉 **分类 C：文化、生活、食品、时尚 (Culture/Lifestyle)**
    - **View**: Top-down Knolling (垂直平铺).
    - **Background**: Texture Paper / Editorial Matte.
    - **Vibe**: Organic, Elegant, Curated.

    ---
    **[最终输出 Prompt 结构]** (直接输出英文，不要解释)：
    
    **[Subject & Style]**: A [User-Style OR Adaptive-Style] masterpiece of [${subject}]. [3D Exploded View / Knolling].
    
    **[Components]**: [List detailed parts]. All items organized in a perfect grid.
    
    **[Visuals]**: 
    - Background: [Matches the chosen style].
    - Info elements: Infographic pointer lines, text labels.
    - Typography: Massive background text "[${logo}]".
    
    **[Quality]**: 8k, hyper-realistic, cinematic lighting, unreal engine 5 render.
    
    **[Signature]**: A small plaque in the corner engraved with "${logo}".
    `;

    try {
        // 调用现有 API
        const result = await callZhenzhenTextAPI(prompt);
        
        if (result) {
            const cleanPrompt = result.replace(/```/g, '').trim();
            
            // 更新数据
            node.data.generatedPrompt = cleanPrompt;
            updateKnollingData(nodeId, 'generatedPrompt', cleanPrompt);
            
            // 更新 UI
            const output = document.getElementById(`output-${nodeId}`);
            if (output) output.value = cleanPrompt;
            if (status) status.innerHTML = '✅ 生成成功！已同步';

            // 自动传导给连接的节点
            propagateKnollingPrompt(nodeId, cleanPrompt);
        }
    } catch (err) {
        console.error(err);
        if (status) status.innerHTML = '❌ 失败';
        alert('生成失败，请重试');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '⚡ AI 自动拆解'; }
    }
}

// 5. 自动传导逻辑
function propagateKnollingPrompt(sourceId, prompt) {
    console.log('🚀 开始传导 Prompt, Source:', sourceId);
    
    // 兼容性获取全局变量
    const globalConnections = window.connections || connections || [];
    const globalFlowNodes = window.flowNodes || flowNodes || [];
    
    // 找到所有从该节点出发的连线
    const outgoing = globalConnections.filter(c => c.source === sourceId);
    console.log('🔗 找到连线数:', outgoing.length);
    
    outgoing.forEach(conn => {
        const targetId = conn.target;
        const targetNode = globalFlowNodes.find(n => n.id === targetId);
        
        // 如果连到了 Banana 画板 (兼容旧版无 type 的节点)
        if (targetNode && (targetNode.type === 'banana-draw' || !targetNode.type)) {
            console.log('✅ 同步 Prompt 到节点:', targetId);
            
            // 更新数据
            if (!targetNode.data) targetNode.data = {};
            targetNode.data.knollingPrompt = prompt;
            
            // 尝试更新 UI (如果画板打开了)
            if (typeof updateNodeAutoPromptDisplay === 'function') {
                updateNodeAutoPromptDisplay(targetId);
            } else if (typeof window.updateNodeAutoPromptDisplay === 'function') {
                window.updateNodeAutoPromptDisplay(targetId);
            } else {
                console.warn('⚠️ 未找到 updateNodeAutoPromptDisplay 函数');
            }
        }
    });
    
    saveIdeasToHistory();
}

