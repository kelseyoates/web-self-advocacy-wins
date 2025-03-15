import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const initializeNotifications = async () => {
  try {
    // Request permission
    const authStatus = await messaging().requestPermission();
    const enabled = 
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      // Get FCM token
      const token = await messaging().getToken();
      
      // Save token to user's document
      if (token) {
        const userId = auth().currentUser?.uid;
        if (userId) {
          await updateDoc(doc(db, 'users', userId.toLowerCase()), {
            fcmToken: token,
            platform: Platform.OS
          });
        }
      }
    }
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
};

export const sendSubscriptionNotification = async (userId, message) => {
  try {
    // Call your backend to send the notification
    await fetch('your-backend-url/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        message,
        type: 'subscription'
      }),
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

// Set up notification handlers
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Received background message:', remoteMessage);
  // Handle background messages here
});

messaging().onMessage(async remoteMessage => {
  console.log('Received foreground message:', remoteMessage);
  // Handle foreground messages here
}); 