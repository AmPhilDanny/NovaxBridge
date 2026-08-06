import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { GraduationCap, BookOpen, LayoutDashboard, MessageSquare, Users, Plus, BookOpenCheck, Code } from 'lucide-react';

const academyNavItems = [
  { to: '/academy', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/academy/browse', label: 'Browse Courses', icon: BookOpen },
  { to: '/academy/my-courses', label: 'My Courses', icon: GraduationCap },
  { to: '/academy/playground', label: 'Playground', icon: Code },
  { to: '/academy/ai-tutor', label: 'AI Tutor', icon: MessageSquare },
  { to: '/tutor-dashboard', label: 'Tutor Dashboard', icon: BookOpenCheck },
  { to: '/academy/apply', label: 'Become a Tutor', icon: Users },
  { to: '/academy/create', label: 'Create Course', icon: Plus },
];

export default function AcademySubnav() {
  const { profile } = useAuth();
  const isTutorOrAdmin = profile?.role && ['tutor', 'admin', 'super_admin'].includes(profile.role);

  return (
    <div className="sticky top-16 z-30 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex items-center gap-3 md:gap-6 overflow-x-auto scrollbar-none">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap py-3 mr-2">
            <GraduationCap className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            Academy
          </span>
          <nav className="flex items-center gap-1">
            {academyNavItems.map((item) => {
              // Gate Tutor Dashboard and Create Course by role
              if (item.to === '/tutor-dashboard' && !isTutorOrAdmin) return null;
              if (item.to === '/academy/create' && !isTutorOrAdmin) return null;
              // Hide Become a Tutor from existing tutors/admins
              if (item.to === '/academy/apply' && isTutorOrAdmin) return null;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/academy'}
                  className={({ isActive }) =>
                    `whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
                      isActive
                        ? 'border-secondary text-secondary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }`
                  }
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
