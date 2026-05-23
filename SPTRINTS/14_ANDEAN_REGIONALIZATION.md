# 14 - Andean Regionalization

## Objetivo

Preparar la expansion de Colombia hacia Peru y Ecuador sin reescribir el core ni hardcodear reglas locales.

## Principio

Primero Colombia, despues Andina. La expansion es configuracion y partners, no una copia improvisada del producto.

## Alcance

- catalogos por pais
- moneda
- documentos
- telefonia
- ciudades y regiones
- rails de pago
- templates y legales por pais

## Backlog de ejecucion

1. Crear `country registry`.
2. Extraer reglas de:
   - moneda
   - telefono
   - documento
   - timezone
   - tax labels
3. Crear adaptador de provider por pais.
4. Separar contenido legal y comercial por mercado.
5. Preparar seeds por pais.
6. Preparar checklist de launch por mercado.

## Entregables

- registry por pais
- providers desacoplados
- contratos y labels externos
- base Colombia/Peru/Ecuador

## Definition of Done

- el core no asume Colombia en cada capa
- agregar un pais nuevo es agregar config y partner strategy, no reescribir el producto

## QA

- formato telefono por pais
- moneda y precios
- documentos requeridos
- provider selection
- textos y URLs por ambiente/pais

## Riesgos

- expandir con reglas Colombia embebidas
- mezclar compliance de distintos paises
- abrir mercados sin partner financiero correcto

