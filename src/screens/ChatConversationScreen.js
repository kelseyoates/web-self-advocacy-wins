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
  AccessibilityInfo,
  ActivityIndicator
} from 'react-native';
import { CometChat } from '@cometchat-pro/react-native-chat';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as ImagePicker from 'expo-image-picker';
import { auth } from '../config/firebase';
import { COMETCHAT_CONSTANTS } from '../config/cometChatConfig';

// Detect if running on web
const isWeb = Platform.OS === 'web';

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
  const [error, setError] = useState('');
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
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
      console.error("Error fetching messages:", error);
      setError("Failed to load messages. Please try again.");
    } finally {
      setIsLoading(false);
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

  const initializeChat = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Check if user is logged in to CometChat
      const loggedInUser = await CometChat.getLoggedinUser();
      
      if (!loggedInUser) {
        console.log("No user logged in to CometChat, attempting login");
        
        try {
          // Get current Firebase user
          const currentUser = auth.currentUser;
          if (!currentUser) {
            throw new Error("No Firebase user found");
          }
          
          // Login to CometChat
          await CometChat.login(currentUser.uid.toLowerCase(), COMETCHAT_CONSTANTS.AUTH_KEY);
          console.log("CometChat login successful");
        } catch (loginError) {
          console.error("CometChat login error:", loginError);
          
          if (isWeb) {
            setError("There was an issue connecting to the chat service. Some features may be limited. You can still view messages.");
            // Continue anyway - we'll still try to fetch messages
          } else {
            throw loginError; // For mobile, propagate the error
          }
        }
      }
      
      // Set current user
      setCurrentUser(loggedInUser || { uid: auth.currentUser?.uid.toLowerCase() });
      
      // Fetch messages
      await fetchMessages();
      
      // Add message listener
      try {
        CometChat.addMessageListener(
          `MESSAGE_LISTENER_${uid}`,
          new CometChat.MessageListener({
            onTextMessageReceived: message => {
              console.log("Text message received:", message);
              if (message.sender.uid !== auth.currentUser?.uid.toLowerCase() && 
                  message.receiverId === auth.currentUser?.uid.toLowerCase()) {
                setMessages(prev => [...prev, message]);
                
                // Get smart replies for the received message
                getSmartReplies(message);
                
                // Scroll to bottom
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }
            },
            onMediaMessageReceived: message => {
              console.log("Media message received:", message);
              if (message.sender.uid !== auth.currentUser?.uid.toLowerCase() && 
                  message.receiverId === auth.currentUser?.uid.toLowerCase()) {
                setMessages(prev => [...prev, message]);
                
                // Scroll to bottom
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }
            },
            onMessagesDelivered: messageReceipt => {
              console.log("Message delivered:", messageReceipt);
            },
            onMessagesRead: messageReceipt => {
              console.log("Message read:", messageReceipt);
            },
            onMessageDeleted: message => {
              console.log("Message deleted:", message);
              setMessages(prev => prev.filter(m => m.id !== message.id));
            }
          })
        );
      } catch (listenerError) {
        console.error("Error adding message listener:", listenerError);
        if (isWeb) {
          setError("There was an issue with the chat connection. Messages may not update in real-time.");
        }
      }
      
      // Set navigation header
      setNavigationHeader();
      
      // Check block status
      await checkBlockStatus();
    } catch (error) {
      console.error("Error initializing chat:", error);
      
      if (isWeb) {
        // For web, show error but don't prevent viewing messages
        setError("There was an issue connecting to the chat service. Some features may be limited.");
        
        // Try to fetch messages anyway
        try {
          await fetchMessages();
        } catch (fetchError) {
          console.error("Error fetching messages after initialization error:", fetchError);
          setError("Failed to load messages. Please try refreshing the page.");
        }
      } else {
        // For mobile, show alert
        Alert.alert(
          'Connection Error',
          'Failed to connect to the chat service. Please try again later.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize message moderation
  useEffect(() => {
    const checkScreenReader = async () => {
      try {
        const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
        setIsScreenReaderEnabled(screenReaderEnabled);
      } catch (error) {
        console.log('Error checking screen reader:', error);
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

    initializeChat();
    
    // Cleanup function
    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
      
      // Remove message listener
      try {
        CometChat.removeMessageListener(`MESSAGE_LISTENER_${uid}`);
        console.log("Message listener removed");
      } catch (error) {
        console.error("Error removing message listener:", error);
      }
    };
  }, [navigation, uid, name]);

  // Add screen reader announcement helper
  const announceToScreenReader = (message) => {
    if (isScreenReaderEnabled && !isWeb) {
      AccessibilityInfo.announceForAccessibility(message);
    } else if (isWeb && isScreenReaderEnabled) {
      // For web with screen readers, we could use ARIA live regions
      setError(message);
    }
  };

  const showAlert = (title, message, buttons) => {
    if (isWeb) {
      // For web, use a more web-friendly approach
      setError(message);
      // You could also use a modal or toast component here
    } else {
      // For mobile, use Alert
      Alert.alert(title, message, buttons || [{ text: 'OK' }]);
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
      if (isWeb) {
        // Web-specific file picker
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        
        fileInput.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          
          setIsUploading(true);
          announceToScreenReader('Uploading image');
          
          try {
            // Create a unique file name
            const fileName = `${Date.now()}_${file.name}`;
            
            // Create a CometChat media message
            const receiverID = uid;
            const messageType = CometChat.MESSAGE_TYPE.IMAGE;
            const receiverType = CometChat.RECEIVER_TYPE.USER;
            
            // For web, we need to convert the file to a blob URL
            const reader = new FileReader();
            reader.onload = async (event) => {
              const blob = new Blob([event.target.result], { type: file.type });
              
              // Create a media message with the blob
              const mediaMessage = new CometChat.MediaMessage(
                receiverID,
                blob,
                messageType,
                receiverType
              );
              
              // Set some metadata
              mediaMessage.setMetadata({
                fileName: fileName,
                fileType: file.type,
                fileSize: file.size
              });
              
              try {
                // Send the message
                const sentMessage = await CometChat.sendMediaMessage(mediaMessage);
                console.log("Media message sent successfully:", sentMessage);
                
                // Add the message to the list
                setMessages(prevMessages => [...prevMessages, sentMessage]);
                
                // Scroll to the bottom
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
                
                announceToScreenReader('Image sent');
              } catch (error) {
                console.error("Error sending media message:", error);
                setError("Failed to send image. Please try again.");
                announceToScreenReader('Failed to send image');
              } finally {
                setIsUploading(false);
              }
            };
            
            reader.readAsArrayBuffer(file);
          } catch (error) {
            console.error("Error processing file:", error);
            setError("Failed to process image. Please try again.");
            setIsUploading(false);
            announceToScreenReader('Failed to process image');
          }
        };
        
        // Trigger the file input click
        fileInput.click();
      } else {
        // Mobile image picker
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'You need to grant permission to access your photos');
          return;
        }
        
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
        
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const selectedImage = result.assets[0];
          setIsUploading(true);
          announceToScreenReader('Uploading image');
          
          try {
            // Create a unique file name
            const uri = selectedImage.uri;
            const fileExtension = uri.split('.').pop();
            const fileName = `${Date.now()}.${fileExtension}`;
            
            // Create a CometChat media message
            const receiverID = uid;
            const messageType = CometChat.MESSAGE_TYPE.IMAGE;
            const receiverType = CometChat.RECEIVER_TYPE.USER;
            
            const mediaMessage = new CometChat.MediaMessage(
              receiverID,
              uri,
              messageType,
              receiverType
            );
            
            // Send the message
            const sentMessage = await CometChat.sendMediaMessage(mediaMessage);
            console.log("Media message sent successfully:", sentMessage);
            
            // Add the message to the list
            setMessages(prevMessages => [...prevMessages, sentMessage]);
            
            // Scroll to the bottom
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
            
            announceToScreenReader('Image sent');
          } catch (error) {
            console.error("Error sending media message:", error);
            Alert.alert('Error', 'Failed to send image. Please try again.');
            announceToScreenReader('Failed to send image');
          } finally {
            setIsUploading(false);
          }
        }
      }
    } catch (error) {
      console.error("Error in media picker:", error);
      showAlert('Error', 'Failed to open image picker. Please try again.');
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
    if (isWeb) {
      // For web, we'll use a context menu
      setSelectedMessage(message);
      setContextMenuVisible(true);
      return;
    }

    // For mobile, use Alert
    const isMyMessage = message.sender?.uid === currentUser?.uid;
    const options = [];

    if (isMyMessage) {
      options.push({
        text: 'Delete',
        onPress: () => handleDeleteMessage(message),
        style: 'destructive'
      });
    } else {
      if (!reportedUsers.has(message.sender?.uid)) {
        options.push({
          text: 'Report',
          onPress: () => {
            Alert.alert(
              'Report Message',
              'Why are you reporting this message?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Inappropriate Content', onPress: () => handleReportUser(message.sender?.uid, message.id, 'inappropriate') },
                { text: 'Harassment', onPress: () => handleReportUser(message.sender?.uid, message.id, 'harassment') },
                { text: 'Spam', onPress: () => handleReportUser(message.sender?.uid, message.id, 'spam') }
              ]
            );
          },
          style: 'destructive'
        });
      }

      options.push({
        text: isUserBlocked ? 'Unblock User' : 'Block User',
        onPress: async () => {
          try {
            if (isUserBlocked) {
              await CometChat.unblockUsers([message.sender?.uid]);
              setIsUserBlocked(false);
              announceToScreenReader('User unblocked');
            } else {
              await CometChat.blockUsers([message.sender?.uid]);
              setIsUserBlocked(true);
              announceToScreenReader('User blocked');
            }
          } catch (error) {
            console.error('Error blocking/unblocking user:', error);
            showAlert('Error', 'Failed to block/unblock user. Please try again.');
          }
        },
        style: 'destructive'
      });
    }

    options.unshift({ text: 'Cancel', style: 'cancel' });

    Alert.alert(
      'Message Options',
      '',
      options
    );
  };

  // Web-specific context menu for messages
  const renderContextMenu = () => {
    if (!isWeb || !contextMenuVisible || !selectedMessage) {
      return null;
    }

    const isMyMessage = selectedMessage.sender?.uid === currentUser?.uid;
    
    return (
      <View 
        style={[
          styles.contextMenu,
          {
            position: 'absolute',
            top: contextMenuPosition.y,
            left: contextMenuPosition.x,
          }
        ]}
      >
        {isMyMessage ? (
          <TouchableOpacity 
            style={styles.contextMenuItem}
            onPress={() => {
              handleDeleteMessage(selectedMessage);
              setContextMenuVisible(false);
            }}
          >
            <Text style={styles.contextMenuItemText}>Delete</Text>
          </TouchableOpacity>
        ) : (
          <>
            {!reportedUsers.has(selectedMessage.sender?.uid) && (
              <TouchableOpacity 
                style={styles.contextMenuItem}
                onPress={() => {
                  handleReportUser(selectedMessage.sender?.uid, selectedMessage.id, 'inappropriate');
                  setContextMenuVisible(false);
                }}
              >
                <Text style={styles.contextMenuItemText}>Report</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.contextMenuItem}
              onPress={async () => {
                try {
                  if (isUserBlocked) {
                    await CometChat.unblockUsers([selectedMessage.sender?.uid]);
                    setIsUserBlocked(false);
                    announceToScreenReader('User unblocked');
                  } else {
                    await CometChat.blockUsers([selectedMessage.sender?.uid]);
                    setIsUserBlocked(true);
                    announceToScreenReader('User blocked');
                  }
                  setContextMenuVisible(false);
                } catch (error) {
                  console.error('Error blocking/unblocking user:', error);
                  setError('Failed to block/unblock user. Please try again.');
                  setContextMenuVisible(false);
                }
              }}
            >
              <Text style={styles.contextMenuItemText}>
                {isUserBlocked ? 'Unblock User' : 'Block User'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  // Close context menu when clicking outside
  useEffect(() => {
    if (isWeb && contextMenuVisible) {
      const handleClickOutside = () => {
        setContextMenuVisible(false);
      };
      
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [isWeb, contextMenuVisible]);

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
        onContextMenu={isWeb ? (e) => {
          e.preventDefault();
          setContextMenuPosition({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
          handleMessageLongPress(item);
        } : undefined}
        delayLongPress={500}
        accessible={true}
        accessibilityLabel={`${isMyMessage ? 'Your' : item.sender?.name + "'s"} message: ${item.text}. Sent at ${timestamp}. ${isWeb ? 'Right click' : 'Long press'} for options.`}
        accessibilityHint={isWeb ? "Right click to open message options" : "Double tap and hold to open message options"}
      >
        <View style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.theirMessage,
          isWeb && (isMyMessage ? styles.webMyMessage : styles.webTheirMessage)
        ]}>
          {!isMyMessage && (
            <Text style={styles.senderName}>{item.sender?.name}</Text>
          )}
          
          {item.type === 'text' && (
            <Text style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.theirMessageText,
              isWeb && (isMyMessage ? styles.webMyMessageText : styles.webTheirMessageText)
            ]}>
              {item.text}
            </Text>
          )}
          
          {item.type === 'image' && (
            <Image
              source={{ uri: item.data?.url }}
              style={[styles.messageImage, isWeb && styles.webMessageImage]}
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

    initializeChat();
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

  const renderErrorMessage = () => {
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError('');
              fetchMessages();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  // Add a reconnection mechanism for web
  useEffect(() => {
    if (!isWeb) return;
    
    let reconnectInterval;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;
    
    const checkConnection = async () => {
      try {
        const loggedInUser = await CometChat.getLoggedinUser();
        
        if (!loggedInUser && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          
          try {
            // Get current Firebase user
            const currentUser = auth.currentUser;
            if (!currentUser) {
              throw new Error("No Firebase user found");
            }
            
            // Login to CometChat
            await CometChat.login(currentUser.uid.toLowerCase(), COMETCHAT_CONSTANTS.AUTH_KEY);
            console.log("CometChat reconnection successful");
            
            // Refresh messages
            await fetchMessages();
            
            // Clear error if successful
            setError('');
          } catch (loginError) {
            console.error("CometChat reconnection error:", loginError);
            setError("Connection lost. Attempting to reconnect...");
          }
        } else if (!loggedInUser && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          // Max attempts reached
          setError("Unable to reconnect to chat service. Please refresh the page.");
          clearInterval(reconnectInterval);
        }
      } catch (error) {
        console.error("Error checking connection:", error);
      }
    };
    
    // Check connection every 30 seconds
    reconnectInterval = setInterval(checkConnection, 30000);
    
    return () => {
      clearInterval(reconnectInterval);
    };
  }, [isWeb]);

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
      style={[styles.container, { height: screenHeight }, isWeb && styles.webContainer]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 150 : 0}
      accessible={true}
      accessibilityLabel="Chat conversation"
    >
      {renderErrorMessage()}
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#24269B" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={[styles.messageList, isWeb && styles.webMessageList]}
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
      )}
      
      {renderSmartReplies()}
      {renderInputContainer()}
      {renderContextMenu()}
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
  webContainer: {
    maxWidth: 800,
    marginHorizontal: 'auto',
    width: '100%',
  },
  webMessageList: {
    paddingHorizontal: 20,
  },
  webMyMessage: {
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  webTheirMessage: {
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  webMyMessageText: {
    fontSize: 16,
  },
  webTheirMessageText: {
    fontSize: 16,
  },
  webMessageImage: {
    maxWidth: 300,
    cursor: 'pointer',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#24269B',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  contextMenu: {
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
    minWidth: 180,
    overflow: 'hidden',
  },
  contextMenuItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  contextMenuItemText: {
    fontSize: 14,
  },
});

export default ChatConversationScreen; 