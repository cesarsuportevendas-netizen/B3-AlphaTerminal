/**
 * Data Cleaning & Financial Quant Utilities
 * Handles Brazilian number formats, safe float parsing, division by zero prevention,
 * and quantitative valuation formulas (Graham, Bazin).
 */

export function parseSafeFloat(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return null;
    return val;
  }

  let str = String(val).trim();
  if (str === '' || str === '-' || str === '--' || str === 'N/D' || str === 'n/a' || str === 'null' || str === '#DIV/0!' || str === 'inf') {
    return null;
  }

  // Handle accounting parentheses for negatives e.g. (15,4) -> -15.4
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  } else if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1).trim();
  }

  // Remove currency symbols, percent signs, and spaces
  str = str.replace(/R\$/gi, '').replace(/%/g, '').replace(/\s+/g, '');

  // Detect Brazilian format: e.g. 1.234.567,89 vs 1234567.89
  if (str.includes(',') && str.includes('.')) {
    // If dot comes before comma: 1.234,56
    if (str.indexOf('.') < str.indexOf(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Unusual 1,234.56
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Only comma used as decimal separator: 1234,56 -> 1234.56
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  if (isNaN(num) || !isFinite(num)) return null;

  return isNegative ? -num : num;
}

export function parseSafeNumberWithDefault(val: unknown, fallback: number = 0): number {
  const parsed = parseSafeFloat(val);
  return parsed !== null ? parsed : fallback;
}

/**
 * Format currency in BRL (R$ 1.234,56)
 */
export function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

/**
 * Format percentage (15,4%)
 */
export function formatPercent(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return `${val.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

/**
 * Format general numbers with decimals
 */
export function formatNumber(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return val.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Format large numbers in compact Brazilian notation (e.g., R$ 45,2 bi, R$ 850 mi)
 */
export function formatCompactNumber(val: number | null | undefined, prefix = 'R$ '): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';

  if (abs >= 1_000_000_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} tri`;
  }
  if (abs >= 1_000_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  }
  if (abs >= 1_000) {
    return `${sign}${prefix}${(abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return `${sign}${prefix}${abs.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
}

/**
 * Benjamin Graham Fair Price formula:
 * V = sqrt(22.5 * LPA * VPA)
 * Note: LPA = Cotacao / PL; VPA = Cotacao / PVP
 */
export function calculateGrahamFairPrice(cotacao: number, pl: number | null, pvp: number | null): number | null {
  if (!pl || !pvp || pl <= 0 || pvp <= 0 || cotacao <= 0) return null;
  const lpa = cotacao / pl;
  const vpa = cotacao / pvp;
  if (lpa <= 0 || vpa <= 0) return null;
  const val = Math.sqrt(22.5 * lpa * vpa);
  return isFinite(val) && val > 0 ? val : null;
}

/**
 * Décio Bazin Ceiling Price formula:
 * Preço Teto = (Dividendos por Ação) / 0.06 (para yield de 6%)
 */
export function calculateBazinCeilingPrice(cotacao: number, divYield: number | null): number | null {
  if (!divYield || divYield <= 0 || cotacao <= 0) return null;
  const dpa = (cotacao * divYield) / 100;
  const precoTeto = dpa / 0.06;
  return isFinite(precoTeto) && precoTeto > 0 ? precoTeto : null;
}

/**
 * Safe statistical outlier clamp for charts
 */
export function clampValue(val: number | null, min: number, max: number): number | null {
  if (val === null || isNaN(val)) return null;
  return Math.min(Math.max(val, min), max);
}
