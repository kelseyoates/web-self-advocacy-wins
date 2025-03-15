import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  AccessibilityInfo,
  Alert,
  KeyboardAvoidingView
} from 'react-native';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// Detect if running on web
const isWeb = Platform.OS === 'web';

const UserSearchScreen = ({ navigation, route }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const { user } = useAuth();
  const isGroup = route.params?.isGroup || false;
  
  // Initialize selected users from route params if available
  useEffect(() => {
    if (route.params?.selectedUsers) {
      setSelectedUsers(route.params.selectedUsers);
    }
  }, [route.params?.selectedUsers]);

  // Check for screen reader
  useEffect(() => {
    const checkScreenReader = async () => {
      try {
        const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
        setIsScreenReaderEnabled(screenReaderEnabled);
      } catch (error) {
        console.log('Error checking screen reader:', error);
        // On web, this might fail, so we'll assume false
        setIsScreenReaderEnabled(false);
      }
    };

    checkScreenReader();
    
    let subscription;
    try {
      subscription = AccessibilityInfo.addEventListener(
        'screenReaderChanged',
        setIsScreenReaderEnabled
      );
    } catch (error) {
      console.log('Error setting up accessibility listener:', error);
    }

    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, []);

  // Announce to screen reader
  const announceToScreenReader = (message) => {
    if (isScreenReaderEnabled && !isWeb) {
      AccessibilityInfo.announceForAccessibility(message);
    } else if (isWeb && isScreenReaderEnabled) {
      // For web with screen readers, we could use ARIA live regions
      setError(message);
    }
  };

  // Show alert with platform-specific handling
  const showAlert = (title, message) => {
    if (isWeb) {
      // For web, use a more web-friendly approach
      setError(message);
      // You could also use a modal or toast component here
    } else {
      // For mobile, use Alert
      Alert.alert(title, message);
    }
  };

  const searchUsers = async (text) => {
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      // Create a query to search for users by username
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('username', '>=', text.toLowerCase()),
        where('username', '<=', text.toLowerCase() + '\uf8ff'),
        limit(20)
      );

      const querySnapshot = await getDocs(q);
      const users = [];
      
      querySnapshot.forEach((doc) => {
        // Don't include the current user in search results
        if (doc.id !== user.uid.toLowerCase()) {
          users.push({
            id: doc.id,
            uid: doc.id, // Add uid for compatibility with CometChat
            ...doc.data()
          });
        }
      });

      setSearchResults(users);
      announceToScreenReader(`Found ${users.length} users`);
    } catch (error) {
      console.error('Error searching users:', error);
      setError('Failed to search users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserSelection = (user) => {
    setSelectedUsers(prevUsers => {
      const isSelected = prevUsers.some(u => u.id === user.id);
      
      if (isSelected) {
        // Remove user from selection
        announceToScreenReader(`Removed ${user.username} from selection`);
        return prevUsers.filter(u => u.id !== user.id);
      } else {
        // Add user to selection
        announceToScreenReader(`Added ${user.username} to selection`);
        return [...prevUsers, user];
      }
    });
  };

  const handleDone = () => {
    navigation.navigate('GroupChatSetup', { selectedUsers });
    announceToScreenReader(`Selected ${selectedUsers.length} users`);
  };

  const renderUserItem = ({ item }) => {
    const isSelected = selectedUsers.some(u => u.id === item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.userItem,
          isSelected && styles.selectedUserItem,
          isWeb && styles.webUserItem
        ]}
        onPress={() => {
          if (isGroup) {
            toggleUserSelection(item);
          } else {
            navigation.navigate('ChatConversation', { user: item });
          }
        }}
        accessible={true}
        accessibilityLabel={`${item.username}${isSelected ? ', selected' : ''}`}
        accessibilityHint={isGroup ? 'Double tap to select or deselect this user' : 'Double tap to start a chat with this user'}
        accessibilityRole="button"
      >
        <Image
          source={
            item.profilePicture
              ? { uri: item.profilePicture }
              : require('../../assets/default-avatar.png')
          }
          style={styles.userAvatar}
          accessible={true}
          accessibilityLabel={`${item.username}'s profile picture`}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.username}</Text>
          {item.displayName && (
            <Text style={styles.userDisplayName}>{item.displayName}</Text>
          )}
        </View>
        {isGroup && (
          <MaterialCommunityIcons
            name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
            size={24}
            color={isSelected ? '#4CAF50' : '#999'}
            style={styles.checkIcon}
          />
        )}
      </TouchableOpacity>
    );
  };

  const renderErrorMessage = () => {
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => setError('')}
          >
            <Text style={styles.retryButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, isWeb && styles.webContainer]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {renderErrorMessage()}
      
      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.searchInput, isWeb && styles.webSearchInput]}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            searchUsers(text);
          }}
          accessible={true}
          accessibilityLabel="Search users input"
          accessibilityHint="Type to search for users"
        />
        {isLoading && (
          <ActivityIndicator 
            size="small" 
            color="#24269B" 
            style={styles.loadingIndicator} 
          />
        )}
      </View>
      
      {isGroup && selectedUsers.length > 0 && (
        <View style={styles.selectedContainer}>
          <Text 
            style={styles.selectedTitle}
            accessible={true}
            accessibilityRole="header"
          >
            Selected Users ({selectedUsers.length})
          </Text>
          <FlatList
            data={selectedUsers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.selectedUserChip}>
                <Text style={styles.selectedUserName}>{item.username}</Text>
                <TouchableOpacity
                  onPress={() => toggleUserSelection(item)}
                  accessible={true}
                  accessibilityLabel={`Remove ${item.username}`}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="close-circle" size={20} color="#ff4444" />
                </TouchableOpacity>
              </View>
            )}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectedList}
            contentContainerStyle={styles.selectedListContent}
          />
        </View>
      )}
      
      <FlatList
        data={searchResults}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        style={styles.resultsList}
        contentContainerStyle={styles.resultsContent}
        ListEmptyComponent={
          searchQuery.trim() ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No users found</Text>
              <Text style={styles.emptySubText}>Try a different search term</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Search for users</Text>
              <Text style={styles.emptySubText}>Type in the search box above to find users</Text>
            </View>
          )
        }
      />
      
      {isGroup && selectedUsers.length > 0 && (
        <TouchableOpacity
          style={[styles.doneButton, isWeb && styles.webDoneButton]}
          onPress={handleDone}
          accessible={true}
          accessibilityLabel="Done selecting users"
          accessibilityHint={`Finish selecting ${selectedUsers.length} users`}
          accessibilityRole="button"
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webContainer: {
    maxWidth: 600,
    marginHorizontal: 'auto',
    width: '100%',
    padding: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  webSearchInput: {
    outlineColor: '#24269B',
    transition: 'border-color 0.2s ease',
    ':focus': {
      borderColor: '#24269B',
    },
  },
  loadingIndicator: {
    position: 'absolute',
    right: 25,
  },
  resultsList: {
    flex: 1,
  },
  resultsContent: {
    padding: 10,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedUserItem: {
    backgroundColor: '#E8E8FF',
  },
  webUserItem: {
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#f5f5f5',
    },
    borderRadius: 8,
    margin: 5,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userDisplayName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  checkIcon: {
    marginLeft: 10,
  },
  selectedContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  selectedList: {
    maxHeight: 50,
  },
  selectedListContent: {
    paddingRight: 10,
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8E8FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
  },
  selectedUserName: {
    fontSize: 14,
    color: '#24269B',
    marginRight: 5,
  },
  doneButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 15,
  },
  webDoneButton: {
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    ':hover': {
      backgroundColor: '#3d8b40',
    },
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 16,
    margin: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#24269B',
    borderRadius: 4,
    padding: 8,
    marginLeft: 10,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
  },
});

export default UserSearchScreen; 