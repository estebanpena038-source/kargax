import type { SecurityHeaderOptions } from '../../../security-headers.config';
import {
    CONTENT_SECURITY_POLICY,
    getSecurityHeaderEntries,
    shouldIncludeContentSecurityPolicyReportOnly,
    shouldIncludeStrictTransportSecurity,
} from '../../../security-headers.config';

export {
    CONTENT_SECURITY_POLICY,
    getSecurityHeaderEntries,
    shouldIncludeContentSecurityPolicyReportOnly,
    shouldIncludeStrictTransportSecurity,
};

export type { SecurityHeaderOptions };

export function applySecurityHeaders<T extends { headers: Headers }>(
    response: T,
    options: SecurityHeaderOptions = {}
): T {
    for (const header of getSecurityHeaderEntries(options)) {
        response.headers.set(header.key, header.value);
    }

    return response;
}
