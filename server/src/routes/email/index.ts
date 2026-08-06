import { Router, Request, Response } from 'express';
import { adminClient } from '../../lib/supabase-admin.js';
import { AppError } from '../../middleware/error.js';

export const emailRouter: Router = Router();

const TEMPLATES: Record<string, (vars: Record<string, string>) => { subject: string; html: string }> = {
  welcome_email: (v) => ({
    subject: `Welcome to Dala, ${v.name || 'there'}!`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#7c3aed;">Welcome to Dala!</h1>
        <p>Hi ${v.name || 'there'},</p>
        <p>We're excited to have you on board.</p>
        ${v.link ? `<p><a href="${v.link}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;">Get Started</a></p>` : ''}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#6b7280;font-size:14px;">&copy; ${new Date().getFullYear()} Dala. All rights reserved.</p>
      </div>`,
  }),
  job_application: (v) => ({
    subject: `New Application Received — ${v.job_title || 'Job'}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#7c3aed;">New Application</h1>
        <p><strong>${v.applicant_name || 'Someone'}</strong> applied for <strong>${v.job_title || 'your job'}</strong>.</p>
        ${v.link ? `<p><a href="${v.link}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;">Review Application</a></p>` : ''}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#6b7280;font-size:14px;">&copy; ${new Date().getFullYear()} Dala. All rights reserved.</p>
      </div>`,
  }),
  order_confirmation: (v) => ({
    subject: `Order Confirmed — ${v.order_id || ''}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#7c3aed;">Order Confirmed!</h1>
        <p>Your order <strong>${v.order_id || ''}</strong> has been confirmed.</p>
        <p>Amount: <strong>${v.amount || '—'}</strong></p>
        ${v.link ? `<p><a href="${v.link}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;">View Order</a></p>` : ''}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#6b7280;font-size:14px;">&copy; ${new Date().getFullYear()} Dala. All rights reserved.</p>
      </div>`,
  }),
  password_reset: (v) => ({
    subject: 'Reset Your Password',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#7c3aed;">Reset Your Password</h1>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        ${v.link ? `<p><a href="${v.link}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a></p>` : ''}
        <p style="color:#6b7280;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#6b7280;font-size:14px;">&copy; ${new Date().getFullYear()} Dala. All rights reserved.</p>
      </div>`,
  }),
};

function renderTemplate(templateName: string, vars: Record<string, string>): { subject: string; html: string } {
  const renderFn = TEMPLATES[templateName];
  if (renderFn) return renderFn(vars);
  return { subject: vars.subject || '', html: vars.html || '' };
}

// ── POST /email — send email via Resend ──
emailRouter.post('/', async (req: Request, res: Response) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new AppError(500, 'RESEND_API_KEY not configured');

  const { to, subject, html, template_name, cc, bcc, ...rest } = req.body;
  if (!to) throw new AppError(400, 'Missing required field: to');

  let emailSubject = subject;
  let emailHtml = html;

  if (template_name) {
    const rendered = renderTemplate(template_name, { ...rest, subject, html });
    emailSubject = rendered.subject;
    emailHtml = rendered.html;
  }

  if (!emailSubject || !emailHtml) {
    throw new AppError(400, 'Missing subject or html content');
  }

  const resendPayload: Record<string, unknown> = {
    from: 'Dala <noreply@trydala.com>',
    to: Array.isArray(to) ? to : [to],
    subject: emailSubject,
    html: emailHtml,
  };
  if (cc) resendPayload.cc = Array.isArray(cc) ? cc : [cc];
  if (bcc) resendPayload.bcc = Array.isArray(bcc) ? bcc : [bcc];

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(resendPayload),
  });

  const resendData = await resendRes.json();
  if (!resendRes.ok) throw new AppError(502, 'Failed to send email');

  res.json({ success: true, id: resendData.id });
});
