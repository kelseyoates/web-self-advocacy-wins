import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert, ScrollView, Platform } from 'react-native';
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
  const isWeb = Platform.OS === 'web';

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
      const portalLink = 'https://billing.stripe.com/p/login/9AQ5lZaOS8EH5LWfYY';
      
      if (isWeb) {
        window.open(portalLink, '_blank');
        Alert.alert(
          'Subscription Management',
          'After making changes to your subscription, please return to this page and refresh to see your updated features.',
          [{ text: 'OK' }]
        );
      } else {
        const supported = await Linking.canOpenURL(portalLink);
        if (supported) {
          await Linking.openURL(portalLink);
          Alert.alert(
            'Subscription Management',
            'After making changes to your subscription, please return to the app and restart it to see your updated features.',
            [{
              text: 'OK',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Main' }],
                });
              }
            }]
          );
        } else {
          Alert.alert('Error', 'Could not open subscription management page');
        }
      }
    } catch (error) {
      console.error('Subscription change error:', error);
      Alert.alert('Error', 'Failed to open subscription management');
    }
  };

  if (loading) {
    return (
      <ScrollView style={[styles.container, isWeb && styles.webContainer]}>
        <View style={[styles.loadingContainer, isWeb && styles.webLoadingContainer]} accessible={true} accessibilityRole="progressbar">
          <Text style={[styles.loadingText, isWeb && styles.webLoadingText]} accessibilityLabel="Loading your subscription information">
            Loading subscription info...
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, isWeb && styles.webContainer]}>
      <View style={[styles.content, isWeb && styles.webContent]}>
        {showHelpers && (
          <View style={[styles.helperSection, isWeb && styles.webHelperSection]}>
            <View style={[styles.helperHeader, isWeb && styles.webHelperHeader]}>
              <MaterialCommunityIcons 
                name="information" 
                size={24} 
                color="#24269B"
                style={styles.infoIcon}
                importantForAccessibility="no"
              />
            </View>
            <Text style={[styles.helperTitle, isWeb && styles.webHelperTitle]}>Manage Your Subscription</Text>
            <View style={styles.helperTextContainer}>
              {[
                'View your current plan and its features',
                'Switch to a different plan at any time',
                'Credit or debit card required for paid plans',
                'Restart app after changes to see new features'
              ].map((text, index) => (
                <Text key={index} style={[styles.helperText, isWeb && styles.webHelperText]}>
                  • {text}
                </Text>
              ))}
            </View>
          </View>
        )}

        <Text style={[styles.title, isWeb && styles.webTitle]}>
          Manage Your Subscription
        </Text>
        
        <View style={[styles.currentPlanCard, isWeb && styles.webCurrentPlanCard]}>
          <Text style={[styles.currentPlanTitle, isWeb && styles.webCurrentPlanTitle]}>Current Plan:</Text>
          <Text style={[styles.currentPlanName, isWeb && styles.webCurrentPlanName]}>
            {currentSubscription === 'selfAdvocatePlus' ? 'Self Advocate Plus - $10/month' :
             currentSubscription === 'selfAdvocateDating' ? 'Self Advocate Dating - $20/month' :
             currentSubscription === 'supporter1' ? 'Supporter 1 - $10/month' :
             currentSubscription === 'supporter5' ? 'Supporter 5 - $50/month' :
             currentSubscription === 'supporter10' ? 'Supporter 10 - $100/month' :
             'Self Advocate - Free'}
          </Text>
          
          <Text style={[styles.featuresTitle, isWeb && styles.webFeaturesTitle]}>Your Current Features:</Text>
          <View style={[styles.featuresList, isWeb && styles.webFeaturesList]}>
            {currentSubscription === 'selfAdvocatePlus' && (
              <>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• Post wins and share your successes</Text>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• Chat with other members</Text>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• Add supporters to your network</Text>
              </>
            )}
            {currentSubscription === 'selfAdvocateDating' && (
              <>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• All Plus features</Text>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• Access to dating features</Text>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• Dating profile customization</Text>
              </>
            )}
            {currentSubscription === 'supporter1' && (
              <>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• Support one self-advocate</Text>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• Chat with your supported member</Text>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• View and cheer their wins</Text>
              </>
            )}
            {currentSubscription === 'supporter5' && (
              <>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• Support up to five self-advocates</Text>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• Chat with your supported members</Text>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• View and cheer their wins</Text>
              </>
            )}
            {currentSubscription === 'supporter10' && (
              <>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• Support up to ten self-advocates</Text>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• Chat with your supported members</Text>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• View and cheer their wins</Text>
              </>
            )}
            {(!currentSubscription || currentSubscription === 'selfAdvocateFree') && (
              <>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• Post wins and share your successes</Text>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• Basic chat features</Text>
                <Text style={[styles.featureItem, isWeb && styles.webFeatureItem]}>• View other members' wins</Text>
              </>
            )}
          </View>
        </View>

        <Text style={[styles.sectionTitle, isWeb && styles.webSectionTitle]}>
          Change Your Plan
        </Text>

        <View style={[styles.plansContainer, isWeb && styles.webPlansContainer]}>
          {!currentSubscription.startsWith('supporter') && (
            <>
              {currentSubscription !== 'selfAdvocateFree' && (
                <TouchableOpacity 
                  style={[styles.planButton, isWeb && styles.webPlanButton]}
                  onPress={() => handleSubscriptionChange('selfAdvocateFree')}
                >
                  <Text style={[styles.planTitle, isWeb && styles.webPlanTitle]}>Downgrade to Self Advocate</Text>
                  <Text style={[styles.planPrice, isWeb && styles.webPlanPrice]}>Free</Text>
                  <Text style={[styles.planDescription, isWeb && styles.webPlanDescription]}>
                    Basic access to chat and post wins.
                  </Text>
                </TouchableOpacity>
              )}

              {currentSubscription !== 'selfAdvocatePlus' && (
                <TouchableOpacity 
                  style={[styles.planButton, isWeb && styles.webPlanButton]}
                  onPress={() => handleSubscriptionChange('selfAdvocatePlus')}
                >
                  <Text style={[styles.planTitle, isWeb && styles.webPlanTitle]}>Switch to Self Advocate Plus</Text>
                  <Text style={[styles.planPrice, isWeb && styles.webPlanPrice]}>$10/month</Text>
                  <Text style={[styles.planDescription, isWeb && styles.webPlanDescription]}>
                    Add supporters, chat, and post wins.
                  </Text>
                </TouchableOpacity>
              )}

              {currentSubscription !== 'selfAdvocateDating' && (
                <TouchableOpacity 
                  style={[styles.planButton, isWeb && styles.webPlanButton]}
                  onPress={() => handleSubscriptionChange('selfAdvocateDating')}
                >
                  <Text style={[styles.planTitle, isWeb && styles.webPlanTitle]}>Switch to Self Advocate Dating</Text>
                  <Text style={[styles.planPrice, isWeb && styles.webPlanPrice]}>$20/month</Text>
                  <Text style={[styles.planDescription, isWeb && styles.webPlanDescription]}>
                    All Plus features and dating access.
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
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
  // Web-specific styles
  webContainer: {
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  webContent: {
    maxWidth: 800,
    marginHorizontal: 'auto',
    padding: 40,
  },
  webLoadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  webLoadingText: {
    fontSize: 18,
    color: '#666',
  },
  webHelperSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 32,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  webHelperTitle: {
    fontSize: 24,
    color: '#24269B',
    marginBottom: 16,
  },
  webHelperText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
    color: '#444',
  },
  webTitle: {
    fontSize: 32,
    color: '#24269B',
    marginBottom: 24,
    textAlign: 'center',
  },
  webCurrentPlanCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 32,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  webCurrentPlanTitle: {
    fontSize: 20,
    color: '#666',
    marginBottom: 8,
  },
  webCurrentPlanName: {
    fontSize: 24,
    color: '#24269B',
    fontWeight: '600',
    marginBottom: 24,
  },
  webFeaturesTitle: {
    fontSize: 18,
    color: '#444',
    marginBottom: 16,
  },
  webFeaturesList: {
    marginBottom: 16,
  },
  webFeatureItem: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
    color: '#444',
  },
  webSectionTitle: {
    fontSize: 24,
    color: '#24269B',
    marginBottom: 24,
    textAlign: 'center',
  },
  webPlansContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 24,
    marginBottom: 40,
  },
  webPlanButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },
    ':active': {
      transform: 'translateY(1px)',
    },
  },
  webPlanTitle: {
    fontSize: 20,
    color: '#24269B',
    fontWeight: '600',
    marginBottom: 8,
  },
  webPlanPrice: {
    fontSize: 24,
    color: '#444',
    marginBottom: 16,
  },
  webPlanDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
});

export default ManageSubscriptionScreen; 