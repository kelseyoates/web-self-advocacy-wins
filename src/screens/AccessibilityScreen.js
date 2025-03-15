import React from 'react';
import { View, Text, StyleSheet, Switch, Platform } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';

const isWeb = Platform.OS === 'web';

const AccessibilityScreen = () => {
  const { showHelpers, toggleHelpers } = useAccessibility();

  return (
    <View style={[styles.container, isWeb && styles.webContainer]}>
      <View style={[styles.contentWrapper, isWeb && styles.webContentWrapper]}>
        <Text style={[styles.pageTitle, isWeb && styles.webPageTitle]}>
          Accessibility Settings
        </Text>
        
        <View style={[styles.card, isWeb && styles.webCard]}>
          <View style={styles.settingContainer}>
            <View style={styles.textSection}>
              <Text style={[styles.settingTitle, isWeb && styles.webSettingTitle]}>
                Show Helper Sections
              </Text>
              <Text style={[styles.settingDescription, isWeb && styles.webSettingDescription]}>
                Helper sections show you how to use different features in the app. 
                Turn this off once you're comfortable with the app.
              </Text>
            </View>
            <View style={styles.switchContainer}>
              <Switch
                value={showHelpers}
                onValueChange={toggleHelpers}
                trackColor={{ false: "#767577", true: "#24269B" }}
                thumbColor={showHelpers ? "#f4f3f4" : "#f4f3f4"}
                ios_backgroundColor="#3e3e3e"
                accessible={true}
                accessibilityLabel="Toggle helper sections"
                accessibilityHint={`Double tap to ${showHelpers ? 'hide' : 'show'} helper sections`}
              />
            </View>
          </View>
        </View>

        <View style={[styles.card, isWeb && styles.webCard]}>
          <Text style={[styles.settingTitle, isWeb && styles.webSettingTitle]}>
            About Accessibility
          </Text>
          <Text style={[styles.settingDescription, isWeb && styles.webSettingDescription]}>
            We are committed to making Self-Advocacy Wins accessible to everyone. 
            Our app supports screen readers, keyboard navigation, and various other 
            accessibility features to ensure a great experience for all users.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentWrapper: {
    padding: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#24269B',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  settingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  textSection: {
    flex: 1,
    paddingRight: 16,
  },
  switchContainer: {
    padding: 4,
  },
  settingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#24269B',
    marginBottom: 8,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // Web-specific styles
  webContainer: {
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  webContentWrapper: {
    maxWidth: 800,
    margin: '0 auto',
    padding: 40,
  },
  webCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  webPageTitle: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 32,
  },
  webSettingTitle: {
    fontSize: 20,
  },
  webSettingDescription: {
    fontSize: 16,
    lineHeight: 24,
  },
});

export default AccessibilityScreen; 