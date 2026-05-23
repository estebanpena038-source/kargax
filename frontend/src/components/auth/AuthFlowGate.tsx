'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getMfaStatus, getPostAuthRoute } from '@/lib/auth/mfa';

const MFA_ROUTES = ['/auth/mfa/setup', '/auth/mfa/verify'];
const MFA_ESCAPE_ROUTES = [
    '/login',
    '/registro',
    '/recuperar-contrasena',
    '/auth/reset-password',
];
const AUTH_EXEMPT_ROUTES = [
    '/',
    '/login',
    '/registro',
    '/verificar-email',
    '/recuperar-contrasena',
    '/auth/reset-password',
    '/auth/callback',
    '/auth/invite/accept',
    '/onboarding', // Onboarding is handled by its own auth guard
];

function isExemptPath(pathname: string) {
    return AUTH_EXEMPT_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isMfaRoute(pathname: string) {
    return MFA_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isMfaEscapePath(pathname: string) {
    return MFA_ESCAPE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function buildLoginRedirect(pathname: string) {
    if (typeof window === 'undefined') {
        return `/login?redirect=${encodeURIComponent(pathname)}`;
    }

    const target = `${window.location.pathname}${window.location.search || ''}`;
    return `/login?redirect=${encodeURIComponent(target || pathname)}`;
}

export function AuthFlowGate() {
    const pathname = usePathname() || '/';
    const router = useRouter();
    const { user, isInitialized } = useAuthStore();

    React.useEffect(() => {
        if (!isInitialized || !user?.id) {
            return;
        }

        let cancelled = false;

        const syncMfaFlow = async () => {
            try {
                if (pathname.startsWith('/api')) {
                    return;
                }

                let status: Awaited<ReturnType<typeof getMfaStatus>>;
                try {
                    status = await getMfaStatus();
                } catch (mfaError) {
                    // Session likely expired during inactivity
                    console.warn('[AuthFlowGate] MFA check failed (session may be expired):', mfaError);
                    if (!isExemptPath(pathname)) {
                        router.replace(buildLoginRedirect(pathname));
                    }
                    return;
                }

                if (cancelled || !status.hasSession) {
                    return;
                }

                // ─────────────────────────────────────────────
                // Step 1: MFA gate (highest priority)
                // ─────────────────────────────────────────────
                if (status.needsSetup || status.needsVerification) {
                    if (isMfaEscapePath(pathname)) {
                        return;
                    }

                    const nextRoute = getPostAuthRoute(status, pathname);

                    if (nextRoute !== pathname && !isExemptPath(pathname) && !isMfaRoute(pathname)) {
                        router.replace(nextRoute);
                        return;
                    }

                    if (status.needsSetup && pathname !== '/auth/mfa/setup') {
                        router.replace(nextRoute);
                        return;
                    }

                    if (status.needsVerification && pathname !== '/auth/mfa/verify') {
                        router.replace(nextRoute);
                    }

                    return;
                }

                // If user is on an MFA route but MFA is done → redirect out
                if (isMfaRoute(pathname)) {
                    router.replace('/dashboard');
                    return;
                }

                // ─────────────────────────────────────────────
                // Step 2: Onboarding gate (after MFA is clear)
                // ─────────────────────────────────────────────
                if (cancelled) return;

                const onboardingDone = user.onboardingCompleted === true;

                // User hasn't completed onboarding → force them there
                // (unless they're already on /onboarding or an exempt path)
                if (!onboardingDone && !isExemptPath(pathname)) {
                    router.replace('/onboarding');
                    return;
                }

                // User completed onboarding but is still on /onboarding → send to dashboard
                if (onboardingDone && pathname === '/onboarding') {
                    router.replace('/dashboard');
                    return;
                }
            } catch (error) {
                console.error('[AuthFlowGate] Flow sync failed:', error);
            }
        };

        void syncMfaFlow();

        return () => {
            cancelled = true;
        };
    }, [isInitialized, pathname, router, user?.id, user?.onboardingCompleted]);

    return null;
}
