/**
 * =============================================================================
 * KARGAX - CREATE PAYMENT PREFERENCE API
 * POST /api/payments/create-preference
 *
 * Security:
 * - Server-side only (credentials never exposed)
 * - Requires authenticated + MFA-elevated business session
 * - Validates offer ownership through user-scoped RLS
 * - Refuses production payment flows with localhost/missing secrets
 * =============================================================================
 */

import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isMercadoPagoTestMode, preferenceApi } from '@/lib/mercadopago/config';
import { requireAal2Route } from '@/lib/server/route-auth';
import { getPaymentRuntimeConfig } from '@/lib/server/runtime-env';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import {
    buildFreightPaymentReference,
    buildPaymentIdempotencyKey,
    serializePaymentReference,
} from '@/lib/contracts/payments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdminClient = SupabaseClient<any, 'public', any>;

interface CreatePreferenceRequest {
    offerId: string;
    applicationId: string;
}

interface FreightPreferenceBody {
    items: Array<{
        id: string;
        title: string;
        description: string;
        quantity: number;
        currency_id: 'COP' | 'USD' | 'PEN' | 'BRL';
        unit_price: number;
    }>;
    payer: {
        name: string;
        email?: string;
    };
    back_urls: {
        success: string;
        failure: string;
        pending: string;
    };
    external_reference: string;
    statement_descriptor: string;
    metadata: {
        offer_id: string;
        application_id: string;
        payment_id: string;
        business_name?: string | null;
        freight_amount: number;
        platform_fee: number;
        country_code?: string | null;
        currency_code: string;
    };
    auto_return?: 'approved';
    notification_url?: string;
    expires?: boolean;
    expiration_date_to?: string;
}

interface FreightPaymentPreparation {
    success: boolean;
    message: string;
    payment_id: string | null;
    trucker_id: string | null;
    total_amount: number;
    platform_fee: number;
    trucker_amount: number;
    pickup_contact_name: string | null;
    pickup_contact_phone: string | null;
    delivery_contact_name: string | null;
    delivery_contact_phone: string | null;
}

async function prepareFreightPaymentWithoutRpc(
    supabaseAdmin: SupabaseAdminClient,
    payload: {
        offerId: string;
        applicationId: string;
        businessId: string;
    }
): Promise<FreightPaymentPreparation> {
    const { data: offer, error: offerError } = await supabaseAdmin
        .from('cargo_offers')
        .select('*')
        .eq('id', payload.offerId)
        .maybeSingle();

    if (offerError || !offer) {
        return {
            success: false,
            message: offerError?.message || 'Oferta no encontrada',
            payment_id: null,
            trucker_id: null,
            total_amount: 0,
            platform_fee: 0,
            trucker_amount: 0,
            pickup_contact_name: null,
            pickup_contact_phone: null,
            delivery_contact_name: null,
            delivery_contact_phone: null,
        };
    }

    if (offer.business_id !== payload.businessId) {
        return {
            success: false,
            message: 'No tienes permiso para esta oferta',
            payment_id: null,
            trucker_id: null,
            total_amount: 0,
            platform_fee: 0,
            trucker_amount: 0,
            pickup_contact_name: null,
            pickup_contact_phone: null,
            delivery_contact_name: null,
            delivery_contact_phone: null,
        };
    }

    const isPrivateFleet = Boolean(offer.is_private_fleet);
    const totalAmount = Number(offer.total_amount || 0);
    const platformFee = isPrivateFleet
        ? 0
        : Number(offer.platform_fee ?? Math.round(totalAmount * 8) / 100);
    const truckerAmount = isPrivateFleet
        ? Number(offer.freight_payment_amount ?? offer.net_amount ?? totalAmount)
        : Math.max(totalAmount - platformFee, 0);
    const payableTotal = isPrivateFleet ? totalAmount : totalAmount;

    if (offer.status !== 'active') {
        const { data: existingPendingPayment } = await supabaseAdmin
            .from('payments')
            .select('id')
            .eq('offer_id', payload.offerId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!existingPendingPayment?.id) {
            return {
                success: false,
                message: 'La oferta no esta disponible para pago',
                payment_id: null,
                trucker_id: null,
                total_amount: 0,
                platform_fee: 0,
                trucker_amount: 0,
                pickup_contact_name: null,
                pickup_contact_phone: null,
                delivery_contact_name: null,
                delivery_contact_phone: null,
            };
        }

        const { error: updatePaymentError } = await supabaseAdmin
            .from('payments')
            .update({
                gateway: 'mercadopago',
                payer_id: payload.businessId,
                subtotal: truckerAmount,
                platform_fee: platformFee,
                total_amount: payableTotal,
                updated_at: new Date().toISOString(),
            })
            .eq('id', existingPendingPayment.id)
            .eq('status', 'pending');

        if (updatePaymentError) {
            return {
                success: false,
                message: updatePaymentError.message,
                payment_id: null,
                trucker_id: null,
                total_amount: 0,
                platform_fee: 0,
                trucker_amount: 0,
                pickup_contact_name: null,
                pickup_contact_phone: null,
                delivery_contact_name: null,
                delivery_contact_phone: null,
            };
        }

        return {
            success: true,
            message: 'Pago pendiente encontrado',
            payment_id: existingPendingPayment.id,
            trucker_id: offer.assigned_trucker_id || offer.private_fleet_trucker_id || null,
            total_amount: payableTotal,
            platform_fee: platformFee,
            trucker_amount: truckerAmount,
            pickup_contact_name: offer.pickup_contact_name || null,
            pickup_contact_phone: offer.pickup_contact_phone || null,
            delivery_contact_name: offer.delivery_contact_name || null,
            delivery_contact_phone: offer.delivery_contact_phone || null,
        };
    }

    const { data: application, error: applicationError } = await supabaseAdmin
        .from('offer_applications')
        .select('*')
        .eq('id', payload.applicationId)
        .eq('offer_id', payload.offerId)
        .maybeSingle();

    if (applicationError || !application) {
        return {
            success: false,
            message: applicationError?.message || 'Postulacion no encontrada',
            payment_id: null,
            trucker_id: null,
            total_amount: 0,
            platform_fee: 0,
            trucker_amount: 0,
            pickup_contact_name: null,
            pickup_contact_phone: null,
            delivery_contact_name: null,
            delivery_contact_phone: null,
        };
    }

    if (!['pending', 'accepted'].includes(application.status)) {
        return {
            success: false,
            message: 'Esta postulacion ya fue procesada',
            payment_id: null,
            trucker_id: null,
            total_amount: 0,
            platform_fee: 0,
            trucker_amount: 0,
            pickup_contact_name: null,
            pickup_contact_phone: null,
            delivery_contact_name: null,
            delivery_contact_phone: null,
        };
    }

    const now = new Date().toISOString();

    if (application.status === 'pending') {
        const { error: acceptError } = await supabaseAdmin
            .from('offer_applications')
            .update({
                status: 'accepted',
                business_response: 'Seleccionado para pago',
                responded_at: now,
                updated_at: now,
            })
            .eq('id', payload.applicationId);

        if (acceptError) {
            return {
                success: false,
                message: acceptError.message,
                payment_id: null,
                trucker_id: null,
                total_amount: 0,
                platform_fee: 0,
                trucker_amount: 0,
                pickup_contact_name: null,
                pickup_contact_phone: null,
                delivery_contact_name: null,
                delivery_contact_phone: null,
            };
        }

        await supabaseAdmin
            .from('offer_applications')
            .update({
                status: 'rejected',
                business_response: 'Otro transportador fue seleccionado',
                responded_at: now,
                updated_at: now,
            })
            .eq('offer_id', payload.offerId)
            .neq('id', payload.applicationId)
            .eq('status', 'pending');
    }

    const { error: offerUpdateError } = await supabaseAdmin
        .from('cargo_offers')
        .update({
            assigned_trucker_id: application.trucker_id,
            platform_fee: platformFee,
            net_amount: truckerAmount,
            updated_at: now,
        })
        .eq('id', payload.offerId);

    if (offerUpdateError) {
        return {
            success: false,
            message: offerUpdateError.message,
            payment_id: null,
            trucker_id: null,
            total_amount: 0,
            platform_fee: 0,
            trucker_amount: 0,
            pickup_contact_name: null,
            pickup_contact_phone: null,
            delivery_contact_name: null,
            delivery_contact_phone: null,
        };
    }

    const { data: existingPayment } = await supabaseAdmin
        .from('payments')
        .select('id, status')
        .eq('offer_id', payload.offerId)
        .in('status', ['pending', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    let paymentId = existingPayment?.id || null;

    if (!paymentId) {
        const { data: createdPayment, error: createPaymentError } = await supabaseAdmin
            .from('payments')
            .insert({
                offer_id: payload.offerId,
                payer_id: payload.businessId,
                gateway: 'mercadopago',
                subtotal: truckerAmount,
                platform_fee: platformFee,
                total_amount: payableTotal,
                status: 'pending',
            })
            .select('id')
            .single();

        if (createPaymentError || !createdPayment) {
            return {
                success: false,
                message: createPaymentError?.message || 'No se pudo crear el pago',
                payment_id: null,
                trucker_id: null,
                total_amount: 0,
                platform_fee: 0,
                trucker_amount: 0,
                pickup_contact_name: null,
                pickup_contact_phone: null,
                delivery_contact_name: null,
                delivery_contact_phone: null,
            };
        }

        paymentId = createdPayment.id;
    } else if (existingPayment?.status === 'pending') {
        await supabaseAdmin
            .from('payments')
            .update({
                gateway: 'mercadopago',
                payer_id: payload.businessId,
                subtotal: truckerAmount,
                platform_fee: platformFee,
                total_amount: payableTotal,
                updated_at: now,
            })
            .eq('id', paymentId);
    }

    return {
        success: true,
        message: 'Oferta preparada para pago',
        payment_id: paymentId,
        trucker_id: application.trucker_id,
        total_amount: payableTotal,
        platform_fee: platformFee,
        trucker_amount: truckerAmount,
        pickup_contact_name: offer.pickup_contact_name || null,
        pickup_contact_phone: offer.pickup_contact_phone || null,
        delivery_contact_name: offer.delivery_contact_name || null,
        delivery_contact_phone: offer.delivery_contact_phone || null,
    };
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);

    try {
        const auth = await requireAal2Route(request);

        if ('response' in auth) {
            return auth.response;
        }

        const body = (await request.json()) as CreatePreferenceRequest;

        if (!body.offerId || !body.applicationId) {
            return apiError('offerId y applicationId son requeridos', {
                status: 400,
                code: 'MISSING_PAYMENT_REFERENCE',
                requestId,
            });
        }

        const { authUser, profile, supabaseAdmin } = auth.context;

        if (profile?.user_type !== 'business') {
            return apiError('Solo usuarios empresa pueden crear pagos de flete', {
                status: 403,
                code: 'BUSINESS_ROLE_REQUIRED',
                requestId,
            });
        }

        const { data: offer, error: offerError } = await supabaseAdmin
            .from('cargo_offers')
            .select('*')
            .eq('id', body.offerId)
            .single();

        if (offerError || !offer) {
            return apiError('Oferta no encontrada', {
                status: 404,
                code: 'OFFER_NOT_FOUND',
                requestId,
            });
        }

        if (offer.business_id !== authUser.id) {
            return apiError('No tienes permiso para pagar esta oferta', {
                status: 403,
                code: 'OFFER_PAYMENT_FORBIDDEN',
                requestId,
            });
        }

        const paymentPrep = await prepareFreightPaymentWithoutRpc(supabaseAdmin, {
            offerId: body.offerId,
            applicationId: body.applicationId,
            businessId: authUser.id,
        });

        if (!paymentPrep?.success || !paymentPrep.payment_id || !paymentPrep.trucker_id) {
            console.error('[Payment] prepare_offer_for_payment failed:', paymentPrep?.message);
            return apiError(paymentPrep?.message || 'Error al preparar el pago', {
                status: 400,
                code: 'PAYMENT_PREPARATION_REJECTED',
                requestId,
            });
        }

        const amounts = {
            freightAmount: Number(paymentPrep.trucker_amount),
            platformFee: Number(paymentPrep.platform_fee),
            totalAmount: Number(paymentPrep.total_amount),
        };
        const localPaymentId = paymentPrep.payment_id;
        const truckerId = paymentPrep.trucker_id;
        const countryCode = (offer as { country_code?: string | null }).country_code || profile?.country_code || 'CO';
        const currencyCode = ((offer as { currency_code?: string | null }).currency_code
            || (countryCode === 'EC' ? 'USD' : countryCode === 'PE' ? 'PEN' : countryCode === 'BR' ? 'BRL' : 'COP')) as 'COP' | 'USD' | 'PEN' | 'BRL';

        const [{ data: userProfile }, { data: businessProfile }] = await Promise.all([
            supabaseAdmin
                .from('user_profiles')
                .select('full_name, email, phone')
                .eq('id', authUser.id)
                .single(),
            supabaseAdmin
                .from('business_profiles')
                .select('company_name')
                .eq('user_id', authUser.id)
                .single(),
        ]);

        const { baseUrl, isLocalhost } = getPaymentRuntimeConfig({
            requireWebhookSecret: true,
        });

        if (!isLocalhost && !process.env.MERCADOPAGO_WEBHOOK_SECRET) {
            return apiError('El webhook de Mercado Pago no esta configurado para este ambiente publico', {
                status: 503,
                code: 'PAYMENT_WEBHOOK_NOT_CONFIGURED',
                requestId,
                details: 'Define MERCADOPAGO_WEBHOOK_SECRET antes de abrir checkout en staging o produccion.',
            });
        }

        const canonicalReference = buildFreightPaymentReference({
            offer_id: offer.id,
            application_id: body.applicationId,
            payment_id: localPaymentId,
            trucker_id: truckerId,
            payer_id: authUser.id,
        });
        const returnParams = new URLSearchParams({
            offer_id: offer.id,
            application_id: body.applicationId,
            local_payment_id: localPaymentId,
        });
        const idempotencyKey = buildPaymentIdempotencyKey([
            'kargax',
            'freight',
            canonicalReference.offer_id,
            canonicalReference.payment_id,
            canonicalReference.application_id,
        ]);

        const preferenceBody: FreightPreferenceBody = {
            items: [
                {
                    id: offer.id,
                    title: `Flete: ${offer.origin_city} -> ${offer.destination_city}`,
                    description: `${offer.cargo_type}: ${offer.cargo_description}`.substring(0, 255),
                    quantity: 1,
                    currency_id: currencyCode,
                    unit_price: amounts.totalAmount,
                },
            ],
            payer: {
                name: userProfile?.full_name || 'Usuario',
                email: isMercadoPagoTestMode
                    ? 'test@testuser.com'
                    : (userProfile?.email || authUser.email || undefined),
            },
            back_urls: {
                success: `${baseUrl}/pago/exitoso?${returnParams.toString()}`,
                failure: `${baseUrl}/pago/fallido?${returnParams.toString()}`,
                pending: `${baseUrl}/pago/pendiente?${returnParams.toString()}`,
            },
            external_reference: serializePaymentReference(canonicalReference),
            statement_descriptor: 'KARGAX',
            metadata: {
                offer_id: offer.id,
                application_id: body.applicationId,
                payment_id: localPaymentId,
                business_name: businessProfile?.company_name,
                freight_amount: amounts.freightAmount,
                platform_fee: amounts.platformFee,
                country_code: countryCode,
                currency_code: currencyCode,
            },
        };

        if (!isLocalhost) {
            preferenceBody.auto_return = 'approved';
            preferenceBody.notification_url = `${baseUrl}/api/payments/webhook`;
            preferenceBody.expires = true;
            preferenceBody.expiration_date_to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }

        const preference = await preferenceApi.create({
            body: preferenceBody,
            requestOptions: {
                idempotencyKey,
            },
        });

        return apiSuccess({
            preference: {
                id: preference.id,
                init_point: preference.init_point,
                sandbox_init_point: preference.sandbox_init_point,
            },
            amounts: {
                freight: amounts.freightAmount,
                platformFee: amounts.platformFee,
                total: amounts.totalAmount,
                currency: currencyCode,
            },
            payment: {
                id: paymentPrep.payment_id,
                offerId: offer.id,
                applicationId: body.applicationId,
                status: 'pending',
            },
            externalReference: canonicalReference,
            idempotencyKey,
        }, {
            code: 'PAYMENT_PREFERENCE_CREATED',
            requestId,
            meta: {
                paymentKind: 'freight',
                countryCode,
                currencyCode,
            },
        });
    } catch (error) {
        console.error('[Payment] Error creating payment preference:', error);

        return apiError('Error al procesar el pago. Por favor intenta de nuevo.', {
            status: 500,
            code: 'PAYMENT_ERROR',
            requestId,
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
