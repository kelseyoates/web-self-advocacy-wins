import React from 'react';
import { Text } from 'react-native';

const AppText = ({ style, children, ...props }) => {
  return (
    <Text 
      style={[
        {
          fontFamily: 'System',  // We'll use system font for now
          fontSize: 16,
          color: '#000000',
        },
        style
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

export default AppText; 