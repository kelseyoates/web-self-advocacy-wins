import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const updateUserDatingProfile = async (userId, datingProfile) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      gender: datingProfile.gender,
      lookingFor: datingProfile.lookingFor,
      ageRange: datingProfile.ageRange,
      datingAnswers: datingProfile.datingAnswers
    });
    return true;
  } catch (error) {
    console.error('Error updating dating profile:', error);
    throw error;
  }
};

// Add this function to fetch dating profiles
export const getDatingProfiles = async () => {
  try {
    const snapshot = await firebase.firestore()
      .collection('users')
      .where('subscriptionType', '==', 'Self-Advocate - Dating')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching dating profiles:', error);
    throw error;
  }
}; 