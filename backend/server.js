const express = require('express');
const cors = require('cors');
const stripe = require('stripe')('your_stripe_secret_key');
const admin = require('firebase-admin');
const subscriptionRoutes = require('./routes/subscription');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: 'your_firebase_database_url'
});

app.use(cors());
app.use(express.json());

// Create a payment intent
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { userId, priceId } = req.body;

    // Get the price from Stripe
    const price = await stripe.prices.retrieve(priceId);
    
    // Get or create customer
    const userSnapshot = await admin.firestore()
      .collection('users')
      .doc(userId.toLowerCase())
      .get();
    
    let customerId = userSnapshot.data()?.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          firebaseUserId: userId.toLowerCase()
        }
      });
      customerId = customer.id;
      
      // Save Stripe customer ID to Firestore
      await admin.firestore()
        .collection('users')
        .doc(userId.toLowerCase())
        .update({
          stripeCustomerId: customerId
        });
    }

    // Create ephemeral key
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2023-10-16' }
    );

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price.unit_amount,
      currency: price.currency,
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        firebaseUserId: userId.toLowerCase(),
        priceId: priceId
      }
    });

    res.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook to handle successful payments
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = 'your_webhook_secret';

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle successful payment
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const userId = paymentIntent.metadata.firebaseUserId;
    const priceId = paymentIntent.metadata.priceId;

    try {
      // Update user subscription status in Firestore
      await admin.firestore()
        .collection('users')
        .doc(userId)
        .update({
          subscriptionStatus: 'active',
          subscriptionPriceId: priceId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

      // Create or update CometChat user role based on subscription
      // We'll implement this in the next step
      
    } catch (error) {
      console.error('Error updating user subscription:', error);
    }
  }

  res.json({received: true});
});

app.use('/api/subscription', subscriptionRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 