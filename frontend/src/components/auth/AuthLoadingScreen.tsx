'use client';

interface AuthLoadingScreenProps {
    title?: string;
    message?: string;
}

export function AuthLoadingScreen({
    title = 'Validando sesion',
    message = 'Estamos verificando tu acceso de forma segura.',
}: AuthLoadingScreenProps) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center px-4 py-10 sm:px-6">
            <div
                className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm"
                role="status"
                aria-live="polite"
            >
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-950" />
                <h1 className="text-lg font-semibold text-zinc-950">{title}</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{message}</p>
            </div>
        </div>
    );
}
