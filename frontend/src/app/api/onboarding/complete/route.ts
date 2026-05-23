import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

type BusinessOnboardingPayload = {
    userType: 'business';
    companyName: string;
    nit: string;
    industry: string;
    address?: string | null;
    department: string;
    city: string;
    phone?: string | null;
};

type TruckerOnboardingPayload = {
    userType: 'trucker';
    licenseNumber: string;
    licenseType: string;
    yearsExperience?: number;
    serviceAreas?: string[];
    phone?: string | null;
};

type OnboardingPayload = BusinessOnboardingPayload | TruckerOnboardingPayload;

function cleanText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function getCountryCode(profile: { country_code?: string | null } | null) {
    const countryCode = profile?.country_code;
    return countryCode === 'EC' || countryCode === 'PE' || countryCode === 'BR'
        ? countryCode
        : 'CO';
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const body = await request.json().catch(() => null) as OnboardingPayload | null;

    if (!body || (body.userType !== 'business' && body.userType !== 'trucker')) {
        return apiError('Payload de onboarding invalido', {
            requestId,
            status: 400,
            code: 'ONBOARDING_INVALID_PAYLOAD',
        });
    }

    if (profile?.user_type && profile.user_type !== body.userType && profile.user_type !== 'admin') {
        return apiError('El tipo de usuario no coincide con la sesion', {
            requestId,
            status: 403,
            code: 'ONBOARDING_USER_TYPE_MISMATCH',
        });
    }

    const countryCode = getCountryCode(profile);

    if (body.userType === 'business') {
        const companyName = cleanText(body.companyName);
        const nit = cleanText(body.nit);
        const industry = cleanText(body.industry);
        const department = cleanText(body.department);
        const city = cleanText(body.city);

        if (!companyName || !nit || !industry || !department || !city) {
            return apiError('Faltan datos empresariales obligatorios', {
                requestId,
                status: 400,
                code: 'ONBOARDING_BUSINESS_REQUIRED',
            });
        }

        const { error: businessError } = await supabaseAdmin
            .from('business_profiles')
            .upsert({
                user_id: authUser.id,
                company_name: companyName,
                nit,
                industry,
                address: cleanText(body.address) || null,
                city,
                department,
                country_code: countryCode,
            }, { onConflict: 'user_id' });

        if (businessError) {
            return apiError(businessError.message || 'No se pudo guardar la empresa', {
                requestId,
                status: 500,
                code: 'ONBOARDING_BUSINESS_SAVE_FAILED',
            });
        }
    }

    if (body.userType === 'trucker') {
        const licenseNumber = cleanText(body.licenseNumber);
        const licenseType = cleanText(body.licenseType);
        const serviceAreas = Array.isArray(body.serviceAreas)
            ? body.serviceAreas.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
            : [];

        if (!licenseNumber || !licenseType) {
            return apiError('Faltan datos del transportador', {
                requestId,
                status: 400,
                code: 'ONBOARDING_TRUCKER_REQUIRED',
            });
        }

        const { error: truckerError } = await supabaseAdmin
            .from('trucker_profiles')
            .upsert({
                user_id: authUser.id,
                license_number: licenseNumber,
                license_type: licenseType,
                years_experience: Math.max(0, Number(body.yearsExperience || 0)),
                service_areas: serviceAreas,
                country_code: countryCode,
            }, { onConflict: 'user_id' });

        if (truckerError) {
            return apiError(truckerError.message || 'No se pudo guardar el transportador', {
                requestId,
                status: 500,
                code: 'ONBOARDING_TRUCKER_SAVE_FAILED',
            });
        }
    }

    const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .update({
            phone: cleanText(body.phone) || null,
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
        })
        .eq('id', authUser.id);

    if (profileError) {
        return apiError(profileError.message || 'No se pudo cerrar el onboarding', {
            requestId,
            status: 500,
            code: 'ONBOARDING_PROFILE_SAVE_FAILED',
        });
    }

    return apiSuccess({
        onboardingCompleted: true,
        userType: body.userType,
    }, {
        requestId,
        code: 'ONBOARDING_COMPLETED',
    });
}
