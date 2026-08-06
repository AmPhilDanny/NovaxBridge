import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAcademyConfig } from '@/hooks/useAcademyConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, CheckCircle2, XCircle, ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';

const SUBJECT_OPTIONS = [
  'Web Development', 'Data Science', 'UI/UX Design', 'Mobile Development',
  'Cloud Computing', 'DevOps', 'Cybersecurity', 'Machine Learning',
  'Blockchain', 'Digital Marketing', 'Business', 'Writing',
];

type ApplicationStatus = 'idle' | 'submitting' | 'success' | 'error';

interface ExistingApplication {
  id: string;
  status: string;
  headline: string;
  bio: string;
  subjects: string[];
  created_at: string;
}

export default function TutorApply() {
  const { user } = useAuth();
  const { config: academyConfig, loading: configLoading } = useAcademyConfig();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState<string[]>([]);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [credentials, setCredentials] = useState('');
  const [sampleUrl, setSampleUrl] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('idle');
  const [existingApp, setExistingApp] = useState<ExistingApplication | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    if (!user) {
      setCheckingExisting(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('tutor_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setExistingApp(data as unknown as ExistingApplication);
      setCheckingExisting(false);
    })();
  }, [user]);

  const toggleSubject = (s: string) => {
    setSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error('Please sign in first'); return; }
    if (subjects.length === 0) { toast.error('Select at least one subject'); return; }
    if (!headline.trim()) { toast.error('Enter a headline'); return; }
    if (!bio.trim()) { toast.error('Enter your bio'); return; }

    setStatus('submitting');
    const { error } = await supabase.from('tutor_applications').insert({
      user_id: user.id,
      subjects,
      headline: headline.trim(),
      bio: bio.trim(),
      credentials: credentials.trim() || null,
      sample_lesson_url: sampleUrl.trim() || null,
    });

    if (error) {
      toast.error(error.message);
      setStatus('error');
    } else {
      setStatus('success');
      toast.success('Application submitted! We\'ll review it shortly.');
    }
  };

  if (configLoading || checkingExisting) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-secondary" />
      </div>
    );
  }

  if (!academyConfig.tutor_applications_enabled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <XCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Applications Are Closed</h1>
        <p className="text-muted-foreground mb-6">Tutor applications are not currently being accepted.</p>
        <Button onClick={() => navigate('/academy')}>Browse Academy</Button>
      </div>
    );
  }

  if (existingApp) {
    const isApproved = existingApp.status === 'approved';
    const isPending = existingApp.status === 'pending';
    const isRejected = existingApp.status === 'rejected';

    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Button variant="ghost" onClick={() => navigate('/academy')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Academy
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isApproved ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : isPending ? <Loader2 className="w-5 h-5 animate-spin text-yellow-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
              Application {isApproved ? 'Approved' : isPending ? 'Under Review' : 'Not Approved'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isApproved
                ? 'Congratulations! You can now create courses for the Skill Academy.'
                : isPending
                  ? 'Your application is being reviewed. We\'ll notify you when there\'s an update.'
                  : 'Your application was not approved at this time.'}
            </p>
            <div>
              <Label className="text-xs text-muted-foreground">Headline</Label>
              <p className="text-sm">{existingApp.headline}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Subjects</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {existingApp.subjects.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
            {isApproved && (
              <Button onClick={() => navigate('/academy/create')} className="mt-2">
                Create a Course
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Application Submitted!</h1>
        <p className="text-muted-foreground mb-6">We'll review your application and get back to you.</p>
        <Button onClick={() => navigate('/academy')}>Browse Academy</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Button variant="ghost" onClick={() => navigate('/academy')} className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Academy
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Become a Tutor</CardTitle>
          <p className="text-sm text-muted-foreground">Share your expertise with the SkillBridge community</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Subjects */}
            <div className="space-y-2">
              <Label>Subjects you can teach *</Label>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSubject(s)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      subjects.includes(s)
                        ? 'bg-secondary text-white border-secondary'
                        : 'bg-background hover:border-secondary/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-2">
              <Label htmlFor="headline">Headline *</Label>
              <Input
                id="headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g., Senior Full-Stack Developer with 5+ years experience"
                required
              />
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Bio *</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about your teaching experience and expertise..."
                rows={4}
                required
              />
            </div>

            {/* Credentials */}
            <div className="space-y-2">
              <Label htmlFor="credentials">Credentials (optional)</Label>
              <Textarea
                id="credentials"
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                placeholder="Degrees, certifications, or links to your qualifications"
                rows={3}
              />
            </div>

            {/* Sample lesson URL */}
            <div className="space-y-2">
              <Label htmlFor="sampleUrl">Sample Lesson URL (optional)</Label>
              <Input
                id="sampleUrl"
                value={sampleUrl}
                onChange={(e) => setSampleUrl(e.target.value)}
                placeholder="Link to a demo video or sample lesson"
              />
            </div>

            <Button type="submit" disabled={status === 'submitting'} className="w-full gap-2">
              {status === 'submitting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {status === 'submitting' ? 'Submitting...' : 'Submit Application'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
