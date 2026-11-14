import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Inbox,
  Send,
  Star,
  FileEdit,
  Trash2,
  Search,
  RefreshCw,
  LogOut,
  Plus,
  AlertCircle,
  CheckCircle2,
  X,
  Shield,
  Paperclip,
  MailOpen,
  Reply,
  Forward,
  Archive,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UnauthorizedDomainHelp } from './UnauthorizedDomainHelp';
import { StockData } from '../types/stock';
import {
  GmailProfile,
  GmailLabel,
  GmailMessage,
  GmailAuthExpiredError,
  getGmailProfile,
  listGmailLabels,
  listGmailMessages,
  sendGmailMessage,
  saveGmailDraft,
  modifyGmailMessageLabels,
  trashGmailMessage,
  deleteGmailMessagePermanently,
} from '../services/gmailService';

interface GmailManagerProps {
  stocks: StockData[];
  filteredStocks: StockData[];
  initialDraft?: {
    to?: string;
    subject: string;
    body: string;
  } | null;
  onClearInitialDraft?: () => void;
  onNotify?: (title: string, body: string) => void;
}

type GmailFolderId = 'INBOX' | 'STARRED' | 'SENT' | 'DRAFT' | 'ALL' | 'TRASH';

type ConfirmModalState =
  | {
      type: 'send';
      to: string;
      cc?: string;
      subject: string;
      body: string;
    }
  | {
      type: 'save_draft';
      to: string;
      cc?: string;
      subject: string;
      body: string;
    }
  | {
      type: 'trash';
      message: GmailMessage;
    }
  | {
      type: 'delete_permanent';
      message: GmailMessage;
    }
  | {
      type: 'archive';
      message: GmailMessage;
    }
  | {
      type: 'toggle_read';
      message: GmailMessage;
      markRead: boolean;
    }
  | {
      type: 'toggle_star';
      message: GmailMessage;
      addStar: boolean;
    }
  | null;

function buildB3SummaryBody(stocksList: StockData[]): string {
  const top = [...stocksList].slice(0, 10);
  if (top.length === 0) {
    return 'Nenhum ativo carregado no momento no B3 AlphaTerminal PRO.';
  }
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const lines = top.map((s, idx) => {
    const price = Number(s.cotacao || 0).toFixed(2).replace('.', ',');
    const pl = s.pl !== null && s.pl !== undefined ? Number(s.pl).toFixed(2).replace('.', ',') : '-';
    const pvp = s.pvp !== null && s.pvp !== undefined ? Number(s.pvp).toFixed(2).replace('.', ',') : '-';
    const dy = s.divYield !== null && s.divYield !== undefined ? `${Number(s.divYield).toFixed(1).replace('.', ',')}%` : '-';
    const roic = s.roic !== null && s.roic !== undefined ? `${Number(s.roic).toFixed(1).replace('.', ',')}%` : '-';
    const score = s.scoreAlpha !== undefined ? ` | Score Alpha: ${s.scoreAlpha}` : '';
    return `${idx + 1}. ${s.papel} (${s.nomeEmpresa || s.papel}) - Setor: ${s.setor || '-'}
   Cotação: R$ ${price} | P/L: ${pl}x | P/VP: ${pvp}x | DY: ${dy} | ROIC: ${roic}${score}`;
  });

  return `Relatório Quantitativo & Fundamentalista B3 (${dateStr})
Gerado pelo B3 AlphaTerminal PRO

TOP ${top.length} ATIVOS ANALISADOS:
----------------------------------------
${lines.join('\n\n')}

----------------------------------------
Total de ativos no recorte: ${stocksList.length}`;
}

export const GmailManager: React.FC<GmailManagerProps> = ({
  stocks,
  filteredStocks,
  initialDraft,
  onClearInitialDraft,
  onNotify,
}) => {
  const {
    gmailAccessToken,
    gmailAccountEmail,
    connectGmail,
    disconnectGmail,
  } = useAuth();

  const [profile, setProfile] = useState<GmailProfile | null>(null);
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<GmailFolderId>('INBOX');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isBusyAction, setIsBusyAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Composer Modal state
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  // Mandatory explicit confirmation modal for any mutating/destructive Gmail call
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);

  const loadMailbox = useCallback(async () => {
    if (!gmailAccessToken) return;
    setIsLoadingMessages(true);
    setErrorMsg(null);
    try {
      const labelIds = selectedFolder === 'ALL' ? undefined : [selectedFolder];
      const [prof, lbls, list] = await Promise.all([
        getGmailProfile(gmailAccessToken),
        listGmailLabels(gmailAccessToken).catch(() => []),
        listGmailMessages({
          labelIds,
          query: searchQuery,
          maxResults: 15,
          token: gmailAccessToken,
        }),
      ]);
      setProfile(prof);
      setLabels(lbls);
      setMessages(list.messages);
      setSelectedMessage((prev) => {
        if (!prev) return list.messages[0] || null;
        return list.messages.find((m) => m.id === prev.id) || list.messages[0] || null;
      });
    } catch (err) {
      if (err instanceof GmailAuthExpiredError) {
        disconnectGmail();
        setErrorMsg(err.message);
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar mensagens do Gmail.');
      }
    } finally {
      setIsLoadingMessages(false);
    }
  }, [gmailAccessToken, selectedFolder, searchQuery, disconnectGmail]);

  useEffect(() => {
    if (gmailAccessToken) {
      loadMailbox();
    }
  }, [gmailAccessToken, loadMailbox]);

  useEffect(() => {
    if (initialDraft) {
      setComposeTo(initialDraft.to || '');
      setComposeCc('');
      setComposeSubject(initialDraft.subject);
      setComposeBody(initialDraft.body);
      setShowComposeModal(true);
      onClearInitialDraft?.();
    }
  }, [initialDraft, onClearInitialDraft]);

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      await connectGmail();
      setStatusMsg('Conta Gmail conectada com sucesso.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível autorizar o Gmail.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOpenB3ReportComposer = () => {
    const source = filteredStocks.length > 0 ? filteredStocks : stocks;
    const dateStr = new Date().toLocaleDateString('pt-BR');
    setComposeTo(profile?.emailAddress || gmailAccountEmail || '');
    setComposeCc('');
    setComposeSubject(`Relatório B3 AlphaTerminal PRO - Top 10 Ações (${dateStr})`);
    setComposeBody(buildB3SummaryBody(source));
    setShowComposeModal(true);
  };

  const handleReplyMessage = (msg: GmailMessage) => {
    const replyAddrMatch = msg.from.match(/<([^>]+)>/);
    const replyEmail = replyAddrMatch ? replyAddrMatch[1] : msg.from;
    const subj = msg.subject.toLowerCase().startsWith('re:') ? msg.subject : `Re: ${msg.subject}`;
    setComposeTo(replyEmail);
    setComposeCc('');
    setComposeSubject(subj);
    setComposeBody(`\n\n--- Mensagem original de ${msg.from} (${msg.date}) ---\n${msg.textBody || msg.snippet}`);
    setShowComposeModal(true);
  };

  const handleForwardMessage = (msg: GmailMessage) => {
    const subj = msg.subject.toLowerCase().startsWith('fwd:') || msg.subject.toLowerCase().startsWith('enc:')
      ? msg.subject
      : `Enc: ${msg.subject}`;
    setComposeTo('');
    setComposeCc('');
    setComposeSubject(subj);
    setComposeBody(
      `\n\n---------- Mensagem encaminhada ----------\nDe: ${msg.from}\nData: ${msg.date}\nAssunto: ${msg.subject}\n\n${msg.textBody || msg.snippet}`
    );
    setShowComposeModal(true);
  };

  const handleExecuteConfirmedAction = async () => {
    if (!confirmModal) return;
    setIsBusyAction(true);
    setErrorMsg(null);
    try {
      if (confirmModal.type === 'send') {
        await sendGmailMessage(
          {
            to: confirmModal.to,
            cc: confirmModal.cc,
            subject: confirmModal.subject,
            body: confirmModal.body,
          },
          gmailAccessToken
        );
        setShowComposeModal(false);
        setStatusMsg(`E-mail "${confirmModal.subject}" enviado para ${confirmModal.to}.`);
        onNotify?.('E-mail Enviado', `Mensagem enviada para ${confirmModal.to} via Gmail.`);
      } else if (confirmModal.type === 'save_draft') {
        await saveGmailDraft(
          {
            to: confirmModal.to,
            cc: confirmModal.cc,
            subject: confirmModal.subject,
            body: confirmModal.body,
          },
          gmailAccessToken
        );
        setShowComposeModal(false);
        setStatusMsg(`Rascunho "${confirmModal.subject}" salvo no Gmail.`);
        onNotify?.('Rascunho Salvo', `"${confirmModal.subject}" salvo nos rascunhos do Gmail.`);
      } else if (confirmModal.type === 'trash') {
        await trashGmailMessage(confirmModal.message.id, gmailAccessToken);
        setStatusMsg(`"${confirmModal.message.subject}" movido para a Lixeira.`);
      } else if (confirmModal.type === 'delete_permanent') {
        await deleteGmailMessagePermanently(confirmModal.message.id, gmailAccessToken);
        setStatusMsg(`"${confirmModal.message.subject}" excluído permanentemente do Gmail.`);
      } else if (confirmModal.type === 'archive') {
        await modifyGmailMessageLabels(
          confirmModal.message.id,
          { removeLabelIds: ['INBOX'] },
          gmailAccessToken
        );
        setStatusMsg(`"${confirmModal.message.subject}" arquivado.`);
      } else if (confirmModal.type === 'toggle_read') {
        await modifyGmailMessageLabels(
          confirmModal.message.id,
          confirmModal.markRead ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] },
          gmailAccessToken
        );
        setStatusMsg(
          confirmModal.markRead ? 'Mensagem marcada como lida.' : 'Mensagem marcada como não lida.'
        );
      } else if (confirmModal.type === 'toggle_star') {
        await modifyGmailMessageLabels(
          confirmModal.message.id,
          confirmModal.addStar ? { addLabelIds: ['STARRED'] } : { removeLabelIds: ['STARRED'] },
          gmailAccessToken
        );
        setStatusMsg(
          confirmModal.addStar ? 'Estrela adicionada à mensagem.' : 'Estrela removida da mensagem.'
        );
      }
      setConfirmModal(null);
      await loadMailbox();
    } catch (err) {
      if (err instanceof GmailAuthExpiredError) {
        disconnectGmail();
      }
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao executar operação no Gmail.');
      setConfirmModal(null);
    } finally {
      setIsBusyAction(false);
    }
  };

  // Disconnected view with official Sign in with Google button
  if (!gmailAccessToken) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <Mail className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Integração com Gmail
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Conecte sua conta Google para ler comunicados de mercado, fatos relevantes e enviar relatórios executivos do B3 AlphaTerminal diretamente pelo seu Gmail.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left text-xs max-w-2xl mx-auto">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                <span>Envio de Relatórios</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Envie o ranking Top 10 B3 e análises fundamentalistas para sua caixa de entrada ou equipe.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="font-bold text-rose-400 flex items-center gap-1.5">
                <Inbox className="w-3.5 h-3.5" />
                <span>Leitura & Busca</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Consulte e-mails, marcadores e filtre comunicados de RI, dividendos e fatos relevantes.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="font-bold text-purple-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Confirmação Segura</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Token mantido apenas em memória e confirmação explícita antes de enviar ou excluir e-mails.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="max-w-md mx-auto space-y-2 text-left">
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="break-words min-w-0">{errorMsg}</span>
              </div>
              <UnauthorizedDomainHelp errorMessage={errorMsg} />
            </div>
          )}

          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleConnectGmail}
              disabled={isConnecting}
              className="inline-flex items-center gap-3 px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-60"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>{isConnecting ? 'Autorizando Gmail...' : 'Sign in with Google / Conectar Gmail'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inboxLabel = labels.find((l) => l.id === 'INBOX');
  const folders: Array<{ id: GmailFolderId; label: string; icon: React.ElementType; unread?: number }> = [
    { id: 'INBOX', label: 'Caixa de Entrada', icon: Inbox, unread: inboxLabel?.messagesUnread },
    { id: 'STARRED', label: 'Com Estrela', icon: Star },
    { id: 'SENT', label: 'Enviados', icon: Send },
    { id: 'DRAFT', label: 'Rascunhos', icon: FileEdit },
    { id: 'ALL', label: 'Todos os E-mails', icon: Mail },
    { id: 'TRASH', label: 'Lixeira', icon: Trash2 },
  ];

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <Mail className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white tracking-tight">Gmail</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Conectado
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono truncate">
              {profile?.emailAddress || gmailAccountEmail || 'Conta Google autorizada'}
              {profile?.messagesTotal ? ` · ${profile.messagesTotal.toLocaleString('pt-BR')} mensagens` : ''}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setComposeTo('');
              setComposeCc('');
              setComposeSubject('');
              setComposeBody('');
              setShowComposeModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Escrever E-mail</span>
          </button>

          <button
            type="button"
            onClick={handleOpenB3ReportComposer}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
            title="Gerar rascunho de e-mail com o ranking atual da B3"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Enviar Ranking B3</span>
          </button>

          <button
            type="button"
            onClick={loadMailbox}
            disabled={isLoadingMessages}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMessages ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={disconnectGmail}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-rose-300 border border-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Desconectar</span>
          </button>
        </div>
      </div>

      {/* Feedback Banners */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{statusMsg}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Mailbox Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Search & Quick Filters Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {folders.map((f) => {
              const Icon = f.icon;
              const isActive = selectedFolder === f.id && !searchQuery.trim();
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedFolder(f.id);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{f.label}</span>
                  {f.unread !== undefined && f.unread > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono">
                      {f.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadMailbox();
            }}
            className="flex items-center gap-2 w-full md:w-80"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar no Gmail (ex: dividendos, B3)..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-rose-400"
              />
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
              >
                Limpar
              </button>
            )}
          </form>
        </div>

        {/* Split View: Messages List & Message Reader */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
          {/* Messages Column */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-800 divide-y divide-slate-800/80 max-h-[640px] overflow-y-auto">
            {isLoadingMessages ? (
              <div className="p-8 text-center text-xs text-slate-400">Carregando mensagens...</div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <Mail className="w-8 h-8 mx-auto text-slate-600" />
                <p>Nenhuma mensagem encontrada nesta visualização.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                return (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => setSelectedMessage(msg)}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer block ${
                      isSelected
                        ? 'bg-slate-800/90 border-l-2 border-l-rose-400'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-xs truncate ${
                          msg.isUnread ? 'font-bold text-white' : 'font-medium text-slate-300'
                        }`}
                      >
                        {msg.from.replace(/<[^>]+>/g, '').trim() || msg.from}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {msg.isStarred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                        <span className="text-[10px] font-mono text-slate-500">{msg.date}</span>
                      </div>
                    </div>
                    <div
                      className={`text-xs truncate mb-1 ${
                        msg.isUnread ? 'font-semibold text-rose-200' : 'text-slate-300'
                      }`}
                    >
                      {msg.subject}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-2">{msg.snippet}</div>
                  </button>
                );
              })
            )}
          </div>

          {/* Reader Column */}
          <div className="lg:col-span-7 flex flex-col max-h-[640px]">
            {!selectedMessage ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-slate-500 space-y-2">
                <MailOpen className="w-10 h-10 text-slate-700" />
                <p>Selecione um e-mail na lista para visualizar seu conteúdo.</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-slate-800 bg-slate-950/30 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                      {selectedMessage.subject}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleReplyMessage(selectedMessage)}
                        title="Responder"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleForwardMessage(selectedMessage)}
                        title="Encaminhar"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <Forward className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmModal({
                            type: 'toggle_star',
                            message: selectedMessage,
                            addStar: !selectedMessage.isStarred,
                          })
                        }
                        title={selectedMessage.isStarred ? 'Remover estrela' : 'Marcar com estrela'}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 cursor-pointer"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${selectedMessage.isStarred ? 'fill-amber-400' : ''}`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmModal({
                            type: 'toggle_read',
                            message: selectedMessage,
                            markRead: selectedMessage.isUnread,
                          })
                        }
                        title={selectedMessage.isUnread ? 'Marcar como lida' : 'Marcar como não lida'}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <MailOpen className="w-3.5 h-3.5" />
                      </button>
                      {selectedFolder === 'INBOX' && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmModal({ type: 'archive', message: selectedMessage })
                          }
                          title="Arquivar"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmModal({
                            type: selectedFolder === 'TRASH' ? 'delete_permanent' : 'trash',
                            message: selectedMessage,
                          })
                        }
                        title={selectedFolder === 'TRASH' ? 'Excluir permanentemente' : 'Mover para Lixeira'}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
                    <div>
                      <span className="text-slate-500">De:</span>{' '}
                      <span className="text-slate-200">{selectedMessage.from}</span>
                    </div>
                    {selectedMessage.to && (
                      <div>
                        <span className="text-slate-500">Para:</span> {selectedMessage.to}
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500">Data:</span> {selectedMessage.date}
                    </div>
                  </div>

                  {selectedMessage.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedMessage.attachments.map((att, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300"
                        >
                          <Paperclip className="w-3 h-3 text-slate-400" />
                          <span>{att.filename}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-950/60">
                  {selectedMessage.htmlBody ? (
                    <iframe
                      title="Conteúdo do E-mail"
                      sandbox=""
                      srcDoc={selectedMessage.htmlBody}
                      className="w-full min-h-[380px] rounded-xl bg-white border border-slate-800"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-xs text-slate-200 leading-relaxed">
                      {selectedMessage.textBody || selectedMessage.snippet || '(Mensagem sem conteúdo textual)'}
                    </pre>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Compose Email Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-rose-400" />
                <span>Nova Mensagem via Gmail</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowComposeModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Para *</label>
                <input
                  type="text"
                  required
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="destinatario@exemplo.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Cc (Opcional)</label>
                <input
                  type="text"
                  value={composeCc}
                  onChange={(e) => setComposeCc(e.target.value)}
                  placeholder="copia@exemplo.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Assunto *</label>
                <input
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Assunto do e-mail"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Mensagem *</label>
                <textarea
                  rows={10}
                  required
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Escreva sua mensagem..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-[11px] leading-relaxed focus:outline-hidden focus:border-rose-400"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  if (!composeSubject.trim() && !composeBody.trim()) return;
                  setConfirmModal({
                    type: 'save_draft',
                    to: composeTo.trim(),
                    cc: composeCc.trim() || undefined,
                    subject: composeSubject.trim() || '(Sem assunto)',
                    body: composeBody,
                  });
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
              >
                Salvar Rascunho
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
                  onClick={() =>
                    setConfirmModal({
                      type: 'send',
                      to: composeTo.trim(),
                      cc: composeCc.trim() || undefined,
                      subject: composeSubject.trim(),
                      body: composeBody,
                    })
                  }
                  className="px-4 py-2 text-xs font-bold bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar E-mail</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Explicit Confirmation Modal for All Mutating/Destructive Gmail Operations */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmModal.type === 'trash' || confirmModal.type === 'delete_permanent'
                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                    : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                }`}
              >
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">
                  {confirmModal.type === 'send' && 'Confirmar envio de e-mail pelo Gmail?'}
                  {confirmModal.type === 'save_draft' && 'Salvar rascunho na sua conta Gmail?'}
                  {confirmModal.type === 'trash' && 'Mover e-mail para a Lixeira do Gmail?'}
                  {confirmModal.type === 'delete_permanent' && 'Excluir e-mail permanentemente do Gmail?'}
                  {confirmModal.type === 'archive' && 'Arquivar e-mail na sua conta Gmail?'}
                  {confirmModal.type === 'toggle_read' &&
                    (confirmModal.markRead ? 'Marcar e-mail como lida?' : 'Marcar e-mail como não lida?')}
                  {confirmModal.type === 'toggle_star' &&
                    (confirmModal.addStar ? 'Adicionar estrela ao e-mail?' : 'Remover estrela do e-mail?')}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {confirmModal.type === 'send' &&
                    `Esta ação enviará o e-mail "${confirmModal.subject}" para ${confirmModal.to}${confirmModal.cc ? ` (Cc: ${confirmModal.cc})` : ''} usando sua conta Gmail.`}
                  {confirmModal.type === 'save_draft' &&
                    `Um rascunho com o assunto "${confirmModal.subject}" será salvo na pasta Rascunhos do seu Gmail.`}
                  {confirmModal.type === 'trash' &&
                    `A mensagem "${confirmModal.message.subject}" será movida para a Lixeira do Gmail.`}
                  {confirmModal.type === 'delete_permanent' &&
                    `Atenção: a mensagem "${confirmModal.message.subject}" será excluída permanentemente e não poderá ser recuperada.`}
                  {confirmModal.type === 'archive' &&
                    `A mensagem "${confirmModal.message.subject}" será removida da Caixa de Entrada e mantida em Todos os E-mails.`}
                  {confirmModal.type === 'toggle_read' &&
                    `Alterar o estado de leitura de "${confirmModal.message.subject}" no Gmail.`}
                  {confirmModal.type === 'toggle_star' &&
                    `Alterar o marcador de estrela de "${confirmModal.message.subject}" no Gmail.`}
                </p>
              </div>
            </div>

            {confirmModal.type === 'trash' && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setConfirmModal({ type: 'delete_permanent', message: confirmModal.message })
                  }
                  className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                >
                  Ou excluir permanentemente sem enviar para a lixeira
                </button>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={isBusyAction}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedAction}
                disabled={isBusyAction}
                className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50 ${
                  confirmModal.type === 'trash' || confirmModal.type === 'delete_permanent'
                    ? 'bg-rose-500 hover:bg-rose-400 text-white'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
              >
                {isBusyAction ? 'Processando...' : 'Confirmar Operação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
