import FindFriendScreen from '../screens/FindFriendScreen';
import FriendResultsScreen from '../screens/FriendResultsScreen';

const Stack = createStackNavigator();

const StackNavigator = () => {
  return (
    <Stack.Navigator>
      {/* ... existing screens ... */}
      <Stack.Screen 
        name="FindFriend" 
        component={FindFriendScreen}
        options={{ title: 'Find a Friend' }}
      />
      <Stack.Screen 
        name="FriendResults" 
        component={FriendResultsScreen}
        options={{ title: 'Potential Friends' }}
      />
    </Stack.Navigator>
  );
}; 