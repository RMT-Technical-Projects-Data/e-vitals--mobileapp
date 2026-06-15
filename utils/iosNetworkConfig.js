import { Platform, NativeModules } from 'react-native';

class IOSNetworkConfig {
  static setup() {
    if (Platform.OS === 'ios') {
      try {
        if (NativeModules.NetworkConfig) {
          NativeModules.NetworkConfig.setupNetworkConfiguration();
          console.log('iOS Network configuration initialized');
        } else {
          console.warn('NetworkConfig native module not found');
        }
      } catch (error) {
        console.log('iOS Network config setup failed:', error);
      }
    }
  }
  
  static async clearCookies() {
    if (Platform.OS === 'ios' && NativeModules.NetworkConfig) {
      try {
        await NativeModules.NetworkConfig.clearCookies();
        return true;
      } catch (error) {
        console.log('Error clearing iOS cookies:', error);
        return false;
      }
    }
    return false;
  }
  
  static async getCookies(domain) {
    if (Platform.OS === 'ios' && NativeModules.NetworkConfig) {
      try {
        return await NativeModules.NetworkConfig.getCookies(domain);
      } catch (error) {
        console.log('Error getting iOS cookies:', error);
        return [];
      }
    }
    return [];
  }
  
  static async setCookie(name, value, domain, path = '/', secure = true) {
    if (Platform.OS === 'ios' && NativeModules.NetworkConfig) {
      try {
        return await NativeModules.NetworkConfig.setCookie(name, value, domain, path, secure);
      } catch (error) {
        console.log('Error setting iOS cookie:', error);
        return false;
      }
    }
    return false;
  }
  
  static async checkSessionCookie() {
    if (Platform.OS === 'ios') {
      const cookies = await this.getCookies('13.233.6.224');
      const sessionCookie = cookies.find(cookie => 
        cookie.name.includes('session') || 
        cookie.name.includes('auth') ||
        cookie.name.includes('token')
      );
      
      console.log('iOS Session check:', {
        totalCookies: cookies.length,
        hasSessionCookie: !!sessionCookie,
        sessionCookie: sessionCookie ? `${sessionCookie.name}=...` : null
      });
      
      return !!sessionCookie;
    }
    return true; // Android works fine
  }
}

export default IOSNetworkConfig;