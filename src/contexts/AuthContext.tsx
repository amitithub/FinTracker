import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import {
  auth,
  firebaseInitError,
  googleProvider,
  isFirebaseConfigured,
} from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authError: string | null;
  isCloudConfigured: boolean;
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function formatFirebaseAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in is not enabled yet in Firebase Console. Enable it under Authentication → Sign-in method → Email/Password, or use Google Sign-In.';
      case 'auth/unauthorized-domain':
        return 'This domain is not yet allowlisted in Firebase Authentication → Settings → Authorized domains. Add your GitHub Pages hostname there.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password. Please check your credentials or reset your password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Try signing in instead.';
      case 'auth/weak-password':
        return 'Password is too weak. Choose at least 8 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed before completion.';
      case 'auth/popup-blocked':
        return 'Browser blocked the sign-in popup. Please allow popups for this site and try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a minute before trying again.';
      default:
        return error.message || 'Authentication failed. Please try again.';
    }
  }
  return error instanceof Error ? error.message : 'Authentication failed.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(auth && isFirebaseConfigured));
  const [authError, setAuthError] = useState<string | null>(() => firebaseInitError ?? null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    if (!auth || !isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    let settled = false;
    const fallbackTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setLoading(false);
      }
    }, 4000);

    let unsub: (() => void) | undefined;
    try {
      unsub = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          settled = true;
          clearTimeout(fallbackTimer);
          setUser(firebaseUser);
          setAuthError(null);
          if (firebaseUser) {
            setIsDemoMode(false);
          }
          setLoading(false);
        },
        (error) => {
          settled = true;
          clearTimeout(fallbackTimer);
          setAuthError(formatFirebaseAuthError(error));
          setLoading(false);
        },
      );
    } catch (err) {
      settled = true;
      clearTimeout(fallbackTimer);
      setAuthError(formatFirebaseAuthError(err));
      setLoading(false);
    }

    return () => {
      clearTimeout(fallbackTimer);
      if (unsub) unsub();
    };
  }, []);

  const enterDemoMode = () => setIsDemoMode(true);
  const exitDemoMode = () => setIsDemoMode(false);

  const requireAuth = () => {
    if (!auth) {
      throw new Error(
        firebaseInitError ||
          'Cloud sync is not configured yet. Add VITE_FIREBASE_* GitHub Secrets or use Sample Preview Mode.',
      );
    }
    return auth;
  };

  const signInWithGoogle = async () => {
    try {
      const activeAuth = requireAuth();
      if (!googleProvider) {
        throw new Error('Google Sign-In provider is not configured.');
      }
      await signInWithPopup(activeAuth, googleProvider);
      setIsDemoMode(false);
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const activeAuth = requireAuth();
      await signInWithEmailAndPassword(activeAuth, email.trim(), password);
      setIsDemoMode(false);
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    try {
      const activeAuth = requireAuth();
      const cred = await createUserWithEmailAndPassword(activeAuth, email.trim(), password);
      if (displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 60) });
      }
      await sendEmailVerification(cred.user);
      setUser({ ...cred.user } as User);
      setIsDemoMode(false);
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const resendVerificationEmail = async () => {
    const activeAuth = requireAuth();
    if (!activeAuth.currentUser) throw new Error('No signed-in user.');
    try {
      await sendEmailVerification(activeAuth.currentUser);
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const refreshVerificationStatus = async (): Promise<boolean> => {
    if (!auth?.currentUser) return false;
    await auth.currentUser.reload();
    const updated = auth.currentUser;
    setUser(updated ? ({ ...updated } as User) : null);
    return Boolean(updated?.emailVerified);
  };

  const sendPasswordReset = async (email: string) => {
    try {
      const activeAuth = requireAuth();
      await sendPasswordResetEmail(activeAuth, email.trim());
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const signOut = async () => {
    setIsDemoMode(false);
    if (auth?.currentUser) {
      await firebaseSignOut(auth);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        isCloudConfigured: isFirebaseConfigured,
        isDemoMode,
        enterDemoMode,
        exitDemoMode,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resendVerificationEmail,
        refreshVerificationStatus,
        sendPasswordReset,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
