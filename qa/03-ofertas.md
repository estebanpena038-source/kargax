# 🚛 03 — Marketplace de Ofertas

> **URLs**: `/ofertas`, `/ofertas/publicar`, `/ofertas/mis-ofertas`, `/postulaciones`, `/postulaciones-recibidas`

---


SI PASARON TODASSS LO PROBE

## OFFER-01: Publicar una oferta de carga

### Objetivo
Verificar que una empresa puede publicar una oferta de transporte.

### Preparación
- Login como empresa con plan que permita crear ofertas (no exceder límite mensual)

### Pasos

1. **Ir a** `/ofertas/publicar`

2. **Verifica que ves un formulario** con los campos:
   - Ciudad de origen
   - Ciudad de destino
   - Peso de la carga (kg)
   - Tipo de carga (general, refrigerada, etc.)
   - Precio ofrecido (COP)
   - Descripción
   - Fecha de recogida
   - Contacto de recogida (nombre, teléfono)
   - Contacto de entrega (nombre, teléfono)

3. **Llena los campos**:
   - **Origen**: `Bogotá`
   - **Destino**: `Medellín`
   - **Peso**: `5000` (5 toneladas)
   - **Tipo de carga**: `General`
   - **Precio**: `1500000` (1.5 millones COP)
   - **Descripción**: `Carga de prueba QA — 10 pallets de productos secos`
   - **Fecha de recogida**: Mañana
   - **Contacto recogida**: `Juan QA`, `+573001111111`
   - **Contacto entrega**: `María QA`, `+573002222222`

4. **Agregar ítems al manifiesto** (si el formulario lo permite):
   - Ítem 1: `Caja de galletas` — Cantidad: `100`
   - Ítem 2: `Pallet de arroz` — Cantidad: `50`
   - Ítem 3: `Bidón de aceite` — Cantidad: `25`

5. **Click en "Publicar"** o "Crear oferta"

6. **Verifica**:
   - ✅ Toast: "Oferta publicada exitosamente"
   - ✅ Redirige a `/ofertas/mis-ofertas` o a la oferta creada
   - ✅ La oferta aparece en la lista con status "Activa"

### Resultado
| | |
|---|---|
| **⬜ PASS** | Oferta publicada y visible |
| **⬜ FAIL** | Error al publicar |
| **Notas** | 
PASO SIN PROBLEMAS
|

---

## OFFER-02: Ver marketplace como camionero

### Objetivo
Verificar que los camioneros pueden ver las ofertas disponibles.

### Pasos

1. **Login como camionero**

2. **Ir a** `/ofertas`

3. **Verifica que ves**:
   - ✅ Cards/lista de ofertas disponibles
   - ✅ Cada oferta muestra: Ruta (ej: Bogotá → Medellín), Precio, Peso, Tipo de carga
   - ✅ La oferta que creaste en OFFER-01 aparece aquí

4. **Haz click en una oferta** para ver el detalle (`/ofertas/[id]`)

5. **Verifica el detalle**:
   - ✅ Ruta completa con origen y destino
   - ✅ Precio en COP formateado (ej: $1.500.000)
   - ✅ Peso de la carga
   - ✅ Manifiesto de ítems (si fue agregado)
   - ✅ Botón "Postularme"

### Resultado
| | |
|---|---|
| **⬜ PASS** | Marketplace funciona, ofertas visibles |
| **⬜ FAIL** | No carga o no muestra ofertas |
| **Notas** | 
PASO SIN PROBLEMAS
|

---

## OFFER-03: Postularse a una oferta

### Objetivo
Verificar que un camionero puede postularse.

### Pasos

1. **Como camionero**, abre el detalle de una oferta (`/ofertas/[id]`)

2. **Click en "Postularme"**

3. **Si pide confirmación**, click en "Confirmar"

4. **Verifica**:
   - ✅ Toast: "Postulación enviada"
   - ✅ El botón cambia a "Ya te postulaste" (deshabilitado)

5. **Ir a** `/postulaciones`

6. **Verifica**: La oferta aparece en tu lista de postulaciones con status "Pendiente"

### Resultado
| | |
|---|---|
| **⬜ PASS** | Postulación creada |
| **⬜ FAIL** | Error al postularse |
| **Notas** | 

PASO SIN PROBLEMAS|

---

## OFFER-04: Aceptar una postulación (empresa)

### Objetivo
Verificar que la empresa puede seleccionar un camionero.

### Pasos

1. **Login como empresa**

2. **Ir a** `/postulaciones-recibidas`

3. **Busca la oferta** que publicaste → debería mostrar la postulación del camionero

4. **Verifica que ves**:
   - Nombre del camionero
   - Tipo de vehículo (si completó perfil)

5. **Click en "Aceptar"** al lado del camionero

6. **Verifica**:
   - ✅ Status cambia a "Aceptada"
   - ✅ La oferta ya no acepta más postulaciones

7. **Ir a** `/ofertas-aceptadas`

8. **Verifica**: La oferta aparece aquí con el nombre del camionero asignado

### Resultado
| | |
|---|---|
| **⬜ PASS** | Camionero aceptado, oferta asignada |
| **⬜ FAIL** | No se pudo aceptar |
| **Notas** | 
PASO SIN PROBLEMAS
|

---

## OFFER-05: Editar oferta

### Objetivo
Verificar que puedes editar una oferta antes de asignar camionero.

### Pasos

1. **Crea una nueva oferta** (OFFER-01)
2. **Ir a** `/ofertas/mis-ofertas`
3. **Click "Editar"** en la oferta
4. **Cambia el precio** de `1500000` a `2000000`
5. **Click "Guardar"**
6. **Verifica**: El precio actualizado aparece en el detalle

### Resultado
| | |
|---|---|
| **⬜ PASS** | Edición guardada |
| **⬜ FAIL** | No se pudo editar |
| **Notas** | |

---

## OFFER-06: Responsividad móvil del marketplace

### Pasos

1. **Abre DevTools (F12)** → click en el icono de celular (📱) arriba a la izquierda
2. **Selecciona "iPhone 14 Pro"** o pon el ancho en `375px`
3. **Navega a** `/ofertas`
4. **Verifica**:
   - ✅ Cards se apilan verticalmente (1 por fila)
   - ✅ Texto legible, no cortado
   - ✅ Botones accesibles con dedo (no demasiado pequeños)
   - ✅ Scroll suave, sin overflow horizontal

### Resultado
| | |
|---|---|
| **⬜ PASS** | Se ve bien en móvil |
| **⬜ FAIL** | Layout roto o texto cortado |
| **Notas** | |


 }