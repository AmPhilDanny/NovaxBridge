import { supabase } from '@/integrations/supabase/client';
import { marketplaceApi, paymentsApi, walletApi, messagingApi, notificationsApi, aiApi, get, post, patch, put, del } from '@/lib/api-client';

export interface Notification {
  id: string;
  profile_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  base_price: number;
  is_active: boolean;
}

export interface MarketplaceListing {
  id: string;
  service_id: string;
  provider_id: string;
  title: string;
  description: string;
  price: number;
  duration_hours: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  service?: Pick<Service, 'id' | 'name' | 'slug' | 'category'> | null;
  provider?: { id: string; full_name: string | null; avatar_url: string | null; headline?: string | null } | null;
}

export interface Order {
  id: string;
  listing_id: string;
  buyer_id: string;
  provider_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'in_progress' | 'completed' | 'disputed' | 'cancelled' | 'refunded';
  payment_status: 'unpaid' | 'pending' | 'paid' | 'refunded';
  rating: number | null;
  review: string | null;
  completed_at: string | null;
  created_at: string;
  listing?: { id: string; title: string; price: number } | null;
  buyer?: { id: string; full_name: string | null; avatar_url: string | null } | null;
  provider?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export interface WalletBalance {
  balance: number;
  transaction_count: number;
}

export interface WalletTransaction {
  id: string;
  profile_id: string;
  type: 'credit' | 'debit' | 'payout' | 'refund' | 'bonus';
  amount: number;
  balance_after: number;
  reference: string;
  description: string | null;
  status: string;
  created_at: string;
}

export interface Payout {
  id: string;
  profile_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: 'pending' | 'processing' | 'paid' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  profile?: { id: string; full_name: string | null; avatar_url: string | null };
}

// ── Listings ──

export async function getServices(): Promise<Service[]> {
  const res = await marketplaceApi.services();
  return res.data || [];
}

export async function getListings(params?: {
  status?: string;
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}): Promise<{ listings: MarketplaceListing[]; count: number; page: number; limit: number }> {
  const apiParams: Record<string, string | number | boolean | undefined> = {};
  if (params?.status) apiParams.status = params.status;
  if (params?.category) apiParams.category = params.category;
  if (params?.search) apiParams.search = params.search;
  if (params?.minPrice !== undefined) apiParams.min_price = params.minPrice;
  if (params?.maxPrice !== undefined) apiParams.max_price = params.maxPrice;
  if (params?.sort) apiParams.sort = params.sort;
  if (params?.page) apiParams.page = params.page;
  if (params?.limit) apiParams.limit = params.limit;

  const res = await marketplaceApi.listings(apiParams);
  return { listings: res.data || [], count: res.count || 0, page: res.page || 1, limit: res.limit || 20 };
}

export async function getListing(id: string): Promise<MarketplaceListing> {
  const res = await marketplaceApi.getListing(id);
  return res.data;
}

export async function createListing(body: {
  title: string;
  description: string;
  price: number;
  service_id: string;
  duration_hours: number;
}): Promise<MarketplaceListing> {
  const res = await marketplaceApi.createListing(body);
  return res.data;
}

// ── Orders ──

export async function getOrders(params?: {
  role?: 'buyer' | 'provider';
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<Order[]> {
  const apiParams: Record<string, string | number | boolean | undefined> = {};
  if (params?.role) apiParams.role = params.role;
  if (params?.status) apiParams.status = params.status;
  if (params?.limit) apiParams.limit = params.limit;
  if (params?.offset) apiParams.offset = params.offset;

  const res = await marketplaceApi.orders(apiParams);
  return res.data || [];
}

export async function getOrder(id: string): Promise<Order> {
  const res = await marketplaceApi.getOrder(id);
  return res.data;
}

export async function createOrder(listing_id: string): Promise<Order> {
  const res = await marketplaceApi.createOrder(listing_id);
  return res.data;
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  extra?: { rating?: number; review?: string }
): Promise<Order> {
  const res = await marketplaceApi.updateOrder(orderId, { status, ...extra });
  return res.data;
}

// ── Payment Types ──

export interface PaymentIntent {
  id: string;
  order_id: string;
  buyer_id: string;
  gateway: 'paystack' | 'flutterwave';
  gateway_reference: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'refunded';
  authorization_url: string | null;
  created_at: string;
}

export interface PaymentInitResult {
  authorization_url: string;
  reference: string;
  gateway: string;
  intent_id: string;
}

// ── Payment API ──

export async function initializePayment(orderId: string, gateway?: string): Promise<PaymentInitResult> {
  const res = await paymentsApi.initialize(orderId, gateway);
  return res.data;
}

export async function verifyPaystackPayment(reference: string): Promise<{ status: string; order_id: string }> {
  const res = await paymentsApi.verify('paystack', { reference });
  return res.data;
}

export async function verifyFlutterwavePayment(transactionId: string): Promise<{ status: string; order_id: string }> {
  const res = await paymentsApi.verify('flutterwave', { transaction_id: transactionId });
  return res.data;
}

export async function releaseMilestonePayment(milestoneId: string): Promise<{ released: boolean; amount: number }> {
  const res = await paymentsApi.releaseMilestone(milestoneId);
  return res.data;
}

export async function releaseEscrow(orderId: string): Promise<{ released: boolean; amount: number; fee: number }> {
  const res = await paymentsApi.release(orderId);
  return res.data;
}

// ── Wallet & Payouts ──

export async function getWalletBalance(): Promise<WalletBalance> {
  const res = await walletApi.balance();
  return res.data;
}

export async function getWalletTransactions(params?: {
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<WalletTransaction[]> {
  const apiParams: Record<string, string | number | boolean | undefined> = {};
  if (params?.type) apiParams.type = params.type;
  if (params?.limit) apiParams.limit = params.limit;
  if (params?.offset) apiParams.offset = params.offset;
  const res = await walletApi.transactions(apiParams);
  return res.data;
}

export async function getPayouts(): Promise<Payout[]> {
  const res = await walletApi.payouts();
  return res.data;
}

// ── Reviews ──

export interface ListingReview {
  id: string;
  rating: number;
  review: string;
  created_at: string;
  buyer: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export interface ProviderReview {
  id: string;
  rating: number;
  review: string;
  created_at: string;
  listing: { id: string; title: string } | null;
  buyer: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export interface ListingRating {
  average: number;
  count: number;
}

export async function getListingRating(listingId: string): Promise<ListingRating> {
  const res = await marketplaceApi.listingReviewStats(listingId);
  return res.data || { average: 0, count: 0 };
}

export async function getListingReviews(listingId: string): Promise<ListingReview[]> {
  const res = await marketplaceApi.listingReviews(listingId);
  return res.data || [];
}

export async function getProviderReviews(providerId: string): Promise<ProviderReview[]> {
  const res = await marketplaceApi.providerReviews(providerId);
  return res.data || [];
}

export async function getProviderRating(providerId: string): Promise<ListingRating> {
  const res = await marketplaceApi.providerReviewStats(providerId);
  return res.data || { average: 0, count: 0 };
}

export async function updateReview(orderId: string, rating?: number, review?: string): Promise<void> {
  await marketplaceApi.updateReview(orderId, { rating, review });
}

export async function deleteReview(orderId: string): Promise<void> {
  await marketplaceApi.deleteReview(orderId);
}

export async function submitReview(orderId: string, rating: number, review: string): Promise<void> {
  await marketplaceApi.submitReview(orderId, { rating, review });
}

// ── Payments ──

export async function detectCurrency(): Promise<{ code: string; symbol: string; name: string }> {
  try {
    const res = await paymentsApi.detectCurrency();
    return res.data;
  } catch {
    return { code: 'NGN', symbol: '\u20A6', name: 'Nigerian Naira' };
  }
}

export async function getPaymentGateways(): Promise<Record<string, { public_key: string; secret_key: string; enabled: boolean }>> {
  try {
    const res = await paymentsApi.gateways();
    return res.data;
  } catch {
    return {};
  }
}

export async function getServiceFee(): Promise<number> {
  try {
    const res = await paymentsApi.serviceFee();
    return res.data?.percentage ?? 5;
  } catch {
    return 5;
  }
}

export async function releasePayment(orderId: string): Promise<{ released: boolean; amount: number; fee: number }> {
  const res = await paymentsApi.release(orderId);
  return res.data;
}

// ── Messaging ──

export interface Conversation {
  id: string;
  order_id: string | null;
  created_at: string;
  updated_at: string;
  other_profiles: Array<{ id: string; full_name: string | null; avatar_url: string | null; role: string | null }> | null;
  last_message: { id: string; content: string; sender_id: string; created_at: string } | null;
  unread_count: number;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  conversation_id: string;
  sender_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  message_attachments?: MessageAttachment[];
}

export async function createConversation(other_participant_id: string, order_id?: string): Promise<Conversation> {
  const res = await messagingApi.createConversation(other_participant_id, order_id);
  return res.data;
}

export async function getConversations(): Promise<Conversation[]> {
  const res = await messagingApi.conversations();
  return res.data || [];
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const res = await messagingApi.getMessages(conversationId);
  return res.data || [];
}

export async function sendMessage(
  conversationId: string,
  content: string,
  attachments?: Array<{ storage_path: string; file_name: string; file_size: number; mime_type: string }>
): Promise<Message> {
  const res = await messagingApi.sendMessage(conversationId, { content, attachments });
  return res.data;
}

export async function uploadChatAttachment(
  file: File,
  userId: string
): Promise<{ storage_path: string; file_name: string; file_size: number; mime_type: string }> {
  const ext = file.name.split('.').pop() || '';
  const uniqueName = `${crypto.randomUUID()}.${ext}`;
  const filePath = `${userId}/${uniqueName}`;

  const { error: uploadError } = await supabase.storage
    .from('chat-attachments')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  return {
    storage_path: filePath,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type,
  };
}

export function getChatAttachmentUrl(storagePath: string): string {
  const { data } = supabase.storage.from('chat-attachments').getPublicUrl(storagePath);
  return data.publicUrl;
}

// ── Order Milestones ──

export interface OrderMilestone {
  id: string;
  order_id: string;
  title: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function getMilestones(orderId: string): Promise<OrderMilestone[]> {
  const res = await marketplaceApi.getMilestones(orderId);
  return res.data || [];
}

export async function createMilestone(
  orderId: string,
  data: { title: string; description?: string; amount: number; due_date?: string }
): Promise<OrderMilestone> {
  const res = await marketplaceApi.createMilestone(orderId, data);
  return res.data;
}

export async function updateMilestoneStatus(milestoneId: string, status: string): Promise<OrderMilestone> {
  const { data: msData } = await supabase
    .from('order_milestones')
    .select('order_id')
    .eq('id', milestoneId)
    .single();
  if (!msData) throw new Error('Milestone not found');
  const res = await marketplaceApi.updateMilestone(msData.order_id, milestoneId, { status });
  return res.data;
}

// ── Provider Availability ──

export interface AvailabilitySlot {
  id: string;
  provider_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string;  // HH:mm format
  end_time: string;    // HH:mm format
  created_at: string;
  updated_at: string;
}

export interface AvailabilityOverride {
  id: string;
  provider_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  reason: string | null;
  created_at: string;
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_FULL_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function getAvailabilitySlots(providerId: string): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase
    .from('provider_availability_slots')
    .select('*')
    .eq('provider_id', providerId)
    .order('day_of_week')
    .order('start_time');
  if (error) throw error;
  return data || [];
}

export async function upsertAvailabilitySlot(
  providerId: string,
  slot: { day_of_week: number; start_time: string; end_time: string; id?: string }
): Promise<AvailabilitySlot> {
  if (slot.id) {
    const { data, error } = await supabase
      .from('provider_availability_slots')
      .update({ day_of_week: slot.day_of_week, start_time: slot.start_time, end_time: slot.end_time })
      .eq('id', slot.id)
      .eq('provider_id', providerId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('provider_availability_slots')
      .insert({ provider_id: providerId, day_of_week: slot.day_of_week, start_time: slot.start_time, end_time: slot.end_time })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function deleteAvailabilitySlot(slotId: string): Promise<void> {
  const { error } = await supabase.from('provider_availability_slots').delete().eq('id', slotId);
  if (error) throw error;
}

export async function getAvailabilityOverrides(providerId: string, fromDate?: string, toDate?: string): Promise<AvailabilityOverride[]> {
  let query = supabase
    .from('provider_availability_overrides')
    .select('*')
    .eq('provider_id', providerId)
    .order('date');
  if (fromDate) query = query.gte('date', fromDate);
  if (toDate) query = query.lte('date', toDate);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function upsertAvailabilityOverride(
  providerId: string,
  override: { date: string; is_available: boolean; start_time?: string; end_time?: string; reason?: string }
): Promise<AvailabilityOverride> {
  const { data, error } = await supabase
    .from('provider_availability_overrides')
    .upsert({
      provider_id: providerId,
      date: override.date,
      is_available: override.is_available,
      start_time: override.is_available ? (override.start_time || null) : null,
      end_time: override.is_available ? (override.end_time || null) : null,
      reason: override.reason || null,
    }, { onConflict: 'provider_id, date' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAvailabilityOverride(overrideId: string): Promise<void> {
  const { error } = await supabase.from('provider_availability_overrides').delete().eq('id', overrideId);
  if (error) throw error;
}

// ── Disputes & Resolution ──

export interface Dispute {
  id: string;
  order_id: string;
  raised_by: string;
  reason: string;
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  order?: { id: string; title: string; amount: number; status: string } | null;
  raised_by_profile?: { id: string; full_name: string | null; avatar_url: string | null } | null;
  resolved_by_profile?: { id: string; full_name: string | null } | null;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  message: string;
  is_admin_message: boolean;
  created_at: string;
  sender?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export const DISPUTE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' },
  under_review: { label: 'Under Review', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  resolved: { label: 'Resolved', color: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  dismissed: { label: 'Dismissed', color: 'bg-muted text-muted-foreground' },
};

export async function getMyDisputes(): Promise<Dispute[]> {
  const res = await marketplaceApi.disputes();
  return res.data || [];
}

export async function getDispute(disputeId: string): Promise<Dispute> {
  const res = await marketplaceApi.getDispute(disputeId);
  return res.data;
}

export async function getDisputeMessages(disputeId: string): Promise<DisputeMessage[]> {
  const res = await marketplaceApi.getDisputeMessages(disputeId);
  return res.data || [];
}

export async function sendDisputeMessage(disputeId: string, message: string): Promise<DisputeMessage> {
  const res = await marketplaceApi.sendDisputeMessage(disputeId, message);
  return res.data;
}

// ── Currency Format Helpers ──

export const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '\u20A6',
  GHS: '\u20B5',
  KES: 'KSh',
  ZAR: 'R',
  UGX: 'USh',
  TZS: 'TSh',
  RWF: 'FRw',
  XOF: 'CFA',
  XAF: 'FCFA',
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
};

export function formatPrice(amount: number, currencyCode = 'NGN'): string {
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
  return `${symbol}${amount.toLocaleString()}`;
}

export async function deleteListing(id: string): Promise<void> {
  await del(`/marketplace/listings/${id}`);
}

export async function requestPayout(body: {
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
}): Promise<Payout> {
  const res = await walletApi.requestPayout(body);
  return res.data;
}

// ── Notifications ──

export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
  const res = await notificationsApi.list({ unread: unreadOnly || undefined });
  return res.data || [];
}

export async function getUnreadCount(): Promise<number> {
  try {
    const res = await notificationsApi.unreadCount();
    return res.count ?? 0;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  await notificationsApi.markRead(id);
}

export async function markAllNotificationsRead(): Promise<void> {
  await notificationsApi.markAllRead();
}

// ── My Listings ──

export async function getMyListings(): Promise<MarketplaceListing[]> {
  const res = await marketplaceApi.listings({ mine: true });
  return res.data || [];
}

// ── Provider Stats ──

export interface ProviderStats {
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  completion_rate: number;
  total_earned: number;
  avg_response_hours: number | null;
  average_rating: number;
  review_count: number;
}

export async function getProviderStats(profileId: string): Promise<ProviderStats> {
  const { data: orders } = await supabase
    .from('orders')
    .select('status, amount, provider_payout, rating, created_at, updated_at')
    .eq('provider_id', profileId);

  if (!orders) return { total_orders: 0, completed_orders: 0, cancelled_orders: 0, completion_rate: 0, total_earned: 0, avg_response_hours: null, average_rating: 0, review_count: 0 };

  const total = orders.length;
  const completed = orders.filter((o) => o.status === 'completed').length;
  const cancelled = orders.filter((o) => o.status === 'cancelled').length;
  const nonCancelled = total - cancelled;
  const rate = nonCancelled > 0 ? Math.round((completed / nonCancelled) * 100) : 0;
  const earned = orders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + Number(o.provider_payout || o.amount || 0), 0);

  const responseHours: number[] = [];
  for (const o of orders) {
    if (o.status !== 'pending') {
      const created = new Date(o.created_at).getTime();
      const updated = new Date(o.updated_at || o.created_at).getTime();
      const hours = (updated - created) / (1000 * 60 * 60);
      if (hours >= 0 && hours < 720) responseHours.push(hours);
    }
  }
  const avgHours = responseHours.length > 0
    ? Math.round((responseHours.reduce((a, b) => a + b, 0) / responseHours.length) * 10) / 10
    : null;

  const ratings = (orders as Array<Record<string, unknown>>).filter((o) => o.rating !== null).map((o) => Number(o.rating));
  const reviewCount = ratings.length;
  const averageRating = reviewCount > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / reviewCount) * 10) / 10 : 0;

  return {
    total_orders: total,
    completed_orders: completed,
    cancelled_orders: cancelled,
    completion_rate: rate,
    total_earned: earned,
    avg_response_hours: avgHours,
    average_rating: averageRating,
    review_count: reviewCount,
  };
}

// ── Admin Service Types ──

export interface AdminService {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  base_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Chat Bubble Style ──

export interface ChatBubbleStyle {
  my_bubble_bg: string;
  my_bubble_text: string;
  other_bubble_bg: string;
  other_bubble_text: string;
}

export const DEFAULT_BUBBLE_STYLE: ChatBubbleStyle = {
  my_bubble_bg: '#7c3aed',
  my_bubble_text: '#ffffff',
  other_bubble_bg: '#f3f4f6',
  other_bubble_text: '#111827',
};

export async function getChatBubbleStyle(): Promise<ChatBubbleStyle> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'chat_bubble_style')
      .single();
    if (!error && data?.value) {
      const style = data.value as unknown as ChatBubbleStyle;
      if (style?.my_bubble_bg && style?.other_bubble_bg) return style;
    }
  } catch { /* fallback */ }
  return DEFAULT_BUBBLE_STYLE;
}

// ── Admin Types ──

export interface AdminStats {
  total_users: number;
  total_orders: number;
  completed_orders: number;
  total_revenue: number;
  pending_payouts: number;
  open_disputes: number;
}

export interface AdminUser {
  id: string;
  role: 'student' | 'firm' | 'admin';
  full_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminDispute {
  id: string;
  order_id: string;
  raised_by: string;
  reason: string;
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  order?: { id: string; title: string; amount: number; status: string } | null;
  raised_by_profile?: { id: string; full_name: string | null; avatar_url: string | null } | null;
  resolved_by_profile?: { id: string; full_name: string | null } | null;
}

export interface AdminPayout {
  id: string;
  profile_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  profile?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export interface AdminAuditEntry {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  admin?: { id: string; full_name: string | null } | null;
}

// ── Admin Service API ──

export async function getAdminServices(): Promise<AdminService[]> {
  const { data } = await adminFetch<{ data: AdminService[] }>('/admin/services');
  return data || [];
}

export async function createAdminService(body: {
  name: string;
  slug: string;
  description?: string;
  category: string;
  base_price?: number;
}): Promise<AdminService> {
  const { data } = await adminFetch<{ data: AdminService }>('/admin/services', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data;
}

export async function updateAdminService(id: string, body: Partial<AdminService>): Promise<AdminService> {
  const { data } = await adminFetch<{ data: AdminService }>(`/admin/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return data;
}

export async function deleteAdminService(id: string): Promise<AdminService> {
  const { data } = await adminFetch<{ data: AdminService }>(`/admin/services/${id}`, {
    method: 'DELETE',
  });
  return data;
}

// ── Admin AI Assist ──

export async function adminAiInsight(
  mode: 'admin_metric_insight' | 'admin_user_summary' | 'admin_service_description',
  params: Record<string, string>
): Promise<string> {
  const body = { mode, ...params };
  const res = await aiApi.assist(body);
  return res.data;
}

// ── Admin API ──

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || 'GET').toLowerCase();
  const body = options?.body ? JSON.parse(options.body as string) : undefined;
  let res: any;
  if (method === 'get' || method === '') res = await get(path);
  else if (method === 'post') res = await post(path, body);
  else if (method === 'patch') res = await patch(path, body);
  else if (method === 'put') res = await put(path, body);
  else if (method === 'delete') res = await del(path);
  else throw new Error(`Unsupported method: ${method}`);
  return res;
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await adminFetch<{ data: AdminStats }>('/admin/stats');
  return data;
}

export async function getAdminUsers(params?: {
  role?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: AdminUser[]; count: number }> {
  const qs = new URLSearchParams();
  if (params?.role) qs.set('role', params.role);
  if (params?.search) qs.set('search', params.search);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  return adminFetch<{ data: AdminUser[]; count: number }>(`/admin/users?${qs}`);
}

export async function updateUserRole(userId: string, role: string): Promise<AdminUser> {
  const { data } = await adminFetch<{ data: AdminUser }>(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  return data;
}

export async function updateUserProfile(
  userId: string,
  fields: { full_name?: string; company_name?: string; avatar_url?: string; bio?: string }
): Promise<AdminUser> {
  const { data } = await adminFetch<{ data: AdminUser }>(`/admin/users/${userId}/profile`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
  return data;
}

export async function getAdminUser(userId: string): Promise<AdminUser> {
  const { data } = await adminFetch<{ data: AdminUser }>(`/admin/users/${userId}`);
  return data;
}

export async function getAdminDisputes(status?: string): Promise<AdminDispute[]> {
  const qs = status ? `?status=${status}` : '';
  const { data } = await adminFetch<{ data: AdminDispute[] }>(`/admin/disputes${qs}`);
  return data;
}

export async function updateDispute(
  disputeId: string,
  status: string,
  resolution?: string
): Promise<AdminDispute> {
  const { data } = await adminFetch<{ data: AdminDispute }>(`/admin/disputes/${disputeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, resolution }),
  });
  return data;
}

export async function getAdminPayouts(status?: string): Promise<AdminPayout[]> {
  const qs = status ? `?status=${status}` : '';
  const { data } = await adminFetch<{ data: AdminPayout[] }>(`/admin/payouts${qs}`);
  return data;
}

export async function getAdminSettings(): Promise<Record<string, unknown>> {
  const { data } = await adminFetch<{ data: Record<string, unknown> }>('/admin/settings');
  return data;
}

export async function updateAdminSetting(key: string, value: unknown): Promise<void> {
  await adminFetch('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify({ key, value }),
  });
}

export async function getAdminAuditLog(limit?: number): Promise<AdminAuditEntry[]> {
  const qs = limit ? `?limit=${limit}` : '';
  const { data } = await adminFetch<{ data: AdminAuditEntry[] }>(`/admin/audit-log${qs}`);
  return data;
}

// ── Manual / Offline Payment Types ──

export interface OfflinePaymentConfig {
  enabled: boolean;
  bank_name: string;
  account_number: string;
  account_name: string;
  routing_number?: string;
  swift_code?: string;
  instructions: string;
}

export interface ManualPayment {
  id: string;
  order_id: string;
  buyer_id: string;
  payment_intent_id: string | null;
  amount: number;
  currency: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  screenshot_url: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

export interface ProviderBankAccount {
  id: string;
  profile_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  routing_number: string | null;
  swift_code: string | null;
  country: string;
  kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  kyc_document_url: string | null;
  kyc_notes: string | null;
  created_at: string;
  profile?: { id: string; full_name: string | null; avatar_url: string | null };
}

// ── Manual Payment API ──

export async function getOfflinePaymentConfig(): Promise<OfflinePaymentConfig | null> {
  try {
    const res = await paymentsApi.offlineConfig();
    return res.data;
  } catch {
    return null;
  }
}

export async function initiateManualPayment(
  orderId: string,
  screenshotUrl: string,
  notes?: string
): Promise<ManualPayment> {
  const res = await paymentsApi.manualPayment({ order_id: orderId, screenshot_url: screenshotUrl, notes });
  return res.data;
}

export async function getManualPayments(orderId?: string): Promise<ManualPayment[]> {
  const res = await paymentsApi.getManualPayments({ order_id: orderId });
  return res.data || [];
}

export async function uploadPaymentScreenshot(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `payment-screenshots/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('site-assets')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw new Error('Failed to upload screenshot: ' + error.message);

  const { data: urlData } = supabase.storage
    .from('site-assets')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// ── Provider Bank Account API ──

export async function getProviderBankAccount(): Promise<ProviderBankAccount | null> {
  try {
    const res = await walletApi.bankAccount();
    return res.data;
  } catch {
    return null;
  }
}

export async function saveProviderBankAccount(details: {
  bank_name: string;
  account_number: string;
  account_name: string;
  routing_number?: string;
  swift_code?: string;
  country?: string;
}): Promise<ProviderBankAccount> {
  const nameParts = details.account_name.trim().split(/\s+/);
  if (nameParts.length < 2) {
    throw new Error('Account name must include at least first and last name');
  }
  const res = await walletApi.saveBankAccount(details);
  return res.data;
}

export async function uploadKycDocument(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'pdf';
  const fileName = `kyc-documents/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('site-assets')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw new Error('Failed to upload document: ' + error.message);

  const { data: urlData } = supabase.storage
    .from('site-assets')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// ── Admin Manual Payment API ──

export async function getAdminManualPayments(status?: string): Promise<ManualPayment[]> {
  const qs = status ? `?status=${status}` : '';
  const { data } = await adminFetch<{ data: ManualPayment[] }>(`/admin/manual-payments${qs}`);
  return data;
}

export async function approveManualPayment(
  paymentId: string,
  adminNotes?: string
): Promise<ManualPayment> {
  const { data } = await adminFetch<{ data: ManualPayment }>(`/admin/manual-payments/${paymentId}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ admin_notes: adminNotes }),
  });
  return data;
}

export async function rejectManualPayment(
  paymentId: string,
  adminNotes?: string
): Promise<ManualPayment> {
  const { data } = await adminFetch<{ data: ManualPayment }>(`/admin/manual-payments/${paymentId}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ admin_notes: adminNotes }),
  });
  return data;
}

// ── Admin Provider Bank Accounts API ──

export async function getAdminProviderBankAccounts(kycStatus?: string): Promise<ProviderBankAccount[]> {
  const qs = kycStatus ? `?kyc_status=${kycStatus}` : '';
  const { data } = await adminFetch<{ data: ProviderBankAccount[] }>(`/admin/provider-bank-accounts${qs}`);
  return data;
}

export async function verifyProviderBankAccount(
  accountId: string,
  status: 'verified' | 'rejected',
  notes?: string
): Promise<ProviderBankAccount> {
  const { data } = await adminFetch<{ data: ProviderBankAccount }>(`/admin/provider-bank-accounts/${accountId}/verify`, {
    method: 'PATCH',
    body: JSON.stringify({ kyc_status: status, kyc_notes: notes }),
  });
  return data;
}

// ── Connections ──

export interface Connection {
  id: string;
  follower_id: string;
  following_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  responded_at: string | null;
  profile?: { id: string; full_name: string | null; avatar_url: string | null; role: string | null; headline: string | null };
}

export async function sendConnectionRequest(followingId: string): Promise<Connection> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error('Please sign in');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('connections')
    .insert({ follower_id: userId, following_id: followingId, status: 'pending' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Connection;
}

export async function acceptConnectionRequest(connectionId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('connections')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', connectionId);
  if (error) throw new Error(error.message);
}

export async function rejectConnectionRequest(connectionId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('connections')
    .update({ status: 'rejected', responded_at: new Date().toISOString() })
    .eq('id', connectionId);
  if (error) throw new Error(error.message);
}

export async function cancelConnectionRequest(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('connections')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw new Error(error.message);
}

export async function getConnections(): Promise<Connection[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('Please sign in');

  // Fetch both directions:
  // 1. Where user is the follower (they initiated the connection)
  // 2. Where user is the following (they received the connection request)
  // This ensures both users see the connection after it's accepted.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: asFollower, error: err1 } = await (supabase as any)
    .from('connections')
    .select('*, profile:profiles!following_id(id, full_name, avatar_url, role, headline)')
    .eq('follower_id', userId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false });
  if (err1) throw new Error(err1.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: asFollowing, error: err2 } = await (supabase as any)
    .from('connections')
    .select('*, profile:profiles!follower_id(id, full_name, avatar_url, role, headline)')
    .eq('following_id', userId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false });
  if (err2) throw new Error(err2.message);

  // Merge both sets, sorting by created_at descending
  const merged = [...(asFollower || []), ...(asFollowing || [])] as Connection[];
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return merged;
}

export async function getConnectionRequests(): Promise<Connection[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('Please sign in');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('connections')
    .select('*, profile:profiles!follower_id(id, full_name, avatar_url, role, headline)')
    .eq('following_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Connection[];
}

export async function getConnectionStatus(otherUserId: string): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('connections')
    .select('status, follower_id')
    .or(`and(follower_id.eq.${userId},following_id.eq.${otherUserId}),and(follower_id.eq.${otherUserId},following_id.eq.${userId})`)
    .maybeSingle();
  if (!data) return null;
  if (data.follower_id === userId) return data.status;
  if (data.status === 'pending') return 'requested';
  return data.status;
}

export async function removeConnection(connectionId: string): Promise<void> {
  const { error } = await supabase.from('connections').delete().eq('id', connectionId);
  if (error) throw new Error(error.message);
}
