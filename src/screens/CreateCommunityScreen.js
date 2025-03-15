import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  AccessibilityInfo,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { CometChat } from '@cometchat-pro/react-native-chat';
import { auth, db, storage } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COMETCHAT_CONSTANTS } from '../config/cometChatConfig';

// Detect if running on web
const isWeb = Platform.OS === 'web';

const CreateCommunityScreen = ({ navigation }) => {
  const [communityName, setCommunityName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [groupIcon, setGroupIcon] = useState(null);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState('');

  // Fetch user profile for header
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        if (auth.currentUser) {
          const userDocRef = doc(db, 'users', auth.currentUser.uid.toLowerCase());
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUserData(data);
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
          style={[styles.profileButton, isWeb && styles.webProfileButton]}
          onPress={() => navigation.navigate('Profile')}
          accessible={true}
          accessibilityLabel="Go to profile"
          accessibilityHint="Navigate to your profile page"
        >
          <Image
            source={
              userData?.profilePicture 
                ? { uri: userData.profilePicture } 
                : require('../../assets/default-profile.png')
            }
            style={styles.profileImage}
          />
          <Text style={styles.profileText}>Profile</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, userData]);

  // Add this effect for screen reader announcement
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('Create Community Screen');
  }, []);

  const pickImage = async () => {
    try {
      if (isWeb) {
        // Web-specific image picker
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        // Create a promise to handle the file selection
        const fileSelected = new Promise((resolve) => {
          input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => {
                // Create an object that mimics the structure expected by the rest of the code
                resolve({
                  uri: reader.result,
                  file: file // Store the actual file for later upload
                });
              };
              reader.readAsDataURL(file);
            } else {
              resolve(null);
            }
          };
        });
        
        // Trigger the file input click
        input.click();
        
        // Wait for file selection
        const result = await fileSelected;
        if (result) {
          setGroupIcon(result);
        }
      } else {
        // Mobile image picker
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'You need to grant access to your photos to upload a group icon.');
          return;
        }
        
        const pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        
        if (!pickerResult.canceled) {
          setGroupIcon(pickerResult.assets[0]);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setError('Failed to select image. Please try again.');
    }
  };

  const uploadGroupIcon = async () => {
    if (!groupIcon) return null;
    
    try {
      const timestamp = new Date().getTime();
      const storageRef = ref(storage, `group_icons/${auth.currentUser.uid}_${timestamp}`);
      
      let blob;
      
      if (isWeb) {
        // For web, we already have the file object
        blob = groupIcon.file;
      } else {
        // For mobile, we need to fetch the file and create a blob
        const response = await fetch(groupIcon.uri);
        blob = await response.blob();
      }
      
      // Upload the blob
      await uploadBytes(storageRef, blob);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading group icon:', error);
      throw new Error('Failed to upload group icon');
    }
  };

  const createCommunity = async () => {
    if (!communityName.trim()) {
      setError('Please enter a community name');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Ensure CometChat is initialized and user is logged in
      if (isWeb) {
        try {
          // Check if user is logged in to CometChat
          const loggedInUser = await CometChat.getLoggedinUser();
          if (!loggedInUser) {
            console.log("No user logged in to CometChat, attempting login");
            
            // Get current Firebase user
            const currentUser = auth.currentUser;
            if (!currentUser) {
              throw new Error("No Firebase user found");
            }
            
            // Login to CometChat
            await CometChat.login(currentUser.uid.toLowerCase(), COMETCHAT_CONSTANTS.AUTH_KEY);
            console.log("CometChat login successful");
          }
        } catch (loginError) {
          console.error("CometChat login error:", loginError);
          setError("There was an issue connecting to the chat service. Community creation may be limited.");
          // We'll still try to create the community
        }
      }
      
      // Upload group icon if selected
      let iconUrl = null;
      if (groupIcon) {
        iconUrl = await uploadGroupIcon();
      }
      
      // Create the group in CometChat
      const group = new CometChat.Group(
        `group_${Date.now()}`,
        communityName,
        CometChat.GROUP_TYPE.PUBLIC,
        ''
      );
      
      if (description) {
        group.setDescription(description);
      }
      
      if (iconUrl) {
        group.setIcon(iconUrl);
      }
      
      const createdGroup = await CometChat.createGroup(group);
      console.log('Group created successfully:', createdGroup);
      
      // Show success message
      if (isWeb) {
        setError('');
        // You could use a toast or modal here instead
        alert('Community created successfully!');
      } else {
        Alert.alert(
          'Success',
          'Community created successfully!',
          [{ text: 'OK', onPress: () => navigation.navigate('Community') }]
        );
      }
      
      // Navigate back to Community screen
      navigation.navigate('Community');
    } catch (error) {
      console.error('Error creating community:', error);
      
      if (isWeb) {
        setError(`Failed to create community: ${error.message || 'Unknown error'}`);
      } else {
        Alert.alert('Error', 'Failed to create community. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderErrorMessage = () => {
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView 
        style={[styles.scrollView, isWeb && styles.webScrollView]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.formContainer, isWeb && styles.webFormContainer]}>
          {renderErrorMessage()}
          
          <Text 
            style={styles.title}
            accessible={true}
            accessibilityRole="header"
          >
            Create a New Community
          </Text>
          
          <TouchableOpacity 
            style={[styles.iconPicker, isWeb && styles.webIconPicker]}
            onPress={pickImage}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Select community icon"
            accessibilityHint="Opens image picker to select a community icon"
          >
            {groupIcon ? (
              <Image 
                source={{ uri: groupIcon.uri }}
                style={styles.groupIconPreview}
                accessible={true}
                accessibilityRole="image"
                accessibilityLabel="Selected community icon"
              />
            ) : (
              <View style={styles.iconPlaceholder}>
                <Text style={styles.iconPlaceholderText}>Add Icon</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.inputContainer}>
            <Text 
              style={styles.inputLabel}
              accessible={true}
              accessibilityRole="text"
            >
              Community Name *
            </Text>
            <TextInput
              style={[styles.input, isWeb && styles.webInput]}
              value={communityName}
              onChangeText={setCommunityName}
              placeholder="Enter community name"
              placeholderTextColor="#999"
              accessible={true}
              accessibilityLabel="Community name input"
              accessibilityHint="Enter the name for your new community"
              maxLength={50}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text 
              style={styles.inputLabel}
              accessible={true}
              accessibilityRole="text"
            >
              Description
            </Text>
            <TextInput
              style={[styles.textArea, isWeb && styles.webTextArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what your community is about"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessible={true}
              accessibilityLabel="Community description input"
              accessibilityHint="Enter a description for your community"
              maxLength={200}
            />
          </View>
          
          <TouchableOpacity
            style={[
              styles.createButton,
              isWeb && styles.webCreateButton,
              loading && styles.disabledButton
            ]}
            onPress={createCommunity}
            disabled={loading}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Create community button"
            accessibilityHint="Creates a new community with the provided information"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.createButtonText}>Create Community</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  webScrollView: {
    maxWidth: 600,
    marginHorizontal: 'auto',
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  webFormContainer: {
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    padding: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#24269B',
    marginBottom: 20,
    textAlign: 'center',
  },
  iconPicker: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  webIconPicker: {
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#D0D0D0',
    },
  },
  groupIconPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  iconPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPlaceholderText: {
    color: '#666',
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  webInput: {
    outlineColor: '#24269B',
    transition: 'border-color 0.2s ease',
    ':focus': {
      borderColor: '#24269B',
    },
  },
  textArea: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 100,
  },
  webTextArea: {
    outlineColor: '#24269B',
    transition: 'border-color 0.2s ease',
    ':focus': {
      borderColor: '#24269B',
    },
  },
  createButton: {
    backgroundColor: '#24269B',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  webCreateButton: {
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    ':hover': {
      backgroundColor: '#1a1c7a',
    },
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#A0A0A0',
    opacity: 0.7,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
  },
  webProfileButton: {
    cursor: 'pointer',
  },
  profileImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  profileText: {
    fontSize: 14,
    color: '#333',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
  },
});

export default CreateCommunityScreen; 