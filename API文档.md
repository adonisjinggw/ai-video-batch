# RollRoll AI API 文档

## 基础信息

- **API端点**: `https://lossloop.cn/api/proxy`
- **请求方法**: GET/POST
- **Content-Type**: application/json
- **apiType参数**: public-api (必需)

## 认证方式

```
Authorization: Bearer rk_your_api_key_here
```

## 公共API接口

### 1. health - 健康检查
```json
{
  "apiType": "public-api",
  "action": "health"
}
```

### 2. skills - 获取技能列表
```json
{
  "apiType": "public-api",
  "action": "skills"
}
```

### 3. info - 项目信息
```json
{
  "apiType": "public-api",
  "action": "info"
}
```

### 4. generate - 图像生成
```json
{
  "apiType": "public-api",
  "action": "generate",
  "prompt": "一只可爱的猫咪",
  "aspectRatio": "1:1"
}
```

### 5. proxy - 代理内部API
```json
{
  "apiType": "public-api",
  "action": "proxy",
  "targetApi": "banana2",
  "prompt": "一只可爱的猫咪",
  "aspectRatio": "1:1"
}
```
**targetApi可选**: yunwu, banana2, modelscope, sora2, suno, writer-llm, video-continuity, mv-merge

### 6. 视频生成接口

#### text-to-video - 文生视频
```json
{
  "apiType": "public-api",
  "action": "text-to-video",
  "prompt": "一只猫咪在花园里奔跑",
  "model": "grok-video-3",
  "aspect_ratio": "16:9",
  "seconds": 6,
  "size": "720p"
}
```
**参数说明**:
- prompt: 视频描述（必填）
- model: 视频模型（可选，默认grok-video-3）
  - 推荐: grok-video-3 (6秒, 5胶片), grok-video-3-10s (10秒, 8胶片)
  - 其他: kling-2.5-720p-5s, hailo-fast-768p-6s, veo3, veo3.1等
- aspect_ratio: 宽高比（可选，16:9 / 9:16 / 1:1）
- seconds: 视频时长（可选，秒）
- size: 视频尺寸（可选，720p / 1080p）
**消耗**: 5-77胶片

#### image-to-video - 图生视频
```json
{
  "apiType": "public-api",
  "action": "image-to-video",
  "image_url": "https://example.com/image.jpg",
  "prompt": "这个角色在跳舞",
  "model": "grok-video-3",
  "image_weight": 0.98,
  "motion_intensity": "medium",
  "preserve_subject": true
}
```
**参数说明**:
- image_url: 图片URL或base64编码（必填）
  - 支持格式: https://... 或 data:image/jpeg;base64,...
- prompt: 视频动作描述（控制视频内容）
- model: 视频模型（可选，默认grok-video-3）
  - 推荐: grok-video-3 (6秒, 5胶片), grok-video-3-10s (10秒, 8胶片)
  - 其他: kling-2.5-720p-5s, hailo-fast-768p-6s, wan26-720p-5s等
- image_weight: 图片权重（0-1，可选，默认0.98）
  - 值越高，越保持参考图外观
- motion_intensity: 运动强度（可选，low/medium/high）
- preserve_subject: 保持主体不变（可选，默认true）
- aspect_ratio: 宽高比（可选）
- seconds: 视频时长（可选，秒）
**消耗**: 5-77胶片

#### poll - 轮询视频任务状态
```json
{
  "apiType": "public-api",
  "action": "poll",
  "targetApi": "sora2",
  "task_id": "task_123456"
}
```
**返回示例**:
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "video_url": "https://example.com/video.mp4",
    "progress": 100
  }
}
```

### 7. 配音功能接口

#### tts-voices - 获取音色列表 (DubbingX)
```json
{
  "apiType": "public-api",
  "action": "tts-voices",
  "grade": "premium",
  "gender": 1,
  "pageIndex": 1,
  "pageSize": 100,
  "keyword": "温柔"
}
```
**参数说明**:
- grade: 音色等级, 默认 'premium'
- gender: 性别, 1=男, 2=女
- keyword: 搜索关键词

#### tts-generate - 创建TTS任务 (DubbingX)
```json
{
  "apiType": "public-api",
  "action": "tts-generate",
  "voiceId": "voice_123",
  "text": "你好，这是一段测试语音",
  "language": "zh",
  "audioSpeed": 1,
  "audioPitch": 1,
  "audioVolume": 1,
  "emotion": "常规-日常说话-1"
}
```
**消耗**: 2胶片

#### tts-poll - 轮询TTS任务状态
```json
{
  "apiType": "public-api",
  "action": "tts-poll",
  "taskId": "task_123456"
}
```

#### gemini-tts - Gemini TTS生成 (实时返回)
```json
{
  "apiType": "public-api",
  "action": "gemini-tts",
  "text": "Hello, this is a test",
  "voiceName": "Kore",
  "model": "flash"
}
```
**参数说明**:
- model: 'flash' (1胶片) 或 'pro' (3胶片)
**消耗**: 1-3胶片

#### kling-tts - 可灵Kling TTS生成
```json
{
  "apiType": "public-api",
  "action": "kling-tts",
  "text": "你好，这是可灵语音合成",
  "voiceId": "zh_female_xiaoxiao",
  "voiceLanguage": "zh",
  "voiceSpeed": 1
}
```
**消耗**: 2胶片

#### kling-tts-poll - 轮询Kling TTS任务
```json
{
  "apiType": "public-api",
  "action": "kling-tts-poll",
  "taskId": "kling_task_123"
}
```

#### vc-list - 获取VC变声音色列表
```json
{
  "apiType": "public-api",
  "action": "vc-list",
  "pageIndex": 1,
  "pageSize": 50,
  "keyword": "明星"
}
```

#### vc-create - 创建VC变声任务
```json
{
  "apiType": "public-api",
  "action": "vc-create",
  "audioData": "data:audio/wav;base64,...",
  "timbreId": "timbre_123",
  "pitch": 0
}
```
**消耗**: 2胶片

#### vc-poll - 轮询VC变声任务
```json
{
  "apiType": "public-api",
  "action": "vc-poll",
  "taskId": "vc_task_123"
}
```

#### speech-to-text - Whisper语音识别
```json
{
  "apiType": "public-api",
  "action": "speech-to-text",
  "audio": "base64_audio_data",
  "format": "webm"
}
```
**消耗**: 1胶片

#### kling-custom-voice - 创建可灵自定义音色
```json
{
  "apiType": "public-api",
  "action": "kling-custom-voice",
  "voiceName": "我的声音",
  "voiceUrl": "https://example.com/voice.mp3"
}
```
**消耗**: 5胶片

#### kling-custom-voice-query - 查询自定义音色状态
```json
{
  "apiType": "public-api",
  "action": "kling-custom-voice-query",
  "voiceId": "custom_voice_123"
}
```

## 📱 手机版完整功能

### 🔧 独立工具页面
提示词(knolling.html), 画图(banana.html), 音乐(music.html), 视频(video-tools.html), 对话(chat.html), 写作(writing.html), 表情包(sticker.html), 分镜(video-continuity.html), 涂鸦(sketchpad.html), 填空(prompt-fill.html), 素材库(library.html), 角色库(内部), 音乐MV(内部), 配音(voice.html), Sora2角色(内部)

### 🎬 视频生成模型
- **Sora系列**: 文生视频, 图生视频, 网格图省费版
- **Veo 3.1系列**: Veo 3.1 4K, Veo 3.1 Fast 4K, Veo 3.1 Fast Components
- **Vidu系列**: 5秒/10秒, q2/q2-pro/q2-turbo/q3-pro, 720P/1080P
- **海螺Hailuo系列**: 6秒/10秒, 02/Fast, 768P/1080P
- **可灵Kling系列**: 5秒/10秒, 2.5/2.0/O1, 720P/1080P
- **Grok Video 3系列**: 6秒/10秒, 文生视频/图生视频

### 🎨 图像生成模型
- **智能绘图**: 免费
- **Banana系列**: 标准版(0.7胶片), 2K超清(0.7胶片), 4K顶级(1.2胶片)
- **星梦画师**: 文/图生图(7胶片)
- **通义万相Max**: (8胶片)
- **Midjourney系列**: Fast/Turbo/Relax(各2胶片)

### 🧩 填空模板系统 (100+个)
涵盖类别: 梦幻光效、动漫风格、樱花场景、史诗战斗、月光夜景、多重身份、房间设计、Q版可爱、彩虹渐变、复古胶片、像素游戏、水下世界、赛博朋克、森林精灵、油画艺术、超级英雄、马戏团、中世纪、中国风、表情包、印象派、京剧脸谱、女超人、月亮公主、太阳神、小丑女、星际战士、蝙蝠侠、蜘蛛侠、猫耳娘、狐狸精、狼人、吸血鬼、幽灵、机器人、Lolita、摇滚、图书馆、咖啡馆、独角兽、女武士、精灵弓箭手、魔法少女、绅士、皇室贵族、毕业纪念、职场精英、甜品师、向日葵、麦田、沙漠探险、雪山登顶、火山、时空漩涡、烟花、城市夜景、蒸汽朋克、小丑、旋转木马、摩天轮、过山车、杂技、射箭、足球、篮球、网球、游泳、自行车、瑜伽、SPA、美甲、化妆、时装走秀、摄影师、导演、歌手、钢琴、小提琴、架子鼓、DJ、拉面师傅、寿司大师、蛋糕装饰、披萨制作、圣诞视频、春节视频、圣诞贺卡、圣诞红包、春节贺卡、春节红包、Knolling、人物关系图、Y2K海报、极简黑白、人物名片、钥匙扣、Cosplay、角色设定、手办场景、LINE表情包、吉卜力、Pixar、赛博朋克、水彩、油画、像素、照片转动漫、照片增强、复古胶片、专业人像、街头摄影、胶片质感、微距特写、圣诞节、春节、情人节、万圣节、印象派、超现实主义、波普艺术、水墨画、游戏UI、游戏卡牌、App图标、文字形状、象形图、信息图表、房间改造、微缩世界、年龄变换、内心小孩、时尚模特、毛绒玩具、珐琅徽章、纹身设计

### 📖 漫画风格
日式漫画、日式彩漫、美式漫画、韩式条漫、沙雕漫画、儿童绘本

### 🎥 运镜选项
35mm广角建立, 50mm中景叙事, 85mm人像特写浅景深, 手持纪实轻微晃动, 斯坦尼康平滑推进, 推镜头强调情绪, 拉镜头揭示环境, 环绕镜头360度旋转

### 📤 发布平台
小红书、抖音、微博、公众号、B站、快手

### 👆 交互功能
下拉刷新、左滑删除/分享、长按菜单、双指缩放图片预览、手势操作

## 项目全部API（直接调用）

### 📹 视频生成
- **yunwu** - 云雾AI（图片/视频/文本/角色/分析）
- **sora2** - Sora2视频生成
- **video-continuity** - 视频连续性生成
- **mv-merge** - 多视频合并

### 🎨 图像生成
- **banana2** - 香蕉AI图像生成
- **modelscope** - ModelScope图像生成

### 🎵 音频生成
- **suno** - Suno音乐生成

### ✍️ 文本创作
- **writer-llm** - 写作LLM

## 错误响应

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "错误描述"
}
```

**常见错误码**: MISSING_PARAMS, INVALID_ACTION, MISSING_API_KEY, INVALID_API_KEY, QUOTA_EXCEEDED

---

## 调用示例

### JavaScript (Fetch)
```javascript
const API_KEY = '你的API Key';
const API_ENDPOINT = 'https://lossloop.cn/api/proxy';

async function callApi(action, data = {}) {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      apiType: 'public-api',
      action,
      ...data
    })
  });
  return response.json();
}

// 调用示例
callApi('health').then(console.log);
callApi('skills').then(console.log);
```

### Python (requests)
```python
import requests

API_KEY = '你的API Key'
API_ENDPOINT = 'https://lossloop.cn/api/proxy'

def call_api(action, data=None):
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {API_KEY}'
    }
    payload = {
        'apiType': 'public-api',
        'action': action,
        **(data or {})
    }
    response = requests.post(API_ENDPOINT, json=payload, headers=headers)
    return response.json()

# 调用示例
print(call_api('health'))
print(call_api('skills'))
```

### cURL
```bash
curl -X POST https://lossloop.cn/api/proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 你的API Key" \
  -d '{
    "apiType": "public-api",
    "action": "skills"
  }'
```
