import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Video } from 'expo-av';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { format } from 'date-fns';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const isWeb = Platform.OS === 'web';

const WinHistoryCard = ({ win, onPress }) => {
  console.log('WinHistoryCard full win data:', win);
  console.log('Win media URL:', win.mediaUrl);
  console.log('Win media type:', win.mediaType);

  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes} ${period}`;
    } catch (error) {
      console.log('Time formatting error:', error);
      return timeString;
    }
  };

  const formattedTime = win.localTimestamp ? formatTime(win.localTimestamp.time) : '';
  const cheersDescription = win.cheers > 0 ? `${win.cheers} cheers` : '';
  const commentsCount = win.comments?.length || 0;

  return (
    <TouchableOpacity 
      style={[styles.container, isWeb && styles.webContainer]} 
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Win: ${win.text}${formattedTime ? `, posted at ${formattedTime}` : ''}${cheersDescription ? `, received ${cheersDescription}` : ''}${commentsCount ? `, has ${commentsCount} comments` : ''}`}
      accessibilityHint="Double tap to view win details"
    >
      <View 
        style={[styles.content, isWeb && styles.webContent]}
        accessible={true}
        accessibilityRole="text"
      >
        <Text 
          style={[styles.title, isWeb && styles.webTitle]}
          accessibilityRole="header"
        >
          {win.text}
        </Text>
        {win.localTimestamp && (
          <Text 
            style={[styles.timestamp, isWeb && styles.webTimestamp]}
            accessibilityRole="text"
          >
            {formattedTime}
          </Text>
        )}
      </View>
      
      {win.mediaUrl && win.mediaType === 'photo' && (
        <View 
          style={[styles.imageContainer, isWeb && styles.webImageContainer]}
          accessible={true}
          accessibilityRole="image"
          accessibilityLabel={win.altText || "Photo attached to win"}
        >
          <Image
            source={{ uri: win.mediaUrl }}
            style={[styles.image, isWeb && styles.webImage]}
            resizeMode="cover"
            accessible={true}
            accessibilityRole="image"
            accessibilityLabel={win.altText || "Photo attached to win"}
          />
        </View>
      )}

      {win.comments && win.comments.length > 0 && (
        <View 
          style={[styles.commentsContainer, isWeb && styles.webCommentsContainer]}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`${win.comments.length} comments`}
        >
          {win.comments.map((comment, index) => (
            <Text 
              key={index} 
              style={[styles.comment, isWeb && styles.webComment]}
              accessibilityRole="text"
            >
              {comment.text}
            </Text>
          ))}
        </View>
      )}

      {win.cheers > 0 && (
        <View 
          style={[styles.cheersContainer, isWeb && styles.webCheersContainer]}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`${win.cheers} cheers`}
        >
          <MaterialCommunityIcons 
            name="heart" 
            size={16} 
            color="#FF4B4B"
            accessibilityRole="image"
            accessibilityLabel="Heart icon"
          />
          <Text style={[styles.cheersText, isWeb && styles.webCheersText]}>{win.cheers}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 15,
    marginVertical: 5,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#eee',
    minHeight: 80,
  },
  webContainer: {
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    },
    maxWidth: 800,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  content: {
    marginBottom: 10,
  },
  webContent: {
    padding: 5,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#24269B',
  },
  webTitle: {
    fontSize: 18,
    lineHeight: 1.4,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  webTimestamp: {
    fontSize: 14,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  webImageContainer: {
    height: 300,
    borderRadius: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  webImage: {
    objectFit: 'cover',
  },
  commentsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  webCommentsContainer: {
    padding: 10,
  },
  comment: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  webComment: {
    fontSize: 15,
    lineHeight: 1.4,
    padding: 5,
  },
  cheersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  webCheersContainer: {
    padding: 5,
  },
  cheersText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  webCheersText: {
    fontSize: 15,
  },
});

export default WinHistoryCard; 