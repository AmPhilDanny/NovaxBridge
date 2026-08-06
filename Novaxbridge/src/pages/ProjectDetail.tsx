import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { projectsApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AIAssistButton } from '@/components/ai/AIAssistButton';
import { toast } from 'sonner';
import { Loader2, Users, CheckCircle2, XCircle, Clock, ArrowLeft, UserPlus, MessageSquare, SendHorizontal } from 'lucide-react';

interface ProjectProfile { id: string; full_name: string | null; avatar_url: string | null; }
interface ProjectRow {
  id: string; title: string; description: string; is_paid: boolean;
  status: string | null;
  collaboration_type: string | null; project_status: string | null;
  github_url: string | null; deployment_url: string | null;
  owner_id: string; created_at: string;
  profiles?: ProjectProfile | null;
  roles?: ProjectRole[];
  members?: ProjectMember[];
  applications?: ProjectApplication[];
  myApplications?: ProjectApplication[];
}
interface ProjectRole {
  id: string; project_id: string; role_title: string;
  description: string | null; skills_needed: string[];
  is_filled: boolean; created_at: string;
}
interface ProjectApplication {
  id: string; project_id: string; role_id: string;
  applicant_id: string; message: string | null; status: string;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null; headline: string | null; skills: string[] } | null;
}
interface ProjectMember {
  id: string; project_id: string; member_id: string;
  role: string | null; role_title: string | null; created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { user, profile } = useAuth();

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [applications, setApplications] = useState<ProjectApplication[]>([]);
  const [myApplications, setMyApplications] = useState<ProjectApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [applyRole, setApplyRole] = useState<ProjectRole | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  const isOwner = !!user && project?.owner_id === user.id;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await projectsApi.get(id);
      const proj = res.data;
      setProject(proj);
      setRoles(proj.roles || []);
      setMembers(proj.members || []);
      setApplications(proj.applications || []);
      setMyApplications(proj.myApplications || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error loading project');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApply = async () => {
    if (!user || !applyRole || !project) return;
    setIsApplying(true);
    try {
      await projectsApi.apply(project.id, { role_id: applyRole.id, message: applyMessage || undefined });
      toast.success('Application sent!');
      setApplyRole(null);
      setApplyMessage('');
      load();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error applying';
      if (msg.toLowerCase().includes('already')) toast.error("You've already applied to this role");
      else toast.error(msg);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDecision = async (application: ProjectApplication, decision: 'accepted' | 'rejected') => {
    try {
      await projectsApi.decide(project!.id, { application_id: application.id, status: decision });
      toast.success(decision === 'accepted' ? 'Collaborator added to the project' : 'Application declined');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error updating application');
    }
  };

  const loadJoinRequests = async () => {
    if (!id || !isOwner) return;
    setIsLoadingRequests(true);
    try {
      const res = await projectsApi.requests(id);
      setJoinRequests(res.data || []);
    } catch (_error) {
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (isOwner && id) loadJoinRequests();
  }, [isOwner, id]);

  const handleInvite = async () => {
    if (!id || !inviteUserId.trim()) return;
    setIsInviting(true);
    try {
      await projectsApi.invite(id, { recipient_id: inviteUserId.trim(), message: inviteMessage || undefined });
      toast.success('Invitation sent!');
      setIsInviteOpen(false);
      setInviteUserId('');
      setInviteMessage('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error sending invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleDecideRequest = async (requestId: string, status: 'accepted' | 'declined') => {
    if (!id) return;
    try {
      await projectsApi.decideRequest(id, requestId, status);
      toast.success(status === 'accepted' ? 'Request accepted' : 'Request declined');
      loadJoinRequests();
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error updating request');
    }
  };

  if (!project && isLoading) {
    return (
      <div className="min-h-screen pt-24 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen pt-24 px-4 text-center">
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const hasAppliedToRole = (roleId: string) => myApplications.some((a) => a.role_id === roleId);

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <Link to="/projects" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1.5 w-fit">
            <ArrowLeft className="w-4 h-4" /> Back to projects
          </Link>
          {(isOwner || members.some((m) => m.member_id === user?.id)) && (
            <Link to={`/projects/${id}/collaboration`}
              className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" /> Collaboration
            </Link>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge
                variant={
                  project.collaboration_type === 'paid' ? 'default' :
                  project.collaboration_type === 'stipend' ? 'secondary' : 'outline'
                }
                className="capitalize"
              >
                {project.collaboration_type || (project.is_paid ? 'paid' : 'free')}
              </Badge>
              <Badge
                variant="outline"
                className={
                  project.project_status === 'finished' ? 'bg-green-500/10 text-green-700 border-green-200' :
                  project.project_status === 'currently_active' ? 'bg-blue-500/10 text-blue-700 border-blue-200' :
                  'bg-yellow-500/10 text-yellow-700 border-yellow-200'
                }
              >
                  {project.project_status === 'currently_active' ? 'Active' :
                   project.project_status === 'finished' ? 'Finished' :
                   project.project_status === 'beginning' ? 'New' :
                   project.status?.replace('_', ' ') || 'New'}
               </Badge>
               {(project.project_status === 'beginning' || project.project_status === 'currently_active') && (
                 <Badge variant="secondary" className="bg-secondary/20 text-secondary border-secondary/30 gap-1">
                   <UserPlus className="w-3 h-3" />
                   Seeking collaborators
                 </Badge>
               )}
             </div>
            <CardTitle className="text-3xl text-primary">{project.title}</CardTitle>
            {project.profiles && (
              <Link to={`/talent/${project.profiles.id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary w-fit">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={project.profiles.avatar_url || undefined} />
                  <AvatarFallback>{(project.profiles.full_name || '?').charAt(0)}</AvatarFallback>
                </Avatar>
                {project.profiles.full_name || 'Anonymous'}
              </Link>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground whitespace-pre-line">{project.description}</p>
            {(project.github_url || project.deployment_url) && (
              <div className="flex gap-4">
                {project.github_url && (
                  <a href={project.github_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                    View on GitHub
                  </a>
                )}
                {project.deployment_url && (
                  <a href={project.deployment_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    Live Demo
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Roles */}
        <div>
          <h2 className="text-xl font-bold text-primary mb-4">Roles needed</h2>
          {roles.length === 0 ? (
            <p className="text-muted-foreground">No specific roles listed — reach out to the owner directly.</p>
          ) : (
            <div className="space-y-3">
              {roles.map((role) => (
                <Card key={role.id}>
                  <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-primary">{role.role_title}</h3>
                        {role.is_filled && <Badge variant="secondary">Filled</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(role.skills_needed || []).map((s) => (
                          <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                    {!isOwner && profile && !role.is_filled && (
                      <Button
                        size="sm"
                        disabled={hasAppliedToRole(role.id)}
                        onClick={() => setApplyRole(role)}
                        variant={hasAppliedToRole(role.id) ? 'secondary' : 'default'}
                      >
                        {hasAppliedToRole(role.id) ? 'Applied' : 'Apply for this role'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Team */}
        {members.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-secondary" /> Team
            </h2>
            <div className="flex flex-wrap gap-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 bg-card border border-border rounded-full pl-1.5 pr-4 py-1.5">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={m.profiles?.avatar_url || undefined} />
                    <AvatarFallback>{(m.profiles?.full_name || '?').charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{m.profiles?.full_name}</span>
                  {m.role_title && <span className="text-xs text-muted-foreground">· {m.role_title}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Owner: Invite Talent */}
        {isOwner && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-primary">Team Management</h2>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setIsInviteOpen(true)}>
                <UserPlus className="w-4 h-4" /> Invite Talent
              </Button>
            </div>
          </div>
        )}

        {/* Owner: manage applications */}
        {isOwner && (
          <div>
            <h2 className="text-xl font-bold text-primary mb-4">Applications</h2>
            {applications.length === 0 ? (
              <p className="text-muted-foreground">No applications yet.</p>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => {
                  const role = roles.find((r) => r.id === app.role_id);
                  return (
                    <Card key={app.id}>
                      <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={app.profiles?.avatar_url || undefined} />
                            <AvatarFallback>{(app.profiles?.full_name || '?').charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-primary">{app.profiles?.full_name}</p>
                            <p className="text-xs text-muted-foreground mb-1">Applying for: {role?.role_title || 'role'}</p>
                            {app.message && <p className="text-sm text-muted-foreground max-w-md">{app.message}</p>}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(app.profiles?.skills || []).slice(0, 5).map((s) => (
                                <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {app.status === 'pending' ? (
                            <>
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleDecision(app, 'accepted')}>
                                <CheckCircle2 className="w-4 h-4 text-green-600" /> Accept
                              </Button>
                              <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => handleDecision(app, 'rejected')}>
                                <XCircle className="w-4 h-4 text-destructive" /> Decline
                              </Button>
                            </>
                          ) : (
                            <Badge variant={app.status === 'accepted' ? 'default' : 'secondary'} className="capitalize gap-1">
                              {app.status === 'pending' && <Clock className="w-3 h-3" />}
                              {app.status}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Owner: Join Requests */}
        {isOwner && (
          <div>
            <h2 className="text-xl font-bold text-primary mb-4">Join Requests</h2>
            {isLoadingRequests ? (
              <Loader2 className="w-5 h-5 animate-spin text-secondary" />
            ) : joinRequests.length === 0 ? (
              <p className="text-muted-foreground">No pending join requests.</p>
            ) : (
              <div className="space-y-3">
                {joinRequests.filter((r: any) => r.status === 'pending').map((req: any) => (
                  <Card key={req.id}>
                    <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={req.requester?.avatar_url || undefined} />
                          <AvatarFallback>{(req.requester?.full_name || '?').charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-primary">{req.requester?.full_name || 'Unknown'}</p>
                          {req.message && <p className="text-sm text-muted-foreground max-w-md">{req.message}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleDecideRequest(req.id, 'accepted')}>
                          <CheckCircle2 className="w-4 h-4 text-green-600" /> Accept
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => handleDecideRequest(req.id, 'declined')}>
                          <XCircle className="w-4 h-4 text-destructive" /> Decline
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Invite Talent dialog */}
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Talent to Join</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-2">
                <Label>User ID (Profile UUID)</Label>
                <Input
                  placeholder="Paste the user's profile ID..."
                  value={inviteUserId}
                  onChange={(e) => setInviteUserId(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Message (optional)</Label>
                <Textarea
                  placeholder="Why you'd like them to join..."
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleInvite} disabled={isInviting || !inviteUserId.trim()} className="gap-2">
                {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
                Send Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Apply dialog */}
        <Dialog open={!!applyRole} onOpenChange={(open) => !open && setApplyRole(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for {applyRole?.role_title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-2">
                <Label>Message to the project owner (optional)</Label>
                <Textarea
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  placeholder="Why you're a good fit for this role..."
                  className="min-h-[100px]"
                />
                <AIAssistButton
                  mode="cover_letter"
                  label="Draft with AI"
                  buildPayload={() => ({
                    jobTitle: applyRole?.role_title,
                    jobDescription: `${project.title}: ${project.description}. Skills needed: ${(applyRole?.skills_needed || []).join(', ')}`,
                    applicantSummary: `${profile?.full_name || ''} — ${profile?.bio || ''}`,
                  })}
                  onAccept={(result) => setApplyMessage(result)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleApply} disabled={isApplying} className="gap-2">
                {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Send application
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
