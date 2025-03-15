import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  FlatList
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAccessibility } from '../context/AccessibilityContext';

const SupporterDashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [supportedUsers, setSupportedUsers] = useState([]);
  const [userSubscription, setUserSubscription] = useState(null);
  const { showHelpers } = useAccessibility();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // First, fetch the user's subscription
      const userDoc = await getDoc(doc(db, 'users', user.uid.toLowerCase()));
      if (!userDoc.exists()) {
        console.error('User document not found');
        return;
      }
      
      const userData = userDoc.data();
      const subscription = userData.subscriptionType;
      console.log('Fetched subscription type:', subscription);
      setUserSubscription(subscription);

      // Then fetch supported users
      const usersRef = collection(db, 'users');
      const allUsersSnapshot = await getDocs(usersRef);
      
      let supportedUsersData = [];
      allUsersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.supporters?.some(supporter => 
          supporter.id.toLowerCase() === user.uid.toLowerCase()
        )) {
          supportedUsersData.push({
            id: doc.id,
            username: data.username || 'Anonymous',
            profilePicture: data.profilePicture || null,
            unreadMessages: data.unreadMessages || 0,
          });
        }
      });

      const maxSupported = {
        'supporter1': 1,
        'supporter3': 3,
        'supporter5': 5,
        'supporter10': 10,
        'supporter25': 25,
        null: 0,
        undefined: 0
      };

      const limit = maxSupported[subscription] || 0;
      console.log('Subscription:', subscription);
      console.log('Supported users count:', supportedUsersData.length);
      console.log('Limit for subscription:', limit);

      if (supportedUsersData.length > limit) {
        Alert.alert(
          'Subscription Limit Reached',
          `Your current subscription (${subscription}) allows you to support up to ${limit} ${limit === 1 ? 'person' : 'people'}. Please upgrade your subscription to support more users.`
        );
      }

      setSupportedUsers(supportedUsersData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load supporter data');
    } finally {
      setLoading(false);
    }
  };

  const handleSupportedUserPress = (supportedUser) => {
    const cometChatUser = {
      uid: supportedUser.id.toLowerCase(),
      username: supportedUser.username,
    };
    
    navigation.navigate('SupportedUserChat', {
      supportedUser: cometChatUser
    });
  };

  const handleRemoveSupported = async (supportedUser) => {
    Alert.alert(
      'Remove Supported User',
      `Are you sure you want to stop supporting ${supportedUser.username}? They can add you back as a supporter later if needed.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const userRef = doc(db, 'users', supportedUser.id.toLowerCase());
              const userDoc = await getDoc(userRef);
              
              if (userDoc.exists()) {
                const userData = userDoc.data();
                const updatedSupporters = userData.supporters.filter(
                  supporter => supporter.id.toLowerCase() !== user.uid.toLowerCase()
                );
                
                await updateDoc(userRef, {
                  supporters: updatedSupporters
                });
                
                // Refresh the supported users list
                loadData();
                
                Alert.alert(
                  'Success',
                  'You are no longer supporting this user.'
                );
              }
            } catch (error) {
              console.error('Error removing supported user:', error);
              Alert.alert('Error', 'Failed to remove supported user');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator 
          size="large" 
          color="#24269B" 
          accessibilityLabel="Loading"
        />
        <Text 
          style={styles.loadingText}
          accessible={true}
          accessibilityRole="text"
        >
          Loading supported users...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={supportedUsers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.flatListContent}
        scrollEnabled={true}
        accessible={false}
        ListHeaderComponent={
          <>
            {showHelpers && (
              <View 
                style={styles.helperSection}
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel="Helper Information: Being a Supporter. A user must add you as a supporter before you can view their chats. Once you are a supporter, you can view that user's chats. These chats are read-only and you will not be able to send, edit, or delete messages. If you see concerning behavior, have the user block and report. Email safety concerns to kelsey.oates@selfadvocacywins.com"
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
                    source={require('../../assets/read-only-chats.png')}
                    style={styles.helperImage}
                    importantForAccessibility="no"
                  />
                  <Text style={styles.helperTitle} importantForAccessibility="no">Being a Supporter!</Text>
                  <View style={styles.helperTextContainer} importantForAccessibility="no">
                    <Text style={styles.helperText}>
                      • A user must add you as a supporter before you can view their chats.
                    </Text>
                    <Text style={styles.helperText}>
                      • Once you are a supporter, you can view that user's chats
                    </Text>
                    <Text style={styles.helperText}>
                      • These chats are read-only and you will not be able to send, edit, or delete messages.
                    </Text>
                    <Text style={styles.helperText}>
                      • If you see concerning behavior, have the user block and report
                    </Text>
                    <Text style={styles.helperText}>
                      • Email safety concerns to:
                    </Text>
                    <Text style={styles.helperEmail}>
                      kelsey.oates@selfadvocacywins.com
                    </Text>
                  </View> 
                </View>
              </View>
            )}
            <Text 
              style={styles.title} 
              accessible={true}
              accessibilityRole="header"
            >
              You are supporting:
            </Text>
          </>
        }
        renderItem={({ item }) => (
          <View 
            key={item.id} 
            style={styles.userCard}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`${item.username}. Double tap to view options.`}
          >
            <View style={styles.mainRow}>
              <Image 
                source={item.profilePicture 
                  ? { uri: item.profilePicture }
                  : require('../../assets/default-avatar.png')}
                style={styles.userAvatar}
                importantForAccessibility="no"
              />
              <View style={styles.userInfo}>
                <Text style={styles.username} importantForAccessibility="no">{item.username}</Text>
                <TouchableOpacity 
                  style={styles.viewChatsContainer}
                  onPress={() => handleSupportedUserPress(item)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`View chats with ${item.username}`}
                  accessibilityHint="Double tap to view chat history"
                >
                  <Text style={styles.viewChatsText}>View Chats</Text>
                  <MaterialCommunityIcons 
                    name="arrow-right" 
                    size={20} 
                    color="#24269B"
                    importantForAccessibility="no"
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.removeContainer}
              onPress={() => handleRemoveSupported(item)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Stop being a supporter for ${item.username}`}
              accessibilityHint="Double tap to remove this user from your supported list"
            >
              <MaterialCommunityIcons 
                name="close-circle" 
                size={20} 
                color="#ff4444"
                importantForAccessibility="no"
              />
              <Text style={styles.removeText}>Stop being their supporter</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View 
            style={styles.emptyStateContainer}
            accessible={true}
            accessibilityRole="text"
          >
            <Text style={styles.emptyStateText}>
              You are not supporting anyone yet. They can add you in their app.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#24269B',
    marginTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#24269B',
    padding: 20,
  },
  userCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mainRow: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  viewChatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewChatsText: {
    color: '#24269B',
    fontSize: 14,
    marginRight: 4,
    fontWeight: '500',
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
  helperEmail: {
    fontSize: 16,
    color: '#24269B',
    marginBottom: 8,
    lineHeight: 22,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    justifyContent: 'center',
  },
  removeText: {
    color: '#ff4444',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyStateContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  flatListContent: {
    paddingBottom: 20,
  },
});

export default SupporterDashboardScreen; 