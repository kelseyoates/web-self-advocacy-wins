import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  AccessibilityInfo,
  Keyboard,
  Animated,
  Button,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { auth } from '../config/firebase';
import StateDropdown from '../components/StateDropdown';
import { questions } from '../constants/questions';
import Typesense from 'typesense';
import debounce from 'lodash/debounce';

// Add web-specific styles
const webStyles = {
  container: {
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
    padding: 20,
  },
  button: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      opacity: 0.9,
    },
  },
  input: {
    outlineColor: '#24269B',
  },
  card: {
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
    ':hover': {
      transform: 'translateY(-4px)',
    },
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 20,
  },
};

const FindYourFriendsScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isMobile = width < 768;

  const [selectedWords, setSelectedWords] = useState([]);
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const currentUser = auth.currentUser;
  const [selectedAgeRange, setSelectedAgeRange] = useState({ min: 18, max: 99 });
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);

  // Add Typesense client initialization
  const client = new Typesense.Client({
    nodes: [{
      host: 'e6dqryica24hsu75p-1.a1.typesense.net',
      port: '443',
      protocol: 'https'
    }],
    apiKey: 'vcXv0c4EKrJ6AHFR1nCKQSXGch2EEzE7',
    connectionTimeoutSeconds: 10,
    retryIntervalSeconds: 0.1,
    numRetries: 3
  });

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

  // Handle state selection
  const handleStateSelect = (state) => {
    setSelectedState(state);
    announceToScreenReader(`Selected state: ${state}`);
  };

  // Handle word selection
  const toggleWord = (word) => {
    setSelectedWords(prev => {
      const newWords = prev.includes(word) 
        ? prev.filter(w => w !== word)
        : [...prev, word];
      
      announceToScreenReader(prev.includes(word) 
        ? `Removed ${word}` 
        : `Added ${word}`);
      
      return newWords;
    });
  };

  // Add debounced search for web
  const debouncedSearch = useRef(
    Platform.select({
      web: debounce(searchUsers, 500),
      default: searchUsers
    })
  ).current;

  // Add error boundary for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      window.addEventListener('error', handleError);
      return () => window.removeEventListener('error', handleError);
    }
  }, []);

  const handleError = (error) => {
    console.error('Error in FindYourFriendsScreen:', error);
    setError('Something went wrong. Please try again.');
    setLoading(false);
  };

  // Optimize search for web
  const searchUsers = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError(null);

      // Add loading state announcement for screen readers
      announceToScreenReader('Searching for friends...');
      
      // Debug logs
      console.log("Debug - Current User Info:", {
        uid: currentUser.uid,
        uidLowerCase: currentUser.uid.toLowerCase(),
        uidType: typeof currentUser.uid
      });

      let filterBy = `age_sort:>=${parseInt(selectedAgeRange.min) || 18} && age_sort:<=${parseInt(selectedAgeRange.max) || 99} && id:!=${currentUser.uid.toLowerCase()}`;
      
      if (selectedState && selectedState !== 'Anywhere') {
        filterBy += ` && state:=${selectedState}`;
      }

      const searchParameters = {
        searches: [{
          q: '*',
          query_by: 'username,state,questionAnswers.textAnswer,questionAnswers.selectedWords,winTopics',
          per_page: Platform.OS === 'web' ? 24 : 50, // Limit results on web for better performance
          collection: 'users',
          filter_by: filterBy
        }]
      };

      if (textAnswer && textAnswer.trim()) {
        searchParameters.searches[0].q = textAnswer.trim();
        searchParameters.searches[0].query_by = 'winTopics,questionAnswers.textAnswer';
        searchParameters.searches[0].query_by_weights = '2,1';
      } else if (selectedWords && selectedWords.length > 0) {
        const wordSearchString = selectedWords.join(' ');
        searchParameters.searches[0].q = wordSearchString;
        searchParameters.searches[0].query_by = 'questionAnswers.selectedWords';
      }

      const response = await fetch(
        'https://e6dqryica24hsu75p-1.a1.typesense.net/multi_search',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-TYPESENSE-API-KEY': 'vcXv0c4EKrJ6AHFR1nCKQSXGch2EEzE7'
          },
          body: JSON.stringify(searchParameters)
        }
      );

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const results = await response.json();

      if (results.results && results.results[0] && results.results[0].hits) {
        if (results.results[0].hits.length === 0) {
          setUsers([]);
          setError('No other users found yet. Be the first to invite your friends!');
          announceToScreenReader('No other users found yet');
        } else {
          const transformedResults = results.results[0].hits.map(hit => ({
            ...hit.document,
            objectID: hit.document.id,
            profilePicture: hit.document.profilePicture || '',
            username: hit.document.username || 'Anonymous',
            state: hit.document.state || 'Unknown',
            questionAnswers: hit.document.questionAnswers || []
          }));

          setUsers(transformedResults);
          announceToScreenReader(`Found ${transformedResults.length} potential friends`);
        }
      }

    } catch (err) {
      console.error('Search error details:', err);
      setError('Failed to search users. Please try again.');
      announceToScreenReader('Error searching for friends');
    } finally {
      setLoading(false);
    }
  };

  // Add keyboard handling for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleKeyPress = (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
          debouncedSearch();
        }
      };
      
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [debouncedSearch]);

  const handleMinAgeChange = (text) => {
    // Just update the text without any validation
    setSelectedAgeRange(prev => ({ ...prev, min: text }));
  };
  
  const handleMaxAgeChange = (text) => {
    // Just update the text without any validation
    setSelectedAgeRange(prev => ({ ...prev, max: text }));
  };

  // Add these validation functions for when input loses focus
  const validateMinAge = (text) => {
    if (!text.trim()) {
      setSelectedAgeRange(prev => ({ ...prev, min: '18' }));
      return;
    }

    const age = parseInt(text);
    if (isNaN(age) || age < 18) {
      setSelectedAgeRange(prev => ({ ...prev, min: '18' }));
    }
  };

  const validateMaxAge = (text) => {
    if (!text.trim()) {
      setSelectedAgeRange(prev => ({ ...prev, max: '99' }));
      return;
    }

    const age = parseInt(text);
    if (isNaN(age) || age > 99) {
      setSelectedAgeRange(prev => ({ ...prev, max: '99' }));
    }
  };

  const renderUserCard = (user) => {
    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => navigation.navigate('ViewProfile', { userId: user.id })}
        accessible={true}
        accessibilityLabel={`View ${user.username}'s profile`}
      >
        <Image 
          source={{ uri: user.profilePicture }} 
          style={styles.profileImage}
          accessible={true}
          accessibilityLabel={`${user.username}'s profile picture`}
        />
        <View style={styles.cardContent}>
          <Text style={styles.username}>{user.username}</Text>
          <Text style={styles.location}>{user.state}</Text>
          {/* Add other user information you want to display */}
        </View>
      </TouchableOpacity>
    );
  };

  // Add this component to replace the arrow containers
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
          ↓
        </Animated.Text>
      </View>
    );
  };

  // Update containerStyle to use web styles
  const containerStyle = [
    styles.container,
    isWeb && !isMobile && webStyles.container,
  ];

  // Update button styles for web
  const buttonStyle = [
    styles.wordButton,
    isWeb && webStyles.button,
  ];

  // Update input styles for web
  const inputStyle = [
    styles.textInput,
    isWeb && webStyles.input,
  ];

  // Update card styles for web
  const cardStyle = [
    styles.userCard,
    isWeb && webStyles.card,
  ];

  // Update results container style for web
  const resultsStyle = [
    styles.resultsContainer,
    isWeb && !isMobile && webStyles.grid,
  ];

  return (
    <ScrollView 
      style={containerStyle}
      contentContainerStyle={styles.scrollContent}
      accessible={true}
      accessibilityLabel="Find Friends Screen"
    >
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <Image
            source={require('../../assets/friends-3-2.png')}
            style={styles.headerImage}
            accessible={true}
            accessibilityLabel="Friends hanging out and chatting"
          />
          <Text style={styles.headerText}>Find Your Friends</Text>
        </View>
        <Text style={styles.bodyText}>
          Connect with people who share your interests and experiences. 
          You can use these filters or just scroll down to see potential friends.
        </Text>
       
      </View>

      <ArrowAnimation />

      <View style={styles.sectionContainer}>
        <View style={styles.sectionContent}>
          <Image
            source={require('../../assets/map.png')}
            style={styles.sectionImage}
            accessible={true}
            accessibilityLabel="map icon"
          />
          <Text style={styles.sectionText}>Where do you want to find friends?</Text>
        </View>
        <Text style={styles.bodyText}>
          Use the dropdown to search for friends in your state or anywhere in the world.
        </Text>
      </View>

      <StateDropdown 
        selectedState={selectedState}
        onStateChange={handleStateSelect}
      />
      
      <ArrowAnimation />

      <View style={styles.sectionContainer}>
        <View style={styles.sectionContent}>
          <Image
            source={require('../../assets/age.png')}
            style={styles.sectionImage}
            accessible={true}
            accessibilityLabel="a young and old man"
          />
          <Text style={styles.sectionText}>How old do you want your new friend to be?</Text>
        </View>
        <Text style={styles.bodyText}>
          Tap the number to type in the youngest and oldest ages you want to search for.
        </Text>
      </View>

      

 {/* Age Range Selection */}
 <View 
        style={styles.searchSection}
        accessible={true}
        accessibilityLabel="Age Range Section"
      >
        <Text style={styles.sectionTitle}>Age Range</Text>
        <View style={styles.ageRangeContainer}>
          <View style={styles.ageInputRow}>
            <View style={styles.ageInputContainer}>
              <Text style={styles.ageLabel}>Youngest Age</Text>
              <TextInput
                style={styles.ageInput}
                value={String(selectedAgeRange.min)}
                onChangeText={handleMinAgeChange}
                onEndEditing={(e) => validateMinAge(e.nativeEvent.text)}
                keyboardType="numeric"
                returnKeyType="done"
                onBlur={Keyboard.dismiss}
                blurOnSubmit={true}
                maxLength={2}
                accessible={true}
                accessibilityLabel="youngest age input"
                accessibilityHint="Enter youngest age, must be at least 18"
              />
            </View>
            <Text style={styles.ageSeparatorText}>to</Text>
            <View style={styles.ageInputContainer}>
              <Text style={styles.ageLabel}>Oldest Age</Text>
              <TextInput
                style={styles.ageInput}
                value={String(selectedAgeRange.max)}
                onChangeText={handleMaxAgeChange}
                onEndEditing={(e) => validateMaxAge(e.nativeEvent.text)}
                keyboardType="numeric"
                returnKeyType="done"
                onBlur={Keyboard.dismiss}
                blurOnSubmit={true}
                maxLength={2}
                accessible={true}
                accessibilityLabel="oldest age input"
                accessibilityHint="Enter oldest age, cannot exceed 99"
              />
            </View>
          </View>
        </View>
      </View>

      <ArrowAnimation />

      <View style={styles.sectionContainer}>
        <View style={styles.sectionContent}>
          <Image
            source={require('../../assets/topics.png')}
            style={styles.sectionImage}
            accessible={true}
            accessibilityLabel="chat bubbles with hashtags"
          />
          <Text style={styles.sectionText}>Do you want to search by topic?</Text>
        </View>
        <Text style={styles.bodyText}>
          Type in something you enjoy and want your friends to enjoy as well.
        </Text>
      </View>

      <View 
        style={styles.searchSection}
        accessible={true}
        accessibilityLabel="Text Search Section"
      >
        <Text style={styles.sectionTitle}>Search by Text</Text>
        <TextInput
          style={inputStyle}
          placeholder="Enter text to search..."
          value={textAnswer}
          onChangeText={setTextAnswer}
          multiline
          accessible={true}
          accessibilityLabel="Search text input"
          accessibilityHint="Enter topics to search for friends"
        />
      </View>

      <ArrowAnimation />

      <View style={styles.sectionContainer}>
        <View style={styles.sectionContent}>
          <Image
            source={require('../../assets/words.png')}
            style={styles.sectionImage}
            accessible={true}
            accessibilityLabel="a man with word bubbles around him"
          />
          <Text style={styles.sectionText}>What do you want your friends to be like?</Text>
        </View>
        <Text style={styles.bodyText}>
          Tap the words that describe your new friend.
        </Text>
      </View>

      <View 
        style={styles.searchSection}
        accessible={true}
        accessibilityLabel="Word Selection Section"
      >
        <Text style={styles.sectionTitle}>Select Words</Text>
        <View style={styles.wordsContainer}>
          {questions.map(question => 
            question.words ? (
              <View 
                key={question.id} 
                style={styles.questionCard}
                accessible={true}
                accessibilityLabel={question.text}
              >
                <Text style={styles.questionText}>{question.text}</Text>
                <View style={styles.wordsGrid}>
                  {question.words.map((word) => (
                    <TouchableOpacity
                      key={word}
                      style={buttonStyle}
                      onPress={() => toggleWord(word)}
                      accessible={true}
                      accessibilityLabel={`${word}, ${selectedWords.includes(word) ? 'selected' : 'not selected'}`}
                      accessibilityHint={`Double tap to ${selectedWords.includes(word) ? 'remove' : 'add'} this word`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: selectedWords.includes(word) }}
                    >
                      <Text style={[
                        styles.wordText,
                        selectedWords.includes(word) && styles.selectedWordText
                      ]}>
                        {word}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null
          )}
        </View>
      </View>

     

      {error && (
        <Text 
          style={styles.error}
          accessible={true}
          accessibilityLabel={`Error: ${error}`}
          accessibilityRole="alert"
        >
          {error}
        </Text>
      )}
      
  
      <View style={styles.resultsContainer}>
        <View style={styles.resultsContent}>
          <Image
            source={require('../../assets/friends-icon.png')}
            style={styles.resultsImage}
            accessible={true}
            accessibilityLabel="friends smiling in a group"
          />
          <Text style={styles.resultsText}>Your Results</Text>
        </View>
        <Text style={styles.bodyText}>
          Tap the card below to see your new friend's profile
        </Text>
      </View>
      <ArrowAnimation />

      <View style={resultsStyle}>
        
        {users.map(user => (
          <View key={user.objectID} style={cardStyle}>
            <View style={styles.cardShadow} />
            <TouchableOpacity 
              style={styles.userCard}
              onPress={() => {
                announceToScreenReader(`Opening profile for ${user.username}`);
                navigation.navigate('OtherUserProfile', { 
                  profileUserId: user.id,
                  username: user.username,
                  isCurrentUser: false
                });
              }}
              accessible={true}
              accessibilityLabel={`${user.username}, ${user.age_str} years old, from ${user.state}`}
              accessibilityHint="Double tap to view full profile"
              accessibilityRole="button"
            >
              <View style={styles.cardContent}>
                <Image 
                  source={{ uri: user.profilePicture }} 
                  style={styles.avatar}
                  accessible={true}
                  accessibilityLabel={`${user.username}'s profile picture`}
                  accessibilityRole="image"
                />
                <View 
                  style={styles.userInfo}
                  accessible={true}
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no-hide-descendants"
                >
                  <Text style={styles.username}>{user.username}</Text>
                  <Text style={styles.infoText}>{user.age_str} years old</Text>
                  <Text style={styles.infoText}>{user.state}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.searchButtonContainer}>
        <TouchableOpacity 
          style={buttonStyle}
          onPress={debouncedSearch}
          disabled={loading}
        >
          <Text style={styles.searchButtonText}>
            {loading ? 'Searching...' : 'Search Friends'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <Text>Searching for friends...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f6fbfd',
    padding: Platform.select({
      web: 0,
      default: 15,
    }),
  },
  
  questionCard: {
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#24269B',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  
  question: {
    fontSize: 16,
    fontWeight: '500',
    color: '#24269B',
    marginBottom: 15,
  },
  
  questionContainer: {
    marginBottom: 20,
    marginTop: 20,
  },

  questionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#24269B',
    marginBottom: 15,
  },

  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#24269B',
  },

  wordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4, // Negative margin to offset child margins
    marginTop: 8,
  },
  
  wordButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f6fbfd',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ':hover': {
          backgroundColor: '#e6e6e6',
        },
      },
      default: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  selectedWord: {
    backgroundColor: '#24269B',
  },
  wordText: {
    color: '#333',
    fontSize: 14,
  },
  selectedWordText: {
    color: '#fff',
  },
  resultsContainer: {
    marginTop: 20,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#24269B',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'transform 0.2s ease',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },

  buttonShadow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: -8,
    bottom: -8,
    backgroundColor: '#000',
    borderRadius: 8,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  avatarContainer: {
    marginRight: 20,
  },
  
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  
  defaultAvatar: {
    backgroundColor: '#24269B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  defaultAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  
  username: {
    fontSize: 18,
    fontWeight: '600',
    color: '#24269B',
  },

  stateText: {
    fontSize: 16,
  },
  
  ageText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  error: {
    color: 'red',
    marginTop: 10,
  },
  searchSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#24269B',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#24269B',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
    ...Platform.select({
      web: {
        outlineColor: '#24269B',
      },
    }),
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5, // Negative margin to offset child margins
  },
  searchButtonContainer: {
    padding: 20,
    alignItems: 'center',
  },
  searchButton: {
    backgroundColor: '#24269B',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    width: '80%',
  },
  searchButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  cardContainer: {
    position: 'relative',
    marginHorizontal: 20,
    marginVertical: 10,
  },
  cardShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: '#000',
    borderRadius: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ageRangeContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  ageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  ageInputContainer: {
    flex: 1,
  },
  ageLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: '#000000',
  },
  ageInput: {
    borderWidth: 1,
    borderColor: '#24269B',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: '#f8f8f8',
  },
  ageSeparator: {
    paddingHorizontal: 16,
  },
  ageSeparatorText: {
    fontSize: 16,
    color: '#666',
  },
  headerContainer: {
    padding: 20,
  },
  headerContent: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerImage: {
    width: 300,
    height: 200,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#24269B',
    textAlign: 'center',
   
  },
  bodyText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 22,
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
    height: 140,
  
  },
  arrow: {
    fontSize: 100,
    color: '#24269B',
    fontWeight: 'bold',
  },
  resultsContainer: {
    padding: 20,
  },
  resultsContent: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultsImage: {
    width: 300,
    height: 200,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  resultsText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#24269B',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#ffebee',
    margin: 10,
    borderRadius: 5,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  messageContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    margin: 10,
    borderRadius: 10,
  },
  messageText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
    color: '#666',
  },
  inviteButton: {
    backgroundColor: '#24269B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  inviteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  '@media (min-width: 768px)': {
    wordButton: {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      margin: 5,
    },
    searchButton: {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
    userCard: {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }
  },
  '@media (hover: hover)': {
    wordButton: {
      ':hover': {
        transform: 'translateY(-1px)',
        shadowOffset: {
          width: 0,
          height: 3,
        },
        shadowOpacity: 0.2,
      }
    },
    searchButton: {
      ':hover': {
        opacity: 0.9,
      }
    },
    userCard: {
      ':hover': {
        transform: 'translateY(-2px)',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.2,
      }
    }
  },
});

export default FindYourFriendsScreen; 