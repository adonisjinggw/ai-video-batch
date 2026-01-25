CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.writing_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    project_type TEXT NOT NULL DEFAULT 'novel',
    meta JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_writing_projects_owner_id ON public.writing_projects(owner_id);

CREATE TABLE IF NOT EXISTS public.writing_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.writing_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'editor',
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_writing_collaborators_project_id ON public.writing_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_writing_collaborators_user_id ON public.writing_collaborators(user_id);

CREATE TABLE IF NOT EXISTS public.writing_chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.writing_projects(id) ON DELETE CASCADE,
    order_index INT NOT NULL DEFAULT 0,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    version INT NOT NULL DEFAULT 1,
    last_editor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_writing_chapters_project_id ON public.writing_chapters(project_id);

CREATE TABLE IF NOT EXISTS public.writing_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES public.writing_chapters(id) ON DELETE CASCADE,
    version INT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_writing_snapshots_chapter_id ON public.writing_snapshots(chapter_id);

CREATE TABLE IF NOT EXISTS public.writing_invite_tokens (
    token TEXT PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.writing_projects(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'editor',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_writing_invite_tokens_project_id ON public.writing_invite_tokens(project_id);
CREATE INDEX IF NOT EXISTS idx_writing_invite_tokens_expires_at ON public.writing_invite_tokens(expires_at);

ALTER TABLE public.writing_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writing_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writing_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writing_invite_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "writing_projects_select" ON public.writing_projects;
DROP POLICY IF EXISTS "writing_projects_insert" ON public.writing_projects;
DROP POLICY IF EXISTS "writing_projects_update" ON public.writing_projects;
DROP POLICY IF EXISTS "writing_projects_delete" ON public.writing_projects;

CREATE POLICY "writing_projects_select" ON public.writing_projects
    FOR SELECT USING (
        auth.uid() = owner_id
        OR EXISTS (
            SELECT 1 FROM public.writing_collaborators c
            WHERE c.project_id = writing_projects.id
              AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "writing_projects_insert" ON public.writing_projects
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "writing_projects_update" ON public.writing_projects
    FOR UPDATE USING (
        auth.uid() = owner_id
        OR EXISTS (
            SELECT 1 FROM public.writing_collaborators c
            WHERE c.project_id = writing_projects.id
              AND c.user_id = auth.uid()
              AND c.role IN ('owner','editor')
        )
    );

CREATE POLICY "writing_projects_delete" ON public.writing_projects
    FOR DELETE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "writing_collaborators_select" ON public.writing_collaborators;
DROP POLICY IF EXISTS "writing_collaborators_insert" ON public.writing_collaborators;
DROP POLICY IF EXISTS "writing_collaborators_update" ON public.writing_collaborators;
DROP POLICY IF EXISTS "writing_collaborators_delete" ON public.writing_collaborators;

CREATE POLICY "writing_collaborators_select" ON public.writing_collaborators
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.writing_projects p
            WHERE p.id = writing_collaborators.project_id
              AND (
                  p.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.writing_collaborators c
                      WHERE c.project_id = p.id
                        AND c.user_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY "writing_collaborators_insert" ON public.writing_collaborators
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.writing_projects p
            WHERE p.id = writing_collaborators.project_id
              AND p.owner_id = auth.uid()
        )
    );

CREATE POLICY "writing_collaborators_update" ON public.writing_collaborators
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.writing_projects p
            WHERE p.id = writing_collaborators.project_id
              AND p.owner_id = auth.uid()
        )
    );

CREATE POLICY "writing_collaborators_delete" ON public.writing_collaborators
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.writing_projects p
            WHERE p.id = writing_collaborators.project_id
              AND p.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "writing_chapters_select" ON public.writing_chapters;
DROP POLICY IF EXISTS "writing_chapters_insert" ON public.writing_chapters;
DROP POLICY IF EXISTS "writing_chapters_update" ON public.writing_chapters;
DROP POLICY IF EXISTS "writing_chapters_delete" ON public.writing_chapters;

CREATE POLICY "writing_chapters_select" ON public.writing_chapters
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.writing_projects p
            WHERE p.id = writing_chapters.project_id
              AND (
                  p.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.writing_collaborators c
                      WHERE c.project_id = p.id
                        AND c.user_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY "writing_chapters_insert" ON public.writing_chapters
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.writing_projects p
            WHERE p.id = writing_chapters.project_id
              AND (
                  p.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.writing_collaborators c
                      WHERE c.project_id = p.id
                        AND c.user_id = auth.uid()
                        AND c.role IN ('owner','editor')
                  )
              )
        )
    );

CREATE POLICY "writing_chapters_update" ON public.writing_chapters
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.writing_projects p
            WHERE p.id = writing_chapters.project_id
              AND (
                  p.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.writing_collaborators c
                      WHERE c.project_id = p.id
                        AND c.user_id = auth.uid()
                        AND c.role IN ('owner','editor')
                  )
              )
        )
    );

CREATE POLICY "writing_chapters_delete" ON public.writing_chapters
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.writing_projects p
            WHERE p.id = writing_chapters.project_id
              AND (
                  p.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.writing_collaborators c
                      WHERE c.project_id = p.id
                        AND c.user_id = auth.uid()
                        AND c.role IN ('owner','editor')
                  )
              )
        )
    );

DROP POLICY IF EXISTS "writing_snapshots_select" ON public.writing_snapshots;
DROP POLICY IF EXISTS "writing_snapshots_insert" ON public.writing_snapshots;
DROP POLICY IF EXISTS "writing_snapshots_delete" ON public.writing_snapshots;

CREATE POLICY "writing_snapshots_select" ON public.writing_snapshots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.writing_chapters ch
            JOIN public.writing_projects p ON p.id = ch.project_id
            WHERE ch.id = writing_snapshots.chapter_id
              AND (
                  p.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.writing_collaborators c
                      WHERE c.project_id = p.id
                        AND c.user_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY "writing_snapshots_insert" ON public.writing_snapshots
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.writing_chapters ch
            JOIN public.writing_projects p ON p.id = ch.project_id
            WHERE ch.id = writing_snapshots.chapter_id
              AND (
                  p.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.writing_collaborators c
                      WHERE c.project_id = p.id
                        AND c.user_id = auth.uid()
                        AND c.role IN ('owner','editor')
                  )
              )
        )
    );

CREATE POLICY "writing_snapshots_delete" ON public.writing_snapshots
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.writing_chapters ch
            JOIN public.writing_projects p ON p.id = ch.project_id
            WHERE ch.id = writing_snapshots.chapter_id
              AND p.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "writing_invite_tokens_select" ON public.writing_invite_tokens;
DROP POLICY IF EXISTS "writing_invite_tokens_insert" ON public.writing_invite_tokens;
DROP POLICY IF EXISTS "writing_invite_tokens_update" ON public.writing_invite_tokens;
DROP POLICY IF EXISTS "writing_invite_tokens_delete" ON public.writing_invite_tokens;

CREATE POLICY "writing_invite_tokens_select" ON public.writing_invite_tokens
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.writing_projects p
            WHERE p.id = writing_invite_tokens.project_id
              AND (
                  p.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.writing_collaborators c
                      WHERE c.project_id = p.id
                        AND c.user_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY "writing_invite_tokens_insert" ON public.writing_invite_tokens
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.writing_projects p
            WHERE p.id = writing_invite_tokens.project_id
              AND (
                  p.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.writing_collaborators c
                      WHERE c.project_id = p.id
                        AND c.user_id = auth.uid()
                        AND c.role IN ('owner','editor')
                  )
              )
        )
    );

CREATE POLICY "writing_invite_tokens_update" ON public.writing_invite_tokens
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.writing_projects p
            WHERE p.id = writing_invite_tokens.project_id
              AND p.owner_id = auth.uid()
        )
    );

CREATE POLICY "writing_invite_tokens_delete" ON public.writing_invite_tokens
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.writing_projects p
            WHERE p.id = writing_invite_tokens.project_id
              AND p.owner_id = auth.uid()
        )
    );

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name = 'update_updated_at_column'
    ) THEN
        DROP TRIGGER IF EXISTS update_writing_projects_updated_at ON public.writing_projects;
        CREATE TRIGGER update_writing_projects_updated_at
            BEFORE UPDATE ON public.writing_projects
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

        DROP TRIGGER IF EXISTS update_writing_chapters_updated_at ON public.writing_chapters;
        CREATE TRIGGER update_writing_chapters_updated_at
            BEFORE UPDATE ON public.writing_chapters
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END
$$;

-- ================= Storage bucket (export) =================
-- 用于 writingExportUpload（导出 MD/TXT -> Storage -> 7天 signed url）
-- 需要在 Supabase SQL Editor 以有权限的角色执行
INSERT INTO storage.buckets (id, name, public)
VALUES ('writing-exports', 'writing-exports', false)
ON CONFLICT (id) DO NOTHING;
