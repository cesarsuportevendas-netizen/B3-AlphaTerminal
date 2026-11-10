import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { StockData } from '../types/stock';
import { MetricCard } from './MetricCard';
import { formatPercent, formatNumber } from '../utils/dataCleaner';
import { Award, Zap, Percent, PieChart } from 'lucide-react';

interface ProfitabilitySectionProps {
  stocks: StockData[];
  onSelectStock: (stock: StockData) => void;
}

export const ProfitabilitySection: React.FC<ProfitabilitySectionProps> = ({
  stocks,
  onSelectStock,
}) => {
  // Top ROIC companies
  const topROIC = useMemo(() => {
    return stocks
      .filter((s) => s.roic !== null && s.roic > 0 && s.roic < 100)
      .sort((a, b) => (b.roic || 0) - (a.roic || 0))
      .slice(0, 4);
  }, [stocks]);

  // Top ROE companies
  const topROE = useMemo(() => {
    return stocks
      .filter((s) => s.roe !== null && s.roe > 0 && s.roe < 100)
      .sort((a, b) => (b.roe || 0) - (a.roe || 0))
      .slice(0, 4);
  }, [stocks]);

  // Medians
  const validROIC = useMemo(() => stocks.filter((s) => s.roic !== null && s.roic > 0).map((s) => s.roic!), [stocks]);
  const validROE = useMemo(() => stocks.filter((s) => s.roe !== null && s.roe > 0).map((s) => s.roe!), [stocks]);
  const validMrgLiq = useMemo(() => stocks.filter((s) => s.mrgLiq !== null).map((s) => s.mrgLiq!), [stocks]);
  const validMrgEbit = useMemo(() => stocks.filter((s) => s.mrgEbit !== null).map((s) => s.mrgEbit!), [stocks]);

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  // Comparative Margins Chart Data (Top 10 highest market cap or liquidity)
  const marginsData = useMemo(() => {
    return stocks
      .filter((s) => s.mrgBruta !== null && s.mrgEbit !== null && s.mrgLiq !== null && s.mrgLiq > 0)
      .sort((a, b) => b.liq2meses - a.liq2meses)
      .slice(0, 10)
      .map((s) => ({
        papel: s.papel,
        'Margem Bruta': s.mrgBruta,
        'Margem EBIT': s.mrgEbit,
        'Margem Líquida': s.mrgLiq,
        rawStock: s,
      }));
  }, [stocks]);

  // Top 10 ROIC vs ROE Ranking
  const roicVsRoeData = useMemo(() => {
    return stocks
      .filter((s) => s.roic !== null && s.roe !== null && s.roic > 0 && s.roe > 0)
      .sort((a, b) => (b.roic || 0) - (a.roic || 0))
      .slice(0, 10)
      .map((s) => ({
        papel: s.papel,
        ROIC: s.roic,
        ROE: s.roe,
        rawStock: s,
      }));
  }, [stocks]);

  return (
    <div className="space-y-6">
      {/* 1. Metric Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Mediana ROIC (Capital Investido)"
          value={formatPercent(median(validROIC))}
          subtitle="Eficiência de alocação de capital"
          benchmark="Custo de oportunidade B3"
          badge={{ text: 'Eficiência', variant: 'positive' }}
        />
        <MetricCard
          title="Mediana ROE (Patrimônio Líquido)"
          value={formatPercent(median(validROE))}
          subtitle="Rentabilidade do acionista"
          benchmark={`Amostra: ${validROE.length} ações`}
          badge={{ text: 'Acionista', variant: 'positive' }}
        />
        <MetricCard
          title="Mediana Margem EBIT"
          value={formatPercent(median(validMrgEbit))}
          subtitle="Lucro operacional sobre receita"
          benchmark="Geração operacional"
          badge={{ text: 'Operação', variant: 'neutral' }}
        />
        <MetricCard
          title="Mediana Margem Líquida"
          value={formatPercent(median(validMrgLiq))}
          subtitle="Conversão final em lucro líquido"
          benchmark="Resultado final"
          badge={{ text: 'Lucro Líquido', variant: 'neutral' }}
        />
      </div>

      {/* 2. Highlight Cards: Campeãs em ROIC e Campeãs em ROE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top ROIC */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Destaques: Maiores Retornos s/ Capital Investido (ROIC)
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-4">
            Empresas com vantagens competitivas duradouras (moats econômicos) e alta capacidade de reinvestir capital a taxas elevadas.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {topROIC.map((stock) => (
              <div
                key={stock.id}
                onClick={() => onSelectStock(stock)}
                className="bg-slate-950/70 border border-slate-800 hover:border-emerald-500/50 rounded-md p-3 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white text-xs group-hover:text-emerald-400">
                    {stock.papel}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    P/L {stock.pl ? `${formatNumber(stock.pl, 1)}x` : '—'}
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-emerald-400">
                  {formatPercent(stock.roic)}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-1">
                  {stock.nomeEmpresa || stock.setor}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top ROE */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Destaques: Maior Rentabilidade do Patrimônio (ROE)
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-4">
            Negócios com maior capacidade de gerar valor contábil para cada real de patrimônio líquido investido pelos acionistas.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {topROE.map((stock) => (
              <div
                key={stock.id}
                onClick={() => onSelectStock(stock)}
                className="bg-slate-950/70 border border-slate-800 hover:border-sky-500/50 rounded-md p-3 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white text-xs group-hover:text-sky-400">
                    {stock.papel}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    P/VP {stock.pvp ? `${formatNumber(stock.pvp, 1)}x` : '—'}
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-sky-400">
                  {formatPercent(stock.roe)}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-1">
                  {stock.nomeEmpresa || stock.setor}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Charts: Cascata de Margens e ROIC vs ROE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Margin Comparison (Bruta vs EBIT vs Líquida) */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-white tracking-wide">
              Estrutura de Margens: Bruta vs. EBIT vs. Líquida (%)
            </h3>
            <p className="text-[11px] text-slate-400">
              Conversão de faturamento em resultado operacional e lucro líquido (Top 10 por Liquidez)
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={marginsData}
                margin={{ top: 15, right: 15, left: -10, bottom: 20 }}
              >
                <XAxis dataKey="papel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="%" />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ payload, label }) => {
                    if (!payload || payload.length === 0) return null;
                    return (
                      <div className="bg-slate-950 border border-slate-700 p-2.5 rounded shadow-xl text-xs space-y-1">
                        <div className="font-bold text-white">{label}</div>
                        <div className="space-y-0.5 font-mono text-[11px]">
                          {payload.map((p) => (
                            <div key={p.name} className="flex justify-between gap-4">
                              <span className="text-slate-400">{p.name}:</span>
                              <span style={{ color: p.color }} className="font-semibold">
                                {formatPercent(p.value as number)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                />
                <Bar dataKey="Margem Bruta" fill="#38bdf8" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Margem EBIT" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Margem Líquida" fill="#a855f7" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ROIC vs ROE Ranking Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-white tracking-wide">
              Comparativo de Retornos: ROIC vs. ROE (%)
            </h3>
            <p className="text-[11px] text-slate-400">
              Quando ROE &gt;&gt; ROIC, indica que o retorno é impulsionado por alavancagem financeira
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={roicVsRoeData}
                margin={{ top: 15, right: 15, left: -10, bottom: 20 }}
              >
                <XAxis dataKey="papel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="%" />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ payload, label }) => {
                    if (!payload || payload.length === 0) return null;
                    return (
                      <div className="bg-slate-950 border border-slate-700 p-2.5 rounded shadow-xl text-xs space-y-1">
                        <div className="font-bold text-white">{label}</div>
                        <div className="space-y-0.5 font-mono text-[11px]">
                          {payload.map((p) => (
                            <div key={p.name} className="flex justify-between gap-4">
                              <span className="text-slate-400">{p.name}:</span>
                              <span style={{ color: p.color }} className="font-semibold">
                                {formatPercent(p.value as number)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                />
                <Bar dataKey="ROIC" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="ROE" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
