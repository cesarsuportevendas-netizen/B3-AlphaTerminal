import React, { useState } from 'react';
import { StockIndicator } from '../types/stock';
import { formatCurrency, formatPercent } from '../utils/financialCalculations';
import { Users, TrendingUp, AlertTriangle, Shield, CheckCircle2, ArrowRight, Eye, Sparkles } from 'lucide-react';

interface InstitutionalFlowTrackerProps {
  stocks: StockIndicator[];
  onSelectStockForAI: (stock: StockIndicator) => void;
}

export const InstitutionalFlowTracker: React.FC<InstitutionalFlowTrackerProps> = ({
  stocks,
  onSelectStockForAI,
}) => {
  const [filterPattern, setFilterPattern] = useState<string>('all');
  const [selectedStock, setSelectedStock] = useState<StockIndicator>(stocks[0] || null);

  // Group by pattern
  const accumulationStocks = stocks.filter(
    (s) => s.padraoWyckoff === 'Acumulação Silenciosa' || s.padraoWyckoff === 'Absorção Institucional'
  );
  const reaccumulationStocks = stocks.filter((s) => s.padraoWyckoff === 'Re-acumulação');
  const neutralStocks = stocks.filter((s) => s.padraoWyckoff === 'Neutro / Equilíbrio');
  const distributionStocks = stocks.filter((s) => s.padraoWyckoff === 'Distribuição / Desova');

  const filteredStocks = stocks.filter((s) => {
    if (filterPattern === 'all') return true;
    return s.padraoWyckoff === filterPattern;
  });

  // Calculate market totals
  const totalForeignFlow = stocks.reduce((acc, s) => acc + s.fluxoEstrangeiro30dMilhoes, 0);
  const totalDomesticFlow = stocks.reduce((acc, s) => acc + s.fluxoInstitucional30dMilhoes, 0);

  return (
    <div className="space-y-6">
      {/* Title & Section Header */}
      <div className="pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wider uppercase mb-1">
          <span>Inteligência de Mercado & Smart Money</span>
          <span aria-hidden="true">·</span>
          <span>Rastreamento de Grandes Investidores</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Fluxo de Capital & Padrões Ocultos dos Tubarões
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Identificação de pegadas institucionais (Foreign Capital, Fundos de Ações, Fundos Soberanos e Insiders) aplicando a metodologia Wyckoff de acumulação silenciosa antes de fortes valorizações.
        </p>
      </div>

      {/* Aggregate Institutional KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Fluxo Estrangeiro Líquido (30d)</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            +{totalForeignFlow.toFixed(1)} Mi
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Concentrado em commodities e grandes bancos
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Fundos Locais / Institucionais (30d)</div>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            +{totalDomesticFlow.toFixed(1)} Mi
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Alocação em utilities e dividendos resilientes
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Ativos em Fase de Acumulação</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {accumulationStocks.length} <span className="text-xs text-emerald-400 font-normal">empresas</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Pressão compradora oculta e absorção no book
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Top Acumulação da Rodada</div>
          <div className="text-2xl font-bold font-mono text-amber-300 mt-1">
            {stocks[0]?.papel || 'PETR4'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Score Smart Money: {stocks[0]?.smartMoneyScore || 94}/100
          </div>
        </div>
      </div>

      {/* Wyckoff Pattern Filter Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-400">Filtrar por Fase Wyckoff:</span>
        <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
          <button
            onClick={() => setFilterPattern('all')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              filterPattern === 'all' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({stocks.length})
          </button>
          <button
            onClick={() => setFilterPattern('Acumulação Silenciosa')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              filterPattern === 'Acumulação Silenciosa' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Acumulação Silenciosa ({stocks.filter(s => s.padraoWyckoff === 'Acumulação Silenciosa').length})
          </button>
          <button
            onClick={() => setFilterPattern('Absorção Institucional')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              filterPattern === 'Absorção Institucional' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Absorção Institucional ({stocks.filter(s => s.padraoWyckoff === 'Absorção Institucional').length})
          </button>
          <button
            onClick={() => setFilterPattern('Re-acumulação')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              filterPattern === 'Re-acumulação' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Re-acumulação ({reaccumulationStocks.length})
          </button>
        </div>
      </div>

      {/* Main Analysis Split: List of Stocks vs Detailed Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Stock List */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
          {filteredStocks.map((stock) => {
            const isSelected = selectedStock?.id === stock.id;
            return (
              <div
                key={stock.id}
                onClick={() => setSelectedStock(stock)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-800/90 border-emerald-500/60 shadow-lg'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-bold font-mono text-white">
                      {stock.papel}
                    </span>
                    <span className="text-xs font-mono text-slate-300">
                      {formatCurrency(stock.cotacao)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-emerald-400 font-semibold">
                      Fluxo {stock.smartMoneyScore}/100
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 truncate mt-1">
                  {stock.nomeEmpresa}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 mt-2.5 pt-2 border-t border-slate-800/60">
                  <span>Padrão: <strong className="text-slate-300 font-medium">{stock.padraoWyckoff}</strong></span>
                  <span className="text-slate-300 font-mono">
                    Entrada: <span className="text-emerald-400">{formatCurrency(stock.pontoEntrada)}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Deep Inspector for Selected Stock */}
        {selectedStock && (
          <div className="lg:col-span-7 p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-baseline gap-3">
                  <h3 className="text-2xl font-bold font-mono text-white">
                    {selectedStock.papel}
                  </h3>
                  <span className="text-lg font-mono text-slate-300">
                    {formatCurrency(selectedStock.cotacao)}
                  </span>
                </div>
                <div className="text-sm text-slate-400">
                  {selectedStock.nomeEmpresa} · {selectedStock.setor}
                </div>
              </div>

              <button
                onClick={() => onSelectStockForAI(selectedStock)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-slate-950 font-semibold text-xs rounded-lg hover:bg-emerald-400 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Previsão Completa por IA</span>
              </button>
            </div>

            {/* Shareholders & Institutional Presence */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Composição Acionária & Principais Tubarões
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-sans">
                {selectedStock.principaisAcionistas}
              </p>
              <div className="flex items-center gap-4 pt-2 text-xs text-slate-400 font-mono">
                <span>Free Float: <strong className="text-slate-200">{selectedStock.freeFloat}%</strong></span>
                <span aria-hidden="true">·</span>
                <span>Governança: <strong className="text-slate-200">{selectedStock.governanca}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Proventos: <strong className="text-slate-200">{selectedStock.frequenciaDividendos}</strong></span>
              </div>
            </div>

            {/* Wyckoff & Capital Flow Diagnosis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-xs text-slate-400 mb-1">Diagnóstico Wyckoff</div>
                <div className="text-lg font-bold text-emerald-400 font-sans">
                  {selectedStock.padraoWyckoff}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Acúmulo de lotes em ordens passivas no book de ofertas. Baixa oferta flutuante disponível nas faixas de preço atuais.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-xs text-slate-400 mb-1">Movimentação de Insiders</div>
                <div className="text-lg font-bold text-cyan-400 font-sans">
                  {selectedStock.insiderTransactions}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Diretoria e controladores demonstrando alinhamento de interesses com compras de ações em mercado aberto.
                </p>
              </div>
            </div>

            {/* Dual Horizon Theses: Curto Prazo vs Longo Prazo */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-emerald-400">Tese de Curto Prazo (Swing Trade / Catalisadores)</span>
                  <span className="text-slate-400">Alvo 1: {formatCurrency(selectedStock.alvo1CurtoPrazo)}</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-sans">
                  {selectedStock.teseCurtoPrazo}
                </p>
                <div className="text-xs text-slate-500 font-mono pt-1">
                  Padrão Gráfico: {selectedStock.padraoGrafico}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-cyan-300">Tese de Longo Prazo (Buy & Hold / Compounder)</span>
                  <span className="text-slate-400">Alvo 2: {formatCurrency(selectedStock.alvo2LongoPrazo)}</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-sans">
                  {selectedStock.teseLongoPrazo}
                </p>
                <div className="text-xs text-slate-500 font-mono pt-1">
                  Preço Teto Décio Bazin: {formatCurrency(selectedStock.precoTetoBazin)} · Desconto Graham: {selectedStock.descontoGrahamPerc}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
