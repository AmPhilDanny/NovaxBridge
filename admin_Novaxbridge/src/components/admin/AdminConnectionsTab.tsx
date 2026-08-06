import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Users, Trash2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

interface Connection {
  id: string;
  follower_id: string;
  following_id: string;
  status: string;
  created_at: string;
  follower?: { id: string; full_name: string; email: string; avatar_url?: string; role?: string; headline?: string };
  following?: { id: string; full_name: string; email: string; avatar_url?: string; role?: string; headline?: string };
}

interface DuplicateGroup {
  key: string;
  user1: string;
  user2: string;
  count: number;
  rows: Connection[];
}

export default function AdminConnectionsTab() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<Connection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deduplicating, setDeduplicating] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error('Not authenticated'); return; }

      const [connRes, dupRes] = await Promise.all([
        fetch(`${API_BASE}/admin/connections`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/connections/duplicates`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!connRes.ok) throw new Error('Failed to fetch connections');
      const connJson = await connRes.json();
      setConnections(connJson.data || []);

      if (dupRes.ok) {
        const dupJson = await dupRes.json();
        setDuplicates(dupJson.data || []);
      }
    } catch {
      toast.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error('Not authenticated'); return; }

      const res = await fetch(`${API_BASE}/admin/connections/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete' }));
        throw new Error(err.error || 'Failed to delete');
      }
      toast.success('Connection removed');
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeduplicate = async () => {
    setDeduplicating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error('Not authenticated'); return; }

      const res = await fetch(`${API_BASE}/admin/connections/deduplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Deduplication failed');
      const json = await res.json();
      toast.success(`Removed ${json.data?.removed || 0} duplicate connection(s)`);
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deduplicate');
    } finally {
      setDeduplicating(false);
    }
  };

  const renderProfile = (p: Connection['follower' | 'following']) => {
    if (!p) return <span className="text-muted-foreground text-xs">Unknown</span>;
    return (
      <div>
        <div className="font-medium text-sm">{p.full_name || 'Unnamed'}</div>
        <div className="text-xs text-muted-foreground">{p.email || ''}</div>
        {p.headline && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{p.headline}</div>}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Connections</CardTitle></CardHeader>
        <CardContent><div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-secondary" /></div></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Connections
            <Badge variant="secondary" className="ml-2">{connections.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={fetchAll}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh</Button>
            {duplicates.length > 0 && (
              <Button size="sm" variant="destructive" onClick={handleDeduplicate} disabled={deduplicating}>
                {deduplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
                Fix Duplicates ({duplicates.length})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Connections</TabsTrigger>
            {duplicates.length > 0 && (
              <TabsTrigger value="duplicates" className="relative">
                Duplicates
                <Badge variant="destructive" className="ml-2 text-xs">{duplicates.length}</Badge>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="all">
            {connections.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No connections in the system.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Follower</TableHead>
                      <TableHead>Following</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connections.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{renderProfile(c.follower)}</TableCell>
                        <TableCell>{renderProfile(c.following)}</TableCell>
                        <TableCell>
                          <Badge variant={c.status === 'accepted' ? 'default' : c.status === 'pending' ? 'secondary' : 'outline'}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleteTarget(c)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="duplicates">
            {duplicates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-60" />
                <p>No duplicate connections found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {duplicates.length} pair(s) have duplicate connection rows. The oldest row is kept, extras are removed.
                  </p>
                  <Button size="sm" variant="destructive" onClick={handleDeduplicate} disabled={deduplicating}>
                    {deduplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
                    Remove All Duplicates
                  </Button>
                </div>
                {duplicates.map((dup) => (
                  <div key={dup.key} className="border border-destructive/30 rounded-lg p-4 bg-destructive/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        <span className="font-medium text-sm">{dup.user1} ↔ {dup.user2}</span>
                        <Badge variant="destructive" className="text-xs">{dup.count} rows</Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {dup.rows.map((row) => (
                        <div key={row.id} className="flex items-center justify-between text-xs text-muted-foreground bg-background rounded px-3 py-1.5">
                          <span className="font-mono">{row.id.slice(0, 8)}…</span>
                          <span>{row.status}</span>
                          <span>{new Date(row.created_at).toLocaleString()}</span>
                          <Button size="sm" variant="ghost" className="h-6 text-red-500" onClick={() => setDeleteTarget(row)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Connection</DialogTitle>
            <DialogDescription>
              Remove this connection row between{' '}
              <strong>{deleteTarget?.follower?.full_name || deleteTarget?.follower_id}</strong> and{' '}
              <strong>{deleteTarget?.following?.full_name || deleteTarget?.following_id}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
