// =============================================================================
// KargaX — Sheet / Drawer Component
// Mobile-first drawer using vaul
// =============================================================================

'use client';

import * as React from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { cn } from '@/lib/utils';

const Sheet = ({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root {...props} />
);
Sheet.displayName = 'Sheet';

const SheetTrigger = DrawerPrimitive.Trigger;
const SheetPortal = DrawerPrimitive.Portal;
const SheetClose = DrawerPrimitive.Close;

const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/64 backdrop-blur-md', className)}
    {...props}
  />
));
SheetOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    side?: 'top' | 'bottom' | 'left' | 'right';
  }
>(({ className, children, side = 'bottom', ...props }, ref) => {
  const sideStyles = {
    top:    'inset-x-0 top-0   rounded-b-lg max-h-[85vh]',
    bottom: 'inset-x-0 bottom-0 rounded-t-lg max-h-[85vh]',
    left:   'inset-y-0 left-0   h-full w-[85vw] max-w-sm rounded-r-lg',
    right:  'inset-y-0 right-0  h-full w-[85vw] max-w-sm rounded-l-lg',
  };

  return (
    <SheetPortal>
      <SheetOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 border border-zinc-200 bg-white dark:bg-zinc-950 dark:border-zinc-800 shadow-2xl flex flex-col',
          sideStyles[side],
          className
        )}
        {...props}
      >
        {/* Pull handle for bottom/top drawers */}
        {(side === 'bottom' || side === 'top') && (
          <div className="mx-auto mt-3 mb-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        )}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </DrawerPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = 'SheetContent';

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 pb-4', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-zinc-950 dark:text-white', className)}
    {...props}
  />
));
SheetTitle.displayName = DrawerPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn('text-sm text-zinc-500 dark:text-zinc-400', className)}
    {...props}
  />
));
SheetDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
