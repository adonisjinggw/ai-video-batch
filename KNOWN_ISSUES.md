# Known Issues

## 胶片余额异常增长问题 (Film Balance Spike Issue)

### 症状
- 用户使用后胶片余额不减反增
- 胶片数量出现暴增

### 根本原因
在 `api/supabase-proxy.js` 的充值/退款逻辑中：

1. **退款逻辑** (action === 'recharge'):
   - 插入新的 `film_lot` 记录（lines 1654-1669）
   - 但保持 `quota_balance` 不变 (line 1663: `newBalance = currentBalance`)
   
2. **返回总余额计算** (lines 1881-1892):
   - `totalBalance = lots总和 + quota_balance`
   
3. **问题**:
   - 每次退款都会插入新的lot（增加lots总和）
   - 但quota_balance保持不变
   - 导致totalBalance = (原lots + 新lot) + quota_balance持续增长
   - 特别是当API调用失败重试时，会多次退款，每次退款都增加lots

### 影响场景
- 视频生成失败后退款
- 多次重试失败的任务
- API调用失败后的自动退款

### 临时缓解措施
1. 减少失败任务的重试次数
2. 检查生成失败的原因，避免必然失败的参数
3. 定期检查 `film_lots` 表，清理异常的refund记录

### 修复方案
需要修改 `api/supabase-proxy.js` 中的退款逻辑：

**选项1：退款时从lots扣除而不是新增lot**
```javascript
// 退款时，如果是从lots扣的费，应该恢复对应的lot
// 而不是创建新的refund lot
```

**选项2：统一使用quota_balance，禁用lots系统**
```javascript
// 在recharge时直接更新quota_balance
if (action === 'recharge' || action === 'addQuota') {
    newBalance = __round2(currentBalance + amount);
    // 不插入lot
}
```

**选项3：退款时标记为"已退款"而不是重复退款**
```javascript
// 添加退款幂等性检查
// 使用taskId或transactionId作为幂等key
```

### 已实施的修复 ✅

**修复时间**：2026-01-11

**修复内容**：
1. 修改 `api/supabase-proxy.js` 的 recharge/addQuota 逻辑
   - 统一更新 quota_balance，不再创建 film_lots
   - 简化 consume 逻辑，直接从 quota_balance 扣费
   - 返回值直接使用 quota_balance，不再计算 lots 总和

2. 创建数据库诊断和修复脚本
   - 位置：`database/fix-film-balance-spike.sql`
   - 包含：诊断查询、修复方案、验证查询

**代码示例**：
```javascript
// api/supabase-proxy.js
if (action === 'recharge' || action === 'addQuota') {
    // 🔧 统一更新 quota_balance，不使用 lots 系统
    newBalance = __round2(currentBalance + amount);
    console.log(`[supabase-proxy] ${action} 更新quota_balance: ${currentBalance} -> ${newBalance}`);
} else if (action === 'consume') {
    // 🔧 统一从 quota_balance 扣费
    if (currentBalance < amount) {
        res.status(400).json({ error: 'INSUFFICIENT_BALANCE', message: '余额不足' });
        return;
    }
    newBalance = __round2(currentBalance - amount);
    newUsed = __round2(currentUsed + amount);
}
```

### 数据修复
如果已经出现余额异常，需要：
1. 检查 `film_lots` 表中的 refund 类型记录
2. 计算正确的余额 = (purchased lots) - (actual consumption)
3. 更新 `user_profiles.quota_balance` 为正确值
4. 清理或标记异常的 refund lots

---

## 角色添加到角色库报错

### 症状
从任务中点击📥按钮将角色添加到角色库时报错

### 原因
角色数据中包含特殊字符（单引号、双引号、反斜杠、换行符）未正确转义，导致：
1. HTML onclick属性中的JavaScript字符串语法错误
2. localStorage JSON.parse失败

### 修复
已在 `js/batch.js` 中修复：
1. Line 13387: 添加 `escapeForJS()` 函数处理所有特殊字符
2. Line 31822-31896: 在 `saveCharacterToLibrary()` 函数中添加：
   - 外层try-catch捕获所有错误
   - 输入参数验证
   - 更友好的错误提示

### 测试
保存包含以下字符的角色：
- 单引号：`It's a test`
- 双引号：`"quoted"`
- 反斜杠：`path\to\file`
- 换行符：多行描述