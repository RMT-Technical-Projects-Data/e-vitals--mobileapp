import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { resolveUserRole } from '../../utils/resolveUserRole';
import { colors, fonts } from '../../config/globall';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import PremiumBottomNav from '../../components/navigation/PremiumBottomNav';

const { width, height } = Dimensions.get('window');

const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

const NAVY_BLUE = colors.primaryButton || '#11224D';
const WHITE = '#FFFFFF';
const SCREEN_BG_COLORS = ['#fffdfb', '#f7ece7', '#eef1f5'];

const caregivers = [
  {
    id: 1,
    name: 'Maria Johnson',
    specialty: 'Home Health Caregiver',
    experience: '6 years',
    image: require('../../assets/images/batch_07/profile2.png'),
  },
  {
    id: 2,
    name: 'James Wilson',
    specialty: 'Certified Nursing Assistant',
    experience: '4 years',
    image: require('../../assets/images/batch_07/profile1.png'),
  },
  {
    id: 3,
    name: 'Lisa Thompson',
    specialty: 'Remote Care Coordinator',
    experience: '8 years',
    image: require('../../assets/images/batch_07/profile2.png'),
  },
];

const providers = [
  {
    id: 1,
    name: 'Dr. Sarah Johnson',
    specialty: 'General Physician',
    experience: '10 years',
    image: require('../../assets/images/batch_07/profile2.png'),
  },
  {
    id: 2,
    name: 'Dr. Michael Chen',
    specialty: 'Cardiologist',
    experience: '15 years',
    image: require('../../assets/images/batch_07/profile1.png'),
  },
  {
    id: 3,
    name: 'Dr. Emily Williams',
    specialty: 'Endocrinologist',
    experience: '8 years',
    image: require('../../assets/images/batch_07/profile2.png'),
  },
];

const patients = [
  {
    id: 1,
    name: 'Cyrus Nguyen',
    specialty: 'Patient',
    experience: 'BP & Glucose tracking',
    image: require('../../assets/images/batch_07/profile2.png'),
  },
  {
    id: 2,
    name: 'Ava Martinez',
    specialty: 'Patient',
    experience: 'Cardiac monitoring',
    image: require('../../assets/images/batch_07/profile1.png'),
  },
  {
    id: 3,
    name: 'Noah Williams',
    specialty: 'Patient',
    experience: 'Weight management',
    image: require('../../assets/images/batch_07/profile2.png'),
  },
];

const timeSlots = [
  { id: 1, time: '09:00 AM', date: '2025-03-15', status: 'available', caregiverId: null, providerId: null, patientId: null },
  { id: 2, time: '10:30 AM', date: '2025-03-15', status: 'booked', caregiverId: 1, providerId: null, patientId: null, bookedBy: 'John Doe' },
  { id: 3, time: '02:00 PM', date: '2025-03-15', status: 'available', caregiverId: null, providerId: null, patientId: null },
  { id: 4, time: '04:00 PM', date: '2025-03-15', status: 'available', caregiverId: null, providerId: null, patientId: null },
  { id: 5, time: '11:00 AM', date: '2025-03-16', status: 'available', caregiverId: null, providerId: null, patientId: null },
  { id: 6, time: '03:30 PM', date: '2025-03-16', status: 'booked', caregiverId: null, providerId: 2, patientId: null, bookedBy: 'Jane Smith' },
];

const chatData = [
  {
    id: 1,
    caregiver: {
      id: 1,
      name: 'Dr. Sarah Johnson',
      specialty: 'General Physician',
      image: require('../../assets/images/batch_07/profile2.png'),
      online: true,
    },
    lastMessage: 'Sure, please tell me your concern.',
    lastMessageTime: '10:35 AM',
    messages: [
      { id: 1, sender: 'Dr. Sarah Johnson', message: 'Hello, how can I help you?', time: '10:30 AM', isUser: false },
      { id: 2, sender: 'You', message: 'I want to ask about my appointment.', time: '10:32 AM', isUser: true },
      { id: 3, sender: 'Dr. Sarah Johnson', message: 'Sure, please tell me your concern.', time: '10:35 AM', isUser: false },
    ]
  },
  {
    id: 2,
    caregiver: {
      id: 2,
      name: 'Dr. Michael Chen',
      specialty: 'Cardiologist',
      image: require('../../assets/images/batch_07/profile1.png'),
      online: false,
    },
    lastMessage: 'Your test results are ready.',
    lastMessageTime: 'Yesterday',
    messages: [
      { id: 1, sender: 'Dr. Michael Chen', message: 'Your ECG report is normal.', time: 'Yesterday 3:45 PM', isUser: false },
      { id: 2, sender: 'You', message: 'That\'s great news!', time: 'Yesterday 4:00 PM', isUser: true },
      { id: 3, sender: 'Dr. Michael Chen', message: 'Your test results are ready.', time: 'Yesterday 4:15 PM', isUser: false },
    ]
  },
  {
    id: 3,
    caregiver: {
      id: 3,
      name: 'Dr. Emily Williams',
      specialty: 'Endocrinologist',
      image: require('../../assets/images/batch_07/profile2.png'),
      online: true,
    },
    lastMessage: 'Please remember to take your medication.',
    lastMessageTime: '2 days ago',
    messages: [
      { id: 1, sender: 'Dr. Emily Williams', message: 'How are your sugar levels?', time: '2 days ago', isUser: false },
      { id: 2, sender: 'You', message: 'They have been stable.', time: '2 days ago', isUser: true },
      { id: 3, sender: 'Dr. Emily Williams', message: 'Please remember to take your medication.', time: '2 days ago', isUser: false },
    ]
  }
];

export default function AppointmentForm() {
  const navigation = useNavigation();
  const route = useRoute();
  const chatScrollViewRef = useRef(null);

  const [userRole, setUserRole] = useState(route.params?.role || 'patient');
  const [chatView, setChatView] = useState('list'); // 'list' or 'chat'
  const [selectedChat, setSelectedChat] = useState(null);

  const [unreadChats, setUnreadChats] = useState({
    1: 2,
    2: 0,
    3: 1,
  });

  const [bookingTarget, setBookingTarget] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  
  const [fullName] = useState('');
  const [phone] = useState('');
  const [notes] = useState('');

  const [bpModalVisible, setBpModalVisible] = useState(false);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');

  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weight, setWeight] = useState('');

  const [glucoseModalVisible, setGlucoseModalVisible] = useState(false);
  const [glucoseLevel, setGlucoseLevel] = useState('');
  const [measurementTime, setMeasurementTime] = useState('');

  const [chatMessages, setChatMessages] = useState(chatData[0].messages);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      setChatView('list');
      setSelectedChat(null);
    }, [])
  );

  useEffect(() => {
    if (chatScrollViewRef.current && chatView === 'chat') {
      setTimeout(() => {
        chatScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages, chatView]);

  const loadRole = React.useCallback(async () => {
    if (route.params?.role) {
      setUserRole(route.params.role);
      return;
    }

    try {
      const userStr = await AsyncStorage.getItem('user');
      const parsed = userStr ? JSON.parse(userStr) : null;
      setUserRole(resolveUserRole(parsed));
    } catch (error) {
      setUserRole('patient');
    }
  }, [route.params?.role]);

  useFocusEffect(
    React.useCallback(() => {
      loadRole();
    }, [loadRole])
  );

  const handleServicePress = (service) => {
    if (service === 'Blood Pressure') {
      setBpModalVisible(true);
    } else if (service === 'Weight Tracking') {
      setWeightModalVisible(true);
    } else if (service === 'Blood Glucose') {
      setGlucoseModalVisible(true);
    }
  };

  const handlePersonSelect = (person, type) => {
    setBookingTarget({ person, type });
    setSelectedSlot(null);
    setShowSlotsModal(true);
  };

  const handleSlotSelect = (slot) => {
    if (slot.status === 'available') {
      setSelectedSlot(slot);
    }
  };

  const confirmBooking = () => {
    if (!bookingTarget || !selectedSlot) return;
    setUpcomingAppointments(prev => [
      ...prev,
      {
        id: Date.now(),
        person: bookingTarget.person,
        personType: bookingTarget.type,
        slot: selectedSlot,
        status: 'confirmed',
        meetingReady: true,
      },
    ]);
    setShowSlotsModal(false);
    setBookingTarget(null);
    setSelectedSlot(null);
  };

  const joinAppointment = (appointment) => {
    if (!appointment.meetingReady) return;
    navigation.navigate('RPMConnection', {
      caregiver: appointment.personType === 'caregiver' ? appointment.person : undefined,
      provider: appointment.personType === 'provider' ? appointment.person : undefined,
      slot: appointment.slot,
      appointmentData: {
        patientName: fullName,
        patientPhone: phone,
        notes,
      },
    });
  };

  const getFilteredSlots = () => {
    if (!bookingTarget) return [];
    const idField = bookingTarget.type === 'caregiver'
      ? 'caregiverId'
      : bookingTarget.type === 'provider'
        ? 'providerId'
        : 'patientId';
    return timeSlots.filter(
      slot =>
        slot.status === 'available' ||
        (slot.status === 'booked' && slot[idField] === bookingTarget.person.id)
    );
  };

  const bookingSections = userRole === 'provider'
    ? [
      { title: 'Select Caregiver', type: 'caregiver', data: caregivers },
      { title: 'Select Patient', type: 'patient', data: patients },
    ]
    : userRole === 'caregiver'
      ? [
        { title: 'Select Provider', type: 'provider', data: providers },
        { title: 'Select Patient', type: 'patient', data: patients },
      ]
      : [
        { title: 'Select Caregiver', type: 'caregiver', data: caregivers },
        { title: 'Select Provider', type: 'provider', data: providers },
      ];

  const formatAppointmentDate = (dateStr) => {
    try {
      const date = new Date(`${dateStr}T12:00:00`);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch (e) {
      // fall through
    }
    return dateStr;
  };

  const renderPersonCard = (person, type, isSelected) => (
    <TouchableOpacity
      key={`${type}-${person.id}`}
      style={[
        styles.personBox,
        isSelected && styles.personBoxSelected,
      ]}
      onPress={() => handlePersonSelect(person, type)}
    >
      <Image source={person.image} style={styles.personImage} resizeMode="cover" />
      <View style={styles.personInfo}>
        <Text style={styles.personName}>{person.name}</Text>
        <Text style={styles.personSpecialty}>{person.specialty}</Text>
        <Text style={styles.personExperience}>{person.experience} experience</Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color="#9AA3B2" />
    </TouchableOpacity>
  );

  const renderUpcomingAppointment = (appointment) => (
    <View key={appointment.id} style={styles.upcomingCard}>
      <View style={styles.upcomingRow}>
        <View style={styles.upcomingCardContent}>
          <Image source={appointment.person.image} style={styles.upcomingAvatar} resizeMode="cover" />
          <View style={styles.upcomingDetails}>
            <Text style={styles.upcomingName}>{appointment.person.name}</Text>
            <Text style={styles.upcomingRole}>
              {appointment.personType === 'provider'
                ? 'Provider'
                : appointment.personType === 'caregiver'
                  ? 'Caregiver'
                  : 'Patient'}
            </Text>
            <Text style={styles.upcomingMeta}>
              {formatAppointmentDate(appointment.slot.date)} · {appointment.slot.time}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.joinButton,
            !appointment.meetingReady && styles.joinButtonDisabled,
          ]}
          onPress={() => joinAppointment(appointment)}
          disabled={!appointment.meetingReady}
        >
          <Text style={styles.joinButtonText}>JOIN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleSendMessage = () => {
    if (newMessage.trim() === '') return;
    
    const currentTime = new Date();
    const formattedTime = `${currentTime.getHours()}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
    
    const userMessage = {
      id: chatMessages.length + 1,
      sender: 'You',
      message: newMessage.trim(),
      time: formattedTime,
      isUser: true
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    
    setIsTyping(true);
    setTimeout(() => {
      const doctorReplies = [
        "I understand. Let me check that for you.",
        "Thanks for sharing that information.",
        "I'll look into that and get back to you.",
        "That's a good question. Let me find out.",
        "I appreciate you bringing this to my attention.",
        "Let me review your records and respond."
      ];
      
      const randomReply = doctorReplies[Math.floor(Math.random() * doctorReplies.length)];
      const doctorMessage = {
        id: chatMessages.length + 2,
        sender: selectedChat?.caregiver?.name || 'Doctor',
        message: randomReply,
        time: formattedTime,
        isUser: false
      };
      
      setChatMessages(prev => [...prev, doctorMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e) => {
    if (e.nativeEvent.key === 'Enter' && Platform.OS === 'web') {
      handleSendMessage();
    }
  };

  // ✅ FIX 2: Open chat as full screen
  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
    setChatMessages(chat.messages);
    setChatView('chat');
    
    if (unreadChats[chat.id] > 0) {
      setUnreadChats(prev => ({
        ...prev,
        [chat.id]: 0
      }));
    }
  };

  // ✅ FIX 3: Back from chat goes to list, not appointment
  const handleBackToChatList = () => {
    setChatView('list');
    setSelectedChat(null);
  };

  // ✅ FIX 4: Handle main back button properly
  const handleMainBackButton = () => {
    if (chatView === 'chat') {
      // If in chat conversation, go back to chat list
      handleBackToChatList();
    } else {
      // Otherwise go to Home
      navigation.navigate('Home');
    }
  };

  const renderChatList = () => (
    <View style={styles.chatListContainer}>
      <Text style={styles.chatListTitle}>Recent Chats</Text>
      <ScrollView 
        style={styles.chatListScrollView}
        showsVerticalScrollIndicator={false}
      >
        {chatData.map((chat) => (
          <TouchableOpacity
            key={chat.id}
            style={styles.chatListItem}
            onPress={() => handleChatSelect(chat)}
          >
            <View style={styles.chatListItemLeft}>
              <View style={styles.avatarContainer}>
                <Image 
                  source={chat.caregiver.image} 
                  style={styles.chatListAvatar} 
                />
                {chat.caregiver.online && (
                  <View style={styles.onlineIndicator} />
                )}
              </View>
              <View style={styles.chatListItemContent}>
                <View style={styles.chatListItemHeader}>
                  <Text style={styles.chatListItemName}>{chat.caregiver.name}</Text>
                  <Text style={styles.chatListItemTime}>{chat.lastMessageTime}</Text>
                </View>
                <Text style={styles.chatListItemSpecialty}>{chat.caregiver.specialty}</Text>
                <View style={styles.chatListItemFooter}>
                  <Text 
                    style={styles.chatListItemMessage}
                    numberOfLines={1}
                  >
                    {chat.lastMessage}
                  </Text>
                  {unreadChats[chat.id] > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{unreadChats[chat.id]}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ✅ FIX 5: Full screen chat with curved header like appointment
  const renderChatConversation = () => (
    <View style={styles.fullScreenChatContainer}>
      {/* ✅ FIX: Chat Header with Curve like Appointment */}
      <View style={[styles.topDarkSection, {height: scaleHeight(120)}]}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackToChatList}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.centeredHeaderContent}>
            {/* <Text style={styles.headerTitle}>
              Chat
            </Text> */}
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatHeaderName}>{selectedChat?.caregiver?.name}</Text>
              <Text style={styles.chatHeaderStatus}>
                {selectedChat?.caregiver?.online ? 'Online' : 'Offline'} • {selectedChat?.caregiver?.specialty}
              </Text>
            </View>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {/* White section for chat messages */}
      <View style={styles.bottomLightSection}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.chatMainContent}>
              {/* Chat Messages */}
              <ScrollView 
                ref={chatScrollViewRef}
                style={styles.chatMessagesContainer}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.chatMessagesContent}
              >
                {chatMessages.map((message) => (
                  <View 
                    key={message.id}
                    style={[
                      styles.messageContainer,
                      message.isUser ? styles.userMessageContainer : styles.doctorMessageContainer
                    ]}
                  >
                    {!message.isUser && (
                      <Image 
                        source={selectedChat.caregiver.image} 
                        style={styles.messageAvatar} 
                      />
                    )}
                    <View style={[
                      styles.messageBubble,
                      message.isUser ? styles.userMessageBubble : styles.doctorMessageBubble
                    ]}>
                      {!message.isUser && (
                        <Text style={styles.messageSender}>{message.sender}</Text>
                      )}
                      <Text style={[
                        styles.messageText,
                        message.isUser ? styles.userMessageText : styles.doctorMessageText
                      ]}>
                        {message.message}
                      </Text>
                      <Text style={styles.messageTime}>{message.time}</Text>
                    </View>
                  </View>
                ))}
                
                {isTyping && (
                  <View style={[styles.messageContainer, styles.doctorMessageContainer]}>
                    <Image 
                      source={selectedChat.caregiver.image} 
                      style={styles.messageAvatar} 
                    />
                    <View style={[styles.messageBubble, styles.doctorMessageBubble, styles.typingIndicator]}>
                      <Text style={styles.messageSender}>{selectedChat.caregiver.name}</Text>
                      <View style={styles.typingDots}>
                        <View style={styles.typingDot} />
                        <View style={styles.typingDot} />
                        <View style={styles.typingDot} />
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Chat Input */}
              <View style={styles.chatInputContainer}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Type your message..."
                  placeholderTextColor="#999"
                  value={newMessage}
                  onChangeText={setNewMessage}
                  onSubmitEditing={handleSendMessage}
                  onKeyPress={handleKeyPress}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity 
                  style={[
                    styles.sendButton,
                    !newMessage.trim() && styles.sendButtonDisabled
                  ]} 
                  onPress={handleSendMessage}
                  disabled={!newMessage.trim()}
                >
                  <Text style={styles.sendButtonText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </View>
    </View>
  );

  return (
    <SafeAreaProvider>
      <LinearGradient colors={SCREEN_BG_COLORS} style={styles.fullScreenContainer}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        
        <View style={styles.mainContainer}>
          {chatView !== 'chat' && (
            <>
              <View style={styles.topbar}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
                >
                  <MaterialIcons name="arrow-back" size={21} color="#071B34" />
                </TouchableOpacity>
                <Text style={styles.topbarTitle}>Appointments</Text>
                <View style={styles.topbarSpacer} />
              </View>

              <View style={styles.bottomLightSection}>
                <KeyboardAvoidingView
                  style={styles.keyboardContainer}
                  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                  keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView
                      style={styles.scrollViewStyle}
                      contentContainerStyle={styles.contentContainer}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      <Text style={styles.pageHeading}>Your upcoming visits</Text>

                      {upcomingAppointments.length > 0 ? (
                        <View style={styles.upcomingList}>
                          {upcomingAppointments.map(renderUpcomingAppointment)}
                        </View>
                      ) : (
                        <View style={styles.emptyUpcomingCard}>
                          <MaterialIcons name="event-available" size={28} color="#9AA3B2" />
                          <Text style={styles.emptyUpcomingText}>No upcoming appointments yet</Text>
                          <Text style={styles.emptyUpcomingSubtext}>
                            Book with a caregiver or provider below
                          </Text>
                        </View>
                      )}

                      {bookingSections.map(section => (
                        <View key={section.type}>
                          <Text style={styles.sectionTitle}>{section.title}</Text>
                          <View style={styles.personList}>
                            {section.data.map(person =>
                              renderPersonCard(
                                person,
                                section.type,
                                bookingTarget?.type === section.type && bookingTarget?.person?.id === person.id
                              )
                            )}
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
              </View>
            </>
          )}

          {/* ✅ Full Screen Chat View */}
          {chatView === 'chat' && renderChatConversation()}
        </View>
        {chatView !== 'chat' && (
          <PremiumBottomNav active="appointments" navigation={navigation} role={userRole} />
        )}

        {/* All Modals remain unchanged */}
        <Modal
          visible={showSlotsModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSlotsModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.slotsModalBox}>
              <Text style={styles.modalTitle}>
                {bookingTarget
                  ? `${bookingTarget.person.name}'s Available Slots`
                  : 'Select Time Slot'}
              </Text>
              
              <ScrollView style={styles.slotsScrollView}>
                {getFilteredSlots().map(slot => (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.slotItem,
                      slot.status === 'booked' ? styles.bookedSlot : styles.availableSlot,
                      selectedSlot?.id === slot.id && styles.selectedSlot
                    ]}
                    onPress={() => handleSlotSelect(slot)}
                    disabled={slot.status === 'booked'}
                  >
                    <View style={styles.slotInfo}>
                      <Text style={styles.slotTime}>{slot.time}</Text>
                      <Text style={styles.slotDate}>{slot.date}</Text>
                    </View>
                    <View style={styles.slotStatus}>
                      {slot.status === 'booked' ? (
                        <>
                          <Text style={styles.bookedText}>Booked</Text>
                          <Text style={styles.bookedByText}>By: {slot.bookedBy}</Text>
                        </>
                      ) : (
                        <Text style={styles.availableText}>Available</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#ccc' }]}
                  onPress={() => setShowSlotsModal(false)}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
                {selectedSlot && selectedSlot.status === 'available' && (
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.primaryButton }]}
                    onPress={confirmBooking}
                  >
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>Confirm Booking</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={bpModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setBpModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Blood Pressure Readings</Text>
              <TextInput
                placeholder="Systolic"
                value={systolic}
                onChangeText={setSystolic}
                style={styles.modalInput}
                keyboardType="numeric"
              />
              <TextInput
                placeholder="Diastolic"
                value={diastolic}
                onChangeText={setDiastolic}
                style={styles.modalInput}
                keyboardType="numeric"
              />
              <TextInput
                placeholder="Pulse Rate"
                value={pulse}
                onChangeText={setPulse}
                style={styles.modalInput}
                keyboardType="numeric"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#ccc' }]}
                  onPress={() => setBpModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primaryButton }]}
                  onPress={() => {
                    console.log('BP Saved:', { systolic, diastolic, pulse });
                    setBpModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={weightModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setWeightModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Weight Measurement</Text>
              <TextInput
                placeholder="Weight (kg/lbs)"
                value={weight}
                onChangeText={setWeight}
                style={styles.modalInput}
                keyboardType="numeric"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#ccc' }]}
                  onPress={() => setWeightModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primaryButton }]}
                  onPress={() => {
                    console.log('Weight Saved:', weight);
                    setWeightModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={glucoseModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setGlucoseModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Blood Glucose Measurement</Text>
              <TextInput
                placeholder="Glucose Level (mg/dl or mmol/L)"
                value={glucoseLevel}
                onChangeText={setGlucoseLevel}
                style={styles.modalInput}
                keyboardType="numeric"
              />
              <Text style={[styles.sectionTitle, { textAlign: 'center' }]}>Measurement Time</Text>
              <View style={styles.measurementContainer}>
                {['Fasting', 'Preprandial', 'Postprandial'].map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.measurementBox,
                      { borderColor: measurementTime === option ? colors.primaryButton : '#ccc' }
                    ]}
                    onPress={() => setMeasurementTime(option)}
                  >
                    <Text style={styles.measurementText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#ccc' }]}
                  onPress={() => setGlucoseModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primaryButton }]}
                  onPress={() => {
                    console.log('Glucose Saved:', { glucoseLevel, measurementTime });
                    setGlucoseModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    width: '100%',
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Math.max(scaleWidth(16), 16),
    paddingTop: scaleHeight(8),
    paddingBottom: scaleHeight(10),
  },
  topbarTitle: {
    flex: 1,
    color: '#071B34',
    fontSize: scaleFont(20),
    lineHeight: scaleFont(24),
    fontWeight: '800',
    textAlign: 'center',
    marginHorizontal: scaleWidth(8),
  },
  topbarSpacer: {
    width: Math.max(scaleWidth(42), 42),
  },
  backButton: {
    width: Math.max(scaleWidth(42), 42),
    height: Math.max(scaleWidth(42), 42),
    borderRadius: scaleWidth(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    elevation: 3,
  },
  bottomLightSection: {
    flex: 1,
    paddingTop: scaleWidth(8),
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollViewStyle: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: Math.max(scaleWidth(20), 20),
    paddingTop: scaleHeight(8),
    paddingBottom: scaleWidth(130),
  },
  pageHeading: {
    fontSize: scaleFont(22),
    lineHeight: scaleFont(28),
    fontWeight: '800',
    color: '#071B34',
    marginBottom: scaleHeight(14),
  },
  sectionTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: '#071B34',
    marginTop: scaleHeight(20),
    marginBottom: scaleHeight(10),
  },
  upcomingList: {
    marginBottom: scaleHeight(8),
  },
  upcomingCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: scaleWidth(24),
    padding: scaleWidth(16),
    marginBottom: scaleHeight(10),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scaleWidth(10),
  },
  upcomingCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  upcomingAvatar: {
    width: scaleWidth(52),
    height: scaleWidth(52),
    borderRadius: scaleWidth(26),
    marginRight: scaleWidth(12),
  },
  upcomingDetails: {
    flex: 1,
  },
  upcomingName: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#071B34',
    marginBottom: scaleHeight(2),
  },
  upcomingRole: {
    fontSize: scaleFont(12),
    color: '#687382',
    fontWeight: '600',
    marginBottom: scaleHeight(4),
  },
  upcomingMeta: {
    fontSize: scaleFont(13),
    color: '#4A5568',
    fontWeight: '500',
  },
  emptyUpcomingCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: scaleWidth(24),
    padding: scaleWidth(20),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    marginBottom: scaleHeight(8),
  },
  emptyUpcomingText: {
    marginTop: scaleHeight(8),
    fontSize: scaleFont(15),
    fontWeight: '700',
    color: '#071B34',
  },
  emptyUpcomingSubtext: {
    marginTop: scaleHeight(4),
    fontSize: scaleFont(13),
    color: '#687382',
    textAlign: 'center',
  },
  pendingCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: scaleWidth(16),
    padding: scaleWidth(14),
    marginBottom: scaleHeight(10),
    borderWidth: 1,
    borderColor: 'rgba(7,27,52,0.12)',
  },
  pendingText: {
    fontSize: scaleFont(14),
    color: '#687382',
    fontWeight: '600',
    textAlign: 'center',
  },
  personList: {
    marginBottom: scaleHeight(4),
  },
  personBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: scaleWidth(24),
    padding: scaleWidth(12),
    marginBottom: scaleHeight(10),
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
  },
  personBoxSelected: {
    borderColor: '#071B34',
    borderWidth: 2,
  },
  personImage: {
    width: scaleWidth(60),
    height: scaleWidth(60),
    borderRadius: scaleWidth(30),
    marginRight: scaleWidth(12),
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#071B34',
    marginBottom: 4,
  },
  personSpecialty: {
    fontSize: scaleFont(14),
    color: '#687382',
    marginBottom: 4,
  },
  personExperience: {
    fontSize: scaleFont(12),
    color: '#4A5568',
    fontWeight: '500',
  },
  joinButton: {
    backgroundColor: '#071B34',
    borderRadius: scaleWidth(12),
    minWidth: scaleWidth(72),
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: '#B8C0CC',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: scaleFont(12),
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  topDarkSection: {
    backgroundColor: NAVY_BLUE,
    paddingTop: scaleHeight(8),
    paddingBottom: scaleHeight(12),
    paddingHorizontal: Math.max(scaleWidth(16), 16),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  centeredHeaderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: scaleFont(30),
    color: '#071B34',
    fontWeight: '400',
    lineHeight: scaleFont(31),
    marginTop: -2,
  },
  headerSpacer: {
    width: Math.max(scaleWidth(42), 42),
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotsModalBox: {
    width: '90%',
    height: '70%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: scaleWidth(20),
  },
  slotsScrollView: {
    flex: 1,
    marginVertical: scaleHeight(10),
  },
  slotItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scaleWidth(12),
    marginBottom: scaleHeight(8),
    borderRadius: 8,
    borderWidth: 1,
  },
  availableSlot: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  bookedSlot: {
    borderColor: '#F44336',
    backgroundColor: '#FFEBEE',
  },
  selectedSlot: {
    borderWidth: 2,
    borderColor: colors.primaryButton,
  },
  slotInfo: {
    flex: 1,
  },
  slotTime: {
    fontSize: scaleFont(16),
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  slotDate: {
    fontSize: scaleFont(12),
    color: '#666',
  },
  slotStatus: {
    alignItems: 'flex-end',
  },
  availableText: {
    fontSize: scaleFont(14),
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  bookedText: {
    fontSize: scaleFont(14),
    color: '#F44336',
    fontWeight: 'bold',
  },
  bookedByText: {
    fontSize: scaleFont(10),
    color: '#666',
  },
  modalBox: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: scaleWidth(20),
  },
  modalTitle: { 
    fontSize: scaleFont(18), 
    fontWeight: 'bold', 
    marginBottom: scaleHeight(16), 
    color: colors.textPrimary, 
    textAlign: 'center' 
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: scaleWidth(12),
    fontSize: scaleFont(14),
    marginBottom: scaleHeight(12),
  },
  modalButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: scaleHeight(10) 
  },
  modalButton: {
    flex: 1,
    paddingVertical: scaleHeight(14),
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  modalButtonText: { 
    fontSize: scaleFont(14), 
    fontWeight: 'bold' 
  },
  measurementContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: scaleHeight(12),
  },
  measurementBox: {
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: scaleHeight(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  measurementText: {
    fontSize: scaleFont(12),
    color: colors.textPrimary,
    textAlign: 'center',
  },
  chatListContainer: {
    flex: 1,
    marginTop: scaleHeight(0),
  },
  chatListTitle: {
    fontSize: scaleFont(20),
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: scaleHeight(16),
  },
  chatListScrollView: {
    flex: 1,
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(12),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    justifyContent: 'space-between',
  },
  chatListItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  chatListAvatar: {
    width: scaleWidth(50),
    height: scaleWidth(50),
    borderRadius: scaleWidth(25),
    marginRight: scaleWidth(12),
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: scaleHeight(2),
    right: scaleWidth(10),
    width: scaleWidth(12),
    height: scaleWidth(12),
    borderRadius: scaleWidth(6),
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chatListItemContent: {
    flex: 1,
  },
  chatListItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleHeight(4),
  },
  chatListItemName: {
    fontSize: scaleFont(16),
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
  },
  chatListItemTime: {
    fontSize: scaleFont(12),
    color: '#999',
  },
  chatListItemSpecialty: {
    fontSize: scaleFont(12),
    color: '#666',
    marginBottom: scaleHeight(4),
  },
  chatListItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatListItemMessage: {
    fontSize: scaleFont(14),
    color: '#666',
    flex: 1,
    marginRight: scaleWidth(10),
  },
  unreadBadge: {
    backgroundColor: NAVY_BLUE,
    borderRadius: scaleWidth(10),
    minWidth: scaleWidth(20),
    height: scaleWidth(20),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleWidth(6),
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: scaleFont(10),
    fontWeight: 'bold',
  },

  // ✅ Updated Full Screen Chat Styles with curved header
  fullScreenChatContainer: {
    flex: 1,
    backgroundColor: NAVY_BLUE,
  },
  chatMainContent: {
    flex: 1,
  },
  // ✅ Chat header info styles
  chatHeaderInfo: {
    alignItems: 'center',
    marginTop: scaleHeight(4),
  },
  chatHeaderName: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: WHITE,
    marginBottom: scaleHeight(2),
    textAlign: 'center',
  },
  chatHeaderStatus: {
    fontSize: scaleFont(12),
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  chatMessagesContainer: {
    flex: 1,
    paddingHorizontal: scaleWidth(20),
  },
  chatMessagesContent: {
    paddingBottom: scaleHeight(10),
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: scaleHeight(10),
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  doctorMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: scaleWidth(32),
    height: scaleWidth(32),
    borderRadius: scaleWidth(16),
    marginRight: scaleWidth(8),
  },
  messageBubble: {
    maxWidth: '75%',
    padding: scaleWidth(12),
    borderRadius: scaleWidth(16),
  },
  userMessageBubble: {
    backgroundColor: NAVY_BLUE,
    borderBottomRightRadius: scaleWidth(4),
  },
  doctorMessageBubble: {
    backgroundColor: '#F0F0F0',
    borderBottomLeftRadius: scaleWidth(4),
  },
  messageSender: {
    fontSize: scaleFont(11),
    fontWeight: '600',
    color: '#666',
    marginBottom: scaleHeight(4),
  },
  messageText: {
    fontSize: scaleFont(14),
    lineHeight: scaleHeight(20),
  },
  userMessageText: {
    color: '#fff',
  },
  doctorMessageText: {
    color: colors.textPrimary,
  },
  messageTime: {
    fontSize: scaleFont(10),
    color: '#999',
    marginTop: scaleHeight(4),
    alignSelf: 'flex-end',
  },
  typingIndicator: {
    paddingVertical: scaleHeight(8),
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaleHeight(4),
  },
  typingDot: {
    width: scaleWidth(8),
    height: scaleWidth(8),
    borderRadius: scaleWidth(4),
    backgroundColor: '#999',
    marginHorizontal: scaleWidth(2),
    opacity: 0.6,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(12),
    paddingBottom: scaleHeight(20),
    backgroundColor: WHITE,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: scaleWidth(20),
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(10),
    fontSize: scaleFont(14),
    color: colors.textPrimary,
    backgroundColor: '#F9F9F9',
    maxHeight: scaleHeight(80),
  },
  sendButton: {
    backgroundColor: NAVY_BLUE,
    borderRadius: scaleWidth(20),
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(10),
    marginLeft: scaleWidth(10),
    minWidth: scaleWidth(80),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  sendButtonText: {
    color: WHITE,
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
});
