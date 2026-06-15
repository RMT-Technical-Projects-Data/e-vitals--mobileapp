import React, { useState } from "react";
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
  SafeAreaView,
  ScrollView,
} from "react-native";
import { colors, fonts } from './config/globall';
import { API_CONFIG } from './config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get("window");

// Set base design sizes for responsive scaling
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Functions to make design responsive
const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

// Define colors for UI
const NAVY_BLUE = colors.primaryButton || '#11224D';
const WHITE = '#FFFFFF';
const LIGHT_GREY = '#F4F7F9';

// Gemini API configuration
const GEMINI_API_KEY = "AIzaSyB7OwSmWiXMhKQ9d09FAxhGT5HlUsasPPE";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const ChatScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([
    {
      id: "1",
      text: "Hello! I'm Dr. Smith, your AI medical assistant. I can analyze your blood pressure, glucose, and weight data to provide health insights. How can I help you today?",
      sender: "doctor"
    }
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [patientData, setPatientData] = useState(null);

  // Fetch patient data for analysis
  const fetchPatientDataForAnalysis = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (!userData) throw new Error('User not found');
      const user = JSON.parse(userData);
      const patientId = user.id || user.patient_id;
      if (!patientId) throw new Error('Patient ID missing');

      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Auth token missing');

      const response = await fetch(`${API_CONFIG.BASE_URL}/patients/${patientId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error(`API failed: ${response.status}`);
      const result = await response.json();
      if (!result.success || !result.data) throw new Error('Invalid response');

      return processPatientData(result.data);
    } catch (error) {
      console.error("Error fetching patient data:", error);
      return null;
    }
  };

  // Process patient data with proper unit handling - ALL WEIGHTS IN KG
  const processPatientData = (data) => {
    if (!data) return null;

    const measurements = data.measurements || {};
    const processed = { measurements: {} };

    // Process Blood Pressure
    if (measurements.bloodPressure) {
      const bp = measurements.bloodPressure;
      processed.measurements.bloodPressure = {
        systolic: bp.systolic || bp.systolic_pressure || null,
        diastolic: bp.diastolic || bp.diastolic_pressure || null,
        pulse: bp.pulse || bp.heart_rate || null,
        date: bp.measure_new_date_time || null,
        unit: 'mmHg'
      };
    }

    // Process Blood Glucose
    if (measurements.bloodGlucose) {
      const bg = measurements.bloodGlucose;
      processed.measurements.bloodGlucose = {
        value: bg.blood_glucose_value_1 || null,
        date: bg.measure_new_date_time || null,
        unit: 'mg/dL'
      };
    }

    // Process Weight - CONVERT TO KG if needed
    if (measurements.weight) {
      const w = measurements.weight;
      let weightValue = parseFloat(w.value || w.weight_value || w.weight || null);
      const originalUnit = (w.unit || w.measurement_unit || 'kg').toLowerCase();

      // Convert to kg if the value is in pounds
      if (originalUnit === 'lb' && weightValue) {
        weightValue = (weightValue * 0.453592).toFixed(1); // Convert pounds to kg
      }

      processed.measurements.weight = {
        value: weightValue,
        date: w.measure_new_date_time || null,
        unit: 'kg' // Always kilograms for analysis
      };
    }

    return processed;
  };

  // System prompt for the AI doctor with concise responses
  const getSystemPrompt = (patientData) => {
    let patientContext = "";

    if (patientData && patientData.measurements) {
      const { bloodPressure, bloodGlucose, weight } = patientData.measurements;

      patientContext = `
CURRENT PATIENT DATA FOR ANALYSIS:

${bloodPressure && bloodPressure.systolic ? `BLOOD PRESSURE: ${bloodPressure.systolic}/${bloodPressure.diastolic} mmHg (Pulse: ${bloodPressure.pulse} bpm)` : 'No BP data'}

${bloodGlucose && bloodGlucose.value ? `BLOOD GLUCOSE: ${bloodGlucose.value} mg/dL` : 'No glucose data'}

${weight && weight.value ? `WEIGHT: ${weight.value} kg` : 'No weight data'}

IMPORTANT UNIT NOTES:
- Weight is in KILOGRAMS (kg)
- Blood pressure in mmHg
- Glucose in mg/dL

MEDICAL GUIDELINES:
- BP: Normal<120/80, Stage1:130-139/80-89, Stage2:≥140/≥90
- Glucose: Normal<100, Prediabetes:100-125, Diabetes:≥126
- Weight analysis based on standard BMI calculations (using kg)

RESPONSE REQUIREMENTS:
1. Keep responses CONCISE - maximum 2-3 sentences for simple questions
2. For analysis requests, focus on key findings only
3. Use bullet points for multiple recommendations
4. Highlight immediate concerns first
5. Avoid lengthy explanations unless specifically requested
`;
    }

    return `You are Dr. Smith, an AI medical assistant. Analyze patient data and provide brief, actionable insights.

CRITICAL: 
- Weight values are in KILOGRAMS (kg)
- Keep responses SHORT and CONCISE unless user asks for detailed explanation
- Focus on key findings and immediate recommendations

${patientContext}

DISCLAIMER: Always include "Consult healthcare professional for medical advice" at the end.`;
  };

  // Function to call Gemini API with patient data context
  const callGeminiAPI = async (userMessage) => {
    try {
      // Fetch latest patient data for each analysis
      const currentPatientData = await fetchPatientDataForAnalysis();
      setPatientData(currentPatientData);

      const systemPrompt = getSystemPrompt(currentPatientData);

      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                { text: `Patient Question: ${userMessage}\n\nPlease provide a concise analysis:` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500, // Reduced for shorter responses
            topP: 0.8,
            topK: 40,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data.candidates && data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text.trim();
      } else {
        throw new Error("Invalid response format from API");
      }
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return "I apologize, but I'm having trouble accessing your medical data right now. Please try again shortly.";
    }
  };

  // Add new message and get AI response
  const sendMessage = async () => {
    if (input.trim().length === 0) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Add user message immediately
    const newUserMessage = {
      id: Date.now().toString(),
      text: userMessage,
      sender: "patient",
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      // Get AI response with patient data analysis
      const aiResponse = await callGeminiAPI(userMessage);

      // Add AI response
      const newDoctorMessage = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        sender: "doctor",
      };
      setMessages(prev => [...prev, newDoctorMessage]);
    } catch (error) {
      console.error("Error in sendMessage:", error);

      // Add error message
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "I apologize for the inconvenience. I'm currently experiencing technical difficulties. Please try again in a moment.",
        sender: "doctor",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick analysis buttons with more specific prompts
  const quickAnalysisOptions = [
    { id: 1, text: "BP status?", prompt: "Briefly analyze my blood pressure status" },
    { id: 2, text: "Glucose check", prompt: "Quick glucose assessment" },
    { id: 3, text: "Weight analysis", prompt: "Short weight health analysis in kg" },
    { id: 4, text: "Overall health", prompt: "Give me a brief overall health summary" }
  ];

  const handleQuickAnalysis = (prompt) => {
    setInput(prompt);
    setTimeout(() => {
      sendMessage();
    }, 100);
  };

  // Render message bubble
  const renderMessage = ({ item }) => (
    <View
      style={[
        styles.messageRow,
        item.sender === "patient" ? styles.rowPatient : styles.rowDoctor,
      ]}
    >
      {item.sender === "doctor" && (
        <View style={[styles.avatar, { backgroundColor: colors.primaryButton }]}>
          <Text style={styles.avatarText}>D</Text>
        </View>
      )}

      <View
        style={[
          styles.messageContainer,
          item.sender === "patient"
            ? styles.patientMessage
            : styles.doctorMessage,
        ]}
      >
        <Text style={styles.messageText}>{item.text}</Text>
      </View>

      {item.sender === "patient" && (
        <View style={[styles.avatar, { backgroundColor: colors.secondaryButton }]}>
          <Text style={styles.avatarText}>P</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.fullScreenContainer}>
      {/* Status Bar — white background, dark content (consistent with DataList) */}
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      <View style={styles.mainContainer}>

        {/* ── HEADER — consistent with DataList/Settings/Profile ── */}
        <View style={styles.topDarkSection}>
          <View style={styles.headerRow}>

            {/* Back Button — absolute left */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>

            {/* Centered Title */}
            <Text style={styles.headerTitle}>Dr. Smith</Text>

          </View>
        </View>

        {/* ── BODY — white section ── */}
        <View style={styles.bottomLightSection}>
          <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            {/* Quick Analysis Buttons */}
            <View style={styles.quickAnalysisContainer}>
              <Text style={styles.quickAnalysisTitle}>Quick Analysis</Text>
              <View style={styles.quickAnalysisButtons}>
                {quickAnalysisOptions.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={styles.quickAnalysisButton}
                    onPress={() => handleQuickAnalysis(option.prompt)}
                    disabled={isLoading}
                  >
                    <Text style={styles.quickAnalysisButtonText}>{option.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Messages */}
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.chatArea}
              showsVerticalScrollIndicator={false}
            />

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ask about your health data..."
                value={input}
                onChangeText={setInput}
                editable={!isLoading}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  isLoading && { opacity: 0.6 }
                ]}
                onPress={sendMessage}
                disabled={isLoading}
              >
                <Text style={styles.sendText}>
                  {isLoading ? "..." : "➤"}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>

      </View>
    </SafeAreaView>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: WHITE, // white so status bar area matches header
  },
  mainContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: WHITE,
  },
  keyboardContainer: {
    flex: 1,
  },

  // ── HEADER — consistent with DataList / Settings / Profile ──
  topDarkSection: {
    backgroundColor: WHITE,
    paddingTop: scaleHeight(20),
    paddingBottom: scaleHeight(20),
    paddingHorizontal: scaleWidth(20),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: scaleHeight(45),
  },
  backButton: {
    position: 'absolute',
    left: 0,
    justifyContent: 'center',
    height: '100%',
    zIndex: 10,
  },
  backButtonText: {
    color: '#0A1C30',
    fontSize: scaleFont(38),
    fontWeight: '300',
    lineHeight: scaleFont(42),
    includeFontPadding: false,
  },
  headerTitle: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: '#0A1C30',
    textAlign: 'center',
  },

  // ── BODY ──
  bottomLightSection: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: scaleWidth(35),
    borderTopRightRadius: scaleWidth(35),
    marginTop: -scaleWidth(15),
    paddingTop: scaleWidth(20),
  },

  // Quick Analysis Section
  quickAnalysisContainer: {
    backgroundColor: WHITE,
    padding: scaleWidth(15),
    borderBottomWidth: 1,
    borderBottomColor: LIGHT_GREY,
    marginHorizontal: scaleWidth(20),
    borderRadius: scaleWidth(10),
    marginBottom: scaleHeight(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickAnalysisTitle: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: NAVY_BLUE,
    marginBottom: scaleHeight(10),
  },
  quickAnalysisButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAnalysisButton: {
    backgroundColor: colors.primaryLight || '#E8F0FE',
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(8),
    borderRadius: scaleWidth(16),
    marginBottom: scaleHeight(8),
    minWidth: '48%',
  },
  quickAnalysisButtonText: {
    fontSize: scaleFont(14),
    color: NAVY_BLUE,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Chat Area
  chatArea: {
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleHeight(20),
    paddingTop: scaleHeight(10),
  },

  // Message Styles
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: scaleHeight(6),
    maxWidth: width * 0.9,
  },
  rowDoctor: {
    justifyContent: "flex-start",
  },
  rowPatient: {
    justifyContent: "flex-end",
    alignSelf: "flex-end",
  },
  avatar: {
    width: scaleWidth(32),
    height: scaleWidth(32),
    borderRadius: scaleWidth(16),
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: scaleWidth(6),
  },
  avatarText: {
    color: WHITE,
    fontWeight: 'bold',
    fontSize: scaleFont(14),
  },
  messageContainer: {
    maxWidth: "70%",
    padding: scaleWidth(12),
    borderRadius: scaleWidth(18),
  },
  patientMessage: {
    backgroundColor: colors.secondaryButton || '#4A6572',
    borderBottomRightRadius: 0,
  },
  doctorMessage: {
    backgroundColor: NAVY_BLUE,
    borderBottomLeftRadius: 0,
  },
  messageText: {
    color: WHITE,
    fontSize: scaleFont(15),
    lineHeight: scaleHeight(20),
  },

  // Input Section
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    padding: scaleWidth(8),
    borderTopWidth: 1,
    borderColor: LIGHT_GREY,
    marginHorizontal: scaleWidth(20),
    marginBottom: scaleHeight(10),
    borderRadius: scaleWidth(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  input: {
    flex: 1,
    backgroundColor: colors.backgroundLight || '#F9F9F9',
    borderRadius: scaleWidth(20),
    paddingHorizontal: scaleWidth(15),
    paddingVertical: scaleHeight(10),
    fontSize: scaleFont(15),
    marginRight: scaleWidth(8),
    color: colors.textPrimary || '#333',
    maxHeight: scaleHeight(100),
  },
  sendButton: {
    backgroundColor: colors.secondaryButton || '#4A6572',
    borderRadius: scaleWidth(20),
    padding: scaleWidth(10),
    width: scaleWidth(40),
    height: scaleWidth(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendText: {
    color: WHITE,
    fontSize: scaleFont(18),
  },
});