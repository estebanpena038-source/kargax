import { BadgeCheck, FileWarning, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { ComponentType } from 'react';
import { Badge } from '@/components/ui';
import type { EvidenceQualityStatus } from '@/algorithms/shared/types';

const STATUS_META: Record<EvidenceQualityStatus, {
    label: string;
    className: string;
    icon: ComponentType<{ className?: string }>;
}> = {
    complete: {
        label: 'POD completo',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        icon: ShieldCheck,
    },
    incomplete: {
        label: 'POD incompleto',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
        icon: FileWarning,
    },
    suspicious: {
        label: 'POD por revisar',
        className: 'border-orange-200 bg-orange-50 text-orange-700',
        icon: BadgeCheck,
    },
    blocked: {
        label: 'POD bloqueado',
        className: 'border-red-200 bg-red-50 text-red-700',
        icon: ShieldAlert,
    },
};

export function EvidenceQualityBadge({ status }: { status: EvidenceQualityStatus }) {
    const meta = STATUS_META[status];
    const Icon = meta.icon;

    return (
        <Badge variant="outline" size="sm" className={meta.className} icon={<Icon />}>
            {meta.label}
        </Badge>
    );
}
