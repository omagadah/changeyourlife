/**
 * Configuration centralisée de l'application
 * Les variables d'environnement sont injectées à la compilation
 */

// Déterminer l'environnement
const ENV = import.meta.env.VITE_ENV || 'production';
const isDev = ENV === 'development';
const isProd = ENV === 'production';

// Configuration Firebase
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCvEtaivyC5QD0dGyPKh97IgYU8U8QrrWg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'changeyourlife-cc210.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'changeyourlife-cc210',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'changeyourlife-cc210.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '801720080785',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:801720080785:web:1a74aadba5755ea26c2230'
};

// Configuration Sentry (Monitoring)
export const sentryConfig = {
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  environment: ENV,
  tracesSampleRate: isDev ? 1.0 : 0.1,
  debug: isDev
};

// Configuration de l'application
export const appConfig = {
  name: 'Change Your Life',
  version: '1.4.0',
  environment: ENV,
  isDev,
  isProd,
  
  // Cache
  cacheName: 'changeyourlife-v14',
  
  // Timeouts
  requestTimeout: 10000,
  saveTimeout: 10000,
  
  // Retry
  maxRetries: 2,
  retryDelay: 500,
  
  // Validation
  passwordMinLength: 8,
  emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  passwordRegex: /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  
  // Limites
  maxJournalEntryLength: 50000,
  maxNodeLabel: 100,
  
  // URLs
  apiBaseUrl: isProd ? 'https://changeyourlife.ai' : 'http://localhost:3000'
};

// Exporter la configuration globale
export default {
  firebaseConfig,
  sentryConfig,
  appConfig
};
