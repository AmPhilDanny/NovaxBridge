import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, BookOpen, User, Play, FileText, Video, CheckCircle2, Clock, ArrowLeft, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { marketplaceApi } from '@/lib/api-client';

interface Lesson {
  id: string;
  title: string;
  content_type: string;
  content_url: string | null;
  content_body: string | null;
  duration_minutes: number | null;
  position: number;
}

interface Module {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
}

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
  status: string;
  tutor: { id: string; full_name: string | null; avatar_url: string | null } | null;
  course_modules: Module[];
}

export default function CourseDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*, tutor:profiles!tutor_id(id, full_name, avatar_url), course_modules(*, lessons(*))')
        .eq('slug', slug)
        .single();

      if (error) {
        console.error('Course not found:', error);
        setCourse(null);
      } else {
        const c = data as unknown as Course;
        setCourse(c);
        // Sort modules and lessons by position
        c.course_modules?.sort((a, b) => a.position - b.position);
        c.course_modules?.forEach((m) => m.lessons?.sort((a, b) => a.position - b.position));
      }
      setLoading(false);
    })();
  }, [slug]);

  // Check if user is enrolled
  useEffect(() => {
    if (!user || !course) return;
    (async () => {
      const { data } = await supabase
        .from('enrollments')
        .select('status')
        .eq('course_id', course.id)
        .eq('student_id', user.id)
        .maybeSingle();
      if (data) setEnrollmentStatus(data.status);
    })();
  }, [user, course]);

  const handleEnroll = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!course) return;

    setEnrolling(true);
    try {
      if (course.price === 0 || !course.listing_id) {
        const { error } = await supabase.from('enrollments').insert({
          course_id: course.id,
          student_id: user.id,
          status: 'active',
        });
        if (error) throw error;
        setEnrollmentStatus('active');
        toast.success(course.price === 0 ? 'Enrolled! Start learning now.' : 'Enrolled!');
      } else {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://dalastudioshowcase.onrender.com/api'}/marketplace/orders`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listing_id: course.listing_id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create order');

        const order = json.data;
        await supabase.from('enrollments').insert({
          course_id: course.id,
          student_id: user.id,
          order_id: order.id,
          status: 'active',
        });

        setEnrollmentStatus('active');
        toast.success('Enrolled! Proceed to payment.');
        navigate('/orders');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to enroll');
    } finally {
      setEnrolling(false);
    }
  };

  const contentTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Play className="w-4 h-4" />;
      case 'text': return <FileText className="w-4 h-4" />;
      case 'live_session': return <Video className="w-4 h-4" />;
      case 'quiz': return <CheckCircle2 className="w-4 h-4" />;
      case 'assignment': return <BookOpen className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Course Not Found</h1>
        <p className="text-muted-foreground mb-6">The course you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => navigate('/academy')}>Browse Academy</Button>
      </div>
    );
  }

  const isEnrolled = !!enrollmentStatus;
  const modules = course.course_modules || [];
  const totalLessons = modules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Button variant="ghost" onClick={() => navigate('/academy')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Academy
      </Button>

      {/* Hero */}
      <div className="rounded-xl overflow-hidden border mb-8">
        {course.cover_image_url ? (
          <img src={course.cover_image_url} alt={course.title} className="w-full h-56 sm:h-72 object-cover" />
        ) : (
          <div className="w-full h-56 sm:h-72 bg-muted flex items-center justify-center">
            <BookOpen className="w-16 h-16 text-muted-foreground/30" />
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="secondary">{course.category?.replace('_', ' ')}</Badge>
              <Badge className={course.level === 'beginner' ? 'bg-green-100 text-green-700' : course.level === 'intermediate' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
                {course.level}
              </Badge>
              <Badge variant="outline">
                {course.format === 'self_paced' ? 'Self-paced' : course.format === 'live' ? 'Live' : 'Hybrid'}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
            {course.tutor && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>By {course.tutor.full_name || 'Unknown'}</span>
              </div>
            )}
          </div>

          {course.description && (
            <div>
              <h2 className="font-semibold mb-2">About This Course</h2>
              <p className="text-muted-foreground">{course.description}</p>
            </div>
          )}

          <Separator />

          {/* Syllabus */}
          <div>
            <h2 className="font-semibold text-lg mb-4">
              Course Content ({modules.length} modules · {totalLessons} lessons)
            </h2>

            {modules.length === 0 ? (
              <p className="text-muted-foreground text-sm">Course content is being prepared.</p>
            ) : (
              <div className="space-y-3">
                {modules.map((mod, idx) => (
                  <Card key={mod.id}>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-medium">
                        Module {idx + 1}: {mod.title}
                      </CardTitle>
                    </CardHeader>
                    {mod.lessons && mod.lessons.length > 0 && (
                      <CardContent className="pb-3 px-4">
                        <ul className="space-y-1">
                          {mod.lessons.map((lesson) => (
                            <li key={lesson.id} className="flex items-center gap-3 text-sm py-1.5 px-2 rounded hover:bg-muted/50">
                              <span className="text-muted-foreground">{contentTypeIcon(lesson.content_type)}</span>
                              <span className="flex-1">{lesson.title}</span>
                              {lesson.duration_minutes && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                                  <Clock className="w-3 h-3" /> {lesson.duration_minutes}min
                                </span>
                              )}
                              {!isEnrolled && (
                                <Lock className="w-3 h-3 text-muted-foreground/50" />
                              )}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <span className="text-3xl font-bold">
                  {course.price === 0 ? 'Free' : `${course.currency === 'USD' ? '$' : '₦'}${course.price}`}
                </span>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={isEnrolled ? () => navigate(`/academy/learn/${course.id}`) : handleEnroll}
                disabled={enrolling}
              >
                {enrolling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isEnrolled ? 'Continue Learning' : course.price === 0 ? 'Enroll for Free' : 'Enroll Now'}
              </Button>

              <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex justify-between"><span>Modules</span><span>{modules.length}</span></p>
                <p className="flex justify-between"><span>Lessons</span><span>{totalLessons}</span></p>
                <p className="flex justify-between"><span>Level</span><span className="capitalize">{course.level}</span></p>
                <p className="flex justify-between"><span>Format</span><span className="capitalize">{course.format.replace('_', ' ')}</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Tutor info */}
          {course.tutor && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{course.tutor.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">Course Instructor</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
