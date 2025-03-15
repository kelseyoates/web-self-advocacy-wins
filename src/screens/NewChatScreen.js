import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, Text, StyleSheet, TouchableOpacity, Image, Alert, AccessibilityInfo, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CometChat } from '@cometchat-pro/react-native-chat';
import { COMETCHAT_CONSTANTS } from '../config/cometChatConfig';
import { useAccessibility } from '../context/AccessibilityContext';

// Detect if running on web
const isWeb = Platform.OS === 'web';

const NewChatScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('individual');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { showHelpers } = useAccessibility();

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

  const announceToScreenReader = (message) => {
    if (isScreenReaderEnabled && !isWeb) {
      AccessibilityInfo.announceForAccessibility(message);
    } else if (isWeb && isScreenReaderEnabled) {
      // For web with screen readers, we could use ARIA live regions
      setError(message);
    }
  };

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
    if (text.length < 3) {
      setSearchResults([]);
      announceToScreenReader('Enter at least 3 characters to search');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      announceToScreenReader('Searching for users');
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('username', '>=', text.toLowerCase()),
        where('username', '<=', text.toLowerCase() + '\uf8ff')
      );
      
      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.id !== user.uid);
      
      setSearchResults(users);
      announceToScreenReader(`Found ${users.length} users`);
    } catch (error) {
      console.error('Error searching for users:', error);
      setError('Error searching for users. Please try again.');
      announceToScreenReader('Error searching for users');
    } finally {
      setIsLoading(false);
    }
  };

  const createIndividualChat = async (selectedUser) => {
    try {
      setIsLoading(true);
      setError('');
      const receiverId = selectedUser.originalUid || selectedUser.uid;
      
      console.log('Selected user full data:', selectedUser);
      console.log('Profile picture URL:', selectedUser.profilePicture);
      
      // For web, we need to ensure CometChat connection is established
      if (isWeb) {
        try {
          // Check if user is logged in to CometChat
          const loggedInUser = await CometChat.getLoggedinUser();
          if (!loggedInUser) {
            // If not logged in, try to login
            await CometChat.login(user.uid.toLowerCase(), COMETCHAT_CONSTANTS.AUTH_KEY);
          }
        } catch (error) {
          console.error('CometChat login error:', error);
          setError('There was an issue connecting to the chat service. Some features may be limited.');
          // Continue anyway - we'll still navigate to the chat screen
        }
      }
      
      // Navigate to chat with all user details
      const navigationParams = {
        uid: receiverId,
        name: selectedUser.username,
        profilePicture: selectedUser.profilePicture,
        conversationType: 'user',
        otherUser: selectedUser
      };
      
      console.log('Navigation params:', navigationParams);
      
      navigation.navigate('ChatConversation', navigationParams);

    } catch (error) {
      console.error('Error creating chat:', error);
      console.error('Error details:', error.message);
      setError('Failed to start chat. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMemberSelection = (selectedUser) => {
    setSelectedMembers(prevMembers => {
      const isAlreadySelected = prevMembers.some(member => member.id === selectedUser.id);
      if (isAlreadySelected) {
        return prevMembers.filter(member => member.id !== selectedUser.id);
      } else {
        setSearchQuery('');
        setSearchResults([]);
        return [...prevMembers, selectedUser];
      }
    });
  };

  const createGroupChat = async () => {
    if (selectedMembers.length < 2) {
      Alert.alert('Error', 'Please select at least 2 members for the group chat');
      return;
    }

    setIsCreatingGroup(true);

    try {
      const groupId = 'group_' + Date.now();
      const groupName = `Group Chat (${selectedMembers.length + 1})`;
      
      // Create the group
      const group = new CometChat.Group(
        groupId,
        groupName,
        CometChat.GROUP_TYPE.PRIVATE,
        ''
      );

      console.log('Creating group:', group);
      const createdGroup = await CometChat.createGroup(group);
      
      // Add members one by one to ensure proper count
      for (const member of selectedMembers) {
        const groupMember = new CometChat.GroupMember(
          member.uid || member.id,
          CometChat.GROUP_MEMBER_SCOPE.PARTICIPANT
        );
        await CometChat.addMembersToGroup(groupId, [groupMember], []);
      }

      // Fetch the updated group info after all members are added
      const updatedGroup = await CometChat.getGroup(groupId);
      
      // Send initial message
      const textMessage = new CometChat.TextMessage(
        groupId,
        'Group chat created',
        CometChat.RECEIVER_TYPE.GROUP
      );
      await CometChat.sendMessage(textMessage);

      // Navigate with the updated group info
      navigation.replace('GroupChat', {
        uid: groupId,
        name: groupName,
        conversationType: CometChat.RECEIVER_TYPE.GROUP,
        group: updatedGroup
      });

    } catch (error) {
      console.error('Error creating group chat:', error);
      Alert.alert('Error', 'Failed to create group chat. Please try again.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const renderUserCard = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.userCard,
        activeTab === 'group' && 
        selectedMembers.some(member => member.id === item.id) && 
        styles.selectedUserCard
      ]}
      onPress={() => {
        if (activeTab === 'individual') {
          createIndividualChat(item);
          announceToScreenReader(`Opening chat with ${item.username}`);
        } else {
          toggleMemberSelection(item);
          const isSelected = selectedMembers.some(member => member.id === item.id);
          announceToScreenReader(
            isSelected ? 
            `Removed ${item.username} from selection` : 
            `Added ${item.username} to selection`
          );
        }
      }}
      accessible={true}
      accessibilityLabel={`${item.username}${
        activeTab === 'group' && 
        selectedMembers.some(member => member.id === item.id) 
          ? ', selected' 
          : ''
      }`}
      accessibilityHint={
        activeTab === 'individual' 
          ? 'Double tap to start chat' 
          : 'Double tap to toggle selection'
      }
      accessibilityRole="button"
    >
      <Image
        source={
          item.profilePicture 
            ? { uri: item.profilePicture } 
            : require('../../assets/default-profile.png')
        }
        style={styles.userAvatar}
        accessible={true}
        accessibilityLabel={`${item.username}'s profile picture`}
      />
      <View style={styles.userInfo}>
        <Text style={styles.username}>{item.username}</Text>
      </View>
      <MaterialCommunityIcons 
        name={activeTab === 'individual' ? 'message-text' : 'plus-circle'} 
        size={24} 
        color="#24269B"
        style={styles.actionIcon}
      />
    </TouchableOpacity>
  );

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
    <ScrollView 
      style={styles.scrollContainer}
      contentContainerStyle={[styles.contentContainer, isWeb && styles.webContentContainer]}
      accessible={true}
      accessibilityLabel="New Chat Screen"
    >
      <View style={[styles.container, isWeb && styles.webContainer]}>
        {renderErrorMessage()}
        
        {showHelpers && (
          <View 
            style={styles.helperSection}
            accessible={true}
            accessibilityRole="header"
            accessibilityLabel={`Chat Helper Information. Start a New Chat! Here's what you can do: 
              Search for users by typing their name. 
              Tap Individual Chat on the lower left to chat with one person. 
              Tap Group Chat on the lower right to chat with multiple people.`}
          >
            <View style={styles.helperHeader}>
              <MaterialCommunityIcons 
                name="information" 
                size={24} 
                color="#24269B"
                style={styles.infoIcon}
                importantForAccessibility="no"
              />
            </View>
            <View style={styles.helperContent}>
              <Image 
                source={require('../../assets/search-users.png')}
                style={styles.helperImage}
                importantForAccessibility="no"
              />
              <Text style={styles.helperTitle}>Start a New Chat!</Text>
              <View style={styles.helperTextContainer}>
                <Text style={styles.helperText}>
                  • Search for users by typing their name
                </Text>
                <Text style={styles.helperText}>
                  • Tap "Individual Chat" to chat with one person
                </Text>
                <Text style={styles.helperText}>
                  • Tap "Group Chat" to chat with multiple people
                </Text>
              </View>
            </View>
          </View>
        )}

        <View 
          style={styles.tabContainer}
          accessible={true}
          accessibilityRole="tablist"
        >
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'individual' && styles.activeTab]}
            onPress={() => {
              setActiveTab('individual');
              announceToScreenReader('Switched to individual chat');
            }}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel="Individual Chat tab"
            accessibilityState={{ selected: activeTab === 'individual' }}
          >
            <View style={styles.tabContent}>
              <Image 
                source={require('../../assets/individual-chat.png')} 
                style={[styles.tabIcon, activeTab === 'individual' && styles.activeTabIcon]}
                accessible={true}
                accessibilityLabel="Individual chat icon"
                accessibilityRole="image"
              />
              <Text style={[styles.tabText, activeTab === 'individual' && styles.activeTabText]}>
                Individual Chat
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'group' && styles.activeTab]}
            onPress={() => {
              setActiveTab('group');
              announceToScreenReader('Switched to group chat');
            }}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel="Group Chat tab"
            accessibilityState={{ selected: activeTab === 'group' }}
          >
            <View style={styles.tabContent}>
              <Image 
                source={require('../../assets/group-chat.png')} 
                style={[
                  styles.tabIcon,
                  activeTab === 'group' && styles.activeTabIcon
                ]}
              />
              <Text style={[styles.tabText, activeTab === 'group' && styles.activeTabText]}>
                Group Chat
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchContainer, isWeb && styles.webSearchContainer]}>
          <TextInput
            style={[styles.searchInput, isWeb && styles.webSearchInput]}
            placeholder="Search for users..."
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (text.length >= 3) {
                searchUsers(text);
              } else {
                setSearchResults([]);
              }
            }}
            accessible={true}
            accessibilityLabel="Search for users"
            accessibilityHint="Enter at least 3 characters to search"
          />
          {isLoading ? (
            <View style={styles.searchIconContainer}>
              <ActivityIndicator size="small" color="#24269B" />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.searchIconContainer}
              onPress={() => searchUsers(searchQuery)}
              disabled={searchQuery.length < 3}
            >
              <MaterialCommunityIcons
                name="magnify"
                size={24}
                color={searchQuery.length < 3 ? '#999' : '#24269B'}
              />
            </TouchableOpacity>
          )}
        </View>

        {activeTab === 'group' && selectedMembers.length > 0 && (
          <View 
            style={styles.selectedMembersContainer}
            accessible={true}
            accessibilityLabel={`Selected members: ${selectedMembers.length}`}
          >
            <Text style={styles.selectedMembersTitle}>
              Selected Members ({selectedMembers.length}):
            </Text>
            <ScrollView style={styles.membersList}>
              <View style={styles.selectedMembersContainer}>
                {selectedMembers.map((member) => (
                  <View key={member.uid || member.id} style={styles.selectedMemberChip}>
                    <Text style={styles.selectedMemberText} numberOfLines={1}>
                      {member.username || member.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => toggleMemberSelection(member)}
                      style={styles.removeButton}
                      accessible={true}
                      accessibilityLabel={`Remove ${member.username || member.name}`}
                      accessibilityRole="button"
                    >
                      <MaterialCommunityIcons name="close-circle" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        <FlatList
          data={searchResults}
          renderItem={renderUserCard}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.searchResultsContainer}
        />

        {activeTab === 'group' && selectedMembers.length >= 2 && (
          <View style={styles.createGroupButtonContainer}>
            <TouchableOpacity
              style={[
                styles.createGroupButton,
                { opacity: isCreatingGroup ? 0.7 : 1 }
              ]}
              onPress={createGroupChat}
              disabled={isCreatingGroup}
              accessible={true}
              accessibilityLabel={isCreatingGroup ? "Creating chat now" : "Create group chat"}
              accessibilityHint="Double tap to create a new group chat"
              accessibilityRole="button"
            >
              <Text style={styles.createGroupButtonText}>
                {isCreatingGroup ? "Creating chat now..." : "Create Group Chat"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 15,
  },
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 5,
    padding: 10,
    minHeight: 80,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#24269B',
    borderRadius: 5,
    padding: 5,
  },
  tabIcon: {
    width: 115,
    height: 90,
    marginBottom: 8,
  },
 
  activeTab: {
    backgroundColor: '#24269B',
  },

  tabText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 5,
    flexWrap: 'wrap',
    paddingHorizontal: 5,
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#f8f8f8',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#24269B',
    height: 50,
    width: '100%',
    flexWrap: 'wrap',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  username: {
    fontSize: 16,
    fontWeight: '500',
    flexWrap: 'wrap',
    flex: 1,
    paddingRight: 10,
  },
  noResults: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
    fontSize: 16,
  },
  selectedMembersContainer: {
    padding: 10,
  },
  selectedMembersTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
    flexWrap: 'wrap',
    paddingHorizontal: 5,
  },
  selectedMembersList: {
    paddingVertical: 5,
  },
  selectedMemberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#24269B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    marginHorizontal: 5,
  },
  selectedMemberText: {
    color: '#fff',
    marginRight: 10,
    fontSize: 16,
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  selectedUserItem: {
    backgroundColor: '#f0f0f0',
  },
  createGroupButtonContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  createGroupButton: {
    backgroundColor: '#24269B',
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 20,
    minHeight: 50,
  },
  createGroupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  helperSection: {
    width: '90%',
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24269B',
    alignSelf: 'center',
    marginVertical: 15,
  },
  helperHeader: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: -20,
    zIndex: 1,
  },
  infoIcon: {
    padding: 5,
  },
  helperContent: {
    alignItems: 'center',
    paddingTop: 20,
  },
  helperImage: {
    width: '90%',
    height: 150,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  helperTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#24269B',
    marginVertical: 10,
    textAlign: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  helperTextContainer: {
    width: '100%',
    paddingHorizontal: 5,
  },
  helperText: {
    fontSize: 16,
    marginBottom: 8,
    flexWrap: 'wrap',
    paddingHorizontal: 5,
  },
  searchResultsContainer: {
    padding: 15,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    minHeight: 70,
  },
  selectedUserCard: {
    backgroundColor: '#f0f4ff',
    borderWidth: 2,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  userInfo: {
    flex: 1,
    marginLeft: 15,
    marginRight: 10,
  },
  actionIcon: {
    marginLeft: 10,
  },
  membersList: {
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  webContainer: {
    maxWidth: 800,
    marginHorizontal: 'auto',
    width: '100%',
    padding: 20,
  },
  webContentContainer: {
    alignItems: 'center',
  },
  webSearchContainer: {
    maxWidth: 600,
    marginHorizontal: 'auto',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  webSearchInput: {
    fontSize: 16,
    padding: 12,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 16,
    marginVertical: 10,
    marginHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#24269B',
    borderRadius: 4,
    padding: 8,
    alignSelf: 'flex-end',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
  },
  searchIconContainer: {
    padding: 10,
  },
});

export default NewChatScreen; 