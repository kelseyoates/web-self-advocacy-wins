import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Image,
  Alert,
  Keyboard,
  Dimensions,
  ScrollView,
  AccessibilityInfo
} from 'react-native';
import { CometChat } from '@cometchat-pro/react-native-chat';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as ImagePicker from 'expo-image-picker';

const containsProfanity = (text) => {
  const profanityList = [
    'shit', 'fuck', 'damn', 'ass', 'bitch', 'crap', 'piss',
    'dick', 'pussy', 'cock',
    'bastard', 'hell', 'whore', 'slut', 'asshole', 'cunt',
    'fucker', 'fucking',
  ];

  // Check for email pattern
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  if (emailPattern.test(text)) {
    throw new Error('PERSONAL_INFO_EMAIL');
  }

  // Check for phone number patterns
  const phonePatterns = [
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // 123-456-7890, 123.456.7890, 1234567890
    /\(\d{3}\)\s*\d{3}[-.]?\d{4}/, // (123) 456-7890
    /\b\d{3}\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{4}\b/, // 123 456 7890
  ];

  if (phonePatterns.some(pattern => pattern.test(text))) {
    throw new Error('PERSONAL_INFO_PHONE');
  }

  // Check for profanity
  const words = text.toLowerCase().split(/\s+/);
  if (words.some(word => profanityList.includes(word))) {
    throw new Error('PROFANITY');
  }

  return false;
};

const ChatConversationScreen = ({ route, navigation }) => {
  const { uid, name } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const flatListRef = useRef();
  const [isLoading, setIsLoading] = useState(false);
  const { height: screenHeight } = Dimensions.get('window');
  const [isUploading, setIsUploading] = useState(false);
  const [reportedUsers, setReportedUsers] = useState(new Set());
  const [smartReplies, setSmartReplies] = useState([]);
  const [isLoadingSmartReplies, setIsLoadingSmartReplies] = useState(false);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [isUserBlocked, setIsUserBlocked] = useState(false);
  const [hasShownBlockAlert, setHasShownBlockAlert] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isCheckingBlock, setIsCheckingBlock] = useState(true);

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    try {
      console.log("Fetching messages for:", uid);
      const messagesRequest = new CometChat.MessagesRequestBuilder()
        .setUID(uid)
        .setLimit(50)
        .build();

      const fetchedMessages = await messagesRequest.fetchPrevious();
      console.log("Fetched messages count:", fetchedMessages.length);
      
      // Filter out action, system, and deleted messages
      const validMessages = fetchedMessages.filter(msg => 
        msg.category !== 'action' && 
        msg.category !== 'system' && 
        msg.senderId !== 'app_system' &&
        !msg.deletedAt  // Add this check for deleted messages
      );
      
      console.log("Valid messages count:", validMessages.length);
      setMessages(validMessages);
      
      // Scroll to bottom after fetching
      requestAnimationFrame(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: false });
        }
      });
    } catch (error) {
      console.log("Error fetching messages:", error);
    }
  }, [uid]);

  const getBlockStatus = async () => {
    try {
      const blockedUsersRequest = new CometChat.BlockedUsersRequestBuilder()
        .setLimit(100)
        .build();
      
      const blockedUsers = await blockedUsersRequest.fetchNext();
      console.log('Blocked users list:', blockedUsers);
      
      const isUserBlocked = blockedUsers.some(blockedUser => {
        return blockedUser.uid.toLowerCase() === uid.toLowerCase();
      });
      
      const userObj = await CometChat.getUser(uid);
      console.log('Current user data:', userObj);
      
      const blockStatus = isUserBlocked || userObj.blockedByMe;
      console.log('Final block status:', {
        isUserBlocked,
        blockedByMe: userObj.blockedByMe,
        finalStatus: blockStatus
      });
      
      return blockStatus;
    } catch (error) {
      console.error('Error in getBlockStatus:', error);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const checkBlockStatus = async () => {
      if (!isMounted) return;
      
      const currentBlockStatus = await getBlockStatus();
      if (isMounted && currentBlockStatus !== isBlocked) {
        setIsBlocked(currentBlockStatus);
      }
    };

    // Set up interval for periodic checks
    const interval = setInterval(checkBlockStatus, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      setHasShownBlockAlert(false); // Reset alert state on unmount
    };
  }, [uid]);

  useEffect(() => {
    const initializeChat = async () => {
      try {
        setIsCheckingBlock(true);
        const isUserBlocked = await getBlockStatus();
        console.log('Initial block status:', isUserBlocked);
        setIsBlocked(isUserBlocked);
        
        if (isUserBlocked) {
          if (!hasShownBlockAlert) {
            setHasShownBlockAlert(true);
            Alert.alert(
              'User Blocked',
              'You have blocked this user. Would you like to unblock them to continue chatting?',
              [
                {
                  text: 'Keep Blocked',
                  style: 'cancel',
                  onPress: () => navigation.goBack()
                },
                {
                  text: 'Unblock',
                  onPress: async () => {
                    try {
                      await CometChat.unblockUsers([uid]);
                      const newBlockStatus = await getBlockStatus();
                      setIsBlocked(newBlockStatus);
                      setHasShownBlockAlert(false);
                      
                      if (!newBlockStatus) {
                        Alert.alert(
                          'User Unblocked',
                          'You can now chat with this user.',
                          [{ text: 'OK' }]
                        );
                        const user = await CometChat.getLoggedinUser();
                        setCurrentUser(user);
                        await fetchMessages();
                      } else {
                        Alert.alert('Error', 'User is still blocked. Please try again.');
                      }
                    } catch (error) {
                      console.error('Error unblocking user:', error);
                      Alert.alert('Error', 'Failed to unblock user. Please try again.');
                    }
                  }
                }
              ]
            );
          }
          return; // Don't load messages if blocked
        }

        // Only load messages if not blocked
        const user = await CometChat.getLoggedinUser();
        setCurrentUser(user);
        await fetchMessages();
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setIsCheckingBlock(false);
      }
    };

    initializeChat();
    
    return () => {
      setHasShownBlockAlert(false);
    };
  }, [uid]);

  // Initialize message moderation
  useEffect(() => {
    // Set up message listener with moderation
    const listenerID = "MODERATION_LISTENER_" + Date.now();
    
    CometChat.addMessageListener(
      listenerID,
      new CometChat.MessageListener({
        onTextMessageReceived: message => {
          console.log("Message received:", message);
        },
        onMessageDeleted: message => {
          console.log("Message deleted:", message);
          // Remove deleted message from state
          setMessages(prev => prev.filter(m => m.id !== message.id));
        }
      })
    );

    return () => {
      CometChat.removeMessageListener(listenerID);
    };
  }, []);

  // Add screen reader detection
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

  // Add screen reader announcement helper
  const announceToScreenReader = (message) => {
    if (isScreenReaderEnabled) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  };

  const sendMessage = async () => {
    const currentBlockStatus = await getBlockStatus();
    if (currentBlockStatus) {
      setIsBlocked(true);
      if (!hasShownBlockAlert) { // Only show alert if it hasn't been shown
        setHasShownBlockAlert(true);
        Alert.alert(
          'Cannot Send Message',
          'You cannot send messages while this user is blocked.',
          [{ text: 'OK' }]
        );
      }
      return;
    }

    if (!inputText.trim() || !currentUser) return;

    try {
      containsProfanity(inputText);
      setIsLoading(true);
      announceToScreenReader('Sending message');

      const messageText = inputText.trim();
      const textMessage = new CometChat.TextMessage(
        uid,
        messageText,
        CometChat.RECEIVER_TYPE.USER
      );

      textMessage.setMetadata({
        "extensions": {
          "data-masking": {
            "enabled": true,
            "maskingType": "text",
            "maskWith": "***",
            "patterns": {
              "email": true,
              "phone": true,
              "credit-card": true,
              "ssn": true
            }
          },
          "moderation": {
            "enabled": true,
            "profanity": {
              "enabled": true,
              "action": "mask",
              "severity": "high"
            }
          }
        }
      });

      console.log("Attempting to send message:", {
        text: messageText,
        metadata: textMessage.metadata
      });

      const sentMessage = await CometChat.sendMessage(textMessage);
      console.log("Server response:", sentMessage);

      setInputText('');
      setMessages(prev => {
        const newMessages = [...prev, sentMessage];
        requestAnimationFrame(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        });
        return newMessages;
      });
      announceToScreenReader('Message sent successfully');
    } catch (error) {
      console.log('Error in sendMessage:', error);
      
      // Handle other error cases (profanity, etc)
      switch (error.message) {
        case 'PERSONAL_INFO_EMAIL':
          announceToScreenReader('Message blocked: Contains email address');
          Alert.alert(
            'Personal Information Detected',
            'For your safety, please do not share email addresses in chat messages.'
          );
          return;
        case 'PERSONAL_INFO_PHONE':
          announceToScreenReader('Message blocked: Contains phone number');
          Alert.alert(
            'Personal Information Detected',
            'For your safety, please do not share phone numbers in chat messages.'
          );
          return;
        case 'PROFANITY':
          announceToScreenReader('Message contains inappropriate language');
          Alert.alert(
            'Inappropriate Content',
            'Your message contains inappropriate language. Please revise and try again.'
          );
          return;
        default:
          Alert.alert('Error', 'Failed to send message');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMediaPicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant media library permissions to attach media.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      });

      if (!result.canceled) {
        setIsUploading(true);
        const asset = result.assets[0];
        console.log("Selected media:", asset);

        try {
          const file = {
            name: asset.fileName || `image_${Date.now()}.jpg`,
            type: asset.mimeType || 'image/jpeg',
            uri: Platform.OS === 'ios' ? asset.uri.replace('file://', '') : asset.uri,
            size: asset.fileSize
          };

          const mediaMessage = new CometChat.MediaMessage(
            uid,
            file,
            CometChat.MESSAGE_TYPE.IMAGE,
            CometChat.RECEIVER_TYPE.USER
          );

          mediaMessage.setMetadata({
            "extensions": {
              "moderation": {
                "enabled": true,
                "image": {
                  "enabled": true,
                  "action": "block",
                  "severity": "high"
                }
              }
            }
          });

          console.log("Attempting to send media message:", {
            file: file,
            metadata: mediaMessage.metadata
          });

          const sentMessage = await CometChat.sendMediaMessage(mediaMessage);
          console.log("Media message response:", sentMessage);

          // Check moderation response
          if (sentMessage.metadata?.moderation?.blocked || 
              sentMessage.metadata?.["@injected"]?.extensions?.moderation?.blocked) {
            throw new Error("INAPPROPRIATE_CONTENT");
          }

          setMessages(prev => {
            const newMessages = [...prev, sentMessage];
            requestAnimationFrame(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            });
            return newMessages;
          });
          announceToScreenReader('Image sent successfully');
        } catch (error) {
          console.log("Media send error details:", error);
          
          // More specific error handling
          if (error.message === "INAPPROPRIATE_CONTENT" ||
              error.code === "ERR_CONTENT_MODERATED" ||
              error.code === "MESSAGE_MODERATED" ||
              error.message?.toLowerCase().includes('moderation') ||
              error.message?.toLowerCase().includes('inappropriate')) {
            Alert.alert(
              'Inappropriate Content',
              'This image appears to contain inappropriate or explicit content and cannot be sent. Please choose a different image that follows community guidelines.'
            );
          } else if (error.code === "ERR_FILE_SIZE_TOO_LARGE") {
            Alert.alert(
              'File Too Large',
              'The image file is too large. Please choose a smaller image or compress this one.'
            );
          } else if (error.code === "ERR_INVALID_MEDIA_MESSAGE") {
            Alert.alert(
              'Invalid Image',
              'The selected image could not be processed. Please try a different image.'
            );
          } else {
            Alert.alert(
              'Upload Error',
              'There was a problem sending your image. Please try again.'
            );
          }
        }
      }
    } catch (error) {
      console.log("Media picker error:", error);
      Alert.alert(
        'Error',
        'Failed to process the image. Please try again.'
      );
      announceToScreenReader('Failed to send image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReportUser = async (userId, messageId, reason) => {
    try {
      const reportData = {
        reportedUid: userId,
        messageId: messageId,
        reason: reason
      };

      await CometChat.reportUser(reportData);
      
      // Add user to reported set to prevent multiple reports
      setReportedUsers(prev => new Set(prev).add(userId));
      
      Alert.alert(
        'User Reported',
        'Thank you for helping keep our community safe. This user has been reported for review.'
      );
    } catch (error) {
      console.log("Report user error:", error);
      Alert.alert(
        'Report Failed',
        'Unable to submit report. Please try again later.'
      );
    }
  };

  const handleMessageLongPress = (message) => {
    console.log('Long press detected on message:', message.id);
    
    // Only show delete option for own messages
    const isOwnMessage = message.sender.uid === currentUser?.uid;
    console.log('Is own message:', isOwnMessage);
    console.log('Current user:', currentUser?.uid);
    console.log('Message sender:', message.sender.uid);
    
    Alert.alert(
      isOwnMessage ? 'Message Options' : 'Report Message',
      isOwnMessage ? 'What would you like to do with this message?' : 'Would you like to report this message?',
      [
        {
          text: isOwnMessage ? 'Delete Message' : 'Report Message',
          style: 'destructive',
          onPress: () => {
            if (isOwnMessage) {
              handleDeleteMessage(message);
            } else {
              // Report logic
              if (reportedUsers.has(message.sender.uid)) {
                Alert.alert('Already Reported', 'You have already reported this user.');
                return;
              }
              Alert.alert(
                'Report Reason',
                'Why are you reporting this message?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Inappropriate Content',
                    onPress: () => handleReportUser(message.sender.uid, message.id, 'inappropriate_content')
                  },
                  {
                    text: 'Personal Information',
                    onPress: () => handleReportUser(message.sender.uid, message.id, 'personal_information')
                  },
                  {
                    text: 'Harassment',
                    onPress: () => handleReportUser(message.sender.uid, message.id, 'harassment')
                  }
                ]
              );
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender?.uid === currentUser?.uid;
    const timestamp = new Date(item.sentAt * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    return (
      <TouchableOpacity
        onLongPress={() => {
          console.log('Long press triggered');
          handleMessageLongPress(item);
        }}
        delayLongPress={500}
        accessible={true}
        accessibilityLabel={`${isMyMessage ? 'Your' : item.sender?.name + "'s"} message: ${item.text}. Sent at ${timestamp}. Long press for options.`}
        accessibilityHint="Double tap and hold to open message options"
      >
        <View style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.theirMessage
        ]}>
          {!isMyMessage && (
            <Text style={styles.senderName}>{item.sender?.name}</Text>
          )}
          
          {item.type === 'text' && (
            <Text style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.theirMessageText
            ]}>
              {item.text}
            </Text>
          )}
          
          {item.type === 'image' && (
            <Image
              source={{ uri: item.data?.url }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          )}
          
          <Text style={[
            styles.timestamp,
            isMyMessage ? styles.myTimestamp : styles.theirTimestamp
          ]}>
            {timestamp}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  console.log("Rendering with messages count:", messages.length);

  useEffect(() => {
    const setNavigationHeader = async () => {
      try {
        // First get user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', uid));
        const userData = userDoc.data();
        
        // Then get CometChat user data
        const cometChatUser = await CometChat.getUser(uid);
        
        navigation.setOptions({
          headerTitle: () => (
            <TouchableOpacity 
              style={styles.headerContainer}
              onPress={() => {
                console.log('Header tapped');
                navigation.navigate('OtherUserProfile', {
                  profileUserId: uid,
                  username: userData?.name || cometChatUser.name || name || 'User',
                  isCurrentUser: false
                });
              }}
              accessible={true}
              accessibilityLabel={`View ${userData?.name || cometChatUser.name || name || 'User'}'s profile`}
              accessibilityRole="button"
              activeOpacity={0.6}
            >
              <Image 
                source={{ 
                  uri: userData?.profilePicture || 
                       'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y' 
                }} 
                style={styles.headerAvatar}
              />
              <Text style={styles.headerTitle}>
                {userData?.name || cometChatUser.name || name || 'Chat'}
              </Text>
            </TouchableOpacity>
          ),
          headerTitleAlign: 'left',
        });
      } catch (error) {
        console.log("Error fetching user details:", error);
        // Fallback to using name from route params
        navigation.setOptions({
          headerTitle: name || 'Chat',
        });
      }
    };

    setNavigationHeader();
  }, [navigation, uid, name]);

  // Add this function to handle smart replies
  const getSmartReplies = async (message) => {
    try {
      setIsLoadingSmartReplies(true);
      if (!message || !message.text) return;

      const smartReplyObject = new CometChat.SmartRepliesBuilder()
        .setMessage(message)
        .build();

      const replies = await smartReplyObject.fetchReplies();
      console.log('Smart replies:', replies);
      setSmartReplies(replies || []);
    } catch (error) {
      console.error('Error getting smart replies:', error);
      setSmartReplies([]);
    } finally {
      setIsLoadingSmartReplies(false);
    }
  };

  // Update your message listener to get smart replies for the last message
  useEffect(() => {
    const listenerID = "CHAT_SCREEN_" + Date.now();
    
    CometChat.addMessageListener(
      listenerID,
      new CometChat.MessageListener({
        onTextMessageReceived: message => {
          console.log("Message received:", message);
          setMessages(prev => [...prev, message]);
          // Get smart replies for the received message
          getSmartReplies(message);
          
          // Scroll to bottom
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          });
        }
      })
    );

    return () => {
      CometChat.removeMessageListener(listenerID);
    };
  }, []);

  // Add this function to handle smart reply selection
  const handleSmartReplyPress = async (reply) => {
    try {
      setInputText(reply);
      setSmartReplies([]); // Clear smart replies
      await sendMessage(reply);
    } catch (error) {
      console.error('Error sending smart reply:', error);
    }
  };

  // Add the smart replies component to your render
  const renderSmartReplies = () => {
    if (smartReplies.length === 0) return null;

    return (
      <View 
        style={styles.smartRepliesContainer}
        accessible={true}
        accessibilityLabel="Quick reply suggestions"
      >
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.smartRepliesContent}
        >
          {smartReplies.map((reply, index) => (
            <TouchableOpacity
              key={index}
              style={styles.smartReplyButton}
              onPress={() => handleSmartReplyPress(reply)}
              accessible={true}
              accessibilityLabel={`Quick reply: ${reply}`}
              accessibilityHint="Double tap to send this reply"
              accessibilityRole="button"
            >
              <Text style={styles.smartReplyText}>{reply}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Add this function near your other handlers
  const handleDeleteMessage = async (message) => {
    try {
      console.log('Attempting to delete message:', message.id);
      
      // Delete the message from CometChat
      await CometChat.deleteMessage(message.id);
      console.log('Message deleted from CometChat');
      
      // Remove message from local state - ensure we're matching the exact message
      setMessages(prevMessages => {
        const updatedMessages = prevMessages.filter(msg => {
          console.log('Comparing message IDs:', msg.id, message.id);
          return msg.id.toString() !== message.id.toString();
        });
        console.log('Messages before:', prevMessages.length, 'Messages after:', updatedMessages.length);
        return updatedMessages;
      });
      
      // Show success message
      Alert.alert(
        'Success',
        'Message deleted successfully'
      );
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert(
        'Error',
        'Failed to delete message. Please try again.'
      );
    }
  };

  // Also update the message listener to handle deleted messages
  useEffect(() => {
    const listenerID = "MESSAGE_LISTENER_" + Date.now();
    
    CometChat.addMessageListener(
      listenerID,
      new CometChat.MessageListener({
        onTextMessageReceived: message => {
          console.log("New message received:", message);
          if (message.sender.uid === uid || message.receiver.uid === uid) {
            setMessages(prev => [...prev, message]);
          }
        },
        onMessageDeleted: deletedMessage => {
          console.log("Message deleted:", deletedMessage);
          setMessages(prev => prev.filter(msg => msg.id.toString() !== deletedMessage.id.toString()));
        }
      })
    );

    return () => {
      CometChat.removeMessageListener(listenerID);
    };
  }, [uid]);

  const renderInputContainer = () => (
    <View style={styles.inputContainer}>
      <TouchableOpacity 
        style={styles.attachButton} 
        onPress={handleMediaPicker}
        disabled={isBlocked || isUploading || isLoading}
      >
        <MaterialCommunityIcons 
          name="attachment" 
          size={36} 
          color={(isBlocked || isUploading || isLoading) ? "#999" : "#24269B"} 
        />
      </TouchableOpacity>

      <TextInput
        style={[styles.input, isBlocked && styles.disabledInput]}
        value={inputText}
        onChangeText={setInputText}
        placeholder={isBlocked ? "User is blocked" : "Type a message..."}
        multiline
        editable={!isBlocked && !isLoading && !isUploading}
      />

      <TouchableOpacity 
        style={styles.sendButton} 
        onPress={sendMessage}
        disabled={isBlocked || isLoading || isUploading || !inputText.trim()}
      >
        <MaterialCommunityIcons 
          name="send" 
          size={36} 
          color={(isBlocked || isLoading || isUploading || !inputText.trim()) ? "#999" : "#24269B"} 
        />
      </TouchableOpacity>
    </View>
  );

  if (isBlocked) {
    return (
      <View style={styles.container}>
        <Text style={styles.blockedMessage}>
          This user is blocked. Unblock them to send messages.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { height: screenHeight }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 150 : 0}
      accessible={true}
      accessibilityLabel="Chat conversation"
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.messageList}
        accessibilityLabel={`${messages.length} messages`}
        accessibilityHint="Scroll to read messages"
        onContentSizeChange={() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: false });
          }
        }}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>No messages yet</Text>
        )}
      />
      
      {renderSmartReplies()}

      {renderInputContainer()}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  messageList: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  headerButton: {
    marginRight: 15,
  },
  messageContainer: {
    padding: 10,
    marginVertical: 2,
    maxWidth: '80%',
    borderRadius: 15,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#24269B',
    borderBottomRightRadius: 5,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8E8E8',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#000000',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: '#f0f0f0',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  attachButton: {
    padding: 10,
    marginRight: 5,
  },
  input: {
    flex: 1,
    marginRight: 10,
    padding: 10,
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
    maxHeight: 100,
    height: 60,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  sendButton: {
    padding: 10,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#999',
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 2,
  },
  myTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    alignSelf: 'flex-end',
  },
  theirTimestamp: {
    color: '#666',
    alignSelf: 'flex-start',
  },
  headerProfilePic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  headerUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  smartRepliesContainer: {
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 8,
  },
  smartRepliesContent: {
    paddingHorizontal: 8,
  },
  smartReplyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  smartReplyText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  disabledInput: {
    backgroundColor: '#f0f0f0',
    color: '#999',
  },
  blockedMessage: {
    textAlign: 'center',
    padding: 20,
    color: '#666',
    fontSize: 16,
  },
});

export default ChatConversationScreen; 