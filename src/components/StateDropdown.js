import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SelectList } from 'react-native-dropdown-select-list';

const StateDropdown = ({ selectedState, onStateChange }) => {
  const states = [
    { key: 'ANY', value: 'Anywhere' },
    { key: 'AL', value: 'Alabama' },
    { key: 'AK', value: 'Alaska' },
    { key: 'AZ', value: 'Arizona' },
    { key: 'AR', value: 'Arkansas' },
    { key: 'CA', value: 'California' },
    { key: 'CO', value: 'Colorado' },
    { key: 'CT', value: 'Connecticut' },
    { key: 'DE', value: 'Delaware' },
    { key: 'FL', value: 'Florida' },
    { key: 'GA', value: 'Georgia' },
    { key: 'HI', value: 'Hawaii' },
    { key: 'ID', value: 'Idaho' },
    { key: 'IL', value: 'Illinois' },
    { key: 'IN', value: 'Indiana' },
    { key: 'IA', value: 'Iowa' },
    { key: 'KS', value: 'Kansas' },
    { key: 'KY', value: 'Kentucky' },
    { key: 'LA', value: 'Louisiana' },
    { key: 'ME', value: 'Maine' },
    { key: 'MD', value: 'Maryland' },
    { key: 'MA', value: 'Massachusetts' },
    { key: 'MI', value: 'Michigan' },
    { key: 'MN', value: 'Minnesota' },
    { key: 'MS', value: 'Mississippi' },
    { key: 'MO', value: 'Missouri' },
    { key: 'MT', value: 'Montana' },
    { key: 'NE', value: 'Nebraska' },
    { key: 'NV', value: 'Nevada' },
    { key: 'NH', value: 'New Hampshire' },
    { key: 'NJ', value: 'New Jersey' },
    { key: 'NM', value: 'New Mexico' },
    { key: 'NY', value: 'New York' },
    { key: 'NC', value: 'North Carolina' },
    { key: 'ND', value: 'North Dakota' },
    { key: 'OH', value: 'Ohio' },
    { key: 'OK', value: 'Oklahoma' },
    { key: 'OR', value: 'Oregon' },
    { key: 'PA', value: 'Pennsylvania' },
    { key: 'RI', value: 'Rhode Island' },
    { key: 'SC', value: 'South Carolina' },
    { key: 'SD', value: 'South Dakota' },
    { key: 'TN', value: 'Tennessee' },
    { key: 'TX', value: 'Texas' },
    { key: 'UT', value: 'Utah' },
    { key: 'VT', value: 'Vermont' },
    { key: 'VA', value: 'Virginia' },
    { key: 'WA', value: 'Washington' },
    { key: 'WV', value: 'West Virginia' },
    { key: 'WI', value: 'Wisconsin' },
    { key: 'WY', value: 'Wyoming' }
  ];

  const handleSelect = (val) => {
    if (onStateChange) {
      onStateChange(val === 'Anywhere' ? '' : val);
    }
  };

  return (
    <View 
      style={styles.container}
      accessible={true}
      accessibilityRole="combobox"
      accessibilityLabel="State selection dropdown"
      accessibilityHint="Select your state or choose Anywhere to see users from all states"
    >
      <SelectList
        setSelected={handleSelect}
        data={states}
        save="value"
        placeholder="Select a State"
        searchPlaceholder="Search States..."
        defaultOption={selectedState ? { key: selectedState, value: selectedState } : null}
        boxStyles={styles.boxStyle}
        inputStyles={styles.inputStyle}
        dropdownStyles={styles.dropdownStyle}
        dropdownItemStyles={styles.dropdownItemStyle}
        dropdownTextStyles={styles.dropdownTextStyle}
        search={true}
        ariaLabel="State selection"
        accessibilityLabel="Select your state"
        accessibilityHint="Opens a list of US states to choose from"
        accessibilityRole="combobox"
        accessible={true}
        accessibilityState={{
          expanded: false,
          selected: !!selectedState
        }}
        searchAccessibilityLabel="Search states"
        searchAccessibilityHint="Type to filter states list"
        optionProps={{
          accessible: true,
          accessibilityRole: "option",
          accessibilityHint: "Double tap to select this state"
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 10,
  },
  boxStyle: {
    borderWidth: 1.5,
    borderColor: '#24269B',
    borderRadius: 8,
    backgroundColor: '#fff',
    minHeight: 48,
    justifyContent: 'center',
  },
  inputStyle: {
    color: '#24269B',
    fontSize: 16,
  },
  dropdownStyle: {
    borderWidth: 1,
    borderColor: '#24269B',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 5,
  },
  dropdownItemStyle: {
    borderBottomWidth: 0.5,
    borderColor: '#000000',
    marginTop: 10,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  dropdownTextStyle: {
    color: '#24269B',
    fontSize: 16,
  }
});

export default StateDropdown; 