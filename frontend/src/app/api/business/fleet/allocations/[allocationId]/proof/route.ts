import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { createAdminNotification, requireAal2Route } from '@/lib/server/route-auth';
import { resolvePrivateFleetPayrollAccess } from '@/lib/server/private-fleet-payroll';
import {
    getPrivateFleetProofDirectUrl,
    getPrivateFleetProofStoragePath,
    PRIVATE_FLEET_PAYMENT_PROOFS_BUCKET,
} from '@/lib/server/private-fleet-proofs';

const ALLOWED_PROOF_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp']);

function isAllowedProofFile(file: File, extension: string) {
    const contentType = file.type || '';
    return contentType === 'application/pdf'
        || contentType.startsWith('image/')
        || ALLOWED_PROOF_EXTENSIONS.has(extension.toLowerCase());
}

function normalizePaymentMethod(value: unknown): 'nequi' | 'bank_transfer' | 'cash' | 'other' {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'nequi') return 'nequi';
    if (normalized === 'cash') return 'cash';
    if (normalized === 'other') return 'other';
    return 'bank_transfer';
}

function safeFileName(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 120) || 'proof';
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ allocationId: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { allocationId } = await params;
    const { supabaseAdmin, authUser, profile } = auth.context;
    const contentType = request.headers.get('content-type') || '';
    let businessIdFromBody: string | undefined;
    let paymentMethod: 'nequi' | 'bank_transfer' | 'cash' | 'other' = 'bank_transfer';
    let externalReference = '';
    let note = '';
    let paidAt: string | null = null;
    let proofUrl: string | null = null;
    let storagePath: string | null = null;
    let amountCop: number | null = null;

    if (contentType.includes('multipart/form-data')) {
        const form = await request.formData();
        businessIdFromBody = String(form.get('businessId') || '') || undefined;
        paymentMethod = normalizePaymentMethod(form.get('paymentMethod'));
        externalReference = String(form.get('externalReference') || '').trim();
        note = String(form.get('note') || '').trim();
        paidAt = String(form.get('paidAt') || '').trim() || null;
        amountCop = Number(form.get('amountCop') || 0) || null;
        const file = form.get('proofFile');

        if (file instanceof File && file.size > 0) {
            const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
            if (!isAllowedProofFile(file, extension || 'bin')) {
                return apiError('El comprobante debe ser una imagen o un PDF.', {
                    requestId,
                    status: 400,
                    code: 'PRIVATE_FLEET_ALLOCATION_PROOF_INVALID_FILE_TYPE',
                });
            }

            storagePath = `${authUser.id}/allocations/${allocationId}/${Date.now()}-${safeFileName(file.name || `proof.${extension}`)}`;
            const { error: uploadError } = await supabaseAdmin.storage
                .from(PRIVATE_FLEET_PAYMENT_PROOFS_BUCKET)
                .upload(storagePath, file, {
                    contentType: file.type || 'application/octet-stream',
                    upsert: false,
                });

            if (uploadError) {
                return apiError(uploadError.message || 'No se pudo cargar comprobante', {
                    requestId,
                    status: 500,
                    code: 'PRIVATE_FLEET_ALLOCATION_PROOF_UPLOAD_FAILED',
                });
            }
        }
    } else {
        const body = await request.json().catch(() => ({})) as Record<string, unknown>;
        businessIdFromBody = typeof body.businessId === 'string' ? body.businessId : undefined;
        paymentMethod = normalizePaymentMethod(body.paymentMethod);
        externalReference = typeof body.externalReference === 'string' ? body.externalReference.trim() : '';
        note = typeof body.note === 'string' ? body.note.trim() : '';
        paidAt = typeof body.paidAt === 'string' ? body.paidAt : null;
        proofUrl = typeof body.proofUrl === 'string' ? body.proofUrl.trim() : null;
        amountCop = Number(body.amountCop || 0) || null;
    }

    const payrollAccess = await resolvePrivateFleetPayrollAccess(
        supabaseAdmin,
        authUser.id,
        profile,
        businessIdFromBody
    );

    if (!payrollAccess.businessId || !payrollAccess.canManagePayroll) {
        return apiError('Solo owner/admin/contabilidad puede cargar comprobantes de flota privada.', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_ALLOCATION_PROOF_FORBIDDEN',
        });
    }

    const { data: allocation, error: allocationError } = await supabaseAdmin
        .from('trip_financial_allocations')
        .select('*')
        .eq('id', allocationId)
        .eq('business_id', payrollAccess.businessId)
        .maybeSingle();

    if (allocationError || !allocation) {
        return apiError(allocationError?.message || 'Liquidacion privada no encontrada', {
            requestId,
            status: 404,
            code: 'PRIVATE_FLEET_ALLOCATION_NOT_FOUND',
        });
    }

    if (['released_to_wallet', 'refunded', 'cancelled'].includes(String(allocation.status || ''))) {
        return apiError('Esta liquidacion privada no permite cargar comprobante externo en su estado actual.', {
            requestId,
            status: 409,
            code: 'PRIVATE_FLEET_ALLOCATION_PROOF_INVALID_STATUS',
        });
    }

    const proofAmount = Math.round(Number(amountCop || allocation.amount || 0));
    if (proofAmount <= 0) {
        return apiError('El comprobante debe tener un monto mayor a cero.', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_ALLOCATION_PROOF_INVALID_AMOUNT',
        });
    }

    let preservedProofUrl = getPrivateFleetProofDirectUrl(allocation);
    let preservedStoragePath = getPrivateFleetProofStoragePath(allocation);

    if (!proofUrl && !storagePath && (!preservedProofUrl || !preservedStoragePath)) {
        const { data: previousProofs } = await supabaseAdmin
            .from('private_fleet_payment_proofs')
            .select('proof_url, storage_path, created_at')
            .eq('allocation_id', allocation.id)
            .order('created_at', { ascending: false })
            .limit(10);

        const previousVisibleProof = (previousProofs || []).find((item) => (
            getPrivateFleetProofDirectUrl(item) || getPrivateFleetProofStoragePath(item)
        ));

        preservedProofUrl = preservedProofUrl || getPrivateFleetProofDirectUrl(previousVisibleProof);
        preservedStoragePath = preservedStoragePath || getPrivateFleetProofStoragePath(previousVisibleProof);
    }

    const nextProofUrl = proofUrl || preservedProofUrl || null;
    const nextStoragePath = storagePath || preservedStoragePath || null;

    const { data: proof, error: proofError } = await supabaseAdmin
        .from('private_fleet_payment_proofs')
        .insert({
            business_id: payrollAccess.businessId,
            run_id: null,
            allocation_id: allocation.id,
            offer_id: allocation.offer_id,
            uploaded_by: authUser.id,
            payment_method: paymentMethod,
            external_reference: externalReference || null,
            amount_cop: proofAmount,
            proof_url: proofUrl,
            storage_path: storagePath,
            note: note || null,
        })
        .select('*')
        .single();

    if (proofError || !proof) {
        return apiError(proofError?.message || 'No se pudo registrar comprobante', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_ALLOCATION_PROOF_CREATE_FAILED',
        });
    }

    const metadata = allocation.metadata && typeof allocation.metadata === 'object' && !Array.isArray(allocation.metadata)
        ? allocation.metadata
        : {};
    const paidAtValue = paidAt || new Date().toISOString();
    const { data: updatedAllocation, error: updateError } = await supabaseAdmin
        .from('trip_financial_allocations')
        .update({
            status: 'proof_uploaded',
            external_payment_status: 'proof_uploaded',
            external_paid_at: paidAtValue,
            external_paid_by: authUser.id,
            external_payment_method: paymentMethod,
            external_payment_reference: externalReference || null,
            external_payment_proof_url: nextProofUrl,
            external_payment_proof_storage_path: nextStoragePath,
            external_payment_note: note || null,
            metadata: {
                ...metadata,
                source_kind: 'private_fleet_allocation_external_proof',
                proof_id: proof.id,
                latest_visible_proof_url: nextProofUrl,
                latest_visible_proof_storage_path: nextStoragePath,
                wallet_touched: false,
            },
        })
        .eq('id', allocation.id)
        .select('*')
        .single();

    if (updateError || !updatedAllocation) {
        return apiError(updateError?.message || 'No se pudo actualizar liquidacion privada', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_ALLOCATION_PROOF_UPDATE_FAILED',
        });
    }

    await supabaseAdmin
        .from('cargo_offers')
        .update({
            private_payment_status: 'proof_uploaded',
            updated_at: new Date().toISOString(),
        })
        .eq('id', allocation.offer_id);

    await createAdminNotification(supabaseAdmin, {
        type: 'private_fleet_allocation_proof_uploaded',
        title: 'Comprobante de viaje privado',
        message: `Liquidacion privada ${String(allocation.id).slice(0, 8)} tiene comprobante externo cargado.`,
        data: {
            business_id: payrollAccess.businessId,
            allocation_id: allocation.id,
            offer_id: allocation.offer_id,
            proof_id: proof.id,
            amount_cop: proofAmount,
            payment_method: paymentMethod,
            wallet_touched: false,
        },
    });

    return apiSuccess({
        allocation: updatedAllocation,
        proof,
    }, {
        requestId,
        code: 'PRIVATE_FLEET_ALLOCATION_PROOF_UPLOADED',
    });
}
