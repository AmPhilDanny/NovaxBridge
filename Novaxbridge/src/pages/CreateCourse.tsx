import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { marketplaceApi } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Plus, BookOpen, Edit, Trash2, ChevronUp, ChevronDown,
  ArrowLeft, Save, Send, FileText, Video, Play, Globe, X, CheckCircle2,
  HelpCircle, Camera
} from 'lucide-react';
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
  status: string;
  created_at: string;
}

interface Module {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  content_type: string;
  content_url: string | null;
  content_body: string | null;
  duration_minutes: number | null;
  position: number;
}

const CATEGORIES = [
  { value: 'web_development', label: 'Web Development' },
  { value: 'data_science', label: 'Data Science' },
  { value: 'design', label: 'UI/UX Design' },
  { value: 'mobile', label: 'Mobile Development' },
  { value: 'cloud', label: 'Cloud Computing' },
  { value: 'devops', label: 'DevOps' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'ai_ml', label: 'AI & Machine Learning' },
  { value: 'blockchain', label: 'Blockchain' },
  { value: 'business', label: 'Business' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'writing', label: 'Writing' },
  { value: 'other', label: 'Other' },
];

const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'NGN', label: 'NGN (₦)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
];

const FORMATS = [
  { value: 'self_paced', label: 'Self-paced' },
  { value: 'live', label: 'Live' },
  { value: 'hybrid', label: 'Hybrid' },
];

const CONTENT_TYPES = [
  { value: 'video', label: 'Video', icon: Video },
  { value: 'text', label: 'Text', icon: FileText },
  { value: 'live_session', label: 'Live Session', icon: Play },
  { value: 'quiz', label: 'Quiz', icon: HelpCircle },
  { value: 'assignment', label: 'Assignment', icon: Edit },
];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export default function CreateCourse() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // View state: 'list' or 'editor'
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Course form state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('web_development');
  const [level, setLevel] = useState('beginner');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [format, setFormat] = useState('self_paced');

  // Modules & lessons state
  const [modules, setModules] = useState<Module[]>([]);

  // Saving state
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Slug auto-generated flag
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Load tutor's courses
  const fetchCourses = async () => {
    if (!user) return;
    setLoadingCourses(true);
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load courses:', error);
      toast.error('Failed to load courses');
    } else {
      setCourses((data || []) as Course[]);
    }
    setLoadingCourses(false);
  };

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    fetchCourses();
  }, [user, navigate]);

  // Load course data for editing
  const loadCourseForEdit = async (courseId: string) => {
    setSaving(true);
    try {
      // Load course
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError || !courseData) {
        toast.error('Course not found');
        return;
      }

      const course = courseData as Course;
      setTitle(course.title);
      setSlug(course.slug);
      setDescription(course.description || '');
      setCategory(course.category);
      setLevel(course.level);
      setCoverImageUrl(course.cover_image_url || '');
      setPrice(course.price);
      setCurrency(course.currency);
      setFormat(course.format);
      setSlugManuallyEdited(true);

      // Load modules with lessons
      const { data: modulesData, error: modulesError } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', courseId)
        .order('position', { ascending: true });

      if (modulesError) throw modulesError;

      const loadedModules: Module[] = [];
      for (const mod of (modulesData || [])) {
        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('*')
          .eq('module_id', mod.id)
          .order('position', { ascending: true });

        loadedModules.push({
          ...mod,
          lessons: (lessonsData || []) as Lesson[],
        });
      }

      setModules(loadedModules);
      setEditingCourseId(courseId);
      setView('editor');
    } catch (err) {
      console.error('Failed to load course:', err);
      toast.error('Failed to load course data');
    } finally {
      setSaving(false);
    }
  };

  // Reset editor to create new course
  const startNewCourse = () => {
    setEditingCourseId(null);
    setTitle('');
    setSlug('');
    setDescription('');
    setCategory('web_development');
    setLevel('beginner');
    setCoverImageUrl('');
    setPrice(0);
    setCurrency('USD');
    setFormat('self_paced');
    setModules([]);
    setSlugManuallyEdited(false);
    setView('editor');
  };

  const cancelEdit = () => {
    setView('list');
    setEditingCourseId(null);
  };

  // Handle title change with auto-slug
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugManuallyEdited) {
      setSlug(generateSlug(val));
    }
  };

  // ── Module operations ──
  const addModule = () => {
    const newModule: Module = {
      id: `temp_${Date.now()}`,
      title: '',
      position: modules.length,
      lessons: [],
    };
    // Use prompt to get module title
    const modTitle = prompt('Module title:');
    if (!modTitle || !modTitle.trim()) return;
    newModule.title = modTitle.trim();
    setModules([...modules, newModule]);
  };

  const updateModuleTitle = (moduleId: string, title: string) => {
    setModules(modules.map((m) => m.id === moduleId ? { ...m, title } : m));
  };

  const removeModule = (moduleId: string) => {
    if (!confirm('Delete this module and all its lessons?')) return;
    setModules(modules.filter((m) => m.id !== moduleId).map((m, i) => ({ ...m, position: i })));
  };

  const moveModule = (index: number, direction: 'up' | 'down') => {
    const newModules = [...modules];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newModules.length) return;
    [newModules[index], newModules[target]] = [newModules[target], newModules[index]];
    setModules(newModules.map((m, i) => ({ ...m, position: i })));
  };

  // ── Lesson operations ──
  const addLesson = (moduleId: string) => {
    // Open lesson editor modal/prompt
    const title = prompt('Lesson title:');
    if (!title || !title.trim()) return;

    const moduleIndex = modules.findIndex((m) => m.id === moduleId);
    if (moduleIndex === -1) return;

    const newLesson: Lesson = {
      id: `temp_${Date.now()}`,
      title: title.trim(),
      content_type: 'video',
      content_url: null,
      content_body: null,
      duration_minutes: 10,
      position: modules[moduleIndex].lessons.length,
    };

    const updatedModules = [...modules];
    updatedModules[moduleIndex] = {
      ...updatedModules[moduleIndex],
      lessons: [...updatedModules[moduleIndex].lessons, newLesson],
    };
    setModules(updatedModules);
  };

  const updateLesson = (moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
    setModules(modules.map((m) => {
      if (m.id !== moduleId) return m;
      return {
        ...m,
        lessons: m.lessons.map((l) => l.id === lessonId ? { ...l, ...updates } : l),
      };
    }));
  };

  const removeLesson = (moduleId: string, lessonId: string) => {
    if (!confirm('Delete this lesson?')) return;
    setModules(modules.map((m) => {
      if (m.id !== moduleId) return m;
      return {
        ...m,
        lessons: m.lessons.filter((l) => l.id !== lessonId).map((l, i) => ({ ...l, position: i })),
      };
    }));
  };

  const moveLesson = (moduleId: string, lessonIndex: number, direction: 'up' | 'down') => {
    setModules(modules.map((m) => {
      if (m.id !== moduleId) return m;
      const lessons = [...m.lessons];
      const target = direction === 'up' ? lessonIndex - 1 : lessonIndex + 1;
      if (target < 0 || target >= lessons.length) return m;
      [lessons[lessonIndex], lessons[target]] = [lessons[target], lessons[lessonIndex]];
      return { ...m, lessons: lessons.map((l, i) => ({ ...l, position: i })) };
    }));
  };

  // ── Save / Publish ──
  const saveCourse = async (status: string = 'draft') => {
    if (!user) return;
    if (!title.trim()) { toast.error('Course title is required'); return; }
    if (!slug.trim()) { toast.error('Course slug is required'); return; }

    if (status === 'pending_review') {
      const hasContent = modules.some((m) => m.lessons.length > 0);
      if (!hasContent) { toast.error('Add at least one module with a lesson before submitting for review'); return; }
    }

    setSaving(true);
    try {
      let courseId = editingCourseId;

      const coursePayload = {
        tutor_id: user.id,
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        category,
        level,
        cover_image_url: coverImageUrl.trim() || null,
        price,
        currency,
        format,
        status,
        updated_at: new Date().toISOString(),
      };

      if (editingCourseId) {
        // Update existing
        const { error: updateError } = await supabase
          .from('courses')
          .update(coursePayload)
          .eq('id', editingCourseId);

        if (updateError) throw updateError;
      } else {
        // Insert new
        const { data: newCourse, error: insertError } = await supabase
          .from('courses')
          .insert({ ...coursePayload, created_at: new Date().toISOString() })
          .select()
          .single();

        if (insertError) throw insertError;
        courseId = newCourse.id;
      }

      // Save modules and lessons
      if (courseId) {
        // Get existing modules to know what to delete
        const { data: existingModules } = await supabase
          .from('course_modules')
          .select('id')
          .eq('course_id', courseId);

        const existingModuleIds = new Set((existingModules || []).map((m) => m.id));
        const keptModuleIds = new Set(modules.filter((m) => !m.id.startsWith('temp_')).map((m) => m.id));

        // Delete removed modules
        for (const existingId of existingModuleIds) {
          if (!keptModuleIds.has(existingId)) {
            await supabase.from('course_modules').delete().eq('id', existingId);
          }
        }

        // Upsert modules
        for (const mod of modules) {
          const isNew = mod.id.startsWith('temp_');
          const modPayload = { course_id: courseId, title: mod.title, position: mod.position };

          let savedModuleId: string;
          if (isNew) {
            const { data: newMod } = await supabase
              .from('course_modules')
              .insert({ ...modPayload, created_at: new Date().toISOString() })
              .select()
              .single();
            savedModuleId = newMod?.id;
          } else {
            await supabase
              .from('course_modules')
              .update({ ...modPayload, updated_at: new Date().toISOString() })
              .eq('id', mod.id);
            savedModuleId = mod.id;
          }

          // Handle lessons for this module
          if (savedModuleId) {
            const { data: existingLessons } = await supabase
              .from('lessons')
              .select('id')
              .eq('module_id', savedModuleId);

            const existingLessonIds = new Set((existingLessons || []).map((l) => l.id));
            const keptLessonIds = new Set(
              mod.lessons.filter((l) => !l.id.startsWith('temp_')).map((l) => l.id)
            );

            // Delete removed lessons
            for (const existingId of existingLessonIds) {
              if (!keptLessonIds.has(existingId)) {
                await supabase.from('lessons').delete().eq('id', existingId);
              }
            }

            // Upsert lessons
            for (const lesson of mod.lessons) {
              const isNewLesson = lesson.id.startsWith('temp_');
              const lessonPayload = {
                module_id: savedModuleId,
                title: lesson.title,
                content_type: lesson.content_type,
                content_url: lesson.content_url || null,
                content_body: lesson.content_body || null,
                duration_minutes: lesson.duration_minutes,
                position: lesson.position,
              };

              if (isNewLesson) {
                await supabase
                  .from('lessons')
                  .insert({ ...lessonPayload, created_at: new Date().toISOString() });
              } else {
                await supabase
                  .from('lessons')
                  .update({ ...lessonPayload, updated_at: new Date().toISOString() })
                  .eq('id', lesson.id);
              }
            }
          }
        }
      }

      toast.success(status === 'published' ? 'Course published!' : `Course saved as ${status.replace('_', ' ')}`);
      setView('list');
      setEditingCourseId(null);
      fetchCourses();
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error(err.message || 'Failed to save course');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete course ──
  const deleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course? This cannot be undone.')) return;
    setDeleting(courseId);
    try {
      const { error } = await supabase.from('courses').delete().eq('id', courseId);
      if (error) throw error;
      toast.success('Course deleted');
      setCourses(courses.filter((c) => c.id !== courseId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete course');
    } finally {
      setDeleting(null);
    }
  };

  // ── Toggle publish status ──
  const togglePublish = async (course: Course) => {
    const goingLive = course.status !== 'published';
    if (goingLive) {
      const { data: mods } = await supabase
        .from('course_modules')
        .select('id, lessons:id(*)')
        .eq('course_id', course.id);

      const hasLessons = mods?.some((m: any) => (m.lessons?.length || 0) > 0);
      if (!hasLessons) { toast.error('Add at least one lesson before publishing'); return; }
    }

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'https://dalastudioshowcase.onrender.com/api';

      if (goingLive) {
        const res = await fetch(`${apiBase}/academy/courses/${course.id}/publish`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to publish');
        toast.success('Course published and listed on marketplace!');
      } else {
        const res = await fetch(`${apiBase}/academy/courses/${course.id}/unpublish`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to unpublish');
        toast.success('Course unpublished');
      }
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update course');
    }
  };

  // ── Status badge color ──
  const statusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'pending_review': return 'bg-yellow-100 text-yellow-700';
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const contentTypeIcon = (type: string) => {
    const ct = CONTENT_TYPES.find((c) => c.value === type);
    if (!ct) return FileText;
    return ct.icon;
  };

  // ============= RENDER =============
  if (!user) return null;

  // ── LOADING ──
  if (view === 'list' && loadingCourses) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  // ═══════════════════════════════════════
  // COURSE LIST VIEW
  // ═══════════════════════════════════════
  if (view === 'list') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-secondary" />
              My Courses
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {courses.length} course{courses.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/academy')} className="gap-1.5">
              <Globe className="w-4 h-4" /> Browse
            </Button>
            <Button onClick={startNewCourse} className="gap-1.5">
              <Plus className="w-4 h-4" /> Create Course
            </Button>
          </div>
        </div>

        {courses.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No courses yet</h2>
            <p className="text-muted-foreground mb-6">Create your first course and start teaching!</p>
            <Button onClick={startNewCourse}>
              <Plus className="w-4 h-4 mr-2" /> Create Course
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((course) => (
              <Card key={course.id} className="overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  {course.cover_image_url ? (
                    <div className="sm:w-48 h-32 shrink-0">
                      <img src={course.cover_image_url} alt={course.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="sm:w-48 h-32 shrink-0 bg-muted flex items-center justify-center">
                      <Camera className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold">{course.title}</h3>
                        <Badge className={statusColor(course.status)}>{course.status.replace('_', ' ')}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {course.category.replace('_', ' ')} &middot; {course.level} &middot;
                        {course.price === 0 ? ' Free' : ` ${course.currency === 'USD' ? '$' : '₦'}${course.price}`}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => loadCourseForEdit(course.id)}>
                        <Edit className="w-3 h-3" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={course.status === 'published' ? 'outline' : 'default'}
                        className="gap-1"
                        onClick={() => togglePublish(course)}
                      >
                        <Globe className="w-3 h-3" />
                        {course.status === 'published' ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => deleteCourse(course.id)}
                        disabled={deleting === course.id}
                      >
                        {deleting === course.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════
  // COURSE EDITOR VIEW
  // ═══════════════════════════════════════
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={cancelEdit} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h1 className="text-xl font-bold">
            {editingCourseId ? 'Edit Course' : 'Create Course'}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => saveCourse('draft')} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </Button>
          <Button onClick={() => saveCourse('pending_review')} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit for Review
          </Button>
        </div>
      </div>

      {/* Course Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Course Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Advanced React Patterns"
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugManuallyEdited(true); }}
                placeholder="course-slug"
              />
              <p className="text-xs text-muted-foreground">URL: /academy/{slug || '...'}</p>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what students will learn..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger id="level">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price (0 = free)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger id="format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cover">Cover Image URL</Label>
              <Input
                id="cover"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Curriculum Builder */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Curriculum</CardTitle>
          <Button size="sm" variant="outline" onClick={addModule} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Module
          </Button>
        </CardHeader>
        <CardContent>
          {modules.length === 0 ? (
            <div className="text-center py-10">
              <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No modules yet. Add your first module to start building your course.</p>
              <Button variant="outline" size="sm" onClick={addModule} className="mt-4 gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Module
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((mod, modIndex) => (
                <div key={mod.id} className="border rounded-lg">
                  {/* Module header */}
                  <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-t-lg">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveModule(modIndex, 'up')} disabled={modIndex === 0}
                        className="text-muted-foreground hover:text-primary disabled:opacity-30">
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => moveModule(modIndex, 'down')} disabled={modIndex === modules.length - 1}
                        className="text-muted-foreground hover:text-primary disabled:opacity-30">
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      value={mod.title}
                      onChange={(e) => updateModuleTitle(mod.id, e.target.value)}
                      className="flex-1 bg-transparent font-medium text-sm border-none outline-none focus:ring-0"
                      placeholder="Module title"
                    />
                    <span className="text-xs text-muted-foreground">{mod.lessons.length} lesson{mod.lessons.length !== 1 ? 's' : ''}</span>
                    <button onClick={() => removeModule(mod.id)} className="text-muted-foreground hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Lessons */}
                  <div className="p-3 space-y-2">
                    {mod.lessons.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">No lessons yet</p>
                    ) : (
                      mod.lessons.map((lesson, lessonIndex) => {
                        const TypeIcon = contentTypeIcon(lesson.content_type);
                        return (
                          <div key={lesson.id} className="flex items-center gap-2 p-2 border rounded-md text-sm">
                            <div className="flex flex-col gap-0.5">
                              <button onClick={() => moveLesson(mod.id, lessonIndex, 'up')} disabled={lessonIndex === 0}
                                className="text-muted-foreground hover:text-primary disabled:opacity-30">
                                <ChevronUp className="w-2.5 h-2.5" />
                              </button>
                              <button onClick={() => moveLesson(mod.id, lessonIndex, 'down')} disabled={lessonIndex === mod.lessons.length - 1}
                                className="text-muted-foreground hover:text-primary disabled:opacity-30">
                                <ChevronDown className="w-2.5 h-2.5" />
                              </button>
                            </div>
                            <TypeIcon className="w-3.5 h-3.5 text-secondary shrink-0" />
                            <span className="flex-1 truncate">{lesson.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {lesson.content_type}
                              {lesson.duration_minutes ? ` · ${lesson.duration_minutes}min` : ''}
                            </span>
                            <button onClick={() => {
                              // Simple inline edit: just prompt for each field
                              const newTitle = prompt('Lesson title:', lesson.title);
                              if (newTitle) updateLesson(mod.id, lesson.id, { title: newTitle.trim() });
                            }} className="text-muted-foreground hover:text-primary">
                              <Edit className="w-3 h-3" />
                            </button>
                            <button onClick={() => {
                              const types = ['video', 'text', 'live_session', 'quiz', 'assignment'];
                              const current = types.indexOf(lesson.content_type);
                              const next = types[(current + 1) % types.length];
                              updateLesson(mod.id, lesson.id, { content_type: next });
                            }} className="text-muted-foreground hover:text-primary" title="Toggle content type">
                              <X className="w-3 h-3" />
                            </button>
                            <button onClick={() => {
                              const dur = prompt('Duration (minutes):', String(lesson.duration_minutes || ''));
                              if (dur !== null) updateLesson(mod.id, lesson.id, { duration_minutes: Number(dur) || null });
                            }} className="text-muted-foreground hover:text-primary">
                              <Plus className="w-3 h-3" />
                            </button>
                            <button onClick={() => removeLesson(mod.id, lesson.id)} className="text-muted-foreground hover:text-red-500">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })
                    )}
                    <Button size="sm" variant="ghost" onClick={() => addLesson(mod.id)} className="w-full gap-1 text-xs text-muted-foreground">
                      <Plus className="w-3 h-3" /> Add Lesson
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom save actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={cancelEdit} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Cancel
        </Button>
        <Button variant="outline" onClick={() => saveCourse('draft')} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Draft
        </Button>
        <Button onClick={() => saveCourse('pending_review')} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit for Review
        </Button>
      </div>
    </div>
  );
}
