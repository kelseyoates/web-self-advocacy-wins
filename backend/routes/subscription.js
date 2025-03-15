const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const { USER_TYPES } = require('../constants/userTypes');

// Get subscription details
router.get('/subscription/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId.toLowerCase())
      .get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    
    if (!userData.stripeCustomerId) {
      return res.json({
        subscription: null,
        userType: userData.userType || USER_TYPES.BASIC
      });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: userData.stripeCustomerId,
      limit: 1,
      status: 'active'
    });

    return res.json({
      subscription: subscriptions.data[0] || null,
      userType: userData.userType || USER_TYPES.BASIC
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({ error: 'Failed to get subscription details' });
  }
});

// Get payment history
router.get('/payment-history/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 10
    });

    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 10
    });

    // Combine and sort payments
    const allPayments = [
      ...charges.data.map(charge => ({
        id: charge.id,
        amount: charge.amount,
        status: charge.status,
        created: charge.created,
        type: 'charge'
      })),
      ...paymentIntents.data.map(pi => ({
        id: pi.id,
        amount: pi.amount,
        status: pi.status,
        created: pi.created,
        type: 'payment_intent'
      }))
    ].sort((a, b) => b.created - a.created);

    res.json(allPayments);
  } catch (error) {
    console.error('Error getting payment history:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
});

// Cancel subscription
router.post('/cancel-subscription', async (req, res) => {
  try {
    const { userId, customerId } = req.body;

    // Get active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'active'
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel at period end
    await stripe.subscriptions.update(subscriptions.data[0].id, {
      cancel_at_period_end: true
    });

    // Update Firestore
    await admin.firestore()
      .collection('users')
      .doc(userId.toLowerCase())
      .update({
        subscriptionStatus: 'canceling',
        subscriptionCanceledAt: admin.firestore.FieldValue.serverTimestamp()
      });

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Update subscription
router.post('/update-subscription', async (req, res) => {
  try {
    const { userId, newPriceId } = req.body;

    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId.toLowerCase())
      .get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    
    if (!userData.stripeCustomerId) {
      return res.status(400).json({ error: 'No customer ID found' });
    }

    // Get current subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: userData.stripeCustomerId,
      limit: 1,
      status: 'active'
    });

    let updatedSubscription;

    if (subscriptions.data.length > 0) {
      // Update existing subscription
      updatedSubscription = await stripe.subscriptions.update(
        subscriptions.data[0].id,
        {
          items: [{
            id: subscriptions.data[0].items.data[0].id,
            price: newPriceId
          }],
          proration_behavior: 'always_invoice'
        }
      );
    } else {
      // Create new subscription
      updatedSubscription = await stripe.subscriptions.create({
        customer: userData.stripeCustomerId,
        items: [{ price: newPriceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent']
      });
    }

    res.json({
      subscription: updatedSubscription,
      clientSecret: updatedSubscription.latest_invoice?.payment_intent?.client_secret
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Webhook handler for subscription events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle subscription events
  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      await handleSubscriptionChange(subscription);
      break;
      
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      await handleSuccessfulPayment(invoice);
      break;
      
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      await handleFailedPayment(failedInvoice);
      break;
  }

  res.json({ received: true });
});

async function handleSubscriptionChange(subscription) {
  try {
    // Find user by customer ID
    const usersRef = admin.firestore().collection('users');
    const snapshot = await usersRef
      .where('stripeCustomerId', '==', subscription.customer)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.error('No user found for customer:', subscription.customer);
      return;
    }

    const userDoc = snapshot.docs[0];
    const updates = {
      subscriptionStatus: subscription.status,
      subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (subscription.status === 'active') {
      updates.subscriptionExpiresAt = admin.firestore.Timestamp.fromDate(
        new Date(subscription.current_period_end * 1000)
      );
    }

    await userDoc.ref.update(updates);
  } catch (error) {
    console.error('Error handling subscription change:', error);
  }
}

async function handleSuccessfulPayment(invoice) {
  // Implementation similar to handleSubscriptionChange
}

async function handleFailedPayment(invoice) {
  // Implementation for failed payments
}

module.exports = router; 