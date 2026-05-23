import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminNotification } from '@/lib/server/route-auth';
import { getPaymentRuntimeConfig } from '@/lib/server/runtime-env';
import {
    mapMercadoPagoStatusToMoneyFlow,
    parsePaymentReference,
    type MoneyFlowStatus,
    type PaymentReferenceData,
} from '@/lib/contracts/payments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdminClient = SupabaseClient<any, 'public', any>;

export interface MercadoPagoPaymentLike {
    id?: string | number;
    status?: string | null;
    status_detail?: string | null;
    external_reference?: string | null;
    metadata?: Record<string, unknown> | null;
    order?: {
        id?: string | number;
    } | null;
}

interface PinNotificationResult {
    success?: boolean;
    message?: string;
    pickup_pin?: string | null;
    delivery_pin?: string | null;
    pickup_contact_phone?: string | null;
    pickup_contact_name?: string | null;
    delivery_contact_phone?: string | null;
    delivery_contact_name?: string | null;
    offer_id?: string | null;
    country_code?: string | null;
}

export interface ResolvedFreightPayment {
    offerId: string | null;
    paymentId: string | null;
    resolutionSource: 'external_reference' | 'payment_metadata' | 'payment_record' | 'offer_lookup' | 'external_id_lookup' | 'unresolved';
}

export interface FreightSettlementSyncResult {
    providerStatus: string;
    duplicate: boolean;
    settlementApplied: boolean;
    resolvedFreightPayment: ResolvedFreightPayment;
    paymentId: string | null;
    offerId: string | null;
    notificationSent: boolean;
    warehouseSynchronized: boolean;
    reason?: string;
}

type PersistedFreightPaymentStatus = MoneyFlowStatus | null;

function parseExternalReference(externalReference: unknown): PaymentReferenceData | null {
    return parsePaymentReference(externalReference);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown) {
    return typeof value === 'string'
        ? value
        : typeof value === 'number'
            ? String(value)
            : null;
}

function shouldPersistFreightStatusTransition(
    currentStatus: PersistedFreightPaymentStatus,
    nextStatus: MoneyFlowStatus
) {
    if (!currentStatus || currentStatus === nextStatus) {
        return true;
    }

    if (currentStatus === 'completed') {
        return nextStatus === 'refunded';
    }

    if (currentStatus === 'refunded') {
        return false;
    }

    if (currentStatus === 'processing' && nextStatus === 'pending') {
        return false;
    }

    if ((currentStatus === 'failed' || currentStatus === 'expired') && nextStatus === 'processing') {
        return false;
    }

    return true;
}

async function recordPaymentIncident(
    supabaseAdmin: SupabaseAdminClient,
    payload: {
        offerId?: string | null;
        paymentId: string | null;
        externalId: string;
        stage: string;
        reason: string;
        mpPayment: MercadoPagoPaymentLike;
    }
) {
    await createAdminNotification(supabaseAdmin, {
        type: 'payment_incident',
        title: 'Incidente en sincronizacion de pago',
        message: `Pago ${payload.externalId} requiere conciliacion manual.`,
        data: {
            offer_id: payload.offerId,
            payment_id: payload.paymentId,
            external_id: payload.externalId,
            stage: payload.stage,
            reason: payload.reason,
            mp_payment_status: payload.mpPayment?.status,
            mp_payment: payload.mpPayment,
            created_at: new Date().toISOString(),
        },
    });
}

export async function resolveFreightPayment(
    supabaseAdmin: SupabaseAdminClient,
    mpPayment: MercadoPagoPaymentLike,
    refData: Extract<PaymentReferenceData, { kind: 'freight' }> | null
): Promise<ResolvedFreightPayment> {
    let paymentId = refData?.payment_id || null;
    let offerId = refData?.offer_id || null;
    let resolutionSource: ResolvedFreightPayment['resolutionSource'] = refData ? 'external_reference' : 'unresolved';
    const metadata = isRecord(mpPayment.metadata) ? mpPayment.metadata : null;

    if (!paymentId) {
        paymentId = readString(metadata?.payment_id) || readString(metadata?.paymentId);
        if (paymentId) {
            resolutionSource = 'payment_metadata';
        }
    }

    if (!offerId) {
        offerId = readString(metadata?.offer_id) || readString(metadata?.offerId);
        if (offerId) {
            resolutionSource = 'payment_metadata';
        }
    }

    if (paymentId) {
        const { data: paymentRecord } = await supabaseAdmin
            .from('payments')
            .select('id, offer_id')
            .eq('id', paymentId)
            .maybeSingle();

        if (paymentRecord?.id) {
            paymentId = paymentRecord.id;
            offerId = offerId || paymentRecord.offer_id;
            if (!refData) {
                resolutionSource = 'payment_record';
            }
        } else {
            paymentId = null;
        }
    }

    if (!paymentId && offerId) {
        const { data: paymentRecord } = await supabaseAdmin
            .from('payments')
            .select('id, offer_id, status, created_at')
            .eq('offer_id', offerId)
            .in('status', ['pending', 'processing', 'completed', 'failed', 'expired'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (paymentRecord?.id) {
            paymentId = paymentRecord.id;
            offerId = paymentRecord.offer_id;
            resolutionSource = 'offer_lookup';
        }
    }

    if (!paymentId) {
        const externalPaymentId = readString(mpPayment.id);

        if (externalPaymentId) {
            const { data: paymentRecord } = await supabaseAdmin
                .from('payments')
                .select('id, offer_id, created_at')
                .eq('external_id', externalPaymentId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (paymentRecord?.id) {
                paymentId = paymentRecord.id;
                offerId = offerId || paymentRecord.offer_id;
                resolutionSource = 'external_id_lookup';
            }
        }
    }

    return {
        offerId,
        paymentId,
        resolutionSource,
    };
}

async function updateFreightPaymentStatus(
    supabaseAdmin: SupabaseAdminClient,
    resolvedFreightPayment: ResolvedFreightPayment,
    externalPaymentId: string,
    mpPayment: MercadoPagoPaymentLike
) {
    const nextStatus = mapMercadoPagoStatusToMoneyFlow(mpPayment.status || 'pending');
    let currentStatus: PersistedFreightPaymentStatus = null;

    if (resolvedFreightPayment.paymentId) {
        const { data: storedPayment } = await supabaseAdmin
            .from('payments')
            .select('status')
            .eq('id', resolvedFreightPayment.paymentId)
            .maybeSingle();

        currentStatus = (storedPayment?.status as PersistedFreightPaymentStatus | undefined) || null;
    }

    if (!shouldPersistFreightStatusTransition(currentStatus, nextStatus)) {
        return {
            applied: false,
            nextStatus,
            reason: `ignored_transition:${currentStatus || 'unknown'}->${nextStatus}`,
        };
    }

    let query = supabaseAdmin
        .from('payments')
        .update({
            status: nextStatus,
            external_id: externalPaymentId,
            gateway_response: mpPayment,
        });

    if (resolvedFreightPayment.paymentId) {
        query = query.eq('id', resolvedFreightPayment.paymentId);
    } else if (resolvedFreightPayment.offerId) {
        query = query.eq('offer_id', resolvedFreightPayment.offerId);
    } else {
        return {
            applied: false,
            nextStatus,
            reason: 'missing_local_payment_reference',
        };
    }

    const { error } = await query;

    if (error) {
        return {
            applied: false,
            nextStatus,
            reason: error.message,
        };
    }

    return {
        applied: true,
        nextStatus,
        reason: null,
    };
}

async function normalizePaymentForApprovedSettlement(
    supabaseAdmin: SupabaseAdminClient,
    paymentId: string,
    currentStatus: PersistedFreightPaymentStatus,
    externalPaymentId: string,
    mpPayment: MercadoPagoPaymentLike
) {
    if (!currentStatus || currentStatus === 'pending' || currentStatus === 'completed') {
        return {
            normalized: false,
            reason: null as string | null,
        };
    }

    if (currentStatus === 'refunded') {
        return {
            normalized: false,
            reason: 'payment_already_refunded',
        };
    }

    if (!['processing', 'failed', 'expired'].includes(currentStatus)) {
        return {
            normalized: false,
            reason: `unsupported_status:${currentStatus}`,
        };
    }

    const { error } = await supabaseAdmin
        .from('payments')
        .update({
            status: 'pending',
            gateway: 'mercadopago',
            external_id: externalPaymentId,
            gateway_response: mpPayment,
            error_message: null,
        })
        .eq('id', paymentId)
        .eq('status', currentStatus);

    return {
        normalized: !error,
        reason: error?.message || null,
    };
}

function normalizeNotificationCountryCode(countryCode?: string | null) {
    const normalized = (countryCode || 'CO').toUpperCase();
    return ['CO', 'EC', 'PE', 'BR'].includes(normalized) ? normalized : 'CO';
}

async function resolveOfferCountryCode(
    supabaseAdmin: SupabaseAdminClient,
    offerId?: string | null,
    fallbackCountryCode?: string | null
) {
    if (fallbackCountryCode) {
        return normalizeNotificationCountryCode(fallbackCountryCode);
    }

    if (!offerId) {
        return 'CO';
    }

    const { data } = await supabaseAdmin
        .from('cargo_offers')
        .select('country_code')
        .eq('id', offerId)
        .maybeSingle();

    return normalizeNotificationCountryCode(data?.country_code);
}

async function sendPinNotifications(supabaseAdmin: SupabaseAdminClient, result: PinNotificationResult) {
    if (!result.pickup_pin || !result.delivery_pin) {
        return { success: false, errors: ['No PINs generated'] };
    }

    if (!result.pickup_contact_phone || !result.delivery_contact_phone) {
        return { success: false, errors: ['Missing contact phones'] };
    }

    try {
        const notificationPayload = {
            offerId: result.offer_id || '',
            pickupPin: result.pickup_pin,
            deliveryPin: result.delivery_pin,
            pickupContactPhone: result.pickup_contact_phone,
            pickupContactName: result.pickup_contact_name || 'Contacto',
            deliveryContactPhone: result.delivery_contact_phone,
            deliveryContactName: result.delivery_contact_name || 'Contacto',
            countryCode: await resolveOfferCountryCode(supabaseAdmin, result.offer_id, result.country_code),
        };

        const { baseUrl } = getPaymentRuntimeConfig({
            requireInternalApiKey: true,
            requireNotificationProvider: true,
            requireTwilio: true,
        });

        const response = await fetch(`${baseUrl}/api/notifications/send-pin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(process.env.INTERNAL_API_KEY ? { 'x-internal-api-key': process.env.INTERNAL_API_KEY } : {}),
            },
            body: JSON.stringify(notificationPayload),
        });

        const notificationResult = await response.json().catch(() => null);

        if (!response.ok || !notificationResult) {
            return {
                success: false,
                errors: [
                    'Notification endpoint failed',
                    notificationResult?.error,
                    ...(Array.isArray(notificationResult?.errors) ? notificationResult.errors : []),
                ].filter(Boolean),
            };
        }

        return notificationResult;
    } catch (error) {
        return {
            success: false,
            errors: [error instanceof Error ? error.message : 'Unknown notification error'],
        };
    }
}

function combineDateAndTime(dateValue?: string | null, timeValue?: string | null) {
    if (!dateValue) {
        return new Date().toISOString();
    }

    const time = timeValue || '08:00:00';
    const normalizedTime = time.length === 5 ? `${time}:00` : time;
    return new Date(`${dateValue}T${normalizedTime}`).toISOString();
}

async function createWarehouseAppointmentIfMissing(
    supabaseAdmin: SupabaseAdminClient,
    payload: {
        warehouseId: string;
        dockId?: string | null;
        offerId: string;
        appointmentType: 'pickup' | 'delivery';
        scheduledStart: string;
        scheduledEnd: string;
        truckerName?: string | null;
        truckerPhone?: string | null;
        contactName?: string | null;
        contactPhone?: string | null;
    }
) {
    const { data: existing } = await supabaseAdmin
        .from('warehouse_appointments')
        .select('id')
        .eq('warehouse_id', payload.warehouseId)
        .eq('offer_id', payload.offerId)
        .eq('appointment_type', payload.appointmentType)
        .maybeSingle();

    if (existing) {
        return existing;
    }

    const { data: appointment, error } = await supabaseAdmin
        .from('warehouse_appointments')
        .insert({
            warehouse_id: payload.warehouseId,
            offer_id: payload.offerId,
            dock_id: payload.dockId || null,
            appointment_type: payload.appointmentType,
            status: 'scheduled',
            scheduled_start: payload.scheduledStart,
            scheduled_end: payload.scheduledEnd,
            trucker_name: payload.truckerName || null,
            trucker_phone: payload.truckerPhone || null,
            contact_name: payload.contactName || null,
            contact_phone: payload.contactPhone || null,
            payment_status: 'reserved',
        })
        .select('id')
        .single();

    if (error) {
        throw error;
    }

    const appointmentId = appointment?.id || null;

    if (appointmentId) {
        const offerUpdateField = payload.appointmentType === 'pickup'
            ? { origin_appointment_id: appointmentId }
            : { destination_appointment_id: appointmentId };

        await supabaseAdmin
            .from('cargo_offers')
            .update(offerUpdateField)
            .eq('id', payload.offerId);
    }

    return appointment;
}

async function ensureWarehouseAppointmentsForPaidOffer(
    supabaseAdmin: SupabaseAdminClient,
    offerId?: string | null
) {
    if (!offerId) {
        return { success: true, errors: [] as string[] };
    }

    try {
        const { data: offer, error: offerError } = await supabaseAdmin
            .from('cargo_offers')
            .select(`
                id,
                assigned_trucker_id,
                pickup_date,
                pickup_time_start,
                pickup_time_end,
                delivery_date,
                delivery_time_start,
                delivery_time_end,
                origin_warehouse_id,
                destination_warehouse_id,
                origin_dock_id,
                destination_dock_id,
                origin_appointment_id,
                destination_appointment_id,
                pickup_contact_name,
                pickup_contact_phone,
                delivery_contact_name,
                delivery_contact_phone
            `)
            .eq('id', offerId)
            .maybeSingle();

        if (offerError || !offer) {
            return { success: false, errors: [offerError?.message || 'Offer not found for warehouse sync'] };
        }

        const { data: truckerProfile } = offer.assigned_trucker_id
            ? await supabaseAdmin
                .from('user_profiles')
                .select('full_name, phone')
                .eq('id', offer.assigned_trucker_id)
                .maybeSingle()
            : { data: null as { full_name: string | null; phone: string | null } | null };

        const tasks: Array<Promise<unknown>> = [];

        if (offer.origin_warehouse_id && !offer.origin_appointment_id) {
            tasks.push(
                createWarehouseAppointmentIfMissing(supabaseAdmin, {
                    warehouseId: offer.origin_warehouse_id,
                    dockId: offer.origin_dock_id,
                    offerId: offer.id,
                    appointmentType: 'pickup',
                    scheduledStart: combineDateAndTime(offer.pickup_date, offer.pickup_time_start),
                    scheduledEnd: combineDateAndTime(offer.pickup_date, offer.pickup_time_end),
                    truckerName: truckerProfile?.full_name || null,
                    truckerPhone: truckerProfile?.phone || null,
                    contactName: offer.pickup_contact_name || null,
                    contactPhone: offer.pickup_contact_phone || null,
                })
            );
        }

        if (offer.destination_warehouse_id && !offer.destination_appointment_id) {
            tasks.push(
                createWarehouseAppointmentIfMissing(supabaseAdmin, {
                    warehouseId: offer.destination_warehouse_id,
                    dockId: offer.destination_dock_id,
                    offerId: offer.id,
                    appointmentType: 'delivery',
                    scheduledStart: combineDateAndTime(offer.delivery_date, offer.delivery_time_start),
                    scheduledEnd: combineDateAndTime(offer.delivery_date, offer.delivery_time_end),
                    truckerName: truckerProfile?.full_name || null,
                    truckerPhone: truckerProfile?.phone || null,
                    contactName: offer.delivery_contact_name || null,
                    contactPhone: offer.delivery_contact_phone || null,
                })
            );
        }

        await Promise.all(tasks);
        return { success: true, errors: [] as string[] };
    } catch (error) {
        return {
            success: false,
            errors: [error instanceof Error ? error.message : 'Warehouse sync error'],
        };
    }
}

export async function reconcileFreightPaymentFromMercadoPagoPayment(
    supabaseAdmin: SupabaseAdminClient,
    mpPayment: MercadoPagoPaymentLike
): Promise<FreightSettlementSyncResult> {
    const externalPaymentId = readString(mpPayment.id);
    const refData = parseExternalReference(mpPayment.external_reference);
    const resolvedFreightPayment = await resolveFreightPayment(
        supabaseAdmin,
        mpPayment,
        refData?.kind === 'freight' ? refData : null
    );

    if (!externalPaymentId) {
        return {
            providerStatus: String(mpPayment.status || 'unknown'),
            duplicate: false,
            settlementApplied: false,
            resolvedFreightPayment,
            paymentId: resolvedFreightPayment.paymentId,
            offerId: resolvedFreightPayment.offerId,
            notificationSent: false,
            warehouseSynchronized: false,
            reason: 'missing_provider_payment_id',
        };
    }

    if (mpPayment.status !== 'approved') {
        if (resolvedFreightPayment.offerId || resolvedFreightPayment.paymentId) {
            const statusUpdateResult = await updateFreightPaymentStatus(
                supabaseAdmin,
                resolvedFreightPayment,
                externalPaymentId,
                mpPayment
            );

            if (
                resolvedFreightPayment.offerId &&
                ['refunded', 'charged_back', 'cancelled'].includes(String(mpPayment.status || ''))
            ) {
                await supabaseAdmin.rpc('mark_fuel_advance_offer_at_risk', {
                    p_offer_id: resolvedFreightPayment.offerId,
                    p_reason: `payment_${mpPayment.status}`,
                });
            }

            if (!statusUpdateResult?.applied && statusUpdateResult?.reason && !statusUpdateResult.reason.startsWith('ignored_transition:')) {
                await recordPaymentIncident(supabaseAdmin, {
                    offerId: resolvedFreightPayment.offerId,
                    paymentId: resolvedFreightPayment.paymentId,
                    externalId: externalPaymentId,
                    stage: 'update_freight_payment_status',
                    reason: statusUpdateResult.reason,
                    mpPayment,
                });
            }
        }

        return {
            providerStatus: String(mpPayment.status || 'pending'),
            duplicate: false,
            settlementApplied: false,
            resolvedFreightPayment,
            paymentId: resolvedFreightPayment.paymentId,
            offerId: resolvedFreightPayment.offerId,
            notificationSent: false,
            warehouseSynchronized: false,
            reason: resolvedFreightPayment.offerId || resolvedFreightPayment.paymentId
                ? undefined
                : 'missing_payment_reference',
        };
    }

    if (!resolvedFreightPayment.offerId || !resolvedFreightPayment.paymentId) {
        return {
            providerStatus: 'approved',
            duplicate: false,
            settlementApplied: false,
            resolvedFreightPayment,
            paymentId: resolvedFreightPayment.paymentId,
            offerId: resolvedFreightPayment.offerId,
            notificationSent: false,
            warehouseSynchronized: false,
            reason: 'missing_payment_reference',
        };
    }

    const { data: storedPayment } = await supabaseAdmin
        .from('payments')
        .select('id, status, external_id')
        .eq('id', resolvedFreightPayment.paymentId)
        .maybeSingle();

    if (storedPayment?.status === 'completed' && storedPayment.external_id === externalPaymentId) {
        return {
            providerStatus: 'approved',
            duplicate: true,
            settlementApplied: true,
            resolvedFreightPayment,
            paymentId: resolvedFreightPayment.paymentId,
            offerId: resolvedFreightPayment.offerId,
            notificationSent: true,
            warehouseSynchronized: true,
        };
    }

    const normalizationResult = await normalizePaymentForApprovedSettlement(
        supabaseAdmin,
        resolvedFreightPayment.paymentId,
        (storedPayment?.status as PersistedFreightPaymentStatus | undefined) || null,
        externalPaymentId,
        mpPayment
    );

    if (normalizationResult.reason && normalizationResult.reason !== 'payment_already_refunded') {
        await recordPaymentIncident(supabaseAdmin, {
            offerId: resolvedFreightPayment.offerId,
            paymentId: resolvedFreightPayment.paymentId,
            externalId: externalPaymentId,
            stage: 'normalize_payment_for_approved_settlement',
            reason: normalizationResult.reason,
            mpPayment,
        });
    }

    const runSettlementRpc = async (): Promise<{
        data: unknown;
        errorMessage: string | null;
    }> => {
        const rpcResponse = await supabaseAdmin.rpc('process_successful_payment', {
            p_payment_id: resolvedFreightPayment.paymentId,
            p_external_id: externalPaymentId,
            p_gateway_response: mpPayment,
        });

        return {
            data: rpcResponse.data,
            errorMessage: rpcResponse.error?.message || null,
        };
    };

    let rpcRun = await runSettlementRpc();
    let processResultRows: unknown = rpcRun.data;
    let processErrorMessage: string | null = rpcRun.errorMessage;

    if (
        processErrorMessage?.includes('Estado de pago invalido')
        && !normalizationResult.normalized
        && storedPayment?.status
        && storedPayment.status !== 'completed'
        && storedPayment.status !== 'pending'
        && storedPayment.status !== 'refunded'
    ) {
        const forcedNormalizationResult = await normalizePaymentForApprovedSettlement(
            supabaseAdmin,
            resolvedFreightPayment.paymentId,
            storedPayment.status as PersistedFreightPaymentStatus,
            externalPaymentId,
            mpPayment
        );

        if (forcedNormalizationResult.normalized) {
            rpcRun = await runSettlementRpc();
            processResultRows = rpcRun.data;
            processErrorMessage = rpcRun.errorMessage;
        } else if (forcedNormalizationResult.reason && forcedNormalizationResult.reason !== 'payment_already_refunded') {
            await recordPaymentIncident(supabaseAdmin, {
                offerId: resolvedFreightPayment.offerId,
                paymentId: resolvedFreightPayment.paymentId,
                externalId: externalPaymentId,
                stage: 'forced_normalize_payment_for_approved_settlement',
                reason: forcedNormalizationResult.reason,
                mpPayment,
            });
        }
    }

    if (processErrorMessage) {
        await recordPaymentIncident(supabaseAdmin, {
            offerId: resolvedFreightPayment.offerId,
            paymentId: resolvedFreightPayment.paymentId,
            externalId: externalPaymentId,
            stage: 'rpc_process_successful_payment',
            reason: processErrorMessage,
            mpPayment,
        });

        return {
            providerStatus: 'approved',
            duplicate: false,
            settlementApplied: false,
            resolvedFreightPayment,
            paymentId: resolvedFreightPayment.paymentId,
            offerId: resolvedFreightPayment.offerId,
            notificationSent: false,
            warehouseSynchronized: false,
            reason: processErrorMessage,
        };
    }

    const processResult = Array.isArray(processResultRows) ? processResultRows[0] as PinNotificationResult | undefined : undefined;

    if (!processResult?.success) {
        await recordPaymentIncident(supabaseAdmin, {
            offerId: processResult?.offer_id || resolvedFreightPayment.offerId,
            paymentId: resolvedFreightPayment.paymentId,
            externalId: externalPaymentId,
            stage: 'process_result_unsuccessful',
            reason: processResult?.message || 'Payment processing returned unsuccessful result',
            mpPayment,
        });

        return {
            providerStatus: 'approved',
            duplicate: false,
            settlementApplied: false,
            resolvedFreightPayment,
            paymentId: resolvedFreightPayment.paymentId,
            offerId: resolvedFreightPayment.offerId,
            notificationSent: false,
            warehouseSynchronized: false,
            reason: processResult?.message || 'process_unsuccessful',
        };
    }

    const warehouseSyncResult = await ensureWarehouseAppointmentsForPaidOffer(
        supabaseAdmin,
        processResult.offer_id || resolvedFreightPayment.offerId
    );
    const notificationResult = await sendPinNotifications(supabaseAdmin, processResult);

    if (!warehouseSyncResult.success) {
        await recordPaymentIncident(supabaseAdmin, {
            offerId: processResult.offer_id || resolvedFreightPayment.offerId,
            paymentId: resolvedFreightPayment.paymentId,
            externalId: externalPaymentId,
            stage: 'warehouse_appointment_sync',
            reason: (warehouseSyncResult.errors || ['Warehouse sync failure']).join('; '),
            mpPayment,
        });
    }

    if (!notificationResult.success) {
        await recordPaymentIncident(supabaseAdmin, {
            offerId: processResult.offer_id || resolvedFreightPayment.offerId,
            paymentId: resolvedFreightPayment.paymentId,
            externalId: externalPaymentId,
            stage: 'send_pin_notifications',
            reason: (notificationResult.errors || ['PIN notification failure']).join('; '),
            mpPayment,
        });
    }

    return {
        providerStatus: 'approved',
        duplicate: false,
        settlementApplied: true,
        resolvedFreightPayment,
        paymentId: resolvedFreightPayment.paymentId,
        offerId: processResult.offer_id || resolvedFreightPayment.offerId,
        notificationSent: Boolean(notificationResult.success),
        warehouseSynchronized: Boolean(warehouseSyncResult.success),
    };
}
