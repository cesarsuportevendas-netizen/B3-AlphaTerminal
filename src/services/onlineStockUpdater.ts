import { StockData } from '../types/stock';
import { getCompanyFullName } from '../utils/companyNames';

export interface OnlineRefreshProgress {
  processed: number;
  total: number;
  updatedCount: number;
  currentBatch: string[];
}

export interface OnlineRefreshSummary {
  stocks: StockData[];
  totalCount: number;
  updatedCount: number;
  notFoundTickers: string[];
  sourcesUsed: string[];
  updatedAt: string;
}

interface OnlineTickerPayload {
  papel: string;
  nomeEmpresa?: string;
  setor?: string;
  subsetor?: string;
  cotacao?: number;
  pl?: number;
  pvp?: number;
  psr?: number;
  divYield?: number;
  pAtivo?: number;
  pCapGiro?: number;
  pEbit?: number;
  pAtivCircLiq?: number;
  evEbitda?: number;
  evEbit?: number;
  mrgEbit?: number;
  mrgLiq?: number;
  mrgBruta?: number;
  liqCorr?: number;
  roic?: number;
  roe?: number;
  liq2meses?: number;
  patrimLiq?: number;
  divBrutaPatrim?: number;
  divLiqPatrim?: number;
  crescRec5a?: number;
  lpa?: number;
  vpa?: number;
  valorMercado?: number;
  caixaDisponivel?: number;
  receitaLiquida12m?: number;
  lucroLiquido12m?: number;
  pontoEntrada?: number;
  stopLoss?: number;
  alvo1CurtoPrazo?: number;
  alvo2LongoPrazo?: number;
  riscoRetorno?: string;
  rsi14?: number;
  tendenciaTecnica?: string;
  padraoGrafico?: string;
  suporteTecnico?: number;
  resistenciaTecnica?: number;
  atr14?: number;
  tradeSignalRecomendacao?: string;
  tradeSignalSources?: string[];
  tradeSignalUpdatedAt?: string;
  onlineSources?: string[];
  onlineUpdatedAt?: string;
}

function mergeOnlineFields(base: StockData, online: OnlineTickerPayload): StockData {
  const numOrKeep = (onlineVal: number | undefined, baseVal: number | null): number | null =>
    typeof onlineVal === 'number' && Number.isFinite(onlineVal) ? onlineVal : baseVal;

  const reqNumOrKeep = (onlineVal: number | undefined, baseVal: number): number =>
    typeof onlineVal === 'number' && Number.isFinite(onlineVal) && onlineVal > 0 ? onlineVal : baseVal;

  const nextCotacao = reqNumOrKeep(online.cotacao, base.cotacao);
  const nextPl = numOrKeep(online.pl, base.pl);
  const nextPvp = numOrKeep(online.pvp, base.pvp);

  const nextSetor =
    online.setor && online.setor.trim() && online.setor !== '-'
      ? online.setor.trim()
      : base.setor || 'Outros';

  const nextNomeEmpresa = getCompanyFullName(
    base.papel,
    online.nomeEmpresa && online.nomeEmpresa.trim() ? online.nomeEmpresa.trim() : base.nomeEmpresa
  );

  const merged: StockData = {
    ...base,
    cotacao: nextCotacao,
    pl: nextPl,
    pvp: nextPvp,
    psr: numOrKeep(online.psr, base.psr),
    divYield: numOrKeep(online.divYield, base.divYield),
    pAtivo: numOrKeep(online.pAtivo, base.pAtivo),
    pCapGiro: numOrKeep(online.pCapGiro, base.pCapGiro),
    pEbit: numOrKeep(online.pEbit, base.pEbit),
    pAtivCircLiq: numOrKeep(online.pAtivCircLiq, base.pAtivCircLiq),
    evEbitda: numOrKeep(online.evEbitda, base.evEbitda),
    evEbit: numOrKeep(online.evEbit, base.evEbit),
    mrgEbit: numOrKeep(online.mrgEbit, base.mrgEbit),
    mrgLiq: numOrKeep(online.mrgLiq, base.mrgLiq),
    mrgBruta: numOrKeep(online.mrgBruta, base.mrgBruta),
    liqCorr: numOrKeep(online.liqCorr, base.liqCorr),
    roic: numOrKeep(online.roic, base.roic),
    roe: numOrKeep(online.roe, base.roe),
    liq2meses: reqNumOrKeep(online.liq2meses, base.liq2meses),
    patrimLiq:
      typeof online.patrimLiq === 'number' && Number.isFinite(online.patrimLiq) && online.patrimLiq !== 0
        ? online.patrimLiq
        : base.patrimLiq,
    divBrutaPatrim: numOrKeep(online.divBrutaPatrim, base.divBrutaPatrim),
    divLiqPatrim: numOrKeep(online.divLiqPatrim, base.divLiqPatrim),
    crescRec5a: numOrKeep(online.crescRec5a, base.crescRec5a),
    setor: nextSetor,
    subsetor: online.subsetor?.trim() || base.subsetor,
    nomeEmpresa: nextNomeEmpresa,
    lpa: numOrKeep(online.lpa, nextPl && nextPl !== 0 ? Number((nextCotacao / nextPl).toFixed(2)) : base.lpa ?? null),
    vpa: numOrKeep(online.vpa, nextPvp && nextPvp !== 0 ? Number((nextCotacao / nextPvp).toFixed(2)) : base.vpa ?? null),
    pontoEntrada: typeof online.pontoEntrada === 'number' && online.pontoEntrada > 0 ? online.pontoEntrada : base.pontoEntrada,
    stopLoss: typeof online.stopLoss === 'number' && online.stopLoss > 0 ? online.stopLoss : base.stopLoss,
    alvo1CurtoPrazo: typeof online.alvo1CurtoPrazo === 'number' && online.alvo1CurtoPrazo > 0 ? online.alvo1CurtoPrazo : base.alvo1CurtoPrazo,
    alvo2LongoPrazo: typeof online.alvo2LongoPrazo === 'number' && online.alvo2LongoPrazo > 0 ? online.alvo2LongoPrazo : base.alvo2LongoPrazo,
    riscoRetorno: online.riscoRetorno || base.riscoRetorno,
    rsi14: typeof online.rsi14 === 'number' && online.rsi14 > 0 ? online.rsi14 : base.rsi14,
    tendenciaTecnica: online.tendenciaTecnica || base.tendenciaTecnica,
    padraoGrafico: online.padraoGrafico || base.padraoGrafico,
    suporteTecnico: typeof online.suporteTecnico === 'number' ? online.suporteTecnico : base.suporteTecnico,
    resistenciaTecnica: typeof online.resistenciaTecnica === 'number' ? online.resistenciaTecnica : base.resistenciaTecnica,
    atr14: typeof online.atr14 === 'number' ? online.atr14 : base.atr14,
    tradeSignalRecomendacao: online.tradeSignalRecomendacao || base.tradeSignalRecomendacao,
    tradeSignalSources: online.tradeSignalSources || base.tradeSignalSources,
    tradeSignalUpdatedAt: online.tradeSignalUpdatedAt || base.tradeSignalUpdatedAt,
    onlineSources: online.onlineSources || base.onlineSources,
    onlineUpdatedAt: online.onlineUpdatedAt || new Date().toISOString(),
  };

  // Preserve extra StockIndicator balance sheet fields when present from online portals
  const extended = merged as StockData & Record<string, unknown>;
  if (typeof online.valorMercado === 'number' && online.valorMercado > 0) {
    extended.valorMercado = online.valorMercado;
  }
  if (typeof online.caixaDisponivel === 'number') {
    extended.caixaDisponivel = online.caixaDisponivel;
  }
  if (typeof online.receitaLiquida12m === 'number') {
    extended.receitaLiquida12m = online.receitaLiquida12m;
  }
  if (typeof online.lucroLiquido12m === 'number') {
    extended.lucroLiquido12m = online.lucroLiquido12m;
  }

  return merged;
}

/**
 * Fetches live quotations and fundamentals from Fundamentus, Investidor10, Brapi,
 * and Google Search fallback in safe serverless-friendly batches.
 */
export async function refreshStocksOnline<T extends StockData>(
  uploadedStocks: T[],
  options?: {
    batchSize?: number;
    onProgress?: (progress: OnlineRefreshProgress) => void;
  }
): Promise<OnlineRefreshSummary> {
  const batchSize = options?.batchSize ?? 12;
  const uniqueTickers = Array.from(
    new Set(
      uploadedStocks
        .map((s) => s.papel.toUpperCase().trim().replace(/\.SA$/i, ''))
        .filter((t) => t.length >= 3)
    )
  );

  const onlineMap = new Map<string, OnlineTickerPayload>();
  const sourcesSet = new Set<string>();
  let processed = 0;
  let updatedCount = 0;

  for (let i = 0; i < uniqueTickers.length; i += batchSize) {
    const batch = uniqueTickers.slice(i, i + batchSize);
    options?.onProgress?.({
      processed,
      total: uniqueTickers.length,
      updatedCount,
      currentBatch: batch,
    });

    try {
      const response = await fetch('/api/stocks/refresh-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: batch }),
      });

      if (response.ok) {
        const json = (await response.json()) as {
          results?: Record<string, OnlineTickerPayload>;
          updatedAt?: string;
        };

        if (json?.results) {
          for (const [ticker, payload] of Object.entries(json.results)) {
            const key = ticker.toUpperCase().trim();
            onlineMap.set(key, payload);
            updatedCount++;
            for (const src of payload.onlineSources || []) {
              sourcesSet.add(src);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[OnlineStockUpdater] Batch error:', err);
    }

    processed += batch.length;
    options?.onProgress?.({
      processed,
      total: uniqueTickers.length,
      updatedCount,
      currentBatch: batch,
    });
  }

  const notFoundTickers: string[] = [];
  const mergedStocks = uploadedStocks.map((stock) => {
    const cleanTicker = stock.papel.toUpperCase().trim().replace(/\.SA$/i, '');
    const online = onlineMap.get(cleanTicker);
    if (!online) {
      notFoundTickers.push(cleanTicker);
      return stock;
    }
    return mergeOnlineFields(stock, online);
  });

  return {
    stocks: mergedStocks,
    totalCount: uploadedStocks.length,
    updatedCount,
    notFoundTickers,
    sourcesUsed: Array.from(sourcesSet),
    updatedAt: new Date().toISOString(),
  };
}

export interface TradeSignalResult {
  papel: string;
  cotacao: number;
  pontoEntrada: number;
  stopLoss: number;
  alvo1CurtoPrazo: number;
  alvo2LongoPrazo: number;
  riscoRetorno: string;
  rsi14: number;
  tendenciaTecnica: string;
  padraoGrafico: string;
  suporteTecnico: number;
  resistenciaTecnica: number;
  atr14: number;
  tradeSignalRecomendacao: string;
  tradeSignalSources: string[];
  tradeSignalUpdatedAt: string;
}

export async function refreshTradeSignalsOnline(
  tickers: string[],
  quotes?: Record<string, number>
): Promise<{
  results: Record<string, TradeSignalResult>;
  sourcesUsed: string[];
  updatedAt: string;
}> {
  const uniqueTickers = Array.from(
    new Set(tickers.map((t) => t.toUpperCase().trim().replace(/\.SA$/i, '')).filter((t) => t.length >= 4))
  ).slice(0, 25);

  const response = await fetch('/api/stocks/trade-signals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers: uniqueTickers, quotes: quotes || {}, useInvestingSearch: true }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody?.error || 'Falha ao consultar indicações técnicas online.');
  }

  const json = (await response.json()) as {
    results?: Record<string, TradeSignalResult>;
    sourcesUsed?: string[];
    updatedAt?: string;
  };

  return {
    results: json.results || {},
    sourcesUsed: json.sourcesUsed || [],
    updatedAt: json.updatedAt || new Date().toISOString(),
  };
}
