'use client';

import { supabase } from '@/lib/supabase/client';
import { extractApiErrorMessage, isApiEnvelope, unwrapApiEnvelope } from '@/lib/contracts/api';
import {
    PlanLimitReachedError,
    coercePlanLimitDetails,
    recordPlanLimitEvent,
} from '@/lib/billing/plan-limits';
import type {
    BusinessFleetResponse,
    PrivateFleetDriverContext,
    PrivateFleetPayrollResponse,
    HoldingApprovalsResponse,
    HoldingApprovalCreationResponse,
    HoldingFinancePolicyResponse,
    BusinessTeamResponse,
    HoldingAccessResponse,
    HoldingBusinessesResponse,
    HoldingMembersResponse,
    HoldingSummaryResponse,
    Warehouse,
    WarehouseAppointment,
    WarehouseAccessResponse,
    WarehouseDetailResponse,
    WarehouseDispatchOrder,
    WarehouseDock,
    WarehouseIncident,
    WarehouseListResponse,
    WarehouseReceipt,
    WarehouseSkuImage,
    WarehouseStockBalance,
    WarehouseTask,
} from './types';
import type {
    AdminOverviewResponse,
    MarketContext,
    OnboardingChecklist,
    PlatformIncident,
    SupportRequest,
} from '@/lib/platform/types';
import type { EditableBusinessTeamRole } from '@/lib/business-roles';

interface WarehouseApiResponse<T> {
    success?: boolean;
    data?: T;
    error?: string | { message: string; details?: unknown } | null;
    code?: string;
    meta?: {
        requestId?: string;
        [key: string]: unknown;
    };
    warehouse?: Warehouse;
    plans?: WarehouseDetailResponse['plans'];
    subscription?: WarehouseDetailResponse['subscription'];
    limits?: WarehouseListResponse['limits'];
}

async function getAuthHeaders() {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('No active session');
    }

    return {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
    };
}

async function parseApiResponse<T>(response: Response): Promise<{
    json: WarehouseApiResponse<T> & Partial<T>;
    rawText: string;
}> {
    const rawText = await response.text();

    if (!rawText) {
        return {
            json: {} as WarehouseApiResponse<T> & Partial<T>,
            rawText,
        };
    }

    try {
        return {
            json: JSON.parse(rawText) as WarehouseApiResponse<T> & Partial<T>,
            rawText,
        };
    } catch {
        return {
            json: {} as WarehouseApiResponse<T> & Partial<T>,
            rawText,
        };
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(path, {
        ...init,
        headers: {
            ...headers,
            ...(init?.headers || {}),
        },
    });

    const { json, rawText } = await parseApiResponse<T>(response);

    if (!response.ok) {
        const message = extractApiErrorMessage(json, rawText || `Warehouse request failed (${response.status})`);
        const details = coercePlanLimitDetails(
            json?.error && typeof json.error === 'object' && 'details' in json.error
                ? json.error.details
                : null
        );

        if (response.status === 402 && json?.code === 'PLAN_LIMIT_REACHED' && details) {
            void recordPlanLimitEvent(details, message, headers);
            throw new PlanLimitReachedError(message, details);
        }

        throw new Error(message);
    }

    if (!rawText) {
        throw new Error('Empty API response');
    }

    if (isApiEnvelope<T>(json)) {
        return unwrapApiEnvelope<T>(json) as T;
    }

    return json as T;
}

async function requestEnvelope<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(path, {
        ...init,
        headers: {
            ...headers,
            ...(init?.headers || {}),
        },
    });

    const { json, rawText } = await parseApiResponse<T>(response);

    if (!response.ok) {
        const message = extractApiErrorMessage(json, rawText || `Warehouse request failed (${response.status})`);
        const details = coercePlanLimitDetails(
            json?.error && typeof json.error === 'object' && 'details' in json.error
                ? json.error.details
                : null
        );

        if (response.status === 402 && json?.code === 'PLAN_LIMIT_REACHED' && details) {
            void recordPlanLimitEvent(details, message, headers);
            throw new PlanLimitReachedError(message, details);
        }

        throw new Error(message);
    }

    if (!rawText) {
        throw new Error('Empty API response');
    }

    if (isApiEnvelope<T>(json)) {
        return unwrapApiEnvelope<T>(json) as T;
    }

    return json as T;
}

export const warehouseClient = {
    list: () => requestEnvelope<WarehouseListResponse>('/api/warehouses'),
    create: (payload: Record<string, unknown>) =>
        request<Warehouse>('/api/warehouses', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    get: (warehouseId: string) => request<WarehouseDetailResponse>(`/api/warehouses/${warehouseId}`),
    update: (warehouseId: string, payload: Record<string, unknown>) =>
        request<Warehouse>(`/api/warehouses/${warehouseId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    listDocks: (warehouseId: string) => request<WarehouseDock[]>(`/api/warehouses/${warehouseId}/docks`),
    createDock: (warehouseId: string, payload: Record<string, unknown>) =>
        request<WarehouseDock>(`/api/warehouses/${warehouseId}/docks`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    listAppointments: (warehouseId: string) =>
        request<WarehouseAppointment[]>(`/api/warehouses/${warehouseId}/appointments`),
    createAppointment: (warehouseId: string, payload: Record<string, unknown>) =>
        request<WarehouseAppointment>(`/api/warehouses/${warehouseId}/appointments`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateAppointment: (warehouseId: string, appointmentId: string, payload: Record<string, unknown>) =>
        request<WarehouseAppointment>(`/api/warehouses/${warehouseId}/appointments/${appointmentId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    listStock: (warehouseId: string) => request<WarehouseStockBalance[]>(`/api/warehouses/${warehouseId}/stock`),
    adjustStock: (warehouseId: string, payload: Record<string, unknown>) =>
        request<WarehouseStockBalance>(`/api/warehouses/${warehouseId}/stock`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    listReceipts: (warehouseId: string) => request<WarehouseReceipt[]>(`/api/warehouses/${warehouseId}/receipts`),
    createReceipt: (warehouseId: string, payload: Record<string, unknown>) =>
        request<WarehouseReceipt>(`/api/warehouses/${warehouseId}/receipts`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateReceipt: (warehouseId: string, receiptId: string, payload: Record<string, unknown>) =>
        request<WarehouseReceipt>(`/api/warehouses/${warehouseId}/receipts/${receiptId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    listDispatches: (warehouseId: string) =>
        request<WarehouseDispatchOrder[]>(`/api/warehouses/${warehouseId}/dispatches`),
    createDispatch: (warehouseId: string, payload: Record<string, unknown>) =>
        request<WarehouseDispatchOrder>(`/api/warehouses/${warehouseId}/dispatches`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateDispatch: (warehouseId: string, dispatchId: string, payload: Record<string, unknown>) =>
        request<WarehouseDispatchOrder>(`/api/warehouses/${warehouseId}/dispatches/${dispatchId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    listTasks: (warehouseId: string) => request<WarehouseTask[]>(`/api/warehouses/${warehouseId}/tasks`),
    createTask: (warehouseId: string, payload: Record<string, unknown>) =>
        request<WarehouseTask>(`/api/warehouses/${warehouseId}/tasks`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateTask: (warehouseId: string, taskId: string, payload: Record<string, unknown>) =>
        request<WarehouseTask>(`/api/warehouses/${warehouseId}/tasks/${taskId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    listIncidents: (warehouseId: string) =>
        request<WarehouseIncident[]>(`/api/warehouses/${warehouseId}/incidents`),
    createIncident: (warehouseId: string, payload: Record<string, unknown>) =>
        request<WarehouseIncident>(`/api/warehouses/${warehouseId}/incidents`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateIncident: (warehouseId: string, incidentId: string, payload: Record<string, unknown>) =>
        request<WarehouseIncident>(`/api/warehouses/${warehouseId}/incidents/${incidentId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    getBillingSubscription: () => request<{
        subscription: WarehouseListResponse['subscription'];
        plans: WarehouseListResponse['plans'];
        limits: WarehouseListResponse['limits'];
        canManageBilling?: boolean;
        teamSchemaReady?: WarehouseListResponse['teamSchemaReady'];
        teamSchemaMessage?: WarehouseListResponse['teamSchemaMessage'];
        billingCheckoutReady?: WarehouseListResponse['billingCheckoutReady'];
        billingCheckoutMessage?: WarehouseListResponse['billingCheckoutMessage'];
    }>('/api/billing/subscription'),
    getBillingUsage: () => request<{
        subscription: WarehouseListResponse['subscription'];
        limits: WarehouseListResponse['limits'];
        usage: WarehouseListResponse['limits'];
        teamSchemaReady?: WarehouseListResponse['teamSchemaReady'];
        teamSchemaMessage?: WarehouseListResponse['teamSchemaMessage'];
        billingCheckoutReady?: WarehouseListResponse['billingCheckoutReady'];
        billingCheckoutMessage?: WarehouseListResponse['billingCheckoutMessage'];
    }>('/api/billing/subscription/usage'),
    updatePlan: (payload: { planCode: string; businessId?: string; status?: string }) =>
        request<{
            subscription: WarehouseListResponse['subscription'];
            plans: WarehouseListResponse['plans'];
            limits: WarehouseListResponse['limits'];
            teamSchemaReady?: WarehouseListResponse['teamSchemaReady'];
            teamSchemaMessage?: WarehouseListResponse['teamSchemaMessage'];
            billingCheckoutReady?: WarehouseListResponse['billingCheckoutReady'];
            billingCheckoutMessage?: WarehouseListResponse['billingCheckoutMessage'];
        }>('/api/billing/subscription', {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    createPlanCheckout: (payload: { planCode: string; businessId?: string }) =>
        request<{
            success: boolean;
            preference: {
                id: string;
                init_point?: string | null;
                sandbox_init_point?: string | null;
            };
            attemptId: string;
        }>('/api/billing/subscription/checkout', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    getWarehouseAccess: () => requestEnvelope<WarehouseAccessResponse>('/api/warehouses/access'),
    getHoldingAccess: () => requestEnvelope<HoldingAccessResponse>('/api/holding/access'),
    getHoldingSummary: (holdingId?: string) =>
        requestEnvelope<HoldingSummaryResponse>(holdingId ? `/api/holding/summary?holdingId=${encodeURIComponent(holdingId)}` : '/api/holding/summary'),
    getHoldingBusinesses: (holdingId?: string) =>
        requestEnvelope<HoldingBusinessesResponse>(holdingId ? `/api/holding/businesses?holdingId=${encodeURIComponent(holdingId)}` : '/api/holding/businesses'),
    linkHoldingBusiness: (payload: { businessId: string; relationshipType: 'parent' | 'subsidiary' | 'brand' | 'operator'; holdingId?: string }) =>
        request<{ success: boolean; mode: 'linked' | 'approval_requested' }>('/api/holding/businesses', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    unlinkHoldingBusiness: (businessId: string, payload?: { holdingId?: string }) =>
        request<{ success: boolean }>(`/api/holding/businesses/${businessId}`, {
            method: 'DELETE',
            body: JSON.stringify(payload || {}),
        }),
    getHoldingMembers: (holdingId?: string) =>
        requestEnvelope<HoldingMembersResponse>(holdingId ? `/api/holding/members?holdingId=${encodeURIComponent(holdingId)}` : '/api/holding/members'),
    inviteHoldingMember: (payload: { email: string; role: 'holding_owner' | 'finance_admin' | 'ops_admin' | 'analyst'; holdingId?: string }) =>
        request<{ data: unknown; mode: 'invited' | 'linked_existing_user' }>('/api/holding/members', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateHoldingMember: (memberId: string, payload: { role?: 'holding_owner' | 'finance_admin' | 'ops_admin' | 'analyst'; status?: 'active' | 'suspended'; holdingId?: string }) =>
        request<{ data: unknown }>(`/api/holding/members/${memberId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    getHoldingApprovals: (holdingId?: string) =>
        requestEnvelope<HoldingApprovalsResponse>(holdingId ? `/api/holding/approvals?holdingId=${encodeURIComponent(holdingId)}` : '/api/holding/approvals'),
    createHoldingApproval: (payload: {
        holdingId?: string;
        businessId?: string;
        requestType: 'business_link' | 'credit_policy' | 'wallet_release' | 'plan_upgrade' | 'ops_exception' | 'custom';
        priority?: 'low' | 'medium' | 'high' | 'critical';
        title: string;
        description?: string;
        payload?: Record<string, unknown>;
    }) =>
        request<HoldingApprovalCreationResponse>('/api/holding/approvals', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateHoldingApproval: (approvalId: string, payload: {
        holdingId?: string;
        status: 'approved' | 'rejected' | 'cancelled';
        decisionNote?: string;
        assignedTo?: string | null;
    }) =>
        request<{ data: unknown }>(`/api/holding/approvals/${approvalId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    getHoldingFinancePolicy: (holdingId?: string) =>
        requestEnvelope<HoldingFinancePolicyResponse>(holdingId ? `/api/holding/finance-policy?holdingId=${encodeURIComponent(holdingId)}` : '/api/holding/finance-policy'),
    updateHoldingFinancePolicy: (payload: {
        holdingId?: string;
        maxSingleAdvanceCop: number;
        maxBusinessExposureCop: number;
        maxPortfolioExposureCop: number;
        walletReleaseLimitCop: number;
        autoApprovePlanUpgradesUntilUsd: number;
        allowHighRiskOperations: boolean;
        allowCriticalRiskOperations: boolean;
    }) =>
        request<{ data: unknown }>('/api/holding/finance-policy', {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    setActiveWarehouse: (activeWarehouseId: string | null) =>
        request<{ success: boolean; activeWarehouseId: string | null }>('/api/warehouses/access', {
            method: 'PATCH',
            body: JSON.stringify({ activeWarehouseId }),
        }),
    getBusinessTeam: () => requestEnvelope<BusinessTeamResponse>('/api/business/team'),
    getBusinessFleet: () => requestEnvelope<BusinessFleetResponse>('/api/business/fleet'),
    getPrivateFleetDriverContext: () => requestEnvelope<PrivateFleetDriverContext>('/api/business/fleet/me'),
    createBusinessTeamUser: (payload: {
        fullName: string;
        email: string;
        phone: string;
        countryCode: 'CO' | 'EC' | 'PE' | 'BR';
        documentType?: string | null;
        documentNumber?: string | null;
        role: EditableBusinessTeamRole;
        password: string;
        warehouseIds?: string[];
    }) =>
        request<{ data: unknown; mode: 'created_user' | 'linked_existing_user' }>('/api/business/team/create-user', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    createBusinessFleetDriver: (payload: {
        fullName: string;
        email: string;
        phone: string;
        countryCode: 'CO' | 'EC' | 'PE' | 'BR';
        documentType: string;
        documentNumber: string;
        password: string;
        licenseNumber: string;
        licenseType: string;
        yearsExperience?: number;
        vehiclePlate: string;
        internalDriverId?: string | null;
        vehicleType?: string | null;
        serviceAreas?: string[];
        notes?: string | null;
    }) =>
        request<{ data: unknown; mode: 'created_user' | 'linked_existing_user' }>('/api/business/fleet/create-driver', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    createBusinessFleetInvitation: (payload?: { expiresHours?: number }) =>
        request<{
            invitationId: string;
            inviteCode: string;
            inviteLink: string;
            whatsappMessage: string;
            expiresAt: string;
        }>('/api/business/fleet', {
            method: 'POST',
            body: JSON.stringify(payload || {}),
        }),
    updateBusinessFleetMember: (memberId: string, payload: {
        status?: 'active' | 'suspended' | 'removed';
        internalDriverId?: string | null;
        vehiclePlate?: string | null;
        notes?: string | null;
        defaultCompensationMode?: 'salary_no_trip_pay' | 'trip_pay' | 'expenses_only' | 'trip_pay_plus_expenses';
        monthlySalaryAmount?: number | null;
        monthlySalaryCurrency?: 'COP' | 'USD' | 'PEN' | 'BRL' | null;
        payrollDay?: number | null;
        payrollNotes?: string | null;
    }) =>
        request<{ data: unknown }>(`/api/business/fleet/${memberId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    getPrivateFleetPayroll: () => requestEnvelope<PrivateFleetPayrollResponse>('/api/business/fleet/payroll'),
    createPrivateFleetPayroll: (payload?: {
        periodStart?: string;
        periodEnd?: string;
        currencyCode?: 'COP' | 'USD' | 'PEN' | 'BRL';
        items?: Array<{ fleetMemberId: string; amount: number }>;
    }) =>
        request<{ run: PrivateFleetPayrollResponse['runs'][number] }>('/api/business/fleet/payroll', {
            method: 'POST',
            body: JSON.stringify(payload || {}),
        }),
    approvePrivateFleetPayroll: (runId: string) =>
        request<{ run: PrivateFleetPayrollResponse['runs'][number] }>(`/api/business/fleet/payroll/${runId}/approve`, {
            method: 'POST',
            body: JSON.stringify({}),
        }),
    checkoutPrivateFleetPayroll: (runId: string) =>
        request<{
            preference: {
                id?: string | null;
                init_point?: string | null;
                sandbox_init_point?: string | null;
            };
            runId: string;
            grossAmount: number;
            processingFeeAmount: number;
            totalAmount: number;
            currencyCode: string;
        }>(`/api/business/fleet/payroll/${runId}/checkout`, {
            method: 'POST',
            body: JSON.stringify({}),
        }),
    acceptBusinessFleetInvitation: (payload?: {
        inviteCode?: string;
        internalDriverId?: string;
        vehiclePlate?: string;
    }) =>
        request<{ businessId: string; membershipId: string | null }>('/api/business/fleet/accept', {
            method: 'POST',
            body: JSON.stringify(payload || {}),
        }),
    confirmPrivateFleetOffer: (payload: { offerId: string }) =>
        request<{
            paymentId: string;
            expenseAmount: number;
            freightAmount: number;
            pickupPin: string | null;
            deliveryPin: string | null;
        }>('/api/business/fleet/confirm-offer', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    acceptPrivateFleetTrip: (offerId: string) =>
        request<{
            offerId: string;
            assignmentStatus: 'accepted';
            paymentId: string;
            expenseAmount: number;
            freightAmount: number;
            pickupPin: string | null;
            deliveryPin: string | null;
        }>(`/api/business/fleet/trips/${offerId}/accept`, {
            method: 'POST',
            body: JSON.stringify({}),
        }),
    rejectPrivateFleetTrip: (offerId: string, payload?: { reason?: string | null }) =>
        request<{
            offerId: string;
            assignmentStatus: 'rejected';
            alreadyRejected?: boolean;
        }>(`/api/business/fleet/trips/${offerId}/reject`, {
            method: 'POST',
            body: JSON.stringify(payload || {}),
        }),
    inviteBusinessTeamMember: (payload: { email: string; role: EditableBusinessTeamRole }) =>
        request<{ data: unknown; mode: 'invited' | 'linked_existing_user' }>('/api/business/team', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateBusinessTeamMember: (memberId: string, payload: { role?: EditableBusinessTeamRole; status?: 'active' | 'suspended' }) =>
        request<{ data: unknown }>(`/api/business/team/${memberId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    assignBusinessTeamWarehouses: (memberId: string, warehouseIds: string[]) =>
        request<{ success: boolean }>(`/api/business/team/${memberId}/warehouses`, {
            method: 'POST',
            body: JSON.stringify({ warehouseIds }),
        }),
    acceptBusinessInvitation: () =>
        request<{ data: unknown }>('/api/business/team/accept', {
            method: 'POST',
        }),
    uploadSkuImage: async (skuId: string, file: File, options?: { isCover?: boolean }) => {
        const headers = await getAuthHeaders();
        const formData = new FormData();
        formData.append('skuId', skuId);
        formData.append('file', file);
        if (options?.isCover) {
            formData.append('isCover', 'true');
        }

        const response = await fetch('/api/inventory/sku-images', {
            method: 'POST',
            headers: {
                Authorization: headers.Authorization,
            },
            body: formData,
        });

        const json = (await response.json()) as WarehouseApiResponse<WarehouseSkuImage>;

        if (!response.ok) {
            throw new Error(extractApiErrorMessage(json, 'Warehouse request failed'));
        }

        return json.data as WarehouseSkuImage;
    },
    deleteSkuImage: (imageId: string) =>
        request<{ success: boolean }>(`/api/inventory/sku-images/${imageId}`, {
            method: 'DELETE',
        }),
    getAdminOverview: () => request<AdminOverviewResponse>('/api/admin/overview'),
    getAdminIncidents: (params?: { status?: string; domain?: string; limit?: number }) => {
        const search = new URLSearchParams();
        if (params?.status) search.set('status', params.status);
        if (params?.domain) search.set('domain', params.domain);
        if (params?.limit) search.set('limit', String(params.limit));
        const suffix = search.toString() ? `?${search.toString()}` : '';
        return request<PlatformIncident[]>(`/api/admin/incidents${suffix}`);
    },
    getAdminIncident: (incidentId: string) => request<PlatformIncident>(`/api/admin/incidents/${incidentId}`),
    replayAdminIncident: (incidentId: string) =>
        request<{ incidentId: string; replayAction: string; replay: Record<string, unknown> }>(`/api/admin/incidents/${incidentId}/replay`, {
            method: 'POST',
        }),
    createSupportRequest: (payload: {
        requesterName: string;
        requesterEmail: string;
        subject: string;
        description: string;
        domain?: string;
        priority?: string;
        preferredContactChannel?: string;
        countryCode?: string;
        company?: string;
        phone?: string;
        persona?: string;
    }) =>
        request<SupportRequest>('/api/support/requests', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
        }),
    getSupportRequests: () => request<SupportRequest[]>('/api/support/requests'),
    getMarketContext: (params?: { countryCode?: string; locale?: string }) => {
        const search = new URLSearchParams();
        if (params?.countryCode) search.set('countryCode', params.countryCode);
        if (params?.locale) search.set('locale', params.locale);
        const suffix = search.toString() ? `?${search.toString()}` : '';
        return request<MarketContext>(`/api/market/context${suffix}`);
    },
    getOnboardingChecklist: (persona?: string) =>
        request<OnboardingChecklist>(persona ? `/api/onboarding/checklist?persona=${encodeURIComponent(persona)}` : '/api/onboarding/checklist'),
    getOnboardingStatus: () =>
        request<Record<string, unknown>>('/api/onboarding/status'),
};

export default warehouseClient;
