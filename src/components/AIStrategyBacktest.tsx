import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { StockIndicator } from '../types/stock';
import { formatCurrency } from '../utils/financialCalculations';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Calendar,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

type BacktestRange = '3mo' | '6mo' | '1y' | '2y' | '5y' | 'custom';
type StrategyPreset =
  | 'ai_latest'
  | 'alpha_top10'
  | 'renda_passiva'
  | 'greenblatt'
  | 'graham'
  | 'smartmoney';
type RebalanceMode = 'none' | 'monthly';
type ChartViewMode = 'return_pct' | 'equity_brl' | 'drawdown' | 'monthly_alpha';

interface BacktestSeriesPoint {
  date: string;
  portfolioValue: number;
  ibovValue: number;
  portfolioReturnPct: number;
  ibovReturnPct: number;
  excessReturnPct: number;
  portfolioDrawdownPct: number;
  ibovDrawdownPct: number;
}

interface MonthlyAlphaPoint {
  month: string;
  portfolioPct: number;
  ibovPct: number;
  alphaPct: number;
}

interface AssetBreakdownRow {
  ticker: string;
  source: string;
  weightPct: number;
  startPrice: number;
  endPrice: number;
  assetReturnPct: number;
  contributionPct: number;
  finalValue: number;
}

interface BacktestResult {
  strategyName: string;
  range: string;
  startDate: string;
  endDate: string;
  tradingDays: number;
  rebalance: RebalanceMode;
  initialCapital: number;
  failedTickers: string[];
  sourcesUsed: string[];
  metrics: {
    finalPortfolioValue: number;
    finalIbovValue: number;
    portfolioReturnPct: number;
    ibovReturnPct: number;
    alphaPct: number;
    portfolioCagrPct: number;
    ibovCagrPct: number;
    portfolioVolatilityPct: number;
    ibovVolatilityPct: number;
    sharpeRatio: number;
    maxDrawdownPortfolioPct: number;
    maxDrawdownIbovPct: number;
    monthlyWinRatePct: number;
    monthsCount: number;
  };
  series: BacktestSeriesPoint[];
  monthlyComparison: MonthlyAlphaPoint[];
  assetBreakdown: AssetBreakdownRow[];
  updatedAt: string;
}

interface BacktestAIInsight {
  resumoExecutivo: string;
  driversDePerformance: string;
  diagnosticoRisco: string;
  sources: { title: string; url: string }[];
  grounded: boolean;
}

interface AIStrategyBacktestProps {
  stocks: StockIndicator[];
}

const STRATEGY_OPTIONS: { id: StrategyPreset; label: string; desc: string }[] = [
  {
    id: 'ai_latest',
    label: 'Carteira IA Ativa',
    desc: 'Utiliza a última carteira gerada em "Carteiras IA & Renda" (ou síntese IA Renda + ROIC).',
  },
  {
    id: 'alpha_top10',
    label: 'Alpha Top 10 IA',
    desc: 'Top 10 ativos por Score Alpha multicritério ponderado pelo próprio score.',
  },
  {
    id: 'renda_passiva',
    label: 'IA Dividendos & Renda',
    desc: 'Top 8 pagadoras de dividendos sustentáveis com lucros positivos e liquidez.',
  },
  {
    id: 'greenblatt',
    label: 'Fórmula Mágica IA',
    desc: 'Top 8 da combinação Greenblatt (menor P/L positivo + maior ROIC).',
  },
  {
    id: 'graham',
    label: 'Desconto Graham',
    desc: 'Top 8 ações com maior margem de segurança frente ao Preço Justo de Graham.',
  },
  {
    id: 'smartmoney',
    label: 'Smart Money Tubarões',
    desc: 'Top 8 ativos com maior Score de Acumulação Institucional e fluxo estrangeiro.',
  },
];

function readSavedAIPortfolio(): {
  nomeCarteira: string;
  ativos: { papel: string; peso: number }[];
} | null {
  try {
    const raw = localStorage.getItem('b3_alpha_last_ai_portfolio_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.ativos) && parsed.ativos.length >= 2) {
        return {
          nomeCarteira: String(parsed.nomeCarteira || 'Carteira Sugerida IA'),
          ativos: parsed.ativos.map((a: { papel?: string; peso?: number }) => ({
            papel: String(a.papel || '').toUpperCase().trim(),
            peso: Number(a.peso) || 10,
          })),
        };
      }
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

export const AIStrategyBacktest: React.FC<AIStrategyBacktestProps> = ({ stocks }) => {
  const [strategy, setStrategy] = useState<StrategyPreset>('alpha_top10');
  const [range, setRange] = useState<BacktestRange>('1y');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [initialCapital, setInitialCapital] = useState<number>(50000);
  const [rebalance, setRebalance] = useState<RebalanceMode>('monthly');
  const [chartMode, setChartMode] = useState<ChartViewMode>('return_pct');

  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [insight, setInsight] = useState<BacktestAIInsight | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  const savedAIPortfolio = useMemo(() => readSavedAIPortfolio(), [strategy]);

  // Build allocations array based on selected strategy
  const strategyPayload = useMemo(() => {
    const validUniverse = stocks.filter((s) => s.papel && s.cotacao > 0);
    if (validUniverse.length === 0) {
      return {
        name: 'Carteira Padrão B3',
        allocations: [
          { papel: 'PETR4', weight: 20 },
          { papel: 'BBAS3', weight: 20 },
          { papel: 'VALE3', weight: 20 },
          { papel: 'WEGE3', weight: 20 },
          { papel: 'ITUB4', weight: 20 },
        ],
      };
    }

    if (strategy === 'ai_latest' && savedAIPortfolio) {
      return {
        name: savedAIPortfolio.nomeCarteira,
        allocations: savedAIPortfolio.ativos.map((a) => ({
          papel: a.papel,
          weight: a.peso,
        })),
      };
    }

    if (strategy === 'renda_passiva' || strategy === 'ai_latest') {
      const picked = [...validUniverse]
        .filter((s) => s.pl > 0 && s.divYield > 0)
        .sort((a, b) => b.divYield * 0.65 + b.roic * 0.35 - (a.divYield * 0.65 + a.roic * 0.35))
        .slice(0, 8);
      const list = picked.length >= 4 ? picked : validUniverse.slice(0, 8);
      return {
        name: 'IA Dividendos & Renda Perpétua',
        allocations: list.map((s) => ({
          papel: s.papel,
          weight: Math.max(5, Math.round(s.divYield + s.scoreAlpha * 0.15)),
        })),
      };
    }

    if (strategy === 'greenblatt') {
      const byPL = [...validUniverse].sort(
        (a, b) => (a.pl > 0 ? a.pl : 9999) - (b.pl > 0 ? b.pl : 9999)
      );
      const byRoic = [...validUniverse].sort((a, b) => (b.roic || -999) - (a.roic || -999));
      const plMap = new Map(byPL.map((s, i) => [s.papel, i + 1]));
      const roicMap = new Map(byRoic.map((s, i) => [s.papel, i + 1]));
      const picked = [...validUniverse]
        .sort(
          (a, b) =>
            (plMap.get(a.papel) || 999) +
            (roicMap.get(a.papel) || 999) -
            ((plMap.get(b.papel) || 999) + (roicMap.get(b.papel) || 999))
        )
        .slice(0, 8);
      return {
        name: 'Fórmula Mágica (Greenblatt IA)',
        allocations: picked.map((s) => ({ papel: s.papel, weight: 12.5 })),
      };
    }

    if (strategy === 'graham') {
      const picked = [...validUniverse]
        .sort((a, b) => (b.descontoGrahamPerc || -999) - (a.descontoGrahamPerc || -999))
        .slice(0, 8);
      return {
        name: 'Desconto Intrínseco de Graham',
        allocations: picked.map((s) => ({
          papel: s.papel,
          weight: Math.max(5, Math.round(20 + (s.descontoGrahamPerc || 0))),
        })),
      };
    }

    if (strategy === 'smartmoney') {
      const picked = [...validUniverse]
        .sort((a, b) => (b.smartMoneyScore || 0) - (a.smartMoneyScore || 0))
        .slice(0, 8);
      return {
        name: 'Smart Money & Fluxo Tubarões',
        allocations: picked.map((s) => ({
          papel: s.papel,
          weight: Math.max(10, s.smartMoneyScore || 50),
        })),
      };
    }

    // alpha_top10
    const picked = [...validUniverse]
      .sort((a, b) => (b.scoreAlpha || 0) - (a.scoreAlpha || 0))
      .slice(0, 10);
    return {
      name: 'Alpha Geral Top 10 IA',
      allocations: picked.map((s) => ({
        papel: s.papel,
        weight: Math.max(5, s.scoreAlpha || 60),
      })),
    };
  }, [stocks, strategy, savedAIPortfolio]);

  const fetchBacktestInsights = async (bt: BacktestResult) => {
    setIsLoadingInsight(true);
    try {
      const res = await fetch('/api/ai/backtest-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyName: bt.strategyName,
          startDate: bt.startDate,
          endDate: bt.endDate,
          metrics: bt.metrics,
          assetBreakdown: bt.assetBreakdown,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as BacktestAIInsight;
        setInsight(json);
      }
    } catch {
      // Non-blocking insight
    } finally {
      setIsLoadingInsight(false);
    }
  };

  const runBacktest = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setInsight(null);
    try {
      const bodyPayload: Record<string, unknown> = {
        strategyName: strategyPayload.name,
        allocations: strategyPayload.allocations,
        range: range === 'custom' ? '1y' : range,
        initialCapital,
        rebalance,
      };
      if (range === 'custom') {
        bodyPayload.startDate = startDate;
        bodyPayload.endDate = endDate;
      }

      const res = await fetch('/api/stocks/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Não foi possível simular o backtesting histórico.');
      }
      const typed = json as BacktestResult;
      setResult(typed);
      fetchBacktestInsights(typed);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao consultar dados históricos para backtesting.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (range !== 'custom') {
      runBacktest();
    }
  }, [strategy, range, rebalance]);

  const totalInputWeight = useMemo(
    () => strategyPayload.allocations.reduce((s, a) => s + a.weight, 0) || 1,
    [strategyPayload]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono uppercase tracking-wider mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Simulador Quantitativo Histórico</span>
            <span aria-hidden="true">·</span>
            <span>Benchmark Ibovespa (^BVSP)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Backtesting de Estratégias IA vs IBOV
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Teste como as carteiras sugeridas pela IA e pelos modelos quantitativos teriam performado em períodos históricos reais da B3 (preços ajustados por proventos) frente ao Ibovespa.
          </p>
        </div>

        <button
          type="button"
          onClick={runBacktest}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 self-start lg:self-auto"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          <span>{isLoading ? 'Simulando Pregões...' : 'Executar Backtest'}</span>
        </button>
      </div>

      {/* Controls Bar */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Strategy Selector */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Estratégia / Carteira IA
            </label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as StrategyPreset)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
            >
              {STRATEGY_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                  {opt.id === 'ai_latest' && savedAIPortfolio
                    ? ` (${savedAIPortfolio.ativos.length} ativos)`
                    : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              {STRATEGY_OPTIONS.find((o) => o.id === strategy)?.desc}
            </p>
          </div>

          {/* Historical Period Selector */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Período Histórico
            </label>
            <div className="flex items-center flex-wrap gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono">
              {(
                [
                  { id: '3mo', label: '3M' },
                  { id: '6mo', label: '6M' },
                  { id: '1y', label: '1A' },
                  { id: '2y', label: '2A' },
                  { id: '5y', label: '5A' },
                  { id: 'custom', label: 'Datas' },
                ] as { id: BacktestRange; label: string }[]
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRange(r.id)}
                  className={`px-2 py-1 rounded font-semibold transition-colors cursor-pointer ${
                    range === r.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {range === 'custom' && (
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-slate-200"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-slate-200"
                />
              </div>
            )}
          </div>

          {/* Initial Capital */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Capital Inicial Simulado (R$)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1000}
                step={5000}
                value={initialCapital}
                onChange={(e) => setInitialCapital(Math.max(1000, Number(e.target.value) || 50000))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-mono">
              {[25000, 50000, 100000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setInitialCapital(v)}
                  className={`px-2 py-0.5 rounded border cursor-pointer ${
                    initialCapital === v
                      ? 'bg-slate-800 text-emerald-400 border-slate-600'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  R$ {(v / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
          </div>

          {/* Rebalancing */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Regra de Rebalanceamento
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setRebalance('monthly')}
                className={`py-1.5 px-2 rounded font-medium cursor-pointer transition-colors ${
                  rebalance === 'monthly'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setRebalance('none')}
                className={`py-1.5 px-2 rounded font-medium cursor-pointer transition-colors ${
                  rebalance === 'none'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Buy & Hold
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {rebalance === 'monthly'
                ? 'Reequilibra os pesos-alvo no 1º pregão de cada mês.'
                : 'Mantém alocação inicial intacta durante todo o período.'}
            </p>
          </div>
        </div>

        {/* Active Composition Strip */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center flex-wrap gap-2 text-xs font-mono">
          <span className="text-slate-400 font-sans font-medium">Composição da Estratégia:</span>
          {strategyPayload.allocations.map((a) => (
            <span
              key={a.papel}
              className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-200"
            >
              {a.papel}{' '}
              <span className="text-emerald-400">
                {((a.weight / totalInputWeight) * 100).toFixed(0)}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Loading / Error / Result States */}
      {isLoading && !result ? (
        <div className="p-12 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm font-semibold text-slate-200">
            Executando backtest histórico ({strategyPayload.name}) vs Ibovespa...
          </p>
          <p className="text-xs text-slate-400">
            Consultando fechamentos ajustados reais (Yahoo Finance / Brapi) e computando curva patrimonial diária.
          </p>
        </div>
      ) : errorMsg ? (
        <div className="p-6 rounded-xl bg-slate-900 border border-rose-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <div className="text-sm font-semibold text-rose-300">Erro ao simular backtest</div>
            <p className="text-xs text-slate-300">{errorMsg}</p>
            <button
              type="button"
              onClick={runBacktest}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg border border-slate-700 cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ) : result ? (
        <>
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                Retorno Acumulado ({result.tradingDays} pregões)
              </div>
              <div
                className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                  result.metrics.portfolioReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {result.metrics.portfolioReturnPct >= 0 ? '+' : ''}
                {result.metrics.portfolioReturnPct.toFixed(2)}%
              </div>
              <div className="text-xs text-slate-300 font-mono mt-1">
                IBOV: {result.metrics.ibovReturnPct >= 0 ? '+' : ''}
                {result.metrics.ibovReturnPct.toFixed(2)}% ·{' '}
                <span
                  className={
                    result.metrics.alphaPct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'
                  }
                >
                  Alpha {result.metrics.alphaPct >= 0 ? '+' : ''}
                  {result.metrics.alphaPct.toFixed(2)} p.p.
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                Patrimônio Final Simulado
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                {formatCurrency(result.metrics.finalPortfolioValue)}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-1">
                vs IBOV {formatCurrency(result.metrics.finalIbovValue)} · CAGR{' '}
                <span className="text-cyan-300">{result.metrics.portfolioCagrPct.toFixed(1)}% a.a.</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                Índice de Sharpe & Volatilidade
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-cyan-300 mt-1">
                {result.metrics.sharpeRatio.toFixed(2)}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-1">
                Volatilidade: {result.metrics.portfolioVolatilityPct.toFixed(1)}% · IBOV{' '}
                {result.metrics.ibovVolatilityPct.toFixed(1)}%
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                Drawdown Máximo & Win Rate
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-300 mt-1">
                {result.metrics.maxDrawdownPortfolioPct.toFixed(2)}%
              </div>
              <div className="text-xs text-slate-400 font-mono mt-1">
                IBOV DD: {result.metrics.maxDrawdownIbovPct.toFixed(2)}% · Superou IBOV em{' '}
                <span className="text-emerald-400 font-bold">
                  {result.metrics.monthlyWinRatePct}%
                </span>{' '}
                dos meses
              </div>
            </div>
          </div>

          {result.failedTickers.length > 0 && (
            <div className="text-xs font-mono text-amber-300 bg-slate-900 border border-amber-500/30 rounded-lg px-3.5 py-2">
              Tickers sem histórico completo neste intervalo removidos da simulação: {result.failedTickers.join(', ')}
            </div>
          )}

          {/* Dynamic Line Chart Panel */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>
                    {chartMode === 'return_pct' && 'Curva de Retorno Acumulado (%) — Estratégia IA vs IBOV'}
                    {chartMode === 'equity_brl' && 'Evolução Patrimonial (R$) — Estratégia IA vs IBOV'}
                    {chartMode === 'drawdown' && 'Queda Máxima Histórica (Drawdown %) — Carteira vs IBOV'}
                    {chartMode === 'monthly_alpha' && 'Excess Return Mensal (Alpha vs IBOV em p.p.)'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Período: {result.startDate} até {result.endDate} · Fontes:{' '}
                  {result.sourcesUsed.join(' · ')}
                  {isLoading && ' · Atualizando...'}
                </p>
              </div>

              <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                {(
                  [
                    { id: 'return_pct', label: 'Retorno %' },
                    { id: 'equity_brl', label: 'Patrimônio R$' },
                    { id: 'drawdown', label: 'Drawdown' },
                    { id: 'monthly_alpha', label: 'Alpha Mensal' },
                  ] as { id: ChartViewMode; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setChartMode(tab.id)}
                    className={`px-2.5 py-1.5 rounded font-medium cursor-pointer transition-colors ${
                      chartMode === tab.id
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[340px] w-full bg-slate-950 rounded-xl border border-slate-800/80 p-3">
              {chartMode === 'return_pct' && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.series} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(v) => String(v).slice(2)}
                      minTickGap={28}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(v) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(0)}%`}
                    />
                    <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                      formatter={(value: unknown, name: unknown) => {
                        const num = Number(value) || 0;
                        const lbl =
                          name === 'portfolioReturnPct'
                            ? result.strategyName
                            : name === 'ibovReturnPct'
                            ? 'Ibovespa (^BVSP)'
                            : 'Alpha (Excesso)';
                        return [`${num >= 0 ? '+' : ''}${num.toFixed(2)}%`, lbl];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="portfolioReturnPct"
                      name="portfolioReturnPct"
                      stroke="#10b981"
                      strokeWidth={2.4}
                      dot={false}
                      activeDot={{ r: 4, fill: '#10b981' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ibovReturnPct"
                      name="ibovReturnPct"
                      stroke="#94a3b8"
                      strokeWidth={1.8}
                      strokeDasharray="5 3"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="excessReturnPct"
                      name="excessReturnPct"
                      stroke="#38bdf8"
                      strokeWidth={1.3}
                      dot={false}
                      opacity={0.75}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {chartMode === 'equity_brl' && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.series} margin={{ top: 10, right: 16, left: 10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(v) => String(v).slice(2)}
                      minTickGap={28}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(v) => `R$ ${(Number(v) / 1000).toFixed(0)}k`}
                    />
                    <ReferenceLine
                      y={result.initialCapital}
                      stroke="#475569"
                      strokeDasharray="3 3"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                      formatter={(value: unknown, name: unknown) => [
                        formatCurrency(Number(value) || 0),
                        name === 'portfolioValue' ? result.strategyName : 'Ibovespa (^BVSP)',
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="portfolioValue"
                      stroke="#10b981"
                      strokeWidth={2.4}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="ibovValue"
                      stroke="#94a3b8"
                      strokeWidth={1.8}
                      strokeDasharray="5 3"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {chartMode === 'drawdown' && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.series} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(v) => String(v).slice(2)}
                      minTickGap={28}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                      formatter={(value: unknown, name: unknown) => [
                        `${Number(value).toFixed(2)}%`,
                        name === 'portfolioDrawdownPct'
                          ? 'Drawdown Carteira'
                          : 'Drawdown IBOV',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="portfolioDrawdownPct"
                      stroke="#f43f5e"
                      fill="#f43f5e"
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="ibovDrawdownPct"
                      stroke="#94a3b8"
                      fill="#94a3b8"
                      fillOpacity={0.08}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {chartMode === 'monthly_alpha' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={result.monthlyComparison}
                    margin={{ top: 10, right: 16, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(v) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(0)}%`}
                    />
                    <ReferenceLine y={0} stroke="#475569" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                      formatter={(value: unknown) => {
                        const n = Number(value) || 0;
                        return [`${n >= 0 ? '+' : ''}${n.toFixed(2)} p.p.`, 'Alpha vs IBOV'];
                      }}
                    />
                    <Bar dataKey="alphaPct" radius={[4, 4, 0, 0]}>
                      {result.monthlyComparison.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.alphaPct >= 0 ? '#10b981' : '#f43f5e'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Chart Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                  <span className="text-slate-200">{result.strategyName}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-slate-400 border-t border-dashed inline-block" />
                  <span>Ibovespa (^BVSP)</span>
                </span>
                {chartMode === 'return_pct' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-sky-400 inline-block" />
                    <span>Alpha Acumulado (p.p.)</span>
                  </span>
                )}
              </div>
              <span>Preços ajustados por dividendos & proventos</span>
            </div>
          </div>

          {/* AI Search Grounding Analysis of the Backtest + Asset Contribution Table */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left: AI Diagnostics with Google Search Grounding */}
            <div className="xl:col-span-5 p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">
                    Diagnóstico IA & Contexto de Mercado
                  </h3>
                </div>
                {insight?.grounded && (
                  <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    <span>Google Search</span>
                  </span>
                )}
              </div>

              {isLoadingInsight ? (
                <div className="py-8 text-center space-y-2">
                  <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">
                    Cruzando performance histórica com eventos macro e setoriais via Google Search...
                  </p>
                </div>
              ) : insight ? (
                <div className="space-y-3 text-xs leading-relaxed">
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="font-mono text-[11px] uppercase text-emerald-400 font-semibold">
                      Resumo Executivo
                    </div>
                    <p className="text-slate-200">{insight.resumoExecutivo}</p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="font-mono text-[11px] uppercase text-cyan-400 font-semibold">
                      Vetores de Performance (Drivers)
                    </div>
                    <p className="text-slate-300">{insight.driversDePerformance}</p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="font-mono text-[11px] uppercase text-amber-300 font-semibold">
                      Diagnóstico Risco / Retorno
                    </div>
                    <p className="text-slate-300">{insight.diagnosticoRisco}</p>
                  </div>

                  {insight.sources && insight.sources.length > 0 && (
                    <div className="pt-2 border-t border-slate-800 space-y-1">
                      <div className="text-[11px] font-mono text-slate-500 uppercase">
                        Fontes Consultadas:
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {insight.sources.map((src, i) => (
                          <a
                            key={i}
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline truncate max-w-[260px]"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Right: Individual Asset Performance Contribution Table */}
            <div className="xl:col-span-7 p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Atribuição de Performance por Ativo</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {result.assetBreakdown.length} ativos simulados
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                      <th className="py-2.5 pr-3">Ativo</th>
                      <th className="py-2.5 px-2 text-right">Peso</th>
                      <th className="py-2.5 px-2 text-right">Inicial</th>
                      <th className="py-2.5 px-2 text-right">Final</th>
                      <th className="py-2.5 px-2 text-right">Retorno</th>
                      <th className="py-2.5 px-2 text-right">Contrib.</th>
                      <th className="py-2.5 pl-2 text-right">Saldo Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {result.assetBreakdown.map((row) => (
                      <tr key={row.ticker} className="hover:bg-slate-800/30">
                        <td className="py-2.5 pr-3 font-bold text-white">{row.ticker}</td>
                        <td className="py-2.5 px-2 text-right text-slate-300">
                          {row.weightPct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-400">
                          R$ {row.startPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-200">
                          R$ {row.endPrice.toFixed(2)}
                        </td>
                        <td
                          className={`py-2.5 px-2 text-right font-semibold ${
                            row.assetReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {row.assetReturnPct >= 0 ? '+' : ''}
                          {row.assetReturnPct.toFixed(2)}%
                        </td>
                        <td
                          className={`py-2.5 px-2 text-right font-semibold ${
                            row.contributionPct >= 0 ? 'text-cyan-300' : 'text-rose-400'
                          }`}
                        >
                          {row.contributionPct >= 0 ? '+' : ''}
                          {row.contributionPct.toFixed(2)} p.p.
                        </td>
                        <td className="py-2.5 pl-2 text-right text-white font-semibold">
                          {formatCurrency(row.finalValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
