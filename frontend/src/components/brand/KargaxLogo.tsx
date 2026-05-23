import * as React from 'react';
import { cn } from '@/lib/utils';

type KargaxLogoVariant = 'mark' | 'wordmark' | 'lockup';
type KargaxLogoTone = 'light' | 'dark';
type KargaxLogoSize = 'sm' | 'md' | 'lg';

export interface KargaxLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: KargaxLogoVariant;
  tone?: KargaxLogoTone;
  size?: KargaxLogoSize;
}

const markSizes: Record<KargaxLogoSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const wordSizes: Record<KargaxLogoSize, string> = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
};

export function KargaxLogo({
  variant = 'lockup',
  tone = 'dark',
  size = 'md',
  className,
  ...props
}: KargaxLogoProps) {
  const isLight = tone === 'light';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-3',
        variant === 'mark' && 'gap-0',
        className
      )}
      {...props}
    >
      {variant !== 'wordmark' ? (
        <span
          className={cn(
            'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border',
            'shadow-[0_16px_40px_rgba(0,0,0,0.12)]',
            markSizes[size],
            isLight
              ? 'border-white/15 bg-white text-black'
              : 'border-black/10 bg-black text-white'
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              'absolute inset-x-1 top-0 h-px',
              isLight ? 'bg-black/10' : 'bg-white/20'
            )}
          />
          <span className="font-display text-[0.92em] font-semibold leading-none">
            KX
          </span>
        </span>
      ) : null}

      {variant !== 'mark' ? (
        <span
          className={cn(
            'select-none font-display font-semibold leading-none',
            wordSizes[size],
            isLight ? 'text-white' : 'text-zinc-950'
          )}
        >
          Karga<span className={isLight ? 'text-white/70' : 'text-zinc-700'}>X</span>
        </span>
      ) : null}
    </div>
  );
}

export default KargaxLogo;
