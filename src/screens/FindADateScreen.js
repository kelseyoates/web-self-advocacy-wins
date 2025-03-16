import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Platform,
  Pressable,
  useWindowDimensions
} from 'react-native';
import { auth } from '../config/firebase';
import StateDropdown from '../components/StateDropdown';
import { questions } from '../constants/questions';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { typesenseClient } from '../config/typesense';

// Web detection
const isWeb = Platform.OS === 'web';

// Only include dating questions
const allQuestions = [
  {
    id: 'dating_1',
    question: "What I'm looking for in a partner 💝:",
    words: [
      "kind", "honest", "funny", "caring", "understanding", 
      "patient", "supportive", "fun", "active", "creative", 
      "family-oriented", "ambitious", "adventurous"
    ]
  },
  {
    id: 'dating_2',
    question: "My ideal first date would be 🌟:",
    words: [
      "coffee", "dinner", "movies", "walk in the park", 
      "museum", "arcade", "bowling", "mini golf", 
      "ice cream", "picnic", "zoo", "aquarium"
    ]
  },
  {
    id: 'dating_3',
    question: "My favorite date activities are 🎉:",
    words: [
      "watching movies", "dining out", "cooking together", 
      "playing games", "sports", "shopping", "hiking", 
      "visiting museums", "trying new things", "traveling", 
      "going to events", "listening to music"
    ]
  }
];

const ArrowAnimation = () => {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: 10,
          duration: 1000,
          useNativeDriver: isWeb ? false : true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: isWeb ? false : true,
        }),
      ]).start(() => animate());
    };

    animate();

    return () => {
      translateY.stopAnimation();
    };
  }, [translateY]);

  const animatedStyle = isWeb ? 
    { transform: [{ translateY: translateY }] } : 
    { transform: [{ translateY }] };

  return (
    <View style={styles.arrowContainer}>
      <Animated.Text 
        style={[
          styles.arrow,
          animatedStyle
        ]}
        accessible={true}
        accessibilityLabel="Scroll down indicator"
        role={isWeb ? "img" : undefined}
        aria-hidden={isWeb ? "true" : undefined}
      >
        ↓
      </Animated.Text>
    </View>
  );
};

const FindADateScreen = ({ navigation }) => {
  const [selectedWords, setSelectedWords] = useState([]);
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const currentUser = auth.currentUser;
  const [selectedAgeRange, setSelectedAgeRange] = useState({ min: 18, max: 99 });
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  
  // Web-specific state management
  const [hoveredElement, setHoveredElement] = useState(null);
  const [focusedElement, setFocusedElement] = useState(null);
  
  // Responsive design hooks
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;
  const minAgeInputRef = useRef(null);
  const maxAgeInputRef = useRef(null);
  const textInputRef = useRef(null);
  const searchButtonRef = useRef(null);

  // Announce to screen reader for web and native
  const announceToScreenReader = useCallback((message) => {
    if (isScreenReaderEnabled) {
      if (isWeb) {
        const ariaLive = document.getElementById('aria-live-region');
        if (ariaLive) {
          ariaLive.textContent = message;
        }
      } else {
        AccessibilityInfo.announceForAccessibility(message);
      }
    }
  }, [isScreenReaderEnabled]);

  // Add screen reader detection with web support
  useEffect(() => {
    const checkScreenReader = async () => {
      try {
        if (isWeb) {
          // Web-specific screen reader detection (simplified)
          const result = await AccessibilityInfo.isScreenReaderEnabled();
          setIsScreenReaderEnabled(result);
        } else {
          const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
          setIsScreenReaderEnabled(screenReaderEnabled);
        }
      } catch (error) {
        console.error('Error checking screen reader:', error);
      }
    };

    checkScreenReader();
    
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (isEnabled) => {
        setIsScreenReaderEnabled(isEnabled);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle state selection
  const handleStateSelect = useCallback((state) => {
    setSelectedState(state);
    announceToScreenReader(`Selected state: ${state}`);
  }, [announceToScreenReader]);

  // Handle word selection
  const toggleWord = useCallback((word) => {
    setSelectedWords(prev => {
      const newWords = prev.includes(word) 
        ? prev.filter(w => w !== word)
        : [...prev, word];
      
      announceToScreenReader(prev.includes(word) 
        ? `Removed ${word}` 
        : `Added ${word}`);
      
      return newWords;
    });
  }, [announceToScreenReader]);

  // Handle keyboard events for web accessibility
  const handleKeyPress = useCallback((e, onPress) => {
    if (isWeb && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onPress();
    }
  }, []);

  const handleMinAgeChange = useCallback((text) => {
    // Allow empty or numeric values only
    if (text === '' || /^\d*$/.test(text)) {
      setSelectedAgeRange(prev => ({ ...prev, min: text }));
    }
  }, []);

  const handleMaxAgeChange = useCallback((text) => {
    // Allow empty or numeric values only
    if (text === '' || /^\d*$/.test(text)) {
      setSelectedAgeRange(prev => ({ ...prev, max: text }));
    }
  }, []);

  // Only validate and set defaults when the input loses focus
  const validateMinAge = useCallback((text) => {
    const age = parseInt(text);
    if (!text.trim() || isNaN(age) || age < 18) {
      setSelectedAgeRange(prev => ({ ...prev, min: '18' }));
    } else {
      setSelectedAgeRange(prev => ({ ...prev, min: String(age) }));
    }
  }, []);

  const validateMaxAge = useCallback((text) => {
    const age = parseInt(text);
    if (!text.trim() || isNaN(age) || age > 99) {
      setSelectedAgeRange(prev => ({ ...prev, max: '99' }));
    } else {
      setSelectedAgeRange(prev => ({ ...prev, max: String(age) }));
    }
  }, []);

  // Search function
  const searchUsers = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError(null);

      // Get current user's preferences from Firestore with lowercase UID
      const lowerCaseUid = currentUser.uid.toLowerCase();
      const userDocRef = doc(db, 'users', lowerCaseUid);
      console.log('Fetching user doc for ID:', lowerCaseUid);
      
      const userDoc = await getDoc(userDocRef);
      console.log('User doc exists:', userDoc.exists());
      
      const userData = userDoc.data();
      console.log('Full user data:', userData);
      
      const userGender = userData?.gender;
      const userLookingFor = userData?.lookingFor;

      console.log('Current user preferences:', { 
        originalUid: currentUser.uid,
        lowerCaseUid,
        userGender, 
        userLookingFor,
        rawGender: userData?.gender,
        rawLookingFor: userData?.lookingFor
      });

      if (!userGender || !userLookingFor) {
        const errorMsg = `Please set your gender and preferences in your profile first. Current values: Gender: ${userGender}, Looking for: ${userLookingFor}`;
        setError(errorMsg);
        announceToScreenReader('Please set your gender and preferences in your profile first');
        setLoading(false);
        return;
      }

      let filterBy = `age_sort:>=${parseInt(selectedAgeRange.min) || 18} && age_sort:<=${parseInt(selectedAgeRange.max) || 99} && id:!=${lowerCaseUid} && subscriptionType:=selfAdvocateDating`;
      
      // Add gender filters
      filterBy += ` && gender:=${userLookingFor}`;

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

      // Handle text search
      if (textAnswer && textAnswer.trim()) {
        searchParameters.searches[0].q = textAnswer.trim();
        searchParameters.searches[0].query_by = 'winTopics,questionAnswers.textAnswer';
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
          const noMatchesMsg = 'No matches found. Try adjusting your search criteria.';
          setError(noMatchesMsg);
          announceToScreenReader('No matches found');
        } else {
          const transformedResults = results.results[0].hits.map(hit => ({
            ...hit.document,
            objectID: hit.document.id
          }));

          setUsers(transformedResults);
          announceToScreenReader(`Found ${transformedResults.length} potential dates`);
        }
      }

    } catch (err) {
      console.error('Search error details:', err);
      setError('Failed to search users. Please try again.');
      announceToScreenReader('Error searching for dates');
    } finally {
      setLoading(false);
    }
  }, [
    currentUser, 
    selectedAgeRange.min, 
    selectedAgeRange.max, 
    selectedState, 
    textAnswer, 
    selectedWords,
    announceToScreenReader
  ]);

  // Add subscription check
  useEffect(() => {
    const checkSubscription = async () => {
      if (!currentUser) {
        navigation.replace('Login');
        return;
      }

      try {
        const lowerCaseUid = currentUser.uid.toLowerCase();
        console.log('Checking subscription for UID:', lowerCaseUid);
        
        const userDoc = await getDoc(doc(db, 'users', lowerCaseUid));
        const userData = userDoc.data();
        
        console.log('User data:', userData);

        if (!userData || userData.subscriptionType !== 'selfAdvocateDating') {
          const message = 'You need a Dating subscription to access this feature.';
          
          if (isWeb) {
            alert(message);
            navigation.replace('ManageSubscription');
          } else {
            Alert.alert(
              'Subscription Required',
              message,
              [
                {
                  text: 'Learn More',
                  onPress: () => navigation.replace('ManageSubscription'),
                },
                {
                  text: 'Go Back',
                  onPress: () => navigation.goBack(),
                  style: 'cancel',
                },
              ]
            );
          }
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        
        const errorMsg = 'Could not verify subscription status';
        if (isWeb) {
          alert('Error: ' + errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
        
        navigation.goBack();
      }
    };

    checkSubscription();
  }, [currentUser, navigation]);

  // Render user card with web compatibility
  const renderUserCard = useCallback(({ user }) => (
    <View key={user.id || user.objectID} style={styles.cardContainer}>
      <View style={styles.cardShadow} />
      <Pressable 
        style={({ pressed }) => [
          styles.userCard,
          isWeb && styles.webUserCard,
          isWeb && hoveredElement === `user-${user.id || user.objectID}` && styles.webUserCardHover,
          isWeb && focusedElement === `user-${user.id || user.objectID}` && styles.webUserCardFocus,
          pressed && !isWeb && styles.userCardPressed
        ]}
        onPress={() => {
          announceToScreenReader(`Opening profile for ${user.username}`);
          navigation.navigate('OtherUserProfile', { 
            profileUserId: user.id,
            username: user.username,
            isCurrentUser: false
          });
        }}
        onMouseEnter={isWeb ? () => setHoveredElement(`user-${user.id || user.objectID}`) : undefined}
        onMouseLeave={isWeb ? () => setHoveredElement(null) : undefined}
        onFocus={isWeb ? () => setFocusedElement(`user-${user.id || user.objectID}`) : undefined}
        onBlur={isWeb ? () => setFocusedElement(null) : undefined}
        onKeyPress={(e) => handleKeyPress(e, () => {
          navigation.navigate('OtherUserProfile', { 
            profileUserId: user.id,
            username: user.username,
            isCurrentUser: false
          });
        })}
        accessible={true}
        accessibilityLabel={`${user.username}, ${user.age_str} years old, from ${user.state}`}
        accessibilityHint="Double tap to view full profile"
        accessibilityRole="button"
        role={isWeb ? "button" : undefined}
        tabIndex={isWeb ? 0 : undefined}
      >
        <View style={styles.cardContent}>
          <Image 
            source={{ uri: user.profilePicture }} 
            style={[styles.avatar, isWeb && styles.webAvatar]}
            accessible={true}
            accessibilityLabel={`${user.username}'s profile picture`}
            accessibilityRole="image"
          />
          <View style={styles.userInfo}>
            <Text style={[styles.username, isWeb && styles.webUsername]}>
              {user.username}
            </Text>
            <Text style={[styles.infoText, isWeb && styles.webInfoText]}>
              {user.age_str} years old
            </Text>
            <Text style={[styles.infoText, isWeb && styles.webInfoText]}>
              {user.state}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  ), [announceToScreenReader, navigation, hoveredElement, focusedElement, handleKeyPress]);

  return (
    <View style={styles.container}>
      {isWeb && (
        <div 
          id="aria-live-region" 
          role="status" 
          aria-live="polite" 
          style={{ 
            position: 'absolute', 
            width: 1, 
            height: 1, 
            padding: 0, 
            margin: -1, 
            overflow: 'hidden', 
            clip: 'rect(0, 0, 0, 0)', 
            whiteSpace: 'nowrap', 
            border: 0 
          }}
        />
      )}
      
      <ScrollView 
        style={[
          styles.scrollViewContainer,
          isWeb && styles.webScrollViewContainer
        ]}
        contentContainerStyle={[
          styles.scrollViewContent,
          isWeb && styles.webScrollViewContent
        ]}
        accessible={true}
        accessibilityLabel="Find a Date Screen"
      >
        <View style={[
          styles.headerContainer,
          isWeb && styles.webHeaderContainer
        ]}>
          <View style={styles.headerContent}>
            <Image
              source={require('../../assets/dating-large.png')}
              style={[
                styles.headerImage,
                isWeb && styles.webHeaderImage
              ]}
              accessible={true}
              accessibilityLabel="A woman and a man are texting each other with heart emojis"
            />
            <Text style={[
              styles.headerText,
              isWeb && styles.webHeaderText
            ]}>Find a Date</Text>
          </View>
          <Text style={[
            styles.bodyText,
            isWeb && styles.webBodyText
          ]}>
            Look for people who share your interests and experiences. 
            You can use these filters or just scroll down to see potential dates.
          </Text>
        </View>
        
        <ArrowAnimation />

        <View style={[
          styles.sectionContainer,
          isWeb && styles.webSectionContainer
        ]}>
          <View style={styles.sectionContent}>
            <Image
              source={require('../../assets/map.png')}
              style={[
                styles.sectionImage,
                isWeb && styles.webSectionImage
              ]}
              accessible={true}
              accessibilityLabel="map icon"
            />
            <Text style={[
              styles.sectionText,
              isWeb && styles.webSectionText
            ]}>Where do you want to find your dates?</Text>
          </View>
          <Text style={[
            styles.bodyText,
            isWeb && styles.webBodyText
          ]}>
            Use the dropdown to search for friends in your state or anywhere in the world.
          </Text>
        </View>

        <StateDropdown 
          selectedState={selectedState}
          onStateChange={handleStateSelect}
        />

        <ArrowAnimation />
        
        <View style={[
          styles.sectionContainer,
          isWeb && styles.webSectionContainer
        ]}>
          <View style={styles.sectionContent}>
            <Image
              source={require('../../assets/age.png')}
              style={[
                styles.sectionImage,
                isWeb && styles.webSectionImage
              ]}
              accessible={true}
              accessibilityLabel="a young and old man"
            />
            <Text style={[
              styles.sectionText,
              isWeb && styles.webSectionText
            ]}>How old do you want your new date to be?</Text>
          </View>
          <Text style={[
            styles.bodyText,
            isWeb && styles.webBodyText
          ]}>
            Tap the number to type in the youngest and oldest ages you want to search for.
          </Text>
        </View>

        <View 
          style={[
            styles.searchSection,
            isWeb && styles.webSearchSection
          ]}
          accessible={true}
          accessibilityLabel="Age Range Section"
        >
          <Text style={[
            styles.sectionTitle,
            isWeb && styles.webSectionTitle
          ]}>Age Range</Text>
          <View style={[
            styles.ageRangeContainer,
            isWeb && styles.webAgeRangeContainer
          ]}>
            <View style={styles.ageInputRow}>
              <View style={styles.ageInputContainer}>
                <Text style={[
                  styles.ageLabel,
                  isWeb && styles.webAgeLabel
                ]}>Minimum Age</Text>
                <TextInput
                  ref={minAgeInputRef}
                  style={[
                    styles.ageInput,
                    isWeb && styles.webAgeInput,
                    isWeb && focusedElement === 'minAge' && styles.webAgeInputFocused
                  ]}
                  value={String(selectedAgeRange.min)}
                  onChangeText={handleMinAgeChange}
                  onEndEditing={(e) => validateMinAge(e.nativeEvent.text)}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onBlur={() => {
                    Keyboard.dismiss();
                    isWeb && setFocusedElement(null);
                  }}
                  onFocus={() => isWeb && setFocusedElement('minAge')}
                  blurOnSubmit={true}
                  maxLength={2}
                  accessible={true}
                  accessibilityLabel="Minimum age input"
                  accessibilityHint="Enter minimum age, must be at least 18"
                />
              </View>
              <Text style={[
                styles.ageSeparatorText,
                isWeb && styles.webAgeSeparatorText
              ]}>to</Text>
              <View style={styles.ageInputContainer}>
                <Text style={[
                  styles.ageLabel,
                  isWeb && styles.webAgeLabel
                ]}>Maximum Age</Text>
                <TextInput
                  ref={maxAgeInputRef}
                  style={[
                    styles.ageInput,
                    isWeb && styles.webAgeInput,
                    isWeb && focusedElement === 'maxAge' && styles.webAgeInputFocused
                  ]}
                  value={String(selectedAgeRange.max)}
                  onChangeText={handleMaxAgeChange}
                  onEndEditing={(e) => validateMaxAge(e.nativeEvent.text)}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onBlur={() => {
                    Keyboard.dismiss();
                    isWeb && setFocusedElement(null);
                  }}
                  onFocus={() => isWeb && setFocusedElement('maxAge')}
                  blurOnSubmit={true}
                  maxLength={2}
                  accessible={true}
                  accessibilityLabel="Maximum age input"
                  accessibilityHint="Enter maximum age, cannot exceed 99"
                />
              </View>
            </View>
          </View>

          <ArrowAnimation />
          
          <View style={[
            styles.sectionContainer,
            isWeb && styles.webSectionContainer
          ]}>
            <View style={styles.sectionContent}>
              <Image
                source={require('../../assets/topics.png')}
                style={[
                  styles.sectionImage,
                  isWeb && styles.webSectionImage
                ]}
                accessible={true}
                accessibilityLabel="chat bubbles with hashtags"
              />
              <Text style={[
                styles.sectionText,
                isWeb && styles.webSectionText
              ]}>Do you want to search by topic?</Text>
            </View>
            <Text style={[
              styles.bodyText,
              isWeb && styles.webBodyText
            ]}>
              Type in something you enjoy and want your date to enjoy as well.
            </Text>
          </View>

          <View 
            style={[
              styles.searchSection,
              isWeb && styles.webSearchSection
            ]}
            accessible={true}
            accessibilityLabel="Text Search Section"
          >
            <Text style={[
              styles.sectionTitle,
              isWeb && styles.webSectionTitle
            ]}>Search by Text</Text>
            <TextInput
              ref={textInputRef}
              style={[
                styles.textInput,
                isWeb && styles.webTextInput,
                isWeb && focusedElement === 'searchText' && styles.webTextInputFocused
              ]}
              placeholder="Type in topics to search..."
              value={textAnswer}
              onChangeText={setTextAnswer}
              multiline
              onFocus={() => isWeb && setFocusedElement('searchText')}
              onBlur={() => isWeb && setFocusedElement(null)}
              accessible={true}
              accessibilityLabel="Search text input"
              accessibilityHint="Enter topics to search for matches"
            />
          </View>
          
          <ArrowAnimation />
          
          <View style={[
            styles.sectionContainer,
            isWeb && styles.webSectionContainer
          ]}>
            <View style={styles.sectionContent}>
              <Image
                source={require('../../assets/words.png')}
                style={[
                  styles.sectionImage,
                  isWeb && styles.webSectionImage
                ]}
                accessible={true}
                accessibilityLabel="a man with word bubbles around him"
              />
              <Text style={[
                styles.sectionText,
                isWeb && styles.webSectionText
              ]}>What do you want your date to be like?</Text>
            </View>
            <Text style={[
              styles.bodyText,
              isWeb && styles.webBodyText
            ]}>
              Tap the words that describe your new date.
            </Text>
          </View>

          <Text style={[
            styles.sectionTitle,
            isWeb && styles.webSectionTitle
          ]}>Select Words</Text>
          <View style={styles.wordsContainer}>
            {allQuestions.map((q) => (
              <View 
                key={q.id} 
                style={[
                  styles.questionCard,
                  isWeb && styles.webQuestionCard
                ]}
                accessible={true}
                accessibilityLabel={q.question}
              >
                <Text style={[
                  styles.questionText,
                  isWeb && styles.webQuestionText
                ]}>{q.question}</Text>
                <View style={[
                  styles.wordsGrid,
                  isWeb && styles.webWordsGrid
                ]}>
                  {q.words.map((word) => (
                    <Pressable
                      key={word}
                      style={[
                        styles.wordButton,
                        selectedWords.includes(word) && styles.selectedWord,
                        isWeb && styles.webWordButton,
                        isWeb && selectedWords.includes(word) && styles.webSelectedWord,
                        isWeb && hoveredElement === `word-${word}` && styles.webWordButtonHover
                      ]}
                      onPress={() => toggleWord(word)}
                      onMouseEnter={isWeb ? () => setHoveredElement(`word-${word}`) : undefined}
                      onMouseLeave={isWeb ? () => setHoveredElement(null) : undefined}
                      onKeyPress={(e) => handleKeyPress(e, () => toggleWord(word))}
                      accessible={true}
                      accessibilityLabel={`${word}, ${selectedWords.includes(word) ? 'selected' : 'not selected'}`}
                      accessibilityHint={`Double tap to ${selectedWords.includes(word) ? 'remove' : 'add'} this word`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: selectedWords.includes(word) }}
                      role={isWeb ? "button" : undefined}
                      tabIndex={isWeb ? 0 : undefined}
                    >
                      <Text style={[
                        styles.wordText,
                        selectedWords.includes(word) && styles.selectedWordText,
                        isWeb && styles.webWordText,
                        isWeb && selectedWords.includes(word) && styles.webSelectedWordText
                      ]}>
                        {word}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
     
        <View style={[
          styles.resultsContainer,
          isWeb && styles.webResultsContainer
        ]}>
          <View style={styles.resultsContent}>
            <Image
              source={require('../../assets/dating-icon.png')}
              style={[
                styles.sectionImage,
                isWeb && styles.webSectionImage
              ]}
              accessible={true}
              accessibilityLabel="two users match on their phones"
            />
            <Text style={[
              styles.resultsText,
              isWeb && styles.webResultsText
            ]}>Your Results</Text>
          </View>
          <Text style={[
            styles.bodyText,
            isWeb && styles.webBodyText
          ]}>
            Tap the card below to see your potential date's profile.
          </Text>
        </View>

        {error && (
          <Text 
            style={[
              styles.error,
              isWeb && styles.webError
            ]}
            accessible={true}
            accessibilityLabel={`Error: ${error}`}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        )}

        <ArrowAnimation />
        
        <View style={[
          styles.resultsContainer,
          isWeb && styles.webResultsContainer
        ]}>
          {users.map(user => renderUserCard({ user }))}
        </View>

        <View style={[
          styles.searchButtonContainer,
          isWeb && styles.webSearchButtonContainer
        ]}>
          <Pressable
            ref={searchButtonRef}
            style={[
              styles.searchButton,
              loading && styles.searchButtonDisabled,
              isWeb && styles.webSearchButton,
              isWeb && hoveredElement === 'searchButton' && !loading && styles.webSearchButtonHover,
              isWeb && focusedElement === 'searchButton' && styles.webSearchButtonFocus
            ]}
            onPress={searchUsers}
            onMouseEnter={isWeb ? () => !loading && setHoveredElement('searchButton') : undefined}
            onMouseLeave={isWeb ? () => setHoveredElement(null) : undefined}
            onFocus={isWeb ? () => setFocusedElement('searchButton') : undefined}
            onBlur={isWeb ? () => setFocusedElement(null) : undefined}
            onKeyPress={(e) => handleKeyPress(e, searchUsers)}
            disabled={loading}
            accessible={true}
            accessibilityLabel={loading ? "Searching..." : "Search for dates"}
            accessibilityHint="Double tap to search for potential dates with your selected filters"
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
            role={isWeb ? "button" : undefined}
            tabIndex={isWeb ? 0 : undefined}
          >
            <Text style={[
              styles.searchButtonText,
              isWeb && styles.webSearchButtonText
            ]}>
              {loading ? "Searching..." : "Search for Dates"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6fbfd',
    padding: 15,
  },
  
  questionCard: {
    backgroundColor: '#ffffff',
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
    marginRight: 15,
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
    marginVertical: 10,
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
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#24269B',
    // Add shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchButtonDisabled: {
    backgroundColor: '#9999aa',
    borderColor: '#9999aa',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  webUserCard: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
  },
  webUserCardHover: {
    transform: [{ translateY: -2 }],
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)',
  },
  webUserCardFocus: {
    outline: 'none',
    boxShadow: '0 0 0 2px #24269B, 0 4px 8px rgba(0, 0, 0, 0.1)',
  },
  userCardPressed: {
    backgroundColor: '#f0f0f0',
  },
  webAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  webUsername: {
    fontSize: 20,
    marginBottom: 4,
  },
  webInfoText: {
    fontSize: 15,
  },
  scrollViewContainer: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 15,
  },
  webScrollViewContainer: {
    backgroundColor: '#f6fbfd',
  },
  webScrollViewContent: {
    paddingBottom: 40,
    maxWidth: 1200,
    marginHorizontal: 'auto',
  },
  webHeaderContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  webHeaderImage: {
    width: 350,
    height: 230,
  },
  webHeaderText: {
    fontSize: 28,
    marginBottom: 10,
  },
  webBodyText: {
    fontSize: 18,
    lineHeight: 26,
    marginHorizontal: 'auto',
    maxWidth: 800,
  },
  webSectionContainer: {
    marginVertical: 20,
  },
  webSectionImage: {
    width: 120,
    height: 120,
  },
  webSectionText: {
    fontSize: 22,
  },
  webSectionTitle: {
    fontSize: 22,
    marginBottom: 16,
  },
  webAgeRangeContainer: {
    borderWidth: 2,
    padding: 20,
  },
  webAgeLabel: {
    fontSize: 18,
  },
  webAgeInput: {
    fontSize: 18,
    padding: 15,
    borderWidth: 2,
  },
  webAgeInputFocused: {
    borderColor: '#3a3db1',
    outline: 'none',
  },
  webAgeSeparatorText: {
    fontSize: 18,
    margin: 0,
    padding: 15,
  },
  webSearchSection: {
    maxWidth: 800,
    marginHorizontal: 'auto',
  },
  webTextInput: {
    borderWidth: 2,
    padding: 15,
    fontSize: 18,
    minHeight: 120,
  },
  webTextInputFocused: {
    borderColor: '#3a3db1',
    outline: 'none',
  },
  webSearchButtonContainer: {
    marginTop: 30,
    marginBottom: 50,
  },
  webSearchButton: {
    borderRadius: 8,
    maxWidth: 500,
    marginHorizontal: 'auto',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
  webSearchButtonHover: {
    backgroundColor: '#3a3db1',
  },
  webSearchButtonFocus: {
    outline: 'none',
    boxShadow: '0 0 0 3px rgba(36, 38, 155, 0.5)',
  },
  webSearchButtonText: {
    fontSize: 20,
  },
  webQuestionCard: {
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    borderWidth: 2,
    padding: 25,
  },
  webQuestionText: {
    fontSize: 18,
    marginBottom: 20,
  },
  webWordsGrid: {
    gap: 15,
  },
  webWordButton: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    padding: 10,
    minWidth: 100,
    textAlign: 'center',
  },
  webSelectedWord: {
    backgroundColor: '#3a3db1',
  },
  webWordButtonHover: {
    transform: [{ scale: 1.05 }],
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
  },
  webWordText: {
    fontSize: 16,
  },
  webSelectedWordText: {
    color: '#fff',
  },
  webError: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 20,
    padding: 15,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 8,
    maxWidth: 800,
    marginHorizontal: 'auto',
  },
  webResultsContainer: {
    marginVertical: 20,
  },
  webResultsText: {
    fontSize: 28,
  }
});

export default FindADateScreen; 