-- ─────────────────────────────────────────────────────────────
-- Migration 010: Academy Playground Workspaces
-- Each workspace maps 1:1 to a private GitHub repo created for
-- the student on their connected GitHub account.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playground_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  github_repo_name TEXT NOT NULL,
  github_repo_url TEXT NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  last_opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playground_workspaces_user ON playground_workspaces(user_id, last_opened_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_playground_workspaces_course ON playground_workspaces(course_id);
CREATE INDEX IF NOT EXISTS idx_playground_workspaces_lesson ON playground_workspaces(lesson_id);

ALTER TABLE playground_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select_own playground workspaces" ON playground_workspaces;
CREATE POLICY "Users can select_own playground workspaces" ON playground_workspaces
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert_own playground workspaces" ON playground_workspaces;
CREATE POLICY "Users can insert_own playground workspaces" ON playground_workspaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update_own playground workspaces" ON playground_workspaces;
CREATE POLICY "Users can update_own playground workspaces" ON playground_workspaces
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete_own playground workspaces" ON playground_workspaces;
CREATE POLICY "Users can delete_own playground workspaces" ON playground_workspaces
  FOR DELETE USING (auth.uid() = user_id);