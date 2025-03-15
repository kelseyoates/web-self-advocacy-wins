import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  AccessibilityInfo,
} from 'react-native';
import { CometChat } from '@cometchat-pro/react-native-chat';
import { auth, db, storage } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const CreateCommunityScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [groupIcon, setGroupIcon] = useState(null);
  const [userData, setUserData] = useState(null);

  // Fetch user profile for header
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        if (auth.currentUser) {
          const userDocRef = doc(db, 'users', auth.currentUser.uid.toLowerCase());
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUserData(data);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

  // Set up header with profile button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
          accessible={true}
          accessibilityLabel="Go to profile"
          accessibilityHint="Navigate to your profile page"
        >
          <Image
            source={
              userData?.profilePicture 
                ? { uri: userData.profilePicture } 
                : require('../../assets/default-profile.png')
            }
            style={styles.profileImage}
          />
          <Text style={styles.profileText}>Profile</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, userData]);

  // Add this effect for screen reader announcement
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('Create Community Screen');
  }, []);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        setGroupIcon(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const createCommunity = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a community name');
      return;
    }

    try {
      setLoading(true);

      let iconUrl = null;
      if (groupIcon) {
        try {
          // Upload image to Firebase Storage
          const response = await fetch(groupIcon);
          const blob = await response.blob();
          
          const imageRef = ref(storage, `groupIcons/${Date.now()}.jpg`);
          await uploadBytes(imageRef, blob);
          iconUrl = await getDownloadURL(imageRef);
          console.log('Image uploaded to Firebase:', iconUrl);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
        }
      }

      // Create the group - always set as PUBLIC
      const groupId = name.toLowerCase().replace(/\s+/g, '-');
      const group = new CometChat.Group(
        groupId,
        name,
        CometChat.GROUP_TYPE.PUBLIC, // Always public
        ''
      );

      if (description) {
        group.setDescription(description);
      }

      if (iconUrl) {
        group.setIcon(iconUrl);
      }

      // Create the group
      const createdGroup = await CometChat.createGroup(group);
      console.log('Group created successfully:', createdGroup);

      Alert.alert(
        'Success',
        'Community created successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.replace('GroupChat', {
              uid: createdGroup.guid,
              name: createdGroup.name
            })
          }
        ]
      );
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create community');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.content}
      accessible={true}
      accessibilityRole="scrollView"
      accessibilityLabel="Create Community form"
    >
      <View style={styles.content}>
        <TouchableOpacity 
          style={styles.iconPicker}
          onPress={pickImage}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={groupIcon ? "Change community icon" : "Add community icon"}
          accessibilityHint="Opens image picker to select a community icon"
        >
          {groupIcon ? (
            <Image 
              source={{ uri: groupIcon }}
              style={styles.groupIcon}
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel="Selected community icon"
            />
          ) : (
            <View 
              style={styles.iconPlaceholder}
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel="No icon selected"
            >
              <Text style={styles.iconPlaceholderText}>Add Icon</Text>
            </View>
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Community Name"
          value={name}
          onChangeText={setName}
          maxLength={50}
          accessible={true}
          accessibilityLabel="Community name input"
          accessibilityHint="Enter the name for your community"
          accessibilityRole="text"
          returnKeyType="next"
          importantForAccessibility="yes"
        />

        <TextInput
          style={[styles.input, styles.descriptionInput]}
          placeholder="Description (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={200}
          accessible={true}
          accessibilityLabel="Community description input"
          accessibilityHint="Enter an optional description for your community"
          accessibilityRole="text"
          importantForAccessibility="yes"
        />

        <TouchableOpacity
          style={[
            styles.createButton,
            (!name.trim() || loading) && styles.disabledButton
          ]}
          onPress={createCommunity}
          disabled={!name.trim() || loading}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={loading ? "Creating community" : "Create community"}
          accessibilityHint={
            !name.trim() 
              ? "Button disabled. Enter a community name first" 
              : "Creates your community with the provided information"
          }
          accessibilityState={{
            disabled: !name.trim() || loading,
            busy: loading
          }}
        >
          {loading ? (
            <ActivityIndicator 
              color="#fff"
              accessibilityLabel="Loading"
              accessibilityRole="progressbar"
            />
          ) : (
            <Text style={styles.createButtonText}>Create Community</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  iconPicker: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  groupIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#24269B',
  },
  iconPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8E8FF',
    borderWidth: 2,
    borderColor: '#24269B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPlaceholderText: {
    color: '#24269B',
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#24269B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: '#24269B',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#999',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  profileButton: {
    alignItems: 'center',
    marginRight: 15,
  },
  profileImage: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    borderWidth: 2,
    borderColor: '#24269B',
  },
  profileText: {
    fontSize: 12,
    color: '#24269B',
    marginTop: 2,
  },
});

export default CreateCommunityScreen; 