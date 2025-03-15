import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { firebase } from './firebaseConfig';
import LoginScreen from './LoginScreen';
import SignUpScreen from './SignUpScreen';
import MainScreen from './MainScreen'; // Your app's main screen
import GroupChatScreen from '../screens/GroupChatScreen';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { TouchableOpacity } from 'react-native';


const Stack = createStackNavigator();

const AppNavigator = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged(user => {
      setIsAuthenticated(!!user);
    });
    return unsubscribe;
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainScreen} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        )}
        
        {/* Chat Stack */}
        <Stack.Screen 
          name="Chat" 
          component={ChatMainScreen}
          options={{
            title: 'Messages',
            // ... your existing options
          }}
        />
        <Stack.Screen 
          name="ChatConversation" 
          component={ChatConversationScreen}
          options={{
            title: 'Chat',
            // ... your existing options
          }}
        />
        <Stack.Screen 
          name="GroupChat" 
          component={GroupChatScreen}
          options={({ route }) => ({
            title: route.params?.name || 'Group Chat'
          })}
        />
        <Stack.Screen 
          name="NewChat" 
          component={NewChatScreen}
          options={{
            title: 'New Chat',
            // ... your existing options
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;