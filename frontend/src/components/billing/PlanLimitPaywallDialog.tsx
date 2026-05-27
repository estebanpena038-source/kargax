'use client';

import Link from 'next/link';
import { ArrowRight, LockKeyhole, TrendingUp } from 'lucide-react';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui';
import {
    buildPlanLimitCopy,
    getPlanLabel,
    type PlanLimitErrorDetails,
} from '@/lib/billing/plan-limits';

interface PlanLimitPaywallDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    details: PlanLimitErrorDetails | null;
}

export function PlanLimitPaywallDialog({
    open,
    onOpenChange,
    details,
}: PlanLimitPaywallDialogProps) {
    if (!details) {
        return null;
    }

    const copy = buildPlanLimitCopy(details);
    const recommendedPlan = getPlanLabel(details.recommendedPlan);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="md" className="overflow-hidden p-0">
                <div className="bg-slate-950 px-6 py-5 text-white">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                            <LockKeyhole className="h-5 w-5" />
                        </div>
                        <DialogHeader className="mb-0 space-y-1">
                            <DialogTitle className="text-white">{copy.title}</DialogTitle>
                            <DialogDescription className="text-emerald-50/75">
                                Acceso Operativo y Free conservan tus datos; para crear mas capacidad necesitas plan pago.
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                </div>

                <div className="px-6 py-5">
                    <p className="text-sm leading-6 text-slate-600">{copy.description}</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase text-slate-500">Uso actual</p>
                            <p className="mt-1 text-lg font-bold text-slate-950">{details.currentUsage}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase text-slate-500">Limite</p>
                            <p className="mt-1 text-lg font-bold text-slate-950">{details.limitValue}</p>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                            <p className="text-xs font-semibold uppercase text-emerald-700">Siguiente</p>
                            <p className="mt-1 text-lg font-bold text-emerald-950">{recommendedPlan}</p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="mx-6 mb-6 mt-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Revisar luego
                    </Button>
                    <Button asChild>
                        <Link href={details.checkoutPath || '/planes'}>
                            <TrendingUp className="h-4 w-4" />
                            {copy.actionLabel}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
