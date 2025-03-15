import { Linking } from 'react-native';
import { auth } from '../config/firebase';

const STRIPE_PAYMENT_LINKS = {
    selfAdvocatePlus: 'https://buy.stripe.com/9AQ4jWeKLg7O3GUbIM',
    selfAdvocateDating: 'https://buy.stripe.com/cN27w8auv2gY7Xa8wy',

    supporterOne: 'https://buy.stripe.com/dR6bMo6ef5taely28b',
    supporterFive: 'https://buy.stripe.com/00g8Ac467cVC5P29AF',

    supporterTen: 'https://buy.stripe.com/4gw2bOauv5taa5i000'
    // Add all your subscription tiers
};

export const startStripeCheckout = async (planType) => {
    try {
        const paymentLink = STRIPE_PAYMENT_LINKS[planType];
        if (!paymentLink) {
            throw new Error(`Invalid plan type: ${planType}`);
        }
        
        // Add user ID to the URL
        const userId = auth.currentUser?.uid;
        const urlWithParams = `${paymentLink}?client_reference_id=${userId}&metadata[userId]=${userId}&metadata[planType]=${planType}`;
        
        console.log('Opening payment link for:', planType);
        console.log('URL:', urlWithParams);
        
        await Linking.openURL(urlWithParams);
        return true;
    } catch (error) {
        console.error('Stripe checkout error:', error);
        Alert.alert('Error', 'Could not open checkout page');
        return false;
    }
}; 