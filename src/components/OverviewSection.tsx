import React, { useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Shield,
  Award,
  ArrowRight,
  PieChart,
  Layers,
  Building,
  Globe,
  Sparkles,
} from 'lucide-react';
import { StockData, ActiveSection } from '../types/stock';
import { MetricCard } from './MetricCard';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatCompactNumber,
} from '../utils/dataCleaner';

interface OverviewSectionProps {
  stocks: StockData[];
  onSelectSection: (section: ActiveSection) => void;
  onSelectStock: (stock: StockData) => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  stocks,
  onSelectSection,
  onSelectStock,
}) => {
  // Aggregate statistics
  const stats = useMemo(() => {
    const validPL = stocks.filter((s) => s.pl !== null && s.pl > 0).map((s) => s.pl!);
    const validROE = stocks.filter((s) => s.roe !== null && s.roe > 0).map((s) => s.roe!);
    const validROIC = stocks.filter((s) => s.roic !== null && s.roic > 0).map((s) => s.roic!);
    const validDY = stocks.filter((s) => s.divYield !== null && s.divYield > 0).map((s) => s.divYield!);

    const median = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const totalPatrimonio = stocks.reduce((acc, s) => acc + (s.patrimLiq || 0), 0);

    return {
      total: stocks.length,
      medianPL: median(validPL),
      medianROE: median(validROE),
      medianROIC: median(validROIC),
      medianDY: median(validDY),
      totalPatrimonio,
    };
  }, [stocks]);

  // Sector breakdown
  const sectorBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; totalLiq: number; stocks: StockData[] }>();
    for (const s of stocks) {
      const entry = map.get(s.setor) || { count: 0, totalLiq: 0, stocks: [] };
      entry.count += 1;
      entry.totalLiq += s.liq2meses;
      entry.stocks.push(s);
      map.set(s.setor, entry);
    }

    return Array.from(map.entries())
      .map(([setor, data]) => ({
        setor,
        count: data.count,
        totalLiq: data.totalLiq,
      }))
      .sort((a, b) => b.count - a.count);
  }, [stocks]);

  // Bargain + Quality picks: P/L <= 12, ROE >= 15%, Dív.Líq/PL <= 1.5
  const topValuePicks = useMemo(() => {
    return stocks
      .filter(
        (s) =>
          s.pl !== null &&
          s.pl > 0 &&
          s.pl <= 12 &&
          s.roe !== null &&
          s.roe >= 15 &&
          (s.divLiqPatrim === null || s.divLiqPatrim <= 1.5)
      )
      .sort((a, b) => (a.pl || 0) - (b.pl || 0))
      .slice(0, 5);
  }, [stocks]);

  // Top Dividend Yield
  const topDividends = useMemo(() => {
    return stocks
      .filter((s) => s.divYield !== null && s.divYield > 0 && (s.pl || 0) > 0)
      .sort((a, b) => (b.divYield || 0) - (a.divYield || 0))
      .slice(0, 5);
  }, [stocks]);

  return (
    <div className="space-y-6">
      {/* 1. Global Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Universo Monitorado"
          value={`${stats.total} ações`}
          subtitle="Empresas com filtros ativos"
          benchmark={`Patrimônio: ${formatCompactNumber(stats.totalPatrimonio)}`}
          badge={{ text: 'B3', variant: 'neutral' }}
        />
        <MetricCard
          title="Mediana P/L (Mercado)"
          value={`${formatNumber(stats.medianPL, 1)}x`}
          subtitle="Preço / Lucro médio da amostra"
          benchmark="Múltiplo de entrada"
          badge={{ text: 'Valuation', variant: 'positive' }}
        />
        <MetricCard
          title="Mediana ROIC"
          value={formatPercent(stats.medianROIC)}
          subtitle="Retorno sobre capital investido"
          benchmark="Eficiência de alocação"
          badge={{ text: 'Qualidade', variant: 'positive' }}
        />
        <MetricCard
          title="Mediana Dividend Yield"
          value={formatPercent(stats.medianDY)}
          subtitle="Retorno médio em proventos (12m)"
          benchmark="Fluxo de caixa ao acionista"
          badge={{ text: 'Proventos', variant: 'accent' }}
        />
      </div>

      {/* AI News & Relevant Facts Banner */}
      <div
        onClick={() => onSelectSection('ai_news')}
        className="bg-linear-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 hover:border-emerald-500/60 rounded-lg p-4 sm:p-5 transition-all cursor-pointer group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                Radar de Inteligência Artificial: Fatos Relevantes &amp; Notícias em Tempo Real
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                Google Search
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Pesquise fatos relevantes da CVM, comunicados de M&amp;A, dividendos e notícias com impacto direto na cotação das ações da B3.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 whitespace-nowrap shrink-0 group-hover:translate-x-1 transition-transform">
          <span>Abrir Radar IA</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>

      {/* 2. Structured Section Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Section 1 Card */}
        <div
          onClick={() => onSelectSection('valuation')}
          className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-lg p-5 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-105 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
              1. Valuation &amp; Preço Justo
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Múltiplos P/L, P/VP, EV/EBITDA, modelo clássico de Graham e Preço Teto Bazin com margem de segurança.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium mt-4 pt-3 border-t border-slate-800/80">
            <span>Explorar Valuation</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Section 2 Card */}
        <div
          onClick={() => onSelectSection('profitability')}
          className="bg-slate-900 border border-slate-800 hover:border-sky-500/50 rounded-lg p-5 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3 group-hover:scale-105 transition-transform">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">
              2. Rentabilidade &amp; Margens
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              ROIC, ROE, cascata de margens operacionais (Bruta, EBIT e Líquida) e líderes em retorno sobre capital.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-sky-400 font-medium mt-4 pt-3 border-t border-slate-800/80">
            <span>Ver Rentabilidade</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Section 3 Card */}
        <div
          onClick={() => onSelectSection('debt')}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-lg p-5 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
              3. Endividamento &amp; Solvência
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Dívida Líquida / Patrimônio, Liquidez Corrente, matriz de risco de balanço e alertas de alavancagem.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-amber-400 font-medium mt-4 pt-3 border-t border-slate-800/80">
            <span>Auditar Balanços</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Section 4 Card */}
        <div
          onClick={() => onSelectSection('growth')}
          className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-lg p-5 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
              4. Crescimento &amp; Proventos
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Crescimento de receita em 5 anos (CAGR), Dividend Yield, e matriz comparativa de reinvestimento vs distribuição.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium mt-4 pt-3 border-t border-slate-800/80">
            <span>Analisar Dividendos</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* 3. Executive Spotlight Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Value + Quality */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Fórmula de Qualidade &amp; Valor (B3)
              </h3>
              <p className="text-[11px] text-slate-400">
                P/L &le; 12x, ROE &ge; 15% e Alavancagem Saudável (&le; 1,5x)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-md">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Papel</th>
                  <th className="py-2 px-3 text-right">Cotação</th>
                  <th className="py-2 px-3 text-right">P/L</th>
                  <th className="py-2 px-3 text-right">ROE</th>
                  <th className="py-2 px-3 text-right">ROIC</th>
                  <th className="py-2 px-3 text-right">DY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {topValuePicks.map((stock) => (
                  <tr
                    key={stock.id}
                    onClick={() => onSelectStock(stock)}
                    className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-2 px-3 font-sans font-bold text-white group-hover:text-emerald-400">
                      {stock.papel}
                      <span className="block text-[10px] font-normal text-slate-500 truncate max-w-[110px]">
                        {stock.setor}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-white">
                      {formatCurrency(stock.cotacao)}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                      {formatNumber(stock.pl, 1)}x
                    </td>
                    <td className="py-2 px-3 text-right text-sky-400 font-semibold">
                      {formatPercent(stock.roe)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {formatPercent(stock.roic)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-200">
                      {formatPercent(stock.divYield)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sector Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-white tracking-wide">
              Distribuição por Setor Econômico
            </h3>
            <p className="text-[11px] text-slate-400">
              Concentração setorial e liquidez das empresas filtradas
            </p>
          </div>

          <div className="space-y-2.5">
            {sectorBreakdown.slice(0, 5).map((item) => {
              const pct = ((item.count / stocks.length) * 100).toFixed(0);
              return (
                <div key={item.setor} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{item.setor}</span>
                    <span className="font-mono text-slate-400">
                      {item.count} ações ({pct}%) · {formatCompactNumber(item.totalLiq)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800 text-right">
            <button
              onClick={() => onSelectSection('table')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
            >
              <span>Ver todas as ações na tabela</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
