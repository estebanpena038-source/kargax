'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
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
import { LuxurySidebarContent } from './SIDEBAR/LuxurySidebarContent';
import {
    getNavigationItems,
    getSecondaryNavItems,
    getWarehouseScopedNavigation,
    SIDEBAR_COLLAPSED_WIDTH,
    SIDEBAR_EXPANDED_WIDTH,
    SIDEBAR_STATE_KEY,
} from './SIDEBAR/navigation';

interface DashboardLayoutProps {
    children: React.ReactNode;
    pageTitle?: string;
    showHeader?: boolean;
    headerActions?: React.ReactNode;
}

type BusinessWarehouseRole = WarehouseRole | null;
type StaffAccessState = {
    roles: string[];
    capabilities: string[];
    actorRole: string | null;
};

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

const MOBILE_BREAKPOINT = 1024;
const isDashboardDebugLoggingEnabled = process.env.NODE_ENV !== 'production';

function dashboardDebugLog(...args: unknown[]) {
    if (isDashboardDebugLoggingEnabled) {
        console.log(...args);
    }
}

const sidebarVariants = {
    expanded: { width: SIDEBAR_EXPANDED_WIDTH },
    collapsed: { width: SIDEBAR_COLLAPSED_WIDTH },
};

const mobileMenuVariants = {
    open: { x: 0, opacity: 1 },
    closed: { x: -340, opacity: 0 },
};

function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        checkMobile();

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

function useSidebarState(): [boolean, (collapsed: boolean) => void] {
    const [isCollapsed, setIsCollapsed] = React.useState(false);

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

export function DashboardLayout({
    children,
    pageTitle,
    showHeader = true,
    headerActions,
}: DashboardLayoutProps) {
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
    const [staffAccess, setStaffAccess] = React.useState<StaffAccessState | null>(null);

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

            if (cancelled) return;

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

    const totalUnreadCount = useNotificationStore(selectUnreadCount);
    const applicationsCount = useNotificationStore(selectApplicationsCount);
    const applicationUpdatesCount = useNotificationStore(selectApplicationUpdatesCount);
    const acceptedJobsCount = useNotificationStore(selectAcceptedJobsCount);
    const initializeNotifications = useNotificationStore((state) => state.initialize);
    const cleanupNotifications = useNotificationStore((state) => state.cleanup);

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

        const loadStaffAccess = async () => {
            if (!user || !['staff', 'admin'].includes(user.userType)) {
                setStaffAccess(null);
                return;
            }

            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) {
                    if (!cancelled) setStaffAccess(null);
                    return;
                }

                const response = await fetch('/api/staff/me', {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                });
                const payload = await response.json().catch(() => null);

                if (!cancelled && response.ok) {
                    setStaffAccess({
                        roles: Array.isArray(payload?.data?.roles) ? payload.data.roles : [],
                        capabilities: Array.isArray(payload?.data?.capabilities) ? payload.data.capabilities : [],
                        actorRole: typeof payload?.data?.actorRole === 'string' ? payload.data.actorRole : null,
                    });
                }

                if (!cancelled && !response.ok) {
                    setStaffAccess(null);
                }
            } catch {
                if (!cancelled) {
                    setStaffAccess(null);
                }
            }
        };

        void loadStaffAccess();

        return () => {
            cancelled = true;
        };
    }, [user?.id, user?.userType, user]);

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
                if (!capabilities) return true;

                if (item.id === 'warehouse-docks') return capabilities.manageDocks;
                if (item.id === 'warehouse-inventory') return capabilities.viewOperationalDetail;
                if (item.id === 'warehouse-receipts') return capabilities.manageReceipts || capabilities.viewOperationalDetail;
                if (item.id === 'warehouse-picking') return capabilities.manageDispatches || capabilities.manageTasks || capabilities.viewOperationalDetail;
                if (item.id === 'warehouse-dispatches') return capabilities.manageDispatches || capabilities.viewOperationalDetail;
                if (item.id === 'warehouse-incidents') return capabilities.manageIncidents || capabilities.viewEvidence;
                if (item.id === 'warehouse-analytics') return capabilities.exportData || businessAccess.canViewIntelligence;
                if (item.id === 'margin-control') return businessAccess.canViewFinance || businessAccess.canViewOperations || businessAccess.canViewIntelligence;

                return true;
            });
        }

        return getNavigationItems(user.userType, counts, canAccessCeo)
            .filter((item) => !item.allowedUserTypes || item.allowedUserTypes.includes(user.userType))
            .filter((item) => {
                if (item.id === 'offers-browse' && user.userType === 'trucker') {
                    return !privateFleetContextLoading && !privateFleetContext?.isPrivateFleetDriver;
                }

                if (item.id === 'my-applications' && user.userType === 'trucker' && privateFleetContext?.isPrivateFleetDriver) {
                    return false;
                }

                if (item.id === 'plans') {
                    if (user.userType === 'admin') return true;
                    if (user.userType !== 'business') return false;
                    return businessAccess ? businessAccess.canManageBilling : true;
                }

                if (item.id === 'team') {
                    if (user.userType === 'admin') return true;
                    if (user.userType !== 'business') return false;
                    return businessAccess ? businessAccess.canManageTeam : true;
                }

                if (item.id === 'corporate') {
                    if (user.userType === 'admin') return true;
                    if (user.userType !== 'business') return false;
                    return businessAccess ? Boolean(businessAccess.holdingAccountId) : false;
                }

                if (item.id === 'offers-publish') {
                    return user.userType === 'admin' || (businessAccess ? businessAccess.canCreateMarketplaceOffers : true);
                }

                if (item.id === 'my-offers' || item.id === 'received-applications' || item.id === 'pod-marketplace') {
                    return user.userType === 'admin' || (businessAccess ? businessAccess.canViewOperations : true);
                }

                if (item.id === 'private-fleet') {
                    if (user.userType === 'trucker') return false;
                    return user.userType === 'admin' || (businessAccess ? (businessAccess.canManagePrivateFleet || businessAccess.canViewFinance) : true);
                }

                if (item.id === 'business-intelligence') {
                    return user.userType === 'admin' || (businessAccess ? businessAccess.canViewIntelligence : true);
                }

                if (item.id === 'margin-control') {
                    return user.userType === 'admin' || user.userType === 'business';
                }

                if (item.id === 'warehouses') {
                    return user.userType === 'admin' || (businessAccess ? Boolean(businessAccess.capabilities?.viewWarehouseSummary) : true);
                }

                if (item.id === 'admin') {
                    return canAccessCeo;
                }

                if (item.id === 'staff-support') {
                    return Boolean(
                        canAccessCeo
                        || staffAccess?.capabilities.some((capability) => capability.startsWith('support:'))
                    );
                }

                if (item.id === 'staff-payouts') {
                    return Boolean(
                        canAccessCeo
                        || staffAccess?.capabilities.some((capability) => capability.startsWith('payout:'))
                    );
                }

                return true;
            })
            .map((item) => {
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
        staffAccess?.capabilities,
    ]);

    const secondaryNavItems = React.useMemo(() => getSecondaryNavItems(), []);

    const visibleRoleLabel = React.useMemo(() => {
        if (!user) return null;

        if (user.userType === 'trucker' && privateFleetContext?.isPrivateFleetDriver) {
            return 'Transportista privado';
        }

        if (user.userType !== 'business' || !businessAccess?.role) {
            if (user.userType === 'staff') {
                const role = staffAccess?.actorRole || staffAccess?.roles[0] || null;
                if (role === 'support_agent') return 'Soporte KargaX';
                if (role === 'support_lead') return 'Lider soporte KargaX';
                if (role === 'payout_reviewer') return 'Revision pagos KargaX';
                if (role === 'payout_approver') return 'Pagos KargaX';
                if (role === 'ops_manager') return 'Operacion KargaX';
                return 'Staff KargaX';
            }

            if (user.userType === 'admin') {
                return 'CEO KargaX';
            }

            return null;
        }

        if (businessAccess.role === 'admin') {
            return 'Admin';
        }

        return getBusinessRoleLabel(businessAccess.role);
    }, [businessAccess?.role, privateFleetContext?.isPrivateFleetDriver, staffAccess?.actorRole, staffAccess?.roles, user]);

    const profileBusinessName = React.useMemo(() => {
        if (!user) return null;

        if (user.userType === 'trucker') {
            if (privateFleetContextLoading) return 'Verificando flota';

            if (privateFleetContext?.isPrivateFleetDriver) {
                return privateFleetContext.businessName
                    ? `Empresa: ${privateFleetContext.businessName}`
                    : 'Flota privada';
            }

            return null;
        }

        return businessAccess?.businessName || null;
    }, [businessAccess?.businessName, privateFleetContext?.businessName, privateFleetContext?.isPrivateFleetDriver, privateFleetContextLoading, user]);

    const currentPlanName = React.useMemo(() => {
        const entitlementState = businessAccess?.limits?.entitlementState;
        const pilotDaysRemaining = businessAccess?.limits?.pilotDaysRemaining;

        if (entitlementState === 'pilot_active') {
            return typeof pilotDaysRemaining === 'number'
                ? `Acceso Operativo - ${pilotDaysRemaining} dias`
                : 'Acceso Operativo';
        }

        if (entitlementState === 'pilot_expired' && !businessAccess?.subscription?.plan_code) {
            return 'Free - Acceso Operativo finalizado';
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

    const handleLogout = React.useCallback(async () => {
        try {
            await signOut();
            toast.success('Sesion cerrada', 'Has cerrado sesion correctamente');
            router.push('/login');
        } catch {
            toast.error('Error', 'No se pudo cerrar la sesion');
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

    React.useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    React.useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isMobileMenuOpen]);

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

    return (
        <div className="flex min-h-screen min-w-0 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,.95),transparent_38%),linear-gradient(135deg,#f7f7f5_0%,#efefec_100%)] text-zinc-950">
            {!isMobile ? (
                <motion.aside
                    initial={false}
                    animate={isCollapsed ? 'collapsed' : 'expanded'}
                    variants={sidebarVariants}
                    transition={{ duration: 0.24, ease: 'easeInOut' }}
                    className="fixed left-0 top-0 z-30 flex h-full flex-col border-r border-white/70 shadow-[24px_0_80px_-64px_rgba(0,0,0,.9)]"
                >
                    <LuxurySidebarContent
                        variant="desktop"
                        isCollapsed={isCollapsed}
                        currentPath={currentPath}
                        navigationItems={navigationItems}
                        secondaryNavItems={secondaryNavItems}
                        businessAccessLoading={businessAccessLoading}
                        warehouses={businessAccess?.warehouses || []}
                        activeWarehouseId={businessAccess?.activeWarehouseId || null}
                        onWarehouseChange={handleActiveWarehouseChange}
                        onLogout={handleLogout}
                        onToggleCollapse={toggleSidebar}
                        visibleRole={visibleRoleLabel}
                        businessName={profileBusinessName}
                        planName={currentPlanName}
                    />
                </motion.aside>
            ) : null}

            {isMobile ? (
                <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/70 bg-white/80 px-4 shadow-[0_18px_50px_-42px_rgba(0,0,0,.8)] backdrop-blur-2xl">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:text-zinc-950"
                        aria-label="Abrir menu"
                    >
                        <Menu className="h-5 w-5" />
                    </button>

                    <Link href="/dashboard" className="flex items-center gap-2">
                        <KargaxLogo variant="lockup" tone="dark" size="sm" />
                    </Link>

                    <NotificationBell />
                </header>
            ) : null}

            <AnimatePresence>
                {isMobile && isMobileMenuOpen ? (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleMobileMenuClose}
                            className="fixed inset-0 z-40 bg-zinc-950/62 backdrop-blur-md"
                        />

                        <motion.aside
                            initial="closed"
                            animate="open"
                            exit="closed"
                            variants={mobileMenuVariants}
                            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                            className="fixed left-0 top-0 z-50 flex h-full w-[min(20rem,calc(100vw-1.25rem))] flex-col overflow-hidden rounded-r-[2rem] border-r border-white/70 bg-white shadow-[32px_0_100px_-62px_rgba(0,0,0,.95)]"
                        >
                            <button
                                onClick={handleMobileMenuClose}
                                className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-2xl border border-zinc-200 bg-white/90 text-zinc-500 shadow-sm transition hover:text-zinc-950"
                                aria-label="Cerrar menu"
                            >
                                <X className="h-4 w-4" />
                            </button>

                            <LuxurySidebarContent
                                variant="mobile"
                                isCollapsed={false}
                                currentPath={currentPath}
                                navigationItems={navigationItems}
                                secondaryNavItems={secondaryNavItems}
                                businessAccessLoading={businessAccessLoading}
                                warehouses={businessAccess?.warehouses || []}
                                activeWarehouseId={businessAccess?.activeWarehouseId || null}
                                onWarehouseChange={(warehouseId) => {
                                    handleMobileMenuClose();
                                    void handleActiveWarehouseChange(warehouseId);
                                }}
                                onLogout={handleLogout}
                                onNavigate={handleMobileMenuClose}
                                visibleRole={visibleRoleLabel}
                                businessName={profileBusinessName}
                                planName={currentPlanName}
                                footerSlot={<LanguageSelector variant="inline" />}
                            />
                        </motion.aside>
                    </>
                ) : null}
            </AnimatePresence>

            <main
                className={cn(
                    'min-w-0 flex-1 overflow-x-clip transition-[margin,padding] duration-200',
                    isMobile ? 'pt-16' : '',
                    !isMobile && isCollapsed ? 'ml-[88px]' : '',
                    !isMobile && !isCollapsed ? 'ml-[304px]' : ''
                )}
            >
                {showHeader ? (
                    <header className="sticky top-0 z-20 border-b border-white/70 bg-white/72 shadow-[0_18px_55px_-48px_rgba(0,0,0,.75)] backdrop-blur-2xl">
                        <div className="mx-auto flex min-h-[4.5rem] max-w-7xl flex-col gap-3 px-3 py-3 min-[380px]:px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">KargaX Command</p>
                                <h1 className="mt-1 min-w-0 text-xl font-semibold leading-tight text-zinc-950 sm:text-2xl">
                                    {pageTitle || 'Centro operativo'}
                                </h1>
                            </div>

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
                                                description: `${warehouse.code} - ${warehouse.city}, ${warehouse.department}`,
                                            }))}
                                            placeholder="Bodega activa"
                                            isLoading={businessAccessLoading}
                                        />
                                    </div>
                                ) : null}

                                {!isMobile ? <LanguageSelector /> : null}
                            </div>
                        </div>
                    </header>
                ) : null}

                <div className="mx-auto w-full max-w-7xl min-w-0 px-3 py-4 min-[380px]:px-4 sm:px-6 sm:py-6 lg:px-6 xl:px-8">
                    {children}
                </div>
            </main>
        </div>
    );
}

export default DashboardLayout;
