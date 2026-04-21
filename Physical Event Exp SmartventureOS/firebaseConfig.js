/**
 * firebaseConfig.js
 * VenueIQ — Firebase Realtime Database Configuration
 *
 * These are PUBLIC client-side credentials — safe to expose in the browser.
 * Access is controlled entirely by Firebase Security Rules (firebaseRules.json).
 * No secret keys are stored here. Firebase Auth is NOT used.
 */

// Public client-side key — safe to expose in browser
// Access is controlled by Firebase Security Rules
const FIREBASE_CONFIG = {
  // Public API key — restricted by Firebase Security Rules, not a secret
  apiKey: 'AIzaSyDUKbdmfWIqR6mU0ZXN5hsCthAFS7cixxM',

  // Auth domain — kept for SDK compatibility even though Firebase Auth is not used
  authDomain: 'promptwars-proj1.firebaseapp.com',

  // Realtime Database URL — all reads/writes go through Security Rules
  databaseURL: 'https://promptwars-proj1-default-rtdb.firebaseio.com',

  // GCP project identifier — not a secret
  projectId: 'promptwars-proj1',

  // Storage bucket — reserved for future file uploads
  storageBucket: 'promptwars-proj1.firebasestorage.app',

  // Messaging sender ID — used only for Cloud Messaging (not active)
  messagingSenderId: '494725153723',

  // App ID — uniquely identifies this web app within the Firebase project
  appId: '1:494725153723:web:9923b21570f16a4bc8fa9e',

  // Analytics measurement ID
  measurementId: 'G-Z194D9YL62'
};
