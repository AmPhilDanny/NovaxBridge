import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCall } from '@/hooks/useCall';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarUpload } from '@/components/ui/AvatarUpload';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AIAssistButton } from '@/components/ai/AIAssistButton';
import { SkillInput } from '@/components/talent/SkillInput';
import { toast } from 'sonner';
import {
  Loader2, MapPin, Github, Save, Plus, Trash2, ExternalLink, FolderGit2,
  UserPlus, UserCheck, Briefcase, MessageSquare, CheckCircle2, Clock, Star, TrendingUp, MessageCircle, Video, Pencil,
} from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { getProviderStats, getProviderReviews, formatPrice, ProviderStats, ProviderReview, getConnectionStatus, sendConnectionRequest, acceptConnectionRequest, rejectConnectionRequest } from '@/lib/marketplace';
import AvailabilityCalendar from '@/components/provider/AvailabilityCalendar';
import AvailabilityManager from '@/components/provider/AvailabilityManager';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type PortfolioItem = Database['public']['Tables']['portfolio_items']['Row'];
type ProjectRow = Database['public']['Tables']['projects']['Row'];

const AVAILABILITY_OPTIONS = [
  { value: 'open_to_work', label: 'Open to work' },
  { value: 'open_to_collab', label: 'Open to collab' },
  { value: 'not_available', label: 'Not available' },
];

export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { startCall } = useCall();
  const navigate = useNavigate();
  const targetId = id || user?.id;
  const isOwnProfile = !!user && targetId === user.id;

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [myProjects, setMyProjects] = useState<ProjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [providerStats, setProviderStats] = useState<ProviderStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [providerReviews, setProviderReviews] = useState<ProviderReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'reviews' | 'availability'>('portfolio');
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  const [editProject, setEditProject] = useState<ProjectRow | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', collaboration_type: 'free', project_status: 'beginning', github_url: '', deployment_url: '' });
  const [isSavingProject, setIsSavingProject] = useState(false);

  const [form, setForm] = useState({
    headline: '',
    bio: '',
    country: '',
    city: '',
    address: '',
    github_url: '',
    availability: 'open_to_collab',
    skills: [] as string[],
    avatar_url: null as string | null,
  });

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', description: '', project_url: '', image_url: '', tags: [] as string[] });

  const load = useCallback(async () => {
    if (!targetId) return;
    try {
      const [{ data: p, error: pErr }, { data: items }, { data: memberships }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', targetId).single(),
        supabase.from('portfolio_items').select('*').eq('owner_id', targetId).order('created_at', { ascending: false }),
        supabase.from('project_members').select('project_id, projects(*)').eq('member_id', targetId),
      ]);
      if (pErr) throw pErr;
      setProfile(p);
      setPortfolio(items || []);

      // Load provider stats
      if (targetId) {
        setLoadingStats(true);
        Promise.all([
          getProviderStats(targetId),
          getProviderReviews(targetId),
        ]).then(([stats, reviews]) => {
          setProviderStats(stats);
          setProviderReviews(reviews);
        }).finally(() => setLoadingStats(false));
      }
      const owned = await supabase.from('projects').select('*').eq('owner_id', targetId);
      const memberProjects = (memberships || []).map((m: { projects: ProjectRow | null }) => m.projects).filter(Boolean) as ProjectRow[];
      const combined = [...(owned.data || []), ...memberProjects].filter(
        (proj, i, arr) => arr.findIndex((x) => x.id === proj.id) === i
      );
      setMyProjects(combined);

      if (p) {
        setForm({
          headline: p.headline || '',
          bio: p.bio || '',
          country: p.country || '',
          city: p.city || '',
          address: p.address || '',
          github_url: p.github_url || '',
          availability: p.availability || 'open_to_collab',
          skills: p.skills || [],
          avatar_url: p.avatar_url || null,
        });
      }

      if (user && targetId !== user.id) {
        const status = await getConnectionStatus(targetId);
        setConnectionStatus(status);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error loading profile');
    } finally {
      setIsLoading(false);
    }
  }, [targetId, user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const updates = {
        headline: form.headline,
        bio: form.bio,
        country: form.country,
        city: form.city,
        address: form.address,
        github_url: form.github_url,
        availability: form.availability,
        skills: form.skills,
        avatar_url: form.avatar_url,
      };
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;
      toast.success('Profile updated');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error saving profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user || !targetId) return;
    try {
      const { data: conn } = await supabase
        .from('connections')
        .select('id')
        .or(`and(follower_id.eq.${user.id},following_id.eq.${targetId}),and(follower_id.eq.${targetId},following_id.eq.${user.id})`)
        .maybeSingle();
      if (conn) {
        await supabase.from('connections').delete().eq('id', conn.id);
      }
      setConnectionStatus(null);
      setDisconnectDialogOpen(false);
      toast.success('Disconnected');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not disconnect');
    }
  };

  const handleConnectionClick = () => {
    if (!user || !targetId) return;
    if (connectionStatus === 'accepted') {
      setDisconnectDialogOpen(true);
    } else if (connectionStatus === 'pending') {
      // Cancel pending request
      toggleFollowInner('pending');
    } else if (connectionStatus === 'requested') {
      // Accept incoming request
      toggleFollowInner('requested');
    } else {
      // Send connection request
      toggleFollowInner('connect');
    }
  };

  const toggleFollowInner = async (action: 'pending' | 'requested' | 'connect') => {
    if (!user || !targetId) return;
    try {
      if (action === 'pending') {
        const { data: conn } = await supabase
          .from('connections')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', targetId)
          .maybeSingle();
        if (conn) {
          await supabase.from('connections').delete().eq('id', conn.id);
        }
        setConnectionStatus(null);
      } else if (action === 'requested') {
        const { data: conn } = await supabase
          .from('connections')
          .select('id')
          .eq('follower_id', targetId)
          .eq('following_id', user.id)
          .maybeSingle();
        if (conn) {
          await acceptConnectionRequest(conn.id);
          setConnectionStatus('accepted');
          toast.success('Connection accepted');
        }
      } else {
        await sendConnectionRequest(targetId);
        setConnectionStatus('pending');
        toast.success('Connection request sent');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update connection');
    }
  };

  const openEditProject = (proj: ProjectRow) => {
    setEditForm({
      title: proj.title || '',
      description: proj.description || '',
      collaboration_type: proj.collaboration_type || 'free',
      project_status: proj.project_status || 'beginning',
      github_url: proj.github_url || '',
      deployment_url: proj.deployment_url || '',
    });
    setEditProject(proj);
  };

  const handleSaveProject = async () => {
    if (!editProject || !editForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setIsSavingProject(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          collaboration_type: editForm.collaboration_type,
          project_status: editForm.project_status,
          github_url: editForm.github_url.trim() || null,
          deployment_url: editForm.deployment_url.trim() || null,
        })
        .eq('id', editProject.id);
      if (error) throw error;
      toast.success('Project updated');
      setEditProject(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error saving project');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleAddPortfolioItem = async () => {
    if (!user || !newItem.title.trim()) {
      toast.error('Give your project a title');
      return;
    }
    try {
      const { error } = await supabase.from('portfolio_items').insert({
        owner_id: user.id,
        title: newItem.title,
        description: newItem.description || null,
        project_url: newItem.project_url || null,
        image_url: newItem.image_url || null,
        tags: newItem.tags,
      });
      if (error) throw error;
      toast.success('Added to your portfolio');
      setIsAddingItem(false);
      setNewItem({ title: '', description: '', project_url: '', image_url: '', tags: [] });
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error adding portfolio item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from('portfolio_items').delete().eq('id', itemId);
      if (error) throw error;
      setPortfolio((prev) => prev.filter((p) => p.id !== itemId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error removing item');
    }
  };

  if (!profile && isLoading) {
    return (
      <div className="min-h-screen pt-24 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen pt-24 px-4 text-center">
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl space-y-8">
        {/* Header card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {isOwnProfile ? (
                <AvatarUpload
                  userId={user!.id}
                  currentUrl={profile.avatar_url}
                  onUpload={(url) => {
                    setForm((f) => ({ ...f, avatar_url: url }));
                    setProfile((p) => p ? { ...p, avatar_url: url } : p);
                    supabase.from('profiles').update({ avatar_url: url }).eq('id', user!.id).catch(() => {});
                  }}
                  name={profile.full_name || 'User'}
                />
              ) : (
                <Avatar className="w-20 h-20">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl">
                    {(profile.full_name || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 space-y-3 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h1 className="text-xl sm:text-2xl font-bold text-primary break-words">{profile.full_name || 'Unnamed builder'}</h1>
                      {profile.role && (
                        <Badge variant="outline" className="mt-1 capitalize">
                          {profile.role}
                        </Badge>
                      )}
                    </div>
                    {!isOwnProfile && user && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => startCall(targetId!, profile?.full_name || 'User', profile?.avatar_url || undefined)} className="gap-1.5" title="Start video call">
                          <Video className="w-4 h-4 text-secondary" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/messages?userId=${targetId}`)} className="gap-1.5">
                          <MessageSquare className="w-4 h-4" />
                          Message
                        </Button>
                        <Button size="sm" variant={connectionStatus === 'accepted' ? 'secondary' : connectionStatus === 'requested' ? 'default' : 'outline'} onClick={handleConnectionClick} className="gap-1.5">
                          {connectionStatus === 'accepted' ? <UserCheck className="w-4 h-4" /> :
                           connectionStatus === 'requested' ? <CheckCircle2 className="w-4 h-4" /> :
                           connectionStatus === 'pending' ? <Clock className="w-4 h-4" /> :
                           <UserPlus className="w-4 h-4" />}
                          {connectionStatus === 'accepted' ? 'Connected' :
                           connectionStatus === 'requested' ? 'Accept Request' :
                           connectionStatus === 'pending' ? 'Request Sent' :
                           'Connect'}
                        </Button>
                      </div>
                    )}
                  </div>

                {isOwnProfile ? (
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Headline</Label>
                      <Input
                        value={form.headline}
                        onChange={(e) => setForm({ ...form, headline: e.target.value })}
                        placeholder="e.g. Frontend dev building for African fintech"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Bio</Label>
                      <Textarea
                        value={form.bio}
                        onChange={(e) => setForm({ ...form, bio: e.target.value })}
                        placeholder="Tell people what you build and what you're looking for..."
                        className="min-h-[80px]"
                      />
                      <AIAssistButton
                        mode="cv_revamp"
                        label="Revamp with AI"
                        buildPayload={() => ({ headline: form.headline, bio: form.bio, skills: form.skills })}
                        onAccept={(result) => setForm((f) => ({ ...f, bio: result }))}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label>Country</Label>
                        <Input
                          value={form.country}
                          onChange={(e) => setForm({ ...form, country: e.target.value })}
                          placeholder="e.g. Nigeria"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>City</Label>
                        <Input
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                          placeholder="e.g. Makurdi"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Address</Label>
                        <Input
                          value={form.address}
                          onChange={(e) => setForm({ ...form, address: e.target.value })}
                          placeholder="Street, building"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>GitHub URL</Label>
                        <Input
                          value={form.github_url}
                          onChange={(e) => setForm({ ...form, github_url: e.target.value })}
                          placeholder="https://github.com/you"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Availability</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.availability}
                        onChange={(e) => setForm({ ...form, availability: e.target.value })}
                      >
                        {AVAILABILITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Skills</Label>
                      <SkillInput value={form.skills} onChange={(skills) => setForm({ ...form, skills })} />
                    </div>
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save profile
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {profile.headline && <p className="text-lg text-foreground">{profile.headline}</p>}
                    {profile.bio && <p className="text-muted-foreground">{profile.bio}</p>}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {profile.country && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" /> {[profile.city, profile.country].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {profile.github_url && (
                        <a
                          href={profile.github_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 hover:text-primary"
                        >
                          <Github className="w-4 h-4" /> GitHub
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(profile.skills || []).map((skill) => (
                        <Badge key={skill} variant="outline">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provider stats */}
        {providerStats && providerStats.total_orders > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
                    <Star className="w-5 h-5 fill-amber-500" />
                    <span className="text-2xl font-bold text-foreground">{providerStats.average_rating.toFixed(1)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{providerStats.review_count} review{providerStats.review_count !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-secondary">{providerStats.total_orders}</p>
                  <p className="text-xs text-muted-foreground">Orders completed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{providerStats.completion_rate}%</p>
                  <p className="text-xs text-muted-foreground">Completion rate</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-amber-600">
                    {providerStats.avg_response_hours !== null
                      ? `${providerStats.avg_response_hours}h`
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg. response time</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-primary">{formatPrice(providerStats.total_earned)}</p>
                  <p className="text-xs text-muted-foreground">Total earned</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {loadingStats && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-secondary" />
          </div>
        )}

        {/* Tab switcher */}
        {(isOwnProfile || profile.role === 'student') && (
          <div className="flex items-center gap-1 border-b border-border overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'portfolio'
                  ? 'border-secondary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <FolderGit2 className="w-4 h-4 inline mr-1.5" />
              Portfolio
            </button>
            <button
              onClick={() => setActiveTab('availability')}
              className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'availability'
                  ? 'border-secondary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-1.5" />
              Availability
            </button>
            {providerStats && providerStats.total_orders > 0 && (
              <button
                onClick={() => setActiveTab('reviews')}
                className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'reviews'
                    ? 'border-secondary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageCircle className="w-4 h-4 inline mr-1.5" />
                Reviews ({providerStats.review_count})
              </button>
            )}
          </div>
        )}

        {/* Reviews tab */}
        {activeTab === 'reviews' && providerReviews.length > 0 && (
          <div className="space-y-4">
            {providerReviews.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={r.buyer?.avatar_url || undefined} />
                      <AvatarFallback>{(r.buyer?.full_name || '?').charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm">{r.buyer?.full_name || 'Anonymous'}</span>
                        <span className="text-xs text-muted-foreground">on</span>
                        <span className="text-sm text-secondary font-medium truncate">{r.listing?.title || 'Listing'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500 mb-1">
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-500" />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">{r.review}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {activeTab === 'reviews' && providerReviews.length === 0 && !loadingStats && (
          <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
            <MessageCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">No reviews yet.</p>
          </div>
        )}

        {/* Availability tab */}
        {activeTab === 'availability' && (
          isOwnProfile
            ? <AvailabilityManager providerId={targetId!} />
            : <AvailabilityCalendar providerId={targetId!} />
        )}

        {activeTab !== 'availability' && (
        <>
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-secondary" /> Portfolio
            </h2>
            {isOwnProfile && (
              <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="w-4 h-4" /> Add project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add a portfolio item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="grid gap-2">
                      <Label>Title</Label>
                      <Input
                        value={newItem.title}
                        onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                        placeholder="e.g. Ajo savings tracker"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Textarea
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        placeholder="What it does, your role, the stack..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Link</Label>
                      <Input
                        value={newItem.project_url}
                        onChange={(e) => setNewItem({ ...newItem, project_url: e.target.value })}
                        placeholder="GitHub repo or live demo URL"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Image URL (optional)</Label>
                      <Input
                        value={newItem.image_url}
                        onChange={(e) => setNewItem({ ...newItem, image_url: e.target.value })}
                        placeholder="https://example.com/screenshot.png"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Tags</Label>
                      <SkillInput value={newItem.tags} onChange={(tags) => setNewItem({ ...newItem, tags })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddPortfolioItem}>Add to portfolio</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {portfolio.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
              <p className="text-muted-foreground">
                {isOwnProfile ? 'Add your first project to start showcasing your work.' : 'No portfolio items yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {portfolio.map((item) => (
                <Card key={item.id}>
                  {item.image_url && (
                    <div className="w-full h-40 overflow-hidden rounded-t-lg bg-muted">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      {isOwnProfile && (
                        <button onClick={() => handleDeleteItem(item.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {item.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{item.description}</p>}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(item.tags || []).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    {item.project_url && (
                      <a
                        href={item.project_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-secondary hover:underline flex items-center gap-1"
                      >
                        View project <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Projects */}
        {myProjects.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-primary flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-secondary" /> Projects
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {myProjects.map((proj) => {
                const isOwner = user && proj.owner_id === user.id;
                return (
                  <Card key={proj.id} className="hover:shadow-md transition-shadow h-full flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/projects/${proj.id}`} className="font-semibold text-primary hover:underline text-base">
                          {proj.title}
                        </Link>
                        {isOwnProfile && isOwner && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => { e.preventDefault(); openEditProject(proj); }}
                            className="shrink-0 -mt-1 -mr-1"
                            title="Edit project"
                          >
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{proj.description}</p>
                      <Badge variant="outline" className="mt-2 capitalize w-fit">
                        {proj.status.replace('_', ' ')}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Edit project dialog */}
        <Dialog open={!!editProject} onOpenChange={(open) => { if (!open) setEditProject(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="min-h-[100px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Collaboration</Label>
                  <Select value={editForm.collaboration_type} onValueChange={(v) => setEditForm({ ...editForm, collaboration_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="stipend">Stipend</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={editForm.project_status} onValueChange={(v) => setEditForm({ ...editForm, project_status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginning">Beginning</SelectItem>
                      <SelectItem value="currently_active">Active</SelectItem>
                      <SelectItem value="finished">Finished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-github">GitHub URL</Label>
                <Input
                  id="edit-github"
                  placeholder="https://github.com/..."
                  value={editForm.github_url}
                  onChange={(e) => setEditForm({ ...editForm, github_url: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-deploy">Deployment URL</Label>
                <Input
                  id="edit-deploy"
                  placeholder="https://..."
                  value={editForm.deployment_url}
                  onChange={(e) => setEditForm({ ...editForm, deployment_url: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditProject(null)}>Cancel</Button>
              <Button onClick={handleSaveProject} disabled={isSavingProject}>
                {isSavingProject ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Disconnect confirmation dialog */}
        <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disconnect?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to disconnect from <span className="font-medium text-foreground">{profile?.full_name || 'this user'}</span>? You can send another connection request later.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDisconnectDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </>
      )}
      </div>
    </div>
  );
}
