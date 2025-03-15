import React, { useState } from 'react';
import { View, TextInput, FlatList, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const isWeb = Platform.OS === 'web';

const GroupChatSetupScreen = ({ navigation, route }) => {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);

  const handleKeyPress = (e, action) => {
    if (isWeb && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      action();
    }
  };

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      // Show error
      return;
    }

    // Create group chat logic here
    console.log('Creating group with:', { groupName, selectedUsers });
  };

  const renderUserItem = ({ item }) => (
    <View 
      style={[
        styles.selectedUser,
        isWeb && styles.webSelectedUser
      ]}
      accessible={true}
      accessibilityRole="listitem"
      accessibilityLabel={`Selected user: ${item.username}`}
    >
      <Text style={styles.userName}>{item.username}</Text>
      <TouchableOpacity 
        onPress={() => setSelectedUsers(users => users.filter(u => u.id !== item.id))}
        style={[
          styles.removeButton,
          isWeb && styles.webRemoveButton
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.username}`}
        accessibilityHint="Double tap to remove user from group"
        role="button"
        tabIndex={0}
        onKeyPress={(e) => handleKeyPress(e, () => setSelectedUsers(users => users.filter(u => u.id !== item.id)))}
      >
        <MaterialCommunityIcons name="close" size={20} color="red" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[
      styles.container,
      isWeb && styles.webContainer
    ]}>
      <TextInput
        style={[
          styles.input,
          isWeb && styles.webInput
        ]}
        placeholder="Group Name"
        value={groupName}
        onChangeText={setGroupName}
        accessible={true}
        accessibilityLabel="Group name input"
        accessibilityHint="Enter a name for your group"
        accessibilityRole="textbox"
      />

      <TouchableOpacity 
        style={[
          styles.addButton,
          isWeb && styles.webButton
        ]}
        onPress={() => navigation.navigate('UserSearch', { isGroup: true })}
        accessible={true}
        accessibilityLabel="Add participants"
        accessibilityHint="Double tap to select users to add to the group"
        accessibilityRole="button"
        role="button"
        tabIndex={0}
        onKeyPress={(e) => handleKeyPress(e, () => navigation.navigate('UserSearch', { isGroup: true }))}
      >
        <MaterialCommunityIcons name="account-plus" size={24} color="white" />
        <Text style={styles.buttonText}>Add Participants</Text>
      </TouchableOpacity>

      {isWeb ? (
        <ScrollView style={styles.webSelectedUsersList}>
          {selectedUsers.map(item => renderUserItem({ item }))}
        </ScrollView>
      ) : (
        <FlatList
          data={selectedUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          style={styles.selectedUsersList}
          accessible={true}
          accessibilityLabel="Selected participants list"
          accessibilityRole="list"
        />
      )}

      <TouchableOpacity 
        style={[
          styles.addButton,
          styles.createButton,
          isWeb && styles.webCreateButton,
          (!groupName.trim() || selectedUsers.length === 0) && styles.disabledButton
        ]}
        onPress={handleCreateGroup}
        disabled={!groupName.trim() || selectedUsers.length === 0}
        accessible={true}
        accessibilityLabel="Create group chat"
        accessibilityHint="Double tap to create the group chat"
        accessibilityRole="button"
        accessibilityState={{ disabled: !groupName.trim() || selectedUsers.length === 0 }}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => handleKeyPress(e, handleCreateGroup)}
      >
        <MaterialCommunityIcons name="check-circle" size={24} color="white" />
        <Text style={styles.buttonText}>Create Group Chat</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#24269B',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 10,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    marginTop: 'auto',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedUser: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  userName: {
    fontSize: 16,
    color: '#333',
  },
  disabledButton: {
    opacity: 0.5,
  },

  // Web-specific styles
  webContainer: {
    maxWidth: 800,
    marginHorizontal: 'auto',
    height: '100vh',
    padding: 32,
  },
  webInput: {
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    outline: 'none',
    transition: 'border-color 0.2s ease',
    ':focus': {
      borderColor: '#24269B',
      boxShadow: '0 0 0 2px rgba(36, 38, 155, 0.1)',
    },
  },
  webButton: {
    cursor: 'pointer',
    transition: 'transform 0.2s ease, background-color 0.2s ease',
    ':hover': {
      transform: 'translateY(-2px)',
      backgroundColor: '#1a1b6e',
    },
    ':focus': {
      outline: '2px solid #24269B',
      outlineOffset: '2px',
    },
  },
  webCreateButton: {
    ':hover': {
      backgroundColor: '#388E3C',
    },
    ':focus': {
      outline: '2px solid #4CAF50',
      outlineOffset: '2px',
    },
  },
  webSelectedUser: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    transition: 'transform 0.2s ease',
    ':hover': {
      transform: 'translateY(-2px)',
    },
  },
  webRemoveButton: {
    cursor: 'pointer',
    padding: 8,
    borderRadius: 4,
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#ffebee',
    },
    ':focus': {
      outline: '2px solid #ff4444',
      outlineOffset: '2px',
    },
  },
  webSelectedUsersList: {
    flex: 1,
    marginBottom: 24,
  },
});

export default GroupChatSetupScreen; 