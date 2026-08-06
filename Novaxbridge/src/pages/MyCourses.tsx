import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, BookOpen, CheckCircle2, GraduationCap, TrendingUp } from 'lucide-react';

interface Enrollment {
  id: string;
  course_id: string;
  status: string;
  progress_percent: number;
  created_at: string;
  certificate_issued_at: string | null;
  course: {
    id: string;
    title: string;
    slug: string;
    cover_image_url: string | null;
    level: string;
    format: string;
    tutor: { full_name: string | null } | null;
  } | null;
}

export default function MyCourses() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('enrollments')
        .select('*, course:courses(*)')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load enrollments:', error);
      } else {
        setEnrollments((data || []) as unknown as Enrollment[]);
      }
      setLoading(false);
    })();
  }, [user, navigate]);

  const filtered = enrollments.filter((e) =>
    tab === 'active' ? e.status === 'active' : e.status === 'completed'
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-secondary" />
            My Courses
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {enrollments.length} course{enrollments.length !== 1 ? 's' : ''} enrolled
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/academy')}>
          <BookOpen className="w-4 h-4 mr-2" /> Browse Academy
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        <button
          onClick={() => setTab('active')}
          className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            tab === 'active' ? 'border-secondary text-secondary' : 'border-transparent text-muted-foreground hover:text-primary'
          }`}
        >
          Active ({enrollments.filter((e) => e.status === 'active').length})
        </button>
        <button
          onClick={() => setTab('completed')}
          className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            tab === 'completed' ? 'border-secondary text-secondary' : 'border-transparent text-muted-foreground hover:text-primary'
          }`}
        >
          Completed ({enrollments.filter((e) => e.status === 'completed').length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {tab === 'active' ? 'No active courses' : 'No completed courses'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {tab === 'active'
              ? 'Enroll in a course to start learning!'
              : 'Complete a course to see it here.'}
          </p>
          {tab === 'active' && (
            <Button onClick={() => navigate('/academy')}>Browse Academy</Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((enrollment) => {
            const course = enrollment.course;
            if (!course) return null;

            return (
              <Link
                key={enrollment.id}
                to={`/academy/learn/${course.id}`}
                className="block group"
              >
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-muted relative overflow-hidden rounded-t-lg">
                    {course.cover_image_url ? (
                      <img src={course.cover_image_url} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-10 h-10 text-muted-foreground/40" />
                      </div>
                    )}
                    {enrollment.status === 'completed' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <CheckCircle2 className="w-12 h-12 text-green-400" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold line-clamp-1 group-hover:text-secondary transition-colors">
                      {course.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-[10px]">{course.level}</Badge>
                      <span>{course.format === 'self_paced' ? 'Self-paced' : course.format}</span>
                    </div>
                    {/* Progress bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{enrollment.progress_percent}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-secondary rounded-full transition-all"
                          style={{ width: `${enrollment.progress_percent}%` }}
                        />
                      </div>
                    </div>
                    {enrollment.certificate_issued_at && (
                      <Badge variant="outline" className="text-green-600 text-[10px] gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Certificate Issued
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
