import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Plus, Clock, CheckCircle2, XCircle, Banknote, ShieldCheck, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  getWalletBalance,
  getWalletTransactions,
  WalletBalance,
  WalletTransaction,
  getPayouts,
  requestPayout,
  Payout,
  getProviderBankAccount,
  saveProviderBankAccount,
  uploadKycDocument,
  ProviderBankAccount,
} from '@/lib/marketplace';

const TX_ICONS: Record<string, typeof ArrowUpRight> = {
  credit: ArrowDownLeft,
  debit: ArrowUpRight,
  payout: ArrowUpRight,
  refund: ArrowDownLeft,
  bonus: ArrowDownLeft,
};

const TX_COLORS: Record<string, string> = {
  credit: 'text-green-600',
  debit: 'text-red-600',
  payout: 'text-red-600',
  refund: 'text-green-600',
  bonus: 'text-green-600',
};

export default function Wallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'transactions' | 'payouts' | 'bank'>('transactions');

  // Bank account state
  const [bankAccount, setBankAccount] = useState<ProviderBankAccount | null>(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankFormOpen, setBankFormOpen] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: '', account_number: '', account_name: '', routing_number: '', swift_code: '', country: 'NG' });
  const [savingBank, setSavingBank] = useState(false);
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [uploadingKyc, setUploadingKyc] = useState(false);

  // Payout form
  const [showPayout, setShowPayout] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) { fetchData(); fetchBankAccount(); }
  }, [user]);

  const fetchData = async () => {
    try {
      const [bal, txs, pts] = await Promise.all([
        getWalletBalance(),
        getWalletTransactions(),
        getPayouts(),
      ]);
      setBalance(bal);
      setTransactions(txs);
      setPayouts(pts);
    } catch (error) {
      toast.error('Failed to load wallet data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBankAccount = async () => {
    setBankLoading(true);
    try {
      const acct = await getProviderBankAccount();
      setBankAccount(acct);
      if (acct) {
        setBankForm({
          bank_name: acct.bank_name,
          account_number: acct.account_number,
          account_name: acct.account_name,
          routing_number: acct.routing_number || '',
          swift_code: acct.swift_code || '',
          country: acct.country,
        });
      }
    } catch {
      // no account yet
    } finally {
      setBankLoading(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankForm.bank_name || !bankForm.account_number || !bankForm.account_name) {
      toast.error('Fill all required fields');
      return;
    }
    setSavingBank(true);
    try {
      await saveProviderBankAccount(bankForm);
      toast.success('Bank account saved');
      setBankFormOpen(false);
      fetchBankAccount();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save bank account');
    } finally {
      setSavingBank(false);
    }
  };

  const handleUploadKyc = async () => {
    if (!kycFile) { toast.error('Select a document first'); return; }
    setUploadingKyc(true);
    try {
      await uploadKycDocument(kycFile);
      toast.success('KYC document uploaded. Awaiting admin verification.');
      setKycFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
    } finally {
      setUploadingKyc(false);
    }
  };

  const handlePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!bankName || !accountNumber || !accountName) { toast.error('Fill all bank details'); return; }
    if (balance && amt > balance.balance) { toast.error('Insufficient balance'); return; }

    setSubmitting(true);
    try {
      await requestPayout({ amount: amt, bank_name: bankName, account_number: accountNumber, account_name: accountName });
      toast.success('Payout requested!');
      setShowPayout(false);
      setAmount('');
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to request payout');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
          <WalletIcon className="w-7 h-7 text-secondary" />
          Wallet
        </h1>
        <p className="text-muted-foreground mb-8">Track your earnings, transactions, and withdrawals.</p>

        {balance === null && transactions.length === 0 && isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : (
          <>
            {/* Balance Card */}
            <Card className="mb-8 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/10">
              <CardContent className="pt-8 pb-8">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                  <p className="text-5xl font-bold text-primary mb-2">
                    ₦{Number(balance?.balance || 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {balance?.transaction_count || 0} total transactions
                  </p>
                  <Button className="mt-4 gap-1.5" onClick={() => setShowPayout(true)} disabled={!balance || balance.balance <= 0}>
                    <Plus className="w-4 h-4" />
                    Request Payout
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <Button variant={tab === 'transactions' ? 'default' : 'outline'} size="sm" onClick={() => setTab('transactions')}>
                Transactions
              </Button>
              <Button variant={tab === 'payouts' ? 'default' : 'outline'} size="sm" onClick={() => setTab('payouts')}>
                Payouts ({payouts.length})
              </Button>
              <Button variant={tab === 'bank' ? 'default' : 'outline'} size="sm" onClick={() => setTab('bank')}>
                <Banknote className="w-4 h-4 mr-1" />
                Bank Account
              </Button>
            </div>

            {tab === 'transactions' ? (
              transactions.length === 0 ? (
                <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border">
                  <WalletIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No transactions yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => {
                    const Icon = TX_ICONS[tx.type] || ArrowUpRight;
                    return (
                      <Card key={tx.id}>
                        <CardContent className="py-3 px-5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${tx.type === 'credit' || tx.type === 'bonus' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                <Icon className={`w-4 h-4 ${TX_COLORS[tx.type] || ''}`} />
                              </div>
                              <div>
                                <p className="text-sm font-medium capitalize">{tx.type}</p>
                                <p className="text-xs text-muted-foreground">{tx.description || tx.reference}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-medium ${TX_COLORS[tx.type] || ''}`}>
                                {tx.type === 'credit' || tx.type === 'bonus' ? '+' : '-'}₦{Number(tx.amount).toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )
            ) : tab === 'bank' ? (
              bankLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                </div>
              ) : bankAccount ? (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Banknote className="w-4 h-4" />
                        Saved Bank Account
                      </h3>
                      <Badge
                        variant="secondary"
                        className={
                          bankAccount.kyc_status === 'verified' ? 'bg-green-500/15 text-green-700' :
                          bankAccount.kyc_status === 'rejected' ? 'bg-red-500/15 text-red-700' :
                          bankAccount.kyc_status === 'pending' ? 'bg-blue-500/15 text-blue-700' :
                          'bg-yellow-500/15 text-yellow-700'
                        }
                      >
                        {bankAccount.kyc_status === 'verified' ? <ShieldCheck className="w-3 h-3 mr-1" /> : null}
                        KYC: {bankAccount.kyc_status}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="text-sm space-y-2">
                      <p><span className="text-muted-foreground">Bank:</span> {bankAccount.bank_name}</p>
                      <p><span className="text-muted-foreground">Account Name:</span> {bankAccount.account_name}</p>
                      <p><span className="text-muted-foreground">Account Number:</span> ****{bankAccount.account_number.slice(-4)}</p>
                      {bankAccount.routing_number && <p><span className="text-muted-foreground">Routing:</span> {bankAccount.routing_number}</p>}
                      {bankAccount.swift_code && <p><span className="text-muted-foreground">SWIFT:</span> {bankAccount.swift_code}</p>}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => setBankFormOpen(true)} className="gap-1.5">
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                      {bankAccount.kyc_status !== 'verified' && (
                        <div className="flex gap-2 items-center">
                          <Input
                            type="file"
                            accept="image/*,.pdf"
                            className="w-40 text-xs"
                            onChange={(e) => setKycFile(e.target.files?.[0] || null)}
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleUploadKyc}
                            disabled={!kycFile || uploadingKyc}
                          >
                            {uploadingKyc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Upload KYC'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center py-12">
                    <Banknote className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-4">You haven't saved your bank account details yet.</p>
                    <Button onClick={() => setBankFormOpen(true)} className="gap-1.5">
                      <Plus className="w-4 h-4" />
                      Add Bank Account
                    </Button>
                  </CardContent>
                </Card>
              )
            ) : (
              payouts.length === 0 ? (
                <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border">
                  <WalletIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No payout requests yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payouts.map((pt) => (
                    <Card key={pt.id}>
                      <CardContent className="py-3 px-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">₦{Number(pt.amount).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{pt.bank_name} — {pt.account_name}</p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={
                              pt.status === 'paid' ? 'bg-green-500/15 text-green-700' :
                              pt.status === 'rejected' ? 'bg-red-500/15 text-red-700' :
                              pt.status === 'processing' ? 'bg-blue-500/15 text-blue-700' :
                              'bg-yellow-500/15 text-yellow-700'
                            }
                          >
                            {pt.status}
                          </Badge>
                        </div>
                        {pt.admin_notes && <p className="text-xs text-muted-foreground mt-1">Note: {pt.admin_notes}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Bank Account Dialog */}
      <Dialog open={bankFormOpen} onOpenChange={setBankFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bankAccount ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveBank} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Bank Name *</Label>
              <Input placeholder="e.g. GTBank, Access Bank" value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Account Number *</Label>
              <Input placeholder="0123456789" value={bankForm.account_number} onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Account Name * <span className="text-xs text-muted-foreground">(must match your profile name)</span></Label>
              <Input placeholder="John Doe" value={bankForm.account_name} onChange={(e) => setBankForm({ ...bankForm, account_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Routing Number</Label>
                <Input placeholder="Optional" value={bankForm.routing_number} onChange={(e) => setBankForm({ ...bankForm, routing_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>SWIFT Code</Label>
                <Input placeholder="Optional" value={bankForm.swift_code} onChange={(e) => setBankForm({ ...bankForm, swift_code: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBankFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={savingBank}>
                {savingBank ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payout Dialog */}
      <Dialog open={showPayout} onOpenChange={setShowPayout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayout} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input type="number" min="1" placeholder="5000" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {balance && <p className="text-xs text-muted-foreground">Balance: ₦{Number(balance.balance).toLocaleString()}</p>}
            </div>
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input placeholder="e.g. GTBank, Access Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input placeholder="0123456789" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input placeholder="John Doe" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPayout(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
