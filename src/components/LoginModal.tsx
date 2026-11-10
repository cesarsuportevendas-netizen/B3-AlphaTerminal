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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  const { user, userProfile, isAdmin, loading, error, loginWithGoogle, logout } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async () => {
    setAuthError(null);
    try {
      const profile = await loginWithGoogle();
      if (profile) {
        if (profile.status === 'suspended') {
          setAuthError('Sua conta de membro está suspensa pelo administrador.');
        } else {
          onClose();
        }
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Falha ao autenticar.');
    }
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const isSuspended = userProfile?.status === 'suspended';

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
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {user ? (
            /* Logged in state */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar'}
                    className="w-12 h-12 rounded-full border border-emerald-500/30"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 font-bold text-lg">
                    {user.displayName?.[0] || user.email?.[0] || 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm truncate">
                      {user.displayName || user.email?.split('@')[0]}
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
                  <div className="text-xs text-slate-400 truncate mt-0.5">{user.email}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    Status: <span className={isSuspended ? 'text-rose-400 font-bold' : 'text-emerald-400 font-semibold'}>{userProfile?.status || 'Ativo'}</span>
                  </div>
                </div>
              </div>

              {isSuspended && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>Acesso suspenso pelo administrador. Entre em contato com o suporte.</span>
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
                  className="w-full py-2.5 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-xl text-xs font-bold transition-all flex items-center justify-between"
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
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Desconectar Conta</span>
              </button>
            </div>
          ) : (
            /* Not logged in: Show login prompt */
            <div className="space-y-5">
              <div className="space-y-1.5 text-center">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Bem-vindo ao B3 AlphaTerminal
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Faça login para desbloquear o ecossistema completo de inteligência fundamentalista, carteiras personalizadas e monitoramento contínuo.
                </p>
              </div>

              {/* Benefits list */}
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Acesso irrestrito a todos os rankings (Graham, Bazin, Greenblatt)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Rastreamento em tempo real do fluxo institucional (Tubarões)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Análise de notícias com IA e pesquisa ao vivo no Google Search</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Painel de gestão para administradores autorizados</span>
                </div>
              </div>

              {/* Google Sign-in Button */}
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                {/* Google G Logo SVG */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                <span>{loading ? 'Conectando...' : 'Entrar com Conta Google'}</span>
              </button>

              {(authError || error) && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{authError || error}</span>
                </div>
              )}

              <p className="text-[11px] text-center text-slate-500 font-mono">
                Ambiente seguro · Firebase Authentication &amp; Firestore
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
