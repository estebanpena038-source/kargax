export const MARKETPLACE_MONEY_RAIL = 'marketplace_freelancer';

export const MARKETPLACE_RELEASE_SOURCE_KINDS = new Set([
    'marketplace_freight_release',
    'trip_settlement',
]);

export const PRIVATE_FLEET_SOURCE_PREFIX = 'private_fleet';

export function getTransactionMetadata(row: Record<string, unknown>) {
    return row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : {};
}

export function getTransactionSourceKind(row: Record<string, unknown>) {
    const metadata = getTransactionMetadata(row);
    return typeof metadata.source_kind === 'string'
        ? metadata.source_kind
        : typeof row.source_kind === 'string'
            ? row.source_kind
            : String(row.type || '');
}

export function isPrivateFleetFinancialRow(row: Record<string, unknown>) {
    const metadata = getTransactionMetadata(row);
    const sourceKind = getTransactionSourceKind(row);
    const moneyRail = String(row.money_rail || metadata.money_rail || '');

    return row.external_proof_only === true
        || metadata.external_proof_only === true
        || row.type === 'private_fleet_salary'
        || moneyRail.startsWith(PRIVATE_FLEET_SOURCE_PREFIX)
        || sourceKind.startsWith(PRIVATE_FLEET_SOURCE_PREFIX);
}

export function isMarketplacePayoutEligibleCredit(row: Record<string, unknown>) {
    const sourceKind = getTransactionSourceKind(row);
    const moneyRail = String(row.money_rail || '');
    const status = String(row.status || '').toLowerCase();

    if (isPrivateFleetFinancialRow(row)) {
        return false;
    }

    if (row.payout_eligible === true) {
        return moneyRail === MARKETPLACE_MONEY_RAIL
            || MARKETPLACE_RELEASE_SOURCE_KINDS.has(sourceKind);
    }

    return row.type === 'trip_deposit'
        && status === 'completed'
        && (
            moneyRail === MARKETPLACE_MONEY_RAIL
            || MARKETPLACE_RELEASE_SOURCE_KINDS.has(sourceKind)
        );
}

export function isMarketplacePendingRelease(row: Record<string, unknown>) {
    const sourceKind = getTransactionSourceKind(row);
    const moneyRail = String(row.money_rail || '');
    const status = String(row.status || 'pending').toLowerCase();

    if (isPrivateFleetFinancialRow(row)) {
        return false;
    }

    return row.type === 'trip_pending'
        && ['pending', 'held', 'completed'].includes(status)
        && (
            moneyRail === MARKETPLACE_MONEY_RAIL
            || sourceKind === 'payment_capture'
            || sourceKind === 'trip_pending'
        );
}

export function sumCop(rows: Array<Record<string, unknown>>) {
    return rows.reduce((sum, row) => sum + Number(row.amount || row.amount_cop || 0), 0);
}
