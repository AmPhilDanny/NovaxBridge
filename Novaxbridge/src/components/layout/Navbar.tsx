import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Rocket, LogOut, User, Bell, Package, Wallet as WalletIcon, Store, Shield, ChevronDown, LayoutDashboard, Settings, Users, MessageSquare, Building2, CreditCard, GraduationCap, BookOpen, Plus, BookOpenCheck, Sparkles, Code, Phone } from 'lucide-react';
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
import { getUnreadCount, getNotifications, markNotificationRead, markAllNotificationsRead, Notification } from '@/lib/marketplace';
import { toast } from 'sonner';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const { config, isValidating: siteLoading } = useSiteSettings();
  const navigate = useNavigate();
  const location = useLocation();

  // Notifications
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [academyOpen, setAcademyOpen] = useState(false);
  const academyRef = useRef<HTMLDivElement>(null);
  const [mobileAcademyOpen, setMobileAcademyOpen] = useState(false);

  const isTutorOrAdmin = profile?.role && ['tutor', 'admin', 'super_admin'].includes(profile.role);

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

  // Close notification and academy dropdowns on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (academyRef.current && !academyRef.current.contains(e.target as Node)) {
        setAcademyOpen(false);
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
        { name: 'Academy', href: '/academy' },
        { name: 'Programs', href: '/#programs' },
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

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-background/80 backdrop-blur-md shadow-md py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          {config.brand.logo_url ? (
            <img src={config.brand.logo_url} alt={config.brand.site_name} className="w-8 h-8 object-contain" />
          ) : (
            <Rocket className="w-8 h-8 text-secondary" />
          )}
          <span className="text-xl font-bold tracking-tight text-primary">
            {config.brand.site_name || 'Novaxbridge'}
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) => {
            if (link.name === 'Academy') {
              return (
                <div key="academy" className="relative" ref={academyRef}>
                  <button
                    onClick={() => setAcademyOpen(!academyOpen)}
                    className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
                  >
                    {link.name}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${academyOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {academyOpen && (
                    <div className="absolute top-full left-0 mt-2 w-52 bg-card border border-border rounded-xl shadow-xl z-50 py-2">
                      <Link
                        to="/academy"
                        onClick={() => setAcademyOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4 text-secondary" />
                        Dashboard
                      </Link>
                      <Link
                        to="/academy/browse"
                        onClick={() => setAcademyOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <BookOpen className="w-4 h-4 text-secondary" />
                        Browse Courses
                      </Link>
                      <Link
                        to="/academy/my-courses"
                        onClick={() => setAcademyOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <GraduationCap className="w-4 h-4 text-secondary" />
                        My Courses
                      </Link>
                      <Link
                        to="/academy/ai-tutor"
                        onClick={() => setAcademyOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Sparkles className="w-4 h-4 text-secondary" />
                        AI Tutor
                      </Link>
                      <Link
                        to="/academy/playground"
                        onClick={() => setAcademyOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Code className="w-4 h-4 text-secondary" />
                        Playground
                      </Link>
                      <div className="my-1 border-t border-border" />
                      {isTutorOrAdmin && (
                        <Link
                          to="/tutor-dashboard"
                          onClick={() => setAcademyOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                        >
                          <BookOpenCheck className="w-4 h-4 text-secondary" />
                          Tutor Dashboard
                        </Link>
                      )}
                      <Link
                        to="/academy/apply"
                        onClick={() => setAcademyOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Users className="w-4 h-4 text-secondary" />
                        Become a Tutor
                      </Link>
                      {isTutorOrAdmin && (
                        <Link
                          to="/academy/create"
                          onClick={() => setAcademyOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                        >
                          <Plus className="w-4 h-4 text-secondary" />
                          Create Course
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={link.name}
                to={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
              >
                {link.name}
              </Link>
            );
          })}
          {user ? (
            <div className="flex items-center gap-3 ml-2">
              {/* Notification Bell */}
              <div className="relative" ref={notifRef}>
                <button onClick={openNotifs} className="relative p-1.5 text-muted-foreground hover:text-primary transition-colors" aria-label="Notifications">
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
                            {n.type === 'video_call' ? (
                              <div className="flex items-start gap-2.5">
                                <span className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full bg-teal-500/10">
                                  <Phone className="h-3.5 w-3.5 text-teal-500" />
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium text-teal-600 dark:text-teal-400">{n.title}</p>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-medium">Missed</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.message}</p>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm font-medium">{n.title}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                              </>
                            )}
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
                  <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <Avatar className="w-7 h-7 border border-border">
                      <AvatarImage src={profile?.avatar_url || ''} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden xl:block text-left">
                      <p className="text-sm font-medium leading-tight">{profile?.full_name || 'User'}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{profile?.role || 'User'}</p>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
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
                    <Link to="/dashboard" className="cursor-pointer flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/academy" className="cursor-pointer flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      <span>Academy</span>
                    </Link>
                  </DropdownMenuItem>
                  {profile?.role && ['tutor', 'admin', 'super_admin'].includes(profile.role) && (
                    <DropdownMenuItem asChild>
                      <Link to="/tutor-dashboard" className="cursor-pointer flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        <span>Tutor Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/connections" className="cursor-pointer flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>Connections</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/messages" className="cursor-pointer flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      <span>Messages</span>
                    </Link>
                  </DropdownMenuItem>
                  {profile?.role === 'firm' && (
                    <DropdownMenuItem asChild>
                      <Link to="/jobs/new" className="cursor-pointer flex items-center gap-2">
                        <Rocket className="w-4 h-4" />
                        <span>Post Job</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {profile?.role === 'firm' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">My Organization</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link to="/b2b/setup" className="cursor-pointer flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          <span>Organization Setup</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/org/verification" className="cursor-pointer flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          <span>Verification</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/b2b" className="cursor-pointer flex items-center gap-2">
                          <LayoutDashboard className="w-4 h-4" />
                          <span>B2B Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/b2b/settings" className="cursor-pointer flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          <span>Purchase Plan</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/orders" className="cursor-pointer flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      <span>Orders</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/wallet" className="cursor-pointer flex items-center gap-2">
                      <WalletIcon className="w-4 h-4" />
                      <span>Wallet</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/my-listings" className="cursor-pointer flex items-center gap-2">
                      <Store className="w-4 h-4" />
                      <span>My Listings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/disputes" className="cursor-pointer flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <span>Disputes</span>
                    </Link>
                  </DropdownMenuItem>
                  {profile?.role && ['super_admin', 'admin'].includes(profile.role) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <a href={config.admin_panel_url || 'http://localhost:4000/'} className="cursor-pointer flex items-center gap-2 w-full" target="_blank" rel="noopener noreferrer">
                          <Settings className="w-4 h-4" />
                          <span>Admin Panel</span>
                        </a>
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
            <Button onClick={() => navigate('/auth')} className="whitespace-nowrap">
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="lg:hidden text-primary p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 max-h-[calc(100vh-4rem)] overflow-y-auto bg-background border-b border-border p-4 shadow-xl">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => {
              if (link.name === 'Academy') {
                return (
                  <div key="academy" className="flex flex-col">
                    <button
                      onClick={() => setMobileAcademyOpen(!mobileAcademyOpen)}
                      className="flex items-center justify-between text-base font-medium text-muted-foreground hover:text-primary py-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <span>Academy</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${mobileAcademyOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {mobileAcademyOpen && (
                      <div className="ml-3 flex flex-col gap-0.5 border-l-2 border-border pl-3 mt-0.5">
                        <Link to="/academy" onClick={() => { setMobileAcademyOpen(false); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-primary py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                          <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                        </Link>
                        <Link to="/academy/browse" onClick={() => { setMobileAcademyOpen(false); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-primary py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                          <BookOpen className="w-3.5 h-3.5" /> Browse Courses
                        </Link>
                        <Link to="/academy/my-courses" onClick={() => { setMobileAcademyOpen(false); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-primary py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                          <GraduationCap className="w-3.5 h-3.5" /> My Courses
                        </Link>
                        <Link to="/academy/ai-tutor" onClick={() => { setMobileAcademyOpen(false); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-primary py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                          <Sparkles className="w-3.5 h-3.5" /> AI Tutor
                        </Link>
                        <Link to="/academy/playground" onClick={() => { setMobileAcademyOpen(false); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-primary py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                          <Code className="w-3.5 h-3.5" /> Playground
                        </Link>
                        {isTutorOrAdmin && (
                          <Link to="/tutor-dashboard" onClick={() => { setMobileAcademyOpen(false); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-primary py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                            <BookOpenCheck className="w-3.5 h-3.5" /> Tutor Dashboard
                          </Link>
                        )}
                        <Link to="/academy/apply" onClick={() => { setMobileAcademyOpen(false); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-primary py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                          <Users className="w-3.5 h-3.5" /> Become a Tutor
                        </Link>
                        {isTutorOrAdmin && (
                          <Link to="/academy/create" onClick={() => { setMobileAcademyOpen(false); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-primary py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Create Course
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="text-base font-medium text-muted-foreground hover:text-primary py-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  {link.name}
                </Link>
              );
            })}
          </div>

          {user ? (
            <div className="mt-4 border-t border-border pt-4">
              {/* User Info Header */}
              <div className="flex items-center gap-3 px-2 mb-4">
                <Avatar className="w-10 h-10 border shadow-sm">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {profile?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">{profile?.full_name || 'User'}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {profile?.role?.replace('_', ' ') || 'Member'}
                  </span>
                </div>
              </div>

              {/* Main Links */}
              <div className="flex flex-col gap-1">
                <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
                <Link to="/academy" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <GraduationCap className="w-4 h-4" /> Academy
                </Link>
                {profile?.role && ['tutor', 'admin', 'super_admin'].includes(profile.role) && (
                  <Link to="/tutor-dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                    <BookOpen className="w-4 h-4" /> Tutor Dashboard
                  </Link>
                )}
                <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <User className="w-4 h-4" /> Profile
                </Link>
                <Link to="/connections" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <Users className="w-4 h-4" /> Connections
                </Link>
                <Link to="/messages" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <MessageSquare className="w-4 h-4" /> Messages
                </Link>
                {profile?.role === 'firm' && (
                  <Link to="/jobs/new" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                    <Rocket className="w-4 h-4" /> Post Job
                  </Link>
                )}
              </div>

              <div className="my-2 border-t border-border/50"></div>

              {profile?.role === 'firm' && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">Organization</p>
                  <div className="flex flex-col gap-1">
                    <Link to="/b2b/setup" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                      <Building2 className="w-4 h-4" /> Organization Setup
                    </Link>
                    <Link to="/org/verification" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                      <Shield className="w-4 h-4" /> Verification
                    </Link>
                    <Link to="/b2b" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                      <LayoutDashboard className="w-4 h-4" /> B2B Dashboard
                    </Link>
                    <Link to="/b2b/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                      <CreditCard className="w-4 h-4" /> Purchase Plan
                    </Link>
                  </div>
                </>
              )}

              <div className="my-2 border-t border-border/50"></div>

              {/* Marketplace Links */}
              <div className="flex flex-col gap-1">
                <Link to="/orders" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <Package className="w-4 h-4" /> Orders
                </Link>
                <Link to="/wallet" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <WalletIcon className="w-4 h-4" /> Wallet
                </Link>
                <Link to="/my-listings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <Store className="w-4 h-4" /> My Listings
                </Link>
                <Link to="/disputes" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <Shield className="w-4 h-4" /> Disputes
                </Link>
                {profile?.role && ['super_admin', 'admin'].includes(profile.role) && (
                  <>
                    <div className="my-2 border-t border-border/50"></div>
                    <a href={config.admin_panel_url || 'http://localhost:4000/'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                      <Settings className="w-4 h-4" /> Admin Panel
                    </a>
                  </>
                )}
              </div>

              <div className="my-2 border-t border-border/50"></div>

              <div className="px-2 mt-2">
                <Button className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 justify-start gap-3" variant="ghost" onClick={signOut}>
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-border px-2">
              <Button className="w-full" onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/auth');
              }}>
                Sign In
              </Button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
