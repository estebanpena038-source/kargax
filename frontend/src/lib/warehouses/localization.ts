import {
    getCities,
    getCityNameByCode,
    getCountryConfig,
    getSubdivisionName,
    getSubdivisions,
    type SupportedCountry,
} from '@/constants/countries';
import type {
    WarehouseAppointment,
    WarehouseDispatchOrder,
    WarehouseDock,
    WarehouseFlowMode,
    WarehouseIncident,
    WarehouseReceipt,
} from './types';

export type WarehouseCountryCode = SupportedCountry;

const FALLBACK_COUNTRY: WarehouseCountryCode = 'CO';

export function resolveWarehouseCountry(value?: string | null): WarehouseCountryCode {
    if (value === 'CO' || value === 'EC' || value === 'PE' || value === 'BR') {
        return value;
    }

    return FALLBACK_COUNTRY;
}

export function getWarehouseCountryConfig(countryCode?: string | null) {
    return getCountryConfig(resolveWarehouseCountry(countryCode));
}

export function getWarehouseLocale(countryCode?: string | null) {
    return getWarehouseCountryConfig(countryCode).locale;
}

export function formatWarehouseDateTime(value?: string | null, countryCode?: string | null) {
    if (!value) {
        return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return new Intl.DateTimeFormat(getWarehouseLocale(countryCode), {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

export function getFlowModeLabel(mode: WarehouseFlowMode) {
    const labels: Record<WarehouseFlowMode, string> = {
        warehouse_managed: 'Gestionada por KargaX',
        manual: 'Operacion manual',
        '3pl': 'Operador 3PL',
    };

    return labels[mode] || mode;
}

export function getDockTypeLabel(type: WarehouseDock['dock_type']) {
    const labels: Record<WarehouseDock['dock_type'], string> = {
        loading: 'Carga',
        unloading: 'Descarga',
        mixed: 'Mixto',
    };

    return labels[type] || type;
}

export function getAppointmentTypeLabel(type: WarehouseAppointment['appointment_type']) {
    const labels: Record<WarehouseAppointment['appointment_type'], string> = {
        pickup: 'Cargue',
        delivery: 'Descargue',
        receipt: 'Recepcion',
        dispatch: 'Despacho',
    };

    return labels[type] || type;
}

export function getAppointmentStatusLabel(status: WarehouseAppointment['status']) {
    const labels: Record<WarehouseAppointment['status'], string> = {
        scheduled: 'Programada',
        checked_in: 'Check-in',
        in_progress: 'En proceso',
        completed: 'Completada',
        cancelled: 'Cancelada',
    };

    return labels[status] || status;
}

export function getReceiptStatusLabel(status: WarehouseReceipt['status']) {
    const labels: Record<WarehouseReceipt['status'], string> = {
        draft: 'Borrador',
        received: 'Recibida',
        closed: 'Cerrada',
        cancelled: 'Cancelada',
    };

    return labels[status] || status;
}

export function getDispatchStatusLabel(status: WarehouseDispatchOrder['status']) {
    const labels: Record<WarehouseDispatchOrder['status'], string> = {
        draft: 'Borrador',
        picking: 'En picking',
        ready: 'Listo para salida',
        dispatched: 'Despachado',
        cancelled: 'Cancelado',
    };

    return labels[status] || status;
}

export function getIncidentTypeLabel(type: WarehouseIncident['incident_type']) {
    const labels: Record<WarehouseIncident['incident_type'], string> = {
        damage: 'Danos',
        shortage: 'Faltante',
        delay: 'Demora',
        security: 'Seguridad',
        documentation: 'Documentacion',
        payment_hold: 'Bloqueo de pago',
        other: 'Otro',
    };

    return labels[type] || type;
}

export function getIncidentSeverityLabel(severity: WarehouseIncident['severity']) {
    const labels: Record<WarehouseIncident['severity'], string> = {
        low: 'Baja',
        medium: 'Media',
        high: 'Alta',
        critical: 'Critica',
    };

    return labels[severity] || severity;
}

export function getIncidentStatusLabel(status: WarehouseIncident['status']) {
    const labels: Record<WarehouseIncident['status'], string> = {
        open: 'Abierto',
        investigating: 'Investigando',
        resolved: 'Resuelto',
        closed: 'Cerrado',
    };

    return labels[status] || status;
}

export function getWarehouseActionLabel(
    status: string
) {
    const labels: Record<string, string> = {
        checked_in: 'Marcar check-in',
        in_progress: 'Mover a en proceso',
        completed: 'Completar',
        cancelled: 'Cancelar',
        received: 'Marcar recibida',
        closed: 'Cerrar',
        picking: 'Iniciar picking',
        ready: 'Marcar listo',
        dispatched: 'Confirmar despacho',
        investigating: 'Investigar',
        resolved: 'Resolver',
        open: 'Abrir',
        draft: 'Borrador',
    };

    return labels[status] || status;
}

export function mapWarehouseErrorMessage(message: string) {
    if (message.includes('receiptNumber and at least one line are required')) {
        return 'Agrega al menos una linea y confirma el numero de recepcion antes de guardar.';
    }

    if (message.includes('dispatchNumber and at least one line are required') || message.includes('At least one line is required')) {
        return 'Agrega al menos una linea antes de guardar el despacho.';
    }

    if (message.includes('warehouse_dispatch_orders_warehouse_id_dispatch_number_key')) {
        return 'Ese numero de despacho ya existe. Intenta guardar de nuevo para generar un consecutivo nuevo.';
    }

    if (message.includes('Insufficient stock for SKU')) {
        const skuCode = message.split('SKU').pop()?.trim();
        return skuCode
            ? `No hay stock suficiente para el SKU ${skuCode}.`
            : 'No hay stock suficiente para completar el despacho.';
    }

    return message;
}

export function buildWarehouseNumber(prefix: string) {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
    return `${prefix}-${stamp}`;
}

export function getSubdivisionOptions(countryCode?: string | null) {
    const country = resolveWarehouseCountry(countryCode);
    return getSubdivisions(country).map((item) => ({
        value: item.code,
        label: item.name,
        description: item.capital,
    }));
}

export function getCityOptions(countryCode?: string | null, subdivisionCode?: string | null) {
    const country = resolveWarehouseCountry(countryCode);
    return getCities(country, subdivisionCode || undefined).map((item) => ({
        value: item.code,
        label: item.name,
        description: item.isCapital ? 'Capital' : undefined,
    }));
}

export function getSubdivisionDisplayName(countryCode?: string | null, subdivisionCode?: string | null) {
    if (!subdivisionCode) {
        return '';
    }

    return getSubdivisionName(resolveWarehouseCountry(countryCode), subdivisionCode);
}

export function getCityDisplayName(countryCode?: string | null, cityCode?: string | null) {
    if (!cityCode) {
        return '';
    }

    return getCityNameByCode(resolveWarehouseCountry(countryCode), cityCode);
}
