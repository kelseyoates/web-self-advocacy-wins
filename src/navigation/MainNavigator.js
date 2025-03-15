import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TabNavigator from './TabNavigator';
import FindYourFriendsScreen from '../screens/FindYourFriendsScreen';
import FriendResultsScreen from '../screens/FriendResultsScreen';

const Stack = createStackNavigator();

const MainNavigator = () => {
  console.log('MainNavigator rendering');
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="TabScreens"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="FindYourFriends"
        component={FindYourFriendsScreen}
        options={{ 
          title: 'Find a Friend',
          headerShown: true 
        }}
      />
      <Stack.Screen 
        name="FriendResults"
        component={FriendResultsScreen}
        options={{ 
          title: 'Potential Friends',
          headerShown: true 
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator; 