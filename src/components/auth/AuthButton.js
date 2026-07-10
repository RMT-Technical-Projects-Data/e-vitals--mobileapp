import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { authStyles, theme } from '../../config/theme';

const AuthButton = ({ label, onPress, loading = false, disabled = false }) => (
  <TouchableOpacity
    style={authStyles.primaryBtnWrap}
    onPress={onPress}
    disabled={loading || disabled}
    activeOpacity={0.9}
  >
    <View style={[authStyles.primaryBtn, { backgroundColor: theme.navy }]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={authStyles.primaryBtnText}>{label}</Text>
      )}
    </View>
  </TouchableOpacity>
);

export default AuthButton;
