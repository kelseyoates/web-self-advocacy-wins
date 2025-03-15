import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, View, Text, StyleSheet } from 'react-native';
// Conditional import based on platform
const CometChat = Platform.OS === 'web' 
  ? require('@cometchat-pro/chat').CometChat
  : require('@cometchat-pro/react-native-chat').CometChat;
import { COMETCHAT_CONSTANTS } from './src/config/cometChatConfig';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import TabNavigator from './src/navigation/TabNavigator';
import ChatConversationScreen from './src/screens/ChatConversationScreen';
import NewChatScreen from './src/screens/NewChatScreen';
import GroupChatSetupScreen from './src/screens/GroupChatSetupScreen';
import FindYourFriendsScreen from './src/screens/FindYourFriendsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OtherUserProfileScreen from './src/screens/OtherUserProfileScreen';
import GroupChatScreen from './src/screens/GroupChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PeopleScreen from './src/screens/PeopleScreen';
import MainNavigator from './src/navigation/MainNavigator';
import SupporterManagementScreen from './src/screens/SupporterManagementScreen';
import AddSupporterScreen from './src/screens/AddSupporterScreen';
import SupporterDashboardScreen from './src/screens/SupporterDashboardScreen';
import SubscriptionOptionsScreen from './src/screens/SubscriptionOptionsScreen';
import FindADateScreen from './src/screens/FindADateScreen';
import ManageSubscriptionScreen from './src/screens/ManageSubscriptionScreen';
import SupportedUserChatScreen from './src/screens/SupportedUserChatScreen';
import SupportedUserChatDetailsScreen from './src/screens/SupportedUserChatDetailsScreen';
import SupportedUserGroupChatDetailsScreen from './src/screens/SupportedUserGroupChatDetailsScreen';
import CommunityScreen from './src/screens/CommunityScreen';
import CreateCommunityScreen from './src/screens/CreateCommunityScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import ViewWinScreen from './src/screens/ViewWinScreen';
import AccessibilityScreen from './src/screens/AccessibilityScreen';

import { AuthProvider } from './src/contexts/AuthContext';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AccessibilityProvider } from './src/context/AccessibilityContext';
import React from 'react';

const Stack = createNativeStackNavigator();

// Detect if running on web
const isWeb = Platform.OS === 'web';

// Initialize CometChat for both web and mobile
const appSettings = new CometChat.AppSettingsBuilder()
  .subscribePresenceForAllUsers()
  .setRegion(COMETCHAT_CONSTANTS.REGION)
  .enableAutoJoinForGroups(true)  // Add this for better group chat handling
  .build();

// Initialize CometChat
const initCometChat = async () => {
  try {
    const response = await CometChat.init(COMETCHAT_CONSTANTS.APP_ID, appSettings);
    console.log("CometChat initialization successful:", response);
    
    if (isWeb) {
      console.log("CometChat initialized for web platform");
      // Set source for analytics and debugging
      CometChat.setSource('web-saw', Platform.OS, 'react-native');
      
      // Enable WebSocket for real-time communication on web
      await CometChat.enableWebSocket(true);
      
      // Register service worker if available (for web push notifications)
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/cometchat-sw.js');
          console.log('Service worker registered:', registration);
        } catch (error) {
          console.error('Service worker registration failed:', error);
        }
      }
    }
  } catch (error) {
    console.log("CometChat initialization failed:", error);
    
    if (isWeb) {
      console.error("CometChat web initialization error:", error);
    }
  }
};

// Call initialization
initCometChat();

// Web placeholder for advanced chat-related screens that aren't fully compatible with web yet
const WebChatPlaceholder = () => (
  <View style={styles.webPlaceholder}>
    <Text style={styles.webPlaceholderTitle}>Feature Coming Soon</Text>
    <Text style={styles.webPlaceholderText}>
      This feature is currently being optimized for web. 
      For the best experience, please use our mobile app.
    </Text>
  </View>
);

export default function App() {
  const navigationRef = React.useRef();

  useEffect(() => {
    // Handle deep links when app is already open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Handle deep links when app is opened from closed state
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = ({ url }) => {
    if (!url) return;

    try {
      let pathParts;
      
      if (url.startsWith('selfadvocatelink://')) {
        // Handle custom scheme URL
        pathParts = url.replace('selfadvocatelink://', '').split('/').filter(Boolean);
      } else {
        // Handle standard URLs
        const urlObj = new URL(url);
        pathParts = urlObj.pathname.split('/').filter(Boolean);
      }

      // Example URLs: 
      // selfadvocatelink://win/123
      // https://selfadvocatelink.app/win/123
      if (pathParts[0] === 'win' && pathParts[1]) {
        const winId = pathParts[1];
        // Navigate to the specific win using the ref
        navigationRef.current?.navigate('ViewWin', { winId });
      }
    } catch (error) {
      console.error('Error parsing deep link:', error);
    }
  };

  return (
    <AccessibilityProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          
            <Stack.Navigator initialRouteName="Login">
              <Stack.Screen 
                name="Login" 
                component={LoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="SignUp" 
                component={SignUpScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Main"
                component={TabNavigator}
                options={{ headerShown: false }}
              />
              
              {/* Update chat-related screens for web compatibility */}
              <Stack.Screen
                name="ChatConversation"
                component={ChatConversationScreen}
                options={{ title: 'Chat' }}
              />
              <Stack.Screen
                name="NewChat"
                component={NewChatScreen}
                options={{ title: 'New Chat' }}
              />
              <Stack.Screen
                name="GroupChatSetup"
                component={isWeb ? WebChatPlaceholder : GroupChatSetupScreen}
                options={{ title: 'Group Chat Setup' }}
              />
              <Stack.Screen
                name="GroupChat"
                component={isWeb ? WebChatPlaceholder : GroupChatScreen}
                options={{ title: 'Group Chat' }}
              />
              <Stack.Screen
                name="SupportedUserChat"
                component={isWeb ? WebChatPlaceholder : SupportedUserChatScreen}
                options={{ title: 'Chat' }}
              />
              <Stack.Screen
                name="SupportedUserChatDetails"
                component={isWeb ? WebChatPlaceholder : SupportedUserChatDetailsScreen}
                options={{ title: 'Chat Details' }}
              />
              <Stack.Screen
                name="SupportedUserGroupChatDetails"
                component={isWeb ? WebChatPlaceholder : SupportedUserGroupChatDetailsScreen}
                options={{ title: 'Group Chat Details' }}
              />
              
              <Stack.Screen
                name="MainNavigator"
                component={MainNavigator}
                options={{ headerShown: false }}
              />
              
              <Stack.Screen
                name="FindYourFriends"
                component={FindYourFriendsScreen}
                options={{ title: 'Find Your Friends' }}
              />
            
              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ title: 'Your Profile' }}
              />
              <Stack.Screen
                name="OtherUserProfile"
                component={OtherUserProfileScreen}
                options={({ route }) => ({
                  title: route.params?.username ? `${route.params.username}'s Profile` : 'Profile',
                })}
              />
              
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ title: 'Menu' }}
              />
              <Stack.Screen
                name="People"
                component={PeopleScreen}
                options={{ title: 'Followers and Following' }}
              />
           
              <Stack.Screen
                name="SupporterManagement"
                component={SupporterManagementScreen}
                options={{ title: 'Supporters' }}
              />
              <Stack.Screen
                name="AddSupporter"
                component={AddSupporterScreen}
                options={{ title: 'Add Supporter' }}
              />
              <Stack.Screen
                name="SupporterDashboard"
                component={SupporterDashboardScreen}
                options={{ title: 'Supporter Dashboard' }}
              />
              <Stack.Screen
                name="SubscriptionOptions"
                component={SubscriptionOptionsScreen}
                options={{ title: 'Subscription Options' }}
              />
              <Stack.Screen
                name="FindADate"
                component={FindADateScreen}
                options={{ title: 'Find a Date' }}
              />
              <Stack.Screen
                name="ManageSubscription"
                component={ManageSubscriptionScreen}
                options={{ title: 'Manage Subscription' }}
              />
              
              <Stack.Screen
                name="Community"
                component={CommunityScreen}
                options={{ title: 'Community' }}
              />
              <Stack.Screen
                name="CreateCommunity"
                component={CreateCommunityScreen}
                options={{ title: 'Create Community' }}
              />
              <Stack.Screen
                name="NotificationSettings"
                component={NotificationSettingsScreen}
                options={{ title: 'Notification Settings' }}
              />
              <Stack.Screen
                name="ViewWin"
                component={ViewWinScreen}
                options={{ title: 'View Win' }}
              />
              <Stack.Screen
                name="Accessibility"
                component={AccessibilityScreen}
                options={{ title: 'Accessibility' }}
              />

            </Stack.Navigator>
         
        </NavigationContainer>
      </AuthProvider>
    </AccessibilityProvider>
  );
}

const styles = StyleSheet.create({
  webPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  webPlaceholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#24269B',
  },
  webPlaceholderText: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 24,
  }
});