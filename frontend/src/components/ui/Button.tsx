// =============================================================================
// KargaX - Button Component
// Luxury matte UI, backwards-compatible variants
// =============================================================================

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    `inline-flex min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal rounded-lg text-center text-sm font-semibold leading-tight
   transition-all duration-200 ease-out
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
   disabled:pointer-events-none disabled:opacity-45
   active:scale-[0.985]`,
    {
        variants: {
            variant: {
                primary: `
          bg-zinc-950 text-white border border-zinc-950
          shadow-[0_14px_32px_-22px_rgba(10,10,10,.9)]
          hover:bg-zinc-800 hover:border-zinc-800
        `,
                secondary: `
          bg-white text-zinc-950 border border-white
          shadow-[0_14px_32px_-24px_rgba(255,255,255,.5)]
          hover:bg-zinc-100 hover:border-zinc-100
        `,
                dark: `
          bg-black text-white border border-white/10
          shadow-[0_18px_42px_-24px_rgba(0,0,0,.9)]
          hover:bg-zinc-900
        `,
                outline: `
          border border-zinc-300 bg-white/75 text-zinc-950
          hover:bg-white hover:border-zinc-950
          dark:border-zinc-700 dark:bg-transparent dark:text-white dark:hover:bg-zinc-900
        `,
                ghost: `
          text-zinc-600 dark:text-zinc-300
          hover:bg-zinc-100 hover:text-zinc-950
          dark:hover:bg-zinc-900 dark:hover:text-white
        `,
                destructive: `
          bg-red-600 text-white border border-red-600
          hover:bg-red-700 hover:border-red-700
          shadow-[0_14px_32px_-24px_rgba(220,38,38,.9)]
        `,
                success: `
          bg-zinc-950 text-white border border-zinc-950
          hover:bg-zinc-800 hover:border-zinc-800
          shadow-[0_14px_32px_-24px_rgba(10,10,10,.9)]
        `,
                link: `
          text-zinc-950 dark:text-white underline-offset-4
          hover:underline
        `,
                premium: `
          bg-gradient-to-r from-zinc-950 via-zinc-900 to-black text-white
          border border-white/10
          shadow-[0_18px_46px_-26px_rgba(10,10,10,.92)]
          hover:brightness-110
        `,
            },
            size: {
                xs: 'h-8 px-3 text-xs rounded-md',
                sm: 'h-9 px-4 text-xs rounded-md',
                md: 'h-11 px-6 text-sm',
                lg: 'h-12 px-8 text-base',
                xl: 'h-14 px-10 text-lg',
                icon: 'h-10 w-10 p-0',
                'icon-sm': 'h-8 w-8 p-0 rounded-md',
            },
            fullWidth: {
                true: 'w-full',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant,
            size,
            fullWidth,
            asChild = false,
            isLoading = false,
            leftIcon,
            rightIcon,
            children,
            disabled,
            ...props
        },
        ref
    ) => {
        const Comp = asChild ? Slot : 'button';

        if (asChild) {
            return (
                <Comp
                    className={cn(buttonVariants({ variant, size, fullWidth, className }))}
                    ref={ref}
                    disabled={disabled || isLoading}
                    {...props}
                >
                    {children}
                </Comp>
            );
        }

        return (
            <Comp
                className={cn(buttonVariants({ variant, size, fullWidth, className }))}
                ref={ref}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Cargando...</span>
                    </>
                ) : (
                    <>
                        {leftIcon && <span className="shrink-0">{leftIcon}</span>}
                        <span className="min-w-0">{children}</span>
                        {rightIcon && <span className="shrink-0">{rightIcon}</span>}
                    </>
                )}
            </Comp>
        );
    }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
