import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  ScrollView
} from 'react-native';
import { CometChat } from '@cometchat-pro/chat';
import { COMETCHAT_CONSTANTS } from '../config/cometChatConfig';

const isWeb = Platform.OS === 'web';

const SupportedUserChatDetailsScreen = ({ route, navigation }) => {
  const { conversation, supportedUser } = route.params;
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [originalUser, setOriginalUser] = useState(null);
  const scrollViewRef = useRef();

  useEffect(() => {
    navigation.setOptions({
      title: conversation.conversationWith.name || 'Chat Details'
    });

    const fetchMessages = async () => {
      try {
        setIsLoading(true);

        // Store current user
        const currentUser = await CometChat.getLoggedInUser();
        setOriginalUser(currentUser);
        
        // Logout current user
        await CometChat.logout();
        
        // Login as supported user
        await CometChat.login(supportedUser.uid, COMETCHAT_CONSTANTS.AUTH_KEY);
        
        // Get messages
        const messagesRequest = new CometChat.MessagesRequestBuilder()
          .setUID(conversation.conversationWith.uid)
          .setLimit(50)
          .build();

        const fetchedMessages = await messagesRequest.fetchPrevious();
        console.log('Fetched messages:', fetchedMessages?.length);
        
        // Filter out system messages if needed
        const validMessages = fetchedMessages.filter(msg => 
          msg.category === 'message' && 
          (msg.type === 'text' || msg.type === 'image')
        );

        setMessages(validMessages.reverse());

        // Log back in as original user
        await CometChat.logout();
        await CometChat.login(currentUser.uid, COMETCHAT_CONSTANTS.AUTH_KEY);

      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();

    // Set up message listener
    const listenerID = `SUPPORTED_CHAT_${conversation.conversationId}`;
    
    CometChat.addMessageListener(
      listenerID,
      new CometChat.MessageListener({
        onTextMessageReceived: message => {
          if (message.conversationId === conversation.conversationId) {
            setMessages(prev => [...prev, message]);
            // Scroll to bottom on new message
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }
        }
      })
    );

    return () => {
      CometChat.removeMessageListener(listenerID);
      // Ensure we switch back to original user if component unmounts
      if (originalUser) {
        CometChat.logout().then(() => {
          CometChat.login(originalUser.uid, COMETCHAT_CONSTANTS.AUTH_KEY);
        });
      }
    };
  }, [conversation, supportedUser, navigation]);

  const renderMessage = ({ item }) => {
    const isSupported = item.sender.uid === supportedUser.uid;
    const timestamp = new Date(item.sentAt * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return (
      <View style={[
        styles.messageContainer,
        isSupported ? styles.supportedMessage : styles.otherMessage,
        isWeb && styles.webMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isSupported ? styles.supportedBubble : styles.otherBubble,
          isWeb && styles.webMessageBubble
        ]}>
          {/* Handle image messages */}
          {item.type === 'image' && (
            <Image
              source={{ uri: item.data.url }}
              style={[
                styles.mediaContent,
                isWeb && styles.webMediaContent
              ]}
              resizeMode="contain"
              alt={`Image sent by ${item.sender.name}`}
            />
          )}

          {/* Text content */}
          {item.text && (
            <Text style={[
              styles.messageText,
              isSupported ? styles.supportedText : styles.otherText,
              isWeb && styles.webMessageText
            ]}>
              {item.text}
            </Text>
          )}
          
          <Text style={[
            styles.timestamp,
            isWeb && styles.webTimestamp
          ]}>
            {timestamp}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[
        styles.loadingContainer,
        isWeb && styles.webLoadingContainer
      ]}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      isWeb && styles.webContainer
    ]}>
      <Text style={[
        styles.readOnlyBanner,
        isWeb && styles.webReadOnlyBanner
      ]}>
        Read Only View
      </Text>
      
      {isWeb ? (
        <ScrollView
          ref={scrollViewRef}
          style={styles.webMessagesList}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((item) => (
            <React.Fragment key={item.id}>
              {renderMessage({ item })}
            </React.Fragment>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          ref={scrollViewRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd()}
          onLayout={() => scrollViewRef.current?.scrollToEnd()}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    elevation: 1,
  },
  supportedMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  supportedBubble: {
    backgroundColor: '#007AFF',
    marginLeft: 'auto',
    borderTopRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#E8E8E8',
    marginRight: 'auto',
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  supportedText: {
    color: '#FFFFFF',
  },
  otherText: {
    color: '#000000',
  },
  timestamp: {
    fontSize: 12,
    color: '#888888',
    alignSelf: 'flex-end',
  },
  readOnlyBanner: {
    backgroundColor: '#FFE4E1',
    color: '#FF6B6B',
    textAlign: 'center',
    padding: 8,
    fontSize: 14,
    fontWeight: 'bold',
  },
  mediaContent: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginVertical: 4,
  },
  // Web-specific styles
  webContainer: {
    maxWidth: 1200,
    marginHorizontal: 'auto',
    height: '100vh',
    backgroundColor: '#ffffff',
  },
  webLoadingContainer: {
    height: '100vh',
  },
  webMessagesList: {
    flex: 1,
    padding: 24,
  },
  webMessageContainer: {
    marginBottom: 16,
    transition: 'transform 0.2s ease',
    ':hover': {
      transform: 'translateY(-2px)',
    },
  },
  webMessageBubble: {
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    padding: 16,
    borderRadius: 12,
    maxWidth: '70%',
  },
  webMessageText: {
    fontSize: 16,
    lineHeight: 1.5,
  },
  webTimestamp: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  webMediaContent: {
    maxWidth: 400,
    maxHeight: 400,
    borderRadius: 8,
    marginVertical: 8,
  },
  webReadOnlyBanner: {
    backgroundColor: '#FFE4E1',
    color: '#FF6B6B',
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    borderBottom: '1px solid #FFD1D1',
  },
});

export default SupportedUserChatDetailsScreen; 