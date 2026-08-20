import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Platform,
    StatusBar,
    ScrollView,
    SafeAreaView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
// --- Responsive Scaling Setup ---
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = (size) => (width / guidelineBaseWidth) * size;
const scaleHeight = (size) => (height / guidelineBaseHeight) * size;
const scaleFont = (size) => scaleWidth(size);

const NAVY_BLUE = '#01445b'; // Exact color from screenshots
const WHITE = '#FFFFFF';

const AboutAppScreen = ({ navigation }) => {
    return (
        <SafeAreaView style={styles.fullScreenContainer}>
            <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

            <View style={styles.topbar}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Settings'))}
                >
                    <MaterialIcons name="arrow-back" size={21} color="#0b1f3f" />
                </TouchableOpacity>
                <Text style={styles.topbarTitle}>About App</Text>
                <View style={styles.topbarSpacer} />
            </View>

            <View style={styles.bottomLightSection}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Main App Info Card */}
                    <View style={styles.card}>
                        <View style={styles.appInfoRow}>
                            <View style={styles.appIconContainer}>
                                <Text style={styles.infoSymbol}>i</Text>
                            </View>
                            <View style={styles.appInfoTextContainer}>
                                <Text style={styles.appTitle}>E-Vitals</Text>
                                <Text style={styles.appVersion}>Version 1.0 (Build 2101)</Text>
                            </View>
                        </View>
                        <Text style={styles.appDescription}>
                            E-Vitals Remote Patient Monitoring Services helps patients and healthcare providers stay connected through secure monitoring of health metrics and seamless communication.
                        </Text>
                    </View>

                    {/* Features Card */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Features</Text>
                        <View style={styles.bulletList}>
                            <View style={styles.bulletRow}><Text style={styles.bulletDot}>•</Text><Text style={styles.bulletText}>Real-time health monitoring</Text></View>
                            {/* <View style={styles.bulletRow}><Text style={styles.bulletDot}>•</Text><Text style={styles.bulletText}>Connect to medical devices via BLE</Text></View> */}
                            <View style={styles.bulletRow}><Text style={styles.bulletDot}>•</Text><Text style={styles.bulletText}>Real-time vitals displayed instantly on screen</Text></View>
                            <View style={styles.bulletRow}><Text style={styles.bulletDot}>•</Text><Text style={styles.bulletText}>Automatic upload of measurements to clinician dashboard</Text></View>
                            <View style={styles.bulletRow}><Text style={styles.bulletDot}>•</Text><Text style={styles.bulletText}>View final results</Text></View>
                            <View style={styles.bulletRow}><Text style={styles.bulletDot}>•</Text><Text style={styles.bulletText}>Secure in-app chat with assigned doctor for continuous support</Text></View>
                        </View>
                    </View>

                    {/* Company Card */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Company</Text>
                        <Text style={styles.companyText}>© 2026 E-Vitals. All rights reserved.</Text>
                    </View>

                    {/* Support Card */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Support</Text>
                        <Text style={styles.supportDescription}>For technical support or questions about the app:</Text>
                        <Text style={styles.linkText}>info@evitalsrpm.com</Text>
                        {/* <Text style={styles.linkText}>+1 (661) 733-7622</Text> */}
                    </View>

                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    fullScreenContainer: {
        flex: 1,
        backgroundColor: WHITE,
    },
    topbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Math.max(scaleWidth(16), 16),
        paddingTop: scaleHeight(8),
        paddingBottom: scaleHeight(10),
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
        shadowColor: '#0b1f3f',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 26,
        elevation: 3,
    },
    topbarTitle: {
        flex: 1,
        color: '#0b1f3f',
        fontSize: scaleFont(20),
        lineHeight: scaleFont(24),
        fontWeight: '800',
        textAlign: 'center',
        marginHorizontal: scaleWidth(8),
    },
    topbarSpacer: {
        width: Math.max(scaleWidth(42), 42),
    },
    bottomLightSection: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    scrollContent: {
        padding: scaleWidth(16),
    },
    card: {
        backgroundColor: WHITE,
        borderRadius: scaleWidth(12),
        padding: scaleWidth(16),
        marginBottom: scaleHeight(16),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    appInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scaleHeight(16),
    },
    appIconContainer: {
        width: scaleWidth(50),
        height: scaleWidth(50),
        borderRadius: scaleWidth(25),
        backgroundColor: NAVY_BLUE,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoSymbol: {
        color: WHITE,
        fontSize: scaleFont(24),
        fontWeight: 'bold',
    },
    appInfoTextContainer: {
        marginLeft: scaleWidth(16),
        flex: 1,
    },
    appTitle: {
        fontSize: scaleFont(16),
        fontWeight: '700',
        color: '#0A1C30',
    },
    appVersion: {
        fontSize: scaleFont(13),
        color: '#6c757d',
        marginTop: scaleHeight(2),
    },
    appDescription: {
        fontSize: scaleFont(14),
        color: '#495057',
        lineHeight: scaleFont(22),
    },
    cardTitle: {
        fontSize: scaleFont(16),
        fontWeight: '700',
        color: NAVY_BLUE,
        marginBottom: scaleHeight(12),
    },
    bulletList: {
        flexDirection: 'column',
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: scaleHeight(8),
    },
    bulletDot: {
        fontSize: scaleFont(14),
        color: '#212529',
        marginRight: scaleWidth(8),
        marginTop: Platform.OS === 'ios' ? 0 : scaleHeight(-2),
    },
    bulletText: {
        fontSize: scaleFont(14),
        color: '#212529',
        lineHeight: scaleFont(20),
        flex: 1,
    },
    companyText: {
        fontSize: scaleFont(14),
        color: '#212529',
    },
    supportDescription: {
        fontSize: scaleFont(14),
        color: '#212529',
        marginBottom: scaleHeight(12),
    },
    linkText: {
        fontSize: scaleFont(14),
        color: '#007BFF', // typical active link color
        marginBottom: scaleHeight(12),
    },
});

export default AboutAppScreen;