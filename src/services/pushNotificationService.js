import { AppState, Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import apiService from './apiService';
import { getActiveChatUserId } from '../utils/activeChatState';
import { isChatScreenFocused } from './chatPresence';
import { setPendingChatOpenUserId } from '../utils/pendingChatNavigation';
import { setPendingAbnormalReviewsOpen } from '../utils/pendingAbnormalNavigation';
import { emitAbnormalAssignmentReceived } from '../utils/abnormalAssignmentEvents';
import {
  dismissOpenedNotification,
  refreshNotificationInbox,
} from '../utils/notificationInbox';

const CHAT_CHANNEL_ID = 'chat_messages';
const ABNORMAL_CHANNEL_ID = 'abnormal_readings';
const DISMISSED_NOTIFICATIONS_KEY = 'dismissedPushNotificationIds';
const dismissedNotificationIds = new Set();
let dismissedIdsLoaded = false;

const loadDismissedNotificationIds = async () => {
  if (dismissedIdsLoaded) return;
  dismissedIdsLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_NOTIFICATIONS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    if (Array.isArray(ids)) {
      ids.forEach((id) => dismissedNotificationIds.add(String(id)));
    }
  } catch {
    // Keep the in-memory set if storage cannot be read.
  }
};

const rememberDismissedNotificationIds = async (ids) => {
  ids.filter(Boolean).forEach((id) => dismissedNotificationIds.add(String(id)));
  try {
    const recentIds = Array.from(dismissedNotificationIds).slice(-200);
    await AsyncStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(recentIds));
  } catch {
    // The id is still remembered for this app process.
  }
};

const hasRealNotificationContent = (remoteMessage, data) => {
  const notification = remoteMessage?.notification || {};
  return Boolean(
    notification.title
    || notification.body
    || data?.title
    || data?.body
    || data?.message
  );
};

const ensureAndroidNotificationPermission = async () => {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

const ensureIosNotificationPermission = async () => {
  if (Platform.OS !== 'ios') return true;

  const authStatus = await messaging().requestPermission();
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED
    || authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
};

const ensureNotificationChannels = async () => {
  if (Platform.OS !== 'android') return;

  await notifee.createChannel({
    id: CHAT_CHANNEL_ID,
    name: 'Chat Messages',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });

  await notifee.createChannel({
    id: ABNORMAL_CHANNEL_ID,
    name: 'Abnormal Readings',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
};

const normalizePayload = (remoteMessage) => {
  const data = remoteMessage?.data || {};
  const notification = remoteMessage?.notification || {};
  const type = data.type || '';

  const defaultTitle = type === 'abnormal_assignment'
    ? 'Abnormal Reading Assigned'
    : 'New message';
  const defaultBody = type === 'abnormal_assignment'
    ? 'You have been assigned an abnormal reading to review.'
    : 'You have a new chat message';

  return {
    title: notification.title || data.title || defaultTitle,
    body: notification.body || data.body || data.message || defaultBody,
    data,
  };
};

const shouldSkipNotification = (data) => {
  if (data.type !== 'chat_message') return false;
  // A closed or backgrounded app cannot show the in-chat banner.
  if (AppState.currentState !== 'active') return false;
  if (isChatScreenFocused()) return true;
  return Boolean(
    data.from_user_id
    && getActiveChatUserId() === String(data.from_user_id)
  );
};

const getNotificationMeta = (data) => {
  if (data.type === 'abnormal_assignment') {
    const collapseKey = data.measurement_id
      ? `abnormal-${data.practice_id}-${data.patient_id}-${data.vital_type}-${data.measurement_id}`
      : `abnormal-${data.practice_id}-${data.patient_id}`;
    return {
      channelId: ABNORMAL_CHANNEL_ID,
      notificationId: collapseKey,
      tag: collapseKey,
    };
  }

  const notificationId = data.message_id
    ? `chat-${data.message_id}`
    : `chat-user-${data.from_user_id || 'unknown'}`;

  return {
    channelId: CHAT_CHANNEL_ID,
    notificationId,
    tag: notificationId,
  };
};

const displayRemoteNotification = async (remoteMessage, { isForeground = false } = {}) => {
  // A notification+data message is already shown by Android in the background.
  // Posting it again is what leaves a second "New message" alert after a swipe.
  if (!isForeground && remoteMessage?.notification) {
    return;
  }

  const { title, body, data } = normalizePayload(remoteMessage);

  if (
    data.type === 'chat_message'
    && !hasRealNotificationContent(remoteMessage, data)
    && !data.from_user_id
  ) {
    return;
  }

  if (shouldSkipNotification(data)) {
    return;
  }

  await loadDismissedNotificationIds();
  const { channelId, notificationId, tag } = getNotificationMeta(data);
  if (
    dismissedNotificationIds.has(notificationId)
    || (data.message_id && dismissedNotificationIds.has(`chat-${data.message_id}`))
  ) {
    return;
  }

  await ensureNotificationChannels();

  await notifee.displayNotification({
    id: notificationId,
    title,
    body,
    data,
    android: {
      channelId,
      pressAction: { id: 'default' },
      smallIcon: 'ic_notification',
      tag,
      importance: AndroidImportance.HIGH,
    },
    ios: {
      foregroundPresentationOptions: {
        alert: true,
        badge: true,
        sound: true,
      },
    },
  });
  await refreshNotificationInbox();
};

export const showLocalChatNotification = async ({ fromUserId, title, body, messageId }) => {
  await displayRemoteNotification({
    data: {
      type: 'chat_message',
      from_user_id: fromUserId != null ? String(fromUserId) : '',
      title: title || 'New message',
      body: body || 'You have a new chat message',
      message: body || '',
      message_id: messageId != null ? String(messageId) : '',
    },
  }, { isForeground: true });
};

const handleNotificationDismissed = async (notification) => {
  const data = notification?.data || {};
  const ids = [
    notification?.id,
    data.message_id ? `chat-${data.message_id}` : null,
    data.type === 'chat_message' && data.from_user_id ? `chat-user-${data.from_user_id}` : null,
  ];
  await rememberDismissedNotificationIds(ids);

  try {
    const displayed = await notifee.getDisplayedNotifications();
    await Promise.all((displayed || []).map(async (item) => {
      const itemData = item?.notification?.data || {};
      const sameMessage = data.message_id && String(itemData.message_id || '') === String(data.message_id);
      const genericTwin = itemData.type === 'chat_message'
        && !itemData.message_id
        && !itemData.title
        && !itemData.body
        && !itemData.message;
      if (!sameMessage && !genericTwin && item?.id !== notification?.id) return;
      if (item?.id) {
        await notifee.cancelNotification(item.id, item?.notification?.android?.tag);
      }
    }));
  } catch {
    // The swiped notification is already gone.
  }

  refreshNotificationInbox();
};

const notifyAbnormalAssignmentReceived = (remoteMessage) => {
  const data = remoteMessage?.data || {};
  if (data.type !== 'abnormal_assignment') return;
  emitAbnormalAssignmentReceived(data);
};

const routeNotificationPress = async (remoteMessage, handlers = {}, notification = null) => {
  if (notification) {
    await dismissOpenedNotification(notification);
  }

  const data = remoteMessage?.data || remoteMessage?.notification?.data || {};

  if (data.type === 'chat_message' && data.from_user_id) {
    const fromUserId = String(data.from_user_id);
    setPendingChatOpenUserId(fromUserId);
    if (typeof handlers.onOpenChat === 'function') {
      handlers.onOpenChat(fromUserId);
    }
    return;
  }

  if (data.type === 'abnormal_assignment') {
    emitAbnormalAssignmentReceived(data);
    setPendingAbnormalReviewsOpen();
    if (typeof handlers.onOpenAssignedReviews === 'function') {
      handlers.onOpenAssignedReviews({
        practiceId: data.practice_id,
        patientId: data.patient_id,
        vitalType: data.vital_type,
        measurementId: data.measurement_id,
      });
    }
  }
};

export const captureInitialNotificationIntent = async () => {
  try {
    const [fcmInitial, notifeeInitial] = await Promise.all([
      messaging().getInitialNotification(),
      notifee.getInitialNotification(),
    ]);

    const fcmData = fcmInitial?.data;
    const notifeeData = notifeeInitial?.notification?.data;

    if (fcmData?.type === 'chat_message' && fcmData.from_user_id) {
      setPendingChatOpenUserId(fcmData.from_user_id);
      return;
    }

    if (notifeeData?.type === 'chat_message' && notifeeData.from_user_id) {
      setPendingChatOpenUserId(notifeeData.from_user_id);
      return;
    }

    if (fcmData?.type === 'abnormal_assignment') {
      setPendingAbnormalReviewsOpen();
      return;
    }

    if (notifeeData?.type === 'abnormal_assignment') {
      setPendingAbnormalReviewsOpen();
    }
  } catch (error) {
    console.warn('[push] failed to capture initial notification:', error?.message || error);
  }
};

export const registerPushTokenWithBackend = async (attempt = 1) => {
  try {
    const androidOk = await ensureAndroidNotificationPermission();
    const iosOk = await ensureIosNotificationPermission();
    if (!androidOk || !iosOk) {
      console.warn('[push] notification permission denied');
      return null;
    }

    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }

    const token = await messaging().getToken();
    if (!token) {
      console.warn('[push] FCM token was empty');
      return null;
    }

    const result = await apiService.registerPushToken({
      fcm_token: token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });

    if (!result?.success) {
      throw new Error(result?.message || 'Backend rejected push token registration');
    }

    return token;
  } catch (error) {
    console.warn(`[push] failed to register token (attempt ${attempt}):`, error?.message || error);
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      return registerPushTokenWithBackend(attempt + 1);
    }
    return null;
  }
};

export const unregisterPushTokenFromBackend = async () => {
  try {
    const token = await messaging().getToken();
    if (token) {
      await apiService.unregisterPushToken({ fcm_token: token });
    }
    await messaging().deleteToken();
  } catch (error) {
    console.warn('[push] failed to unregister token:', error?.message || error);
  }
};

export const initializePushNotifications = async (handlers = {}) => {
  await ensureNotificationChannels();

  const unsubscribeForegroundEvent = notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.DISMISSED) {
      handleNotificationDismissed(detail?.notification);
      return;
    }
    if (type !== EventType.PRESS) return;
    routeNotificationPress(
      { data: detail?.notification?.data || {} },
      handlers,
      detail?.notification,
    );
  });

  const unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
    await displayRemoteNotification(remoteMessage, { isForeground: true });
    notifyAbnormalAssignmentReceived(remoteMessage);
  });

  const unsubscribeOpenedApp = messaging().onNotificationOpenedApp((remoteMessage) => {
    routeNotificationPress(remoteMessage, handlers, remoteMessage?.notification);
  });

  const unsubscribeTokenRefresh = messaging().onTokenRefresh(async () => {
    await registerPushTokenWithBackend();
  });

  await registerPushTokenWithBackend();

  return () => {
    unsubscribeForegroundEvent();
    unsubscribeOnMessage();
    unsubscribeOpenedApp();
    unsubscribeTokenRefresh();
  };
};

export const handleNotificationBackgroundEvent = async ({ type, detail }) => {
  if (type === EventType.DISMISSED) {
    await handleNotificationDismissed(detail?.notification);
  }
};

export const handleBackgroundMessage = async (remoteMessage) => {
  notifyAbnormalAssignmentReceived(remoteMessage);
  await displayRemoteNotification(remoteMessage, { isForeground: false });
};
