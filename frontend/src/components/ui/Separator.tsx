// =============================================================================
// KargaX — Separator Component
// Radix separator with optional gradient
// =============================================================================

'use client';

import * as React from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { cn } from '@/lib/utils';

const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> & {
    gradient?: boolean;
  }
>(({ className, orientation = 'horizontal', decorative = true, gradient, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0',
      gradient
        ? 'bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700'
        : 'bg-slate-200 dark:bg-slate-700',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className
    )}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
