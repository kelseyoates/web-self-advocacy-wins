import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAccessibility } from '../context/AccessibilityContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const ManageSubscriptionScreen = () => {
  const navigation = useNavigation();
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showHelpers } = useAccessibility();

  useEffect(() => {
    fetchUserSubscription();
  }, []);

  const fetchUserSubscription = async () => {
    try {
      const userId = auth.currentUser.uid.toLowerCase();
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setCurrentSubscription(userDoc.data().subscriptionType);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      Alert.alert('Error', 'Failed to load subscription information');
      setLoading(false);
    }
  };

  const handleSubscriptionChange = async (newType) => {
    try {
      // For all subscription changes, use the customer portal
      const portalLink = 'https://billing.stripe.com/p/login/9AQ5lZaOS8EH5LWfYY';
      
      const supported = await Linking.canOpenURL(portalLink);
      
      if (supported) {
        await Linking.openURL(portalLink);
        Alert.alert(
          'Subscription Management',
          'After making changes to your subscription, please return to the app and restart it to see your updated features.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Main' }],
                });
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Could not open subscription management page');
      }
    } catch (error) {
      console.error('Subscription change error:', error);
      Alert.alert('Error', 'Failed to open subscription management');
    }
  };

  if (loading) {
    return (
      <ScrollView 
        style={styles.container}
        accessible={false}
      >
        <View style={styles.container} accessible={true} accessibilityRole="progressbar">
          <Text style={styles.loadingText} accessibilityLabel="Loading your subscription information">
            Loading subscription info...
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      accessible={false}
    >
      {showHelpers && (
        <View 
          style={styles.helperSection}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="Helper Information: Manage Your Subscription. You can view your current plan and switch to a different plan if you'd like. To subscribe to a paid plan, you will need a credit or debit card. After making changes, you may need to restart the app to see your new features."
        >
          <View style={styles.helperHeader}>
            <MaterialCommunityIcons 
              name="information" 
              size={24} 
              color="#24269B"
              style={styles.infoIcon}
              importantForAccessibility="no"
            />
          </View>
          <Text style={styles.helperTitle}>Manage Your Subscription</Text>
          <View style={styles.helperTextContainer}>
            <Text style={styles.helperText}>
              • View your current plan and its features
            </Text>
            <Text style={styles.helperText}>
              • Switch to a different plan at any time
            </Text>
            <Text style={styles.helperText}>
              • Credit or debit card required for paid plans
            </Text>
            <Text style={styles.helperText}>
              • Restart app after changes to see new features
            </Text>
          </View>
        </View>
      )}

      <Text 
        style={styles.title} 
        accessible={true}
        accessibilityRole="text"
      >
        Manage Your Subscription
      </Text>
      
      <View 
        style={styles.currentPlanCard} 
        accessible={true} 
        accessibilityRole="text"
        accessibilityLabel={`Current plan: ${
          currentSubscription === 'selfAdvocatePlus' ? 'Self Advocate Plus, ten dollars per month. Features include: Post wins, chat with others, and add supporters.' :
          currentSubscription === 'selfAdvocateDating' ? 'Self Advocate Dating, twenty dollars per month. Features include: All Plus features and access to dating features.' :
          currentSubscription === 'supporter1' ? 'Supporter 1, ten dollars per month. Features include: Support one self-advocate.' :
          currentSubscription === 'supporter5' ? 'Supporter 5, fifty dollars per month. Features include: Support up to five self-advocates.' :
          currentSubscription === 'supporter10' ? 'Supporter 10, one hundred dollars per month. Features include: Support up to ten self-advocates.' :
          'Self Advocate, Free plan. Features include: Basic access to post wins and chat.'
        }`}
      >
        <Text style={styles.currentPlanTitle}>Current Plan:</Text>
        <Text style={styles.currentPlanName}>
          {currentSubscription === 'selfAdvocatePlus' ? 'Self Advocate Plus - $10/month' :
           currentSubscription === 'selfAdvocateDating' ? 'Self Advocate Dating - $20/month' :
           currentSubscription === 'supporter1' ? 'Supporter 1 - $10/month' :
           currentSubscription === 'supporter5' ? 'Supporter 5 - $50/month' :
           currentSubscription === 'supporter10' ? 'Supporter 10 - $100/month' :
           'Self Advocate - Free'}
        </Text>
        
        <Text style={styles.featuresTitle}>Your Current Features:</Text>
        <View style={styles.featuresList}>
          {currentSubscription === 'selfAdvocatePlus' && (
            <>
              <Text style={styles.featureItem}>• Post wins and share your successes</Text>
              <Text style={styles.featureItem}>• Chat with other members</Text>
              <Text style={styles.featureItem}>• Add supporters to your network</Text>
            </>
          )}
          {currentSubscription === 'selfAdvocateDating' && (
            <>
              <Text style={styles.featureItem}>• All Plus features</Text>
              <Text style={styles.featureItem}>• Access to dating features</Text>
              <Text style={styles.featureItem}>• Dating profile customization</Text>
            </>
          )}
          {currentSubscription === 'supporter1' && (
            <>
              <Text style={styles.featureItem}>• Support one self-advocate</Text>
              <Text style={styles.featureItem}>• Chat with your supported member</Text>
              <Text style={styles.featureItem}>• View and cheer their wins</Text>
            </>
          )}
          {currentSubscription === 'supporter5' && (
            <>
              <Text style={styles.featureItem}>• Support up to five self-advocates</Text>
              <Text style={styles.featureItem}>• Chat with your supported members</Text>
              <Text style={styles.featureItem}>• View and cheer their wins</Text>
            </>
          )}
          {currentSubscription === 'supporter10' && (
            <>
              <Text style={styles.featureItem}>• Support up to ten self-advocates</Text>
              <Text style={styles.featureItem}>• Chat with your supported members</Text>
              <Text style={styles.featureItem}>• View and cheer their wins</Text>
            </>
          )}
          {(!currentSubscription || currentSubscription === 'selfAdvocateFree') && (
            <>
              <Text style={styles.featureItem}>• Post wins and share your successes</Text>
              <Text style={styles.featureItem}>• Basic chat features</Text>
              <Text style={styles.featureItem}>• View other members' wins</Text>
            </>
          )}
        </View>
      </View>

      <Text 
        style={styles.sectionTitle} 
        accessible={true}
        accessibilityRole="text"
      >
        Change Your Plan
      </Text>

      {/* Self Advocate Plans */}
      {!currentSubscription.startsWith('supporter') && (
        <>
          {currentSubscription !== 'selfAdvocateFree' && (
            <TouchableOpacity 
              style={styles.planButton}
              onPress={() => handleSubscriptionChange('selfAdvocateFree')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Downgrade to Self Advocate Free plan. Basic access to chat and post wins. No monthly cost."
              accessibilityHint="Double tap to change to the free plan"
            >
              <Text style={styles.planTitle}>Downgrade to Self Advocate - Free</Text>
              <Text style={styles.planPrice}>Free</Text>
              <Text style={styles.planDescription}>Basic access to chat and post wins.</Text>
            </TouchableOpacity>
          )}

          {currentSubscription !== 'selfAdvocatePlus' && (
            <TouchableOpacity 
              style={styles.planButton}
              onPress={() => handleSubscriptionChange('selfAdvocatePlus')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Switch to Self Advocate Plus plan. Add supporters, chat, and post wins. Monthly cost is ten dollars."
              accessibilityHint="Double tap to change to the plus plan"
            >
              <Text style={styles.planTitle}>Switch to Self Advocate Plus</Text>
              <Text style={styles.planPrice}>$10/month</Text>
              <Text style={styles.planDescription}>Add supporters, chat, and post wins.</Text>
            </TouchableOpacity>
          )}

          {currentSubscription !== 'selfAdvocateDating' && (
            <TouchableOpacity 
              style={styles.planButton}
              onPress={() => handleSubscriptionChange('selfAdvocateDating')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Switch to Self Advocate Dating plan. All Plus features and dating access. Monthly cost is fifteen dollars."
              accessibilityHint="Double tap to change to the dating plan"
            >
              <Text style={styles.planTitle}>Switch to Self Advocate Dating</Text>
              <Text style={styles.planPrice}>$20/month</Text>
              <Text style={styles.planDescription}>All Plus features and dating access</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Supporter Plans */}
      {!currentSubscription.includes('selfAdvocate') && (
        <>
          {currentSubscription !== 'supporter1' && (
            <TouchableOpacity 
              style={styles.planButton}
              onPress={() => handleSubscriptionChange('supporter1')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Switch to Supporter 1 plan. Support one self-advocate. Monthly cost is ten dollars."
              accessibilityHint="Double tap to change to the supporter 1 plan"
            >
              <Text style={styles.planTitle}>Switch to Supporter - 1</Text>
              <Text style={styles.planPrice}>$10/month</Text>
              <Text style={styles.planDescription}>Support one self-advocate</Text>
            </TouchableOpacity>
          )}

          {currentSubscription !== 'supporter5' && (
            <TouchableOpacity 
              style={styles.planButton}
              onPress={() => handleSubscriptionChange('supporter5')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Switch to Supporter 5 plan. Support up to five self-advocates. Monthly cost is fifteen dollars."
              accessibilityHint="Double tap to change to the supporter 5 plan"
            >
              <Text style={styles.planTitle}>Switch to Supporter - 5</Text>
              <Text style={styles.planPrice}>$50/month</Text>
              <Text style={styles.planDescription}>Support up to five self-advocates</Text>
            </TouchableOpacity>
          )}

          {currentSubscription !== 'supporter10' && (
            <TouchableOpacity 
              style={styles.planButton}
              onPress={() => handleSubscriptionChange('supporter10')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Switch to Supporter 10 plan. Support up to ten self-advocates. Monthly cost is twenty dollars."
              accessibilityHint="Double tap to change to the supporter 10 plan"
            >
              <Text style={styles.planTitle}>Switch to Supporter - 10</Text>
              <Text style={styles.planPrice}>$100/month</Text>
              <Text style={styles.planDescription}>Support up to ten self-advocates</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {currentSubscription !== 'selfAdvocateFree' && (
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={() => handleSubscriptionChange('cancel')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Cancel subscription"
          accessibilityHint="Double tap to begin subscription cancellation process"
        >
          <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  currentPlanCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#24269B',
  },
  currentPlanTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  currentPlanName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    color: '#333',
  },
  planButton: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#000000',
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  planPrice: {
    fontSize: 16,
    color: '#FF69B4',
    fontWeight: '500',
  },
  cancelButton: {
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    backgroundColor: '#f8f8f8',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#ff4444',
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  planDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  helperSection: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24269B',
    marginVertical: 10,
    marginHorizontal: 10,
    padding: 10,
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
  helperTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#24269B',
    marginBottom: 10,
    textAlign: 'center',
  },
  helperTextContainer: {
    width: '100%',
    paddingHorizontal: 10,
  },
  helperText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
    marginBottom: 10,
  },
  featuresList: {
    paddingLeft: 10,
  },
  featureItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default ManageSubscriptionScreen; 