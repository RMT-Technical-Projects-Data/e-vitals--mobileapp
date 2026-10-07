/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  StatusBar,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Image,
  Modal,
  Animated,
  Easing,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { formatLastFirstName } from '../../utils/formatPersonName';
import { useFocusEffect } from '@react-navigation/native';
import PremiumBottomNav, { PREMIUM_BOTTOM_NAV_CLEARANCE } from '../../components/navigation/PremiumBottomNav';
import { EV } from '../../config/colors';
import {
  DEFAULT_VITAL_TARGETS,
  checkFatValue,
  checkPulseValue,
  getBmiCategoryStatus,
  getVitalColor,
  getVitalStatusColor,
  normalizeWeightToLbs,
  readOptionalVitalNumber,
} from '../../utils/measurementUtils';
import PulseIcon from '../../components/common/PulseIcon';
import { getPatientListVitalColors } from '../../utils/patientVitalTargets';
import { subscribeAbnormalAssignmentReceived } from '../../utils/abnormalAssignmentEvents';
import {
  getUnreadNotificationCount,
  refreshNotificationInbox,
  subscribeNotificationInbox,
} from '../../utils/notificationInbox';
import { areNotificationsEnabled } from '../../utils/notificationPreference';
import PatientAvatar from '../../components/common/PatientAvatar';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleHeight = (size) => Math.min((height / guidelineBaseHeight) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);
const eVitalsLogo = require('../../assets/images/batch_06/logo5.png');
const SCREEN_BG_COLORS = [EV.surface, EV.surface, EV.surface];
const QUICK_ACCESS_ICON_COLORS = EV.buttonGradient;

const toSafeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const getNormalizedStatus = (p) => {
  const raw = p?.status ?? p?.status_id ?? p?.patient_status ?? p?.status_numeric ?? null;
  if (raw === null || raw === undefined || raw === '' || raw === 0 || raw === '0') return 2;
  if (typeof raw === 'number') {
    if (raw === 1) return 4;
    if (raw === 3) return 3;
    if (raw === 4) return 4;
    return 2;
  }
  const txt = String(raw).trim().toLowerCase();
  if (txt === 'inactive' || txt === '1' || txt === 'i') return 4;
  if (txt === 'pending' || txt === '3' || txt === 'p') return 3;
  if (txt === 'locked' || txt === 'lock' || txt === '4' || txt === 'l' || txt === 'lost') return 4;
  if (txt === 'active' || txt === '2' || txt === 'a') return 2;
  return 2;
};

const getCptPercent = (count, total) => {
  if (!total) return 0;
  return Math.round((toSafeNumber(count, 0) / total) * 100);
};

// Sparkline trend vectors
const Sparkline = ({ points, color }) => {
  const coords = points.trim().split(' ').map((p) => p.split(',').map(Number));
  const lastCoord = coords[coords.length - 1];
  return (
    <View style={{ width: 60, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width="60" height="24" viewBox="0 0 60 24">
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {lastCoord && <Circle cx={lastCoord[0]} cy={lastCoord[1]} r="2" fill={color} />}
      </Svg>
    </View>
  );
};

const AppHeader = ({ color, onNotifications, onMenuPress, showBadge = false }) => (
  <View style={st.evTopbar} pointerEvents="box-none">
    <Image source={eVitalsLogo} style={st.evLogo} resizeMode="contain" pointerEvents="none" />
    <View style={st.topbarActions} pointerEvents="box-none">
      <TouchableOpacity
        style={st.evIconButton}
        onPress={onNotifications}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
      >
        <MaterialIcons name="notifications-none" size={21} color={color} />
        {showBadge ? <View style={st.notifBadge} pointerEvents="none" /> : null}
      </TouchableOpacity>
      {Boolean(onMenuPress) && (
        <TouchableOpacity
          style={st.evIconButton}
          onPress={onMenuPress}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <MaterialIcons name="more-vert" size={21} color={color} />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const ThreeDotMenu = ({ visible, onClose, onLookupPatient, onFollowUp }) => (
  <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
    <TouchableOpacity style={st.menuOverlay} activeOpacity={1} onPress={onClose}>
      <View style={st.menuDropdown}>
        <TouchableOpacity
          style={st.menuItem}
          onPress={() => { onClose(); onLookupPatient(); }}
          activeOpacity={0.75}
        >
          <MaterialIcons name="search" size={18} color={EV.navy} style={st.menuItemIcon} />
          <Text style={st.menuItemText}>Look up Patient</Text>
        </TouchableOpacity>
        <View style={st.menuDivider} />
        <TouchableOpacity
          style={st.menuItem}
          onPress={() => { onClose(); onFollowUp(); }}
          activeOpacity={0.75}
        >
          <MaterialIcons name="assignment" size={18} color={EV.navy} style={st.menuItemIcon} />
          <Text style={st.menuItemText}>Follow Up</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
);

const RoleIntro = ({ eyebrow, title, practiceName, subtitle, color, practiceNameColor = EV.blue }) => (
  <View style={st.evIntro}>
    <Text style={[st.evEyebrow, { color }]}>{eyebrow}</Text>
    <Text style={st.evTitle}>{title}</Text>
    {!!practiceName && (
      <View style={st.practiceRow}>
        <Text style={[st.practiceName, { color: practiceNameColor }]}>{practiceName}</Text>
      </View>
    )}
    {!!subtitle && <Text style={st.evSubtitle}>{subtitle}</Text>}
  </View>
);

const SectionTitle = ({ title, subtitle, actionLabel, actionColor, onPress, subtitleOnRight = false }) => (
  <View style={[st.evSectionHeader, subtitleOnRight && st.evSectionHeaderRow]}>
    <View style={[subtitleOnRight ? st.evSectionTitleRow : { flex: 1 }]}>
      <Text style={st.evSectionTitle}>{title}</Text>
      {!!subtitle && (
        <Text style={[st.evSectionSubtitle, subtitleOnRight && st.evSectionSubtitleRight]} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
    {!!actionLabel && (
      onPress ? (
        <TouchableOpacity onPress={onPress} accessibilityRole="button">
          <Text style={[st.evSectionAction, { color: actionColor || EV.navyMid }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[st.evSectionAction, { color: actionColor || EV.navyMid }]}>{actionLabel}</Text>
      )
    )}
  </View>
);

const PANEL_METRIC_TOTAL_FR = 1.07;
const PANEL_METRIC_SMALL_FR = 0.76;
const PANEL_METRIC_FR_SUM = PANEL_METRIC_TOTAL_FR + PANEL_METRIC_SMALL_FR * 3;

const getPanelHeroPadding = () => scaleWidth(22);
const getPanelMetricGap = () => scaleWidth(8);

const getPanelMetricWidths = () => {
  const scrollPad = Math.max(scaleWidth(16), 16);
  const heroPad = getPanelHeroPadding();
  const gap = getPanelMetricGap();
  const rowWidth = width - scrollPad * 2 - heroPad * 2 - gap * 3;
  return {
    total: rowWidth * (PANEL_METRIC_TOTAL_FR / PANEL_METRIC_FR_SUM),
    small: rowWidth * (PANEL_METRIC_SMALL_FR / PANEL_METRIC_FR_SUM),
    gap,
  };
};

const PanelMetricCard = ({ value, label, valueColor = '#fff', isTotal = false, cardWidth, gap, isLast = false }) => (
  <View
    style={[
      st.panelMetric,
      isTotal && st.panelMetricTotal,
      { width: cardWidth, marginRight: isLast ? 0 : gap },
    ]}
  >
    <Text style={[st.panelMetricValue, valueColor !== '#fff' && { color: valueColor }]}>{String(value ?? 0)}</Text>
    <Text style={st.panelMetricLabel} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const CapsulePanelSummary = ({ total = 0, active = 0, pending = 0, locked = 0, navigation }) => {
  // Animated translateX (not ScrollView.scrollTo) — continuous scrollTo was stealing
  // touches from Dashboard Counts and other rows below this section.
  const translateX = React.useRef(new Animated.Value(0)).current;
  const loopWidthRef = React.useRef(0);
  const positionRef = React.useRef(0);
  const pausedRef = React.useRef(false);
  const layoutTimerRef = React.useRef(null);
  const runFromRef = React.useRef(() => {});
  const generationRef = React.useRef(0);

  const MARQUEE_PX_PER_SECOND = 32;

  const baseItems = [
    {
      key: 'all',
      label: 'All',
      count: total,
      bg: EV.surface,
      borderColor: EV.navy,
      textColor: EV.navy,
      dotColor: EV.navy,
      onPress: () => navigation?.navigate('Patients', {
        dashboardFilter: null,
        filterTitle: null,
        filterToken: Date.now(),
      }),
    },
    {
      key: 'active',
      label: 'Active',
      count: active,
      bg: EV.bluePale,
      borderColor: EV.accent,
      textColor: EV.blueDeep,
      dotColor: EV.accent,
      onPress: () => navigation?.navigate('Patients', {
        dashboardFilter: 'active',
        filterTitle: 'Active Patients',
        filterToken: Date.now(),
      }),
    },
    {
      key: 'pending',
      label: 'Pending',
      count: pending,
      bg: '#EFF8FC',
      borderColor: EV.blue,
      textColor: EV.navy,
      dotColor: EV.blue,
      onPress: () => navigation?.navigate('Patients', {
        dashboardFilter: 'pending',
        filterTitle: 'Pending Patients',
        filterToken: Date.now(),
      }),
    },
    {
      key: 'locked',
      label: 'Locked',
      count: locked,
      bg: '#F0F4F8',
      borderColor: EV.navyMid,
      textColor: EV.navyMid,
      dotColor: EV.navyMid,
      onPress: () => navigation?.navigate('Patients', {
        dashboardFilter: 'locked',
        filterTitle: 'Locked Patients',
        filterToken: Date.now(),
      }),
    },
  ];

  const beginTimingRef = React.useRef(() => {});
  beginTimingRef.current = (start) => {
    const width = loopWidthRef.current;
    if (pausedRef.current || width <= 0) return;
    const generation = ++generationRef.current;
    translateX.setValue(start);
    positionRef.current = start;
    const distance = Math.max(width + start, 1);
    Animated.timing(translateX, {
      toValue: -width,
      duration: (distance / MARQUEE_PX_PER_SECOND) * 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || pausedRef.current || generation !== generationRef.current) return;
      // Second copy is now exactly where the first copy started, so All re-enters from the right.
      beginTimingRef.current(0);
    });
  };

  runFromRef.current = (fromValue) => {
    const width = loopWidthRef.current;
    if (pausedRef.current || width <= 0) return;

    let start = Number(fromValue) || 0;
    if (start > 0) start = 0;
    while (start <= -width) start += width;

    generationRef.current += 1;
    translateX.stopAnimation(() => {
      if (pausedRef.current || loopWidthRef.current <= 0) return;
      beginTimingRef.current(start);
    });
  };

  const applySegmentWidth = (nextWidth) => {
    if (nextWidth <= 0) return;
    const previousWidth = loopWidthRef.current;
    if (previousWidth > 0 && Math.abs(nextWidth - previousWidth) < 1) return;

    if (previousWidth <= 0) {
      loopWidthRef.current = nextWidth;
      beginTimingRef.current(0);
      return;
    }

    const generation = ++generationRef.current;
    translateX.stopAnimation((value) => {
      if (generation !== generationRef.current) return;
      const current = Number.isFinite(value) ? value : positionRef.current;
      const ratio = (Math.abs(current) % previousWidth) / previousWidth;
      loopWidthRef.current = nextWidth;
      const nextPosition = -ratio * nextWidth;
      positionRef.current = nextPosition;
      if (!pausedRef.current) beginTimingRef.current(nextPosition);
    });
  };

  React.useEffect(() => () => {
    pausedRef.current = true;
    if (layoutTimerRef.current) clearTimeout(layoutTimerRef.current);
    translateX.stopAnimation();
  }, [translateX]);

  const pauseMarquee = () => {
    pausedRef.current = true;
    generationRef.current += 1;
    translateX.stopAnimation((value) => {
      if (Number.isFinite(value)) positionRef.current = value;
    });
  };

  const resumeMarquee = () => {
    pausedRef.current = false;
    runFromRef.current(positionRef.current);
  };

  return (
    <View style={st.capsuleCarouselWrap}>
      <View style={st.capsuleCarouselClip}>
        <Animated.View
          style={[st.capsuleCarouselTrack, { transform: [{ translateX }] }]}
        >
          {[0, 1].map((copy) => (
            <View
              key={`capsule-set-${copy}`}
              style={st.capsuleCarouselSet}
              onLayout={copy === 0 ? (e) => {
                const next = e.nativeEvent.layout.width;
                if (next <= 0) return;
                if (layoutTimerRef.current) clearTimeout(layoutTimerRef.current);
                layoutTimerRef.current = setTimeout(() => applySegmentWidth(next), 180);
              } : undefined}
            >
              {baseItems.map((item) => (
            <TouchableOpacity
              key={`${item.key}-${copy}`}
              style={[
                st.capsulePill,
                {
                  backgroundColor: item.bg,
                  borderColor: item.borderColor,
                },
              ]}
              onPress={item.onPress}
              onPressIn={pauseMarquee}
              onPressOut={resumeMarquee}
              activeOpacity={0.8}
            >
              {item.dotColor && (
                <View style={[st.capsuleDot, { backgroundColor: item.dotColor }]} />
              )}
              <Text style={[st.capsuleLabel, { color: item.textColor }]}>
                {item.label}
              </Text>
              <View
                style={[
                  st.capsuleBadge,
                  { backgroundColor: 'rgba(11, 31, 63, 0.08)' },
                ]}
              >
                <Text style={[st.capsuleCountText, { color: item.textColor }]}>
                  {item.count}
                </Text>
              </View>
            </TouchableOpacity>
              ))}
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
};

const DashboardCountsSection = ({
  missedUploadsCount = 0,
  abnormalCount = 0,
  recentUploadsCount = 0,
  assignedReviewsCount = 0,
  navigation,
}) => {
  const openDashboardCount = (dashboardFilter, filterTitle) => {
    if (!navigation?.navigate) return;
    navigation.navigate({
      name: 'Patients',
      params: {
        dashboardFilter,
        filterTitle,
        filterToken: Date.now(),
      },
      merge: true,
    });
  };

  const items = [
    {
      id: '01',
      title: 'Missed Uploads',
      value: missedUploadsCount,
      valueColor: EV.navy,
      onPress: () => openDashboardCount('missedUploads', 'Missed Uploads'),
    },
    {
      id: '02',
      title: 'Abnormal Readings',
      value: abnormalCount,
      valueColor: abnormalCount > 0 ? EV.abnormal : EV.navy,
      onPress: () => openDashboardCount('abnormalMeasurements', 'Abnormal Readings'),
    },
    {
      id: '03',
      title: 'Assigned Reviews',
      value: assignedReviewsCount,
      valueColor: assignedReviewsCount > 0 ? EV.abnormal : EV.navy,
      onPress: () => navigation?.navigate?.('AssignedAbnormalReviews'),
    },
    {
      id: '04',
      title: 'Recent Uploads',
      value: recentUploadsCount,
      valueColor: EV.navy,
      onPress: () => openDashboardCount('recentUploads', 'Recent Uploads'),
    },
  ];

  return (
    <View style={st.dbCountsWrap}>
      <View style={st.dbCountsHeaderRow}>
        <Text style={st.dbCountsHeaderTitle}>Dashboard Counts</Text>
      </View>
      <View style={st.dbCountsCardContainer}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                st.dbCountsRow,
                !isLast && st.dbCountsRowDivider,
                pressed && { opacity: 0.7 },
              ]}
              onPress={item.onPress}
              hitSlop={8}
            >
              <Text style={st.dbCountsRowTitle}>{item.title}</Text>
              <View style={st.dbCountsRightWrap} pointerEvents="none">
                <Text style={[st.dbCountsValue, { color: item.valueColor }]}>{item.value}</Text>
                <MaterialIcons name="chevron-right" size={20} color={EV.mutedLight} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const CriticalAlertRow = ({ name, detail, severity = 'High', critical, onPress }) => {
  const content = (
    <View style={st.criticalRow}>
      <View style={st.criticalText}>
        <Text style={st.criticalName}>{name}</Text>
        <Text style={st.criticalDetail}>{detail}</Text>
      </View>
      <View style={[st.severityBadge, critical ? st.severityCritical : st.severityHigh]}>
        <Text style={st.severityText}>{severity}</Text>
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      {content}
    </TouchableOpacity>
  );
};

// CPT code metadata matching the web's programAnalyticsConfig.js
const CPT_CODE_META = {
  '99453': { desc: 'Device setup & education' },
  '99445': { desc: 'Device supply 2-15 readings/days' },
  '99454': { desc: 'Device supply ≥16 readings/days' },
  '99470': { desc: 'Monitoring mgmt 10-19 min' },
  '99457': { desc: 'Monitoring mgmt ≥20 min' },
  '99458': { desc: "Monitoring mgmt add'l 20 min" },
};

/**
 * CPT Eligibility Card — matches the web's ppa-cpt-tile-grid.
 * Each row shows: code pill | description | Elig count (green) | Inelig count (red) | fill bar.
 */
const CptEligibilityCard = ({ rows, theme = 'care', onCptPress }) => {
  const themeAccent = EV.navyMid;
  return (
    <View style={st.cptCard}>
      {/* Header */}
      <View style={st.cptHeader}>
        <Text style={st.cptHeaderTitle}>
          {theme === 'provider' ? 'RPM code readiness' : 'RPM code readiness'}
        </Text>
        <View style={st.cptHeaderLegend}>
          <View style={[st.cptLegendDot, { backgroundColor: EV.blueDeep }]} />
          <Text style={[st.cptLegendLabel, { color: EV.blueDeep }]}>Elig</Text>
          <View style={[st.cptLegendDot, { backgroundColor: EV.criticalStrong, marginLeft: scaleWidth(10) }]} />
          <Text style={[st.cptLegendLabel, { color: EV.criticalStrong }]}>Inelig</Text>
        </View>
      </View>

      {/* CPT rows */}
      {rows.map((row, index) => {
        const meta = CPT_CODE_META[row.code] || {};
        const eligible = typeof row.eligible === 'number' ? row.eligible : row.count || 0;
        const ineligible = typeof row.ineligible === 'number' ? row.ineligible : 0;
        const total = eligible + ineligible;
        const fillPct = total > 0 ? Math.round((eligible / total) * 100) : 0;
        const barColors = row.variant === 'warn'
          ? [EV.blueLight, EV.blueTint]
          : row.variant === 'navy'
            ? [EV.navy, EV.blueDeep]
            : [EV.blue, EV.accent];
        const isLast = index === rows.length - 1;

        const rowContent = (
          <View key={row.code} style={[st.cptRow, !isLast && st.cptRowDivider]}>
            {/* Left: code pill + description */}
            <View style={st.cptMeta}>
              <View style={[st.cptCodePill, { backgroundColor: themeAccent }]}>
                <Text style={st.cptCodePillText}>{row.code}</Text>
              </View>
              <Text style={st.cptDesc} numberOfLines={2}>{meta.desc || `CPT ${row.code}`}</Text>
            </View>

            {/* Right: counts */}
            <View style={st.cptRight}>
              <View style={st.cptCounts}>
                <View style={st.cptCountCol}>
                  <Text style={[st.cptCountNum, { color: EV.blueDeep }]}>{eligible}</Text>
                  <Text style={st.cptCountLabel}>Elig</Text>
                </View>
                <View style={[st.cptCountCol, { marginLeft: scaleWidth(12) }]}>
                  <Text style={[st.cptCountNum, { color: EV.criticalStrong }]}>{ineligible}</Text>
                  <Text style={st.cptCountLabel}>Inelig</Text>
                </View>
              </View>
            </View>
          </View>
        );

        if (onCptPress) {
          return (
            <TouchableOpacity key={row.code} onPress={() => onCptPress(row.code)} activeOpacity={0.75}>
              {rowContent}
            </TouchableOpacity>
          );
        }

        return rowContent;
      })}
    </View>
  );
};

const PatientTrendSlidesCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const cardPadding = scaleWidth(16);
  const chartWidth = Math.max(pageWidth - cardPadding * 2, 0);
  const chartHeight = scaleHeight(150);
  const left = 32;
  const right = 12;
  const top = 16;
  const bottom = 28;
  const innerW = Math.max(chartWidth - left - right, 0);
  const innerH = chartHeight - top - bottom;

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const bpData = {
    systole: [138, 142, 135, 140, 145, 139, 141],
    diastole: [88, 90, 85, 89, 92, 87, 90],
    pulse: [74, 78, 72, 76, 80, 75, 77],
  };

  const bgData = [115, 122, 108, 118, 125, 112, 120];
  const weightData = [182.5, 182.2, 181.8, 181.5, 181.2, 180.9, 180.6];

  const handleScroll = (event) => {
    if (!pageWidth) return;
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / pageWidth);
    if (index !== activeIndex && index >= 0 && index < 3) {
      setActiveIndex(index);
    }
  };

  const renderSingleChart = ({ lines, minVal, maxVal, title }) => {
    const range = maxVal - minVal || 1;

    const toPoint = (val, i, total) => {
      const x = left + (i / (total - 1)) * innerW;
      const y = top + (1 - (val - minVal) / range) * innerH;
      return { x, y, str: `${x},${y}` };
    };

    return (
      <View key={title} style={[st.trendSlidePage, { width: pageWidth }]}>
        <View style={st.trendSlideCard}>
        <View style={st.trendSlideHeader}>
          <Text style={st.trendSlideTitle}>{title}</Text>
          <View style={st.trendSlideLegendRow}>
            {lines.map((l) => (
              <View key={l.label} style={st.legendItem}>
                <View style={[st.legendDot, { backgroundColor: l.color }]} />
                <Text style={st.legendLabel}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          {[0, 1, 2, 3].map((tick) => {
            const y = top + tick * (innerH / 3);
            const valLabel = Math.round(maxVal - tick * (range / 3));
            return (
              <React.Fragment key={tick}>
                <Line x1={left} y1={y} x2={left + innerW} y2={y} stroke="rgba(7,27,52,0.06)" strokeWidth="1" />
                <SvgText x={left - 6} y={y + 3} fontSize="9" fontWeight="700" fill={EV.mutedLight} textAnchor="end">
                  {valLabel}
                </SvgText>
              </React.Fragment>
            );
          })}

          <Line x1={left} y1={top} x2={left} y2={top + innerH} stroke="rgba(7,27,52,0.18)" strokeWidth="1" />
          <Line x1={left} y1={top + innerH} x2={left + innerW} y2={top + innerH} stroke="rgba(7,27,52,0.18)" strokeWidth="1" />

          {lines.map((l) => {
            const pointsStr = l.data.map((v, i) => toPoint(v, i, l.data.length).str).join(' ');
            return (
              <React.Fragment key={l.label}>
                <Polyline
                  points={pointsStr}
                  fill="none"
                  stroke={l.color}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {l.data.map((v, i) => {
                  const pt = toPoint(v, i, l.data.length);
                  return (
                    <Circle
                      key={`${l.label}-${i}`}
                      cx={pt.x}
                      cy={pt.y}
                      r="3.5"
                      fill={EV.surface}
                      stroke={l.color}
                      strokeWidth="2"
                    />
                  );
                })}
              </React.Fragment>
            );
          })}

          {days.map((day, i) => (
            <SvgText
              key={day}
              x={left + (i / (days.length - 1)) * innerW}
              y={chartHeight - 6}
              fontSize="9"
              fontWeight="700"
              fill={EV.mutedLight}
              textAnchor="middle"
            >
              {day}
            </SvgText>
          ))}
        </Svg>
        </View>
      </View>
    );
  };

  return (
    <View
      style={st.trendCarouselWrap}
      onLayout={(event) => {
        const nextWidth = Math.floor(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== pageWidth) setPageWidth(nextWidth);
      }}
    >
      {pageWidth > 0 ? (
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        style={{ width: pageWidth }}
        contentContainerStyle={st.trendCarouselContent}
      >
        {/* Slide 1: Blood Pressure & Pulse */}
        {renderSingleChart({
          title: 'Blood Pressure & Pulse',
          lines: [
            { label: 'Systole', color: EV.navyDark, data: bpData.systole },
            { label: 'Diastole', color: EV.blue, data: bpData.diastole },
            { label: 'Pulse', color: EV.accent, data: bpData.pulse },
          ],
          minVal: 60,
          maxVal: 160,
        })}

        {/* Slide 2: Blood Glucose */}
        {renderSingleChart({
          title: 'Blood Glucose (mg/dL)',
          lines: [
            { label: 'Glucose', color: EV.blueDeep, data: bgData },
          ],
          minVal: 90,
          maxVal: 140,
        })}

        {/* Slide 3: Weight */}
        {renderSingleChart({
          title: 'Weight (lb)',
          lines: [
            { label: 'Weight', color: EV.navyMid, data: weightData },
          ],
          minVal: 175,
          maxVal: 185,
        })}
      </ScrollView>
      ) : null}

      {/* Pagination Indicators */}
      <View style={st.trendDotsRow}>
        {[0, 1, 2].map((idx) => (
          <View
            key={idx}
            style={[
              st.trendDotItem,
              idx === activeIndex && st.trendDotItemActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const SvgTextShim = ({ x, y, value }) => (
  <SvgText x={x} y={y} fontSize="9" fontWeight="700" fill={EV.mutedLight} textAnchor="middle">
    {value}
  </SvgText>
);

const LegendItem = ({ color, label }) => (
  <View style={st.legendItem}>
    <View style={[st.legendDot, { backgroundColor: color }]} />
    <Text style={st.legendLabel}>{label}</Text>
  </View>
);

const getAge = (dobString) => {
  if (!dobString) return null;
  try {
    const dob = new Date(dobString);
    const diffMs = Date.now() - dob.getTime();
    const ageDate = new Date(diffMs);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);
    return isNaN(age) ? null : age;
  } catch {
    return null;
  }
};

// Fallback / Mock Data matching HTML templates for premium look
const fallbackCaregiverPatients = [
  {
    id: 'mock-1',
    first_name: 'Cyrus',
    last_name: 'Nguyen',
    dob: '1968-05-12',
    gender: 'Male',
    vitals: 'Hypertension',
    status: 'Critical',
    data_summary: '142/90',
    pulse: '88',
    glucose: '6.2',
    weight: '74',
  },
  {
    id: 'mock-2',
    first_name: 'Anna',
    last_name: 'Lee',
    dob: '1964-08-24',
    gender: 'Female',
    vitals: 'Diabetes T2',
    status: 'Stable',
    data_summary: '118/72',
    pulse: '76',
    glucose: '5.8',
    weight: '68',
  },
  {
    id: 'mock-3',
    first_name: 'Robert',
    last_name: 'Mills',
    dob: '1955-11-03',
    gender: 'Male',
    vitals: 'Heart Disease',
    status: 'Stable',
    data_summary: '122/78',
    pulse: '72',
    glucose: '5.1',
    weight: '80',
  },
];

const RECENT_UPLOAD_WINDOW_MS = 24 * 60 * 60 * 1000;

const parseUploadMs = (value) => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const collectPatientReadings = (patient) => {
  const readings = [];
  const systolic = patient?.last_systolic ?? patient?.systolic;
  const diastolic = patient?.last_diastolic ?? patient?.diastolic;
  const glucose = patient?.last_glucose ?? patient?.glucose;
  const weight = patient?.last_weight ?? patient?.weight;
  const weightNum = Number(weight);
  const pulseNum = Number(patient?.last_pulse ?? patient?.pulse);
  const hasPulse = Number.isFinite(pulseNum) && pulseNum > 0;
  const colors = getPatientListVitalColors(patient, {
    bp: systolic != null && diastolic != null && systolic !== '' && diastolic !== ''
      ? `${systolic}/${diastolic}`
      : '--',
    glucose: glucose != null && glucose !== '' ? glucose : '--',
    weight: Number.isFinite(weightNum) && weightNum > 0 ? weightNum : '--',
    pulse: hasPulse ? pulseNum : null,
  });

  const bpAt = parseUploadMs(patient?.last_bp_at || patient?.last_bp_date);
  if (bpAt && systolic != null && diastolic != null && systolic !== '' && diastolic !== '') {
    readings.push({
      type: 'BP',
      label: 'BP (mmHg)',
      systolic: Math.round(Number(systolic)),
      diastolic: Math.round(Number(diastolic)),
      sysColor: colors.sysColor,
      diaColor: colors.diaColor,
      pulse: hasPulse ? Math.round(pulseNum) : null,
      pulseColor: colors.pulseColor,
      isPulseAbnormal: colors.isPulseAbnormal,
      at: bpAt,
    });
  }

  const bgAt = parseUploadMs(patient?.last_bg_at || patient?.last_bg_date);
  const glucoseNum = Number(glucose);
  if (bgAt && glucose != null && glucose !== '' && Number.isFinite(glucoseNum)) {
    readings.push({
      type: 'BG',
      label: 'BG (mg/dL)',
      value: String(Math.round(glucoseNum)),
      unit: 'mg/dL',
      color: colors.glucoseColor,
      at: bgAt,
    });
  }

  const wtAt = parseUploadMs(patient?.last_wt_at || patient?.last_wt_date);
  if (wtAt && weight != null && weight !== '' && Number.isFinite(weightNum) && weightNum > 0) {
    readings.push({
      type: 'WT',
      label: 'WT (lbs)',
      value: weightNum.toFixed(1),
      unit: 'lb',
      color: colors.weightColor,
      at: wtAt,
    });
  }

  return readings.sort((a, b) => b.at - a.at);
};

const buildRecentUploadCards = (patients) => {
  const now = Date.now();
  return (patients || [])
    .map((patient) => {
      const readings = collectPatientReadings(patient);
      if (!readings.length) return null;
      const recent = readings.filter((reading) => now - reading.at <= RECENT_UPLOAD_WINDOW_MS);
      const shown = recent.length ? recent : [readings[0]];
      return { patient, readings: shown, uploadedAt: shown[0].at };
    })
    .filter(Boolean)
    .sort((a, b) => b.uploadedAt - a.uploadedAt)
    .slice(0, 3);
};

const formatUploadAge = (ms) => {
  const diff = Date.now() - ms;
  if (!Number.isFinite(diff) || diff < 0) return '';
  if (diff < 60 * 1000) return 'Just now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const recentUploadPillLabel = (type) => {
  if (type === 'WT') return 'W';
  return type;
};

const RecentUploadCard = ({ patient, readings, page, onChangePage, onOpen }) => {
  const safePage = Math.min(page, Math.max(readings.length - 1, 0));
  const scrollRef = useRef(null);
  const [cardWidth, setCardWidth] = useState(0);
  const onChangeRef = useRef(onChangePage);
  onChangeRef.current = onChangePage;

  useEffect(() => {
    if (cardWidth <= 0) return;
    scrollRef.current?.scrollTo({ x: safePage * cardWidth, animated: true });
  }, [safePage, cardWidth]);

  const renderReadingValue = (item) => (
    item.type === 'BP' ? (
      <View style={st.uploadVitalValueRow}>
        <Text style={[st.uploadVitalValue, { color: item.sysColor }]}>{item.systolic}</Text>
        <Text style={st.uploadVitalSlash}>/</Text>
        <Text style={[st.uploadVitalValue, { color: item.diaColor }]}>{item.diastolic}</Text>
        {item.pulse != null ? (
          <View style={st.uploadPulseWrap}>
            <Text style={[st.uploadPulse, { color: item.pulseColor }]}>{item.pulse}</Text>
            <PulseIcon isAbnormal={item.isPulseAbnormal} size={scaleFont(11)} />
          </View>
        ) : null}
      </View>
    ) : (
      <Text style={[st.uploadVitalValue, { color: item.color }]}>{item.value}</Text>
    )
  );

  const settlePage = (event) => {
    if (cardWidth <= 0) return;
    const nextPage = Math.round(event.nativeEvent.contentOffset.x / cardWidth);
    const clamped = Math.max(0, Math.min(readings.length - 1, nextPage));
    if (clamped !== safePage) onChangeRef.current(clamped);
  };

  return (
    <View
      style={st.uploadPager}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== cardWidth) setCardWidth(nextWidth);
      }}
    >
      {cardWidth > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={readings.length > 1}
          onMomentumScrollEnd={settlePage}
        >
          {readings.map((reading, index) => {
            const hasPrevious = index > 0;
            const hasNext = index < readings.length - 1;
            const showArrows = readings.length > 1;
            return (
              <View key={`${reading.type}-${reading.at}`} style={[st.uploadRow, { width: cardWidth }]}>
                {showArrows ? (
                  <TouchableOpacity
                    style={st.uploadSideArrow}
                    onPress={() => hasPrevious && onChangePage(index - 1)}
                    disabled={!hasPrevious}
                    hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel="Previous reading"
                  >
                    <MaterialIcons
                      name="chevron-left"
                      size={24}
                      color={hasPrevious ? EV.navy : 'transparent'}
                    />
                  </TouchableOpacity>
                ) : null}
                <Pressable style={st.uploadCardPress} onPress={onOpen}>
                  <PatientAvatar
                    profilePic={patient.profile_pic || patient.profilePic || patient.profile_image}
                    firstName={patient.first_name}
                    lastName={patient.last_name}
                    size={scaleWidth(38)}
                    borderRadius={scaleWidth(14)}
                    backgroundColor={EV.bluePale}
                    textColor={EV.blueDeep}
                    textStyle={st.uploadAvatarText}
                  />
                  <View style={st.uploadMain}>
                    <View style={st.uploadNameRow}>
                      <View style={st.uploadNameGroup}>
                        <Text style={st.uploadName} numberOfLines={1}>{formatLastFirstName(patient)}</Text>
                        <View style={st.uploadVitalPill}>
                          <Text style={st.uploadVitalPillText}>{recentUploadPillLabel(reading.type)}</Text>
                        </View>
                      </View>
                    </View>
                    {formatUploadAge(reading.at) ? (
                      <Text style={[st.uploadAge, st.uploadAgeBelow]}>{formatUploadAge(reading.at)}</Text>
                    ) : null}
                  </View>
                </Pressable>
                <View style={st.uploadValueActions}>
                  {renderReadingValue(reading)}
                </View>
                {showArrows ? (
                  <TouchableOpacity
                    style={st.uploadSideArrow}
                    onPress={() => hasNext && onChangePage(index + 1)}
                    disabled={!hasNext}
                    hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel="Next reading"
                  >
                    <MaterialIcons
                      name="chevron-right"
                      size={24}
                      color={hasNext ? EV.navy : 'transparent'}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
};

const fallbackProviderPatients = [
  {
    id: 'mock-1',
    first_name: 'Cyrus',
    last_name: 'Nguyen',
    dob: '1968-05-12',
    gender: 'Male',
    vitals: 'Hypertension',
    status: 'Critical',
    data_summary: '165/102',
    pulse: '92',
    glucose: '6.8',
  },
  {
    id: 'mock-2',
    first_name: 'Anna',
    last_name: 'Lee',
    dob: '1964-08-24',
    gender: 'Female',
    vitals: 'Diabetes T2',
    status: 'Review',
    data_summary: '118/72',
    pulse: '76',
    glucose: '12.4',
  },
];

export default function Home({ navigation }) {
  const [userRole, setUserRole] = useState(null); // 'patient', 'caregiver', 'provider'
  const [practiceName, setPracticeName] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [measurements, setMeasurements] = useState({
    bloodPressure: null,
    bloodGlucose: null,
    weight: null,
  });

  // --- Caregiver Dashboard State ---
  const [caregiverPatients, setCaregiverPatients] = useState([]);
  const [recentUploadPatients, setRecentUploadPatients] = useState([]);
  const [recentUploadIndex, setRecentUploadIndex] = useState({});
  const [isCaregiverLoading, setIsCaregiverLoading] = useState(true);
  const [caregiverFollowUps, setCaregiverFollowUps] = useState([]);
  const [totalPatientCount, setTotalPatientCount] = useState(null);
  const [caregiverDashboardStats, setCaregiverDashboardStats] = useState(null);

  // --- Provider Dashboard State ---
  const [providerPatients, setProviderPatients] = useState([]);
  const [totalProviderPatients, setTotalProviderPatients] = useState(null);
  const [isProviderLoading, setIsProviderLoading] = useState(true);
  const [providerDashboardStats, setProviderDashboardStats] = useState(null);
  const [practiceId, setPracticeId] = useState(null);
  const [patientTableId, setPatientTableId] = useState(null);
  const [assignedReviewsCount, setAssignedReviewsCount] = useState(0);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  // --- Fetch Handlers ---
  const fetchPatientVitals = useCallback(async () => {
    try {
      const response = await apiService.getLatestVitals();
      if (response?.success && response.data) {
        const lm = response.data;

        if (lm.practice_id) {
          await AsyncStorage.setItem('practiceId', String(lm.practice_id));
          setPracticeId(lm.practice_id);
        }
        if (lm.patients_table_id) {
          await AsyncStorage.setItem('patientId', String(lm.patients_table_id));
          setPatientTableId(lm.patients_table_id);
        }

        const bp = lm.blood_pressure
          ? {
            systolic: lm.blood_pressure.systolic_pressure,
            diastolic: lm.blood_pressure.diastolic_pressure,
            pulse: lm.blood_pressure.pulse,
            date: lm.blood_pressure.measure_new_date_time
              || lm.blood_pressure.measure_date_time
              || lm.blood_pressure.created_at,
          }
          : null;
        const bg = lm.blood_glucose
          ? {
            value: lm.blood_glucose.blood_glucose_value_1,
            date: lm.blood_glucose.measure_new_date_time
              || lm.blood_glucose.measure_date_time
              || lm.blood_glucose.created_at,
          }
          : null;
        const wt = lm.weight
          ? {
            value: lm.weight.weight || lm.weight.weight_value,
            fat: readOptionalVitalNumber(lm.weight.fat ?? lm.weight.body_fat),
            bmi: readOptionalVitalNumber(lm.weight.bmi),
            date: lm.weight.measure_new_date_time
              || lm.weight.measure_date_time
              || lm.weight.created_at,
          }
          : null;
        setMeasurements({
          bloodPressure: bp,
          bloodGlucose: bg,
          weight: wt,
        });
      }
    } catch (error) {
      console.warn('Could not fetch patient latest vitals:', error.message);
    }
  }, []);

  const fetchCaregiverPatientsList = useCallback(async (userObj) => {
    setIsCaregiverLoading(true);
    try {
      const pId = (await AsyncStorage.getItem('practiceId')) || userObj.practice_id;
      if (pId) {
        setPracticeId(pId);
        // Use the same program-analytics API the web frontend uses. It returns
        // summary.{ total, active, pending, locked, recent, missed, abnormal }
        // which are the correct counts for the panel hero card.
        const [listResult, analyticsResult, recentResult] = await Promise.all([
          apiService.getPatients(pId, {
            limit: 1000,
            page: 1,
            includeDashboardEnrichment: true,
            caregiverId: userObj.id,
          }).catch(() => null),
          apiService.getProgramAnalytics(pId, 'rpm').catch(() => null),
          apiService.getPatients(pId, {
            limit: 100,
            page: 1,
            program: 'rpm',
            dashboardFilter: 'recentUploads',
          }).catch(() => null),
        ]);

        // analytics.summary is { total, active, pending, locked, recent, missed, abnormal }
        const analyticsSummary = analyticsResult?.data?.summary || null;
        const analyticsCpt = analyticsResult?.data?.cpt || null;
        const analyticsPeriod = analyticsResult?.data?.billing_period || null;
        setCaregiverDashboardStats(
          analyticsSummary
            ? {
              // Map to the field names the render function expects
              total_patients: analyticsSummary.total,
              active_patients: analyticsSummary.active,
              pending_patients: analyticsSummary.pending,
              locked_patients: analyticsSummary.locked,
              recent_uploads: analyticsSummary.recent,
              missed_uploads: analyticsSummary.missed,
              abnormal_measurements: analyticsSummary.abnormal,
              billing_period_label: analyticsPeriod?.label || '',
              cpt99453: analyticsCpt?.cpt99453 ?? 0,
              cpt99445: analyticsCpt?.cpt99445 ?? 0,
              cpt99454: analyticsCpt?.cpt99454 ?? 0,
              cpt99470: analyticsCpt?.cpt99470 ?? 0,
              cpt99457: analyticsCpt?.cpt99457 ?? 0,
              cpt99458: analyticsCpt?.cpt99458 ?? 0,
            }
            : null
        );

        const analyticsTotal = analyticsSummary?.total;
        if (analyticsTotal != null) {
          setTotalPatientCount(analyticsTotal);
        }
        setRecentUploadPatients(recentResult?.data?.patients || []);
        const patientList = listResult?.data?.patients || [];
        if (patientList.length > 0) {
          setCaregiverPatients(patientList);

          // Fetch today's follow-ups
          const today = new Date().toISOString().split('T')[0];
          const followUpPromises = patientList.slice(0, 5).map((p) =>
            apiService.getFollowUps(pId, p.patient_table_id || p.id)
              .then((r) => {
                if (r?.success && Array.isArray(r.data)) {
                  return r.data
                    .filter((f) => f.date && String(f.date).startsWith(today))
                    .map((f) => ({
                      ...f,
                      patientName: formatLastFirstName(p),
                    }));
                }
                return [];
              })
              .catch(() => [])
          );
          const followUpArrays = await Promise.all(followUpPromises);
          setCaregiverFollowUps(followUpArrays.flat());
        } else {
          setCaregiverPatients(fallbackCaregiverPatients);
          if (analyticsSummary == null) {
            setTotalPatientCount(fallbackCaregiverPatients.length);
          }
          setCaregiverFollowUps([]);
        }
      } else {
        setRecentUploadPatients([]);
        setCaregiverPatients(fallbackCaregiverPatients);
        setTotalPatientCount(fallbackCaregiverPatients.length);
        setCaregiverFollowUps([]);
        setCaregiverDashboardStats(null);
      }
    } catch (error) {
      console.warn('Error fetching caregiver patients:', error);
      setRecentUploadPatients([]);
      setCaregiverPatients(fallbackCaregiverPatients);
      setTotalPatientCount(fallbackCaregiverPatients.length);
      setCaregiverFollowUps([]);
      setCaregiverDashboardStats(null);
    } finally {
      setIsCaregiverLoading(false);
    }
  }, []);

  const fetchProviderDashboardData = useCallback(async (userObj) => {
    setIsProviderLoading(true);
    try {
      const pId = (await AsyncStorage.getItem('practiceId')) || userObj.practice_id;
      if (pId) {
        setPracticeId(pId);
        // Use the same program-analytics API the web frontend uses. It returns
        // summary.{ total, active, pending, locked, recent, missed, abnormal }
        const [listResult, analyticsResult] = await Promise.all([
          apiService.getPatients(pId, {
            limit: 1000,
            page: 1,
            includeDashboardEnrichment: true,
            providerId: userObj.id,
          }).catch(() => null),
          apiService.getProgramAnalytics(pId, 'rpm').catch(() => null),
        ]);

        // analytics.summary is { total, active, pending, locked, recent, missed, abnormal }
        const analyticsSummary = analyticsResult?.data?.summary || null;
        const analyticsCpt = analyticsResult?.data?.cpt || null;
        const analyticsPeriod = analyticsResult?.data?.billing_period || null;

        if (analyticsSummary?.total != null) {
          setTotalProviderPatients(analyticsSummary.total);
        }
        setProviderDashboardStats(
          analyticsSummary
            ? {
              // Map to the field names the render function expects
              total_patients: analyticsSummary.total,
              active_patients: analyticsSummary.active,
              pending_patients: analyticsSummary.pending,
              locked_patients: analyticsSummary.locked,
              recent_uploads: analyticsSummary.recent,
              missed_uploads: analyticsSummary.missed,
              abnormal_measurements: analyticsSummary.abnormal,
              billing_period_label: analyticsPeriod?.label || '',
              cpt99453: analyticsCpt?.cpt99453 ?? 0,
              cpt99445: analyticsCpt?.cpt99445 ?? 0,
              cpt99454: analyticsCpt?.cpt99454 ?? 0,
              cpt99470: analyticsCpt?.cpt99470 ?? 0,
              cpt99457: analyticsCpt?.cpt99457 ?? 0,
              cpt99458: analyticsCpt?.cpt99458 ?? 0,
            }
            : null
        );

        const patientList = listResult?.data?.patients || [];
        if (patientList.length > 0) {
          setProviderPatients(patientList);
        } else {
          setProviderPatients(fallbackProviderPatients);
        }
      } else {
        setProviderPatients(fallbackProviderPatients);
        setProviderDashboardStats(null);
      }
    } catch (error) {
      console.warn('Error fetching provider patients:', error);
      setProviderPatients(fallbackProviderPatients);
      setProviderDashboardStats(null);
    } finally {
      setIsProviderLoading(false);
    }
  }, []);

  const fetchAssignedReviewsCount = useCallback(async (practiceIdValue = null) => {
    try {
      const res = await apiService.getAssignedAbnormalReviews(practiceIdValue);
      const list = Array.isArray(res?.data) ? res.data : [];
      setAssignedReviewsCount(list.length);
    } catch (error) {
      console.warn('Failed to fetch assigned reviews count:', error?.message || error);
      setAssignedReviewsCount(0);
    }
  }, []);

  const loadUserData = useCallback(async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const roleId = Number(user.role_id);
        const storedPracticeName = user.practice_name || user.practice?.practice_name || user.practice?.name || '';
        if (storedPracticeName) {
          setPracticeName(storedPracticeName);
        }
        if (roleId === 4) {
          setUserRole('provider');
          setPatientName(formatLastFirstName(user) || user.name || 'Reyes, Elena');
          fetchProviderDashboardData(user);
          fetchAssignedReviewsCount(user.practice_id);
        } else if (roleId === 5 || roleId === 7) {
          setUserRole('caregiver');
          setPatientName(formatLastFirstName(user) || 'Johnson, Maria');
          fetchCaregiverPatientsList(user);
          fetchAssignedReviewsCount(user.practice_id);
        } else {
          setAssignedReviewsCount(0);
          setUserRole('patient');
          setPatientName(formatLastFirstName(user) || 'Patient');
          fetchPatientVitals();
          try {
            const patientResult = await apiService.getPatientProfile();
            const patientRecord = patientResult?.data?.patient || patientResult?.data || null;
            const practiceLabel = patientRecord?.practice_name || patientRecord?.practice?.practice_name || '';
            if (practiceLabel) setPracticeName(practiceLabel);
            const recordName = formatLastFirstName(patientRecord);
            if (recordName) setPatientName(recordName);
          } catch (patientError) {
            console.warn('Could not load patient practice:', patientError?.message || patientError);
            if (user.practice_name) setPracticeName(user.practice_name);
          }
        }
      } else {
        setUserRole('patient');
        setPatientName('Cyrus Nguyen');
        fetchPatientVitals();
      }
    } catch (e) {
      console.warn('Failed to load user data on home screen:', e);
    }
  }, [fetchProviderDashboardData, fetchCaregiverPatientsList, fetchPatientVitals, fetchAssignedReviewsCount]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
      const syncNotificationBadge = async () => {
        if (!(await areNotificationsEnabled())) {
          setHasUnreadNotifications(false);
          return;
        }
        await refreshNotificationInbox();
        let apiCount = 0;
        try {
          const userStr = await AsyncStorage.getItem('user');
          const user = userStr ? JSON.parse(userStr) : null;
          if (user?.id) {
            const [chatResult, reviewResult] = await Promise.all([
              apiService.getChatUnreadCount(user.id).catch(() => null),
              apiService.getInAppNotificationCount().catch(() => null),
            ]);
            apiCount = Number(chatResult?.data?.count || 0) + Number(reviewResult?.data?.count || 0);
          }
        } catch {
          apiCount = 0;
        }
        setHasUnreadNotifications(getUnreadNotificationCount() > 0 || apiCount > 0);
      };
      syncNotificationBadge();
    }, [loadUserData])
  );

  useEffect(() => {
    const unsubscribe = subscribeNotificationInbox(() => {
      areNotificationsEnabled().then((enabled) => {
        if (!enabled) {
          setHasUnreadNotifications(false);
          return;
        }
        setHasUnreadNotifications((current) => getUnreadNotificationCount() > 0 || current);
      });
    });
    refreshNotificationInbox();
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribePush = subscribeAbnormalAssignmentReceived(() => {
      fetchAssignedReviewsCount();
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        fetchAssignedReviewsCount();
      }
    });

    return () => {
      unsubscribePush();
      appStateSub.remove();
    };
  }, [fetchAssignedReviewsCount]);

  const getFormattedDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatLastTime = (dt) => {
    if (!dt) return 'No reading yet';
    try {
      const d = new Date(dt);
      if (isNaN(d.getTime())) return `Last: ${dt}`;
      return `Last: ${d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} · ${d.getFullYear()} at ${d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return `Last: ${dt}`;
    }
  };

  const openList = (type) => navigation.navigate('DataList', {
    dataType: type,
    dashboardRole: 'patient',
    practiceId: practiceId || undefined,
    patientId: patientTableId || undefined,
  });

  const openNotifications = () => {
    const parent = navigation.getParent?.();
    if (parent) {
      parent.navigate('Notifications');
      return;
    }
    navigation.navigate('Notifications');
  };

  const openLookupPatient = () => navigation.navigate('LookupPatient');
  const openLookupRPM = () => navigation.navigate('LookupPatientRPM');
  const openLookupCCM = () => navigation.navigate('LookupPatientCCM');

  const openFollowUp = () => navigation.navigate('FollowUp');

  const openPatientHub = (patient, dashboardRole) => {
    const resolvedPatientId = patient.patient_table_id || patient.id;
    navigation.navigate('PatientHub', {
      patientId: resolvedPatientId,
      practiceId: practiceId || patient.practice_id,
      patientName: formatLastFirstName(patient),
      dashboardRole,
    });
  };

  // --- Sub-renderers ---

  // 1. Patient Dashboard
  const renderPatientDashboard = () => {
    const bpVal = measurements.bloodPressure
      ? `${Math.round(parseFloat(measurements.bloodPressure.systolic))}/${Math.round(
        parseFloat(measurements.bloodPressure.diastolic)
      )}`
      : '--';
    const bgVal = measurements.bloodGlucose?.value != null
      ? String(Math.round(parseFloat(measurements.bloodGlucose.value)))
      : '--';
    const wtRaw = measurements.weight?.value;
    const wtLbs = wtRaw != null ? normalizeWeightToLbs(wtRaw, measurements.weight?.unit || 'kg') : null;
    const wtVal = wtLbs != null ? parseFloat(wtLbs.toFixed(1)) : '--';

    const t = DEFAULT_VITAL_TARGETS;
    const bpParts = bpVal.split('/');
    const hasSplitBp = bpParts.length === 2 && bpVal !== '--';
    const sysColor = hasSplitBp ? getVitalColor(bpParts[0], t.systolicMin, t.systolicMax) : null;
    const diaColor = hasSplitBp ? getVitalColor(bpParts[1], t.diastolicMin, t.diastolicMax) : null;
    const pulseRaw = measurements.bloodPressure?.pulse;
    const pulseNum = Number(pulseRaw);
    const pulseVal = Number.isFinite(pulseNum) && pulseNum > 0 ? Math.round(pulseNum) : null;
    const pulseStatus = pulseVal != null ? checkPulseValue(pulseVal, t) : null;
    const pulseColor = pulseVal != null ? getVitalColor(pulseVal, t.pulseMin, t.pulseMax) : null;
    const bgColor = getVitalColor(bgVal, t.glucoseMin, t.glucoseMax);
    const wtColor = getVitalColor(wtVal, t.weightMin, t.weightMax);
    const wtFat = readOptionalVitalNumber(measurements.weight?.fat);
    const wtBmi = readOptionalVitalNumber(measurements.weight?.bmi);
    const wtFatColor = wtFat != null ? getVitalStatusColor(checkFatValue(wtFat, t)) : null;
    const wtBmiColor = wtBmi != null
      ? getVitalStatusColor(getBmiCategoryStatus(wtBmi, {
        bmiNormal: t.bmiNormal ?? 18.5,
        bmiOverweight: t.bmiOverweight ?? 25,
        bmiObese: t.bmiObese ?? 30,
      }))
      : null;
    const formatReadingTime = (dt) => {
      if (!dt) return 'NO READING YET';
      try {
        const d = new Date(dt);
        if (isNaN(d.getTime())) return String(dt).toUpperCase();
        const monthStr = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const dayStr = d.getDate();
        const timeStr = d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        return `${monthStr} ${dayStr}  ·  ${timeStr}`;
      } catch {
        return String(dt).toUpperCase();
      }
    };

    const bpTime = formatReadingTime(measurements.bloodPressure?.date);
    const bgTime = formatReadingTime(measurements.bloodGlucose?.date);
    const wtTime = formatReadingTime(measurements.weight?.date);

    return (
      <View style={{ flex: 1, backgroundColor: EV.surface }}>
        <LinearGradient
          colors={SCREEN_BG_COLORS}
          style={st.fullGradient}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <View style={st.headerSafeWrap}>
              <AppHeader
                color={EV.navy}
                onNotifications={openNotifications}
                showBadge={hasUnreadNotifications}
              />
            </View>
            <ScrollView
              contentContainerStyle={st.scrollContainer}
              showsVerticalScrollIndicator={false}
              bounces={true}
              overScrollMode="never"
              keyboardShouldPersistTaps="handled"
            >
              <RoleIntro

                title={patientName || 'Dashboard'}
                practiceName={practiceName}
                color={EV.navy}
              />

              <View style={st.lrHeaderWrap}>
                <Text style={st.lrHeaderTitle}>Latest Readings</Text>
                {/* <Text style={st.lrHeaderSub}>From your connected meters</Text> */}
              </View>

              <View style={st.lrCardContainer}>
                <TouchableOpacity style={st.lrRow} onPress={() => openList('bp')} activeOpacity={0.7}>
                  <View style={st.lrMeta}>
                    <Text style={st.lrName}>Blood Pressure</Text>
                    <Text style={st.lrTime}>{bpTime}</Text>
                  </View>
                  <View style={st.lrValWrap}>
                    {hasSplitBp ? (
                      <View style={st.lrBpRow}>
                        <Text style={[st.lrValText, { color: sysColor }]}>{bpParts[0].trim()}</Text>
                        <Text style={st.lrSlash}>/</Text>
                        <Text style={[st.lrValText, { color: diaColor }]}>{bpParts[1].trim()}</Text>
                      </View>
                    ) : (
                      <Text style={st.lrValText}>{bpVal}</Text>
                    )}
                    <View style={st.lrUnitRow}>
                      <Text style={[st.lrUnitText, st.lrUnitTextInRow]}>mmHg</Text>
                      {pulseVal != null ? (
                        <>
                          <Text style={st.lrUnitDot}>·</Text>
                          <Text style={[st.lrPulseValue, { color: pulseColor }]}>{pulseVal}</Text>
                          <PulseIcon
                            isAbnormal={pulseStatus === 'high' || pulseStatus === 'low'}
                            size={scaleFont(11)}
                          />
                          <Text style={st.lrPulseUnit}>bpm</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>

                <View style={st.lrRowDivider} />

                <TouchableOpacity style={st.lrRow} onPress={() => openList('bg')} activeOpacity={0.7}>
                  <View style={st.lrMeta}>
                    <Text style={st.lrName}>Blood Glucose</Text>
                    <Text style={st.lrTime}>{bgTime}</Text>
                  </View>
                  <View style={st.lrValWrap}>
                    <Text style={[st.lrValText, bgVal !== '--' && { color: bgColor }]}>{bgVal}</Text>
                    <Text style={st.lrUnitText}>mg/dL</Text>
                  </View>
                </TouchableOpacity>

                <View style={st.lrRowDivider} />

                <TouchableOpacity style={st.lrRow} onPress={() => openList('weight')} activeOpacity={0.7}>
                  <View style={st.lrMeta}>
                    <Text style={st.lrName}>Weight</Text>
                    <Text style={st.lrTime}>{wtTime}</Text>
                  </View>
                  <View style={st.lrValWrap}>
                    <Text style={[st.lrValText, wtVal !== '--' && { color: wtColor }]}>{wtVal}</Text>
                    <Text style={st.lrUnitText}>lb</Text>
                    {wtFat != null ? (
                      <Text style={[st.lrSubMetric, { color: wtFatColor }]}>Fat {wtFat.toFixed(1)}</Text>
                    ) : null}
                    {wtBmi != null ? (
                      <Text style={[st.lrSubMetric, { color: wtBmiColor }]}>BMI {wtBmi.toFixed(1)}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </View>

              <SectionTitle title="Trends" />
              <PatientTrendSlidesCarousel />

              <SectionTitle title="Quick Access" />

              <View style={st.quickGrid}>
                <TouchableOpacity style={st.quickBtn} onPress={() => openList('bloodPressure')}>
                  <LinearGradient colors={QUICK_ACCESS_ICON_COLORS} style={st.qbIcon}>
                    <MaterialIcons name="favorite" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={st.qbLabel}>Blood Pressure</Text>
                </TouchableOpacity>

                <TouchableOpacity style={st.quickBtn} onPress={() => openList('bloodGlucose')}>
                  <LinearGradient colors={QUICK_ACCESS_ICON_COLORS} style={st.qbIcon}>
                    <MaterialIcons name="opacity" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={st.qbLabel}>Blood Glucose</Text>
                </TouchableOpacity>

                <TouchableOpacity style={st.quickBtn} onPress={() => openList('weight')}>
                  <LinearGradient colors={QUICK_ACCESS_ICON_COLORS} style={st.qbIcon}>
                    <MaterialIcons name="monitor-weight" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={st.qbLabel}>Weight</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: scaleHeight(20) }} />
            </ScrollView>
            <PremiumBottomNav active="home" navigation={navigation} role="patient" />
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  };

  // 2. Caregiver Dashboard View
  const renderCaregiverDashboard = () => {
    const dynamicPatients = [...caregiverPatients].sort((a, b) => {
      const timeA = new Date(a.last_vital_upload_at || a.latest_measurement_time || a.updated_at || 0).getTime();
      const timeB = new Date(b.last_vital_upload_at || b.latest_measurement_time || b.updated_at || 0).getTime();
      return timeB - timeA;
    });

    const displayList = dynamicPatients.length > 0 ? dynamicPatients : fallbackCaregiverPatients;
    const stats = caregiverDashboardStats || {};
    const totalPanel = toSafeNumber(
      stats.total_patients,
      totalPatientCount != null ? totalPatientCount : caregiverPatients.length || displayList.length
    );
    const activeCount = toSafeNumber(
      stats.active_patients,
      displayList.filter((p) => getNormalizedStatus(p) === 2).length
    );
    const pendingCount = toSafeNumber(
      stats.pending_patients,
      displayList.filter((p) => getNormalizedStatus(p) === 3).length
    );
    const lockedCount = toSafeNumber(
      stats.locked_patients,
      displayList.filter((p) => getNormalizedStatus(p) === 4).length
    );
    const criticalPatients = displayList.filter(
      (p) => getNormalizedStatus(p) === 4 || p.status === 'Critical' || p.has_abnormal_measurement
    );
    const recentUploads = buildRecentUploadCards(recentUploadPatients);
    const missedUploadsCount = toSafeNumber(stats.missed_uploads, Math.max(0, totalPanel - activeCount));
    const abnormalCount = toSafeNumber(stats.abnormal_measurements, criticalPatients.length);
    const recentUploadsCount = toSafeNumber(stats.recent_uploads, recentUploads.length);
    // Build CPT rows matching the web's 6 RPM codes with eligible + ineligible counts.
    // The web uses: activeCount as the base for ineligible = active - eligible.
    const buildCptRow = (code, rawCount, variant) => {
      const eligible = toSafeNumber(rawCount, 0);
      const ineligible = Math.max(0, activeCount - eligible);
      return { code, eligible, ineligible, count: eligible, percent: getCptPercent(rawCount, totalPanel), variant };
    };
    const cptRows = [
      buildCptRow('99453', stats.cpt99453, 'navy'),
      buildCptRow('99445', stats.cpt99445, undefined),
      buildCptRow('99454', stats.cpt99454, undefined),
      buildCptRow('99470', stats.cpt99470, 'navy'),
      buildCptRow('99457', stats.cpt99457, 'warn'),
      buildCptRow('99458', stats.cpt99458, undefined),
    ];

    return (
      <View style={{ flex: 1, backgroundColor: EV.surface }}>
        <LinearGradient
          colors={SCREEN_BG_COLORS}
          style={st.fullGradient}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <View style={st.headerSafeWrap}>
              <ThreeDotMenu
                visible={showMenu}
                onClose={() => setShowMenu(false)}
                onLookupPatient={openLookupPatient}
                onFollowUp={openFollowUp}
              />
              <AppHeader
                color={EV.navyMid}
                onNotifications={openNotifications}
                showBadge={hasUnreadNotifications}
                onMenuPress={() => setShowMenu(true)}
              />
            </View>
            <ScrollView
              contentContainerStyle={st.scrollContainer}
              showsVerticalScrollIndicator={false}
              bounces={true}
              overScrollMode="never"
              keyboardShouldPersistTaps="always"
            >
              <RoleIntro

                title={patientName || 'Dashboard'}
                practiceName={practiceName}
                subtitle="Your assigned patient panel is prioritized by uploads, alerts, and billing readiness."
                color={EV.navyMid}
              />

              <CapsulePanelSummary
                total={totalPanel}
                active={activeCount}
                pending={pendingCount}
                locked={lockedCount}
                navigation={navigation}
              />

              <DashboardCountsSection
                missedUploadsCount={missedUploadsCount}
                abnormalCount={abnormalCount}
                recentUploadsCount={recentUploadsCount}
                assignedReviewsCount={assignedReviewsCount}
                navigation={navigation}
              />

              <SectionTitle title="Recent Uploads" subtitle="Latest patient syncs" actionLabel="Patients" actionColor={EV.navyMid} />

              {isCaregiverLoading && recentUploadPatients.length === 0 ? (
                <ActivityIndicator size="small" color={EV.navyMid} style={{ marginVertical: 20 }} />
              ) : recentUploads.length === 0 ? (
                <View style={st.emptyAlertCard}><Text style={st.emptyAlertText}>No recent uploads.</Text></View>
              ) : (
                <View style={st.uploadList}>
                  {recentUploads.map(({ patient, readings }) => {
                    const patientKey = String(patient.patient_table_id || patient.id);
                    const page = Math.min(recentUploadIndex[patientKey] || 0, Math.max(readings.length - 1, 0));
                    return (
                      <RecentUploadCard
                        key={patientKey}
                        patient={patient}
                        readings={readings}
                        page={page}
                        onChangePage={(nextPage) => {
                          setRecentUploadIndex((prev) => ({ ...prev, [patientKey]: nextPage }));
                        }}
                        onOpen={() => openPatientHub(patient, 'caregiver')}
                      />
                    );
                  })}
                </View>
              )}

              {/*
              <SectionTitle title="Critical Alerts" actionLabel="See all" actionColor={EV.muted} onPress={() => navigation.navigate('Patients')} />

              {criticalPatients.length === 0 ? (
                <View style={st.emptyAlertCard}><Text style={st.emptyAlertText}>No critical alerts for now.</Text></View>
              ) : (
                <View style={st.criticalCard}>
                  {criticalPatients.slice(0, 4).map((p) => {
                    const isCritical = p.status === 'Critical' || p.status === 'Locked';
                    const reading = p.data_summary ? `Blood pressure ${p.data_summary} with repeat high reading` : 'Measurement outside configured target range';
                    return (
                      <CriticalAlertRow
                        key={String(p.id)}
                        name={formatLastFirstName(p)}
                        detail={reading}
                        severity={isCritical ? 'Critical' : 'High'}
                        critical={isCritical}
                        onPress={() => openPatientHub(p, 'caregiver')}
                      />
                    );
                  })}
                </View>
              )}
              */}

              <SectionTitle
                title="CPT Eligibility"
                subtitle={stats?.billing_period_label ? `Billing cycle (${stats.billing_period_label})` : 'Billing cycle'}
                subtitleOnRight
              />
              <CptEligibilityCard
                rows={cptRows}
                onCptPress={(code) => navigation.navigate('Patients', { dashboardFilter: `cpt${code}`, filterTitle: `CPT ${code}` })}
              />

              <View style={{ height: scaleHeight(20) }} />
            </ScrollView>
            <PremiumBottomNav active="queue" navigation={navigation} role="caregiver" />
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  };

  // 3. Provider Dashboard View
  const renderProviderDashboard = () => {
    const dynamicPatients = [...providerPatients].sort((a, b) => {
      const timeA = new Date(a.last_vital_upload_at || a.latest_measurement_time || a.updated_at || 0).getTime();
      const timeB = new Date(b.last_vital_upload_at || b.latest_measurement_time || b.updated_at || 0).getTime();
      return timeB - timeA;
    });

    const displayList = dynamicPatients.length > 0 ? dynamicPatients : fallbackProviderPatients;
    const stats = providerDashboardStats || {};
    const totalPanel = toSafeNumber(
      stats.total_patients,
      totalProviderPatients != null ? totalProviderPatients : providerPatients.length || displayList.length
    );
    const activeCount = toSafeNumber(
      stats.active_patients,
      displayList.filter((p) => getNormalizedStatus(p) === 2).length
    );
    const pendingCount = toSafeNumber(
      stats.pending_patients,
      displayList.filter((p) => getNormalizedStatus(p) === 3).length
    );
    const lockedCount = toSafeNumber(
      stats.locked_patients,
      displayList.filter((p) => getNormalizedStatus(p) === 4).length
    );
    const criticalPatients = displayList.filter(
      (p) => getNormalizedStatus(p) === 4 || p.status === 'Critical' || p.has_abnormal_measurement
    );
    const missedUploadsCount = toSafeNumber(stats.missed_uploads, Math.max(14, totalPanel - activeCount));
    const abnormalCount = toSafeNumber(stats.abnormal_measurements, criticalPatients.length || 9);
    const recentUploadsCount = toSafeNumber(stats.recent_uploads, 0);
    // Build CPT rows matching the web's 6 RPM codes with eligible + ineligible counts.
    const buildCptRow = (code, rawCount, variant) => {
      const eligible = toSafeNumber(rawCount, 0);
      const ineligible = Math.max(0, activeCount - eligible);
      return { code, eligible, ineligible, count: eligible, percent: getCptPercent(rawCount, totalPanel), variant };
    };
    const cptRows = [
      buildCptRow('99453', stats.cpt99453, 'navy'),
      buildCptRow('99445', stats.cpt99445, undefined),
      buildCptRow('99454', stats.cpt99454, undefined),
      buildCptRow('99470', stats.cpt99470, 'navy'),
      buildCptRow('99457', stats.cpt99457, 'warn'),
      buildCptRow('99458', stats.cpt99458, undefined),
    ];

    return (
      <View style={{ flex: 1, backgroundColor: EV.surface }}>
        <LinearGradient
          colors={SCREEN_BG_COLORS}
          style={st.fullGradient}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <View style={st.headerSafeWrap}>
              <ThreeDotMenu
                visible={showMenu}
                onClose={() => setShowMenu(false)}
                onLookupPatient={openLookupPatient}
                onFollowUp={openFollowUp}
              />
              <AppHeader
                color={EV.navy}
                onNotifications={openNotifications}
                showBadge={hasUnreadNotifications}
                onMenuPress={() => setShowMenu(true)}
              />
            </View>
            <ScrollView
              contentContainerStyle={st.scrollContainer}
              showsVerticalScrollIndicator={false}
              bounces={true}
              overScrollMode="never"
              keyboardShouldPersistTaps="always"
            >
              <RoleIntro

                title={patientName || 'Dashboard'}
                practiceName={practiceName}
                // subtitle="Your patient panel is organized by review urgency, uploads, alerts, and billing readiness."
                color={EV.blue}
              />

              <CapsulePanelSummary
                total={totalPanel}
                active={activeCount}
                pending={pendingCount}
                locked={lockedCount}
                navigation={navigation}
              />

              <DashboardCountsSection
                missedUploadsCount={missedUploadsCount}
                abnormalCount={abnormalCount}
                recentUploadsCount={recentUploadsCount}
                assignedReviewsCount={assignedReviewsCount}
                navigation={navigation}
              />

              <SectionTitle title="Critical Alerts" actionLabel="See all" actionColor={EV.muted} onPress={() => navigation.navigate('Patients')} />

              {criticalPatients.length === 0 ? (
                <View style={st.emptyAlertCard}><Text style={st.emptyAlertText}>No critical alerts for now.</Text></View>
              ) : (
                <View style={st.criticalCard}>
                  {criticalPatients.slice(0, 4).map((p) => (
                    <CriticalAlertRow
                      key={String(p.id)}
                      name={formatLastFirstName(p)}
                      detail={p.data_summary ? `Blood pressure ${p.data_summary} requires provider review` : 'Reading outside configured clinical threshold'}
                      severity={p.status === 'Critical' || p.status === 'Locked' ? 'Critical' : 'High'}
                      critical={p.status === 'Critical' || p.status === 'Locked'}
                      onPress={() => openPatientHub(p, 'provider')}
                    />
                  ))}
                </View>
              )}

              <SectionTitle
                title="CPT Eligibility"
                subtitle={stats?.billing_period_label ? `Billing cycle (${stats.billing_period_label})` : 'Billing cycle'}
                subtitleOnRight
              />
              <CptEligibilityCard
                rows={cptRows}
                theme="provider"
                onCptPress={(code) => navigation.navigate('Patients', { dashboardFilter: `cpt${code}`, filterTitle: `CPT ${code}` })}
              />

              <View style={{ height: scaleHeight(20) }} />
            </ScrollView>
            <PremiumBottomNav active="review" navigation={navigation} role="provider" />
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  };

  if (userRole === 'provider') {
    return (
      <>
        <StatusBar barStyle="dark-content" translucent={true} backgroundColor="transparent" />
        {renderProviderDashboard()}
      </>
    );
  } else if (userRole === 'caregiver') {
    return (
      <>
        <StatusBar barStyle="dark-content" translucent={true} backgroundColor="transparent" />
        {renderCaregiverDashboard()}
      </>
    );
  } else {
    return (
      <>
        <StatusBar barStyle="dark-content" translucent={true} backgroundColor="transparent" />
        {renderPatientDashboard()}
      </>
    );
  }
}

const st = StyleSheet.create({
  fullGradient: {
    flex: 1,
  },
  headerSafeWrap: {
    zIndex: 30,
    elevation: 30,
    paddingHorizontal: Math.max(scaleWidth(16), 16),
    backgroundColor: 'transparent',
  },
  scrollContainer: {
    paddingBottom: PREMIUM_BOTTOM_NAV_CLEARANCE,
    paddingHorizontal: Math.max(scaleWidth(16), 16),
    flexGrow: 1,
  },
  evTopbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: scaleHeight(4),
    paddingBottom: scaleHeight(14),
    zIndex: 30,
  },
  topbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
  },
  notifBadge: {
    position: 'absolute',
    top: scaleHeight(9),
    right: scaleWidth(9),
    width: scaleWidth(7),
    height: scaleWidth(7),
    borderRadius: scaleWidth(4),
    backgroundColor: EV.criticalStrong,
  },
  evLogo: {
    width: Math.min(scaleWidth(152), 172),
    height: scaleHeight(42),
  },
  evIconButton: {
    width: Math.max(scaleWidth(42), 42),
    height: Math.max(scaleWidth(42), 42),
    borderRadius: scaleWidth(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EV.surface,
    borderWidth: 1,
    borderColor: EV.line,
    shadowColor: EV.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  evIntro: {
    paddingBottom: scaleHeight(12),
  },
  evEyebrow: {
    fontSize: scaleFont(11),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  evTitle: {
    marginTop: scaleHeight(4),
    color: EV.navy,
    fontSize: scaleFont(26),
    lineHeight: scaleHeight(31),
    fontWeight: '800',
  },
  evSubtitle: {
    marginTop: scaleHeight(6),
    color: EV.muted,
    fontSize: scaleFont(13),
    lineHeight: scaleHeight(20),
    fontWeight: '600',
  },
  practiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaleHeight(4),
    gap: scaleWidth(4),
  },
  practiceName: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    opacity: 0.75,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  menuDropdown: {
    position: 'absolute',
    top: scaleHeight(64),
    right: Math.max(scaleWidth(16), 16),
    backgroundColor: EV.surface,
    borderRadius: scaleWidth(14),
    minWidth: scaleWidth(180),
    borderWidth: 1,
    borderColor: EV.line,
    shadowColor: EV.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(14),
    paddingHorizontal: scaleWidth(16),
  },
  menuItemIcon: {
    marginRight: scaleWidth(10),
  },
  menuItemText: {
    fontSize: scaleFont(14),
    fontWeight: '700',
    color: EV.navy,
  },
  menuDivider: {
    height: 1,
    backgroundColor: EV.line,
    marginHorizontal: scaleWidth(12),
  },
  evSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: scaleWidth(12),
    marginTop: scaleHeight(20),
    marginBottom: scaleHeight(10),
  },
  evSectionTitle: {
    color: EV.navy,
    fontSize: scaleFont(16),
    fontWeight: '800',
  },
  evSectionSubtitle: {
    color: EV.muted,
    fontSize: scaleFont(11),
    fontWeight: '700',
    marginTop: scaleHeight(2),
  },
  evSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  evSectionTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  evSectionSubtitleRight: {
    marginTop: 0,
    fontSize: scaleFont(12),
    fontWeight: '800',
    color: EV.muted,
  },
  evSectionAction: {
    fontSize: scaleFont(12),
    fontWeight: '800',
  },
  capsuleCarouselWrap: {
    marginVertical: scaleHeight(12),
    width: '100%',
    zIndex: 1,
  },
  capsuleCarouselClip: {
    width: '100%',
    overflow: 'hidden',
  },
  capsuleCarouselTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: scaleHeight(2),
  },
  capsuleCarouselSet: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  capsuleCarouselContent: {
    paddingHorizontal: Math.max(scaleWidth(16), 16),
    alignItems: 'center',
    flexDirection: 'row',
  },
  capsulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(18),
    borderRadius: scaleWidth(24),
    borderWidth: 1.5,
    marginRight: scaleWidth(10),
  },
  capsuleDot: {
    width: scaleWidth(8),
    height: scaleWidth(8),
    borderRadius: scaleWidth(4),
    marginRight: scaleWidth(7),
  },
  capsuleLabel: {
    fontSize: scaleFont(14),
    fontWeight: '700',
    marginRight: scaleWidth(6),
  },
  capsuleBadge: {
    paddingHorizontal: scaleWidth(8),
    paddingVertical: scaleHeight(2),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleCountText: {
    fontSize: scaleFont(12),
    fontWeight: '800',
  },
  panelHeroOuter: {
    width: '100%',
    marginTop: scaleHeight(16),
    marginBottom: scaleHeight(4),
    borderRadius: scaleWidth(30),
    overflow: 'hidden',
    shadowColor: EV.navy,
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.28,
    shadowRadius: 52,
    elevation: 8,
  },
  panelHeroGradient: {
    width: '100%',
  },
  panelHeroInner: {
    padding: scaleWidth(22),
  },
  panelHeroHead: {
    width: '100%',
  },
  panelHeroTitle: {
    color: '#fff',
    fontSize: scaleFont(19),
    lineHeight: scaleFont(24),
    fontWeight: '800',
  },
  panelHeroSub: {
    marginTop: scaleHeight(9),
    color: 'rgba(255,255,255,0.76)',
    fontSize: scaleFont(12),
    lineHeight: scaleFont(17),
    fontWeight: '500',
  },
  panelMetricGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginTop: scaleHeight(18),
  },
  panelMetric: {
    minHeight: scaleHeight(72),
    borderRadius: scaleWidth(18),
    paddingVertical: scaleWidth(10),
    paddingHorizontal: scaleWidth(8),
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  panelMetricTotal: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  panelMetricValue: {
    color: '#fff',
    fontSize: scaleFont(19),
    fontWeight: '800',
  },
  panelMetricLabel: {
    marginTop: scaleHeight(5),
    color: 'rgba(255,255,255,0.72)',
    fontSize: scaleFont(10),
    lineHeight: scaleFont(13),
    fontWeight: '700',
  },
  uploadList: {
    backgroundColor: EV.surface,
    borderRadius: scaleWidth(24),
    paddingHorizontal: scaleWidth(16),
    borderWidth: 1,
    borderColor: EV.line,
    shadowColor: EV.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  uploadPager: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(7,27,52,0.07)',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadSideArrow: {
    width: scaleWidth(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  uploadCardPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: scaleHeight(12),
    gap: scaleWidth(10),
    minWidth: 0,
  },
  uploadMain: {
    flex: 1,
    minWidth: 0,
  },
  uploadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(10),
  },
  uploadAvatar: {
    width: scaleWidth(42),
    height: scaleWidth(42),
    borderRadius: scaleWidth(15),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EV.bluePale,
  },
  uploadAvatarText: {
    color: EV.blueDeep,
    fontSize: scaleFont(13),
    fontWeight: '800',
  },
  uploadText: {
    flex: 1,
    minWidth: 0,
  },
  uploadNameRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scaleWidth(8),
  },
  uploadNameGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(6),
  },
  uploadName: {
    flexShrink: 1,
    color: EV.navy,
    fontSize: scaleFont(15),
    lineHeight: scaleFont(18),
    fontWeight: '800',
    includeFontPadding: false,
  },
  uploadExtraRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scaleWidth(8),
    marginTop: scaleHeight(6),
  },
  uploadAge: {
    color: EV.muted,
    fontSize: scaleFont(11),
    lineHeight: scaleFont(14),
    fontWeight: '600',
    includeFontPadding: false,
  },
  uploadAgeBelow: {
    marginTop: scaleHeight(1),
  },
  uploadMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(6),
    marginTop: scaleHeight(4),
    flexShrink: 1,
  },
  uploadVitalPill: {
    paddingHorizontal: scaleWidth(6),
    paddingVertical: scaleWidth(2),
    borderRadius: scaleWidth(6),
    backgroundColor: 'rgba(7,27,52,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(7,27,52,0.12)',
  },
  uploadVitalPillText: {
    fontSize: scaleFont(10),
    fontWeight: '800',
    color: '#0b1f3f',
  },
  uploadVitals: {
    flexDirection: 'row',
    gap: scaleWidth(8),
  },
  uploadVital: {
    flex: 1,
    backgroundColor: 'rgba(7,27,52,0.05)',
    borderRadius: scaleWidth(14),
    paddingVertical: scaleWidth(8),
    paddingHorizontal: scaleWidth(4),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scaleWidth(50),
  },
  uploadVitalLabel: {
    fontSize: scaleFont(10),
    color: '#687382',
    marginBottom: scaleWidth(3),
    fontWeight: '800',
  },
  uploadValueActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: scaleWidth(6),
  },
  uploadArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadVitalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    maxWidth: '100%',
  },
  uploadVitalValue: {
    fontSize: scaleFont(12),
    fontWeight: '800',
    lineHeight: scaleFont(14),
    flexShrink: 1,
  },
  uploadVitalSlash: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: '#64748b',
    marginHorizontal: 1,
  },
  uploadVitalUnit: {
    marginLeft: scaleWidth(3),
    color: EV.muted,
    fontSize: scaleFont(10),
    fontWeight: '700',
  },
  uploadPulseWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: scaleWidth(4),
  },
  uploadPulse: {
    fontSize: scaleFont(10),
    fontWeight: '700',
    lineHeight: scaleFont(12),
  },
  uploadDetail: {
    marginTop: scaleHeight(3),
    color: EV.muted,
    fontSize: scaleFont(11),
    lineHeight: scaleHeight(15),
    fontWeight: '600',
  },
  uploadPill: {
    borderRadius: 999,
    paddingHorizontal: scaleWidth(9),
    paddingVertical: scaleHeight(5),
    backgroundColor: 'rgba(47,95,143,0.1)',
  },
  uploadPillText: {
    color: EV.blueDeep,
    fontSize: scaleFont(9),
    fontWeight: '800',
  },
  criticalCard: {
    borderRadius: scaleWidth(24),
    paddingHorizontal: scaleWidth(16),
    backgroundColor: EV.surface,
    shadowColor: EV.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  criticalRow: {
    minHeight: scaleHeight(68),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(11),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(198,40,40,0.1)',
    paddingVertical: scaleHeight(10),
  },
  criticalIcon: {
    width: scaleWidth(36),
    height: scaleWidth(36),
    borderRadius: scaleWidth(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(196, 22, 46, 0.1)',
  },
  criticalText: {
    flex: 1,
    minWidth: 0,
  },
  criticalName: {
    color: EV.navy,
    fontSize: scaleFont(13),
    fontWeight: '800',
  },
  criticalDetail: {
    marginTop: scaleHeight(3),
    color: EV.muted,
    fontSize: scaleFont(11),
    lineHeight: scaleHeight(15),
    fontWeight: '600',
  },
  severityBadge: {
    minWidth: scaleWidth(58),
    borderRadius: 999,
    paddingHorizontal: scaleWidth(9),
    paddingVertical: scaleHeight(6),
    alignItems: 'center',
  },
  severityCritical: {
    backgroundColor: EV.criticalStrong,
  },
  severityHigh: {
    backgroundColor: EV.critical,
  },
  severityText: {
    color: '#fff',
    fontSize: scaleFont(10),
    fontWeight: '800',
  },
  emptyAlertCard: {
    borderRadius: scaleWidth(22),
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(16),
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    alignItems: 'center',
  },
  emptyAlertText: {
    color: EV.muted,
    fontSize: scaleFont(12),
    fontWeight: '800',
  },
  dbCountsWrap: {
    marginTop: scaleHeight(16),
    marginBottom: scaleHeight(12),
    width: '100%',
    zIndex: 2,
    elevation: 4,
  },
  dbCountsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleHeight(10),
  },
  dbCountsHeaderTitle: {
    fontSize: scaleFont(18),
    fontWeight: '800',
    color: EV.navy,
  },
  dbCountsHeaderSub: {
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: EV.mutedLight,
  },
  dbCountsCardContainer: {
    backgroundColor: EV.surface,
    borderRadius: scaleWidth(20),
    borderWidth: 1,
    borderColor: EV.border,
    paddingHorizontal: scaleWidth(18),
    overflow: 'hidden',
  },
  dbCountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(16),
    minHeight: scaleHeight(52),
  },
  dbCountsRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: EV.border,
  },
  dbCountsRowTitle: {
    flex: 1,
    fontSize: scaleFont(15),
    fontWeight: '700',
    color: EV.navy,
  },
  dbCountsRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
  },
  dbCountsValue: {
    fontSize: scaleFont(18),
    fontWeight: '800',
  },
  dbCountsHelperTag: {
    alignSelf: 'flex-start',
    marginTop: scaleHeight(10),
    backgroundColor: EV.bluePale,
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(6),
    borderRadius: scaleWidth(14),
  },
  dbCountsHelperText: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: EV.blue,
  },
  lrHeaderWrap: {
    marginTop: scaleHeight(12),
    marginBottom: scaleHeight(10),
    width: '100%',
  },
  lrHeaderTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: EV.navy,
  },
  lrHeaderSub: {
    fontSize: scaleFont(13),
    fontWeight: '500',
    color: EV.mutedLight,
    marginTop: scaleHeight(2),
  },
  lrCardContainer: {
    backgroundColor: EV.surface,
    borderRadius: scaleWidth(20),
    borderWidth: 1,
    borderColor: EV.border,
    paddingHorizontal: scaleWidth(20),
    shadowColor: EV.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: scaleHeight(16),
  },
  lrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scaleHeight(16),
  },
  lrRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: EV.border,
    borderStyle: 'solid',
  },
  lrMeta: {
    flex: 1,
    marginRight: scaleWidth(12),
  },
  lrName: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: EV.navy,
  },
  lrTime: {
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: EV.mutedLight,
    marginTop: scaleHeight(4),
    letterSpacing: 0.5,
  },
  lrValWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  lrValText: {
    fontSize: scaleFont(22),
    fontWeight: '800',
    color: EV.navy,
  },
  lrBpRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  lrSlash: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: '#64748b',
    marginHorizontal: 2,
  },
  lrUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaleHeight(2),
    gap: scaleWidth(4),
  },
  lrUnitText: {
    fontSize: scaleFont(11),
    fontWeight: '600',
    color: EV.mutedLight,
    marginTop: scaleHeight(2),
  },
  lrSubMetric: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    marginTop: scaleHeight(2),
    textAlign: 'right',
  },
  lrUnitTextInRow: {
    marginTop: 0,
  },
  lrUnitDot: {
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: EV.mutedLight,
  },
  lrPulseValue: {
    fontSize: scaleFont(13),
    fontWeight: '800',
  },
  lrPulseUnit: {
    fontSize: scaleFont(11),
    fontWeight: '600',
    color: EV.mutedLight,
  },
  trendCarouselWrap: {
    marginVertical: scaleHeight(10),
    width: '100%',
    overflow: 'hidden',
  },
  trendCarouselContent: {
    alignItems: 'stretch',
  },
  trendSlidePage: {
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  trendSlideCard: {
    backgroundColor: EV.surface,
    borderRadius: scaleWidth(20),
    borderWidth: 1,
    borderColor: EV.border,
    padding: scaleWidth(16),
    shadowColor: EV.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  trendSlideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleHeight(8),
  },
  trendSlideTitle: {
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: EV.navy,
  },
  trendSlideLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
  },
  trendDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaleHeight(10),
    gap: scaleWidth(8),
  },
  trendDotItem: {
    width: scaleWidth(8),
    height: scaleWidth(8),
    borderRadius: scaleWidth(4),
    backgroundColor: EV.border,
  },
  trendDotItemActive: {
    width: scaleWidth(22),
    backgroundColor: EV.navy,
  },
  miniCountTitle: {
    color: EV.muted,
    fontSize: scaleFont(12),
    fontWeight: '800',
    marginBottom: scaleHeight(4),
  },
  miniCountValue: {
    fontSize: scaleFont(26),
    fontWeight: '900',
    marginVertical: scaleHeight(4),
  },
  miniCountViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: scaleHeight(6),
    paddingVertical: scaleHeight(2),
    gap: scaleWidth(2),
  },
  miniCountViewText: {
    color: EV.blueDeep,
    fontSize: scaleFont(12),
    fontWeight: '800',
  },
  cptCard: {
    borderRadius: scaleWidth(24),
    padding: scaleWidth(16),
    backgroundColor: EV.surface,
    borderWidth: 1,
    borderColor: EV.line,
    shadowColor: EV.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  cptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleHeight(14),
  },
  cptHeaderTitle: {
    color: EV.navy,
    fontSize: scaleFont(14),
    fontWeight: '800',
    flex: 1,
    marginRight: scaleWidth(8),
  },
  cptHeaderLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(4),
  },
  cptLegendDot: {
    width: scaleWidth(8),
    height: scaleWidth(8),
    borderRadius: scaleWidth(4),
    backgroundColor: EV.blueDeep,
  },
  cptLegendLabel: {
    fontSize: scaleFont(11),
    fontWeight: '700',
  },
  cptHeaderMeta: {
    color: EV.muted,
    fontSize: scaleFont(11),
    fontWeight: '800',
  },
  cptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(14),
    gap: scaleWidth(10),
  },
  cptRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: EV.border,
  },
  cptMeta: {
    flex: 1,
    flexDirection: 'column',
    gap: scaleHeight(4),
    minWidth: 0,
  },
  cptCodePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: scaleWidth(8),
    paddingVertical: scaleHeight(3),
    borderRadius: scaleWidth(6),
    marginBottom: scaleHeight(2),
  },
  cptCodePillText: {
    color: EV.surface,
    fontSize: scaleFont(11),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cptDesc: {
    color: EV.muted,
    fontSize: scaleFont(11),
    fontWeight: '600',
    lineHeight: scaleFont(15),
  },
  cptCode: {
    color: EV.navy,
    fontSize: scaleFont(13),
    fontWeight: '800',
  },
  cptCount: {
    color: EV.muted,
    fontSize: scaleFont(11),
    fontWeight: '800',
  },
  cptRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: scaleHeight(6),
    minWidth: scaleWidth(80),
  },
  cptCounts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cptCountCol: {
    alignItems: 'center',
    minWidth: scaleWidth(34),
  },
  cptCountNum: {
    fontSize: scaleFont(15),
    fontWeight: '900',
    lineHeight: scaleFont(18),
  },
  cptCountLabel: {
    color: EV.mutedLight,
    fontSize: scaleFont(9),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cptTrack: {
    height: scaleHeight(8),
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(7,27,52,0.08)',
    width: '100%',
  },
  cptFill: {
    height: '100%',
    borderRadius: 999,
  },
  trendCard: {
    backgroundColor: EV.surface,
    borderRadius: scaleWidth(24),
    padding: scaleWidth(16),
    marginBottom: scaleHeight(2),
    borderWidth: 1,
    borderColor: EV.line,
    shadowColor: EV.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaleWidth(12),
    paddingTop: scaleHeight(4),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(6),
  },
  legendDot: {
    width: scaleWidth(8),
    height: scaleWidth(8),
    borderRadius: scaleWidth(4),
  },
  legendLabel: {
    color: EV.muted,
    fontSize: scaleFont(11),
    fontWeight: '800',
  },
  notifBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: scaleWidth(8),
    height: scaleWidth(8),
    borderRadius: scaleWidth(4),
    backgroundColor: EV.criticalStrong,
    borderWidth: 2,
    borderColor: '#fff',
  },
  patientHeroOuter: {
    width: '100%',
    marginBottom: scaleHeight(12),
    borderRadius: scaleWidth(30),
    overflow: 'hidden',
    shadowColor: EV.navy,
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.24,
    shadowRadius: 34,
    elevation: 7,
  },
  patientHeroGradient: {
    width: '100%',
  },
  patientHeroInner: {
    padding: scaleWidth(22),
  },
  patientHeroHead: {
    width: '100%',
  },
  patientHeroTitle: {
    color: '#fff',
    fontSize: scaleFont(19),
    lineHeight: scaleFont(24),
    fontWeight: '800',
  },
  patientHeroSub: {
    marginTop: scaleHeight(9),
    color: 'rgba(255,255,255,0.76)',
    fontSize: scaleFont(12),
    lineHeight: scaleFont(17),
    fontWeight: '500',
  },
  heroReadings: {
    marginTop: scaleHeight(18),
    gap: scaleHeight(8),
    width: '100%',
  },
  heroReadingRow: {
    width: '100%',
    minHeight: scaleHeight(52),
    borderRadius: scaleWidth(18),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.13)',
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(10),
  },
  heroReadingIcon: {
    width: scaleWidth(32),
    height: scaleWidth(32),
    borderRadius: scaleWidth(13),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    flexShrink: 0,
  },
  heroReadingText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  heroReadingName: {
    color: '#fff',
    fontSize: scaleFont(12),
    lineHeight: scaleHeight(15),
    fontWeight: '800',
  },
  heroReadingTime: {
    marginTop: scaleHeight(2),
    color: 'rgba(255,255,255,0.72)',
    fontSize: scaleFont(10),
    lineHeight: scaleHeight(13),
    fontWeight: '700',
  },
  heroReadingValueWrap: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: scaleWidth(6),
    maxWidth: '36%',
  },
  heroReadingValue: {
    color: '#fff',
    fontSize: scaleFont(15),
    fontWeight: '800',
    textAlign: 'right',
  },
  heroReadingUnit: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: scaleFont(9),
    fontWeight: '700',
  },
  alertCard: {
    borderRadius: scaleWidth(20),
    padding: scaleWidth(14),
    marginBottom: scaleHeight(8),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.07)',
    shadowColor: EV.textMain,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.055,
    shadowRadius: 22,
    elevation: 3,
  },
  alertRed: {
    backgroundColor: EV.criticalBg,
    borderColor: 'rgba(196, 22, 46, 0.20)',
  },
  alertYellow: {
    backgroundColor: EV.bluePale,
    borderColor: 'rgba(17, 119, 198, 0.20)',
  },
  alertGreen: {
    backgroundColor: '#EFF8FC',
    borderColor: 'rgba(0, 119, 182, 0.18)',
  },
  alertDot: {
    width: scaleWidth(8),
    height: scaleWidth(8),
    borderRadius: scaleWidth(4),
    marginRight: scaleWidth(12),
  },
  alertText: {
    flex: 1,
  },
  alertTitle: {
    fontSize: scaleFont(12.5),
    fontWeight: '800',
    color: EV.navy,
    letterSpacing: 0,
  },
  alertSub: {
    fontSize: scaleFont(11),
    color: 'rgba(15, 23, 42, 0.58)',
    marginTop: scaleHeight(2),
    lineHeight: scaleHeight(16),
  },
  alertTime: {
    fontSize: scaleFont(10),
    fontWeight: '700',
    color: 'rgba(15, 23, 42, 0.58)',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaleWidth(8),
    marginBottom: scaleHeight(12),
  },
  quickBtn: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: scaleWidth(96),
    backgroundColor: EV.surface,
    borderRadius: scaleWidth(18),
    paddingVertical: scaleHeight(12),
    paddingHorizontal: scaleWidth(4),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.055)',
    shadowColor: EV.textMain,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.035,
    shadowRadius: 12,
    elevation: 2,
  },
  qbIcon: {
    width: scaleWidth(34),
    height: scaleWidth(34),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scaleHeight(6),
    shadowColor: EV.textMain,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  qbLabel: {
    fontSize: scaleFont(8),
    fontWeight: '800',
    color: 'rgba(15, 23, 42, 0.58)',
    textTransform: 'uppercase',
    letterSpacing: 0.32,
    textAlign: 'center',
  },
  pcAvatar: {
    width: scaleWidth(36),
    height: scaleWidth(36),
    borderRadius: scaleWidth(18),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scaleWidth(10),
    shadowColor: EV.textMain,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  pcAvatarText: {
    color: '#fff',
    fontSize: scaleFont(11),
    fontWeight: '700',
  },
  flaggedRow: {
    backgroundColor: EV.surface,
    borderRadius: scaleWidth(20),
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(14),
    marginBottom: scaleHeight(8),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.065)',
    shadowColor: EV.textMain,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.045,
    shadowRadius: 16,
    elevation: 3,
  },
  frCritical: {
    borderColor: 'rgba(198, 40, 40, 0.16)',
    backgroundColor: EV.criticalBg,
  },
  frReview: {
    borderColor: 'rgba(7, 27, 52, 0.065)',
    backgroundColor: EV.surface,
  },
  frInfo: {
    flex: 1,
    marginLeft: scaleWidth(10),
  },
  frName: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: EV.navyMid,
  },
  frCond: {
    fontSize: scaleFont(11),
    color: 'rgba(15, 23, 42, 0.58)',
    marginTop: scaleHeight(2),
  },
  frAction: {
    paddingVertical: scaleHeight(5),
    paddingHorizontal: scaleWidth(10),
    borderRadius: scaleWidth(10),
    borderWidth: 1,
    marginLeft: scaleWidth(8),
    shadowColor: EV.textMain,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  frActionCritical: {
    backgroundColor: EV.criticalBg,
    borderColor: 'rgba(211, 47, 47, 0.15)',
  },
  frActionReview: {
    backgroundColor: EV.bluePale,
    borderColor: 'rgba(17, 119, 198, 0.22)',
  },
  frActionTextCritical: {
    fontSize: scaleFont(10),
    fontWeight: '800',
    color: EV.criticalStrong,
    textTransform: 'uppercase',
  },
  frActionTextReview: {
    fontSize: scaleFont(10),
    fontWeight: '800',
    color: EV.blue,
    textTransform: 'uppercase',
  },
});
