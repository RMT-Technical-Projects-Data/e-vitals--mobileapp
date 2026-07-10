import React from 'react';
import { View, Text } from 'react-native';
import { authStyles } from '../../config/theme';

const AuthFeedback = ({ message, tone = 'error' }) => {
  if (!message) {
    return null;
  }

  return (
    <View
      style={[
        authStyles.feedback,
        tone === 'success' && authStyles.feedbackSuccess,
      ]}
    >
      <Text
        style={[
          authStyles.feedbackText,
          tone === 'success' && authStyles.feedbackTextSuccess,
        ]}
      >
        {message}
      </Text>
    </View>
  );
};

export default AuthFeedback;
