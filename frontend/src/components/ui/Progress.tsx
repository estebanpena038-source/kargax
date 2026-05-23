// =============================================================================
// KargaX — Progress Component
// Animated progress bar with gradient + label support
// =============================================================================

'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'brand';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
}

const variants = {
  default: 'bg-slate-600',
  success: 'bg-zinc-950',
  warning: 'bg-zinc-950',
  error:   'bg-zinc-950',
  brand:   'bg-zinc-950',
};

const barSizes = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, variant = 'brand', size = 'md', showLabel, label, ...props }, ref) => (
  <div className="w-full">
    {(showLabel || label) && (
      <div className="flex justify-between items-center mb-1.5">
        {label && <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>}
        {showLabel && (
          <span className="text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
            {Math.round(value ?? 0)}%
          </span>
        )}
      </div>
    )}
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800',
        barSizes[size],
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full rounded-full transition-all duration-700 ease-out',
          variants[variant]
        )}
        style={{ width: `${value ?? 0}%` }}
      />
    </ProgressPrimitive.Root>
  </div>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
