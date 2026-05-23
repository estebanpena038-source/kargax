// =============================================================================
// KargaX — EmptyState Component
// Reusable premium empty state with illustration + CTA
// =============================================================================

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon = Package,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-16 px-8',
        className
      )}
    >
      <div
        className={cn(
          'rounded-full flex items-center justify-center mb-5',
          'bg-gradient-to-br from-zinc-100 to-stone-100 dark:from-zinc-900/70 dark:to-stone-900/50',
          compact ? 'w-16 h-16' : 'w-24 h-24'
        )}
      >
        <Icon
          className={cn(
            'text-zinc-700 dark:text-zinc-200',
            compact ? 'w-8 h-8' : 'w-12 h-12'
          )}
        />
      </div>

      <h3
        className={cn(
          'font-semibold text-zinc-950 dark:text-white mb-2',
          compact ? 'text-base' : 'text-xl'
        )}
      >
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            'text-zinc-500 dark:text-zinc-400 max-w-sm',
            compact ? 'text-sm' : 'text-base'
          )}
        >
          {description}
        </p>
      )}

      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
