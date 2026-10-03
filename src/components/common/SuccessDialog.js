import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { theme, scale } from '../../config/theme';

/**
 * In-app success confirmation. Replaces the native Android alert so the
 * follow-up flow stays on the navy / white app theme.
 */
const VARIANTS = {
  success: {
    icon: 'check',
    iconColor: theme.blue,
    iconBg: 'rgba(17, 119, 198, 0.12)',
  },
  warning: {
    icon: 'error-outline',
    iconColor: '#dc3545',
    iconBg: '#fdecee',
  },
};

const SuccessDialog = ({
  visible,
  title = 'Success',
  message = '',
  buttonLabel = 'OK',
  onClose,
  variant = 'success',
  embedded = false,
}) => {
  if (embedded && !visible) return null;

  const tone = VARIANTS[variant] || VARIANTS.success;
  const body = (
    <View style={[styles.root, embedded && styles.embeddedRoot]}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: tone.iconBg }]}>
          <MaterialIcons name={tone.icon} size={scale(28)} color={tone.iconColor} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <TouchableOpacity
          style={styles.button}
          onPress={onClose}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (embedded) return body;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      {body}
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(24),
  },
  embeddedRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 27, 52, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.paper,
    borderRadius: scale(24),
    paddingHorizontal: scale(22),
    paddingTop: scale(28),
    paddingBottom: scale(20),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.line,
    shadowColor: theme.navy,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(16),
  },
  title: {
    color: theme.navy,
    fontSize: scale(18),
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: theme.muted,
    fontSize: scale(14),
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: scale(20),
    marginTop: scale(8),
  },
  button: {
    marginTop: scale(20),
    alignSelf: 'stretch',
    backgroundColor: theme.navy,
    borderRadius: scale(14),
    paddingVertical: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: scale(14),
    fontWeight: '800',
  },
});

export default SuccessDialog;
