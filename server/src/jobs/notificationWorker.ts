import { Queue, Worker, Job } from 'bullmq';
import pino from 'pino';
import { adminClient } from '../lib/supabase-admin.js';
import { sendPushNotification, PushPayload } from '../lib/webpush.js';

const logger = pino({ name: 'notification-worker' });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = { url: REDIS_URL };

// ── Queue ──
export const notificationQueue = new Queue('notifications', { connection });
notificationQueue.on('error', (err) => {
  logger.error({ err: err.message }, 'Notification queue error (Redis down?)');
});

// ── Worker ──
export function startNotificationWorker(): void {
  const worker = new Worker(
    'notifications',
    async (job: Job) => {
      const { type } = job.data;

      switch (type) {
        case 'push:call': {
          await handleCallPush(job);
          break;
        }
        case 'push:meeting': {
          await handleMeetingPush(job);
          break;
        }
        case 'in-app:call': {
          await handleInAppCallNotification(job);
          break;
        }
        default:
          logger.warn({ type }, 'Unknown notification job type');
      }
    },
    { connection, concurrency: 5 },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, type: job.data.type }, 'Notification job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, type: job?.data?.type, err: err.message }, 'Notification job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'Notification worker error (Redis down?)');
  });

  logger.info('Notification worker started');
}

/**
 * Send a push notification for an incoming call to the callee.
 */
async function handleCallPush(job: Job) {
  const { calleeUserId, callerName, roomId, roomType } = job.data;

  // Fetch all push subscriptions for the callee
  const { data: subscriptions } = await adminClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', calleeUserId);

  if (!subscriptions || subscriptions.length === 0) {
    logger.info({ calleeUserId }, 'No push subscriptions for user');
    return;
  }

  const payload: PushPayload = {
    title: `Incoming call from ${callerName}`,
    body: `${callerName} is calling you`,
    tag: `call-${roomId}`,
    data: {
      type: 'call',
      roomId,
      roomType,
      callerName,
    },
    url: `/video-call/${roomId}`,
  };

  let sentCount = 0;
  for (const sub of subscriptions) {
    const ok = await sendPushNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      adminClient,
      sub.id,
    );
    if (ok) sentCount++;
  }

  logger.info({ calleeUserId, sentCount, total: subscriptions.length }, 'Call push notification sent');
}

/**
 * Send push notification for a meeting reminder.
 */
async function handleMeetingPush(job: Job) {
  const { userId, meetingTitle, meetingId } = job.data;

  const { data: subscriptions } = await adminClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subscriptions || subscriptions.length === 0) return;

  const payload: PushPayload = {
    title: `Meeting Reminder: ${meetingTitle}`,
    body: `Your meeting "${meetingTitle}" is starting now`,
    tag: `meeting-${meetingId}`,
    data: { type: 'meeting', meetingId },
    url: `/b2b/meetings`,
  };

  for (const sub of subscriptions) {
    await sendPushNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      adminClient,
      sub.id,
    );
  }
}

/**
 * Store an in-app notification record (visible in the app notification bell).
 */
async function handleInAppCallNotification(job: Job) {
  const { calleeUserId, callerName, callerId, roomId } = job.data;

  const { error } = await adminClient.from('notifications').insert({
    profile_id: calleeUserId,
    title: 'Missed call',
    message: `You missed a call from ${callerName}`,
    type: 'call_missed',
    metadata: { callerId, roomId },
  });

  if (error) logger.error({ error }, 'Failed to create in-app notification');
}
