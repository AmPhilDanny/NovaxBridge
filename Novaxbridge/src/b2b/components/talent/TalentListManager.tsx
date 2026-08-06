import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Download, Trash2, ExternalLink, X, Loader2, Users } from 'lucide-react';
import {
  getTalentLists, createTalentList, deleteTalentList,
  getListTalent, removeTalentFromList,
  B2BApiError,
  type TalentList, type SavedTalentEntry,
} from '../../lib/api';
import { toast } from 'sonner';
import ErrorDisplay from '../ErrorDisplay';

export default function TalentListManager() {
  const [lists, setLists] = useState<TalentList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<B2BApiError | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedList, setSelectedList] = useState<TalentList | null>(null);
  const [listTalent, setListTalent] = useState<SavedTalentEntry[]>([]);
  const [isLoadingTalent, setIsLoadingTalent] = useState(false);

  const fetchLists = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getTalentLists();
      setLists(result.data);
    } catch (err) {
      if (err instanceof B2BApiError) {
        setError(err);
      } else {
        setError(new B2BApiError('UNKNOWN', 'Failed to load talent lists'));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createTalentList(newName.trim(), newDesc.trim() || undefined);
      setNewName('');
      setNewDesc('');
      fetchLists();
      toast.success('List created');
    } catch {
      toast.error('Failed to create list');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTalentList(id);
      if (selectedList?.id === id) { setSelectedList(null); setListTalent([]); }
      fetchLists();
    } catch {
      toast.error('Failed to delete list');
    }
  };

  const openList = async (list: TalentList) => {
    setSelectedList(list);
    setIsLoadingTalent(true);
    try {
      const result = await getListTalent(list.id);
      setListTalent(result.data);
    } catch {
      toast.error('Failed to load list talent');
    } finally {
      setIsLoadingTalent(false);
    }
  };

  const handleRemove = async (talentId: string) => {
    if (!selectedList) return;
    try {
      await removeTalentFromList(selectedList.id, talentId);
      setListTalent(prev => prev.filter(t => t.talent_id !== talentId));
    } catch {
      toast.error('Failed to remove talent');
    }
  };

  const exportCSV = () => {
    if (!selectedList || listTalent.length === 0) return;
    const headers = 'Name,Headline,Skills,Location,Notes';
    const rows = listTalent.map(t => {
      const p = t.talent;
      return `"${p?.full_name || ''}","${p?.headline || ''}","${(p?.skills || []).join('; ')}","${p?.location || ''}","${t.notes || ''}"`;
    });
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedList.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Talent Lists</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New List</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Talent List</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Input placeholder="List name" value={newName} onChange={e => setNewName(e.target.value)} />
              <Input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              <Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List sidebar */}
        <div className="space-y-2">
          {error ? (
            <ErrorDisplay error={error} onRetry={fetchLists} />
          ) : lists.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No lists yet. Create one to save talent.</p>
              </CardContent>
            </Card>
          ) : (
            lists.map(list => (
              <Card
                key={list.id}
                className={`cursor-pointer transition-colors hover:border-purple-200 ${selectedList?.id === list.id ? 'border-purple-400 ring-1 ring-purple-400' : ''}`}
                onClick={() => openList(list)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{list.name}</p>
                    <p className="text-xs text-gray-400">{list.saved_talent?.[0]?.count || 0} saved</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(list.id); }}>
                    <Trash2 className="w-3 h-3 text-gray-400" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* List content */}
        <div className="lg:col-span-2">
          {!selectedList ? (
            <Card>
              <CardContent className="p-12 text-center text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a list to view its talent</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{selectedList.name}</h3>
                  {selectedList.description && <p className="text-xs text-gray-500">{selectedList.description}</p>}
                </div>
                <Button variant="outline" size="sm" onClick={exportCSV} disabled={listTalent.length === 0}>
                  <Download className="w-3 h-3 mr-1" /> Export CSV
                </Button>
              </div>

              {isLoadingTalent ? (
                <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-purple-600" /></div>
              ) : listTalent.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-gray-400">
                    <p className="text-sm">No talent saved in this list yet</p>
                    <p className="text-xs mt-1">Use the "Save to List" button on talent search results</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {listTalent.map(entry => (
                    <Card key={entry.id}>
                      <CardContent className="p-3 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-semibold flex-shrink-0">
                          {entry.talent?.full_name?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">{entry.talent?.full_name || 'Unknown'}</p>
                          {entry.talent?.headline && <p className="text-xs text-gray-500">{entry.talent.headline}</p>}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.talent?.skills?.slice(0, 4).map(s => (
                              <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                          {entry.notes && <p className="text-xs text-gray-400 italic mt-1">Note: {entry.notes}</p>}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleRemove(entry.talent_id)}>
                          <X className="w-3 h-3 text-gray-400" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
