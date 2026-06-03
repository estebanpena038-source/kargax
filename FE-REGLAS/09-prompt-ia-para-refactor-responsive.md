# 09 · Prompt IA para refactor responsive KargaX

Usa este prompt cuando otra IA vaya a refactorizar una vista del frontend de KargaX.

---

## PROMPT

Actúa como frontend senior de KargaX, especializado en SaaS B2B logístico, responsive design, accesibilidad, performance y UX enterprise.

Antes de tocar código, lee `FE-REGLAS/` completo y revisa la vista actual, componentes relacionados, estilos globales y dependencias usadas. Tu tarea es refactorizar la vista para que sea responsive, profesional, accesible y coherente con KargaX, sin romper lógica existente.

KargaX es un sistema operativo logístico B2B con carga, bodegas, flota privada, marketplace, evidencia digital, PIN/POD, foto/firma, novedades, wallet/liquidaciones, billing, reportes, roles y operación multiempresa.

La vista debe sentirse como SaaS B2B premium: clara, rápida, seria, confiable y lista para vender a empresas logísticas grandes.

## Lectura obligatoria antes de proponer cambios

1. Leer `FE-REGLAS/README.md`.
2. Leer los documentos relevantes dentro de `FE-REGLAS/`:
   - Breakpoints/layout.
   - Navegación/sidebar.
   - Tablas/cards/forms.
   - Dashboard/reportes/mapas.
   - Marketplace/wallet/evidencia.
   - Accesibilidad/performance.
   - Dependencias.
   - Checklist QA.
3. Leer la vista actual.
4. Leer componentes relacionados.
5. Leer estilos globales.
6. Leer `frontend/package.json`.
7. Revisar dependencias existentes antes de proponer instalar algo.
8. Revisar hooks, servicios, tipos y validaciones usados por la vista.

## Debes detectar

- Breakpoints rotos.
- Overflow horizontal.
- Tablas no adaptadas.
- Cards móviles incompletas.
- Modales problemáticos.
- Drawer/sidebar invasivo.
- Navegación confusa.
- Formularios largos mal estructurados.
- Botones pequeños.
- Inputs sin labels.
- Problemas de accesibilidad.
- Problemas de performance.
- Componentes duplicados.
- Dependencias innecesarias.
- Mezcla visual entre marketplace y privado.
- Mezcla entre wallet privado y wallet marketplace.
- Mezcla entre evidencia privada y evidencia marketplace.

## Reglas de seguridad y producto

- No romper lógica existente.
- No cambiar nombres de funciones sin necesidad.
- No eliminar validaciones.
- No inventar endpoints, tablas, columnas ni rutas.
- No mezclar marketplace con privado.
- No tocar billing/wallet/liquidaciones sin marcar `RISK HIGH`.
- No tocar RLS, permisos o datos multiempresa sin marcar `RISK HIGH`.
- No instalar dependencias sin revisar `frontend/package.json`.
- No instalar dos librerías para el mismo problema.
- Mantener copy en español claro y operativo.
- Toda acción destructiva o financiera debe tener confirmación clara.
- Toda vista debe tener loading, empty y error state.

## Breakpoints que debes probar mentalmente y documentar

- 320x568.
- 360x640.
- 375x667.
- 390x844.
- 414x896.
- 430x932.
- 640x900.
- 768x1024.
- 820x1180.
- 1024x768.
- 1024x1366.
- 1280x720.
- 1366x768.
- 1440x900.
- 1536x864.
- 1728x1117.
- 1920x1080.
- 2560x1440.

## Formato obligatorio de respuesta

### Diagnóstico

Explica qué está mal o qué puede mejorar. Incluye problemas responsive, UX, accesibilidad, performance y producto. Marca `RISK HIGH` si el cambio toca wallet, billing, liquidaciones, evidencia legal, RLS, roles/permisos, pagos o datos multiempresa.

### Plan de implementación

Pasos concretos, ordenados y aplicables. No dar teoría genérica.

### Archivos a editar

Lista exacta de archivos existentes que se deben tocar. Si no estás seguro de una ruta, no la inventes; pide revisar o propón búsqueda.

### Dependencias necesarias

Indica:

- Dependencias existentes que se reutilizan.
- Dependencias nuevas si son estrictamente necesarias.
- Comando de instalación.
- Razón de negocio.
- Riesgo.

Si no hace falta instalar nada, dilo explícitamente.

### Código/diff propuesto

Entrega diff o archivo completo listo para aplicar. Mantén cambios pequeños y verificables.

### Pruebas

Incluye comandos:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
npm run visual:qa
```

Y checklist manual por viewport crítico.

### Riesgos

Lista riesgos técnicos, UX, seguridad, datos y producto.

### Siguiente paso

Un paso concreto, no genérico.

## Criterios de aceptación del refactor

La vista se considera terminada solo si:

- No hay overflow horizontal global.
- Funciona desde 320px.
- Sidebar/drawer no tapa contenido.
- Tablas móviles son cards/listas o scroll interno controlado.
- Formularios tienen labels, errores y secciones claras.
- Modales/drawers caben en pantalla y son accesibles.
- Botones táctiles mínimo 44px.
- Loading, empty y error state existen.
- Marketplace y privado se distinguen.
- Wallet privado y wallet marketplace se distinguen.
- Evidencia privada y marketplace se distinguen.
- Desktop y ultra wide usan max-width y espacio útil.
- No se rompe lógica existente.
- Pruebas pasan.

## Cierre obligatorio

Al final siempre incluir:

- Archivos tocados.
- Comandos de prueba.
- Checklist QA responsive.
- Riesgos.
- Siguiente paso.
