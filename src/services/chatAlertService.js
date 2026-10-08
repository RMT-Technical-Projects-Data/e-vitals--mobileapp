import { AppState, Platform } from 'react-native';
import { io } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../config/api';
import { isChatScreenFocused } from './chatPresence';
import { showLocalChatNotification } from './pushNotificationService';
import { getUnreadMessageCount, refreshUnreadMessageCount, setUnreadMessageCount } from '../utils/unreadMessageCount';

let socket = null;
let currentUserId = null;
const recentMessageIds = new Set();

const rememberMessage = (messageId) => {
  if (messageId == null || messageId === '') return false;
  const id = String(messageId);
  if (recentMessageIds.has(id)) return true;
  recentMessageIds.add(id);
  if (recentMessageIds.size > 200) {
    const oldest = recentMessageIds.values().next().value;
    recentMessageIds.delete(oldest);
  }
  return false;
};

const previewForMessage = (message) => {
  const text = String(message?.message || '').replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 180);
  if (message?.file_path || message?.original_file_name) return 'Sent an attachment';
  return 'Sent a message';
};

const shouldPostSystemAlert = (fromUserId) => {
  if (AppState.currentState !== 'active') return true;
  return !isChatScreenFocused();
};

const handleIncomingMessage = (message) => {
  if (!message || !currentUserId) return;

  const fromId = String(message.from_user_id ?? '');
  const toId = String(message.to_user_id ?? '');
  if (!fromId || toId !== currentUserId || fromId === currentUserId) return;
  if (rememberMessage(message.id)) return;
  setUnreadMessageCount(getUnreadMessageCount() + 1);
  refreshUnreadMessageCount().catch(() => {});
  if (Platform.OS === 'ios') return;
  if (!shouldPostSystemAlert(fromId)) return;

  const senderName = message.sender_name || message.from_user_name || 'New message';
  showLocalChatNotification({
    fromUserId: fromId,
    title: senderName,
    body: previewForMessage(message),
    messageId: message.id,
  }).catch(() => {});
};

export const startChatAlerts = (userId) => {
  const id = userId == null ? '' : String(userId);
  if (!id) return;
  if (socket && currentUserId === id) {
    if (!socket.connected) socket.connect();
    return;
  }

  stopChatAlerts();
  currentUserId = id;

  socket = io(SOCKET_BASE_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
  });

  const join = () => {
    socket.emit('join-chat', id);
  };

  socket.on('connect', join);
  socket.on('receive_message', handleIncomingMessage);
  socket.on('receive-message', handleIncomingMessage);
};

export const stopChatAlerts = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentUserId = null;
};
