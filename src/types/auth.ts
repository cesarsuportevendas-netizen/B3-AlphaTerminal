export type UserRole = 'admin' | 'member';
export type UserStatus = 'active' | 'suspended' | 'pending';

export interface UserProfile {
  id: string; // Firebase Auth UID
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string;
  updatedAt?: string;
  notes?: string;
  hasPassword?: boolean;
  passwordHash?: string;
  passwordUpdatedAt?: string;
}

export interface AdminRecord {
  email: string;
  addedAt: string;
}
