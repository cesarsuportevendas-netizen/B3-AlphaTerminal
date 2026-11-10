import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import {
  Shield,
  Users,
  UserCheck,
  UserX,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  Clock,
  Mail,
  AlertCircle,
  CheckCircle2,
  Award,
  Sparkles,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { useAuth, BOOTSTRAP_ADMIN_EMAIL } from '../context/AuthContext';
import { UserProfile, UserRole, UserStatus } from '../types/auth';

export const AdminManager: React.FC = () => {
  const { user, userProfile, isAdmin } = useAuth();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New user pre-registration state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('member');
  const [newNotes, setNewNotes] = useState('');

  // Editing notes state
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');

  // Real-time Firestore sync on /users collection
  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const usersCollectionRef = collection(db, 'users');

    const unsubscribe = onSnapshot(
      usersCollectionRef,
      (snapshot) => {
        const loaded: UserProfile[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as UserProfile;
          loaded.push({
            ...data,
            id: d.id,
          });
        });

        // Ensure bootstrap admin is present in list if authenticated
        if (user && user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
          const exists = loaded.some(
            (u) => u.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
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
            });
          }
        }

        // Ensure Wdracma admin is present in list
        const wdracmaExists = loaded.some(
          (u) => u.displayName === 'Wdracma' || u.id === 'admin_wdracma'
        );
        if (!wdracmaExists) {
          loaded.unshift({
            id: 'admin_wdracma',
            email: 'wdracma@alphaterminal.admin',
            displayName: 'Wdracma',
            role: 'admin',
            status: 'active',
            createdAt: '2026-11-09T00:00:00.000Z',
            lastLoginAt: userProfile?.displayName === 'Wdracma' ? new Date().toISOString() : 'Recente',
            notes: 'Administrador Master Credencial',
          });
        }

        // Sort: Admins first, then by lastLoginAt descending
        loaded.sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          return new Date(b.lastLoginAt || 0).getTime() - new Date(a.lastLoginAt || 0).getTime();
        });

        setUsersList(loaded);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        console.error('Failed to read users collection in Firestore:', error);
        setErrorMessage('Permissão insuficiente ou erro ao sincronizar usuários do Firestore.');
        try {
          handleFirestoreError(error, OperationType.GET, 'users');
        } catch {}
      }
    );

    return () => unsubscribe();
  }, [isAdmin, user]);

  const handleUpdateStatus = async (targetUser: UserProfile, newStatus: UserStatus) => {
    // Prevent suspending master administrators
    const isMaster =
      targetUser.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
      targetUser.displayName === 'Wdracma' ||
      targetUser.id === 'admin_wdracma';

    if (isMaster && newStatus === 'suspended') {
      setErrorMessage('Não é permitido suspender o Administrador Master.');
      return;
    }

    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { status: newStatus });
      setSuccessMessage(`Status de ${targetUser.email} alterado para "${newStatus}".`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error updating status:', err);
      setErrorMessage('Erro ao atualizar status do usuário.');
    }
  };

  const handleUpdateRole = async (targetUser: UserProfile, newRole: UserRole) => {
    // Prevent changing master admin role
    const isMaster =
      targetUser.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
      targetUser.displayName === 'Wdracma' ||
      targetUser.id === 'admin_wdracma';

    if (isMaster && newRole === 'member') {
      setErrorMessage('O Administrador Master deve permanecer com papel de administrador.');
      return;
    }

    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { role: newRole });

      // If promoted to admin, also register in /admins/{id}
      const adminDocRef = doc(db, 'admins', targetUser.id);
      if (newRole === 'admin') {
        await setDoc(adminDocRef, {
          email: targetUser.email,
          addedAt: new Date().toISOString(),
        });
      } else {
        await deleteDoc(adminDocRef).catch(() => {});
      }

      setSuccessMessage(`Papel de ${targetUser.email} alterado para "${newRole}".`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error updating role:', err);
      setErrorMessage('Erro ao alterar nível de acesso.');
    }
  };

  const handleSaveNotes = async (targetUser: UserProfile) => {
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { notes: tempNotes });
      setEditingNotesId(null);
      setSuccessMessage('Anotações salvas com sucesso.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error saving notes:', err);
      setErrorMessage('Erro ao salvar anotações.');
    }
  };

  const handleDeleteUser = async (targetUser: UserProfile) => {
    const isMaster =
      targetUser.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
      targetUser.displayName === 'Wdracma' ||
      targetUser.id === 'admin_wdracma';

    if (isMaster) {
      setErrorMessage('Não é permitido excluir o Administrador Master.');
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir o cadastro de ${targetUser.email}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', targetUser.id));
      await deleteDoc(doc(db, 'admins', targetUser.id)).catch(() => {});
      setSuccessMessage(`Usuário ${targetUser.email} removido do sistema.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error deleting user:', err);
      setErrorMessage('Erro ao excluir usuário.');
    }
  };

  const handleAddPreAuthUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      setErrorMessage('Informe o email do membro.');
      return;
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanId = 'pre_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const nowIso = new Date().toISOString();

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
        notes: newNotes.trim() || 'Pré-cadastro manual pelo administrador',
      };

      await setDoc(userRef, newProf);

      if (newRole === 'admin') {
        await setDoc(doc(db, 'admins', cleanId), {
          email: cleanEmail,
          addedAt: nowIso,
        });
      }

      setIsAddOpen(false);
      setNewEmail('');
      setNewName('');
      setNewNotes('');
      setSuccessMessage(`Membro ${cleanEmail} pré-cadastrado com sucesso!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error adding user:', err);
      setErrorMessage('Erro ao pré-cadastrar membro.');
    }
  };

  // Filtered users
  const filteredUsers = usersList.filter((u) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchName = u.displayName.toLowerCase().includes(q);
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
  const suspendedCount = usersList.filter((u) => u.status === 'suspended').length;
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
            <span>Firestore Database</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Painel do Administrador: Gestão de Logins
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Gerenciamento em tempo real de membros cadastrados, aprovação de novas solicitações, permissões e auditoria.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar / Convidar Membro</span>
        </button>
      </div>

      {/* Alert Notifications */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
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
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">
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
            {pendingUsers.map((pending) => (
              <div
                key={pending.id}
                className="p-3 bg-slate-900 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs text-white truncate">{pending.displayName}</div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">{pending.email}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Solicitado: {pending.createdAt ? new Date(pending.createdAt).toLocaleDateString('pt-BR') : 'Hoje'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleUpdateStatus(pending, 'active')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
                    title="Aprovar acesso e liberar terminal"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Aprovar</span>
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(pending, 'suspended')}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Recusar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
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
          <div className="text-[11px] text-slate-500 mt-1">Registros no Firestore</div>
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
                    <span>Carregando membros do Firestore...</span>
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
                  const isBootstrap =
                    item.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
                    item.displayName === 'Wdracma' ||
                    item.id === 'admin_wdracma';

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
                              {item.displayName?.[0] || item.email[0] || 'U'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{item.displayName}</span>
                              {isBootstrap && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded font-mono font-semibold">
                                  Admin Master
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
                          disabled={isBootstrap}
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
                          disabled={isBootstrap}
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

                      {/* Notes / Observações */}
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
                              onClick={() => handleSaveNotes(item)}
                              className="p-1 text-emerald-400 hover:bg-slate-800 rounded"
                              title="Salvar"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingNotesId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-800 rounded"
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
                            <button
                              onClick={() => handleUpdateStatus(item, 'active')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-bold text-[11px] rounded transition-colors"
                              title="Aprovar membro imediatamente"
                            >
                              <Check className="w-3 h-3" />
                              <span>Aprovar</span>
                            </button>
                          )}
                          {!isBootstrap && (
                            <button
                              onClick={() => handleDeleteUser(item)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
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

      {/* Modal Pre-cadastro de novo membro */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Pré-cadastrar Novo Membro</span>
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddPreAuthUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Email da Conta Google *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="exemplo@gmail.com"
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
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors"
                >
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
