import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { projectsApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, MessageSquare, Send, Users } from 'lucide-react';

interface CollabMessage {
  id: string;
  project_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { id: string; full_name: string | null; avatar_url: string | null };
}

interface CollabMember {
  id: string;
  project_id: string;
  member_id: string;
  role: string | null;
  role_title: string | null;
  profiles?: { id: string; full_name: string | null; avatar_url: string | null };
}

interface CollabProject {
  id: string;
  owner_id: string;
  title: string;
  profiles?: { id: string; full_name: string | null; avatar_url: string | null };
  members: CollabMember[];
}

export default function ProjectCollaboration() {
  const { id } = useParams();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [project, setProject] = useState<CollabProject | null>(null);
  const [messages, setMessages] = useState<CollabMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const isOwner = !!user && project?.owner_id === user.id;
  const isMember = !!user && (isOwner || (project?.members || []).some((m) => m.member_id === user.id));

  useEffect(() => {
    if (!id || !user) return;
    loadData();
  }, [id, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [collabRes, msgRes] = await Promise.all([
        projectsApi.collaboration(id),
        projectsApi.messages(id),
      ]);
      setProject(collabRes.data);
      setMessages(msgRes.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error loading collaboration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newMessage.trim() || isSending) return;
    setIsSending(true);
    try {
      const res = await projectsApi.sendMessage(id, newMessage.trim());
      setMessages((prev) => [...prev, res.data]);
      setNewMessage('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error sending message');
    } finally {
      setIsSending(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-4xl text-center py-24">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to access collaboration</h2>
          <p className="text-muted-foreground mb-6">You need to be signed in and a project member to view this page.</p>
          <Button asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!project || !isMember) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-4xl text-center py-24">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Not a member</h2>
          <p className="text-muted-foreground mb-6">You are not a member of this project's collaboration workspace.</p>
          <Button asChild variant="outline">
            <Link to={`/projects/${id}`}>Back to project</Link>
          </Button>
        </div>
      </div>
    );
  }

  const allMembers = [
    ...(project.profiles ? [{ id: 'owner', member_id: project.owner_id, role: null, role_title: 'Owner', profiles: project.profiles }] : []),
    ...project.members,
  ];

  return (
    <div className="min-h-screen pt-20 pb-4 px-4">
      <div className="container mx-auto max-w-6xl h-[calc(100vh-7rem)] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <Link to={`/projects/${id}`} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <h1 className="text-xl font-bold text-primary">{project.title}</h1>
          </div>
        </div>

        <div className="flex-1 flex gap-4 min-h-0">
          <div className="hidden md:flex flex-col w-72 shrink-0 bg-card border rounded-lg overflow-hidden">
            <div className="p-3 border-b">
              <h2 className="text-sm font-semibold text-primary flex items-center gap-2">
                <Users className="w-4 h-4 text-secondary" />
                Members ({allMembers.length})
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {allMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={m.profiles?.avatar_url || undefined} />
                    <AvatarFallback>{(m.profiles?.full_name || '?').charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.profiles?.full_name || 'Unknown'}</p>
                    {m.role_title && <p className="text-xs text-muted-foreground truncate">{m.role_title}</p>}
                    {m.member_id === project.owner_id && <p className="text-xs text-secondary">Owner</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-card border rounded-lg overflow-hidden">
            <div className="p-3 border-b bg-muted/30">
              <h2 className="text-sm font-semibold text-primary flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-secondary" />
                Chat
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mb-2" />
                  <p className="text-sm">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  const senderName = msg.sender?.full_name || 'Unknown';
                  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                        <AvatarImage src={msg.sender?.avatar_url || undefined} />
                        <AvatarFallback>{senderName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[75%] ${isMe ? 'items-end' : ''}`}>
                        <div className="flex items-baseline gap-2 mb-0.5">
                          {!isMe && <span className="text-xs font-medium text-muted-foreground">{senderName}</span>}
                          <span className="text-xs text-muted-foreground">{time}</span>
                        </div>
                        <div className={`rounded-lg px-3 py-2 text-sm ${
                          isMe ? 'bg-secondary text-secondary-foreground' : 'bg-muted'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={isSending}
                className="flex-1"
              />
              <Button type="submit" disabled={!newMessage.trim() || isSending} size="sm" className="gap-1.5">
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}