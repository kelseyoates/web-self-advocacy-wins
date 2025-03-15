import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { startStripeCheckout } from '../services/stripe';
import { getDoc, doc } from 'firebase/firestore';
import { auth, db, storage } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const SUBSCRIPTION_OPTIONS = {
  selfAdvocate: [
    {
      id: 'selfAdvocatePlus',
      title: 'Self-Advocate Plus',
      price: '$10/month',
      description: 'Access to supporters',
      planType: 'selfAdvocatePlus'
    },
    {
      id: 'selfAdvocateDating',
      title: 'Self-Advocate Dating',
      price: '$20/month',
      description: 'Access to supporters and dating',
      planType: 'selfAdvocateDating'
    }
  ],
  supporter: [
    {
      id: 'supporterOne',
      title: 'Supporter One',
      price: '$10/month',
      description: 'one user can support one self-advocate',
      planType: 'supporterOne'
    },
    {
      id: 'supporterFive',
      title: 'Supporter Five',
      price: '$50/month',
      description: 'one user can support up to five self-advocates',
      planType: 'supporterFive'
    },
    {
      id: 'supporterTen',
      title: 'Supporter Ten',
      price: '$100/month',
      description: 'one user can support up to ten self-advocates',
      planType: 'supporterTen'
    }
  ]
};

const SubscriptionCard = ({ title, price, features, titleBackgroundColor, planType, onUpgrade }) => (
  <View style={styles.card}>
    <View style={[styles.titleContainer, { backgroundColor: titleBackgroundColor }]}>
      <Text style={styles.title}>{title}</Text>
    </View>
    <Text style={styles.price}>{price}</Text>
    
    <View style={styles.featuresContainer}>
      {features.map((feature, index) => (
        <View key={index} style={styles.featureRow}>
          <Image 
            source={feature.image} 
            style={styles.featureIcon}
          />
          <Text style={styles.featureText}>{feature.text}</Text>
        </View>
      ))}
    </View>
    
    <TouchableOpacity 
      style={styles.selectButton}
      onPress={() => onUpgrade(planType)}
    >
      <View style={styles.buttonContent}>
        <Text style={styles.selectButtonText}>Select Plan</Text>
        <Icon name="arrow-forward" size={24} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  </View>
);

const SubscriptionOptionsScreen = () => {
  const { user } = useAuth();
  const [currentSubscription, setCurrentSubscription] = useState('');
  const navigation = useNavigation();

  useEffect(() => {
    const fetchCurrentSubscription = async () => {
      console.log('Fetching subscription, user:', user?.uid);
      
      if (!user || !user.uid) {
        console.log('No user found');
        return;
      }
      
      try {
        let userRef = doc(db, 'users', user.uid.toLowerCase());
        let userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          console.log('Document not found with lowercase ID, trying original case');
          userRef = doc(db, 'users', user.uid);
          userDoc = await getDoc(userRef);
        }
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('User data found:', userData);
          setCurrentSubscription(userData.subscriptionType || 'Free');
        } else {
          console.log('No user document found in either case');
          setCurrentSubscription('Free');
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
        setCurrentSubscription('Error loading');
      }
    };

    fetchCurrentSubscription();
  }, [user]);

  const handleUpgrade = async (planType) => {
    try {
      console.log('Starting checkout for plan:', planType);
      const success = await startStripeCheckout(planType);
      if (!success) {
        Alert.alert('Error', 'Could not open checkout page');
      }
    } catch (error) {
      console.error('Error starting checkout:', error);
      Alert.alert('Error', 'Failed to start checkout process');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Subscription Options</Text>
        <Text style={styles.currentSubscription}>
          Current Plan: {currentSubscription || 'Loading...'}
        </Text>
      </View>

{/* 
      <View style={styles.buttonContainer}>
      <View style={styles.buttonShadow} />
      <TouchableOpacity 
        style={styles.findDateButton} 
        onPress={() => navigation.navigate('ManageSubscription')}
      >
        <View style={styles.buttonContent}>
          <Text style={styles.buttonDateText}>Manage Subscription</Text>
          <Image 
            source={require('../../assets/find-a-date.png')} 
            style={styles.buttonIcon}
          />
        </View>
      </TouchableOpacity>
    </View> */}


      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Self-Advocate Plans</Text>
  

<SubscriptionCard
        title="Self-Advocate - Plus"
        price="$10/month"
        titleBackgroundColor="#ffffff"
        planType="selfAdvocatePlus"
        onUpgrade={handleUpgrade}
        features={[
          { 
            image: require('../../assets/bottom-nav-images/chat-active.png'), 
            text: "in-app chat" 
          },
          { 
            image: require('../../assets/bottom-nav-images/friends-active.png'), 
            text: "find friends" 
          },
          { 
            image: require('../../assets/bottom-nav-images/trophy-icon.png'), 
            text: "post wins" 
          },
          { 
            image: require('../../assets/supporter-1.png'), 
            text: "add supporters" 
          },
         
        ]}
      />


      <SubscriptionCard
        title="Self-Advocate - Dating"
        price="$20/month"
        titleBackgroundColor="#FF99DC"
        planType="selfAdvocateDating"
        onUpgrade={handleUpgrade}
        features={[
          { 
            image: require('../../assets/bottom-nav-images/chat-active.png'), 
            text: "in-app chat" 
          },
          { 
            image: require('../../assets/bottom-nav-images/friends-active.png'), 
            text: "find friends" 
          },
          { 
            image: require('../../assets/bottom-nav-images/trophy-icon.png'), 
            text: "post wins" 
          },
          { 
            image: require('../../assets/supporter-1.png'), 
            text: "add supporters" 
          },
          { 
            image: require('../../assets/find-a-date.png'), 
            text: "find a date" 
          },
        ]}
      />

      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Supporter Plans</Text>
        {/* {SUBSCRIPTION_OPTIONS.supporter.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.card}
            onPress={() => handleUpgrade(option.planType)}
          >
            <View style={styles.cardContent}>
              <Text style={styles.title}>
                {option.title} {'\n'}
               
              </Text>
              <Text style={styles.price}>{option.price}</Text>
              <Text style={styles.description}>{option.description}</Text>
            </View>
          </TouchableOpacity>
        ))} */}


<SubscriptionCard
        title="Supporter - One"
        price="$10/month"
        titleBackgroundColor="#62FFD0"
        planType="supporterOne"
        onUpgrade={handleUpgrade}
        features={[
          { 
            image: require('../../assets/bottom-nav-images/chat-active.png'), 
            text: "view your user's chats" 
          },
          { 
            image: require('../../assets/notifications.png'), 
            text: "get notifications" 
          },
          { 
            image: require('../../assets/supporter-one-phone.png'), 
            text: "support one user" 
          },
          
        ]}
      />


<SubscriptionCard
        title="Supporter - Five"
        price="$50/month"
        titleBackgroundColor="#F1AD1F"
        planType="supporterFive"
        onUpgrade={handleUpgrade}
        features={[
          { 
            image: require('../../assets/bottom-nav-images/chat-active.png'), 
            text: "view your users' chats" 
          },
          { 
            image: require('../../assets/notifications.png'), 
            text: "get notifications" 
          },
          { 
            image: require('../../assets/supporter-five-phone.png'), 
            text: "support up to five users" 
          },
          
        ]}
      />

<SubscriptionCard
        title="Supporter - Ten"
        price="$100/month"
        titleBackgroundColor="#FF8262"
        planType="supporterTen"
        onUpgrade={handleUpgrade}
        features={[
          { 
            image: require('../../assets/bottom-nav-images/chat-active.png'), 
            text: "view your users' chats" 
          },
          { 
            image: require('../../assets/notifications.png'), 
            text: "get notifications" 
          },
          { 
            image: require('../../assets/supporter-ten-phone.png'), 
            text: "support up to ten users" 
          },
          
        ]}
      />
      </View>


      
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  
 
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
  currentSubscription: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'normal',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },

  currentSubscription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#000000',
    overflow: 'hidden',
    paddingBottom: 20,
  },
  titleContainer: {
    width: '100%',
    padding: 15,
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000',
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  featureText: {
    fontSize: 18,
    marginLeft: 10,
    color: '#333',
  },
  selectButton: {
    backgroundColor: '#24269B',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#24269B',
    marginHorizontal: 20,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  featureIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
    resizeMode: 'contain',
  },
  findDateButton: {
    backgroundColor: '#F2C8E4',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 5,
    width: 300,
    height: 120,
    borderWidth: 1,
    borderColor: '#24269B',
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },

  buttonIcon: {
    width: 90,
    height: 90,
    borderRadius: 15,
  }
});

export default SubscriptionOptionsScreen; 