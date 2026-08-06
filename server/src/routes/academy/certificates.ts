import { Router, Request, Response } from 'express';
import { adminClient } from '../../lib/supabase-admin.js';
import { AppError } from '../../middleware/error.js';
import { requireAuth } from '../../middleware/auth.js';

export const academyCertificatesRouter: Router = Router();

academyCertificatesRouter.use(requireAuth);

// ── POST /academy/certificates/generate — generate a certificate PDF ──
academyCertificatesRouter.post('/certificates/generate', async (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req as any).user?.sub;
  if (!userId) throw new AppError(401, 'Not authenticated');

  const { enrollment_id } = req.body;
  if (!enrollment_id) throw new AppError(400, 'enrollment_id is required');

  // Fetch enrollment with course details
  const { data: enrollment, error: enrError } = await adminClient
    .from('enrollments')
    .select('*, course:courses(*)')
    .eq('id', enrollment_id)
    .single();

  if (enrError || !enrollment) throw new AppError(404, 'Enrollment not found');
  if (enrollment.student_id !== userId) throw new AppError(403, 'Only the enrolled student can get a certificate');

  // Fetch student profile
  const { data: profile } = await adminClient
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  const studentName = profile?.full_name || 'Student';
  const courseTitle = enrollment.course?.title || 'Course';

  // Mark certificate as issued
  const now = new Date().toISOString();
  const { error: updateError } = await adminClient
    .from('enrollments')
    .update({ certificate_issued_at: now, status: 'completed', progress_percent: 100 })
    .eq('id', enrollment_id);

  if (updateError) throw new AppError(500, updateError.message);

  // Generate an HTML certificate (rendered in-browser, no PDF lib needed)
  const certHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Certificate of Completion</title>
  <style>
    body { font-family: 'Georgia', serif; margin: 0; padding: 40px; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .certificate { max-width: 800px; width: 100%; background: white; padding: 60px; border: 8px double #1a1a2e; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
    h1 { font-size: 32px; color: #1a1a2e; margin-bottom: 5px; letter-spacing: 2px; text-transform: uppercase; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 30px; }
    .presented { font-size: 16px; color: #555; margin-bottom: 10px; }
    .name { font-size: 36px; color: #1a1a2e; margin: 15px 0; font-weight: bold; }
    .course-label { font-size: 14px; color: #777; margin-bottom: 5px; }
    .course-name { font-size: 22px; color: #e94560; margin-bottom: 25px; font-weight: bold; }
    .date { font-size: 14px; color: #888; margin-bottom: 30px; }
    .footer { font-size: 12px; color: #aaa; border-top: 1px solid #eee; padding-top: 20px; }
    .seal { font-size: 60px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="seal">&#127891;</div>
    <h1>Certificate of Completion</h1>
    <p class="subtitle">DalaStuduo Skill Academy</p>
    <div style="border-top: 2px solid #1a1a2e; width: 100px; margin: 20px auto;"></div>
    <p class="presented">Presented to</p>
    <p class="name">${escapeHtml(studentName)}</p>
    <p class="course-label">for successfully completing the course</p>
    <p class="course-name">${escapeHtml(courseTitle)}</p>
    <p class="date">Issued on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    <div style="border-top: 2px solid #1a1a2e; width: 100px; margin: 20px auto;"></div>
    <p class="footer">This certificate verifies that the recipient has completed all course requirements.</p>
  </div>
</body>
</html>`;

  // Store the HTML certificate in Supabase storage
  const fileName = `certificates/${enrollment_id}.html`;
  const { error: uploadError } = await adminClient.storage
    .from('site-assets')
    .upload(fileName, certHtml, {
      contentType: 'text/html',
      upsert: true,
    });

  if (uploadError) {
    // If site-assets bucket doesn't exist, return the HTML directly
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(certHtml)}`;
    return res.json({ status: 'ok', url: dataUrl });
  }

  const { data: urlData } = await adminClient.storage
    .from('site-assets')
    .getPublicUrl(fileName);

  res.json({ status: 'ok', url: urlData?.publicUrl || null });
});

function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
