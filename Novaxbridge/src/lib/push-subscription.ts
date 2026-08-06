import { post, del } from './api-client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Register the service worker and subscribe to push notifications.
 * Call once on app startup after user auth is confirmed.
 */
export async function initPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported');
    return false;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.warn('VITE_VAPID_PUBLIC_KEY not set — push disabled');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    // Wait for activation
    await navigator.serviceWorker.ready;

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Send subscription to server
    await post('/push-subscriptions', {
      subscription: subscription.toJSON(),
      user_agent: navigator.userAgent,
    });

    return true;
  } catch (err) {
    console.error('Push notification init failed:', err);
    return false;
  }
}

/**
 * Unsubscribe all push subscriptions for the current user.
 */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    await del('/push-subscriptions');
  } catch (err) {
    console.error('Push unregister failed:', err);
  }
}

/**
 * Convert a Base64 URL-encoded string to a Uint8Array.
 * Required by the Push API `applicationServerKey` parameter.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((ch) => ch.charCodeAt(0)));
}
