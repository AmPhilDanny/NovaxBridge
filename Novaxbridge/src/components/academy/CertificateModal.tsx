import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, CheckCircle2, Award } from 'lucide-react';
import { toast } from 'sonner';

interface CertificateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle: string;
  studentName: string;
  enrollmentId: string;
}

export default function CertificateModal({ open, onOpenChange, courseTitle, studentName, enrollmentId }: CertificateModalProps) {
  const [generating, setGenerating] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'https://dalastudioshowcase.onrender.com/api';
      const res = await fetch(`${apiBase}/academy/certificates/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollment_id: enrollmentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate certificate');
      setCertificateUrl(json.url);
      toast.success('Certificate generated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate certificate');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-secondary" />
            Course Certificate
          </DialogTitle>
          <DialogDescription>
            Congratulations on completing <strong>{courseTitle}</strong>!
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-6 space-y-4">
          {certificateUrl ? (
            <>
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Your certificate is ready for <strong>{studentName}</strong>
              </p>
              <a href={certificateUrl} target="_blank" rel="noopener noreferrer" download>
                <Button className="gap-2">
                  <Download className="w-4 h-4" /> Download Certificate
                </Button>
              </a>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center">
                <Award className="w-10 h-10 text-secondary" />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Generate your official certificate of completion for <strong>{courseTitle}</strong>.
              </p>
              <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                {generating ? 'Generating...' : 'Generate Certificate'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
