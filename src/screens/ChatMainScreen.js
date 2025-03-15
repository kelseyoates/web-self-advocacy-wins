import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image,
  ActivityIndicator,
  AccessibilityInfo,
  Alert,
  Platform,
  ScrollView
} from 'react-native';
// Conditional import based on platform
const CometChat = Platform.OS === 'web' 
  ? require('@cometchat-pro/chat').CometChat
  : require('@cometchat-pro/react-native-chat').CometChat;
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isSupporterFor } from '../services/cometChat';
import { auth } from '../config/firebase';
import { useAccessibility } from '../context/AccessibilityContext';

const isWeb = Platform.OS === 'web';

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

  // Add refs for keyboard navigation
  const conversationRefs = useRef({});
  const [focusedConversation, setFocusedConversation] = useState(null);

  // Add keyboard navigation handler
  const handleKeyPress = (e, onPress, item) => {
    if (isWeb) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPress();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = conversations.findIndex(conv => conv.conversationId === item.conversationId);
        const nextIndex = e.key === 'ArrowDown' 
          ? Math.min(currentIndex + 1, conversations.length - 1)
          : Math.max(currentIndex - 1, 0);
        const nextConversation = conversations[nextIndex];
        if (nextConversation) {
          setFocusedConversation(nextConversation.conversationId);
          conversationRefs.current[nextConversation.conversationId]?.focus();
        }
      }
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            onPress={() => {
              announceToScreenReader('Starting new chat');
              navigation.navigate('NewChat');
            }}
            style={[
              styles.newChatButton,
              isWeb && styles.webNewChatButton
            ]}
            accessible={true}
            accessibilityLabel="Start new chat"
            accessibilityHint="Opens screen to start a new conversation"
            accessibilityRole="button"
            role="button"
            tabIndex={0}
          >
            <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="message-plus" size={24} color="#24269B" />
              <Text style={styles.newChatButtonText}>New Chat</Text>
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
    if (isWeb) {
      const ariaLive = document.getElementById('aria-live-region');
      if (ariaLive) {
        ariaLive.textContent = message;
      }
    } else if (isScreenReaderEnabled) {
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
    const conversationId = isGroup ? item.conversationWith?.guid : item.conversationWith?.uid;
    const name = item.conversationWith?.name;
    const groupIcon = isGroup ? item.conversationWith?.icon : null;
    
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
        style={[
          styles.conversationItem,
          isWeb && styles.webConversationItem
        ]}
        onPress={navigateToChat}
        onLongPress={handleLongPress}
        onKeyPress={(e) => handleKeyPress(e, () => handleLongPress(item))}
        accessible={true}
        accessibilityLabel={`${accessibilityLabel}. Long press to delete conversation`}
        accessibilityHint="Double tap to open conversation, double tap and hold to delete"
        accessibilityRole="button"
        role="button"
        tabIndex={0}
      >
        <View style={styles.avatarContainer}>
          <Image 
            source={isGroup ? 
              (groupIcon ? { uri: groupIcon } : require('../../assets/megaphone.png')) : 
              { uri: users[conversationId]?.profilePicture || 'https://www.gravatar.com/avatar' }
            }
            style={[
              styles.avatar,
              isWeb && styles.webAvatar
            ]}
            alt={`${name}'s profile picture`}
          />
        </View>
        <View 
          style={styles.conversationInfo}
          accessible={true}
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={[
            styles.userName,
            isWeb && styles.webUserName
          ]}>
            {name || 'Unknown'}
          </Text>
          <Text style={[
            styles.lastMessage,
            blockedUsers.has(item.lastMessage?.sender?.uid) && styles.hiddenMessage,
            isWeb && styles.webLastMessage
          ]} numberOfLines={1}>
            {lastMessage}
          </Text>
        </View>
        
        {supporterAccess[conversationId] && (
          <View style={[
            styles.supporterBadge,
            isWeb && styles.webSupporterBadge
          ]}>
            <Text style={styles.supporterBadgeText}>Supporter</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderHelperSection = () => (
    <View 
      style={[
        styles.helperSection,
        isWeb && styles.webHelperSection
      ]}
      accessible={true}
      accessibilityRole="complementary"
      accessibilityLabel="Chat helper information"
    >
      <View style={styles.helperHeader}>
        <MaterialCommunityIcons 
          name="information" 
          size={24} 
          color="#24269B"
          style={styles.infoIcon}
        />
      </View>
      <View style={styles.helperContent}>
        <Image 
          source={require('../../assets/megaphone.png')}
          style={styles.helperImage}
          alt="Chat illustration"
        />
        <Text style={styles.helperTitle}>Welcome to Chat!</Text>
        <View style={styles.helperTextContainer}>
          <Text style={styles.helperText}>
            • Start conversations with other users
          </Text>
          <Text style={styles.helperText}>
            • Share experiences and support each other
          </Text>
          <Text style={styles.helperText}>
            • Join community chats to connect with groups
          </Text>
          <Text style={styles.helperText}>
            • Use the New Chat button to begin a conversation
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[
        styles.centerContainer,
        isWeb && styles.webCenterContainer
      ]}>
        <ActivityIndicator size="large" color="#24269B" />
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      isWeb && styles.webContainer
    ]}>
      {isWeb && (
        <div id="aria-live-region" 
          role="status" 
          aria-live="polite" 
          style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}
        />
      )}
      
      {isWeb ? (
        <ScrollView style={styles.webScrollView}>
          {showHelpers && renderHelperSection()}
          {conversations.map((item) => (
            <React.Fragment key={item.conversationId}>
              {renderConversation({ item })}
            </React.Fragment>
          ))}
          {conversations.length === 0 && renderEmptyState()}
        </ScrollView>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={item => item.conversationId}
          ListHeaderComponent={showHelpers ? renderHelperSection : null}
          ListEmptyComponent={renderEmptyState}
        />
      )}
      
      <TouchableOpacity
        style={[
          styles.fab,
          isWeb && styles.webFab
        ]}
        onPress={() => {
          announceToScreenReader('Starting new chat');
          navigation.navigate('NewChat');
        }}
        accessible={true}
        accessibilityLabel="New Chat"
        accessibilityHint="Double tap to start a new conversation"
        accessibilityRole="button"
        role="button"
        tabIndex={0}
        onKeyPress={(e) => handleKeyPress(e, () => navigation.navigate('NewChat'))}
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

  webContainer: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    marginHorizontal: 0,
    height: '100vh',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
  },
  webScrollView: {
    flex: 1,
    width: '100%',
    maxWidth: 1200,
    marginHorizontal: 'auto',
    padding: '20px 32px',
  },
  webCenterContainer: {
    height: '100vh',
  },
  webConversationItem: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
      backgroundColor: '#f8f9fa',
    },
  },
  webAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  webUserName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  webLastMessage: {
    fontSize: 14,
    color: '#666',
  },
  webSupporterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#24269B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  webNewChatButton: {
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
    ':hover': {
      transform: 'scale(1.05)',
    },
  },
  webFab: {
    position: 'fixed',
    right: 32,
    bottom: 32,
    cursor: 'pointer',
    transition: 'transform 0.2s ease, background-color 0.2s ease',
    ':hover': {
      transform: 'scale(1.05)',
      backgroundColor: '#1a1b6e',
    },
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 1000,
  },
  webHelperSection: {
    backgroundColor: '#f8f9fa',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    padding: 24,
    marginBottom: 20,
    borderRadius: 12,
    width: '100%',
    maxWidth: 800,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
});

export default ChatMainScreen;