import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Upload, Download, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { postBulkJobs, type BulkJobInput, type BulkJobResult } from '../../lib/api';
import { toast } from 'sonner';

interface JobFormEntry extends BulkJobInput {
  _key: number;
}

const emptyJob = (key: number): JobFormEntry => ({
  _key: key,
  title: '',
  description: '',
  type: 'part-time',
  location: '',
  salary_range: '',
  requirements: '',
});

export default function BulkJobPost() {
  const [jobs, setJobs] = useState<JobFormEntry[]>([emptyJob(0)]);
  const [isPosting, setIsPosting] = useState(false);
  const [results, setResults] = useState<BulkJobResult[] | null>(null);
  const [mode, setMode] = useState<'form' | 'csv'>('form');
  const [csvText, setCsvText] = useState('');

  const updateJob = (key: number, field: keyof BulkJobInput, value: string) => {
    setJobs(prev => prev.map(j => j._key === key ? { ...j, [field]: value } : j));
  };

  const addJob = () => {
    setJobs(prev => [...prev, emptyJob(Math.max(...prev.map(j => j._key), 0) + 1)]);
  };

  const removeJob = (key: number) => {
    setJobs(prev => prev.filter(j => j._key !== key));
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length < 2) {
      toast.error('CSV must have a header row and at least one data row');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const parsed: JobFormEntry[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const entry: Record<string, string> = {};
      headers.forEach((h, idx) => { entry[h] = values[idx] || ''; });

      if (entry.title && entry.description) {
        parsed.push({
          _key: parsed.length,
          title: entry.title,
          description: entry.description,
          type: (entry.type === 'internship' ? 'internship' : 'part-time') as 'part-time' | 'internship',
          location: entry.location || '',
          salary_range: entry.salary_range || entry.salary || '',
          requirements: entry.requirements || '',
        });
      }
    }

    if (parsed.length === 0) {
      toast.error('No valid jobs found in CSV. Check the format.');
      return;
    }

    setJobs(parsed);
    setMode('form');
    toast.success(`Loaded ${parsed.length} job(s) from CSV`);
  };

  const handlePost = async () => {
    const validJobs = jobs.filter(j => j.title && j.description);
    if (validJobs.length === 0) {
      toast.error('Add at least one job with title and description');
      return;
    }

    setIsPosting(true);
    setResults(null);
    try {
      const result = await postBulkJobs(validJobs);
      setResults(result.results);
      if (result.failed === 0) {
        toast.success(`Posted ${result.succeeded} job(s) successfully`);
      } else {
        toast.warning(`${result.succeeded} posted, ${result.failed} failed`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post jobs');
    } finally {
      setIsPosting(false);
    }
  };

  const reset = () => {
    setJobs([emptyJob(0)]);
    setResults(null);
    setCsvText('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Post Jobs</h2>
          <p className="text-sm text-gray-500">Post single or bulk jobs for your organization</p>
        </div>
        <div className="flex gap-2">
          <Button variant={mode === 'form' ? 'default' : 'outline'} size="sm" onClick={() => setMode('form')}>
            Form Entry
          </Button>
          <Button variant={mode === 'csv' ? 'default' : 'outline'} size="sm" onClick={() => setMode('csv')}>
            <Upload className="w-3 h-3 mr-1" />
            CSV Upload
          </Button>
        </div>
      </div>

      {mode === 'csv' ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Paste CSV data with columns: title, description, type, location, salary_range, requirements</p>
              <Button variant="outline" size="sm" onClick={() => {
                const template = 'title,description,type,location,salary_range,requirements\n"Frontend Developer","Build and maintain UI components","part-time","Lagos","₦150k-200k/month","React, TypeScript, CSS"\n"Data Analyst","Analyze business data","internship","Remote","₦80k/month","Excel, SQL, Python"';
                navigator.clipboard.writeText(template);
                toast.success('Template copied to clipboard');
              }}>
                <Download className="w-3 h-3 mr-1" />
                Get Template
              </Button>
            </div>
            <Textarea
              placeholder="Paste CSV here..."
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            <Button onClick={() => parseCSV(csvText)} disabled={!csvText.trim()}>
              Parse & Preview
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job, index) => (
            <Card key={job._key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Job #{index + 1}</CardTitle>
                  {jobs.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeJob(job._key)}>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Title *</Label>
                    <Input value={job.title} onChange={e => updateJob(job._key, 'title', e.target.value)} placeholder="e.g. Frontend Developer" />
                  </div>
                  <div>
                    <Label>Type *</Label>
                    <Select value={job.type} onValueChange={v => updateJob(job._key, 'type', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="part-time">Part-time</SelectItem>
                        <SelectItem value="internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Description *</Label>
                  <Textarea value={job.description} onChange={e => updateJob(job._key, 'description', e.target.value)} placeholder="Job description..." rows={3} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Location</Label>
                    <Input value={job.location || ''} onChange={e => updateJob(job._key, 'location', e.target.value)} placeholder="Lagos, Remote" />
                  </div>
                  <div>
                    <Label>Salary Range</Label>
                    <Input value={job.salary_range || ''} onChange={e => updateJob(job._key, 'salary_range', e.target.value)} placeholder="₦100k-200k/month" />
                  </div>
                  <div>
                    <Label>Requirements</Label>
                    <Input value={job.requirements || ''} onChange={e => updateJob(job._key, 'requirements', e.target.value)} placeholder="Skills needed" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" onClick={addJob} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Another Job
          </Button>
        </div>
      )}

      {/* Results summary */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Post Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {r.success ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <span>{r.success ? (r.job?.title as string || 'Posted') : r.error}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handlePost} disabled={isPosting || jobs.length === 0}>
          {isPosting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Post {jobs.length} Job{jobs.length !== 1 ? 's' : ''}
        </Button>
        <Button variant="outline" onClick={reset}>Reset</Button>
      </div>
    </div>
  );
}
