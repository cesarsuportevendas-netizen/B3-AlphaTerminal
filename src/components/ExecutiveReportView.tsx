import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StockIndicator } from '../types/stock';
import { formatCurrency, formatPercent } from '../utils/financialCalculations';
import {
  Printer,
  Download,
  Sparkles,
  FileText,
  Mail,
  RefreshCw,
  Globe,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

interface MacroOutlookData {
  panoramaMacro: string;
  fluxoCapital: string;
  observacoesCarteira?: string;
  riscosEAtencao?: string[];
  sources?: { title: string; url: string }[];
  grounded?: boolean;
  updatedAt?: string;
}

interface ExecutiveReportViewProps {
  stocks: StockIndicator[];
  onExportCSV: () => void;
  onSendByGmail?: () => void;
}

function sanitizePdfText(raw: string): string {
  // jsPDF built-in Helvetica handles Latin-1; normalize special unicode arrows/dashes safely
  return String(raw || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/\u00A0/g, ' ');
}

export const ExecutiveReportView: React.FC<ExecutiveReportViewProps> = ({
  stocks,
  onExportCSV,
  onSendByGmail,
}) => {
  const top10 = useMemo(
    () => [...stocks].sort((a, b) => (b.scoreAlpha || 0) - (a.scoreAlpha || 0)).slice(0, 10),
    [stocks]
  );

  const [macroOutlook, setMacroOutlook] = useState<MacroOutlookData | null>(null);
  const [isGeneratingMacro, setIsGeneratingMacro] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const fetchMacroOutlook = async () => {
    setIsGeneratingMacro(true);
    try {
      const res = await fetch('/api/ai/market-outlook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top10Stocks: top10, totalStocksCount: stocks.length }),
      });
      if (res.ok) {
        const data = (await res.json()) as MacroOutlookData;
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
  const totalScore = top10.reduce((acc, s) => acc + (s.scoreAlpha || 0), 0);
  const allocations = useMemo(
    () =>
      top10.map((s) => ({
        stock: s,
        weight: Number((((s.scoreAlpha || 0) / (totalScore || 1)) * 100).toFixed(1)),
        upsideGraham: s.descontoGrahamPerc,
        upsideTarget1:
          s.cotacao > 0
            ? Number((((s.alvo1CurtoPrazo - s.cotacao) / s.cotacao) * 100).toFixed(1))
            : 0,
      })),
    [top10, totalScore]
  );

  const portfolioAverages = useMemo(() => {
    if (top10.length === 0) {
      return { avgPL: 0, avgPVP: 0, avgROIC: 0, avgDY: 0, avgScore: 0 };
    }
    const count = top10.length;
    return {
      avgPL: top10.reduce((acc, s) => acc + (Number(s.pl) || 0), 0) / count,
      avgPVP: top10.reduce((acc, s) => acc + (Number(s.pvp) || 0), 0) / count,
      avgROIC: top10.reduce((acc, s) => acc + (Number(s.roic) || 0), 0) / count,
      avgDY: top10.reduce((acc, s) => acc + (Number(s.divYield) || 0), 0) / count,
      avgScore: top10.reduce((acc, s) => acc + (Number(s.scoreAlpha) || 0), 0) / count,
    };
  }, [top10]);

  const reportDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const handleDownloadProfessionalPDF = () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 14;
      const contentW = pageWidth - marginX * 2;

      // 1. Corporate Top Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 34, 'F');

      doc.setFillColor(16, 185, 129); // emerald-500 accent bar
      doc.rect(0, 34, pageWidth, 1.4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(52, 211, 153);
      doc.text('B3 ALPHATERMINAL PRO  |  RELATORIO EXECUTIVO OFICIAL', marginX, 11);

      doc.setFontSize(17);
      doc.setTextColor(255, 255, 255);
      doc.text('Dossie Quantitativo de Carteira & Valuation B3', marginX, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225);
      doc.text(
        sanitizePdfText(
          `Emissao: ${reportDate}  |  Universo Analisado: ${stocks.length} ativos  |  Top ${top10.length} Selecionados`
        ),
        marginX,
        28
      );

      let cursorY = 43;

      // 2. KPI Summary Boxes (4 Columns)
      const kpis = [
        { label: 'P/L Medio Top 10', value: `${portfolioAverages.avgPL.toFixed(2)}x` },
        { label: 'ROIC Medio', value: `${portfolioAverages.avgROIC.toFixed(1)}%` },
        { label: 'Dividend Yield Medio', value: `${portfolioAverages.avgDY.toFixed(1)}% a.a.` },
        { label: 'Score Alpha Medio', value: `${portfolioAverages.avgScore.toFixed(0)} / 100` },
      ];
      const boxGap = 3.5;
      const boxW = (contentW - boxGap * 3) / 4;
      const boxH = 16;

      kpis.forEach((kpi, idx) => {
        const bx = marginX + idx * (boxW + boxGap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(bx, cursorY, boxW, boxH, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(sanitizePdfText(kpi.label), bx + 3, cursorY + 5.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        doc.setTextColor(15, 23, 42);
        doc.text(sanitizePdfText(kpi.value), bx + 3, cursorY + 12.5);
      });

      cursorY += boxH + 8;

      const ensurePageSpace = (neededMm: number) => {
        if (cursorY + neededMm > pageHeight - 20) {
          doc.addPage();
          cursorY = 18;
        }
      };

      const drawSectionTitle = (title: string) => {
        ensurePageSpace(14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(sanitizePdfText(title), marginX, cursorY);
        doc.setDrawColor(16, 185, 129);
        doc.setLineWidth(0.5);
        doc.line(marginX, cursorY + 2, marginX + contentW, cursorY + 2);
        cursorY += 7;
      };

      const drawParagraphBlock = (subtitle: string, bodyText: string) => {
        const lines = doc.splitTextToSize(sanitizePdfText(bodyText), contentW);
        const blockHeight = 5 + lines.length * 4.3 + 3;
        ensurePageSpace(blockHeight);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(5, 150, 105);
        doc.text(sanitizePdfText(subtitle), marginX, cursorY);
        cursorY += 4.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.8);
        doc.setTextColor(51, 65, 85);
        doc.text(lines, marginX, cursorY);
        cursorY += lines.length * 4.3 + 3.5;
      };

      // 3. Section 1: Executive AI Commentary
      drawSectionTitle('1. Parecer Executivo da IA & Cenario Macroeconomico');

      const macroTxt =
        macroOutlook?.panoramaMacro ||
        'A selecao quantitativa prioriza empresas da B3 com elevado retorno sobre capital investido (ROIC), geracao de fluxo de caixa livre e multiplos descontados frente as medias historicas.';
      const capitalTxt =
        macroOutlook?.fluxoCapital ||
        'O fluxo institucional aponta rotacao seletiva para pagadoras de dividendos consistentes e companhias com baixa alavancagem financeira.';
      const obsTxt =
        macroOutlook?.observacoesCarteira ||
        'Recomenda-se execucao disciplinada utilizando os Pontos de Entrada sugeridos e protecao via Stop Loss Tecnico individual para mitigar oscilacoes de curto prazo.';

      drawParagraphBlock('PANORAMA MACRO & VALUATION B3', macroTxt);
      drawParagraphBlock('FLUXO DE CAPITAL INSTITUCIONAL', capitalTxt);
      drawParagraphBlock('OBSERVACOES ESTRATEGICAS DA IA PARA A CARTEIRA', obsTxt);

      if (macroOutlook?.riscosEAtencao && macroOutlook.riscosEAtencao.length > 0) {
        ensurePageSpace(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(180, 83, 9);
        doc.text('PONTOS DE ATENCAO & RISCOS MONITORADOS', marginX, cursorY);
        cursorY += 4.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        macroOutlook.riscosEAtencao.forEach((r) => {
          const rLines = doc.splitTextToSize(sanitizePdfText(`- ${r}`), contentW - 2);
          ensurePageSpace(rLines.length * 4.2 + 2);
          doc.text(rLines, marginX + 1, cursorY);
          cursorY += rLines.length * 4.2 + 1.5;
        });
        cursorY += 3;
      }

      // 4. Section 2: Allocation & Trade Setup Table (Top 10)
      drawSectionTitle('2. Matriz de Alocacao Recomendada & Niveis de Trade (Top 10)');

      autoTable(doc, {
        startY: cursorY,
        margin: { left: marginX, right: marginX },
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.3,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { fontStyle: 'bold', cellWidth: 16 },
          3: { halign: 'right' },
          4: { halign: 'right', fontStyle: 'bold' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'right' },
          9: { halign: 'right' },
          10: { halign: 'right' },
          11: { halign: 'center' },
          12: { halign: 'right', fontStyle: 'bold' },
        },
        head: [
          [
            '#',
            'Ativo',
            'Empresa',
            'Cotacao',
            'Peso',
            'P/L',
            'ROIC',
            'DY',
            'Entrada',
            'Stop',
            'Alvo 1',
            'R/R',
            'Score',
          ],
        ],
        body: allocations.map(({ stock, weight }, idx) => [
          `${idx + 1}`,
          sanitizePdfText(stock.papel),
          sanitizePdfText(String(stock.nomeEmpresa || stock.papel).slice(0, 24)),
          formatCurrency(stock.cotacao),
          `${weight.toFixed(1)}%`,
          `${stock.pl.toFixed(1)}x`,
          `${stock.roic.toFixed(1)}%`,
          `${stock.divYield.toFixed(1)}%`,
          formatCurrency(stock.pontoEntrada),
          formatCurrency(stock.stopLoss),
          formatCurrency(stock.alvo1CurtoPrazo),
          sanitizePdfText(stock.riscoRetorno || '-'),
          `${stock.scoreAlpha}`,
        ]),
      });

      const lastTableY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY;
      cursorY = (lastTableY || cursorY + 40) + 9;

      // 5. Section 3: Intrinsic Valuation & Institutional Signals
      drawSectionTitle('3. Valuation Intrinseco (Graham / Bazin) & Sinais Tecnicos');

      autoTable(doc, {
        startY: cursorY,
        margin: { left: marginX, right: marginX },
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.3,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        head: [
          [
            'Ativo',
            'Setor',
            'Preco Graham',
            'Margem Graham',
            'Teto Bazin',
            'RSI(14)',
            'Sinal / Tendencia',
            'Smart Money / Wyckoff',
          ],
        ],
        body: top10.map((s) => [
          sanitizePdfText(s.papel),
          sanitizePdfText(String(s.setor || 'Diversos').slice(0, 18)),
          formatCurrency(s.precoJustoGraham),
          `${s.descontoGrahamPerc >= 0 ? '+' : ''}${Number(s.descontoGrahamPerc || 0).toFixed(1)}%`,
          formatCurrency(s.precoTetoBazin),
          `${s.rsi14 ?? 50}`,
          sanitizePdfText(s.tradeSignalRecomendacao || s.tendenciaTecnica),
          sanitizePdfText(`${s.smartMoneyScore}/100 - ${s.padraoWyckoff}`.slice(0, 30)),
        ]),
      });

      const lastValTableY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY;
      cursorY = (lastValTableY || cursorY + 40) + 9;

      // 6. Section 4: Individual Stock Strategic Theses
      drawSectionTitle('4. Sintese das Teses por Ativo (Top 6)');

      top10.slice(0, 6).forEach((s) => {
        const thesisText = `Curto Prazo: ${s.teseCurtoPrazo} | Longo Prazo: ${s.teseLongoPrazo}`;
        const lines = doc.splitTextToSize(sanitizePdfText(thesisText), contentW - 6);
        const cardH = 8 + lines.length * 4 + 4;
        ensurePageSpace(cardH + 2);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, cursorY, contentW, cardH, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(
          sanitizePdfText(`${s.papel} - ${s.nomeEmpresa}`),
          marginX + 3,
          cursorY + 5.5
        );

        doc.setTextColor(5, 150, 105);
        doc.text(
          sanitizePdfText(`Score ${s.scoreAlpha}/100  |  Entrada ${formatCurrency(s.pontoEntrada)}  |  Alvo ${formatCurrency(s.alvo1CurtoPrazo)}`),
          marginX + contentW - 3,
          cursorY + 5.5,
          { align: 'right' }
        );

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(lines, marginX + 3, cursorY + 10.5);

        cursorY += cardH + 3.5;
      });

      // 7. Legal Disclaimer Box
      const disclaimer =
        'Aviso Legal (Resolucao CVM n 20/2021): Este relatorio foi gerado pelo B3 AlphaTerminal PRO com base em modelos quantitativos de valuation, indicadores historicos e pesquisa automatizada de mercado. As estimativas apresentadas nao constituem recomendacao individualizada de compra ou venda de valores mobiliarios.';
      const dLines = doc.splitTextToSize(disclaimer, contentW - 4);
      ensurePageSpace(dLines.length * 3.8 + 10);
      cursorY += 2;
      doc.setDrawColor(203, 213, 225);
      doc.line(marginX, cursorY, marginX + contentW, cursorY);
      cursorY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      doc.text(dLines, marginX, cursorY);

      // 8. Add Corporate Footer & Pagination on Every Page
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, pageHeight - 12, marginX + contentW, pageHeight - 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          sanitizePdfText(`B3 AlphaTerminal PRO · Relatorio Executivo · ${reportDate}`),
          marginX,
          pageHeight - 7
        );
        doc.text(
          `Pagina ${p} de ${totalPages}`,
          pageWidth - marginX,
          pageHeight - 7,
          { align: 'right' }
        );
      }

      const fileDate = new Date().toISOString().slice(0, 10);
      doc.save(`b3-alpha-relatorio-executivo-${fileDate}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header (Hidden in Print) */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Relatório Executivo de Carteira & Valuation
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dossiê consolidado com os indicadores da carteira Top 10 B3, parecer estratégico da IA (Google Search) e exportação profissional em PDF.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownloadProfessionalPDF}
            disabled={isGeneratingPdf || top10.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>{isGeneratingPdf ? 'Gerando PDF...' : 'Baixar PDF Profissional'}</span>
          </button>

          <button
            type="button"
            onClick={fetchMacroOutlook}
            disabled={isGeneratingMacro}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-emerald-300 font-medium text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Atualizar parecer macroeconômico e observações da carteira com Google Search"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingMacro ? 'animate-spin' : ''}`} />
            <span>{isGeneratingMacro ? 'Atualizando IA...' : 'Atualizar Parecer IA'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>

          <button
            type="button"
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          {onSendByGmail && (
            <button
              type="button"
              onClick={onSendByGmail}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-semibold text-xs rounded-lg border border-rose-500/30 transition-colors cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Enviar por Gmail</span>
            </button>
          )}
        </div>
      </div>

      {/* The Printable Dossier Container */}
      <div className="p-6 sm:p-10 rounded-2xl bg-slate-900 border border-slate-800 print:bg-white print:text-slate-900 print:border-none print:p-0 space-y-8">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-6 border-b border-slate-800 print:border-slate-300 gap-4">
          <div>
            <div className="text-xs font-mono tracking-widest text-emerald-400 print:text-emerald-700 uppercase font-bold">
              B3 AlphaTerminal · Relatório Estratégico Oficial
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white print:text-slate-950 mt-1">
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

        {/* Portfolio Quantitative Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950 print:bg-slate-50 border border-slate-800 print:border-slate-200">
            <div className="text-[11px] font-mono uppercase text-slate-400 print:text-slate-600">
              P/L Médio Top 10
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-white print:text-slate-900 mt-1">
              {portfolioAverages.avgPL.toFixed(2)}x
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950 print:bg-slate-50 border border-slate-800 print:border-slate-200">
            <div className="text-[11px] font-mono uppercase text-slate-400 print:text-slate-600">
              ROIC Médio
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-400 print:text-emerald-700 mt-1">
              {portfolioAverages.avgROIC.toFixed(1)}%
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950 print:bg-slate-50 border border-slate-800 print:border-slate-200">
            <div className="text-[11px] font-mono uppercase text-slate-400 print:text-slate-600">
              Dividend Yield Médio
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-300 print:text-amber-700 mt-1">
              {portfolioAverages.avgDY.toFixed(1)}%
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950 print:bg-slate-50 border border-slate-800 print:border-slate-200">
            <div className="text-[11px] font-mono uppercase text-slate-400 print:text-slate-600">
              Score Alpha Médio
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-cyan-300 print:text-cyan-700 mt-1">
              {portfolioAverages.avgScore.toFixed(0)}/100
            </div>
          </div>
        </div>

        {/* Section 1: Executive Macro Summary & AI Portfolio Observations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 print:border-slate-200 pb-2">
            <h3 className="text-base font-bold text-white print:text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
              <span>1. Parecer Executivo da IA & Alocação de Capital</span>
            </h3>
            {macroOutlook?.grounded && (
              <span className="text-[11px] font-mono text-emerald-400 print:text-emerald-700 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>Google Search Grounding</span>
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-300 print:text-slate-700 leading-relaxed">
            <div>
              <div className="text-[11px] font-mono uppercase text-emerald-400 print:text-emerald-700 font-semibold mb-0.5">
                Panorama Macroeconômico & Valuation
              </div>
              <p>
                {macroOutlook?.panoramaMacro ||
                  'A bolsa de valores brasileira apresenta valuation atrativo frente às médias históricas de 10 anos. Empresas com alta rentabilidade sobre o capital investido (ROIC > 15%), geração consistente de fluxo de caixa livre e baixo endividamento líquido oferecem a melhor assimetria para composição de patrimônio.'}
              </p>
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase text-cyan-400 print:text-cyan-700 font-semibold mb-0.5">
                Fluxo de Capital Institucional
              </div>
              <p>
                {macroOutlook?.fluxoCapital ||
                  'O fluxo institucional recente indica rotação gradual do capital estrangeiro e fundos de previdência para companhias líderes em dividendos e commodities com baixo custo de produção.'}
              </p>
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase text-amber-300 print:text-amber-700 font-semibold mb-0.5">
                Observações Estratégicas da IA para a Carteira
              </div>
              <p>
                {macroOutlook?.observacoesCarteira ||
                  'Recomenda-se escalonar aportes nos Pontos de Entrada sugeridos, manter proteção via Stop Loss técnico e acompanhar a correlação entre ativos cíclicos e bancários.'}
              </p>
            </div>

            {macroOutlook?.riscosEAtencao && macroOutlook.riscosEAtencao.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-950 print:bg-slate-50 border border-slate-800 print:border-slate-200 space-y-1.5">
                <div className="text-[11px] font-mono uppercase text-amber-300 print:text-amber-700 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Pontos de Atenção & Riscos Monitorados</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-300 print:text-slate-700">
                  {macroOutlook.riscosEAtencao.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {macroOutlook?.sources && macroOutlook.sources.length > 0 && (
              <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-1">
                <span className="font-mono uppercase text-slate-500">Fontes IA:</span>
                {macroOutlook.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:underline max-w-[240px] truncate"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{src.title}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Top 10 Portfolio Allocation Matrix */}
        <div className="space-y-3">
          <h3 className="text-base font-bold text-white print:text-slate-900 border-b border-slate-800 print:border-slate-200 pb-2">
            2. Matriz de Alocação Recomendada & Níveis Técnicos (Top 10 B3)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className="border-b border-slate-800 print:border-slate-300 text-slate-400 print:text-slate-600 font-mono text-[11px] uppercase">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Ativo</th>
                  <th className="py-2 px-2">Empresa</th>
                  <th className="py-2 px-2 text-right">Cotação</th>
                  <th className="py-2 px-2 text-right">Peso</th>
                  <th className="py-2 px-2 text-right">P/L</th>
                  <th className="py-2 px-2 text-right">ROIC</th>
                  <th className="py-2 px-2 text-right">DY</th>
                  <th className="py-2 px-2 text-right">Entrada</th>
                  <th className="py-2 px-2 text-right">Stop Loss</th>
                  <th className="py-2 px-2 text-right">Alvo 1</th>
                  <th className="py-2 px-2 text-right">R/R</th>
                  <th className="py-2 px-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-200 font-mono text-[12px] tabular-nums">
                {allocations.map(({ stock, weight }, idx) => (
                  <tr key={stock.id} className="hover:bg-slate-800/30 print:hover:bg-transparent">
                    <td className="py-2.5 px-2 text-slate-500 font-bold">#{idx + 1}</td>
                    <td className="py-2.5 px-2 font-bold text-white print:text-slate-900">{stock.papel}</td>
                    <td className="py-2.5 px-2 font-sans text-slate-300 print:text-slate-700 truncate max-w-[140px]">
                      {stock.nomeEmpresa}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-200 print:text-slate-900">
                      {formatCurrency(stock.cotacao)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-emerald-400 print:text-emerald-700">
                      {weight}%
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-300 print:text-slate-700">
                      {stock.pl.toFixed(2)}x
                    </td>
                    <td className="py-2.5 px-2 text-right text-emerald-400 print:text-emerald-700">
                      {formatPercent(stock.roic)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-amber-300 print:text-amber-700">
                      {formatPercent(stock.divYield)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-200 print:text-slate-900">
                      {formatCurrency(stock.pontoEntrada)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-rose-400 print:text-rose-700">
                      {formatCurrency(stock.stopLoss)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-cyan-300 print:text-cyan-700">
                      {formatCurrency(stock.alvo1CurtoPrazo)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-300 print:text-slate-700">
                      {stock.riscoRetorno}
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-emerald-400 print:text-emerald-700">
                      {stock.scoreAlpha}
                    </td>
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
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono font-bold text-sm text-white print:text-slate-900">
                    {stock.papel} - {stock.nomeEmpresa}
                  </div>
                  <span className="font-mono text-emerald-400 print:text-emerald-700 font-semibold shrink-0">
                    Score {stock.scoreAlpha}/100
                  </span>
                </div>
                <div className="text-slate-300 print:text-slate-700 leading-relaxed font-sans">
                  <strong>Tese: </strong>
                  {stock.teseCurtoPrazo}
                </div>
                <div className="flex items-center justify-between text-slate-400 print:text-slate-600 pt-1 border-t border-slate-900 print:border-slate-200 font-mono text-[11px]">
                  <span>Preço Graham: {formatCurrency(stock.precoJustoGraham)}</span>
                  <span>Teto Bazin: {formatCurrency(stock.precoTetoBazin)}</span>
                  <span>R/R: {stock.riscoRetorno}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Legal Disclaimer */}
        <div className="pt-6 border-t border-slate-800 print:border-slate-300 text-[10px] text-slate-500 print:text-slate-500 space-y-1 font-sans">
          <p className="font-semibold text-slate-400 print:text-slate-700">
            Aviso Legal & Isenção de Responsabilidade:
          </p>
          <p>
            Este relatório foi gerado automaticamente pelo B3 AlphaTerminal com base em modelos quantitativos de valuation fundamentalista e análise de dados públicos de empresas listadas na B3. As estimativas de preço justo e pontos de entrada não constituem recomendação formal individualizada nos termos da Resolução CVM nº 20/2021. Investimentos em renda variável estão sujeitos a riscos de oscilação de mercado.
          </p>
        </div>
      </div>
    </div>
  );
};
