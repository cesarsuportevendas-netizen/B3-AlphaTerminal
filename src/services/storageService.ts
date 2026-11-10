import { StockIndicator } from '../types/stock';
import { calculateRankings } from '../utils/financialCalculations';
import { unifyStock, UnifiedStock } from '../utils/stockUnification';
import { exportToExcel, exportToCSV } from '../utils/excelParser';

// Dedicated storage key ensuring clean slate ready exclusively for user's CSV or Excel files
const STORAGE_KEY = 'b3_alpha_terminal_stocks_v4_empty';

// Clean legacy keys from previous runs
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const legacyKeys = [
      'b3_alpha_terminal_stocks_v1',
      'b3_alpha_terminal_stocks_v2',
      'b3_alpha_terminal_stocks_clean_v3',
      'b3_fundamental_stocks_v1',
      'alpha_terminal_stocks_v1',
    ];
    for (const key of legacyKeys) {
      localStorage.removeItem(key);
    }
  }
} catch (e) {
  // Ignore storage access errors in restricted iframe
}

export function getStoredStocks(): UnifiedStock[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Empty by default: strictly waiting for user's CSV or Excel file
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const unifiedList = parsed.map((s) => unifyStock(s));
      const recalculated = calculateRankings(unifiedList as StockIndicator[]);
      return recalculated.map((s) => unifyStock(s));
    }
    return [];
  } catch (err) {
    console.error('Failed to load stocks from storage:', err);
    return [];
  }
}

export function saveStocks(stocks: UnifiedStock[] | StockIndicator[]): void {
  try {
    if (!stocks || stocks.length === 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return;
    }
    const recalculated = calculateRankings(stocks as StockIndicator[]);
    const unified = recalculated.map((s) => unifyStock(s));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unified));
  } catch (err) {
    console.error('Failed to save stocks to storage:', err);
  }
}

export function resetToInitialStocks(): UnifiedStock[] {
  // Strictly clean: removes all assets and resets to 0
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  return [];
}

export function clearStoredStocks(): UnifiedStock[] {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  return [];
}

export function exportStocksToCSV(stocks: UnifiedStock[] | StockIndicator[]): void {
  if (stocks.length === 0) return;
  exportToCSV(stocks.map((s) => unifyStock(s)));
}

export function exportStocksToExcel(stocks: UnifiedStock[] | StockIndicator[]): void {
  if (stocks.length === 0) return;
  exportToExcel(stocks.map((s) => unifyStock(s)));
}
