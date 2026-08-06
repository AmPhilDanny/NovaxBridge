import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Check, X, CreditCard, FileText, History, ArrowRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useOrg } from '../../hooks/useOrg';
import { useSubscription } from '../../hooks/useSubscription';
import {
  getBillingPlans, getBillingInvoices, getBillingHistory, changeSubscriptionPlan,
  type SubscriptionPlan, type BillingInvoice, type BillingHistoryEntry,
} from '../../lib/api';
import PaymentDialog from './PaymentDialog';

function CheckFeature({ ok }: { ok: boolean }) {
  return ok
    ? <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
    : <X className="w-4 h-4 text-gray-300 flex-shrink-0" />;
}

export default function SubscriptionManager() {
  const { org, role } = useOrg();
  const { plan: currentPlan, subscription } = useSubscription();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [history, setHistory] = useState<BillingHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [changingPlan, setChangingPlan] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<SubscriptionPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const [plansRes, invRes, histRes] = await Promise.all([
        getBillingPlans(),
        getBillingInvoices(),
        getBillingHistory(),
      ]);
      setPlans(plansRes.data);
      setInvoices(invRes.data);
      setHistory(histRes.data);
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const canChange = role === 'owner' || role === 'admin';

  // Normalize plan.features from either string[] or Record<string, boolean> to string[]
  const planFeaturesList = (p: SubscriptionPlan): string[] => {
    if (Array.isArray(p.features)) return p.features;
    if (p.features && typeof p.features === 'object') return Object.keys(p.features);
    return [];
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div>;
  }

  const allFeatures = Array.from(new Set(plans.flatMap(p => planFeaturesList(p))));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Subscription & Billing</h2>
        <p className="text-sm text-gray-500">
          Current plan: <span className="font-medium text-purple-700">{currentPlan?.name || 'Free'}</span>
          {subscription?.status === 'expired' && <Badge className="ml-2 bg-red-100 text-red-600">Expired</Badge>}
        </p>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans" className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Plans</TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-1"><FileText className="w-3 h-3" /> Invoices ({invoices.length})</TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1"><History className="w-3 h-3" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map(plan => {
              const isCurrent = currentPlan?.id === plan.id || (plan.slug === 'free' && !currentPlan);
              const isFree = plan.slug === 'free';
              return (
                <Card key={plan.id} className={`relative flex flex-col ${isCurrent ? 'ring-2 ring-purple-500 border-purple-500' : ''}`}>
                  {isCurrent && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <Badge className="bg-purple-600 text-white text-xs">Current</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-3xl font-bold text-gray-900">₦{plan.price_monthly?.toLocaleString()}</span>
                      <span className="text-sm text-gray-500 ml-1">/mo</span>
                    </div>
                    {plan.price_yearly > 0 && (
                      <p className="text-xs text-gray-400">₦{plan.price_yearly.toLocaleString()}/yr ({Math.round((1 - plan.price_yearly / (plan.price_monthly * 12)) * 100)}% off)</p>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    {plan.description && <p className="text-xs text-gray-500 mb-4">{plan.description}</p>}
                    <ul className="space-y-2 flex-1">
                      {planFeaturesList(plan).map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckFeature ok={true} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="mt-6 w-full"
                      variant={isCurrent ? 'outline' : isFree ? 'outline' : 'default'}
                      disabled={isCurrent || !canChange}
                      onClick={() => {
                        if (isFree || isCurrent) return;
                        setPaymentPlan(plan);
                      }}
                    >
                      {changingPlan ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      {isCurrent ? 'Current Plan' : isFree ? 'Downgrade' : 'Upgrade'}
                      {!isCurrent && !isFree && <ArrowRight className="w-3 h-3 ml-1" />}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          {invoices.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-gray-400 text-sm">No invoices yet</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {invoices.map(inv => (
                <Card key={inv.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-4 h-4 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{inv.invoice_number}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(inv.period_start).toLocaleDateString()} - {new Date(inv.period_end).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">₦{inv.amount?.toLocaleString()}</p>
                      <Badge className={`text-xs ${
                        inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                        inv.status === 'overdue' ? 'bg-red-100 text-red-600' :
                        inv.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {inv.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {history.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-gray-400 text-sm">No billing history yet</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {history.map(h => (
                <Card key={h.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{h.action.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-400">{new Date(h.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right text-xs">
                      {h.from_plan && <span className="text-gray-400">{h.from_plan.name}</span>}
                      {h.from_plan && h.to_plan && <ArrowRight className="w-3 h-3 inline mx-1 text-gray-300" />}
                      {h.to_plan && <span className="font-medium">{h.to_plan.name}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {paymentPlan && (
        <PaymentDialog
          open={!!paymentPlan}
          onOpenChange={(v) => { if (!v) setPaymentPlan(null); }}
          plan={paymentPlan}
          billingCycle={billingCycle}
          onSuccess={() => { setPaymentPlan(null); fetch(); }}
        />
      )}
    </div>
  );
}
