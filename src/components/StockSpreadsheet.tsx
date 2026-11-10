import React, { useState } from 'react';
import { StockIndicator } from '../types/stock';
import { formatCurrency, formatPercent, formatLargeNumber } from '../utils/financialCalculations';
import { Search, Filter, Download, Upload, RotateCcw, Sparkles, Trash2, Edit3, Check, X, Eye } from 'lucide-react';

interface StockSpreadsheetProps {
  stocks: StockIndicator[];
  onUpdateStock: (updated: StockIndicator) => void;
  onDeleteStock: (id: string) => void;
  onResetStocks: () => void;
  onExportCSV: () => void;
  onOpenCSVImport: () => void;
  onSelectStockForAI: (stock: StockIndicator) => void;
  onOpenCompanyModal?: (stock: StockIndicator) => void;
}

export const StockSpreadsheet: React.FC<StockSpreadsheetProps> = ({
  stocks,
  onUpdateStock,
  onDeleteStock,
  onResetStocks,
  onExportCSV,
  onOpenCSVImport,
  onSelectStockForAI,
  onOpenCompanyModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof StockIndicator>('scoreAlpha');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Inline editing state: { stockId, field, value }
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof StockIndicator; value: string } | null>(null);

  // Extract unique sectors
  const sectors = React.useMemo(() => {
    const set = new Set<string>();
    stocks.forEach((s) => s.setor && set.add(s.setor));
    return Array.from(set).sort();
  }, [stocks]);

  // Filter & sort
  const filteredStocks = React.useMemo(() => {
    return stocks
      .filter((s) => {
        const matchesSearch =
          s.papel.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.nomeEmpresa.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSector = selectedSector === 'all' || s.setor === selectedSector;
        return matchesSearch && matchesSector;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return 0;
      });
  }, [stocks, searchTerm, selectedSector, sortField, sortDirection]);

  // Summary statistics
  const stats = React.useMemo(() => {
    if (filteredStocks.length === 0) return { avgPl: 0, avgRoic: 0, avgDy: 0, count: 0 };
    const avgPl = filteredStocks.reduce((acc, s) => acc + (s.pl > 0 ? s.pl : 0), 0) / (filteredStocks.filter(s => s.pl > 0).length || 1);
    const avgRoic = filteredStocks.reduce((acc, s) => acc + s.roic, 0) / filteredStocks.length;
    const avgDy = filteredStocks.reduce((acc, s) => acc + s.divYield, 0) / filteredStocks.length;
    return { avgPl, avgRoic, avgDy, count: filteredStocks.length };
  }, [filteredStocks]);

  const handleSort = (field: keyof StockIndicator) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const startEdit = (stock: StockIndicator, field: keyof StockIndicator) => {
    setEditingCell({
      id: stock.id,
      field,
      value: String(stock[field] ?? '')
    });
  };

  const saveEdit = (stock: StockIndicator) => {
    if (!editingCell) return;
    const numericFields: (keyof StockIndicator)[] = [
      'cotacao', 'pl', 'pvp', 'psr', 'divYield', 'pAtivo', 'pCapGiro',
      'pEbit', 'pAtivCircLiq', 'evEbit', 'evEbitda', 'margEbit', 'margLiquida',
      'liqCorr', 'roic', 'roe', 'liq2m', 'patrimLiq', 'divBrutPatrim', 'crescRec5a',
      'pontoEntrada', 'stopLoss', 'alvo1CurtoPrazo', 'alvo2LongoPrazo'
    ];

    let val: any = editingCell.value;
    if (numericFields.includes(editingCell.field)) {
      val = parseFloat(editingCell.value.replace(',', '.')) || 0;
    }

    onUpdateStock({
      ...stock,
      [editingCell.field]: val
    });
    setEditingCell(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Planilha Dinâmica & Base de Dados Fundamentalista
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Planilha diretamente conectada ao banco de dados interno. Clique duas vezes em qualquer célula para editar indicadores em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenCSVImport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-slate-950 font-semibold text-xs rounded-lg hover:bg-emerald-400 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Importar CSV</span>
          </button>

          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={onResetStocks}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-lg border border-slate-800 transition-colors"
            title="Restaura os valores originais exatos da imagem"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Imagem</span>
          </button>
        </div>
      </div>

      {/* Search, Filter & Quick KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search */}
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Ticker (ex: PETR4) ou Empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Sector select */}
        <div className="md:col-span-3">
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Todos os Setores ({sectors.length})</option>
            {sectors.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </div>

        {/* Stats Strip */}
        <div className="md:col-span-5 flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs font-mono">
          <div className="text-slate-400">
            Ativos: <span className="text-white font-semibold">{stats.count}</span>
          </div>
          <div className="text-slate-400">
            Méd. P/L: <span className="text-emerald-400 font-semibold">{stats.avgPl.toFixed(1)}</span>
          </div>
          <div className="text-slate-400">
            Méd. ROIC: <span className="text-emerald-400 font-semibold">{stats.avgRoic.toFixed(1)}%</span>
          </div>
          <div className="text-slate-400">
            Méd. DY: <span className="text-amber-400 font-semibold">{stats.avgDy.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Spreadsheet Data Grid */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full border-collapse text-left text-xs font-sans">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase tracking-wider sticky top-0 z-20 border-b border-slate-800 whitespace-nowrap">
              <tr>
                <th className="py-2.5 px-3 font-semibold text-slate-300">#</th>
                <th
                  onClick={() => handleSort('papel')}
                  className="py-2.5 px-3 font-semibold text-slate-300 cursor-pointer hover:text-white"
                >
                  Papel {sortField === 'papel' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  onClick={() => handleSort('cotacao')}
                  className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-white"
                >
                  Cotação (R$) {sortField === 'cotacao' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  onClick={() => handleSort('pl')}
                  className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-white"
                >
                  P/L {sortField === 'pl' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  onClick={() => handleSort('pvp')}
                  className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-white"
                >
                  P/VP {sortField === 'pvp' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  onClick={() => handleSort('divYield')}
                  className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-white"
                >
                  DY (%) {sortField === 'divYield' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-2.5 px-3 font-semibold text-right text-emerald-400">
                  DPA 12m (R$)
                </th>
                <th
                  onClick={() => handleSort('roic')}
                  className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-white"
                >
                  ROIC (%) {sortField === 'roic' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  onClick={() => handleSort('roe')}
                  className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-white"
                >
                  ROE (%) {sortField === 'roe' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  onClick={() => handleSort('margLiquida')}
                  className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-white"
                >
                  Mg. Líq (%) {sortField === 'margLiquida' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-2.5 px-3 font-semibold text-right text-slate-400">
                  Receita 12m
                </th>
                <th
                  onClick={() => handleSort('evEbit')}
                  className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-white"
                >
                  EV/EBIT {sortField === 'evEbit' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  onClick={() => handleSort('scoreAlpha')}
                  className="py-2.5 px-3 font-semibold text-right text-emerald-400 cursor-pointer hover:text-emerald-300"
                >
                  Score {sortField === 'scoreAlpha' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-2.5 px-3 font-semibold text-slate-300">Entrada</th>
                <th className="py-2.5 px-3 font-semibold text-slate-300">Stop</th>
                <th className="py-2.5 px-3 font-semibold text-slate-300">Alvo 1</th>
                <th className="py-2.5 px-3 font-semibold text-slate-300">Wyckoff</th>
                <th className="py-2.5 px-3 font-semibold text-center">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80 font-mono text-[12px]">
              {filteredStocks.map((stock, idx) => (
                <tr
                  key={stock.id}
                  className="hover:bg-slate-800/50 transition-colors group"
                >
                  <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                    {stock.posicaoTop10 ? (
                      <span className="font-bold text-emerald-400">#{stock.posicaoTop10}</span>
                    ) : (
                      idx + 1
                    )}
                  </td>

                  {/* Ticker & Name */}
                  <td className="py-2.5 px-3 font-sans">
                    <button
                      type="button"
                      onClick={() => onOpenCompanyModal ? onOpenCompanyModal(stock) : onSelectStockForAI(stock)}
                      className="text-left flex items-center gap-2 group/btn cursor-pointer"
                      title="Abrir Raio-X Fundamentalista, Valuation & Notícias IA"
                    >
                      <span className="font-mono font-bold text-slate-100 group-hover/btn:text-emerald-400 underline decoration-slate-700 hover:decoration-emerald-400 transition-colors">
                        {stock.papel}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[140px] group-hover/btn:text-slate-200" title={stock.nomeEmpresa}>
                        {stock.nomeEmpresa}
                      </span>
                    </button>
                  </td>

                  {/* Cotacao (Editable) */}
                  <td
                    className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-800"
                    onDoubleClick={() => startEdit(stock, 'cotacao')}
                  >
                    {editingCell?.id === stock.id && editingCell.field === 'cotacao' ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="text"
                          value={editingCell.value}
                          onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                          className="w-16 px-1 py-0.5 bg-slate-950 border border-emerald-400 rounded text-right text-xs"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(stock)}
                        />
                        <button onClick={() => saveEdit(stock)} className="text-emerald-400"><Check className="w-3 h-3" /></button>
                        <button onClick={() => setEditingCell(null)} className="text-slate-400"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <span className="text-slate-200">{stock.cotacao.toFixed(2)}</span>
                    )}
                  </td>

                  {/* P/L (Editable) */}
                  <td
                    className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-800"
                    onDoubleClick={() => startEdit(stock, 'pl')}
                  >
                    {editingCell?.id === stock.id && editingCell.field === 'pl' ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="text"
                          value={editingCell.value}
                          onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                          className="w-16 px-1 py-0.5 bg-slate-950 border border-emerald-400 rounded text-right text-xs"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(stock)}
                        />
                        <button onClick={() => saveEdit(stock)} className="text-emerald-400"><Check className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <span className={stock.pl > 0 && stock.pl < 12 ? 'text-emerald-400 font-semibold' : 'text-slate-300'}>
                        {stock.pl.toFixed(2)}
                      </span>
                    )}
                  </td>

                  {/* P/VP (Editable) */}
                  <td
                    className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-800"
                    onDoubleClick={() => startEdit(stock, 'pvp')}
                  >
                    {editingCell?.id === stock.id && editingCell.field === 'pvp' ? (
                      <input
                        type="text"
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        className="w-16 px-1 py-0.5 bg-slate-950 border border-emerald-400 rounded text-right text-xs"
                        autoFocus
                        onBlur={() => saveEdit(stock)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(stock)}
                      />
                    ) : (
                      <span className={stock.pvp < 1 ? 'text-emerald-400 font-semibold' : 'text-slate-300'}>
                        {stock.pvp.toFixed(2)}
                      </span>
                    )}
                  </td>

                  {/* Div. Yield (Editable) */}
                  <td
                    className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-800"
                    onDoubleClick={() => startEdit(stock, 'divYield')}
                  >
                    {editingCell?.id === stock.id && editingCell.field === 'divYield' ? (
                      <input
                        type="text"
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        className="w-16 px-1 py-0.5 bg-slate-950 border border-emerald-400 rounded text-right text-xs"
                        autoFocus
                        onBlur={() => saveEdit(stock)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(stock)}
                      />
                    ) : (
                      <span className={stock.divYield >= 8 ? 'text-amber-300 font-semibold' : 'text-slate-300'}>
                        {stock.divYield.toFixed(2)}%
                      </span>
                    )}
                  </td>

                  {/* DPA 12m */}
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                    R$ {(stock.dividendo12mPorAcao || ((stock.cotacao * stock.divYield) / 100)).toFixed(2)}
                  </td>

                  {/* ROIC (Editable) */}
                  <td
                    className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-800"
                    onDoubleClick={() => startEdit(stock, 'roic')}
                  >
                    {editingCell?.id === stock.id && editingCell.field === 'roic' ? (
                      <input
                        type="text"
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        className="w-16 px-1 py-0.5 bg-slate-950 border border-emerald-400 rounded text-right text-xs"
                        autoFocus
                        onBlur={() => saveEdit(stock)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(stock)}
                      />
                    ) : (
                      <span className={stock.roic >= 18 ? 'text-emerald-400 font-semibold' : 'text-slate-300'}>
                        {stock.roic.toFixed(2)}%
                      </span>
                    )}
                  </td>

                  {/* ROE */}
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {stock.roe.toFixed(2)}%
                  </td>

                  {/* Margem Liquida */}
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {stock.margLiquida.toFixed(2)}%
                  </td>

                  {/* Receita 12m */}
                  <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                    {stock.receitaLiquida12m ? formatLargeNumber(stock.receitaLiquida12m) : '-'}
                  </td>

                  {/* EV/EBIT */}
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {stock.evEbit.toFixed(2)}
                  </td>

                  {/* Score Alpha */}
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                    {stock.scoreAlpha}
                  </td>

                  {/* Entrada */}
                  <td className="py-2.5 px-3 text-slate-300">
                    {formatCurrency(stock.pontoEntrada)}
                  </td>

                  {/* Stop */}
                  <td className="py-2.5 px-3 text-rose-400">
                    {formatCurrency(stock.stopLoss)}
                  </td>

                  {/* Alvo 1 */}
                  <td className="py-2.5 px-3 text-cyan-300">
                    {formatCurrency(stock.alvo1CurtoPrazo)}
                  </td>

                  {/* Wyckoff */}
                  <td className="py-2.5 px-3 text-[11px] font-sans text-slate-400">
                    {stock.padraoWyckoff}
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {onOpenCompanyModal && (
                        <button
                          onClick={() => onOpenCompanyModal(stock)}
                          title="Abrir Raio-X Fundamentalista & Valuation"
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onSelectStockForAI(stock)}
                        title="Ver Previsão Técnica de IA"
                        className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteStock(stock.id)}
                        title="Excluir Linha da Planilha"
                        className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStocks.length === 0 && (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p className="text-sm font-semibold text-slate-300">Nenhum ativo encontrado</p>
                      <p className="text-xs text-slate-500">Faça o upload do seu arquivo CSV ou Excel (.xlsx) ou ajuste os filtros.</p>
                      <button
                        onClick={onOpenCSVImport}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-md transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Carregar Planilha CSV / Excel</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
