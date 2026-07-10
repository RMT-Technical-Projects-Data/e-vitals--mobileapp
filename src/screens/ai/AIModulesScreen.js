import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    StatusBar,
    ScrollView,
    Image,
    Platform,
    SafeAreaView,
} from "react-native";
import { colors, fonts } from '../../config/globall';

const { width, height } = Dimensions.get("window");

// Set base design sizes for responsive scaling
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Functions to make design responsive
const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

// Define colors for UI
const NAVY_BLUE = colors.primaryButton || '#293d55';
const WHITE = '#FFFFFF';
const LIGHT_GREY = '#F4F7F9';

const AI_MODULES = [
    {
        id: 'symptomChecker',
        title: 'Symptom Checker',
        description: 'General health assessment and symptom analysis.',
        icon: require('../../assets/images/batch_03/dr.png'),
        color: '#4A90E2',
    },
    {
        id: 'predictiveAnalysis',
        title: 'Predictive Analysis',
        description: 'Forecast health trends based on your history.',
        // icon: require('../../android/app/src/assets/images/batch_01/bar-chart.png'),
        color: '#50E3C2',
    },
    {
        id: 'anomalyDetection',
        title: 'Anomaly Detection',
        description: 'Identify unusual spikes or patterns in vitals.',
        // icon: require('../../android/app/src/assets/images/batch_01/alerts_bg.png'), // Using bg as icon variant
        color: '#F5A623',
    },
    {
        id: 'clinicalDecisionSupport',
        title: 'Clinical Decision Support',
        description: 'Guidance based on medical protocols.',
        // icon: require('../../android/app/src/assets/images/batch_01/agents.png'),
        color: '#BD10E0',
    },
    {
        id: 'dietRecommendation',
        title: 'Diet Recommendation',
        description: 'Nutritional guidance and meal impacts.',
        // icon: require('../../android/app/src/assets/images/batch_01/blood_pressure_bg.png'), // Placeholder
        color: '#7ED321',
    },
    {
        id: 'medicalRecommendation',
        title: 'Medical Recommendation',
        description: 'Lifestyle and wellness advisor.',
        // icon: require('../../android/app/src/assets/images/medical_rec_placeholder.png'), // This will fail if not exist, let me check assets again
        color: '#D0021B',
    },
];

// Wait, let me re-check assets for better icons or just use common ones
// I'll use hi.png, agents.png, ai.png, dr.png, etc.

const AIModulesScreen = ({ navigation }) => {
    const modules = [
        {
            id: 'symptomChecker',
            title: 'Symptom Checker',
            description: 'General health assessment and symptom analysis.',
            icon: require('../../assets/images/batch_03/dr.png'),
            bgColor: '#E3F2FD',
            iconColor: '#1976D2',
            screen: 'Chat'
        },
        {
            id: 'predictiveAnalysis',
            title: 'Predictive Analysis',
            description: 'Forecast health trends based on your history.',
            icon: require('../../assets/images/batch_01/bar-chart.png'),
            bgColor: '#E8F5E9',
            iconColor: '#388E3C',
            screen: 'PredictiveAnalysis'
        }
    ];

    return (
        <SafeAreaView style={styles.fullScreenContainer}>
            <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

            <View style={[styles.mainContainer, { backgroundColor: WHITE }]}>
                {/* Header perfectly aligned */}
                <View style={styles.topDarkSection}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Home')}
                            style={styles.backButtonContainer}
                        >
                            <Text style={styles.backButtonText}>‹</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>AI Modules Hub</Text>
                    </View>
                </View>

                {/* Modules List */}
                <View style={styles.bottomLightSection}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={styles.sectionTitle}>Select AI Assistant</Text>
                        <Text style={styles.sectionSubtitle}>Choose a specialized AI to help manage your health.</Text>

                        <View style={styles.modulesGrid}>
                            {modules.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.moduleCard}
                                    onPress={() => navigation.navigate(item.screen)}
                                >
                                    <View style={[styles.iconContainer, { backgroundColor: item.bgColor }]}>
                                        <Image source={item.icon} style={[styles.icon, { tintColor: item.iconColor }]} resizeMode="contain" />
                                    </View>
                                    <Text style={styles.moduleTitle}>{item.title}</Text>
                                    <Text style={styles.moduleDesc} numberOfLines={2}>{item.description}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default AIModulesScreen;

const styles = StyleSheet.create({
    fullScreenContainer: {
        flex: 1,
        backgroundColor: WHITE,
    },
    mainContainer: {
        flex: 1,
        width: '100%',
        backgroundColor: NAVY_BLUE,
    },
    topDarkSection: {
        backgroundColor: WHITE,
        paddingTop: scaleHeight(20),
        paddingBottom: scaleHeight(20),
        paddingHorizontal: scaleWidth(20),
        justifyContent: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        height: scaleHeight(45),
    },
    backButtonContainer: {
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
        color: '#0A1C30',
        fontSize: scaleFont(24),
        fontWeight: '700',
        textAlign: 'center',
    },
    bottomLightSection: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderTopLeftRadius: scaleWidth(35),
        borderTopRightRadius: scaleWidth(35),
        marginTop: scaleWidth(-10),
        paddingTop: scaleWidth(30),
    },
    scrollContent: {
        paddingHorizontal: scaleWidth(20),
        paddingBottom: scaleHeight(40),
    },
    sectionTitle: {
        fontSize: scaleFont(20),
        fontWeight: '700',
        color: NAVY_BLUE,
        marginBottom: scaleHeight(5),
    },
    sectionSubtitle: {
        fontSize: scaleFont(14),
        color: '#64748B',
        marginBottom: scaleHeight(25),
    },
    modulesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    moduleCard: {
        backgroundColor: WHITE,
        width: '100%',
        borderRadius: scaleWidth(20),
        padding: scaleWidth(20),
        marginBottom: scaleHeight(15),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    iconContainer: {
        width: scaleWidth(50),
        height: scaleWidth(50),
        borderRadius: scaleWidth(15),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scaleHeight(12),
    },
    icon: {
        width: scaleWidth(28),
        height: scaleWidth(28),
    },
    moduleTitle: {
        fontSize: scaleFont(18),
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: scaleHeight(8),
    },
    moduleDesc: {
        fontSize: scaleFont(14),
        color: '#94A3B8',
        lineHeight: scaleHeight(20),
    },
});