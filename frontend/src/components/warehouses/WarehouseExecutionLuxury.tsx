'use client';

/* eslint-disable @next/next/no-img-element */

import * as React from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, ImageOff, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WmsTone = 'neutral' | 'strong' | 'muted' | 'critical';

const toneClasses: Record<WmsTone, string> = {
    neutral: 'border-zinc-200 bg-white text-zinc-700',
    strong: 'border-zinc-950 bg-zinc-950 text-white',
    muted: 'border-zinc-200 bg-zinc-50 text-zinc-500',
    critical: 'border-zinc-950 bg-white text-zinc-950 shadow-[inset_4px_0_0_#09090b]',
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
        <span className={cn('inline-flex max-w-full items-center rounded-md border px-2 py-1 text-[0.68rem] font-semibold uppercase leading-tight tracking-[0.08em] min-[380px]:px-2.5 sm:text-xs sm:tracking-[0.14em]', toneClasses[tone], className)}>
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
        <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 min-[380px]:px-4">
            <p className="text-[0.68rem] font-semibold uppercase leading-tight tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.16em]">{label}</p>
            <p className="mt-2 truncate font-money text-xl font-semibold leading-none text-zinc-950 min-[380px]:text-2xl">{value}</p>
            {detail ? <p className="mt-2 text-xs text-zinc-500">{detail}</p> : null}
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
        <div className="min-w-0 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center sm:p-8">
            <CircleDashed className="mx-auto h-5 w-5 text-zinc-500" aria-hidden="true" />
            <p className="mt-3 font-semibold text-zinc-950">{title}</p>
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
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
        <div className={cn('min-w-0 rounded-lg border bg-white p-4', critical ? 'border-zinc-950 shadow-[inset_4px_0_0_#09090b]' : 'border-zinc-200')}>
            <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-950" aria-hidden="true" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-950">{title}</p>
                    <p className="mt-1 text-sm text-zinc-500">{description}</p>
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
                className="min-w-0 w-full rounded-lg border border-zinc-200 bg-white/90 px-4 py-3 text-base text-zinc-950 placeholder:text-zinc-400 transition focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-50"
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
        <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-zinc-950">{label}</p>
                <p className="font-money text-sm text-zinc-500">
                    {value}/{safeTotal}
                </p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
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
                    <span className="truncate text-xs font-medium text-zinc-600">{caption || 'Evidencia'}</span>
                    {onDelete ? (
                        <button
                            type="button"
                            className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 transition hover:border-zinc-950 hover:text-zinc-950"
                            onClick={onDelete}
                        >
                            Quitar
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
