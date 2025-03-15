import React, { useState, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  FlatList, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Platform, 
  Alert, 
  ActivityIndicator,
  AccessibilityInfo,
  KeyboardAvoidingView,
  ScrollView
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CometChat } from '@cometchat-pro/react-native-chat';
import { auth } from '../config/firebase';
import { COMETCHAT_CONSTANTS } from '../config/cometChatConfig';

// Detect if running on web
const isWeb = Platform.OS === 'web';

const GroupChatSetupScreen = ({ navigation, route }) => {
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('public');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);

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

  // Update selected users when returning from UserSearch
  useEffect(() => {
    if (route.params?.selectedUsers) {
      setSelectedUsers(route.params.selectedUsers);
      announceToScreenReader(`${route.params.selectedUsers.length} users selected`);
    }
  }, [route.params?.selectedUsers]);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      showAlert('Error', 'Please enter a group name');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Ensure CometChat is initialized and user is logged in
      if (isWeb) {
        try {
          // Check if user is logged in to CometChat
          const loggedInUser = await CometChat.getLoggedinUser();
          if (!loggedInUser) {
            console.log("No user logged in to CometChat, attempting login");
            
            // Get current Firebase user
            const currentUser = auth.currentUser;
            if (!currentUser) {
              throw new Error("No Firebase user found");
            }
            
            // Login to CometChat
            await CometChat.login(currentUser.uid.toLowerCase(), COMETCHAT_CONSTANTS.AUTH_KEY);
            console.log("CometChat login successful");
          }
        } catch (loginError) {
          console.error("CometChat login error:", loginError);
          setError("There was an issue connecting to the chat service. Group creation may be limited.");
          setLoading(false);
          return;
        }
      }
      
      // Create a unique group ID
      const groupId = `group_${Date.now()}`;
      
      // Create the group in CometChat
      const group = new CometChat.Group(
        groupId,
        groupName,
        groupType === 'public' ? CometChat.GROUP_TYPE.PUBLIC : CometChat.GROUP_TYPE.PRIVATE,
        ''
      );
      
      const createdGroup = await CometChat.createGroup(group);
      console.log('Group created successfully:', createdGroup);
      
      // Add selected users to the group
      if (selectedUsers.length > 0) {
        const membersList = selectedUsers.map(user => {
          return new CometChat.GroupMember(
            user.uid || user.id,
            CometChat.GROUP_MEMBER_SCOPE.PARTICIPANT
          );
        });
        
        await CometChat.addMembersToGroup(groupId, membersList, []);
        console.log('Members added to group');
      }
      
      // Show success message
      announceToScreenReader('Group created successfully');
      
      if (isWeb) {
        setError('');
        // You could use a toast or modal here instead
        alert('Group created successfully!');
      } else {
        Alert.alert(
          'Success',
          'Group created successfully!',
          [{ text: 'OK', onPress: () => navigation.navigate('GroupChat', { uid: groupId, name: groupName }) }]
        );
      }
      
      // Navigate to the new group chat
      navigation.navigate('GroupChat', { uid: groupId, name: groupName });
    } catch (error) {
      console.error('Error creating group:', error);
      
      if (isWeb) {
        setError(`Failed to create group: ${error.message || 'Unknown error'}`);
      } else {
        Alert.alert('Error', 'Failed to create group. Please try again.');
      }
    } finally {
      setLoading(false);
    }
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
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderErrorMessage()}
        
        <Text 
          style={styles.title}
          accessible={true}
          accessibilityRole="header"
        >
          Create a New Group Chat
        </Text>
        
        <View style={styles.inputContainer}>
          <Text 
            style={styles.inputLabel}
            accessible={true}
            accessibilityRole="text"
          >
            Group Name *
          </Text>
          <TextInput
            style={[styles.input, isWeb && styles.webInput]}
            placeholder="Enter group name"
            value={groupName}
            onChangeText={setGroupName}
            accessible={true}
            accessibilityLabel="Group name input"
            accessibilityHint="Enter a name for your new group"
            maxLength={50}
          />
        </View>
        
        <View style={styles.typeContainer}>
          <Text 
            style={styles.inputLabel}
            accessible={true}
            accessibilityRole="text"
          >
            Group Type
          </Text>
          <View style={styles.typeOptions}>
            <TouchableOpacity 
              style={[
                styles.typeOption, 
                groupType === 'public' && styles.selectedType,
                isWeb && styles.webTypeOption
              ]}
              onPress={() => setGroupType('public')}
              accessible={true}
              accessibilityRole="radio"
              accessibilityState={{ checked: groupType === 'public' }}
              accessibilityLabel="Public group"
              accessibilityHint="Anyone can join without approval"
            >
              <MaterialCommunityIcons 
                name={groupType === 'public' ? "radiobox-marked" : "radiobox-blank"} 
                size={24} 
                color="#24269B" 
              />
              <Text style={styles.typeText}>Public</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.typeOption, 
                groupType === 'private' && styles.selectedType,
                isWeb && styles.webTypeOption
              ]}
              onPress={() => setGroupType('private')}
              accessible={true}
              accessibilityRole="radio"
              accessibilityState={{ checked: groupType === 'private' }}
              accessibilityLabel="Private group"
              accessibilityHint="Members need to be added by the admin"
            >
              <MaterialCommunityIcons 
                name={groupType === 'private' ? "radiobox-marked" : "radiobox-blank"} 
                size={24} 
                color="#24269B" 
              />
              <Text style={styles.typeText}>Private</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.addButton, isWeb && styles.webButton]}
          onPress={() => navigation.navigate('UserSearch', { isGroup: true, selectedUsers })}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Add participants"
          accessibilityHint="Navigate to user search to add participants to your group"
        >
          <MaterialCommunityIcons name="account-plus" size={24} color="white" />
          <Text style={styles.buttonText}>Add Participants</Text>
        </TouchableOpacity>

        <View style={styles.selectedUsersContainer}>
          <Text 
            style={styles.selectedUsersTitle}
            accessible={true}
            accessibilityRole="header"
          >
            Selected Participants ({selectedUsers.length})
          </Text>
          
          {selectedUsers.length === 0 ? (
            <Text style={styles.noUsersText}>No participants selected yet</Text>
          ) : (
            <FlatList
              data={selectedUsers}
              keyExtractor={(item) => item.uid || item.id}
              renderItem={({ item }) => (
                <View 
                  style={[styles.selectedUser, isWeb && styles.webSelectedUser]}
                  accessible={true}
                  accessibilityLabel={`Selected user: ${item.name || item.username}`}
                >
                  <Text style={styles.userName}>{item.name || item.username}</Text>
                  <TouchableOpacity 
                    style={[styles.removeButton, isWeb && styles.webRemoveButton]}
                    onPress={() => {
                      setSelectedUsers(users => users.filter(u => (u.uid || u.id) !== (item.uid || item.id)));
                      announceToScreenReader(`Removed ${item.name || item.username}`);
                    }}
                    accessible={true}
                    accessibilityLabel={`Remove ${item.name || item.username}`}
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons name="close-circle" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              )}
              style={styles.usersList}
            />
          )}
        </View>

        <TouchableOpacity 
          style={[
            styles.createButton,
            isWeb && styles.webCreateButton,
            loading && styles.disabledButton
          ]}
          onPress={handleCreateGroup}
          disabled={loading}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Create group chat"
          accessibilityHint="Creates a new group chat with the selected participants"
          accessibilityState={{ disabled: loading }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="check-circle" size={24} color="white" />
              <Text style={styles.buttonText}>Create Group Chat</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#24269B',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
  },
  webInput: {
    outlineColor: '#24269B',
    transition: 'border-color 0.2s ease',
    ':focus': {
      borderColor: '#24269B',
    },
  },
  typeContainer: {
    marginBottom: 20,
  },
  typeOptions: {
    flexDirection: 'row',
    marginTop: 10,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    padding: 10,
    borderRadius: 8,
  },
  webTypeOption: {
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#f5f5f5',
    },
  },
  selectedType: {
    backgroundColor: '#E8E8FF',
  },
  typeText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  addButton: {
    backgroundColor: '#24269B',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 10,
  },
  webButton: {
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    ':hover': {
      backgroundColor: '#1a1c7a',
    },
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedUsersContainer: {
    marginBottom: 20,
  },
  selectedUsersTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  noUsersText: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  usersList: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
  },
  selectedUser: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  webSelectedUser: {
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#f9f9f9',
    },
  },
  userName: {
    fontSize: 16,
    color: '#333',
  },
  removeButton: {
    padding: 5,
  },
  webRemoveButton: {
    cursor: 'pointer',
  },
  createButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 10,
  },
  webCreateButton: {
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    ':hover': {
      backgroundColor: '#3d8b40',
    },
  },
  disabledButton: {
    backgroundColor: '#A0A0A0',
    opacity: 0.7,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
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

export default GroupChatSetupScreen; 