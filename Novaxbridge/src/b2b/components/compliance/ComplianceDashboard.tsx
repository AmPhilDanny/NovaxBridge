import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Shield, CheckCircle2, XCircle, Clock, FileText, Plus, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  getVerification, submitVerification, reviewVerification,
  getComplianceReports, generateComplianceReport,
  type OrgVerification, type ComplianceReport,
} from '../../lib/api';
import { VERIFICATION_STATUS_CONFIG } from '../../lib/constants';

const STATUS_ICONS: Record<string, any> = {
  not_submitted: AlertTriangle,
  pending: Clock,
  verified: CheckCircle2,
  rejected: XCircle,
};

export default function ComplianceDashboard() {
  const [verification, setVerification] = useState<OrgVerification | null>(null);
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Submit form
  const [bizName, setBizName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [docUrls, setDocUrls] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const [verResult, reportsResult] = await Promise.all([
        getVerification(),
        getComplianceReports(),
      ]);
      setVerification(verResult.data);
      setReports(reportsResult.data);
    } catch {
      // handled silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSubmit = async () => {
    if (!bizName.trim() || !regNumber.trim()) return;
    setIsSubmitting(true);
    try {
      const urls = docUrls.trim() ? docUrls.split('\n').map(s => s.trim()).filter(Boolean) : [];
      const result = await submitVerification({
        business_name: bizName.trim(),
        registration_number: regNumber.trim(),
        tax_id: taxId.trim() || undefined,
        document_urls: urls.length > 0 ? urls : undefined,
      });
      setVerification(result.data);
      setShowSubmit(false);
      toast.success('Verification submitted');
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setBizName('');
    setRegNumber('');
    setTaxId('');
    setDocUrls('');
  };

  const handleReview = async (status: 'verified' | 'rejected') => {
    if (!verification) return;
    try {
      const result = await reviewVerification(verification.id, status, reviewNotes || undefined);
      setVerification(result.data);
      setShowReview(false);
      setReviewNotes('');
      toast.success(`Verification ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to review');
    }
  };

  const handleGenerate = async (type: string) => {
    setIsGenerating(true);
    try {
      const result = await generateComplianceReport(type);
      setReports(prev => [result.data, ...prev]);
      toast.success('Report generated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div>;
  }

  const statusKey = verification?.status || 'not_submitted';
  const statusCfg = VERIFICATION_STATUS_CONFIG[statusKey];
  const StatusIcon = STATUS_ICONS[statusKey];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Compliance & Verification</h2>
          <p className="text-sm text-gray-500">Organization verification and compliance reports</p>
        </div>
      </div>

      <Tabs defaultValue="verification">
        <TabsList>
          <TabsTrigger value="verification" className="flex items-center gap-1"><Shield className="w-3 h-3" /> Verification</TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-1"><FileText className="w-3 h-3" /> Reports ({reports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="verification" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-8 h-8 text-purple-600" />
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Business Verification</h3>
                    <p className="text-sm text-gray-500">Verify your organization to unlock all features</p>
                  </div>
                </div>
                <Badge className={`${statusCfg.color} flex items-center gap-1 px-3 py-1`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusCfg.label}
                </Badge>
              </div>

              {verification?.status === 'verified' && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                  Your organization is verified. All features are available.
                </div>
              )}

              {verification?.status === 'rejected' && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 space-y-1">
                  <p className="font-medium">Verification rejected</p>
                  {verification.notes && <p>{verification.notes}</p>}
                </div>
              )}

              {verification?.status === 'pending' && (
                <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
                  Your verification is under review. We'll notify you once it's approved.
                </div>
              )}

              {(verification?.status === 'not_submitted' || verification?.status === 'rejected') && (
                <Dialog open={showSubmit} onOpenChange={setShowSubmit}>
                  <DialogTrigger asChild>
                    <Button className="mt-3"><Plus className="w-4 h-4 mr-1" /> Submit Verification</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Submit Verification</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-2">
                      <div>
                        <Label>Business Name *</Label>
                        <Input value={bizName} onChange={e => setBizName(e.target.value)} placeholder="Legal business name" />
                      </div>
                      <div>
                        <Label>Registration Number *</Label>
                        <Input value={regNumber} onChange={e => setRegNumber(e.target.value)} placeholder="CAC/RC number" />
                      </div>
                      <div>
                        <Label>Tax ID</Label>
                        <Input value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="TIN" />
                      </div>
                      <div>
                        <Label>Document URLs (one per line)</Label>
                        <Textarea value={docUrls} onChange={e => setDocUrls(e.target.value)} placeholder="https://..." rows={3} />
                      </div>
                      <Button onClick={handleSubmit} disabled={!bizName.trim() || !regNumber.trim() || isSubmitting} className="w-full">
                        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Submit for Review
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {verification?.status === 'verified' && verification && (
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-400">Business:</span> <span className="font-medium ml-1">{verification.business_name}</span></div>
                  <div><span className="text-gray-400">Reg #:</span> <span className="font-medium ml-1">{verification.registration_number}</span></div>
                </div>
              )}

              {(verification?.status === 'pending' || verification?.status === 'verified') && (
                <Dialog open={showReview} onOpenChange={setShowReview}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="mt-3">Review</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Review Verification</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-2">
                      <div>
                        <Label>Notes</Label>
                        <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3} />
                      </div>
                      <div className="flex gap-2">
                        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleReview('verified')}>
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => handleReview('rejected')}>
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2">
            {['verification', 'contracts', 'activity', 'custom'].map(type => (
              <Button key={type} size="sm" variant="outline" onClick={() => handleGenerate(type)} disabled={isGenerating}>
                <Plus className="w-3 h-3 mr-1" />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>

          {reports.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-gray-400 text-sm">No reports generated yet</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {reports.map(r => (
                <Card key={r.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-900">{r.title || r.report_type}</span>
                        <Badge className="text-xs bg-gray-100">{r.report_type}</Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{new Date(r.generated_at).toLocaleString()}</p>
                    </div>
                    <Button size="sm" variant="ghost">
                      <Download className="w-3 h-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
