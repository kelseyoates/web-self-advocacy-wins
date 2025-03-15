import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

const StateSelector = ({ states, selectedState, onStateSelect }) => {
  return (
    <View 
      style={styles.container}
      accessible={true}
      accessibilityRole="radiogroup"
      accessibilityLabel="State selection"
      accessibilityHint="Choose your state from the available options"
    >
      {states.map((state) => (
        <TouchableOpacity
          key={state}
          style={[
            styles.stateButton,
            selectedState === state && styles.selectedButton
          ]}
          onPress={() => {
            console.log('DEBUG: State button pressed:', state);
            onStateSelect(state);
          }}
          accessible={true}
          accessibilityRole="radio"
          accessibilityLabel={state}
          accessibilityState={{ 
            selected: selectedState === state,
            checked: selectedState === state 
          }}
          accessibilityHint={`Double tap to ${selectedState === state ? 'unselect' : 'select'} ${state}`}
        >
          <Text 
            style={[
              styles.stateText,
              selectedState === state && styles.selectedText
            ]}
          >
            {state}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  stateButton: {
    padding: 10,
    margin: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    minHeight: 44, // Minimum touch target size
    minWidth: 44, // Minimum touch target size
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  stateText: {
    color: '#000',
    fontSize: 16, // Increased for better readability
  },
  selectedText: {
    color: '#fff',
  },
});

export default StateSelector; 