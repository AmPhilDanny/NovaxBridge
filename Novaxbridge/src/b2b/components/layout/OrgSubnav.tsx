import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Clock, XCircle, Building2, Loader2, Sparkles, ArrowRight, Video } from 'lucide-react';
import { getVerification, type OrgVerification } from '../../lib/api';
import { useAuth } from '@/hooks/useAuth';
import LiveMeetingBanner from '../meetings/LiveMeetingBanner';

const orgNavItems = [
  { to: '/b2b/team', label: 'Team' },
  { to: '/b2b/talent', label: 'Talent Pool' },
  { to: '/b2b/talent/lists', label: 'Lists' },
  { to: '/b2b/hiring', label: 'Hiring' },
  { to: '/b2b/hiring/pipeline', label: 'Pipeline' },
  { to: '/b2b/contracts', label: 'Contracts' },
  { to: '/b2b/meetings', label: 'Meetings' },
  { to: '/b2b/compliance', label: 'Compliance' },
  { to: '/b2b/analytics', label: 'Analytics' },
  { to: '/b2b/settings', label: 'Settings' },
];

/** Gate component that blocks B2B content until the org is verified. */
function VerificationGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [verification, setVerification] = useState<OrgVerification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getVerification();
        if (!cancelled) setVerification(res.data);
      } catch { /* no org / no verification — gating applies */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  // No org at all — prompt to set one up
  if (!verification) {
    return (
      <div className="py-16 px-4">
        <Card className="max-w-lg mx-auto">
          <CardContent className="p-8 text-center space-y-4">
            <Building2 className="w-12 h-12 text-purple-600 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Organization Required</h2>
            <p className="text-sm text-gray-500">
              You need to create an organization before accessing B2B features.
            </p>
            <Button onClick={() => navigate('/b2b/setup')}>
              <Building2 className="w-4 h-4 mr-2" />
              Set Up Organization
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verification rejected
  if (verification.status === 'rejected') {
    return (
      <div className="py-16 px-4">
        <Card className="max-w-lg mx-auto border-red-200">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Verification Rejected</h2>
            <p className="text-sm text-gray-500">
              {verification.notes
                ? `Reason: ${verification.notes}`
                : 'Your business verification was rejected. Please resubmit with the correct documents.'}
            </p>
            <Button variant="default" className="bg-red-600 hover:bg-red-700" onClick={() => navigate('/org/verification')}>
              <Shield className="w-4 h-4 mr-2" />
              Resubmit Verification
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verification pending
  if (verification.status === 'pending') {
    return (
      <div className="py-16 px-4">
        <Card className="max-w-lg mx-auto border-amber-200">
          <CardContent className="p-8 text-center space-y-4">
            <Clock className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Verification In Progress</h2>
            <p className="text-sm text-gray-500">
              Your business documents are being reviewed. This usually takes 1–2 business days.
              You'll get full access once verified.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => navigate('/org/verification')}>
                View Status
              </Button>
              <Button variant="outline" onClick={() => navigate('/b2b/settings')}>
                Upgrade Plan <Sparkles className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not yet submitted
  if (verification.status === 'not_submitted') {
    return (
      <div className="py-16 px-4">
        <Card className="max-w-lg mx-auto">
          <CardContent className="p-8 text-center space-y-4">
            <Shield className="w-12 h-12 text-purple-600 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Verification Required</h2>
            <p className="text-sm text-gray-500">
              You must verify your organization to access B2B features like hiring, talent pool,
              contracts, and analytics.
            </p>
            <Button onClick={() => navigate('/org/verification')}>
              <Shield className="w-4 h-4 mr-2" />
              Get Verified Now
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verified — render the actual content
  return <>{children}</>;
}

export default function OrgSubnav() {
  const { profile } = useAuth();
  const userName = profile?.full_name || profile?.email || 'User';

  return (
    <VerificationGate>
      <LiveMeetingBanner userName={userName} />
      <div className="sticky top-16 z-30 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <div className="flex items-center gap-6 overflow-x-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap py-3 mr-2">
              Organization
            </span>
            <nav className="flex items-center gap-1">
              {orgNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors border-b-2 ${
                      isActive
                        ? 'border-purple-600 text-purple-700'
                        : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </VerificationGate>
  );
}
