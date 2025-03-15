import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  AccessibilityInfo,
  Platform
} from 'react-native';
import { CometChat } from '@cometchat-pro/react-native-chat';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAccessibility } from '../context/AccessibilityContext';
import { COMETCHAT_CONSTANTS } from '../config/cometChatConfig';

// Detect if running on web
const isWeb = Platform.OS === 'web';

const CommunityScreen = ({ navigation }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState('');
  const { showHelpers } = useAccessibility();
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);

  // Check for screen reader
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

  // Announce to screen reader
  const announceToScreenReader = (message) => {
    if (isScreenReaderEnabled && !isWeb) {
      AccessibilityInfo.announceForAccessibility(message);
    } else if (isWeb && isScreenReaderEnabled) {
      // For web with screen readers, we could use ARIA live regions
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

  // Fetch user profile for header
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        if (auth.currentUser) {
          const userDocRef = doc(db, 'users', auth.currentUser.uid.toLowerCase());
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUserData(data);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

  // Set up header with profile button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          style={[styles.profileButton, isWeb && styles.webProfileButton]}
          onPress={() => navigation.navigate('Profile')}
          accessible={true}
          accessibilityLabel="Go to profile"
          accessibilityHint="Navigate to your profile page"
        >
          <Image
            source={
              userData?.profilePicture 
                ? { uri: userData.profilePicture } 
                : require('../../assets/default-profile.png')
            }
            style={styles.profileImage}
          />
          <Text style={styles.profileText}>Profile</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, userData]);

  // Fetch groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Ensure CometChat is initialized and user is logged in
        if (isWeb) {
          try {
            // Check if user is logged in to CometChat
            const loggedInUser = await CometChat.getLoggedinUser();
            if (!loggedInUser) {
              console.log("No user logged in to CometChat, attempting login");
              
              // Get current Firebase user
              const currentUser = auth.currentUser;
              if (!currentUser) {
                throw new Error("No Firebase user found");
              }
              
              // Login to CometChat
              await CometChat.login(currentUser.uid.toLowerCase(), COMETCHAT_CONSTANTS.AUTH_KEY);
              console.log("CometChat login successful");
            }
          } catch (loginError) {
            console.error("CometChat login error:", loginError);
            setError("There was an issue connecting to the chat service. Some features may be limited.");
            // Continue anyway - we'll still try to fetch groups
          }
        }
        
        // First get all groups
        const groupsRequest = new CometChat.GroupsRequestBuilder()
          .setLimit(30)
          .build();

        const groupsList = await groupsRequest.fetchNext();
        
        // Then get user's joined groups
        const joinedGroupsRequest = new CometChat.GroupsRequestBuilder()
          .setLimit(30)
          .joinedOnly(true)
          .build();

        const joinedGroups = await joinedGroupsRequest.fetchNext();
        const joinedGroupIds = new Set(joinedGroups.map(group => group.guid));

        // Combine the information
        const publicGroups = groupsList
          .filter(group => group.type === 'public')
          .map(group => ({
            ...group,
            hasJoined: joinedGroupIds.has(group.guid)
          }));

        console.log('Fetched public groups with join status:', publicGroups);
        setGroups(publicGroups);
        
        // Announce to screen reader
        announceToScreenReader(`Found ${publicGroups.length} communities`);
      } catch (error) {
        console.error('Error fetching groups:', error);
        setError('Failed to load communities. Please try again.');
        announceToScreenReader('Failed to load communities');
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, []);

  // Add screen reader announcement
  useEffect(() => {
    announceToScreenReader('Community Screen. Browse and join communities.');
  }, []);

  const joinGroup = async (group) => {
    try {
      setLoading(true);
      announceToScreenReader('Joining community');
      
      // First check if already joined
      const groupInfo = await CometChat.getGroup(group.guid);
      if (groupInfo.hasJoined) {
        navigation.navigate('GroupChat', {
          uid: group.guid,
          name: group.name
        });
        return;
      }

      // If not joined, try to join
      const joinedGroup = await CometChat.joinGroup(
        group.guid,
        group.type,
        group.password || ''
      );
      console.log('Group joined successfully:', joinedGroup);
      
      // Update the local state to reflect the joined status
      setGroups(prevGroups => 
        prevGroups.map(g => 
          g.guid === group.guid ? { ...g, hasJoined: true } : g
        )
      );
      
      announceToScreenReader('Community joined successfully');
      navigation.navigate('GroupChat', {
        uid: group.guid,
        name: group.name
      });
    } catch (error) {
      if (error.code === "ERR_ALREADY_JOINED") {
        // If already joined, update the local state and navigate
        setGroups(prevGroups => 
          prevGroups.map(g => 
            g.guid === group.guid ? { ...g, hasJoined: true } : g
          )
        );
        navigation.navigate('GroupChat', {
          uid: group.guid,
          name: group.name
        });
      } else {
        console.error('Error joining group:', error);
        showAlert('Error', 'Failed to join community');
        announceToScreenReader('Failed to join community');
      }
    } finally {
      setLoading(false);
    }
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
              setLoading(true);
              const fetchGroups = async () => {
                try {
                  // Fetch groups logic...
                  const groupsRequest = new CometChat.GroupsRequestBuilder()
                    .setLimit(30)
                    .build();
                  const groupsList = await groupsRequest.fetchNext();
                  
                  const joinedGroupsRequest = new CometChat.GroupsRequestBuilder()
                    .setLimit(30)
                    .joinedOnly(true)
                    .build();
                  const joinedGroups = await joinedGroupsRequest.fetchNext();
                  const joinedGroupIds = new Set(joinedGroups.map(group => group.guid));
                  
                  const publicGroups = groupsList
                    .filter(group => group.type === 'public')
                    .map(group => ({
                      ...group,
                      hasJoined: joinedGroupIds.has(group.guid)
                    }));
                  
                  setGroups(publicGroups);
                  announceToScreenReader(`Found ${publicGroups.length} communities`);
                } catch (error) {
                  console.error('Error fetching groups:', error);
                  setError('Failed to load communities. Please try again.');
                } finally {
                  setLoading(false);
                }
              };
              fetchGroups();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  const renderGroup = ({ item }) => (
    <TouchableOpacity 
      style={[styles.groupItem, isWeb && styles.webGroupItem]}
      onPress={() => {
        if (item.hasJoined) {
          navigation.navigate('GroupChat', {
            uid: item.guid,
            name: item.name
          });
        } else {
          joinGroup(item);
        }
      }}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} community`}
      accessibilityHint={item.hasJoined 
        ? "Double tap to open community chat" 
        : "Double tap to join community"
      }
    >
      <Image 
        source={
          item.icon 
            ? { uri: item.icon }
            : require('../../assets/group-default.png')
        }
        style={[styles.groupIcon, isWeb && styles.webGroupIcon]}
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel={`${item.name} community icon`}
      />
      <View 
        style={styles.groupInfo}
        accessible={true}
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={[styles.groupName, isWeb && styles.webGroupName]}>{item.name}</Text>
        {item.description && (
          <Text style={[styles.groupDescription, isWeb && styles.webGroupDescription]} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.groupMeta}>
          <Text style={styles.groupMembers}>
            {item.membersCount || 0} members
          </Text>
          <Text style={[styles.groupStatus, item.hasJoined ? styles.joinedStatus : styles.notJoinedStatus]}>
            {item.hasJoined ? 'Joined' : 'Not Joined'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, isWeb && styles.webContainer]}>
      {renderErrorMessage()}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#24269B" />
          <Text style={styles.loadingText}>Loading communities...</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={groups}
            renderItem={renderGroup}
            keyExtractor={item => item.guid}
            contentContainerStyle={[styles.listContent, isWeb && styles.webListContent]}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No communities found</Text>
                <Text style={styles.emptySubText}>Create a new community to get started</Text>
              </View>
            }
          />
          
          <TouchableOpacity
            style={[styles.fab, isWeb && styles.webFab]}
            onPress={() => navigation.navigate('CreateCommunity')}
            accessible={true}
            accessibilityLabel="Create new community"
            accessibilityHint={isWeb ? "Click to create a new community" : "Double tap to create a new community"}
            accessibilityRole="button"
          >
            <View style={styles.fabContent}>
              <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
              <Text style={styles.fabText}>Create Community</Text>
            </View>
          </TouchableOpacity>
        </>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  groupIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 12,
    color: '#999',
  },
  joinButton: {
    backgroundColor: '#24269B',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  joinedButton: {
    backgroundColor: '#E8E8FF',
    borderWidth: 1,
    borderColor: '#24269B',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  joinedButtonText: {
    color: '#24269B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  emptySubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#24269B',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  profileButton: {
    alignItems: 'center',
    marginRight: 15,
  },
  profileImage: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    borderWidth: 2,
    borderColor: '#24269B',
  },
  profileText: {
    fontSize: 12,
    color: '#24269B',
    marginTop: 2,
  },
  helperSection: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24269B',
    marginVertical: 10,
    marginHorizontal: 10,
    padding: 12,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#24269B',
    marginBottom: 10,
    textAlign: 'center',
  },
  helperTextContainer: {
    width: '100%',
    paddingHorizontal: 10,
  },
  helperText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
  },
  webContainer: {
    maxWidth: 1000,
    marginHorizontal: 'auto',
    width: '100%',
    padding: 20,
  },
  webListContent: {
    paddingBottom: 100,
  },
  webGroupItem: {
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#f5f5f5',
    },
    borderRadius: 8,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  webGroupIcon: {
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  webGroupName: {
    fontSize: 18,
  },
  webGroupDescription: {
    fontSize: 14,
  },
  webProfileButton: {
    cursor: 'pointer',
  },
  webFab: {
    cursor: 'pointer',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    transition: 'background-color 0.3s ease',
    ':hover': {
      backgroundColor: '#1a1c7a',
    },
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
  loadingText: {
    color: '#24269B',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  listContent: {
    padding: 20,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupMembers: {
    fontSize: 12,
    color: '#999',
  },
  groupStatus: {
    fontSize: 12,
    color: '#999',
  },
  joinedStatus: {
    color: '#4CAF50',
  },
  notJoinedStatus: {
    color: '#999',
  },
});

export default CommunityScreen; 