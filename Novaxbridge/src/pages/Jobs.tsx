import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { jobsApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Briefcase, MapPin, DollarSign, Calendar, Plus, Search, Loader2, Building2 } from 'lucide-react';

interface JobProfile {
  full_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
}

interface Job {
  id: string;
  title: string;
  description: string;
  type: string;
  location: string | null;
  salary_range: string | null;
  requirements: string | null;
  is_active: boolean;
  company_id: string;
  created_at: string;
  profiles: JobProfile | null;
}

export default function Jobs() {
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Post Job State
  const [isPosting, setIsPosting] = useState(false);
  const [newJob, setNewJob] = useState({
    title: '',
    description: '',
    type: 'part-time',
    location: '',
    salary_range: '',
    requirements: '',
  });

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const fetchJobs = async () => {
    try {
      const params = filterType !== 'all' ? { type: filterType } : undefined;
      const res = await jobsApi.list(params);
      setJobs(res.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error fetching jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsPosting(true);

    try {
      await jobsApi.create({
        ...newJob,
        type: newJob.type as 'part-time' | 'internship',
      });
      toast.success('Job posted successfully!');
      fetchJobs();
      setNewJob({
        title: '',
        description: '',
        type: 'part-time',
        location: '',
        salary_range: '',
        requirements: '',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error posting job');
    } finally {
      setIsPosting(false);
    }
  };

  const handleApply = async (jobId: string) => {
    if (!user) {
      toast.error('Please sign in to apply');
      return;
    }
    if (profile?.role !== 'student') {
      toast.error('Only students can apply for jobs');
      return;
    }

    try {
      await jobsApi.apply(jobId);
      toast.success('Application submitted successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error submitting application');
    }
  };

  const filteredJobs = jobs.filter((job) =>
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold text-primary mb-2">Work Marketplace</h1>
            <p className="text-muted-foreground">Find the best tech opportunities across Africa.</p>
          </div>

          {profile?.role === 'firm' && (
            <Dialog>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Post a Job
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Post a New Opportunity</DialogTitle>
                  <DialogDescription>
                    Fill in the details for your part-time work or internship listing.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handlePostJob} className="space-y-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Job Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Junior Web Developer"
                      value={newJob.title}
                      onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="type">Type</Label>
                      <select
                        id="type"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={newJob.type}
                        onChange={(e) => setNewJob({ ...newJob, type: e.target.value })}
                        required
                      >
                        <option value="part-time">Part-time</option>
                        <option value="internship">Internship</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        placeholder="e.g. Remote, Lagos"
                        value={newJob.location}
                        onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="salary">Salary Range / Stipend</Label>
                    <Input
                      id="salary"
                      placeholder="e.g. $500 - $800"
                      value={newJob.salary_range}
                      onChange={(e) => setNewJob({ ...newJob, salary_range: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the role and responsibilities..."
                      className="min-h-[100px]"
                      value={newJob.description}
                      onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="requirements">Requirements</Label>
                    <Textarea
                      id="requirements"
                      placeholder="List key requirements..."
                      value={newJob.requirements}
                      onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isPosting}>
                      {isPosting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Post Job Listing
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs by title or keyword..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filterType === 'all' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
            >
              All
            </Button>
            <Button
              variant={filterType === 'part-time' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFilterType('part-time')}
            >
              Part-time
            </Button>
            <Button
              variant={filterType === 'internship' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFilterType('internship')}
            >
              Internships
            </Button>
          </div>
        </div>

        {filteredJobs.length === 0 && isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            <p className="text-muted-foreground">Loading opportunities...</p>
          </div>
        ) : filteredJobs.length === 0 && !user ? (
          <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Find Work Opportunities</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Sign in to browse part-time work and internships from firms across Africa.
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/auth">Create Account</Link>
              </Button>
            </div>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No jobs found</h3>
            <p className="text-muted-foreground">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map((job) => (
              <Card key={job.id} className="flex flex-col hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start mb-4">
                    <Badge variant={job.type === 'part-time' ? 'secondary' : 'outline'}>
                      {job.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(job.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-xl mb-1">{job.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {job.profiles?.company_name || job.profiles?.full_name || 'Anonymous Firm'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-6">
                    {job.description}
                  </p>
                  <div className="space-y-2">
                    {job.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </div>
                    )}
                    {job.salary_range && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="w-4 h-4" />
                        {job.salary_range}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={profile?.role === 'student' ? 'default' : 'outline'}
                    onClick={() => handleApply(job.id)}
                    disabled={profile?.role === 'firm'}
                  >
                    {profile?.role === 'firm' ? 'Viewing as Firm' : 'Apply Now'}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
