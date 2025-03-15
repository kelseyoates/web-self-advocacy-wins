import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import MainNavigator from './navigation/MainNavigator';
import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

const App = () => {
  useEffect(() => {
    const testFirestore = async () => {
      try {
        console.log('Testing Firestore connection...');
        const querySnapshot = await getDocs(collection(db, 'any-collection'));
        console.log('Firestore query successful');
      } catch (error) {
        console.error('Firestore test error:', error);
      }
    };

    testFirestore();
  }, []);

  return (
    <NavigationContainer>
      <MainNavigator />
    </NavigationContainer>
  );
};

export default App;