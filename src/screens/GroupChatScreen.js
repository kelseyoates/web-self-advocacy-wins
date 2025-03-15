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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CometChat } from '@cometchat-pro/react-native-chat';
import { useAuth } from '../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COMETCHAT_CONSTANTS } from '../config/cometChatConfig';
import { useAccessibility } from '../context/AccessibilityContext';

// Conditional import based on platform
const CometChatWeb = Platform.OS === 'web' 
  ? require('@cometchat-pro/chat').CometChat
  : require('@cometchat-pro/react-native-chat').CometChat;

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
        Alert.alert('Debug', 'Info button pressed'); // Debug alert
        onPress();
      }}
      style={{
        marginRight: 15,
        padding: 10,
        backgroundColor: 'transparent',
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

  const announceToScreenReader = (message) => {
    if (isScreenReaderEnabled) {
      AccessibilityInfo.announceForAccessibility(message);
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

  useEffect(() => {
    const initializeChat = async () => {
      try {
        const user = await CometChat.getLoggedinUser();
        setCurrentUser(user);
        await fetchMessages();
        await fetchGroupInfo();

        // Set the navigation header title to the group name
        navigation.setOptions({
          title: name || 'Group Chat',
          headerTitleStyle: {
            color: '#24269B',
            fontSize: 18,
            fontWeight: '600',
          }
        });

      } catch (error) {
        console.log("Initialization error:", error);
      }
    };

    initializeChat();
  }, [navigation, name]); // Update dependency array to use name

  const fetchMessages = useCallback(async () => {
    try {
      console.log("Fetching messages for:", uid);
      // Remove the group_ prefix if it exists
      const groupId = uid.replace('group_', '');
      
      const messagesRequest = new CometChat.MessagesRequestBuilder()
        .setGUID(groupId)  // Use setGUID for groups
        .setLimit(50)
        .build();

      const fetchedMessages = await messagesRequest.fetchPrevious();
      console.log("Fetched messages count:", fetchedMessages.length);
      
      // Filter out action, system, and deleted messages
      const validMessages = fetchedMessages.filter(msg => 
        msg.category !== 'action' && 
        msg.category !== 'system' && 
        msg.senderId !== 'app_system' &&
        !msg.deletedAt
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

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    try {
      containsProfanity(inputText);
      // Create message with data masking enabled
      const textMessage = new CometChat.TextMessage(
        uid,
        inputText.trim(),
        CometChat.RECEIVER_TYPE.GROUP
      );

      // Enable data masking
      textMessage.metadata = {
        dataMasking: true,
        sensitive_data: true
      };

      const sentMessage = await CometChat.sendMessage(textMessage);
      console.log('Message sent successfully');
      
      setMessages(prev => [...prev, sentMessage]);
      setInputText('');

      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
      announceToScreenReader('Message sent');
    } catch (error) {
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
          if (error.code === 'ERR_BLOCKED_BY_EXTENSION') {
            announceToScreenReader('Message was blocked by content filter');
          } else {
            announceToScreenReader('Failed to send message');
          }
          // Handle CometChat's profanity filter error without logging
          if (error.code === 'ERR_BLOCKED_BY_EXTENSION' && 
              error.details?.action === 'do_not_propagate') {
            Alert.alert(
              'Message Blocked',
              'Your message was blocked by our content filter. Please revise and try again.'
            );
          } else {
            // Only log non-profanity errors
            console.error('Error sending message:', error);
            Alert.alert('Error', 'Failed to send message');
          }
      }
    }
  };

  const leaveGroup = async () => {
    // First check if user is the owner
    if (groupInfo?.owner === currentUser?.uid) {
      Alert.alert(
        'Cannot Leave Group',
        'As the group creator, you cannot leave this group. You must either delete the group or transfer ownership to another member first.',
        [{ text: 'OK', style: 'default' }]
      );
      announceToScreenReader('Cannot leave group as you are the owner');
      return;
    }

    // If not owner, proceed with leave confirmation
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await CometChat.leaveGroup(uid);
              navigation.goBack();
              announceToScreenReader('Successfully left the group');
            } catch (error) {
              console.error('Error leaving group:', error);
              Alert.alert('Error', 'Failed to leave group');
              announceToScreenReader('Failed to leave group');
            }
          }
        }
      ]
    );
  };

  const updateGroupName = async () => {
    if (!newGroupName.trim() || !uid) return;

    try {
      console.log('Updating group name for group:', uid);
      
      // Create group object with required parameters
      const group = new CometChat.Group(
        uid,
        newGroupName.trim(),
        CometChat.GROUP_TYPE.PRIVATE
      );

      const updatedGroup = await CometChat.updateGroup(group);
      console.log('Group updated:', updatedGroup);

      // Update local state
      setGroupInfo(prevInfo => ({
        ...prevInfo,
        name: newGroupName.trim()
      }));

      // Update navigation title
      navigation.setOptions({
        title: newGroupName.trim()
      });

      // Clear input and close modal
      setNewGroupName('');
      setIsModalVisible(false);

      // Show success message
      Alert.alert('Success', 'Group name updated successfully');

    } catch (error) {
      console.error('Error updating group name:', error);
      Alert.alert(
        'Error',
        'Failed to update group name. Please try again.'
      );
    }
  };

  const handleAttachment = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please grant permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled) {
        setIsUploading(true);
        const imageUri = result.assets[0].uri;

        // Create media message with moderation enabled
        const mediaMessage = new CometChat.MediaMessage(
          uid,
          {
            uri: imageUri,
            type: 'image/jpeg',
            name: `image_${Date.now()}.jpg`
          },
          CometChat.MESSAGE_TYPE.IMAGE,
          CometChat.RECEIVER_TYPE.GROUP
        );

        // Enable image moderation
        mediaMessage.metadata = {
          imageModeration: true,
          sensitive_content: true
        };

        try {
          const sentMessage = await CometChat.sendMediaMessage(mediaMessage);
          console.log('Image sent successfully');
          
          setMessages(prev => [...prev, sentMessage]);
          
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        } catch (error) {
          if (error.code === 'ERR_BLOCKED_BY_EXTENSION') {
            Alert.alert(
              'Image Blocked',
              'This image was blocked by our content filter. Please choose another image.'
            );
          } else {
            console.error('Error sending image:', error);
            Alert.alert('Error', 'Failed to send image');
          }
        }
      }
    } catch (error) {
      console.error('Error handling attachment:', error);
      Alert.alert('Error', 'Failed to access image library');
    } finally {
      setIsUploading(false);
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
    } catch (error) {
      console.error("Error reporting message:", error);
      Alert.alert(
        "Error",
        "Failed to report message. Please try again."
      );
    }
  };

  const submitReport = async (user, reportReason) => {
    try {
      console.log('Reporting user:', user.uid, 'for reason:', reportReason);

      // First, notify the reported user
      const userNotification = new CometChat.TextMessage(
        user.uid,
        `Your account has been reported in the group "${groupInfo.name}" for review.`,
        'user'
      );

      // Add metadata to user notification
      userNotification.setMetadata({
        reportType: 'user',
        reason: reportReason,
        groupContext: groupInfo.guid,
        groupName: groupInfo.name,
        timestamp: new Date().getTime()
      });
      
      // Send notification to user
      await CometChat.sendMessage(userNotification);

      // Then create the group report record
      const groupReport = new CometChat.TextMessage(
        groupInfo.guid,
        `[REPORT] A report has been submitted for review.`,
        'group'
      );

      // Add full metadata to group report
      groupReport.setMetadata({
        reportType: 'user',
        reportedUser: user.uid,
        reportedName: user.name,
        reason: reportReason,
        reportedBy: currentUser.uid,
        reportedByName: currentUser.name,
        timestamp: new Date().getTime(),
        groupContext: groupInfo.guid,
        groupName: groupInfo.name
      });

      // Add tags for filtering
      groupReport.setTags(['report', 'moderation']);
      
      // Send the group report
      await CometChat.sendMessage(groupReport);

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

  // Update handleReportUser with clearer categories
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

  // Add keyboard navigation handlers
  const handleKeyPress = (e, action) => {
    if (isWeb) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        action();
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[
        styles.container,
        isWeb && styles.webContainer
      ]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      accessible={true}
      accessibilityLabel="Group Chat Screen"
    >
      <View style={styles.infoButtonContainer}>
        <TouchableOpacity
          onPress={() => {
            announceToScreenReader('Opening group information');
            setIsModalVisible(true);
          }}
          style={[
            styles.infoButton,
            isWeb && styles.webButton
          ]}
          accessible={true}
          accessibilityLabel="Group Information"
          accessibilityHint="Double tap to view group details and members"
          accessibilityRole="button"
          role="button"
          tabIndex={0}
          onKeyPress={(e) => handleKeyPress(e, () => setIsModalVisible(true))}
        >
          <MaterialCommunityIcons 
            name="information"
            size={24}
            color="#24269B"
          />
          <Text style={styles.infoButtonText}>Group Info</Text>
        </TouchableOpacity>
      </View>

      {isWeb ? (
        <ScrollView 
          style={styles.webMessageList}
          ref={flatListRef}
          contentContainerStyle={styles.messageList}
        >
          {messages.map((item) => renderMessage({ item }))}
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id?.toString()}
          contentContainerStyle={styles.messageList}
          accessible={true}
          accessibilityLabel={`${messages.length} messages`}
          accessibilityHint="Scroll to read messages"
        />
      )}

      {renderSmartReplies()}

      <View 
        style={[
          styles.inputContainer,
          isWeb && styles.webInputContainer
        ]}
        accessible={true}
        accessibilityLabel="Message input section"
      >
        <TouchableOpacity 
          style={[
            styles.attachButton,
            isWeb && styles.webButton
          ]}
          onPress={handleAttachment}
          disabled={isUploading}
          accessible={true}
          accessibilityLabel="Attach media"
          accessibilityHint="Double tap to attach an image or file"
          accessibilityRole="button"
          role="button"
          tabIndex={0}
          onKeyPress={(e) => handleKeyPress(e, handleAttachment)}
          accessibilityState={{ disabled: isUploading }}
        >
          <MaterialCommunityIcons 
            name="attachment" 
            size={24} 
            color={isUploading ? '#999' : '#24269B'} 
          />
        </TouchableOpacity>
        
        <TextInput
          style={[
            styles.input,
            isWeb && styles.webInput
          ]}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          multiline
          editable={!isUploading}
          accessible={true}
          accessibilityLabel="Message input"
          accessibilityHint="Enter your message here"
          onKeyPress={(e) => {
            if (isWeb && e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        
        <TouchableOpacity 
          style={[
            styles.sendButton,
            isWeb && styles.webButton
          ]}
          onPress={sendMessage}
          disabled={isUploading || !inputText.trim()}
          accessible={true}
          accessibilityLabel="Send message"
          accessibilityHint="Double tap to send your message"
          accessibilityRole="button"
          role="button"
          tabIndex={0}
          onKeyPress={(e) => handleKeyPress(e, sendMessage)}
          accessibilityState={{ 
            disabled: isUploading || !inputText.trim() 
          }}
        >
          <MaterialCommunityIcons 
            name="send" 
            size={24} 
            color={isUploading || !inputText.trim() ? '#999' : '#24269B'} 
          />
        </TouchableOpacity>
      </View>

      {isWeb ? (
        <div 
          style={isModalVisible ? styles.webModalOverlay : { display: 'none' }}
          onClick={() => setIsModalVisible(false)}
        >
          <div 
            style={styles.webModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            {/* Modal content */}
            <View style={styles.modalHeader}>
              <Text 
                id="modal-title"
                style={styles.modalTitle}
              >
                Group Information
              </Text>
              <TouchableOpacity 
                onPress={() => setIsModalVisible(false)}
                style={[styles.closeButton, isWeb && styles.webButton]}
                accessible={true}
                accessibilityLabel="Close group information"
                accessibilityRole="button"
                role="button"
                tabIndex={0}
                onKeyPress={(e) => handleKeyPress(e, () => setIsModalVisible(false))}
              >
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Group name update section */}
            {groupInfo?.owner === currentUser?.uid && (
              <View style={styles.groupNameContainer}>
                <TextInput
                  style={[styles.groupNameInput, isWeb && styles.webGroupNameInput]}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder="Enter new group name"
                  placeholderTextColor="#666"
                  accessible={true}
                  accessibilityLabel="New group name input"
                  accessibilityHint="Enter a new name for the group"
                />
                <TouchableOpacity 
                  style={[styles.updateButton, isWeb && styles.webUpdateButton]}
                  onPress={updateGroupName}
                  accessible={true}
                  accessibilityLabel="Update group name"
                  accessibilityRole="button"
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => handleKeyPress(e, updateGroupName)}
                >
                  <Text style={styles.updateButtonText}>Update Name</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Members list */}
            <Text style={styles.membersTitle}>
              Members ({members.length}):
            </Text>
            
            {isWeb ? (
              <ScrollView style={styles.membersList}>
                {members.map((item) => (
                  <View 
                    key={item.uid}
                    style={[styles.memberCard, isWeb && styles.webMemberCard]}
                  >
                    {renderMember({ item })}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <FlatList
                data={members}
                keyExtractor={item => item.uid}
                renderItem={renderMember}
                style={styles.membersList}
              />
            )}

            {/* Group actions */}
            {groupInfo?.owner === currentUser?.uid && (
              <TouchableOpacity 
                style={[styles.leaveButton, isWeb && styles.webLeaveButton]}
                onPress={deleteGroup}
                accessible={true}
                accessibilityLabel="Delete group"
                accessibilityHint="Double tap to permanently delete this group"
                accessibilityRole="button"
                role="button"
                tabIndex={0}
                onKeyPress={(e) => handleKeyPress(e, deleteGroup)}
              >
                <Text style={styles.leaveButtonText}>Delete Group</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.leaveButton, isWeb && styles.webLeaveButton]}
              onPress={leaveGroup}
              accessible={true}
              accessibilityLabel="Leave group"
              accessibilityHint="Double tap to leave this group"
              accessibilityRole="button"
              role="button"
              tabIndex={0}
              onKeyPress={(e) => handleKeyPress(e, leaveGroup)}
            >
              <Text style={styles.leaveButtonText}>Leave Group</Text>
            </TouchableOpacity>
          </div>
        </div>
      ) : (
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={true}
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
  // Web-specific styles
  webContainer: {
    maxWidth: 1200,
    marginHorizontal: 'auto',
    height: '100vh',
    backgroundColor: '#ffffff',
  },
  webMessageList: {
    flex: 1,
    overflowY: 'auto',
    padding: 20,
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
  webInputContainer: {
    position: 'sticky',
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTop: '1px solid #e0e0e0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  webInput: {
    flex: 1,
    marginHorizontal: 12,
    padding: 12,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    fontSize: 16,
    outline: 'none',
    border: '1px solid #e0e0e0',
    ':focus': {
      borderColor: '#24269B',
      boxShadow: '0 0 0 2px rgba(36, 38, 155, 0.1)',
    },
  },
  webButton: {
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
    ':hover': {
      transform: 'scale(1.1)',
    },
    ':focus': {
      outline: '2px solid #24269B',
      outlineOffset: '2px',
    },
  },
  webModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    maxWidth: 600,
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  },
  webModalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webMemberCard: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      backgroundColor: '#f5f5f5',
      transform: 'translateY(-2px)',
    },
    ':focus': {
      outline: '2px solid #24269B',
      outlineOffset: '2px',
    },
  },
  webAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  webGroupNameInput: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    border: '1px solid #e0e0e0',
    fontSize: 16,
    marginBottom: 16,
    ':focus': {
      borderColor: '#24269B',
      outline: 'none',
      boxShadow: '0 0 0 2px rgba(36, 38, 155, 0.1)',
    },
  },
  webUpdateButton: {
    backgroundColor: '#24269B',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: '600',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#1a1b6e',
    },
    ':focus': {
      outline: '2px solid #24269B',
      outlineOffset: '2px',
    },
  },
  webLeaveButton: {
    backgroundColor: '#ff4444',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: '600',
    transition: 'background-color 0.2s ease',
    marginTop: 16,
    ':hover': {
      backgroundColor: '#cc0000',
    },
    ':focus': {
      outline: '2px solid #ff4444',
      outlineOffset: '2px',
    },
  },
});

export { GroupInfoButton };
export default GroupChatScreen; 