-- ============================================
-- RollRoll 成本管理系统升级脚本
-- 执行时间：2024-12
-- 功能：添加用户胶片消费统计 + 官方价格对比
-- ============================================

-- ============================================
-- 1. 用户胶片消费日报视图
-- ============================================
CREATE OR REPLACE VIEW public.user_film_consumption AS
SELECT 
    user_id,
    DATE(created_at) as date,
    SUM(film_consumed) as daily_film_consumed,
    SUM(revenue) as daily_revenue,
    COUNT(*) as operation_count
FROM public.api_cost_logs
WHERE success = TRUE AND film_consumed > 0
GROUP BY user_id, DATE(created_at)
ORDER BY date DESC, daily_film_consumed DESC;

-- ============================================
-- 2. 用户胶片消费汇总视图（按用户）
-- ============================================
CREATE OR REPLACE VIEW public.user_film_summary AS
SELECT 
    user_id,
    SUM(film_consumed) as total_film_consumed,
    SUM(revenue) as total_spent,
    COUNT(*) as total_operations,
    MIN(created_at) as first_usage,
    MAX(created_at) as last_usage,
    COUNT(DISTINCT DATE(created_at)) as active_days
FROM public.api_cost_logs
WHERE success = TRUE AND film_consumed > 0
GROUP BY user_id
ORDER BY total_film_consumed DESC;

-- ============================================
-- 3. 官方价格配置表（用于成本对比）
-- ============================================
CREATE TABLE IF NOT EXISTS public.official_price_config (
    id SERIAL PRIMARY KEY,
    api_type VARCHAR(50) UNIQUE NOT NULL,    -- gemini3, banana2, sora2, seedream
    api_name VARCHAR(100) NOT NULL,          -- 显示名称
    official_price DECIMAL(10,4) NOT NULL,   -- 官方原价(元)
    unit VARCHAR(20) DEFAULT '次',           -- 单位：次、张、个
    our_film_cost DECIMAL(10,2) NOT NULL,    -- 我们收取的胶片数
    our_actual_cost DECIMAL(10,4),           -- 我们的实际采购成本
    updated_at TIMESTAMP DEFAULT NOW(),
    notes TEXT                               -- 备注
);

-- ============================================
-- 4. 插入默认价格配置
-- ============================================
INSERT INTO public.official_price_config (api_type, api_name, official_price, unit, our_film_cost, our_actual_cost, notes)
VALUES 
    ('gemini3', 'Gemini3 文本生成', 0.09, '次', 0.1, 0.026, '官方按token计费，此为平均单次成本'),
    ('banana2', 'Banana2 图片生成', 0.52, '张', 0.7, 0.17, 'Flux模型图片生成'),
    ('sora2', 'Sora2 视频生成(15秒)', 10.80, '个', 4.5, 1.08, '官方$1.5/个，按汇率7.2计算'),
    ('seedream', '即梦3 图片生成', 0.73, '张', 0.8, 0.22, '字节跳动即梦模型')
ON CONFLICT (api_type) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    official_price = EXCLUDED.official_price,
    unit = EXCLUDED.unit,
    our_film_cost = EXCLUDED.our_film_cost,
    our_actual_cost = EXCLUDED.our_actual_cost,
    updated_at = NOW(),
    notes = EXCLUDED.notes;

-- ============================================
-- 5. RLS策略：价格配置表
-- ============================================
ALTER TABLE public.official_price_config ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Admin can manage price config" ON public.official_price_config;
DROP POLICY IF EXISTS "Anyone can read price config" ON public.official_price_config;

-- 管理员可管理
CREATE POLICY "Admin can manage price config" ON public.official_price_config
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM public.user_profiles 
            WHERE membership_type = 'admin' OR email LIKE '%@rollroll.art'
        )
    );

-- 所有人可读取（用于前端显示价格对比）
CREATE POLICY "Anyone can read price config" ON public.official_price_config
    FOR SELECT USING (TRUE);

-- ============================================
-- 6. 创建胶片消费统计函数（可选，用于仪表盘）
-- ============================================
CREATE OR REPLACE FUNCTION public.get_film_stats(days_range INT DEFAULT 30)
RETURNS TABLE (
    total_film DECIMAL,
    total_revenue DECIMAL,
    user_count BIGINT,
    avg_per_user DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(film_consumed), 0)::DECIMAL as total_film,
        COALESCE(SUM(revenue), 0)::DECIMAL as total_revenue,
        COUNT(DISTINCT user_id) as user_count,
        CASE 
            WHEN COUNT(DISTINCT user_id) > 0 
            THEN (SUM(film_consumed) / COUNT(DISTINCT user_id))::DECIMAL 
            ELSE 0 
        END as avg_per_user
    FROM public.api_cost_logs
    WHERE success = TRUE 
      AND film_consumed > 0
      AND created_at >= NOW() - (days_range || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 完成！
-- ============================================
-- 执行完成后，可以通过以下方式验证：
-- 
-- 1. 查看用户胶片消费日报：
--    SELECT * FROM user_film_consumption LIMIT 10;
--
-- 2. 查看用户消费汇总：
--    SELECT * FROM user_film_summary LIMIT 10;
--
-- 3. 查看官方价格配置：
--    SELECT * FROM official_price_config;
--
-- 4. 调用统计函数（最近30天）：
--    SELECT * FROM get_film_stats(30);
-- ============================================

