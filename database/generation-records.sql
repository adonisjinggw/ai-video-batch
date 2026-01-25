-- 生成记录表：保存所有成功生成的内容
-- 用于解决"后端成功但前端报错导致退款"的成本损耗问题

CREATE TABLE IF NOT EXISTS generation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type VARCHAR(50) NOT NULL,  -- 'image', 'music', 'video', 'text'
  content_url TEXT,  -- 图片/视频/音频URL
  content_text TEXT,  -- 文本内容（用于写作等）
  prompt TEXT,  -- 用户输入的提示词
  model VARCHAR(100),  -- 使用的模型
  cost INTEGER NOT NULL DEFAULT 0,  -- 消耗的胶片
  metadata JSONB,  -- 额外信息（如尺寸、时长等）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- 索引：按用户和时间查询
CREATE INDEX IF NOT EXISTS idx_generation_records_user_time 
ON generation_records(user_id, created_at DESC);

-- 索引：按类型筛选
CREATE INDEX IF NOT EXISTS idx_generation_records_type 
ON generation_records(user_id, record_type, created_at DESC);

-- 索引：清理过期记录
CREATE INDEX IF NOT EXISTS idx_generation_records_expires 
ON generation_records(expires_at);

-- RLS 策略：用户只能查看自己的记录
ALTER TABLE generation_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own records" ON generation_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert records" ON generation_records
  FOR INSERT WITH CHECK (true);

-- 注释
COMMENT ON TABLE generation_records IS '生成记录表，保存所有成功生成的内容';
COMMENT ON COLUMN generation_records.record_type IS '记录类型: image, music, video, text';
COMMENT ON COLUMN generation_records.content_url IS '内容URL（图片/视频/音频）';
COMMENT ON COLUMN generation_records.content_text IS '文本内容（用于写作等）';
COMMENT ON COLUMN generation_records.cost IS '消耗的胶片数量';
COMMENT ON COLUMN generation_records.expires_at IS '过期时间，默认7天后';
