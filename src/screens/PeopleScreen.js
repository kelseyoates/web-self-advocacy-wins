import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  AccessibilityInfo
} from 'react-native';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAccessibility } from '../context/AccessibilityContext';

const PeopleScreen = () => {
  const [activeTab, setActiveTab] = useState('followers');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const { user } = useAuth();
  const { showHelpers } = useAccessibility();

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

  useEffect(() => {
    fetchUsers();
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      announceToScreenReader(`Loading ${activeTab} list`);
      setLoading(true);
      const usersRef = collection(db, 'users');
      const userDocRef = doc(db, 'users', user.uid.toLowerCase());
      const userSnapshot = await getDoc(userDocRef);
      
      // Check if user document exists, if not, create it
      if (!userSnapshot.exists()) {
        // Initialize user document with empty following array
        await setDoc(userDocRef, {
          uid: user.uid.toLowerCase(), // Ensure uid is lowercase
          following: [],
          // Add any other default fields you need
        });
        setUsers([]);
        return;
      }
      
      const userData = userSnapshot.data();
      let usersList = [];
      
      if (activeTab === 'followers') {
        // Fetch users who follow the current user
        const q = query(usersRef, where('following', 'array-contains', user.uid.toLowerCase())); // Use lowercase
        const querySnapshot = await getDocs(q);
        usersList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isFollowing: userData?.following?.includes(doc.id.toLowerCase()) || false // Compare with lowercase
        }));
      } else {
        // Fetch users followed by the current user
        const following = userData?.following || [];
        if (following.length > 0) {
          const q = query(usersRef, where('uid', 'in', following.map(id => id.toLowerCase()))); // Ensure all IDs are lowercase
          const querySnapshot = await getDocs(q);
          usersList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            isFollowing: true
          }));
        }
      }
      
      setUsers(usersList);
      announceToScreenReader(`Loaded ${usersList.length} ${activeTab}`);
    } catch (error) {
      announceToScreenReader(`Error loading ${activeTab}`);
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFollow = async (userId, username) => {
    try {
      announceToScreenReader(`Following ${username}`);
      const userRef = doc(db, 'users', user.uid.toLowerCase());
      await updateDoc(userRef, {
        following: arrayUnion(userId.toLowerCase()) // Ensure lowercase when following
      });
      setUsers(users.map(u => 
        u.id === userId ? { ...u, isFollowing: true } : u
      ));
      announceToScreenReader(`Successfully followed ${username}`);
    } catch (error) {
      announceToScreenReader('Failed to follow user');
      console.error('Error following user:', error);
    }
  };
  
  const handleUnfollow = async (userId, username) => {
    try {
      announceToScreenReader(`Unfollowing ${username}`);
      const userRef = doc(db, 'users', user.uid.toLowerCase());
      await updateDoc(userRef, {
        following: arrayRemove(userId.toLowerCase()) // Ensure lowercase when unfollowing
      });
      setUsers(users.map(u => 
        u.id === userId ? { ...u, isFollowing: false } : u
      ));
      announceToScreenReader(`Successfully unfollowed ${username}`);
    } catch (error) {
      announceToScreenReader('Failed to unfollow user');
      console.error('Error unfollowing user:', error);
    }
  };

// Update the renderUser function
const renderUser = ({ item }) => (
    <View 
      style={styles.userItem}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${item.username}${item.state ? ` from ${item.state}` : ''}`}
    >
      <Image
        source={item.profilePicture ? { uri: item.profilePicture } : require('../../assets/default-profile.png')}
        style={styles.profilePicture}
        accessible={true}
        accessibilityLabel={`${item.username}'s profile picture`}
        accessibilityRole="image"
      />
      <View 
        style={styles.userInfo}
        accessible={true}
        accessibilityRole="text"
      >
        <Text style={styles.username}>{item.username}</Text>
        {item.state && (
          <Text 
            style={styles.userState}
            accessibilityLabel={`Located in ${item.state}`}
          >
            📍 {item.state}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[
          styles.followButton,
          item.isFollowing && styles.followingButton
        ]}
        onPress={() => item.isFollowing ? 
          handleUnfollow(item.id, item.username) : 
          handleFollow(item.id, item.username)
        }
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${item.isFollowing ? 'Unfollow' : 'Follow'} ${item.username}`}
        accessibilityHint={item.isFollowing ? 
          'Double tap to stop following this user' : 
          'Double tap to start following this user'
        }
      >
        <View style={styles.buttonContent}>
          <Text style={[
            styles.followButtonText,
            item.isFollowing && styles.followingButtonText
          ]}>
            {item.isFollowing ? 'Unfollow' : 'Follow'}
          </Text>
          <MaterialCommunityIcons 
            name={item.isFollowing ? "minus" : "plus"} 
            size={20} 
            color={item.isFollowing ? "#24269B" : "white"} 
            style={styles.iconStyle}
          />
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <View 
      style={styles.container}
      accessible={true}
      accessibilityLabel="People Screen"
    >
      {showHelpers && (
        <View 
          style={styles.helperSection}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="Helper Information: Following and Followers. You can see who you're following and who follows you. Switch between tabs to view different lists. In the future, you'll be able to choose if you only want to see wins from people you follow. For now, you'll see everyone's wins in your feed."
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
          <Text style={styles.helperTitle}>Following and Followers</Text>
          <View style={styles.helperTextContainer}>
            <Text style={styles.helperText}>
              • Switch between tabs to see who you're following and who follows you
            </Text>
            <Text style={styles.helperText}>
              • Tap Follow or Unfollow to update your connections
            </Text>
            <Text style={styles.helperText}>
              • Coming soon: Choose to see wins only from people you follow
            </Text>
            <Text style={styles.helperText}>
              • For now, you'll see everyone's wins in your feed
            </Text>
          </View>
        </View>
      )}

      <View 
        style={styles.tabContainer}
        accessible={true}
        accessibilityRole="tablist"
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === 'followers' && styles.activeTab]}
          onPress={() => {
            setActiveTab('followers');
            announceToScreenReader('Switched to followers tab');
          }}
          accessible={true}
          accessibilityRole="tab"
          accessibilityLabel="Followers tab"
          accessibilityState={{ selected: activeTab === 'followers' }}
        >
          <Text style={[styles.tabText, activeTab === 'followers' && styles.activeTabText]}>
            Followers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'following' && styles.activeTab]}
          onPress={() => {
            setActiveTab('following');
            announceToScreenReader('Switched to following tab');
          }}
          accessible={true}
          accessibilityRole="tab"
          accessibilityLabel="Following tab"
          accessibilityState={{ selected: activeTab === 'following' }}
        >
          <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>
            Following
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View 
          style={styles.loader}
          accessible={true}
          accessibilityRole="progressbar"
          accessibilityLabel={`Loading ${activeTab}`}
        >
          <ActivityIndicator size="large" color="#24269B" />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          accessible={true}
          accessibilityLabel={`List of ${activeTab}`}
          ListEmptyComponent={
            <Text 
              style={styles.emptyText}
              accessible={true}
              accessibilityRole="text"
            >
              {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone'}
            </Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#24269B',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#24269B',
    fontWeight: '600',
  },
  list: {
    padding: 15,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userInfo: {
    flex: 1,
    marginLeft: 15,
  },
  username: {
    fontSize: 16,
    fontWeight: '500',
  },
  userState: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#24269B',
  },
  followingButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#24269B',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  followingButtonText: {
    color: '#24269B',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 30,
    fontSize: 16,
  },
  helperSection: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24269B',
    marginVertical: 10,
    marginHorizontal: 10,
    padding: 10,
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

export default PeopleScreen;