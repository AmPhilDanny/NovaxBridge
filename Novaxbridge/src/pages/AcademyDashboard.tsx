import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, GraduationCap, Users, MessageSquare, Plus, TrendingUp, Clock, ArrowRight, Rocket } from 'lucide-react';
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
  tutor: { id: string; full_name: string | null } | null;
}

export default function AcademyDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [featuredCourses, setFeaturedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ courses: 0, enrolled: 0, tutors: 0 });

  const isTutorOrAdmin = profile?.role && ['tutor', 'admin', 'super_admin'].includes(profile.role);

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch featured/published courses
      const { data: courses, error: coursesErr } = await supabase
        .from('courses')
        .select('id, title, slug, description, category, level, cover_image_url, price, currency, tutor:tutor_id(id, full_name)')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(6);

      if (coursesErr) throw coursesErr;
      setFeaturedCourses((courses || []) as unknown as Course[]);

      // Count total published courses
      const { count: courseCount, error: countErr } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published');
      if (countErr) throw countErr;

      // Count enrollments for the user if logged in, or total
      let enrolledCount = 0;
      if (user) {
        const { count: enrollCount, error: enrollErr } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', user.id);
        if (!enrollErr) enrolledCount = enrollCount || 0;
      }

      // Count unique tutors with published courses
      const { data: tutors, error: tutorsErr } = await supabase
        .from('courses')
        .select('tutor_id')
        .eq('status', 'published');
      if (tutorsErr) throw tutorsErr;
      const uniqueTutors = new Set((tutors || []).map((t: any) => t.tutor_id)).size;

      setStats({
        courses: courseCount || 0,
        enrolled: enrolledCount,
        tutors: uniqueTutors,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error loading academy data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Academy</h1>
        <p className="text-muted-foreground mt-1">Learn new skills, teach others, and grow with our course platform.</p>
      </div>

      {/* Visitor prompt */}
      {!user && (
        <Card className="bg-gradient-to-r from-secondary/5 to-primary/5 border-secondary/20">
          <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
              <Rocket className="w-7 h-7 text-secondary" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-lg font-semibold mb-1">Welcome to the Academy</h2>
              <p className="text-sm text-muted-foreground">Browse courses, track your progress, get AI-powered tutoring, and earn certificates. Sign in to get started.</p>
            </div>
            <Button onClick={() => navigate('/auth')} size="lg" className="shrink-0">
              Sign In to Get Started
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.courses}</p>
              <p className="text-xs text-muted-foreground">Published Courses</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.tutors}</p>
              <p className="text-xs text-muted-foreground">Active Tutors</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.enrolled}</p>
              <p className="text-xs text-muted-foreground">{user ? 'My Enrollments' : 'Total Enrollments'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate('/academy/browse')}>
          <BookOpen className="w-4 h-4 mr-2" /> Browse Courses
        </Button>
        {user && (
          <Button variant="outline" onClick={() => navigate('/my-courses')}>
            <GraduationCap className="w-4 h-4 mr-2" /> My Courses
          </Button>
        )}
        <Button variant="outline" onClick={() => navigate('/academy/ai-tutor')}>
          <MessageSquare className="w-4 h-4 mr-2" /> AI Tutor
        </Button>
        {isTutorOrAdmin && (
          <Button variant="outline" onClick={() => navigate('/academy/create')}>
            <Plus className="w-4 h-4 mr-2" /> Create Course
          </Button>
        )}
      </div>

      {/* Featured courses */}
      {featuredCourses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-secondary" /> Featured Courses
            </h2>
            <Link to="/academy/browse" className="text-sm text-secondary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredCourses.map((course) => (
              <Link key={course.id} to={`/academy/${course.slug}`}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                  {course.cover_image_url && (
                    <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                      <img
                        src={course.cover_image_url}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardContent className="p-4 space-y-2">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {course.category?.replace('_', ' ')}
                    </Badge>
                    <h3 className="font-semibold line-clamp-2">{course.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-muted-foreground">
                        {course.tutor?.full_name || 'Unknown'}
                      </span>
                      <span className="font-bold text-sm">
                        {course.price > 0 ? `${course.currency || 'USD'} ${course.price}` : 'Free'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && featuredCourses.length === 0 && (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-lg">No courses yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The academy is ready but no courses have been published yet. Check back soon or apply to become a tutor.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" onClick={() => navigate('/academy/apply')}>
                Apply as Tutor
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
