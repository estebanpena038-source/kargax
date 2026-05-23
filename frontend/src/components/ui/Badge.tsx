// =============================================================================
// KargaX — Badge Component
// Premium badge with brand-aware variants
// =============================================================================

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  `inline-flex items-center gap-1.5 border font-semibold transition-colors
   focus:outline-none focus:ring-2 focus:ring-offset-2`,
  {
    variants: {
      variant: {
        default:     'bg-zinc-100 text-zinc-700 border-zinc-200',
        primary:     'bg-zinc-950 text-white border-zinc-950',
        secondary:   'bg-white text-zinc-950 border-zinc-200',
        success:     'bg-white text-zinc-950 border-zinc-200',
        warning:     'bg-white text-zinc-950 border-zinc-200',
        error:       'bg-white text-zinc-950 border-zinc-200',
        info:        'bg-slate-100 text-slate-700 border-slate-200',
        premium:     'bg-zinc-950 text-white border-zinc-950 shadow-sm',
        outline:     'bg-transparent border-zinc-300 text-zinc-700',
        ghost:       'bg-transparent border-transparent text-zinc-600',
        dot:         'bg-transparent border-transparent text-zinc-600',
      },
      size: {
        xs: 'text-[10px] px-1.5 py-0.5 rounded',
        sm: 'text-xs px-2 py-0.5 rounded-md',
        md: 'text-xs px-2.5 py-1 rounded-lg',
        lg: 'text-sm px-3 py-1 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Show a pulsing indicator dot before the label */
  withDot?: boolean;
  /** Color of the dot (defaults to current text color) */
  dotColor?: string;
  /** Icon element to render before the label */
  icon?: React.ReactNode;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, withDot, dotColor, icon, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {withDot && (
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ backgroundColor: dotColor || 'currentColor' }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: dotColor || 'currentColor' }}
          />
        </span>
      )}
      {icon && <span className="shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>}
      {children}
    </span>
  )
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
