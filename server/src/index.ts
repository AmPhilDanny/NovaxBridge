import 'dotenv/config';
import 'express-async-errors';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'node:http';
import { Server } from 'socket.io';
import pino from 'pino';
import { errorHandler } from './middleware/error.js';
import { requireAuth, optionalAuth } from './middleware/auth.js';
import { adminClient } from './lib/supabase-admin.js';
import { jobsRouter } from './routes/jobs/index.js';
import { projectsRouter } from './routes/projects/index.js';
import { adminRouter } from './routes/admin/index.js';
import { marketplaceRouter } from './routes/marketplace/index.js';
import { paymentsRouter } from './routes/payments/index.js';
import { walletRouter } from './routes/wallet/index.js';
import { messagingRouter } from './routes/messaging/index.js';
import { aiRouter } from './routes/ai/index.js';
import { b2bRouter } from './routes/b2b/index.js';
import { notificationsRouter } from './routes/notifications/index.js';
import { webhooksRouter } from './routes/webhooks/index.js';
import { emailRouter } from './routes/email/index.js';
import { githubRouter, handleGithubCallback } from './routes/github/index.js';
import { academyRouter } from './routes/academy/index.js';
import { academyCoursesRouter } from './routes/academy/courses.js';
import { academyCertificatesRouter } from './routes/academy/certificates.js';
import { academyPlaygroundRouter } from './routes/academy/playground.js';
import { setupVideoCallSignaling, videoCallRouter } from './routes/video-call/index.js';
import { initMediasoupWorkers, closeMediasoupWorkers } from './media/mediasoupManager.js';
import { setupCallHandlers } from './sockets/callHandler.js';
import { pushSubscriptionsRouter } from './routes/push-subscriptions/index.js';
import { startNotificationWorker } from './jobs/notificationWorker.js';

const logger = pino({ name: 'skillbridge-server' });
const app: Express = express();
const PORT = parseInt(process.env.PORT || '4001', 10);

// ── Global Middleware ──
const isDev = process.env.NODE_ENV === 'development';
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: isDev
        ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
        : ["'self'", "https:", "'strict-dynamic'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co", "wss://*.onrender.com"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: false,
}));
const ALLOWED_ORIGINS = [
  /^https?:\/\/localhost:(3000|4000)$/,
  'https://novaxbridgeadmin.onrender.com',
  'https://novaxbridge.onrender.com',
  /^https:\/\/[a-zA-Z0-9-]+\.onrender\.com$/i,
  /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/i,
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, health checks)
    if (!origin) return callback(null, true);
    try {
      const ok = ALLOWED_ORIGINS.some((re) => {
        if (typeof re === 'string') return origin === re;
        return re.test(origin);
      });
      callback(null, ok);
    } catch (err) {
      callback(err as Error);
    }
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  logger.info({ method: req.method, path: req.path }, 'request');
  next();
});

// ── Health Check ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Public: published CMS pages (no auth required) ──
app.get('/api/pages/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { data, error } = await adminClient
      .from('pages')
      .select('slug, title, content_html, created_at, updated_at')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    if (error) {
      if (error.code === '42P01') { res.status(404).json({ error: 'Page not found' }); return; }
      res.status(500).json({ error: error.message }); return;
    }
    if (!data) { res.status(404).json({ error: 'Page not found' }); return; }
    res.json({ data });
  } catch (err) { next(err); }
});

// ── Public: site config (cached for public consumption, bypasses RLS) ──
app.get('/api/site-config', async (_req, res) => {
  const { data, error } = await adminClient
    .from('site_settings')
    .select('value')
    .eq('key', 'site_config')
    .maybeSingle();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ data: data?.value || null });
});

// ── Public Routes (no auth required) ──
app.use('/api/webhooks', webhooksRouter);
app.get('/api/github/callback', handleGithubCallback);

// ── Marketplace Routes (public read, authenticated write) ──
app.use('/api/marketplace', optionalAuth, marketplaceRouter);

// ── Jobs Routes (public read, authenticated write) ──
app.use('/api/jobs', optionalAuth, jobsRouter);

// ── Projects Routes (public read, authenticated write) ──
app.use('/api/projects', optionalAuth, projectsRouter);
app.use('/api/payments', requireAuth, paymentsRouter);
app.use('/api/wallet', requireAuth, walletRouter);
app.use('/api/messaging', requireAuth, messagingRouter);
app.use('/api/ai', requireAuth, aiRouter);
app.use('/api/b2b', requireAuth, b2bRouter);
app.use('/api/notifications', requireAuth, notificationsRouter);
app.use('/api/email', requireAuth, emailRouter);
app.use('/api/github', requireAuth, githubRouter);
app.use('/api/academy', requireAuth, academyRouter);
app.use('/api/academy', requireAuth, academyCoursesRouter);
app.use('/api/academy', requireAuth, academyCertificatesRouter);
app.use('/api/academy/playground', requireAuth, academyPlaygroundRouter);

// ── Push Subscription Routes ──
app.use('/api/push-subscriptions', requireAuth, pushSubscriptionsRouter);

// ── Admin Routes (auth + admin role) ──
app.use('/api/admin', requireAuth, adminRouter);

// ── Video Call Admin Routes (auth + admin role) ──
app.use('/api/video-call', requireAuth, videoCallRouter);

// ── Error Handler ──
app.use(errorHandler);

// ── HTTP Server + Socket.IO (for video-call signaling) ──
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      try {
        const ok = ALLOWED_ORIGINS.some((re) => {
          if (typeof re === 'string') return origin === re;
          return re.test(origin);
        });
        callback(null, ok);
      } catch (err) {
        callback(err as Error);
      }
    },
    credentials: true,
  },
  serveClient: false,
});

setupVideoCallSignaling(io);
setupCallHandlers(io);

// ── Start Server ──
async function start(): Promise<void> {
  // Mediasoup is optional — video calls need it, REST API doesn't
  try {
    await initMediasoupWorkers();
    logger.info('Mediasoup workers initialized');
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Mediasoup workers not available — video calls disabled');
  }

  // Start BullMQ notification worker (Redis connection errors are caught internally)
  try {
    startNotificationWorker();
    logger.info('Notification worker started');
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Notification worker not available');
  }

  httpServer.listen(PORT, () => {
    logger.info(`SkillBridge API server running on port ${PORT}`);
  });
}

start();

// ── Graceful Shutdown ──
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down');
  await closeMediasoupWorkers();
  httpServer.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
