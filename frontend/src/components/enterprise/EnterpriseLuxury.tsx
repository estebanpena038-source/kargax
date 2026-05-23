import * as React from 'react';
import { AlertTriangle, CheckCircle2, Circle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'inverse' | 'warning';

export function EnterpriseHero({
    eyebrow,
    title,
    description,
    icon: Icon,
    meta,
    actions,
    className,
}: {
    eyebrow: string;
    title: string;
    description: string;
    icon?: LucideIcon;
    meta?: Array<{ label: string; value: React.ReactNode; detail?: React.ReactNode }>;
    actions?: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('luxury-panel min-w-0 overflow-hidden rounded-lg border border-white/10 p-4 text-white shadow-[0_32px_80px_-52px_rgba(0,0,0,.9)] min-[380px]:p-5 md:p-8', className)}>
            <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 max-w-3xl">
                    <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/70 sm:text-xs sm:tracking-[0.18em]">
                        {Icon ? <Icon className="h-4 w-4" /> : null}
                        <span className="min-w-0 break-words">{eyebrow}</span>
                    </div>
                    <h1 className="text-balance text-2xl font-semibold leading-tight tracking-normal min-[390px]:text-3xl md:text-4xl">
                        {title}
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                        {description}
                    </p>
                </div>

                {(meta?.length || actions) ? (
                    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-none lg:auto-cols-max lg:grid-flow-col lg:items-end">
                        {meta?.map((item) => (
                            <div key={item.label} className="min-w-0 rounded-lg border border-white/15 bg-white/10 px-4 py-3 lg:min-w-[150px]">
                                <p className="text-[0.68rem] uppercase tracking-[0.14em] text-white/50 sm:text-xs sm:tracking-[0.18em]">{item.label}</p>
                                <p className="mt-2 break-words font-money text-xl font-semibold leading-tight text-white min-[390px]:text-2xl">{item.value}</p>
                                {item.detail ? <p className="mt-2 text-xs text-white/60">{item.detail}</p> : null}
                            </div>
                        ))}
                        {actions ? <div className="min-w-0 sm:col-span-2 lg:col-span-1">{actions}</div> : null}
                    </div>
                ) : null}
            </div>
        </section>
    );
}

export function EnterpriseMetric({
    label,
    value,
    detail,
    icon: Icon,
    inverse = false,
    className,
}: {
    label: string;
    value: React.ReactNode;
    detail?: React.ReactNode;
    icon?: LucideIcon;
    inverse?: boolean;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'min-w-0 overflow-hidden rounded-lg border p-4 min-[380px]:p-5',
                inverse
                    ? 'border-white/15 bg-white/10 text-white'
                    : 'border-zinc-200 bg-white text-zinc-950 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]',
                className
            )}
        >
            <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className={cn('text-[0.68rem] font-semibold uppercase tracking-[0.13em] sm:text-xs sm:tracking-[0.16em]', inverse ? 'text-white/50' : 'text-zinc-500')}>
                        {label}
                    </p>
                    <p className={cn('mt-3 break-words font-money text-xl font-semibold leading-tight min-[390px]:text-2xl', inverse ? 'text-white' : 'text-zinc-950')}>
                        {value}
                    </p>
                    {detail ? <p className={cn('mt-2 text-sm leading-5', inverse ? 'text-white/60' : 'text-zinc-500')}>{detail}</p> : null}
                </div>
                {Icon ? (
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md border', inverse ? 'border-white/15 bg-white/10 text-white/70' : 'border-zinc-200 bg-zinc-50 text-zinc-600')}>
                        <Icon className="h-5 w-5" />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export function SectionHeader({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
                {Icon ? (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700">
                        <Icon className="h-5 w-5" />
                    </div>
                ) : null}
                <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-zinc-950">{title}</h2>
                    {description ? <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p> : null}
                </div>
            </div>
            {action ? <div className="w-full min-w-0 md:w-auto">{action}</div> : null}
        </div>
    );
}

export function StatusPill({
    children,
    tone = 'neutral',
    icon,
    className,
}: {
    children: React.ReactNode;
    tone?: Tone;
    icon?: React.ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.11em] sm:text-xs sm:tracking-[0.14em]',
                tone === 'inverse'
                    ? 'border-white/15 bg-white/10 text-white/75'
                    : tone === 'warning'
                        ? 'border-zinc-300 bg-zinc-100 text-zinc-950'
                        : 'border-zinc-200 bg-white text-zinc-700',
                className
            )}
        >
            {icon ?? <Circle className="h-3 w-3" />}
            <span className="min-w-0 break-words">{children}</span>
        </span>
    );
}

export function InlineNotice({
    title,
    description,
    tone = 'neutral',
    action,
    className,
}: {
    title: string;
    description: React.ReactNode;
    tone?: Tone;
    action?: React.ReactNode;
    className?: string;
}) {
    const Icon = tone === 'warning' ? AlertTriangle : CheckCircle2;

    return (
        <div className={cn('min-w-0 overflow-hidden rounded-lg border p-4 min-[380px]:p-5', tone === 'warning' ? 'border-zinc-300 bg-zinc-100' : 'border-zinc-200 bg-white', className)}>
            <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-zinc-950">{title}</p>
                        <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>
                    </div>
                </div>
                {action ? <div className="w-full min-w-0 md:w-auto">{action}</div> : null}
            </div>
        </div>
    );
}

export function UsageMeter({
    label,
    current,
    max,
}: {
    label: string;
    current: number;
    max: number | null;
}) {
    const ratio = max && max > 0 ? Math.min(100, Math.round((current / max) * 100)) : null;

    return (
        <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 min-[380px]:p-5">
            <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-zinc-500 sm:text-xs sm:tracking-[0.16em]">{label}</p>
                    <p className="mt-3 break-words font-money text-2xl font-semibold leading-tight text-zinc-950 min-[390px]:text-3xl">
                        {current}
                        {max !== null ? <span className="text-base font-normal text-zinc-400"> / {max}</span> : <span className="text-base font-normal text-zinc-400"> / sin limite</span>}
                    </p>
                </div>
                {ratio !== null ? <StatusPill>{ratio}%</StatusPill> : <StatusPill>Sin limite</StatusPill>}
            </div>
            {ratio !== null ? (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-zinc-950 transition-all" style={{ width: `${ratio}%` }} />
                </div>
            ) : (
                <div className="mt-4 h-1.5 rounded-full bg-zinc-950" />
            )}
        </div>
    );
}
