import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Video } from 'expo-av';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const OtherUserQuestionCard = ({ question, questionId, backgroundColor, userId }) => {
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedWords, setSelectedWords] = useState([]);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('text');
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const fetchAnswers = async () => {
      try {
        if (!userId) {
          console.log('Missing userId:', userId);
          return;
        }

        console.log('Fetching answers for question:', question);

        // Fetch the user document which contains the questionAnswers array
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const questionAnswers = userData.questionAnswers || [];
          
          // Find the answer for this specific question using the question text
          const answer = questionAnswers.find(qa => qa.question === question);
          
          if (answer) {
            console.log('Found answer:', answer);
            setTextAnswer(answer.textAnswer || '');
            setSelectedWords(answer.selectedWords || []);
            setMediaUrl(answer.videoAnswer || null);
            console.log('Setting mediaUrl to:', answer.videoAnswer);
          } else {
            console.log('No answer found for question:', question);
          }
        }

      } catch (error) {
        console.error('Error fetching answers:', error);
      }
    };

    fetchAnswers();
  }, [question, userId]);

  // Cleanup video when component unmounts or video is hidden
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.unloadAsync();
      }
    };
  }, []);

  const handleVideoError = (error) => {
    console.error('Video error:', error);
    setShowVideo(false);
    alert('Error playing video. Please try again.');
  };

  const togglePlayback = async () => {
    if (!videoRef.current) return;
    
    const status = await videoRef.current.getStatusAsync();
    if (status.isPlaying) {
      await videoRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await videoRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'text':
        return (
          <Text 
            style={styles.textAnswer}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel={textAnswer || 'No written answer yet'}
          >
            {textAnswer || 'No written answer yet'}
          </Text>
        );
      case 'words':
        return (
          <View 
            style={styles.wordsContainer}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel={`Selected words: ${selectedWords.length > 0 ? selectedWords.join(', ') : 'None selected yet'}`}
          >
            {selectedWords.length > 0 ? (
              selectedWords.map((word, index) => (
                <View 
                  key={index} 
                  style={styles.wordBubble}
                  accessible={true}
                  accessibilityRole="text"
                >
                  <Text style={styles.wordText}>{word}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noAnswer}>No selected words yet</Text>
            )}
          </View>
        );
      case 'video':
        return mediaUrl ? (
          <View 
            style={styles.mediaContainer}
            accessible={true}
            accessibilityRole="adjustable"
            accessibilityLabel="Video answer"
            accessibilityHint="Use native video controls to play, pause, or seek through the video"
          >
            <Video
              ref={videoRef}
              source={{ uri: mediaUrl }}
              style={styles.media}
              resizeMode="contain"
              shouldPlay={false}
              useNativeControls={true}
              onLoad={() => console.log('Video loaded successfully')}
              onError={(error) => console.log('Video loading error:', error)}
            />
            <TouchableOpacity
              style={styles.playButton}
              onPress={togglePlayback}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? "Pause video" : "Play video"}
              accessibilityHint={`Double tap to ${isPlaying ? 'pause' : 'play'} the video`}
            >
              <MaterialCommunityIcons
                name={isPlaying ? 'pause' : 'play'}
                size={50}
                color="white"
                accessibilityRole="image"
              />
            </TouchableOpacity>
          </View>
        ) : (
          <Text 
            style={styles.noAnswer}
            accessible={true}
            accessibilityRole="text"
          >
            No video answer yet
          </Text>
        );
      default:
        return null;
    }
  };

  return (
    <View 
      style={[styles.card, { backgroundColor }]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Question: ${question}`}
    >
      <Text 
        style={styles.question}
        accessible={true}
        accessibilityRole="header"
      >
        {question}
      </Text>
      
      <View 
        style={styles.tabContainer}
        accessibilityRole="tablist"
      >
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'text' && styles.activeTab]} 
          onPress={() => setActiveTab('text')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityLabel="Written answer tab"
          accessibilityState={{ selected: activeTab === 'text' }}
          accessibilityHint="Double tap to view written answer"
        >
          <MaterialCommunityIcons 
            name="pencil" 
            size={24} 
            color={activeTab === 'text' ? '#FFFFFF' : '#666'} 
            accessibilityRole="image"
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'words' && styles.activeTab]} 
          onPress={() => setActiveTab('words')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityLabel="Selected words tab"
          accessibilityState={{ selected: activeTab === 'words' }}
          accessibilityHint="Double tap to view selected words"
        >
          <MaterialCommunityIcons 
            name="format-list-bulleted" 
            size={24} 
            color={activeTab === 'words' ? '#FFFFFF' : '#666'} 
            accessibilityRole="image"
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'video' && styles.activeTab]} 
          onPress={() => setActiveTab('video')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityLabel="Video answer tab"
          accessibilityState={{ selected: activeTab === 'video' }}
          accessibilityHint="Double tap to view video answer"
        >
          <MaterialCommunityIcons 
            name="video" 
            size={24} 
            color={activeTab === 'video' ? '#FFFFFF' : '#666'} 
            accessibilityRole="image"
          />
        </TouchableOpacity>
      </View>

      <View 
        style={styles.contentContainer}
        accessible={true}
        accessibilityRole="text"
      >
        {renderContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  question: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    padding: 5,
  },
  tab: {
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#24269B',
  },
  activeTab: {
    backgroundColor: '#24269B',
  },
 
  contentContainer: {
    minHeight: 100,
  },
  textAnswer: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  wordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  wordText: {
    fontSize: 14,
    color: '#444',
  },
  video: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  noAnswer: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  videoToggleButton: {
    backgroundColor: '#24269B',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  videoToggleText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  videoContainer: {
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    marginTop: 10,
  },
  mediaContainer: {
    width: '100%',
    aspectRatio: 4/3,
    borderRadius: 5,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '100%',
  },
});

export default OtherUserQuestionCard; 