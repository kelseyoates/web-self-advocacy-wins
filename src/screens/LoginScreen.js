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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import { CometChat } from '@cometchat-pro/react-native-chat';
import { COMETCHAT_CONSTANTS } from '../config/cometChatConfig';

const windowHeight = Dimensions.get('window').height;
const windowWidth = Dimensions.get('window').width;

// Detect if running on web
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

  const showAlert = (title, message) => {
    if (isWeb) {
      // For web, use a more web-friendly approach
      setErrorMsg(message);
      // You could also use a modal or toast component here
    } else {
      // For mobile, use Alert
      Alert.alert(title, message, [{ text: 'OK' }]);
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
        // Attempt CometChat login for both web and mobile
        await CometChat.login(uid, COMETCHAT_CONSTANTS.AUTH_KEY);
        console.log('CometChat login successful');
        cometChatSuccess = true;
      } catch (cometChatError) {
        console.error('CometChat login error:', cometChatError);
        
        if (isWeb) {
          // On web, show a warning but continue
          console.log('CometChat login failed on web, but continuing with app navigation');
          setErrorMsg('Login successful, but chat features might be limited. You can still use other app features.');
        } else {
          // On mobile, show an error alert
          showAlert('Login Error', 'Failed to connect to chat service. Please try again.');
          setIsLoading(false);
          return; // Stop the login process on mobile if CometChat fails
        }
      }
      
      // Navigate to main app screen
      navigation.navigate('Main');
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle specific Firebase auth errors
      let errorMessage = 'An error occurred during login. Please try again.';
      
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'Invalid email or password. Please try again.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed login attempts. Please try again later.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled. Please contact support.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
      }

      showAlert('Login Failed', errorMessage);
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
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            accessible={true}
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
              accessibilityElementsHidden={true}
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="email-outline" size={24} color="#000000" />
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
              accessibilityElementsHidden={true}
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="lock-outline" size={24} color="#000000" />
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
              accessibilityHint="Click to reset your password"
              accessibilityRole="link"
              disabled={isLoading}
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
              accessible={true}
              accessibilityLabel="Login button"
              accessibilityHint={isWeb ? "Click to log in" : "Double tap to log in"}
              accessibilityRole="button"
              disabled={isLoading}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.loginButtonText}>
                  {isLoading ? 'Logging in...' : 'Login'} 
                  {!isLoading && <MaterialCommunityIcons name="arrow-right" size={24} color="white" />}
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
    maxWidth: 500,
    marginHorizontal: 'auto',
    width: '100%',
    paddingTop: 40,
  },
  headerImage: {
    width: '100%',
    height: windowHeight * 0.2, // 20% of screen height
    marginBottom: 0,
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
    paddingHorizontal: 10,
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
    minHeight: 50,
    outlineColor: '#24269B',
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
  buttonText: {
    color: '#FFF',
    fontSize: 18,
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
    minHeight: 50,
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
    flexWrap: 'wrap',
    padding: 5,
  },
  buttonIcon: {
    width: 90,
    height: 90,
    borderRadius: 15,
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

export default LoginScreen;