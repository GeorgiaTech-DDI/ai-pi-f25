/**
 * Firebase Configuration and Initialization
 * 
 * This module initializes Firebase app and exports the authentication instance
 * for use throughout the application. Configuration is loaded from environment variables.
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase configuration object loaded from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Validate that all required Firebase configuration fields are present
function validateFirebaseConfig() {
  const requiredFields = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required Firebase configuration fields: ${missingFields.join(', ')}`);
  }
  
  console.log('✅ Firebase configuration validation passed');
}

// Initialize Firebase
let app;
let auth;

try {
  validateFirebaseConfig();
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization failed:', error);
  throw error;
}

// Export the auth instance for use in components
export { auth };
export default app;
