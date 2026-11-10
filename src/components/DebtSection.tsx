import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { StockData } from '../types/stock';
import { MetricCard } from './MetricCard';
import { formatNumber, formatPercent } from '../utils/dataCleaner';
import { AlertTriangle, ShieldCheck, DollarSign, Wallet } from 'lucide-react';

interface DebtSectionProps {
  stocks: StockData[];
  onSelectStock: (stock: StockData) => void;
}

export const DebtSection: React.FC<DebtSectionProps> = ({ stocks, onSelectStock }) => {
  // Companies with Net Cash (Dívida Líquida < 0)
  const netCashStocks = useMemo(() => {
    return stocks
      .filter((s) => s.divLiqPatrim !== null && s.divLiqPatrim < 0)
      .sort((a, b) => (a.divLiqPatrim || 0) - (b.divLiqPatrim || 0));
  }, [stocks]);

  // Companies with High Leverage Alert (Dívida Líquida / PL > 1.5)
  const highLeverageStocks = useMemo(() => {
    return stocks
      .filter((s) => s.divLiqPatrim !== null && s.divLiqPatrim > 1.5)
      .sort((a, b) => (b.divLiqPatrim || 0) - (a.divLiqPatrim || 0));
  }, [stocks]);

  // Companies with Liquidity Alert (Liq. Corrente < 1.0)
  const lowLiquidityStocks = useMemo(() => {
    return stocks
      .filter((s) => s.liqCorr !== null && s.liqCorr < 1.0 && s.liqCorr > 0)
      .sort((a, b) => (a.liqCorr || 0) - (b.liqCorr || 0));
  }, [stocks]);

  // Medians
  const validDivLiq = useMemo(
    () => stocks.filter((s) => s.divLiqPatrim !== null).map((s) => s.divLiqPatrim!),
    [stocks]
  );
  const validLiqCorr = useMemo(
    () => stocks.filter((s) => s.liqCorr !== null && s.liqCorr > 0).map((s) => s.liqCorr!),
    [stocks]
  );

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  // Scatter Plot: Solvency Matrix
  // X: Liquidez Corrente (0 .. 4.5)
  // Y: Dívida Líquida / Patrimônio (-0.5 .. 3.5)
  const solvencyData = useMemo(() => {
    return stocks
      .filter(
        (s) =>
          s.liqCorr !== null &&
          s.divLiqPatrim !== null &&
          s.liqCorr > 0 &&
          s.liqCorr <= 5.0 &&
          s.divLiqPatrim >= -0.5 &&
          s.divLiqPatrim <= 4.0
      )
      .map((s) => ({
        papel: s.papel,
        nome: s.nomeEmpresa || s.papel,
        x: Number(s.liqCorr!.toFixed(2)),
        y: Number(s.divLiqPatrim!.toFixed(2)),
        cotacao: s.cotacao,
        setor: s.setor,
        rawStock: s,
      }));
  }, [stocks]);

  return (
    <div className="space-y-6">
      {/* 1. Metric Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Mediana Dív. Líquida / Patrimônio"
          value={`${formatNumber(median(validDivLiq), 2)}x`}
          subtitle="Alavancagem sobre capital próprio"
          benchmark={median(validDivLiq) < 1.0 ? 'Endividamento controlado' : 'Atenção com juros'}
          badge={{
            text: median(validDivLiq) < 1.0 ? 'Conservador' : 'Moderado',
            variant: median(validDivLiq) < 1.0 ? 'positive' : 'accent',
          }}
        />
        <MetricCard
          title="Mediana Liquidez Corrente"
          value={`${formatNumber(median(validLiqCorr), 2)}x`}
          subtitle="Capacidade de cobrir curto prazo"
          benchmark="Ativo Circulante / Passivo Circulante"
          badge={{
            text: median(validLiqCorr) > 1.3 ? 'Folga Financeira' : 'Monitorar',
            variant: median(validLiqCorr) > 1.3 ? 'positive' : 'neutral',
          }}
        />
        <MetricCard
          title="Empresas com Caixa Líquido"
          value={`${netCashStocks.length} empresas`}
          subtitle="Dívida Líquida negativa"
          benchmark="Mais caixa que dívida total"
          badge={{ text: 'Caixa Líquido', variant: 'positive' }}
        />
        <MetricCard
          title="Alertas de Alta Alavancagem"
          value={`${highLeverageStocks.length} empresas`}
          subtitle="Dívida Líq / Patrimônio > 1,5x"
          benchmark="Risco financeiro ampliado"
          badge={{
            text: highLeverageStocks.length > 0 ? 'Alerta Ativo' : 'Zero Alertas',
            variant: highLeverageStocks.length > 0 ? 'negative' : 'positive',
          }}
        />
      </div>

      {/* 2. Solvency Risk Matrix (Scatter Plot) */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Matriz de Solvência &amp; Estrutura de Capital
            </h3>
            <p className="text-[11px] text-slate-400">
              Eixo X: Liquidez Corrente (Segurança de Curto Prazo) · Eixo Y: Dívida Líq / Patrimônio (Alavancagem Geral)
            </p>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 25, left: 0 }}>
              <XAxis
                type="number"
                dataKey="x"
                name="Liq. Corrente"
                unit="x"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                label={{
                  value: 'Liquidez Corrente (Ativo Circ. / Passivo Circ.)',
                  position: 'insideBottom',
                  offset: -12,
                  fill: '#94a3b8',
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Dív. Líq / PL"
                unit="x"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                label={{
                  value: 'Dívida Líquida / Patrimônio',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#94a3b8',
                  fontSize: 11,
                }}
              />
              {/* Reference Lines */}
              <ReferenceLine x={1.0} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Alerta Curto Prazo (1.0x)', fill: '#f43f5e', fontSize: 10 }} />
              <ReferenceLine y={1.5} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Teto Alavancagem (1.5x)', fill: '#f59e0b', fontSize: 10, position: 'insideTopLeft' }} />
              <ReferenceLine y={0} stroke="#10b981" strokeDasharray="2 2" label={{ value: 'Caixa Líquido (0.0x)', fill: '#10b981', fontSize: 10 }} />

              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload || payload.length === 0) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-slate-950 border border-slate-700 p-2.5 rounded shadow-xl text-xs space-y-1">
                      <div className="font-bold text-emerald-400 flex items-center justify-between gap-4">
                        <span>{d.papel}</span>
                        <span className="text-[10px] text-slate-400">{d.setor}</span>
                      </div>
                      <div className="text-[11px] text-slate-300 truncate max-w-xs">{d.nome}</div>
                      <div className="border-t border-slate-800 pt-1 space-y-0.5 font-mono text-[11px]">
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Liquidez Corrente:</span>
                          <span className={d.x < 1.0 ? 'text-rose-400 font-semibold' : 'text-white'}>
                            {d.x}x
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Dív. Líq / PL:</span>
                          <span className={d.y > 1.5 ? 'text-rose-400 font-semibold' : d.y < 0 ? 'text-emerald-400 font-semibold' : 'text-white'}>
                            {d.y}x
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={solvencyData}
                onClick={(entry: unknown) => {
                  const item = entry as { rawStock?: StockData; payload?: { rawStock?: StockData } };
                  const stock = item?.rawStock || item?.payload?.rawStock;
                  if (stock) onSelectStock(stock);
                }}
                className="cursor-pointer"
              >
                {solvencyData.map((entry, index) => {
                  const isHighRisk = entry.y > 1.5 || entry.x < 1.0;
                  const isFortress = entry.y < 0.3 && entry.x >= 1.5;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={isHighRisk ? '#f43f5e' : isFortress ? '#10b981' : '#38bdf8'}
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
              Balanço Fortaleza (Baixa dívida &amp; Alta liquidez)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              Zona de Alerta (Dívida &gt; 1,5x ou Liq &lt; 1,0x)
            </span>
          </div>
          <span className="text-slate-500">Clique em qualquer ativo para ver o raio-x</span>
        </div>
      </div>

      {/* 3. Actionable Lists: Alertas de Alavancagem vs Empresas com Caixa Líquido */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Alertas de Alavancagem Excessiva */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Alertas de Risco: Alavancagem Excessiva (&gt; 1,5x)
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            Empresas com exposição acentuada a despesas financeiras e sensibilidade aos ciclos de taxa Selic.
          </p>

          <div className="overflow-x-auto border border-slate-800 rounded-md">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Papel</th>
                  <th className="py-2 px-3 text-right">Dív. Líq / PL</th>
                  <th className="py-2 px-3 text-right">Liq. Corr.</th>
                  <th className="py-2 px-3 text-right">Margem EBIT</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {highLeverageStocks.slice(0, 6).map((stock) => (
                  <tr
                    key={stock.id}
                    onClick={() => onSelectStock(stock)}
                    className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-2 px-3 font-sans font-bold text-white group-hover:text-rose-400">
                      {stock.papel}
                      <span className="block text-[10px] font-normal text-slate-500 truncate max-w-[120px]">
                        {stock.setor}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-rose-400">
                      {stock.divLiqPatrim ? `${formatNumber(stock.divLiqPatrim, 2)}x` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {stock.liqCorr ? `${formatNumber(stock.liqCorr, 2)}x` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {formatPercent(stock.mrgEbit)}
                    </td>
                    <td className="py-2 px-3 text-center font-sans">
                      <span className="text-[9px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded font-medium">
                        Alto Risco
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empresas com Caixa Líquido */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Fortaleza de Balanço: Caixa Líquido Positivo
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            Empresas cujo caixa e equivalentes superam toda a dívida bruta (Dívida Líquida negativa).
          </p>

          <div className="overflow-x-auto border border-slate-800 rounded-md">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Papel</th>
                  <th className="py-2 px-3 text-right">Dív. Líq / PL</th>
                  <th className="py-2 px-3 text-right">Liq. Corr.</th>
                  <th className="py-2 px-3 text-right">ROE</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {netCashStocks.slice(0, 6).map((stock) => (
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
                    <td className="py-2 px-3 text-right font-semibold text-emerald-400">
                      {stock.divLiqPatrim ? `${formatNumber(stock.divLiqPatrim, 2)}x` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {stock.liqCorr ? `${formatNumber(stock.liqCorr, 2)}x` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {formatPercent(stock.roe)}
                    </td>
                    <td className="py-2 px-3 text-center font-sans">
                      <span className="text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium">
                        Caixa Líquido
                      </span>
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
