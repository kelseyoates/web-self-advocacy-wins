import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image,
  AccessibilityInfo,
  ScrollView,
  Platform 
} from 'react-native';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAccessibility } from '../context/AccessibilityContext';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const FindScreen = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const { showHelpers } = useAccessibility();
  const isWeb = Platform.OS === 'web';

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

  // Set up header with profile button
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

  return (
    <ScrollView 
      style={[styles.scrollContainer, isWeb && styles.webScrollContainer]}
      contentContainerStyle={[styles.contentContainer, isWeb && styles.webContentContainer]}
      accessible={true}
      accessibilityLabel="Find Screen"
      accessibilityRole="menu"
    >
      <View style={[styles.container, isWeb && styles.webContainer]}>
        {showHelpers && (
          <View 
            style={[styles.helperSection, isWeb && styles.webHelperSection]}
            accessible={true}
            accessibilityRole="header"
            accessibilityLabel={`Welcome to Find! Here's what you can do: 
              Find a Friend is free! Connect with other self-advocates by tapping the Find a Friend button. 
              Find a Date requires an upgrade to access dating features. Use this feature by tapping the Find a Date button, which is below the Find a Friend button.`}
          >
            <View style={[styles.helperHeader, isWeb && styles.webHelperHeader]}>
              <MaterialCommunityIcons 
                name="information" 
                size={24} 
                color="#24269B"
                style={styles.infoIcon}
                importantForAccessibility="no"
              />
            </View>
            <View style={[styles.helperContent, isWeb && styles.webHelperContent]}>
              <Image 
                source={require('../../assets/ezra-usercards.png')}
                style={[styles.helperImage, isWeb && styles.webHelperImage]}
                importantForAccessibility="no"
              />
              <Text style={[styles.helperTitle, isWeb && styles.webHelperTitle]}>Welcome to Find!</Text>
              <View style={styles.helperTextContainer}>
                <Text style={[styles.helperText, isWeb && styles.webHelperText]}>
                  • Find a Friend is free! Connect with other self-advocates
                </Text>
                <Text style={[styles.helperText, isWeb && styles.webHelperText]}>
                  • Find a Date requires an upgrade to access dating features
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.buttonContainer, isWeb && styles.webButtonContainer]}>
          <View style={[styles.buttonShadow, isWeb && styles.webButtonShadow]} />
          <TouchableOpacity 
            style={[styles.findFriendButton, isWeb && styles.webFindFriendButton]} 
            onPress={() => {
              announceToScreenReader('Opening Find a Friend screen');
              navigation.navigate('FindYourFriends');
            }}
            accessible={true}
            accessibilityLabel="Find a Friend"
            accessibilityHint="Navigate to screen to search for friends"
            accessibilityRole="button"
          >
            <View 
              style={[styles.buttonContent, isWeb && styles.webButtonContent]}
              accessible={true}
              accessibilityElementsHidden={true}
              importantForAccessibility="no-hide-descendants"
            >
              <Text style={[styles.buttonText, isWeb && styles.webButtonText]}>Find a Friend</Text>
              <Image 
                source={require('../../assets/friends-icon.png')} 
                style={[styles.buttonIcon, isWeb && styles.webButtonIcon]}
                accessible={true}
                accessibilityLabel="three friends together in a group"
                accessibilityRole="image"
              />
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.buttonContainer, isWeb && styles.webButtonContainer]}>
          <View style={[styles.buttonShadow, isWeb && styles.webButtonShadow]} />
          <TouchableOpacity 
            style={[styles.findDateButton, isWeb && styles.webFindDateButton]} 
            onPress={() => {
              announceToScreenReader('Opening Find a Date screen');
              navigation.navigate('FindADate');
            }}
            accessible={true}
            accessibilityLabel="Find a Date"
            accessibilityHint="Navigate to screen to search for potential dates"
            accessibilityRole="button"
          >
            <View 
              style={[styles.buttonContent, isWeb && styles.webButtonContent]}
              accessible={true}
              accessibilityElementsHidden={true}
              importantForAccessibility="no-hide-descendants"
            >
              <Text style={[styles.buttonDateText, isWeb && styles.webButtonDateText]}>Find a Date</Text>
              <Image 
                source={require('../../assets/dating-icon.png')} 
                style={[styles.buttonIcon, isWeb && styles.webButtonIcon]}
                accessible={true}
                accessibilityLabel="two people chatting on their phones"
                accessibilityRole="image"
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flexGrow: 1,
    paddingVertical: 20,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  button: {
    backgroundColor: '#24269B',
    borderRadius: 5,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    height: 120,
    width: 300,
  },

  
  buttonDateText: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '600',
  },

  buttonIcon: {
    marginLeft: 2,
  },

  buttonContainer: {
    position: 'relative',
    marginHorizontal: 20,
    marginVertical: 10,
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

  findFriendButton: {
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
    height: 120,
    borderWidth: 1,
    borderColor: '#24269B',
  },

  findDateButton: {
    backgroundColor: '#F2C8E4',
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
    height: 120,
    borderWidth: 1,
    borderColor: '#24269B',
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },

  buttonIcon: {
    width: 90,
    height: 90,
    borderRadius: 15,
  },

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
  helperSection: {
    width: '100%',
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24269B',
    marginBottom: 20,
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
  helperContent: {
    alignItems: 'center',
    paddingTop: 0,
  },
  helperTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#24269B',
    marginBottom: 10,
    textAlign: 'center',
  },
  helperTextContainer: {
    width: '100%',
    paddingHorizontal: 10,
  },
  helperText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  helperImage: {
    width: 200,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 10,
  },

  webScrollContainer: {
    backgroundColor: '#f5f5f5',
  },
  webContentContainer: {
    maxWidth: 1200,
    marginHorizontal: 'auto',
    paddingTop: 40,
    paddingBottom: 60,
  },
  webContainer: {
    paddingHorizontal: 40,
  },
  webHelperSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    padding: 24,
    marginBottom: 40,
    maxWidth: 800,
    width: '100%',
    transition: 'transform 0.2s ease-in-out',
    cursor: 'default',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },
  },
  webHelperHeader: {
    marginBottom: 16,
  },
  webHelperContent: {
    alignItems: 'center',
  },
  webHelperImage: {
    width: '100%',
    maxWidth: 400,
    height: 'auto',
    marginBottom: 24,
    borderRadius: 8,
  },
  webHelperTitle: {
    fontSize: 28,
    marginBottom: 16,
    color: '#24269B',
  },
  webHelperText: {
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 8,
  },
  webButtonContainer: {
    width: '100%',
    maxWidth: 600,
    marginBottom: 24,
  },
  webButtonShadow: {
    boxShadow: '4px 4px 0px rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
  },
  webFindFriendButton: {
    backgroundColor: '#24269B',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    height: 140,
    transition: 'all 0.2s ease-in-out',
    cursor: 'pointer',
    ':hover': {
      transform: 'translateY(-2px)',
      backgroundColor: '#2F31B5',
    },
    ':active': {
      transform: 'translateY(1px)',
    },
    ':focus': {
      outline: '3px solid #4A4CB8',
      outlineOffset: 2,
    },
  },
  webFindDateButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    height: 140,
    transition: 'all 0.2s ease-in-out',
    cursor: 'pointer',
    ':hover': {
      transform: 'translateY(-2px)',
      backgroundColor: '#f8f8f8',
    },
    ':active': {
      transform: 'translateY(1px)',
    },
    ':focus': {
      outline: '3px solid #24269B',
      outlineOffset: 2,
    },
  },
  webButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
  },
  webButtonText: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '600',
  },
  webButtonDateText: {
    fontSize: 28,
    color: '#000000',
    fontWeight: '600',
  },
  webButtonIcon: {
    width: 48,
    height: 48,
    marginLeft: 16,
  },
});

export default FindScreen; 