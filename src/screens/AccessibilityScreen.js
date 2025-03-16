import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Platform, Pressable, useWindowDimensions } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';

const AccessibilityScreen = () => {
  const { showHelpers, toggleHelpers } = useAccessibility();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isMobile = width < 768;

  // State for hover effects on web
  const [hoverStates, setHoverStates] = useState({
    helpersCard: false,
    aboutCard: false,
  });

  // Function to handle keyboard navigation for web
  useEffect(() => {
    if (isWeb) {
      const handleKeyDown = (e) => {
        if (e.key === 'Enter' && document.activeElement.id === 'helpers-switch') {
          toggleHelpers();
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [toggleHelpers, isWeb]);

  // Apply styles based on platform and screen size
  const containerStyle = [
    styles.container,
    isWeb && styles.webContainer,
    isWeb && !isMobile && styles.webContainerDesktop
  ];
  
  const contentWrapperStyle = [
    styles.contentWrapper,
    isWeb && styles.webContentWrapper
  ];
  
  const pageTitleStyle = [
    styles.pageTitle,
    isWeb && styles.webPageTitle
  ];
  
  const helpersCardStyle = [
    styles.card,
    isWeb && styles.webCard,
    isWeb && hoverStates.helpersCard && styles.webCardHover
  ];
  
  const aboutCardStyle = [
    styles.card,
    isWeb && styles.webCard,
    isWeb && hoverStates.aboutCard && styles.webCardHover
  ];
  
  const settingTitleStyle = [
    styles.settingTitle,
    isWeb && styles.webSettingTitle
  ];
  
  const settingDescriptionStyle = [
    styles.settingDescription,
    isWeb && styles.webSettingDescription
  ];

  return (
    <View style={containerStyle}>
      <View style={contentWrapperStyle}>
        <Text 
          style={pageTitleStyle}
          role={isWeb ? "heading" : undefined}
          aria-level={isWeb ? 1 : undefined}
        >
          Accessibility Settings
        </Text>
        
        <Pressable
          style={helpersCardStyle}
          onMouseEnter={isWeb ? () => setHoverStates(prev => ({...prev, helpersCard: true})) : undefined}
          onMouseLeave={isWeb ? () => setHoverStates(prev => ({...prev, helpersCard: false})) : undefined}
          accessible={true}
          accessibilityRole="none"
        >
          <View style={styles.settingContainer}>
            <View style={styles.textSection}>
              <Text 
                style={settingTitleStyle}
                role={isWeb ? "heading" : undefined}
                aria-level={isWeb ? 2 : undefined}
              >
                Show Helper Sections
              </Text>
              <Text style={settingDescriptionStyle}>
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
                id={isWeb ? "helpers-switch" : undefined}
                role={isWeb ? "switch" : undefined}
                aria-checked={isWeb ? showHelpers : undefined}
                tabIndex={isWeb ? 0 : undefined}
              />
            </View>
          </View>
        </Pressable>

        <Pressable
          style={aboutCardStyle}
          onMouseEnter={isWeb ? () => setHoverStates(prev => ({...prev, aboutCard: true})) : undefined}
          onMouseLeave={isWeb ? () => setHoverStates(prev => ({...prev, aboutCard: false})) : undefined}
          accessible={true}
          accessibilityRole="none"
        >
          <Text 
            style={settingTitleStyle}
            role={isWeb ? "heading" : undefined}
            aria-level={isWeb ? 2 : undefined}
          >
            About Accessibility
          </Text>
          <Text style={settingDescriptionStyle}>
            We are committed to making Self-Advocacy Wins accessible to everyone. 
            Our app supports screen readers, keyboard navigation, and various other 
            accessibility features to ensure a great experience for all users.
          </Text>
          {isWeb && (
            <Text style={[settingDescriptionStyle, styles.webAdditionalInfo]}>
              On the web, you can use keyboard navigation (Tab key) to move between elements,
              and Enter key to activate buttons and toggles. Screen readers are fully supported,
              and all interactive elements have proper ARIA attributes.
            </Text>
          )}
        </Pressable>
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
  webContainerDesktop: {
    paddingTop: 40,
  },
  webContentWrapper: {
    maxWidth: 800,
    marginHorizontal: 'auto',
    padding: Platform.OS === 'web' ? 40 : 20,
    width: '100%',
  },
  webCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    transition: 'all 0.3s ease',
    cursor: 'default',
  },
  webCardHover: {
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    transform: [{translateY: -2}],
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
  webAdditionalInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
});

export default AccessibilityScreen; 