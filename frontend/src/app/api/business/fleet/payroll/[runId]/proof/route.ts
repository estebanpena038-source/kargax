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
    { params }: { params: Promise<{ runId: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { runId } = await params;
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
                    code: 'PRIVATE_FLEET_PROOF_INVALID_FILE_TYPE',
                });
            }

            storagePath = `${authUser.id}/${runId}/${Date.now()}-${safeFileName(file.name || `proof.${extension}`)}`;
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
                    code: 'PRIVATE_FLEET_PROOF_UPLOAD_FAILED',
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
        return apiError('Solo owner/admin/contabilidad puede cargar comprobantes.', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_PROOF_FORBIDDEN',
        });
    }

    const { data: run, error: runError } = await supabaseAdmin
        .from('private_fleet_payroll_runs')
        .select('*')
        .eq('id', runId)
        .eq('business_id', payrollAccess.businessId)
        .maybeSingle();

    if (runError || !run) {
        return apiError(runError?.message || 'Liquidacion no encontrada', {
            requestId,
            status: 404,
            code: 'PRIVATE_FLEET_PAYROLL_NOT_FOUND',
        });
    }

    const proofAmount = Math.round(Number(amountCop || run.gross_amount || run.total_amount || 0));
    if (proofAmount <= 0) {
        return apiError('El comprobante debe tener un monto mayor a cero.', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_PROOF_INVALID_AMOUNT',
        });
    }

    let preservedProofUrl = getPrivateFleetProofDirectUrl(run);
    let preservedStoragePath = getPrivateFleetProofStoragePath(run);

    if (!proofUrl && !storagePath && (!preservedProofUrl || !preservedStoragePath)) {
        const { data: previousProofs } = await supabaseAdmin
            .from('private_fleet_payment_proofs')
            .select('proof_url, storage_path, created_at')
            .eq('run_id', run.id)
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
            run_id: run.id,
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
            code: 'PRIVATE_FLEET_PROOF_CREATE_FAILED',
        });
    }

    const paidAtValue = paidAt || new Date().toISOString();
    const { data: updatedRun, error: updateError } = await supabaseAdmin
        .from('private_fleet_payroll_runs')
        .update({
            status: 'proof_uploaded',
            payment_mode: 'external_proof',
            external_payment_status: 'proof_uploaded',
            external_paid_at: paidAtValue,
            external_paid_by: authUser.id,
            external_payment_method: paymentMethod,
            external_payment_reference: externalReference || null,
            external_payment_proof_url: nextProofUrl,
            external_payment_proof_storage_path: nextStoragePath,
            external_payment_note: note || null,
        })
        .eq('id', run.id)
        .select('*')
        .single();

    if (updateError || !updatedRun) {
        return apiError(updateError?.message || 'No se pudo actualizar liquidacion', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_PROOF_RUN_UPDATE_FAILED',
        });
    }

    await supabaseAdmin
        .from('private_fleet_payroll_items')
        .update({
            status: 'proof_uploaded',
            metadata: {
                source_kind: 'private_fleet_external_proof',
                proof_id: proof.id,
                wallet_touched: false,
            },
        })
        .eq('run_id', run.id)
        .neq('status', 'released_to_wallet');

    await createAdminNotification(supabaseAdmin, {
        type: 'private_fleet_payment_proof_uploaded',
        title: 'Comprobante de liquidacion privada',
        message: `Liquidacion ${run.id.slice(0, 8)} tiene comprobante externo cargado.`,
        data: {
            business_id: payrollAccess.businessId,
            payroll_run_id: run.id,
            proof_id: proof.id,
            amount_cop: proofAmount,
            payment_method: paymentMethod,
            wallet_touched: false,
        },
    });

    return apiSuccess({
        run: updatedRun,
        proof,
    }, {
        requestId,
        code: 'PRIVATE_FLEET_PROOF_UPLOADED',
    });
}
