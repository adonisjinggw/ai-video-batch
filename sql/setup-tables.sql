-- ============================================================
-- RollRoll AI - Supabase 建表 SQL
-- 在 Supabase Dashboard → SQL Editor 中执行
-- 包含: 写作系统 5 张表 + 用户记忆 1 张表
-- ============================================================

-- 1. 写作项目表
CREATE TABLE IF NOT EXISTS writing_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  project_type TEXT NOT NULL DEFAULT 'novel',
  meta JSONB DEFAULT '{}'::jsonb,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writing_projects_owner ON writing_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_writing_projects_updated ON writing_projects(updated_at DESC);

-- 2. 写作章节表
CREATE TABLE IF NOT EXISTS writing_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES writing_projects(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  summary TEXT DEFAULT '',
  key_events TEXT[] DEFAULT '{}',
  word_count INT DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  last_editor TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writing_chapters_project ON writing_chapters(project_id);
CREATE INDEX IF NOT EXISTS idx_writing_chapters_order ON writing_chapters(project_id, order_index);

-- 3. 写作快照表（版本历史）
CREATE TABLE IF NOT EXISTS writing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES writing_chapters(id) ON DELETE CASCADE,
  version INT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writing_snapshots_chapter ON writing_snapshots(chapter_id, version DESC);

-- 4. 写作协作者表
CREATE TABLE IF NOT EXISTS writing_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES writing_projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  invited_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_writing_collaborators_user ON writing_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_writing_collaborators_project ON writing_collaborators(project_id);

-- 5. 写作邀请令牌表
CREATE TABLE IF NOT EXISTS writing_invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES writing_projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor',
  created_by TEXT,
  used_by TEXT,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writing_invite_tokens_token ON writing_invite_tokens(token);

-- 6. 用户记忆表（偏好 + 跨会话记忆）
CREATE TABLE IF NOT EXISTS user_memory (
  user_id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 自动更新 updated_at 触发器
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- writing_projects
DROP TRIGGER IF EXISTS trg_writing_projects_updated ON writing_projects;
CREATE TRIGGER trg_writing_projects_updated
  BEFORE UPDATE ON writing_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- writing_chapters
DROP TRIGGER IF EXISTS trg_writing_chapters_updated ON writing_chapters;
CREATE TRIGGER trg_writing_chapters_updated
  BEFORE UPDATE ON writing_chapters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- user_memory
DROP TRIGGER IF EXISTS trg_user_memory_updated ON user_memory;
CREATE TRIGGER trg_user_memory_updated
  BEFORE UPDATE ON user_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
