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
                <h2 className="mt-4 text-xl font-bold text-zinc-950">Todavía no hay análisis de margen</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Si ya existen viajes en este mes, recalcula el periodo. KargaX convierte esos viajes
                    en análisis de margen, evidencia y proveedor sin tocar pagos, wallet ni liquidaciones.
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Piensa en esto como una foto contable-operativa: no cambia la operación,
                    solo muestra dónde se está ganando o perdiendo margen.
                </p>
                {canRunRecompute ? (
                    <Button
                        className="mt-6"
                        onClick={onRecompute}
                        isLoading={isRecomputing}
                        leftIcon={<RefreshCw className="h-4 w-4" />}
                    >
                        Recalcular viajes del mes
                    </Button>
                ) : (
                    <p className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                        Tu rol puede ver Last Mile, pero no recalcular el periodo. Pide a un owner, manager o finanzas que lo actualice.
                    </p>
                )}
            </div>
        </Card>
    );
}

export default LastMileEmptyState;
