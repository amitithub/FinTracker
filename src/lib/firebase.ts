import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, Firestore, getDocFromServer, getFirestore } from 'firebase/firestore';

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const configModules = import.meta.glob<{ default: FirebaseAppletConfig }>(
  '../../firebase-applet-config.json',
  { eager: true },
);
const fileConfig = Object.values(configModules)[0]?.default;

const env = import.meta.env;
const firebaseConfig: FirebaseAppletConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || fileConfig?.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || fileConfig?.authDomain || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || fileConfig?.projectId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || fileConfig?.storageBucket || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || fileConfig?.messagingSenderId || '',
  appId: env.VITE_FIREBASE_APP_ID || fileConfig?.appId || '',
  firestoreDatabaseId:
    env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || fileConfig?.firestoreDatabaseId || '(default)',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.authDomain &&
    firebaseConfig.appId,
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let firebaseInitError: string | null = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (err) {
    firebaseInitError =
      err instanceof Error ? err.message : 'Failed to initialize Firebase client SDK.';
    app = null;
    db = null;
    auth = null;
    googleProvider = null;
  }
} else {
  firebaseInitError =
    'Cloud sync is not configured yet (missing VITE_FIREBASE_* GitHub Secrets or firebase-applet-config.json). You can still use the 6-Month Sample Ledger locally.';
}

export { app, auth, db, firebaseInitError, googleProvider };

let connectionTested = false;

export async function testFirestoreConnection(): Promise<void> {
  if (connectionTested || !db) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client appears offline.');
    }
  }
}

testFirestoreConnection();
