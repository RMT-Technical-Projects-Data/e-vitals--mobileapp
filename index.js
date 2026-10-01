/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { handleBackgroundMessage, handleNotificationBackgroundEvent } from './src/services/pushNotificationService';

messaging().setBackgroundMessageHandler(handleBackgroundMessage);
notifee.onBackgroundEvent(handleNotificationBackgroundEvent);

AppRegistry.registerComponent(appName, () => App);
