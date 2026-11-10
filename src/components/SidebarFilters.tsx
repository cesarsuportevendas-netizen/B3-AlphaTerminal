import React from 'react';
import { Search, Filter, RotateCcw, Building2, DollarSign, Activity, ShieldAlert, Check } from 'lucide-react';
import { FilterState } from '../types/stock';
import { formatCompactNumber, formatCurrency } from '../utils/dataCleaner';

interface SidebarFiltersProps {
  filters: FilterState;
  onChangeFilters: (filters: FilterState) => void;
  onResetFilters: () => void;
  availableSectors: string[];
  totalCount: number;
  filteredCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const SidebarFilters: React.FC<SidebarFiltersProps> = ({
  filters,
  onChangeFilters,
  onResetFilters,
  availableSectors,
  totalCount,
  filteredCount,
  isOpenMobile,
  onCloseMobile,
}) => {
  const handleUpdate = (partial: Partial<FilterState>) => {
    onChangeFilters({ ...filters, ...partial });
  };

  const isFiltered =
    filters.search !== '' ||
    filters.setor !== 'ALL' ||
    filters.minPreco > 0 ||
    filters.maxPreco < 500 ||
    filters.minLiq2meses > 0 ||
    filters.minPatrimLiq > 0 ||
    filters.onlyProfitable ||
    filters.onlyDividendPayers ||
    filters.maxDivLiqPatrim !== null;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-72 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header with Title and Reset */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">Filtros Quantitativos</h2>
          </div>
          {isFiltered && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-400 transition-colors"
              title="Limpar todos os filtros"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>

        {/* Filter Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300">
          {/* Active Result Pill */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-md p-2.5 flex items-center justify-between">
            <span className="text-slate-400">Ativos Selecionados</span>
            <span className="font-mono font-bold text-white">
              <span className="text-emerald-400">{filteredCount}</span> / {totalCount}
            </span>
          </div>

          {/* 1. Busca por Papel / Empresa */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Buscar Ticker / Papel
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Ex: PETR4, VALE3, Itaú..."
                value={filters.search}
                onChange={(e) => handleUpdate({ search: e.target.value })}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500/80 transition-colors"
              />
            </div>
          </div>

          {/* 2. Filtro por Setor */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Setor Econômico
            </label>
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <select
                value={filters.setor}
                onChange={(e) => handleUpdate({ setor: e.target.value })}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-white focus:outline-hidden focus:border-emerald-500/80 transition-colors cursor-pointer appearance-none"
              >
                <option value="ALL">Todos os Setores ({availableSectors.length})</option>
                {availableSectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Faixa de Preço (Cotação) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Faixa de Preço (Cotação)
              </label>
              <span className="font-mono text-emerald-400 text-[11px]">
                {formatCurrency(filters.minPreco)} - {formatCurrency(filters.maxPreco)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5">Mínimo (R$)</span>
                <input
                  type="number"
                  min="0"
                  max="500"
                  step="1"
                  value={filters.minPreco}
                  onChange={(e) => handleUpdate({ minPreco: Math.max(0, Number(e.target.value)) })}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-right font-mono text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5">Máximo (R$)</span>
                <input
                  type="number"
                  min="0"
                  max="500"
                  step="5"
                  value={filters.maxPreco}
                  onChange={(e) => handleUpdate({ maxPreco: Math.max(0, Number(e.target.value)) })}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-right font-mono text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* 4. Liquidez Mínima 2 Meses (Liq.2meses) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Liquidez Mín. (2 Meses)
              </label>
              <span className="font-mono text-emerald-400 text-[11px]">
                {formatCompactNumber(filters.minLiq2meses)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="500000000"
              step="5000000"
              value={filters.minLiq2meses}
              onChange={(e) => handleUpdate({ minLiq2meses: Number(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>R$ 0</span>
              <span>R$ 100M</span>
              <span>R$ 500M+</span>
            </div>
          </div>

          {/* 5. Tamanho de Patrimônio Líquido (Patrim. Líq) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Patrimônio Líquido Mín.
              </label>
              <span className="font-mono text-emerald-400 text-[11px]">
                {formatCompactNumber(filters.minPatrimLiq)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="50000000000"
              step="500000000"
              value={filters.minPatrimLiq}
              onChange={(e) => handleUpdate({ minPatrimLiq: Number(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>R$ 0</span>
              <span>R$ 10B</span>
              <span>R$ 50B+</span>
            </div>
          </div>

          {/* 6. Filtros Quantitativos Rápidos */}
          <div className="pt-2 border-t border-slate-800 space-y-2.5">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Critérios Qualitativos
            </span>

            {/* Apenas Lucrativas (P/L > 0) */}
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={filters.onlyProfitable}
                onChange={(e) => handleUpdate({ onlyProfitable: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20"
              />
              <span className="group-hover:text-white transition-colors">Apenas Lucrativas (P/L &gt; 0)</span>
            </label>

            {/* Apenas com Dividend Yield (DY > 0) */}
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={filters.onlyDividendPayers}
                onChange={(e) => handleUpdate({ onlyDividendPayers: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20"
              />
              <span className="group-hover:text-white transition-colors">Com Dividendos (DY &gt; 0)</span>
            </label>

            {/* Alavancagem Saudável (Dív.Líq/Patrim < 1.5) */}
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={filters.maxDivLiqPatrim !== null}
                onChange={(e) => handleUpdate({ maxDivLiqPatrim: e.target.checked ? 1.5 : null })}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20"
              />
              <span className="group-hover:text-white transition-colors">Dív. Líq / Patrim. &lt; 1,5x</span>
            </label>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-[10px] text-slate-500 flex items-center justify-between">
          <span>Fonte: empresas.xlsx / B3</span>
          <span className="font-mono">Filtros dinâmicos</span>
        </div>
      </aside>
    </>
  );
};
