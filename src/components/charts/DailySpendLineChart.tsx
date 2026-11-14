import React, { useId, useState } from 'react';
import { motion } from 'motion/react';
import { Tag } from 'lucide-react';
import { LineSeriesPoint } from '../../lib/analytics';
import { formatCurrency } from '../../lib/currency';
import { CurrencyCode } from '../../types/expense';

interface DailySpendLineChartProps {
  title: string;
  subtitle: string;
  points: LineSeriesPoint[];
  baseCurrency: CurrencyCode;
  budgetLimit?: number;
  defaultSeries?: 'daily' | 'cumulative';
}

export function DailySpendLineChart({
  title,
  subtitle,
  points,
  baseCurrency,
  budgetLimit = 0,
  defaultSeries = 'cumulative',
}: DailySpendLineChartProps) {
  const gradientId = useId();
  const [seriesMode, setSeriesMode] = useState<'daily' | 'cumulative'>(defaultSeries);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [showLabels, setShowLabels] = useState(true);

  const values = points.map((p) => (seriesMode === 'cumulative' ? p.cumulative : p.total));
  const rawMax = Math.max(0, ...values);
  const effectiveCap = seriesMode === 'cumulative' && budgetLimit > 0 ? budgetLimit : 0;
  const maxVal = Math.max(100, rawMax * 1.18, effectiveCap * 1.1);

  const totalSpent = points.length > 0 ? points[points.length - 1].cumulative : 0;
  const peakDaily = Math.max(0, ...points.map((p) => p.total));
  const activeIdx = hoveredIdx !== null ? hoveredIdx : points.length - 1;
  const activePoint = points[activeIdx] || null;

  const svgWidth = 760;
  const svgHeight = 220;
  const padLeft = 58;
  const padRight = 24;
  const padTop = 26;
  const padBottom = 30;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const coords = points.map((pt, idx) => {
    const val = seriesMode === 'cumulative' ? pt.cumulative : pt.total;
    const x =
      points.length <= 1 ? padLeft + plotW / 2 : padLeft + (idx / (points.length - 1)) * plotW;
    const y = padTop + plotH - (val / maxVal) * plotH;
    return { ...pt, val, x, y, idx };
  });

  const linePath =
    coords.length > 0
      ? coords
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ')
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

  const capY = effectiveCap > 0 ? padTop + plotH - (effectiveCap / maxVal) * plotH : null;

  // Pick sparse non-overlapping indices for direct labels when dense (> 10 points)
  const labelIndices = new Set<number>();
  if (coords.length > 0) {
    if (coords.length <= 10) {
      coords.forEach((_, i) => labelIndices.add(i));
    } else {
      let maxIdx = 0;
      coords.forEach((c, i) => {
        if (c.val > coords[maxIdx].val) maxIdx = i;
      });
      const step = Math.ceil(coords.length / 5);
      for (let i = 0; i < coords.length; i += step) {
        labelIndices.add(i);
      }
      labelIndices.add(maxIdx);
      labelIndices.add(coords.length - 1);
    }
  }

  // Pick clean X-axis tick labels
  const xTickStep = coords.length <= 8 ? 1 : Math.ceil(coords.length / 7);

  const strokeColor = seriesMode === 'cumulative' ? '#0D9488' : '#2563EB';

  return (
    <div className="rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLabels((v) => !v)}
            aria-pressed={showLabels}
            className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              showLabels
                ? 'border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Labels
          </button>

          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setSeriesMode('cumulative')}
              aria-pressed={seriesMode === 'cumulative'}
              className={`min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                seriesMode === 'cumulative'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Cumulative
            </button>
            <button
              type="button"
              onClick={() => setSeriesMode('daily')}
              aria-pressed={seriesMode === 'daily'}
              className={`min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                seriesMode === 'daily'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Daily / Period
            </button>
          </div>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          No matching expenses to plot yet.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-2 border-b border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400">
              <span>
                Period Total{' '}
                <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(totalSpent, baseCurrency)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Peak Point{' '}
                <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(peakDaily, baseCurrency)}
                </strong>
              </span>
            </div>

            {activePoint && (
              <div className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                <span className="font-sans text-slate-500 dark:text-slate-400 mr-1.5">
                  {activePoint.label}:
                </span>
                <span className="font-semibold">
                  {formatCurrency(
                    seriesMode === 'cumulative' ? activePoint.cumulative : activePoint.total,
                    baseCurrency,
                  )}
                </span>
              </div>
            )}
          </div>

          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-56 overflow-visible select-none"
            role="img"
            aria-label={title}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.22" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
              </linearGradient>
            </defs>

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

            {capY !== null && (
              <g>
                <line
                  x1={padLeft}
                  y1={capY}
                  x2={svgWidth - padRight}
                  y2={capY}
                  stroke="#D97706"
                  strokeWidth="1.25"
                  strokeDasharray="5 4"
                />
                <text
                  x={svgWidth - padRight}
                  y={Math.max(12, capY - 6)}
                  textAnchor="end"
                  className="fill-amber-600 dark:fill-amber-400 text-[10px] font-mono font-medium tabular-nums"
                >
                  Budget Cap {formatCurrency(effectiveCap, baseCurrency, true)}
                </text>
              </g>
            )}

            {areaPath && (
              <motion.path
                d={areaPath}
                fill={`url(#${gradientId})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              />
            )}

            {linePath && (
              <motion.path
                d={linePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              />
            )}

            {coords.map((pt) => {
              const isHovered = hoveredIdx === pt.idx;
              const isLabeled = showLabels && (isHovered || labelIndices.has(pt.idx));
              const showXTick = pt.idx % xTickStep === 0 || pt.idx === coords.length - 1;
              const hitW = Math.max(16, plotW / Math.max(1, coords.length));

              return (
                <g
                  key={pt.key}
                  onMouseEnter={() => setHoveredIdx(pt.idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={pt.x - hitW / 2}
                    y={padTop - 8}
                    width={hitW}
                    height={plotH + 34}
                    fill="transparent"
                  />

                  {isHovered && (
                    <line
                      x1={pt.x}
                      y1={padTop}
                      x2={pt.x}
                      y2={padTop + plotH}
                      stroke="currentColor"
                      strokeDasharray="2 3"
                      className="text-slate-400/60"
                    />
                  )}

                  {(isHovered || pt.val > 0 || coords.length <= 12) && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 5 : pt.val > 0 ? 3.2 : 2.2}
                      fill={strokeColor}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                      className="dark:stroke-slate-900"
                    />
                  )}

                  {isLabeled && (
                    <text
                      x={pt.x}
                      y={Math.max(12, pt.y - 10)}
                      textAnchor={
                        pt.idx === 0
                          ? 'start'
                          : pt.idx === coords.length - 1
                            ? 'end'
                            : 'middle'
                      }
                      className="fill-slate-700 dark:fill-slate-200 text-[10px] font-mono tabular-nums font-medium"
                    >
                      {formatCurrency(pt.val, baseCurrency, true)}
                    </text>
                  )}

                  {showXTick && (
                    <text
                      x={pt.x}
                      y={svgHeight - 8}
                      textAnchor="middle"
                      className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono tabular-nums"
                    >
                      {pt.shortLabel}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </>
      )}
    </div>
  );
}
