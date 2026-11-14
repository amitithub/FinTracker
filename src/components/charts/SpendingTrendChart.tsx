import React, { useId, useState } from 'react';
import { motion } from 'motion/react';
import { BarChart2, Tag, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { CurrencyCode, MonthlyTrendPoint } from '../../types/expense';

interface SpendingTrendChartProps {
  data: MonthlyTrendPoint[];
  baseCurrency: CurrencyCode;
  activeMonthKey: string;
  budgetLimit: number;
  onSelectMonth: (monthKey: string) => void;
}

export function SpendingTrendChart({
  data,
  baseCurrency,
  activeMonthKey,
  budgetLimit,
  onSelectMonth,
}: SpendingTrendChartProps) {
  const gradientId = useId();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'line' | 'bar'>('line');
  const [showLabels, setShowLabels] = useState(true);

  const maxDataVal = Math.max(0, ...data.map((d) => d.total));
  const maxVal = Math.max(100, budgetLimit > 0 ? budgetLimit * 1.15 : 0, maxDataVal * 1.22);

  const activePoint =
    data.find((d) => d.monthKey === (hoveredKey || activeMonthKey)) || data[data.length - 1];

  const budgetRatio = budgetLimit > 0 ? Math.min(1, budgetLimit / maxVal) : null;

  // SVG coordinate system for crisp responsive line chart
  const svgWidth = 620;
  const svgHeight = 220;
  const padLeft = 56;
  const padRight = 24;
  const padTop = 26;
  const padBottom = 30;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const coords = data.map((point, idx) => {
    const x =
      data.length <= 1 ? padLeft + plotW / 2 : padLeft + (idx / (data.length - 1)) * plotW;
    const y = padTop + plotH - (point.total / maxVal) * plotH;
    return { ...point, x, y };
  });

  const linePath =
    coords.length > 0
      ? coords.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : '';

  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const yTicks = [0, 0.5, 1].map((ratio) => ({
    ratio,
    value: Math.round(maxVal * ratio),
    y: padTop + plotH - ratio * plotH,
  }));

  const budgetLineY =
    budgetRatio !== null ? padTop + plotH - budgetRatio * plotH : null;

  return (
    <div className="flex flex-col justify-between h-full rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            6-Month Spending Trend
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Click any month to inspect its ledger ·{' '}
            {chartMode === 'line' ? 'Line trajectory' : 'Monthly bars'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLabels((v) => !v)}
            aria-pressed={showLabels}
            className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              showLabels
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Labels
          </button>

          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setChartMode('line')}
              aria-pressed={chartMode === 'line'}
              className={`min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                chartMode === 'line'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Line
            </button>
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              aria-pressed={chartMode === 'bar'}
              className={`min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                chartMode === 'bar'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Bar
            </button>
          </div>
        </div>
      </div>

      {activePoint && (
        <div className="flex items-baseline justify-between gap-4 pb-3 mb-2 border-b border-slate-100 dark:border-slate-800/80">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {activePoint.label}
            </span>
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            <span className="font-mono tabular-nums">
              {activePoint.count} {activePoint.count === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatCurrency(activePoint.total, baseCurrency)}
          </div>
        </div>
      )}

      {chartMode === 'line' ? (
        <div className="w-full pt-1">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-56 overflow-visible select-none"
            role="img"
            aria-label="6-month spending line chart"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Horizontal Y-axis gridlines & labels */}
            {yTicks.map((tick) => (
              <g key={tick.ratio}>
                <line
                  x1={padLeft}
                  y1={tick.y}
                  x2={svgWidth - padRight}
                  y2={tick.y}
                  stroke="currentColor"
                  strokeDasharray={tick.ratio === 0 ? undefined : '3 4'}
                  className="text-slate-200 dark:text-slate-800"
                />
                <text
                  x={padLeft - 8}
                  y={tick.y + 3.5}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono tabular-nums"
                >
                  {formatCurrency(tick.value, baseCurrency, true)}
                </text>
              </g>
            ))}

            {/* Budget Cap reference line */}
            {budgetLineY !== null && (
              <g>
                <line
                  x1={padLeft}
                  y1={budgetLineY}
                  x2={svgWidth - padRight}
                  y2={budgetLineY}
                  stroke="#D97706"
                  strokeWidth="1.25"
                  strokeDasharray="5 4"
                />
                <text
                  x={svgWidth - padRight}
                  y={Math.max(12, budgetLineY - 6)}
                  textAnchor="end"
                  className="fill-amber-600 dark:fill-amber-400 text-[10px] font-mono font-medium tabular-nums"
                >
                  Cap {formatCurrency(budgetLimit, baseCurrency, true)}
                </text>
              </g>
            )}

            {/* Area fill */}
            {areaPath && (
              <motion.path
                d={areaPath}
                fill={`url(#${gradientId})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.45 }}
              />
            )}

            {/* Main Line Path */}
            {linePath && (
              <motion.path
                d={linePath}
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0.4 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              />
            )}

            {/* Interactive Nodes & Direct Data Labels */}
            {coords.map((pt) => {
              const isSelected = pt.monthKey === activeMonthKey;
              const isHovered = pt.monthKey === hoveredKey;
              const overBudget = budgetLimit > 0 && pt.total > budgetLimit;
              const nodeColor = overBudget ? '#E11D48' : isSelected ? '#1D4ED8' : '#2563EB';

              return (
                <g
                  key={pt.monthKey}
                  className="cursor-pointer"
                  onClick={() => onSelectMonth(pt.monthKey)}
                  onMouseEnter={() => setHoveredKey(pt.monthKey)}
                  onMouseLeave={() => setHoveredKey(null)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${pt.label}: ${formatCurrency(pt.total, baseCurrency)}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectMonth(pt.monthKey);
                    }
                  }}
                >
                  {/* Vertical hover/selected hairline */}
                  {(isSelected || isHovered) && (
                    <line
                      x1={pt.x}
                      y1={padTop}
                      x2={pt.x}
                      y2={padTop + plotH}
                      stroke="currentColor"
                      strokeDasharray="2 3"
                      className="text-blue-400/50 dark:text-blue-400/40"
                    />
                  )}

                  {/* Hit area */}
                  <rect
                    x={pt.x - 24}
                    y={padTop - 8}
                    width={48}
                    height={plotH + 34}
                    fill="transparent"
                  />

                  {/* Outer highlight halo */}
                  {(isSelected || isHovered) && (
                    <circle cx={pt.x} cy={pt.y} r={9} fill={nodeColor} fillOpacity={0.16} />
                  )}

                  {/* Point dot */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected || isHovered ? 5.5 : 4}
                    fill={nodeColor}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    className="dark:stroke-slate-900"
                  />

                  {/* Direct Value Label */}
                  {showLabels && (
                    <text
                      x={pt.x}
                      y={Math.max(12, pt.y - 11)}
                      textAnchor="middle"
                      className={`text-[10.5px] font-mono tabular-nums font-medium ${
                        overBudget
                          ? 'fill-rose-600 dark:fill-rose-400 font-semibold'
                          : isSelected || isHovered
                            ? 'fill-blue-700 dark:fill-blue-300 font-semibold'
                            : 'fill-slate-600 dark:fill-slate-300'
                      }`}
                    >
                      {formatCurrency(pt.total, baseCurrency, true)}
                    </text>
                  )}

                  {/* X-axis Month Label */}
                  <text
                    x={pt.x}
                    y={svgHeight - 8}
                    textAnchor="middle"
                    className={`text-[11px] font-medium ${
                      isSelected
                        ? 'fill-blue-600 dark:fill-blue-400 font-semibold'
                        : 'fill-slate-500 dark:fill-slate-400'
                    }`}
                  >
                    {pt.label.split(' ')[0]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="relative h-56 flex items-end gap-2 sm:gap-4 pt-8 pb-2">
          {budgetRatio !== null && (
            <div
              className="absolute left-0 right-0 border-t border-dashed border-amber-500/70 dark:border-amber-400/60 pointer-events-none flex justify-end"
              style={{ bottom: `${budgetRatio * 100}%` }}
            >
              <span className="text-[11px] font-mono tabular-nums text-amber-700 dark:text-amber-300 bg-white dark:bg-slate-900 px-1.5 -translate-y-2.5">
                Cap {formatCurrency(budgetLimit, baseCurrency, true)}
              </span>
            </div>
          )}

          {data.map((point, idx) => {
            const heightPct = Math.max(4, (point.total / maxVal) * 100);
            const isSelected = point.monthKey === activeMonthKey;
            const isHovered = point.monthKey === hoveredKey;
            const overBudget = budgetLimit > 0 && point.total > budgetLimit;

            return (
              <button
                key={point.monthKey}
                type="button"
                onClick={() => onSelectMonth(point.monthKey)}
                onMouseEnter={() => setHoveredKey(point.monthKey)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(point.monthKey)}
                onBlur={() => setHoveredKey(null)}
                aria-label={`${point.label}: ${formatCurrency(point.total, baseCurrency)}`}
                className="group flex-1 h-full flex flex-col items-center justify-end gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg min-w-[44px]"
              >
                <div className="w-full flex-1 flex flex-col items-center justify-end px-1 sm:px-2">
                  {showLabels && (
                    <span
                      className={`mb-1 text-[10px] font-mono tabular-nums whitespace-nowrap ${
                        overBudget
                          ? 'text-rose-600 dark:text-rose-400 font-semibold'
                          : isSelected || isHovered
                            ? 'text-blue-700 dark:text-blue-300 font-semibold'
                            : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {formatCurrency(point.total, baseCurrency, true)}
                    </span>
                  )}
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0.4 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{
                      duration: 0.45,
                      delay: idx * 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{ height: `${heightPct}%`, transformOrigin: 'bottom' }}
                    className={`w-full max-w-[44px] rounded-t-lg transition-colors duration-150 ${
                      overBudget
                        ? isSelected || isHovered
                          ? 'bg-rose-600 dark:bg-rose-500'
                          : 'bg-rose-500/80 dark:bg-rose-500/70'
                        : isSelected
                          ? 'bg-blue-600 dark:bg-blue-500'
                          : isHovered
                            ? 'bg-blue-500/85 dark:bg-blue-400/85'
                            : 'bg-slate-200 dark:bg-slate-700/80 group-hover:bg-blue-500/70'
                    }`}
                  />
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isSelected
                      ? 'text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {point.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
