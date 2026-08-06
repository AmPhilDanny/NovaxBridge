import webpush from 'web-push';
import pino from 'pino';

const logger = pino({ name: 'webpush' });

// Configure VAPID from env (generate on first run if missing)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL || 'noreply@dalastudioshowcase.com'),
    vapidPublicKey,
    vapidPrivateKey,
  );
  logger.info('WebPush VAPID configured');
} else {
  logger.warn('VAPID keys not set — push notifications disabled');
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  tag?: string;
  url?: string;
}

/**
 * Send a push notification to a single subscription.
 * Returns true if sent, false if the subscription is invalid (should be removed).
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload,
  adminClient: any,
  subscriptionId: string,
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      subscription as webpush.PushSubscription,
      JSON.stringify(payload),
      { TTL: 86400 }, // 24h TTL for offline delivery
    );
    return true;
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired or invalid — remove it
      logger.warn({ subscriptionId, statusCode: err.statusCode }, 'Removing invalid push subscription');
      try {
        await adminClient.from('push_subscriptions').delete().eq('id', subscriptionId);
      } catch { /* non-fatal */ }
    } else {
      logger.error({ err, subscriptionId }, 'Push notification send failed');
    }
    return false;
  }
}

export { webpush };
