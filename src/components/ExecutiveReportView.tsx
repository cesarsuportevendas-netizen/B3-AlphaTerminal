import React, { useState } from 'react';
import { StockIndicator } from '../types/stock';
import { formatCurrency, formatPercent } from '../utils/financialCalculations';
import { Printer, Download, Sparkles, FileText, CheckCircle2, TrendingUp, ShieldCheck } from 'lucide-react';

interface ExecutiveReportViewProps {
  stocks: StockIndicator[];
  onExportCSV: () => void;
}

export const ExecutiveReportView: React.FC<ExecutiveReportViewProps> = ({
  stocks,
  onExportCSV,
}) => {
  const top10 = stocks.slice(0, 10);
  const [macroOutlook, setMacroOutlook] = useState<any>(null);
  const [isGeneratingMacro, setIsGeneratingMacro] = useState(false);

  const fetchMacroOutlook = async () => {
    setIsGeneratingMacro(true);
    try {
      const res = await fetch('/api/ai/market-outlook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top10Stocks: top10 }),
      });
      if (res.ok) {
        const data = await res.json();
        setMacroOutlook(data);
      }
    } catch (err) {
      console.error('Error fetching macro outlook:', err);
    } finally {
      setIsGeneratingMacro(false);
    }
  };

  React.useEffect(() => {
    fetchMacroOutlook();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  // Recommended allocation weights based on Alpha Score
  const totalScore = top10.reduce((acc, s) => acc + s.scoreAlpha, 0);
  const allocations = top10.map((s) => ({
    stock: s,
    weight: Number(((s.scoreAlpha / (totalScore || 1)) * 100).toFixed(1)),
    upsideGraham: s.descontoGrahamPerc,
    upsideTarget1: Number((((s.alvo1CurtoPrazo - s.cotacao) / s.cotacao) * 100).toFixed(1)),
  }));

  const reportDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Action Header (Hidden in Print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Relatório Executivo de Carteira & Valuation
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dossiê de investimento consolidado com a análise das 10 melhores ações da B3, matriz de ponderação e teses institucionais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-lg shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Salvar em PDF</span>
          </button>

          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* The Printable Dossier Container */}
      <div className="p-8 sm:p-12 rounded-2xl bg-slate-900 border border-slate-800 print:bg-white print:text-slate-900 print:border-none print:p-0 space-y-8">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-6 border-b border-slate-800 print:border-slate-300 gap-4">
          <div>
            <div className="text-xs font-mono tracking-widest text-emerald-400 print:text-emerald-700 uppercase font-bold">
              B3 AlphaTerminal · Relatório Estratégico Oficial
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white print:text-slate-950 mt-1">
              Carteira Top 10 B3: Valor, Rentabilidade & Fluxo
            </h2>
            <div className="text-xs text-slate-400 print:text-slate-600 mt-1">
              Data de Emissão: {reportDate} · Metodologia Quantitativa Multi-Fatorial
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xs text-slate-400 print:text-slate-600">Universo Analisado</div>
            <div className="text-lg font-bold font-mono text-white print:text-slate-900">
              {stocks.length} Ativos Listados
            </div>
          </div>
        </div>

        {/* Section 1: Executive Macro Summary */}
        <div className="space-y-3">
          <h3 className="text-base font-bold text-white print:text-slate-900 border-b border-slate-800 print:border-slate-200 pb-2">
            1. Parecer Executivo de Mercado & Alocação de Capital
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 print:text-slate-700 leading-relaxed">
            {macroOutlook?.panoramaMacro ||
              'A bolsa de valores brasileira apresenta valuation atrativo frente às médias históricas de 10 anos. Empresas com alta rentabilidade sobre o capital investido (ROIC > 15%), geração consistente de fluxo de caixa livre e baixo endividamento líquido oferecem a melhor assimetria para composição de patrimônio de médio e longo prazo.'}
          </p>

          <p className="text-xs sm:text-sm text-slate-300 print:text-slate-700 leading-relaxed">
            {macroOutlook?.fluxoCapital ||
              'O fluxo institucional recente indica rotação gradual do capital estrangeiro e fundos de previdência para companhias líderes em dividendos e commodities com baixo custo de produção.'}
          </p>
        </div>

        {/* Section 2: Top 10 Portfolio Allocation Matrix */}
        <div className="space-y-3">
          <h3 className="text-base font-bold text-white print:text-slate-900 border-b border-slate-800 print:border-slate-200 pb-2">
            2. Matriz de Alocação Recomendada (Top 10 B3)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className="border-b border-slate-800 print:border-slate-300 text-slate-400 print:text-slate-600 font-mono text-[11px] uppercase">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Ativo</th>
                  <th className="py-2 px-2">Empresa</th>
                  <th className="py-2 px-2 text-right">Cotação</th>
                  <th className="py-2 px-2 text-right">Peso Sugerido</th>
                  <th className="py-2 px-2 text-right">P/L</th>
                  <th className="py-2 px-2 text-right">ROIC</th>
                  <th className="py-2 px-2 text-right">DY</th>
                  <th className="py-2 px-2 text-right">Ponto Entrada</th>
                  <th className="py-2 px-2 text-right">Alvo 1</th>
                  <th className="py-2 px-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-200 font-mono text-[12px]">
                {allocations.map(({ stock, weight }, idx) => (
                  <tr key={stock.id} className="hover:bg-slate-800/30 print:hover:bg-transparent">
                    <td className="py-2.5 px-2 text-slate-500 font-bold">#{idx + 1}</td>
                    <td className="py-2.5 px-2 font-bold text-white print:text-slate-900">{stock.papel}</td>
                    <td className="py-2.5 px-2 font-sans text-slate-300 print:text-slate-700 truncate max-w-[150px]">{stock.nomeEmpresa}</td>
                    <td className="py-2.5 px-2 text-right text-slate-200 print:text-slate-900">{formatCurrency(stock.cotacao)}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-emerald-400 print:text-emerald-700">{weight}%</td>
                    <td className="py-2.5 px-2 text-right text-slate-300 print:text-slate-700">{stock.pl.toFixed(2)}</td>
                    <td className="py-2.5 px-2 text-right text-emerald-400 print:text-emerald-700">{formatPercent(stock.roic)}</td>
                    <td className="py-2.5 px-2 text-right text-amber-300 print:text-amber-700">{formatPercent(stock.divYield)}</td>
                    <td className="py-2.5 px-2 text-right text-slate-200 print:text-slate-900">{formatCurrency(stock.pontoEntrada)}</td>
                    <td className="py-2.5 px-2 text-right text-cyan-300 print:text-cyan-700">{formatCurrency(stock.alvo1CurtoPrazo)}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-emerald-400 print:text-emerald-700">{stock.scoreAlpha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Detailed Valuation & Theses Breakdown */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white print:text-slate-900 border-b border-slate-800 print:border-slate-200 pb-2">
            3. Síntese Fundamentalista & Padrões Ocultos de Capital
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {top10.slice(0, 6).map((stock) => (
              <div
                key={stock.id}
                className="p-4 rounded-xl bg-slate-950 print:bg-slate-50 border border-slate-800 print:border-slate-200 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono font-bold text-sm text-white print:text-slate-900">
                    {stock.papel} - {stock.nomeEmpresa}
                  </div>
                  <span className="font-mono text-emerald-400 print:text-emerald-700 font-semibold">
                    Score {stock.scoreAlpha}/100
                  </span>
                </div>
                <div className="text-slate-300 print:text-slate-700 leading-relaxed font-sans">
                  <strong>Tese: </strong>{stock.teseCurtoPrazo}
                </div>
                <div className="flex items-center justify-between text-slate-400 print:text-slate-600 pt-1 border-t border-slate-900 print:border-slate-200 font-mono text-[11px]">
                  <span>Preço Graham: {formatCurrency(stock.precoJustoGraham)}</span>
                  <span>Teto Bazin: {formatCurrency(stock.precoTetoBazin)}</span>
                  <span>Risco/Retorno: {stock.riscoRetorno}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Legal Disclaimer */}
        <div className="pt-6 border-t border-slate-800 print:border-slate-300 text-[10px] text-slate-500 print:text-slate-500 space-y-1 font-sans">
          <p className="font-semibold text-slate-400 print:text-slate-700">Aviso Legal & Isenção de Responsabilidade:</p>
          <p>
            Este relatório foi gerado automaticamente pelo B3 AlphaTerminal com base em modelos quantitativos de valuation fundamentalista e análise de dados públicos de empresas listadas na B3. As estimativas de preço justo e pontos de entrada não constituem recomendação formal individualizada nos termos da Resolução CVM nº 20/2021. Investimentos em renda variável estão sujeitos a riscos de oscilação de mercado.
          </p>
        </div>
      </div>
    </div>
  );
};
