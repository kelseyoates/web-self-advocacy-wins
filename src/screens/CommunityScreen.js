import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ScrollView,
  Pressable,
  useWindowDimensions,
  Keyboard,
  findNodeHandle,
  Animated,
} from 'react-native';
// Conditional import based on platform
const isWeb = Platform.OS === 'web';
let CometChat;
if (isWeb) {
  CometChat = require('@cometchat-pro/chat').CometChat;
} else {
  CometChat = require('@cometchat-pro/react-native-chat').CometChat;
}
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAccessibility } from '../context/AccessibilityContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as Clipboard from 'expo-clipboard';

const CommunityScreen = ({ navigation }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const { showHelpers } = useAccessibility();
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;
  const scrollViewRef = useRef(null);
  
  // Web-specific states for interactions
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [focusedGroup, setFocusedGroup] = useState(null);
  const fabRef = useRef(null);
  const groupRefs = useRef({});
  
  // Calculate responsive styles based on platform and screen size
  const responsiveStyles = {
    container: {
      flex: 1,
      backgroundColor: '#F5F5F5',
      ...(isWeb && {
        maxWidth: isMobile ? '100%' : '1200px',
        marginHorizontal: isMobile ? 0 : 'auto',
        paddingHorizontal: isMobile ? 0 : 20,
      }),
    },
    scrollView: {
      flex: 1,
      width: '100%',
      ...(isWeb && {
        paddingHorizontal: isMobile ? 10 : 20,
      }),
    },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 20,
      backgroundColor: hoveredButton === 'fab' ? '#3a3db1' : '#24269B',
      borderRadius: 30,
      paddingVertical: 10,
      paddingHorizontal: 15,
      elevation: 5,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      ...(isWeb && {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        paddingVertical: 12,
        paddingHorizontal: 20,
        zIndex: 10,
      }),
    },
    helperSection: [
      styles.helperSection,
      isWeb && styles.webHelperSection
    ]
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

  // Detect screen reader for web accessibility
  useEffect(() => {
    if (isWeb) {
      // Check if screen reader is enabled on web
      const checkScreenReader = async () => {
        try {
          // This is a simplified check - actual implementation would depend on the browser
          const result = await AccessibilityInfo.isScreenReaderEnabled();
          setIsScreenReaderEnabled(result);
        } catch (error) {
          console.log('Error checking screen reader: ', error);
        }
      };
      
      checkScreenReader();
      
      // For web, we could listen to changes if needed
      if (typeof window !== 'undefined') {
        window.addEventListener('screenreaderchange', checkScreenReader);
        return () => {
          window.removeEventListener('screenreaderchange', checkScreenReader);
        };
      }
    } else {
      // For mobile, use React Native's built-in methods
      const subscription = AccessibilityInfo.addEventListener(
        'screenReaderChanged',
        (isEnabled) => {
          setIsScreenReaderEnabled(isEnabled);
        }
      );
      
      AccessibilityInfo.isScreenReaderEnabled().then((isEnabled) => {
        setIsScreenReaderEnabled(isEnabled);
      });
      
      return () => {
        subscription.remove();
      };
    }
  }, []);

  // Add screen reader announcement
  useEffect(() => {
    announceToScreenReader('Community Screen. Browse and join communities.');
  }, []);

  // Update announceToScreenReader for web and native
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

  // Add keyboard navigation handler
  const handleKeyPress = useCallback((e, onPress, item) => {
    if (isWeb) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPress();
      } else if (item && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const currentIndex = groups.findIndex(group => group.guid === item.guid);
        const nextIndex = e.key === 'ArrowDown' 
          ? Math.min(currentIndex + 1, groups.length - 1)
          : Math.max(currentIndex - 1, 0);
        const nextGroup = groups[nextIndex];
        if (nextGroup) {
          setFocusedGroup(nextGroup.guid);
          groupRefs.current[nextGroup.guid]?.focus();
        }
      }
    }
  }, [groups]);

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

  const renderGroup = useCallback(({ item }) => {
    const groupItemStyle = [
      styles.groupItem,
      isWeb && styles.webGroupItem,
      isWeb && hoveredGroup === item.guid && styles.webGroupItemHover,
      isWeb && focusedGroup === item.guid && styles.webGroupItemFocus
    ];
    
    const joinButtonStyle = [
      styles.joinButton,
      item.hasJoined && styles.joinedButton,
      isWeb && styles.webJoinButton,
      isWeb && item.hasJoined && styles.webJoinedButton,
      isWeb && hoveredButton === `join-${item.guid}` && !item.hasJoined && styles.webJoinButtonHover,
    ];
    
    const handlePress = () => {
      if (item.hasJoined) {
        navigation.navigate('GroupChat', {
          uid: item.guid,
          name: item.name
        });
      } else {
        joinGroup(item);
      }
      announceToScreenReader(item.hasJoined ? `Opening ${item.name} community chat` : `Joining ${item.name} community`);
    };

    return (
      <Pressable 
        ref={el => groupRefs.current[item.guid] = el}
        style={groupItemStyle}
        onPress={handlePress}
        onMouseEnter={isWeb ? () => setHoveredGroup(item.guid) : undefined}
        onMouseLeave={isWeb ? () => setHoveredGroup(null) : undefined}
        onFocus={isWeb ? () => setFocusedGroup(item.guid) : undefined}
        onBlur={isWeb ? () => setFocusedGroup(null) : undefined}
        onKeyPress={(e) => handleKeyPress(e, handlePress, item)}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${item.name} community`}
        accessibilityHint={item.hasJoined 
          ? "Double tap to open community chat" 
          : "Double tap to join community"
        }
        role={isWeb ? "button" : undefined}
        tabIndex={isWeb ? 0 : undefined}
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
          accessibilityLabel={`${item.name} community icon`}
        />
        <View style={[
          styles.groupInfo,
          isWeb && styles.webGroupInfo
        ]}>
          <Text 
            style={[
              styles.groupName,
              isWeb && styles.webGroupName
            ]}
            role={isWeb ? "heading" : undefined}
            aria-level={isWeb ? 3 : undefined}
          >
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
          style={joinButtonStyle}
          onPress={() => !item.hasJoined && joinGroup(item)}
          onMouseEnter={isWeb ? () => setHoveredButton(`join-${item.guid}`) : undefined}
          onMouseLeave={isWeb ? () => setHoveredButton(null) : undefined}
          onKeyPress={(e) => handleKeyPress(e, () => !item.hasJoined && joinGroup(item), item)}
          disabled={item.hasJoined}
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
          role={isWeb ? "button" : undefined}
          tabIndex={isWeb ? 0 : undefined}
        >
          <Text style={[
            styles.joinButtonText,
            item.hasJoined && styles.joinedButtonText,
            isWeb && styles.webJoinButtonText
          ]}>
            {item.hasJoined ? 'Joined' : 'Join'}
          </Text>
        </TouchableOpacity>
      </Pressable>
    );
  }, [groups, joinGroup, navigation, hoveredGroup, hoveredButton, focusedGroup, handleKeyPress, announceToScreenReader, isWeb]);

  const renderHelperSection = useCallback(() => (
    <View style={responsiveStyles.helperSection}>
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
          style={[styles.helperImage, isWeb && styles.webHelperImage]}
          accessibilityLabel="Community illustration"
        />
        <Text 
          style={[styles.helperTitle, isWeb && styles.webHelperTitle]}
          role={isWeb ? "heading" : undefined}
          aria-level={isWeb ? 2 : undefined}
        >
          Welcome to Communities!
        </Text>
        <View style={styles.helperTextContainer}>
          <Text style={[styles.helperText, isWeb && styles.webHelperText]}>
            • Join existing communities to connect with others
          </Text>
          <Text style={[styles.helperText, isWeb && styles.webHelperText]}>
            • Share experiences and support each other
          </Text>
          <Text style={[styles.helperText, isWeb && styles.webHelperText]}>
            • Create your own communities on topics you care about
          </Text>
          <Text style={[styles.helperText, isWeb && styles.webHelperText]}>
            • Use the Create Community button to get started
          </Text>
        </View>
      </View>
    </View>
  ), [responsiveStyles.helperSection, isWeb]);

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
          {!isMobile && (
            <Text 
              style={[styles.pageTitle, isWeb && styles.webPageTitle]}
              role="heading"
              aria-level={1}
            >
              Communities
            </Text>
          )}
          
          {showHelpers && renderHelperSection()}
          
          {groups.map((item) => (
            <React.Fragment key={item.guid}>
              {renderGroup({ item })}
            </React.Fragment>
          ))}
          
          {groups.length === 0 && !loading && (
            <View style={[styles.emptyContainer, isWeb && styles.webEmptyContainer]}>
              <Image 
                source={require('../../assets/megaphone.png')}
                style={[styles.emptyImage, isWeb && styles.webEmptyImage]}
                accessibilityLabel="Empty communities illustration"
              />
              <Text 
                style={[styles.emptyText, isWeb && styles.webEmptyText]}
                role="heading"
                aria-level={2}
              >
                No communities available
              </Text>
              <Text style={[styles.emptySubtext, isWeb && styles.webEmptySubtext]}>
                Be the first to create a community!
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, isWeb && styles.webEmptyButton]}
                onPress={() => navigation.navigate('CreateCommunity')}
                accessibilityRole="button"
                accessibilityLabel="Create a new community"
                role={isWeb ? "button" : undefined}
                tabIndex={isWeb ? 0 : undefined}
              >
                <Text style={styles.emptyButtonText}>Create Community</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          ListHeaderComponent={showHelpers ? renderHelperSection : null}
          data={groups}
          renderItem={renderGroup}
          keyExtractor={item => item.guid}
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No communities available</Text>
                <Text style={styles.emptySubtext}>
                  Be the first to create a community!
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => navigation.navigate('CreateCommunity')}
                  accessibilityRole="button"
                  accessibilityLabel="Create a new community"
                >
                  <Text style={styles.emptyButtonText}>Create Community</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}
      
      <TouchableOpacity
        ref={fabRef}
        style={responsiveStyles.fab}
        onPress={() => {
          announceToScreenReader('Opening create community screen');
          navigation.navigate('CreateCommunity');
        }}
        onMouseEnter={isWeb ? () => setHoveredButton('fab') : undefined}
        onMouseLeave={isWeb ? () => setHoveredButton(null) : undefined}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Create new community"
        accessibilityHint="Opens the community creation form"
        role={isWeb ? "button" : undefined}
        tabIndex={isWeb ? 0 : undefined}
        onKeyPress={(e) => handleKeyPress(e, () => navigation.navigate('CreateCommunity'))}
      >
        <View style={styles.fabContent}>
          <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>Create Community</Text>
        </View>
      </TouchableOpacity>

      {loading && (
        <View style={[styles.loadingContainer, isWeb && styles.webLoadingContainer]}>
          <ActivityIndicator size="large" color="#24269B" />
          <Text style={[styles.loadingText, isWeb && styles.webLoadingText]}>
            Loading communities...
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
  webGroupItemHover: {
    backgroundColor: '#f5f5f5',
  },
  webGroupItemFocus: {
    backgroundColor: '#E0E0FF',
  },
  webJoinButtonHover: {
    backgroundColor: '#1a1b6e',
  },
  webHelperImage: {
    width: 200,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  webHelperTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#24269B',
    marginBottom: 10,
    textAlign: 'center',
  },
  webHelperText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
  },
  webHelperSection: {
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
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#24269B',
    marginBottom: 20,
    textAlign: 'center',
  },
  emptyImage: {
    width: 200,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#24269B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#24269B',
  },
  webEmptyContainer: {
    maxWidth: 800,
    marginHorizontal: 'auto',
    height: '100vh',
    paddingTop: 20,
  },
  webEmptyImage: {
    width: 200,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  webEmptyText: {
    fontSize: 16,
    color: '#666',
  },
  webEmptySubtext: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  webEmptyButton: {
    backgroundColor: '#24269B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  webLoadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#24269B',
  },
  webPageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#24269B',
    marginBottom: 20,
    textAlign: 'center',
  },
});

export default CommunityScreen; 