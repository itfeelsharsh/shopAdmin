import { doc, getDoc } from 'firebase/firestore';
import { db, getAppCheckToken } from '../firebase';

/**
 * Notification Service for Shop Admin
 * Handles sending push notifications to users via Cloudflare API
 */
const getApiFunctionBaseUrl = () => {
  // Always use the production Cloudflare Functions domain.
  // The local React development server (npm run start) on port 3000 
  // does not execute Cloudflare functions natively without `wrangler pages dev`.
  return 'https://kamikoto.click/api';
};

/**
 * Sends a notification to all users who have enabled them
 * @param {Object} notificationData - { title, body, icon, link, type }
 */
export const sendBroadcastNotification = async (notificationData) => {
  try {
    console.log('📢 NotificationService: Sending broadcast notification:', notificationData);

    // The backend owns audience discovery (registered users + guest devices).
    // The admin browser never downloads FCM tokens, so campaigns cannot fail
    // because of client-side Firestore read rules or query limits.
    const apiEndpoint = `${getApiFunctionBaseUrl()}/send-notification`;
    const headers = { 'Content-Type': 'application/json' };
    const appCheckToken = await getAppCheckToken();
    if (appCheckToken) {
      headers['X-Firebase-AppCheck'] = appCheckToken;
    }

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        notification: {
          title: notificationData.title,
          body: notificationData.body,
          icon: notificationData.icon || '/logo192.png'
        },
        data: {
          link: notificationData.link || '/',
          type: notificationData.type || 'info'
        }
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error?.message || result.error || `Failed to send notification (${response.status})`);
    }

    if (result?.count === 0 || result?.message === 'No users to notify') {
      return { success: true, message: 'No users to notify', result };
    }

    return { success: true, result };
  } catch (error) {
    console.error('❌ NotificationService: Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Sends a notification to a specific user
 * @param {string} userId - Target user ID
 * @param {Object} notificationData - { title, body, icon, link }
 */
export const sendUserNotification = async (userId, notificationData) => {
  try {
    console.log(`📢 NotificationService: Sending notification to user ${userId}:`, notificationData);
    
    // 1. Fetch user document
    const userSnapshot = await getDoc(doc(db, 'users', userId));

    if (!userSnapshot.exists()) {
      throw new Error('User not found');
    }

    const userData = userSnapshot.data();
    if (!userData.fcmTokens || userData.fcmTokens.length === 0) {
      console.log('📢 NotificationService: User has no registered tokens');
      return { success: true, message: 'User has no tokens' };
    }

    // 2. Call the backend API
    const apiEndpoint = `${getApiFunctionBaseUrl()}/send-notification`;
    const appCheckToken = await getAppCheckToken();
    const headers = { 'Content-Type': 'application/json' };
    if (appCheckToken) {
      headers['X-Firebase-AppCheck'] = appCheckToken;
    }
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tokens: userData.fcmTokens,
        notification: {
          title: notificationData.title,
          body: notificationData.body,
          icon: notificationData.icon || '/logo192.png'
        },
        data: {
          link: notificationData.link || '/',
          type: notificationData.type || 'user_notification'
        }
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'Failed to send notification');

    return { success: true, result };
  } catch (error) {
    console.error('❌ NotificationService: Error sending user notification:', error);
    return { success: false, error: error.message };
  }
};
