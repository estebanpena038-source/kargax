export const PRIVATE_FLEET_PAYMENT_PROOFS_BUCKET = 'private-fleet-payment-proofs';

type SupabaseStorageClient = {
    storage: {
        from(bucketId: string): {
            createSignedUrl(path: string, expiresIn: number): Promise<{
                data: { signedUrl: string } | null;
                error: { message?: string } | null;
            }>;
        };
    };
};

export type PrivateFleetProofPointer = {
    proof_url?: string | null;
    storage_path?: string | null;
    external_payment_proof_url?: string | null;
    external_payment_proof_storage_path?: string | null;
};

export function getPrivateFleetProofStoragePath(row: PrivateFleetProofPointer | null | undefined) {
    if (!row) return null;

    const storagePath = row.external_payment_proof_storage_path || row.storage_path || null;
    return typeof storagePath === 'string' && storagePath.trim() ? storagePath.trim() : null;
}

export function getPrivateFleetProofDirectUrl(row: PrivateFleetProofPointer | null | undefined) {
    if (!row) return null;

    const proofUrl = row.external_payment_proof_url || row.proof_url || null;
    return typeof proofUrl === 'string' && proofUrl.trim() ? proofUrl.trim() : null;
}

export async function createPrivateFleetProofSignedUrlMap(
    supabaseAdmin: SupabaseStorageClient,
    storagePaths: Array<string | null | undefined>,
    expiresInSeconds = 60 * 60
) {
    const uniquePaths = [...new Set(storagePaths
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean))];

    const entries = await Promise.all(uniquePaths.map(async (storagePath) => {
        const { data, error } = await supabaseAdmin.storage
            .from(PRIVATE_FLEET_PAYMENT_PROOFS_BUCKET)
            .createSignedUrl(storagePath, expiresInSeconds);

        return [storagePath, error ? null : data?.signedUrl || null] as const;
    }));

    return new Map(entries.filter(([, signedUrl]) => Boolean(signedUrl)) as Array<[string, string]>);
}

export function resolvePrivateFleetProofDisplayUrl(
    row: PrivateFleetProofPointer | null | undefined,
    signedUrlsByStoragePath: Map<string, string>
) {
    const storagePath = getPrivateFleetProofStoragePath(row);
    if (storagePath) {
        const signedUrl = signedUrlsByStoragePath.get(storagePath);
        if (signedUrl) return signedUrl;
    }

    return getPrivateFleetProofDirectUrl(row);
}
