// ============================================================
// B2BDashboard — Premium organization dashboard
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '../hooks/useOrg';
import { useSubscription } from '../hooks/useSubscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, Briefcase, Plus, ArrowRight,
  Search, UserPlus, Sparkles, Loader2,
  Settings, BarChart3, CreditCard, Shield,
  XCircle, Clock, Handshake,
  ChevronRight, Activity,
} from 'lucide-react';
import { getVerification, getAnalyticsOverview, getContracts, getUpcomingMeetings } from '../lib/api';
import type { OrgVerification, AnalyticsOverview, Contract, OrgMeeting } from '../lib/api';
import MeetingsSection from '../components/meetings/MeetingsSection';

interface OrgStat {
  activeJobs: number;
  totalJobs: number;
  teamMembers: number;
  teamByRole: Record<string, number>;
  applications: number;
  talentMatches: number;
  interviews: number;
}

interface OrgJob {
  id: string;
  title: string;
  type: string;
  location: string;
  is_active: boolean;
  created_at: string;
  applications: { count: number }[];
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-700',
  reviewed: 'bg-blue-500/15 text-blue-700',
  interviewed: 'bg-purple-500/15 text-purple-700',
  accepted: 'bg-green-500/15 text-green-700',
  rejected: 'bg-red-500/15 text-red-700',
};

const CONTRACT_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-purple-100 text-purple-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  msa: 'MSA',
  sow: 'SOW',
  fixed_price: 'Fixed Price',
  milestone_based: 'Milestone',
};

function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export default function B2BDashboard() {
  const { org, role } = useOrg();
  const { plan } = useSubscription();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<OrgStat>({
    activeJobs: 0, totalJobs: 0, teamMembers: 0, teamByRole: {},
    applications: 0, talentMatches: 0, interviews: 0,
  });
  const [jobs, setJobs] = useState<OrgJob[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [verification, setVerification] = useState<OrgVerification | null>(null);
  const [meetings, setMeetings] = useState<OrgMeeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchDashboard();
    if (org?.id) {
      fetchVerification();
      fetchContracts();
      fetchAnalytics();
      fetchMeetings();
    }
  }, [org?.id, user]);

  const fetchVerification = async () => {
    try {
      const res = await getVerification();
      setVerification(res.data);
    } catch { /* silent */ }
  };

  const fetchContracts = async () => {
    try {
      const res = await getContracts();
      setContracts(res.data || []);
    } catch { /* silent */ }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await getAnalyticsOverview();
      setAnalytics(data);
    } catch { /* silent */ }
  };

  const fetchMeetings = async () => {
    setMeetingsLoading(true);
    try {
      const res = await getUpcomingMeetings();
      setMeetings(res.data || []);
    } catch { /* silent */ }
    finally { setMeetingsLoading(false); }
  };

  const fetchDashboard = async () => {
    try {
      const db = supabase as any;

      const queries: any[] = [];

      if (org?.id) {
        queries.push(
          db.from('jobs').select('id, is_active', { count: 'exact' }).eq('org_id', org.id),
          db.from('org_members').select('id', { count: 'exact' }).eq('org_id', org.id),
          db.from('orders').select('id', { count: 'exact' }).eq('org_id', org.id),
        );
      } else {
        queries.push(
          Promise.resolve({ data: [], count: 0 }),
          Promise.resolve({ data: [], count: 0 }),
          Promise.resolve({ data: [], count: 0 }),
        );
      }

      queries.push(
        supabase
          .from('jobs')
          .select('id, title, type, location, is_active, created_at, applications:applications(count)')
          .eq('company_id', user!.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('applications')
          .select('id, job_id, status, created_at')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'student'),
      );

      const [jobsOrgRes, membersRes, appsOrgRes, legacyJobsRes, appsRes, talentRes] = await Promise.all(queries);

      const orgJobs = jobsOrgRes.data || [];
      const legacyJobs = (legacyJobsRes.data || []) as unknown as OrgJob[];
      const allJobs = org?.id ? orgJobs : legacyJobs;

      setStats(prev => ({
        ...prev,
        activeJobs: allJobs.filter((j: any) => j.is_active).length,
        totalJobs: allJobs.length,
        teamMembers: membersRes.count || 0,
        applications: appsOrgRes.count || 0,
        talentMatches: talentRes.count || 0,
        interviews: (appsRes.data || []).filter((a: any) => a.status === 'interviewed').length,
      }));

      setJobs((legacyJobsRes.data || []) as unknown as OrgJob[]);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  const showUpgrade = plan?.slug === 'free' || !plan;

  // ── Derived metrics ──
  const appsPerJob = stats.activeJobs > 0 ? (stats.applications / stats.activeJobs).toFixed(1) : '—';
  const interviewRate = stats.applications > 0 ? Math.round((stats.interviews / stats.applications) * 100) : 0;
  const activeRatio = stats.totalJobs > 0 ? Math.round((stats.activeJobs / stats.totalJobs) * 100) : 0;

  const activeContracts = contracts.filter(c => c.status === 'active');
  const totalContractValue = contracts.reduce((sum, c) => sum + (c.total_value || 0), 0);
  const pipelineByStatus = analytics?.pipeline?.by_status || {};
  const totalPipeline = analytics?.pipeline?.total || 0;

  return (
    <div className="space-y-6">
      {/* ── Header Hero ── */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 p-6 sm:p-8 mt-4 sm:mt-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {org?.name || profile?.company_name || 'Organization Dashboard'}
              </h1>
              <Badge className="bg-white/20 text-white border-white/20 capitalize">
                {role || 'member'}
              </Badge>
            </div>
            <p className="text-purple-100 text-sm flex items-center gap-2">
              {stats.activeJobs > 0 && <span>{stats.activeJobs} active job{stats.activeJobs !== 1 ? 's' : ''}</span>}
              {stats.activeJobs > 0 && stats.teamMembers > 0 && <span className="text-purple-300">&middot;</span>}
              {stats.teamMembers > 0 && <span>{stats.teamMembers} team member{stats.teamMembers !== 1 ? 's' : ''}</span>}
              {(stats.activeJobs > 0 || stats.teamMembers > 0) && totalContractValue > 0 && <span className="text-purple-300">&middot;</span>}
              {totalContractValue > 0 && <span>{formatCurrency(totalContractValue)} in contracts</span>}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="bg-white/15 text-white hover:bg-white/25 border-0"
              onClick={() => navigate('/b2b/team')}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite
            </Button>
            <Button
              className="bg-white text-purple-700 hover:bg-purple-50"
              onClick={() => navigate('/b2b/hiring')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Post Job
            </Button>
          </div>
        </div>
      </div>

      {/* ── Upgrade prompt ── */}
      {showUpgrade && (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-purple-900">You're on the Free plan</p>
                <p className="text-xs text-purple-600">Upgrade to unlock talent pool, analytics, and AI insights</p>
              </div>
            </div>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 shrink-0" onClick={() => navigate('/b2b/settings')}>
              Upgrade
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Verification status ── */}
      {verification && verification.status !== 'verified' && (
        <Card className={`border ${
          verification.status === 'pending' ? 'border-amber-200 bg-amber-50' :
          verification.status === 'rejected' ? 'border-red-200 bg-red-50' :
          'border-gray-200 bg-gray-50'
        }`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {verification.status === 'pending' ? (
                <Clock className="w-5 h-5 text-amber-600 shrink-0" />
              ) : verification.status === 'rejected' ? (
                <XCircle className="w-5 h-5 text-red-600 shrink-0" />
              ) : (
                <Shield className="w-5 h-5 text-gray-600 shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {verification.status === 'not_submitted' && 'Organization Not Verified'}
                  {verification.status === 'pending' && 'Verification In Review'}
                  {verification.status === 'rejected' && 'Verification Rejected'}
                </p>
                <p className="text-xs text-gray-600">
                  {verification.status === 'not_submitted' && 'Submit your business documents to unlock all B2B features.'}
                  {verification.status === 'pending' && 'Your documents are being reviewed. This takes 1-2 business days.'}
                  {verification.status === 'rejected' && (
                    <>{verification.notes ? `Reason: ${verification.notes}` : 'Please resubmit with correct documents.'}</>
                  )}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={verification.status === 'rejected' ? 'default' : 'outline'}
              className={verification.status === 'rejected' ? 'bg-red-600 hover:bg-red-700 text-white shrink-0' : 'shrink-0'}
              onClick={() => navigate('/org/verification')}
            >
              {verification.status === 'not_submitted' ? 'Get Verified' :
               verification.status === 'pending' ? 'View Status' :
               'Resubmit'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Meetings Section ── */}
      {meetings.length > 0 && (
        <MeetingsSection
          meetings={meetings}
          loading={meetingsLoading}
          userName={profile?.full_name || profile?.email || 'User'}
          onRefresh={fetchMeetings}
          showScheduleButton={true}
        />
      )}

      {/* ── Key Metrics Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {/* Active Jobs */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Jobs</CardTitle>
              <Briefcase className="w-4 h-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.activeJobs}</div>
            <p className="text-xs text-gray-400 mt-0.5">{stats.totalJobs} total posted</p>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Team</CardTitle>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.teamMembers}</div>
            <p className="text-xs text-gray-400 mt-0.5">
              <Button variant="link" className="px-0 h-auto text-xs text-blue-600" onClick={() => navigate('/b2b/team')}>
                Manage team
              </Button>
            </p>
          </CardContent>
        </Card>

        {/* Active Contracts */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Contracts</CardTitle>
              <Handshake className="w-4 h-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{activeContracts.length}</div>
            <p className="text-xs text-gray-400 mt-0.5">{contracts.length} total · {formatCurrency(totalContractValue)}</p>
          </CardContent>
        </Card>

        {/* Pipeline */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pipeline</CardTitle>
              <Activity className="w-4 h-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{totalPipeline || stats.applications}</div>
            <p className="text-xs text-gray-400 mt-0.5">
              {Object.entries(pipelineByStatus).length > 0
                ? Object.entries(pipelineByStatus).map(([s, c]) => `${s}: ${c}`).join(' · ')
                : `${stats.applications} total`}
            </p>
          </CardContent>
        </Card>

        {/* Talent Pool */}
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Talent Pool</CardTitle>
              <Search className="w-4 h-4 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.talentMatches}</div>
            <p className="text-xs text-gray-400 mt-0.5">
              <Button variant="link" className="px-0 h-auto text-xs text-rose-600" onClick={() => navigate('/b2b/talent')}>
                Browse talent
              </Button>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Jobs + Contracts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Your Open Positions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-purple-600" />
                Open Positions
              </CardTitle>
              {jobs.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/b2b/hiring')}>
                  View All <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <div className="text-center py-10">
                  <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 mb-4">No open positions yet</p>
                  <Button onClick={() => navigate('/b2b/hiring')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Post Your First Job
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {jobs.slice(0, 5).map((job) => {
                    const appCount = job.applications?.[0]?.count || 0;
                    return (
                      <div key={job.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-gray-900 truncate">{job.title}</p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">{job.type}</Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{job.location}</p>
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">{appCount}</p>
                            <p className="text-[10px] text-gray-400">applicant{appCount !== 1 ? 's' : ''}</p>
                          </div>
                          <Badge variant="secondary" className={job.is_active ? 'bg-green-100 text-green-700 border-green-200' : ''}>
                            {job.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                  {jobs.length > 5 && (
                    <Button variant="link" className="w-full mt-2 text-sm" onClick={() => navigate('/b2b/hiring')}>
                      View all {jobs.length} jobs
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Contracts (only if there are any) */}
          {contracts.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Handshake className="w-5 h-5 text-emerald-600" />
                  Recent Contracts
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/b2b/contracts')}>
                  View All <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-gray-100">
                  {contracts.slice(0, 4).map((contract) => (
                    <div key={contract.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-gray-900 truncate">{contract.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type}
                          {contract.talent && <span> · {contract.talent.full_name}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(contract.total_value, contract.currency)}</p>
                        <Badge variant="secondary" className={`${CONTRACT_STATUS_STYLES[contract.status] || ''} capitalize`}>
                          {contract.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — Quick Actions + Plan + Company Profile */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-500">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Button variant="ghost" className="w-full justify-start text-sm font-normal" onClick={() => navigate('/b2b/hiring')}>
                <Plus className="w-4 h-4 mr-3 text-purple-600" />
                Post a New Job
              </Button>
              <Button variant="ghost" className="w-full justify-start text-sm font-normal" onClick={() => navigate('/b2b/team')}>
                <UserPlus className="w-4 h-4 mr-3 text-blue-600" />
                Invite Team Member
              </Button>
              <Button variant="ghost" className="w-full justify-start text-sm font-normal" onClick={() => navigate('/b2b/talent')}>
                <Search className="w-4 h-4 mr-3 text-rose-600" />
                Search Talent Pool
              </Button>
              <Button variant="ghost" className="w-full justify-start text-sm font-normal" onClick={() => navigate('/b2b/contracts')}>
                <Handshake className="w-4 h-4 mr-3 text-emerald-600" />
                View Contracts
              </Button>
              <Button variant="ghost" className="w-full justify-start text-sm font-normal" onClick={() => navigate('/b2b/settings')}>
                <Settings className="w-4 h-4 mr-3 text-gray-600" />
                Organization Settings
              </Button>
              <div className="pt-2">
                <Button className="w-full justify-start bg-purple-600 hover:bg-purple-700 text-white" onClick={() => navigate('/b2b/settings')}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  {showUpgrade ? 'Upgrade Plan' : 'Manage Plan'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current Plan */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{plan?.name || 'Free'}</p>
                  <p className="text-xs text-gray-500">
                    {plan?.price_monthly
                      ? `${formatCurrency(plan.price_monthly)}/mo`
                      : 'Free tier'}
                  </p>
                </div>
                {plan?.slug === 'free' ? (
                  <Badge variant="secondary">Free</Badge>
                ) : (
                  <Badge className="bg-purple-100 text-purple-700">Active</Badge>
                )}
              </div>
              {plan && plan.features && plan.features.length > 0 && (
                <div className="space-y-1">
                  {plan.features.slice(0, 4).map((feat, i) => (
                    <p key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
                      <span className="text-green-500 font-bold">&check;</span>
                      {feat}
                    </p>
                  ))}
                  {plan.features.length > 4 && (
                    <p className="text-xs text-purple-600 mt-1">+{plan.features.length - 4} more features</p>
                  )}
                </div>
              )}
              {showUpgrade && (
                <Button variant="link" className="px-0 mt-3 h-auto text-xs text-purple-600" onClick={() => navigate('/b2b/settings')}>
                  Compare plans <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Company Profile (condensed) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-600" />
                Company
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {(org?.name || profile?.company_name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{org?.name || profile?.company_name || 'No company name'}</p>
                  {org?.industry && <p className="text-xs text-gray-500">{org.industry}</p>}
                </div>
              </div>
              {profile?.location && (
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {profile.location}
                </p>
              )}
              {profile?.bio && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{profile.bio}</p>
              )}
              <Button variant="link" className="px-0 mt-2 h-auto text-xs text-purple-600" onClick={() => navigate('/profile')}>
                Edit Profile <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Organization Metrics ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            Insights & Metrics
          </CardTitle>
          {totalContractValue > 0 && (
            <p className="text-xs text-gray-400">Total contract value: {formatCurrency(totalContractValue)}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="p-3 rounded-lg bg-gray-50">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Apps per Job</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{appsPerJob}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.activeJobs > 0
                  ? `${stats.applications} apps ÷ ${stats.activeJobs} active jobs`
                  : 'No active jobs'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Interview Rate</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-gray-900">{interviewRate}%</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.applications > 0
                  ? `${stats.interviews} interviewed of ${stats.applications}`
                  : 'No applications yet'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Ratio</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-gray-900">{activeRatio}%</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.totalJobs > 0
                  ? `${stats.activeJobs} active of ${stats.totalJobs} total`
                  : 'No jobs posted'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contracts</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{contracts.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeContracts.length > 0
                  ? `${activeContracts.length} active`
                  : 'No contracts yet'}
              </p>
            </div>
          </div>
          {/* Contract value trend */}
          {analytics?.contracts?.monthly_value && Object.keys(analytics.contracts.monthly_value).length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Contract Value Trend</p>
              <div className="flex items-end gap-2 h-16">
                {Object.entries(analytics.contracts.monthly_value)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .slice(-6)
                  .map(([month, value]) => {
                    const maxVal = Math.max(...Object.values(analytics.contracts.monthly_value));
                    const height = maxVal > 0 ? (value / maxVal) * 100 : 0;
                    return (
                      <div key={month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-semibold text-gray-700">
                          {formatCurrency(value, 'NGN')}
                        </span>
                        <div
                          className="w-full rounded-sm bg-gradient-to-t from-emerald-500 to-emerald-300"
                          style={{ height: `${Math.max(height, 4)}%` }}
                        />
                        <span className="text-[10px] text-gray-400">{month.slice(-2)}/{month.slice(0, 4)}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
