import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Platform,
  ScrollView
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

const FriendResultsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { matches } = route.params;
  const isWeb = Platform.OS === 'web';

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

  const renderUserCard = ({ item }) => (
    <TouchableOpacity 
      style={[styles.userCard, isWeb && styles.webUserCard]}
      onPress={() => handleUserPress(item)}
      accessible={true}
      accessibilityLabel={`View ${item.username}'s profile`}
      accessibilityRole="button"
    >
      <Image 
        source={{ uri: item.profilePicture }}
        style={[styles.profilePicture, isWeb && styles.webProfilePicture]}
        accessible={true}
        accessibilityLabel={`${item.username}'s profile picture`}
      />
      <View style={[styles.friendInfo, isWeb && styles.webFriendInfo]}>
        <Text style={[styles.username, isWeb && styles.webUsername]}>{item.username}</Text>
        <Text style={[styles.state, isWeb && styles.webState]}>{item.state}</Text>
        <Text style={[styles.matchDetails, isWeb && styles.webMatchDetails]}>
          Matching interests: {item._highlightResult?.questionAnswers?.length || 0}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const ResultsList = isWeb ? ScrollView : FlatList;
  const listProps = isWeb ? {
    contentContainerStyle: styles.webListContainer
  } : {
    data: matches,
    keyExtractor: (item) => item.objectID,
    renderItem: renderUserCard
  };

  return (
    <View style={[styles.container, isWeb && styles.webContainer]}>
      <View style={[styles.headerContainer, isWeb && styles.webHeaderContainer]}>
        <Text style={[styles.header, isWeb && styles.webHeader]}>
          Found {matches.length} potential friends
        </Text>
      </View>
      
      <ResultsList {...listProps}>
        {isWeb ? (
          <View style={styles.webGrid}>
            {matches.map((item) => (
              <View key={item.objectID} style={styles.webGridItem}>
                {renderUserCard({ item })}
              </View>
            ))}
          </View>
        ) : null}
      </ResultsList>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerContainer: {
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
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

  // Web-specific styles
  webContainer: {
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  webHeaderContainer: {
    backgroundColor: '#ffffff',
    padding: 24,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    marginBottom: 24,
  },
  webHeader: {
    fontSize: 28,
    color: '#24269B',
    textAlign: 'center',
    maxWidth: 1200,
    marginHorizontal: 'auto',
  },
  webListContainer: {
    maxWidth: 1200,
    marginHorizontal: 'auto',
    padding: 24,
  },
  webGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 24,
    padding: 16,
  },
  webGridItem: {
    display: 'flex',
  },
  webUserCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    flex: 1,
    ':hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },
  },
  webProfilePicture: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 20,
  },
  webFriendInfo: {
    marginLeft: 0,
    marginTop: 16,
  },
  webUsername: {
    fontSize: 20,
    fontWeight: '600',
    color: '#24269B',
    marginBottom: 8,
  },
  webState: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  webMatchDetails: {
    fontSize: 16,
    color: '#24269B',
    fontWeight: '500',
  },
});

export default FriendResultsScreen; 