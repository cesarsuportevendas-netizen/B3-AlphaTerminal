import { StockIndicator, RankingWeights } from '../types/stock';

export const DEFAULT_WEIGHTS: RankingWeights = {
  pesoRentabilidade: 30, // ROIC, ROE, Margem
  pesoValuation: 25,     // P/L, P/VP, EV/EBIT
  pesoDividendos: 15,    // Div. Yield
  pesoSaudeFinanceira: 15, // Dívida, Liquidez
  pesoSmartMoney: 15,    // Fluxo grandes investidores
};

/**
 * Normaliza um array de números para escala 0 a 100
 */
export function normalize(values: number[], invert: boolean = false): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);

  return values.map(val => {
    const norm = ((val - min) / (max - min)) * 100;
    return invert ? 100 - norm : norm;
  });
}

/**
 * Recalcula o ranking multicritério e os Top 10 ativos
 */
export function calculateRankings(
  stocks: StockIndicator[],
  weights: RankingWeights = DEFAULT_WEIGHTS
): StockIndicator[] {
  if (stocks.length === 0) return [];

  // Magic Formula Ranking (Joel Greenblatt)
  // Rank 1: Menor P/L (apenas P/L > 0)
  const validPlStocks = stocks.map(s => (s.pl > 0 ? s.pl : 9999));
  const sortedByPl = [...stocks].sort((a, b) => {
    const plA = a.pl > 0 ? a.pl : 9999;
    const plB = b.pl > 0 ? b.pl : 9999;
    return plA - plB;
  });
  const plRankMap = new Map<string, number>();
  sortedByPl.forEach((s, idx) => plRankMap.set(s.id, idx + 1));

  // Rank 2: Maior ROIC
  const sortedByRoic = [...stocks].sort((a, b) => b.roic - a.roic);
  const roicRankMap = new Map<string, number>();
  sortedByRoic.forEach((s, idx) => roicRankMap.set(s.id, idx + 1));

  // Métricas para normalização
  const roicNorm = normalize(stocks.map(s => s.roic));
  const roeNorm = normalize(stocks.map(s => s.roe));
  const margemNorm = normalize(stocks.map(s => s.margLiquida));
  
  // Valuation (menor é melhor)
  const plNorm = normalize(validPlStocks, true);
  const pvpNorm = normalize(stocks.map(s => s.pvp > 0 ? s.pvp : 99), true);
  const evEbitNorm = normalize(stocks.map(s => s.evEbit > 0 ? s.evEbit : 99), true);
  
  // Proventos
  const dyNorm = normalize(stocks.map(s => s.divYield));

  // Saúde Financeira
  const divNorm = normalize(stocks.map(s => s.dividaLiquidaEbitda > 0 ? s.dividaLiquidaEbitda : 0), true);
  const liqCorrNorm = normalize(stocks.map(s => s.liqCorr));

  // Smart Money
  const smartMoneyNorm = normalize(stocks.map(s => s.smartMoneyScore));

  const totalWeight =
    weights.pesoRentabilidade +
    weights.pesoValuation +
    weights.pesoDividendos +
    weights.pesoSaudeFinanceira +
    weights.pesoSmartMoney;

  const scored = stocks.map((stock, i) => {
    const rentabilidadeScore = (roicNorm[i] * 0.4) + (roeNorm[i] * 0.3) + (margemNorm[i] * 0.3);
    const valuationScore = (plNorm[i] * 0.45) + (pvpNorm[i] * 0.3) + (evEbitNorm[i] * 0.25);
    const dividendosScore = dyNorm[i];
    const saudeScore = (divNorm[i] * 0.6) + (liqCorrNorm[i] * 0.4);
    const fluxoScore = smartMoneyNorm[i];

    const rawScore =
      (rentabilidadeScore * weights.pesoRentabilidade +
        valuationScore * weights.pesoValuation +
        dividendosScore * weights.pesoDividendos +
        saudeScore * weights.pesoSaudeFinanceira +
        fluxoScore * weights.pesoSmartMoney) /
      (totalWeight || 1);

    const scoreAlpha = Math.min(99, Math.max(30, Math.round(rawScore)));

    // Cálculo Graham: Preço Justo = raiz(22.5 * LPA * VPA)
    // LPA = Cotacao / PL; VPA = Cotacao / PVP
    let precoGraham = stock.precoJustoGraham;
    if (stock.pl > 0 && stock.pvp > 0) {
      const lpa = stock.cotacao / stock.pl;
      const vpa = stock.cotacao / stock.pvp;
      const calcGraham = Math.sqrt(22.5 * lpa * vpa);
      if (!isNaN(calcGraham) && calcGraham > 0) {
        precoGraham = Number(calcGraham.toFixed(2));
      }
    }
    const descontoGraham = Number((((precoGraham - stock.cotacao) / precoGraham) * 100).toFixed(1));

    // Preço Teto Bazin = Proventos / 0.06
    let precoBazin = stock.precoTetoBazin;
    if (stock.divYield > 0) {
      const proventoAno = (stock.cotacao * stock.divYield) / 100;
      precoBazin = Number((proventoAno / 0.06).toFixed(2));
    }

    // Cálculo 12 Meses: Dividendo por Ação (DPA), Proventos Totais e Payout
    const dpa12m = stock.dividendo12mPorAcao || Number(((stock.cotacao * stock.divYield) / 100).toFixed(2));
    const sharesTotal = stock.valorMercado && stock.cotacao ? stock.valorMercado / stock.cotacao : 1000000000;
    const totalProv12m = stock.totalProventosPagos12m || Number((dpa12m * sharesTotal).toFixed(0));
    const lpaCalc = stock.pl > 0 ? stock.cotacao / stock.pl : 1;
    const payout = stock.payoutMedio || Math.min(100, Math.max(10, Math.round((dpa12m / (lpaCalc || 1)) * 100)));

    return {
      ...stock,
      scoreAlpha,
      precoJustoGraham: precoGraham,
      descontoGrahamPerc: descontoGraham,
      precoTetoBazin: precoBazin,
      dividendo12mPorAcao: dpa12m,
      totalProventosPagos12m: totalProv12m,
      payoutMedio: payout,
      posicaoTop10: undefined,
    };
  });

  // Ordena pelo Score Alpha decrescente
  scored.sort((a, b) => b.scoreAlpha - a.scoreAlpha);

  // Atribui posições aos Top 10
  return scored.map((s, index) => {
    if (index < 10) {
      return { ...s, posicaoTop10: index + 1 };
    }
    return s;
  });
}

/**
 * Formata moeda BRL (padrão com 2 casas decimais)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata moeda BRL arredondada para Reais inteiros (sem centavos para caber na tela)
 * Ex: R$ 50.000 ou R$ 1.250.800
 */
export function formatCurrencyRounded(value: number): string {
  const rounded = Math.round(value || 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);
}

/**
 * Formata moeda compacta com sufixo (Mil, Mi, Bi) para cards estreitos e dashboards
 * Ex: R$ 75,5 Mil, R$ 2,12 Mi
 */
export function formatCompactBRL(value: number): string {
  const num = Math.abs(value || 0);
  const sign = value < 0 ? '-' : '';
  if (num >= 1_000_000_000) {
    return `${sign}R$ ${(num / 1_000_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Bi`;
  }
  if (num >= 1_000_000) {
    return `${sign}R$ ${(num / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Mi`;
  }
  if (num >= 100_000) {
    return `${sign}R$ ${(num / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Mil`;
  }
  return formatCurrencyRounded(value);
}

/**
 * Formata números grandes (milhões, bilhões)
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)} Tri`;
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)} Bi`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} Mi`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)} Mil`;
  }
  return value.toLocaleString('pt-BR');
}

/**
 * Formata percentuais com sinal
 */
export function formatPercent(value: number, showSign: boolean = false): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
