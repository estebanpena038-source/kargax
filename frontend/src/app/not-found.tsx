import Link from 'next/link';
import { ArrowLeft, Home, Truck } from 'lucide-react';
import { Button } from '@/components/ui';

export default function NotFound() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-green-50 to-slate-100 p-4">
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
                <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-green-600/10 blur-3xl" />
            </div>

            <div className="relative z-10 text-center max-w-lg">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-green-700 shadow-lg shadow-green-600/25">
                    <Truck className="h-10 w-10 text-white" />
                </div>

                <h1 className="text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-orange-500">
                    404
                </h1>
                <h2 className="mt-4 text-2xl font-bold text-slate-900">Página no encontrada</h2>
                <p className="mt-2 text-slate-600">
                    La ruta que buscas no existe o fue movida. Vuelve al inicio y continúa operando tu red logística.
                </p>

                <div className="mt-8 flex items-center justify-center gap-3">
                    <Link href="/dashboard">
                        <Button leftIcon={<Home className="h-4 w-4" />}>
                            Ir al dashboard
                        </Button>
                    </Link>
                    <Link href="/">
                        <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                            Volver al inicio
                        </Button>
                    </Link>
                </div>

                <p className="mt-8 text-xs text-slate-400">
                    KargaX · Plataforma de logística y transporte de carga
                </p>
            </div>
        </main>
    );
}
