// =============================================================================
// KargaX — StatsCard Component
// Premium metrics card with animated counter and trend indicator
// =============================================================================

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatsCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  previousValue?: number;
  prefix?: string;
  suffix?: string;
  trend?: { value: number; label?: string };
  color?: 'green' | 'orange' | 'blue' | 'red' | 'purple' | 'slate';
  className?: string;
}

const colorMap = {
  green:  { bg: 'bg-zinc-950',  light: 'bg-white dark:bg-zinc-900' },
  orange: { bg: 'bg-zinc-950',  light: 'bg-white dark:bg-zinc-900' },
  blue:   { bg: 'bg-slate-600',      light: 'bg-slate-50   dark:bg-slate-900/20' },
  red:    { bg: 'bg-zinc-950',        light: 'bg-white dark:bg-zinc-900' },
  purple: { bg: 'bg-zinc-950',  light: 'bg-white dark:bg-zinc-900' },
  slate:  { bg: 'bg-zinc-950',    light: 'bg-zinc-50  dark:bg-zinc-800' },
};

export function StatsCard({
  icon: Icon,
  label,
  value,
  prefix = '',
  suffix = '',
  trend,
  color = 'green',
  className,
}: StatsCardProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
  const isString = typeof value === 'string' && isNaN(parseFloat(value));
  const colors = colorMap[color];
  const isPositive = trend ? trend.value >= 0 : true;

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -3 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className={cn(
        'relative overflow-hidden rounded-lg bg-white/86 dark:bg-zinc-950',
        'border border-zinc-200 dark:border-zinc-800',
        'p-6 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] transition-shadow hover:shadow-[0_28px_70px_-46px_rgba(10,10,10,.62)]',
        className
      )}
    >
      {/* Decorative corner gradient */}
      <div className={cn(
        'absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10',
        colors.bg
      )} />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shadow-sm', colors.bg)}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {trend && (
            <span
              className={cn(
                'flex items-center gap-1 text-sm font-semibold rounded-full px-2 py-0.5',
                isPositive
                  ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30'
                  : 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
              )}
            >
              {isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {Math.abs(trend.value)}%
            </span>
          )}
        </div>

        <div className="animate-count-reveal">
          <p className="font-money text-3xl font-bold text-zinc-950 dark:text-white mb-1">
            {prefix}
            {isString ? (
              value
            ) : (
              <CountUp end={numericValue} duration={1.8} separator="," />
            )}
            {suffix}
          </p>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      </div>
    </motion.div>
  );
}
