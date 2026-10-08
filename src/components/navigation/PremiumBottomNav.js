import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { resolveUserRole } from '../../utils/resolveUserRole';
import {
  getUnreadMessageCount,
  refreshUnreadMessageCount,
  subscribeUnreadMessageCount,
} from '../../utils/unreadMessageCount';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleHeight = (size) => Math.min((height / guidelineBaseHeight) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

export const PREMIUM_BOTTOM_NAV_CLEARANCE = scaleHeight(88);

export default function PremiumBottomNav({ active, navigation, role }) {
  const [resolvedRole, setResolvedRole] = useState(role || 'patient');
  const [unreadMessages, setUnreadMessages] = useState(getUnreadMessageCount);


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

  useEffect(() => {
    const sync = () => setUnreadMessages(getUnreadMessageCount());
    sync();
    const unsubscribe = subscribeUnreadMessageCount(sync);
    refreshUnreadMessageCount();
    const retryTimers = [800, 2500, 6000].map((delay) => (
      setTimeout(() => refreshUnreadMessageCount(), delay)
    ));
    const poll = setInterval(() => {
      refreshUnreadMessageCount();
      sync();
    }, 8000);

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshUnreadMessageCount();
      }
    });

    return () => {
      unsubscribe();
      retryTimers.forEach(clearTimeout);
      clearInterval(poll);
      appStateSub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshUnreadMessageCount();
    }, [])
  );

  const go = useCallback((routeName) => {
    if (!routeName) {
      return;
    }

    const tabRoute = routeName;
    const routeParams = {
      role: resolvedRole,
      ...(tabRoute === 'Chat' ? { messagesRoot: Date.now(), openUserId: undefined } : {}),
    };
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

  const activeColor = '#0b1f3f';

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
                <MaterialIcons name={item.icon} size={19} color={isActive ? activeColor : '#64748b'} />
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
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 34,
    elevation: 6,
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
    top: -6,
    right: -10,
    backgroundColor: '#E53935',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    zIndex: 2,
  },
  navBadgeText: {
    color: '#fff',
    fontSize: scaleFont(9),
    fontWeight: '800',
  },
});

