-- ─────────────────────────────────────────────────────────────
-- Migration 009: GitHub OAuth Connections
-- Stores a single encrypted GitHub access token per user.
-- Used by the Academy Playground to create and open private
-- study repositories on the student's own GitHub account.
-- ─────────────────────────────────────────────────────────────

-- GitHub connection per user (one per user — upserted on oauth callback)
CREATE TABLE IF NOT EXISTS github_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  github_id BIGINT,
  github_login TEXT,
  github_avatar_url TEXT,
  github_url TEXT,
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_github_connections_user ON github_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_github_connections_github_id ON github_connections(github_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_github_connections_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_github_connections_updated ON github_connections;
CREATE TRIGGER trg_github_connections_updated
  BEFORE UPDATE ON github_connections
  FOR EACH ROW EXECUTE FUNCTION update_github_connections_timestamp();

-- RLS: users can only access their own connection
ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read_own github connection" ON github_connections;
CREATE POLICY "Users can read_own github connection" ON github_connections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert_own github connection" ON github_connections;
CREATE POLICY "Users can insert_own github connection" ON github_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update_own github connection" ON github_connections;
CREATE POLICY "Users can update_own github connection" ON github_connections
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete_own github connection" ON github_connections;
CREATE POLICY "Users can delete_own github connection" ON github_connections
  FOR DELETE USING (auth.uid() = user_id);