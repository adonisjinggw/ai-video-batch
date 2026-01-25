# 🤖 自动托管模式使用指南

## 📖 功能说明

**自动托管模式**是一个全自动化的批量任务处理系统，让你可以：
- ✅ 批量添加多个任务
- ✅ 系统自动按顺序处理
- ✅ 无需手动点击生成
- ✅ 配额不足时自动暂停
- ✅ 页面关闭后可恢复（下次打开继续）

---

## 🚀 快速开始

### 方法1：在浏览器控制台启用

```javascript
// 1. 打开浏览器控制台 (F12)

// 2. 启用自动托管模式
toggleAutoHosting();

// 3. 添加当前选中的任务到托管队列
const selected = ideas.filter(i => i.selected);
batchAddToAutoHosting(selected);

// 4. 手动启动托管（如果未自动启动）
startAutoHosting();
```

---

### 方法2：通过批量生成按钮

1. **勾选多个任务**（超过并发限制）
2. **点击"开始批量创作"**
3. **系统会提示**：是否启用自动托管模式
4. **点击"确定"**，自动托管启动 ✅

---

## 📋 核心API

### 1. 启用/禁用托管模式

```javascript
toggleAutoHosting();
// 返回: 无
// 效果: 切换自动托管模式开/关
```

---

### 2. 添加单个任务到托管队列

```javascript
const idea = ideas[0]; // 获取第一个任务
addToAutoHostingQueue(idea);
```

---

### 3. 批量添加任务到托管队列

```javascript
// 添加所有待处理的任务
const pending = ideas.filter(i => i.status === 'pending');
batchAddToAutoHosting(pending);

// 或添加选中的任务
const selected = ideas.filter(i => i.selected);
batchAddToAutoHosting(selected);
```

---

### 4. 手动启动托管处理

```javascript
startAutoHosting();
// 返回: Promise
// 效果: 立即开始处理队列中的任务
```

---

### 5. 从队列移除任务

```javascript
removeFromAutoHostingQueue('task-id-123');
// 参数: 任务ID
// 效果: 从托管队列中移除指定任务
```

---

### 6. 查看托管状态

```javascript
const status = getAutoHostingStatus();
console.log(status);

// 输出示例:
{
  enabled: true,           // 托管模式是否启用
  running: true,           // 是否正在处理任务
  queueLength: 5,          // 队列中剩余任务数
  queue: [                 // 队列详情
    { id: 'task-1', theme: '科幻短片', status: 'pending' },
    { id: 'task-2', theme: '爱情故事', status: 'pending' },
    ...
  ]
}
```

---

## 🎯 使用场景

### 场景1：批量创作多个短片

```javascript
// 1. 创建10个任务（可以通过UI或代码）
const themes = [
  '科幻太空冒险',
  '古代武侠传奇',
  '现代都市爱情',
  '悬疑推理故事',
  '未来赛博朋克',
  '温馨家庭日常',
  '惊悚恐怖片段',
  '搞笑喜剧短片',
  '励志成长故事',
  '魔幻奇幻冒险'
];

themes.forEach(theme => {
  addIdea(theme); // 假设有 addIdea 函数
});

// 2. 启用托管模式
toggleAutoHosting();

// 3. 添加所有任务到托管队列
const allIdeas = ideas.filter(i => i.status !== 'completed');
batchAddToAutoHosting(allIdeas);

// 4. 系统会自动按顺序处理所有任务
// 你可以关闭页面，稍后再打开查看进度
```

---

### 场景2：夜间自动处理

```javascript
// 下班前设置
// 1. 批量添加20个任务
// 2. 启用托管模式
toggleAutoHosting();

// 3. 添加所有任务
batchAddToAutoHosting(ideas);

// 4. 关闭浏览器，回家
// 5. 第二天早上打开，所有任务已完成 ✅
```

**注意**: Vercel部署的网页无法真正"后台运行"，但如果你：
- 保持浏览器标签页打开（可以最小化）
- 或使用本地服务器部署

则可以实现真正的夜间无人值守处理。

---

### 场景3：配额不足自动暂停

```javascript
// 托管模式会自动检查配额
// 如果配额不足，会：
// 1. 暂停处理
// 2. 弹出提示
// 3. 自动禁用托管模式

// 用户可以：
// - 分享获取额外配额
// - 升级会员
// 然后手动重新启用托管模式

toggleAutoHosting(); // 重新启用
startAutoHosting();  // 继续处理
```

---

## ⚙️ 高级配置

### 修改处理间隔

```javascript
// 在 startAutoHosting() 函数中
// 找到这一行:
await new Promise(resolve => setTimeout(resolve, 1000));

// 修改延迟时间（单位：毫秒）
// 1000ms = 1秒
// 2000ms = 2秒
// 建议: 500-3000ms
```

---

### 自定义队列顺序

```javascript
// 按优先级排序（假设任务有 priority 字段）
autoHostingQueue.sort((a, b) => b.priority - a.priority);

// 或按创建时间排序
autoHostingQueue.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
```

---

### 持久化托管队列

```javascript
// 保存队列到 localStorage
localStorage.setItem('auto_hosting_queue', JSON.stringify(autoHostingQueue));

// 恢复队列
const savedQueue = JSON.parse(localStorage.getItem('auto_hosting_queue') || '[]');
autoHostingQueue = savedQueue;
```

---

## 🔧 故障排除

### 问题1: 托管模式启动后没反应

**解决方案**:
```javascript
// 1. 检查托管状态
getAutoHostingStatus();

// 2. 手动启动
startAutoHosting();

// 3. 检查队列是否为空
console.log('队列长度:', autoHostingQueue.length);
```

---

### 问题2: 任务卡住不动

**解决方案**:
```javascript
// 1. 禁用托管模式
toggleAutoHosting();

// 2. 清空队列
autoHostingQueue = [];

// 3. 重新添加任务
const stuck = ideas.filter(i => i.status === 'processing');
stuck.forEach(i => i.status = 'pending');
batchAddToAutoHosting(stuck);

// 4. 重新启用
toggleAutoHosting();
```

---

### 问题3: 配额不足导致中断

**解决方案**:
```javascript
// 1. 分享获取额外配额
shareForQuota();

// 或升级会员

// 2. 重新启用托管
toggleAutoHosting();
startAutoHosting();
```

---

## 📊 性能优化

### 1. 控制并发数

虽然托管模式是串行处理，但可以修改为并发处理：

```javascript
// 在 startAutoHosting() 中修改
const CONCURRENT = 3; // 同时处理3个任务

while (autoHostingQueue.length > 0) {
    const batch = autoHostingQueue.splice(0, CONCURRENT);
    await Promise.all(batch.map(idea => processIdea(idea)));
}
```

---

### 2. 智能休眠

```javascript
// 添加智能休眠，避免频繁API调用
const sleepTime = autoHostingQueue.length > 10 ? 500 : 2000;
await new Promise(resolve => setTimeout(resolve, sleepTime));
```

---

## 🎉 最佳实践

1. **批量添加前检查配额**
   ```javascript
   const stats = getUsageStats();
   if (stats.remaining < tasks.length) {
       alert('配额不足！');
   }
   ```

2. **定期保存进度**
   - 托管模式会自动保存
   - 建议每处理10个任务手动保存一次

3. **合理设置并发**
   - 免费用户: 1-3个
   - 付费用户: 3-10个

4. **监控队列状态**
   ```javascript
   setInterval(() => {
       console.log('托管状态:', getAutoHostingStatus());
   }, 10000); // 每10秒打印一次
   ```

---

## 🔗 相关功能

- **批量生成**: `startBatchGeneration()`
- **单任务处理**: `processIdea(idea)`
- **配额检查**: `checkQuota(count)`
- **任务状态**: `idea.status` (pending/processing/completed/failed)

---

## 📞 技术支持

如有问题，请在控制台运行：
```javascript
console.log('托管状态:', getAutoHostingStatus());
console.log('所有任务:', ideas);
console.log('配额信息:', getUsageStats());
```

并将输出发送给开发者。

---

**🎬 开始使用自动托管，解放双手，批量创作！** 🚀

