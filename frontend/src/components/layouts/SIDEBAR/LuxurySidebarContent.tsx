'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, LogOut, Sparkles } from 'lucide-react';
import { KargaxLogo, Select } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import { useAuthStore } from '@/features/auth/store/authStore';
import { cn } from '@/lib/utils';
import type { WarehouseAccessResponse } from '@/lib/warehouses/types';
import {
    SIDEBAR_SECTION_META,
    SIDEBAR_SECTION_ORDER,
} from './navigation';
import type { NavItem, SidebarSectionKey } from './types';

interface WarehouseSelectorProps {
    isCollapsed: boolean;
    loading: boolean;
    warehouses: WarehouseAccessResponse['warehouses'];
    activeWarehouseId: string | null;
    onChange: (warehouseId: string) => void | Promise<void>;
}

interface UserProfileSectionProps {
    isCollapsed: boolean;
    onLogout: () => void;
    visibleRole?: string | null;
    businessName?: string | null;
    planName?: string | null;
}

interface LuxurySidebarContentProps {
    variant: 'desktop' | 'mobile';
    isCollapsed: boolean;
    currentPath: string;
    navigationItems: NavItem[];
    secondaryNavItems: NavItem[];
    businessAccessLoading: boolean;
    warehouses: WarehouseAccessResponse['warehouses'];
    activeWarehouseId: string | null;
    onWarehouseChange: (warehouseId: string) => void | Promise<void>;
    onLogout: () => void;
    onNavigate?: () => void;
    onToggleCollapse?: () => void;
    visibleRole?: string | null;
    businessName?: string | null;
    planName?: string | null;
    footerSlot?: React.ReactNode;
}

function translateLabel(t: (key: string) => string, item: NavItem) {
    const translated = t(item.labelKey);
    return translated && translated !== item.labelKey ? translated : item.fallbackLabel;
}

function getInitials(name: string) {
    const cleanName = name.trim() || 'KargaX';

    return cleanName
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

function isActiveRoute(currentPath: string, item: NavItem) {
    if (['home', 'offers-browse', 'warehouse-overview'].includes(item.id)) {
        return currentPath === item.href;
    }

    return currentPath === item.href || currentPath.startsWith(`${item.href}/`);
}

const SidebarNavItem = React.memo(function SidebarNavItem({
    item,
    isCollapsed,
    isActive,
    onClick,
    layoutIdPrefix,
}: {
    item: NavItem;
    isCollapsed: boolean;
    isActive: boolean;
    onClick?: () => void;
    layoutIdPrefix: string;
}) {
    const { t } = useTranslation();
    const Icon = item.icon;
    const label = translateLabel(t, item);
    const hasBadge = Boolean(item.badge && item.badge > 0);

    const link = (
        <Link
            href={item.href}
            onClick={onClick}
            title={isCollapsed ? label : undefined}
            aria-label={isCollapsed ? label : undefined}
            className={cn(
                'group relative flex min-h-12 items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5',
                'transition-[background,color,box-shadow,transform] duration-200 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/20',
                isCollapsed ? 'justify-center px-2' : 'justify-start',
                isActive
                    ? 'bg-zinc-950 text-white shadow-[0_24px_60px_-36px_rgba(0,0,0,.95)]'
                    : 'text-zinc-600 hover:-translate-y-0.5 hover:bg-white hover:text-zinc-950 hover:shadow-[0_18px_40px_-34px_rgba(0,0,0,.75)]'
            )}
            aria-current={isActive ? 'page' : undefined}
        >
            {isActive ? (
                <motion.span
                    layoutId={`${layoutIdPrefix}-active-nav`}
                    className="absolute inset-0 rounded-2xl bg-zinc-950"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
            ) : null}

            <span
                className={cn(
                    'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
                    isActive
                        ? 'border-white/15 bg-white/10 text-white'
                        : 'border-zinc-200/80 bg-zinc-50 text-zinc-500 group-hover:border-zinc-200 group-hover:bg-zinc-950 group-hover:text-white'
                )}
            >
                <Icon className="h-4 w-4" aria-hidden="true" />
            </span>

            <AnimatePresence initial={false}>
                {!isCollapsed ? (
                    <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        className="relative z-10 min-w-0 flex-1"
                    >
                        <span className="block truncate text-sm font-semibold leading-5">{label}</span>
                        {item.description ? (
                            <span
                                className={cn(
                                    'mt-0.5 block truncate text-[11px] leading-4',
                                    isActive ? 'text-white/55' : 'text-zinc-400 group-hover:text-zinc-500'
                                )}
                            >
                                {item.description}
                            </span>
                        ) : null}
                    </motion.span>
                ) : null}
            </AnimatePresence>

            {hasBadge && !isCollapsed ? (
                <span
                    className={cn(
                        'relative z-10 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                        isActive ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white'
                    )}
                >
                    {item.badge && item.badge > 99 ? '99+' : item.badge}
                </span>
            ) : null}

            {hasBadge && isCollapsed ? (
                <span className="absolute right-2 top-2 z-10 h-2.5 w-2.5 rounded-full bg-zinc-950 ring-2 ring-white" />
            ) : null}
        </Link>
    );

    return link;
});

function NavigationSection({
    sectionKey,
    items,
    isCollapsed,
    currentPath,
    onNavigate,
    layoutIdPrefix,
}: {
    sectionKey: SidebarSectionKey;
    items: NavItem[];
    isCollapsed: boolean;
    currentPath: string;
    onNavigate?: () => void;
    layoutIdPrefix: string;
}) {
    if (items.length === 0) {
        return null;
    }

    const meta = SIDEBAR_SECTION_META[sectionKey];

    return (
        <section className="space-y-2" aria-label={meta.title}>
            {isCollapsed ? (
                <div className="flex justify-center py-1" title={meta.title} aria-label={meta.title}>
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                </div>
            ) : (
                <div className="px-2 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                        {meta.title}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-zinc-400">{meta.description}</p>
                </div>
            )}

            <div className="space-y-1.5">
                {items.map((item) => (
                    <SidebarNavItem
                        key={item.id}
                        item={item}
                        isCollapsed={isCollapsed}
                        isActive={isActiveRoute(currentPath, item)}
                        onClick={onNavigate}
                        layoutIdPrefix={layoutIdPrefix}
                    />
                ))}
            </div>
        </section>
    );
}

const WarehouseSelector = React.memo(function WarehouseSelector({
    isCollapsed,
    loading,
    warehouses,
    activeWarehouseId,
    onChange,
}: WarehouseSelectorProps) {
    if (warehouses.length === 0 || isCollapsed) {
        return null;
    }

    return (
        <div className="px-4 py-3">
            <div className="rounded-3xl border border-zinc-200/80 bg-white/75 p-3 shadow-[0_20px_50px_-42px_rgba(0,0,0,.88)] backdrop-blur-xl">
                <Select
                    label="Bodega activa"
                    value={activeWarehouseId || ''}
                    onChange={onChange}
                    isLoading={loading}
                    options={warehouses.map((warehouse) => ({
                        value: warehouse.id,
                        label: warehouse.name,
                        description: `${warehouse.code} - ${warehouse.city}, ${warehouse.department}`,
                    }))}
                    placeholder="Selecciona una bodega"
                />
            </div>
        </div>
    );
});

const UserProfileSection = React.memo(function UserProfileSection({
    isCollapsed,
    onLogout,
    visibleRole,
    businessName,
    planName,
}: UserProfileSectionProps) {
    const { user } = useAuthStore();
    const { t } = useTranslation();

    if (!user) return null;

    const fullName = user.fullName || 'Usuario KargaX';
    const userTypeLabel = visibleRole || {
        trucker: t('nav.userType.trucker') || 'Transportador',
        business: t('nav.userType.business') || 'Empresa',
        admin: 'CEO KargaX',
        staff: 'Staff KargaX',
    }[user.userType];

    return (
        <div className={cn('border-t border-zinc-200/70 p-3', isCollapsed ? 'px-2' : 'px-4')}>
            <div
                className={cn(
                    'rounded-3xl border border-zinc-200/80 bg-white/75 p-2 shadow-[0_22px_60px_-44px_rgba(0,0,0,.8)]',
                    isCollapsed && 'rounded-2xl'
                )}
            >
                <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center')}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-sm font-semibold text-white shadow-[0_18px_40px_-26px_rgba(0,0,0,.9)]">
                        {getInitials(fullName)}
                    </div>

                    {!isCollapsed ? (
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-zinc-950">{fullName}</p>
                            <p className="truncate text-xs text-zinc-500">{userTypeLabel}</p>
                            <p className="truncate text-[11px] text-zinc-400">
                                {businessName || (user.userType === 'admin' || user.userType === 'staff' ? 'KargaX Plataforma' : 'Cuenta personal')}
                            </p>
                            {planName ? (
                                <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                    {planName}
                                </p>
                            ) : null}
                        </div>
                    ) : null}

                    {!isCollapsed ? (
                        <button
                            onClick={onLogout}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-950 hover:text-white"
                            title={t('nav.logout') || 'Cerrar sesion'}
                            aria-label={t('nav.logout') || 'Cerrar sesion'}
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    ) : null}
                </div>

                {isCollapsed ? (
                    <button
                        onClick={onLogout}
                        className="mt-2 flex w-full items-center justify-center rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-950 hover:text-white"
                        title={t('nav.logout') || 'Cerrar sesion'}
                        aria-label={t('nav.logout') || 'Cerrar sesion'}
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                ) : null}
            </div>
        </div>
    );
});

function SidebarPresenceCard({ isCollapsed, planName }: { isCollapsed: boolean; planName?: string | null }) {
    if (isCollapsed) {
        return (
            <div className="mx-2 my-3 flex justify-center rounded-2xl border border-zinc-200/80 bg-white/70 py-3">
                <Sparkles className="h-4 w-4 text-zinc-500" />
            </div>
        );
    }

    return (
        <div className="px-4 py-4">
            <div className="overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white/75 p-4 shadow-[0_28px_80px_-52px_rgba(0,0,0,.9)] backdrop-blur-xl">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    KargaX Command
                </div>
                <p className="mt-3 text-sm font-semibold leading-5 text-zinc-950">
                    Control logistico premium, sin ruido operativo.
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                    {planName || 'Operacion, marketplace y evidencia separados.'}
                </p>
            </div>
        </div>
    );
}

export function LuxurySidebarContent({
    variant,
    isCollapsed,
    currentPath,
    navigationItems,
    secondaryNavItems,
    businessAccessLoading,
    warehouses,
    activeWarehouseId,
    onWarehouseChange,
    onLogout,
    onNavigate,
    onToggleCollapse,
    visibleRole,
    businessName,
    planName,
    footerSlot,
}: LuxurySidebarContentProps) {
    const layoutIdPrefix = variant === 'desktop' ? 'kx-desktop-sidebar' : 'kx-mobile-sidebar';
    const groupedItems = React.useMemo(() => {
        return SIDEBAR_SECTION_ORDER.map((sectionKey) => ({
            sectionKey,
            items: navigationItems.filter((item) => (item.section || 'operations') === sectionKey),
        }));
    }, [navigationItems]);

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,.98),rgba(246,246,244,.92))]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,.95),transparent_62%)]" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-white/70" />

            <div
                className={cn(
                    'relative z-10 flex h-[4.5rem] items-center border-b border-zinc-200/70 px-4',
                    isCollapsed ? 'justify-center px-2' : 'justify-between gap-3'
                )}
            >
                <Link href="/dashboard" onClick={onNavigate} className="flex min-w-0 items-center gap-2">
                    <KargaxLogo variant={isCollapsed ? 'mark' : 'lockup'} tone="dark" size={variant === 'mobile' ? 'md' : 'sm'} />
                </Link>
            </div>

            <SidebarPresenceCard isCollapsed={isCollapsed} planName={planName} />

            <WarehouseSelector
                isCollapsed={isCollapsed}
                loading={businessAccessLoading}
                warehouses={warehouses}
                activeWarehouseId={activeWarehouseId}
                onChange={onWarehouseChange}
            />

            <nav className="relative z-10 flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-1">
                {groupedItems.map(({ sectionKey, items }) => (
                    <NavigationSection
                        key={sectionKey}
                        sectionKey={sectionKey}
                        items={items}
                        isCollapsed={isCollapsed}
                        currentPath={currentPath}
                        onNavigate={onNavigate}
                        layoutIdPrefix={layoutIdPrefix}
                    />
                ))}

                <NavigationSection
                    sectionKey="support"
                    items={secondaryNavItems}
                    isCollapsed={isCollapsed}
                    currentPath={currentPath}
                    onNavigate={onNavigate}
                    layoutIdPrefix={layoutIdPrefix}
                />
            </nav>

            {footerSlot ? (
                <div className="relative z-10 border-t border-zinc-200/70 px-4 py-3">{footerSlot}</div>
            ) : null}

            <UserProfileSection
                isCollapsed={isCollapsed}
                onLogout={onLogout}
                visibleRole={visibleRole}
                businessName={businessName}
                planName={planName}
            />

            {variant === 'desktop' && onToggleCollapse ? (
                <button
                    onClick={onToggleCollapse}
                    className="absolute -right-3 top-20 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-[0_16px_40px_-24px_rgba(0,0,0,.8)] transition hover:-translate-y-0.5 hover:text-zinc-950"
                    aria-label={isCollapsed ? 'Expandir menu' : 'Colapsar menu'}
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
            ) : null}
        </div>
    );
}

export default LuxurySidebarContent;
