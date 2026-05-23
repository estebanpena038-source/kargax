// =============================================================================
// KargaX — UI Component Library
// Re-exports all UI primitives from a single entry point
// =============================================================================

// ── Core Components ──
export { Button, buttonVariants }               from './Button';
export type { ButtonProps }                     from './Button';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants } from './Card';
export type { CardProps }                       from './Card';

export { Input }                                from './Input';
export { AndeanPhoneInput }                     from './AndeanPhoneInput';
export { Select }                               from './Select';

// ── Toast (legacy — will transition to Sonner) ──
export { toast, ToastContainer }                from './Toast';

// ── New Premium Components ──
export { Badge, badgeVariants }                 from './Badge';
export type { BadgeProps }                      from './Badge';

export { Tooltip, TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent } from './Tooltip';

export {
  Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose,
  DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from './Dialog';

export { Avatar, AvatarImage, AvatarFallback } from './Avatar';
export type { AvatarProps }                     from './Avatar';

export { Progress }                             from './Progress';
export type { ProgressProps }                   from './Progress';

export { Skeleton, SkeletonCard, SkeletonRow, SkeletonStats } from './Skeleton';

export { EmptyState }                           from './EmptyState';
export type { EmptyStateProps }                 from './EmptyState';

export { StatsCard }                            from './StatsCard';
export type { StatsCardProps }                  from './StatsCard';

export { Separator }                            from './Separator';

export { Switch }                               from './Switch';
export type { SwitchProps }                     from './Switch';

export {
  Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose,
  SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from './Sheet';

export { RecaptchaCheckbox }                    from './RecaptchaCheckbox';
export { KargaxLogo }                           from '../brand/KargaxLogo';
export type { KargaxLogoProps }                 from '../brand/KargaxLogo';

// ── Advanced Components ──
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';

export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
  DropdownMenuGroup, DropdownMenuSub,
} from './DropdownMenu';
