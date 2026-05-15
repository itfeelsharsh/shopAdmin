import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore"; 
import { getMessaging } from "firebase/messaging";

// Firebase configuration using environment variables only
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Log configuration status for debugging
console.log('Firebase Configuration Status:', {
  apiKey: firebaseConfig.apiKey ? 'Configured' : 'Missing',
  authDomain: firebaseConfig.authDomain ? 'Configured' : 'Missing',
  projectId: firebaseConfig.projectId ? 'Configured' : 'Missing',
  storageBucket: firebaseConfig.storageBucket ? 'Configured' : 'Missing',
  messagingSenderId: firebaseConfig.messagingSenderId ? 'Configured' : 'Missing',
  appId: firebaseConfig.appId ? 'Configured' : 'Missing',
});

// Initialize Firebase app with error handling
let app, auth, db, messaging;

try {
  // Check if all required config values are present
  const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key]);
  
  if (missingKeys.length > 0) {
    throw new Error(`Missing required Firebase configuration: ${missingKeys.join(', ')}. Please check your environment variables.`);
  }
  
  app = initializeApp(firebaseConfig);
  console.log('Firebase app initialized successfully');
  
  auth = getAuth(app);
  console.log('Firebase auth initialized successfully');

  // Initialize Firestore with experimentalForceLongPolling to fix WebChannel connection issues
  // This helps prevent 400 Bad Request errors when writing to Firestore
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false
  }); 
  console.log('Firestore initialized successfully');

  messaging = getMessaging(app);
  console.log('Firebase messaging initialized successfully');

  // Set auth persistence with error handling
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('Firebase auth persistence set successfully');
    })
    .catch((error) => {
      console.error("Error setting Firebase auth persistence:", error);
    });

} catch (error) {
  console.error("Error initializing Firebase:", error);
  // Create mock objects to prevent undefined errors
  auth = {
    currentUser: null,
    onAuthStateChanged: () => () => {},
    signInWithEmailAndPassword: () => Promise.reject(new Error('Firebase not initialized')),
    signOut: () => Promise.reject(new Error('Firebase not initialized'))
  };
  
  db = {
    collection: () => ({
      doc: () => ({
        get: () => Promise.reject(new Error('Firebase not initialized')),
        set: () => Promise.reject(new Error('Firebase not initialized')),
        update: () => Promise.reject(new Error('Firebase not initialized'))
      })
    })
  };

  messaging = {
    getToken: () => Promise.reject(new Error('Firebase not initialized'))
  };
}

export { auth, db, messaging }; 