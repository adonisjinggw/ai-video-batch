# 艾莉丝 (Alice) - 智能AI助手插件

🌸 艾莉丝 - 多模型集成，安全可靠的代码助手，智能调用不同AI服务

## 特性

- 🤖 **多AI服务集成** - 支持 OpenAI GPT、Claude、本地模型(Ollama)、自定义第三方API
- 🧠 **智能意图识别** - 自动理解用户需求，选择最合适的任务类型
- 🔒 **安全模式** - 防止AI乱改代码，所有修改需要用户确认
- 🎯 **任务调度** - 根据任务类型自动选择最佳AI服务
- 📊 **变更预览** - 代码修改前展示Diff预览
- 💻 **多平台支持** - VSCode、Trae CN、Cursor CC

## 核心功能

### 1. AI服务管理

支持多种AI服务类型：
- **OpenAI 兼容API** - GPT-4、GPT-3.5等
- **Claude** - Anthropic Claude 3系列
- **Ollama** - 本地部署的开源模型
- **自定义API** - 任意第三方中转API

### 2. 智能意图识别

自动识别以下任务类型：
- 代码生成
- 代码补全
- 代码解释
- 代码审查
- 代码优化
- 代码重构
- Bug修复
- 测试生成
- 文档生成

### 3. 安全检查机制

- ✅ 所有代码修改需要用户确认
- ✅ 限制单次修改比例（默认30%）
- ✅ 检测危险操作（eval、exec、rm -rf等）
- ✅ 保护敏感代码（API密钥、导入语句等）
- ✅ 语法检查

## 安装

### VSCode 扩展

1. 克隆此仓库
2. 在 VSCode 中按 `F5` 启动扩展开发主机
3. 或使用 `vsce package` 打包成 `.vsix` 文件安装

## 配置

在 VSCode 设置中配置 AI 服务：

```json
{
  "alice.aiServices": [
    {
      "id": "openai-gpt4",
      "name": "OpenAI GPT-4",
      "type": "openai",
      "apiKey": "your-api-key",
      "baseUrl": "https://api.openai.com",
      "model": "gpt-4",
      "capabilities": ["code_generation", "code_review"],
      "priority": 10
    }
  ],
  "alice.safetyMode": true
}
```

详细配置示例见 [examples/config-example.json](examples/config-example.json)

## 使用方法

### VSCode 命令

1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入以下命令：

- `艾莉丝: 启动助手` - 开始对话
- `艾莉丝: 配置AI服务` - 打开设置
- `艾莉丝: 代码审查` - 审查选中的代码

### 使用示例

```
用户: 帮我写一个快速排序函数
→ 艾莉丝识别为"代码生成"任务
→ 选择最适合的AI服务
→ 生成代码
→ 展示预览并等待确认
```

```
用户: 解释一下这段代码
→ 艾莉丝识别为"代码解释"任务
→ 提供详细的代码说明
```

```
用户: 审查一下这个文件
→ 艾莉丝识别为"代码审查"任务
→ 提供代码质量反馈和改进建议
```

## 项目结构

```
alice-plugin/
├── src/
│   ├── core/
│   │   ├── ai-service-manager.js    # AI服务管理器
│   │   ├── intent-engine.js          # 意图理解引擎
│   │   ├── code-safety.js            # 代码安全检查器
│   │   └── task-orchestrator.js      # 任务调度器
│   ├── platforms/
│   │   └── vscode-extension.js       # VSCode扩展入口
│   └── index.js                       # 主入口
├── examples/
│   ├── config-example.json            # 配置示例
│   └── usage-example.js              # 使用示例
└── package.json
```

## 核心模块说明

### AIServiceManager
管理多个AI服务的配置、注册和调用。

### IntentEngine
分析用户输入，识别任务类型，计算置信度。

### CodeSafetyChecker
检查代码修改的安全性，生成Diff预览，创建审批请求。

### TaskOrchestrator
协调所有模块，处理用户请求的完整流程。

## 作为库使用

```javascript
const { createOrchestrator } = require('alice-plugin');

const orchestrator = createOrchestrator({
    safetyOptions: {
        safetyMode: true,
        maxChangeRatio: 0.3
    }
});

orchestrator.initialize([
    {
        id: 'my-service',
        name: 'My AI Service',
        type: 'openai',
        apiKey: 'your-key',
        model: 'gpt-4',
        capabilities: ['code_generation'],
        priority: 10
    }
]);

const result = await orchestrator.processRequest('帮我写一个函数');
```

## 安全说明

本插件采用"安全第一"的设计原则：

1. **不会自动修改文件** - 所有修改都需要用户明确确认
2. **预览变更** - 应用前先展示Diff预览
3. **限制修改范围** - 单次修改不能超过文件的30%
4. **检测危险操作** - 防止执行危险的系统命令
5. **保护敏感内容** - 不允许修改API密钥等敏感信息

## 开发计划

- [ ] 支持更多AI服务（Gemini、文心一言等）
- [ ] 增强意图理解能力（使用LLM分析）
- [ ] 添加自定义任务类型
- [ ] 团队协作功能
- [ ] 使用历史记录和学习
- [ ] Trae CN 平台适配
- [ ] Cursor CC 平台适配

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
