import React, { useState, useEffect } from 'react';
import { Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import MainScreen from '../screens/MainScreen';
import ChatMainScreen from '../screens/ChatMainScreen';
import NewWinScreen from '../screens/NewWinScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import NewChatScreen from '../screens/NewChatScreen';
import FindScreen from '../screens/FindScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const TabNavigator = ({ navigation }) => {
  const [profilePicture, setProfilePicture] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      console.log('TabNavigator auth state:', user ? 'logged in' : 'logged out');
      setIsAuthenticated(!!user);
      
      if (!user) {
        // If no user, navigate to Login
        navigation.replace('Login');
        return;
      }

      // Fetch profile picture only if authenticated
      const fetchProfilePicture = async () => {
        try {
          const uid = user.uid.toLowerCase();
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setProfilePicture(userData.profilePicture);
          }
        } catch (error) {
          console.error('Error fetching profile picture:', error);
        }
      };

      fetchProfilePicture();
    });

    return () => unsubscribe();
  }, [navigation]);

  // If not authenticated, return null (navigation to Login will happen in useEffect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#24269B',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          paddingBottom: 5,
          height: 75,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          paddingBottom: 5,
          flexWrap: 'wrap',
          textAlign: 'center',
          maxWidth: '100%',
          paddingHorizontal: 1,
        },
        tabBarAllowFontScaling: true,
        tabBarItemStyle: {
          paddingVertical: 5,
          height: '100%',
        },
        tabBarIconStyle: {
          marginTop: 5,
        }
      }}
    >
      <Tab.Screen
        name="Home"
        component={MainScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Image
              source={focused ? require('../../assets/bottom-nav-images/home-active.png') 
                            : require('../../assets/bottom-nav-images/home-inactive.png')}
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel="Home feed tab"
            />
          ),
          tabBarAccessibilityLabel: "Home feed",
          tabBarAccessibilityHint: "Navigate to your home feed",
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatMainScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Image
              source={focused ? require('../../assets/bottom-nav-images/chat-active.png')
                            : require('../../assets/bottom-nav-images/chat-inactive.png')}
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel="Chat tab"
            />
          ),
          tabBarAccessibilityLabel: "Chat",
          tabBarAccessibilityHint: "Navigate to your chats",
        }}
      />
      <Tab.Screen
        name="New Win"
        component={NewWinScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Image
              source={focused ? require('../../assets/bottom-nav-images/plus-active.png')
                            : require('../../assets/bottom-nav-images/plus-inactive.png')}
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel="Add new win tab"
            />
          ),
          tabBarAccessibilityLabel: "Add new win",
          tabBarAccessibilityHint: "Create a new win post",
        }}
      />
      <Tab.Screen
        name="Find"
        component={FindScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Image
              source={focused ? require('../../assets/bottom-nav-images/find-active.png')
                            : require('../../assets/bottom-nav-images/find-inactive.png')}
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel="Find tab"
            />
          ),
          tabBarAccessibilityLabel: "Find",
          tabBarAccessibilityHint: "Search and discover new content",
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            profilePicture ? (
              <Image
                source={{ uri: profilePicture }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  borderWidth: focused ? 2 : 0,
                  borderColor: '#24269B'
                }}
                resizeMode="cover"
                accessible={true}
                accessibilityRole="image"
                accessibilityLabel="Your profile picture"
              />
            ) : (
              <Image
                source={focused ? 
                  require('../../assets/bottom-nav-images/profile-active.png') :
                  require('../../assets/bottom-nav-images/profile-inactive.png')
                }
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
                accessible={true}
                accessibilityRole="image"
                accessibilityLabel="Profile tab"
              />
            )
          ),
          tabBarAccessibilityLabel: "Profile",
          tabBarAccessibilityHint: "View and edit your profile",
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator; 