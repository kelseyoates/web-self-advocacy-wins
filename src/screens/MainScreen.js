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
  TouchableWithoutFeedback,
  Platform,
  ScrollView
} from 'react-native';
import { collection, query, orderBy, limit, getDocs, getDoc, doc } from 'firebase/firestore';
import WinCard from '../components/WinCard';
import { useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../config/firebase';
import { useAccessibility } from '../context/AccessibilityContext';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const isWeb = Platform.OS === 'web';

const MainScreen = ({ navigation }) => {
  const { showHelpers } = useAccessibility();
  const [wins, setWins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [userData, setUserData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const scale = useRef(new Animated.Value(1)).current;
  const clapScale = useRef(new Animated.Value(1)).current;
  const commentScale = useRef(new Animated.Value(1)).current;

  // Add screen reader detection with web support
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

  const announceToScreenReader = (message) => {
    if (isScreenReaderEnabled && !isWeb) {
      AccessibilityInfo.announceForAccessibility(message);
    } else if (isWeb) {
      // For web, we can use ARIA live regions which are handled in the JSX
      setErrorMsg(message);
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
      setErrorMsg('Failed to load wins. Please try again.');
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
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setErrorMsg('Failed to load user profile');
      }
    };

    fetchUserProfile();
  }, []);

  // Set up header with profile button - web optimized
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          style={[styles.menuButton, isWeb && styles.webMenuButton]}
          onPress={() => navigation.navigate('Settings')}
          accessible={true}
          accessibilityLabel="Open menu"
          accessibilityHint={isWeb ? "Click to open settings menu" : "Navigate to settings and additional options"}
          accessibilityRole="button"
        >
          <Image
            source={require('../../assets/bottom-nav-images/menu-inactive.png')}
            style={[styles.menuIcon, isWeb && styles.webMenuIcon]}
          />
          <Text style={[styles.menuText, isWeb && styles.webMenuText]}>Menu</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Web-optimized animations
  const animatePress = () => {
    if (isWeb) {
      // For web, we'll use CSS transitions instead of Animated
      return;
    }
    
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
    if (isWeb) {
      // Don't run animations on web
      return;
    }

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
      ]).start(() => pulseAnimation());
    };

    pulseAnimation();

    return () => {
      clapScale.setValue(1);
      commentScale.setValue(1);
    };
  }, []);

  const renderHelperSection = () => (
    <View style={[styles.headerContent, isWeb && styles.webHeaderContent]}>
      <Image 
        source={require('../../assets/wins.png')} 
        style={[styles.headerImage, isWeb && styles.webHeaderImage]}
        resizeMode="contain"
        accessible={true}
        accessibilityLabel="Three self-advocates holding a trophy, a flag, and a medal"
      />
      <View style={styles.textContainer}>
        <Text style={[styles.headerText, isWeb && styles.webHeaderText]}>
          Welcome to Self-Advocacy Wins!
        </Text>
        <Text style={[styles.bodyText, isWeb && styles.webBodyText]}>
          You are now on the Home feed. This is where you can see what your friends have posted.
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View 
        style={[styles.loadingContainer, isWeb && styles.webLoadingContainer]}
        accessible={true}
        accessibilityRole="alert"
        accessibilityLabel="Loading your wins feed. Please wait."
      >
        <ActivityIndicator size="large" color="#24269B" />
        <Text style={styles.loadingText} accessibilityRole="text">Loading...</Text>
      </View>
    );
  }

  // Web-optimized arrow animation
  const ArrowAnimation = () => {
    if (isWeb) {
      return (
        <div 
          className="arrow-bounce"
          style={{
            textAlign: 'center',
            fontSize: '50px',
            animation: 'bounce 2s infinite'
          }}
          role="img"
          aria-label="Scroll down indicator"
        >
          ⬇️
        </div>
      );
    }

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

  const renderContent = () => {
    const content = (
      <>
        {errorMsg ? (
          <View 
            style={styles.errorContainer} 
            accessibilityLiveRegion="polite"
            accessible={true}
            accessibilityLabel={`Error: ${errorMsg}`}
          >
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}
        
        {showHelpers && renderHelperSection()}

        {wins.map(win => (
          <View 
            key={win.id}
            style={[styles.winCardContainer, isWeb && styles.webWinCardContainer]}
            accessible={true}
            accessibilityRole="article"
            accessibilityLabel={`Win posted by ${win.userName || 'Unknown user'}. ${win.content || ''}`}
          >
            <WinCard win={win} />
          </View>
        ))}

        {wins.length === 0 && !loading && (
          <View style={[styles.emptyContainer, isWeb && styles.webEmptyContainer]}>
            <Text style={styles.emptyText}>No wins yet. Be the first to share!</Text>
          </View>
        )}
      </>
    );

    if (isWeb) {
      return (
        <ScrollView 
          style={[styles.container, styles.webContainer]}
          contentContainerStyle={styles.webContentContainer}
        >
          {content}
        </ScrollView>
      );
    }

    return (
      <FlatList
        style={styles.container}
        data={wins}
        renderItem={({ item }) => (
          <View 
            accessible={true}
            accessibilityRole="article"
            accessibilityLabel={`Win posted by ${item.userName || 'Unknown user'}. ${item.content || ''}`}
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
        ListHeaderComponent={() => showHelpers && renderHelperSection()}
        contentContainerStyle={styles.listContent}
      />
    );
  };

  return (
    <View style={[styles.container, isWeb && styles.webContainer]}>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  webContainer: {
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
    padding: 20,
  },
  webContentContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webLoadingContainer: {
    minHeight: '100vh',
  },
  listContent: {
    paddingVertical: 10,
  },
  menuButton: {
    alignItems: 'center',
    marginRight: 15,
    maxWidth: 80,
  },
  webMenuButton: {
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
    ':hover': {
      opacity: 0.8,
    },
  },
  menuIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  webMenuIcon: {
    width: 28,
    height: 28,
  },
  menuText: {
    fontSize: 12,
    color: '#24269B',
    marginTop: 2,
    flexWrap: 'wrap',
    textAlign: 'center',
  },
  webMenuText: {
    fontSize: 14,
  },
  textContainer: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  headerContent: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
    marginBottom: 20,
    borderRadius: 8,
    width: '100%',
  },
  webHeaderContent: {
    maxWidth: 800,
    marginHorizontal: 'auto',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  headerImage: {
    width: '100%',
    maxWidth: 300,
    height: 200,
    resizeMode: 'contain',
    marginBottom: 24,
  },
  webHeaderImage: {
    maxWidth: 400,
    height: 250,
    objectFit: 'contain',
  },
  headerText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#24269B',
    marginBottom: 20,
    textAlign: 'center',
    width: '100%',
    display: 'block',
  },
  webHeaderText: {
    fontSize: 28,
    lineHeight: 1.4,
  },
  bodyText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginTop: 10,
    width: '100%',
    display: 'block',
  },
  webBodyText: {
    fontSize: 18,
    lineHeight: 1.6,
  },
  winCardContainer: {
    marginBottom: 10,
  },
  webWinCardContainer: {
    maxWidth: 800,
    marginHorizontal: 'auto',
    transition: 'transform 0.2s ease',
    ':hover': {
      transform: 'translateY(-2px)',
    },
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  webEmptyContainer: {
    maxWidth: 600,
    marginHorizontal: 'auto',
    backgroundColor: '#fff',
    borderRadius: 8,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
    maxWidth: 800,
    marginHorizontal: 'auto',
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
    fontSize: 16,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#24269B',
    textAlign: 'center',
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
});

export default MainScreen;