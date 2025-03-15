import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { CometChat } from '@cometchat-pro/chat';
import { COMETCHAT_CONSTANTS } from '../config/cometChatConfig';

const isWeb = Platform.OS === 'web';

const SupportedUserChatScreen = ({ route, navigation }) => {
  const { supportedUser } = route.params;
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [originalUser, setOriginalUser] = useState(null);

  const handleKeyPress = (e, action) => {
    if (isWeb && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      action();
    }
  };

  useEffect(() => {
    console.log('Supported user data:', supportedUser);
    const supportedUserId = supportedUser?.uid;
    
    if (!supportedUserId) {
      console.error('No supported user ID provided');
      setIsLoading(false);
      return;
    }

    navigation.setOptions({
      title: `${supportedUser.username}'s Chats`
    });

    const fetchSupportedUserChats = async () => {
      try {
        setIsLoading(true);

        // Store current user
        const currentUser = await CometChat.getLoggedInUser();
        setOriginalUser(currentUser);
        
        // Logout current user
        await CometChat.logout();
        
        // Login as supported user
        console.log('Logging in as supported user:', supportedUserId);
        await CometChat.login(supportedUserId, COMETCHAT_CONSTANTS.AUTH_KEY);
        
        // Get conversations
        const conversationsRequest = new CometChat.ConversationsRequestBuilder()
          .setLimit(50)
          .build();

        const fetchedConversations = await conversationsRequest.fetchNext();
        console.log('Supported user conversations:', fetchedConversations);
        setConversations(fetchedConversations || []);

        // Log back in as original user
        await CometChat.logout();
        await CometChat.login(currentUser.uid, COMETCHAT_CONSTANTS.AUTH_KEY);

      } catch (error) {
        console.error('Error fetching supported user chats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSupportedUserChats();

    // Set up real-time listener
    const listenerID = `SUPPORTED_USER_CHATS_${supportedUserId}`;
    
    CometChat.addMessageListener(
      listenerID,
      new CometChat.MessageListener({
        onTextMessageReceived: message => {
          if (message.sender?.uid === supportedUserId || 
              message.receiverId === supportedUserId) {
            console.log("New message in supported user chat:", message);
            setConversations(prevConversations => {
              const updatedConversations = [...prevConversations];
              const conversationIndex = updatedConversations.findIndex(
                conv => conv.conversationId === message.conversationId
              );
              
              if (conversationIndex !== -1) {
                updatedConversations[conversationIndex].lastMessage = message;
              }
              
              return updatedConversations;
            });
          }
        }
      })
    );

    return () => {
      // Clean up listener
      CometChat.removeMessageListener(listenerID);
      
      // Ensure we switch back to original user if component unmounts
      if (originalUser) {
        CometChat.logout().then(() => {
          CometChat.login(originalUser.uid, COMETCHAT_CONSTANTS.AUTH_KEY);
        });
      }
    };
  }, [supportedUser, navigation]);

  const renderConversation = ({ item }) => {
    const otherUser = item.conversationWith;
    const lastMessage = item.lastMessage;
    const isGroupChat = item.conversationType === 'group';
    const timestamp = lastMessage?.sentAt ? 
      new Date(lastMessage.sentAt * 1000).toLocaleDateString() : 
      'No date';

    const getMessagePreview = (message) => {
      if (!message) return 'No messages';
      
      switch (message.type) {
        case 'text':
          return message.text;
        case 'image':
          return '📷 Image';
        case 'video':
          return '🎥 Video';
        default:
          return 'Message';
      }
    };

    const navigateToDetails = () => {
      navigation.navigate(
        isGroupChat ? 'SupportedUserGroupChatDetails' : 'SupportedUserChatDetails',
        {
          conversation: item,
          supportedUser: supportedUser
        }
      );
    };

    return (
      <TouchableOpacity 
        style={[
          styles.conversationItem,
          isWeb && styles.webConversationItem
        ]}
        onPress={navigateToDetails}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${isGroupChat ? 'Group chat' : 'Chat'} with ${otherUser?.name || 'Unknown User'}. Last message: ${getMessagePreview(lastMessage)}. ${timestamp}`}
        accessibilityHint={`Double tap to view ${isGroupChat ? 'group chat' : 'chat'} details`}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => handleKeyPress(e, navigateToDetails)}
      >
        <View 
          style={[
            styles.conversationHeader,
            isWeb && styles.webConversationHeader
          ]}
          accessible={true}
          accessibilityRole="text"
        >
          <Text style={[
            styles.userName,
            isWeb && styles.webUserName
          ]}>
            {otherUser?.name || 'Unknown User'}
          </Text>
          <Text style={[
            styles.timestamp,
            isWeb && styles.webTimestamp
          ]}>
            {timestamp}
          </Text>
        </View>
        <Text style={[
          styles.lastMessage,
          isWeb && styles.webLastMessage
        ]}>
          {getMessagePreview(lastMessage)}
        </Text>
        <Text 
          style={[
            styles.readOnlyBadge,
            isWeb && styles.webReadOnlyBadge
          ]}
          accessibilityRole="text"
        >
          {isGroupChat ? 'Read Only Group' : 'Read Only'}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View 
        style={[
          styles.loadingContainer,
          isWeb && styles.webLoadingContainer
        ]}
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading conversations"
      >
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View 
      style={[
        styles.container,
        isWeb && styles.webContainer
      ]}
      accessible={true}
      accessibilityRole="text"
    >
      {conversations.length > 0 ? (
        isWeb ? (
          <ScrollView 
            style={styles.webListContainer}
            role="list"
            aria-label={`${supportedUser.username}'s conversations`}
          >
            {conversations.map((item) => (
              <React.Fragment key={item.conversationId}>
                {renderConversation({ item })}
              </React.Fragment>
            ))}
          </ScrollView>
        ) : (
          <FlatList
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={(item) => item.conversationId}
            contentContainerStyle={styles.listContainer}
            accessibilityRole="list"
            accessibilityLabel={`${supportedUser.username}'s conversations`}
          />
        )
      ) : (
        <View 
          style={[
            styles.emptyContainer,
            isWeb && styles.webEmptyContainer
          ]}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="No conversations found"
        >
          <Text style={[
            styles.emptyText,
            isWeb && styles.webEmptyText
          ]}>
            No conversations found
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  conversationItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#F8F8F8', // Light background to indicate read-only
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  lastMessage: {
    fontSize: 14,
    color: '#444',
  },
  readOnlyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },

  // Web-specific styles
  webContainer: {
    maxWidth: 1200,
    marginHorizontal: 'auto',
    height: '100vh',
    backgroundColor: '#ffffff',
    padding: 32,
  },
  webLoadingContainer: {
    height: '100vh',
  },
  webListContainer: {
    padding: 16,
  },
  webConversationItem: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    borderRadius: 12,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#f8f9fa',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    },
    ':focus': {
      outline: '2px solid #24269B',
      outlineOffset: '2px',
    },
  },
  webConversationHeader: {
    marginBottom: 12,
  },
  webUserName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#24269B',
  },
  webTimestamp: {
    fontSize: 14,
    color: '#666',
  },
  webLastMessage: {
    fontSize: 16,
    color: '#444',
    marginBottom: 8,
  },
  webReadOnlyBadge: {
    backgroundColor: '#f0f0f0',
    color: '#666',
    padding: '6px 12px',
    borderRadius: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  webEmptyContainer: {
    height: '100vh',
  },
  webEmptyText: {
    fontSize: 18,
    color: '#666',
  },
});

export default SupportedUserChatScreen; 