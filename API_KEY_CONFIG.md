# API Key 配置说明

## 多 API Key 支持

系统现在支持配置**多个云梦 API Key**，实现负载均衡和自动切换。当某个 key 被限速(429)或失败时，会自动尝试下一个 key。

### 当前配置的云梦 API Key

**主 Key (YUNMENG_API_KEY)**：现有的云梦 API key

**备用 Key (YUNMENG_API_KEY_2)**：
```
sk-REDACTED
```
这是限时特价的 key，用于测试 Sora2 云梦 API 是否有线路问题。

## Vercel 环境变量配置步骤

### 方式1：通过 Vercel Dashboard（推荐）

1. 访问：https://vercel.com/adonisjinggws-projects/ai-video-batch/settings/environment-variables

2. **保留原有 key**（不删除 `YUNMENG_API_KEY`）

3. **添加新的备用 key**：
   - 点击 "Add New"
   - Name: `YUNMENG_API_KEY_2`
   - Value: `sk-REDACTED`
   - 选择环境：Production, Preview, Development
   - 点击 Save

4. 如需更多 key，可添加 `YUNMENG_API_KEY_3`、`YUNMENG_API_KEY_4` 等

5. 重新部署项目

### 方式2：通过 Vercel CLI

```bash
cd ai-video-batch

# 添加备用 key
vercel env add YUNMENG_API_KEY_2 production
# 粘贴值：sk-REDACTED

# 可选：添加更多备用 key
vercel env add YUNMENG_API_KEY_3 production

# 重新部署
vercel --prod
```

## API 端点支持

当前以下端点使用 YUNMENG_API_KEY：

1. `/api/sora2` - Sora2 视频生成
2. `/api/video-remix` - 视频编辑
3. `/api/yunwu` - 云雾 API 代理
4. `/api/zhenzhen` - 文本生成（优先云梦）
5. `/api/banana2` - 图片生成（优先云梦）

## 云梦节点列表

代码中配置了以下云梦节点（按优先级）：

```javascript
const YUNMENG_ENDPOINTS = [
    'https://api3.wlai.vip',
    'https://yunwu.zeabur.app',
    'https://yunwu.ai',
    'https://api.apiplus.org'
];
```

如果某个节点失败，会自动尝试下一个节点。

## 测试方法

配置完成后，在节点编辑器中：

1. 创建 "视频参考/克隆" 节点
2. 填入参考视频信息（PID 或 URL）
3. 点击"生成克隆视频"
4. 观察控制台日志，查看使用了哪个云梦节点
5. 如果成功，说明新 key 可用

## 角色创建 API 规范

根据 OpenAPI 规范，创建角色的接口：

- **端点**：`POST /sora/v1/characters`
- **请求参数**：
  - `url`: 视频URL（与 `from_task` 二选一）
  - `from_task`: 任务ID（与 `url` 二选一）
  - `timestamps`: 时间戳范围，如 "1,3" 表示1-3秒
- **响应**：
  - `id`: 角色ID（ch_xxx）
  - `username`: 角色名称，用于 @username
  - `permalink`: 角色主页链接
  - `profile_picture_url`: 角色头像

## 多 Key 工作机制

### 🔑 Key 轮换策略

1. **负载均衡**：对于每个云梦节点，系统会依次尝试所有配置的 key
2. **自动切换**：
   - 如果 Key1 返回 429（限速），立即尝试 Key2
   - 如果 Key1 返回 4xx（客户端错误），尝试 Key2
   - 如果 Key1 返回 5xx（服务器错误），尝试 Key2
3. **节点 × Key 组合**：
   - 4个节点 × 2个key = 8次尝试机会
   - 4个节点 × 3个key = 12次尝试机会

### 📊 日志示例

```
[sora2] 🔑 已配置 2 个云梦 API Key
[sora2] ☁️ 尝试云梦API: https://api3.wlai.vip/v1/video/create [Key1/2] ...
[sora2] ☁️ https://api3.wlai.vip [Key1/2] 限速，尝试下一个key...
[sora2] ☁️ 尝试云梦API: https://api3.wlai.vip/v1/video/create [Key2/2] ...
[sora2] ☁️ ✅ 云梦API成功: https://api3.wlai.vip [Key2/2]
```

### 💡 使用建议

1. **限时特价 key 优先**：将限时特价的 key 配置为 `YUNMENG_API_KEY_2`，保持原 key 不变
2. **监控使用情况**：通过 `vercel logs --prod` 查看哪个 key 被使用最多
3. **平衡负载**：如果某个 key 经常被限速，考虑添加更多 key

## 新功能

### 🆕 OpenAI 官方格式支持

现已支持 OpenAI 官方的 Sora 视频生成 API 格式，包括：

1. **创建视频（带 Character）**
   - `character_url`: 包含角色的视频 URL
   - `character_timestamps`: 时间范围（例如 "1,3"，表示 1-3 秒）
   - 系统会自动创建角色并应用到视频生成中

2. **创建视频（带图片引导）**
   - `input_reference`: 输入参考图片（URL 或 base64）
   - `style`: 风格参数，支持：thanksgiving, comic, news, selfie, nostalgic, anime
   - `seconds`: 视频时长（秒）
   - `size`: 视频尺寸（例如 16x9）
   - `watermark`: 是否添加水印
   - `private`: 是否私密

3. **视频编辑（Remix）**
   - 通过 `/api/video-remix` 端点修改现有视频
   - 输入：video_id + prompt
   - 自动轮询生成状态

4. **创建角色（Character）**
   - 通过 `/api/sora2?action=create-character` 端点从视频中提取角色
   - 输入：video URL 或 task_id + timestamps
   - 返回：角色 id, username, permalink, profile_picture_url

### 🎬 视频连续性生成 ✨ **NEW**

**端点**：`/api/video-continuity`

自动串联多个分镜，使用前一个视频的最后一帧作为下一个视频的起始帧，确保视频连续性。

**核心特性**：
- ✅ 自动串联：第N+1个分镜使用第N个分镜的最后一帧
- ✅ 模型支持：Sora2 和 Veo3 均可使用
- ✅ 异步模式：支持后台处理 + 进度查询
- ✅ 角色一致性：第一个分镜可指定角色

**重要限制**：
- ⚠️ 必须串行执行（无法并发）
- ⚠️ 总耗时 = 单个视频生成时间 × 分镜数量

**快速示例**：
```javascript
POST /api/video-continuity
{
  "segments": ["猫在睡觉", "猫醒来伸懒腰", "猫走向窗户"],
  "model": "sora-2",
  "async": true  // 异步模式
}
```

**详细文档**：查看 `VIDEO_CONTINUITY_README.md`

## 注意事项

1. **贞贞 API 已禁用**：为节省费用，所有接口不再 fallback 到贞贞
2. **自动重试**：如果云梦某个节点失败，会自动尝试其他节点和 key
3. **限速处理**：遇到 429 错误会自动切换到下一个 key，而不是下一个节点
4. **日志监控**：可以通过 `vercel logs` 查看 API 调用日志，包括每个 key 的使用情况

## 故障排查

如果视频生成失败，检查：

1. Vercel Dashboard 的 Logs 页面
2. 浏览器控制台的网络请求
3. 确认 API key 是否正确配置
4. 测试不同的云梦节点是否可用

