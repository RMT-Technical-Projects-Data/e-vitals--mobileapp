/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { useFocusEffect } from '@react-navigation/native';
import PremiumBottomNav, { PREMIUM_BOTTOM_NAV_CLEARANCE } from '../../components/navigation/PremiumBottomNav';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleHeight = (size) => Math.min((height / guidelineBaseHeight) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);
const eVitalsLogo = require('../../assets/images/batch_06/logo5.png');
const SCREEN_BG_COLORS = ['#ffffff', '#ffffff', '#ffffff'];
const QUICK_ACCESS_ICON_COLORS = ['#071B34', '#1B2A47'];

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

const AppHeader = ({ color, onNotifications, onMenuPress }) => (
  <View style={st.evTopbar}>
    <Image source={eVitalsLogo} style={st.evLogo} resizeMode="contain" />
    <View style={st.topbarActions}>
      <TouchableOpacity style={st.evIconButton} onPress={onNotifications} accessibilityRole="button" accessibilityLabel="Notifications">
        <MaterialIcons name="notifications-none" size={21} color={color} />
        <View style={st.notifBadge} />
      </TouchableOpacity>
      {Boolean(onMenuPress) && (
        <TouchableOpacity style={st.evIconButton} onPress={onMenuPress} accessibilityRole="button" accessibilityLabel="Open menu">
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
          <MaterialIcons name="search" size={18} color="#071B34" style={st.menuItemIcon} />
          <Text style={st.menuItemText}>Look up Patient</Text>
        </TouchableOpacity>
        <View style={st.menuDivider} />
        <TouchableOpacity
          style={st.menuItem}
          onPress={() => { onClose(); onFollowUp(); }}
          activeOpacity={0.75}
        >
          <MaterialIcons name="assignment" size={18} color="#071B34" style={st.menuItemIcon} />
          <Text style={st.menuItemText}>Follow Up</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
);

const RoleIntro = ({ eyebrow, title, practiceName, subtitle, color, practiceNameColor = '#9B1230' }) => (
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
      <TouchableOpacity onPress={onPress} accessibilityRole="button">
        <Text style={[st.evSectionAction, { color: actionColor || '#1b2a47' }]}>{actionLabel}</Text>
      </TouchableOpacity>
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
  const scrollRef = React.useRef(null);
  const scrollPos = React.useRef(0);
  const contentWidthRef = React.useRef(0);
  const isInteracting = React.useRef(false);
  const resumeTimer = React.useRef(null);
  const animationFrame = React.useRef(null);

  const baseItems = [
    {
      key: 'all',
      label: 'All',
      count: total,
      bg: '#071B34',
      borderColor: '#071B34',
      textColor: '#FFFFFF',
      dotColor: null,
      onPress: () => navigation?.navigate('Patients', { filterTitle: 'All Patients' }),
    },
    {
      key: 'active',
      label: 'Active',
      count: active,
      bg: '#F0FDF4',
      borderColor: '#86EFAC',
      textColor: '#15803D',
      dotColor: '#22C55E',
      onPress: () => navigation?.navigate('Patients', { dashboardFilter: 'active', filterTitle: 'Active Patients' }),
    },
    {
      key: 'pending',
      label: 'Pending',
      count: pending,
      bg: '#FEFCE8',
      borderColor: '#FDE047',
      textColor: '#A16207',
      dotColor: '#EAB308',
      onPress: () => navigation?.navigate('Patients', { dashboardFilter: 'pending', filterTitle: 'Pending Patients' }),
    },
    {
      key: 'locked',
      label: 'Locked',
      count: locked,
      bg: '#FEF2F2',
      borderColor: '#FCA5A5',
      textColor: '#B91C1C',
      dotColor: '#EF4444',
      onPress: () => navigation?.navigate('Patients', { dashboardFilter: 'locked', filterTitle: 'Locked Patients' }),
    },
  ];

  const carouselItems = [...baseItems, ...baseItems, ...baseItems, ...baseItems];

  React.useEffect(() => {
    let lastTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;

      if (!isInteracting.current && scrollRef.current && contentWidthRef.current > 0) {
        scrollPos.current += (35 * delta) / 1000;

        const halfWidth = contentWidthRef.current / 2;
        if (halfWidth > 0 && scrollPos.current >= halfWidth) {
          scrollPos.current = scrollPos.current % halfWidth;
        }

        scrollRef.current.scrollTo({ x: scrollPos.current, animated: false });
      }

      animationFrame.current = requestAnimationFrame(tick);
    };

    animationFrame.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      if (resumeTimer.current) {
        clearTimeout(resumeTimer.current);
      }
    };
  }, []);

  const handleScrollTouchStart = () => {
    isInteracting.current = true;
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
    }
  };

  const handleScrollTouchEnd = () => {
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
    }
    resumeTimer.current = setTimeout(() => {
      isInteracting.current = false;
    }, 2000);
  };

  const handleScroll = (event) => {
    const x = event.nativeEvent.contentOffset.x;
    scrollPos.current = x;
  };

  return (
    <View style={st.capsuleCarouselWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onTouchStart={handleScrollTouchStart}
        onTouchEnd={handleScrollTouchEnd}
        onScrollBeginDrag={handleScrollTouchStart}
        onScrollEndDrag={handleScrollTouchEnd}
        onMomentumScrollEnd={handleScrollTouchEnd}
        onContentSizeChange={(w) => {
          contentWidthRef.current = w;
        }}
        contentContainerStyle={st.capsuleCarouselContent}
      >
        {carouselItems.map((item, index) => (
          <TouchableOpacity
            key={`${item.key}-${index}`}
            style={[
              st.capsulePill,
              {
                backgroundColor: item.bg,
                borderColor: item.borderColor,
              },
            ]}
            onPress={item.onPress}
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
                item.key === 'all'
                  ? { backgroundColor: 'rgba(255,255,255,0.22)' }
                  : { backgroundColor: 'rgba(0,0,0,0.06)' },
              ]}
            >
              <Text style={[st.capsuleCountText, { color: item.textColor }]}>
                {item.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const DashboardCountsSection = ({ missedUploadsCount = 0, abnormalCount = 0, recentUploadsCount = 0, navigation }) => {
  const items = [
    {
      id: '01',
      title: 'Missed Uploads',
      value: missedUploadsCount,
      valueColor: '#071B34',
      onPress: () => navigation.navigate('Patients', { dashboardFilter: 'missedUploads', filterTitle: 'Missed Uploads' }),
    },
    {
      id: '02',
      title: 'Abnormal Readings',
      value: abnormalCount,
      valueColor: abnormalCount > 0 ? '#C53030' : '#071B34',
      onPress: () => navigation.navigate('Patients', { dashboardFilter: 'abnormalMeasurements', filterTitle: 'Abnormal Readings' }),
    },
    {
      id: '03',
      title: 'Recent Uploads',
      value: recentUploadsCount,
      valueColor: '#071B34',
      onPress: () => navigation.navigate('Patients', { dashboardFilter: 'recentUploads', filterTitle: 'Recent Uploads' }),
    },
  ];

  return (
    <View style={st.dbCountsWrap}>
      <View style={st.dbCountsHeaderRow}>
        <Text style={st.dbCountsHeaderTitle}>Dashboard Counts</Text>
        {/* <Text style={st.dbCountsHeaderSub}>Today</Text> */}
      </View>
      <View style={st.dbCountsCardContainer}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <TouchableOpacity
              key={item.id}
              style={[st.dbCountsRow, !isLast && st.dbCountsRowDivider]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={st.dbCountsIndex}>{item.id}</Text>
              <Text style={st.dbCountsRowTitle}>{item.title}</Text>
              <View style={st.dbCountsRightWrap}>
                <Text style={[st.dbCountsValue, { color: item.valueColor }]}>{item.value}</Text>
                <MaterialIcons name="chevron-right" size={20} color="#CBD5E0" />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* <View style={st.dbCountsHelperTag}>
        <Text style={st.dbCountsHelperText}>Tap anywhere on a row →</Text>
      </View> */}
    </View>
  );
};

const CriticalAlertRow = ({ icon = 'warning-amber', name, detail, severity = 'High', critical, onPress }) => {
  const content = (
    <View style={st.criticalRow}>
      <View style={st.criticalIcon}>
        <MaterialIcons name={icon} size={20} color="#c62828" />
      </View>
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
  const themeAccent = theme === 'provider' ? '#1B2A47' : '#1B2A47';
  return (
    <View style={st.cptCard}>
      {/* Header */}
      <View style={st.cptHeader}>
        <Text style={st.cptHeaderTitle}>
          {theme === 'provider' ? 'Provider attestation readiness' : 'RPM code readiness'}
        </Text>
        <View style={st.cptHeaderLegend}>
          <View style={st.cptLegendDot} />
          <Text style={[st.cptLegendLabel, { color: '#2e7d32' }]}>Elig</Text>
          <View style={[st.cptLegendDot, { backgroundColor: '#c62828', marginLeft: scaleWidth(10) }]} />
          <Text style={[st.cptLegendLabel, { color: '#c62828' }]}>Inelig</Text>
        </View>
      </View>

      {/* CPT rows */}
      {rows.map((row) => {
        const meta = CPT_CODE_META[row.code] || {};
        const eligible = typeof row.eligible === 'number' ? row.eligible : row.count || 0;
        const ineligible = typeof row.ineligible === 'number' ? row.ineligible : 0;
        const total = eligible + ineligible;
        const fillPct = total > 0 ? Math.round((eligible / total) * 100) : 0;
        const barColors = row.variant === 'warn'
          ? ['#c98a1a', '#dec07d']
          : row.variant === 'navy'
            ? ['#071B34', '#315272']
            : theme === 'provider'
              ? ['#9B1230', '#d2778a']
              : ['#2f5f8f', '#8da1b8'];

        const rowContent = (
          <View key={row.code} style={st.cptRow}>
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
                  <Text style={[st.cptCountNum, { color: '#2e7d32' }]}>{eligible}</Text>
                  <Text style={st.cptCountLabel}>Elig</Text>
                </View>
                <View style={[st.cptCountCol, { marginLeft: scaleWidth(12) }]}>
                  <Text style={[st.cptCountNum, { color: '#c62828' }]}>{ineligible}</Text>
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
  const cardWidth = Math.min(width - scaleWidth(32), scaleWidth(360));
  const chartWidth = cardWidth - scaleWidth(32);
  const chartHeight = scaleHeight(150);
  const left = 32;
  const right = 12;
  const top = 16;
  const bottom = 28;
  const innerW = chartWidth - left - right;
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
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / cardWidth);
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
      <View key={title} style={[st.trendSlideCard, { width: cardWidth }]}>
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
                <SvgText x={left - 6} y={y + 3} fontSize="9" fontWeight="700" fill="#94A3B8" textAnchor="end">
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
                      fill="#FFFFFF"
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
              fill="#94A3B8"
              textAnchor="middle"
            >
              {day}
            </SvgText>
          ))}
        </Svg>
      </View>
    );
  };

  return (
    <View style={st.trendCarouselWrap}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        contentContainerStyle={st.trendCarouselContent}
      >
        {/* Slide 1: Blood Pressure & Pulse */}
        {renderSingleChart({
          title: 'Blood Pressure & Pulse',
          lines: [
            { label: 'Systole', color: '#9B1230', data: bpData.systole },
            { label: 'Diastole', color: '#2563EB', data: bpData.diastole },
            { label: 'Pulse', color: '#EAB308', data: bpData.pulse },
          ],
          minVal: 60,
          maxVal: 160,
        })}

        {/* Slide 2: Blood Glucose */}
        {renderSingleChart({
          title: 'Blood Glucose (mg/dL)',
          lines: [
            { label: 'Glucose', color: '#EA580C', data: bgData },
          ],
          minVal: 90,
          maxVal: 140,
        })}

        {/* Slide 3: Weight */}
        {renderSingleChart({
          title: 'Weight (lb)',
          lines: [
            { label: 'Weight', color: '#0D9488', data: weightData },
          ],
          minVal: 175,
          maxVal: 185,
        })}
      </ScrollView>

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
  <SvgText x={x} y={y} fontSize="9" fontWeight="700" fill="#8b96a6" textAnchor="middle">
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
        const [listResult, analyticsResult] = await Promise.all([
          apiService.getPatients(pId, {
            limit: 1000,
            page: 1,
            includeDashboardEnrichment: true,
            caregiverId: userObj.id,
          }).catch(() => null),
          apiService.getProgramAnalytics(pId, 'rpm').catch(() => null),
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
                      patientName: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
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
        setCaregiverPatients(fallbackCaregiverPatients);
        setTotalPatientCount(fallbackCaregiverPatients.length);
        setCaregiverFollowUps([]);
        setCaregiverDashboardStats(null);
      }
    } catch (error) {
      console.warn('Error fetching caregiver patients:', error);
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

  const loadUserData = useCallback(async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const roleId = Number(user.role_id);
        // Set practice name from user object (returned by auth API)
        if (user.practice_name) {
          setPracticeName(user.practice_name);
        } else if (user.practice?.name) {
          setPracticeName(user.practice.name);
        } else {
          setPracticeName('Northside Cardiology');
        }
        if (roleId === 4) {
          setUserRole('provider');
          setPatientName(user.first_name ? `Dr. ${user.first_name} ${user.last_name}` : user.name || 'Elena Reyes');
          fetchProviderDashboardData(user);
        } else if (roleId === 5 || roleId === 7) {
          setUserRole('caregiver');
          setPatientName(`${user.first_name || 'Maria'} ${user.last_name || 'Johnson'}`);
          fetchCaregiverPatientsList(user);
        } else {
          setUserRole('patient');
          setPatientName(`${user.first_name || 'Cyrus'} ${user.last_name || 'Nguyen'}`);
          fetchPatientVitals();
        }
      } else {
        setUserRole('patient');
        setPatientName('Cyrus Nguyen');
        setPracticeName('Northside Cardiology');
        fetchPatientVitals();
      }
    } catch (e) {
      console.warn('Failed to load user data on home screen:', e);
    }
  }, [fetchProviderDashboardData, fetchCaregiverPatientsList, fetchPatientVitals]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

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

  const openLookupPatient = () => navigation.navigate('LookupPatient');
  const openLookupRPM = () => navigation.navigate('LookupPatientRPM');
  const openLookupCCM = () => navigation.navigate('LookupPatientCCM');

  const openFollowUp = () => navigation.navigate('FollowUp');

  const openPatientHub = (patient, dashboardRole) => {
    const resolvedPatientId = patient.patient_table_id || patient.id;
    navigation.navigate('PatientHub', {
      patientId: resolvedPatientId,
      practiceId: practiceId || patient.practice_id,
      patientName: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
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
    const wtVal = wtRaw != null
      ? parseFloat((parseFloat(wtRaw) * 2.20462).toFixed(1))
      : '--';
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
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <LinearGradient
          colors={SCREEN_BG_COLORS}
          style={st.fullGradient}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <ScrollView
              contentContainerStyle={st.scrollContainer}
              showsVerticalScrollIndicator={false}
              bounces={true}
              overScrollMode="never"
            >
              <AppHeader
                color="#071B34"
                onNotifications={() => navigation.navigate('Notifications')}
              />
              <RoleIntro

                title={patientName || 'Dashboard'}
                practiceName={practiceName || 'Northside Cardiology'}
                color="#071B34"
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
                    <Text style={[st.lrValText, bpVal !== '--' && { color: '#800000' }]}>{bpVal}</Text>
                    <Text style={st.lrUnitText}>mmHg</Text>
                  </View>
                </TouchableOpacity>

                <View style={st.lrRowDivider} />

                <TouchableOpacity style={st.lrRow} onPress={() => openList('bg')} activeOpacity={0.7}>
                  <View style={st.lrMeta}>
                    <Text style={st.lrName}>Blood Glucose</Text>
                    <Text style={st.lrTime}>{bgTime}</Text>
                  </View>
                  <View style={st.lrValWrap}>
                    <Text style={st.lrValText}>{bgVal}</Text>
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
                    <Text style={st.lrValText}>{wtVal}</Text>
                    <Text style={st.lrUnitText}>lb</Text>
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
    const recentUploads = displayList.slice(0, 4);
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
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <LinearGradient
          colors={SCREEN_BG_COLORS}
          style={st.fullGradient}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <ScrollView
              contentContainerStyle={st.scrollContainer}
              showsVerticalScrollIndicator={false}
              bounces={true}
              overScrollMode="never"
            >
              <ThreeDotMenu
                visible={showMenu}
                onClose={() => setShowMenu(false)}
                onLookupPatient={openLookupPatient}
                onLookupRPM={openLookupRPM}
                onLookupCCM={openLookupCCM}
                onFollowUp={openFollowUp}
              />
              <AppHeader
                color="#1B2A47"
                onNotifications={() => navigation.navigate('Notifications')}
                onMenuPress={() => setShowMenu(true)}
              />
              <RoleIntro

                title={patientName || 'Dashboard'}
                practiceName={practiceName}
                subtitle="Your assigned patient panel is prioritized by uploads, alerts, and billing readiness."
                color="#1B2A47"
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
                navigation={navigation}
              />

              <SectionTitle title="Recent Uploads" subtitle="Latest patient syncs" actionLabel="Patients" actionColor="#1B2A47" onPress={() => navigation.navigate('Patients')} />

              {isCaregiverLoading && caregiverPatients.length === 0 ? (
                <ActivityIndicator size="small" color="#1b2a47" style={{ marginVertical: 20 }} />
              ) : (
                <View style={st.uploadList}>
                  {recentUploads.map((p) => {
                    const initials = `${p.first_name?.[0] || ''}${p.last_name?.[0] || ''}` || 'EV';
                    const latestBp = p.data_summary || '--';
                    const uploadLabel = p.glucose ? `Uploaded blood glucose: ${p.glucose}` : latestBp !== '--' ? `Uploaded blood pressure: ${latestBp}` : 'Uploaded latest vitals';
                    return (
                      <TouchableOpacity key={String(p.id)} style={st.uploadRow} onPress={() => openPatientHub(p, 'caregiver')}>
                        <View style={st.uploadAvatar}><Text style={st.uploadAvatarText}>{initials}</Text></View>
                        <View style={st.uploadText}>
                          <Text style={st.uploadName}>{p.first_name} {p.last_name}</Text>
                          <Text style={st.uploadDetail}>{uploadLabel}</Text>
                        </View>
                        <View style={st.uploadPill}><Text style={st.uploadPillText}>Vitals</Text></View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <SectionTitle title="Critical Alerts" actionLabel="See all" actionColor="#687382" onPress={() => navigation.navigate('Patients')} />

              {criticalPatients.length === 0 ? (
                <View style={st.emptyAlertCard}><Text style={st.emptyAlertText}>No critical alerts for now.</Text></View>
              ) : (
                <View style={st.criticalCard}>
                  {criticalPatients.slice(0, 4).map((p, index) => {
                    const isCritical = p.status === 'Critical' || p.status === 'Locked';
                    const reading = p.data_summary ? `Blood pressure ${p.data_summary} with repeat high reading` : 'Measurement outside configured target range';
                    return (
                      <CriticalAlertRow
                        key={String(p.id)}
                        icon={index % 2 === 0 ? 'warning-amber' : 'notification-important'}
                        name={`${p.first_name} ${p.last_name}`}
                        detail={reading}
                        severity={isCritical ? 'Critical' : 'High'}
                        critical={isCritical}
                        onPress={() => openPatientHub(p, 'caregiver')}
                      />
                    );
                  })}
                </View>
              )}

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
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <LinearGradient
          colors={SCREEN_BG_COLORS}
          style={st.fullGradient}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <ScrollView
              contentContainerStyle={st.scrollContainer}
              showsVerticalScrollIndicator={false}
              bounces={true}
              overScrollMode="never"
            >
              <ThreeDotMenu
                visible={showMenu}
                onClose={() => setShowMenu(false)}
                onLookupPatient={openLookupPatient}
                onLookupRPM={openLookupRPM}
                onLookupCCM={openLookupCCM}
                onFollowUp={openFollowUp}
              />
              <AppHeader
                color="#071B34"
                onNotifications={() => navigation.navigate('Notifications')}
                onMenuPress={() => setShowMenu(true)}
              />
              <RoleIntro

                title={patientName || 'Dashboard'}
                practiceName={practiceName}
                // subtitle="Your patient panel is organized by review urgency, uploads, alerts, and billing readiness."
                color="#9B1230"
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
                navigation={navigation}
              />

              <SectionTitle title="Critical Alerts" actionLabel="See all" actionColor="#687382" onPress={() => navigation.navigate('Patients')} />

              {criticalPatients.length === 0 ? (
                <View style={st.emptyAlertCard}><Text style={st.emptyAlertText}>No critical alerts for now.</Text></View>
              ) : (
                <View style={st.criticalCard}>
                  {criticalPatients.slice(0, 4).map((p, index) => (
                    <CriticalAlertRow
                      key={String(p.id)}
                      icon={index % 2 === 0 ? 'warning-amber' : 'notification-important'}
                      name={`${p.first_name} ${p.last_name}`}
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
    backgroundColor: '#d32f2f',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: '#071B34',
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
    color: '#071B34',
    fontSize: scaleFont(26),
    lineHeight: scaleHeight(31),
    fontWeight: '800',
  },
  evSubtitle: {
    marginTop: scaleHeight(6),
    color: '#687382',
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
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(14),
    minWidth: scaleWidth(180),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: '#071B34',
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
    color: '#071B34',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e8ecf0',
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
    color: '#071B34',
    fontSize: scaleFont(16),
    fontWeight: '800',
  },
  evSectionSubtitle: {
    color: '#687382',
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
    color: '#687382',
  },
  evSectionAction: {
    fontSize: scaleFont(12),
    fontWeight: '800',
  },
  capsuleCarouselWrap: {
    marginVertical: scaleHeight(12),
    width: '100%',
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
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
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
    shadowColor: '#071B34',
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
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(24),
    paddingHorizontal: scaleWidth(16),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  uploadRow: {
    minHeight: scaleHeight(60),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(11),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(7,27,52,0.07)',
  },
  uploadAvatar: {
    width: scaleWidth(42),
    height: scaleWidth(42),
    borderRadius: scaleWidth(15),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf2f7',
  },
  uploadAvatarText: {
    color: '#2F5F8F',
    fontSize: scaleFont(13),
    fontWeight: '800',
  },
  uploadText: {
    flex: 1,
    minWidth: 0,
  },
  uploadName: {
    color: '#071B34',
    fontSize: scaleFont(13),
    fontWeight: '800',
  },
  uploadDetail: {
    marginTop: scaleHeight(3),
    color: '#687382',
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
    color: '#2F5F8F',
    fontSize: scaleFont(9),
    fontWeight: '800',
  },
  criticalCard: {
    borderRadius: scaleWidth(24),
    paddingHorizontal: scaleWidth(16),
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(198,40,40,0.18)',
    shadowColor: '#071B34',
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
    backgroundColor: 'rgba(198,40,40,0.1)',
  },
  criticalText: {
    flex: 1,
    minWidth: 0,
  },
  criticalName: {
    color: '#071B34',
    fontSize: scaleFont(13),
    fontWeight: '800',
  },
  criticalDetail: {
    marginTop: scaleHeight(3),
    color: '#687382',
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
    backgroundColor: '#C62828',
  },
  severityHigh: {
    backgroundColor: '#9B1230',
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
    color: '#687382',
    fontSize: scaleFont(12),
    fontWeight: '800',
  },
  dbCountsWrap: {
    marginTop: scaleHeight(16),
    marginBottom: scaleHeight(12),
    width: '100%',
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
    color: '#071B34',
  },
  dbCountsHeaderSub: {
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: '#94A3B8',
  },
  dbCountsCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: scaleWidth(20),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: scaleWidth(18),
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  dbCountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(16),
  },
  dbCountsRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dbCountsIndex: {
    fontSize: scaleFont(13),
    fontWeight: '700',
    color: '#CBD5E0',
    width: scaleWidth(28),
  },
  dbCountsRowTitle: {
    flex: 1,
    fontSize: scaleFont(15),
    fontWeight: '700',
    color: '#071B34',
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
    backgroundColor: '#EFF6FF',
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(6),
    borderRadius: scaleWidth(14),
  },
  dbCountsHelperText: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: '#2563EB',
  },
  lrHeaderWrap: {
    marginTop: scaleHeight(12),
    marginBottom: scaleHeight(10),
    width: '100%',
  },
  lrHeaderTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#071B34',
  },
  lrHeaderSub: {
    fontSize: scaleFont(13),
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: scaleHeight(2),
  },
  lrCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: scaleWidth(20),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: scaleWidth(20),
    shadowColor: '#071B34',
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
    borderBottomColor: '#CBD5E1',
    borderStyle: 'solid',
  },
  lrMeta: {
    flex: 1,
    marginRight: scaleWidth(12),
  },
  lrName: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: '#071B34',
  },
  lrTime: {
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: '#94A3B8',
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
    color: '#071B34',
  },
  lrUnitText: {
    fontSize: scaleFont(11),
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: scaleHeight(2),
  },
  trendCarouselWrap: {
    marginVertical: scaleHeight(10),
    width: '100%',
  },
  trendCarouselContent: {
    alignItems: 'center',
  },
  trendSlideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scaleWidth(20),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: scaleWidth(16),
    marginRight: scaleWidth(12),
    shadowColor: '#071B34',
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
    color: '#071B34',
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
    backgroundColor: '#CBD5E1',
  },
  trendDotItemActive: {
    width: scaleWidth(22),
    backgroundColor: '#071B34',
  },
  miniCountTitle: {
    color: '#687382',
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
    color: '#2F5F8F',
    fontSize: scaleFont(12),
    fontWeight: '800',
  },
  cptCard: {
    borderRadius: scaleWidth(24),
    padding: scaleWidth(16),
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: '#071B34',
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
    color: '#071B34',
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
    backgroundColor: '#2e7d32',
  },
  cptLegendLabel: {
    fontSize: scaleFont(11),
    fontWeight: '700',
  },
  cptHeaderMeta: {
    color: '#687382',
    fontSize: scaleFont(11),
    fontWeight: '800',
  },
  cptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleHeight(14),
    gap: scaleWidth(10),
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
    color: '#ffffff',
    fontSize: scaleFont(11),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cptDesc: {
    color: '#687382',
    fontSize: scaleFont(11),
    fontWeight: '600',
    lineHeight: scaleFont(15),
  },
  cptCode: {
    color: '#071B34',
    fontSize: scaleFont(13),
    fontWeight: '800',
  },
  cptCount: {
    color: '#687382',
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
    color: '#9ba5b4',
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
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(24),
    padding: scaleWidth(16),
    marginBottom: scaleHeight(2),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: '#071B34',
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
    color: '#687382',
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
    backgroundColor: '#d32f2f',
    borderWidth: 2,
    borderColor: '#fff',
  },
  patientHeroOuter: {
    width: '100%',
    marginBottom: scaleHeight(12),
    borderRadius: scaleWidth(30),
    overflow: 'hidden',
    shadowColor: '#071B34',
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
    shadowColor: '#0f172a',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.055,
    shadowRadius: 22,
    elevation: 3,
  },
  alertRed: {
    backgroundColor: '#fff2f4',
    borderColor: 'rgba(211, 47, 47, 0.20)',
  },
  alertYellow: {
    backgroundColor: '#fff8e1',
    borderColor: 'rgba(192, 138, 13, 0.20)',
  },
  alertGreen: {
    backgroundColor: '#f0f9f2',
    borderColor: 'rgba(46, 125, 50, 0.18)',
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
    color: '#111c33',
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
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(18),
    paddingVertical: scaleHeight(12),
    paddingHorizontal: scaleWidth(4),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.055)',
    shadowColor: '#0f172a',
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
    shadowColor: '#0f172a',
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
    shadowColor: '#0f172a',
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
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(20),
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(14),
    marginBottom: scaleHeight(8),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.065)',
    shadowColor: '#0f172a',
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
    backgroundColor: '#fff9f9',
  },
  frReview: {
    borderColor: 'rgba(7, 27, 52, 0.065)',
    backgroundColor: '#ffffff',
  },
  frInfo: {
    flex: 1,
    marginLeft: scaleWidth(10),
  },
  frName: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: '#1b2a47',
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
    shadowColor: '#0f172a',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  frActionCritical: {
    backgroundColor: '#fff2f4',
    borderColor: 'rgba(211, 47, 47, 0.15)',
  },
  frActionReview: {
    backgroundColor: '#fff8e1',
    borderColor: 'rgba(251, 192, 45, 0.25)',
  },
  frActionTextCritical: {
    fontSize: scaleFont(10),
    fontWeight: '800',
    color: '#d32f2f',
    textTransform: 'uppercase',
  },
  frActionTextReview: {
    fontSize: scaleFont(10),
    fontWeight: '800',
    color: '#b58505',
    textTransform: 'uppercase',
  },
});
