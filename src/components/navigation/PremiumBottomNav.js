import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { resolveUserRole } from '../../utils/resolveUserRole';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleHeight = (size) => Math.min((height / guidelineBaseHeight) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

export const PREMIUM_BOTTOM_NAV_CLEARANCE = scaleHeight(88);

export default function PremiumBottomNav({ active, navigation, role, unreadMessages = 0 }) {
  const [resolvedRole, setResolvedRole] = useState(role || 'patient');


  useEffect(() => {
    if (role) {
      setResolvedRole(role);
      return;
    }

    let mounted = true;
    const loadRole = async () => {
      try {
        const userStr = await AsyncStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        const nextRole = resolveUserRole(user);
        if (mounted) {
          setResolvedRole(nextRole);
        }
      } catch {
        if (mounted) {
          setResolvedRole('patient');
        }
      }
    };
    loadRole();
    return () => {
      mounted = false;
    };
  }, [role]);

  const go = useCallback((routeName) => {
    if (!routeName) {
      return;
    }

    const tabRoute = routeName;
    const routeParams = { role: resolvedRole };
    const routeNames = navigation.getState?.().routeNames || [];
    if (routeNames.includes('MainTabs')) {
      navigation.navigate('MainTabs', { screen: tabRoute, params: routeParams });
    } else {
      navigation.navigate(tabRoute, routeParams);
    }
  }, [navigation, resolvedRole]);

  const navs = resolvedRole === 'patient'
    ? [
      { key: 'home', label: 'Home', icon: 'home', route: 'Home' },
      { key: 'messages', label: 'Messages', icon: 'chat-bubble-outline', route: 'Chat' },
      { key: 'settings', label: 'Settings', icon: 'settings', route: 'Settings' },
    ]
    : resolvedRole === 'provider'
      ? [
        { key: 'review', label: 'Home', icon: 'dashboard', route: 'Home' },
        { key: 'patients', label: 'Patients', icon: 'groups', route: 'Patients' },
        { key: 'messages', label: 'Messages', icon: 'chat-bubble-outline', route: 'Chat' },
        { key: 'settings', label: 'Settings', icon: 'settings', route: 'Settings' },
      ]
      : [
        { key: 'queue', label: 'Home', icon: 'dashboard', route: 'Home' },
        { key: 'patients', label: 'Patients', icon: 'groups', route: 'Patients' },
        { key: 'messages', label: 'Messages', icon: 'chat-bubble-outline', route: 'Chat' },
        { key: 'settings', label: 'Settings', icon: 'settings', route: 'Settings' },
      ];

  const activeColor = '#071B34';

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bottomNav}>
        {navs.map((item) => {
          const isActive = item.key === active;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, isActive && (resolvedRole === 'patient' ? styles.navItemPatientActive : styles.navItemPanelActive)]}
              onPress={() => go(item.route)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={{ position: 'relative' }}>
                <MaterialIcons name={item.icon} size={19} color={isActive ? activeColor : '#687382'} />
                {item.key === 'messages' && unreadMessages > 0 && (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeText}>{unreadMessages > 99 ? '99+' : unreadMessages}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.navLabel, isActive && { color: activeColor }]} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: scaleHeight(12),
    paddingHorizontal: Math.max(scaleWidth(16), 16),
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  bottomNav: {
    flexDirection: 'row',
    gap: scaleWidth(4),
    padding: scaleWidth(8),
    borderRadius: scaleWidth(24),
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1.5,
    borderColor: '#d0d8e2',
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 34,
    elevation: 6,
    overflow: 'hidden',
  },
  navItem: {
    flex: 1,
    minHeight: scaleHeight(54),
    borderRadius: scaleWidth(18),
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleHeight(2),
    paddingHorizontal: scaleWidth(2),
  },
  navItemPatientActive: {
    backgroundColor: '#edf1f6',
  },
  navItemPanelActive: {
    backgroundColor: '#edf1f6',
  },
  navLabel: {
    color: '#687382',
    fontSize: scaleFont(8.3),
    lineHeight: scaleHeight(12),
    fontWeight: '800',
    textAlign: 'center',
  },
  navBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#E53935',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  navBadgeText: {
    color: '#fff',
    fontSize: scaleFont(9),
    fontWeight: '800',
  },
});

