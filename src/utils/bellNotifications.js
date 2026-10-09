import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';
import { isWithinAbnormalVisibility } from './abnormalVisibility';

export const BELL_UNREAD_EVENT = 'bellUnreadChanged';

export const setBellUnreadCount = (count) => {
  DeviceEventEmitter.emit(BELL_UNREAD_EVENT, Number(count) || 0);
};

let bellSync = null;
let bellSyncAgain = false;

/** Loads unread bell items and tells the home bell whether to show its red dot. */
export const publishBellUnreadCount = () => {
  if (bellSync) {
    bellSyncAgain = true;
    return bellSync;
  }

  bellSync = (async () => {
    try {
      let count = 0;
      do {
        bellSyncAgain = false;
        const items = await loadVisibleBellNotifications();
        count = items.length;
        setBellUnreadCount(count);
      } while (bellSyncAgain);
      return count;
    } finally {
      bellSync = null;
    }
  })();

  return bellSync;
};

export const loadVisibleBellNotifications = async () => {
  const userStr = await AsyncStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const items = [];

  if (user?.id) {
    const chatResult = await apiService.getChatNotifications(user.id).catch(() => null);
    const messages = Array.isArray(chatResult?.data) ? chatResult.data : [];
    messages.forEach((message) => {
      if (Number(message.is_read) === 1) return;
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
    const isReview = row.kind === 'assigned_review';
    if (isReview && row.created_at && !isWithinAbnormalVisibility(row.created_at)) return;
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
