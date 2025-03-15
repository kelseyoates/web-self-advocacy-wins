import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  AccessibilityInfo,
  Image,
  Text,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback
} from 'react-native';
import { collection, query, orderBy, limit, getDocs, getDoc, doc } from 'firebase/firestore';
import WinCard from '../components/WinCard';
import { useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../config/firebase';
import { useAccessibility } from '../context/AccessibilityContext';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const MainScreen = ({ navigation }) => {
  const { showHelpers } = useAccessibility();
  const [wins, setWins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [userData, setUserData] = useState(null);

  const scale = useRef(new Animated.Value(1)).current;
  const clapScale = useRef(new Animated.Value(1)).current;
  const commentScale = useRef(new Animated.Value(1)).current;

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

  const fetchWins = async () => {
    try {
      announceToScreenReader('Fetching recent wins');
      const winsQuery = query(
        collection(db, 'wins'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      const querySnapshot = await getDocs(winsQuery);
      const winsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setWins(winsData);
      announceToScreenReader(`Loaded ${winsData.length} wins`);
    } catch (error) {
      console.error('Error fetching wins:', error);
      announceToScreenReader('Failed to load wins');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWins();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    announceToScreenReader('Refreshing wins');
    fetchWins();
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchWins();
    }, [])
  );

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        if (auth.currentUser) {
          const userDocRef = doc(db, 'users', auth.currentUser.uid.toLowerCase());
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUserData(data);
            setProfilePicture(data.profilePicture);
            console.log('Fetched profile picture:', data.profilePicture); // Debug log
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
          style={styles.menuButton}
          onPress={() => navigation.navigate('Settings')}
          accessible={true}
          accessibilityLabel="Open menu"
          accessibilityHint="Navigate to settings and additional options"
        >
          <Image
            source={require('../../assets/bottom-nav-images/menu-inactive.png')}
            style={styles.menuIcon}
          />
          <Text style={styles.menuText}>Menu</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    const pulseAnimation = () => {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(clapScale, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(clapScale, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(commentScale, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(commentScale, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => pulseAnimation()); // This makes both loop
    };

    pulseAnimation();

    return () => {
      // Cleanup animations when component unmounts
      clapScale.setValue(1);
      commentScale.setValue(1);
    };
  }, []);

  useEffect(() => {
    console.log('Loading state:', loading);
  }, [loading]);

  if (loading) {
    return (
      <View 
        style={styles.loadingContainer}
        accessible={true}
        accessibilityRole="alert"
        accessibilityLabel="Loading your wins feed. Please wait."
      >
        <ActivityIndicator size="large" color="#24269B" />
        <Text style={styles.loadingText} accessibilityRole="text">Loading...</Text>
      </View>
    );
  }

  // Update the ArrowAnimation component
  const ArrowAnimation = () => {
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      const animate = () => {
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: 10,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]).start(() => animate());
      };

      animate();
    }, []);

    return (
      <View style={styles.arrowContainer}>
        <Animated.Text 
          style={[
            styles.arrow,
            {
              transform: [{ translateY }],
            },
          ]}
          accessible={true}
          accessibilityLabel="Scroll down indicator"
        >
          ⬇️
        </Animated.Text>
      </View>
    );
  };
  

  const ListHeader = () => (
    <>
      <View 
        accessible={true}
        accessibilityRole="header"
        accessibilityLabel="Welcome to Self-Advocacy Wins"
      >
        <View style={styles.headerContent}>
          <Image
            source={require('../../assets/wins.png')}
            style={styles.headerImage}
            accessible={true}
            accessibilityLabel="Three self-advocates holding a trophy, a flag, and a medal"
          />
          <Text style={styles.headerText} accessibilityRole="header">Welcome to Self-Advocacy Wins!</Text>
          <Text style={styles.bodyText}>You are now on the Home feed. This is where you can see what your friends have posted.</Text>
        </View>
      </View>

      <View 
        style={styles.headerWide}
        accessible={true}
        accessibilityRole="header"
        accessibilityLabel="About the Home Feed"
      >
        <Text style={styles.headerText}>About the Home Feed:</Text>
        <Text style={styles.bodyText}>This is a win card. You can see who posted the win, when they posted it, and what they posted.</Text>
        <Image
          source={require('../../assets/win-example.png')}
          style={styles.headerImage}
          accessible={true}
          accessibilityLabel="An example of a win card. The user's name and profile picture are on the top left of the card, and the win is displayed in the middle. The cheers emoji, new comment icon, and share icon at in a row at the bottom of the card."
        />
      </View>

      <View style={styles.headerWide}>
        <Text style={styles.headerText}>About the Home Feed:</Text>
        <Text style={styles.bodyText}>This is a win card. You can see who posted the win, when they posted it, and what they posted.</Text>
        <Image
          source={require('../../assets/win-example.png')}
          style={styles.headerImage}
          accessible={true}
          accessibilityLabel="An example of a win card. The user's name and profile picture are on the top left of the card, and the win is displayed in the middle. The cheers emoji, new comment icon, and share icon at in a row at the bottom of the card."
        />
      </View>

      <View style={styles.headerWide}>
        <Text style={styles.bodyTextBold}>Cheer, Comment, and Share:</Text>
        <View style={styles.headerIconContainer}>
          <TouchableWithoutFeedback onPress={animatePress}>
            <Animated.Image 
              source={require('../../assets/cheers.png')} 
              style={[
                styles.headerIcon,
                {
                  transform: [{ scale: clapScale }]
                }
              ]}
              accessible={true}
              accessibilityLabel="the clapping hands emoji"
            />
          </TouchableWithoutFeedback>
        </View>
        <Text style={styles.bodyText}>tap the clapping emoji to cheer people on</Text>

        <View style={styles.headerIconContainer}>
          <TouchableWithoutFeedback onPress={animatePress}>
            <Animated.Image 
              source={require('../../assets/new-comment.png')} 
              style={[
                styles.headerIcon,
                {
                  transform: [{ scale: clapScale }]
                }
              ]}
              accessible={true}
              accessibilityLabel="a new comment icon"
            />
          </TouchableWithoutFeedback>
         
          <Text style={styles.bodyText}>tap the comment icon to leave a positive comment</Text>
          
        </View> 

        <View style={styles.headerIconContainer}>
          <TouchableWithoutFeedback onPress={animatePress}>
            <Animated.Image 
              source={require('../../assets/arrow-share.png')} 
              style={[
                styles.headerIcon,
                {
                  transform: [{ scale: clapScale }]
                }
              ]}
              accessible={true}
              accessibilityLabel="a sharing arrow icon"
            />
          </TouchableWithoutFeedback>
         
          <Text style={styles.bodyText}>tap the share icon to share a win</Text>
        </View> 

      </View>     

      <View style={styles.headerWide}>
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>Top Navigation:</Text>
          <Text style={styles.bodyText}>If you look at the top right corner of the screen, you will see a menu icon. Tap it to go to the menu screen.</Text>
        </View>  
        <Image
          source={require('../../assets/bottom-nav-images/menu-inactive.png')}
          style={styles.bodyImage}
          accessible={true}
          accessibilityLabel="the image in the tab navigator, a house, a chat box, a plus sign, a magnifying glass, and a menu icon"
        />
      </View>

      <View style={styles.headerWide}>
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>Bottom Navigation:</Text>
          <Text style={styles.bodyText}>If you look at the bottom of the screen, you will see five buttons: Home, Chat, New Win, Find, and Profile.</Text>
        </View>  
        <Image
          source={require('../../assets/tab-navigator-example.png')}
          style={styles.bodyImage}
          accessible={true}
          accessibilityLabel="the image in the tab navigator, a house, a chat box, a plus sign, a magnifying glass, and a menu icon"
        />
        <Text style={styles.bodyText}>Tap each button to go to a different screen.</Text>
      </View>

      <View style={styles.headerWide}>
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>Your Profile:</Text>
          <Text style={styles.bodyText}>In the bottom right corner of the screen, you will see a profile icon. Tap it to go to your profile page. You can answer questions about yourself, and upload a profile picture.</Text>
        </View>  
        <Image
          source={require('../../assets/profile-example.png')}
          style={styles.bodyImage}
          accessible={true}
          accessibilityLabel="the image in the tab navigator, a house, a chat box, a plus sign, a magnifying glass, and a menu icon"
        />
      </View>
    
    <View style={styles.headerWide}>
      <Text style={styles.headerText}>Are you ready to start exploring?</Text>
      <Text style={styles.bodyText}> When you see this icon <MaterialCommunityIcons 
                name="information" 
                size={24} 
                color="#24269B"
                style={styles.infoIcon}
                accessible={true}
                accessibilityLabel="Helper information"
              /> you'll know that you're looking at helper text. You can turn off the helper text by going to the accessibility screen in the menu.</Text>
         
      <Text style={styles.bodyText}>Scroll down to see your friends' wins and have some fun!</Text>

      <ArrowAnimation />
    </View>

    
    </>
  );

  return (
    <FlatList
      style={styles.container}
      accessible={false}
      ListHeaderComponent={() => (
        <View>
          {showHelpers && (
            <>
              <View 
                style={styles.headerContent}
                accessible={true}
                accessibilityRole="header"
                accessibilityLabel={`Welcome to Self-Advocacy Wins. You are now on the Home feed. This is where you can see what your friends have posted. The image shows three self-advocates holding a trophy, a flag, and a medal.`}
              >
                <Image
                  source={require('../../assets/wins.png')}
                  style={styles.headerImage}
                  importantForAccessibility="no"
                />
                <Text style={styles.headerText}>Welcome to Self-Advocacy Wins!</Text>
                <Text style={styles.bodyText}>You are now on the Home feed. This is where you can see what your friends have posted.</Text>
              </View>

              <View 
                style={styles.headerWide}
                accessible={true}
                accessibilityRole="header"
                accessibilityLabel={`About the Home Feed. This is a win card. You can see who posted the win, when they posted it, and what they posted. The image shows an example of a win card with the user's name and profile picture on the top left, the win content in the middle, and interaction buttons at the bottom.`}
              >
                <Text style={styles.headerText}>About the Home Feed:</Text>
                <Text style={styles.bodyText}>This is a win card. You can see who posted the win, when they posted it, and what they posted.</Text>
                <Image
                  source={require('../../assets/win-example.png')}
                  style={styles.headerImage}
                  importantForAccessibility="no"
                />
              </View>

              <View 
                style={styles.headerWide}
                accessible={true}
                accessibilityRole="header"
                accessibilityLabel={`Cheer, Comment, and Share features. Tap the clapping emoji to cheer people on. Tap the comment icon to leave a positive comment. Tap the share icon to share a win.`}
              >
                <Text style={styles.bodyTextBold}>Cheer, Comment, and Share:</Text>
                <View style={styles.headerIconContainer}>
                  <Image 
                    source={require('../../assets/cheers.png')} 
                    style={styles.headerIcon}
                    importantForAccessibility="no"
                  />
                  <Text style={styles.bodyText}>tap the clapping emoji to cheer people on</Text>
                </View>

                <View style={styles.headerIconContainer}>
                  <Image 
                    source={require('../../assets/new-comment.png')} 
                    style={styles.headerIcon}
                    importantForAccessibility="no"
                  />
                  <Text style={styles.bodyText}>tap the comment icon to leave a positive comment</Text>
                </View>

                <View style={styles.headerIconContainer}>
                  <Image 
                    source={require('../../assets/arrow-share.png')} 
                    style={styles.headerIcon}
                    importantForAccessibility="no"
                  />
                  <Text style={styles.bodyText}>tap the share icon to share a win</Text>
                </View>
              </View>

              <View 
                style={styles.headerWide}
                accessible={true}
                accessibilityRole="header"
                accessibilityLabel={`Navigation instructions. Look at the bottom of the screen to find five buttons: Home, Chat, New Win, Find, and Profile. Tap each button to go to a different screen.`}
              >
                <Text style={styles.headerText}>Navigation:</Text>
                <Text style={styles.bodyText}>Look at the bottom of the screen to find five buttons: Home, Chat, New Win, Find, and Profile.</Text>
                <Image
                  source={require('../../assets/tab-navigator-example.png')}
                  style={styles.bodyImage}
                  importantForAccessibility="no"
                />
                <Text style={styles.bodyText}>Tap each button to go to a different screen.</Text>
              </View>

              <View 
                style={styles.headerWide}
                accessible={true}
                accessibilityRole="header"
                accessibilityLabel={`Ready to explore. When you see the information icon, you'll know that you're looking at helper text. You can turn off the helper text by going to the accessibility screen in the menu. Scroll down to see your friends' wins and have some fun!`}
              >
                <Text style={styles.headerText}>Are you ready to start exploring?</Text>
                <Text style={styles.bodyText}>
                  When you see the information icon, you'll know that you're looking at helper text. 
                  You can turn off the helper text by going to the accessibility screen in the menu.
                </Text>
                <Text style={styles.bodyText}>Scroll down to see your friends' wins and have some fun!</Text>
                <ArrowAnimation />
              </View>
            </>
          )}
        </View>
      )}
      data={wins}
      renderItem={({ item }) => (
        <View 
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Win posted by ${item.userName || 'Unknown user'}. ${item.content || ''}`}
          accessibilityHint="Double tap to view win details"
        >
          <WinCard win={item} />
        </View>
      )}
      keyExtractor={item => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#24269B']}
          accessible={true}
          accessibilityLabel={refreshing ? 'Refreshing wins' : 'Pull to refresh'}
          accessibilityHint="Pull down to refresh the list of wins"
          accessibilityRole="adjustable"
        />
      }
      contentContainerStyle={styles.listContent}
    />
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
  listContent: {
    paddingVertical: 10,
  },
  menuButton: {
    alignItems: 'center',
    marginRight: 15,
    maxWidth: 80,
  },
  menuIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  menuText: {
    fontSize: 12,
    color: '#24269B',
    marginTop: 2,
    flexWrap: 'wrap',
    textAlign: 'center',
  },
  sectionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#24269B',
    flex: 1,
  },
  sectionContainer: {
    padding: 20,
  },
  sectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionImage: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginRight: 12,
  },
  arrowContainer: {
    alignItems: 'center',
    height: 100,
    width: '100%',
    marginVertical: 20,
  },
  arrow: {
    fontSize: 50,
    color: '#24269B',
  },
  headerContainer: {
    padding: 20,
  },
  headerContent: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  headerRow: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
  },
  headerSmallContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: '#24269B',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 5,
    marginVertical: 5,
  },
  headerIconContainer: {
    alignItems: 'center',
    marginBottom: 5,
  },
  headerTextContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  headerImage: {
    width: 300,
    height: 200,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  headerText: {
    fontSize: 22,
    color: '#24269B',
    textAlign: 'center',
    fontWeight: 'bold',
    flexWrap: 'wrap',
    paddingHorizontal: 5,
  },
  headerIcon: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
    marginTop: 10,
  },
  headerWide: {
    alignItems: 'center',
    marginTop: 22,
    backgroundColor: '#ffffff',
    paddingHorizontal: 5, // Reduced from 10
    paddingVertical: 5, // Added to control vertical spacing
  },
  bodyText: {
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    paddingHorizontal: 5,
  },
  headerTextBold: {
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
    fontWeight: 'bold',
    flexWrap: 'wrap',
    paddingHorizontal: 5,
  },
  bodyTextBold: {
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
    fontWeight: 'bold',
    flexWrap: 'wrap',
    paddingHorizontal: 5,
  },
  bodyImage: {
    width: 300,
    resizeMode: 'contain',
  },
  helperHeader: {
    width: '100%',
    alignItems: 'flex-end',
    paddingRight: 10,
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
    marginVertical: 5,
    flexWrap: 'wrap',
    textAlign: 'center',
    paddingHorizontal: 5,
  },
  helperText: {
    fontSize: 16,
    marginVertical: 2,
    flexWrap: 'wrap',
    paddingHorizontal: 5,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'flex-start',
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  conversationName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
    flexWrap: 'wrap',
    paddingRight: 5,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    flexWrap: 'wrap',
    paddingRight: 5,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 10,
    flexWrap: 'wrap',
    paddingHorizontal: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#24269B',
    textAlign: 'center',
  },
});

export default MainScreen;