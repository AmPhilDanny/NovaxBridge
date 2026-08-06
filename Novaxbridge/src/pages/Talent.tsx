import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search, MapPin, Users, UserPlus, UserCheck, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { getConnectionStatus, sendConnectionRequest, acceptConnectionRequest } from '@/lib/marketplace';

type TalentProfile = Database['public']['Tables']['profiles']['Row'];

const AVAILABILITY_LABEL: Record<string, { text: string; className: string }> = {
  open_to_work: { text: 'Open to work', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  open_to_collab: { text: 'Open to collab', className: 'bg-secondary/20 text-secondary' },
  not_available: { text: 'Not available', className: 'bg-muted text-muted-foreground' },
};

export default function Talent() {
  const { user } = useAuth();
  const [people, setPeople] = useState<TalentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState<string | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, string | null>>({});

  useEffect(() => {
    fetchTalent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user && people.length > 0) fetchAllStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, people]);

  const fetchTalent = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPeople(data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error loading talent directory');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllStatuses = async () => {
    if (!user) return;
    const statuses: Record<string, string | null> = {};
    await Promise.all(people.map(async (p) => {
      if (p.id === user.id) return;
      try {
        statuses[p.id] = await getConnectionStatus(p.id);
      } catch { /* ignore */ }
    }));
    setConnectionStatuses(statuses);
  };

  const handleConnection = async (targetId: string, currentStatus: string | null) => {
    if (!user) {
      toast.error('Sign in to connect with talent');
      return;
    }
    try {
      if (currentStatus === 'accepted') {
        const { data: conn } = await supabase
          .from('connections')
          .select('id')
          .or(`and(follower_id.eq.${user.id},following_id.eq.${targetId}),and(follower_id.eq.${targetId},following_id.eq.${user.id})`)
          .maybeSingle();
        if (conn) await supabase.from('connections').delete().eq('id', conn.id);
        setConnectionStatuses((prev) => ({ ...prev, [targetId]: null }));
      } else if (currentStatus === 'pending') {
        await supabase.from('connections').delete().eq('follower_id', user.id).eq('following_id', targetId);
        setConnectionStatuses((prev) => ({ ...prev, [targetId]: null }));
      } else if (currentStatus === 'requested') {
        const { data: conn } = await supabase
          .from('connections')
          .select('id')
          .eq('follower_id', targetId)
          .eq('following_id', user.id)
          .maybeSingle();
        if (conn) {
          await acceptConnectionRequest(conn.id);
          setConnectionStatuses((prev) => ({ ...prev, [targetId]: 'accepted' }));
          toast.success('Connection accepted');
        }
      } else {
        await sendConnectionRequest(targetId);
        setConnectionStatuses((prev) => ({ ...prev, [targetId]: 'pending' }));
        toast.success('Connection request sent');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update connection');
    }
  };

  const allSkills = Array.from(new Set(people.flatMap((p) => p.skills || []))).sort();

  const filtered = people.filter((p) => {
    const matchesSearch =
      !search ||
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.headline?.toLowerCase().includes(search.toLowerCase()) ||
      (p.skills || []).some((s) => s.toLowerCase().includes(search.toLowerCase()));
    const matchesSkill = !skillFilter || (p.skills || []).includes(skillFilter);
    return matchesSearch && matchesSkill;
  });

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-primary mb-2 flex items-center gap-3">
            <Users className="w-8 h-8 text-secondary" />
            Talent Directory
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Discover African tech talent by skill — not just people applying for a job, but people worth
            following, hiring, or building something with.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, headline, or skill..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {allSkills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <Badge
              variant={skillFilter === null ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSkillFilter(null)}
            >
              All skills
            </Badge>
            {allSkills.slice(0, 20).map((skill) => (
              <Badge
                key={skill}
                variant={skillFilter === skill ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSkillFilter(skillFilter === skill ? null : skill)}
              >
                {skill}
              </Badge>
            ))}
          </div>
        )}

        {filtered.length === 0 && isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            <p className="text-muted-foreground">Loading talent...</p>
          </div>
        ) : filtered.length === 0 && !user ? (
          <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Discover African Tech Talent</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Sign in to browse profiles and connect with skilled students and professionals across Africa.
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
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No one matches yet</h3>
            <p className="text-muted-foreground">Try a different search or skill filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((person) => {
              const availability = AVAILABILITY_LABEL[person.availability] || AVAILABILITY_LABEL.open_to_collab;
              const connStatus = connectionStatuses[person.id];
              const isSelf = user?.id === person.id;
              return (
                <Card key={person.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-start gap-4">
                    <Avatar className="w-14 h-14">
                      <AvatarImage src={person.avatar_url || undefined} />
                      <AvatarFallback>{(person.full_name || '?').charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <Link to={`/talent/${person.id}`} className="font-semibold text-primary hover:underline">
                        {person.full_name || 'Unnamed builder'}
                      </Link>
                      <p className="text-sm text-muted-foreground truncate">{person.headline || 'No headline yet'}</p>
                      <Badge className={`mt-2 ${availability.className}`} variant="secondary">
                        {availability.text}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {person.location && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                        <MapPin className="w-3.5 h-3.5" />
                        {person.location}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mb-4 min-h-[24px]">
                      {(person.skills || []).slice(0, 5).map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline" className="flex-1">
                        <Link to={`/talent/${person.id}`}>View profile</Link>
                      </Button>
                      {!isSelf && (
                        <Button
                          size="sm"
                          variant={connStatus === 'accepted' ? 'secondary' : connStatus === 'requested' ? 'default' : 'outline'}
                          onClick={() => handleConnection(person.id, connStatus)}
                          className="gap-1.5"
                        >
                          {connStatus === 'accepted' ? <UserCheck className="w-3.5 h-3.5" /> :
                           connStatus === 'requested' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                           connStatus === 'pending' ? <Clock className="w-3.5 h-3.5" /> :
                           <UserPlus className="w-3.5 h-3.5" />}
                          {connStatus === 'accepted' ? 'Connected' :
                           connStatus === 'requested' ? 'Accept' :
                           connStatus === 'pending' ? 'Sent' :
                           'Connect'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
