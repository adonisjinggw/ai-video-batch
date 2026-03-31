# 🌸 艾莉丝 (Alice) - Cursor CC 使用指南

## Cursor CC 安装方法

### 方法1：作为VSCode扩展安装（推荐）

Cursor CC 基于 VSCode 构建，完全兼容 VSCode 扩展：

1. **打开 Cursor CC**
2. **打开扩展面板** - 按 `Ctrl+Shift+X` 或点击左侧扩展图标
3. **安装扩展** - 点击 `...` 菜单 → `Install from VSIX...`
4. **选择文件** - 如果你已经打包了 `.vsix` 文件，选择它安装
5. **或从源码安装** - 直接打开插件文件夹

### 方法2：从源码直接加载

1. **在 Cursor CC 中打开插件文件夹**
   - 文件 → 打开文件夹
   - 选择 `alice-plugin` 文件夹

2. **启动开发模式**
   - 按 `F5` 启动扩展开发主机
   - 这会打开一个新的 Cursor CC 窗口，艾莉丝已加载

## Cursor CC 配置步骤

### 1. 打开设置

- 按 `Ctrl+,` 或 左下角齿轮图标 → 设置
- 搜索 "艾莉丝" 或 "alice"

### 2. 编辑设置 JSON

点击 `Edit in settings.json`，添加以下配置：

```json
{
  "alice.aiServices": [
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
  "alice.safetyMode": true
}
```

## Cursor CC 中使用艾莉丝

### 方式1：使用命令面板（推荐）

1. **打开命令面板** - 按 `Ctrl+Shift+P`
2. **输入命令** - 输入 "艾莉丝" 或 "alice"
3. **选择命令**：
   - `艾莉丝: 启动助手` - 开始对话
   - `艾莉丝: 配置AI服务` - 打开设置
   - `艾莉丝: 代码审查` - 审查选中的代码

### 方式2：右键菜单

1. **选中代码** - 在编辑器中选中一段代码
2. **右键点击** - 打开上下文菜单
3. **选择命令** - 找到艾莉丝相关命令

### 方式3：键盘快捷键（自定义）

1. **打开键盘快捷键设置** - 按 `Ctrl+K Ctrl+S`
2. **搜索命令** - 搜索 "艾莉丝"
3. **设置快捷键** - 为常用命令设置快捷键，例如：
   - `Ctrl+Alt+A` - 启动助手
   - `Ctrl+Alt+R` - 代码审查

## Cursor CC 专属技巧

### 1. 结合 Cursor 的 AI 功能

Cursor CC 自带 AI 功能，你可以：
- 用 Cursor 做快速补全
- 用艾莉丝做复杂的代码生成和审查
- 两者结合使用，效率更高！

### 2. 侧边栏使用

艾莉丝的输出会在 "输出" 面板显示：
- 点击底部面板的 "输出" 标签
- 选择 "艾莉丝 (Alice)" 查看详细日志

### 3. 多选代码

选中多行或多段代码后再使用艾莉丝，效果更好！

## 常见问题 - Cursor CC 版

### Q: Cursor CC 和 VSCode 有什么区别？
A: Cursor CC 基于 VSCode，使用体验几乎一样，但 Cursor 自带 AI 功能。艾莉丝可以和 Cursor 自带 AI 配合使用。

### Q: 可以同时使用 Cursor 自带 AI 和艾莉丝吗？
A: 当然可以！两者互不冲突，可以配合使用。

### Q: 艾莉丝会比 Cursor 自带 AI 好吗？
A: 各有优势！艾莉丝的特点是：
- 可以配置多个 AI 服务
- 有更严格的安全保护
- 智能调度不同能力的模型
- 不会乱改代码

### Q: 如何查看艾莉丝是否正常工作？
A: 查看输出面板（View → Output），选择 "艾莉丝 (Alice)"，可以看到详细日志。

## 快速参考卡

### 常用命令

| 命令 | 作用 |
|------|------|
| `艾莉丝: 启动助手` | 开始对话，输入需求 |
| `艾莉丝: 配置AI服务` | 打开设置页面 |
| `艾莉丝: 代码审查` | 审查选中的代码 |

### 常用说法

| 你可以说 | 艾莉丝会做 |
|----------|-----------|
| 帮我写一个XXX函数 | 代码生成 |
| 解释一下这段代码 | 代码解释 |
| 审查一下这段代码 | 代码审查 |
| 优化一下这个函数 | 代码优化 |
| 修复这个bug | Bug修复 |
| 给代码写文档 | 文档生成 |

### 安全提示

🔒 艾莉丝默认开启安全模式：
- 所有代码修改都需要你确认
- 单次修改不超过30%
- 不会执行危险操作
- 保护敏感信息

## 下一步

- 查看 [快速开始.md](快速开始.md) 了解基础使用
- 查看 [README.md](README.md) 了解完整文档
- 查看 [examples/config-example.json](examples/config-example.json) 了解更多配置

---

祝使用愉快！🌸
