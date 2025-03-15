import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';

const AccessibilityScreen = () => {
  const { showHelpers, toggleHelpers } = useAccessibility();

  return (
    <View style={styles.container}>
      <View style={styles.settingContainer}>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>Show Helper Sections</Text>
          <Text style={styles.settingDescription}>
            Helper sections show you how to use different features in the app. 
            Turn this off once you're comfortable with the app.
          </Text>
        </View>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  settingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 20,
  },
  settingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#24269B',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default AccessibilityScreen; 