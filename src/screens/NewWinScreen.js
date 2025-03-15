import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from '../config/firebase';
import { collection, addDoc, doc, serverTimestamp, runTransaction, setDoc, updateDoc, arrayUnion, getDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigation } from '@react-navigation/native';
import { useAccessibility } from '../context/AccessibilityContext';

const generateAltText = async (imageUrl, setLoading) => {
  try {
    setLoading(true);
    const API_KEY = 'AIzaSyBKoHkKtY1qVFkY__Kl4TfjdlzOXVbTWAo';
    
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    const base64data = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(imageBlob);
    });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Describe this image in a single concise sentence for use as alt text. Respond with only the description."
          }, {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64data
            }
          }]
        }]
      })
    });

    const data = await response.json();
    
    // Only return the text content, ignore status
    const altText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return altText ? altText.trim() : null;
    
  } catch (error) {
    console.error('Error generating alt text:', error);
    return null;
  } finally {
    setLoading(false);
  }
};

const NewWinScreen = ({ navigation }) => {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [video, setVideo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaType, setMediaType] = useState(null);
  const [imageHeight, setImageHeight] = useState(0);
  const [media, setMedia] = useState([]);
  const [isGeneratingAltText, setIsGeneratingAltText] = useState(false);
  const screenWidth = Dimensions.get('window').width - 40;
  const { showHelpers } = useAccessibility();

  const clearForm = () => {
    setText('');
    setImage(null);
    setVideo(null);
    setMediaType(null);
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    try {
      if (!text.trim() && !image?.uri) {
        Alert.alert('Error', 'Please enter some text or add a photo to share your win');
        return;
      }

      setIsSubmitting(true);
      const lowerCaseUid = auth.currentUser.uid.toLowerCase();
      const userRef = doc(db, 'users', lowerCaseUid);
      const winRef = doc(collection(db, 'wins'));
      const winId = winRef.id;
      
      const userDoc = await getDoc(userRef);
      const now = new Date();
      
      // Create localTimestamp object
      const localTimestamp = {
        date: now.toLocaleDateString('en-US'),
        time: now.toLocaleTimeString('en-US'),
        timestamp: now.getTime(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      
      let mediaUrl = null;
      let altText = null;
      let mediaType = null;

      if (image) {
        mediaType = 'photo';
        const imageRef = ref(storage, `wins/${lowerCaseUid}/${winId}`);
        const response = await fetch(image.uri);
        const blob = await response.blob();
        await uploadBytes(imageRef, blob);
        mediaUrl = await getDownloadURL(imageRef);
        
        if (mediaType === 'photo') {
          altText = await generateAltText(mediaUrl, setIsGeneratingAltText);
        }
      }

      // Only include necessary fields in winData
      const winData = {
        text: text.trim() || null,
        createdAt: now.toISOString(),
        localTimestamp,
        userId: lowerCaseUid,
        username: userDoc.data().username,
        cheers: 0,
        comments: [],
        mediaUrl,
        mediaType,
        altText
      };

      const batch = writeBatch(db);
      batch.set(winRef, winData);
      
      // Update user's winTopics if there's text
      if (text.trim()) {
        const topics = text.toLowerCase()
          .split(/[\s,.-]+/)
          .filter(word => word.length > 3)
          .filter(word => !['this', 'that', 'with', 'from', 'what', 'have', 'and', 'the'].includes(word));

        const currentTopics = userDoc.data().winTopics || [];
        const newTopics = Array.from(new Set([...currentTopics, ...topics]));
        
        batch.update(userRef, {
          winTopics: newTopics,
          lastModified: serverTimestamp()
        });
      }

      await batch.commit();
      navigation.goBack();

    } catch (error) {
      console.error('Error saving win:', error);
      Alert.alert('Error', 'Failed to save win');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear form when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      clearForm();
    });

    return unsubscribe;
  }, [navigation]);

  const pickMedia = async (type) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'photo' 
          ? ImagePicker.MediaTypeOptions.Images 
          : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setImage(result.assets[0]);
        setMediaType(type);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media');
    }
  };

  const handleSelectVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Needed',
          'Please grant permission to access your photos in your device settings.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
        videoQuality: '480p',
        videoMaxDuration: 60,
      });

      console.log('Video picker result:', result);

      if (!result.canceled && result.assets && result.assets[0]) {
        const videoAsset = result.assets[0];
        
        if (videoAsset.type === 'video') {
          const fileSize = videoAsset.fileSize / (1024 * 1024);
          
          if (fileSize > 32) {
            Alert.alert(
              'Video Too Large',
              'Please select a shorter video or record at a lower quality. Maximum size is 32MB.'
            );
            return;
          }

          console.log('Setting video preview and type');
          setMediaPreview(videoAsset.uri);
          setMediaType('video');
        } else {
          Alert.alert('Error', 'Please select a video file');
        }
      }
    } catch (error) {
      console.error('Error selecting video:', error);
      Alert.alert(
        'Error',
        'Failed to select video. Please try again.'
      );
    }
  };

  const renderMedia = () => {
    if (!image && !video) return null;

    if (mediaType === 'photo') {
      return (
        <View style={styles.mediaContainer}>
          <Image source={{ uri: image.uri }} style={styles.media} />
          <TouchableOpacity 
            style={styles.removeButton}
            onPress={() => {
              setImage(null);
              setMediaType(null);
            }}
          >
            <MaterialCommunityIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    }

    if (mediaType === 'video') {
      return (
        <View style={styles.mediaContainer}>
          <Video
            source={{ uri: video.uri }}
            style={styles.media}
            useNativeControls
            resizeMode="contain"
            isLooping
          />
          <TouchableOpacity 
            style={styles.removeButton}
            onPress={() => {
              setVideo(null);
              setMediaType(null);
            }}
          >
            <MaterialCommunityIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    }
  };

  useEffect(() => {
    if (image) {
      Image.getSize(image.uri, (width, height) => {
        const scaledHeight = (height / width) * screenWidth;
        setImageHeight(scaledHeight);
      });
    }
  }, [image]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => navigation.navigate('Settings')}
          accessible={true}
          accessibilityLabel="Open menu"
          accessibilityHint="Navigate to settings and additional options"
        >
          <Image
            source={require('../../assets/bottom-nav-images/menu-inactive.png')}
            style={styles.menuIcon}
          />
          <Text style={styles.menuText}>Menu</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      accessible={true}
      accessibilityLabel="Create a new win"
      accessibilityHint="Screen for sharing your win with text and media"
    >
      {showHelpers && (
        <View 
          style={styles.helperSection}
          accessible={true}
          accessibilityRole="header"
          accessibilityLabel={`How to Share Your Win. 
            Step 1: Tap the box belowto write something about your win. You can skip this if you just want to share a photo or video. If you add a photo, you will tap the "crop" button in the top right to use the photo.
            Step 2: Tap to add a photo or video if you'd like. 
            Step 3: Tap Post Win to share with everyone!`}
        >
          <View style={styles.helperCard}>
            <View style={styles.helperHeader}>
              <MaterialCommunityIcons 
                name="information" 
                size={24} 
                color="#24269B"
                style={styles.infoIcon}
                importantForAccessibility="no"
              />
            </View>
            <Image 
              source={require('../../assets/new-win-demo.png')} 
              style={styles.helperImage}
              importantForAccessibility="no"
            />
            <Text style={styles.helperTitle}>How to Share Your Win</Text>
            <View style={styles.helperInstructions}>
              <Text style={styles.helperText}>1. Tap the box to write something about your win. You can skip this if you just want to share a photo or video.</Text>
              <Text style={styles.helperText}>2. Tap to add a photo or video if you'd like</Text>
              <Text style={styles.helperText}>3. Tap "Post Win" to share with everyone!</Text>
            </View>
          </View>
        </View>
      )}

      <TextInput
        style={[styles.input, showHelpers && styles.inputWithHelper]}
        placeholder="What's your win?"
        value={text}
        onChangeText={setText}
        multiline
        accessible={true}
        accessibilityLabel="Share your win"
        accessibilityHint="Enter text to describe your win"
      />
      
      {image && (
        <View
          accessible={true}
          accessibilityLabel="Selected image preview"
        >
          <Image
            source={{ uri: image.uri }}
            style={styles.previewImage}
            resizeMode="contain"
            accessibilityElementsHidden={true}
          />
          <TouchableOpacity 
            style={styles.removeMediaButton}
            onPress={() => {
              setImage(null);
              setMediaType(null);
            }}
            accessible={true}
            accessibilityLabel="Remove selected image"
            accessibilityRole="button"
            accessibilityHint="Double tap to remove the selected image"
          >
            <MaterialCommunityIcons 
              name="close" 
              size={24} 
              color="#fff" 
              accessibilityElementsHidden={true}
            />
          </TouchableOpacity>
        </View>
      )}

      <View 
        style={styles.mediaButtons}
        accessible={true}
        accessibilityLabel="Media options"
      >
        <View style={styles.buttonContainer}>
          <View style={styles.buttonShadow} />
          <TouchableOpacity 
            style={styles.mediaButton} 
            onPress={() => pickMedia('photo')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
            accessibilityHint="Double tap to select a photo from your library"
          >
            <MaterialCommunityIcons 
              name="camera" 
              size={24} 
              color="#24269B" 
              accessibilityElementsHidden={true}
            />
            <Text 
              style={styles.buttonText}
              accessibilityElementsHidden={true}
            >
              Photo
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <View style={styles.buttonShadow} />
          <TouchableOpacity 
            style={styles.mediaButton} 
            onPress={() => pickMedia('video')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Add video"
            accessibilityHint="Double tap to select a video from your library"
          >
            <MaterialCommunityIcons 
              name="video" 
              size={24} 
              color="#24269B" 
              accessibilityElementsHidden={true}
            />
            <Text 
              style={styles.buttonText}
              accessibilityElementsHidden={true}
            >
              Video
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity 
        style={[
          styles.submitButton,
          (!text.trim() && !image) && styles.submitButtonDisabled
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting || (!text.trim() && !image)}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={
          isSubmitting ? "Posting your win..." : 
          (!text.trim() && !image) ? "Post win button - disabled. Add text or media to enable" :
          "Post win"
        }
        accessibilityHint={
          (!text.trim() && !image) ? 
          "Add text or select media to share your win" :
          "Double tap to share your win"
        }
        accessibilityState={{
          disabled: isSubmitting || (!text.trim() && !image),
          busy: isSubmitting
        }}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Posting...' : 'Post Win'}
        </Text>
        <MaterialCommunityIcons 
          name="arrow-right" 
          size={24} 
          color="white" 
          accessibilityElementsHidden={true}
        />
      </TouchableOpacity>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#24269B',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  
  previewImage: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').width - 40,
    marginBottom: 20,
    backgroundColor: '#f0f0f0',
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  buttonContainer: {
    position: 'relative',
    width: '40%',
    
  },
  buttonShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  mediaButton: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#24269B',
    
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
   
  },
  buttonText: {
    color: '#24269B',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 10,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 10,
  },
  buttonIcon: {
    width: 24,
    height: 24,
    tintColor: '#24269B',
  },
  mediaIndicator: {
    width: '100%',
    height: 100,
    marginBottom: 20,
    position: 'relative',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 5,
    zIndex: 1,
  },
  submitButton: {
    backgroundColor: '#24269B',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#24269B',
    marginTop: 20,
  },
  removeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#cccccc',
  },
  menuButton: {
    alignItems: 'center',
    marginRight: 15,
    maxWidth: 80,
  },
  menuIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  menuText: {
    fontSize: 12,
    color: '#24269B',
    marginTop: 2,
    flexWrap: 'wrap',
    textAlign: 'center',
  },
  helperSection: {
    marginBottom: 20,
    
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24269B',
    paddingHorizontal: 10, // Reduced from 10
    paddingVertical: 10, // Added to control vertical spacing
  },
  helperCard: {
    alignItems: 'center',
  },
  helperImage: {
    width: 200,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  helperTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#24269B',
    marginBottom: 10,
    textAlign: 'center',
  },
  helperInstructions: {
    width: '100%',
    paddingHorizontal: 10,
  },
  helperText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
  },
  inputWithHelper: {
    marginTop: 10,
  },
  helperHeader: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: -20,
    zIndex: 1,
  },
  infoIcon: {
    padding: 5,
  },
});

export default NewWinScreen;