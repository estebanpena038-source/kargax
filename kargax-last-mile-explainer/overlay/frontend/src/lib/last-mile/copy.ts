export const LAST_MILE_PROCESS_STEPS = [
    {
        title: 'Viajes',
        description: 'Lee los viajes del mes desde tu operación real.',
    },
    {
        title: 'Evidencia',
        description: 'Revisa PIN, POD, fotos, firma, novedades e incidentes.',
    },
    {
        title: 'Contratos',
        description: 'Compara cada viaje contra la tarifa esperada.',
    },
    {
        title: 'Margen',
        description: 'Calcula sobrecosto, fuga y score por proveedor.',
    },
    {
        title: 'Decisión',
        description: 'Sugiere qué ruta o proveedor renegociar primero.',
    },
] as const;

export const LAST_MILE_GUARDRAILS = [
    'No mueve wallet.',
    'No crea pagos.',
    'No publica marketplace.',
    'No asigna conductores.',
    'No modifica liquidaciones.',
] as const;

export type LastMileProgressTone = 'empty' | 'needs_recompute' | 'partial' | 'ready';

export interface LastMileProgressCopy {
    tone: LastMileProgressTone;
    title: string;
    description: string;
    actionLabel: string;
}

function normalizeTripCount(value: number) {
    const count = Number(value);
    if (!Number.isFinite(count)) return 0;
    return Math.max(0, Math.floor(count));
}

export function getLastMileProgressCopy(input: {
    totalTrips: number;
    observedTrips: number;
}): LastMileProgressCopy {
    const totalTrips = normalizeTripCount(input.totalTrips);
    const observedTrips = normalizeTripCount(input.observedTrips);

    if (totalTrips === 0) {
        return {
            tone: 'empty',
            title: 'Aún no hay viajes para analizar',
            description:
                'Last Mile empieza cuando existen viajes del mes. Crea viajes desde bodega, flota privada o marketplace y vuelve a este panel.',
            actionLabel: 'Esperando viajes',
        };
    }

    if (observedTrips === 0) {
        return {
            tone: 'needs_recompute',
            title: `${totalTrips} viajes listos para analizar`,
            description:
                'Recalcula el periodo para convertir estos viajes en snapshots de margen, evidencia y proveedor.',
            actionLabel: 'Recalcular viajes del mes',
        };
    }

    if (observedTrips < totalTrips) {
        return {
            tone: 'partial',
            title: `${observedTrips} de ${totalTrips} viajes analizados`,
            description:
                'Hay viajes nuevos o modificados. Actualiza el análisis para ver el margen completo del mes.',
            actionLabel: 'Actualizar análisis',
        };
    }

    return {
        tone: 'ready',
        title: 'Last Mile actualizado',
        description:
            'Los viajes del mes ya tienen lectura de margen, evidencia y proveedor.',
        actionLabel: 'Recalcular si cambió algo',
    };
}
