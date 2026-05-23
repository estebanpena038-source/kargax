import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';

type RecoveryCodeInsert = Database['public']['Tables']['user_mfa_recovery_codes']['Insert'];
type RecoveryCodeLookup = Pick<Database['public']['Tables']['user_mfa_recovery_codes']['Row'], 'id' | 'used_at'>;

export const MFA_ISSUER = (process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'KargaX').replace(/[:]/g, '');

export function getMfaFriendlyName(email?: string | null) {
    return email ? `${MFA_ISSUER} - ${email}` : MFA_ISSUER;
}

export interface MfaStatus {
    hasSession: boolean;
    currentLevel: 'aal1' | 'aal2' | null;
    nextLevel: 'aal1' | 'aal2' | null;
    verifiedFactorId: string | null;
    verifiedFactors: Array<{
        id: string;
        friendly_name?: string;
        factor_type: string;
        status: string;
    }>;
    needsSetup: boolean;
    needsVerification: boolean;
}

export async function getMfaStatus(): Promise<MfaStatus> {
    const [{ data: sessionData }, { data: factorsData }, { data: aalData }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    const verifiedFactors = (factorsData?.all || []).filter(
        (factor) => factor.factor_type === 'totp' && factor.status === 'verified'
    );
    const verifiedFactorId = verifiedFactors[0]?.id || null;
    const hasSession = Boolean(sessionData.session);
    const currentLevel = aalData?.currentLevel || null;
    const nextLevel = aalData?.nextLevel || null;
    const needsSetup = hasSession && verifiedFactors.length === 0;
    const needsVerification =
        hasSession &&
        verifiedFactors.length > 0 &&
        currentLevel !== 'aal2' &&
        nextLevel === 'aal2';

    return {
        hasSession,
        currentLevel,
        nextLevel,
        verifiedFactorId,
        verifiedFactors,
        needsSetup,
        needsVerification,
    };
}

export function getPostAuthRoute(status: MfaStatus, nextPath?: string | null) {
    const normalizedNext = nextPath && nextPath.startsWith('/') ? nextPath : '/dashboard';

    if (status.needsSetup) {
        return `/auth/mfa/setup?next=${encodeURIComponent(normalizedNext)}`;
    }

    if (status.needsVerification) {
        return `/auth/mfa/verify?next=${encodeURIComponent(normalizedNext)}`;
    }

    return normalizedNext;
}

export function generateRecoveryCodes(count = 10) {
    return Array.from({ length: count }, () =>
        `${randomChunk(4)}-${randomChunk(4)}-${randomChunk(4)}`
    );
}

function randomChunk(length: number) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randomValues = crypto.getRandomValues(new Uint32Array(length));
    return Array.from(randomValues)
        .map((value) => alphabet[value % alphabet.length])
        .join('');
}

export async function hashRecoveryCode(code: string) {
    const normalized = code.trim().toUpperCase();
    const buffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(normalized)
    );

    return Array.from(new Uint8Array(buffer))
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
}

export async function replaceRecoveryCodes(userId: string, codes: string[]) {
    const hashedCodes: RecoveryCodeInsert[] = await Promise.all(
        codes.map(async (code) => ({
            user_id: userId,
            code_hash: await hashRecoveryCode(code),
            used_at: null,
        }))
    );

    await supabase
        .from('user_mfa_recovery_codes')
        .delete()
        .eq('user_id', userId);

    const { error } = await supabase
        .from('user_mfa_recovery_codes')
        .insert(hashedCodes as never);

    if (error) {
        throw error;
    }
}

export async function consumeRecoveryCode(userId: string, code: string) {
    const codeHash = await hashRecoveryCode(code);

    const { data: existingCode, error } = await supabase
        .from('user_mfa_recovery_codes')
        .select('id, used_at')
        .eq('user_id', userId)
        .eq('code_hash', codeHash)
        .is('used_at', null)
        .maybeSingle();

    if (error) {
        throw error;
    }

    const existingRecoveryCode = existingCode as RecoveryCodeLookup | null;

    if (!existingRecoveryCode) {
        return false;
    }

    const { error: updateError } = await supabase
        .from('user_mfa_recovery_codes')
        .update({ used_at: new Date().toISOString() } as never)
        .eq('id', existingRecoveryCode.id);

    if (updateError) {
        throw updateError;
    }

    return true;
}

export async function verifyTotpFactor(factorId: string, code: string) {
    const normalizedCode = code.trim();
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
    });

    if (challengeError || !challengeData) {
        throw challengeError || new Error('No se pudo generar el reto MFA');
    }

    const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: normalizedCode,
    });

    if (error) {
        throw error;
    }

    return data;
}

export function getMfaErrorMessage(error: unknown, fallback: string) {
    if (!(error instanceof Error)) {
        return fallback;
    }

    const code = 'code' in error ? String((error as { code?: string }).code || '') : '';
    const message = error.message.toLowerCase();

    if (code === 'mfa_verification_failed' || message.includes('mfa verification failed')) {
        return 'El codigo no coincide. Verifica que Google Authenticator tenga la hora automatica e intenta otra vez.';
    }

    if (code === 'mfa_challenge_expired' || message.includes('challenge expired')) {
        return 'El intento de verificacion vencio. Genera un codigo nuevo e intenta otra vez.';
    }

    if (code === 'mfa_factor_not_found' || message.includes('factor not found')) {
        return 'El factor MFA ya no es valido. Vuelve a generar el QR para configurar Google Authenticator.';
    }

    return error.message || fallback;
}
