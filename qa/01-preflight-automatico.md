# 01 - Preflight Automatico

> Esta prueba es como revisar el avion antes de despegar. No crea usuarios ni viajes. Solo mira si la base tecnica esta lista.

## E2E-01: Comandos de release y salud

### Que vas a probar

- Repo y scripts.
- Typecheck.
- Build.
- Release check.
- Smoke contra staging.
- Healthcheck.
- Storage y variables criticas.

### Antes de empezar

- Abre terminal en `C:\kargax2`.
- Ten internet.
- No cambies archivos mientras corre.

### Pasos automaticos

1. Ejecuta:
   ```powershell
   npm run typecheck
   ```
2. Ejecuta:
   ```powershell
   npm run build
   ```
3. Ejecuta:
   ```powershell
   npm run check:release
   ```
4. Ejecuta smoke contra staging:
   ```powershell
   $env:SMOKE_BASE_URL='https://kargax-staging.vercel.app'; npm --prefix frontend run smoke:release
   ```
5. Abre en navegador:
   ```text
   https://kargax-staging.vercel.app/api/health
   ```

### Tiene que pasar esto

- [ ] Typecheck pasa.
- [ ] Build pasa.
- [ ] Release check pasa.
- [ ] Smoke dice `pass`.
- [ ] Health responde JSON.
- [ ] Health no muestra secretos.
- [ ] Health no dice que falta `offer-photos`, `trip-photos`, `trip-signatures` o `warehouse-sku-images`.

### Si falla

- Si falla typecheck/build: no sigas con pruebas manuales.
- Si falla health por storage/env: arreglar staging primero.
- Si smoke falla por 503, guardar requestId y revisar admin/infra.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| Quien probo | |
| Comando que fallo | |
| Error exacto | |
| Screenshot / salida | |

---

## E2E-02: Home y rutas publicas no estan rotas

### Que vas a probar

- Home comercial.
- Landing camioneros.
- Planes.
- Registro/login.
- Copy sin promesas prohibidas.

### Pasos

1. Abre `/`.
2. Revisa que el home diga claro que KargaX sirve para flota privada, despacho, evidencia, wallet y reportes.
3. Click en `Agendar piloto` o CTA principal.
4. Abre `/para-camioneros`.
5. Abre `/planes`.
6. Abre `/registro`.
7. Abre `/login`.
8. En mobile, repite `/` y `/para-camioneros`.

### Tiene que pasar esto

- [ ] Ninguna ruta da 404.
- [ ] El home se entiende en menos de 1 minuto.
- [ ] En mobile no se tapa el texto ni los botones.
- [ ] No aparece copy de `adelantos`, `credito`, `prestamo`, `pago expres` o `pago en dos horas`.
- [ ] CTAs llevan a una accion real.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| Quien probo | |
| Rutas revisadas | |
| Screenshots | |







