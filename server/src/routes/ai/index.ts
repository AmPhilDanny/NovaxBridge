import { Router, Request, Response } from 'express';
import { adminClient } from '../../lib/supabase-admin.js';
import { AppError } from '../../middleware/error.js';
import { requireAuth } from '../../middleware/auth.js';

export const aiRouter: Router = Router();

// ── Provider Configuration ──
type AiProvider = 'openrouter' | 'mistral' | 'openai' | 'groq' | 'google' | 'togetherai';

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  label: string;
}

const ACTIVE_PROVIDER = (process.env.AI_PROVIDER || 'openrouter') as AiProvider;

const PROVIDER_KEY_MAP: Record<AiProvider, { primary: string; fallback: string }> = {
  openrouter: { primary: 'OPENROUTER_API_KEY', fallback: 'AI_OPENROUTER_KEY' },
  mistral: { primary: 'MISTRAL_API_KEY', fallback: 'AI_MISTRAL_KEY' },
  openai: { primary: 'OPENAI_API_KEY', fallback: 'AI_OPENAI_KEY' },
  groq: { primary: 'GROQ_API_KEY', fallback: 'AI_GROQ_KEY' },
  google: { primary: 'GOOGLE_API_KEY', fallback: 'AI_GOOGLE_KEY' },
  togetherai: { primary: 'TOGETHER_API_KEY', fallback: 'AI_TOGETHERAI_KEY' },
};

function resolveEnvKey(provider: AiProvider): string {
  const { primary, fallback } = PROVIDER_KEY_MAP[provider];
  return process.env[primary] || process.env[fallback] || '';
}

async function getProviders(): Promise<Record<AiProvider, ProviderConfig>> {
  const [dbKeys, dbModels] = await Promise.all([loadDbApiKeys(), loadDbModels()]);
  const modelFor = (provider: string, envKey: string, fallback: string) =>
    dbModels[provider] || process.env[envKey] || fallback;
  return {
    openrouter: {
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: dbKeys['openrouter'] || resolveEnvKey('openrouter'),
      defaultModel: modelFor('openrouter', 'OPENROUTER_MODEL', 'google/gemini-2.0-flash-001'),
      label: 'OpenRouter',
    },
    mistral: {
      baseUrl: 'https://api.mistral.ai/v1',
      apiKey: dbKeys['mistral'] || resolveEnvKey('mistral'),
      defaultModel: modelFor('mistral', 'MISTRAL_MODEL', 'mistral-large-latest'),
      label: 'Mistral AI',
    },
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: dbKeys['openai'] || resolveEnvKey('openai'),
      defaultModel: modelFor('openai', 'OPENAI_MODEL', 'gpt-4o-mini'),
      label: 'OpenAI',
    },
    groq: {
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: dbKeys['groq'] || resolveEnvKey('groq'),
      defaultModel: modelFor('groq', 'GROQ_MODEL', 'llama-3.3-70b-versatile'),
      label: 'Groq',
    },
    google: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: dbKeys['google'] || resolveEnvKey('google'),
      defaultModel: modelFor('google', 'GOOGLE_MODEL', 'gemini-2.0-flash'),
      label: 'Google Gemini',
    },
    togetherai: {
      baseUrl: 'https://api.together.xyz/v1',
      apiKey: dbKeys['togetherai'] || resolveEnvKey('togetherai'),
      defaultModel: modelFor('togetherai', 'TOGETHER_MODEL', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'),
      label: 'Together AI',
    },
  };
}

type Mode = 'cv_revamp' | 'cover_letter' | 'skill_gap' | 'project_polish' | 'tutor_chat' | 'tutor_reflect' | 'tutor_quiz' | 'tutor_grade' | 'admin_metric_insight' | 'admin_user_summary' | 'admin_service_description' | 'admin_generate_page';

interface RequestBody {
  mode: Mode;
  bio?: string;
  headline?: string;
  skills?: string[];
  jobTitle?: string;
  jobDescription?: string;
  applicantSummary?: string;
  currentSkills?: string[];
  targetSkills?: string[];
  targetTitle?: string;
  rawDescription?: string;
  topic?: string;
  knowledgeContent?: string;
  messages?: Array<{ role: string; content: string }>;
  studentStrengths?: string[];
  studentWeaknesses?: string[];
  questions?: Array<{ question: string; options: string[]; correctIndex: number }>;
  answers?: number[];
  title?: string;
  description?: string;
}

function buildPrompt(body: RequestBody): string {
  switch (body.mode) {
    case 'cv_revamp':
      return `You are a career coach helping an African tech professional present themselves well.
Rewrite the following into a punchy, confident, ONE-paragraph professional headline+bio (max 60 words). Keep it factual and specific.
Current headline: ${body.headline || '(none)'}
Current bio: ${body.bio || '(none)'}
Listed skills: ${(body.skills || []).join(', ') || '(none)'}
Return ONLY the rewritten bio text, nothing else.`;
    case 'cover_letter':
      return `Write a concise application message (120-180 words) connecting the candidate's background to this role.
Job title: ${body.jobTitle || '(untitled)'}
Job description: ${body.jobDescription || '(none)'}
Candidate summary: ${body.applicantSummary || '(none)'}
Return ONLY the message text.`;
    case 'skill_gap':
      return `Compare current skills against target requirements. Return as:
"Already strong in:" (2-4 bullets)
"Worth learning next:" (2-4 bullets)
Current skills: ${(body.currentSkills || []).join(', ') || '(none)'}
Target: ${(body.targetSkills || []).join(', ') || body.targetTitle || '(not specified)'}
Keep under 120 words. Return ONLY the text.`;
    case 'project_polish':
      return `Rewrite this project description (80-140 words) clearly stating what's being built, who it's for, and what collaborator is needed.
Draft: ${body.rawDescription || '(none)'}
Return ONLY the rewritten description.`;
    case 'admin_metric_insight':
      return `Write a brief insight (2-4 sentences) on these platform metrics.
Total users: ${body.bio || '0'}
Total orders: ${body.jobTitle || '0'}
Completed: ${body.jobDescription || '0'}
Revenue: ${body.applicantSummary || '0'}
Return ONLY the commentary.`;
    case 'admin_user_summary':
      return `Summarize this user in 2-3 sentences.
Name: ${body.bio || 'Unknown'}
Role: ${body.jobTitle || 'Unknown'}
Headline: ${body.jobDescription || 'N/A'}
Skills: ${(body.currentSkills || []).join(', ') || 'None'}
Return ONLY the summary.`;
    case 'admin_service_description':
      return `Write a compelling description (40-80 words) for this service.
Service: ${body.bio || 'Unknown'}
Category: ${body.jobTitle || 'General'}
Return ONLY the description.`;
    case 'admin_generate_page':
      return `You are a content writer for SkillBridge Africa, a platform connecting African tech talent with opportunities.
Generate professional HTML content for a CMS page with the following details:

Page Title: ${body.title || 'Untitled Page'}
Purpose: ${body.description || 'General information page'}

Write clean, semantic HTML using <h2>, <h3>, <p>, <ul>, <li>, <blockquote>, and <div> tags where appropriate.
- Do NOT include <html>, <head>, <body>, or DOCTYPE tags.
- Do NOT include the page title as an <h1> — skip any top-level heading.
- Use a single <div> wrapper with class="cms-content".
- Use inline styles OR utility classes (Tailwind-style class names like "text-lg", "font-semibold", "mt-6", "space-y-4").
- Keep the tone professional and encouraging, aimed at African tech professionals.
- Format for readability: short paragraphs, bullet lists for features, clear section breaks.

Return ONLY the HTML content, no markdown or explanation.`;
    default:
      return '';
  }
}

async function callAiProvider(prompt: string): Promise<string> {
  const providers = await getProviders();
  const provider = providers[ACTIVE_PROVIDER];
  if (!provider.apiKey) {
    const { primary, fallback } = PROVIDER_KEY_MAP[ACTIVE_PROVIDER];
    throw new AppError(500, `AI provider "${ACTIVE_PROVIDER}" not configured. Set ${primary} or ${fallback} environment variable, or add the key in Admin → Site Settings → AI Settings.`);
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({ model: provider.defaultModel, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new AppError(502, `AI request failed (${provider.label}): ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function chatAiProvider(messages: Array<{ role: string; content: string }>): Promise<string> {
  const providers = await getProviders();
  const provider = providers[ACTIVE_PROVIDER];

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model: provider.defaultModel,
      max_tokens: 800,
      messages: messages as any,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new AppError(502, `AI chat failed (${provider.label}): ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function handleTutorChat(body: RequestBody): Promise<string> {
  const systemMessage = `You are an AI tutor for SkillBridge Africa, helping African tech students learn.
Teaching style: Socratic — guide the student to discover answers. Be encouraging, specific, and concrete.
Rules:
- Never do the student's work for them.
- Break problems into smaller steps.
- Praise specific things they get right.
- Keep responses under 200 words.
${body.knowledgeContent ? `Knowledge base:\n${body.knowledgeContent}` : ''}
Topic: ${body.topic || 'general'}
Strengths: ${(body.studentStrengths || []).join(', ') || 'none'}
Weaknesses: ${(body.studentWeaknesses || []).join(', ') || 'none'}`;

  const messages = [
    { role: 'system', content: systemMessage },
    ...(body.messages || []).map((m) => ({
      role: m.role === 'tutor' ? 'assistant' : (m.role as 'user' | 'assistant'),
      content: m.content,
    })),
  ];
  return await chatAiProvider(messages);
}

async function handleTutorReflect(body: RequestBody): Promise<string> {
  const conversation = (body.messages || []).map((m) => `${m.role === 'student' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n\n');
  return await callAiProvider(`Analyze this tutoring session and extract: 1. LEARNING INSIGHTS 2. ENGAGEMENT 3. ADAPTATION 4. KEY MISTAKES 5. NEXT STEPS. Keep each section to 1-2 sentences.
Topic: ${body.topic || 'general'}
Conversation:\n${conversation || '(No conversation)'}`);
}

async function handleTutorQuiz(body: RequestBody): Promise<string> {
  return await callAiProvider(`Generate a 5-question multiple-choice quiz on "${body.topic || 'general'}".
Rules: 4 options per question (A-D), one correct answer, mix of easy/medium/challenging.
Return valid JSON array: [{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correctIndex":0}]`);
}

async function handleTutorGrade(body: RequestBody): Promise<string> {
  if (!body.questions || !body.answers) throw new AppError(400, "tutor_grade requires 'questions' and 'answers'");

  let correctCount = 0;
  const results = body.questions.map((q, i) => {
    const studentAnswer = body.answers![i];
    const isCorrect = studentAnswer === q.correctIndex;
    if (isCorrect) correctCount++;
    return { question: q.question, correct: isCorrect, correctAnswer: q.options[q.correctIndex], studentAnswer: q.options[studentAnswer] || 'unanswered' };
  });

  const score = Math.round((correctCount / body.questions.length) * 100);
  return JSON.stringify({ score, correctCount, total: body.questions.length, results });
}

// ── GET /ai/providers — list all providers with their configured status ──
aiRouter.get('/providers', async (_req: Request, res: Response) => {
  const providers = await getProviders();
  const list = Object.entries(providers).map(([id, cfg]) => ({
    id,
    label: cfg.label,
    configured: !!cfg.apiKey,
    active: id === ACTIVE_PROVIDER,
  }));
  res.json({ data: list });
});

// ── POST /ai/test — test a provider's API key with a simple completion ──
aiRouter.post('/test', requireAuth, async (req: Request, res: Response) => {
  const { provider: raw } = req.body || {};
  const providerId = (raw || ACTIVE_PROVIDER) as string;
  const validIds = ['openrouter', 'mistral', 'openai', 'groq', 'google', 'togetherai'];
  if (!validIds.includes(providerId)) {
    res.status(400).json({ error: `Unknown provider "${providerId}". Valid providers: ${validIds.join(', ')}` });
    return;
  }
  const providers = await getProviders();
  const cfg = providers[providerId as AiProvider];
  if (!cfg.apiKey) {
    res.status(400).json({ error: `No API key configured for ${cfg.label}` });
    return;
  }
  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.defaultModel, max_tokens: 10, messages: [{ role: 'user', content: 'Say "ok"' }] }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown error');
    res.status(502).json({ error: `${cfg.label} returned ${response.status}: ${errText.slice(0, 200)}` });
    return;
  }
  res.json({ status: 'ok', provider: providerId });
});

// ── POST /ai — main AI assist handler ──
aiRouter.post('/', async (req: Request, res: Response) => {
  const providers = await getProviders();
  const provider = providers[ACTIVE_PROVIDER];
  if (!provider.apiKey) {
    const { primary, fallback } = PROVIDER_KEY_MAP[ACTIVE_PROVIDER];
    throw new AppError(500, `AI provider "${ACTIVE_PROVIDER}" not configured. Set ${primary} or ${fallback} environment variable, or add the key in Admin → Site Settings → AI Settings.`);
  }

  const body: RequestBody = req.body;
  if (!body.mode) throw new AppError(400, "Missing 'mode'");

  const tutorModes = ['tutor_chat', 'tutor_reflect', 'tutor_quiz', 'tutor_grade'];
  if (tutorModes.includes(body.mode)) {
    let resultText: string;
    switch (body.mode) {
      case 'tutor_chat': resultText = await handleTutorChat(body); break;
      case 'tutor_reflect': resultText = await handleTutorReflect(body); break;
      case 'tutor_quiz': resultText = await handleTutorQuiz(body); break;
      case 'tutor_grade': resultText = await handleTutorGrade(body); break;
      default: throw new Error('Unknown tutor mode');
    }
    return res.json(body.mode === 'tutor_grade' ? JSON.parse(resultText) : { result: resultText });
  }

  const prompt = buildPrompt(body);
  const resultText = await callAiProvider(prompt);
  res.json({ result: resultText });
});

// ── GET /ai/keys — list all stored API keys (masked) ──
let cachedDbKeys: Record<string, string> | null = null;
let keyCacheTime = 0;
const KEY_CACHE_TTL_MS = 30_000;

async function loadDbApiKeys(): Promise<Record<string, string>> {
  if (cachedDbKeys && Date.now() - keyCacheTime < KEY_CACHE_TTL_MS) {
    return cachedDbKeys;
  }
  try {
    const { data, error } = await adminClient
      .from('site_settings')
      .select('value')
      .eq('key', 'ai_api_keys')
      .maybeSingle();
    if (!error && data?.value && typeof data.value === 'object') {
      cachedDbKeys = data.value as Record<string, string>;
    } else {
      cachedDbKeys = {};
    }
  } catch {
    cachedDbKeys = {};
  }
  keyCacheTime = Date.now();
  return cachedDbKeys!;
}

function invalidateKeyCache(): void {
  cachedDbKeys = null;
  keyCacheTime = 0;
}

let cachedModels: Record<string, string> | null = null;
let modelCacheTime = 0;
const MODEL_CACHE_TTL_MS = 30_000;

async function loadDbModels(): Promise<Record<string, string>> {
  if (cachedModels && Date.now() - modelCacheTime < MODEL_CACHE_TTL_MS) {
    return cachedModels;
  }
  try {
    const { data, error } = await adminClient
      .from('site_settings')
      .select('value')
      .eq('key', 'ai_models')
      .maybeSingle();
    if (!error && data?.value && typeof data.value === 'object') {
      cachedModels = data.value as Record<string, string>;
    } else {
      cachedModels = {};
    }
  } catch {
    cachedModels = {};
  }
  modelCacheTime = Date.now();
  return cachedModels!;
}

function invalidateModelCache(): void {
  cachedModels = null;
  modelCacheTime = 0;
}

aiRouter.get('/keys', requireAuth, async (_req: Request, res: Response) => {
  try {
    const dbKeys = await loadDbApiKeys();
    const masked: Record<string, string> = {};
    for (const [k, v] of Object.entries(dbKeys)) {
      masked[k] = v ? v.slice(0, 8) + '...' + v.slice(-4) : '';
    }
    res.json({ data: masked });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(500, 'Failed to load API keys');
  }
});

// ── POST /ai/keys — save API keys for all providers ──
aiRouter.post('/keys', requireAuth, async (req: Request, res: Response) => {
  const { keys } = req.body || {};
  if (!keys || typeof keys !== 'object') {
    res.status(400).json({ error: 'Missing or invalid "keys" object' });
    return;
  }
  const validIds = new Set(['openrouter', 'mistral', 'openai', 'groq', 'google', 'togetherai']);
  for (const k of Object.keys(keys)) {
    if (!validIds.has(k)) {
      res.status(400).json({ error: `Unknown provider id "${k}"` });
      return;
    }
  }
  try {
    const { error: upsertError } = await adminClient
      .from('site_settings')
      .upsert({ key: 'ai_api_keys', value: keys }, { onConflict: 'key' });
    if (upsertError) throw new AppError(500, upsertError.message);
    invalidateKeyCache();
    res.json({ status: 'ok' });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(500, 'Failed to save API keys');
  }
});

// ── GET /ai/models — list per-provider model overrides ──
aiRouter.get('/models', requireAuth, async (_req: Request, res: Response) => {
  try {
    const models = await loadDbModels();
    res.json({ data: models });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(500, 'Failed to load AI models');
  }
});

// ── POST /ai/models — save per-provider model overrides ──
aiRouter.post('/models', requireAuth, async (req: Request, res: Response) => {
  const { models } = req.body || {};
  if (!models || typeof models !== 'object') {
    res.status(400).json({ error: 'Missing or invalid "models" object' });
    return;
  }
  const validIds = new Set(['openrouter', 'mistral', 'openai', 'groq', 'google', 'togetherai']);
  for (const k of Object.keys(models)) {
    if (!validIds.has(k)) {
      res.status(400).json({ error: `Unknown provider id "${k}"` });
      return;
    }
  }
  try {
    const { error: upsertError } = await adminClient
      .from('site_settings')
      .upsert({ key: 'ai_models', value: models }, { onConflict: 'key' });
    if (upsertError) throw new AppError(500, upsertError.message);
    invalidateModelCache();
    res.json({ status: 'ok' });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(500, 'Failed to save AI models');
  }
});
