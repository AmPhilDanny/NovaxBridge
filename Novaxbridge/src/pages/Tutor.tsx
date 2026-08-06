import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, BookOpen, Plus, MessageSquare, Clock, CheckCircle2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { TutorSession } from '@/lib/ai';

const STATUS_UI: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  active: { label: 'Active', className: 'bg-green-500/15 text-green-700 dark:text-green-400', icon: Clock },
  paused: { label: 'Paused', className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400', icon: Clock },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground', icon: CheckCircle2 },
};

interface TutorProps {
  compact?: boolean;
  basePath?: string;
}

export default function Tutor({ compact, basePath = '/tutor' }: TutorProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<TutorSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user) fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('tutor_sessions')
        .select('*')
        .eq('student_id', user!.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setSessions((data || []) as TutorSession[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error loading sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;
    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('tutor_sessions')
        .insert({
          student_id: user.id,
          title: newTitle.trim(),
          topic: newTopic.trim() || null,
          status: 'active',
        })
        .select()
        .single();
      if (error) throw error;
      toast.success('Session created');
      setDialogOpen(false);
      setNewTitle('');
      setNewTopic('');
      if (data) {
        setSessions((prev) => [data as unknown as TutorSession, ...prev]);
        navigate(`${basePath}/${data.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error creating session');
    } finally {
      setIsCreating(false);
    }
  };

  if (!user) {
    return (
      <div className={compact ? '' : 'min-h-screen pt-24 pb-12 px-4'}>
        <div className={compact ? 'text-center py-12' : 'container mx-auto max-w-6xl text-center py-24'}>
          <GraduationCap className="w-16 h-16 text-secondary mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-3">AI Tutor</h1>
          <p className="text-muted-foreground mb-6">Sign in to start your tutoring sessions.</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'min-h-screen pt-24 pb-12 px-4'}>
      <div className={compact ? 'mx-auto' : 'container mx-auto max-w-6xl'}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-bold text-primary mb-2 flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-secondary" />
              AI Tutor
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Your personal AI tutor powered by OpenRouter/Mistral. Practice concepts, get unstuck, and
              track your learning progress.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Tutoring Session</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Session Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g. JavaScript Promises"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="topic">Topic (optional)</Label>
                  <Input
                    id="topic"
                    placeholder="e.g. asynchronous JavaScript"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={isCreating} className="w-full">
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create & Start Learning
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {sessions.length === 0 && isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            <p className="text-muted-foreground">Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No sessions yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start your first tutoring session. Pick a topic you are learning and get AI-guided instruction.
            </p>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>Start Learning</Button>
              </DialogTrigger>
            </Dialog>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => {
              const statusInfo = STATUS_UI[session.status] || STATUS_UI.active;
              const StatusIcon = statusInfo.icon;
              return (
                <Card
                  key={session.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`${basePath}/${session.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg leading-tight">{session.title}</CardTitle>
                      <Badge className={statusInfo.className} variant="secondary">
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {session.topic && (
                      <p className="text-sm text-muted-foreground mb-3">
                        <span className="font-medium">Topic:</span> {session.topic}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Tutor session
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(session.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
