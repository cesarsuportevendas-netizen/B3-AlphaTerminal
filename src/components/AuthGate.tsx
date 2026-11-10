import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Clock,
  UserCheck,
  UserX,
  Sparkles,
  TrendingUp,
  BarChart3,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Mail,
  Sliders,
  DollarSign,
  Activity,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { useAuth, BOOTSTRAP_ADMIN_EMAIL } from '../context/AuthContext';

interface AuthGateProps {
  children: React.ReactNode;
  onOpenLoginModal?: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children, onOpenLoginModal }) => {
  const {
    user,
    userProfile,
    isAdmin,
    loading,
    loginWithGoogle,
    loginWithAdminCredentials,
    logout,
    refreshProfile,
  } = useAuth();

  const [authTab, setAuthTab] = useState<'member' | 'admin'>('member');
  const [adminName, setAdminName] = useState('Wdracma');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const handleGoogleLoginClick = async () => {
    setIsLoggingIn(true);
    setAdminError(null);
    try {
      await loginWithGoogle();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setIsLoggingIn(true);
    try {
      const res = await loginWithAdminCredentials(adminName, adminPassword);
      if (!res.success) {
        setAdminError(res.error || 'Credenciais de administrador incorretas.');
      }
    } catch (err) {
      setAdminError('Falha ao processar login administrativo.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 1. Initial Auth Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-pulse">
            <TrendingUp className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-emerald-500/20 blur-md -z-10 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">B3 AlphaTerminal Pro</h2>
        <p className="text-xs text-slate-400 mt-1.5 flex items-center justify-center gap-2 font-mono">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          <span>Verificando credenciais e nível de acesso...</span>
        </p>
      </div>
    );
  }

  // 2. Unauthenticated State (Neither Google user nor Admin credential active)
  if (!user && !userProfile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500/20 selection:text-emerald-400">
        {/* Top Minimal Navigation Bar */}
        <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
                <TrendingUp className="w-5 h-5 text-slate-950 font-bold" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base tracking-tight text-white font-mono">
                    B3 <span className="text-emerald-400">AlphaTerminal</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                    PRO
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 -mt-0.5 font-mono">Plataforma Quantitativa &amp; Inteligência B3</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuthTab(authTab === 'admin' ? 'member' : 'admin')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                <span>{authTab === 'admin' ? 'Área de Membros' : 'Acesso Admin'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center justify-center text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300 shadow-inner font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-emerald-400 font-semibold">Acesso Restrito a Usuários Aprovados</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Ambiente Protegido</span>
          </div>

          <div className="max-w-2xl space-y-3">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Decisões de Investimento com Rigor{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                Quantitativo &amp; IA
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto">
              Para acessar o terminal quantitativo, valuations de Graham e Bazin, rastreador de fluxo dos tubarões e planilhas B3, faça login ou cadastre-se.
            </p>
          </div>

          {/* Login Card with Dual Tabs (Membros Google / Admin Credenciais) */}
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-md space-y-5 text-left">
            {/* Tabs Selector */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('member');
                  setAdminError(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authTab === 'member'
                    ? 'bg-slate-800 text-emerald-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Membro Google</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthTab('admin');
                  setAdminError(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authTab === 'admin'
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span>Login Administrativo</span>
              </button>
            </div>

            {/* TAB 1: Membro Google */}
            {authTab === 'member' && (
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-800/80">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Acesso de Membros</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 font-mono rounded">
                      Google Auth
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Novos cadastros passam por aprovação de segurança do administrador
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLoginClick}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-xl cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isLoggingIn ? 'Conectando...' : 'Entrar / Cadastrar com Conta Google'}</span>
                </button>

                <div className="text-[11px] text-slate-400 space-y-1.5 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Liberação sob aprovação da administração</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    <span>Zero senhas para memorizar, login protegido</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Login Administrativo (Credenciais Wdracma) */}
            {authTab === 'admin' && (
              <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                <div className="pb-3 border-b border-slate-800/80">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span>Acesso Administrativo</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-purple-500/20 text-purple-300 font-mono rounded">
                      Credenciais
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Login com nome de administrador e senha de autorização
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">
                    Nome de Usuário Administrador
                  </label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Nome do administrador"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-purple-500 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 text-xs font-medium">Senha Administrativa</label>
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
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Digite sua senha de administrador"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-purple-500 font-mono"
                  />
                </div>

                {adminError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{adminError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-60"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isLoggingIn ? 'Autenticando...' : 'Entrar como Administrador'}</span>
                </button>

                <p className="text-[11px] text-center text-slate-500 font-mono">
                  Libera acesso total às configurações e gestão de logins
                </p>
              </form>
            )}
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl pt-4 text-left">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                <Sliders className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-xs">Top 10 &amp; Ranking Multicritério</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Filtros quantitativos em tempo real com pesos dinâmicos em P/L, ROIC, Margem e Dividend Yield.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2">
                <DollarSign className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-xs">Valuation Graham &amp; Bazin</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Cálculo automático do Preço Teto Bazin e Margem de Segurança Graham com base nos proventos.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-2">
                <Activity className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-xs">Fluxo Institucional &amp; Tubarões</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Detecção de acumulação silenciosa institucional (Metodologia Wyckoff &amp; Smart Money).
              </p>
            </div>
          </div>
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-slate-900 py-4 text-center text-[11px] text-slate-500 font-mono">
          B3 AlphaTerminal Pro · Ambiente Seguro de Análise Quantitativa · Todos os direitos reservados
        </footer>
      </div>
    );
  }

  // 3. Authenticated but Pending Approval State (only for non-admins)
  if (userProfile?.status === 'pending' && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500/20 selection:text-amber-400">
        <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center font-bold text-slate-950 shadow-md">
                <Clock className="w-4 h-4" />
              </div>
              <span className="font-mono font-bold text-sm text-white">
                B3 <span className="text-amber-400">AlphaTerminal</span>
              </span>
            </div>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-xl w-full mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-semibold">
                <span>⏳ Solicitação em Análise</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Aguardando Aprovação do Administrador
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Olá, <span className="text-white font-semibold">{userProfile?.displayName || user?.displayName}</span>! Seu cadastro foi recebido com sucesso no sistema.
              </p>
            </div>

            {/* Profile details summary card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Email Cadastrado:</span>
                <span className="font-mono text-white font-medium">{user?.email || userProfile?.email}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Status Atual:</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-semibold text-[11px]">
                  Pendente de Liberação
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Data do Registro:</span>
                <span className="font-mono text-slate-300">
                  {userProfile?.createdAt
                    ? new Date(userProfile.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Hoje'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed text-left flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200">Sincronização em tempo real ativa:</strong> Assim que a administração aprovar o seu usuário no painel, esta tela será liberada automaticamente, sem necessidade de recarregar.
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Verificando com o servidor...' : 'Verificar Se Já Fui Aprovado'}</span>
              </button>

              <button
                onClick={() => logout()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Trocar de Conta / Sair</span>
              </button>
            </div>

            {/* Support contact note */}
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
              Contato do administrador para liberação: <br />
              <span className="text-slate-400 font-mono select-all">{BOOTSTRAP_ADMIN_EMAIL}</span>
            </div>
          </div>
        </main>

        <footer className="py-4 text-center text-[11px] text-slate-500 font-mono">
          B3 AlphaTerminal Pro · Controle de Acesso Seguro
        </footer>
      </div>
    );
  }

  // 4. Authenticated but Suspended State
  if (userProfile?.status === 'suspended' && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
        <header className="border-b border-slate-800 bg-slate-900/60 sticky top-0 z-30">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <span className="font-mono font-bold text-sm text-white">
              B3 <span className="text-rose-400">AlphaTerminal</span>
            </span>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-md w-full mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-5">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <UserX className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-white tracking-tight">Acesso Suspenso</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                A sua conta (<span className="text-white font-mono">{user?.email || userProfile?.email}</span>) foi temporariamente suspensa pela administração da plataforma.
              </p>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-left text-xs text-slate-400">
              <div><strong>Motivo:</strong> {userProfile?.notes || 'Suspensão pelo painel de controle de acessos.'}</div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Verificar Novamente</span>
              </button>
              <button
                onClick={() => logout()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Desconectar da Conta</span>
              </button>
            </div>
          </div>
        </main>

        <footer className="py-4 text-center text-[11px] text-slate-500 font-mono">
          B3 AlphaTerminal Pro · Contate o administrador para reativação
        </footer>
      </div>
    );
  }

  // 5. Approved Member OR Administrator -> Full Access to the Terminal!
  return <>{children}</>;
};
