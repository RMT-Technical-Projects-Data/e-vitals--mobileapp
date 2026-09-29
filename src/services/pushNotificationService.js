import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import apiService from './apiService';
import { getActiveChatUserId } from '../utils/activeChatState';
import { setPendingChatOpenUserId } from '../utils/pendingChatNavigation';

const CHAT_CHANNEL_ID = 'chat_messages';

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

const ensureNotificationChannel = async () => {
  if (Platform.OS !== 'android') return;

  await notifee.createChannel({
    id: CHAT_CHANNEL_ID,
    name: 'Chat Messages',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
};

const normalizePayload = (remoteMessage) => {
  const data = remoteMessage?.data || {};
  const notification = remoteMessage?.notification || {};
  return {
    title: notification.title || data.title || 'New message',
    body: notification.body || data.body || data.message || 'You have a new chat message',
    data,
  };
};

const shouldSkipNotification = (data) => (
  data.type === 'chat_message'
  && data.from_user_id
  && getActiveChatUserId() === String(data.from_user_id)
);

const displayChatNotification = async (remoteMessage) => {
  const { title, body, data } = normalizePayload(remoteMessage);

  if (shouldSkipNotification(data)) {
    return;
  }

  await ensureNotificationChannel();

  const notificationId = data.message_id
    ? `chat-${data.message_id}`
    : `chat-${data.from_user_id || 'unknown'}-${Date.now()}`;

  await notifee.displayNotification({
    id: notificationId,
    title,
    body,
    data,
    android: {
      channelId: CHAT_CHANNEL_ID,
      pressAction: { id: 'default' },
      smallIcon: 'ic_notification',
      tag: notificationId,
    },
  });
};

const queueChatNavigation = (remoteMessage, onOpenChat) => {
  const data = remoteMessage?.data || remoteMessage?.notification?.data || {};
  if (data.type !== 'chat_message' || !data.from_user_id) {
    return;
  }

  const fromUserId = String(data.from_user_id);
  setPendingChatOpenUserId(fromUserId);

  if (typeof onOpenChat === 'function') {
    onOpenChat(fromUserId);
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

export const initializePushNotifications = async (onOpenChat) => {
  await ensureNotificationChannel();

  const unsubscribeForegroundEvent = notifee.onForegroundEvent(({ type, detail }) => {
    if (type !== EventType.PRESS) return;
    queueChatNavigation({ data: detail?.notification?.data || {} }, onOpenChat);
  });

  const unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
    await displayChatNotification(remoteMessage);
  });

  const unsubscribeOpenedApp = messaging().onNotificationOpenedApp((remoteMessage) => {
    queueChatNavigation(remoteMessage, onOpenChat);
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

export const handleBackgroundMessage = async (remoteMessage) => {
  if (remoteMessage?.notification) {
    return;
  }

  await displayChatNotification(remoteMessage);
};
