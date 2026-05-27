import { z } from 'zod';

const nullableTrimmedString = z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === 'string' && value.trim() ? value.trim() : null));

const money = z.coerce.number().finite().min(0);

const lastMileContractBaseSchema = z.object({
    businessId: z.string().uuid().optional(),
    carrierId: z.string().uuid().optional(),
    carrierType: z.enum(['private_fleet', 'marketplace', 'external_provider']).default('external_provider'),
    providerKey: z.string().trim().min(2).max(160).optional(),
    providerName: z.string().trim().min(2).max(180).optional(),
    legalName: nullableTrimmedString,
    profileUserId: nullableTrimmedString.pipe(z.string().uuid().nullable()),
    fleetMemberId: nullableTrimmedString.pipe(z.string().uuid().nullable()),
    contactName: nullableTrimmedString,
    contactPhone: nullableTrimmedString,
    contactEmail: nullableTrimmedString,
    laneId: nullableTrimmedString.pipe(z.string().uuid().nullable()),
    originDepartment: nullableTrimmedString,
    originCity: nullableTrimmedString,
    originZone: nullableTrimmedString,
    originWarehouseId: nullableTrimmedString.pipe(z.string().uuid().nullable()),
    destinationDepartment: nullableTrimmedString,
    destinationCity: nullableTrimmedString,
    destinationZone: nullableTrimmedString,
    destinationWarehouseId: nullableTrimmedString.pipe(z.string().uuid().nullable()),
    vehicleType: nullableTrimmedString,
    cargoType: nullableTrimmedString,
    serviceLevel: z.enum(['standard', 'express', 'refrigerated', 'fragile', 'custom']).default('standard'),
    sourceKind: z.enum(['manual', 'marketplace_observed', 'private_fleet_policy', 'renegotiated']).default('manual'),
    status: z.enum(['draft', 'active', 'paused', 'expired', 'superseded']).default('draft'),
    pricingModel: z.enum(['per_trip', 'per_km', 'per_kg', 'hybrid', 'monthly_retainer']),
    currencyCode: z.enum(['COP', 'USD', 'PEN', 'BRL']).default('COP'),
    baseRateCop: money,
    perKmRateCop: money.default(0),
    perKgRateCop: money.default(0),
    minimumRateCop: money.default(0),
    maximumRateCop: z.union([money, z.null()]).optional().default(null),
    fuelSurchargeCop: money.default(0),
    otherSurchargeCop: money.default(0),
    paymentTermsDays: z.coerce.number().int().min(0).max(120).default(30),
    evidenceRequired: z.record(z.string(), z.unknown()).optional().default({}),
    slaRules: z.record(z.string(), z.unknown()).optional().default({}),
    penaltyRules: z.record(z.string(), z.unknown()).optional().default({}),
    startsAt: z.string().trim().min(8),
    endsAt: nullableTrimmedString,
    notes: nullableTrimmedString,
});

export const lastMileContractPayloadSchema = lastMileContractBaseSchema.superRefine((value, context) => {
    if (!value.carrierId && !value.providerName && !value.profileUserId && !value.fleetMemberId) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['providerName'],
            message: 'Proveedor requerido para crear contrato',
        });
    }

    if (value.maximumRateCop !== null && value.maximumRateCop < value.minimumRateCop) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['maximumRateCop'],
            message: 'La tarifa maxima no puede ser menor a la minima',
        });
    }
});

export const lastMileContractPatchSchema = lastMileContractBaseSchema.partial().extend({
    businessId: z.string().uuid().optional(),
    status: z.enum(['draft', 'active', 'paused', 'expired', 'superseded']).optional(),
}).superRefine((value, context) => {
    if (
        value.maximumRateCop !== undefined &&
        value.maximumRateCop !== null &&
        value.minimumRateCop !== undefined &&
        value.maximumRateCop < value.minimumRateCop
    ) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['maximumRateCop'],
            message: 'La tarifa maxima no puede ser menor a la minima',
        });
    }
});

export const lastMileRecomputeSchema = z.object({
    businessId: z.string().uuid().optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    offerId: z.string().uuid().optional(),
    dryRun: z.boolean().optional().default(false),
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    windowDays: z.coerce.number().int().min(1).max(120).optional(),
});

export const lastMileRecommendationPatchSchema = z.object({
    businessId: z.string().uuid().optional(),
    status: z.enum(['open', 'acknowledged', 'in_negotiation', 'accepted', 'rejected', 'closed']).optional(),
    assignedTo: nullableTrimmedString.pipe(z.string().uuid().nullable()).optional(),
    resolutionNote: nullableTrimmedString.optional(),
});

export const lastMileRecommendationCreateSchema = z.object({
    businessId: z.string().uuid().optional(),
    carrierId: nullableTrimmedString.pipe(z.string().uuid().nullable()),
    laneId: nullableTrimmedString.pipe(z.string().uuid().nullable()),
    contractId: nullableTrimmedString.pipe(z.string().uuid().nullable()),
    triggerType: z.enum(['cost_overrun', 'incident_rate', 'evidence_missing', 'volume_discount', 'supplier_underperformance', 'contract_expiring', 'benchmark_gap']).default('benchmark_gap'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    title: z.string().trim().min(4).max(180),
    description: z.string().trim().min(8).max(1200),
    expectedSavingCop: money.default(0),
    confidenceScore: z.coerce.number().min(0).max(100).default(60),
    recommendedAction: nullableTrimmedString,
    assignedTo: nullableTrimmedString.pipe(z.string().uuid().nullable()),
    dueAt: nullableTrimmedString,
    periodStart: z.string().trim().min(8).optional(),
    periodEnd: z.string().trim().min(8).optional(),
});

export type LastMileContractPayload = z.infer<typeof lastMileContractPayloadSchema>;
export type LastMileContractPatch = z.infer<typeof lastMileContractPatchSchema>;
export type LastMileRecomputePayload = z.infer<typeof lastMileRecomputeSchema>;
export type LastMileRecommendationPatch = z.infer<typeof lastMileRecommendationPatchSchema>;
export type LastMileRecommendationCreate = z.infer<typeof lastMileRecommendationCreateSchema>;
