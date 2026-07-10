import AsyncStorage from '@react-native-async-storage/async-storage';

const WELCOME_KEY = 'hasSeenWelcome';

export const WelcomeManager = {
  // Check if user has seen welcome screen
  hasSeenWelcome: async () => {
    try {
      const value = await AsyncStorage.getItem(WELCOME_KEY);
      return value !== null;
    } catch (error) {
      console.log('Error reading welcome status:', error);
      return false;
    }
  },

  // Mark welcome screen as seen
  markWelcomeAsSeen: async () => {
    try {
      await AsyncStorage.setItem(WELCOME_KEY, 'true');
    } catch (error) {
      console.log('Error saving welcome status:', error);
    }
  },

  // Reset for testing (optional)
  resetWelcomeStatus: async () => {
    try {
      await AsyncStorage.removeItem(WELCOME_KEY);
    } catch (error) {
      console.log('Error resetting welcome status:', error);
    }
  }
};