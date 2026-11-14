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
const clean = (val: string | undefined) => (typeof val === 'string' ? val.trim() : '');

const firebaseConfig: FirebaseAppletConfig = {
  apiKey: clean(env.VITE_FIREBASE_API_KEY) || clean(fileConfig?.apiKey),
  authDomain: clean(env.VITE_FIREBASE_AUTH_DOMAIN) || clean(fileConfig?.authDomain),
  projectId: clean(env.VITE_FIREBASE_PROJECT_ID) || clean(fileConfig?.projectId),
  storageBucket: clean(env.VITE_FIREBASE_STORAGE_BUCKET) || clean(fileConfig?.storageBucket),
  messagingSenderId:
    clean(env.VITE_FIREBASE_MESSAGING_SENDER_ID) || clean(fileConfig?.messagingSenderId),
  appId: clean(env.VITE_FIREBASE_APP_ID) || clean(fileConfig?.appId),
  firestoreDatabaseId:
    clean(env.VITE_FIREBASE_FIRESTORE_DATABASE_ID) ||
    clean(fileConfig?.firestoreDatabaseId) ||
    '(default)',
};

const missingRequiredKeys: string[] = [];
if (!firebaseConfig.apiKey) missingRequiredKeys.push('VITE_FIREBASE_API_KEY');
if (!firebaseConfig.authDomain) missingRequiredKeys.push('VITE_FIREBASE_AUTH_DOMAIN');
if (!firebaseConfig.projectId) missingRequiredKeys.push('VITE_FIREBASE_PROJECT_ID');
if (!firebaseConfig.appId) missingRequiredKeys.push('VITE_FIREBASE_APP_ID');

export const isFirebaseConfigured = missingRequiredKeys.length === 0;

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
  firebaseInitError = `Cloud sync is not configured yet (missing VITE_FIREBASE_* GitHub Secrets or firebase-applet-config.json: ${missingRequiredKeys.join(', ')}). You can still use the 6-Month Sample Ledger locally.`;
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
