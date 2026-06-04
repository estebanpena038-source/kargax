'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2, Truck, MapPin, Phone, FileText, User,
    ArrowRight, ArrowLeft, CheckCircle2, Loader2,
    Warehouse, Shield, Sparkles,
} from 'lucide-react';

import { Button, Input, Card, Badge, toast, AndeanPhoneInput, KargaxLogo } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { validateAndeanPhoneValue } from '@/lib/phone/andean';
import { extractApiErrorMessage } from '@/lib/contracts/api';
import {
    COLOMBIAN_DEPARTMENTS,
    getCitiesByDepartment,
} from '@/constants/colombia';

// =============================================================================
// Types
// =============================================================================

interface BusinessFormData {
    companyName: string;
    nit: string;
    industry: string;
    address: string;
    department: string;
    city: string;
    phone: string;
}

interface TruckerFormData {
    licensePlate: string;
    licenseNumber: string;
    licenseType: string;
    yearsExperience: string;
    serviceAreas: string[];
    phone: string;
}

const LICENSE_TYPES = [
    { value: 'C1', label: 'C1 - Vehiculos de carga' },
    { value: 'C2', label: 'C2 - Vehiculos articulados' },
    { value: 'C3', label: 'C3 - Vehiculos especiales' },
];

const INDUSTRIES = [
    { value: 'agriculture', label: 'Agricultura y Agroindustria' },
    { value: 'automotive', label: 'Automotriz' },
    { value: 'construction', label: 'Construccion' },
    { value: 'consumer', label: 'Bienes de consumo' },
    { value: 'energy', label: 'Energia y Petroleo' },
    { value: 'food', label: 'Alimentos y Bebidas' },
    { value: 'manufacturing', label: 'Manufactura' },
    { value: 'mining', label: 'Mineria' },
    { value: 'pharmaceutical', label: 'Farmaceutico' },
    { value: 'retail', label: 'Retail y Comercio' },
    { value: 'technology', label: 'Tecnologia' },
    { value: 'textile', label: 'Textil y Confeccion' },
    { value: 'logistics', label: 'Logistica y Transporte' },
    { value: 'other', label: 'Otro' },
];

type CompleteOnboardingPayload =
    | (BusinessFormData & { userType: 'business' })
    | (Omit<TruckerFormData, 'yearsExperience'> & {
        userType: 'trucker';
        yearsExperience: number;
    });

async function completeOnboarding(payload: CompleteOnboardingPayload) {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('No hay una sesion activa para guardar el onboarding');
    }

    const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    const rawText = await response.text();
    const json = rawText ? JSON.parse(rawText) : null;

    if (!response.ok) {
        throw new Error(extractApiErrorMessage(json, rawText || 'No se pudo guardar el onboarding'));
    }

    return json;
}

// =============================================================================
// Business Onboarding Form
// =============================================================================

function BusinessOnboardingForm({
    onComplete,
    isSubmitting,
}: {
    onComplete: (data: BusinessFormData) => void;
    isSubmitting: boolean;
}) {
    const [step, setStep] = React.useState(0);
    const [form, setForm] = React.useState<BusinessFormData>({
        companyName: '', nit: '', industry: '',
        address: '', department: '', city: '', phone: '',
    });
    const [errors, setErrors] = React.useState<Partial<Record<keyof BusinessFormData, string>>>({});

    const cities = React.useMemo(() => {
        if (!form.department) return [];
        return getCitiesByDepartment(form.department);
    }, [form.department]);

    const departmentOptions = COLOMBIAN_DEPARTMENTS.map((d) => ({
        value: d.code, label: d.name, description: d.capital,
    }));
    const cityOptions = cities.map((c) => ({ value: c.code, label: c.name }));

    const update = (field: keyof BusinessFormData, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const validateStep = () => {
        const newErrors: Partial<Record<keyof BusinessFormData, string>> = {};
        if (step === 0) {
            if (!form.companyName.trim()) newErrors.companyName = 'Nombre de empresa requerido';
            if (!form.nit.trim()) newErrors.nit = 'NIT requerido';
            if (!form.industry) newErrors.industry = 'Selecciona una industria';
        }
        if (step === 1) {
            if (!form.department) newErrors.department = 'Selecciona un departamento';
            if (!form.city) newErrors.city = 'Selecciona una ciudad';
        }
        if (step === 2) {
            if (!form.phone || !validateAndeanPhoneValue(form.phone, 'CO')) {
                newErrors.phone = 'Telefono valido requerido';
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateStep()) {
            if (step < 2) setStep(step + 1);
            else onComplete(form);
        }
    };

    const steps = [
        { label: 'Empresa', icon: Building2 },
        { label: 'Ubicacion', icon: MapPin },
        { label: 'Contacto', icon: Phone },
    ];

    return (
        <>
            {/* Progress Steps */}
            <div className="mb-8 flex min-w-0 items-center justify-center gap-1.5 overflow-x-auto pb-1 sm:gap-2">
                {steps.map((s, i) => {
                    const Icon = s.icon;
                    const done = i < step;
                    const active = i === step;
                    return (
                        <React.Fragment key={s.label}>
                            {i > 0 && (
                                <div className={cn(
                                    'h-0.5 w-5 shrink-0 rounded transition-colors sm:w-8',
                                    done ? 'bg-white' : 'bg-white/18'
                                )} />
                            )}
                            <div className={cn(
                                'flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all sm:px-3',
                                active ? 'bg-white text-zinc-950 ring-1 ring-white' :
                                done ? 'bg-white/12 text-white' : 'text-zinc-400'
                            )}>
                                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                                <span className="hidden sm:inline">{s.label}</span>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-5"
                >
                    {step === 0 && (
                        <>
                            <Input
                                label="Nombre de la empresa"
                                placeholder="Transportes XYZ SAS"
                                leftIcon={<Building2 className="w-5 h-5" />}
                                value={form.companyName}
                                onChange={(e) => update('companyName', e.target.value)}
                                errorMessage={errors.companyName}
                            />
                            <Input
                                label="NIT"
                                placeholder="900.123.456-7"
                                leftIcon={<FileText className="w-5 h-5" />}
                                helperText="Numero de Identificacion Tributaria de la empresa"
                                value={form.nit}
                                onChange={(e) => update('nit', e.target.value)}
                                errorMessage={errors.nit}
                            />
                            <Select
                                label="Industria"
                                options={INDUSTRIES}
                                value={form.industry}
                                onChange={(v) => update('industry', v)}
                                placeholder="Selecciona tu sector"
                                searchable
                                errorMessage={errors.industry}
                            />
                        </>
                    )}

                    {step === 1 && (
                        <>
                            <Select
                                label="Departamento"
                                options={departmentOptions}
                                value={form.department}
                                onChange={(v) => { update('department', v); update('city', ''); }}
                                placeholder="Selecciona departamento"
                                searchable
                                errorMessage={errors.department}
                            />
                            <Select
                                label="Ciudad"
                                options={cityOptions}
                                value={form.city}
                                onChange={(v) => update('city', v)}
                                placeholder="Selecciona ciudad"
                                disabled={!form.department}
                                searchable
                                errorMessage={errors.city}
                            />
                            <Input
                                label="Direccion (opcional)"
                                placeholder="Cra 7 #45-12, Zona Industrial"
                                leftIcon={<MapPin className="w-5 h-5" />}
                                value={form.address}
                                onChange={(e) => update('address', e.target.value)}
                            />
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <AndeanPhoneInput
                                label="Telefono de contacto"
                                value={form.phone}
                                onChange={(v) => update('phone', v)}
                                helperText="Prefijo andino + numero movil sin espacios"
                                errorMessage={errors.phone}
                            />
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-950">
                                <p className="font-medium mb-1">Todo listo para operar</p>
                                <p className="text-zinc-600">
                                    Al completar, tu empresa quedara activa en el marketplace con plan Free.
                                    Podras publicar ofertas, gestionar bodegas y escalar cuando lo necesites.
                                </p>
                            </div>
                        </>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="sticky bottom-0 -mx-4 mt-8 grid grid-cols-2 gap-3 border-t border-white/10 bg-zinc-950/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:flex sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
                {step > 0 ? (
                    <Button
                        variant="ghost"
                        onClick={() => setStep(step - 1)}
                        leftIcon={<ArrowLeft className="h-4 w-4" />}
                    >
                        Atras
                    </Button>
                ) : <div />}
                <Button
                    onClick={handleNext}
                    isLoading={isSubmitting && step === 2}
                    rightIcon={step < 2 ? <ArrowRight className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                >
                    {step < 2 ? 'Guardar y continuar' : 'Completar y entrar'}
                </Button>
            </div>
        </>
    );
}

// =============================================================================
// Trucker Onboarding Form
// =============================================================================

function TruckerOnboardingForm({
    onComplete,
    isSubmitting,
}: {
    onComplete: (data: TruckerFormData) => void;
    isSubmitting: boolean;
}) {
    const [step, setStep] = React.useState(0);
    const [form, setForm] = React.useState<TruckerFormData>({
        licensePlate: '', licenseNumber: '',
        licenseType: '', yearsExperience: '', serviceAreas: [], phone: '',
    });
    const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});

    const update = (field: keyof TruckerFormData, value: string | string[]) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const validateStep = () => {
        const e: Record<string, string> = {};
        if (step === 0) {
            if (!form.licensePlate.trim()) e.licensePlate = 'Placa requerida';
        }
        if (step === 1) {
            if (!form.licenseNumber.trim()) e.licenseNumber = 'Numero de licencia requerido';
            if (!form.licenseType) e.licenseType = 'Categoria de licencia requerida';
        }
        if (step === 2) {
            if (!form.phone || !validateAndeanPhoneValue(form.phone, 'CO')) {
                e.phone = 'Telefono valido requerido';
            }
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleNext = () => {
        if (validateStep()) {
            if (step < 2) setStep(step + 1);
            else onComplete(form);
        }
    };

    const steps = [
        { label: 'Vehiculo', icon: Truck },
        { label: 'Licencia', icon: FileText },
        { label: 'Contacto', icon: Phone },
    ];

    return (
        <>
            <div className="mb-8 flex min-w-0 items-center justify-center gap-1.5 overflow-x-auto pb-1 sm:gap-2">
                {steps.map((s, i) => {
                    const Icon = s.icon;
                    const done = i < step;
                    const active = i === step;
                    return (
                        <React.Fragment key={s.label}>
                            {i > 0 && (
                                <div className={cn(
                                    'h-0.5 w-5 shrink-0 rounded transition-colors sm:w-8',
                                    done ? 'bg-white' : 'bg-white/18'
                                )} />
                            )}
                            <div className={cn(
                                'flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all sm:px-3',
                                active ? 'bg-white text-zinc-950 ring-1 ring-white' :
                                done ? 'bg-white/12 text-white' : 'text-zinc-400'
                            )}>
                                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                                <span className="hidden sm:inline">{s.label}</span>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-5"
                >
                    {step === 0 && (
                        <>
                            <Input
                                label="Placa del vehiculo"
                                placeholder="ABC-123"
                                leftIcon={<Truck className="w-5 h-5" />}
                                value={form.licensePlate}
                                onChange={(e) => update('licensePlate', e.target.value.toUpperCase())}
                                errorMessage={errors.licensePlate}
                            />
                        </>
                    )}

                    {step === 1 && (
                        <>
                            <Input
                                label="Numero de licencia de conduccion"
                                placeholder="1234567890"
                                leftIcon={<FileText className="w-5 h-5" />}
                                value={form.licenseNumber}
                                onChange={(e) => update('licenseNumber', e.target.value)}
                                errorMessage={errors.licenseNumber}
                            />
                            <Select
                                label="Categoria de licencia"
                                options={LICENSE_TYPES}
                                value={form.licenseType}
                                onChange={(v) => update('licenseType', v)}
                                placeholder="Selecciona categoria"
                                errorMessage={errors.licenseType}
                            />
                            <Input
                                label="Anos de experiencia"
                                type="number"
                                placeholder="5"
                                value={form.yearsExperience}
                                onChange={(e) => update('yearsExperience', e.target.value)}
                            />
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <AndeanPhoneInput
                                label="Telefono de contacto"
                                value={form.phone}
                                onChange={(v) => update('phone', v)}
                                helperText="Prefijo andino + numero movil sin espacios"
                                errorMessage={errors.phone}
                            />
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-950">
                                <p className="font-medium mb-1">Listo para cargar</p>
                                <p className="text-zinc-600">
                                    Al completar, tu perfil quedara activo y podras ver ofertas de carga,
                                    postularte y empezar a operar de inmediato.
                                </p>
                            </div>
                        </>
                    )}
                </motion.div>
            </AnimatePresence>

            <div className="sticky bottom-0 -mx-4 mt-8 grid grid-cols-2 gap-3 border-t border-white/10 bg-zinc-950/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:flex sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
                {step > 0 ? (
                    <Button
                        variant="ghost"
                        onClick={() => setStep(step - 1)}
                        leftIcon={<ArrowLeft className="h-4 w-4" />}
                    >
                        Atras
                    </Button>
                ) : <div />}
                <Button
                    onClick={handleNext}
                    isLoading={isSubmitting && step === 2}
                    rightIcon={step < 2 ? <ArrowRight className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                >
                    {step < 2 ? 'Guardar y continuar' : 'Completar y entrar'}
                </Button>
            </div>
        </>
    );
}

// =============================================================================
// Main Onboarding Page
// =============================================================================

export default function OnboardingPage() {
    const router = useRouter();
    const { user, isAuthenticated, isInitialized, initialize, fetchProfile } = useAuthStore();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isComplete, setIsComplete] = React.useState(false);

    const syncCorporateFleetMembership = React.useCallback(async (vehiclePlate?: string) => {
        if (!user?.id || user.userType !== 'trucker') {
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            return;
        }

        await fetch('/api/business/fleet/accept', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(vehiclePlate ? { vehiclePlate } : {}),
        }).catch(() => null);

        if (!vehiclePlate?.trim()) {
            return;
        }

        await fetch('/api/business/fleet/me', {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ vehiclePlate }),
        }).catch(() => null);
    }, [user?.id, user?.userType]);

    // Auth guard - redirect if not authenticated
    React.useEffect(() => {
        if (isInitialized && !isAuthenticated) {
            router.replace('/login?redirect=/onboarding');
        }
    }, [isInitialized, isAuthenticated, router]);

    React.useEffect(() => {
        if (user?.userType === 'admin') {
            router.replace('/admin/ceo');
        }
    }, [router, user?.userType]);

    // Initialize auth if needed
    React.useEffect(() => {
        if (!isInitialized) void initialize();
    }, [isInitialized, initialize]);

    // Check if onboarding already done - redirect to dashboard
    React.useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        const check = async () => {
            const { data } = await supabase
                .from('user_profiles')
                .select('onboarding_completed')
                .eq('id', user.id)
                .single();
            const profile = data as { onboarding_completed?: boolean } | null;
            if (!cancelled && profile?.onboarding_completed) {
                router.replace('/dashboard');
            }
        };
        void check();
        return () => { cancelled = true; };
    }, [user?.id, router]);

    React.useEffect(() => {
        if (user?.userType !== 'trucker') {
            return;
        }

        void syncCorporateFleetMembership();
    }, [syncCorporateFleetMembership, user?.userType]);

    // =========================================================================
    // Submit: Business
    // =========================================================================
    const handleBusinessComplete = async (data: BusinessFormData) => {
        if (!user?.id) return;
        setIsSubmitting(true);
        try {
            await completeOnboarding({
                ...data,
                userType: 'business',
            });
            await fetchProfile();
            setIsComplete(true);
            toast.success('Empresa configurada', 'Tu perfil empresarial esta activo');
            setTimeout(() => router.push('/dashboard'), 1500);
        } catch (error) {
            console.error('[Onboarding] Business submit error:', error);
            toast.error('Error', 'No se pudo guardar. Intenta de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // =========================================================================
    // Submit: Trucker
    // =========================================================================
    const handleTruckerComplete = async (data: TruckerFormData) => {
        if (!user?.id) return;
        setIsSubmitting(true);
        try {
            await completeOnboarding({
                ...data,
                userType: 'trucker',
                yearsExperience: parseInt(data.yearsExperience, 10) || 0,
            });
            await syncCorporateFleetMembership(data.licensePlate);
            await fetchProfile();
            setIsComplete(true);
            toast.success('Perfil completado', 'Ya puedes ver ofertas de carga');
            setTimeout(() => router.push('/ofertas'), 1500);
        } catch (error) {
            console.error('[Onboarding] Trucker submit error:', error);
            toast.error('Error', 'No se pudo guardar. Intenta de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // =========================================================================
    // Loading State
    // =========================================================================
    if (!isInitialized || !user) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-zinc-950">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
            </main>
        );
    }

    // =========================================================================
    // Success State
    // =========================================================================
    if (isComplete) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-zinc-950">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center"
                >
                    <div className="w-20 h-20 mx-auto mb-6 rounded-lg bg-white flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-zinc-950" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Todo listo</h2>
                    <p className="text-zinc-400 mb-4">Redirigiendo al dashboard...</p>
                    <Loader2 className="h-5 w-5 text-white animate-spin mx-auto" />
                </motion.div>
            </main>
        );
    }

    // =========================================================================
    // Render
    // =========================================================================
    const isBusiness = user.userType === 'business';

    return (
        <main className="min-h-screen bg-[#f7f7f5] text-zinc-950">
            <section className="mx-auto max-w-2xl px-3 py-8 sm:px-6 sm:py-12 lg:px-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <KargaxLogo variant="lockup" tone="dark" size="md" className="mx-auto mb-6" />
                    <Badge
                        variant="secondary"
                        size="sm"
                        className="mb-4 border border-zinc-950 bg-zinc-950 text-white"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        {isBusiness ? 'Configuracion empresarial' : 'Perfil de transportador'}
                    </Badge>
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
                        {isBusiness
                            ? 'Configura tu empresa para operar'
                            : 'Completa tu perfil de transportador'}
                    </h1>
                    <p className="mt-3 text-base text-zinc-600 sm:text-lg">
                        Bienvenido, <span className="font-medium text-zinc-950">{user.fullName}</span>.
                        {isBusiness
                            ? ' Completa estos datos para activar tu cuenta empresarial.'
                            : ' Agrega tu vehiculo y licencia para empezar a recibir ofertas.'}
                    </p>
                </motion.div>

                {/* Form Card */}
                <Card className="kx-onboarding-panel border-zinc-950 bg-zinc-950 p-4 text-white shadow-[0_32px_80px_-46px_rgba(0,0,0,.85)] sm:p-8">
                    {isBusiness ? (
                        <BusinessOnboardingForm
                            onComplete={handleBusinessComplete}
                            isSubmitting={isSubmitting}
                        />
                    ) : (
                        <TruckerOnboardingForm
                            onComplete={handleTruckerComplete}
                            isSubmitting={isSubmitting}
                        />
                    )}
                </Card>

                {/* Security Badge */}
                <div className="mt-6 flex items-center justify-center gap-2 px-2 text-center text-xs text-zinc-600">
                    <Shield className="h-3.5 w-3.5" />
                    <span>Datos protegidos con cifrado E2E - KargaX Security</span>
                </div>
            </section>
        </main>
    );
}
