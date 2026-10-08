import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { resolvePatientProfileUrl } from '../../utils/patientProfileImage';

const initialsFromName = (name = '') => {
  const parts = String(name).trim().split(/[\s,]+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const PatientAvatar = ({
  profilePic,
  firstName = '',
  lastName = '',
  name = '',
  size = 38,
  borderRadius,
  backgroundColor = '#0b1f3f',
  textColor = '#ffffff',
  textStyle,
  style,
}) => {
  const uri = resolvePatientProfileUrl(profilePic);
  const [failed, setFailed] = useState(false);
  const radius = borderRadius == null ? size / 2 : borderRadius;
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
    || initialsFromName(name)
    || 'P';

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[styles.photo, { width: size, height: size, borderRadius: radius, backgroundColor }, style]}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius, backgroundColor },
        style,
      ]}
    >
      <Text style={[{ color: textColor, fontWeight: '800' }, textStyle]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  photo: {
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default PatientAvatar;
