# Roles, funciones y release gates KargaX

## 1. User types base

| Tipo | QuÃ© representa | Riesgo |
|---|---|---|
| `trucker` | Conductor/transportador. Accede a viajes, postulaciones, billetera, retiros, evidencia. | Alto por pagos, documentos y ubicaciÃ³n. |
| `business` | Empresa/cliente. Crea ofertas, gestiona flota, bodegas, equipo, pagos/reportes. | Alto por datos empresariales y pagos. |
| `admin` | OperaciÃ³n interna KargaX. Soporte, control, revisiÃ³n, incidentes. | CrÃ­tico. |

## 2. Roles empresariales detectados

Roles de equipo empresarial:

- `owner`
- `manager` legacy
- `ops_manager`
- `dispatcher`
- `warehouse_manager`
- `warehouse_operator`
- `finance_accountant`
- `operator` legacy
- `auditor`
- `viewer`

AdemÃ¡s existe `admin` como rol global/sistema.

## 3. Capacidades principales

El modelo de capacidades cubre:

- gestionar equipo,
- billing,
- ver/exportar finanzas,
- operaciones,
- crear ofertas marketplace,
- flota privada,
- tracking,
- warehouse,
- evidencia,
- exportaciÃ³n de datos,
- inteligencia/reportes.

## 4. Matriz recomendada de decisiÃ³n

| Rol | Finanzas | Operaciones | Bodega | Equipo | Exporta | Mutaciones sensibles |
|---|---:|---:|---:|---:|---:|---|
| owner | SÃ­ | SÃ­ | SÃ­ | SÃ­ | SÃ­ | Todas dentro de su empresa. |
| manager legacy | SÃ­ | SÃ­ | SÃ­ | No | SÃ­ | Mantener por compatibilidad, migrar a roles nuevos. |
| ops_manager | No/limitado | SÃ­ | No | No | SÃ­ operativo | Ofertas, flota, tracking, evidencia. |
| dispatcher | No | SÃ­ | No | No | No | Despachos, viajes, seguimiento. |
| warehouse_manager | No | Parcial | SÃ­ | No | SÃ­ bodega | Inventario, muelles, citas, picking/despacho. |
| warehouse_operator | No | No | Ejecuta | No | No | Tareas fÃ­sicas, evidencia de bodega. |
| finance_accountant | SÃ­ | No | No | No | SÃ­ financiero | Reportes/contabilidad, no operaciones. |
| operator legacy | No | SÃ­ | Parcial | No | No | Compatibilidad; migrar. |
| auditor | SÃ­ lectura | SÃ­ lectura | SÃ­ lectura | No | SÃ­ | Lectura/export sin mutar. |
| viewer | No | Lectura bÃ¡sica | No | No | No | Sin mutaciones sensibles. |

## 5. Regla CTO

La UI puede ocultar botones, pero la seguridad real debe estar en:

1. API route guard.
2. `role-policy.ts`.
3. Business scoping.
4. Supabase RLS.
5. Storage policies.
6. Logs/auditorÃ­a.

Nunca confiar solo en frontend.

## 6. Gates existentes

### Root

- `npm run repo:audit`
- `npm run check:roles`
- `npm run security:audit`
- `npm run supabase:inspect`
- `npm run supabase:auth-url-check`
- `npm run check`
- `npm run check:release`

### Frontend

- `npm --prefix frontend run build`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run check`
- `npm --prefix frontend run check:release`
- `npm --prefix frontend run visual:qa`
- `npm --prefix frontend run smoke:release -- --base-url <URL>`

## 7. QuÃ© valida cada gate

| Gate | Valida | Riesgo que baja |
|---|---|---|
| `repo:audit` | estructura raÃ­z, frontend, App Router, migraciones, SPTRINTS, scripts | repo roto / carpetas faltantes |
| `check:roles` | drift de permisos manuales en rutas sensibles seleccionadas | bypass por lÃ³gica duplicada |
| `security:audit` | patrones de secrets en archivos escaneados | secrets en repo |
| `supabase:inspect` | OpenAPI, tablas, columnas, conteos, samples redacted | schema diferente a app |
| `supabase:auth-url-check` | redirects de auth reales | links a localhost/staging |
| `frontend check:release` | env, DB shapes, flags, buckets, typecheck, visual static | release incompleto |
| `visual:qa` | reglas visuales/responsive | UX rota en mÃ³vil |
| `smoke:release` | flujo real contra URL | app caÃ­da / rutas crÃ­ticas rotas |

## 8. AmpliaciÃ³n necesaria de `check-role-policy.mjs`

Actualmente debe ampliarse para cubrir mÃ¡s superficie.

### Agregar roots sensibles

```js
const SENSITIVE_ROOTS = [
  'frontend/src/app/api/admin',
  'frontend/src/app/api/business/fleet',
  'frontend/src/app/api/billing',
  'frontend/src/app/api/reports',
  'frontend/src/app/api/offers',
  'frontend/src/app/api/wallet',
  'frontend/src/app/api/payments',
  'frontend/src/app/api/jobs',
  'frontend/src/app/api/warehouses',
  'frontend/src/app/api/tracking',
  'frontend/src/app/api/support',
];
```

### Patrones adicionales a detectar

- `profile.user_type === 'admin'` fuera de helper permitido.
- `profile.user_type === 'business'` usado como permiso suficiente.
- `.eq('business_id', requestedBusinessId)` sin resolver scope.
- uso de `supabaseAdmin` en route sin guard.
- rutas `POST|PUT|PATCH|DELETE` sin `requireAuthenticatedRoute`, `requireAdminRoute`, `requireAal2Route` o `verifyInternalApiKey`.

## 9. Tests por rol

### Business owner

- Puede crear oferta.
- Puede ver facturaciÃ³n.
- Puede invitar equipo.
- Puede ver reportes.
- No puede acceder a otra empresa.

### Dispatcher

- Puede operar despachos.
- No puede ver billing.
- No puede exportar reportes financieros.

### Finance accountant

- Puede ver reportes financieros.
- No puede crear oferta.
- No puede ejecutar bodega.

### Warehouse operator

- Puede ejecutar tareas de bodega.
- No puede ver finanzas.
- No puede administrar equipo.

### Auditor

- Puede leer/exportar segÃºn polÃ­tica.
- No puede mutar estados.

### Viewer

- Solo lectura bÃ¡sica.
- Sin export sensible.
- Sin mutaciones.

### Admin/CEO

- Admin requiere MFA/AAL2.
- CEO requiere allowlist por email/user id.
- Accesos auditados.

## 10. Feature flags crÃ­ticas

Validar en DB:

- `lending_enabled=false` antes de compliance.
- `automatic_payouts_enabled=false` antes de proveedor/conciliaciÃ³n.
- `express_payment_enabled=false` si no hay compliance/capital.
- `live_trip_tracking_enabled=true` si tracking ya se soporta.
- `advanced_business_roles_enabled=true` si roles nuevos estÃ¡n activos.
- `wms_dispatch_trip_enabled=true` si bodega/despacho estÃ¡ listo.
- `ceo_control_tower_enabled=true` solo con allowlist segura.
- `release_gate_required=true`.

## 11. RLS/Storage

Cada tabla sensible debe responder:

- Â¿QuiÃ©n puede leer?
- Â¿QuiÃ©n puede insertar?
- Â¿QuiÃ©n puede actualizar?
- Â¿QuiÃ©n puede borrar?
- Â¿CÃ³mo se evita cross-business?
- Â¿CÃ³mo se audita?

Storage:

- Evidencia de viajes.
- Firmas.
- Fotos de oferta.
- ImÃ¡genes SKU.
- Comprobantes flota privada.

No asumir bucket pÃºblico salvo necesidad explÃ­cita.

## 12. Criterio final

ProducciÃ³n solo cuando:

- UI y API coinciden en permisos.
- API bloquea aunque UI muestre botÃ³n por error.
- RLS bloquea aunque API tenga bug.
- Tests por rol pasan.
- Logs no filtran PII/secrets.
- `check:roles` ampliado pasa.
