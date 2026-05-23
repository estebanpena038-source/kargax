// =============================================================================
// KargaX — Switch Component
// Premium toggle switch using Radix UI
// =============================================================================

'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { root: 'w-8 h-[18px]',   thumb: 'w-3.5 h-3.5 data-[state=checked]:translate-x-[14px]' },
  md: { root: 'w-11 h-6',       thumb: 'w-5 h-5 data-[state=checked]:translate-x-5' },
  lg: { root: 'w-14 h-[30px]',  thumb: 'w-6 h-6 data-[state=checked]:translate-x-7' },
};

const Switch = React.forwardRef<React.ComponentRef<typeof SwitchPrimitive.Root>, SwitchProps>(
  ({ className, label, description, size = 'md', id, ...props }, ref) => {
    const autoId = React.useId();
    const switchId = id || autoId;
    const s = sizes[size];

    const control = (
      <SwitchPrimitive.Root
        ref={ref}
        id={switchId}
        className={cn(
          'peer inline-flex shrink-0 cursor-pointer items-center rounded-full',
          'border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/20 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700',
          'data-[state=checked]:bg-zinc-950',
          s.root,
          className
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'pointer-events-none block rounded-full bg-white shadow-md',
            'ring-0 transition-transform duration-200',
            'data-[state=unchecked]:translate-x-0.5',
            s.thumb
          )}
        />
      </SwitchPrimitive.Root>
    );

    if (!label) return control;

    return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <label htmlFor={switchId} className="text-sm font-medium text-slate-900 dark:text-white cursor-pointer">
            {label}
          </label>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          )}
        </div>
        {control}
      </div>
    );
  }
);
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
