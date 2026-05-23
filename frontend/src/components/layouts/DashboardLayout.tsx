// =============================================================================
// KargaX - Dashboard Layout Component
// Enterprise-grade responsive sidebar layout with Oracle-level stability
// =============================================================================
// 
// ARCHITECTURE OVERVIEW:
// - Responsive sidebar that collapses on mobile (< 1024px)
// - Persistent state saved to localStorage
// - Animated transitions with framer-motion
// - Full accessibility support (ARIA, keyboard navigation)
// - i18n ready for global scalability
//
// SECURITY FEATURES:
// - Protected route wrapper with auth check
// - Session validation on mount
// - Automatic redirect for unauthenticated users
//
// =============================================================================

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Menu,
    X,
    Truck,
    Package,
    PlusCircle,
    User,
    Users,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Bell,
    Search,
    Home,
    FileText,
    BarChart3,
    Building2,
    HelpCircle,
    DollarSign,
    ClipboardCheck,
    CalendarClock,
    Warehouse,
    Crown,
} from 'lucide-react';

import { useTranslation, LanguageSelector } from '@/lib/i18n';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { KargaxLogo, Select, toast } from '@/components/ui';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import warehouseClient from '@/lib/warehouses/client';
import type { PrivateFleetDriverContext, WarehouseAccessResponse, WarehouseRole } from '@/lib/warehouses/types';
import { getBusinessRoleLabel } from '@/lib/business-roles';
import {
    useNotificationStore,
    selectUnreadCount,
    selectApplicationsCount,
    selectApplicationUpdatesCount,
    selectAcceptedJobsCount,
} from '@/features/notifications/store/notificationStore';

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Navigation item structure for sidebar menu.
 * Supports nested items, badges, and role-based visibility.
 */
interface NavItem {
    /** Unique identifier for the nav item */
    id: string;
    /** Translation key for the label */
    labelKey: string;
    /** Fallback label if translation not found */
    fallbackLabel: string;
    /** Lucide icon component */
    icon: React.ElementType;
    /** Route path */
    href: string;
    /** Optional badge (e.g., notification count) */
    badge?: number;
    /** User types that can see this item */
    allowedUserTypes?: Array<'trucker' | 'business' | 'admin'>;
    /** Whether this item is only visible when sidebar is expanded */
    expandedOnly?: boolean;
    /** Nested sub-items */
    children?: NavItem[];
}

/**
 * Props for the DashboardLayout component.
 */
interface DashboardLayoutProps {
    /** Child components to render in the main content area */
    children: React.ReactNode;
    /** Page title for the header */
    pageTitle?: string;
    /** Whether to show the page header */
    showHeader?: boolean;
    /** Custom header actions */
    headerActions?: React.ReactNode;
}

type BusinessWarehouseRole = WarehouseRole | null;

interface BusinessSidebarAccessState {
    businessId: string | null;
    businessName: string | null;
    activeWarehouseId: string | null;
    warehouses: WarehouseAccessResponse['warehouses'];
    role: BusinessWarehouseRole;
    capabilities: WarehouseAccessResponse['capabilities'];
    subscription: WarehouseAccessResponse['subscription'];
    limits: WarehouseAccessResponse['limits'];
    isOwner: boolean;
    canManageBilling: boolean;
    canManageTeam: boolean;
    canViewFinance: boolean;
    canViewOperations: boolean;
    canCreateMarketplaceOffers: boolean;
    canManagePrivateFleet: boolean;
    canViewIntelligence: boolean;
    holdingAccountId: string | null;
    holdingRole: WarehouseAccessResponse['holdingRole'];
    holdingReady: boolean;
    holdingMessage: string | null;
}

// =============================================================================
// Constants
// =============================================================================

/** 
 * localStorage key for sidebar state persistence.
 * Follows the pattern: {app-name}-{feature}-{state}
 */
const SIDEBAR_STATE_KEY = 'kargax-sidebar-collapsed';
const isDashboardDebugLoggingEnabled = process.env.NODE_ENV !== 'production';

function dashboardDebugLog(...args: unknown[]) {
    if (isDashboardDebugLoggingEnabled) {
        console.log(...args);
    }
}

/**
 * Breakpoint for mobile/desktop detection (tailwind lg)
 */
const MOBILE_BREAKPOINT = 1024;

/**
 * Animation variants for framer-motion
 */
const sidebarVariants = {
    expanded: { width: 280 },
    collapsed: { width: 80 },
};

const mobileMenuVariants = {
    open: { x: 0, opacity: 1 },
    closed: { x: -300, opacity: 0 },
};

// =============================================================================
// Navigation Configuration
// =============================================================================

/**
 * Main navigation items for the sidebar.
 * Organized by feature area for scalability.
 * Now accepts notification counts for dynamic badges.
 */
const getNavigationItems = (
    userType: string,
    counts?: { total: number; applications: number; applicationUpdates: number; acceptedJobs: number },
    canAccessCeo = false
): NavItem[] => [
        // Dashboard/Home
        {
            id: 'home',
            labelKey: 'nav.home',
            fallbackLabel: 'Inicio',
            icon: Home,
            href: '/dashboard',
            allowedUserTypes: ['trucker', 'business', 'admin'],
        },
        // Offers Section
        {
            id: 'offers-browse',
            labelKey: 'nav.browseOffers',
            fallbackLabel: 'Buscar Ofertas',
            icon: Search,
            href: '/ofertas',
            allowedUserTypes: ['trucker', 'business', 'admin'],
        },
        {
            id: 'offers-publish',
            labelKey: 'nav.publishOffer',
            fallbackLabel: 'Publicar Oferta',
            icon: PlusCircle,
            href: '/ofertas/publicar',
            allowedUserTypes: ['business', 'admin'],
        },
        {
            id: 'my-offers',
            labelKey: 'nav.myOffers',
            fallbackLabel: 'Mis Ofertas',
            icon: Package,
            href: '/ofertas/mis-ofertas',
            allowedUserTypes: ['business', 'admin'],
        },
        {
            id: 'warehouses',
            labelKey: 'nav.warehouses',
            fallbackLabel: 'Bodegas',
            icon: Warehouse,
            href: '/bodegas',
            allowedUserTypes: ['business', 'admin'],
        },
        {
            id: 'team',
            labelKey: 'nav.team',
            fallbackLabel: 'Equipo',
            icon: Users,
            href: '/equipo',
            allowedUserTypes: ['business', 'admin'],
        },
        {
            id: 'private-fleet',
            labelKey: 'nav.privateFleet',
            fallbackLabel: 'Flota',
            icon: Truck,
            href: '/dashboard/flota',
            allowedUserTypes: ['trucker', 'business', 'admin'],
        },
        {
            id: 'business-intelligence',
            labelKey: 'nav.businessIntelligence',
            fallbackLabel: 'Inteligencia',
            icon: BarChart3,
            href: '/dashboard/inteligencia',
            allowedUserTypes: ['business', 'admin'],
        },
        {
            id: 'plans',
            labelKey: 'nav.plans',
            fallbackLabel: 'Planes',
            icon: DollarSign,
            href: '/planes',
            allowedUserTypes: ['business', 'admin'],
        },
        {
            id: 'corporate',
            labelKey: 'nav.corporate',
            fallbackLabel: 'Corporativo',
            icon: Building2,
            href: '/corporativo',
            allowedUserTypes: ['business', 'admin'],
        },
        // Inspection Reports (for business)
        {
            id: 'inspections',
            labelKey: 'nav.inspections',
            fallbackLabel: 'Inspecciones',
            icon: ClipboardCheck,
            href: '/inspecciones',
            allowedUserTypes: ['business', 'admin'],
        },
        // Received Applications (for business) - WITH BADGE
        {
            id: 'received-applications',
            labelKey: 'nav.receivedApplications',
            fallbackLabel: 'Postulaciones',
            icon: Users,
            href: '/postulaciones-recibidas',
            badge: counts?.applications || undefined,
            allowedUserTypes: ['business', 'admin'],
        },
        // My Applications (for truckers) - WITH BADGE
        {
            id: 'my-applications',
            labelKey: 'nav.myApplications',
            fallbackLabel: 'Mi Trabajo',
            icon: FileText,
            href: '/postulaciones',
            badge: counts?.applicationUpdates || undefined,
            allowedUserTypes: ['trucker'],
        },
        {
            id: 'assigned-trips',
            labelKey: 'nav.assignedTrips',
            fallbackLabel: 'Viajes asignados',
            icon: Truck,
            href: '/viajes-asignados',
            badge: counts?.acceptedJobs || undefined,
            allowedUserTypes: ['trucker'],
        },
        // Wallet (for truckers)
        {
            id: 'wallet',
            labelKey: 'nav.wallet',
            fallbackLabel: 'Mi Billetera',
            icon: DollarSign,
            href: '/billetera',
            allowedUserTypes: ['trucker'],
        },
        // Notifications (for all users) - WITH BADGE
        {
            id: 'notifications',
            labelKey: 'nav.notifications',
            fallbackLabel: 'Notificaciones',
            icon: Bell,
            href: '/notificaciones',
            badge: counts?.total || undefined,
            allowedUserTypes: ['trucker', 'business', 'admin'],
        },
        {
            id: 'admin',
            labelKey: 'nav.admin',
            fallbackLabel: 'Admin',
            icon: BarChart3,
            href: '/admin',
            allowedUserTypes: ['admin'],
        },
        ...(canAccessCeo ? [{
            id: 'admin-ceo',
            labelKey: 'nav.ceo',
            fallbackLabel: 'CEO KargaX',
            icon: Crown,
            href: '/admin/ceo',
            allowedUserTypes: ['admin'] as Array<'admin'>,
        }] : []),
        // MVP: Messages disabled for initial launch
        // {
        //     id: 'messages',
        //     labelKey: 'nav.messages',
        //     fallbackLabel: 'Mensajes',
        //     icon: MessageSquare,
        //     href: '/mensajes',
        //     badge: 3,
        //     allowedUserTypes: ['trucker', 'business', 'admin'],
        // },
        // MVP: Analytics disabled for initial launch
        // {
        //     id: 'analytics',
        //     labelKey: 'nav.analytics',
        //     fallbackLabel: 'Estadísticas',
        //     icon: BarChart3,
        //     href: '/estadisticas',
        //     allowedUserTypes: ['business', 'admin'],
        // },
    ];

/**
 * Secondary/utility navigation items (bottom of sidebar)
 */
const getSecondaryNavItems = (): NavItem[] => [
    {
        id: 'profile',
        labelKey: 'nav.profile',
        fallbackLabel: 'Mi Perfil',
        icon: User,
        href: '/perfil',
    },
    {
        id: 'settings',
        labelKey: 'nav.settings',
        fallbackLabel: 'Configuración',
        icon: Settings,
        href: '/configuracion',
    },
    {
        id: 'help',
        labelKey: 'nav.help',
        fallbackLabel: 'Ayuda',
        icon: HelpCircle,
        href: '/ayuda',
    },
];

const getWarehouseScopedNavigation = (
    warehouseId: string,
    counts?: { total: number }
): NavItem[] => [
        {
            id: 'warehouse-overview',
            labelKey: 'nav.warehouseOverview',
            fallbackLabel: 'Resumen',
            icon: Home,
            href: `/bodegas/${warehouseId}`,
            allowedUserTypes: ['business'],
        },
        {
            id: 'warehouse-appointments',
            labelKey: 'nav.warehouseAppointments',
            fallbackLabel: 'Citas',
            icon: CalendarClock,
            href: `/bodegas/${warehouseId}/citas`,
            allowedUserTypes: ['business'],
        },
        {
            id: 'warehouse-docks',
            labelKey: 'nav.warehouseDocks',
            fallbackLabel: 'Muelles',
            icon: Warehouse,
            href: `/bodegas/${warehouseId}/muelles`,
            allowedUserTypes: ['business'],
        },
        {
            id: 'warehouse-inventory',
            labelKey: 'nav.warehouseInventory',
            fallbackLabel: 'Inventario',
            icon: Package,
            href: `/bodegas/${warehouseId}/inventario`,
            allowedUserTypes: ['business'],
        },
        {
            id: 'warehouse-receipts',
            labelKey: 'nav.warehouseReceipts',
            fallbackLabel: 'Recepciones',
            icon: ClipboardCheck,
            href: `/bodegas/${warehouseId}/recepciones`,
            allowedUserTypes: ['business'],
        },
        {
            id: 'warehouse-picking',
            labelKey: 'nav.warehousePicking',
            fallbackLabel: 'Picking',
            icon: FileText,
            href: `/bodegas/${warehouseId}/picking`,
            allowedUserTypes: ['business'],
        },
        {
            id: 'warehouse-dispatches',
            labelKey: 'nav.warehouseDispatches',
            fallbackLabel: 'Despachos',
            icon: Truck,
            href: `/bodegas/${warehouseId}/despachos`,
            allowedUserTypes: ['business'],
        },
        {
            id: 'warehouse-incidents',
            labelKey: 'nav.warehouseIncidents',
            fallbackLabel: 'Incidentes',
            icon: Bell,
            href: `/bodegas/${warehouseId}/incidentes`,
            allowedUserTypes: ['business'],
        },
        {
            id: 'warehouse-analytics',
            labelKey: 'nav.warehouseAnalytics',
            fallbackLabel: 'Analitica',
            icon: BarChart3,
            href: `/bodegas/${warehouseId}/analitica`,
            allowedUserTypes: ['business'],
        },
        {
            id: 'notifications',
            labelKey: 'nav.notifications',
            fallbackLabel: 'Notificaciones',
            icon: Bell,
            href: '/notificaciones',
            badge: counts?.total || undefined,
            allowedUserTypes: ['business'],
        },
    ];

// =============================================================================
// Custom Hooks
// =============================================================================

/**
 * Hook to detect if viewport is mobile.
 * Uses ResizeObserver for efficient updates.
 */
function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        // Initial check
        const checkMobile = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        checkMobile();

        // Listen for resize events with debounce
        let timeoutId: ReturnType<typeof setTimeout>;
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(checkMobile, 100);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, []);

    return isMobile;
}

/**
 * Hook to persist sidebar state in localStorage.
 * Prevents layout shift on page load.
 */
function useSidebarState(): [boolean, (collapsed: boolean) => void] {
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    // Load initial state from localStorage
    React.useEffect(() => {
        try {
            const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
            if (saved !== null) {
                setIsCollapsed(JSON.parse(saved));
            }
        } catch (error) {
            console.error('Failed to load sidebar state:', error);
        }
    }, []);

    // Save state to localStorage
    const setSidebarState = React.useCallback((collapsed: boolean) => {
        setIsCollapsed(collapsed);
        try {
            localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(collapsed));
        } catch (error) {
            console.error('Failed to save sidebar state:', error);
        }
    }, []);

    return [isCollapsed, setSidebarState];
}

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Individual navigation item component.
 * Handles active state, icons, badges, and tooltips.
 */
const NavItemComponent = React.memo(function NavItemComponent({
    item,
    isCollapsed,
    isActive,
    onClick,
}: {
    item: NavItem;
    isCollapsed: boolean;
    isActive: boolean;
    onClick?: () => void;
}) {
    const { t } = useTranslation();
    const Icon = item.icon;
    const translatedLabel = t(item.labelKey);
    const label = translatedLabel && translatedLabel !== item.labelKey ? translatedLabel : item.fallbackLabel;

    return (
        <Link
            href={item.href}
            onClick={onClick}
            className={cn(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                'hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                isActive
                    ? 'bg-zinc-950 text-white font-medium shadow-[0_14px_34px_-26px_rgba(10,10,10,.9)]'
                    : 'text-zinc-600 hover:text-zinc-950',
                isCollapsed && 'justify-center px-2'
            )}
            title={isCollapsed ? label : undefined}
            aria-current={isActive ? 'page' : undefined}
        >
            {/* Icon */}
            <div className={cn(
                'flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center transition-colors',
                isActive
                    ? 'bg-white/12 text-white'
                    : 'bg-zinc-100 text-zinc-500 group-hover:bg-white group-hover:text-zinc-950'
            )}>
                <Icon className="w-5 h-5" />
            </div>

            {/* Label (hidden when collapsed) */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="flex-1 truncate text-sm"
                    >
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>

            {/* Badge (hidden when collapsed) */}
            {item.badge && item.badge > 0 && !isCollapsed && (
                <span className="flex-shrink-0 rounded-md border border-white/20 bg-zinc-950 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
                    {item.badge > 99 ? '99+' : item.badge}
                </span>
            )}

            {/* Badge dot (visible when collapsed) */}
            {item.badge && item.badge > 0 && isCollapsed && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-zinc-950 ring-2 ring-white" />
            )}
        </Link>
    );
});

/**
 * User profile section in sidebar footer.
 * Shows avatar, name, and user type.
 */
const UserProfileSection = React.memo(function UserProfileSection({
    isCollapsed,
    onLogout,
    visibleRole,
    businessName,
    planName,
}: {
    isCollapsed: boolean;
    onLogout: () => void;
    visibleRole?: string | null;
    businessName?: string | null;
    planName?: string | null;
}) {
    const { user } = useAuthStore();
    const { t } = useTranslation();

    if (!user) return null;

    const initials = user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const userTypeLabel = visibleRole || {
        trucker: t('nav.userType.trucker') || 'Transportador',
        business: t('nav.userType.business') || 'Empresa',
        admin: t('nav.userType.admin') || 'Administrador',
    }[user.userType];

    return (
        <div className={cn(
            'border-t border-zinc-200 pt-4 mt-4',
            isCollapsed ? 'px-2' : 'px-4'
        )}>
            <div className={cn(
                'flex items-center gap-3',
                isCollapsed && 'justify-center'
            )}>
                {/* Avatar */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-950 text-sm font-semibold text-white shadow-sm">
                    {initials}
                </div>

                {/* User Info (hidden when collapsed) */}
                {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-950">
                            {user.fullName}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                            {userTypeLabel}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500">
                            {businessName || (user.userType === 'admin' ? 'KargaX Plataforma' : 'Cuenta personal')}
                        </p>
                        {planName ? (
                            <p className="truncate text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-600">
                                {planName}
                            </p>
                        ) : null}
                    </div>
                )}

                {/* Logout Button (hidden when collapsed) */}
                {!isCollapsed && (
                    <button
                        onClick={onLogout}
                        className="flex-shrink-0 rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
                        title={t('nav.logout') || 'Cerrar sesión'}
                        aria-label={t('nav.logout') || 'Cerrar sesión'}
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Logout button when collapsed */}
            {isCollapsed && (
                <button
                    onClick={onLogout}
                    className="mt-3 flex w-full items-center justify-center rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
                    title={t('nav.logout') || 'Cerrar sesión'}
                    aria-label={t('nav.logout') || 'Cerrar sesión'}
                >
                    <LogOut className="w-5 h-5" />
                </button>
            )}
        </div>
    );
});

const WarehouseSelector = React.memo(function WarehouseSelector({
    isCollapsed,
    loading,
    warehouses,
    activeWarehouseId,
    onChange,
}: {
    isCollapsed: boolean;
    loading: boolean;
    warehouses: Array<{ id: string; name: string; code: string; city: string; department: string }>;
    activeWarehouseId: string | null;
    onChange: (warehouseId: string) => void;
}) {
    if (warehouses.length === 0 || isCollapsed) {
        return null;
    }

    return (
        <div className="px-3 pt-4">
            <Select
                label="Bodega activa"
                value={activeWarehouseId || ''}
                onChange={onChange}
                isLoading={loading}
                options={warehouses.map((warehouse) => ({
                    value: warehouse.id,
                    label: warehouse.name,
                    description: `${warehouse.code} · ${warehouse.city}, ${warehouse.department}`,
                }))}
                placeholder="Selecciona una bodega"
            />
        </div>
    );
});

// =============================================================================
// Main Component
// =============================================================================

/**
 * DashboardLayout - Enterprise-grade responsive dashboard layout.
 * 
 * Features:
 * - Collapsible sidebar with animation
 * - Mobile drawer menu
 * - Role-based navigation
 * - Persistent state
 * - Full accessibility
 * 
 * @example
 * ```tsx
 * <DashboardLayout pageTitle="Publicar Oferta">
 *   <MyPageContent />
 * </DashboardLayout>
 * ```
 */
export function DashboardLayout({
    children,
    pageTitle,
    showHeader = true,
    headerActions,
}: DashboardLayoutProps) {
    // =========================================================================
    // Hooks & State
    // =========================================================================
    const pathname = usePathname();
    const currentPath = pathname || '';
    const router = useRouter();
    const { t } = useTranslation();
    const { user, signOut, isAuthenticated, initialize, isInitialized } = useAuthStore();

    const isMobile = useIsMobile();
    const [isCollapsed, setIsCollapsed] = useSidebarState();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const [businessAccess, setBusinessAccess] = React.useState<BusinessSidebarAccessState | null>(null);
    const [businessAccessLoading, setBusinessAccessLoading] = React.useState(false);
    const [privateFleetContext, setPrivateFleetContext] = React.useState<PrivateFleetDriverContext | null>(null);
    const [privateFleetContextLoading, setPrivateFleetContextLoading] = React.useState(false);
    const [canAccessCeo, setCanAccessCeo] = React.useState(false);

    // =========================================================================
    // Auth Check - Simplified and robust
    // =========================================================================

    React.useEffect(() => {
        if (user && isAuthenticated) {
            dashboardDebugLog('[DashboardLayout] User already authenticated, skipping initialize');
            return;
        }

        if (!isInitialized) {
            dashboardDebugLog('[DashboardLayout] Initializing auth store...');
            void initialize();
            return;
        }

        let cancelled = false;

        const confirmActiveSession = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (cancelled) {
                return;
            }

            if (session?.user) {
                dashboardDebugLog('[DashboardLayout] Session exists but store is stale, forcing reinitialize');
                await initialize(true);
                return;
            }

            dashboardDebugLog('[DashboardLayout] No active session, redirecting to login');
            router.replace('/login?redirect=' + encodeURIComponent(pathname || '/dashboard'));
        };

        void confirmActiveSession();

        return () => {
            cancelled = true;
        };
    }, [user, isAuthenticated, isInitialized, initialize, router, pathname]);

    // =========================================================================
    // Notification Store
    // =========================================================================
    const totalUnreadCount = useNotificationStore(selectUnreadCount);
    const applicationsCount = useNotificationStore(selectApplicationsCount);
    const applicationUpdatesCount = useNotificationStore(selectApplicationUpdatesCount);
    const acceptedJobsCount = useNotificationStore(selectAcceptedJobsCount);
    const initializeNotifications = useNotificationStore((state) => state.initialize);
    const cleanupNotifications = useNotificationStore((state) => state.cleanup);

    // Initialize notification store when user is available
    React.useEffect(() => {
        if (user?.id) {
            initializeNotifications(user.id);
        }
        return () => {
            cleanupNotifications();
        };
    }, [user?.id, initializeNotifications, cleanupNotifications]);

    React.useEffect(() => {
        let cancelled = false;

        const loadBusinessAccess = async () => {
            if (user?.userType !== 'business') {
                setBusinessAccess(null);
                return;
            }

            setBusinessAccessLoading(true);
            try {
                const access = await warehouseClient.getWarehouseAccess();
                if (!cancelled) {
                    setBusinessAccess({
                        businessId: access.businessId,
                        businessName: access.businessName ?? null,
                        activeWarehouseId: access.activeWarehouseId,
                        warehouses: access.warehouses,
                        role: access.role,
                        capabilities: access.capabilities,
                        subscription: access.subscription,
                        limits: access.limits,
                        isOwner: access.isOwner,
                        canManageBilling: access.canManageBilling,
                        canManageTeam: access.canManageTeam,
                        canViewFinance: Boolean(access.canViewFinance),
                        canViewOperations: Boolean(access.canViewOperations),
                        canCreateMarketplaceOffers: Boolean(access.canCreateMarketplaceOffers),
                        canManagePrivateFleet: Boolean(access.canManagePrivateFleet),
                        canViewIntelligence: Boolean(access.canViewIntelligence),
                        holdingAccountId: access.holdingAccountId ?? null,
                        holdingRole: access.holdingRole ?? null,
                        holdingReady: access.holdingReady ?? true,
                        holdingMessage: access.holdingMessage ?? null,
                    });
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('[DashboardLayout] warehouse access error:', error);
                }
            } finally {
                if (!cancelled) {
                    setBusinessAccessLoading(false);
                }
            }
        };

        void loadBusinessAccess();

        return () => {
            cancelled = true;
        };
    }, [user?.id, user?.userType]);

    React.useEffect(() => {
        let cancelled = false;

        const loadPrivateFleetContext = async () => {
            if (user?.userType !== 'trucker') {
                setPrivateFleetContext(null);
                setPrivateFleetContextLoading(false);
                return;
            }

            setPrivateFleetContextLoading(true);
            try {
                const context = await warehouseClient.getPrivateFleetDriverContext();
                if (!cancelled) {
                    setPrivateFleetContext(context);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('[DashboardLayout] private fleet driver context error:', error);
                    setPrivateFleetContext(null);
                }
            } finally {
                if (!cancelled) {
                    setPrivateFleetContextLoading(false);
                }
            }
        };

        void loadPrivateFleetContext();

        return () => {
            cancelled = true;
        };
    }, [user?.id, user?.userType]);

    React.useEffect(() => {
        let cancelled = false;

        const loadCeoAccess = async () => {
            if (user?.userType !== 'admin') {
                setCanAccessCeo(false);
                return;
            }

            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) {
                    if (!cancelled) setCanAccessCeo(false);
                    return;
                }

                const response = await fetch('/api/admin/ceo-access', {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                });
                const payload = await response.json().catch(() => null);
                const allowed = Boolean(payload?.data?.allowed);

                if (!cancelled) {
                    setCanAccessCeo(response.ok && allowed);
                }
            } catch {
                if (!cancelled) {
                    setCanAccessCeo(false);
                }
            }
        };

        void loadCeoAccess();

        return () => {
            cancelled = true;
        };
    }, [user?.id, user?.userType]);

    // =========================================================================
    // Navigation Items (filtered by user type, with dynamic badges)
    // =========================================================================
    const navigationItems = React.useMemo(() => {
        if (!user) return [];
        const counts = {
            total: totalUnreadCount,
            applications: applicationsCount,
            applicationUpdates: applicationUpdatesCount,
            acceptedJobs: acceptedJobsCount,
        };
        if (
            user.userType === 'business' &&
            businessAccess &&
            !businessAccess.isOwner &&
            businessAccess.activeWarehouseId &&
            ['manager', 'operator', 'warehouse_manager', 'warehouse_operator'].includes(businessAccess.role || '')
        ) {
            const capabilities = businessAccess.capabilities;
            return getWarehouseScopedNavigation(businessAccess.activeWarehouseId, counts).filter((item) => {
                if (!capabilities) {
                    return true;
                }

                if (item.id === 'warehouse-docks') return capabilities.manageDocks;
                if (item.id === 'warehouse-inventory') return capabilities.viewOperationalDetail;
                if (item.id === 'warehouse-receipts') return capabilities.manageReceipts || capabilities.viewOperationalDetail;
                if (item.id === 'warehouse-picking') return capabilities.manageDispatches || capabilities.manageTasks || capabilities.viewOperationalDetail;
                if (item.id === 'warehouse-dispatches') return capabilities.manageDispatches || capabilities.viewOperationalDetail;
                if (item.id === 'warehouse-incidents') return capabilities.manageIncidents || capabilities.viewEvidence;
                if (item.id === 'warehouse-analytics') return capabilities.exportData || businessAccess.canViewIntelligence;

                return true;
            });
        }

        return getNavigationItems(user.userType, counts, canAccessCeo).filter(
            (item) => !item.allowedUserTypes || item.allowedUserTypes.includes(user.userType)
        ).filter((item) => {
            if (item.id === 'offers-browse' && user.userType === 'trucker') {
                return !privateFleetContextLoading && !privateFleetContext?.isPrivateFleetDriver;
            }

            if (item.id === 'my-applications' && user.userType === 'trucker' && privateFleetContext?.isPrivateFleetDriver) {
                return false;
            }

            if (item.id === 'plans') {
                if (user.userType === 'admin') {
                    return true;
                }

                if (user.userType !== 'business') {
                    return false;
                }

                return businessAccess ? businessAccess.canManageBilling : true;
            }

            if (item.id === 'team') {
                if (user.userType === 'admin') {
                    return true;
                }

                if (user.userType !== 'business') {
                    return false;
                }

                return businessAccess ? businessAccess.canManageTeam : true;
            }

            if (item.id === 'corporate') {
                if (user.userType === 'admin') {
                    return true;
                }

                if (user.userType !== 'business') {
                    return false;
                }

                return businessAccess ? Boolean(businessAccess.holdingAccountId) : false;
            }

            if (item.id === 'offers-publish') {
                return user.userType === 'admin' || (businessAccess ? businessAccess.canCreateMarketplaceOffers : true);
            }

            if (item.id === 'my-offers' || item.id === 'received-applications' || item.id === 'inspections') {
                return user.userType === 'admin' || (businessAccess ? businessAccess.canViewOperations : true);
            }

            if (item.id === 'private-fleet') {
                if (user.userType === 'trucker') {
                    return false;
                }

                return user.userType === 'admin' || (businessAccess ? (businessAccess.canManagePrivateFleet || businessAccess.canViewFinance) : true);
            }

            if (item.id === 'business-intelligence') {
                return user.userType === 'admin' || (businessAccess ? businessAccess.canViewIntelligence : true);
            }

            if (item.id === 'warehouses') {
                return user.userType === 'admin' || (businessAccess ? Boolean(businessAccess.capabilities?.viewWarehouseSummary) : true);
            }

            return true;
        }).map((item) => {
            if (item.id === 'assigned-trips' && user.userType === 'trucker') {
                return {
                    ...item,
                    badge: privateFleetContext?.stats.activeTrips || undefined,
                };
            }

            return item;
        });
    }, [
        user,
        totalUnreadCount,
        applicationsCount,
        applicationUpdatesCount,
        acceptedJobsCount,
        businessAccess,
        canAccessCeo,
        privateFleetContext?.isPrivateFleetDriver,
        privateFleetContext?.stats.activeTrips,
        privateFleetContextLoading,
    ]);

    const secondaryNavItems = React.useMemo(() => getSecondaryNavItems(), []);
    const visibleRoleLabel = React.useMemo(() => {
        if (!user) {
            return null;
        }

        if (user.userType === 'trucker' && privateFleetContext?.isPrivateFleetDriver) {
            return 'Transportista privado';
        }

        if (user.userType !== 'business' || !businessAccess?.role) {
            return null;
        }

        if (businessAccess.role === 'admin') {
            return 'Admin';
        }

        return getBusinessRoleLabel(businessAccess.role);
    }, [businessAccess?.role, privateFleetContext?.isPrivateFleetDriver, user]);

    const profileBusinessName = React.useMemo(() => {
        if (!user) {
            return null;
        }

        if (user.userType === 'trucker') {
            if (privateFleetContextLoading) {
                return 'Verificando flota';
            }

            if (privateFleetContext?.isPrivateFleetDriver) {
                return privateFleetContext.businessName
                    ? `Empresa: ${privateFleetContext.businessName}`
                    : 'Flota privada';
            }

            return null;
        }

        return businessAccess?.businessName || null;
    }, [
        businessAccess?.businessName,
        privateFleetContext?.businessName,
        privateFleetContext?.isPrivateFleetDriver,
        privateFleetContextLoading,
        user,
    ]);

    const currentPlanName = React.useMemo(() => {
        const entitlementState = businessAccess?.limits?.entitlementState;
        const pilotDaysRemaining = businessAccess?.limits?.pilotDaysRemaining;

        if (entitlementState === 'pilot_active') {
            return typeof pilotDaysRemaining === 'number'
                ? `Launch Pilot · ${pilotDaysRemaining} dias`
                : 'Launch Pilot';
        }

        if (entitlementState === 'pilot_expired' && !businessAccess?.subscription?.plan_code) {
            return 'Free · piloto vencido';
        }

        return businessAccess?.subscription?.plan?.name
            || (businessAccess?.subscription?.plan_code
                ? businessAccess.subscription.plan_code.charAt(0).toUpperCase() + businessAccess.subscription.plan_code.slice(1)
                : null);
    }, [
        businessAccess?.limits?.entitlementState,
        businessAccess?.limits?.pilotDaysRemaining,
        businessAccess?.subscription?.plan?.name,
        businessAccess?.subscription?.plan_code,
    ]);

    // =========================================================================
    // Handlers
    // =========================================================================
    const handleLogout = React.useCallback(async () => {
        try {
            await signOut();
            toast.success('Sesión cerrada', 'Has cerrado sesión correctamente');
            router.push('/login');
        } catch {
            toast.error('Error', 'No se pudo cerrar la sesión');
        }
    }, [signOut, router]);

    const handleMobileMenuClose = React.useCallback(() => {
        setIsMobileMenuOpen(false);
    }, []);

    const toggleSidebar = React.useCallback(() => {
        setIsCollapsed(!isCollapsed);
    }, [isCollapsed, setIsCollapsed]);

    const handleActiveWarehouseChange = React.useCallback(async (warehouseId: string) => {
        try {
            await warehouseClient.setActiveWarehouse(warehouseId);
            setBusinessAccess((current) =>
                current
                    ? {
                        ...current,
                        activeWarehouseId: warehouseId,
                    }
                    : current
            );
            if (user?.userType === 'business') {
                router.push(`/bodegas/${warehouseId}`);
            }
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudo cambiar la bodega activa');
        }
    }, [router, user?.userType]);

    // =========================================================================
    // Close mobile menu on route change
    // =========================================================================
    React.useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    // =========================================================================
    // Close mobile menu on ESC key
    // =========================================================================
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isMobileMenuOpen]);

    // =========================================================================
    // Loading State - Only show while actively initializing
    // =========================================================================
    if (!isInitialized) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-zinc-950 border-t-transparent" />
                    <p className="text-zinc-500">{t('common.loading') || 'Cargando...'}</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-zinc-950 border-t-transparent" />
                    <p className="text-zinc-500">{t('common.loading') || 'Redirigiendo...'}</p>
                </div>
            </div>
        );
    }

    // =========================================================================
    // Render
    // =========================================================================
    return (
        <div className="flex min-h-screen min-w-0 bg-[var(--color-background)]">
            {/* ================================================================
                Desktop Sidebar
                ================================================================ */}
            {!isMobile && (
                <motion.aside
                    initial={false}
                    animate={isCollapsed ? 'collapsed' : 'expanded'}
                    variants={sidebarVariants}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="fixed left-0 top-0 z-30 flex h-full flex-col border-r border-zinc-200 bg-white/92 backdrop-blur-xl"
                >
                    {/* Logo Section */}
                    <div className={cn(
                        'flex h-16 items-center border-b border-zinc-200',
                        isCollapsed ? 'justify-center px-2' : 'px-4 gap-3'
                    )}>
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-2"
                        >
                            <KargaxLogo variant={isCollapsed ? 'mark' : 'lockup'} tone="dark" size="md" />
                        </Link>
                    </div>

                    {/* Main Navigation */}
                    <WarehouseSelector
                        isCollapsed={isCollapsed}
                        loading={businessAccessLoading}
                        warehouses={businessAccess?.warehouses || []}
                        activeWarehouseId={businessAccess?.activeWarehouseId || null}
                        onChange={handleActiveWarehouseChange}
                    />
                    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
                        {navigationItems.map((item) => (
                            <NavItemComponent
                                key={item.id}
                                item={item}
                                isCollapsed={isCollapsed}
                                isActive={currentPath === item.href || currentPath.startsWith(item.href + '/')}
                            />
                        ))}

                        {/* Divider */}
                        <div className="!my-4 border-t border-zinc-200" />

                        {/* Secondary Navigation */}
                        {secondaryNavItems.map((item) => (
                            <NavItemComponent
                                key={item.id}
                                item={item}
                                isCollapsed={isCollapsed}
                                isActive={currentPath === item.href}
                            />
                        ))}
                    </nav>

                    {/* User Profile Section */}
                    <UserProfileSection
                        isCollapsed={isCollapsed}
                        onLogout={handleLogout}
                        visibleRole={visibleRoleLabel}
                        businessName={profileBusinessName}
                        planName={currentPlanName}
                    />

                    {/* Collapse Toggle Button */}
                    <button
                        onClick={toggleSidebar}
                        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm transition-colors hover:bg-zinc-50"
                        aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
                    >
                        {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 text-zinc-600" />
                        ) : (
                            <ChevronLeft className="h-4 w-4 text-zinc-600" />
                        )}
                    </button>
                </motion.aside>
            )}

            {/* ================================================================
                Mobile Header
                ================================================================ */}
            {isMobile && (
                <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/92 px-4 backdrop-blur-xl">
                    {/* Menu Button */}
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="rounded-md p-2 transition-colors hover:bg-zinc-100"
                        aria-label="Abrir menú"
                    >
                        <Menu className="h-6 w-6 text-zinc-700" />
                    </button>

                    {/* Logo */}
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <KargaxLogo variant="lockup" tone="dark" size="sm" />
                    </Link>

                    <div className="flex items-center gap-2">
                        {!isMobile && businessAccess?.warehouses?.length ? (
                            <span className="hidden" />
                        ) : null}
                        <NotificationBell />
                    </div>
                </header>
            )}

            {/* ================================================================
                Mobile Drawer Menu
                ================================================================ */}
            <AnimatePresence>
                {isMobile && isMobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleMobileMenuClose}
                            className="fixed inset-0 z-40 bg-black/64 backdrop-blur-md"
                        />

                        {/* Drawer */}
                        <motion.aside
                            initial="closed"
                            animate="open"
                            exit="closed"
                            variants={mobileMenuVariants}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed left-0 top-0 z-50 flex h-full w-[min(20rem,calc(100vw-1.25rem))] flex-col border-r border-zinc-200 bg-white shadow-xl"
                        >
                            {/* Header */}
                            <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-4">
                                <Link
                                    href="/dashboard"
                                    className="flex items-center gap-2"
                                    onClick={handleMobileMenuClose}
                                >
                                    <KargaxLogo variant="lockup" tone="dark" size="md" />
                                </Link>

                                <button
                                    onClick={handleMobileMenuClose}
                                    className="rounded-md p-2 transition-colors hover:bg-zinc-100"
                                    aria-label="Cerrar menú"
                                >
                                    <X className="h-6 w-6 text-zinc-700" />
                                </button>
                            </div>

                            {/* Navigation */}
                            <WarehouseSelector
                                isCollapsed={false}
                                loading={businessAccessLoading}
                                warehouses={businessAccess?.warehouses || []}
                                activeWarehouseId={businessAccess?.activeWarehouseId || null}
                                onChange={(warehouseId) => {
                                    handleMobileMenuClose();
                                    void handleActiveWarehouseChange(warehouseId);
                                }}
                            />
                            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
                                {navigationItems.map((item) => (
                                    <NavItemComponent
                                        key={item.id}
                                        item={item}
                                        isCollapsed={false}
                                        isActive={currentPath === item.href || currentPath.startsWith(item.href + '/')}
                                        onClick={handleMobileMenuClose}
                                    />
                                ))}

                                <div className="!my-4 border-t border-zinc-200" />

                                {secondaryNavItems.map((item) => (
                                    <NavItemComponent
                                        key={item.id}
                                        item={item}
                                        isCollapsed={false}
                                        isActive={currentPath === item.href}
                                        onClick={handleMobileMenuClose}
                                    />
                                ))}
                            </nav>

                            {/* User Profile */}
                            <UserProfileSection
                                isCollapsed={false}
                                onLogout={handleLogout}
                                visibleRole={visibleRoleLabel}
                                businessName={profileBusinessName}
                                planName={currentPlanName}
                            />

                            {/* Language Selector */}
                            <div className="border-t border-zinc-200 p-4">
                                <LanguageSelector variant="inline" />
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ================================================================
                Main Content Area
                ================================================================ */}
            <main
                className={cn(
                    'min-w-0 flex-1 overflow-x-clip transition-all duration-200',
                    isMobile ? 'pt-16' : '',
                    !isMobile && isCollapsed ? 'ml-20' : '',
                    !isMobile && !isCollapsed ? 'ml-[280px]' : ''
                )}
            >
                {/* Page Header */}
                {showHeader && (
                    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/82 backdrop-blur-xl">
                        <div className="mx-auto flex h-auto min-h-16 max-w-7xl flex-col gap-3 px-3 py-3 min-[380px]:px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
                            {/* Page Title */}
                            <h1 className="kx-route-title min-w-0 text-lg font-semibold leading-tight text-zinc-950 sm:text-xl">
                                {pageTitle || 'Dashboard'}
                            </h1>

                            {/* Header Actions */}
                            <div className="flex w-full min-w-0 flex-wrap items-stretch gap-2 sm:w-auto sm:items-center sm:gap-3 lg:gap-4">
                                {headerActions}

                                {user.userType === 'business' && (businessAccess?.warehouses || []).length > 1 ? (
                                    <div className="hidden min-w-[260px] lg:block">
                                        <Select
                                            value={businessAccess?.activeWarehouseId || ''}
                                            onChange={handleActiveWarehouseChange}
                                            options={(businessAccess?.warehouses || []).map((warehouse) => ({
                                                value: warehouse.id,
                                                label: warehouse.name,
                                                description: `${warehouse.code} · ${warehouse.city}, ${warehouse.department}`,
                                            }))}
                                            placeholder="Bodega activa"
                                            isLoading={businessAccessLoading}
                                        />
                                    </div>
                                ) : null}

                                {/* Desktop Language Selector */}
                                {!isMobile && (
                                    <LanguageSelector />
                                )}
                            </div>
                        </div>
                    </header>
                )}

                {/* Page Content */}
                <div className="mx-auto w-full max-w-7xl min-w-0 px-3 py-4 min-[380px]:px-4 sm:px-6 sm:py-6 lg:px-6 xl:px-8">
                    {children}
                </div>
            </main>
        </div>
    );
}

// =============================================================================
// Default Export
// =============================================================================
export default DashboardLayout;
