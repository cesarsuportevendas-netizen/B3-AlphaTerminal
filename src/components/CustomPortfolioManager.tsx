import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StockIndicator, AIPrediction } from '../types/stock';
import { formatCurrency, formatPercent } from '../utils/financialCalculations';
import {
  Briefcase,
  Plus,
  Trash2,
  Edit3,
  TrendingUp,
  Sparkles,
  Clock,
  ArrowLeft,
  DollarSign,
  Target,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Check,
  X,
  PieChart,
  Upload,
  Download,
  FileText,
  Table,
  LineChart,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export type TimeCategory = 'minutos' | 'horas' | 'dias' | 'anos';
export type TimeInterval = '15m' | '30m' | '1h' | '4h' | '1D' | '1S' | '1A' | '5A';

interface ChartCandle {
  index: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  label: string;
  dateStr: string;
}

export interface CustomPosition {
  id: string;
  ticker: string;
  quantidade: number;
  precoMedio: number;
  dataEntrada: string;
  objetivo?: string;
}

interface CustomPortfolioManagerProps {
  stocks: StockIndicator[];
  onBack?: () => void;
  previousTabTitle?: string;
  onSelectStockForAI?: (stock: StockIndicator) => void;
}

const TIMEFRAME_CONFIG: {
  category: TimeCategory;
  label: string;
  intervals: {
    id: TimeInterval;
    label: string;
    description: string;
  }[];
}[] = [
  {
    category: 'minutos',
    label: 'Minutos',
    intervals: [
      { id: '15m', label: '15 Min', description: '15 minutos (Intraday B3 10:00 - 17:00)' },
      { id: '30m', label: '30 Min', description: '30 minutos (Intraday 2 sessões)' },
    ],
  },
  {
    category: 'horas',
    label: 'Horas',
    intervals: [
      { id: '1h', label: '1 Hora', description: '1 hora (Últimas 5 sessões)' },
      { id: '4h', label: '4 Horas', description: '4 horas (Swing Trade Curto)' },
    ],
  },
  {
    category: 'dias',
    label: 'Dias',
    intervals: [
      { id: '1D', label: '1 Dia (Diário)', description: 'Diário (Últimos 30 pregões da B3)' },
      { id: '1S', label: '1 Sem (Semanal)', description: 'Semanal (Últimos 6 meses)' },
    ],
  },
  {
    category: 'anos',
    label: 'Anos',
    intervals: [
      { id: '1A', label: '1 Ano', description: '1 Ano (Ciclo Anual de Balanços e Dividendos)' },
      { id: '5A', label: '5 Anos', description: '5 Anos (Histórico de Longo Prazo e Graham)' },
    ],
  },
];

function generateCandles(stock: StockIndicator, interval: TimeInterval): ChartCandle[] {
  const base = stock.cotacao;
  const isBullish = stock.rsi14 >= 50;
  const candles: ChartCandle[] = [];

  if (interval === '15m') {
    const count = 32;
    let curr = base * (1 - (isBullish ? 0.015 : -0.015));
    const times = [
      '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45',
      '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45',
      '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45',
      '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45',
    ];

    for (let i = 0; i < count; i++) {
      const open = curr;
      const delta = (Math.sin(i / 2.5) * 0.003 + Math.sin(i * 1.7) * 0.004) * base;
      let nextClose = open + delta;
      if (i === count - 1) nextClose = base;
      const close = nextClose;
      curr = close;
      const high = Math.max(open, close) + Math.abs(Math.cos(i)) * 0.0035 * base;
      const low = Math.min(open, close) - Math.abs(Math.sin(i)) * 0.0035 * base;
      const volume = Math.round(25000 + Math.abs(Math.sin(i * 3)) * 140000 + (i === count - 1 ? 95000 : 0));
      const timeLabel = times[i] || `1${Math.floor(i / 4)}:${(i % 4) * 15 || '00'}`;

      candles.push({
        index: i,
        open,
        close,
        high,
        low,
        volume,
        label: i % 4 === 0 ? timeLabel : '',
        dateStr: `Hoje às ${timeLabel}`,
      });
    }
  } else if (interval === '30m') {
    const count = 28;
    let curr = base * (1 - (isBullish ? 0.025 : -0.025));
    for (let i = 0; i < count; i++) {
      const open = curr;
      const delta = (Math.sin(i / 2) * 0.006 + Math.cos(i * 1.3) * 0.005) * base;
      let nextClose = open + delta;
      if (i === count - 1) nextClose = base;
      const close = nextClose;
      curr = close;
      const high = Math.max(open, close) + Math.abs(Math.sin(i)) * 0.0055 * base;
      const low = Math.min(open, close) - Math.abs(Math.cos(i)) * 0.0055 * base;
      const volume = Math.round(60000 + Math.abs(Math.sin(i * 2)) * 320000);
      const isToday = i >= 14;
      const hour = 10 + Math.floor((i % 14) / 2);
      const min = (i % 2) * 30 === 0 ? '00' : '30';
      const timeStr = `${hour}:${min}`;

      candles.push({
        index: i,
        open,
        close,
        high,
        low,
        volume,
        label: i % 4 === 0 ? timeStr : '',
        dateStr: `${isToday ? 'Hoje' : 'Ontem'} às ${timeStr}`,
      });
    }
  } else if (interval === '1h') {
    const count = 30;
    let curr = base * (1 - (isBullish ? 0.045 : -0.045));
    const days = ['29/10', '30/10', '31/10', '03/11', '04/11'];
    for (let i = 0; i < count; i++) {
      const open = curr;
      const delta = (Math.sin(i / 2.8) * 0.01 + Math.sin(i * 0.9) * 0.008) * base;
      let nextClose = open + delta;
      if (i === count - 1) nextClose = base;
      const close = nextClose;
      curr = close;
      const high = Math.max(open, close) + Math.abs(Math.cos(i * 1.1)) * 0.009 * base;
      const low = Math.min(open, close) - Math.abs(Math.sin(i * 1.2)) * 0.009 * base;
      const volume = Math.round(180000 + Math.abs(Math.sin(i * 2.3)) * 750000);
      const dayIdx = Math.floor(i / 6);
      const hour = 10 + (i % 6);
      const dateStr = `${days[Math.min(dayIdx, days.length - 1)]} ${hour}:00`;

      candles.push({
        index: i,
        open,
        close,
        high,
        low,
        volume,
        label: i % 6 === 0 ? dateStr.split(' ')[0] : '',
        dateStr,
      });
    }
  } else if (interval === '4h') {
    const count = 24;
    let curr = base * (1 - (isBullish ? 0.07 : -0.07));
    const dates = ['16/10', '18/10', '21/10', '23/10', '25/10', '28/10', '30/10', '01/11', '04/11'];
    for (let i = 0; i < count; i++) {
      const open = curr;
      const delta = (Math.sin(i / 2.2) * 0.018 + Math.cos(i * 1.1) * 0.012) * base;
      let nextClose = open + delta;
      if (i === count - 1) nextClose = base;
      const close = nextClose;
      curr = close;
      const high = Math.max(open, close) + Math.abs(Math.sin(i * 1.5)) * 0.014 * base;
      const low = Math.min(open, close) - Math.abs(Math.cos(i * 1.5)) * 0.014 * base;
      const volume = Math.round(650000 + Math.abs(Math.sin(i * 2.1)) * 2800000);
      const dIdx = Math.floor(i / 2.8);
      const dateStr = dates[Math.min(dIdx, dates.length - 1)] + (i % 2 === 0 ? ' Manhã' : ' Tarde');

      candles.push({
        index: i,
        open,
        close,
        high,
        low,
        volume,
        label: i % 3 === 0 ? dates[Math.min(dIdx, dates.length - 1)] : '',
        dateStr,
      });
    }
  } else if (interval === '1D') {
    const count = 30;
    let curr = base * (1 - (isBullish ? 0.12 : -0.12));
    const days = [
      '22/09', '23/09', '24/09', '25/09', '26/09',
      '29/09', '30/09', '01/10', '02/10', '03/10',
      '06/10', '07/10', '08/10', '09/10', '10/10',
      '13/10', '14/10', '15/10', '16/10', '17/10',
      '20/10', '21/10', '22/10', '23/10', '24/10',
      '27/10', '28/10', '29/10', '30/10', '04/11',
    ];
    for (let i = 0; i < count; i++) {
      const open = curr;
      const delta = (Math.sin(i / 3) * 0.025 + Math.cos(i * 0.8) * 0.02) * base;
      let nextClose = open + delta;
      if (i === count - 1) nextClose = base;
      const close = nextClose;
      curr = close;
      const high = Math.max(open, close) + Math.abs(Math.sin(i * 1.7)) * 0.018 * base;
      const low = Math.min(open, close) - Math.abs(Math.cos(i * 1.4)) * 0.018 * base;
      const volume = Math.round(1800000 + Math.abs(Math.sin(i * 1.9)) * 9500000);
      const dateStr = days[i] || `Pregão ${i + 1}`;

      candles.push({
        index: i,
        open,
        close,
        high,
        low,
        volume,
        label: i % 5 === 0 ? dateStr : '',
        dateStr: `Pregão ${dateStr}`,
      });
    }
  } else if (interval === '1S') {
    const count = 26;
    let curr = base * (1 - (isBullish ? 0.20 : -0.20));
    const weeks = [
      'Mai/26 Sem 1', 'Mai/26 Sem 2', 'Mai/26 Sem 3', 'Mai/26 Sem 4',
      'Jun/26 Sem 1', 'Jun/26 Sem 2', 'Jun/26 Sem 3', 'Jun/26 Sem 4',
      'Jul/26 Sem 1', 'Jul/26 Sem 2', 'Jul/26 Sem 3', 'Jul/26 Sem 4',
      'Ago/26 Sem 1', 'Ago/26 Sem 2', 'Ago/26 Sem 3', 'Ago/26 Sem 4',
      'Set/26 Sem 1', 'Set/26 Sem 2', 'Set/26 Sem 3', 'Set/26 Sem 4',
      'Out/26 Sem 1', 'Out/26 Sem 2', 'Out/26 Sem 3', 'Out/26 Sem 4',
      'Nov/26 Sem 1', 'Nov/26 Atual',
    ];
    for (let i = 0; i < count; i++) {
      const open = curr;
      const delta = (Math.sin(i / 2.7) * 0.038 + Math.cos(i * 0.9) * 0.025) * base;
      let nextClose = open + delta;
      if (i === count - 1) nextClose = base;
      const close = nextClose;
      curr = close;
      const high = Math.max(open, close) + Math.abs(Math.sin(i * 1.4)) * 0.028 * base;
      const low = Math.min(open, close) - Math.abs(Math.cos(i * 1.2)) * 0.028 * base;
      const volume = Math.round(9000000 + Math.abs(Math.sin(i * 1.7)) * 45000000);
      const dateStr = weeks[i] || `Semana ${i + 1}`;

      candles.push({
        index: i,
        open,
        close,
        high,
        low,
        volume,
        label: i % 4 === 0 ? dateStr.split(' ')[0] : '',
        dateStr,
      });
    }
  } else if (interval === '1A') {
    const count = 24;
    let curr = base * (1 - (isBullish ? 0.32 : -0.25));
    const months = [
      'Nov/25', 'Dez/25', 'Jan/26 (1)', 'Jan/26 (2)',
      'Fev/26 (1)', 'Fev/26 (2)', 'Mar/26 (1)', 'Mar/26 (2)', 'Abr/26 (1)',
      'Abr/26 (2)', 'Mai/26 (1)', 'Mai/26 (2)', 'Jun/26 (1)', 'Jun/26 (2)',
      'Jul/26 (1)', 'Jul/26 (2)', 'Ago/26 (1)', 'Ago/26 (2)', 'Set/26 (1)',
      'Set/26 (2)', 'Out/26 (1)', 'Out/26 (2)', 'Nov/26 Atual',
    ];
    for (let i = 0; i < count; i++) {
      const open = curr;
      const delta = (Math.sin(i / 2.3) * 0.05 + Math.cos(i * 0.7) * 0.035) * base;
      let nextClose = open + delta;
      if (i === count - 1) nextClose = base;
      const close = nextClose;
      curr = close;
      const high = Math.max(open, close) + Math.abs(Math.sin(i * 1.3)) * 0.04 * base;
      const low = Math.min(open, close) - Math.abs(Math.cos(i * 1.1)) * 0.04 * base;
      const volume = Math.round(28000000 + Math.abs(Math.sin(i * 1.5)) * 140000000);
      const dateStr = months[i] || `Período ${i + 1}`;

      candles.push({
        index: i,
        open,
        close,
        high,
        low,
        volume,
        label: i % 4 === 0 ? dateStr.split(' ')[0] : '',
        dateStr,
      });
    }
  } else {
    const count = 30;
    let curr = base * (1 - (isBullish ? 0.55 : -0.45));
    const years = [
      '2022 Q1', '2022 Q2', '2022 Q3', '2022 Q4', '2022 Fim',
      '2023 Q1', '2023 Q2', '2023 Q3', '2023 Q4', '2023 Fim',
      '2024 Q1', '2024 Q2', '2024 Q3', '2024 Q4', '2024 Fim',
      '2025 Q1', '2025 Q2', '2025 Q3', '2025 Q4', '2025 Fim',
      '2026 Q1', '2026 Q2', '2026 Q3', '2026 Q4', '2026 Atual',
      '2026 Nov', '2026 Dez', '2026 Jan', '2026 Fev', '2026 Hoje',
    ];
    for (let i = 0; i < count; i++) {
      const open = curr;
      const delta = (Math.sin(i / 3) * 0.08 + Math.cos(i * 0.6) * 0.06) * base;
      let nextClose = open + delta;
      if (i === count - 1) nextClose = base;
      const close = nextClose;
      curr = close;
      const high = Math.max(open, close) + Math.abs(Math.sin(i * 1.2)) * 0.07 * base;
      const low = Math.min(open, close) - Math.abs(Math.cos(i * 1.1)) * 0.07 * base;
      const volume = Math.round(80000000 + Math.abs(Math.sin(i * 1.3)) * 420000000);
      const dateStr = years[i] || `Ano ${2022 + Math.floor(i / 6)}`;

      candles.push({
        index: i,
        open,
        close,
        high,
        low,
        volume,
        label: i % 5 === 0 ? dateStr.split(' ')[0] : '',
        dateStr,
      });
    }
  }

  return candles;
}

const DEFAULT_PORTFOLIO: CustomPosition[] = [
  { id: 'pos_1', ticker: 'PETR4', quantidade: 200, precoMedio: 36.50, dataEntrada: '15/01/2026', objetivo: 'Dividendos & Valor' },
  { id: 'pos_2', ticker: 'BBAS3', quantidade: 300, precoMedio: 26.80, dataEntrada: '20/02/2026', objetivo: 'Renda & Crescimento' },
  { id: 'pos_3', ticker: 'VALE3', quantidade: 150, precoMedio: 58.90, dataEntrada: '10/03/2026', objetivo: 'Ciclo de Commodities' },
  { id: 'pos_4', ticker: 'CPLE6', quantidade: 600, precoMedio: 9.80, dataEntrada: '05/04/2026', objetivo: 'Bazin / DY Alto' },
  { id: 'pos_5', ticker: 'ITUB4', quantidade: 250, precoMedio: 33.20, dataEntrada: '18/05/2026', objetivo: 'Estabilidade & ROE' },
];

export const CustomPortfolioManager: React.FC<CustomPortfolioManagerProps> = ({
  stocks,
  onBack,
  previousTabTitle,
  onSelectStockForAI,
}) => {
  // Persistent Custom Portfolio
  const [positions, setPositions] = useState<CustomPosition[]>(() => {
    try {
      const raw = localStorage.getItem('b3_alpha_custom_portfolio_v1');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_PORTFOLIO;
  });

  useEffect(() => {
    try {
      localStorage.setItem('b3_alpha_custom_portfolio_v1', JSON.stringify(positions));
    } catch (e) {}
  }, [positions]);

  // View mode: 'analysis' (Detailed AI & Chart) vs 'table' (Full Asset Management Table)
  const [viewMode, setViewMode] = useState<'analysis' | 'table'>('analysis');

  // Selected Stock within the custom portfolio
  const [selectedTicker, setSelectedTicker] = useState<string>(() => {
    return positions[0]?.ticker || stocks[0]?.papel || 'PETR4';
  });

  const selectedStock = useMemo(() => {
    return stocks.find((s) => s.papel.toUpperCase() === selectedTicker.toUpperCase()) || stocks[0] || ({} as StockIndicator);
  }, [stocks, selectedTicker]);

  const activePosition = useMemo(() => {
    return positions.find((p) => p.ticker.toUpperCase() === selectedTicker.toUpperCase());
  }, [positions, selectedTicker]);

  // AI & Chart states (identical to AITrendForecast)
  const [horizon, setHorizon] = useState<'Curto e Longo Prazo' | 'Curto Prazo (Swing Trade)' | 'Longo Prazo (Buy & Hold)'>('Curto e Longo Prazo');
  const [customFocus, setCustomFocus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);

  // Timeframe selector state: Minutos, Horas, Dias, Anos
  const [timeCategory, setTimeCategory] = useState<TimeCategory>('dias');
  const [timeInterval, setTimeInterval] = useState<TimeInterval>('1D');
  const [hoveredCandle, setHoveredCandle] = useState<ChartCandle | null>(null);

  // Modals for Adding, Editing and CSV Import
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [positionToEdit, setPositionToEdit] = useState<CustomPosition | null>(null);

  // Add position form state
  const [newTicker, setNewTicker] = useState(stocks[0]?.papel || 'PETR4');
  const [newQuantity, setNewQuantity] = useState(100);
  const [newPrice, setNewPrice] = useState(stocks[0]?.cotacao || 30);
  const [newObjective, setNewObjective] = useState('Dividendos & Valor');

  // Edit position form state
  const [editQuantity, setEditQuantity] = useState(100);
  const [editPrice, setEditPrice] = useState(30);
  const [editObjective, setEditObjective] = useState('');
  const [editDate, setEditDate] = useState('');

  // Table search filter
  const [tableSearch, setTableSearch] = useState('');

  // CSV Import State
  const [csvRawText, setCsvRawText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [parsedImportRows, setParsedImportRows] = useState<{
    ticker: string;
    quantidade: number;
    precoMedio: number;
    objetivo: string;
    dataEntrada: string;
    valid: boolean;
    nomeEmpresa?: string;
    cotacaoAtual?: number;
  }[]>([]);
  const [importStatusMsg, setImportStatusMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Setup edit modal when triggered
  const handleOpenEditModal = (pos: CustomPosition) => {
    setPositionToEdit(pos);
    setEditQuantity(pos.quantidade);
    setEditPrice(pos.precoMedio);
    setEditObjective(pos.objetivo || 'Dividendos & Renda');
    setEditDate(pos.dataEntrada || new Date().toLocaleDateString('pt-BR'));
    setIsEditModalOpen(true);
  };

  // Generate dynamic candles
  const chartData = useMemo(() => {
    return generateCandles(selectedStock, timeInterval);
  }, [selectedStock, timeInterval]);

  const activeTimeframeDesc = useMemo(() => {
    const cat = TIMEFRAME_CONFIG.find((c) => c.category === timeCategory);
    const intv = cat?.intervals.find((i) => i.id === timeInterval);
    return intv ? intv.description : 'Gráfico Técnico';
  }, [timeCategory, timeInterval]);

  // Portfolio Totals Calculation
  const portfolioMetrics = useMemo(() => {
    let totalInvested = 0;
    let currentValue = 0;
    let annualDividends = 0;

    positions.forEach((pos) => {
      const stock = stocks.find((s) => s.papel.toUpperCase() === pos.ticker.toUpperCase());
      const cotacao = stock?.cotacao || pos.precoMedio;
      const dpa = stock?.dividendo12mPorAcao || ((cotacao * (stock?.divYield || 0)) / 100);

      const cost = pos.quantidade * pos.precoMedio;
      const current = pos.quantidade * cotacao;
      const divs = pos.quantidade * dpa;

      totalInvested += cost;
      currentValue += current;
      annualDividends += divs;
    });

    const profitLoss = currentValue - totalInvested;
    const profitLossPerc = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;
    const avgYield = currentValue > 0 ? (annualDividends / currentValue) * 100 : 0;
    const monthlyIncome = annualDividends / 12;

    return {
      totalInvested,
      currentValue,
      profitLoss,
      profitLossPerc,
      annualDividends,
      monthlyIncome,
      avgYield,
      count: positions.length,
    };
  }, [positions, stocks]);

  // Active Position Metrics
  const activePositionMetrics = useMemo(() => {
    if (!activePosition) return null;
    const cost = activePosition.quantidade * activePosition.precoMedio;
    const current = activePosition.quantidade * selectedStock.cotacao;
    const profitLoss = current - cost;
    const profitLossPerc = cost > 0 ? (profitLoss / cost) * 100 : 0;
    const dpa = selectedStock.dividendo12mPorAcao || ((selectedStock.cotacao * (selectedStock.divYield || 0)) / 100);
    const annualDivs = activePosition.quantidade * dpa;

    return {
      cost,
      current,
      profitLoss,
      profitLossPerc,
      annualDivs,
    };
  }, [activePosition, selectedStock]);

  // Filtered positions for the table
  const filteredPositions = useMemo(() => {
    if (!tableSearch.trim()) return positions;
    const term = tableSearch.toLowerCase();
    return positions.filter((pos) => {
      const s = stocks.find((st) => st.papel.toUpperCase() === pos.ticker.toUpperCase());
      return (
        pos.ticker.toLowerCase().includes(term) ||
        (s?.nomeEmpresa || '').toLowerCase().includes(term) ||
        (s?.setor || '').toLowerCase().includes(term) ||
        (pos.objetivo || '').toLowerCase().includes(term)
      );
    });
  }, [positions, stocks, tableSearch]);

  // AI Analysis Execution
  const handleRunAIAnalysis = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/analyze-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock: selectedStock,
          horizon,
          customFocus: customFocus.trim() || `Carteira Personalizada com preço médio de compra de ${formatCurrency(activePosition?.precoMedio || selectedStock.cotacao)}.`,
        }),
      });

      if (!res.ok) throw new Error('Falha na resposta');
      const data: AIPrediction = await res.json();
      setPrediction(data);
    } catch (e) {
      // Deterministic technical fallback
      setPrediction({
        tendencia: selectedStock.rsi14 >= 50 ? 'Alta Moderada' : 'Consolidação / Acumulação',
        probabilidade: Math.round(72 + (selectedStock.scoreAlpha / 10)),
        recomendacao: selectedStock.cotacao < selectedStock.precoJustoGraham ? 'Compra / Acumular' : 'Manter Posição',
        precoAlvoCurtoPrazo: Number((selectedStock.cotacao * 1.12).toFixed(2)),
        precoAlvoLongoPrazo: Number((selectedStock.cotacao * 1.34).toFixed(2)),
        pontoEntrada: selectedStock.pontoEntrada,
        stopLoss: selectedStock.stopLoss,
        riscoRetorno: selectedStock.riscoRetorno,
        analiseFundamentalista: `${selectedStock.papel} apresenta ROIC de ${selectedStock.roic}% e P/L de ${selectedStock.pl}, negociando com margens sólidas frente ao setor. A relação entre fluxo de caixa livre e pagamento de proventos confere sustentabilidade para a carteira.`,
        analiseGrandesInvestidores: `Identificado padrão de ${selectedStock.padraoWyckoff} com Score Smart Money de ${selectedStock.smartMoneyScore}/100. Absorção consistente nos books de ofertas.`,
        gatilhosAlta: [
          `Preço de mercado atrativo frente ao Preço Justo de Graham (${formatCurrency(selectedStock.precoJustoGraham)})`,
          'Fluxo sustentado de proventos gerando potencial de reinvestimento contínuo',
          'Recuperação de margens operacionais no ciclo setorial',
        ],
        principaisRiscos: [
          'Oscilações macroeconômicas na taxa Selic e câmbio',
          'Volatilidade nos preços de insumos ou commodities',
        ],
        vereditoFinal: `Ativo estratégico para a carteira. Ponto sugerido de entrada/reforço em ${formatCurrency(selectedStock.pontoEntrada)} e stop protetivo em ${formatCurrency(selectedStock.stopLoss)}.`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStock?.id) {
      handleRunAIAnalysis();
    }
  }, [selectedStock.id]);

  // Chart setup
  const allPrices = [
    ...chartData.map((d) => d.low),
    ...chartData.map((d) => d.high),
    selectedStock.pontoEntrada,
    selectedStock.stopLoss,
    selectedStock.alvo1CurtoPrazo,
    ...(timeCategory === 'anos' ? [selectedStock.precoJustoGraham] : []),
  ].filter((p): p is number => typeof p === 'number' && !isNaN(p) && p > 0);

  const minPrice = Math.min(...allPrices) * 0.97;
  const maxPrice = Math.max(...allPrices) * 1.03;
  const chartHeight = 230;
  const chartWidth = 620;

  const getY = (val: number) => {
    return chartHeight - ((val - minPrice) / (maxPrice - minPrice)) * (chartHeight - 34) - 20;
  };

  const maxVolume = Math.max(...chartData.map((d) => d.volume), 1);
  const activeCandle = hoveredCandle || chartData[chartData.length - 1];

  // Action: Add new position
  const handleAddPosition = () => {
    if (newQuantity <= 0 || newPrice <= 0) return;
    const tickerUpper = newTicker.trim().toUpperCase();
    const existingIndex = positions.findIndex((p) => p.ticker.toUpperCase() === tickerUpper);

    if (existingIndex >= 0) {
      const exist = positions[existingIndex];
      const totalCost = (exist.quantidade * exist.precoMedio) + (newQuantity * newPrice);
      const totalQty = exist.quantidade + newQuantity;
      const newPM = totalCost / totalQty;
      const updated = [...positions];
      updated[existingIndex] = {
        ...exist,
        quantidade: totalQty,
        precoMedio: Number(newPM.toFixed(2)),
        objetivo: newObjective || exist.objetivo,
      };
      setPositions(updated);
    } else {
      const newPos: CustomPosition = {
        id: 'pos_' + Date.now(),
        ticker: tickerUpper,
        quantidade: newQuantity,
        precoMedio: Number(newPrice.toFixed(2)),
        dataEntrada: new Date().toLocaleDateString('pt-BR'),
        objetivo: newObjective,
      };
      setPositions([...positions, newPos]);
    }
    setSelectedTicker(tickerUpper);
    setIsAddModalOpen(false);
  };

  // Action: Save edited position
  const handleSaveEdit = () => {
    if (!positionToEdit || editQuantity <= 0 || editPrice <= 0) return;
    const updated = positions.map((p) =>
      p.id === positionToEdit.id
        ? {
            ...p,
            quantidade: editQuantity,
            precoMedio: Number(editPrice.toFixed(2)),
            objetivo: editObjective,
            dataEntrada: editDate,
          }
        : p
    );
    setPositions(updated);
    setIsEditModalOpen(false);
    setPositionToEdit(null);
  };

  // Action: Remove position
  const handleRemovePosition = (id: string) => {
    const next = positions.filter((p) => p.id !== id);
    setPositions(next);
    if (selectedTicker === activePosition?.ticker && next.length > 0) {
      setSelectedTicker(next[0].ticker);
    }
  };

  // Action: Export Custom Portfolio to CSV
  const handleExportCSV = () => {
    const headers = [
      'Ticker',
      'Empresa',
      'Setor',
      'Quantidade',
      'Preco Medio (R$)',
      'Custo Total (R$)',
      'Cotacao Atual (R$)',
      'Valor de Mercado (R$)',
      'Lucro Prejuizo (R$)',
      'Rentabilidade (%)',
      'Div Yield (%)',
      'Proventos 12m Estimados (R$)',
      'Objetivo',
      'Data Entrada',
    ];

    const rows = positions.map((pos) => {
      const s = stocks.find((st) => st.papel.toUpperCase() === pos.ticker.toUpperCase());
      const cotacao = s?.cotacao || pos.precoMedio;
      const custoTotal = pos.quantidade * pos.precoMedio;
      const valorAtual = pos.quantidade * cotacao;
      const lucro = valorAtual - custoTotal;
      const rentabilidade = custoTotal > 0 ? (lucro / custoTotal) * 100 : 0;
      const dpa = s?.dividendo12mPorAcao || ((cotacao * (s?.divYield || 0)) / 100);
      const proventos = pos.quantidade * dpa;

      return [
        `"${pos.ticker}"`,
        `"${(s?.nomeEmpresa || pos.ticker).replace(/"/g, '""')}"`,
        `"${s?.setor || 'N/A'}"`,
        pos.quantidade,
        pos.precoMedio.toFixed(2).replace('.', ','),
        custoTotal.toFixed(2).replace('.', ','),
        cotacao.toFixed(2).replace('.', ','),
        valorAtual.toFixed(2).replace('.', ','),
        lucro.toFixed(2).replace('.', ','),
        rentabilidade.toFixed(2).replace('.', ','),
        (s?.divYield || 0).toFixed(2).replace('.', ','),
        proventos.toFixed(2).replace('.', ','),
        `"${(pos.objetivo || 'Geral').replace(/"/g, '""')}"`,
        `"${pos.dataEntrada}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `minha_carteira_b3_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Action: Parse CSV Raw Text
  const parseCSVContent = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      setParsedImportRows([]);
      setImportStatusMsg('Nenhuma linha encontrada no arquivo.');
      return;
    }

    // Determine delimiter (; or , or \t)
    const firstLine = lines[0];
    let delimiter = ';';
    if (firstLine.includes(';') && !firstLine.includes('\t')) delimiter = ';';
    else if (firstLine.includes(',') && !firstLine.includes(';')) delimiter = ',';
    else if (firstLine.includes('\t')) delimiter = '\t';

    const headerParts = firstLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

    // Map header indices
    let tickerIdx = headerParts.findIndex((h) => ['ticker', 'papel', 'ativo', 'codigo', 'código'].includes(h));
    let qtdIdx = headerParts.findIndex((h) => ['quantidade', 'qtd', 'quant', 'ações', 'acoes', 'cotas', 'qtde'].includes(h));
    let priceIdx = headerParts.findIndex((h) => ['precomedio', 'preco medio', 'preço médio', 'pm', 'preco', 'preço', 'custo medio'].includes(h));
    let objIdx = headerParts.findIndex((h) => ['objetivo', 'estrategia', 'estratégia', 'notas', 'tipo'].includes(h));
    let dateIdx = headerParts.findIndex((h) => ['data', 'data entrada', 'dataentrada', 'data aporte'].includes(h));

    // Fallbacks if headers not detected
    if (tickerIdx === -1) tickerIdx = 0;
    if (qtdIdx === -1) qtdIdx = 1;
    if (priceIdx === -1) priceIdx = 2;

    const dataLines = headerParts.some((h) => ['ticker', 'papel', 'quantidade', 'preco'].includes(h)) ? lines.slice(1) : lines;

    const parsed: typeof parsedImportRows = [];

    dataLines.forEach((line) => {
      const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) return;

      const rawTicker = (parts[tickerIdx] || '').toUpperCase().trim();
      if (!rawTicker || rawTicker.length < 3) return;

      const rawQtd = parseInt(parts[qtdIdx]?.replace(/\D/g, '') || '0', 10);
      const rawPriceStr = parts[priceIdx]?.replace(',', '.') || '0';
      const rawPrice = parseFloat(rawPriceStr.replace(/[^0-9.]/g, '')) || 0;

      const rawObj = objIdx >= 0 && parts[objIdx] ? parts[objIdx] : 'Importado via CSV';
      const rawDate = dateIdx >= 0 && parts[dateIdx] ? parts[dateIdx] : new Date().toLocaleDateString('pt-BR');

      const foundStock = stocks.find((s) => s.papel.toUpperCase() === rawTicker);

      parsed.push({
        ticker: rawTicker,
        quantidade: rawQtd > 0 ? rawQtd : 100,
        precoMedio: rawPrice > 0 ? Number(rawPrice.toFixed(2)) : (foundStock?.cotacao || 30),
        objetivo: rawObj,
        dataEntrada: rawDate,
        valid: rawTicker.length >= 4,
        nomeEmpresa: foundStock?.nomeEmpresa,
        cotacaoAtual: foundStock?.cotacao,
      });
    });

    setParsedImportRows(parsed);
    if (parsed.length > 0) {
      setImportStatusMsg(`${parsed.length} ativos identificados e prontos para importar.`);
    } else {
      setImportStatusMsg('Não foi possível identificar posições válidas no texto.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvRawText(text);
      parseCSVContent(text);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleConfirmImport = () => {
    if (parsedImportRows.length === 0) return;

    if (importMode === 'replace') {
      const newPositions: CustomPosition[] = parsedImportRows.map((r, i) => ({
        id: 'pos_' + Date.now() + '_' + i,
        ticker: r.ticker,
        quantidade: r.quantidade,
        precoMedio: r.precoMedio,
        dataEntrada: r.dataEntrada,
        objetivo: r.objetivo,
      }));
      setPositions(newPositions);
      if (newPositions[0]) setSelectedTicker(newPositions[0].ticker);
    } else {
      // Merge mode
      let updated = [...positions];
      parsedImportRows.forEach((r, i) => {
        const existIdx = updated.findIndex((p) => p.ticker.toUpperCase() === r.ticker.toUpperCase());
        if (existIdx >= 0) {
          const exist = updated[existIdx];
          const totalCost = (exist.quantidade * exist.precoMedio) + (r.quantidade * r.precoMedio);
          const totalQty = exist.quantidade + r.quantidade;
          updated[existIdx] = {
            ...exist,
            quantidade: totalQty,
            precoMedio: Number((totalCost / totalQty).toFixed(2)),
            objetivo: r.objetivo || exist.objetivo,
          };
        } else {
          updated.push({
            id: 'pos_' + Date.now() + '_' + i,
            ticker: r.ticker,
            quantidade: r.quantidade,
            precoMedio: r.precoMedio,
            dataEntrada: r.dataEntrada,
            objetivo: r.objetivo,
          });
        }
      });
      setPositions(updated);
      if (parsedImportRows[0]) setSelectedTicker(parsedImportRows[0].ticker);
    }

    setIsImportModalOpen(false);
    setCsvRawText('');
    setParsedImportRows([]);
  };

  const handleDownloadSampleCSV = () => {
    const sample = '\uFEFF' + [
      'Ticker;Quantidade;PrecoMedio;Objetivo;DataEntrada',
      'PETR4;200;36,50;Dividendos;15/01/2026',
      'BBAS3;300;26,80;Renda & Crescimento;20/02/2026',
      'VALE3;150;58,90;Commodities;10/03/2026',
      'CPLE6;600;9,80;Bazin / DY;05/04/2026',
      'ITUB4;250;33,20;Estabilidade;18/05/2026',
    ].join('\r\n');

    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_importacao_carteira.csv';
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar with Back Button */}
      {onBack && (
        <div className="flex items-center justify-between pb-1">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-medium transition-all group shadow-xs cursor-pointer"
            title="Voltar à tela anterior"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Voltar para {previousTabTitle || 'página anterior'}</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
            <span>Carteira Ativa: <strong className="text-white font-medium">{positions.length} ativos</strong></span>
          </div>
        </div>
      )}

      {/* Title & Section Header with CSV Import/Export & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wider uppercase mb-1">
            <span>Gerenciamento de Ativos & Carteira Personalizada</span>
            <span aria-hidden="true">·</span>
            <span>Previsões & Trades IA</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Minha Carteira Personalizada
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Edite e gerencie suas posições individuais, importe e exporte seus ativos em planilha CSV, e conte com o mesmo motor preditivo de inteligência artificial e gráficos multi-tempo de trade.
          </p>
        </div>

        {/* Action Toolbar: CSV Export/Import & Add Asset */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('analysis')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'analysis'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>Análise & Gráficos</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Gerenciar Ativos ({positions.length})</span>
            </button>
          </div>

          {/* Import CSV Button */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Importar posições via arquivo CSV"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Importar CSV</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Exportar carteira em arquivo CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exportar CSV</span>
          </button>

          {/* Add Asset Quick Button */}
          <button
            onClick={() => {
              setNewTicker(stocks[0]?.papel || 'PETR4');
              setNewPrice(stocks[0]?.cotacao || 30);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Adicionar Ativo</span>
          </button>
        </div>
      </div>

      {/* Portfolio Overview KPI Cards Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Patrimônio Atual</div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
            {formatCurrency(portfolioMetrics.currentValue)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Total Investido</div>
          <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">
            {formatCurrency(portfolioMetrics.totalInvested)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Lucro / Prejuízo</div>
          <div className={`text-lg font-bold font-mono mt-0.5 ${portfolioMetrics.profitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {portfolioMetrics.profitLoss >= 0 ? '+' : ''}{formatCurrency(portfolioMetrics.profitLoss)}
            <span className="text-xs font-sans ml-1 text-slate-400">
              ({portfolioMetrics.profitLoss >= 0 ? '+' : ''}{portfolioMetrics.profitLossPerc.toFixed(1)}%)
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Proventos / Ano (12m)</div>
          <div className="text-lg font-bold font-mono text-amber-300 mt-0.5">
            {formatCurrency(portfolioMetrics.annualDividends)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Renda Mensal Média</div>
          <div className="text-lg font-bold font-mono text-emerald-300 mt-0.5">
            {formatCurrency(portfolioMetrics.monthlyIncome)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">DY Médio Carteira</div>
          <div className="text-lg font-bold font-mono text-cyan-300 mt-0.5">
            {formatPercent(portfolioMetrics.avgYield)}
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: ASSET MANAGEMENT TABLE (Full Dedicated Asset Editing & Management) */}
      {viewMode === 'table' && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Table className="w-5 h-5 text-emerald-400" />
                <span>Tabela de Gestão de Ativos da Carteira</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Edite posições, ajuste cotas e preço médio, exporte/importe planilhas ou clique em qualquer ativo para abrir a análise de IA.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar ticker, empresa..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 w-48 sm:w-60 font-mono"
                />
              </div>

              <button
                onClick={() => {
                  setNewTicker(stocks[0]?.papel || 'PETR4');
                  setNewPrice(stocks[0]?.cotacao || 30);
                  setIsAddModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Ativo</span>
              </button>
            </div>
          </div>

          {/* Responsive Asset Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Ativo</th>
                  <th className="py-3 px-3 text-right">Qtd</th>
                  <th className="py-3 px-3 text-right">Preço Médio</th>
                  <th className="py-3 px-3 text-right">Custo Total</th>
                  <th className="py-3 px-3 text-right">Cotação Atual</th>
                  <th className="py-3 px-3 text-right">Valor Atual</th>
                  <th className="py-3 px-3 text-right">Lucro/Prej.</th>
                  <th className="py-3 px-3 text-right">DY 12m</th>
                  <th className="py-3 px-3 text-right">Proventos (12m)</th>
                  <th className="py-3 px-3">Objetivo</th>
                  <th className="py-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                {filteredPositions.map((pos) => {
                  const s = stocks.find((st) => st.papel.toUpperCase() === pos.ticker.toUpperCase());
                  const cotacao = s?.cotacao || pos.precoMedio;
                  const custo = pos.quantidade * pos.precoMedio;
                  const valor = pos.quantidade * cotacao;
                  const lucro = valor - custo;
                  const lucroPerc = custo > 0 ? (lucro / custo) * 100 : 0;
                  const dpa = s?.dividendo12mPorAcao || ((cotacao * (s?.divYield || 0)) / 100);
                  const proventos = pos.quantidade * dpa;
                  const isSelected = selectedTicker === pos.ticker;

                  return (
                    <tr
                      key={pos.id}
                      className={`hover:bg-slate-800/50 transition-colors ${isSelected ? 'bg-emerald-500/5' : ''}`}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedTicker(pos.ticker);
                              setViewMode('analysis');
                            }}
                            className="font-bold text-emerald-400 hover:text-emerald-300 text-sm cursor-pointer underline decoration-emerald-500/30"
                            title="Ver análise completa de IA deste ativo"
                          >
                            {pos.ticker}
                          </button>
                          <span className="text-slate-400 text-[11px] font-sans truncate max-w-[120px]" title={s?.nomeEmpresa}>
                            {s?.nomeEmpresa || '-'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-white">
                        {pos.quantidade}
                      </td>

                      <td className="py-3 px-3 text-right text-slate-300">
                        {formatCurrency(pos.precoMedio)}
                      </td>

                      <td className="py-3 px-3 text-right text-slate-300">
                        {formatCurrency(custo)}
                      </td>

                      <td className="py-3 px-3 text-right text-emerald-400 font-semibold">
                        {formatCurrency(cotacao)}
                      </td>

                      <td className="py-3 px-3 text-right text-white font-bold">
                        {formatCurrency(valor)}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <span className={`font-semibold ${lucro >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {lucro >= 0 ? '+' : ''}{formatCurrency(lucro)} ({lucro >= 0 ? '+' : ''}{lucroPerc.toFixed(1)}%)
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right text-cyan-300">
                        {formatPercent(s?.divYield || 0)}
                      </td>

                      <td className="py-3 px-3 text-right text-amber-300 font-semibold">
                        {formatCurrency(proventos)}
                      </td>

                      <td className="py-3 px-3 text-slate-400 text-[11px] font-sans">
                        {pos.objetivo || 'Geral'}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedTicker(pos.ticker);
                              setViewMode('analysis');
                            }}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 transition-colors cursor-pointer"
                            title="Abrir Análise de IA & Gráfico"
                          >
                            <LineChart className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(pos)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-colors cursor-pointer"
                            title="Editar Quantidade e Preço Médio"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {positions.length > 1 && (
                            <button
                              onClick={() => handleRemovePosition(pos.id)}
                              className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                              title="Remover ativo da carteira"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quick Table Footer Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 pt-2 font-mono gap-2">
            <div>
              Exibindo <strong>{filteredPositions.length}</strong> de <strong>{positions.length}</strong> ativos cadastrados na carteira
            </div>
            <div className="flex items-center gap-3">
              <span>Total Ações: <strong className="text-white">{positions.reduce((acc, p) => acc + p.quantidade, 0)}</strong></span>
              <span>Patrimônio: <strong className="text-emerald-400">{formatCurrency(portfolioMetrics.currentValue)}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Asset Selector Strip for the Custom Portfolio (Visible in Analysis Mode) */}
      {viewMode === 'analysis' && (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium text-slate-300 flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-emerald-400" />
              <span>Selecione o Ativo da sua Carteira para Análise & Trades:</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('table')}
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Table className="w-3 h-3" />
                <span>Ver Tabela Completa</span>
              </button>
              <span className="font-mono text-slate-500">· {positions.length} ativos</span>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {positions.map((pos) => {
              const stock = stocks.find((s) => s.papel.toUpperCase() === pos.ticker.toUpperCase());
              const cotacao = stock?.cotacao || pos.precoMedio;
              const isSelected = selectedTicker === pos.ticker;
              const profit = (cotacao / pos.precoMedio - 1) * 100;

              return (
                <button
                  key={pos.id}
                  onClick={() => setSelectedTicker(pos.ticker)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-xs'
                      : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="font-bold text-sm text-emerald-400">{pos.ticker}</span>
                  <span className="text-[11px] text-slate-400">{pos.quantidade} aç</span>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-semibold ${
                    profit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {profit >= 0 ? '+' : ''}{profit.toFixed(1)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid: Chart & Trade Setups on Left, AI Output on Right (IDENTICAL FORMAT TO PREVISÕES IA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Multi-Timeframe Chart & Trade Markers */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            {/* Header: Stock Info & Technical Signals */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold font-mono text-white">
                    {selectedStock.papel}
                  </span>
                  <span className="text-xl font-mono text-emerald-400">
                    {formatCurrency(selectedStock.cotacao)}
                  </span>
                </div>
                <div className="text-xs text-slate-400 leading-snug break-words whitespace-normal mt-0.5">
                  {selectedStock.nomeEmpresa} · {selectedStock.setor}
                </div>
              </div>

              <div className="text-right font-mono text-xs shrink-0">
                <span className="text-slate-400">Tendência: </span>
                <span className="text-emerald-400 font-bold">{selectedStock.tendenciaTecnica}</span>
                <div className="text-slate-500 text-[11px]">RSI(14): {selectedStock.rsi14}</div>
              </div>
            </div>

            {/* Position Details Strip & Action Buttons for Active Asset */}
            {activePosition && activePositionMetrics && (
              <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-1.5">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Detalhes da sua Posição em {selectedStock.papel}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(activePosition)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded transition-colors cursor-pointer"
                      title="Editar quantidade ou preço médio"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Editar Posição</span>
                    </button>
                    {positions.length > 1 && (
                      <button
                        onClick={() => handleRemovePosition(activePosition.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs rounded transition-colors cursor-pointer"
                        title="Remover ativo da carteira"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Remover</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Quantidade:</span>
                    <strong className="text-slate-200">{activePosition.quantidade} ações</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Preço Médio:</span>
                    <strong className="text-slate-200">{formatCurrency(activePosition.precoMedio)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Valor Atual:</span>
                    <strong className="text-emerald-400">{formatCurrency(activePositionMetrics.current)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Resultado:</span>
                    <strong className={activePositionMetrics.profitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {activePositionMetrics.profitLoss >= 0 ? '+' : ''}{formatCurrency(activePositionMetrics.profitLoss)} ({activePositionMetrics.profitLossPerc.toFixed(1)}%)
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Timeframe Selector Toolbar: Minutos, Horas, Dias, Anos */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                {/* 4 Main Categories: Minutos, Horas, Dias, Anos */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  {TIMEFRAME_CONFIG.map((cfg) => {
                    const isActive = timeCategory === cfg.category;
                    return (
                      <button
                        key={cfg.category}
                        onClick={() => {
                          setTimeCategory(cfg.category);
                          setTimeInterval(cfg.intervals[0].id);
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>

                {/* Sub-intervals for Active Category */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">Intervalo:</span>
                  {TIMEFRAME_CONFIG.find((c) => c.category === timeCategory)?.intervals.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => setTimeInterval(inv.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
                        timeInterval === inv.id
                          ? 'bg-slate-800 text-white border border-slate-600 font-bold'
                          : 'bg-slate-900 hover:bg-slate-800/60 text-slate-400 border border-slate-800'
                      }`}
                      title={inv.description}
                    >
                      {inv.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic HUD Inspection Bar Divided into Clean Structured Lines (PREGÃO DATA) */}
              {activeCandle && (
                <div className="pt-2.5 border-t border-slate-800/80 space-y-2 text-xs font-mono">
                  {/* Linha 1: Dados do Pregão / Data & Fechamento / Variação */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="text-slate-400">Dados do Pregão:</span>
                      <strong className="text-white font-semibold">{activeCandle.dateStr}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Fechamento:</span>
                      <strong className={`font-bold ${activeCandle.close >= activeCandle.open ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(activeCandle.close)}
                      </strong>
                      <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                        activeCandle.close >= activeCandle.open
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {activeCandle.close >= activeCandle.open ? '+' : ''}
                        {(((activeCandle.close - activeCandle.open) / (activeCandle.open || 1)) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Linha 2: Métricas de Preço & Volume divididas em grid responsivo */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Abertura</div>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {formatCurrency(activeCandle.open)}
                      </div>
                    </div>

                    <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Máxima</div>
                      <div className="font-semibold text-emerald-400 mt-0.5">
                        {formatCurrency(activeCandle.high)}
                      </div>
                    </div>

                    <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Mínima</div>
                      <div className="font-semibold text-rose-400 mt-0.5">
                        {formatCurrency(activeCandle.low)}
                      </div>
                    </div>

                    <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Volume</div>
                      <div className="font-semibold text-cyan-300 mt-0.5 truncate" title={`${activeCandle.volume.toLocaleString('pt-BR')} ações`}>
                        {activeCandle.volume.toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SVG Candlestick / Multi-timeframe Chart with Trade Levels & Volume */}
            <div className="relative bg-slate-950 p-4 rounded-xl border border-slate-800/80">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-58 overflow-visible"
              >
                {/* Horizontal grid lines */}
                {[0.2, 0.4, 0.6, 0.8].map((pct, i) => (
                  <line
                    key={i}
                    x1="0"
                    y1={chartHeight * pct}
                    x2={chartWidth}
                    y2={chartHeight * pct}
                    stroke="#1e293b"
                    strokeDasharray="4 4"
                  />
                ))}

                {/* Trade Level 1: Alvo 1 (Curto Prazo) */}
                <line
                  x1="0"
                  y1={getY(selectedStock.alvo1CurtoPrazo)}
                  x2={chartWidth}
                  y2={getY(selectedStock.alvo1CurtoPrazo)}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <text
                  x={chartWidth - 5}
                  y={getY(selectedStock.alvo1CurtoPrazo) - 4}
                  fill="#38bdf8"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  Alvo 1: {formatCurrency(selectedStock.alvo1CurtoPrazo)}
                </text>

                {/* Trade Level 2: Ponto de Entrada */}
                <line
                  x1="0"
                  y1={getY(selectedStock.pontoEntrada)}
                  x2={chartWidth}
                  y2={getY(selectedStock.pontoEntrada)}
                  stroke="#34d399"
                  strokeWidth="1.5"
                />
                <text
                  x="6"
                  y={getY(selectedStock.pontoEntrada) - 4}
                  fill="#34d399"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  Entrada: {formatCurrency(selectedStock.pontoEntrada)}
                </text>

                {/* Trade Level 3: Stop Loss */}
                <line
                  x1="0"
                  y1={getY(selectedStock.stopLoss)}
                  x2={chartWidth}
                  y2={getY(selectedStock.stopLoss)}
                  stroke="#fb7185"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                <text
                  x={chartWidth - 5}
                  y={getY(selectedStock.stopLoss) + 12}
                  fill="#fb7185"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  Stop: {formatCurrency(selectedStock.stopLoss)}
                </text>

                {/* Extra Benchmark for Long-term (Anos): Preço Justo Graham */}
                {timeCategory === 'anos' && selectedStock.precoJustoGraham > 0 && (
                  <>
                    <line
                      x1="0"
                      y1={getY(selectedStock.precoJustoGraham)}
                      x2={chartWidth}
                      y2={getY(selectedStock.precoJustoGraham)}
                      stroke="#fbbf24"
                      strokeWidth="1.2"
                      strokeDasharray="5 3"
                    />
                    <text
                      x="6"
                      y={getY(selectedStock.precoJustoGraham) + 11}
                      fill="#fbbf24"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      Graham Justo: {formatCurrency(selectedStock.precoJustoGraham)}
                    </text>
                  </>
                )}

                {/* Candlesticks and Volume Bars */}
                {chartData.map((d, idx) => {
                  const x = (idx / (chartData.length - 1)) * (chartWidth - 40) + 20;
                  const isGreen = d.close >= d.open;
                  const candleY = getY(Math.max(d.open, d.close));
                  const candleHeight = Math.max(2.5, Math.abs(getY(d.open) - getY(d.close)));
                  const highY = getY(d.high);
                  const lowY = getY(d.low);

                  // Volume Sub-bar (22px height at bottom)
                  const volHeight = Math.max(3, (d.volume / maxVolume) * 22);
                  const volY = chartHeight - volHeight;

                  const isHovered = hoveredCandle?.index === idx;

                  return (
                    <g
                      key={idx}
                      onMouseEnter={() => setHoveredCandle(d)}
                      onMouseLeave={() => setHoveredCandle(null)}
                      className="cursor-pointer"
                    >
                      {/* Vertical highlight line on hover */}
                      {isHovered && (
                        <line
                          x1={x}
                          y1="0"
                          x2={x}
                          y2={chartHeight}
                          stroke="#64748b"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                          opacity="0.6"
                        />
                      )}

                      {/* Bottom Volume Bar */}
                      <rect
                        x={x - 2.5}
                        y={volY}
                        width="5"
                        height={volHeight}
                        fill={isGreen ? '#10b981' : '#f43f5e'}
                        opacity={isHovered ? 0.7 : 0.28}
                        rx="0.5"
                      />

                      {/* Candle Wick */}
                      <line
                        x1={x}
                        y1={highY}
                        x2={x}
                        y2={lowY}
                        stroke={isGreen ? '#10b981' : '#f43f5e'}
                        strokeWidth="1.2"
                      />

                      {/* Candle Body */}
                      <rect
                        x={x - 3.5}
                        y={candleY}
                        width="7"
                        height={candleHeight}
                        fill={isGreen ? '#10b981' : '#f43f5e'}
                        rx="1"
                        stroke={isHovered ? '#ffffff' : 'none'}
                        strokeWidth={isHovered ? 1 : 0}
                      />

                      {/* Time Tick Label */}
                      {d.label && (
                        <text
                          x={x}
                          y={chartHeight + 11}
                          fill="#64748b"
                          fontSize="9"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {d.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Chart Legend & Period Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] font-mono text-slate-400 mt-4 pt-2 border-t border-slate-800 gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-emerald-400"></span> Entrada
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-cyan-400"></span> Alvo 1
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-rose-400"></span> Stop Loss
                  </span>
                  {timeCategory === 'anos' && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-xs bg-amber-400"></span> Graham Justo
                    </span>
                  )}
                </div>
                <div className="text-slate-300">
                  Período: <strong className="text-emerald-400">{activeTimeframeDesc}</strong>
                </div>
              </div>
            </div>

            {/* Quick Tactical Setup Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Ponto Entrada</div>
                <div className="font-bold text-emerald-400 mt-0.5">
                  {formatCurrency(selectedStock.pontoEntrada)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Stop Loss</div>
                <div className="font-bold text-rose-400 mt-0.5">
                  {formatCurrency(selectedStock.stopLoss)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Alvo 1 (Curto)</div>
                <div className="font-bold text-cyan-300 mt-0.5">
                  {formatCurrency(selectedStock.alvo1CurtoPrazo)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Risco / Retorno</div>
                <div className="font-bold text-white mt-0.5">
                  {selectedStock.riscoRetorno}
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300 font-semibold">Padrão Gráfico Detectado: </span>
              {selectedStock.padraoGrafico}
            </div>
          </div>
        </div>

        {/* Right Column: AI Analysis Engine */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">
                  Inteligência Artificial Preditiva
                </h3>
              </div>

              <button
                onClick={handleRunAIAnalysis}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Analisando Mercado...' : 'Atualizar Previsão'}</span>
              </button>
            </div>

            {/* AI Controls Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Horizonte do Trade:</label>
                <select
                  value={horizon}
                  onChange={(e: any) => setHorizon(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Curto e Longo Prazo">Curto e Longo Prazo (Convergência)</option>
                  <option value="Curto Prazo (Swing Trade)">Curto Prazo (Swing Trade - Semanas)</option>
                  <option value="Longo Prazo (Buy & Hold)">Longo Prazo (Buy & Hold - Meses/Anos)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Foco Específico (Opcional):</label>
                <input
                  type="text"
                  placeholder="Ex: Impacto na minha carteira, dividendos..."
                  value={customFocus}
                  onChange={(e) => setCustomFocus(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* AI Output Content */}
            {isLoading ? (
              <div className="p-8 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-200">
                  Calculando projeções quantitativas e cruzando múltiplos com fluxo institucional...
                </p>
                <p className="text-xs text-slate-500">
                  Avaliando balanço, margens operacionais, ROIC e posicionamento dos tubarões em {selectedStock.papel}.
                </p>
              </div>
            ) : prediction ? (
              <div className="space-y-4">
                {/* Top Prediction Bar */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Tendência Projetada</div>
                    <div className="text-xl font-bold text-emerald-400 font-sans mt-0.5">
                      {prediction.tendencia}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-400">Confiança do Modelo</div>
                    <div className="text-xl font-bold font-mono text-white mt-0.5">
                      {prediction.probabilidade}%
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-400">Recomendação</div>
                    <div className="text-base font-bold text-emerald-300 mt-0.5">
                      {prediction.recomendacao}
                    </div>
                  </div>
                </div>

                {/* Fundamental & Financial Health Analysis */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                    Situação Financeira & Saúde Fundamentalista
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {prediction.analiseFundamentalista}
                  </p>
                </div>

                {/* Institutional Flow & Sharks */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400 font-mono">
                    Fluxo Oculto dos Grandes Investidores
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {prediction.analiseGrandesInvestidores}
                  </p>
                </div>

                {/* Triggers & Risks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <span className="font-semibold text-emerald-400 font-mono">Gatilhos de Alta:</span>
                    <ul className="space-y-1 text-slate-300 list-disc list-inside">
                      {prediction.gatilhosAlta.map((g, idx) => (
                        <li key={idx} className="leading-snug text-[11px]">{g}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <span className="font-semibold text-rose-400 font-mono">Principais Riscos:</span>
                    <ul className="space-y-1 text-slate-300 list-disc list-inside">
                      {prediction.principaisRiscos.map((r, idx) => (
                        <li key={idx} className="leading-snug text-[11px]">{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Final Verdict */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-slate-200">
                  <strong className="text-emerald-300 block font-semibold mb-1">Veredito da Tese:</strong>
                  {prediction.vereditoFinal}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Modal: Add New Asset to Custom Portfolio */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Adicionar Ativo à Carteira</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Selecione o Ativo (B3):</label>
                <select
                  value={newTicker}
                  onChange={(e) => {
                    setNewTicker(e.target.value);
                    const found = stocks.find((s) => s.papel === e.target.value);
                    if (found) setNewPrice(found.cotacao);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                >
                  {stocks.map((s) => (
                    <option key={s.id} value={s.papel}>
                      {s.papel} - {s.nomeEmpresa} ({formatCurrency(s.cotacao)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Quantidade de Ações:</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Preço Médio de Compra (R$):</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Objetivo / Estratégia:</label>
                <select
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Dividendos & Renda Passiva">Dividendos & Renda Passiva</option>
                  <option value="Valor & Valuation (Graham/Bazin)">Valor & Valuation (Graham/Bazin)</option>
                  <option value="Crescimento & ROIC">Crescimento & ROIC</option>
                  <option value="Swing Trade Técnico">Swing Trade Técnico</option>
                </select>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total a Investir nesta Posição:</span>
                  <strong className="text-emerald-400 font-mono">{formatCurrency(newQuantity * newPrice)}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddPosition}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Salvar Ativo na Carteira
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Existing Position */}
      {isEditModalOpen && positionToEdit && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Editar {positionToEdit.ticker}</h3>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setPositionToEdit(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Quantidade de Ações:</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Preço Médio (R$):</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Objetivo / Estratégia:</label>
                <input
                  type="text"
                  value={editObjective}
                  onChange={(e) => setEditObjective(e.target.value)}
                  placeholder="Ex: Dividendos & Renda"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Data da Entrada:</label>
                <input
                  type="text"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Novo Custo Total:</span>
                  <strong className="text-white">{formatCurrency(editQuantity * editPrice)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Valor Atual de Mercado:</span>
                  <strong className="text-emerald-400">
                    {formatCurrency(editQuantity * (stocks.find((s) => s.papel.toUpperCase() === positionToEdit.ticker.toUpperCase())?.cotacao || editPrice))}
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setPositionToEdit(null);
                }}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Atualizar Posição
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import CSV to Custom Portfolio */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Importar Carteira via Arquivo CSV</h3>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setCsvRawText('');
                  setParsedImportRows([]);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-400 leading-relaxed">
                Faça upload de um arquivo <strong>.CSV</strong> gerado pelo seu banco, corretora ou exportado previamente, ou cole o conteúdo diretamente no campo de texto abaixo.
              </p>

              {/* Upload Dropzone & Example Download */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950/60 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className="w-6 h-6 text-emerald-400" />
                  <span className="font-semibold text-slate-200">Clique para selecionar arquivo CSV</span>
                  <span className="text-[11px] text-slate-500">Formatos: .csv ou .txt (delimitador ponto e vírgula ou vírgula)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-2">
                  <div>
                    <span className="text-slate-300 font-semibold block mb-1">Modelo de Planilha Exemplo</span>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Baixe uma planilha modelo pré-configurada para preencher no Excel ou Google Sheets e importar na sua carteira.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadSampleCSV}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs rounded-lg transition-colors cursor-pointer border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Modelo CSV</span>
                  </button>
                </div>
              </div>

              {/* Or Paste CSV Text Directly */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">Ou Cole os Dados do CSV aqui:</label>
                <textarea
                  rows={4}
                  value={csvRawText}
                  onChange={(e) => {
                    setCsvRawText(e.target.value);
                    parseCSVContent(e.target.value);
                  }}
                  placeholder={'Ticker;Quantidade;PrecoMedio;Objetivo;DataEntrada\nPETR4;200;36.50;Dividendos;15/01/2026\nBBAS3;300;26.80;Renda;20/02/2026'}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Import Mode: Merge vs Replace */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-slate-300 font-semibold block">Modo de Atualização da Carteira:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    importMode === 'merge'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="mt-0.5 accent-emerald-500"
                    />
                    <div>
                      <strong className="block text-xs text-white">Mesclar & Atualizar (Recomendado)</strong>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Adiciona novas posições e atualiza a média dos ativos já existentes.
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    importMode === 'replace'
                      ? 'bg-rose-500/10 border-rose-500/40 text-slate-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 accent-rose-500"
                    />
                    <div>
                      <strong className="block text-xs text-white">Substituir Carteira Inteira</strong>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Apaga todas as posições atuais e define apenas os ativos deste arquivo.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Parsed Rows Preview */}
              {parsedImportRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Pré-visualização: {parsedImportRows.length} ativos prontos para importar</span>
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      Total: {formatCurrency(parsedImportRows.reduce((acc, r) => acc + (r.quantidade * r.precoMedio), 0))}
                    </span>
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-lg">
                    <table className="w-full text-left font-mono text-[11px]">
                      <thead className="bg-slate-950 text-slate-400 sticky top-0">
                        <tr>
                          <th className="py-1.5 px-2.5">Ticker</th>
                          <th className="py-1.5 px-2.5">Empresa</th>
                          <th className="py-1.5 px-2.5 text-right">Qtd</th>
                          <th className="py-1.5 px-2.5 text-right">PM (R$)</th>
                          <th className="py-1.5 px-2.5 text-right">Custo Total</th>
                          <th className="py-1.5 px-2.5">Objetivo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                        {parsedImportRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="py-1.5 px-2.5 font-bold text-emerald-400">{row.ticker}</td>
                            <td className="py-1.5 px-2.5 text-slate-300 font-sans truncate max-w-[140px]">{row.nomeEmpresa || 'Ativo B3'}</td>
                            <td className="py-1.5 px-2.5 text-right text-white font-bold">{row.quantidade}</td>
                            <td className="py-1.5 px-2.5 text-right text-slate-300">{formatCurrency(row.precoMedio)}</td>
                            <td className="py-1.5 px-2.5 text-right text-cyan-300 font-semibold">{formatCurrency(row.quantidade * row.precoMedio)}</td>
                            <td className="py-1.5 px-2.5 text-slate-400 font-sans text-[10px]">{row.objetivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setCsvRawText('');
                  setParsedImportRows([]);
                }}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                disabled={parsedImportRows.length === 0}
                onClick={handleConfirmImport}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Importação de {parsedImportRows.length} Ativos</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
