# 06 · Plan QA exhaustivo

## QA de datos

```bash
cd frontend
npm run verify:geo
npm run validate:geo
npm run diff:geo
```

Criterios:

- 33 departamentos activos.
- Municipios/áreas activos >= 1100 o conteo exacto congelado con `GEO_EXPECTED_MUNICIPALITIES`.
- 0 departamentos duplicados por DIVIPOLA.
- 0 municipios duplicados por DIVIPOLA.
- 0 municipios huérfanos.
- Cada municipio pertenece al departamento correcto.

## QA UI

### Onboarding empresa

- Seleccionar departamento.
- Confirmar que el municipio aparece solo después del departamento.
- Confirmar que no se listan municipios de otro departamento.
- Escribir barrio/vereda manual.
- Guardar y verificar `business_profiles` con legacy text + IDs.

### Bodegas

- Crear bodega con GPS.
- Confirmar que `CoordinatePicker` recibe nombre oficial de municipio.
- Editar bodega legacy sin perder dirección.
- Confirmar fallback si no hay zona interna.

### Ofertas/viajes

- Crear oferta con origen y destino distintos.
- Confirmar que origen no contamina destino.
- Confirmar validaciones de dirección exacta.
- Confirmar que private fleet sigue funcionando sin tocar wallet.

## QA seguridad

- Usuario anon puede leer catálogos activos.
- Usuario authenticated puede leer catálogos activos.
- Usuario authenticated no puede modificar departamento/municipio.
- Usuario authenticated solo puede insertar zona manual con `needs_review=true` y `created_by=auth.uid()`.
- Service role puede ejecutar seeds.

## QA regresión

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
npm run smoke:release
npm run test:algorithms
```

Si existe Playwright/E2E:

```bash
npx playwright test
```

## Casos borde Colombia

- Bogotá D.C. como departamento/distrito.
- Municipios con tildes: Medellín, Quibdó, Inírida, Mitú, Túquerres.
- Municipios con nombres largos: San Andrés de Tumaco, San José del Guaviare.
- Archipiélago de San Andrés, Providencia y Santa Catalina.
- Áreas no municipalizadas si la fuente las trae.
