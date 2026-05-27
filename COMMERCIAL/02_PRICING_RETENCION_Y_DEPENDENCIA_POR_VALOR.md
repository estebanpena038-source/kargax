# 02 — Pricing, retención y dependencia por valor

## Tesis

KargaX no debe ser barato por miedo. Debe ser fácil de probar y serio para pagar.

El error sería dejar límites enormes gratis para siempre. Eso atrae uso, pero mata conversión. La estrategia correcta es:

1. **Free limitado** para probar sin fricción.
2. **Acceso Operativo gratis con límites altos por tiempo definido** para leads comerciales serios.
3. **Growth como plan más vendido**.
4. **Scale rentable para operaciones de volumen**.
5. **Enterprise desde**, nunca ilimitado fijo.

## Precios recomendados

### Planes públicos principales

| Plan | Precio mensual | Uso | Límite recomendado |
|---|---:|---|---|
| Free | $0 COP | Probar el flujo básico | 50 viajes/mes |
| Growth | $299.000 COP | Operación diaria pequeña/mediana | 500 viajes/mes |
| Scale | $799.000 COP | Operación con varias bodegas/flota | 2.000 viajes/mes |
| Enterprise | Desde $2.500.000 COP | 3PL, holding, multiempresa, alto volumen | Personalizado |

### Plan interno opcional, no necesariamente público

| Plan | Precio mensual | Uso | Límite recomendado |
|---|---:|---|---|
| Business | $1.500.000 COP | Operación grande antes de enterprise | 5.000 viajes/mes |

Este plan puede existir en BD, pero no tiene que aparecer como tarjeta pública al inicio. Sirve para negociación comercial.

## Límites exactos sugeridos

### Free — $0

- 1 bodega activa.
- 2 usuarios internos.
- 3 conductores privados.
- 50 viajes/mes.
- PIN/POD.
- Receptor, hora, foto/firma y novedad.
- Soporte básico.
- Historial visible limitado.
- Sin API.
- Sin multi-cliente.
- Sin reportes avanzados.

Objetivo: que prueben el valor, no que operen gratis para siempre.

### Growth — $299.000 COP/mes

- 3 bodegas activas.
- 10 usuarios internos.
- 15 conductores privados.
- 500 viajes/mes.
- Evidencia completa.
- Inventario visual.
- Ubicaciones.
- Recibos.
- Despachos.
- Analítica base.
- Soporte prioritario.

Debe ser el plan más vendido.

### Scale — $799.000 COP/mes

- 10 bodegas activas.
- 30 usuarios internos.
- 50 conductores privados.
- 2.000 viajes/mes.
- Reportes operativos.
- Exportaciones.
- Control de novedades.
- Historial completo.
- Automatizaciones básicas.
- Soporte premium.

Este plan no debe regalar 5.000 viajes por $400.000 porque baja demasiado el valor percibido.

### Enterprise — desde $2.500.000 COP/mes

- Volumen contratado.
- Bodegas según contrato.
- Usuarios según contrato.
- Conductores según contrato.
- Multiempresa.
- 3PL multi-cliente.
- API/webhooks.
- Control tower.
- Reportes financieros.
- Aprobaciones.
- Auditoría.
- Treasury/wallet operativo.
- Implementación asistida.
- Soporte premium.

No usar “ilimitado” como promesa pública fija. Usar:

> Desde $2.500.000 COP/mes, volumen personalizado según operación.

## Estrategia de “free limits altos” sin dañar pricing

No subir el Free permanente. Crear una capa comercial llamada:

# Acceso Operativo KargaX

Nombre comercial recomendado:

- “Acceso Operativo gratis”
- “Arranque KargaX”
- “Launch Access”

Evitar “piloto” si el cliente lo siente experimental.

### Límites del Acceso Operativo

- Duración: 14 días por defecto.
- Puede extenderse a 30 días solo si hay uso real.
- 5 bodegas.
- 20 usuarios internos.
- 50 conductores privados.
- 500 viajes/mes equivalentes.

Estos límites son altos para que el cliente pruebe operación real, pero tienen vencimiento.

## Regla de oro

Free permanente = probar.  
Acceso Operativo = operar real por tiempo definido.  
Pago = continuar con operación recurrente.

## Cómo convertir a pago

El cliente paga cuando ocurre una de estas señales:

1. Crea más de 10 entregas reales.
2. Invita conductores.
3. Descarga soportes.
4. Registra novedades.
5. Usa KargaX más de 2 días en la semana.
6. Llega al 70% del límite.
7. Pide más usuarios/bodegas/conductores.
8. Quiere reportes o historial.
9. Quiere acceso para cliente.
10. Quiere seguir después de 14 días.

## Paywall correcto

No debe sentirse como castigo. Debe sentirse como crecimiento natural.

### Al 70% de uso

Mensaje:

> Tu operación ya está usando KargaX de forma real. Te quedan pocos viajes del Acceso Operativo. Activa Growth para mantener el flujo sin cortar evidencias, conductores ni reportes.

### Al 90% de uso

Mensaje:

> Estás cerca del límite operativo. Para no frenar despachos, recomendamos activar Growth/Scale según tu volumen.

### Al 100%

Mensaje:

> Llegaste al límite del plan actual. Tus datos quedan seguros. Para crear nuevos viajes o ampliar operación, activa el plan recomendado.

## Retención: cómo hacer que no se vayan

No se retiene con trampas. Se retiene haciendo que KargaX se vuelva parte del trabajo diario.

### Hooks legítimos de retención

1. **Evidencia histórica**  
   El cliente vuelve porque necesita buscar soportes de entregas pasadas.

2. **Reportes semanales**  
   Enviar resumen: viajes cerrados, novedades, rechazos, entregas sin evidencia, conductores activos.

3. **Cliente final exige soporte**  
   Si KargaX genera PDF/link por entrega, el cliente B2B empieza a pedirlo.

4. **Roles internos**  
   Operaciones, bodega, despacho, finanzas y gerencia usan distintas vistas.

5. **Conductores dentro del flujo**  
   Si el conductor ya cierra con PIN/foto/firma, volver a WhatsApp duele.

6. **Novedades y reclamos**  
   KargaX debe ser el lugar donde se resuelve “qué pasó con esa entrega”.

7. **Liquidaciones/wallet**  
   Cuando el cierre de entrega conecta con liquidación, el sistema se vuelve más difícil de reemplazar.

8. **Integraciones/API**  
   En Scale/Enterprise, integrarse a sistemas del cliente aumenta retención.

9. **Multi-bodega**  
   Cuando varias sedes operan en KargaX, el cambio de sistema duele más.

10. **Auditoría**  
   Calidad, gerencia y clientes deben confiar en los reportes de KargaX.

## Métricas de retención

Medir por empresa:

- Time to first value: tiempo hasta cerrar primera entrega con evidencia.
- Activación: 3 entregas reales cerradas en 48 horas.
- Retención semana 1: empresa crea viajes en 2 días distintos.
- Retención mes 1: más de 30 viajes cerrados.
- PQL: más del 70% del límite usado.
- PQL fuerte: 3 usuarios + 2 conductores + 10 entregas + 1 soporte descargado.
- Riesgo de churn: 7 días sin viajes.
- Valor: número de reclamos/novedades documentadas.

## Política de precios fundador

Para cerrar rápido sin destruir pricing:

- Growth oficial: $299.000 COP/mes.
- Precio fundador: $149.000 COP/mes por 3 meses.
- Excepción extrema: $80.000 COP/mes solo para los primeros 5 clientes que den caso de uso/testimonio.
- Después de 3 meses, subir a precio oficial o renovar anual con descuento.

Nunca presentar $80.000 como precio normal. Presentarlo como acuerdo fundador temporal.

## Regla para subir precios

1. Los clientes actuales mantienen precio por 3 meses.
2. Nuevos clientes entran con precios nuevos.
3. Anunciar cambio como “planes de producción”.
4. Ofrecer anual con 2 meses gratis.
5. No subir a clientes que aún no están activados.
6. Subir después de que el cliente tenga evidencia de valor.

## Frase comercial para pricing

> No cobramos por crear viajes. Cobramos por evitar entregas sin soporte, reclamos, novedades perdidas y tiempo operativo quemado entre conductor, despacho, cliente y administración.
