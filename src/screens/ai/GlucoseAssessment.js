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
import { colors } from '../../config/globall';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const GlucoseAssessment = ({ navigation, route }) => {
  const { alertType, notificationData } = route.params;
  const [patientData, setPatientData] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [storedAssessment, setStoredAssessment] = useState(null);
  const [glucoseAssessmentFlow, setGlucoseAssessmentFlow] = useState([]);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => {
    if (alertType === 'bloodGlucose') {
      generateGlucoseAssessmentFlow();
    }
  }, [alertType]);

  // Generate Glucose Assessment Flow using Gemini AI
  const generateGlucoseAssessmentFlow = async () => {
    try {
      setLoading(true);
      
      const systemPrompt = `You are a medical AI assistant creating a blood glucose assessment flow. Generate a step-by-step assessment following clinical guidelines for glucose monitoring and symptom evaluation.

Create a flow with 4-6 steps that includes:

1. Pre-measurement conditions (recent food intake, physical activity)
2. Symptom assessment for hypo/hyperglycemia
3. Medication adherence check if applicable
4. Lifestyle factors assessment

RETURN ONLY VALID JSON in this exact format:
{
  "assessment": [
    {
      "id": "recentFood",
      "type": "single",
      "question": "Did you eat or drink anything (other than water) in the last 2 hours?",
      "options": ["Yes", "No"],
      "nextStep": {
        "Yes": 1,
        "No": 2
      }
    },
    {
      "id": "fastingInstruction",
      "type": "instruction", 
      "title": "Fasting Glucose Context",
      "message": "For accurate fasting glucose measurement, avoid food and drinks (except water) for 8-12 hours before testing.",
      "buttonText": "I Understand, Continue",
      "nextStep": 2
    },
    {
      "id": "symptomAssessment",
      "type": "multiple",
      "question": "Are you experiencing any of these symptoms? (Select all that apply)",
      "options": [
        "Excessive thirst",
        "Frequent urination",
        "Fatigue or weakness",
        "Blurred vision",
        "Headaches",
        "Shakiness or trembling",
        "Sweating",
        "Confusion or difficulty concentrating"
      ],
      "nextStep": 3
    },
    {
      "id": "physicalActivity",
      "type": "single",
      "question": "Were you physically active before taking this measurement?",
      "options": ["Yes", "No"],
      "nextStep": 4
    },
    {
      "id": "medicationAdherence",
      "type": "single",
      "question": "Did you take your diabetes medication as prescribed?",
      "options": ["Yes", "No", "I don't take diabetes medication"],
      "nextStep": 5
    },
    {
      "id": "completion",
      "type": "completion", 
      "title": "Assessment Complete",
      "message": "Thank you for completing the glucose assessment. You can now generate your personalized assessment summary.",
      "buttonText": "Generate Assessment Summary"
    }
  ]
}

Ensure the flow follows clinical best practices for glucose assessment.`;

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
        setGlucoseAssessmentFlow(flowData.assessment || []);
      } else {
        throw new Error('Invalid JSON response from AI');
      }
    } catch (error) {
      console.error("Error generating glucose assessment flow:", error);
      // Fallback to default flow
      setGlucoseAssessmentFlow(getFallbackGlucoseAssessmentFlow());
    } finally {
      setLoading(false);
    }
  };

  // Fallback glucose flow
  const getFallbackGlucoseAssessmentFlow = () => {
    return [
      {
        id: 'recentFood',
        type: 'single',
        question: "Did you eat or drink anything (other than water) in the last 2 hours?",
        options: ["Yes", "No"],
        nextStep: {
          "Yes": 1,
          "No": 2
        }
      },
      {
        id: 'fastingInstruction',
        type: 'instruction',
        title: "Fasting Glucose Context",
        message: "For accurate fasting glucose measurement, avoid food and drinks (except water) for 8-12 hours before testing.",
        buttonText: "I Understand, Continue",
        nextStep: 2
      },
      {
        id: 'symptomAssessment',
        type: 'multiple',
        question: "Are you experiencing any of these symptoms? (Select all that apply)",
        options: [
          "Excessive thirst",
          "Frequent urination",
          "Fatigue or weakness",
          "Blurred vision",
          "Headaches",
          "Shakiness or trembling",
          "Sweating",
          "Confusion or difficulty concentrating"
        ],
        nextStep: 3
      },
      {
        id: 'physicalActivity',
        type: 'single',
        question: "Were you physically active before taking this measurement?",
        options: ["Yes", "No"],
        nextStep: 4
      },
      {
        id: 'completion',
        type: 'completion',
        title: "Assessment Complete",
        message: "Thank you for completing the glucose assessment.",
        buttonText: "Generate Assessment Summary"
      }
    ];
  };

  // Rest of the component functions (similar to MCQ_Agent)
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

  const goToNextStep = () => {
    const currentQuestion = glucoseAssessmentFlow[currentStep];
    
    if (currentQuestion.type === 'single') {
      const answer = answers[currentQuestion.id];
      if (typeof currentQuestion.nextStep === 'object') {
        if (answer && currentQuestion.nextStep[answer] !== undefined) {
          setCurrentStep(currentQuestion.nextStep[answer]);
        }
      } else if (typeof currentQuestion.nextStep === 'number') {
        if (answer) {
          setCurrentStep(currentQuestion.nextStep);
        }
      }
    } else if (currentQuestion.type === 'instruction' || currentQuestion.type === 'multiple') {
      setCurrentStep(currentQuestion.nextStep);
    }
  };

  const canProceed = () => {
    const currentQuestion = glucoseAssessmentFlow[currentStep];
    
    switch (currentQuestion.type) {
      case 'single':
        return !!answers[currentQuestion.id];
      case 'multiple':
        const selectedSymptoms = answers[currentQuestion.id] || [];
        return selectedSymptoms.length >= 0;
      case 'instruction':
      case 'completion':
        return true;
      default:
        return false;
    }
  };

  // Generate AI-powered summary for glucose
  const generateAISummary = async () => {
    try {
      setGeneratingSummary(true);
      
      const systemPrompt = `You are a medical AI analyzing a patient's blood glucose assessment responses. Create a comprehensive clinical summary and recommendations.

PATIENT ASSESSMENT RESPONSES:
${JSON.stringify(answers, null, 2)}

Generate a professional medical summary that includes:

1. **Assessment Overview**: Brief summary of the patient's pre-measurement conditions
2. **Clinical Findings**: Analysis of reported symptoms and their potential significance for glucose levels
3. **Risk Factors**: Identified risk factors based on responses
4. **Recommendations**: Specific, actionable medical advice including:
   - When to retake measurements
   - Dietary guidance
   - Lifestyle modifications
   - When to seek immediate medical attention
5. **Follow-up Plan**: Suggested next steps for glucose monitoring

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
        id: `glucose-assessment-${Date.now()}`,
        type: 'Store',
        title: 'Glucose Assessment Summary',
        message: `Glucose assessment completed with ${basicSummary.totalSymptoms} symptoms reported`,
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
        "Your glucose assessment has been saved with AI-generated analysis.",
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
    const recentFood = answers['recentFood'];
    const physicalActivity = answers['physicalActivity'];
    const selectedSymptoms = answers['symptomAssessment'] || [];
    const medicationTaken = answers['medicationAdherence'];

    return {
      recentFood,
      physicalActivity,
      medicationTaken,
      selectedSymptoms,
      assessmentDate: new Date().toLocaleString(),
      totalSymptoms: selectedSymptoms.length
    };
  };

  const renderQuestion = () => {
    if (glucoseAssessmentFlow.length === 0) return null;
    
    const currentQuestion = glucoseAssessmentFlow[currentStep];
    
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
    if (glucoseAssessmentFlow.length === 0) return 0;
    return ((currentStep + 1) / glucoseAssessmentFlow.length) * 100;
  };

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
              <Text style={styles.screenTitle}>Glucose Assessment</Text>
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
                Step {currentStep + 1} of {glucoseAssessmentFlow.length}
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
              ) : glucoseAssessmentFlow.length === 0 ? (
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
                        if (glucoseAssessmentFlow[currentStep].type === 'completion') {
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
                          {glucoseAssessmentFlow[currentStep].type === 'completion' 
                            ? 'Generate Assessment Summary'
                            : glucoseAssessmentFlow[currentStep].type === 'instruction'
                            ? glucoseAssessmentFlow[currentStep].buttonText
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
                    <Text style={styles.summaryLabel}>Recent Food Intake:</Text>
                    <Text style={styles.summaryValue}>{storedAssessment.summary.recentFood}</Text>
                  </View>
                  
                  <View style={styles.summarySection}>
                    <Text style={styles.summaryLabel}>Physical Activity:</Text>
                    <Text style={styles.summaryValue}>{storedAssessment.summary.physicalActivity}</Text>
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

// Use the same styles from MCQ_Agent.js
const styles = StyleSheet.create({
  // Copy all the styles from your MCQ_Agent.js file here
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
  aiAnalysisText: {
    fontSize: scaleFont(14),
    color: colors.textPrimary,
    lineHeight: scaleHeight(20),
    marginTop: scaleHeight(8),
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
});

export default GlucoseAssessment;