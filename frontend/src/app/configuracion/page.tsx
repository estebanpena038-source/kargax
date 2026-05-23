'use client';

import * as React from 'react';
import {
    Bell, Globe, Key, Laptop, Palette, ShieldCheck, Smartphone,
    Volume2, Mail, MessageSquare, Truck, CreditCard,
    AlertTriangle, Sparkles, Settings, Lock,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Card, Badge, Switch, Separator, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';

/* Toggle Row */
function SettingToggle({
    icon: Icon,
    iconColor,
    label,
    description,
    checked,
    onChange,
}: {
    icon: React.ElementType;
    iconColor: string;
    label: string;
    description: string;
    checked: boolean;
    onChange: (val: boolean) => void;
}) {
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-950 sm:flex-row sm:items-start sm:gap-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
                <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-950">{label}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} className="self-start sm:self-center" />
        </div>
    );
}

export default function ConfiguracionPage() {
    const { user } = useAuthStore();

    // Notification prefs
    const [emailNotifs, setEmailNotifs] = React.useState(true);
    const [pushNotifs, setPushNotifs] = React.useState(true);
    const [tripAlerts, setTripAlerts] = React.useState(true);
    const [paymentAlerts, setPaymentAlerts] = React.useState(true);
    const [marketingEmails, setMarketingEmails] = React.useState(false);
    const [soundEnabled, setSoundEnabled] = React.useState(true);

    // Language
    const [language, setLanguage] = React.useState('es');

    return (
        <DashboardLayout pageTitle="Configuracion">
            <div className="space-y-6">
                {/* -- Hero -- */}
                <div className="relative overflow-hidden rounded-lg bg-zinc-950 p-5 text-white shadow-[0_32px_80px_-46px_rgba(0,0,0,.85)] sm:p-8">
                    <div className="relative z-10">
                        <Badge variant="primary" size="sm" className="mb-3 bg-white/15 text-white border-white/20">
                            <Settings className="h-3.5 w-3.5" /> Configuracion
                        </Badge>
                        <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">Preferencias de tu cuenta</h1>
                        <p className="mt-2 max-w-2xl text-sm text-zinc-300">
                            Controla notificaciones, seguridad, idioma y apariencia desde un solo lugar.
                        </p>
                    </div>
                </div>

                {/* -- Tabbed settings -- */}
                <Tabs defaultValue="account">
                    <TabsList className="w-full justify-start overflow-x-auto">
                        <TabsTrigger value="account"><Settings className="h-4 w-4" /> Cuenta</TabsTrigger>
                        <TabsTrigger value="preferences"><Globe className="h-4 w-4" /> Preferencias</TabsTrigger>
                        <TabsTrigger value="security"><ShieldCheck className="h-4 w-4" /> Seguridad</TabsTrigger>
                        <TabsTrigger value="notifications"><Bell className="h-4 w-4" /> Notificaciones</TabsTrigger>
                    </TabsList>

                    {/* --- Notifications Tab --- */}
                    <TabsContent value="notifications">
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-950">Canales de notificacion</h2>
                                <p className="text-sm text-zinc-500">Elige como quieres recibir alertas operativas.</p>
                            </div>
                            <div className="space-y-3">
                                <SettingToggle
                                    icon={Mail}
                                    iconColor="bg-zinc-950"
                                    label="Notificaciones por email"
                                    description="Resumenes diarios y alertas criticas directo a tu correo."
                                    checked={emailNotifs}
                                    onChange={setEmailNotifs}
                                />
                                <SettingToggle
                                    icon={Smartphone}
                                    iconColor="bg-zinc-950"
                                    label="Notificaciones push"
                                    description="Alertas en tiempo real en tu navegador o dispositivo."
                                    checked={pushNotifs}
                                    onChange={setPushNotifs}
                                />
                                <SettingToggle
                                    icon={Volume2}
                                    iconColor="bg-zinc-950"
                                    label="Sonidos"
                                    description="Reproduce sonido al recibir una nueva notificacion."
                                    checked={soundEnabled}
                                    onChange={setSoundEnabled}
                                />
                            </div>

                            <Separator className="my-6" />

                            <div>
                                <h2 className="text-lg font-semibold text-zinc-950">Tipo de alerta</h2>
                                <p className="text-sm text-zinc-500">Activa o desactiva categorias especificas.</p>
                            </div>
                            <div className="space-y-3">
                                <SettingToggle
                                    icon={Truck}
                                    iconColor="bg-zinc-950"
                                    label="Alertas de viaje"
                                    description="Actualizaciones de cargue, descargue, inspecciones y GPS."
                                    checked={tripAlerts}
                                    onChange={setTripAlerts}
                                />
                                <SettingToggle
                                    icon={CreditCard}
                                    iconColor="bg-zinc-950"
                                    label="Alertas de pago"
                                    description="Pagos recibidos, retiros y movimientos de billetera."
                                    checked={paymentAlerts}
                                    onChange={setPaymentAlerts}
                                />
                                <SettingToggle
                                    icon={MessageSquare}
                                    iconColor="bg-zinc-950"
                                    label="Emails de marketing"
                                    description="Novedades, tips y promociones de KargaX."
                                    checked={marketingEmails}
                                    onChange={setMarketingEmails}
                                />
                            </div>
                        </div>
                    </TabsContent>

                    {/* --- Security Tab --- */}
                    <TabsContent value="security">
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-950">Seguridad de la cuenta</h2>
                                <p className="text-sm text-zinc-500">Manten tu cuenta protegida con las mejores practicas.</p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <Card variant="default" className="p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950">
                                            <Key className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-zinc-950">Contrasena</p>
                                            <p className="text-xs text-zinc-500">Ultima actualizacion desconocida</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" fullWidth>Cambiar contrasena</Button>
                                </Card>

                                <Card variant="default" className="p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950">
                                            <ShieldCheck className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-zinc-950">MFA (2FA)</p>
                                            <Badge variant="success" size="xs">Activo</Badge>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" fullWidth>Gestionar MFA</Button>
                                </Card>
                            </div>

                            <Card className="border-zinc-200 bg-white p-5 mt-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-zinc-950 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-zinc-950">Sesiones activas</p>
                                        <p className="mt-1 text-sm text-zinc-600">
                                            Actualmente tienes 1 sesion activa. Los secretos y credenciales sensibles se gestionan server-side por auth y RLS.
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            <div className="space-y-3 mt-4">
                                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                                        <Laptop className="h-5 w-5 text-zinc-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-zinc-950">Windows - Chrome</p>
                                        <p className="text-xs text-zinc-500">Sesion actual - Bogota, Colombia</p>
                                    </div>
                                    <Badge variant="success" size="xs">Activa</Badge>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    {/* --- General Tab --- */}
                    <TabsContent value="preferences">
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-950">Preferencias generales</h2>
                                <p className="text-sm text-zinc-500">Configura tu idioma y zona horaria.</p>
                            </div>

                            <Card className="p-5">
                                <label className="block text-sm font-medium text-zinc-700 mb-2">Idioma de la plataforma</label>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {[
                                        { code: 'es', label: 'Espanol' },
                                        { code: 'en', label: 'English' },
                                        { code: 'pt', label: 'Portugues' },
                                    ].map((lang) => (
                                        <button
                                            key={lang.code}
                                            onClick={() => setLanguage(lang.code)}
                                            className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                                                language === lang.code
                                                    ? 'border-zinc-950 bg-zinc-950 text-white ring-2 ring-zinc-950/10'
                                                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                                            }`}
                                        >
                                            {lang.label}
                                        </button>
                                    ))}
                                </div>
                            </Card>

                            <Card className="p-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <Lock className="h-4 w-4 text-zinc-400" />
                                    <p className="text-sm font-medium text-zinc-700">Zona horaria</p>
                                </div>
                                <p className="text-sm text-zinc-500">America/Bogota (UTC-5) - detectada automaticamente.</p>
                            </Card>

                            <Card className="p-5">
                                <div className="flex items-start gap-3">
                                    <Sparkles className="h-5 w-5 text-zinc-950 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-zinc-950">Webhook endurecido</p>
                                        <p className="text-xs text-zinc-500 mt-1">Firma y validacion de entorno activas. Simulacion de pagos limitada a desarrollo. <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">INTERNAL_API_KEY</code> obligatoria en flujos server-to-server.</p>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* --- Appearance Tab --- */}
                    <TabsContent value="account">
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-950">Cuenta</h2>
                                <p className="text-sm text-zinc-500">Identidad, rol y presencia visual de KargaX.</p>
                            </div>

                            <Card className="p-5">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-zinc-950">{user?.fullName || 'Usuario KargaX'}</p>
                                        <p className="break-all text-sm text-zinc-500">{user?.email || 'Correo pendiente'}</p>
                                    </div>
                                    <Badge variant="primary" size="sm">
                                        {user?.userType === 'business' ? 'Empresa' : user?.userType === 'admin' ? 'Admin' : 'Transportador'}
                                    </Badge>
                                </div>
                            </Card>

                            <Card className="border-zinc-200 bg-white p-5">
                                <div className="flex items-start gap-3">
                                    <Palette className="h-5 w-5 text-zinc-950 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-zinc-950">Paleta KargaX</p>
                                        <p className="text-sm text-zinc-600 mt-1">Blanco, negro mate y grises de precision. La marca comunica por espacio, ritmo y claridad.</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <span className="h-8 w-8 rounded-lg border border-zinc-200 bg-white" />
                                            <span className="h-8 w-8 rounded-lg bg-zinc-100" />
                                            <span className="h-8 w-8 rounded-lg bg-zinc-500" />
                                            <span className="h-8 w-8 rounded-lg bg-zinc-950" />
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
