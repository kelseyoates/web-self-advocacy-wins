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
  Button
} from 'react-native';
import { auth } from '../config/firebase';
import StateDropdown from '../components/StateDropdown';
import { questions } from '../constants/questions';
import Typesense from 'typesense';

const FindYourFriendsScreen = ({ navigation }) => {
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

  // Search function
  const searchUsers = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Debug logs
      console.log("Debug - Current User Info:", {
        uid: currentUser.uid,
        uidLowerCase: currentUser.uid.toLowerCase(),
        uidType: typeof currentUser.uid
      });

      let filterBy = `age_sort:>=${parseInt(selectedAgeRange.min) || 18} && age_sort:<=${parseInt(selectedAgeRange.max) || 99} && id:!=${currentUser.uid.toLowerCase()}`;
      
      // Add state filter if a state is selected
      if (selectedState && selectedState !== 'Anywhere') {
        filterBy += ` && state:=${selectedState}`;
      }

      const searchParameters = {
        searches: [{
          q: '*',
          query_by: 'username,state,questionAnswers.textAnswer,questionAnswers.selectedWords,winTopics',
          per_page: 50,
          collection: 'users',
          filter_by: filterBy
        }]
      };

      if (textAnswer && textAnswer.trim()) {
        searchParameters.searches[0].q = textAnswer.trim();
        // Change query_by to prioritize winTopics
        searchParameters.searches[0].query_by = 'winTopics,questionAnswers.textAnswer';
        // Add weight to prioritize winTopics matches
        searchParameters.searches[0].query_by_weights = '2,1';
      } else if (selectedWords && selectedWords.length > 0) {
        const wordSearchString = selectedWords.join(' ');
        searchParameters.searches[0].q = wordSearchString;
        searchParameters.searches[0].query_by = 'questionAnswers.selectedWords';
      }

      console.log('Search parameters:', JSON.stringify(searchParameters));

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

      const results = await response.json();
      console.log('Raw Typesense response:', JSON.stringify(results, null, 2));

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

  return (
    <ScrollView 
      style={styles.container}
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
          style={styles.textInput}
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
                      style={[
                        styles.wordButton,
                        selectedWords.includes(word) && styles.selectedWord
                      ]}
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

      <View style={styles.resultsContainer}>
        
        {users.map(user => (
          <View key={user.objectID} style={styles.cardContainer}>
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
          style={styles.searchButton}
          onPress={searchUsers}
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
  container: {
    flex: 1,
    backgroundColor: '#f6fbfd',
    padding: 15,
  },
  
  questionCard: {
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#24269B',
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
    gap: 8,
    marginTop: 8,
  },
  wordButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    // borderRadius: 20,
    backgroundColor: '#f6fbfd',
    borderWidth: 1,
    borderColor: '#000000',

    borderRadius: 10,
    boxShadow: '0.3rem 0.3rem 0.6rem var(--greyLight-2), -0.2rem -0.2rem 0.5rem var(--white)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#24269B',
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
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  searchButton: {
    backgroundColor: '#24269B',
    borderRadius: 5,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    height: 70,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
});

export default FindYourFriendsScreen; 