# Sora2 故事板 + 固定角色 完整使用指南

## 📋 目录
1. [功能概述](#功能概述)
2. [故事板格式说明](#故事板格式说明)
3. [四种使用方法](#四种使用方法)
4. [如何多次使用角色](#如何多次使用角色)
5. [如何使用已有角色](#如何使用已有角色)
6. [完整代码示例](#完整代码示例)
7. [API 参数参考](#api-参数参考)

---

## 功能概述

### 故事板（Storyboard）是什么？
故事板是一种多镜头视频生成格式，允许你在一个视频中定义多个连续的场景（镜头），每个镜头可以有独立的时长和场景描述。

### 固定角色（Character）是什么？
固定角色功能让你可以在多个视频中保持同一角色的外观一致性，实现"一次创建，多次使用"。

### 核心特性
- ✅ **故事板格式**：支持多镜头视频，每个镜头独立描述
- ✅ **自动创建角色**：从视频URL自动提取角色
- ✅ **从任务创建角色**：从已生成的视频任务中提取角色
- ✅ **角色复用**：同一角色可在无限个视频中重复使用
- ✅ **多角色支持**：单个视频最多使用6个角色

---

## 故事板格式说明

### Prompt 格式
```
Shot 1:
duration: 5sec
Scene: [第一个镜头的场景描述]

Shot 2:
duration: 5sec
Scene: [第二个镜头的场景描述]

Shot 3:
duration: 5sec
Scene: [第三个镜头的场景描述]
```

### 参数说明
| 参数 | 说明 | 限制 |
|-----|------|------|
| `Shot N` | 镜头编号，从1开始 | 按顺序排列 |
| `duration` | 镜头时长 | 格式：`Nsec`，如 `5sec` |
| `Scene` | 场景描述 | 英文描述效果更好 |

### 构建工具函数
```javascript
function buildStoryboardPrompt(shots) {
    return shots.map((shot, index) => {
        const shotNum = index + 1;
        const duration = shot.duration || 5;
        const scene = shot.scene || '';
        return `Shot ${shotNum}:\nduration: ${duration}sec\nScene: ${scene}`;
    }).join('\n\n');
}

// 使用示例
const prompt = buildStoryboardPrompt([
    { duration: 5, scene: 'A purple monster opens the fridge door' },
    { duration: 5, scene: 'The monster walks out slowly' },
    { duration: 5, scene: 'Another monster appears behind' }
]);
```

---

## 四种使用方法

### 方法一：自动创建角色（最简单）
**适用场景**：有一个包含角色的视频URL，想在新视频中使用该角色

```javascript
const response = await fetch('/api/sora2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'text-to-video',
        userId: 'your-user-id',
        model: 'sora-2',
        prompt: 'Shot 1:\nduration: 5sec\nScene: A monster dancing in a garden',
        seconds: '15',
        size: '16x9',
        
        // 🌟 关键参数
        character_url: 'https://example.com/video-with-character.mp4',
        character_timestamps: '1,3'  // 从1秒到3秒提取角色
    })
});
```

**重要限制**：
- `character_url` 视频中**不能出现真人**，否则会失败
- `character_timestamps` 范围必须是 1-3 秒

---

### 方法二：从已完成任务创建角色
**适用场景**：已经生成了一个包含角色的视频，想从中提取角色

```javascript
// 步骤1：创建角色
const createResponse = await fetch('/api/sora2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'create-character',
        userId: 'your-user-id',
        from_task: 'task_abc123',  // 🌟 已完成的视频任务ID
        timestamps: '1,3'
    })
});

const { character } = await createResponse.json();
const username = character.username;  // 保存这个！

// 步骤2：使用角色生成新视频
const videoResponse = await fetch('/api/sora2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'text-to-video',
        userId: 'your-user-id',
        model: 'sora-2-all',
        prompt: '...',
        character_usernames: [username]  // 使用已创建的角色
    })
});
```

---

### 方法三：生成视频时自动创建角色
**适用场景**：想先生成一个角色定义视频，然后自动保存角色供后续使用

```javascript
const response = await fetch('/api/sora2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'text-to-video',
        userId: 'your-user-id',
        model: 'sora-2',
        prompt: 'Shot 1:\nduration: 5sec\nScene: A purple monster facing the camera...',
        seconds: '15',
        size: '16x9',
        
        // 🌟 关键参数：视频生成完成后自动创建角色
        character_create: true
    })
});

// 视频完成后，可以通过 from_task 获取角色
```

---

### 方法四：使用已有角色（复用）
**适用场景**：已经创建并保存了角色的 username，想在新视频中使用

```javascript
// 假设之前已保存: const savedUsername = 'user_abc123xyz';

const response = await fetch('/api/sora2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'text-to-video',
        userId: 'your-user-id',
        model: 'sora-2-all',
        prompt: 'Shot 1:\nduration: 5sec\nScene: The monster is on a beach...',
        seconds: '15',
        size: '16x9',
        
        // 🌟 关键参数：使用已有角色
        character_usernames: [savedUsername]  // 或单个: character_username: savedUsername
    })
});
```

---

## 如何多次使用角色

### 核心概念
角色一旦创建，会得到一个 `username`（格式如 `user_xxx`），这个 username 可以无限次使用。

### 完整流程
```javascript
// ========== 第一次：创建角色 ==========
// 方式A：从视频URL创建
const char = await fetch('/api/sora2', {
    method: 'POST',
    body: JSON.stringify({
        action: 'create-character',
        userId: userId,
        url: 'https://example.com/video.mp4',
        timestamps: '1,3'
    })
}).then(r => r.json());

const username = char.character.username;

// 💾 保存 username（重要！）
localStorage.setItem('my_character', username);

// ========== 第二次及以后：使用角色 ==========
const savedUsername = localStorage.getItem('my_character');

// 视频1
await fetch('/api/sora2', {
    method: 'POST',
    body: JSON.stringify({
        action: 'text-to-video',
        userId: userId,
        prompt: '场景1描述...',
        character_usernames: [savedUsername]
    })
});

// 视频2（同一角色，不同场景）
await fetch('/api/sora2', {
    method: 'POST',
    body: JSON.stringify({
        action: 'text-to-video',
        userId: userId,
        prompt: '场景2描述...',
        character_usernames: [savedUsername]  // 复用同一角色
    })
});

// 视频3, 4, 5... 无限复用
```

### 角色管理建议
```javascript
// 推荐：使用管理器类保存角色
class CharacterManager {
    constructor() {
        this.characters = JSON.parse(localStorage.getItem('sora2_characters') || '{}');
    }
    
    save(name, username) {
        this.characters[name] = { username, createdAt: new Date().toISOString() };
        localStorage.setItem('sora2_characters', JSON.stringify(this.characters));
    }
    
    get(name) {
        return this.characters[name]?.username;
    }
    
    list() {
        return Object.entries(this.characters);
    }
}

// 使用
const manager = new CharacterManager();
manager.save('hero', 'user_abc123');  // 保存
const hero = manager.get('hero');      // 获取
```

---

## 如何使用已有角色

### 场景1：使用自己之前创建的角色
```javascript
// 1. 获取已保存的 username
const username = localStorage.getItem('my_character');
// 或从管理器获取
const username = manager.get('hero');

// 2. 在新视频中使用
fetch('/api/sora2', {
    method: 'POST',
    body: JSON.stringify({
        action: 'text-to-video',
        userId: userId,
        prompt: '...',
        character_usernames: [username]
    })
});
```

### 场景2：使用多个已有角色（多人场景）
```javascript
// 假设已有角色：hero, villain, sidekick
const characters = [
    manager.get('hero'),
    manager.get('villain'),
    manager.get('sidekick')
].filter(Boolean);  // 过滤空值

fetch('/api/sora2', {
    method: 'POST',
    body: JSON.stringify({
        action: 'text-to-video',
        userId: userId,
        prompt: 'Three characters meet in the park...',
        character_usernames: characters  // 最多6个
    })
});
```

### 场景3：从历史视频任务提取角色
```javascript
// 假设知道某个成功的任务ID
const oldTaskId = 'task_xyz789';

// 1. 从任务创建角色
const res = await fetch('/api/sora2', {
    method: 'POST',
    body: JSON.stringify({
        action: 'create-character',
        userId: userId,
        from_task: oldTaskId,  // 🌟 使用任务ID
        timestamps: '1,3'
    })
}).then(r => r.json());

// 2. 保存并使用
const newCharacter = res.character.username;
manager.save('extracted_character', newCharacter);
```

---

## 完整代码示例

### 示例1：创建一个小怪物IP并制作系列视频

```javascript
async function createMonsterSeries(userId) {
    const manager = new CharacterManager();
    
    // 第1步：生成定义角色的初始视频
    console.log('📹 创建角色定义视频...');
    const video1 = await fetch('/api/sora2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'text-to-video',
            userId: userId,
            model: 'sora-2',
            prompt: `Shot 1:
duration: 5sec
Scene: A cute purple cartoon monster with big round eyes standing front of white background

Shot 2:
duration: 5sec
Scene: The purple monster waves hello and smiles showing small white teeth

Shot 3:
duration: 5sec
Scene: Close-up of the purple monster face with friendly expression`,
            seconds: '15',
            size: '16x9',
            character_create: true  // 自动创建角色
        })
    }).then(r => r.json());
    
    const taskId = video1.id || video1.task_id;
    console.log('✅ 初始视频任务:', taskId);
    
    // 等待视频完成（省略轮询代码）...
    
    // 第2步：从视频创建角色
    console.log('🧬 创建角色...');
    const charRes = await fetch('/api/sora2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'create-character',
            userId: userId,
            from_task: taskId,
            timestamps: '1,3'
        })
    }).then(r => r.json());
    
    const username = charRes.character.username;
    manager.save('purple_monster', username);
    console.log('✅ 角色已保存:', username);
    
    // 第3步：使用角色制作系列视频
    const scenes = [
        'The purple monster is exploring a beautiful garden with colorful flowers',
        'The purple monster is at the beach building a sandcastle',
        'The purple monster is cooking in a cozy kitchen'
    ];
    
    for (let i = 0; i < scenes.length; i++) {
        console.log(`🎥 生成场景 ${i + 1}/${scenes.length}...`);
        
        const video = await fetch('/api/sora2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'text-to-video',
                userId: userId,
                model: 'sora-2-all',
                prompt: `Shot 1:
duration: 5sec
Scene: ${scenes[i]}

Shot 2:
duration: 5sec
Scene: The purple monster looks happy and excited

Shot 3:
duration: 5sec
Scene: The purple monster waves goodbye to the camera`,
                seconds: '15',
                size: '16x9',
                character_usernames: [username]  // 复用角色
            })
        }).then(r => r.json());
        
        console.log(`✅ 场景 ${i + 1} 任务ID:`, video.id || video.task_id);
        
        // 避免请求过快
        await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log('🎉 系列视频创建完成！');
    return { character: username, scenesCount: scenes.length };
}
```

---

## API 参数参考

### 创建视频 (action: 'text-to-video')

| 参数 | 类型 | 必需 | 说明 |
|-----|------|------|------|
| `action` | string | ✅ | 固定为 `'text-to-video'` |
| `userId` | string | ✅ | 用户ID |
| `prompt` | string | ✅ | 故事板格式的提示词 |
| `model` | string | ❌ | 模型名称，默认 `'sora-2'` |
| `seconds` | string | ❌ | 视频时长：`'10'`/`'15'`/`'25'`（25仅pro） |
| `size` | string | ❌ | 宽高比：`'16x9'`（横屏）/`'9x16'`（竖屏） |
| `character_url` | string | ❌ | 角色来源视频URL |
| `character_timestamps` | string | ❌ | 角色时间范围，如 `'1,3'` |
| `character_from_task` | string | ❌ | 从已完成任务ID创建角色 |
| `character_create` | boolean | ❌ | 视频完成后自动创建角色 |
| `character_usernames` | array | ❌ | 使用已有角色（最多6个） |
| `watermark` | string | ❌ | 是否水印：`'true'`/`'false'` |
| `private` | string | ❌ | 是否私密：`'true'`/`'false'` |

### 创建角色 (action: 'create-character')

| 参数 | 类型 | 必需 | 说明 |
|-----|------|------|------|
| `action` | string | ✅ | 固定为 `'create-character'` |
| `userId` | string | ✅ | 用户ID |
| `url` | string | ⚠️ | 视频URL（与 from_task 二选一） |
| `from_task` | string | ⚠️ | 任务ID（与 url 二选一） |
| `timestamps` | string | ❌ | 时间范围，默认 `'1,3'` |

### 返回值

**创建视频返回：**
```json
{
    "id": "task_xxx",
    "task_id": "task_xxx",
    "model": "sora-2",
    "status": "PENDING",
    "_source": "yunmeng",
    "_endpoint": "https://..."
}
```

**创建角色返回：**
```json
{
    "success": true,
    "character": {
        "id": "char_xxx",
        "username": "user_xxx",  // 🌟 这个用于复用
        "permalink": "https://...",
        "profile_picture_url": "https://..."
    }
}
```

---

## 常见问题

### Q: 角色会过期吗？
A: 角色 username 通常不会过期，可以长期使用。

### Q: 图生视频能创建角色吗？
A: 不能。图生视频只能使用已有的 username，不能创建新角色。

### Q: 为什么角色创建失败？
A: 常见原因：
1. 视频中出现真人（禁止）
2. 时间范围不在 1-3 秒内
3. 视频URL无法访问
4. 视频质量太低

### Q: 最多能用多少个角色？
A: 单个视频最多 6 个角色，总角色数量无限制。

---

## 相关文件
- 📝 示例代码：`examples/sora2-storyboard-character-example.js`
- 🔧 API 源码：`api/sora2.js`
- 📚 通用角色指南：`docs/sora2-character-guide.md`

---

**更新日期**: 2026-01-12
**版本**: 1.0.0
