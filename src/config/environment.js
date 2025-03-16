// Direct environment variables for web compatibility
// This avoids relying on @env which causes web bundling issues

const ENV = {
  // Firebase
  FIREBASE_API_KEY: "AIzaSyAaD38_3u9weXef6XjefQDYCeGyVRSAu9k",
  FIREBASE_AUTH_DOMAIN: "selfadvocacywins-acb4f.firebaseapp.com",
  FIREBASE_PROJECT_ID: "selfadvocacywins-acb4f",
  FIREBASE_STORAGE_BUCKET: "selfadvocacywins-acb4f.firebasestorage.app",
  FIREBASE_MESSAGING_SENDER_ID: "142115352134",
  FIREBASE_APP_ID: "1:142115352134:web:44ef1dcc0771950c53e447",
  FIREBASE_MEASUREMENT_ID: "G-QSESF1H6W6",
  
  // CometChat
  COMETCHAT_APP_ID: "267630d961c10281",
  COMETCHAT_AUTH_KEY: "516acc69a097766b4b999a44160519116eecb15e",
  COMETCHAT_API_KEY: "b68b9c655d446b24ad9635270e52f0d8c370321d",
  COMETCHAT_REGION: "us",
  
  // Typesense
  TYPESENSE_HOST: "e6dqryica24hsu75p-1.a1.typesense.net",
  TYPESENSE_API_KEY: "vcXv0c4EKrJ6AHFR1nCKQSXGch2EEzE7"
};

export default ENV; 