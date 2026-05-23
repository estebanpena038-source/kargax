import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile, token } = auth.context;

    if (profile?.user_type !== 'trucker' && profile?.user_type !== 'admin') {
        return apiError('Solo transportadores pueden unirse a una flota privada', {
            requestId,
            status: 403,
            code: 'BUSINESS_FLEET_ACCEPT_FORBIDDEN',
        });
    }

    const body = await request.json().catch(() => ({})) as {
        inviteCode?: string;
        internalDriverId?: string;
        vehiclePlate?: string;
    };

    let inviteCode = body.inviteCode?.trim().toUpperCase() || '';

    if (!inviteCode) {
        const { data: authUserResponse } = await supabaseAdmin.auth.getUser(token);
        const metadataCode = authUserResponse.user?.user_metadata?.corporate_invite_code;
        if (typeof metadataCode === 'string') {
            inviteCode = metadataCode.trim().toUpperCase();
        }
    }

    if (!inviteCode) {
        return apiError('Debes ingresar un codigo corporativo valido', {
            requestId,
            status: 400,
            code: 'BUSINESS_FLEET_ACCEPT_CODE_REQUIRED',
        });
    }

    const { data: acceptResult, error: acceptError } = await supabaseAdmin.rpc('accept_business_fleet_invitation', {
        p_invite_code: inviteCode,
        p_trucker_id: authUser.id,
        p_internal_driver_id: body.internalDriverId?.trim() || null,
        p_vehicle_plate: body.vehiclePlate?.trim().toUpperCase() || null,
    });

    if (acceptError) {
        return apiError(acceptError.message || 'No se pudo aceptar la invitacion', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_ACCEPT_FAILED',
        });
    }

    const result = Array.isArray(acceptResult) ? acceptResult[0] : acceptResult;

    if (!result?.success) {
        return apiError(result?.message || 'No se pudo aceptar la invitacion', {
            requestId,
            status: 409,
            code: 'BUSINESS_FLEET_ACCEPT_REJECTED',
        });
    }

    const { data: authUserResponse } = await supabaseAdmin.auth.getUser(token);
    const currentMetadata = authUserResponse.user?.user_metadata || {};

    if (typeof currentMetadata === 'object' && currentMetadata !== null && currentMetadata.corporate_invite_code) {
        const nextMetadata = { ...currentMetadata };
        delete nextMetadata.corporate_invite_code;
        await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
            user_metadata: nextMetadata,
        });
    }

    return apiSuccess({
        businessId: result.business_id,
        membershipId: result.membership_id || null,
        inviteCode,
    }, {
        requestId,
        code: 'BUSINESS_FLEET_ACCEPTED',
    });
}
