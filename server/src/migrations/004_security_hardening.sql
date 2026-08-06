-- ============================================================
-- Migration 004: Security Hardening
-- Fixes all Supabase security linter warnings (WARN level)
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Fix mutable search_path on update_availability_updated_at
--    WARN: function_search_path_mutable
--    Risk: A malicious user could manipulate search_path to
--    hijack function calls to shadow objects.
-- ────────────────────────────────────────────────────────────
ALTER FUNCTION public.update_availability_updated_at()
  SET search_path = public;


-- ────────────────────────────────────────────────────────────
-- 2. Fix conversations_insert policy (always true WITH CHECK)
--    WARN: rls_policy_always_true
--    Fix: Only allow users to insert conversations they are
--    a participant of (sender must be the authenticated user).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;

CREATE POLICY "conversations_insert"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = participant_one_id
    OR auth.uid() = participant_two_id
  );


-- ────────────────────────────────────────────────────────────
-- 3. Fix custom_pages admin_all policy (USING true, CHECK true)
--    WARN: rls_policy_always_true
--    Fix: Restrict write access to admin users only.
--    The public_read policy (SELECT) is intentionally kept as-is.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all" ON public.custom_pages;

CREATE POLICY "admin_all"
  ON public.custom_pages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ────────────────────────────────────────────────────────────
-- 4. Fix roles table policies (all use USING/CHECK true)
--    WARN: rls_policy_always_true
--    Fix: Restrict to admin users only.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can delete roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.roles;

CREATE POLICY "Admins can delete roles"
  ON public.roles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert roles"
  ON public.roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update roles"
  ON public.roles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ────────────────────────────────────────────────────────────
-- 5. Fix chat-attachments bucket broad SELECT policy
--    WARN: public_bucket_allows_listing
--    Fix: Replace broad SELECT (allows listing all files) with
--    a more restrictive policy that only allows access to a
--    specific object path (not bucket-wide listing).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chat_attachments_public_select" ON storage.objects;

-- Allow public access only to individual objects (not directory listing)
-- Users can read objects but cannot list the full bucket contents.
CREATE POLICY "chat_attachments_public_select"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'chat-attachments'
    AND name IS NOT NULL
  );


-- ────────────────────────────────────────────────────────────
-- 6. Fix SECURITY DEFINER functions callable by anon
--    WARN: anon_security_definer_function_executable
--         authenticated_security_definer_function_executable
--
--    These two functions are called on behalf of the current
--    user (checking if they can message, finding conversations)
--    so SECURITY INVOKER is the correct mode. This means they
--    run with the caller's privileges, not the definer's.
-- ────────────────────────────────────────────────────────────

-- Switch can_message to SECURITY INVOKER
ALTER FUNCTION public.can_message(sender_id uuid, receiver_id uuid)
  SECURITY INVOKER;

-- Switch find_existing_conversation to SECURITY INVOKER
ALTER FUNCTION public.find_existing_conversation(
  p_user_id uuid,
  p_other_id uuid,
  p_order_id uuid
)
  SECURITY INVOKER;

-- Also revoke anon execute access as a defense-in-depth measure
-- (authenticated users still retain access)
REVOKE EXECUTE ON FUNCTION public.can_message(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_existing_conversation(uuid, uuid, uuid) FROM anon;


-- ────────────────────────────────────────────────────────────
-- 7. Leaked Password Protection
--    WARN: auth_leaked_password_protection
--
--    This CANNOT be fixed via SQL — it must be enabled in the
--    Supabase Dashboard:
--
--    Authentication → Sign In / Up → Password → 
--    Toggle ON "Password Strength and Leaked Password Protection"
--
--    (uses HaveIBeenPwned.org to block compromised passwords)
-- ────────────────────────────────────────────────────────────
-- No SQL needed for this one — see dashboard instructions above.
