# 🌸 艾莉丝 (Alice) - Claude Code 使用指南

## Claude Code 是什么？

Claude Code 是 Anthropic 官方推出的 AI 代码编辑器，内置 Claude AI。艾莉丝可以作为独立库在 Claude Code 中使用，或通过其他方式集成。

## 方式1：作为 Node.js 库使用（推荐）

Claude Code 支持运行 JavaScript/Node.js 代码，你可以直接使用艾莉丝的核心功能：

### 1. 在 Claude Code 中打开项目

1. **打开 Claude Code**
2. **打开文件夹** - 打开 `ai-orchestrator-plugin` 文件夹
3. **打开终端** - 按 `` Ctrl+` `` 或点击底部终端

### 2. 创建一个简单的使用脚本

在 Claude Code 中创建 `alice-demo.js`：

```javascript
/**
 * 在 Claude Code 中使用艾莉丝
 */

const { createOrchestrator } = require('./src/index');

async function main() {
    console.log('🌸 艾莉丝启动中...\n');

    const orchestrator = createOrchestrator({
        safetyOptions: {
            safetyMode: true,
            maxChangeRatio: 0.3,
            requiredConfirmation: true
        }
    });

    orchestrator.initialize([
        {
            id: 'my-openai',
            name: '我的 OpenAI',
            type: 'openai',
            apiKey: 'sk-你的密钥',
            baseUrl: 'https://api.openai.com',
            model: 'gpt-4',
            capabilities: ['code_generation', 'text_generation'],
            priority: 10
        }
    ]);

    console.log('✅ 艾莉丝准备好了！');
    console.log('现在你可以:');
    console.log('1. 使用 orchestrator 处理请求');
    console.log('2. 测试意图理解功能');
    console.log('3. 测试代码安全检查\n');

    const testInput = '帮我写一个快速排序函数';
    const intent = orchestrator.intentEngine.analyzeIntent(testInput);
    console.log(`测试: "${testInput}"`);
    console.log(`识别为: ${orchestrator.intentEngine.getTaskTypeDescription(intent.taskType)}`);
    console.log(`置信度: ${(intent.confidence * 100).toFixed(1)}%\n`);

    console.log('查看更多示例: examples/usage-example.js');
}

main().catch(console.error);
```

### 3. 运行脚本

在 Claude Code 终端中：

```bash
node alice-demo.js
```

## 方式2：与 Claude Code 内置 AI 配合使用

Claude Code 内置了强大的 Claude AI，你可以：

### 场景1：用艾莉丝做安全检查

1. **让 Claude 生成代码**
   - 在 Claude Code 中让 Claude 帮你写代码

2. **用艾莉丝检查安全性**
   - 把 Claude 生成的代码传给艾莉丝
   - 艾莉丝检查是否有问题
   - 确认后再应用

### 场景2：用艾莉丝做意图理解

1. **把你的需求告诉艾莉丝**
   - 艾莉丝识别你的意图
   - 艾莉丝选择最适合的任务类型

2. **再让 Claude 执行**
   - 根据识别的任务类型
   - 让 Claude 来完成具体工作

## 方式3：创建 Claude Code 自定义命令

Claude Code 支持自定义脚本和命令，你可以：

### 创建快捷命令脚本

创建 `alice-commands.js`：

```javascript
/**
 * 艾莉丝快捷命令
 */

const { createOrchestrator } = require('./src/index');

let orchestrator;

function initAlice() {
    if (!orchestrator) {
        orchestrator = createOrchestrator({
            safetyOptions: { safetyMode: true }
        });
        orchestrator.initialize([
            {
                id: 'my-service',
                name: '我的AI',
                type: 'openai',
                apiKey: 'sk-你的密钥',
                model: 'gpt-4',
                capabilities: ['code_generation'],
                priority: 10
            }
        ]);
    }
    return orchestrator;
}

async function analyzeIntent(input) {
    const alice = initAlice();
    const intent = alice.intentEngine.analyzeIntent(input);
    return {
        taskType: intent.taskType,
        description: alice.intentEngine.getTaskTypeDescription(intent.taskType),
        confidence: intent.confidence
    };
}

async function checkSafety(originalCode, proposedCode) {
    const alice = initAlice();
    return alice.codeSafetyChecker.checkCodeModification(originalCode, proposedCode);
}

module.exports = {
    analyzeIntent,
    checkSafety
};
```

## Claude Code 中的工作流示例

### 示例1：安全的代码生成流程

```
1. 你: "帮我写一个用户认证系统"
   ↓
2. 艾莉丝: 识别为"代码生成"任务
   ↓
3. 你选择让 Claude Code 或艾莉丝配置的AI来生成
   ↓
4. 代码生成后，艾莉丝做安全检查
   ↓
5. 展示Diff预览给你确认
   ↓
6. 你确认后才应用
```

### 示例2：代码审查流程

```
1. 选中一段代码
   ↓
2. 运行艾莉丝的代码审查
   ↓
3. 艾莉丝用配置好的AI服务审查
   ↓
4. 给出审查结果和建议
```

## 配置你的 AI 服务

在 Claude Code 中，创建 `alice-config.json`：

```json
{
  "aiServices": [
    {
      "id": "openai-gpt4",
      "name": "OpenAI GPT-4",
      "type": "openai",
      "apiKey": "sk-你的OpenAI密钥",
      "baseUrl": "https://api.openai.com",
      "model": "gpt-4",
      "capabilities": [
        "code_generation",
        "code_review",
        "code_optimization",
        "text_generation"
      ],
      "priority": 10
    },
    {
      "id": "claude-3",
      "name": "Claude 3 Opus",
      "type": "claude",
      "apiKey": "sk-ant-你的Claude密钥",
      "baseUrl": "https://api.anthropic.com",
      "model": "claude-3-opus-20240229",
      "capabilities": [
        "code_generation",
        "code_explanation",
        "documentation",
        "text_generation"
      ],
      "priority": 9
    }
  ],
  "safetyMode": true
}
```

然后在你的脚本中加载：

```javascript
const config = require('./alice-config.json');
const orchestrator = createOrchestrator({ safetyOptions: { safetyMode: config.safetyMode } });
orchestrator.initialize(config.aiServices);
```

## 艾莉丝 + Claude Code 优势

| 功能 | Claude Code 自带 | 艾莉丝 |
|------|-----------------|--------|
| 代码生成 | ✅ | ✅ |
| 多AI服务 | ❌ | ✅ |
| 安全检查 | ⚠️ 基础 | ✅ 完整 |
| 意图理解 | ⚠️ 基础 | ✅ 智能 |
| 变更预览 | ❌ | ✅ |
| 可配置 | ⚠️ 有限 | ✅ 高度可配 |

## 快速开始

1. **在 Claude Code 中打开文件夹** - 打开 `ai-orchestrator-plugin`
2. **查看示例** - 打开 `examples/usage-example.js`
3. **创建配置** - 复制 `examples/config-example.json` 填入你的密钥
4. **开始使用** - 编写你自己的脚本！

## 更多文档

- [快速开始.md](快速开始.md) - 基础使用指南
- [README.md](README.md) - 完整项目文档
- [examples/](examples/) - 更多示例代码

---

艾莉丝 + Claude Code = 🚀 更强大、更安全的 AI 编程体验！
