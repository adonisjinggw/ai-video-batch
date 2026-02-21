-- ============================================
-- API Key管理表结构
-- 创建时间: 2026-02-15
-- ============================================

-- ============================================
-- 1. API Keys表
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_keys (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_name VARCHAR(100) NOT NULL,             -- Key名称（用户自定义）
    api_key VARCHAR(100) UNIQUE NOT NULL,      -- 实际的API Key（加密存储）
    key_prefix VARCHAR(20) NOT NULL,            -- Key前缀（用于显示）
    status VARCHAR(20) DEFAULT 'active',        -- 状态: active/revoked
    quota_limit INT DEFAULT 1000,               -- 调用配额限制（每日）
    quota_used INT DEFAULT 0,                   -- 已使用配额（今日）
    quota_reset_at TIMESTAMP,                    -- 下次配额重置时间
    last_used_at TIMESTAMP,                      -- 最后使用时间
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_api_key ON public.api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON public.api_keys(status);

-- ============================================
-- 2. API调用日志表
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_call_logs (
    id SERIAL PRIMARY KEY,
    api_key_id INT REFERENCES public.api_keys(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,               -- 调用的action: health/skills/info/generate/ecommerce
    request_body JSONB,                          -- 请求体
    response_status INT,                          -- 响应状态码
    success BOOLEAN DEFAULT TRUE,                 -- 是否成功
    error_message TEXT,                           -- 错误信息
    response_time_ms INT,                         -- 响应时间(毫秒)
    film_consumed INT DEFAULT 0,                  -- 消耗的胶片数
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_call_logs_api_key_id ON public.api_call_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_user_id ON public.api_call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_created_at ON public.api_call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_action ON public.api_call_logs(action);

-- ============================================
-- 3. 行级安全策略 (RLS)
-- ============================================

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_call_logs ENABLE ROW LEVEL SECURITY;

-- api_keys策略
CREATE POLICY "用户可查看自己的API Keys" ON public.api_keys
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户可插入自己的API Keys" ON public.api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可更新自己的API Keys" ON public.api_keys
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "用户可删除自己的API Keys" ON public.api_keys
    FOR DELETE USING (auth.uid() = user_id);

-- api_call_logs策略
CREATE POLICY "用户可查看自己的API调用日志" ON public.api_call_logs
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 4. 触发器：自动更新updated_at
-- ============================================
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON public.api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. 函数：生成API Key
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS VARCHAR AS $$
DECLARE
    new_key VARCHAR(100);
BEGIN
    new_key := 'rk_' || encode(gen_random_bytes(32), 'hex');
    RETURN new_key;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ============================================
-- 6. 函数：创建API Key
-- ============================================
CREATE OR REPLACE FUNCTION public.create_api_key(
    p_user_id UUID,
    p_key_name VARCHAR,
    p_quota_limit INT DEFAULT 1000
)
RETURNS TABLE(out_api_key VARCHAR, out_key_prefix VARCHAR, out_id INT) AS $$
DECLARE
    v_api_key VARCHAR;
    v_key_prefix VARCHAR;
    v_id INT;
BEGIN
    v_api_key := public.generate_api_key();
    v_key_prefix := SUBSTRING(v_api_key FROM 1 FOR 8);
    
    INSERT INTO public.api_keys (user_id, key_name, api_key, key_prefix, quota_limit, quota_reset_at)
    VALUES (
        p_user_id,
        p_key_name,
        v_api_key,
        v_key_prefix,
        p_quota_limit,
        NOW() + INTERVAL '1 day'
    )
    RETURNING public.api_keys.id INTO v_id;
    
    RETURN QUERY SELECT v_api_key, v_key_prefix, v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. 函数：验证API Key
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_api_key(p_api_key VARCHAR)
RETURNS TABLE(valid BOOLEAN, user_id UUID, key_id INT, quota_remaining INT) AS $$
DECLARE
    v_key RECORD;
BEGIN
    SELECT * INTO v_key 
    FROM public.api_keys 
    WHERE api_key = p_api_key AND status = 'active';
    
    IF v_key IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::INT, 0;
        RETURN;
    END IF;
    
    -- 检查配额重置
    IF v_key.quota_reset_at < NOW() THEN
        UPDATE public.api_keys 
        SET quota_used = 0, quota_reset_at = NOW() + INTERVAL '1 day'
        WHERE id = v_key.id;
        v_key.quota_used := 0;
    END IF;
    
    RETURN QUERY SELECT 
        TRUE, 
        v_key.user_id, 
        v_key.id, 
        GREATEST(0, v_key.quota_limit - v_key.quota_used);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. 函数：记录API调用
-- ============================================
CREATE OR REPLACE FUNCTION public.log_api_call(
    p_key_id INT,
    p_user_id UUID,
    p_action VARCHAR,
    p_request_body JSONB,
    p_response_status INT,
    p_success BOOLEAN,
    p_error_message TEXT,
    p_response_time_ms INT,
    p_film_consumed INT
)
RETURNS VOID AS $$
BEGIN
    -- 插入日志
    INSERT INTO public.api_call_logs (
        api_key_id, user_id, action, request_body, 
        response_status, success, error_message, 
        response_time_ms, film_consumed
    ) VALUES (
        p_key_id, p_user_id, p_action, p_request_body,
        p_response_status, p_success, p_error_message,
        p_response_time_ms, p_film_consumed
    );
    
    -- 更新配额使用
    IF p_key_id IS NOT NULL THEN
        UPDATE public.api_keys 
        SET quota_used = quota_used + 1, last_used_at = NOW()
        WHERE id = p_key_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 完成！
-- ============================================
