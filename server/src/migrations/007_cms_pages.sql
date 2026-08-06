-- ─────────────────────────────────────────────────────────────
-- Migration 007: CMS Pages
-- Adds a pages table for WYSIWYG-editable static/content pages
-- Plus makes profiles.is_admin available for admin gating
-- ─────────────────────────────────────────────────────────────

-- 1. Add is_admin flag to profiles (if not already present)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Create pages table
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages (slug);
CREATE INDEX IF NOT EXISTS idx_pages_status ON pages (status);

-- 4. Enable RLS
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- 5. RLS: Anyone (including anon) can read published pages
CREATE POLICY "Anyone can read published pages"
  ON pages
  FOR SELECT
  USING (status = 'published');

-- 6. RLS: Admins can read all pages (including drafts)
CREATE POLICY "Admins can read all pages"
  ON pages
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 7. RLS: Admins can insert pages
CREATE POLICY "Admins can insert pages"
  ON pages
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 8. RLS: Admins can update any page
CREATE POLICY "Admins can update pages"
  ON pages
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 9. RLS: Admins can delete non-system pages
CREATE POLICY "Admins can delete non-system pages"
  ON pages
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND is_system = false
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 10. Seed the 8 footer pages (matching current dead footer links)
INSERT INTO pages (slug, title, content_html, status, is_system) VALUES
  ('web-development', 'Web Development', '<h2>Web Development</h2><p>Content coming soon.</p>', 'draft', true),
  ('data-science', 'Data Science', '<h2>Data Science</h2><p>Content coming soon.</p>', 'draft', true),
  ('ui-ux-design', 'UI/UX Design', '<h2>UI/UX Design</h2><p>Content coming soon.</p>', 'draft', true),
  ('cloud-computing', 'Cloud Computing', '<h2>Cloud Computing</h2><p>Content coming soon.</p>', 'draft', true),
  ('mentorship', 'Mentorship', '<h2>Mentorship</h2><p>Content coming soon.</p>', 'draft', true),
  ('events', 'Events', '<h2>Events</h2><p>Content coming soon.</p>', 'draft', true),
  ('success-stories', 'Success Stories', '<h2>Success Stories</h2><p>Content coming soon.</p>', 'draft', true),
  ('partner-with-us', 'Partner With Us', '<h2>Partner With Us</h2><p>Content coming soon.</p>', 'draft', true)
ON CONFLICT (slug) DO NOTHING;
