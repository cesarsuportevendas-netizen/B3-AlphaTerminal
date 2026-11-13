// Strictly in-memory OAuth Access Token cache (never persisted to localStorage/sessionStorage)
let cachedDriveAccessToken: string | null = null;
let cachedDriveAccountEmail: string | null = null;

export function setDriveAccessToken(token: string | null, accountEmail?: string | null): void {
  cachedDriveAccessToken = token || null;
  if (token === null) {
    cachedDriveAccountEmail = null;
  } else if (accountEmail !== undefined) {
    cachedDriveAccountEmail = accountEmail || null;
  }
}

export function getDriveAccessToken(): string | null {
  return cachedDriveAccessToken;
}

export function getDriveConnectedEmail(): string | null {
  return cachedDriveAccountEmail;
}

export function clearDriveAccessToken(): void {
  cachedDriveAccessToken = null;
  cachedDriveAccountEmail = null;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
  trashed?: boolean;
  owners?: Array<{
    displayName?: string;
    emailAddress?: string;
  }>;
}

export interface DriveAboutInfo {
  user?: {
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
  };
  storageQuota?: {
    limit?: string;
    usage?: string;
    usageInDrive?: string;
  };
}

export interface DriveActivityEntry {
  timestamp: string;
  actionLabel: string;
  actorLabel: string;
}

export class DriveAuthExpiredError extends Error {
  constructor(message = 'Sessão do Google Drive expirada. Conecte novamente para renovar o acesso.') {
    super(message);
    this.name = 'DriveAuthExpiredError';
  }
}

function requireToken(explicitToken?: string | null): string {
  const token = explicitToken || cachedDriveAccessToken;
  if (!token) {
    throw new DriveAuthExpiredError('Google Drive não conectado nesta sessão.');
  }
  return token;
}

async function driveFetch(url: string, init: RequestInit = {}, explicitToken?: string | null): Promise<Response> {
  const token = requireToken(explicitToken);
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    clearDriveAccessToken();
    throw new DriveAuthExpiredError();
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

export function isGoogleSpreadsheet(mimeType: string): boolean {
  return mimeType === 'application/vnd.google-apps.spreadsheet';
}

export function isFolder(mimeType: string): boolean {
  return mimeType === 'application/vnd.google-apps.folder';
}

export function isImportableB3Spreadsheet(file: DriveFileItem): boolean {
  const lower = file.name.toLowerCase();
  return (
    file.mimeType === 'application/vnd.google-apps.spreadsheet' ||
    file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.mimeType === 'application/vnd.ms-excel' ||
    file.mimeType === 'text/csv' ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.csv')
  );
}

export async function getDriveAbout(token?: string | null): Promise<DriveAboutInfo> {
  const res = await driveFetch(
    'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota(limit,usage,usageInDrive)',
    { method: 'GET' },
    token
  );
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Não foi possível obter informações da conta Google Drive'));
  }
  const data = (await res.json()) as DriveAboutInfo;
  if (data.user?.emailAddress) {
    cachedDriveAccountEmail = data.user.emailAddress;
  }
  return data;
}

export async function listDriveFiles(options: {
  folderId?: string;
  query?: string;
  filterType?: 'all' | 'spreadsheets' | 'folders';
  pageToken?: string;
  pageSize?: number;
  token?: string | null;
}): Promise<{ files: DriveFileItem[]; nextPageToken?: string }> {
  const {
    folderId = 'root',
    query = '',
    filterType = 'all',
    pageToken,
    pageSize = 50,
    token,
  } = options;

  const conditions: string[] = ['trashed = false'];
  const cleanSearch = query.trim().replace(/'/g, "\\'");

  if (cleanSearch) {
    conditions.push(`name contains '${cleanSearch}'`);
  } else if (folderId) {
    conditions.push(`'${folderId}' in parents`);
  }

  if (filterType === 'folders') {
    conditions.push(`mimeType = 'application/vnd.google-apps.folder'`);
  } else if (filterType === 'spreadsheets') {
    conditions.push(
      `(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'application/vnd.ms-excel' or mimeType = 'text/csv' or name contains '.xlsx' or name contains '.xls' or name contains '.csv')`
    );
  }

  const params = new URLSearchParams({
    q: conditions.join(' and '),
    pageSize: String(pageSize),
    orderBy: 'folder,modifiedTime desc',
    fields:
      'nextPageToken,files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink,iconLink,parents,trashed,owners(displayName,emailAddress))',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { method: 'GET' },
    token
  );
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Erro ao listar arquivos do Google Drive'));
  }

  const data = (await res.json()) as { files?: DriveFileItem[]; nextPageToken?: string };
  return {
    files: Array.isArray(data.files) ? data.files : [],
    nextPageToken: data.nextPageToken,
  };
}

export async function createDriveFolder(
  name: string,
  parentId = 'root',
  token?: string | null
): Promise<DriveFileItem> {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('Informe um nome válido para a pasta.');
  }

  const res = await driveFetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime,webViewLink,parents',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cleanName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      }),
    },
    token
  );

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Falha ao criar pasta no Google Drive'));
  }

  return (await res.json()) as DriveFileItem;
}

export async function uploadFileToDrive(options: {
  name: string;
  mimeType: string;
  contentBlob: Blob;
  parentId?: string;
  existingFileId?: string;
  token?: string | null;
}): Promise<DriveFileItem> {
  const { name, mimeType, contentBlob, parentId = 'root', existingFileId, token } = options;

  const metadata: Record<string, unknown> = {
    name,
    mimeType,
  };
  if (!existingFileId && parentId) {
    metadata.parents = [parentId];
  }

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', contentBlob, name);

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink,parents`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink,parents';

  const res = await driveFetch(
    url,
    {
      method: existingFileId ? 'PATCH' : 'POST',
      body: form,
    },
    token
  );

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Falha ao enviar arquivo para o Google Drive'));
  }

  return (await res.json()) as DriveFileItem;
}

export async function downloadDriveSpreadsheetBuffer(
  file: DriveFileItem,
  token?: string | null
): Promise<{ buffer: ArrayBuffer; isCsv: boolean }> {
  const isSheet = isGoogleSpreadsheet(file.mimeType);
  const lower = file.name.toLowerCase();
  const isCsv = !isSheet && (file.mimeType === 'text/csv' || lower.endsWith('.csv'));

  const url = isSheet
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        file.id
      )}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;

  const res = await driveFetch(url, { method: 'GET' }, token);
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, `Falha ao baixar "${file.name}" do Google Drive`));
  }

  const buffer = await res.arrayBuffer();
  return { buffer, isCsv };
}

export async function renameDriveFile(
  fileId: string,
  newName: string,
  token?: string | null
): Promise<DriveFileItem> {
  const cleanName = newName.trim();
  if (!cleanName) {
    throw new Error('O novo nome do arquivo não pode estar vazio.');
  }

  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?fields=id,name,mimeType,size,modifiedTime,webViewLink,parents`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleanName }),
    },
    token
  );

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Não foi possível renomear o arquivo no Drive'));
  }

  return (await res.json()) as DriveFileItem;
}

export async function trashDriveFile(fileId: string, token?: string | null): Promise<void> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    },
    token
  );

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Não foi possível mover o arquivo para a lixeira'));
  }
}

export async function deleteDriveFilePermanently(fileId: string, token?: string | null): Promise<void> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
    },
    token
  );

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Não foi possível excluir permanentemente o arquivo'));
  }
}

export async function getDriveFileActivity(
  fileId: string,
  token?: string | null
): Promise<DriveActivityEntry[]> {
  try {
    const res = await driveFetch(
      'https://driveactivity.googleapis.com/v2/activity:query',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: `items/${fileId}`,
          pageSize: 8,
        }),
      },
      token
    );

    if (!res.ok) return [];
    const data = (await res.json()) as { activities?: Array<Record<string, unknown>> };
    const activities = Array.isArray(data.activities) ? data.activities : [];

    return activities.map((act: any) => {
      const actionKey = Object.keys(act?.primaryActionDetail || {})[0] || 'edit';
      const labelMap: Record<string, string> = {
        create: 'Arquivo criado',
        edit: 'Editado',
        move: 'Movido',
        rename: 'Renomeado',
        delete: 'Movido para lixeira',
        restore: 'Restaurado',
        permissionChange: 'Permissões alteradas',
        comment: 'Comentário',
      };
      const actor =
        act?.actors?.[0]?.user?.knownUser?.personName ||
        (act?.actors?.[0]?.user?.knownUser?.isCurrentUser ? 'Você' : 'Usuário Google');
      const timestamp = act?.timestamp || act?.timeRange?.endTime || '';
      return {
        timestamp,
        actionLabel: labelMap[actionKey] || `Ação (${actionKey})`,
        actorLabel: actor,
      };
    });
  } catch {
    return [];
  }
}
