'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string };
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="es-CO">
            <body>
                <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-6 text-[var(--color-foreground)]">
                    <section className="max-w-md text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted-foreground)]">
                            Error operativo
                        </p>
                        <h1 className="mt-3 text-2xl font-semibold">
                            No pudimos cargar esta vista
                        </h1>
                        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
                            El equipo ya puede revisar el incidente. Recarga la pagina o vuelve al panel principal.
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.assign('/dashboard')}
                            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-[var(--color-primary-foreground)]"
                        >
                            Volver al panel
                        </button>
                    </section>
                </main>
            </body>
        </html>
    );
}
