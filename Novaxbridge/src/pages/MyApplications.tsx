import { useState, useEffect, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIAssistButton } from '@/components/ai/AIAssistButton';
import { toast } from 'sonner';
import { Loader2, Briefcase, FolderGit2, Clock, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type JobApplication = Database['public']['Tables']['applications']['Row'] & {
  jobs?: { title: string; type: string; requirements: string | null } | null;
};
type ProjectApplication = Database['public']['Tables']['project_applications']['Row'] & {
  projects?: { title: string; id: string } | null;
  project_roles?: { role_title: string; skills_needed: string[] } | null;
};

const STATUS_ICON: Record<string, ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  accepted: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
  reviewed: <Clock className="w-3.5 h-3.5" />,
  rejected: <XCircle className="w-3.5 h-3.5 text-destructive" />,
};

export default function MyApplications() {
  const { user, profile } = useAuth();
  const [jobApps, setJobApps] = useState<JobApplication[]>([]);
  const [projectApps, setProjectApps] = useState<ProjectApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gapResult, setGapResult] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [{ data: jApps }, { data: pApps }] = await Promise.all([
        supabase.from('applications').select('*, jobs(title, type, requirements)').eq('student_id', user.id).order('created_at', { ascending: false }),
        supabase
          .from('project_applications')
          .select('*, projects(title, id), project_roles(role_title, skills_needed)')
          .eq('applicant_id', user.id)
          .order('created_at', { ascending: false }),
      ]);
      setJobApps(jApps || []);
      setProjectApps(pApps || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error loading applications');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-24 px-4 text-center">
        <p className="text-muted-foreground">Sign in to see your applications.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold text-primary mb-2">My Applications</h1>
        <p className="text-muted-foreground mb-10">Track every job and project application in one place.</p>

        {jobApps.length === 0 && projectApps.length === 0 && isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : (
          <Tabs defaultValue="jobs">
            <TabsList>
              <TabsTrigger value="jobs" className="gap-1.5">
                <Briefcase className="w-4 h-4" /> Jobs ({jobApps.length})
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-1.5">
                <FolderGit2 className="w-4 h-4" /> Projects ({projectApps.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="jobs" className="space-y-3 mt-6">
              {jobApps.length === 0 ? (
                <p className="text-muted-foreground">No job applications yet. Browse the <Link to="/jobs" className="text-secondary hover:underline">marketplace</Link>.</p>
              ) : (
                jobApps.map((app) => (
                  <Card key={app.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-base">{app.jobs?.title || 'Job listing'}</CardTitle>
                          <Badge variant="outline" className="mt-1 capitalize">{app.jobs?.type}</Badge>
                        </div>
                        <Badge variant={app.status === 'accepted' ? 'default' : 'secondary'} className="gap-1 capitalize shrink-0">
                          {STATUS_ICON[app.status]} {app.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <details>
                        <summary className="text-sm text-secondary cursor-pointer flex items-center gap-1.5 w-fit">
                          <Sparkles className="w-3.5 h-3.5" /> What should I learn for this role?
                        </summary>
                        <div className="mt-3">
                          {gapResult[app.id] ? (
                            <p className="text-sm text-muted-foreground whitespace-pre-line">{gapResult[app.id]}</p>
                          ) : (
                            <AIAssistButton
                              mode="skill_gap"
                              label="Analyze skill gap"
                              buildPayload={() => ({
                                currentSkills: profile ? (profile as unknown as { skills?: string[] }).skills || [] : [],
                                targetTitle: app.jobs?.title,
                                targetSkills: (app.jobs?.requirements || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
                              })}
                              onAccept={(result) => setGapResult((prev) => ({ ...prev, [app.id]: result }))}
                            />
                          )}
                        </div>
                      </details>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="projects" className="space-y-3 mt-6">
              {projectApps.length === 0 ? (
                <p className="text-muted-foreground">No project applications yet. Browse <Link to="/projects" className="text-secondary hover:underline">projects</Link> to collaborate on.</p>
              ) : (
                projectApps.map((app) => (
                  <Link key={app.id} to={`/projects/${app.projects?.id}`}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-base">{app.projects?.title}</CardTitle>
                            <p className="text-sm text-muted-foreground">Role: {app.project_roles?.role_title}</p>
                          </div>
                          <Badge variant={app.status === 'accepted' ? 'default' : 'secondary'} className="gap-1 capitalize shrink-0">
                            {STATUS_ICON[app.status]} {app.status}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
