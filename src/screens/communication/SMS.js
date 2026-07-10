import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions
} from 'react-native';
import { colors, fonts } from '../../config/globall';

// 📏 Responsive scale helpers
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;

export default function MessageScreen({ navigation }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { sender: 'Gallagher, Zorita', text: 'Hello! How are you feeling today?', time: '09:25 AM', align: 'left' },
    { sender: 'You', text: 'Hello! I\'m doing well, thank you for asking.', time: '09:25 AM', align: 'right' },
    { sender: 'Gallagher, Zorita', text: 'Great to hear! Have you taken your medications today?', time: '09:26 AM', align: 'left' }
  ]);
  const [isFocused, setIsFocused] = useState(false); // Track TextInput focus

  const scrollViewRef = useRef(null);

  const sendMessage = () => {
    if (message.trim()) {
      const newMessage = {
        sender: 'You',
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        align: 'right'
      };
      setMessages(prev => [...prev, newMessage]);
      setMessage('');
    }
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? scaleHeight(20) : 0}
    >
      {/* 🔹 Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image
            source={require('../../assets/images/back.png')}
            style={styles.backIcon}
          />
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>Gallagher, Zorita</Text>
          <Text style={styles.userStatus}>Active now</Text>
        </View>
      </View>

      {/* 🔹 Chat Messages */}
      <ScrollView
        style={styles.chatContainer}
        contentContainerStyle={styles.chatContent}
        ref={scrollViewRef}
      >
        <Text style={styles.dateText}>Today</Text>
        {messages.map((msg, index) => (
          <View
            key={index}
            style={[
              styles.messageBubble,
              msg.align === 'right' ? styles.rightBubble : styles.leftBubble
            ]}
          >
            {msg.align === 'left' && <Text style={styles.senderName}>{msg.sender}</Text>}
            <Text style={[
              styles.messageText,
              msg.align === 'right' ? styles.rightMessageText : styles.leftMessageText
            ]}>
              {msg.text}
            </Text>
            <Text style={styles.messageTime}>{msg.time}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 🔹 Message Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            { borderColor: isFocused ? '#000' : 'transparent', borderWidth: isFocused ? 1 : 0 }
          ]}
          placeholder="Type your message here..."
          placeholderTextColor={colors.textSecondary}
          value={message}
          onChangeText={setMessage}
          multiline
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <TouchableOpacity
          style={[styles.sendButton, !message && styles.disabledSendButton]}
          onPress={sendMessage}
          disabled={!message}
        >
          <Image
            source={require('../../assets/images/send1.png')}
            style={styles.sendIcon}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(16),
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.primaryButton,
  },
  backButton: { marginRight: scaleWidth(12) },
  backIcon: {
    width: scaleWidth(22),
    height: scaleWidth(22),
    tintColor: colors.textBlack,
    resizeMode: 'contain'
  },
  userInfo: { flex: 1 },
  userName: { ...fonts.label, color: colors.textBlack },
  userStatus: { ...fonts.inputText, color: colors.textBlack, opacity: 0.8 },

  chatContainer: { flex: 1, backgroundColor: colors.background },
  chatContent: { paddingVertical: scaleHeight(8), paddingHorizontal: scaleWidth(16) },
  dateText: { textAlign: 'center', marginVertical: scaleHeight(12), color: colors.textSecondary, ...fonts.inputText },

  messageBubble: {
    maxWidth: '80%',
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(14),
    borderRadius: scaleWidth(14),
    marginBottom: scaleHeight(10)
  },
  leftBubble: { backgroundColor: colors.backgroundLight, alignSelf: 'flex-start', borderBottomLeftRadius: scaleWidth(6) },
  rightBubble: { backgroundColor: colors.primaryButton, alignSelf: 'flex-end', borderBottomRightRadius: scaleWidth(6) },

  senderName: { ...fonts.inputText, fontWeight: '600', marginBottom: scaleHeight(4), color: colors.textPrimary },
  messageText: { ...fonts.inputText, lineHeight: scaleHeight(20) },
  leftMessageText: { color: colors.textPrimary },
  rightMessageText: { color: colors.textWhite },
  messageTime: { ...fonts.smallText, color: colors.textSecondary, textAlign: 'right', marginTop: scaleHeight(2), opacity: 0.7 },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(8),
    paddingHorizontal: scaleWidth(14),
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    borderRadius: scaleWidth(30),
    paddingVertical: scaleHeight(6),
    paddingHorizontal: scaleWidth(14),
    maxHeight: scaleHeight(120),
    ...fonts.inputText
  },
  sendButton: {
    marginLeft: scaleWidth(10),
    backgroundColor: colors.primaryButton,
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(20),
    justifyContent: 'center',
    alignItems: 'center'
  },
  disabledSendButton: { opacity: 0.5 },
  sendIcon: { width: scaleWidth(18), height: scaleWidth(18), tintColor: colors.textWhite },
});
