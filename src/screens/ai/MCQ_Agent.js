import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../config/globall';
import { API_CONFIG } from '../../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GlucoseAssessment from './GlucoseAssessment';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

const MAIN_THEME_COLOR = colors.primaryButton || '#11224D';
const PRIMARY_ACCENT = MAIN_THEME_COLOR;

// Gemini API Configuration
const GEMINI_API_KEY = "AIzaSyB7OwSmWiXMhKQ9d09FAxhGT5HlUsasPPE";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const MCQ_Agent = ({ navigation, route }) => {
  const { alertType, notificationData } = route.params;
  if (alertType === 'bloodGlucose') {
    return <GlucoseAssessment navigation={navigation} route={route} />;
  }
  const [patientData, setPatientData] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [storedAssessment, setStoredAssessment] = useState(null);
  const [bpAssessmentFlow, setBpAssessmentFlow] = useState([]);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => {
    if (alertType === 'bloodPressure') {
      generateBPAssessmentFlow();
    } else {
      // Keep existing logic for glucose and weight
      fetchPatientData();
    }
  }, [alertType]);

  // Generate BP Assessment Flow using Gemini AI
  const generateBPAssessmentFlow = async () => {
    try {
      setLoading(true);
      
      const systemPrompt = `You are a medical AI assistant creating a blood pressure assessment flow. Generate a step-by-step assessment with independent paths that each end with summary generation.

  Create a flow with the EXACT structure:

  1. Physical activity question: 
    - "Yes" leads directly to completion with rest instruction
    - "No" leads to assessment choice between two paths

  2. Assessment choice: User selects ONE path only
    - Substance intake assessment OR Medication adherence assessment

  3. Independent paths:
    - Substance path: Single question → Completion
    - Medication path: 
      - "Yes" → Symptom assessment → Completion
      - "No" → Medication instruction → Completion

  4. Each path ends independently with completion and summary generation

  RETURN ONLY VALID JSON in this exact format:
  {
    "assessment": [
      {
        "id": "physicalActivity",
        "type": "single",
        "question": "Were you rushing or physically active before measurements?",
        "options": ["Yes", "No"],
        "nextStep": {
          "Yes": 1,
          "No": 2
        }
      },
      {
        "id": "restCompletion",
        "type": "completion",
        "title": "Rest Required",
        "message": "Please rest for 10-15 minutes in a quiet environment and retake your blood pressure measurements for accurate results.",
        "buttonText": "Generate Assessment Summary"
      },
      {
        "id": "assessmentChoice",
        "type": "single",
        "question": "Which factor would you like to assess?",
        "options": [
          "Did you consume caffeine, nicotine, or alcohol before measurement?",
          "Did you take your prescribed blood pressure medication?"
        ],
        "nextStep": {
          "Did you consume caffeine, nicotine, or alcohol before measurement?": 3,
          "Did you take your prescribed blood pressure medication?": 4
        }
      },
      {
        "id": "substanceIntake",
        "type": "single",
        "question": "Did you consume caffeine, nicotine, or alcohol before the measurement?",
        "options": ["Yes", "No"],
        "nextStep": 5
      },
      {
        "id": "medicationAdherence",
        "type": "single",
        "question": "Did you take your prescribed blood pressure medication?",
        "options": ["Yes", "No"],
        "nextStep": {
          "Yes": 6,
          "No": 7
        }
      },
      {
        "id": "substanceCompletion",
        "type": "completion",
        "title": "Assessment Complete",
        "message": "Thank you for completing the substance intake assessment.",
        "buttonText": "Generate Assessment Summary"
      },
      {
        "id": "symptomAssessment",
        "type": "multiple",
        "question": "Do you have any of the following symptoms? (Select all that apply)",
        "options": [
          "Shortness of breath",
          "Chest pain / Pressure",
          "Palpitations",
          "Dizziness / Light headedness",
          "Headaches",
          "Blurred vision",
          "Nausea",
          "Swelling in legs or ankles"
        ],
        "nextStep": 8
      },
      {
        "id": "medicationInstruction",
        "type": "completion",
        "title": "Medication Reminder",
        "message": "Please take your prescribed blood pressure medication as directed and retake your measurements after 1 hour for accurate assessment.",
        "buttonText": "Generate Assessment Summary"
      },
      {
        "id": "finalCompletion",
        "type": "completion",
        "title": "Assessment Complete",
        "message": "Thank you for completing the blood pressure assessment.",
        "buttonText": "Generate Assessment Summary"
      }
    ]
  }

  IMPORTANT: Each path must end with completion type and generate summary independently. No returning to unselected questions.`;

      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { 
            temperature: 0.3, 
            maxOutputTokens: 2000,
            topK: 40,
            topP: 0.95
          }
        }),
      });

      if (!response.ok) throw new Error('API request failed');
      
      const data = await response.json();
      const responseText = data.candidates[0].content.parts[0].text;
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const flowData = JSON.parse(jsonMatch[0]);
        setBpAssessmentFlow(flowData.assessment || []);
      } else {
        throw new Error('Invalid JSON response from AI');
      }
    } catch (error) {
      console.error("Error generating BP assessment flow:", error);
      // Fallback to updated default flow
      setBpAssessmentFlow(getFallbackBPAssessmentFlow());
    } finally {
      setLoading(false);
    }
  };

  // Fallback flow in case AI fails
// Fallback flow in case AI fails - UPDATED to match new structure
  const getFallbackBPAssessmentFlow = () => {
    return [
      {
        id: 'physicalActivity',
        type: 'single',
        question: "Were you rushing or physically active before measurements?",
        options: ["Yes", "No"],
        nextStep: {
          "Yes": 1,
          "No": 2
        }
      },
      {
        id: 'restCompletion',
        type: 'completion',
        title: "Rest Required",
        message: "Please rest for 10-15 minutes in a quiet environment and retake your blood pressure measurements for accurate results.",
        buttonText: "Generate Assessment Summary"
      },
      {
        id: 'assessmentChoice',
        type: 'single',
        question: "Which factor would you like to assess?",
        options: [
          "Did you consume caffeine, nicotine, or alcohol before measurement?",
          "Did you take your prescribed blood pressure medication?"
        ],
        nextStep: {
          "Did you consume caffeine, nicotine, or alcohol before measurement?": 3,
          "Did you take your prescribed blood pressure medication?": 4
        }
      },
      {
        id: 'substanceIntake',
        type: 'single',
        question: "Did you consume caffeine, nicotine, or alcohol before the measurement?",
        options: ["Yes", "No"],
        nextStep: 5  // Direct to completion - NOT an object
      },
      {
        id: 'medicationAdherence',
        type: 'single',
        question: "Did you take your prescribed blood pressure medication?",
        options: ["Yes", "No"],
        nextStep: {
          "Yes": 6,
          "No": 7
        }
      },
      {
        id: 'substanceCompletion',
        type: 'completion',
        title: "Substance Assessment Complete",
        message: "Thank you for completing the substance intake assessment.",
        buttonText: "Generate Assessment Summary"
      },
      {
        id: 'symptomAssessment',
        type: 'multiple',
        question: "Do you have any of the following symptoms? (Select all that apply)",
        options: [
          "Shortness of breath",
          "Chest pain / Pressure",
          "Palpitations",
          "Dizziness / Light headedness",
          "Headaches",
          "Blurred vision",
          "Nausea",
          "Swelling in legs or ankles"
        ],
        nextStep: 8
      },
      {
        id: 'medicationInstruction',
        type: 'completion',
        title: "Medication Reminder",
        message: "Please take your prescribed blood pressure medication as directed and retake your measurements after 1 hour for accurate assessment.",
        buttonText: "Generate Assessment Summary"
      },
      {
        id: 'finalCompletion',
        type: 'completion',
        title: "Assessment Complete",
        message: "Thank you for completing the blood pressure assessment.",
        buttonText: "Generate Assessment Summary"
      }
    ];
  };

  const fetchPatientData = async () => {
    // Existing glucose/weight logic remains the same
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
      
      if (result.success && result.data) {
        setPatientData(result.data);
        if (alertType !== 'bloodPressure') {
          generateSymptomQuestions(result.data);
        }
      }
    } catch (error) {
      console.error("Error fetching patient data:", error);
      setLoading(false);
    }
  };

  // Generate AI-powered summary
  const generateAISummary = async () => {
    try {
      setGeneratingSummary(true);
      
      const systemPrompt = `You are a medical AI analyzing a patient's blood pressure assessment responses. Create a comprehensive clinical summary and recommendations.

PATIENT ASSESSMENT RESPONSES:
${JSON.stringify(answers, null, 2)}

Generate a professional medical summary that includes:

1. **Assessment Overview**: Brief summary of the patient's pre-measurement conditions
2. **Clinical Findings**: Analysis of reported symptoms and their potential significance
3. **Risk Factors**: Identified risk factors based on responses
4. **Recommendations**: Specific, actionable medical advice including:
   - When to retake measurements
   - Medication adherence guidance
   - Lifestyle modifications
   - When to seek immediate medical attention
5. **Follow-up Plan**: Suggested next steps for monitoring

Format the response in clear, patient-friendly language with sections. Be empathetic but clinically accurate.`;

      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { 
            temperature: 0.4, 
            maxOutputTokens: 1500,
            topK: 40,
            topP: 0.95
          }
        }),
      });

      if (!response.ok) throw new Error('API request failed');
      
      const data = await response.json();
      const aiSummary = data.candidates[0].content.parts[0].text;
      
      return aiSummary;
    } catch (error) {
      console.error("Error generating AI summary:", error);
      return "Unable to generate AI summary at this time. Please consult with your healthcare provider for a comprehensive assessment.";
    } finally {
      setGeneratingSummary(false);
    }
  };

  const storeAssessment = async () => {
    try {
      setGeneratingSummary(true);
      
      const aiSummary = await generateAISummary();
      const basicSummary = generateBasicSummary();
      
      const storedAssessment = {
        id: `bp-assessment-${Date.now()}`,
        type: 'Store',
        title: 'BP Assessment Summary',
        message: `Blood pressure assessment completed with ${basicSummary.totalSymptoms} symptoms reported`,
        date: new Date().toISOString(),
        read: false,
        summary: {
          ...basicSummary,
          aiAnalysis: aiSummary
        },
        severity: 'info'
      };

      // Store in AsyncStorage
      const existingNotifications = await AsyncStorage.getItem('storedAssessments');
      const notifications = existingNotifications ? JSON.parse(existingNotifications) : [];
      notifications.unshift(storedAssessment);
      await AsyncStorage.setItem('storedAssessments', JSON.stringify(notifications));

      setStoredAssessment(storedAssessment);
      setShowSummary(true);
      
      Alert.alert(
        "Assessment Stored",
        "Your blood pressure assessment has been saved with AI-generated analysis.",
        [
          {
            text: "View Summary",
            onPress: () => setShowSummary(true)
          },
          {
            text: "Done",
            onPress: () => navigation.goBack()
          }
        ]
      );

    } catch (error) {
      console.error("Error storing assessment:", error);
      Alert.alert("Error", "Failed to store assessment. Please try again.");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const generateBasicSummary = () => {
    const physicalActivity = answers['physicalActivity'];
    const substanceIntake = answers['substanceIntake'];
    const medicationTaken = answers['medicationAdherence'];
    const selectedSymptoms = answers['symptomAssessment'] || [];

    return {
      physicalActivity,
      substanceIntake,
      medicationTaken,
      selectedSymptoms,
      assessmentDate: new Date().toLocaleString(),
      totalSymptoms: selectedSymptoms.length
    };
  };

  // Rest of the component functions remain the same...
  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleMultipleSelect = (questionId, option) => {
    setAnswers(prev => {
      const currentAnswers = prev[questionId] || [];
      const isSelected = currentAnswers.includes(option);
      
      if (isSelected) {
        return {
          ...prev,
          [questionId]: currentAnswers.filter(item => item !== option)
        };
      } else {
        return {
          ...prev,
          [questionId]: [...currentAnswers, option]
        };
      }
    });
  };

  // const goToNextStep = () => {
  //   const currentQuestion = bpAssessmentFlow[currentStep];
    
  //   if (currentQuestion.type === 'single') {
  //     const answer = answers[currentQuestion.id];
  //     if (answer && currentQuestion.nextStep[answer] !== undefined) {
  //       setCurrentStep(currentQuestion.nextStep[answer]);
  //     }
  //   } else if (currentQuestion.type === 'instruction' || currentQuestion.type === 'multiple') {
  //     setCurrentStep(currentQuestion.nextStep);
  //   }
  // };
  const goToNextStep = () => {
    const currentQuestion = bpAssessmentFlow[currentStep];
    
    if (currentQuestion.type === 'single') {
      const answer = answers[currentQuestion.id];
      
      // Handle both object nextStep and direct number nextStep
      if (typeof currentQuestion.nextStep === 'object') {
        // Object format: nextStep: {"Yes": 1, "No": 2}
        if (answer && currentQuestion.nextStep[answer] !== undefined) {
          setCurrentStep(currentQuestion.nextStep[answer]);
        }
      } else if (typeof currentQuestion.nextStep === 'number') {
        // Direct number format: nextStep: 5
        if (answer) {
          setCurrentStep(currentQuestion.nextStep);
        }
      }
    } else if (currentQuestion.type === 'instruction' || currentQuestion.type === 'multiple') {
      setCurrentStep(currentQuestion.nextStep);
    }
  };

  const canProceed = () => {
    const currentQuestion = bpAssessmentFlow[currentStep];
    
    switch (currentQuestion.type) {
      case 'single':
        return !!answers[currentQuestion.id];
      case 'multiple':
        const selectedSymptoms = answers[currentQuestion.id] || [];
        return selectedSymptoms.length > 0;
      case 'instruction':
      case 'completion':
        return true;
      default:
        return false;
    }
  };

  const renderQuestion = () => {
    if (bpAssessmentFlow.length === 0) return null;
    
    const currentQuestion = bpAssessmentFlow[currentStep];
    
    switch (currentQuestion.type) {
      case 'single':
        return (
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>{currentQuestion.question}</Text>
            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionButton,
                    answers[currentQuestion.id] === option && styles.selectedOption
                  ]}
                  onPress={() => handleAnswer(currentQuestion.id, option)}
                >
                  <Text style={[
                    styles.optionText,
                    answers[currentQuestion.id] === option && styles.selectedOptionText
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'multiple':
        const selectedSymptoms = answers[currentQuestion.id] || [];
        return (
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>{currentQuestion.question}</Text>
            <View style={styles.multipleOptionsContainer}>
              {currentQuestion.options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.multipleOptionButton,
                    selectedSymptoms.includes(option) && styles.selectedMultipleOption
                  ]}
                  onPress={() => handleMultipleSelect(currentQuestion.id, option)}
                >
                  <View style={styles.checkboxContainer}>
                    <View style={[
                      styles.checkbox,
                      selectedSymptoms.includes(option) && styles.checkedCheckbox
                    ]}>
                      {selectedSymptoms.includes(option) && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                  </View>
                  <Text style={[
                    styles.multipleOptionText,
                    selectedSymptoms.includes(option) && styles.selectedMultipleOptionText
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'instruction':
      case 'completion':
        return (
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionTitle}>{currentQuestion.title}</Text>
            <Text style={styles.instructionMessage}>{currentQuestion.message}</Text>
            {currentQuestion.type === 'completion' && storedAssessment && (
              <TouchableOpacity 
                style={styles.viewSummaryButton}
                onPress={() => setShowSummary(true)}
              >
                <Text style={styles.viewSummaryButtonText}>View Stored Summary</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  const getProgress = () => {
    if (bpAssessmentFlow.length === 0) return 0;
    return ((currentStep + 1) / bpAssessmentFlow.length) * 100;
  };

  if (alertType !== 'bloodPressure') {
    // Render existing glucose/weight UI
    return null; // Placeholder
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.fullScreenContainer}>
        <StatusBar backgroundColor={MAIN_THEME_COLOR} barStyle="light-content" />

        <View style={styles.mainContainer}>
          {/* Header */}
          <View style={styles.topDarkSection}>
            <View style={styles.headerRow}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.screenTitle}>BP Assessment</Text>
              <View style={styles.placeholder} />
            </View>
            
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${getProgress()}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                Step {currentStep + 1} of {bpAssessmentFlow.length}
              </Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.bottomLightSection}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={PRIMARY_ACCENT} />
                  <Text style={styles.loadingText}>Generating assessment questions...</Text>
                </View>
              ) : bpAssessmentFlow.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Unable to load assessment. Please try again.</Text>
                </View>
              ) : (
                <>
                  {renderQuestion()}
                  
                  {canProceed() && (
                    <TouchableOpacity 
                      style={styles.nextButton}
                      onPress={() => {
                        if (bpAssessmentFlow[currentStep].type === 'completion') {
                          storeAssessment();
                        } else {
                          goToNextStep();
                        }
                      }}
                      disabled={generatingSummary}
                    >
                      {generatingSummary ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text style={styles.nextButtonText}>
                          {bpAssessmentFlow[currentStep].type === 'completion' 
                            ? 'Generate Assessment Summary'
                            : bpAssessmentFlow[currentStep].type === 'instruction'
                            ? bpAssessmentFlow[currentStep].buttonText
                            : 'Continue'
                          }
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>

        {/* Summary Modal */}
        <Modal
          visible={showSummary}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowSummary(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>AI Assessment Summary</Text>
              
              {storedAssessment && (
                <ScrollView style={styles.summaryContent}>
                  <View style={styles.summarySection}>
                    <Text style={styles.summaryLabel}>Assessment Date:</Text>
                    <Text style={styles.summaryValue}>{storedAssessment.summary.assessmentDate}</Text>
                  </View>
                  
                  <View style={styles.summarySection}>
                    <Text style={styles.summaryLabel}>Pre-Measurement Conditions:</Text>
                    <Text style={styles.summaryValue}>Physical Activity: {storedAssessment.summary.physicalActivity}</Text>
                    <Text style={styles.summaryValue}>Substance Intake: {storedAssessment.summary.substanceIntake}</Text>
                    <Text style={styles.summaryValue}>Medication Taken: {storedAssessment.summary.medicationTaken}</Text>
                  </View>
                  
                  <View style={styles.summarySection}>
                    <Text style={styles.summaryLabel}>Reported Symptoms ({storedAssessment.summary.totalSymptoms}):</Text>
                    {storedAssessment.summary.selectedSymptoms.map((symptom, index) => (
                      <Text key={index} style={styles.symptomItem}>• {symptom}</Text>
                    ))}
                    {storedAssessment.summary.selectedSymptoms.length === 0 && (
                      <Text style={styles.noSymptoms}>No symptoms reported</Text>
                    )}
                  </View>
                  
                  <View style={styles.summarySection}>
                    <Text style={styles.summaryLabel}>AI Medical Analysis:</Text>
                    <Text style={styles.aiAnalysisText}>{storedAssessment.summary.aiAnalysis}</Text>
                  </View>
                </ScrollView>
              )}
              
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowSummary(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

// Add this new style for AI analysis text
const styles = StyleSheet.create({
  // ... keep all your existing styles ...
  
  aiAnalysisText: {
    fontSize: scaleFont(14),
    color: colors.textPrimary,
    lineHeight: scaleHeight(20),
    marginTop: scaleHeight(8),
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: MAIN_THEME_COLOR,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: MAIN_THEME_COLOR,
  },
  topDarkSection: {
    backgroundColor: MAIN_THEME_COLOR,
    height: scaleHeight(160),
    borderBottomLeftRadius: scaleWidth(35),
    borderBottomRightRadius: scaleWidth(35),
    paddingBottom: scaleHeight(20),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(20),
  },
  backButton: {
    padding: scaleWidth(8),
  },
  backButtonText: {
    fontSize: scaleFont(28),
    color: 'white',
    fontWeight: '300',
  },
  screenTitle: {
    fontSize: scaleFont(24),
    fontWeight: '800',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: scaleWidth(40),
  },
  progressContainer: {
    paddingHorizontal: scaleWidth(20),
    marginTop: scaleHeight(15),
  },
  progressBar: {
    height: scaleHeight(6),
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: scaleWidth(3),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: scaleWidth(3),
  },
  progressText: {
    fontSize: scaleFont(12),
    color: 'white',
    textAlign: 'center',
    marginTop: scaleHeight(8),
    opacity: 0.8,
  },
  bottomLightSection: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: scaleWidth(35),
    borderTopRightRadius: scaleWidth(35),
    marginTop: -scaleWidth(20),
  },
  scrollContent: {
    padding: scaleWidth(20),
    paddingBottom: scaleHeight(40),
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scaleHeight(50),
  },
  loadingText: {
    fontSize: scaleFont(16),
    color: colors.textSecondary,
    marginTop: scaleHeight(20),
  },
  questionContainer: {
    backgroundColor: colors.backgroundLight,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(20),
    marginBottom: scaleHeight(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionText: {
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: scaleHeight(20),
    lineHeight: scaleHeight(24),
    textAlign: 'center',
  },
  optionsContainer: {
    gap: scaleHeight(12),
  },
  optionButton: {
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(20),
    borderRadius: scaleWidth(12),
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: PRIMARY_ACCENT,
    borderColor: PRIMARY_ACCENT,
  },
  optionText: {
    fontSize: scaleFont(16),
    fontWeight: '500',
    color: colors.textPrimary,
  },
  selectedOptionText: {
    color: 'white',
    fontWeight: '600',
  },
  multipleOptionsContainer: {
    gap: scaleHeight(10),
  },
  multipleOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(14),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleWidth(12),
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: colors.borderLight,
  },
  selectedMultipleOption: {
    backgroundColor: '#F0F4FF',
    borderColor: PRIMARY_ACCENT,
  },
  checkboxContainer: {
    marginRight: scaleWidth(12),
  },
  checkbox: {
    width: scaleWidth(20),
    height: scaleWidth(20),
    borderRadius: scaleWidth(4),
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCheckbox: {
    backgroundColor: PRIMARY_ACCENT,
    borderColor: PRIMARY_ACCENT,
  },
  checkmark: {
    color: 'white',
    fontSize: scaleFont(12),
    fontWeight: 'bold',
  },
  multipleOptionText: {
    fontSize: scaleFont(14),
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
  selectedMultipleOptionText: {
    color: PRIMARY_ACCENT,
    fontWeight: '600',
  },
  instructionContainer: {
    backgroundColor: colors.backgroundLight,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(24),
    marginBottom: scaleHeight(20),
    alignItems: 'center',
  },
  instructionTitle: {
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: PRIMARY_ACCENT,
    marginBottom: scaleHeight(12),
    textAlign: 'center',
  },
  instructionMessage: {
    fontSize: scaleFont(16),
    color: colors.textPrimary,
    lineHeight: scaleHeight(22),
    textAlign: 'center',
    marginBottom: scaleHeight(20),
  },
  nextButton: {
    backgroundColor: PRIMARY_ACCENT,
    paddingVertical: scaleHeight(16),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    marginTop: scaleHeight(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  nextButtonText: {
    color: 'white',
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  viewSummaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: scaleHeight(12),
    paddingHorizontal: scaleWidth(20),
    borderRadius: scaleWidth(8),
    borderWidth: 2,
    borderColor: PRIMARY_ACCENT,
    alignItems: 'center',
    marginTop: scaleHeight(10),
  },
  viewSummaryButtonText: {
    color: PRIMARY_ACCENT,
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scaleWidth(20),
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: scaleWidth(20),
    padding: scaleWidth(24),
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: PRIMARY_ACCENT,
    textAlign: 'center',
    marginBottom: scaleHeight(20),
  },
  summaryContent: {
    maxHeight: scaleHeight(400),
  },
  summarySection: {
    marginBottom: scaleHeight(16),
    paddingBottom: scaleHeight(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  summaryLabel: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: scaleHeight(4),
  },
  summaryValue: {
    fontSize: scaleFont(14),
    color: colors.textSecondary,
    fontWeight: '500',
  },
  symptomItem: {
    fontSize: scaleFont(14),
    color: colors.textSecondary,
    marginLeft: scaleWidth(8),
    marginBottom: scaleHeight(2),
  },
  noSymptoms: {
    fontSize: scaleFont(14),
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  closeButton: {
    backgroundColor: PRIMARY_ACCENT,
    paddingVertical: scaleHeight(14),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    marginTop: scaleHeight(20),
  },
  closeButtonText: {
    color: 'white',
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  
  // ... rest of your styles remain the same ...
});

export default MCQ_Agent;
// --------------------------------------------------------------------
// hard coded mcqs questions (amir ki faltu logic)

// import React, { useState, useEffect } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   ScrollView,
//   Dimensions,
//   StatusBar,
//   ActivityIndicator,
//   Modal,
//   Alert,
// } from 'react-native';
// import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
// import { colors, fonts } from '../../config/globall';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// const { width, height } = Dimensions.get('window');
// const guidelineBaseWidth = 375;
// const guidelineBaseHeight = 812;

// const scaleWidth = size => (width / guidelineBaseWidth) * size;
// const scaleHeight = size => (height / guidelineBaseHeight) * size;
// const scaleFont = size => scaleWidth(size);

// const MAIN_THEME_COLOR = colors.primaryButton || '#11224D';
// const PRIMARY_ACCENT = MAIN_THEME_COLOR;

// // Gemini API Configuration
// const GEMINI_API_KEY = "AIzaSyB7OwSmWiXMhKQ9d09FAxhGT5HlUsasPPE";
// const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// const MCQ_Agent = ({ navigation, route }) => {
//   const { alertType, notificationData } = route.params;
//   const [patientData, setPatientData] = useState(null);
//   const [currentStep, setCurrentStep] = useState(0);
//   const [answers, setAnswers] = useState({});
//   const [loading, setLoading] = useState(false);
//   const [showSummary, setShowSummary] = useState(false);
//   const [storedAssessment, setStoredAssessment] = useState(null);

//   // BP Assessment Questions Flow
//   const bpAssessmentFlow = [
//     {
//       id: 'physicalActivity',
//       type: 'single',
//       question: "Were you rushing or physically active before measurements?",
//       options: ["Yes", "No"],
//       nextStep: {
//         "Yes": 1, // Go to rest instruction
//         "No": 2   // Go to substance check
//       }
//     },
//     {
//       id: 'restInstruction',
//       type: 'instruction',
//       title: "Pre-Measurement Rest Needed",
//       message: "Please rest for 10-15 minutes in a quiet environment and retake your blood pressure measurements for accurate results.",
//       buttonText: "I Understand, Continue",
//       nextStep: 2
//     },
//     {
//       id: 'substanceIntake',
//       type: 'single',
//       question: "Did you consume caffeine, nicotine, or alcohol before the measurement?",
//       options: ["Yes", "No"],
//       nextStep: {
//         "Yes": 3, // Go to medication check
//         "No": 3   // Go to medication check
//       }
//     },
//     {
//       id: 'medicationAdherence',
//       type: 'single',
//       question: "Did you take your prescribed blood pressure medication?",
//       options: ["Yes", "No"],
//       nextStep: {
//         "Yes": 4, // Go to symptom check
//         "No": 5   // Go to medication instruction
//       }
//     },
//     {
//       id: 'symptomAssessment',
//       type: 'multiple',
//       question: "Do you have any of the following symptoms? (Select all that apply)",
//       options: [
//         "Shortness of breath",
//         "Chest pain / Pressure",
//         "Palpitations",
//         "Dizziness / Light headedness",
//         "Headaches",
//         "Blurred vision",
//         "Nausea",
//         "Swelling in legs or ankles"
//       ],
//       nextStep: 6 // Go to completion
//     },
//     {
//       id: 'medicationInstruction',
//       type: 'instruction',
//       title: "Medication Reminder",
//       message: "Please take your prescribed blood pressure medication as directed and retake your measurements after 1 hour for accurate assessment.",
//       buttonText: "I Understand, Continue to Symptoms",
//       nextStep: 4 // Go to symptom check
//     },
//     {
//       id: 'completion',
//       type: 'completion',
//       title: "Assessment Complete",
//       message: "Thank you for completing the blood pressure assessment. You can now store your responses for future reference.",
//       buttonText: "Store Assessment Summary"
//     }
//   ];

//   useEffect(() => {
//     if (alertType === 'bloodPressure') {
//       setLoading(false); // BP uses predefined flow, no API call needed
//     } else {
//       // Keep existing logic for glucose and weight
//       fetchPatientData();
//     }
//   }, [alertType]);

//   const fetchPatientData = async () => {
//     // Existing glucose/weight logic remains the same
//     try {
//       const userData = await AsyncStorage.getItem('user');
//       if (!userData) throw new Error('User not found');
//       const user = JSON.parse(userData);
//       const patientId = user.id || user.patient_id;
//       if (!patientId) throw new Error('Patient ID missing');

//       const token = await AsyncStorage.getItem('authToken');
//       if (!token) throw new Error('Auth token missing');

//       const response = await fetch(`https://evitals.life/api/patients/${patientId}`, {
//         headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
//       });

//       if (!response.ok) throw new Error(`API failed: ${response.status}`);
//       const result = await response.json();
      
//       if (result.success && result.data) {
//         setPatientData(result.data);
//         if (alertType !== 'bloodPressure') {
//           generateSymptomQuestions(result.data);
//         }
//       }
//     } catch (error) {
//       console.error("Error fetching patient data:", error);
//       setLoading(false);
//     }
//   };

//   const generateSymptomQuestions = async (patientData) => {
//     // Existing glucose/weight question generation logic
//     // ... (keep existing implementation)
//   };

//   const handleAnswer = (questionId, answer) => {
//     setAnswers(prev => ({
//       ...prev,
//       [questionId]: answer
//     }));
//   };

//   const handleMultipleSelect = (questionId, option) => {
//     setAnswers(prev => {
//       const currentAnswers = prev[questionId] || [];
//       const isSelected = currentAnswers.includes(option);
      
//       if (isSelected) {
//         return {
//           ...prev,
//           [questionId]: currentAnswers.filter(item => item !== option)
//         };
//       } else {
//         return {
//           ...prev,
//           [questionId]: [...currentAnswers, option]
//         };
//       }
//     });
//   };

//   const goToNextStep = () => {
//     const currentQuestion = bpAssessmentFlow[currentStep];
    
//     if (currentQuestion.type === 'single') {
//       const answer = answers[currentQuestion.id];
//       if (answer && currentQuestion.nextStep[answer] !== undefined) {
//         setCurrentStep(currentQuestion.nextStep[answer]);
//       }
//     } else if (currentQuestion.type === 'instruction' || currentQuestion.type === 'multiple') {
//       setCurrentStep(currentQuestion.nextStep);
//     }
//   };

//   const canProceed = () => {
//     const currentQuestion = bpAssessmentFlow[currentStep];
    
//     switch (currentQuestion.type) {
//       case 'single':
//         return !!answers[currentQuestion.id];
//       case 'multiple':
//         const selectedSymptoms = answers[currentQuestion.id] || [];
//         return selectedSymptoms.length > 0;
//       case 'instruction':
//       case 'completion':
//         return true;
//       default:
//         return false;
//     }
//   };

//   const storeAssessment = async () => {
//     try {
//       const summary = generateSummary();
//       const storedAssessment = {
//         id: `bp-assessment-${Date.now()}`,
//         type: 'Store',
//         title: 'BP Assessment Summary',
//         message: `Blood pressure assessment completed with ${summary.selectedSymptoms.length} symptoms reported`,
//         date: new Date().toISOString(),
//         read: false,
//         // alertType: 'bloodPressure',
//         summary: summary,
//         severity: 'info'
//       };

//       // Store in AsyncStorage
//       const existingNotifications = await AsyncStorage.getItem('storedAssessments');
//       const notifications = existingNotifications ? JSON.parse(existingNotifications) : [];
//       notifications.unshift(storedAssessment);
//       await AsyncStorage.setItem('storedAssessments', JSON.stringify(notifications));

//       setStoredAssessment(storedAssessment);
//       setShowSummary(true);
      
//       Alert.alert(
//         "Assessment Stored",
//         "Your blood pressure assessment has been saved and is available in your notifications.",
//         [
//           {
//             text: "View Summary",
//             onPress: () => setShowSummary(true)
//           },
//           {
//             text: "Done",
//             onPress: () => navigation.goBack()
//           }
//         ]
//       );

//     } catch (error) {
//       console.error("Error storing assessment:", error);
//       Alert.alert("Error", "Failed to store assessment. Please try again.");
//     }
//   };

//   const generateSummary = () => {
//     const physicalActivity = answers['physicalActivity'];
//     const substanceIntake = answers['substanceIntake'];
//     const medicationTaken = answers['medicationAdherence'];
//     const selectedSymptoms = answers['symptomAssessment'] || [];

//     return {
//       physicalActivity,
//       substanceIntake,
//       medicationTaken,
//       selectedSymptoms,
//       assessmentDate: new Date().toLocaleString(),
//       totalSymptoms: selectedSymptoms.length
//     };
//   };

//   const renderQuestion = () => {
//     const currentQuestion = bpAssessmentFlow[currentStep];
    
//     switch (currentQuestion.type) {
//       case 'single':
//         return (
//           <View style={styles.questionContainer}>
//             <Text style={styles.questionText}>{currentQuestion.question}</Text>
//             <View style={styles.optionsContainer}>
//               {currentQuestion.options.map((option, index) => (
//                 <TouchableOpacity
//                   key={index}
//                   style={[
//                     styles.optionButton,
//                     answers[currentQuestion.id] === option && styles.selectedOption
//                   ]}
//                   onPress={() => handleAnswer(currentQuestion.id, option)}
//                 >
//                   <Text style={[
//                     styles.optionText,
//                     answers[currentQuestion.id] === option && styles.selectedOptionText
//                   ]}>
//                     {option}
//                   </Text>
//                 </TouchableOpacity>
//               ))}
//             </View>
//           </View>
//         );

//       case 'multiple':
//         const selectedSymptoms = answers[currentQuestion.id] || [];
//         return (
//           <View style={styles.questionContainer}>
//             <Text style={styles.questionText}>{currentQuestion.question}</Text>
//             <View style={styles.multipleOptionsContainer}>
//               {currentQuestion.options.map((option, index) => (
//                 <TouchableOpacity
//                   key={index}
//                   style={[
//                     styles.multipleOptionButton,
//                     selectedSymptoms.includes(option) && styles.selectedMultipleOption
//                   ]}
//                   onPress={() => handleMultipleSelect(currentQuestion.id, option)}
//                 >
//                   <View style={styles.checkboxContainer}>
//                     <View style={[
//                       styles.checkbox,
//                       selectedSymptoms.includes(option) && styles.checkedCheckbox
//                     ]}>
//                       {selectedSymptoms.includes(option) && (
//                         <Text style={styles.checkmark}>✓</Text>
//                       )}
//                     </View>
//                   </View>
//                   <Text style={[
//                     styles.multipleOptionText,
//                     selectedSymptoms.includes(option) && styles.selectedMultipleOptionText
//                   ]}>
//                     {option}
//                   </Text>
//                 </TouchableOpacity>
//               ))}
//             </View>
//           </View>
//         );

//       case 'instruction':
//       case 'completion':
//         return (
//           <View style={styles.instructionContainer}>
//             <Text style={styles.instructionTitle}>{currentQuestion.title}</Text>
//             <Text style={styles.instructionMessage}>{currentQuestion.message}</Text>
//             {currentQuestion.type === 'completion' && storedAssessment && (
//               <TouchableOpacity 
//                 style={styles.viewSummaryButton}
//                 onPress={() => setShowSummary(true)}
//               >
//                 <Text style={styles.viewSummaryButtonText}>View Stored Summary</Text>
//               </TouchableOpacity>
//             )}
//           </View>
//         );

//       default:
//         return null;
//     }
//   };

//   const getProgress = () => {
//     return ((currentStep + 1) / bpAssessmentFlow.length) * 100;
//   };

//   if (alertType !== 'bloodPressure') {
//     // Render existing glucose/weight UI
//     // ... (keep existing implementation)
//     return null; // Placeholder
//   }

//   return (
//     <SafeAreaProvider>
//       <SafeAreaView style={styles.fullScreenContainer}>
//         <StatusBar backgroundColor={MAIN_THEME_COLOR} barStyle="light-content" />

//         <View style={styles.mainContainer}>
//           {/* Header */}
//           <View style={styles.topDarkSection}>
//             <View style={styles.headerRow}>
//               <TouchableOpacity 
//                 style={styles.backButton}
//                 onPress={() => navigation.goBack()}
//               >
//                 <Text style={styles.backButtonText}>‹</Text>
//               </TouchableOpacity>
//               <Text style={styles.screenTitle}>BP Assessment</Text>
//               <View style={styles.placeholder} />
//             </View>
            
//             {/* Progress Bar */}
//             <View style={styles.progressContainer}>
//               <View style={styles.progressBar}>
//                 <View 
//                   style={[
//                     styles.progressFill, 
//                     { width: `${getProgress()}%` }
//                   ]} 
//                 />
//               </View>
//               <Text style={styles.progressText}>
//                 Step {currentStep + 1} of {bpAssessmentFlow.length}
//               </Text>
//             </View>
//           </View>

//           {/* Content */}
//           <View style={styles.bottomLightSection}>
//             <ScrollView contentContainerStyle={styles.scrollContent}>
//               {loading ? (
//                 <View style={styles.loadingContainer}>
//                   <ActivityIndicator size="large" color={PRIMARY_ACCENT} />
//                   <Text style={styles.loadingText}>Preparing assessment...</Text>
//                 </View>
//               ) : (
//                 <>
//                   {renderQuestion()}
                  
//                   {canProceed() && (
//                     <TouchableOpacity 
//                       style={styles.nextButton}
//                       onPress={() => {
//                         if (bpAssessmentFlow[currentStep].type === 'completion') {
//                           storeAssessment();
//                         } else {
//                           goToNextStep();
//                         }
//                       }}
//                     >
//                       <Text style={styles.nextButtonText}>
//                         {bpAssessmentFlow[currentStep].type === 'completion' 
//                           ? 'Store Assessment Summary'
//                           : bpAssessmentFlow[currentStep].type === 'instruction'
//                           ? bpAssessmentFlow[currentStep].buttonText
//                           : 'Continue'
//                         }
//                       </Text>
//                     </TouchableOpacity>
//                   )}
//                 </>
//               )}
//             </ScrollView>
//           </View>
//         </View>

//         {/* Summary Modal */}
//         <Modal
//           visible={showSummary}
//           animationType="slide"
//           transparent={true}
//           onRequestClose={() => setShowSummary(false)}
//         >
//           <View style={styles.modalContainer}>
//             <View style={styles.modalContent}>
//               <Text style={styles.modalTitle}>Assessment Summary</Text>
              
//               {storedAssessment && (
//                 <ScrollView style={styles.summaryContent}>
//                   <View style={styles.summarySection}>
//                     <Text style={styles.summaryLabel}>Physical Activity Before Measurement:</Text>
//                     <Text style={styles.summaryValue}>{storedAssessment.summary.physicalActivity}</Text>
//                   </View>
                  
//                   <View style={styles.summarySection}>
//                     <Text style={styles.summaryLabel}>Substance Intake:</Text>
//                     <Text style={styles.summaryValue}>{storedAssessment.summary.substanceIntake}</Text>
//                   </View>
                  
//                   <View style={styles.summarySection}>
//                     <Text style={styles.summaryLabel}>Medication Taken:</Text>
//                     <Text style={styles.summaryValue}>{storedAssessment.summary.medicationTaken}</Text>
//                   </View>
                  
//                   <View style={styles.summarySection}>
//                     <Text style={styles.summaryLabel}>Reported Symptoms ({storedAssessment.summary.totalSymptoms}):</Text>
//                     {storedAssessment.summary.selectedSymptoms.map((symptom, index) => (
//                       <Text key={index} style={styles.symptomItem}>• {symptom}</Text>
//                     ))}
//                     {storedAssessment.summary.selectedSymptoms.length === 0 && (
//                       <Text style={styles.noSymptoms}>No symptoms reported</Text>
//                     )}
//                   </View>
                  
//                   <View style={styles.summarySection}>
//                     <Text style={styles.summaryLabel}>Assessment Date:</Text>
//                     <Text style={styles.summaryValue}>{storedAssessment.summary.assessmentDate}</Text>
//                   </View>
//                 </ScrollView>
//               )}
              
//               <TouchableOpacity 
//                 style={styles.closeButton}
//                 onPress={() => setShowSummary(false)}
//               >
//                 <Text style={styles.closeButtonText}>Close</Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//         </Modal>
//       </SafeAreaView>
//     </SafeAreaProvider>
//   );
// };

// const styles = StyleSheet.create({
//   fullScreenContainer: {
//     flex: 1,
//     backgroundColor: MAIN_THEME_COLOR,
//   },
//   mainContainer: {
//     flex: 1,
//     backgroundColor: MAIN_THEME_COLOR,
//   },
//   topDarkSection: {
//     backgroundColor: MAIN_THEME_COLOR,
//     height: scaleHeight(160),
//     borderBottomLeftRadius: scaleWidth(35),
//     borderBottomRightRadius: scaleWidth(35),
//     paddingBottom: scaleHeight(20),
//   },
//   headerRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingHorizontal: scaleWidth(20),
//     paddingTop: scaleHeight(20),
//   },
//   backButton: {
//     padding: scaleWidth(8),
//   },
//   backButtonText: {
//     fontSize: scaleFont(28),
//     color: 'white',
//     fontWeight: '300',
//   },
//   screenTitle: {
//     fontSize: scaleFont(24),
//     fontWeight: '800',
//     color: 'white',
//     flex: 1,
//     textAlign: 'center',
//   },
//   placeholder: {
//     width: scaleWidth(40),
//   },
//   progressContainer: {
//     paddingHorizontal: scaleWidth(20),
//     marginTop: scaleHeight(15),
//   },
//   progressBar: {
//     height: scaleHeight(6),
//     backgroundColor: 'rgba(255,255,255,0.3)',
//     borderRadius: scaleWidth(3),
//     overflow: 'hidden',
//   },
//   progressFill: {
//     height: '100%',
//     backgroundColor: 'white',
//     borderRadius: scaleWidth(3),
//   },
//   progressText: {
//     fontSize: scaleFont(12),
//     color: 'white',
//     textAlign: 'center',
//     marginTop: scaleHeight(8),
//     opacity: 0.8,
//   },
//   bottomLightSection: {
//     flex: 1,
//     backgroundColor: 'white',
//     borderTopLeftRadius: scaleWidth(35),
//     borderTopRightRadius: scaleWidth(35),
//     marginTop: -scaleWidth(20),
//   },
//   scrollContent: {
//     padding: scaleWidth(20),
//     paddingBottom: scaleHeight(40),
//   },
//   loadingContainer: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: scaleHeight(50),
//   },
//   loadingText: {
//     fontSize: scaleFont(16),
//     color: colors.textSecondary,
//     marginTop: scaleHeight(20),
//   },
//   questionContainer: {
//     backgroundColor: colors.backgroundLight,
//     borderRadius: scaleWidth(16),
//     padding: scaleWidth(20),
//     marginBottom: scaleHeight(20),
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 4,
//     elevation: 3,
//   },
//   questionText: {
//     fontSize: scaleFont(18),
//     fontWeight: '600',
//     color: colors.textPrimary,
//     marginBottom: scaleHeight(20),
//     lineHeight: scaleHeight(24),
//     textAlign: 'center',
//   },
//   optionsContainer: {
//     gap: scaleHeight(12),
//   },
//   optionButton: {
//     paddingVertical: scaleHeight(16),
//     paddingHorizontal: scaleWidth(20),
//     borderRadius: scaleWidth(12),
//     backgroundColor: 'white',
//     borderWidth: 2,
//     borderColor: colors.borderLight,
//     alignItems: 'center',
//   },
//   selectedOption: {
//     backgroundColor: PRIMARY_ACCENT,
//     borderColor: PRIMARY_ACCENT,
//   },
//   optionText: {
//     fontSize: scaleFont(16),
//     fontWeight: '500',
//     color: colors.textPrimary,
//   },
//   selectedOptionText: {
//     color: 'white',
//     fontWeight: '600',
//   },
//   multipleOptionsContainer: {
//     gap: scaleHeight(10),
//   },
//   multipleOptionButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingVertical: scaleHeight(14),
//     paddingHorizontal: scaleWidth(16),
//     borderRadius: scaleWidth(12),
//     backgroundColor: 'white',
//     borderWidth: 2,
//     borderColor: colors.borderLight,
//   },
//   selectedMultipleOption: {
//     backgroundColor: '#F0F4FF',
//     borderColor: PRIMARY_ACCENT,
//   },
//   checkboxContainer: {
//     marginRight: scaleWidth(12),
//   },
//   checkbox: {
//     width: scaleWidth(20),
//     height: scaleWidth(20),
//     borderRadius: scaleWidth(4),
//     borderWidth: 2,
//     borderColor: colors.borderLight,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   checkedCheckbox: {
//     backgroundColor: PRIMARY_ACCENT,
//     borderColor: PRIMARY_ACCENT,
//   },
//   checkmark: {
//     color: 'white',
//     fontSize: scaleFont(12),
//     fontWeight: 'bold',
//   },
//   multipleOptionText: {
//     fontSize: scaleFont(14),
//     fontWeight: '500',
//     color: colors.textPrimary,
//     flex: 1,
//   },
//   selectedMultipleOptionText: {
//     color: PRIMARY_ACCENT,
//     fontWeight: '600',
//   },
//   instructionContainer: {
//     backgroundColor: colors.backgroundLight,
//     borderRadius: scaleWidth(16),
//     padding: scaleWidth(24),
//     marginBottom: scaleHeight(20),
//     alignItems: 'center',
//   },
//   instructionTitle: {
//     fontSize: scaleFont(20),
//     fontWeight: '700',
//     color: PRIMARY_ACCENT,
//     marginBottom: scaleHeight(12),
//     textAlign: 'center',
//   },
//   instructionMessage: {
//     fontSize: scaleFont(16),
//     color: colors.textPrimary,
//     lineHeight: scaleHeight(22),
//     textAlign: 'center',
//     marginBottom: scaleHeight(20),
//   },
//   nextButton: {
//     backgroundColor: PRIMARY_ACCENT,
//     paddingVertical: scaleHeight(16),
//     borderRadius: scaleWidth(12),
//     alignItems: 'center',
//     marginTop: scaleHeight(10),
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.2,
//     shadowRadius: 4,
//     elevation: 3,
//   },
//   nextButtonText: {
//     color: 'white',
//     fontSize: scaleFont(16),
//     fontWeight: '600',
//   },
//   viewSummaryButton: {
//     backgroundColor: 'transparent',
//     paddingVertical: scaleHeight(12),
//     paddingHorizontal: scaleWidth(20),
//     borderRadius: scaleWidth(8),
//     borderWidth: 2,
//     borderColor: PRIMARY_ACCENT,
//     alignItems: 'center',
//     marginTop: scaleHeight(10),
//   },
//   viewSummaryButtonText: {
//     color: PRIMARY_ACCENT,
//     fontSize: scaleFont(14),
//     fontWeight: '600',
//   },
//   modalContainer: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: scaleWidth(20),
//   },
//   modalContent: {
//     backgroundColor: 'white',
//     borderRadius: scaleWidth(20),
//     padding: scaleWidth(24),
//     width: '100%',
//     maxHeight: '80%',
//   },
//   modalTitle: {
//     fontSize: scaleFont(20),
//     fontWeight: '700',
//     color: PRIMARY_ACCENT,
//     textAlign: 'center',
//     marginBottom: scaleHeight(20),
//   },
//   summaryContent: {
//     maxHeight: scaleHeight(400),
//   },
//   summarySection: {
//     marginBottom: scaleHeight(16),
//     paddingBottom: scaleHeight(12),
//     borderBottomWidth: 1,
//     borderBottomColor: colors.borderLight,
//   },
//   summaryLabel: {
//     fontSize: scaleFont(14),
//     fontWeight: '600',
//     color: colors.textPrimary,
//     marginBottom: scaleHeight(4),
//   },
//   summaryValue: {
//     fontSize: scaleFont(14),
//     color: colors.textSecondary,
//     fontWeight: '500',
//   },
//   symptomItem: {
//     fontSize: scaleFont(14),
//     color: colors.textSecondary,
//     marginLeft: scaleWidth(8),
//     marginBottom: scaleHeight(2),
//   },
//   noSymptoms: {
//     fontSize: scaleFont(14),
//     color: colors.textSecondary,
//     fontStyle: 'italic',
//   },
//   closeButton: {
//     backgroundColor: PRIMARY_ACCENT,
//     paddingVertical: scaleHeight(14),
//     borderRadius: scaleWidth(12),
//     alignItems: 'center',
//     marginTop: scaleHeight(20),
//   },
//   closeButtonText: {
//     color: 'white',
//     fontSize: scaleFont(16),
//     fontWeight: '600',
//   },
// });

// export default MCQ_Agent;




// // ---------------------------------------------------------
// classic mcqs questions generation
// import React, { useState, useEffect } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   ScrollView,
//   Dimensions,
//   StatusBar,
//   ActivityIndicator,
// } from 'react-native';
// import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
// import { colors, fonts } from '../../config/globall';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// const { width, height } = Dimensions.get('window');
// const guidelineBaseWidth = 375;
// const guidelineBaseHeight = 812;

// const scaleWidth = size => (width / guidelineBaseWidth) * size;
// const scaleHeight = size => (height / guidelineBaseHeight) * size;
// const scaleFont = size => scaleWidth(size);

// const MAIN_THEME_COLOR = colors.primaryButton || '#11224D';
// const PRIMARY_ACCENT = MAIN_THEME_COLOR;

// // Gemini API Configuration
// const GEMINI_API_KEY = "AIzaSyB7OwSmWiXMhKQ9d09FAxhGT5HlUsasPPE"; // Replace with your actual Gemini API key
// const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// const MCQ_Agent = ({ navigation, route }) => {
//   const { alertType, notificationData } = route.params;
//   const [patientData, setPatientData] = useState(null);
//   const [mcqs, setMcqs] = useState([]);
//   const [selectedAnswers, setSelectedAnswers] = useState({});
//   const [loading, setLoading] = useState(true);
//   const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
//   const [analysisResult, setAnalysisResult] = useState('');

//   // Fetch patient data
//   useEffect(() => {
//     fetchPatientData();
//   }, []);

//   const fetchPatientData = async () => {
//     try {
//       const userData = await AsyncStorage.getItem('user');
//       if (!userData) throw new Error('User not found');
//       const user = JSON.parse(userData);
//       const patientId = user.id || user.patient_id;
//       if (!patientId) throw new Error('Patient ID missing');

//       const token = await AsyncStorage.getItem('authToken');
//       if (!token) throw new Error('Auth token missing');

//       const response = await fetch(`https://evitals.life/api/patients/${patientId}`, {
//         headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
//       });

//       if (!response.ok) throw new Error(`API failed: ${response.status}`);
//       const result = await response.json();
      
//       if (result.success && result.data) {
//         setPatientData(result.data);
//         generateSymptomQuestions(result.data);
//       }
//     } catch (error) {
//       console.error("Error fetching patient data:", error);
//       setLoading(false);
//     }
//   };

//   // Generate symptom-based questions using Gemini API
//   const generateSymptomQuestions = async (patientData) => {
//     try {
//       const measurements = patientData.measurements || {};
      
//       let conditionContext = '';
//       if (alertType === 'bloodPressure') {
//         const bp = measurements.bloodPressure;
//         const systolic = bp?.systolic || bp?.systolic_pressure;
//         const diastolic = bp?.diastolic || bp?.diastolic_pressure;
//         conditionContext = `Patient has High Blood Pressure: ${systolic}/${diastolic} mmHg`;
//       } else if (alertType === 'bloodGlucose') {
//         const glucose = measurements.bloodGlucose?.value;
//         conditionContext = `Patient has ${glucose > 126 ? 'High' : 'Low'} Blood Glucose: ${glucose} mg/dL`;
//       } else if (alertType === 'weight') {
//         const weight = measurements.weight?.value;
//         conditionContext = `Patient weight concern: ${weight} kg`;
//       }

//       const systemPrompt = `You are a medical diagnostic AI. Generate exactly 5 symptom assessment questions based on the patient's ${alertType} condition.

// PATIENT CONDITION: ${conditionContext}

// ALERT TYPE: ${alertType}

// INSTRUCTIONS FOR ${alertType.toUpperCase()} QUESTIONS:
// ${getConditionSpecificInstructions(alertType)}

// - Create 5 questions about symptoms and risk factors specifically related to ${alertType}
// - Each question should have 4 options: "Yes", "No", "Sometimes", "Not sure"
// - Focus on symptoms, discomforts, and daily experiences related to this condition
// - Questions should help assess the severity and impact of the condition
// - Return ONLY valid JSON format:
// {
//   "questions": [
//     {
//       "id": 1,
//       "question": "Specific symptom question?",
//       "options": {
//         "A": "Yes",
//         "B": "No", 
//         "C": "Sometimes",
//         "D": "Not sure"
//       }
//     }
//   ]
// }`;

//       const response = await fetch(GEMINI_API_URL, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           contents: [{ parts: [{ text: systemPrompt }] }],
//           generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
//         }),
//       });

//       if (!response.ok) throw new Error('API request failed');
      
//       const data = await response.json();
//       const responseText = data.candidates[0].content.parts[0].text;
      
//       // Extract JSON from response
//       const jsonMatch = responseText.match(/\{[\s\S]*\}/);
//       if (jsonMatch) {
//         const mcqData = JSON.parse(jsonMatch[0]);
//         setMcqs(mcqData.questions || []);
//       }
//     } catch (error) {
//       console.error("Error generating symptom questions:", error);
//       setMcqs(getFallbackSymptomQuestions(alertType));
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Condition-specific instructions for Gemini
//   const getConditionSpecificInstructions = (alertType) => {
//     switch(alertType) {
//       case 'bloodPressure':
//         return `- Ask about hypertension symptoms: headaches, dizziness, vision problems, chest pain, shortness of breath
// - Inquire about lifestyle factors: salt intake, stress levels, exercise frequency
// - Ask about family history and medication adherence
// - Include questions about sleep quality and energy levels`;
      
//       case 'bloodGlucose':
//         return `- Ask about diabetes symptoms: frequent urination, excessive thirst, fatigue, blurred vision
// - Inquire about dietary habits and carbohydrate intake
// - Ask about physical activity levels and weight changes
// - Include questions about family history and previous diagnoses`;
      
//       case 'weight':
//         return `- Ask about eating habits and appetite changes
// - Inquire about physical activity levels and mobility
// - Ask about sleep patterns and energy levels
// - Include questions about emotional well-being and stress eating`;
      
//       default:
//         return '- Focus on general symptoms and lifestyle factors';
//     }
//   };

//   const getFallbackSymptomQuestions = (alertType) => {
//     if (alertType === 'bloodPressure') {
//       return [
//         {
//           id: 1,
//           question: "Do you experience frequent headaches, especially in the morning?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         },
//         {
//           id: 2,
//           question: "Have you been feeling dizzy or lightheaded recently?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         },
//         {
//           id: 3,
//           question: "Do you experience shortness of breath during routine activities?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         },
//         {
//           id: 4,
//           question: "Have you noticed any vision changes or blurriness?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         },
//         {
//           id: 5,
//           question: "Do you experience chest pain or palpitations?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         }
//       ];
//     } else if (alertType === 'bloodGlucose') {
//       return [
//         {
//           id: 1,
//           question: "Do you feel unusually thirsty and drink more fluids than usual?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         },
//         {
//           id: 2,
//           question: "Do you need to urinate more frequently, especially at night?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         },
//         {
//           id: 3,
//           question: "Do you feel unusually tired or fatigued throughout the day?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         },
//         {
//           id: 4,
//           question: "Have you experienced blurred vision or eye problems?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         },
//         {
//           id: 5,
//           question: "Do you feel hungry soon after eating meals?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         }
//       ];
//     } else {
//       return [
//         {
//           id: 1,
//           question: "Do you experience shortness of breath during daily activities?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         },
//         {
//           id: 2,
//           question: "Do you have joint pain or mobility issues?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         },
//         {
//           id: 3,
//           question: "Do you feel tired or lack energy throughout the day?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         },
//         {
//           id: 4,
//           question: "Do you experience emotional eating or stress-related hunger?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         },
//         {
//           id: 5,
//           question: "Have you noticed swelling in your legs or ankles?",
//           options: { A: "Yes", B: "No", C: "Sometimes", D: "Not sure" }
//         }
//       ];
//     }
//   };

//   const handleAnswerSelect = (questionId, answer) => {
//     setSelectedAnswers(prev => ({
//       ...prev,
//       [questionId]: answer
//     }));
//   };

//   const allQuestionsAnswered = mcqs.length > 0 && mcqs.every(q => selectedAnswers[q.id]);

//   // Generate analysis based on symptom responses
//   const generateAnalysis = async () => {
//     setGeneratingAnalysis(true);
//     try {
//       const measurements = patientData?.measurements || {};
      
//       let conditionData = '';
//       if (alertType === 'bloodPressure') {
//         const bp = measurements.bloodPressure;
//         conditionData = `Blood Pressure: ${bp?.systolic || bp?.systolic_pressure}/${bp?.diastolic || bp?.diastolic_pressure} mmHg`;
//       } else if (alertType === 'bloodGlucose') {
//         const glucose = measurements.bloodGlucose?.value;
//         conditionData = `Blood Glucose: ${glucose} mg/dL`;
//       } else if (alertType === 'weight') {
//         const weight = measurements.weight?.value;
//         conditionData = `Weight: ${weight} kg`;
//       }

//       const systemPrompt = `You are a medical AI analyzing patient symptoms. Provide a concise health assessment and recommendations.

// PATIENT CONDITION: ${conditionData}
// ALERT TYPE: ${alertType}

// SYMPTOM RESPONSES:
// ${JSON.stringify(selectedAnswers, null, 2)}

// INSTRUCTIONS:
// - Analyze the patient's medical data combined with their symptom responses
// - Identify potential risk factors and severity based on symptoms
// - Provide specific, actionable recommendations for ${alertType}
// - Suggest lifestyle modifications and when to seek medical attention
// - Keep it concise but comprehensive (3-4 paragraphs)
// - Use empathetic and encouraging language
// - Always recommend professional medical consultation

// Focus on connecting the symptoms to the ${alertType} condition and provide practical advice.`;

//       const response = await fetch(GEMINI_API_URL, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           contents: [{ parts: [{ text: systemPrompt }] }],
//           generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
//         }),
//       });

//       if (!response.ok) throw new Error('API request failed');
      
//       const data = await response.json();
//       const analysis = data.candidates[0].content.parts[0].text;
//       setAnalysisResult(analysis);
//     } catch (error) {
//       console.error("Error generating analysis:", error);
//       setAnalysisResult("I apologize, but I'm having trouble generating your symptom analysis right now. Please try again later.");
//     } finally {
//       setGeneratingAnalysis(false);
//     }
//   };

//   const getConditionTitle = () => {
//     switch(alertType) {
//       case 'bloodPressure': return 'High Blood Pressure Symptoms';
//       case 'bloodGlucose': return 'Blood Glucose Symptoms'; 
//       case 'weight': return 'Weight-related Symptoms';
//       default: return 'Health Assessment';
//     }
//   };

//   return (
//     <SafeAreaProvider>
//       <SafeAreaView style={styles.fullScreenContainer}>
//         <StatusBar backgroundColor={MAIN_THEME_COLOR} barStyle="light-content" />

//         <View style={styles.mainContainer}>
//           {/* Header */}
//           <View style={styles.topDarkSection}>
//             <View style={styles.headerRow}>
//               <TouchableOpacity 
//                 style={styles.backButton}
//                 onPress={() => navigation.goBack()}
//               >
//                 <Text style={styles.backButtonText}>‹</Text>
//               </TouchableOpacity>
//               <Text style={styles.screenTitle}>Symptom Assessment</Text>
//               <View style={styles.placeholder} />
//             </View>
//             <Text style={styles.subtitle}>{getConditionTitle()}</Text>
//           </View>

//           {/* Content */}
//           <View style={styles.bottomLightSection}>
//             <ScrollView contentContainerStyle={styles.scrollContent}>
//               {loading ? (
//                 <View style={styles.loadingContainer}>
//                   <ActivityIndicator size="large" color={PRIMARY_ACCENT} />
//                   <Text style={styles.loadingText}>Preparing symptom assessment...</Text>
//                 </View>
//               ) : analysisResult ? (
//                 <View style={styles.analysisContainer}>
//                   <Text style={styles.analysisTitle}>Medical Analysis</Text>
//                   <Text style={styles.analysisText}>{analysisResult}</Text>
//                   <TouchableOpacity 
//                     style={styles.restartButton}
//                     onPress={() => {
//                       setAnalysisResult('');
//                       setSelectedAnswers({});
//                     }}
//                   >
//                     <Text style={styles.restartButtonText}>New Assessment</Text>
//                   </TouchableOpacity>
//                 </View>
//               ) : (
//                 <>
//                   <Text style={styles.instruction}>
//                     Please tell us about any symptoms you're experiencing:
//                   </Text>
                  
//                   {mcqs.map((mcq, index) => (
//                     <View key={mcq.id} style={styles.mcqContainer}>
//                       <Text style={styles.questionText}>
//                         {index + 1}. {mcq.question}
//                       </Text>
//                       <View style={styles.optionsContainer}>
//                         {Object.entries(mcq.options).map(([key, value]) => (
//                           <TouchableOpacity
//                             key={key}
//                             style={[
//                               styles.optionButton,
//                               selectedAnswers[mcq.id] === key && styles.selectedOption
//                             ]}
//                             onPress={() => handleAnswerSelect(mcq.id, key)}
//                           >
//                             <Text style={[
//                               styles.optionText,
//                               selectedAnswers[mcq.id] === key && styles.selectedOptionText
//                             ]}>
//                               {value}
//                             </Text>
//                           </TouchableOpacity>
//                         ))}
//                       </View>
//                     </View>
//                   ))}

//                   {allQuestionsAnswered && (
//                     <TouchableOpacity 
//                       style={styles.analyzeButton}
//                       onPress={generateAnalysis}
//                       disabled={generatingAnalysis}
//                     >
//                       {generatingAnalysis ? (
//                         <ActivityIndicator color="white" />
//                       ) : (
//                         <Text style={styles.analyzeButtonText}>
//                           Analyze My Symptoms
//                         </Text>
//                       )}
//                     </TouchableOpacity>
//                   )}
//                 </>
//               )}
//             </ScrollView>
//           </View>
//         </View>
//       </SafeAreaView>
//     </SafeAreaProvider>
//   );
// };

// // Styles remain the same as previous version...
// const styles = StyleSheet.create({
//   fullScreenContainer: {
//     flex: 1,
//     backgroundColor: MAIN_THEME_COLOR,
//   },
//   mainContainer: {
//     flex: 1,
//     backgroundColor: MAIN_THEME_COLOR,
//   },
//   topDarkSection: {
//     backgroundColor: MAIN_THEME_COLOR,
//     height: scaleHeight(140),
//     borderBottomLeftRadius: scaleWidth(35),
//     borderBottomRightRadius: scaleWidth(35),
//     paddingBottom: scaleHeight(20),
//   },
//   headerRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingHorizontal: scaleWidth(20),
//     paddingTop: scaleHeight(20),
//   },
//   backButton: {
//     padding: scaleWidth(8),
//   },
//   backButtonText: {
//     fontSize: scaleFont(28),
//     color: 'white',
//     fontWeight: '300',
//   },
//   screenTitle: {
//     fontSize: scaleFont(24),
//     fontWeight: '800',
//     color: 'white',
//     flex: 1,
//     textAlign: 'center',
//   },
//   placeholder: {
//     width: scaleWidth(40),
//   },
//   subtitle: {
//     fontSize: scaleFont(16),
//     color: 'white',
//     textAlign: 'center',
//     marginTop: scaleHeight(10),
//     opacity: 0.9,
//   },
//   bottomLightSection: {
//     flex: 1,
//     backgroundColor: 'white',
//     borderTopLeftRadius: scaleWidth(35),
//     borderTopRightRadius: scaleWidth(35),
//     marginTop: -scaleWidth(20),
//   },
//   scrollContent: {
//     padding: scaleWidth(20),
//     paddingBottom: scaleHeight(40),
//   },
//   loadingContainer: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: scaleHeight(50),
//   },
//   loadingText: {
//     fontSize: scaleFont(16),
//     color: colors.textSecondary,
//     marginTop: scaleHeight(20),
//   },
//   instruction: {
//     fontSize: scaleFont(16),
//     color: colors.textPrimary,
//     marginBottom: scaleHeight(20),
//     textAlign: 'center',
//     lineHeight: scaleHeight(22),
//   },
//   mcqContainer: {
//     backgroundColor: colors.backgroundLight,
//     borderRadius: scaleWidth(12),
//     padding: scaleWidth(16),
//     marginBottom: scaleHeight(16),
//     borderLeftWidth: scaleWidth(4),
//     borderLeftColor: PRIMARY_ACCENT,
//   },
//   questionText: {
//     fontSize: scaleFont(15),
//     fontWeight: '600',
//     color: colors.textPrimary,
//     marginBottom: scaleHeight(12),
//     lineHeight: scaleHeight(20),
//   },
//   optionsContainer: {
//     marginLeft: scaleWidth(5),
//   },
//   optionButton: {
//     paddingVertical: scaleHeight(10),
//     paddingHorizontal: scaleWidth(12),
//     borderRadius: scaleWidth(8),
//     marginBottom: scaleHeight(8),
//     borderWidth: 1,
//     borderColor: colors.borderLight,
//   },
//   selectedOption: {
//     backgroundColor: PRIMARY_ACCENT,
//     borderColor: PRIMARY_ACCENT,
//   },
//   optionText: {
//     fontSize: scaleFont(14),
//     color: colors.textPrimary,
//   },
//   selectedOptionText: {
//     color: 'white',
//     fontWeight: '500',
//   },
//   analyzeButton: {
//     backgroundColor: PRIMARY_ACCENT,
//     paddingVertical: scaleHeight(15),
//     borderRadius: scaleWidth(12),
//     alignItems: 'center',
//     marginTop: scaleHeight(10),
//   },
//   analyzeButtonText: {
//     color: 'white',
//     fontSize: scaleFont(16),
//     fontWeight: '600',
//   },
//   analysisContainer: {
//     backgroundColor: colors.backgroundLight,
//     borderRadius: scaleWidth(12),
//     padding: scaleWidth(20),
//     borderLeftWidth: scaleWidth(4),
//     borderLeftColor: PRIMARY_ACCENT,
//   },
//   analysisTitle: {
//     fontSize: scaleFont(18),
//     fontWeight: '700',
//     color: colors.textPrimary,
//     marginBottom: scaleHeight(15),
//     textAlign: 'center',
//   },
//   analysisText: {
//     fontSize: scaleFont(14),
//     color: colors.textPrimary,
//     lineHeight: scaleHeight(20),
//     marginBottom: scaleHeight(20),
//   },
//   restartButton: {
//     backgroundColor: colors.secondaryButton,
//     paddingVertical: scaleHeight(12),
//     borderRadius: scaleWidth(8),
//     alignItems: 'center',
//   },
//   restartButtonText: {
//     color: 'white',
//     fontSize: scaleFont(14),
//     fontWeight: '600',
//   },
// });

// export default MCQ_Agent;