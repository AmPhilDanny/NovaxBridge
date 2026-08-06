// ============================================================
// B2B/B2A Organization Platform — TypeScript Interfaces
// ============================================================

export interface PlanFeatureDef {
  key: string;
  label: string;
  description?: string;
}

export interface PlanFeatureGroup {
  group: string;
  label: string;
  features: PlanFeatureDef[];
}

export const PLAN_FEATURE_GROUPS: PlanFeatureGroup[] = [
  {
    group: 'hiring',
    label: 'Hiring',
    features: [
      { key: 'post_jobs', label: 'Post Jobs', description: 'Create and publish job listings' },
      { key: 'bulk_posting', label: 'Bulk Posting', description: 'Post multiple jobs at once' },
      { key: 'pipeline', label: 'Hiring Pipeline', description: 'Track applications through stages' },
    ],
  },
  {
    group: 'talent',
    label: 'Talent Pool',
    features: [
      { key: 'talent_search', label: 'Talent Search', description: 'Search the talent database' },
      { key: 'talent_lists', label: 'Talent Lists', description: 'Save and organize talent profiles' },
      { key: 'saved_searches', label: 'Saved Searches', description: 'Save search filters for reuse' },
    ],
  },
  {
    group: 'contracts',
    label: 'Contracts',
    features: [
      { key: 'contracts', label: 'Contracts', description: 'Create and manage contracts' },
      { key: 'milestones', label: 'Milestones', description: 'Track project milestones' },
      { key: 'e_signatures', label: 'E-Signatures', description: 'Digital contract signing' },
    ],
  },
  {
    group: 'analytics',
    label: 'Analytics',
    features: [
      { key: 'dashboard', label: 'Dashboard', description: 'Organization performance overview' },
      { key: 'reports', label: 'Reports', description: 'Generate compliance reports' },
      { key: 'export', label: 'Data Export', description: 'Export data to CSV/PDF' },
    ],
  },
  {
    group: 'team',
    label: 'Team',
    features: [
      { key: 'max_members_5', label: 'Up to 5 Members', description: 'Team size limit' },
      { key: 'max_members_20', label: 'Up to 20 Members', description: 'Team size limit' },
      { key: 'unlimited_members', label: 'Unlimited Members', description: 'No team size limit' },
    ],
  },
  {
    group: 'branding',
    label: 'Branding',
    features: [
      { key: 'custom_branding', label: 'Custom Branding', description: 'Custom logo and colors' },
      { key: 'custom_domain', label: 'Custom Domain', description: 'Use your own domain' },
    ],
  },
];

export function getDefaultFeatureMap(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const group of PLAN_FEATURE_GROUPS) {
    for (const feat of group.features) {
      map[feat.key] = false;
    }
  }
  return map;
}

export function featureMapToGroups(features: Record<string, boolean>): Record<string, Record<string, boolean>> {
  const grouped: Record<string, Record<string, boolean>> = {};
  for (const group of PLAN_FEATURE_GROUPS) {
    const g: Record<string, boolean> = {};
    for (const feat of group.features) {
      g[feat.key] = features[feat.key] ?? false;
    }
    grouped[group.group] = g;
  }
  return grouped;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_members: number;
  max_active_jobs: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  size: '1-10' | '11-50' | '51-200' | '201-500' | '500+' | null;
  logo_url: string | null;
  website_url: string | null;
  description: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  subscription_plan_id: string | null;
  subscription_starts_at: string | null;
  subscription_ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OrgMemberRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgMemberRole;
  title: string | null;
  joined_at: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email?: string;
    role?: string;
  } | null;
}

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface OrgInvite {
  id: string;
  org_id: string;
  email: string;
  token: string;
  role: Exclude<OrgMemberRole, 'owner'>;
  invited_by: string;
  status: InviteStatus;
  message: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  inviter?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface SubscriptionStatus {
  plan: SubscriptionPlan | null;
  status: 'active' | 'expired' | 'none';
  starts_at: string | null;
  ends_at: string | null;
}

export interface UserOrgInfo {
  org: Organization;
  role: OrgMemberRole;
}

export interface B2BApiError {
  error: string;
}

// ── Meetings ──

export interface OrgMeeting {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  meeting_url: string;
  room_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
  participants?: OrgMeetingParticipant[];
}

export interface OrgMeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string | null;
  email: string | null;
  participant_type: 'member' | 'external';
  role: 'host' | 'participant' | 'interviewer' | 'interviewee';
  rsvp_status: 'pending' | 'accepted' | 'declined' | 'maybe';
  notified_at: string | null;
  joined_at: string | null;
  created_at: string;
}

export interface OrgMeetingNotification {
  id: string;
  meeting_id: string;
  org_id: string;
  recipient_id: string;
  type: 'scheduled' | 'updated' | 'cancelled' | 'reminder' | 'started';
  message: string;
  sent_at: string;
  read_at: string | null;
  meeting?: OrgMeeting;
}
