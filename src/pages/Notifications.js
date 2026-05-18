import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Send, Trash2, Info, AlertTriangle } from 'react-feather';
import { Button, Card, Input, Alert, LoadingSpinner } from '../components/ui';
import { sendBroadcastNotification } from '../utils/notificationService';
import { toast } from 'react-toastify';

/**
 * Notifications Management Page
 * Allows admins to send custom broadcast notifications to all users
 */
const Notifications = () => {
  const [notification, setNotification] = useState({
    title: '',
    body: '',
    link: '/',
    type: 'broadcast'
  });
  
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!notification.title || !notification.body) {
      toast.error("Please fill in title and message");
      return;
    }

    if (!window.confirm("Are you sure you want to send this notification to ALL users?")) {
      return;
    }

    try {
      setIsSending(true);
      
      // Enforce deliberate 2-second delay for professional visual confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const result = await sendBroadcastNotification(notification);
      
      if (result.success) {
        if (result.message === 'No users to notify') {
          toast.info("No devices registered to receive notifications yet.");
        } else {
          // result.result contains the backend response { success, count, details }
          const count = result.result?.count ?? 0;
          toast.success(`Successfully sent to ${count} devices!`);
          setNotification({ title: '', body: '', link: '/', type: 'broadcast' });
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error sending broadcast:", error);
      toast.error(`Failed to send: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    setNotification({ title: '', body: '', link: '/', type: 'broadcast' });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Custom Notifications</h1>
          <p className="text-gray-600 mt-1">Send manual push notifications to all users who have enabled them.</p>
        </div>
        <Bell className="w-10 h-10 text-blue-600 opacity-20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Composer */}
        <Card title="Compose Notification">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Notification Title</label>
              <Input
                placeholder="e.g. Flash Sale Live! 🚀"
                value={notification.title}
                onChange={(e) => setNotification({...notification, title: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Message Body</label>
              <textarea
                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                rows="4"
                placeholder="Enter the message you want users to see..."
                value={notification.body}
                onChange={(e) => setNotification({...notification, body: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Click Action URL (Optional)</label>
              <Input
                placeholder="e.g. /products/best-sellers"
                value={notification.link}
                onChange={(e) => setNotification({...notification, link: e.target.value})}
                icon={<Info className="w-4 h-4" />}
                iconPosition="right"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <Button
                onClick={handleSend}
                disabled={isSending}
                className="flex-1"
                icon={isSending ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
              >
                {isSending ? 'Sending...' : 'Broadcast to All Users'}
              </Button>
              <Button
                variant="outline"
                onClick={handleClear}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Clear
              </Button>
            </div>
          </div>
        </Card>

        {/* Live Preview */}
        <div className="space-y-6">
          <Card title="Device Preview">
            <div className="relative mx-auto w-[280px] h-[580px] bg-gray-900 rounded-[3rem] border-[8px] border-gray-800 shadow-2xl flex flex-col overflow-hidden">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl z-20"></div>
              
              {/* Screen */}
              <div className="flex-1 bg-gray-100 p-4 pt-12">
                <div className="text-[10px] font-bold text-gray-400 mb-4 flex justify-between px-2">
                  <span>9:41</span>
                  <div className="flex gap-1">
                    <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                    <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  </div>
                </div>

                {/* Notification Toast in Preview */}
                <motion.div
                  initial={{ y: -100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  key={notification.title + notification.body}
                  className="bg-white/80 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-white/20 mb-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-gray-900 truncate">
                        {notification.title || "Notification Title"}
                      </h4>
                      <p className="text-[11px] text-gray-600 line-clamp-2">
                        {notification.body || "This is how your message will look on a user's device. Make it catchy!"}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Mock Content */}
                <div className="space-y-3 opacity-20">
                  <div className="h-20 bg-gray-300 rounded-xl"></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-32 bg-gray-300 rounded-xl"></div>
                    <div className="h-32 bg-gray-300 rounded-xl"></div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-gray-500 mt-4">
              Real-time preview of how the notification appears on iOS/Android.
            </p>
          </Card>

          <Alert
            variant="warning"
            icon={<AlertTriangle className="w-5 h-5" />}
            title="Important Note"
            message="Push notifications are powerful. Avoid over-sending to prevent users from disabling them or unsubscribing."
          />
        </div>
      </div>
    </div>
  );
};

export default Notifications;
