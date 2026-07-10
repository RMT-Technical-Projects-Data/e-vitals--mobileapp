import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    StatusBar,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Dimensions,
} from "react-native";
import { colors } from '../../config/globall';
import { API_CONFIG } from '../../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

const NAVY_BLUE = colors.primaryButton || '#293d55';
const WHITE = '#FFFFFF';
const HORIZON_DAYS = 7; // Predict for next 7 days

const PredictiveAnalysisScreen = ({ navigation }) => {
    const [predictions, setPredictions] = useState([]);
    const [summary, setSummary] = useState(null);
    const [glucosePredictions, setGlucosePredictions] = useState([]);
    const [glucoseSummary, setGlucoseSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [patientInfo, setPatientInfo] = useState(null);
    const [status, setStatus] = useState(null);
    const [glucoseStatus, setGlucoseStatus] = useState(null);
    const [hasEnoughData, setHasEnoughData] = useState(false);
    const [glucoseHasEnoughData, setGlucoseHasEnoughData] = useState(false);
    const [activeTab, setActiveTab] = useState('BP'); // BP or Glucose

    // Helper function to make API calls
    const apiCall = async (endpoint, options = {}) => {
        try {
            console.log(`🌐 Fetching: ${API_CONFIG.BASE_URL}${endpoint}`);
            const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                ...options
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    };

    // Check prediction status
    const checkPredictionStatus = async (practiceId, patientId) => {
        try {
            const pid = practiceId && practiceId !== 'null' ? practiceId : '1';
            const endpoint = `/practices/${pid}/patients/${patientId}/predictions/blood-pressure/status`;
            return await apiCall(endpoint, { method: 'GET' });
        } catch (error) {
            console.error('Status check error:', error);
            throw error;
        }
    };

    const getBloodPressurePredictions = async (practiceId, patientId) => {
        try {
            const pid = practiceId && practiceId !== 'null' ? practiceId : '1';
            const endpoint = `/practices/${pid}/patients/${patientId}/predictions/blood-pressure?horizon=${HORIZON_DAYS}&modelType=both`;
            return await apiCall(endpoint, { method: 'GET' });
        } catch (error) {
            console.error('Prediction fetch error:', error);
            throw error;
        }
    };

    // Check glucose prediction status
    const checkGlucoseStatus = async (practiceId, patientId) => {
        try {
            const pid = practiceId && practiceId !== 'null' ? practiceId : '1';
            const endpoint = `/practices/${pid}/patients/${patientId}/predictions/glucose/status`;
            return await apiCall(endpoint, { method: 'GET' });
        } catch (error) {
            console.error('Glucose status check error:', error);
            throw error;
        }
    };

    // Get glucose predictions
    const getGlucosePredictions = async (practiceId, patientId) => {
        try {
            const pid = practiceId && practiceId !== 'null' ? practiceId : '1';
            const endpoint = `/practices/${pid}/patients/${patientId}/predictions/glucose?horizon=${HORIZON_DAYS}`;
            return await apiCall(endpoint, { method: 'GET' });
        } catch (error) {
            console.error('Glucose prediction fetch error:', error);
            throw error;
        }
    };

    // Fetch prediction status and data
    const fetchPredictionData = async () => {
        try {
            setLoading(true);

            // Get patient and practice ID from AsyncStorage
            let patientId = await AsyncStorage.getItem('patientId');
            let practiceId = await AsyncStorage.getItem('practiceId');

            // Fallback: Check if they are inside the 'user' object
            if (!patientId || !practiceId) {
                const userData = await AsyncStorage.getItem('user');
                if (userData) {
                    const user = JSON.parse(userData);
                    patientId = patientId || user.id || user.patient_id;
                    practiceId = practiceId || user.practice_id;
                }
            }

            console.log('📱 Patient Info from Storage:', { patientId, practiceId });

            if (!patientId) {
                Alert.alert(
                    'Information Required',
                    'Patient information not found. Please login again.',
                    [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
                );
                return;
            }

            if (activeTab === 'BP') {
                const statusResponse = await checkPredictionStatus(practiceId, patientId);
                if (statusResponse.success) {
                    setStatus(statusResponse);
                    setHasEnoughData(statusResponse.canPredict);
                    if (statusResponse.canPredict) {
                        const predictionResponse = await getBloodPressurePredictions(practiceId, patientId);
                        if (predictionResponse.success) {
                            setPredictions(predictionResponse.predictions || []);
                            setSummary(predictionResponse.summary || null);
                            setPatientInfo({
                                patientId: predictionResponse.patientId,
                                patientName: predictionResponse.patientName
                            });
                        }
                    }
                }
            } else {
                const statusResponse = await checkGlucoseStatus(practiceId, patientId);
                if (statusResponse.success) {
                    setGlucoseStatus(statusResponse);
                    setGlucoseHasEnoughData(statusResponse.canPredict);
                    if (statusResponse.canPredict) {
                        const predictionResponse = await getGlucosePredictions(practiceId, patientId);
                        if (predictionResponse.success) {
                            setGlucosePredictions(predictionResponse.predictions || []);
                            setGlucoseSummary(predictionResponse.summary || null);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error fetching prediction data:', error);
            Alert.alert('Error', `Failed to fetch predictions: ${error.message}`);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchPredictionData();
    }, [activeTab]);

    // Pull to refresh
    const onRefresh = () => {
        setRefreshing(true);
        fetchPredictionData();
    };

    // Render prediction item
    const renderPredictionItem = ({ item, index }) => {
        if (activeTab === 'BP') {
            const getRiskColor = (riskLevel) => {
                switch (riskLevel) {
                    case 'CRISIS': return '#ff4444';
                    case 'HIGH': return '#ff8800';
                    case 'ELEVATED': return '#ffbb33';
                    case 'NORMAL': return '#00C851';
                    default: return '#666666';
                }
            };

            const getRiskIcon = (riskLevel) => {
                switch (riskLevel) {
                    case 'CRISIS': return '⚠️';
                    case 'HIGH': return '🔴';
                    case 'ELEVATED': return '🟡';
                    case 'NORMAL': return '🟢';
                    default: return '⚪';
                }
            };

            return (
                <View style={styles.predictionCard}>
                    <View style={styles.dateHeader}>
                        <Text style={styles.dateText}>
                            {new Date(item.forecast_date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                            })}
                        </Text>
                        <View style={[styles.riskBadge, { backgroundColor: getRiskColor(item.risk_level) }]}>
                            <Text style={styles.riskText}>
                                {getRiskIcon(item.risk_level)} {item.risk_level}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.predictionRow}>
                        <View style={styles.bpColumn}>
                            <Text style={styles.bpLabel}>SYS (mmHg)</Text>
                            <View style={[styles.bpValueContainer, {
                                borderLeftColor: item.pred_sys >= 140 ? '#ff4444' :
                                    item.pred_sys >= 130 ? '#ff8800' :
                                        item.pred_sys >= 120 ? '#ffbb33' : '#00C851'
                            }]}>
                                <Text style={styles.bpValue}>{item.pred_sys?.toFixed(1) || '--'}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.bpColumn}>
                            <Text style={styles.bpLabel}>DIA (mmHg)</Text>
                            <View style={[styles.bpValueContainer, {
                                borderLeftColor: item.pred_dia >= 90 ? '#ff4440' :
                                    item.pred_dia >= 80 ? '#ff8800' : '#00C851'
                            }]}>
                                <Text style={styles.bpValue}>{item.pred_dia?.toFixed(1) || '--'}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.modelColumn}>
                            <Text style={styles.modelLabel}>Model</Text>
                            <Text style={styles.modelText}>{item.model || '--'}</Text>
                        </View>
                    </View>
                </View>
            );
        } else {
            return (
                <View style={styles.predictionCard}>
                    <View style={styles.dateHeader}>
                        <Text style={styles.dateText}>
                            {new Date(item.forecast_date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                            })}
                        </Text>
                        <View style={[styles.riskBadge, { backgroundColor: '#F0F2F5' }]}>
                            <Text style={[styles.riskText, { color: '#666' }]}>
                                🧪 Forecast
                            </Text>
                        </View>
                    </View>

                    <View style={styles.predictionRow}>
                        <View style={styles.bpColumn}>
                            <Text style={styles.bpLabel}>GLUCOSE (mg/dL)</Text>
                            <View style={[styles.bpValueContainer, { borderLeftColor: NAVY_BLUE }]}>
                                <Text style={styles.bpValue}>{item.predicted_value?.toFixed(1) || '--'}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.modelColumn}>
                            <Text style={styles.modelLabel}>Model</Text>
                            <Text style={styles.modelText}>{item.model || '--'}</Text>
                        </View>
                    </View>
                </View>
            );
        }
    };

    // Render model summary
    const renderModelSummary = (modelName, data) => {
        if (!data) return null;

        const getRiskCount = (riskLevel) => {
            return predictions.filter(p =>
                p.model === modelName &&
                p.risk_level === riskLevel
            ).length;
        };

        return (
            <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>{modelName} Summary</Text>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{data.avg_sys?.toFixed(1) || '--'}</Text>
                        <Text style={styles.statLabel}>Avg SYS</Text>
                    </View>

                    <View style={styles.statDivider} />

                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{data.avg_dia?.toFixed(1) || '--'}</Text>
                        <Text style={styles.statLabel}>Avg DIA</Text>
                    </View>

                    <View style={styles.statDivider} />

                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {(getRiskCount('HIGH') + getRiskCount('CRISIS')) || 0}
                        </Text>
                        <Text style={styles.statLabel}>High Risk Days</Text>
                    </View>
                </View>

                <View style={styles.riskDistribution}>
                    <View style={[styles.riskBar, {
                        backgroundColor: '#00C851',
                        width: `${((getRiskCount('NORMAL') || 0) / HORIZON_DAYS) * 100}%`
                    }]} />
                    <View style={[styles.riskBar, {
                        backgroundColor: '#ffbb33',
                        width: `${((getRiskCount('ELEVATED') || 0) / HORIZON_DAYS) * 100}%`
                    }]} />
                    <View style={[styles.riskBar, {
                        backgroundColor: '#ff8800',
                        width: `${((getRiskCount('HIGH') || 0) / HORIZON_DAYS) * 100}%`
                    }]} />
                    <View style={[styles.riskBar, {
                        backgroundColor: '#ff4444',
                        width: `${((getRiskCount('CRISIS') || 0) / HORIZON_DAYS) * 100}%`
                    }]} />
                </View>
            </View>
        );
    };

    // Render Tab Bar
    const renderTabs = () => (
        <View style={styles.tabContainer}>
            <TouchableOpacity
                style={[styles.tabButton, activeTab === 'BP' && styles.activeTabButton]}
                onPress={() => setActiveTab('BP')}
            >
                <Text style={[styles.tabText, activeTab === 'BP' && styles.activeTabText]}>
                    🩺 Blood Pressure
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.tabButton, activeTab === 'Glucose' && styles.activeTabButton]}
                onPress={() => setActiveTab('Glucose')}
            >
                <Text style={[styles.tabText, activeTab === 'Glucose' && styles.activeTabText]}>
                    🩸 Glucose
                </Text>
            </TouchableOpacity>
        </View>
    );

    // Loading state
    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

                {/* ── HEADER ── */}
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                        >
                            <Text style={styles.backButtonText}>‹</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>Predictive Analysis</Text>
                    </View>
                </View>

                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={NAVY_BLUE} />
                    <Text style={styles.loadingText}>Loading predictions...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

            {/* ── HEADER — consistent with DataList/Settings/Profile/Chat ── */}
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backButtonText}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Predictive Analysis</Text>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[NAVY_BLUE]}
                    />
                }
            >
                {renderTabs()}

                {activeTab === 'BP' ? (
                    <>
                        {/* No Data Message */}
                        {!hasEnoughData && status && (
                            <View style={styles.insufficientDataCard}>
                                <Text style={styles.insufficientTitle}>📊 Data Requirements</Text>
                                <Text style={styles.insufficientText}>
                                    To generate accurate predictions, we need at least 30 days of blood pressure readings.
                                </Text>
                                <View style={styles.requirementsRow}>
                                    <Text style={styles.requirementText}>• Minimum readings: 30</Text>
                                    <Text style={styles.requirementText}>• Your readings: {status.currentReadings || 0}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.addDataButton}
                                    onPress={() => navigation.navigate('Summary')}
                                >
                                    <Text style={styles.addDataButtonText}>📝 Add More Measurements</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Predictions List */}
                        {hasEnoughData && predictions.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>📅 Daily Forecast (Next {HORIZON_DAYS} Days)</Text>
                                <FlatList
                                    data={predictions}
                                    renderItem={renderPredictionItem}
                                    keyExtractor={(item, index) => `${item.forecast_date}-${item.model}-${index}`}
                                    scrollEnabled={false}
                                    ListEmptyComponent={
                                        <Text style={styles.emptyText}>No predictions available</Text>
                                    }
                                />
                            </View>
                        )}

                        {/* Model Summaries */}
                        {hasEnoughData && summary && Object.keys(summary).length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>📈 Model Comparison</Text>
                                {Object.entries(summary).map(([modelName, modelData]) => (
                                    <View key={modelName}>
                                        {renderModelSummary(modelName, modelData)}
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Empty State when no predictions but enough data */}
                        {hasEnoughData && (!predictions || predictions.length === 0) && (
                            <View style={styles.emptyStateCard}>
                                <Text style={styles.emptyStateTitle}>📊 No Predictions Generated</Text>
                                <Text style={styles.emptyStateText}>
                                    We have enough data but couldn't generate predictions. This might be due to:
                                </Text>
                                <View style={styles.bulletList}>
                                    <Text style={styles.bulletText}>• Insufficient variation in data</Text>
                                    <Text style={styles.bulletText}>• Model training issues</Text>
                                    <Text style={styles.bulletText}>• Temporary server issues</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.tryAgainButton}
                                    onPress={onRefresh}
                                >
                                    <Text style={styles.tryAgainButtonText}>🔄 Try Again</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Risk Legend */}
                        {hasEnoughData && predictions.length > 0 && (
                            <View style={styles.legendCard}>
                                <Text style={styles.legendTitle}>Risk Level Guide</Text>
                                <View style={styles.legendRow}>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendColor, { backgroundColor: '#00C851' }]} />
                                        <Text style={styles.legendText}>Normal</Text>
                                        <Text style={styles.legendSubtext}>SYS {'<'} 120</Text>
                                        <Text style={styles.legendSubtext}>DIA {'<'} 80</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendColor, { backgroundColor: '#ffbb33' }]} />
                                        <Text style={styles.legendText}>Elevated</Text>
                                        <Text style={styles.legendSubtext}>SYS 120-129</Text>
                                        <Text style={styles.legendSubtext}>DIA {'<'} 80</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendColor, { backgroundColor: '#ff8800' }]} />
                                        <Text style={styles.legendText}>High</Text>
                                        <Text style={styles.legendSubtext}>SYS 130-139</Text>
                                        <Text style={styles.legendSubtext}>DIA 80-89</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendColor, { backgroundColor: '#ff4444' }]} />
                                        <Text style={styles.legendText}>Crisis</Text>
                                        <Text style={styles.legendSubtext}>SYS ≥140</Text>
                                        <Text style={styles.legendSubtext}>DIA ≥90</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </>
                ) : (
                    <>
                        {/* Glucose Case */}
                        {!glucoseHasEnoughData && glucoseStatus && (
                            <View style={styles.insufficientDataCard}>
                                <Text style={styles.insufficientTitle}>📊 Data Requirements</Text>
                                <Text style={styles.insufficientText}>
                                    To generate accurate glucose predictions, we need at least 30 readings.
                                </Text>
                                <View style={styles.requirementsRow}>
                                    <Text style={styles.requirementText}>• Minimum readings: 30</Text>
                                    <Text style={styles.requirementText}>• Your readings: {glucoseStatus.currentReadings || 0}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.addDataButton}
                                    onPress={() => navigation.navigate('Glucose')}
                                >
                                    <Text style={styles.addDataButtonText}>📝 Add Glucose Measurements</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {glucoseHasEnoughData && glucosePredictions.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>📅 Glucose Forecast (Next {HORIZON_DAYS} Days)</Text>
                                <FlatList
                                    data={glucosePredictions}
                                    renderItem={renderPredictionItem}
                                    keyExtractor={(item, index) => `glucose-${item.forecast_date}-${index}`}
                                    scrollEnabled={false}
                                />
                            </View>
                        )}

                        {glucoseHasEnoughData && glucoseSummary && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>📈 Analysis Summary</Text>
                                <View style={styles.recordCard}>
                                    <Text style={styles.summaryLabel}>Average Predicted Glucose</Text>
                                    <Text style={styles.summaryValue}>
                                        {glucoseSummary.SARIMA?.avg_predicted} mg/dL
                                    </Text>
                                    <Text style={styles.summarySubtext}>Based on SARIMA forecasting model</Text>
                                </View>
                            </View>
                        )}

                        {glucoseHasEnoughData && (!glucosePredictions || glucosePredictions.length === 0) && (
                            <View style={styles.emptyStateCard}>
                                <Text style={styles.emptyStateTitle}>📊 Processing...</Text>
                                <Text style={styles.emptyStateText}>
                                    We are calculating your glucose forecast data.
                                </Text>
                                <TouchableOpacity
                                    style={styles.tryAgainButton}
                                    onPress={onRefresh}
                                >
                                    <Text style={styles.tryAgainButtonText}>🔄 Refresh</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}

                {/* Actions */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={styles.refreshButton}
                        onPress={onRefresh}
                        disabled={refreshing || loading}
                    >
                        <Text style={styles.refreshButtonText}>
                            {refreshing ? '🔄 Refreshing...' : '🔄 Refresh Predictions'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.historyButton}
                        onPress={() => navigation.navigate('Summary')}
                    >
                        <Text style={styles.historyButtonText}>📊 View Historical Data</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: WHITE,
    },

    // ── HEADER — consistent with DataList / Settings / Profile / Chat ──
    header: {
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
    title: {
        fontSize: scaleFont(24),
        fontWeight: '700',
        color: '#0A1C30',
        textAlign: 'center',
    },

    // ── BODY ──
    content: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 15,
        fontSize: 16,
        color: '#666666',
        textAlign: 'center',
    },
    loadingSubtext: {
        marginTop: 5,
        fontSize: 12,
        color: '#999999',
        textAlign: 'center',
    },
    connectionCard: {
        backgroundColor: '#E3F2FD',
        margin: 15,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#90CAF9',
    },
    connectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1565C0',
        marginBottom: 5,
    },
    connectionText: {
        fontSize: 12,
        color: '#424242',
        marginBottom: 3,
    },
    connectionSubtext: {
        fontSize: 11,
        color: '#666666',
        fontStyle: 'italic',
    },
    patientInfoCard: {
        backgroundColor: '#F8F9FA',
        marginHorizontal: 15,
        marginBottom: 15,
        padding: 15,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: NAVY_BLUE,
    },
    patientName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000000',
        marginBottom: 5,
    },
    patientId: {
        fontSize: 14,
        color: '#666666',
        marginBottom: 10,
    },
    horizonBadge: {
        backgroundColor: NAVY_BLUE,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    horizonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    statusCard: {
        marginHorizontal: 15,
        marginBottom: 15,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    statusTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    statusText: {
        fontSize: 14,
        color: '#666666',
        marginBottom: 5,
    },
    statusMessage: {
        fontSize: 13,
        color: '#888888',
        fontStyle: 'italic',
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        marginBottom: 20,
        gap: 10,
        paddingTop: 20,
    },
    tabButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 25,
        backgroundColor: '#F0F2F5',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    activeTabButton: {
        backgroundColor: NAVY_BLUE,
        borderColor: NAVY_BLUE,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666666',
    },
    activeTabText: {
        color: '#FFFFFF',
    },
    glucosePlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        marginTop: 40,
    },
    placeholderIcon: {
        fontSize: 60,
        marginBottom: 20,
    },
    placeholderTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: NAVY_BLUE,
        marginBottom: 10,
    },
    placeholderText: {
        fontSize: 16,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 24,
    },
    insufficientDataCard: {
        backgroundColor: '#FFF3E0',
        marginHorizontal: 15,
        marginBottom: 15,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FFB74D',
    },
    insufficientTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#F57C00',
        marginBottom: 8,
    },
    insufficientText: {
        fontSize: 14,
        color: '#666666',
        marginBottom: 10,
        lineHeight: 20,
    },
    requirementsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    requirementText: {
        fontSize: 13,
        color: '#666666',
    },
    addDataButton: {
        backgroundColor: '#FF9800',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    addDataButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    section: {
        marginHorizontal: 15,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000000',
        marginBottom: 15,
    },
    predictionCard: {
        backgroundColor: '#FFFFFF',
        marginBottom: 12,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    dateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    dateText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
    },
    riskBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    riskText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    predictionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bpColumn: {
        flex: 1,
    },
    bpLabel: {
        fontSize: 12,
        color: '#666666',
        marginBottom: 5,
    },
    bpValueContainer: {
        paddingLeft: 8,
        borderLeftWidth: 3,
    },
    bpValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000000',
    },
    divider: {
        width: 1,
        height: 40,
        backgroundColor: '#E0E0E0',
        marginHorizontal: 15,
    },
    modelColumn: {
        flex: 0.8,
    },
    modelLabel: {
        fontSize: 12,
        color: '#666666',
        marginBottom: 5,
    },
    modelText: {
        fontSize: 14,
        fontWeight: '600',
        color: NAVY_BLUE,
    },
    summaryCard: {
        backgroundColor: '#F8F9FA',
        padding: 15,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000000',
        marginBottom: 15,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: NAVY_BLUE,
        marginBottom: 5,
    },
    statLabel: {
        fontSize: 12,
        color: '#666666',
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#E0E0E0',
    },
    riskDistribution: {
        flexDirection: 'row',
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
    },
    riskBar: {
        height: '100%',
    },
    emptyStateCard: {
        backgroundColor: '#F5F5F5',
        marginHorizontal: 15,
        marginBottom: 15,
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    emptyStateTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#666666',
        marginBottom: 10,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#666666',
        textAlign: 'center',
        marginBottom: 15,
        lineHeight: 20,
    },
    bulletList: {
        alignSelf: 'flex-start',
        marginLeft: 20,
        marginBottom: 15,
    },
    bulletText: {
        fontSize: 13,
        color: '#666666',
        marginBottom: 5,
    },
    tryAgainButton: {
        backgroundColor: NAVY_BLUE,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    tryAgainButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    legendCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 15,
        marginBottom: 20,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    legendTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000000',
        marginBottom: 15,
    },
    legendRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    legendItem: {
        width: '48%',
        marginBottom: 15,
    },
    legendColor: {
        width: 20,
        height: 20,
        borderRadius: 4,
        marginBottom: 8,
    },
    legendText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000000',
        marginBottom: 2,
    },
    legendSubtext: {
        fontSize: 11,
        color: '#666666',
    },
    debugCard: {
        backgroundColor: '#FFF8E1',
        marginHorizontal: 15,
        marginBottom: 15,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFD54F',
    },
    debugTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#FF8F00',
        marginBottom: 5,
    },
    debugText: {
        fontSize: 11,
        color: '#666666',
        marginBottom: 2,
    },
    actionsContainer: {
        flexDirection: 'row',
        marginHorizontal: 15,
        marginBottom: 30,
    },
    refreshButton: {
        flex: 1,
        backgroundColor: NAVY_BLUE,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginRight: 10,
    },
    refreshButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    historyButton: {
        flex: 1,
        backgroundColor: '#E8F5E9',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#C8E6C9',
    },
    historyButtonText: {
        color: '#2E7D32',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        color: '#666666',
        fontSize: 14,
        padding: 20,
    },
    recordCard: {
        backgroundColor: WHITE,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 14,
        color: '#666666',
        marginBottom: 8,
    },
    summaryValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: NAVY_BLUE,
        marginBottom: 5,
    },
    summarySubtext: {
        fontSize: 12,
        color: '#999999',
        fontStyle: 'italic',
    },
});

export default PredictiveAnalysisScreen;