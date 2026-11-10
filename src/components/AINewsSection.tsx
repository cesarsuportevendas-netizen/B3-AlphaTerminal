import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  Globe,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  FileText,
  TrendingUp,
  ShieldAlert,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { StockData, AIAnalysisResult } from '../types/stock';
import { formatCurrency, formatPercent, formatNumber } from '../utils/dataCleaner';

interface AINewsSectionProps {
  stocks: StockData[];
  onSelectStock: (stock: StockData) => void;
}

export const AINewsSection: React.FC<AINewsSectionProps> = ({ stocks, onSelectStock }) => {
  const [selectedTicker, setSelectedTicker] = useState<string>(stocks[0]?.papel || 'PETR4');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);

  // Currently selected stock data
  const currentStock = stocks.find((s) => s.papel === selectedTicker) || stocks[0];

  const handleRunAnalysis = async (tickerToAnalyze = selectedTicker) => {
    const targetStock = stocks.find((s) => s.papel === tickerToAnalyze);
    if (!targetStock) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/analyze-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: targetStock.papel,
          companyName: targetStock.nomeEmpresa || targetStock.papel,
          sector: targetStock.setor,
          cotacao: targetStock.cotacao,
          pl: targetStock.pl,
          pvp: targetStock.pvp,
          roic: targetStock.roic,
          roe: targetStock.roe,
          divLiqPatrim: targetStock.divLiqPatrim,
          divYield: targetStock.divYield,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro ${response.status}: Falha ao processar pesquisa com IA.`);
      }

      const data: AIAnalysisResult = await response.json();
      setResult(data);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível conectar ao serviço de inteligência artificial.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Popular high-profile stocks in B3 for quick access
  const popularTickers = ['PETR4', 'VALE3', 'ITUB4', 'WEGE3', 'BBAS3', 'PRIO3', 'EGIE3'];

  return (
    <div className="space-y-6">
      {/* 1. Header Card & Quick Select */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Globe className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Radar IA: Fatos Relevantes &amp; Notícias da Bolsa em Tempo Real
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Pesquisa conectada à internet via Google Search para capturar os últimos Fatos Relevantes da CVM,
              comunicados de M&amp;A, dividendos aprovados e notícias macroeconômicas que impactam as ações na B3.
            </p>
          </div>

          {/* Quick Select Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Populares:</span>
            {popularTickers.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setSelectedTicker(t);
                  handleRunAnalysis(t);
                }}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
                  selectedTicker === t
                    ? 'bg-emerald-400 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Stock Selector & Search Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:w-80">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Selecione o Ativo para Análise
            </label>
            <select
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-sm text-white font-mono focus:outline-hidden focus:border-emerald-500"
            >
              {stocks.map((s) => (
                <option key={s.id} value={s.papel}>
                  {s.papel} - {s.nomeEmpresa || s.setor} ({formatCurrency(s.cotacao)})
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-auto self-end">
            <button
              onClick={() => handleRunAnalysis(selectedTicker)}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-md transition-all shadow-sm shadow-emerald-950/30"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Pesquisando na Internet...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analisar {selectedTicker} com IA</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Stock Financial Snapshot Bar */}
      {currentStock && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 font-mono text-xs">
          <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
            <span className="text-[10px] text-slate-500 font-sans block">Cotação Atual</span>
            <span className="text-white font-bold">{formatCurrency(currentStock.cotacao)}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
            <span className="text-[10px] text-slate-500 font-sans block">P/L</span>
            <span className="text-white font-bold">
              {currentStock.pl ? `${formatNumber(currentStock.pl, 1)}x` : '—'}
            </span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
            <span className="text-[10px] text-slate-500 font-sans block">P/VP</span>
            <span className="text-white font-bold">
              {currentStock.pvp ? `${formatNumber(currentStock.pvp, 2)}x` : '—'}
            </span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
            <span className="text-[10px] text-slate-500 font-sans block">ROIC</span>
            <span className="text-emerald-400 font-bold">{formatPercent(currentStock.roic)}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
            <span className="text-[10px] text-slate-500 font-sans block">Dív. Líq / PL</span>
            <span className="text-white font-bold">
              {currentStock.divLiqPatrim !== null ? `${formatNumber(currentStock.divLiqPatrim, 2)}x` : '—'}
            </span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
            <span className="text-[10px] text-slate-500 font-sans block">Dividend Yield</span>
            <span className="text-emerald-400 font-bold">{formatPercent(currentStock.divYield)}</span>
          </div>
        </div>
      )}

      {/* 3. Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <div className="flex-1">
            <span className="font-semibold block">Erro na Pesquisa com IA:</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => handleRunAnalysis(selectedTicker)}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded font-medium"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* 4. Loading State Skeleton */}
      {loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20" />
            <div className="h-4 bg-slate-800 rounded w-1/3" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-slate-800/60 rounded w-full" />
            <div className="h-3 bg-slate-800/60 rounded w-5/6" />
            <div className="h-3 bg-slate-800/60 rounded w-4/6" />
          </div>
          <div className="pt-4 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
            <Globe className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>Consultando notícias recentes e comunicados CVM via Google Search...</span>
          </div>
        </div>
      )}

      {/* 5. Analysis Report */}
      {!loading && result && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold font-mono text-emerald-400">{result.ticker}</span>
              <span className="text-xs text-slate-300 font-medium">{result.companyName}</span>
            </div>
            <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
              <span>Pesquisa realizada em:</span>
              <span className="text-slate-300">
                {new Date(result.timestamp).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          {/* Formatted Markdown Analysis */}
          <div className="prose prose-invert prose-xs max-w-none space-y-4 text-slate-200 leading-relaxed">
            {result.analysis.split('\n\n').map((paragraph, idx) => {
              // Header 3
              if (paragraph.startsWith('### ')) {
                return (
                  <h3
                    key={idx}
                    className="text-sm font-bold text-white border-b border-slate-800/60 pb-1.5 pt-3 tracking-wide flex items-center gap-2"
                  >
                    {paragraph.replace('### ', '')}
                  </h3>
                );
              }
              // Bullet lists
              if (paragraph.includes('\n- ') || paragraph.startsWith('- ')) {
                const items = paragraph.split('\n- ').map((item) => item.replace(/^- /, ''));
                return (
                  <ul key={idx} className="space-y-1.5 list-disc pl-4 text-xs text-slate-300">
                    {items.map((item, itemIdx) => (
                      <li key={itemIdx}>{item}</li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={idx} className="text-xs text-slate-300">
                  {paragraph}
                </p>
              );
            })}
          </div>

          {/* 6. Grounding Sources & Citations */}
          {result.sources && result.sources.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Fontes e Notícias Consultadas na Web</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-slate-950 hover:bg-slate-850 border border-slate-800/80 hover:border-slate-700 p-2.5 rounded-md flex items-center justify-between gap-3 text-xs text-slate-300 transition-colors group"
                  >
                    <span className="truncate group-hover:text-emerald-400 font-medium">
                      {src.title || src.url}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Action Button: Open deep dive */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={() => onSelectStock(currentStock)}
              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              <span>Ver Raio-X Quantitativo Completo de {currentStock.papel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 6. Idle Empty State */}
      {!loading && !result && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm font-bold text-white">
              Pronto para Pesquisar Fatos Relevantes na Internet
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Clique no botão acima para iniciar a varredura em tempo real sobre{' '}
              <strong className="text-emerald-400">{selectedTicker}</strong>. A inteligência artificial
              pesquisa os registros da CVM, notícias setoriais e comunicados de mercado recentes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
