-- ─────────────────────────────────────────────────────────────
-- Migration 008: Address Fields
-- Adds country, city, address columns to profiles and organizations
-- ─────────────────────────────────────────────────────────────

-- Profiles: add structured address fields alongside existing location
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Organizations: add address fields
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Messages: add sender_name for display convenience
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sender_name TEXT;
