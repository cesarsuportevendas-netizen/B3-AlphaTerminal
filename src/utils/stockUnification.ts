import { StockIndicator, StockData } from '../types/stock';
import { INITIAL_STOCKS } from '../data/initialStocks';
import { DEFAULT_B3_DATA } from '../data/defaultB3Data';
import { calculateGrahamFairPrice, calculateBazinCeilingPrice } from './dataCleaner';
import { calculateRankings } from './financialCalculations';
import { getCompanyFullName } from './companyNames';

export type UnifiedStock = StockIndicator & StockData;

/**
 * Ensures an incoming stock object has all fields required by both
 * AlphaTerminal (StockIndicator) and B3 Fundamental (StockData).
 */
export function unifyStock(raw: any): UnifiedStock {
  const ticker = raw.papel || raw.id || 'ATIVO';
  const price = raw.cotacao && raw.cotacao > 0 ? Number(raw.cotacao) : 10.0;
  const pl = raw.pl !== undefined && raw.pl !== null ? Number(raw.pl) : 8.0;
  const pvp = raw.pvp !== undefined && raw.pvp !== null ? Number(raw.pvp) : 1.2;
  const roic = raw.roic !== undefined && raw.roic !== null ? Number(raw.roic) : 15.0;
  const roe = raw.roe !== undefined && raw.roe !== null ? Number(raw.roe) : 18.0;
  const dy = raw.divYield !== undefined && raw.divYield !== null ? Number(raw.divYield) : 6.0;
  const mrgLiq = raw.mrgLiq !== undefined && raw.mrgLiq !== null
    ? Number(raw.mrgLiq)
    : (raw.margLiquida !== undefined ? Number(raw.margLiquida) : 14.0);
  const mrgEbit = raw.mrgEbit !== undefined && raw.mrgEbit !== null
    ? Number(raw.mrgEbit)
    : (raw.margEbit !== undefined ? Number(raw.margEbit) : 20.0);
  const mrgBruta = raw.mrgBruta !== undefined && raw.mrgBruta !== null
    ? Number(raw.mrgBruta)
    : 38.0;
  const liqCorr = raw.liqCorr !== undefined && raw.liqCorr !== null
    ? Number(raw.liqCorr)
    : 1.6;
  const liqVolume = raw.liq2meses || raw.liq2m || 25000000;
  const equity = raw.patrimLiq || 8000000000;
  const divBruta = raw.divBrutaPatrim ?? raw.divBrutPatrim ?? 0.65;
  const divLiq = raw.divLiqPatrim ?? (raw.dividaLiquidaEbitda !== undefined ? raw.dividaLiquidaEbitda * 0.65 : 0.45);

  const lpa = raw.lpa ?? (pl > 0 ? price / pl : null);
  const vpa = raw.vpa ?? (pvp > 0 ? price / pvp : null);

  const calcGraham = calculateGrahamFairPrice(price, pl, pvp) || Number((price * 1.28).toFixed(2));
  const calcBazin = calculateBazinCeilingPrice(price, dy) || Number((price * 1.22).toFixed(2));
  const descGraham = Number((((calcGraham - price) / calcGraham) * 100).toFixed(1));

  // Determine smart money metrics based on fundamentals if not explicitly present
  const isHighQuality = roic >= 15 && pl > 0 && pl <= 14 && dy >= 5;
  const smartMoneyScore = raw.smartMoneyScore ?? (isHighQuality ? Math.round(75 + Math.min(20, roic * 0.5)) : 62);
  const padraoWyckoff = raw.padraoWyckoff ?? (
    isHighQuality
      ? 'Acumulação Silenciosa'
      : (dy >= 8 ? 'Absorção Institucional' : 'Neutro / Equilíbrio')
  );

  const entrada = raw.pontoEntrada ?? Number((price * 0.98).toFixed(2));
  const stop = raw.stopLoss ?? Number((price * 0.92).toFixed(2));
  const alvo1 = raw.alvo1CurtoPrazo ?? Number((price * 1.12).toFixed(2));
  const alvo2 = raw.alvo2LongoPrazo ?? Math.max(calcGraham, Number((price * 1.35).toFixed(2)));

  const unified: UnifiedStock = {
    id: raw.id || ticker,
    papel: ticker,
    nomeEmpresa: getCompanyFullName(ticker, raw.nomeEmpresa),
    setor: raw.setor || 'Diversos',
    subsetor: raw.subsetor || 'Geral',
    cotacao: price,
    pl: pl,
    pvp: pvp,
    psr: raw.psr ?? 1.1,
    divYield: dy,
    pAtivo: raw.pAtivo ?? 0.85,
    pCapGiro: raw.pCapGiro ?? 5.5,
    pEbit: raw.pEbit ?? 4.8,
    pAtivCircLiq: raw.pAtivCircLiq ?? -0.5,
    evEbit: raw.evEbit ?? 5.5,
    evEbitda: raw.evEbitda ?? 4.5,
    margEbit: mrgEbit,
    margLiquida: mrgLiq,
    mrgEbit: mrgEbit,
    mrgLiq: mrgLiq,
    mrgBruta: mrgBruta,
    liqCorr: liqCorr,
    roic: roic,
    roe: roe,
    liq2m: liqVolume,
    liq2meses: liqVolume,
    patrimLiq: equity,
    divBrutPatrim: divBruta,
    divBrutaPatrim: divBruta,
    divLiqPatrim: divLiq,
    crescRec5a: raw.crescRec5a ?? 10.5,
    lpa: lpa,
    vpa: vpa,

    // Situation & dividends
    valorMercado: raw.valorMercado || (equity * (pvp > 0 ? pvp : 1)),
    dividaLiquidaEbitda: raw.dividaLiquidaEbitda ?? Number((divLiq * 1.5).toFixed(2)),
    caixaDisponivel: raw.caixaDisponivel ?? Number((equity * 0.18).toFixed(0)),
    receitaLiquida12m: raw.receitaLiquida12m ?? Number((equity * 0.95).toFixed(0)),
    lucroLiquido12m: raw.lucroLiquido12m ?? Number((equity * (roe / 100)).toFixed(0)),
    dividendo12mPorAcao: raw.dividendo12mPorAcao ?? Number(((price * dy) / 100).toFixed(2)),
    totalProventosPagos12m: raw.totalProventosPagos12m ?? Number(((equity * (roe / 100)) * 0.5).toFixed(0)),
    payoutMedio: raw.payoutMedio ?? 55,
    governanca: raw.governanca ?? 'Novo Mercado',
    freeFloat: raw.freeFloat ?? 45,
    frequenciaDividendos: raw.frequenciaDividendos ?? 'Trimestral',

    // Smart Money
    principaisAcionistas: raw.principaisAcionistas ?? 'Fundos Institucionais, Gestores Locais & Estrangeiros',
    fluxoEstrangeiro30dMilhoes: raw.fluxoEstrangeiro30dMilhoes ?? (isHighQuality ? 145 : 30),
    fluxoInstitucional30dMilhoes: raw.fluxoInstitucional30dMilhoes ?? (isHighQuality ? 220 : 45),
    padraoWyckoff: padraoWyckoff,
    insiderTransactions: raw.insiderTransactions ?? (isHighQuality ? 'Compras Fortes' : 'Neutro'),
    smartMoneyScore: smartMoneyScore,

    // Trades
    pontoEntrada: entrada,
    stopLoss: stop,
    alvo1CurtoPrazo: alvo1,
    alvo2LongoPrazo: alvo2,
    riscoRetorno: raw.riscoRetorno ?? '1:3.4',
    tendenciaTecnica: raw.tendenciaTecnica ?? (isHighQuality ? 'Alta' : 'Alta Moderada'),
    padraoGrafico: raw.padraoGrafico ?? 'Canal de Alta com Suporte em Média de 50p',
    rsi14: raw.rsi14 ?? 54,

    // Models
    precoJustoGraham: calcGraham,
    descontoGrahamPerc: descGraham,
    precoTetoBazin: calcBazin,
    piotroskiFScore: raw.piotroskiFScore ?? (isHighQuality ? 8 : 6),
    scoreAlpha: raw.scoreAlpha ?? Math.min(98, Math.max(45, Math.round(smartMoneyScore * 0.95))),
    posicaoTop10: raw.posicaoTop10,
    teseCurtoPrazo: raw.teseCurtoPrazo ?? `Posicionamento tático aproveitando desconto de valuation (P/L ${pl}x) com gatilhos de fluxo.`,
    teseLongoPrazo: raw.teseLongoPrazo ?? `Ativo de alta solidez financeira (ROIC ${roic}%, DY ${dy}%) com potencial de valorização rumo ao preço justo.`,

    favorito: raw.favorito,
    monitorado: raw.monitorado,
    observacoes: raw.observacoes,
    onlineSources: raw.onlineSources,
    onlineUpdatedAt: raw.onlineUpdatedAt,
  };

  return unified;
}

/**
 * Returns the combined, deduplicated, and unified default B3 universe.
 */
export function getUnifiedInitialStocks(): UnifiedStock[] {
  const stockMap = new Map<string, UnifiedStock>();

  // 1. Load initial stocks (AlphaTerminal)
  for (const s of INITIAL_STOCKS) {
    stockMap.set(s.papel, unifyStock(s));
  }

  // 2. Load default B3 data (B3 Fundamental), merging and enriching
  for (const b3 of DEFAULT_B3_DATA) {
    if (stockMap.has(b3.papel)) {
      const existing = stockMap.get(b3.papel)!;
      stockMap.set(b3.papel, unifyStock({ ...b3, ...existing }));
    } else {
      stockMap.set(b3.papel, unifyStock(b3));
    }
  }

  const list = Array.from(stockMap.values());
  const calculated = calculateRankings(list as StockIndicator[]);
  return calculated.map(s => unifyStock(s));
}
