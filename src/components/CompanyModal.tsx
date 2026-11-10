import React, { useState } from 'react';
import {
  X,
  CheckCircle,
  AlertTriangle,
  Calculator,
  Shield,
  TrendingUp,
  Building2,
  Sparkles,
  Globe,
  ExternalLink,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { StockData, AIAnalysisResult } from '../types/stock';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatCompactNumber,
  calculateGrahamFairPrice,
  calculateBazinCeilingPrice,
} from '../utils/dataCleaner';

interface CompanyModalProps {
  stock: StockData | null;
  onClose: () => void;
  onOpenAIForecast?: (stock: StockData) => void;
}

export const CompanyModal: React.FC<CompanyModalProps> = ({ stock, onClose, onOpenAIForecast }) => {
  const [modalTab, setModalTab] = useState<'quant' | 'ai'>('quant');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!stock) return null;

  const grahamPrice = calculateGrahamFairPrice(stock.cotacao, stock.pl, stock.pvp);
  const bazinPrice = calculateBazinCeilingPrice(stock.cotacao, stock.divYield);
  const margemGraham = grahamPrice ? ((grahamPrice - stock.cotacao) / stock.cotacao) * 100 : null;
  const margemBazin = bazinPrice ? ((bazinPrice - stock.cotacao) / stock.cotacao) * 100 : null;

  // Automated diagnosis
  const strengths: string[] = [];
  const warnings: string[] = [];

  // Valuation checks
  if (stock.pl && stock.pl > 0 && stock.pl <= 10) {
    strengths.push(`Múltiplo P/L atrativo (${formatNumber(stock.pl, 1)}x), abaixo da média de mercado.`);
  } else if (stock.pl && stock.pl > 25) {
    warnings.push(`P/L elevado (${formatNumber(stock.pl, 1)}x), embute alta expectativa de crescimento futuro.`);
  } else if (stock.pl && stock.pl < 0) {
    warnings.push(`A empresa reportou prejuízo líquido nos últimos trimestres (P/L negativo).`);
  }

  if (stock.pvp && stock.pvp < 1.0 && stock.pvp > 0) {
    strengths.push(`Negociada com desconto sobre o valor patrimonial (P/VP ${formatNumber(stock.pvp, 2)}x).`);
  }

  // Profitability checks
  if (stock.roic && stock.roic >= 15) {
    strengths.push(`Excelente ROIC de ${formatPercent(stock.roic)}, evidenciando fortes vantagens competitivas (Moat).`);
  } else if (stock.roic && stock.roic < 8 && stock.roic > 0) {
    warnings.push(`ROIC moderado/baixo (${formatPercent(stock.roic)}), próximo ou inferior ao custo de capital.`);
  }

  if (stock.roe && stock.roe >= 18) {
    strengths.push(`Alto retorno sobre o patrimônio líquido (ROE ${formatPercent(stock.roe)}).`);
  }

  // Solvency checks
  if (stock.divLiqPatrim !== null && stock.divLiqPatrim < 0) {
    strengths.push(`Caixa Líquido positivo: a empresa possui mais disponibilidades financeiras do que dívidas brutas.`);
  } else if (stock.divLiqPatrim !== null && stock.divLiqPatrim > 1.5) {
    warnings.push(`Alavancagem financeira elevada (Dív. Líquida / Patrimônio de ${formatNumber(stock.divLiqPatrim, 2)}x).`);
  }

  if (stock.liqCorr !== null && stock.liqCorr < 1.0 && stock.liqCorr > 0) {
    warnings.push(`Liquidez Corrente de curto prazo abaixo de 1,0x (${formatNumber(stock.liqCorr, 2)}x).`);
  } else if (stock.liqCorr !== null && stock.liqCorr >= 1.5) {
    strengths.push(`Confortável índice de liquidez corrente (${formatNumber(stock.liqCorr, 2)}x).`);
  }

  // Dividends & Growth
  if (stock.divYield && stock.divYield >= 6.0) {
    strengths.push(`Dividend Yield robusto de ${formatPercent(stock.divYield)}, atendendo ao critério de Décio Bazin.`);
  }

  if (stock.crescRec5a && stock.crescRec5a >= 15.0) {
    strengths.push(`Forte histórico de expansão de faturamento em 5 anos (${formatPercent(stock.crescRec5a)} CAGR).`);
  }

  const handleFetchAiAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch('/api/ai/analyze-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: stock.papel,
          companyName: stock.nomeEmpresa || stock.papel,
          sector: stock.setor,
          cotacao: stock.cotacao,
          pl: stock.pl,
          pvp: stock.pvp,
          roic: stock.roic,
          roe: stock.roe,
          divLiqPatrim: stock.divLiqPatrim,
          divYield: stock.divYield,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro ${response.status}: Falha ao processar pesquisa com IA.`);
      }

      const data: AIAnalysisResult = await response.json();
      setAiResult(data);
    } catch (err: unknown) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Não foi possível consultar os fatos relevantes com IA.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Top Bar */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/50">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold font-mono text-emerald-400">{stock.papel}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                {stock.setor} {stock.subsetor ? `· ${stock.subsetor}` : ''}
              </span>
            </div>
            <h2 className="text-base text-white font-medium mt-1">
              {stock.nomeEmpresa || stock.papel}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {onOpenAIForecast && (
              <button
                onClick={() => {
                  onOpenAIForecast(stock);
                  onClose();
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md text-xs font-semibold transition-colors"
                title="Abrir Previsões Técnicas, Alvos e Wyckoff IA"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Previsões & Trades IA</span>
              </button>
            )}
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Cotação Atual</span>
              <span className="text-xl font-mono font-bold text-white">
                {formatCurrency(stock.cotacao)}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1 gap-2">
          <button
            onClick={() => setModalTab('quant')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${
              modalTab === 'quant'
                ? 'bg-slate-800 text-emerald-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Raio-X Fundamentalista &amp; Valuation</span>
          </button>
          <button
            onClick={() => {
              setModalTab('ai');
              if (!aiResult && !aiLoading) {
                handleFetchAiAnalysis();
              }
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${
              modalTab === 'ai'
                ? 'bg-slate-800 text-emerald-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fatos Relevantes &amp; Notícias IA (Google Search)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {modalTab === 'quant' ? (
            <>
              {/* 1. Quantitative Valuation Models: Graham & Bazin */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Benjamin Graham Fair Price */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                      <Calculator className="w-4 h-4 text-emerald-400" />
                      <span>Preço Justo de Graham</span>
                    </div>
                    {margemGraham !== null && (
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          margemGraham > 0
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                            : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                        }`}
                      >
                        {margemGraham > 0 ? `+${formatPercent(margemGraham, 1)}` : formatPercent(margemGraham, 1)}
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-400">
                    {grahamPrice ? formatCurrency(grahamPrice) : 'Critérios Não Atendidos'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2 space-y-0.5 border-t border-slate-800/60 pt-2 font-mono">
                    <div className="flex justify-between">
                      <span>LPA (Lucro por Ação):</span>
                      <span className="text-slate-200">{stock.lpa ? formatCurrency(stock.lpa) : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VPA (Valor Patrimonial):</span>
                      <span className="text-slate-200">{stock.vpa ? formatCurrency(stock.vpa) : '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Décio Bazin Ceiling Price */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                      <Shield className="w-4 h-4 text-sky-400" />
                      <span>Preço Teto de Bazin (DY 6%)</span>
                    </div>
                    {margemBazin !== null && (
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          margemBazin > 0
                            ? 'text-sky-400 bg-sky-500/10 border border-sky-500/20'
                            : 'text-slate-400 bg-slate-800'
                        }`}
                      >
                        {margemBazin > 0 ? `+${formatPercent(margemBazin, 1)}` : formatPercent(margemBazin, 1)}
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold font-mono text-sky-400">
                    {bazinPrice ? formatCurrency(bazinPrice) : 'Sem Histórico de DY'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2 space-y-0.5 border-t border-slate-800/60 pt-2 font-mono">
                    <div className="flex justify-between">
                      <span>Dividend Yield Atual:</span>
                      <span className="text-slate-200">{formatPercent(stock.divYield)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Margem de Segurança Bazin:</span>
                      <span className="text-slate-200">
                        {margemBazin ? (margemBazin > 0 ? 'Abaixo do Preço Teto' : 'Acima do Preço Teto') : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Automated Fundamentalist Diagnosis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    <CheckCircle className="w-4 h-4" />
                    <span>Pontos Fortes Fundamentalistas</span>
                  </div>
                  {strengths.length === 0 ? (
                    <p className="text-xs text-slate-500">Nenhum destaque positivo relevante detectado.</p>
                  ) : (
                    <ul className="space-y-2 text-xs text-slate-300">
                      {strengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold leading-none mt-1">✓</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Warnings */}
                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Pontos de Atenção &amp; Riscos</span>
                  </div>
                  {warnings.length === 0 ? (
                    <p className="text-xs text-slate-500">Nenhum fator de risco severo identificado nos dados atuais.</p>
                  ) : (
                    <ul className="space-y-2 text-xs text-slate-300">
                      {warnings.map((warn, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold leading-none mt-1">⚠</span>
                          <span>{warn}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* 3. Detailed Indicators Matrix */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Grade Completa de Indicadores Fundamentalistas
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">P/L (Preço/Lucro)</span>
                    <span className="text-white font-bold text-sm">
                      {stock.pl !== null ? `${formatNumber(stock.pl, 2)}x` : '—'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">P/VP (Patrimônio)</span>
                    <span className="text-white font-bold text-sm">
                      {stock.pvp !== null ? `${formatNumber(stock.pvp, 2)}x` : '—'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">EV / EBITDA</span>
                    <span className="text-white font-bold text-sm">
                      {stock.evEbitda !== null ? `${formatNumber(stock.evEbitda, 2)}x` : '—'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">EV / EBIT</span>
                    <span className="text-white font-bold text-sm">
                      {stock.evEbit !== null ? `${formatNumber(stock.evEbit, 2)}x` : '—'}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">ROIC</span>
                    <span className="text-emerald-400 font-bold text-sm">{formatPercent(stock.roic)}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">ROE</span>
                    <span className="text-sky-400 font-bold text-sm">{formatPercent(stock.roe)}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">Margem EBIT</span>
                    <span className="text-white font-bold text-sm">{formatPercent(stock.mrgEbit)}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">Margem Líquida</span>
                    <span className="text-white font-bold text-sm">{formatPercent(stock.mrgLiq)}</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">Dívida Líq / PL</span>
                    <span className="text-white font-bold text-sm">
                      {stock.divLiqPatrim !== null ? `${formatNumber(stock.divLiqPatrim, 2)}x` : '—'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">Liquidez Corrente</span>
                    <span className="text-white font-bold text-sm">
                      {stock.liqCorr !== null ? `${formatNumber(stock.liqCorr, 2)}x` : '—'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">Liquidez 2 Meses</span>
                    <span className="text-white font-bold text-sm">{formatCompactNumber(stock.liq2meses)}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">Patrimônio Líquido</span>
                    <span className="text-white font-bold text-sm">{formatCompactNumber(stock.patrimLiq)}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* AI Analysis Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Pesquisa em Tempo Real: Fatos Relevantes &amp; Notícias B3
                  </span>
                </div>
                <button
                  onClick={handleFetchAiAnalysis}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-md transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                  <span>{aiLoading ? 'Pesquisando...' : 'Atualizar Pesquisa'}</span>
                </button>
              </div>

              {aiLoading && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-6 text-center space-y-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                    <Globe className="w-4 h-4 animate-spin" />
                  </div>
                  <span className="text-xs font-semibold text-white block">
                    Conectando ao Google Search &amp; Analisando Fatos Relevantes de {stock.papel}...
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Varrendo comunicados à CVM, matérias de mercado e notícias macroeconômicas.
                  </span>
                </div>
              )}

              {aiError && (
                <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{aiError}</span>
                </div>
              )}

              {!aiLoading && aiResult && (
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3 leading-relaxed text-slate-200">
                    {aiResult.analysis.split('\n\n').map((paragraph, idx) => {
                      if (paragraph.startsWith('### ')) {
                        return (
                          <h4
                            key={idx}
                            className="text-xs font-bold text-emerald-400 border-b border-slate-800 pb-1 pt-2 tracking-wide"
                          >
                            {paragraph.replace('### ', '')}
                          </h4>
                        );
                      }
                      if (paragraph.includes('\n- ') || paragraph.startsWith('- ')) {
                        const items = paragraph.split('\n- ').map((item) => item.replace(/^- /, ''));
                        return (
                          <ul key={idx} className="space-y-1 list-disc pl-4 text-slate-300">
                            {items.map((item, itemIdx) => (
                              <li key={itemIdx}>{item}</li>
                            ))}
                          </ul>
                        );
                      }
                      return <p key={idx}>{paragraph}</p>;
                    })}
                  </div>

                  {aiResult.sources && aiResult.sources.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Fontes Encontradas na Web
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {aiResult.sources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-slate-950 hover:bg-slate-850 border border-slate-800 p-2 rounded flex items-center justify-between text-[11px] text-slate-300 transition-colors group"
                          >
                            <span className="truncate group-hover:text-emerald-400 font-medium">
                              {src.title || src.url}
                            </span>
                            <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>Dados fundamentalistas B3 com inteligência artificial</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md transition-colors"
          >
            Fechar Raio-X
          </button>
        </div>
      </div>
    </div>
  );
};
