export const MARKETPLACE_PAYOUT_ELIGIBLE_TYPES = new Set([
  'marketplace_freight_release',
  'trip_deposit',
  'trip_settlement',
]);

export const PRIVATE_EXTERNAL_TYPES = new Set([
  'private_fleet_salary',
  'private_fleet_external_payment',
  'private_fleet_liquidation',
]);

export function isMarketplacePayoutEligibleTransaction(tx: Record<string, any>) {
  const metadata = tx.metadata && typeof tx.metadata === 'object' ? tx.metadata : {};
  const moneyRail = String(tx.money_rail || metadata.money_rail || '');
  const type = String(tx.type || '');
  const status = String(tx.status || '').toLowerCase();
  const externalProofOnly = Boolean(tx.external_proof_only || metadata.external_proof_only);

  return (
    (moneyRail === 'marketplace_freelancer' || MARKETPLACE_PAYOUT_ELIGIBLE_TYPES.has(type)) &&
    MARKETPLACE_PAYOUT_ELIGIBLE_TYPES.has(type) &&
    ['completed', 'paid', 'settled'].includes(status) &&
    externalProofOnly === false
  );
}

export function isPrivateExternalTransaction(tx: Record<string, any>) {
  const metadata = tx.metadata && typeof tx.metadata === 'object' ? tx.metadata : {};
  const moneyRail = String(tx.money_rail || metadata.money_rail || '');
  const type = String(tx.type || '');

  return (
    moneyRail === 'private_fleet_external' ||
    moneyRail === 'private_fleet_external_or_legacy' ||
    PRIVATE_EXTERNAL_TYPES.has(type) ||
    Boolean(tx.external_proof_only || metadata.external_proof_only)
  );
}

export function sumCop(rows: Array<Record<string, any>>) {
  return rows.reduce((sum, row) => sum + Number(row.amount || row.amount_cop || 0), 0);
}
