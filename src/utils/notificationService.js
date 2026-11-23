import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
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
    
    // 1. Fetch all reachable FCM tokens.
    // Each source is independent: one denied/broken collection must not block
    // the whole campaign (for example guest tokens vs registered users).
    const tokens = [];
    const sourceFailures = [];

    const [usersResult, guestsResult] = await Promise.allSettled([
      (async () => {
        const usersSnapshot = await getDocs(
          query(collection(db, 'users'), where('notificationsEnabled', '==', true))
        );
        const collected = [];
        usersSnapshot.forEach((userDoc) => {
          const userData = userDoc.data();
          if (Array.isArray(userData.fcmTokens)) {
            collected.push(...userData.fcmTokens.filter(Boolean));
          }
        });
        return collected;
      })(),
      (async () => {
        const guestSnapshot = await getDocs(collection(db, 'fcmTokens'));
        const collected = [];
        guestSnapshot.forEach((guestDoc) => {
          const data = guestDoc.data();
          if (data.notificationsEnabled !== false && data.token) {
            collected.push(data.token);
          }
        });
        return collected;
      })(),
    ]);

    if (usersResult.status === 'fulfilled') {
      tokens.push(...usersResult.value);
    } else {
      sourceFailures.push(`registered users (${usersResult.reason?.code || usersResult.reason?.message || 'unknown'})`);
      console.warn('📢 NotificationService: Could not read registered users:', usersResult.reason);
    }

    if (guestsResult.status === 'fulfilled') {
      tokens.push(...guestsResult.value);
    } else {
      sourceFailures.push(`guest devices (${guestsResult.reason?.code || guestsResult.reason?.message || 'unknown'})`);
      console.warn('📢 NotificationService: Could not read guest tokens:', guestsResult.reason);
    }

    if (tokens.length === 0) {
      if (sourceFailures.length === 2) {
        throw new Error(
          `Unable to read notification recipients. Firestore denied both token sources: ${sourceFailures.join(', ')}. Deploy the latest Firestore rules.`
        );
      }
      console.log('📢 NotificationService: No tokens found to notify');
      return { success: true, message: 'No users to notify', result: { count: 0 } };
    }

    // Remove duplicates
    const uniqueTokens = [...new Set(tokens.filter(Boolean))];
    console.log(`📢 NotificationService: Sending to ${uniqueTokens.length} unique tokens`);

    // 2. Call the backend API to send the messages
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
        tokens: uniqueTokens,
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

    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'Failed to send notification');

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
