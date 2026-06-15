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
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors, fonts } from './config/globall';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

const NAVY_BLUE = colors.primaryButton || '#11224D';
const WHITE = '#FFFFFF';
const LIGHT_GREY = '#F4F7F9';

// Mock data remains the same
const caregivers = [
  {
    id: 1,
    name: 'Dr. Sarah Johnson',
    specialty: 'General Physician',
    experience: '10 years',
    image: require('./android/app/src/assets/images/profile2.png'),
  },
  {
    id: 2,
    name: 'Dr. Michael Chen',
    specialty: 'Cardiologist',
    experience: '15 years',
    image: require('./android/app/src/assets/images/profile1.png'),
  },
  {
    id: 3,
    name: 'Dr. Emily Williams',
    specialty: 'Endocrinologist',
    experience: '8 years',
    image: require('./android/app/src/assets/images/profile2.png'),
  },
];

const timeSlots = [
  { id: 1, time: '09:00 AM', date: '2025-03-15', status: 'available', caregiverId: null },
  { id: 2, time: '10:30 AM', date: '2025-03-15', status: 'booked', caregiverId: 1, bookedBy: 'John Doe' },
  { id: 3, time: '02:00 PM', date: '2025-03-15', status: 'available', caregiverId: null },
  { id: 4, time: '04:00 PM', date: '2025-03-15', status: 'available', caregiverId: null },
  { id: 5, time: '11:00 AM', date: '2025-03-16', status: 'available', caregiverId: null },
  { id: 6, time: '03:30 PM', date: '2025-03-16', status: 'booked', caregiverId: 2, bookedBy: 'Jane Smith' },
];

const chatData = [
  {
    id: 1,
    caregiver: {
      id: 1,
      name: 'Dr. Sarah Johnson',
      specialty: 'General Physician',
      image: require('./android/app/src/assets/images/profile2.png'),
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
      image: require('./android/app/src/assets/images/profile1.png'),
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
      image: require('./android/app/src/assets/images/profile2.png'),
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
  const chatScrollViewRef = useRef(null);

  const [activeTab, setActiveTab] = useState('appointment'); 
  const [chatView, setChatView] = useState('list'); // 'list' or 'chat'
  const [selectedChat, setSelectedChat] = useState(null);

  const [unreadChats, setUnreadChats] = useState({
    1: 2,
    2: 0,
    3: 1,
  });

  const [selectedCaregiver, setSelectedCaregiver] = useState(null);
  const [selectedCommunication, setSelectedCommunication] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [appointmentConfirmed, setAppointmentConfirmed] = useState(false);
  const [caregiverResponse, setCaregiverResponse] = useState(null);
  const [suggestedSlots, setSuggestedSlots] = useState([]);
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [fullNameFocused, setFullNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [notesFocused, setNotesFocused] = useState(false);

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

  const services = ['Blood Pressure', 'Weight Tracking', 'Blood Glucose'];

  // ✅ FIX 1: Reset to appointment tab when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // When screen gains focus, always reset to appointment tab
      setActiveTab('appointment');
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

  const handleServicePress = (service) => {
    if (service === 'Blood Pressure') {
      setBpModalVisible(true);
    } else if (service === 'Weight Tracking') {
      setWeightModalVisible(true);
    } else if (service === 'Blood Glucose') {
      setGlucoseModalVisible(true);
    }
  };

  const handleCaregiverSelect = (caregiver) => {
    setSelectedCaregiver(caregiver);
    setShowSlotsModal(true);
  };

  const handleSlotSelect = (slot) => {
    if (slot.status === 'available') {
      setSelectedSlot(slot);
      sendNotificationToCaregiver(slot);
    }
  };

  const sendNotificationToCaregiver = (slot) => {
    console.log('Notification sent to caregiver:', {
      caregiverId: selectedCaregiver.id,
      slot,
      patientName: fullName,
      patientPhone: phone,
    });
    
    setTimeout(() => {
      const responses = ['confirm', 'cancel', 'suggest'];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      if (randomResponse === 'confirm') {
        setAppointmentConfirmed(true);
        setCaregiverResponse('confirmed');
        console.log('Notification to user: Caregiver has confirmed your appointment');
      } else if (randomResponse === 'cancel') {
        setAppointmentConfirmed(false);
        setCaregiverResponse('cancelled');
        console.log('Notification to user: Caregiver has cancelled the appointment');
      } else if (randomResponse === 'suggest') {
        setCaregiverResponse('suggested');
        const suggestions = [
          { id: 101, time: '02:00 PM', date: '2025-04-15' },
          { id: 102, time: '04:00 PM', date: '2025-04-15' },
        ];
        setSuggestedSlots(suggestions);
        console.log('Notification to user: Caregiver suggests new slots');
      }
    }, 2000);
  };

  const handleSuggestedSlotSelect = (slot) => {
    setSelectedSlot(slot);
    setAppointmentConfirmed(true);
    setCaregiverResponse('confirmed');
    setSuggestedSlots([]);
    console.log('User accepted suggested slot:', slot);
  };

  const joinAppointment = () => {
    navigation.navigate('RPMConnection', {
      caregiver: selectedCaregiver,
      slot: selectedSlot,
      appointmentData: {
        patientName: fullName,
        patientPhone: phone,
        notes,
      }
    });
  };

  const getFilteredSlots = () => {
    if (!selectedCaregiver) return [];
    return timeSlots.filter(slot => 
      slot.status === 'available' || 
      (slot.status === 'booked' && slot.caregiverId === selectedCaregiver.id)
    );
  };

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
      <SafeAreaView style={styles.fullScreenContainer}>
        <StatusBar barStyle="default" />
        
        <View style={styles.mainContainer}>
          {/* ✅ Conditional Header - Only show when NOT in full chat */}
          {chatView !== 'chat' && (
            <>
              {/* Header - Navy Blue Bar */}
              <View style={[styles.topDarkSection, {height: scaleHeight(120)}]}>
                <View style={styles.headerRow}>
                  <TouchableOpacity 
                    style={styles.backButton}
                    onPress={handleMainBackButton}
                  >
                    <Text style={styles.backButtonText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.headerTitle}>
                    {activeTab === 'chat' ? 'Chat' : 'Appointment'}
                  </Text>
                  <View style={styles.headerSpacer} />
                </View>
              </View>

              {/* White section (Body section) */}
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
                      
                      {/* Tab Buttons */}
                      <View style={styles.tabRow}>
                        <TouchableOpacity
                          style={[
                            styles.tabButton,
                            activeTab === 'appointment' && styles.activeTab
                          ]}
                          onPress={() => setActiveTab('appointment')}
                        >
                          <Text
                            style={[
                              styles.tabText,
                              activeTab === 'appointment' && styles.activeTabText
                            ]}
                          >
                            Appointment
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.tabButton,
                            activeTab === 'chat' && styles.activeTab
                          ]}
                          onPress={() => setActiveTab('chat')}
                        >
                          <Text
                            style={[
                              styles.tabText,
                              activeTab === 'chat' && styles.activeTabText
                            ]}
                          >
                            Chat
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Appointment Content */}
                      {activeTab === 'appointment' && (
                        <>
                          <Text style={styles.sectionTitle}>Select Caregiver</Text>
                          <View style={styles.caregiverContainer}>
                            {caregivers.map(caregiver => (
                              <TouchableOpacity
                                key={caregiver.id}
                                style={[
                                  styles.caregiverBox,
                                  { 
                                    borderColor: selectedCaregiver?.id === caregiver.id ? '#3d4d75ce' : '#ccc',
                                    borderWidth: selectedCaregiver?.id === caregiver.id ? 2 : 1,
                                  }
                                ]}
                                onPress={() => handleCaregiverSelect(caregiver)}
                              >
                                <Image source={caregiver.image} style={styles.caregiverImage} resizeMode="cover" />
                                <View style={styles.caregiverInfo}>
                                  <Text style={styles.caregiverName}>{caregiver.name}</Text>
                                  <Text style={styles.caregiverSpecialty}>{caregiver.specialty}</Text>
                                  <View style={styles.caregiverStats}>
                                    <Text style={styles.caregiverExperience}>📅 {caregiver.experience}</Text>
                                  </View>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>

                          {appointmentConfirmed && selectedCaregiver && selectedSlot && (
                            <View style={styles.appointmentCard}>
                              <Text style={styles.appointmentTitle}>Confirmed Appointment</Text>
                              <View style={styles.appointmentDetails}>
                                <Text style={styles.appointmentText}>Caregiver: {selectedCaregiver.name}</Text>
                                <Text style={styles.appointmentText}>Date: {selectedSlot.date}</Text>
                                <Text style={styles.appointmentText}>Time: {selectedSlot.time}</Text>
                              </View>
                              <TouchableOpacity style={styles.joinButton} onPress={joinAppointment}>
                                <Text style={styles.joinButtonText}>Join Appointment</Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {caregiverResponse === 'cancelled' && (
                            <View style={styles.cancelledCard}>
                              <Text style={styles.cancelledText}>No Appointments</Text>
                              <Text style={styles.cancelledSubText}>Caregiver has cancelled the appointment</Text>
                            </View>
                          )}

                          {suggestedSlots.length > 0 && (
                            <View style={styles.suggestedSlotsContainer}>
                              <Text style={styles.sectionTitle}>Caregiver Suggested New Slots</Text>
                              {suggestedSlots.map(slot => (
                                <TouchableOpacity
                                  key={slot.id}
                                  style={styles.suggestedSlot}
                                  onPress={() => handleSuggestedSlotSelect(slot)}
                                >
                                  <Text style={styles.suggestedSlotText}>{slot.date} at {slot.time}</Text>
                                  <Text style={styles.selectSlotText}>Select this slot</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}

                          {!appointmentConfirmed && caregiverResponse !== 'cancelled' && suggestedSlots.length === 0 && (
                            <TouchableOpacity 
                              style={styles.bookButton}
                              onPress={() => {
                                if (selectedCaregiver && fullName && phone) {
                                  setShowSlotsModal(true);
                                } else {
                                  alert('Please select a caregiver and fill in your information');
                                }
                              }}
                            >
                              <Text style={styles.bookButtonText}>Book Appointment</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                      
                      {/* Chat List Content */}
                      {activeTab === 'chat' && chatView === 'list' && renderChatList()}
                      
                    </ScrollView>
                  </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
              </View>
            </>
          )}

          {/* ✅ Full Screen Chat View */}
          {chatView === 'chat' && renderChatConversation()}
        </View>

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
                {selectedCaregiver ? `${selectedCaregiver.name}'s Available Slots` : 'Select Time Slot'}
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
                    onPress={() => {
                      console.log('Booking slot:', selectedSlot);
                      setShowSlotsModal(false);
                    }}
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
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: NAVY_BLUE,
  },
  mainContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: NAVY_BLUE,
  },
  topDarkSection: {
    backgroundColor: NAVY_BLUE,
    height: scaleHeight(120),
    borderBottomLeftRadius: scaleWidth(35),
    borderBottomRightRadius: scaleWidth(35),
    paddingBottom: scaleHeight(10),
    justifyContent: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(20),
  },
  // ✅ FIX: Add centered header content for chat
  // centeredHeaderContent: {
  //   flex: 1,
  //   alignItems: 'center',
  //   marginLeft: scaleWidth(-55), // Compensate for back button width
  // },
  centeredHeaderContent: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
},
  backButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'left',
    minHeight: 55,
    minWidth: 55,
  },
  backButtonText: {
    fontSize: scaleFont(35),
    color: WHITE,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: scaleFont(22),
    fontWeight: Platform.OS === 'ios' ? '900' : 'bold',
    color: WHITE,
    textAlign: 'center',
    ...Platform.select({
      android: {
        includeFontPadding: false,
        fontFamily: 'sans-serif-condensed',
      },
    }),
  },
  headerSpacer: {
    width: 55,
  },
  bottomLightSection: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: scaleWidth(35),
    borderTopRightRadius: scaleWidth(35),
    marginTop: -scaleWidth(15),
    paddingTop: scaleWidth(20),
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollViewStyle: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleWidth(40)
  },
  sectionTitle: { 
    fontSize: scaleFont(16), 
    fontWeight: 'bold', 
    color: colors.textPrimary, 
    marginTop: scaleHeight(16), 
    marginBottom: scaleHeight(8) 
  },
  caregiverContainer: {
    marginBottom: scaleHeight(12),
  },
  caregiverBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: scaleWidth(12),
    marginBottom: scaleHeight(10),
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  caregiverImage: {
    width: scaleWidth(60),
    height: scaleWidth(60),
    borderRadius: scaleWidth(30),
    marginRight: scaleWidth(12),
  },
  caregiverInfo: {
    flex: 1,
  },
  caregiverName: {
    fontSize: scaleFont(16),
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  caregiverSpecialty: {
    fontSize: scaleFont(14),
    color: '#666',
    marginBottom: 6,
  },
  caregiverStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  caregiverExperience: {
    fontSize: scaleFont(12),
    color: colors.textPrimary,
  },
  appointmentCard: {
    backgroundColor: '#ffffffff',
    borderRadius: 12,
    padding: scaleWidth(16),
    marginTop: scaleHeight(16),
    borderWidth: 1,
    borderColor: '#11224D',
  },
  appointmentTitle: {
    fontSize: scaleFont(18),
    fontWeight: 'bold',
    color: '#11224D',
    marginBottom: scaleHeight(8),
    textAlign: 'center',
  },
  appointmentDetails: {
    marginBottom: scaleHeight(12),
  },
  appointmentText: {
    fontSize: scaleFont(14),
    color: colors.textPrimary,
    marginBottom: scaleHeight(4),
  },
  joinButton: {
    backgroundColor: '#11224dce',
    borderRadius: 8,
    paddingVertical: scaleHeight(12),
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: scaleFont(16),
    fontWeight: 'bold',
  },
  cancelledCard: {
    backgroundColor: '#fcfcfcff',
    borderRadius: 12,
    padding: scaleWidth(16),
    marginTop: scaleHeight(16),
    borderWidth: 1,
    borderColor: '#b8b6b6ff',
    alignItems: 'center',
  },
  cancelledText: {
    fontSize: scaleFont(18),
    fontWeight: 'bold',
    color: '#11224D',
    marginBottom: scaleHeight(4),
  },
  cancelledSubText: {
    fontSize: scaleFont(14),
    color: '#666',
    textAlign: 'center',
  },
  suggestedSlotsContainer: {
    marginTop: scaleHeight(16),
  },
  suggestedSlot: {
    backgroundColor: '#f1f2f3ff',
    borderRadius: 8,
    padding: scaleWidth(12),
    marginBottom: scaleHeight(8),
    borderWidth: 1,
    borderColor: '#c0c0c0ce',
  },
  suggestedSlotText: {
    fontSize: scaleFont(14),
    color: colors.textPrimary,
    fontWeight: 'bold',
    marginBottom: scaleHeight(4),
  },
  selectSlotText: {
    fontSize: scaleFont(12),
    color: '#11224dce',
    textAlign: 'center',
  },
  bookButton: {
    backgroundColor: colors.primaryButton,
    borderRadius: 12,
    width: '100%',
    paddingVertical: scaleHeight(18),
    alignItems: 'center',
    marginTop: scaleHeight(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bookButtonText: { 
    color: '#fff', 
    fontSize: scaleFont(16), 
    fontWeight: 'bold' 
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
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F4F7F9',
    borderRadius: 10,
    marginBottom: scaleHeight(16),
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    paddingVertical: scaleHeight(12),
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: NAVY_BLUE,
  },
  tabText: {
    fontSize: scaleFont(14),
    color: '#333',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
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