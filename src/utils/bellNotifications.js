import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';
import {
  areNotificationsEnabled,
  getNotificationBellVisibleAfter,
  isNotificationVisibleInBell,
} from './notificationPreference';

export const loadVisibleBellNotifications = async () => {
  const alertsEnabled = await areNotificationsEnabled();
  const cutoff = alertsEnabled ? await getNotificationBellVisibleAfter() : null;
  const userStr = await AsyncStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const items = [];

  if (user?.id) {
    const chatResult = await apiService.getChatNotifications(user.id).catch(() => null);
    const messages = Array.isArray(chatResult?.data) ? chatResult.data : [];
    messages.forEach((message) => {
      if (Number(message.is_read) === 1) return;
      if (!isNotificationVisibleInBell(message.created_at, cutoff)) return;
      const sender = String(message.from_user_name || '').trim() || 'New message';
      items.push({
        id: `chat-${message.id}`,
        kind: 'message',
        title: sender,
        message: message.message || 'Sent you a message',
        date: message.created_at,
        read: false,
        fromUserId: message.from_user_id,
      });
    });
  }

  const appResult = await apiService.getInAppNotifications().catch(() => null);
  const appRows = Array.isArray(appResult?.data) ? appResult.data : [];
  appRows.forEach((row) => {
    if (Number(row.is_read) === 1) return;
    if (!isNotificationVisibleInBell(row.created_at, cutoff)) return;
    const isReview = row.kind === 'assigned_review';
    items.push({
      id: `${row.kind || 'notice'}-${row.id}`,
      sourceId: row.id,
      kind: isReview ? 'review' : 'notice',
      title: row.ticket_title || (isReview ? 'Abnormal Reading Assigned' : 'Notification'),
      message: row.message || row.patient_name || '',
      date: row.created_at,
      read: false,
      practiceId: row.practice_id,
      patientId: row.patient_id,
    });
  });

  items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  return items;
};
