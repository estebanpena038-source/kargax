'use client';

import { supabase } from '@/lib/supabase/client';
import { extractApiErrorMessage, isApiEnvelope, unwrapApiEnvelope } from '@/lib/contracts/api';
import type {
    CreateLastMileContractPayload,
    LastMileContract,
    LastMileDashboardResponse,
    LastMileRecomputeResult,
    LastMileRenegotiationRecommendation,
    LastMileRecommendationStatus,
} from './types';

interface LastMileApiResponse<T> {
    success?: boolean;
    data?: T;
    error?: string | { message: string; details?: unknown } | null;
    code?: string;
    meta?: {
        requestId?: string;
        [key: string]: unknown;
    };
}

export class LastMileApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    requestId?: string;

    constructor(message: string, options: { status: number; code?: string; details?: unknown; requestId?: string }) {
        super(message);
        this.name = 'LastMileApiError';
        this.status = options.status;
        this.code = options.code;
        this.details = options.details;
        this.requestId = options.requestId;
    }
}

async function getAuthHeaders() {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new LastMileApiError('Sesion no activa', { status: 401, code: 'UNAUTHORIZED' });
    }

    return {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
    };
}

async function parseResponse<T>(response: Response) {
    const rawText = await response.text();
    if (!rawText) return {} as LastMileApiResponse<T>;

    try {
        return JSON.parse(rawText) as LastMileApiResponse<T>;
    } catch {
        return {} as LastMileApiResponse<T>;
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
    const json = await parseResponse<T>(response);

    if (!response.ok) {
        const details = json?.error && typeof json.error === 'object' && 'details' in json.error
            ? json.error.details
            : undefined;
        throw new LastMileApiError(
            extractApiErrorMessage(json, `Solicitud Last-Mile fallida (${response.status})`),
            {
                status: response.status,
                code: json?.code,
                details,
                requestId: json?.meta?.requestId,
            }
        );
    }

    if (isApiEnvelope<T>(json)) {
        return unwrapApiEnvelope<T>(json) as T;
    }

    return json as T;
}

function withParams(path: string, params?: Record<string, string | number | boolean | null | undefined>) {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            search.set(key, String(value));
        }
    });
    const suffix = search.toString();
    return suffix ? `${path}?${suffix}` : path;
}

export const lastMileClient = {
    getDashboard: (params?: { month?: string; businessId?: string }) =>
        request<LastMileDashboardResponse>(withParams('/api/last-mile/dashboard', params)),
    listContracts: (params?: { status?: string; businessId?: string }) =>
        request<LastMileContract[]>(withParams('/api/last-mile/contracts', params)),
    createContract: (payload: CreateLastMileContractPayload) =>
        request<{ contract: LastMileContract }>('/api/last-mile/contracts', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateContract: (contractId: string, payload: Partial<CreateLastMileContractPayload>) =>
        request<{ contract: LastMileContract }>(`/api/last-mile/contracts/${contractId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    archiveContract: (contractId: string, payload?: { businessId?: string }) =>
        request<{ contract: LastMileContract }>(`/api/last-mile/contracts/${contractId}`, {
            method: 'DELETE',
            body: JSON.stringify(payload || {}),
        }),
    recomputeSnapshots: (payload: { month?: string; offerId?: string; businessId?: string; dryRun?: boolean; limit?: number }) =>
        request<LastMileRecomputeResult>('/api/last-mile/snapshots/recompute', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateAlert: (alertId: string, payload: { status?: LastMileRecommendationStatus; resolutionNote?: string | null; assignedTo?: string | null; businessId?: string }) =>
        request<{ alert: LastMileRenegotiationRecommendation }>(`/api/last-mile/alerts/${alertId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    listRenegotiations: (params?: { status?: string; severity?: string; businessId?: string }) =>
        request<{ renegotiations: LastMileRenegotiationRecommendation[] }>(withParams('/api/last-mile/renegotiations', params)),
    createRenegotiation: (payload: {
        businessId?: string;
        carrierId?: string | null;
        laneId?: string | null;
        contractId?: string | null;
        triggerType?: string;
        severity?: string;
        title: string;
        description: string;
        expectedSavingCop?: number;
        confidenceScore?: number;
        recommendedAction?: string | null;
        assignedTo?: string | null;
        dueAt?: string | null;
    }) =>
        request<{ renegotiation: LastMileRenegotiationRecommendation }>('/api/last-mile/renegotiations', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateRenegotiation: (renegotiationId: string, payload: { status?: LastMileRecommendationStatus; resolutionNote?: string | null; assignedTo?: string | null; businessId?: string }) =>
        request<{ renegotiation: LastMileRenegotiationRecommendation }>(`/api/last-mile/renegotiations/${renegotiationId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
};

export default lastMileClient;
