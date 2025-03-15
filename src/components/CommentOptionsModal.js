import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, Dimensions } from 'react-native';

const CommentOptionsModal = ({ visible, onClose, onSelectComment }) => {
  if (!visible) return null;

  const comments = [
    { text: "Look at you go! 👏✨", description: "Look at you go with clapping hands and sparkles" },
    { text: "You're doing big things! 👏💯", description: "You're doing big things with clapping hands and hundred points" },
    { text: "Keep spreading positivity! 🌈👊", description: "Keep spreading positivity with rainbow and fist bump" }
  ];

  return (
    <Pressable 
      style={styles.overlay} 
      onPress={onClose}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Close comment options"
      accessibilityHint="Double tap to close the comment selection modal"
    >
      <View 
        style={styles.sheet}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel="Comment options sheet"
      >
        <View style={styles.content}>
          <View 
            style={styles.header}
            accessible={true}
            accessibilityRole="text"
          >
            <View style={styles.handle} />
            <Text style={styles.title}>Choose a comment</Text>
          </View>

          {comments.map((comment, index) => (
            <TouchableOpacity
              key={index}
              style={styles.option}
              onPress={() => {
                onSelectComment(comment.text);
                onClose();
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={comment.description}
              accessibilityHint="Double tap to select this comment"
            >
              <Text style={styles.optionText}>{comment.text}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={onClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Cancel comment selection"
            accessibilityHint="Double tap to close without selecting a comment"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  );
};

const windowHeight = Dimensions.get('window').height;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -windowHeight,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 9999,
    elevation: 9999,
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    maxHeight: windowHeight * 0.9,
    marginBottom: windowHeight,
    zIndex: 10000,
    elevation: 10000,
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#24269B',
  },
  option: {
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  cancelButton: {
    padding: 16,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    fontWeight: '500',
  },
});

export default CommentOptionsModal; 