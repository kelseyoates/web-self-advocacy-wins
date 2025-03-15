import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Text, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, Alert, AccessibilityInfo } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
// Conditional import based on platform
const CometChat = Platform.OS === 'web' 
  ? require('@cometchat-pro/chat').CometChat
  : require('@cometchat-pro/react-native-chat').CometChat;
import { COMETCHAT_CONSTANTS } from '../config/cometChatConfig';
import { Dimensions } from 'react-native';

const windowHeight = Dimensions.get('window').height;
const windowWidth = Dimensions.get('window').width;

// Detect if running on web
const isWeb = Platform.OS === 'web';

const SignUpScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Add screen reader detection
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

  const showAlert = (title, message, buttons) => {
    if (isWeb) {
      // For web, use a more web-friendly approach
      setErrorMsg(message);
      // You could also use a modal or toast component here
    } else {
      // For mobile, use Alert
      Alert.alert(title, message, buttons || [{ text: 'OK' }]);
    }
  };

  const handleUserNameChange = (text) => {
    setUserName(text.toLowerCase());
  };

  // Function to create CometChat user
  const createCometChatUser = async (uid, username) => {
    try {
      const user = new CometChat.User(uid);
      user.setName(username.toLowerCase());
      
      await CometChat.createUser(user, COMETCHAT_CONSTANTS.AUTH_KEY);
      console.log('CometChat user created successfully');
      
      // Login to CometChat
      if (isWeb) {
        // For web, ensure WebSocket is enabled
        await CometChat.enableWebSocket(true);
      }
      
      const loggedInUser = await CometChat.login(uid, COMETCHAT_CONSTANTS.AUTH_KEY);
      console.log('CometChat login successful:', loggedInUser);

      if (isWeb) {
        // Register for web push notifications if available
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.register('/cometchat-sw.js');
            console.log('Service worker registered:', registration);
            
            // Register the service worker with CometChat
            await CometChat.registerTokenForPushNotification(registration);
          } catch (error) {
            console.error('Service worker registration failed:', error);
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('CometChat user creation/login error:', error);
      
      // Handle specific CometChat errors
      if (error.code === 'ERR_UID_ALREADY_EXISTS') {
        // If user already exists, try to login directly
        try {
          if (isWeb) {
            await CometChat.enableWebSocket(true);
          }
          
          const loggedInUser = await CometChat.login(uid, COMETCHAT_CONSTANTS.AUTH_KEY);
          console.log('CometChat login successful after user exists error:', loggedInUser);
          
          if (isWeb) {
            // Register for web push notifications
            if ('serviceWorker' in navigator) {
              try {
                const registration = await navigator.serviceWorker.register('/cometchat-sw.js');
                await CometChat.registerTokenForPushNotification(registration);
              } catch (error) {
                console.error('Service worker registration failed:', error);
              }
            }
          }
          
          return true;
        } catch (loginError) {
          console.error('CometChat login error after user exists error:', loginError);
          if (isWeb) {
            // On web, show warning but allow continuing
            console.warn('CometChat login failed, but continuing with signup');
            return true;
          }
          return false;
        }
      }
      
      if (isWeb) {
        // On web, show warning but allow continuing
        console.warn('CometChat user creation failed, but continuing with signup');
        return true;
      }
      return false;
    }
  };

  const handleSignup = async () => {
    try {
      if (!userName.trim()) {
        announceToScreenReader('Please enter a username');
        showAlert('Error', 'Please enter a username');
        return;
      }

      setIsLoading(true);
      setErrorMsg('');
      announceToScreenReader('Creating your account');
      
      // Firebase Auth Signup
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const originalUid = userCredential.user.uid;
      const uid = originalUid.toLowerCase();

      // Create user document in Firestore with lowercase UID
      const userDoc = {
        uid: uid,
        originalUid: originalUid, // Store original UID if needed for reference
        email: email,
        username: userName.toLowerCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        profilePicture: null,
        bio: '',
        followers: [],
        following: [],
        posts: [],
      };

      // Use lowercase UID for Firestore document
      await setDoc(doc(db, 'users', uid), userDoc);
      console.log('Firestore user document created successfully');

      // CometChat Signup - Handle for both web and mobile
      let cometChatSuccess = false;
      
      try {
        cometChatSuccess = await createCometChatUser(uid, userName);
      } catch (cometChatError) {
        console.error('Error during CometChat setup:', cometChatError);
        // We'll continue even if CometChat fails, but log the error
      }
      
      if (!cometChatSuccess && isWeb) {
        console.log('CometChat setup failed on web, but continuing with app navigation');
        // Show a warning to the user that chat features might be limited
        setErrorMsg('Your account was created, but chat features might be limited. You can still use other app features.');
      }
      
      // Navigate to main app screen regardless of CometChat success
      // This ensures users can still use the app even if chat is not working
      navigation.navigate('Main');
      
      announceToScreenReader('Account created successfully');
    } catch (error) {
      console.error('Signup error details:', error);
      
      // Better error messages for users
      if (error.code === 'auth/email-already-in-use') {
        announceToScreenReader('Email already registered');
        showAlert(
          'Email Already Registered',
          'This email address is already registered. Please use a different email or try logging in.',
          [
            { text: 'OK', onPress: () => console.log('OK Pressed') },
            { 
              text: 'Go to Login', 
              onPress: () => navigation.navigate('Login'),
              style: 'default'
            }
          ]
        );
      } else if (error.code === 'auth/weak-password') {
        announceToScreenReader('Password is too weak');
        showAlert('Weak Password', 'Please use a stronger password (at least 6 characters)');
      } else if (error.code === 'auth/invalid-email') {
        announceToScreenReader('Invalid email format');
        showAlert('Invalid Email', 'Please enter a valid email address');
      } else {
        announceToScreenReader('Sign up failed');
        showAlert('Signup Failed', error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContentContainer,
          isWeb && styles.webScrollContentContainer
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        accessible={true}
        accessibilityLabel="Sign up form"
      >
        <View style={[styles.content, isWeb && styles.webContent]}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={[styles.headerImage, isWeb && styles.webHeaderImage]}
            resizeMode="contain"
            accessible={true}
            accessibilityLabel="App logo"
            accessibilityRole="image"
          />

          <Text 
            style={styles.title}
            accessibilityRole="header"
          >
            Create Account
          </Text>
          
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
          
          <View style={[styles.formContainer, isWeb && styles.webFormContainer]}>
            <View 
              style={styles.labelContainer}
              accessible={true}
              accessibilityRole="text"
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons 
                  name="email-outline" 
                  size={24} 
                  color="black"
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no"
                />
              </View>
              <Text style={styles.formLabel}>Email:</Text>
            </View>
            <TextInput
              style={[styles.input, isWeb && styles.webInput]}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                announceToScreenReader(`Email set to ${text}`);
              }}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              accessible={true}
              accessibilityLabel="Email input"
              accessibilityHint="Enter your email address"
              accessibilityRole="text"
            />

            <View 
              style={styles.labelContainer}
              accessible={true}
              accessibilityRole="text"
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons 
                  name="account-outline" 
                  size={24} 
                  color="black"
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no"
                />
              </View>
              <Text style={styles.formLabel}>Username:</Text>
            </View>
            <TextInput
              style={[styles.input, isWeb && styles.webInput]}
              value={userName}
              onChangeText={(text) => {
                handleUserNameChange(text);
                announceToScreenReader(`Username set to ${text}`);
              }}
              placeholder="choose a username (lowercase)"
              autoCapitalize="none"
              autoCorrect={false}
              accessible={true}
              accessibilityLabel="Username input"
              accessibilityHint="Choose a username in lowercase"
              accessibilityRole="text"
            />

            <View 
              style={styles.labelContainer}
              accessible={true}
              accessibilityRole="text"
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons 
                  name="lock-outline" 
                  size={24} 
                  color="black"
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no"
                />
              </View>
              <Text style={styles.formLabel}>Password:</Text>
            </View>
            <TextInput
              style={[styles.input, isWeb && styles.webInput]}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                announceToScreenReader("Password field updated");
              }}
              placeholder="Create a password"
              secureTextEntry
              accessible={true}
              accessibilityLabel="Password input"
              accessibilityHint="Create your password"
              accessibilityRole="text"
            />
          </View>

          <View style={[styles.buttonContainer, isWeb && styles.webButtonContainer]}>
            {!isWeb && <View style={styles.buttonShadow} />}
            <TouchableOpacity 
              style={[
                styles.signupButton, 
                isWeb && styles.webSignupButton,
                isLoading && styles.disabledButton
              ]} 
              onPress={handleSignup}
              accessible={true}
              accessibilityLabel="Sign up button"
              accessibilityHint={isWeb ? "Click to create your account" : "Double tap to create your account"}
              accessibilityRole="button"
              disabled={isLoading}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.signupButtonText}>
                  {isLoading ? 'Creating Account...' : 'Sign Up'} 
                  {!isLoading && (
                    <MaterialCommunityIcons 
                      name="arrow-right" 
                      size={24} 
                      color="white"
                      accessibilityElementsHidden={true}
                      importantForAccessibility="no"
                    />
                  )}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View 
            style={styles.footerContainer}
            accessible={true}
            accessibilityRole="text"
          >
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity 
              onPress={() => {
                announceToScreenReader("Going to login screen");
                navigation.navigate('Login');
              }}
              accessible={true}
              accessibilityLabel="Go to login"
              accessibilityHint={isWeb ? "Click to go to login screen" : "Double tap to go to login screen"}
              accessibilityRole="link"
              disabled={isLoading}
            >
              <Text style={styles.footerLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    minHeight: windowHeight,
  },
  webScrollContentContainer: {
    minHeight: '100vh',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webContent: {
    maxWidth: 500,
    marginHorizontal: 'auto',
    width: '100%',
    paddingTop: 40,
  },
  headerImage: {
    width: '100%',
    height: windowHeight * 0.2, // 20% of screen height
    marginBottom: 20,
  },
  webHeaderImage: {
    height: 150,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    marginBottom: 20,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    marginTop: 0,
  },
  webFormContainer: {
    maxWidth: 400,
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginTop: 30,
  },
  iconContainer: {
    width: 24,
    height: 24,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formLabel: {
    fontSize: 20,
    lineHeight: 24,
  },
  input: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 60,
  },
  webInput: {
    minHeight: 50,
    outlineColor: '#24269B',
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 20,
    textAlign: 'center',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 16,
  },
  footerLink: {
    fontSize: 16,
    color: '#24269B',
  },
  bottomPadding: {
    height: 100,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
  },
  buttonContainer: {
    position: 'relative',
    marginVertical: 40,
  },
  webButtonContainer: {
    maxWidth: 400,
    width: '90%',
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
  signupButton: {
    backgroundColor: '#24269B',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 5,
    width: 300,
    height: 60,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  webSignupButton: {
    width: '100%',
    minHeight: 50,
    height: 'auto',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    ':hover': {
      backgroundColor: '#1a1c7a',
    },
  },
  disabledButton: {
    backgroundColor: '#9999cc',
    borderColor: '#9999cc',
  },
  buttonContent: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonIcon: {
    width: 90,
    height: 90,
    borderRadius: 15,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
    width: '100%',
    maxWidth: 400,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
  },
});

export default SignUpScreen;