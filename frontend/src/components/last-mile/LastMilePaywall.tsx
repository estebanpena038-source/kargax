'use client';

import Link from 'next/link';
import { Lock, ShieldCheck } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import type { LastMileAccess } from '@/lib/last-mile/types';

interface LastMilePaywallProps {
    message?: string | null;
    access?: LastMileAccess | null;
}

export function LastMilePaywall({ message, access }: LastMilePaywallProps) {
    return (
        <Card className="overflow-hidden border-zinc-200 bg-white">
            <div className="grid min-h-[360px] gap-0 lg:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-950 text-white">
                        <Lock className="h-6 w-6" />
                    </div>
                    <p className="mt-5 text-sm font-semibold uppercase text-zinc-500">Feature Enterprise</p>
                    <h2 className="mt-2 max-w-2xl text-2xl font-bold leading-tight text-zinc-950 sm:text-3xl">
                        Control de margen para negociar con evidencia operativa.
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                        {message || 'Activa Enterprise para ver contratos, scorecards, fuga estimada, alertas y renegociaciones por proveedor y ruta.'}
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <Button asChild>
                            <Link href="/planes">Ver planes</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/dashboard/inteligencia">Ir a Inteligencia</Link>
                        </Button>
                    </div>
                    {access ? (
                        <p className="mt-4 text-xs text-zinc-500">
                            Plan recomendado: {access.recommendedPlan}. El acceso real se valida en servidor.
                        </p>
                    ) : null}
                </div>
                <div className="border-t border-zinc-200 bg-zinc-50 p-6 lg:border-l lg:border-t-0">
                    <div className="space-y-3">
                        {[
                            'Scorecards por proveedor y ruta',
                            'Contratos con vigencia y tarifa pactada',
                            'Alertas de sobrecosto observado',
                            'Pipeline de renegociación sugerida',
                        ].map((item) => (
                            <div key={item} className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4">
                                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-950" />
                                <span className="text-sm font-medium text-zinc-700">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Card>
    );
}

export default LastMilePaywall;
