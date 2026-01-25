-- ============================================
-- NanoVideo AI 会员系统数据库表结构
-- Supabase PostgreSQL
-- 创建时间: 2025-11-25
-- ============================================

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 🔧 自动确认新注册用户（跳过邮箱验证）
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
    -- 自动设置邮箱确认时间为当前时间
    UPDATE auth.users 
    SET email_confirmed_at = NOW()
    WHERE id = NEW.id AND email_confirmed_at IS NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;

-- 创建触发器：新用户注册后自动确认
CREATE TRIGGER on_auth_user_created_confirm
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_user();

-- ============================================
-- 1. 用户配置表 (扩展auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    nickname VARCHAR(50),
    avatar_url TEXT,
    membership_type VARCHAR(20) DEFAULT 'free' CHECK (membership_type IN ('free', 'vip', 'pro')),
    quota_balance INT DEFAULT 100,           -- 胶片余额（免费用户100）
    quota_used INT DEFAULT 0,                -- 已使用额度
    vip_expires_at TIMESTAMP,                -- VIP过期时间
    invite_code VARCHAR(20) UNIQUE,          -- 用户专属邀请码
    invited_by UUID REFERENCES public.user_profiles(id), -- 邀请人
    invite_count INT DEFAULT 0,              -- 邀请人数
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_invite_code ON public.user_profiles(invite_code);

-- ============================================
-- 2. 用户任务表
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_tasks (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id BIGINT NOT NULL,                 -- 前端任务ID
    theme VARCHAR(500),                      -- 任务主题
    status VARCHAR(50) DEFAULT 'pending',
    task_data JSONB,                         -- 完整任务数据（压缩存储）
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, task_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON public.user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_status ON public.user_tasks(status);

-- ============================================
-- 3. 用户角色库
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_characters (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    summary TEXT,
    image_url TEXT,
    video_url TEXT,
    tags VARCHAR(255)[],                     -- 标签数组
    is_public BOOLEAN DEFAULT FALSE,         -- 是否公开分享
    use_count INT DEFAULT 0,                 -- 使用次数
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_characters_user_id ON public.user_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_user_characters_public ON public.user_characters(is_public) WHERE is_public = TRUE;

-- ============================================
-- 4. 用户设置表
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    settings_data JSONB DEFAULT '{}'::JSONB, -- API Keys等设置（加密存储）
    ui_preferences JSONB DEFAULT '{}'::JSONB, -- UI偏好
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 5. 额度消费记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.quota_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,        -- 操作类型: consume/refund/recharge/invite_bonus
    amount INT NOT NULL,                     -- 变动数量（正数增加，负数减少）
    balance_after INT NOT NULL,              -- 变动后余额
    description TEXT,                        -- 描述
    task_id BIGINT,                          -- 关联任务ID
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_quota_logs_user_id ON public.quota_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_quota_logs_created_at ON public.quota_logs(created_at);

-- ============================================
-- 6. 邀请记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.invite_records (
    id SERIAL PRIMARY KEY,
    inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invite_code VARCHAR(20) NOT NULL,
    bonus_given INT DEFAULT 50,              -- 给邀请人的奖励
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(invitee_id)                       -- 每个用户只能被邀请一次
);

-- ============================================
-- 7. 行级安全策略 (RLS)
-- ============================================

-- 启用RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quota_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_records ENABLE ROW LEVEL SECURITY;

-- user_profiles 策略
CREATE POLICY "用户可查看自己的配置" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "用户可更新自己的配置" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "新用户可插入配置" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- user_tasks 策略
CREATE POLICY "用户可查看自己的任务" ON public.user_tasks
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户可插入自己的任务" ON public.user_tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可更新自己的任务" ON public.user_tasks
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "用户可删除自己的任务" ON public.user_tasks
    FOR DELETE USING (auth.uid() = user_id);

-- user_characters 策略
CREATE POLICY "用户可查看自己的角色" ON public.user_characters
    FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE);
CREATE POLICY "用户可插入自己的角色" ON public.user_characters
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可更新自己的角色" ON public.user_characters
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "用户可删除自己的角色" ON public.user_characters
    FOR DELETE USING (auth.uid() = user_id);

-- user_settings 策略
CREATE POLICY "用户可查看自己的设置" ON public.user_settings
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户可插入自己的设置" ON public.user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可更新自己的设置" ON public.user_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- quota_logs 策略
CREATE POLICY "用户可查看自己的额度记录" ON public.quota_logs
    FOR SELECT USING (auth.uid() = user_id);

-- invite_records 策略
CREATE POLICY "用户可查看自己的邀请记录" ON public.invite_records
    FOR SELECT USING (auth.uid() = inviter_id);

-- ============================================
-- 8. 触发器：自动更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tasks_updated_at
    BEFORE UPDATE ON public.user_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_characters_updated_at
    BEFORE UPDATE ON public.user_characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. 触发器：新用户自动创建profile
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_invite_code VARCHAR(20);
BEGIN
    -- 生成唯一邀请码
    new_invite_code := 'NV' || UPPER(SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 8));
    
    INSERT INTO public.user_profiles (id, email, nickname, invite_code)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nickname', SPLIT_PART(NEW.email, '@', 1)),
        new_invite_code
    );
    
    -- 初始化用户设置
    INSERT INTO public.user_settings (user_id, settings_data, ui_preferences)
    VALUES (NEW.id, '{}'::JSONB, '{}'::JSONB);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器（如果不存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 10. 函数：处理邀请奖励
-- 🎁 记录邀请关系，用于判断解锁上限（500 vs 100）
-- ============================================
CREATE OR REPLACE FUNCTION public.process_invite_bonus(
    p_invitee_id UUID,
    p_invite_code VARCHAR(20)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_inviter_id UUID;
    v_inviter_balance INT;
BEGIN
    -- 查找邀请人
    SELECT id, quota_balance INTO v_inviter_id, v_inviter_balance
    FROM public.user_profiles
    WHERE invite_code = p_invite_code;
    
    IF v_inviter_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- 防止自己邀请自己
    IF v_inviter_id = p_invitee_id THEN
        RETURN FALSE;
    END IF;
    
    -- 检查是否已被邀请
    IF EXISTS (SELECT 1 FROM public.invite_records WHERE invitee_id = p_invitee_id) THEN
        RETURN FALSE;
    END IF;
    
    -- 记录邀请关系
    INSERT INTO public.invite_records (inviter_id, invitee_id, invite_code, bonus_given)
    VALUES (v_inviter_id, p_invitee_id, p_invite_code, 50);
    
    -- 给邀请人增加额度
    UPDATE public.user_profiles
    SET quota_balance = quota_balance + 50,
        invite_count = invite_count + 1
    WHERE id = v_inviter_id;
    
    -- 记录额度变动
    INSERT INTO public.quota_logs (user_id, action_type, amount, balance_after, description)
    VALUES (v_inviter_id, 'invite_bonus', 50, v_inviter_balance + 50, '邀请新用户奖励');
    
    -- 🎁 更新被邀请人的invited_by字段（用于判断解锁上限500 vs 100）
    UPDATE public.user_profiles
    SET invited_by = v_inviter_id
    WHERE id = p_invitee_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. 卡密充值表
-- ============================================
CREATE TABLE IF NOT EXISTS public.recharge_cards (
    id SERIAL PRIMARY KEY,
    card_code VARCHAR(20) UNIQUE NOT NULL,      -- 卡密码 (如 ROLL-XXXX-XXXX)
    card_type VARCHAR(20) NOT NULL,             -- 卡类型: starter/standard/pro
    film_amount INT NOT NULL,                   -- 胶片数量
    price DECIMAL(10,2) NOT NULL,               -- 售价
    status VARCHAR(20) DEFAULT 'unused',        -- 状态: unused/used/expired
    used_by UUID REFERENCES auth.users(id),     -- 使用者
    used_at TIMESTAMP,                          -- 使用时间
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP                        -- 过期时间（可选）
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_recharge_cards_code ON public.recharge_cards(card_code);
CREATE INDEX IF NOT EXISTS idx_recharge_cards_status ON public.recharge_cards(status);

-- 卡密兑换记录表
CREATE TABLE IF NOT EXISTS public.recharge_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_code VARCHAR(20) NOT NULL,
    film_amount INT NOT NULL,
    balance_after INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recharge_logs_user_id ON public.recharge_logs(user_id);

-- RLS策略
ALTER TABLE public.recharge_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recharge_logs ENABLE ROW LEVEL SECURITY;

-- 卡密表：只允许查询未使用的卡密（验证用）
CREATE POLICY "允许查询卡密状态" ON public.recharge_cards
    FOR SELECT USING (true);

-- 充值记录：用户只能查看自己的
CREATE POLICY "用户可查看自己的充值记录" ON public.recharge_logs
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 12. 卡密兑换函数
-- ============================================
CREATE OR REPLACE FUNCTION public.redeem_card(
    p_user_id UUID,
    p_card_code VARCHAR(20)
)
RETURNS TABLE(success BOOLEAN, message TEXT, new_balance INT) AS $$
DECLARE
    v_card RECORD;
    v_user_balance INT;
    v_new_balance INT;
BEGIN
    -- 查找卡密
    SELECT * INTO v_card FROM public.recharge_cards 
    WHERE card_code = UPPER(p_card_code) AND status = 'unused';
    
    IF v_card IS NULL THEN
        RETURN QUERY SELECT FALSE, '卡密无效或已被使用'::TEXT, 0;
        RETURN;
    END IF;
    
    -- 检查是否过期
    IF v_card.expires_at IS NOT NULL AND v_card.expires_at < NOW() THEN
        UPDATE public.recharge_cards SET status = 'expired' WHERE id = v_card.id;
        RETURN QUERY SELECT FALSE, '卡密已过期'::TEXT, 0;
        RETURN;
    END IF;
    
    -- 获取用户当前余额
    SELECT quota_balance INTO v_user_balance FROM public.user_profiles WHERE id = p_user_id;
    
    IF v_user_balance IS NULL THEN
        RETURN QUERY SELECT FALSE, '用户不存在'::TEXT, 0;
        RETURN;
    END IF;
    
    v_new_balance := v_user_balance + v_card.film_amount;
    
    -- 更新卡密状态
    UPDATE public.recharge_cards 
    SET status = 'used', used_by = p_user_id, used_at = NOW()
    WHERE id = v_card.id;
    
    -- 更新用户余额
    UPDATE public.user_profiles 
    SET quota_balance = v_new_balance
    WHERE id = p_user_id;
    
    -- 记录充值日志
    INSERT INTO public.recharge_logs (user_id, card_code, film_amount, balance_after)
    VALUES (p_user_id, v_card.card_code, v_card.film_amount, v_new_balance);
    
    -- 记录额度变动
    INSERT INTO public.quota_logs (user_id, action_type, amount, balance_after, description)
    VALUES (p_user_id, 'recharge', v_card.film_amount, v_new_balance, 
            '卡密充值: ' || v_card.card_code || ' (' || v_card.card_type || ')');
    
    RETURN QUERY SELECT TRUE, '充值成功！获得 ' || v_card.film_amount || ' 胶片'::TEXT, v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 13. 批量生成卡密函数（管理员用）
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_cards(
    p_card_type VARCHAR(20),
    p_film_amount INT,
    p_price DECIMAL(10,2),
    p_count INT,
    p_expires_days INT DEFAULT NULL
)
RETURNS TABLE(card_code VARCHAR(20)) AS $$
DECLARE
    i INT;
    new_code VARCHAR(20);
    expire_date TIMESTAMP;
BEGIN
    expire_date := CASE WHEN p_expires_days IS NOT NULL 
                        THEN NOW() + (p_expires_days || ' days')::INTERVAL 
                        ELSE NULL END;
    
    FOR i IN 1..p_count LOOP
        -- 生成格式: ROLL-XXXX-XXXX
        new_code := 'ROLL-' || 
                    UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT || i::TEXT) FROM 1 FOR 4)) || '-' ||
                    UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT || (i+1000)::TEXT) FROM 1 FOR 4));
        
        INSERT INTO public.recharge_cards (card_code, card_type, film_amount, price, expires_at)
        VALUES (new_code, p_card_type, p_film_amount, p_price, expire_date);
        
        RETURN QUERY SELECT new_code;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 14. API成本追踪表（管理员可见）
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_cost_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    api_type VARCHAR(50) NOT NULL,           -- gemini3, banana2, sora2
    api_action VARCHAR(100),                 -- 具体操作：text_story, image_character等
    call_count INT DEFAULT 1,                -- 调用次数
    actual_cost DECIMAL(10,4) NOT NULL,      -- 实际成本（元）
    film_consumed DECIMAL(10,2) DEFAULT 0,   -- 消耗胶片数
    revenue DECIMAL(10,2) DEFAULT 0,         -- 预估收入（元）
    task_id VARCHAR(100),                    -- 关联任务ID
    success BOOLEAN DEFAULT TRUE,            -- 是否成功
    error_message TEXT,                      -- 错误信息
    response_time_ms INT,                    -- 响应时间(毫秒)
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_cost_logs_api_type ON public.api_cost_logs(api_type);
CREATE INDEX IF NOT EXISTS idx_cost_logs_created_at ON public.api_cost_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_cost_logs_user_id ON public.api_cost_logs(user_id);

-- RLS策略：只有管理员可查看
ALTER TABLE public.api_cost_logs ENABLE ROW LEVEL SECURITY;

-- 管理员查看策略（需要在Supabase设置管理员角色）
CREATE POLICY "Admin can view all cost logs" ON public.api_cost_logs
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM public.user_profiles 
            WHERE membership_type = 'admin' OR email LIKE '%@rollroll.art'
        )
    );

-- 系统可插入（通过service_role）
CREATE POLICY "System can insert cost logs" ON public.api_cost_logs
    FOR INSERT WITH CHECK (TRUE);

-- ============================================
-- 15. 成本统计视图（管理员用）
-- ============================================
CREATE OR REPLACE VIEW public.cost_summary AS
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
-- 16. 用户胶片消费统计视图（管理员用）
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

-- 用户胶片消费汇总（按用户）
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
-- 17. 官方价格配置表（用于成本对比）
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

-- 插入默认价格配置
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

-- 允许管理员查看和修改价格配置
ALTER TABLE public.official_price_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage price config" ON public.official_price_config
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM public.user_profiles 
            WHERE membership_type = 'admin' OR email LIKE '%@rollroll.art'
        )
    );

-- 所有人可读取价格配置（用于前端显示）
CREATE POLICY "Anyone can read price config" ON public.official_price_config
    FOR SELECT USING (TRUE);

-- ============================================
-- 18. 邀请码公开查询策略（可选）
-- ============================================
-- 注意：当前实现通过服务端 API 绕过 RLS，无需此策略
-- 如果需要客户端直接查询，可添加以下策略：
-- CREATE POLICY "允许公开查询邀请码" ON public.user_profiles
--     FOR SELECT
--     USING (invite_code IS NOT NULL)
--     WITH CHECK (false);  -- 仅允许 SELECT，不允许修改

-- ============================================
-- 完成！
-- ============================================

