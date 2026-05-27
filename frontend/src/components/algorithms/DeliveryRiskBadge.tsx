import { AlertTriangle, CheckCircle2, Siren, TrendingUp } from 'lucide-react';
import type { ComponentType } from 'react';
import { Badge } from '@/components/ui';
import type { AlgorithmRiskLevel } from '@/algorithms/shared/types';

const RISK_META: Record<AlgorithmRiskLevel, {
    label: string;
    className: string;
    icon: ComponentType<{ className?: string }>;
}> = {
    low: {
        label: 'Riesgo bajo',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        icon: CheckCircle2,
    },
    medium: {
        label: 'Riesgo medio',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
        icon: TrendingUp,
    },
    high: {
        label: 'Riesgo alto',
        className: 'border-orange-200 bg-orange-50 text-orange-700',
        icon: AlertTriangle,
    },
    critical: {
        label: 'Riesgo critico',
        className: 'border-red-200 bg-red-50 text-red-700',
        icon: Siren,
    },
};

export function DeliveryRiskBadge({ riskLevel }: { riskLevel: AlgorithmRiskLevel }) {
    const meta = RISK_META[riskLevel];
    const Icon = meta.icon;

    return (
        <Badge variant="outline" size="sm" className={meta.className} icon={<Icon />}>
            {meta.label}
        </Badge>
    );
}
