// =============================================================================
// KargaX - Colombian Constants
// Complete dataset for logistics and transport in Colombia
// =============================================================================

// =============================================================================
// Types
// =============================================================================
export interface Department {
    code: string;
    name: string;
    capital: string;
    daneCode: string;
}

export interface City {
    code: string;
    name: string;
    departmentCode: string;
    daneCode: string;
    isCapital?: boolean;
}

export interface Route {
    origin: string;
    destination: string;
    distanceKm: number;
    estimatedHours: number;
    tollCount: number;
    mainHighway: string;
}

// =============================================================================
// Colombian Departments (32 + Bogotá D.C.)
// =============================================================================
export const COLOMBIAN_DEPARTMENTS: readonly Department[] = [
    { code: 'AMA', name: 'Amazonas', capital: 'Leticia', daneCode: '91' },
    { code: 'ANT', name: 'Antioquia', capital: 'Medellín', daneCode: '05' },
    { code: 'ARA', name: 'Arauca', capital: 'Arauca', daneCode: '81' },
    { code: 'ATL', name: 'Atlántico', capital: 'Barranquilla', daneCode: '08' },
    { code: 'BOG', name: 'Bogotá D.C.', capital: 'Bogotá', daneCode: '11' },
    { code: 'BOL', name: 'Bolívar', capital: 'Cartagena', daneCode: '13' },
    { code: 'BOY', name: 'Boyacá', capital: 'Tunja', daneCode: '15' },
    { code: 'CAL', name: 'Caldas', capital: 'Manizales', daneCode: '17' },
    { code: 'CAQ', name: 'Caquetá', capital: 'Florencia', daneCode: '18' },
    { code: 'CAS', name: 'Casanare', capital: 'Yopal', daneCode: '85' },
    { code: 'CAU', name: 'Cauca', capital: 'Popayán', daneCode: '19' },
    { code: 'CES', name: 'Cesar', capital: 'Valledupar', daneCode: '20' },
    { code: 'CHO', name: 'Chocó', capital: 'Quibdó', daneCode: '27' },
    { code: 'COR', name: 'Córdoba', capital: 'Montería', daneCode: '23' },
    { code: 'CUN', name: 'Cundinamarca', capital: 'Bogotá', daneCode: '25' },
    { code: 'GUA', name: 'Guainía', capital: 'Inírida', daneCode: '94' },
    { code: 'GUV', name: 'Guaviare', capital: 'San José del Guaviare', daneCode: '95' },
    { code: 'HUI', name: 'Huila', capital: 'Neiva', daneCode: '41' },
    { code: 'LAG', name: 'La Guajira', capital: 'Riohacha', daneCode: '44' },
    { code: 'MAG', name: 'Magdalena', capital: 'Santa Marta', daneCode: '47' },
    { code: 'MET', name: 'Meta', capital: 'Villavicencio', daneCode: '50' },
    { code: 'NAR', name: 'Nariño', capital: 'Pasto', daneCode: '52' },
    { code: 'NSA', name: 'Norte de Santander', capital: 'Cúcuta', daneCode: '54' },
    { code: 'PUT', name: 'Putumayo', capital: 'Mocoa', daneCode: '86' },
    { code: 'QUI', name: 'Quindío', capital: 'Armenia', daneCode: '63' },
    { code: 'RIS', name: 'Risaralda', capital: 'Pereira', daneCode: '66' },
    { code: 'SAP', name: 'San Andrés y Providencia', capital: 'San Andrés', daneCode: '88' },
    { code: 'SAN', name: 'Santander', capital: 'Bucaramanga', daneCode: '68' },
    { code: 'SUC', name: 'Sucre', capital: 'Sincelejo', daneCode: '70' },
    { code: 'TOL', name: 'Tolima', capital: 'Ibagué', daneCode: '73' },
    { code: 'VAL', name: 'Valle del Cauca', capital: 'Cali', daneCode: '76' },
    { code: 'VAU', name: 'Vaupés', capital: 'Mitú', daneCode: '97' },
    { code: 'VIC', name: 'Vichada', capital: 'Puerto Carreño', daneCode: '99' },
] as const;

// =============================================================================
// Major Colombian Cities (Top 50 by population for logistics)
// =============================================================================
export const MAJOR_CITIES: readonly City[] = [
    // Bogotá
    { code: 'BOG001', name: 'Bogotá D.C.', departmentCode: 'BOG', daneCode: '11001', isCapital: true },
    // Antioquia
    { code: 'ANT001', name: 'Medellín', departmentCode: 'ANT', daneCode: '05001', isCapital: true },
    { code: 'ANT002', name: 'Bello', departmentCode: 'ANT', daneCode: '05088' },
    { code: 'ANT003', name: 'Itagüí', departmentCode: 'ANT', daneCode: '05360' },
    { code: 'ANT004', name: 'Envigado', departmentCode: 'ANT', daneCode: '05266' },
    { code: 'ANT005', name: 'Apartadó', departmentCode: 'ANT', daneCode: '05045' },
    { code: 'ANT006', name: 'Rionegro', departmentCode: 'ANT', daneCode: '05615' },
    // Valle del Cauca
    { code: 'VAL001', name: 'Cali', departmentCode: 'VAL', daneCode: '76001', isCapital: true },
    { code: 'VAL002', name: 'Buenaventura', departmentCode: 'VAL', daneCode: '76109' },
    { code: 'VAL003', name: 'Palmira', departmentCode: 'VAL', daneCode: '76520' },
    { code: 'VAL004', name: 'Tuluá', departmentCode: 'VAL', daneCode: '76834' },
    // Atlántico
    { code: 'ATL001', name: 'Barranquilla', departmentCode: 'ATL', daneCode: '08001', isCapital: true },
    { code: 'ATL002', name: 'Soledad', departmentCode: 'ATL', daneCode: '08758' },
    { code: 'ATL003', name: 'Malambo', departmentCode: 'ATL', daneCode: '08433' },
    // Bolívar
    { code: 'BOL001', name: 'Cartagena', departmentCode: 'BOL', daneCode: '13001', isCapital: true },
    { code: 'BOL002', name: 'Magangué', departmentCode: 'BOL', daneCode: '13430' },
    // Santander
    { code: 'SAN001', name: 'Bucaramanga', departmentCode: 'SAN', daneCode: '68001', isCapital: true },
    { code: 'SAN002', name: 'Floridablanca', departmentCode: 'SAN', daneCode: '68276' },
    { code: 'SAN003', name: 'Barrancabermeja', departmentCode: 'SAN', daneCode: '68081' },
    // Norte de Santander
    { code: 'NSA001', name: 'Cúcuta', departmentCode: 'NSA', daneCode: '54001', isCapital: true },
    // Cundinamarca
    { code: 'CUN001', name: 'Soacha', departmentCode: 'CUN', daneCode: '25754' },
    { code: 'CUN002', name: 'Girardot', departmentCode: 'CUN', daneCode: '25307' },
    { code: 'CUN003', name: 'Zipaquirá', departmentCode: 'CUN', daneCode: '25899' },
    { code: 'CUN004', name: 'Chía', departmentCode: 'CUN', daneCode: '25175' },
    // Tolima
    { code: 'TOL001', name: 'Ibagué', departmentCode: 'TOL', daneCode: '73001', isCapital: true },
    // Meta
    { code: 'MET001', name: 'Villavicencio', departmentCode: 'MET', daneCode: '50001', isCapital: true },
    // Huila
    { code: 'HUI001', name: 'Neiva', departmentCode: 'HUI', daneCode: '41001', isCapital: true },
    // Magdalena
    { code: 'MAG001', name: 'Santa Marta', departmentCode: 'MAG', daneCode: '47001', isCapital: true },
    // Córdoba
    { code: 'COR001', name: 'Montería', departmentCode: 'COR', daneCode: '23001', isCapital: true },
    // Risaralda
    { code: 'RIS001', name: 'Pereira', departmentCode: 'RIS', daneCode: '66001', isCapital: true },
    { code: 'RIS002', name: 'Dosquebradas', departmentCode: 'RIS', daneCode: '66170' },
    // Caldas
    { code: 'CAL001', name: 'Manizales', departmentCode: 'CAL', daneCode: '17001', isCapital: true },
    // Quindío
    { code: 'QUI001', name: 'Armenia', departmentCode: 'QUI', daneCode: '63001', isCapital: true },
    // Boyacá
    { code: 'BOY001', name: 'Tunja', departmentCode: 'BOY', daneCode: '15001', isCapital: true },
    { code: 'BOY002', name: 'Duitama', departmentCode: 'BOY', daneCode: '15238' },
    { code: 'BOY003', name: 'Sogamoso', departmentCode: 'BOY', daneCode: '15759' },
    // Nariño
    { code: 'NAR001', name: 'Pasto', departmentCode: 'NAR', daneCode: '52001', isCapital: true },
    { code: 'NAR002', name: 'Ipiales', departmentCode: 'NAR', daneCode: '52356' },
    { code: 'NAR003', name: 'Tumaco', departmentCode: 'NAR', daneCode: '52835' },
    // Cauca
    { code: 'CAU001', name: 'Popayán', departmentCode: 'CAU', daneCode: '19001', isCapital: true },
    // Cesar
    { code: 'CES001', name: 'Valledupar', departmentCode: 'CES', daneCode: '20001', isCapital: true },
    // La Guajira
    { code: 'LAG001', name: 'Riohacha', departmentCode: 'LAG', daneCode: '44001', isCapital: true },
    // Casanare
    { code: 'CAS001', name: 'Yopal', departmentCode: 'CAS', daneCode: '85001', isCapital: true },
    // Sucre
    { code: 'SUC001', name: 'Sincelejo', departmentCode: 'SUC', daneCode: '70001', isCapital: true },
] as const;

// =============================================================================
// Major Logistics Routes
// =============================================================================
export const LOGISTICS_ROUTES: readonly Route[] = [
    // Triángulo de Oro (Bogotá - Medellín - Cali)
    { origin: 'Bogotá', destination: 'Medellín', distanceKm: 415, estimatedHours: 8, tollCount: 12, mainHighway: 'Autopista Medellín' },
    { origin: 'Bogotá', destination: 'Cali', distanceKm: 460, estimatedHours: 9, tollCount: 10, mainHighway: 'Ruta 25' },
    { origin: 'Medellín', destination: 'Cali', distanceKm: 463, estimatedHours: 10, tollCount: 8, mainHighway: 'Ruta 25' },
    // Costa Caribe
    { origin: 'Bogotá', destination: 'Barranquilla', distanceKm: 982, estimatedHours: 16, tollCount: 18, mainHighway: 'Ruta 45' },
    { origin: 'Bogotá', destination: 'Cartagena', distanceKm: 1042, estimatedHours: 17, tollCount: 20, mainHighway: 'Troncal del Caribe' },
    { origin: 'Medellín', destination: 'Barranquilla', distanceKm: 710, estimatedHours: 12, tollCount: 10, mainHighway: 'Ruta 25/45' },
    { origin: 'Medellín', destination: 'Cartagena', distanceKm: 642, estimatedHours: 10, tollCount: 9, mainHighway: 'Ruta 25' },
    // Puertos principales
    { origin: 'Cali', destination: 'Buenaventura', distanceKm: 144, estimatedHours: 3, tollCount: 3, mainHighway: 'Ruta 40' },
    { origin: 'Bogotá', destination: 'Buenaventura', distanceKm: 524, estimatedHours: 10, tollCount: 12, mainHighway: 'Ruta 40' },
    // Eje Cafetero
    { origin: 'Bogotá', destination: 'Pereira', distanceKm: 340, estimatedHours: 6, tollCount: 8, mainHighway: 'Autopista del Café' },
    { origin: 'Bogotá', destination: 'Armenia', distanceKm: 290, estimatedHours: 5, tollCount: 7, mainHighway: 'Autopista del Café' },
    { origin: 'Bogotá', destination: 'Manizales', distanceKm: 295, estimatedHours: 6, tollCount: 7, mainHighway: 'Autopista del Café' },
    // Frontera Venezuela
    { origin: 'Bogotá', destination: 'Cúcuta', distanceKm: 551, estimatedHours: 9, tollCount: 10, mainHighway: 'Ruta 55' },
    { origin: 'Bucaramanga', destination: 'Cúcuta', distanceKm: 197, estimatedHours: 4, tollCount: 4, mainHighway: 'Ruta 55' },
    // Llanos Orientales
    { origin: 'Bogotá', destination: 'Villavicencio', distanceKm: 120, estimatedHours: 3, tollCount: 4, mainHighway: 'Vía al Llano' },
    // Sur de Colombia
    { origin: 'Cali', destination: 'Pasto', distanceKm: 432, estimatedHours: 8, tollCount: 6, mainHighway: 'Panamericana' },
    { origin: 'Pasto', destination: 'Ipiales', distanceKm: 83, estimatedHours: 2, tollCount: 1, mainHighway: 'Panamericana' },
] as const;

// =============================================================================
// Currency & Formatting
// =============================================================================
export const CURRENCY = {
    code: 'COP',
    symbol: '$',
    locale: 'es-CO',
    decimalSeparator: ',',
    thousandsSeparator: '.',
} as const;

export function formatCOP(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

// =============================================================================
// Phone & Document Formats
// =============================================================================
export const PHONE_FORMAT = {
    countryCode: '+57',
    mobilePrefix: ['300', '301', '302', '303', '304', '305', '310', '311', '312', '313', '314', '315', '316', '317', '318', '319', '320', '321', '322', '323', '324', '325', '350', '351'],
    landlinePrefix: ['1', '2', '4', '5', '6', '7', '8'],
    format: '(###) ###-####',
} as const;

export const DOCUMENT_TYPES = [
    { code: 'CC', name: 'Cédula de Ciudadanía', format: '##########' },
    { code: 'CE', name: 'Cédula de Extranjería', format: '########' },
    { code: 'NIT', name: 'NIT', format: '###.###.###-#' },
    { code: 'PP', name: 'Pasaporte', format: '########' },
    { code: 'TI', name: 'Tarjeta de Identidad', format: '##########' },
] as const;

export function formatNIT(nit: string): string {
    const clean = nit.replace(/\D/g, '');
    if (clean.length < 9) return clean;

    const verifier = clean.slice(-1);
    const number = clean.slice(0, -1);

    return number.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + verifier;
}

// =============================================================================
// Vehicle Types for Logistics
// =============================================================================
export const VEHICLE_TYPES = [
    { code: 'TURBO', name: 'Turbo', capacityTons: 4, volumeM3: 15 },
    { code: 'SENCILLO', name: 'Camión Sencillo', capacityTons: 8, volumeM3: 35 },
    { code: 'DOBLETROQUE', name: 'Doble Troque', capacityTons: 17, volumeM3: 50 },
    { code: 'MINIMULA', name: 'Minimula', capacityTons: 20, volumeM3: 55 },
    { code: 'TRACTOMULA', name: 'Tractomula', capacityTons: 34, volumeM3: 70 },
    { code: 'NIÑERA', name: 'Niñera', capacityTons: 40, volumeM3: 90 },
    { code: 'PATINETA', name: 'Patineta', capacityTons: 35, volumeM3: 100 },
    { code: 'CAMA_BAJA', name: 'Cama Baja', capacityTons: 50, volumeM3: 0 },
    { code: 'FURGON', name: 'Furgón', capacityTons: 10, volumeM3: 40 },
    { code: 'REFRIGERADO', name: 'Refrigerado', capacityTons: 8, volumeM3: 30 },
    { code: 'CISTERNA', name: 'Cisterna', capacityTons: 34, volumeM3: 34000 },
    { code: 'VOLQUETA', name: 'Volqueta', capacityTons: 20, volumeM3: 14 },
] as const;

export type VehicleTypeCode = typeof VEHICLE_TYPES[number]['code'];
export type VehicleType = typeof VEHICLE_TYPES[number];

function normalizeVehicleTypeLookupKey(value: unknown): string {
    return String(value ?? '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

const LEGACY_VEHICLE_TYPE_ALIASES: Record<string, VehicleTypeCode> = {
    CAMION: 'SENCILLO',
    CAMIONSENCILLO: 'SENCILLO',
    CAMIONNORMAL: 'SENCILLO',
    DOBLE: 'DOBLETROQUE',
    DOBLETROQUEADO: 'DOBLETROQUE',
    DOBLETRQ: 'DOBLETROQUE',
    MINI: 'MINIMULA',
    MULA: 'TRACTOMULA',
    TRACTOCAMION: 'TRACTOMULA',
    PLATAFORMA: 'PATINETA',
    PLANCHON: 'PATINETA',
    CAMABAJA: 'CAMA_BAJA',
    CAMABAJAESPECIAL: 'CAMA_BAJA',
    FURGONETA: 'FURGON',
    REFRIGERADA: 'REFRIGERADO',
    NEVERA: 'REFRIGERADO',
    NINERA: VEHICLE_TYPES[5].code,
    NIAERA: VEHICLE_TYPES[5].code,
};

const VEHICLE_TYPE_LOOKUP = VEHICLE_TYPES.reduce<Record<string, VehicleTypeCode>>((acc, vehicle) => {
    acc[normalizeVehicleTypeLookupKey(vehicle.code)] = vehicle.code;
    acc[normalizeVehicleTypeLookupKey(vehicle.name)] = vehicle.code;
    return acc;
}, { ...LEGACY_VEHICLE_TYPE_ALIASES });

export function normalizeVehicleTypeCode(value: unknown): VehicleTypeCode | null {
    const key = normalizeVehicleTypeLookupKey(value);
    if (!key) return null;
    return VEHICLE_TYPE_LOOKUP[key] ?? null;
}

export function getVehicleType(value: unknown): VehicleType | undefined {
    const code = normalizeVehicleTypeCode(value);
    return code ? VEHICLE_TYPES.find((vehicle) => vehicle.code === code) : undefined;
}

export function getVehicleTypeName(value: unknown): string {
    return getVehicleType(value)?.name || String(value ?? '').trim();
}

export function vehicleTypesMatch(left: unknown, right: unknown): boolean {
    const leftCode = normalizeVehicleTypeCode(left);
    const rightCode = normalizeVehicleTypeCode(right);

    if (leftCode && rightCode) {
        return leftCode === rightCode;
    }

    const leftKey = normalizeVehicleTypeLookupKey(left);
    const rightKey = normalizeVehicleTypeLookupKey(right);
    return Boolean(leftKey && rightKey && leftKey === rightKey);
}

// =============================================================================
// Cargo Types
// =============================================================================
export const CARGO_TYPES = [
    { code: 'GENERAL', name: 'Carga General', requiresSpecial: false },
    { code: 'GRANEL', name: 'Granel', requiresSpecial: false },
    { code: 'REFRIGERADA', name: 'Carga Refrigerada', requiresSpecial: true },
    { code: 'PELIGROSA', name: 'Mercancía Peligrosa', requiresSpecial: true },
    { code: 'SOBREDIMENSIONADA', name: 'Carga Sobredimensionada', requiresSpecial: true },
    { code: 'CONTENEDOR', name: 'Contenedor', requiresSpecial: false },
    { code: 'LIQUIDOS', name: 'Líquidos', requiresSpecial: true },
    { code: 'GANADO', name: 'Ganado en Pie', requiresSpecial: true },
    { code: 'MAQUINARIA', name: 'Maquinaria Pesada', requiresSpecial: true },
    { code: 'VEHICULOS', name: 'Vehículos', requiresSpecial: false },
] as const;

// =============================================================================
// Helper Functions
// =============================================================================
export function getDepartmentByCode(code: string): Department | undefined {
    return COLOMBIAN_DEPARTMENTS.find(d => d.code === code);
}

export function getCityByCode(code: string): City | undefined {
    return MAJOR_CITIES.find(c => c.code === code);
}

/**
 * Get city name from either a city code or a plain name
 * If it's a code (like ANT002), returns the city name (Bello)
 * If it's already a name, returns it as-is
 */
export function getCityName(codeOrName: string): string {
    // Check if it's a city code (format: XXX### like ANT002)
    const city = MAJOR_CITIES.find(c => c.code === codeOrName);
    if (city) {
        return city.name;
    }
    // If not found as code, return as-is (it's already a name)
    return codeOrName;
}

/**
 * Get department name from either a department code or a plain name
 * If it's a code (like ANT), returns the department name (Antioquia)
 * If it's already a name, returns it as-is
 */
export function getDepartmentName(codeOrName: string): string {
    // Check if it's a department code (3 letter code like ANT)
    const dept = COLOMBIAN_DEPARTMENTS.find(d => d.code === codeOrName);
    if (dept) {
        return dept.name;
    }
    // If not found as code, return as-is (it's already a name)
    return codeOrName;
}

/**
 * Format a complete location string with city and department names
 */
export function formatLocation(cityCode: string, departmentCode: string): string {
    const cityName = getCityName(cityCode);
    const deptName = getDepartmentName(departmentCode);
    return `${cityName}, ${deptName}`;
}

export function getCitiesByDepartment(departmentCode: string): City[] {
    return MAJOR_CITIES.filter(c => c.departmentCode === departmentCode);
}

export function getRouteInfo(origin: string, destination: string): Route | undefined {
    return LOGISTICS_ROUTES.find(
        r => (r.origin === origin && r.destination === destination) ||
            (r.origin === destination && r.destination === origin)
    );
}

export function calculateEstimatedPrice(
    distanceKm: number,
    vehicleType: VehicleTypeCode,
    cargoType: typeof CARGO_TYPES[number]['code']
): number {
    const baseRatePerKm = 2500; // COP base rate per km
    const normalizedVehicleType = normalizeVehicleTypeCode(vehicleType);
    const vehicle = VEHICLE_TYPES.find(v => v.code === normalizedVehicleType);
    const cargo = CARGO_TYPES.find(c => c.code === cargoType);

    let rate = baseRatePerKm * distanceKm;

    // Vehicle size multiplier
    if (vehicle) {
        rate *= (vehicle.capacityTons / 10);
    }

    // Special cargo surcharge
    if (cargo?.requiresSpecial) {
        rate *= 1.25;
    }

    return Math.round(rate / 1000) * 1000; // Round to nearest 1000
}
