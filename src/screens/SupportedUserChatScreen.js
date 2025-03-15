import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { CometChat } from '@cometchat-pro/react-native-chat';
import { COMETCHAT_CONSTANTS } from '../config/cometChatConfig';

const SupportedUserChatScreen = ({ route, navigation }) => {
  const { supportedUser } = route.params;
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [originalUser, setOriginalUser] = useState(null);

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

    // Get appropriate preview text based on message type
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

    return (
      <TouchableOpacity 
        style={styles.conversationItem}
        onPress={() => navigation.navigate(
          isGroupChat ? 'SupportedUserGroupChatDetails' : 'SupportedUserChatDetails',
          {
            conversation: item,
            supportedUser: supportedUser
          }
        )}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${isGroupChat ? 'Group chat' : 'Chat'} with ${otherUser?.name || 'Unknown User'}. Last message: ${getMessagePreview(lastMessage)}. ${timestamp}`}
        accessibilityHint={`Double tap to view ${isGroupChat ? 'group chat' : 'chat'} details`}
      >
        <View 
          style={styles.conversationHeader}
          accessible={true}
          accessibilityRole="text"
        >
          <Text style={styles.userName}>
            {otherUser?.name || 'Unknown User'}
          </Text>
          <Text style={styles.timestamp}>
            {timestamp}
          </Text>
        </View>
        <Text style={styles.lastMessage}>
          {getMessagePreview(lastMessage)}
        </Text>
        <Text 
          style={styles.readOnlyBadge}
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
        style={styles.loadingContainer}
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
      style={styles.container}
      accessible={true}
      accessibilityRole="text"
    >
      {conversations.length > 0 ? (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.conversationId}
          contentContainerStyle={styles.listContainer}
          accessibilityRole="list"
          accessibilityLabel={`${supportedUser.username}'s conversations`}
        />
      ) : (
        <View 
          style={styles.emptyContainer}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="No conversations found"
        >
          <Text style={styles.emptyText}>No conversations found</Text>
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
});

export default SupportedUserChatScreen; 