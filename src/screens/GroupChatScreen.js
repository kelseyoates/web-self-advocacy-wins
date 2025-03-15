import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Image,
  ScrollView,
  ActivityIndicator,
  AccessibilityInfo
} from 'react-native';
import { CometChat } from '@cometchat-pro/react-native-chat';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
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

// Create a separate header component for better control
const GroupInfoButton = ({ onPress }) => {
  return (
    <TouchableOpacity
      onPress={() => {
        console.log('Info button pressed');
        if (isWeb) {
          // For web, just call the handler directly without debug alert
          onPress();
        } else {
          Alert.alert('Debug', 'Info button pressed'); // Debug alert for mobile only
          onPress();
        }
      }}
      style={{
        marginRight: 15,
        padding: 10,
        backgroundColor: 'transparent',
        cursor: isWeb ? 'pointer' : 'default',
      }}
    >
      <MaterialCommunityIcons
        name="information"
        size={28}
        color="#24269B"
      />
    </TouchableOpacity>
  );
};

const GroupChatScreen = ({ route, navigation }) => {
  console.log('GroupChatScreen rendering');
  console.log('Route params:', route.params);
  
  const { uid, name } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [groupInfo, setGroupInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const flatListRef = useRef();
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [reportedUsers, setReportedUsers] = useState(new Set());
  const [memberProfiles, setMemberProfiles] = useState({});
  const [smartReplies, setSmartReplies] = useState([]);
  const [isLoadingSmartReplies, setIsLoadingSmartReplies] = useState(false);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState(new Set());
  const [error, setError] = useState('');
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const MAX_RECONNECT_ATTEMPTS = 3;
  const reconnectIntervalRef = useRef(null);

  // Add screen reader detection
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
      // This is a simplified approach - in a real app, you'd use proper ARIA live regions
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

  // Test function to verify modal visibility
  const toggleModal = () => {
    console.log('Current modal visibility:', isModalVisible);
    setIsModalVisible(!isModalVisible);
    console.log('New modal visibility:', !isModalVisible);
  };

  // Fetch group info and members
  const fetchGroupInfo = async () => {
    try {
      // Remove the group_ prefix if it exists, as it's already in the correct format
      const groupId = uid.replace('group_', '');
      
      const group = await CometChat.getGroup(groupId);
      
      // Fetch group members to get accurate count
      const membersRequest = new CometChat.GroupMembersRequestBuilder(groupId)
        .setLimit(100)
        .build();
      
      const members = await membersRequest.fetchNext();
      
      // Update group info with accurate member count
      const updatedGroupInfo = {
        ...group,
        membersCount: members ? members.length : 0,
        members: members || []
      };
      
      setGroupInfo(updatedGroupInfo);
      setMembers(members || []);
      
      await fetchMemberProfiles(members || []);
      
      console.log('Group info with members:', updatedGroupInfo);
    } catch (error) {
      console.log('Error fetching group info:', error);
      setError('Failed to load group information. Please try again.');
    }
  };

  // Add this function to fetch user profiles from Firestore
  const fetchMemberProfiles = async (membersList) => {
    try {
      const profiles = {};
      const userPromises = membersList.map(async (member) => {
        const userDoc = await getDoc(doc(db, 'users', member.uid.toLowerCase()));
        if (userDoc.exists()) {
          profiles[member.uid] = userDoc.data();
        }
      });
      
      await Promise.all(userPromises);
      setMemberProfiles(profiles);
    } catch (error) {
      console.error('Error fetching member profiles:', error);
    }
  };

  // Setup reconnection mechanism for web
  useEffect(() => {
    if (isWeb) {
      // Check connection status periodically
      const checkConnection = async () => {
        try {
          const loggedInUser = await CometChat.getLoggedinUser();
          
          if (!loggedInUser) {
            console.log("Connection lost, attempting to reconnect...");
            setReconnecting(true);
            setReconnectAttempts(prev => prev + 1);
            
            try {
              // Try to login again
              await CometChat.login(user.uid.toLowerCase(), COMETCHAT_CONSTANTS.AUTH_KEY);
              console.log("Reconnection successful");
              
              // Reset reconnection state
              setReconnecting(false);
              setReconnectAttempts(0);
              setError('');
              
              // Refresh messages
              await fetchMessages();
            } catch (loginError) {
              console.error("Reconnection failed:", loginError);
              
              if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                setError("Connection lost. Please refresh the page to reconnect.");
                clearInterval(reconnectIntervalRef.current);
              } else {
                setError(`Connection lost. Attempting to reconnect... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
              }
            }
          } else if (reconnecting) {
            // We're connected again
            setReconnecting(false);
            setReconnectAttempts(0);
            setError('');
          }
        } catch (error) {
          console.error("Error checking connection:", error);
          setReconnecting(true);
        }
      };
      
      // Check every 30 seconds
      reconnectIntervalRef.current = setInterval(checkConnection, 30000);
      
      return () => {
        if (reconnectIntervalRef.current) {
          clearInterval(reconnectIntervalRef.current);
        }
      };
    }
  }, [isWeb, user, reconnectAttempts, reconnecting]);

  useEffect(() => {
    const initializeChat = async () => {
      try {
        // Check if user is logged in to CometChat
        const user = await CometChat.getLoggedinUser();
        
        if (!user && isWeb) {
          // For web, try to login if not already logged in
          try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
              throw new Error("No Firebase user found");
            }
            
            await CometChat.login(currentUser.uid.toLowerCase(), COMETCHAT_CONSTANTS.AUTH_KEY);
            const loggedInUser = await CometChat.getLoggedinUser();
            setCurrentUser(loggedInUser);
          } catch (loginError) {
            console.error("CometChat login error:", loginError);
            setError("There was an issue connecting to the chat service. Some features may be limited.");
          }
        } else {
          setCurrentUser(user);
        }
        
        await fetchMessages();
        await fetchGroupInfo();
        await fetchBlockedUsers();

        // Set the navigation header title to the group name
        navigation.setOptions({
          title: name || 'Group Chat',
          headerTitleStyle: {
            color: '#24269B',
            fontSize: 18,
            fontWeight: 'bold',
          },
          headerRight: () => (
            <GroupInfoButton onPress={() => toggleModal()} />
          ),
        });

        // Set up message listener
        const listenerId = `group_${uid}`;
        CometChat.addMessageListener(
          listenerId,
          new CometChat.MessageListener({
            onTextMessageReceived: message => {
              console.log('Text message received:', message);
              if (message.receiverType === 'group' && message.receiverId === uid) {
                setMessages(prevMessages => [message, ...prevMessages]);
                announceToScreenReader(`New message from ${message.sender.name}: ${message.text}`);
                
                // Generate smart replies for the received message
                getSmartReplies(message);
              }
            },
            onMediaMessageReceived: message => {
              console.log('Media message received:', message);
              if (message.receiverType === 'group' && message.receiverId === uid) {
                setMessages(prevMessages => [message, ...prevMessages]);
                announceToScreenReader(`New media message from ${message.sender.name}`);
              }
            },
            onCustomMessageReceived: message => {
              console.log('Custom message received:', message);
              if (message.receiverType === 'group' && message.receiverId === uid) {
                setMessages(prevMessages => [message, ...prevMessages]);
                announceToScreenReader(`New custom message from ${message.sender.name}`);
              }
            },
            onMessageDeleted: message => {
              console.log('Message deleted:', message);
              setMessages(prevMessages => 
                prevMessages.filter(m => m.id !== message.id)
              );
              announceToScreenReader('A message was deleted');
            },
            onMessageEdited: message => {
              console.log('Message edited:', message);
              setMessages(prevMessages => 
                prevMessages.map(m => m.id === message.id ? message : m)
              );
              announceToScreenReader('A message was edited');
            },
          })
        );

        // Clean up listener on unmount
        return () => {
          CometChat.removeMessageListener(listenerId);
        };
      } catch (error) {
        console.error('Error initializing chat:', error);
        setError('Failed to initialize chat. Please try again.');
      }
    };

    initializeChat();
  }, [navigation, uid, name]);

  const fetchMessages = async () => {
    try {
      setError('');
      const messagesRequest = new CometChat.MessagesRequestBuilder()
        .setGUID(uid)
        .setLimit(50)
        .build();

      const fetchedMessages = await messagesRequest.fetchPrevious();
      console.log('Fetched messages:', fetchedMessages);
      
      // Sort messages in reverse chronological order (newest first)
      const sortedMessages = fetchedMessages.sort((a, b) => b.sentAt - a.sentAt);
      setMessages(sortedMessages);
      
      // Generate smart replies for the latest message if it exists
      if (sortedMessages.length > 0) {
        getSmartReplies(sortedMessages[0]);
      }
      
      announceToScreenReader(`Loaded ${fetchedMessages.length} messages`);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages. Please try again.');
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    try {
      // Check for profanity or personal information
      try {
        containsProfanity(inputText);
      } catch (error) {
        if (error.message === 'PROFANITY') {
          showAlert('Warning', 'Your message contains inappropriate language. Please revise it.');
          return;
        } else if (error.message === 'PERSONAL_INFO_EMAIL' || error.message === 'PERSONAL_INFO_PHONE') {
          showAlert('Warning', 'Your message appears to contain personal information. For your safety, please avoid sharing contact details.');
          return;
        }
      }
      
      const textMessage = new CometChat.TextMessage(
        uid,
        inputText.trim(),
        CometChat.RECEIVER_TYPE.GROUP
      );
      
      // Clear input before sending to improve perceived performance
      setInputText('');
      
      const sentMessage = await CometChat.sendMessage(textMessage);
      console.log('Message sent successfully:', sentMessage);
      
      // Add the sent message to the messages list
      setMessages(prevMessages => [sentMessage, ...prevMessages]);
      
      // Clear smart replies after sending a message
      setSmartReplies([]);
      
      announceToScreenReader('Message sent');
    } catch (error) {
      console.error('Error sending message:', error);
      
      if (isWeb) {
        setError('Failed to send message. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
      
      // Restore the input text in case of error
      setInputText(inputText);
    }
  };

  const handleAttachment = async () => {
    try {
      if (isWeb) {
        // Web-specific image picker
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        // Create a promise to handle the file selection
        const fileSelected = new Promise((resolve) => {
          input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
              resolve(file);
            } else {
              resolve(null);
            }
          };
        });
        
        // Trigger the file input click
        input.click();
        
        // Wait for file selection
        const file = await fileSelected;
        if (!file) return;
        
        setIsUploading(true);
        
        // Create a media message
        const mediaMessage = new CometChat.MediaMessage(
          uid,
          file,
          CometChat.MESSAGE_TYPE.IMAGE,
          CometChat.RECEIVER_TYPE.GROUP
        );
        
        // Send the media message
        const sentMessage = await CometChat.sendMediaMessage(mediaMessage);
        console.log('Media message sent successfully:', sentMessage);
        
        // Add the sent message to the messages list
        setMessages(prevMessages => [sentMessage, ...prevMessages]);
        
        announceToScreenReader('Image sent');
      } else {
        // Mobile image picker
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'You need to grant access to your photos to send images.');
          return;
        }
        
        const pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
        
        if (pickerResult.canceled) return;
        
        setIsUploading(true);
        
        // Get the selected asset
        const asset = pickerResult.assets[0];
        
        // Create a blob from the image URI
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        
        // Create a File object from the blob
        const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
        
        // Create a media message
        const mediaMessage = new CometChat.MediaMessage(
          uid,
          file,
          CometChat.MESSAGE_TYPE.IMAGE,
          CometChat.RECEIVER_TYPE.GROUP
        );
        
        // Send the media message
        const sentMessage = await CometChat.sendMediaMessage(mediaMessage);
        console.log('Media message sent successfully:', sentMessage);
        
        // Add the sent message to the messages list
        setMessages(prevMessages => [sentMessage, ...prevMessages]);
        
        announceToScreenReader('Image sent');
      }
    } catch (error) {
      console.error('Error sending media message:', error);
      
      if (isWeb) {
        setError('Failed to send image. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to send image. Please try again.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const getSmartReplies = async (message) => {
    try {
      if (!message || !message.text) return;
      
      setIsLoadingSmartReplies(true);
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

  const handleSmartReplyPress = async (reply) => {
    try {
      setInputText(reply);
      setSmartReplies([]); // Clear smart replies
      await sendMessage(reply);
    } catch (error) {
      console.error('Error sending smart reply:', error);
    }
  };

  // Add this function to check if a user is blocked
  const isUserInBlockedList = (userId) => {
    const normalizedUserId = userId.toLowerCase();
    const isBlocked = Array.from(blockedUsers).some(
      blockedId => blockedId.toLowerCase() === normalizedUserId
    );
    console.log(`Checking if user ${userId} is blocked:`, isBlocked);
    console.log('Current blocked users:', Array.from(blockedUsers));
    return isBlocked;
  };

  // Update renderMember function
  const renderMember = ({ item }) => {
    const isOwner = groupInfo?.owner === item.uid;
    const isSelf = item.uid === currentUser?.uid;
    const isBlocked = isUserInBlockedList(item.uid);

    const handleLongPress = () => {
      if (!isSelf) {
        console.log('Member long pressed:', item.uid);
        console.log('Is member blocked:', isBlocked);

        const options = [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Profile',
            onPress: () => {
              setIsModalVisible(false);
              navigation.navigate('OtherUserProfile', {
                profileUserId: item.uid.toLowerCase(),
                isCurrentUser: false
              });
            }
          }
        ];

        if (isBlocked) {
          options.push({
            text: 'Unblock User',
            onPress: () => handleUnblockUser(item)
          });
        } else {
          options.push({
            text: 'Block User',
            style: 'destructive',
            onPress: () => handleBlockUser(item)
          });
        }

        options.push({
          text: 'Report User',
          style: 'destructive',
          onPress: () => handleReportUser(item)
        });

        Alert.alert(
          'Member Options',
          `What would you like to do with ${memberProfiles[item.uid]?.username || item.name}?`,
          options
        );
      }
    };

    return (
      <TouchableOpacity
        style={styles.memberCard}
        onPress={handleLongPress}
        onLongPress={handleLongPress}
        accessible={true}
        accessibilityLabel={`${memberProfiles[item.uid]?.username || item.name}${isOwner ? ', Group Owner' : ''}. ${isBlocked ? 'Blocked user' : ''}`}
        accessibilityHint="Double tap for options"
      >
        <Image
          source={
            memberProfiles[item.uid]?.profilePicture
              ? { uri: memberProfiles[item.uid].profilePicture }
              : require('../../assets/default-avatar.png')
          }
          style={styles.memberAvatar}
        />
        <View style={styles.memberInfoContainer}>
          <View style={styles.memberNameContainer}>
            <Text style={styles.memberName}>
              {memberProfiles[item.uid]?.username || item.name}
            </Text>
            {isOwner && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>Owner</Text>
              </View>
            )}
            {isSelf && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>You</Text>
              </View>
            )}
          </View>
          <View style={styles.memberStatusContainer}>
            {isBlocked && (
              <View style={[styles.badgeContainer, styles.blockedBadge]}>
                <Text style={[styles.badgeText, styles.blockedText]}>Blocked</Text>
              </View>
            )}
            <Text style={styles.memberRole}>
              {item.scope === 'admin' ? 'Admin' : 'Member'}
            </Text>
          </View>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color="#666"
          style={styles.memberChevron}
        />
      </TouchableOpacity>
    );
  };

  // Add this useEffect to pass the toggle method to navigation params
  useEffect(() => {
    navigation.setParams({
      toggleModal: () => {
        console.log('Toggle modal called');
        setIsModalVisible(prev => !prev);
      }
    });
  }, [navigation]);

  const deleteGroup = async () => {
    if (groupInfo?.owner !== currentUser?.uid) {
      Alert.alert('Error', 'Only the group owner can delete this group');
      return;
    }

    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await CometChat.deleteGroup(uid);
              navigation.goBack();
              announceToScreenReader('Group successfully deleted');
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('Error', 'Failed to delete group. Please try again.');
              announceToScreenReader('Failed to delete group');
            }
          }
        }
      ]
    );
  };

  const transferOwnership = async (newOwnerUid) => {
    Alert.alert(
      'Transfer Ownership',
      'Are you sure you want to transfer group ownership? You will become a regular member.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            try {
              await CometChat.transferGroupOwnership(uid, newOwnerUid);
              
              // Update local group info
              setGroupInfo(prevInfo => ({
                ...prevInfo,
                owner: newOwnerUid
              }));
              
              // Update members list to reflect new roles
              setMembers(prevMembers => 
                prevMembers.map(member => ({
                  ...member,
                  scope: member.uid === newOwnerUid ? 'owner' : 
                         member.uid === currentUser?.uid ? 'member' : 
                         member.scope
                }))
              );
              
              Alert.alert('Success', 'Group ownership transferred successfully');
              announceToScreenReader('Group ownership transferred successfully');
            } catch (error) {
              console.error('Error transferring ownership:', error);
              Alert.alert('Error', 'Failed to transfer group ownership');
              announceToScreenReader('Failed to transfer group ownership');
            }
          }
        }
      ]
    );
  };

  const handleBlockUser = async (user) => {
    try {
      Alert.alert(
        'Block User',
        'Are you sure you want to block this user? You will no longer receive messages from them.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                const userIdToBlock = user.uid.toLowerCase(); // Ensure consistent casing
                console.log('Blocking user:', userIdToBlock);
                await CometChat.blockUsers([userIdToBlock]);
                
                setBlockedUsers(prev => {
                  const newSet = new Set(prev);
                  newSet.add(userIdToBlock);
                  console.log('Updated blocked users:', Array.from(newSet));
                  return newSet;
                });
                
                Alert.alert(
                  'User Blocked',
                  'You have successfully blocked this user.'
                );
                announceToScreenReader('User blocked successfully');
              } catch (error) {
                console.error('Error blocking user:', error);
                Alert.alert(
                  'Error',
                  'Failed to block user. Please try again.'
                );
                announceToScreenReader('Failed to block user');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in handleBlockUser:', error);
      Alert.alert(
        'Error',
        'Failed to process block request. Please try again.'
      );
    }
  };

  // Add this useEffect to fetch blocked users when the component mounts
  useEffect(() => {
    const fetchBlockedUsers = async () => {
      try {
        console.log('Fetching blocked users...');
        const blockedUsersRequest = new CometChat.BlockedUsersRequestBuilder()
          .setLimit(100)
          .build();
        
        const blockedUsersList = await blockedUsersRequest.fetchNext();
        console.log('Blocked users list:', JSON.stringify(blockedUsersList));
        
        if (blockedUsersList && blockedUsersList.length > 0) {
          const blockedIds = new Set(blockedUsersList.map(user => user.uid.toLowerCase()));
          console.log('Setting blocked IDs:', Array.from(blockedIds));
          setBlockedUsers(blockedIds);
        } else {
          console.log('No blocked users found');
        }
      } catch (error) {
        console.error('Error fetching blocked users:', error);
      }
    };

    fetchBlockedUsers();
  }, []); // Empty dependency array to run only on mount

  const handleUnblockUser = async (user) => {
    try {
      Alert.alert(
        'Unblock User',
        'Are you sure you want to unblock this user? You will start receiving their messages again.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            onPress: async () => {
              try {
                const userIdToUnblock = user.uid.toLowerCase(); // Ensure consistent casing
                console.log('Unblocking user:', userIdToUnblock);
                await CometChat.unblockUsers([userIdToUnblock]);
                
                setBlockedUsers(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(userIdToUnblock);
                  console.log('Updated blocked users:', Array.from(newSet));
                  return newSet;
                });
                
                Alert.alert(
                  'User Unblocked',
                  'You have successfully unblocked this user.'
                );
                announceToScreenReader('User unblocked successfully');
              } catch (error) {
                console.error('Error unblocking user:', error);
                Alert.alert(
                  'Error',
                  'Failed to unblock user. Please try again.'
                );
                announceToScreenReader('Failed to unblock user');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in handleUnblockUser:', error);
      Alert.alert(
        'Error',
        'Failed to process unblock request. Please try again.'
      );
    }
  };

  // Add this function back
  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender.uid === currentUser?.uid;
    const isBlocked = isUserInBlockedList(item.sender.uid);
    
    if (isBlocked && !isMyMessage) {
      return (
        <View style={[styles.messageContainer, styles.blockedMessageContainer]}>
          <Text style={styles.blockedMessageText}>
            Message hidden - user blocked
          </Text>
        </View>
      );
    }

    if (item.category === 'action') {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.message}</Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.otherMessage
        ]}
        accessible={true}
        accessibilityLabel={`Message from ${item.sender.name}: ${item.text}`}
      >
        {!isMyMessage && (
          <Text style={styles.senderName}>
            {memberProfiles[item.sender.uid]?.username || item.sender.name}
          </Text>
        )}
        <Text style={[
          styles.messageText,
          isMyMessage ? styles.myMessageText : styles.otherMessageText
        ]}>
          {item.text}
        </Text>
        <Text style={styles.messageTime}>
          {new Date(item.sentAt * 1000).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
    );
  };

  // Add this function back
  const renderSmartReplies = () => {
    if (!smartReplies || smartReplies.length === 0) {
      return null;
    }

    return (
      <View style={styles.smartRepliesContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          accessible={true}
          accessibilityLabel="Quick reply suggestions"
        >
          {smartReplies.map((reply, index) => (
            <TouchableOpacity
              key={index}
              style={styles.smartReplyButton}
              onPress={() => {
                setInputText(reply);
                setSmartReplies([]);
              }}
              accessible={true}
              accessibilityLabel={`Quick reply: ${reply}`}
              accessibilityHint="Double tap to use this reply"
            >
              <Text style={styles.smartReplyText}>{reply}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

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

  return (
    <KeyboardAvoidingView
      style={[styles.container, isWeb && styles.webContainer]}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {renderErrorMessage()}
      
      {/* Group Info Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View 
          style={styles.modalOverlay}
          accessible={true}
          accessibilityLabel="Group Information Modal"
          accessibilityViewIsModal={true}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Group Information</Text>
              <TouchableOpacity 
                onPress={() => {
                  announceToScreenReader('Closing group information');
                  setIsModalVisible(false);
                }}
                style={styles.closeButton}
                accessible={true}
                accessibilityLabel="Close group information"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {groupInfo?.owner === currentUser?.uid && groupInfo?.type === CometChat.GROUP_TYPE.PRIVATE && (
              <View 
                style={styles.groupNameContainer}
                accessible={true}
                accessibilityLabel="Group name section"
              >
                <TextInput
                  style={styles.groupNameInput}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder="Enter new group name"
                  placeholderTextColor="#666"
                  accessible={true}
                  accessibilityLabel="New group name input"
                  accessibilityHint="Enter a new name for the group"
                />
                <TouchableOpacity 
                  style={styles.updateButton}
                  onPress={() => {
                    announceToScreenReader('Updating group name');
                    updateGroupName();
                  }}
                  accessible={true}
                  accessibilityLabel="Update group name"
                  accessibilityRole="button"
                >
                  <Text style={styles.updateButtonText}>Update Name</Text>
                </TouchableOpacity>
              </View>
            )}

            {groupInfo?.owner === currentUser?.uid && groupInfo?.type === CometChat.GROUP_TYPE.PUBLIC && (
              <View style={styles.publicGroupInfo}>
                <Text style={styles.publicGroupText}>
                  Public group names cannot be changed
                </Text>
              </View>
            )}

            <Text 
              style={styles.membersTitle}
              accessible={true}
              accessibilityRole="header"
            >
              Members ({members.length}):
            </Text>
            
            <FlatList
              data={members}
              keyExtractor={item => item.uid}
              renderItem={renderMember}
              style={styles.membersList}
              accessible={true}
              accessibilityLabel="Group members list"
            />

            {groupInfo?.owner === currentUser?.uid && (
              <TouchableOpacity 
                style={[styles.leaveButton, { backgroundColor: '#ff4444' }]}
                onPress={() => {
                  announceToScreenReader('Deleting group');
                  deleteGroup();
                }}
                accessible={true}
                accessibilityLabel="Delete group"
                accessibilityHint="Double tap to permanently delete this group"
                accessibilityRole="button"
              >
                <Text style={styles.leaveButtonText}>Delete Group</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.leaveButton}
              onPress={() => {
                announceToScreenReader('Leaving group');
                leaveGroup();
              }}
              accessible={true}
              accessibilityLabel="Leave group"
              accessibilityHint="Double tap to leave this group"
              accessibilityRole="button"
            >
              <Text style={styles.leaveButtonText}>Leave Group</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id.toString()}
        inverted={true}
        contentContainerStyle={[styles.messageList, isWeb && styles.webMessageList]}
        ListFooterComponent={renderSmartReplies}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubText}>Be the first to send a message!</Text>
          </View>
        }
      />
      
      <View style={[styles.inputContainer, isWeb && styles.webInputContainer]}>
        <TouchableOpacity 
          style={[styles.attachButton, isWeb && styles.webButton]}
          onPress={handleAttachment}
          disabled={isUploading}
        >
          <MaterialCommunityIcons name="paperclip" size={24} color="#24269B" />
        </TouchableOpacity>
        
        <TextInput
          style={[styles.input, isWeb && styles.webInput]}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
          accessible={true}
          accessibilityLabel="Message input"
          accessibilityHint="Type your message here"
        />
        
        <TouchableOpacity 
          style={[styles.sendButton, isWeb && styles.webButton, !inputText.trim() && styles.disabledButton]}
          onPress={sendMessage}
          disabled={!inputText.trim() || isUploading}
        >
          <MaterialCommunityIcons 
            name="send" 
            size={24} 
            color={inputText.trim() ? "#24269B" : "#999"} 
          />
        </TouchableOpacity>
      </View>
      
      {isUploading && (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="small" color="#24269B" />
          <Text style={styles.uploadingText}>Uploading image...</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerButton: {
    marginRight: 15,
    padding: 10,
    backgroundColor: 'transparent',
  },
  messageList: {
    padding: 10,
  },
  messageContainer: {
    padding: 10,
    borderRadius: 12,
    maxWidth: '80%',
    marginVertical: 4,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#24269B',
    marginLeft: 50,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    marginRight: 50,
    borderWidth: 1,
    borderColor: '#000000',
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#000000',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    marginRight: 10,
    padding: 10,
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
    maxHeight: 100,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  sendButton: {
    padding: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '90%',
    maxHeight: '80%',
    borderRadius: 15,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#24269B',
  },
  closeButton: {
    padding: 5,
  },
  groupNameContainer: {
    marginBottom: 20,
  },
  groupNameInput: {
    borderWidth: 1,
    borderColor: '#24269B',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  updateButton: {
    backgroundColor: '#24269B',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  membersTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  membersList: {
    maxHeight: '50%',
  },
  memberCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#000000',
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  memberInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  memberNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#24269B',
    marginRight: 8,
  },
  memberStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  badgeContainer: {
    backgroundColor: '#E8E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 12,
    color: '#24269B',
    fontWeight: '500',
  },
  blockedBadge: {
    backgroundColor: '#FFE8E8',
  },
  blockedText: {
    color: '#D42C2C',
  },
  memberRole: {
    fontSize: 14,
    color: '#666',
  },
  memberChevron: {
    marginLeft: 8,
  },
  leaveButton: {
    backgroundColor: '#ff4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  leaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  attachButton: {
    padding: 10,
    marginRight: 5,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: '#f0f0f0',
  },
  testButton: {
    backgroundColor: '#24269B',
    padding: 10,
    margin: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  infoButtonContainer: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    backgroundColor: '#fff',
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  infoButtonText: {
    marginLeft: 8,
    color: '#24269B',
    fontSize: 16,
    fontWeight: '500',
  },
  blockedImageContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 8,
    marginVertical: 5,
  },
  blockedImageText: {
    color: '#d32f2f',
    fontSize: 14,
    textAlign: 'center',
  },
  timestamp: {
    fontSize: 12,
    alignSelf: 'flex-end',
  },
  myTimestamp: {
    color: '#fff',
    opacity: 0.8,
  },
  otherTimestamp: {
    color: '#666',
    opacity: 0.8,
  },
  smartRepliesContainer: {
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  smartReplyButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  smartReplyText: {
    color: '#24269B',
    fontSize: 14,
  },
  publicGroupInfo: {
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 20,
  },
  publicGroupText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  blockedMessageContainer: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
    alignSelf: 'center',
  },
  blockedMessageText: {
    color: '#666',
    fontStyle: 'italic',
    fontSize: 14,
  },
  systemMessageContainer: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginVertical: 4,
  },
  systemMessageText: {
    color: '#666',
    fontSize: 14,
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
    alignSelf: 'flex-end',
  },
  webContainer: {
    maxWidth: 1000,
    marginHorizontal: 'auto',
    width: '100%',
    height: '100%',
  },
  webMessageList: {
    paddingHorizontal: 20,
  },
  webInputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)',
  },
  webInput: {
    outlineColor: '#24269B',
    fontSize: 16,
    padding: 12,
  },
  webButton: {
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#f0f0f0',
    },
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 16,
    margin: 10,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  uploadingContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: 'white',
    marginLeft: 10,
  },
});

export { GroupInfoButton };
export default GroupChatScreen; 