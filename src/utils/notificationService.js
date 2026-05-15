import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Notification Service for Shop Admin
 * Handles sending push notifications to users via Cloudflare API
 */
const getApiFunctionBaseUrl = () => {
  // Always use the production Cloudflare Functions domain.
  // The local React development server (npm run start) on port 3000 
  // does not execute Cloudflare functions natively without `wrangler pages dev`.
  return 'https://kamikoto.qzz.io/api';
};

/**
 * Sends a notification to all users who have enabled them
 * @param {Object} notificationData - { title, body, icon, link, type }
 */
export const sendBroadcastNotification = async (notificationData) => {
  try {
    console.log('📢 NotificationService: Sending broadcast notification:', notificationData);
    
    // 1. Fetch all users with FCM tokens
    const tokens = [];
    
    // Fetch from registered users
    const usersRef = collection(db, 'users');
    const qUsers = query(usersRef, where('notificationsEnabled', '==', true));
    const usersSnapshot = await getDocs(qUsers);
    
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
        tokens.push(...userData.fcmTokens);
      }
    });

    // Fetch from anonymous/guest tokens
    const guestTokensRef = collection(db, 'fcmTokens');
    const guestSnapshot = await getDocs(guestTokensRef);
    
    guestSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.token) {
        tokens.push(data.token);
      }
    });

    if (tokens.length === 0) {
      console.log('📢 NotificationService: No tokens found to notify');
      return { success: true, message: 'No users to notify', result: { count: 0 } };
    }

    // Remove duplicates
    const uniqueTokens = [...new Set(tokens)];
    console.log(`📢 NotificationService: Sending to ${uniqueTokens.length} unique tokens`);

    // 2. Call the backend API to send the messages
    const apiEndpoint = `${getApiFunctionBaseUrl()}/send-notification`;
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const userRef = collection(db, 'users');
    const userSnapshot = await getDocs(query(userRef, where('uid', '==', userId)));
    
    if (userSnapshot.empty) {
      throw new Error('User not found');
    }

    const userData = userSnapshot.docs[0].data();
    if (!userData.fcmTokens || userData.fcmTokens.length === 0) {
      console.log('📢 NotificationService: User has no registered tokens');
      return { success: true, message: 'User has no tokens' };
    }

    // 2. Call the backend API
    const apiEndpoint = `${getApiFunctionBaseUrl()}/send-notification`;
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
