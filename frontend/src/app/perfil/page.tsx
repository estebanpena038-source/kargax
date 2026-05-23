'use client';

import * as React from 'react';
import {
    Camera, Check, Edit3, Key, Mail, Shield,
    Sparkles, Truck, User, Building2,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Card, Input, Badge, Avatar, AvatarFallback, toast, AndeanPhoneInput } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { updateUserProfile } from '@/lib/supabase/auth';
import { TruckerScoreBadge } from '@/components/trucker/TruckerScoreBadge';

function getUserTypeLabel(userType: 'trucker' | 'business' | 'admin') {
    if (userType === 'business') return 'Empresa';
    if (userType === 'admin') return 'Administrador';
    return 'Transportador';
}

function UserTypeIcon({
    userType,
    className,
}: {
    userType?: 'trucker' | 'business' | 'admin';
    className?: string;
}) {
    if (userType === 'business') {
        return <Building2 className={className} />;
    }

    if (userType === 'admin') {
        return <Shield className={className} />;
    }

    if (userType === 'trucker') {
        return <Truck className={className} />;
    }

    return <User className={className} />;
}

export default function PerfilPage() {
    const { user, fetchProfile } = useAuthStore();
    const [fullName, setFullName] = React.useState(user?.fullName || '');
    const [phone, setPhone] = React.useState(user?.phone || '');
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        setFullName(user?.fullName || '');
        setPhone(user?.phone || '');
    }, [user?.fullName, user?.phone]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        const result = await updateUserProfile(user.id, {
            fullName: fullName.trim(),
            phone: phone.trim(),
        });
        setSaving(false);

        if (!result.success) {
            toast.error('Error', result.error || 'No se pudo actualizar el perfil');
            return;
        }

        await fetchProfile();
        toast.success('Perfil actualizado', 'Los cambios quedaron guardados');
    };

    const initials = (user?.fullName || user?.email || 'U')
        .split(' ')
        .map((s) => s[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <DashboardLayout pageTitle="Mi Perfil">
            <div className="space-y-6">
                {/* -- Hero / Profile Header -- */}
                <div className="relative overflow-hidden rounded-lg bg-zinc-950 p-5 text-white shadow-[0_32px_80px_-46px_rgba(0,0,0,.85)] sm:p-8">
                    <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center">
                        {/* Avatar */}
                        <div className="relative group">
                            <Avatar className="h-20 w-20 border-4 border-white/20 text-2xl">
                                <AvatarFallback className="bg-white text-zinc-950 text-2xl font-bold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <button className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="h-6 w-6 text-white" />
                            </button>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="break-words text-xl font-bold sm:text-2xl">{user?.fullName || 'Sin nombre'}</h1>
                            <p className="mt-1 break-all text-sm text-zinc-300">{user?.email}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge variant="primary" size="sm" className="bg-white/15 text-white border-white/20">
                                    <UserTypeIcon userType={user?.userType} className="h-3.5 w-3.5" />
                                    {user ? getUserTypeLabel(user.userType) : 'Sin rol'}
                                </Badge>
                                <Badge variant="success" size="sm" className="border-white/25 bg-white/10 text-white">
                                    <Check className="h-3.5 w-3.5" /> Verificado
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>

                {/* -- Content grid -- */}
                {user?.userType === 'trucker' && (
                    <TruckerScoreBadge />
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* --- Edit Profile Card --- */}
                    <Card variant="default" className="p-4 sm:p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950">
                                <Edit3 className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-950">Datos de la cuenta</h2>
                                <p className="text-xs text-zinc-500">Actualiza tu informacion operativa.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Input
                                label="Nombre completo"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Tu nombre completo"
                            />
                            <AndeanPhoneInput
                                label="Telefono"
                                value={phone}
                                onChange={setPhone}
                                helperText="Guardamos el numero con prefijo internacional para notificaciones."
                            />
                        </div>

                        <div className="mt-5 flex justify-stretch sm:justify-end">
                            <Button onClick={handleSave} isLoading={saving} leftIcon={<Check className="h-4 w-4" />}>
                                Guardar cambios
                            </Button>
                        </div>
                    </Card>

                    {/* --- Account Info Card --- */}
                    <div className="space-y-4">
                        <Card variant="default" className="p-4 sm:p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950">
                                    <Shield className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-zinc-950">Estado de la cuenta</h3>
                                    <p className="text-xs text-zinc-500">Informacion de seguridad y acceso.</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex flex-col gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-4 sm:flex-row sm:items-center">
                                    <Mail className="h-4 w-4 text-zinc-400" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-zinc-500">Correo electronico</p>
                                        <p className="break-all text-sm font-medium text-zinc-950">{user?.email || 'Sin correo'}</p>
                                    </div>
                                    <Badge variant="success" size="xs">Verificado</Badge>
                                </div>

                                <div className="flex flex-col gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-4 sm:flex-row sm:items-center">
                                    <UserTypeIcon userType={user?.userType} className="h-4 w-4 text-zinc-400" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-zinc-500">Tipo de cuenta</p>
                                        <p className="text-sm font-medium text-zinc-950">{user ? getUserTypeLabel(user.userType) : 'Sin rol'}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-4 sm:flex-row sm:items-center">
                                    <Key className="h-4 w-4 text-zinc-400" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-zinc-500">Autenticacion</p>
                                        <p className="text-sm font-medium text-zinc-950">Supabase Auth + RLS</p>
                                    </div>
                                    <Badge variant="primary" size="xs">Seguro</Badge>
                                </div>
                            </div>
                        </Card>

                        <Card className="border-zinc-200 bg-white p-4 sm:p-5">
                            <div className="flex items-start gap-3">
                                <Sparkles className="h-5 w-5 text-zinc-950 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-zinc-950">Cuenta KargaX</p>
                                    <p className="text-xs text-zinc-600 mt-0.5">
                                        Tu sesion y perfil estan sincronizados. La seguridad operativa se gestiona server-side por auth y RLS.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
