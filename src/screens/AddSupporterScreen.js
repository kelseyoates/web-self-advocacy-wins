import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  Alert,
  AccessibilityInfo,
  Image,
  Platform,
  Pressable,
  useWindowDimensions,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView
} from 'react-native';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { auth, db} from '../config/firebase';

const AddSupporterScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isMobile = width < 768;
  const searchInputRef = useRef(null);
  const scrollViewRef = useRef(null);
  
  // States for web-specific features
  const [hoverStates, setHoverStates] = useState({
    searchButton: false,
    backButton: false
  });
  const [focused, setFocused] = useState({
    searchInput: false
  });

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

  // Focus search input on web
  useEffect(() => {
    if (isWeb && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current.focus();
      }, 300);
    }
  }, [isWeb]);

  // Add keyboard event listener for web
  useEffect(() => {
    if (isWeb) {
      const handleKeyDown = (e) => {
        // Enter key to search
        if (e.key === 'Enter' && document.activeElement === searchInputRef.current) {
          e.preventDefault();
          handleSearch();
        }
        
        // Escape key to clear search
        if (e.key === 'Escape') {
          setSearchQuery('');
          setSearchResults([]);
          searchInputRef.current?.focus();
        }
        
        // Ctrl+B to go back
        if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          navigation.goBack();
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isWeb, searchQuery, navigation]);

  // Helper function for screen reader announcements
  const announceToScreenReader = useCallback((message) => {
    if (isScreenReaderEnabled) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [isScreenReaderEnabled]);

  // Handle search with debounce for web
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      if (isWeb) {
        announceToScreenReader('Please enter a username to search');
        setSearchResults([]);
      } else {
        Alert.alert('Please enter a username to search');
        announceToScreenReader('Please enter a username to search');
      }
      return;
    }

    setLoading(true);
    announceToScreenReader('Searching for supporters');
    
    try {
      const usersRef = collection(db, 'users');
      const lowercaseQuery = searchQuery.toLowerCase();
      
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
      announceToScreenReader(`Found ${results.length} users`);
      
      if (results.length === 0) {
        announceToScreenReader('No users found with that username');
      } else if (isWeb) {
        // Scroll to results on web
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 250, animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Search error:', error);
      announceToScreenReader('Error searching for users');
      if (isWeb) {
        setSearchResults([]);
      } else {
        Alert.alert('Error', 'Failed to search for users');
      }
    }
    setLoading(false);
  }, [searchQuery, announceToScreenReader, isWeb]);

  const handleAddSupporter = useCallback(async (userToSupport) => {
    try {
      setLoading(true);
      announceToScreenReader('Adding supporter...');

      const supporterDoc = await getDoc(doc(db, 'users', userToSupport.id.toLowerCase()));
      const supporterData = supporterDoc.data();
      const subscriptionType = supporterData.subscriptionType;

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

      if (currentSupportCount >= supporterLimit) {
        setLoading(false);
        announceToScreenReader('Supporter limit reached');
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

      // Update UI state
      setSearchResults(prevResults => 
        prevResults.map(result => 
          result.id === userToSupport.id 
            ? { 
                ...result, 
                currentSupportCount: result.currentSupportCount + 1,
                isAvailable: (result.currentSupportCount + 1) < result.supporterLimit
              }
            : result
        )
      );

      announceToScreenReader('Supporter added successfully');
      
      if (isWeb) {
        // For web, show the alert but don't navigate away immediately
        Alert.alert(
          'Success',
          'Supporter added successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                setSearchQuery(''); // Clear the search
                setSearchResults([]); // Clear results
                navigation.goBack(); // Navigate back
              }
            }
          ]
        );
      } else {
        // For mobile, navigate back immediately
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
      }

    } catch (error) {
      console.error('Error adding supporter:', error);
      announceToScreenReader('Error adding supporter');
      Alert.alert('Error', 'Failed to add supporter');
    } finally {
      setLoading(false);
    }
  }, [announceToScreenReader, isWeb, navigation]);

  // Handle back button
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Apply styles based on platform and screen size
  const containerStyle = [
    styles.container,
    isWeb && styles.webContainer,
    isWeb && !isMobile && styles.webContainerDesktop
  ];
  
  const contentWrapperStyle = [
    styles.contentWrapper,
    isWeb && styles.webContentWrapper
  ];
  
  const pageTitleStyle = [
    styles.pageTitle,
    isWeb && styles.webPageTitle
  ];
  
  const cardStyle = [
    styles.card,
    isWeb && styles.webCard
  ];

  const searchButtonStyle = [
    styles.searchButton,
    loading && styles.searchButtonDisabled,
    isWeb && styles.webSearchButton,
    isWeb && hoverStates.searchButton && !loading && styles.webSearchButtonHover,
    loading && isWeb && styles.webSearchButtonDisabled
  ];

  const searchInputStyle = [
    styles.searchInput, 
    isWeb && styles.webSearchInput,
    isWeb && focused.searchInput && styles.webSearchInputFocused
  ];

  const backButtonStyle = [
    styles.backButton,
    isWeb && styles.webBackButton,
    isWeb && hoverStates.backButton && styles.webBackButtonHover
  ];

  const renderResultItem = ({ item }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    const resultCardStyle = [
      styles.resultCard,
      !item.isAvailable && styles.resultCardDisabled,
      isWeb && styles.webResultCard,
      isWeb && isHovered && item.isAvailable && styles.webResultCardHover,
      !item.isAvailable && isWeb && styles.webResultCardDisabled
    ];
    
    const addButtonStyle = [
      styles.addButton,
      !item.isAvailable && styles.addButtonDisabled,
      isWeb && styles.webAddButton,
      isWeb && isHovered && item.isAvailable && styles.webAddButtonHover,
      !item.isAvailable && isWeb && styles.webAddButtonDisabled
    ];
    
    return (
      <Pressable 
        style={resultCardStyle}
        onMouseEnter={isWeb ? () => setIsHovered(true) : undefined}
        onMouseLeave={isWeb ? () => setIsHovered(false) : undefined}
        accessible={true}
        accessibilityRole="none"
      >
        <View style={styles.resultContent}>
          <View style={styles.userInfo}>
            {item.photoURL ? (
              <Image
                source={{ uri: item.photoURL }}
                style={[styles.userImage, isWeb && styles.webUserImage]}
                accessible={true}
                accessibilityLabel={`${item.username}'s profile picture`}
              />
            ) : (
              <View style={[styles.placeholderImage, isWeb && styles.webPlaceholderImage]}>
                <Text style={styles.placeholderText}>
                  {item.username?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.userTextInfo}>
              <Text 
                style={[styles.username, isWeb && styles.webUsername]}
                role={isWeb ? "heading" : undefined}
                aria-level={isWeb ? 3 : undefined}
              >
                {item.username}
              </Text>
              <Text style={[styles.supportInfo, isWeb && styles.webSupportInfo]}>
                Supporting: {item.currentSupportCount} / {item.supporterLimit}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={addButtonStyle}
            onPress={() => handleAddSupporter(item)}
            disabled={!item.isAvailable || loading}
            accessible={true}
            accessibilityLabel={item.isAvailable ? `Add ${item.username} as supporter` : `${item.username} has reached their support limit`}
            accessibilityRole="button"
            accessibilityState={{ disabled: !item.isAvailable || loading }}
            role={isWeb ? "button" : undefined}
            aria-disabled={isWeb ? (!item.isAvailable || loading) : undefined}
            tabIndex={isWeb ? 0 : undefined}
          >
            <Text style={[styles.addButtonText, isWeb && styles.webAddButtonText]}>
              {loading ? 'Adding...' : item.isAvailable ? 'Add Supporter' : 'Not Available'}
            </Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
      enabled={!isWeb}
    >
      <ScrollView 
        ref={scrollViewRef}
        style={containerStyle}
        contentContainerStyle={[
          contentWrapperStyle,
          { minHeight: isWeb ? '100vh' : 'auto' }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {isWeb && !isMobile && (
          <TouchableOpacity 
            style={backButtonStyle}
            onPress={handleBack}
            onMouseEnter={() => setHoverStates(prev => ({...prev, backButton: true}))}
            onMouseLeave={() => setHoverStates(prev => ({...prev, backButton: false}))}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            tabIndex={0}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}

        <Text 
          style={pageTitleStyle}
          role={isWeb ? "heading" : undefined}
          aria-level={isWeb ? 1 : undefined}
        >
          Add a Supporter
        </Text>

        <View style={cardStyle}>
          <View 
            style={[styles.searchContainer, isWeb && styles.webSearchContainer]}
            accessible={true}
            accessibilityLabel="Search Section"
          >
            <TextInput
              ref={searchInputRef}
              style={searchInputStyle}
              placeholder="Search by username"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              accessible={true}
              accessibilityLabel="Search username input"
              accessibilityHint="Enter a username to search for supporters"
              accessibilityRole="search"
              id={isWeb ? "search-input" : undefined}
              role={isWeb ? "searchbox" : undefined}
              aria-label={isWeb ? "Search by username" : undefined}
              onFocus={() => setFocused(prev => ({...prev, searchInput: true}))}
              onBlur={() => setFocused(prev => ({...prev, searchInput: false}))}
            />
            <TouchableOpacity 
              style={searchButtonStyle}
              onPress={handleSearch}
              onMouseEnter={isWeb ? () => setHoverStates(prev => ({...prev, searchButton: true})) : undefined}
              onMouseLeave={isWeb ? () => setHoverStates(prev => ({...prev, searchButton: false})) : undefined}
              disabled={loading || !searchQuery.trim()}
              accessible={true}
              accessibilityLabel={loading ? "Searching" : "Search"}
              accessibilityHint="Search for users with the entered username"
              accessibilityRole="button"
              accessibilityState={{ disabled: loading || !searchQuery.trim() }}
              role={isWeb ? "button" : undefined}
              aria-disabled={isWeb ? (loading || !searchQuery.trim()) : undefined}
              tabIndex={isWeb ? 0 : undefined}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.searchButtonText, isWeb && styles.webSearchButtonText]}>
                  Search
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {loading && searchResults.length === 0 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#24269B" />
              <Text style={styles.loadingText}>Searching for supporters...</Text>
            </View>
          )}

          {searchResults.length > 0 ? (
            <>
              <Text 
                style={[styles.resultsHeader, isWeb && styles.webResultsHeader]}
                role={isWeb ? "heading" : undefined}
                aria-level={isWeb ? 2 : undefined}
              >
                Search Results ({searchResults.length})
              </Text>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                accessible={true}
                accessibilityLabel={`${searchResults.length} search results`}
                style={[styles.resultsList, isWeb && styles.webResultsList]}
                renderItem={renderResultItem}
                scrollEnabled={false} // Disable scrolling as we're using a ScrollView
              />
            </>
          ) : searchQuery && !loading ? (
            <View style={[styles.noResultsContainer, isWeb && styles.webNoResultsContainer]}>
              <Text style={[styles.noResultsText, isWeb && styles.webNoResultsText]}>
                No users found with that username
              </Text>
            </View>
          ) : null}

          {isWeb && (
            <View style={styles.keyboardShortcuts}>
              <Text style={styles.keyboardShortcutsText}>
                <Text style={{fontWeight: 'bold'}}>Keyboard shortcuts:</Text>{'\n'}
                Enter: Search{'\n'}
                Escape: Clear search{'\n'}
                Ctrl+B: Go back
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentWrapper: {
    padding: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#24269B',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  searchButton: {
    backgroundColor: '#24269B',
    paddingHorizontal: 20,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  searchButtonDisabled: {
    backgroundColor: '#9999A0',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  resultsList: {
    flex: 1,
  },
  resultsHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#24269B',
  },
  resultCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  resultCardDisabled: {
    opacity: 0.7,
    backgroundColor: '#f5f5f5',
  },
  resultContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  placeholderImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  userTextInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  supportInfo: {
    fontSize: 14,
    color: '#666',
  },
  addButton: {
    backgroundColor: '#24269B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonDisabled: {
    backgroundColor: '#9999A0',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#24269B',
    fontWeight: '600',
  },
  keyboardShortcuts: {
    marginTop: 30,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#24269B',
  },
  keyboardShortcutsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },

  // Web-specific styles
  webContainer: {
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  webContainerDesktop: {
    paddingTop: 40,
  },
  webContentWrapper: {
    maxWidth: 800,
    marginHorizontal: 'auto',
    padding: Platform.OS === 'web' ? 40 : 20,
    width: '100%',
  },
  webCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  webPageTitle: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 32,
  },
  webSearchContainer: {
    gap: 16,
  },
  webSearchInput: {
    height: 48,
    fontSize: 16,
    borderRadius: 8,
    borderColor: '#ddd',
    outlineColor: '#24269B',
    paddingLeft: 16,
    transition: 'all 0.2s ease',
  },
  webSearchInputFocused: {
    borderColor: '#24269B',
    shadowColor: '#24269B',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  webSearchButton: {
    height: 48,
    minWidth: 120,
    cursor: 'pointer',
    borderRadius: 8,
    transition: 'all 0.2s ease',
  },
  webSearchButtonHover: {
    backgroundColor: '#1a1b70',
    transform: [{translateY: -1}],
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  webSearchButtonDisabled: {
    cursor: 'not-allowed',
    opacity: 0.7,
  },
  webSearchButtonText: {
    fontSize: 16,
  },
  webResultsList: {
    marginTop: 20,
  },
  webResultCard: {
    padding: 16,
    cursor: 'default',
    borderRadius: 8,
    transition: 'all 0.2s ease',
  },
  webResultCardHover: {
    transform: [{translateY: -2}],
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  webResultCardDisabled: {
    cursor: 'not-allowed',
  },
  webUserImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  webPlaceholderImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  webUsername: {
    fontSize: 18,
  },
  webSupportInfo: {
    fontSize: 15,
  },
  webAddButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    cursor: 'pointer',
    borderRadius: 6,
    transition: 'all 0.2s ease',
  },
  webAddButtonHover: {
    backgroundColor: '#1a1b70',
    transform: [{translateY: -1}],
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  webAddButtonDisabled: {
    cursor: 'not-allowed',
  },
  webAddButtonText: {
    fontSize: 15,
  },
  webNoResultsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  webNoResultsText: {
    fontSize: 18,
    color: '#666',
  },
  webResultsHeader: {
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 10,
    color: '#24269B',
  },
  webBackButton: {
    marginBottom: 24,
    cursor: 'pointer',
    display: 'inline-block',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    transition: 'all 0.2s ease',
  },
  webBackButtonHover: {
    backgroundColor: 'rgba(36, 38, 155, 0.1)',
  },
});

export default AddSupporterScreen; 