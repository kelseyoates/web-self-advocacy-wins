import React, { useState } from 'react';
import { View, TextInput, FlatList, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const GroupChatSetupScreen = ({ navigation, route }) => {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      // Show error
      return;
    }

    // Create group chat logic here
    console.log('Creating group with:', { groupName, selectedUsers });
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Group Name"
        value={groupName}
        onChangeText={setGroupName}
      />

      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => navigation.navigate('UserSearch', { isGroup: true })}
      >
        <MaterialCommunityIcons name="account-plus" size={24} color="white" />
        <Text style={styles.buttonText}>Add Participants</Text>
      </TouchableOpacity>

      <FlatList
        data={selectedUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.selectedUser}>
            <Text>{item.username}</Text>
            <TouchableOpacity 
              onPress={() => setSelectedUsers(users => users.filter(u => u.id !== item.id))}
            >
              <MaterialCommunityIcons name="close" size={20} color="red" />
            </TouchableOpacity>
          </View>
        )}
      />

      <TouchableOpacity 
        style={[styles.addButton, styles.createButton]}
        onPress={handleCreateGroup}
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
});

export default GroupChatSetupScreen; 