# CERRADO - SPRINT 16

## Estado de cierre

- artifact status: `completed`
- cerrado el: `2026-05-19`
- criterio: flota privada queda alineada al piloto, con viaticos empresa/gastos del viaje y lending pausado como producto KargaX.
# SPRINT 16: PRIVATE FLEET & B2B OPERATIONS LOGISTICS (FLOTA PRIVADA) 🦄

## 1. VISIÓN EJECUTIVA Y PROPUESTA DE VALOR (EL CÍRCULO B2B)
El objetivo de este módulo es transformar a KargaX de un simple "Marketplace de Fletes" a un **Sistema Operativo Logístico (Logistics OS) End-to-End**. Las empresas Generadoras de Carga y los 3PL ya cuentan con su propia flota (empleados directos o terceros de confianza). 

Si permitimos que gestionen esta "Flota Privada" dentro de KargaX:
1. **Retención Total (Lock-in):** La empresa no usará KargaX solo cuando "le falten" camiones; usará KargaX para operar el 100% de sus viajes, usando nuestra app, nuestra infraestructura de inspecciones y nuestra billetera.
2. **Monetización Financiera:** Al enrutar el pago de la nómina/flete privado y los viáticos a través de la Billetera KargaX, retenemos capital en nuestro ecosistema (Float) y podemos cobrar *fees* por dispersión de fondos.
3. **Flujo Homologado:** El viaje privado y el viaje público (freelancer) se comportan exactamente igual a nivel operativo (GPS, Evidencias, Picking, PIN de entrega). Todo es estandarizado y auditable.

---

## 2. ARQUITECTURA DE DATOS DETALLADA (SQL MIGRATIONS)
Se creará la migración `035_private_fleet_b2b.sql` con las siguientes especificaciones técnicas estrictas:

### 2.1 Gestión de Invitaciones y Miembros de Flota
```sql
-- Tabla para invitar conductores al entorno privado de la empresa
CREATE TABLE public.business_fleet_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id),
    invite_code VARCHAR(20) UNIQUE NOT NULL, -- Ej: KGX-FLT-8F92A
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, revoked
    used_by_trucker_id UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Tabla para el vínculo formal Empresa <-> Conductor Privado
CREATE TABLE public.business_fleet_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id),
    trucker_id UUID NOT NULL REFERENCES public.user_profiles(id),
    status VARCHAR(20) DEFAULT 'active', -- active, suspended, removed
    internal_driver_id VARCHAR(50), -- Código interno de nómina de la empresa
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, trucker_id)
);
```

### 2.2 Modificación al Core de Ofertas (`cargo_offers`)
Para habilitar la asignación directa sin pasar por el "Bidding" público:
```sql
ALTER TABLE public.cargo_offers
    ADD COLUMN is_private_fleet BOOLEAN DEFAULT FALSE,
    ADD COLUMN private_fleet_trucker_id UUID REFERENCES public.user_profiles(id),
    ADD COLUMN expense_allowance_amount DECIMAL(15,2) DEFAULT 0.00, -- Viáticos asignados
    ADD COLUMN freight_payment_amount DECIMAL(15,2) DEFAULT 0.00; -- Pago por el servicio
```

### 2.3 Estructura Financiera (Viáticos y Pagos via KargaX)
Las empresas pagarán a su flota a través de KargaX. Se usará la billetera actual (`wallets`) pero con clasificaciones claras en `transactions`:
- **Viáticos (Adelantos):** Dinero que la empresa gira *antes* del viaje para gasolina y peajes. Va al `available_balance` inmediatamente al aceptar el viaje.
- **Flete/Nómina (Custodia):** Pago por realizar el viaje. Va al `pending_balance` y solo se libera al `available_balance` tras la Prueba de Entrega (POD) validada.

```sql
CREATE TABLE public.trip_financial_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID REFERENCES public.cargo_offers(id),
    business_id UUID REFERENCES public.user_profiles(id),
    trucker_id UUID REFERENCES public.user_profiles(id),
    allocation_type VARCHAR(20) NOT NULL, -- 'expense_advance' (viático), 'freight_payment' (flete)
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'held_in_custody', -- held_in_custody, released_to_wallet, refunded
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. FLUJO OPERATIVO Y ESTADOS (STATE MACHINE)

El flujo para un conductor de "Flota Privada" es una versión acelerada pero **igualmente rigurosa** que la del freelancer. 

### A. Creación y Pago (Business Side)
1. La Empresa va a `/ofertas/publicar`.
2. Selecciona **"Asignación Directa (Mi Flota)"**.
3. Selecciona a "Juan Pérez" de su lista de `business_fleet_members`.
4. Ingresa el **Flete** ($500) y los **Viáticos** ($150).
5. **Checkout:** La empresa usa su saldo corporativo, tarjeta de crédito o transferencia PSE/MercadoPago para fondear $650 a KargaX. 
6. El estado de la oferta pasa directamente a `assigned` (saltando `draft` y `active/bidding`).

### B. Aceptación e Inicio (Trucker Side)
1. Juan recibe push: "Nueva ruta directa asignada por [Empresa]".
2. Al abrir, ve los detalles y hace clic en **"Confirmar Viaje"**.
3. **Liberación Inmediata:** Los $150 de viáticos pasan automáticamente a su `available_balance` en la Billetera KargaX para que eche gasolina. Los $500 quedan en `pending_balance`.

### C. Picking y Verificación en Bodega (Salida)
Debe usar el mismo rigor del módulo de `enhanced_picking`:
1. El conductor llega a la bodega (Validación GPS - Geofence).
2. Escanea el QR del muelle o se reporta con el operario.
3. **Checklist de Salida Obligatorio (App Conductor):**
   - Foto de placas del vehículo.
   - Foto del estado físico de las llantas.
   - Foto de la carga acomodada en el furgón.
   - Firma digital del Jefe de Bodega en el celular del conductor (o validación vía PIN en la app del jefe de bodega).
4. El estado del viaje pasa a `in_progress`.

### D. Tránsito y Novedades
- Botones de pánico, reporte de incidentes (llanta pinchada, retén militar) suben eventos con ubicación a la línea de tiempo del viaje.

### E. Entrega y POD (Llegada)
1. Llega al cliente final (Validación GPS).
2. **Checklist de Llegada Obligatorio:**
   - Foto de las puertas selladas antes de abrir.
   - Foto de la carga siendo descargada.
   - Captura del remito (papel) firmado, si aplica.
   - **Firma Digital:** El cliente dibuja su firma en la pantalla del celular del conductor e ingresa su Cédula/ID.
3. El estado del viaje pasa a `completed`.
4. **Liberación Financiera:** El sistema procesa la evidencia. Si todo está correcto (Smart Contract / Auto-reconcile), los $500 pasan al `available_balance` de la billetera del conductor.

---

## 4. MONETIZACIÓN B2B Y LÍMITES DE PLANES
Para forzar a las grandes operaciones a pagar SaaS recurrente, limitaremos la "Flota Privada" en `billing_plans`.

- **PLAN FREE ($0/mes):** Máximo **3 conductores** en flota privada.
- **PLAN GROWTH ($20/mes):** Máximo **15 conductores**.
- **PLAN SCALE ($100/mes):** **Ilimitados conductores** y acceso a integraciones API para nominas.

*Lógica:* Cuando la empresa intente generar el código de invitación #4 en el plan Free, saltará un modal (Paywall) indicando: *"Has alcanzado el límite de tu flota gratuita. Actualiza a Growth para añadir más conductores y digitalizar toda tu operación"*.

---

## 5. REQUISITOS DE UI/UX (QUÉ DEBES PROGRAMAR EXACTAMENTE)

### Para la Empresa (Business Frontend)
- **`/dashboard/flota`:** 
  - Tabla con `Nombre, Teléfono, Placa, Viajes Activos, Estado`.
  - Tarjetas de estadísticas: "Viáticos dispersados este mes", "Viajes privados completados".
  - Botón prominente "Añadir Conductor" (Genera código temporal de 48 hrs y arroja link de WhatsApp: `"Únete a la flota de LogisticsCorp en KargaX usando este link: kargax.com/join?code=XYZ"`).
- **`/ofertas/publicar`:**
  - Rediseño de la sección de precio. Toggle switch: `[Pública] | [Privada]`.
  - Si Privada -> Dropdown de Conductores.
  - Campos separados: `[Flete (Pago por viaje)]` y `[Adelanto Viáticos]`.

### Para el Conductor (Trucker Frontend)
- **Onboarding (`/registro/camionero`):** 
  - Input: "¿Tienes un código de invitación corporativo?". Si lo ingresa, el proceso salta validaciones manuales pesadas y lo inyecta directo a la empresa.
- **Dashboard y Billetera (`/billetera`):**
  - Gráficos divididos: "Ganancias por Fletes" vs "Viáticos Recibidos".
  - Botones claros para Retirar Fondos.
- **Flujo de Viaje (`/ofertas-aceptadas/[id]`):**
  - Stepper vertical estricto: `1. Confirmar` -> `2. Recibir Viáticos` -> `3. GPS Bodega` -> `4. Checklist Salida` -> `5. Tránsito` -> `6. Entrega y Firma`.
  - Componente de cámara robusto (no permite subir fotos de galería, SOLO fotos en vivo para el checklist).

---

## 6. CONSIDERACIONES TÉCNICAS (API & SEGURIDAD)
1. **Transacciones Atómicas:** El pago en la publicación debe asegurar fondos en la pasarela antes de enviar la oferta al conductor. Usar transacciones SQL.
2. **RLS (Row Level Security):** La empresa A no puede ver los miembros de la empresa B. Los conductores solo ven sus propias finanzas.
3. **Firmas Digitales (Base64):** Guardar las firmas de los clientes en `supabase storage` como imágenes y referenciarlas en el log del viaje, nunca saturar la DB con strings base64 gigantes.
4. **Notificaciones Push:** Integración obligatoria para cuando los viáticos son liberados (ej. "¡Cha-ching! Has recibido $150 para viáticos del viaje #4521").

*Con esta implementación, KargaX absorbe por completo la operativa diaria de las transportadoras y 3PLs.*
# Sprint 16 - Revision ejecutiva 2026-05-19

Este sprint queda alineado con la estrategia final de pilotos:

- Flota privada sigue siendo core porque vuelve KargaX el sistema operativo diario de una empresa, no solo un marketplace.
- Los "viaticos" no son adelantos ni credito KargaX. En producto deben llamarse `gastos del viaje` o `viaticos empresa`, porque los fondea la empresa.
- Lending, pago expres y adelantos de KargaX quedan pausados por feature flag hasta tener capital, cobranza, partner financiero y compliance.
- La compensacion de flota privada debe soportar cuatro modos: `salary_no_trip_pay`, `trip_pay`, `expenses_only`, `trip_pay_plus_expenses`.
- Campo legacy `expense_allowance_amount` puede seguir en DB por compatibilidad, pero la UI/copy/API publica deben hablar de gastos del viaje, no de credito.
- El flujo privado debe conectar con WMS y manifiesto: despacho desde bodega, conductor privado, PIN de cargue, rechazos en origen, POD y reporte contable.

## Definition of Done actualizado

- Empresa puede invitar y administrar conductores privados con RLS por empresa.
- Empresa puede crear viaje privado sin publicarlo al marketplace.
- UI muestra claramente si el conductor recibe pago por viaje, gastos del viaje, ambos o ninguno.
- Los gastos empresa se liberan segun regla definida por la empresa y quedan auditados en ledger.
- Los pagos por viaje quedan pendientes hasta POD validado, salvo configuracion explicita de la empresa.
- Reporte contable separa `trip_payment`, `company_expense`, `refund`, `wallet_release` y `manual_adjustment`.
- Nada del flujo promete adelantos, credito o pago expres financiado por KargaX.
