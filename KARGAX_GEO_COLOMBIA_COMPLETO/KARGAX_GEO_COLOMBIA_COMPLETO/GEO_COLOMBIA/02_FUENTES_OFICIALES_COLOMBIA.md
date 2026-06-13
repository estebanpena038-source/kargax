# 02 · Fuentes oficiales Colombia

Consulta documentada: 2026-06-13.

## Matriz de fuentes

| Fuente | URL | Qué aporta | Confianza | Limitaciones | Uso producción |
|---|---|---|---|---|---|
| DANE · DIVIPOLA | https://www.dane.gov.co/index.php/sistema-estadistico-nacional-sen/normas-y-estandares/nomenclaturas-y-clasificaciones/divipola | Codificación oficial para departamentos, municipios, distritos, áreas no municipalizadas y centros poblados | Alta | Puede publicarse como Excel/consulta, no siempre API estable | Sí, fuente primaria |
| Datos Abiertos Colombia · DIVIPOLA API | https://www.datos.gov.co/resource/xdk5-pm3f.json?$limit=50000 | Endpoint JSON para seed automatizado de departamentos/municipios si metadata confirma origen oficial | Alta si dataset owner/metadata oficial | Campos pueden cambiar nombre; por eso el script usa mapeo flexible | Sí, con checksum y versión |
| Geoportal DANE · Geovisor DIVIPOLA | https://geoportal.dane.gov.co/geovisores/territorio/consulta-divipola-division-politico-administrativa-de-colombia/ | Validación visual/territorial de codificación político-administrativa | Alta | Geovisor no siempre es la mejor fuente programática | Referencia/validación |
| DANE/Geoportal · datos geoestadísticos | https://geoportal.dane.gov.co/servicios/descarga-y-metadatos/datos-geoestadisticos/ | Potencial descarga oficial de centros poblados/capas geográficas | Alta | Requiere confirmar capa, licencia y fecha | Sí, después de checksum |
| Alcaldía/IDECA Bogotá | https://www.ideca.gov.co/ | Barrios/localidades oficiales de Bogotá cuando aplique | Alta local | Solo Bogotá, no Colombia completa | Sí para Bogotá |
| Alcaldías/POT/Geoportales municipales | Dominios oficiales municipales | Barrios, comunas, veredas, sectores según municipio | Alta local | No hay estructura nacional única; cobertura desigual | Sí por municipio verificado |
| Fuentes secundarias | Wikipedia, mapas comerciales, agregadores | Referencia rápida | Baja/Media | No usar como source of truth | Solo apoyo, nunca seed productivo |

## Regla sobre barrios

No se promete cobertura nacional de barrios porque no hay una base nacional única, oficial, completa y homogénea para todos los barrios de Colombia. KargaX debe tratar barrios/localidades/comunas/veredas como **zona interna opcional**:

1. Departamento y municipio: obligatorios, oficiales, completos por DIVIPOLA.
2. Centros poblados/corregimientos/veredas: cargar solo si se confirma dataset DANE/Geoportal o fuente municipal oficial.
3. Barrios/localidades/comunas: cargar por municipio cuando la alcaldía/geoportal oficial publique catálogo confiable.
4. Si no existe catálogo, permitir input manual con `is_user_submitted = true`, `needs_review = true`, `source = user_input`.
5. No bloquear viaje/bodega por barrio ausente; sí exigir departamento, municipio y dirección exacta.

## Política de versionado

Cada seed inserta registro en `geo_seed_versions` con:

- `source_name`
- `source_url`
- `source_checked_at`
- `source_version`
- `checksum`
- `row_counts`
- `notes`
