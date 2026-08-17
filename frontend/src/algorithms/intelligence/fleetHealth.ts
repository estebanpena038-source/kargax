import { toDate, minutesBetween, DAY_MS } from '../shared/date';

export interface VehicleDocStatus {
    vehicleId: string;
    truckerId: string;
    plateNumber: string;
    vehicleType: string;
    soatExpiry: string | null;
    technomechanicalExpiry: string | null;
    insuranceExpiry: string | null;
}

export interface FuelAdvanceRisk {
    advanceId: string;
    truckerId: string;
    principalAmount: number;
    principalOutstanding: number;
    interestOutstanding: number;
    status: string;
    dueAt: string;
    daysOverdue: number | null;
}

export interface DocumentAlert {
    vehicleId: string;
    plateNumber: string;
    truckerId: string;
    documentType: 'soat' | 'technomechanical' | 'insurance';
    documentName: string;
    expiryDate: string;
    daysUntilExpiry: number;
    status: 'expired' | 'expiring_soon' | 'ok';
}

export interface FleetHealthResult {
    // Vehicle documentation
    vehiclesTotal: number;
    vehiclesDocsExpiringSoon: number;
    vehiclesDocsExpired: number;
    documentAlerts: DocumentAlert[];
    // Fuel advance risk
    activeAdvances: number;
    overdueAdvances: number;
    atRiskAdvances: number;
    totalOutstandingPrincipal: number;
    totalOutstandingInterest: number;
    advanceAlerts: FuelAdvanceRisk[];
}

function evaluateDocument(
    vehicle: VehicleDocStatus,
    docType: 'soat' | 'technomechanical' | 'insurance',
    docName: string,
    expiryIso: string | null | undefined,
    now: Date
): DocumentAlert | null {
    if (!expiryIso) return null;
    const expiryDate = toDate(expiryIso);
    if (!expiryDate) return null;

    const diffMs = expiryDate.getTime() - now.getTime();
    const daysUntilExpiry = Math.floor(diffMs / DAY_MS);

    let status: 'expired' | 'expiring_soon' | 'ok' = 'ok';
    if (daysUntilExpiry <= 0) {
        status = 'expired';
    } else if (daysUntilExpiry <= 30) {
        status = 'expiring_soon';
    } else {
        return null; // Don't create alert if doc is healthy (>30 days)
    }

    return {
        vehicleId: vehicle.vehicleId,
        plateNumber: vehicle.plateNumber,
        truckerId: vehicle.truckerId,
        documentType: docType,
        documentName: docName,
        expiryDate: expiryIso,
        daysUntilExpiry,
        status,
    };
}

export function computeFleetHealth(
    vehicles: VehicleDocStatus[],
    advances: FuelAdvanceRisk[],
    now: Date = new Date()
): FleetHealthResult {
    const documentAlerts: DocumentAlert[] = [];
    const vehicleWithExpiringDoc = new Set<string>();
    const vehicleWithExpiredDoc = new Set<string>();

    for (const vehicle of vehicles) {
        const soatAlert = evaluateDocument(vehicle, 'soat', 'SOAT', vehicle.soatExpiry, now);
        if (soatAlert) {
            documentAlerts.push(soatAlert);
            if (soatAlert.status === 'expired') vehicleWithExpiredDoc.add(vehicle.vehicleId);
            else vehicleWithExpiringDoc.add(vehicle.vehicleId);
        }

        const tecnoAlert = evaluateDocument(vehicle, 'technomechanical', 'Revisión Técnico-Mecánica', vehicle.technomechanicalExpiry, now);
        if (tecnoAlert) {
            documentAlerts.push(tecnoAlert);
            if (tecnoAlert.status === 'expired') vehicleWithExpiredDoc.add(vehicle.vehicleId);
            else vehicleWithExpiringDoc.add(vehicle.vehicleId);
        }

        const insuranceAlert = evaluateDocument(vehicle, 'insurance', 'Póliza Contractual/Extracontractual', vehicle.insuranceExpiry, now);
        if (insuranceAlert) {
            documentAlerts.push(insuranceAlert);
            if (insuranceAlert.status === 'expired') vehicleWithExpiredDoc.add(vehicle.vehicleId);
            else vehicleWithExpiringDoc.add(vehicle.vehicleId);
        }
    }

    // Sort document alerts: expired first (ascending days, i.e., most negative first), then expiring soon
    documentAlerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    // Fuel Advance Risk Analysis
    let activeAdvances = 0;
    let overdueAdvances = 0;
    let atRiskAdvances = 0;
    let totalOutstandingPrincipal = 0;
    let totalOutstandingInterest = 0;
    const advanceAlerts: FuelAdvanceRisk[] = [];

    for (const adv of advances) {
        const status = (adv.status || '').toLowerCase();
        const principal = Math.max(0, Number(adv.principalOutstanding) || 0);
        const interest = Math.max(0, Number(adv.interestOutstanding) || 0);

        if (['disbursed', 'overdue', 'at_risk'].includes(status)) {
            activeAdvances++;
            totalOutstandingPrincipal += principal;
            totalOutstandingInterest += interest;

            const dueDate = toDate(adv.dueAt);
            let daysOverdue: number | null = null;
            if (dueDate) {
                const diffMs = now.getTime() - dueDate.getTime();
                daysOverdue = Math.max(0, Math.floor(diffMs / DAY_MS));
            }

            if (status === 'overdue' || (daysOverdue !== null && daysOverdue > 0)) {
                overdueAdvances++;
                advanceAlerts.push({
                    ...adv,
                    principalOutstanding: principal,
                    interestOutstanding: interest,
                    daysOverdue: daysOverdue || 1,
                });
            } else if (status === 'at_risk') {
                atRiskAdvances++;
                advanceAlerts.push({
                    ...adv,
                    principalOutstanding: principal,
                    interestOutstanding: interest,
                    daysOverdue: 0,
                });
            }
        }
    }

    advanceAlerts.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));

    return {
        vehiclesTotal: vehicles.length,
        vehiclesDocsExpiringSoon: vehicleWithExpiringDoc.size,
        vehiclesDocsExpired: vehicleWithExpiredDoc.size,
        documentAlerts,
        activeAdvances,
        overdueAdvances,
        atRiskAdvances,
        totalOutstandingPrincipal: Math.round(totalOutstandingPrincipal),
        totalOutstandingInterest: Math.round(totalOutstandingInterest),
        advanceAlerts,
    };
}
