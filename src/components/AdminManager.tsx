import React, { useState, useEffect, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import {
  Shield,
  Users,
  UserCheck,
  Search,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Ban,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { useAuth, BOOTSTRAP_ADMIN_EMAIL } from '../context/AuthContext';
import { UserProfile, UserRole, UserStatus } from '../types/auth';

function isMasterAdminUser(u: Pick<UserProfile, 'id' | 'email' | 'displayName'>): boolean {
  const email = (u.email || '').toLowerCase();
  return (
    email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
    u.displayName === 'Wdracma' ||
    u.id === 'admin_wdracma'
  );
}

function mergeUserLists(firestoreUsers: UserProfile[], serverUsers: UserProfile[]): UserProfile[] {
  const map = new Map<string, UserProfile>();

  for (const su of serverUsers) {
    if (su && su.id) {
      map.set(su.id, su);
    }
  }

  for (const fu of firestoreUsers) {
    if (!fu || !fu.id) continue;
    const existing = map.get(fu.id);
    if (!existing) {
      map.set(fu.id, fu);
      continue;
    }

    const fuTime = new Date(fu.updatedAt || fu.lastLoginAt || fu.createdAt || 0).getTime();
    const svTime = new Date(existing.updatedAt || existing.lastLoginAt || existing.createdAt || 0).getTime();

    if (fuTime > svTime) {
      map.set(fu.id, {
        ...existing,
        ...fu,
        hasPassword: Boolean(fu.hasPassword || existing.hasPassword),
      });
    } else {
      map.set(fu.id, {
        ...fu,
        ...existing,
        hasPassword: Boolean(fu.hasPassword || existing.hasPassword),
      });
    }
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return new Date(b.lastLoginAt || 0).getTime() - new Date(a.lastLoginAt || 0).getTime();
  });

  return merged;
}

export const AdminManager: React.FC = () => {
  const {
    user,
    userProfile,
    adminToken,
    isAdmin,
    getAdminAuthHeaders,
    loginWithAdminCredentials,
  } = useAuth();

  const [firestoreUsers, setFirestoreUsers] = useState<UserProfile[]>([]);
  const [serverUsers, setServerUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [needsSessionRefresh, setNeedsSessionRefresh] = useState<boolean>(false);

  // Re-auth form for legacy Wdracma session without token
  const [reauthName, setReauthName] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);

  // New user pre-registration state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('member');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Delete confirmation modal state (avoids blocked window.confirm inside iframe)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserProfile | null>(null);

  // Editing notes state
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');

  const showSuccess = (msg: string) => {
    setErrorMessage(null);
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  const fetchServerUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const headers = await getAdminAuthHeaders();
      if (!headers.Authorization && !headers['X-Firebase-Id-Token']) {
        setNeedsSessionRefresh(true);
        setLoading(false);
        return;
      }

      const resp = await fetch('/api/admin/users', { headers });
      if (resp.status === 401 || resp.status === 403) {
        if (!user) {
          setNeedsSessionRefresh(true);
        }
        return;
      }
      if (resp.ok) {
        const data = await resp.json();
        setNeedsSessionRefresh(false);
        if (Array.isArray(data?.users)) {
          setServerUsers(data.users);
        }
      }
    } catch (err) {
      console.warn('Error fetching server users:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user, getAdminAuthHeaders]);

  // Initial fetch & polling of server registry (keeps Wdracma and Google Admin synced)
  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    fetchServerUsers();
    const timer = setInterval(fetchServerUsers, 6000);
    return () => clearInterval(timer);
  }, [isAdmin, adminToken, user, fetchServerUsers]);

  // Real-time Firestore sync on /users collection when Google Auth session is active
  useEffect(() => {
    if (!isAdmin || !user) {
      return;
    }

    const usersCollectionRef = collection(db, 'users');
    const unsubscribe = onSnapshot(
      usersCollectionRef,
      async (snapshot) => {
        const loaded: UserProfile[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as UserProfile;
          loaded.push({
            ...data,
            id: d.id,
          });
        });

        if (user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
          const exists = loaded.some(
            (u) => (u.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
          );
          if (!exists) {
            loaded.unshift({
              id: user.uid,
              email: BOOTSTRAP_ADMIN_EMAIL,
              displayName: user.displayName || 'Super Administrador',
              role: 'admin',
              status: 'active',
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
              notes: 'Super Administrador Fundador',
              hasPassword: true,
            });
          }
        }

        setFirestoreUsers(loaded);
        setLoading(false);

        // Push Firestore docs to server registry so both stay unified
        try {
          const headers = await getAdminAuthHeaders();
          if (headers.Authorization || headers['X-Firebase-Id-Token']) {
            const resp = await fetch('/api/admin/users/sync-batch', {
              method: 'POST',
              headers,
              body: JSON.stringify({ users: loaded }),
            });
            if (resp.ok) {
              const data = await resp.json();
              if (Array.isArray(data?.users)) {
                setServerUsers(data.users);
              }
            }
          }
        } catch {}
      },
      (error) => {
        console.warn('Firestore users listener notice:', error);
        try {
          handleFirestoreError(error, OperationType.GET, 'users');
        } catch {}
      }
    );

    return () => unsubscribe();
  }, [isAdmin, user, getAdminAuthHeaders]);

  // Combine Firestore + Server lists + ensure Wdracma appears
  const usersList = React.useMemo(() => {
    const merged = mergeUserLists(firestoreUsers, serverUsers);
    const wdracmaExists = merged.some(
      (u) => u.displayName === 'Wdracma' || u.id === 'admin_wdracma'
    );
    if (!wdracmaExists) {
      merged.unshift({
        id: 'admin_wdracma',
        email: 'wdracma@alphaterminal.admin',
        displayName: 'Wdracma',
        role: 'admin',
        status: 'active',
        createdAt: '2026-11-09T00:00:00.000Z',
        lastLoginAt: userProfile?.displayName === 'Wdracma' ? new Date().toISOString() : 'Recente',
        notes: 'Administrador Master Credencial',
        hasPassword: true,
      });
    }
    return merged;
  }, [firestoreUsers, serverUsers, userProfile?.displayName]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchServerUsers();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleReauthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReauthLoading(true);
    setErrorMessage(null);
    const res = await loginWithAdminCredentials(reauthName, reauthPassword);
    setReauthLoading(false);
    if (res.success) {
      setReauthName('');
      setReauthPassword('');
      setNeedsSessionRefresh(false);
      await fetchServerUsers();
      showSuccess('Sessão administrativa validada com sucesso!');
    } else {
      setErrorMessage(res.error || 'Credenciais inválidas.');
    }
  };

  const handleUpdateStatus = async (targetUser: UserProfile, newStatus: UserStatus) => {
    if (isMasterAdminUser(targetUser) && newStatus === 'suspended') {
      setErrorMessage('Não é permitido suspender o Administrador Master.');
      return;
    }

    setProcessingUserId(targetUser.id);
    setErrorMessage(null);
    const nowIso = new Date().toISOString();

    let serverOk = false;
    let firestoreOk = false;
    let lastError = '';

    // 1. Update via authenticated Server API (works for Wdracma AND Google Admins)
    try {
      const headers = await getAdminAuthHeaders();
      const resp = await fetch(`/api/admin/users/${encodeURIComponent(targetUser.id)}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: newStatus,
          email: targetUser.email,
          displayName: targetUser.displayName,
          role: targetUser.role,
          createdAt: targetUser.createdAt,
          lastLoginAt: targetUser.lastLoginAt,
          notes: targetUser.notes,
          hasPassword: targetUser.hasPassword,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        serverOk = true;
        if (data?.user) {
          setServerUsers((prev) => {
            const exists = prev.some((u) => u.id === targetUser.id);
            return exists
              ? prev.map((u) => (u.id === targetUser.id ? data.user : u))
              : [data.user, ...prev];
          });
        }
      } else {
        const errBody = await resp.json().catch(() => ({}));
        lastError = errBody?.error || `Erro HTTP ${resp.status}`;
        if (resp.status === 401 || resp.status === 403) {
          setNeedsSessionRefresh(true);
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Falha de rede';
    }

    // 2. Also update/mirror in Firestore when Google Auth admin session is active
    if (user) {
      try {
        const userRef = doc(db, 'users', targetUser.id);
        await setDoc(
          userRef,
          {
            id: targetUser.id,
            email: targetUser.email,
            displayName: targetUser.displayName,
            role: targetUser.role,
            status: newStatus,
            createdAt: targetUser.createdAt || nowIso,
            lastLoginAt: targetUser.lastLoginAt || nowIso,
            updatedAt: nowIso,
            hasPassword: Boolean(targetUser.hasPassword),
            ...(targetUser.notes !== undefined ? { notes: targetUser.notes } : {}),
          },
          { merge: true }
        );
        firestoreOk = true;
      } catch (err) {
        console.warn('Firestore setDoc status notice:', err);
        try {
          handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.id}`);
        } catch {}
        if (!serverOk) {
          lastError = err instanceof Error ? err.message : 'Erro ao atualizar no Firestore.';
        }
      }
    }

    setProcessingUserId(null);

    if (serverOk || firestoreOk) {
      const statusLabel =
        newStatus === 'active'
          ? 'Ativo (Aprovado)'
          : newStatus === 'suspended'
          ? 'Suspenso (Recusado)'
          : 'Pendente';
      showSuccess(`Status de ${targetUser.email || targetUser.displayName} alterado para "${statusLabel}".`);
    } else {
      setErrorMessage(`Não foi possível atualizar o status: ${lastError || 'Verifique sua sessão administrativa.'}`);
    }
  };

  const handleUpdateRole = async (targetUser: UserProfile, newRole: UserRole) => {
    if (isMasterAdminUser(targetUser) && newRole === 'member') {
      setErrorMessage('O Administrador Master deve permanecer com papel de administrador.');
      return;
    }

    setProcessingUserId(targetUser.id);
    setErrorMessage(null);
    const nowIso = new Date().toISOString();

    let serverOk = false;
    let firestoreOk = false;
    let lastError = '';

    try {
      const headers = await getAdminAuthHeaders();
      const resp = await fetch(`/api/admin/users/${encodeURIComponent(targetUser.id)}/role`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          role: newRole,
          email: targetUser.email,
          displayName: targetUser.displayName,
          status: targetUser.status,
          createdAt: targetUser.createdAt,
          lastLoginAt: targetUser.lastLoginAt,
          notes: targetUser.notes,
          hasPassword: targetUser.hasPassword,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        serverOk = true;
        if (data?.user) {
          setServerUsers((prev) => {
            const exists = prev.some((u) => u.id === targetUser.id);
            return exists
              ? prev.map((u) => (u.id === targetUser.id ? data.user : u))
              : [data.user, ...prev];
          });
        }
      } else {
        const errBody = await resp.json().catch(() => ({}));
        lastError = errBody?.error || `Erro HTTP ${resp.status}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Falha de rede';
    }

    if (user) {
      try {
        const userRef = doc(db, 'users', targetUser.id);
        await setDoc(
          userRef,
          {
            id: targetUser.id,
            email: targetUser.email,
            displayName: targetUser.displayName,
            role: newRole,
            status: targetUser.status,
            createdAt: targetUser.createdAt || nowIso,
            lastLoginAt: targetUser.lastLoginAt || nowIso,
            updatedAt: nowIso,
            hasPassword: Boolean(targetUser.hasPassword),
          },
          { merge: true }
        );

        const adminDocRef = doc(db, 'admins', targetUser.id);
        if (newRole === 'admin') {
          await setDoc(adminDocRef, {
            email: targetUser.email,
            addedAt: nowIso,
          });
        } else {
          await deleteDoc(adminDocRef).catch(() => {});
        }
        firestoreOk = true;
      } catch (err) {
        console.warn('Firestore setDoc role notice:', err);
        try {
          handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.id}`);
        } catch {}
        if (!serverOk) {
          lastError = 'Erro ao alterar nível de acesso no Firestore.';
        }
      }
    }

    setProcessingUserId(null);

    if (serverOk || firestoreOk) {
      showSuccess(`Papel de ${targetUser.email} alterado para "${newRole === 'admin' ? 'Administrador' : 'Membro'}".`);
    } else {
      setErrorMessage(lastError || 'Erro ao alterar nível de acesso.');
    }
  };

  const handleSaveNotes = async (targetUser: UserProfile) => {
    setProcessingUserId(targetUser.id);
    setErrorMessage(null);
    const nowIso = new Date().toISOString();

    let serverOk = false;
    let firestoreOk = false;

    try {
      const headers = await getAdminAuthHeaders();
      const resp = await fetch(`/api/admin/users/${encodeURIComponent(targetUser.id)}/notes`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          notes: tempNotes,
          email: targetUser.email,
          displayName: targetUser.displayName,
          role: targetUser.role,
          status: targetUser.status,
          createdAt: targetUser.createdAt,
          lastLoginAt: targetUser.lastLoginAt,
          hasPassword: targetUser.hasPassword,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        serverOk = true;
        if (data?.user) {
          setServerUsers((prev) => {
            const exists = prev.some((u) => u.id === targetUser.id);
            return exists
              ? prev.map((u) => (u.id === targetUser.id ? data.user : u))
              : [data.user, ...prev];
          });
        }
      }
    } catch {}

    if (user) {
      try {
        const userRef = doc(db, 'users', targetUser.id);
        await setDoc(
          userRef,
          {
            id: targetUser.id,
            email: targetUser.email,
            displayName: targetUser.displayName,
            role: targetUser.role,
            status: targetUser.status,
            createdAt: targetUser.createdAt || nowIso,
            lastLoginAt: targetUser.lastLoginAt || nowIso,
            notes: tempNotes,
            updatedAt: nowIso,
            hasPassword: Boolean(targetUser.hasPassword),
          },
          { merge: true }
        );
        firestoreOk = true;
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.id}`);
        } catch {}
      }
    }

    setProcessingUserId(null);

    if (serverOk || firestoreOk) {
      setEditingNotesId(null);
      showSuccess('Anotações salvas com sucesso.');
    } else {
      setErrorMessage('Erro ao salvar anotações.');
    }
  };

  const executeDeleteUser = async () => {
    if (!confirmDeleteUser) return;
    const targetUser = confirmDeleteUser;

    if (isMasterAdminUser(targetUser)) {
      setErrorMessage('Não é permitido excluir o Administrador Master.');
      setConfirmDeleteUser(null);
      return;
    }

    setProcessingUserId(targetUser.id);
    setErrorMessage(null);

    let serverOk = false;
    let firestoreOk = false;

    try {
      const headers = await getAdminAuthHeaders();
      const resp = await fetch(`/api/admin/users/${encodeURIComponent(targetUser.id)}`, {
        method: 'DELETE',
        headers,
      });
      if (resp.ok) {
        serverOk = true;
        setServerUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      }
    } catch {}

    if (user) {
      try {
        await deleteDoc(doc(db, 'users', targetUser.id));
        await deleteDoc(doc(db, 'admins', targetUser.id)).catch(() => {});
        firestoreOk = true;
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.DELETE, `users/${targetUser.id}`);
        } catch {}
      }
    }

    setProcessingUserId(null);
    setConfirmDeleteUser(null);

    if (serverOk || firestoreOk) {
      showSuccess(`Usuário ${targetUser.email} removido do sistema.`);
    } else {
      setErrorMessage('Erro ao excluir usuário.');
    }
  };

  const handleAddPreAuthUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      setErrorMessage('Informe o email do membro.');
      return;
    }

    setIsSubmittingNew(true);
    setErrorMessage(null);
    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanId = 'pre_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const nowIso = new Date().toISOString();

    let serverOk = false;
    let firestoreOk = false;

    try {
      const headers = await getAdminAuthHeaders();
      const resp = await fetch('/api/admin/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: cleanEmail,
          displayName: newName.trim() || cleanEmail.split('@')[0],
          role: newRole,
          notes: newNotes.trim() || 'Pré-cadastro manual pelo administrador',
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        serverOk = true;
        if (data?.user) {
          setServerUsers((prev) => {
            const exists = prev.some((u) => u.id === data.user.id);
            return exists
              ? prev.map((u) => (u.id === data.user.id ? data.user : u))
              : [data.user, ...prev];
          });
        }
      }
    } catch {}

    if (user) {
      try {
        const userRef = doc(db, 'users', cleanId);
        const newProf: UserProfile = {
          id: cleanId,
          email: cleanEmail,
          displayName: newName.trim() || cleanEmail.split('@')[0],
          role: newRole,
          status: 'active',
          createdAt: nowIso,
          lastLoginAt: 'Nunca conectou',
          updatedAt: nowIso,
          notes: newNotes.trim() || 'Pré-cadastro manual pelo administrador',
        };

        await setDoc(userRef, newProf);

        if (newRole === 'admin') {
          await setDoc(doc(db, 'admins', cleanId), {
            email: cleanEmail,
            addedAt: nowIso,
          });
        }
        firestoreOk = true;
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `users/${cleanId}`);
        } catch {}
      }
    }

    setIsSubmittingNew(false);

    if (serverOk || firestoreOk) {
      setIsAddOpen(false);
      setNewEmail('');
      setNewName('');
      setNewNotes('');
      showSuccess(`Membro ${cleanEmail} pré-cadastrado com sucesso!`);
    } else {
      setErrorMessage('Erro ao pré-cadastrar membro.');
    }
  };

  // Filtered users
  const filteredUsers = usersList.filter((u) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchName = (u.displayName || '').toLowerCase().includes(q);
      const matchNotes = u.notes ? u.notes.toLowerCase().includes(q) : false;
      if (!matchEmail && !matchName && !matchNotes) return false;
    }
    if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    return true;
  });

  // KPI calculations
  const totalCount = usersList.length;
  const activeCount = usersList.filter((u) => u.status === 'active').length;
  const pendingUsers = usersList.filter((u) => u.status === 'pending');
  const pendingCount = pendingUsers.length;
  const adminCount = usersList.filter((u) => u.role === 'admin').length;

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Acesso Restrito: Painel de Administrador</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Você precisa estar autenticado com uma conta autorizada de Administrador para gerenciar membros e logins.
        </p>
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono inline-block">
          Email Administrador Padrão: <span className="text-emerald-400">{BOOTSTRAP_ADMIN_EMAIL}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-purple-400 font-mono tracking-wider uppercase mb-1">
            <Shield className="w-4 h-4" />
            <span>Gestão de Acesso &amp; Segurança</span>
            <span aria-hidden="true">·</span>
            <span>{user ? 'Firestore + Servidor' : 'Sessão Admin Wdracma'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Painel do Administrador: Gestão de Logins
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Gerenciamento em tempo real de membros cadastrados, aprovação de novas solicitações, permissões e auditoria.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer disabled:opacity-60"
            title="Atualizar lista de membros"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar / Convidar Membro</span>
          </button>
        </div>
      </div>

      {/* Legacy Wdracma Token Re-validation Banner (if stored session predates token issuance) */}
      {needsSessionRefresh && !user && (
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-3">
          <div className="flex items-start gap-2.5 text-xs text-purple-200">
            <KeyRound className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Revalidação de Segurança Necessária</div>
              <div className="text-purple-300/80 mt-0.5">
                Para aprovar membros com segurança no servidor, confirme suas credenciais administrativas de Wdracma.
              </div>
            </div>
          </div>

          <form onSubmit={handleReauthSubmit} autoComplete="off" className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              autoComplete="off"
              required
              value={reauthName}
              onChange={(e) => setReauthName(e.target.value)}
              placeholder="Usuário Administrador"
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 font-mono"
            />
            <input
              type="password"
              autoComplete="new-password"
              required
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              placeholder="Senha Administrativa"
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 font-mono"
            />
            <button
              type="submit"
              disabled={reauthLoading}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-60"
            >
              {reauthLoading ? 'Validando...' : 'Validar Sessão'}
            </button>
          </form>
        </div>
      )}

      {/* Alert Notifications */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Approval Queue Banner */}
      {pendingCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Clock className="w-4 h-4 animate-pulse" />
              <span>Solicitações Aguardando Aprovação ({pendingCount})</span>
            </div>
            <span className="text-[11px] text-amber-400 font-mono">Libere o terminal com 1 clique</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingUsers.map((pending) => {
              const isBusy = processingUserId === pending.id;
              return (
                <div
                  key={pending.id}
                  className="p-3 bg-slate-900 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-white truncate flex items-center gap-1.5">
                      <span className="truncate">{pending.displayName}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono shrink-0 ${
                          pending.hasPassword
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {pending.hasPassword ? 'Senha ✓' : 'Sem senha'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">{pending.email}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Solicitado: {pending.createdAt ? new Date(pending.createdAt).toLocaleDateString('pt-BR') : 'Hoje'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUpdateStatus(pending, 'active')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                      title="Aprovar acesso e liberar terminal"
                    >
                      {isBusy ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Aprovar</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUpdateStatus(pending, 'suspended')}
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                      title="Recusar solicitação"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span className="sr-only sm:not-sr-only">Recusar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Cadastrados</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{totalCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Registros sincronizados</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Membros Aprovados</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{activeCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Acesso irrestrito liberado</div>
        </div>

        <div className={`p-4 rounded-xl bg-slate-900 border ${pendingCount > 0 ? 'border-amber-500/40' : 'border-slate-800'}`}>
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Aguardando Aprovação</span>
            <Clock className={`w-4 h-4 ${pendingCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold font-mono ${pendingCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
            {pendingCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {pendingCount > 0 ? 'Requer liberação do admin' : 'Nenhuma pendência'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Administradores</span>
            <Shield className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-300">{adminCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Acesso ao painel de gestão</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, email ou notas..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden"
            >
              <option value="ALL">Todos os Status</option>
              <option value="active">Ativos</option>
              <option value="suspended">Suspensos</option>
              <option value="pending">Pendentes</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Nível:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden"
            >
              <option value="ALL">Todos os Papéis</option>
              <option value="admin">Administrador</option>
              <option value="member">Membro</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Membro / Usuário</th>
                <th className="py-3 px-4">Papel &amp; Acesso</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Último Acesso</th>
                <th className="py-3 px-4">Notas &amp; Assinatura</th>
                <th className="py-3 px-4 text-right">Ações Administrativas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-purple-400 mb-2" />
                    <span>Carregando membros cadastrados...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-semibold text-slate-300">Nenhum membro encontrado</p>
                    <p className="text-xs text-slate-500 mt-0.5">Tente alterar os termos de busca ou filtros.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => {
                  const isBootstrap = isMasterAdminUser(item);
                  const isBusy = processingUserId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {item.photoURL ? (
                            <img
                              src={item.photoURL}
                              alt={item.displayName}
                              className="w-8 h-8 rounded-full border border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-purple-400 shrink-0">
                              {item.displayName?.[0] || item.email?.[0] || 'U'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                              <span>{item.displayName}</span>
                              {isBootstrap ? (
                                <span className="text-[9px] px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded font-mono font-semibold">
                                  Admin Master
                                </span>
                              ) : (
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                                    item.hasPassword
                                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                  }`}
                                >
                                  {item.hasPassword ? 'Senha ✓' : 'Sem senha'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">{item.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        <select
                          value={item.role}
                          onChange={(e) => handleUpdateRole(item, e.target.value as UserRole)}
                          disabled={isBootstrap || isBusy}
                          className={`px-2 py-1 rounded text-xs font-mono font-semibold border ${
                            item.role === 'admin'
                              ? 'bg-purple-500/10 border-purple-500/40 text-purple-300'
                              : 'bg-slate-800 border-slate-700 text-slate-200'
                          } disabled:opacity-75 focus:outline-hidden`}
                        >
                          <option value="member">Membro</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <select
                          value={item.status}
                          onChange={(e) => handleUpdateStatus(item, e.target.value as UserStatus)}
                          disabled={isBootstrap || isBusy}
                          className={`px-2 py-1 rounded text-xs font-mono font-semibold border ${
                            item.status === 'active'
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                              : item.status === 'suspended'
                              ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                              : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                          } disabled:opacity-75 focus:outline-hidden`}
                        >
                          <option value="active">Ativo</option>
                          <option value="suspended">Suspenso</option>
                          <option value="pending">Pendente</option>
                        </select>
                      </td>

                      {/* Last Login */}
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        <div>
                          {item.lastLoginAt && item.lastLoginAt.includes('T')
                            ? new Date(item.lastLoginAt).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : item.lastLoginAt || '—'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Cadastro:{' '}
                          {item.createdAt && item.createdAt.includes('T')
                            ? new Date(item.createdAt).toLocaleDateString('pt-BR')
                            : 'Recente'}
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="py-3 px-4">
                        {editingNotesId === item.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={tempNotes}
                              onChange={(e) => setTempNotes(e.target.value)}
                              placeholder="Observações do membro..."
                              className="px-2 py-1 bg-slate-950 border border-purple-500 rounded text-xs text-white focus:outline-hidden w-44"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveNotes(item)}
                            />
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleSaveNotes(item)}
                              className="p-1 text-emerald-400 hover:bg-slate-800 rounded cursor-pointer"
                              title="Salvar"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNotesId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-800 rounded cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingNotesId(item.id);
                              setTempNotes(item.notes || '');
                            }}
                            className="cursor-pointer group flex items-center gap-1 text-slate-400 hover:text-slate-200"
                            title="Clique para editar observações"
                          >
                            <span className="truncate max-w-[150px]">{item.notes || '—'}</span>
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-purple-400 transition-opacity" />
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleUpdateStatus(item, 'active')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-bold text-[11px] rounded transition-colors cursor-pointer disabled:opacity-60"
                                title="Aprovar membro imediatamente"
                              >
                                {isBusy ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                                <span>Aprovar</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleUpdateStatus(item, 'suspended')}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-[11px] rounded transition-colors cursor-pointer disabled:opacity-60"
                                title="Recusar solicitação"
                              >
                                <X className="w-3 h-3" />
                                <span>Recusar</span>
                              </button>
                            </>
                          )}

                          {item.status === 'suspended' && !isBootstrap && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleUpdateStatus(item, 'active')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-bold text-[11px] rounded transition-colors cursor-pointer disabled:opacity-60"
                              title="Reativar acesso do membro"
                            >
                              <Check className="w-3 h-3" />
                              <span>Reativar</span>
                            </button>
                          )}

                          {item.status === 'active' && !isBootstrap && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleUpdateStatus(item, 'suspended')}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700 hover:border-amber-500/30 font-medium text-[11px] rounded transition-colors cursor-pointer disabled:opacity-60"
                              title="Suspender acesso"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Suspender</span>
                            </button>
                          )}

                          {!isBootstrap && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteUser(item)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer disabled:opacity-60"
                              title="Excluir cadastro do membro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline Delete Confirmation Modal (replaces blocked window.confirm) */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <div className="w-9 h-9 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Confirmar Exclusão</h3>
                <p className="text-[11px] text-slate-400">Esta ação removerá o acesso do membro.</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
              Tem certeza que deseja excluir o cadastro de{' '}
              <span className="font-mono font-bold text-white">{confirmDeleteUser.email}</span>?
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteUser(null)}
                className="px-3.5 py-2 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={processingUserId === confirmDeleteUser.id}
                onClick={executeDeleteUser}
                className="px-4 py-2 text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                {processingDeleteText(processingUserId === confirmDeleteUser.id)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pre-cadastro de novo membro */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Pré-cadastrar Novo Membro</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddPreAuthUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">E-mail do Membro *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome do membro"
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Nível de Acesso</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-hidden"
                >
                  <option value="member">Membro Regular</option>
                  <option value="admin">Administrador do Sistema</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Observações Internas</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Assinatura Anual PRO, VIP, Equipe"
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingNew ? 'Salvando...' : 'Confirmar Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function processingDeleteText(isDeleting: boolean) {
  return isDeleting ? 'Excluindo...' : 'Excluir Cadastro';
}
