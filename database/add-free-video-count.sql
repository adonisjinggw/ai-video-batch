-- ============================================
-- 添加免费视频生成次数字段
-- 2026-02-20
-- ============================================

-- 1. 在 user_profiles 表中添加免费视频生成次数字段
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS free_video_count INT DEFAULT 3;

-- 2. 更新现有用户的免费视频次数为3（默认值）
UPDATE public.user_profiles 
SET free_video_count = 3 
WHERE free_video_count IS NULL;

-- 3. 修改新用户触发器，设置初始免费视频次数为3
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_invite_code VARCHAR(20);
BEGIN
    -- 生成唯一邀请码
    new_invite_code := 'NV' || UPPER(SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 8));
    
    INSERT INTO public.user_profiles (id, email, nickname, invite_code, free_video_count)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nickname', SPLIT_PART(NEW.email, '@', 1)),
        new_invite_code,
        3
    );
    
    -- 初始化用户设置
    INSERT INTO public.user_settings (user_id, settings_data, ui_preferences)
    VALUES (NEW.id, '{}'::JSONB, '{}'::JSONB);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 完成！
-- ============================================
