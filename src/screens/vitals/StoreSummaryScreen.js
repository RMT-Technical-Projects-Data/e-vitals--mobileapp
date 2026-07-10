import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../config/globall';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

const MAIN_THEME_COLOR = colors.primaryButton || '#11224D';
const PRIMARY_ACCENT = MAIN_THEME_COLOR;

const StoreSummaryScreen = ({ navigation, route }) => {
  const { assessmentData } = route.params;
  const { summary } = assessmentData;

  const getStatusColor = (status) => {
    switch(status) {
      case 'Yes': return '#28a745';
      case 'No': return '#dc3545';
      default: return colors.textPrimary;
    }
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
              <Text style={styles.screenTitle}>Assessment Summary</Text>
              <View style={styles.placeholder} />
            </View>
            <Text style={styles.subtitle}>Blood Pressure Assessment</Text>
          </View>

          {/* Content */}
          <View style={styles.bottomLightSection}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {/* Assessment Overview */}
              <View style={styles.overviewCard}>
                <Text style={styles.overviewTitle}>Assessment Overview</Text>
                <View style={styles.overviewRow}>
                  <Text style={styles.overviewLabel}>Date:</Text>
                  <Text style={styles.overviewValue}>{summary.assessmentDate}</Text>
                </View>
                <View style={styles.overviewRow}>
                  <Text style={styles.overviewLabel}>Symptoms Reported:</Text>
                  <Text style={styles.overviewValue}>{summary.totalSymptoms}</Text>
                </View>
              </View>

              {/* Pre-Measurement Conditions */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Pre-Measurement Conditions</Text>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Physical Activity Before Measurement:</Text>
                  <Text style={[styles.infoValue, { color: getStatusColor(summary.physicalActivity) }]}>
                    {summary.physicalActivity}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Substance Intake (Caffeine/Nicotine/Alcohol):</Text>
                  <Text style={[styles.infoValue, { color: getStatusColor(summary.substanceIntake) }]}>
                    {summary.substanceIntake}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Medication Adherence:</Text>
                  <Text style={[styles.infoValue, { color: getStatusColor(summary.medicationTaken) }]}>
                    {summary.medicationTaken}
                  </Text>
                </View>
              </View>

              {/* Symptoms Reported */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  Symptoms Reported ({summary.totalSymptoms})
                </Text>
                
                {summary.selectedSymptoms.length > 0 ? (
                  <View style={styles.symptomsList}>
                    {summary.selectedSymptoms.map((symptom, index) => (
                      <View key={index} style={styles.symptomItem}>
                        <View style={styles.symptomBullet} />
                        <Text style={styles.symptomText}>{symptom}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noSymptomsText}>No symptoms reported during this assessment</Text>
                )}
              </View>

              {/* Recommendations */}
              <View style={styles.recommendationCard}>
                <Text style={styles.recommendationTitle}>Key Recommendations</Text>
                
                {summary.physicalActivity === 'Yes' && (
                  <Text style={styles.recommendationText}>
                    • Ensure 10-15 minutes of rest before BP measurements for accurate results
                  </Text>
                )}
                
                {summary.substanceIntake === 'Yes' && (
                  <Text style={styles.recommendationText}>
                    • Avoid caffeine, nicotine, and alcohol 30 minutes before measurements
                  </Text>
                )}
                
                {summary.medicationTaken === 'No' && (
                  <Text style={styles.recommendationText}>
                    • Take prescribed medications as directed for consistent blood pressure control
                  </Text>
                )}
                
                {summary.selectedSymptoms.length > 0 && (
                  <Text style={styles.recommendationText}>
                    • Monitor reported symptoms and consult healthcare provider if they persist
                  </Text>
                )}
                
                <Text style={styles.recommendationText}>
                  • Follow up with regular blood pressure monitoring as recommended
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity 
                  style={styles.primaryButton}
                  onPress={() => navigation.navigate('MCQ_Agent', { 
                    alertType: 'bloodPressure',
                    notificationData: assessmentData
                  })}
                >
                  <Text style={styles.primaryButtonText}>New BP Assessment</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.secondaryButton}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={styles.secondaryButtonText}>Back to Notifications</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
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
    height: scaleHeight(140),
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
  subtitle: {
    fontSize: scaleFont(16),
    color: 'white',
    textAlign: 'center',
    marginTop: scaleHeight(10),
    opacity: 0.9,
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
  overviewCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(20),
    marginBottom: scaleHeight(16),
    borderLeftWidth: scaleWidth(4),
    borderLeftColor: PRIMARY_ACCENT,
  },
  overviewTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: scaleHeight(12),
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleHeight(6),
  },
  overviewLabel: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  overviewValue: {
    fontSize: scaleFont(14),
    fontWeight: '500',
    color: colors.textSecondary,
  },
  sectionCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: scaleWidth(12),
    padding: scaleWidth(18),
    marginBottom: scaleHeight(16),
  },
  sectionTitle: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: scaleHeight(12),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleHeight(10),
    paddingBottom: scaleHeight(8),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: scaleFont(14),
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
    marginRight: scaleWidth(10),
  },
  infoValue: {
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  symptomsList: {
    marginTop: scaleHeight(8),
  },
  symptomItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: scaleHeight(8),
  },
  symptomBullet: {
    width: scaleWidth(6),
    height: scaleWidth(6),
    borderRadius: scaleWidth(3),
    backgroundColor: PRIMARY_ACCENT,
    marginTop: scaleHeight(6),
    marginRight: scaleWidth(12),
  },
  symptomText: {
    fontSize: scaleFont(14),
    color: colors.textPrimary,
    flex: 1,
    lineHeight: scaleHeight(20),
  },
  noSymptomsText: {
    fontSize: scaleFont(14),
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: scaleHeight(8),
  },
  recommendationCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: scaleWidth(12),
    padding: scaleWidth(18),
    marginBottom: scaleHeight(16),
    borderLeftWidth: scaleWidth(4),
    borderLeftColor: '#4A90E2',
  },
  recommendationTitle: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#2C5AA0',
    marginBottom: scaleHeight(10),
  },
  recommendationText: {
    fontSize: scaleFont(14),
    color: '#2C5AA0',
    lineHeight: scaleHeight(20),
    marginBottom: scaleHeight(6),
  },
  actionsContainer: {
    gap: scaleHeight(12),
    marginTop: scaleHeight(20),
  },
  primaryButton: {
    backgroundColor: PRIMARY_ACCENT,
    paddingVertical: scaleHeight(16),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: scaleHeight(14),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    borderWidth: 2,
    borderColor: PRIMARY_ACCENT,
  },
  secondaryButtonText: {
    color: PRIMARY_ACCENT,
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
});

export default StoreSummaryScreen;