import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../services/firebase';
import { UserProfile, UserRole, UserStatus } from '../types/auth';

// Bootstrapped administrator email
export const BOOTSTRAP_ADMIN_EMAIL = 'cesar.suporte.vendas@gmail.com';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isMember: boolean;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<UserProfile | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrCreateProfile = async (firebaseUser: User): Promise<UserProfile> => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userEmail = (firebaseUser.email || '').toLowerCase().trim();
    const isBootstrapAdmin = userEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

    try {
      const snap = await getDoc(userDocRef);
      const nowIso = new Date().toISOString();

      if (snap.exists()) {
        const existingData = snap.data() as UserProfile;
        // If bootstrap admin, ensure role is always admin
        const updatedRole: UserRole = isBootstrapAdmin ? 'admin' : existingData.role || 'member';
        
        const updatedProfile: UserProfile = {
          ...existingData,
          id: firebaseUser.uid,
          email: userEmail,
          displayName: firebaseUser.displayName || existingData.displayName || userEmail.split('@')[0],
          photoURL: firebaseUser.photoURL || existingData.photoURL,
          role: updatedRole,
          lastLoginAt: nowIso,
        };

        // Non-blocking update of last login
        updateDoc(userDocRef, {
          lastLoginAt: nowIso,
          displayName: updatedProfile.displayName,
          role: updatedRole,
        }).catch((err) => console.warn('Could not update lastLoginAt:', err));

        // Ensure bootstrap admin record in /admins/{uid}
        if (isBootstrapAdmin) {
          const adminDocRef = doc(db, 'admins', firebaseUser.uid);
          setDoc(adminDocRef, {
            email: userEmail,
            addedAt: existingData.createdAt || nowIso,
          }, { merge: true }).catch(() => {});
        }

        return updatedProfile;
      } else {
        // Create new user profile in Firestore
        const newProfile: UserProfile = {
          id: firebaseUser.uid,
          email: userEmail,
          displayName: firebaseUser.displayName || userEmail.split('@')[0] || 'Membro B3',
          photoURL: firebaseUser.photoURL || undefined,
          role: isBootstrapAdmin ? 'admin' : 'member',
          status: 'active',
          createdAt: nowIso,
          lastLoginAt: nowIso,
          notes: isBootstrapAdmin ? 'Super Administrador Fundador' : 'Membro cadastrado via login Google',
        };

        await setDoc(userDocRef, newProfile);

        // If bootstrap admin, register in /admins/{uid} collection
        if (isBootstrapAdmin) {
          const adminDocRef = doc(db, 'admins', firebaseUser.uid);
          await setDoc(adminDocRef, {
            email: userEmail,
            addedAt: nowIso,
          });
        }

        return newProfile;
      }
    } catch (err) {
      console.error('Error fetching or creating profile in Firestore:', err);
      // Fallback in-memory profile if Firestore permissions or offline
      return {
        id: firebaseUser.uid,
        email: userEmail,
        displayName: firebaseUser.displayName || userEmail.split('@')[0],
        photoURL: firebaseUser.photoURL || undefined,
        role: isBootstrapAdmin ? 'admin' : 'member',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const profile = await fetchOrCreateProfile(currentUser);
          setUserProfile(profile);
          setError(null);
        } catch (err) {
          console.error('Failed to sync user profile:', err);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async (): Promise<UserProfile | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const profile = await fetchOrCreateProfile(result.user);
      setUser(result.user);
      setUserProfile(profile);
      return profile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na autenticação com Google.';
      setError(msg);
      console.error('Login error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const updated = await fetchOrCreateProfile(user);
      setUserProfile(updated);
    }
  };

  const isAdmin =
    userProfile?.role === 'admin' ||
    (user?.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  const isMember = Boolean(user && userProfile && userProfile.status === 'active');

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAdmin,
        isMember,
        loading,
        error,
        loginWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
