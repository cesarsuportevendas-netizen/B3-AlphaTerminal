import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Info } from 'lucide-react';
import {
  FIREBASE_PROJECT_ID,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_OAUTH_CLIENT_ID,
  IS_OAUTH_CLIENT_LINKED,
  GMAIL_SCOPES,
  DRIVE_SCOPES,
} from '../services/firebase';

interface UnauthorizedDomainHelpProps {
  errorMessage?: string | null;
}

export function isUnauthorizedDomainError(msg?: string | null): boolean {
  if (!msg) return false;
  return (
    msg.includes('auth/unauthorized-domain') ||
    msg.includes('não autorizado no Firebase Auth') ||
    msg.includes('Authorized domains')
  );
}

export function isOAuthConfigError(msg?: string | null): boolean {
  if (!msg) return false;
  return (
    isUnauthorizedDomainError(msg) ||
    msg.includes('OAuth2') ||
    msg.includes('OAuth Client ID') ||
    msg.includes('Sign-in method') ||
    msg.includes('redirect_uri_mismatch') ||
    msg.includes('Tela de Consentimento OAuth') ||
    msg.includes('Workspace')
  );
}

export const UnauthorizedDomainHelp: React.FC<UnauthorizedDomainHelpProps> = ({
  errorMessage,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOAuthConfigError(errorMessage)) {
    return null;
  }

  const showDomainSteps = isUnauthorizedDomainError(errorMessage);
  const currentHost =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : '';
  const firebaseAuthSettingsUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`;
  const firebaseProvidersUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`;
  const gcpCredentialsUrl = `https://console.cloud.google.com/apis/credentials?project=${FIREBASE_PROJECT_ID}`;
  const isVercelPreview =
    currentHost.endsWith('.vercel.app') && currentHost.split('-').length >= 4;

  const handleCopyHost = async () => {
    if (!currentHost || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(currentHost);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in non-secure context; user can still select text manually
    }
  };

  return (
    <div className="mt-2.5 p-3.5 rounded-xl bg-slate-950/90 border border-amber-500/30 text-left space-y-2.5 text-[11px] text-slate-300">
      <div className="flex items-start gap-2 text-amber-300 font-semibold">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        <span>
          {showDomainSteps
            ? 'Como liberar o login Google / Gmail neste domínio:'
            : 'Diagnóstico da configuração Firebase & OAuth2 (Gmail/Drive):'}
        </span>
      </div>

      {showDomainSteps && currentHost && (
        <div className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <code className="text-[11px] text-emerald-300 font-mono truncate select-all">
            {currentHost}
          </code>
          <button
            type="button"
            onClick={handleCopyHost}
            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-semibold shrink-0 cursor-pointer transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-300">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copiar domínio</span>
              </>
            )}
          </button>
        </div>
      )}

      {showDomainSteps ? (
        <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed">
          <li>
            Acesse o{' '}
            <a
              href={firebaseAuthSettingsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-0.5 font-semibold"
            >
              <span>Firebase Console → Authentication → Settings</span>
              <ExternalLink className="w-3 h-3 inline" />
            </a>
          </li>
          <li>
            Em <strong className="text-slate-200">Authorized domains</strong>, clique em{' '}
            <strong className="text-slate-200">Add domain</strong> e cole o domínio acima.
          </li>
          {isVercelPreview && (
            <li className="text-amber-200/90">
              Dica Vercel: URLs de <em>Preview</em> mudam o código a cada deploy. Prefira abrir o
              site pela URL fixa de <strong className="text-white">Produção</strong> na Vercel e
              cadastrá-la uma única vez no Firebase.
            </li>
          )}
        </ol>
      ) : (
        <div className="space-y-1 text-slate-400 leading-relaxed">
          <div>
            • Verifique o provedor Google em{' '}
            <a
              href={firebaseProvidersUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-0.5 font-semibold"
            >
              <span>Firebase → Sign-in method</span>
              <ExternalLink className="w-3 h-3 inline" />
            </a>
          </div>
          <div>
            • Verifique as credenciais e usuários de teste em{' '}
            <a
              href={gcpCredentialsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-0.5 font-semibold"
            >
              <span>Google Cloud Console → Credentials</span>
              <ExternalLink className="w-3 h-3 inline" />
            </a>
          </div>
        </div>
      )}

      {/* Config verification summary */}
      <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-0.5 text-[10px] font-mono text-slate-400">
        <div>
          Projeto: <span className="text-slate-200">{FIREBASE_PROJECT_ID}</span> · AuthDomain:{' '}
          <span className="text-slate-200">{FIREBASE_AUTH_DOMAIN}</span>
        </div>
        <div className="truncate">
          OAuth Client ID:{' '}
          <span className={IS_OAUTH_CLIENT_LINKED ? 'text-emerald-300' : 'text-rose-300'}>
            {FIREBASE_OAUTH_CLIENT_ID || 'Não configurado'}
          </span>
        </div>
        <div>
          Escopos ativos no login:{' '}
          <span className="text-cyan-300">
            {GMAIL_SCOPES.length} Gmail + {DRIVE_SCOPES.length} Drive
          </span>
        </div>
      </div>

      <div className="pt-1 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono">
        Alternativa imediata: o login por <strong className="text-slate-200">E-mail e Senha</strong> ou{' '}
        <strong className="text-purple-300">Admin</strong> funciona normalmente em qualquer URL.
      </div>
    </div>
  );
};
