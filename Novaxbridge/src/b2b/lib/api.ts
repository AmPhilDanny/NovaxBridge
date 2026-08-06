// ============================================================
// B2B API Client — calls the Express API server (/api/b2b)
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import type {
  Organization,
  OrgMember,
  OrgInvite,
  SubscriptionStatus,
  UserOrgInfo,
  OrgMemberRole,
} from '../b2b-types';

export type B2bErrorType = 'NETWORK_ERROR' | 'AUTH_ERROR' | 'SERVER_ERROR' | 'NOT_FOUND' | 'UNKNOWN';

export class B2BApiError extends Error {
  readonly type: B2bErrorType;
  readonly status: number | null;

  constructor(type: B2bErrorType, message: string, status: number | null = null) {
    super(message);
    this.name = 'B2BApiError';
    this.type = type;
    this.status = status;
  }

  get userMessage(): string {
    switch (this.type) {
      case 'NETWORK_ERROR':
        return 'Unable to reach the server. Check your internet connection and try again.';
      case 'AUTH_ERROR':
        return 'Your session has expired. Please sign in again.';
      case 'SERVER_ERROR':
        return 'The server encountered an error. Please try again later.';
      case 'NOT_FOUND':
        return 'The requested resource was not found.';
      default:
        return this.message || 'An unexpected error occurred.';
    }
  }

  get isUserError(): boolean {
    return false;
  }
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://dalastudioshowcase.onrender.com/api';

async function b2bFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;

  if (!session) {
    throw new B2BApiError('AUTH_ERROR', 'No active session');
  }

  const MAX_RETRIES = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: options?.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          ...(options?.headers as Record<string, string>),
        },
        body: options?.body || undefined,
        signal: options?.signal,
      });

      if (!res.ok) {
        switch (res.status) {
          case 401:
          case 403:
            throw new B2BApiError('AUTH_ERROR', `Access denied (${res.status})`, res.status);
          case 404:
            throw new B2BApiError('NOT_FOUND', 'Resource not found', res.status);
          case 500:
          case 502:
          case 503:
            if (attempt < MAX_RETRIES) {
              lastError = new B2BApiError('SERVER_ERROR', `Server error (${res.status})`, res.status);
              await sleep(1000 * (attempt + 1));
              continue;
            }
            throw new B2BApiError('SERVER_ERROR', `Server error (${res.status})`, res.status);
          default: {
            const body = await res.json().catch(() => ({ error: res.statusText }));
            throw new B2BApiError('SERVER_ERROR', body.error || `Request failed (${res.status})`, res.status);
          }
        }
      }

      return res.json();
    } catch (err) {
      if (err instanceof B2BApiError) throw err;
      // Don't retry if request was intentionally aborted
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      // NetworkError — retry with backoff
      if (attempt < MAX_RETRIES) {
        lastError = err instanceof Error ? err : new Error('Unknown network error');
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw new B2BApiError('NETWORK_ERROR', 'Failed to connect to the server');
    }
  }

  throw lastError || new B2BApiError('NETWORK_ERROR', 'Failed to connect to the server');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Org CRUD ──

export async function getMyOrg(): Promise<UserOrgInfo> {
  return b2bFetch<UserOrgInfo>('/b2b/org');
}

export interface CreateOrgInput {
  name: string;
  industry?: string;
  size?: string;
  description?: string;
  website_url?: string;
  country?: string;
  city?: string;
  address?: string;
}

export async function createOrg(input: CreateOrgInput): Promise<{ data: Organization }> {
  return b2bFetch<{ data: Organization }>('/b2b/org', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateOrg(updates: Partial<Organization>): Promise<{ data: Organization }> {
  return b2bFetch<{ data: Organization }>('/b2b/org', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// ── Members ──

export async function getOrgMembers(): Promise<{ data: OrgMember[] }> {
  return b2bFetch<{ data: OrgMember[] }>('/b2b/org/members');
}

export interface InviteMemberInput {
  email: string;
  role: Exclude<OrgMemberRole, 'owner'>;
  message?: string;
}

export async function inviteMember(input: InviteMemberInput): Promise<{ data: OrgInvite }> {
  return b2bFetch<{ data: OrgInvite }>('/b2b/org/members/invite', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function removeMember(memberId: string): Promise<{ success: boolean }> {
  return b2bFetch<{ success: boolean }>(`/b2b/org/members/${memberId}`, {
    method: 'DELETE',
  });
}

export async function changeMemberRole(memberId: string, role: string): Promise<{ data: OrgMember }> {
  return b2bFetch<{ data: OrgMember }>(`/b2b/org/members/${memberId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function getOrgInvites(): Promise<{ data: OrgInvite[] }> {
  return b2bFetch<{ data: OrgInvite[] }>('/b2b/org/invites');
}

export async function cancelInvite(inviteId: string): Promise<{ success: boolean }> {
  return b2bFetch<{ success: boolean }>(`/b2b/org/invites/${inviteId}`, {
    method: 'DELETE',
  });
}

// ── Subscription ──

export async function getSubscription(): Promise<SubscriptionStatus> {
  return b2bFetch<SubscriptionStatus>('/b2b/subscription');
}

export interface ChangeSubscriptionInput {
  plan_slug: string;
  billing_cycle: 'monthly' | 'yearly';
}

export async function changeSubscription(input: ChangeSubscriptionInput): Promise<{ data: Organization }> {
  return b2bFetch<{ data: Organization }>('/b2b/subscription/change', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ── Talent Search ──

export interface TalentSearchParams {
  q?: string;
  skills?: string;
  location?: string;
  availability?: string;
  limit?: number;
  offset?: number;
}

export interface TalentProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  location: string | null;
  skills: string[];
  availability: 'open_to_work' | 'open_to_collab' | 'not_available' | null;
  bio: string | null;
  created_at: string;
}

export async function searchTalent(params: TalentSearchParams): Promise<{ data: TalentProfile[]; count: number }> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set('q', params.q);
  if (params.skills) searchParams.set('skills', params.skills);
  if (params.location) searchParams.set('location', params.location);
  if (params.availability) searchParams.set('availability', params.availability);
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));

  return b2bFetch<{ data: TalentProfile[]; count: number }>(
    `/b2b/talent/search?${searchParams.toString()}`
  );
}

// ── Saved Searches ──

export interface SavedSearch {
  id: string;
  org_id: string;
  saved_by: string;
  name: string;
  filters: Record<string, unknown>;
  created_at: string;
}

export async function getSavedSearches(): Promise<{ data: SavedSearch[] }> {
  return b2bFetch<{ data: SavedSearch[] }>('/b2b/talent/saved-searches');
}

export async function saveSearch(name: string, filters: Record<string, unknown>): Promise<{ data: SavedSearch }> {
  return b2bFetch<{ data: SavedSearch }>('/b2b/talent/saved-searches', {
    method: 'POST',
    body: JSON.stringify({ name, filters }),
  });
}

export async function deleteSavedSearch(id: string): Promise<{ success: boolean }> {
  return b2bFetch<{ success: boolean }>(`/b2b/talent/saved-searches/${id}`, {
    method: 'DELETE',
  });
}

// ── Bulk Job Posting ──

export interface BulkJobInput {
  title: string;
  description: string;
  type: 'part-time' | 'internship';
  location?: string;
  salary_range?: string;
  requirements?: string;
  is_active?: boolean;
}

export interface BulkJobResult {
  success: boolean;
  job?: Record<string, unknown>;
  error?: string;
}

export async function postBulkJobs(jobs: BulkJobInput[]): Promise<{
  results: BulkJobResult[];
  total: number;
  succeeded: number;
  failed: number;
}> {
  return b2bFetch('/b2b/jobs/bulk', {
    method: 'POST',
    body: JSON.stringify({ jobs }),
  });
}

// ── Hiring Pipeline ──

export interface PipelineApplication {
  id: string;
  job_id: string;
  student_id: string;
  status: 'pending' | 'reviewed' | 'interviewed' | 'offer' | 'accepted' | 'rejected';
  cover_letter: string | null;
  resume_url: string | null;
  created_at: string;
  jobs: { id: string; title: string; type: string; location: string | null } | null;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    headline: string | null;
    skills: string[];
    location: string | null;
  } | null;
}

export async function getPipelineApplications(): Promise<{ data: PipelineApplication[] }> {
  return b2bFetch<{ data: PipelineApplication[] }>('/b2b/hiring/applications');
}

export async function updatePipelineStatus(applicationId: string, status: string): Promise<{ data: PipelineApplication }> {
  return b2bFetch<{ data: PipelineApplication }>(`/b2b/hiring/pipeline/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function bulkUpdatePipelineStatus(applicationIds: string[], status: string): Promise<{ data: PipelineApplication[]; count: number }> {
  return b2bFetch<{ data: PipelineApplication[]; count: number }>('/b2b/hiring/pipeline/bulk', {
    method: 'POST',
    body: JSON.stringify({ application_ids: applicationIds, status }),
  });
}

// ── Talent Lists ──

export interface TalentList {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  saved_talent?: { count: number }[];
  created_by_profile?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export interface SavedTalentEntry {
  id: string;
  list_id: string;
  talent_id: string;
  notes: string | null;
  saved_by: string;
  created_at: string;
  talent?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    headline: string | null;
    skills: string[];
    location: string | null;
    availability: string | null;
  } | null;
}

export async function getTalentLists(): Promise<{ data: TalentList[] }> {
  return b2bFetch<{ data: TalentList[] }>('/b2b/talent/lists');
}

export async function createTalentList(name: string, description?: string): Promise<{ data: TalentList }> {
  return b2bFetch<{ data: TalentList }>('/b2b/talent/lists', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function deleteTalentList(id: string): Promise<{ success: boolean }> {
  return b2bFetch<{ success: boolean }>(`/b2b/talent/lists/${id}`, {
    method: 'DELETE',
  });
}

export async function getListTalent(listId: string): Promise<{ data: SavedTalentEntry[] }> {
  return b2bFetch<{ data: SavedTalentEntry[] }>(`/b2b/talent/lists/${listId}/talent`);
}

export async function saveTalentToList(listId: string, talentId: string, notes?: string): Promise<{ data: SavedTalentEntry }> {
  return b2bFetch<{ data: SavedTalentEntry }>(`/b2b/talent/lists/${listId}/talent`, {
    method: 'POST',
    body: JSON.stringify({ talent_id: talentId, notes }),
  });
}

export async function removeTalentFromList(listId: string, talentId: string): Promise<{ success: boolean }> {
  return b2bFetch<{ success: boolean }>(`/b2b/talent/lists/${listId}/talent/${talentId}`, {
    method: 'DELETE',
  });
}

// ── Contracts ──

export interface Contract {
  id: string;
  org_id: string;
  talent_id: string;
  title: string;
  contract_type: 'msa' | 'sow' | 'fixed_price' | 'milestone_based';
  status: 'draft' | 'sent' | 'signed' | 'active' | 'completed' | 'cancelled';
  description: string | null;
  total_value: number;
  currency: string;
  terms: Record<string, unknown>;
  starts_at: string | null;
  ends_at: string | null;
  signed_by_org_at: string | null;
  signed_by_talent_at: string | null;
  settled_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  talent?: { id: string; full_name: string | null; avatar_url: string | null; headline: string | null } | null;
  milestones?: { count: number }[] | ContractMilestone[];
}

export interface ContractMilestone {
  id: string;
  contract_id: string;
  title: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  deliverables: string | null;
  approved_by: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getContracts(): Promise<{ data: Contract[] }> {
  return b2bFetch<{ data: Contract[] }>('/b2b/contracts');
}

export async function createContract(input: Partial<Contract> & { talent_id: string; title: string; contract_type: string }): Promise<{ data: Contract }> {
  return b2bFetch<{ data: Contract }>('/b2b/contracts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getContract(id: string): Promise<{ data: Contract }> {
  return b2bFetch<{ data: Contract }>(`/b2b/contracts/${id}`);
}

export async function updateContract(id: string, updates: Partial<Contract>): Promise<{ data: Contract }> {
  return b2bFetch<{ data: Contract }>(`/b2b/contracts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function transitionContract(id: string, status: string): Promise<{ data: Contract }> {
  return b2bFetch<{ data: Contract }>(`/b2b/contracts/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function getContractMilestones(contractId: string): Promise<{ data: ContractMilestone[] }> {
  return b2bFetch<{ data: ContractMilestone[] }>(`/b2b/contracts/${contractId}/milestones`);
}

export async function createContractMilestone(contractId: string, input: Partial<ContractMilestone> & { title: string }): Promise<{ data: ContractMilestone }> {
  return b2bFetch<{ data: ContractMilestone }>(`/b2b/contracts/${contractId}/milestones`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateContractMilestone(contractId: string, milestoneId: string, updates: Partial<ContractMilestone>): Promise<{ data: ContractMilestone }> {
  return b2bFetch<{ data: ContractMilestone }>(`/b2b/contracts/${contractId}/milestones/${milestoneId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// ── Analytics ──

export interface AnalyticsOverview {
  contracts: {
    total: number;
    total_value: number;
    by_status: Record<string, number>;
    monthly_value: Record<string, number>;
  };
  pipeline: {
    total: number;
    by_status: Record<string, number>;
  };
  jobs: { active: number };
  team: { total: number; by_role: Record<string, number> };
  talent: { saved: number; lists: number; saved_searches: number };
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  return b2bFetch<AnalyticsOverview>('/b2b/analytics/overview');
}

// ── Compliance & Verification ──

export interface OrgVerification {
  id: string;
  org_id: string;
  status: 'not_submitted' | 'pending' | 'verified' | 'rejected';
  business_name: string | null;
  registration_number: string | null;
  tax_id: string | null;
  document_urls: string[];
  submitted_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceReport {
  id: string;
  org_id: string;
  report_type: string;
  title: string | null;
  data: Record<string, unknown>;
  generated_at: string;
  created_at: string;
}

export async function getVerification(): Promise<{ data: OrgVerification | null }> {
  return b2bFetch<{ data: OrgVerification | null }>('/b2b/verification');
}

export async function submitVerification(input: {
  business_name: string;
  registration_number?: string;
  tax_id?: string;
  document_urls?: string[];
}): Promise<{ data: OrgVerification }> {
  return b2bFetch<{ data: OrgVerification }>('/b2b/verification', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function uploadVerificationDocument(file: File): Promise<{ data: { url: string; path: string } }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new B2BApiError('AUTH_ERROR', 'No active session');

  let res: Response;
  try {
    const API_BASE = import.meta.env.VITE_API_URL || 'https://dalastudioshowcase.onrender.com/api';
    res = await fetch(`${API_BASE}/b2b/verification/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    });
  } catch {
    throw new B2BApiError('NETWORK_ERROR', 'Failed to connect to the server');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new B2BApiError('SERVER_ERROR', body.error || 'Upload failed', res.status);
  }

  return res.json();
}

export async function reviewVerification(verificationId: string, status: 'verified' | 'rejected', notes?: string): Promise<{ data: OrgVerification }> {
  return b2bFetch<{ data: OrgVerification }>(`/admin/verifications/${verificationId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  });
}

export async function getComplianceReports(): Promise<{ data: ComplianceReport[] }> {
  return b2bFetch<{ data: ComplianceReport[] }>('/b2b/compliance/reports');
}

export async function generateComplianceReport(reportType: string): Promise<{ data: ComplianceReport }> {
  return b2bFetch<{ data: ComplianceReport }>('/b2b/compliance/reports', {
    method: 'POST',
    body: JSON.stringify({ report_type: reportType }),
  });
}

// ── Billing & Subscription ──

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export interface BillingInvoice {
  id: string;
  org_id: string;
  invoice_number: string;
  plan_id: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  billing_cycle: 'monthly' | 'yearly';
  period_start: string;
  period_end: string;
  paid_at: string | null;
  paid_via: string | null;
  invoice_url: string | null;
  created_at: string;
  plan?: { id: string; name: string; slug: string } | null;
}

export interface BillingHistoryEntry {
  id: string;
  org_id: string;
  action: string;
  from_plan_id: string | null;
  to_plan_id: string | null;
  details: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  from_plan?: { id: string; name: string; slug: string } | null;
  to_plan?: { id: string; name: string; slug: string } | null;
}

export async function getBillingPlans(): Promise<{ data: SubscriptionPlan[] }> {
  return b2bFetch<{ data: SubscriptionPlan[] }>('/b2b/billing/plans');
}

export async function getBillingInvoices(): Promise<{ data: BillingInvoice[] }> {
  return b2bFetch<{ data: BillingInvoice[] }>('/b2b/billing/invoices');
}

export async function getBillingHistory(): Promise<{ data: BillingHistoryEntry[] }> {
  return b2bFetch<{ data: BillingHistoryEntry[] }>('/b2b/billing/history');
}

export async function changeSubscriptionPlan(planSlug: string, billingCycle: 'monthly' | 'yearly' = 'monthly'): Promise<{ data: Record<string, unknown> }> {
  return b2bFetch<{ data: Record<string, unknown> }>('/b2b/subscription/change', {
    method: 'POST',
    body: JSON.stringify({ plan_slug: planSlug, billing_cycle: billingCycle }),
  });
}

export interface BillingPayment {
  id: string;
  org_id: string;
  plan_id: string;
  amount: number;
  currency: string;
  payment_method: 'gateway' | 'offline';
  status: 'pending' | 'approved' | 'rejected';
  proof_url: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  plan?: { id: string; name: string; slug: string } | null;
}

// POST /b2b/billing/manual-payment — submit offline payment
export async function submitManualPayment(data: { plan_id: string; amount: number; proof_url?: string }): Promise<{ data: BillingPayment }> {
  return b2bFetch<{ data: BillingPayment }>('/b2b/billing/manual-payment', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// GET /b2b/billing/payments — list org's payments
export async function getBillingPayments(): Promise<{ data: BillingPayment[] }> {
  return b2bFetch<{ data: BillingPayment[] }>('/b2b/billing/payments');
}

// POST /b2b/billing/upload-proof — upload payment proof document
export async function uploadPaymentProof(file: File): Promise<{ data: { url: string; path: string } }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/b2b/billing/upload-proof`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new B2BApiError('SERVER_ERROR', body.error || 'Upload failed', res.status);
  }
  return res.json();
}

// ── Branding ──

export interface OrgBranding {
  id: string;
  org_id: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
  custom_css: string | null;
  custom_domain: string | null;
  is_active: boolean | null;
  updated_by: string | null;
  updated_at: string;
}

export async function getBranding(): Promise<{ data: OrgBranding }> {
  return b2bFetch<{ data: OrgBranding }>('/b2b/branding');
}

export async function updateBranding(input: Partial<OrgBranding>): Promise<{ data: OrgBranding }> {
  return b2bFetch<{ data: OrgBranding }>('/b2b/branding', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// ── Video Calls ──

export interface CallRoom {
  id: string;
  room_name: string;
  status: 'active' | 'ended';
  started_by: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

export async function initCall(conversation_id?: string, order_id?: string): Promise<{ data: CallRoom }> {
  return b2bFetch<{ data: CallRoom }>('/calls/init', {
    method: 'POST',
    body: JSON.stringify({ conversation_id, order_id }),
  });
}

export async function getCallHistory(conversation_id?: string, order_id?: string): Promise<{ data: CallRoom[] }> {
  const params = new URLSearchParams();
  if (conversation_id) params.set('conversation_id', conversation_id);
  if (order_id) params.set('order_id', order_id);
  const qs = params.toString();
  return b2bFetch<{ data: CallRoom[] }>(`/calls/history${qs ? '?' + qs : ''}`);
}

// ── Org Invites ──

export async function acceptInvite(token: string): Promise<{ data: { id: string; org_id: string; role: string } }> {
  return b2bFetch<{ data: { id: string; org_id: string; role: string } }>('/b2b/org/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export interface OrgMembership {
  org_id: string;
  role: string;
  organizations: { id: string; name: string; slug: string; logo_url: string | null };
}

export async function getMyMemberships(): Promise<{ data: OrgMembership[] }> {
  return b2bFetch<{ data: OrgMembership[] }>('/b2b/org/memberships');
}

export async function switchOrg(orgId: string): Promise<{ data: { org_id: string; role: string } }> {
  return b2bFetch<{ data: { org_id: string; role: string } }>('/b2b/org/switch', {
    method: 'POST',
    body: JSON.stringify({ org_id: orgId }),
  });
}

export async function settleContract(contractId: string): Promise<{ data: { settled: boolean; amount: number; fee: number } }> {
  return b2bFetch<{ data: { settled: boolean; amount: number; fee: number } }>(`/b2b/contracts/${contractId}/settle`, {
    method: 'POST',
  });
}

// ── Meetings ──

export interface ScheduleMeetingInput {
  title: string;
  description?: string;
  scheduled_at: string;
  duration_minutes?: number;
  participant_ids?: string[];
}

export async function getMeetings(status?: string): Promise<{ data: OrgMeeting[]; count: number }> {
  const params = status ? `?status=${status}` : '';
  return b2bFetch<{ data: OrgMeeting[]; count: number }>(`/b2b/meetings${params}`);
}

export async function getUpcomingMeetings(): Promise<{ data: OrgMeeting[] }> {
  return b2bFetch<{ data: OrgMeeting[] }>('/b2b/meetings/upcoming');
}

export async function getMeeting(id: string): Promise<{ data: OrgMeeting }> {
  return b2bFetch<{ data: OrgMeeting }>(`/b2b/meetings/${id}`);
}

export async function scheduleMeeting(input: ScheduleMeetingInput): Promise<{ data: OrgMeeting }> {
  return b2bFetch<{ data: OrgMeeting }>('/b2b/meetings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateMeeting(id: string, updates: Partial<OrgMeeting>): Promise<{ data: OrgMeeting }> {
  return b2bFetch<{ data: OrgMeeting }>(`/b2b/meetings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function startMeeting(id: string): Promise<{ data: OrgMeeting }> {
  return b2bFetch<{ data: OrgMeeting }>(`/b2b/meetings/${id}/start`, { method: 'POST' });
}

export async function endMeeting(id: string): Promise<{ data: OrgMeeting }> {
  return b2bFetch<{ data: OrgMeeting }>(`/b2b/meetings/${id}/end`, { method: 'POST' });
}

export async function cancelMeeting(id: string): Promise<{ data: OrgMeeting }> {
  return b2bFetch<{ data: OrgMeeting }>(`/b2b/meetings/${id}/cancel`, { method: 'POST' });
}

export async function notifyMeetingParticipants(id: string, message?: string): Promise<{ success: boolean; notified_count: number }> {
  return b2bFetch<{ success: boolean; notified_count: number }>(`/b2b/meetings/${id}/notify`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function getMeetingNotifications(): Promise<{ data: OrgMeetingNotification[] }> {
  return b2bFetch<{ data: OrgMeetingNotification[] }>('/b2b/meetings/notifications');
}

export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  return b2bFetch<{ success: boolean }>(`/b2b/meetings/notifications/${id}/read`, { method: 'POST' });
}
