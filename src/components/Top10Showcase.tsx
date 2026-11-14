import React, { useState, useMemo } from 'react';
import { StockIndicator, RankingWeights } from '../types/stock';
import { formatCurrency, formatPercent } from '../utils/financialCalculations';
import { getCompanyFullName } from '../utils/companyNames';
import {
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  DollarSign,
  SlidersHorizontal,
  Activity,
  Layers,
  Award,
  TrendingUp,
  Info,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { refreshTradeSignalsOnline, TradeSignalResult } from '../services/onlineStockUpdater';

interface Top10ShowcaseProps {
  stocks: StockIndicator[];
  onSelectStockForAI: (stock: StockIndicator) => void;
  weights: RankingWeights;
  onUpdateWeights: (newWeights: RankingWeights) => void;
  onOpenCompanyModal?: (stock: StockIndicator) => void;
  onApplyTradeSignals?: (signalMap: Record<string, TradeSignalResult>, sourcesUsed?: string[]) => void;
}

export type StrategyKey = 'geral' | 'greenblatt' | 'bazin' | 'graham' | 'smartmoney';

interface StrategyInfo {
  id: StrategyKey;
  label: string;
  title: string;
  desc: string;
  badgeLabel: string;
  icon: React.ElementType;
}

const STRATEGIES: StrategyInfo[] = [
  {
    id: 'geral',
    label: 'Alpha Geral',
    title: 'Ranking Alpha Geral Multicritério',
    desc: 'Combina rentabilidade (ROIC/ROE), valuation (P/L e P/VP), dividendos, saúde financeira e fluxo institucional com base nos pesos ativos.',
    badgeLabel: 'Score Alpha',
    icon: Award,
  },
  {
    id: 'greenblatt',
    label: 'Fórmula Mágica',
    title: 'Fórmula Mágica de Joel Greenblatt',
    desc: 'Ordena pela soma de postos: combina as empresas de menor múltiplo de lucros (P/L > 0) com o maior retorno sobre o capital investido (ROIC).',
    badgeLabel: 'Magic Rank',
    icon: Sparkles,
  },
  {
    id: 'bazin',
    label: 'Dividendos (Bazin)',
    title: 'Método Décio Bazin de Dividendos',
    desc: 'Prioriza ativos com maior Dividend Yield anual sustentável (DY >= 6%) com margem de segurança frente ao Preço Teto Bazin.',
    badgeLabel: 'Dividend Yield',
    icon: DollarSign,
  },
  {
    id: 'graham',
    label: 'Desconto Graham',
    title: 'Modelo de Preço Justo de Benjamin Graham',
    desc: 'Classifica pelo maior percentual de desconto sobre o Preço Justo intrínseco de Graham: V = √(22.5 × LPA × VPA).',
    badgeLabel: 'Margem Graham',
    icon: Layers,
  },
  {
    id: 'smartmoney',
    label: 'Fluxo Tubarões',
    title: 'Rastreamento de Smart Money & Tubarões',
    desc: 'Identifica ativos em fase de forte acumulação institucional por fundos nacionais, investidores estrangeiros e compras de insiders.',
    badgeLabel: 'Score Tubarões',
    icon: Activity,
  },
];

export const Top10Showcase: React.FC<Top10ShowcaseProps> = ({
  stocks,
  onSelectStockForAI,
  weights,
  onUpdateWeights,
  onOpenCompanyModal,
  onApplyTradeSignals,
}) => {
  const [filterStrategy, setFilterStrategy] = useState<StrategyKey>('geral');
  const [showSliders, setShowSliders] = useState(false);
  const [isSyncingSignals, setIsSyncingSignals] = useState(false);
  const [signalSyncMsg, setSignalSyncMsg] = useState<string | null>(null);

  // Compute filtered top 10 based on selected strategy
  const top10 = useMemo(() => {
    let sorted = [...stocks];

    if (filterStrategy === 'greenblatt') {
      // 1. Rank P/L (positive P/L ascending)
      const sortedByPL = [...sorted].sort((a, b) => {
        const plA = a.pl && a.pl > 0 ? a.pl : 999999;
        const plB = b.pl && b.pl > 0 ? b.pl : 999999;
        return plA - plB;
      });
      const plRankMap = new Map<string, number>();
      sortedByPL.forEach((s, idx) => plRankMap.set(s.id, idx + 1));

      // 2. Rank ROIC (ROIC descending)
      const sortedByRoic = [...sorted].sort((a, b) => {
        const roicA = typeof a.roic === 'number' && !isNaN(a.roic) ? a.roic : -999;
        const roicB = typeof b.roic === 'number' && !isNaN(b.roic) ? b.roic : -999;
        return roicB - roicA;
      });
      const roicRankMap = new Map<string, number>();
      sortedByRoic.forEach((s, idx) => roicRankMap.set(s.id, idx + 1));

      // Sum of ranks (lowest sum wins)
      sorted.sort((a, b) => {
        const sumA = (plRankMap.get(a.id) || 9999) + (roicRankMap.get(a.id) || 9999);
        const sumB = (plRankMap.get(b.id) || 9999) + (roicRankMap.get(b.id) || 9999);
        return sumA - sumB;
      });
    } else if (filterStrategy === 'bazin') {
      // Décio Bazin: Highest sustainable Dividend Yield with positive earnings and controlled leverage
      sorted.sort((a, b) => {
        const dyA = typeof a.divYield === 'number' && !isNaN(a.divYield) ? a.divYield : 0;
        const dyB = typeof b.divYield === 'number' && !isNaN(b.divYield) ? b.divYield : 0;
        const validA = a.pl && a.pl > 0 ? 1 : 0;
        const validB = b.pl && b.pl > 0 ? 1 : 0;
        if (validA !== validB) return validB - validA;
        return dyB - dyA;
      });
    } else if (filterStrategy === 'graham') {
      // Benjamin Graham: Largest percentage discount vs Graham Fair Price
      sorted.sort((a, b) => {
        const calcDesc = (s: StockIndicator) => {
          if (typeof s.descontoGrahamPerc === 'number' && !isNaN(s.descontoGrahamPerc)) {
            return s.descontoGrahamPerc;
          }
          if (s.precoJustoGraham && s.cotacao && s.precoJustoGraham > 0) {
            return ((s.precoJustoGraham - s.cotacao) / s.precoJustoGraham) * 100;
          }
          return -999;
        };
        return calcDesc(b) - calcDesc(a);
      });
    } else if (filterStrategy === 'smartmoney') {
      // Smart Money & Institutional Flow: Highest smartMoneyScore
      sorted.sort((a, b) => {
        const smA = typeof a.smartMoneyScore === 'number' && !isNaN(a.smartMoneyScore) ? a.smartMoneyScore : 50;
        const smB = typeof b.smartMoneyScore === 'number' && !isNaN(b.smartMoneyScore) ? b.smartMoneyScore : 50;
        return smB - smA;
      });
    } else {
      // Alpha Geral: Consolidated scoreAlpha
      sorted.sort((a, b) => {
        const alphaA = typeof a.scoreAlpha === 'number' && !isNaN(a.scoreAlpha) ? a.scoreAlpha : 50;
        const alphaB = typeof b.scoreAlpha === 'number' && !isNaN(b.scoreAlpha) ? b.scoreAlpha : 50;
        return alphaB - alphaA;
      });
    }

    return sorted.slice(0, 10);
  }, [stocks, filterStrategy]);

  const currentStrategyMeta = STRATEGIES.find((s) => s.id === filterStrategy) || STRATEGIES[0];
  const StrategyIcon = currentStrategyMeta.icon;

  const handleApplyPreset = (preset: 'balanceado' | 'dividendos' | 'valor' | 'qualidade') => {
    if (preset === 'balanceado') {
      onUpdateWeights({ pesoRentabilidade: 30, pesoValuation: 25, pesoDividendos: 15, pesoSaudeFinanceira: 15, pesoSmartMoney: 15 });
    } else if (preset === 'dividendos') {
      onUpdateWeights({ pesoRentabilidade: 20, pesoValuation: 20, pesoDividendos: 40, pesoSaudeFinanceira: 10, pesoSmartMoney: 10 });
    } else if (preset === 'valor') {
      onUpdateWeights({ pesoRentabilidade: 15, pesoValuation: 50, pesoDividendos: 15, pesoSaudeFinanceira: 10, pesoSmartMoney: 10 });
    } else if (preset === 'qualidade') {
      onUpdateWeights({ pesoRentabilidade: 45, pesoValuation: 15, pesoDividendos: 10, pesoSaudeFinanceira: 15, pesoSmartMoney: 15 });
    }
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wider uppercase mb-1">
            <span>Seleção Quantitativa Oficial B3</span>
            <span aria-hidden="true">·</span>
            <span>Atualização em Tempo Real</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Os 10 Ativos Mais Bem Analisados
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Classificação algorítmica calculada a partir dos dados fundamentalistas da B3, integrando modelos de Benjamin Graham, Décio Bazin, Fórmula Mágica de Greenblatt e rastreamento de fluxo de grandes investidores.
          </p>
        </div>

        {/* Filter Controls (Segmented bar with active feedback) */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
            {STRATEGIES.map((strat) => {
              const isActive = filterStrategy === strat.id;
              return (
                <button
                  key={strat.id}
                  onClick={() => setFilterStrategy(strat.id)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title={strat.desc}
                >
                  {strat.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowSliders(!showSliders)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Ponderar Indicadores</span>
          </button>

          {onApplyTradeSignals && top10.length > 0 && (
            <button
              type="button"
              disabled={isSyncingSignals}
              onClick={async () => {
                setIsSyncingSignals(true);
                setSignalSyncMsg(null);
                try {
                  const quotes: Record<string, number> = {};
                  top10.forEach((s) => {
                    quotes[s.papel.toUpperCase().trim()] = s.cotacao;
                  });
                  const { results, sourcesUsed } = await refreshTradeSignalsOnline(
                    top10.map((s) => s.papel),
                    quotes
                  );
                  onApplyTradeSignals(results, sourcesUsed);
                  const count = Object.keys(results).length;
                  setSignalSyncMsg(
                    count > 0
                      ? `${count} ativos calibrados (${sourcesUsed.join(' · ') || 'br.investing.com · TradingView'})`
                      : 'Nenhum sinal técnico retornado no momento.'
                  );
                } catch (err) {
                  setSignalSyncMsg(
                    err instanceof Error ? err.message : 'Falha ao consultar sinais técnicos online.'
                  );
                } finally {
                  setIsSyncingSignals(false);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-60 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/35 transition-colors cursor-pointer"
              title="Buscar indicações técnicas em br.investing.com, TradingView e Yahoo Finance para aprimorar Entrada, Stop Loss, Alvo 1 e Risco/Retorno"
            >
              {isSyncingSignals ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
              <span>{isSyncingSignals ? 'Sincronizando Sinais...' : 'Sinais Trade Online'}</span>
            </button>
          )}
        </div>
      </div>

      {signalSyncMsg && (
        <div className="text-xs font-mono text-emerald-300 bg-slate-900 border border-emerald-500/30 rounded-lg px-3.5 py-2 flex items-center justify-between gap-2">
          <span>{signalSyncMsg}</span>
          <button
            type="button"
            onClick={() => setSignalSyncMsg(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Strategy Explanatory Context Banner */}
      <div className="flex items-center gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-xs">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
          <StrategyIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white text-sm">{currentStrategyMeta.title}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Estratégia Ativa: {currentStrategyMeta.label}
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
            {currentStrategyMeta.desc}
          </p>
        </div>
      </div>

      {/* Customizable Weights Drawer */}
      {showSliders && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200">
              Calibração de Pesos dos Indicadores
            </span>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">Presets:</span>
              <button
                onClick={() => handleApplyPreset('balanceado')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Balanceado
              </button>
              <button
                onClick={() => handleApplyPreset('dividendos')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Foco Proventos
              </button>
              <button
                onClick={() => handleApplyPreset('valor')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Deep Value
              </button>
              <button
                onClick={() => handleApplyPreset('qualidade')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Moats & ROIC
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Rentabilidade (ROIC/ROE)</span>
                <span className="font-mono text-emerald-400">{weights.pesoRentabilidade}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={weights.pesoRentabilidade}
                onChange={(e) => onUpdateWeights({ ...weights, pesoRentabilidade: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Valuation (P/L e P/VP)</span>
                <span className="font-mono text-emerald-400">{weights.pesoValuation}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={weights.pesoValuation}
                onChange={(e) => onUpdateWeights({ ...weights, pesoValuation: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Dividendos (Div. Yield)</span>
                <span className="font-mono text-emerald-400">{weights.pesoDividendos}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={weights.pesoDividendos}
                onChange={(e) => onUpdateWeights({ ...weights, pesoDividendos: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Saúde (Dívida / Liq.)</span>
                <span className="font-mono text-emerald-400">{weights.pesoSaudeFinanceira}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={weights.pesoSaudeFinanceira}
                onChange={(e) => onUpdateWeights({ ...weights, pesoSaudeFinanceira: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Fluxo Grandes Investidores</span>
                <span className="font-mono text-emerald-400">{weights.pesoSmartMoney}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={weights.pesoSmartMoney}
                onChange={(e) => onUpdateWeights({ ...weights, pesoSmartMoney: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Top 10 Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {top10.map((stock, idx) => {
          const companyFullName = getCompanyFullName(stock.papel, stock.nomeEmpresa);

          return (
            <div
              key={stock.id}
              className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-sm text-emerald-400 mt-0.5">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onOpenCompanyModal ? onOpenCompanyModal(stock) : onSelectStockForAI(stock)}
                          className="text-xl font-bold tracking-tight text-white font-mono hover:text-emerald-400 transition-colors text-left"
                          title="Ver Raio-X Fundamentalista"
                        >
                          {stock.papel}
                        </button>
                        <span className="text-sm font-mono text-slate-300">
                          {formatCurrency(stock.cotacao)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 font-medium leading-relaxed break-words whitespace-normal mt-1">
                        {companyFullName}
                      </div>
                    </div>
                  </div>

                {/* Strategy-Aware Top-Right Metric Badge */}
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-slate-400 uppercase font-mono">
                    {filterStrategy === 'geral' && 'Score Alpha'}
                    {filterStrategy === 'greenblatt' && 'Fórmula Mágica'}
                    {filterStrategy === 'bazin' && 'Dividend Yield'}
                    {filterStrategy === 'graham' && 'Desconto Graham'}
                    {filterStrategy === 'smartmoney' && 'Score Tubarões'}
                  </div>
                  <div className="text-xl font-bold font-mono text-emerald-400">
                    {filterStrategy === 'geral' && (
                      <>
                        {stock.scoreAlpha}
                        <span className="text-xs text-slate-500">/100</span>
                      </>
                    )}
                    {filterStrategy === 'greenblatt' && (
                      <div className="flex items-baseline justify-end gap-1">
                        <span className="text-base text-cyan-400 font-bold">#{idx + 1}</span>
                        <span className="text-[10px] text-slate-400 font-sans">Geral</span>
                      </div>
                    )}
                    {filterStrategy === 'bazin' && (
                      <span>{formatPercent(stock.divYield)}</span>
                    )}
                    {filterStrategy === 'graham' && (
                      <span className={stock.descontoGrahamPerc > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                        {stock.descontoGrahamPerc > 0 ? `+${stock.descontoGrahamPerc.toFixed(1)}%` : `${stock.descontoGrahamPerc?.toFixed(1) || 0}%`}
                      </span>
                    )}
                    {filterStrategy === 'smartmoney' && (
                      <>
                        {stock.smartMoneyScore}
                        <span className="text-xs text-slate-500">/100</span>
                      </>
                    )}
                  </div>
                  {/* Contextual Sub-Badge */}
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {filterStrategy === 'geral' && `Rank Top 10`}
                    {filterStrategy === 'greenblatt' && `P/L ${stock.pl.toFixed(1)}x · ROIC ${formatPercent(stock.roic)}`}
                    {filterStrategy === 'bazin' && `Teto: ${formatCurrency(stock.precoTetoBazin)}`}
                    {filterStrategy === 'graham' && `Preço Justo: ${formatCurrency(stock.precoJustoGraham)}`}
                    {filterStrategy === 'smartmoney' && `${stock.padraoWyckoff}`}
                  </div>
                </div>
              </div>

              {/* Unboxed Metadata & Sector Line */}
              <div className="flex items-center flex-wrap gap-2 text-xs text-slate-400 mt-2 pb-3 border-b border-slate-800/80">
                <span>{stock.setor}</span>
                <span aria-hidden="true">·</span>
                <span>{stock.subsetor}</span>
                <span aria-hidden="true">·</span>
                <span>{stock.governanca}</span>
              </div>

              {/* Fundamental Metrics Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3 text-xs">
                <div className={`p-2 rounded-lg border ${filterStrategy === 'greenblatt' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950/60 border-slate-800/80'}`}>
                  <div className="text-slate-400 text-[11px]">P/L</div>
                  <div className="font-mono font-semibold text-slate-200 mt-0.5">
                    {stock.pl.toFixed(2)}x
                  </div>
                </div>

                <div className={`p-2 rounded-lg border ${filterStrategy === 'greenblatt' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950/60 border-slate-800/80'}`}>
                  <div className="text-slate-400 text-[11px]">ROIC</div>
                  <div className="font-mono font-semibold text-emerald-400 mt-0.5">
                    {formatPercent(stock.roic)}
                  </div>
                </div>

                <div className={`p-2 rounded-lg border ${filterStrategy === 'bazin' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950/60 border-slate-800/80'}`}>
                  <div className="text-slate-400 text-[11px]">DY (12m)</div>
                  <div className="font-mono font-semibold text-amber-300 mt-0.5">
                    {formatPercent(stock.divYield)}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                    R$ {(stock.dividendo12mPorAcao || ((stock.cotacao * stock.divYield) / 100)).toFixed(2)}/aç
                  </div>
                </div>

                <div className={`p-2 rounded-lg border ${filterStrategy === 'graham' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950/60 border-slate-800/80'}`}>
                  <div className="text-slate-400 text-[11px]">P/VP</div>
                  <div className="font-mono font-semibold text-slate-200 mt-0.5">
                    {stock.pvp.toFixed(2)}x
                  </div>
                </div>
              </div>

              {/* Trade Points (Entry, Stop, Target) */}
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between gap-2 flex-wrap text-slate-300">
                  <span className="text-slate-400">Ponto de Entrada Sugerido:</span>
                  <span className="font-semibold text-emerald-400">{formatCurrency(stock.pontoEntrada)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap text-slate-300">
                  <span className="text-slate-400">Stop Loss Técnico:</span>
                  <span className="font-semibold text-rose-400">{formatCurrency(stock.stopLoss)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap text-slate-300">
                  <span className="text-slate-400">Alvo 1 (Curto Prazo):</span>
                  <span className="font-semibold text-cyan-300">{formatCurrency(stock.alvo1CurtoPrazo)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap text-slate-300">
                  <span className="text-slate-400">Risco / Retorno:</span>
                  <span className="text-slate-200 font-bold">{stock.riscoRetorno}</span>
                </div>
                {(stock.tradeSignalRecomendacao || (stock.tradeSignalSources && stock.tradeSignalSources.length > 0)) && (
                  <div className="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-400">
                    <span>
                      Sinal:{' '}
                      <strong className={stock.tradeSignalRecomendacao?.includes('Compra') ? 'text-emerald-400' : stock.tradeSignalRecomendacao?.includes('Venda') ? 'text-rose-400' : 'text-amber-300'}>
                        {stock.tradeSignalRecomendacao || stock.tendenciaTecnica}
                      </strong>
                      {' · '}RSI(14): {stock.rsi14}
                    </span>
                    {stock.tradeSignalSources && stock.tradeSignalSources.length > 0 && (
                      <span className="text-slate-500 truncate">
                        {stock.tradeSignalSources.join(' · ')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Smart Money Footprint Line */}
              <div className={`mt-3 text-xs p-2 rounded-lg border flex items-center justify-between gap-2 flex-wrap ${
                filterStrategy === 'smartmoney' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200' : 'bg-transparent border-transparent text-slate-400'
              }`}>
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-medium">Fluxo Institucional:</span>
                  <span className="text-slate-200">{stock.padraoWyckoff}</span>
                </div>
                <div className="font-mono text-emerald-400">
                  Score: {stock.smartMoneyScore}/100
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center gap-2">
              {onOpenCompanyModal && (
                <button
                  type="button"
                  onClick={() => onOpenCompanyModal(stock)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Raio-X Fundamentalista</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onSelectStockForAI(stock)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-lg transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Previsão de IA & Trades</span>
              </button>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};
