// =============================================================================
// KARGAX - Join Organization Modal (Apple / Steve Jobs Aesthetic)
// Enterprise Team & Channel Onboarding Modal
// =============================================================================

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2,
    X,
    ArrowRight,
    Loader2,
    CheckCircle2,
    ShieldCheck,
    Users,
    Hash,
    Sparkles,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { toast } from '@/components/ui';
import { joinOrganizationByInviteCode } from '../api/messagesApi';

interface JoinOrgModalProps {
    isOpen: boolean;
    onClose: () => void;
    onJoinedSuccess: (businessData: { businessId: string; companyName: string }) => void;
}

export function JoinOrgModal({ isOpen, onClose, onJoinedSuccess }: JoinOrgModalProps) {
    const [code, setCode] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [isSuccess, setIsSuccess] = React.useState(false);
    const [joinedCompany, setJoinedCompany] = React.useState<string>('');

    React.useEffect(() => {
        if (isOpen) {
            setCode('');
            setError(null);
            setIsSuccess(false);
            setJoinedCompany('');
        }
    }, [isOpen]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.toUpperCase();
        if (val && !val.startsWith('KX-') && !'KX-'.startsWith(val)) {
            val = 'KX-' + val.replace(/^KX-?/, '');
        }
        setCode(val);
        setError(null);
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = code.trim().toUpperCase();
        if (!trimmed || trimmed.length < 5) {
            setError('Ingresa un código de organización válido (ej: KX-TRANSPORTES-9821)');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await joinOrganizationByInviteCode(trimmed);
            setIsSuccess(true);
            const comp = res.data?.companyName || 'la organización';
            setJoinedCompany(comp);
            toast.success('¡Bienvenido a la flota!', res.message || `Te has unido a ${comp}`);

            setTimeout(() => {
                onJoinedSuccess(res.data);
                onClose();
            }, 1200);
        } catch (err: any) {
            console.error('[JoinOrgModal] error:', err);
            setError(err.message || 'Código de organización no encontrado. Verifica con tu empresa.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                {/* Backdrop with Apple blur */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
                />

                {/* Modal Window */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 12 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-8"
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute right-5 top-5 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        aria-label="Cerrar modal"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    {isSuccess ? (
                        <div className="py-6 text-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                            >
                                <CheckCircle2 className="h-8 w-8" />
                            </motion.div>
                            <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                                ¡Unión Exitosa!
                            </h3>
                            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                                Te has integrado a <strong className="text-zinc-900 dark:text-zinc-100">{joinedCompany}</strong>. Tus canales ya están listos.
                            </p>
                        </div>
                    ) : (
                        <div>
                            {/* Icon Header */}
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                                        Unirse a una Empresa
                                    </h2>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        Ingresa el código único de tu organización
                                    </p>
                                </div>
                            </div>

                            {/* Features list */}
                            <div className="mb-6 space-y-2 rounded-xl bg-zinc-50/80 p-3.5 border border-zinc-100 dark:bg-zinc-800/40 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-300">
                                <div className="flex items-center gap-2.5">
                                    <Hash className="h-3.5 w-3.5 text-zinc-400" />
                                    <span>Acceso automático a <strong className="text-zinc-800 dark:text-zinc-200">#general</strong>, <strong className="text-zinc-800 dark:text-zinc-200">#novedades</strong> y <strong className="text-zinc-800 dark:text-zinc-200">#alertas</strong></span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <Users className="h-3.5 w-3.5 text-zinc-400" />
                                    <span>Canales dinámicos de despachos y viajes asignados</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                                    <span>Comunicaciones cifradas de flota privada</span>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleJoin} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                        Código de Empresa (KX-...)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={code}
                                            onChange={handleInputChange}
                                            placeholder="KX-TONOITO-2026"
                                            disabled={isLoading}
                                            autoFocus
                                            className={cn(
                                                'w-full rounded-xl border px-4 py-3 text-sm font-mono tracking-wider transition-all uppercase',
                                                'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50',
                                                'focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 focus:border-zinc-900 dark:focus:border-zinc-100',
                                                error
                                                    ? 'border-red-500 focus:border-red-500'
                                                    : 'border-zinc-200 dark:border-zinc-800'
                                            )}
                                        />
                                        <Sparkles className="absolute right-3.5 top-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
                                    </div>
                                    {error && (
                                        <p className="mt-1.5 text-xs text-red-500 dark:text-red-400 font-medium">
                                            {error}
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        disabled={isLoading}
                                        className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading || !code.trim()}
                                        className={cn(
                                            'flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium text-white transition-all shadow-sm',
                                            'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
                                            'disabled:opacity-40 disabled:cursor-not-allowed'
                                        )}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                <span>Verificando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Unirse a Flota</span>
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
