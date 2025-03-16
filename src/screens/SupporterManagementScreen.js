import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Image, FlatList, Platform } from 'react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const SupporterManagementScreen = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  const fetchUserData = async () => {
    try {
      const user = auth.currentUser;
      if (!user?.uid) {
        console.log('Waiting for auth...');
        return;
      }

      const lowercaseUid = user.uid.toLowerCase();
      console.log('Fetching user data for:', lowercaseUid);

      const userDoc = await getDoc(doc(db, 'users', lowercaseUid));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        
        // Fetch current info for each supporter
        if (data.supporters && data.supporters.length > 0) {
          const updatedSupporters = await Promise.all(
            data.supporters.map(async (supporter) => {
              try {
                const supporterDoc = await getDoc(doc(db, 'users', supporter.id.toLowerCase()));
                if (supporterDoc.exists()) {
                  const supporterData = supporterDoc.data();
                  return {
                    ...supporter,
                    profilePicture: supporterData.profilePicture,
                    username: supporterData.username || supporter.username,
                    state: supporterData.state,
                  };
                }
                return supporter;
              } catch (error) {
                console.error('Error fetching supporter data:', error);
                return supporter;
              }
            })
          );
          
          data.supporters = updatedSupporters;
        }
        
        console.log('User data fetched:', data);
        setUserData(data);
      } else {
        console.log('No user document found for lowercase uid:', lowercaseUid);
        Alert.alert('Error', 'Unable to find your user profile');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load user data');
      setLoading(false);
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('Screen focused, refreshing data...');
      fetchUserData();
    }, [])
  );

  // Initial data fetch
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchUserData();
      } else {
        console.log('No authenticated user');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleRemoveSupporter = async (supporter) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      setLoading(true); // Add loading state while removing

      const lowercaseUid = user.uid.toLowerCase();
      const userRef = doc(db, 'users', lowercaseUid);

      // Get current supporters array
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      // Filter out the removed supporter
      const updatedSupporters = userData.supporters.filter(s => s.id.toLowerCase() !== supporter.id.toLowerCase());

      // Update Firestore
      await updateDoc(userRef, {
        supporters: updatedSupporters
      });

      // Update local state
      setUserData(prev => ({
        ...prev,
        supporters: updatedSupporters
      }));

      // Show success message
      Alert.alert(
        'Success',
        'Supporter removed successfully',
        [{ text: 'OK' }]
      );

      console.log('Supporter removed successfully');
    } catch (error) {
      console.error('Error removing supporter:', error);
      Alert.alert('Error', 'Failed to remove supporter. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View 
        style={styles.container}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel="Loading supporter management"
      >
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const canManageSupporters = userData?.subscriptionType === 'selfAdvocatePlus' || 
                             userData?.subscriptionType === 'selfAdvocateDating';

  if (!canManageSupporters) {
    return (
      <View 
        style={styles.container}
        accessible={true}
        accessibilityRole="text"
      >
        <Text style={styles.subscriptionMessage}>
          Upgrade to Self Advocate Plus or Dating to add supporters! 💝
        </Text>
        <TouchableOpacity 
          style={styles.upgradeButton}
          onPress={() => navigation.navigate('Subscription')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Upgrade subscription to add supporters"
          accessibilityHint="Navigates to subscription management screen"
        >
          <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={[styles.container, Platform.OS === 'web' && styles.webContainer]}
      contentContainerStyle={styles.listContainer}
      ListHeaderComponent={() => (
        <View style={styles.content}>
          <Text 
            style={styles.title}
            accessible={true}
            accessibilityRole="text"
          >
            Manage Your Supporters
          </Text>

          <Text 
            style={styles.body}
            accessible={true}
            accessibilityRole="text"
          >
            Your supporters will be able to view your chats. They will not be able to write, edit, or delete your messages. 
          </Text>
          <Text 
            style={styles.body}
            accessible={true}
            accessibilityRole="text"
          >
           You can remove a supporter at any time by tapping on the red remove button on the right side of the supporter card.
          </Text>
          <Text 
            style={styles.body}
            accessible={true}
            accessibilityRole="text"
          >
            Supporters can be anyone on a paid plan.
          </Text>

          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => navigation.navigate('AddSupporter')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Add new supporter"
            accessibilityHint="Opens screen to add a new supporter"
          >
            <Text style={styles.addButtonText}>Add New Supporter +</Text>
          </TouchableOpacity>

          <Text 
            style={styles.sectionTitle}
            accessible={true}
            accessibilityRole="text"
          >
            Your Current Supporters
          </Text>
        </View>
      )}
      data={userData?.supporters || []}
      renderItem={({ item: supporter }) => (
        <View 
          style={styles.supporterCard}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`Supporter: ${supporter.username || supporter.name || 'Unknown'}. ${supporter.state ? `From ${supporter.state}.` : ''} `}
        >
          <View style={styles.supporterInfo}>
            <Image 
              source={
                supporter.profilePicture 
                  ? { uri: supporter.profilePicture }
                  : require('../../assets/default-avatar.png')
              }
              style={styles.profilePicture}
              accessibilityRole="image"
              accessibilityLabel={`${supporter.username || supporter.name || 'Unknown'}'s profile picture`}
            />
            <View style={styles.textContainer}>
              <Text style={styles.supporterName}>
                {supporter.username || supporter.name || 'Unknown'}
              </Text>
              {supporter.state && (
                <Text style={styles.supporterLocation}>
                  📍 {supporter.state}
                </Text>
              )}
              <Text style={styles.supporterEmail}>{supporter.email}</Text>
            </View>
            {Platform.OS === 'web' ? (
              <div
                onClick={() => {
                  Alert.alert(
                    'Remove Supporter',
                    `Are you sure you want to remove ${supporter.username || supporter.name}?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => handleRemoveSupporter(supporter)
                      }
                    ]
                  );
                }}
                style={{
                  backgroundColor: '#ff4444',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  marginLeft: '8px',
                  cursor: 'pointer',
                }}
                role="button"
                aria-label={`Remove ${supporter.username || supporter.name || 'Unknown'}`}
              >
                <span style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>
                  Remove
                </span>
              </div>
            ) : (
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => {
                  Alert.alert(
                    'Remove Supporter',
                    `Are you sure you want to remove ${supporter.username || supporter.name}?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => handleRemoveSupporter(supporter)
                      }
                    ]
                  );
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${supporter.username || supporter.name || 'Unknown'}`}
                accessibilityHint="Double tap to remove this supporter"
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      ListEmptyComponent={
        <Text 
          style={styles.noSupportersText}
          accessible={true}
          accessibilityRole="text"
        >
          You haven't added any supporters yet.
        </Text>
      }
      keyExtractor={(item, index) => item.id || index.toString()}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    color: '#000000',
  },
  subscriptionMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 20,
    marginTop: 40,
    color: '#666',
  },
  upgradeButton: {
    backgroundColor: '#24269B',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 40,
    marginTop: 20,
  },
  upgradeButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#24269B',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  supportersList: {
    marginTop: 20,
  },
  supporterCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#000000',
  },
  supporterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  supporterName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  supporterLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  supporterEmail: {
    fontSize: 14,
    color: '#666',
  },
  removeButton: {
    backgroundColor: '#ff4444',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 8,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  noSupportersText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    fontSize: 16,
    padding: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  webContainer: {
    // Add any specific styles for web if needed
  },
});

export default SupporterManagementScreen; 