import { isStrictProductionEnvironment } from '@/lib/server/runtime-env';
import { cobrePayoutProvider } from './providers/cobre';
import { manualPayoutProvider } from './providers/manual';
import type { PayoutProvider, PayoutProviderCode } from './types';

export interface PayoutRuntimeConfig {
    enabled: boolean;
    dryRun: boolean;
    provider: PayoutProviderCode;
    maxSingleCop: number;
    dailyLimitCop: number;
    minAmountCop: number;
    batchSize: number;
    realProviderAllowed: boolean;
    disabledReason?: string | null;
}

function parseCopLimit(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function normalizeProvider(value: string | undefined): PayoutProviderCode {
    const provider = (value || 'manual').trim().toLowerCase();
    if (provider === 'cobre') return 'cobre';
    if (provider === 'wompi') return 'wompi';
    if (provider === 'bank_partner') return 'bank_partner';
    return 'manual';
}

export function getPayoutRuntimeConfig(): PayoutRuntimeConfig {
    const enabled = process.env.PAYOUTS_ENABLED === 'true';
    const dryRun = process.env.PAYOUT_DRY_RUN !== 'false';
    const provider = normalizeProvider(process.env.PAYOUT_PROVIDER);
    const realProviderAllowed = Boolean(
        enabled
        && !dryRun
        && provider !== 'manual'
        && isStrictProductionEnvironment()
    );

    let disabledReason: string | null = null;
    if (!enabled) {
        disabledReason = 'payouts_disabled';
    } else if (dryRun) {
        disabledReason = 'payout_dry_run';
    } else if (provider === 'manual') {
        disabledReason = 'manual_provider';
    } else if (!isStrictProductionEnvironment()) {
        disabledReason = 'non_production_environment';
    }

    return {
        enabled,
        dryRun,
        provider,
        maxSingleCop: parseCopLimit(process.env.PAYOUT_MAX_SINGLE_COP, 500000),
        dailyLimitCop: parseCopLimit(process.env.PAYOUT_DAILY_LIMIT_COP, 2000000),
        minAmountCop: parseCopLimit(process.env.PAYOUT_MIN_AMOUNT_COP, 50000),
        batchSize: parseCopLimit(process.env.PAYOUT_BATCH_SIZE, 10),
        realProviderAllowed,
        disabledReason,
    };
}

export function getPayoutProvider(config: PayoutRuntimeConfig = getPayoutRuntimeConfig()): PayoutProvider {
    if (!config.realProviderAllowed) {
        return manualPayoutProvider;
    }

    if (config.provider === 'cobre') {
        return cobrePayoutProvider;
    }

    return manualPayoutProvider;
}
