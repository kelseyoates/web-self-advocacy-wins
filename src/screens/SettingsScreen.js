import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  SafeAreaView,
  AccessibilityInfo
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';


const SettingsScreen = () => {
  const navigation = useNavigation();
  const [userSubscription, setUserSubscription] = useState(null);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [userData, setUserData] = useState(null);

  // Add screen reader detection
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

  const fetchUserSubscription = async () => {
    try {
      const userId = auth.currentUser.uid.toLowerCase();
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setUserSubscription(userDoc.data().subscriptionType);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  // Add focus listener to refresh data
  useEffect(() => {
    fetchUserSubscription(); // Initial fetch

    // Set up focus listener
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUserSubscription(); // Fetch when screen comes into focus
    });

    // Cleanup
    return unsubscribe;
  }, [navigation]);

  const handleSubscriptionPress = () => {
    if (!userSubscription || userSubscription === 'selfAdvocateFree') {
      navigation.navigate('SubscriptionOptions');
    } else {
      navigation.navigate('ManageSubscription');
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => announceToScreenReader("Sign out cancelled")
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              announceToScreenReader("Signing out");
              await signOut(auth);
            } catch (error) {
              announceToScreenReader("Failed to sign out");
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Add this effect to fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        if (auth.currentUser) {
          const userDocRef = doc(db, 'users', auth.currentUser.uid.toLowerCase());
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUserData(data);
            console.log('Fetched profile picture:', data.profilePicture);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

  return (
    <View 
      style={styles.container}
      accessible={true}
      accessibilityLabel="Settings Screen"
    >
      <View 
        style={styles.content}
        accessible={true}
        accessibilityRole="menu"
      >
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              announceToScreenReader("Opening People screen");
              navigation.navigate('People');
            }}
            accessible={true}
            accessibilityRole="menuitem"
            accessibilityLabel="Followers and Following"
            accessibilityHint="Navigate to manage your followers and following"
          >
            <Image 
              source={require('../../assets/followers-following.png')}
              style={styles.menuIcon}
              accessible={true}
              accessibilityLabel="People icon"
              accessibilityRole="image"
            />
            <Text style={styles.menuItemText}>Followers and Following</Text>
            <MaterialCommunityIcons 
              name="chevron-right" 
              size={24} 
              color="#666"
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              announceToScreenReader(`Opening ${!userSubscription || userSubscription === 'selfAdvocateFree' ? 'subscription options' : 'subscription management'}`);
              handleSubscriptionPress();
            }}
            accessible={true}
            accessibilityRole="menuitem"
            accessibilityLabel={!userSubscription || userSubscription === 'selfAdvocateFree' ? 'Upgrade Subscription' : 'Manage Subscription'}
            accessibilityHint={!userSubscription || userSubscription === 'selfAdvocateFree' ? 'View subscription upgrade options' : 'Manage your current subscription'}
          >
            <Image 
              source={require('../../assets/credit-card.png')}
              style={styles.menuIcon}
              accessible={true}
              accessibilityLabel="Subscription icon"
              accessibilityRole="image"
            />
            <Text style={styles.menuItemText}>
              {!userSubscription || userSubscription === 'selfAdvocateFree' 
                ? 'Upgrade Subscription' 
                : 'Manage Subscription'}
            </Text>
            <MaterialCommunityIcons 
              name="chevron-right" 
              size={24} 
              color="#666"
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              announceToScreenReader("Opening Supporters management");
              navigation.navigate('SupporterManagement');
            }}
            accessible={true}
            accessibilityRole="menuitem"
            accessibilityLabel="My Supporters"
            accessibilityHint="Manage your supporters"
          >
            <Image 
              source={require('../../assets/supporter-1.png')}
              style={styles.menuIcon}
              accessible={true}
              accessibilityLabel="Supporters icon"
              accessibilityRole="image"
            />
            <Text style={styles.menuItemText}>My Supporters</Text>
            <MaterialCommunityIcons 
              name="chevron-right" 
              size={24} 
              color="#666"
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              announceToScreenReader("Opening Who I'm Supporting dashboard");
              navigation.navigate('SupporterDashboard');
            }}
            accessible={true}
            accessibilityRole="menuitem"
            accessibilityLabel="Who I'm Supporting"
            accessibilityHint="View people you are supporting"
          >
            <Image 
              source={require('../../assets/people.png')}
              style={styles.menuIcon}
              accessible={true}
              accessibilityLabel="Supporting icon"
              accessibilityRole="image"
            />
            <Text style={styles.menuItemText}>Who I'm Supporting</Text>
            <MaterialCommunityIcons 
              name="chevron-right" 
              size={24} 
              color="#666"
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
          </TouchableOpacity>


          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              announceToScreenReader("Opening the communities screen");
              navigation.navigate('Community');
            }}
            accessible={true}
            accessibilityRole="menuitem"
            accessibilityLabel="Communities"
            accessibilityHint="Join or create communities"
          >
            <Image 
              source={require('../../assets/megaphone.png')}
              style={styles.menuIcon}
              accessible={true}
              accessibilityLabel="communities icon"
              accessibilityRole="image"
            />
            <Text style={styles.menuItemText}>Communities</Text>
            <MaterialCommunityIcons 
              name="chevron-right" 
              size={24} 
              color="#666"
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
          </TouchableOpacity>


          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              announceToScreenReader("Opening the notifications screen");
              navigation.navigate('NotificationSettings');
            }}
            accessible={true}
            accessibilityRole="menuitem"
            accessibilityLabel="Notifications"
            accessibilityHint="Update your notification settings"
          >
            <Image 
              source={require('../../assets/notifications.png')}
              style={styles.menuIcon}
              accessible={true}
              accessibilityLabel="notifications icon"
              accessibilityRole="image"
            />
            <Text style={styles.menuItemText}>Notifications</Text>
            <MaterialCommunityIcons 
              name="chevron-right" 
              size={24} 
              color="#666"
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              announceToScreenReader("Opening the accessibility screen");
              navigation.navigate('Accessibility');
            }}
            accessible={true}
            accessibilityRole="menuitem"
            accessibilityLabel="Accessibility"
            accessibilityHint="Update your accessibility settings"
          >
            <Image 
              source={require('../../assets/accessibility.png')}
              style={styles.menuIcon}
              accessible={true}
              accessibilityLabel="notifications icon"
              accessibilityRole="image"
            />
            <Text style={styles.menuItemText}>Accessibility</Text>
            <MaterialCommunityIcons 
              name="chevron-right" 
              size={24} 
              color="#666"
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
          </TouchableOpacity>


        </View>
      </View>

      <View 
        style={styles.signOutWrapper}
        accessible={true}
        accessibilityRole="button"
      >
        <SafeAreaView edges={['bottom']}>
          <TouchableOpacity 
            style={styles.signOutButton}
            onPress={handleSignOut}
            accessible={true}
            accessibilityLabel="Sign Out"
            accessibilityHint="Double tap to sign out of your account"
            accessibilityRole="button"
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuItemText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
  menuIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  signOutWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  signOutButton: {
    backgroundColor: '#ff4444',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingButton: {
    backgroundColor: '#ff4444',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  settingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;