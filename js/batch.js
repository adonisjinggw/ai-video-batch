/**
 * AI视频批量创作工具 - 纯前端版本 v3.0
 * 特性：双击HTML直接打开，无需服务器
 */

// ==================== 全局状态 ====================

let ideas = [];
let currentEditingId = null;
let isGenerating = false;
let totalGenerated = 0;
// 🔑 内置API Key - 打开即用，无需配置！
let apiKey = 'sk-JdR0EyMHsupEEre7Z45wjmBQCpByiCQ6QK1Zl3kpV74y3tVy';
let currentInputMode = 'text'; // 'text' 或 'script'
let uploadedScript = null; // 上传的剧本内容

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ AI视频批量创作工具已加载 - 纯前端版本');
    console.log('🔑 使用内置API Key，无需配置！');
    
    // 不再从localStorage读取，直接使用内置API Key
    // apiKey已在全局变量中硬编码
    
    // 添加默认示例
    addDefaultIdeas();
    
    // 显示配置状态
    updateConfigStatus();
});

// ==================== API配置 ====================

function showConfigModal() {
    document.getElementById('apiKeyInput').value = apiKey;
    document.getElementById('configModal').style.display = 'flex';
}

function closeConfigModal() {
    document.getElementById('configModal').style.display = 'none';
}

function saveApiKey() {
    const input = document.getElementById('apiKeyInput').value.trim();
    
    if (!input) {
        showConfigStatus('❌ 请输入API Key！', 'error');
        return;
    }
    
    apiKey = input;
    localStorage.setItem('zhenzhen_api_key', apiKey);
    showConfigStatus('✅ API Key已保存，可以开始使用了', 'success');
    
    updateConfigStatus();
    
    setTimeout(() => {
        closeConfigModal();
    }, 1500);
}

function showConfigStatus(message, type) {
    const status = document.getElementById('configStatus');
    status.textContent = message;
    status.className = `config-status ${type}`;
}

function updateConfigStatus() {
    // API Key已内置，无需配置
    console.log('✅ API Key已内置，打开即用！');
}

// ==================== 创意管理 ====================

function addDefaultIdeas() {
    // 默认不添加示例，让用户自行添加
    renderIdeasList();
}

function addNewIdea() {
    currentEditingId = null;
    currentInputMode = 'text';
    uploadedScript = null;
    
    document.getElementById('ideaTheme').value = '';
    document.getElementById('generationMode').value = 'text-to-video';
    document.getElementById('ideaStyle').value = 'cartoon';
    document.getElementById('ideaDuration').value = 30;
    document.getElementById('ideaScenes').value = 4;
    document.getElementById('imageAspectRatio').value = '16:9 landscape 1344x768';
    
    // 重置模式切换
    switchInputMode('text');
    showIdeaModal();
}

function editIdea(id) {
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;
    
    currentEditingId = id;
    document.getElementById('ideaTheme').value = idea.theme;
    document.getElementById('generationMode').value = idea.generationMode || 'text-to-video';
    document.getElementById('ideaStyle').value = idea.style;
    document.getElementById('ideaDuration').value = idea.duration;
    document.getElementById('ideaScenes').value = idea.scenes;
    document.getElementById('imageAspectRatio').value = idea.imageAspectRatio || '16:9 landscape 1344x768';
    showIdeaModal();
}

function saveIdea() {
    const generationMode = document.getElementById('generationMode').value;
    const style = document.getElementById('ideaStyle').value;
    const duration = parseInt(document.getElementById('ideaDuration').value);
    const scenes = parseInt(document.getElementById('ideaScenes').value);
    const imageAspectRatio = document.getElementById('imageAspectRatio').value;
    
    // 验证参数
    if (isNaN(duration) || duration < 5 || duration > 300) {
        alert('时长必须在5-300秒之间！');
        return;
    }
    
    if (isNaN(scenes) || scenes < 1 || scenes > 20) {
        alert('分镜数必须在1-20之间！');
        return;
    }
    
    let theme = '';
    let scriptContent = null;
    
    // 根据模式获取内容
    if (currentInputMode === 'text') {
        theme = document.getElementById('ideaTheme').value.trim();
        if (!theme) {
            alert('请输入创意主题！');
            return;
        }
    } else if (currentInputMode === 'script') {
        if (!uploadedScript) {
            alert('请先上传剧本文件！');
            return;
        }
        theme = uploadedScript.title || '上传的剧本';
        scriptContent = uploadedScript.content;
    }
    
    if (currentEditingId) {
        const idea = ideas.find(i => i.id === currentEditingId);
        if (idea) {
            idea.theme = theme;
            idea.generationMode = generationMode;
            idea.style = style;
            idea.duration = duration;
            idea.scenes = scenes;
            idea.imageAspectRatio = imageAspectRatio;
            idea.scriptContent = scriptContent;
            idea.inputMode = currentInputMode;
        }
    } else {
        ideas.push({
            id: Date.now() + Math.random(),
            theme, 
            generationMode,
            style, 
            duration, 
            scenes,
            imageAspectRatio,
            scriptContent,
            inputMode: currentInputMode,
            status: 'pending',
            result: null,
            error: null
        });
    }
    
    renderIdeasList();
    closeIdeaModal();
}

function removeIdea(id) {
    if (isGenerating) {
        alert('生成进行中，无法删除！');
        return;
    }
    
    ideas = ideas.filter(i => i.id !== id);
    renderIdeasList();
}

function renderIdeasList() {
    const container = document.getElementById('ideasList');
    
    if (ideas.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <p>还没有创意</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">点击上方 + 添加</p>
            </div>
        `;
        return;
    }
    
    const styleLabels = {
        cartoon: '卡通', realistic: '真人', scifi: '科幻',
        anime: '动漫', cyberpunk: '赛博朋克', fantasy: '奇幻'
    };
    
    container.innerHTML = ideas.map((idea, index) => `
        <div class="idea-item" onclick="editIdea(${idea.id})">
            <div class="idea-item-header">
                <span class="idea-number">${index + 1}</span>
                <button class="idea-remove" onclick="event.stopPropagation(); removeIdea(${idea.id})">×</button>
            </div>
            <div class="idea-theme">${idea.theme}</div>
            <div class="idea-meta">
                <span class="meta-tag">🎨 ${styleLabels[idea.style]}</span>
                <span class="meta-tag">⏱ ${idea.duration}秒</span>
                <span class="meta-tag">🎬 ${idea.scenes}镜</span>
            </div>
        </div>
    `).join('');
}

// ==================== 模态框管理 ====================

function showIdeaModal() {
    document.getElementById('ideaModal').style.display = 'flex';
}

function closeIdeaModal() {
    document.getElementById('ideaModal').style.display = 'none';
    currentEditingId = null;
    uploadedScript = null;
}

// ==================== 模式切换与上传 ====================

function switchInputMode(mode) {
    currentInputMode = mode;
    
    const textArea = document.getElementById('textInputArea');
    const scriptArea = document.getElementById('scriptUploadArea');
    const textBtn = document.getElementById('textModeBtn');
    const scriptBtn = document.getElementById('scriptModeBtn');
    
    if (mode === 'text') {
        textArea.style.display = 'block';
        scriptArea.style.display = 'none';
        textBtn.classList.add('active');
        scriptBtn.classList.remove('active');
        uploadedScript = null;
    } else if (mode === 'script') {
        textArea.style.display = 'none';
        scriptArea.style.display = 'block';
        textBtn.classList.remove('active');
        scriptBtn.classList.add('active');
    }
}

function handleScriptUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const statusEl = document.getElementById('uploadStatus');
    statusEl.textContent = '读取中...';
    statusEl.className = 'upload-status info';
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const content = e.target.result;
            const fileName = file.name;
            
            if (fileName.endsWith('.json')) {
                // JSON格式：[{title: "章节1", script: "内容..."}]
                const parsed = JSON.parse(content);
                if (!Array.isArray(parsed) || parsed.length === 0) {
                    throw new Error('JSON格式错误：必须是数组且至少包含一个章节');
                }
                uploadedScript = {
                    title: parsed[0].title || '上传的剧本',
                    content: parsed.map(ch => `【${ch.title}】\n${ch.script}`).join('\n\n')
                };
            } else if (fileName.endsWith('.txt')) {
                // TXT格式：===章节标题===
                const chapters = content.split(/===(.+?)===/g).filter(s => s.trim());
                if (chapters.length === 0) {
                    throw new Error('TXT格式错误：未找到章节标题（格式：===章节标题===）');
                }
                const firstTitle = chapters[0].trim() || '上传的剧本';
                uploadedScript = {
                    title: firstTitle,
                    content: content
                };
            } else {
                throw new Error('不支持的文件格式');
            }
            
            statusEl.textContent = `✅ 已上传: ${uploadedScript.title}`;
            statusEl.className = 'upload-status success';
        } catch (error) {
            console.error('剧本解析失败:', error);
            statusEl.textContent = `❌ 解析失败: ${error.message}`;
            statusEl.className = 'upload-status error';
            uploadedScript = null;
        }
    };
    
    reader.onerror = () => {
        statusEl.textContent = '❌ 文件读取失败';
        statusEl.className = 'upload-status error';
        uploadedScript = null;
    };
    
    reader.readAsText(file);
}

// ==================== 批量生成 ====================

/**
 * 快速开始生成（从欢迎页的"开始创作"按钮）
 */
function quickStartGeneration() {
    // 检查是否有创意
    if (ideas.length === 0) {
        alert('请先添加创意！\n\n💡 点击左侧的 + 按钮添加创意主题');
        return;
    }
    
    // 直接调用批量生成
    startBatchGeneration();
}

async function startBatchGeneration() {
    if (ideas.length === 0) {
        alert('请先添加创意！');
        return;
    }
    
    if (!apiKey) {
        alert('⚠️ 请先配置API Key！\n\n点击右上角设置按钮配置贞贞工坊API Key。');
        showConfigModal();
        return;
    }
    
    if (isGenerating) return;
    
    isGenerating = true;
    
    ideas.forEach(idea => {
        idea.status = 'pending';
        idea.result = null;
        idea.error = null;
    });
    
    showProgressScreen();
    document.getElementById('startBatchBtn').disabled = true;
    
    await processConcurrently(ideas, 3);
    
    isGenerating = false;
    document.getElementById('startBatchBtn').disabled = false;
    
    showResultScreen();
    
    const completed = ideas.filter(i => i.status === 'completed').length;
    totalGenerated += completed;
    document.getElementById('totalGenerated').textContent = totalGenerated;
}

async function processConcurrently(tasks, maxConcurrent) {
    const processing = [];
    
    for (let i = 0; i < tasks.length; i++) {
        while (processing.length >= maxConcurrent) {
            await Promise.race(processing);
        }
        
        const promise = processIdea(tasks[i]).then(() => {
            const index = processing.indexOf(promise);
            if (index > -1) processing.splice(index, 1);
        });
        
        processing.push(promise);
        await sleep(300);
    }
    
    await Promise.all(processing);
}

async function processIdea(idea) {
    try {
        idea.status = 'processing';
        updateProgress();
        renderTaskCard(idea);
        
        console.log(`🚀 开始生成: ${idea.theme}`);
        
        // 🔥 直接调用AI API或使用模拟数据
        const result = await generateContent(idea);
        
        idea.status = 'completed';
        idea.result = result;
        updateProgress();
        renderTaskCard(idea);
        
        console.log(`✅ 完成: ${idea.theme}`);
        
    } catch (error) {
        idea.status = 'failed';
        idea.error = error.message;
        updateProgress();
        renderTaskCard(idea);
        
        console.error(`❌ 失败: ${idea.theme}`, error);
    }
}

/**
 * 生成内容（使用真实AI）
 */
async function generateContent(idea) {
    if (!apiKey) {
        throw new Error('❌ 未配置API Key，请先在设置中配置贞贞工坊API Key');
    }
    
    console.log('🤖 使用贞贞工坊AI生成...');
    return await generateWithAI(idea);
}

/**
 * 使用AI生成（支持双模式）
 */
async function generateWithAI(idea) {
    const mode = idea.generationMode || 'text-to-video';
    
    console.log(`🎯 生成模式: ${mode === 'text-to-video' ? '纯文生视频' : '文生图+图生视频'}`);
    
    if (mode === 'text-to-video') {
        // 模式1：纯文生视频（原逻辑）
        return await generateTextToVideo(idea);
    } else {
        // 模式2：文生图+图生视频
        return await generateTextToImageToVideo(idea);
    }
}

/**
 * 模式1：纯文生视频（Grok-4 + Sora2）
 */
async function generateTextToVideo(idea) {
    let script;
    
    // 如果是上传的剧本，直接使用
    if (idea.inputMode === 'script' && idea.scriptContent) {
        script = idea.scriptContent;
        console.log('📄 使用上传的剧本');
    } else {
        // 生成剧本（使用Grok-4）
        const scriptPrompt = generateScriptPrompt(idea);
        script = await callZhenzhenTextAPI(scriptPrompt);
        console.log('✅ 剧本生成完成');
    }
    
    // 生成视频提示词
    const videoPrompt = generateVideoPromptRequest(idea, script);
    const videoText = await callZhenzhenTextAPI(videoPrompt);
    const videoPrompts = parsePrompts(videoText, idea.scenes);
    console.log('✅ 视频提示词生成完成');
    
    // 生成配图提示词
    const imagePrompt = generateImagePromptRequest(idea, script);
    const imageText = await callZhenzhenTextAPI(imagePrompt);
    const imagePrompts = parsePrompts(imageText, idea.scenes);
    console.log('✅ 配图提示词生成完成');
    
    return { script, videoPrompts, imagePrompts };
}

/**
 * 模式2：文生图+图生视频（Flux + Sora2）
 */
async function generateTextToImageToVideo(idea) {
    let script;
    
    // 如果是上传的剧本，直接使用
    if (idea.inputMode === 'script' && idea.scriptContent) {
        script = idea.scriptContent;
        console.log('📄 使用上传的剧本');
    } else {
        // 生成剧本（使用Grok-4）
        const scriptPrompt = generateScriptPrompt(idea);
        script = await callZhenzhenTextAPI(scriptPrompt);
        console.log('✅ 剧本生成完成');
    }
    
    // 生成配图提示词（用于Flux生图）
    const imagePrompt = generateImagePromptRequest(idea, script);
    const imageText = await callZhenzhenTextAPI(imagePrompt);
    const imagePrompts = parsePrompts(imageText, idea.scenes);
    console.log('✅ 配图提示词生成完成');
    
    // 使用Flux生成图片
    console.log('🎨 开始生成图片...');
    const generatedImages = [];
    for (let i = 0; i < imagePrompts.length; i++) {
        const imageUrl = await callFluxImageAPI(imagePrompts[i], idea.imageAspectRatio);
        generatedImages.push(imageUrl);
        console.log(`✅ 图片 ${i + 1}/${imagePrompts.length} 生成完成`);
    }
    
    // 使用Sora2进行图生视频
    console.log('🎬 开始图生视频...');
    const videoPrompts = [];
    for (let i = 0; i < generatedImages.length; i++) {
        const videoUrl = await callSora2ImageToVideoAPI(generatedImages[i], imagePrompts[i]);
        videoPrompts.push({
            prompt: imagePrompts[i],
            imageUrl: generatedImages[i],
            videoUrl: videoUrl
        });
        console.log(`✅ 视频 ${i + 1}/${generatedImages.length} 生成完成`);
    }
    
    return { script, videoPrompts, imagePrompts, generatedImages };
}

/**
 * 贞贞工坊 - 文本生成API（Grok-4）
 */
async function callZhenzhenTextAPI(prompt) {
    try {
        const API_URL = 'https://api.gptbest.com/v1/chat/completions';
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'grok-2-1212',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 2000
            })
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (error) {
        console.error('❌ 贞贞文本API调用失败:', error);
        throw error;
    }
}

/**
 * RH Flux - 文生图API
 */
async function callFluxImageAPI(prompt, aspectRatio) {
    try {
        const API_URL = 'https://www.runninghub.cn/task/openapi/ai-app/run';
        const API_KEY = 'a380bfb6f25b4733ad6756a0bb0a8403';
        const WEBAPP_ID = '1986431735514726401';
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Host': 'www.runninghub.cn',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                webappId: WEBAPP_ID,
                apiKey: API_KEY,
                nodeInfoList: [
                    {
                        nodeId: '53',
                        fieldName: 'text',
                        fieldValue: prompt,
                        description: 'text'
                    },
                    {
                        nodeId: '52',
                        fieldName: 'aspect_ratio',
                        fieldData: '[[\"custom\", \"1:1 square 1024x1024\", \"3:4 portrait 896x1152\", \"5:8 portrait 832x1216\", \"9:16 portrait 768x1344\", \"9:21 portrait 640x1536\", \"4:3 landscape 1152x896\", \"3:2 landscape 1216x832\", \"16:9 landscape 1344x768\", \"21:9 landscape 1536x640\"]]',
                        fieldValue: aspectRatio || '16:9 landscape 1344x768',
                        description: 'aspect_ratio'
                    }
                ]
            })
        });
        
        if (!response.ok) {
            throw new Error(`RH Flux API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        // 根据RH的返回格式提取图片URL（可能需要轮询任务状态）
        // 这里假设返回格式，实际需要根据API文档调整
        if (data.success && data.data && data.data.imageUrl) {
            return data.data.imageUrl;
        } else if (data.taskId) {
            // 如果是异步任务，需要轮询状态
            return await pollFluxTaskStatus(data.taskId);
        } else {
            throw new Error('Flux生图失败: 未返回图片URL');
        }
    } catch (error) {
        console.error('❌ Flux图片生成失败:', error);
        throw error;
    }
}

/**
 * 轮询Flux任务状态（如果需要）
 */
async function pollFluxTaskStatus(taskId) {
    const maxAttempts = 30; // 最多轮询30次
    const interval = 2000; // 每2秒查询一次
    
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, interval));
        
        try {
            const response = await fetch(`https://www.runninghub.cn/task/openapi/task/status/${taskId}`, {
                headers: {
                    'Authorization': 'Bearer a380bfb6f25b4733ad6756a0bb0a8403'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'completed' && data.imageUrl) {
                    return data.imageUrl;
                } else if (data.status === 'failed') {
                    throw new Error('Flux任务失败');
                }
            }
        } catch (error) {
            console.warn(`轮询任务状态失败 (尝试 ${i + 1}/${maxAttempts}):`, error);
        }
    }
    
    throw new Error('Flux任务超时');
}

/**
 * 贞贞工坊 Sora2 - 图生视频API
 */
async function callSora2ImageToVideoAPI(imageUrl, prompt) {
    try {
        const API_URL = 'https://api.gptbest.com/v1/video/generations';
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'sora-1.0-turbo',
                prompt: prompt,
                image: imageUrl, // 输入图片URL
                size: '1280x720'
            })
        });
        
        if (!response.ok) {
            throw new Error(`Sora2 API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.data && data.data[0] && data.data[0].url) {
            return data.data[0].url;
        } else {
            throw new Error('Sora2图生视频失败: 未返回视频URL');
        }
    } catch (error) {
        console.error('❌ Sora2图生视频失败:', error);
        throw error;
    }
}

/**
 * 直接调用贞贞工坊API（纯前端版本）- 兼容旧代码
 */
async function callServerlessAPI(type, prompt) {
    try {
        console.log(`📡 调用贞贞工坊API (${type}):`, prompt.substring(0, 50) + '...');
        
        // 贞贞工坊API配置
        const API_BASE = 'https://api.gptbest.com/v1';
        
        let apiUrl, requestBody;
        
        if (type === 'text') {
            // 文本生成 - Grok-4
            apiUrl = `${API_BASE}/chat/completions`;
            requestBody = {
                model: 'grok-2-1212',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 2000
            };
        } else if (type === 'video') {
            // 视频生成 - Sora2
            apiUrl = `${API_BASE}/video/generations`;
            requestBody = {
                model: 'sora-1.0-turbo',
                prompt: prompt,
                size: '1280x720'
            };
        }
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('API错误:', errorData);
            throw new Error(errorData.error?.message || `API请求失败 (${response.status})`);
        }
        
        const data = await response.json();
        console.log('✅ API调用成功');
        
        // 解析返回的数据
        if (type === 'text') {
            return data.choices[0].message.content.trim();
        } else if (type === 'video') {
            return data.data[0].url;
        }
        
    } catch (error) {
        console.error('❌ API调用失败:', error);
        throw new Error(`生成失败: ${error.message}`);
    }
}

/**
 * 调用AI API（保留旧函数以防需要）
 */
async function callAI(url, model, prompt) {
    try {
        console.log('📡 发起API请求:', {
            url: `${url}/chat/completions`,
            model: model,
            hasApiKey: !!apiKey,
            apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : '无'
        });
        
        const response = await fetch(`${url}/chat/completions`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 2000
            })
        });
        
        console.log('📥 收到响应:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API错误响应:', response.status, errorText);
            
            if (response.status === 401) {
                throw new Error('API Key无效或已过期，请检查配置');
            } else if (response.status === 404) {
                throw new Error('API地址错误，请联系开发者');
            } else if (response.status === 429) {
                throw new Error('请求过于频繁，请稍后再试');
            } else {
                throw new Error(`API请求失败 (${response.status}): ${errorText.substring(0, 100)}`);
            }
        }
        
        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('API响应格式错误:', data);
            throw new Error('API响应格式错误，请联系开发者');
        }
        
        return data.choices[0].message.content.trim();
        
    } catch (error) {
        console.error('❌ AI API调用失败:', error);
        console.error('错误详情:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        
        // 如果是网络错误或CORS错误
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
            throw new Error(`网络请求失败！\n\n可能原因：\n1. ⚠️ CORS跨域限制（纯前端无法直接调用第三方API）\n2. 🔑 API Key未配置或无效\n3. 🌐 网络连接问题\n4. 🚫 API服务不可用\n\n建议：\n1. 检查浏览器控制台（F12）查看详细错误\n2. 确认API Key是否正确配置\n3. 尝试使用代理服务器或后端API`);
        }
        
        throw error;
    }
}

/**
 * 生成剧本提示词
 */
function generateScriptPrompt(idea) {
    const styleMap = {
        cartoon: '卡通风格', realistic: '真人', scifi: '科幻',
        anime: '动漫', cyberpunk: '赛博朋克', fantasy: '奇幻'
    };
    
    return `你是专业短视频编剧。为"${idea.theme}"生成${idea.duration}秒短视频剧本，分${idea.scenes}个分镜，${styleMap[idea.style]}风格。

要求：
1. 每个分镜包含场景、动作、情绪、镜头
2. 逻辑连贯，叙事完整
3. 直接输出剧本，不要解释

格式：
分镜1：[详细描述]
分镜2：[详细描述]
...`;
}

/**
 * 生成视频提示词请求
 */
function generateVideoPromptRequest(idea, script) {
    const styleMap = {
        cartoon: 'cartoon style', realistic: 'realistic', scifi: 'sci-fi',
        anime: 'anime style', cyberpunk: 'cyberpunk', fantasy: 'fantasy style'
    };
    
    return `Based on this script, generate ${idea.scenes} English prompts for Sora2 video:

${script}

Style: ${styleMap[idea.style]}

Format (English only):
Prompt 1: [detailed prompt]
Prompt 2: [detailed prompt]
...`;
}

/**
 * 生成配图提示词请求
 */
function generateImagePromptRequest(idea, script) {
    const styleMap = {
        cartoon: 'cartoon illustration', realistic: 'realistic photo', scifi: 'sci-fi art',
        anime: 'anime art', cyberpunk: 'cyberpunk art', fantasy: 'fantasy illustration'
    };
    
    return `Based on this script, generate ${idea.scenes} English prompts for AI image:

${script}

Style: ${styleMap[idea.style]}

Format (English only):
Image 1: [detailed prompt]
Image 2: [detailed prompt]
...`;
}

/**
 * 解析提示词
 */
function parsePrompts(text, count) {
    const lines = text.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && /^(Prompt|Image|Shot|Scene)\s+\d+:/i.test(trimmed);
    });
    
    const prompts = lines.map(line => {
        return line.replace(/^(Prompt|Image|Shot|Scene)\s+\d+:\s*/i, '').trim();
    }).slice(0, count);
    
    while (prompts.length < count) {
        prompts.push(prompts[prompts.length - 1] || 'A beautiful scene');
    }
    
    return prompts;
}


function updateProgress() {
    const total = ideas.length;
    const completed = ideas.filter(i => i.status === 'completed').length;
    const failed = ideas.filter(i => i.status === 'failed').length;
    const processing = ideas.filter(i => i.status === 'processing').length;
    
    const progress = ((completed + failed) / total) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = 
        `进度：${completed + failed}/${total} | 成功 ${completed} | 失败 ${failed}`;
    
    document.getElementById('successCount').textContent = completed;
    document.getElementById('processingCount').textContent = processing;
    document.getElementById('failedCount').textContent = failed;
}

function renderTaskCard(idea) {
    const container = document.getElementById('taskCards');
    let card = container.querySelector(`[data-idea-id="${idea.id}"]`);
    
    const statusIcons = { pending: '⏱', processing: '⏳', completed: '✅', failed: '❌' };
    const statusTexts = { pending: '等待中', processing: '生成中...', completed: '已完成', failed: '生成失败' };
    
    const cardHTML = `
        <div class="task-card ${idea.status}" data-idea-id="${idea.id}">
            <div class="task-icon">${statusIcons[idea.status]}</div>
            <div class="task-info">
                <div class="task-title">${idea.theme}</div>
                <div class="task-status">${statusTexts[idea.status]}${idea.error ? `: ${idea.error}` : ''}</div>
            </div>
        </div>
    `;
    
    if (!card) {
        container.insertAdjacentHTML('beforeend', cardHTML);
    } else {
        card.outerHTML = cardHTML;
    }
}

// ==================== 结果展示 ====================

function showResultScreen() {
    // 切换页面显示
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('progressScreen').style.display = 'none';
    document.getElementById('resultScreen').style.display = 'block';
    
    const completedIdeas = ideas.filter(i => i.status === 'completed');
    
    if (completedIdeas.length === 0) {
        alert('没有成功生成的内容！');
        return;
    }
    
    const container = document.getElementById('resultCards');
    
    container.innerHTML = completedIdeas.map(idea => {
        const result = idea.result;
        return `
            <div class="result-card">
                <div class="result-card-header">
                    <h3 class="result-title">${idea.theme}</h3>
                    <button class="btn-download" onclick="downloadResult(${idea.id})">📥 下载</button>
                </div>
                
                <div class="result-sections">
                    <div class="result-section">
                        <div class="section-label">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                            </svg>
                            剧本
                        </div>
                        <div class="section-content">${result.script}</div>
                    </div>
                    
                    <div class="result-section">
                        <div class="section-label">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                            </svg>
                            视频分镜提示词
                        </div>
                        <div class="section-content">${result.videoPrompts.join('\n\n')}</div>
                    </div>
                    
                    <div class="result-section">
                        <div class="section-label">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            配图提示词
                        </div>
                        <div class="section-content">${result.imagePrompts.join('\n\n')}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('progressScreen').style.display = 'none';
    document.getElementById('resultScreen').style.display = 'block';
}

// ==================== 下载功能 ====================

function downloadResult(id) {
    const idea = ideas.find(i => i.id === id);
    if (!idea || !idea.result) return;
    
    const content = formatResult(idea);
    downloadTextFile(`${idea.theme}.txt`, content);
}

function downloadAll() {
    const completedIdeas = ideas.filter(i => i.status === 'completed');
    
    if (completedIdeas.length === 0) {
        alert('没有可下载的内容！');
        return;
    }
    
    const allContent = completedIdeas.map(idea => {
        return `${'='.repeat(60)}\n${idea.theme}\n${'='.repeat(60)}\n\n${formatResult(idea)}`;
    }).join('\n\n\n');
    
    downloadTextFile('AI视频批量创作结果.txt', allContent);
}

function formatResult(idea) {
    const result = idea.result;
    const styleLabels = {
        cartoon: '卡通', realistic: '真人', scifi: '科幻',
        anime: '动漫', cyberpunk: '赛博朋克', fantasy: '奇幻'
    };
    
    return `
【创意主题】
${idea.theme}

【参数配置】
风格：${styleLabels[idea.style]}
时长：${idea.duration}秒
分镜数：${idea.scenes}个

【剧本】
${result.script}

【视频分镜提示词】
${result.videoPrompts.map((p, i) => `分镜${i + 1}:\n${p}`).join('\n\n')}

【配图提示词】
${result.imagePrompts.map((p, i) => `配图${i + 1}:\n${p}`).join('\n\n')}

生成时间：${new Date().toLocaleString()}
`.trim();
}

function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ==================== 页面切换 ====================

function showWelcomeScreen() {
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('progressScreen').style.display = 'none';
    document.getElementById('resultScreen').style.display = 'none';
}

function showProgressScreen() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('progressScreen').style.display = 'block';
    document.getElementById('resultScreen').style.display = 'none';
    
    document.getElementById('taskCards').innerHTML = '';
    updateProgress();
}

function backToWelcome() {
    if (isGenerating) {
        if (!confirm('生成正在进行中，确定要返回吗？')) {
            return;
        }
        isGenerating = false; // 停止生成
    }
    
    showWelcomeScreen();
}

function resetAll() {
    if (confirm('确定要重新开始吗？当前结果将被清空。')) {
        ideas.forEach(idea => {
            idea.status = 'pending';
            idea.result = null;
            idea.error = null;
        });
        
        renderIdeasList();
        showWelcomeScreen();
    }
}

// ==================== 工具函数 ====================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 导出全局函数
window.quickStartGeneration = quickStartGeneration;
window.addNewIdea = addNewIdea;
window.editIdea = editIdea;
window.saveIdea = saveIdea;
window.removeIdea = removeIdea;
window.closeIdeaModal = closeIdeaModal;
window.startBatchGeneration = startBatchGeneration;
window.downloadResult = downloadResult;
window.downloadAll = downloadAll;
window.resetAll = resetAll;
window.backToWelcome = backToWelcome;
window.switchInputMode = switchInputMode;
window.handleScriptUpload = handleScriptUpload;
window.showConfigModal = showConfigModal;
window.closeConfigModal = closeConfigModal;
window.saveApiKey = saveApiKey;
