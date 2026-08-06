import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAcademyConfig } from '@/hooks/useAcademyConfig';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, BookOpen, Search, GraduationCap, Users, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  level: string;
  cover_image_url: string | null;
  price: number;
  currency: string;
  format: string;
  tutor: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'web_development', label: 'Web Development' },
  { value: 'data_science', label: 'Data Science' },
  { value: 'design', label: 'Design' },
  { value: 'mobile', label: 'Mobile Development' },
  { value: 'cloud', label: 'Cloud Computing' },
  { value: 'devops', label: 'DevOps' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'ai_ml', label: 'AI & Machine Learning' },
  { value: 'business', label: 'Business' },
  { value: 'other', label: 'Other' },
];

export default function Academy() {
  const { user } = useAuth();
  const { config: academyConfig } = useAcademyConfig();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('courses')
        .select('*, tutor:profiles!tutor_id(id, full_name, avatar_url)')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (category !== 'all') {
        query = query.eq('category', category);
      }

      if (search.trim()) {
        query = query.ilike('title', `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCourses((data || []) as unknown as Course[]);
    } catch (err) {
      console.error('Failed to load courses:', err);
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const levelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-green-100 text-green-700';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700';
      case 'advanced': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <GraduationCap className="w-7 h-7 sm:w-8 sm:h-8 text-secondary shrink-0" />
            Skill Academy
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Learn from expert tutors and level up your skills</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {user && academyConfig.tutor_applications_enabled && (
            <Button variant="outline" onClick={() => navigate('/academy/apply')} className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" /> Become a Tutor
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No courses yet</h2>
          <p className="text-muted-foreground mb-6">
            {search || category !== 'all'
              ? 'No courses match your filters. Try a different search.'
              : 'Courses are being created. Check back soon!'}
          </p>
          {(search || category !== 'all') && (
            <Button variant="outline" onClick={() => { setSearch(''); setCategory('all'); }}>
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.id} to={`/academy/${course.slug}`} className="group block">
              <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-video bg-muted relative overflow-hidden">
                  {course.cover_image_url ? (
                    <img
                      src={course.cover_image_url}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-10 h-10 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Badge className={levelColor(course.level)}>
                      {course.level}
                    </Badge>
                    <Badge variant="outline" className="bg-background/80">
                      {course.format === 'self_paced' ? 'Self-paced' : course.format === 'live' ? 'Live' : 'Hybrid'}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-semibold line-clamp-1 group-hover:text-secondary transition-colors">
                    {course.title}
                  </h3>
                  {course.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      <span>{course.tutor?.full_name || 'Unknown'}</span>
                    </div>
                    <span className="font-semibold text-sm">
                      {course.price === 0 ? 'Free' : `${course.currency === 'USD' ? '$' : '₦'}${course.price}`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
