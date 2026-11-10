import * as XLSX from 'xlsx';
import { StockData } from '../types/stock';
import { parseSafeFloat, parseSafeNumberWithDefault } from './dataCleaner';
import { getCompanyFullName } from './companyNames';

/**
 * Normalizes column header keys by removing accents, spaces, and punctuation
 */
export function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Parses raw JSON rows from XLSX or CSV into typed StockData array
 */
export function parseExcelRows(rawRows: Record<string, unknown>[]): StockData[] {
  return rawRows
    .map((row, index) => {
      // Map keys normalized
      const normalizedMap: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        normalizedMap[normalizeKey(key)] = value;
      }

      // Helper to find value from potential header variations
      const getVal = (...variants: string[]) => {
        for (const variant of variants) {
          const norm = normalizeKey(variant);
          if (normalizedMap[norm] !== undefined && normalizedMap[norm] !== null) {
            return normalizedMap[norm];
          }
        }
        return null;
      };

      const papelRaw = getVal('papel', 'ticker', 'acao', 'codigo', 'ativo', 'papéis', 'empresa');
      const papel = papelRaw ? String(papelRaw).toUpperCase().trim() : `ACAO${index + 1}`;
      if (!papel || papel.length < 3) return null;

      const cotacao = parseSafeNumberWithDefault(getVal('cotacao', 'preco', 'price', 'cotacao atual', 'cotacao (r$)'), 0);
      const pl = parseSafeFloat(getVal('pl', 'p/l', 'p_l', 'pe'));
      const pvp = parseSafeFloat(getVal('pvp', 'p/vp', 'p_vp', 'pb'));
      const psr = parseSafeFloat(getVal('psr', 'p/sr', 'p_sr', 'ps'));
      const divYield = parseSafeFloat(getVal('divyield', 'div.yield', 'dy', 'dividend yield', 'dividendyield', 'div. yield (%)', 'dy (%)'));
      const pAtivo = parseSafeFloat(getVal('pativo', 'p/ativo', 'p_ativo'));
      const pCapGiro = parseSafeFloat(getVal('pcapgiro', 'p/cap.giro', 'p/capgiro', 'p_capgiro'));
      const pEbit = parseSafeFloat(getVal('pebit', 'p/ebit', 'p_ebit'));
      const pAtivCircLiq = parseSafeFloat(getVal('pativcircliq', 'p/ativcircliq', 'p/ativ.circ.liq'));
      const evEbitda = parseSafeFloat(getVal('evebitda', 'ev/ebitda', 'ev_ebitda'));
      const evEbit = parseSafeFloat(getVal('evebit', 'ev/ebit', 'ev_ebit'));
      const mrgEbit = parseSafeFloat(getVal('mrgebit', 'margem ebit', 'margemebit', 'mrg. ebit', 'margem ebit (%)'));
      const mrgLiq = parseSafeFloat(getVal('mrgliq', 'margem liquida', 'margemliquida', 'mrg. liq', 'margem liquida (%)'));
      const mrgBruta = parseSafeFloat(getVal('mrgbruta', 'margem bruta', 'margembruta', 'mrg. bruta', 'margem bruta (%)'));
      const liqCorr = parseSafeFloat(getVal('liqcorr', 'liq. corr.', 'liquidez corrente', 'liq.corr', 'liq. corrente'));
      const roic = parseSafeFloat(getVal('roic', 'roic (%)'));
      const roe = parseSafeFloat(getVal('roe', 'roe (%)'));
      const liq2meses = parseSafeNumberWithDefault(getVal('liq2meses', 'liq.2meses', 'liquidez 2 meses', 'liq. 2 meses', 'liq2m', 'liq. 2 meses (r$)'), 0);
      const patrimLiq = parseSafeNumberWithDefault(getVal('patrimliq', 'patrim. liq', 'patrimonio liquido', 'patrim.liq', 'pl patrim', 'patrimonio liquido (r$)'), 0);
      const divBrutaPatrim = parseSafeFloat(getVal('divbrutapatrim', 'div.bruta/patrim', 'divida bruta / patrimonio'));
      const divLiqPatrim = parseSafeFloat(getVal('divliqpatrim', 'div.liq/patrim', 'divida liquida / patrimonio', 'div. liq / patrim', 'divida liquida / patrim. liq.', 'div. liq / pl'));
      const crescRec5a = parseSafeFloat(getVal('crescrec5a', 'cresc. rec.5a', 'crescimento receita 5 anos', 'cresc.rec.5a', 'crescreceita5a', 'cresc. rec. 5a (%)'));
      const setorRaw = getVal('setor', 'sector', 'segmento');
      const subsetorRaw = getVal('subsetor', 'subsector');
      const nomeEmpresaRaw = getVal('nome', 'company', 'razao social', 'razaosocial', 'nome empresa', 'empresa', 'nome pregao', 'denominacao social');

      const setor = setorRaw ? String(setorRaw).trim() : 'Outros';
      const subsetor = subsetorRaw ? String(subsetorRaw).trim() : undefined;
      const nomeEmpresa = getCompanyFullName(papel, nomeEmpresaRaw ? String(nomeEmpresaRaw).trim() : undefined);

      const lpa = (pl && pl !== 0) ? cotacao / pl : null;
      const vpa = (pvp && pvp !== 0) ? cotacao / pvp : null;

      const stock: StockData = {
        id: papel,
        papel,
        cotacao,
        pl,
        pvp,
        psr,
        divYield,
        pAtivo,
        pCapGiro,
        pEbit,
        pAtivCircLiq,
        evEbitda,
        evEbit,
        mrgEbit,
        mrgLiq,
        mrgBruta,
        liqCorr,
        roic,
        roe,
        liq2meses,
        patrimLiq,
        divBrutaPatrim,
        divLiqPatrim,
        crescRec5a,
        setor,
        subsetor,
        nomeEmpresa,
        lpa,
        vpa,
      };

      return stock;
    })
    .filter((s): s is StockData => s !== null);
}

/**
 * Parses raw CSV string, auto-detecting delimiter (; or , or tab)
 */
export function parseCSVText(csvContent: string): StockData[] {
  if (!csvContent || !csvContent.trim()) {
    throw new Error('Conteúdo CSV vazio.');
  }

  // Remove potential UTF-8 BOM
  let cleanContent = csvContent.replace(/^\uFEFF/, '').trim();

  // Split lines
  const lines = cleanContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('O arquivo CSV deve conter pelo menos uma linha de cabeçalho e uma linha de dados.');
  }

  // Detect delimiter in header line: compare counts of semicolon, comma, and tab
  const headerLine = lines[0];
  const countSemicolon = (headerLine.match(/;/g) || []).length;
  const countComma = (headerLine.match(/,/g) || []).length;
  const countTab = (headerLine.match(/\t/g) || []).length;

  let delimiter = ';';
  if (countComma > countSemicolon && countComma > countTab) {
    delimiter = ',';
  } else if (countTab > countSemicolon && countTab > countComma) {
    delimiter = '\t';
  }

  // Helper to split a line considering quotes
  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitLine(headerLine);
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;

    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] !== undefined ? values[j] : null;
    }
    rows.push(row);
  }

  return parseExcelRows(rows);
}

/**
 * Reads a CSV file with automatic encoding fallback (UTF-8 / ISO-8859-1)
 */
export async function readCSVFile(file: File): Promise<{ data: StockData[]; totalRows: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error('Falha ao ler o arquivo CSV.');
        }

        const parsedData = parseCSVText(text);
        if (parsedData.length === 0) {
          throw new Error('Nenhuma empresa válida encontrada no CSV. Verifique os cabeçalhos.');
        }

        resolve({
          data: parsedData,
          totalRows: parsedData.length,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Erro ao processar arquivo CSV.'));
      }
    };

    reader.onerror = () => reject(new Error('Erro de leitura do arquivo CSV.'));
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Reads an Excel file buffer and parses all sheets into StockData
 */
export async function readExcelFile(file: File): Promise<{ data: StockData[]; sheetName: string; totalRows: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) {
          throw new Error('Falha ao ler o arquivo.');
        }

        const workbook = XLSX.read(buffer, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          throw new Error('Nenhuma planilha encontrada no arquivo Excel.');
        }

        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null });

        if (!rawJson || rawJson.length === 0) {
          throw new Error('A planilha está vazia ou os cabeçalhos não foram reconhecidos.');
        }

        const parsedData = parseExcelRows(rawJson);
        resolve({
          data: parsedData,
          sheetName,
          totalRows: parsedData.length,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Erro ao processar arquivo Excel.'));
      }
    };

    reader.onerror = () => reject(new Error('Erro de leitura do arquivo.'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Exports data to an Excel (.xlsx) file
 */
export function exportToExcel(data: StockData[], filename = 'analise_fundamentalista_b3.xlsx') {
  const exportRows = data.map((d) => ({
    'Papel': d.papel,
    'Nome': d.nomeEmpresa || d.papel,
    'Setor': d.setor,
    'Cotação (R$)': d.cotacao,
    'P/L': d.pl,
    'P/VP': d.pvp,
    'PSR': d.psr,
    'Div. Yield (%)': d.divYield,
    'EV/EBITDA': d.evEbitda,
    'EV/EBIT': d.evEbit,
    'ROIC (%)': d.roic,
    'ROE (%)': d.roe,
    'Margem Bruta (%)': d.mrgBruta,
    'Margem EBIT (%)': d.mrgEbit,
    'Margem Líquida (%)': d.mrgLiq,
    'Dív. Líq / Patrimônio': d.divLiqPatrim,
    'Liq. Corrente': d.liqCorr,
    'Liq. 2 Meses (R$)': d.liq2meses,
    'Patrimônio Líquido (R$)': d.patrimLiq,
    'Cresc. Rec. 5a (%)': d.crescRec5a,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Empresas B3');
  XLSX.writeFile(workbook, filename);
}

/**
 * Exports data to a Brazilian standard CSV (.csv) file with semicolon separator and UTF-8 BOM
 */
export function exportToCSV(data: StockData[], filename = 'analise_fundamentalista_b3.csv') {
  const headers = [
    'Papel',
    'Nome',
    'Setor',
    'Cotação',
    'P/L',
    'P/VP',
    'PSR',
    'Div.Yield',
    'EV/EBITDA',
    'EV/EBIT',
    'ROIC',
    'ROE',
    'Margem Bruta',
    'Margem EBIT',
    'Margem Líquida',
    'Dívida Líquida / Patrimônio',
    'Liq. Corr.',
    'Liq.2meses',
    'Patrim. Líq',
    'Cresc. Rec.5a',
  ];

  const rows = data.map((d) => [
    `"${d.papel}"`,
    `"${d.nomeEmpresa || d.papel}"`,
    `"${d.setor}"`,
    d.cotacao !== null ? String(d.cotacao).replace('.', ',') : '',
    d.pl !== null ? String(d.pl).replace('.', ',') : '',
    d.pvp !== null ? String(d.pvp).replace('.', ',') : '',
    d.psr !== null ? String(d.psr).replace('.', ',') : '',
    d.divYield !== null ? `${String(d.divYield).replace('.', ',')}%` : '',
    d.evEbitda !== null ? String(d.evEbitda).replace('.', ',') : '',
    d.evEbit !== null ? String(d.evEbit).replace('.', ',') : '',
    d.roic !== null ? `${String(d.roic).replace('.', ',')}%` : '',
    d.roe !== null ? `${String(d.roe).replace('.', ',')}%` : '',
    d.mrgBruta !== null ? `${String(d.mrgBruta).replace('.', ',')}%` : '',
    d.mrgEbit !== null ? `${String(d.mrgEbit).replace('.', ',')}%` : '',
    d.mrgLiq !== null ? `${String(d.mrgLiq).replace('.', ',')}%` : '',
    d.divLiqPatrim !== null ? String(d.divLiqPatrim).replace('.', ',') : '',
    d.liqCorr !== null ? String(d.liqCorr).replace('.', ',') : '',
    d.liq2meses !== null ? String(d.liq2meses) : '',
    d.patrimLiq !== null ? String(d.patrimLiq) : '',
    d.crescRec5a !== null ? `${String(d.crescRec5a).replace('.', ',')}%` : '',
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
