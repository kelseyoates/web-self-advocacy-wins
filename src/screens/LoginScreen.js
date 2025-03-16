import React, { useState, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  Image, 
  Alert,
  Dimensions,
  AccessibilityInfo 
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
// Conditional import based on platform
const CometChat = Platform.OS === 'web' 
  ? require('@cometchat-pro/chat').CometChat
  : require('@cometchat-pro/react-native-chat').CometChat;
import { COMETCHAT_CONSTANTS } from '../config/cometChatConfig';

const windowHeight = Dimensions.get('window').height;
const isWeb = Platform.OS === 'web';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
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

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      announceToScreenReader('Logging in');
      
      // Firebase Login
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const originalUid = userCredential.user.uid;
      const uid = originalUid.toLowerCase();
      console.log('Firebase login successful:', uid);

      // CometChat Login - Handle for both web and mobile
      let cometChatSuccess = false;
      
      try {
        // Initialize CometChat if needed
        if (!CometChat.isInitialized()) {
          await CometChat.init(COMETCHAT_CONSTANTS.APP_ID);
        }
        
        // Login to CometChat
        const user = await CometChat.login(uid, COMETCHAT_CONSTANTS.AUTH_KEY);
        console.log('CometChat login successful:', user);
        cometChatSuccess = true;

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
      } catch (cometChatError) {
        console.error('CometChat login error:', cometChatError);
        
        if (isWeb) {
          // On web, show warning but allow continuing
          setErrorMsg('Chat features might be limited. Please try refreshing the page.');
        } else {
          // On mobile, block login
          showAlert('Login Error', 'Failed to connect to chat service. Please try again.');
          setIsLoading(false);
          return;
        }
      }

      // Navigate to main app screen
      navigation.navigate('Main');
      
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Failed to log in. Please try again.';
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many login attempts. Please try again later.';
      }
      
      showAlert('Login Error', errorMessage);
      announceToScreenReader(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showAlert('Email Required', 'Please enter your email address first.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      showAlert(
        'Password Reset Email Sent',
        'Please check your email for instructions to reset your password.'
      );
      announceToScreenReader('Password reset email sent');
    } catch (error) {
      console.error('Password reset error:', error);
      showAlert(
        'Error',
        'Failed to send password reset email. Please verify your email address.'
      );
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
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
        accessibilityLabel="Login form"
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
            Login
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
                  color="#000000" 
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no"
                />
              </View>
              <Text style={styles.formLabel}>Email:</Text>
            </View>
            <TextInput
              style={[styles.input, isWeb && styles.webInput]}
              value={email}
              onChangeText={setEmail}
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
                  name="lock-outline" 
                  size={24} 
                  color="#000000" 
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no"
                />
              </View>
              <Text style={styles.formLabel}>Password:</Text>
            </View>
            <TextInput
              style={[styles.input, isWeb && styles.webInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              accessible={true}
              accessibilityLabel="Password input"
              accessibilityHint="Enter your password"
              accessibilityRole="text"
            />

            <TouchableOpacity 
              onPress={handleForgotPassword}
              style={styles.forgotPasswordContainer}
              accessible={true}
              accessibilityLabel="Forgot password"
              accessibilityHint={isWeb ? "Click to reset your password" : "Double tap to reset your password"}
              accessibilityRole="link"
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.buttonContainer, isWeb && styles.webButtonContainer]}>
            {!isWeb && <View style={styles.buttonShadow} />}
            <TouchableOpacity 
              style={[
                styles.loginButton, 
                isWeb && styles.webLoginButton,
                isLoading && styles.disabledButton
              ]} 
              onPress={handleLogin}
              disabled={isLoading}
              accessible={true}
              accessibilityLabel="Login button"
              accessibilityHint={isWeb ? "Click to log in" : "Double tap to log in"}
              accessibilityRole="button"
            >
              <View style={styles.buttonContent}>
                <Text style={styles.loginButtonText}>
                  {isLoading ? 'Logging in...' : 'Login'} 
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
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity 
              onPress={() => {
                announceToScreenReader('Going to sign up screen');
                navigation.navigate('SignUp');
              }}
              accessible={true}
              accessibilityLabel="Sign up"
              accessibilityHint={isWeb ? "Click to go to sign up screen" : "Double tap to go to sign up screen"}
              accessibilityRole="link"
              disabled={isLoading}
            >
              <Text style={styles.footerLink}>Sign up</Text>
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
    maxWidth: 480,
    marginHorizontal: 'auto',
    width: '100%',
  },
  headerImage: {
    width: '100%',
    height: windowHeight * 0.2,
    marginBottom: 0,
  },
  webHeaderImage: {
    height: 120,
    objectFit: 'contain',
  },
  title: {
    fontSize: 32,
    marginBottom: 20,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    marginTop: 0,
    paddingHorizontal: 10,
  },
  webFormContainer: {
    maxWidth: 400,
    marginHorizontal: 'auto',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginTop: 30,
    flexWrap: 'wrap',
    minHeight: 30,
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
    flexShrink: 1,
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
    outlineColor: '#24269B',
    cursor: 'text',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 20,
    textAlign: 'center',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    flexWrap: 'wrap',
    paddingHorizontal: 10,
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
  buttonContainer: {
    position: 'relative',
    marginVertical: 10,
    width: '90%',
  },
  webButtonContainer: {
    maxWidth: 400,
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
  loginButton: {
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
    width: '100%',
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#24269B',
    flexWrap: 'wrap',
  },
  webLoginButton: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      backgroundColor: '#1a1b6e',
    },
  },
  disabledButton: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  buttonContent: {
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    padding: 5,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 10,
    paddingVertical: 5,
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  forgotPasswordText: {
    color: '#24269B',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
    width: '100%',
    maxWidth: 400,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
});

export default LoginScreen;