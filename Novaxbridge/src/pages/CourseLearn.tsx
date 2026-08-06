import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, BookOpen, Play, FileText, Video, CheckCircle2, Clock, ArrowLeft, Menu as MenuIcon, X, ChevronLeft, ChevronRight, Brain, Code } from 'lucide-react';
import { toast } from 'sonner';

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
  course_modules: Module[];
}

export default function CourseLearn() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [completions, setCompletions] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<string | null>(null);
  const [spawningTutor, setSpawningTutor] = useState(false);

  useEffect(() => {
    if (!user || !courseId) return;

    (async () => {
      setLoading(true);

      // Load course with modules and lessons
      const { data: courseData } = await supabase
        .from('courses')
        .select('*, course_modules(*, lessons(*))')
        .eq('id', courseId)
        .single();

      if (!courseData) {
        toast.error('Course not found');
        navigate('/my-courses');
        return;
      }

      const c = courseData as unknown as Course;
      c.course_modules?.sort((a, b) => a.position - b.position);
      c.course_modules?.forEach((m) => m.lessons?.sort((a, b) => a.position - b.position));
      setCourse(c);

      // Load enrollment
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('*')
        .eq('course_id', courseId)
        .eq('student_id', user.id)
        .maybeSingle();

      if (!enrollmentData) {
        toast.error('You are not enrolled in this course');
        navigate(`/academy/${c.slug}`);
        return;
      }
      setEnrollment(enrollmentData);

      // Load completed lessons
      const { data: completionsData } = await supabase
        .from('lesson_completions')
        .select('lesson_id')
        .eq('enrollment_id', enrollmentData.id);

      if (completionsData) {
        setCompletions(new Set(completionsData.map((c) => c.lesson_id)));
      }

      // Set first lesson as selected
      const firstLesson = c.course_modules?.[0]?.lessons?.[0] || null;
      setSelectedLesson(firstLesson);

      setLoading(false);
    })();
  }, [courseId, user, navigate]);

  const handleComplete = async (lessonId: string) => {
    if (!enrollment || completing) return;

    setCompleting(lessonId);
    try {
      const { error } = await supabase.from('lesson_completions').insert({
        enrollment_id: enrollment.id,
        lesson_id: lessonId,
      });

      if (error) {
        if (error.code === '23505') {
          // Already completed
          setCompletions(new Set([...completions, lessonId]));
        } else {
          throw error;
        }
      } else {
        setCompletions(new Set([...completions, lessonId]));
      }

      // Recalculate progress
      const allLessons = course?.course_modules?.flatMap((m) => m.lessons) || [];
      const completedCount = [...completions, lessonId].size;
      const totalCount = allLessons.length;
      const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      await supabase
        .from('enrollments')
        .update({ progress_percent: progress })
        .eq('id', enrollment.id);

      if (progress >= 100) {
        await supabase
          .from('enrollments')
          .update({ status: 'completed' })
          .eq('id', enrollment.id);
      }

      toast.success('Lesson completed!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark complete');
    } finally {
      setCompleting(null);
    }
  };

  const openAiTutor = async () => {
    if (!user || !course || !selectedLesson) return;
    setSpawningTutor(true);
    try {
      const { data: session, error: sessionError } = await supabase
        .from('tutor_sessions')
        .insert({
          student_id: user.id,
          title: `${course.title} — ${selectedLesson.title}`,
          topic: selectedLesson.title,
          course_id: course.id,
          lesson_id: selectedLesson.id,
          status: 'active',
        })
        .select()
        .single();

      if (sessionError || !session) throw sessionError || new Error('Failed to create session');

      if (selectedLesson.content_body) {
        await supabase.from('knowledge_base').insert({
          owner_id: user.id,
          title: `Lesson: ${selectedLesson.title}`,
          content: selectedLesson.content_body,
          source_type: 'manual',
          tags: [course.id, selectedLesson.id],
        }).maybeSingle();
      }

      navigate(`/tutor/${session.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start AI tutor');
    } finally {
      setSpawningTutor(false);
    }
  };

  const allLessons = course?.course_modules?.flatMap((m) => m.lessons) || [];
  const completionCount = completions.size;
  const progressPercent = allLessons.length > 0 ? Math.round((completionCount / allLessons.length) * 100) : 0;
  const currentIndex = selectedLesson ? allLessons.findIndex((l) => l.id === selectedLesson.id) : -1;

  const navigateLesson = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < allLessons.length) {
      setSelectedLesson(allLessons[newIndex]);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!course || !selectedLesson) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">No Content Yet</h1>
        <p className="text-muted-foreground mb-6">This course doesn't have any lessons yet.</p>
        <Button onClick={() => navigate('/my-courses')}>Back to My Courses</Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className={`border-r bg-background flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}`}>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm truncate">{course.title}</h2>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSidebarOpen(false)}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Progress in sidebar */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {course.course_modules.map((mod, idx) => (
            <div key={mod.id}>
              <p className="text-xs font-medium text-muted-foreground px-2 py-2">
                Module {idx + 1}: {mod.title}
              </p>
              {mod.lessons.map((lesson) => {
                const isSelected = selectedLesson?.id === lesson.id;
                const isCompleted = completions.has(lesson.id);
                return (
                  <button
                    key={lesson.id}
                    onClick={() => setSelectedLesson(lesson)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      isSelected
                        ? 'bg-secondary/10 text-secondary font-medium'
                        : 'hover:bg-muted text-muted-foreground hover:text-primary'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    ) : lesson.content_type === 'video' ? (
                      <Play className="w-3.5 h-3.5 shrink-0" />
                    ) : lesson.content_type === 'text' ? (
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{lesson.title}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t">
          <Link to="/my-courses" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back to My Courses
          </Link>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-2 p-3 border-b">
          {!sidebarOpen && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSidebarOpen(true)}>
              <MenuIcon className="w-4 h-4" />
            </Button>
          )}
          <span className="text-sm font-medium truncate">{selectedLesson.title}</span>
        </div>

        {/* Lesson content */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedLesson.content_type === 'video' && selectedLesson.content_url ? (
            <div className="aspect-video bg-black rounded-lg mb-6 flex items-center justify-center">
              <video
                src={selectedLesson.content_url}
                controls
                className="w-full h-full rounded-lg"
                controlsList="nodownload"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          ) : selectedLesson.content_type === 'text' && selectedLesson.content_body ? (
            <div className="prose prose-sm max-w-none mb-6">
              {selectedLesson.content_body.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          ) : selectedLesson.content_type === 'live_session' ? (
            <div className="text-center py-12">
              <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Live Session</h3>
              <p className="text-sm text-muted-foreground mb-4">This is a live interactive session. Join when it's time.</p>
              <Button variant="default" onClick={() => navigate(`/video-call/${course.id}-${selectedLesson.id}`)} className="gap-2">
                <Video className="w-4 h-4" /> Join Live Session
              </Button>
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Lesson content not available yet.</p>
            </div>
          )}

          {/* AI Tutor */}
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              onClick={openAiTutor}
              disabled={spawningTutor}
              className="gap-2"
            >
              {spawningTutor ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4 text-secondary" />
              )}
              {spawningTutor ? 'Starting...' : 'Ask AI Tutor about this lesson'}
            </Button>
          </div>

          {/* Practice in Playground */}
          <div className="flex justify-center mt-3">
            <Link
              to={`/academy/playground?course_id=${course.id}&lesson_id=${selectedLesson.id}`}
              className="text-xs text-muted-foreground hover:text-secondary flex items-center gap-1.5 transition-colors"
            >
              <Code className="w-3.5 h-3.5" />
              Practice this in the Playground →
            </Link>
          </div>

          {/* Complete button */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex <= 0}
              onClick={() => navigateLesson('prev')}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>

            <Button
              variant={completions.has(selectedLesson.id) ? 'outline' : 'default'}
              size="sm"
              onClick={() => handleComplete(selectedLesson.id)}
              disabled={completing === selectedLesson.id || completions.has(selectedLesson.id)}
              className="gap-1"
            >
              {completing === selectedLesson.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : completions.has(selectedLesson.id) ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {completions.has(selectedLesson.id) ? 'Completed' : 'Mark Complete'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex >= allLessons.length - 1}
              onClick={() => navigateLesson('next')}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
