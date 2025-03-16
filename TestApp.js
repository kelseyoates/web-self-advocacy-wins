import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

// Minimal test app with no complex imports
console.log('TestApp.js loading...');

export default function TestApp() {
  console.log('TestApp component rendering');
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test App</Text>
      <Text style={styles.subtitle}>Platform: {Platform.OS}</Text>
      <Text style={styles.body}>
        If you can see this, the basic React Native Web setup is working!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#24269B',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
    color: '#555',
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
}); 