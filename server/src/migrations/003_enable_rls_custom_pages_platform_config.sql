-- ============================================================
-- Migration 003: Enable RLS on custom_pages & platform_config
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. custom_pages
--    Already has policies (admin_all, public_read) but RLS
--    is not enabled. Simply enabling it activates them.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.custom_pages ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 2. platform_config
--    No policies exist yet. This table is only accessed by the
--    backend server using the service_role key (which bypasses
--    RLS), so we enable RLS and add a deny-all public policy
--    to block any direct anonymous/authenticated client access.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- Deny all public access (server uses service_role which bypasses RLS)
-- Drop any existing policies first to avoid conflicts
DROP POLICY IF EXISTS "platform_config_deny_public" ON public.platform_config;

CREATE POLICY "platform_config_deny_public"
  ON public.platform_config
  FOR ALL
  TO anon, authenticated
  USING (false);
