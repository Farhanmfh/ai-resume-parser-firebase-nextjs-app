import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

// Configure Firestore to better handle restrictive networks/ad-blockers
// Auto-detect long polling (falls back when WebChannel is blocked) and
// disable fetch streams for broader compatibility.
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});

const storage = getStorage(app);
const functions = getFunctions(app);

// Connect to local emulator in development
// if (process.env.NODE_ENV === 'development') {
//   connectFunctionsEmulator(functions, '127.0.0.1', 5001);
// }

export { app, auth, db, storage, functions };
