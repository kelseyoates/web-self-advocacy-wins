import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AccessibilityContext = createContext();

export const AccessibilityProvider = ({ children }) => {
  const [showHelpers, setShowHelpers] = useState(true);

  // Load saved preferences when app starts
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const savedHelpers = await AsyncStorage.getItem('showHelpers');
      if (savedHelpers !== null) {
        setShowHelpers(JSON.parse(savedHelpers));
      }
    } catch (error) {
      console.error('Error loading accessibility preferences:', error);
    }
  };

  const toggleHelpers = async () => {
    try {
      const newValue = !showHelpers;
      await AsyncStorage.setItem('showHelpers', JSON.stringify(newValue));
      setShowHelpers(newValue);
    } catch (error) {
      console.error('Error saving helper preference:', error);
    }
  };

  return (
    <AccessibilityContext.Provider value={{ showHelpers, toggleHelpers }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => useContext(AccessibilityContext); 