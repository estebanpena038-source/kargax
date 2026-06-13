import { NextRequest } from 'next/server';
import { requireStaffCapability, type InternalAdminCapability } from '@/lib/server/staff';

export {
    getCapabilitiesForRoles,
    getCapabilitiesForStaffRoles,
    getRequestAuditMetadata,
    hasInternalAdminCapability,
    hasStaffCapability,
    recordStaffAuditEvent,
    requireStaffCapability,
    resolveInternalAdminRoles,
    resolveStaffRoles,
} from '@/lib/server/staff';

export type {
    InternalAdminCapability,
    InternalAdminRole,
    StaffCapability,
    StaffContext,
    StaffRole,
} from '@/lib/server/staff';

export function requireInternalAdminCapability(
    request: NextRequest,
    capability: InternalAdminCapability,
    options: { requireAal2?: boolean } = {}
) {
    return requireStaffCapability(request, capability, {
        requireAal2: options.requireAal2 ?? true,
    });
}
