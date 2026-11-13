import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  HardDrive,
  Folder,
  FolderPlus,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  Search,
  RefreshCw,
  Upload,
  Download,
  ExternalLink,
  Trash2,
  Edit3,
  Clock,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X,
  LogOut,
  Shield,
  Database,
  Globe,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StockData } from '../types/stock';
import {
  DriveFileItem,
  DriveAboutInfo,
  DriveActivityEntry,
  DriveAuthExpiredError,
  getDriveAbout,
  listDriveFiles,
  createDriveFolder,
  uploadFileToDrive,
  downloadDriveSpreadsheetBuffer,
  renameDriveFile,
  trashDriveFile,
  deleteDriveFilePermanently,
  getDriveFileActivity,
  isFolder,
  isImportableB3Spreadsheet,
} from '../services/googleDriveService';
import {
  parseSpreadsheetBuffer,
  buildExcelBlob,
  buildCSVBlob,
} from '../utils/excelParser';
import { refreshStocksOnline, OnlineRefreshProgress } from '../services/onlineStockUpdater';

interface GoogleDriveManagerProps {
  stocks: StockData[];
  filteredStocks: StockData[];
  onDataLoaded: (data: StockData[], sourceName: string, mode: 'merge' | 'replace') => void;
  onNotify?: (title: string, body: string) => void;
}

type ConfirmModalState =
  | {
      type: 'trash';
      file: DriveFileItem;
    }
  | {
      type: 'delete_permanent';
      file: DriveFileItem;
    }
  | {
      type: 'rename';
      file: DriveFileItem;
      newName: string;
    }
  | {
      type: 'overwrite_upload';
      existingFile: DriveFileItem;
      fileName: string;
      mimeType: string;
      blob: Blob;
    }
  | null;

function formatBytes(bytesStr?: string): string {
  const num = Number(bytesStr);
  if (!num || Number.isNaN(num)) return '-';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getMimeBadge(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.folder') return 'Pasta';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'Google Planilhas';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'Excel (.xlsx)';
  if (mimeType === 'application/vnd.ms-excel') return 'Excel (.xls)';
  if (mimeType === 'text/csv') return 'CSV';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'application/json') return 'JSON';
  return 'Arquivo';
}

export const GoogleDriveManager: React.FC<GoogleDriveManagerProps> = ({
  stocks,
  filteredStocks,
  onDataLoaded,
  onNotify,
}) => {
  const {
    driveAccessToken,
    driveAccountEmail,
    connectGoogleDrive,
    disconnectGoogleDrive,
    isAdmin,
  } = useAuth();

  const [about, setAbout] = useState<DriveAboutInfo | null>(null);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([
    { id: 'root', name: 'Meu Drive' },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'spreadsheets' | 'folders'>('all');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBusyAction, setIsBusyAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Create Folder modal
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Rename draft modal
  const [renameTarget, setRenameTarget] = useState<DriveFileItem | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Explicit Confirmation Modal for destructive/mutating Drive calls
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);

  // Admin Spreadsheet Import Mode modal
  const [importTarget, setImportTarget] = useState<DriveFileItem | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [autoUpdateOnline, setAutoUpdateOnline] = useState(true);
  const [onlineImportProgress, setOnlineImportProgress] = useState<OnlineRefreshProgress | null>(null);

  // File Activity modal
  const [activityTarget, setActivityTarget] = useState<DriveFileItem | null>(null);
  const [activityList, setActivityList] = useState<DriveActivityEntry[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  const localUploadRef = useRef<HTMLInputElement>(null);

  const currentFolder = breadcrumbs[breadcrumbs.length - 1] || { id: 'root', name: 'Meu Drive' };

  const loadDriveContent = useCallback(async () => {
    if (!driveAccessToken) return;
    setIsLoadingFiles(true);
    setErrorMsg(null);
    try {
      const [aboutData, listData] = await Promise.all([
        getDriveAbout(driveAccessToken).catch(() => null),
        listDriveFiles({
          folderId: currentFolder.id,
          query: searchQuery,
          filterType,
          token: driveAccessToken,
        }),
      ]);
      if (aboutData) setAbout(aboutData);
      setFiles(listData.files);
    } catch (err) {
      if (err instanceof DriveAuthExpiredError) {
        disconnectGoogleDrive();
        setErrorMsg(err.message);
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar arquivos do Google Drive.');
      }
    } finally {
      setIsLoadingFiles(false);
    }
  }, [driveAccessToken, currentFolder.id, searchQuery, filterType, disconnectGoogleDrive]);

  useEffect(() => {
    if (driveAccessToken) {
      loadDriveContent();
    } else {
      setFiles([]);
      setAbout(null);
    }
  }, [driveAccessToken, loadDriveContent]);

  const handleConnectDrive = async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      await connectGoogleDrive();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível autorizar o Google Drive.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOpenFolder = (folder: DriveFileItem) => {
    setSearchQuery('');
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setSearchQuery('');
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setIsBusyAction(true);
    setErrorMsg(null);
    try {
      const created = await createDriveFolder(newFolderName.trim(), currentFolder.id, driveAccessToken);
      setStatusMsg(`Pasta "${created.name}" criada com sucesso no Google Drive.`);
      setNewFolderName('');
      setShowNewFolderModal(false);
      await loadDriveContent();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao criar pasta.');
    } finally {
      setIsBusyAction(false);
    }
  };

  const triggerUploadWithDuplicateCheck = async (fileName: string, mimeType: string, blob: Blob) => {
    const duplicate = files.find(
      (f) => !isFolder(f.mimeType) && f.name.toLowerCase() === fileName.toLowerCase()
    );
    if (duplicate) {
      setConfirmModal({
        type: 'overwrite_upload',
        existingFile: duplicate,
        fileName,
        mimeType,
        blob,
      });
      return;
    }

    setIsBusyAction(true);
    setErrorMsg(null);
    try {
      const uploaded = await uploadFileToDrive({
        name: fileName,
        mimeType,
        contentBlob: blob,
        parentId: currentFolder.id,
        token: driveAccessToken,
      });
      setStatusMsg(`Arquivo "${uploaded.name}" salvo em "${currentFolder.name}" no Google Drive.`);
      onNotify?.('Salvo no Google Drive', `"${uploaded.name}" enviado para o Google Drive.`);
      await loadDriveContent();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao enviar arquivo para o Google Drive.');
    } finally {
      setIsBusyAction(false);
    }
  };

  const handleSaveDatasetToDrive = async (format: 'xlsx' | 'csv' | 'json') => {
    const sourceData = filteredStocks.length > 0 ? filteredStocks : stocks;
    if (sourceData.length === 0) {
      setErrorMsg('Não há ativos carregados na base para exportar ao Google Drive.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'xlsx') {
      const blob = buildExcelBlob(sourceData);
      await triggerUploadWithDuplicateCheck(
        `b3_alphaterminal_${stamp}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        blob
      );
    } else if (format === 'csv') {
      const blob = buildCSVBlob(sourceData);
      await triggerUploadWithDuplicateCheck(`b3_alphaterminal_${stamp}.csv`, 'text/csv', blob);
    } else {
      const blob = new Blob([JSON.stringify(sourceData, null, 2)], { type: 'application/json' });
      await triggerUploadWithDuplicateCheck(`b3_alphaterminal_${stamp}.json`, 'application/json', blob);
    }
  };

  const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await triggerUploadWithDuplicateCheck(
      file.name,
      file.type || 'application/octet-stream',
      file
    );
  };

  const handleExecuteConfirmedAction = async () => {
    if (!confirmModal) return;
    setIsBusyAction(true);
    setErrorMsg(null);
    try {
      if (confirmModal.type === 'trash') {
        await trashDriveFile(confirmModal.file.id, driveAccessToken);
        setStatusMsg(`"${confirmModal.file.name}" foi movido para a lixeira do Google Drive.`);
      } else if (confirmModal.type === 'delete_permanent') {
        await deleteDriveFilePermanently(confirmModal.file.id, driveAccessToken);
        setStatusMsg(`"${confirmModal.file.name}" foi excluído permanentemente do Google Drive.`);
      } else if (confirmModal.type === 'rename') {
        const updated = await renameDriveFile(
          confirmModal.file.id,
          confirmModal.newName,
          driveAccessToken
        );
        setStatusMsg(`Arquivo renomeado para "${updated.name}".`);
      } else if (confirmModal.type === 'overwrite_upload') {
        const updated = await uploadFileToDrive({
          name: confirmModal.fileName,
          mimeType: confirmModal.mimeType,
          contentBlob: confirmModal.blob,
          existingFileId: confirmModal.existingFile.id,
          token: driveAccessToken,
        });
        setStatusMsg(`Arquivo "${updated.name}" atualizado no Google Drive.`);
        onNotify?.('Arquivo Atualizado', `"${updated.name}" foi atualizado no Google Drive.`);
      }
      setConfirmModal(null);
      await loadDriveContent();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao executar operação no Google Drive.');
      setConfirmModal(null);
    } finally {
      setIsBusyAction(false);
    }
  };

  const handleImportDriveSpreadsheet = async () => {
    if (!importTarget || !isAdmin) return;
    setIsBusyAction(true);
    setErrorMsg(null);
    setOnlineImportProgress(null);
    try {
      const { buffer, isCsv } = await downloadDriveSpreadsheetBuffer(importTarget, driveAccessToken);
      const parsed = parseSpreadsheetBuffer(buffer, isCsv);
      if (parsed.data.length === 0) {
        throw new Error('Nenhum ativo válido da B3 encontrado neste arquivo.');
      }

      let importedData = parsed.data;
      let onlineExtra = '';
      if (autoUpdateOnline) {
        const summary = await refreshStocksOnline(importedData, {
          batchSize: 12,
          onProgress: (p) => setOnlineImportProgress(p),
        });
        importedData = summary.stocks;
        if (summary.updatedCount > 0) {
          onlineExtra = ` (${summary.updatedCount} atualizados via ${summary.sourcesUsed.join(', ')})`;
        }
      }

      onDataLoaded(importedData, `Drive: ${importTarget.name}`, importMode);
      setStatusMsg(
        `Importados ${importedData.length} ativos de "${importTarget.name}" (${
          importMode === 'replace' ? 'Substituição' : 'Mesclagem'
        })${onlineExtra}.`
      );
      setImportTarget(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Não foi possível importar a planilha do Google Drive.'
      );
    } finally {
      setIsBusyAction(false);
      setOnlineImportProgress(null);
    }
  };

  const handleDownloadDriveFile = async (file: DriveFileItem) => {
    setIsBusyAction(true);
    setErrorMsg(null);
    try {
      const { buffer, isCsv } = await downloadDriveSpreadsheetBuffer(file, driveAccessToken);
      const ext =
        file.mimeType === 'application/vnd.google-apps.spreadsheet' && !file.name.endsWith('.xlsx')
          ? `${file.name}.xlsx`
          : file.name;
      const mime = isCsv
        ? 'text/csv;charset=utf-8;'
        : file.mimeType === 'application/vnd.google-apps.spreadsheet'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : file.mimeType || 'application/octet-stream';
      const blob = new Blob([buffer], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ext;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao baixar arquivo do Google Drive.');
    } finally {
      setIsBusyAction(false);
    }
  };

  const handleOpenActivity = async (file: DriveFileItem) => {
    setActivityTarget(file);
    setIsLoadingActivity(true);
    setActivityList([]);
    try {
      const entries = await getDriveFileActivity(file.id, driveAccessToken);
      setActivityList(entries);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  // Disconnected view with official Google Sign-in styling
  if (!driveAccessToken) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
            <HardDrive className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Integração com Google Drive
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Conecte sua conta Google para navegar pelas suas pastas, salvar planilhas de análise fundamentalista (.xlsx / .csv / .json) diretamente na nuvem e importar dados B3 do Drive.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left text-xs max-w-2xl mx-auto">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Backup na Nuvem</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Exporte seus rankings e indicadores direto para seu Drive em Excel ou CSV.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Importação B3</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Administradores podem importar Google Sheets, XLSX e CSV direto para o terminal.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="font-bold text-purple-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Sessão Segura</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Token mantido apenas em memória durante a sessão, com confirmação em alterações.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="max-w-md mx-auto p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleConnectDrive}
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
              <span>{isConnecting ? 'Autorizando Google Drive...' : 'Sign in with Google / Conectar Drive'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const usedBytes = Number(about?.storageQuota?.usage || 0);
  const limitBytes = Number(about?.storageQuota?.limit || 0);
  const usagePct = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white tracking-tight">Google Drive</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Conectado
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono truncate">
              {about?.user?.displayName ? `${about.user.displayName} · ` : ''}
              {about?.user?.emailAddress || driveAccountEmail || 'Conta Google autorizada'}
            </div>
            {limitBytes > 0 && (
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                <span>
                  {formatBytes(about?.storageQuota?.usage)} de {formatBytes(about?.storageQuota?.limit)} usados
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewFolderModal(true)}
            disabled={isBusyAction}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>Nova Pasta</span>
          </button>

          <button
            type="button"
            onClick={() => localUploadRef.current?.click()}
            disabled={isBusyAction}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-lg transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Enviar Arquivo</span>
          </button>
          <input
            ref={localUploadRef}
            type="file"
            onChange={handleLocalFileUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={loadDriveContent}
            disabled={isLoadingFiles}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={disconnectGoogleDrive}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-rose-300 border border-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Desconectar</span>
          </button>
        </div>
      </div>

      {/* Save Current Terminal Dataset to Drive */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Salvar Base Atual do Terminal em "{currentFolder.name}"</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {(filteredStocks.length > 0 ? filteredStocks : stocks).length} ações disponíveis para backup direto na pasta selecionada do Google Drive
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSaveDatasetToDrive('xlsx')}
            disabled={isBusyAction || (stocks.length === 0 && filteredStocks.length === 0)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Salvar Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={() => handleSaveDatasetToDrive('csv')}
            disabled={isBusyAction || (stocks.length === 0 && filteredStocks.length === 0)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>Salvar CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleSaveDatasetToDrive('json')}
            disabled={isBusyAction || (stocks.length === 0 && filteredStocks.length === 0)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <FileIcon className="w-3.5 h-3.5 text-purple-400" />
            <span>Backup JSON</span>
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

      {/* Search, Breadcrumbs & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-950/50">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-xs flex-wrap">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(idx)}
                  className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    idx === breadcrumbs.length - 1
                      ? 'bg-slate-800 text-white font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar no Google Drive..."
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="inline-flex p-0.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px]">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'spreadsheets', label: 'Planilhas' },
                  { id: 'folders', label: 'Pastas' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    filterType === tab.id
                      ? 'bg-slate-800 text-cyan-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* File Table */}
        {isLoadingFiles ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
            <span>Carregando arquivos do Google Drive...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <Folder className="w-8 h-8 text-slate-700 mx-auto" />
            <div>Nenhum arquivo encontrado nesta visualização.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 bg-slate-950/40">
                  <th className="py-3 px-4 font-semibold">Nome</th>
                  <th className="py-3 px-3 font-semibold hidden sm:table-cell">Tipo</th>
                  <th className="py-3 px-3 font-semibold hidden md:table-cell">Tamanho</th>
                  <th className="py-3 px-3 font-semibold hidden lg:table-cell">Modificado</th>
                  <th className="py-3 px-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {files.map((file) => {
                  const folderItem = isFolder(file.mimeType);
                  const importable = isImportableB3Spreadsheet(file);
                  return (
                    <tr key={file.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {folderItem ? (
                            <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : importable ? (
                            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <FileIcon className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          {folderItem ? (
                            <button
                              type="button"
                              onClick={() => handleOpenFolder(file)}
                              className="font-semibold text-white hover:text-amber-300 truncate text-left cursor-pointer"
                            >
                              {file.name}
                            </button>
                          ) : (
                            <span className="font-medium text-slate-200 truncate">{file.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 hidden sm:table-cell text-slate-400 font-mono text-[11px]">
                        {getMimeBadge(file.mimeType)}
                      </td>
                      <td className="py-3 px-3 hidden md:table-cell text-slate-400 font-mono text-[11px]">
                        {folderItem ? '-' : formatBytes(file.size)}
                      </td>
                      <td className="py-3 px-3 hidden lg:table-cell text-slate-400 font-mono text-[11px]">
                        {file.modifiedTime
                          ? new Date(file.modifiedTime).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {isAdmin && importable && (
                            <button
                              type="button"
                              onClick={() => {
                                setImportTarget(file);
                                setImportMode('merge');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-md font-semibold text-[11px] cursor-pointer"
                              title="Importar esta planilha para a base de ativos B3"
                            >
                              <Database className="w-3 h-3" />
                              <span>Importar B3</span>
                            </button>
                          )}

                          {!folderItem && (
                            <button
                              type="button"
                              onClick={() => handleDownloadDriveFile(file)}
                              className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-md cursor-pointer"
                              title="Baixar arquivo"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md"
                              title="Abrir no Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenActivity(file)}
                            className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-slate-800 rounded-md cursor-pointer"
                            title="Ver histórico de atividades"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRenameTarget(file);
                              setRenameDraft(file.name);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-md cursor-pointer"
                            title="Renomear"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmModal({ type: 'trash', file })}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md cursor-pointer"
                            title="Mover para lixeira ou excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <form
            onSubmit={handleCreateFolderSubmit}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-amber-400" />
                <span>Nova Pasta no Google Drive</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Nome da Pasta em "{currentFolder.name}"
              </label>
              <input
                type="text"
                required
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ex: B3 AlphaTerminal Backups"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isBusyAction}
                className="px-4 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg cursor-pointer disabled:opacity-50"
              >
                {isBusyAction ? 'Criando...' : 'Criar Pasta'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Draft Modal (leads to explicit confirmation dialog) */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!renameDraft.trim() || renameDraft.trim() === renameTarget.name) return;
              const target = renameTarget;
              const nextName = renameDraft.trim();
              setRenameTarget(null);
              setConfirmModal({ type: 'rename', file: target, newName: nextName });
            }}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Renomear no Google Drive</span>
              </h3>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Novo nome para "{renameTarget.name}"</label>
              <input
                type="text"
                required
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-cyan-400"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg cursor-pointer"
              >
                Continuar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mandatory Explicit Confirmation Modal for Destructive/Mutating Drive API Operations */}
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
                  {confirmModal.type === 'trash' && 'Mover arquivo para a Lixeira do Google Drive?'}
                  {confirmModal.type === 'delete_permanent' && 'Excluir arquivo permanentemente do Google Drive?'}
                  {confirmModal.type === 'rename' && 'Confirmar alteração de nome no Google Drive?'}
                  {confirmModal.type === 'overwrite_upload' && 'Substituir arquivo existente no Google Drive?'}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {confirmModal.type === 'trash' &&
                    `O item "${confirmModal.file.name}" será movido para a lixeira da sua conta Google Drive.`}
                  {confirmModal.type === 'delete_permanent' &&
                    `Atenção: "${confirmModal.file.name}" será excluído permanentemente e não poderá ser recuperado.`}
                  {confirmModal.type === 'rename' &&
                    `O arquivo "${confirmModal.file.name}" será renomeado para "${confirmModal.newName}".`}
                  {confirmModal.type === 'overwrite_upload' &&
                    `Já existe um arquivo chamado "${confirmModal.fileName}" nesta pasta. Deseja sobrescrever o conteúdo dele no Google Drive?`}
                </p>
              </div>
            </div>

            {confirmModal.type === 'trash' && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setConfirmModal({ type: 'delete_permanent', file: confirmModal.file })
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

      {/* Admin Spreadsheet Import Modal */}
      {importTarget && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Importar Planilha do Google Drive</span>
              </h3>
              <button
                type="button"
                onClick={() => setImportTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="text-slate-400">Arquivo selecionado:</div>
              <div className="font-mono font-bold text-white break-all">{importTarget.name}</div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="drive-import-mode"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="mt-0.5 accent-emerald-400"
                />
                <div>
                  <div className="font-bold text-white">Mesclar e Atualizar (Recomendado)</div>
                  <div className="text-[11px] text-slate-400">
                    Atualiza os ativos existentes sem remover ações já presentes na base.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="drive-import-mode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="mt-0.5 accent-emerald-400"
                />
                <div>
                  <div className="font-bold text-white">Substituir Base Completa</div>
                  <div className="text-[11px] text-slate-400">
                    Limpa a base atual e carrega apenas os ativos desta planilha do Drive.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-emerald-500/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoUpdateOnline}
                  onChange={(e) => setAutoUpdateOnline(e.target.checked)}
                  disabled={isBusyAction}
                  className="mt-0.5 accent-emerald-400"
                />
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Atualizar dados pela internet</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Consulta automaticamente cotações e múltiplos reais no Fundamentus, Investidor10 e Brapi.
                  </div>
                </div>
              </label>
            </div>

            {onlineImportProgress && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-emerald-300 font-medium">
                  <span>Buscando dados online...</span>
                  <span className="font-mono">
                    {onlineImportProgress.processed}/{onlineImportProgress.total} ({onlineImportProgress.updatedCount} OK)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{
                      width: `${onlineImportProgress.total > 0 ? Math.round((onlineImportProgress.processed / onlineImportProgress.total) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setImportTarget(null)}
                disabled={isBusyAction}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImportDriveSpreadsheet}
                disabled={isBusyAction}
                className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg cursor-pointer disabled:opacity-50"
              >
                {onlineImportProgress
                  ? `Atualizando (${onlineImportProgress.processed}/${onlineImportProgress.total})...`
                  : isBusyAction
                  ? 'Importando...'
                  : 'Confirmar Importação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Inspector Modal */}
      {activityTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <span>Atividades Recentes</span>
              </h3>
              <button
                type="button"
                onClick={() => setActivityTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs font-mono text-slate-300 truncate">{activityTarget.name}</div>
            {isLoadingActivity ? (
              <div className="py-6 text-center text-xs text-slate-400">Consultando histórico...</div>
            ) : activityList.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Nenhuma atividade recente registrada para este arquivo.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {activityList.map((act, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">{act.actionLabel}</div>
                      <div className="text-[11px] text-slate-400">{act.actorLabel}</div>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {act.timestamp ? new Date(act.timestamp).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
