import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { githubApi, playgroundApi } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Github, Plus, ExternalLink, Code, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

interface Workspace {
  id: string;
  name: string;
  github_repo_name: string;
  github_repo_url: string;
  course_id: string | null;
  lesson_id: string | null;
  last_opened_at: string | null;
  created_at: string;
  course: { title: string } | null;
  lesson: { title: string } | null;
}

interface GitHubConnection {
  id: string;
  github_login: string;
  github_avatar_url: string;
  github_url: string;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Not opened yet';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return new Date(dateStr).toLocaleDateString();
}

function makeEditorUrl(repoUrl: string): string {
  return repoUrl.replace('github.com', 'github.dev');
}

export default function Playground() {
  const [searchParams] = useSearchParams();

  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [ghConnection, setGhConnection] = useState<GitHubConnection | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');

  // Pre-fill name from query params?
  const prefillCourseId = searchParams.get('course_id') || undefined;
  const prefillLessonId = searchParams.get('lesson_id') || undefined;

  const checkConnection = async () => {
    try {
      const { data } = await githubApi.getConnection();
      if (data) {
        setGithubConnected(true);
        setGhConnection(data);
      } else {
        setGithubConnected(false);
      }
    } catch {
      setGithubConnected(false);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const { data } = await playgroundApi.list();
      setWorkspaces(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load workspaces');
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await checkConnection();
      if (githubConnected !== false) {
        await fetchWorkspaces();
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (githubConnected === true) {
      fetchWorkspaces();
    }
  }, [githubConnected]);

  const handleConnect = async () => {
    try {
      const { data } = await githubApi.getUrl();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to get GitHub OAuth URL');
    }
  };

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      toast.error('Workspace name is required');
      return;
    }

    setCreating(true);
    try {
      const { data } = await playgroundApi.create({
        name: workspaceName.trim(),
        course_id: prefillCourseId,
        lesson_id: prefillLessonId,
      });

      setDialogOpen(false);
      setWorkspaceName('');
      toast.success('Workspace created! Opening editor...');

      // Build the github.dev URL using the login and repo name
      const login = (data as any).github_login || ghConnection?.github_login;
      const repoUrl = `https://github.com/${login}/${(data as any).github_repo_name}`;
      window.open(makeEditorUrl(repoUrl), '_blank');

      // Refresh workspaces
      await fetchWorkspaces();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenWorkspace = async (workspace: Workspace) => {
    // Fire-and-forget update last_opened_at
    playgroundApi.updateOpened(workspace.id).catch(() => {});

    window.open(workspace.github_repo_url, '_blank');
  };

  const handleOpenEditor = async (workspace: Workspace) => {
    // Fire-and-forget update last_opened_at
    playgroundApi.updateOpened(workspace.id).catch(() => {});

    window.open(makeEditorUrl(workspace.github_repo_url), '_blank');
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  // ── State: GitHub not connected ──
  if (githubConnected === false) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Code className="w-6 h-6 text-secondary" />
              Playground
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Practice code and keep it on your own GitHub.
            </p>
          </div>
        </div>

        <Card className="max-w-lg mx-auto mt-12">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Github className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              Connect your GitHub account to start a workspace
            </h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
              Create private repos for your coding exercises and open them in GitHub's VS Code editor.
            </p>
            <Button onClick={handleConnect} className="gap-2">
              <Github className="w-4 h-4" />
              Connect GitHub
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Connected: show workspaces ──

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Code className="w-6 h-6 text-secondary" />
            Playground
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Practice code and keep it on your own GitHub.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Workspace
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <Input
                  id="workspace-name"
                  placeholder="e.g. Web Dev 101 – Lesson 3"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateWorkspace();
                  }}
                />
              </div>
              {prefillCourseId && (
                <p className="text-xs text-muted-foreground">
                  This workspace will be linked to the current lesson.
                </p>
              )}
              <Button
                onClick={handleCreateWorkspace}
                disabled={creating || !workspaceName.trim()}
                className="w-full gap-2"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Github className="w-4 h-4" />
                )}
                {creating ? 'Creating repository...' : 'Create & Open in Editor'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {workspaces.length === 0 ? (
        /* Empty state */
        <Card className="max-w-lg mx-auto mt-12">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No workspaces yet</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
              Create your first workspace and start coding in your browser.
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Workspace
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Workspace cards */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <Card key={ws.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="font-semibold truncate">{ws.name}</h3>
                  {ws.course ? (
                    <span className="inline-block mt-1 text-[10px] font-medium tracking-wider text-secondary bg-secondary/10 px-2 py-0.5 rounded max-w-full truncate" title={ws.course.title}>
                      {ws.course.title}
                    </span>
                  ) : (
                    <span className="inline-block mt-1 text-[10px] font-medium tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      Free-form
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Last edited: {relativeTime(ws.last_opened_at)}
                </p>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => handleOpenWorkspace(ws)}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View Repo
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => handleOpenEditor(ws)}
                  >
                    <Code className="w-3.5 h-3.5" />
                    Open Editor
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
