import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, Check, Building2, CreditCard, ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  changeSubscriptionPlan, submitManualPayment, uploadPaymentProof,
  type SubscriptionPlan,
} from '../../lib/api';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SubscriptionPlan;
  billingCycle: 'monthly' | 'yearly';
  onSuccess: () => void;
}

export default function PaymentDialog({ open, onOpenChange, plan, billingCycle, onSuccess }: PaymentDialogProps) {
  const [step, setStep] = useState<'method' | 'gateway' | 'offline'>('method');
  const [processing, setProcessing] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;

  const handleGateway = async () => {
    setProcessing(true);
    setStep('gateway');
    try {
      await changeSubscriptionPlan(plan.slug, billingCycle);
      toast.success(`Switched to ${plan.name}`);
      onSuccess();
      setTimeout(() => onOpenChange(false), 1200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
      setStep('method');
    } finally {
      setProcessing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }
    setProofFile(file);
    const url = URL.createObjectURL(file);
    setProofPreview(url);
  };

  const handleOfflineSubmit = async () => {
    if (!proofFile) {
      toast.error('Please upload proof of payment');
      return;
    }
    setProcessing(true);
    try {
      const uploadRes = await uploadPaymentProof(proofFile);
      await submitManualPayment({
        plan_id: plan.id,
        amount: price,
        proof_url: uploadRes.data.url,
      });
      toast.success('Payment proof submitted for review');
      onSuccess();
      setTimeout(() => onOpenChange(false), 1200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setStep('method');
    setProofFile(null);
    setProofPreview(null);
    setProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!processing) { reset(); onOpenChange(v); } }}>
      <DialogContent className="sm:max-w-md">
        {step === 'method' && (
          <>
            <DialogHeader>
              <DialogTitle>Upgrade to {plan.name}</DialogTitle>
              <DialogDescription>
                <span className="text-lg font-semibold text-gray-900">₦{price.toLocaleString()}</span>
                <span className="text-sm text-gray-500">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <button
                type="button"
                onClick={handleGateway}
                disabled={processing}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-left group cursor-pointer disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Pay with Card</p>
                  <p className="text-xs text-gray-500">Instant activation via payment gateway</p>
                </div>
                <Check className="w-4 h-4 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                type="button"
                onClick={() => setStep('offline')}
                disabled={processing}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-left group cursor-pointer disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Bank Transfer</p>
                  <p className="text-xs text-gray-500">Pay via bank transfer + upload proof</p>
                </div>
                <Check className="w-4 h-4 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </>
        )}

        {step === 'gateway' && (
          <>
            <DialogHeader>
              <DialogTitle>Processing Payment</DialogTitle>
              <DialogDescription>Connecting to payment gateway...</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
              {!processing && (
                <>
                  <Check className="w-10 h-10 text-green-500" />
                  <p className="text-sm text-gray-600">Plan activated successfully!</p>
                </>
              )}
            </div>
          </>
        )}

        {step === 'offline' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <button type="button" onClick={reset} className="p-1 rounded hover:bg-gray-100 -ml-1">
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <DialogTitle>Bank Transfer</DialogTitle>
              </div>
              <DialogDescription>
                Transfer ₦{price.toLocaleString()} to the account below and upload your receipt
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Bank</span>
                  <span className="font-medium text-gray-900">Access Bank</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Account Name</span>
                  <span className="font-medium text-gray-900">Dala Technologies Ltd</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Account Number</span>
                  <span className="font-medium text-gray-900 font-mono">0123456789</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium text-gray-900">₦{price.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="proof">Upload Proof of Payment</Label>
                <input
                  ref={fileRef}
                  id="proof"
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {!proofFile ? (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mt-1.5 w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors cursor-pointer"
                  >
                    <Upload className="w-6 h-6 text-gray-400" />
                    <p className="text-sm text-gray-500">Click to upload receipt or screenshot</p>
                    <p className="text-xs text-gray-400">PDF, PNG, JPG (max 10MB)</p>
                  </button>
                ) : (
                  <div className="mt-1.5 flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50">
                    {proofPreview && proofFile.type.startsWith('image/') ? (
                      <img src={proofPreview} alt="receipt" className="w-12 h-12 rounded object-cover" />
                    ) : (
                      <FileText className="w-8 h-8 text-green-600" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{proofFile.name}</p>
                      <p className="text-xs text-gray-500">{(proofFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setProofFile(null); setProofPreview(null); }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleOfflineSubmit}
                disabled={!proofFile || processing}
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Submit for Review
              </Button>

              <p className="text-xs text-gray-400 text-center">
                Your plan will be activated once the admin approves your payment
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
