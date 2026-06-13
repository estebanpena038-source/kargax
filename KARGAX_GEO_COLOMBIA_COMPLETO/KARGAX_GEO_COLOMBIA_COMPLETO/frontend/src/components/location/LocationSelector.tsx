'use client';

import * as React from 'react';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { fetchGeoDepartments, fetchGeoLocalZones, fetchGeoMunicipalities } from '@/lib/geo/api';
import type {
  GeoDepartment,
  GeoLocalZone,
  GeoMunicipality,
  GeoZoneType,
  LocationSelectorMode,
  LocationSelectorValue,
} from '@/lib/geo/types';

export interface LocationSelectorProps {
  value: LocationSelectorValue;
  onChange: (value: LocationSelectorValue) => void;
  required?: boolean;
  mode?: LocationSelectorMode;
  labelPrefix?: string;
  disabled?: boolean;
  allowManualZone?: boolean;
  showReference?: boolean;
  showExactAddress?: boolean;
  defaultDepartment?: string;
  defaultMunicipality?: string;
  className?: string;
}

const MODE_COPY: Record<LocationSelectorMode, string> = {
  origen: 'origen',
  destino: 'destino',
  bodega: 'bodega',
  empresa: 'empresa',
  filtro: 'filtro',
};

const ZONE_TYPE_OPTIONS: Array<{ value: GeoZoneType; label: string }> = [
  { value: 'barrio', label: 'Barrio' },
  { value: 'localidad', label: 'Localidad' },
  { value: 'comuna', label: 'Comuna' },
  { value: 'vereda', label: 'Vereda' },
  { value: 'corregimiento', label: 'Corregimiento' },
  { value: 'centro_poblado', label: 'Centro poblado' },
  { value: 'sector', label: 'Sector' },
  { value: 'otro', label: 'Otro' },
];

function optionFromDepartment(department: GeoDepartment) {
  return {
    value: department.id,
    label: department.name,
    description: `DIVIPOLA ${department.divipolaCode}`,
  };
}

function optionFromMunicipality(municipality: GeoMunicipality) {
  return {
    value: municipality.id,
    label: municipality.name,
    description: municipality.isCapital ? 'Capital' : `DIVIPOLA ${municipality.divipolaCode}`,
  };
}

function optionFromZone(zone: GeoLocalZone) {
  return {
    value: zone.id,
    label: zone.name,
    description: zone.zoneType.replace('_', ' '),
  };
}

export function LocationSelector({
  value,
  onChange,
  required = false,
  mode = 'empresa',
  labelPrefix,
  disabled = false,
  allowManualZone = true,
  showReference = true,
  showExactAddress = true,
  defaultDepartment,
  defaultMunicipality,
  className,
}: LocationSelectorProps) {
  const [departments, setDepartments] = React.useState<GeoDepartment[]>([]);
  const [municipalities, setMunicipalities] = React.useState<GeoMunicipality[]>([]);
  const [zones, setZones] = React.useState<GeoLocalZone[]>([]);
  const [loadingDepartments, setLoadingDepartments] = React.useState(false);
  const [loadingMunicipalities, setLoadingMunicipalities] = React.useState(false);
  const [loadingZones, setLoadingZones] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const prefix = labelPrefix || MODE_COPY[mode];
  const departmentOptions = React.useMemo(() => departments.map(optionFromDepartment), [departments]);
  const municipalityOptions = React.useMemo(() => municipalities.map(optionFromMunicipality), [municipalities]);
  const zoneOptions = React.useMemo(() => {
    const officialOptions = zones.map(optionFromZone);
    if (!allowManualZone) return officialOptions;
    return [
      ...officialOptions,
      { value: '__manual__', label: 'No aparece / escribir manualmente', description: 'Queda pendiente de revisión' },
    ];
  }, [allowManualZone, zones]);

  React.useEffect(() => {
    let cancelled = false;
    setLoadingDepartments(true);
    setError(null);

    fetchGeoDepartments()
      .then((items) => {
        if (cancelled) return;
        setDepartments(items);

        if (!value.departmentId && defaultDepartment) {
          const normalizedDefault = defaultDepartment.trim().toLowerCase();
          const match = items.find((item) => (
            item.id === defaultDepartment
            || item.divipolaCode === defaultDepartment
            || item.name.toLowerCase() === normalizedDefault
          ));

          if (match) {
            onChange({
              ...value,
              countryCode: 'CO',
              departmentId: match.id,
              departmentCode: match.divipolaCode,
              departmentName: match.name,
            });
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar departamentos');
      })
      .finally(() => {
        if (!cancelled) setLoadingDepartments(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    if (!value.departmentId) {
      setMunicipalities([]);
      return () => { cancelled = true; };
    }

    setLoadingMunicipalities(true);
    setError(null);

    fetchGeoMunicipalities({ departmentId: value.departmentId })
      .then((items) => {
        if (cancelled) return;
        setMunicipalities(items);

        if (!value.municipalityId && defaultMunicipality) {
          const normalizedDefault = defaultMunicipality.trim().toLowerCase();
          const match = items.find((item) => (
            item.id === defaultMunicipality
            || item.divipolaCode === defaultMunicipality
            || item.name.toLowerCase() === normalizedDefault
          ));

          if (match) {
            onChange({
              ...value,
              municipalityId: match.id,
              municipalityCode: match.divipolaCode,
              municipalityName: match.name,
            });
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar municipios');
      })
      .finally(() => {
        if (!cancelled) setLoadingMunicipalities(false);
      });

    return () => { cancelled = true; };
  }, [defaultMunicipality, onChange, value]);

  React.useEffect(() => {
    let cancelled = false;

    if (!value.municipalityId) {
      setZones([]);
      return () => { cancelled = true; };
    }

    setLoadingZones(true);
    setError(null);

    fetchGeoLocalZones({ municipalityId: value.municipalityId })
      .then((items) => {
        if (!cancelled) setZones(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar zonas internas');
      })
      .finally(() => {
        if (!cancelled) setLoadingZones(false);
      });

    return () => { cancelled = true; };
  }, [value.municipalityId]);

  const emit = (patch: Partial<LocationSelectorValue>) => {
    onChange({ ...value, countryCode: 'CO', ...patch });
  };

  const handleDepartmentChange = (departmentId: string) => {
    const department = departments.find((item) => item.id === departmentId);
    emit({
      departmentId,
      departmentCode: department?.divipolaCode || null,
      departmentName: department?.name || '',
      municipalityId: null,
      municipalityCode: null,
      municipalityName: '',
      localZoneId: null,
      localZoneName: '',
      localZoneType: '',
      isManualZone: false,
    });
  };

  const handleMunicipalityChange = (municipalityId: string) => {
    const municipality = municipalities.find((item) => item.id === municipalityId);
    emit({
      municipalityId,
      municipalityCode: municipality?.divipolaCode || null,
      municipalityName: municipality?.name || '',
      localZoneId: null,
      localZoneName: '',
      localZoneType: '',
      isManualZone: false,
    });
  };

  const handleZoneChange = (zoneId: string) => {
    if (zoneId === '__manual__') {
      emit({
        localZoneId: null,
        localZoneName: '',
        localZoneType: 'otro',
        isManualZone: true,
      });
      return;
    }

    const zone = zones.find((item) => item.id === zoneId);
    emit({
      localZoneId: zoneId,
      localZoneName: zone?.name || '',
      localZoneType: zone?.zoneType || 'otro',
      isManualZone: false,
    });
  };

  const shouldShowManualZone = allowManualZone && (
    value.isManualZone || (value.municipalityId && !loadingZones && zones.length === 0)
  );

  return (
    <div className={className || 'space-y-4'} data-location-mode={mode}>
      <Select
        label={required ? 'Departamento *' : 'Departamento'}
        value={value.departmentId || ''}
        onChange={handleDepartmentChange}
        options={departmentOptions}
        searchable
        disabled={disabled || loadingDepartments}
        placeholder={loadingDepartments ? 'Cargando departamentos...' : 'Selecciona un departamento'}
        helperText="Primero selecciona un departamento."
      />

      <Select
        label={required ? 'Ciudad o municipio *' : 'Ciudad o municipio'}
        value={value.municipalityId || ''}
        onChange={handleMunicipalityChange}
        options={municipalityOptions}
        searchable
        disabled={disabled || !value.departmentId || loadingMunicipalities}
        placeholder={!value.departmentId ? 'Primero selecciona un departamento' : 'Selecciona ciudad o municipio'}
        helperText="Mostramos solo ciudades y municipios de este departamento."
      />

      {allowManualZone ? (
        <>
          {zones.length > 0 || value.isManualZone ? (
            <Select
              label="Barrio, localidad, vereda o sector"
              value={value.isManualZone ? '__manual__' : value.localZoneId || ''}
              onChange={handleZoneChange}
              options={zoneOptions}
              searchable
              disabled={disabled || !value.municipalityId || loadingZones}
              placeholder={loadingZones ? 'Cargando zonas...' : 'Selecciona o escribe una zona'}
              helperText="Si tu barrio o vereda no aparece, puedes escribirlo manualmente."
            />
          ) : null}

          {shouldShowManualZone ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <Input
                label="Barrio, localidad, vereda o sector"
                value={value.localZoneName || ''}
                onChange={(event) => emit({
                  localZoneName: event.target.value,
                  localZoneId: null,
                  isManualZone: true,
                })}
                placeholder="Ej: Zona Industrial, Vereda El Progreso"
                disabled={disabled || !value.municipalityId}
                helperText="Este valor queda como dato manual pendiente de revisión interna."
              />
              <Select
                label="Tipo"
                value={value.localZoneType || 'otro'}
                onChange={(zoneType) => emit({ localZoneType: zoneType as GeoZoneType })}
                options={ZONE_TYPE_OPTIONS}
                disabled={disabled || !value.municipalityId}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {showExactAddress ? (
        <Input
          label={required ? 'Dirección exacta *' : 'Dirección exacta'}
          value={value.exactAddress || ''}
          onChange={(event) => emit({ exactAddress: event.target.value })}
          placeholder={prefix === 'bodega' ? 'Dirección operativa de la bodega' : 'Cra 7 #45-12'}
          leftIcon={<MapPin className="h-5 w-5" />}
          disabled={disabled}
          helperText="La dirección exacta ayuda a evitar entregas fallidas."
        />
      ) : null}

      {showReference ? (
        <Input
          label="Referencia para el conductor"
          value={value.reference || ''}
          onChange={(event) => emit({ reference: event.target.value })}
          placeholder="Frente al parque, bodega azul, portería 2"
          disabled={disabled}
        />
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default LocationSelector;
