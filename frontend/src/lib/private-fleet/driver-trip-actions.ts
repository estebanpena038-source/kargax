import type { PrivateFleetDriverTrip } from '@/lib/warehouses/types';

export interface PrivateFleetDriverTripAction {
    href: string;
    label: string;
}

export function getPrivateFleetTripStatusLabel(status?: string | null) {
    const labels: Record<string, string> = {
        assigned: 'Asignado',
        reserved: 'Reservado',
        in_progress: 'En ruta',
        completed: 'Completado',
        cancelled: 'Cancelado',
        expired: 'Expirado',
    };

    return status ? labels[status] || status : 'Sin estado';
}

export function getPrivateFleetDriverTripAction(trip: PrivateFleetDriverTrip): PrivateFleetDriverTripAction | null {
    if (trip.assignmentStatus === 'rejected' || trip.nextAction === 'returned_to_company') {
        return null;
    }

    if (trip.canAccept || trip.nextAction === 'accept_or_reject') {
        return null;
    }

    if (trip.nextAction === 'delivery') {
        return {
            href: `/viaje/${trip.id}/entrega`,
            label: 'Continuar entrega',
        };
    }

    if (trip.nextAction === 'completed') {
        return {
            href: `/viaje/${trip.id}`,
            label: 'Ver cierre',
        };
    }

    if (trip.nextAction === 'pickup') {
        return {
            href: `/viaje/${trip.id}/carga`,
            label: 'Iniciar ruta',
        };
    }

    if (trip.assignmentStatus === 'accepted' || ['reserved', 'in_progress', 'completed'].includes(trip.status)) {
        return {
            href: `/viaje/${trip.id}`,
            label: 'Iniciar ruta',
        };
    }

    return null;
}
