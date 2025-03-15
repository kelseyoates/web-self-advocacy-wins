import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Topic colors and helper function
export const topicColors = {
  'Daily Living': '#E8F5E9',  // Light green
  'Work/School': '#E3F2FD',   // Light blue
  'Wellness': '#FFF3E0',      // Light orange
  'Fun': '#F3E5F5',          // Light purple
  // Add more topic/color pairs as needed
};
console.log('Defined topic colors:', topicColors);

export const getTopicColor = (topic) => {
  return topicColors[topic] || '#F5F5F5'; // Default to light gray if topic not found
};

// Global styles object
const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 20,
    backgroundColor: '#F0F4FF',
    paddingBottom: 100,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,  // Add significant padding at the bottom
  },
  contentContainer: {
    flex: 1,
    paddingVertical: 20,
  },


  label: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 0,
    color: '#333',
  },
  input: {
    height: 50,
    borderColor: '#000000',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  

  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 8,
    paddingBottom: 8,
  },

  headerIcon: {
    width: 24,
    height: 24,
  },

  button: {
    backgroundColor: '#24269B',
    borderRadius: 5,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    height: 70,
  },

  buttonText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
  },

  buttonIcon: {
    marginLeft: 2,
  },

  buttonContainer: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#F0F4FF',
    paddingTop: 10,
  },

  postContainer: {
    marginVertical: 8,
    padding: 10,
    backgroundColor: '#FFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2, // For Android shadow
  },
  postText: {
    fontSize: 16,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 32,
    fontFamily: 'Jost_700Bold', // Use the bold font
    fontWeight: 'normal', // Prevent system override
    justifyContent: 'center', // Center vertically
    },
  postContainer: {
    marginVertical: 10,
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  postTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  postContent: {
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 18,
    color: '#777',
  },
  iconButton: {
    marginRight: 15,
  },
  inputGroup: {
    marginVertical: 10,
  },
  labelWithIcon: {
    flexDirection: 'row', // Align horizontally
    alignItems: 'center', // Align vertically center
    marginBottom: 0,
  },
  labelText: {
    marginLeft: 5, // Spacing between icon and text
    fontSize: 16,
    fontWeight: 'bold',
  },
  winContainer: {
    marginVertical: 10,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#000000',
  },
  winText: {
    fontSize: 18,
    fontFamily: 'Jost_400Regular',
    marginBottom: 10,
  },

  bodyText: {
    fontSize: 18,
    fontFamily: 'Jost_400Regular',
    marginBottom: 10,
  },


  winImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },

  winImage: {
    width: '100%',  // Takes full width of container
    height: 400,    // Fixed height, adjust as needed
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,
    resizeMode: 'cover',  // This will maintain aspect ratio
  },

  videoText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#777',
  },

  logo: {
    width: 300,    // Adjust size to fit your design
    height: 120,
    marginBottom: 20, // Space between image and title
    alignSelf: 'center', // Center the logo at the top
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center content horizontally
    marginBottom: 20,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 10,
    width: 100, // Set desired width
    borderRadius: 8, // Rounded corners
    borderColor: '#000', // Set desired border color
    borderWidth: 2, // Set desired border width
  },

  backButtonText: {
    marginLeft: 5,
    fontSize: 18,
  },

  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center content horizontally
    marginBottom: 20,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 10,
    width: 100, // Set desired width
    borderRadius: 8, // Rounded corners
    borderColor: '#000', // Set desired border color
    borderWidth: 2, // Set desired border width
  },

  viewMoreButtonText: {
    marginLeft: 5,
    fontSize: 18,
  },

  userText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },


  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  topicContainer: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#000',  // Changed from '#24269B' to '#000' for black border
  },
  topicText: {
    fontSize: 14,
    color: '#555',
  },

  calendarContainer: {
    backgroundColor: '#ffffff',
    calendarBackground: '#ffffff',
    textSectionTitleColor: '#24269B',
    selectedDayBackgroundColor: '#24269B',
    selectedDayTextColor: '#ffffff',
    todayTextColor: '#24269B',
    dayTextColor: '#2d4150',
    textDisabledColor: '#d9e1e8',
    dotColor: '#24269B',
    selectedDotColor: '#ffffff',
    arrowColor: '#24269B',
    monthTextColor: '#24269B',
    indicatorColor: '#24269B',
  },


  detailText: {
    fontSize: 18,
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  halfButton: {
    flex: 1,  // This makes the buttons take equal width
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    gap: 8,  // This adds space between the icon and text
  },
  buttonTextWithIcon: {
    marginLeft: 8,  // Add some space between icon and text
  },
  
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },


  topicButton: {
    flex: 1,
    minWidth: '45%',  // Ensures buttons take up roughly half the width
    aspectRatio: 1,   // Makes buttons square
    margin: 8,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  selectedTopicButton: {
    backgroundColor: '#24269B',
    borderColor: '#24269B',    // Change border color when selected
  },
  topicIcon: {
    width: '100%',  // Make image fill the button width
    height: 100,    // Adjust this value as needed
    resizeMode: 'contain',  // This will maintain aspect ratio
    marginBottom: 8,  // Space between image and text
  },
  topicLabel: {
    fontSize: 16,
    fontFamily: 'Jost_400Regular',
    textAlign: 'center',
    color: '#000000',          // Ensure text is black by default
  },
  selectedTopicLabel: {
    color: '#fff',             // Keep text white when selected
  },
  sectionLabel: {
    fontSize: 18,
    marginBottom: 15,
    fontFamily: 'Jost_400Regular',
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 40,
  },

  topicItem: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
  },
  selectedTopic: {
    backgroundColor: '#24269B',
  },
  topicText: {
    fontSize: 16,
    fontFamily: 'Jost_400Regular',
    textAlign: 'center',
  },
  selectedTopicText: {
    color: '#fff',
  },

  goalText: {
    fontSize: 18,
    marginBottom: 10,
    fontFamily: 'Jost_700Bold', // Use the bold font
    fontWeight: 'normal', // Prevent system override
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',  // Add this to center the contents
    backgroundColor: 'red',
    padding: 15,
    borderRadius: 8,
    color: '#fff',
  },

  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
    justifyContent: 'center',
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 32,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
    minWidth: 140,
  },
  activeTab: {
    backgroundColor: '#FFB6E3',
    borderColor: '#000000',
  },
  tabText: {
    fontSize: 16,
    fontFamily: 'Jost_500Medium',
    color: '#24269B',
  },
  activeTabText: {
    color: '#000000',
  },

  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
  },

  goalAndChallengeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#000000',
  },

 cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor:  '#000000',
  },
  
  goalAndChallengeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconGoalContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFB6E3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  iconChallengeContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f4bf4f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },


  trophyContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  cardIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },

  cardTitle: {
    fontSize: 16,
    fontFamily: 'Jost_500Medium',
    marginBottom: 8,
  },

  cardTextContainer: {
    flex: 1,
  },

  textContainer: {
    flex: 1,
  },
 

  goalAndChallengeText: {
    fontSize: 16,
    fontFamily: 'Jost_500Medium',
    marginBottom: 4,
    color: '#000000',
  },

  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginRight: 8,
    gap: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
  },
  dotFilled: {
    backgroundColor: '#24269B',
  },

  dotGoalFilled: {
    backgroundColor: '#FF99DC',
  },

  dotChallengeFilled: {
    backgroundColor: '#F1AD1F',
  },


  progressText: {
    fontSize: 14,
    fontFamily: 'Jost_400Regular',
    color: '#666666',
  },
  
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 8,
  },
  statGoalBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ff99dc',
    borderWidth: 1,
    borderColor: '#000000',
  },
  statChallengeBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1AD1F',
    borderWidth: 1,
    borderColor: '#000000',
  },

  badgeIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: '#000000',
  },

  badgeNumber: {
    fontSize: 20,
    fontFamily: 'Jost_500Medium',
    color: '#000000',
  },

  progressSegment: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 1,
    borderWidth: 1,
    borderColor: '#000000',
  },





});

export default globalStyles;