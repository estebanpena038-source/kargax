'use client';

/* eslint-disable @next/next/no-img-element */

import * as React from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, ImageOff, ShieldAlert, Trash2, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui';
import { SectionHeader } from '@/components/enterprise/EnterpriseLuxury';
import { cn } from '@/lib/utils';

export type WmsTone = 'neutral' | 'strong' | 'muted' | 'critical';

const toneClasses: Record<WmsTone, string> = {
    neutral: 'border-zinc-200 bg-white/90 text-zinc-700',
    strong: 'border-zinc-950 bg-zinc-950 text-white',
    muted: 'border-zinc-200 bg-zinc-50/80 text-zinc-500',
    critical: 'border-zinc-950 bg-white/90 text-zinc-950',
};

export function WmsStatusBadge({
    label,
    tone = 'neutral',
    className,
}: {
    label: string;
    tone?: WmsTone;
    className?: string;
}) {
    return (
        <span className={cn('inline-flex min-w-0 max-w-full items-center rounded-md border px-2 py-0.5 text-left text-[0.64rem] font-semibold uppercase leading-tight tracking-[0.08em] min-[380px]:px-2.5 sm:text-[0.68rem] sm:tracking-[0.12em]', toneClasses[tone], className)}>
            {label}
        </span>
    );
}

export function WmsMetric({
    label,
    value,
    detail,
}: {
    label: string;
    value: string | number;
    detail?: string;
}) {
    return (
        <div className="min-w-0 rounded-lg border border-zinc-200/80 bg-white/90 px-3 py-2.5 shadow-none min-[380px]:px-4">
            <div className="flex min-w-0 items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-[0.64rem] font-semibold uppercase leading-tight tracking-[0.1em] text-zinc-500 sm:text-[0.68rem] sm:tracking-[0.14em]">{label}</p>
                    {detail ? <p className="mt-1 break-words text-xs leading-5 text-zinc-500">{detail}</p> : null}
                </div>
                <p className="shrink-0 truncate font-money text-lg font-semibold leading-none text-zinc-950 min-[380px]:text-xl">{value}</p>
            </div>
        </div>
    );
}

export function WmsEmptyState({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="min-w-0 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 p-4 text-center sm:p-5">
            <CircleDashed className="mx-auto h-5 w-5 text-zinc-500" aria-hidden="true" />
            <p className="mt-2 font-semibold text-zinc-950">{title}</p>
            <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
        </div>
    );
}

export function WmsRiskNotice({
    title,
    description,
    critical,
}: {
    title: string;
    description: string;
    critical?: boolean;
}) {
    const Icon = critical ? ShieldAlert : AlertTriangle;
    return (
        <div className={cn('min-w-0 rounded-lg border bg-white/90 p-3.5', critical ? 'border-zinc-950' : 'border-zinc-200')}>
            <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-950" aria-hidden="true" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-950">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
                </div>
            </div>
        </div>
    );
}

export function WmsTextArea({
    label,
    value,
    onChange,
    placeholder,
    disabled,
    minHeight = 96,
}: {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    minHeight?: number;
}) {
    const inputId = React.useId();

    return (
        <div className="w-full space-y-2">
            {label ? (
                <label htmlFor={inputId} className="block text-sm font-medium text-zinc-700">
                    {label}
                </label>
            ) : null}
            <textarea
                id={inputId}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="min-w-0 w-full rounded-lg border border-zinc-200 bg-white/90 px-3.5 py-2.5 text-sm text-zinc-950 placeholder:text-zinc-400 transition focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-50"
                style={{ minHeight }}
                placeholder={placeholder}
                disabled={disabled}
            />
        </div>
    );
}

export function WmsProgress({
    label,
    value,
    total,
}: {
    label: string;
    value: number;
    total: number;
}) {
    const safeTotal = Math.max(total, 0);
    const percent = safeTotal > 0 ? Math.min(100, Math.max(0, (value / safeTotal) * 100)) : 0;

    return (
        <div className="min-w-0 rounded-lg border border-zinc-200 bg-white/90 p-3.5">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-zinc-950">{label}</p>
                <p className="font-money text-sm text-zinc-500">
                    {value}/{safeTotal}
                </p>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-zinc-950 transition-all" style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}

export function WmsImageThumb({
    src,
    alt,
    caption,
    onDelete,
}: {
    src?: string | null;
    alt: string;
    caption?: string;
    onDelete?: () => void;
}) {
    const [failed, setFailed] = React.useState(false);

    return (
        <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
            <div className="flex aspect-square items-center justify-center bg-zinc-100">
                {src && !failed ? (
                    <img
                        src={src}
                        alt={alt}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={() => setFailed(true)}
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-zinc-400">
                        <ImageOff className="h-6 w-6" aria-hidden="true" />
                        <span className="text-xs">Imagen no disponible</span>
                    </div>
                )}
            </div>
            {(caption || onDelete) ? (
                <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0 truncate text-xs font-medium text-zinc-600">{caption || 'Evidencia'}</span>
                    {onDelete ? (
                        <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-zinc-950 hover:text-zinc-950"
                            aria-label={`Quitar ${caption || 'evidencia'}`}
                            onClick={onDelete}
                        >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export function WmsMetricGrid({
    children,
    dense = false,
    className,
}: {
    children: React.ReactNode;
    dense?: boolean;
    className?: string;
}) {
    return (
        <div className={cn(dense ? 'wms-metric-grid-dense' : 'wms-metric-grid', className)}>
            {children}
        </div>
    );
}

export function WmsPanelGrid({
    children,
    aside = 'default',
    reverse,
    className,
}: {
    children: React.ReactNode;
    aside?: 'default' | 'wide' | 'compact';
    reverse?: boolean;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'wms-panel-grid',
                aside === 'wide' && 'wms-panel-grid-wide',
                aside === 'compact' && 'wms-panel-grid-compact',
                reverse && 'wms-panel-grid-reverse',
                className
            )}
        >
            {children}
        </div>
    );
}

export function WmsCardGrid({
    children,
    compact,
    className,
}: {
    children: React.ReactNode;
    compact?: boolean;
    className?: string;
}) {
    return (
        <div className={cn(compact ? 'wms-card-grid-compact' : 'wms-card-grid', className)}>
            {children}
        </div>
    );
}

export function WmsFleetSection({
    icon,
    title,
    description,
    action,
    children,
    className,
    bodyClassName,
}: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <Card className={cn('kx-enterprise-card min-w-0 overflow-hidden border-zinc-200/80 bg-white/95 p-0 shadow-[0_18px_56px_-46px_rgba(10,10,10,.45)]', className)}>
            <div className="border-b border-zinc-100 px-3.5 py-3 min-[380px]:px-4 sm:px-5 sm:py-4">
                <SectionHeader icon={icon} title={title} description={description} action={action} />
            </div>
            <div className={cn('grid gap-2.5 px-3.5 py-3 min-[380px]:px-4 sm:px-5 sm:py-4', bodyClassName)} role="list">
                {children}
            </div>
        </Card>
    );
}

export function WmsFleetCard({
    identity,
    info,
    darkPanel,
    actions,
    className,
}: {
    identity: React.ReactNode;
    info?: React.ReactNode;
    darkPanel?: React.ReactNode;
    actions?: React.ReactNode;
    columns?: 2 | 3;
    className?: string;
}) {
    return (
        <article className={cn('min-w-0 rounded-lg border border-zinc-200/90 bg-white/95 p-3 shadow-none md:p-3.5', className)} role="listitem">
            <div className="grid min-w-0 gap-2.5">
                {identity}
                {info}
                {darkPanel}
            </div>
            {actions ? (
                <div className="mt-3 border-t border-zinc-100 pt-3">
                    {actions}
                </div>
            ) : null}
        </article>
    );
}

export function WmsFleetIdentity({
    title,
    subtitle,
    eyebrow,
    status,
    activity,
    media,
    className,
}: {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    eyebrow?: React.ReactNode;
    status?: React.ReactNode;
    activity?: React.ReactNode;
    media?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex min-w-0 flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50/80 p-3', className)}>
            <div className="flex min-w-0 gap-3">
                {media ? <div className="w-16 shrink-0 sm:w-[4.5rem]">{media}</div> : null}
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-col gap-2.5">
                        <div className="min-w-0">
                            {eyebrow ? <p className="mb-1 font-money text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{eyebrow}</p> : null}
                            <p className="line-clamp-2 text-base font-semibold leading-snug text-zinc-950 sm:text-[1.05rem]">{title}</p>
                            {subtitle ? <div className="mt-1 text-sm leading-5 text-zinc-500">{subtitle}</div> : null}
                        </div>
                        {status ? <div className="shrink-0">{status}</div> : null}
                    </div>
                </div>
            </div>
            {activity ? <div className="mt-3 font-money text-xs text-zinc-500">{activity}</div> : null}
        </div>
    );
}

export function WmsFleetInfoGrid({
    items,
    children,
    className,
}: {
    items?: Array<{
        label: string;
        value: React.ReactNode;
        detail?: React.ReactNode;
    }>;
    children?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('grid min-w-0 gap-2.5', className)}>
            {items?.map((item) => (
                <WmsFleetInfoItem key={item.label} label={item.label} value={item.value} detail={item.detail} />
            ))}
            {children}
        </div>
    );
}

export function WmsFleetInfoItem({
    label,
    value,
    detail,
    className,
}: {
    label: string;
    value: React.ReactNode;
    detail?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('min-w-0 rounded-lg border border-zinc-200/90 bg-white/95 p-3', className)}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-[11px]">{label}</p>
            <div className="mt-1.5 min-w-0 break-words font-money text-base font-semibold leading-snug text-zinc-950">{value}</div>
            {detail ? <div className="mt-1 text-xs leading-5 text-zinc-500">{detail}</div> : null}
        </div>
    );
}

export function WmsFleetDarkPanel({
    label,
    value,
    detail,
    children,
    className,
}: {
    label: string;
    value: React.ReactNode;
    detail?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('min-w-0 rounded-lg border border-zinc-900 bg-zinc-950 p-3 text-white', className)}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50 sm:text-[11px]">{label}</p>
            <div className="mt-1.5 min-w-0 break-words text-base font-semibold leading-snug text-white">{value}</div>
            {detail ? <div className="mt-1.5 text-sm leading-5 text-white/65">{detail}</div> : null}
            {children ? <div className="mt-3">{children}</div> : null}
        </div>
    );
}

export function WmsEntityGrid({
    children,
    dense,
    compact,
    className,
}: {
    children: React.ReactNode;
    dense?: boolean;
    compact?: boolean;
    className?: string;
}) {
    return (
        <div className={cn(dense ? 'wms-entity-grid-dense' : 'wms-entity-grid', compact && 'wms-entity-grid-compact', className)} role="list">
            {children}
        </div>
    );
}

export function WmsEntityCard({
    icon,
    title,
    eyebrow,
    subtitle,
    badges,
    media,
    children,
    actions,
    meta,
    footer,
    critical,
    layout = 'horizontal',
    className,
}: {
    icon?: React.ReactNode;
    title: React.ReactNode;
    eyebrow?: React.ReactNode;
    subtitle?: React.ReactNode;
    badges?: React.ReactNode;
    media?: React.ReactNode;
    children?: React.ReactNode;
    actions?: React.ReactNode;
    meta?: React.ReactNode;
    footer?: React.ReactNode;
    critical?: boolean;
    layout?: 'horizontal' | 'compact';
    className?: string;
}) {
    return (
        <article className={cn('wms-entity-card', layout === 'compact' && 'wms-entity-card-compact', actions && 'wms-entity-card-with-actions', critical && 'wms-entity-card-critical', className)} role="listitem">
            <div className="wms-entity-card-main">
                <div className={cn('wms-entity-card-body', media && 'wms-entity-card-body-with-media')}>
                    {media ? (
                        <div className="wms-entity-card-media">
                            {media}
                        </div>
                    ) : null}
                    <div className="wms-entity-content">
                        <div className="wms-entity-heading">
                            {icon ? (
                                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-950">
                                    {icon}
                                </span>
                            ) : null}
                            <div className="min-w-0 flex-1">
                                {eyebrow ? (
                                    <p className="mb-1 text-[0.68rem] font-semibold uppercase leading-tight tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.16em]">
                                        {eyebrow}
                                    </p>
                                ) : null}
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <h3 className="min-w-0 break-words text-base font-semibold leading-snug text-zinc-950">
                                        {title}
                                    </h3>
                                    {badges}
                                </div>
                                {subtitle ? (
                                    <div className="mt-2 text-sm leading-5 text-zinc-500">
                                        {subtitle}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                        {meta ? (
                            <div className="wms-entity-meta">
                                {meta}
                            </div>
                        ) : null}
                    </div>
                </div>
                {children ? (
                    <div className="wms-entity-details">
                        {children}
                    </div>
                ) : null}
            </div>
            {actions ? (
                <div className="wms-entity-actions">
                    {actions}
                </div>
            ) : null}
            {footer ? (
                <div className="wms-entity-footer">
                    {footer}
                </div>
            ) : null}
        </article>
    );
}

export function WmsFactStrip({
    items,
    className,
}: {
    items: Array<{
        label: string;
        value: React.ReactNode;
        icon?: React.ReactNode;
        wide?: boolean;
    }>;
    className?: string;
}) {
    if (!items.length) {
        return null;
    }

    return (
        <div className={cn('wms-fact-strip', className)}>
            {items.map((item) => (
                <div key={item.label} className={cn('wms-fact', item.wide && 'wms-fact-wide')}>
                    {item.icon ? <span className="wms-fact-icon">{item.icon}</span> : null}
                    <div className="min-w-0">
                        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                            {item.label}
                        </p>
                        <div className="mt-1 min-w-0 break-words text-sm font-medium leading-5 text-zinc-700">
                            {item.value}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function WmsCompactLines({
    lines,
    maxVisible = 2,
    className,
}: {
    lines: Array<{
        id: string;
        title: React.ReactNode;
        detail?: React.ReactNode;
        meta?: React.ReactNode;
        done?: boolean;
    }>;
    maxVisible?: number;
    className?: string;
}) {
    const [expanded, setExpanded] = React.useState(false);
    const visibleLines = expanded ? lines : lines.slice(0, maxVisible);
    const hiddenCount = Math.max(lines.length - visibleLines.length, 0);

    if (!lines.length) {
        return null;
    }

    return (
        <div className={cn('wms-compact-lines', className)}>
            {visibleLines.map((line, index) => (
                <div key={line.id} className="wms-compact-line">
                    <span className={cn(
                        'wms-compact-line-mark',
                        line.done ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-500'
                    )}>
                        {line.done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-5 text-zinc-950">{line.title}</p>
                        {line.detail ? <div className="truncate text-xs leading-5 text-zinc-500">{line.detail}</div> : null}
                    </div>
                    {line.meta ? (
                        <div className="min-w-0 text-right font-money text-xs leading-5 text-zinc-600">
                            {line.meta}
                        </div>
                    ) : null}
                </div>
            ))}
            {hiddenCount > 0 || expanded ? (
                <button
                    type="button"
                    className="wms-compact-lines-toggle"
                    onClick={() => setExpanded((current) => !current)}
                >
                    {expanded ? 'Ver menos' : `Ver ${hiddenCount} mas`}
                </button>
            ) : null}
        </div>
    );
}

export function WmsActionRow({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('wms-action-row', className)}>
            {children}
        </div>
    );
}

export function WmsCompletionMark({ done }: { done: boolean }) {
    return (
        <span className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md border',
            done ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-400'
        )}>
            {done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <CircleDashed className="h-4 w-4" aria-hidden="true" />}
        </span>
    );
}
