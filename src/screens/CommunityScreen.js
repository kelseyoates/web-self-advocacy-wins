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
} from 'react-native';
import { CometChat } from '@cometchat-pro/react-native-chat';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAccessibility } from '../context/AccessibilityContext';

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

  const renderGroup = ({ item }) => (
    <TouchableOpacity 
      style={styles.groupItem}
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
        style={styles.groupIcon}
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel={`${item.name} community icon`}
      />
      <View 
        style={styles.groupInfo}
        accessible={true}
        accessibilityRole="text"
        importantForAccessibility="no"
      >
        <Text 
          style={styles.groupName}
          accessibilityLabel={`Community name: ${item.name}`}
        >
          {item.name}
        </Text>
        <Text 
          style={styles.groupDescription} 
          numberOfLines={2}
          accessibilityLabel={`Description: ${item.description || 'No description available'}`}
        >
          {item.description || 'No description available'}
        </Text>
        <Text 
          style={styles.memberCount}
          accessibilityLabel={`${item.membersCount} members`}
        >
          {item.membersCount} members
        </Text>
      </View>
      <TouchableOpacity 
        style={[
          styles.joinButton,
          item.hasJoined && styles.joinedButton
        ]}
        onPress={() => !item.hasJoined && joinGroup(item)}
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
      >
        <Text style={[
          styles.joinButtonText,
          item.hasJoined && styles.joinedButtonText
        ]}>
          {item.hasJoined ? 'Joined' : 'Join'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View 
      style={styles.container}
      accessible={true}
      accessibilityRole="list"
      accessibilityLabel="Communities list"
    >
      <FlatList
        ListHeaderComponent={() => (
          showHelpers && (
            <View 
              style={styles.helperSection}
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel="Helper Information: Join Communities. Image shows three self-advocates hanging out and having fun. Browse and join public communities. Chat with people who share your interests. Create your own public community with the dark blue Create Community button. Communities are public groups, so everyone can see what you write or upload."
            >
              <View style={styles.helperHeader}>
                <MaterialCommunityIcons 
                  name="information" 
                  size={24} 
                  color="#24269B"
                  style={styles.infoIcon}
                  importantForAccessibility="no"
                />
              </View>
              <View style={styles.helperContent}>
                <Image 
                  source={require('../../assets/community.png')}
                  style={styles.helperImage}
                  importantForAccessibility="no"
                />
                <Text style={styles.helperTitle} importantForAccessibility="no">Join Communities!</Text>
                <View style={styles.helperTextContainer} importantForAccessibility="no">
                  <Text style={styles.helperText} importantForAccessibility="no">
                    • Browse and join public communities
                  </Text>
                  <Text style={styles.helperText} importantForAccessibility="no">
                    • Chat with people who share your interests
                  </Text>
                  <Text style={styles.helperText} importantForAccessibility="no">
                    • Create your own public community with the dark blue Create Community button
                  </Text>
                  <Text style={styles.helperText} importantForAccessibility="no">
                    • Communities are public groups, so everyone can see what you write or upload
                  </Text>
                </View>
              </View>
            </View>
          )
        )}
        data={groups}
        renderItem={renderGroup}
        keyExtractor={item => item.guid}
        accessibilityRole="list"
        accessibilityLabel="List of available communities"
        ListEmptyComponent={
          !loading && (
            <View 
              style={styles.emptyContainer}
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel="No communities available"
            >
              <Text style={styles.emptyText}>No communities available</Text>
            </View>
          )
        }
      />
      
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateCommunity')}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Create new community"
        accessibilityHint="Opens the community creation form"
      >
        <View 
          style={styles.fabContent}
          importantForAccessibility="no"
        >
          <MaterialCommunityIcons 
            name="plus" 
            size={24} 
            color="#FFFFFF"
            accessibilityElementsHidden={true}
          />
          <Text style={styles.fabText}>Create Community</Text>
        </View>
      </TouchableOpacity>

      {loading && (
        <View 
          style={styles.loadingContainer}
          accessible={true}
          accessibilityRole="progressbar"
          accessibilityLabel="Loading communities"
        >
          <ActivityIndicator 
            size="large" 
            color="#24269B"
            accessibilityLabel="Loading"
          />
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
});

export default CommunityScreen; 