import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, PlusCircle, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'] as const;

export default function PostJob() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    type: '',
    location: '',
    salary_range: '',
    description: '',
    requirements: '',
  });

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be signed in to post a job');
      return;
    }
    if (!form.title.trim() || !form.type || !form.description.trim()) {
      toast.error('Title, type, and description are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('jobs').insert({
        company_id: user.id,
        title: form.title.trim(),
        type: form.type,
        location: form.location.trim() || null,
        salary_range: form.salary_range.trim() || null,
        description: form.description.trim(),
        requirements: form.requirements.trim() || null,
        is_active: true,
      });

      if (error) throw error;
      toast.success('Job posted successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to post job');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-2xl text-center py-24">
          <PlusCircle className="w-16 h-16 text-secondary mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-3">Post a Job</h1>
          <p className="text-muted-foreground mb-6">Sign in with a firm account to post jobs.</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (profile?.role !== 'firm') {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-2xl text-center py-24">
          <ShoppingBag className="w-16 h-16 text-secondary mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-3">Firm Account Required</h1>
          <p className="text-muted-foreground mb-6">
            Only firm accounts can post jobs. If you're looking for work, browse opportunities on the marketplace or create a gig listing instead.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate('/marketplace')}>
              Browse Marketplace
            </Button>
            <Button onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-2xl">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Post a New Job</CardTitle>
            <CardDescription>
              Fill in the details below to attract top talent from across Africa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Job Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. Senior Frontend Developer"
                  value={form.title}
                  onChange={e => updateField('title', e.target.value)}
                  required
                />
              </div>

              {/* Type + Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">
                    Job Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.type}
                    onValueChange={v => updateField('type', v)}
                    required
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g. Lagos, Nigeria (Remote)"
                    value={form.location}
                    onChange={e => updateField('location', e.target.value)}
                  />
                </div>
              </div>

              {/* Salary */}
              <div className="space-y-2">
                <Label htmlFor="salary">Salary Range</Label>
                <Input
                  id="salary"
                  placeholder="e.g. ₦500,000 - ₦1,000,000/month"
                  value={form.salary_range}
                  onChange={e => updateField('salary_range', e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe the role, responsibilities, and what makes this opportunity great..."
                  rows={5}
                  value={form.description}
                  onChange={e => updateField('description', e.target.value)}
                  required
                />
              </div>

              {/* Requirements */}
              <div className="space-y-2">
                <Label htmlFor="requirements">Requirements</Label>
                <Textarea
                  id="requirements"
                  placeholder="List required skills, experience, and qualifications..."
                  rows={4}
                  value={form.requirements}
                  onChange={e => updateField('requirements', e.target.value)}
                />
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Post Job
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
