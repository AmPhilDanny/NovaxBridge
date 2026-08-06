import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, Shield, Search, CheckCircle2, XCircle, Eye, Key, Save, 
RefreshCw, CreditCard, DollarSign, Scale, MessageSquare, Download, Settings, LayoutGrid, ShoppingCart, Users, Wallet, 
Building2, Banknote, Image as ImageIcon, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Bell, LogOut, LayoutDashboard, Edit, Trash2, 
ExternalLink, Calendar, FileText, Briefcase, Plus, Video, GraduationCap, Copy, CheckCheck, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { getPayouts, Payout, getAdminManualPayments, approveManualPayment, rejectManualPayment, ManualPayment } from '@/lib/marketplace';
import { get, post, patch, del, adminApi } from '@/lib/api-client';
import { downloadCSV } from '@/lib/export';
import { usePermissions } from '@/hooks/usePermissions';
import SiteSettingsTab from '@/components/admin/SiteSettingsTab';
import UserManagementTab from '@/components/admin/UserManagementTab';
import CmsPagesTab from '@/components/admin/CmsPagesTab';
import AdminConnectionsTab from '@/components/admin/AdminConnectionsTab';

const DEFAULT_ADMIN_EMAIL = 'admin@skillbridge.africa';

// ── Types ──

interface AdminService {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  base_price: number;
  is_active: boolean;
}

interface AdminOrder {
  id: string;
  listing_id: string;
  buyer_id: string;
  provider_id: string;
  amount: number;
  status: string;
  rating: number | null;
  review: string | null;
  created_at: string;
  completed_at: string | null;
  listing: { title: string } | null;
  buyer: { id: string; full_name: string | null } | null;
  provider: { id: string; full_name: string | null } | null;
}

interface AdminProfile {
  id: string;
  full_name: string | null;
  email?: string | null;
  role: string;
  headline: string | null;
  avatar_url: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  typing: 'Typing & Transcription',
  research: 'Research',
  design: 'Design',
  tutoring: 'Tutoring',
  writing: 'Writing',
  development: 'Development',
  data_entry: 'Data Entry',
  virtual_assistance: 'Virtual Assistance',
  academic: 'Academic Support',
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-700',
  in_progress: 'bg-blue-500/15 text-blue-700',
  completed: 'bg-green-500/15 text-green-700',
  disputed: 'bg-red-500/15 text-red-700',
  cancelled: 'bg-muted text-muted-foreground',
  refunded: 'bg-purple-500/15 text-purple-700',
};

export default function AdminDashboard() {
  const { user, profile, isLoading: authLoading, signOut } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();
  const [activeTab, setActiveTab] = useState('services');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  const [services, setServices] = useState<AdminService[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [users, setUsers] = useState<AdminProfile[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('');

  // Edit service dialog
  const [editingService, setEditingService] = useState<AdminService | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState(0);

  // Payout action dialog
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [payoutNotes, setPayoutNotes] = useState('');
  const [processingPayout, setProcessingPayout] = useState(false);

  // AI Settings
  const AI_PROVIDER_META: Record<string, { label: string; defaultModel: string; }> = {
    openrouter: { label: 'OpenRouter', defaultModel: 'google/gemini-2.0-flash-001' },
    mistral: { label: 'Mistral AI', defaultModel: 'mistral-large-latest' },
    openai: { label: 'OpenAI', defaultModel: 'gpt-4o-mini' },
    groq: { label: 'Groq', defaultModel: 'llama-3.3-70b-versatile' },
    google: { label: 'Google Gemini', defaultModel: 'gemini-2.0-flash' },
    togetherai: { label: 'Together AI', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  };
  const [aiKeys, setAiKeys] = useState<Record<string, string>>({});
  const [aiModels, setAiModels] = useState<Record<string, string>>({});
  const [preferredProvider, setPreferredProvider] = useState('');
  const [aiProviderStatus, setAiProviderStatus] = useState<Record<string, { configured: boolean; active: boolean }>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [savingKeys, setSavingKeys] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(false);

  // Academy config
  const [academyConfig, setAcademyConfig] = useState({
    tutor_applications_enabled: true,
    academy_enabled: true,
    auto_approve_tutors: false,
    min_course_price: 0,
    platform_fee_percent: 5,
  });
  const [savingAcademy, setSavingAcademy] = useState(false);
  const [academyApplications, setAcademyApplications] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [processingApp, setProcessingApp] = useState<string | null>(null);

  // Payment Gateway config
  const [paymentGateways, setPaymentGateways] = useState<Record<string, { public_key: string; secret_key: string; enabled: boolean }>>({});
  const [savingPaymentConfig, setSavingPaymentConfig] = useState(false);
  const [loadingPaymentConfig, setLoadingPaymentConfig] = useState(false);
  // Offline Payment config
  const [offlinePayment, setOfflinePayment] = useState({
    enabled: false, bank_name: '', account_number: '', account_name: '',
    routing_number: '', swift_code: '', instructions: '',
  });
  const [savingOfflinePayment, setSavingOfflinePayment] = useState(false);
  const [loadingOfflinePayment, setLoadingOfflinePayment] = useState(false);

  // Exchange rates
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [ratesBaseCurrency, setRatesBaseCurrency] = useState('NGN');
  const [loadingRates, setLoadingRates] = useState(false);
  const [savingRates, setSavingRates] = useState(false);

  // Manual Payments
  const [manualPayments, setManualPayments] = useState<ManualPayment[]>([]);
  const [loadingManualPayments, setLoadingManualPayments] = useState(false);
  const [processingManualPayment, setProcessingManualPayment] = useState<string | null>(null);

  // B2B — Organizations
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgSearch, setOrgSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);
  const [orgStatusUpdating, setOrgStatusUpdating] = useState(false);
  const [confirmOrgAction, setConfirmOrgAction] = useState<{ org: any; newStatus: string } | null>(null);

  // B2B — Verifications
  const [verifications, setVerifications] = useState<any[]>([]);
  const [verificationsLoading, setVerificationsLoading] = useState(false);
  const [verifStatusFilter, setVerifStatusFilter] = useState('pending');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewingVerification, setReviewingVerification] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewingStatus, setReviewingStatus] = useState<'verified' | 'rejected' | null>(null);
  const [reviewProcessing, setReviewProcessing] = useState(false);

  // B2B — Plans
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '', slug: '', description: '',
    price_monthly: 0, price_yearly: 0,
    features: {} as Record<string, boolean>,
    is_active: true, sort_order: 0,
  });
  const [savingPlan, setSavingPlan] = useState(false);

  // Plan feature group definitions for hierarchical feature UI
  const PLAN_FEATURE_GROUPS = [
    {
      group: 'hiring', label: 'Hiring',
      features: [
        { key: 'post_jobs', label: 'Post Jobs', desc: 'Create and publish job listings' },
        { key: 'bulk_posting', label: 'Bulk Posting', desc: 'Post multiple jobs at once' },
        { key: 'pipeline', label: 'Hiring Pipeline', desc: 'Track applications through stages' },
      ],
    },
    {
      group: 'talent', label: 'Talent Pool',
      features: [
        { key: 'talent_search', label: 'Talent Search', desc: 'Search the talent database' },
        { key: 'talent_lists', label: 'Talent Lists', desc: 'Save and organize talent profiles' },
        { key: 'saved_searches', label: 'Saved Searches', desc: 'Save search filters for reuse' },
      ],
    },
    {
      group: 'contracts', label: 'Contracts',
      features: [
        { key: 'contracts', label: 'Contracts', desc: 'Create and manage contracts' },
        { key: 'milestones', label: 'Milestones', desc: 'Track project milestones' },
        { key: 'e_signatures', label: 'E-Signatures', desc: 'Digital contract signing' },
      ],
    },
    {
      group: 'analytics', label: 'Analytics',
      features: [
        { key: 'dashboard', label: 'Dashboard', desc: 'Organization performance overview' },
        { key: 'reports', label: 'Reports', desc: 'Generate compliance reports' },
        { key: 'export', label: 'Data Export', desc: 'Export data to CSV/PDF' },
      ],
    },
    {
      group: 'branding', label: 'Branding',
      features: [
        { key: 'custom_branding', label: 'Custom Branding', desc: 'Custom logo and colors' },
        { key: 'custom_domain', label: 'Custom Domain', desc: 'Use your own domain' },
      ],
    },
  ];

  /** Build default feature map (all false) from the group definitions */
  const getDefaultFeatureMap = () => {
    const map: Record<string, boolean> = {};
    for (const group of PLAN_FEATURE_GROUPS) {
      for (const feat of group.features) {
        map[feat.key] = false;
      }
    }
    return map;
  };

  // B2B — Contracts
  const [contracts, setContracts] = useState<any[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractSearch, setContractSearch] = useState('');
  const [contractStatusFilter, setContractStatusFilter] = useState('');

  // B2B — Billing
  const [billingTab, setBillingTab] = useState<'invoices' | 'history'>('invoices');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('');
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [billingHistoryLoading, setBillingHistoryLoading] = useState(false);

  // B2B — Compliance
  const [complianceReports, setComplianceReports] = useState<any[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);

  // B2B — Hiring
  const [hiringTab, setHiringTab] = useState<'jobs' | 'applications'>('jobs');
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('');
  const [applications, setApplications] = useState<any[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationStatusFilter, setApplicationStatusFilter] = useState('');

  // Service Fee
  const [serviceFeePct, setServiceFeePct] = useState(5);
  const [savingServiceFee, setSavingServiceFee] = useState(false);

  // Listings management
  const [adminListings, setAdminListings] = useState<any[]>([]);
  const [listingStatusFilter, setListingStatusFilter] = useState('');
  const [loadingListings, setLoadingListings] = useState(false);
  const [listingTTLDays, setListingTTLDays] = useState(0);
  const [runningExpiryCheck, setRunningExpiryCheck] = useState(false);
  const [savingListingTTL, setSavingListingTTL] = useState(false);

  // Projects management
  const [adminProjects, setAdminProjects] = useState<any[]>([]);
  const [projectStatusFilter, setProjectStatusFilter] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Admin action dialog (edit/delete with reason)
  const [adminAction, setAdminAction] = useState<{ type: 'edit' | 'delete'; entity: 'listing' | 'project'; id: string; title: string; currentStatus?: string } | null>(null);
  const [adminReason, setAdminReason] = useState('');
  const [adminNewStatus, setAdminNewStatus] = useState('');
  const [processingAdminAction, setProcessingAdminAction] = useState(false);

  // Auth
  const [loginEmail, setLoginEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [loginPassword, setLoginPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showTestAccounts, setShowTestAccounts] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const testAccounts = [
    { role: 'Admin', email: 'admin@skillbridge.africa', password: 'Admin@123456' },
    { role: 'Student', email: 'sarah.j@example.com', password: 'User@123456' },
    { role: 'Organization', email: 'hr@techvista.io', password: 'Org@123456' },
  ];

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  };

  // Disputes
  const [disputedOrders, setDisputedOrders] = useState<AdminOrder[]>([]);
  const [resolvingDispute, setResolvingDispute] = useState<string | null>(null);
  const [disputeAction, setDisputeAction] = useState<'refund' | 'release' | null>(null);

  const isAdminAccess = Boolean(
    user && (
      hasPermission('access_admin') ||
      user.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()
    )
  );

  useEffect(() => {
    if (authLoading || permLoading) return;
    if (user && isAdminAccess) {
      setCheckingAuth(false);
      fetchAll();
    } else {
      setCheckingAuth(false);
    }
  }, [user, profile, authLoading, isAdminAccess, permLoading]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setLoginError(null);

    const timeout = setTimeout(() => {
      setLoginError('Request timed out. Check your connection and Supabase credentials.');
      setSigningIn(false);
    }, 15000);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      clearTimeout(timeout);
      if (error) throw error;
      setSigningIn(false);
    } catch (err) {
      clearTimeout(timeout);
      setLoginError(err instanceof Error ? err.message : 'Login failed. Check your credentials.');
      setSigningIn(false);
    }
  };

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [svcRes, ordRes, usrRes, ptRes, statsRes] = await Promise.all([
        adminApi.services().catch(() => supabase.from('services').select('*').order('name')),
        supabase
          .from('orders')
          .select('*, listing:marketplace_listings(title), buyer:profiles!buyer_id(id, full_name), provider:profiles!provider_id(id, full_name)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('profiles')
          .select('id, full_name, role, headline, avatar_url, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
        getPayouts(),
        adminApi.stats().catch(() => null),
      ]);

      if (statsRes?.data?.total_users != null) {
        setTotalUsersCount(statsRes.data.total_users);
      }

      if (svcRes.error) throw svcRes.error;
      if (ordRes.error) throw ordRes.error;
      if (usrRes.error) throw usrRes.error;

      setServices(svcRes.data || []);
      setOrders(ordRes.data as unknown as AdminOrder[]);
      setUsers(usrRes.data || []);
      setPayouts(ptRes);
      loadAiKeys();
      loadAcademyConfig();
      loadApplications();
      loadPaymentConfig();
      loadServiceFee();
      loadDisputes();
      loadOfflinePaymentConfig();
      loadExchangeRates();
      loadManualPayments();
      loadListings();
      loadProjects();
      loadListingTTL();
    } catch (error) {
      toast.error('Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  const saveService = async () => {
    if (!editingService) return;
    try {
      await adminApi.updateService(editingService.id, { name: editName, description: editDesc, base_price: editPrice });
      toast.success('Service updated');
      setEditingService(null);
      fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update');
    }
  };

  const handleDeleteService = async (service: AdminService) => {
    if (!confirm(`Delete service "${service.name}"? This action cannot be undone.`)) return;
    try {
      await adminApi.deleteService(service.id);
      toast.success('Service deleted');
      fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete service');
    }
  };

  const handlePayoutAction = async (payoutId: string, status: 'paid' | 'rejected') => {
    setProcessingPayout(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/wallet-payouts/payouts/${payoutId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: payoutNotes }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update payout');
      }

      toast.success(`Payout ${status}`);
      setSelectedPayout(null);
      setPayoutNotes('');
      fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process payout');
    } finally {
      setProcessingPayout(false);
    }
  };

  const toggleServiceActive = async (service: AdminService) => {
    try {
      await adminApi.updateService(service.id, { is_active: !service.is_active });
      toast.success(`${service.name} ${service.is_active ? 'disabled' : 'enabled'}`);
      fetchAll();
    } catch (error) {
      toast.error('Failed to toggle service');
    }
  };

  // Create service dialog
  const [creatingService, setCreatingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServicePrice, setNewServicePrice] = useState(0);
  const [newServiceCategory, setNewServiceCategory] = useState('design');
  const [creating, setCreating] = useState(false);

  const handleCreateService = async () => {
    if (!newServiceName.trim() || !newServicePrice) {
      toast.error('Name and price are required');
      return;
    }
    setCreating(true);
    try {
      await adminApi.createService({
        name: newServiceName.trim(),
        description: newServiceDesc.trim(),
        base_price: newServicePrice,
        category: newServiceCategory,
        is_active: true,
      });
      toast.success('Service created');
      setCreatingService(false);
      setNewServiceName('');
      setNewServiceDesc('');
      setNewServicePrice(0);
      setNewServiceCategory('design');
      fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create service');
    } finally {
      setCreating(false);
    }
  };

  const loadAiKeys = async () => {
    setLoadingKeys(true);
    try {
      const [keysResult, modelsResult, providersResult, settingsResult] = await Promise.all([
        get<Record<string, string>>('/ai/keys'),
        get<Record<string, string>>('/ai/models').catch(() => ({ data: {} as Record<string, string> })),
        get<{ id: string; label: string; configured: boolean; active: boolean }[]>('/ai/providers'),
        get<Record<string, unknown>>('/admin/settings'),
      ]);

      // Load API keys from /ai/keys
      const keysData = keysResult.data || {};
      setAiKeys(keysData);

      // Load model overrides from /ai/models
      const modelsData = modelsResult.data || {};
      setAiModels(modelsData);

      // Load provider status
      const providers = providersResult.data || [];
      const statusMap: Record<string, { configured: boolean; active: boolean }> = {};
      for (const p of providers) {
        statusMap[p.id] = { configured: p.configured, active: p.active };
      }
      setAiProviderStatus(statusMap);

      // Load preferred provider from site_config
      const siteSettings = settingsResult.data || {};
      const siteCfgValue = siteSettings.site_config as Record<string, unknown> | null;
      const apiKeysConfig = siteCfgValue?.api_keys as Record<string, unknown> || {};
      setPreferredProvider(String(apiKeysConfig.preferred || ''));
    } catch (err) {
      console.warn('Failed to load AI settings:', err);
    } finally {
      setLoadingKeys(false);
    }
  };

  const loadPaymentConfig = async () => {
    setLoadingPaymentConfig(true);
    try {
      const result = await get<Record<string, unknown>>('/admin/settings');
      const settings = result.data || {};
      const val = settings.payment_gateways as Record<string, { public_key: string; secret_key: string; enabled: boolean }> | null;
      if (val) {
        setPaymentGateways(val);
      }
    } catch (err) {
      console.warn('Failed to load payment config:', err);
    } finally {
      setLoadingPaymentConfig(false);
    }
  };

  const savePaymentConfig = async () => {
    setSavingPaymentConfig(true);
    try {
      await patch('/admin/settings', { key: 'payment_gateways', value: paymentGateways });
      toast.success('Payment gateway config saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSavingPaymentConfig(false);
    }
  };

  const loadServiceFee = async () => {
    try {
      const result = await get<Record<string, unknown>>('/admin/settings');
      const settings = result.data || {};
      const val = settings.service_fee as Record<string, unknown> | null;
      if (val && typeof val === 'object' && 'percentage' in val) {
        setServiceFeePct(Number(val.percentage) || 5);
      }
    } catch (err) {
      console.warn('Failed to load service fee:', err);
    }
  };

  const saveServiceFee = async () => {
    setSavingServiceFee(true);
    try {
      await patch('/admin/settings', { key: 'service_fee', value: { percentage: serviceFeePct } });
      toast.success('Service fee updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSavingServiceFee(false);
    }
  };

  const loadListingTTL = async () => {
    try {
      const result = await get<Record<string, unknown>>('/admin/settings');
      const settings = result.data || {};
      const val = settings.listing_ttl_days as number | null;
      if (val != null) setListingTTLDays(val);
    } catch { /* ignore */ }
  };

  const saveListingTTL = async () => {
    setSavingListingTTL(true);
    try {
      await patch('/admin/settings', { key: 'listing_ttl_days', value: listingTTLDays });
      toast.success('Listing TTL saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSavingListingTTL(false);
    }
  };

  const loadAcademyConfig = async () => {
    try {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'academy_config')
        .maybeSingle();
      if (data?.value && typeof data.value === 'object') {
        setAcademyConfig((prev) => ({ ...prev, ...(data.value as Partial<typeof prev>) }));
      }
    } catch { /* ignore */ }
  };

  const saveAcademyConfig = async () => {
    setSavingAcademy(true);
    try {
      const { data: existing } = await supabase
        .from('site_settings')
        .select('id')
        .eq('key', 'academy_config')
        .maybeSingle();
      if (existing) {
        await supabase.from('site_settings').update({ value: academyConfig }).eq('key', 'academy_config');
      } else {
        await supabase.from('site_settings').insert({ key: 'academy_config', value: academyConfig });
      }
      toast.success('Academy settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save academy settings');
    } finally {
      setSavingAcademy(false);
    }
  };

  const loadApplications = async () => {
    setLoadingApplications(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4001/api'}/academy/applications`, { credentials: 'include' });
      const json = await res.json();
      if (json.applications) setAcademyApplications(json.applications);
    } catch { /* ignore */ }
    finally { setLoadingApplications(false); }
  };

  const handleApproveApplication = async (id: string) => {
    setProcessingApp(id);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4001/api'}/academy/applications/${id}/approve`, { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setAcademyApplications((prev) => prev.map((a) => a.id === id ? { ...a, status: 'approved' } : a));
        toast.success('Tutor application approved');
      } else toast.error(json.error || 'Failed to approve');
    } catch { toast.error('Network error'); }
    finally { setProcessingApp(null); }
  };

  const handleRejectApplication = async (id: string) => {
    setProcessingApp(id);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4001/api'}/academy/applications/${id}/reject`, { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setAcademyApplications((prev) => prev.map((a) => a.id === id ? { ...a, status: 'rejected' } : a));
        toast.success('Tutor application rejected');
      } else toast.error(json.error || 'Failed to reject');
    } catch { toast.error('Network error'); }
    finally { setProcessingApp(null); }
  };

  const runExpiryCheck = async () => {
    setRunningExpiryCheck(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4001/api'}/admin/listings/expire-check`, { method: 'POST', credentials: 'include' });
      const json = await res.json();
      toast.success(json.message || `${json.expired} listing(s) expired`);
      loadListings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Expiry check failed');
    } finally {
      setRunningExpiryCheck(false);
    }
  };

  const loadListings = async () => {
    setLoadingListings(true);
    try {
      let query = supabase.from('marketplace_listings').select('*, service:services(id, name, slug, category), provider:profiles(id, full_name, avatar_url)').order('created_at', { ascending: false });
      if (listingStatusFilter) query = query.eq('status', listingStatusFilter);
      const { data } = await query;
      setAdminListings(data || []);
    } catch (err) {
      console.warn('Failed to load listings:', err);
    } finally {
      setLoadingListings(false);
    }
  };

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      let query = supabase.from('projects').select('*, owner:profiles(id, full_name, avatar_url)').order('created_at', { ascending: false });
      if (projectStatusFilter) query = query.eq('status', projectStatusFilter);
      const { data } = await query;
      setAdminProjects(data || []);
    } catch (err) {
      console.warn('Failed to load projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const performAdminAction = async () => {
    if (!adminAction) return;
    setProcessingAdminAction(true);
    try {
      const { data: ses } = await supabase.auth.getSession();
      const tok = ses.session?.access_token;
      if (!tok) throw new Error('Not authenticated');

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

      if (adminAction.type === 'edit') {
        const res = await fetch(`${baseUrl}/admin/${adminAction.entity}s/${adminAction.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: adminNewStatus, reason: adminReason }),
        });
        if (!res.ok) throw new Error('Failed to update');
        toast.success(`${adminAction.entity === 'listing' ? 'Listing' : 'Project'} updated`);
      } else {
        const params = new URLSearchParams();
        if (adminReason) params.set('reason', adminReason);
        const res = await fetch(`${baseUrl}/admin/${adminAction.entity}s/${adminAction.id}?${params}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } });
        if (!res.ok) throw new Error('Failed to delete');
        toast.success(`${adminAction.entity === 'listing' ? 'Listing' : 'Project'} deleted`);
      }

      setAdminAction(null);
      setAdminReason('');
      setAdminNewStatus('');
      if (adminAction.entity === 'listing') loadListings();
      else loadProjects();
      fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setProcessingAdminAction(false);
    }
  };

  const loadDisputes = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, listing:marketplace_listings(title), buyer:profiles!buyer_id(id, full_name), provider:profiles!provider_id(id, full_name)')
        .eq('status', 'disputed')
        .order('created_at', { ascending: false });
      setDisputedOrders((data || []) as unknown as AdminOrder[]);
    } catch (err) {
      console.warn('Failed to load disputed orders:', err);
    }
  };

  const loadOfflinePaymentConfig = async () => {
    setLoadingOfflinePayment(true);
    try {
      const result = await get<Record<string, unknown>>('/admin/settings');
      const settings = result.data || {};
      const val = settings.offline_payment as Record<string, unknown> | null;
      if (val) {
        setOfflinePayment({
          enabled: (val.enabled as boolean) ?? false,
          bank_name: (val.bank_name as string) || '',
          account_number: (val.account_number as string) || '',
          account_name: (val.account_name as string) || '',
          routing_number: (val.routing_number as string) || '',
          swift_code: (val.swift_code as string) || '',
          instructions: (val.instructions as string) || '',
        });
      }
    } catch (err) {
      console.warn('Failed to load offline payment config:', err);
    } finally {
      setLoadingOfflinePayment(false);
    }
  };

  const saveOfflinePaymentConfig = async () => {
    setSavingOfflinePayment(true);
    try {
      await patch('/admin/settings', { key: 'offline_payment', value: offlinePayment });
      toast.success('Offline payment config saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSavingOfflinePayment(false);
    }
  };

  const loadExchangeRates = async () => {
    setLoadingRates(true);
    try {
      const result = await get<{ base: string; rates: Record<string, number> }>('/payments/rates');
      const d = result.data;
      setRatesBaseCurrency(d.base || 'NGN');
      setExchangeRates(d.rates || {});
    } catch (err) {
      console.warn('Failed to load exchange rates:', err);
    } finally {
      setLoadingRates(false);
    }
  };

  const saveExchangeRates = async () => {
    setSavingRates(true);
    try {
      await patch('/admin/settings', {
        key: 'exchange_rates',
        value: { base: ratesBaseCurrency, rates: exchangeRates },
      });
      toast.success('Exchange rates saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSavingRates(false);
    }
  };

  const loadManualPayments = async () => {
    setLoadingManualPayments(true);
    try {
      const data = await getAdminManualPayments();
      setManualPayments(data);
    } catch (err) {
      console.warn('Failed to load manual payments:', err);
    } finally {
      setLoadingManualPayments(false);
    }
  };

  const handleApproveManualPayment = async (paymentId: string) => {
    setProcessingManualPayment(paymentId);
    try {
      await approveManualPayment(paymentId);
      toast.success('Payment approved');
      loadManualPayments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve');
    } finally {
      setProcessingManualPayment(null);
    }
  };

  const handleRejectManualPayment = async (paymentId: string) => {
    setProcessingManualPayment(paymentId);
    try {
      await rejectManualPayment(paymentId);
      toast.success('Payment rejected');
      loadManualPayments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject');
    } finally {
      setProcessingManualPayment(null);
    }
  };

  const resolveDispute = async (orderId: string, action: 'refund' | 'release') => {
    setResolvingDispute(orderId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/marketplace-orders/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action === 'refund' ? 'refunded' : 'completed' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to resolve dispute');
      }

      toast.success(`Dispute resolved: ${action === 'refund' ? 'refunded buyer' : 'released to provider'}`);
      setDisputeAction(null);
      loadDisputes();
      fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resolve dispute');
    } finally {
      setResolvingDispute(null);
    }
  };

  // ── B2B: Organizations ──
  const fetchOrgs = useCallback(async () => {
    setOrgsLoading(true);
    try {
      const result = await get<any[]>('/admin/orgs', { search: orgSearch || undefined, limit: 100 });
      setOrgs(result.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load organizations');
    } finally {
      setOrgsLoading(false);
    }
  }, [orgSearch]);

  useEffect(() => { if (user && isAdminAccess) fetchOrgs(); }, [user, isAdminAccess, fetchOrgs]);

  const handleOrgStatusUpdate = useCallback(async () => {
    if (!confirmOrgAction) return;
    setOrgStatusUpdating(true);
    try {
      await patch(`/admin/orgs/${confirmOrgAction.org.id}/status`, { status: confirmOrgAction.newStatus });
      toast.success(`Organization ${confirmOrgAction.newStatus === 'suspended' ? 'suspended' : confirmOrgAction.newStatus === 'active' ? 'reactivated' : 'disabled'} successfully`);
      setSelectedOrg(null);
      setConfirmOrgAction(null);
      fetchOrgs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update org status');
    } finally {
      setOrgStatusUpdating(false);
    }
  }, [confirmOrgAction, fetchOrgs]);

  // ── B2B: Verifications ──
  const fetchVerifications = useCallback(async () => {
    setVerificationsLoading(true);
    try {
      const result = await get<any[]>('/admin/verifications', { status: verifStatusFilter || undefined, limit: 100 });
      setVerifications(result.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load verifications');
    } finally {
      setVerificationsLoading(false);
    }
  }, [verifStatusFilter]);

  useEffect(() => { if (user && isAdminAccess) fetchVerifications(); }, [user, isAdminAccess, fetchVerifications]);

  const handleReviewVerification = async () => {
    if (!reviewingVerification || !reviewingStatus) return;
    setReviewProcessing(true);
    try {
      await patch(`/admin/verifications/${reviewingVerification.id}/review`, { status: reviewingStatus, notes: reviewNotes || undefined });
      toast.success(`Verification ${reviewingStatus}`);
      setReviewDialogOpen(false);
      setReviewingVerification(null);
      setReviewNotes('');
      setReviewingStatus(null);
      fetchVerifications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to review verification');
    } finally {
      setReviewProcessing(false);
    }
  };

  // ── B2B: Plans ──
  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const result = await get<any[]>('/admin/billing/plans');
      setPlans(result.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => { if (user && isAdminAccess) fetchPlans(); }, [user, isAdminAccess, fetchPlans]);

  const resetPlanForm = (plan?: any) => {
    const defaultFeatures = getDefaultFeatureMap();
    let planFeatures: Record<string, boolean> = { ...defaultFeatures };
    if (plan?.features) {
      if (Array.isArray(plan.features)) {
        for (const key of plan.features) {
          planFeatures[key] = true;
        }
      } else if (typeof plan.features === 'object') {
        planFeatures = { ...defaultFeatures, ...plan.features };
      }
    }
    setPlanForm({
      name: plan?.name || '', slug: plan?.slug || '', description: plan?.description || '',
      price_monthly: plan?.price_monthly ?? 0, price_yearly: plan?.price_yearly ?? 0,
      features: planFeatures, is_active: plan?.is_active ?? true, sort_order: plan?.sort_order ?? 0,
    });
  };

  const handleSavePlan = async () => {
    if (!planForm.name.trim() || !planForm.slug.trim()) return;
    setSavingPlan(true);
    try {
      // Convert Record<string, boolean> to string[] (only enabled features)
      const enabledFeatures = Object.entries(planForm.features)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);

      const body = {
        name: planForm.name.trim(), slug: planForm.slug.trim(), description: planForm.description.trim() || undefined,
        price_monthly: planForm.price_monthly, price_yearly: planForm.price_yearly,
        features: enabledFeatures,
        is_active: planForm.is_active, sort_order: planForm.sort_order,
      };
      if (editingPlan) { await patch(`/admin/billing/plans/${editingPlan.id}`, body); toast.success('Plan updated'); }
      else { await post('/admin/billing/plans', body); toast.success('Plan created'); }
      setPlanDialogOpen(false);
      setEditingPlan(null);
      fetchPlans();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to save plan'); }
    finally { setSavingPlan(false); }
  };

  const handleDeletePlan = async (plan: any) => {
    if (!confirm(`Delete plan "${plan.name}"? ${plan.is_active ? ' It will be deactivated if orgs use it.' : ''}`)) return;
    try { await del(`/admin/billing/plans/${plan.id}`); toast.success('Plan deleted'); fetchPlans(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to delete plan'); }
  };

  const handleTogglePlanActive = async (plan: any) => {
    try { await patch(`/admin/billing/plans/${plan.id}`, { is_active: !plan.is_active }); toast.success(`Plan ${plan.is_active ? 'deactivated' : 'activated'}`); fetchPlans(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to update plan'); }
  };

  // ── B2B: Contracts ──
  const fetchContracts = useCallback(async () => {
    setContractsLoading(true);
    try {
      const params: Record<string, string | number | undefined> = { limit: 100 };
      if (contractStatusFilter) params.status = contractStatusFilter;
      if (contractSearch) params.search = contractSearch;
      const result = await get<any[]>('/admin/contracts', params);
      setContracts(result.data || []);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to load contracts'); }
    finally { setContractsLoading(false); }
  }, [contractStatusFilter, contractSearch]);

  useEffect(() => { if (user && isAdminAccess) fetchContracts(); }, [user, isAdminAccess, fetchContracts]);

  const [contractSearchInput, setContractSearchInput] = useState('');
  useEffect(() => { const t = setTimeout(() => setContractSearch(contractSearchInput), 400); return () => clearTimeout(t); }, [contractSearchInput]);

  // ── B2B: Billing ──
  const fetchInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const params: Record<string, string | undefined> = {};
      if (invoiceStatusFilter) params.status = invoiceStatusFilter;
      const result = await get<any[]>('/admin/billing/invoices', params);
      setInvoices(result.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setInvoicesLoading(false);
    }
  }, [invoiceStatusFilter]);

  useEffect(() => { if (user && isAdminAccess) fetchInvoices(); }, [user, isAdminAccess, fetchInvoices]);

  const fetchBillingHistory = useCallback(async () => {
    setBillingHistoryLoading(true);
    try {
      const result = await get<any[]>('/admin/billing/history');
      setBillingHistory(result.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load billing history');
    } finally {
      setBillingHistoryLoading(false);
    }
  }, []);

  useEffect(() => { if (user && isAdminAccess) fetchBillingHistory(); }, [user, isAdminAccess, fetchBillingHistory]);

  // ── B2B: Compliance ──
  const fetchComplianceReports = useCallback(async () => {
    setComplianceLoading(true);
    try {
      const result = await get<any[]>('/admin/compliance/reports');
      setComplianceReports(result.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load compliance reports');
    } finally {
      setComplianceLoading(false);
    }
  }, []);

  useEffect(() => { if (user && isAdminAccess) fetchComplianceReports(); }, [user, isAdminAccess, fetchComplianceReports]);

  // ── B2B: Hiring ──
  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const params = new URLSearchParams();
      if (jobSearch) params.set('search', jobSearch);
      if (jobTypeFilter) params.set('type', jobTypeFilter);
      if (jobStatusFilter) params.set('status', jobStatusFilter);
      const result = await get<any[]>(`/admin/jobs?${params.toString()}`);
      setJobs(result.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load job posts');
    } finally {
      setJobsLoading(false);
    }
  }, [jobSearch, jobTypeFilter, jobStatusFilter]);

  useEffect(() => { if (user && isAdminAccess) fetchJobs(); }, [user, isAdminAccess, fetchJobs]);

  const fetchApplications = useCallback(async () => {
    setApplicationsLoading(true);
    try {
      const params = new URLSearchParams();
      if (applicationStatusFilter) params.set('status', applicationStatusFilter);
      const result = await get<any[]>(`/admin/applications?${params.toString()}`);
      setApplications(result.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setApplicationsLoading(false);
    }
  }, [applicationStatusFilter]);

  useEffect(() => { if (user && isAdminAccess) fetchApplications(); }, [user, isAdminAccess, fetchApplications]);

  // Search debounce for jobs
  const [jobSearchInput, setJobSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setJobSearch(jobSearchInput), 400);
    return () => clearTimeout(timer);
  }, [jobSearchInput]);

  // ── Export handlers ──
  const exportServices = () => {
    downloadCSV(
      services.map((s) => ({ Name: s.name, Category: CATEGORY_LABELS[s.category] || s.category, Price: s.base_price, Active: s.is_active ? 'Yes' : 'No' })),
      'services'
    );
  };

  const exportOrders = () => {
    downloadCSV(
      filteredOrders.map((o) => ({
        Service: o.listing?.title || '',
        Buyer: o.buyer?.full_name || '',
        Provider: o.provider?.full_name || '',
        Amount: o.amount,
        Status: o.status,
        Date: new Date(o.created_at).toLocaleDateString(),
      })),
      'orders'
    );
  };

  const exportPayouts = () => {
    downloadCSV(
      payouts.map((p) => ({
        User: p.profile?.full_name || '',
        Amount: p.amount,
        Bank: p.bank_name,
        Account: `${p.account_name} / ${p.account_number}`,
        Status: p.status,
        Date: new Date(p.created_at).toLocaleDateString(),
      })),
      'payouts'
    );
  };

  const saveAiKeys = async () => {
    setSavingKeys(true);
    try {
      // Save API keys via /ai/keys endpoint
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

      const keysRes = await fetch(`${baseUrl}/ai/keys`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: aiKeys }),
      });
      if (!keysRes.ok) {
        const err = await keysRes.json().catch(() => null);
        throw new Error(err?.error || 'Failed to save API keys');
      }

      // Save model overrides via /ai/models endpoint
      const modelsRes = await fetch(`${baseUrl}/ai/models`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: aiModels }),
      });
      if (!modelsRes.ok) {
        const err = await modelsRes.json().catch(() => null);
        throw new Error(err?.error || 'Failed to save AI models');
      }

      // Save preferred provider to site_config
      const result = await get<Record<string, unknown>>('/admin/settings');
      const siteSettings = result.data || {};
      const existingConfig = (siteSettings.site_config as Record<string, unknown>) || {};
      await patch('/admin/settings', {
        key: 'site_config',
        value: {
          ...existingConfig,
          api_keys: { ...((existingConfig.api_keys as Record<string, unknown>) || {}), preferred: preferredProvider },
        },
      });

      toast.success('AI settings saved');
      loadAiKeys(); // refresh
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save AI settings');
    } finally {
      setSavingKeys(false);
    }
  };

  if (authLoading || checkingAuth || isLoading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!user || !isAdminAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-sm w-full mx-4">
          <div className="text-center mb-8">
            <Shield className="w-14 h-14 text-secondary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-primary">Novaxbridge Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to manage the platform.</p>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); handleSignIn(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@skillbridge.africa"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
            {loginError && (
              <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{loginError}</p>
            )}
            <Button type="submit" className="w-full" disabled={signingIn}>
              {signingIn ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in...</>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* Test Accounts for Beta Testers */}
          <div className="mt-6 border rounded-lg">
            <button
              type="button"
              onClick={() => setShowTestAccounts(!showTestAccounts)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-secondary" />
                Test Accounts (Beta)
              </span>
              {showTestAccounts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showTestAccounts && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Use these pre-configured accounts to test the platform. Click to copy credentials.
                </p>
                {testAccounts.map((account) => (
                  <div key={account.role} className="border rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{account.role}</span>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        onClick={() => copyToClipboard(`${account.email}\n${account.password}`, account.role)}
                      >
                        {copied === account.role ? (
                          <><CheckCheck className="w-3 h-3 text-green-500" /> Copied</>
                        ) : (
                          <><Copy className="w-3 h-3" /> Copy</>
                        )}
                      </button>
                    </div>
                    <div
                      className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1"
                      onClick={() => copyToClipboard(account.email, account.role)}
                    >
                      <Mail className="w-3 h-3" />
                      <span>{account.email}</span>
                    </div>
                    <div
                      className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1"
                      onClick={() => copyToClipboard(account.password, account.role)}
                    >
                      <Lock className="w-3 h-3" />
                      <span>{account.password}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  const filteredOrders = orders.filter((o) => {
    if (orderStatus && o.status !== orderStatus) return false;
    return true;
  });

  const pendingPayouts = payouts.filter((p) => p.status === 'pending');

  const NAV_ITEMS: { value: string; label: string; icon: React.ReactNode }[] = [
    { value: 'services', label: 'Services', icon: <LayoutGrid className="w-4 h-4" /> },
    { value: 'orders', label: 'Orders', icon: <ShoppingCart className="w-4 h-4" /> },
    { value: 'listings', label: 'Listings', icon: <ShoppingCart className="w-4 h-4" /> },
    { value: 'projects', label: 'Projects', icon: <Building2 className="w-4 h-4" /> },
    { value: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { value: 'payouts', label: 'Payouts', icon: <Wallet className="w-4 h-4" /> },
    { value: 'payment-gateways', label: 'Payment', icon: <CreditCard className="w-4 h-4" /> },
    { value: 'service-fee', label: 'Fees', icon: <DollarSign className="w-4 h-4" /> },
    { value: 'disputes', label: 'Disputes', icon: <Scale className="w-4 h-4" /> },
    { value: 'ai-settings', label: 'AI Settings', icon: <Key className="w-4 h-4" /> },
    { value: 'academy', label: 'Academy', icon: <GraduationCap className="w-4 h-4" /> },
    { value: 'manual-payments', label: 'Manual Payments', icon: <Banknote className="w-4 h-4" /> },
    { value: 'cms-pages', label: 'CMS Pages', icon: <FileText className="w-4 h-4" /> },
    { value: 'connections', label: 'Connections', icon: <Users className="w-4 h-4" /> },
    { value: 'site-settings', label: 'Site Settings', icon: <Settings className="w-4 h-4" /> },
    { value: 'video-calls', label: 'Video Calls', icon: <Video className="w-4 h-4" /> },
    { value: 'messages', label: 'Messages', icon: <MessageSquare className="w-4 h-4" /> },
  ];

  const B2B_NAV_ITEMS: { value: string; label: string; icon: React.ReactNode }[] = [
    { value: 'organizations', label: 'Organizations', icon: <Building2 className="w-4 h-4" /> },
    { value: 'verifications', label: 'Verifications', icon: <Shield className="w-4 h-4" /> },
    { value: 'plans', label: 'Subscription Plans', icon: <CreditCard className="w-4 h-4" /> },
    { value: 'contracts', label: 'Contracts', icon: <FileText className="w-4 h-4" /> },
    { value: 'hiring', label: 'Hiring', icon: <Briefcase className="w-4 h-4" /> },
    { value: 'billing', label: 'Billing', icon: <DollarSign className="w-4 h-4" /> },
    { value: 'compliance', label: 'Compliance', icon: <Shield className="w-4 h-4" /> },
  ];

  const pendingManualCount = manualPayments.filter((p) => p.status === 'pending').length;
  const showPayoutBadge = pendingPayouts.length > 0;
  const showDisputeBadge = disputedOrders.length > 0;
  const showManualBadge = pendingManualCount > 0;

  return (
    <div className="flex bg-background relative items-start">

      {/* Sidebar */}
      <aside className={`sticky top-24 h-[calc(100vh-6rem)] rounded-br-2xl bg-gray-900 text-white flex flex-col transition-all duration-300 z-30 ${sidebarOpen ? 'w-56 min-w-56' : 'w-14 min-w-14'}`}>
        <div className="flex items-center justify-between px-3 py-4 border-b border-gray-700/50">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-semibold">Admin</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors ml-auto">
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.value}
              onClick={() => setActiveTab(item.value)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.value
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {item.icon}
              {sidebarOpen && <span className="truncate">{item.label}</span>}
              {sidebarOpen && item.value === 'payouts' && showPayoutBadge && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{pendingPayouts.length}</span>
              )}
              {sidebarOpen && item.value === 'disputes' && showDisputeBadge && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{disputedOrders.length}</span>
              )}
              {sidebarOpen && item.value === 'manual-payments' && showManualBadge && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{pendingManualCount}</span>
              )}
            </button>
          ))}
          {sidebarOpen && (
            <div className="pt-4 pb-1 px-3">
              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-gray-700/50"></span>
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">B2B</span>
                <span className="h-px flex-1 bg-gray-700/50"></span>
              </div>
            </div>
          )}
          {B2B_NAV_ITEMS.map((item) => (
            <button
              key={item.value}
              onClick={() => setActiveTab(item.value)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.value
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {item.icon}
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-700/50">
          {sidebarOpen && <p className="text-[10px] text-gray-500 text-center">Novaxbridge Admin</p>}
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 w-full min-w-0 transition-all duration-300`}>
        <div className="px-6 py-8 max-w-7xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
            <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">Services</span>
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <LayoutGrid className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{services.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total services</p>
            </div>
            <div className="rounded-xl border bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">Orders</span>
                <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <ShoppingCart className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{orders.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total orders</p>
            </div>
            <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">Users</span>
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Users className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{totalUsersCount || users.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Registered users</p>
            </div>
            <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">Pending Payouts</span>
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Wallet className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">{pendingPayouts.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Awaiting processing</p>
            </div>
          </div>

          {/* ═══ SERVICES ═══ */}
          {activeTab === 'services' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Services</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setCreatingService(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add Service</Button>
                    <Button variant="outline" size="sm" onClick={exportServices}><Download className="w-3.5 h-3.5 mr-1" /> Export CSV</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Base Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((svc) => (
                      <TableRow key={svc.id}>
                        <TableCell className="font-medium">{svc.name}</TableCell>
                        <TableCell>{CATEGORY_LABELS[svc.category] || svc.category}</TableCell>
                        <TableCell>₦{Number(svc.base_price).toLocaleString()}</TableCell>
                        <TableCell><Badge variant={svc.is_active ? 'default' : 'secondary'}>{svc.is_active ? 'Active' : 'Disabled'}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setEditingService(svc); setEditName(svc.name); setEditDesc(svc.description || ''); setEditPrice(svc.base_price); }}>Edit</Button>
                            <Button size="sm" variant={svc.is_active ? 'secondary' : 'default'} onClick={() => toggleServiceActive(svc)}>{svc.is_active ? 'Disable' : 'Enable'}</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteService(svc)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ═══ ORDERS ═══ */}
          {activeTab === 'orders' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Orders</CardTitle>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={exportOrders}><Download className="w-3.5 h-3.5 mr-1" /> Export CSV</Button>
                    <Select value={orderStatus} onValueChange={setOrderStatus}>
                      <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="disputed">Disputed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead><TableHead>Buyer</TableHead><TableHead>Provider</TableHead>
                      <TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((ord) => (
                      <TableRow key={ord.id}>
                        <TableCell className="max-w-[200px] truncate">{ord.listing?.title || '—'}</TableCell>
                        <TableCell>{ord.buyer?.full_name || '—'}</TableCell>
                        <TableCell>{ord.provider?.full_name || '—'}</TableCell>
                        <TableCell>₦{Number(ord.amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Select value={ord.status} onValueChange={async (newStatus) => {
                            try {
                              const { data: ses } = await supabase.auth.getSession();
                              const tok = ses.session?.access_token;
                              if (!tok) throw new Error('Not authenticated');
                              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                              const res = await fetch(`${supabaseUrl}/functions/v1/marketplace-orders/orders/${ord.id}`, {
                                method: 'PATCH', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: newStatus }),
                              });
                              if (!res.ok) throw new Error('Failed');
                              toast.success(`Order ${newStatus}`);
                              fetchAll();
                            } catch { toast.error('Failed to update order status'); }
                          }}>
                            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                              <SelectItem value="refunded">Refunded</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(ord.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" asChild>
                              <a href={`https://supabase.com/dashboard/project/krihvhyexqstphxqkljr/editor/r/orders/${ord.id}`} target="_blank" rel="noopener noreferrer"><Eye className="w-3.5 h-3.5" /></a>
                            </Button>
                            {(ord.status === 'pending' || ord.status === 'in_progress') && (
                              <Button size="sm" variant="ghost" className="text-red-500" onClick={async () => {
                                try {
                                  const { data: ses } = await supabase.auth.getSession();
                                  const tok = ses.session?.access_token;
                                  if (!tok) throw new Error('Not authenticated');
                                  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                                  const res = await fetch(`${supabaseUrl}/functions/v1/marketplace-orders/orders/${ord.id}`, {
                                    method: 'PATCH', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'cancelled' }),
                                  });
                                  if (!res.ok) throw new Error('Failed');
                                  toast.success('Order cancelled');
                                  fetchAll();
                                } catch { toast.error('Failed to cancel'); }
                              }}><XCircle className="w-3.5 h-3.5" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ═══ USERS ═══ */}
          {activeTab === 'users' && <UserManagementTab />}

          {/* ═══ PAYOUTS ═══ */}
          {activeTab === 'payouts' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Payout Requests</CardTitle>
                  <Button variant="outline" size="sm" onClick={exportPayouts}><Download className="w-3.5 h-3.5 mr-1" /> Export CSV</Button>
                </div>
              </CardHeader>
              <CardContent>
                {payouts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No payout requests yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead><TableHead>Amount</TableHead><TableHead>Bank</TableHead>
                        <TableHead>Account</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead>
                        <TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts.map((pt) => (
                        <TableRow key={pt.id}>
                          <TableCell>{pt.profile?.full_name || '—'}</TableCell>
                          <TableCell className="font-medium">₦{Number(pt.amount).toLocaleString()}</TableCell>
                          <TableCell>{pt.bank_name}</TableCell>
                          <TableCell>{pt.account_name} / {pt.account_number}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={pt.status === 'paid' ? 'bg-green-500/15 text-green-700' : pt.status === 'rejected' ? 'bg-red-500/15 text-red-700' : pt.status === 'processing' ? 'bg-blue-500/15 text-blue-700' : 'bg-yellow-500/15 text-yellow-700'}>{pt.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{pt.admin_notes || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(pt.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            {pt.status === 'pending' && (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="outline" className="text-green-600" onClick={() => setSelectedPayout(pt)}><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Process</Button>
                                <Button size="sm" variant="outline" className="text-red-600" onClick={() => handlePayoutAction(pt.id, 'rejected')}><XCircle className="w-3.5 h-3.5 mr-1" /> Reject</Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* ═══ PAYMENT GATEWAYS ═══ */}
          {activeTab === 'payment-gateways' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-secondary" /> Payment Gateway Configuration</CardTitle>
                  <Button onClick={savePaymentConfig} disabled={savingPaymentConfig} className="gap-1.5">
                    {savingPaymentConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingPaymentConfig ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-6">Configure payment gateways for your marketplace. Settings apply globally.</p>
                {loadingPaymentConfig ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-secondary" /></div>
                ) : (
                  <div className="space-y-8 max-w-2xl">
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div><h3 className="font-semibold text-base">Paystack</h3><p className="text-xs text-muted-foreground">Nigeria, Ghana</p></div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={paymentGateways.paystack?.enabled ?? true}
                            onChange={(e) => setPaymentGateways((prev) => ({ ...prev, paystack: { ...prev.paystack, enabled: e.target.checked, public_key: prev.paystack?.public_key || '', secret_key: prev.paystack?.secret_key || '' } }))}
                            className="rounded border-gray-300" />
                          <span className="text-sm">Enabled</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label className="text-xs">Public Key</Label>
                          <Input type="password" placeholder="pk_test_..." value={paymentGateways.paystack?.public_key || ''}
                            onChange={(e) => setPaymentGateways((prev) => ({ ...prev, paystack: { ...prev.paystack, public_key: e.target.value, secret_key: prev.paystack?.secret_key || '', enabled: prev.paystack?.enabled ?? true } }))}
                            className="font-mono text-xs" /></div>
                        <div className="space-y-1.5"><Label className="text-xs">Secret Key</Label>
                          <Input type="password" placeholder="sk_test_..." value={paymentGateways.paystack?.secret_key || ''}
                            onChange={(e) => setPaymentGateways((prev) => ({ ...prev, paystack: { ...prev.paystack, secret_key: e.target.value, public_key: prev.paystack?.public_key || '', enabled: prev.paystack?.enabled ?? true } }))}
                            className="font-mono text-xs" /></div>
                      </div>
                    </div>
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div><h3 className="font-semibold text-base">Flutterwave</h3><p className="text-xs text-muted-foreground">Pan-Africa</p></div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={paymentGateways.flutterwave?.enabled ?? false}
                            onChange={(e) => setPaymentGateways((prev) => ({ ...prev, flutterwave: { ...prev.flutterwave, enabled: e.target.checked, public_key: prev.flutterwave?.public_key || '', secret_key: prev.flutterwave?.secret_key || '' } }))}
                            className="rounded border-gray-300" />
                          <span className="text-sm">Enabled</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label className="text-xs">Public Key</Label>
                          <Input type="password" placeholder="FLWPUBK-..." value={paymentGateways.flutterwave?.public_key || ''}
                            onChange={(e) => setPaymentGateways((prev) => ({ ...prev, flutterwave: { ...prev.flutterwave, public_key: e.target.value, secret_key: prev.flutterwave?.secret_key || '', enabled: prev.flutterwave?.enabled ?? false } }))}
                            className="font-mono text-xs" /></div>
                        <div className="space-y-1.5"><Label className="text-xs">Secret Key</Label>
                          <Input type="password" placeholder="FLWSECK-..." value={paymentGateways.flutterwave?.secret_key || ''}
                            onChange={(e) => setPaymentGateways((prev) => ({ ...prev, flutterwave: { ...prev.flutterwave, secret_key: e.target.value, public_key: prev.flutterwave?.public_key || '', enabled: prev.flutterwave?.enabled ?? false } }))}
                            className="font-mono text-xs" /></div>
                      </div>
                    </div>
                    <Button variant="outline" onClick={loadPaymentConfig} disabled={loadingPaymentConfig}>
                      {loadingPaymentConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
                    </Button>
                    <Separator className="my-6" />
                    <div className="space-y-4 max-w-2xl">
                      <h3 className="font-semibold text-base flex items-center gap-2"><Building2 className="w-4 h-4" /> Offline / Bank Transfer Payment</h3>
                      <p className="text-sm text-muted-foreground">Configure bank account details shown to buyers who choose to pay by bank transfer.</p>
                      {loadingOfflinePayment ? (
                        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-secondary" /></div>
                      ) : (
                        <div className="space-y-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={offlinePayment.enabled} onChange={(e) => setOfflinePayment({ ...offlinePayment, enabled: e.target.checked })} className="rounded border-gray-300" />
                            <span className="text-sm">Enable bank transfer payments</span>
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5"><Label className="text-xs">Bank Name</Label><Input placeholder="e.g. GTBank" value={offlinePayment.bank_name} onChange={(e) => setOfflinePayment({ ...offlinePayment, bank_name: e.target.value })} /></div>
                            <div className="space-y-1.5"><Label className="text-xs">Account Number</Label><Input placeholder="0123456789" value={offlinePayment.account_number} onChange={(e) => setOfflinePayment({ ...offlinePayment, account_number: e.target.value })} /></div>
                            <div className="space-y-1.5"><Label className="text-xs">Account Name</Label><Input placeholder="John Doe" value={offlinePayment.account_name} onChange={(e) => setOfflinePayment({ ...offlinePayment, account_name: e.target.value })} /></div>
                            <div className="space-y-1.5"><Label className="text-xs">Routing Number</Label><Input placeholder="Optional" value={offlinePayment.routing_number} onChange={(e) => setOfflinePayment({ ...offlinePayment, routing_number: e.target.value })} /></div>
                            <div className="space-y-1.5"><Label className="text-xs">SWIFT Code</Label><Input placeholder="Optional" value={offlinePayment.swift_code} onChange={(e) => setOfflinePayment({ ...offlinePayment, swift_code: e.target.value })} /></div>
                          </div>
                          <div className="space-y-1.5"><Label className="text-xs">Payment Instructions</Label>
                            <Textarea placeholder="Please make a transfer..." value={offlinePayment.instructions} onChange={(e) => setOfflinePayment({ ...offlinePayment, instructions: e.target.value })} rows={2} /></div>
                          <Button onClick={saveOfflinePaymentConfig} disabled={savingOfflinePayment} className="gap-1.5">
                            {savingOfflinePayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {savingOfflinePayment ? 'Saving...' : 'Save Offline Config'}
                          </Button>
                        </div>
                      )}
                    </div>
                    <Separator className="my-6" />
                    <div className="space-y-4 max-w-2xl">
                      <h3 className="font-semibold text-base flex items-center gap-2"><DollarSign className="w-4 h-4" /> Exchange Rates <span className="text-xs font-normal text-muted-foreground">(base: {ratesBaseCurrency})</span></h3>
                      <p className="text-sm text-muted-foreground">Set conversion rates from {ratesBaseCurrency} to each supported currency. Used to display prices in buyers' local currencies.</p>
                      {loadingRates ? (
                        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-secondary" /></div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {Object.entries(exchangeRates).map(([code, rate]) => (
                              code === ratesBaseCurrency ? null : (
                                <div key={code} className="space-y-1">
                                  <Label className="text-xs font-medium">{code}</Label>
                                  <Input
                                    type="number" step="any" min="0"
                                    className="h-8 text-xs"
                                    value={rate || ''}
                                    onChange={(e) => setExchangeRates(prev => ({ ...prev, [code]: Number(e.target.value) || 0 }))}
                                  />
                                </div>
                              )
                            ))}
                          </div>
                          <Button onClick={saveExchangeRates} disabled={savingRates} className="gap-1.5">
                            {savingRates ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {savingRates ? 'Saving...' : 'Save Exchange Rates'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ═══ FEES ═══ */}
          {activeTab === 'service-fee' && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-secondary" /> Service Fee Configuration</CardTitle></CardHeader>
              <CardContent className="max-w-lg">
                <p className="text-sm text-muted-foreground mb-6">Set the platform commission percentage deducted from each payment before release to the provider.</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Commission Percentage</Label>
                    <div className="flex items-center gap-3">
                      <Input type="number" min={0} max={100} step={0.5} value={serviceFeePct} onChange={(e) => setServiceFeePct(Number(e.target.value))} className="w-32 text-lg font-bold" />
                      <span className="text-lg font-semibold">%</span>
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Example</p>
                    <p>Order amount: ₦10,000 &rarr; Fee: ₦{(10000 * serviceFeePct / 100).toLocaleString()} &rarr; Provider receives: ₦{(10000 - 10000 * serviceFeePct / 100).toLocaleString()}</p>
                  </div>
                  <Button onClick={saveServiceFee} disabled={savingServiceFee} className="gap-1.5">
                    {savingServiceFee ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingServiceFee ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══ DISPUTES ═══ */}
          {activeTab === 'disputes' && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Scale className="w-5 h-5 text-secondary" /> Dispute Management</CardTitle></CardHeader>
              <CardContent>
                {disputedOrders.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No disputed orders. All is well.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Service</TableHead><TableHead>Buyer</TableHead><TableHead>Provider</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {disputedOrders.map((ord) => (
                        <TableRow key={ord.id}>
                          <TableCell className="max-w-[200px] truncate">{ord.listing?.title || '-'}</TableCell>
                          <TableCell>{ord.buyer?.full_name || '-'}</TableCell>
                          <TableCell>{ord.provider?.full_name || '-'}</TableCell>
                          <TableCell className="font-medium">₦{Number(ord.amount).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(ord.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200" disabled={resolvingDispute === ord.id} onClick={() => resolveDispute(ord.id, 'release')}>
                                {resolvingDispute === ord.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />} Release
                              </Button>
                              <Button size="sm" variant="outline" className="text-purple-600 border-purple-200" disabled={resolvingDispute === ord.id} onClick={() => resolveDispute(ord.id, 'refund')}>
                                {resolvingDispute === ord.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />} Refund
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* ═══ AI SETTINGS ═══ */}
          {activeTab === 'ai-settings' && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Key className="w-5 h-5 text-secondary" /> AI Provider Configuration</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-6">
                  Configure API keys and models for AI providers. Select your preferred provider below. Use the test button to verify each key.
                </p>

                {loadingKeys ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-secondary" /></div>
                ) : (
                  <div className="space-y-4 max-w-xl">
                    {/* Preferred provider selector */}
                    <div className="mb-6 p-4 bg-muted/30 rounded-lg border">
                      <Label className="text-sm font-semibold block mb-2">Preferred AI Provider</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={preferredProvider}
                        onChange={(e) => setPreferredProvider(e.target.value)}
                      >
                        <option value="">— Select preferred provider —</option>
                        {Object.entries(AI_PROVIDER_META).map(([key, meta]) => {
                          const status = aiProviderStatus[key];
                          return (
                            <option key={key} value={key}>
                              {meta.label} {status ? (status.configured ? '(configured)' : '(no key)') : ''}
                            </option>
                          );
                        })}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        The preferred provider is used across the platform for AI features.
                        {aiProviderStatus[preferredProvider]?.active && (
                          <span className="text-green-600 font-medium"> Currently active.</span>
                        )}
                      </p>
                    </div>

                    {/* Provider cards: key + model inputs */}
                    {Object.entries(AI_PROVIDER_META).map(([key, meta]) => {
                      const testResult = testResults[key];
                      const status = aiProviderStatus[key];
                      return (
                        <div key={key} className="space-y-2 p-3 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label className="text-sm font-medium">{meta.label}</Label>
                              {status?.active && (
                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">active</span>
                              )}
                              {preferredProvider === key && !status?.active && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">preferred</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {testResult && (
                                <span className={`flex items-center gap-1 text-xs ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                                  {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                  {testResult.message}
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                disabled={testingProvider === key || !aiKeys[key]}
                                onClick={async () => {
                                  setTestingProvider(key);
                                  setTestResults((prev) => ({ ...prev, [key]: undefined as any }));
                                  try {
                                    const { data: sessionData } = await supabase.auth.getSession();
                                    const token = sessionData.session?.access_token;
                                    if (!token) throw new Error('Not authenticated');
                                    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';
                                    const res = await fetch(`${baseUrl}/ai/test`, {
                                      method: 'POST',
                                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ provider: key }),
                                    });
                                    if (res.ok) {
                                      setTestResults((prev) => ({ ...prev, [key]: { ok: true, message: 'Working' } }));
                                    } else {
                                      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                                      setTestResults((prev) => ({ ...prev, [key]: { ok: false, message: err.error || 'Test failed' } }));
                                    }
                                  } catch (err) {
                                    setTestResults((prev) => ({ ...prev, [key]: { ok: false, message: err instanceof Error ? err.message : 'Request failed' } }));
                                  } finally {
                                    setTestingProvider(null);
                                  }
                                }}
                              >
                                {testingProvider === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                Test
                              </Button>
                            </div>
                          </div>
                          <Input
                            type="password"
                            placeholder={`${meta.label} API key...`}
                            value={aiKeys[key] || ''}
                            onChange={(e) => {
                              setAiKeys((prev) => ({ ...prev, [key]: e.target.value }));
                              if (testResults[key]) setTestResults((prev) => { const n = { ...prev }; delete n[key]; return n; });
                            }}
                            className="flex-1 font-mono text-xs"
                          />
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground shrink-0 w-12">Model</Label>
                            <Input
                              type="text"
                              placeholder={meta.defaultModel}
                              value={(aiModels[key] ?? '')}
                              onChange={(e) => setAiModels((prev) => ({ ...prev, [key]: e.target.value }))}
                              className="flex-1 font-mono text-xs"
                            />
                            {(!aiModels[key]) && (
                              <span className="text-[10px] text-muted-foreground shrink-0">default: {meta.defaultModel}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex gap-2 pt-2">
                      <Button onClick={saveAiKeys} disabled={savingKeys} className="gap-1.5">
                        {savingKeys ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {savingKeys ? 'Saving...' : 'Save All'}
                      </Button>
                      <Button variant="outline" onClick={loadAiKeys} disabled={loadingKeys}>
                        {loadingKeys ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ═══ ACADEMY ═══ */}
          {activeTab === 'academy' && (
            <>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="w-5 h-5 text-secondary" /> Academy Settings</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-6 max-w-xl">

                  {/* Master toggle */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-sm font-semibold">Academy Enabled</Label>
                      <p className="text-xs text-muted-foreground">Master switch for the entire Skill Academy section</p>
                    </div>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={academyConfig.academy_enabled}
                      onChange={(e) => setAcademyConfig((prev) => ({ ...prev, academy_enabled: e.target.checked }))}
                    />
                  </div>

                  {/* Tutor applications toggle */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-sm font-semibold">Tutor Applications Open</Label>
                      <p className="text-xs text-muted-foreground">Allow users to apply as tutors</p>
                    </div>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={academyConfig.tutor_applications_enabled}
                      onChange={(e) => setAcademyConfig((prev) => ({ ...prev, tutor_applications_enabled: e.target.checked }))}
                    />
                  </div>

                  {/* Auto-approve tutors */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-sm font-semibold">Auto-Approve Tutors</Label>
                      <p className="text-xs text-muted-foreground">Skip manual review — approve tutor applications automatically</p>
                    </div>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={academyConfig.auto_approve_tutors}
                      onChange={(e) => setAcademyConfig((prev) => ({ ...prev, auto_approve_tutors: e.target.checked }))}
                    />
                  </div>

                  {/* Min course price */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Minimum Course Price</Label>
                    <Input
                      type="number"
                      min="0"
                      value={academyConfig.min_course_price}
                      onChange={(e) => setAcademyConfig((prev) => ({ ...prev, min_course_price: Number(e.target.value) }))}
                    />
                    <p className="text-xs text-muted-foreground">Minimum price tutors must set for their courses</p>
                  </div>

                  {/* Platform fee */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Platform Fee (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={academyConfig.platform_fee_percent}
                      onChange={(e) => setAcademyConfig((prev) => ({ ...prev, platform_fee_percent: Number(e.target.value) }))}
                    />
                    <p className="text-xs text-muted-foreground">Platform commission percentage on course sales</p>
                  </div>

                  {/* Save button */}
                  <Button onClick={saveAcademyConfig} disabled={savingAcademy} className="gap-1.5">
                    {savingAcademy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingAcademy ? 'Saving...' : 'Save Academy Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-secondary" /> Tutor Applications</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingApplications ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-secondary" /></div>
                ) : academyApplications.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No pending tutor applications.</p>
                ) : (
                  <div className="space-y-4">
                    {academyApplications.map((app) => (
                      <div key={app.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{app.profile?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{app.profile?.email}</p>
                          </div>
                          <Badge className={app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : app.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {app.status}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">{app.headline}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">{app.bio}</p>
                        <div className="flex flex-wrap gap-1">
                          {(app.subjects || []).map((s: string) => (
                            <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                          ))}
                        </div>
                        {app.credentials && (
                          <p className="text-xs text-muted-foreground"><strong>Credentials:</strong> {app.credentials}</p>
                        )}
                        {app.sample_lesson_url && (
                          <a href={app.sample_lesson_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Sample Lesson →</a>
                        )}
                        {app.status === 'pending' && (
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={() => handleApproveApplication(app.id)} disabled={processingApp === app.id}>
                              {processingApp === app.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-1" onClick={() => handleRejectApplication(app.id)} disabled={processingApp === app.id}>
                              {processingApp === app.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                              Reject
                            </Button>
                          </div>
                        )}
                        {app.reviewer_notes && (
                          <p className="text-xs text-muted-foreground italic">Notes: {app.reviewer_notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            </>
          )}

          {/* ═══ MANUAL PAYMENTS ═══ */}
          {activeTab === 'manual-payments' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><Banknote className="w-5 h-5 text-secondary" /> Manual Payment Verification</CardTitle>
                  <Button variant="outline" size="sm" onClick={loadManualPayments} disabled={loadingManualPayments}>
                    {loadingManualPayments ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingManualPayments ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-secondary" /></div>
                ) : manualPayments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No manual payments to verify.</p>
                ) : (
                  <div className="space-y-4">
                    {manualPayments.map((mp) => (
                      <Card key={mp.id} className={mp.status === 'pending' ? 'border-yellow-300' : ''}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="font-medium">₦{Number(mp.amount).toLocaleString()} — {mp.bank_name}</p>
                              <p className="text-sm text-muted-foreground">Buyer: {mp.buyer_id.slice(0, 8)}... | {new Date(mp.created_at).toLocaleString()}</p>
                              {mp.notes && <p className="text-sm text-muted-foreground italic">"{mp.notes}"</p>}
                            </div>
                            <Badge variant="secondary" className={mp.status === 'approved' ? 'bg-green-500/15 text-green-700' : mp.status === 'rejected' ? 'bg-red-500/15 text-red-700' : 'bg-yellow-500/15 text-yellow-700'}>{mp.status}</Badge>
                          </div>
                          {mp.screenshot_url && (
                            <div className="mt-3"><a href={mp.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-xs text-secondary hover:underline inline-flex items-center gap-1"><ImageIcon className="w-3 h-3" /> View Screenshot</a></div>
                          )}
                          {mp.status === 'pending' && (
                            <div className="flex gap-2 mt-4">
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApproveManualPayment(mp.id)} disabled={processingManualPayment === mp.id}>
                                {processingManualPayment === mp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />} Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleRejectManualPayment(mp.id)} disabled={processingManualPayment === mp.id}>
                                {processingManualPayment === mp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />} Reject
                              </Button>
                            </div>
                          )}
                          {mp.admin_notes && <p className="text-xs text-muted-foreground mt-2">Admin note: {mp.admin_notes}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ═══ LISTINGS ═══ */}
          {activeTab === 'listings' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-secondary" /> Listings Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b">
                  <Label className="text-xs whitespace-nowrap">Auto-expire after (days):</Label>
                  <Input type="number" min="0" className="w-20 h-8 text-xs" value={listingTTLDays || ''} onChange={e => setListingTTLDays(Number(e.target.value) || 0)} />
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={saveListingTTL} disabled={savingListingTTL}>
                    {savingListingTTL ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={runExpiryCheck} disabled={runningExpiryCheck}>
                    {runningExpiryCheck ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Expire Old
                  </Button>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Select value={listingStatusFilter} onValueChange={setListingStatusFilter}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="deleted">Deleted</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={loadListings} disabled={loadingListings}>
                    {loadingListings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
                  </Button>
                </div>
                {loadingListings ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : adminListings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No listings found.</p>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminListings.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">{l.title || l.service?.name}</TableCell>
                            <TableCell>{l.provider?.full_name || l.provider_id?.slice(0, 8)}</TableCell>
                            <TableCell><Badge variant={l.status === 'active' ? 'default' : 'secondary'}>{l.status}</Badge></TableCell>
                            <TableCell>₦{Number(l.price || l.service?.base_price || 0).toLocaleString()}</TableCell>
                            <TableCell>{l.service?.category || '-'}</TableCell>
                            <TableCell className="text-xs">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setAdminAction({ type: 'edit', entity: 'listing', id: l.id, title: l.title || l.service?.name, currentStatus: l.status })}>
                                  <Edit className="w-3 h-3 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600" onClick={() => setAdminAction({ type: 'delete', entity: 'listing', id: l.id, title: l.title || l.service?.name })}>
                                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ═══ PROJECTS ═══ */}
          {activeTab === 'projects' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-secondary" /> Projects Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <Select value={projectStatusFilter} onValueChange={setProjectStatusFilter}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={loadProjects} disabled={loadingProjects}>
                    {loadingProjects ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
                  </Button>
                </div>
                {loadingProjects ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : adminProjects.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No projects found.</p>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Budget</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminProjects.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">{p.title}</TableCell>
                            <TableCell>{p.owner?.full_name || p.owner_id?.slice(0, 8)}</TableCell>
                            <TableCell><Badge variant={p.status === 'completed' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell>
                            <TableCell>₦{Number(p.budget || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setAdminAction({ type: 'edit', entity: 'project', id: p.id, title: p.title, currentStatus: p.status })}>
                                  <Edit className="w-3 h-3 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600" onClick={() => setAdminAction({ type: 'delete', entity: 'project', id: p.id, title: p.title })}>
                                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ═══ SITE SETTINGS ═══ */}
          {activeTab === 'cms-pages' && <CmsPagesTab />}
          {activeTab === 'connections' && <AdminConnectionsTab />}
          {activeTab === 'site-settings' && <SiteSettingsTab />}

          {/* ═══ VIDEO CALLS ═══ */}
          {activeTab === 'video-calls' && <AdminVideoCallsTab />}

          {/* ═══ MESSAGES ═══ */}
          {activeTab === 'messages' && <AdminMessagesTab />}

          {/* ═══ B2B: ORGANIZATIONS ═══ */}
          {activeTab === 'organizations' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-secondary" /> Organization Management</CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Search by name..." className="pl-9 w-60" value={orgSearch} onChange={e => setOrgSearch(e.target.value)} />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { const csv = orgs.map((o: any) => ({ Name: o.name, Industry: o.industry || '—', Size: o.size || '—', Members: o.member_count ?? 0, Plan: o.plan?.name || 'Free', Created: new Date(o.created_at).toLocaleDateString() })); downloadCSV(csv, 'organizations'); }}>
                      <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {orgsLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-600" /></div>
                : orgs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Building2 className="w-12 h-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No Organizations Yet</h3>
                    <p className="text-sm text-muted-foreground max-w-md">Organizations will appear here once users sign up and create one.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Name</TableHead><TableHead>Industry</TableHead><TableHead>Size</TableHead><TableHead>Members</TableHead><TableHead>Plan</TableHead><TableHead>Created</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgs.map((org: any) => (
                        <TableRow key={org.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedOrg(org)}>
                          <TableCell className="font-medium text-purple-600 hover:underline">{org.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{org.industry || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{org.size || '—'}</TableCell>
                          <TableCell><Badge variant="secondary">{org.member_count ?? 0}</Badge></TableCell>
                          <TableCell><Badge variant={org.plan ? 'default' : 'outline'}>{org.plan?.name || 'Free'}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* ═══ B2B: VERIFICATIONS ═══ */}
          {activeTab === 'verifications' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-secondary" /> Org Verification Queue</CardTitle>
                  <div className="flex items-center gap-2">
                    {['pending', 'verified', 'rejected'].map(s => (
                      <Button key={s} size="sm" variant={verifStatusFilter === s ? 'default' : 'outline'}
                        className={verifStatusFilter === s ? '' : 'text-muted-foreground'} onClick={() => setVerifStatusFilter(s)}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {verificationsLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-600" /></div>
                : verifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Shield className="w-12 h-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No {verifStatusFilter} verifications</h3>
                    <p className="text-sm text-muted-foreground max-w-md">No organizations have submitted verification requests yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Organization</TableHead><TableHead>Business Name</TableHead><TableHead>Reg Number</TableHead><TableHead>Tax ID</TableHead><TableHead>Documents</TableHead><TableHead>Submitted</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {verifications.map((v: any) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">{v.organization?.name || v.org_id?.slice(0, 8) || '—'}</TableCell>
                          <TableCell className="text-sm">{v.business_name || '—'}</TableCell>
                          <TableCell className="text-sm font-mono">{v.registration_number || '—'}</TableCell>
                          <TableCell className="text-sm font-mono">{v.tax_id || '—'}</TableCell>
                          <TableCell>{v.document_urls?.length > 0 ? v.document_urls.map((url: string, i: number) => (<a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:underline flex items-center gap-0.5"><FileText className="w-3 h-3" /> Doc {i + 1}</a>)) : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            {v.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => { setReviewingVerification(v); setReviewingStatus('verified'); setReviewDialogOpen(true); }}><CheckCircle2 className="w-3 h-3 mr-0.5" /> Approve</Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => { setReviewingVerification(v); setReviewingStatus('rejected'); setReviewDialogOpen(true); }}><XCircle className="w-3 h-3 mr-0.5" /> Reject</Button>
                              </div>
                            ) : v.status === 'verified' ? <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">Verified</Badge>
                            : <Badge variant="outline" className="text-xs text-red-600 border-red-200">Rejected</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* ═══ B2B: PLANS ═══ */}
          {activeTab === 'plans' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-secondary" /> Subscription Plans</CardTitle>
                  <Button size="sm" onClick={() => { setEditingPlan(null); resetPlanForm(); setPlanDialogOpen(true); }}><CreditCard className="w-3.5 h-3.5 mr-1" /> Create Plan</Button>
                </div>
              </CardHeader>
              <CardContent>
                {plansLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-600" /></div>
                : plans.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <CreditCard className="w-12 h-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No Plans Yet</h3>
                    <p className="text-sm text-muted-foreground max-w-md">Create your first subscription plan.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Name</TableHead><TableHead>Slug</TableHead><TableHead>Monthly</TableHead><TableHead>Yearly</TableHead><TableHead>Active Features</TableHead><TableHead>Active</TableHead><TableHead>Sort</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map((plan: any) => (
                        <TableRow key={plan.id} className={plan.is_active ? '' : 'opacity-50'}>
                          <TableCell className="font-medium">{plan.name}</TableCell>
                          <TableCell className="text-sm font-mono text-muted-foreground">{plan.slug}</TableCell>
                          <TableCell>${Number(plan.price_monthly).toFixed(2)}</TableCell>
                          <TableCell>${Number(plan.price_yearly).toFixed(2)}</TableCell>
                          <TableCell className="max-w-[200px]">
                            <div className="flex flex-wrap gap-1">
                              {(() => {
                                const fm = (typeof plan.features === 'object' && plan.features !== null) ? plan.features : {};
                                const enabledKeys = Object.keys(fm).filter(k => fm[k]);
                                // Show up to 4 enabled features, or "No features" if none
                                if (enabledKeys.length === 0) return <span className="text-xs text-muted-foreground italic">No features</span>;
                                const labelMap: Record<string, string> = {};
                                for (const g of PLAN_FEATURE_GROUPS) for (const f of g.features) labelMap[f.key] = f.label;
                                return enabledKeys.slice(0, 4).map((k: string) => (
                                  <Badge key={k} variant="secondary" className="text-xs">{labelMap[k] || k}</Badge>
                                ));
                              })()}
                              {(() => {
                                const fm = (typeof plan.features === 'object' && plan.features !== null) ? plan.features : {};
                                const cnt = Object.keys(fm).filter(k => fm[k]).length;
                                return cnt > 4 && <Badge variant="outline" className="text-xs">+{cnt - 4}</Badge>;
                              })()}
                            </div>
                          </TableCell>
                          <TableCell><Button size="sm" variant={plan.is_active ? 'default' : 'outline'} className="h-6 text-xs px-2" onClick={() => handleTogglePlanActive(plan)}>{plan.is_active ? 'Active' : 'Inactive'}</Button></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{plan.sort_order}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingPlan(plan); resetPlanForm(plan); setPlanDialogOpen(true); }}><Settings className="w-3.5 h-3.5" /></Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDeletePlan(plan)}><XCircle className="w-3.5 h-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* ═══ B2B: CONTRACTS ═══ */}
          {activeTab === 'contracts' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-secondary" /> Contracts</CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Search by title..." className="pl-9 w-56" value={contractSearchInput} onChange={e => setContractSearchInput(e.target.value)} />
                    </div>
                    <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={contractStatusFilter} onChange={e => setContractStatusFilter(e.target.value)}>
                      <option value="">All statuses</option>
                      <option value="draft">Draft</option><option value="sent">Sent</option><option value="signed">Signed</option>
                      <option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {contractsLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-600" /></div>
                : contracts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No Contracts Found</h3>
                    <p className="text-sm text-muted-foreground max-w-md">No contracts match your current filters.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Organization</TableHead><TableHead>Title</TableHead><TableHead>Talent</TableHead><TableHead>Type</TableHead><TableHead>Value</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-sm">{c.organization?.name || c.org_id?.slice(0, 8)}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{c.title}</TableCell>
                          <TableCell className="text-sm">{c.talent?.full_name || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.contract_type?.replace(/_/g, ' ')}</TableCell>
                          <TableCell className="text-sm font-medium">{c.currency || 'NGN'} {Number(c.total_value || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={c.status === 'active' || c.status === 'completed' ? 'default' : c.status === 'draft' || c.status === 'sent' ? 'secondary' : 'outline'}
                              className={`text-xs ${c.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' : c.status === 'active' ? 'bg-blue-100 text-blue-800 border-blue-200' : c.status === 'cancelled' ? 'text-red-600 border-red-200' : ''}`}>{c.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* ═══ B2B: BILLING ═══ */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-border pb-1">
                <button onClick={() => setBillingTab('invoices')} className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[3px] ${billingTab === 'invoices' ? 'border-purple-600 text-purple-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Invoices</button>
                <button onClick={() => setBillingTab('history')} className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[3px] ${billingTab === 'history' ? 'border-purple-600 text-purple-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Billing History</button>
              </div>

              {billingTab === 'invoices' && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-secondary" /> Invoices</CardTitle>
                      <div className="flex items-center gap-2">
                        {['', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'].map(s => (
                          <Button key={s} size="sm" variant={invoiceStatusFilter === s ? 'default' : 'outline'}
                            className={invoiceStatusFilter === s ? '' : 'text-muted-foreground'}
                            onClick={() => setInvoiceStatusFilter(s)}>
                            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {invoicesLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-600" /></div>
                    : invoices.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <DollarSign className="w-12 h-12 text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Invoices</h3>
                        <p className="text-sm text-muted-foreground max-w-md">No billing invoices match your filters.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Organization</TableHead><TableHead>Invoice #</TableHead><TableHead>Plan</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Period</TableHead><TableHead>Paid At</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoices.map((inv: any) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium text-sm">{inv.organization?.name || inv.org_id?.slice(0, 8)}</TableCell>
                              <TableCell className="text-sm font-mono text-muted-foreground">{inv.invoice_number}</TableCell>
                              <TableCell className="text-sm">{inv.plan?.name || '—'}</TableCell>
                              <TableCell className="text-sm font-medium">{inv.currency || 'USD'} {Number(inv.amount || 0).toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'pending' ? 'secondary' : 'outline'}
                                  className={`text-xs ${inv.status === 'paid' ? 'bg-green-100 text-green-800 border-green-200' : inv.status === 'overdue' ? 'text-red-600 border-red-200' : ''}`}>{inv.status}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{inv.period_start ? `${new Date(inv.period_start).toLocaleDateString()} – ${inv.period_end ? new Date(inv.period_end).toLocaleDateString() : '…'}` : '—'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}

              {billingTab === 'history' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-secondary" /> Billing History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {billingHistoryLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-600" /></div>
                    : billingHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <CreditCard className="w-12 h-12 text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Billing History</h3>
                        <p className="text-sm text-muted-foreground max-w-md">Billing changes and plan updates will appear here.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Organization</TableHead><TableHead>Action</TableHead><TableHead>From Plan</TableHead><TableHead>To Plan</TableHead><TableHead>Amount</TableHead><TableHead>By</TableHead><TableHead>Date</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {billingHistory.map((h: any) => (
                            <TableRow key={h.id}>
                              <TableCell className="font-medium text-sm">{h.organization?.name || h.org_id?.slice(0, 8)}</TableCell>
                              <TableCell className="text-sm capitalize">{h.change_type?.replace(/_/g, ' ') || h.action || '—'}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{h.from_plan?.name || '—'}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{h.to_plan?.name || '—'}</TableCell>
                              <TableCell className="text-sm font-medium">{h.amount ? `${h.currency || 'USD'} ${Number(h.amount).toLocaleString()}` : '—'}</TableCell>
                              <TableCell className="text-sm">{h.changed_by_user?.full_name || (h.changed_by?.slice(0, 8)) || '—'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ═══ B2B: HIRING ═══ */}
          {activeTab === 'hiring' && (
            <div className="space-y-4">
              {/* Sub-tabs */}
              <div className="flex gap-4 border-b pb-1">
                <button onClick={() => setHiringTab('jobs')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[3px] ${hiringTab === 'jobs' ? 'border-purple-600 text-purple-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  Job Posts
                </button>
                <button onClick={() => setHiringTab('applications')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[3px] ${hiringTab === 'applications' ? 'border-purple-600 text-purple-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  Pipeline Applications
                </button>
              </div>

              {/* Job Posts */}
              {hiringTab === 'jobs' && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <CardTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-secondary" /> Job Posts</CardTitle>
                      <div className="flex items-center gap-3">
                        <Input placeholder="Search jobs..." className="max-w-[200px] h-8 text-sm"
                          value={jobSearchInput} onChange={(e) => setJobSearchInput(e.target.value)} />
                        <select value={jobTypeFilter} onChange={(e) => setJobTypeFilter(e.target.value)}
                          className="h-8 text-sm border rounded px-2 bg-background">
                          <option value="">All Types</option>
                          <option value="part-time">Part-time</option>
                          <option value="internship">Internship</option>
                        </select>
                        <select value={jobStatusFilter} onChange={(e) => setJobStatusFilter(e.target.value)}
                          className="h-8 text-sm border rounded px-2 bg-background">
                          <option value="">All Status</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {jobsLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-600" /></div>
                    : jobs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Briefcase className="w-12 h-12 text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Job Posts</h3>
                        <p className="text-sm text-muted-foreground max-w-md">No jobs have been created across organizations yet.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Title</TableHead><TableHead>Organization</TableHead><TableHead>Company</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobs.map((j: any) => (
                            <TableRow key={j.id}>
                              <TableCell className="font-medium text-sm max-w-[250px] truncate">{j.title}</TableCell>
                              <TableCell className="text-sm">{j.organization?.name || j.org_id?.slice(0, 8) || '—'}</TableCell>
                              <TableCell className="text-sm">{j.company?.company_name || j.company?.full_name || '—'}</TableCell>
                              <TableCell className="text-sm capitalize">{j.type}</TableCell>
                              <TableCell>
                                <Badge className={j.is_active ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-100'}>{j.is_active ? 'Active' : 'Inactive'}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{new Date(j.created_at).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Pipeline Applications */}
              {hiringTab === 'applications' && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-secondary" /> Pipeline Applications</CardTitle>
                      <div className="flex items-center gap-3">
                        <select value={applicationStatusFilter} onChange={(e) => setApplicationStatusFilter(e.target.value)}
                          className="h-8 text-sm border rounded px-2 bg-background">
                          <option value="">All Status</option>
                          <option value="pending">Pending</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {applicationsLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-600" /></div>
                    : applications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Users className="w-12 h-12 text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Applications</h3>
                        <p className="text-sm text-muted-foreground max-w-md">Job applications from all organizations will appear here.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Applicant</TableHead><TableHead>Job Title</TableHead><TableHead>Organization</TableHead><TableHead>Stage</TableHead><TableHead>Date</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {applications.map((a: any) => (
                            <TableRow key={a.id}>
                              <TableCell className="font-medium text-sm">{a.student?.full_name || a.student_id?.slice(0, 8)}</TableCell>
                              <TableCell className="text-sm max-w-[250px] truncate">{a.job?.title || '—'}</TableCell>
                              <TableCell className="text-sm">{a.job?.organization?.name || '—'}</TableCell>
                              <TableCell>
                                <Badge className={
                                  a.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                  a.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                  a.status === 'reviewed' ? 'bg-blue-100 text-blue-600' :
                                  'bg-yellow-100 text-yellow-700'
                                }>{a.status}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ═══ B2B: COMPLIANCE ═══ */}
          {activeTab === 'compliance' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-secondary" /> Compliance Reports</CardTitle>
              </CardHeader>
              <CardContent>
                {complianceLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-600" /></div>
                : complianceReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Shield className="w-12 h-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No Compliance Reports</h3>
                    <p className="text-sm text-muted-foreground max-w-md">Compliance reports generated by organizations will appear here.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Organization</TableHead><TableHead>Report Type</TableHead><TableHead>Title</TableHead><TableHead>Generated At</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {complianceReports.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-sm">{r.organization?.name || r.org_id?.slice(0, 8)}</TableCell>
                          <TableCell className="text-sm capitalize">{r.report_type?.replace(/_/g, ' ')}</TableCell>
                          <TableCell className="text-sm max-w-[300px] truncate">{r.title || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.generated_at ? new Date(r.generated_at).toLocaleDateString() : new Date(r.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Service Dialog */}
      <Dialog open={!!editingService} onOpenChange={(o) => !o && setEditingService(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Service</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /></div>
            <div className="space-y-2"><Label>Base Price (₦)</Label><Input type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingService(null)}>Cancel</Button>
            <Button onClick={saveService}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Service Dialog */}
      <Dialog open={creatingService} onOpenChange={(o) => { if (!o) { setCreatingService(false); setNewServiceName(''); setNewServiceDesc(''); setNewServicePrice(0); setNewServiceCategory('design'); }}}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Service</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Name</Label><Input value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} placeholder="Service name" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={newServiceDesc} onChange={(e) => setNewServiceDesc(e.target.value)} placeholder="Service description" /></div>
            <div className="space-y-2"><Label>Category</Label>
              <Select value={newServiceCategory} onValueChange={setNewServiceCategory}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Base Price (₦)</Label><Input type="number" min="0" value={newServicePrice} onChange={(e) => setNewServicePrice(Number(e.target.value))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreatingService(false); setNewServiceName(''); setNewServiceDesc(''); setNewServicePrice(0); setNewServiceCategory('design'); }}>Cancel</Button>
            <Button onClick={handleCreateService} disabled={creating || !newServiceName.trim() || !newServicePrice}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Action Dialog */}
      <Dialog open={!!adminAction} onOpenChange={(o) => !o && setAdminAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adminAction?.type === 'edit' ? 'Edit' : 'Delete'} {adminAction?.entity === 'listing' ? 'Listing' : 'Project'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              <strong>Title:</strong> {adminAction?.title}
            </p>
            {adminAction?.type === 'edit' && (
              <div className="space-y-2">
                <Label>New Status</Label>
                <div className="flex gap-2 flex-wrap">
                  {(adminAction?.entity === 'listing'
                    ? ['active', 'inactive', 'paused']
                    : ['open', 'in_progress', 'completed', 'cancelled']
                  ).map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant={adminNewStatus === s ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAdminNewStatus(s)}
                    >
                      {s.replace('_', ' ')}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Reason (optional, sent to {adminAction?.entity === 'listing' ? 'provider' : 'owner'})</Label>
              <Textarea
                placeholder="Explain why this action is being taken..."
                value={adminReason}
                onChange={(e) => setAdminReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminAction(null)}>Cancel</Button>
            <Button
              disabled={processingAdminAction || (adminAction?.type === 'edit' && !adminNewStatus)}
              className={adminAction?.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
              onClick={performAdminAction}
            >
              {processingAdminAction ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {adminAction?.type === 'edit' ? 'Update Status' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process Payout Dialog */}
      <Dialog open={!!selectedPayout} onOpenChange={(o) => !o && setSelectedPayout(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Process Payout</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm">Pay <strong>₦{Number(selectedPayout?.amount || 0).toLocaleString()}</strong> to <strong>{selectedPayout?.account_name}</strong> at <strong>{selectedPayout?.bank_name}</strong> ({selectedPayout?.account_number})</p>
            <div className="space-y-2"><Label>Admin Notes</Label><Textarea placeholder="Optional notes about this payout..." value={payoutNotes} onChange={(e) => setPayoutNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPayout(null)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" disabled={processingPayout} onClick={() => handlePayoutAction(selectedPayout!.id, 'paid')}>
              {processingPayout ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Mark as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ B2B: Org Detail Dialog ═══ */}
      <Dialog open={!!selectedOrg} onOpenChange={(o) => { if (!o) setSelectedOrg(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-secondary" /> {selectedOrg?.name || 'Organization'}</DialogTitle>
          </DialogHeader>
          {selectedOrg && (
            <div className="space-y-4">
              {selectedOrg.slug && <p className="text-xs font-mono text-muted-foreground">/{selectedOrg.slug}</p>}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <div className="flex items-center gap-2">
                  <Badge variant={selectedOrg.status === 'active' ? 'default' : selectedOrg.status === 'suspended' ? 'secondary' : 'outline'} className={selectedOrg.status === 'suspended' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : selectedOrg.status === 'disabled' ? 'bg-red-100 text-red-700' : ''}>{selectedOrg.status || 'active'}</Badge>
                  {selectedOrg.status === 'active' && (
                    <Button size="sm" variant="outline" className="h-7 text-xs text-yellow-600 border-yellow-200 hover:bg-yellow-50" onClick={() => setConfirmOrgAction({ org: selectedOrg, newStatus: 'suspended' })}>
                      Suspend
                    </Button>
                  )}
                  {(selectedOrg.status === 'suspended' || selectedOrg.status === 'disabled') && (
                    <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50" onClick={() => setConfirmOrgAction({ org: selectedOrg, newStatus: 'active' })}>
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-xs font-medium text-muted-foreground uppercase">Industry</span><p className="text-sm font-medium mt-1">{selectedOrg.industry || '—'}</p></div>
                <div><span className="text-xs font-medium text-muted-foreground uppercase">Size</span><p className="text-sm font-medium mt-1">{selectedOrg.size || '—'}</p></div>
              </div>
              {selectedOrg.description && <div><span className="text-xs font-medium text-muted-foreground uppercase">Description</span><p className="text-sm mt-1 text-gray-700">{selectedOrg.description}</p></div>}
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-xs font-medium text-muted-foreground uppercase">Plan</span><div className="mt-1"><Badge variant={selectedOrg.plan ? 'default' : 'outline'}>{selectedOrg.plan?.name || 'Free'}</Badge></div>{selectedOrg.plan && <p className="text-xs text-muted-foreground mt-1">{selectedOrg.plan.interval === 'month' ? 'Monthly' : 'Yearly'} · ${Number(selectedOrg.plan.price).toFixed(2)}</p>}</div>
                <div><span className="text-xs font-medium text-muted-foreground uppercase">Members</span><p className="text-lg font-semibold mt-1">{selectedOrg.member_count ?? 0}</p></div>
              </div>
              {selectedOrg.subscription_status && <div><span className="text-xs font-medium text-muted-foreground uppercase">Subscription</span><Badge className="mt-1" variant={selectedOrg.subscription_status === 'active' ? 'default' : 'secondary'}>{selectedOrg.subscription_status}</Badge></div>}
              <Separator />
              {selectedOrg.website_url && <div><span className="text-xs font-medium text-muted-foreground uppercase">Website</span><a href={selectedOrg.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-purple-600 hover:underline mt-1"><ExternalLink className="w-3.5 h-3.5" />{selectedOrg.website_url}</a></div>}
              <Separator />
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase mb-2 block">Branding</span>
                {selectedOrg.logo_url ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                    <Avatar className="w-14 h-14 rounded-lg border bg-white">
                      <AvatarImage src={selectedOrg.logo_url} alt={`${selectedOrg.name} logo`} />
                      <AvatarFallback className="rounded-lg text-base font-semibold bg-purple-100 text-purple-700">{(selectedOrg.name || '?').charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-gray-700">Logo</p>
                      <p className="truncate max-w-[280px]">{selectedOrg.logo_url}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No logo uploaded</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="w-3.5 h-3.5" /> Created {new Date(selectedOrg.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ B2B: Org Status Confirm Dialog ═══ */}
      <Dialog open={!!confirmOrgAction} onOpenChange={(o) => { if (!o) setConfirmOrgAction(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmOrgAction?.newStatus === 'suspended' ? <Shield className="w-4 h-4 text-yellow-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
              {confirmOrgAction?.newStatus === 'suspended' ? 'Suspend Organization' : confirmOrgAction?.newStatus === 'active' ? 'Reactivate Organization' : 'Disable Organization'}
            </DialogTitle>
          </DialogHeader>
          {confirmOrgAction && (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                {confirmOrgAction.newStatus === 'suspended'
                  ? `Are you sure you want to suspend ${confirmOrgAction.org.name}? Members will lose access to B2B features until reactivated.`
                  : confirmOrgAction.newStatus === 'active'
                    ? `Are you sure you want to reactivate ${confirmOrgAction.org.name}? Members will regain access to B2B features.`
                    : `Are you sure you want to disable ${confirmOrgAction.org.name}?`}
              </p>
              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setConfirmOrgAction(null)} disabled={orgStatusUpdating}>Cancel</Button>
                <Button className={confirmOrgAction.newStatus === 'suspended' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} onClick={handleOrgStatusUpdate} disabled={orgStatusUpdating}>
                  {orgStatusUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {confirmOrgAction.newStatus === 'suspended' ? 'Suspend' : confirmOrgAction.newStatus === 'active' ? 'Reactivate' : 'Disable'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ B2B: Review Verification Dialog ═══ */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield className="w-4 h-4 text-secondary" /> {reviewingStatus === 'verified' ? 'Approve' : 'Reject'} Verification</DialogTitle></DialogHeader>
          {reviewingVerification && (
            <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
              {/* Submission Summary */}
              <div className="rounded-lg border bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Submission Details</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Organization</span><p className="font-medium">{reviewingVerification.organization?.name || '—'}</p></div>
                  <div><span className="text-muted-foreground">Business Name</span><p className="font-medium">{reviewingVerification.business_name || '—'}</p></div>
                  <div><span className="text-muted-foreground">Registration #</span><p className="font-mono text-xs">{reviewingVerification.registration_number || '—'}</p></div>
                  <div><span className="text-muted-foreground">Tax ID</span><p className="font-mono text-xs">{reviewingVerification.tax_id || '—'}</p></div>
                  <div><span className="text-muted-foreground">Submitted</span><p className="text-xs">{new Date(reviewingVerification.created_at).toLocaleString()}</p></div>
                  <div><span className="text-muted-foreground">Status</span><Badge variant="outline" className={`text-xs capitalize ${
                    reviewingVerification.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                    reviewingVerification.status === 'verified' ? 'bg-green-50 text-green-700 border-green-200' :
                    'bg-red-50 text-red-700 border-red-200'
                  }`}>{reviewingVerification.status}</Badge></div>
                </div>
              </div>

              {/* Submitted Documents */}
              {reviewingVerification.document_urls?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Documents ({reviewingVerification.document_urls.length})</p>
                  <div className="grid grid-cols-1 gap-2">
                    {reviewingVerification.document_urls.map((url: string, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-white">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-5 h-5 text-purple-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">Document {i + 1}</p>
                            <p className="text-xs text-gray-400 truncate">{url.split('/').pop() || url}</p>
                          </div>
                        </div>
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors">
                          <ExternalLink className="w-3 h-3" />
                          View
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Notes */}
              <Separator />
              <div>
                <Label>Review Notes</Label>
                <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Add notes about this decision..." rows={3} className="mt-1" />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setReviewDialogOpen(false)} disabled={reviewProcessing}>Cancel</Button>
                <Button className={reviewingStatus === 'verified' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} onClick={handleReviewVerification} disabled={reviewProcessing}>
                  {reviewProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} {reviewingStatus === 'verified' ? 'Approve' : 'Reject'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ B2B: Plan Dialog ═══ */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-secondary" /> {editingPlan ? 'Edit Plan' : 'Create Plan'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} placeholder="Pro Plan" /></div>
              <div><Label>Slug *</Label><Input value={planForm.slug} onChange={e => setPlanForm(p => ({ ...p, slug: e.target.value }))} placeholder="pro" /></div>
            </div>
            <div><Label>Description</Label><Input value={planForm.description} onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))} placeholder="Best for growing teams" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Monthly Price ($)</Label><Input type="number" min={0} step={0.01} value={planForm.price_monthly} onChange={e => setPlanForm(p => ({ ...p, price_monthly: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Yearly Price ($)</Label><Input type="number" min={0} step={0.01} value={planForm.price_yearly} onChange={e => setPlanForm(p => ({ ...p, price_yearly: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div>
              <Label className="mb-2 block">Plan Features</Label>
              <div className="space-y-3 border rounded-lg p-3 max-h-64 overflow-y-auto">
                {PLAN_FEATURE_GROUPS.map((group) => (
                  <div key={group.group}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{group.label}</p>
                    <div className="grid grid-cols-1 gap-1">
                      {group.features.map((feat) => (
                        <label key={feat.key} className="flex items-center gap-2 cursor-pointer py-0.5 px-1 rounded hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={!!planForm.features[feat.key]}
                            onChange={(e) => setPlanForm(p => ({ ...p, features: { ...p.features, [feat.key]: e.target.checked } }))}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div>
                            <span className="text-sm font-medium">{feat.label}</span>
                            {feat.desc && <p className="text-xs text-muted-foreground">{feat.desc}</p>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Sort Order</Label><Input type="number" min={0} step={1} value={planForm.sort_order} onChange={e => setPlanForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} /></div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={planForm.is_active} onChange={e => setPlanForm(p => ({ ...p, is_active: e.target.checked }))} className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button variant="outline" onClick={() => setPlanDialogOpen(false)} disabled={savingPlan}>Cancel</Button>
              <Button onClick={handleSavePlan} disabled={!planForm.name.trim() || !planForm.slug.trim() || savingPlan}>
                {savingPlan ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} {editingPlan ? 'Update Plan' : 'Create Plan'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminVideoCallsTab() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<any[]>('/video-call/admin/rooms');
      setRooms(res.data || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 10000);
    return () => clearInterval(interval);
  }, [loadRooms]);

  const handleEndRoom = async (roomId: string) => {
    setEnding(roomId);
    try {
      await post(`/video-call/admin/rooms/${encodeURIComponent(roomId)}/end`, { reason: 'Ended by admin' });
      toast.success(`Room ${roomId} ended`);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch (e: any) {
      toast.error(e.message || 'Failed to end room');
    } finally {
      setEnding(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Video className="w-5 h-5 text-secondary" /> Active Video Calls</CardTitle>
          <Button variant="outline" size="sm" onClick={loadRooms} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && rooms.length === 0 ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-secondary" /></div>
        ) : rooms.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No active video calls.</p>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div key={room.id} className="border rounded-lg p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-mono text-sm font-medium">{room.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {room.peerCount} participant{room.peerCount !== 1 ? 's' : ''} &middot;{' '}
                    {new Date(room.createdAt).toLocaleString()}
                  </p>
                  {room.peers && room.peers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {room.peers.map((peer: any) => (
                        <Badge key={peer.id} variant="secondary" className="text-xs">{peer.displayName}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={ending === room.id}
                  onClick={() => handleEndRoom(room.id)}
                >
                  {ending === room.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                  End Call
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminMessagesTab() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<any[]>('/admin/conversations');
      setConversations(res.data || []);
    } catch (e: any) {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const openConversation = async (conversationId: string) => {
    setSelectedConvo(conversationId);
    setLoadingMessages(true);
    try {
      const res = await get<any[]>(`/admin/conversations/${encodeURIComponent(conversationId)}/messages`);
      setMessages(res.data || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load messages');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-secondary" /> Messages</CardTitle>
          <Button variant="outline" size="sm" onClick={loadConversations} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg md:col-span-1 max-h-[500px] overflow-y-auto">
            {loading && conversations.length === 0 ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-secondary" /></div>
            ) : conversations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">No conversations.</p>
            ) : (
              <div className="divide-y">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors ${
                      selectedConvo === conv.id ? 'bg-muted' : ''
                    }`}
                  >
                    <p className="font-medium truncate">{conv.subject || conv.id}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.last_message?.sender_name || conv.last_message?.content?.slice(0, 60) || 'No messages'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="border rounded-lg md:col-span-2 max-h-[500px] overflow-y-auto p-4 space-y-3">
            {!selectedConvo ? (
              <p className="text-muted-foreground text-center py-8 text-sm">Select a conversation to view messages.</p>
            ) : loadingMessages ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-secondary" /></div>
            ) : messages.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">No messages in this conversation.</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-2">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="text-xs">{(msg.sender_name || 'U')[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{msg.sender_name || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">{new Date(msg.created_at || msg.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
