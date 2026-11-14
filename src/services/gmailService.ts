// Strictly in-memory OAuth Access Token cache (never persisted to localStorage/sessionStorage)
let cachedGmailAccessToken: string | null = null;
let cachedGmailAccountEmail: string | null = null;

export function setGmailAccessToken(token: string | null, accountEmail?: string | null): void {
  cachedGmailAccessToken = token || null;
  if (token === null) {
    cachedGmailAccountEmail = null;
  } else if (accountEmail !== undefined) {
    cachedGmailAccountEmail = accountEmail || null;
  }
}

export function getGmailAccessToken(): string | null {
  return cachedGmailAccessToken;
}

export function getGmailConnectedEmail(): string | null {
  return cachedGmailAccountEmail;
}

export function clearGmailAccessToken(): void {
  cachedGmailAccessToken = null;
  cachedGmailAccountEmail = null;
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type?: string;
  messagesTotal?: number;
  messagesUnread?: number;
}

export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailMessageHeader[];
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

export interface GmailAttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  internalDate?: string;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  date: string;
  isUnread: boolean;
  isStarred: boolean;
  textBody: string;
  htmlBody: string;
  attachments: GmailAttachmentMeta[];
}

export class GmailAuthExpiredError extends Error {
  constructor(
    message = 'Sessão do Gmail expirada ou sem permissão. Conecte novamente com sua conta Google.'
  ) {
    super(message);
    this.name = 'GmailAuthExpiredError';
  }
}

function requireToken(explicitToken?: string | null): string {
  const token = explicitToken || cachedGmailAccessToken;
  if (!token) {
    throw new GmailAuthExpiredError('Gmail não conectado nesta sessão.');
  }
  return token;
}

async function gmailFetch(
  url: string,
  init: RequestInit = {},
  explicitToken?: string | null
): Promise<Response> {
  const token = requireToken(explicitToken);
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    clearGmailAccessToken();
    throw new GmailAuthExpiredError();
  }

  if (response.status === 403) {
    const cloned = response.clone();
    try {
      const errJson = await cloned.json();
      const msg = String(errJson?.error?.message || '');
      if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('scope')) {
        clearGmailAccessToken();
        throw new GmailAuthExpiredError(
          'A sessão Google atual ainda não possui permissão do Gmail. Clique em Conectar Gmail para autorizar.'
        );
      }
    } catch (e) {
      if (e instanceof GmailAuthExpiredError) throw e;
    }
  }

  return response;
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    if (data?.error?.message) {
      return String(data.error.message);
    }
  } catch {}
  return `${fallback} (HTTP ${response.status})`;
}

function decodeBase64UrlUtf8(base64Url: string): string {
  if (!base64Url) return '';
  try {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function encodeBase64UrlUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeRfc2047Subject(subject: string): string {
  // Encode non-ASCII subject safely using RFC 2047 Base64 UTF-8
  if (!/[^\x00-\x7F]/.test(subject)) {
    return subject;
  }
  const bytes = new TextEncoder().encode(subject);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function extractBodyParts(
  payload: GmailMessagePart | undefined,
  acc: { text: string; html: string; attachments: GmailAttachmentMeta[] }
): void {
  if (!payload) return;

  if (payload.filename && payload.filename.trim().length > 0) {
    acc.attachments.push({
      filename: payload.filename,
      mimeType: payload.mimeType || 'application/octet-stream',
      size: payload.body?.size || 0,
      attachmentId: payload.body?.attachmentId,
    });
  }

  if (payload.body?.data) {
    const decoded = decodeBase64UrlUtf8(payload.body.data);
    if (payload.mimeType === 'text/plain' && !acc.text) {
      acc.text = decoded;
    } else if (payload.mimeType === 'text/html' && !acc.html) {
      acc.html = decoded;
    } else if (!payload.mimeType && !acc.text) {
      acc.text = decoded;
    }
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      extractBodyParts(part, acc);
    }
  }
}

function mapRawGmailMessage(raw: {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
}): GmailMessage {
  const headers = raw.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const extracted = {
    text: '',
    html: '',
    attachments: [] as GmailAttachmentMeta[],
  };
  extractBodyParts(raw.payload, extracted);

  const labelIds = raw.labelIds || [];
  const dateHeader = getHeader('Date');
  let formattedDate = dateHeader;
  if (raw.internalDate) {
    const ms = Number(raw.internalDate);
    if (Number.isFinite(ms) && ms > 0) {
      formattedDate = new Date(ms).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  return {
    id: raw.id,
    threadId: raw.threadId || raw.id,
    labelIds,
    snippet: raw.snippet || '',
    internalDate: raw.internalDate,
    subject: getHeader('Subject') || '(Sem assunto)',
    from: getHeader('From') || '(Remetente desconhecido)',
    to: getHeader('To') || '',
    cc: getHeader('Cc') || undefined,
    date: formattedDate || '-',
    isUnread: labelIds.includes('UNREAD'),
    isStarred: labelIds.includes('STARRED'),
    textBody: extracted.text,
    htmlBody: extracted.html,
    attachments: extracted.attachments,
  };
}

export async function getGmailProfile(token?: string | null): Promise<GmailProfile> {
  const resp = await gmailFetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    {},
    token
  );
  if (!resp.ok) {
    throw new Error(await parseErrorMessage(resp, 'Erro ao consultar perfil do Gmail'));
  }
  return (await resp.json()) as GmailProfile;
}

export async function listGmailLabels(token?: string | null): Promise<GmailLabel[]> {
  const resp = await gmailFetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/labels',
    {},
    token
  );
  if (!resp.ok) {
    throw new Error(await parseErrorMessage(resp, 'Erro ao listar marcadores do Gmail'));
  }
  const data = (await resp.json()) as { labels?: GmailLabel[] };
  return data.labels || [];
}

export async function listGmailMessages(options: {
  labelIds?: string[];
  query?: string;
  maxResults?: number;
  pageToken?: string;
  token?: string | null;
}): Promise<{ messages: GmailMessage[]; nextPageToken?: string; resultSizeEstimate?: number }> {
  const params = new URLSearchParams();
  params.set('maxResults', String(options.maxResults || 15));
  if (options.query && options.query.trim()) {
    params.set('q', options.query.trim());
  }
  if (options.labelIds && options.labelIds.length > 0 && !options.query?.trim()) {
    for (const lbl of options.labelIds) {
      params.append('labelIds', lbl);
    }
  }
  if (options.pageToken) {
    params.set('pageToken', options.pageToken);
  }

  const listResp = await gmailFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    {},
    options.token
  );
  if (!listResp.ok) {
    throw new Error(await parseErrorMessage(listResp, 'Erro ao listar mensagens do Gmail'));
  }

  const listData = (await listResp.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate?: number;
  };

  const stubs = listData.messages || [];
  if (stubs.length === 0) {
    return {
      messages: [],
      nextPageToken: listData.nextPageToken,
      resultSizeEstimate: listData.resultSizeEstimate,
    };
  }

  // Fetch full details in bounded parallel batches
  const detailed = await Promise.all(
    stubs.map(async (stub) => {
      try {
        const msgResp = await gmailFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
            stub.id
          )}?format=full`,
          {},
          options.token
        );
        if (!msgResp.ok) return null;
        const raw = await msgResp.json();
        return mapRawGmailMessage(raw);
      } catch {
        return null;
      }
    })
  );

  return {
    messages: detailed.filter((m): m is GmailMessage => m !== null),
    nextPageToken: listData.nextPageToken,
    resultSizeEstimate: listData.resultSizeEstimate,
  };
}

function buildMimeRawMessage(params: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
}): string {
  const cleanTo = params.to.replace(/[\r\n]/g, '').trim();
  const cleanCc = (params.cc || '').replace(/[\r\n]/g, '').trim();
  const cleanSubject = params.subject.replace(/[\r\n]/g, '').trim();

  const headers = [
    `To: ${cleanTo}`,
    ...(cleanCc ? [`Cc: ${cleanCc}`] : []),
    `Subject: ${encodeRfc2047Subject(cleanSubject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.body,
  ];

  return encodeBase64UrlUtf8(headers.join('\r\n'));
}

export async function sendGmailMessage(
  params: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
  },
  token?: string | null
): Promise<{ id: string; threadId: string }> {
  const raw = buildMimeRawMessage(params);
  const resp = await gmailFetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    },
    token
  );
  if (!resp.ok) {
    throw new Error(await parseErrorMessage(resp, 'Erro ao enviar e-mail pelo Gmail'));
  }
  return (await resp.json()) as { id: string; threadId: string };
}

export async function saveGmailDraft(
  params: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
  },
  token?: string | null
): Promise<{ id: string }> {
  const raw = buildMimeRawMessage(params);
  const resp = await gmailFetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { raw } }),
    },
    token
  );
  if (!resp.ok) {
    throw new Error(await parseErrorMessage(resp, 'Erro ao salvar rascunho no Gmail'));
  }
  return (await resp.json()) as { id: string };
}

export async function modifyGmailMessageLabels(
  messageId: string,
  changes: { addLabelIds?: string[]; removeLabelIds?: string[] },
  token?: string | null
): Promise<void> {
  const resp = await gmailFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
      messageId
    )}/modify`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addLabelIds: changes.addLabelIds || [],
        removeLabelIds: changes.removeLabelIds || [],
      }),
    },
    token
  );
  if (!resp.ok) {
    throw new Error(await parseErrorMessage(resp, 'Erro ao atualizar marcadores da mensagem'));
  }
}

export async function trashGmailMessage(messageId: string, token?: string | null): Promise<void> {
  const resp = await gmailFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
      messageId
    )}/trash`,
    { method: 'POST' },
    token
  );
  if (!resp.ok) {
    throw new Error(await parseErrorMessage(resp, 'Erro ao mover e-mail para a lixeira'));
  }
}

export async function deleteGmailMessagePermanently(
  messageId: string,
  token?: string | null
): Promise<void> {
  const resp = await gmailFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' },
    token
  );
  if (!resp.ok) {
    throw new Error(await parseErrorMessage(resp, 'Erro ao excluir e-mail permanentemente'));
  }
}
