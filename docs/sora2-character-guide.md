# Sora2 固定角色功能使用指南

## 📚 目录
1. [功能概述](#功能概述)
2. [快速开始](#快速开始)
3. [三种使用方法](#三种使用方法)
4. [完整示例](#完整示例)
5. [常见问题](#常见问题)
6. [最佳实践](#最佳实践)

---

## 功能概述

Sora2 固定角色（Character）功能允许你在多个视频中保持同一角色的外观一致性。

### 核心特性
- ✅ 从已有视频中提取角色信息
- ✅ 在新视频中使用固定角色
- ✅ 支持最多 6 个角色同时使用
- ✅ 角色可在多个视频中重复使用
- ✅ 支持文生视频和图生视频

### 适用场景
- 🎬 连续剧制作（同一角色出现在多个场景）
- 👥 多人物视频（固定多个角色）
- 🔄 角色测试（同一角色在不同场景下的表现）
- 📺 品牌宣传（固定品牌形象代言人）

---

## 快速开始

### 前置条件
1. 已登录系统（需要 `userId`）
2. 拥有包含目标角色的视频URL（用于提取角色）
3. 确保视频质量清晰，角色特征明显

### 最简单的使用方式（推荐新手）

```javascript
// 方法1：自动创建并使用角色（一步到位）
const response = await fetch('/api/sora2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'text-to-video',
        userId: 'your-user-id',
        prompt: 'A person walking in a garden',
        model: 'sora-2-all',
        
        // 🌟 关键：指定角色来源视频和时间范围
        character_url: 'https://example.com/video-with-character.mp4',
        character_timestamps: '1,3',  // 从第1秒到第3秒提取角色
        
        aspect_ratio: '16:9',
        duration: 15
    })
});

const data = await response.json();
console.log('任务ID:', data.task_id);
```

**说明**：
- `character_url`: 包含你想要固定的角色的视频URL
- `character_timestamps`: 时间范围（格式：`开始秒,结束秒`）
  - 范围最小 1 秒，最大 3 秒
  - 例如：`'1,3'` 表示从第1秒到第3秒

---

## 三种使用方法

### 方法一：自动创建角色（推荐）

**优点**：最简单，一步到位  
**缺点**：每次都会创建新角色，不能复用

**使用场景**：只需要生成一个视频，不需要复用角色

```javascript
const response = await fetch('/api/sora2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'text-to-video',
        userId: 'your-user-id',
        prompt: 'A person dancing',
        model: 'sora-2-all',
        character_url: 'https://example.com/source-video.mp4',
        character_timestamps: '1,3'
    })
});
```

---

### 方法二：手动创建并复用角色（推荐高级用户）

**优点**：角色可以复用，适合批量制作  
**缺点**：需要两步操作

**使用场景**：
- 需要使用同一角色生成多个视频
- 批量生产内容
- 需要保存角色信息供日后使用

#### 第1步：创建角色

```javascript
// 创建角色
const createResponse = await fetch('/api/sora2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'create-character',
        userId: 'your-user-id',
        url: 'https://example.com/source-video.mp4',
        timestamps: '1,3'
    })
});

const { character } = await createResponse.json();
const username = character.username;  // 🌟 重要：保存这个 username

// 保存 username 供后续使用
localStorage.setItem('myCharacter', username);
```

#### 第2步：使用角色生成视频

```javascript
// 使用已创建的角色（可以多次使用）
const username = localStorage.getItem('myCharacter');

const response = await fetch('/api/sora2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'text-to-video',
        userId: 'your-user-id',
        prompt: 'Walking in the park',
        model: 'sora-2-all',
        character_usernames: [username]  // 使用已有角色
    })
});
```

#### 再次使用同一角色（不同场景）

```javascript
// 第二个视频 - 同一角色，不同场景
const response2 = await fetch('/api/sora2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'text-to-video',
        userId: 'your-user-id',
        prompt: 'Riding a bicycle on the beach',  // 不同场景
        model: 'sora-2-all',
        character_usernames: [username]  // 复用同一角色
    })
});
```

---

### 方法三：多角色使用

**适用场景**：需要在一个视频中使用多个角色（最多6个）

#### 第1步：创建多个角色

```javascript
// 创建第一个角色
const char1Response = await fetch('/api/sora2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'create-character',
        userId: 'your-user-id',
        url: 'https://example.com/person1-video.mp4',
        timestamps: '1,3'
    })
});
const char1 = (await char1Response.json()).character;

// 创建第二个角色
const char2Response = await fetch('/api/sora2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'create-character',
        userId: 'your-user-id',
        url: 'https://example.com/person2-video.mp4',
        timestamps: '2,4'
    })
});
const char2 = (await char2Response.json()).character;

// 保存角色信息
const characters = [char1.username, char2.username];
localStorage.setItem('myCharacters', JSON.stringify(characters));
```

#### 第2步：使用多个角色生成视频

```javascript
const characters = JSON.parse(localStorage.getItem('myCharacters'));

const response = await fetch('/api/sora2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'text-to-video',
        userId: 'your-user-id',
        prompt: 'Two friends having a conversation',
        model: 'sora-2-all',
        character_usernames: characters  // 使用多个角色（最多6个）
    })
});
```

---

## 完整示例

### 示例1：制作角色系列视频

```javascript
// 假设你要为同一角色制作3个不同场景的视频

async function createCharacterSeries(userId, sourceVideoUrl) {
    // 1. 创建角色
    const charResponse = await fetch('/api/sora2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'create-character',
            userId: userId,
            url: sourceVideoUrl,
            timestamps: '1,3'
        })
    });
    
    const { character } = await charResponse.json();
    const username = character.username;
    console.log('角色创建成功:', username);
    
    // 2. 使用该角色生成3个不同场景的视频
    const scenes = [
        'Walking in a beautiful garden',
        'Dancing in a modern city',
        'Riding a bicycle on the beach'
    ];
    
    const videoTasks = [];
    
    for (const scene of scenes) {
        const response = await fetch('/api/sora2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'text-to-video',
                userId: userId,
                prompt: scene,
                model: 'sora-2-all',
                character_usernames: [username]
            })
        });
        
        const data = await response.json();
        videoTasks.push(data.task_id);
        console.log(`场景 "${scene}" 任务已提交:`, data.task_id);
    }
    
    return { username, videoTasks };
}

// 使用示例
const result = await createCharacterSeries(
    'your-user-id',
    'https://example.com/source-video.mp4'
);
console.log('完成！角色:', result.username);
console.log('视频任务:', result.videoTasks);
```

### 示例2：图生视频 + 角色固定

```javascript
// 使用参考图片生成视频，同时固定角色

async function imageToVideoWithFixedCharacter(userId, imageUrl, characterUsername) {
    const response = await fetch('/api/sora2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'image-to-video',
            userId: userId,
            image_url: imageUrl,
            prompt: 'Walking forward with a smile',
            model: 'sora-2-all',
            character_usernames: [characterUsername]  // 使用固定角色
        })
    });
    
    const data = await response.json();
    console.log('图生视频任务已提交:', data.task_id);
    return data;
}
```

---

## 常见问题

### Q1: character_timestamps 时间范围有什么限制？

**A**: 
- 最小时长：1秒
- 最大时长：3秒
- 格式：`'开始秒,结束秒'`（例如：`'1,3'`、`'0,2'`、`'5,7'`）
- 必须选择角色特征明显的片段

### Q2: 可以使用多少个角色？

**A**: 
- 单个视频最多支持 **6 个角色**
- 没有总角色数量限制，可以创建任意多个角色
- 建议为每个角色创建独立的 username 并妥善保存

### Q3: 如何保存和管理角色？

**A**: 推荐的几种方式：

```javascript
// 方式1：使用 localStorage（浏览器环境）
localStorage.setItem('character_hero', username);
const hero = localStorage.getItem('character_hero');

// 方式2：保存到数据库（推荐生产环境）
await saveToDatabase({
    name: '主角',
    username: username,
    sourceVideo: 'https://...',
    createdAt: new Date()
});

// 方式3：使用 JSON 文件（本地开发）
const characters = {
    hero: 'user_abc123',
    villain: 'user_def456',
    sidekick: 'user_ghi789'
};
fs.writeFileSync('characters.json', JSON.stringify(characters));
```

### Q4: 图生视频可以创建新角色吗？

**A**: 
- ❌ **不可以**。图生视频只能使用已有的 `username`
- ✅ 需要先从视频创建角色，然后在图生视频中使用
- 原因：创建角色需要视频素材，不能从图片创建

### Q5: 角色 username 会过期吗？

**A**: 
- 角色 username 通常不会过期
- 建议定期验证角色是否仍然可用
- 如果 API 返回角色不存在，需要重新创建

### Q6: 如何选择最佳的时间范围？

**A**: 选择角色特征最明显的片段：
- ✅ 正面清晰的镜头
- ✅ 光线充足的场景
- ✅ 角色独自出现（背景简单）
- ❌ 避免模糊、背光、遮挡的片段
- ❌ 避免多人同时出现的片段

---

## 最佳实践

### 1. 角色管理

```javascript
// 创建一个角色管理类
class CharacterManager {
    constructor() {
        this.characters = this.loadCharacters();
    }
    
    // 加载已保存的角色
    loadCharacters() {
        const saved = localStorage.getItem('characters');
        return saved ? JSON.parse(saved) : {};
    }
    
    // 保存角色
    saveCharacter(name, username, metadata = {}) {
        this.characters[name] = {
            username,
            createdAt: new Date().toISOString(),
            ...metadata
        };
        localStorage.setItem('characters', JSON.stringify(this.characters));
    }
    
    // 获取角色
    getCharacter(name) {
        return this.characters[name]?.username;
    }
    
    // 列出所有角色
    listCharacters() {
        return Object.entries(this.characters).map(([name, data]) => ({
            name,
            ...data
        }));
    }
    
    // 删除角色
    removeCharacter(name) {
        delete this.characters[name];
        localStorage.setItem('characters', JSON.stringify(this.characters));
    }
}

// 使用示例
const manager = new CharacterManager();

// 创建角色后保存
const response = await createCharacterFromVideo(userId, videoUrl);
manager.saveCharacter('hero', response.character.username, {
    sourceVideo: videoUrl,
    description: '主角'
});

// 使用角色
const heroUsername = manager.getCharacter('hero');
await generateVideoWithExistingCharacter(userId, heroUsername);

// 查看所有角色
console.log(manager.listCharacters());
```

### 2. 批量视频生成

```javascript
// 批量生成同一角色的多个场景视频
async function batchGenerateVideos(userId, characterUsername, scenes) {
    const results = [];
    
    for (const scene of scenes) {
        try {
            const response = await fetch('/api/sora2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'text-to-video',
                    userId: userId,
                    prompt: scene.prompt,
                    model: 'sora-2-all',
                    character_usernames: [characterUsername],
                    aspect_ratio: scene.aspectRatio || '16:9'
                })
            });
            
            const data = await response.json();
            results.push({
                scene: scene.name,
                taskId: data.task_id,
                status: 'submitted'
            });
            
            console.log(`✅ ${scene.name} 已提交:`, data.task_id);
            
            // 避免请求过快，添加延迟
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.error(`❌ ${scene.name} 失败:`, error.message);
            results.push({
                scene: scene.name,
                error: error.message,
                status: 'failed'
            });
        }
    }
    
    return results;
}

// 使用示例
const scenes = [
    { name: '场景1', prompt: 'Walking in a garden' },
    { name: '场景2', prompt: 'Dancing in the rain' },
    { name: '场景3', prompt: 'Reading a book in a cafe' }
];

const results = await batchGenerateVideos(userId, characterUsername, scenes);
console.log('批量生成完成:', results);
```

### 3. 错误处理和重试

```javascript
// 带重试机制的角色创建
async function createCharacterWithRetry(userId, videoUrl, timestamps, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`尝试创建角色 (${attempt}/${maxRetries})...`);
            
            const response = await fetch('/api/sora2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create-character',
                    userId: userId,
                    url: videoUrl,
                    timestamps: timestamps
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || '创建失败');
            }
            
            console.log('✅ 角色创建成功:', data.character.username);
            return data.character;
            
        } catch (error) {
            console.error(`❌ 第 ${attempt} 次尝试失败:`, error.message);
            
            if (attempt === maxRetries) {
                throw new Error(`创建角色失败，已重试 ${maxRetries} 次: ${error.message}`);
            }
            
            // 等待后重试
            await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
        }
    }
}
```

---

## 集成到当前项目

### 在 batch.js 中使用

你可以在项目的 `js/batch.js` 中直接使用角色功能：

```javascript
// 在 batch.js 中添加角色管理功能

// 创建角色并保存
window.createAndSaveCharacter = async function(videoUrl, characterName) {
    try {
        const userId = await getCurrentUserId();
        const response = await fetch('/api/sora2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'create-character',
                userId: userId,
                url: videoUrl,
                timestamps: '1,3'
            })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        // 保存到本地
        const characters = JSON.parse(localStorage.getItem('sora2_characters') || '{}');
        characters[characterName] = {
            username: data.character.username,
            sourceVideo: videoUrl,
            createdAt: new Date().toISOString()
        };
        localStorage.setItem('sora2_characters', JSON.stringify(characters));
        
        alert(`角色 "${characterName}" 创建成功！`);
        return data.character;
    } catch (error) {
        alert('角色创建失败: ' + error.message);
        throw error;
    }
};

// 使用已保存的角色生成视频
window.generateWithCharacter = async function(prompt, characterName) {
    try {
        const userId = await getCurrentUserId();
        const characters = JSON.parse(localStorage.getItem('sora2_characters') || '{}');
        const character = characters[characterName];
        
        if (!character) {
            throw new Error(`找不到角色 "${characterName}"，请先创建`);
        }
        
        const response = await fetch('/api/sora2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'text-to-video',
                userId: userId,
                prompt: prompt,
                model: 'sora-2-all',
                character_usernames: [character.username],
                aspect_ratio: '16:9',
                duration: 15
            })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        return data;
    } catch (error) {
        alert('视频生成失败: ' + error.message);
        throw error;
    }
};

// 查看已保存的角色列表
window.listCharacters = function() {
    const characters = JSON.parse(localStorage.getItem('sora2_characters') || '{}');
    console.table(characters);
    return characters;
};
```

---

## 参考资料

- API 文档: `/api/sora2.js`
- 完整示例代码: `/examples/sora2-fixed-character-example.js`
- 故事板API参考: `https://yunwu.apifox.cn/api-385627774.md`

---

**更新日期**: 2026-01-11  
**版本**: 1.0.0
