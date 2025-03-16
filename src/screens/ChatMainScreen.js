import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ScrollView,
  Pressable,
  useWindowDimensions
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
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;

  // States for web-specific interactions
  const [hoveredConversation, setHoveredConversation] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);
  
  // Add refs for keyboard navigation
  const conversationRefs = useRef({});
  const [focusedConversation, setFocusedConversation] = useState(null);
  const fabRef = useRef(null);
  const scrollViewRef = useRef(null);

  // Build responsive styles based on screen size
  const responsiveStyles = {
    container: [
      styles.container,
      isWeb && styles.webContainer,
      isWeb && !isMobile && styles.webContainerDesktop
    ],
    centerContainer: [
      styles.centerContainer,
      isWeb && styles.webCenterContainer
    ],
    fab: [
      styles.fab,
      isWeb && styles.webFab,
      isWeb && hoveredButton === 'fab' && styles.webFabHover
    ],
    helperSection: [
      styles.helperSection,
      isWeb && styles.webHelperSection
    ],
    scrollView: [
      isWeb && styles.webScrollView,
      isWeb && !isMobile && styles.webScrollViewDesktop
    ]
  };

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

  const announceToScreenReader = useCallback((message) => {
    if (isScreenReaderEnabled) {
      if (isWeb) {
        const ariaLive = document.getElementById('aria-live-region');
        if (ariaLive) {
          ariaLive.textContent = message;
        }
      } else {
        AccessibilityInfo.announceForAccessibility(message);
      }
    }
  }, [isScreenReaderEnabled]);

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

  const renderConversation = useCallback(({ item }) => {
    const isBlocked = blockedUsers.has(item.conversationWith?.uid);
    
    const conversationItemStyle = [
      styles.conversationItem,
      isWeb && styles.webConversationItem,
      isWeb && hoveredConversation === item.conversationId && styles.webConversationItemHover,
      isWeb && focusedConversation === item.conversationId && styles.webConversationItemFocused
    ];
    
    const avatarStyle = [
      styles.avatar,
      isWeb && styles.webAvatar
    ];
    
    const usernameStyle = [
      styles.userName,
      isWeb && styles.webUserName
    ];
    
    const lastMessageStyle = [
      styles.lastMessage,
      isWeb && styles.webLastMessage,
      isBlocked && styles.hiddenMessage
    ];

    const navigateToChat = () => {
      if (isBlocked) {
        announceToScreenReader('This user is blocked');
        Alert.alert(
          'User Blocked',
          'This user is blocked. Would you like to unblock them to start chatting?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Unblock', 
              onPress: async () => {
                try {
                  await CometChat.unblockUsers([item.conversationWith.uid]);
                  setBlockedUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(item.conversationWith.uid);
                    return newSet;
                  });
                  announceToScreenReader('User unblocked');
                  navigation.navigate('ChatConversation', { 
                    uid: item.conversationWith.uid,
                    name: item.conversationWith.name
                  });
                } catch (error) {
                  console.error('Error unblocking user:', error);
                  Alert.alert('Error', 'Failed to unblock user. Please try again.');
                }
              }
            }
          ]
        );
        return;
      }

      navigation.navigate('ChatConversation', { 
        uid: item.conversationWith.uid,
        name: item.conversationWith.name
      });
    };

    const handleLongPress = () => {
      Alert.alert(
        'Chat Options',
        `What would you like to do with ${item.conversationWith.name}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Report User',
            onPress: () => handleReportUser(item.conversationWith)
          },
          {
            text: 'Block User',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log('Blocking user:', item.conversationWith.uid);
                await CometChat.blockUsers([item.conversationWith.uid]);
                setBlockedUsers(prev => {
                  const newSet = new Set(prev);
                  newSet.add(item.conversationWith.uid);
                  return newSet;
                });
                Alert.alert('User Blocked', 'You will no longer receive messages from this user.');
                announceToScreenReader('User blocked successfully');
              } catch (error) {
                console.error('Error blocking user:', error);
                Alert.alert('Error', 'Failed to block user. Please try again.');
              }
            }
          },
          {
            text: 'Delete Conversation',
            style: 'destructive',
            onPress: () => deleteConversation(item)
          }
        ]
      );
    };

    // Get the user's profile data
    const otherUser = users[item.conversationWith?.uid];
    const profilePicture = otherUser?.profilePicture || otherUser?.photoURL;
    
    // Determine if we are a supporter for this user
    const supporterForThisUser = supporterAccess[item.conversationWith?.uid] || false;

    return (
      <Pressable
        ref={el => conversationRefs.current[item.conversationId] = el}
        style={conversationItemStyle}
        onPress={navigateToChat}
        onLongPress={handleLongPress}
        delayLongPress={500}
        accessible={true}
        accessibilityLabel={`Conversation with ${item.conversationWith.name}${isBlocked ? ', blocked' : ''}${supporterForThisUser ? ', you are a supporter' : ''}`}
        accessibilityHint="Double tap to open conversation, double tap and hold for options"
        accessibilityRole="button"
        onFocus={() => setFocusedConversation(item.conversationId)}
        onBlur={() => setFocusedConversation(null)}
        onMouseEnter={isWeb ? () => setHoveredConversation(item.conversationId) : undefined}
        onMouseLeave={isWeb ? () => setHoveredConversation(null) : undefined}
        tabIndex={isWeb ? 0 : undefined}
        role={isWeb ? "button" : undefined}
        onKeyPress={(e) => handleKeyPress(e, navigateToChat, item)}
      >
        <View style={styles.avatarContainer}>
          {profilePicture ? (
            <Image
              source={{ uri: profilePicture }}
              style={avatarStyle}
              accessible={true}
              accessibilityLabel={`${item.conversationWith.name}'s profile picture`}
            />
          ) : (
            <View style={avatarStyle}>
              <Text style={styles.avatarText}>
                {item.conversationWith.name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.conversationInfo}>
          <Text style={usernameStyle} numberOfLines={1}>
            {item.conversationWith.name}
          </Text>
          <Text style={lastMessageStyle} numberOfLines={2}>
            {isBlocked 
              ? 'This message is hidden because you blocked this user'
              : item.lastMessage?.text || "No messages yet"
            }
          </Text>
          
          {supporterForThisUser && (
            <View style={[styles.supporterBadge, isWeb && styles.webSupporterBadge]}>
              <Text style={styles.supporterBadgeText}>Supporter</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }, [
    users, supporterAccess, blockedUsers, isWeb, announceToScreenReader, 
    navigation, hoveredConversation, focusedConversation
  ]);

  const renderEmptyState = useCallback(() => (
    <View style={[styles.emptyContainer, isWeb && styles.webEmptyContainer]}>
      <Image 
        source={require('../../assets/megaphone.png')}
        style={[styles.emptyImage, isWeb && styles.webEmptyImage]}
        accessible={true}
        accessibilityLabel="Empty chat illustration"
      />
      <Text 
        style={[styles.emptyText, isWeb && styles.webEmptyText]}
        role={isWeb ? "heading" : undefined}
        aria-level={isWeb ? 2 : undefined}
      >
        No conversations yet
      </Text>
      <Text style={[styles.emptySubtext, isWeb && styles.webEmptySubtext]}>
        Start a new chat to connect with others
      </Text>
      <TouchableOpacity 
        style={[styles.emptyButton, isWeb && styles.webEmptyButton]}
        onPress={() => navigation.navigate('NewChat')}
        accessible={true}
        accessibilityLabel="Start a new conversation"
        accessibilityRole="button"
        role={isWeb ? "button" : undefined}
        tabIndex={isWeb ? 0 : undefined}
      >
        <Text style={styles.emptyButtonText}>Start New Chat</Text>
      </TouchableOpacity>
    </View>
  ), [isWeb, navigation]);

  const renderHelperSection = useCallback(() => (
    <View 
      style={responsiveStyles.helperSection}
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
        <Text 
          style={[styles.helperTitle, isWeb && styles.webHelperTitle]}
          role={isWeb ? "heading" : undefined}
          aria-level={isWeb ? 2 : undefined}
        >
          Welcome to Chat!
        </Text>
        <View style={styles.helperTextContainer}>
          <Text style={[styles.helperText, isWeb && styles.webHelperText]}>
            • Start conversations with other users
          </Text>
          <Text style={[styles.helperText, isWeb && styles.webHelperText]}>
            • Share experiences and support each other
          </Text>
          <Text style={[styles.helperText, isWeb && styles.webHelperText]}>
            • Join community chats to connect with groups
          </Text>
          <Text style={[styles.helperText, isWeb && styles.webHelperText]}>
            • Use the New Chat button to begin a conversation
          </Text>
        </View>
      </View>
    </View>
  ), [responsiveStyles.helperSection, isWeb]);

  if (loading) {
    return (
      <View style={responsiveStyles.centerContainer}>
        <ActivityIndicator size="large" color="#24269B" />
        <Text style={[styles.loadingText, isWeb && styles.webLoadingText]}>
          Loading your conversations...
        </Text>
      </View>
    );
  }

  return (
    <View style={responsiveStyles.container}>
      {isWeb && (
        <div 
          id="aria-live-region" 
          role="status" 
          aria-live="polite" 
          style={{ 
            position: 'absolute', 
            width: 1, 
            height: 1, 
            padding: 0, 
            margin: -1, 
            overflow: 'hidden', 
            clip: 'rect(0, 0, 0, 0)', 
            whiteSpace: 'nowrap', 
            border: 0 
          }}
        />
      )}
      
      {isWeb ? (
        <ScrollView 
          ref={scrollViewRef}
          style={responsiveStyles.scrollView}
          contentContainerStyle={isWeb && !isMobile ? { paddingBottom: 80 } : undefined}
        >
          {showHelpers && renderHelperSection()}
          {conversations.length > 0 ? (
            <>
              {!isMobile && (
                <Text 
                  style={[styles.pageTitle, isWeb && styles.webPageTitle]}
                  role="heading"
                  aria-level={1}
                >
                  Your Conversations
                </Text>
              )}
              {conversations.map((item) => (
                <React.Fragment key={item.conversationId}>
                  {renderConversation({ item })}
                </React.Fragment>
              ))}
            </>
          ) : (
            renderEmptyState()
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={item => item.conversationId}
          ListHeaderComponent={showHelpers ? renderHelperSection : null}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={conversations.length === 0 ? { flex: 1, justifyContent: 'center' } : {}}
        />
      )}
      
      <TouchableOpacity
        ref={fabRef}
        style={responsiveStyles.fab}
        onPress={() => {
          announceToScreenReader('Starting new chat');
          navigation.navigate('NewChat');
        }}
        onMouseEnter={isWeb ? () => setHoveredButton('fab') : undefined}
        onMouseLeave={isWeb ? () => setHoveredButton(null) : undefined}
        accessible={true}
        accessibilityLabel="New Chat"
        accessibilityHint="Double tap to start a new conversation"
        accessibilityRole="button"
        role={isWeb ? "button" : undefined}
        tabIndex={isWeb ? 0 : undefined}
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
  avatarContainer: {
    marginRight: 15,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#24269B',
    textAlign: 'center',
    lineHeight: 50,
  },
  conversationInfo: {
    flex: 1,
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
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyImage: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#24269B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#24269B',
    width: 160,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  supporterBadge: {
    backgroundColor: '#24269B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  supporterBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  helperSection: {
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    marginBottom: 20,
    overflow: 'hidden',
  },
  helperHeader: {
    backgroundColor: '#e0e0e0',
    padding: 10,
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 5,
  },
  helperContent: {
    padding: 15,
    alignItems: 'center',
  },
  helperImage: {
    width: 100,
    height: 100,
    marginBottom: 15,
  },
  helperTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#24269B',
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
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    padding: 8,
    borderRadius: 20,
  },
  menuIcon: {
    width: 24,
    height: 24,
    marginRight: 5,
  },
  menuText: {
    fontSize: 14,
    color: '#24269B',
    fontWeight: '600',
  },
  listHeaderSpace: {
    height: 10,
  },
  hiddenMessage: {
    fontStyle: 'italic',
    color: '#999',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  newChatButton: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#24269B',
    marginRight: 10,
  },
  newChatButtonText: {
    color: '#24269B',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#24269B',
    margin: 16,
  },

  // Web-specific styles
  webContainer: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    marginHorizontal: 0,
    height: '100vh',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    flexDirection: 'column',
  },
  webContainerDesktop: {
    minHeight: '100vh',
  },
  webScrollView: {
    flex: 1,
    width: '100%',
    maxWidth: 1200,
    marginHorizontal: 'auto',
    padding: 16,
  },
  webScrollViewDesktop: {
    padding: '20px 32px',
  },
  webCenterContainer: {
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webConversationItem: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    borderBottomWidth: 0,
  },
  webConversationItemHover: {
    backgroundColor: '#f8f9fa',
    transform: [{translateY: -2}],
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
  },
  webConversationItemFocused: {
    backgroundColor: '#e8e8e8',
    boxShadow: '0 0 0 2px #24269B',
    outline: 'none',
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
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    ':hover': {
      transform: 'scale(1.05)',
      backgroundColor: '#e0e0e0',
    },
  },
  webFab: {
    position: 'fixed',
    right: 32,
    bottom: 32,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 1000,
    borderRadius: 28,
    padding: 16,
  },
  webFabHover: {
    transform: 'scale(1.05) translateY(-2px)',
    backgroundColor: '#1a1b6e',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
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
  webHelperTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  webHelperText: {
    fontSize: 16,
    lineHeight: 1.6,
    marginBottom: 8,
  },
  webEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    maxWidth: 500,
    marginLeft: 'auto',
    marginRight: 'auto',
    padding: 40,
  },
  webEmptyImage: {
    width: 200,
    height: 150,
    resizeMode: 'contain',
  },
  webEmptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#24269B',
    textAlign: 'center',
    marginVertical: 20,
  },
  webEmptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 1.5,
  },
  webEmptyButton: {
    backgroundColor: '#24269B',
    padding: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 12,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    ':hover': {
      backgroundColor: '#1a1b6e',
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
    },
  },
  webPageTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#24269B',
    marginBottom: 24,
    textAlign: 'center',
  },
  webLoadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#24269B',
    marginTop: 16,
  },
});

export default ChatMainScreen;