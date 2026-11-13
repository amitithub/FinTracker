import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';

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

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let connectionTested = false;

export async function testFirestoreConnection(): Promise<void> {
  if (connectionTested) return;
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
