import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { projectsApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AIAssistButton } from '@/components/ai/AIAssistButton';
import { SkillInput } from '@/components/talent/SkillInput';
import { toast } from 'sonner';
import { Plus, Loader2, FolderGit2, Users, Search, UserPlus, Clock } from 'lucide-react';

interface ProjectRow {
  id: string;
  title: string;
  description: string;
  is_paid: boolean;
  status: string | null;
  collaboration_type: string | null;
  project_status: string | null;
  github_url: string | null;
  deployment_url: string | null;
  owner_id: string;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
  project_roles?: { id: string; role_title: string; is_filled: boolean }[];
}

interface DraftRole {
  role_title: string;
  skills_needed: string[];
}

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [newProject, setNewProject] = useState({ title: '', description: '', is_paid: false, collaboration_type: 'free', project_status: 'beginning', github_url: '', deployment_url: '' });
  const [draftRoles, setDraftRoles] = useState<DraftRole[]>([{ role_title: '', skills_needed: [] }]);

  const [requestedProjects, setRequestedProjects] = useState<Set<string>>(new Set());
  const [requestingId, setRequestingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await projectsApi.list();
      setProjects(res.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error loading projects');
    } finally {
      setIsLoading(false);
    }
  };

  const addRoleField = () => setDraftRoles((prev) => [...prev, { role_title: '', skills_needed: [] }]);
  const removeRoleField = (idx: number) => setDraftRoles((prev) => prev.filter((_, i) => i !== idx));
  const updateRole = (idx: number, patch: Partial<DraftRole>) =>
    setDraftRoles((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newProject.title.trim() || !newProject.description.trim()) {
      toast.error('Give your project a title and description');
      return;
    }
    setIsPosting(true);
    try {
      await projectsApi.create({
        title: newProject.title,
        description: newProject.description,
        project_type: newProject.collaboration_type || undefined,
        roles: draftRoles
          .filter((r) => r.role_title.trim())
          .map((r) => ({ role_title: r.role_title, description: undefined })),
      });

      toast.success('Project posted! Collaborators can now apply.');
      setIsCreateOpen(false);
      setNewProject({ title: '', description: '', is_paid: false, collaboration_type: 'free', project_status: 'beginning', github_url: '', deployment_url: '' });
      setDraftRoles([{ role_title: '', skills_needed: [] }]);
      fetchProjects();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error posting project');
    } finally {
      setIsPosting(false);
    }
  };

  const handleRequestJoin = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || requestingId) return;
    setRequestingId(projectId);
    try {
      await projectsApi.requestJoin(projectId);
      toast.success('Join request sent!');
      setRequestedProjects((prev) => new Set(prev).add(projectId));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error requesting to join';
      if (msg.toLowerCase().includes('already')) toast.error('You already have a pending request');
      else toast.error(msg);
    } finally {
      setRequestingId(null);
    }
  };

  const filtered = projects.filter(
    (p) =>
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-bold text-primary mb-2 flex items-center gap-3">
              <FolderGit2 className="w-8 h-8 text-secondary" />
              Build Together
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Post a project that needs collaborators, or find one to join. Paid or unpaid — this is where
              teams form.
            </p>
          </div>

          {user && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Post a Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Post a project</DialogTitle>
                  <DialogDescription>Describe what you're building and what roles you need filled.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateProject} className="space-y-4 py-2">
                  <div className="grid gap-2">
                    <Label>Project title</Label>
                    <Input
                      placeholder="e.g. Farm-to-market price tracker"
                      value={newProject.title}
                      onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="What are you building, who is it for, what stage is it at..."
                      className="min-h-[100px]"
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      required
                    />
                    <AIAssistButton
                      mode="project_polish"
                      label="Polish with AI"
                      buildPayload={() => ({ rawDescription: newProject.description })}
                      onAccept={(result) => setNewProject((p) => ({ ...p, description: result }))}
                      disabled={!newProject.description.trim()}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="is_paid"
                      type="checkbox"
                      checked={newProject.is_paid}
                      onChange={(e) => setNewProject({ ...newProject, is_paid: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="is_paid" className="cursor-pointer">This project offers pay or equity</Label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Collaboration Type</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newProject.collaboration_type}
                        onChange={(e) => setNewProject({ ...newProject, collaboration_type: e.target.value })}
                      >
                        <option value="free">Free / Volunteer</option>
                        <option value="stipend">Stipend</option>
                        <option value="paid">Paid</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Project Stage</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newProject.project_status}
                        onChange={(e) => setNewProject({ ...newProject, project_status: e.target.value })}
                      >
                        <option value="beginning">Just Starting</option>
                        <option value="currently_active">Currently Active</option>
                        <option value="finished">Finished / Complete</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>GitHub URL</Label>
                      <Input
                        placeholder="https://github.com/..."
                        value={newProject.github_url}
                        onChange={(e) => setNewProject({ ...newProject, github_url: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Deployment URL</Label>
                      <Input
                        placeholder="https://myapp.vercel.app"
                        value={newProject.deployment_url}
                        onChange={(e) => setNewProject({ ...newProject, deployment_url: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Roles needed</Label>
                    {draftRoles.map((role, idx) => (
                      <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g. Backend developer"
                            value={role.role_title}
                            onChange={(e) => updateRole(idx, { role_title: e.target.value })}
                          />
                          {draftRoles.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeRoleField(idx)}>
                              Remove
                            </Button>
                          )}
                        </div>
                        <SkillInput
                          value={role.skills_needed}
                          onChange={(skills) => updateRole(idx, { skills_needed: skills })}
                          placeholder="Skills needed for this role..."
                        />
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addRoleField} className="gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Add another role
                    </Button>
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={isPosting}>
                      {isPosting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Post project
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="relative mb-8 max-w-md">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search projects..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {filtered.length === 0 && isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        ) : filtered.length === 0 && !user ? (
          <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border">
            <FolderGit2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Find Projects to Join</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Sign in to browse collaboration opportunities and connect with builders across Africa.
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/auth">Create Account</Link>
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border">
            <FolderGit2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground">Be the first to post one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((project) => {
              const openRoles = (project.project_roles || []).filter((r) => !r.is_filled);
              return (
                <Link key={project.id} to={`/projects/${project.id}`}>
                  <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start mb-2">
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
                      <CardTitle className="text-xl">{project.title}</CardTitle>
                      <CardDescription>by {project.profiles?.full_name || 'Anonymous'}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-2">
                      <p className="text-sm text-muted-foreground line-clamp-3">{project.description}</p>
                      {(project.github_url || project.deployment_url) && (
                        <div className="flex gap-3 text-xs">
                          {project.github_url && (
                            <a href={project.github_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                              onClick={(e) => e.stopPropagation()}>
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                              GitHub
                            </a>
                          )}
                          {project.deployment_url && (
                            <a href={project.deployment_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                              onClick={(e) => e.stopPropagation()}>
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                              Live Demo
                            </a>
                          )}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5 text-sm text-secondary">
                          <Users className="w-4 h-4" />
                          {openRoles.length > 0 ? `${openRoles.length} open role${openRoles.length > 1 ? 's' : ''}` : 'Roles filled'}
                        </div>
                        {user && project.owner_id !== user.id && !requestedProjects.has(project.id) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 text-xs"
                            disabled={requestingId === project.id}
                            onClick={(e) => handleRequestJoin(e, project.id)}
                          >
                            {requestingId === project.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserPlus className="w-3 h-3" />
                            )}
                            {requestingId === project.id ? 'Sending...' : 'Request to Join'}
                          </Button>
                        )}
                        {user && requestedProjects.has(project.id) && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Clock className="w-3 h-3" /> Requested
                          </Badge>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
