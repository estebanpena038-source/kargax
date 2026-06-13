'use client';

import * as React from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { initAuthListener, useAuthStore } from '@/features/auth/store/authStore';

export function AuthSessionProvider({
    children,
    queryClient,
}: {
    children: React.ReactNode;
    queryClient: QueryClient;
}) {
    const initializedRef = React.useRef(false);

    React.useEffect(() => {
        if (initializedRef.current) {
            return;
        }

        initializedRef.current = true;
        initAuthListener();
        void useAuthStore.getState().initialize();

        const unsubscribe = useAuthStore.subscribe((state, previousState) => {
            if (previousState.isAuthenticated && !state.isAuthenticated) {
                queryClient.clear();
            }
        });

        return unsubscribe;
    }, [queryClient]);

    return <>{children}</>;
}
