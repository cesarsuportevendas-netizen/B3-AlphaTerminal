import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from 'recharts';
import { StockData } from '../types/stock';
import { MetricCard } from './MetricCard';
import { formatPercent, formatCurrency, formatNumber } from '../utils/dataCleaner';
import { TrendingUp, Coins, Sparkles, CheckCircle2 } from 'lucide-react';

interface GrowthSectionProps {
  stocks: StockData[];
  onSelectStock: (stock: StockData) => void;
}

export const GrowthSection: React.FC<GrowthSectionProps> = ({ stocks, onSelectStock }) => {
  // Top Dividend Yield
  const topDividends = useMemo(() => {
    return stocks
      .filter((s) => s.divYield !== null && s.divYield > 0 && s.divYield < 35 && (s.pl || 0) > 0)
      .sort((a, b) => (b.divYield || 0) - (a.divYield || 0))
      .slice(0, 10);
  }, [stocks]);

  // Top 5y Revenue Growth
  const topGrowth = useMemo(() => {
    return stocks
      .filter((s) => s.crescRec5a !== null && s.crescRec5a > 0 && s.crescRec5a < 150)
      .sort((a, b) => (b.crescRec5a || 0) - (a.crescRec5a || 0))
      .slice(0, 10);
  }, [stocks]);

  // Medians
  const validDY = useMemo(
    () => stocks.filter((s) => s.divYield !== null && s.divYield > 0).map((s) => s.divYield!),
    [stocks]
  );
  const validGrowth = useMemo(
    () => stocks.filter((s) => s.crescRec5a !== null).map((s) => s.crescRec5a!),
    [stocks]
  );

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  // Scatter: Cresc Rec 5a (X) vs Dividend Yield (Y)
  const growthScatterData = useMemo(() => {
    return stocks
      .filter(
        (s) =>
          s.crescRec5a !== null &&
          s.divYield !== null &&
          s.crescRec5a >= -20 &&
          s.crescRec5a <= 80 &&
          s.divYield >= 0 &&
          s.divYield <= 25
      )
      .map((s) => ({
        papel: s.papel,
        nome: s.nomeEmpresa || s.papel,
        x: Number(s.crescRec5a!.toFixed(1)),
        y: Number(s.divYield!.toFixed(1)),
        cotacao: s.cotacao,
        pl: s.pl,
        setor: s.setor,
        rawStock: s,
      }));
  }, [stocks]);

  return (
    <div className="space-y-6">
      {/* 1. Metric Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Mediana Dividend Yield"
          value={formatPercent(median(validDY))}
          subtitle="Proventos pagos nos últimos 12 meses"
          benchmark={`Amostra: ${validDY.length} pagadoras`}
          badge={{ text: 'Proventos', variant: 'positive' }}
        />
        <MetricCard
          title="Mediana Cresc. Receita (5 Anos)"
          value={formatPercent(median(validGrowth))}
          subtitle="Taxa anual composta (CAGR 5a)"
          benchmark="Expansão histórica do faturamento"
          badge={{ text: 'Crescimento', variant: 'neutral' }}
        />
        <MetricCard
          title="Ações com DY Acima da Selic (10%+)"
          value={`${stocks.filter((s) => (s.divYield || 0) >= 10).length} empresas`}
          subtitle="Super dividendos com retorno elevado"
          benchmark="DY anualizado &ge; 10%"
          badge={{ text: 'Alto Yield', variant: 'positive' }}
        />
        <MetricCard
          title="Crescimento Acelerado (CAGR > 15%)"
          value={`${stocks.filter((s) => (s.crescRec5a || 0) >= 15).length} empresas`}
          subtitle="Expansão robusta de mercado"
          benchmark="CAGR 5a &ge; 15%"
          badge={{ text: 'Growth', variant: 'accent' }}
        />
      </div>

      {/* 2. Scatter Plot: Crescimento de Receita vs Dividend Yield */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="mb-2">
          <h3 className="text-sm font-bold text-white tracking-wide">
            Matriz de Estratégia: Crescimento (CAGR 5a) vs. Proventos (DY %)
          </h3>
          <p className="text-[11px] text-slate-400">
            Compare ativos focados em reinvestimento e valorização com vacas leiteiras distribuidoras de caixa
          </p>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 25, left: 0 }}>
              <XAxis
                type="number"
                dataKey="x"
                name="Cresc. Rec. 5a"
                unit="%"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                label={{
                  value: 'Crescimento de Receita em 5 Anos (CAGR %)',
                  position: 'insideBottom',
                  offset: -12,
                  fill: '#94a3b8',
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Div. Yield"
                unit="%"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                label={{
                  value: 'Dividend Yield (%)',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#94a3b8',
                  fontSize: 11,
                }}
              />
              <ReferenceLine x={12} stroke="#475569" strokeDasharray="3 3" />
              <ReferenceLine y={6} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'DY 6% (Bazin)', fill: '#10b981', fontSize: 10, position: 'insideTopLeft' }} />

              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload || payload.length === 0) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-slate-950 border border-slate-700 p-2.5 rounded shadow-xl text-xs space-y-1">
                      <div className="font-bold text-emerald-400 flex items-center justify-between gap-4">
                        <span>{d.papel}</span>
                        <span className="font-mono text-white">{formatCurrency(d.cotacao)}</span>
                      </div>
                      <div className="text-[11px] text-slate-300 truncate max-w-xs">{d.nome}</div>
                      <div className="border-t border-slate-800 pt-1 space-y-0.5 font-mono text-[11px]">
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Dividend Yield:</span>
                          <span className="text-emerald-400 font-semibold">{d.y}%</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Cresc. Rec. 5a:</span>
                          <span className="text-sky-400 font-semibold">{d.x}%</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">P/L:</span>
                          <span className="text-white">{d.pl}x</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={growthScatterData}
                onClick={(entry: unknown) => {
                  const item = entry as { rawStock?: StockData; payload?: { rawStock?: StockData } };
                  const stock = item?.rawStock || item?.payload?.rawStock;
                  if (stock) onSelectStock(stock);
                }}
                className="cursor-pointer"
              >
                {growthScatterData.map((entry, index) => {
                  const isBoth = entry.x >= 12 && entry.y >= 6;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={isBoth ? '#10b981' : entry.y >= 6 ? '#f59e0b' : '#38bdf8'}
                      opacity={0.85}
                    />
                  );
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              Crescimento &amp; Alto Dividendo (CAGR &ge; 12% &amp; DY &ge; 6%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              Foco em Dividendos (DY &ge; 6%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block"></span>
              Foco em Crescimento / Reinvestimento
            </span>
          </div>
          <span className="text-slate-500">Clique para abrir raio-x do ativo</span>
        </div>
      </div>

      {/* 3. Top Lists: Top Pagadoras vs Top Crescimento 5 Anos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Dividend Yield */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Top 10: Maiores Dividend Yields da Amostra
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            Ativos com maior retorno em dinheiro depositado na conta do acionista nos últimos 12 meses.
          </p>

          <div className="overflow-x-auto border border-slate-800 rounded-md">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Papel</th>
                  <th className="py-2 px-3 text-right">Dividend Yield</th>
                  <th className="py-2 px-3 text-right">P/L</th>
                  <th className="py-2 px-3 text-right">ROE</th>
                  <th className="py-2 px-3 text-right">Cotação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {topDividends.map((stock) => (
                  <tr
                    key={stock.id}
                    onClick={() => onSelectStock(stock)}
                    className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-2 px-3 font-sans font-bold text-white group-hover:text-emerald-400">
                      {stock.papel}
                      <span className="block text-[10px] font-normal text-slate-500 truncate max-w-[120px]">
                        {stock.setor}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-400">
                      {formatPercent(stock.divYield)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {stock.pl ? `${formatNumber(stock.pl, 1)}x` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {formatPercent(stock.roe)}
                    </td>
                    <td className="py-2 px-3 text-right text-white font-semibold">
                      {formatCurrency(stock.cotacao)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Crescimento de Receita em 5 Anos */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Top 10: Maior Crescimento de Receita (5 Anos)
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            Negócios com maior expansão agregada de volume de negócios e vendas no período.
          </p>

          <div className="overflow-x-auto border border-slate-800 rounded-md">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Papel</th>
                  <th className="py-2 px-3 text-right">Cresc. 5a (CAGR)</th>
                  <th className="py-2 px-3 text-right">P/L</th>
                  <th className="py-2 px-3 text-right">ROIC</th>
                  <th className="py-2 px-3 text-right">Cotação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {topGrowth.map((stock) => (
                  <tr
                    key={stock.id}
                    onClick={() => onSelectStock(stock)}
                    className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-2 px-3 font-sans font-bold text-white group-hover:text-sky-400">
                      {stock.papel}
                      <span className="block text-[10px] font-normal text-slate-500 truncate max-w-[120px]">
                        {stock.setor}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-sky-400">
                      {formatPercent(stock.crescRec5a)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {stock.pl ? `${formatNumber(stock.pl, 1)}x` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {formatPercent(stock.roic)}
                    </td>
                    <td className="py-2 px-3 text-right text-white font-semibold">
                      {formatCurrency(stock.cotacao)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
