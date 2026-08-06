import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Rocket, LogOut, User, Bell, Package, Wallet as WalletIcon, Store, Shield, ChevronDown, LayoutDashboard, Settings, Users, MessageSquare, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import { getUnreadCount, getNotifications, markNotificationRead, markAllNotificationsRead, Notification } from '@/lib/marketplace';
import { toast } from 'sonner';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const { config, loading: siteLoading } = useSiteSettings();
  const navigate = useNavigate();
  const location = useLocation();

  // Notifications
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const mainSiteUrl = config.main_site_url || import.meta.env.VITE_MAIN_SITE_URL || 'http://localhost:3000';

  const goToMainSite = async (path: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { access_token, refresh_token } = session;
      window.location.href = `${mainSiteUrl}${path}#access_token=${access_token}&refresh_token=${refresh_token}&token_type=bearer&type=recovery`;
    } else {
      window.location.href = `${mainSiteUrl}/auth`;
    }
  };

  function MainSiteLink({ href, children, className, onClick: extraOnClick, ...props }: { href: string; children: React.ReactNode; className?: string; onClick?: React.MouseEventHandler<HTMLAnchorElement>; [key: string]: unknown }) {
    const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      await goToMainSite(href);
      extraOnClick?.(e);
    };

    return (
      <a href={`${mainSiteUrl}${href}`} onClick={handleClick} className={className} {...props}>
        {children}
      </a>
    );
  }

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch unread count periodically
  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const count = await getUnreadCount();
      setUnreadCount(count);
    };
    fetch();
    const interval = setInterval(fetch, 30000); // every 30s
    return () => clearInterval(interval);
  }, [user]);

  // Close notification dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openNotifs = async () => {
    setNotifOpen(!notifOpen);
    if (!notifOpen) {
      setLoadingNotifs(true);
      try {
        const data = await getNotifications(true);
        setNotifs(data);
      } catch {
        setNotifs([]);
      } finally {
        setLoadingNotifs(false);
      }
    }
  };

  const handleNotifClick = async (n: Notification) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifs((prev) => prev.filter((x) => x.id !== n.id));
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setUnreadCount(0);
    setNotifs([]);
    toast.success('All marked read');
  };

  const navLinks = config.nav.links.length > 0
    ? config.nav.links
    : [
        { name: 'Marketplace', href: '/marketplace' },
        { name: 'Talent', href: '/talent' },
        { name: 'Projects', href: '/projects' },
        { name: 'Jobs', href: '/jobs' },
        { name: 'Tutor', href: '/tutor' },
        { name: 'About', href: '/about' },
        { name: 'FAQ', href: '/faq' },
        { name: 'Programs', href: '/programs' },
      ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('/#') && location.pathname === '/') {
      e.preventDefault();
      const id = href.split('#')[1];
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      setIsMobileMenuOpen(false);
    }
  };

  const isPlayground = location.pathname === '/playground';

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isPlayground
          ? 'bg-gray-900 shadow-md py-3'
          : isScrolled
            ? 'bg-background/80 backdrop-blur-md shadow-md py-3'
            : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-4 flex items-center justify-between">
        <MainSiteLink href="/" className="flex items-center gap-2">
          {config.brand.logo_url ? (
            <img src={config.brand.logo_url} alt={config.brand.site_name} className="w-8 h-8 object-contain" />
          ) : (
            <Rocket className={`w-8 h-8 ${isPlayground ? 'text-white' : 'text-secondary'}`} />
          )}
          <span className={`text-xl font-bold tracking-tight ${isPlayground ? 'text-white' : 'text-primary'}`}>
            {config.brand.site_name || 'SkillBridge Africa'}
          </span>
        </MainSiteLink>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href
              || (link.href !== '/' && location.pathname.startsWith(link.href));
            return (
              <MainSiteLink
                key={link.name}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-secondary font-semibold'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                {link.name}
              </MainSiteLink>
            );
          })}
          {user ? (
            <div className="flex items-center gap-3 ml-2">
              {/* Notification Bell */}
              <div className="relative" ref={notifRef}>
                <button onClick={openNotifs} className={`relative p-1.5 transition-colors ${isPlayground ? 'text-gray-300 hover:text-white' : 'text-muted-foreground hover:text-primary'}`} aria-label="Notifications">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50">
                    <div className="flex items-center justify-between p-3 border-b border-border">
                      <span className="text-sm font-semibold">Notifications</span>
                      {notifs.length > 0 && (
                        <button onClick={handleMarkAllRead} className="text-xs text-secondary hover:underline">Mark all read</button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {loadingNotifs ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
                      ) : notifs.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">All caught up!</div>
                      ) : (
                        notifs.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => handleNotifClick(n)}
                            className="w-full text-left p-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                          >
                            <p className="text-sm font-medium">{n.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${isPlayground ? 'hover:bg-gray-800' : 'hover:bg-muted/50'}`}>
                    <Avatar className="w-7 h-7 border border-border">
                      <AvatarImage src={profile?.avatar_url || ''} />
                      <AvatarFallback className={`text-xs ${isPlayground ? 'bg-gray-700 text-white' : 'bg-primary/10 text-primary'}`}>
                        {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden xl:block text-left">
                      <p className={`text-sm font-medium leading-tight ${isPlayground ? 'text-white' : ''}`}>{profile?.full_name || 'User'}</p>
                      <p className={`text-[10px] uppercase tracking-wider ${isPlayground ? 'text-gray-400' : 'text-muted-foreground'}`}>{profile?.role || 'User'}</p>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 ${isPlayground ? 'text-gray-400' : 'text-muted-foreground'}`} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8 border border-border">
                        <AvatarImage src={profile?.avatar_url || ''} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{profile?.full_name || 'User'}</p>
                        <p className="text-xs text-muted-foreground capitalize">{profile?.role || 'User'}</p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <MainSiteLink href="/profile" className="cursor-pointer flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>Profile</span>
                    </MainSiteLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <MainSiteLink href="/connections" className="cursor-pointer flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>Connections</span>
                    </MainSiteLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <MainSiteLink href="/messages" className="cursor-pointer flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      <span>Messages</span>
                    </MainSiteLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <MainSiteLink href={profile?.role === 'firm' ? '/dashboard/org' : '/dashboard'} className="cursor-pointer flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Dashboard</span>
                    </MainSiteLink>
                  </DropdownMenuItem>
                  {profile?.role === 'firm' && (
                    <>
                      <DropdownMenuItem asChild>
                        <MainSiteLink href="/b2b/setup" className="cursor-pointer flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          <span>Org Setup</span>
                        </MainSiteLink>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <MainSiteLink href="/jobs/new" className="cursor-pointer flex items-center gap-2">
                          <Rocket className="w-4 h-4" />
                          <span>Post Job</span>
                        </MainSiteLink>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <MainSiteLink href="/orders" className="cursor-pointer flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      <span>Orders</span>
                    </MainSiteLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <MainSiteLink href="/wallet" className="cursor-pointer flex items-center gap-2">
                      <WalletIcon className="w-4 h-4" />
                      <span>Wallet</span>
                    </MainSiteLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <MainSiteLink href="/my-listings" className="cursor-pointer flex items-center gap-2">
                      <Store className="w-4 h-4" />
                      <span>My Listings</span>
                    </MainSiteLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <MainSiteLink href="/disputes" className="cursor-pointer flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <span>Disputes</span>
                    </MainSiteLink>
                  </DropdownMenuItem>
                  {profile?.role && ['super_admin', 'admin'].includes(profile.role) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/')} className="cursor-pointer">
                        <Settings className="w-4 h-4" />
                        <span>Admin Panel</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Button onClick={() => window.location.href = `${MAIN_SITE_URL}/auth`} className="whitespace-nowrap">
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className={`lg:hidden p-2 ${isPlayground ? 'text-white' : 'text-primary'}`}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-background border-b border-border p-4 flex flex-col gap-4 shadow-lg">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href
              || (link.href !== '/' && location.pathname.startsWith(link.href));
            return (
              <MainSiteLink
                key={link.name}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`text-lg font-medium transition-colors ${
                  isActive
                    ? 'text-secondary font-semibold'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                {link.name}
              </MainSiteLink>
            );
          })}
          {user ? (
            <>
              <div className="border-t border-border pt-3 mt-1">
                <p className="text-xs text-muted-foreground mb-2">Account</p>
                <div className="flex items-center gap-3 mb-2">
                  <MainSiteLink href="/orders" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
                    <Package className="w-4 h-4" /> Orders
                  </MainSiteLink>
                  <MainSiteLink href="/disputes" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
                    <Shield className="w-4 h-4" /> Disputes
                  </MainSiteLink>
                  <MainSiteLink href="/wallet" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
                    <WalletIcon className="w-4 h-4" /> Wallet
                  </MainSiteLink>
                  <MainSiteLink href="/my-listings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
                    <Store className="w-4 h-4" /> My Listings
                  </MainSiteLink>
                </div>
                <MainSiteLink href={profile?.role === 'firm' ? '/dashboard/org' : '/dashboard'}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-medium text-primary block"
                >
                  Dashboard
                </MainSiteLink>
                {profile?.role === 'firm' && (
                  <MainSiteLink href="/jobs/new"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg font-medium text-muted-foreground hover:text-primary block"
                  >
                    Post Job
                  </MainSiteLink>
                )}
                <MainSiteLink href="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-medium text-muted-foreground hover:text-primary block"
                >
                  My Profile
                </MainSiteLink>
                <MainSiteLink href="/my-applications"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-medium text-muted-foreground hover:text-primary block"
                >
                  My Applications
                </MainSiteLink>
              </div>
              <Button className="w-full" variant="outline" onClick={signOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <Button className="w-full" onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/auth');
            }}>
              Sign In
            </Button>
          )}
        </div>
      )}
    </nav>
  );
}
