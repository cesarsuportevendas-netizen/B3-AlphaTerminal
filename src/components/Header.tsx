import React, { useState } from 'react';
import {
  TrendingUp,
  BarChart3,
  Bell,
  Download,
  Upload,
  Sparkles,
  DollarSign,
  Briefcase,
  FileSpreadsheet,
  Globe,
  Shield,
  Layers,
  Activity,
  Filter,
  RefreshCw,
  ChevronDown,
  User,
  KeyRound,
  HardDrive,
  Mail,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenUploadModal: () => void;
  onOpenLoginModal: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onResetToDefault: () => void;
  onRefreshOnline?: () => void;
  isRefreshingOnline?: boolean;
  unreadAlertsCount: number;
  totalStocks: number;
  filteredStocks: number;
  sourceName?: string;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  count?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenUploadModal,
  onOpenLoginModal,
  onExportExcel,
  onExportCSV,
  onResetToDefault,
  onRefreshOnline,
  isRefreshingOnline = false,
  unreadAlertsCount,
  totalStocks,
  filteredStocks,
  sourceName = 'Aguardando Planilha',
  onToggleSidebar,
  isSidebarOpen,
}) => {
  const { user, userProfile, isAdmin, driveAccessToken, gmailAccessToken } = useAuth();
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const mainCategories: { group: string; items: NavItem[] }[] = [
    {
      group: 'Terminal & Ranking',
      items: [
        { id: 'top10', label: 'Destaques Top 10', icon: TrendingUp },
        { id: 'spreadsheet', label: 'Planilha Quant', icon: FileSpreadsheet },
      ],
    },
    {
      group: 'Análise Fundamentalista',
      items: [
        { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
        { id: 'valuation', label: 'Valuation & Graham/Bazin', icon: Layers },
        { id: 'profitability', label: 'Rentabilidade & DuPont', icon: Activity },
        { id: 'debt', label: 'Endividamento & Solvência', icon: Shield },
        { id: 'growth', label: 'Crescimento & Dividendos', icon: DollarSign },
      ],
    },
    {
      group: 'Inteligência & Mercado',
      items: [
        { id: 'ai_news', label: 'Radar IA & Fatos Relevantes', icon: Globe, badge: 'Google Search' },
        { id: 'smartmoney', label: 'Tubarões & Fluxo', icon: Activity },
        { id: 'ai-forecast', label: 'Previsões IA & Trades', icon: Sparkles },
      ],
    },
    {
      group: 'Gestão & Relatórios',
      items: [
        { id: 'custom-portfolio', label: 'Minha Carteira', icon: Briefcase },
        { id: 'portfolios', label: 'Carteiras IA & Renda', icon: DollarSign },
        { id: 'alerts', label: 'Alertas', icon: Bell, count: unreadAlertsCount },
        { id: 'reports', label: 'Relatórios Executivos', icon: FileSpreadsheet },
        {
          id: 'drive',
          label: 'Google Drive',
          icon: HardDrive,
          badge: driveAccessToken ? 'Ativo' : undefined,
        },
        {
          id: 'gmail',
          label: 'Gmail',
          icon: Mail,
          badge: gmailAccessToken ? 'Ativo' : undefined,
        },
        ...(isAdmin
          ? [{ id: 'admin', label: 'Painel Admin', icon: KeyRound, badge: 'Logins' }]
          : []),
      ],
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      {/* Top Bar: Brand, Global Stats, Filter Toggle, File Ingestion */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 h-16">
        {/* Zone 1: Wordmark & Live Ticker Count */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap">
                B3 AlphaTerminal <span className="text-emerald-400 font-extrabold text-sm">PRO</span>
              </span>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {sourceName}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
              {totalStocks > 0 ? `${filteredStocks} de ${totalStocks} ativos selecionados` : 'Nenhum ativo carregado (0 ações)'}
            </p>
          </div>
        </div>

        {/* Zone 2: Action Controls (Filter Drawer Toggle, Export, Upload) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Screener Filter Toggle */}
          {onToggleSidebar && totalStocks > 0 && (
            <button
              onClick={onToggleSidebar}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                isSidebarOpen
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
              }`}
              title="Filtrar universo por setor, valuation e liquidez"
            >
              <Filter className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Filtros Quant</span>
            </button>
          )}

          {/* Manual Online Market Refresh button (Only Administrators) */}
          {isAdmin && totalStocks > 0 && onRefreshOnline && (
            <button
              onClick={onRefreshOnline}
              disabled={isRefreshingOnline}
              title="Atualizar cotações e múltiplos pela internet (Fundamentus, Investidor10, Brapi)"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-100 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-md transition-colors cursor-pointer disabled:opacity-60"
            >
              <Globe className={`w-3.5 h-3.5 ${isRefreshingOnline ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">
                {isRefreshingOnline ? 'Atualizando...' : 'Atualizar Online'}
              </span>
            </button>
          )}

          {/* Reset/Clear Base button (Only Administrators) */}
          {isAdmin && totalStocks > 0 && (
            <button
              onClick={onResetToDefault}
              title="Limpar todos os ativos da base (Exclusivo Administrador)"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-md transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Limpar Base</span>
            </button>
          )}

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
              title="Exportar dados para Excel ou CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isExportMenuOpen && (
              <div
                className="absolute right-0 mt-1 w-44 bg-slate-900 border border-slate-700 rounded-md shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setIsExportMenuOpen(false)}
              >
                <button
                  onClick={onExportExcel}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-emerald-400 flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Planilha Excel (.xlsx)</span>
                </button>
                <button
                  onClick={onExportCSV}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-emerald-400 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Arquivo CSV (.csv)</span>
                </button>
                <button
                  onClick={() => setActiveTab('drive')}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-cyan-400 flex items-center gap-2 border-t border-slate-800"
                >
                  <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Google Drive</span>
                </button>
                <button
                  onClick={() => setActiveTab('gmail')}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-rose-400 flex items-center gap-2"
                >
                  <Mail className="w-3.5 h-3.5 text-rose-400" />
                  <span>Gmail</span>
                </button>
              </div>
            )}
          </div>

          {/* File Upload Modal Button (Only Administrators) */}
          {isAdmin && (
            <button
              onClick={onOpenUploadModal}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-all shadow-sm shadow-emerald-950/20 whitespace-nowrap cursor-pointer"
              title="Carregar ou atualizar base de ativos (Exclusivo Administrador)"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Carregar Excel / CSV</span>
            </button>
          )}

          {/* Member / Admin Login Button */}
          {(user || userProfile) ? (
            <button
              onClick={onOpenLoginModal}
              className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-600 rounded-md transition-all cursor-pointer"
              title="Gerenciar Conta / Ver Status de Administrador ou Membro"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="w-5 h-5 rounded-full border border-emerald-400/40"
                />
              ) : (
                <div
                  className={`w-5 h-5 rounded-full ${
                    isAdmin
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                      : 'bg-emerald-500/20 text-emerald-400'
                  } flex items-center justify-center text-[10px] font-bold`}
                >
                  {userProfile?.displayName?.[0] || user?.displayName?.[0] || user?.email?.[0] || 'A'}
                </div>
              )}
              <span className="font-semibold text-white max-w-[90px] truncate hidden sm:inline">
                {userProfile?.displayName || user?.displayName || user?.email?.split('@')[0]}
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  isAdmin
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {isAdmin ? 'ADMIN' : 'MEMBRO'}
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 hover:text-white rounded-md transition-all cursor-pointer whitespace-nowrap shadow-xs"
              title="Entrar na Área de Membros"
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Login Membros</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Bar: Full Tabs with Categorized Highlights */}
      <div className="border-t border-slate-800/80 bg-slate-950/80 overflow-x-auto scrollbar-none px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-1 py-1.5">
          {mainCategories.flatMap((cat) => cat.items).map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700/80 font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] px-1 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded font-mono">
                    {item.badge}
                  </span>
                )}
                {item.count !== undefined && item.count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded-full font-mono">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
