export interface StockIndicator {
  id: string;
  papel: string;
  nomeEmpresa: string;
  setor: string;
  subsetor: string;
  cotacao: number;
  pl: number;
  pvp: number;
  psr: number;
  divYield: number;
  pAtivo: number;
  pCapGiro: number;
  pEbit: number;
  pAtivCircLiq: number;
  evEbit: number;
  evEbitda: number;
  margEbit: number;
  margLiquida: number;
  liqCorr: number;
  roic: number;
  roe: number;
  liq2m: number;
  patrimLiq: number;
  divBrutPatrim: number;
  crescRec5a: number;

  // Compatibility aliases for StockData components
  liq2meses?: number;
  mrgLiq?: number | null;
  mrgEbit?: number | null;
  mrgBruta?: number | null;
  divBrutaPatrim?: number | null;
  divLiqPatrim?: number | null;
  lpa?: number | null;
  vpa?: number | null;

  // Situação Financeira Completa & Proventos 12 Meses
  valorMercado: number;
  dividaLiquidaEbitda: number;
  caixaDisponivel: number;
  receitaLiquida12m: number;
  lucroLiquido12m: number;
  dividendo12mPorAcao?: number; // DPA nos últimos 12 meses em R$
  totalProventosPagos12m?: number; // Proventos totais pagos em 12m em R$
  payoutMedio?: number; // Payout médio (% do lucro distribuído)
  governanca: 'Novo Mercado' | 'Nível 2' | 'Nível 1' | 'Básico';
  freeFloat: number;
  frequenciaDividendos: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';

  // Grandes Investidores & Tubarões
  principaisAcionistas: string;
  fluxoEstrangeiro30dMilhoes: number;
  fluxoInstitucional30dMilhoes: number;
  padraoWyckoff: 'Acumulação Silenciosa' | 'Absorção Institucional' | 'Re-acumulação' | 'Neutro / Equilíbrio' | 'Distribuição / Desova';
  insiderTransactions: 'Compras Fortes' | 'Compras Moderadas' | 'Neutro' | 'Vendas';
  smartMoneyScore: number; // 0-100

  // Trades & Pontos Técnicos
  pontoEntrada: number;
  stopLoss: number;
  alvo1CurtoPrazo: number;
  alvo2LongoPrazo: number;
  riscoRetorno: string;
  tendenciaTecnica: 'Alta' | 'Alta Moderada' | 'Lateral' | 'Baixa';
  padraoGrafico: string;
  rsi14: number;

  // Valuation Modelos
  precoJustoGraham: number;
  descontoGrahamPerc: number;
  precoTetoBazin: number;
  piotroskiFScore: number; // 0-9
  scoreAlpha: number; // 0-100 consolidated rating
  posicaoTop10?: number; // 1-10 if in top 10
  teseCurtoPrazo: string;
  teseLongoPrazo: string;
  
  // Custom user flags & tags
  favorito?: boolean;
  monitorado?: boolean;
  observacoes?: string;
  onlineSources?: string[];
  onlineUpdatedAt?: string;
  tradeSignalSources?: string[];
  tradeSignalRecomendacao?: string;
  tradeSignalUpdatedAt?: string;
  suporteTecnico?: number;
  resistenciaTecnica?: number;
  atr14?: number;
}

export interface StockData {
  id: string;
  papel: string;
  cotacao: number;
  pl: number | null;
  pvp: number | null;
  psr: number | null;
  divYield: number | null; // in %
  pAtivo: number | null;
  pCapGiro: number | null;
  pEbit: number | null;
  pAtivCircLiq: number | null;
  evEbitda: number | null;
  evEbit: number | null;
  mrgEbit: number | null; // in %
  mrgLiq: number | null; // in %
  mrgBruta: number | null; // in %
  liqCorr: number | null;
  roic: number | null; // in %
  roe: number | null; // in %
  liq2meses: number; // in R$
  patrimLiq: number; // in R$
  divBrutaPatrim: number | null;
  divLiqPatrim: number | null;
  crescRec5a: number | null; // in %
  setor: string;
  subsetor?: string;
  nomeEmpresa?: string;
  lpa?: number | null;
  vpa?: number | null;

  // Optional extensions when enriched from StockIndicator
  smartMoneyScore?: number;
  padraoWyckoff?: string;
  precoJustoGraham?: number;
  precoTetoBazin?: number;
  scoreAlpha?: number;
  piotroskiFScore?: number;
  pontoEntrada?: number;
  stopLoss?: number;
  alvo1CurtoPrazo?: number;
  alvo2LongoPrazo?: number;
  riscoRetorno?: string;
  rsi14?: number;
  padraoGrafico?: string;
  tendenciaTecnica?: string;
  onlineSources?: string[];
  onlineUpdatedAt?: string;
  tradeSignalSources?: string[];
  tradeSignalRecomendacao?: string;
  tradeSignalUpdatedAt?: string;
  suporteTecnico?: number;
  resistenciaTecnica?: number;
  atr14?: number;
}

export interface FilterState {
  search: string;
  setor: string;
  minPreco: number;
  maxPreco: number;
  minLiq2meses: number;
  minPatrimLiq: number;
  onlyProfitable: boolean;
  onlyDividendPayers: boolean;
  maxDivLiqPatrim: number | null;
}

export type ActiveSection = 'overview' | 'valuation' | 'profitability' | 'debt' | 'growth' | 'table' | 'ai_news';

export interface AIAnalysisResult {
  ticker: string;
  companyName: string;
  analysis: string;
  sources: { title: string; url: string }[];
  timestamp: string;
}

export interface SectorSummary {
  setor: string;
  totalEmpresas: number;
  mediaPL: number;
  mediaPVP: number;
  mediaROE: number;
  mediaROIC: number;
  mediaDY: number;
}

export interface StockHistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AIPrediction {
  tendencia: string;
  probabilidade: number;
  recomendacao: string;
  precoAlvoCurtoPrazo: number;
  precoAlvoLongoPrazo: number;
  pontoEntrada: number;
  stopLoss: number;
  riscoRetorno: string;
  analiseFundamentalista: string;
  analiseGrandesInvestidores: string;
  gatilhosAlta: string[];
  principaisRiscos: string[];
  vereditoFinal: string;
  fallback?: boolean;
}

export interface CustomAlert {
  id: string;
  stockTicker: string;
  tipo: 'preco_max' | 'preco_min' | 'ponto_entrada' | 'pl_abaixo' | 'dy_acima' | 'acumulacao_tubaroes' | 'variacao_dia';
  valorGatilho: number;
  ativo: boolean;
  mensagem: string;
  criadoEm: string;
  ultimoDisparo?: string;
}

export interface RankingWeights {
  pesoRentabilidade: number; // ROIC, ROE, Margens
  pesoValuation: number;     // P/L, P/VP, EV/EBIT
  pesoDividendos: number;    // Div. Yield
  pesoSaudeFinanceira: number; // Endividamento, Liq. Corr
  pesoSmartMoney: number;    // Fluxo grandes investidores
}
