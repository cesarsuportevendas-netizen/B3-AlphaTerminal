import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { StockIndicator } from '../types/stock';
import {
  Activity,
  GitCompareArrows,
  Loader2,
  Plus,
  RefreshCw,
  TrendingUp,
  X,
  AlertCircle,
  Layers,
} from 'lucide-react';

type HistoryRange = '1mo' | '3mo' | '6mo' | '1y';
type UniverseMode = 'portfolio' | 'top10' | 'filtered' | 'custom';

interface CorrelationAssetStat {
  ticker: string;
  source: string;
  lastClose: number;
  periodReturnPct: number;
  annualizedVolPct: number;
  maxDrawdownPct: number;
  betaIbov: number | null;
  observations: number;
}

interface NormalizedPoint {
  date: string;
  close: number;
  base100: number;
  returnPct: number;
}

interface NormalizedSeries {
  ticker: string;
  source: string;
  values: NormalizedPoint[];
}

interface PairReturnPoint {
  date: string;
  retA: number;
  retB: number;
}

interface CorrelationResponse {
  range: HistoryRange;
  updatedAt: string;
  tickers: string[];
  failedTickers: string[];
  sourcesUsed: string[];
  commonDatesCount: number;
  commonDates: string[];
  matrix: number[][];
  sampleSizes: number[][];
  summary: {
    averageCorrelation: number;
    lowestPair: { tickerA: string; tickerB: string; correlation: number } | null;
    highestPair: { tickerA: string; tickerB: string; correlation: number } | null;
  };
  assets: CorrelationAssetStat[];
  normalizedSeries: NormalizedSeries[];
  ibovSeries: NormalizedPoint[] | null;
  pairSeries: Record<string, PairReturnPoint[]>;
}

interface CorrelationMatrixProps {
  stocks: StockIndicator[];
  filteredStocks: StockIndicator[];
}

const DEFAULT_PORTFOLIO_TICKERS = ['PETR4', 'BBAS3', 'VALE3', 'CPLE6', 'ITUB4'];

const LINE_PALETTE = [
  '#10b981', // emerald-500
  '#38bdf8', // sky-400
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
  '#a78bfa', // violet-400
  '#2dd4bf', // teal-400
  '#fb923c', // orange-400
  '#60a5fa', // blue-400
  '#e879f9', // fuchsia-400
  '#facc15', // yellow-400
  '#4ade80', // green-400
  '#fb7185', // rose-400
];

function readPortfolioTickers(): string[] {
  try {
    const raw = localStorage.getItem('b3_alpha_custom_portfolio_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const list = parsed
          .map((p: { ticker?: string }) => String(p?.ticker || '').toUpperCase().trim())
          .filter((t) => t.length >= 4);
        if (list.length >= 2) return Array.from(new Set(list)).slice(0, 12);
      }
    }
  } catch {
    // Fallback to default portfolio tickers
  }
  return DEFAULT_PORTFOLIO_TICKERS;
}

function interpretCorrelation(r: number): { label: string; colorClass: string } {
  if (r >= 0.75) return { label: 'Muito Forte (+)', colorClass: 'text-rose-400' };
  if (r >= 0.45) return { label: 'Moderada (+)', colorClass: 'text-amber-300' };
  if (r >= 0.15) return { label: 'Fraca (+)', colorClass: 'text-slate-300' };
  if (r > -0.15) return { label: 'Descorrelacionada', colorClass: 'text-emerald-400' };
  if (r > -0.45) return { label: 'Inversa Moderada (-)', colorClass: 'text-cyan-300' };
  return { label: 'Hedge Forte (-)', colorClass: 'text-cyan-400' };
}

export const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({
  stocks,
  filteredStocks,
}) => {
  const [universeMode, setUniverseMode] = useState<UniverseMode>('portfolio');
  const [range, setRange] = useState<HistoryRange>('6mo');
  const [customTickers, setCustomTickers] = useState<string[]>(() => readPortfolioTickers());
  const [tickerInput, setTickerInput] = useState('');
  const [showIbov, setShowIbov] = useState(true);

  const [data, setData] = useState<CorrelationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPair, setSelectedPair] = useState<[string, string] | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    tickerA: string;
    tickerB: string;
    corr: number;
    samples: number;
    x: number;
    y: number;
  } | null>(null);

  const [movementTooltip, setMovementTooltip] = useState<{
    date: string;
    items: { ticker: string; returnPct: number; close: number; color: string }[];
    ibovReturnPct?: number;
  } | null>(null);

  const heatmapSvgRef = useRef<SVGSVGElement | null>(null);
  const movementSvgRef = useRef<SVGSVGElement | null>(null);
  const scatterSvgRef = useRef<SVGSVGElement | null>(null);

  const activeTickers = useMemo(() => {
    if (universeMode === 'portfolio') {
      const pTickers = readPortfolioTickers();
      if (pTickers.length >= 2) return pTickers;
    }
    if (universeMode === 'top10') {
      const sorted = [...stocks].sort((a, b) => (b.scoreAlpha || 0) - (a.scoreAlpha || 0));
      const list = sorted.slice(0, 10).map((s) => s.papel.toUpperCase().trim());
      if (list.length >= 2) return list;
    }
    if (universeMode === 'filtered') {
      const source = filteredStocks.length >= 2 ? filteredStocks : stocks;
      const sorted = [...source].sort((a, b) => (b.scoreAlpha || 0) - (a.scoreAlpha || 0));
      const list = sorted.slice(0, 12).map((s) => s.papel.toUpperCase().trim());
      if (list.length >= 2) return list;
    }
    if (customTickers.length >= 2) return customTickers;
    return DEFAULT_PORTFOLIO_TICKERS;
  }, [universeMode, stocks, filteredStocks, customTickers]);

  const fetchCorrelation = async (tickersToLoad: string[], selectedRange: HistoryRange) => {
    if (tickersToLoad.length < 2) {
      setErrorMsg('Selecione pelo menos 2 ativos da B3 para calcular a matriz de correlação.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/stocks/correlation-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: tickersToLoad, range: selectedRange }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Falha ao consultar histórico de mercado.');
      }
      setData(json as CorrelationResponse);
      const t = (json as CorrelationResponse).tickers;
      if (t.length >= 2) {
        if (json.summary?.lowestPair) {
          setSelectedPair([json.summary.lowestPair.tickerA, json.summary.lowestPair.tickerB]);
        } else {
          setSelectedPair([t[0], t[1]]);
        }
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Erro ao carregar séries históricas reais da internet.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrelation(activeTickers, range);
  }, [activeTickers.join(','), range]);

  const handleAddCustomTicker = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = tickerInput
      .toUpperCase()
      .trim()
      .replace(/\.SA$/i, '')
      .replace(/[^A-Z0-9]/g, '');
    if (clean.length < 4) return;
    setUniverseMode('custom');
    setCustomTickers((prev) => {
      if (prev.includes(clean)) return prev;
      return [...prev.slice(0, 14), clean];
    });
    setTickerInput('');
  };

  const handleRemoveCustomTicker = (ticker: string) => {
    setUniverseMode('custom');
    setCustomTickers((prev) => prev.filter((t) => t !== ticker));
  };

  // Switch to custom preset seeded from activeTickers
  const switchToCustomFromCurrent = () => {
    setCustomTickers(activeTickers);
    setUniverseMode('custom');
  };

  // Pair details for scatter chart
  const activePairData = useMemo(() => {
    if (!data || !selectedPair) return null;
    const [a, b] = selectedPair;
    if (a === b) return null;
    const directKey = `${a}::${b}`;
    const reverseKey = `${b}::${a}`;
    const idxA = data.tickers.indexOf(a);
    const idxB = data.tickers.indexOf(b);
    if (idxA === -1 || idxB === -1) return null;
    const corr = data.matrix[idxA]?.[idxB] ?? 0;

    if (data.pairSeries[directKey]) {
      return {
        tickerA: a,
        tickerB: b,
        correlation: corr,
        points: data.pairSeries[directKey],
      };
    }
    if (data.pairSeries[reverseKey]) {
      return {
        tickerA: a,
        tickerB: b,
        correlation: corr,
        points: data.pairSeries[reverseKey].map((p) => ({
          date: p.date,
          retA: p.retB,
          retB: p.retA,
        })),
      };
    }
    return null;
  }, [data, selectedPair]);

  // =========================================================================
  // D3 Visualization 1: Correlation Heatmap Matrix
  // =========================================================================
  useEffect(() => {
    const svgEl = heatmapSvgRef.current;
    if (!svgEl || !data || data.tickers.length < 2) return;

    const tickers = data.tickers;
    const n = tickers.length;
    const cellSize = n <= 6 ? 62 : n <= 9 ? 50 : 42;
    const margin = { top: 64, right: 20, bottom: 20, left: 72 };
    const gridSize = n * cellSize;
    const totalW = margin.left + gridSize + margin.right;
    const totalH = margin.top + gridSize + margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${totalW} ${totalH}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand<string>().domain(tickers).range([0, gridSize]).padding(0.06);
    const yScale = d3.scaleBand<string>().domain(tickers).range([0, gridSize]).padding(0.06);

    // Accessible high-contrast diverging scale: Cyan/Teal (-1) -> Deep Slate (0) -> Amber/Rose (+1)
    const colorScale = d3
      .scaleLinear<string>()
      .domain([-1, -0.4, 0, 0.45, 1])
      .range(['#0891b2', '#0f3a4a', '#0f172a', '#9a3412', '#e11d48'])
      .clamp(true);

    // Flatten matrix into cell objects
    interface CellItem {
      rowTicker: string;
      colTicker: string;
      rowIdx: number;
      colIdx: number;
      value: number;
      samples: number;
    }
    const cells: CellItem[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        cells.push({
          rowTicker: tickers[i],
          colTicker: tickers[j],
          rowIdx: i,
          colIdx: j,
          value: data.matrix[i][j],
          samples: data.sampleSizes[i]?.[j] || data.commonDatesCount,
        });
      }
    }

    // X axis labels (top)
    g.selectAll('.col-label')
      .data(tickers)
      .enter()
      .append('text')
      .attr('x', (d) => (xScale(d) || 0) + xScale.bandwidth() / 2)
      .attr('y', -12)
      .attr('text-anchor', 'middle')
      .attr('fill', (d) =>
        selectedPair && (selectedPair[0] === d || selectedPair[1] === d) ? '#34d399' : '#cbd5e1'
      )
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', n > 9 ? '10px' : '11px')
      .attr('font-weight', '700')
      .text((d) => d);

    // Y axis labels (left)
    g.selectAll('.row-label')
      .data(tickers)
      .enter()
      .append('text')
      .attr('x', -10)
      .attr('y', (d) => (yScale(d) || 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('fill', (d) =>
        selectedPair && (selectedPair[0] === d || selectedPair[1] === d) ? '#34d399' : '#cbd5e1'
      )
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', n > 9 ? '10px' : '11px')
      .attr('font-weight', '700')
      .text((d) => d);

    const cellGroups = g
      .selectAll<SVGGElement, CellItem>('.matrix-cell')
      .data(cells)
      .enter()
      .append('g')
      .attr('class', 'matrix-cell')
      .style('cursor', (d) => (d.rowTicker === d.colTicker ? 'default' : 'pointer'))
      .on('mouseenter', function (event, d) {
        d3.select(this)
          .select('rect')
          .attr('stroke', '#f8fafc')
          .attr('stroke-width', 1.8);
        setHoverInfo({
          tickerA: d.rowTicker,
          tickerB: d.colTicker,
          corr: d.value,
          samples: d.samples,
          x: event.clientX,
          y: event.clientY,
        });
      })
      .on('mousemove', function (event, d) {
        setHoverInfo({
          tickerA: d.rowTicker,
          tickerB: d.colTicker,
          corr: d.value,
          samples: d.samples,
          x: event.clientX,
          y: event.clientY,
        });
      })
      .on('mouseleave', function (_event, d) {
        const isSelected =
          selectedPair &&
          ((selectedPair[0] === d.rowTicker && selectedPair[1] === d.colTicker) ||
            (selectedPair[1] === d.rowTicker && selectedPair[0] === d.colTicker));
        d3.select(this)
          .select('rect')
          .attr('stroke', isSelected ? '#34d399' : '#1e293b')
          .attr('stroke-width', isSelected ? 2 : 1);
        setHoverInfo(null);
      })
      .on('click', (_event, d) => {
        if (d.rowTicker !== d.colTicker) {
          setSelectedPair([d.rowTicker, d.colTicker]);
        }
      });

    cellGroups
      .append('rect')
      .attr('x', (d) => xScale(d.colTicker) || 0)
      .attr('y', (d) => yScale(d.rowTicker) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('rx', 4)
      .attr('fill', (d) => (d.rowIdx === d.colIdx ? '#1e293b' : colorScale(d.value)))
      .attr('stroke', (d) => {
        const isSelected =
          selectedPair &&
          ((selectedPair[0] === d.rowTicker && selectedPair[1] === d.colTicker) ||
            (selectedPair[1] === d.rowTicker && selectedPair[0] === d.colTicker));
        return isSelected ? '#34d399' : '#1e293b';
      })
      .attr('stroke-width', (d) => {
        const isSelected =
          selectedPair &&
          ((selectedPair[0] === d.rowTicker && selectedPair[1] === d.colTicker) ||
            (selectedPair[1] === d.rowTicker && selectedPair[0] === d.colTicker));
        return isSelected ? 2 : 1;
      });

    cellGroups
      .append('text')
      .attr('x', (d) => (xScale(d.colTicker) || 0) + xScale.bandwidth() / 2)
      .attr('y', (d) => (yScale(d.rowTicker) || 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', n > 9 ? '9px' : '11px')
      .attr('font-weight', (d) => (d.rowIdx === d.colIdx ? '600' : '700'))
      .attr('fill', (d) => {
        if (d.rowIdx === d.colIdx) return '#64748b';
        if (Math.abs(d.value) >= 0.45) return '#f8fafc';
        return '#cbd5e1';
      })
      .text((d) => (d.rowIdx === d.colIdx ? '1.00' : d.value.toFixed(2)));
  }, [data, selectedPair]);

  // =========================================================================
  // D3 Visualization 2: Real Normalized Historical Market Movement (Base 100)
  // =========================================================================
  useEffect(() => {
    const svgEl = movementSvgRef.current;
    if (!svgEl || !data || data.normalizedSeries.length === 0 || data.commonDates.length < 5) {
      return;
    }

    const width = 640;
    const height = 270;
    const margin = { top: 18, right: 20, bottom: 32, left: 50 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const parseDate = d3.timeParse('%Y-%m-%d');
    const dates = data.commonDates
      .map((d) => parseDate(d))
      .filter((d): d is Date => d !== null);

    if (dates.length < 5) return;

    const allReturns: number[] = [0];
    data.normalizedSeries.forEach((s) => {
      s.values.forEach((v) => allReturns.push(v.returnPct));
    });
    if (showIbov && data.ibovSeries) {
      data.ibovSeries.forEach((v) => allReturns.push(v.returnPct));
    }

    const minRet = Math.min(...allReturns);
    const maxRet = Math.max(...allReturns);
    const pad = Math.max(2, (maxRet - minRet) * 0.1);

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(dates) as [Date, Date])
      .range([0, innerW]);

    const yScale = d3
      .scaleLinear()
      .domain([minRet - pad, maxRet + pad])
      .nice()
      .range([innerH, 0]);

    // Horizontal grid lines
    g.append('g')
      .attr('class', 'grid-y')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerW)
          .tickFormat(() => '')
      )
      .call((sel) => sel.select('.domain').remove())
      .call((sel) =>
        sel.selectAll('line').attr('stroke', '#1e293b').attr('stroke-dasharray', '3 3')
      );

    // Zero baseline (0% return)
    if (yScale.domain()[0] <= 0 && yScale.domain()[1] >= 0) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', yScale(0))
        .attr('y2', yScale(0))
        .attr('stroke', '#475569')
        .attr('stroke-width', 1);
    }

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(6)
      .tickFormat((d) => d3.timeFormat('%d/%m')(d as Date));

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .call((sel) => sel.select('.domain').attr('stroke', '#334155'))
      .call((sel) => sel.selectAll('line').attr('stroke', '#334155'))
      .call((sel) =>
        sel
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .attr('font-family', 'JetBrains Mono, monospace')
          .attr('font-size', '10px')
      );

    g.append('g')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickFormat((d) => `${Number(d) > 0 ? '+' : ''}${Number(d).toFixed(0)}%`)
      )
      .call((sel) => sel.select('.domain').attr('stroke', '#334155'))
      .call((sel) => sel.selectAll('line').attr('stroke', '#334155'))
      .call((sel) =>
        sel
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .attr('font-family', 'JetBrains Mono, monospace')
          .attr('font-size', '10px')
      );

    const lineGen = d3
      .line<NormalizedPoint>()
      .defined((d) => parseDate(d.date) !== null)
      .x((d) => xScale(parseDate(d.date)!))
      .y((d) => yScale(d.returnPct));

    // Draw IBOV benchmark if enabled
    if (showIbov && data.ibovSeries && data.ibovSeries.length === data.commonDates.length) {
      g.append('path')
        .datum(data.ibovSeries)
        .attr('fill', 'none')
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 1.4)
        .attr('stroke-dasharray', '4 3')
        .attr('opacity', 0.75)
        .attr('d', lineGen);
    }

    // Draw each asset real historical movement line
    data.normalizedSeries.forEach((serie, idx) => {
      const color = LINE_PALETTE[idx % LINE_PALETTE.length];
      const isPairFocused =
        !selectedPair ||
        selectedPair[0] === serie.ticker ||
        selectedPair[1] === serie.ticker;

      g.append('path')
        .datum(serie.values)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', isPairFocused ? 2.2 : 1.1)
        .attr('opacity', isPairFocused ? 0.95 : 0.25)
        .attr('d', lineGen);
    });

    // Crosshair interactive inspection line
    const hoverLine = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2 2')
      .style('opacity', 0);

    const bisectDate = d3.bisector<Date, Date>((d) => d).left;

    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', function (event) {
        const [mx] = d3.pointer(event);
        const x0 = xScale.invert(mx);
        const idx = Math.min(
          dates.length - 1,
          Math.max(0, bisectDate(dates, x0))
        );
        const dateIso = data.commonDates[idx];
        hoverLine.attr('x1', xScale(dates[idx])).attr('x2', xScale(dates[idx])).style('opacity', 0.8);

        const items = data.normalizedSeries.map((serie, sIdx) => {
          const pt = serie.values[idx];
          return {
            ticker: serie.ticker,
            returnPct: pt?.returnPct ?? 0,
            close: pt?.close ?? 0,
            color: LINE_PALETTE[sIdx % LINE_PALETTE.length],
          };
        });
        const ibovPt = showIbov && data.ibovSeries ? data.ibovSeries[idx] : undefined;
        setMovementTooltip({
          date: dateIso,
          items,
          ibovReturnPct: ibovPt?.returnPct,
        });
      })
      .on('mouseleave', function () {
        hoverLine.style('opacity', 0);
        setMovementTooltip(null);
      });
  }, [data, selectedPair, showIbov]);

  // =========================================================================
  // D3 Visualization 3: Pair Co-Movement Daily Return Scatter + Regression
  // =========================================================================
  useEffect(() => {
    const svgEl = scatterSvgRef.current;
    if (!svgEl || !activePairData || activePairData.points.length < 5) return;

    const pts = activePairData.points;
    const width = 460;
    const height = 270;
    const margin = { top: 20, right: 20, bottom: 38, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const maxAbsX = Math.max(2, d3.max(pts, (d) => Math.abs(d.retA)) || 4) * 1.1;
    const maxAbsY = Math.max(2, d3.max(pts, (d) => Math.abs(d.retB)) || 4) * 1.1;

    const xScale = d3.scaleLinear().domain([-maxAbsX, maxAbsX]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([-maxAbsY, maxAbsY]).range([innerH, 0]);

    // Quadrant crosshairs (0%, 0%)
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#334155')
      .attr('stroke-dasharray', '3 3');

    g.append('line')
      .attr('x1', xScale(0))
      .attr('x2', xScale(0))
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#334155')
      .attr('stroke-dasharray', '3 3');

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickFormat((d) => `${Number(d).toFixed(1)}%`)
      )
      .call((sel) => sel.select('.domain').attr('stroke', '#334155'))
      .call((sel) =>
        sel
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .attr('font-family', 'JetBrains Mono, monospace')
          .attr('font-size', '9px')
      );

    g.append('g')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickFormat((d) => `${Number(d).toFixed(1)}%`)
      )
      .call((sel) => sel.select('.domain').attr('stroke', '#334155'))
      .call((sel) =>
        sel
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .attr('font-family', 'JetBrains Mono, monospace')
          .attr('font-size', '9px')
      );

    // Axis captions
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 30)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '10px')
      .text(`Retorno Diário ${activePairData.tickerA} (%)`);

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2)
      .attr('y', -36)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '10px')
      .text(`${activePairData.tickerB} (%)`);

    // OLS Regression line
    const n = pts.length;
    const meanX = pts.reduce((s, p) => s + p.retA, 0) / n;
    const meanY = pts.reduce((s, p) => s + p.retB, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of pts) {
      num += (p.retA - meanX) * (p.retB - meanY);
      den += (p.retA - meanX) ** 2;
    }
    const slope = den > 1e-9 ? num / den : 0;
    const intercept = meanY - slope * meanX;

    const x1 = -maxAbsX * 0.85;
    const x2 = maxAbsX * 0.85;
    const y1 = Math.max(-maxAbsY, Math.min(maxAbsY, slope * x1 + intercept));
    const y2 = Math.max(-maxAbsY, Math.min(maxAbsY, slope * x2 + intercept));

    g.append('line')
      .attr('x1', xScale(x1))
      .attr('y1', yScale(y1))
      .attr('x2', xScale(x2))
      .attr('y2', yScale(y2))
      .attr('stroke', activePairData.correlation >= 0 ? '#f43f5e' : '#06b6d4')
      .attr('stroke-width', 1.8)
      .attr('stroke-dasharray', '5 3');

    // Scatter points
    g.selectAll('.scatter-dot')
      .data(pts)
      .enter()
      .append('circle')
      .attr('cx', (d) => xScale(d.retA))
      .attr('cy', (d) => yScale(d.retB))
      .attr('r', 3)
      .attr('fill', (d) =>
        (d.retA >= 0 && d.retB >= 0) || (d.retA < 0 && d.retB < 0) ? '#10b981' : '#38bdf8'
      )
      .attr('opacity', 0.72)
      .append('title')
      .text((d) => `${d.date}: ${activePairData.tickerA} ${d.retA.toFixed(2)}% | ${activePairData.tickerB} ${d.retB.toFixed(2)}%`);
  }, [activePairData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono uppercase tracking-wider mb-1">
            <GitCompareArrows className="w-3.5 h-3.5" />
            <span>Econometria de Carteira D3</span>
            <span aria-hidden="true">·</span>
            <span>Séries Históricas Reais B3</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Matriz de Correlação & Movimento Real de Mercado
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Avalie como os ativos da sua carteira se movem juntos nos pregões reais da B3 (Pearson sobre retornos diários), identifique pares de hedge e compare curvas normalizadas frente ao Ibovespa.
          </p>
        </div>

        {/* Universe & Range Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
            {(
              [
                { id: 'portfolio', label: 'Minha Carteira' },
                { id: 'top10', label: 'Top 10 Alpha' },
                { id: 'filtered', label: 'Filtro Atual' },
                { id: 'custom', label: 'Seleção Livre' },
              ] as { id: UniverseMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (opt.id === 'custom' && universeMode !== 'custom') {
                    switchToCustomFromCurrent();
                  } else {
                    setUniverseMode(opt.id);
                  }
                }}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  universeMode === opt.id
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
            {(
              [
                { id: '1mo', label: '1M' },
                { id: '3mo', label: '3M' },
                { id: '6mo', label: '6M' },
                { id: '1y', label: '1A' },
              ] as { id: HistoryRange; label: string }[]
            ).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  range === r.id
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchCorrelation(activeTickers, range)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Custom Ticker Bar */}
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-1.5 text-xs">
          <span className="text-slate-400 font-medium mr-1">
            Ativos analisados ({activeTickers.length}):
          </span>
          {activeTickers.map((t, idx) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-slate-200 text-xs"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: LINE_PALETTE[idx % LINE_PALETTE.length] }}
              />
              <span>{t}</span>
              {universeMode === 'custom' && activeTickers.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveCustomTicker(t)}
                  className="text-slate-500 hover:text-rose-400 cursor-pointer"
                  title={`Remover ${t}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>

        <form onSubmit={handleAddCustomTicker} className="flex items-center gap-1.5 shrink-0">
          <input
            type="text"
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
            placeholder="Adicionar ticker (ex: WEGE3)"
            maxLength={10}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 w-44"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Incluir</span>
          </button>
        </form>
      </div>

      {/* Loading / Error State */}
      {isLoading && !data ? (
        <div className="p-12 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm font-semibold text-slate-200">
            Consultando séries históricas reais na internet ({activeTickers.length} ativos B3)...
          </p>
          <p className="text-xs text-slate-400">
            Alinhando datas de pregão no Yahoo Finance & Brapi e calculando matriz de correlação em D3.
          </p>
        </div>
      ) : errorMsg ? (
        <div className="p-6 rounded-xl bg-slate-900 border border-rose-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <div className="text-sm font-semibold text-rose-300">
              Não foi possível montar a matriz de correlação
            </div>
            <p className="text-xs text-slate-300">{errorMsg}</p>
            <button
              type="button"
              onClick={() => fetchCorrelation(activeTickers, range)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg border border-slate-700 cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ) : data ? (
        <>
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                Correlação Média dos Pares
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                {data.summary.averageCorrelation.toFixed(2)}
              </div>
              <div className={`text-xs mt-1 font-medium ${interpretCorrelation(data.summary.averageCorrelation).colorClass}`}>
                {interpretCorrelation(data.summary.averageCorrelation).label}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                Melhor Par de Diversificação
              </div>
              {data.summary.lowestPair ? (
                <>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                    {data.summary.lowestPair.tickerA} × {data.summary.lowestPair.tickerB}
                  </div>
                  <div className="text-xs text-slate-300 font-mono mt-1">
                    r = {data.summary.lowestPair.correlation.toFixed(2)} · Menor acoplamento
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500 mt-2">N/D</div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                Maior Concentração de Risco
              </div>
              {data.summary.highestPair ? (
                <>
                  <div className="text-2xl font-bold font-mono tabular-nums text-rose-400 mt-1">
                    {data.summary.highestPair.tickerA} × {data.summary.highestPair.tickerB}
                  </div>
                  <div className="text-xs text-slate-300 font-mono mt-1">
                    r = {data.summary.highestPair.correlation.toFixed(2)} · Movem-se juntos
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500 mt-2">N/D</div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                Janela Histórica Real
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-cyan-300 mt-1">
                {data.commonDatesCount} pregões
              </div>
              <div className="text-xs text-slate-400 mt-1 truncate">
                Fontes: {data.sourcesUsed.join(' · ')}
              </div>
            </div>
          </div>

          {data.failedTickers.length > 0 && (
            <div className="text-xs text-amber-300 bg-slate-900 border border-amber-500/30 rounded-lg px-3.5 py-2 font-mono">
              Tickers sem série histórica suficiente ignorados: {data.failedTickers.join(', ')}
            </div>
          )}

          {/* Main 2-Column D3 Workbench */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left: D3 Correlation Heatmap */}
            <div className="xl:col-span-6 p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Matriz D3 de Correlação (Retornos Diários)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Clique em qualquer célula para inspecionar a dispersão e o movimento real do par.
                  </p>
                </div>
                {isLoading && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />}
              </div>

              <div className="overflow-x-auto bg-slate-950 rounded-xl border border-slate-800/80 p-3 flex justify-center">
                <svg
                  ref={heatmapSvgRef}
                  className="w-full max-w-[560px] h-auto select-none"
                />
              </div>

              {/* Scale Legend */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-semibold">-1.00 Hedge</span>
                  <div
                    className="w-36 h-2.5 rounded"
                    style={{
                      background:
                        'linear-gradient(90deg, #0891b2 0%, #0f3a4a 30%, #0f172a 50%, #9a3412 75%, #e11d48 100%)',
                    }}
                  />
                  <span className="text-rose-400 font-semibold">+1.00 Idêntico</span>
                </div>
                <span>0.00 = Independente</span>
              </div>
            </div>

            {/* Right: Real Market Movement Chart (D3) + Pair Scatter (D3) */}
            <div className="xl:col-span-6 space-y-6">
              {/* Real Historical Market Movement Base-100 */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>Movimento Real de Mercado (Retorno Acumulado %)</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedPair
                        ? `Destaque no par ${selectedPair[0]} × ${selectedPair[1]} sobre ${data.commonDatesCount} pregões reais.`
                        : 'Trajetória percentual real dos ativos no período selecionado.'}
                    </p>
                  </div>

                  {data.ibovSeries && (
                    <button
                      type="button"
                      onClick={() => setShowIbov((v) => !v)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors cursor-pointer self-start ${
                        showIbov
                          ? 'bg-slate-800 text-slate-200 border-slate-600'
                          : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      {showIbov ? '✓ Ibovespa (^BVSP)' : '+ Ibovespa (^BVSP)'}
                    </button>
                  )}
                </div>

                {/* Live Inspection Line on Hover */}
                <div className="min-h-[26px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono">
                  {movementTooltip ? (
                    <>
                      <span className="text-slate-400 font-semibold">{movementTooltip.date}</span>
                      {movementTooltip.items
                        .filter(
                          (it) =>
                            !selectedPair ||
                            selectedPair.includes(it.ticker) ||
                            movementTooltip.items.length <= 5
                        )
                        .map((it) => (
                          <span key={it.ticker} className="inline-flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: it.color }}
                            />
                            <span className="text-slate-200">{it.ticker}:</span>
                            <span className={it.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {it.returnPct >= 0 ? '+' : ''}
                              {it.returnPct.toFixed(1)}%
                            </span>
                            <span className="text-slate-500">(R$ {it.close.toFixed(2)})</span>
                          </span>
                        ))}
                      {typeof movementTooltip.ibovReturnPct === 'number' && (
                        <span className="text-slate-400">
                          IBOV: {movementTooltip.ibovReturnPct >= 0 ? '+' : ''}
                          {movementTooltip.ibovReturnPct.toFixed(1)}%
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-500">
                      Passe o mouse sobre o gráfico para inspecionar cotações reais e retornos diários de cada pregão.
                    </span>
                  )}
                </div>

                <div className="bg-slate-950 rounded-xl border border-slate-800/80 p-2">
                  <svg ref={movementSvgRef} className="w-full h-auto" />
                </div>
              </div>

              {/* Pair Return Scatter & Linear Regression */}
              {activePairData && (
                <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        <span>
                          Dispersão Diária: {activePairData.tickerA} × {activePairData.tickerB}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">
                        r = {activePairData.correlation.toFixed(2)} · R² ={' '}
                        {(activePairData.correlation ** 2 * 100).toFixed(1)}% ·{' '}
                        {activePairData.points.length} pregões
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold font-mono ${
                        interpretCorrelation(activePairData.correlation).colorClass
                      }`}
                    >
                      {interpretCorrelation(activePairData.correlation).label}
                    </span>
                  </div>

                  <div className="bg-slate-950 rounded-xl border border-slate-800/80 p-2">
                    <svg ref={scatterSvgRef} className="w-full h-auto" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Risk, Volatility & Beta Breakdown Table */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-bold text-white">
                Volatilidade, Retorno Real & Beta vs Ibovespa ({range.toUpperCase()})
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                Atualizado: {new Date(data.updatedAt).toLocaleString('pt-BR')}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                    <th className="py-2.5 pr-4">Ativo</th>
                    <th className="py-2.5 px-3 text-right">Último Fechamento</th>
                    <th className="py-2.5 px-3 text-right">Retorno Período</th>
                    <th className="py-2.5 px-3 text-right">Volatilidade Anual</th>
                    <th className="py-2.5 px-3 text-right">Beta (IBOV)</th>
                    <th className="py-2.5 px-3 text-right">Max Drawdown</th>
                    <th className="py-2.5 pl-3 text-right">Fonte / Pregões</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.assets.map((asset, idx) => (
                    <tr key={asset.ticker} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 pr-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: LINE_PALETTE[idx % LINE_PALETTE.length] }}
                          />
                          <span>{asset.ticker}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        R$ {asset.lastClose.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-semibold ${
                          asset.periodReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {asset.periodReturnPct >= 0 ? '+' : ''}
                        {asset.periodReturnPct.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-300">
                        {asset.annualizedVolPct.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-cyan-300">
                        {asset.betaIbov !== null ? asset.betaIbov.toFixed(2) : 'N/D'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-400">
                        {asset.maxDrawdownPct.toFixed(2)}%
                      </td>
                      <td className="py-2.5 pl-3 text-right text-slate-400">
                        {asset.source} · {asset.observations}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Floating Tooltip for Heatmap Cells */}
          {hoverInfo && (
            <div
              className="fixed z-50 pointer-events-none px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 shadow-xl text-xs font-mono space-y-0.5"
              style={{
                left: Math.min(window.innerWidth - 220, hoverInfo.x + 14),
                top: Math.max(12, hoverInfo.y - 54),
              }}
            >
              <div className="font-bold text-white">
                {hoverInfo.tickerA} × {hoverInfo.tickerB}
              </div>
              <div className="text-emerald-400">
                Correlação: <strong>{hoverInfo.corr.toFixed(2)}</strong>
              </div>
              <div className="text-slate-400 text-[11px]">
                {interpretCorrelation(hoverInfo.corr).label} · {hoverInfo.samples} pregões
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
