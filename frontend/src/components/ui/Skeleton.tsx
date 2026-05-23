// =============================================================================
// KargaX — Skeleton Component
// Premium loading skeleton with shimmer animation
// =============================================================================

import * as React from 'react';
import { cn } from '@/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('skeleton rounded-lg', className)}
      {...props}
    />
  );
}

/** Card skeleton preset */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-6 space-y-4', className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
    </div>
  );
}

/** Table row skeleton preset */
function SkeletonRow({ cols = 4, className }: { cols?: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 py-4 border-b border-slate-100', className)}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === 0 ? 'w-16' : 'flex-1')}
        />
      ))}
    </div>
  );
}

/** Stats card skeleton */
function SkeletonStats({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-6', className)}>
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonRow, SkeletonStats };
