import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  RefreshCw,
  FileType,
  ClipboardPaste,
  FileText,
  Shield,
  Lock,
  HardDrive,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StockData } from '../types/stock';
import { readExcelFile, readCSVFile, parseCSVText, exportToExcel, exportToCSV } from '../utils/excelParser';
import { DEFAULT_B3_DATA } from '../data/defaultB3Data';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (data: StockData[], sourceName: string, mode: 'merge' | 'replace') => void;
  onResetToDefault: () => void;
  onOpenGoogleDrive?: () => void;
  currentStockCount?: number;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
  onResetToDefault,
  onOpenGoogleDrive,
  currentStockCount = 58,
}) => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ count: number; name: string } | null>(null);
  const [csvText, setCsvText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    if (!isAdmin) {
      setErrorMessage('Permissão negada. Apenas administradores podem carregar ou atualizar a base de ativos.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      const fileNameLower = file.name.toLowerCase();
      let data: StockData[] = [];

      if (fileNameLower.endsWith('.csv')) {
        const result = await readCSVFile(file);
        data = result.data;
      } else {
        const result = await readExcelFile(file);
        data = result.data;
      }

      if (data.length === 0) {
        throw new Error('Nenhum registro válido foi encontrado no arquivo. Verifique se os cabeçalhos correspondem ao padrão da B3/Status Invest/Fundamentus.');
      }

      setSuccessInfo({ count: data.length, name: file.name });
      onDataLoaded(data, file.name, importMode);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Falha ao processar o arquivo. Certifique-se de que é um arquivo CSV ou Excel válido.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPastedCSV = () => {
    if (!isAdmin) {
      setErrorMessage('Permissão negada. Apenas administradores podem carregar ou atualizar a base de ativos.');
      return;
    }

    if (!csvText.trim()) {
      setErrorMessage('Por favor, cole o texto do arquivo CSV no campo abaixo.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      const data = parseCSVText(csvText);
      if (data.length === 0) {
        throw new Error('Nenhuma empresa válida encontrada no texto colado. Verifique o cabeçalho e delimitador.');
      }

      setSuccessInfo({ count: data.length, name: 'Texto CSV Colado' });
      onDataLoaded(data, 'Dados CSV Colados', importMode);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao processar dados CSV.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleProcessFile(file);
    }
  };

  const handleDownloadExcelTemplate = () => {
    exportToExcel(DEFAULT_B3_DATA.slice(0, 15), 'modelo_empresas_b3.xlsx');
  };

  const handleDownloadCSVTemplate = () => {
    exportToCSV(DEFAULT_B3_DATA.slice(0, 15), 'modelo_empresas_b3.csv');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Atualizar Análise: Upload de Arquivo CSV ou Excel
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Non-Admin Restriction Message */}
        {!isAdmin ? (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Shield className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">Carregamento Restrito a Administradores</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                O carregamento, substituição e atualização de arquivos Excel (.xlsx) ou CSV com a base de ativos é uma função exclusiva de administradores autorizados.
              </p>
            </div>
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 max-w-md mx-auto text-left space-y-1">
              <div className="font-semibold text-slate-200">Como atualizar os dados?</div>
              <p className="text-slate-400 text-[11px]">
                Envie o arquivo desejado para um administrador do B3 AlphaTerminal Pro para que a base seja atualizada.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadExcelTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Baixar Modelo Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadCSVTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span>Baixar Modelo CSV (.csv)</span>
              </button>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Selection */}
            <div className="flex border-b border-slate-800 bg-slate-950/60 p-1 gap-1">
              <button
                onClick={() => setActiveTab('file')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'file'
                    ? 'bg-slate-800 text-emerald-400 shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Arquivo CSV ou Excel (.xlsx / .csv)</span>
              </button>
              <button
                onClick={() => setActiveTab('paste')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'paste'
                    ? 'bg-slate-800 text-emerald-400 shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Colar Texto CSV</span>
              </button>
              {onOpenGoogleDrive && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGoogleDrive();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all text-cyan-300 hover:bg-slate-800 hover:text-cyan-200 cursor-pointer"
                >
                  <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Google Drive</span>
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Mode Selector: Merge vs Replace */}
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
              Comportamento do Upload na Base de Ativos:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`p-2.5 rounded-md border text-left transition-all ${
                  importMode === 'merge'
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Atualizar &amp; Mesclar (Upsert)</span>
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                    Recomendado
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Atualiza cotações e múltiplos das ações pelo Ticker e insere novos ativos. <strong className="text-slate-200">Zero duplicações: cada ação é mantida de forma única.</strong>
                </p>
              </button>

              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`p-2.5 rounded-md border text-left transition-all ${
                  importMode === 'replace'
                    ? 'bg-amber-500/10 border-amber-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Substituir Base Completa</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {currentStockCount > 0
                    ? `Substitui todos os ${currentStockCount} ativos da base exclusivamente pelas empresas deste arquivo importado.`
                    : 'Carrega os ativos deste arquivo como a base exclusiva do terminal.'}
                </p>
              </button>
            </div>
          </div>

          {activeTab === 'file' ? (
            <>
              <p className="text-xs text-slate-300 leading-relaxed">
                Carregue seu arquivo <code className="text-emerald-400 font-mono">.csv</code> ou{' '}
                <code className="text-emerald-400 font-mono">empresas.xlsx</code> exportado de ferramentas como
                Status Invest, Fundamentus, Economatica ou seu modelo próprio. Delimitadores por ponto-e-vírgula (<code className="text-slate-400 font-mono">;</code>) e vírgula (<code className="text-slate-400 font-mono">,</code>) são detectados automaticamente.
              </p>

              {/* Drag & Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-950/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {loading ? 'Processando dados...' : 'Arraste seu arquivo CSV ou Excel aqui'}
                  </span>
                  <span className="text-xs text-slate-400">
                    Suporta arquivos <strong className="text-emerald-400">.csv</strong> e <strong className="text-emerald-400">.xlsx</strong>
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Copie os dados da sua planilha ou do portal financeiro e cole no campo abaixo:
              </p>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={7}
                placeholder="Papel;Cotação;P/L;P/VP;Div.Yield;ROIC;ROE;Liq.2meses;Patrim. Líq&#10;PETR4;38,45;4,82;1,15;14,8%;26,4%;23,8%;1850000000;412000000000&#10;VALE3;62,80;6,15;1,42;9,6%;21,8%;23,1%;1620000000;205000000000"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-md font-mono text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500"
              />
              <button
                onClick={handleProcessPastedCSV}
                disabled={loading || !csvText.trim()}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-md transition-colors"
              >
                {loading ? 'Processando...' : 'Processar e Atualizar Análise'}
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successInfo && (
            <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                Sucesso! <strong>{successInfo.count}</strong> empresas carregadas de{' '}
                <em>{successInfo.name}</em>.
              </span>
            </div>
          )}

          {/* Template download & defaults */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadCSVTemplate}
                className="inline-flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Modelo CSV</span>
              </button>
              <button
                onClick={handleDownloadExcelTemplate}
                className="inline-flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Modelo .xlsx</span>
              </button>
            </div>

            {currentStockCount > 0 && (
              <button
                onClick={() => {
                  onResetToDefault();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 text-rose-300 hover:text-rose-100 transition-colors"
                title="Limpar todos os ativos da base de dados"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Limpar Base (Zerar)</span>
              </button>
            )}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};
