import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

const BUCKET_NAME = 'trip-signatures';
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function resolveFileExtension(file: File) {
    const fromName = file.name.split('.').pop()?.trim().toLowerCase();
    if (fromName) return fromName;

    switch (file.type) {
        case 'image/png':
            return 'png';
        case 'image/webp':
            return 'webp';
        default:
            return 'jpg';
    }
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;

    if (profile?.user_type !== 'trucker' && profile?.user_type !== 'admin') {
        return apiError('Solo transportadores pueden subir firmas del viaje', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_SIGNATURE_FORBIDDEN',
        });
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
        return apiError('No se pudo leer el formulario de firma', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_SIGNATURE_FORM_INVALID',
        });
    }

    const offerId = String(formData.get('offerId') || '').trim();
    const signatureStage = String(formData.get('signatureStage') || '').trim();
    const signerName = String(formData.get('signerName') || '').trim();
    const signerDocumentId = String(formData.get('signerDocumentId') || '').trim();
    const signerRole = String(formData.get('signerRole') || 'other').trim();
    const file = formData.get('signature');

    if (!offerId || !signatureStage || !(file instanceof File)) {
        return apiError('offerId, signatureStage y signature son requeridos', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_SIGNATURE_REQUIRED_FIELDS',
        });
    }

    if (!['origin_dispatch', 'delivery_pod'].includes(signatureStage)) {
        return apiError('signatureStage no valido', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_SIGNATURE_STAGE_INVALID',
        });
    }

    if (file.size > MAX_FILE_SIZE) {
        return apiError('La firma excede el limite de 5MB', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_SIGNATURE_TOO_LARGE',
        });
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        return apiError('Formato de firma no soportado', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_SIGNATURE_TYPE_INVALID',
        });
    }

    const { data: offer, error: offerError } = await supabaseAdmin
        .from('cargo_offers')
        .select('id, business_id, assigned_trucker_id, is_private_fleet')
        .eq('id', offerId)
        .maybeSingle();

    if (offerError || !offer) {
        return apiError('Oferta no encontrada', {
            requestId,
            status: 404,
            code: 'PRIVATE_FLEET_SIGNATURE_OFFER_NOT_FOUND',
        });
    }

    if (offer.assigned_trucker_id !== authUser.id) {
        return apiError('No tienes permiso para subir esta firma', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_SIGNATURE_SCOPE_DENIED',
        });
    }

    const extension = resolveFileExtension(file);
    const storagePath = `${offerId}/${signatureStage}/${Date.now()}-${authUser.id}.${extension}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(storagePath, fileBuffer, {
            cacheControl: '3600',
            contentType: file.type,
            upsert: false,
        });

    if (uploadError) {
        return apiError(uploadError.message || 'No se pudo subir la firma', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_SIGNATURE_UPLOAD_FAILED',
        });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;

    const { data: signatureRow, error: insertError } = await supabaseAdmin
        .from('trip_signature_evidences')
        .insert({
            offer_id: offerId,
            created_by_trucker_id: authUser.id,
            signature_stage: signatureStage,
            signer_name: signerName || null,
            signer_document_id: signerDocumentId || null,
            signer_role: signerRole || 'other',
            storage_path: storagePath,
            public_url: publicUrl,
            metadata: {
                mime_type: file.type,
                size: file.size,
            },
        })
        .select('id, created_at, public_url')
        .single();

    if (insertError || !signatureRow) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove([storagePath]);
        return apiError(insertError?.message || 'No se pudo registrar la firma', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_SIGNATURE_INSERT_FAILED',
        });
    }

    if (offer.is_private_fleet) {
        await supabaseAdmin.rpc('create_notification', {
            p_user_id: offer.business_id,
            p_type: 'private_fleet_signature_captured',
            p_title: signatureStage === 'origin_dispatch' ? 'Firma capturada en salida' : 'Firma capturada en entrega',
            p_message: signerName
                ? `${signerName} firmo la evidencia digital del viaje privado.`
                : 'Se capturo una firma digital para el viaje privado.',
            p_data: {
                offer_id: offerId,
                signature_stage: signatureStage,
                signature_id: signatureRow.id,
                public_url: publicUrl,
            },
        });
    }

    return apiSuccess({
        id: signatureRow.id,
        publicUrl,
        createdAt: signatureRow.created_at,
    }, {
        requestId,
        code: 'PRIVATE_FLEET_SIGNATURE_CREATED',
        status: 201,
    });
}
