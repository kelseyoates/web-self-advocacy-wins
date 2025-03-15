import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image,
  ActivityIndicator,
  AccessibilityInfo,
  Alert
} from 'react-native';
import { CometChat } from '@cometchat-pro/react-native-chat';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isSupporterFor } from '../services/cometChat';
import { auth } from '../config/firebase';
import { useAccessibility } from '../context/AccessibilityContext';

const ChatMainScreen = ({ navigation }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState({});
  const { user } = useAuth();
  const [supporterAccess, setSupporterAccess] = useState({});
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [userData, setUserData] = useState(null);
  const { showHelpers } = useAccessibility();
  const [blockedUsers, setBlockedUsers] = useState(new Set());

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.buttonContainer}>
          <View style={styles.buttonShadow} />
          <TouchableOpacity 
            onPress={() => {
              announceToScreenReader('Starting new chat');
              navigation.navigate('NewChat');
            }}
            style={styles.newChatButton}
            accessible={true}
            accessibilityLabel="Start new chat"
            accessibilityHint="Opens screen to start a new conversation"
            accessibilityRole="button"
          >
            <View style={styles.buttonContent}>
              <Text style={styles.newChatButtonText}>
                New Chat <MaterialCommunityIcons name="message-plus" size={24} color="#24269B" />
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      ),
    });

    fetchConversations();

    CometChat.addMessageListener(
      'CHAT_MAIN_SCREEN_MESSAGE_LISTENER',
      new CometChat.MessageListener({
        onTextMessageReceived: message => {
          console.log("Message received:", message);
          fetchConversations();
        }
      })
    );

    return () => {
      CometChat.removeMessageListener('CHAT_MAIN_SCREEN_MESSAGE_LISTENER');
    };
  }, [navigation]);

  useEffect(() => {
    const fetchUserData = async (uid) => {
      try {
        console.log('Fetching user data for UID:', uid);
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('Found user data:', userData);
          console.log('Profile picture URL:', userData.profilePicture);
          setUsers(prev => ({
            ...prev,
            [uid]: userData
          }));
        } else {
          console.log('No user document found for UID:', uid);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    console.log('Current chats:', conversations);
    conversations.forEach(chat => {
      if (chat.conversationWith?.uid) {
        fetchUserData(chat.conversationWith.uid);
      } else {
        console.log('Chat missing conversationWith.uid:', chat);
      }
    });
  }, [conversations]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('Screen focused, refreshing conversations');
      fetchConversations();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const checkSupporterAccess = async () => {
      if (conversations) {
        const accessMap = {};
        for (const conv of conversations) {
          if (conv.conversationType === CometChat.RECEIVER_TYPE.USER) {
            accessMap[conv.conversationWith.uid] = await isSupporterFor(
              user.uid.toLowerCase(),
              conv.conversationWith.uid.toLowerCase()
            );
          }
        }
        setSupporterAccess(accessMap);
      }
    };

    checkSupporterAccess();
  }, [conversations]);

  useEffect(() => {
    const checkScreenReader = async () => {
      const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      setIsScreenReaderEnabled(screenReaderEnabled);
    };

    checkScreenReader();
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsScreenReaderEnabled
    );

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        if (auth.currentUser) {
          const userDocRef = doc(db, 'users', auth.currentUser.uid.toLowerCase());
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUserData(data);
            console.log('Fetched profile picture:', data.profilePicture);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => navigation.navigate('Settings')}
          accessible={true}
          accessibilityLabel="Open menu"
          accessibilityHint="Navigate to settings and additional options"
        >
          <Image
            source={require('../../assets/bottom-nav-images/menu-inactive.png')}
            style={styles.menuIcon}
          />
          <Text style={styles.menuText}>Menu</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      try {
        const blockedUsersRequest = new CometChat.BlockedUsersRequestBuilder()
          .setLimit(100)
          .build();
        
        const blockedUsersList = await blockedUsersRequest.fetchNext();
        const blockedIds = new Set(blockedUsersList.map(user => user.uid));
        setBlockedUsers(blockedIds);
      } catch (error) {
        console.error('Error fetching blocked users:', error);
      }
    };

    fetchBlockedUsers();
  }, []);

  const announceToScreenReader = (message) => {
    if (isScreenReaderEnabled) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  };

  const fetchConversations = async () => {
    setLoading(true);
    announceToScreenReader('Loading conversations');
    try {
      const conversationsRequest = new CometChat.ConversationsRequestBuilder()
        .setLimit(30)
        .build();

      const conversationList = await conversationsRequest.fetchNext();
      console.log("Conversations list received:", conversationList);
      setConversations(conversationList);
      announceToScreenReader(`Loaded ${conversationList.length} conversations`);
    } catch (error) {
      announceToScreenReader('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const deleteConversation = async (conversation) => {
    try {
      // Check if it's a group conversation
      if (conversation.conversationType === CometChat.RECEIVER_TYPE.GROUP) {
        Alert.alert(
          'Community Chat',
          'You cannot delete a group or community chat from this screen. Please tap the Group Info button in the chat to leave the group.'
        );
        return;
      }

      const conversationId = conversation.conversationId || conversation.conversationWith?.uid;
      
      // Only handle individual chat deletion
      await CometChat.deleteConversation(conversationId, conversation.conversationType);
      
      // Refresh the conversations list
      fetchConversations();
      
    } catch (error) {
      console.error('Error deleting conversation:', error);
      Alert.alert(
        'Error',
        'Failed to delete conversation. Please try again.'
      );
    }
  };

  const handleReportMessage = async (message) => {
    try {
      const reportType = "inappropriate";
      const reportMessage = await CometChat.reportMessage(
        message.id,
        reportType,
        { reason: "Inappropriate content" }
      );
      
      console.log("Message reported successfully:", reportMessage);
      Alert.alert(
        "Message Reported",
        "Thank you for helping keep our community safe."
      );
      announceToScreenReader('Message reported successfully');
    } catch (error) {
      console.error("Error reporting message:", error);
      Alert.alert(
        "Error",
        "Failed to report message. Please try again."
      );
      announceToScreenReader('Failed to report message');
    }
  };

  const submitReport = async (user, reportReason) => {
    try {
      console.log('Reporting user:', user.uid, 'for reason:', reportReason);

      // First, notify the reported user
      const userNotification = new CometChat.TextMessage(
        user.uid,
        `Your account has been reported for review.`,
        'user'
      );

      // Add metadata to user notification
      userNotification.setMetadata({
        reportType: 'user',
        reason: reportReason,
        timestamp: new Date().getTime()
      });
      
      // Send notification to user
      await CometChat.sendMessage(userNotification);

      // Create the report record
      const reportMessage = new CometChat.TextMessage(
        user.uid,
        `[REPORT] A report has been submitted for review.`,
        'user'
      );

      // Add full metadata to report
      reportMessage.setMetadata({
        reportType: 'user',
        reportedUser: user.uid,
        reportedName: user.name,
        reason: reportReason,
        reportedBy: user.uid,
        reportedByName: user.name,
        timestamp: new Date().getTime()
      });

      // Add tags for filtering
      reportMessage.setTags(['report', 'moderation']);
      
      // Send the report
      await CometChat.sendMessage(reportMessage);

      Alert.alert(
        'User Reported',
        'Thank you for your report. We will review it shortly.'
      );
      announceToScreenReader('User reported successfully');

    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert(
        'Error',
        'Failed to report user. Please try again.'
      );
      announceToScreenReader('Failed to report user');
    }
  };

  const handleReportUser = async (user) => {
    try {
      Alert.alert(
        'Report User',
        `Are you sure you want to report ${user.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Harassment',
            style: 'destructive',
            onPress: () => {
              console.log('Submitting harassment report for:', user.uid);
              submitReport(user, 'Harassment: User is engaging in harassing behavior');
            }
          },
          {
            text: 'Inappropriate Content',
            style: 'destructive',
            onPress: () => {
              console.log('Submitting inappropriate content report for:', user.uid);
              submitReport(user, 'Inappropriate Content: User is sharing inappropriate content');
            }
          },
          {
            text: 'Spam',
            style: 'destructive',
            onPress: () => {
              console.log('Submitting spam report for:', user.uid);
              submitReport(user, 'Spam: User is sending spam messages');
            }
          },
          {
            text: 'Threatening Behavior',
            style: 'destructive',
            onPress: () => {
              console.log('Submitting threatening behavior report for:', user.uid);
              submitReport(user, 'Threatening Behavior: User is making threats');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in handleReportUser:', error);
      Alert.alert(
        'Error',
        'Failed to process report request. Please try again.'
      );
    }
  };

  const renderConversation = ({ item }) => {
    const isGroup = item.conversationType === CometChat.RECEIVER_TYPE.GROUP;
    
    // For groups, use guid; for users, use uid
    const conversationId = isGroup 
      ? item.conversationWith?.guid 
      : item.conversationWith?.uid;

    const name = item.conversationWith?.name;
    const groupIcon = isGroup ? item.conversationWith?.icon : null;
    
    // Handle different message types and blocking
    let lastMessage = 'Start chatting';
    if (item.lastMessage) {
      const isBlocked = blockedUsers.has(item.lastMessage.sender?.uid);
      
      if (isBlocked) {
        lastMessage = 'Message hidden';
      } else if (item.lastMessage.type === 'text') {
        lastMessage = item.lastMessage.text;
      } else if (item.lastMessage.type === 'image') {
        lastMessage = '📷 Photo';
      } else if (item.lastMessage.type === 'video') {
        lastMessage = '🎥 Video';
      } else if (item.lastMessage.type === 'file') {
        lastMessage = '📎 File';
      }
    }

    const navigateToChat = () => {
      announceToScreenReader(`Opening chat with ${name}`);
      if (isGroup) {
        navigation.navigate('GroupChat', { 
          uid: conversationId,
          name: name
        });
      } else {
        navigation.navigate('ChatConversation', { 
          uid: conversationId,
          name: name,
          profilePicture: users[conversationId]?.profilePicture,
          conversationType: CometChat.RECEIVER_TYPE.USER
        });
      }
    };

    const accessibilityLabel = `Chat with ${name}. ${
      supporterAccess[conversationId] ? 'You are a supporter. ' : ''
    }Last message: ${lastMessage}`;

    const handleLongPress = () => {
      if (isGroup) {
        Alert.alert(
          'Delete Conversation',
          'Are you sure you want to delete this conversation?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => deleteConversation(item)
            }
          ]
        );
        return;
      }

      Alert.alert(
        'Chat Options',
        'What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Conversation',
            style: 'destructive',
            onPress: () => deleteConversation(item)
          },
          {
            text: blockedUsers.has(item.conversationWith.uid) ? 'Unblock User' : 'Block User',
            style: 'destructive',
            onPress: async () => {
              try {
                if (blockedUsers.has(item.conversationWith.uid)) {
                  await CometChat.unblockUsers([item.conversationWith.uid]);
                  setBlockedUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(item.conversationWith.uid);
                    return newSet;
                  });
                  announceToScreenReader('User unblocked');
                } else {
                  await CometChat.blockUsers([item.conversationWith.uid]);
                  setBlockedUsers(prev => new Set([...prev, item.conversationWith.uid]));
                  announceToScreenReader('User blocked');
                }
              } catch (error) {
                console.error('Error blocking/unblocking user:', error);
                Alert.alert('Error', 'Failed to block/unblock user. Please try again.');
              }
            }
          },
          {
            text: 'Report User',
            style: 'destructive',
            onPress: () => handleReportUser(item.conversationWith)
          }
        ]
      );
    };

    return (
      <TouchableOpacity 
        style={styles.conversationItem}
        onPress={navigateToChat}
        onLongPress={handleLongPress}
        accessible={true}
        accessibilityLabel={`${accessibilityLabel}. Long press to delete conversation`}
        accessibilityHint="Double tap to open conversation, double tap and hold to delete"
        accessibilityRole="button"
      >
        <View style={styles.avatarContainer}>
          <Image 
            source={isGroup ? 
              (groupIcon ? { uri: groupIcon } : require('../../assets/megaphone.png')) : 
              { uri: users[conversationId]?.profilePicture || 'https://www.gravatar.com/avatar' }
            }
            style={styles.avatar}
            accessible={true}
            accessibilityLabel={`${name}'s profile picture`}
            accessibilityRole="image"
          />
        </View>
        <View 
          style={styles.conversationInfo}
          accessible={true}
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.userName}>{name || 'Unknown'}</Text>
          <Text style={[
            styles.lastMessage, 
            blockedUsers.has(item.lastMessage?.sender?.uid) && styles.hiddenMessage
          ]} numberOfLines={1}>
            {lastMessage}
          </Text>
        </View>
        
        {supporterAccess[conversationId] && (
          <View 
            style={styles.supporterBadge}
            accessible={true}
            accessibilityElementsHidden={true}
          >
            <Text style={styles.supporterBadgeText}>Supporter</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View 
        style={styles.centerContainer}
        accessible={true}
        accessibilityLabel="Loading conversations"
      >
        <ActivityIndicator size="large" color="#24269B" />
      </View>
    );
  }

  return (
    <View 
      style={styles.container}
      accessible={true}
      accessibilityLabel="Chat conversations"
    >
      <FlatList
        ListHeaderComponent={() => (
          <>
            {showHelpers && (
              <View 
                style={styles.helperSection}
                accessible={true}
                accessibilityRole="header"
                accessibilityLabel={`Chat Helper Information. Start Chatting! Here's what you can do: 
                  Tap the dark blue New Chat button in the bottom right corner to start a conversation. 
                  Chat with one person or create a group chat. 
                  Your chats will appear in this list. 
                  There are lots of built in safety features. If someone is bothering you, press and hold on their message and select Report. 
                  To delete your own message, press and hold on it and select Delete. 
                  To delete a conversation, press and hold on it and select Delete Conversation. 
                  To leave a group, tap the group info button and select Leave Group. 
                  Have fun chatting!`}
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
                    source={require('../../assets/liam-messages.png')}
                    style={styles.helperImage}
                    importantForAccessibility="no"
                  />
                  <Text style={styles.helperTitle}>Start Chatting!</Text>
                  <View style={styles.helperTextContainer}>
                    <Text style={styles.helperText}>
                      • Tap the dark blue "New Chat" button to start a conversation
                    </Text>
                    <Text style={styles.helperText}>
                      • Chat with one person or create a group chat
                    </Text>
                    <Text style={styles.helperText}>
                      • Your chats will appear in this list
                    </Text>
                    <Text style={styles.helperText}>
                      • There are lots of built in safety features. If someone is bothering you, press and hold on their message and select "Report"
                    </Text>
                    <Text style={styles.helperText}>
                      • To delete your own message, press and hold on it and select "Delete"
                    </Text>
                    <Text style={styles.helperText}>
                      • To delete a conversation, press and hold on it and select "Delete Conversation"
                    </Text>
                    <Text style={styles.helperText}>
                      • To leave a group, tap the group info button and select "Leave Group"
                    </Text>
                    <Text style={styles.helperText}>
                      • Have fun chatting!
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={item => item.conversationId}
        accessibilityHint="Scroll to view conversations"
        ListEmptyComponent={
          <View 
            style={styles.emptyContainer}
            accessible={true}
            accessibilityLabel="No conversations"
          >
            <Text style={styles.emptyText}>No conversations yet</Text>
            <TouchableOpacity 
              style={styles.startChatButton}
              onPress={() => {
                announceToScreenReader('Starting new chat');
                navigation.navigate('NewChat');
              }}
              accessible={true}
              accessibilityLabel="Start a new chat"
              accessibilityHint="Opens screen to start a new conversation"
              accessibilityRole="button"
            >
              <Text style={styles.startChatButtonText}>Start a new chat</Text>
            </TouchableOpacity>
          </View>
        }
      />
      
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          announceToScreenReader('Starting new chat');
          navigation.navigate('NewChat');
        }}
        accessible={true}
        accessibilityLabel="New Chat"
        accessibilityHint="Double tap to start a new conversation"
        accessibilityRole="button"
      >
        <View style={styles.fabContent}>
          <MaterialCommunityIcons name="message-plus" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>New Chat</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    marginRight: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  headerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    color: '#24269B',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    flexWrap: 'wrap',
    paddingRight: 10,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    flexWrap: 'wrap',
    paddingRight: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },

  buttonText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },


  buttonContainer: {
    marginRight: 15,
    position: 'relative',
  },

  buttonShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: '#1a1b6e',
    borderRadius: 25,
  },

  newChatButton: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 25,
    position: 'relative',
    zIndex: 1,
    borderWidth: 1,
    borderColor: '#24269B',
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  newChatButtonText: {
    color: '#24269B',
    fontSize: 16,
    fontWeight: '600',
  },

  buttonIcon: {
    width: 90,
    height: 90,
    borderRadius: 15,
  },

  supporterBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#24269B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  supporterBadgeText: {
    color: '#fff',
    fontSize: 12,
  },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#24269B',
    borderRadius: 30,
    padding: 12,
    elevation: 5,
    minWidth: 110,
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  fabText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 16,
    flexWrap: 'wrap',
  },

  menuButton: {
    alignItems: 'center',
    marginRight: 15,
    maxWidth: 80,
  },
  menuIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  menuText: {
    fontSize: 12,
    color: '#24269B',
    marginTop: 2,
    flexWrap: 'wrap',
    textAlign: 'center',
  },

  helperSection: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24269B',
    marginVertical: 5,
    marginHorizontal: 5,
    padding: 5,
    alignSelf: 'center',
    width: '95%',
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
    width: 200,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  helperTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#24269B',
    marginVertical: 10,
    flexWrap: 'wrap',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  helperTextContainer: {
    width: '100%',
    paddingHorizontal: 10,
  },
  helperText: {
    fontSize: 16,
    marginVertical: 5,
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  listHeaderSpace: {
    height: 10,
  },
  hiddenMessage: {
    fontStyle: 'italic',
    color: '#999',
  },
});

export default ChatMainScreen;