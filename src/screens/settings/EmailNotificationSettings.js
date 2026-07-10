// // components/screens/NotificationSettings.js 

// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   ScrollView,
//   TextInput,
//   Switch,
//   Dimensions,
//   StatusBar,
//   Platform,
//   KeyboardAvoidingView
// } from 'react-native';
// import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
// import { colors, fonts } from '../../config/globall';

// const { width, height } = Dimensions.get('window');

// // Set base design sizes for responsive scaling
// const guidelineBaseWidth = 375;
// const guidelineBaseHeight = 812;

// // Functions to make design responsive
// const scaleWidth = size => (width / guidelineBaseWidth) * size;
// const scaleHeight = size => (height / guidelineBaseHeight) * size;
// const scaleFont = size => scaleWidth(size); // Using scaleWidth for font scaling

// const HEADER_COLOR = colors.primaryButton || '#11224D';
// const WHITE = '#FFFFFF';

// const NotificationSettings = ({ navigation }) => {
//   const [notifications, setNotifications] = useState({
//     appointmentReminders: false,
//     medicationReminders: false,
//     doctorsNotes: false,
//     followUpAlerts: false,
//     abnormalVitals: false,
//     deviceDisconnected: false,
//     emergencyAlerts: true,
//     sendToCaregiver: false,
//     pushNotifications: true,
//     smsNotifications: false,
//   });

//   const [frequency, setFrequency] = useState('instant');
//   const [secondaryEmail, setSecondaryEmail] = useState('');
//   const [caregiverPhone, setCaregiverPhone] = useState('');

//   const toggleSwitch = (key) => {
//     setNotifications({ ...notifications, [key]: !notifications[key] });
//   };

//   const onSave = () => {
//     // TODO: Save preferences to backend
//     console.log("Saved settings:", { notifications, frequency, secondaryEmail, caregiverPhone });
//   };

//   return (
//     <SafeAreaProvider>
//       <SafeAreaView style={styles.fullScreenContainer}>
//         {/* Status Bar */}
//         {/* <StatusBar backgroundColor={HEADER_COLOR} barStyle="light-content" /> */}
        
//         <StatusBar barStyle="default" />


//         <View style={styles.mainContainer}>
//           {/* Header with Back Button - Dark Curved Section */}
//           <View style={styles.topDarkSection}>
//             <View style={styles.headerRow}>
//               <TouchableOpacity
//                 style={styles.backButton}
//                 onPress={() => navigation.goBack()}
//               >
//                 {/* Back Button Text style matches ChangePassword */}
//                 <Text style={styles.backButtonText}>‹</Text>
//               </TouchableOpacity>
//               <Text style={styles.headerTitle}>Notification Settings</Text>
//               <View style={styles.headerSpacer} />
//             </View>
//           </View>

//           {/* White section (Body section) */}
//           <View style={styles.bottomLightSection}>
//             <KeyboardAvoidingView
//               style={styles.keyboardContainer}
//               behavior={Platform.OS === 'ios' ? 'padding' : undefined}
//             >
//               <ScrollView
//                 style={styles.scrollViewStyle}
//                 contentContainerStyle={styles.contentContainer}
//                 showsVerticalScrollIndicator={false}
//               >

//                 {/* Header Content */}
//                 <View style={styles.headerContent}>
//                   <Text style={styles.headerSubtitle}>
//                     Manage how you receive important updates.
//                   </Text>
//                 </View>

//                 {/* General Section */}
//                 <View style={styles.section}>
//                   <Text style={styles.sectionTitle}>GENERAL</Text>
//                   <NotificationOption
//                     label="Appointment Reminders"
//                     value={notifications.appointmentReminders}
//                     onToggle={() => toggleSwitch('appointmentReminders')}
//                   />
//                   <NotificationOption
//                     label="Medication Reminders"
//                     value={notifications.medicationReminders}
//                     onToggle={() => toggleSwitch('medicationReminders')}
//                   />
//                   <NotificationOption
//                     label="Doctor's Notes & Reports"
//                     value={notifications.doctorsNotes}
//                     onToggle={() => toggleSwitch('doctorsNotes')}
//                   />
//                   <NotificationOption
//                     label="Follow-up Alerts"
//                     value={notifications.followUpAlerts}
//                     onToggle={() => toggleSwitch('followUpAlerts')}
//                   />
//                 </View>

//                 {/* Vitals & Alerts Section */}
//                 <View style={styles.section}>
//                   <Text style={styles.sectionTitle}>VITALS & ALERTS</Text>
//                   <NotificationOption
//                     label="Abnormal Vitals Alerts"
//                     value={notifications.abnormalVitals}
//                     onToggle={() => toggleSwitch('abnormalVitals')}
//                   />
//                   <NotificationOption
//                     label="Device Disconnected"
//                     value={notifications.deviceDisconnected}
//                     onToggle={() => toggleSwitch('deviceDisconnected')}
//                   />
//                   <NotificationOption
//                     label="Emergency Alerts (Always ON)"
//                     value={notifications.emergencyAlerts}
//                     onToggle={() => toggleSwitch('emergencyAlerts')}
//                     disabled={true}
//                   />
//                 </View>

//                 {/* Delivery Preferences */}
//                 <View style={styles.section}>
//                   <Text style={styles.sectionTitle}>DELIVERY PREFERENCES</Text>

//                   {/* Email - Fixed to display in one line */}
//                   <View style={styles.preferenceRow}>
//                     <Text style={styles.preferenceLabel}>Primary Email:</Text>
//                     <View style={styles.emailContainer}>
//                       <Text style={styles.preferenceValue} numberOfLines={1}>
//                         user@example.com
//                       </Text>
//                     </View>
//                     <TouchableOpacity>
//                       <Text style={styles.changeText}>Change</Text>
//                     </TouchableOpacity>
//                   </View>

//                   <View style={[styles.frequencyContainer, styles.borderBottom]}>
//                     <Text style={styles.preferenceLabel}>Email Frequency:</Text>
//                     <View style={styles.frequencyOptions}>
//                       <FrequencyOption
//                         label="Instant"
//                         selected={frequency === 'instant'}
//                         onPress={() => setFrequency('instant')}
//                       />
//                       <FrequencyOption
//                         label="Daily"
//                         selected={frequency === 'daily'}
//                         onPress={() => setFrequency('daily')}
//                       />
//                       <FrequencyOption
//                         label="Weekly"
//                         selected={frequency === 'weekly'}
//                         onPress={() => setFrequency('weekly')}
//                       />
//                     </View>
//                   </View>

//                   {/* Push Notifications */}
//                   <NotificationOption
//                     label="Push Notifications"
//                     value={notifications.pushNotifications}
//                     onToggle={() => toggleSwitch('pushNotifications')}
//                   />

//                   {/* SMS Notifications */}
//                   <NotificationOption
//                     label="SMS Notifications"
//                     value={notifications.smsNotifications}
//                     onToggle={() => toggleSwitch('smsNotifications')}
//                     isLast={true} // Add this prop for the last item to remove the separator
//                   />
//                 </View>

//                 {/* Family/Caregiver Section */}
//                 <View style={styles.section}>
//                   <Text style={styles.sectionTitle}>FAMILY / CAREGIVER</Text>
//                   <View style={styles.inputWrapper}>
//                     <TextInput
//                       style={styles.textInput}
//                       placeholder="Secondary Email"
//                       value={secondaryEmail}
//                       onChangeText={setSecondaryEmail}
//                       keyboardType="email-address"
//                       autoCapitalize="none"
//                       placeholderTextColor={colors.textSecondary}
//                     />
//                   </View>
//                   <View style={styles.inputWrapper}>
//                     <TextInput
//                       style={styles.textInput}
//                       placeholder="Caregiver Phone Number"
//                       value={caregiverPhone}
//                       onChangeText={setCaregiverPhone}
//                       keyboardType="phone-pad"
//                       placeholderTextColor={colors.textSecondary}
//                     />
//                   </View>
//                   <NotificationOption
//                     label="Send emergency alerts to caregiver"
//                     value={notifications.sendToCaregiver}
//                     onToggle={() => toggleSwitch('sendToCaregiver')}
//                     isLast={true}
//                   />
//                 </View>

//                 {/* Action Buttons */}
//                 <View style={styles.buttonContainer}>
//                   <TouchableOpacity
//                     style={[styles.button, styles.cancelButton]}
//                     onPress={() => navigation.goBack()}
//                   >
//                     <Text style={styles.cancelButtonText}>Cancel</Text>
//                   </TouchableOpacity>
//                   <TouchableOpacity
//                     style={[styles.button, styles.saveButton]}
//                     onPress={onSave}
//                   >
//                     <Text style={styles.saveButtonText}>Save Preferences</Text>
//                   </TouchableOpacity>
//                 </View>
//               </ScrollView>
//             </KeyboardAvoidingView>
//           </View>
//         </View>
//       </SafeAreaView>
//     </SafeAreaProvider>
//   );
// };

// // 🔹 Sub Components
// const NotificationOption = ({ label, value, onToggle, disabled = false, isLast = false }) => (
//   <View style={[styles.notificationOption, isLast && styles.lastOption]}>
//     <Text style={[styles.optionLabel, disabled && { color: colors.textSecondary }]}>{label}</Text>
//     <Switch
//       trackColor={{ false: colors.borderLight, true: HEADER_COLOR }}
//       thumbColor={colors.textWhite}
//       onValueChange={onToggle}
//       value={value}
//       disabled={disabled}
//     />
//   </View>
// );

// const FrequencyOption = ({ label, selected, onPress }) => (
//   <TouchableOpacity
//     style={[styles.frequencyOption, selected && styles.frequencyOptionSelected]}
//     onPress={onPress}
//   >
//     <Text style={[styles.frequencyOptionText, selected && styles.frequencyOptionTextSelected]}>
//       {label}
//     </Text>
//   </TouchableOpacity>
// );

// // 🔹 Styles
// const styles = StyleSheet.create({
//   fullScreenContainer: {
//     flex: 1,
//     backgroundColor: HEADER_COLOR,
//   },
//   mainContainer: {
//     flex: 1,
//     width: '100%',
//     backgroundColor: HEADER_COLOR,
//   },

//   // --- Header Styles (Matching ChangePassword) ---
//   topDarkSection: {
//     backgroundColor: HEADER_COLOR,
//     height: scaleHeight(120), // Height matched
//     borderBottomLeftRadius: scaleWidth(35), // Curve matched
//     borderBottomRightRadius: scaleWidth(35), // Curve matched
//     paddingBottom: scaleHeight(10),
//     justifyContent: 'flex-start', // Adjusted to keep header content up
//   },
//   headerRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingHorizontal: scaleWidth(20),
//     paddingTop: scaleHeight(20), // Padded from the top
//   },
//   backButton: {
//   padding: 12, // Removed scaleWidth
//   justifyContent: 'center',
//   alignItems: 'left',
//   minHeight: 55, // Removed scaleHeight
//   minWidth: 55, // Removed scaleWidth
// },
//   backButtonText: {
//     fontSize: scaleFont(35), // Font size matched
//     color: WHITE,
//     fontWeight: '300',
//   },
//   headerTitle: {
//   fontSize: scaleFont(22),
//   fontWeight: Platform.OS === 'ios' ? '900' : 'bold',
//   color: WHITE,
//   textAlign: 'center',
//   flex: 1,
//   marginLeft: scaleWidth(5),
//   ...Platform.select({
//     android: {
//       includeFontPadding: false,
//       fontFamily: 'sans-serif-condensed', // Android system font
//     },
//   }),
// },
//   headerSpacer: {
//     width: scaleWidth(36), // Spacer matched
//   },

//   // --- Body Styles (Matching ChangePassword) ---
//   bottomLightSection: {
//     flex: 1,
//     backgroundColor: WHITE,
//     borderTopLeftRadius: scaleWidth(35), // Curve matched
//     borderTopRightRadius: scaleWidth(35), // Curve matched
//     marginTop: -scaleWidth(15), // Overlap matched
//     paddingTop: scaleWidth(20),
//   },
//   keyboardContainer: {
//     flex: 1,
//   },
//   scrollViewStyle: {
//     flex: 1,
//   },
//   contentContainer: {
//     flexGrow: 1,
//     paddingHorizontal: scaleWidth(20),
//     paddingBottom: scaleWidth(40)
//   },

//   // --- Form/Content Styles ---
//   headerContent: {
//     marginBottom: scaleWidth(20),
//     marginTop: scaleWidth(10), // Reduced top margin as padding is in bottomLightSection
//   },
//   headerSubtitle: {
//     // Reusing the style from the original, assuming it looks fine below the new header
//     fontSize: scaleFont(14),
//     fontWeight: '500',
//     color: colors.textSecondary,
//     textAlign: 'center',
//   },
//   section: {
//     borderWidth: 1,
//     borderColor: colors.borderLight, // Using borderLight for a softer look
//     borderRadius: scaleWidth(12), // Increased border radius for a softer look
//     paddingHorizontal: scaleWidth(16),
//     paddingVertical: scaleWidth(8),
//     marginBottom: scaleWidth(20),
//     backgroundColor: WHITE,
//     shadowColor: '#000', // Added shadow for depth
//     shadowOffset: { width: 0, height: 1 },
//     shadowOpacity: 0.1,
//     shadowRadius: 2,
//     elevation: 2,
//   },
//   sectionTitle: {
//     fontSize: scaleFont(14),
//     fontWeight: '700',
//     marginBottom: scaleWidth(8),
//     marginTop: scaleWidth(8), // Padding inside section
//     color: colors.textPrimary,
//     textTransform: 'uppercase',
//   },
//   notificationOption: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingVertical: scaleWidth(10),
//     borderBottomWidth: StyleSheet.hairlineWidth,
//     borderBottomColor: colors.borderLight,
//   },
//   lastOption: {
//     borderBottomWidth: 0,
//   },
//   optionLabel: {
//     fontSize: scaleFont(16),
//     fontWeight: '500',
//     flex: 1,
//     marginRight: scaleWidth(10),
//     color: colors.textPrimary,
//   },
//   preferenceRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingVertical: scaleWidth(10),
//     borderBottomWidth: StyleSheet.hairlineWidth,
//     borderBottomColor: colors.borderLight,
//   },
//   preferenceLabel: {
//     fontSize: scaleFont(16),
//     fontWeight: '500',
//     marginRight: scaleWidth(8),
//     color: colors.textPrimary,
//     flexShrink: 0, // Prevent label from shrinking
//   },
//   emailContainer: {
//     flex: 1,
//     marginRight: scaleWidth(8),
//   },
//   preferenceValue: {
//     fontSize: scaleFont(16),
//     color: colors.textSecondary,
//     flexShrink: 1, // Allow email to shrink if needed
//   },
//   changeText: {
//     fontSize: scaleFont(16),
//     fontWeight: '600',
//     color: HEADER_COLOR,
//     flexShrink: 0, // Prevent change text from shrinking
//   },
//   frequencyContainer: {
//     paddingVertical: scaleWidth(10)
//   },
//   borderBottom: {
//     borderBottomWidth: StyleSheet.hairlineWidth,
//     borderBottomColor: colors.borderLight,
//   },
//   frequencyOptions: {
//     flexDirection: 'row',
//     marginTop: scaleWidth(8),
//     marginBottom: scaleWidth(5),
//   },
//   frequencyOption: {
//     borderWidth: 1,
//     borderColor: colors.borderLight,
//     borderRadius: scaleWidth(20),
//     paddingHorizontal: scaleWidth(16),
//     paddingVertical: scaleWidth(8),
//     marginRight: scaleWidth(8),
//   },
//   frequencyOptionSelected: {
//     backgroundColor: HEADER_COLOR,
//     borderColor: HEADER_COLOR
//   },
//   frequencyOptionText: {
//     fontSize: scaleFont(14),
//     fontWeight: '500',
//     color: colors.textPrimary
//   },
//   frequencyOptionTextSelected: {
//     color: WHITE
//   },
//   inputWrapper: {
//     borderWidth: 1,
//     borderColor: colors.borderLight,
//     borderRadius: scaleWidth(12), // Matched input border radius
//     marginBottom: scaleWidth(12),
//     backgroundColor: WHITE,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 1 },
//     shadowOpacity: 0.1,
//     shadowRadius: 2,
//     elevation: 2,
//   },
//   textInput: {
//     fontSize: scaleFont(16),
//     paddingVertical: scaleHeight(14), // Matched input padding
//     paddingHorizontal: scaleWidth(16),
//     color: colors.textPrimary,
//   },
//   buttonContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginTop: scaleWidth(20)
//   },
//   button: {
//     borderRadius: scaleWidth(12), // Matched save button border radius
//     paddingVertical: scaleHeight(16), // Matched save button padding
//     alignItems: 'center',
//     width: '48%',
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.2,
//     shadowRadius: 4,
//     elevation: 3,
//   },
//   cancelButton: {
//     backgroundColor: WHITE,
//     borderWidth: 1,
//     borderColor: colors.borderLight,
//   },
//   saveButton: {
//     backgroundColor: HEADER_COLOR,
//   },
//   cancelButtonText: {
//     fontSize: scaleFont(18),
//     fontWeight: '700',
//     color: colors.textPrimary
//   },
//   saveButtonText: {
//     fontSize: scaleFont(18),
//     fontWeight: '700',
//     color: WHITE
//   },
// });

// export default NotificationSettings;