import React, { useState, useRef } from 'react';
import { StockIndicator } from '../types/stock';
import { Upload, FileSpreadsheet, X, Check, AlertCircle, RefreshCw, FileText } from 'lucide-react';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStocks: (stocks: StockIndicator[], replaceAll: boolean) => void;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen,
  onClose,
  onImportStocks,
}) => {
  const [csvText, setCsvText] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [parsedPreview, setParsedPreview] = useState<Partial<StockIndicator>[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Clean and parse numeric values (handles "R$ 38,40", "14,8%", "1.840.000.000,00", "-0,22", etc.)
  const parseNum = (val: string | undefined): number => {
    if (!val) return 0;
    const clean = val
      .replace(/R\$/g, '')
      .replace(/%/g, '')
      .trim();

    // Check if Brazilian format with dot thousand separator and comma decimal
    if (clean.includes(',') && clean.includes('.')) {
      const normalized = clean.replace(/\./g, '').replace(',', '.');
      return parseFloat(normalized) || 0;
    }
    if (clean.includes(',')) {
      return parseFloat(clean.replace(',', '.')) || 0;
    }
    return parseFloat(clean) || 0;
  };

  const parseCSVContent = (content: string) => {
    setErrorMessage(null);
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setErrorMessage('O arquivo ou texto fornecido está vazio.');
      setParsedPreview([]);
      return;
    }

    // Detect delimiter: semicolon, comma, or tab
    const firstLine = lines[0];
    let delimiter = ';';
    if (firstLine.includes('\t')) {
      delimiter = '\t';
    } else if (firstLine.includes(';') && (firstLine.match(/;/g) || []).length >= 2) {
      delimiter = ';';
    } else if (firstLine.includes(',')) {
      delimiter = ',';
    }

    // Split headers
    const rawHeaders = firstLine.split(delimiter).map((h) =>
      h.trim().replace(/^["']|["']$/g, '').toLowerCase()
    );

    // Helper to find column index matching keywords
    const findCol = (keywords: string[]): number => {
      return rawHeaders.findIndex((h) =>
        keywords.some((k) => h.includes(k))
      );
    };

    const colPapel = findCol(['papel', 'ticker', 'acao', 'código', 'codigo', 'ativo']);
    const colCotacao = findCol(['cotacao', 'cotação', 'preco', 'preço', 'fechamento', 'ult']);
    const colPl = findCol(['p/l', 'pl', 'p_l', 'preco/lucro']);
    const colPvp = findCol(['p/vp', 'pvp', 'p_vp', 'preco/vpa']);
    const colPsr = findCol(['psr', 'p/sr']);
    const colDy = findCol(['dy', 'div.yield', 'dividend', 'yield', 'div_yield', 'div. yield']);
    const colRoic = findCol(['roic', 'retorno/capital']);
    const colRoe = findCol(['roe', 'retorno/pl']);
    const colMargLiq = findCol(['marg. líquida', 'marg. liquida', 'margem liq', 'margem líquida', 'marg_liq']);
    const colEvEbit = findCol(['ev/ebit', 'ev_ebit']);
    const colPatrim = findCol(['patrim. líq', 'patrimonio liq', 'patrimonio líquido', 'patrim_liq']);
    const colLiq2m = findCol(['liq. 2 meses', 'liq. 2m', 'liquidez 2m', 'liq_2m', 'vol_medio']);
    const colSetor = findCol(['setor', 'segmento']);
    const colDpa = findCol(['dpa', 'dividendo/acao', 'dividendo por ação', 'dividendo por acao', 'prov_acao']);
    const colReceita = findCol(['receita líq', 'receita liquida', 'receita líquida', 'receita', 'rec_liq']);

    const startIndex = colPapel !== -1 ? 1 : 0; // If header detected, start from line 1
    const results: StockIndicator[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 2) continue;

      let ticker = '';
      if (colPapel !== -1 && cols[colPapel]) {
        ticker = cols[colPapel].toUpperCase().trim();
      } else {
        ticker = cols[0].toUpperCase().trim();
      }

      // Basic ticker validation: 4-6 chars (e.g. PETR4, BBAS3, TAEE11)
      if (!ticker || ticker.length < 3) continue;

      const cotVal = colCotacao !== -1 ? parseNum(cols[colCotacao]) : parseNum(cols[1]);
      const plVal = colPl !== -1 ? parseNum(cols[colPl]) : parseNum(cols[2]);
      const pvpVal = colPvp !== -1 ? parseNum(cols[colPvp]) : parseNum(cols[3]);
      const dyVal = colDy !== -1 ? parseNum(cols[colDy]) : parseNum(cols[5]);
      const roicVal = colRoic !== -1 ? parseNum(cols[colRoic]) : parseNum(cols[15]);
      const roeVal = colRoe !== -1 ? parseNum(cols[colRoe]) : parseNum(cols[16]);
      const margLiqVal = colMargLiq !== -1 ? parseNum(cols[colMargLiq]) : parseNum(cols[13]);
      const evEbitVal = colEvEbit !== -1 ? parseNum(cols[colEvEbit]) : parseNum(cols[10]);
      const liq2mVal = colLiq2m !== -1 ? parseNum(cols[colLiq2m]) : parseNum(cols[17]) || 15000000;
      const patrimVal = colPatrim !== -1 ? parseNum(cols[colPatrim]) : parseNum(cols[18]) || 5000000000;
      const setorVal = colSetor !== -1 && cols[colSetor] ? cols[colSetor] : 'Ações B3';
      const dpaVal = colDpa !== -1 ? parseNum(cols[colDpa]) : Number(((cotVal * dyVal) / 100).toFixed(2));
      const receitaVal = colReceita !== -1 ? parseNum(cols[colReceita]) : 12000000000;

      const validCot = cotVal > 0 ? cotVal : 10;

      results.push({
        id: ticker.toLowerCase() + '_' + Date.now() + '_' + i,
        papel: ticker,
        nomeEmpresa: `${ticker} S.A.`,
        setor: setorVal,
        subsetor: setorVal,
        cotacao: validCot,
        pl: plVal,
        pvp: pvpVal,
        psr: colPsr !== -1 ? parseNum(cols[colPsr]) : 1.0,
        divYield: dyVal,
        pAtivo: 0.5,
        pCapGiro: 2.0,
        pEbit: 4.5,
        pAtivCircLiq: -0.5,
        evEbit: evEbitVal || 5.0,
        evEbitda: (evEbitVal || 5.0) * 0.85,
        margEbit: margLiqVal * 1.3,
        margLiquida: margLiqVal,
        liqCorr: 1.5,
        roic: roicVal,
        roe: roeVal,
        liq2m: liq2mVal,
        patrimLiq: patrimVal,
        divBrutPatrim: 0.5,
        crescRec5a: 10.0,
        valorMercado: validCot * 10000000,
        dividaLiquidaEbitda: 1.2,
        caixaDisponivel: 1000000000,
        receitaLiquida12m: receitaVal,
        lucroLiquido12m: 1000000000,
        dividendo12mPorAcao: dpaVal,
        totalProventosPagos12m: Number((dpaVal * 10000000).toFixed(0)),
        payoutMedio: Math.min(100, Math.max(15, Math.round((dyVal / (100 / (plVal > 0 ? plVal : 10))) * 100))),
        governanca: 'Novo Mercado',
        freeFloat: 55,
        frequenciaDividendos: dyVal > 7 ? 'Trimestral' : 'Semestral',
        principaisAcionistas: 'Fundos de Ações, Investidores Institucionais e Estrangeiros',
        fluxoEstrangeiro30dMilhoes: 45.0,
        fluxoInstitucional30dMilhoes: 35.0,
        padraoWyckoff: roicVal > 15 ? 'Acumulação Silenciosa' : 'Neutro / Equilíbrio',
        insiderTransactions: 'Compras Moderadas',
        smartMoneyScore: Math.min(95, Math.max(50, Math.round(50 + (roicVal > 15 ? 25 : 0) + (dyVal > 7 ? 20 : 0)))),
        pontoEntrada: Number((validCot * 0.98).toFixed(2)),
        stopLoss: Number((validCot * 0.91).toFixed(2)),
        alvo1CurtoPrazo: Number((validCot * 1.15).toFixed(2)),
        alvo2LongoPrazo: Number((validCot * 1.35).toFixed(2)),
        riscoRetorno: '1:3.2',
        tendenciaTecnica: 'Alta Moderada',
        padraoGrafico: 'Acúmulo com Médias Alinhadas',
        rsi14: 52,
        precoJustoGraham: Number((validCot * 1.25).toFixed(2)),
        descontoGrahamPerc: 20,
        precoTetoBazin: Number(((validCot * (dyVal || 6) / 100) / 0.06).toFixed(2)),
        piotroskiFScore: 7,
        scoreAlpha: 80,
        teseCurtoPrazo: 'Ativo importado com múltiplos atrativos de valuation.',
        teseLongoPrazo: 'Potencial de geração de proventos e rentabilidade sobre o capital.'
      });
    }

    if (results.length === 0) {
      setErrorMessage('Não foi possível identificar linhas de dados válidas. Verifique o formato do arquivo.');
      setParsedPreview([]);
    } else {
      setParsedPreview(results);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseCSVContent(text);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (parsedPreview.length === 0) return;
    onImportStocks(parsedPreview as StockIndicator[], importMode === 'replace');
    onClose();
  };

  const loadExampleTemplate = () => {
    const template = `Papel;Cotação;P/L;P/VP;PSR;Div.Yield;ROIC;ROE;Margem Líquida;EV/EBIT;Setor
PETR4;38,40;4,82;1,15;0,92;14,80%;24,80%;28,50%;24,50%;2,78;Petróleo e Gás
VALE3;61,20;5,84;1,38;1,45;8,85%;22,50%;24,10%;24,80%;4,65;Mineração
BBAS3;28,90;4,12;0,74;0,85;10,95%;19,80%;22,40%;18,20%;3,10;Bancos
WEGE3;52,80;28,40;8,90;5,10;2,35%;32,80%;33,50%;17,50%;21,10;Bens Industriais
TAEE11;35,80;8,40;1,68;3,20;9,90%;16,40%;20,80%;52,40%;8,80;Energia Elétrica
EGIE3;41,80;9,45;2,45;2,65;7,95%;18,90%;25,40%;29,50%;8,95;Energia Elétrica
BBSE3;34,20;8,25;5,40;5,80;9,85%;62,40%;68,50%;86,40%;7,45;Seguridade`;

    setCsvText(template);
    parseCSVContent(template);
    setFileName('template_exemplo_b3.csv');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Importação de Dados via CSV
              </h3>
              <p className="text-xs text-slate-400">
                Importe planilhas completas com indicadores fundamentalistas da B3 (Status Invest, Fundamentus ou planilha própria).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload & Paste Area */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* File Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-5 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl bg-slate-950/60 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group"
            >
              <Upload className="w-8 h-8 text-slate-400 group-hover:text-emerald-400 transition-colors mb-2" />
              <div className="text-xs font-semibold text-slate-200">
                {fileName ? fileName : 'Clique para selecionar arquivo CSV'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Suporta .csv, .tsv ou .txt com separador por ponto-e-vírgula ou vírgula
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Template / Quick action */}
            <div className="p-4 border border-slate-800 rounded-xl bg-slate-950/40 flex flex-col justify-between text-xs space-y-3">
              <div>
                <span className="font-semibold text-slate-200 block mb-1">
                  Modelo Padrão de Colunas
                </span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Reconhecimento automático das colunas da B3: <code>Papel</code>, <code>Cotação</code>, <code>P/L</code>, <code>P/VP</code>, <code>Div.Yield</code>, <code>ROIC</code>, <code>ROE</code> e <code>Margem Líquida</code>.
                </p>
              </div>

              <button
                type="button"
                onClick={loadExampleTemplate}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-medium border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Carregar Modelo de Exemplo</span>
              </button>
            </div>
          </div>

          {/* Paste CSV text area */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Ou cole o conteúdo CSV diretamente abaixo:</span>
              {parsedPreview.length > 0 && (
                <span className="font-mono text-emerald-400 font-semibold">
                  {parsedPreview.length} ativos identificados
                </span>
              )}
            </div>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                parseCSVContent(e.target.value);
              }}
              placeholder="Cole aqui o texto CSV (ex: PETR4;38,40;4,82;1,15;14,80%;24,80%)..."
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Preview Table */}
          {parsedPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  Pré-visualização dos Ativos a Importar ({parsedPreview.length}):
                </span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="accent-emerald-500"
                    />
                    <span>Substituir Base Atual</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="accent-emerald-500"
                    />
                    <span>Mesclar / Atualizar</span>
                  </label>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900 text-slate-400 text-[11px] sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Papel</th>
                      <th className="py-2 px-3 text-right">Cotação</th>
                      <th className="py-2 px-3 text-right">P/L</th>
                      <th className="py-2 px-3 text-right">P/VP</th>
                      <th className="py-2 px-3 text-right">DY (%)</th>
                      <th className="py-2 px-3 text-right">ROIC (%)</th>
                      <th className="py-2 px-3">Setor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 text-[11px]">
                    {parsedPreview.slice(0, 10).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        <td className="py-1.5 px-3 font-bold text-emerald-400">{item.papel}</td>
                        <td className="py-1.5 px-3 text-right">R$ {item.cotacao?.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right">{item.pl?.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right">{item.pvp?.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right text-amber-300">{item.divYield?.toFixed(2)}%</td>
                        <td className="py-1.5 px-3 text-right text-emerald-400">{item.roic?.toFixed(2)}%</td>
                        <td className="py-1.5 px-3 text-slate-400 truncate max-w-[150px]">{item.setor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedPreview.length > 10 && (
                <div className="text-[11px] text-slate-500 text-right">
                  + {parsedPreview.length - 10} outros ativos listados no arquivo...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={parsedPreview.length === 0}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Check className="w-4 h-4" />
            <span>Confirmar Importação de {parsedPreview.length} Ativos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
