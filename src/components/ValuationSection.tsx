import React, { useMemo, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from 'recharts';
import { StockData } from '../types/stock';
import { MetricCard } from './MetricCard';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  calculateGrahamFairPrice,
  calculateBazinCeilingPrice,
} from '../utils/dataCleaner';
import { TrendingDown, Calculator, HelpCircle } from 'lucide-react';

interface ValuationSectionProps {
  stocks: StockData[];
  onSelectStock: (stock: StockData) => void;
}

export const ValuationSection: React.FC<ValuationSectionProps> = ({ stocks, onSelectStock }) => {
  const [showGrahamOnly, setShowGrahamOnly] = useState(false);

  // Filter stocks with valid multiples for stats
  const validPL = useMemo(() => stocks.filter((s) => s.pl !== null && s.pl > 0).map((s) => s.pl!), [stocks]);
  const validPVP = useMemo(() => stocks.filter((s) => s.pvp !== null && s.pvp > 0).map((s) => s.pvp!), [stocks]);
  const validEVEBITDA = useMemo(() => stocks.filter((s) => s.evEbitda !== null && s.evEbitda > 0).map((s) => s.evEbitda!), [stocks]);
  const validPSR = useMemo(() => stocks.filter((s) => s.psr !== null && s.psr > 0).map((s) => s.psr!), [stocks]);

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const medPL = median(validPL);
  const medPVP = median(validPVP);
  const medEVEBITDA = median(validEVEBITDA);
  const medPSR = median(validPSR);

  // Data for Scatter Plot: P/L (X) vs ROE (Y)
  // Filter reasonable bounds to prevent outlier distortion (e.g. P/L 0..35, ROE -10..50%)
  const scatterData = useMemo(() => {
    return stocks
      .filter((s) => s.pl !== null && s.pl > 0 && s.pl <= 35 && s.roe !== null && s.roe >= -10 && s.roe <= 50)
      .map((s) => ({
        papel: s.papel,
        nome: s.nomeEmpresa || s.papel,
        x: Number(s.pl!.toFixed(2)), // P/L
        y: Number(s.roe!.toFixed(2)), // ROE
        cotacao: s.cotacao,
        pvp: s.pvp,
        setor: s.setor,
        rawStock: s,
      }));
  }, [stocks]);

  // Ranking: Lowest EV/EBITDA with positive values & minimum liquidity
  const lowestEVEbitda = useMemo(() => {
    return stocks
      .filter((s) => s.evEbitda !== null && s.evEbitda > 0 && s.evEbitda < 25 && s.liq2meses > 1000000)
      .sort((a, b) => (a.evEbitda || 999) - (b.evEbitda || 999))
      .slice(0, 12)
      .map((s) => ({
        papel: s.papel,
        evEbitda: s.evEbitda,
        pl: s.pl,
        pvp: s.pvp,
        rawStock: s,
      }));
  }, [stocks]);

  // Graham Fair Price Table calculation
  const grahamAnalysis = useMemo(() => {
    return stocks
      .map((s) => {
        const graham = calculateGrahamFairPrice(s.cotacao, s.pl, s.pvp);
        const bazin = calculateBazinCeilingPrice(s.cotacao, s.divYield);
        const margemGraham = graham ? ((graham - s.cotacao) / s.cotacao) * 100 : null;
        const margemBazin = bazin ? ((bazin - s.cotacao) / s.cotacao) * 100 : null;
        return {
          stock: s,
          graham,
          bazin,
          margemGraham,
          margemBazin,
        };
      })
      .filter((item) => (showGrahamOnly ? item.graham !== null && item.margemGraham !== null && item.margemGraham > 0 : true))
      .sort((a, b) => (b.margemGraham || -999) - (a.margemGraham || -999));
  }, [stocks, showGrahamOnly]);

  return (
    <div className="space-y-6">
      {/* 1. Multiple KPI Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Mediana P/L (Preço / Lucro)"
          value={`${formatNumber(medPL, 2)}x`}
          subtitle="Múltiplo de lucros do setor"
          benchmark={`Amostra: ${validPL.length} ações`}
          badge={{ text: 'Valuation', variant: 'neutral' }}
        />
        <MetricCard
          title="Mediana P/VP (Preço / Vlr. Patrimonial)"
          value={`${formatNumber(medPVP, 2)}x`}
          subtitle="Preço sobre capital próprio"
          benchmark={medPVP < 1 ? 'Desconto sobre PL' : 'Prêmio sobre PL'}
          badge={{
            text: medPVP < 1 ? 'Subavaliado' : 'Equilibrado',
            variant: medPVP < 1 ? 'positive' : 'neutral',
          }}
        />
        <MetricCard
          title="Mediana EV/EBITDA"
          value={`${formatNumber(medEVEBITDA, 2)}x`}
          subtitle="Firma sobre geração de caixa"
          benchmark={`Amostra: ${validEVEBITDA.length} empresas`}
          badge={{ text: 'Caixa Operacional', variant: 'neutral' }}
        />
        <MetricCard
          title="Mediana PSR (Preço / Receita)"
          value={`${formatNumber(medPSR, 2)}x`}
          subtitle="Múltiplo de faturamento"
          benchmark="Price-to-Sales"
          badge={{ text: 'Vendas', variant: 'neutral' }}
        />
      </div>

      {/* 2. Charts Row: Scatter Plot (P/L vs ROE) and Ranking EV/EBITDA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scatter Plot: P/L vs ROE */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Dispersão: P/L vs. ROE (%)
              </h3>
              <p className="text-[11px] text-slate-400">
                Quadrante Superior Esquerdo: <span className="text-emerald-400 font-semibold">Baixo P/L & Alto ROE</span> (Maior Potencial de Retorno)
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                <XAxis
                  type="number"
                  dataKey="x"
                  name="P/L"
                  unit="x"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  label={{ value: 'Preço / Lucro (P/L)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="ROE"
                  unit="%"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  label={{ value: 'Retorno s/ Patrimônio (ROE %)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                />
                <ZAxis range={[60, 60]} />
                <ReferenceLine x={12} stroke="#475569" strokeDasharray="3 3" />
                <ReferenceLine y={15} stroke="#475569" strokeDasharray="3 3" />
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
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{d.nome}</div>
                        <div className="border-t border-slate-800 pt-1 space-y-0.5 font-mono text-[11px]">
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">P/L:</span>
                            <span className="text-white font-semibold">{d.x}x</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">ROE:</span>
                            <span className="text-emerald-400 font-semibold">{d.y}%</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">P/VP:</span>
                            <span className="text-white">{d.pvp}x</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={scatterData}
                  onClick={(entry: unknown) => {
                    const item = entry as { rawStock?: StockData; payload?: { rawStock?: StockData } };
                    const stock = item?.rawStock || item?.payload?.rawStock;
                    if (stock) onSelectStock(stock);
                  }}
                  className="cursor-pointer"
                >
                  {scatterData.map((entry, index) => {
                    // Highlight bargain & profitable companies (P/L < 12 and ROE > 15%)
                    const isSweetSpot = entry.x <= 12 && entry.y >= 15;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isSweetSpot ? '#10b981' : '#38bdf8'}
                        opacity={isSweetSpot ? 0.95 : 0.65}
                      />
                    );
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              Baratas e Rentáveis (P/L &le; 12x &amp; ROE &ge; 15%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block"></span>
              Demais Ativos
            </span>
          </div>
        </div>

        {/* Ranking: Lowest EV/EBITDA */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-white tracking-wide">
              Top Ações por Menor EV/EBITDA
            </h3>
            <p className="text-[11px] text-slate-400">
              Ações com menor tempo de retorno operacional e liquidez consistente
            </p>
          </div>

          <div className="h-72 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={lowestEVEbitda}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
              >
                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} unit="x" />
                <YAxis
                  dataKey="papel"
                  type="category"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-950 border border-slate-700 p-2.5 rounded shadow-xl text-xs space-y-1">
                        <div className="font-bold text-emerald-400">{d.papel}</div>
                        <div className="font-mono text-[11px] space-y-0.5">
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">EV/EBITDA:</span>
                            <span className="text-white font-semibold">{d.evEbitda}x</span>
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
                <Bar
                  dataKey="evEbitda"
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                  onClick={(entry: unknown) => {
                    const item = entry as { rawStock?: StockData; payload?: { rawStock?: StockData } };
                    const stock = item?.rawStock || item?.payload?.rawStock;
                    if (stock) onSelectStock(stock);
                  }}
                  className="cursor-pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800 text-right">
            Clique na barra para detalhar o ativo
          </div>
        </div>
      </div>

      {/* 3. Benjamin Graham & Décio Bazin Fair Price Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">
                Modelos Clássicos de Preço Justo (Graham &amp; Bazin)
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Fórmula de Graham: <span className="font-mono text-slate-300">√(22,5 × LPA × VPA)</span> · Preço Teto Bazin: <span className="font-mono text-slate-300">DPA / 0,06 (DY 6%)</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGrahamOnly(!showGrahamOnly)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                showGrahamOnly
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              Apenas com Desconto de Graham (&gt; 0%)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-md">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Papel</th>
                <th className="py-2.5 px-3 text-right">Cotação Atual</th>
                <th className="py-2.5 px-3 text-right">P/L</th>
                <th className="py-2.5 px-3 text-right">P/VP</th>
                <th className="py-2.5 px-3 text-right">Preço Justo Graham</th>
                <th className="py-2.5 px-3 text-right">Margem Graham</th>
                <th className="py-2.5 px-3 text-right">Preço Teto Bazin (6%)</th>
                <th className="py-2.5 px-3 text-right">Margem Bazin</th>
                <th className="py-2.5 px-3 text-center">Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {grahamAnalysis.slice(0, 10).map(({ stock, graham, bazin, margemGraham, margemBazin }) => {
                const hasSafetyMargin = margemGraham !== null && margemGraham > 20;
                return (
                  <tr
                    key={stock.id}
                    onClick={() => onSelectStock(stock)}
                    className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-3 font-sans font-bold text-white group-hover:text-emerald-400">
                      {stock.papel}
                      <span className="block text-[10px] font-normal text-slate-500 truncate max-w-[140px]">
                        {stock.nomeEmpresa || stock.setor}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-white font-semibold">
                      {formatCurrency(stock.cotacao)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {stock.pl ? `${formatNumber(stock.pl, 1)}x` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {stock.pvp ? `${formatNumber(stock.pvp, 2)}x` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-300">
                      {graham ? formatCurrency(graham) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {margemGraham !== null ? (
                        <span
                          className={`font-semibold ${
                            margemGraham > 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {margemGraham > 0 ? `+${formatPercent(margemGraham, 1)}` : formatPercent(margemGraham, 1)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-sky-300 font-semibold">
                      {bazin ? formatCurrency(bazin) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {margemBazin !== null ? (
                        <span
                          className={`font-semibold ${
                            margemBazin > 0 ? 'text-sky-400' : 'text-slate-400'
                          }`}
                        >
                          {margemBazin > 0 ? `+${formatPercent(margemBazin, 1)}` : formatPercent(margemBazin, 1)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      {hasSafetyMargin ? (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-medium">
                          Margem Segura
                        </span>
                      ) : margemGraham && margemGraham < -20 ? (
                        <span className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded font-medium">
                          Ágio Elevado
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                          Preço Neutro
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
