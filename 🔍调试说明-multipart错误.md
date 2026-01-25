# 🔍 调试说明 - multipart form 错误

## ❌ 错误信息
```
failed to parse multipart form
```

## 🔍 可能的原因

### 1. **请求格式错误**
- 后端期望 `application/json`
- 但可能收到了其他格式的数据

### 2. **请求体为空或格式不对**
- 前端没有正确传递 `body` 字段
- 或者 `body` 字段是 `null`/`undefined`

### 3. **Content-Type 不匹配**
- API 期望 `application/json`
- 但收到的是其他类型

---

## ✅ 已添加的调试日志

### **后端 (`启动服务器.js`)**

#### **接收到请求时：**
```javascript
console.log('📦 收到请求体:', body.substring(0, 500));
```

#### **发送请求前：**
```javascript
console.log('📤 发送请求体:', bodyString.substring(0, 300));
console.log('📏 请求体长度:', bodyString.length);
```

#### **检查关键字段：**
```javascript
if (!requestData.targetUrl) {
    throw new Error('缺少 targetUrl 字段');
}
if (!requestData.body) {
    console.warn('⚠️ 请求体的 body 字段为空或未定义');
}
```

---

## 🚀 测试步骤

### **步骤1：关闭当前服务器**
在命令行窗口按 `Ctrl + C`

### **步骤2：重新启动服务器**
双击 `🚀一键启动.bat`

### **步骤3：重新测试**
1. 打开 `http://localhost:8899`
2. 添加创意
3. 点击"开始批量生成"
4. **查看命令行窗口的详细日志**

---

## 📋 需要查看的日志

当出现错误时，请查看：

### **1. 收到的请求体：**
```
📦 收到请求体: {"targetUrl":"https://ai.t8star.cn/v1/video/generations","apiType":"t8star","body":{"model":"sora-2","prompt":"...","size":"1280x720"}}
```

### **2. 发送的请求体：**
```
📤 发送请求体: {"model":"sora-2","prompt":"...","size":"1280x720"}
📏 请求体长度: 123
```

### **3. API 响应：**
```
✅ 响应状态: 200
或
⚠️ API返回错误: {"code":"build_request_failed","message":"failed to parse multipart form","data":null}
```

---

## 🔧 可能的修复方案

### **方案1：检查 Content-Type**
确保请求头是 `application/json` 而不是 `multipart/form-data`

### **方案2：检查 API 文档**
T8 Star 的 Sora2 API 可能需要特殊的请求格式

### **方案3：尝试不同的 model 名称**
可能需要使用 `sora-2-pro` 或其他模型名

---

## 📞 下一步

**请执行以下操作：**

1. ✅ 关闭并重启服务器
2. ✅ 重新测试文生视频功能
3. ✅ **复制完整的命令行日志**发给我
4. ✅ 特别注意这几行：
   - `📦 收到请求体:`
   - `📤 发送请求体:`
   - `⚠️ API返回错误:`

---

**等待您的测试结果...** 🔍

