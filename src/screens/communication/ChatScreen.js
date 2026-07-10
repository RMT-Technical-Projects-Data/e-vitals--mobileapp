import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '../../services/apiService';
import PremiumBottomNav, { PREMIUM_BOTTOM_NAV_CLEARANCE } from '../../components/navigation/PremiumBottomNav';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleHeight = (size) => Math.min((height / guidelineBaseHeight) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

const SCREEN_BG_COLORS = ['#fffdfb', '#f7ece7', '#eef1f5'];
const CHAT_BG = '#efeae2';
const TEXT_DARK = '#071B34';
const TEXT_MUTED = '#687382';
const PATIENT_ACCENT = '#071B34';
const PANEL_ACCENT = '#071B34';

const resolveUserRole = (user) => {
  const roleId = Number(user?.role_id);
  if (roleId === 4) return 'provider';
  if (roleId === 5 || roleId === 7) return 'caregiver';
  return 'patient';
};

const normalizeRoleName = (roleName = '') => {
  const role = String(roleName).toLowerCase();
  if (role.includes('provider') || role.includes('physician') || role.includes('doctor')) return 'provider';
  if (role.includes('caregiver') || role.includes('care giver')) return 'caregiver';
  if (role.includes('patient')) return 'patient';
  return role;
};

const roleLabel = (roleName) => {
  const role = normalizeRoleName(roleName);
  if (role === 'provider') return 'Provider';
  if (role === 'caregiver') return 'Caregiver';
  if (role === 'patient') return 'Patient';
  return 'Care team';
};

const canChatWith = (currentRole, contactRoleName) => {
  const contactRole = normalizeRoleName(contactRoleName);
  if (currentRole === 'patient') {
    return contactRole === 'caregiver' || contactRole === 'provider';
  }
  if (currentRole === 'provider' || currentRole === 'caregiver') {
    return contactRole === 'patient';
  }
  return false;
};

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
  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
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

const getFallbackContacts = (userRole) => {
  if (userRole === 'patient') {
    return [
      { id: 'mock-caregiver', name: 'Sarah Mitchell', role_name: 'Caregiver', lastMessage: 'Your latest vitals look stable.', lastMessageTime: new Date().toISOString() },
      { id: 'mock-provider', name: 'Dr. James Carter', role_name: 'Provider', lastMessage: 'Please upload today\'s blood pressure reading.', lastMessageTime: new Date(Date.now() - 3600000).toISOString() },
    ];
  }
  return [
    { id: 'mock-patient-1', name: 'Cyrus Nguyen', role_name: 'Patient', lastMessage: 'I uploaded my glucose reading.', lastMessageTime: new Date().toISOString() },
    { id: 'mock-patient-2', name: 'Anna Lee', role_name: 'Patient', lastMessage: 'Can you review my blood pressure trend?', lastMessageTime: new Date(Date.now() - 7200000).toISOString() },
  ];
};

const getFallbackMessages = (contact, userRole) => {
  const contactName = contact?.name || 'Care team';
  if (userRole === 'patient') {
    return [
      { id: 'm1', from_user_id: contact.id, to_user_id: 'me', message: `Hello, this is ${contactName}. How can I help with your care plan today?`, created_at: new Date(Date.now() - 7200000).toISOString() },
      { id: 'm2', from_user_id: 'me', to_user_id: contact.id, message: 'I wanted to ask about my latest readings.', created_at: new Date(Date.now() - 7000000).toISOString() },
      { id: 'm3', from_user_id: contact.id, to_user_id: 'me', message: 'I reviewed them and everything looks on track. Keep uploading daily.', created_at: new Date(Date.now() - 6800000).toISOString() },
    ];
  }
  return [
    { id: 'm1', from_user_id: contact.id, to_user_id: 'me', message: 'Hi, I uploaded my vitals this morning.', created_at: new Date(Date.now() - 5400000).toISOString() },
    { id: 'm2', from_user_id: 'me', to_user_id: contact.id, message: 'Thanks, I will review your readings shortly.', created_at: new Date(Date.now() - 5200000).toISOString() },
  ];
};

const buildChatList = (conversations = [], contacts = [], currentUserId) => {
  const map = new Map();

  conversations.forEach((conv) => {
    const otherId = conv.other_user_id;
    if (!otherId) return;
    map.set(String(otherId), {
      id: otherId,
      conversationId: conv.id || conv.conversation_id || null,
      name: conv.other_user_name || 'Unknown',
      role_name: conv.role_name || '',
      lastMessage: conv.message || '',
      lastMessageTime: conv.created_at,
      unread: 0,
    });
  });

  contacts.forEach((contact) => {
    const id = String(contact.id);
    if (map.has(id)) {
      const existing = map.get(id);
      map.set(id, {
        ...existing,
        role_name: existing.role_name || contact.role_name,
        name: existing.name || contact.name,
      });
      return;
    }
    map.set(id, {
      id: contact.id,
      conversationId: contact.conversation_id || null,
      name: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown',
      role_name: contact.role_name || '',
      lastMessage: 'Tap to start a conversation',
      lastMessageTime: null,
      unread: 0,
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return timeB - timeA;
  });
};

const ChatScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState('list');
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('patient');
  const [chatList, setChatList] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  const messagesRef = useRef(null);
  const accentColor = userRole === 'patient' ? PATIENT_ACCENT : PANEL_ACCENT;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const loadChats = useCallback(async () => {
    setLoadingList(true);
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) throw new Error('No user');
      const user = JSON.parse(userStr);
      const role = resolveUserRole(user);
      const userId = user.id;
      const practiceId = user.practice_id || (await AsyncStorage.getItem('practiceId'));

      setCurrentUser(user);
      setUserRole(role);

      if (!userId || !practiceId) throw new Error('Missing user or practice');

      const [conversationsRes, contactsRes] = await Promise.all([
        apiService.getChatConversations(userId),
        apiService.getChatAvailableUsers(practiceId, userId),
      ]);

      const conversations = conversationsRes?.data || [];
      const contacts = (contactsRes?.data || []).filter((contact) => canChatWith(role, contact.role_name));
      const merged = buildChatList(conversations, contacts, userId);

      setChatList(merged);
      setUsingFallback(false);
    } catch (error) {
      console.warn('Chat list fallback:', error?.message);
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const role = resolveUserRole(user);
      setCurrentUser(user);
      setUserRole(role);
      setChatList(getFallbackContacts(role));
      setUsingFallback(true);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadMessages = useCallback(async (contact) => {
    if (!contact || !currentUser) return;
    setLoadingMessages(true);
    try {
      if (usingFallback || String(contact.id).startsWith('mock-')) {
        const fallback = getFallbackMessages(contact, userRole).map((msg) => ({
          ...msg,
          from_user_id: msg.from_user_id === 'me' ? currentUser.id : contact.id,
          to_user_id: msg.to_user_id === 'me' ? currentUser.id : contact.id,
        }));
        setMessages(fallback);
        scrollToBottom();
        return;
      }

      const result = await apiService.getChatMessages(currentUser.id, contact.id);
      setMessages(result?.data || []);
      scrollToBottom();
    } catch (error) {
      console.warn('Message history fallback:', error?.message);
      setMessages(getFallbackMessages(contact, userRole).map((msg) => ({
        ...msg,
        from_user_id: msg.from_user_id === 'me' ? currentUser.id : contact.id,
        to_user_id: msg.to_user_id === 'me' ? currentUser.id : contact.id,
      })));
      scrollToBottom();
    } finally {
      setLoadingMessages(false);
    }
  }, [currentUser, scrollToBottom, userRole, usingFallback]);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats])
  );

  useEffect(() => {
    if (view === 'chat' && selectedContact) {
      loadMessages(selectedContact);
    }
  }, [view, selectedContact, loadMessages]);

  const openChat = (contact) => {
    setSelectedContact(contact);
    setView('chat');
  };

  const closeChat = () => {
    setView('list');
    setSelectedContact(null);
    setMessages([]);
    setInput('');
    loadChats();
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !selectedContact || !currentUser || sending) return;

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
            {
              id: `reply-${Date.now()}`,
              from_user_id: selectedContact.id,
              to_user_id: currentUser.id,
              message: 'Thanks for your message. I will review and get back to you shortly.',
              created_at: new Date().toISOString(),
              is_read: 0,
            },
          ]);
          scrollToBottom();
        }, 700);
        return;
      }

      const result = await apiService.sendChatMessage({
        from_user_id: currentUser.id,
        to_user_id: selectedContact.id,
        message: text,
        practice_id: currentUser.practice_id,
        patient_id: userRole === 'patient' ? currentUser.patients_table_id || currentUser.id : null,
      });

      const saved = result?.data;
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
      loadChats();
    } catch (error) {
      console.error('Send message failed:', error);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const filteredChats = chatList.filter((chat) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      chat.name?.toLowerCase().includes(q) ||
      roleLabel(chat.role_name).toLowerCase().includes(q) ||
      chat.lastMessage?.toLowerCase().includes(q)
    );
  });

  const listSubtitle = userRole === 'patient'
    ? 'Message your caregiver or provider'
    : userRole === 'provider'
      ? 'Message your patients'
      : 'Message your patients';

  const renderChatRow = ({ item }) => (
    <TouchableOpacity style={styles.chatRow} onPress={() => openChat(item)} activeOpacity={0.75}>
      <View style={[styles.avatar, { backgroundColor: `${accentColor}18` }]}>
        <Text style={[styles.avatarText, { color: accentColor }]}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.chatRowBody}>
        <View style={styles.chatRowTop}>
          <Text style={styles.chatRowName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.chatRowTime}>{formatListTime(item.lastMessageTime)}</Text>
        </View>
        <View style={styles.chatRowBottom}>
          <Text style={styles.chatRowRole}>{roleLabel(item.role_name)}</Text>
          {item.unread > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: accentColor }]}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
        <Text style={styles.chatRowPreview} numberOfLines={1}>{item.lastMessage}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderMessage = ({ item }) => {
    const isMine = String(item.from_user_id) === String(currentUser?.id);
    return (
      <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextOther]}>
            {item.message}
          </Text>
          <Text style={[styles.messageTime, isMine ? styles.messageTimeMine : styles.messageTimeOther]}>
            {formatMessageTime(item.created_at)}{item._pending ? '  •' : ''}
          </Text>
        </View>
      </View>
    );
  };

  const renderListView = () => (
    <View style={styles.listScreen}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Chats</Text>
        <Text style={styles.listSubtitle}>{listSubtitle}</Text>
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={20} color={TEXT_MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats"
          placeholderTextColor={TEXT_MUTED}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loadingList ? (
        <ActivityIndicator size="large" color={accentColor} style={styles.loader} />
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
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtitle}>
                {userRole === 'patient'
                  ? 'Your caregiver and provider will appear here when available.'
                  : 'Your patients will appear here when available.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );

  const renderConversationView = () => (
    <View style={styles.conversationRoot}>
      <View style={[styles.conversationHeaderWrap, { backgroundColor: accentColor }]}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: accentColor }}>
          <View style={styles.conversationHeader}>
            <TouchableOpacity style={styles.backButton} onPress={closeChat} accessibilityLabel="Back to chats">
              <MaterialIcons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.conversationHeaderCenter}>
              <View style={styles.conversationAvatar}>
                <Text style={styles.conversationAvatarText}>{getInitials(selectedContact?.name)}</Text>
              </View>
              <View style={styles.conversationHeaderText}>
                <Text style={styles.conversationName} numberOfLines={1}>{selectedContact?.name}</Text>
                <Text style={styles.conversationRole}>{roleLabel(selectedContact?.role_name)}</Text>
              </View>
            </View>
            <View style={styles.headerIconSpacer} />
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={styles.conversationBody}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.messagesWrap}>
          {loadingMessages ? (
            <ActivityIndicator size="small" color={accentColor} style={styles.loader} />
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

        <View style={[styles.composer, { paddingBottom: Math.max(scaleHeight(10), insets.bottom + scaleHeight(6)) }]}>
          <TextInput
            style={styles.composerInput}
            placeholder="Type a message"
            placeholderTextColor={TEXT_MUTED}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: accentColor }, (!input.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
          >
            <MaterialIcons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );

  return (
    <View style={[styles.screenRoot, view === 'chat' && { backgroundColor: accentColor }]}>
      <StatusBar
        barStyle={view === 'chat' ? 'light-content' : 'dark-content'}
        backgroundColor={view === 'chat' ? accentColor : 'transparent'}
        translucent={view === 'list'}
      />
      {view === 'list' ? (
        <>
          <LinearGradient colors={SCREEN_BG_COLORS} style={styles.fullScreen}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
              {renderListView()}
            </SafeAreaView>
          </LinearGradient>
          <PremiumBottomNav active="messages" navigation={navigation} />
        </>
      ) : (
        renderConversationView()
      )}
    </View>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#fffdfb',
  },
  fullScreen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  listScreen: {
    flex: 1,
    alignItems: 'center',
  },
  chatList: {
    width: '100%',
    maxWidth: scaleWidth(340),
  },
  listHeader: {
    alignItems: 'center',
    paddingHorizontal: Math.max(scaleWidth(20), 20),
    paddingTop: scaleHeight(12),
    paddingBottom: scaleHeight(14),
  },
  listTitle: {
    color: TEXT_DARK,
    fontSize: scaleFont(28),
    lineHeight: scaleFont(33),
    fontWeight: '800',
    textAlign: 'center',
  },
  listSubtitle: {
    marginTop: scaleHeight(6),
    color: TEXT_MUTED,
    fontSize: scaleFont(13),
    lineHeight: scaleFont(19),
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: scaleWidth(280),
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: scaleWidth(340),
    marginHorizontal: Math.max(scaleWidth(20), 20),
    marginBottom: scaleHeight(10),
    paddingHorizontal: scaleWidth(14),
    minHeight: scaleHeight(44),
    borderRadius: scaleWidth(16),
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  searchInput: {
    flex: 1,
    marginLeft: scaleWidth(8),
    fontSize: scaleFont(14),
    color: TEXT_DARK,
    fontWeight: '600',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: PREMIUM_BOTTOM_NAV_CLEARANCE + scaleHeight(12),
  },
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
  avatar: {
    width: scaleWidth(52),
    height: scaleWidth(52),
    borderRadius: scaleWidth(26),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scaleWidth(12),
  },
  avatarText: {
    fontSize: scaleFont(16),
    fontWeight: '800',
  },
  chatRowBody: {
    flex: 1,
    minWidth: 0,
  },
  chatRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scaleWidth(8),
  },
  chatRowName: {
    flex: 1,
    color: TEXT_DARK,
    fontSize: scaleFont(16),
    fontWeight: '800',
  },
  chatRowTime: {
    color: TEXT_MUTED,
    fontSize: scaleFont(11),
    fontWeight: '600',
  },
  chatRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: scaleHeight(2),
  },
  chatRowRole: {
    color: TEXT_MUTED,
    fontSize: scaleFont(11),
    fontWeight: '700',
  },
  chatRowPreview: {
    marginTop: scaleHeight(4),
    color: TEXT_MUTED,
    fontSize: scaleFont(13),
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: scaleWidth(20),
    height: scaleWidth(20),
    borderRadius: scaleWidth(10),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleWidth(6),
  },
  unreadText: {
    color: '#fff',
    fontSize: scaleFont(10),
    fontWeight: '800',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleWidth(30),
    paddingTop: scaleHeight(40),
    paddingBottom: scaleHeight(40),
  },
  emptyTitle: {
    marginTop: scaleHeight(12),
    color: TEXT_DARK,
    fontSize: scaleFont(18),
    fontWeight: '800',
  },
  emptySubtitle: {
    marginTop: scaleHeight(8),
    color: TEXT_MUTED,
    fontSize: scaleFont(13),
    lineHeight: scaleFont(19),
    textAlign: 'center',
    fontWeight: '600',
  },
  loader: {
    marginTop: scaleHeight(30),
  },
  conversationRoot: {
    flex: 1,
    backgroundColor: CHAT_BG,
  },
  conversationHeaderWrap: {
    width: '100%',
  },
  conversationBody: {
    flex: 1,
    backgroundColor: CHAT_BG,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(10),
  },
  backButton: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationHeaderCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: scaleWidth(4),
  },
  conversationAvatar: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(20),
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scaleWidth(10),
  },
  conversationAvatarText: {
    color: '#fff',
    fontSize: scaleFont(14),
    fontWeight: '800',
  },
  conversationHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  conversationName: {
    color: '#fff',
    fontSize: scaleFont(17),
    fontWeight: '800',
  },
  conversationRole: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: scaleFont(12),
    fontWeight: '600',
    marginTop: scaleHeight(1),
  },
  headerIconSpacer: {
    width: scaleWidth(40),
  },
  messagesWrap: {
    flex: 1,
    backgroundColor: CHAT_BG,
  },
  messagesContent: {
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(12),
    paddingBottom: scaleHeight(20),
  },
  messageRow: {
    marginBottom: scaleHeight(8),
    flexDirection: 'row',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: scaleWidth(14),
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(8),
  },
  bubbleMine: {
    backgroundColor: '#dcf8c6',
    borderTopRightRadius: scaleWidth(4),
  },
  bubbleOther: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: scaleWidth(4),
  },
  messageText: {
    fontSize: scaleFont(15),
    lineHeight: scaleFont(21),
    fontWeight: '500',
  },
  messageTextMine: {
    color: '#111b21',
  },
  messageTextOther: {
    color: '#111b21',
  },
  messageTime: {
    fontSize: scaleFont(10),
    marginTop: scaleHeight(4),
    alignSelf: 'flex-end',
    fontWeight: '600',
  },
  messageTimeMine: {
    color: '#667781',
  },
  messageTimeOther: {
    color: '#8696a0',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleHeight(8),
    backgroundColor: '#f0f2f5',
    borderTopWidth: 1,
    borderTopColor: 'rgba(7,27,52,0.06)',
  },
  composerInput: {
    flex: 1,
    minHeight: scaleHeight(42),
    maxHeight: scaleHeight(110),
    borderRadius: scaleWidth(22),
    backgroundColor: '#fff',
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(10),
    fontSize: scaleFont(15),
    color: TEXT_DARK,
    marginRight: scaleWidth(8),
  },
  sendButton: {
    width: scaleWidth(44),
    height: scaleWidth(44),
    borderRadius: scaleWidth(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
