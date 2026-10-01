import { DeviceEventEmitter } from 'react-native';
import notifee from '@notifee/react-native';

const INBOX_EVENT = 'notificationInboxChanged';

let unreadCount = 0;

const emitChange = () => {
  DeviceEventEmitter.emit(INBOX_EVENT, unreadCount);
};

const notificationData = (item) => item?.notification?.data || item?.data || {};

const notificationId = (item) => item?.id || item?.notification?.id || null;

export const getUnreadNotificationCount = () => unreadCount;

export const subscribeNotificationInbox = (listener) => {
  const subscription = DeviceEventEmitter.addListener(INBOX_EVENT, listener);
  return () => subscription.remove();
};

export const refreshNotificationInbox = async () => {
  try {
    const displayed = await notifee.getDisplayedNotifications();
    unreadCount = Array.isArray(displayed) ? displayed.length : 0;
  } catch (error) {
    unreadCount = 0;
  }
  try {
    await notifee.setBadgeCount(unreadCount);
  } catch {
    // Badge count is optional on this device.
  }
  emitChange();
  return unreadCount;
};

const cancelDisplayed = async (item) => {
  const id = notificationId(item);
  if (!id) return;
  const tag = item?.notification?.android?.tag;
  try {
    if (tag) {
      await notifee.cancelNotification(id, tag);
    } else {
      await notifee.cancelNotification(id);
    }
  } catch (error) {
    try {
      await notifee.cancelNotification(id);
    } catch {
      // The tray entry may already be gone.
    }
  }
};

export const dismissMatchingNotifications = async (predicate) => {
  try {
    const displayed = await notifee.getDisplayedNotifications();
    const matches = (displayed || []).filter((item) => predicate(notificationData(item), item));
    await Promise.all(matches.map((item) => cancelDisplayed(item)));
  } catch (error) {
    // Leave the tray unchanged if the system list cannot be read.
  }
  return refreshNotificationInbox();
};

export const dismissChatNotifications = (fromUserId) => {
  const userId = String(fromUserId || '');
  if (!userId) return refreshNotificationInbox();
  return dismissMatchingNotifications((data) => (
    data.type === 'chat_message' && String(data.from_user_id || '') === userId
  ));
};

export const dismissAbnormalNotification = ({ practiceId, patientId, vitalType, measurementId } = {}) => (
  dismissMatchingNotifications((data) => {
    if (data.type !== 'abnormal_assignment') return false;
    if (practiceId != null && String(data.practice_id || '') !== String(practiceId)) return false;
    if (patientId != null && String(data.patient_id || '') !== String(patientId)) return false;
    if (measurementId != null && data.measurement_id && String(data.measurement_id) !== String(measurementId)) {
      return false;
    }
    if (vitalType && data.vital_type && String(data.vital_type) !== String(vitalType)) return false;
    return true;
  })
);

export const dismissOpenedNotification = async (notification) => {
  if (!notification) return refreshNotificationInbox();
  await cancelDisplayed({ id: notification.id, notification });
  return refreshNotificationInbox();
};
