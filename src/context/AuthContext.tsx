import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  User,
  GoogleAuthProvider,
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
import {
  auth,
  db,
  googleProvider,
  createDriveConsentProvider,
  handleFirestoreError,
  OperationType,
} from '../services/firebase';
import {
  setDriveAccessToken,
  clearDriveAccessToken,
} from '../services/googleDriveService';
import { UserProfile, UserRole, UserStatus } from '../types/auth';

// Bootstrapped administrator email
export const BOOTSTRAP_ADMIN_EMAIL = 'cesar.suporte.vendas@gmail.com';

// Administrative credentials identifier
export const ADMIN_CREDENTIALS = {
  username: 'Wdracma',
};

export const ADMIN_STORAGE_KEY = 'b3_alpha_terminal_admin_auth_v1';
export const EMAIL_STORAGE_KEY = 'b3_alpha_terminal_email_auth_v1';

export interface EmailInitResult {
  success: boolean;
  requiresPassword?: boolean;
  needsPasswordSetup?: boolean;
  email?: string;
  displayName?: string;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  adminToken: string | null;
  emailToken: string | null;
  driveAccessToken: string | null;
  driveAccountEmail: string | null;
  isAdmin: boolean;
  isMember: boolean;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<UserProfile | null>;
  connectGoogleDrive: () => Promise<string | null>;
  disconnectGoogleDrive: () => void;
  loginWithEmailStart: (email: string, displayName?: string) => Promise<EmailInitResult>;
  loginWithEmailPassword: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; member?: UserProfile; needsPasswordSetup?: boolean; error?: string }>;
  loginWithAdminCredentials: (name: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerMemberPassword: (
    password: string,
    displayName?: string
  ) => Promise<{ success: boolean; error?: string }>;
  getAdminAuthHeaders: () => Promise<Record<string, string>>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

async function hashMemberPassword(uid: string, password: string): Promise<string> {
  const input = `${uid}:${password}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0') +
    ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0') +
    ((h1 + h2) >>> 0).toString(16).padStart(8, '0')
  );
}

async function safeParseJsonResponse(resp: Response): Promise<Record<string, any> | null> {
  try {
    const raw = await resp.text();
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return null;
  }
}

function formatFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const message = err instanceof Error ? err.message : String(err || '');
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  if (code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain')) {
    return `Domínio "${host}" não autorizado no Firebase Auth. Adicione "${host}" em Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (code === 'auth/popup-blocked' || message.includes('auth/popup-blocked')) {
    return 'Pop-up de login bloqueado pelo navegador. Libere pop-ups para este site e tente novamente.';
  }
  if (code === 'auth/popup-closed-by-user' || message.includes('auth/popup-closed-by-user')) {
    return 'Janela de login Google fechada antes da conclusão.';
  }
  if (code === 'auth/operation-not-allowed' || message.includes('auth/operation-not-allowed')) {
    return 'Login Google não está habilitado nas configurações do Firebase Authentication.';
  }
  if (code === 'auth/network-request-failed' || message.includes('auth/network-request-failed')) {
    return 'Falha de rede ao conectar com o serviço de autenticação Google/Firebase.';
  }
  return message || 'Falha na autenticação com Google.';
}

function readStoredAdminSession(): { active: boolean; token: string | null } {
  try {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.username === 'Wdracma') {
        return {
          active: true,
          token: typeof parsed.token === 'string' && parsed.token.length > 0 ? parsed.token : null,
        };
      }
    }
  } catch {}
  return { active: false, token: null };
}

function readStoredEmailToken(): string | null {
  try {
    const stored = localStorage.getItem(EMAIL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.token === 'string' && parsed.token.length > 0) {
        return parsed.token;
      }
    }
  } catch {}
  return null;
}

function pickLatestProfile(firestoreProf: UserProfile, serverProf?: UserProfile | null): UserProfile {
  if (!serverProf) return firestoreProf;
  const fsTime = new Date(firestoreProf.updatedAt || firestoreProf.createdAt || 0).getTime();
  const svTime = new Date(serverProf.updatedAt || serverProf.createdAt || 0).getTime();

  if (svTime > fsTime) {
    return {
      ...firestoreProf,
      role: serverProf.role || firestoreProf.role,
      status: serverProf.status || firestoreProf.status,
      notes: serverProf.notes !== undefined ? serverProf.notes : firestoreProf.notes,
      hasPassword: Boolean(firestoreProf.hasPassword || serverProf.hasPassword),
      updatedAt: serverProf.updatedAt || firestoreProf.updatedAt,
    };
  }

  return {
    ...firestoreProf,
    hasPassword: Boolean(firestoreProf.hasPassword || serverProf.hasPassword),
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const initialStored = readStoredAdminSession();
  const initialEmailToken = readStoredEmailToken();

  const [adminSession, setAdminSession] = useState<boolean>(initialStored.active);
  const [adminToken, setAdminToken] = useState<string | null>(initialStored.token);
  const [emailToken, setEmailToken] = useState<string | null>(initialEmailToken);
  const [driveAccessToken, setDriveAccessTokenState] = useState<string | null>(null);
  const [driveAccountEmail, setDriveAccountEmail] = useState<string | null>(null);

  const isConnectingDriveRef = React.useRef(false);
  const adminSessionRef = React.useRef(initialStored.active);
  const emailTokenRef = React.useRef(initialEmailToken);
  adminSessionRef.current = adminSession;
  emailTokenRef.current = emailToken;

  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    if (initialStored.active) {
      return {
        id: 'admin_wdracma',
        email: 'wdracma@alphaterminal.admin',
        displayName: 'Wdracma',
        role: 'admin',
        status: 'active',
        createdAt: '2026-11-09T00:00:00.000Z',
        lastLoginAt: new Date().toISOString(),
        notes: 'Administrador Master Credencial (Wdracma)',
        hasPassword: true,
      };
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const syncMemberWithServer = useCallback(
    async (
      firebaseUser: User,
      overrides?: { hasPassword?: boolean; displayName?: string; password?: string }
    ): Promise<UserProfile | null> => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const resp = await fetch('/api/members/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            displayName: overrides?.displayName || firebaseUser.displayName || undefined,
            photoURL: firebaseUser.photoURL || undefined,
            ...(overrides?.hasPassword !== undefined ? { hasPassword: overrides.hasPassword } : {}),
            ...(overrides?.password ? { password: overrides.password } : {}),
          }),
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return (data?.member as UserProfile) || null;
      } catch (err) {
        console.warn('Could not sync member with server:', err);
        return null;
      }
    },
    []
  );

  const fetchMemberStatusFromServer = useCallback(async (firebaseUser: User): Promise<UserProfile | null> => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const resp = await fetch('/api/members/me', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return (data?.member as UserProfile) || null;
    } catch {
      return null;
    }
  }, []);

  const fetchEmailMemberProfile = useCallback(async (token: string): Promise<UserProfile | null> => {
    try {
      const resp = await fetch('/api/members/email/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return (data?.member as UserProfile) || null;
    } catch {
      return null;
    }
  }, []);

  const fetchOrCreateProfile = useCallback(
    async (firebaseUser: User): Promise<UserProfile> => {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userEmail = (firebaseUser.email || '').toLowerCase().trim();
      const isBootstrapAdmin = userEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
      const nowIso = new Date().toISOString();

      let baseProfile: UserProfile;

      try {
        const snap = await getDoc(userDocRef);

        if (snap.exists()) {
          const existingData = snap.data() as UserProfile;
          const updatedRole: UserRole = isBootstrapAdmin ? 'admin' : existingData.role || 'member';
          const updatedStatus: UserStatus = isBootstrapAdmin ? 'active' : existingData.status || 'pending';

          baseProfile = {
            ...existingData,
            id: firebaseUser.uid,
            email: userEmail,
            displayName: firebaseUser.displayName || existingData.displayName || userEmail.split('@')[0],
            ...(firebaseUser.photoURL || existingData.photoURL
              ? { photoURL: firebaseUser.photoURL || existingData.photoURL }
              : {}),
            role: updatedRole,
            status: updatedStatus,
            lastLoginAt: nowIso,
          };

          updateDoc(userDocRef, {
            lastLoginAt: nowIso,
            displayName: baseProfile.displayName,
            ...(isBootstrapAdmin ? { role: 'admin', status: 'active' } : {}),
          }).catch((err) => console.warn('Could not update lastLoginAt:', err));

          if (isBootstrapAdmin) {
            const adminDocRef = doc(db, 'admins', firebaseUser.uid);
            setDoc(
              adminDocRef,
              {
                email: userEmail,
                addedAt: existingData.createdAt || nowIso,
              },
              { merge: true }
            ).catch(() => {});
          }
        } else {
          const initialStatus: UserStatus = isBootstrapAdmin ? 'active' : 'pending';
          const initialRole: UserRole = isBootstrapAdmin ? 'admin' : 'member';
          const initialNotes = isBootstrapAdmin
            ? 'Super Administrador Fundador'
            : 'Cadastro realizado via Google Auth - Aguardando aprovação';

          const newProfile: UserProfile = {
            id: firebaseUser.uid,
            email: userEmail,
            displayName: firebaseUser.displayName || userEmail.split('@')[0] || 'Membro B3',
            ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
            role: initialRole,
            status: initialStatus,
            createdAt: nowIso,
            lastLoginAt: nowIso,
            notes: initialNotes,
            hasPassword: isBootstrapAdmin ? true : false,
          };

          await setDoc(userDocRef, newProfile);

          if (isBootstrapAdmin) {
            const adminDocRef = doc(db, 'admins', firebaseUser.uid);
            await setDoc(adminDocRef, {
              email: userEmail,
              addedAt: nowIso,
            });
          }

          baseProfile = newProfile;
        }
      } catch (err) {
        console.error('Error fetching or creating profile in Firestore:', err);
        baseProfile = {
          id: firebaseUser.uid,
          email: userEmail,
          displayName: firebaseUser.displayName || userEmail.split('@')[0],
          ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
          role: isBootstrapAdmin ? 'admin' : 'member',
          status: isBootstrapAdmin ? 'active' : 'pending',
          createdAt: nowIso,
          lastLoginAt: nowIso,
          notes: isBootstrapAdmin ? 'Super Administrador Fundador' : 'Aguardando aprovação',
          hasPassword: isBootstrapAdmin ? true : false,
        };
      }

      const serverProfile = await syncMemberWithServer(firebaseUser, {
        hasPassword: baseProfile.hasPassword,
        displayName: baseProfile.displayName,
      });

      const merged = pickLatestProfile(baseProfile, serverProfile);
      if (isBootstrapAdmin) {
        merged.role = 'admin';
        merged.status = 'active';
      }
      return merged;
    },
    [syncMemberWithServer]
  );

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        clearDriveAccessToken();
        setDriveAccessTokenState(null);
        setDriveAccountEmail(null);
      }

      // If connecting Google Drive while logged in as Wdracma Admin or Email member, preserve the active session profile
      if (isConnectingDriveRef.current || (currentUser && (adminSessionRef.current || emailTokenRef.current))) {
        setLoading(false);
        return;
      }

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

          const userDocRef = doc(db, 'users', currentUser.uid);
          profileUnsubscribe = onSnapshot(
            userDocRef,
            async (snap) => {
              if (snap.exists()) {
                const freshData = snap.data() as UserProfile;
                const isBootstrap =
                  (currentUser.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
                const fsProf: UserProfile = {
                  ...freshData,
                  id: currentUser.uid,
                  email: currentUser.email || freshData.email,
                  role: isBootstrap ? 'admin' : freshData.role || 'member',
                  status: isBootstrap ? 'active' : freshData.status || 'pending',
                };
                const serverProf = await fetchMemberStatusFromServer(currentUser);
                const merged = pickLatestProfile(fsProf, serverProf);
                if (isBootstrap) {
                  merged.role = 'admin';
                  merged.status = 'active';
                }
                setUserProfile(merged);
              }
            },
            (err) => {
              console.warn('Real-time profile listener notice:', err);
            }
          );
        } catch (err) {
          console.error('Failed to sync user profile:', err);
        }
      } else if (!adminSession) {
        if (emailToken) {
          const emailProf = await fetchEmailMemberProfile(emailToken);
          if (emailProf) {
            setUserProfile(emailProf);
          } else {
            try {
              localStorage.removeItem(EMAIL_STORAGE_KEY);
            } catch {}
            setEmailToken(null);
            setUserProfile(null);
          }
        } else {
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
  }, [adminSession, emailToken, fetchOrCreateProfile, fetchMemberStatusFromServer, fetchEmailMemberProfile]);

  // Fast server-status sync poll for pending/suspended members (both Google and Email)
  useEffect(() => {
    if (!userProfile) return;
    const isBootstrap =
      (user?.email || userProfile.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
    if (isBootstrap || adminSession || userProfile.role === 'admin') return;
    if (userProfile.status !== 'pending' && userProfile.status !== 'suspended') return;

    const timer = setInterval(async () => {
      if (user) {
        const serverProf = await fetchMemberStatusFromServer(user);
        if (serverProf && (serverProf.status !== userProfile.status || serverProf.role !== userProfile.role)) {
          setUserProfile((prev) => (prev ? pickLatestProfile(prev, serverProf) : serverProf));
        }
      } else if (emailToken) {
        const emailProf = await fetchEmailMemberProfile(emailToken);
        if (
          emailProf &&
          (emailProf.status !== userProfile.status ||
            emailProf.role !== userProfile.role ||
            emailProf.notes !== userProfile.notes)
        ) {
          setUserProfile(emailProf);
        }
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [user, emailToken, userProfile, adminSession, fetchMemberStatusFromServer, fetchEmailMemberProfile]);

  const loginWithGoogle = async (): Promise<UserProfile | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setDriveAccessToken(credential.accessToken, result.user?.email || null);
        setDriveAccessTokenState(credential.accessToken);
        setDriveAccountEmail(result.user?.email || null);
      }
      try {
        localStorage.removeItem(EMAIL_STORAGE_KEY);
      } catch {}
      setEmailToken(null);
      emailTokenRef.current = null;
      const profile = await fetchOrCreateProfile(result.user);
      setUser(result.user);
      setUserProfile(profile);
      return profile;
    } catch (err: unknown) {
      const msg = formatFirebaseAuthError(err);
      setError(msg);
      console.error('Login error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const connectGoogleDrive = useCallback(async (): Promise<string | null> => {
    isConnectingDriveRef.current = true;
    try {
      const provider = createDriveConsentProvider();
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Não foi possível obter o token de acesso do Google Drive.');
      }
      const token = credential.accessToken;
      const connectedMail = result.user?.email || null;
      setDriveAccessToken(token, connectedMail);
      setDriveAccessTokenState(token);
      setDriveAccountEmail(connectedMail);
      return token;
    } catch (err) {
      console.error('Google Drive connection error:', err);
      throw new Error(formatFirebaseAuthError(err));
    } finally {
      isConnectingDriveRef.current = false;
    }
  }, []);

  const disconnectGoogleDrive = useCallback(() => {
    clearDriveAccessToken();
    setDriveAccessTokenState(null);
    setDriveAccountEmail(null);
  }, []);

  const loginWithEmailStart = async (
    emailInput: string,
    displayName?: string
  ): Promise<EmailInitResult> => {
    setError(null);
    const cleanEmail = (emailInput || '').trim().toLowerCase();

    try {
      const resp = await fetch('/api/members/email/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, displayName: displayName?.trim() || undefined }),
      });
      const data = await safeParseJsonResponse(resp);

      if (!data) {
        const errMsg = `Servidor de autenticação indisponível (HTTP ${resp.status}).`;
        setError(errMsg);
        return { success: false, error: errMsg };
      }

      if (!resp.ok) {
        const errMsg = data?.error || 'Não foi possível iniciar o acesso por e-mail.';
        setError(errMsg);
        return { success: false, error: errMsg };
      }

      if (data.requiresPassword) {
        return {
          success: true,
          requiresPassword: true,
          email: data.email || cleanEmail,
          displayName: data.displayName,
        };
      }

      if (data.needsPasswordSetup && data.token && data.member) {
        try {
          localStorage.setItem(
            EMAIL_STORAGE_KEY,
            JSON.stringify({ token: data.token, email: cleanEmail, timestamp: Date.now() })
          );
        } catch {}
        setEmailToken(data.token);
        setUserProfile(data.member as UserProfile);
        return {
          success: true,
          requiresPassword: false,
          needsPasswordSetup: true,
          email: cleanEmail,
          displayName: data.member.displayName,
        };
      }

      return { success: false, error: 'Resposta inesperada do servidor.' };
    } catch {
      const errMsg = 'Erro de conexão ao verificar e-mail.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const loginWithEmailPassword = async (
    emailInput: string,
    passwordInput: string
  ): Promise<{ success: boolean; member?: UserProfile; needsPasswordSetup?: boolean; error?: string }> => {
    setError(null);
    const cleanEmail = (emailInput || '').trim().toLowerCase();
    const cleanPassword = (passwordInput || '').trim();

    try {
      const resp = await fetch('/api/members/email/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });
      const data = await safeParseJsonResponse(resp);

      if (!data) {
        const errMsg = `Servidor de autenticação indisponível (HTTP ${resp.status}).`;
        setError(errMsg);
        return { success: false, error: errMsg };
      }

      if (!resp.ok || !data?.token || !data?.member) {
        const errMsg = data?.error || 'E-mail ou senha incorretos.';
        setError(errMsg);
        return {
          success: false,
          needsPasswordSetup: Boolean(data?.needsPasswordSetup),
          error: errMsg,
        };
      }

      try {
        localStorage.setItem(
          EMAIL_STORAGE_KEY,
          JSON.stringify({ token: data.token, email: cleanEmail, timestamp: Date.now() })
        );
      } catch {}

      emailTokenRef.current = data.token;
      setEmailToken(data.token);
      setUserProfile(data.member as UserProfile);
      return { success: true, member: data.member as UserProfile };
    } catch {
      const errMsg = 'Erro de conexão ao realizar login por e-mail.';
      setError(errMsg);
      return { success: false, error: errMsg };
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

    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanName, password: cleanPass }),
      });

      const data = await safeParseJsonResponse(resp);

      if (!data) {
        const errMsg = `Endpoint administrativo indisponível (HTTP ${resp.status}). Verifique se as rotas /api/* estão configuradas no deploy.`;
        setError(errMsg);
        setLoading(false);
        return { success: false, error: errMsg };
      }

      if (resp.ok && data?.success && data?.token) {
        const adminProf: UserProfile = data.admin || {
          id: 'admin_wdracma',
          email: 'wdracma@alphaterminal.admin',
          displayName: 'Wdracma',
          role: 'admin',
          status: 'active',
          createdAt: '2026-11-09T00:00:00.000Z',
          lastLoginAt: new Date().toISOString(),
          notes: 'Administrador Master Credencial (Wdracma)',
          hasPassword: true,
        };

        try {
          localStorage.setItem(
            ADMIN_STORAGE_KEY,
            JSON.stringify({ username: 'Wdracma', token: data.token, timestamp: Date.now() })
          );
        } catch {}

        setAdminToken(data.token);
        setAdminSession(true);
        setUserProfile(adminProf);
        setLoading(false);
        return { success: true };
      }

      const errMsg = data?.error || 'Nome ou senha administrativa incorretos.';
      setError(errMsg);
      setLoading(false);
      return { success: false, error: errMsg };
    } catch {
      setLoading(false);
      const errMsg = 'Erro de conexão ao validar credenciais administrativas.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const registerMemberPassword = async (
    password: string,
    displayName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanPass = password.trim();
    if (cleanPass.length < 6) {
      return { success: false, error: 'A senha deve conter no mínimo 6 caracteres.' };
    }

    // Branch A: Email member password registration
    if (!user && emailToken) {
      try {
        const resp = await fetch('/api/members/email/set-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${emailToken}`,
          },
          body: JSON.stringify({
            password: cleanPass,
            displayName: displayName?.trim() || undefined,
          }),
        });
        const data = await resp.json();
        if (!resp.ok || !data?.member) {
          return {
            success: false,
            error: data?.error || 'Não foi possível cadastrar sua senha.',
          };
        }

        if (data.token) {
          try {
            localStorage.setItem(
              EMAIL_STORAGE_KEY,
              JSON.stringify({ token: data.token, email: data.member.email, timestamp: Date.now() })
            );
          } catch {}
          setEmailToken(data.token);
        }

        setUserProfile(data.member as UserProfile);
        return { success: true };
      } catch {
        return {
          success: false,
          error: 'Erro de conexão ao cadastrar senha. Tente novamente.',
        };
      }
    }

    // Branch B: Google Auth member password registration
    if (!user) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    const nowIso = new Date().toISOString();
    const passwordHash = await hashMemberPassword(user.uid, cleanPass);
    const userEmail = (user.email || '').toLowerCase().trim();
    const isBootstrap = userEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

    let firestoreSaved = false;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        await updateDoc(userDocRef, {
          hasPassword: true,
          passwordHash,
          passwordUpdatedAt: nowIso,
        });
      } else {
        await setDoc(userDocRef, {
          id: user.uid,
          email: userEmail,
          displayName: user.displayName || userEmail.split('@')[0] || 'Membro B3',
          ...(user.photoURL ? { photoURL: user.photoURL } : {}),
          role: isBootstrap ? 'admin' : 'member',
          status: isBootstrap ? 'active' : 'pending',
          createdAt: nowIso,
          lastLoginAt: nowIso,
          notes: isBootstrap ? 'Super Administrador Fundador' : 'Cadastro realizado via Google Auth com senha',
          hasPassword: true,
          passwordHash,
          passwordUpdatedAt: nowIso,
        });
      }
      firestoreSaved = true;
    } catch (err: unknown) {
      console.error('Error registering member password in Firestore:', err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      } catch {}
    }

    const serverSynced = await syncMemberWithServer(user, {
      hasPassword: true,
      password: cleanPass,
    });

    if (firestoreSaved || serverSynced) {
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              hasPassword: true,
              passwordHash,
              passwordUpdatedAt: nowIso,
            }
          : prev
      );
      return { success: true };
    }

    return {
      success: false,
      error: 'Não foi possível salvar a senha no banco de dados. Tente novamente.',
    };
  };

  const getAdminAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    if (user) {
      try {
        const idToken = await user.getIdToken();
        if (idToken) {
          headers['X-Firebase-Id-Token'] = idToken;
          if (!headers['Authorization']) {
            headers['Authorization'] = `Bearer ${idToken}`;
          }
        }
      } catch {}
    }
    return headers;
  }, [adminToken, user]);

  const logout = async () => {
    setLoading(true);
    try {
      try {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
        localStorage.removeItem(EMAIL_STORAGE_KEY);
      } catch {}
      clearDriveAccessToken();
      setDriveAccessTokenState(null);
      setDriveAccountEmail(null);
      adminSessionRef.current = false;
      emailTokenRef.current = null;
      setAdminSession(false);
      setAdminToken(null);
      setEmailToken(null);
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
    } else if (emailToken) {
      const updated = await fetchEmailMemberProfile(emailToken);
      if (updated) {
        setUserProfile(updated);
      }
    }
  };

  const isAdmin =
    adminSession ||
    userProfile?.role === 'admin' ||
    userProfile?.displayName === 'Wdracma' ||
    (user?.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  const isMember = Boolean(
    isAdmin ||
      (user && userProfile && userProfile.status === 'active' && userProfile.hasPassword) ||
      (emailToken && userProfile && userProfile.status === 'active' && userProfile.hasPassword) ||
      (userProfile && userProfile.status === 'active' && userProfile.hasPassword)
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        adminToken,
        emailToken,
        driveAccessToken,
        driveAccountEmail,
        isAdmin,
        isMember,
        loading,
        error,
        loginWithGoogle,
        connectGoogleDrive,
        disconnectGoogleDrive,
        loginWithEmailStart,
        loginWithEmailPassword,
        loginWithAdminCredentials,
        registerMemberPassword,
        getAdminAuthHeaders,
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
