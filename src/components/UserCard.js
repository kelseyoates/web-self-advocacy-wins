import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const UserCard = ({ user }) => {
  const navigation = useNavigation();

  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('Profile', { userId: user.id })}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${user.name}'s profile card${user.state ? ` from ${user.state}` : ''}`}
      accessibilityHint="Double tap to view full profile"
    >
      <View 
        style={styles.userInfo}
        accessible={true}
        accessibilityRole="text"
      >
        <View style={styles.avatarContainer}>
          {user.profilePicture ? (
            <Image 
              source={{ uri: user.profilePicture }} 
              style={styles.avatar}
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel={`${user.name}'s profile picture`}
            />
          ) : (
            <View 
              style={[styles.avatar, styles.defaultAvatar]}
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel={`${user.name}'s default profile picture showing the letter ${user.name ? user.name[0].toUpperCase() : '?'}`}
            >
              <Text style={styles.defaultAvatarText}>
                {user.name ? user.name[0].toUpperCase() : '?'}
              </Text>
            </View>
          )}
        </View>
        <View 
          style={styles.userDetails}
          accessible={true}
          accessibilityRole="text"
        >
          <Text 
            style={styles.userName}
            accessibilityRole="text"
          >
            {user.name}
          </Text>
          {user.state && (
            <Text 
              style={styles.userLocation}
              accessibilityRole="text"
            >
              {user.state}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    marginVertical: 5,
    marginHorizontal: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minHeight: 80, // Ensure minimum touch target size
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    backgroundColor: '#24269B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#000', // Ensure good contrast
  },
  userLocation: {
    fontSize: 14,
    color: '#666',
  },
});

export default UserCard; 