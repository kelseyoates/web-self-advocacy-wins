import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  AccessibilityInfo
} from 'react-native';
import { auth, db, storage } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot, setDoc, collection, query, where, getDocs, orderBy, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import QuestionCard from '../components/QuestionCard';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import WinCard from '../components/WinCard';
import { CometChat } from '@cometchat-pro/react-native-chat';
import { checkCometChatState, cleanupCometChat } from '../services/cometChat';
import StateDropdown from '../components/StateDropdown';
import { useAccessibility } from '../context/AccessibilityContext';
import { Timestamp } from 'firebase/firestore';

const isWeb = Platform.OS === 'web';

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
  'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { profileUserId } = route.params || {};
  const { user } = useAuth();
  const { showHelpers } = useAccessibility();
  
  // Accessibility-related state and refs
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [lastAnnouncedMessage, setLastAnnouncedMessage] = useState('');
  const profileImageRef = useRef(null);
  const statsRef = useRef(null);

  // Other state variables
  const [userData, setUserData] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [wins, setWins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedState, setSelectedState] = useState('');

  // Add birthdate state variables
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [showBirthdateModal, setShowBirthdateModal] = useState(false);

// gender
const [gender, setGender] = useState('');
const [lookingFor, setLookingFor] = useState('');

  // Add accessibility check effect
  useEffect(() => {
    const checkAccessibility = async () => {
      const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      setIsScreenReaderEnabled(screenReaderEnabled);
    };

    checkAccessibility();
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsScreenReaderEnabled
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // Add accessibility announcement helper
  const announceUpdate = (message) => {
    if (isScreenReaderEnabled) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  };

  // Generate arrays for the pickers
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: 100 }, 
    (_, i) => (currentYear - i).toString()
  );

  // Update the targetUserId initialization
  const targetUserId = (profileUserId || user?.uid || '').toLowerCase();

  // Add a ref to track if this is the initial set of values
  const isSettingInitialValues = useRef(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const lowercaseUid = targetUserId.toLowerCase();
        console.log('Fetching user data with lowercase UID:', lowercaseUid);
        
        const userRef = doc(db, 'users', lowercaseUid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          console.log('Successfully fetched user data:', data);
          setUserData(data);
          if (data.state) {
            setSelectedState(data.state);
            setStateToSave(data.state);
          }
          if (data.birthdate) {
            // Handle the new birthdate object format
            if (typeof data.birthdate === 'object' && 'month' in data.birthdate) {
              const monthName = months[data.birthdate.month];
              setSelectedMonth(monthName);
              setSelectedDay(data.birthdate.day.toString());
              setSelectedYear(data.birthdate.year.toString());
            } else {
              // Handle legacy Timestamp format if it exists
              try {
                const birthDate = data.birthdate.toDate ? 
                  data.birthdate.toDate() : 
                  new Date(data.birthdate);
                
                const monthName = months[birthDate.getMonth()];
                setSelectedMonth(monthName);
                setSelectedDay(birthDate.getDate().toString());
                setSelectedYear(birthDate.getFullYear().toString());
              } catch (error) {
                console.error('Error parsing legacy birthdate:', error);
              }
            }
          }
        } else {
          console.log('No user document found for ID:', lowercaseUid);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    if (targetUserId) {
      fetchUserData();
    }
  }, [targetUserId]);

  // Update the formatBirthday function to handle the new format
  const formatBirthday = (birthdate) => {
    if (!birthdate) return '';
    
    try {
      // Handle the new object format
      if (typeof birthdate === 'object' && 'month' in birthdate) {
        const date = new Date(birthdate.year, birthdate.month, birthdate.day);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      // Handle legacy formats (if any)
      if (typeof birthdate === 'string') {
        return new Date(birthdate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      // Handle Firestore Timestamp (if any)
      if (birthdate.toDate) {
        return birthdate.toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }

      return '';
    } catch (error) {
      console.error('Error formatting birthday:', error);
      return '';
    }
  };

  // Add this helper function to calculate age
  const calculateAge = (birthdate) => {
    const today = new Date();
    const birthYear = birthdate.year;
    const birthMonth = birthdate.month; // 0-11
    const birthDay = birthdate.day;

    let age = today.getFullYear() - birthYear;

    // Adjust age if birthday hasn't occurred this year
    if (today.getMonth() < birthMonth || 
        (today.getMonth() === birthMonth && today.getDate() < birthDay)) {
      age--;
    }

    return age;
  };

  // Update the updateBirthdateWithValues function
  const updateBirthdateWithValues = async (day, month, year) => {
    if (!month || !day || !year) {
      console.log('Missing required date information');
      return;
    }

    try {
      const birthdateObj = {
        day: parseInt(day),
        month: months.indexOf(month),
        year: parseInt(year)
      };

      console.log('Saving birthdate:', birthdateObj);

      const age = calculateAge(birthdateObj);
      console.log('Calculated age:', age);

      // Add validation for age
      if (typeof age !== 'number' || isNaN(age)) {
        console.error('Invalid age calculated:', age);
        return;
      }

      const userRef = doc(db, 'users', targetUserId);
      await updateDoc(userRef, {
        birthdate: birthdateObj,
        age // Add age to Firestore document
      });
      
      setUserData(prev => ({
        ...prev,
        birthdate: birthdateObj,
        age
      }));
      
      console.log('Birthday and age updated successfully:', { birthdate: birthdateObj, age });
      Alert.alert('Success', 'Birthday updated successfully');
    } catch (error) {
      console.error('Error updating birthdate:', error);
      Alert.alert('Error', 'Failed to update birthday');
    }
  };

  // Update the handleMonthSelect to fix the month issue
  const handleMonthSelect = (month) => {
    console.log('Selected month:', month, 'Index:', months.indexOf(month));
    setSelectedMonth(month);
    setShowMonthPicker(false);
    if (selectedDay && selectedYear) {
      updateBirthdateWithValues(selectedDay, month, selectedYear);
    }
  };

  const handleDaySelect = (day) => {
    setSelectedDay(day);
    setShowDayPicker(false);
    if (selectedMonth && selectedYear) {
      updateBirthdateWithValues(day, selectedMonth, selectedYear);
    }
  };

  const handleYearSelect = (year) => {
    setSelectedYear(year);
    setShowYearPicker(false);
    if (selectedDay && selectedMonth) {
      updateBirthdateWithValues(selectedDay, selectedMonth, year);
    }
  };

  useEffect(() => {
    console.log('DEBUG: ProfileScreen - Loading profile for:', {
      profileUserId,
      currentUserId: user?.uid,
      targetUserId,
      hasRouteParams: !!route.params
    });

    if (!targetUserId) {
      console.log('DEBUG: No targetUserId available');
      return;
    }

    const fetchProfileData = async () => {
      try {
        // Get user profile data
        const userRef = doc(db, 'users', targetUserId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          console.log('DEBUG: Got profile data:', {
            username: data.username,
            state: data.state
          });
          setUserData(data);
          setAnswers(data.questionAnswers || []);
          
          // Only fetch wins if viewing own profile
          if (!profileUserId) {
            await fetchUserWins();
          }
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [targetUserId]);

  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        await uploadProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadProfilePicture = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      if (!targetUserId) throw new Error('No user ID available');

      const storageRef = ref(storage, `profilePictures/${targetUserId}.jpg`);
      
      const snapshot = await uploadBytes(storageRef, blob);
      console.log('Uploaded successfully');

      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Download URL:', downloadURL);
      
      await updateDoc(doc(db, 'users', targetUserId), {
        profilePicture: downloadURL
      });

      setUserData(prev => ({
        ...prev,
        profilePicture: downloadURL
      }));

      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to update profile picture: ' + error.message);
    }
  };

  const [stateToSave, setStateToSave] = useState('');

  const handleStateSelect = async (state) => {
    console.log('State selected:', state);
    
    try {
      const lowercaseUid = targetUserId.toLowerCase();
      console.log('Saving state for user:', lowercaseUid);

      const userRef = doc(db, 'users', lowercaseUid);
      
      // Update Firestore
      await updateDoc(userRef, {
        state: state
      });

      // Update local state
      setSelectedState(state);
      setUserData(prev => ({
        ...prev,
        state: state
      }));

      // Announce the change to screen readers
      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility(`State updated to ${state}`);
      }

      console.log('State saved successfully:', state);
      setModalVisible(false);
    } catch (error) {
      console.error('Failed to save state:', error);
      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility('Failed to save state');
      } else {
        Alert.alert('Error', 'Failed to save state');
      }
    }
  };

  const StateSelector = () => {
    return (
      <View 
        style={styles.stateWrapper}
        accessible={true}
        accessibilityLabel="State selection section"
      >
        <Text style={styles.stateTitle}>
          Your State:
        </Text>
        
        <TouchableOpacity 
          style={styles.stateSelectButton}
          onPress={() => setModalVisible(true)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Select your state. Current state: ${selectedState || userData?.state || 'None selected'}`}
          accessibilityHint="Double tap to open state selection"
        >
          <Text style={styles.stateSelectButtonText}>
            {selectedState || userData?.state || 'Select State'}
          </Text>
          <MaterialCommunityIcons 
            name="chevron-down" 
            size={24} 
            color="#24269B"
          />
        </TouchableOpacity>

        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Your State</Text>
                <TouchableOpacity 
                  onPress={() => setModalVisible(false)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Close state selection"
                  accessibilityHint="Double tap to close"
                >
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <FlatList
                data={US_STATES}
                keyExtractor={(item) => item}
                accessibilityLabel="List of states"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.stateItem}
                    onPress={() => {
                      handleStateSelect(item);
                      setModalVisible(false);
                    }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={item}
                    accessibilityState={{
                      selected: selectedState === item || userData?.state === item
                    }}
                    accessibilityHint={`Double tap to select ${item} as your state`}
                  >
                    <Text style={[
                      styles.stateItemText,
                      (selectedState === item || userData?.state === item) && 
                      styles.selectedStateText
                    ]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  const renderPersonalInfo = () => (
    <View>
      {renderBirthdateSelectors()}
    </View>
  );

  // Update your picker render code to use these new handlers
  // Update your picker render code to use these new handlers
  const renderBirthdateSelectors = () => {
    return (
      <View 
        style={styles.stateWrapper}
        accessible={true}
        accessibilityLabel="Birthday selection section"
      >
        <Text style={styles.stateTitle}>
          Your Birthday:
        </Text>
        
        <View style={styles.birthdateButtonsRow}>
          <TouchableOpacity 
            style={styles.stateSelectButton}
            onPress={() => setShowMonthPicker(true)}
            accessible={true}
            accessibilityLabel={`Month: ${selectedMonth || 'Not selected'}. Double tap to change`}
            accessibilityHint="Opens month selection picker"
            accessibilityRole="button"
          >
            <Text style={styles.stateSelectButtonText}>
              {selectedMonth || 'Month'}
            </Text>
            <MaterialCommunityIcons 
              name="chevron-down" 
              size={24} 
              color="#24269B"
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.stateSelectButton}
            onPress={() => setShowDayPicker(true)}
            accessible={true}
            accessibilityLabel={`Day: ${selectedDay || 'Not selected'}. Double tap to change`}
            accessibilityHint="Opens day selection picker"
            accessibilityRole="button"
          >
            <Text style={styles.stateSelectButtonText}>
              {selectedDay || 'Day'}
            </Text>
            <MaterialCommunityIcons 
              name="chevron-down" 
              size={24} 
              color="#24269B"
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.stateSelectButton}
            onPress={() => setShowYearPicker(true)}
            accessible={true}
            accessibilityLabel={`Year: ${selectedYear || 'Not selected'}. Double tap to change`}
            accessibilityHint="Opens year selection picker"
            accessibilityRole="button"
          >
            <Text style={styles.stateSelectButtonText}>
              {selectedYear || 'Year'}
            </Text>
            <MaterialCommunityIcons 
              name="chevron-down" 
              size={24} 
              color="#24269B"
            />
          </TouchableOpacity>
        </View>

        {/* Month Picker Modal */}
        <Modal
          visible={showMonthPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowMonthPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Month</Text>
                <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={months}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.stateItem}
                    onPress={() => handleMonthSelect(item)}
                  >
                    <Text style={[
                      styles.stateItemText,
                      selectedMonth === item && styles.selectedStateText
                    ]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Day Picker Modal */}
        <Modal
          visible={showDayPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDayPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Day</Text>
                <TouchableOpacity onPress={() => setShowDayPicker(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={days}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.stateItem}
                    onPress={() => handleDaySelect(item)}
                  >
                    <Text style={[
                      styles.stateItemText,
                      selectedDay === item && styles.selectedStateText
                    ]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Year Picker Modal */}
        <Modal
          visible={showYearPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowYearPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Year</Text>
                <TouchableOpacity onPress={() => setShowYearPicker(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={years}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.stateItem}
                    onPress={() => handleYearSelect(item)}
                  >
                    <Text style={[
                      styles.stateItemText,
                      selectedYear === item && styles.selectedStateText
                    ]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  const saveState = async () => {
    if (!targetUserId) {
      Alert.alert('Error', 'User document not found');
      return;
    }

    try {
      const userRef = doc(db, 'users', targetUserId);
      await updateDoc(userRef, {
        state: selectedState,
      });
      Alert.alert('Success', 'State saved successfully');
    } catch (error) {
      console.error('Error saving state:', error);
      Alert.alert('Error', 'Failed to save state');
    }
  };


  const questions = [
    {
      id: 1,
      question: "A little bit about me 😀:",
      presetWords: ["fun", "smart", "athletic", "funny", "kind", "silly", "serious", "independent", "ambitious", "caring", "creative", "thoughtful", "adventurous"]
    },
    {
      id: 2,
      question: "What I like to do for fun 🎉:",
      presetWords: ["Special Olympics", "Best Buddies", "sports", "theater", "watching movies", "art", "dancing", "playing with my dog", "gaming", "listening to music", "hang with friends", "traveling", "reading", "cooking", "photography", "writing"]
    },
    {
      id: 3,
      question: "What I'm like as a friend 🤝:",
      presetWords: ["supportive", "hilarious", "honest", "loyal", "trustworthy", "caring", "spontaneous", "very fun", "dependable", "patient", "open-minded", "positive"]
    },
    {
      id: 4,
      question: "What my future goals are 🎯:",
      presetWords: ["live with friends", "finish school", "make friends", "get healthy", "get a job", "learn new things", "start a business", "find love", "get a pet", "travel", "make a difference", "make money"]
    },
    {
      id: 5,
      question: "What I'm most proud of 🔥:",
      presetWords: ["finishing school", "playing sports", "making friends", "getting a job", "trying new things", "dating", "traveling", "being a good friend", "being in my family", "helping people", "my art"]
    },
    {
      id: 6,
      question: "If I won the lottery, I would 💰:",
      presetWords: ["travel the world", "buy a house", "buy a car", "buy a boat", "start a business", "buy my friends gifts", "buy my family gifts", "give to charity", "own a sports team", "buy a hot tub", "fly first class"]
    },
    // Dating questions - only visible with selfAdvocateDating subscription
    {
      id: 7,
      question: "What I'm like as a partner 💝:",
      presetWords: ["caring", "dependable", "honest", "kind", "loving", "loyal", "respectful", "supportive", "thoughtful", "understanding"],
      isDatingQuestion: true
    },
    {
      id: 8,
      question: "My ideal first date would be 🌟:",
      presetWords: ["coffee", "dinner", "lunch", "movies", "museum", "park", "picnic", "walk", "zoo"],
      isDatingQuestion: true
    },
    {
      id: 9,
      question: "My favorite date activities are 🎉:",
      presetWords: ["bowling", "cooking", "dancing", "dining out", "hiking", "movies", "music", "sports", "walking", "watching movies"],
      isDatingQuestion: true
    },
  ];

  const getLatestAnswer = (question) => {
    if (!answers) return null;
    
    const questionAnswers = answers.filter(a => a.question === question);
    if (questionAnswers.length === 0) return null;
    
    // Sort by timestamp and get the most recent
    return questionAnswers.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    )[0];
  };

  const handleAnswerSave = async (newAnswer) => {
    try {
      if (!targetUserId) {
        console.error('No user ID available');
        return;
      }

      console.log('Starting save operation for question:', newAnswer.question);

      // Add timestamp to the answer
      const answerWithTimestamp = {
        ...newAnswer,
        timestamp: new Date().toISOString()
      };

      // Get current answers array from Firestore
      const userRef = doc(db, 'users', targetUserId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.error('User document not found');
        return;
      }

      // Get existing answers and log them
      const currentAnswers = userDoc.data().questionAnswers || [];
      console.log('Current answers before update:', currentAnswers);

      // Check if we already have this exact answer to prevent duplicates
      const isDuplicate = currentAnswers.some(answer => 
        answer.question === newAnswer.question && 
        answer.textAnswer === newAnswer.textAnswer &&
        Math.abs(new Date(answer.timestamp) - new Date(answerWithTimestamp.timestamp)) < 1000 // Within 1 second
      );

      if (isDuplicate) {
        console.log('Preventing duplicate answer submission');
        return;
      }

      // Filter out any existing answers for this question
      const filteredAnswers = currentAnswers.filter(
        answer => answer.question !== newAnswer.question
      );

      // Add the new answer
      const updatedAnswers = [...filteredAnswers, answerWithTimestamp];
      console.log('Updated answers array:', updatedAnswers);

      // Update Firestore
      await updateDoc(userRef, {
        questionAnswers: updatedAnswers
      });

      // Update local state
      setAnswers(updatedAnswers);

      // Announce success to screen reader
      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility('Answer saved successfully');
      }

      console.log('Answer saved successfully');
    } catch (error) {
      console.error('Error saving answer:', error);
      Alert.alert('Error', 'Failed to save your answer');
    }
  };


  const [refreshKey, setRefreshKey] = useState(0);

  const fetchUserWins = async () => {
    try {
      console.log('Fetching wins for user:', targetUserId);
      
      const winsQuery = query(
        collection(db, 'wins'),
        where('userId', '==', targetUserId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(winsQuery);
      console.log(`Found ${querySnapshot.size} wins`);
      
      const userWins = [];
      
      querySnapshot.docs.forEach(doc => {
        const win = { id: doc.id, ...doc.data() };
        userWins.push(win);
      });

      setWins(userWins);

    } catch (error) {
      console.error('Error fetching wins:', error);
    }
  };

  // Add this useEffect to refresh wins when needed
  useEffect(() => {
    if (targetUserId) {
      fetchUserWins();
    }
  }, [refreshKey, targetUserId]);

  // Add this useEffect to listen for wins collection changes
  useEffect(() => {
    if (!targetUserId) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'wins'),
        where('userId', '==', targetUserId)
      ),
      (snapshot) => {
        console.log('Wins collection updated');
        setRefreshKey(prev => prev + 1);
      }
    );

    return () => unsubscribe();
  }, [targetUserId]);

  const handleDayPress = async (day) => {
    console.log('Day pressed:', day);
    await fetchWinsForDate(day.dateString);
  };

  // Add this function to calculate total cheers and comments
  const calculateStats = (userWins) => {
    return userWins.reduce((acc, win) => {
      acc.totalCheers += win.cheers || 0;
      acc.totalComments += (win.comments?.length || 0);
      return acc;
    }, { totalCheers: 0, totalComments: 0 });
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleProfilePictureUpdate = async () => {
    try {
      announceUpdate('Opening image picker');
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please grant permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        announceUpdate('Uploading new profile picture');
        setIsUploading(true);
        const imageUri = result.assets[0].uri;

        // Convert URI to blob
        const response = await fetch(imageUri);
        const blob = await response.blob();

        // Upload to Firebase Storage
        const storageRef = ref(storage, `profilePictures/${userData.uid}.jpg`);
        await uploadBytes(storageRef, blob);

        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);

        // Update Firestore
        const userRef = doc(db, 'users', userData.uid);
        await updateDoc(userRef, {
          profilePicture: downloadURL
        });

        // Update CometChat user
        try {
          const user = new CometChat.User(userData.uid);
          user.setAvatar(downloadURL);
          await CometChat.updateCurrentUserDetails(user);
          console.log('CometChat profile updated successfully');
        } catch (cometChatError) {
          console.error('CometChat update error:', cometChatError);
          // Continue even if CometChat update fails
        }

        // Update local state
        setUserData(prev => ({
          ...prev,
          profilePicture: downloadURL
        }));

        Alert.alert('Success', 'Profile picture updated successfully');
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
      Alert.alert('Error', 'Failed to update profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  // Add these state variables
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Add this function to handle date changes
  const onDateChange = (event, selectedDate) => {
    if (selectedDate) {
      // Calculate age
      const today = new Date();
      let age = today.getFullYear() - selectedDate.getFullYear();
      if (today.getMonth() < selectedDate.getMonth() || 
          (today.getMonth() === selectedDate.getMonth() && today.getDate() < selectedDate.getDate())) {
        age--;
      }

      // Update state
      setSelectedDate(selectedDate);
      setUserData(prev => ({
        ...prev,
        birthdate: selectedDate.toISOString().split('T')[0],
        age: age
      }));
    }
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  };

  // Add this function to show the date picker
  const showPicker = () => {
    setShowDatePicker(true);
  };

  const renderPicker = (items, selectedValue, onSelect, onClose) => {
    return (
      <Modal
        transparent={true}
        visible={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.closeButton}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {items.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.pickerItem,
                    selectedValue === item && styles.selectedItem
                  ]}
                  onPress={() => {
                    console.log('Selected value in picker:', item);
                    onSelect(item);
                    onClose();
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    selectedValue === item && styles.selectedItemText
                  ]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Add this function to your ProfileScreen component
  const updateBirthdate = async () => {
    // Get the latest state values at the time of the update
    const currentState = {
      day: selectedDay,
      month: selectedMonth,
      year: selectedYear
    };
    
    console.log('Starting updateBirthdate with latest state:', currentState);

    if (currentState.month && currentState.day && currentState.year) {
      try {
        const paddedDay = currentState.day.toString().padStart(2, '0');
        const monthIndex = months.indexOf(currentState.month);
        const paddedMonth = (monthIndex + 1).toString().padStart(2, '0');
        
        const birthdate = `${currentState.year}-${paddedMonth}-${paddedDay}`;
        console.log('About to save birthdate:', birthdate);
        
        const userRef = doc(db, 'users', targetUserId);
        await updateDoc(userRef, {
          birthdate: birthdate
        });
        
        console.log('Successfully updated Firestore with:', birthdate);
        
        setUserData(prev => ({
          ...prev,
          birthdate
        }));
        
        Alert.alert('Success', 'Birthday updated successfully');
      } catch (error) {
        console.error('Error updating birthdate:', error);
        Alert.alert('Error', 'Failed to update birthday');
      }
    } else {
      console.log('Missing required date information:', currentState);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      const refreshUserData = async () => {
        if (!user?.uid) return;
        
        try {
          const userRef = doc(db, 'users', user.uid.toLowerCase());
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            console.log('Refreshed user data:', data);
          }
        } catch (error) {
          console.error('Error refreshing user data:', error);
        }
      };

      refreshUserData();
    }, [user])
  );

  // Filter questions based on subscription
  const visibleQuestions = questions.filter(q => 
    !q.isDatingQuestion || (q.isDatingQuestion && userData?.subscriptionType === 'selfAdvocateDating')
  );

  useEffect(() => {
    const checkChat = async () => {
      const chatState = await checkCometChatState();
      console.log('CometChat state in ProfileScreen:', chatState);
    };
    
    checkChat();

    return () => {
      // Optional: cleanup when leaving profile screen
      // cleanupCometChat();
    };
  }, []);

  // Add this useEffect to check for screen reader
  useEffect(() => {
    const checkScreenReader = async () => {
      const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      setIsScreenReaderEnabled(screenReaderEnabled);
    };

    checkScreenReader();

    // Listen for screen reader changes
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsScreenReaderEnabled
    );

    return () => {
      // Clean up subscription on unmount
      subscription.remove();
    };
  }, []);

  // Add helper function for accessibility announcements
  const announceMessage = (message) => {
    if (isScreenReaderEnabled && message !== lastAnnouncedMessage) {
      AccessibilityInfo.announceForAccessibility(message);
      setLastAnnouncedMessage(message);
    }
  };

  // Add these accessibility helper functions
  const announceDateSelection = (type, value) => {
    if (isScreenReaderEnabled) {
      let message = '';
      switch (type) {
        case 'month':
          message = `Selected month: ${value}`;
          break;
        case 'day':
          message = `Selected day: ${value}`;
          break;
        case 'year':
          message = `Selected year: ${value}`;
          break;
      }
      AccessibilityInfo.announceForAccessibility(message);
      setLastAnnouncedMessage(message);
    }
  };

  const formatDateForAccessibility = () => {
    if (selectedMonth && selectedDay && selectedYear) {
      return `Birth date: ${selectedMonth} ${selectedDay}, ${selectedYear}`;
    }
    return 'Birth date not set';
  };

  // Add this function to handle picker visibility with accessibility
  const togglePicker = (pickerType, isVisible) => {
    switch (pickerType) {
      case 'month':
        setShowMonthPicker(isVisible);
        if (isScreenReaderEnabled) {
          AccessibilityInfo.announceForAccessibility(
            isVisible ? 'Month picker opened' : 'Month picker closed'
          );
        }
        break;
      case 'day':
        setShowDayPicker(isVisible);
        if (isScreenReaderEnabled) {
          AccessibilityInfo.announceForAccessibility(
            isVisible ? 'Day picker opened' : 'Day picker closed'
          );
        }
        break;
      case 'year':
        setShowYearPicker(isVisible);
        if (isScreenReaderEnabled) {
          AccessibilityInfo.announceForAccessibility(
            isVisible ? 'Year picker opened' : 'Year picker closed'
          );
        }
        break;
    }
  };

  // Add this function to handle profile updates with accessibility
  const handleProfileUpdate = async () => {
    try {
      setIsUpdatingProfile(true);
      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility('Updating profile...');
      }

      // Your existing profile update logic here

      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility('Profile updated successfully');
      }
    } catch (error) {
      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility('Error updating profile');
      }
      console.error('Error updating profile:', error);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Add to your utility functions
  const hasGoodContrast = (color1, color2) => {
    // Implement WCAG contrast ratio calculation
    // Return true if contrast ratio is at least 4.5:1
  };

  // Add these state variables with your other state declarations
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showLookingForModal, setShowLookingForModal] = useState(false);

  // Add these arrays for the options
  const GENDER_OPTIONS = ['Man', 'Woman', 'Non-binary'];
  const LOOKING_FOR_OPTIONS = ['Man', 'Woman', 'Everyone'];

  // Update the renderDatingInfo function
  const renderDatingInfo = () => {
    if (userData?.subscriptionType !== 'selfAdvocateDating') return null;

    return (
      <View 
        style={styles.stateWrapper}
        accessible={true}
        accessibilityLabel="Dating Profile Section"
      >
        <Text style={styles.stateTitle}>
          Dating Profile
        </Text>
        
        <View style={styles.datingSelectors}>
          {/* Gender Selector */}
          <View style={styles.datingSelectWrapper}>
            <Text style={styles.datingLabel}>My Gender:</Text>
            <TouchableOpacity 
              style={styles.stateSelectButton}
              onPress={() => setShowGenderModal(true)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Select your own gender. Current selection: ${userData?.gender || 'None selected'}`}
              accessibilityHint="Double tap to open your own gender selection"
            >
              <Text style={styles.stateSelectButtonText}>
                {userData?.gender || 'Select Your Own Gender'}
              </Text>
              <MaterialCommunityIcons 
                name="chevron-down" 
                size={24} 
                color="#24269B"
              />
            </TouchableOpacity>
          </View>

          {/* Looking For Selector */}
          <View style={styles.datingSelectWrapper}>
            <Text style={styles.datingLabel}>I'm Looking For:</Text>
            <TouchableOpacity 
              style={styles.stateSelectButton}
              onPress={() => setShowLookingForModal(true)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Select which gender you would like to date. Current selection: ${userData?.lookingFor || 'None selected'}`}
              accessibilityHint="Double tap to open preference selection"
            >
              <Text style={styles.stateSelectButtonText}>
                {userData?.lookingFor || 'Select Preference'}
              </Text>
              <MaterialCommunityIcons 
                name="chevron-down" 
                size={24} 
                color="#24269B"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Gender Modal */}
        <Modal
          visible={showGenderModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowGenderModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Gender</Text>
                <TouchableOpacity 
                  onPress={() => setShowGenderModal(false)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Close gender selection"
                >
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={GENDER_OPTIONS}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.stateItem}
                    onPress={() => {
                      handleGenderSelect(item);
                      setShowGenderModal(false);
                    }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={item}
                    accessibilityState={{ selected: userData?.gender === item }}
                  >
                    <Text style={[
                      styles.stateItemText,
                      userData?.gender === item && styles.selectedStateText
                    ]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Looking For Modal */}
        <Modal
          visible={showLookingForModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowLookingForModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>I'm Looking For</Text>
                <TouchableOpacity 
                  onPress={() => setShowLookingForModal(false)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Close preference selection"
                >
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={LOOKING_FOR_OPTIONS}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.stateItem}
                    onPress={() => {
                      handleLookingForSelect(item);
                      setShowLookingForModal(false);
                    }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={item}
                    accessibilityState={{ selected: userData?.lookingFor === item }}
                  >
                    <Text style={[
                      styles.stateItemText,
                      userData?.lookingFor === item && styles.selectedStateText
                    ]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  // Update the handlers to include accessibility announcements
  const handleGenderSelect = async (selectedGender) => {
    try {
      const userRef = doc(db, 'users', targetUserId);
      await updateDoc(userRef, {
        gender: selectedGender
      });
      setUserData(prev => ({
        ...prev,
        gender: selectedGender
      }));
      
      // Announce the change to screen readers
      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility(`Gender updated to ${selectedGender}`);
      } else {
        Alert.alert('Success', 'Gender updated successfully');
      }
    } catch (error) {
      console.error('Error updating gender:', error);
      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility('Failed to update gender');
      } else {
        Alert.alert('Error', 'Failed to update gender');
      }
    }
  };

  const handleLookingForSelect = async (selectedPreference) => {
    try {
      const userRef = doc(db, 'users', targetUserId);
      await updateDoc(userRef, {
        lookingFor: selectedPreference
      });
      setUserData(prev => ({
        ...prev,
        lookingFor: selectedPreference
      }));
      
      // Announce the change to screen readers
      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility(`Preference updated to ${selectedPreference}`);
      } else {
        Alert.alert('Success', 'Preference updated successfully');
      }
    } catch (error) {
      console.error('Error updating preference:', error);
      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility('Failed to update preference');
      } else {
        Alert.alert('Error', 'Failed to update preference');
      }
    }
  };

  // Make sure targetUserId is properly initialized
  useEffect(() => {
    console.log('Current auth state:', {
      profileUserId,
      currentUserId: user?.uid,
      targetUserId
    });
  }, [profileUserId, user, targetUserId]);

  // Update the handleBirthdateSelect function
  const handleBirthdateSelect = async (type, value) => {
    console.log('Selecting birthdate:', type, value);
    
    try {
      let newDay = selectedDay;
      let newMonth = selectedMonth;
      let newYear = selectedYear;

      // Update the appropriate value
      switch (type) {
        case 'month':
          newMonth = value;
          setSelectedMonth(value);
          break;
        case 'day':
          newDay = value;
          setSelectedDay(value);
          break;
        case 'year':
          newYear = value;
          setSelectedYear(value);
          break;
      }

      // Only proceed if we have all values
      if (newMonth && newDay && newYear) {
        const monthIndex = months.indexOf(newMonth);
        const paddedMonth = (monthIndex + 1).toString().padStart(2, '0');
        const paddedDay = newDay.toString().padStart(2, '0');
        const birthdate = `${newYear}-${paddedMonth}-${paddedDay}`;

        const userRef = doc(db, 'users', targetUserId.toLowerCase());
        await updateDoc(userRef, {
          birthdate: birthdate
        });

        setUserData(prev => ({
          ...prev,
          birthdate
        }));

        console.log('Birthdate updated successfully:', birthdate);
        Alert.alert('Success', 'Birthday updated successfully');
        setShowBirthdateModal(false);
      }
    } catch (error) {
      console.error('Error updating birthdate:', error);
      Alert.alert('Error', 'Failed to update birthday');
    }
  };

  const handleDeleteWin = async (winId) => {
    try {
      const userRef = doc(db, 'users', targetUserId);
      const winRef = doc(db, 'users', targetUserId, 'wins', winId);
      
      // First get the win to know its topic
      const winDoc = await getDoc(winRef);
      const winData = winDoc.data();
      const topicToRemove = winData?.topic;

      // Get current user data to update winTopics
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      
      // Remove the topic from winTopics array
      let updatedWinTopics = userData.winTopics || [];
      if (topicToRemove) {
        updatedWinTopics = updatedWinTopics.filter(topic => topic !== topicToRemove);
      }

      // Delete the win document
      await deleteDoc(winRef);

      // Update the user's winTopics
      await updateDoc(userRef, {
        winTopics: updatedWinTopics
      });

      // Update local state
      setWins(prevWins => prevWins.filter(win => win.id !== winId));
      
      // Announce success to screen reader
      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility('Win deleted successfully');
      }

    } catch (error) {
      console.error('Error deleting win:', error);
      Alert.alert('Error', 'Failed to delete win');
    }
  };

  // Add the header setup useEffect
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

  if (!user && !profileUserId) {
    return (
      <View style={styles.container}>
        <Text>Please log in to view your profile</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={[
        styles.container,
        isWeb && styles.webContainer
      ]}
      accessible={false}
    >
      <View style={[
        styles.contentWrapper,
        isWeb && styles.webContentWrapper
      ]}>
        {showHelpers && (
          <View 
            style={[
              styles.helperSection,
              isWeb && styles.webHelperSection
            ]}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel={`Profile Helper Information. 
              This is your profile page where you can share information about yourself. 
              You can add a profile picture, set your location, birthday, and answer fun questions about yourself. 
              If you have a dating subscription, you can also set your dating preferences.`}
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
            <View style={[
              styles.helperContent,
              isWeb && styles.webHelperContent
            ]}>
              <Text style={[
                styles.helperTitle,
                isWeb && styles.webHelperTitle
              ]}>Welcome to Your Profile!</Text>
              <View style={styles.helperTextContainer}>
                <Text style={[
                  styles.helperText,
                  isWeb && styles.webHelperText
                ]}>• Add or change your profile picture</Text>
                <Text style={[
                  styles.helperText,
                  isWeb && styles.webHelperText
                ]}>• Set your location and birthday</Text>
                <Text style={[
                  styles.helperText,
                  isWeb && styles.webHelperText
                ]}>• Answer questions about yourself</Text>
                <Text style={[
                  styles.helperText,
                  isWeb && styles.webHelperText
                ]}>• Set dating preferences if subscribed</Text>
              </View>
            </View>
          </View>
        )}

        <View 
          style={[
            styles.profileHeader,
            isWeb && styles.webProfileHeader
          ]}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`Profile for ${userData?.username || 'User'}. ${
            userData?.state ? `Located in ${userData.state}.` : ''
          } ${
            userData?.birthdate ? `Birthday: ${formatBirthday(userData.birthdate)}` : ''
          }`}
        >
          <TouchableOpacity 
            ref={profileImageRef}
            onPress={handleProfilePictureUpdate}
            disabled={isUploading}
            style={[
              styles.profileImageContainer,
              isWeb && styles.webProfileImageContainer
            ]}
            accessible={true}
            accessibilityLabel={`Profile picture for ${userData?.username || 'User'}. Double tap to change`}
            accessibilityHint="Opens image picker to select new profile picture"
            accessibilityRole="button"
          >
            <Image
              source={{ 
                uri: userData?.profilePicture || 'https://www.gravatar.com/avatar'
              }}
              style={[
                styles.profileImage,
                isWeb && styles.webProfileImage
              ]}
            />
            {isUploading ? (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <View style={[
                styles.editOverlay,
                isWeb && styles.webEditOverlay
              ]}>
                <Text style={styles.editText}>Edit</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <View 
            style={[
              styles.userInfo,
              isWeb && styles.webUserInfo
            ]}
            accessible={true}
            accessibilityLabel={`Profile information for ${userData?.username || 'User'}`}
          >
            <Text style={[
              styles.username,
              isWeb && styles.webUsername
            ]}>{userData?.username || 'User'}</Text>
            
            {userData?.state && (
              <Text style={[
                styles.infoText,
                isWeb && styles.webInfoText
              ]}>📍 {userData.state}</Text>
            )}
            
            {userData?.birthdate && (
              <Text style={[
                styles.infoText,
                isWeb && styles.webInfoText
              ]}>
                🎂 {formatBirthday(userData.birthdate)}
              </Text>
            )}
          </View>
        </View>

        {showHelpers && (
          <View 
            style={styles.helperSection}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel="Helper Information: Your Stats. Your stats show your total number of wins, how many cheers you've received, and how many comments people have left on your wins. They will automatically update."
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
            <Text style={styles.helperTextBold} importantForAccessibility="no">
              Your Stats
            </Text>
            <Text style={styles.helperText} importantForAccessibility="no">
              Your stats show your total number of wins, how many cheers you've received, and how many comments people have left on your wins. They will automatically update.
            </Text>
          </View>
        )}

        <View 
          style={styles.statsSection}
          accessible={false}
        >
          <View style={styles.statsRow}>
            <View 
              style={styles.statItem}
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel={`${wins.length} Wins`}
            >
              <Image 
                source={require('../../assets/wins-stats.png')} 
                style={styles.statIcon}
                importantForAccessibility="no"
              />
              <Text style={styles.statNumber}>{wins.length}</Text>
              <Text style={styles.statLabel}>Wins</Text>
            </View>

            <View 
              style={styles.statItem}
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel={`${calculateStats(wins).totalCheers} Cheers received`}
            >
              <Image 
                source={require('../../assets/cheers.png')} 
                style={styles.statIcon}
                importantForAccessibility="no"
              />
              <Text style={styles.statNumber}>
                {calculateStats(wins).totalCheers}
              </Text>
              <Text style={styles.statLabel}>Cheers</Text>
            </View>

            <View 
              style={styles.statItem}
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel={`${calculateStats(wins).totalComments} Comments received`}
            >
              <Image 
                source={require('../../assets/comments.png')} 
                style={styles.statIcon}
                importantForAccessibility="no"
              />
              <Text style={styles.statNumber}>
                {calculateStats(wins).totalComments}
              </Text>
              <Text style={styles.statLabel}>Comments</Text>
            </View>
          </View>
        </View>

        {showHelpers && !profileUserId && (
          <View 
            style={styles.helperSection}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel="Helper Information: Your State. Select your state to help other people find you better in the Find a Friend feature."
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
            <Text style={styles.helperTextBold} importantForAccessibility="no">
              Your State
            </Text>
            <Text style={styles.helperText} importantForAccessibility="no">
              Select your state to help other people find you better in the Find a Friend feature.
            </Text>
          </View>
        )}

        {!profileUserId ? ( // Only show these sections for own profile
          <>
            <StateSelector />

            <View 
              style={styles.helperSection}
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel="Helper Information: Your Birthday. Tap to select your birthday. This helps people find you better in the Find a Friend feature."
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
              <Text style={styles.helperTextBold} importantForAccessibility="no">
                Your Birthday
              </Text>
              <Text style={styles.helperText} importantForAccessibility="no">
                Tap to select your birthday. This helps people find you better in the Find a Friend feature.
              </Text>
            </View>

            {renderPersonalInfo()}
          </>
        ) : null}


        <View 
          style={styles.helperSection}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="Helper Information: Your Profile Questions. Answer these questions to tell people about yourself. You can: Tap the pencil icon to write your own answer. Tap the list icon to pick from suggested words. Tap the video icon to record a video answer. If you subscribe to the Dating plan, you will see questions about dating here as well."
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
          <Text style={styles.helperTextBold} importantForAccessibility="no">
            Your Profile Questions
          </Text>
          <Text style={styles.helperText} importantForAccessibility="no">
            Answer these questions to tell people about yourself. You can:
          </Text>
          <View style={styles.helperList} importantForAccessibility="no">
            <Text style={styles.helperListItem}>• Tap the pencil icon to write your own answer.</Text>
            <Text style={styles.helperListItem}>• Tap the list icon to pick from suggested words.</Text>
            <Text style={styles.helperListItem}>• Tap the video icon to record a video answer.</Text>
            <Text style={styles.helperListItem}>If you subscribe to the Dating plan, you will see questions about dating here as well.</Text>
          </View>
        </View>

        <View style={styles.questionSection}>
          <Text style={styles.sectionTitle}>My Profile</Text>
          {visibleQuestions.map((question) => (
            <View key={question.id} style={styles.questionContainer}>
              <QuestionCard
                question={question.question}
                presetWords={question.presetWords}
                onSave={handleAnswerSave}
                existingAnswer={getLatestAnswer(question.question)}
                readOnly={!!profileUserId} // Make read-only when viewing other profiles
                isDatingQuestion={question.isDatingQuestion}
              />
            </View>
          ))}
        </View>

        {userData?.subscriptionType === 'selfAdvocateDating' && (
          <View 
            style={styles.datingSection}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel="Dating preferences section"
          >
            {renderDatingInfo()}
          </View>
        )}


        <View 
          style={styles.helperSection}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="Helper Information: Your Win History. View all of your previous wins here. You can delete a win by tapping the red trash icon in the top right corner of the win card."
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
          <Text style={styles.helperTextBold} importantForAccessibility="no">
            Your Win History
          </Text>
          <Text style={styles.helperText} importantForAccessibility="no">
            View all of your previous wins here. You can delete a win by tapping the red trash icon in the top right corner of the win card.
          </Text>
        </View>

        <View style={styles.winsContainer}>
          <Text style={styles.sectionTitle}>My Win History</Text>
          {wins && wins.length > 0 ? (
            wins.map((win) => (
              <WinCard 
                key={win.id} 
                win={win}
                onDeleteWin={handleDeleteWin}
                onCheersPress={() => handleCheersPress(win)}
                lazyLoad={true}
              />
            ))
          ) : (
            <Text style={styles.noWinsText}>No wins yet</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  profileHeader: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profilePictureContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#000000',
  },
  editIconContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#24269B',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  menuSection: {
    padding: 15,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuItemText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
  },
  signOutItem: {
    marginTop: 20,
    borderBottomWidth: 0,
  },
  signOutText: {
    color: '#FF3B30',
  },
  
  stateContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 1,
    borderColor: '#000000',
  },
  stateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#24269B',
    marginBottom: 10,
  },
  stateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    marginBottom: 10,
  },
  stateButtonText: {
    fontSize: 14,
    color: '#333',
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },

  stateOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedStateOption: {
    backgroundColor: '#24269B',
  },
  stateOptionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedStateOptionText: {
    color: '#fff',
  },
  closeButton: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  
  winsList: {
    padding: 10,
  },
  calendar: {
    marginBottom: 10,
  },
  debug: {
    padding: 10,
    fontSize: 12,
    color: '#666',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
 
  scrollView: {
    width: '100%',
    flex: 1, // This allows the ScrollView to take up available space
  },
 
  birthdateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  birthdateButton: {
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 5,
    padding: 12,
    backgroundColor: '#fff',
  },
  birthdateText: {
    fontSize: 16,
    color: '#000000',
  },
  
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    width: '100%',
    marginBottom: 10,
  },
  personalInfoContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  datePickersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  datePickerButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    maxHeight: '50%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  pickerItem: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#24269B',
  },
  selectedPickerItem: {
    backgroundColor: '#f0f0f0',
  },
  pickerItemText: {
    fontSize: 16,
    textAlign: 'center',
  },
  selectedPickerItemText: {
    color: '#24269B',
    fontWeight: 'bold',
  },
  userDetails: {
    marginBottom: 10,
  },
  detailText: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 8,
  },

sectionTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#24269B',
  marginBottom: 10,
  marginTop: 20,
  marginLeft: 10,
  marginRight: 10,
  marginBottom: 10,
  alignSelf: 'center',
},
winCard: {
  backgroundColor: 'white',
  borderRadius: 10,
  padding: 15,
  marginBottom: 15,
  elevation: 2,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
},
winText: {
  fontSize: 16,
  marginBottom: 10,
},
winImage: {
  width: '100%',
  height: undefined,
  aspectRatio: 1, // This will adjust based on the actual image
  borderRadius: 8,
  marginVertical: 10,
},
winFooter: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
winDate: {
  fontSize: 14,
  color: '#666',
},
winStats: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 15,
},
statText: {
  fontSize: 14,
  color: '#666',
},
questionsContainer: {
  padding: 15,
  backgroundColor: 'white',
  marginTop: 10,
},


statsContainer: {
  flexDirection: 'row',
  justifyContent: 'space-around',
  alignItems: 'center',
 
  padding: 15,
  marginHorizontal: 10,
  marginVertical: 10,
  
},

statItem: {
  alignItems: 'center',
  flex: 1,
},

statIcon: {
  width: 90,
  height: 90,
  marginBottom: 5,
},

statNumber: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#24269B',
  marginBottom: 2,
},

statLabel: {
  fontSize: 12,
  color: '#666',
},

profileImageContainer: {
  width: 150,
  height: 150,
  borderRadius: 75,
  overflow: 'hidden',
  marginBottom: 20,
},

profileImage: {
  width: '100%',
  height: '100%',
},

uploadingOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'center',
  alignItems: 'center',
},

editOverlay: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  padding: 8,
  alignItems: 'center',
},

editText: {
  color: '#fff',
  fontSize: 14,
  fontWeight: '600',
},

modalContainer: {
  flex: 1,
  justifyContent: 'flex-end',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
},

modalContent: {
  backgroundColor: '#fff',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  paddingBottom: 20,
  maxHeight: '80%',
},

pickerHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: '#eee',
},

pickerButton: {
  padding: 8,
},

pickerButtonText: {
  fontSize: 16,
  color: '#666',
},

datePickerIOS: {
  height: 200,
},

datingProfileContainer: {
  backgroundColor: '#fff',
  padding: 15,
  marginHorizontal: 10,
  marginVertical: 5,
  borderRadius: 10,
  elevation: 2,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  borderWidth: 1,
  borderColor: '#000000',
},

stateDropdown: {
  marginBottom: 16,
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
helperText: {
  fontSize: 16,
  color: '#333',
  lineHeight: 22,
  marginTop: 20,
},
helperList: {
  marginTop: 10,
  paddingLeft: 10,
},
helperListItem: {
  fontSize: 16,
  color: '#333',
  lineHeight: 22,
  marginBottom: 5,
},
helperTextBold: {
  fontSize: 18,
  color: '#24269B',
  fontWeight: 'bold',
},
datingContainer: {
  marginHorizontal: 10,
  marginVertical: 10,
  padding: 10,
  backgroundColor: '#fff',
  borderRadius: 10,
  elevation: 2,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  borderWidth: 1,
  borderColor: '#000000',
},
datingInfo: {
  flexDirection: 'column',
  gap: 10,
},
datingInfoItem: {
  padding: 10,
},
label: {
  fontSize: 16,
  color: '#666',
  marginBottom: 8,
},
pickerButton: {
  borderWidth: 1,
  borderColor: '#24269B',
  borderRadius: 8,
  padding: 12,
  backgroundColor: '#fff',
},
pickerButtonText: {
  fontSize: 16,
  color: '#000000',
  textAlign: 'center',
},
dropdownButton: {
  borderWidth: 1,
  borderColor: '#24269B',
  borderRadius: 8,
  padding: 12,
  backgroundColor: '#fff',
},
dropdownButtonText: {
  fontSize: 16,
  color: '#000000',
  textAlign: 'center',
},
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'flex-end',
},
modalContent: {
  backgroundColor: '#fff',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  paddingBottom: 20,
  maxHeight: '80%',
},
modalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 15,
  borderBottomWidth: 1,
  borderBottomColor: '#eee',
},
modalTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#24269B',
},
closeButton: {
  fontSize: 24,
  color: '#666',
},
stateItem: {
  padding: 15,
  borderBottomWidth: 1,
  borderBottomColor: '#eee',
},
stateItemText: {
  fontSize: 16,
  color: '#333',
},
inputContainer: {
  padding: 15,
  backgroundColor: '#fff',
  borderRadius: 10,
  marginHorizontal: 10,
  marginVertical: 5,
},
selectedStateText: {
  color: '#24269B',
  fontWeight: 'bold',
},
birthdateSelectors: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  padding: 15,
},
selectorContainer: {
  flex: 1,
  marginHorizontal: 5,
},
selectorLabel: {
  fontSize: 14,
  marginBottom: 5,
  color: '#666',
},
selector: {
  height: 200,
},
selectorItem: {
  padding: 10,
  borderBottomWidth: 1,
  borderBottomColor: '#eee',
},
selectedItem: {
  backgroundColor: '#f0f0f0',
},
selectorItemText: {
  fontSize: 16,
  textAlign: 'center',
},
saveButton: {
  backgroundColor: '#24269B',
  margin: 15,
  padding: 15,
  borderRadius: 8,
  alignItems: 'center',
},
saveButtonText: {
  color: 'white',
  fontSize: 16,
  fontWeight: '600',
},
stateWrapper: {
  backgroundColor: '#fff',
  padding: 15,
  marginHorizontal: 10,
  marginVertical: 10,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#24269B',
  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  elevation: 5,
},

stateTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#24269B',
  marginBottom: 10,
},

stateSelectButton: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#24269B',
  borderRadius: 8,
  padding: 15,
  marginTop: 5,
},

stateSelectButtonText: {
  fontSize: 16,
  color: '#000',
},

birthdateButtonsRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  gap: 10,
},

birthdateSelectButton: {
  flex: 1,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#24269B',
  borderRadius: 8,
  padding: 15,
  marginTop: 5,
},

datingSelectors: {
  gap: 15,
},

datingSelectWrapper: {
  gap: 5,
},

datingLabel: {
  fontSize: 16,
  color: '#666',
  marginLeft: 5,
},

// Add menu styles
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
statsSection: {
  padding: 15,
  backgroundColor: '#fff',
  marginVertical: 10,
},
statsRow: {
  flexDirection: 'row',
  justifyContent: 'space-around',
  alignItems: 'center',
},

// Web-specific styles
webContainer: {
  backgroundColor: '#f8f9fa',
},
webContentWrapper: {
  maxWidth: 1200,
  marginHorizontal: 'auto',
  padding: '32px 24px',
  width: '100%',
},
webHelperSection: {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  padding: 24,
  marginBottom: 24,
},
webHelperContent: {
  maxWidth: 800,
  marginHorizontal: 'auto',
},
webHelperTitle: {
  fontSize: 28,
  marginBottom: 16,
  color: '#24269B',
},
webHelperText: {
  fontSize: 16,
  lineHeight: 1.6,
  marginBottom: 8,
},
webProfileHeader: {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  padding: 32,
  marginBottom: 24,
  flexDirection: isWeb ? 'row' : 'column',
  alignItems: 'center',
},
webProfileImageContainer: {
  width: 200,
  height: 200,
  borderRadius: 100,
  marginRight: isWeb ? 32 : 0,
  marginBottom: isWeb ? 0 : 20,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  cursor: 'pointer',
  transition: 'transform 0.2s ease',
  ':hover': {
    transform: 'scale(1.02)',
  },
},
webProfileImage: {
  width: '100%',
  height: '100%',
  borderRadius: 100,
},
webEditOverlay: {
  backgroundColor: 'rgba(36, 38, 155, 0.8)',
},
webUserInfo: {
  flex: 1,
  alignItems: isWeb ? 'flex-start' : 'center',
},
webUsername: {
  fontSize: 32,
  marginBottom: 12,
  color: '#24269B',
},
webInfoText: {
  fontSize: 18,
  marginBottom: 8,
  color: '#4a4a4a',
},
webStatsSection: {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  padding: 24,
  marginBottom: 24,
},
webStatItem: {
  padding: 16,
  borderRadius: 8,
  backgroundColor: '#f8f9fa',
  transition: 'transform 0.2s ease',
  ':hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
  },
},
webQuestionSection: {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  padding: 24,
  marginBottom: 24,
},
webModalOverlay: {
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  alignItems: 'center',
  justifyContent: 'center',
},
webModalContent: {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  padding: 24,
  maxWidth: 500,
  width: '90%',
},
webButton: {
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
  ':hover': {
    backgroundColor: '#1a1b6e',
  },
},
webInput: {
  borderWidth: 1,
  borderColor: '#e1e1e1',
  borderRadius: 8,
  padding: 12,
  fontSize: 16,
  backgroundColor: '#ffffff',
  transition: 'border-color 0.2s ease',
  ':focus': {
    borderColor: '#24269B',
    outline: 'none',
  },
},
});

export default ProfileScreen;