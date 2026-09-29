import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const PULSE_RED = '#e63946';

const PulseIcon = ({ isAbnormal = false, size = 14, style }) => (
  <View style={[styles.wrap, { width: size, height: size }, style]}>
    {isAbnormal ? (
      <Image
        source={require('../../assets/pulse.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="Abnormal pulse"
      />
    ) : (
      <MaterialIcons
        name="favorite"
        size={size}
        color={PULSE_RED}
        accessibilityLabel="Normal pulse"
      />
    )}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 3,
    marginRight: 2,
  },
});

export default PulseIcon;
