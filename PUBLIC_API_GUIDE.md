# 对外API使用指南

## 概述

项目新增了对外公开API接口，通过 `/api/proxy` 访问。

## 申请API Key

### 1. 进入用户中心

登录后，访问 **用户中心** (`/user.html`)，找到 **"🔑 API管理"** 板块。

### 2. 创建API Key

1. 在"Key名称"输入框中输入一个名称（如：我的应用）
2. 选择每日配额限制（100/500/1000/5000次/天）
3. 点击 **"🔐 创建Key"** 按钮
4. 系统会生成并显示完整的API Key，请**妥善保管**（这是唯一一次显示完整Key）

### 3. 管理API Key

在API管理板块可以：
- 查看所有API Key及其使用状态
- 查看今日配额使用情况
- 撤销不再使用的API Key

---

## 基础信息

- **API端点**: `https://your-domain.vercel.app/api/proxy`
- **请求方法**: GET/POST
- **Content-Type**: `application/json`
- **apiType参数**: `public-api` (必需)
- **认证方式**: 在请求头中添加 `Authorization: Bearer <your-api-key>`

---

## 认证说明

除了 `health` 接口外，所有API接口都需要通过API Key进行认证。

### 认证方式

**方式1：通过Authorization Header（推荐）**
```http
POST /api/proxy
Content-Type: application/json
Authorization: Bearer rk_abc123def456...

{
  "apiType": "public-api",
  "action": "skills"
}
```

**方式2：通过请求体**
```http
POST /api/proxy
Content-Type: application/json

{
  "apiType": "public-api",
  "action": "skills",
  "apiKey": "rk_abc123def456..."
}
```

### 配额说明

- 每个API Key都有每日调用配额限制
- 配额每日自动重置
- 响应中会返回剩余配额：`quotaRemaining`

---

## 接口列表

所有接口都需要通过 `apiType=public-api` 参数来访问。

### 1. 健康检查 (health)

检查API服务是否正常运行。此接口**不需要**API Key。

**请求**:
```
GET /api/proxy?apiType=public-api&action=health
```
或
```
POST /api/proxy
Content-Type: application/json

{
  "apiType": "public-api",
  "action": "health"
}
```

**响应**:
```json
{
  "success": true,
  "message": "AI Video Batch API is running",
  "version": "8.6.6",
  "timestamp": 1234567890,
  "quotaRemaining": 999
}
```

---

### 2. 获取技能列表 (skills)

获取可用的创作技能列表。

**请求**:
```
POST /api/proxy
Content-Type: application/json
Authorization: Bearer <your-api-key>

{
  "apiType": "public-api",
  "action": "skills"
}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "ecommerce_complete",
      "name": "电商全套图",
      "category": "design"
    },
    {
      "id": "marketing_brochure",
      "name": "营销宣传册",
      "category": "design"
    }
  ],
  "quotaRemaining": 499
}
```

---

### 3. 项目信息 (info)

获取项目的版本和功能信息。

**请求**:
```
POST /api/proxy
Content-Type: application/json
Authorization: Bearer <your-api-key>

{
  "apiType": "public-api",
  "action": "info"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "name": "ai-video-batch",
    "version": "8.6.6",
    "features": [
      "批量视频生成",
      "图像生成",
      "电商设计",
      "漫画创作",
      "角色管理"
    ],
    "availableModels": [
      "wan2.6",
      "sora2",
      "kling",
      "modelscope"
    ]
  },
  "quotaRemaining": 498
}
```

---

### 4. 图像生成 (generate)

提交图像生成任务。

**请求**:
```
POST /api/proxy
Content-Type: application/json
Authorization: Bearer <your-api-key>

{
  "apiType": "public-api",
  "action": "generate",
  "prompt": "一只可爱的猫咪",
  "aspectRatio": "1:1"
}
```

**响应**:
```json
{
  "success": true,
  "message": "生成请求已接受",
  "data": {
    "prompt": "一只可爱的猫咪",
    "aspectRatio": "1:1",
    "status": "pending",
    "estimatedTime": "3-5分钟"
  },
  "quotaRemaining": 497
}
```

---

### 5. 电商全套图生成 (ecommerce)

提交电商设计生成任务。

**请求**:
```
POST /api/proxy
Content-Type: application/json
Authorization: Bearer <your-api-key>

{
  "apiType": "public-api",
  "action": "ecommerce",
  "product": "无线蓝牙耳机",
  "sellingPoints": "降噪40dB\n续航30小时\nIPX5防水",
  "platform": "taobao",
  "style": "premium"
}
```

**参数说明**:
- `apiType`: 必须设置为 "public-api"
- `product`: 产品名称 (必填)
- `sellingPoints`: 核心卖点，每行一个 (必填)
- `platform`: 目标平台，可选值: taobao/jd/amazon/xiaohongshu/douyin/wechat
- `style`: 视觉风格，可选值: premium/minimal/lifestyle/tech/luxury

**响应**:
```json
{
  "success": true,
  "message": "电商设计请求已接受",
  "data": {
    "product": "无线蓝牙耳机",
    "platform": "taobao",
    "style": "premium",
    "status": "queued",
    "estimatedCost": {
      "film": 12,
      "time": "6-8分钟"
    }
  },
  "quotaRemaining": 496
}
```

---

## API Key管理接口（仅前端使用）

这些接口仅供网站前端使用，需要用户登录认证。

### 创建API Key
```
POST /api/proxy
Content-Type: application/json

{
  "apiType": "public-api",
  "action": "create-key",
  "userId": "<user-id>",
  "keyName": "我的应用",
  "quotaLimit": 500
}
```

### 列出API Keys
```
POST /api/proxy
Content-Type: application/json

{
  "apiType": "public-api",
  "action": "list-keys",
  "userId": "<user-id>"
}
```

### 撤销API Key
```
POST /api/proxy
Content-Type: application/json

{
  "apiType": "public-api",
  "action": "revoke-key",
  "userId": "<user-id>",
  "keyId": 123
}
```

---

## CORS跨域

API已配置允许跨域访问。

## 错误响应

当发生错误时，返回格式如下:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "错误描述信息"
}
```

常见错误码:
- `MISSING_PARAMS`: 缺少必要参数
- `INVALID_ACTION`: 不支持的操作类型
- `INTERNAL_ERROR`: 服务器内部错误
- `MISSING_API_KEY`: 缺少API Key
- `INVALID_API_KEY`: 无效的API Key
- `QUOTA_EXCEEDED`: API调用配额已用完
- `UNAUTHORIZED`: 需要用户认证

---

## 部署说明

对外API功能已集成到 `/api/proxy` 中，无需新增Serverless Function，不超过Vercel Hobby计划的12个函数限制。

### 数据库部署

在使用API管理功能前，需要先执行数据库扩展脚本：

```sql
-- 执行 database/api-keys.sql
```

该脚本会创建：
- `api_keys` 表 - 存储API Key信息
- `api_call_logs` 表 - 记录API调用日志
- 相关的PostgreSQL函数和触发器

### 环境变量配置

需要在Vercel或本地环境中配置：
- `SUPABASE_URL` - Supabase项目URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase服务角色密钥

---

## 使用示例

### JavaScript (Fetch)

```javascript
const API_KEY = 'rk_your_api_key_here';
const API_ENDPOINT = 'https://your-domain.vercel.app/api/proxy';

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
callApi('generate', { prompt: '一只可爱的猫咪' }).then(console.log);
```

### Python (requests)

```python
import requests

API_KEY = 'rk_your_api_key_here'
API_ENDPOINT = 'https://your-domain.vercel.app/api/proxy'

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
print(call_api('generate', {'prompt': '一只可爱的猫咪'}))
```

### cURL

```bash
curl -X POST https://your-domain.vercel.app/api/proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer rk_your_api_key_here" \
  -d '{
    "apiType": "public-api",
    "action": "skills"
  }'
```

