import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Video } from 'expo-av';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { format } from 'date-fns';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

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
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Win: ${win.text}${formattedTime ? `, posted at ${formattedTime}` : ''}${cheersDescription ? `, received ${cheersDescription}` : ''}${commentsCount ? `, has ${commentsCount} comments` : ''}`}
      accessibilityHint="Double tap to view win details"
    >
      <View 
        style={styles.content}
        accessible={true}
        accessibilityRole="text"
      >
        <Text 
          style={styles.title}
          accessibilityRole="header"
        >
          {win.text}
        </Text>
        {win.localTimestamp && (
          <Text 
            style={styles.timestamp}
            accessibilityRole="text"
          >
            {formattedTime}
          </Text>
        )}
      </View>
      
      {win.mediaUrl && win.mediaType === 'photo' && (
        <View 
          style={styles.imageContainer}
          accessible={true}
          accessibilityRole="image"
          accessibilityLabel={win.altText || "Photo attached to win"}
        >
          <Image
            source={{ uri: win.mediaUrl }}
            style={styles.image}
            resizeMode="cover"
            accessible={true}
            accessibilityRole="image"
            accessibilityLabel={win.altText || "Photo attached to win"}
            onError={(error) => console.log('Image loading error:', error.nativeEvent.error)}
            onLoad={() => console.log('Image loaded successfully:', win.mediaUrl)}
          />
        </View>
      )}

      {win.comments && win.comments.length > 0 && (
        <View 
          style={styles.commentsContainer}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`${win.comments.length} comments`}
        >
          {win.comments.map((comment, index) => (
            <Text 
              key={index} 
              style={styles.comment}
              accessibilityRole="text"
            >
              {comment.text}
            </Text>
          ))}
        </View>
      )}

      {win.cheers > 0 && (
        <View 
          style={styles.cheersContainer}
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
          <Text style={styles.cheersText}>{win.cheers}</Text>
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
    minHeight: 80, // Ensure minimum touch target size
  },
  content: {
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#24269B',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  commentsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  comment: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  cheersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  cheersText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
});

export default WinHistoryCard; 