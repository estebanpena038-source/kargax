# 00 — Decisión CTO: Inspecciones vs Evidencia Digital

## Respuesta directa

Hermano: **sí se parecen, pero no son lo mismo como dominio**.

- **Evidencia Digital** es el concepto grande: el soporte operativo que prueba cargue, ruta, entrega, novedades, fotos, GPS, PIN/POD y cierre.
- **Inspecciones** es un nombre viejo/malo para un reporte operativo. En el repo actual está funcionando más como **POD de marketplace**, no como evidencia privada.
- **Evidencia Digital de Flota Privada** es otro carril: rutas internas, conductor privado, firmas, comprobantes y liquidación interna.

## Decisión final

Renombrar y reencuadrar `Inspecciones` como:

- Nombre de producto: **Evidencia Digital Marketplace**
- Nombre corto UI: **Evidencia Digital MK**
- Nombre técnico: **POD-MK**
- Ruta: `/pod-marketplace`
- Librería: `frontend/src/lib/pod-marketplace/`

## Qué NO se debe hacer

No copiar lógica de flota privada dentro del marketplace.

No mezclar:

- `trip_signature_evidences`
- `/api/business/fleet/signatures`
- `private_fleet_trucker_id` como regla principal de acceso marketplace
- `private_fleet_assignment_status`
- payroll/comprobantes privados
- wallet/liquidación privada
- eventos de flota privada

## Qué SÍ se debe hacer

Copiar/forkear el módulo actual de `inspecciones`, porque ya usa la fuente correcta del marketplace:

- `cargo_offers`
- `offer_applications`
- `picking_events`
- `trip_photos`
- `manifest_items`
- PIN de recogida/entrega
- transportador aceptado/asignado

## Por qué esta decisión es correcta

1. Reduce riesgo de RLS/multiempresa.
2. Evita contaminar wallet y flota privada.
3. Deja un naming claro para ventas: “Evidencia Digital Marketplace”.
4. Mantiene compatibilidad con rutas viejas mediante redirect.
5. Permite evolucionar luego a PDF, share link, auditoría y facturación por evidencia sin tocar flota privada.

## Nombre recomendado en UI

Usar:

```txt
Evidencia Digital MK
```

En páginas internas:

```txt
Evidencia digital Marketplace
POD de cargue, ruta y entrega para rutas públicas.
```

## Criterio de terminado

Se considera terminado cuando una empresa puede abrir `/pod-marketplace`, ver únicamente rutas públicas del marketplace, entrar a un expediente, ver manifiesto, fotos y cadena de custodia, y una ruta privada no aparece ni se puede abrir desde ese módulo.
