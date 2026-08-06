import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useOrg } from '../../hooks/useOrg';
import { useSubscription } from '../../hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { getMyMemberships, switchOrg } from '../../lib/api';
import type { OrgMembership } from '../../lib/api';

const navItems = [
  { to: '/b2b/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/b2b/team', label: 'Team', icon: '👥' },
  { to: '/b2b/talent', label: 'Talent Pool', icon: '🎯' },
  { to: '/b2b/hiring', label: 'Hiring', icon: '💼' },
  { to: '/b2b/contracts', label: 'Contracts', icon: '📝' },
  { to: '/b2b/compliance', label: 'Compliance', icon: '🛡️' },
  { to: '/b2b/analytics', label: 'Analytics', icon: '📈' },
  { to: '/b2b/settings', label: 'Settings', icon: '⚙️' },
];

export default function B2BLayout() {
  const { org, role, isLoading } = useOrg();
  const { plan } = useSubscription();
  const { profile } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);
  const [switching, setSwitching] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!permLoading && !hasPermission('access_b2b') && profile?.role !== 'firm') {
      navigate('/dashboard', { replace: true });
    }
  }, [permLoading, hasPermission, navigate, profile?.role]);

  useEffect(() => {
    getMyMemberships()
      .then((res) => setMemberships(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowOrgSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex pt-16">
      {/* Sidebar */}
      <aside className={`fixed left-0 top-16 h-[calc(100vh-64px)] bg-white border-r border-gray-200 flex flex-col transition-all duration-300 z-40 ${sidebarOpen ? 'w-64' : 'w-16'}`}>
        {/* Org header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {sidebarOpen && (
              <div className="min-w-0 flex-1 relative" ref={switcherRef}>
                <button
                  onClick={() => setShowOrgSwitcher(!showOrgSwitcher)}
                  className="flex items-center gap-1 w-full text-left hover:opacity-80"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-gray-900 truncate">
                      {org?.name || 'My Organization'}
                    </h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      {plan?.name || 'Free'}
                    </span>
                  </div>
                  {memberships.length > 1 && (
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>

                {showOrgSwitcher && memberships.length > 1 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
                    {memberships.map((m) => (
                      <button
                        key={m.org_id}
                        disabled={switching}
                        onClick={async () => {
                          if (m.org_id === org?.id) { setShowOrgSwitcher(false); return; }
                          setSwitching(true);
                          try {
                            await switchOrg(m.org_id);
                            window.location.href = '/b2b/dashboard';
                          } catch {
                            setSwitching(false);
                          }
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                          m.org_id === org?.id ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                          {m.organizations.name.charAt(0)}
                        </span>
                        <span className="truncate">{m.organizations.name}</span>
                        {switching && m.org_id !== org?.id && (
                          <span className="ml-auto w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-semibold">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">{profile?.full_name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{role || 'member'}</p>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <div className="flex-1 p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
