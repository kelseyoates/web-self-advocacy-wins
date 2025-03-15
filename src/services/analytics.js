import { db } from '../config/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  addDoc,
  Timestamp 
} from 'firebase/firestore';

export const logSupporterActivity = async (supporterId, userId, activityType) => {
  try {
    await addDoc(collection(db, 'supporter_activities'), {
      supporterId: supporterId.toLowerCase(),
      userId: userId.toLowerCase(),
      activityType,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    console.error('Error logging supporter activity:', error);
  }
};

export const getSupporterStats = async (supporterId) => {
  try {
    const stats = {
      totalSupportedUsers: 0,
      activeChats: 0,
      totalMessagesViewed: 0,
      averageResponseTime: 0,
      lastActive: null
    };

    // Get supported users count
    const userDoc = await getDoc(doc(db, 'users', supporterId.toLowerCase()));
    if (userDoc.exists()) {
      stats.totalSupportedUsers = userDoc.data().supporting?.length || 0;
    }

    // Get activity metrics
    const activitiesRef = collection(db, 'supporter_activities');
    const recentActivities = query(
      activitiesRef,
      where('supporterId', '==', supporterId.toLowerCase()),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const activities = await getDocs(recentActivities);
    if (!activities.empty) {
      stats.lastActive = activities.docs[0].data().timestamp;
      
      // Calculate message view stats
      const messageViews = activities.docs.filter(
        doc => doc.data().activityType === 'message_view'
      );
      stats.totalMessagesViewed = messageViews.length;
    }

    return stats;
  } catch (error) {
    console.error('Error getting supporter stats:', error);
    throw error;
  }
};

export const getUserSupportHistory = async (userId) => {
  try {
    const activities = [];
    const activitiesRef = collection(db, 'supporter_activities');
    const userActivities = query(
      activitiesRef,
      where('userId', '==', userId.toLowerCase()),
      orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(userActivities);
    
    for (const doc of snapshot.docs) {
      const activity = doc.data();
      const supporterDoc = await getDoc(
        doc(db, 'users', activity.supporterId)
      );
      
      activities.push({
        ...activity,
        supporterName: supporterDoc.data()?.username || 'Unknown Supporter'
      });
    }

    return activities;
  } catch (error) {
    console.error('Error getting user support history:', error);
    throw error;
  }
}; 