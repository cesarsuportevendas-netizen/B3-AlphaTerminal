import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// CRITICAL: Must specify firestoreDatabaseId for enterprise database provisioning
const configuredDatabaseId =
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
  'ai-studio-b3alphaterminal-855a5739-a724-4a3c-b6f0-36a0303aaf8c';
export const db = getFirestore(app, configuredDatabaseId);
export const auth = getAuth(app);

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId || 'shining-smoke-356101';
export const FIREBASE_AUTH_DOMAIN =
  firebaseConfig.authDomain || `${FIREBASE_PROJECT_ID}.firebaseapp.com`;
export const FIREBASE_OAUTH_CLIENT_ID =
  (firebaseConfig as { oAuthClientId?: string }).oAuthClientId || '';
export const IS_OAUTH_CLIENT_LINKED = Boolean(
  FIREBASE_OAUTH_CLIENT_ID &&
    firebaseConfig.messagingSenderId &&
    FIREBASE_OAUTH_CLIENT_ID.startsWith(`${firebaseConfig.messagingSenderId}-`)
);

export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
] as const;

export const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
] as const;

export const SCOPES = [...DRIVE_SCOPES, ...GMAIL_SCOPES] as const;

export const googleProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});
googleProvider.setCustomParameters({
  prompt: 'select_account',
  include_granted_scopes: 'true',
});

export function createWorkspaceSignInProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => {
    provider.addScope(scope);
  });
  provider.setCustomParameters({
    prompt: 'select_account',
    include_granted_scopes: 'true',
  });
  return provider;
}

export function createWorkspaceConsentProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => {
    provider.addScope(scope);
  });
  provider.setCustomParameters({
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
  });
  return provider;
}

export function createBasicGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
}

export const createDriveConsentProvider = createWorkspaceConsentProvider;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore on startup
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline. Verifique a conexão com a internet.');
      return false;
    }
    // Expected to receive 404/not found or permission check on test doc, which confirms connection is live
    return true;
  }
}

// Immediately trigger non-blocking connection verification
testConnection();
