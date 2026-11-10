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
  onSnapshot,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../services/firebase';
import { UserProfile, UserRole, UserStatus } from '../types/auth';

// Bootstrapped administrator email
export const BOOTSTRAP_ADMIN_EMAIL = 'cesar.suporte.vendas@gmail.com';

// Administrative credentials requested by user
export const ADMIN_CREDENTIALS = {
  username: 'Wdracma',
  password: 'ce243010CE##',
};

export const ADMIN_STORAGE_KEY = 'b3_alpha_terminal_admin_auth_v1';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isMember: boolean;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<UserProfile | null>;
  loginWithAdminCredentials: (name: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [adminSession, setAdminSession] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.username === 'Wdracma';
      }
    } catch {}
    return false;
  });

  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.username === 'Wdracma') {
          return {
            id: 'admin_wdracma',
            email: 'wdracma@alphaterminal.admin',
            displayName: 'Wdracma',
            role: 'admin',
            status: 'active',
            createdAt: '2026-11-09T00:00:00.000Z',
            lastLoginAt: new Date().toISOString(),
            notes: 'Administrador Master Credencial (Wdracma)',
          };
        }
      }
    } catch {}
    return null;
  });
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
        // If bootstrap admin, ensure role is always admin and status is active
        const updatedRole: UserRole = isBootstrapAdmin ? 'admin' : existingData.role || 'member';
        const updatedStatus: UserStatus = isBootstrapAdmin ? 'active' : existingData.status || 'pending';
        
        const updatedProfile: UserProfile = {
          ...existingData,
          id: firebaseUser.uid,
          email: userEmail,
          displayName: firebaseUser.displayName || existingData.displayName || userEmail.split('@')[0],
          photoURL: firebaseUser.photoURL || existingData.photoURL,
          role: updatedRole,
          status: updatedStatus,
          lastLoginAt: nowIso,
        };

        // Non-blocking update of last login and name
        updateDoc(userDocRef, {
          lastLoginAt: nowIso,
          displayName: updatedProfile.displayName,
          ...(isBootstrapAdmin ? { role: 'admin', status: 'active' } : {}),
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
        // New non-admin users start as 'pending' awaiting administrator approval
        const initialStatus: UserStatus = isBootstrapAdmin ? 'active' : 'pending';
        const initialRole: UserRole = isBootstrapAdmin ? 'admin' : 'member';
        const initialNotes = isBootstrapAdmin
          ? 'Super Administrador Fundador'
          : 'Cadastro realizado via Google Auth - Aguardando aprovação';

        const newProfile: UserProfile = {
          id: firebaseUser.uid,
          email: userEmail,
          displayName: firebaseUser.displayName || userEmail.split('@')[0] || 'Membro B3',
          photoURL: firebaseUser.photoURL || undefined,
          role: initialRole,
          status: initialStatus,
          createdAt: nowIso,
          lastLoginAt: nowIso,
          notes: initialNotes,
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
        status: isBootstrapAdmin ? 'active' : 'pending',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        notes: isBootstrapAdmin ? 'Super Administrador Fundador' : 'Aguardando aprovação',
      };
    }
  };

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (currentUser) {
        try {
          const profile = await fetchOrCreateProfile(currentUser);
          setUserProfile(profile);
          setError(null);

          // Attach real-time listener to user's profile document
          const userDocRef = doc(db, 'users', currentUser.uid);
          profileUnsubscribe = onSnapshot(
            userDocRef,
            (snap) => {
              if (snap.exists()) {
                const freshData = snap.data() as UserProfile;
                const isBootstrap = (currentUser.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
                setUserProfile({
                  ...freshData,
                  id: currentUser.uid,
                  email: currentUser.email || freshData.email,
                  role: isBootstrap ? 'admin' : freshData.role || 'member',
                  status: isBootstrap ? 'active' : freshData.status || 'pending',
                });
              }
            },
            (err) => {
              console.warn('Real-time profile listener notice:', err);
            }
          );
        } catch (err) {
          console.error('Failed to sync user profile:', err);
        }
      } else {
        // If no firebase user, check if we have a persisted admin session
        if (!adminSession) {
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, [adminSession]);

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

  const loginWithAdminCredentials = async (
    nameInput: string,
    passInput: string
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    setError(null);
    const cleanName = (nameInput || '').trim();
    const cleanPass = (passInput || '').trim();

    if (
      cleanName.toLowerCase() === ADMIN_CREDENTIALS.username.toLowerCase() &&
      cleanPass === ADMIN_CREDENTIALS.password
    ) {
      const nowIso = new Date().toISOString();
      const adminProf: UserProfile = {
        id: 'admin_wdracma',
        email: 'wdracma@alphaterminal.admin',
        displayName: 'Wdracma',
        role: 'admin',
        status: 'active',
        createdAt: nowIso,
        lastLoginAt: nowIso,
        notes: 'Administrador Master Credencial (Wdracma)',
      };

      try {
        localStorage.setItem(
          ADMIN_STORAGE_KEY,
          JSON.stringify({ username: 'Wdracma', timestamp: Date.now() })
        );
      } catch (e) {}

      // Register or update in Firestore if possible
      try {
        const adminDocRef = doc(db, 'users', 'admin_wdracma');
        setDoc(adminDocRef, adminProf, { merge: true }).catch(() => {});
      } catch (e) {}

      setAdminSession(true);
      setUserProfile(adminProf);
      setLoading(false);
      return { success: true };
    } else {
      setLoading(false);
      const errMsg = 'Nome ou senha administrativa incorretos.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      try {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
      } catch (e) {}
      setAdminSession(false);
      await signOut(auth).catch(() => {});
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
    adminSession ||
    userProfile?.role === 'admin' ||
    userProfile?.displayName === 'Wdracma' ||
    (user?.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  const isMember = Boolean(
    isAdmin ||
    (user && userProfile && userProfile.status === 'active') ||
    (userProfile && userProfile.status === 'active')
  );

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
        loginWithAdminCredentials,
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
