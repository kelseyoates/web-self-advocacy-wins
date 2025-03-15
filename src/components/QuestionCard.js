import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from '../config/firebase';
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
import { Video } from 'expo-av';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
const MAX_DURATION = 60; // 60 seconds (1 minute)
const MAX_CHARACTERS = 400;

const QuestionCard = ({ question, presetWords, onSave, existingAnswer, isDatingQuestion = false }) => {
  console.log('Question data received:', question);

  const [mode, setMode] = useState('text');
  const [textAnswer, setTextAnswer] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedWords, setSelectedWords] = useState([]);
  const [video, setVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [questionData, setQuestionData] = useState({
    mediaUrl: existingAnswer?.mediaUrl || null,
    mediaType: existingAnswer?.mediaType || null,
    question: question.text
  });

  // Reset video visibility when question changes
  useEffect(() => {
    setShowVideo(false);
    setQuestionData(prev => ({
      ...prev,
      mediaUrl: existingAnswer?.mediaUrl || null,
      mediaType: existingAnswer?.mediaType || null,
      question: question.text
    }));
  }, [question.text, existingAnswer]);

  useEffect(() => {
    if (existingAnswer) {
      setTextAnswer(existingAnswer.textAnswer || '');
      setSelectedWords(existingAnswer.selectedWords || []);
      setVideo(existingAnswer.videoAnswer || null);
    }
  }, [existingAnswer]);

  const handleLocationSubmit = async () => {
    try {
      await updateFirestore({ location });
      Alert.alert('Success', 'Location saved successfully');
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert('Error', 'Failed to save location');
    }
  };

  const renderLocation = () => {
    return (
      <View style={styles.locationContainer}>
        <TextInput
          style={styles.locationInput}
          placeholder="Enter your location"
          value={location}
          onChangeText={setLocation}
        />
        <TouchableOpacity 
          style={styles.locationButton}
          onPress={handleLocationSubmit}
        >
          <MaterialCommunityIcons name="map-marker" size={20} color="#fff" />
          <Text style={styles.buttonText}>Save Location</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const pickVideo = async () => {
    try {
      setUploading(true);
      setUploadProgress(0);
      
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to make this work!');
        setUploading(false);
        return;
      }

      // Pick the video
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.5,
        videoMaxDuration: MAX_DURATION,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      // Check file size
      const fileInfo = await FileSystem.getInfoAsync(result.assets[0].uri);
      const fileSizeMB = fileInfo.size / (1024 * 1024);
      console.log(`Video size: ${fileSizeMB.toFixed(2)} MB`);

      if (fileInfo.size > MAX_FILE_SIZE) {
        Alert.alert(
          'Video Too Large', 
          `Video is too large (${fileSizeMB.toFixed(2)} MB). Please choose a video smaller than 50MB.`
        );
        setUploading(false);
        return;
      }

      const durationSeconds = result.assets[0].duration / 1000;
      if (durationSeconds > MAX_DURATION) {
        Alert.alert(
          'Video Too Long',
          `Video must be ${MAX_DURATION} seconds or less. Your video is ${Math.round(durationSeconds)} seconds.`
        );
        setUploading(false);
        return;
      }

      console.log('Starting upload process...');
      console.log(`Video details: ${durationSeconds.toFixed(1)} seconds, ${fileSizeMB.toFixed(2)} MB`);
      await uploadVideo(result.assets[0].uri);

    } catch (error) {
      console.error('Error in pickVideo:', error);
      Alert.alert('Error', 'Error selecting video. Please try again.');
      setUploading(false);
    }
  };

  const uploadVideo = async (uri) => {
    try {
      console.log('Starting video upload with URI:', uri);
      
      const response = await fetch(uri);
      const blob = await response.blob();

      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const filename = `questions/${auth.currentUser.uid.toLowerCase()}/${timestamp}_${random}.mp4`;
      
      const storageRef = ref(storage, filename);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          console.log('Upload progress:', progress + '%');
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          alert('Error uploading video. Please check your internet connection and try again.');
          setUploading(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await handleMediaUpload(downloadURL, 'video');
            setUploading(false);
            setUploadProgress(0);
          } catch (error) {
            console.error('Error finishing upload:', error);
            alert('Error saving video. Please try again.');
            setUploading(false);
          }
        }
      );

    } catch (error) {
      console.error('Error in uploadVideo:', error);
      console.error('Error details:', error.message);
      alert('Error uploading video. Please check your internet connection and try again.');
      setUploading(false);
    }
  };

  const updateFirestore = async (newData) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No user logged in');

      // Prepare the complete answer data
      const updatedAnswer = {
        question,
        timestamp: new Date().toISOString(),
        selectedWords: selectedWords,
        textAnswer: textAnswer,
        ...newData
      };

      // Only call onSave from the parent component
      onSave(updatedAnswer);
      
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Error', 'Failed to save answer');
    }
  };

  const handlePresetSelect = async (word) => {
    let newSelectedWords;
    if (selectedWords.includes(word)) {
      newSelectedWords = selectedWords.filter(w => w !== word);
    } else {
      newSelectedWords = [...selectedWords, word];
    }
    setSelectedWords(newSelectedWords);
    await updateFirestore({ selectedWords: newSelectedWords });
  };

  const handleTextSave = async () => {
    try {
      await updateFirestore({ textAnswer });
      Alert.alert('Success', 'Answer saved successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving text answer:', error);
      Alert.alert('Error', 'Failed to save answer');
    }
  };

  const handleMediaUpload = async (url, type) => {
    try {
      await updateFirestore({
        mediaUrl: url,
        mediaType: type
      });
      
      setQuestionData(prev => ({
        ...prev,
        mediaUrl: url,
        mediaType: type
      }));

    } catch (error) {
      console.error('Error saving answer:', error);
      Alert.alert('Error', 'Failed to save video. Please try again.');
    }
  };

  const renderVideoMode = () => {
    if (video) {
      return (
        <View style={styles.videoContainer}>
          <Video
            source={{ uri: video }}
            style={styles.video}
            useNativeControls
            resizeMode="contain"
            isLooping
          />
        </View>
      );
    }

    return (
      <View style={styles.videoContainer}>
        <MaterialCommunityIcons 
          name="video-plus" 
          size={48} 
          color="#24269B" 
        />
        <Text style={styles.messageText}>
          Upload a video answer
        </Text>
        <TouchableOpacity 
          style={[styles.uploadButton, uploading && styles.uploadingButton]}
          onPress={pickVideo}
          disabled={uploading}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={uploading ? `Uploading: ${uploadProgress}%` : "Add video"}
          accessibilityState={{ disabled: uploading }}
          accessibilityHint="Double tap to select a video to upload"
        >
          {uploading ? (
            <View 
              style={styles.uploadingContainer}
              accessibilityRole="progressbar"
              accessibilityValue={{ now: uploadProgress, min: 0, max: 100 }}
            >
              <Text style={styles.uploadingText}>
                Uploading: {uploadProgress}%
              </Text>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
              </View>
            </View>
          ) : (
            <Text style={styles.buttonText}>Add Video</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const handleAnswerChange = (text) => {
    // Limit text to MAX_CHARACTERS
    if (text.length <= MAX_CHARACTERS) {
      setTextAnswer(text);
      setIsEditing(true);
    }
  };

  const handleVideoPress = () => {
    setShowVideo(!showVideo);
  };

  const toggleVideo = () => {
    setShowVideo(!showVideo);
  };

  const handleSave = async () => {
    try {
      let saveData = {
        selectedWords: selectedWords || [], // Ensure it's always an array
        textAnswer: textAnswer || '',       // Ensure it's always a string
        timestamp: new Date().toISOString()
      };

      if (mode === 'video' && video) {
        setUploading(true);
        // ... video upload code ...
        
        saveData = {
          ...saveData,
          mediaType: 'video',
          mediaUrl: videoUrl
        };
      }

      onSave(saveData);
      setIsEditing(false);
      setUploading(false);
    } catch (error) {
      console.error('Error in QuestionCard save:', error);
      Alert.alert('Error', 'Failed to save your answer. Please try again.');
      setUploading(false);
    }
  };

  return (
    <View 
      style={styles.card}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Question: ${question}`}
    >
      <Text 
        style={styles.question}
        accessibilityRole="header"
      >
        {question}
      </Text>

      <View 
        style={styles.modeButtons}
        accessibilityRole="tablist"
      >
        <View style={styles.modeButtonContainer}>
          <TouchableOpacity 
            style={[styles.modeButton, mode === 'text' && styles.selectedMode]}
            onPress={() => setMode('text')}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel="Text answer mode"
            accessibilityState={{ selected: mode === 'text' }}
            accessibilityHint="Double tap to switch to text answer mode"
          >
            <MaterialCommunityIcons 
              name="pencil" 
              size={24} 
              color={mode === 'text' ? '#fff' : '#24269B'} 
              accessibilityRole="image"
            />
          </TouchableOpacity>
          <Text style={[
            styles.modeButtonLabel, 
            mode === 'text' && styles.selectedModeLabel
          ]}>
            Write
          </Text>
        </View>

        <View style={styles.modeButtonContainer}>
          <TouchableOpacity 
            style={[styles.modeButton, mode === 'preset' && styles.selectedMode]}
            onPress={() => setMode('preset')}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel="Word selection mode"
            accessibilityState={{ selected: mode === 'preset' }}
            accessibilityHint="Double tap to switch to word selection mode"
          >
            <MaterialCommunityIcons 
              name="format-list-bulleted" 
              size={24} 
              color={mode === 'preset' ? '#fff' : '#24269B'} 
              accessibilityRole="image"
            />
          </TouchableOpacity>
          <Text style={[
            styles.modeButtonLabel, 
            mode === 'preset' && styles.selectedModeLabel
          ]}>
            Pick Words
          </Text>
        </View>

        <View style={styles.modeButtonContainer}>
          <TouchableOpacity 
            style={[styles.modeButton, mode === 'video' && styles.selectedMode]}
            onPress={() => setMode('video')}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel="Video answer mode"
            accessibilityState={{ selected: mode === 'video' }}
            accessibilityHint="Double tap to switch to video answer mode"
          >
            <MaterialCommunityIcons 
              name="video" 
              size={24} 
              color={mode === 'video' ? '#fff' : '#24269B'} 
              accessibilityRole="image"
            />
          </TouchableOpacity>
          <Text style={[
            styles.modeButtonLabel, 
            mode === 'video' && styles.selectedModeLabel
          ]}>
            Upload Video
          </Text>
        </View>
      </View>

      {mode === 'text' && (
        <>
          <TextInput
            style={styles.input}
            value={textAnswer}
            onChangeText={handleAnswerChange}
            placeholder="Type your answer..."
            multiline
            numberOfLines={4}
            maxLength={MAX_CHARACTERS}
            accessible={true}
            accessibilityLabel="Answer text input"
            accessibilityHint={`Enter your answer here. Maximum ${MAX_CHARACTERS} characters`}
          />
          <Text style={styles.characterCount}>
            {textAnswer.length}/{MAX_CHARACTERS} characters
          </Text>
          <TouchableOpacity 
            style={[
              styles.saveButton, 
              (!textAnswer || textAnswer.length > MAX_CHARACTERS) && styles.disabledButton
            ]}
            onPress={handleTextSave}
            disabled={!textAnswer || textAnswer.length > MAX_CHARACTERS}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? "Save answer" : "Type to edit answer"}
            accessibilityState={{ 
              disabled: !textAnswer || textAnswer.length > MAX_CHARACTERS 
            }}
            accessibilityHint={`Double tap to ${isEditing ? 'save' : 'start editing'} your answer`}
          >
            <Text style={styles.saveButtonText}>
              {isEditing ? 'Save' : 'Type to Edit'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {mode === 'preset' && (
        <View 
          style={styles.presetContainer}
          accessible={true}
          accessibilityRole="list"
          accessibilityLabel="Word selection options"
        >
          {presetWords.map((word, index) => {
            const isSelected = selectedWords.includes(word);
            return (
              <TouchableOpacity 
                key={index}
                style={[styles.presetButton, isSelected && styles.selectedPreset]}
                onPress={() => handlePresetSelect(word)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`${word}${isSelected ? ', selected' : ''}`}
                accessibilityState={{ selected: isSelected }}
                accessibilityHint={`Double tap to ${isSelected ? 'deselect' : 'select'} this word`}
              >
                <Text style={[styles.presetText, isSelected && styles.selectedPresetText]}>
                  {word}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {mode === 'video' && (
        <View 
          style={styles.videoContainer}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="Video answer section"
        >
          {video ? (
            <>
              <Video
                source={{ uri: video }}
                style={styles.video}
                useNativeControls
                resizeMode="contain"
                isLooping
                shouldPlay={false}
                accessibilityLabel="Your recorded video answer"
                accessibilityHint="Use video controls to play, pause, or seek"
                posterStyle={{ width: '100%', height: '100%' }}
              />
            </>
          ) : (
            <>
              <MaterialCommunityIcons 
                name="video-plus" 
                size={48} 
                color="#24269B"
                accessibilityRole="image" 
              />
              <TouchableOpacity 
                style={[styles.uploadButton, uploading && styles.uploadingButton]}
                onPress={pickVideo}
                disabled={uploading}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={uploading ? `Uploading: ${uploadProgress}%` : "Add video"}
                accessibilityState={{ disabled: uploading }}
                accessibilityHint="Double tap to select a video to upload"
              >
                {uploading ? (
                  <View 
                    style={styles.uploadingContainer}
                    accessibilityRole="progressbar"
                    accessibilityValue={{ now: uploadProgress, min: 0, max: 100 }}
                  >
                    <Text style={styles.uploadingText}>
                      Uploading: {uploadProgress}%
                    </Text>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                    </View>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>Add Video</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Show preview after upload */}
      {questionData.mediaUrl && questionData.mediaType === 'video' && (
        <View>
          <View style={styles.previewContainer}>
            <Video
              source={{ uri: questionData.mediaUrl }}
              style={styles.videoPreview}
              useNativeControls
              resizeMode="contain"
              shouldPlay={false}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Your video answer. Double tap to play."
              accessibilityHint="Use video controls to play, pause, or seek through the video"
              videoStyle={{ width: '100%', height: '100%' }}
            />
          </View>
          <View style={styles.videoButtonsContainer}>
            <TouchableOpacity
              style={[styles.uploadButton, styles.videoActionButton]}
              onPress={pickVideo}
              accessible={true}
              accessibilityLabel="Change video"
              accessibilityHint="Double tap to select a different video"
            >
              <Text style={styles.buttonText}>Change Video</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.uploadButton, styles.deleteButton]}
              onPress={() => {
                Alert.alert(
                  'Delete Video',
                  'Are you sure you want to delete this video?',
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                    },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await updateFirestore({
                            mediaUrl: null,
                            mediaType: null
                          });
                          
                          setQuestionData(prev => ({
                            ...prev,
                            mediaUrl: null,
                            mediaType: null
                          }));
                          
                          Alert.alert('Success', 'Video deleted successfully');
                        } catch (error) {
                          console.error('Error deleting video:', error);
                          Alert.alert('Error', 'Failed to delete video');
                        }
                      },
                    },
                  ],
                  { cancelable: true }
                );
              }}
              accessible={true}
              accessibilityLabel="Delete video"
              accessibilityHint="Double tap to delete this video"
            >
              <Text style={styles.buttonText}>Delete Video</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginVertical: 10,
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#000000',
  },
  question: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  modeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  modeButton: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  selectedMode: {
    backgroundColor: '#24269B',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  presetButton: {
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#24269B',
    marginBottom: 10,
  },
  selectedPreset: {
    backgroundColor: '#24269B',
  },
  presetText: {
    color: '#24269B',
  },
  selectedPresetText: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#24269B',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  disabledButton: {
    backgroundColor: '#999',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  videoContainer: {
    width: '100%',
    maxWidth: 300,
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    maxWidth: 300,
    maxHeight: 200,
  },
  uploadButton: {
    backgroundColor: '#24269B',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
  },
  newVideoButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#24269B',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  messageText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  locationContainer: {
    marginVertical: 10,
    padding: 10,
  },
  locationInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    marginBottom: 10,
    fontSize: 14,
  },
  locationButton: {
    backgroundColor: '#24269B',
    padding: 10,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 5,
  },
  uploadingContainer: {
    width: '100%',
    alignItems: 'center',
  },
  uploadingText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 6,
  },
  progressBarContainer: {
    width: '90%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 2,
  },
  previewContainer: {
    width: '100%',
    maxWidth: 600,
    height: 460,
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignSelf: 'center',
  },
  videoPreview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  videoButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    gap: 10,
    paddingHorizontal: 15,
  },
  videoActionButton: {
    flex: 1,
    backgroundColor: '#24269B',
    marginVertical: 0,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    marginVertical: 0,
  },
  videoToggleButton: {
    backgroundColor: '#24269B',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  videoToggleButtonActive: {
    backgroundColor: '#1a1b6e',
  },
  videoToggleText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  modeButtonContainer: {
    alignItems: 'center',
  },
  modeButtonLabel: {
    fontSize: 12,
    color: '#24269B',
    marginTop: 4,
  },
  selectedModeLabel: {
    color: '#24269B',
    fontWeight: 'bold',
  },
  characterCount: {
    textAlign: 'right',
    color: '#666',
    fontSize: 12,
    marginTop: 5,
    marginRight: 5,
  },
});

export default QuestionCard; 