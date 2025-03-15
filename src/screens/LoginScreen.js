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

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);

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

  const handleLogin = async () => {
    try {
      announceToScreenReader('Logging in');
      // Firebase Login
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const originalUid = userCredential.user.uid;
      const uid = originalUid.toLowerCase();
      console.log('Firebase login successful:', uid);

      // CometChat Login
      try {
        await CometChat.login(uid, COMETCHAT_CONSTANTS.AUTH_KEY);
        console.log('CometChat login successful');
        
        // Navigate to main app screen
        navigation.navigate('Main');
      } catch (cometChatError) {
        console.error('CometChat login error:', cometChatError);
        Alert.alert('Login Error', 'Failed to connect to chat service. Please try again.');
      }
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

      Alert.alert(
        'Login Failed',
        errorMessage,
        [{ text: 'OK' }]
      );

      // Announce error to screen reader
      announceToScreenReader(errorMessage);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(
        'Email Required',
        'Please enter your email address first.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        'Password Reset Email Sent',
        'Please check your email for instructions to reset your password.',
        [{ text: 'OK' }]
      );
      announceToScreenReader('Password reset email sent');
    } catch (error) {
      console.error('Password reset error:', error);
      Alert.alert(
        'Error',
        'Failed to send password reset email. Please verify your email address.',
        [{ text: 'OK' }]
      );
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
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
        accessible={true}
        accessibilityLabel="Login form"
      >
        <View style={styles.content}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.headerImage}
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
          
          <View style={styles.formContainer}>
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
              style={styles.input}
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
              style={styles.input}
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
              accessibilityHint="Double tap to reset your password"
              accessibilityRole="link"
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonContainer}>
            <View style={styles.buttonShadow} />
            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={handleLogin}
              accessible={true}
              accessibilityLabel="Login button"
              accessibilityHint="Double tap to log in"
              accessibilityRole="button"
            >
              <View style={styles.buttonContent}>
                <Text style={styles.loginButtonText}>
                  Login <MaterialCommunityIcons name="arrow-right" size={24} color="white" />
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
              accessibilityHint="Double tap to go to sign up screen"
              accessibilityRole="link"
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
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerImage: {
    width: '100%',
    height: windowHeight * 0.2, // 20% of screen height
    marginBottom: 0,
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
});

export default LoginScreen;