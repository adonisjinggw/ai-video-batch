-- ============================================
-- RollRoll 成本管理系统升级脚本（修复版）
-- 包含依赖表检查和创建
-- ============================================

-- ============================================
-- 0. 先检查并创建依赖表 api_cost_logs
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_cost_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    api_type VARCHAR(50) NOT NULL,           -- gemini3, banana2, sora2
    api_action VARCHAR(100),                 -- 具体操作：text_story, image_character等
    call_count INT DEFAULT 1,                -- 调用次数
    actual_cost DECIMAL(10,4) NOT NULL DEFAULT 0,  -- 实际成本（元）
    film_consumed DECIMAL(10,2) DEFAULT 0,   -- 消耗胶片数
    revenue DECIMAL(10,2) DEFAULT 0,         -- 预估收入（元）
    task_id VARCHAR(100),                    -- 关联任务ID
    success BOOLEAN DEFAULT TRUE,            -- 是否成功
    error_message TEXT,                      -- 错误信息
    response_time_ms INT,                    -- 响应时间(毫秒)
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_cost_logs_api_type ON public.api_cost_logs(api_type);
CREATE INDEX IF NOT EXISTS idx_cost_logs_created_at ON public.api_cost_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_cost_logs_user_id ON public.api_cost_logs(user_id);

-- 启用RLS
ALTER TABLE public.api_cost_logs ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（避免重复创建报错）
DROP POLICY IF EXISTS "Admin can view all cost logs" ON public.api_cost_logs;
DROP POLICY IF EXISTS "System can insert cost logs" ON public.api_cost_logs;

-- 管理员查看
CREATE POLICY "Admin can view all cost logs" ON public.api_cost_logs
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM public.user_profiles 
            WHERE membership_type = 'admin' OR email LIKE '%@rollroll.art'
        )
    );

-- 系统插入
CREATE POLICY "System can insert cost logs" ON public.api_cost_logs
    FOR INSERT WITH CHECK (TRUE);

-- ============================================
-- 1. 用户胶片消费日报视图
-- ============================================
DROP VIEW IF EXISTS public.user_film_consumption;
CREATE VIEW public.user_film_consumption AS
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
DROP VIEW IF EXISTS public.user_film_summary;
CREATE VIEW public.user_film_summary AS
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
-- 3. 成本统计视图
-- ============================================
DROP VIEW IF EXISTS public.cost_summary;
CREATE VIEW public.cost_summary AS
SELECT 
    DATE(created_at) as date,
    api_type,
    COUNT(*) as call_count,
    SUM(actual_cost) as total_cost,
    SUM(film_consumed) as total_film,
    SUM(revenue) as total_revenue,
    SUM(revenue - actual_cost) as total_profit,
    AVG(response_time_ms) as avg_response_time
FROM public.api_cost_logs
WHERE success = TRUE
GROUP BY DATE(created_at), api_type
ORDER BY date DESC, api_type;

-- ============================================
-- 4. 官方价格配置表
-- ============================================
CREATE TABLE IF NOT EXISTS public.official_price_config (
    id SERIAL PRIMARY KEY,
    api_type VARCHAR(50) UNIQUE NOT NULL,
    api_name VARCHAR(100) NOT NULL,
    official_price DECIMAL(10,4) NOT NULL,
    unit VARCHAR(20) DEFAULT '次',
    our_film_cost DECIMAL(10,2) NOT NULL,
    our_actual_cost DECIMAL(10,4),
    updated_at TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

-- 插入默认数据
INSERT INTO public.official_price_config (api_type, api_name, official_price, unit, our_film_cost, our_actual_cost, notes)
VALUES 
    ('gemini3', 'Gemini3 文本生成', 0.09, '次', 0.1, 0.026, '官方按token计费'),
    ('banana2', 'Banana2 图片生成', 0.52, '张', 0.7, 0.17, 'Flux模型'),
    ('sora2', 'Sora2 视频(15秒)', 10.80, '个', 4.5, 1.08, '官方$1.5/个'),
    ('seedream', '即梦3 图片', 0.73, '张', 0.8, 0.22, '字节即梦')
ON CONFLICT (api_type) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    official_price = EXCLUDED.official_price,
    our_film_cost = EXCLUDED.our_film_cost,
    our_actual_cost = EXCLUDED.our_actual_cost,
    updated_at = NOW();

-- RLS
ALTER TABLE public.official_price_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage price config" ON public.official_price_config;
DROP POLICY IF EXISTS "Anyone can read price config" ON public.official_price_config;

CREATE POLICY "Admin can manage price config" ON public.official_price_config
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM public.user_profiles 
            WHERE membership_type = 'admin' OR email LIKE '%@rollroll.art'
        )
    );

CREATE POLICY "Anyone can read price config" ON public.official_price_config
    FOR SELECT USING (TRUE);

-- ============================================
-- 5. 统计函数
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
        COALESCE(SUM(l.film_consumed), 0)::DECIMAL,
        COALESCE(SUM(l.revenue), 0)::DECIMAL,
        COUNT(DISTINCT l.user_id),
        CASE 
            WHEN COUNT(DISTINCT l.user_id) > 0 
            THEN (SUM(l.film_consumed) / COUNT(DISTINCT l.user_id))::DECIMAL 
            ELSE 0 
        END
    FROM public.api_cost_logs l
    WHERE l.success = TRUE 
      AND l.film_consumed > 0
      AND l.created_at >= NOW() - (days_range || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 完成！执行以下验证：
-- ============================================
SELECT '✅ api_cost_logs 表' as status, COUNT(*) as count FROM api_cost_logs;
SELECT '✅ official_price_config 表' as status, COUNT(*) as count FROM official_price_config;

