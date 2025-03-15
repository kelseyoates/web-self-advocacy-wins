import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

const FriendResultsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { matches } = route.params;

  const handleUserPress = (user) => {
    const userId = user.path.split('/')[1];
    console.log('DEBUG: Navigating to profile with user data:', {
      userId,
      username: user.username,
      path: user.path
    });
    
    navigation.navigate('Profile', {
      profileUserId: userId
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        Found {matches.length} potential friends
      </Text>
      <FlatList
        data={matches}
        keyExtractor={(item) => item.objectID}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.userCard}
            onPress={() => handleUserPress(item)}
          >
            <Image 
              source={{ uri: item.profilePicture }}
              style={styles.profilePicture}
            />
            <View style={styles.friendInfo}>
              <Text style={styles.username}>{item.username}</Text>
              <Text style={styles.state}>{item.state}</Text>
              <Text style={styles.matchDetails}>
                Matching interests: {item._highlightResult?.questionAnswers?.length || 0}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 15,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    padding: 10,
  },
  userCard: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profilePicture: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  friendInfo: {
    marginLeft: 15,
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  state: {
    color: '#666',
    marginTop: 4,
  },
  matchDetails: {
    color: '#24269B',
    marginTop: 4,
  },
});

export default FriendResultsScreen; 