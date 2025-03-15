import Constants from 'expo-constants';

// Debugging: log the entire Constants object
console.log('Constants:', Constants);

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// For now, let's keep the original config while we debug the environment setup
console.log('Firebase Config:', firebaseConfig);

export default firebaseConfig;