import React, { useState, useEffect, useMemo } from 'react';
import {
  StockIndicator,
  StockData,
  RankingWeights,
  CustomAlert,
  FilterState,
  ActiveSection,
} from './types/stock';
import {
  getStoredStocks,
  saveStocks,
  resetToInitialStocks,
  exportStocksToCSV,
  exportStocksToExcel,
} from './services/storageService';
import { calculateRankings, DEFAULT_WEIGHTS } from './utils/financialCalculations';
import { unifyStock, UnifiedStock } from './utils/stockUnification';
import { Header } from './components/Header';
import { SidebarFilters } from './components/SidebarFilters';
import { Top10Showcase } from './components/Top10Showcase';
import { OverviewSection } from './components/OverviewSection';
import { ValuationSection } from './components/ValuationSection';
import { ProfitabilitySection } from './components/ProfitabilitySection';
import { DebtSection } from './components/DebtSection';
import { GrowthSection } from './components/GrowthSection';
import { StockSpreadsheet } from './components/StockSpreadsheet';
import { AINewsSection } from './components/AINewsSection';
import { InstitutionalFlowTracker } from './components/InstitutionalFlowTracker';
import { AITrendForecast } from './components/AITrendForecast';
import { CustomPortfolioManager } from './components/CustomPortfolioManager';
import { AIPortfolioBuilder } from './components/AIPortfolioBuilder';
import { AlertsManager } from './components/AlertsManager';
import { ExecutiveReportView } from './components/ExecutiveReportView';
import { CompanyModal } from './components/CompanyModal';
import { FileUploadModal } from './components/FileUploadModal';
import { NotificationBanner, ActiveNotification } from './components/NotificationBanner';
import { EmptyState } from './components/EmptyState';
import { LoginModal } from './components/LoginModal';
import { AdminManager } from './components/AdminManager';
import { GoogleDriveManager } from './components/GoogleDriveManager';
import { GmailManager } from './components/GmailManager';
import { AuthGate } from './components/AuthGate';
import { CorrelationMatrix } from './components/CorrelationMatrix';
import { AIStrategyBacktest } from './components/AIStrategyBacktest';
import { useAuth } from './context/AuthContext';
import { exportToExcel, exportToCSV } from './utils/excelParser';
import { DEFAULT_B3_DATA } from './data/defaultB3Data';
import { refreshStocksOnline, TradeSignalResult } from './services/onlineStockUpdater';

const INITIAL_FILTERS: FilterState = {
  search: '',
  setor: 'ALL',
  minPreco: 0,
  maxPreco: 500,
  minLiq2meses: 0,
  minPatrimLiq: 0,
  onlyProfitable: false,
  onlyDividendPayers: false,
  maxDivLiqPatrim: null,
};

export default function App() {
  const { isAdmin } = useAuth();
  const [stocks, setStocks] = useState<UnifiedStock[]>(() => getStoredStocks());
  const [activeTab, setActiveTab] = useState<string>('top10');
  const [previousTab, setPreviousTab] = useState<string>('top10');
  const [weights, setWeights] = useState<RankingWeights>(DEFAULT_WEIGHTS);
  const [selectedStockForAI, setSelectedStockForAI] = useState<UnifiedStock>(
    () => stocks[0] || ({} as UnifiedStock)
  );
  const [selectedCompanyForModal, setSelectedCompanyForModal] = useState<StockData | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [sourceName, setSourceName] = useState(
    () => (stocks.length > 0 ? `Base Carregada (${stocks.length} ações)` : 'Nenhum arquivo carregado (0 ações)')
  );
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [activeNotifications, setActiveNotifications] = useState<ActiveNotification[]>([]);
  const [isRefreshingOnline, setIsRefreshingOnline] = useState(false);
  const [gmailInitialDraft, setGmailInitialDraft] = useState<{
    to?: string;
    subject: string;
    body: string;
  } | null>(null);

  const TAB_LABELS: Record<string, string> = {
    top10: 'Destaques Top 10',
    overview: 'Visão Geral Quant',
    valuation: 'Valuation & Graham/Bazin',
    profitability: 'Rentabilidade & DuPont',
    debt: 'Endividamento & Solvência',
    growth: 'Crescimento & Dividendos',
    spreadsheet: 'Planilha Quant',
    ai_news: 'Radar IA & Fatos Relevantes',
    smartmoney: 'Tubarões & Fluxo',
    'ai-forecast': 'Previsões IA & Trades',
    correlation: 'Matriz de Correlação',
    backtest: 'Backtesting IA vs IBOV',
    'custom-portfolio': 'Minha Carteira',
    portfolios: 'Carteiras IA & Renda',
    alerts: 'Alertas',
    reports: 'Relatórios Executivos',
    drive: 'Google Drive',
    gmail: 'Gmail',
    admin: 'Painel do Administrador',
  };

  // Persistent user alerts
  const [alerts, setAlerts] = useState<CustomAlert[]>(() => {
    try {
      const raw = localStorage.getItem('b3_alpha_terminal_alerts_v1');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [
      {
        id: 'alert_1',
        stockTicker: 'PETR4',
        tipo: 'ponto_entrada',
        valorGatilho: 37.80,
        ativo: true,
        mensagem: 'PETR4 atingiu o Ponto de Entrada técnico ideal em R$ 37,80',
        criadoEm: '03/11/2026',
      },
      {
        id: 'alert_2',
        stockTicker: 'BBAS3',
        tipo: 'acumulacao_tubaroes',
        valorGatilho: 90,
        ativo: true,
        mensagem: 'Forte Acumulação Silenciosa institucional detectada em BBAS3',
        criadoEm: '03/11/2026',
      },
      {
        id: 'alert_3',
        stockTicker: 'VALE3',
        tipo: 'dy_acima',
        valorGatilho: 8.5,
        ativo: true,
        mensagem: 'VALE3 superou Dividend Yield de 8,5%',
        criadoEm: '03/11/2026',
      },
    ];
  });

  // Save alerts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('b3_alpha_terminal_alerts_v1', JSON.stringify(alerts));
    } catch (e) {}
  }, [alerts]);

  // Available unique sectors
  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach((s) => {
      if (s.setor) set.add(s.setor);
    });
    return Array.from(set).sort();
  }, [stocks]);

  // Screener filtered stocks
  const filteredStocks = useMemo(() => {
    return stocks.filter((s) => {
      // 1. Search Query
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase().trim();
        const matchesTicker = s.papel.toLowerCase().includes(query);
        const matchesName = s.nomeEmpresa ? s.nomeEmpresa.toLowerCase().includes(query) : false;
        const matchesSector = s.setor ? s.setor.toLowerCase().includes(query) : false;
        if (!matchesTicker && !matchesName && !matchesSector) {
          return false;
        }
      }
      // 2. Sector Filter
      if (filters.setor !== 'ALL' && s.setor !== filters.setor) {
        return false;
      }
      // 3. Price Range
      if (s.cotacao < filters.minPreco || s.cotacao > filters.maxPreco) {
        return false;
      }
      // 4. Min 2-Month Liquidity
      const liqVal = s.liq2meses || s.liq2m || 0;
      if (liqVal < filters.minLiq2meses) {
        return false;
      }
      // 5. Min Net Worth
      if (s.patrimLiq < filters.minPatrimLiq) {
        return false;
      }
      // 6. Only profitable (P/L > 0)
      if (filters.onlyProfitable && (s.pl === null || s.pl <= 0)) {
        return false;
      }
      // 7. Only dividend payers (DY > 0)
      if (filters.onlyDividendPayers && (s.divYield === null || s.divYield <= 0)) {
        return false;
      }
      // 8. Max Leverage (Dívida Líquida / Patrimônio)
      if (filters.maxDivLiqPatrim !== null) {
        if (s.divLiqPatrim !== null && s.divLiqPatrim > filters.maxDivLiqPatrim) {
          return false;
        }
      }
      return true;
    });
  }, [stocks, filters]);

  // Recalculate rankings whenever weights change
  const handleUpdateWeights = (newWeights: RankingWeights) => {
    setWeights(newWeights);
    const updated = calculateRankings(stocks, newWeights);
    const unified = updated.map((s) => unifyStock(s));
    setStocks(unified);
    saveStocks(unified);
  };

  // Stock CRUD & File Load
  const handleUpdateStock = (updated: StockIndicator) => {
    const unifiedUpdated = unifyStock(updated);
    const nextList = stocks.map((s) => (s.id === unifiedUpdated.id ? unifiedUpdated : s));
    const recalculated = calculateRankings(nextList, weights);
    const unified = recalculated.map((s) => unifyStock(s));
    setStocks(unified);
    saveStocks(unified);

    if (selectedStockForAI.id === unifiedUpdated.id) {
      setSelectedStockForAI(unifiedUpdated);
    }
  };

  const handleApplyTradeSignals = (
    signalMap: Record<string, TradeSignalResult>,
    sourcesUsed: string[] = []
  ) => {
    const entries = Object.keys(signalMap);
    if (entries.length === 0) return;

    const nextList = stocks.map((s) => {
      const key = s.papel.toUpperCase().trim();
      const sig = signalMap[key];
      if (!sig) return s;
      return unifyStock({
        ...s,
        cotacao: sig.cotacao > 0 ? sig.cotacao : s.cotacao,
        pontoEntrada: sig.pontoEntrada,
        stopLoss: sig.stopLoss,
        alvo1CurtoPrazo: sig.alvo1CurtoPrazo,
        alvo2LongoPrazo: sig.alvo2LongoPrazo,
        riscoRetorno: sig.riscoRetorno,
        rsi14: sig.rsi14,
        tendenciaTecnica: sig.tendenciaTecnica,
        padraoGrafico: sig.padraoGrafico,
        suporteTecnico: sig.suporteTecnico,
        resistenciaTecnica: sig.resistenciaTecnica,
        atr14: sig.atr14,
        tradeSignalRecomendacao: sig.tradeSignalRecomendacao,
        tradeSignalSources: sig.tradeSignalSources,
        tradeSignalUpdatedAt: sig.tradeSignalUpdatedAt,
      });
    });

    const recalculated = calculateRankings(nextList, weights);
    const unified = recalculated.map((s) => unifyStock(s));
    setStocks(unified);
    saveStocks(unified);

    if (selectedStockForAI?.papel) {
      const updatedSelected = unified.find(
        (u) => u.papel.toUpperCase() === selectedStockForAI.papel.toUpperCase()
      );
      if (updatedSelected) setSelectedStockForAI(updatedSelected);
    }

    setActiveNotifications((prev) => [
      {
        id: 'notif_' + Date.now(),
        title: 'Sinais Técnicos Atualizados',
        body: `${entries.length} ativos sincronizados com indicações de trade (${sourcesUsed.join(', ') || 'br.investing.com / TradingView'}).`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev.slice(0, 2),
    ]);
  };

  const handleDeleteStock = (id: string) => {
    const nextList = stocks.filter((s) => s.id !== id);
    const recalculated = calculateRankings(nextList, weights);
    const unified = recalculated.map((s) => unifyStock(s));
    setStocks(unified);
    saveStocks(unified);
  };

  const handleDataLoaded = (
    imported: StockData[],
    newSource: string,
    mode: 'merge' | 'replace' = 'merge'
  ) => {
    if (!isAdmin) {
      setActiveNotifications((prev) => [
        {
          id: 'notif_' + Date.now(),
          title: 'Operação Bloqueada',
          body: 'Apenas Administradores têm permissão para carregar ou modificar a base de ativos.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev.slice(0, 2),
      ]);
      return;
    }

    // 1. Strict deduplication of incoming items by Ticker (always take the latest occurrence)
    const importedMap = new Map<string, StockData>();
    for (const item of imported) {
      if (item.papel && item.papel.trim()) {
        const cleanTicker = item.papel.toUpperCase().trim();
        importedMap.set(cleanTicker, { ...item, papel: cleanTicker, id: cleanTicker });
      }
    }

    let mergedList: UnifiedStock[];
    let updatedCount = 0;
    let addedCount = 0;

    if (mode === 'replace') {
      mergedList = Array.from(importedMap.values()).map((s) => unifyStock(s));
      addedCount = mergedList.length;
    } else {
      // Merge & Update (Upsert):
      // Start with current stocks mapped by uppercase ticker
      const stockMap = new Map<string, UnifiedStock>();
      for (const s of stocks) {
        stockMap.set(s.papel.toUpperCase().trim(), s);
      }

      for (const [ticker, importedStock] of importedMap.entries()) {
        const existing = stockMap.get(ticker);
        if (existing) {
          // Update existing stock without losing custom fields
          stockMap.set(ticker, unifyStock({ ...existing, ...importedStock }));
          updatedCount++;
        } else {
          // New stock insertion
          stockMap.set(ticker, unifyStock(importedStock));
          addedCount++;
        }
      }
      mergedList = Array.from(stockMap.values());
    }

    const recalculated = calculateRankings(mergedList, weights);
    const finalUnified = recalculated.map((s) => unifyStock(s));
    setStocks(finalUnified);
    saveStocks(finalUnified);
    setSourceName(`${newSource} (${finalUnified.length} ações)`);
    setFilters(INITIAL_FILTERS);
    if (finalUnified[0]) setSelectedStockForAI(finalUnified[0]);

    // Collect online portal sources if enriched online
    const onlineSourcesSet = new Set<string>();
    let onlineUpdatedCount = 0;
    for (const s of importedMap.values()) {
      if (s.onlineSources && s.onlineSources.length > 0) {
        onlineUpdatedCount++;
        for (const src of s.onlineSources) onlineSourcesSet.add(src);
      }
    }
    const onlineSummaryText =
      onlineUpdatedCount > 0
        ? ` Dados online atualizados para ${onlineUpdatedCount} ativos (${Array.from(onlineSourcesSet).join(', ')}).`
        : '';

    // In-app toast notification informing the exact result
    const notifMessage =
      (mode === 'replace'
        ? `Base substituída com sucesso: ${mergedList.length} ações únicas carregadas.`
        : `Base atualizada: ${updatedCount} ações atualizadas, ${addedCount} novas ações adicionadas. Total de ${finalUnified.length} ações sem duplicatas.`) +
      onlineSummaryText;

    setActiveNotifications((prev) => [
      {
        id: 'notif_' + Date.now(),
        title: 'Upload Concluído com Sucesso',
        body: notifMessage,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev.slice(0, 2),
    ]);
  };

  const handleRefreshAllOnline = async () => {
    if (!isAdmin || stocks.length === 0 || isRefreshingOnline) return;
    setIsRefreshingOnline(true);
    try {
      const summary = await refreshStocksOnline(stocks, { batchSize: 12 });
      const recalculated = calculateRankings(
        summary.stocks.map((s) => unifyStock(s)),
        weights
      );
      const finalUnified = recalculated.map((s) => unifyStock(s));
      setStocks(finalUnified);
      saveStocks(finalUnified);
      if (finalUnified[0]) setSelectedStockForAI(finalUnified[0]);

      setActiveNotifications((prev) => [
        {
          id: 'notif_' + Date.now(),
          title: 'Dados Atualizados pela Internet',
          body:
            summary.updatedCount > 0
              ? `${summary.updatedCount} de ${summary.totalCount} ativos atualizados via ${summary.sourcesUsed.join(', ')}.`
              : 'Nenhuma alteração encontrada nos portais para os ativos atuais.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev.slice(0, 2),
      ]);
    } catch (err) {
      setActiveNotifications((prev) => [
        {
          id: 'notif_' + Date.now(),
          title: 'Erro na Atualização Online',
          body: err instanceof Error ? err.message : 'Não foi possível consultar os portais financeiros.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev.slice(0, 2),
      ]);
    } finally {
      setIsRefreshingOnline(false);
    }
  };

  const handleResetStocks = () => {
    if (!isAdmin) return;
    const fresh = resetToInitialStocks();
    setStocks(fresh);
    setSourceName('Nenhum arquivo carregado (0 ações)');
    setFilters(INITIAL_FILTERS);
    setSelectedStockForAI({} as UnifiedStock);
    setActiveNotifications((prev) => [
      {
        id: 'notif_' + Date.now(),
        title: 'Base de Ativos Limpa',
        body: 'Todos os ativos foram removidos com sucesso. O terminal está pronto para receber seu arquivo CSV ou Excel.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev.slice(0, 2),
    ]);
  };

  // Navigation & Stock Selection
  const handleNavigateTab = (tab: string) => {
    if (tab !== activeTab) {
      setPreviousTab(activeTab);
      setActiveTab(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectStockForAI = (stock: StockIndicator | StockData) => {
    const matched = stocks.find((s) => s.papel === stock.papel) || unifyStock(stock);
    setPreviousTab(activeTab);
    setSelectedStockForAI(matched);
    setActiveTab('ai-forecast');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCompanyModal = (stock: StockData | StockIndicator) => {
    const unified = unifyStock(stock);
    setSelectedCompanyForModal(unified);
  };

  const handleOpenAIForecastFromModal = (stock: StockData) => {
    const matched = stocks.find((s) => s.papel === stock.papel) || unifyStock(stock);
    setSelectedStockForAI(matched);
    setSelectedCompanyForModal(null);
    setActiveTab('ai-forecast');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackFromAI = () => {
    const target = previousTab && previousTab !== 'ai-forecast' ? previousTab : 'top10';
    setActiveTab(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Alert Actions & Push Trigger
  const handleAddAlert = (alert: CustomAlert) => {
    setAlerts((prev) => [alert, ...prev]);
  };

  const handleToggleAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ativo: !a.ativo } : a))
    );
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const triggerNotification = (
    stock: StockIndicator,
    title: string,
    body: string
  ) => {
    // 1. Native Web Push Notification (if permitted)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
          });
        } catch (e) {
          console.warn('Native notification failed:', e);
        }
      }
    }

    // 2. In-App Toast Banner
    const notif: ActiveNotification = {
      id: 'notif_' + Date.now(),
      title,
      body,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setActiveNotifications((prev) => [notif, ...prev.slice(0, 3)]);

    setTimeout(() => {
      setActiveNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    }, 5000);
  };

  const handleDismissNotification = (id: string) => {
    setActiveNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <AuthGate onOpenLoginModal={() => setIsLoginModalOpen(true)}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500/20 selection:text-emerald-400">
        {/* 1. Global Navigation & Action Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleNavigateTab}
        onOpenUploadModal={() => setIsUploadOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onExportExcel={() => exportStocksToExcel(filteredStocks)}
        onExportCSV={() => exportStocksToCSV(filteredStocks)}
        onResetToDefault={handleResetStocks}
        onRefreshOnline={handleRefreshAllOnline}
        isRefreshingOnline={isRefreshingOnline}
        unreadAlertsCount={alerts.filter((a) => a.ativo).length}
        totalStocks={stocks.length}
        filteredStocks={filteredStocks.length}
        sourceName={sourceName}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
      />

      {/* 2. Workspace Layout with Optional Collapsible Quant Screener */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* Collapsible / Responsive Quant Screener Sidebar */}
        {(isSidebarOpen || isMobileSidebarOpen) && (
          <SidebarFilters
            filters={filters}
            onChangeFilters={setFilters}
            onResetFilters={() => setFilters(INITIAL_FILTERS)}
            availableSectors={availableSectors}
            totalCount={stocks.length}
            filteredCount={filteredStocks.length}
            isOpenMobile={isMobileSidebarOpen}
            onCloseMobile={() => {
              setIsMobileSidebarOpen(false);
              setIsSidebarOpen(false);
            }}
          />
        )}

        {/* Central Viewport Content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
          {activeTab === 'admin' ? (
            <AdminManager />
          ) : activeTab === 'drive' ? (
            <GoogleDriveManager
              stocks={stocks}
              filteredStocks={filteredStocks}
              onDataLoaded={handleDataLoaded}
              onNotify={(title, body) => {
                const notif: ActiveNotification = {
                  id: 'notif_' + Date.now(),
                  title,
                  body,
                  timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                };
                setActiveNotifications((prev) => [notif, ...prev.slice(0, 3)]);
                setTimeout(() => {
                  setActiveNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                }, 5000);
              }}
            />
          ) : activeTab === 'gmail' ? (
            <GmailManager
              stocks={stocks}
              filteredStocks={filteredStocks}
              initialDraft={gmailInitialDraft}
              onClearInitialDraft={() => setGmailInitialDraft(null)}
              onNotify={(title, body) => {
                const notif: ActiveNotification = {
                  id: 'notif_' + Date.now(),
                  title,
                  body,
                  timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                };
                setActiveNotifications((prev) => [notif, ...prev.slice(0, 3)]);
                setTimeout(() => {
                  setActiveNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                }, 5000);
              }}
            />
          ) : stocks.length === 0 ? (
            <EmptyState
              onOpenUpload={() => setIsUploadOpen(true)}
              onDownloadExcelTemplate={() => exportToExcel(DEFAULT_B3_DATA.slice(0, 5), 'modelo_empresas_b3.xlsx')}
              onDownloadCSVTemplate={() => exportToCSV(DEFAULT_B3_DATA.slice(0, 5), 'modelo_empresas_b3.csv')}
            />
          ) : (
            <>
              {/* Destaques Top 10 (Ranking Multicritério com Sliders) */}
              {activeTab === 'top10' && (
                <Top10Showcase
                  stocks={filteredStocks}
                  onSelectStockForAI={handleSelectStockForAI}
                  weights={weights}
                  onUpdateWeights={handleUpdateWeights}
                  onOpenCompanyModal={handleOpenCompanyModal}
                  onApplyTradeSignals={handleApplyTradeSignals}
                />
              )}

          {/* Visão Geral do Mercado (Múltiplos Agregados & Distribuições) */}
          {activeTab === 'overview' && (
            <OverviewSection
              stocks={filteredStocks}
              onSelectSection={(sec: ActiveSection) => handleNavigateTab(sec)}
              onSelectStock={handleOpenCompanyModal}
            />
          )}

          {/* Valuation & Graham / Bazin */}
          {activeTab === 'valuation' && (
            <ValuationSection
              stocks={filteredStocks}
              onSelectStock={handleOpenCompanyModal}
            />
          )}

          {/* Rentabilidade & Eficiência DuPont */}
          {activeTab === 'profitability' && (
            <ProfitabilitySection
              stocks={filteredStocks}
              onSelectStock={handleOpenCompanyModal}
            />
          )}

          {/* Endividamento & Solvência */}
          {activeTab === 'debt' && (
            <DebtSection
              stocks={filteredStocks}
              onSelectStock={handleOpenCompanyModal}
            />
          )}

          {/* Crescimento & Histórico de Dividendos */}
          {activeTab === 'growth' && (
            <GrowthSection
              stocks={filteredStocks}
              onSelectStock={handleOpenCompanyModal}
            />
          )}

          {/* Planilha Quant / Tabela Interativa */}
          {activeTab === 'spreadsheet' && (
            <StockSpreadsheet
              stocks={filteredStocks}
              onUpdateStock={handleUpdateStock}
              onDeleteStock={handleDeleteStock}
              onResetStocks={handleResetStocks}
              onExportCSV={() => exportStocksToCSV(filteredStocks)}
              onOpenCSVImport={() => setIsUploadOpen(true)}
              onSelectStockForAI={handleSelectStockForAI}
              onOpenCompanyModal={handleOpenCompanyModal}
            />
          )}

          {/* Radar IA: Fatos Relevantes & Notícias Google Search */}
          {activeTab === 'ai_news' && (
            <AINewsSection
              stocks={filteredStocks}
              onSelectStock={handleOpenCompanyModal}
            />
          )}

          {/* Tubarões & Fluxo Institucional (Wyckoff & Smart Money) */}
          {activeTab === 'smartmoney' && (
            <InstitutionalFlowTracker
              stocks={filteredStocks}
              onSelectStockForAI={handleSelectStockForAI}
            />
          )}

          {/* Previsões IA, Alvos Técnicos & Trades */}
          {activeTab === 'ai-forecast' && (
            <AITrendForecast
              stocks={stocks}
              selectedStock={selectedStockForAI}
              onSelectStock={(s) => setSelectedStockForAI(unifyStock(s))}
              onBack={handleBackFromAI}
              previousTabTitle={TAB_LABELS[previousTab] || 'Destaques Top 10'}
              onApplyTradeSignals={handleApplyTradeSignals}
            />
          )}

          {/* Matriz de Correlação D3 */}
          {activeTab === 'correlation' && (
            <CorrelationMatrix
              stocks={stocks}
              filteredStocks={filteredStocks}
            />
          )}

          {/* Backtesting de Estratégias IA vs IBOV */}
          {activeTab === 'backtest' && (
            <AIStrategyBacktest stocks={stocks} />
          )}

          {/* Minha Carteira */}
          {activeTab === 'custom-portfolio' && (
            <CustomPortfolioManager
              stocks={stocks}
              onBack={handleBackFromAI}
              previousTabTitle={TAB_LABELS[previousTab] || 'Destaques Top 10'}
              onSelectStockForAI={handleSelectStockForAI}
            />
          )}

          {/* Carteiras IA & Simulador Bola de Neve */}
          {activeTab === 'portfolios' && (
            <AIPortfolioBuilder
              stocks={filteredStocks}
              onSelectStockForAI={handleSelectStockForAI}
            />
          )}

          {/* Alertas Customizados & Notificações */}
          {activeTab === 'alerts' && (
            <AlertsManager
              stocks={stocks}
              alerts={alerts}
              onAddAlert={handleAddAlert}
              onToggleAlert={handleToggleAlert}
              onDeleteAlert={handleDeleteAlert}
              onTriggerTestAlert={triggerNotification}
            />
          )}

          {/* Relatórios Executivos para Impressão / PDF */}
          {activeTab === 'reports' && (
            <ExecutiveReportView
              stocks={filteredStocks}
              onExportCSV={() => exportStocksToCSV(filteredStocks)}
              onSendByGmail={() => {
                const top = filteredStocks.slice(0, 10);
                const dateStr = new Date().toLocaleDateString('pt-BR');
                const body = top
                  .map(
                    (s, idx) =>
                      `${idx + 1}. ${s.papel} (${s.nomeEmpresa || s.papel}) - R$ ${Number(
                        s.cotacao
                      )
                        .toFixed(2)
                        .replace('.', ',')} | P/L ${Number(s.pl || 0).toFixed(2)}x | DY ${Number(
                        s.divYield || 0
                      ).toFixed(1)}% | ROIC ${Number(s.roic || 0).toFixed(1)}%`
                  )
                  .join('\n');
                setGmailInitialDraft({
                  subject: `Relatório Executivo B3 AlphaTerminal (${dateStr})`,
                  body: `Relatório Executivo - Top ${top.length} Ações B3 (${dateStr})\n\n${body}`,
                });
                handleNavigateTab('gmail');
              }}
            />
          )}
            </>
          )}
        </main>
      </div>

      {/* 3. Company Raio-X & Valuation Deep Dive Modal */}
      <CompanyModal
        stock={selectedCompanyForModal}
        onClose={() => setSelectedCompanyForModal(null)}
        onOpenAIForecast={handleOpenAIForecastFromModal}
      />

      {/* 4. Universal Excel (.xlsx) and CSV File Ingestion Modal */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDataLoaded={handleDataLoaded}
        onResetToDefault={handleResetStocks}
        onOpenGoogleDrive={() => handleNavigateTab('drive')}
        currentStockCount={stocks.length}
      />

      {/* 5. Member Login & Authentication Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onOpenAdmin={() => handleNavigateTab('admin')}
      />

      {/* 6. In-App Push Notification Toasts */}
      <NotificationBanner
        notifications={activeNotifications}
        onDismiss={handleDismissNotification}
      />
    </div>
    </AuthGate>
  );
}
