// ============================================================
// OrgSetup — Multi-step org onboarding wizard / editor
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { createOrg, updateOrg } from '../lib/api';
import { useOrg } from '../hooks/useOrg';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2, Loader2, Check, ArrowRight, ArrowLeft, Users, Sparkles, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { title: 'Company Info', description: 'Tell us about your organization' },
  { title: 'Team', description: 'Set up your team (optional)' },
  { title: 'Launch', description: "You're all set!" },
];

const INDUSTRIES = [
  'Technology', 'Education', 'Healthcare', 'Finance', 'Consulting',
  'Creative / Design', 'Marketing', 'Non-profit', 'E-commerce', 'Other',
];

const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

export default function OrgSetup() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { org, isLoading: orgLoading } = useOrg();
  const isEditing = !!org;
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    industry: '',
    size: '',
    description: '',
    website_url: '',
    country: '',
    city: '',
    address: '',
  });

  // Pre-fill form when editing existing org
  useEffect(() => {
    if (org) {
      setForm({
        name: org.name || '',
        industry: org.industry || '',
        size: org.size || '',
        description: org.description || '',
        website_url: org.website_url || '',
        country: org.country || '',
        city: org.city || '',
        address: org.address || '',
      });
    } else if (profile?.company_name) {
      setForm(prev => ({ ...prev, name: profile.company_name || '' }));
    }
  }, [org, profile]);

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Organization name is required');
      return;
    }

    try {
      setIsSaving(true);
      if (isEditing && org) {
        await updateOrg({
          name: form.name.trim(),
          industry: form.industry || undefined,
          size: form.size || undefined,
          description: form.description || undefined,
          website_url: form.website_url || undefined,
          country: form.country || undefined,
          city: form.city || undefined,
          address: form.address || undefined,
        });
        toast.success('Organization updated successfully!');
      } else {
        await createOrg({
          name: form.name.trim(),
          industry: form.industry || undefined,
          size: form.size || undefined,
          description: form.description || undefined,
          website_url: form.website_url || undefined,
          country: form.country || undefined,
          city: form.city || undefined,
          address: form.address || undefined,
        });
        toast.success('Organization created successfully!');
      }
      navigate('/b2b');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save organization';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return form.name.trim().length > 0;
    return true;
  };

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Edit badge */}
        {isEditing && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
              <Pencil className="w-3 h-3" />
              Editing {org.name}
            </span>
          </div>
        )}

        {/* Steps indicator (only for new orgs) */}
        {!isEditing && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  i <= step
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-12 h-0.5 transition-colors ${
                    i < step ? 'bg-purple-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        )}

        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                {isEditing ? (
                  <Building2 className="w-6 h-6 text-purple-600" />
                ) : step === 0 ? (
                  <Building2 className="w-6 h-6 text-purple-600" />
                ) : step === 1 ? (
                  <Users className="w-6 h-6 text-purple-600" />
                ) : (
                  <Sparkles className="w-6 h-6 text-purple-600" />
                )}
              </div>
            </div>
            <CardTitle className="text-xl">
              {isEditing ? 'Edit Organization' : STEPS[step].title}
            </CardTitle>
            <CardDescription>
              {isEditing ? 'Update your organization details' : STEPS[step].description}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Step 0: Company Info (used for both create and edit) */}
            {(step === 0 || isEditing) && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Organization Name *</Label>
                  <Input
                    id="name"
                    placeholder="Acme Corp"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Select value={form.industry} onValueChange={(v) => updateField('industry', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map(ind => (
                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="size">Company Size</Label>
                  <Select value={form.size} onValueChange={(v) => updateField('size', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZES.map(sz => (
                        <SelectItem key={sz} value={sz}>{sz} employees</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="What does your organization do?"
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    placeholder="https://example.com"
                    value={form.website_url}
                    onChange={(e) => updateField('website_url', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      placeholder="e.g. Nigeria"
                      value={form.country}
                      onChange={(e) => updateField('country', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="e.g. Makurdi"
                      value={form.city}
                      onChange={(e) => updateField('city', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      placeholder="Street, building"
                      value={form.address}
                      onChange={(e) => updateField('address', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Team (creation only) */}
            {!isEditing && step === 1 && (
              <div className="text-center py-6 space-y-4">
                <Users className="w-12 h-12 text-purple-600 mx-auto" />
                <div>
                  <p className="text-sm text-gray-600">
                    You can invite team members after setting up your organization.
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Go to Team settings from the dashboard to send invitations.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Launch (creation only) */}
            {!isEditing && step === 2 && (
              <div className="text-center py-6 space-y-4">
                <Sparkles className="w-12 h-12 text-purple-600 mx-auto" />
                <div>
                  <p className="font-medium text-gray-900">Ready to launch!</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Your organization "{form.name || 'Untitled'}" will be created with the Free plan.
                    You'll need to complete <strong>business verification</strong> to unlock all features.
                    You can upgrade your plan anytime.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-6 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  if (isEditing) navigate('/b2b');
                  else if (step === 0) navigate('/dashboard');
                  else setStep(s => s - 1);
                }}
                disabled={isSaving}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {isEditing ? 'Cancel' : step === 0 ? 'Cancel' : 'Back'}
              </Button>

              {isEditing ? (
                <Button onClick={handleSave} disabled={!canProceed() || isSaving}>
                  {isSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <>Save Changes</>
                  )}
                </Button>
              ) : step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                  ) : (
                    <>Create Organization</>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
