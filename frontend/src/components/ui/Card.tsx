// =============================================================================
// KargaX - Card Component
// Luxury surfaces with restrained depth
// =============================================================================

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
    'min-w-0 rounded-lg transition-all duration-300',
    {
        variants: {
            variant: {
                default: `
          bg-white/82 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800
          shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]
        `,
                elevated: `
          bg-white dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800
          shadow-[0_28px_70px_-46px_rgba(10,10,10,.62)]
          hover:shadow-[0_34px_82px_-50px_rgba(10,10,10,.68)]
        `,
                glass: `
          bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl
          border border-white/45 dark:border-white/10
          shadow-[0_24px_60px_-46px_rgba(10,10,10,.58)]
        `,
                dark: `
          luxury-panel text-white border border-white/10
          shadow-[0_32px_80px_-46px_rgba(0,0,0,.85)]
        `,
                premium: `
          bg-white dark:bg-zinc-950
          border border-zinc-950/10 dark:border-white/10
          shadow-[0_24px_70px_-50px_rgba(10,10,10,.72)]
        `,
                orange: `
          bg-[var(--color-accent-50)] border border-[var(--color-accent-100)]
          shadow-[0_20px_60px_-50px_rgba(10,10,10,.45)]
        `,
                outline: `
          bg-transparent border border-zinc-300 dark:border-zinc-700
          hover:border-zinc-950 dark:hover:border-zinc-400
        `,
                interactive: `
          bg-white/88 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800
          shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]
          hover:-translate-y-0.5 hover:border-zinc-950 dark:hover:border-zinc-500
          hover:shadow-[0_28px_70px_-46px_rgba(10,10,10,.62)]
          cursor-pointer
        `,
            },
            padding: {
                none: 'p-0',
                sm: 'p-4',
                md: 'p-4 sm:p-6',
                lg: 'p-4 min-[380px]:p-5 sm:p-6 md:p-8',
            },
        },
        defaultVariants: {
            variant: 'default',
            padding: 'md',
        },
    }
);

export interface CardProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
    asChild?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant, padding, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(cardVariants({ variant, padding }), className)}
            {...props}
        />
    )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn('text-xl font-semibold leading-tight text-zinc-950 dark:text-white', className)}
        {...props}
    />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-zinc-500 dark:text-zinc-400', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center pt-4', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
    cardVariants,
};
