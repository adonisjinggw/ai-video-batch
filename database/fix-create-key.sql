-- ============================================
-- 只修复 create_api_key 函数（不删除任何数据）
-- ============================================

-- 删除旧函数
DROP FUNCTION IF EXISTS public.create_api_key(UUID, VARCHAR, INT);

-- 创建修复后的函数
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
-- 完成！
-- ============================================
