import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Pressable,
  useWindowDimensions,
  KeyboardAvoidingView,
} from 'react-native';

// Conditional import for CometChat
const isWeb = Platform.OS === 'web';
let CometChat;
if (isWeb) {
  CometChat = require('@cometchat-pro/chat').CometChat;
} else {
  CometChat = require('@cometchat-pro/react-native-chat').CometChat;
}

import { auth, db, storage } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const CreateCommunityScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [groupIcon, setGroupIcon] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  
  // Responsive design hooks
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;
  const nameInputRef = useRef(null);
  const descriptionInputRef = useRef(null);
  const createButtonRef = useRef(null);
  
  // Web-specific state management
  const [hoveredButton, setHoveredButton] = useState(null);
  const [focusedInput, setFocusedInput] = useState(null);
  
  // Calculate responsive styles based on platform and screen size
  const responsiveStyles = {
    container: {
      flex: 1,
      backgroundColor: '#fff',
      ...(isWeb && {
        maxWidth: isMobile ? '100%' : '800px',
        marginHorizontal: isMobile ? 0 : 'auto',
        height: '100%',
      }),
    },
    content: {
      padding: isMobile ? 20 : 30,
      ...(isWeb && !isMobile && {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }),
    },
    input: {
      borderWidth: 1,
      borderColor: '#24269B',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      fontSize: 16,
      ...(isWeb && {
        width: isMobile ? '100%' : '500px',
        outlineColor: focusedInput === 'name' ? '#24269B' : undefined,
      }),
    },
    descriptionInput: {
      height: 100,
      textAlignVertical: 'top',
      ...(isWeb && {
        outlineColor: focusedInput === 'description' ? '#24269B' : undefined,
      }),
    },
    createButton: {
      backgroundColor: hoveredButton === 'create' ? '#2F3190' : '#24269B',
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 20,
      ...(isWeb && {
        width: isMobile ? '100%' : '500px',
        cursor: !name.trim() || loading ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.2s ease',
      }),
    }
  };

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
          style={styles.profileButton}
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

  // Add accessibility detection
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

  // Add screen reader announcement for web and native
  useEffect(() => {
    announceToScreenReader('Create Community Screen');
  }, []);

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

  // Add keyboard navigation handler
  const handleKeyPress = useCallback((e, onPress) => {
    if (isWeb) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPress();
      }
    }
  }, []);

  // Update image picker for web compatibility
  const pickImage = async () => {
    try {
      if (isWeb) {
        // Create a file input element for web
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        // Create a promise to handle the file selection
        const fileSelected = new Promise((resolve) => {
          input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (event) => {
                resolve(event.target.result);
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
        const imageUri = await fileSelected;
        if (imageUri) {
          setGroupIcon(imageUri);
        }
      } else {
        // Use expo-image-picker for native
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 1,
        });

        if (!result.canceled) {
          setGroupIcon(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Blob handling for firebase upload
  const getBlobFromUri = async (uri) => {
    try {
      // Handle different URI types
      if (isWeb) {
        if (uri.startsWith('data:')) {
          // Handle base64 data URI (web)
          const response = await fetch(uri);
          return await response.blob();
        } else if (uri.startsWith('blob:')) {
          // Handle blob URI (web)
          const response = await fetch(uri);
          return await response.blob();
        } else {
          // Handle other web URIs
          const response = await fetch(uri);
          return await response.blob();
        }
      } else {
        // Handle local file URI (native)
        const response = await fetch(uri);
        return await response.blob();
      }
    } catch (error) {
      console.error('Error converting image to blob:', error);
      throw error;
    }
  };

  // Update createCommunity for web compatibility
  const createCommunity = async () => {
    if (!name.trim()) {
      if (isWeb) {
        alert('Please enter a community name');
      } else {
        Alert.alert('Error', 'Please enter a community name');
      }
      return;
    }

    try {
      setLoading(true);
      announceToScreenReader('Creating your community, please wait');

      let iconUrl = null;
      if (groupIcon) {
        try {
          // Get blob from image using our helper
          const blob = await getBlobFromUri(groupIcon);
          
          // Upload to Firebase Storage
          const imageRef = ref(storage, `groupIcons/${Date.now()}.jpg`);
          await uploadBytes(imageRef, blob);
          iconUrl = await getDownloadURL(imageRef);
          console.log('Image uploaded to Firebase:', iconUrl);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          // Continue without image if upload fails
        }
      }

      // Create the group - always set as PUBLIC
      const groupId = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      const group = new CometChat.Group(
        groupId,
        name,
        CometChat.GROUP_TYPE.PUBLIC, // Always public
        ''
      );

      if (description) {
        group.setDescription(description);
      }

      if (iconUrl) {
        group.setIcon(iconUrl);
      }

      // Create the group
      const createdGroup = await CometChat.createGroup(group);
      console.log('Group created successfully:', createdGroup);

      // Use platform appropriate alerts
      if (isWeb) {
        announceToScreenReader('Community created successfully!');
        // For web, navigate immediately after a short delay
        setTimeout(() => {
          navigation.replace('GroupChat', {
            uid: createdGroup.guid,
            name: createdGroup.name
          });
        }, 500);
      } else {
        // For native, use Alert
        Alert.alert(
          'Success',
          'Community created successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.replace('GroupChat', {
                uid: createdGroup.guid,
                name: createdGroup.name
              })
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error creating group:', error);
      const errorMessage = 'Failed to create community: ' + (error.message || error);
      
      if (isWeb) {
        announceToScreenReader('Error: ' + errorMessage);
        alert('Error: ' + errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      enabled={!isWeb}
    >
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
        style={responsiveStyles.container}
        contentContainerStyle={responsiveStyles.content}
        accessible={true}
        accessibilityRole="scrollView"
        accessibilityLabel="Create Community form"
      >
        <View style={isWeb && !isMobile ? { width: '500px' } : {}}>
          {!isMobile && isWeb && (
            <Text 
              style={styles.pageTitle}
              role="heading"
              aria-level={1}
            >
              Create Community
            </Text>
          )}
          
          <Pressable 
            style={[
              styles.iconPicker,
              isWeb && styles.webIconPicker,
              isWeb && hoveredButton === 'picker' && styles.webIconPickerHover
            ]}
            onPress={pickImage}
            onMouseEnter={isWeb ? () => setHoveredButton('picker') : undefined}
            onMouseLeave={isWeb ? () => setHoveredButton(null) : undefined}
            onKeyPress={(e) => handleKeyPress(e, pickImage)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={groupIcon ? "Change community icon" : "Add community icon"}
            accessibilityHint="Opens image picker to select a community icon"
            role={isWeb ? "button" : undefined}
            tabIndex={isWeb ? 0 : undefined}
          >
            {groupIcon ? (
              <Image 
                source={{ uri: groupIcon }}
                style={[styles.groupIcon, isWeb && styles.webGroupIcon]}
                accessible={true}
                accessibilityRole="image"
                accessibilityLabel="Selected community icon"
              />
            ) : (
              <View 
                style={[styles.iconPlaceholder, isWeb && styles.webIconPlaceholder]}
                accessible={true}
                accessibilityRole="image"
                accessibilityLabel="No icon selected"
              >
                <Text style={[styles.iconPlaceholderText, isWeb && styles.webIconPlaceholderText]}>
                  {isMobile ? "Add Icon" : "Click to Add Icon"}
                </Text>
              </View>
            )}
          </Pressable>

          <TextInput
            ref={nameInputRef}
            style={[responsiveStyles.input, isWeb && styles.webInput]}
            placeholder="Community Name"
            value={name}
            onChangeText={setName}
            maxLength={50}
            onFocus={() => setFocusedInput('name')}
            onBlur={() => setFocusedInput(null)}
            accessible={true}
            accessibilityLabel="Community name input"
            accessibilityHint="Enter the name for your community"
            accessibilityRole="text"
            returnKeyType="next"
            importantForAccessibility="yes"
            aria-required={isWeb ? "true" : undefined}
            onKeyPress={isWeb ? (e) => {
              if (e.key === 'Enter') {
                descriptionInputRef.current?.focus();
              }
            } : undefined}
          />

          <TextInput
            ref={descriptionInputRef}
            style={[
              responsiveStyles.input, 
              responsiveStyles.descriptionInput, 
              isWeb && styles.webInput
            ]}
            placeholder="Description (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={200}
            onFocus={() => setFocusedInput('description')}
            onBlur={() => setFocusedInput(null)}
            accessible={true}
            accessibilityLabel="Community description input"
            accessibilityHint="Enter an optional description for your community"
            accessibilityRole="text"
            importantForAccessibility="yes"
            aria-required={isWeb ? "false" : undefined}
          />

          <Pressable
            ref={createButtonRef}
            style={[
              responsiveStyles.createButton,
              (!name.trim() || loading) && styles.disabledButton
            ]}
            onPress={createCommunity}
            onMouseEnter={() => !loading && name.trim() && setHoveredButton('create')}
            onMouseLeave={() => setHoveredButton(null)}
            onKeyPress={(e) => handleKeyPress(e, createCommunity)}
            disabled={!name.trim() || loading}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={loading ? "Creating community" : "Create community"}
            accessibilityHint={
              !name.trim() 
                ? "Button disabled. Enter a community name first" 
                : "Creates your community with the provided information"
            }
            accessibilityState={{
              disabled: !name.trim() || loading,
              busy: loading
            }}
            role={isWeb ? "button" : undefined}
            tabIndex={isWeb ? 0 : undefined}
          >
            {loading ? (
              <ActivityIndicator 
                color="#fff"
                accessibilityLabel="Loading"
                accessibilityRole="progressbar"
              />
            ) : (
              <Text style={[styles.createButtonText, isWeb && styles.webCreateButtonText]}>
                Create Community
              </Text>
            )}
          </Pressable>
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
  content: {
    padding: 20,
  },
  iconPicker: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  groupIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#24269B',
  },
  iconPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8E8FF',
    borderWidth: 2,
    borderColor: '#24269B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPlaceholderText: {
    color: '#24269B',
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#24269B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: '#24269B',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#999',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  profileButton: {
    alignItems: 'center',
    marginRight: 15,
  },
  profileImage: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    borderWidth: 2,
    borderColor: '#24269B',
  },
  profileText: {
    fontSize: 12,
    color: '#24269B',
    marginTop: 2,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#24269B',
    marginBottom: 20,
    textAlign: 'center',
  },
  webIconPicker: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginTop: 20,
  },
  webIconPickerHover: {
    transform: [{ scale: 1.05 }],
    opacity: 0.9,
  },
  webGroupIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#24269B',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  },
  webIconPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EAEAFF',
    borderWidth: 3,
    borderColor: '#24269B',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  },
  webIconPlaceholderText: {
    color: '#24269B',
    fontSize: 16,
    fontWeight: '500',
  },
  webInput: {
    borderWidth: 2,
    fontSize: 16,
    marginBottom: 20,
    padding: 14,
    borderRadius: 8,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  },
  webCreateButtonText: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default CreateCommunityScreen; 