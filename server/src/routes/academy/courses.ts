import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { adminClient } from '../../lib/supabase-admin.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../middleware/error.js';
import { requireAuth } from '../../middleware/auth.js';

export const academyCoursesRouter: Router = Router();

academyCoursesRouter.use(requireAuth);

/**
 * Ensures a "Course" service exists in the services table.
 * Returns the service id.
 */
async function ensureCourseService(): Promise<string> {
  const { data: existing } = await adminClient
    .from('services')
    .select('id')
    .eq('slug', 'course')
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await adminClient
    .from('services')
    .insert({
      name: 'Course',
      slug: 'course',
      description: 'Digital skill academy course',
      category: 'education',
      base_price: 0,
      is_active: true,
    })
    .select()
    .single();

  if (error || !created) throw new AppError(500, 'Failed to create Course service');
  return created.id;
}

// ── POST /academy/courses/:id/publish — publish a course + create marketplace listing ──
academyCoursesRouter.post(
  '/courses/:id/publish',
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) throw new AppError(401, 'Not authenticated');

    const { id } = req.params;

    // Fetch the course
    const { data: course, error: fetchError } = await adminClient
      .from('courses')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !course) throw new AppError(404, 'Course not found');
    if (course.tutor_id !== userId) throw new AppError(403, 'Only the course owner can publish');

    // Validate course has content
    const { data: modules } = await adminClient
      .from('course_modules')
      .select('id, lessons:id(*)')
      .eq('course_id', id);

    const hasLessons = modules?.some((m: any) => (m.lessons?.length || 0) > 0);
    if (!hasLessons) throw new AppError(400, 'Course must have at least one lesson to publish');

    // Get or create Course service
    const serviceId = await ensureCourseService();

    // Create or update marketplace listing
    let listingId = course.listing_id;

    if (listingId) {
      // Update existing listing
      const { error: updateError } = await adminClient
        .from('marketplace_listings')
        .update({
          title: course.title,
          description: course.description || course.title,
          price: course.price,
          status: course.price > 0 ? 'active' : 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', listingId);

      if (updateError) throw new AppError(500, updateError.message);
    } else {
      // Create new listing
      const { data: listing, error: createError } = await adminClient
        .from('marketplace_listings')
        .insert({
          title: course.title,
          description: course.description || course.title,
          price: course.price,
          service_id: serviceId,
          provider_id: course.tutor_id,
          duration_hours: 0, // self-paced, not hourly
          status: course.price > 0 ? 'active' : 'completed',
        })
        .select()
        .single();

      if (createError || !listing) throw new AppError(500, 'Failed to create marketplace listing');
      listingId = listing.id;
    }

    // Update course status + listing_id
    const { error: updateCourseError } = await adminClient
      .from('courses')
      .update({
        status: 'published',
        listing_id: listingId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateCourseError) throw new AppError(500, updateCourseError.message);

    res.json({
      status: 'ok',
      message: 'Course published',
      listing_id: listingId,
    });
  }
);

// ── POST /academy/courses/:id/unpublish — unpublish a course ──
academyCoursesRouter.post(
  '/courses/:id/unpublish',
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) throw new AppError(401, 'Not authenticated');

    const { id } = req.params;

    const { data: course, error: fetchError } = await adminClient
      .from('courses')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !course) throw new AppError(404, 'Course not found');
    if (course.tutor_id !== userId) throw new AppError(403, 'Only the course owner can unpublish');

    // Set course to draft
    await adminClient
      .from('courses')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', id);

    // If there's a listing, set it to paused
    if (course.listing_id) {
      await adminClient
        .from('marketplace_listings')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', course.listing_id);
    }

    res.json({ status: 'ok', message: 'Course unpublished' });
  }
);

// ── GET /academy/courses/:id/enrollments — tutor view of enrollments for their course ──
academyCoursesRouter.get(
  '/courses/:id/enrollments',
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) throw new AppError(401, 'Not authenticated');

    const { id } = req.params;

    // Verify ownership
    const { data: course } = await adminClient
      .from('courses')
      .select('tutor_id')
      .eq('id', id)
      .single();

    if (!course) throw new AppError(404, 'Course not found');
    if (course.tutor_id !== userId) throw new AppError(403, 'Only the course owner can view enrollments');

    const { data, error } = await adminClient
      .from('enrollments')
      .select('*, student:profiles!student_id(id, full_name, email, avatar_url), lesson_completions(id)')
      .eq('course_id', id)
      .order('created_at', { ascending: false });

    if (error) throw new AppError(500, error.message);
    res.json({ data });
  }
);

// ── GET /academy/courses/stats — tutor stats across all their courses ──
academyCoursesRouter.get(
  '/courses/stats',
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    if (!userId) throw new AppError(401, 'Not authenticated');

    // Get all courses by this tutor
    const { data: tutorCourses } = await adminClient
      .from('courses')
      .select('id, title, status, price, currency, created_at')
      .eq('tutor_id', userId)
      .order('created_at', { ascending: false });

    if (!tutorCourses) throw new AppError(500, 'Failed to fetch courses');

    // Get enrollment count per course
    const courseIds = tutorCourses.map((c: any) => c.id);
    let enrollments: any[] = [];
    if (courseIds.length > 0) {
      const { data: enr } = await adminClient
        .from('enrollments')
        .select('course_id, status, created_at')
        .in('course_id', courseIds);
      enrollments = enr || [];
    }

    const totalStudents = enrollments.length;
    const activeStudents = enrollments.filter((e: any) => e.status === 'active').length;
    const completedStudents = enrollments.filter((e: any) => e.status === 'completed').length;
    const publishedCourses = tutorCourses.filter((c: any) => c.status === 'published').length;
    const totalEarnings = tutorCourses
      .filter((c: any) => c.status === 'published')
      .reduce((sum: number, c: any) => sum + Number(c.price) * enrollments.filter((e: any) => e.course_id === c.id).length, 0);

    res.json({
      data: {
        totalCourses: tutorCourses.length,
        publishedCourses,
        totalStudents,
        activeStudents,
        completedStudents,
        totalEarnings,
        currency: tutorCourses[0]?.currency || 'USD',
        courses: tutorCourses,
      },
    });
  }
);
