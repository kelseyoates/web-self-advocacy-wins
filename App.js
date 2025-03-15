import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CometChat } from '@cometchat-pro/react-native-chat';
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

const Stack = createNativeStackNavigator();

const appSettings = new CometChat.AppSettingsBuilder()
  .subscribePresenceForAllUsers()
  .setRegion(COMETCHAT_CONSTANTS.REGION)
  .build();

// Initialize CometChat
const initCometChat = async () => {
  try {
    const response = await CometChat.init(COMETCHAT_CONSTANTS.APP_ID, appSettings);
    console.log("CometChat initialization successful:", response);
  } catch (error) {
    console.log("CometChat initialization failed:", error);
  }
};

// Call initialization
initCometChat();

export default function App() {
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

    // Parse the URL
    const { path, queryParams } = Linking.parse(url);

    // Example URL: selfadvocatelink://win/123
    if (path) {
      const parts = path.split('/');
      if (parts[0] === 'win' && parts[1]) {
        const winId = parts[1];
        // Navigate to the specific win
        navigation.navigate('ViewWin', { winId });
      }
    }
  };

  return (
    <AccessibilityProvider>
      <AuthProvider>
        <NavigationContainer>
          
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
              <Stack.Screen
                name="ChatConversation"
                component={ChatConversationScreen}
                options={{ title: '' }}
              />
              <Stack.Screen
                name="NewChat"
                component={NewChatScreen}
                options={{ title: '' }}
              />
            
              <Stack.Screen
                name="GroupChatSetup"
                component={GroupChatSetupScreen}
                options={{ title: '' }}
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
                name="GroupChat"
                component={GroupChatScreen}
                options={{ title: 'Group Chat' }}
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
                name="SupportedUserChat"
                component={SupportedUserChatScreen}
                options={{ title: 'Chat' }}
              />
              <Stack.Screen
                name="SupportedUserChatDetails"
                component={SupportedUserChatDetailsScreen}
                options={{ title: 'Chat Details' }}
              />
              <Stack.Screen
                name="SupportedUserGroupChatDetails"
                component={SupportedUserGroupChatDetailsScreen}
                options={{ title: 'Group Chat Details' }}
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