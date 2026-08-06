// ============================================================
// Frontend shared constants for B2B/B2A module
// Single source of truth — mirrors supabase/functions/_shared/constants.ts
// ============================================================

// ── Org Roles ──

export const ORG_ROLES = ["owner", "admin", "manager", "member", "viewer"] as const;
export const ORG_ADMIN_ROLES: readonly string[] = ["owner", "admin"];
export const ORG_MANAGER_ROLES: readonly string[] = ["owner", "admin", "manager"];
export const INVITE_ROLES = ["admin", "manager", "member", "viewer"] as const;

// ── Application / Pipeline ──

export const APPLICATION_STATUSES = ["pending", "reviewed", "interviewed", "offer", "accepted", "rejected"] as const;

// ── Contracts ──

export const CONTRACT_STATUSES = ["draft", "sent", "signed", "active", "completed", "cancelled"] as const;
export const CONTRACT_TYPES = ["msa", "sow", "fixed_price", "milestone_based"] as const;

export const CONTRACT_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["sent", "cancelled"],
  sent: ["signed", "cancelled"],
  signed: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const MILESTONE_STATUSES = ["pending", "in_progress", "submitted", "approved", "rejected"] as const;

// ── Billing ──

export const BILLING_CYCLES = ["monthly", "yearly"] as const;

// ── Compliance ──

export const REPORT_TYPES = ["verification", "activity", "contracts", "custom"] as const;

// ── Status Label Maps ──

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  signed: 'Signed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  msa: 'MSA',
  sow: 'SOW',
  fixed_price: 'Fixed Price',
  milestone_based: 'Milestone-Based',
};

export const MILESTONE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  reviewed: 'Reviewed',
  interviewed: 'Interviewed',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export const ORG_ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
  viewer: 'Viewer',
};

// ── Status Colors ──

export const CONTRACT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-purple-100 text-purple-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
};

export const APPLICATION_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  reviewed: 'bg-blue-100 text-blue-700',
  interviewed: 'bg-purple-100 text-purple-700',
  offer: 'bg-orange-100 text-orange-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};

// ── Org verification status ──

export const VERIFICATION_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  not_submitted: { color: 'bg-gray-100 text-gray-600', label: 'Not Submitted' },
  pending: { color: 'bg-yellow-100 text-yellow-700', label: 'Pending Review' },
  verified: { color: 'bg-green-100 text-green-700', label: 'Verified' },
  rejected: { color: 'bg-red-100 text-red-600', label: 'Rejected' },
};
