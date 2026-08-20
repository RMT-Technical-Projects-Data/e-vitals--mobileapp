import { Alert, Platform } from 'react-native';
import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_KEY = 'biometricLoginEnabled';
const SERVICE = 'evitals.biometric.credentials';

export const MAX_BIOMETRIC_ATTEMPTS = 2;

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: false });

export function getBiometricLabel(biometryType) {
  if (biometryType === BiometryTypes.FaceID || biometryType === 'FaceID') {
    return 'Face ID';
  }
  if (biometryType === BiometryTypes.TouchID || biometryType === 'TouchID') {
    return 'Touch ID';
  }
  return Platform.OS === 'ios' ? 'Face ID' : 'Biometric login';
}

export async function getBiometricStatus() {
  try {
    const { available, biometryType } = await rnBiometrics.isSensorAvailable();
    const enabled = (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
    const creds = await getSavedCredentials();

    return {
      available: Boolean(available),
      biometryType: biometryType || null,
      enabled,
      hasCredentials: Boolean(creds?.username && creds?.password),
      label: getBiometricLabel(biometryType),
    };
  } catch (error) {
    console.warn('Biometric status check failed:', error?.message || error);
    return {
      available: false,
      biometryType: null,
      enabled: false,
      hasCredentials: false,
      label: Platform.OS === 'ios' ? 'Face ID' : 'Biometric login',
    };
  }
}

export async function canPromptBiometricLogin() {
  const status = await getBiometricStatus();
  return status.available && status.enabled && status.hasCredentials;
}

export async function authenticateWithBiometrics(promptMessage) {
  try {
    const { success, error } = await rnBiometrics.simplePrompt({
      promptMessage,
      cancelButtonText: 'Use password',
    });

    if (success) {
      return { success: true };
    }

    const message = String(error || '');
    const cancelled = /cancel|user.?cancel|code.?13|code.?10/i.test(message);
    return { success: false, cancelled, error: message };
  } catch (error) {
    const message = String(error?.message || error || '');
    const cancelled = /cancel/i.test(message);
    return { success: false, cancelled, error: message };
  }
}

export async function getSavedCredentials() {
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE });
    if (!result) {
      return null;
    }
    return { username: result.username, password: result.password };
  } catch (error) {
    console.warn('Could not read biometric credentials:', error?.message || error);
    return null;
  }
}

export async function saveCredentials(username, password) {
  await Keychain.setGenericPassword(username.trim(), password, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await AsyncStorage.setItem(ENABLED_KEY, 'true');
}

export async function disableBiometricLogin() {
  await AsyncStorage.setItem(ENABLED_KEY, 'false');
  try {
    await Keychain.resetGenericPassword({ service: SERVICE });
  } catch (error) {
    console.warn('Could not clear biometric credentials:', error?.message || error);
  }
}

export async function enableBiometricLogin() {
  await AsyncStorage.setItem(ENABLED_KEY, 'true');
}

export async function updateSavedPassword(username, newPassword) {
  const enabled = (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
  if (!enabled) {
    return;
  }

  const creds = await getSavedCredentials();
  const loginUsername = username?.trim() || creds?.username;
  if (!loginUsername || !newPassword) {
    return;
  }

  await saveCredentials(loginUsername, newPassword);
}

export function offerBiometricAfterLogin(username, password) {
  return new Promise(async resolve => {
    const status = await getBiometricStatus();
    if (!status.available) {
      resolve();
      return;
    }

    if (status.enabled) {
      try {
        await saveCredentials(username, password);
      } catch (error) {
        console.warn('Could not update biometric credentials:', error?.message || error);
      }
      resolve();
      return;
    }

    Alert.alert(
      `Enable ${status.label}?`,
      `Use ${status.label} to sign in next time. After 2 failed attempts, you can sign in with your password.`,
      [
        { text: 'Not now', style: 'cancel', onPress: resolve },
        {
          text: 'Enable',
          onPress: async () => {
            const result = await authenticateWithBiometrics(`Confirm ${status.label} to enable`);
            if (result.success) {
              try {
                await saveCredentials(username, password);
              } catch (error) {
                Alert.alert('Unable to enable', `Could not save ${status.label} on this device.`);
              }
            }
            resolve();
          },
        },
      ],
    );
  });
}
