'use client';

import { supabase } from '@/lib/supabase/client';
import { extractApiErrorMessage, isApiEnvelope, unwrapApiEnvelope } from '@/lib/contracts/api';
import type {
  CreateLastMileContractPayload,
  LastMileCarrier,
  LastMileContract,
  LastMileProviderScoreSnapshot,
  LastMileRenegotiationRecommendation,
  LastMileRouteLane,
  LastMileSummaryResponse,
} from './types';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string | { message: string; details?: unknown } | null;
  code?: string;
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No active session');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(path, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  });
  const rawText = await response.text();
  const json = rawText ? JSON.parse(rawText) as ApiResponse<T> : {} as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(json, rawText || `Last-mile request failed (${response.status})`));
  }
  if (isApiEnvelope<T>(json)) return unwrapApiEnvelope<T>(json) as T;
  return json as T;
}

function query(params?: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== null && value !== undefined && String(value).trim()) search.set(key, String(value));
  }
  const suffix = search.toString();
  return suffix ? `?${suffix}` : '';
}

export const lastMileClient = {
  getSummary: (params?: { month?: string; businessId?: string }) =>
    request<LastMileSummaryResponse>(`/api/last-mile/dashboard${query(params)}`),
  listCarriers: (params?: { businessId?: string; status?: string; carrierType?: string }) =>
    request<LastMileCarrier[]>(`/api/last-mile/carriers${query(params)}`),
  listLanes: (params?: { businessId?: string; status?: string }) =>
    request<LastMileRouteLane[]>(`/api/last-mile/lanes${query(params)}`),
  listContracts: (params?: { businessId?: string; status?: string; carrierId?: string; laneId?: string }) =>
    request<LastMileContract[]>(`/api/last-mile/contracts${query(params)}`),
  createContract: (payload: CreateLastMileContractPayload & { businessId?: string }) =>
    request<{ contract: LastMileContract }>('/api/last-mile/contracts', { method: 'POST', body: JSON.stringify(payload) }),
  updateContract: (contractId: string, payload: Partial<CreateLastMileContractPayload> & { status?: string; businessId?: string }) =>
    request<{ contract: LastMileContract }>(`/api/last-mile/contracts/${contractId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  syncObservations: (payload?: { month?: string; offerId?: string; dryRun?: boolean; businessId?: string }) =>
    request<{ runId: string; processedOffers: number; createdObservations: number; updatedObservations: number; createdRecommendations: number; dryRun: boolean }>('/api/last-mile/observations/sync', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
  listScorecards: (params?: { month?: string; businessId?: string }) =>
    request<LastMileProviderScoreSnapshot[]>(`/api/last-mile/scorecards${query(params)}`),
  listRecommendations: (params?: { month?: string; businessId?: string; status?: string; severity?: string }) =>
    request<LastMileRenegotiationRecommendation[]>(`/api/last-mile/recommendations${query(params)}`),
  updateRecommendation: (recommendationId: string, payload: { status?: string; assignedTo?: string | null; resolutionNote?: string | null; businessId?: string }) =>
    request<{ recommendation: LastMileRenegotiationRecommendation }>(`/api/last-mile/recommendations/${recommendationId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export default lastMileClient;
