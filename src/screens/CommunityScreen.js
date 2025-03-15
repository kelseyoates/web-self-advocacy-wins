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
  Platform,
  ScrollView
} from 'react-native';
// Conditional import based on platform
const CometChat = Platform.OS === 'web' 
  ? require('@cometchat-pro/chat').CometChat
  : require('@cometchat-pro/react-native-chat').CometChat;
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAccessibility } from '../context/AccessibilityContext';

const isWeb = Platform.OS === 'web';

const CommunityScreen = ({ navigation }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const { showHelpers } = useAccessibility();

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
          style={styles.profileButton}
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
      } catch (error) {
        console.error('Error fetching groups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, []);

  // Add screen reader announcement
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('Community Screen. Browse and join communities.');
  }, []);

  const joinGroup = async (group) => {
    try {
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
        Alert.alert('Error', 'Failed to join group');
      }
    }
  };

  // Add keyboard navigation handler
  const handleKeyPress = (e, onPress) => {
    if (isWeb && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onPress();
    }
  };

  // Update announceToScreenReader for web
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

  const renderGroup = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.groupItem,
        isWeb && styles.webGroupItem
      ]}
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
      onKeyPress={(e) => handleKeyPress(e, () => {
        if (item.hasJoined) {
          navigation.navigate('GroupChat', {
            uid: item.guid,
            name: item.name
          });
        } else {
          joinGroup(item);
        }
      })}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} community`}
      accessibilityHint={item.hasJoined 
        ? "Double tap to open community chat" 
        : "Double tap to join community"
      }
      role="button"
      tabIndex={0}
    >
      <Image 
        source={
          item.icon 
            ? { uri: item.icon }
            : require('../../assets/group-default.png')
        }
        style={[
          styles.groupIcon,
          isWeb && styles.webGroupIcon
        ]}
        alt={`${item.name} community icon`}
      />
      <View style={[
        styles.groupInfo,
        isWeb && styles.webGroupInfo
      ]}>
        <Text style={[
          styles.groupName,
          isWeb && styles.webGroupName
        ]}>
          {item.name}
        </Text>
        <Text style={[
          styles.groupDescription,
          isWeb && styles.webGroupDescription
        ]} numberOfLines={2}>
          {item.description || 'No description available'}
        </Text>
        <Text style={[
          styles.memberCount,
          isWeb && styles.webMemberCount
        ]}>
          {item.membersCount} members
        </Text>
      </View>
      <TouchableOpacity 
        style={[
          styles.joinButton,
          item.hasJoined && styles.joinedButton,
          isWeb && styles.webJoinButton,
          isWeb && item.hasJoined && styles.webJoinedButton
        ]}
        onPress={() => !item.hasJoined && joinGroup(item)}
        onKeyPress={(e) => handleKeyPress(e, () => !item.hasJoined && joinGroup(item))}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={item.hasJoined ? "Already joined" : "Join community"}
        accessibilityHint={item.hasJoined 
          ? "You are already a member of this community" 
          : "Double tap to join this community"
        }
        accessibilityState={{
          disabled: item.hasJoined
        }}
        role="button"
        tabIndex={0}
      >
        <Text style={[
          styles.joinButtonText,
          item.hasJoined && styles.joinedButtonText,
          isWeb && styles.webJoinButtonText
        ]}>
          {item.hasJoined ? 'Joined' : 'Join'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

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
          {groups.map((item) => (
            <React.Fragment key={item.guid}>
              {renderGroup({ item })}
            </React.Fragment>
          ))}
          {groups.length === 0 && !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No communities available</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          ListHeaderComponent={() => showHelpers && renderHelperSection()}
          data={groups}
          renderItem={renderGroup}
          keyExtractor={item => item.guid}
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No communities available</Text>
              </View>
            )
          }
        />
      )}
      
      <TouchableOpacity
        style={[
          styles.fab,
          isWeb && styles.webFab
        ]}
        onPress={() => navigation.navigate('CreateCommunity')}
        onKeyPress={(e) => handleKeyPress(e, () => navigation.navigate('CreateCommunity'))}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Create new community"
        accessibilityHint="Opens the community creation form"
        role="button"
        tabIndex={0}
      >
        <View style={styles.fabContent}>
          <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>Create Community</Text>
        </View>
      </TouchableOpacity>

      {loading && (
        <View style={[
          styles.loadingContainer,
          isWeb && styles.webLoadingContainer
        ]}>
          <ActivityIndicator size="large" color="#24269B" />
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
    maxWidth: 800,
    marginHorizontal: 'auto',
    height: '100vh',
    paddingTop: 20,
  },
  webScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  webGroupItem: {
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#f5f5f5',
    },
    borderRadius: 8,
    marginBottom: 8,
    padding: 16,
  },
  webGroupIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  webGroupInfo: {
    flex: 1,
    marginLeft: 20,
  },
  webGroupName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  webGroupDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  webMemberCount: {
    fontSize: 12,
    color: '#666',
  },
  webJoinButton: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      transform: 'scale(1.05)',
      backgroundColor: '#1a1b6e',
    },
  },
  webJoinedButton: {
    ':hover': {
      backgroundColor: '#E0E0FF',
    },
  },
  webJoinButtonText: {
    fontSize: 14,
  },
  webFab: {
    cursor: 'pointer',
    transition: 'transform 0.2s ease, background-color 0.2s ease',
    ':hover': {
      transform: 'scale(1.05)',
      backgroundColor: '#1a1b6e',
    },
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  },
  webLoadingContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});

export default CommunityScreen; 