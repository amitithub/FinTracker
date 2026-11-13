import React, { useState } from 'react';
import { motion } from 'motion/react';
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
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const maxVal = Math.max(
    100,
    budgetLimit > 0 ? budgetLimit * 1.1 : 0,
    ...data.map((d) => d.total * 1.15),
  );

  const activePoint =
    data.find((d) => d.monthKey === (hoveredKey || activeMonthKey)) || data[data.length - 1];

  const budgetRatio = budgetLimit > 0 ? Math.min(1, budgetLimit / maxVal) : null;

  return (
    <div className="flex flex-col justify-between h-full rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            6-Month Spending Trend
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Click any month bar to inspect that month&apos;s report
          </p>
        </div>
        {activePoint && (
          <div className="text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {activePoint.label} · {activePoint.count}{' '}
              {activePoint.count === 1 ? 'entry' : 'entries'}
            </div>
            <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatCurrency(activePoint.total, baseCurrency)}
            </div>
          </div>
        )}
      </div>

      <div className="relative h-56 flex items-end gap-2 sm:gap-4 pt-6 pb-2">
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
              className="group flex-1 h-full flex flex-col items-center justify-end gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg min-w-[44px]"
            >
              <div className="w-full flex-1 flex items-end justify-center px-1 sm:px-2">
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
    </div>
  );
}
