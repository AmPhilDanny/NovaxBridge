import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Building2, ShieldCheck, ShieldX, Clock, Upload, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { getVerification, submitVerification, uploadVerificationDocument } from '@/b2b/lib/api';
import { useOrg } from '@/b2b/hooks/useOrg';
import type { OrgVerification as OrgVerificationType } from '@/b2b/lib/api';

export default function OrgVerification() {
  const { user } = useAuth();
  const { org, role, isLoading: orgLoading } = useOrg();
  const navigate = useNavigate();

  const [verification, setVerification] = useState<OrgVerificationType | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);

  const isAdmin = role === 'owner' || role === 'admin';

  useEffect(() => {
    if (!user) return;
    fetchVerification();
  }, [user]);

  const fetchVerification = async () => {
    try {
      setLoading(true);
      const res = await getVerification();
      setVerification(res.data);
      if (res.data) {
        setBusinessName(res.data.business_name || '');
        setRegistrationNumber(res.data.registration_number || '');
        setTaxId(res.data.tax_id || '');
        setDocumentUrls(res.data.document_urls || []);
      }
    } catch {
      // No verification exists yet
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (documentFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of documentFiles) {
        const res = await uploadVerificationDocument(file);
        uploaded.push(res.data.url);
      }
      setDocumentUrls(prev => [...prev, ...uploaded]);
      setDocumentFiles([]);
      toast.success(`${uploaded.length} document(s) uploaded`);
    } catch (err: any) {
      toast.error(err.userMessage || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (index: number) => {
    setDocumentUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      toast.error('Business name is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitVerification({
        business_name: businessName.trim(),
        registration_number: registrationNumber.trim() || undefined,
        tax_id: taxId.trim() || undefined,
        document_urls: documentUrls,
      });
      setVerification(res.data);
      toast.success('Verification request submitted');
    } catch (err: any) {
      toast.error(err.userMessage || 'Failed to submit verification');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-6xl text-center py-24">
          <Building2 className="w-16 h-16 text-secondary mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-3">Organization Verification</h1>
          <p className="text-muted-foreground mb-6">Sign in to manage your organization verification.</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (orgLoading || loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-6xl text-center py-24">
          <Building2 className="w-16 h-16 text-secondary mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-3">No Organization Found</h1>
          <p className="text-muted-foreground mb-6">You need to be part of an organization to access verification.</p>
          <Button onClick={() => navigate('/b2b/setup')}>Create Organization</Button>
        </div>
      </div>
    );
  }

  const status = verification?.status || 'not_submitted';

  const statusConfig: Record<string, { label: string; icon: any; variant: 'default' | 'secondary' | 'outline' | 'destructive'; color: string }> = {
    not_submitted: { label: 'Not Submitted', icon: AlertCircle, variant: 'outline', color: 'text-muted-foreground' },
    pending: { label: 'Pending Review', icon: Clock, variant: 'secondary', color: 'text-yellow-600 dark:text-yellow-400' },
    verified: { label: 'Verified', icon: CheckCircle2, variant: 'default', color: 'text-green-600 dark:text-green-400' },
    rejected: { label: 'Rejected', icon: ShieldX, variant: 'destructive', color: 'text-red-600 dark:text-red-400' },
  };

  const StatusIcon = statusConfig[status]?.icon || AlertCircle;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-1">
              Organization Verification
            </h1>
            <p className="text-muted-foreground">
              Verify your organization to unlock all platform features
            </p>
          </div>
          <Badge variant={statusConfig[status]?.variant || 'outline'} className={`text-sm px-4 py-2 gap-2 ${statusConfig[status]?.color || ''}`}>
            <StatusIcon className="w-4 h-4" />
            {statusConfig[status]?.label || 'Unknown'}
          </Badge>
        </div>

        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-secondary" />
                Verification Status
              </CardTitle>
              <CardDescription>
                {status === 'verified' && 'Your organization is verified. You have full access to all platform features.'}
                {status === 'pending' && 'Your verification request is being reviewed by our team. This usually takes 1-2 business days.'}
                {status === 'rejected' && `Your verification was not approved.${verification?.notes ? ` Reason: ${verification.notes}` : ''} Please update and resubmit.`}
                {status === 'not_submitted' && 'Submit your business information and documents to get verified.'}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Verified — show success info */}
          {status === 'verified' && (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Verification Approved</h2>
                <p className="text-muted-foreground mb-6">
                  Your organization <strong>{org.name}</strong> has been verified successfully.
                </p>
                <Button onClick={() => navigate('/b2b')}>
                  Go to Dashboard
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Pending — show waiting message */}
          {status === 'pending' && (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Clock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Under Review</h2>
                <p className="text-muted-foreground mb-2">
                  Your verification is being processed by our team.
                </p>
                {verification?.business_name && (
                  <p className="text-sm text-muted-foreground">
                    Business: {verification.business_name}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Not Submitted or Rejected — show form */}
          {(status === 'not_submitted' || status === 'rejected') && isAdmin && (
            <form onSubmit={handleSubmit}>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-secondary" />
                    Business Information
                  </CardTitle>
                  <CardDescription>
                    Provide your business details for verification
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input
                      id="businessName"
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                      placeholder="Your registered business name"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="registrationNumber">Registration Number</Label>
                      <Input
                        id="registrationNumber"
                        value={registrationNumber}
                        onChange={e => setRegistrationNumber(e.target.value)}
                        placeholder="e.g. RC1234567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxId">Tax ID</Label>
                      <Input
                        id="taxId"
                        value={taxId}
                        onChange={e => setTaxId(e.target.value)}
                        placeholder="e.g. VAT/TIN number"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Document Upload */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-secondary" />
                    Supporting Documents
                  </CardTitle>
                  <CardDescription>
                    Upload business registration certificate, tax documents, or other supporting files
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={e => setDocumentFiles(Array.from(e.target.files || []))}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleFileUpload}
                      disabled={uploading || documentFiles.length === 0}
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Upload
                    </Button>
                  </div>

                  {documentUrls.length > 0 && (
                    <div className="space-y-2">
                      <Label>Uploaded Documents</Label>
                      <div className="space-y-2">
                        {documentUrls.map((url, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="w-4 h-4 text-secondary shrink-0" />
                              <span className="text-sm truncate">
                                {url.split('/').pop()?.replace(/^\d+-/, '') || `Document ${i + 1}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-secondary hover:underline"
                              >
                                View
                              </a>
                              <button
                                type="button"
                                onClick={() => removeDocument(i)}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Submit */}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/b2b')}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !businessName.trim()}>
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 mr-2" />
                  )}
                  Submit Verification Request
                </Button>
              </div>
            </form>
          )}

          {/* Not admin and not verified */}
          {!isAdmin && (status === 'not_submitted' || status === 'rejected') && (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>
                <p className="text-muted-foreground">
                  Only organization owners and admins can submit verification requests.
                  Please contact your organization administrator.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
