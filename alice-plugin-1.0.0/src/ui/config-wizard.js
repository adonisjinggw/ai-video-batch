/**
 * 艾莉丝 (Alice) 配置向导 - Webview 面板
 */

const vscode = require('vscode');

const PRESET_TEMPLATES = {
    openai: {
        name: 'OpenAI (GPT-4/GPT-3.5)',
        type: 'openai',
        baseUrl: 'https://api.openai.com',
        model: 'gpt-4',
        capabilities: ['code_generation', 'code_review', 'code_optimization', 'text_generation'],
        priority: 10,
        description: 'OpenAI官方API，支持GPT-4、GPT-3.5等模型'
    },
    claude: {
        name: 'Claude 3 (Opus/Sonnet/Haiku)',
        type: 'claude',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-3-opus-20240229',
        capabilities: ['code_generation', 'code_explanation', 'documentation', 'text_generation'],
        priority: 9,
        description: 'Anthropic Claude API，支持Claude 3系列'
    },
    ollama: {
        name: 'Ollama (本地模型)',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'llama2',
        capabilities: ['code_completion', 'text_generation'],
        priority: 5,
        description: '本地Ollama服务，完全免费，需要先启动Ollama'
    },
    custom: {
        name: '自定义API',
        type: 'custom',
        baseUrl: '',
        model: '',
        capabilities: ['code_generation', 'text_generation'],
        priority: 8,
        description: '自定义第三方API，支持任何兼容OpenAI格式的接口'
    }
};

class ConfigWizard {
    constructor(context) {
        this.context = context;
        this.panel = null;
    }

    show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'aliceConfigWizard',
            '🌸 艾莉丝 - AI服务配置',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await this.handleMessage(message);
            },
            undefined,
            this.context.subscriptions
        );

        this.panel.onDidDispose(
            () => {
                this.panel = null;
            },
            null,
            this.context.subscriptions
        );

        this.loadCurrentConfig();
    }

    async handleMessage(message) {
        switch (message.command) {
            case 'saveConfig':
                await this.saveConfig(message.services);
                break;
            case 'testConnection':
                await this.testConnection(message.service);
                break;
            case 'log':
                console.log('[艾莉丝配置面板]', message.message);
                break;
        }
    }

    async loadCurrentConfig() {
        const config = vscode.workspace.getConfiguration('alice');
        const services = config.get('aiServices', []);
        
        this.panel.webview.postMessage({
            command: 'loadConfig',
            services: services
        });
    }

    async saveConfig(services) {
        try {
            const config = vscode.workspace.getConfiguration('alice');
            await config.update('aiServices', services, vscode.ConfigurationTarget.Global);
            
            this.panel.webview.postMessage({
                command: 'saveSuccess',
                message: '✅ 配置已保存！'
            });

            vscode.window.showInformationMessage('🌸 艾莉丝配置已保存！');
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'saveError',
                message: `❌ 保存失败: ${error.message}`
            });
        }
    }

    async testConnection(serviceConfig) {
        this.panel.webview.postMessage({
            command: 'testStarted'
        });

        try {
            const result = await this.testServiceConnection(serviceConfig);
            
            this.panel.webview.postMessage({
                command: 'testResult',
                success: result.success,
                message: result.message
            });
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'testResult',
                success: false,
                message: `连接失败: ${error.message}`
            });
        }
    }

    async testServiceConnection(serviceConfig) {
        const { type, baseUrl, apiKey, model } = serviceConfig;

        if (!apiKey && type !== 'ollama') {
            return {
                success: false,
                message: '请先输入API密钥'
            };
        }

        if (!baseUrl) {
            return {
                success: false,
                message: '请输入API地址'
            };
        }

        try {
            let testUrl;
            let testBody;
            let headers = {
                'Content-Type': 'application/json'
            };

            switch (type) {
                case 'openai':
                    testUrl = `${baseUrl}/v1/chat/completions`;
                    headers['Authorization'] = `Bearer ${apiKey}`;
                    testBody = {
                        model: model || 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 5
                    };
                    break;

                case 'claude':
                    testUrl = `${baseUrl}/v1/messages`;
                    headers['x-api-key'] = apiKey;
                    headers['anthropic-version'] = '2023-06-01';
                    testBody = {
                        model: model || 'claude-3-haiku-20240307',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 5
                    };
                    break;

                case 'ollama':
                    testUrl = `${baseUrl}/api/tags`;
                    testBody = null;
                    break;

                case 'custom':
                    testUrl = baseUrl;
                    if (apiKey) {
                        headers['Authorization'] = `Bearer ${apiKey}`;
                    }
                    testBody = {
                        model: model || 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 5
                    };
                    break;

                default:
                    return { success: false, message: '未知的服务类型' };
            }

            const fetch = require('node-fetch');
            const options = {
                method: testBody ? 'POST' : 'GET',
                headers,
                timeout: 10000
            };

            if (testBody) {
                options.body = JSON.stringify(testBody);
            }

            const response = await fetch(testUrl, options);

            if (response.ok) {
                return {
                    success: true,
                    message: '✅ 连接成功！'
                };
            } else {
                const errorText = await response.text();
                return {
                    success: false,
                    message: `HTTP ${response.status}: ${errorText || response.statusText}`
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `网络错误: ${error.message}`
            };
        }
    }

    getWebviewContent() {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>艾莉丝 - AI服务配置</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header h1 {
            font-size: 24px;
            margin-bottom: 8px;
        }

        .header p {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }

        .preset-section {
            margin-bottom: 30px;
        }

        .preset-section h2 {
            font-size: 16px;
            margin-bottom: 15px;
            color: var(--vscode-descriptionForeground);
        }

        .preset-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
        }

        .preset-card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 16px;
            cursor: pointer;
            transition: all 0.2s;
            background: var(--vscode-editor-background);
        }

        .preset-card:hover {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-hoverBackground);
        }

        .preset-card h3 {
            font-size: 14px;
            margin-bottom: 6px;
        }

        .preset-card p {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .services-section {
            margin-bottom: 30px;
        }

        .services-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .services-header h2 {
            font-size: 16px;
            color: var(--vscode-descriptionForeground);
        }

        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        }

        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            background: var(--vscode-secondary-button-background);
            color: var(--vscode-secondary-button-foreground);
        }

        .btn-danger {
            background: #d32f2f;
            color: white;
        }

        .btn-small {
            padding: 4px 10px;
            font-size: 12px;
        }

        .service-card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
            background: var(--vscode-editor-background);
        }

        .service-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .service-card-header h3 {
            font-size: 15px;
        }

        .service-actions {
            display: flex;
            gap: 8px;
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 500;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 13px;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        .checkbox-group {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 8px;
            margin-top: 8px;
        }

        .checkbox-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
        }

        .status-message {
            padding: 12px 16px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 13px;
        }

        .status-success {
            background: rgba(76, 175, 80, 0.1);
            border: 1px solid #4CAF50;
            color: #4CAF50;
        }

        .status-error {
            background: rgba(244, 67, 54, 0.1);
            border: 1px solid #F44336;
            color: #F44336;
        }

        .status-info {
            background: rgba(33, 150, 243, 0.1);
            border: 1px solid #2196F3;
            color: #2196F3;
        }

        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 15px 20px;
            background: var(--vscode-editor-background);
            border-top: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }

        .capabilities-list {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌸 艾莉丝 - AI服务配置</h1>
        <p>可视化配置你的AI服务，完全不用改代码！</p>
    </div>

    <div id="statusArea"></div>

    <div class="preset-section">
        <h2>📋 选择预设模板（快速开始）</h2>
        <div class="preset-grid">
            <div class="preset-card" onclick="usePreset('openai')">
                <h3>🤖 OpenAI</h3>
                <p>GPT-4、GPT-3.5等</p>
            </div>
            <div class="preset-card" onclick="usePreset('claude')">
                <h3>🎭 Claude</h3>
                <p>Claude 3 系列</p>
            </div>
            <div class="preset-card" onclick="usePreset('ollama')">
                <h3>🐐 Ollama</h3>
                <p>本地模型，免费</p>
            </div>
            <div class="preset-card" onclick="usePreset('custom')">
                <h3>⚙️ 自定义</h3>
                <p>任意第三方API</p>
            </div>
        </div>
    </div>

    <div class="services-section">
        <div class="services-header">
            <h2>🔧 已配置的AI服务</h2>
            <button class="btn btn-primary" onclick="addEmptyService()">+ 添加服务</button>
        </div>
        <div id="servicesList"></div>
    </div>

    <div class="footer">
        <button class="btn btn-secondary" onclick="resetConfig()">重置</button>
        <button class="btn btn-primary" onclick="saveAllConfig()">💾 保存配置</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        let services = [];
        const presetTemplates = ${JSON.stringify(PRESET_TEMPLATES)};

        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.command) {
                case 'loadConfig':
                    services = message.services || [];
                    renderServices();
                    break;
                case 'saveSuccess':
                    showStatus(message.message, 'success');
                    break;
                case 'saveError':
                    showStatus(message.message, 'error');
                    break;
                case 'testStarted':
                    showStatus('🔄 正在测试连接...', 'info');
                    break;
                case 'testResult':
                    showStatus(message.message, message.success ? 'success' : 'error');
                    break;
            }
        });

        function usePreset(presetId) {
            const preset = presetTemplates[presetId];
            const newService = {
                id: \`\${presetId}_\${Date.now()}\`,
                ...preset,
                apiKey: ''
            };
            services.push(newService);
            renderServices();
            showStatus(\`✅ 已添加 \${preset.name} 模板，请填写API密钥\`, 'info');
        }

        function addEmptyService() {
            services.push({
                id: \`service_\${Date.now()}\`,
                name: '新服务',
                type: 'openai',
                apiKey: '',
                baseUrl: 'https://api.openai.com',
                model: 'gpt-4',
                capabilities: ['code_generation'],
                priority: 10
            });
            renderServices();
        }

        function removeService(index) {
            if (confirm('确定要删除这个服务吗？')) {
                services.splice(index, 1);
                renderServices();
            }
        }

        function updateService(index, field, value) {
            services[index][field] = value;
        }

        function toggleCapability(index, capability) {
            const caps = services[index].capabilities;
            const idx = caps.indexOf(capability);
            if (idx > -1) {
                caps.splice(idx, 1);
            } else {
                caps.push(capability);
            }
            renderServices();
        }

        async function testServiceConnection(index) {
            vscode.postMessage({
                command: 'testConnection',
                service: services[index]
            });
        }

        function renderServices() {
            const container = document.getElementById('servicesList');
            
            if (services.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-state-icon">🤖</div>
                        <p>还没有配置任何AI服务</p>
                        <p style="margin-top: 8px; font-size: 12px;">选择上方的预设模板或点击"添加服务"开始</p>
                    </div>
                \`;
                return;
            }

            container.innerHTML = services.map((service, index) => \`
                <div class="service-card">
                    <div class="service-card-header">
                        <h3>\${service.name || '未命名服务'}</h3>
                        <div class="service-actions">
                            <button class="btn btn-secondary btn-small" onclick="testServiceConnection(\${index})">测试连接</button>
                            <button class="btn btn-danger btn-small" onclick="removeService(\${index})">删除</button>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>服务名称</label>
                            <input type="text" value="\${service.name || ''}" 
                                onchange="updateService(\${index}, 'name', this.value)">
                        </div>
                        <div class="form-group">
                            <label>服务类型</label>
                            <select onchange="updateService(\${index}, 'type', this.value)">
                                <option value="openai" \${service.type === 'openai' ? 'selected' : ''}>OpenAI</option>
                                <option value="claude" \${service.type === 'claude' ? 'selected' : ''}>Claude</option>
                                <option value="ollama" \${service.type === 'ollama' ? 'selected' : ''}>Ollama</option>
                                <option value="custom" \${service.type === 'custom' ? 'selected' : ''}>自定义</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>API密钥 \${service.type === 'ollama' ? '(可选)' : ''}</label>
                        <input type="password" value="\${service.apiKey || ''}" 
                            placeholder="请输入API密钥"
                            onchange="updateService(\${index}, 'apiKey', this.value)">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>API地址</label>
                            <input type="text" value="\${service.baseUrl || ''}" 
                                placeholder="例如: https://api.openai.com"
                                onchange="updateService(\${index}, 'baseUrl', this.value)">
                        </div>
                        <div class="form-group">
                            <label>模型名称</label>
                            <input type="text" value="\${service.model || ''}" 
                                placeholder="例如: gpt-4"
                                onchange="updateService(\${index}, 'model', this.value)">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>优先级 (0-10)</label>
                            <input type="number" min="0" max="10" value="\${service.priority || 10}" 
                                onchange="updateService(\${index}, 'priority', parseInt(this.value))">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>能力配置</label>
                        <div class="checkbox-group">
                            \${['code_generation', 'code_review', 'code_optimization', 'code_explanation', 
                                'code_completion', 'bug_fix', 'test_generation', 'documentation', 'text_generation'].map(cap => \`
                                <label class="checkbox-item">
                                    <input type="checkbox" 
                                        \${(service.capabilities || []).includes(cap) ? 'checked' : ''}
                                        onchange="toggleCapability(\${index}, '\${cap}')">
                                    \${getCapabilityName(cap)}
                                </label>
                            \`).join('')}
                        </div>
                        <div class="capabilities-list">
                            提示: 艾莉丝会根据任务类型自动选择合适能力的服务
                        </div>
                    </div>
                </div>
            \`).join('');
        }

        function getCapabilityName(cap) {
            const names = {
                'code_generation': '代码生成',
                'code_review': '代码审查',
                'code_optimization': '代码优化',
                'code_explanation': '代码解释',
                'code_completion': '代码补全',
                'bug_fix': 'Bug修复',
                'test_generation': '测试生成',
                'documentation': '文档生成',
                'text_generation': '文本生成'
            };
            return names[cap] || cap;
        }

        function showStatus(message, type = 'info') {
            const area = document.getElementById('statusArea');
            area.innerHTML = \`<div class="status-message status-\${type}">\${message}</div>\`;
            setTimeout(() => {
                area.innerHTML = '';
            }, 5000);
        }

        function saveAllConfig() {
            vscode.postMessage({
                command: 'saveConfig',
                services: services
            });
        }

        function resetConfig() {
            if (confirm('确定要重置所有配置吗？')) {
                services = [];
                renderServices();
            }
        }

        renderServices();
    </script>
</body>
</html>`;
    }
}

module.exports = {
    ConfigWizard,
    PRESET_TEMPLATES
};
