# 视频连续性生成功能

## 📖 功能说明

自动串联多个分镜，使用前一个视频的最后一帧作为下一个视频的起始帧，确保视频之间的连续性和一致性。

### ✨ 核心特性

- ✅ **AI自动分镜**：输入故事，AI自动拆分成3-10个连续分镜 ✨ **NEW**
- ✅ **可手动编辑**：支持修改AI生成的分镜描述 ✨ **NEW**
- ✅ **自动串联**：第N+1个分镜自动使用第N个分镜的最后一帧作为起始帧
- ✅ **模型支持**：Sora2 和 Veo3 均可使用
- ✅ **角色一致性**：第一个分镜可指定角色，确保人物一致
- ✅ **异步模式**：支持后台处理，避免长时间阻塞
- ✅ **实时进度**：可随时查询当前处理到第几个分镜

### ⚠️ 重要限制

1. **必须串行执行**：无法并发生成，因为存在依赖链
2. **总耗时较长**：总时间 = 单个视频生成时间 × 分镜数量
3. **内存存储**：当前使用内存存储任务状态（重启后丢失），生产环境建议用Redis

## 📡 API 接口

### 端点

```
POST /api/video-continuity
GET  /api/video-continuity?taskId=xxx
```

### 1. 创建生成任务（同步模式）

**请求：**
```javascript
POST /api/video-continuity

{
  "segments": [
    "一只猫在阳光下伸懒腰",
    "猫站起来走向窗户",
    "猫跳上窗台看向外面"
  ],
  "model": "sora-2",           // 可选：sora-2（默认）或 veo-3
  "duration": 5,               // 可选：每个分镜的默认时长（秒）
  "aspect_ratio": "16:9",      // 可选：默认比例
  "character_url": "https://...", // 可选：角色视频URL（仅用于第一个分镜）
  "character_timestamps": "1,3",  // 可选：角色时间戳
  "async": false               // false=同步模式，等待全部完成
}
```

**响应（等待全部完成后返回）：**
```javascript
{
  "taskId": "continuity_1234567890_abc123",
  "success": true,
  "total": 3,
  "completed": 3,
  "results": [
    {
      "index": 0,
      "prompt": "一只猫在阳光下伸懒腰",
      "taskId": "video_xxx1",
      "url": "https://...",
      "status": "completed"
    },
    {
      "index": 1,
      "prompt": "猫站起来走向窗户",
      "taskId": "video_xxx2",
      "url": "https://...",
      "status": "completed"
    },
    {
      "index": 2,
      "prompt": "猫跳上窗台看向外面",
      "taskId": "video_xxx3",
      "url": "https://...",
      "status": "completed"
    }
  ]
}
```

### 2. 创建生成任务（异步模式）

**请求：**
```javascript
POST /api/video-continuity

{
  "segments": ["分镜1", "分镜2", "分镜3"],
  "async": true  // true=异步模式，立即返回taskId
}
```

**响应（立即返回）：**
```javascript
{
  "taskId": "continuity_1234567890_abc123",
  "message": "任务已创建，请通过taskId查询进度",
  "pollUrl": "/api/video-continuity?taskId=continuity_1234567890_abc123"
}
```

### 3. 查询任务进度

**方式一：GET 请求**
```
GET /api/video-continuity?taskId=continuity_1234567890_abc123
```

**方式二：POST 请求**
```javascript
POST /api/video-continuity

{
  "action": "status",
  "taskId": "continuity_1234567890_abc123"
}
```

**响应：**
```javascript
{
  "taskId": "continuity_1234567890_abc123",
  "status": "processing",  // pending, processing, completed, failed
  "totalSegments": 3,
  "currentSegment": 1,     // 当前正在处理第几个分镜（从0开始）
  "currentPrompt": "猫站起来走向窗户",
  "currentStatus": "waiting",  // waiting 或 completed
  "results": [
    {
      "index": 0,
      "prompt": "一只猫在阳光下伸懒腰",
      "url": "https://...",
      "status": "completed"
    },
    {
      "index": 1,
      "prompt": "猫站起来走向窗户",
      "status": "processing"
    }
  ],
  "createdAt": 1234567890,
  "updatedAt": 1234567895
}
```

## 💡 使用示例

### 示例0：使用前端页面（推荐）✨ **NEW**

1. **访问页面**：https://www.rollroll.art/video-continuity.html

2. **输入故事**：
```
一只橘猫慵懒地躺在窗台上，阳光洒在它柔软的毛发上。突然，一只蝴蝶飞过窗外，猫咪的耳朵立刻竖了起来。它慢慢站起身，眼睛紧盯着那只蝴蝶。下一刻，猫咪纵身一跃，试图抓住蝴蝶，却扑了个空，重重摔在地板上。它尴尬地舔了舔爪子，假装什么都没发生。
```

3. **点击"AI自动分镜"**：系统自动拆分成多个分镜

4. **手动修改**（可选）：编辑任何分镜的描述

5. **点击"开始生成"**：后台处理，实时查看进度

6. **查看结果**：在线预览和下载视频

### 示例1：简单的三个分镜（API调用）

```javascript
// 同步模式（等待完成）
const response = await fetch('/api/video-continuity', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    segments: [
      "一个女孩在海边奔跑",
      "女孩停下来捡起一个贝壳",
      "女孩微笑着将贝壳放入口袋"
    ],
    model: 'sora-2',
    duration: 5
  })
});

const result = await response.json();
console.log('全部完成！', result.results);
```

### 示例2：异步模式 + 轮询进度

```javascript
// 1. 创建任务
const createResponse = await fetch('/api/video-continuity', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    segments: [
      "第一个场景...",
      "第二个场景...",
      "第三个场景..."
    ],
    async: true  // 异步模式
  })
});

const { taskId, pollUrl } = await createResponse.json();
console.log('任务已创建:', taskId);

// 2. 轮询进度
const checkProgress = async () => {
  const statusResponse = await fetch(pollUrl);
  const status = await statusResponse.json();
  
  console.log(`进度: ${status.currentSegment + 1}/${status.totalSegments}`);
  console.log(`当前状态: ${status.status}`);
  
  if (status.status === 'completed') {
    console.log('全部完成！', status.results);
    return status;
  }
  
  if (status.status === 'failed') {
    console.error('任务失败:', status.error);
    return status;
  }
  
  // 继续轮询
  setTimeout(checkProgress, 5000); // 每5秒查询一次
};

checkProgress();
```

### 示例3：带角色的连续生成

```javascript
const response = await fetch('/api/video-continuity', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    segments: [
      "一个男孩在公园里玩球",
      "男孩将球扔向天空",
      "男孩接住球并笑了"
    ],
    model: 'sora-2',
    character_url: 'https://example.com/reference_video.mp4', // 参考视频
    character_timestamps: '1,3',  // 提取1-3秒的角色
    async: true
  })
});
```

### 示例4：自定义每个分镜的参数

```javascript
const response = await fetch('/api/video-continuity', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    segments: [
      {
        prompt: "第一个场景",
        duration: 5,
        aspect_ratio: "16:9"
      },
      {
        prompt: "第二个场景（长一点）",
        duration: 10,
        aspect_ratio: "16:9"
      },
      {
        prompt: "第三个场景（竖屏）",
        duration: 5,
        aspect_ratio: "9:16"
      }
    ],
    model: 'sora-2'
  })
});
```

## 🎯 典型应用场景

1. **微短剧生成**：自动生成多个连续的剧情片段
2. **故事视频**：将故事分成多个分镜，确保画面连贯
3. **产品演示**：展示产品从不同角度的连续使用过程
4. **教学视频**：步骤化教学，每个步骤视觉连续
5. **动画短片**：制作简单的动画故事

## 📊 性能估算

| 分镜数 | 单镜生成时间 | 预估总耗时 | 轮询频率 |
|--------|-------------|-----------|---------|
| 3 个   | ~90秒       | ~4.5分钟  | 每10秒  |
| 5 个   | ~90秒       | ~7.5分钟  | 每10秒  |
| 10 个  | ~90秒       | ~15分钟   | 每10秒  |

**性能优化说明：**
- ✅ **渐进式轮询**：API内部前30秒每5秒查询，之后每10秒查询
- ✅ **前端轮询**：每10秒查询一次进度（考虑到单分镜至少60秒）
- ✅ **减少消耗**：避免频繁轮询导致的服务器压力
- ✅ **最大等待**：单个分镜最长等待20分钟（120次×10秒）

**建议：**
- 使用异步模式处理 ≥3 个分镜的任务
- 单次生成不超过 10 个分镜
- 考虑将长视频拆分为多个批次
- 生成过程中可以关闭页面，稍后通过taskId查询进度

## 🔧 技术原理

```
分镜1: 文生视频
  └─> [提取最后一帧] 
      └─> 分镜2: 图生视频（使用分镜1的最后一帧）
          └─> [提取最后一帧]
              └─> 分镜3: 图生视频（使用分镜2的最后一帧）
                  └─> ...
```

云梦 API 的 `input_reference` 参数支持直接传入视频 URL，API 会自动提取最后一帧作为参考图。

## 🚀 未来优化

- [ ] 支持 Redis 存储任务状态（支持分布式和持久化）
- [ ] 支持断点续传（失败后从中断处继续）
- [ ] 支持 WebSocket 实时推送进度
- [ ] 支持视频预览和人工审核
- [ ] 支持批量导出和合并

