import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  Alert,
  AccessibilityInfo,
  Image
} from 'react-native';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { auth, db} from '../config/firebase';

const AddSupporterScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);

  // Check for screen reader
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

  // Helper function for screen reader announcements
  const announceToScreenReader = (message) => {
    if (isScreenReaderEnabled) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Please enter a username to search');
      announceToScreenReader('Please enter a username to search');
      return;
    }

    setLoading(true);
    announceToScreenReader('Searching for supporters');
    
    try {
      const usersRef = collection(db, 'users');
      const lowercaseQuery = searchQuery.toLowerCase();
      console.log('Searching for username:', lowercaseQuery);

      const q = query(usersRef, where('username', '>=', lowercaseQuery), 
                             where('username', '<=', lowercaseQuery + '\uf8ff'));
      const querySnapshot = await getDocs(q);

      const results = [];
      
      for (const userDoc of querySnapshot.docs) {
        const userData = userDoc.data();
        if (userDoc.id !== auth.currentUser.uid.toLowerCase()) {
          // Check supporter limits based on subscription type
          const subscriptionType = userData.subscriptionType;
          const maxSupported = {
            'supporter1': 1,
            'supporter3': 3,
            'supporter5': 5,
            'supporter10': 10,
            'supporter25': 25,
            'selfAdvocatePlus': 1,
            'selfAdvocateDating': 1,
            null: 0,
            undefined: 0
          };

          const supporterLimit = maxSupported[subscriptionType] || 0;
          console.log('User subscription:', subscriptionType);
          console.log('Support limit:', supporterLimit);

          // Count current supported users
          const allUsersSnapshot = await getDocs(usersRef);
          let currentSupportCount = 0;
          allUsersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.supporters?.some(supporter => 
              supporter.id.toLowerCase() === userDoc.id.toLowerCase()
            )) {
              currentSupportCount++;
            }
          });

          console.log('Current support count:', currentSupportCount);

          // Add availability info to the user data
          results.push({
            id: userDoc.id,
            ...userData,
            currentSupportCount,
            supporterLimit,
            isAvailable: currentSupportCount < supporterLimit
          });
        }
      }

      setSearchResults(results);
      console.log('Search results:', results);
      announceToScreenReader(`Found ${results.length} users`);
    } catch (error) {
      console.error('Search error:', error);
      announceToScreenReader('Error searching for users');
      Alert.alert('Error', 'Failed to search for users');
    }
    setLoading(false);
  };

  const handleAddSupporter = async (userToSupport) => {
    try {
      const supporterDoc = await getDoc(doc(db, 'users', userToSupport.id.toLowerCase()));
      const supporterData = supporterDoc.data();
      const subscriptionType = supporterData.subscriptionType;

      console.log('Supporter subscription:', subscriptionType);

      const maxSupported = {
        'supporter1': 1,
        'supporter3': 3,
        'supporter5': 5,
        'supporter10': 10,
        'supporter25': 25,
        'selfAdvocatePlus': 1,
        'selfAdvocateDating': 1,
        null: 0,
        undefined: 0
      };

      const supporterLimit = maxSupported[subscriptionType] || 0;

      // Get all users this supporter is currently supporting
      const usersRef = collection(db, 'users');
      const allUsersSnapshot = await getDocs(usersRef);
      
      let currentSupportCount = 0;
      allUsersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.supporters?.some(supporter => 
          supporter.id.toLowerCase() === userToSupport.id.toLowerCase()
        )) {
          currentSupportCount++;
        }
      });

      console.log('Current support count:', currentSupportCount);
      console.log('Supporter limit:', supporterLimit);

      if (currentSupportCount >= supporterLimit) {
        Alert.alert(
          'Supporter Limit Reached',
          `This user has reached their limit of ${supporterLimit} ${supporterLimit === 1 ? 'person' : 'people'} they can support.`
        );
        return;
      }

      // If we get here, it means they haven't reached their limit, so proceed with adding them
      const userRef = doc(db, 'users', auth.currentUser.uid.toLowerCase());
      await updateDoc(userRef, {
        supporters: arrayUnion({
          id: userToSupport.id.toLowerCase(),
          addedAt: new Date().toISOString(),
          username: supporterData.username || 'Unknown User'
        })
      });

      Alert.alert(
        'Success',
        'Supporter added successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );

    } catch (error) {
      console.error('Error adding supporter:', error);
      Alert.alert('Error', 'Failed to add supporter');
    }
  };

  return (
    <View 
      style={styles.container}
      accessible={true}
      accessibilityLabel="Add Supporter Screen"
    >
      <View 
        style={styles.searchContainer}
        accessible={true}
        accessibilityLabel="Search Section"
      >
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          accessible={true}
          accessibilityLabel="Search username input"
          accessibilityHint="Enter a username to search for supporters"
          accessibilityRole="search"
        />
        <TouchableOpacity 
          style={[
            styles.searchButton,
            loading && styles.searchButtonDisabled
          ]}
          onPress={handleSearch}
          disabled={loading}
          accessible={true}
          accessibilityLabel={loading ? "Searching" : "Search"}
          accessibilityHint="Search for users with the entered username"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          <Text style={styles.searchButtonText}>
            {loading ? 'Searching...' : 'Search'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id}
        accessible={true}
        accessibilityLabel="Search Results"
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[
              styles.resultCard,
              !item.isAvailable && styles.resultCardDisabled
            ]}
            onPress={() => item.isAvailable ? handleAddSupporter(item) : null}
            disabled={!item.isAvailable}
            accessible={true}
            accessibilityLabel={`${item.username || 'Unknown Username'} from ${item.state || 'Unknown location'}${!item.isAvailable ? ' - Not available, reached support limit' : ''}`}
            accessibilityHint={item.isAvailable ? "Double tap to add this user as your supporter" : "This supporter has reached their support limit"}
            accessibilityRole="button"
            accessibilityState={{ disabled: !item.isAvailable }}
          >
            <View style={styles.cardContent}>
              <Image 
                source={item.profilePicture 
                  ? { uri: item.profilePicture }
                  : require('../../assets/default-avatar.png')}
                style={styles.profileImage}
                accessibilityLabel={`${item.username}'s profile picture`}
              />
              <View style={styles.userDetails}>
                <Text style={styles.userName}>
                  {item.username || 'Unknown Username'}
                </Text>
                {item.state && (
                  <Text style={styles.userLocation}>
                    📍 {item.state}
                  </Text>
                )}
                {!item.isAvailable && (
                  <Text style={styles.limitReachedText}>
                    Support limit reached ({item.currentSupportCount}/{item.supporterLimit})
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text 
            style={styles.emptyText}
            accessible={true}
            accessibilityLabel={searchQuery ? 'No users found' : 'Search for users by username'}
          >
            {searchQuery ? 'No users found' : 'Search for users by username'}
          </Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resultCardDisabled: {
    opacity: 0.7,
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#24269B',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#24269B',
    marginBottom: 4,
  },
  userLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  limitReachedText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    fontSize: 16,
    padding: 20,
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
});

export default AddSupporterScreen; 