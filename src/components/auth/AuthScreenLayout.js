import React from 'react';
import {
  View,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableOpacity,
  Text,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { authStyles, theme } from '../../config/theme';

const AuthScreenLayout = ({
  children,
  showLogo = true,
  headerTitle,
  onBack,
}) => (
  <LinearGradient colors={theme.gradient} style={authStyles.gradient}>
    <SafeAreaView style={authStyles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={authStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={authStyles.flex}
          contentContainerStyle={authStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          onScrollBeginDrag={Keyboard.dismiss}
        >
          <View style={authStyles.screenCard}>
            <View style={authStyles.hero}>
              {onBack ? (
                <View style={authStyles.heroRow}>
                  <TouchableOpacity
                    style={authStyles.backButton}
                    onPress={onBack}
                    activeOpacity={0.8}
                  >
                    <Text style={authStyles.backButtonText}>‹</Text>
                  </TouchableOpacity>

                  {showLogo ? (
                    <Image
                      source={require('../../assets/images/batch_06/logo5.png')}
                      style={authStyles.logo}
                      resizeMode="contain"
                    />
                  ) : headerTitle ? (
                    <Text style={authStyles.headerTitle} numberOfLines={1}>
                      {headerTitle}
                    </Text>
                  ) : (
                    <View style={authStyles.backButton} />
                  )}

                  <View style={authStyles.backButton} />
                </View>
              ) : (
                showLogo && (
                  <Image
                    source={require('../../assets/images/batch_06/logo5.png')}
                    style={authStyles.logo}
                    resizeMode="contain"
                  />
                )
              )}
            </View>

            <View style={authStyles.panel}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </LinearGradient>
);

export default AuthScreenLayout;
