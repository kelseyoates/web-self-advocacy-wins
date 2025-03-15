import { AppCheckProvider } from 'firebase/app-check';
import { Platform } from 'react-native';
import { playIntegrity } from '@react-native-firebase/app-check';

export class PlayIntegrityProvider extends AppCheckProvider {
  constructor() {
    super();
    console.log('Constructing PlayIntegrityProvider...');
    if (Platform.OS !== 'android') {
      throw new Error('PlayIntegrityProvider is only available on Android');
    }
    console.log('PlayIntegrityProvider constructed successfully');
  }

  async getToken() {
    console.log('Getting Play Integrity token...');
    try {
      console.log('Calling playIntegrity().getToken()...');
      const token = await playIntegrity().getToken();
      console.log('Successfully got Play Integrity token');
      return {
        token: token,
        expireTimeMillis: Date.now() + (60 * 60 * 1000), // 1 hour
      };
    } catch (error) {
      console.error('Error getting Play Integrity token:', error.message);
      console.error('Full error:', error);
      throw error;
    }
  }
} 