import React, { useState } from 'react';
import { motion } from 'motion/react';
import { formatCurrency } from '../../lib/currency';
import { CategoryBreakdownItem, CurrencyCode, ExpenseCategory } from '../../types/expense';

interface CategoryDonutChartProps {
  items: CategoryBreakdownItem[];
  totalSpent: number;
  baseCurrency: CurrencyCode;
  title?: string;
  subtitle?: string;
  selectedCategory?: ExpenseCategory | 'All';
  onSelectCategory?: (category: ExpenseCategory) => void;
}

export function CategoryDonutChart({
  items,
  totalSpent,
  baseCurrency,
  title = 'Category Breakdown',
  subtitle = 'Hover or click a category to inspect and filter',
  selectedCategory = 'All',
  onSelectCategory,
}: CategoryDonutChartProps) {
  const [hoveredCategory, setHoveredCategory] = useState<ExpenseCategory | null>(null);

  const activeCategory =
    hoveredCategory || (selectedCategory !== 'All' ? selectedCategory : null);

  const size = 192;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;
  const segments = items.slice(0, 7).map((item) => {
    const startPercent = cumulativePercent;
    const slicePercent = totalSpent > 0 ? (item.total / totalSpent) * 100 : 0;
    cumulativePercent += slicePercent;
    return {
      ...item,
      startPercent,
      slicePercent,
    };
  });

  const highlighted = segments.find((s) => s.category === activeCategory);

  return (
    <div className="flex flex-col justify-between h-full rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      </div>

      {items.length === 0 || totalSpent <= 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
          <div className="w-28 h-28 rounded-full border-[14px] border-slate-100 dark:border-slate-800 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No expenses recorded for this period yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6 flex-1">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-slate-100 dark:text-slate-800"
              />
              {segments.map((seg, idx) => {
                const dashLength = Math.max(0, (seg.slicePercent / 100) * circumference - 2);
                const dashOffset = -((seg.startPercent / 100) * circumference);
                const isDimmed = activeCategory !== null && activeCategory !== seg.category;

                return (
                  <motion.circle
                    key={seg.category}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={activeCategory === seg.category ? strokeWidth + 4 : strokeWidth}
                    strokeLinecap="butt"
                    strokeDasharray={`${dashLength} ${circumference}`}
                    initial={{ strokeDashoffset: circumference, opacity: 0 }}
                    animate={{
                      strokeDashoffset: dashOffset,
                      opacity: isDimmed ? 0.35 : 1,
                    }}
                    transition={{
                      duration: 0.55,
                      delay: idx * 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="cursor-pointer transition-opacity duration-150"
                    onMouseEnter={() => setHoveredCategory(seg.category)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    onClick={() => onSelectCategory?.(seg.category)}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5 pointer-events-none">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[114px]">
                {highlighted ? highlighted.category : 'Total Spent'}
              </span>
              <span className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {formatCurrency(highlighted ? highlighted.total : totalSpent, baseCurrency, true)}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {highlighted ? `${highlighted.percentage}% · ${highlighted.count} entries` : `${items.length} categories`}
              </span>
            </div>
          </div>

          <div className="w-full flex-1 space-y-2">
            {segments.map((seg) => {
              const isSelected = activeCategory === seg.category;
              return (
                <button
                  key={seg.category}
                  type="button"
                  onMouseEnter={() => setHoveredCategory(seg.category)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onClick={() => onSelectCategory?.(seg.category)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-colors min-h-[42px] ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                        {seg.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs font-mono tabular-nums">
                      <span className="text-slate-500 dark:text-slate-400">{seg.percentage}%</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(seg.total, baseCurrency, true)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(3, Math.min(100, seg.percentage))}%`,
                        backgroundColor: seg.color,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
