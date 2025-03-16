import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { 
  initializeAuth, 
  getReactNativePersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  getAuth,
  setPersistence
} from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, CustomProvider } from 'firebase/app-check';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ENV from './environment'; // Import our direct environment file

// Add explicit console logs that will be visible in the browser
console.log('===== Firebase Module Loading =====');

// Detect if running on web
const isWeb = Platform.OS === 'web';
console.log(`Starting Firebase initialization on ${Platform.OS}...`);
console.log(`Is web platform: ${isWeb}`);

// Direct Firebase configuration using our environment variables
const firebaseConfig = {
  apiKey: ENV.FIREBASE_API_KEY,
  authDomain: ENV.FIREBASE_AUTH_DOMAIN,
  projectId: ENV.FIREBASE_PROJECT_ID,
  storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.FIREBASE_APP_ID,
  databaseURL: `https://${ENV.FIREBASE_PROJECT_ID}.firebaseio.com`
};

console.log('Firebase config project ID:', firebaseConfig.projectId);

// Define defaults for exports
let auth = null;
let db = null;
let storage = null;

try {
  // Initialize Firebase only if it hasn't been initialized already
  console.log('Initializing Firebase app...');
  console.log('Current apps:', getApps().length);
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  console.log('Firebase app initialized successfully');

  // Initialize Firebase services with appropriate persistence based on platform
  if (isWeb) {
    // For web platform, use browser persistence
    console.log('Initializing auth for web...');
    auth = getAuth(app);
    // Set persistence to browser local storage
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('Successfully set persistence for web');
      })
      .catch((error) => {
        console.error('Error setting persistence:', error);
      });
    console.log('Using browser persistence for web platform');
  } else {
    // For React Native platforms (iOS, Android), use AsyncStorage persistence
    console.log('Initializing auth for native...');
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
    console.log('Using React Native persistence for mobile platform');
  }

  console.log('Initializing Firestore...');
  db = getFirestore(app);
  console.log('Initializing Storage...');
  storage = getStorage(app);
  console.log('Firebase services initialized successfully');
  console.log('===== Firebase Module Loaded Successfully =====');
} catch (error) {
  console.error('CRITICAL ERROR initializing Firebase:', error);
  console.error('Stack trace:', error.stack);
  
  // Provide dummy exports to prevent app from crashing immediately
  auth = { currentUser: null };
  db = {};
  storage = {};
}

// Initialize App Check
if (!isWeb && Platform.OS === 'android') {
  try {
    console.log('Initializing App Check for Android...');
    
    // Use different providers for development and production
    const provider = new CustomProvider({
      getToken: async () => {
        if (__DEV__) {
          console.log('Using debug token for development');
          // Use the debug token we registered in Firebase Console
          return {
            token: '51B7C090-C685-4189-AB3D-EF226A8F3724',
            expireTimeMillis: Date.now() + (60 * 60 * 1000) // 1 hour
          };
        } else {
          try {
            const { default: appCheckModule } = await import('@react-native-firebase/app-check');
            const appCheck = appCheckModule();
            const token = await appCheck.getToken();
            return {
              token: token,
              expireTimeMillis: Date.now() + (60 * 60 * 1000)
            };
          } catch (error) {
            console.error('Error getting Play Integrity token:', error);
            throw error;
          }
        }
      }
    });

    const appCheck = initializeAppCheck(getApp(), {
      provider: provider,
      isTokenAutoRefreshEnabled: true
    });

    console.log('App Check initialized successfully');
  } catch (error) {
    console.error('Error setting up App Check:', error);
    console.error('Error details:', error.message);
  }
} else if (isWeb) {
  console.log('App Check not initialized for web platform');
  // You can add web-specific App Check here if needed
}

// Export everything in a single export statement
export { auth, db, storage, firebaseConfig }; 