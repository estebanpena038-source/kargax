// =============================================================================
// KargaX — Tooltip Component
// Radix UI tooltip with premium styling
// =============================================================================

'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const TooltipRoot = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-[100] overflow-hidden rounded-lg px-3 py-1.5',
        'border border-slate-200 bg-white text-sm text-slate-700 shadow-lg',
        'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
        'animate-scale-in origin-[var(--radix-tooltip-content-transform-origin)]',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/** Convenience wrapper */
function Tooltip({
  children,
  content,
  side = 'top',
  delayDuration = 200,
  ...props
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
} & Omit<React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>, 'content'>) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} {...props}>
          {content}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

export { Tooltip, TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent };
