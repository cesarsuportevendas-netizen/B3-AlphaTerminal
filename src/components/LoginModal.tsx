import React, { useState } from 'react';
import {
  X,
  Shield,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Lock,
  LogOut,
  User,
  Activity,
  Layers,
  ArrowRight,
  KeyRound,
  Eye,
  EyeOff,
  Mail,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UnauthorizedDomainHelp } from './UnauthorizedDomainHelp';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdmin?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onOpenAdmin,
}) => {
  const {
    user,
    userProfile,
    emailToken,
    driveAccessToken,
    driveAccountEmail,
    gmailAccessToken,
    gmailAccountEmail,
    isAdmin,
    loading,
    error,
    connectGoogleDrive,
    disconnectGoogleDrive,
    connectGmail,
    disconnectGmail,
    loginWithEmailStart,
    loginWithEmailPassword,
    loginWithAdminCredentials,
    logout,
  } = useAuth();

  const [authTab, setAuthTab] = useState<'login' | 'register' | 'admin'>('login');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Email login state
  const [emailInput, setEmailInput] = useState('');
  const [emailPasswordInput, setEmailPasswordInput] = useState('');
  const [showEmailPass, setShowEmailPass] = useState(false);
  const [isEmailBusy, setIsEmailBusy] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [isAdminBusy, setIsAdminBusy] = useState(false);

  if (!isOpen) return null;

  const handleConnectDrive = async () => {
    setAuthError(null);
    setIsConnectingDrive(true);
    try {
      await connectGoogleDrive();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Falha ao conectar Google Drive.');
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleConnectGmail = async () => {
    setAuthError(null);
    setIsConnectingGmail(true);
    try {
      await connectGmail();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Falha ao conectar Gmail.');
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const handleEmailInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsEmailBusy(true);
    try {
      const res = await loginWithEmailStart(emailInput);
      if (!res.success) {
        setAuthError(res.error || 'Falha ao verificar e-mail.');
      } else if (res.requiresPassword) {
        setAuthTab('login');
        setAuthError('Este e-mail já possui senha cadastrada. Digite sua senha abaixo para entrar.');
      } else if (res.needsPasswordSetup) {
        onClose();
      }
    } catch {
      setAuthError('Erro ao iniciar cadastro com e-mail.');
    } finally {
      setIsEmailBusy(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsEmailBusy(true);
    try {
      const res = await loginWithEmailPassword(emailInput, emailPasswordInput);
      if (!res.success) {
        if (res.needsPasswordSetup) {
          const initRes = await loginWithEmailStart(emailInput);
          if (initRes.success && initRes.needsPasswordSetup) {
            setEmailPasswordInput('');
            onClose();
            return;
          }
        }
        setAuthError(res.error || 'E-mail ou senha incorretos.');
      } else {
        setEmailPasswordInput('');
        onClose();
      }
    } catch {
      setAuthError('Erro ao autenticar com e-mail.');
    } finally {
      setIsEmailBusy(false);
    }
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAdminBusy(true);
    try {
      const res = await loginWithAdminCredentials(adminName, adminPassword);
      if (!res.success) {
        setAuthError(res.error || 'Credenciais de administrador incorretas.');
      } else {
        onClose();
        if (onOpenAdmin) {
          onOpenAdmin();
        }
      }
    } catch {
      setAuthError('Erro ao realizar login administrativo.');
    } finally {
      setIsAdminBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const isSuspended = userProfile?.status === 'suspended';
  const isAuthenticated = Boolean(user || emailToken || userProfile);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>Área de Membros &amp; Acesso</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 font-mono rounded">
                  PRO
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">B3 AlphaTerminal Autenticação</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {isAuthenticated ? (
            /* Logged in state */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar'}
                    className="w-12 h-12 rounded-full border border-emerald-500/30"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 font-bold text-lg">
                    {userProfile?.displayName?.[0] || user?.displayName?.[0] || 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm truncate">
                      {userProfile?.displayName || user?.displayName || 'Usuário'}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.2 rounded-full font-mono font-semibold ${
                        isAdmin
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {isAdmin ? 'Administrador' : 'Membro Ativo'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">
                    {user?.email || userProfile?.email}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-2 flex-wrap">
                    <span>
                      Status:{' '}
                      <span
                        className={
                          isSuspended
                            ? 'text-rose-400 font-bold'
                            : 'text-emerald-400 font-semibold'
                        }
                      >
                        {userProfile?.status === 'active'
                          ? 'Ativo & Liberado'
                          : userProfile?.status || 'Ativo'}
                      </span>
                    </span>
                    {!isAdmin && (
                      <span
                        className={`px-1.5 py-0.2 rounded ${
                          userProfile?.hasPassword
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-300'
                        }`}
                      >
                        {userProfile?.hasPassword ? 'Senha ✓' : 'Senha Pendente'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {isSuspended && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>Acesso suspenso pelo administrador. Entre em contato com o suporte.</span>
                </div>
              )}

              {/* Google Drive status / quick connect */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span>Google Drive</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        driveAccessToken
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {driveAccessToken ? 'Conectado' : 'Não conectado'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {driveAccessToken
                      ? driveAccountEmail || user?.email || 'Token de sessão ativo'
                      : 'Conecte para abrir e salvar planilhas no Drive'}
                  </div>
                </div>
                {driveAccessToken ? (
                  <button
                    type="button"
                    onClick={disconnectGoogleDrive}
                    className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 cursor-pointer shrink-0"
                  >
                    Desconectar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectDrive}
                    disabled={isConnectingDrive}
                    className="px-3 py-1.5 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-900 rounded-lg cursor-pointer shrink-0 disabled:opacity-60"
                  >
                    {isConnectingDrive ? 'Conectando...' : 'Conectar Drive'}
                  </button>
                )}
              </div>

              {/* Gmail status / quick connect */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span>Gmail</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        gmailAccessToken
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {gmailAccessToken ? 'Conectado' : 'Não conectado'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {gmailAccessToken
                      ? gmailAccountEmail || user?.email || 'Token de sessão ativo'
                      : 'Conecte para ler e enviar relatórios B3 pelo Gmail'}
                  </div>
                </div>
                {gmailAccessToken ? (
                  <button
                    type="button"
                    onClick={disconnectGmail}
                    className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 cursor-pointer shrink-0"
                  >
                    Desconectar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectGmail}
                    disabled={isConnectingGmail}
                    className="px-3 py-1.5 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-900 rounded-lg cursor-pointer shrink-0 disabled:opacity-60"
                  >
                    {isConnectingGmail ? 'Conectando...' : 'Conectar Gmail'}
                  </button>
                )}
              </div>

              {(authError || error) && (
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span className="break-words min-w-0">{authError || error}</span>
                  </div>
                  <UnauthorizedDomainHelp errorMessage={authError || error} />
                </div>
              )}

              {/* Quick Admin Shortcut if admin */}
              {isAdmin && onOpenAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdmin();
                  }}
                  className="w-full py-2.5 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span>Acessar Painel de Administração de Membros</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Logout button */}
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Desconectar Conta</span>
              </button>
            </div>
          ) : (
            /* Not logged in: Show tabs for Entrar (E-mail+Senha / Google), Cadastrar, or Admin */
            <div className="space-y-4">
              {/* Tab Selector */}
              <div className="grid grid-cols-3 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('login');
                    setAuthError(null);
                  }}
                  className={`py-1.5 font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    authTab === 'login'
                      ? 'bg-slate-800 text-emerald-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Entrar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('register');
                    setAuthError(null);
                  }}
                  className={`py-1.5 font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    authTab === 'register'
                      ? 'bg-slate-800 text-cyan-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Cadastrar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('admin');
                    setAuthError(null);
                  }}
                  className={`py-1.5 font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    authTab === 'admin'
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                  <span>Admin</span>
                </button>
              </div>

              {authTab === 'login' ? (
                <div className="space-y-3.5">
                  <form onSubmit={handleEmailLogin} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">E-mail Cadastrado</label>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="seuemail@exemplo.com"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-slate-300 font-medium">Senha Cadastrada</label>
                        <button
                          type="button"
                          onClick={() => setShowEmailPass(!showEmailPass)}
                          className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                        >
                          {showEmailPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{showEmailPass ? 'Ocultar' : 'Exibir'}</span>
                        </button>
                      </div>
                      <input
                        type={showEmailPass ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={emailPasswordInput}
                        onChange={(e) => setEmailPasswordInput(e.target.value)}
                        placeholder="Digite sua senha cadastrada"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isEmailBusy}
                      className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{isEmailBusy ? 'Entrando...' : 'Entrar com E-mail e Senha'}</span>
                    </button>
                  </form>
                </div>
              ) : authTab === 'register' ? (
                <form onSubmit={handleEmailInit} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Seu E-mail *</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-hidden focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isEmailBusy}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{isEmailBusy ? 'Verificando...' : 'Continuar e Cadastrar Senha'}</span>
                  </button>
                </form>
              ) : (
                /* Admin Credential Login View */
                <form onSubmit={handleAdminLoginSubmit} autoComplete="off" className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Nome de Usuário Administrador
                    </label>
                    <input
                      type="text"
                      name="admin-modal-username"
                      autoComplete="off"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Digite o nome do administrador"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-hidden focus:border-purple-500 font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-300 font-medium">Senha Administrativa</label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                      >
                        {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showPassword ? 'Ocultar' : 'Exibir'}</span>
                      </button>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="admin-modal-password"
                      autoComplete="new-password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Senha do administrador"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-hidden focus:border-purple-500 font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAdminBusy || loading}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{isAdminBusy ? 'Autenticando...' : 'Entrar como Administrador'}</span>
                  </button>
                </form>
              )}

              {(authError || error) && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="break-words min-w-0">{authError || error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
