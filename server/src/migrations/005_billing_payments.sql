-- ─────────────────────────────────────────────────────────────
-- Migration 005: Billing Payments
-- Adds payment tracking for subscription plan purchases
-- Supports: auto-approved gateway payments, manual offline payments
-- ─────────────────────────────────────────────────────────────

-- Billing payments table
CREATE TABLE IF NOT EXISTS billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('gateway', 'offline')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  proof_url TEXT,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for org listing
CREATE INDEX IF NOT EXISTS idx_billing_payments_org ON billing_payments(org_id, created_at DESC);
-- Index for admin queue
CREATE INDEX IF NOT EXISTS idx_billing_payments_status ON billing_payments(status, created_at DESC);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_billing_payments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_billing_payments_updated ON billing_payments;
CREATE TRIGGER trg_billing_payments_updated
  BEFORE UPDATE ON billing_payments
  FOR EACH ROW EXECUTE FUNCTION update_billing_payments_timestamp();
