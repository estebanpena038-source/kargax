'use client';

import { RefreshCw, Route } from 'lucide-react';
import { Button, Card } from '@/components/ui';

interface LastMileEmptyStateProps {
    canRunRecompute?: boolean;
    isRecomputing?: boolean;
    onRecompute?: () => void;
}

export function LastMileEmptyState({ canRunRecompute, isRecomputing, onRecompute }: LastMileEmptyStateProps) {
    return (
        <Card className="p-6 sm:p-8">
            <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-950 text-white">
                    <Route className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-zinc-950">Aún no hay snapshots de margen</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Recalcula el periodo para crear observaciones por viaje. KargaX toma costos operativos existentes y los compara contra contratos, evidencia y rutas sin tocar pagos ni wallet.
                </p>
                {canRunRecompute ? (
                    <Button
                        className="mt-6"
                        onClick={onRecompute}
                        isLoading={isRecomputing}
                        leftIcon={<RefreshCw className="h-4 w-4" />}
                    >
                        Recalcular periodo
                    </Button>
                ) : (
                    <p className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                        Tu rol puede ver Control de margen, pero no ejecutar recomputes.
                    </p>
                )}
            </div>
        </Card>
    );
}

export default LastMileEmptyState;
