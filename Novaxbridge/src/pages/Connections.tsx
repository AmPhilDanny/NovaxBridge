import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCall } from '@/hooks/useCall';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, UserPlus, UserCheck, UserX, MessageSquare, Users, Video } from 'lucide-react';
import { getConnections, getConnectionRequests, getSentRequests, acceptConnectionRequest, rejectConnectionRequest, cancelConnectionRequest, removeConnection, Connection } from '@/lib/marketplace';
import { toast } from 'sonner';

export default function Connections() {
  const { user } = useAuth();
  const { startCall } = useCall();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [requests, setRequests] = useState<Connection[]>([]);
  const [sentRequests, setSentRequests] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ peerId: string; name: string } | null>(null);

  useEffect(() => { loadAll(); }, [user]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [conns, reqs, sent] = await Promise.all([getConnections(), getConnectionRequests(), getSentRequests()]);
      setConnections(conns);
      setRequests(reqs);
      setSentRequests(sent);
    } catch {
      toast.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id: string) => {
    setProcessing(id);
    try {
      await acceptConnectionRequest(id);
      toast.success('Connection accepted');
      loadAll();
    } catch {
      toast.error('Failed to accept');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    try {
      await rejectConnectionRequest(id);
      toast.success('Request declined');
      loadAll();
    } catch {
      toast.error('Failed to decline');
    } finally {
      setProcessing(null);
    }
  };

  const handleCancelRequest = async (followerId: string, followingId: string) => {
    setProcessing(followerId + followingId);
    try {
      await cancelConnectionRequest(followerId, followingId);
      toast.success('Request cancelled');
      loadAll();
    } catch {
      toast.error('Failed to cancel request');
    } finally {
      setProcessing(null);
    }
  };

  const handleRemoveConnection = async (peerUserId: string) => {
    setProcessing(peerUserId);
    setRemoveTarget(null);
    try {
      await removeConnection(peerUserId);
      toast.success('Connection removed');
      loadAll();
    } catch (err) {
      console.error('Remove connection error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to remove connection');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-primary mb-6 flex items-center gap-2">
          <Users className="w-6 h-6 text-secondary" />
          Connections
        </h1>

        <Tabs defaultValue={requests.length > 0 ? 'requests' : 'all'}>
          <TabsList className="mb-6">
            <TabsTrigger value="all">
              All ({connections.length})
            </TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              Requests
              {requests.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">{requests.length}</Badge>
              )}
            </TabsTrigger>
            {sentRequests.length > 0 && (
              <TabsTrigger value="sent">
                Sent ({sentRequests.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="all">
            {connections.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No connections yet</p>
                <p className="text-sm">Visit profiles and send connection requests to grow your network.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {connections.map((c) => {
                  const profile = c.profile;
                  const peerId = c.following_id === user?.id ? c.follower_id : c.following_id;
                  const initials = profile?.full_name
                    ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                    : '?';
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Link to={`/talent/${peerId}`} className="shrink-0">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={profile?.avatar_url || undefined} />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/talent/${peerId}`} className="font-medium text-sm hover:underline truncate block">
                          {profile?.full_name || 'Unknown'}
                        </Link>
                        {profile?.headline && (
                          <p className="text-xs text-muted-foreground truncate">{profile.headline}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/messages?userId=${peerId}`}>
                            <MessageSquare className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startCall(peerId, profile?.full_name || 'User', profile?.avatar_url || undefined)}
                          title="Start video call"
                        >
                          <Video className="w-3.5 h-3.5 text-secondary" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRemoveTarget({ peerId, name: profile?.full_name || 'this user' })}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remove connection"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests">
            {requests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No pending requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => {
                  const profile = r.profile;
                  const initials = profile?.full_name
                    ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                    : '?';
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Link to={`/talent/${r.follower_id}`} className="shrink-0">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={profile?.avatar_url || undefined} />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/talent/${r.follower_id}`} className="font-medium text-sm hover:underline truncate block">
                          {profile?.full_name || 'Unknown'}
                        </Link>
                        {profile?.headline && (
                          <p className="text-xs text-muted-foreground truncate">{profile.headline}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Sent {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => handleAccept(r.id)} disabled={processing === r.id} className="gap-1">
                          {processing === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                          Accept
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReject(r.id)} disabled={processing === r.id}>
                          Decline
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent">
            {sentRequests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No pending outgoing requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentRequests.map((r) => {
                  const profile = r.profile;
                  const initials = profile?.full_name
                    ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                    : '?';
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Link to={`/talent/${r.following_id}`} className="shrink-0">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={profile?.avatar_url || undefined} />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/talent/${r.following_id}`} className="font-medium text-sm hover:underline truncate block">
                          {profile?.full_name || 'Unknown'}
                        </Link>
                        {profile?.headline && (
                          <p className="text-xs text-muted-foreground truncate">{profile.headline}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Sent {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancelRequest(r.follower_id, r.following_id)}
                          disabled={processing === r.follower_id + r.following_id}
                        >
                          {processing === r.follower_id + r.following_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Cancel'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Video call is handled globally by IncomingCallDialog + OutgoingCallStatus in App.tsx */}

      {/* Remove connection confirmation */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Connection?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove <span className="font-medium text-foreground">{removeTarget?.name}</span> from your connections? You can send another connection request later.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleRemoveConnection(removeTarget!.peerId)}
              disabled={processing === removeTarget?.peerId}
            >
              {processing === removeTarget?.peerId ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
