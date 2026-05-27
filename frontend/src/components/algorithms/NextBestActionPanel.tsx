import { ArrowRight, ListChecks } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { SectionHeader, StatusPill } from '@/components/enterprise/EnterpriseLuxury';
import type { NextBestAction } from '@/algorithms/shared/types';

const PRIORITY_CLASS: Record<NextBestAction['priority'], string> = {
    P0: 'border-red-200 bg-red-50 text-red-700',
    P1: 'border-amber-200 bg-amber-50 text-amber-700',
    P2: 'border-zinc-200 bg-zinc-50 text-zinc-600',
};

export function NextBestActionPanel({ actions }: { actions: NextBestAction[] }) {
    return (
        <Card className="kx-enterprise-card p-4 min-[380px]:p-5">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <SectionHeader
                    icon={ListChecks}
                    title="Proxima mejor accion"
                    description="Acciones operativas calculadas por rol. No ejecutan pagos ni cierres automaticos."
                />
                <StatusPill>{actions.length} pendientes</StatusPill>
            </div>

            {actions.length === 0 ? (
                <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                    Sin acciones criticas para este periodo.
                </p>
            ) : (
                <div className="mt-4 space-y-3">
                    {actions.slice(0, 5).map((action) => (
                        <div key={action.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${PRIORITY_CLASS[action.priority]}`}>
                                            {action.priority}
                                        </span>
                                        <span className="font-money text-xs font-semibold uppercase text-zinc-500">
                                            {action.rail === 'private_fleet' ? 'Flota privada' : 'Marketplace'}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-sm font-bold text-zinc-950">{action.title}</p>
                                    <p className="mt-1 text-sm leading-6 text-zinc-600">{action.description}</p>
                                    <p className="mt-2 text-xs text-zinc-500">{action.reason}</p>
                                </div>
                                <Button asChild variant="outline" size="sm" className="shrink-0">
                                    <a href={action.href}>
                                        {action.actionLabel}
                                        <ArrowRight className="h-4 w-4" />
                                    </a>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
