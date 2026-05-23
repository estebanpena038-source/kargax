// =============================================================================
// KargaX — Dialog (Modal) Component
// Enterprise-grade dialog using Radix UI
// =============================================================================

'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/64 backdrop-blur-md',
      'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-in',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showClose?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  }
>(({
  className,
  children,
  showClose = true,
  size = 'md',
  onFocusOutside,
  onInteractOutside,
  onPointerDownOutside,
  ...props
}, ref) => {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)]',
  };

  const isSelectMenuEvent = (event: Event) => {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (path.some((item) => item instanceof Element && item.closest('[data-kx-select-menu="true"]'))) {
      return true;
    }

    const target = event.target;
    return target instanceof Element && Boolean(target.closest('[data-kx-select-menu="true"]'));
  };

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
          'w-[calc(100vw-1rem)] min-w-0 sm:w-[calc(100vw-2rem)]',
          sizes[size],
          'max-h-[calc(100svh-1rem)] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_36px_90px_-48px_rgba(0,0,0,.82)] sm:p-6',
          'dark:bg-zinc-950 dark:border-zinc-800',
          'data-[state=open]:animate-scale-in',
          'focus:outline-none',
          className
        )}
        onFocusOutside={(event) => {
          if (isSelectMenuEvent(event)) {
            event.preventDefault();
            return;
          }
          onFocusOutside?.(event);
        }}
        onInteractOutside={(event) => {
          if (isSelectMenuEvent(event)) {
            event.preventDefault();
            return;
          }
          onInteractOutside?.(event);
        }}
        onPointerDownOutside={(event) => {
          if (isSelectMenuEvent(event)) {
            event.preventDefault();
            return;
          }
          onPointerDownOutside?.(event);
        }}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors focus:outline-none">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 mb-5', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6 pt-4 border-t border-zinc-100', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-xl font-semibold text-zinc-950 dark:text-white', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-zinc-500 dark:text-zinc-400', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
