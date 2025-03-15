import { SpeechClient } from '@google-cloud/speech';

// Method 1: Using environment variables
const speechClient = new SpeechClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY,
  },
  projectId: process.env.GOOGLE_PROJECT_ID,
});
