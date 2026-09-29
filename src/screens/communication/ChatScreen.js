/**
 * ChatScreen.js — Real-Time Chat System
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
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { io } from 'socket.io-client';
import apiService from '../../services/apiService';
import { SOCKET_BASE_URL } from '../../config/api';
import PremiumBottomNav, { PREMIUM_BOTTOM_NAV_CLEARANCE } from '../../components/navigation/PremiumBottomNav';
import { setActiveChatUserId } from '../../utils/activeChatState';
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

// ─── Role Definitions & Permissible Matrix ─────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Fallbacks ────────────────────────────────────────────────────────────────

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

// ─── Chat List Builder (Active Conversations) ─────────────────────────────────

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
      lastMessage: conv.message || '',
      lastMessageTime: conv.created_at,
      unread: Number(conv.unread_count || 0),
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return timeB - timeA;
  });
};

const isAudioMessage = (item) => (
  item?.message_type === 'audio' || String(item?.file_type || '').startsWith('audio/')
);

const getMessagePreview = (msg) => {
  if (isAudioMessage(msg)) return 'Voice message';
  return msg?.message || '';
};

const formatRecordingDuration = (durationMs) => {
  const totalSeconds = Math.max(0, Math.floor((Number(durationMs) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

// ─── Component ────────────────────────────────────────────────────────────────

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

  useEffect(() => { selectedContactRef.current = selectedContact; }, [selectedContact]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  useEffect(() => () => {
    stopPlayback();
    cancelRecording();
  }, [cancelRecording, stopPlayback]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { messagesRef.current?.scrollToEnd({ animated: true }); }, 120);
  }, []);

  // ── Socket.IO Setup ─────────────────────────────────────────────────────────
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
          if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
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
        scrollToBottom();
        apiService.markChatNotificationsRead(myId).catch(() => null);
      } else if (fromId !== myId) {
        const senderName = msg.sender_name || msg.from_user_name || 'New message';
        showBanner({ name: senderName, preview: getMessagePreview(msg) });
        setUnreadCount((n) => n + 1);
      }

      setChatList((prev) => {
        const existingIndex = prev.findIndex((item) => String(item.id) === otherId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            lastMessage: getMessagePreview(msg),
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

  // ── Banner Notification ──────────────────────────────────────────────────────
  const showBanner = (data) => {
    setNotifBanner(data);
    Animated.spring(bannerAnim, { toValue: 0, useNativeDriver: true }).start();
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => {
      Animated.timing(bannerAnim, { toValue: -80, duration: 300, useNativeDriver: true }).start(() => setNotifBanner(null));
    }, 3500);
  };

  // ── Emit Typing Events ───────────────────────────────────────────────────────
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

  // ── Load Active Conversations ────────────────────────────────────────────────
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

  // ── Load Messages ────────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (contact) => {
    if (!contact || !currentUser) return;
    setPeerIsTyping(false);
    try {
      if (usingFallback || String(contact.id).startsWith('mock-')) {
        setMessages(getFallbackMessages(contact, currentUser));
        scrollToBottom();
        return;
      }

      const result = await apiService.getChatMessages(currentUser.id, contact.id);
      setMessages(result?.data || []);
      scrollToBottom();
      await apiService.markChatNotificationsRead(currentUser.id).catch(() => null);
      setUnreadCount(0);
    } catch (error) {
      console.warn('Message history fallback:', error?.message);
      setMessages(getFallbackMessages(contact, currentUser));
      scrollToBottom();
    } finally {
      setLoadingMessages(false);
    }
  }, [currentUser, scrollToBottom, usingFallback]);

  useFocusEffect(
    useCallback(() => {
      setLoadingList(true);
      loadChats();
      const interval = setInterval(() => {
        const me = currentUserRef.current;
        const contact = selectedContactRef.current;
        if (me?.id) {
          if (contact?.id) {
            apiService.getChatMessages(me.id, contact.id).then((res) => {
              if (Array.isArray(res?.data)) setMessages(res.data);
            }).catch(() => null);
          }
          apiService.getChatConversations(me.id).then((res) => {
            if (Array.isArray(res?.data)) setChatList(buildChatList(res.data, me));
          }).catch(() => null);
        }
      }, 3500);

      return () => clearInterval(interval);
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

  // ── Open / Close Conversation ────────────────────────────────────────────────
  const openChat = (contact) => {
    setSelectedContact(contact);
    setActiveChatUserId(contact?.id);
    setView('chat');
    setEditingId(null);
    setEditText('');
  };

  const closeChat = () => {
    socketRef.current?.emit('stop_typing', { from_user_id: currentUser?.id, to_user_id: selectedContact?.id });
    setActiveChatUserId(null);
    setView('list');
    setSelectedContact(null);
    setMessages([]);
    setInput('');
    setEditingId(null);
    setEditText('');
    setPeerIsTyping(false);
    loadChats();
  };

  useEffect(() => {
    const openUserId = route?.params?.openUserId;
    if (!openUserId || !chatList.length) return;

    const contact = chatList.find((chat) => String(chat.id) === String(openUserId));
    if (contact) {
      openChat(contact);
      navigation.setParams({ openUserId: undefined });
    }
  }, [route?.params?.openUserId, chatList, navigation]);

  // ── New Chat Modal Trigger & Selection ───────────────────────────────────────
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
          name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || 'Unknown',
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
      scrollToBottom();

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

  // ── Send Message ─────────────────────────────────────────────────────────────
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
    scrollToBottom();
    setSending(true);

    try {
      if (usingFallback || String(selectedContact.id).startsWith('mock-')) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== optimistic.id),
            { ...optimistic, _pending: false },
            { id: `reply-${Date.now()}`, from_user_id: selectedContact.id, to_user_id: currentUser.id, message: 'Thanks for your message. I will review and get back to you shortly.', created_at: new Date().toISOString(), is_read: 0 },
          ]);
          scrollToBottom();
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

  // ── Edit Message ─────────────────────────────────────────────────────────────
  const startEdit = (msg) => {
    setActionMsg(null);
    setEditingId(msg.id);
    setEditText(msg.message);
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

  // ── Delete Message (One by One) ──────────────────────────────────────────────
  const confirmDelete = (msg) => {
    setActionMsg(null);
    const isMine = String(msg.from_user_id) === String(currentUser?.id);
    const buttons = [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete for me', onPress: () => doDelete(msg, 'me') },
    ];
    if (isMine) {
      buttons.push({
        text: 'Delete for everyone',
        style: 'destructive',
        onPress: () => doDelete(msg, 'everyone'),
      });
    }
    Alert.alert('Delete message', 'Choose how to delete this message.', buttons);
  };

  const doDelete = async (msg, mode) => {
    setMessages((prev) => prev.filter((m) => String(m.id) !== String(msg.id)));
    try {
      if (currentUser?.id && msg.id && !String(msg.id).startsWith('temp-')) {
        await apiService.deleteChatMessage(msg.id, currentUser.id, mode);
      }
    } catch (err) {
      console.warn('Failed to delete message:', err);
    }
  };

  // ── Delete Conversation (Entire Chat) ────────────────────────────────────────
  const confirmDeleteChat = (chat) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete the conversation with ${chat.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setChatList((prev) => prev.filter((c) => String(c.id) !== String(chat.id)));
            if (selectedContact && String(selectedContact.id) === String(chat.id)) {
              closeChat();
            }
            try {
              if (currentUser?.id) {
                await apiService.deleteChatConversations(currentUser.id, [chat.id]);
              }
            } catch (err) {
              console.warn('Failed to delete conversation:', err);
            }
          },
        },
      ]
    );
  };

  // ── Filter Active Chats (Search Query & All / Unread Filter) ──────────────────
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

  // ── Filter Available Users in Modal ──────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: Chat Row
  // ─────────────────────────────────────────────────────────────────────────────
  const renderChatRow = ({ item }) => (
    <TouchableOpacity
      style={styles.chatRow}
      onPress={() => openChat(item)}
      onLongPress={() => confirmDeleteChat(item)}
      delayLongPress={400}
      activeOpacity={0.75}
    >
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
        <Text style={styles.chatRowPreview} numberOfLines={1}>{item.lastMessage}</Text>
      </View>
    </TouchableOpacity>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: Message Bubble
  // ─────────────────────────────────────────────────────────────────────────────
  const renderMessage = ({ item, index }) => {
    const isMine = String(item.from_user_id) === String(currentUser?.id);
    const prevMsg = messages[index - 1];
    const showDate = !prevMsg || !isSameDay(prevMsg.created_at, item.created_at);

    const isBeingEdited = editingId === item.id;

    return (
      <>
        {showDate && (
          <View style={styles.dateSeparatorRow}>
            <View style={styles.dateSeparatorLine} />
            <Text style={styles.dateSeparatorText}>{formatDateSeparator(item.created_at)}</Text>
            <View style={styles.dateSeparatorLine} />
          </View>
        )}
        <TouchableWithoutFeedback
          onLongPress={() => !item._pending && setActionMsg(item)}
          delayLongPress={400}>
          <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
            {!isMine && (
              <View style={[styles.peerAvatar, { backgroundColor: `${ACCENT_COLOR}20` }]}>
                <Text style={[styles.peerAvatarText, { color: ACCENT_COLOR }]}>
                  {getInitials(selectedContact?.name)}
                </Text>
              </View>
            )}
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
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
                  <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextOther]}>
                    {item.message}
                    {item.is_edited ? <Text style={styles.editedLabel}> (edited)</Text> : null}
                  </Text>
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
          </View>
        </TouchableWithoutFeedback>
      </>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: List View (Centered Title, Filters & WhatsApp FAB)
  // ─────────────────────────────────────────────────────────────────────────────
  const renderListView = () => (
    <View style={styles.listScreen}>
      {/* Header — matches PatientsScreen topbar */}
      <View style={styles.topbar}>
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
            <View style={styles.emptyState}>
              <MaterialIcons name="chat-bubble-outline" size={42} color={TEXT_MUTED} />
              <Text style={styles.emptyTitle}>No conversations found</Text>
              <Text style={styles.emptySubtitle}>
                Tap the + button at the bottom right to start a message.
              </Text>
            </View>
          }
        />
      )}

      {/* WhatsApp Style Floating Action Button (FAB) */}
      {userRoleId !== ROLES.PATIENT && (
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: Conversation View
  // ─────────────────────────────────────────────────────────────────────────────
  const renderConversationView = () => (
    <View style={styles.conversationRoot}>
      {/* Header — matches PatientsScreen topbar */}
      <View style={styles.conversationHeaderWrap}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#ffffff' }}>
          <View style={styles.topbar}>
            <TouchableOpacity style={styles.topbarActionButton} onPress={closeChat} accessibilityLabel="Back to chats">
              <MaterialIcons name="arrow-back" size={21} color={TEXT_DARK} />
            </TouchableOpacity>
            {/* Centered name & role */}
            <View style={{ flex: 1 }}>
              <Text style={styles.topbarTitle} numberOfLines={1}>{selectedContact?.name}</Text>
              {peerIsTyping
                ? <Text style={styles.topbarSubtitle}>typing…</Text>
                : <Text style={styles.topbarSubtitle}>
                  {resolveRoleLabel(selectedContact?.role_id || selectedContact?.role_name)}
                </Text>
              }
            </View>
            <View style={styles.topbarSpacer} />
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
              data={messages}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={scrollToBottom}
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
              >
                {uploadingVoice
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <MaterialIcons name="stop" size={20} color="#fff" />}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.composerInput}
                placeholder="Type a message"
                placeholderTextColor={TEXT_MUTED}
                value={input}
                onChangeText={handleInputChange}
                multiline
                maxLength={1000}
                editable={!sending && !uploadingVoice}
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
                  disabled={sending || uploadingVoice}
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: New Conversation Modal (CENTERED IN MIDDLE, NO AUTO-KEYBOARD)
  // ─────────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: Edit/Delete Action Sheet Modal
  // ─────────────────────────────────────────────────────────────────────────────
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
              <Text style={styles.actionSheetPreview} numberOfLines={2}>{actionMsg?.message}</Text>
              {String(actionMsg?.from_user_id) === String(currentUser?.id) && (
                <TouchableOpacity style={styles.actionSheetRow} onPress={() => startEdit(actionMsg)}>
                  <MaterialIcons name="edit" size={20} color={TEXT_DARK} />
                  <Text style={styles.actionSheetText}>Edit message</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.actionSheetRow} onPress={() => confirmDelete(actionMsg)}>
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: In-App Notification Banner
  // ─────────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────────
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
      {renderActionSheet()}
      {renderBanner()}
    </View>
  );
};

export default ChatScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  avatar: { width: scaleWidth(52), height: scaleWidth(52), borderRadius: scaleWidth(26), alignItems: 'center', justifyContent: 'center', marginRight: scaleWidth(12) },
  avatarText: { fontSize: scaleFont(16), fontWeight: '800' },
  chatRowBody: { flex: 1, minWidth: 0 },
  chatRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: scaleWidth(8) },
  chatRowName: { flex: 1, color: TEXT_DARK, fontSize: scaleFont(16), fontWeight: '800' },
  chatRowTime: { color: TEXT_MUTED, fontSize: scaleFont(11), fontWeight: '600' },
  chatRowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: scaleHeight(2) },
  chatRowRole: { color: TEXT_MUTED, fontSize: scaleFont(11), fontWeight: '700' },
  chatRowPreview: { marginTop: scaleHeight(4), color: TEXT_MUTED, fontSize: scaleFont(13), fontWeight: '600' },
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
  editedLabel: { fontSize: scaleFont(10), color: '#8696a0', fontStyle: 'italic' },

  // Inline Edit
  editInput: { fontSize: scaleFont(14), color: '#111b21', borderBottomWidth: 1, borderBottomColor: '#1177c6', paddingVertical: scaleHeight(4), minWidth: scaleWidth(120) },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: scaleWidth(12), marginTop: scaleHeight(6) },
  editCancel: { color: TEXT_MUTED, fontWeight: '700', fontSize: scaleFont(13) },
  editSave: { color: '#1177c6', fontWeight: '800', fontSize: scaleFont(13) },

  // Composer
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: scaleWidth(10), paddingVertical: scaleHeight(8), backgroundColor: '#f0f2f5', borderTopWidth: 1, borderTopColor: 'rgba(7,27,52,0.06)' },
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
