import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, Plus, Loader2, CheckCircle2, XCircle, Send, FileSignature, Play, CheckCircle, DollarSign, X as XIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  getContracts, createContract, transitionContract,
  getContractMilestones, createContractMilestone, updateContractMilestone, settleContract,
  searchTalent, B2BApiError,
  type Contract, type ContractMilestone, type TalentProfile,
} from '../../lib/api';
import { CONTRACT_STATUS_COLORS, CONTRACT_TYPE_LABELS, CONTRACT_STATUS_LABELS } from '../../lib/constants';
import ErrorDisplay from '../ErrorDisplay';

export default function ContractList() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<B2BApiError | null>(null);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [milestones, setMilestones] = useState<ContractMilestone[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(0);

  // Create form state
  const [talentSearch, setTalentSearch] = useState('');
  const [talentResults, setTalentResults] = useState<TalentProfile[]>([]);
  const [selectedTalent, setSelectedTalent] = useState<TalentProfile | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('fixed_price');
  const [formValue, setFormValue] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTerms, setFormTerms] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // New milestone form
  const [newMsTitle, setNewMsTitle] = useState('');
  const [newMsAmount, setNewMsAmount] = useState('');
  const [newMsDue, setNewMsDue] = useState('');

  const fetchContracts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getContracts();
      setContracts(result.data);
    } catch (err) {
      if (err instanceof B2BApiError) {
        setError(err);
      } else {
        setError(new B2BApiError('UNKNOWN', 'Failed to load contracts'));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const handleCreate = async () => {
    if (!selectedTalent || !formTitle) return;
    setIsCreating(true);
    try {
      const result = await createContract({
        talent_id: selectedTalent.id,
        title: formTitle,
        contract_type: formType as any,
        description: formDesc || undefined,
        total_value: parseFloat(formValue) || 0,
        terms: formTerms ? { description: formTerms } : {},
      });
      toast.success('Contract created');
      setShowCreate(false);
      resetCreateForm();
      fetchContracts();
      setSelected(result.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create contract');
    } finally {
      setIsCreating(false);
    }
  };

  const resetCreateForm = () => {
    setCreateStep(0);
    setTalentSearch('');
    setTalentResults([]);
    setSelectedTalent(null);
    setFormTitle('');
    setFormType('fixed_price');
    setFormValue('');
    setFormDesc('');
    setFormTerms('');
  };

  const searchTalentHandler = async () => {
    if (!talentSearch.trim()) return;
    try {
      const result = await searchTalent({ q: talentSearch });
      setTalentResults(result.data);
    } catch { /* ignore */ }
  };

  const selectContract = async (c: Contract) => {
    setSelected(c);
    try {
      const msResult = await getContractMilestones(c.id);
      setMilestones(msResult.data);
    } catch { /* ignore */ }
  };

  const handleTransition = async (status: string) => {
    if (!selected) return;
    try {
      const result = await transitionContract(selected.id, status);
      setSelected(result.data);
      setContracts(prev => prev.map(c => c.id === result.data.id ? result.data : c));
      toast.success(`Contract ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transition failed');
    }
  };

  const handleSettle = async () => {
    if (!selected) return;
    try {
      const result = await settleContract(selected.id);
      toast.success(`Contract settled: ${result.data.amount} paid`);
      if (selected) setSelected({ ...selected, settled_at: new Date().toISOString() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Settlement failed');
    }
  };

  const addMilestone = async () => {
    if (!selected || !newMsTitle.trim()) return;
    try {
      const result = await createContractMilestone(selected.id, {
        title: newMsTitle.trim(),
        amount: parseFloat(newMsAmount) || 0,
        due_date: newMsDue || undefined,
      });
      setMilestones(prev => [...prev, result.data]);
      setNewMsTitle('');
      setNewMsAmount('');
      setNewMsDue('');
    } catch {
      toast.error('Failed to add milestone');
    }
  };

  const updateMilestoneStatus = async (msId: string, status: string) => {
    if (!selected) return;
    try {
      const result = await updateContractMilestone(selected.id, msId, { status: status as any });
      setMilestones(prev => prev.map(m => m.id === msId ? result.data : m));
    } catch {
      toast.error('Failed to update milestone');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Contracts</h2>
          <p className="text-sm text-gray-500">{contracts.length} contract{contracts.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><FileText className="w-4 h-4 mr-2" /> New Contract</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Contract</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Step 1: Select talent */}
              <div className="space-y-2">
                <Label>Select Talent</Label>
                {!selectedTalent ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input placeholder="Search talent by name..." value={talentSearch} onChange={e => setTalentSearch(e.target.value)} />
                      <Button size="sm" onClick={searchTalentHandler}>Search</Button>
                    </div>
                    {talentResults.slice(0, 5).map(t => (
                      <div key={t.id} className="p-2 rounded border cursor-pointer hover:bg-gray-50" onClick={() => setSelectedTalent(t)}>
                        <p className="text-sm font-medium">{t.full_name || 'Unknown'}</p>
                        {t.headline && <p className="text-xs text-gray-500">{t.headline}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2 rounded bg-purple-50">
                    <p className="text-sm font-medium text-purple-900">{selectedTalent.full_name}</p>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedTalent(null)}>Change</Button>
                  </div>
                )}
              </div>

              {/* Step 2: Contract details */}
              <div className="space-y-3">
                <div>
                  <Label>Title *</Label>
                  <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Frontend Development Services" />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed_price">Fixed Price</SelectItem>
                      <SelectItem value="milestone_based">Milestone-Based</SelectItem>
                      <SelectItem value="msa">MSA</SelectItem>
                      <SelectItem value="sow">SOW</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Total Value</Label>
                    <Input type="number" value={formValue} onChange={e => setFormValue(e.target.value)} placeholder="0" />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Scope of work..." rows={3} />
                </div>
                <div>
                  <Label>Terms (JSON)</Label>
                  <Textarea value={formTerms} onChange={e => setFormTerms(e.target.value)} placeholder='{"payment_terms": "Net 30"}' rows={2} className="font-mono text-xs" />
                </div>
              </div>

              <Button onClick={handleCreate} disabled={!selectedTalent || !formTitle || isCreating} className="w-full">
                {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Contract
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contract list */}
        <div className="lg:col-span-1 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-600" /></div>
          ) : error ? (
            <ErrorDisplay error={error} onRetry={fetchContracts} />
          ) : contracts.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No contracts yet</p>
              </CardContent>
            </Card>
          ) : (
            contracts.map(c => (
              <Card key={c.id} className={`cursor-pointer hover:border-purple-200 transition-colors ${selected?.id === c.id ? 'border-purple-400 ring-1 ring-purple-400' : ''}`} onClick={() => selectContract(c)}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                    <Badge className={`text-xs ${CONTRACT_STATUS_COLORS[c.status] || ''}`}>{c.status}</Badge>
                  </div>
                   <p className="text-xs text-gray-500 mt-1">{c.talent?.full_name || 'Unknown'} · {CONTRACT_TYPE_LABELS[c.contract_type]}</p>
                  <p className="text-xs text-gray-400 mt-1">{c.currency} {c.total_value?.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Contract detail */}
        <div className="lg:col-span-2">
          {!selected ? (
            <Card>
              <CardContent className="p-12 text-center text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a contract to view details</p>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="milestones">Milestones ({milestones.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">{selected.title}</h3>
                      <Badge className={`text-xs ${CONTRACT_STATUS_COLORS[selected.status] || ''}`}>{selected.status.toUpperCase()}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-400">Talent:</span> <span className="font-medium">{selected.talent?.full_name || 'Unknown'}</span></div>
                      <div><span className="text-gray-400">Type:</span> <span className="font-medium">{CONTRACT_TYPE_LABELS[selected.contract_type]}</span></div>
                      <div><span className="text-gray-400">Value:</span> <span className="font-medium">{selected.currency} {selected.total_value?.toLocaleString()}</span></div>
                      <div><span className="text-gray-400">Created:</span> <span className="font-medium">{new Date(selected.created_at).toLocaleDateString()}</span></div>
                    </div>
                    {selected.description && <p className="text-sm text-gray-600">{selected.description}</p>}
                  </CardContent>
                </Card>

                {/* Status actions */}
                <div className="flex flex-wrap gap-2">
                  {selected.status === 'draft' && (
                    <Button size="sm" onClick={() => handleTransition('sent')}><Send className="w-3 h-3 mr-1" /> Send to Talent</Button>
                  )}
                  {selected.status === 'sent' && (
                    <Button size="sm" onClick={() => handleTransition('signed')}><FileSignature className="w-3 h-3 mr-1" /> Sign Contract</Button>
                  )}
                  {selected.status === 'signed' && (
                    <Button size="sm" onClick={() => handleTransition('active')}><Play className="w-3 h-3 mr-1" /> Activate</Button>
                  )}
                  {selected.status === 'active' && (
                    <Button size="sm" onClick={() => handleTransition('completed')}><CheckCircle className="w-3 h-3 mr-1" /> Complete</Button>
                  )}
                  {selected.status === 'completed' && !selected.settled_at && (
                    <Button size="sm" onClick={handleSettle}><DollarSign className="w-3 h-3 mr-1" /> Settle</Button>
                  )}
                  {!['completed', 'cancelled'].includes(selected.status) && (
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleTransition('cancelled')}><XCircle className="w-3 h-3 mr-1" /> Cancel</Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="milestones" className="space-y-4 mt-4">
                {/* Add milestone */}
                {(selected.status === 'draft' || selected.status === 'active') && (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Title</Label>
                      <Input size={30} value={newMsTitle} onChange={e => setNewMsTitle(e.target.value)} placeholder="Milestone title" />
                    </div>
                    <div className="w-24">
                      <Label className="text-xs">Amount</Label>
                      <Input type="number" value={newMsAmount} onChange={e => setNewMsAmount(e.target.value)} placeholder="0" />
                    </div>
                    <div className="w-36">
                      <Label className="text-xs">Due Date</Label>
                      <Input type="date" value={newMsDue} onChange={e => setNewMsDue(e.target.value)} />
                    </div>
                    <Button size="sm" onClick={addMilestone} disabled={!newMsTitle.trim()}><Plus className="w-3 h-3" /></Button>
                  </div>
                )}

                {milestones.length === 0 ? (
                  <Card><CardContent className="p-6 text-center text-gray-400 text-sm">No milestones defined</CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {milestones.map(ms => (
                      <Card key={ms.id}>
                        <CardContent className="p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900">{ms.title}</p>
                              <select
                                value={ms.status}
                                onChange={e => updateMilestoneStatus(ms.id, e.target.value)}
                                className="text-xs border rounded px-1 py-0.5"
                              >
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="submitted">Submitted</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            </div>
                            {ms.description && <p className="text-xs text-gray-500 mt-1">{ms.description}</p>}
                            <div className="flex gap-3 mt-1 text-xs text-gray-400">
                              {ms.amount > 0 && <span>Amount: {ms.amount}</span>}
                              {ms.due_date && <span>Due: {new Date(ms.due_date).toLocaleDateString()}</span>}
                            </div>
                          </div>
                          {ms.status === 'approved' && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />}
                          {ms.status === 'rejected' && <XIcon className="w-5 h-5 text-red-500 flex-shrink-0" />}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
