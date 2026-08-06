import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, BookOpen, Users, TrendingUp, Plus, GraduationCap,
  DollarSign, BarChart3, ExternalLink, Edit, Eye, CheckCircle2, Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface TutorStats {
  totalCourses: number;
  publishedCourses: number;
  totalStudents: number;
  activeStudents: number;
  completedStudents: number;
  totalEarnings: number;
  currency: string;
  courses: any[];
}

interface Enrollment {
  id: string;
  course_id: string;
  status: string;
  progress_percent: number;
  created_at: string;
  student: { id: string; full_name: string | null; email: string | null; avatar_url: string | null } | null;
}

export default function MyTutorProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<TutorStats | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    loadStats();
  }, [user, navigate]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'https://dalastudioshowcase.onrender.com/api';
      const res = await fetch(`${apiBase}/academy/courses/stats`, { credentials: 'include' });
      const json = await res.json();
      if (json.data) setStats(json.data);
    } catch {
      // Fallback: load from supabase directly
      const { data: courses } = await supabase
        .from('courses')
        .select('*')
        .eq('tutor_id', user?.id);

      if (courses) {
        setStats({
          totalCourses: courses.length,
          publishedCourses: courses.filter((c: any) => c.status === 'published').length,
          totalStudents: 0,
          activeStudents: 0,
          completedStudents: 0,
          totalEarnings: 0,
          currency: 'USD',
          courses,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadEnrollments = async (courseId: string) => {
    setSelectedCourse(courseId);
    setLoadingEnrollments(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'https://dalastudioshowcase.onrender.com/api';
      const res = await fetch(`${apiBase}/academy/courses/${courseId}/enrollments`, { credentials: 'include' });
      const json = await res.json();
      if (json.data) setEnrollments(json.data);
      else setEnrollments([]);
    } catch {
      setEnrollments([]);
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'pending_review': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  const courses = stats?.courses || [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-secondary" />
            Tutor Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your courses, track students, and view earnings</p>
        </div>
        <Button onClick={() => navigate('/academy/create')} className="gap-1.5">
          <Plus className="w-4 h-4" /> Create Course
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Courses</p>
              <p className="text-xl font-bold">{stats?.totalCourses || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Published</p>
              <p className="text-xl font-bold">{stats?.publishedCourses || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Students</p>
              <p className="text-xl font-bold">{stats?.totalStudents || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <DollarSign className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Earnings</p>
              <p className="text-xl font-bold">{stats?.currency === 'USD' ? '$' : '₦'}{stats?.totalEarnings || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Course List + Enrollment Detail */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Courses */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-secondary" />
            Your Courses
          </h2>

          {courses.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">You haven't created any courses yet.</p>
                <Button onClick={() => navigate('/academy/create')}>
                  <Plus className="w-4 h-4 mr-2" /> Create Your First Course
                </Button>
              </CardContent>
            </Card>
          ) : (
            courses.map((course: any) => (
              <Card
                key={course.id}
                className={`cursor-pointer transition-colors hover:border-secondary/50 ${selectedCourse === course.id ? 'border-secondary' : ''}`}
                onClick={() => loadEnrollments(course.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm">{course.title}</h3>
                        <Badge className={statusColor(course.status)}>{course.status.replace('_', ' ')}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {course.category?.replace('_', ' ')} &middot; {course.level}
                        {course.price > 0 ? ` · ${course.currency === 'USD' ? '$' : '₦'}${course.price}` : ' · Free'}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); navigate(`/academy/${course.slug}`); }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); navigate(`/academy/create?edit=${course.id}`); }}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Enrollments */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-secondary" />
            {selectedCourse ? 'Enrolled Students' : 'Select a Course'}
          </h2>

          {!selectedCourse ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Click a course to see enrolled students</p>
              </CardContent>
            </Card>
          ) : loadingEnrollments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-secondary" />
            </div>
          ) : enrollments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No students enrolled yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {enrollments.map((enr) => (
                <Card key={enr.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{enr.student?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground truncate">{enr.student?.email || ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium">{enr.progress_percent}%</p>
                      <div className="w-16 h-1 bg-muted rounded-full mt-0.5">
                        <div className="h-full bg-secondary rounded-full" style={{ width: `${enr.progress_percent}%` }} />
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{enr.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
