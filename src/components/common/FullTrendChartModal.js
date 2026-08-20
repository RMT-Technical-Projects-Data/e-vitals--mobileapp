/* FullTrendChartModal.js – Full Screen Chart Modal Component */
import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    Platform,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { lockToLandscape, lockToPortrait } from '../../utils/orientationHelper';

// Get dimensions once and memoize them
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/* ──────────────────────  COLORS  ────────────────────── */
const THEME_PRIMARY = '#0b1f3f';
const CHART_SECONDARY = '#1B3A5C';
const WHITE = '#FFFFFF';
const TEXT_MUTED = '#687382';
const BORDER_SOFT = 'rgba(15, 23, 42, 0.08)';

/* ──────────────────────  RESPONSIVE UTILITIES  ────────────────────── */
// Fixed responsive scaling that won't change between reloads
const isSmallScreen = screenWidth < 375;
const isLargeScreen = screenWidth > 414;

// Fixed scaling factors - these won't change
const getResponsiveSize = (size) => {
    const scaleFactor = screenWidth / 375; // Base on iPhone 6/7/8 width
    const scaledSize = size * scaleFactor;

    // Round to nearest 0.5 for better rendering
    return Math.round(scaledSize * 2) / 2;
};

const getResponsiveHeight = (size) => {
    const scaleFactor = screenHeight / 812; // Base on iPhone X height
    const scaledSize = size * scaleFactor;
    return Math.round(scaledSize * 2) / 2;
};

/* ──────────────────────  FIXED SCALED VALUES  ────────────────────── */
// Pre-calculate all responsive values to prevent recalculation
const SCALED_VALUES = {
    // Header
    headerPaddingHorizontal: getResponsiveSize(10),
    headerPaddingVertical: getResponsiveHeight(1),
    headerTitleFontSize: getResponsiveSize(10),
    closeButtonPadding: getResponsiveSize(4),
    closeButtonMarginLeft: getResponsiveSize(6),
    closeButtonFontSize: getResponsiveSize(18),

    // Chart Container
    scrollPadding: getResponsiveSize(13),
    scrollPaddingLeft: getResponsiveSize(0.2),
    chartBorderRadius: getResponsiveSize(8),

    // Legend
    legendMarginTop: getResponsiveHeight(16),
    legendPaddingVertical: getResponsiveHeight(12),
    legendBorderRadius: getResponsiveSize(8),
    legendItemMarginHorizontal: getResponsiveSize(16),
    legendDotSize: getResponsiveSize(6),
    legendDotMarginRight: getResponsiveSize(8),
    legendTextFontSize: getResponsiveSize(6),
};

/* ──────────────────────  FULL CHART MODAL COMPONENT  ────────────────────── */
const FullTrendChartModal = ({
    visible = false,
    onClose,
    measurements = [],
    dataType = 'bloodPressure',
    title = 'Trend Chart',
    themePrimary = THEME_PRIMARY,
    chartSecondary = CHART_SECONDARY,
}) => {
    // Add useEffect for orientation handling
    useEffect(() => {
        if (visible) {
            lockToLandscape();
        }
        
        return () => {
            if (visible) {
                lockToPortrait();
            }
        };
    }, [visible]);

    if (measurements.length === 0) {
        return null;
    }

    /* ───── CHART DATA PREPARATION ───── */
    const getChartData = () => {
        const targetCount = 10;
        const step = Math.max(1, Math.ceil(measurements.length / targetCount));

        const labels = measurements.map((m, index) => {
            if (index % step === 0 || index === measurements.length - 1) {
                return formatLabel(m.date);
            }
            return '';
        });

        return {
            labels: labels,
            datasets:
                dataType === 'bloodPressure'
                    ? [
                        {
                            data: measurements.map(m => m.systolic),
                            strokeWidth: 3,
                            color: () => themePrimary,
                        },
                        {
                            data: measurements.map(m => m.diastolic),
                            strokeWidth: 3,
                            color: () => chartSecondary,
                        },
                    ]
                    : [
                        {
                            data: measurements.map(m =>
                                dataType === 'bloodGlucose' ? m.glucose : m.weight
                            ),
                            color: () => themePrimary,
                            strokeWidth: 3,
                        },
                    ],
        };
    };

    const formatLabel = (dateStr) => {
        try {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const month = parts[0];
                const day = parts[1];
                return `${month}/${day}`;
            }
        } catch (e) {
            return dateStr;
        }
        return dateStr;
    };

    const chartData = getChartData();

    const chartConfig = {
        backgroundGradientFrom: WHITE,
        backgroundGradientTo: WHITE,
        decimalPlaces: 0,
        color: () => themePrimary,
        labelColor: () => TEXT_MUTED,
        propsForDots: {
            r: '3',
            strokeWidth: '2',
            stroke: themePrimary,
        },
        propsForLabels: {
            fontSize: getResponsiveSize(10), // Fixed responsive font for chart labels
            fontWeight: '600',
        },
        strokeWidth: 3,
        useShadowColorFromDataset: false,
    };

    // Width calculation ONLY for the LineChart component
    const modalChartWidth = Math.max(screenWidth * 0.7, measurements.length * 35);

    return (
        <Modal
            transparent={false}
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
            supportedOrientations={['landscape']} // This is key for iOS
        >
            <SafeAreaView style={styles.fullChartContainer}>
                <View style={[styles.fullChartHeader, { backgroundColor: themePrimary }]}>
                    <Text style={styles.fullChartHeaderTitle}>{title}</Text>
                    <TouchableOpacity
                        style={styles.fullChartCloseButton}
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.fullChartCloseButtonText}>✕</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    horizontal
                    style={styles.fullChartScrollView}
                    contentContainerStyle={styles.fullChartScrollContent}
                    showsHorizontalScrollIndicator={true}
                >
                    <View style={styles.fullChartChartContainer}>
                        <LineChart
                            data={chartData}
                            width={modalChartWidth}
                            height={screenHeight * 0.5}
                            chartConfig={chartConfig}
                            bezier
                            style={styles.fullChartChart}
                            withHorizontalLines={true}
                            withVerticalLines={false}
                            fromZero={false}
                            segments={4}
                        />

                        {/* Legend for Blood Pressure */}
                        {dataType === 'bloodPressure' && (
                            <View style={styles.fullChartLegend}>
                                <View style={styles.fullChartLegendItem}>
                                    <View style={[styles.fullChartLegendDot, { backgroundColor: themePrimary }]} />
                                    <Text style={styles.fullChartLegendText}>Systolic</Text>
                                </View>
                                <View style={styles.fullChartLegendItem}>
                                    <View style={[styles.fullChartLegendDot, { backgroundColor: chartSecondary }]} />
                                    <Text style={styles.fullChartLegendText}>Diastolic</Text>
                                </View>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
};

/* ──────────────────────  STYLES  ────────────────────── */
const styles = StyleSheet.create({
    fullChartContainer: {
        flex: 1,
        backgroundColor: WHITE,
    },
    fullChartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SCALED_VALUES.headerPaddingHorizontal,
        paddingVertical: SCALED_VALUES.headerPaddingVertical,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_SOFT,
    },
    fullChartHeaderTitle: {
        fontSize: SCALED_VALUES.headerTitleFontSize,
        fontWeight: '600',
        color: WHITE,
        flex: 1,
    },
    fullChartCloseButton: {
        padding: SCALED_VALUES.closeButtonPadding,
        marginLeft: SCALED_VALUES.closeButtonMarginLeft,
    },
    fullChartCloseButtonText: {
        fontSize: SCALED_VALUES.closeButtonFontSize,
        color: WHITE,
        fontWeight: '300',
    },
    fullChartScrollView: {
        flex: 1,
    },
    fullChartScrollContent: {
        padding: SCALED_VALUES.scrollPadding,
        paddingLeft: SCALED_VALUES.scrollPaddingLeft,
    },
    fullChartChartContainer: {
        backgroundColor: WHITE,
    },
    fullChartChart: {
        borderRadius: SCALED_VALUES.chartBorderRadius,
    },
    fullChartLegend: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: SCALED_VALUES.legendMarginTop,
        paddingVertical: SCALED_VALUES.legendPaddingVertical,
        backgroundColor: '#F8F9FA',
        borderRadius: SCALED_VALUES.legendBorderRadius,
    },
    fullChartLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: SCALED_VALUES.legendItemMarginHorizontal,
    },
    fullChartLegendDot: {
        width: SCALED_VALUES.legendDotSize,
        height: SCALED_VALUES.legendDotSize,
        borderRadius: SCALED_VALUES.legendDotSize,
        marginRight: SCALED_VALUES.legendDotMarginRight,
    },
    fullChartLegendText: {
        fontSize: SCALED_VALUES.legendTextFontSize,
        color: TEXT_MUTED,
        fontWeight: '600',
    },
});

export default FullTrendChartModal;