// =============================================================================
// KargaX — Tabs Component (Radix UI)
// Premium segmented tabs with animations
// =============================================================================

'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
    React.ComponentRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.List
        ref={ref}
        className={cn(
            'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100/70 p-1',
            'dark:border-zinc-800 dark:bg-zinc-900/60',
            className
        )}
        {...props}
    />
));
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef<
    React.ComponentRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
            'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-all sm:px-4',
            'text-zinc-600 hover:text-zinc-950',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/20',
            'disabled:pointer-events-none disabled:opacity-50',
            'data-[state=active]:bg-white data-[state=active]:text-zinc-950 data-[state=active]:shadow-sm data-[state=active]:font-semibold',
            'dark:text-zinc-400 dark:hover:text-white',
            'dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-white',
            className
        )}
        {...props}
    />
));
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef<
    React.ComponentRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        className={cn(
            'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/20',
            'data-[state=inactive]:hidden',
            className
        )}
        {...props}
    />
));
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
