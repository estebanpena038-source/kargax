'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  FileText,
  Lock,
  Mail,
  MapPin,
  Shield,
  Truck,
  User,
} from 'lucide-react';
import KargaxLogo from '@/components/brand/KargaxLogo';
import { AuthCard, Eyebrow } from '@/components/public/PublicLuxury';
import { AndeanPhoneInput, Button, Input, toast } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { RecaptchaCheckbox } from '@/components/ui/RecaptchaCheckbox';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getMfaStatus, getPostAuthRoute } from '@/lib/auth/mfa';
import { resendConfirmationEmail } from '@/lib/supabase/auth';
import { useTranslation } from '@/lib/i18n';
import { useCountryStore } from '@/lib/platform/useUserCountry';
import { validateAndeanPhoneValue } from '@/lib/phone/andean';
import { cn } from '@/lib/utils';
import {
  COUNTRIES,
  COUNTRY_LIST,
  getCities,
  getSubdivisions,
  type SupportedCountry,
} from '@/constants/countries';

type UserType = 'trucker' | 'business' | null;

interface RegistrationFormData {
  userType: UserType;
  fullName: string;
  documentType: string;
  documentNumber: string;
  phone: string;
  country: SupportedCountry;
  department?: string;
  city?: string;
  companyName?: string;
  nit?: string;
  industry?: string;
  address?: string;
  email: string;
  corporateInviteCode?: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  acceptMarketing?: boolean;
  recaptchaToken: string;
}

const baseSchema = z.object({
  userType: z.enum(['trucker', 'business']),
  fullName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  documentType: z.string().min(1, 'Selecciona un tipo de documento'),
  documentNumber: z.string().min(6, 'Número de documento inválido'),
  phone: z.string(),
  email: z.string().email('Correo electrónico inválido'),
  corporateInviteCode: z.string().trim().optional(),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine((value) => value === true, {
    message: 'Debes aceptar los términos y condiciones',
  }),
  acceptMarketing: z.boolean().optional(),
  recaptchaToken: z.string().optional().default(''),
  country: z.enum(['CO', 'EC', 'PE', 'BR']).default('CO'),
  department: z.string().min(1, 'Selecciona tu departamento, provincia o estado'),
  city: z.string().min(1, 'Selecciona tu ciudad'),
  companyName: z.string().optional(),
  nit: z.string().optional(),
  industry: z.string().optional(),
  address: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!validateAndeanPhoneValue(data.phone, data.country)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['phone'],
      message: 'Número de teléfono inválido. Elige el prefijo y usa un móvil válido.',
    });
  }

  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmPassword'],
      message: 'Las contraseñas no coinciden',
    });
  }
});

function resolveLocaleForCountry(country: SupportedCountry) {
  return country === 'BR' ? 'pt-BR' : 'es-CO';
}

function StepAccountType({
  selectedType,
  onSelect,
}: {
  selectedType: UserType;
  onSelect: (type: UserType) => void;
}) {
  const accountTypes = [
    {
      type: 'trucker' as const,
      icon: Truck,
      title: 'Transportador',
      description: 'Viajes, evidencia, reputación y wallet en orden.',
      features: ['Postulación a cargas', 'PIN, fotos y firma', 'Historial operativo'],
    },
    {
      type: 'business' as const,
      icon: Building2,
      title: 'Empresa',
      description: 'Despacho, flota privada, bodega y reportes con trazabilidad.',
      features: ['Flota y marketplace', 'Bodegas conectadas', 'Reporte ejecutivo'],
    },
  ];

  return (
    <div>
      <div className="text-center">
        <Eyebrow>Identidad</Eyebrow>
        <h2 className="kx-public-heading mt-3 font-semibold">Elige cómo vas a operar.</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Dos caminos. La misma claridad.
        </p>
      </div>

      <div className="kx-responsive-grid mt-8 grid gap-4">
        {accountTypes.map((account) => {
          const isSelected = selectedType === account.type;
          const Icon = account.icon;

          return (
            <button
              key={account.type}
              type="button"
              onClick={() => onSelect(account.type)}
              className={cn(
                'kx-public-card relative rounded-lg border bg-white p-5 text-left transition sm:p-6',
                isSelected
                  ? 'border-zinc-950 shadow-[0_20px_60px_-48px_rgba(10,10,10,.7)]'
                  : 'border-zinc-200 hover:border-zinc-950'
              )}
            >
              {isSelected ? (
                <span className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-md bg-zinc-950 text-white">
                  <Check className="h-4 w-4" />
                </span>
              ) : null}

              <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-200 bg-[#f7f7f5]">
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl font-semibold">{account.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{account.description}</p>
              <ul className="mt-5 space-y-2">
                {account.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-zinc-600">
                    <Check className="h-4 w-4 text-zinc-950" />
                    {feature}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepPersonalInfo({
  userType,
  form,
}: {
  userType: UserType;
  form: ReturnType<typeof useForm<RegistrationFormData>>;
}) {
  const { setLocale } = useTranslation();
  const { register, watch, setValue, formState: { errors } } = form;
  const selectedCountry = (watch('country') || 'CO') as SupportedCountry;
  const selectedDepartment = watch('department');
  const countryConfig = COUNTRIES[selectedCountry];
  const subdivisions = React.useMemo(() => getSubdivisions(selectedCountry), [selectedCountry]);
  const cities = React.useMemo(() => {
    if (!selectedDepartment) {
      return [];
    }
    return getCities(selectedCountry, selectedDepartment);
  }, [selectedCountry, selectedDepartment]);

  const documentOptions = countryConfig.documentTypes.map((documentType) => ({
    value: documentType.code,
    label: documentType.name,
  }));
  const countryOptions = COUNTRY_LIST.map((country) => ({
    value: country.code,
    label: `${country.flag} ${country.nativeName}`,
    description: `${country.currencySymbol} ${country.currencyCode}`,
  }));
  const departmentOptions = subdivisions.map((subdivision) => ({
    value: subdivision.code,
    label: subdivision.name,
    description: subdivision.capital,
  }));
  const cityOptions = cities.map((city) => ({
    value: city.code,
    label: city.name,
  }));
  const industryOptions = [
    { value: 'agriculture', label: 'Agroindustria' },
    { value: 'automotive', label: 'Automotriz' },
    { value: 'construction', label: 'Construcción' },
    { value: 'consumer', label: 'Consumo masivo' },
    { value: 'energy', label: 'Energía' },
    { value: 'food', label: 'Alimentos y bebidas' },
    { value: 'manufacturing', label: 'Manufactura' },
    { value: 'retail', label: 'Retail' },
    { value: 'technology', label: 'Tecnología' },
    { value: 'other', label: 'Otra' },
  ];

  return (
    <div>
      <div className="text-center">
        <Eyebrow>Datos base</Eyebrow>
        <h2 className="kx-public-heading mt-3 font-semibold">Información para operar.</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Campos amplios, país andino y ubicación sin saturación.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        <Select
          label="País"
          options={countryOptions}
          value={selectedCountry}
          onChange={(value) => {
            const nextCountry = value as SupportedCountry;
            setValue('country', nextCountry, { shouldValidate: true, shouldDirty: true });
            setValue('department', '');
            setValue('city', '');
            setValue('documentType', '');
            setValue('phone', '');
            void setLocale(resolveLocaleForCountry(nextCountry));
          }}
          searchable
        />
        <p className="text-xs text-zinc-500">
          {countryConfig.flag} Moneda: {countryConfig.currencySymbol} {countryConfig.currencyCode} · Tel: {countryConfig.phoneCode}
        </p>

        <div className="grid gap-4 min-[720px]:grid-cols-2">
          <Select
            label={countryConfig.subdivisionLabel}
            options={departmentOptions}
            value={watch('department')}
            onChange={(value) => {
              setValue('department', value, { shouldValidate: true, shouldDirty: true });
              setValue('city', '');
            }}
            errorMessage={errors.department?.message}
            searchable
          />
          <Select
            label={countryConfig.cityLabel}
            options={cityOptions}
            value={watch('city')}
            onChange={(value) => setValue('city', value, { shouldValidate: true, shouldDirty: true })}
            errorMessage={errors.city?.message}
            disabled={!selectedDepartment}
            searchable
          />
        </div>

        <Input
          label="Nombre completo"
          placeholder="Nombre y apellido"
          leftIcon={<User className="h-5 w-5" />}
          errorMessage={errors.fullName?.message}
          {...register('fullName')}
        />

        <div className="grid gap-4 min-[720px]:grid-cols-2">
          <Select
            label="Tipo de documento"
            options={documentOptions}
            value={watch('documentType')}
            onChange={(value) => setValue('documentType', value, { shouldValidate: true, shouldDirty: true })}
            errorMessage={errors.documentType?.message}
            searchable
          />
          <Input
            label="Número de documento"
            placeholder="1234567890"
            leftIcon={<FileText className="h-5 w-5" />}
            errorMessage={errors.documentNumber?.message}
            {...register('documentNumber')}
          />
        </div>

        <AndeanPhoneInput
          label="Teléfono celular"
          value={watch('phone')}
          onChange={(value) => setValue('phone', value, { shouldValidate: true, shouldDirty: true })}
          defaultCountryCode={selectedCountry}
          helperText="Selecciona el prefijo y escribe el celular sin espacios."
          errorMessage={errors.phone?.message}
        />

        {userType === 'business' ? (
          <div className="space-y-5 border-t border-zinc-200 pt-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <Building2 className="h-4 w-4" />
              Datos de empresa
            </div>
            <Input
              label="Nombre de la empresa"
              placeholder="Empresa S.A.S."
              leftIcon={<Building2 className="h-5 w-5" />}
              errorMessage={errors.companyName?.message}
              {...register('companyName')}
            />
            <div className="grid gap-4 min-[720px]:grid-cols-2">
              <Input
                label="NIT"
                placeholder="900.123.456-7"
                leftIcon={<FileText className="h-5 w-5" />}
                errorMessage={errors.nit?.message}
                {...register('nit')}
              />
              <Select
                label="Industria"
                options={industryOptions}
                value={watch('industry')}
                onChange={(value) => setValue('industry', value)}
                placeholder="Selecciona una industria"
                searchable
              />
            </div>
            <Input
              label="Dirección"
              placeholder="Dirección principal"
              leftIcon={<MapPin className="h-5 w-5" />}
              errorMessage={errors.address?.message}
              {...register('address')}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StepCredentials({
  form,
  captchaEnabled,
  userType,
}: {
  form: ReturnType<typeof useForm<RegistrationFormData>>;
  captchaEnabled: boolean;
  userType: UserType;
}) {
  const { register, watch, setValue, formState: { errors } } = form;
  const password = watch('password') || '';
  const email = watch('email') || '';

  const requirements = [
    { label: '8 caracteres', met: password.length >= 8 },
    { label: 'Mayúscula', met: /[A-Z]/.test(password) },
    { label: 'Minúscula', met: /[a-z]/.test(password) },
    { label: 'Número', met: /[0-9]/.test(password) },
    { label: 'Especial', met: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = requirements.filter((item) => item.met).length;

  return (
    <div>
      <div className="text-center">
        <Eyebrow>Credenciales</Eyebrow>
        <h2 className="kx-public-heading mt-3 font-semibold">Cierra tu acceso.</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Correo, contraseña, términos y verificación en un solo paso.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        <Input
          label="Correo electrónico"
          type="email"
          placeholder="tu@empresa.com"
          helperText="Usaremos este correo para seguridad y notificaciones operativas."
          leftIcon={<Mail className="h-5 w-5" />}
          errorMessage={errors.email?.message}
          {...register('email')}
        />

        {userType === 'trucker' ? (
          <Input
          label="Código de invitación"
          placeholder="Opcional para conductores invitados"
          helperText="Solo aplica si una empresa te invitó a su flota privada."
          errorMessage={errors.corporateInviteCode?.message}
          {...register('corporateInviteCode')}
          />
        ) : null}

        <div className="grid gap-4 min-[720px]:grid-cols-2">
          <Input
            label="Contraseña"
            type="password"
            placeholder="Mínimo 8 caracteres"
            leftIcon={<Lock className="h-5 w-5" />}
            showPasswordToggle
            errorMessage={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            placeholder="Repite tu contraseña"
            leftIcon={<Shield className="h-5 w-5" />}
            showPasswordToggle
            errorMessage={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>

        <div className="rounded-lg border border-zinc-200 bg-[#f7f7f5] p-4">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-zinc-950 transition-all"
              style={{ width: `${(score / requirements.length) * 100}%` }}
            />
          </div>
          <div className="kx-responsive-grid-sm mt-4 grid gap-2">
            {requirements.map((item) => (
              <span key={item.label} className={cn('text-xs', item.met ? 'font-semibold text-zinc-950' : 'text-zinc-500')}>
                {item.met ? '✓ ' : ''}{item.label}
              </span>
            ))}
          </div>
        </div>

        <label className="relative flex min-h-11 items-start gap-3 rounded-lg border border-zinc-200 p-4 text-sm leading-6 text-zinc-600">
          <input
            type="checkbox"
            aria-label="Aceptar terminos y politica de privacidad"
            className="peer absolute left-4 top-3 h-11 w-11 cursor-pointer opacity-0"
            {...register('acceptTerms')}
          />
          <span
            aria-hidden="true"
            className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white transition-colors after:h-2 after:w-2 after:rounded-sm after:bg-white after:opacity-0 after:transition-opacity peer-checked:border-zinc-950 peer-checked:bg-zinc-950 peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-950/20"
          />
          <span>
            Acepto los{' '}
            <Link href="/terminos" className="font-semibold text-zinc-950 underline underline-offset-4">términos</Link>
            {' '}y la{' '}
            <Link href="/privacidad" className="font-semibold text-zinc-950 underline underline-offset-4">política de privacidad</Link>.
            {errors.acceptTerms?.message ? (
              <span className="mt-1 block font-medium text-zinc-950">{errors.acceptTerms.message}</span>
            ) : null}
          </span>
        </label>

        <label className="relative flex min-h-11 items-start gap-3 text-sm leading-6 text-zinc-600">
          <input
            type="checkbox"
            aria-label="Recibir comunicaciones de operacion y producto"
            className="peer absolute left-0 top-0 h-11 w-11 cursor-pointer opacity-0"
            {...register('acceptMarketing')}
          />
          <span
            aria-hidden="true"
            className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white transition-colors after:h-2 after:w-2 after:rounded-sm after:bg-white after:opacity-0 after:transition-opacity peer-checked:border-zinc-950 peer-checked:bg-zinc-950 peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-950/20"
          />
          <span>Quiero recibir comunicaciones útiles sobre operación y producto.</span>
        </label>

        {captchaEnabled ? (
          <div className="rounded-lg border border-zinc-200 bg-[#f7f7f5] p-4">
            <RecaptchaCheckbox
              onVerify={(token) => setValue('recaptchaToken', token || '', { shouldValidate: true })}
              error={errors.recaptchaToken?.message}
            />
          </div>
        ) : null}

        {email ? (
          <p className="text-center text-xs leading-5 text-zinc-500">
            La confirmación llegará a {email}. Revisa spam o correo corporativo si tarda.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StepSuccess({ email }: { email: string }) {
  const [resending, setResending] = React.useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error('Correo requerido', 'No encontramos el correo de registro');
      return;
    }

    setResending(true);
    const result = await resendConfirmationEmail(email);
    setResending(false);

    if (!result.success) {
      toast.error('No se pudo reenviar', result.error || 'Intenta de nuevo');
      return;
    }

    toast.success('Correo reenviado', 'Revisa tu bandeja de entrada y spam');
  };

  return (
    <div className="text-center">
      <div className="mb-7 flex justify-center">
        <KargaxLogo variant="mark" size="lg" />
      </div>
      <Eyebrow>Cuenta creada</Eyebrow>
      <h2 className="kx-public-heading mt-3 font-semibold">Confirma tu correo.</h2>
      <p className="mt-4 text-sm leading-7 text-zinc-600">
        Te enviamos un enlace de verificación a <span className="font-semibold text-zinc-950">{email}</span>.
        Si no aparece en dos minutos, revisa spam o correo corporativo.
      </p>
      <div className="mt-8 grid gap-3">
        <Button asChild>
          <Link href={`/verificar-email?email=${encodeURIComponent(email)}`}>Ir a verificación</Link>
        </Button>
        <Button variant="outline" onClick={handleResend} isLoading={resending}>
          Reenviar correo
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/login">Entrar</Link>
        </Button>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { setLocale } = useTranslation();
  const { signUp, isLoading } = useAuthStore();
  const setCountry = useCountryStore((state) => state.setCountry);
  const captchaEnabled = React.useMemo(
    () => Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim()),
    []
  );

  const [currentStep, setCurrentStep] = React.useState(0);
  const [userType, setUserType] = React.useState<UserType>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [inviteCodeFromQuery, setInviteCodeFromQuery] = React.useState('');

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(baseSchema) as unknown as Resolver<RegistrationFormData>,
    defaultValues: {
      userType: null,
      fullName: '',
      documentType: '',
      documentNumber: '',
      phone: '',
      country: 'CO',
      department: '',
      city: '',
      companyName: '',
      nit: '',
      industry: '',
      address: '',
      email: '',
      corporateInviteCode: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
      acceptMarketing: false,
      recaptchaToken: '',
    },
    mode: 'onBlur',
  });

  const { handleSubmit, trigger, setValue } = form;

  const steps = [
    { id: 'account-type', title: 'Identidad', icon: User },
    { id: 'personal-info', title: 'Datos', icon: FileText },
    { id: 'credentials', title: 'Acceso', icon: Shield },
  ];

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('invite')?.trim().toUpperCase() || '';
    const typeFromQuery = params.get('tipo');

    setInviteCodeFromQuery(inviteCode);

    if (inviteCode) {
      setValue('corporateInviteCode', inviteCode, { shouldValidate: false });
      setValue('userType', 'trucker', { shouldValidate: false });
      setUserType('trucker');
      return;
    }

    if (typeFromQuery === 'business' || typeFromQuery === 'trucker') {
      setValue('userType', typeFromQuery, { shouldValidate: false });
      setUserType(typeFromQuery);
    }
  }, [setValue]);

  React.useEffect(() => {
    void setLocale(resolveLocaleForCountry(form.getValues('country') || 'CO'));
  }, [form, setLocale]);

  const handleNext = async () => {
    let isValid = true;

    if (currentStep === 0) {
      if (!userType) {
        toast.warning('Selección requerida', 'Elige Transportador o Empresa');
        return;
      }
      setValue('userType', userType, { shouldValidate: true, shouldDirty: true });
    }

    if (currentStep === 1) {
      isValid = await trigger(['fullName', 'country', 'department', 'city', 'documentType', 'documentNumber', 'phone']);
      if (userType === 'business') {
        isValid = isValid && await trigger(['companyName', 'nit']);
      }
    }

    if (isValid && currentStep < steps.length - 1) {
      setCurrentStep((previous) => previous + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((previous) => previous - 1);
    }
  };

  const onSubmit = async (data: RegistrationFormData) => {
    try {
      if (captchaEnabled && !data.recaptchaToken) {
        toast.error('Verificación requerida', 'Completa la verificación anti-bot para crear tu cuenta');
        return;
      }

      const registerData = {
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phone: data.phone || undefined,
        userType: data.userType as 'trucker' | 'business',
        corporateInviteCode: data.userType === 'trucker'
          ? (data.corporateInviteCode || inviteCodeFromQuery || undefined)
          : undefined,
        documentType: data.documentType || undefined,
        documentNumber: data.documentNumber || undefined,
        country: data.country || 'CO',
        companyName: data.companyName || undefined,
        nit: data.nit || undefined,
        industry: data.industry || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        department: data.department || undefined,
        acceptTerms: data.acceptTerms,
        recaptchaToken: data.recaptchaToken || undefined,
      };

      const result = await signUp(registerData);

      if (result.success) {
        setCountry(data.country || 'CO');

        if (result.needsEmailConfirmation) {
          setIsSuccess(true);
          toast.success('Registro exitoso', 'Te enviamos un correo de confirmación');
          return;
        }

        toast.success('Cuenta creada', 'Tu cuenta fue verificada automáticamente');
        const status = await getMfaStatus();
        router.push(getPostAuthRoute(status, '/onboarding'));
        return;
      }

      toast.error('Error al crear cuenta', result.error || 'Intenta de nuevo');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Error inesperado', 'Por favor intenta de nuevo');
    }
  };

  return (
    <main className="kx-public-shell bg-[#f7f7f5] text-zinc-950 lg:grid lg:grid-cols-[0.86fr_1.14fr]">
      <aside className="hidden min-h-svh min-w-0 bg-zinc-950 text-white lg:flex">
        <div className="flex w-full flex-col justify-between px-12 py-12 xl:px-16">
          <Link href="/">
            <KargaxLogo tone="light" size="lg" />
          </Link>
          <div>
            <Eyebrow dark>Registro KX</Eyebrow>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.02] xl:text-5xl">
              Elige identidad sin ansiedad.
            </h1>
            <div className="mt-10 space-y-4">
              {steps.map((step, index) => {
                const isCompleted = index < currentStep || isSuccess;
                const isCurrent = index === currentStep && !isSuccess;
                const Icon = step.icon;

                return (
                  <div key={step.id} className="flex items-center gap-4">
                    <span
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg border',
                        isCompleted || isCurrent
                          ? 'border-white bg-white text-zinc-950'
                          : 'border-white/12 text-white/42'
                      )}
                    >
                      {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </span>
                    <span className={cn('text-sm font-medium', isCurrent ? 'text-white' : 'text-white/52')}>
                      {step.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="max-w-sm text-xs leading-6 text-white/42">
            Cuenta creada con validación, país operativo y seguridad lista para MFA.
          </p>
        </div>
      </aside>

      <section className="flex min-h-svh min-w-0 items-center justify-center px-3 py-6 min-[380px]:px-4 sm:px-6 sm:py-8 lg:px-10">
        <div className="w-full max-w-2xl">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link href="/">
              <KargaxLogo size="lg" />
            </Link>
            <Link href="/login" className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-semibold underline underline-offset-4">
              Entrar
            </Link>
          </div>

          <AuthCard className="sm:p-8 lg:p-9">
            <form onSubmit={handleSubmit(onSubmit)}>
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -18 }}
                  >
                    <StepSuccess email={form.getValues('email')} />
                  </motion.div>
                ) : (
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -18 }}
                    transition={{ duration: 0.24 }}
                  >
                    <div className="mb-7 lg:hidden">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Paso {currentStep + 1} de {steps.length}</span>
                        <span className="font-semibold">{steps[currentStep].title}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
                        <div
                          className="h-full rounded-full bg-zinc-950 transition-all"
                          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    {currentStep === 0 ? (
                      <StepAccountType selectedType={userType} onSelect={setUserType} />
                    ) : null}

                    {currentStep === 1 ? (
                      <StepPersonalInfo userType={userType} form={form} />
                    ) : null}

                    {currentStep === 2 ? (
                      <StepCredentials form={form} captchaEnabled={captchaEnabled} userType={userType} />
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>

              {!isSuccess ? (
                <div className="mt-8 flex flex-col-reverse gap-3 border-t border-zinc-200 pt-6 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
                  {currentStep > 0 ? (
                    <Button type="button" variant="ghost" onClick={handleBack}>
                      <ArrowLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                  ) : (
                    <span />
                  )}

                  {currentStep < steps.length - 1 ? (
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={currentStep === 0 && !userType}
                    >
                      Siguiente
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" isLoading={isLoading}>
                      Crear cuenta
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : null}
            </form>

            {!isSuccess ? (
              <p className="mt-6 text-center text-sm text-zinc-600">
                ¿Ya tienes cuenta?{' '}
                <Link href="/login" className="inline-flex min-h-11 items-center justify-center px-3 font-semibold text-zinc-950 underline underline-offset-4">
                  Entrar
                </Link>
              </p>
            ) : null}
          </AuthCard>
        </div>
      </section>
    </main>
  );
}
