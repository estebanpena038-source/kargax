// =============================================================================
// KargaX - App Providers
// Centralized provider wrapper
// =============================================================================

'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthFlowGate } from '@/components/auth/AuthFlowGate';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { AuthSessionProvider } from '@/features/auth/components/AuthSessionProvider';

// =============================================================================
// Query Client Configuration
// =============================================================================
function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Don't retry on 401/403 errors
                retry: (failureCount, error) => {
                    if (error instanceof Error && error.message.includes('401')) return false;
                    if (error instanceof Error && error.message.includes('403')) return false;
                    return failureCount < 3;
                },
                // Stale time: 1 minute
                staleTime: 60 * 1000,
                // Cache time: 5 minutes
                gcTime: 5 * 60 * 1000,
                // Refetch on window focus
                refetchOnWindowFocus: true,
            },
            mutations: {
                retry: false,
            },
        },
    });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
    if (typeof window === 'undefined') {
        // Server: always make a new query client
        return makeQueryClient();
    } else {
        // Browser: reuse existing query client
        if (!browserQueryClient) {
            browserQueryClient = makeQueryClient();
        }
        return browserQueryClient;
    }
}

// =============================================================================
// Providers Component
// =============================================================================
export function Providers({ children }: { children: React.ReactNode }) {
    const queryClient = getQueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            <AuthSessionProvider queryClient={queryClient}>
                <AuthFlowGate />
                <CommandPalette />
                {children}
            </AuthSessionProvider>
            {process.env.NODE_ENV === 'development' && (
                <ReactQueryDevtools initialIsOpen={false} position="bottom" />
            )}
        </QueryClientProvider>
    );
}
