const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');

// ... rest of the backend code with routes ... 