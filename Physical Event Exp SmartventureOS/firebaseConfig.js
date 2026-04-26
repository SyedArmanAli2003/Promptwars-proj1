/**
 * firebaseConfig.js
 * VenueIQ — Firebase Realtime Database Configuration
 *
 * Runtime config loader.
 * Define window.__FIREBASE_CONFIG__ outside version control
 * (for example in firebaseConfig.local.js) to keep keys out of this repo.
 */

const FIREBASE_CONFIG =
  typeof window !== 'undefined' &&
  typeof window.__FIREBASE_CONFIG__ === 'object' &&
  window.__FIREBASE_CONFIG__ !== null
    ? window.__FIREBASE_CONFIG__
    : undefined;
