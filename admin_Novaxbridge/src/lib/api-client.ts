/**
 * Centralized API client for the Express backend server.
 * Replaces direct supabase.functions.invoke() calls.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

let _getAccessToken: (() => Promise<string | null>) | null = null;

export function setTokenProvider(fn: () => Promise<string | null>) {
  _getAccessToken = fn;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_getAccessToken) {
    const token = await _getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Generic HTTP methods ──

export async function get<T = any>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<{ data: T; [key: string]: any }> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString(), { headers: await authHeaders() });
  return handleResponse(res);
}

export async function post<T = any>(path: string, body?: any): Promise<{ data: T; [key: string]: any }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse(res);
}

export async function patch<T = any>(path: string, body?: any): Promise<{ data: T; [key: string]: any }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse(res);
}

export async function put<T = any>(path: string, body?: any): Promise<{ data: T; [key: string]: any }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse(res);
}

export async function del<T = any>(path: string): Promise<{ data: T; [key: string]: any }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  return handleResponse(res);
}

export interface AdminRole {
  id: string;
  name: string;
  scope: 'platform' | 'org';
  description: string | null;
  permissions: Record<string, boolean>;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

// ── Admin API helpers ──

export const adminApi = {
  stats: () => get('/admin/stats'),
  users: (params?: { limit?: number; offset?: number; role?: string; search?: string }) => get('/admin/users', params),
  getUser: (id: string) => get(`/admin/users/${id}`),
  updateUserRole: (id: string, role: string) => patch(`/admin/users/${id}/role`, { role }),
  updateUserProfile: (id: string, data: Record<string, any>) => patch(`/admin/users/${id}/profile`, data),
  services: () => get('/admin/services'),
  createService: (data: any) => post('/admin/services', data),
  updateService: (id: string, data: any) => patch(`/admin/services/${id}`, data),
  deleteService: (id: string) => del(`/admin/services/${id}`),
  disputes: (params?: { status?: string }) => get('/admin/disputes', params),
  resolveDispute: (id: string, data: { status: string; resolution?: string }) => patch(`/admin/disputes/${id}`, data),
  payouts: (params?: { status?: string }) => get('/admin/payouts', params),
  settings: () => get('/admin/settings'),
  updateSettings: (key: string, value: any) => patch('/admin/settings', { key, value }),
  manualPayments: (params?: { status?: string }) => get('/admin/manual-payments', params),
  approveManualPayment: (id: string, notes?: string) => patch(`/admin/manual-payments/${id}/approve`, { admin_notes: notes }),
  rejectManualPayment: (id: string, notes?: string) => patch(`/admin/manual-payments/${id}/reject`, { admin_notes: notes }),
  bankAccounts: (params?: { kyc_status?: string }) => get('/admin/provider-bank-accounts', params),
  verifyBankAccount: (id: string, kyc_status: string, kyc_notes?: string) => patch(`/admin/provider-bank-accounts/${id}/verify`, { kyc_status, kyc_notes }),
  auditLog: (params?: { limit?: number }) => get('/admin/audit-log', params),
  config: () => get('/admin/config'),
  updateConfig: (key: string, value: any) => patch('/admin/config', { key, value }),

  // Role Management
  roles: () => get<AdminRole[]>('/admin/roles'),
  createRole: (data: { name: string; scope: 'platform' | 'org'; description?: string; permissions?: Record<string, boolean> }) => post<AdminRole>('/admin/roles', data),
  updateRole: (id: string, data: { name?: string; description?: string; permissions?: Record<string, boolean> }) => patch<AdminRole>(`/admin/roles/${id}`, data),
  deleteRole: (id: string) => del<AdminRole>(`/admin/roles/${id}`),
};

// ── Marketplace API helpers ──

export const marketplaceApi = {
  services: () => get('/marketplace/services'),
  listings: (params?: {
    status?: string; category?: string; search?: string; mine?: boolean;
    min_price?: number; max_price?: number; sort?: string; page?: number; limit?: number;
  }) => get('/marketplace/listings', { ...params, mine: params?.mine ? 'true' : undefined }),
  getListing: (id: string) => get(`/marketplace/listings/${id}`),
  createListing: (data: any) => post('/marketplace/listings', data),
  updateListing: (id: string, data: any) => patch(`/marketplace/listings/${id}`, data),
  deleteListing: (id: string) => del(`/marketplace/listings/${id}`),
  orders: (params?: { role?: string; status?: string; limit?: number; offset?: number }) => get('/marketplace/orders', params),
  getOrder: (id: string) => get(`/marketplace/orders/${id}`),
  createOrder: (listing_id: string) => post('/marketplace/orders', { listing_id }),
  updateOrder: (id: string, data: any) => patch(`/marketplace/orders/${id}`, data),
  getMilestones: (orderId: string) => get(`/marketplace/orders/${orderId}/milestones`),
  createMilestone: (orderId: string, data: any) => post(`/marketplace/orders/${orderId}/milestones`, data),
  updateMilestone: (orderId: string, milestoneId: string, data: any) => patch(`/marketplace/orders/${orderId}/milestones/${milestoneId}`, data),
  disputes: (params?: { status?: string }) => get('/marketplace/disputes', params),
  getDispute: (id: string) => get(`/marketplace/disputes/${id}`),
  getDisputeMessages: (id: string) => get(`/marketplace/disputes/${id}/messages`),
  sendDisputeMessage: (id: string, message: string) => post(`/marketplace/disputes/${id}/messages`, { message }),
  listingReviews: (listingId: string) => get(`/marketplace/reviews/listing/${listingId}`),
  listingReviewStats: (listingId: string) => get(`/marketplace/reviews/listing/${listingId}/stats`),
  providerReviews: (providerId: string) => get(`/marketplace/reviews/provider/${providerId}`),
  providerReviewStats: (providerId: string) => get(`/marketplace/reviews/provider/${providerId}/stats`),
  submitReview: (orderId: string, data: { rating: number; review: string }) => post(`/marketplace/reviews/orders/${orderId}`, data),
  updateReview: (orderId: string, data: { rating?: number; review?: string }) => put(`/marketplace/reviews/orders/${orderId}`, data),
  deleteReview: (orderId: string) => del(`/marketplace/reviews/orders/${orderId}`),
};

// ── Payment API helpers ──

export const paymentsApi = {
  currencies: () => get('/payments/currencies'),
  detectCurrency: () => get('/payments/detect-currency'),
  serviceFee: () => get('/payments/service-fee'),
  gateways: () => get('/payments/gateways'),
  updateGateways: (data: any) => post('/payments/gateways', data),
  updateServiceFee: (percentage: number) => post('/payments/service-fee', { percentage }),
  initialize: (order_id: string, gateway?: string) => post('/payments/initialize', { order_id, gateway }),
  verify: (gateway: string, data: any) => post(`/payments/verify/${gateway}`, data),
  release: (orderId: string) => post(`/payments/release/${orderId}`),
  releaseMilestone: (milestone_id: string) => post('/payments/release-milestone', { milestone_id }),
  offlineConfig: () => get('/payments/offline-config'),
  rates: () => get('/payments/rates'),
  manualPayment: (data: any) => post('/payments/manual', data),
  getManualPayments: (params?: { order_id?: string }) => get('/payments/manual', params),
};

// ── Wallet API helpers ──

export const walletApi = {
  balance: () => get('/wallet/balance'),
  transactions: (params?: { limit?: number; offset?: number; type?: string }) => get('/wallet/transactions', params),
  payouts: () => get('/wallet/payouts'),
  requestPayout: (data: { amount: number; bank_name: string; account_number: string; account_name: string }) => post('/wallet/payouts', data),
  updatePayout: (id: string, data: { status: string; admin_notes?: string }) => patch(`/wallet/payouts/${id}`, data),
  bankAccount: () => get('/wallet/bank-account'),
  saveBankAccount: (data: any) => post('/wallet/bank-account', data),
};

// ── Messaging API helpers ──

export const messagingApi = {
  conversations: () => get('/messaging/conversations'),
  getConversation: (id: string) => get(`/messaging/conversations/${id}`),
  createConversation: (other_participant_id: string, order_id?: string) => post('/messaging/conversations', { other_participant_id, order_id }),
  getMessages: (convId: string) => get(`/messaging/conversations/${convId}/messages`),
  sendMessage: (convId: string, data: { content?: string; attachments?: any[] }) => post(`/messaging/conversations/${convId}/messages`, data),
};

// ── Notification API helpers ──

export const notificationsApi = {
  list: (params?: { limit?: number; offset?: number; unread?: boolean }) => get('/notifications', { ...params, unread: params?.unread ? 'true' : undefined }),
  unreadCount: () => get('/notifications/unread-count'),
  send: (data: { profile_id: string; title: string; message: string; type?: string }) => post('/notifications/send', data),
  markAllRead: () => patch('/notifications/read-all'),
  markRead: (id: string) => patch(`/notifications/${id}/read`),
};

// ── CMS Pages API helpers ──

export const cmsApi = {
  list: () => get<import('@/types/cms').CmsPage[]>('/admin/pages'),
  get: (id: string) => get<import('@/types/cms').CmsPage>(`/admin/pages/${id}`),
  create: (data: import('@/types/cms').CmsPageInput) => post<import('@/types/cms').CmsPage>('/admin/pages', data),
  update: (id: string, data: Partial<import('@/types/cms').CmsPageInput>) => patch<import('@/types/cms').CmsPage>(`/admin/pages/${id}`, data),
  delete: (id: string) => del(`/admin/pages/${id}`),
  getPublished: (slug: string) => get<import('@/types/cms').CmsPage>(`/pages/${slug}`),
};

// ── AI API helpers ──

export const aiApi = {
  assist: (data: { mode: string; [key: string]: any }) => post('/ai', data),
};

// ── B2B API helpers ──

export const b2bApi = {
  getOrg: () => get('/b2b/org'),
  createOrg: (data: any) => post('/b2b/org', data),
  updateOrg: (data: any) => patch('/b2b/org', data),
  members: () => get('/b2b/org/members'),
  inviteMember: (email: string, role: string, message?: string) => post('/b2b/org/members/invite', { email, role, message }),
  acceptInvite: (token: string) => post('/b2b/org/invites/accept', { token }),
  memberships: () => get('/b2b/org/memberships'),
  switchOrg: (org_id: string) => post('/b2b/org/switch', { org_id }),
  updateMemberRole: (memberId: string, role: string) => patch(`/b2b/org/members/${memberId}/role`, { role }),
  invites: () => get('/b2b/org/invites'),
  cancelInvite: (id: string) => del(`/b2b/org/invites/${id}`),
  removeMember: (id: string) => del(`/b2b/org/members/${id}`),
  subscription: () => get('/b2b/subscription'),
  changeSubscription: (plan_slug: string, billing_cycle: string) => post('/b2b/subscription/change', { plan_slug, billing_cycle }),
  talentSearch: (params?: any) => get('/b2b/talent/search', params),
  savedSearches: () => get('/b2b/talent/saved-searches'),
  saveSearch: (name: string, filters: any) => post('/b2b/talent/saved-searches', { name, filters }),
  deleteSavedSearch: (id: string) => del(`/b2b/talent/saved-searches/${id}`),
  talentLists: () => get('/b2b/talent/lists'),
  createTalentList: (name: string, description?: string) => post('/b2b/talent/lists', { name, description }),
  deleteTalentList: (id: string) => del(`/b2b/talent/lists/${id}`),
  getTalentListItems: (listId: string) => get(`/b2b/talent/lists/${listId}/talent`),
  addTalentToList: (listId: string, talent_id: string, notes?: string) => post(`/b2b/talent/lists/${listId}/talent`, { talent_id, notes }),
  removeTalentFromList: (listId: string, talentId: string) => del(`/b2b/talent/lists/${listId}/talent/${talentId}`),
  contracts: () => get('/b2b/contracts'),
  createContract: (data: any) => post('/b2b/contracts', data),
  getContract: (id: string) => get(`/b2b/contracts/${id}`),
  updateContract: (id: string, data: any) => patch(`/b2b/contracts/${id}`, data),
  updateContractStatus: (id: string, status: string) => post(`/b2b/contracts/${id}/status`, { status }),
  hiringApplications: () => get('/b2b/hiring/applications'),
  updatePipeline: (appId: string, status: string) => patch(`/b2b/hiring/pipeline/${appId}`, { status }),
  bulkPipeline: (application_ids: string[], status: string) => post('/b2b/hiring/pipeline/bulk', { application_ids, status }),
  bulkJobs: (jobs: any[]) => post('/b2b/jobs/bulk', { jobs }),
};
