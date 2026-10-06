/**
 * ChatScreen.js â€” Real-Time Chat System
 *
 * Requirements Met:
 *  1. Caregiver cannot chat with Caregiver (or System Caregiver).
 *  2. Provider cannot chat with Provider.
 *  3. Patient cannot chat with Patient.
 *  4. New Conversation Modal opens centered in the middle of the screen (fade animation).
 *  5. Keyboard does NOT open automatically when modal is shown (removed autoFocus).
 *  6. Centered Messages header and subtitle.
 *  7. WhatsApp-style FAB '+' icon on bottom-right.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  Linking,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { io } from 'socket.io-client';
import { pick, keepLocalCopy, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import apiService from '../../services/apiService';
import { formatLastFirstName } from '../../utils/formatPersonName';
import { API_CONFIG, SOCKET_BASE_URL } from '../../config/api';
import { setActiveChatPeer, setChatScreenFocused } from '../../services/chatPresence';
import PremiumBottomNav, { PREMIUM_BOTTOM_NAV_CLEARANCE } from '../../components/navigation/PremiumBottomNav';
import { setActiveChatUserId } from '../../utils/activeChatState';
import { dismissChatNotifications } from '../../utils/notificationInbox';
import useVoiceMessageRecorder from '../../hooks/useVoiceMessageRecorder';
import useVoiceMessagePlayer from '../../hooks/useVoiceMessagePlayer';
import VoiceMessageBubble from '../../components/chat/VoiceMessageBubble';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleHeight = (size) => Math.min((height / guidelineBaseHeight) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

const SCREEN_BG_COLORS = ['#ffffff', '#ffffff', '#ffffff'];
const CHAT_BG = '#ffffff';
const TEXT_DARK = '#0b1f3f';
const TEXT_MUTED = '#687382';
const ACCENT_COLOR = '#0b1f3f';

// â”€â”€â”€ Role Definitions & Permissible Matrix â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ROLES = {
  SUPER_ADMIN: 1,
  SYSTEM_ADMIN: 2,
  PRACTICE_ADMIN: 3,
  PROVIDER: 4,
  CAREGIVER: 5,
  PATIENT: 6,
  SYSTEM_CAREGIVER: 7,
};

const resolveUserRoleId = (user) => {
  if (user?.role_id != null && Number(user.role_id) > 0) {
    return Number(user.role_id);
  }
  const name = String(user?.role_name || user?.role || '').toLowerCase();
  if (name.includes('provider') || name.includes('doctor') || name.includes('physician')) return ROLES.PROVIDER;
  if (name.includes('system caregiver') || name.includes('system_caregiver')) return ROLES.SYSTEM_CAREGIVER;
  if (name.includes('caregiver')) return ROLES.CAREGIVER;
  if (name.includes('patient')) return ROLES.PATIENT;
  if (name.includes('practice admin')) return ROLES.PRACTICE_ADMIN;
  if (name.includes('system admin')) return ROLES.SYSTEM_ADMIN;
  if (name.includes('super admin')) return ROLES.SUPER_ADMIN;
  return ROLES.PATIENT;
};

const resolveRoleLabel = (roleInput) => {
  let roleId = 0;
  if (typeof roleInput === 'number') {
    roleId = roleInput;
  } else {
    roleId = resolveUserRoleId({ role_name: String(roleInput || '') });
  }

  switch (roleId) {
    case ROLES.SUPER_ADMIN: return 'Super Admin';
    case ROLES.SYSTEM_ADMIN: return 'System Admin';
    case ROLES.PRACTICE_ADMIN: return 'Practice Admin';
    case ROLES.PROVIDER: return 'Provider';
    case ROLES.CAREGIVER: return 'Caregiver';
    case ROLES.PATIENT: return 'Patient';
    case ROLES.SYSTEM_CAREGIVER: return 'System Caregiver';
    default: return 'Care team';
  }
};

const getAllowedRecipientRoleIds = (senderRoleId) => {
  const sender = Number(senderRoleId);
  switch (sender) {
    case ROLES.SUPER_ADMIN:
      return [ROLES.SYSTEM_ADMIN, ROLES.PRACTICE_ADMIN, ROLES.SYSTEM_CAREGIVER];
    case ROLES.SYSTEM_ADMIN:
      return [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.PRACTICE_ADMIN, ROLES.SYSTEM_CAREGIVER, ROLES.PROVIDER, ROLES.CAREGIVER];
    case ROLES.PRACTICE_ADMIN:
      return [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.SYSTEM_CAREGIVER, ROLES.PROVIDER, ROLES.CAREGIVER, ROLES.PATIENT];
    case ROLES.SYSTEM_CAREGIVER:
      return [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.PRACTICE_ADMIN, ROLES.PATIENT];
    case ROLES.PROVIDER:
      return [ROLES.PRACTICE_ADMIN, ROLES.CAREGIVER, ROLES.PATIENT];
    case ROLES.CAREGIVER:
      return [ROLES.PRACTICE_ADMIN, ROLES.PROVIDER, ROLES.PATIENT];
    case ROLES.PATIENT:
      return [ROLES.CAREGIVER, ROLES.PROVIDER, ROLES.SYSTEM_CAREGIVER];
    default:
      return [];
  }
};

const isUserAllowedToChat = (senderUser, recipientUser) => {
  if (!senderUser || !recipientUser) return false;

  const senderId = Number(senderUser.id);
  const recipientId = Number(recipientUser.id);
  if (senderId && recipientId && senderId === recipientId) return false; // Cannot chat with self

  const senderRole = resolveUserRoleId(senderUser);
  const recipientRole = resolveUserRoleId(recipientUser);

  // Caregiver and Caregiver CANNOT chat
  if (
    (senderRole === ROLES.CAREGIVER || senderRole === ROLES.SYSTEM_CAREGIVER) &&
    (recipientRole === ROLES.CAREGIVER || recipientRole === ROLES.SYSTEM_CAREGIVER)
  ) {
    return false;
  }

  // Provider and Provider CANNOT chat
  if (senderRole === ROLES.PROVIDER && recipientRole === ROLES.PROVIDER) {
    return false;
  }

  // Patient and Patient CANNOT chat
  if (senderRole === ROLES.PATIENT && recipientRole === ROLES.PATIENT) {
    return false;
  }

  const allowedRecipientRoles = getAllowedRecipientRoleIds(senderRole);
  return allowedRecipientRoles.includes(recipientRole);
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const getInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const formatListTime = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatMessageTime = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const formatDateSeparator = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

const isSameDay = (isoA, isoB) => {
  if (!isoA || !isoB) return false;
  return new Date(isoA).toDateString() === new Date(isoB).toDateString();
};

// â”€â”€â”€ Fallbacks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const getFallbackContacts = (userRoleId) => {
  if (userRoleId === ROLES.PATIENT) {
    return [
      { id: 'mock-caregiver', name: 'Sarah Mitchell', role_id: ROLES.CAREGIVER, role_name: 'Caregiver', lastMessage: 'Your latest vitals look stable.', lastMessageTime: new Date().toISOString() },
      { id: 'mock-provider', name: 'Dr. James Carter', role_id: ROLES.PROVIDER, role_name: 'Provider', lastMessage: "Please upload today's blood pressure reading.", lastMessageTime: new Date(Date.now() - 3600000).toISOString() },
    ];
  }
  return [
    { id: 'mock-patient-1', name: 'Cyrus Nguyen', role_id: ROLES.PATIENT, role_name: 'Patient', lastMessage: 'I uploaded my glucose reading.', lastMessageTime: new Date().toISOString() },
    { id: 'mock-patient-2', name: 'Anna Lee', role_id: ROLES.PATIENT, role_name: 'Patient', lastMessage: 'Can you review my blood pressure trend?', lastMessageTime: new Date(Date.now() - 7200000).toISOString() },
  ];
};

const getFallbackMessages = (contact, currentUser) => {
  const contactName = contact?.name || 'Care team';
  const userRoleId = resolveUserRoleId(currentUser);
  if (userRoleId === ROLES.PATIENT) {
    return [
      { id: 'm1', from_user_id: contact.id, to_user_id: currentUser?.id, message: `Hello, this is ${contactName}. How can I help with your care plan today?`, created_at: new Date(Date.now() - 7200000).toISOString() },
      { id: 'm2', from_user_id: currentUser?.id, to_user_id: contact.id, message: 'I wanted to ask about my latest readings.', created_at: new Date(Date.now() - 7000000).toISOString() },
      { id: 'm3', from_user_id: contact.id, to_user_id: currentUser?.id, message: 'I reviewed them and everything looks on track. Keep uploading daily.', created_at: new Date(Date.now() - 6800000).toISOString() },
    ];
  }
  return [
    { id: 'm1', from_user_id: contact.id, to_user_id: currentUser?.id, message: 'Hi, I uploaded my vitals this morning.', created_at: new Date(Date.now() - 5400000).toISOString() },
    { id: 'm2', from_user_id: currentUser?.id, to_user_id: contact.id, message: 'Thanks, I will review your readings shortly.', created_at: new Date(Date.now() - 5200000).toISOString() },
  ];
};

// â”€â”€â”€ Chat List Builder (Active Conversations) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const buildChatList = (conversations = [], currentUser = null) => {
  const map = new Map();

  conversations.forEach((conv) => {
    const otherId = conv.other_user_id;
    if (!otherId) return;

    const roleId = conv.other_user_role_id || conv.role_id || null;
    const roleName = conv.other_user_role_name || conv.role_name || '';

    // Filter by strict role matrix
    if (currentUser && !isUserAllowedToChat(currentUser, { id: otherId, role_id: roleId, role_name: roleName })) {
      return;
    }

    map.set(String(otherId), {
      id: otherId,
      conversationId: conv.id || conv.conversation_id || null,
      name: conv.other_user_name || 'Unknown User',
      role_id: roleId,
      role_name: roleName || resolveRoleLabel(roleId),
      lastMessage: getMessagePreview(conv),
      lastMessageDeleted: isDeletedForEveryone(conv),
      lastMessageTime: isMessageRemoved(conv) ? null : conv.created_at,
      unread: Number(conv.unread_count || 0),
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return timeB - timeA;
  });
};

const CHAT_FILE_EXTENSIONS = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx'];
const CHAT_FILE_MIME_BY_EXTENSION = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024;

const isAudioMessage = (item) => (
  item?.message_type === 'audio' || String(item?.file_type || '').startsWith('audio/')
);

const fileExtension = (name) => {
  const base = String(name || '').toLowerCase().split('?')[0];
  const parts = base.split('.');
  return parts.length > 1 ? parts.pop() : '';
};

const CHAT_EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

const resolveChatFileMime = (file) => {
  const fromExtension = CHAT_FILE_MIME_BY_EXTENSION[fileExtension(file?.name)];
  const fromType = String(file?.type || '').toLowerCase();
  if (fromType === 'image/jpg' || fromType === 'image/pjpeg') return 'image/jpeg';
  if (fromExtension && (!fromType || fromType === 'application/octet-stream' || fromType === 'image/*')) {
    return fromExtension;
  }
  return fromType || fromExtension || 'application/octet-stream';
};

const ensureChatFileName = (name, mimeType) => {
  const fallback = `attachment-${Date.now()}`;
  const safe = String(name || fallback).replace(/[\\/:*?"<>|]/g, '_').trim() || fallback;
  if (CHAT_FILE_EXTENSIONS.includes(fileExtension(safe))) return safe;
  const extension = CHAT_EXTENSION_BY_MIME[mimeType] || 'jpg';
  return `${safe}.${extension}`;
};

const isAllowedChatFile = (file) => {
  const ext = fileExtension(file?.name);
  if (CHAT_FILE_EXTENSIONS.includes(ext)) return true;
  const mime = String(file?.type || '').toLowerCase();
  return (
    mime === 'image/jpeg'
    || mime === 'image/jpg'
    || mime === 'image/pjpeg'
    || mime === 'image/png'
    || mime === 'image/gif'
    || mime === 'image/webp'
    || mime === 'application/pdf'
    || mime === 'application/msword'
    || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
};

const IMAGE_FILE_EXTENSIONS = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'heic', 'heif'];

const isImageAttachment = (item) => {
  if (isAudioMessage(item)) return false;
  const mime = String(item?.file_type || '').toLowerCase();
  if (
    mime.startsWith('image/')
    || mime === 'public.jpeg'
    || mime === 'public.png'
    || mime === 'public.gif'
    || mime === 'public.heic'
    || mime === 'public.heif'
  ) return true;
  return IMAGE_FILE_EXTENSIONS.includes(
    fileExtension(item?.original_file_name || item?.file_path)
  );
};

const resolveChatFileUrl = (filePath) => {
  if (!filePath) return null;
  const raw = String(filePath).trim();
  if (/^(https?|file|content):/i.test(raw)) return raw;
  const origin = String(API_CONFIG.BASE_URL || '').replace(/\/api\/?$/, '');
  if (raw.startsWith('/uploads/')) return `${origin}/api${raw}`;
  if (raw.startsWith('uploads/')) return `${origin}/api/${raw}`;
  if (raw.startsWith('/')) return `${origin}${raw}`;
  return `${origin}/api/uploads/chat/${raw}`;
};

const DELETE_FOR_EVERYONE_WINDOW_MS = 10 * 60 * 1000;
const DELETED_MESSAGE_LABEL = 'This message was deleted';

const isDeletedForEveryone = (item) => {
  if (!item) return false;
  if (item.deleted_for_everyone_at) return true;
  if (item.deleted_for_everyone === true || item.deleted_for_everyone === 1 || item.deleted_for_everyone === '1') return true;
  const text = String(item.message ?? '').trim().toLowerCase();
  return text === 'this message was deleted' || text === 'message deleted';
};

const isWithinDeleteForEveryoneWindow = (createdAt) => {
  if (!createdAt) return false;
  const createdMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs <= DELETE_FOR_EVERYONE_WINDOW_MS;
};

const getMessagePreview = (msg) => {
  if (isDeletedForEveryone(msg)) return DELETED_MESSAGE_LABEL;
  if (isMessageRemoved(msg)) return '';
  if (isAudioMessage(msg)) return 'Voice message';
  const text = String(msg?.message || '').trim();
  if (text) return text;
  if (msg?.file_path || msg?.original_file_name) {
    return msg.original_file_name || 'Attachment';
  }
  return '';
};

const mergeServerMessages = (prev, incoming) => {
  const server = (incoming || []).filter((message) => !isDeletedForEveryone(message) && !isMessageRemoved(message));
  const serverIds = new Set(server.map((message) => String(message.id)));
  const pending = (prev || []).filter((message) => message?._pending && !serverIds.has(String(message.id)));
  return pending.length ? [...server, ...pending] : server;
};

const isMessageRemoved = (item) => {
  if (!item || item._pending) return false;
  if (isDeletedForEveryone(item)) return true;
  if (item.is_deleted === true || item.is_deleted === 1 || item.is_deleted === '1') return true;
  if (item.deleted === true || item.deleted === 1 || item.deleted === '1') return true;
  const text = String(item.message ?? '').trim();
  if (text) return false;
  if (item.file_path || item.original_file_name) return false;
  if (isAudioMessage(item)) return false;
  return true;
};

const formatRecordingDuration = (durationMs) => {
  const totalSeconds = Math.max(0, Math.floor((Number(durationMs) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ChatScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState('list');
  const [currentUser, setCurrentUser] = useState(null);
  const [userRoleId, setUserRoleId] = useState(ROLES.PATIENT);
  const [chatList, setChatList] = useState([]);
  const [conversationFilter, setConversationFilter] = useState('all'); // 'all' | 'unread'
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [loadingAudioMessageId, setLoadingAudioMessageId] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const {
    isRecording,
    durationMs: recordingDurationMs,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceMessageRecorder();

  const {
    activeMessageId,
    isPlaying,
    currentMs,
    durationMs: playbackDurationMs,
    playMessage,
    stopPlayback,
  } = useVoiceMessagePlayer();

  // Unread badge
  const [unreadCount, setUnreadCount] = useState(0);

  // Typing indicator
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  const typingTimeout = useRef(null);
  const myTypingTimeout = useRef(null);
  const isTypingEmitted = useRef(false);

  // Edit / Delete
  const [actionMsg, setActionMsg] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState(null);
  const [deleteDialogError, setDeleteDialogError] = useState('');
  const [deletingMessages, setDeletingMessages] = useState(false);
  const [deleteWindowTick, setDeleteWindowTick] = useState(0);
  const [selectedChatIds, setSelectedChatIds] = useState([]);
  const [pendingDeleteChatIds, setPendingDeleteChatIds] = useState(null);
  const [deletingChats, setDeletingChats] = useState(false);
  const [deleteChatError, setDeleteChatError] = useState('');
  const [deleteChatBody, setDeleteChatBody] = useState('');

  // New Chat Modal state
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalRoleTab, setModalRoleTab] = useState('all');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingAvailableUsers, setLoadingAvailableUsers] = useState(false);

  // In-app notification banner
  const [notifBanner, setNotifBanner] = useState(null);
  const bannerAnim = useRef(new Animated.Value(-80)).current;
  const bannerTimer = useRef(null);

  const socketRef = useRef(null);
  const messagesRef = useRef(null);
  const selectedContactRef = useRef(null);
  const currentUserRef = useRef(null);
  const handledPushNonceRef = useRef(null);
  const viewRef = useRef(view);
  const selectedMessageIdsRef = useRef(selectedMessageIds);
  const selectedChatIdsRef = useRef(selectedChatIds);
  const routeRef = useRef(route);
  const returnToMessageListRef = useRef(() => {});
  const closeChatRef = useRef(() => {});
  const handledMessagesRootRef = useRef(null);
  const iosChatBackSwipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (Platform.OS !== 'ios' || viewRef.current !== 'chat') return false;
        return gesture.x0 <= 28 && gesture.dx > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < 70) return;
        if (selectedMessageIdsRef.current.length) {
          setSelectedMessageIds([]);
          return;
        }
        closeChatRef.current();
      },
    })
  ).current;

  viewRef.current = view;
  selectedMessageIdsRef.current = selectedMessageIds;
  selectedChatIdsRef.current = selectedChatIds;
  routeRef.current = route;

  useEffect(() => { selectedContactRef.current = selectedContact; }, [selectedContact]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  useEffect(() => () => {
    stopPlayback();
    cancelRecording();
  }, [cancelRecording, stopPlayback]);

  const scrollToBottom = useCallback((animated = false) => {
    requestAnimationFrame(() => {
      messagesRef.current?.scrollToOffset({ offset: 0, animated });
    });
  }, []);

  // â”€â”€ Socket.IO Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const setupSocket = useCallback((userId) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(SOCKET_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-chat', userId);
    });

    const handleIncomingMessage = (msg) => {
      const contact = selectedContactRef.current;
      const me = currentUserRef.current;
      if (!msg || !me) return;

      const fromId = String(msg.from_user_id);
      const toId = String(msg.to_user_id);
      const myId = String(me.id);

      if (fromId !== myId && toId !== myId) return;
      const otherId = fromId === myId ? toId : fromId;

      if (contact && String(contact.id) === otherId) {
        setMessages((prev) => {
          if (isMessageRemoved(msg)) {
            return prev.filter((m) => String(m.id) !== String(msg.id));
          }
          if (prev.some((m) => String(m.id) === String(msg.id))) {
            return prev.map((m) => (String(m.id) === String(msg.id) ? { ...m, ...msg, _pending: false } : m));
          }
          const hasPendingMatching = prev.some(
            (m) =>
              m._pending &&
              String(m.from_user_id) === fromId &&
              String(m.to_user_id) === toId &&
              String(m.message || '') === String(msg.message || '')
          );
          if (hasPendingMatching) {
            let replaced = false;
            return prev.map((m) => {
              if (
                !replaced &&
                m._pending &&
                String(m.from_user_id) === fromId &&
                String(m.to_user_id) === toId &&
                String(m.message || '') === String(msg.message || '')
              ) {
                replaced = true;
                return { ...msg, _pending: false };
              }
              return m;
            });
          }
          return [...prev, msg];
        });
        scrollToBottom(true);
        dismissChatNotifications(otherId);
      } else if (fromId !== myId) {
        const senderName = msg.sender_name || msg.from_user_name || 'New message';
        showBanner({ name: senderName, preview: getMessagePreview(msg) });
        setUnreadCount((n) => n + 1);
      }

      setChatList((prev) => {
        if (isMessageRemoved(msg)) {
          loadChats();
          return prev;
        }
        const existingIndex = prev.findIndex((item) => String(item.id) === otherId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            lastMessage: getMessagePreview(msg),
            lastMessageDeleted: isDeletedForEveryone(msg),
            lastMessageTime: msg.created_at || new Date().toISOString(),
          };
          return updated.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
        }
        loadChats();
        return prev;
      });
    };

    socket.on('receive_message', handleIncomingMessage);
    socket.on('receive-message', handleIncomingMessage);

    socket.on('message_deleted', (payload) => {
      const updated = payload?.message;
      const deletedForEveryone = payload?.mode === 'everyone' || isDeletedForEveryone(updated);
      const ids = new Set(
        [updated?.id, payload?.message_id, ...(payload?.message_ids || [])]
          .filter((id) => id != null)
          .map((id) => String(id))
      );
      if (!ids.size) return;

      if (deletedForEveryone) {
        setMessages((prev) => prev.filter((message) => !ids.has(String(message.id))));
        setSelectedMessageIds((prev) => prev.filter((id) => !ids.has(id)));
        loadChats();
        return;
      }

      const me = currentUserRef.current;
      if (!me || payload?.user_id == null || String(payload.user_id) !== String(me.id)) return;
      setMessages((prev) => prev.filter((message) => !ids.has(String(message.id))));
      setSelectedMessageIds((prev) => prev.filter((id) => !ids.has(id)));
      loadChats();
    });

    socket.on('typing', (data) => {
      const contact = selectedContactRef.current;
      if (contact && String(data.from_user_id) === String(contact.id)) {
        setPeerIsTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setPeerIsTyping(false), 3000);
      }
    });

    socket.on('stop_typing', (data) => {
      const contact = selectedContactRef.current;
      if (contact && String(data.from_user_id) === String(contact.id)) {
        setPeerIsTyping(false);
      }
    });

    socket.on('disconnect', () => { });
    socket.on('connect_error', () => { });
  }, [scrollToBottom, loadChats]);

  // â”€â”€ Banner Notification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const showBanner = (data) => {
    setNotifBanner(data);
    Animated.spring(bannerAnim, { toValue: 0, useNativeDriver: true }).start();
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => {
      Animated.timing(bannerAnim, { toValue: -80, duration: 300, useNativeDriver: true }).start(() => setNotifBanner(null));
    }, 3500);
  };

  // â”€â”€ Emit Typing Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleInputChange = (text) => {
    setInput(text);
    if (!socketRef.current || !currentUser || !selectedContact) return;

    if (!isTypingEmitted.current) {
      socketRef.current.emit('typing', { from_user_id: currentUser.id, to_user_id: selectedContact.id });
      isTypingEmitted.current = true;
    }
    if (myTypingTimeout.current) clearTimeout(myTypingTimeout.current);
    myTypingTimeout.current = setTimeout(() => {
      socketRef.current?.emit('stop_typing', { from_user_id: currentUser.id, to_user_id: selectedContact.id });
      isTypingEmitted.current = false;
    }, 2000);
  };

  // â”€â”€ Load Active Conversations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadChats = useCallback(async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) throw new Error('No user');
      const user = JSON.parse(userStr);
      const roleId = resolveUserRoleId(user);
      const userId = user.id;
      const practiceId = user.practice_id || (await AsyncStorage.getItem('practiceId'));

      setCurrentUser(user);
      setUserRoleId(roleId);

      if (!userId || !practiceId) throw new Error('Missing user or practice');

      setupSocket(userId);

      const [conversationsRes, unreadRes] = await Promise.allSettled([
        apiService.getChatConversations(userId),
        apiService.getChatUnreadCount(userId),
      ]);

      const conversations = conversationsRes.status === 'fulfilled' ? (conversationsRes.value?.data || []) : [];

      if (unreadRes.status === 'fulfilled') {
        setUnreadCount(Number(unreadRes.value?.data?.count || 0));
      }

      setChatList(buildChatList(conversations, user));
      setUsingFallback(false);
    } catch (error) {
      console.warn('Chat list fallback:', error?.message);
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const roleId = resolveUserRoleId(user);
      setCurrentUser(user);
      setUserRoleId(roleId);
      setChatList(getFallbackContacts(roleId).filter((c) => isUserAllowedToChat(user, c)));
      setUsingFallback(true);
    } finally {
      setLoadingList(false);
    }
  }, [setupSocket]);

  // â”€â”€ Load Messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadMessages = useCallback(async (contact) => {
    if (!contact || !currentUser) return;
    setPeerIsTyping(false);
    setLoadingMessages(true);
    try {
      if (usingFallback || String(contact.id).startsWith('mock-')) {
        setMessages(getFallbackMessages(contact, currentUser));
        return;
      }

      const result = await apiService.getChatMessages(currentUser.id, contact.id);
      setMessages((prev) => mergeServerMessages(prev, result?.data));
      setChatList((prev) => {
        const openedUnread = Number(
          prev.find((item) => String(item.id) === String(contact.id))?.unread || 0
        );
        if (openedUnread > 0) {
          setUnreadCount((count) => Math.max(0, Number(count || 0) - openedUnread));
        }
        return prev.map((item) => (
          String(item.id) === String(contact.id) ? { ...item, unread: 0 } : item
        ));
      });
    } catch (error) {
      console.warn('Message history fallback:', error?.message);
      setMessages(getFallbackMessages(contact, currentUser));
    } finally {
      setLoadingMessages(false);
    }
  }, [currentUser, usingFallback]);

  useFocusEffect(
    useCallback(() => {
      const params = routeRef.current?.params || {};
      const openingSpecificChat = Boolean(params.openUserId)
        || (params.peerUserId != null && params.pushNonce != null);
      if (!openingSpecificChat) {
        returnToMessageListRef.current();
      }

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (viewRef.current === 'chat') {
          if (selectedMessageIdsRef.current.length) {
            setSelectedMessageIds([]);
            return true;
          }
          closeChatRef.current();
          return true;
        }
        if (selectedChatIdsRef.current.length) {
          setSelectedChatIds([]);
          return true;
        }
        return false;
      });

      return () => subscription.remove();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      setChatScreenFocused(true);
      setLoadingList(true);
      loadChats();
      const interval = setInterval(() => {
        const me = currentUserRef.current;
        const contact = selectedContactRef.current;
        if (me?.id) {
          if (contact?.id) {
            apiService.getChatMessages(me.id, contact.id).then((res) => {
              if (Array.isArray(res?.data)) {
                setMessages((prev) => mergeServerMessages(prev, res.data));
              }
            }).catch(() => null);
          }
          apiService.getChatConversations(me.id).then((res) => {
            if (Array.isArray(res?.data)) setChatList(buildChatList(res.data, me));
          }).catch(() => null);
        }
      }, 3500);

      return () => {
        clearInterval(interval);
        setChatScreenFocused(false);
        setActiveChatPeer(null);
      };
    }, [loadChats])
  );

  useEffect(() => {
    if (view === 'chat' && selectedContact) loadMessages(selectedContact);
  }, [view, selectedContact, loadMessages]);

  useEffect(() => {
    return () => {
      setActiveChatUserId(null);
      socketRef.current?.disconnect();
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (myTypingTimeout.current) clearTimeout(myTypingTimeout.current);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, []);

  // â”€â”€ Open / Close Conversation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openChat = (contact) => {
    setSelectedContact(contact);
    setActiveChatUserId(contact?.id);
    setActiveChatPeer(contact?.id);
    setMessages([]);
    setLoadingMessages(true);
    setView('chat');
    setEditingId(null);
    setEditText('');
    setSelectedMessageIds([]);
    setPendingDeleteIds(null);
    dismissChatNotifications(contact?.id);
  };

  useEffect(() => {
    setActiveChatPeer(view === 'chat' ? selectedContact?.id : null);
  }, [view, selectedContact]);

  useEffect(() => {
    const peerUserId = route.params?.peerUserId;
    const nonce = route.params?.pushNonce;
    if (!peerUserId || nonce == null) return;
    if (handledPushNonceRef.current === nonce) return;
    if (loadingList && chatList.length === 0) return;

    const existing = chatList.find((item) => String(item.id) === String(peerUserId));
    handledPushNonceRef.current = nonce;
    openChat(existing || {
      id: peerUserId,
      name: route.params?.peerName || 'New message',
      role_name: '',
      lastMessage: '',
      lastMessageTime: null,
      unread: 0,
    });
  }, [route.params?.peerUserId, route.params?.peerName, route.params?.pushNonce, chatList, loadingList]);

  const returnToMessageList = () => {
    socketRef.current?.emit('stop_typing', { from_user_id: currentUser?.id, to_user_id: selectedContact?.id });
    setActiveChatUserId(null);
    setView('list');
    setSelectedContact(null);
    setMessages([]);
    setInput('');
    setEditingId(null);
    setEditText('');
    setSelectedMessageIds([]);
    setPendingDeleteIds(null);
    setPeerIsTyping(false);
  };

  const closeChat = () => {
    returnToMessageList();
    loadChats();
  };

  returnToMessageListRef.current = returnToMessageList;
  closeChatRef.current = closeChat;

  useEffect(() => {
    const openUserId = route?.params?.openUserId;
    if (!openUserId || !chatList.length) return;

    const contact = chatList.find((chat) => String(chat.id) === String(openUserId));
    if (contact) {
      openChat(contact);
      navigation.setParams({ openUserId: undefined });
    }
  }, [route?.params?.openUserId, chatList, navigation]);

  useEffect(() => {
    const token = route.params?.messagesRoot;
    if (token == null || handledMessagesRootRef.current === token) return;
    handledMessagesRootRef.current = token;
    if (route.params?.openUserId || (route.params?.peerUserId != null && route.params?.pushNonce != null)) {
      return;
    }
    closeChatRef.current();
  }, [route.params?.messagesRoot, route.params?.openUserId, route.params?.peerUserId, route.params?.pushNonce]);

  // â”€â”€ New Chat Modal Trigger & Selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openNewChatModal = async () => {
    setIsNewChatModalOpen(true);
    setModalSearchQuery('');
    setModalRoleTab('all');
    setLoadingAvailableUsers(true);
    try {
      const userStr = await AsyncStorage.getItem('user');
      const activeUser = currentUser || (userStr ? JSON.parse(userStr) : null);
      const practiceId = activeUser?.practice_id || (await AsyncStorage.getItem('practiceId')) || 1;

      const res = await apiService.getChatAvailableUsers(practiceId, activeUser?.id || 0);

      // Filter available contacts strictly using the sender-recipient role matrix & exclusion rules
      const list = (res?.data || [])
        .filter((u) => isUserAllowedToChat(activeUser, u))
        .map((u) => ({
          id: u.id,
          name: formatLastFirstName(u) || u.name || u.username || 'Unknown',
          role_id: u.role_id || resolveUserRoleId(u),
          role_name: u.role_name || u.role || resolveRoleLabel(u.role_id),
        }));
      setAvailableUsers(list);
    } catch (error) {
      console.warn('Failed to load available users for modal:', error);
      const userStr = await AsyncStorage.getItem('user');
      const activeUser = currentUser || (userStr ? JSON.parse(userStr) : null);
      setAvailableUsers(getFallbackContacts(userRoleId).filter((u) => isUserAllowedToChat(activeUser, u)));
    } finally {
      setLoadingAvailableUsers(false);
    }
  };

  const selectUserFromModal = (user) => {
    setIsNewChatModalOpen(false);
    openChat({
      id: user.id,
      name: user.name,
      role_id: user.role_id,
      role_name: user.role_name,
      lastMessage: 'Tap to start a conversation',
      lastMessageTime: null,
      unread: 0,
    });
  };

  const openAttachment = async (item) => {
    if (isImageAttachment(item)) {
      const previewUrl = resolveChatFileUrl(item?.file_path);
      if (previewUrl) setImagePreviewUrl(previewUrl);
      return;
    }
    const url = resolveChatFileUrl(item?.file_path);
    if (!url || /^(file|content):/i.test(url)) return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Attachment', 'Unable to open this file.');
    }
  };

  const handleAttachFile = async () => {
    if (!selectedContact || !currentUser || uploadingFile || uploadingVoice || sending || isRecording) return;

    let optimisticId = null;
    try {
      const [file] = await pick({
        allowMultiSelection: false,
        type: [types.images, types.pdf, types.doc, types.docx],
      });
      if (!file?.uri) return;
      if (!isAllowedChatFile(file)) {
        Alert.alert('Attachment', 'Choose an image, PDF, or Word document.');
        return;
      }
      if (file.size != null && file.size > MAX_CHAT_FILE_BYTES) {
        Alert.alert('Attachment', 'File must be 10 MB or smaller.');
        return;
      }

      const mimeType = resolveChatFileMime(file);
      if (!Object.values(CHAT_FILE_MIME_BY_EXTENSION).includes(mimeType)) {
        Alert.alert('Attachment', 'Choose an image, PDF, or Word document.');
        return;
      }
      const fileName = ensureChatFileName(file.name, mimeType);
      let uploadUri = file.uri;
      if (Platform.OS === 'android' || String(file.uri).startsWith('content://')) {
        const [copy] = await keepLocalCopy({
          files: [{
            uri: file.uri,
            fileName,
            ...(file.isVirtual ? { convertVirtualFileToType: mimeType } : {}),
          }],
          destination: 'cachesDirectory',
        });
        if (copy?.status !== 'success' || !copy.localUri) {
          throw new Error(copy?.copyError || 'Unable to read this image.');
        }
        uploadUri = copy.localUri;
      }
      optimisticId = `temp-file-${Date.now()}`;
      const optimistic = {
        id: optimisticId,
        from_user_id: currentUser.id,
        to_user_id: selectedContact.id,
        message: '',
        file_path: uploadUri,
        file_type: mimeType,
        original_file_name: fileName,
        created_at: new Date().toISOString(),
        is_read: 0,
        _pending: true,
      };

      setUploadingFile(true);
      setMessages((prev) => [...prev, optimistic]);
      scrollToBottom(true);

      const formData = new FormData();
      formData.append('file', {
        uri: uploadUri,
        type: mimeType,
        name: fileName,
      });

      const uploadRes = await apiService.uploadChatFile(formData);
      const uploaded = uploadRes?.data;
      if (!uploaded?.file_path) {
        throw new Error('File upload failed');
      }

      const pId = currentUser.practice_id || (await AsyncStorage.getItem('practiceId')) || null;
      const result = await apiService.sendChatMessage({
        from_user_id: currentUser.id,
        to_user_id: selectedContact.id,
        message: '',
        file_path: uploaded.file_path,
        file_type: uploaded.file_type || mimeType,
        original_file_name: uploaded.original_file_name || fileName,
        practice_id: pId,
      });

      const saved = result?.data || {
        ...optimistic,
        file_path: uploaded.file_path,
        file_type: uploaded.file_type || mimeType,
        original_file_name: uploaded.original_file_name || fileName,
        _pending: false,
      };

      setMessages((prev) => {
        const savedMessage = { ...saved, file_path: saved.file_path || uploaded.file_path, file_type: saved.file_type || mimeType, original_file_name: saved.original_file_name || fileName, _pending: false };
        if (saved?.id != null && prev.some((m) => String(m.id) === String(saved.id) && m.id !== optimisticId)) {
          return prev.filter((m) => m.id !== optimisticId);
        }
        if (!prev.some((m) => m.id === optimisticId)) {
          return [...prev, savedMessage];
        }
        return prev.map((m) => (m.id === optimisticId ? savedMessage : m));
      });

      setChatList((prev) => prev.map((item) =>
        String(item.id) === String(selectedContact.id)
          ? { ...item, lastMessage: getMessagePreview(saved), lastMessageTime: new Date().toISOString() }
          : item
      ));
    } catch (error) {
      const canceled = isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED;
      if (!canceled) {
        Alert.alert('Attachment', error?.message || 'Failed to send the file.');
        if (optimisticId) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        }
      }
    } finally {
      setUploadingFile(false);
    }
  };

  const handleStartVoiceRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      Alert.alert('Microphone', error?.message || 'Unable to start recording.');
    }
  };

  const handleCancelVoiceRecording = async () => {
    try {
      await cancelRecording();
    } catch (error) {
      console.warn('Cancel recording failed:', error);
    }
  };

  const sendVoiceMessage = async () => {
    if (!selectedContact || !currentUser || uploadingVoice || !isRecording) return;

    setUploadingVoice(true);
    try {
      const recording = await stopRecording();
      if (!recording?.uri) {
        throw new Error('No recording found');
      }

      const pId = currentUser.practice_id || (await AsyncStorage.getItem('practiceId')) || null;
      const optimistic = {
        id: `temp-audio-${Date.now()}`,
        from_user_id: currentUser.id,
        to_user_id: selectedContact.id,
        message: 'Voice message',
        message_type: 'audio',
        audio_duration: recording.durationSec,
        created_at: new Date().toISOString(),
        is_read: 0,
        _pending: true,
      };

      setMessages((prev) => [...prev, optimistic]);
      scrollToBottom(true);

      const result = await apiService.uploadChatAudio({
        uri: recording.uri,
        from_user_id: currentUser.id,
        to_user_id: selectedContact.id,
        practice_id: pId,
        audio_duration: recording.durationSec,
      });

      const saved = result?.data || optimistic;
      setMessages((prev) => {
        if (saved?.id != null && prev.some((m) => String(m.id) === String(saved.id))) {
          return prev.filter((m) => m.id !== optimistic.id);
        }
        return prev.map((m) => (m.id === optimistic.id ? { ...saved, _pending: false } : m));
      });

      setChatList((prev) => prev.map((item) =>
        String(item.id) === String(selectedContact.id)
          ? { ...item, lastMessage: 'Voice message', lastMessageTime: new Date().toISOString() }
          : item
      ));
    } catch (error) {
      Alert.alert('Voice message', error?.message || 'Failed to send voice message.');
      setMessages((prev) => prev.filter((m) => !String(m.id).startsWith('temp-audio-')));
      await cancelRecording();
    } finally {
      setUploadingVoice(false);
    }
  };

  const handlePlayAudioMessage = async (message) => {
    if (!message?.id || !currentUser?.id || String(message.id).startsWith('temp-')) return;

    try {
      setLoadingAudioMessageId(message.id);
      const result = await apiService.getChatAudioPlayUrl(message.id, currentUser.id);
      const playUrl = result?.data?.playUrl;
      if (!playUrl) {
        throw new Error('Playback URL unavailable');
      }
      await playMessage(message.id, playUrl, message.audio_duration || 0);
    } catch (error) {
      Alert.alert('Playback', error?.message || 'Unable to play this voice message.');
    } finally {
      setLoadingAudioMessageId(null);
    }
  };

  // â”€â”€ Send Message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !selectedContact || !currentUser || sending) return;

    socketRef.current?.emit('stop_typing', { from_user_id: currentUser.id, to_user_id: selectedContact.id });
    isTypingEmitted.current = false;

    const optimistic = {
      id: `temp-${Date.now()}`,
      from_user_id: currentUser.id,
      to_user_id: selectedContact.id,
      message: text,
      created_at: new Date().toISOString(),
      is_read: 0,
      _pending: true,
    };

    setInput('');
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom(true);
    setSending(true);

    try {
      if (usingFallback || String(selectedContact.id).startsWith('mock-')) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== optimistic.id),
            { ...optimistic, _pending: false },
            { id: `reply-${Date.now()}`, from_user_id: selectedContact.id, to_user_id: currentUser.id, message: 'Thanks for your message. I will review and get back to you shortly.', created_at: new Date().toISOString(), is_read: 0 },
          ]);
          scrollToBottom(true);
        }, 700);
        return;
      }

      const pId = currentUser.practice_id || (await AsyncStorage.getItem('practiceId')) || null;
      const result = await apiService.sendChatMessage({
        from_user_id: currentUser.id,
        to_user_id: selectedContact.id,
        message: text,
        practice_id: pId,
      });

      const saved = result?.data || { ...optimistic, _pending: false };
      setMessages((prev) => {
        if (saved?.id != null && prev.some((m) => String(m.id) === String(saved.id))) {
          return prev.filter((m) => m.id !== optimistic.id);
        }
        return prev.map((m) => (m.id === optimistic.id ? { ...saved, _pending: false } : m));
      });

      setChatList((prev) => prev.map((item) =>
        String(item.id) === String(selectedContact.id)
          ? { ...item, lastMessage: text, lastMessageTime: new Date().toISOString() }
          : item
      ));
    } catch (error) {
      console.error('Send failed:', error);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  // â”€â”€ Edit Message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startEdit = (msg) => {
    setActionMsg(null);
    setSelectedMessageIds([]);
    setPendingDeleteIds(null);
    setEditingId(msg.id);
    setEditText(msg.message || '');
  };

  const commitEdit = async () => {
    if (!editText.trim() || !currentUser) return;
    const id = editingId;
    const newText = editText.trim();
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, message: newText, is_edited: true } : m));
    setEditingId(null);
    setEditText('');
    try {
      await apiService.editChatMessage(id, currentUser.id, newText);
    } catch { }
  };

  const beginMessageSelection = (item) => {
    if (!item || item._pending) return;
    setActionMsg(null);
    setEditingId(null);
    setSelectedMessageIds((prev) => {
      const id = String(item.id);
      return prev.includes(id) ? prev : [...prev, id];
    });
  };

  const toggleMessageSelection = (item) => {
    if (!item || item._pending) return;
    setSelectedMessageIds((prev) => {
      const id = String(item.id);
      return prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id];
    });
  };

  const canDeleteSelectedForEveryone = (ids) => {
    const clean = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
    if (!clean.length || !currentUser) return false;
    const selected = messages.filter((message) => clean.includes(String(message.id)));
    return selected.length === clean.length && selected.every((message) => (
      String(message.from_user_id) === String(currentUser.id)
      && !isDeletedForEveryone(message)
      && isWithinDeleteForEveryoneWindow(message.created_at)
    ));
  };

  useEffect(() => {
    if (!pendingDeleteIds?.length) return undefined;
    const timer = setInterval(() => setDeleteWindowTick((tick) => tick + 1), 10000);
    return () => clearInterval(timer);
  }, [pendingDeleteIds]);

  const openDeleteDialog = (ids) => {
    const clean = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
    if (!clean.length) return;
    setActionMsg(null);
    setDeleteDialogError('');
    setPendingDeleteIds(clean);
  };

  const performDelete = async (mode) => {
    const ids = pendingDeleteIds || [];
    if (!ids.length || !currentUser || deletingMessages) return;
    if (mode === 'everyone' && !canDeleteSelectedForEveryone(ids)) return;

    const snapshot = messages;
    const idSet = new Set(ids);
    const nextMessages = messages.filter((message) => !idSet.has(String(message.id)));
    const visible = nextMessages.filter((message) => !isMessageRemoved(message));
    const last = visible[visible.length - 1];

    setDeletingMessages(true);
    setDeleteDialogError('');
    setMessages(nextMessages);
    setSelectedMessageIds((prev) => prev.filter((id) => !idSet.has(id)));
    if (selectedContact) {
      setChatList((prev) => prev.map((item) => (
        String(item.id) === String(selectedContact.id)
          ? {
            ...item,
            lastMessage: last ? getMessagePreview(last) : '',
            lastMessageDeleted: isDeletedForEveryone(last),
            lastMessageTime: last?.created_at || item.lastMessageTime,
          }
          : item
      )));
    }

    const serverIds = ids.filter((id) => !String(id).startsWith('temp'));
    if (!serverIds.length) {
      setPendingDeleteIds(null);
      setDeletingMessages(false);
      return;
    }

    try {
      await apiService.deleteChatMessages({
        userId: currentUser.id,
        mode,
        messageIds: serverIds,
      });
      setPendingDeleteIds(null);
    } catch (err) {
      console.warn('Failed to delete messages:', err);
      setMessages(snapshot);
      setSelectedMessageIds(ids);
      setDeleteDialogError('Unable to delete the selected messages. Try again.');
    } finally {
      setDeletingMessages(false);
    }
  };

  const beginChatSelection = (chat) => {
    if (!chat?.id) return;
    setSelectedChatIds((prev) => {
      const id = String(chat.id);
      return prev.includes(id) ? prev : [...prev, id];
    });
  };

  const toggleChatSelection = (chat) => {
    if (!chat?.id) return;
    setSelectedChatIds((prev) => {
      const id = String(chat.id);
      return prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id];
    });
  };

  const openDeleteChatDialog = (ids) => {
    const clean = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
    if (!clean.length) return;
    const selected = chatList.filter((chat) => clean.includes(String(chat.id)));
    const body = clean.length === 1
      ? `This removes the conversation with ${selected[0]?.name || 'this person'} from your messages.`
      : 'This removes the selected conversations from your messages.';
    setDeleteChatBody(body);
    setDeleteChatError('');
    setPendingDeleteChatIds(clean);
  };

  const performDeleteChats = async () => {
    const ids = pendingDeleteChatIds || [];
    if (!ids.length || !currentUser || deletingChats) return;

    const snapshot = chatList;
    const idSet = new Set(ids);
    setDeletingChats(true);
    setDeleteChatError('');
    setChatList((prev) => prev.filter((chat) => !idSet.has(String(chat.id))));
    setSelectedChatIds((prev) => prev.filter((id) => !idSet.has(id)));

    try {
      await apiService.deleteChatConversations(currentUser.id, ids);
      setPendingDeleteChatIds(null);
    } catch (err) {
      console.warn('Failed to delete conversations:', err);
      setChatList(snapshot);
      setSelectedChatIds(ids);
      setDeleteChatError('Unable to delete the selected chats. Try again.');
    } finally {
      setDeletingChats(false);
    }
  };

  // â”€â”€ Filter Active Chats (Search Query & All / Unread Filter) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filteredChats = chatList.filter((chat) => {
    if (conversationFilter === 'unread' && !(chat.unread > 0)) return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      chat.name?.toLowerCase().includes(q) ||
      resolveRoleLabel(chat.role_id || chat.role_name).toLowerCase().includes(q) ||
      chat.lastMessage?.toLowerCase().includes(q)
    );
  });

  // â”€â”€ Filter Available Users in Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filteredModalUsers = availableUsers.filter((u) => {
    const q = modalSearchQuery.trim().toLowerCase();
    const roleNameStr = resolveRoleLabel(u.role_id || u.role_name);
    const matchesSearch = !q || u.name?.toLowerCase().includes(q) || roleNameStr.toLowerCase().includes(q);

    const rId = u.role_id || resolveUserRoleId(u);
    let matchesTab = true;
    if (modalRoleTab === 'caregivers') matchesTab = rId === ROLES.CAREGIVER || rId === ROLES.SYSTEM_CAREGIVER;
    if (modalRoleTab === 'providers') matchesTab = rId === ROLES.PROVIDER;
    if (modalRoleTab === 'patients') matchesTab = rId === ROLES.PATIENT;

    return matchesSearch && matchesTab;
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Render: Chat Row
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderChatRow = ({ item }) => {
    const isSelected = selectedChatIds.includes(String(item.id));
    const selectionMode = selectedChatIds.length > 0;
    return (
    <TouchableOpacity
      style={[styles.chatRow, isSelected && styles.chatRowSelected]}
      onPress={() => (selectionMode ? toggleChatSelection(item) : openChat(item))}
      onLongPress={() => beginChatSelection(item)}
      delayLongPress={400}
      activeOpacity={0.75}
    >
      {selectionMode && (
        <MaterialIcons
          name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
          size={22}
          color={isSelected ? ACCENT_COLOR : TEXT_MUTED}
          style={styles.chatSelectionIcon}
        />
      )}
      <View style={[styles.avatar, { backgroundColor: `${ACCENT_COLOR}18` }]}>
        <Text style={[styles.avatarText, { color: ACCENT_COLOR }]}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.chatRowBody}>
        <View style={styles.chatRowTop}>
          <Text style={styles.chatRowName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.chatRowTime}>{formatListTime(item.lastMessageTime)}</Text>
        </View>
        <View style={styles.chatRowBottom}>
          <Text style={styles.chatRowRole}>{resolveRoleLabel(item.role_id || item.role_name)}</Text>
          {item.unread > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: ACCENT_COLOR }]}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.chatRowPreview, item.lastMessageDeleted && styles.chatRowPreviewDeleted]}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
    );
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Render: Message Bubble
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const visibleMessages = messages.filter((item) => !isMessageRemoved(item));

  const renderMessage = ({ item }) => {
    const isMine = String(item.from_user_id) === String(currentUser?.id);
    const chronoIndex = visibleMessages.findIndex((message) => String(message.id) === String(item.id));
    const prevMsg = chronoIndex > 0 ? visibleMessages[chronoIndex - 1] : null;
    const showDate = !prevMsg || !isSameDay(prevMsg.created_at, item.created_at);

    const isBeingEdited = editingId === item.id;

    const isSelected = selectedMessageIds.includes(String(item.id));
    const selectionMode = selectedMessageIds.length > 0;

    return (
      <View collapsable={false}>
        {showDate && (
          <View style={styles.dateSeparatorRow}>
            <View style={styles.dateSeparatorLine} />
            <Text style={styles.dateSeparatorText}>{formatDateSeparator(item.created_at)}</Text>
            <View style={styles.dateSeparatorLine} />
          </View>
        )}
        <Pressable
          collapsable={false}
          onPress={selectionMode ? () => toggleMessageSelection(item) : undefined}
          onLongPress={() => beginMessageSelection(item)}
          delayLongPress={350}
          style={[
            styles.messageRow,
            isMine ? styles.messageRowMine : styles.messageRowOther,
            isSelected && styles.messageRowSelected,
          ]}>
            {selectionMode && (
              <MaterialIcons
                name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                size={22}
                color={isSelected ? ACCENT_COLOR : TEXT_MUTED}
                style={styles.selectionIcon}
              />
            )}
            {!isMine && (
              <View style={[styles.peerAvatar, { backgroundColor: `${ACCENT_COLOR}20` }]}>
                <Text style={[styles.peerAvatarText, { color: ACCENT_COLOR }]}>
                  {getInitials(selectedContact?.name)}
                </Text>
              </View>
            )}
            <View
              pointerEvents={selectionMode ? 'none' : 'auto'}
              style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}
            >
              {isBeingEdited ? (
                <View>
                  <TextInput
                    style={styles.editInput}
                    value={editText}
                    onChangeText={setEditText}
                    multiline
                    autoFocus
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity onPress={() => { setEditingId(null); setEditText(''); }}>
                      <Text style={styles.editCancel}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={commitEdit}>
                      <Text style={styles.editSave}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : isDeletedForEveryone(item) ? (
                <>
                  <View style={styles.deletedMessageRow}>
                    <MaterialIcons
                      name="block"
                      size={15}
                      color={TEXT_MUTED}
                    />
                    <Text style={styles.deletedMessageText}>{DELETED_MESSAGE_LABEL}</Text>
                  </View>
                  <View style={styles.messageFooter}>
                    <Text style={[styles.messageTime, isMine ? styles.messageTimeMine : styles.messageTimeOther]}>
                      {formatMessageTime(item.created_at)}
                    </Text>
                  </View>
                </>
              ) : isAudioMessage(item) ? (
                <>
                  <VoiceMessageBubble
                    message={item}
                    isMine={isMine}
                    isActive={String(activeMessageId) === String(item.id)}
                    isPlaying={isPlaying && String(activeMessageId) === String(item.id)}
                    isLoading={String(loadingAudioMessageId) === String(item.id)}
                    currentMs={String(activeMessageId) === String(item.id) ? currentMs : 0}
                    durationMs={String(activeMessageId) === String(item.id) ? playbackDurationMs : (item.audio_duration || 0) * 1000}
                    onPlayPress={() => handlePlayAudioMessage(item)}
                    accentColor={ACCENT_COLOR}
                    textDark={TEXT_DARK}
                    textMuted={TEXT_MUTED}
                  />
                  <View style={styles.messageFooter}>
                    <Text style={[styles.messageTime, isMine ? styles.messageTimeMine : styles.messageTimeOther]}>
                      {formatMessageTime(item.created_at)}
                    </Text>
                    {isMine && (
                      <MaterialIcons
                        name={item._pending ? 'access-time' : item.is_read ? 'done-all' : 'done'}
                        size={12}
                        color={item.is_read ? '#4FC3F7' : '#90A4AE'}
                        style={{ marginLeft: 3 }}
                      />
                    )}
                  </View>
                </>
              ) : (
                <>
                  {item.file_path ? (
                    isImageAttachment(item) ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => openAttachment(item)}
                        onLongPress={() => beginMessageSelection(item)}
                        delayLongPress={350}
                        disabled={item._pending || selectedMessageIds.length > 0}
                      >
                        <Image
                          key={resolveChatFileUrl(item.file_path)}
                          source={{ uri: resolveChatFileUrl(item.file_path) }}
                          style={styles.attachmentImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.attachmentFile}
                        onPress={() => openAttachment(item)}
                        onLongPress={() => beginMessageSelection(item)}
                        delayLongPress={350}
                        disabled={item._pending || selectedMessageIds.length > 0}
                      >
                        <MaterialIcons name="attach-file" size={18} color={TEXT_DARK} />
                        <Text style={styles.attachmentFileName} numberOfLines={2}>
                          {item.original_file_name || 'Attachment'}
                        </Text>
                      </TouchableOpacity>
                    )
                  ) : null}
                  {item.message ? (
                    <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextOther]}>
                      {item.message}
                      {item.is_edited ? <Text style={styles.editedLabel}> (edited)</Text> : null}
                    </Text>
                  ) : null}
                  <View style={styles.messageFooter}>
                    <Text style={[styles.messageTime, isMine ? styles.messageTimeMine : styles.messageTimeOther]}>
                      {formatMessageTime(item.created_at)}
                    </Text>
                    {isMine && (
                      <MaterialIcons
                        name={item._pending ? 'access-time' : item.is_read ? 'done-all' : 'done'}
                        size={12}
                        color={item.is_read ? '#4FC3F7' : '#90A4AE'}
                        style={{ marginLeft: 3 }}
                      />
                    )}
                  </View>
                </>
              )}
            </View>
        </Pressable>
      </View>
    );
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Render: List View (Centered Title, Filters & WhatsApp FAB)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderListView = () => (
    <View style={styles.listScreen}>
      {/* Header â€” matches PatientsScreen topbar */}
      <View style={styles.topbar}>
        {selectedChatIds.length > 0 ? (
          <>
            <TouchableOpacity
              style={styles.topbarActionButton}
              onPress={() => setSelectedChatIds([])}
              accessibilityLabel="Cancel selection"
            >
              <MaterialIcons name="close" size={21} color={TEXT_DARK} />
            </TouchableOpacity>
            <Text style={styles.topbarTitle}>{selectedChatIds.length} selected</Text>
            <TouchableOpacity
              style={styles.topbarActionButton}
              onPress={() => openDeleteChatDialog(selectedChatIds)}
              accessibilityLabel="Delete selected chats"
            >
              <MaterialIcons name="delete-outline" size={22} color="#E53935" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.topbarActionButton}
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Go back"
            >
              <MaterialIcons name="arrow-back" size={21} color={TEXT_DARK} />
            </TouchableOpacity>
            <Text style={styles.topbarTitle}>Messages</Text>
            <View style={styles.topbarSpacer} />
          </>
        )}
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={20} color={TEXT_MUTED} style={{ marginRight: scaleWidth(10) }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats..."
          placeholderTextColor="#a0aab4"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Conversation Filter Pills (All / Unread) */}
      <View style={styles.convoFilterWrap}>
        <TouchableOpacity
          style={[styles.convoFilterPill, conversationFilter === 'all' && styles.convoFilterPillActive]}
          onPress={() => setConversationFilter('all')}>
          <Text style={[styles.convoFilterText, conversationFilter === 'all' && styles.convoFilterTextActive]}>
            All ({chatList.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.convoFilterPill, conversationFilter === 'unread' && styles.convoFilterPillActive]}
          onPress={() => setConversationFilter('unread')}>
          <Text style={[styles.convoFilterText, conversationFilter === 'unread' && styles.convoFilterTextActive]}>
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {loadingList ? (
        <ActivityIndicator size="large" color={ACCENT_COLOR} style={styles.loader} />
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderChatRow}
          style={styles.chatList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            conversationFilter === 'unread' ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No unread messages.</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons name="chat-bubble-outline" size={42} color={TEXT_MUTED} />
                <Text style={styles.emptyTitle}>No conversations found</Text>
                <Text style={styles.emptySubtitle}>
                  Tap the + button at the bottom right to start a message.
                </Text>
              </View>
            )
          }
        />
      )}

      {/* WhatsApp Style Floating Action Button (FAB) */}
      {userRoleId !== ROLES.PATIENT && selectedChatIds.length === 0 && conversationFilter !== 'unread' && (
        <TouchableOpacity
          style={styles.whatsappFab}
          onPress={openNewChatModal}
          activeOpacity={0.85}
          accessibilityLabel="New conversation">
          <MaterialIcons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Render: Conversation View
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderConversationView = () => (
    <View style={styles.conversationRoot} {...iosChatBackSwipe.panHandlers}>
      {/* Header â€” matches PatientsScreen topbar */}
      <View style={styles.conversationHeaderWrap}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#ffffff' }}>
          <View style={styles.topbar}>
            {selectedMessageIds.length > 0 ? (
              <>
                <TouchableOpacity
                  style={styles.topbarActionButton}
                  onPress={() => setSelectedMessageIds([])}
                  accessibilityLabel="Cancel selection"
                >
                  <MaterialIcons name="close" size={21} color={TEXT_DARK} />
                </TouchableOpacity>
                <Text style={styles.topbarTitle}>
                  {selectedMessageIds.length} selected
                </Text>
                <View style={styles.selectionActions}>
                  {selectedMessageIds.length === 1 && messages.some((message) => (
                    String(message.id) === selectedMessageIds[0]
                    && String(message.from_user_id) === String(currentUser?.id)
                    && message.message
                  )) && (
                    <TouchableOpacity
                      style={styles.topbarActionButton}
                      onPress={() => {
                        const message = messages.find((item) => String(item.id) === selectedMessageIds[0]);
                        if (message) startEdit(message);
                      }}
                      accessibilityLabel="Edit message"
                    >
                      <MaterialIcons name="edit" size={20} color={TEXT_DARK} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.topbarActionButton}
                    onPress={() => openDeleteDialog(selectedMessageIds)}
                    accessibilityLabel="Delete selected messages"
                  >
                    <MaterialIcons name="delete-outline" size={22} color="#E53935" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.topbarActionButton} onPress={closeChat} accessibilityLabel="Back to chats">
                  <MaterialIcons name="arrow-back" size={21} color={TEXT_DARK} />
                </TouchableOpacity>
                {/* Centered name & role */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.topbarTitle} numberOfLines={1}>{selectedContact?.name}</Text>
                  {peerIsTyping
                    ? <Text style={styles.topbarSubtitle}>typingâ€¦</Text>
                    : <Text style={styles.topbarSubtitle}>
                      {resolveRoleLabel(selectedContact?.role_id || selectedContact?.role_name)}
                    </Text>
                  }
                </View>
                <View style={styles.topbarSpacer} />
              </>
            )}
          </View>
        </SafeAreaView>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.conversationBody}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.messagesWrap}>
          {loadingMessages ? (
            <ActivityIndicator size="small" color={ACCENT_COLOR} style={styles.loader} />
          ) : (
            <FlatList
              ref={messagesRef}
              data={[...visibleMessages].reverse()}
              extraData={selectedMessageIds}
              inverted
              removeClippedSubviews={false}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        {/* Composer */}
        <View style={[styles.composer, { paddingBottom: Math.max(scaleHeight(10), insets.bottom + scaleHeight(6)) }]}>
          {isRecording ? (
            <View style={styles.recordingBar}>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>
                  Recording {formatRecordingDuration(recordingDurationMs)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.recordingActionButton}
                onPress={handleCancelVoiceRecording}
                disabled={uploadingVoice}
              >
                <Text style={styles.recordingCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: ACCENT_COLOR }, uploadingVoice && styles.sendButtonDisabled]}
                onPress={sendVoiceMessage}
                disabled={uploadingVoice}
                accessibilityLabel="Send message"
              >
                {uploadingVoice
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <MaterialIcons name="send" size={20} color="#fff" />}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.attachButton}
                onPress={handleAttachFile}
                disabled={sending || uploadingVoice || uploadingFile || isRecording}
                accessibilityLabel="Attach file"
              >
                {uploadingFile
                  ? <ActivityIndicator size="small" color={ACCENT_COLOR} />
                  : <MaterialIcons name="attach-file" size={22} color={ACCENT_COLOR} />}
              </TouchableOpacity>
              <TextInput
                style={styles.composerInput}
                placeholder="Type a message"
                placeholderTextColor={TEXT_MUTED}
                value={input}
                onChangeText={handleInputChange}
                multiline
                maxLength={1000}
                editable={!sending && !uploadingVoice && !uploadingFile}
              />
              {input.trim() ? (
                <TouchableOpacity
                  style={[styles.sendButton, { backgroundColor: ACCENT_COLOR }, sending && styles.sendButtonDisabled]}
                  onPress={sendMessage}
                  disabled={sending}>
                  {sending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <MaterialIcons name="send" size={20} color="#fff" />}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.micButton, { borderColor: ACCENT_COLOR }]}
                  onPress={handleStartVoiceRecording}
                  disabled={sending || uploadingVoice || uploadingFile}
                >
                  <MaterialIcons name="mic" size={22} color={ACCENT_COLOR} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Render: New Conversation Modal (CENTERED IN MIDDLE, NO AUTO-KEYBOARD)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderNewChatModal = () => (
    <Modal
      visible={isNewChatModalOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setIsNewChatModalOpen(false)}>
      <TouchableWithoutFeedback onPress={() => setIsNewChatModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Conversation</Text>
                <TouchableOpacity onPress={() => setIsNewChatModalOpen(false)} style={styles.modalCloseBtn}>
                  <MaterialIcons name="close" size={22} color={TEXT_DARK} />
                </TouchableOpacity>
              </View>

              {/* Search bar inside modal (no autoFocus) */}
              <View style={styles.modalSearchWrap}>
                <MaterialIcons name="search" size={20} color={TEXT_MUTED} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search by name or role..."
                  placeholderTextColor={TEXT_MUTED}
                  value={modalSearchQuery}
                  onChangeText={setModalSearchQuery}
                />
              </View>

              {/* Filter role tabs dynamically based on user role */}
              <View style={styles.modalRoleTabs}>
                {[
                  { id: 'all', label: 'All' },
                  ...(userRoleId !== ROLES.CAREGIVER && userRoleId !== ROLES.SYSTEM_CAREGIVER
                    ? [{ id: 'caregivers', label: 'Caregivers' }]
                    : []),
                  ...(userRoleId !== ROLES.PROVIDER ? [{ id: 'providers', label: 'Providers' }] : []),
                  ...(userRoleId !== ROLES.PATIENT ? [{ id: 'patients', label: 'Patients' }] : []),
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.modalRoleTab, modalRoleTab === tab.id && styles.modalRoleTabActive]}
                    onPress={() => setModalRoleTab(tab.id)}>
                    <Text style={[styles.modalRoleTabText, modalRoleTab === tab.id && styles.modalRoleTabTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* User List */}
              {loadingAvailableUsers ? (
                <ActivityIndicator size="large" color={ACCENT_COLOR} style={{ marginVertical: 30 }} />
              ) : (
                <FlatList
                  data={filteredModalUsers}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.userRow}
                      onPress={() => selectUserFromModal(item)}
                      activeOpacity={0.75}>
                      <View style={[styles.avatar, { backgroundColor: `${ACCENT_COLOR}18` }]}>
                        <Text style={[styles.avatarText, { color: ACCENT_COLOR }]}>{getInitials(item.name)}</Text>
                      </View>
                      <View style={styles.userRowBody}>
                        <Text style={styles.userRowName}>{item.name}</Text>
                        <Text style={styles.userRowRole}>{resolveRoleLabel(item.role_id || item.role_name)}</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={22} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={{ padding: 30, alignItems: 'center' }}>
                      <Text style={{ color: TEXT_MUTED, fontSize: scaleFont(14), fontWeight: '600', textAlign: 'center' }}>
                        No users available for new conversation
                      </Text>
                    </View>
                  }
                  contentContainerStyle={{ paddingBottom: 16 }}
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  const renderDeleteDialog = () => {
    const count = pendingDeleteIds?.length || 0;
    const allowDeleteForEveryone = deleteWindowTick >= 0 && canDeleteSelectedForEveryone(pendingDeleteIds);
    return (
      <Modal
        visible={count > 0}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingMessages) setPendingDeleteIds(null);
        }}
      >
        <TouchableWithoutFeedback onPress={() => { if (!deletingMessages) setPendingDeleteIds(null); }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.deleteDialog}>
                <Text style={styles.deleteDialogTitle}>
                  {count === 1 ? 'Delete message' : `Delete ${count} messages`}
                </Text>
                <Text style={styles.deleteDialogBody}>
                  {allowDeleteForEveryone
                    ? `Choose how the selected ${count === 1 ? 'message' : 'messages'} should be removed.`
                    : `This removes the selected ${count === 1 ? 'message' : 'messages'} from your chat.`}
                </Text>
                {!!deleteDialogError && (
                  <Text style={styles.deleteDialogError}>{deleteDialogError}</Text>
                )}
                {deletingMessages && (
                  <ActivityIndicator color={ACCENT_COLOR} style={styles.deleteDialogSpinner} />
                )}
                <TouchableOpacity
                  style={[styles.deleteDialogButton, styles.deleteDialogPrimary]}
                  onPress={() => performDelete('me')}
                  disabled={deletingMessages}
                >
                  <Text style={styles.deleteDialogPrimaryText}>Delete for Me</Text>
                </TouchableOpacity>
                {allowDeleteForEveryone && (
                  <TouchableOpacity
                    style={[styles.deleteDialogButton, styles.deleteDialogDanger]}
                    onPress={() => performDelete('everyone')}
                    disabled={deletingMessages}
                  >
                    <Text style={styles.deleteDialogDangerText}>Delete for Everyone</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.deleteDialogCancel}
                  onPress={() => setPendingDeleteIds(null)}
                  disabled={deletingMessages}
                >
                  <Text style={styles.deleteDialogCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  const renderDeleteChatDialog = () => {
    const count = pendingDeleteChatIds?.length || 0;
    return (
      <Modal
        visible={count > 0}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingChats) setPendingDeleteChatIds(null);
        }}
      >
        <TouchableWithoutFeedback onPress={() => { if (!deletingChats) setPendingDeleteChatIds(null); }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.deleteDialog}>
                <Text style={styles.deleteDialogTitle}>
                  {count === 1 ? 'Delete chat' : `Delete ${count} chats`}
                </Text>
                <Text style={styles.deleteDialogBody}>{deleteChatBody}</Text>
                {!!deleteChatError && (
                  <Text style={styles.deleteDialogError}>{deleteChatError}</Text>
                )}
                {deletingChats && (
                  <ActivityIndicator color={ACCENT_COLOR} style={styles.deleteDialogSpinner} />
                )}
                <TouchableOpacity
                  style={[styles.deleteDialogButton, styles.deleteDialogDanger, styles.deleteDialogDangerFill]}
                  onPress={performDeleteChats}
                  disabled={deletingChats}
                >
                  <Text style={styles.deleteDialogPrimaryText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteDialogCancel}
                  onPress={() => setPendingDeleteChatIds(null)}
                  disabled={deletingChats}
                >
                  <Text style={styles.deleteDialogCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Render: Edit/Delete Action Sheet Modal
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderActionSheet = () => (
    <Modal
      visible={!!actionMsg}
      transparent
      animationType="fade"
      onRequestClose={() => setActionMsg(null)}>
      <TouchableWithoutFeedback onPress={() => setActionMsg(null)}>
        <View style={styles.actionSheetOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.actionSheet}>
              <Text style={styles.actionSheetPreview} numberOfLines={2}>
                {actionMsg?.original_file_name || actionMsg?.message || 'Message'}
              </Text>
              {String(actionMsg?.from_user_id) === String(currentUser?.id) && !!actionMsg?.message && (
                <TouchableOpacity style={styles.actionSheetRow} onPress={() => startEdit(actionMsg)}>
                  <MaterialIcons name="edit" size={20} color={TEXT_DARK} />
                  <Text style={styles.actionSheetText}>Edit message</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.actionSheetRow} onPress={() => beginMessageSelection(actionMsg)}>
                <MaterialIcons name="check-circle-outline" size={20} color={TEXT_DARK} />
                <Text style={styles.actionSheetText}>Select messages</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionSheetRow} onPress={() => openDeleteDialog([actionMsg?.id])}>
                <MaterialIcons name="delete-outline" size={20} color="#E53935" />
                <Text style={[styles.actionSheetText, { color: '#E53935' }]}>Delete message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionSheetRow, { borderTopWidth: 1, borderTopColor: '#F1F5F9' }]} onPress={() => setActionMsg(null)}>
                <Text style={[styles.actionSheetText, { color: TEXT_MUTED }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Render: In-App Notification Banner
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderBanner = () => {
    if (!notifBanner) return null;
    return (
      <Animated.View style={[styles.notifBanner, { transform: [{ translateY: bannerAnim }] }]}>
        <View style={styles.notifBannerAvatar}>
          <Text style={styles.notifBannerInitials}>{getInitials(notifBanner.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.notifBannerName} numberOfLines={1}>{notifBanner.name}</Text>
          <Text style={styles.notifBannerPreview} numberOfLines={1}>{notifBanner.preview}</Text>
        </View>
        <TouchableOpacity onPress={() => {
          Animated.timing(bannerAnim, { toValue: -80, duration: 200, useNativeDriver: true }).start(() => setNotifBanner(null));
        }}>
          <MaterialIcons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <View style={styles.screenRoot}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={view === 'list' ? 'transparent' : '#ffffff'}
        translucent={view === 'list'}
      />

      {view === 'list' ? (
        <>
          <LinearGradient colors={SCREEN_BG_COLORS} style={styles.fullScreen}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
              {renderListView()}
            </SafeAreaView>
          </LinearGradient>
          <PremiumBottomNav active="messages" navigation={navigation} unreadMessages={unreadCount} />
        </>
      ) : (
        renderConversationView()
      )}

      {renderNewChatModal()}
      <Modal
        visible={Boolean(imagePreviewUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewUrl(null)}
      >
        <View style={styles.imagePreviewBackdrop}>
          <TouchableOpacity
            style={styles.imagePreviewClose}
            onPress={() => setImagePreviewUrl(null)}
            accessibilityLabel="Close image"
          >
            <MaterialIcons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {imagePreviewUrl ? (
            <Image
              source={{ uri: imagePreviewUrl }}
              style={styles.imagePreview}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
      {renderActionSheet()}
      {renderDeleteDialog()}
      {renderDeleteChatDialog()}
      {renderBanner()}
    </View>
  );
};

export default ChatScreen;

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#fffdfb',
  },
  fullScreen: { flex: 1 },
  safeArea: { flex: 1 },

  // List View
  listScreen: { flex: 1, alignItems: 'center' },
  chatList: { width: '100%' },

  // Topbar (matches PatientsScreen exactly)
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Math.max(scaleWidth(16), 16),
    paddingTop: scaleWidth(8),
    paddingBottom: scaleWidth(10),
    width: '100%',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(7,27,52,0.06)',
  },
  topbarActionButton: {
    width: Math.max(scaleWidth(42), 42),
    height: Math.max(scaleWidth(42), 42),
    borderRadius: scaleWidth(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    elevation: 3,
    flexShrink: 0,
  },
  topbarSpacer: {
    width: Math.max(scaleWidth(42), 42),
  },
  topbarTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#0b1f3f',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: scaleWidth(8),
  },
  topbarSubtitle: {
    fontSize: scaleFont(12),
    fontWeight: '600',
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 1,
  },

  // Conversation Filter Pills (All / Unread)
  convoFilterWrap: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: '100%',
    maxWidth: scaleWidth(340),
    paddingHorizontal: Math.max(scaleWidth(20), 20),
    marginBottom: scaleHeight(10),
    gap: scaleWidth(8),
  },
  convoFilterPill: {
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(6),
    borderRadius: scaleWidth(16),
    backgroundColor: 'rgba(7,27,52,0.06)',
  },
  convoFilterPillActive: {
    backgroundColor: '#0b1f3f',
  },
  convoFilterText: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  convoFilterTextActive: {
    color: '#fff',
  },

  // WhatsApp Style Floating Action Button (FAB)
  whatsappFab: {
    position: 'absolute',
    right: scaleWidth(20),
    bottom: PREMIUM_BOTTOM_NAV_CLEARANCE + scaleHeight(12),
    width: scaleWidth(56),
    height: scaleWidth(56),
    borderRadius: scaleWidth(28),
    backgroundColor: '#0b1f3f',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 99,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: Math.max(scaleWidth(20), 20),
    marginVertical: scaleWidth(10),
    borderRadius: scaleWidth(20),
    paddingHorizontal: scaleWidth(14),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    minHeight: scaleWidth(50),
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  searchInput: { flex: 1, color: '#0b1f3f', fontSize: scaleFont(14), fontWeight: '700' },
  listContent: { flexGrow: 1, paddingBottom: PREMIUM_BOTTOM_NAV_CLEARANCE + scaleHeight(12) },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: scaleWidth(340),
    paddingHorizontal: Math.max(scaleWidth(20), 20),
    paddingVertical: scaleHeight(14),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(7,27,52,0.06)',
  },
  chatRowSelected: { backgroundColor: 'rgba(11,31,63,0.06)' },
  chatSelectionIcon: { marginRight: scaleWidth(10) },
  avatar: { width: scaleWidth(52), height: scaleWidth(52), borderRadius: scaleWidth(26), alignItems: 'center', justifyContent: 'center', marginRight: scaleWidth(12) },
  avatarText: { fontSize: scaleFont(16), fontWeight: '800' },
  chatRowBody: { flex: 1, minWidth: 0 },
  chatRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: scaleWidth(8) },
  chatRowName: { flex: 1, color: TEXT_DARK, fontSize: scaleFont(16), fontWeight: '800' },
  chatRowTime: { color: TEXT_MUTED, fontSize: scaleFont(11), fontWeight: '600' },
  chatRowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: scaleHeight(2) },
  chatRowRole: { color: TEXT_MUTED, fontSize: scaleFont(11), fontWeight: '700' },
  chatRowPreview: { marginTop: scaleHeight(4), color: TEXT_MUTED, fontSize: scaleFont(13), fontWeight: '600' },
  chatRowPreviewDeleted: { fontStyle: 'italic', fontWeight: '500' },
  unreadBadge: { minWidth: scaleWidth(20), height: scaleWidth(20), borderRadius: scaleWidth(10), alignItems: 'center', justifyContent: 'center', paddingHorizontal: scaleWidth(6) },
  unreadText: { color: '#fff', fontSize: scaleFont(10), fontWeight: '800' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: scaleWidth(30), paddingTop: scaleHeight(40), paddingBottom: scaleHeight(40) },
  emptyTitle: { marginTop: scaleHeight(12), color: TEXT_DARK, fontSize: scaleFont(18), fontWeight: '800' },
  emptySubtitle: { marginTop: scaleHeight(8), color: TEXT_MUTED, fontSize: scaleFont(13), lineHeight: scaleFont(19), textAlign: 'center', fontWeight: '600' },
  loader: { marginTop: scaleHeight(30) },

  // Conversation View
  conversationRoot: { flex: 1, backgroundColor: CHAT_BG },
  conversationHeaderWrap: {
    width: '100%',
    backgroundColor: '#ffffff',
  },
  conversationBody: { flex: 1, backgroundColor: CHAT_BG },
  typingIndicator: { color: TEXT_MUTED, fontSize: scaleFont(12), fontWeight: '600', fontStyle: 'italic', marginTop: 1, textAlign: 'center' },
  messagesWrap: { flex: 1, backgroundColor: CHAT_BG },
  messagesContent: { paddingHorizontal: scaleWidth(12), paddingVertical: scaleHeight(12), paddingBottom: scaleHeight(20) },

  // Date Separator
  dateSeparatorRow: { flexDirection: 'row', alignItems: 'center', marginVertical: scaleHeight(12), paddingHorizontal: scaleWidth(8) },
  dateSeparatorLine: { flex: 1, height: 1, backgroundColor: 'rgba(7,27,52,0.10)' },
  dateSeparatorText: { marginHorizontal: scaleWidth(10), color: TEXT_MUTED, fontSize: scaleFont(11), fontWeight: '700' },

  // Message Bubbles
  messageRow: { marginBottom: scaleHeight(8), flexDirection: 'row', alignItems: 'flex-end' },
  messageRowMine: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  messageRowSelected: { backgroundColor: 'rgba(11,31,63,0.06)', borderRadius: scaleWidth(12) },
  selectionIcon: { marginRight: scaleWidth(8), marginBottom: scaleHeight(6) },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: scaleWidth(8) },
  peerAvatar: { width: scaleWidth(28), height: scaleWidth(28), borderRadius: scaleWidth(14), alignItems: 'center', justifyContent: 'center', marginRight: scaleWidth(6) },
  peerAvatarText: { fontSize: scaleFont(10), fontWeight: '800' },
  bubble: { maxWidth: '75%', borderRadius: scaleWidth(14), paddingHorizontal: scaleWidth(12), paddingVertical: scaleHeight(8) },
  bubbleMine: { backgroundColor: '#dcf8c6', borderTopRightRadius: scaleWidth(4) },
  bubbleOther: { backgroundColor: '#ffffff', borderTopLeftRadius: scaleWidth(4) },
  messageText: { fontSize: scaleFont(15), lineHeight: scaleFont(21), fontWeight: '500' },
  messageTextMine: { color: '#111b21' },
  messageTextOther: { color: '#111b21' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: scaleHeight(3) },
  messageTime: { fontSize: scaleFont(10), fontWeight: '600' },
  messageTimeMine: { color: '#667781' },
  messageTimeOther: { color: '#8696a0' },
  deletedMessageRow: { flexDirection: 'row', alignItems: 'center', gap: scaleWidth(6) },
  deletedMessageText: { color: TEXT_MUTED, fontSize: scaleFont(14), fontStyle: 'italic', fontWeight: '500' },
  editedLabel: { fontSize: scaleFont(10), color: '#8696a0', fontStyle: 'italic' },

  // Inline Edit
  editInput: { fontSize: scaleFont(14), color: '#111b21', borderBottomWidth: 1, borderBottomColor: '#1177c6', paddingVertical: scaleHeight(4), minWidth: scaleWidth(120) },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: scaleWidth(12), marginTop: scaleHeight(6) },
  editCancel: { color: TEXT_MUTED, fontWeight: '700', fontSize: scaleFont(13) },
  editSave: { color: '#1177c6', fontWeight: '800', fontSize: scaleFont(13) },

  // Composer
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: scaleWidth(10), paddingVertical: scaleHeight(8), backgroundColor: '#f0f2f5', borderTopWidth: 1, borderTopColor: 'rgba(7,27,52,0.06)' },
  attachButton: { width: scaleWidth(36), height: scaleWidth(42), alignItems: 'center', justifyContent: 'center', marginRight: scaleWidth(2) },
  attachmentImage: { width: scaleWidth(200), height: scaleWidth(150), borderRadius: scaleWidth(8), marginBottom: scaleHeight(4), backgroundColor: 'rgba(0,0,0,0.05)' },
  imagePreviewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  imagePreviewClose: { position: 'absolute', top: scaleHeight(48), right: scaleWidth(16), zIndex: 2, padding: scaleWidth(8) },
  imagePreview: { width: '100%', height: '80%' },
  attachmentFile: { flexDirection: 'row', alignItems: 'center', marginBottom: scaleHeight(4) },
  attachmentFileName: { flexShrink: 1, marginLeft: scaleWidth(6), fontSize: scaleFont(14), fontWeight: '600', color: '#111b21', textDecorationLine: 'underline' },
  composerInput: { flex: 1, minHeight: scaleHeight(42), maxHeight: scaleHeight(110), borderRadius: scaleWidth(22), backgroundColor: '#fff', paddingHorizontal: scaleWidth(16), paddingVertical: scaleHeight(10), fontSize: scaleFont(15), color: TEXT_DARK, marginRight: scaleWidth(8) },
  micButton: { width: scaleWidth(42), height: scaleWidth(42), borderRadius: scaleWidth(21), alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1 },
  recordingBar: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  recordingIndicator: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: scaleWidth(22), paddingHorizontal: scaleWidth(14), paddingVertical: scaleHeight(12), marginRight: scaleWidth(8) },
  recordingDot: { width: scaleWidth(10), height: scaleWidth(10), borderRadius: scaleWidth(5), backgroundColor: '#E53935', marginRight: scaleWidth(8) },
  recordingText: { color: TEXT_DARK, fontSize: scaleFont(14), fontWeight: '700' },
  recordingActionButton: { marginRight: scaleWidth(8), paddingHorizontal: scaleWidth(10), paddingVertical: scaleHeight(10) },
  recordingCancelText: { color: TEXT_MUTED, fontSize: scaleFont(13), fontWeight: '700' },
  sendButton: { width: scaleWidth(44), height: scaleWidth(44), borderRadius: scaleWidth(22), alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.45 },

  // Centered Middle New Chat Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalContainer: { width: '100%', maxWidth: scaleWidth(340), backgroundColor: '#fff', borderRadius: 20, maxHeight: '78%', overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  modalTitle: { fontSize: scaleFont(18), fontWeight: '800', color: TEXT_DARK },
  modalCloseBtn: { padding: 4 },
  modalSearchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, height: 40 },
  modalSearchInput: { flex: 1, marginLeft: 8, fontSize: scaleFont(14), color: TEXT_DARK, fontWeight: '600' },
  modalRoleTabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 10, gap: 6 },
  modalRoleTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F1F5F9' },
  modalRoleTabActive: { backgroundColor: '#0b1f3f' },
  modalRoleTabText: { fontSize: scaleFont(11), fontWeight: '700', color: TEXT_MUTED },
  modalRoleTabTextActive: { color: '#fff' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(7,27,52,0.05)' },
  userRowBody: { flex: 1 },
  userRowName: { fontSize: scaleFont(15), fontWeight: '700', color: TEXT_DARK },
  userRowRole: { fontSize: scaleFont(12), color: TEXT_MUTED, marginTop: 2, fontWeight: '600' },

  // Action Sheet Modal
  actionSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  actionSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 32, paddingHorizontal: 20 },
  actionSheetPreview: { fontSize: scaleFont(13), color: TEXT_MUTED, marginBottom: 12, fontStyle: 'italic', borderLeftWidth: 3, borderLeftColor: '#E2E8F0', paddingLeft: 10 },
  actionSheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  actionSheetText: { fontSize: scaleFont(16), fontWeight: '600', color: TEXT_DARK },

  deleteDialog: {
    width: '100%',
    maxWidth: scaleWidth(340),
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: scaleWidth(18),
    paddingTop: scaleHeight(18),
    paddingBottom: scaleHeight(12),
  },
  deleteDialogTitle: { fontSize: scaleFont(18), fontWeight: '800', color: TEXT_DARK },
  deleteDialogBody: { marginTop: scaleHeight(8), marginBottom: scaleHeight(16), fontSize: scaleFont(14), lineHeight: scaleFont(20), color: TEXT_MUTED, fontWeight: '600' },
  deleteDialogError: { color: '#E53935', fontSize: scaleFont(13), fontWeight: '700', marginBottom: scaleHeight(10) },
  deleteDialogSpinner: { marginBottom: scaleHeight(12) },
  deleteDialogButton: { borderRadius: 12, paddingVertical: scaleHeight(12), alignItems: 'center', marginBottom: scaleHeight(8) },
  deleteDialogPrimary: { backgroundColor: '#0b1f3f' },
  deleteDialogPrimaryText: { color: '#fff', fontSize: scaleFont(15), fontWeight: '800' },
  deleteDialogDanger: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E53935' },
  deleteDialogDangerFill: { backgroundColor: '#E53935', borderColor: '#E53935' },
  deleteDialogDangerText: { color: '#E53935', fontSize: scaleFont(15), fontWeight: '800' },
  deleteDialogButtonDisabled: { opacity: 0.4 },
  deleteDialogDangerTextDisabled: { color: '#E53935' },
  deleteDialogHint: { color: TEXT_MUTED, fontSize: scaleFont(12), fontWeight: '600', marginBottom: scaleHeight(4) },
  deleteDialogCancel: { alignItems: 'center', paddingVertical: scaleHeight(12) },
  deleteDialogCancelText: { color: TEXT_MUTED, fontSize: scaleFont(15), fontWeight: '700' },

  // In-App Notification Banner
  notifBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#0b1f3f',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    paddingTop: scaleHeight(48),
    gap: scaleWidth(10),
  },
  notifBannerAvatar: { width: scaleWidth(36), height: scaleWidth(36), borderRadius: scaleWidth(18), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  notifBannerInitials: { color: '#fff', fontSize: scaleFont(13), fontWeight: '800' },
  notifBannerName: { color: '#fff', fontWeight: '800', fontSize: scaleFont(14) },
  notifBannerPreview: { color: 'rgba(255,255,255,0.75)', fontSize: scaleFont(13), fontWeight: '600' },
});
