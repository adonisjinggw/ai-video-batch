-- ========================================
-- 胶片余额暴增问题诊断和修复脚本
-- Film Balance Spike Issue - Diagnostic and Fix Script
-- ========================================

-- 说明：
-- 问题：refund 操作创建新的 film_lot 但不更新 quota_balance
-- 导致：totalBalance = lots总和 + quota_balance 持续增长
-- 解决：统一使用 quota_balance，禁用 film_lots 系统

-- ========================================
-- 第一步：诊断 - 检查异常的 refund 记录
-- ========================================

-- 1. 统计所有 refund 类型的 film_lots 记录
SELECT 
    lot_type,
    COUNT(*) as count,
    SUM(amount_initial) as total_initial,
    SUM(amount_remaining) as total_remaining,
    MIN(created_at) as earliest,
    MAX(created_at) as latest
FROM film_lots
WHERE lot_type = 'refund'
GROUP BY lot_type;

-- 2. 查找有大量 refund lots 的用户
SELECT 
    user_id,
    COUNT(*) as refund_count,
    SUM(amount_initial) as total_refunded,
    SUM(amount_remaining) as total_remaining
FROM film_lots
WHERE lot_type = 'refund'
GROUP BY user_id
HAVING COUNT(*) > 5  -- 超过5次refund的用户
ORDER BY refund_count DESC
LIMIT 50;

-- 3. 检查用户的总余额构成
-- 对比 lots 总和 vs quota_balance
SELECT 
    up.id as user_id,
    up.quota_balance,
    up.quota_used,
    COALESCE(SUM(fl.amount_remaining), 0) as lots_total,
    up.quota_balance + COALESCE(SUM(fl.amount_remaining), 0) as computed_total,
    COUNT(fl.id) as lots_count,
    SUM(CASE WHEN fl.lot_type = 'refund' THEN fl.amount_remaining ELSE 0 END) as refund_lots_total
FROM user_profiles up
LEFT JOIN film_lots fl ON fl.user_id = up.id 
    AND fl.amount_remaining > 0 
    AND (fl.expires_at IS NULL OR fl.expires_at > NOW())
GROUP BY up.id, up.quota_balance, up.quota_used
HAVING COALESCE(SUM(fl.amount_remaining), 0) > 0  -- 只显示有lots的用户
ORDER BY lots_total DESC
LIMIT 50;

-- 4. 查找可能受影响的用户（refund lots > quota_balance）
SELECT 
    up.id as user_id,
    up.username,
    up.quota_balance,
    COALESCE(SUM(CASE WHEN fl.lot_type = 'refund' THEN fl.amount_remaining ELSE 0 END), 0) as refund_lots,
    COALESCE(SUM(CASE WHEN fl.lot_type = 'purchased' THEN fl.amount_remaining ELSE 0 END), 0) as purchased_lots,
    COALESCE(SUM(fl.amount_remaining), 0) as total_lots
FROM user_profiles up
LEFT JOIN film_lots fl ON fl.user_id = up.id 
    AND fl.amount_remaining > 0 
    AND (fl.expires_at IS NULL OR fl.expires_at > NOW())
GROUP BY up.id, up.username, up.quota_balance
HAVING SUM(CASE WHEN fl.lot_type = 'refund' THEN fl.amount_remaining ELSE 0 END) > up.quota_balance
ORDER BY refund_lots DESC
LIMIT 100;

-- 5. 检查 quota_logs 中的退款记录
SELECT 
    user_id,
    action_type,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    MIN(created_at) as earliest,
    MAX(created_at) as latest
FROM quota_logs
WHERE action_type = 'recharge' 
    AND description LIKE '%退%'  -- 包含"退"字的记录
GROUP BY user_id, action_type
HAVING COUNT(*) > 10  -- 退款超过10次的用户
ORDER BY count DESC
LIMIT 50;

-- ========================================
-- 第二步：数据修复 - 清理异常的 refund lots
-- ========================================

-- 注意：执行修复前请先备份数据库！

-- 选项1：将所有 refund lots 合并到 quota_balance
-- 这会将所有refund lots的余额加到quota_balance，然后删除这些lots

-- 1.1 计算每个用户的refund lots总额
CREATE TEMP TABLE temp_refund_totals AS
SELECT 
    user_id,
    SUM(amount_remaining) as refund_total
FROM film_lots
WHERE lot_type = 'refund' 
    AND amount_remaining > 0
    AND (expires_at IS NULL OR expires_at > NOW())
GROUP BY user_id;

-- 1.2 更新用户的 quota_balance（加上refund lots）
-- 注意：这个操作不可逆，请确保已备份！
-- UPDATE user_profiles up
-- SET quota_balance = quota_balance + COALESCE(trt.refund_total, 0)
-- FROM temp_refund_totals trt
-- WHERE up.id = trt.user_id;

-- 1.3 将 refund lots 的余额清零（标记为已使用）
-- UPDATE film_lots
-- SET amount_remaining = 0
-- WHERE lot_type = 'refund';

-- 1.4 或者直接删除所有 refund lots
-- DELETE FROM film_lots WHERE lot_type = 'refund';

-- ========================================
-- 选项2：保守方案 - 只修复明显异常的记录
-- ========================================

-- 2.1 找出余额异常的用户（refund lots > 实际消费）
-- 基于假设：正常情况下，refund不应该超过消费金额
CREATE TEMP TABLE temp_abnormal_users AS
SELECT 
    up.id as user_id,
    up.quota_used,
    COALESCE(SUM(CASE WHEN fl.lot_type = 'refund' THEN fl.amount_remaining ELSE 0 END), 0) as refund_lots,
    -- 异常金额 = refund总额 - 应退金额（假设为已用额度的50%）
    GREATEST(0, 
        COALESCE(SUM(CASE WHEN fl.lot_type = 'refund' THEN fl.amount_remaining ELSE 0 END), 0) 
        - (up.quota_used * 0.5)
    ) as abnormal_amount
FROM user_profiles up
LEFT JOIN film_lots fl ON fl.user_id = up.id 
    AND fl.lot_type = 'refund'
    AND fl.amount_remaining > 0
GROUP BY up.id, up.quota_used
HAVING COALESCE(SUM(CASE WHEN fl.lot_type = 'refund' THEN fl.amount_remaining ELSE 0 END), 0) 
    > (up.quota_used * 0.5);

-- 2.2 只修复明显异常的用户
-- UPDATE user_profiles up
-- SET quota_balance = quota_balance + tau.abnormal_amount
-- FROM temp_abnormal_users tau
-- WHERE up.id = tau.user_id;

-- ========================================
-- 第三步：验证修复结果
-- ========================================

-- 3.1 检查修复后的余额分布
SELECT 
    COUNT(*) as total_users,
    AVG(quota_balance) as avg_balance,
    MIN(quota_balance) as min_balance,
    MAX(quota_balance) as max_balance,
    SUM(quota_balance) as total_balance
FROM user_profiles
WHERE quota_balance > 0;

-- 3.2 检查是否还有异常的 refund lots
SELECT COUNT(*) as remaining_refund_lots
FROM film_lots
WHERE lot_type = 'refund' AND amount_remaining > 0;

-- 3.3 验证总余额一致性
SELECT 
    COUNT(*) as users_with_lots,
    SUM(quota_balance) as total_quota_balance,
    SUM(lots_total) as total_lots,
    SUM(quota_balance + lots_total) as combined_total
FROM (
    SELECT 
        up.id,
        up.quota_balance,
        COALESCE(SUM(fl.amount_remaining), 0) as lots_total
    FROM user_profiles up
    LEFT JOIN film_lots fl ON fl.user_id = up.id 
        AND fl.amount_remaining > 0
    GROUP BY up.id, up.quota_balance
) sub
WHERE lots_total > 0;

-- ========================================
-- 第四步：记录修复日志
-- ========================================

-- 4.1 为修复操作创建日志记录
-- INSERT INTO quota_logs (user_id, action_type, amount, balance_after, description)
-- SELECT 
--     user_id,
--     'system_fix' as action_type,
--     refund_total as amount,
--     quota_balance as balance_after,
--     '修复胶片余额暴增问题 - 合并refund lots到quota_balance' as description
-- FROM temp_refund_totals trt
-- JOIN user_profiles up ON up.id = trt.user_id;

-- ========================================
-- 清理临时表
-- ========================================
-- DROP TABLE IF EXISTS temp_refund_totals;
-- DROP TABLE IF EXISTS temp_abnormal_users;

-- ========================================
-- 使用说明
-- ========================================
-- 1. 先运行"第一步：诊断"部分的所有查询，了解问题规模
-- 2. 根据诊断结果选择修复方案（选项1或选项2）
-- 3. 备份数据库！备份数据库！备份数据库！
-- 4. 取消注释相应的 UPDATE/DELETE 语句并执行
-- 5. 运行"第三步：验证"部分确认修复效果
-- 6. 记录修复日志供后续审计
-- 7. 清理临时表

-- ========================================
-- 预防措施（已在代码中实现）
-- ========================================
-- 1. api/supabase-proxy.js 已修改为统一使用 quota_balance
-- 2. 充值/退款不再创建 film_lots
-- 3. 消费直接从 quota_balance 扣除
-- 4. 返回值直接使用 quota_balance，不再计算 lots 总和
