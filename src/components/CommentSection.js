import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const CommentSection = ({ comments = [], showAllComments, setShowAllComments }) => {
  if (!comments || comments.length === 0) return null;

  const displayComments = showAllComments ? comments : comments.slice(0, 2);

  return (
    <View 
      style={styles.container}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel="Comments section"
    >
      {displayComments.map((comment, index) => (
        <View 
          key={index} 
          style={styles.comment}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`Comment ${index + 1} of ${displayComments.length}: ${comment.text}`}
        >
          <Text style={styles.commentText}>{comment.text}</Text>
        </View>
      ))}
      
      {comments.length > 2 && (
        <TouchableOpacity
          onPress={() => setShowAllComments(!showAllComments)}
          style={styles.viewMoreButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={showAllComments 
            ? "Show less comments" 
            : `View all ${comments.length} comments`}
          accessibilityHint={showAllComments
            ? "Double tap to show fewer comments"
            : "Double tap to expand and show all comments"}
        >
          <Text style={styles.viewMoreText}>
            {showAllComments ? 'Show less' : `View all ${comments.length} comments`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  comment: {
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
  },
  viewMoreButton: {
    marginTop: 4,
    paddingVertical: 4,
  },
  viewMoreText: {
    fontSize: 14,
    color: '#666',
  },
});

export default CommentSection; 