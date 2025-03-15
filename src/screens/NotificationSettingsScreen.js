import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  AccessibilityInfo
} from 'react-native';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { CometChat } from '@cometchat-pro/react-native-chat';

const NotificationSettingsScreen = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    privateChats: false,
    publicChats: false,
    supportedWins: false
  });
  const [isSupporter, setIsSupporter] = useState(false);
  const lowerCaseUid = user?.uid?.toLowerCase();
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);

  useEffect(() => {
    loadNotificationSettings();
    checkIfSupporter();
  }, []);

  useEffect(() => {
    const checkScreenReader = async () => {
      const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      setIsScreenReaderEnabled(screenReaderEnabled);
    };

    checkScreenReader();
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsScreenReaderEnabled
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const announceToScreenReader = (message) => {
    if (isScreenReaderEnabled) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  };

  const checkIfSupporter = async () => {
    try {
      if (!lowerCaseUid) {
        console.log('No UID available');
        return;
      }

      console.log('Checking supporter status for UID:', lowerCaseUid);

      // Query all users to find if current user is in any user's supporters array
      const usersRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersRef);
      
      let isSupporterForAnyUser = false;
      
      querySnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.supporters) {
          const isSupporter = userData.supporters.some(
            supporter => supporter.id.toLowerCase() === lowerCaseUid
          );
          if (isSupporter) {
            console.log('Found as supporter for user:', doc.id);
            isSupporterForAnyUser = true;
          }
        }
      });

      setIsSupporter(isSupporterForAnyUser);
      console.log('Final supporter status:', isSupporterForAnyUser);

    } catch (error) {
      console.error('Error checking supporter status:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
    }
  };

  const loadNotificationSettings = async () => {
    try {
      if (!lowerCaseUid) return;
      
      const userDoc = await getDoc(doc(db, 'users', lowerCaseUid, 'settings', 'notifications'));
      if (userDoc.exists()) {
        setSettings(userDoc.data());
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const updateNotificationSetting = async (type, value) => {
    try {
      if (!lowerCaseUid) {
        console.error('No user UID available');
        return;
      }

      console.log('Updating notification settings:', { type, value, lowerCaseUid });
      
      setSettings(prev => {
        const newSettings = { ...prev, [type]: value };
        console.log('New settings state:', newSettings);
        return newSettings;
      });
      
      const notificationRef = doc(db, 'users', lowerCaseUid, 'settings', 'notifications');
      console.log('Firestore document path:', notificationRef.path);

      const updateData = {
        ...settings,
        [type]: value,
        updatedAt: new Date().toISOString()
      };
      console.log('Updating Firestore with data:', updateData);

      await setDoc(notificationRef, updateData, { merge: true });
      console.log('Firestore update successful');

      // Handle CometChat notifications for chat settings
      if (type === 'privateChats' || type === 'publicChats') {
        await CometChat.registerTokenForPushNotification(
          value ? 'all' : 'none',
          type === 'privateChats' ? CometChat.RECEIVER_TYPE.USER : CometChat.RECEIVER_TYPE.GROUP
        );
      }

      console.log('All updates completed successfully');

    } catch (error) {
      console.error('Error updating notification settings:', error);
      Alert.alert('Error', 'Failed to update notification settings');
      setSettings(prev => ({ ...prev, [type]: !value }));
    }
  };

  if (loading) {
    return (
      <View 
        style={styles.loadingContainer}
        accessible={true}
        accessibilityLabel="Loading notification settings"
      >
        <ActivityIndicator size="large" color="#24269B" />
      </View>
    );
  }

  return (
    <View 
      style={styles.container}
      accessible={true}
      accessibilityLabel="Notification settings screen"
    >
      <View 
        style={styles.section}
        accessible={true}
        accessibilityRole="header"
      >
        <Text 
          style={styles.sectionTitle}
          accessibilityRole="header"
        >
          Chat Notifications
        </Text>
        
        <View 
          style={styles.settingItem}
          accessible={true}
          accessibilityRole="switch"
          accessibilityLabel={`Get notified when you receive a new private chat message. ${settings.privateChats ? 'Enabled' : 'Disabled'}`}
          accessibilityHint="Double tap to toggle private chat notifications"
        >
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>New Private Chat Messages</Text>
            <Text 
              style={styles.settingDescription}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            >
              Receive notifications for private messages
            </Text>
          </View>
          <Switch
            value={settings.privateChats}
            onValueChange={(value) => {
              updateNotificationSetting('privateChats', value);
              announceToScreenReader(`Private chat notifications ${value ? 'enabled' : 'disabled'}`);
            }}
            trackColor={{ false: '#767577', true: '#24269B' }}
            thumbColor={settings.privateChats ? '#fff' : '#f4f3f4'}
            accessible={true}
            accessibilityRole="switch"
          />
        </View>

        <View 
          style={styles.settingItem}
          accessible={true}
          accessibilityRole="switch"
          accessibilityLabel={`Get notified when you receive a new community message. ${settings.publicChats ? 'Enabled' : 'Disabled'}`}
          accessibilityHint="Double tap to toggle community chat notifications"
        >
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>New Community Messages</Text>
            <Text 
              style={styles.settingDescription}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            >
              Receive notifications for community messages
            </Text>
          </View>
          <Switch
            value={settings.publicChats}
            onValueChange={(value) => {
              updateNotificationSetting('publicChats', value);
              announceToScreenReader(`Public chat notifications ${value ? 'enabled' : 'disabled'}`);
            }}
            trackColor={{ false: '#767577', true: '#24269B' }}
            thumbColor={settings.publicChats ? '#fff' : '#f4f3f4'}
            accessible={true}
            accessibilityRole="switch"
          />
        </View>

        {isSupporter && (
          <View 
            style={styles.settingItem}
            accessible={true}
            accessibilityRole="switch"
            accessibilityLabel={`Supported User Wins. ${settings.supportedWins ? 'Enabled' : 'Disabled'}`}
            accessibilityHint="Double tap to toggle notifications for wins from users you support"
          >
            <View style={styles.settingLabelContainer}>
              <Text style={styles.settingLabel}>New Supported User Wins</Text>
              <Text 
                style={styles.settingDescription}
                accessibilityElementsHidden={true}
                importantForAccessibility="no"
              >
                Get notified when users you support post new wins
              </Text>
            </View>
            <Switch
              value={settings.supportedWins}
              onValueChange={(value) => {
                updateNotificationSetting('supportedWins', value);
                announceToScreenReader(`Supported user wins notifications ${value ? 'enabled' : 'disabled'}`);
              }}
              trackColor={{ false: '#767577', true: '#24269B' }}
              thumbColor={settings.supportedWins ? '#fff' : '#f4f3f4'}
              accessible={true}
              accessibilityRole="switch"
            />
          </View>
        )}
      </View>

      <Text 
        style={styles.disclaimer}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel="Note: You can customize which notifications you receive. Changes will apply to all your devices."
      >
        You can customize which notifications you receive. Changes will apply to all your devices.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#24269B',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  disclaimer: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  settingLabelContainer: {
    flex: 1,
    marginRight: 10,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

export default NotificationSettingsScreen; 