# KargaX Produccion: Staff Interno, Payouts y Soporte

## Decision de arquitectura

`admin` queda reservado para CEO/fundador autorizado por `KARGAX_CEO_EMAILS` o `KARGAX_CEO_USER_IDS`.
Soporte, pagos a drivers y operacion interna usan `user_type=staff` y permisos en `staff_memberships`.

La tabla `internal_admin_memberships` queda como compatibilidad historica. No se debe usar para nuevos accesos.

## Roles

| Rol | Puede | No puede |
| --- | --- | --- |
| `platform_owner` | CEO, configuracion critica, soporte y payouts | Nada restringido por el sistema |
| `ops_manager` | Operacion interna, soporte, payouts y reconciliacion | Secretos, provider configs y settings criticos |
| `support_lead` | Soporte, notas internas, asignar, cerrar y escalar | Pagar drivers, pricing, claves, CEO |
| `support_agent` | Leer tickets, responder y crear notas internas | Payouts, cerrar/escalar/asignar tickets, settings |
| `payout_reviewer` | Leer y mandar payouts a revision/reintento | Aprobar, rechazar o marcar pagado |
| `payout_approver` | Aprobar, rechazar y marcar pagado con AAL2 | Soporte, pricing, claves, CEO |

## Bootstrap desde ENV

Configurar en el ambiente correcto de Supabase antes de ejecutar:

```env
KARGAX_STAFF_JSON=[
  {
    "email": "soporte@kargax.com",
    "password": "cambiar",
    "roles": ["support_agent"],
    "fullName": "Soporte KargaX"
  },
  {
    "email": "payouts@kargax.com",
    "password": "cambiar",
    "roles": ["payout_reviewer", "payout_approver"],
    "fullName": "Pagos KargaX"
  }
]
```

Ejecutar:

```bash
npm run staff:bootstrap
```

Reglas:

- No se registra la contrasena en logs.
- Si el usuario ya existe, se actualiza el perfil y roles sin duplicar.
- Solo `platform_owner` puede quedar como `user_type=admin`.
- Cualquier staff operativo queda como `user_type=staff`.
- Para rotar password de usuarios existentes usar `KARGAX_STAFF_RESET_PASSWORDS=true` solo durante la operacion.

## Soporte

Ruta interna: `/staff/support`.

APIs internas:

- `GET /api/staff/support/tickets`
- `POST /api/staff/support/tickets`
- `GET /api/staff/support/tickets/:id`
- `PATCH /api/staff/support/tickets/:id`
- `POST /api/staff/support/tickets/:id/messages`

Reglas:

- `support_agent` puede responder y crear notas internas.
- `support_lead`, `ops_manager` y `platform_owner` pueden asignar, cerrar y escalar.
- Escalar exige AAL2.
- Las notas internas nunca se exponen en el portal externo.

## Payouts a drivers

Ruta interna: `/staff/payouts`.

APIs internas:

- `GET /api/staff/driver-payouts`
- `GET /api/staff/driver-payouts/:id`
- `POST /api/staff/driver-payouts/:id/action`

Reglas:

- `payout_reviewer` puede revisar, reintentar y mandar a revision.
- `payout_approver`, `ops_manager` y `platform_owner` pueden aprobar, rechazar y marcar pagado.
- Aprobar, rechazar y marcar pagado exigen AAL2.
- Marcar pagado exige referencia.
- Un payout pagado no se puede pagar dos veces.
- `PAYOUTS_ENABLED=false` sigue siendo el default seguro para pagos automaticos.

## Staging vs produccion

Staging:

```env
APP_ENV=staging
PAYMENTS_MODE=sandbox
SUPPORT_ENABLED=true
PAYOUTS_ENABLED=false
PAYOUT_DRY_RUN=true
PAYOUT_PROVIDER=manual
```

Produccion:

```env
APP_ENV=production
PAYMENTS_MODE=live
NEXT_PUBLIC_APP_URL=https://kargax.com
SUPPORT_ENABLED=true
PAYOUTS_ENABLED=false
PAYOUT_DRY_RUN=true
PAYOUT_PROVIDER=manual
```

Activar payouts reales requiere auditoria separada de provider, limites, conciliacion y prueba end-to-end.

## Checklist no-go

- Un `support_agent` puede abrir `/staff/payouts`.
- Un `payout_reviewer` puede marcar pagado.
- Un staff no CEO puede abrir `/admin/ceo`.
- `admin` se usa para soporte o payouts operativos.
- `PAYOUTS_ENABLED=true` sin auditoria de proveedor.
- Notas internas aparecen en el portal externo.
- `check:release` apunta a staging cuando se valida produccion.

## Pruebas

```bash
npm run repo:audit
npm run check:roles
npm run security:audit
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm run supabase:inspect -- --json
npm run supabase:auth-url-check
```
