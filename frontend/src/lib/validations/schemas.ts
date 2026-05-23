// =============================================================================
// KargaX - Zod Validation Schemas
// =============================================================================

import { z } from 'zod';
import { VEHICLE_TYPES, CARGO_TYPES } from '@/constants/colombia';
import { COUNTRY_REGISTRY } from '@/lib/platform/market-registry';
import { validateAndeanPhoneValue } from '@/lib/phone/andean';

const documentTypeValues = Array.from(new Set(
    COUNTRY_REGISTRY.flatMap((country) => country.document_types.map((document) => document.code))
));

const andeanPhone = z.string().refine(
    (value) => validateAndeanPhoneValue(value, 'CO'),
    'Numero de telefono invalido. Selecciona el prefijo y usa un celular andino valido.'
);

const taxIdentifier = z.string().regex(
    /^[A-Za-z0-9.\-]{8,20}$/,
    'Identificador fiscal invalido. Usa el formato valido para tu pais.'
);

const documentNumber = z.string().min(6, 'Numero de documento invalido').max(15);

const password = z.string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayuscula')
    .regex(/[a-z]/, 'Debe contener al menos una minuscula')
    .regex(/[0-9]/, 'Debe contener al menos un numero')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un caracter especial');

export const loginSchema = z.object({
    email: z.string().email('Correo electronico invalido'),
    password: z.string().min(1, 'La contrasena es requerida'),
    rememberMe: z.boolean().optional(),
});

export const registerSchema = z.object({
    email: z.string().email('Correo electronico invalido'),
    password,
    confirmPassword: z.string(),
    fullName: z.string().min(3, 'Nombre completo requerido'),
    phone: andeanPhone,
    userType: z.enum(['trucker', 'business']),
    documentType: z.enum(documentTypeValues as [string, ...string[]]),
    documentNumber,
    acceptTerms: z.boolean().refine((value) => value === true, {
        message: 'Debes aceptar los terminos y condiciones',
    }),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Las contrasenas no coinciden',
    path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
    email: z.string().email('Correo electronico invalido'),
});

export const resetPasswordSchema = z.object({
    password,
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Las contrasenas no coinciden',
    path: ['confirmPassword'],
});

export const truckerProfileSchema = z.object({
    licenseNumber: z.string().min(5, 'Numero de licencia invalido'),
    licenseCategory: z.enum(['A1', 'A2', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3']),
    licenseExpiry: z.string().refine((date) => new Date(date) > new Date(), {
        message: 'La licencia debe estar vigente',
    }),
    experienceYears: z.number().min(0).max(50),
    availableForWork: z.boolean(),
});

export const businessProfileSchema = z.object({
    companyName: z.string().min(3, 'Nombre de empresa requerido'),
    nit: taxIdentifier,
    industry: z.string().min(2, 'Industria requerida'),
    address: z.string().min(10, 'Direccion completa requerida'),
    city: z.string().min(2, 'Ciudad requerida'),
    department: z.string().min(2, 'Region requerida'),
    contactPhone: andeanPhone,
});

export const vehicleSchema = z.object({
    plateNumber: z.string().regex(
        /^[A-Z0-9-]{5,8}$/,
        'Placa invalida'
    ),
    vehicleType: z.enum(VEHICLE_TYPES.map((vehicle) => vehicle.code) as [string, ...string[]]),
    brand: z.string().min(2, 'Marca requerida'),
    model: z.string().min(1, 'Modelo requerido'),
    year: z.number().min(1990).max(new Date().getFullYear() + 1),
    capacityTons: z.number().min(0.5).max(100),
    volumeM3: z.number().min(1).max(200).optional(),
    soatExpiry: z.string().refine((date) => new Date(date) > new Date(), {
        message: 'El seguro obligatorio debe estar vigente',
    }),
    technomechanicalExpiry: z.string().refine((date) => new Date(date) > new Date(), {
        message: 'La revision tecnica debe estar vigente',
    }),
    insuranceExpiry: z.string().refine((date) => new Date(date) > new Date(), {
        message: 'El seguro debe estar vigente',
    }),
});

export const cargoOfferSchema = z.object({
    title: z.string().min(10, 'Titulo debe tener al menos 10 caracteres').max(100),
    description: z.string().min(20, 'Descripcion debe tener al menos 20 caracteres').max(1000),
    cargoType: z.enum(CARGO_TYPES.map((cargo) => cargo.code) as [string, ...string[]]),
    weightTons: z.number().min(0.1, 'Peso minimo 0.1 toneladas').max(100),
    volumeM3: z.number().min(0.1).max(200).optional(),
    originCity: z.string().min(2, 'Ciudad de origen requerida'),
    originDepartment: z.string().min(2, 'Region de origen requerida'),
    originAddress: z.string().min(10, 'Direccion de origen completa requerida'),
    destinationCity: z.string().min(2, 'Ciudad de destino requerida'),
    destinationDepartment: z.string().min(2, 'Region de destino requerida'),
    destinationAddress: z.string().min(10, 'Direccion de destino completa requerida'),
    pickupDate: z.string().refine((date) => new Date(date) >= new Date(), {
        message: 'La fecha de recogida debe ser futura',
    }),
    deliveryDate: z.string(),
    price: z.number().min(100, 'Precio minimo invalido'),
    priceNegotiable: z.boolean(),
    vehicleTypeRequired: z.enum(VEHICLE_TYPES.map((vehicle) => vehicle.code) as [string, ...string[]]),
    specialRequirements: z.string().max(500).optional(),
}).refine((data) => new Date(data.deliveryDate) > new Date(data.pickupDate), {
    message: 'La fecha de entrega debe ser posterior a la fecha de recogida',
    path: ['deliveryDate'],
});

export const bidSchema = z.object({
    proposedPrice: z.number().min(100, 'Precio minimo invalido'),
    vehicleId: z.string().uuid('Vehiculo invalido'),
    message: z.string().max(500).optional(),
    estimatedDelivery: z.string().refine((date) => new Date(date) >= new Date(), {
        message: 'La fecha de entrega debe ser futura',
    }),
});

export const messageSchema = z.object({
    content: z.string().min(1, 'El mensaje no puede estar vacio').max(2000),
    messageType: z.enum(['text', 'image', 'document', 'location']).default('text'),
});

export const reviewSchema = z.object({
    rating: z.number().min(1).max(5),
    comment: z.string().max(500).optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type TruckerProfileFormData = z.infer<typeof truckerProfileSchema>;
export type BusinessProfileFormData = z.infer<typeof businessProfileSchema>;
export type VehicleFormData = z.infer<typeof vehicleSchema>;
export type CargoOfferFormData = z.infer<typeof cargoOfferSchema>;
export type BidFormData = z.infer<typeof bidSchema>;
export type MessageFormData = z.infer<typeof messageSchema>;
export type ReviewFormData = z.infer<typeof reviewSchema>;
