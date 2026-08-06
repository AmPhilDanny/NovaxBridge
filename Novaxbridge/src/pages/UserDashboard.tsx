import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Briefcase, FileText, User, GraduationCap, TrendingUp, ArrowRight, Star, Search, Users, Target, Building2, Shield, Settings, BarChart3, Video } from 'lucide-react';
import { toast } from 'sonner';

interface ApplicationWithJob {
  id: string;
  job_id: string;
  status: string;
  created_at: string;
  jobs: { title: string; type: string; location: string } | null;
}

interface JobPosting {
  id: string;
  title: string;
  type: string;
  location: string;
  company_name?: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  reviewed: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  interviewed: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  accepted: 'bg-green-500/15 text-green-700 dark:text-green-400',
  rejected: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

export default function UserDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<JobPosting[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    const fetchDashboardData = async () => {
    try {
      const [appsRes, jobsRes] = await Promise.all([
        supabase
          .from('applications')
          .select('id, job_id, status, created_at, jobs:job_id(title, type, location)')
          .eq('student_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('jobs')
          .select('id, title, type, location, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(4),
      ]);

      if (appsRes.error) throw appsRes.error;
      if (jobsRes.error) throw jobsRes.error;

      setApplications((appsRes.data || []) as unknown as ApplicationWithJob[]);
      setRecommendedJobs(jobsRes.data || []);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoaded(true);
    }
  };

    fetchDashboardData();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-6xl text-center py-24">
          <User className="w-16 h-16 text-secondary mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-3">My Dashboard</h1>
          <p className="text-muted-foreground mb-6">Sign in to view your dashboard.</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </div>
    );
  }

  const activeApps = applications.filter(a => a.status === 'pending' || a.status === 'reviewed' || a.status === 'interviewed');
  const profileStrength = profile?.skills?.length ? Math.min(100, 40 + profile.skills.length * 10) : 20;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">
            Welcome back, {profile?.full_name || user.email?.split('@')[0]}
          </h1>
          <p className="text-muted-foreground">
            {profile?.headline || 'Here is your learning and career overview.'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Applications</CardTitle>
              <Briefcase className="w-4 h-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{applications.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeApps.length > 0 ? `${activeApps.length} still active` : 'No active applications'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Profile Strength</CardTitle>
              <TrendingUp className="w-4 h-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{profileStrength}%</div>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div className="bg-secondary h-2 rounded-full" style={{ width: `${profileStrength}%` }} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Skills</CardTitle>
              <Star className="w-4 h-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{profile?.skills?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {profile?.skills?.length ? 'Skills listed on your profile' : 'Add skills to your profile'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* Applications */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-secondary" />
                  Recent Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                {applications.length === 0 ? (
                  <div className="text-center py-12">
                    <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-4">No applications yet</p>
                    <Button onClick={() => navigate('/jobs')}>
                      Browse Jobs
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.map((app) => (
                      <div key={app.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div>
                          <p className="font-medium text-sm">{app.jobs?.title || 'Unknown Position'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {app.jobs?.type} &middot; {app.jobs?.location}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={STATUS_STYLES[app.status] || ''} variant="secondary">
                            {app.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(app.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/jobs')}>
                  <Briefcase className="w-4 h-4 mr-2" />
                  Browse Jobs
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/my-applications')}>
                  <FileText className="w-4 h-4 mr-2" />
                  My Applications
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/profile')}>
                  <User className="w-4 h-4 mr-2" />
                  Update Profile
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/tutor')}>
                  <GraduationCap className="w-4 h-4 mr-2" />
                  AI Tutor
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate(`/video-call/${crypto.randomUUID().slice(0, 8)}`)}>
                  <Video className="w-4 h-4 mr-2" />
                  Video Call
                </Button>
              </CardContent>
            </Card>

            {/* B2B Quick Actions — only for firm/org users */}
            {profile?.role === 'firm' && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Organization
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/b2b/team')}>
                    <Users className="w-4 h-4 mr-2" />
                    Team
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/b2b/talent')}>
                    <Target className="w-4 h-4 mr-2" />
                    Talent Pool
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/b2b/hiring')}>
                    <Briefcase className="w-4 h-4 mr-2" />
                    Hiring
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/b2b/hiring/pipeline')}>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Pipeline
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/b2b/contracts')}>
                    <FileText className="w-4 h-4 mr-2" />
                    Contracts
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/b2b/compliance')}>
                    <Shield className="w-4 h-4 mr-2" />
                    Compliance
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/b2b/analytics')}>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Analytics
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/b2b/settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Recommended Jobs */}
        {recommendedJobs.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-secondary" />
              Recommended Jobs
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommendedJobs.map((job) => (
                <Card key={job.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/jobs`)}>
                  <CardHeader>
                    <CardTitle className="text-sm leading-tight">{job.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Briefcase className="w-3 h-3" />
                      {job.type}
                    </div>
                    <p className="text-xs text-muted-foreground">{job.location}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
