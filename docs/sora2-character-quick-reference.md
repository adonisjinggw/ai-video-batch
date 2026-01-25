# Sora2 固定角色功能 - 快速参考卡

## 🚀 快速上手（3步）

### 方法1️⃣：一步到位（最简单）
```javascript
// 直接在生成视频时指定角色来源
fetch('/api/sora2', {
    method: 'POST',
    body: JSON.stringify({
        action: 'text-to-video',
        userId: 'your-id',
        prompt: 'A person walking',
        model: 'sora-2-all',
        character_url: 'https://example.com/video.mp4',  // 角色来源视频
        character_timestamps: '1,3'  // 提取1-3秒的角色
    })
});
```

### 方法2️⃣：创建一次，多次使用（推荐）

**步骤1：创建角色**
```javascript
const res = await fetch('/api/sora2', {
    method: 'POST',
    body: JSON.stringify({
        action: 'create-character',
        userId: 'your-id',
        url: 'https://example.com/video.mp4',
        timestamps: '1,3'
    })
});
const { character } = await res.json();
const username = character.username;  // 保存这个！
```

**步骤2：使用角色（可无限次）**
```javascript
fetch('/api/sora2', {
    method: 'POST',
    body: JSON.stringify({
        action: 'text-to-video',
        userId: 'your-id',
        prompt: 'Dancing in the rain',
        model: 'sora-2-all',
        character_usernames: [username]  // 使用已保存的角色
    })
});
```

---

## 📋 API 参数速查表

### 创建角色 API
```javascript
{
    action: 'create-character',  // 固定值
    userId: string,              // 必需：用户ID
    url: string,                 // 必需：视频URL
    timestamps: string           // 必需：时间范围，如 '1,3'
}
```

**返回值：**
```javascript
{
    success: true,
    character: {
        id: "char_xxx",           // 角色ID
        username: "user_xxx",     // 🌟 重要：用于复用
        permalink: "https://...",
        profile_picture_url: "https://..."
    }
}
```

### 使用角色生成视频 API

**文生视频：**
```javascript
{
    action: 'text-to-video',
    userId: string,
    prompt: string,
    model: 'sora-2-all',
    
    // 方式A：自动创建角色
    character_url: string,           // 视频URL
    character_timestamps: string,    // 时间范围
    
    // 方式B：使用已有角色
    character_usernames: [string],   // username数组（最多6个）
    // 或
    character_username: string       // 单个username
}
```

**图生视频：**
```javascript
{
    action: 'image-to-video',
    userId: string,
    image_url: string,
    prompt: string,
    model: 'sora-2-all',
    
    // 只能使用已有角色，不能创建新角色
    character_usernames: [string]
}
```

---

## 🎯 核心概念

| 概念 | 说明 |
|-----|------|
| **character_url** | 包含目标角色的视频URL（用于提取角色） |
| **character_timestamps** | 时间范围，格式 `'开始秒,结束秒'`，如 `'1,3'` |
| **username** | 角色的唯一标识符，创建后可重复使用 |
| **character_usernames** | 使用已有角色时传入的username数组 |

---

## ⚙️ 参数限制

| 参数 | 限制 |
|-----|------|
| `timestamps` 时间范围 | 最小1秒，最大3秒 |
| 单视频角色数量 | 最多6个 |
| 总角色数量 | 无限制 |
| username格式 | `user_xxxxxxxxx`（系统生成） |

---

## 💡 使用场景对照表

| 场景 | 推荐方法 | 说明 |
|-----|---------|------|
| 只生成1个视频 | 方法1（自动） | 最简单，不需要保存 |
| 生成2-5个视频 | 方法2（手动） | 创建一次，多次使用 |
| 批量生产内容 | 方法2（手动） | 保存username，长期复用 |
| 多角色视频 | 方法2（手动） | 创建多个角色，一起使用 |
| 图生视频+角色 | 必须方法2 | 图生视频不能创建新角色 |

---

## 🔄 完整工作流程图

```
1. 准备素材
   ↓
   有包含角色的视频？
   ├─ 是 → 继续
   └─ 否 → 先生成一个包含角色的视频

2. 选择方法
   ↓
   需要多次使用同一角色？
   ├─ 是 → 【方法2】创建角色 → 保存username → 多次使用
   └─ 否 → 【方法1】直接指定character_url → 完成

3. 生成视频
   ↓
   调用 /api/sora2 (action: text-to-video)
   ↓
   获得 task_id
   ↓
   轮询任务状态 (action: poll)
   ↓
   完成！
```

---

## 📦 代码模板库

### 模板1：保存和加载角色

```javascript
// 保存角色
function saveCharacter(name, username, videoUrl) {
    const chars = JSON.parse(localStorage.getItem('sora2_chars') || '{}');
    chars[name] = { username, videoUrl, createdAt: Date.now() };
    localStorage.setItem('sora2_chars', JSON.stringify(chars));
}

// 加载角色
function getCharacter(name) {
    const chars = JSON.parse(localStorage.getItem('sora2_chars') || '{}');
    return chars[name]?.username;
}

// 列出所有角色
function listCharacters() {
    return JSON.parse(localStorage.getItem('sora2_chars') || '{}');
}
```

### 模板2：批量生成

```javascript
async function batchGenerate(userId, username, scenes) {
    const tasks = [];
    for (const scene of scenes) {
        const res = await fetch('/api/sora2', {
            method: 'POST',
            body: JSON.stringify({
                action: 'text-to-video',
                userId,
                prompt: scene,
                model: 'sora-2-all',
                character_usernames: [username]
            })
        });
        const data = await res.json();
        tasks.push(data.task_id);
        await new Promise(r => setTimeout(r, 2000)); // 延迟2秒
    }
    return tasks;
}
```

### 模板3：轮询视频状态

```javascript
async function waitForVideo(taskId, source, endpoint) {
    for (let i = 0; i < 60; i++) {
        const res = await fetch('/api/sora2', {
            method: 'POST',
            body: JSON.stringify({
                action: 'poll',
                task_id: taskId,
                _source: source,
                _endpoint: endpoint
            })
        });
        const data = await res.json();
        
        if (data.status === 'COMPLETED') return data.url;
        if (data.status === 'FAILED') throw new Error(data.error);
        
        await new Promise(r => setTimeout(r, 5000)); // 等5秒
    }
    throw new Error('超时');
}
```

---

## ⚠️ 常见错误

| 错误 | 原因 | 解决方法 |
|-----|------|---------|
| `MISSING_URL_OR_TASK_ID` | create-character时未提供视频URL | 检查 `url` 参数 |
| `找不到角色` | username无效或过期 | 重新创建角色 |
| `参数错误` | character_timestamps格式错误 | 使用格式 `'1,3'` |
| `图生视频失败` | 图生视频尝试创建新角色 | 只能使用已有username |
| `角色不存在` | username拼写错误 | 检查是否正确保存和读取 |

---

## 🎓 学习路径

1. **入门**（5分钟）
   - 阅读"快速上手"部分
   - 运行方法1的示例代码
   - 成功生成第一个固定角色视频

2. **进阶**（15分钟）
   - 学习方法2：创建和复用角色
   - 实现角色保存和加载
   - 尝试生成3个使用同一角色的视频

3. **高级**（30分钟）
   - 实现批量生成功能
   - 创建角色管理系统
   - 尝试多角色视频（2-3个角色）

4. **专家**（1小时）
   - 集成到现有项目
   - 实现完整的工作流程
   - 优化错误处理和重试机制

---

## 🔗 相关链接

- 📘 [完整使用指南](./sora2-character-guide.md)
- 💻 [代码示例](../examples/sora2-fixed-character-example.js)
- 🔧 [API源码](../api/sora2.js)

---

**提示**：这是快速参考卡片，更详细的信息请查看完整使用指南。
